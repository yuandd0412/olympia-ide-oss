/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  样例评测：拿拉下来的题面里的样例数据跑当前文件，给出 AC / WA / RE / TLE / MLE。
 *
 *  「编辑 → 评测 → 对拍」里的那一环。题面由 olympia-contest 抓成 `.olympia/problems/<题号>.md`，
 *  样例就写在里面的 ``` 代码块里，所以这里只读那份 Markdown，不需要联网、也不需要账号。
 *  判定按 token 比对（和评测机一样忽略空白），时限认题面里的「时限：1.00s」或「时限：1000 ms」，本地给三倍余量；
 *  内存认「内存限制：128.00 MB」这类写法，峰值工作集由 memoryProbe 采样，只少报不多报。
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { basename, dirname } from 'path';

import { isCompilable, planCompile, renderCommandLine, COMPILE_TIMEOUT_MS } from './compile';
import { CMD } from './commands';
import { STATEMENT_EXTENSION, stripStatementExtension, statementFiles } from './problemFiles';
import { runProcess } from './stressTest';
import { formatMb, runSampled } from './memoryProbe';
import { recordSolve, titleOf } from './solveLog';

const LOCAL_MARGIN = 3;
const RUN_TIMEOUT_SLACK_MS = 500;
/** 题面没写时限时的默认值，也是本地判 TLE 的上下界，免得一个 1 ms 的时限把编译都算进去。 */
const TIME_LIMIT_MS_DEFAULT = 1000;
const TIME_LIMIT_MS_MIN = 500;
const TIME_LIMIT_MS_MAX = 10000;
/** 内存限制：0 表示「按题面写的判」，题面也没写就只报峰值、不判 MLE。 */
const MEMORY_LIMIT_UNSET = 0;
const MEMORY_UNITS: ReadonlyMap<string, number> = new Map([
	['gb', 1024], ['g', 1024], ['mb', 1], ['m', 1], ['kb', 1 / 1024], ['k', 1 / 1024], ['b', 1 / (1024 * 1024)]
]);

interface Sample {
	/** 题面里写的「样例 N」的 N。 */
	readonly number: number;
	readonly input: string;
	readonly expected: string;
}

type Verdict = 'AC' | 'WA' | 'RE' | 'TLE' | 'MLE';

/**
 * 判定表，按严重程度**从低到高**排：前面的数组下标就是严重程度，总体判定取最严的一档。
 * 顺序沿用老版本 `worse_verdict`（`frontend/src-tauri/src/runner.rs`）的 AC < WA < MLE < TLE < RE，
 * 同一批样例在两边得出的总结论才对得上。文案也从这张表出，加一档只改一行。
 */
const VERDICTS: readonly { readonly code: Verdict; readonly text: string }[] = [
	{ code: 'AC', text: '通过（AC）' },
	{ code: 'WA', text: '答案错误（WA）' },
	{ code: 'MLE', text: '超内存（MLE）' },
	{ code: 'TLE', text: '超时（TLE）' },
	{ code: 'RE', text: '运行出错（RE）' },
];

const severityOf = (verdict: Verdict): number => VERDICTS.findIndex(row => row.code === verdict);
const verdictText = (verdict: Verdict): string => VERDICTS.find(row => row.code === verdict)?.text ?? verdict;

/** 面板、提示文案里那张判定清单从这张表出，别在第二个地方再抄一遍。 */
export const VERDICT_CODES = VERDICTS.map(row => row.code).join(' / ');

interface CaseResult {
	readonly index: number;
	readonly verdict: Verdict;
	readonly got: string;
	readonly detail: string;
	readonly ms: number;
	readonly peakBytes?: number;
}

function normalize(text: string): string {
	return text.split(/\s+/).filter(Boolean).join(' ');
}

/** 一行里写进日志的最长长度：判定输出可能是一整行 10^6 个字符，日志不该被它撑爆。 */
const LOG_LINE_CLIP = 160;

function clip(line: string): string {
	return line.length <= LOG_LINE_CLIP ? line : `${line.slice(0, LOG_LINE_CLIP)}…（共 ${line.length} 字符）`;
}

/**
 * 按行切开比较用的形态：`\r\n` 与 `\n` 同价，末尾那个换行不算空行——
 * 几乎所有题面的期望输出都以换行收尾，把它算成一行会永远报「多/少一行」。
 */
function linesOf(text: string): string[] {
	const rows = text.replace(/\r\n?/g, '\n').split('\n');
	while (rows.length > 0 && rows[rows.length - 1] === '') {
		rows.pop();
	}
	return rows;
}

const NUMERIC = /^-?\d+(\.\d+)?$/;

export interface CaseDiff {
	/** token 序列是否相同（判定就是按这个算 AC 的，相同则不会有 WA）。 */
	readonly sameTokens: boolean;
	/** 第一个内容不同的行，1 起始；0 表示逐行看不出差别。 */
	readonly firstDiffLine: number;
	readonly expectedLines: number;
	readonly gotLines: number;
	readonly expectedLine: string;
	readonly gotLine: string;
	/** 一句中文诊断，永远不为空。 */
	readonly hint: string;
}

/**
 * 「哪一组错了、错在第几行、错成什么样」——把这两个字符串变成学生能直接照着改代码的信息。
 * 老版本 Tauri 的评测面板有逐用例的 期望/实际 对照，这里补上等价物：诊断按
 * 「没输出 → 只少了尾巴 → 多了尾巴 → 顺序不同 → 定位到第一个不同的词」由粗到细排。
 */
export function compareCase(expected: string, got: string): CaseDiff {
	const want = linesOf(expected);
	const have = linesOf(got);
	const sameTokens = normalize(expected) === normalize(got);
	let firstDiffLine = 0;
	for (let i = 0; i < Math.max(want.length, have.length); i++) {
		if ((want[i] ?? '') !== (have[i] ?? '')) {
			firstDiffLine = i + 1;
			break;
		}
	}
	const expectedLine = want[firstDiffLine - 1] ?? '';
	const gotLine = have[firstDiffLine - 1] ?? '';
	return {
		sameTokens,
		firstDiffLine,
		expectedLines: want.length,
		gotLines: have.length,
		expectedLine,
		gotLine,
		hint: hintOf(want, have, firstDiffLine, sameTokens, got, expectedLine, gotLine),
	};
}

function hintOf(want: string[], have: string[], firstDiffLine: number, sameTokens: boolean, got: string, expectedLine: string, gotLine: string): string {
	if (got.trim() === '') {
		return '程序没有任何输出：先确认 main 里真的写了 cout，以及不是在读入之前就退出了。';
	}
	if (sameTokens) {
		return '按空格切出来的内容其实一样，只是换行和空格的位置不同——评测机也按空白分隔比对，所以这组算过。';
	}
	const common = Math.min(want.length, have.length);
	let shared = 0;
	while (shared < common && want[shared] === have[shared]) {
		shared++;
	}
	if (have.length < want.length && shared === have.length) {
		return `只输出了前 ${have.length} 行，第 ${have.length + 1} 行开始没了：常见于循环少跑一次，或者中途 return / break。`;
	}
	if (have.length > want.length && shared === want.length) {
		return `前 ${want.length} 行都对，多了 ${have.length - want.length} 行：常见于把提示语（例如「请输入：」）也输出了。`;
	}
	const wantSet = [...want].sort().join('\n');
	const haveSet = [...have].sort().join('\n');
	if (wantSet === haveSet) {
		return `每一行的内容都在期望里出现过，只是顺序不同（期望 ${want.length} 行、得到 ${have.length} 行）。`;
	}
	if (firstDiffLine === 0) {
		return `行数是期望 ${want.length} 行、得到 ${have.length} 行，但逐行看没有哪一行不同。`;
	}
	if (gotLine === '') {
		return `第 ${firstDiffLine} 行没有输出，期望这一行是「${clip(expectedLine)}」。`;
	}
	if (expectedLine === '') {
		return `第 ${firstDiffLine} 行多输出了「${clip(gotLine)}」。`;
	}
	const wantWords = expectedLine.split(/\s+/).filter(Boolean);
	const haveWords = gotLine.split(/\s+/).filter(Boolean);
	if (wantWords.length !== haveWords.length) {
		return `第 ${firstDiffLine} 行的词数不同：期望 ${wantWords.length} 个，得到 ${haveWords.length} 个。`;
	}
	const at = wantWords.findIndex((word, i) => word !== haveWords[i]);
	const where = at < 0 ? wantWords.length : at + 1;
	if (at >= 0 && NUMERIC.test(wantWords[at]) && NUMERIC.test(haveWords[at])) {
		return `第 ${firstDiffLine} 行第 ${where} 个数不同：期望 ${wantWords[at]}，得到 ${haveWords[at]}。`;
	}
	return `第 ${firstDiffLine} 行第 ${where} 个词不同：期望「${clip(at >= 0 ? wantWords[at] : '')}」，得到「${clip(at >= 0 ? haveWords[at] : '')}」。`;
}

/**
 * 期望 ↔ 得到的整份对照走 VS Code 自带的并排差异编辑器：`vscode.diff` 收两个文档 URI，
 * 而这两个文档的内容由一个内存 content provider 供出去。这样不用往学生的工作区
 * 写临时文件（机房那台机器上多半也没权限），也不用自己画 diff。
 */
const DIFF_SCHEME = 'olympiaSample';
const diffTexts = new Map<string, string>();

function diffUri(name: string): vscode.Uri {
	return vscode.Uri.from({ scheme: DIFF_SCHEME, path: `/${name}` });
}

function putDiffText(name: string, text: string): vscode.Uri {
	diffTexts.set(name, text);
	return diffUri(name);
}

function ensureTrailingNewline(text: string): string {
	return text.endsWith('\n') ? text : `${text}\n`;
}

/** 最近一次跑样例里判 WA 的那些组：命令面板和通知按钮都用它。 */
interface FailedCase {
	readonly number: number;
	readonly expected: string;
	readonly got: string;
	readonly diff: CaseDiff;
}

let failedCases: FailedCase[] = [];
let failedStatement = '';

async function openCaseDiff(item: FailedCase): Promise<void> {
	const left = putDiffText(`sample-${item.number}-expected.txt`, ensureTrailingNewline(item.expected));
	const right = putDiffText(`sample-${item.number}-got.txt`, ensureTrailingNewline(item.got));
	await vscode.commands.executeCommand('vscode.diff', left, right, `样例 ${item.number}：期望 ↔ 得到 · ${failedStatement}`);
}

/** 「问教练」往输入框里贴的期望/实际最多这么多行：再多也读不完，还会把输入框撑满。 */
const COACH_SAMPLE_LINES = 12;

function clipForCoach(text: string): string {
	const lines = text.replace(/\r\n/g, '\n').split('\n');
	return lines.length > COACH_SAMPLE_LINES
		? `${lines.slice(0, COACH_SAMPLE_LINES).join('\n')}\n…（还有 ${lines.length - COACH_SAMPLE_LINES} 行）`
		: text.trimEnd();
}

/**
 * 把判题结果原样带进聊天框，学生不用手抄第二遍。`isPartialQuery` 是关键：
 * 文字落在输入框里而不是直接发出去，他得先确认模型选没选上（没配密钥时发出去只会得到报错）。
 */
async function askCoach(problem: string, title: string, overall: Verdict, passed: number, total: number): Promise<void> {
	const cases = failedCases.slice(0, 2).map(item => [
		`样例 ${item.number}：${item.diff.hint}`,
		`期望：\n${clipForCoach(item.expected)}`,
		`我的输出：\n${clipForCoach(item.got)}`
	].join('\n'));
	await vscode.commands.executeCommand('workbench.action.chat.open', {
		mode: 'ask',
		query: [
			`@coach ${problem}${title ? `「${title}」` : ''} 判成 ${verdictText(overall)}，${passed}/${total} 组通过。`,
			...cases,
			'我错在哪？'
		].join('\n\n'),
		isPartialQuery: true
	});
}

/** 「对比期望输出」：一组失败就直接开，多组先让人挑（默认第一个就是最先出错的那组）。 */
async function compareLastRun(): Promise<boolean> {
	if (!failedCases.length) {
		await vscode.window.showInformationMessage('最近这一次跑样例没有 WA 的组：要么全过，要么还没跑过。按 Ctrl+Alt+J 先跑一次。');
		return false;
	}
	if (failedCases.length === 1) {
		await openCaseDiff(failedCases[0]);
		return true;
	}
	const picked = await vscode.window.showQuickPick(
		failedCases.map(item => ({
			label: `样例 ${item.number}`,
			description: item.diff.hint,
			detail: `期望 ${item.diff.expectedLines} 行 · 得到 ${item.diff.gotLines} 行`,
			item
		})),
		{ title: `哪一组样例的期望 ↔ 实际（${failedStatement}）`, placeHolder: '第一组就是最先出错的那组', ignoreFocusOut: true }
	);
	if (!picked) {
		return false;
	}
	await openCaseDiff(picked.item);
	return true;
}

/** 从题面 Markdown 里把「### 样例 N」下面的输入 / 输出代码块读出来。 */
export function parseSamples(markdown: string): { samples: Sample[]; timeLimitMs: number; memoryLimitMb: number } {
	const samples: Sample[] = [];
	const blocks = markdown.matchAll(/###\s*样例\s*(\d+)([\s\S]*?)(?=\n###\s*样例|\n##\s|$)/g);
	for (const block of blocks) {
		const parts = [...(block[2] ?? '').matchAll(/\*\*(输入|输出)\*\*\s*\r?\n\s*```[^\n]*\r?\n([\s\S]*?)```/g)];
		const input = parts.find(part => part[1] === '输入')?.[2];
		const expected = parts.find(part => part[1] === '输出')?.[2];
		if (input !== undefined || expected !== undefined) {
			// 题号要带着走：跳过没填完的样例之后，位置就不等于编号了。
			// 题面真写了「样例 0」时就得是 0，不能用 `||` 把它顺成了 1。
			const declared = Number(block[1]);
			samples.push({ number: Number.isFinite(declared) ? declared : samples.length + 1, input: input ?? '', expected: expected ?? '' });
		}
	}
	const limit = /时限：\s*([\d.]+)\s*(ms|毫秒|s|秒)/i.exec(markdown);
	// 题面里可能写「内存：128 MB」，也可能写「内存限制：128.00 MB」，两种都要认。
	const memory = /内存(?:限制)?：\s*([\d.]+)\s*(GB|G|MB|M|KB|K|B)?/i.exec(markdown);
	return { samples, timeLimitMs: timeLimitMsOf(limit), memoryLimitMb: memoryLimitMbOf(memory) };
}

/**
 * 单位必须认出来：拉题面那条链写的是「时限：1000 ms」，手写题面习惯「时限：1.00s」，
 * 只认秒会把 2000 ms 的题读成默认的 1 s，正解反而被判 TLE。认不出单位就用默认值，不猜。
 */
function timeLimitMsOf(match: RegExpExecArray | null): number {
	if (!match) {
		return TIME_LIMIT_MS_DEFAULT;
	}
	const value = Number(match[1]);
	if (!Number.isFinite(value) || value <= 0) {
		return TIME_LIMIT_MS_DEFAULT;
	}
	const ms = match[2].toLowerCase() === 'ms' || match[2] === '毫秒' ? value : value * 1000;
	return Math.min(Math.max(Math.round(ms), TIME_LIMIT_MS_MIN), TIME_LIMIT_MS_MAX);
}

/**
 * 内存限制认「内存：128 MB」「内存：256.00MB」这一类写法；认不出来就返回 0，
 * 表示「不判 MLE」。宁可少判一个 MLE，也不能凭空判学生超内存。
 */
function memoryLimitMbOf(match: RegExpExecArray | null): number {
	if (!match) {
		return MEMORY_LIMIT_UNSET;
	}
	const value = Number(match[1]);
	if (!Number.isFinite(value) || value <= 0) {
		return MEMORY_LIMIT_UNSET;
	}
	const unit = (match[2] ?? 'mb').toLowerCase();
	return Math.round(value * (MEMORY_UNITS.get(unit) ?? 1));
}

/**
 * 源文件名 → 上次为它选的题面。按工作区存，跟着工程走。
 * 两边都不能写绝对路径：机房那台机器上工程可能挂在 E: 而不是 D:，
 * 存了盘符就等于换台机器全部重问一遍。题面本身是扁平的 `<题号>.md`，
 * 所以记文件名就够定位了。
 */
const STATEMENT_PICK_KEY = 'olympia.judge.statements';

function statementKey(sourceUri: vscode.Uri): string {
	return vscode.workspace.asRelativePath(sourceUri, false).toLowerCase();
}

function rememberedStatement(context: vscode.ExtensionContext, files: readonly vscode.Uri[], sourceUri: vscode.Uri): vscode.Uri | undefined {
	const map = context.workspaceState.get<Record<string, string>>(STATEMENT_PICK_KEY);
	const name = map?.[statementKey(sourceUri)];
	if (!name) {
		return undefined;
	}
	// 只在这份文件确实还在缓存里时才算记住：被删了或被改名了都要回到选择列表。
	return files.find(file => basename(file.fsPath).toLowerCase() === name.toLowerCase());
}

async function rememberStatement(context: vscode.ExtensionContext, sourceUri: vscode.Uri, statement: vscode.Uri | undefined): Promise<void> {
	const map = { ...context.workspaceState.get<Record<string, string>>(STATEMENT_PICK_KEY) };
	if (statement) {
		map[statementKey(sourceUri)] = basename(statement.fsPath);
	} else {
		delete map[statementKey(sourceUri)];
	}
	await context.workspaceState.update(STATEMENT_PICK_KEY, map);
}

/** 题面是怎么定下来的：日志要把「沿用了上次的选择」这件事说出来，不然学生会以为同名自动匹配上了。 */
type StatementChoice = { uri: vscode.Uri; how: 'exact' | 'remembered' | 'picked' };

async function pickProblemFile(context: vscode.ExtensionContext, sourceUri: vscode.Uri, repick: boolean): Promise<StatementChoice | undefined> {
	const files = await statementFiles();
	if (!files.length) {
		await vscode.window.showInformationMessage('还没有拉取过题面，无法跑样例。先用「拉取题面」（Ctrl+Alt+P）抓一道题的样例。');
		return undefined;
	}
	const stem = basename(sourceUri.fsPath).replace(/\.[^.]+$/, '').toLowerCase();
	const exact = files.find(uri => basename(uri.fsPath).toLowerCase() === `${stem}${STATEMENT_EXTENSION}`);
	if (exact) {
		return { uri: exact, how: 'exact' };
	}
	// 改代码 → 跑样例 → 改代码 是最常见的循环：同一份文件选过的题面要记住，
	// 不然每按一次 Ctrl+Alt+J 都要重新挑一遍那道题。
	if (!repick) {
		const remembered = rememberedStatement(context, files, sourceUri);
		if (remembered) {
			return { uri: remembered, how: 'remembered' };
		}
	}
	const picked = await vscode.window.showQuickPick(
		files.map(uri => ({ label: stripStatementExtension(basename(uri.fsPath)), description: vscode.workspace.asRelativePath(uri, false), uri })),
		{ title: '用哪道题的样例来测', placeHolder: `当前文件 ${basename(sourceUri.fsPath)} 没有同名题面，手动选一道`, ignoreFocusOut: true }
	);
	if (!picked) {
		return undefined;
	}
	await rememberStatement(context, sourceUri, picked.uri);
	return { uri: picked.uri, how: 'picked' };
}

let channel: vscode.OutputChannel | undefined;

function output(): vscode.OutputChannel {
	if (!channel) {
		channel = vscode.window.createOutputChannel('Olympia 评测');
	}
	return channel;
}

/** 总体判定 = 最严的那一档；顺序见 `VERDICTS`。 */
export function verdictOf(results: readonly CaseResult[]): Verdict {
	return results.reduce<Verdict>((worst, r) => severityOf(r.verdict) > severityOf(worst) ? r.verdict : worst, 'AC');
}

/** 解题记录用「最慢那组」当耗时、「整场最高」当峰值内存：这两项才是评测机在乎的。 */
function worstOf(results: readonly CaseResult[]): { ms: number; peakBytes?: number } {
	const peakBytes = results.reduce<number | undefined>(
		(best, r) => r.peakBytes !== undefined && (best === undefined || r.peakBytes > best) ? r.peakBytes : best,
		undefined
	);
	return { ms: Math.max(0, ...results.map(r => r.ms)), peakBytes };
}

/** 换一道题来测：清掉这份文件记住的选择，再重新问一次。 */
async function repick(context: vscode.ExtensionContext, source: vscode.Uri): Promise<void> {
	await rememberStatement(context, source, undefined);
	await vscode.commands.executeCommand(CMD.judgeSamples, { repick: true });
}

export function registerSampleJudge(context: vscode.ExtensionContext): vscode.Disposable {
	const command = vscode.commands.registerCommand(CMD.judgeSamples, async (args?: { repick?: boolean }) => {
		const editor = vscode.window.activeTextEditor;
		const source = editor?.document.uri;
		if (!isCompilable(source)) {
			await vscode.window.showWarningMessage('样例评测：请先打开一个 C/C++ 源文件。');
			return;
		}
		const choice = await pickProblemFile(context, source, !!args?.repick);
		if (!choice) {
			return;
		}
		const statement = choice.uri;

		const markdown = Buffer.from(await vscode.workspace.fs.readFile(statement)).toString('utf8');
		const { samples: all, timeLimitMs, memoryLimitMb } = parseSamples(markdown);
		if (!all.length) {
			const action = await vscode.window.showWarningMessage(`「${basename(statement.fsPath)}」里没有解析到样例数据，可能这道题的题面没抓到样例。`, '换一道题');
			if (action === '换一道题') {
				await repick(context, source);
			}
			return;
		}
		// 自己加的样例可能还没填完期望输出：那组没法判，跳过并说清楚，别报成一个 WA
		const samples = all.filter(sample => normalize(sample.expected) !== '');
		if (!samples.length) {
			await vscode.window.showWarningMessage(`「${basename(statement.fsPath)}」里 ${all.length} 组样例都没填期望输出，跑样例没法判。把答案写进题面的 **输出** 代码块再试。`);
			return;
		}
		// 设置里的数字优先；两边都没写就不判 MLE，只报峰值。
		const configuredMb = vscode.workspace.getConfiguration('olympia.judge').get<number>('memoryLimitMb', MEMORY_LIMIT_UNSET);
		const limitMb = configuredMb > 0 ? configuredMb : memoryLimitMb;

		const plan = planCompile(source);
		const log = output();
		log.clear();
		// 「对比期望输出」是命令面板里的常驻入口，它只能看到上一次跑的结果：每次开跑先清空，
		// 免得换了题目之后还把上一道题的 WA 组端出来。
		failedCases = [];
		failedStatement = basename(statement.fsPath);
		log.show(true);
		log.appendLine(`题面：${vscode.workspace.asRelativePath(statement, false)} · 样例 ${samples.length} 组 · 时限 ${timeLimitMs} ms（本地按 ${LOCAL_MARGIN} 倍余量）`);
		if (choice.how === 'remembered') {
			log.appendLine(`这份题面是上次为 ${basename(source.fsPath)} 选的，所以这次没再问；要换一道题，点结果通知里的「换一道题」。`);
		}
		log.appendLine(`内存：${limitMb > 0 ? `限制 ${limitMb} MB（按峰值工作集判，采样只会少报）` : '题面没写内存限制，只报峰值不判 MLE'}`);
		if (samples.length !== all.length) {
			log.appendLine(`题面里另有 ${all.length - samples.length} 组没填期望输出，这次跳过：${all.filter(s => normalize(s.expected) === '').map(s => `样例 ${s.number}`).join('、')}`);
		}
		log.appendLine(`编译：${renderCommandLine(plan)}`);

		const built = await runProcess(plan.program, plan.args, plan.cwd, '', COMPILE_TIMEOUT_MS);
		if (built.failed || built.timedOut) {
			log.appendLine('--- 编译失败 ---');
			log.appendLine(`${built.stdout}${built.stderr}`);
			await vscode.window.showErrorMessage('编译没过，先看「Olympia 评测」面板里的编译器输出。');
			return;
		}

		// 时限已经被 TIME_LIMIT_MS_MAX 夹住了，这里不用再拿编译预算当上限——那是另一回事。
		const budget = timeLimitMs * LOCAL_MARGIN + RUN_TIMEOUT_SLACK_MS;
		const results: CaseResult[] = [];
		await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: 'Olympia 正在跑样例', cancellable: false },
			async (progress) => {
				for (let i = 0; i < samples.length; i++) {
					const sample = samples[i];
					progress.report({ message: `样例 ${sample.number}（本次第 ${i + 1}/${samples.length} 组）`, increment: 100 / samples.length });
					const started = Date.now();
					const ran = await runSampled(plan.output, [], dirname(plan.output), sample.input, budget);
					const ms = Date.now() - started;
					const overMemory = limitMb > MEMORY_LIMIT_UNSET
						&& ran.peakBytes !== undefined
						&& ran.peakBytes > limitMb * 1024 * 1024;
					const diff = compareCase(sample.expected, ran.stdout);
					const verdict: Verdict = ran.timedOut ? 'TLE' : overMemory ? 'MLE' : ran.failed ? 'RE'
						: diff.sameTokens ? 'AC' : 'WA';
					results.push({ index: sample.number, verdict, got: ran.stdout, detail: ran.stderr, ms, peakBytes: ran.peakBytes });
					const peak = ran.peakBytes === undefined ? '' : ` · 峰值内存 ${formatMb(ran.peakBytes)}`;
					log.appendLine(`样例 ${sample.number}：${verdict} · ${ms} ms${peak}`);
					if (verdict === 'WA') {
						// 判定和诊断共用同一次比较：分成两处写过一次「按 token 比」一次「按行比」，
						// 就会出现「通知说 AC、对照里全是差异」这种自相矛盾的结果。
						failedCases.push({ number: sample.number, expected: sample.expected, got: ran.stdout, diff });
						log.appendLine(`  ${diff.hint}`);
						if (diff.firstDiffLine > 0 && !diff.sameTokens) {
							log.appendLine(`  第 ${diff.firstDiffLine} 行 · 期望：${clip(diff.expectedLine)}`);
							log.appendLine(`  第 ${diff.firstDiffLine} 行 · 得到：${clip(diff.gotLine)}`);
						}
						log.appendLine(`  整份对照：期望 ${diff.expectedLines} 行、得到 ${diff.gotLines} 行 —— 通知里点「对比期望输出」（Ctrl+Alt+K）并排看。`);
					}
					if (verdict === 'MLE') {
						log.appendLine(`  峰值 ${formatMb(ran.peakBytes ?? 0)}，限制 ${limitMb} MB`);
					}
					if (verdict === 'RE' || verdict === 'TLE') {
						log.appendLine(`  ${ran.stderr.trim() || '（无 stderr）'}`);
					}
				}
			}
		);

		const overall = verdictOf(results);
		const passed = results.filter(r => r.verdict === 'AC').length;
		log.appendLine(`--- ${overall} · ${passed}/${results.length} 组通过 ---`);
		if (overall === 'AC') {
			await recordSolve({
				problem: stripStatementExtension(basename(statement.fsPath)),
				title: titleOf(markdown),
				at: new Date().toISOString(),
				...worstOf(results)
			});
		}
		const message = `样例判定 ${verdictText(overall)}：通过 ${passed}/${results.length} 组。`;
		// 自动同名匹配上的题面没有「换一道题」这一说；用记住的或手动选的必须留一个出口，
		// 不然选错一次就再也改不过来。
		const actions = [
			...(failedCases.length ? ['对比期望输出'] : []),
			...(overall === 'AC' ? [] : ['问教练']),
			...(overall === 'AC' ? [] : ['查看输出']),
			'继续对拍',
			...(choice.how === 'exact' ? [] : ['换一道题'])
		];
		const action = overall === 'AC'
			? await vscode.window.showInformationMessage(message, ...actions)
			: await vscode.window.showErrorMessage(message, ...actions);
		if (action === '对比期望输出') {
			await compareLastRun();
		} else if (action === '问教练') {
			await askCoach(
				stripStatementExtension(basename(statement.fsPath)),
				titleOf(markdown),
				overall,
				passed,
				results.length
			);
		} else if (action === '继续对拍') {
			await vscode.commands.executeCommand(CMD.stressTest);
		} else if (action === '查看输出') {
			log.show(true);
		} else if (action === '换一道题') {
			await repick(context, source);
		}
	});

	const compare = vscode.commands.registerCommand(CMD.judgeCompare, compareLastRun);
	const provider = vscode.workspace.registerTextDocumentContentProvider(DIFF_SCHEME, {
		provideTextDocumentContent: uri => diffTexts.get(uri.path.replace(/^\//, '')) ?? ''
	});

	context.subscriptions.push(command, compare, provider);
	return command;
}
