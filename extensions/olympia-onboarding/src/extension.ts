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
import { analyse, toDiagnostic, SOURCE_FILES } from './precheck';
import {
	registerCompileTaskProvider, compileCurrentFile, compileJudgeAccurate, compileAndRun
} from './compile';
import { resolveCompiler, type ResolvedCompiler, type CompilerSource } from './toolchain';

const WEBSITE = 'https://olympia.dpdns.org';
const DOCS = 'https://olympia.dpdns.org/docs';

/** A judge environment we know how to reproduce locally. */
export interface OJTarget {
	readonly id: string;
	readonly label: string;
	/** GCC version the judge runs. */
	readonly gcc: string;
	/** C++ standard the judge accepts. */
	readonly std: string;
	/** Environment variable the judge defines. */
	readonly onlineJudge: string;
	/** Exact switch set published by the judge. */
	readonly flags: string;
}

const OJ_TARGETS: readonly OJTarget[] = [
	{
		id: 'luogu',
		label: '洛谷',
		gcc: '15.1.0',
		std: 'c++23',
		onlineJudge: 'ONLINE_JUDGE=luogu',
		flags: '-x c++ -std=c++23 -fPIC -DONLINE_JUDGE -Wall -fno-asm -lm -march=native'
	},
	{
		id: 'noi',
		label: 'NOI Linux 2.0',
		gcc: '9.3.0',
		std: 'c++14',
		onlineJudge: 'ONLINE_JUDGE=noi',
		flags: '-x c++ -std=c++14 -fPIC -DONLINE_JUDGE -Wall -fno-asm -lm -march=native'
	}
];

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
	};
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

function renderReport(report: CompilerReport): string {
	const lines: string[] = [];
	if (!report.available) {
		lines.push('状态：未检测到可用的 C++ 编译器');
		lines.push(`探测的路径：${report.binary}`);
		if (report.error) {
			lines.push(`原因：${report.error}`);
		}
		lines.push('');
		lines.push('如果这是安装了内置工具链的正式版本，请重新下载安装包；');
		lines.push('如果是开发版本，可在设置 olympia.compiler.path 中指定 g++ 的完整路径。');
		return lines.join('\n');
	}

	lines.push('状态：编译器就绪');
	lines.push(`路径：${report.binary}`);
	lines.push(`来源：${sourceLabel(report.source)}`);
	lines.push(`版本：g++ ${report.version ?? '未知'}`);
	lines.push('');
	lines.push('与评测机环境的对比：');
	for (const match of report.matches) {
		const mark = match.matched ? '完全一致' : '版本不同';
		lines.push(`  - ${match.target.label}：需要 GCC ${match.target.gcc} / ${match.target.std.toUpperCase()}  [${mark}]`);
	}
	lines.push('');
	if (report.source === 'path') {
		lines.push('提示：当前使用的是系统 PATH 上的编译器。正式版 Olympia 自带工具链，');
		lines.push('内置版本与评测机参数对齐度更高。若结果与评测机不一致，可手动指定路径。');
		lines.push('');
	}
	lines.push('说明：编译参数已内置到 olympia.compiler.profile，本地与评测机使用同一套开关。');
	lines.push(`参数来源：${DOCS}`);
	return lines.join('\n');
}

async function showEnvironmentReport(): Promise<CompilerReport> {
	const report = await detectCompiler();
	const channel = vscode.window.createOutputChannel('Olympia 环境自检');
	channel.clear();
	channel.appendLine(renderReport(report));
	channel.show(true);

	const summary = report.available
		? `编译器就绪：g++ ${report.version ?? '未知'}（${sourceLabel(report.source)}）`
		: '未检测到 g++，请在设置中指定 olympia.compiler.path';

	// Only offer the settings shortcut when there is actually something to configure — on a
	// bundled install the compiler is already right there.
	const actions = report.available ? ['查看详情'] : ['打开设置', '查看官网'];
	const choice = await vscode.window.showInformationMessage(summary, ...actions);
	if (choice === '打开设置') {
		await vscode.commands.executeCommand('workbench.action.openSettings', 'olympia.compiler.path');
	} else if (choice === '查看官网') {
		await vscode.commands.executeCommand('olympia.openWebsite');
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
	const current = vscode.workspace
		.getConfiguration('olympia')
		.get<string>('compiler.profile', 'luogu');

	const items: ProfileItem[] = OJ_TARGETS.map(target => ({
		id: target.id,
		label: target.label,
		description: `GCC ${target.gcc} · ${target.std.toUpperCase()}`,
		detail: target.flags
	}));
	items.push({ id: 'custom', label: '自定义', description: '自己指定编译参数' });

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
	const profile = config.get<string>('compiler.profile', 'luogu');
	if (profile === 'custom') {
		return config.get<string>('compiler.customFlags', '').trim();
	}
	const target = OJ_TARGETS.find(item => item.id === profile);
	return target ? target.flags : OJ_TARGETS[0].flags;
}

// ---------------------------------------------------------------------------------------------
// 提交前体检
// ---------------------------------------------------------------------------------------------

let diagnostics: vscode.DiagnosticCollection | undefined;

function runCheck(document: vscode.TextDocument, surface: 'problems' | 'quiet'): void {
	if (!diagnostics || !SOURCE_FILES.test(document.fileName)) {
		return;
	}
	const profile = vscode.workspace.getConfiguration('olympia').get<string>('compiler.profile', 'luogu');
	const findings = analyse(document.getText(), profile);
	diagnostics.set(document.uri, findings.map(toDiagnostic));

	if (surface === 'quiet' || findings.length === 0) {
		return;
	}
	const errors = findings.filter(f => f.severity === vscode.DiagnosticSeverity.Error).length;
	const warnings = findings.length - errors;
	const summary = errors > 0
		? `提交前体检：发现 ${errors} 个严重问题、${warnings} 个提醒`
		: `提交前体检：发现 ${warnings} 个提醒`;
	void vscode.window.showWarningMessage(summary, '查看问题', '忽略').then(choice => {
		if (choice === '查看问题') {
			void vscode.commands.executeCommand('workbench.actions.view.problems');
		}
	});
}

async function preSubmitCheck(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		void vscode.window.showWarningMessage('提交前体检：请先打开要检查的源文件。');
		return;
	}
	runCheck(editor.document, 'problems');
	const found = diagnostics?.get(editor.document.uri) ?? [];
	if (found.length === 0) {
		void vscode.window.showInformationMessage('提交前体检：没有发现问题，可以提交了。');
	}
}

export function activate(context: vscode.ExtensionContext): void {
	diagnostics = vscode.languages.createDiagnosticCollection('olympia-precheck');
	context.subscriptions.push(diagnostics);

	const checkEnabled = (): boolean => vscode.workspace
		.getConfiguration('olympia')
		.get<boolean>('check.enabled', true);

	context.subscriptions.push(
		vscode.commands.registerCommand('olympia.checkEnvironment', () => showEnvironmentReport()),
		vscode.commands.registerCommand('olympia.pickCompileProfile', () => pickCompileProfile()),
		vscode.commands.registerCommand('olympia.preSubmitCheck', () => preSubmitCheck()),
		vscode.commands.registerCommand('olympia.compile', () => compileCurrentFile()),
		vscode.commands.registerCommand('olympia.compileJudgeAccurate', () => compileJudgeAccurate()),
		vscode.commands.registerCommand('olympia.compileAndRun', () => compileAndRun()),
		vscode.commands.registerCommand('olympia.openWebsite', () => vscode.env.openExternal(vscode.Uri.parse(WEBSITE)))
	);

	context.subscriptions.push(registerCompileTaskProvider());

	// run on save, silently: the Problems panel is the surface, not a modal
	context.subscriptions.push(
		vscode.workspace.onWillSaveTextDocument(event => {
			if (!checkEnabled()) {
				return;
			}
			if (!vscode.workspace.getConfiguration('olympia').get<boolean>('check.onSave', true)) {
				return;
			}
			runCheck(event.document, 'quiet');
		})
	);

	// and once per visible editor so a freshly opened file is never unchecked
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor && checkEnabled()) {
				runCheck(editor.document, 'quiet');
			}
		})
	);
}

export function deactivate(): void {
	diagnostics = undefined;
}
