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
import { checkLevel, isChecked, onSourceEdited, STRUCTURE_LABEL_PANEL } from './precheckState';
import { PRACTICE_PATH_LABEL, statementFiles, watchStatements, TEMPLATE_PATH_LABEL } from './problemFiles';
import { contestSummary, isContestRunning, onContestChange } from './contestMode';
import { onSolveLogChange, readSolves, solveSummary, SOLVES_PATH_LABEL } from './solveLog';
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
	private solves = LIBRARY_UNKNOWN;

	constructor() {
		void this.refreshCompiler();
		void this.refreshLibrary();
		void this.refreshSolves();
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

	/** 解题记录：一次读文件，数字与连续天数都在 solveLog 里算。 */
	async refreshSolves(): Promise<void> {
		this.solves = solveSummary(await readSolves());
		this.fire();
	}

	/** 只重画树，不重新探测编译器：倒计时每秒刷新走这条，别顺带 spawn g++。 */
	fire(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	refresh(): void {
		void this.refreshCompiler();
		void this.refreshLibrary();
		void this.refreshSolves();
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
					{ kind: 'action', id: 'compile', label: '编译当前文件', icon: 'tools', command: CMD.compile, key: KEYS.compile, tooltip: '按当前档位编译，不运行；命令行的完整参数会写进输出面板' },
					{ kind: 'action', id: 'judge', label: '按评测机编译（-O2）', icon: 'server-process', command: CMD.compileJudgeAccurate, key: KEYS.compileJudgeAccurate, tooltip: '打开优化并套用评测机开关，用来复现「本地过、评测机超时」之外的那类差异' },
					{ kind: 'action', id: 'precheck', label: '提交前体检', icon: 'check', command: CMD.preSubmitCheck, key: KEYS.preSubmitCheck, tooltip: '先用评测机那套开关把这份代码编一遍（只查语法，不出可执行文件），再查只会在评测机上编译失败的写法：`#pragma GCC optimize`、MSVC 保留字、C++17 起删除的设施' },
					{ kind: 'action', id: 'judgeSamples', label: '跑样例（本地评测）', icon: 'checklist', command: CMD.judgeSamples, key: KEYS.judgeSamples, tooltip: `用拉下来的题面样例跑当前文件，按 token 比对，给出 ${VERDICT_CODES}` },
					{ kind: 'action', id: 'judgeCompare', label: '对比期望输出', icon: 'diff', command: CMD.judgeCompare, key: KEYS.compareOutput, tooltip: '把最近一次跑样例里判 WA 的那一组并排打开：左边是题面写的期望，右边是程序打出来的，日志里还会说错在第几行第几个数' },
					{ kind: 'action', id: 'stressTest', label: '对拍（正解 vs 暴力）', icon: 'sync-again', command: CMD.stressTest, key: KEYS.stressTest, tooltip: '用生成器产随机数据，同时喂给正解和暴力；输出不一致就停下，并把那组数据存进 stress-fail' },
					{ kind: 'action', id: 'contest', label: '比赛模式（倒计时）', icon: 'clock', command: CMD.contestMode, key: KEYS.contestMode, tooltip: '选一段时长，状态栏出现倒计时；重载窗口也接着走，点 chip 可提前结束' }
				];
			case 'problems':
				return [
					{ kind: 'action', id: 'pull', label: '拉取题面', icon: 'cloud-download', command: CMD.problemPull, key: KEYS.problemPull },
					{ kind: 'action', id: 'pullClipboard', label: '从剪贴板拉取题号', icon: 'clippy', command: CMD.problemPullFromClipboard, key: KEYS.problemPullFromClipboard },
					{ kind: 'action', id: 'openStatement', label: '打开题面库', icon: 'book', command: CMD.problemOpenStatement, key: KEYS.openStatement, tooltip: '缓存过的题面都在这里，按题号或标题搜；跑样例 AC 过的题带个勾，敲 AC 只看做出来的。' },
					{ kind: 'action', id: 'openSource', label: '打开原题网页', icon: 'link-external', command: CMD.openSourceProblem, key: KEYS.openSource, tooltip: '当前这道题的原题页面：交题、看数据范围、看别人提交的题解都在这里。链接就写在题面里，不用再去浏览器里翻。' },
					{ kind: 'action', id: 'addSample', label: '给这道题加一组自定义样例', icon: 'add', command: CMD.appendSample, tooltip: '在题面的样例区末尾加一组空的占位样例，填完再跑样例。自己加的样例和题面存在一起，跟着工程走。' },
					{ kind: 'action', id: 'practice', label: '集训清单', icon: 'list-unordered', command: CMD.practiceOpen, key: KEYS.practice, tooltip: `一份起了名字的题目单 + 时长：选中它就能「开始这一场」，计时直接从清单的分钟数来；加题、移题、改时长就在这份菜单里改，不用重建一份新的。逐题点一下就是打开题面（没拉过的先去拉），做过的题带 ✓。清单存在工程的 ${PRACTICE_PATH_LABEL} 里，跟着文件夹走到机房。` },
					{ kind: 'action', id: 'template', label: '插入赛制模板', icon: 'file-code', command: CMD.templateInsert, key: KEYS.templateInsert },
					{ kind: 'action', id: 'templateEdit', label: '编辑我的模板', icon: 'edit', command: CMD.templateEdit, tooltip: `模板存在工程的 ${TEMPLATE_PATH_LABEL} 里，改完保存就算数：插模板（Ctrl+Alt+T）和拉题面新建的文件都先用你自己这一份。` }
				];
			case 'coach':
				return [
					{ kind: 'action', id: 'aiSettings', label: 'AI 设置（地址 / 密钥 / 模型）', icon: 'rocket', command: CMD.aiSettings },
					{ kind: 'action', id: 'settings', label: '全部设置（编译 / 评测 / 对拍 / 题面）', icon: 'gear', command: CMD.settings, key: KEYS.settings, tooltip: '一屏改完 Olympia 的所有开关，说明就写在每一项下面；改的是 settings.json 里同样的键。' },
					{ kind: 'action', id: 'env', label: '环境自检', icon: 'search', command: CMD.checkEnvironment, key: KEYS.checkEnvironment },
					{ kind: 'action', id: 'website', label: '打开官网与文档', icon: 'globe', command: CMD.openWebsite },
					{ kind: 'action', id: 'licences', label: '许可证与第三方组件', icon: 'law', command: CMD.openLicences, tooltip: '离线可读：Olympia 自己的许可、VS Code / Electron 的 MIT 文本、第三方组件声明，以及内置 MinGW 工具链那份 GPL 的书面来源说明。' }
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
				icon: count === '无问题' || count === STRUCTURE_LABEL_PANEL ? 'check' : 'error', command: CMD.showProblems,
				tooltip: '点击打开「问题」面板查看当前文件的体检结果。'
			},
			{
				kind: 'state', id: 'library', label: '题面库', value: this.library,
				icon: 'book', command: this.library === LIBRARY_EMPTY ? CMD.problemPull : CMD.problemOpenStatement,
				tooltip: this.library === LIBRARY_EMPTY
					? '缓存目录里还没有题面，点击拉一道题的题面。'
					: '点击打开题面库：按题号或标题搜，选中就在编辑器里打开。跑样例用的就是这些题面。'
			},
			{
				kind: 'state', id: 'solves', label: '解题记录', value: this.solves,
				icon: 'checklist', command: CMD.solveLog,
				tooltip: `跑样例判成 AC 就记一条（耗时、峰值内存），存进工程的 ${SOLVES_PATH_LABEL}，跟着文件夹走。点击看最近记录与连续打卡。`
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
	// 空数组有两种来路：查过且没问题，和根本没查过。只有前者能写「无问题」。
	if (!isChecked(editor.document)) {
		return '未检查';
	}
	// 部件级那一跑没启动编译器：它说没报错只等于结构没断，写不成「无问题」。
	if (checkLevel(editor.document) === 'structure') {
		return findings.length === 0 ? STRUCTURE_LABEL_PANEL : `${findings.length} 处结构错误`;
	}
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
		// 改完字，上一份结论就不属于这一版代码了；面板不重画会继续写「无问题」
		onSourceEdited(() => provider.refresh()),
		// 拉完题面数字就该变，不该等学生切个文件才刷新
		watchStatements(() => void provider.refreshLibrary()),
		onSolveLogChange(() => void provider.refreshSolves())
	);
	// 比赛倒计时每秒一跳，只要重画树，不要顺带重新探测编译器
	onContestChange(() => provider.fire());
	return view;
}
