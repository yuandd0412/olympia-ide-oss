/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../../nls.js';
import { Target } from './promptTypes.js';

/**
 * Enum of hook types across all targets. For the set of supported hooks per target, see HOOKS_BY_TARGET.
 */
export enum HookType {
	SessionStart = 'SessionStart',
	SessionEnd = 'SessionEnd',
	UserPromptSubmit = 'UserPromptSubmit',
	PreToolUse = 'PreToolUse',
	PostToolUse = 'PostToolUse',
	PreCompact = 'PreCompact',
	SubagentStart = 'SubagentStart',
	SubagentStop = 'SubagentStop',
	Stop = 'Stop',
	ErrorOccurred = 'ErrorOccurred',
}

/**
 * String literal type derived from HookType enum values.
 */
export type HookTypeValue = `${HookType}`;

export const HOOKS_BY_TARGET: Record<Target, Record<string, HookType>> = {
	// see https://code.visualstudio.com/docs/copilot/customization/hooks#_hook-lifecycle-events
	[Target.VSCode]: {
		'SessionStart': HookType.SessionStart,
		'UserPromptSubmit': HookType.UserPromptSubmit,
		'PreToolUse': HookType.PreToolUse,
		'PostToolUse': HookType.PostToolUse,
		'PreCompact': HookType.PreCompact,
		'SubagentStart': HookType.SubagentStart,
		'SubagentStop': HookType.SubagentStop,
		'Stop': HookType.Stop,
	},
	// see https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-hooks#types-of-hooks
	[Target.GitHubCopilot]: {
		'sessionStart': HookType.SessionStart,
		'sessionEnd': HookType.SessionEnd,
		'userPromptSubmitted': HookType.UserPromptSubmit,
		'preToolUse': HookType.PreToolUse,
		'postToolUse': HookType.PostToolUse,
		'agentStop': HookType.Stop,
		'subagentStop': HookType.SubagentStop,
		'errorOccurred': HookType.ErrorOccurred
	},
	// see https://docs.anthropic.com/en/docs/claude-code/hooks
	[Target.Claude]: {
		'SessionStart': HookType.SessionStart,
		'UserPromptSubmit': HookType.UserPromptSubmit,
		'PreToolUse': HookType.PreToolUse,
		'PostToolUse': HookType.PostToolUse,
		'PreCompact': HookType.PreCompact,
		'SubagentStart': HookType.SubagentStart,
		'SubagentStop': HookType.SubagentStop,
		'Stop': HookType.Stop,
	},
	// if no target, just list all known hook types.
	[Target.Undefined]: Object.fromEntries(
		Object.values(HookType).map(h => [h, h])
	) as Record<string, HookType>
};

/**
 * Metadata for a hook type including localized label and description.
 */
export interface IHookTypeMeta {
	readonly label: string;
	readonly description: string;
}

/**
 * Metadata for hook types including localized labels and descriptions
 */
export const HOOK_METADATA: { [key in HookType]: IHookTypeMeta } = {
	[HookType.SessionStart]: {
		label: nls.localize('hookType.sessionStart.label', "会话开始"),
		description: nls.localize('hookType.sessionStart.description', "新的智能体会话开始时执行。")
	},
	[HookType.UserPromptSubmit]: {
		label: nls.localize('hookType.userPromptSubmit.label', "用户提示提交"),
		description: nls.localize('hookType.userPromptSubmit.description', "当你向智能体提交提示时执行。")
	},
	[HookType.PreToolUse]: {
		label: nls.localize('hookType.preToolUse.label', "工具使用前"),
		description: nls.localize('hookType.preToolUse.description', "智能体使用任何工具前执行。")
	},
	[HookType.PostToolUse]: {
		label: nls.localize('hookType.postToolUse.label', "工具使用后"),
		description: nls.localize('hookType.postToolUse.description', "工具成功完成执行后执行。")
	},
	[HookType.PreCompact]: {
		label: nls.localize('hookType.preCompact.label', "预压缩"),
		description: nls.localize('hookType.preCompact.description', "智能体压缩对话上下文之前执行。")
	},
	[HookType.SubagentStart]: {
		label: nls.localize('hookType.subagentStart.label', "子智能体启动"),
		description: nls.localize('hookType.subagentStart.description', "子智能体启动时执行。")
	},
	[HookType.SubagentStop]: {
		label: nls.localize('hookType.subagentStop.label', "子智能体停止"),
		description: nls.localize('hookType.subagentStop.description', "子智能体停止时执行。")
	},
	[HookType.Stop]: {
		label: nls.localize('hookType.stop.label', "停止"),
		description: nls.localize('hookType.stop.description', "当智能体停止时执行。")
	},
	[HookType.SessionEnd]: {
		label: nls.localize('hookType.sessionEnd.label', "会话结束"),
		description: nls.localize('hookType.sessionEnd.description', "智能体会话结束时执行。")
	},
	[HookType.ErrorOccurred]: {
		label: nls.localize('hookType.errorOccurred.label', "出错了"),
		description: nls.localize('hookType.errorOccurred.description', "智能体会话期间发生错误时执行。")
	}
};
