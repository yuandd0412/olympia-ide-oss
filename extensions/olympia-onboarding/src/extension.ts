/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Olympia IDE - built-in onboarding extension.
 *
 *  Owns the competition-oriented entry points that do not belong in the workbench:
 *  compiler probing, judge-accurate compile profiles and the website hand-off.
 *
 *  Judge parameters below are transcribed from the public Luogu documentation so that a
 *  local build matches what the judge actually runs:
 *    https://help.luogu.com.cn/manual/luogu/problem/judging
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { analyse, toDiagnostic, SOURCE_FILES, type Finding } from './precheck';
import { syntaxCheck } from './syntaxCheck';
import { parseCheck, wantsParseCheck } from './parserCheck';
import { scanStructure } from './blockDone';
import { forgetDocument, markChecked, type CheckLevel } from './precheckState';
import {
	registerCompileTaskProvider, compileCurrentFile, compileJudgeAccurate, compileAndRun
} from './compile';
import { resolveCompiler, type ResolvedCompiler, type CompilerSource } from './toolchain';
import { probeToolchain, type ProbeStep } from './envProbe';
import { OJ_TARGETS, OJTarget, CUSTOM_TARGET_ID, activeTarget, profileId, renderFlags } from './ojTargets';
import { registerToolsView } from './toolsView';
import { registerStatusBar } from './statusBar';
import { registerStressTest } from './stressTest';
import { registerContestMode } from './contestMode';
import { registerSampleJudge } from './judgeSamples';
import { registerSolveLog } from './solveLog';
import { registerSettingsPanel } from './settingsPanel';
import { openLicenceNotices } from './licences';
import { CMD } from './commands';

const WEBSITE = 'https://olympia.dpdns.org';
const DOCS = `${WEBSITE}/docs`;
/** 官网首页的下载区锚点。环境自检发现这台机器没编译器时直接把它点开，省得用户自己找。 */
const DOWNLOAD_PAGE = `${WEBSITE}/#download`;
const ENVIRONMENT_CHANNEL_TITLE = 'Olympia 环境自检';

export interface TargetMatch {
	readonly target: OJTarget;
	readonly matched: boolean;
}

export interface CompilerReport {
	readonly available: boolean;
	readonly binary: string;
	readonly version: string | undefined;
	readonly matches: readonly TargetMatch[];
	/** where the compiler was found, so the report can explain the choice */
	readonly source?: CompilerSource['kind'];
	/** why detection failed, when it did */
	readonly error?: string;
	/** `g++ --version` answered but a subprogram it needs cannot be loaded */
	readonly broken?: string;
}

/** 自检的全部结论：编译器探测 + 探针步骤。`healthy` 是所有探针都过了，不是 `g++` 会答话。 */
export interface EnvironmentReport {
	readonly compiler: CompilerReport;
	readonly probes: readonly ProbeStep[];
	readonly healthy: boolean;
}

export async function detectCompiler(): Promise<CompilerReport> {
	const resolved: ResolvedCompiler = await resolveCompiler();
	const matches = OJ_TARGETS.map(target => ({
		target,
		matched: resolved.version !== undefined && resolved.version === target.gcc
	}));
	return {
		available: resolved.usable,
		binary: resolved.bin,
		version: resolved.version,
		matches,
		source: resolved.kind,
		error: resolved.error,
		broken: resolved.broken,
	};
}

/**
 * The whole self-check. Probing `g++ --version` alone is what let a toolchain missing five runtime
 * DLLs ship as "就绪": g++.exe imports none of them, so it answers while every real compile dies
 * silently. The end-to-end probes are the ones that decide the verdict.
 */
export async function checkEnvironment(): Promise<EnvironmentReport> {
	const compiler = await detectCompiler();
	// 编译器都不在，探针就只是几个注定失败的 spawn；那一步交给补救建议去说。
	const probes = compiler.available ? await probeToolchain() : [];
	return { compiler, probes, healthy: compiler.available && probes.every(step => step.ok) };
}

/** Human label for where the compiler came from, shown in the environment report. */
function sourceLabel(source: CompilerSource['kind'] | undefined): string {
	switch (source) {
		case 'bundled': return '内置工具链（随 Olympia 一起安装）';
		case 'path': return '系统 PATH';
		case 'configured': return '自定义路径（olympia.compiler.path）';
		default: return '未知';
	}
}

/**
 * 找不到编译器时该怎么补救。三种来源要分开说：探测落到 `path` 意味着这台机器上
 * 根本没有编译器——精简版（不内置 MinGW）装在没有编译器的机房机器上正好是这一种，
 * 此时「重新下载安装包」是废话，该说的是下完整版或自己装一个。
 * `bundled` 却跑不起来才是安装不完整；`configured` 是本人填错了路径。
 */
function missingCompilerAdvice(report: CompilerReport): readonly string[] {
	switch (report.source) {
		case 'bundled':
			return [
				'本应随产品一起安装的内置编译器跑不起来，多半是安装不完整。',
				`请到 ${DOWNLOAD_PAGE} 重新下载并覆盖安装。`,
			];
		case 'configured':
			return [
				`设置里指定的那个路径跑不起来：${report.binary}。`,
				'清空 olympia.compiler.path 可回到自动探测；也可改成 g++.exe 的完整路径后重试。',
			];
		default:
			return [
				'这台机器上没找到任何 C++ 编译器（内置工具链和系统 PATH 都没有）。',
				`三条路：①下载带编译器的完整版（${DOWNLOAD_PAGE}）；`,
				'②自己装一个 MinGW-w64 并把它的 bin 目录加进系统 PATH；',
				'③在设置 olympia.compiler.path 里直接填 g++.exe 的完整路径。',
				'任选其一后，在命令面板里重新运行「环境自检」。',
			];
	}
}

/** 按钮文字与上面三条补救对应：PATH 空着时先给完整版，其次才是手工填路径。 */
function missingCompilerActions(source: CompilerSource['kind'] | undefined): readonly string[] {
	return source === 'configured' ? ['打开设置', '查看详情'] : ['下载完整版', '打开设置', '查看详情'];
}

function renderReport(report: EnvironmentReport): string {
	const { compiler: found, probes } = report;
	const lines: string[] = [];
	if (!found.available) {
		lines.push('状态：未检测到可用的 C++ 编译器');
		lines.push(`探测的路径：${found.binary}`);
		if (found.error) {
			lines.push(`原因：${found.error}`);
		}
		lines.push('');
		lines.push(...missingCompilerAdvice(found));
		return lines.join('\n');
	}

	lines.push(report.healthy
		? '状态：编译器就绪'
		: '状态：工具链不完整——g++ 能启动，但真正的编译或运行跑不通');
	lines.push(`路径：${found.binary}`);
	lines.push(`来源：${sourceLabel(found.source)}`);
	lines.push(`版本：g++ ${found.version ?? '未知'}`);
	if (found.broken) {
		lines.push(`工具链自检：${found.broken}`);
	}
	lines.push('');
	lines.push('自检探针（每一步都用 Olympia 自己拼的子进程环境）：');
	for (const step of probes) {
		lines.push(`  ${step.ok ? '[过]' : '[不过]'} ${step.label}`);
		if (step.detail) {
			lines.push(`         ${step.detail}`);
		}
	}
	lines.push('');
	lines.push('与评测机环境的对比：');
	for (const match of found.matches) {
		const mark = match.matched ? '完全一致' : '版本不同';
		lines.push(`  - ${match.target.label}：需要 GCC ${match.target.gcc} / ${match.target.std.toUpperCase()}  [${mark}]`);
	}
	lines.push('');
	if (!report.healthy) {
		lines.push(...missingCompilerAdvice(found));
		lines.push('');
	}
	if (found.source === 'path') {
		lines.push('提示：当前使用的是系统 PATH 上的编译器。正式版 Olympia 自带工具链，');
		lines.push('内置版本与评测机参数对齐度更高。若结果与评测机不一致，可手动指定路径。');
		lines.push('');
	}
	lines.push('说明：编译参数已内置到 olympia.compiler.profile，本地与评测机使用同一套开关。');
	lines.push(`参数来源：${DOCS}`);
	return lines.join('\n');
}

/**
 * 环境自检的输出面板：一次按 Ctrl+Alt+D 建一个的话，面板列表会攒出一排同名的
 * 「Olympia 环境自检 #2 #3…」——和 compile.ts 里警告过的是同一件事。
 */
let environment: vscode.OutputChannel | undefined;

function environmentChannel(): vscode.OutputChannel {
	if (!environment) {
		environment = vscode.window.createOutputChannel(ENVIRONMENT_CHANNEL_TITLE);
	}
	return environment;
}

async function showEnvironmentReport(): Promise<EnvironmentReport> {
	const report = await checkEnvironment();
	const channel = environmentChannel();
	channel.clear();
	channel.appendLine(renderReport(report));
	channel.show(true);

	const failed = report.probes.filter(step => !step.ok);
	const summary = !report.compiler.available
		? report.compiler.source === 'path'
			? '这台机器上没有可用的 C++ 编译器，编译和跑样例都用不了'
			: `编译器跑不起来（${sourceLabel(report.compiler.source)}），详见环境自检`
		: report.healthy
			? `编译器就绪：g++ ${report.compiler.version ?? '未知'}（${sourceLabel(report.compiler.source)}）`
			: `工具链不完整：g++ 自己能启动，但有 ${failed.length} 项自检没过——编译或运行会失败，详见环境自检`;

	const actions = report.healthy ? ['查看详情'] : missingCompilerActions(report.compiler.source);
	const choice = await vscode.window.showInformationMessage(summary, ...actions);
	if (choice === '打开设置') {
		await vscode.commands.executeCommand('workbench.action.openSettings', 'olympia.compiler.path');
	} else if (choice === '下载完整版') {
		await vscode.env.openExternal(vscode.Uri.parse(DOWNLOAD_PAGE));
	}
	return report;
}

/** A selectable compile profile in the quick pick. */
interface ProfileItem {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly detail?: string;
}

async function pickCompileProfile(): Promise<void> {
	const current = profileId();

	const items: ProfileItem[] = OJ_TARGETS.map(target => ({
		id: target.id,
		label: target.label,
		description: `GCC ${target.gcc} · ${target.std.toUpperCase()}`,
		detail: renderFlags(target)
	}));
	items.push({ id: CUSTOM_TARGET_ID, label: '自定义', description: '自己指定编译参数' });

	// QuickPickOptions.currentItem no longer exists in the 1.140 extension API,
	// so the active profile is surfaced by ordering it first instead.
	const active = items.find(item => item.id === current);
	if (active) {
		items.splice(items.indexOf(active), 1);
		items.unshift(active);
	}

	const picked = await vscode.window.showQuickPick(items, {
		placeHolder: '选择按哪个评测机的环境编译'
	});
	if (!picked) {
		return;
	}
	await vscode.workspace
		.getConfiguration('olympia')
		.update('compiler.profile', picked.id, vscode.ConfigurationTarget.Workspace);
	vscode.window.showInformationMessage(`已切换到「${picked.label}」编译配置。`);
}

/** The full g++ command line Olympia would use for the active profile. */
export function currentCompileFlags(): string {
	const config = vscode.workspace.getConfiguration('olympia');
	if (profileId() === CUSTOM_TARGET_ID) {
		return config.get<string>('compiler.customFlags', '').trim();
	}
	return renderFlags(activeTarget());
}

// ---------------------------------------------------------------------------------------------
// 提交前体检
// ---------------------------------------------------------------------------------------------

let diagnostics: vscode.DiagnosticCollection | undefined;

/** 扩展自己的目录：语法解析的 wasm 在这里，编译器的路径不假设它在工程里。 */
let extensionDir = '';

/** 正在查的文档：连点标签页不该堆出好几个 g++，同理也不该堆出两次解析。 */
const checking = new Set<string>();

/**
 * 上一次查的时候，这份文件顶层闭合了几对花括号。每跑一次检查就记一次，所以刚打开文件
 * 那一下也有基准：不然第一次写完部件时基准还是空的，只能拿当下这一份比，就永远不会触发。
 */
const blocksSeen = new Map<string, number>();

function runCheck(document: vscode.TextDocument, surface: 'problems' | 'quiet', level: CheckLevel): Promise<void> {
	const key = document.uri.toString();
	if (checking.has(key)) {
		return Promise.resolve();
	}
	checking.add(key);
	return runCheckNow(document, surface, level).finally(() => checking.delete(key));
}

async function runCheckNow(document: vscode.TextDocument, surface: 'problems' | 'quiet', level: CheckLevel): Promise<void> {
	if (!diagnostics || !SOURCE_FILES.test(document.fileName)) {
		return;
	}
	const findings: Finding[] = analyse(document.getText());
	// 规则那半同步、另一头要等（编译器是一两秒，解析是几毫秒）：先画出来，别让输入卡住。
	diagnostics.set(document.uri, findings.map(toDiagnostic));
	// 「编译不过」这句话只由 g++ 说；部件级那一跑只用进程内的语法解析，它够快，但看不见类型。
	const half = level === 'structure'
		? await parseCheck(document, extensionDir)
		: await syntaxCheck(document);
	findings.push(...half.findings);
	if (half.blocked) {
		// 一个没读到任何东西的工具不能给出「无问题」。
		findings.push({
			rule: level === 'structure' ? 'parse' : 'syntax',
			severity: vscode.DiagnosticSeverity.Warning,
			message: half.blocked,
			line: 0,
			character: 0,
			length: 1,
			detail: '这一条不是代码的问题，是体检本身没跑完。'
		});
	}
	// 先记下"查过了"，再写诊断：面板是收到诊断变化才刷新的，反过来会刷成「未检查」。
	markChecked(document, level);
	blocksSeen.set(document.uri.toString(), scanStructure(document.getText()).blocks);
	diagnostics.set(document.uri, findings.map(toDiagnostic));

	if (surface === 'quiet' || findings.length === 0) {
		return;
	}
	const compileErrors = findings.filter(finding => finding.rule === 'syntax').length;
	// 语法错误和「本地能编过、评测机编不过」是两件事，说成一句会让人去找不存在关键字。
	const summary = compileErrors
		? `提交前体检：这份代码编译不过（${compileErrors} 处）`
		: `提交前体检：${findings.length} 处写法会在评测机上编译失败`;
	void vscode.window.showErrorMessage(summary, '查看问题', '忽略').then(choice => {
		if (choice === '查看问题') {
			void vscode.commands.executeCommand('workbench.actions.view.problems');
		}
	});
}

/** 手停下来这么久就认为这个部件写完了：再短会在敲空格时反复解析，再长就感觉不即时。 */
const BLOCK_DEBOUNCE_MS = 400;

async function preSubmitCheck(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		void vscode.window.showWarningMessage('提交前体检：请先打开要检查的源文件。');
		return;
	}
	await runCheck(editor.document, 'problems', 'compiled');
	const found = diagnostics?.get(editor.document.uri) ?? [];
	if (found.length === 0) {
		void vscode.window.showInformationMessage('提交前体检：语法和写法都没问题，可以提交了。');
	}
}

export function activate(context: vscode.ExtensionContext): void {
	extensionDir = context.extensionPath;
	diagnostics = vscode.languages.createDiagnosticCollection('olympia-precheck');
	context.subscriptions.push(diagnostics);

	const checkEnabled = (): boolean => vscode.workspace
		.getConfiguration('olympia')
		.get<boolean>('check.enabled', true);

	context.subscriptions.push(
		vscode.commands.registerCommand(CMD.checkEnvironment, () => showEnvironmentReport()),
		vscode.commands.registerCommand(CMD.pickCompileProfile, () => pickCompileProfile()),
		vscode.commands.registerCommand(CMD.preSubmitCheck, () => preSubmitCheck()),
		vscode.commands.registerCommand(CMD.compile, () => compileCurrentFile()),
		vscode.commands.registerCommand(CMD.compileJudgeAccurate, () => compileJudgeAccurate()),
		vscode.commands.registerCommand(CMD.compileAndRun, () => compileAndRun()),
		vscode.commands.registerCommand(CMD.openWebsite, () => vscode.env.openExternal(vscode.Uri.parse(WEBSITE))),
		vscode.commands.registerCommand(CMD.openLicences, () => openLicenceNotices())
	);
	// 面板本身也要跟着扩展销毁，不然重载窗口会攒出一排同名面板
	context.subscriptions.push({ dispose: () => environment?.dispose() });

	context.subscriptions.push(registerCompileTaskProvider());

	// the persistent bars: the activity-bar panel and the status-bar chips. The palette stays
	// available, but it is no longer the only way to reach any of this.
	registerToolsView(context);
	registerStatusBar(context);
	registerStressTest(context);
	registerContestMode(context);
	registerSampleJudge(context);
	registerSolveLog(context);
	context.subscriptions.push(registerSettingsPanel());

	// 写完一个部件就查：顶层那对花括号刚闭合、手也停了一小会儿，就用进程内的语法解析报结构错误。
	// 这条不启编译器，所以它只管「这一层第一次成为完整的结构」；部件没闭合（depth>0）时不查，
	// 那会儿查只会拿到一个假的 MISSING "}"——学生还在往里写。
	const blockTimers = new Map<string, ReturnType<typeof setTimeout>>();
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(event => {
			const document = event.document;
			if (!checkEnabled() || !wantsParseCheck(document)) {
				return;
			}
			const key = document.uri.toString();
			clearTimeout(blockTimers.get(key));
			blockTimers.set(key, setTimeout(() => {
				blockTimers.delete(key);
				if (!vscode.workspace.getConfiguration('olympia').get<boolean>('check.onBlockDone', true)) {
					return;
				}
				const { blocks, depth } = scanStructure(document.getText());
				const before = blocksSeen.get(key) ?? blocks;
				blocksSeen.set(key, blocks);
				if (depth === 0 && blocks > before) {
					void runCheck(document, 'quiet', 'structure');
				}
			}, BLOCK_DEBOUNCE_MS));
		})
	);

	// 保存时静默真编一遍：「编译不过」这句话只由编译器说，解析器说不了。
	context.subscriptions.push(
		vscode.workspace.onWillSaveTextDocument(event => {
			if (!checkEnabled()) {
				return;
			}
			if (!vscode.workspace.getConfiguration('olympia').get<boolean>('check.onSave', true)) {
				return;
			}
			void runCheck(event.document, 'quiet', 'compiled');
		})
	);

	// and once per visible editor so a freshly opened file is never unchecked
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor && checkEnabled()) {
				void runCheck(editor.document, 'quiet', 'compiled');
			}
		})
	);

	// 窗口恢复时那个文件**已经**是活动编辑器了：没有"变化"就没有检查，面板会拿着空诊断列表
	// 写「无问题」——那正是 2026-10-16 误报的形状。启动时先把看得见的编辑器各查一遍。
	for (const editor of vscode.window.visibleTextEditors) {
		if (checkEnabled()) {
			void runCheck(editor.document, 'quiet', 'compiled');
		}
	}

	context.subscriptions.push(
		vscode.workspace.onDidCloseTextDocument(document => {
			forgetDocument(document.uri);
			blocksSeen.delete(document.uri.toString());
			const timer = blockTimers.get(document.uri.toString());
			if (timer) {
				clearTimeout(timer);
				blockTimers.delete(document.uri.toString());
			}
			diagnostics?.delete(document.uri);
		})
	);
}

export function deactivate(): void {
	diagnostics = undefined;
}
