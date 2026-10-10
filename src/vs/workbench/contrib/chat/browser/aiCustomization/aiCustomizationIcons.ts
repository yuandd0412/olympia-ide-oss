/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize } from '../../../../../nls.js';
import { registerIcon } from '../../../../../platform/theme/common/iconRegistry.js';
import { type AICustomizationSource, AICustomizationSources } from '../../common/aiCustomizationWorkspaceService.js';

/**
 * Icon for the AI Customization view container (sidebar).
 */
export const aiCustomizationViewIcon = registerIcon('ai-customization-view-icon', Codicon.sparkle, localize('aiCustomizationViewIcon', "智能体自定义视图图标。"));

/**
 * Icon for custom agents.
 */
export const agentIcon = registerIcon('ai-customization-agent', Codicon.agent, localize('aiCustomizationAgentIcon', "自定义智能体的图标。"));

/**
 * Icon for skills.
 */
export const skillIcon = registerIcon('ai-customization-skill', Codicon.lightbulb, localize('aiCustomizationSkillIcon', "技能图标。"));

/**
 * Icon for instructions.
 */
export const instructionsIcon = registerIcon('ai-customization-instructions', Codicon.book, localize('aiCustomizationInstructionsIcon', "指令文件的图标。"));

/**
 * Icon for prompts.
 */
export const promptIcon = registerIcon('ai-customization-prompt', Codicon.bookmark, localize('aiCustomizationPromptIcon', "提示文件的图标。"));

/**
 * Icon for hooks.
 */
export const hookIcon = registerIcon('ai-customization-hook', Codicon.zap, localize('aiCustomizationHookIcon', "挂钩的图标。"));

/**
 * Icon for adding a new item.
 */
export const addIcon = registerIcon('ai-customization-add', Codicon.add, localize('aiCustomizationAddIcon', "添加新项目的图标。"));

/**
 * Icon for the run action.
 */
export const runIcon = registerIcon('ai-customization-run', Codicon.play, localize('aiCustomizationRunIcon', "运行提示或智能体的图标。"));

/**
 * Icon for workspace storage.
 */
export const workspaceIcon = registerIcon('ai-customization-workspace', Codicon.folder, localize('aiCustomizationWorkspaceIcon', "工作区项图标。"));

/**
 * Icon for user storage.
 */
export const userIcon = registerIcon('ai-customization-user', Codicon.account, localize('aiCustomizationUserIcon', "用户项的图标。"));

/**
 * Icon for extension storage.
 */
export const extensionIcon = registerIcon('ai-customization-extension', Codicon.extensions, localize('aiCustomizationExtensionIcon', "扩展贡献项图标。"));

/**
 * Icon for plugin storage.
 */
export const pluginIcon = registerIcon('ai-customization-plugin', Codicon.plug, localize('aiCustomizationPluginIcon', "插件贡献项的图标。"));

/**
 * Icon for the Tools section in the AI Customization Management Editor.
 */
export const toolsIcon = registerIcon('ai-customization-tools', Codicon.tools, localize('aiCustomizationToolsIcon', "“工具”部分的图标。"));

/**
 * Icon for built-in storage.
 */
export const builtinIcon = registerIcon('ai-customization-builtin', Codicon.starFull, localize('aiCustomizationBuiltinIcon', "内置项目图标。"));

/**
 * Icon for MCP servers.
 */
export const mcpServerIcon = registerIcon('ai-customization-mcp-server', Codicon.server, localize('aiCustomizationMcpServerIcon', "MCP 服务器图标。"));

/**
 * Returns the icon for a given storage type.
 */
export function sourceToIcon(source: AICustomizationSource): ThemeIcon {
	switch (source) {
		case AICustomizationSources.local: return workspaceIcon;
		case AICustomizationSources.user: return userIcon;
		case AICustomizationSources.extension: return extensionIcon;
		case AICustomizationSources.plugin: return pluginIcon;
		case AICustomizationSources.builtin: return builtinIcon;
		default: return instructionsIcon;
	}
}
