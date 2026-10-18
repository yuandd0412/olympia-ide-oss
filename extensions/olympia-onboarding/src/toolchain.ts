/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Locating a usable C++ compiler.
 *
 *  Olympia ships its own MinGW-w64 toolchain inside the installation directory, so a student never
 *  has to install a compiler. Resolution runs in this order:
 *
 *    1. `olympia.compiler.path`          — an explicit user override always wins
 *    2. the bundled toolchain           — `<appRoot>/toolchain/mingw64/bin/g++.exe`
 *    3. `g++` on PATH                   — covers students who already have MinGW/LLVM
 *
 *  The bundled copy is preferred over PATH on purpose: it is the version whose flags we verified
 *  against the judges, so "passes here" keeps meaning "passes there". A stray newer GCC on PATH can
 *  accept code the judge rejects.
 *
 *  Locating is the easy half. Proving the toolchain actually *works* is the rest of this file:
 *  `g++ --version` only imports four DLLs, so it answers cheerfully from an install whose `cc1plus`,
 *  `as` and `ld` die at load time with 0xC0000135 — and `g++` then exits 1 without a word. Every
 *  child we spawn therefore gets the compiler's own `bin` in front of PATH, and every probe asserts
 *  on the binary we resolved by absolute path instead of trusting a name a stray system MinGW could
 *  shadow.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { basename, delimiter, dirname, join } from 'path';

/** Where a toolchain came from, so the environment report can explain the choice. */
export type CompilerSource =
	| { readonly kind: 'configured'; readonly bin: string }
	| { readonly kind: 'bundled'; readonly bin: string; readonly root: string }
	| { readonly kind: 'path'; readonly bin: string };

const EXE = process.platform === 'win32' ? '.exe' : '';
const GPP = `g++${EXE}`;
const CC1PLUS = `cc1plus${EXE}`;

function config(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration('olympia');
}

/**
 * Root of the bundled toolchain.
 *
 * `vscode.env.appRoot` is the directory holding the executable — for an installed build that is the
 * Inno Setup `{app}` folder, where `code.iss` copies everything not explicitly excluded. The build
 * lays the toolchain down under `toolchain\mingw64` there, so an installed copy needs no extra
 * steps beyond running the installer.
 *
 * In a dev checkout the repo is the app root instead, so the `.build` staging directory produced by
 * `build/fetch-toolchain.mjs` is checked as well. That directory holds the toolchain root directly
 * (no `mingw64` layer), which is why both shapes are probed.
 */
function bundledRoots(): string[] {
	const appRoot = vscode.env.appRoot;
	return [
		join(appRoot, 'toolchain', 'mingw64'),
		join(appRoot, 'resources', 'toolchain', 'mingw64'),
		join(appRoot, '.build', 'toolchain'),
	];
}

/** A located compiler plus what probing it actually found. */
export type ResolvedCompiler =
	& CompilerSource
	& {
		/** the version string parsed out of `g++ --version`, when the binary answered */
		readonly version?: string;
		/** true when the binary exists, `--version` succeeded and its subprograms load */
		readonly usable: boolean;
		/** why it is not usable, for diagnostics */
		readonly error?: string;
		/** subprograms that exist but cannot be loaded, already phrased for the report */
		readonly broken?: string;
	};

/** Directory names directly under `dir`, empty when `dir` is not there at all. */
function childDirs(dir: string): string[] {
	try {
		return readdirSync(dir, { withFileTypes: true })
			.filter(entry => entry.isDirectory())
			.map(entry => entry.name);
	} catch {
		return [];
	}
}

/** One probe run: `code` is the exit code (Windows reports NTSTATUS there), `osError` the spawn error. */
export interface ProbeRun {
	readonly code: number | null;
	readonly stdout: string;
	readonly stderr: string;
	readonly osError?: string;
}

/**
 * Runs one program and never throws: probes have to report a failing exit code, not reject.
 */
export function runCapture(
	program: string, args: readonly string[], env: NodeJS.ProcessEnv, timeoutMs: number
): Promise<ProbeRun> {
	return new Promise(resolve => {
		execFile(program, [...args], { env, timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
			(error, stdout, stderr) => {
				const e = error as (Error & { code?: number | string }) | null;
				const code = e === null ? 0 : typeof e.code === 'number' ? e.code : (e.code ? null : 1);
				resolve({
					code,
					stdout: String(stdout),
					stderr: String(stderr),
					osError: typeof e?.code === 'string' ? e.code : undefined
				});
			});
	});
}

/** Runs `<bin> --version`; resolves with the first line on success, throws a readable reason otherwise. */
export async function probeVersion(bin: string, timeoutMs = 8000, env = compilerEnv()): Promise<string> {
	const run = await runCapture(bin, ['--version'], env, timeoutMs);
	if (run.code !== 0) {
		const error = new Error(describeFailure(bin, run.code, run.stdout, run.stderr)) as Error & { code?: string };
		error.code = run.osError;
		throw error;
	}
	return run.stdout.split(/\r?\n/)[0] ?? '';
}

/**
 * Extracts a version from output like `g++ (GCC) 15.2.0` or `g++ (Ubuntu 13.2.0) 13.2.0`.
 * Takes the *last* x.y.z on the line, because a distro tag can contain an earlier number
 * (`g++ (GCC) 9.3.0` is fine but `g++ (GCC) 12-posix-dfsg-12.2.0` is not).
 */
export function parseGccVersion(raw: string): string | undefined {
	const first = raw.split(/\r?\n/)[0] ?? raw;
	const all = [...first.matchAll(/(\d+)\.(\d+)(?:\.(\d+))?/g)];
	if (!all.length) { return undefined; }
	const last = all[all.length - 1];
	return last[3] ? `${last[1]}.${last[2]}.${last[3]}` : `${last[1]}.${last[2]}`;
}

/**
 * Finds the compiler Olympia should use, without running it.
 * Returns the first candidate whose binary exists; `usable` still needs a `--version` probe.
 */
export function locateCompiler(): CompilerSource {
	const configured = config().get<string>('compiler.path', '').trim();
	if (configured.length > 0) {
		return { kind: 'configured', bin: configured };
	}
	for (const root of bundledRoots()) {
		const bin = join(root, 'bin', GPP);
		if (existsSync(bin)) {
			return { kind: 'bundled', bin, root };
		}
	}
	return { kind: 'path', bin: GPP };
}

/**
 * Directory that has to be on a child's PATH for this compiler.
 *
 * Every kind of source has one, not just the bundled toolchain: `cc1plus`/`as`/`ld` and the runtime
 * DLLs a produced `.exe` links against all live beside the compiler we resolved, so a configured
 * `olympia.compiler.path` pointing at someone's own MinGW needs *its* bin, and prepending the bin of
 * a system compiler that is already on PATH is correct and harmless.
 */
export function compilerBinDir(source: CompilerSource = locateCompiler()): string | undefined {
	switch (source.kind) {
		case 'bundled':
			return join(source.root, 'bin');
		case 'configured':
			// 填的可能是完整路径，也可能只是一个裸 `g++.exe`（那就跟 kind 'path' 一样从 PATH 里找）
			return /[\\/]/.test(source.bin) ? dirname(source.bin) : firstDirOnPathWith(GPP);
		default:
			return firstDirOnPathWith(GPP);
	}
}

/** First PATH entry that actually contains `name`. */
function firstDirOnPathWith(name: string): string | undefined {
	const current = process.env.PATH ?? process.env.Path ?? '';
	return current.split(delimiter).find(dir => dir.length > 0 && existsSync(join(dir, name)));
}

/** Sets `PATH` on a copy of the environment, replacing every case variant of the key. */
function withPath(base: Record<string, string>, value: string): Record<string, string> {
	const env: Record<string, string> = {};
	for (const [key, entry] of Object.entries(base)) {
		if (!key || key.toUpperCase() !== 'PATH') {
			env[key] = entry;
		}
	}
	env.PATH = value;
	return env;
}

/**
 * The environment for every child Olympia starts. Built per call, never written back into
 * `process.env` — the extension host must keep the PATH it was launched with.
 */
export function compilerEnv(source: CompilerSource = locateCompiler()): Record<string, string> {
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		// ProcessExecution 的 env 类型是 { [key: string]: string }，而 process.env 允许 undefined，
		// 所以这里把没有值的键直接丢掉，而不是塞一个空字符串进去骗过类型检查。
		if (value !== undefined) { env[key] = value; }
	}
	const binDir = compilerBinDir(source);
	if (!binDir) {
		return env;
	}
	const current = env.PATH ?? env.Path ?? '';
	if (current.split(delimiter)[0]?.toLowerCase() === binDir.toLowerCase()) {
		return env;  // 探针一次要起好几个子进程，别每次都往 PATH 前面叠一层
	}
	return withPath(env, `${binDir}${delimiter}${current}`);
}

/** Whether the compiler's bin is what a child would search first, for the environment report. */
export function pathInjection(source: CompilerSource = locateCompiler()): { readonly binDir: string | undefined; readonly injected: boolean; readonly detail: string } {
	const binDir = compilerBinDir(source);
	const first = (compilerEnv(source).PATH ?? '').split(delimiter)[0] ?? '';
	const injected = !!binDir && first.toLowerCase() === binDir.toLowerCase();
	return {
		binDir,
		injected,
		detail: injected
			? `子进程 PATH 的第一项就是编译器所在的 bin：${binDir}`
			: binDir
				? `没能把 ${binDir} 放到子进程 PATH 前面——编出来的程序会找不到 libstdc++-6.dll`
				: '没定位到编译器所在的 bin 目录——子进程 PATH 原样继承，编出来的程序会找不到 libstdc++-6.dll'
	};
}

/** NTSTATUS codes that mean "the loader could not even start this process". */
const LOADER_FAILURES: ReadonlyMap<number, string> = new Map([
	[0xC0000135, '缺少它需要的运行库 DLL'],
	[0xC0000138, '运行库 DLL 初始化失败'],
	[0xC0000139, '运行库 DLL 里找不到要用的函数']
]);

/** 加载器那一层的失败说成人话；不是这类问题返回 undefined。 */
export function loaderFailure(code: number | null): string | undefined {
	if (process.platform !== 'win32' || code === null || code < 0) {
		return undefined;
	}
	const known = LOADER_FAILURES.get(code);
	return known ? `${known}（退出码 0x${code.toString(16).toUpperCase()}）` : undefined;
}

/**
 * 一次子进程失败的可读解释。
 * 「非零退出 + 一个字都没输出」是这里最容易漏掉的一种：g++ 起不来 cc1plus 时就是这样，
 * 界面上只会剩下 `--- 编译失败 ---` 后面一段空白——这次排查花掉几天就是因为那句话。
 */
export function describeFailure(program: string, code: number | null, stdout: string, stderr: string, what = '编译器'): string {
	const name = basename(program);
	const loader = loaderFailure(code);
	if (loader) {
		const where = process.platform === 'win32' && /[\\/]/.test(program) ? dirname(program) : undefined;
		return `${name} 无法启动：${loader}。这是工具链的安装不完整（缺运行库 DLL），不是代码写错了`
			+ (where ? `。要补的 DLL 就该在 ${where} 里。` : '。');
	}
	if (code === null) {
		return `${name} 没能启动（进程根本没有退出码）。`;
	}
	return `${stdout}${stderr}`.trim()
		|| `${what}没有任何输出，可能是${what}自身无法启动（退出码 ${code}）。`;
}

/** Where `g++` finds its own subprograms; the version and triple directory names are never assumed. */
export function toolchainParts(source: CompilerSource = locateCompiler()): { readonly cc1plus?: string; readonly others: readonly string[] } {
	const binDir = compilerBinDir(source);
	if (!binDir) {
		return { cc1plus: undefined, others: [] };
	}
	const root = dirname(binDir);
	const gccRoot = join(root, 'lib', 'gcc');
	const triples = childDirs(gccRoot);
	const cc1plus = triples
		.flatMap(triple => childDirs(join(gccRoot, triple)).map(version => join(gccRoot, triple, version, CC1PLUS)))
		.find(path => existsSync(path));
	// as/ld 有两份一模一样的拷贝：gcc 实际起的是 `<triple>\bin\` 那个多架构目录里的，两份都要查。
	const bins = [binDir, ...triples.map(triple => join(root, triple, 'bin'))];
	const others = [...new Set(bins.flatMap(dir => [`as${EXE}`, `ld${EXE}`].map(name => join(dir, name))))]
		.filter(path => existsSync(path));
	return { cc1plus, others };
}

export interface LoadCheck {
	/** what was probed, as one report line */
	readonly target: string;
	readonly ok: boolean;
	readonly detail?: string;
}

/**
 * Proves the parts of the toolchain that a *compile* needs, which `g++ --version` cannot see:
 * `g++.exe` imports four DLLs and all four happen to survive a half-copied install, while
 * `cc1plus.exe`/`as.exe`/`ld.exe` import the rest. Running each with `--version` is the cheapest
 * load test there is — a missing dependency shows up as 0xC0000135 before any output.
 */
export async function probeSubprograms(source: CompilerSource = locateCompiler()): Promise<LoadCheck[]> {
	const env = compilerEnv(source);
	const parts = toolchainParts(source);
	const checks: LoadCheck[] = [];
	const targets = [
		...(parts.cc1plus ? [parts.cc1plus] : []),
		...parts.others
	];
	if (!targets.length) {
		// 只有内置工具链能断定这是坏的：用户自己指定的编译器可能是 clang/MSVC，压根没有这套目录。
		return [{
			target: '编译器子程序 cc1plus / as / ld',
			ok: source.kind !== 'bundled',
			detail: `在 ${compilerBinDir(source) ?? '编译器目录'} 旁边没找到 cc1plus、as、ld，这一项没查。`
		}];
	}
	for (const program of targets) {
		const run = await runCapture(program, ['--version'], env, 8000);
		checks.push({
			target: `${basename(program)}（${dirname(program)}）`,
			ok: run.code === 0,
			detail: run.code === 0 ? undefined : describeFailure(program, run.code, run.stdout, run.stderr)
		});
	}
	return checks;
}

/** Locate, then actually run the binary so a broken toolchain is reported rather than assumed. */
export async function resolveCompiler(): Promise<ResolvedCompiler> {
	const found = locateCompiler();
	const env = compilerEnv(found);
	try {
		const raw = await probeVersion(found.bin, 8000, env);
		const broken = (await probeSubprograms(found))
			.filter(check => !check.ok)
			.map(check => check.detail ? `${check.target}：${check.detail}` : check.target)
			.join('；');
		return {
			...found,
			usable: broken.length === 0,
			version: parseGccVersion(raw),
			broken: broken.length ? broken : undefined
		};
	} catch (error) {
		let message = '未知错误';
		if (error && typeof error === 'object') {
			const e = error as { code?: unknown; message?: string };
			// ENOENT means the binary is simply not there, which is the common case on a machine
			// that has never had a compiler installed — worth distinguishing from a broken install.
			message = e.code === 'ENOENT'
				? '找不到该编译器'
				: (e.message ?? message);
		}
		return { ...found, usable: false, error: message };
	}
}
