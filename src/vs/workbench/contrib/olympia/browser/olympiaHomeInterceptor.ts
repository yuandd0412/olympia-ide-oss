/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * 「帮助 > 欢迎」要不要被 Olympia 首页接管。
 *
 * ## 为什么单独抽一个零 import 的模块
 *
 * 判据要给上游 `gettingStarted.contribution.ts` 用，而上游文件 import
 * contrib 里的东西已经是我们这个 fork 的既定做法（设置页那边
 * `preferences.contribution.ts` 就是这么干的）。
 *
 * 但这个模块**必须零 import**：它会被上游文件直接 import，如果它再 import
 * 任何东西，就有可能形成环（上游 → contrib → 上游），构建期才炸。
 * 所以类型全写成结构化的内联类型，不 import 任何 interface。
 *
 * ## 判据：只有「完全无参」才接管
 *
 * `workbench.action.openWalkthrough` 有两类调用方：
 *  - 「帮助」菜单 / 命令面板 → **无参**，这是我们要替换的那一次；
 *  - 内部带着具体 walkthrough id 打开某一步 → **有参**，必须放行。
 *
 * 放行的条件比「`walkthroughID` 是 undefined」更严：`optionsOrToSide`
 * 也必须是 undefined。理由和设置页那边一致 —— 一旦调用方表达了
 * 「我要开在侧边 / 我要 inactive」这类意图，就不该被我们悄悄改掉。
 *
 * 与设置页的对应关系：
 *  - 设置页：`query !== undefined`（含空串）即放行；
 *  - 首页：`walkthroughID !== undefined` 或 `optionsOrToSide !== undefined` 即放行。
 */

export interface IOlympiaWelcomeArgs {
	/** 要打开的 walkthrough id 或 id+step。无参调用时是 undefined。 */
	readonly walkthroughID: string | { category: string; step: string } | undefined;
	/** 上游的第二参数：开在侧边 / inactive。无参调用时是 undefined。 */
	readonly optionsOrToSide: { toSide?: boolean; inactive?: boolean } | boolean | undefined;
}

/**
 * @returns true 表示「这次调用应该打开 Olympia 首页，而不是上游的欢迎演练」。
 */
export function olympiaShouldInterceptWelcome(args: IOlympiaWelcomeArgs): boolean {
	return args.walkthroughID === undefined && args.optionsOrToSide === undefined;
}
