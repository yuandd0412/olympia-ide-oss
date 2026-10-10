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
import { execFile } from 'child_process';
import { dirname, basename, join } from 'path';
import { locateCompiler } from './toolchain';

export const TASK_TYPE = 'olympia-compile';

export interface OJFlags {
	readonly id: string;
	readonly label: string;
	readonly std: string;
	readonly onlineJudge: string;
	readonly flags: readonly string[];
}

/**
 * Switch sets transcribed from the judges' own documentation.
 *
 * Luogu, https://help.luogu.com.cn/manual/luogu/problem/judging :
 *   g++ -x c++ -std=$version -fPIC -DONLINE_JUDGE -Wall -fno-asm -lm -march=native
 *   "# O2 优化开关为 -O2"
 *
 * Two details that are easy to get wrong and cause real failures:
 *   - ONLINE_JUDGE is defined WITHOUT a value. `ONLINE_JUDGE=luogu` is the judge's
 *     *environment variable*, a separate thing from the -D macro.
 *   - Luogu modifies GCC so that opening an optimization pragma/attribute fails the build.
 *     Their default submission language is the NOI variant: GCC 9.3.0 with -std=c++14.
 */
export const OJ_PROFILES: readonly OJFlags[] = [
	{
		id: 'luogu',
		label: '洛谷',
		std: 'c++23',
		onlineJudge: 'luogu',
		flags: ['-x', 'c++', '-fPIC', '-DONLINE_JUDGE', '-Wall', '-fno-asm', '-lm', '-march=native']
	},
	{
		id: 'noi',
		label: 'NOI / 洛谷默认',
		std: 'c++14',
		onlineJudge: 'noi',
		flags: ['-x', 'c++', '-fPIC', '-DONLINE_JUDGE', '-Wall', '-fno-asm', '-lm', '-march=native']
	}
];

export const CUSTOM_PROFILE: OJFlags = {
	id: 'custom',
	label: '自定义',
	std: '',
	onlineJudge: '',
	flags: []
};

export function activeProfile(): OJFlags {
	const config = vscode.workspace.getConfiguration('olympia');
	const id = config.get<string>('compiler.profile', 'luogu');
	if (id === 'custom') {
		return CUSTOM_PROFILE;
	}
	return OJ_PROFILES.find(p => p.id === id) ?? OJ_PROFILES[0];
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
	readonly profile: OJFlags;
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

	const useProfileFlags = profile.id !== 'custom';
	const profileFlags = useProfileFlags
		? profile.flags
		: splitFlags(config.get<string>('compiler.customFlags', ''));

	// -std is implicit for custom profiles: the user's own flags decide the standard
	const stdFlag = useProfileFlags ? `-std=${profile.std}` : '';
	const exeName = basename(source.fsPath).replace(/\.[^.]+$/, '') + (process.platform === 'win32' ? '.exe' : '');

	// exactly the judge's published order, with -O2 appended as their docs show
	const args = [
		stdFlag,
		...profileFlags,
		...(optSwitch ? [optSwitch] : []),
		'-o',
		exeName,
		source.fsPath
	].filter(token => token !== '');

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
	const name = plan.profile.id === 'custom'
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
		const source = task.definition?.source as vscode.Uri | undefined;
		return formatSwitch(source);
	}
}

export function registerCompileTaskProvider(): vscode.Disposable {
	return vscode.tasks.registerTaskProvider(TASK_TYPE, new OlympiaTaskProvider());
}

export function isCompilable(uri: vscode.Uri | undefined): uri is vscode.Uri {
	return !!uri && /\.(?:c|cc|cpp|cxx|c\+\+)$/i.test(uri.fsPath);
}

function exeNameFor(fsPath: string): string {
	const base = basename(fsPath).replace(/\.[^.]+$/, '');
	return process.platform === 'win32' ? `${base}.exe` : base;
}

/**
 * Runs `g++` directly. Used by the compile-and-run path where a background task would make it
 * impossible to feed stdin from a test file before the program starts.
 */
function runCompiler(plan: CompilePlan): Promise<{ code: number | null; stdout: string; stderr: string }> {
	return new Promise(resolve => {
		execFile(
			plan.program,
			plan.args,
			{ cwd: plan.cwd, timeout: 120000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
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

function runBinary(binary: string, cwd: string, stdinFile: string | undefined): Promise<{ code: number | null; stdout: string; stderr: string }> {
	return new Promise(resolve => {
		const args = stdinFile ? [`<${stdinFile}`] : [];
		// a shell is required for the input redirect, so this one is intentionally not execFile
		execFile(
			process.platform === 'win32' ? 'cmd' : '/bin/sh',
			process.platform === 'win32' ? ['/d', '/s', '/c', `"${binary}" ${args.join(' ')}`] : [`"${binary}" ${args.join(' ')}`],
			{ cwd, timeout: 30000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
			(error, stdout, stderr) => {
				resolve({
					code: error && typeof (error as { code?: number }).code === 'number' ? (error as { code: number }).code : (error ? 1 : 0),
					stdout: String(stdout),
					stderr: String(stderr)
				});
			}
		);
	});
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
	const plan = planCompile(editor.document.uri, 'O2');
	const output = vscode.window.createOutputChannel('Olympia 编译');
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
	const channel = vscode.window.createOutputChannel('Olympia 编译');
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

	channel.appendLine('--- 运行 ---');
	const binary = join(dir, exeNameFor(sourcePath));
	const run = await runBinary(binary, dir, stdinFile);
	channel.appendLine(run.stdout);
	if (run.stderr.trim().length > 0) {
		channel.appendLine(run.stderr);
	}
	channel.appendLine(`--- 退出码 ${run.code} ---`);

	void vscode.window.showInformationMessage(
		run.code === 0 ? '程序运行结束，退出码 0。' : `程序退出码 ${run.code}，详见输出面板。`
	);
}