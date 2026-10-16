/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Olympia IDE - judge-accurate C++ compilation.
 *
 *  Turns `olympia.compiler.*` into an actual g++ invocation instead of a setting nobody reads.
 *  The switch sets are the ones published by the judges themselves, so a program that runs here
 *  runs the same way there:
 *
 *    Luogu   https://help.luogu.com.cn/manual/luogu/problem/judging
 *    NOI     CCF NOI Linux 2.0 contest environment
 *
 *  Two modes exist on purpose:
 *    - the active profile's flags, for judging parity
 *    - `olympia.compiler.optimization`, which defaults to -O0 because students need debuggable
 *      binaries locally; switching it to O2 reproduces the judge's optimizer.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { execFile, spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { dirname, basename, join } from 'path';
import { locateCompiler } from './toolchain';
import { OJTarget, CUSTOM_TARGET_ID, findTarget, profileId } from './ojTargets';

export const TASK_TYPE = 'olympia-compile';

/** The profile the user wrote themselves: no `-x`, no `-std=`, nothing invented for it. */
export const CUSTOM_TARGET: OJTarget = {
	id: CUSTOM_TARGET_ID,
	label: '自定义',
	gcc: '',
	std: '',
	onlineJudgeEnv: '',
	baseFlags: []
};

export function activeProfile(): OJTarget {
	const id = profileId();
	return id === CUSTOM_TARGET_ID ? CUSTOM_TARGET : (findTarget(id) ?? CUSTOM_TARGET);
}

export function compilerBinary(): string {
	// locateCompiler already probes olympia.compiler.path, then the toolchain bundled beside the
	// executable, then PATH. Resolving it here any other way made every compile depend on a
	// system-wide g++ and silently skipped the compiler the installer ships.
	return locateCompiler().bin;
}

export interface CompilePlan {
	readonly program: string;
	readonly args: string[];
	readonly cwd: string;
	readonly output: string;
	readonly profile: OJTarget;
	readonly optimized: boolean;
}

/** Splits a user-supplied flag string the way a shell would for simple whitespace. */
function splitFlags(raw: string): string[] {
	return raw.split(/\s+/).filter(token => token.length > 0);
}

/**
 * Normalizes the optimization setting into a compiler switch.
 * The setting stores real switches (`none`, `-O2`, `-O3`), so the value is used verbatim.
 * Interpolating `-O${level}` would emit `-OO2` for a stored value of `O2`.
 */
function optimizationSwitch(level: string): string | undefined {
	const token = level.trim();
	return token.length === 0 || token === 'none' ? undefined : token;
}

/**
 * Builds the full g++ command line for `source`.
 * `overrideOptimization` lets the judge-parity command force -O2 regardless of the setting.
 */
export function planCompile(source: vscode.Uri, overrideOptimization?: string): CompilePlan {
	const config = vscode.workspace.getConfiguration('olympia');
	const dir = dirname(source.fsPath);
	const profile = activeProfile();

	const level = (overrideOptimization ?? config.get<string>('compiler.optimization', 'none')).trim();
	const optSwitch = optimizationSwitch(level);
	const optimized = optSwitch !== undefined;

	const isCustomProfile = profile.id === CUSTOM_TARGET_ID;
	// in the order the judge documents: -x <lang>, then -std=, then their published switches.
	// A custom profile supplies all of it, so nothing is invented around the user's own flags.
	const judgeFlags = isCustomProfile
		? splitFlags(config.get<string>('compiler.customFlags', ''))
		: [...languageFlags(source, profile), ...profile.baseFlags];
	const exeName = exeNameFor(source.fsPath);

	const args = [
		...judgeFlags,
		...(optSwitch ? [optSwitch] : []),
		'-o',
		exeName,
		source.fsPath
	];

	return {
		program: compilerBinary(),
		args,
		cwd: dir,
		output: join(dir, exeName),
		profile,
		optimized
	};
}

/** The command line as a single readable string, for echoing into the terminal. */
export function renderCommandLine(plan: CompilePlan): string {
	return [plan.program, ...plan.args]
		.map(token => (/\s/.test(token) ? `"${token}"` : token))
		.join(' ');
}

function formatSwitch(source: vscode.Uri | undefined): vscode.Task | undefined {
	if (!source) {
		return undefined;
	}
	const plan = planCompile(source);
	const showCommand = vscode.workspace
		.getConfiguration('olympia')
		.get<boolean>('compiler.showCompileCommand', true);

	const definition: vscode.TaskDefinition = { type: TASK_TYPE, source: source.fsPath };
	const name = plan.profile.id === CUSTOM_TARGET_ID
		? 'Olympia 自定义编译'
		: `Olympia 编译（${plan.profile.label}）`;
	const command = new vscode.Task(
		definition,
		vscode.TaskScope.Workspace,
		name,
		TASK_TYPE,
		new vscode.ProcessExecution(plan.program, plan.args, { cwd: plan.cwd })
	);
	command.group = vscode.TaskGroup.Build;
	command.presentationOptions = {
		reveal: vscode.TaskRevealKind.Always,
		panel: vscode.TaskPanelKind.Dedicated,
		clear: true,
		echo: showCommand
	};
	// a build task that always reruns, otherwise the output binary never refreshes
	command.isBackground = false;
	return command;
}

class OlympiaTaskProvider implements vscode.TaskProvider {
	provideTasks(): vscode.Task[] {
		const task = formatSwitch(vscode.window.activeTextEditor?.document.uri);
		return task ? [task] : [];
	}

	resolveTask(task: vscode.Task): vscode.Task | undefined {
		// definition 只能带可序列化字段，所以存的是 fsPath；直接当 Uri 用会抛 TypeError。
		const raw = task.definition?.source;
		return formatSwitch(typeof raw === 'string' ? vscode.Uri.file(raw) : undefined);
	}
}

export function registerCompileTaskProvider(): vscode.Disposable {
	return vscode.tasks.registerTaskProvider(TASK_TYPE, new OlympiaTaskProvider());
}

export function isCompilable(uri: vscode.Uri | undefined): uri is vscode.Uri {
	return !!uri && /\.(?:c|cc|cpp|cxx|c\+\+)$/i.test(uri.fsPath);
}

/** `.c` 必须按 C 编译：给 C 文件套 `-x c++` 会让评测机能过的写法在本地编译失败。 */
const C_STD = 'gnu17';

function languageFlags(source: vscode.Uri, profile: OJTarget): string[] {
	return /\.c$/i.test(source.fsPath)
		? ['-x', 'c', `-std=${C_STD}`]
		: ['-x', 'c++', `-std=${profile.std}`];
}

function exeNameFor(fsPath: string): string {
	// 保留源文件后缀：main.cpp 与 main.c 都收敛到 main.exe 时，后编译的会覆盖前一个，
	// 运行环节就可能跑到另一个文件编出来的程序上。
	const base = basename(fsPath);
	return process.platform === 'win32' ? `${base}.exe` : `${base}.out`;
}

/**
 * Runs `g++` directly. Used by the compile-and-run path where a background task would make it
 * impossible to feed stdin from a test file before the program starts.
 */
export const COMPILE_TIMEOUT_MS = 120000;
export const COMPILE_MAX_BUFFER_BYTES = 16 * 1024 * 1024;

function runCompiler(plan: CompilePlan): Promise<{ code: number | null; stdout: string; stderr: string }> {
	return new Promise(resolve => {
		execFile(
			plan.program,
			plan.args,
			{ cwd: plan.cwd, timeout: COMPILE_TIMEOUT_MS, windowsHide: true, maxBuffer: COMPILE_MAX_BUFFER_BYTES },
			(error, stdout, stderr) => {
				resolve({
					code: error && typeof (error as { code?: number }).code === 'number'
						? (error as { code: number }).code
						: (error ? 1 : 0),
					stdout: String(stdout),
					stderr: String(stderr)
				});
			}
		);
	});
}

let buildChannel: vscode.OutputChannel | undefined;

/** 每次调用都 createOutputChannel 会在面板里堆出一串「Olympia 编译1/2/3」。 */
function outputChannel(): vscode.OutputChannel {
	if (!buildChannel) {
		buildChannel = vscode.window.createOutputChannel('Olympia 编译');
	}
	return buildChannel;
}

const RUN_TIMEOUT_MS = 30000;

/**
 * 直接起进程并把数据写进 stdin。以前是 `cmd /c "exe < 文件"`：路径带空格时重定向会断，
 * 多开一个 shell 不说，POSIX 分支还漏了 `-c`，永远跑不起来。
 */
function runBinary(binary: string, cwd: string, stdinFile: string | undefined): Promise<{ code: number | null; stdout: string; stderr: string }> {
	return (stdinFile ? readFile(stdinFile, 'utf8') : Promise.resolve('')).then(stdinText => new Promise(resolve => {
		let stdout = '';
		let stderr = '';
		let timedOut = false;
		const child = spawn(binary, [], { cwd, windowsHide: true });
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill();
		}, RUN_TIMEOUT_MS);
		child.stdout.on('data', chunk => { stdout += String(chunk); });
		child.stderr.on('data', chunk => { stderr += String(chunk); });
		child.on('error', error => {
			clearTimeout(timer);
			resolve({ code: 1, stdout, stderr: `${stderr}${error.message}\n` });
		});
		child.on('close', code => {
			clearTimeout(timer);
			resolve({
				code: timedOut ? 124 : code,
				stdout,
				stderr: timedOut ? `${stderr}运行超过 ${Math.round(RUN_TIMEOUT_MS / 1000)} 秒，已强制结束。\n` : stderr
			});
		});
		child.stdin.on('error', () => { /* 程序读完就退出导致 EPIPE，不是错误 */ });
		child.stdin.end(stdinText);
	}));
}

export async function compileCurrentFile(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor || !isCompilable(editor.document.uri)) {
		void vscode.window.showWarningMessage('Olympia 编译：请先打开一个 C/C++ 源文件。');
		return;
	}
	const task = formatSwitch(editor.document.uri);
	if (!task) {
		return;
	}
	await vscode.tasks.executeTask(task);
}

export async function compileJudgeAccurate(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor || !isCompilable(editor.document.uri)) {
		void vscode.window.showWarningMessage('按评测机编译：请先打开一个 C/C++ 源文件。');
		return;
	}
	const plan = planCompile(editor.document.uri, '-O2');
	const output = outputChannel();
	output.clear();
	output.appendLine(renderCommandLine(plan));
	output.show(true);

	const result = await runCompiler(plan);
	if (result.stderr.trim().length > 0) {
		output.appendLine(result.stderr);
	}
	if (result.code !== 0) {
		void vscode.window.showErrorMessage('按评测机编译失败，详见「Olympia 编译」输出面板。');
		return;
	}
	void vscode.window.showInformationMessage('按评测机参数编译成功（-O2 + 评测机开关）。');
}

/** Compile, then run the produced binary against an optional test-data file. */
/** 这个选项要的是真键盘输入；名字在 QuickPick 与分支两处用，所以收成常量而不是写两遍。 */
const RUN_IN_TERMINAL_LABEL = '在终端里运行（可以手敲输入）';

/**
 * 在集成终端里跑刚编出来的程序。终端是产品里唯一有键盘 stdin 的地方：
 * 输出面板那条路是管道，程序一 `cin >>` 就读到 EOF，看起来像"没有输出"。
 */
function runInTerminal(exePath: string, cwd: string): void {
	const terminal = vscode.window.createTerminal({ cwd });
	terminal.show(true);
	// 不加引号，`D:\oler ide v3\P1001.exe` 会被 shell 切成两个参数。
	terminal.sendText(`"${exePath}"`);
}

export async function compileAndRun(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor || !isCompilable(editor.document.uri)) {
		void vscode.window.showWarningMessage('编译并运行：请先打开一个 C/C++ 源文件。');
		return;
	}

	const sourcePath = editor.document.uri.fsPath;
	const dir = dirname(sourcePath);
	const picked = await vscode.window.showQuickPick(
		[
			{ label: RUN_IN_TERMINAL_LABEL, description: '在集成终端里跑，输入可以直接用键盘敲' },
			{ label: '直接运行', description: '用空 stdin 运行，程序读不到数据' },
			{ label: '选择测试数据文件', description: '把该文件的内容作为 stdin 输入' }
		],
		{ placeHolder: '本地样例测试' }
	);
	if (!picked) {
		return;
	}

	let stdinFile: string | undefined;
	if (picked.label === '选择测试数据文件') {
		const uris = await vscode.window.showOpenDialog({
			defaultUri: vscode.Uri.file(dir),
			filters: { '输入数据': ['in', 'txt', 'dat', ''], '所有文件': ['*'] },
			openLabel: '作为输入数据'
		});
		if (!uris || uris.length === 0) {
			return;
		}
		stdinFile = uris[0].fsPath;
	}

	const plan = planCompile(editor.document.uri);
	const channel = outputChannel();
	channel.clear();
	channel.appendLine(renderCommandLine(plan));
	channel.show(true);

	const build = await runCompiler(plan);
	if (build.stderr.trim().length > 0) {
		channel.appendLine(build.stderr);
	}
	if (build.code !== 0) {
		void vscode.window.showErrorMessage('编译失败，详见「Olympia 编译」输出面板。');
		return;
	}

	if (picked.label === RUN_IN_TERMINAL_LABEL) {
		// 输出面板那条路是管道：程序一读 stdin 就拿到 EOF，`cin >>` 就那么走下去，
		// 看起来像"程序没输出"。键盘输入只有终端有。
		runInTerminal(plan.output, dir);
		return;
	}

	channel.appendLine('--- 运行 ---');
	const run = await runBinary(plan.output, dir, stdinFile);
	channel.appendLine(run.stdout);
	if (run.stderr.trim().length > 0) {
		channel.appendLine(run.stderr);
	}
	channel.appendLine(`--- 退出码 ${run.code} ---`);

	void vscode.window.showInformationMessage(
		run.code === 0 ? '程序运行结束，退出码 0。' : `程序退出码 ${run.code}，详见输出面板。`
	);
}