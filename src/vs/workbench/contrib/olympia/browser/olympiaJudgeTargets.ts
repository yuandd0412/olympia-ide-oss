/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Olympia 评测机参数表（core 侧副本）。
 *
 * ## 为什么有两份
 *
 * 真源在扩展里：`oss/extensions/olympia-onboarding/src/ojTargets.ts`。
 * 扩展的 `package.json` 只声明了「有哪些配置项、默认值是什么」，**没有**声明每个评测机
 * 用哪个 GCC、哪个 C++ 标准、哪些开关 —— 那些字面量只存在于扩展的 TypeScript 里。
 *
 * 而开始引导的卡片要在**首帧**就显示「你正在用哪个评测机、编译命令长什么样」。
 * 那一刻扩展还没激活（扩展激活在 `LifecyclePhase.Ready` 之后），core 拿不到扩展里的表。
 * 所以 core 必须自己有一份。
 *
 * ## 为什么不会漂移
 *
 * 两份表必须逐字一致。`scripts/oneoff/check-olympia-start-page.mjs` 里有一条断言，
 * 逐字段比对 core 的 `OLYMPIA_JUDGE_TARGETS` 与扩展的 `OJ_TARGETS`（id / label / gcc /
 * std / onlineJudgeEnv / baseFlags 顺序与内容）。改了一处忘了另一处，体检直接红。
 *
 * 这条断言是「把两份文件读进来做结构化比对」，不是「比对字符串」—— 所以它对
 * 空白、缩进、引号风格不敏感，只对**语义**敏感。
 */

export interface OlympiaJudgeTarget {
	/** 存储在 `olympia.compiler.profile` 里的 id。 */
	readonly id: string;
	/** 用户看到的名字。 */
	readonly label: string;
	/** 评测机上的 GCC 版本。 */
	readonly gcc: string;
	/** 评测机接受的 C++ 标准。 */
	readonly std: string;
	/** 评测机给 `ONLINE_JUDGE` 环境变量赋的值。 */
	readonly onlineJudgeEnv: string;
	/** 评测机公布的开关（不含 `-x`、`-std=` 和优化等级）。 */
	readonly baseFlags: readonly string[];
}

const LUOGU_BASE_FLAGS = ['-fPIC', '-DONLINE_JUDGE', '-Wall', '-fno-asm', '-lm', '-march=native'];

export const OLYMPIA_JUDGE_TARGETS: readonly OlympiaJudgeTarget[] = [
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

/** `olympia.compiler.profile` 的兜底 id。 */
export const OLYMPIA_DEFAULT_JUDGE_TARGET_ID = OLYMPIA_JUDGE_TARGETS[0].id;

export function olympiaFindJudgeTarget(id: string | undefined): OlympiaJudgeTarget | undefined {
	return OLYMPIA_JUDGE_TARGETS.find(target => target.id === id);
}

/** 按 id 取评测机；取不到就回落到第一个（洛谷）。 */
export function olympiaActiveJudgeTarget(id: string | undefined): OlympiaJudgeTarget {
	return olympiaFindJudgeTarget(id) ?? OLYMPIA_JUDGE_TARGETS[0];
}

/** 评测机在状态栏上的样子：`洛谷 · C++23`。 */
export function olympiaJudgeTargetSummary(target: OlympiaJudgeTarget): string {
	return target.std ? `${target.label} · ${target.std.toUpperCase()}` : target.label;
}

/** 评测机公布的完整命令行（按评测机文档的顺序），仅用于显示。 */
export function olympiaRenderJudgeFlags(target: OlympiaJudgeTarget): string {
	return ['-x', 'c++', `-std=${target.std}`, ...target.baseFlags].join(' ');
}
