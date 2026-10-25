/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import { runCapture } from './toolchain';

/**
 * 列出本机真实安装的字体（family 名）。
 *
 * ## 为什么放在扩展宿主
 *
 * 工作台是渲染进程（Chromium），**枚举不了系统字体**；VS Code 内核也没有字体服务
 * —— `oss/src/vs` 里搜 `InstalledFontCollection` / `fontListService` / `IFontListService`
 * 全部零命中，`src/vs/base/browser/fonts.ts` 只提供「默认字体常量」。
 * 扩展宿主是 Node，能起子进程，所以枚举在这里做，工作台用命令来问。
 *
 * ## 枚举方式（按「准」排优先级）
 *
 * 1. **PowerShell + System.Drawing**（Windows）：`InstalledFontCollection.Families`
 *    给的是 **family 名**，跟 Chromium 认的 `font-family` 是同一套名字。
 *    注册表里那套是「字体文件名」（`Cambria & Cambria Math (TrueType)`），
 *    一个文件里塞了两个 family，直接用会把名字写错。
 * 2. **注册表**（Windows 兜底）：快（几十毫秒），但名字是显示名，要去掉 `(TrueType)` 之类后缀，
 *    且多 family 的字体仍然不准确。
 * 3. **fontconfig**（Linux / 装了 fontconfig 的 macOS）：`fc-list --format=%{family}`。
 * 4. macOS 且没有 fontconfig：扫系统字体目录（拿到的是文件名，凑合用）。
 *
 * ## 失败语义
 *
 * 任何一步失败都返回**空数组**，绝不抛 —— 工作台那边拿到空数组会降级成
 * 「只有系统默认 + 手写字体栈」，页面不会崩，也不会弹系统下拉框。
 */

/**
 * 枚举一次的上限。PowerShell 冷启动在慢机器上可能要一两秒。
 *
 * 命令 id 不在这里 —— 它在 `commands.ts` 的 `CMD` 表里（那是命令 id 的单一真源）。
 */
const ENUM_TIMEOUT_MS = 10000;

/** 枚举结果缓存：成功一次就定下来（字体不会中途变）；失败不缓存，下次调用重试。 */
let cachedFonts: string[] | undefined;

/** 正在跑的枚举。并发调用共用同一次，不会起两个 PowerShell。 */
let pending: Promise<string[]> | undefined;

/**
 * 列出本机已安装的字体（family 名，已去重排序）。
 *
 * 拿不到就返回空数组 —— 调用方据此降级，不据此报错。
 */
export async function listSystemFonts(): Promise<string[]> {
	if (cachedFonts) {
		return cachedFonts;
	}
	if (!pending) {
		pending = enumerate().then(
			fonts => {
				cachedFonts = fonts;
				pending = undefined;
				return fonts;
			},
			() => {
				// 失败不落缓存：瞬时故障（策略拦截 / 子进程被杀）不该变成
				// 「本次会话里永远没有字体」—— 下一次调用（下次打开设置页）重试枚举，
				// 代价只是一次 PowerShell 冷启动。
				pending = undefined;
				return [] as string[];
			}
		);
	}
	return pending;
}

/** 清掉缓存。仅测试用。 */
export function resetSystemFontCache(): void {
	cachedFonts = undefined;
	pending = undefined;
}

// -------------------------------------------------------------------------
// 平台分发
// -------------------------------------------------------------------------

async function enumerate(): Promise<string[]> {
	if (process.platform === 'win32') {
		const viaDrawing = await enumerateWindowsByDrawing();
		if (viaDrawing.length > 0) {
			return viaDrawing;
		}
		// System.Drawing 不可用（精简系统 / .NET 缺失）时退回注册表。
		return enumerateWindowsByRegistry();
	}
	const viaFontconfig = await enumerateByFontconfig();
	if (viaFontconfig.length > 0) {
		return viaFontconfig;
	}
	return enumerateFontDirectories();
}

// -------------------------------------------------------------------------
// Windows
// -------------------------------------------------------------------------

/**
 * 用 GDI+ 的字体集合拿 family 名。
 *
 * 走绝对路径的 powershell.exe（`%SystemRoot%\System32\WindowsPowerShell\v1.0\`）：
 * 扩展宿主的 PATH 不一定带 System32，靠 PATH 找会时灵时不灵。
 */
async function enumerateWindowsByDrawing(): Promise<string[]> {
	const shell = powershellPath();
	if (!shell) {
		return [];
	}
	const script = [
		// 用模板字面量而不是双引号字符串：仓库的 local/code-no-unexternalized-strings
		// 禁止一切双引号字面量；而 PowerShell 的 -Command 参数里**双引号会被命令行
		// 解析器吃掉**（$ErrorActionPreference = "Stop" 会变成 Stop，PowerShell 报
		// 「不是可识别的命令」），所以脚本内容里必须保留单引号。
		`$ErrorActionPreference = 'Stop'`,
		'[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
		'Add-Type -AssemblyName System.Drawing',
		'$families = (New-Object System.Drawing.Text.InstalledFontCollection).Families',
		'$families | ForEach-Object { $_.Name }'
	].join('; ');
	const run = await runCapture(shell, ['-NoProfile', '-NonInteractive', '-Command', script], process.env, ENUM_TIMEOUT_MS);
	if (run.code !== 0) {
		return [];
	}
	return normalizeFontNames(run.stdout.split(/\r?\n/));
}

/** 注册表兜底：快，但名字是显示名。 */
async function enumerateWindowsByRegistry(): Promise<string[]> {
	const keys = [
		'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts',
		'HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'
	];
	const names: string[] = [];
	for (const key of keys) {
		const run = await runCapture('reg.exe', ['query', key], process.env, ENUM_TIMEOUT_MS);
		if (run.code !== 0) {
			continue;
		}
		for (const line of run.stdout.split(/\r?\n/)) {
			// `reg query` 的值行形如：  `    Arial (TrueType)    REG_SZ    C:\Windows\Fonts\arial.ttf`
			// 名字里可以有空格（"Segoe UI"），所以分隔符取「2 个以上空格 + REG_SZ」。
			const m = /^\s+(.+?)\s{2,}REG_SZ\s/.exec(line);
			if (m) {
				names.push(stripFontTypeSuffix(m[1]));
			}
		}
	}
	return normalizeFontNames(names);
}

/** 去掉注册表名字尾部的类型后缀：`Arial (TrueType)` → `Arial`。 */
function stripFontTypeSuffix(name: string): string {
	return name.replace(/\s*\([^()]*\)\s*$/, '').trim();
}

/** 定位 powershell.exe；找不到绝对路径就退回 PATH 解析。 */
function powershellPath(): string | undefined {
	const root = process.env.SystemRoot || process.env.WINDIR;
	if (root) {
		const candidate = path.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}
	return 'powershell.exe';
}

// -------------------------------------------------------------------------
// Linux / macOS
// -------------------------------------------------------------------------

async function enumerateByFontconfig(): Promise<string[]> {
	// --format 必须自带尾部换行：fc-list 不会自动补 \n，缺了它所有 family 连成一整行，
	// 按逗号拆开会拼出「Liberation SansDejaVu Sans」这类假字体名。
	const run = await runCapture('fc-list', ['--format=%{family}\\n'], process.env, ENUM_TIMEOUT_MS);
	if (run.code !== 0) {
		return [];
	}
	const names: string[] = [];
	for (const line of run.stdout.split(/\r?\n/)) {
		// fontconfig 的 family 字段可能是逗号分隔的别名表：`Sans, Sans Serif`
		for (const part of line.split(',')) {
			names.push(part);
		}
	}
	return normalizeFontNames(names);
}

/** 扫字体目录，拿文件名当 family 名（macOS 没有 fontconfig 时的凑合兜底）。 */
function enumerateFontDirectories(): string[] {
	const dirs = [
		'/System/Library/Fonts',
		'/Library/Fonts',
		path.join(process.env.HOME ?? '', 'Library', 'Fonts'),
		'/usr/share/fonts',
		'/usr/local/share/fonts'
	];
	const names: string[] = [];
	for (const dir of dirs) {
		if (!dir) {
			continue;
		}
		let entries: string[];
		try {
			entries = fs.readdirSync(dir);
		} catch {
			continue;
		}
		for (const entry of entries) {
			const ext = path.extname(entry).toLowerCase();
			if (ext === '.ttf' || ext === '.ttc' || ext === '.otf') {
				names.push(path.basename(entry, ext));
			}
		}
	}
	return normalizeFontNames(names);
}

// -------------------------------------------------------------------------
// 归一
// -------------------------------------------------------------------------

/** 去空白、去重（大小写不敏感）、排序。 */
function normalizeFontNames(raw: readonly string[]): string[] {
	const seen = new Map<string, string>();
	for (const item of raw) {
		const name = item.trim();
		if (!name) {
			continue;
		}
		const key = name.toLowerCase();
		if (!seen.has(key)) {
			seen.set(key, name);
		}
	}
	return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
