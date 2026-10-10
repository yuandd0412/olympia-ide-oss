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
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

/** Where a toolchain came from, so the environment report can explain the choice. */
export type CompilerSource =
	| { readonly kind: 'configured'; readonly bin: string }
	| { readonly kind: 'bundled'; readonly bin: string; readonly root: string }
	| { readonly kind: 'path'; readonly bin: string };

const GPP = process.platform === 'win32' ? 'g++.exe' : 'g++';

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
		/** true when the binary exists and `--version` succeeded */
		readonly usable: boolean;
		/** why it is not usable, for diagnostics */
		readonly error?: string;
	};

/** Runs `<bin> --version`; resolves with the first line on success. */
export function probeVersion(bin: string, timeoutMs = 8000): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		execFile(bin, ['--version'], { timeout: timeoutMs, windowsHide: true }, (error, stdout) => {
			if (error) { reject(error); return; }
			resolve(String(stdout).split(/\r?\n/)[0] ?? '');
		});
	});
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

/** Locate, then actually run the binary so a broken toolchain is reported rather than assumed. */
export async function resolveCompiler(): Promise<ResolvedCompiler> {
	const found = locateCompiler();
	try {
		const raw = await probeVersion(found.bin);
		return { ...found, usable: true, version: parseGccVersion(raw) };
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

/** Directory that must be on PATH for the toolchain's own subprograms to be found. */
export function compilerBinDir(source: CompilerSource): string | undefined {
	return source.kind === 'bundled' ? join(source.root, 'bin') : undefined;
}