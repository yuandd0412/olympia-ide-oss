/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Olympia IDE - the judge environments Olympia knows how to reproduce.
 *
 *  One table describes each judge; the compile path and every surface that talks about the
 *  judge (the profile picker, the environment report, the tools view, the status bar) reads it.
 *  It used to be two tables that had already drifted apart, which meant a fix to the switches
 *  actually compiled left the description shown to the user behind.
 *
 *  Judge parameters are transcribed from their own documentation:
 *    Luogu  https://help.luogu.com.cn/manual/luogu/problem/judging
 *    NOI    CCF NOI Linux 2.0 contest environment
 *
 *  Two details that are easy to get wrong and cause real failures:
 *    - `-DONLINE_JUDGE` is a macro with no value. `ONLINE_JUDGE=luogu` is the judge's
 *      *environment variable*, a separate thing that code cannot test with #ifdef.
 *    - Luogu modifies GCC so that an optimization pragma or attribute fails the build.
 *      Their default submission language is the NOI variant: GCC 9.3.0 with -std=c++14.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export interface OJTarget {
	readonly id: string;
	readonly label: string;
	/** GCC version the judge runs. */
	readonly gcc: string;
	/** C++ standard the judge accepts. */
	readonly std: string;
	/** Value the judge gives the ONLINE_JUDGE environment variable. */
	readonly onlineJudgeEnv: string;
	/** The judge's published switches, `-x`, `-std=` and the optimizer excluded. */
	readonly baseFlags: readonly string[];
}

const LUOGU_BASE_FLAGS = ['-fPIC', '-DONLINE_JUDGE', '-Wall', '-fno-asm', '-lm', '-march=native'];

export const OJ_TARGETS: readonly OJTarget[] = [
	{
		id: 'luogu',
		label: '洛谷',
		gcc: '15.1.0',
		std: 'c++23',
		onlineJudgeEnv: 'luogu',
		baseFlags: LUOGU_BASE_FLAGS
	},
	{
		id: 'noi',
		label: 'NOI Linux 2.0（洛谷默认提交）',
		gcc: '9.3.0',
		std: 'c++14',
		onlineJudgeEnv: 'noi',
		baseFlags: LUOGU_BASE_FLAGS
	}
];

export const CUSTOM_TARGET_ID = 'custom';

export function findTarget(id: string): OJTarget | undefined {
	return OJ_TARGETS.find(target => target.id === id);
}

/** The id stored in `olympia.compiler.profile`. */
export function profileId(): string {
	return vscode.workspace.getConfiguration('olympia').get<string>('compiler.profile', OJ_TARGETS[0].id);
}

/** The target `olympia.compiler.profile` names, falling back to the first one. */
export function activeTarget(): OJTarget {
	return findTarget(profileId()) ?? OJ_TARGETS[0];
}

/** A target as the user sees it in the bars: `洛谷 · C++23`. */
export function targetSummary(target: OJTarget): string {
	return target.std ? `${target.label} · ${target.std.toUpperCase()}` : target.label;
}

/** The whole command line in the order the judge documents it, for display only. */
export function renderFlags(target: OJTarget): string {
	return ['-x', 'c++', `-std=${target.std}`, ...target.baseFlags].join(' ');
}
