/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  提交前体检的「语法」这一半：真的拿评测机那套开关把代码编一遍，只是不出目标文件
 *  （`-fsyntax-only`）。
 *
 *  为什么必须有它：precheck.ts 的三条规则查的是「本地编得过、评测机编不过」的写法，
 *  它看不见语法错误。学生少写一个分号，面板照样写「无问题」——那一句比不检查更坏，
 *  因为它教人在提交前相信一个假信号（2026-10-16 实测：`cout <<` 断在一行中间，
 *  工具面板与状态栏都是「体检通过」）。
 *
 *  检查的是**编辑器里的内容**，不是磁盘上那份：没保存的改动才是他正要交的代码。
 *  所以把缓冲区写进临时文件再编，编完删掉；未保存的新文件（Untitled-1.cpp）同样能查。
 *
 *  编译器不在、启动失败、超时，一律作为一条 finding 报出来：一个没读到任何东西的工具
 *  不能给出「无问题」。
 *--------------------------------------------------------------------------------------------*/
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { compilerBinary, planCompile } from './compile';
import { Finding, MAX_FINDINGS, SOURCE_FILES } from './precheck';

/** 语法检查的超时：一次完整编译的上限，比学生愿意等的时间短。 */
const SYNTAX_TIMEOUT_MS = 20000;

export interface SyntaxResult {
	readonly findings: readonly Finding[];
	/** 编译器没跑起来。此时「没有发现错误」不能写成「无问题」。 */
	readonly blocked?: string;
}

let tempCounter = 0;

/** `文件:行:列: 类别: 消息`；行号从 1 开始，g++ 有时在列号后加 `: ` 之外的东西。 */
const DIAG_LINE = /^(.+?):(\d+):(?:(\d+):)? (error|warning|note): (.*)$/;

/** 把编译那条路的参数改成语法检查：去掉 `-o 目标文件`，换成 `-fsyntax-only`。 */
function syntaxArgs(planArgs: readonly string[]): string[] {
	const stop = planArgs.indexOf('-o');
	const flags = stop < 0 ? [...planArgs] : planArgs.slice(0, stop);
	return [...flags, '-fsyntax-only'];
}

function sameFile(reported: string, tempFile: string): boolean {
	const norm = (p: string): string => p.replace(/\\/g, '/').replace(/^\.\/+/, '').toLowerCase();
	return norm(reported) === norm(tempFile);
}

function parseErrors(stderr: string, tempFile: string, lineCount: number): Finding[] {
	const findings: Finding[] = [];
	for (const line of stderr.split(/\r?\n/)) {
		if (findings.length >= MAX_FINDINGS) {
			break;
		}
		const m = DIAG_LINE.exec(line);
		if (!m || m[4] !== 'error') {
			continue;
		}
		// 头文件里的错误报不回这份缓冲区，跳过头文件路径。
		if (!sameFile(m[1], tempFile)) {
			continue;
		}
		const rawLine = Number(m[2]) - 1;
		if (!Number.isFinite(rawLine) || rawLine < 0) {
			continue;
		}
		findings.push({
			rule: 'syntax',
			severity: vscode.DiagnosticSeverity.Error,
			message: `编译不过：${m[5].trim()}`,
			line: Math.min(rawLine, Math.max(0, lineCount - 1)),
			character: Math.max(0, (Number(m[3]) || 1) - 1),
			length: 1,
			detail: '这是编译器原话，位置就是它报错的那一行。'
		});
	}
	return findings;
}

function runSyntax(compiler: string, args: readonly string[], cwd: string, source: string): Promise<{ code: number | null; stderr: string; failed?: string }> {
	return new Promise(resolve => {
		let child: ReturnType<typeof spawn>;
		try {
			child = spawn(compiler, [...args, source], { cwd, windowsHide: true });
		} catch (error) {
			resolve({ code: null, stderr: '', failed: error instanceof Error ? error.message : String(error) });
			return;
		}
		let stderr = '';
		let settled = false;
		const finish = (code: number | null, failed?: string): void => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timer);
			resolve({ code, stderr, failed });
		};
		const timer = setTimeout(() => {
			child.kill();
			finish(null, `语法检查超过 ${Math.round(SYNTAX_TIMEOUT_MS / 1000)} 秒没有结束，已中止。`);
		}, SYNTAX_TIMEOUT_MS);
		child.stderr?.on('data', chunk => { stderr += String(chunk); });
		child.on('error', error => finish(null, error.message));
		child.on('close', code => finish(code));
	});
}

/** 只对 C/C++ 源文件有意义；头文件走同一条路（学生也会交 .h 里的模板吗？不会，但编辑时要安静）。 */
export function wantsSyntaxCheck(document: vscode.TextDocument): boolean {
	return SOURCE_FILES.test(document.fileName) && document.languageId !== 'c';
}

/**
 * 编一遍当前缓冲区。返回的 findings 与 precheck.ts 的规则结果合并进同一个诊断集合，
 * 所以工具面板、状态栏那两枚 chip 不需要知道有两套来源。
 */
export async function syntaxCheck(document: vscode.TextDocument): Promise<SyntaxResult> {
	const compiler = compilerBinary();
	if (!compiler) {
		return { findings: [], blocked: '没有可用的编译器，语法这一项没有检查。' };
	}
	const tempFile = path.join(os.tmpdir(), `olympia-precheck-${process.pid}-${++tempCounter}.cpp`);
	let args: string[];
	let cwd: string;
	try {
		fs.writeFileSync(tempFile, document.getText(), 'utf8');
		// 复用编译那条路的开关（-x、-std、评测机公布的参数），
		// 否则会出现「体检说没问题、F9 编不过」这种自相矛盾。
		const plan = planCompile(vscode.Uri.file(tempFile), 'none');
		args = syntaxArgs(plan.args);
		cwd = plan.cwd;
	} catch (error) {
		fs.rmSync(tempFile, { force: true });
		return { findings: [], blocked: `没法开始语法检查：${error instanceof Error ? error.message : String(error)}` };
	}
	try {
		const result = await runSyntax(compiler, args, cwd, tempFile);
		if (result.failed) {
			return { findings: [], blocked: result.failed };
		}
		const findings = parseErrors(result.stderr, tempFile, document.lineCount);
		if (!findings.length && result.code !== 0) {
			// 非零退出却一条都没解析出来：不能报「无问题」，把原因原样递出去。
			const first = result.stderr.split(/\r?\n/).find(line => line.trim().length > 0) ?? '';
			return { findings: [], blocked: `编译器退出了（代码 ${result.code}），但没有报出行号可定位的错误：${first.slice(0, 200)}` };
		}
		return { findings };
	} finally {
		fs.rmSync(tempFile, { force: true });
	}
}
