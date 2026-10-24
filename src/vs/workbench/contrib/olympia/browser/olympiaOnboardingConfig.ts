/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * 开始引导要展示的那几个配置项：**键名**与**默认值**的 core 侧副本。
 *
 * ## 为什么又是一个副本
 *
 * 真源在三个内置扩展的 `package.json` 里：
 *  - `oss/extensions/olympia-onboarding/package.json`（编译器 / 评测 / 训练 / 自检）
 *  - `oss/extensions/olympia-contest/package.json`（题面与模板）
 *
 * 扩展的 `package.json` 只有等扩展被扫描、贡献被注册之后，配置键才存在。
 * 开始引导在 `LifecyclePhase.Starting` 就把卡片建出来了 —— 那时候扩展还没扫描，
 * `configurationService.getValue('olympia.compiler.profile')` 只会得到 `undefined`。
 *
 * 所以卡片需要自己知道「这个键叫什么、默认值是多少」，才能在扩展还没就位时也把
 * **真实的**当前值显示出来，而不是编一个。
 *
 * ## 只抄 `olympia.*`，不抄 `editor.*`
 *
 * `editor.*` 是 core 自己的配置键，**任何时候**都能读到有效值（用户值或默认值），
 * 根本不需要抄。抄了反而要跟着上游的默认值走 —— 而上游 `editor.fontSize` 的默认值
 * 是分平台的（Windows 14 / macOS 12 / Linux 13），抄进 core 就会在别的平台上说错话。
 *
 * ## 为什么不会漂移
 *
 * `scripts/oneoff/check-olympia-start-page.mjs` 里有一条断言，把这里的默认值逐条
 * 与两个扩展 `package.json` 的 `contributes.configuration.properties` 做比对。
 * 扩展改了默认值而 core 没改，体检直接红。
 */

/** 评测机配置（`olympia-onboarding` 扩展）。 */
export const OLYMPIA_CONFIG_COMPILER_PROFILE = 'olympia.compiler.profile';
export const OLYMPIA_CONFIG_COMPILER_OPTIMIZATION = 'olympia.compiler.optimization';

/** 评测 / 训练（`olympia-onboarding` 扩展）。 */
export const OLYMPIA_CONFIG_JUDGE_MEMORY_LIMIT = 'olympia.judge.memoryLimitMb';
export const OLYMPIA_CONFIG_TRAIN_RECORD_SOLVES = 'olympia.train.recordSolves';
export const OLYMPIA_CONFIG_CHECK_ENABLED = 'olympia.check.enabled';

/** 题面与模板（`olympia-contest` 扩展）。 */
export const OLYMPIA_CONFIG_PROBLEMS_DIR = 'olympia.problem.problemsDir';
export const OLYMPIA_CONFIG_TEMPLATE_ON_PULL = 'olympia.problem.templateOnPull';
export const OLYMPIA_CONFIG_CPP_SNIPPETS = 'olympia.templates.cppSnippets';

/** 编辑器手感（core 自己的配置，键名来自上游，默认值由上游给，不抄）。 */
export const OLYMPIA_CONFIG_EDITOR_FONT_SIZE = 'editor.fontSize';
export const OLYMPIA_CONFIG_EDITOR_LINE_HEIGHT = 'editor.lineHeight';
export const OLYMPIA_CONFIG_EDITOR_FONT_FAMILY = 'editor.fontFamily';
export const OLYMPIA_CONFIG_EDITOR_MINIMAP = 'editor.minimap.enabled';
export const OLYMPIA_CONFIG_EDITOR_SMOOTH_CARET = 'editor.cursorSmoothCaretAnimation';

/**
 * `olympia.*` 这些键的默认值。取自两个扩展的 `package.json`，静态断言脚本会比对两边。
 *
 * `editor.*` 不在这里 —— 见上面的说明。
 */
export const OLYMPIA_ONBOARDING_CONFIG_DEFAULTS: Readonly<Record<string, unknown>> = {
	[OLYMPIA_CONFIG_COMPILER_PROFILE]: 'luogu',
	[OLYMPIA_CONFIG_COMPILER_OPTIMIZATION]: 'none',
	[OLYMPIA_CONFIG_JUDGE_MEMORY_LIMIT]: 0,
	[OLYMPIA_CONFIG_TRAIN_RECORD_SOLVES]: true,
	[OLYMPIA_CONFIG_CHECK_ENABLED]: true,
	[OLYMPIA_CONFIG_PROBLEMS_DIR]: '.olympia/problems',
	[OLYMPIA_CONFIG_TEMPLATE_ON_PULL]: false,
	[OLYMPIA_CONFIG_CPP_SNIPPETS]: true,
};

/**
 * `editor.*` 的兜底值。
 *
 * 只有在配置服务连这些键都读不到时才会用到（正常情况下读得到）。放在这里是为了
 * 「读不到也显示一个合理的数」，而不是显示 `undefined`。
 */
export const OLYMPIA_ONBOARDING_EDITOR_FALLBACKS: Readonly<Record<string, unknown>> = {
	[OLYMPIA_CONFIG_EDITOR_FONT_SIZE]: 14,
	[OLYMPIA_CONFIG_EDITOR_LINE_HEIGHT]: 0,
	[OLYMPIA_CONFIG_EDITOR_MINIMAP]: true,
	[OLYMPIA_CONFIG_EDITOR_SMOOTH_CARET]: 'off',
};
