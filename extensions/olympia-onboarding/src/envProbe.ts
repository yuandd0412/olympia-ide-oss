/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  The environment self-check ("环境自检"), end to end.
 *
 *  Why `g++ --version` is not evidence of anything: g++.exe imports four DLLs, and a toolchain that
 *  was copied out halfway still has those four. The programs a real compile needs — `cc1plus` for
 *  the frontend, `as` and `ld` for the backend — import the rest, and a missing one makes the
 *  process die at load time so `g++` exits 1 with no output at all. Worse, a machine that happens
 *  to have another MinGW earlier on PATH answers through *that* compiler and looks perfectly healthy
 *  while the bundled toolchain is broken.
 *
 *  So this probes what actually has to work:
 *    1. the subprograms, loaded from the resolved toolchain by absolute path with only that
 *       toolchain's `bin` in front of PATH (`probeSubprograms` in toolchain.ts)
 *    2. one real compile *and run* per standard the judges accept, in a temp directory, with the
 *       active profile's own flags — compiling without running would still pass while 评测 fails,
 *       because the produced .exe needs libstdc++-6.dll from the toolchain's bin
 *    3. whether the child PATH injection that makes (2) possible is in effect at all
 *--------------------------------------------------------------------------------------------*/
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as vscode from 'vscode';

import { activeProfile } from './compile';
import { CUSTOM_TARGET_ID } from './ojTargets';
import { compilerBinDir, compilerEnv, describeFailure, locateCompiler, pathInjection, probeSubprograms, runCapture } from './toolchain';

export interface ProbeStep {
	readonly label: string;
	readonly ok: boolean;
	readonly detail?: string;
}

/** 编译与运行各自的上限：探针是点一下「环境自检」就要出结果的，不能像正式编译那样等两分钟。 */
const COMPILE_BUDGET_MS = 60000;
const RUN_BUDGET_MS = 10000;

/** 评测机接受的两个标准档；只测一个的话另一档坏掉就看不见。 */
const PROBE_STDS = ['c++23', 'c++14'] as const;

/** 学生真会写的两种最小情况：一个空 main，一个带 STL 的。后者才走 libstdc++ 和 <bits/stdc++.h>。 */
const PROBE_SOURCES: ReadonlyArray<{ readonly name: string; readonly text: string; readonly what: string }> = [
	{
		name: 'probe_main.cpp',
		text: 'int main() { return 0; }\n',
		what: 'int main(){}'
	},
	{
		name: 'probe_stl.cpp',
		text: [
			'#include <bits/stdc++.h>',
			'int main(){',
			'    int a[3] = {3,1,2};',
			'    std::sort(a, a+3);',
			'    std::vector<int> v(a, a+3);',
			'    return v.size() == 3 && v[0] == 1 ? 0 : 1;',
			'}',
			''
		].join('\n'),
		what: '#include <bits/stdc++.h> + std::sort'
	}
];

/**
 * The active profile's flags with its own `-std=` swapped for the standard under probe. A custom
 * profile has no `-std=` of its own, so the one under probe is simply added.
 */
function argsForStd(base: readonly string[], std: string, output: string, source: string): string[] {
	const withoutStd = base.filter(arg => !arg.startsWith('-std='));
	return withoutStd[0] === '-x'
		? ['-x', 'c++', `-std=${std}`, ...withoutStd.slice(2), '-o', output, source]
		: [`-std=${std}`, ...withoutStd, '-o', output, source];
}

function activeFlags(): string[] {
	const config = vscode.workspace.getConfiguration('olympia');
	const profile = activeProfile();
	return profile.id === CUSTOM_TARGET_ID
		? config.get<string>('compiler.customFlags', '').trim().split(/\s+/).filter(token => token.length > 0)
		: ['-x', 'c++', `-std=${profile.std}`, ...profile.baseFlags];
}

/**
 * Compile one probe source, then run what came out. Both halves have to answer with exit code 0:
 * a build that produces an .exe nobody can start is exactly the failure this file exists to catch.
 */
async function probeCompileAndRun(
	dir: string, program: string, env: NodeJS.ProcessEnv, base: readonly string[],
	std: string, probe: { readonly name: string; readonly what: string }
): Promise<ProbeStep> {
	const source = join(dir, probe.name);
	const output = join(dir, `${probe.name}.${std}.exe`);
	const label = `${probe.what} · -std=${std}`;

	const built = await runCapture(program, argsForStd(base, std, output, source), env, COMPILE_BUDGET_MS);
	if (built.code !== 0) {
		return { label: `编译 ${label}`, ok: false, detail: describeFailure(program, built.code, built.stdout, built.stderr) };
	}
	const ran = await runCapture(output, [], env, RUN_BUDGET_MS);
	return {
		label: `编译并运行 ${label}`,
		ok: ran.code === 0,
		detail: ran.code === 0
			? undefined
			: `编出来了但跑不起来：${describeFailure(output, ran.code, ran.stdout, ran.stderr)}`
	};
}

/**
 * The whole self-check. Everything runs against the compiler Olympia resolved, by absolute path, in
 * an environment whose PATH this extension built — a stray system MinGW must not be able to answer
 * on the bundled toolchain's behalf.
 */
export async function probeToolchain(): Promise<ProbeStep[]> {
	const source = locateCompiler();
	const env = compilerEnv(source);
	const steps: ProbeStep[] = [];

	const subprograms = await probeSubprograms(source);
	steps.push(...subprograms.map(check => ({
		label: `子程序加载：${check.target}`,
		ok: check.ok,
		detail: check.detail
	})));

	const dir = mkdtempSync(join(tmpdir(), 'olympia-envprobe-'));
	try {
		for (const probe of PROBE_SOURCES) {
			writeFileSync(join(dir, probe.name), probe.text, 'utf8');
		}
		const base = activeFlags();
		for (const std of PROBE_STDS) {
			for (const probe of PROBE_SOURCES) {
				steps.push(await probeCompileAndRun(dir, source.bin, env, base, std, probe));
			}
		}
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}

	const injection = pathInjection(source);
	steps.push({
		label: `子进程 PATH 里有没有 ${compilerBinDir(source) ?? '编译器的 bin'}`,
		ok: injection.injected,
		detail: injection.injected
			? `${injection.detail}；编出来的 exe 才能找到 libstdc++-6.dll、libgcc_s_seh-1.dll、libwinpthread-1.dll`
			: injection.detail
	});
	return steps;
}
