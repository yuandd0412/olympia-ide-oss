/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Olympia IDE - the Olympia panel in the activity bar.
 *
 *  The competition tools are the product, so they are not allowed to hide behind the command
 *  palette. This view is the always-visible surface: the current compiler and judge target at
 *  the top, then every action as a button with its key binding next to it.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CMD, KEYS } from './commands';
import { activeTarget, renderFlags, targetSummary } from './ojTargets';
import { resolveCompiler } from './toolchain';
import { PRECHECK_SOURCE, SOURCE_FILES } from './precheck';
import { statementFiles, watchStatements } from './problemFiles';
import { contestSummary, isContestRunning, onContestChange } from './contestMode';
import { VERDICT_CODES } from './judgeSamples';

interface Section {
	readonly kind: 'section';
	readonly id: string;
	readonly label: string;
}

interface Action {
	readonly kind: 'action';
	readonly id: string;
	readonly label: string;
	readonly icon: string;
	readonly command: string;
	readonly key?: string;
	readonly tooltip?: string;
}

interface State {
	readonly kind: 'state';
	readonly id: string;
	readonly label: string;
	readonly value: string;
	readonly icon: string;
	readonly command: string;
	readonly tooltip: string;
}

type TreeEntry = Section | Action | State;

const COMPILER_MISSING = '未检测到';
const LIBRARY_UNKNOWN = '未统计';
const LIBRARY_EMPTY = '还没拉过题面';

/** The compiler line is the one thing here that cannot be read synchronously. */
interface CompilerState {
	readonly label: string;
	readonly icon: string;
}

class OlympiaToolsProvider implements vscode.TreeDataProvider<TreeEntry> {

	private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeEntry | undefined>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private compiler: CompilerState = { label: COMPILER_MISSING, icon: 'debug-disconnect' };
	private library = LIBRARY_UNKNOWN;

	constructor() {
		void this.refreshCompiler();
		void this.refreshLibrary();
	}

	async refreshCompiler(): Promise<void> {
		const resolved = await resolveCompiler();
		this.compiler = resolved.usable
			? { label: `g++ ${resolved.version ?? '版本未知'}`, icon: 'pass' }
			: { label: COMPILER_MISSING, icon: 'error' };
		this.fire();
	}

	/** 缓存了几份题面：读一次目录就够，不解析内容。 */
	async refreshLibrary(): Promise<void> {
		const count = (await statementFiles()).length;
		this.library = count ? `${count} 份` : LIBRARY_EMPTY;
		this.fire();
	}

	/** 只重画树，不重新探测编译器：倒计时每秒刷新走这条，别顺带 spawn g++。 */
	fire(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	refresh(): void {
		void this.refreshCompiler();
		void this.refreshLibrary();
		this.fire();
	}

	getTreeItem(entry: TreeEntry): vscode.TreeItem {
		switch (entry.kind) {
			case 'section': {
				const item = new vscode.TreeItem(entry.label, vscode.TreeItemCollapsibleState.Expanded);
				item.id = `section:${entry.id}`;
				return item;
			}
			case 'state': {
				const item = new vscode.TreeItem(`${entry.label}：${entry.value}`, vscode.TreeItemCollapsibleState.None);
				item.id = `state:${entry.id}`;
				item.iconPath = new vscode.ThemeIcon(entry.icon);
				item.tooltip = new vscode.MarkdownString(entry.tooltip);
				item.command = { command: entry.command, title: entry.label };
				return item;
			}
			case 'action': {
				const item = new vscode.TreeItem(entry.label, vscode.TreeItemCollapsibleState.None);
				item.id = `action:${entry.id}`;
				item.description = entry.key;
				item.iconPath = new vscode.ThemeIcon(entry.icon);
				item.tooltip = entry.tooltip ?? entry.label;
				item.command = { command: entry.command, title: entry.label };
				return item;
			}
		}
	}

	getChildren(entry?: TreeEntry): TreeEntry[] {
		if (!entry) {
			return [
				{ kind: 'section', id: 'status', label: '当前环境' },
				{ kind: 'section', id: 'build', label: '编译与运行' },
				{ kind: 'section', id: 'problems', label: '题目与模板' },
				{ kind: 'section', id: 'coach', label: 'AI 教练与帮助' }
			];
		}
		if (entry.kind !== 'section') {
			return [];
		}
		switch (entry.id) {
			case 'status':
				return this.statusEntries();
			case 'build':
				return [
					{ kind: 'action', id: 'compileAndRun', label: '编译并运行', icon: 'play', command: CMD.compileAndRun, key: KEYS.compileAndRun, tooltip: '按当前评测机参数编译，然后运行程序' },
					{ kind: 'action', id: 'compile', label: '只编译', icon: 'tools', command: CMD.compile, key: KEYS.compile },
					{ kind: 'action', id: 'judge', label: '按评测机编译（-O2）', icon: 'server-process', command: CMD.compileJudgeAccurate, key: KEYS.compileJudgeAccurate, tooltip: '打开优化并套用评测机开关，用来复现「本地过、评测机超时」之外的那类差异' },
					{ kind: 'action', id: 'precheck', label: '提交前体检', icon: 'check', command: CMD.preSubmitCheck, key: KEYS.preSubmitCheck, tooltip: '只报会在评测机上编译失败的写法：`#pragma GCC optimize`、MSVC 保留字、C++17 起删除的设施' },
					{ kind: 'action', id: 'judgeSamples', label: '跑样例（本地评测）', icon: 'checklist', command: CMD.judgeSamples, key: KEYS.judgeSamples, tooltip: `用拉下来的题面样例跑当前文件，按 token 比对，给出 ${VERDICT_CODES}` },
					{ kind: 'action', id: 'stressTest', label: '对拍（正解 vs 暴力）', icon: 'sync-again', command: CMD.stressTest, key: KEYS.stressTest, tooltip: '用生成器产随机数据，同时喂给正解和暴力；输出不一致就停下，并把那组数据存进 stress-fail' },
					{ kind: 'action', id: 'contest', label: '比赛模式（倒计时）', icon: 'clock', command: CMD.contestMode, key: KEYS.contestMode, tooltip: '选一段时长，状态栏出现倒计时；重载窗口也接着走，点 chip 可提前结束' }
				];
			case 'problems':
				return [
					{ kind: 'action', id: 'pull', label: '拉取题面', icon: 'cloud-download', command: CMD.problemPull, key: KEYS.problemPull },
					{ kind: 'action', id: 'pullClipboard', label: '从剪贴板拉取题号', icon: 'clippy', command: CMD.problemPullFromClipboard, key: KEYS.problemPullFromClipboard },
					{ kind: 'action', id: 'openStatement', label: '打开题面库', icon: 'book', command: CMD.problemOpenStatement, key: KEYS.openStatement, tooltip: '缓存过的题面都在这里，按题号或标题搜。' },
					{ kind: 'action', id: 'template', label: '插入赛制模板', icon: 'file-code', command: CMD.templateInsert, key: KEYS.templateInsert }
				];
			case 'coach':
				return [
					{ kind: 'action', id: 'aiSettings', label: 'AI 设置（地址 / 密钥 / 模型）', icon: 'rocket', command: CMD.aiSettings },
					{ kind: 'action', id: 'env', label: '环境自检', icon: 'search', command: CMD.checkEnvironment, key: KEYS.checkEnvironment },
					{ kind: 'action', id: 'website', label: '打开官网与文档', icon: 'globe', command: CMD.openWebsite }
				];
		}
		return [];
	}

	private statusEntries(): TreeEntry[] {
		const target = activeTarget();
		const count = precheckCount();
		const contest = contestSummary();
		return [
			{
				kind: 'state', id: 'compiler', label: '编译器', value: this.compiler.label,
				icon: this.compiler.icon, command: CMD.checkEnvironment,
				tooltip: '点击运行环境自检，查看它来自哪里、和评测机差多少。'
			},
			{
				kind: 'state', id: 'profile', label: '编译配置', value: targetSummary(target),
				icon: 'goal', command: CMD.pickCompileProfile,
				tooltip: `点击切换评测机。当前命令行：\`${renderFlags(target)}\``
			},
			{
				kind: 'state', id: 'precheck', label: '提交前体检', value: count,
				icon: count === '无问题' ? 'check' : 'error', command: CMD.showProblems,
				tooltip: '点击打开「问题」面板查看当前文件的体检结果。'
			},
			{
				kind: 'state', id: 'library', label: '题面库', value: this.library,
				icon: 'book', command: this.library === LIBRARY_EMPTY ? CMD.problemPull : CMD.problemOpenStatement,
				tooltip: this.library === LIBRARY_EMPTY
					? '缓存目录里还没有题面，点击拉一道题的题面。'
					: '点击打开题面库：按题号或标题搜，选中就在编辑器里打开。跑样例用的就是这些题面。'
			},
			// 只在比赛里出现：平时多一行状态是噪音。
			...(contest ? [{
				kind: 'state' as const, id: 'contest', label: '比赛', value: contest,
				icon: isContestRunning() ? 'clock' : 'watch', command: CMD.contestMode,
				tooltip: '点击结束或重新开始比赛模式；倒计时同时常驻状态栏。'
			}] : [])
		];
	}
}

/** What the checker found in the file being edited, as one short string. */
function precheckCount(): string {
	const editor = vscode.window.activeTextEditor;
	if (!editor || !SOURCE_FILES.test(editor.document.fileName)) {
		return '未检查';
	}
	const findings = vscode.languages.getDiagnostics(editor.document.uri)
		.filter(d => d.source === PRECHECK_SOURCE);
	return findings.length === 0 ? '无问题' : `${findings.length} 处编译错误`;
}

export function registerToolsView(context: vscode.ExtensionContext): vscode.Disposable {
	const provider = new OlympiaToolsProvider();
	const view = vscode.window.createTreeView('olympia.tools', { treeDataProvider: provider });

	context.subscriptions.push(
		view,
		vscode.commands.registerCommand('olympia.tools.refresh', () => provider.refresh()),
		// the three lines at the top are the only state the panel shows, so they refresh together
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('olympia.compiler')) {
				provider.refresh();
			}
		}),
		vscode.window.onDidChangeActiveTextEditor(() => provider.refresh()),
		vscode.languages.onDidChangeDiagnostics(() => provider.refresh()),
		// 拉完题面数字就该变，不该等学生切个文件才刷新
		watchStatements(() => void provider.refreshLibrary())
	);
	// 比赛倒计时每秒一跳，只要重画树，不要顺带重新探测编译器
	onContestChange(() => provider.fire());
	return view;
}
