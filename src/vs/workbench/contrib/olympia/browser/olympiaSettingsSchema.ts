/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';

/**
 * Olympia 简化设置页的控件类型。
 *
 * - `boolean` → 开关
 * - `string`  → 单行文本
 * - `number`  → 数字（带 min/max）
 * - `enum`    → 固定选项下拉
 * - `array`   → 字符串数组，用逗号分隔的文本框编辑
 * - `theme`   → 主题下拉，选项在运行时从主题服务取（不是固定枚举）
 * - `font`    → 字体下拉，选项在运行时从**本机真实安装的字体**取（不是硬编码清单）
 */
export type OlympiaSettingControlType = 'boolean' | 'string' | 'number' | 'enum' | 'array' | 'theme' | 'font';

export interface IOlympiaSettingControl {
	/** 真实的 configuration key。必须能在内置扩展 package.json 或上游配置里找到定义。 */
	readonly key: string;
	readonly type: OlympiaSettingControlType;
	readonly label: string;
	readonly description?: string;
	/** `enum` 类型的固定选项。 */
	readonly enumValues?: readonly { readonly value: string; readonly label: string }[];
	readonly min?: number;
	readonly max?: number;
	readonly placeholder?: string;
	/** 标记为「高级」的控件，默认折叠在高级区。 */
	readonly advanced?: boolean;
}

export interface IOlympiaSettingGroup {
	readonly id: string;
	readonly title: string;
	readonly controls: readonly IOlympiaSettingControl[];
}

/**
 * 打开 Olympia 简化设置页的命令 id。
 *
 * 劫持点（`contrib/preferences/browser/preferences.contribution.ts` 里的
 * `workbench.action.openSettings`）在**没有** query / focusSearch / openToSide / revealSetting
 * 时会执行这个命令，把用户带到本页；带搜索词的深层跳转仍然走原生设置页。
 */
export const OLYMPIA_SETTINGS_COMMAND_ID = 'olympia.openSettings';

/**
 * 简化设置页的分组与控件声明表。
 *
 * ## 为什么不自动生成
 *
 * 上游有几千个配置项，全塞进来就等于原生设置页 —— 那还不如不做。这个表是**人工挑选**的
 * 高频项：一个 OI 选手日常会改的东西。
 *
 * 挑选依据有两条：
 *  1. 我们三个自研扩展已经贡献的 `olympia.*` 配置项（编译 / 评测 / 对拍 / 题面 / AI / 模板）
 *     —— 这些是本产品**独有**的，原生设置页里只是平铺在几十个扩展节点下，找都找不到。
 *  2. 上游里与写代码体验直接相关的那几个（主题 / 字体 / 字号 / 自动保存 / 自动格式化 / 缩进）。
 *
 * `check-olympia-settings-page.mjs` 会逐条断言这里的每个 key 都有**真实定义**，
 * 防止写了半天最后写到一个不存在的键上（那是静默失败：设置改了但没生效）。
 */
export const OLYMPIA_SETTINGS_GROUPS: readonly IOlympiaSettingGroup[] = [

	{
		id: 'appearance',
		title: localize('olympiaSettings.appearance', "外观"),
		controls: [
			{
				key: 'workbench.colorTheme',
				type: 'theme',
				label: localize('olympiaSettings.workbench.colorTheme', "配色主题"),
				description: localize('olympiaSettings.workbench.colorTheme.desc', "切换工作台与编辑器的配色。")
			},
			{
				key: 'editor.fontFamily',
				type: 'font',
				label: localize('olympiaSettings.editor.fontFamily', "编辑器字体"),
				description: localize('olympiaSettings.editor.fontFamily.desc', "下拉里是本机真实装了的字体。也可以在下面直接写字体栈（例如 Consolas, monospace）；留空或选「系统默认」都表示恢复默认。")
			},
			{
				key: 'editor.fontSize',
				type: 'number',
				min: 8,
				max: 40,
				label: localize('olympiaSettings.editor.fontSize', "字号")
			},
			{
				key: 'editor.fontLigatures',
				type: 'boolean',
				label: localize('olympiaSettings.editor.fontLigatures', "连字（Ligatures）"),
				description: localize('olympiaSettings.editor.fontLigatures.desc', "需要编辑器字体本身支持连字。")
			},
			{
				key: 'editor.minimap.enabled',
				type: 'boolean',
				label: localize('olympiaSettings.editor.minimap.enabled', "代码缩略图")
			}
		]
	},

	{
		id: 'editor',
		title: localize('olympiaSettings.editor', "编辑器"),
		controls: [
			{
				key: 'editor.formatOnSave',
				type: 'boolean',
				label: localize('olympiaSettings.editor.formatOnSave', "保存时自动格式化"),
				description: localize('olympiaSettings.editor.formatOnSave.desc', "需要已配置格式化程序。")
			},
			{
				key: 'editor.tabSize',
				type: 'number',
				min: 1,
				max: 16,
				label: localize('olympiaSettings.editor.tabSize', "缩进宽度")
			},
			{
				key: 'editor.insertSpaces',
				type: 'boolean',
				label: localize('olympiaSettings.editor.insertSpaces', "用空格缩进")
			},
			{
				key: 'files.autoSave',
				type: 'enum',
				label: localize('olympiaSettings.files.autoSave', "自动保存"),
				enumValues: [
					{ value: 'off', label: localize('olympiaSettings.files.autoSave.off', "关闭") },
					{ value: 'afterDelay', label: localize('olympiaSettings.files.autoSave.afterDelay', "延迟后自动保存") },
					{ value: 'onFocus', label: localize('olympiaSettings.files.autoSave.onFocus', "失去焦点时保存") },
					{ value: 'onWindowChange', label: localize('olympiaSettings.files.autoSave.onWindowChange', "窗口切换时保存") }
				]
			}
		]
	},

	{
		id: 'compiler',
		title: localize('olympiaSettings.compiler', "编译"),
		controls: [
			{
				key: 'olympia.compiler.profile',
				type: 'enum',
				label: localize('olympiaSettings.compiler.profile', "评测机编译配置"),
				description: localize('olympiaSettings.compiler.profile.desc', "洛谷 / NOI / 自定义。切换后按对应评测机的标准编译。"),
				enumValues: [
					{ value: 'luogu', label: localize('olympiaSettings.compiler.profile.luogu', "洛谷") },
					{ value: 'noi', label: localize('olympiaSettings.compiler.profile.noi', "NOI") },
					{ value: 'custom', label: localize('olympiaSettings.compiler.profile.custom', "自定义") }
				]
			},
			{
				key: 'olympia.compiler.optimization',
				type: 'enum',
				label: localize('olympiaSettings.compiler.optimization', "优化等级"),
				enumValues: [
					{ value: 'none', label: localize('olympiaSettings.compiler.optimization.none', "不加优化") },
					{ value: '-O2', label: '-O2' },
					{ value: '-O3', label: '-O3' }
				]
			},
			{
				key: 'olympia.compiler.path',
				type: 'string',
				label: localize('olympiaSettings.compiler.path', "编译器路径"),
				description: localize('olympiaSettings.compiler.path.desc', "留空则使用内置工具链。"),
				placeholder: localize('olympiaSettings.compiler.path.placeholder', "内置 MinGW")
			},
			{
				key: 'olympia.compiler.customFlags',
				type: 'string',
				label: localize('olympiaSettings.compiler.customFlags', "附加编译参数"),
				placeholder: localize('olympiaSettings.compiler.customFlags.placeholder', "例如：-Wall -Wextra")
			},
			{
				key: 'olympia.compiler.showCompileCommand',
				type: 'boolean',
				label: localize('olympiaSettings.compiler.showCompileCommand', "显示完整编译命令")
			}
		]
	},

	{
		id: 'judge',
		title: localize('olympiaSettings.judge', "评测"),
		controls: [
			{
				key: 'olympia.judge.memoryLimitMb',
				type: 'number',
				min: 0,
				max: 4096,
				label: localize('olympiaSettings.judge.memoryLimitMb', "内存上限 (MB)"),
				description: localize('olympiaSettings.judge.memoryLimitMb.desc', "0 表示沿用评测机默认值。")
			},
			{
				key: 'olympia.check.enabled',
				type: 'boolean',
				label: localize('olympiaSettings.check.enabled', "提交前体检"),
				description: localize('olympiaSettings.check.enabled.desc', "提交到 OJ 前自动检查常见问题。")
			},
			{
				key: 'olympia.check.onSave',
				type: 'boolean',
				label: localize('olympiaSettings.check.onSave', "保存时体检")
			},
			{
				key: 'olympia.check.onBlockDone',
				type: 'boolean',
				label: localize('olympiaSettings.check.onBlockDone', "代码块完成时体检")
			},
			{
				key: 'olympia.train.recordSolves',
				type: 'boolean',
				label: localize('olympiaSettings.train.recordSolves', "记录解题记录")
			}
		]
	},

	{
		id: 'stress',
		title: localize('olympiaSettings.stress', "对拍"),
		controls: [
			{
				key: 'olympia.stress.rounds',
				type: 'number',
				min: 1,
				max: 10000,
				label: localize('olympiaSettings.stress.rounds', "对拍轮数")
			},
			{
				key: 'olympia.stress.timeoutMs',
				type: 'number',
				min: 100,
				max: 600000,
				label: localize('olympiaSettings.stress.timeoutMs', "单次超时 (ms)")
			},
			{
				key: 'olympia.debug.showEntryPoints',
				type: 'boolean',
				label: localize('olympiaSettings.debug.showEntryPoints', "显示程序入口点")
			}
		]
	},

	{
		id: 'problem',
		title: localize('olympiaSettings.problem', "题面"),
		controls: [
			{
				key: 'olympia.problem.problemsDir',
				type: 'string',
				label: localize('olympiaSettings.problem.problemsDir', "题面目录"),
				description: localize('olympiaSettings.problem.problemsDir.desc', "相对工作区根目录。")
			},
			{
				key: 'olympia.problem.templateOnPull',
				type: 'boolean',
				label: localize('olympiaSettings.problem.templateOnPull', "拉取题面时自动插入模板")
			},
			{
				key: 'olympia.problem.requestTimeoutMs',
				type: 'number',
				min: 1000,
				max: 120000,
				label: localize('olympiaSettings.problem.requestTimeoutMs', "题面请求超时 (ms)")
			},
			{
				key: 'olympia.problem.cfMetadata',
				type: 'boolean',
				label: localize('olympiaSettings.problem.cfMetadata', "拉取 Codeforces 元数据"),
				description: localize('olympiaSettings.problem.cfMetadata.desc', "会向 Codeforces 发起请求。")
			}
		]
	},

	{
		id: 'ai',
		title: localize('olympiaSettings.ai', "AI 教练"),
		controls: [
			{
				key: 'olympia.ai.baseUrl',
				type: 'string',
				label: localize('olympiaSettings.ai.baseUrl', "接口地址"),
				placeholder: localize('olympiaSettings.ai.baseUrl.placeholder', "留空则不启用 AI 教练")
			},
			{
				key: 'olympia.ai.models',
				type: 'array',
				label: localize('olympiaSettings.ai.models', "模型列表"),
				description: localize('olympiaSettings.ai.models.desc', "多个模型用英文逗号分隔。")
			}
		]
	},

	{
		id: 'templates',
		title: localize('olympiaSettings.templates', "模板"),
		controls: [
			{
				key: 'olympia.templates.cppSnippets',
				type: 'boolean',
				label: localize('olympiaSettings.templates.cppSnippets', "C++ 代码片段"),
				description: localize('olympiaSettings.templates.cppSnippets.desc', "输入特定缩写时展开成常用模板。")
			}
		]
	},

	{
		id: 'advanced',
		title: localize('olympiaSettings.advanced', "高级"),
		controls: [
			{
				key: 'olympia.check.rules.pragmaOptimize',
				type: 'boolean',
				label: localize('olympiaSettings.check.rules.pragmaOptimize', "体检：#pragma optimize"),
				advanced: true
			},
			{
				key: 'olympia.check.rules.reservedWord',
				type: 'boolean',
				label: localize('olympiaSettings.check.rules.reservedWord', "体检：保留字"),
				advanced: true
			},
			{
				key: 'olympia.check.rules.removedCpp',
				type: 'boolean',
				label: localize('olympiaSettings.check.rules.removedCpp', "体检：已移除的 C++ 特性"),
				advanced: true
			}
		]
	}
];

/** 页面上所有控件的扁平列表（跨分组）。 */
export function olympiaSettingControls(): readonly IOlympiaSettingControl[] {
	return OLYMPIA_SETTINGS_GROUPS.flatMap(g => g.controls);
}

/** 按 configuration key 找控件。 */
export function olympiaSettingControlByKey(key: string): IOlympiaSettingControl | undefined {
	return olympiaSettingControls().find(c => c.key === key);
}
