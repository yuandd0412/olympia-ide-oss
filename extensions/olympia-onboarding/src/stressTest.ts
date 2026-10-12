/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  对拍：拿随机数据同时喂给「正解」和「暴力」，输出不一致就停下来把那组数据留给你看。
 *
 *  老版本这一步是一个 Python 脚本：要自己装 Python、自己改生成器入口。这里做成产品内的一个
 *  命令——选三个文件、确认轮数，之后编译、跑数据、比对、留证据全在 Olympia 里完成，
 *  不弹命令行窗口，也不往系统里写任何东西。
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { execFile, spawn } from 'child_process';
import { basename, dirname, join } from 'path';

import { planCompile, renderCommandLine, COMPILE_MAX_BUFFER_BYTES } from './compile';
import { CMD } from './commands';

const STATE_KEY = 'olympia.stress.roles';
const CHANNEL_TITLE = 'Olympia 对拍';
/** 一次扫描最多列这么多源文件：题解目录里上千个 .cpp 的工程，选择列表不能无限长。 */
const MAX_SOURCES_SCANNED = 400;

type Role = 'solution' | 'brute' | 'generator';

/** 三个角色的问法集中在这里，顺序即询问顺序。 */
const ROLES: readonly { role: Role; prompt: string; hint: string }[] = [
	{ role: 'solution', prompt: '选择正解文件', hint: '你认为正确的写法' },
	{ role: 'brute', prompt: '选择暴力文件', hint: '慢但一定对的做法' },
	{ role: 'generator', prompt: '选择数据生成器', hint: '第 1 个参数是轮数，标准输出是一组数据' },
];

export interface RunResult {
	readonly stdout: string;
	readonly stderr: string;
	readonly timedOut: boolean;
	readonly failed: boolean;
}

/** 起一个进程、喂 stdin、收 stdout/stderr，带超时。对拍与样例评测共用。 */
export function runProcess(program: string, args: readonly string[], cwd: string, stdin: string, timeoutMs: number): Promise<RunResult> {
	return new Promise(resolve => {
		let stdout = '';
		let stderr = '';
		let timedOut = false;
		const child = spawn(program, [...args], { cwd, windowsHide: true });
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill();
		}, timeoutMs);
		child.stdout.on('data', chunk => { stdout += String(chunk); });
		child.stderr.on('data', chunk => { stderr += String(chunk); });
		const done = (error?: Error) => {
			clearTimeout(timer);
			if (error) {
				stderr = `${stderr}${error.message}\n`;
			}
			resolve({ stdout, stderr, timedOut, failed: !!error || (!timedOut && child.exitCode !== 0) });
		};
		child.on('error', error => done(error));
		child.on('close', () => done());
		// 程序读完就退出时写 stdin 会 EPIPE，那不是我们的错误
		child.stdin.on('error', () => { /* ignore */ });
		child.stdin.end(stdin);
	});
}

/**
 * 评测机式的「忽略空白」比较：按 token 归一化，所以行尾空格、末尾换行、
 * 一行里打了几个空格都不会误报。
 */
function sameOutput(left: string, right: string): boolean {
	const norm = (text: string): string => text.split(/\s+/).filter(Boolean).join(' ');
	return norm(left) === norm(right);
}

async function listSources(): Promise<vscode.Uri[]> {
	const found = await vscode.workspace.findFiles('**/*.{cpp,cc,cxx,c}', '**/{node_modules,out,build,.git,dist}/**', MAX_SOURCES_SCANNED);
	return found.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
}

async function pickRole(uris: readonly vscode.Uri[], pick: { prompt: string; hint: string }, remembered: string | undefined): Promise<vscode.Uri | undefined> {
	const items = uris.map(uri => {
		const isLast = !!remembered && uri.toString() === remembered;
		return {
			uri,
			label: basename(uri.fsPath),
			description: vscode.workspace.asRelativePath(uri, false),
			detail: isLast ? '上次用的就是这个' : undefined
		};
	});
	// 上次的选择顶到最前面：对拍要反复跑，每次从 400 个文件里翻三遍是不能接受的。
	if (remembered) {
		const index = items.findIndex(item => item.uri.toString() === remembered);
		if (index > 0) {
			items.unshift(...items.splice(index, 1));
		}
	}
	const chosen = await vscode.window.showQuickPick(items, {
		placeHolder: `${pick.prompt} · ${pick.hint}`,
		matchOnDescription: true
	});
	return chosen?.uri;
}

async function compileAsync(uri: vscode.Uri, channel: vscode.OutputChannel): Promise<string | undefined> {
	const plan = planCompile(uri);
	channel.appendLine(`编译 ${basename(uri.fsPath)}：${renderCommandLine(plan)}`);
	try {
		await new Promise<void>((resolve, reject) => {
			execFile(plan.program, plan.args, { cwd: plan.cwd, windowsHide: true, maxBuffer: COMPILE_MAX_BUFFER_BYTES }, error => {
				error ? reject(error) : resolve();
			});
		});
		return plan.output;
	} catch (error) {
		const detail = error as { stdout?: string; stderr?: string; message?: string };
		channel.appendLine(`${detail.stdout ?? ''}${detail.stderr ?? detail.message ?? ''}`);
		return undefined;
	}
}

/** 把不一致的那组数据与两份输出留在工程目录里，方便直接贴到题解或问人。 */
async function saveEvidence(dir: string, round: number, data: string, solutionOut: string, bruteOut: string): Promise<string> {
	const folder = join(dir, 'stress-fail');
	await vscode.workspace.fs.createDirectory(vscode.Uri.file(folder));
	const stem = join(folder, `round-${round}`);
	const write = (suffix: string, text: string): Thenable<void> =>
		vscode.workspace.fs.writeFile(vscode.Uri.file(`${stem}.${suffix}`), Buffer.from(text, 'utf8'));
	await write('in', data);
	await write('sol', solutionOut);
	await write('brute', bruteOut);
	return folder;
}

interface StressOutcome {
	readonly cancelled: boolean;
	readonly round: number;
	readonly generatorFailed?: boolean;
	readonly mismatch?: { readonly data: string; readonly solution: RunResult; readonly brute: RunResult };
}

export function registerStressTest(context: vscode.ExtensionContext): vscode.Disposable {
	const channel = vscode.window.createOutputChannel(CHANNEL_TITLE);

	const command = vscode.commands.registerCommand(CMD.stressTest, async () => {
		const files = await listSources();
		if (files.length < 2) {
			await vscode.window.showInformationMessage('对拍需要至少两个 .cpp 文件：一个正解、一个暴力。当前文件夹里没有找到。');
			return;
		}

		const remembered = context.workspaceState.get<Partial<Record<Role, string>>>(STATE_KEY, {});
		const chosen: Partial<Record<Role, vscode.Uri>> = {};
		for (const pick of ROLES) {
			const uri = await pickRole(files, pick, remembered[pick.role]);
			if (!uri) {
				return; // 按 Esc 就什么都不做，也别把上次的选择覆盖掉
			}
			chosen[pick.role] = uri;
		}
		const solution = chosen.solution as vscode.Uri;
		const brute = chosen.brute as vscode.Uri;
		const generator = chosen.generator as vscode.Uri;
		await context.workspaceState.update(STATE_KEY, {
			solution: solution.toString(),
			brute: brute.toString(),
			generator: generator.toString()
		});

		const config = vscode.workspace.getConfiguration('olympia.stress');
		const rounds = Math.max(1, Math.floor(config.get<number>('rounds', 100)));
		const timeoutMs = Math.max(200, Math.floor(config.get<number>('timeoutMs', 2000)));

		channel.clear();
		channel.show(true);
		channel.appendLine(`正解 ${basename(solution.fsPath)} · 暴力 ${basename(brute.fsPath)} · 生成器 ${basename(generator.fsPath)}`);
		channel.appendLine(`共 ${rounds} 轮，单程序上限 ${timeoutMs} ms，比较时忽略空白差异。`);

		const exes: Partial<Record<Role, string>> = {};
		for (const role of ['solution', 'brute', 'generator'] as const) {
			const uri = chosen[role] as vscode.Uri;
			const exe = await compileAsync(uri, channel);
			if (!exe) {
				const action = await vscode.window.showErrorMessage(
					`${basename(uri.fsPath)} 编译失败，输出见「${CHANNEL_TITLE}」面板。`, '查看输出');
				if (action) {
					channel.show(true);
				}
				return;
			}
			exes[role] = exe;
		}

		const started = Date.now();
		const outcome = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Olympia 对拍',
			cancellable: true
		}, async (progress, token): Promise<StressOutcome> => {
			for (let round = 1; round <= rounds; round++) {
				if (token.isCancellationRequested) {
					return { cancelled: true, round };
				}
				progress.report({ message: `第 ${round} / ${rounds} 轮`, increment: 100 / rounds });

				const made = await runProcess(exes.generator as string, [String(round)], dirname(generator.fsPath), '', timeoutMs);
				if (made.failed || made.timedOut || !made.stdout.trim()) {
					channel.appendLine(`第 ${round} 轮生成器没有产出可用数据：${made.stderr.trim() || '标准输出为空'}`);
					return { cancelled: false, round, generatorFailed: true };
				}
				const data = made.stdout;

				const solutionOut = await runProcess(exes.solution as string, [], dirname(solution.fsPath), data, timeoutMs);
				const bruteOut = await runProcess(exes.brute as string, [], dirname(brute.fsPath), data, timeoutMs);
				const differs = solutionOut.timedOut || bruteOut.timedOut || solutionOut.failed || bruteOut.failed
					|| !sameOutput(solutionOut.stdout, bruteOut.stdout);
				if (differs) {
					return { cancelled: false, round, mismatch: { data, solution: solutionOut, brute: bruteOut } };
				}
			}
			return { cancelled: false, round: rounds };
		});

		const seconds = ((Date.now() - started) / 1000).toFixed(1);

		if (outcome.cancelled) {
			channel.appendLine(`已取消于第 ${outcome.round} 轮。`);
			return;
		}
		if (outcome.generatorFailed) {
			await vscode.window.showErrorMessage('生成器没有输出数据，对拍没开始。生成器要把一组数据写到标准输出。', '查看输出').then(action => {
				if (action) { channel.show(true); }
			});
			return;
		}
		const mismatch = outcome.mismatch;
		if (mismatch) {
			const folder = await saveEvidence(dirname(solution.fsPath), outcome.round, mismatch.data, mismatch.solution.stdout, mismatch.brute.stdout);
			const why = mismatch.solution.timedOut || mismatch.brute.timedOut
				? '超时'
				: mismatch.solution.failed || mismatch.brute.failed
					? '运行出错'
					: '输出不一致';
			channel.appendLine(`第 ${outcome.round} 轮${why}，数据与两份输出已存到 ${folder}`);
			const action = await vscode.window.showErrorMessage(
				`对拍在第 ${outcome.round} 轮${why}。这组数据已存进 stress-fail 文件夹。`, '打开这组数据', '查看输出');
			if (action === '打开这组数据') {
				const doc = await vscode.workspace.openTextDocument(join(folder, `round-${outcome.round}.in`));
				await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
			} else if (action === '查看输出') {
				channel.show(true);
			}
			return;
		}

		channel.appendLine(`${outcome.round} 轮全部一致，用时 ${seconds} s。`);
		await vscode.window.showInformationMessage(`对拍通过：${outcome.round} 组随机数据，正解与暴力输出一致，用时 ${seconds} s。`);
	});

	return vscode.Disposable.from(channel, command);
}
