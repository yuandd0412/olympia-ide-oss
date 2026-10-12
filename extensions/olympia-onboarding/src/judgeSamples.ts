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
import { statementFiles } from './problemFiles';
import { runProcess } from './stressTest';
import { formatMb, runSampled } from './memoryProbe';

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

/** 从题面 Markdown 里把「### 样例 N」下面的输入 / 输出代码块读出来。 */
export function parseSamples(markdown: string): { samples: Sample[]; timeLimitMs: number; memoryLimitMb: number } {
	const samples: Sample[] = [];
	const blocks = markdown.matchAll(/###\s*样例\s*(\d+)([\s\S]*?)(?=\n###\s*样例|\n##\s|$)/g);
	for (const block of blocks) {
		const parts = [...(block[2] ?? '').matchAll(/\*\*(输入|输出)\*\*\s*\r?\n\s*```[^\n]*\r?\n([\s\S]*?)```/g)];
		const input = parts.find(part => part[1] === '输入')?.[2];
		const expected = parts.find(part => part[1] === '输出')?.[2];
		if (input !== undefined || expected !== undefined) {
			// 题号要带着走：跳过没填完的样例之后，位置就不等于编号了
			samples.push({ number: Number(block[1]) || samples.length + 1, input: input ?? '', expected: expected ?? '' });
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

async function pickProblemFile(sourceUri: vscode.Uri): Promise<vscode.Uri | undefined> {
	const files = await statementFiles();
	if (!files.length) {
		await vscode.window.showInformationMessage('还没有拉取过题面，无法跑样例。先用「拉取题面」（Ctrl+Alt+P）抓一道题的样例。');
		return undefined;
	}
	const stem = basename(sourceUri.fsPath).replace(/\.[^.]+$/, '').toLowerCase();
	const exact = files.find(uri => basename(uri.fsPath).toLowerCase() === `${stem}.md`);
	if (exact) {
		return exact;
	}
	const picked = await vscode.window.showQuickPick(
		files.map(uri => ({ label: basename(uri.fsPath).replace(/\.md$/i, ''), description: vscode.workspace.asRelativePath(uri, false), uri })),
		{ title: '用哪道题的样例来测', placeHolder: `当前文件 ${basename(sourceUri.fsPath)} 没有同名题面，手动选一道`, ignoreFocusOut: true }
	);
	return picked?.uri;
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

export function registerSampleJudge(context: vscode.ExtensionContext): vscode.Disposable {
	const command = vscode.commands.registerCommand(CMD.judgeSamples, async () => {
		const editor = vscode.window.activeTextEditor;
		const source = editor?.document.uri;
		if (!isCompilable(source)) {
			await vscode.window.showWarningMessage('样例评测：请先打开一个 C/C++ 源文件。');
			return;
		}
		const statement = await pickProblemFile(source);
		if (!statement) {
			return;
		}

		const markdown = Buffer.from(await vscode.workspace.fs.readFile(statement)).toString('utf8');
		const { samples: all, timeLimitMs, memoryLimitMb } = parseSamples(markdown);
		if (!all.length) {
			await vscode.window.showWarningMessage(`「${basename(statement.fsPath)}」里没有解析到样例数据，可能这道题的题面没抓到样例。`);
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
		log.show(true);
		log.appendLine(`题面：${vscode.workspace.asRelativePath(statement, false)} · 样例 ${samples.length} 组 · 时限 ${timeLimitMs} ms（本地按 ${LOCAL_MARGIN} 倍余量）`);
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

		const budget = Math.min(COMPILE_TIMEOUT_MS, timeLimitMs * LOCAL_MARGIN + RUN_TIMEOUT_SLACK_MS);
		const results: CaseResult[] = [];
		await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: 'Olympia 正在跑样例', cancellable: false },
			async (progress) => {
				for (let i = 0; i < samples.length; i++) {
					const sample = samples[i];
					progress.report({ message: `样例 ${sample.number} / ${all.length}`, increment: 100 / samples.length });
					const started = Date.now();
					const ran = await runSampled(plan.output, [], dirname(plan.output), sample.input, budget);
					const ms = Date.now() - started;
					const overMemory = limitMb > MEMORY_LIMIT_UNSET
						&& ran.peakBytes !== undefined
						&& ran.peakBytes > limitMb * 1024 * 1024;
					const verdict: Verdict = ran.timedOut ? 'TLE' : overMemory ? 'MLE' : ran.failed ? 'RE'
						: normalize(ran.stdout) === normalize(sample.expected) ? 'AC' : 'WA';
					results.push({ index: sample.number, verdict, got: ran.stdout, detail: ran.stderr, ms, peakBytes: ran.peakBytes });
					const peak = ran.peakBytes === undefined ? '' : ` · 峰值内存 ${formatMb(ran.peakBytes)}`;
					log.appendLine(`样例 ${sample.number}：${verdict} · ${ms} ms${peak}`);
					if (verdict === 'WA') {
						log.appendLine(`  期望：${normalize(sample.expected).slice(0, 200)}`);
						log.appendLine(`  得到：${normalize(ran.stdout).slice(0, 200)}`);
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
		const message = `样例判定 ${verdictText(overall)}：通过 ${passed}/${results.length} 组。`;
		const action = overall === 'AC'
			? await vscode.window.showInformationMessage(message, '继续对拍')
			: await vscode.window.showErrorMessage(message, '查看输出', '继续对拍');
		if (action === '继续对拍') {
			await vscode.commands.executeCommand(CMD.stressTest);
		} else if (action === '查看输出') {
			log.show(true);
		}
	});

	context.subscriptions.push(command);
	return command;
}
