/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  样例评测：拿拉下来的题面里的样例数据跑当前文件，给出 AC / WA / RE / TLE。
 *
 *  「编辑 → 评测 → 对拍」里的那一环。题面由 olympia-contest 抓成 `.olympia/problems/<题号>.md`，
 *  样例就写在里面的 ``` 代码块里，所以这里只读那份 Markdown，不需要联网、也不需要账号。
 *  判定按 token 比对（和评测机一样忽略空白），时限读题面里的「时限：1.00s」，本地给三倍余量。
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { basename, dirname } from 'path';

import { planCompile, renderCommandLine } from './compile';
import { CMD } from './commands';
import { runProcess } from './stressTest';

const DEFAULT_PROBLEMS_DIR = '.olympia/problems';
const COMPILE_BUDGET_MS = 120000;
const LOCAL_MARGIN = 3;

interface Sample {
	readonly input: string;
	readonly expected: string;
}

type Verdict = 'AC' | 'WA' | 'RE' | 'TLE';

interface CaseResult {
	readonly index: number;
	readonly verdict: Verdict;
	readonly got: string;
	readonly detail: string;
	readonly ms: number;
}

function normalize(text: string): string {
	return text.split(/\s+/).filter(Boolean).join(' ');
}

/** 从题面 Markdown 里把「### 样例 N」下面的输入 / 输出代码块读出来。 */
export function parseSamples(markdown: string): { samples: Sample[]; timeLimitMs: number } {
	const samples: Sample[] = [];
	const blocks = markdown.matchAll(/###\s*样例\s*\d+([\s\S]*?)(?=\n###\s*样例|\n##\s|$)/g);
	for (const block of blocks) {
		const parts = [...(block[1] ?? '').matchAll(/\*\*(输入|输出)\*\*\s*\r?\n\s*```[^\n]*\r?\n([\s\S]*?)```/g)];
		const input = parts.find(part => part[1] === '输入')?.[2];
		const expected = parts.find(part => part[1] === '输出')?.[2];
		if (input !== undefined || expected !== undefined) {
			samples.push({ input: input ?? '', expected: expected ?? '' });
		}
	}
	const limit = /时限：\s*([\d.]+)\s*s/i.exec(markdown);
	const parsed = limit ? Math.round(Number(limit[1]) * 1000) : 1000;
	return { samples, timeLimitMs: Math.min(Math.max(parsed || 1000, 500), 10000) };
}

async function problemFiles(): Promise<vscode.Uri[]> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		return [];
	}
	const relative = vscode.workspace.getConfiguration('olympia').get<string>('problem.problemsDir', DEFAULT_PROBLEMS_DIR);
	const dir = vscode.Uri.joinPath(folder.uri, relative);
	try {
		const entries = await vscode.workspace.fs.readDirectory(dir);
		return entries
			.filter(entry => entry[1] === vscode.FileType.File && /\.md$/i.test(entry[0]))
			.map(entry => vscode.Uri.joinPath(dir, entry[0]));
	} catch {
		return [];
	}
}

async function pickProblemFile(sourceUri: vscode.Uri): Promise<vscode.Uri | undefined> {
	const files = await problemFiles();
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

function verdictOf(results: readonly CaseResult[]): Verdict {
	if (results.some(r => r.verdict === 'TLE')) { return 'TLE'; }
	if (results.some(r => r.verdict === 'RE')) { return 'RE'; }
	if (results.some(r => r.verdict === 'WA')) { return 'WA'; }
	return 'AC';
}

const VERDICT_TEXT: Record<Verdict, string> = {
	AC: '通过（AC）',
	WA: '答案错误（WA）',
	RE: '运行出错（RE）',
	TLE: '超时（TLE）',
};

export function registerSampleJudge(context: vscode.ExtensionContext): vscode.Disposable {
	const command = vscode.commands.registerCommand(CMD.judgeSamples, async () => {
		const editor = vscode.window.activeTextEditor;
		const source = editor?.document.uri;
		if (!source || !/\.(?:c|cc|cpp|cxx|c\+\+)$/i.test(source.fsPath)) {
			await vscode.window.showWarningMessage('样例评测：请先打开一个 C/C++ 源文件。');
			return;
		}
		const statement = await pickProblemFile(source);
		if (!statement) {
			return;
		}

		const markdown = Buffer.from(await vscode.workspace.fs.readFile(statement)).toString('utf8');
		const { samples, timeLimitMs } = parseSamples(markdown);
		if (!samples.length) {
			await vscode.window.showWarningMessage(`「${basename(statement.fsPath)}」里没有解析到样例数据，可能这道题的题面没抓到样例。`);
			return;
		}

		const plan = planCompile(source);
		const log = output();
		log.clear();
		log.show(true);
		log.appendLine(`题面：${vscode.workspace.asRelativePath(statement, false)} · 样例 ${samples.length} 组 · 时限 ${timeLimitMs} ms（本地按 ${LOCAL_MARGIN} 倍余量）`);
		log.appendLine(`编译：${renderCommandLine(plan)}`);

		const built = await runProcess(plan.program, plan.args, plan.cwd, '', COMPILE_BUDGET_MS);
		if (built.failed || built.timedOut) {
			log.appendLine('--- 编译失败 ---');
			log.appendLine(`${built.stdout}${built.stderr}`);
			await vscode.window.showErrorMessage('编译没过，先看「Olympia 评测」面板里的编译器输出。');
			return;
		}

		const budget = Math.min(COMPILE_BUDGET_MS, timeLimitMs * LOCAL_MARGIN + 500);
		const results: CaseResult[] = [];
		await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: 'Olympia 正在跑样例', cancellable: false },
			async (progress) => {
				for (let i = 0; i < samples.length; i++) {
					progress.report({ message: `样例 ${i + 1} / ${samples.length}`, increment: 100 / samples.length });
					const started = Date.now();
					const ran = await runProcess(plan.output, [], dirname(plan.output), samples[i].input, budget);
					const ms = Date.now() - started;
					const verdict: Verdict = ran.timedOut ? 'TLE' : ran.failed ? 'RE'
						: normalize(ran.stdout) === normalize(samples[i].expected) ? 'AC' : 'WA';
					results.push({ index: i + 1, verdict, got: ran.stdout, detail: ran.stderr, ms });
					log.appendLine(`样例 ${i + 1}：${verdict} · ${ms} ms`);
					if (verdict === 'WA') {
						log.appendLine(`  期望：${normalize(samples[i].expected).slice(0, 200)}`);
						log.appendLine(`  得到：${normalize(ran.stdout).slice(0, 200)}`);
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
		const message = `样例判定 ${VERDICT_TEXT[overall]}：通过 ${passed}/${results.length} 组。`;
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
