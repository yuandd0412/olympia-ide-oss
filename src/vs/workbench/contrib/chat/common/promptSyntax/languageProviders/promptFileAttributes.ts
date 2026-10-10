/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { dirname } from '../../../../../../base/common/resources.js';
import { URI } from '../../../../../../base/common/uri.js';
import { localize } from '../../../../../../nls.js';
import { SpecedToolAliases } from '../../tools/languageModelToolsService.js';
import { CLAUDE_AGENTS_SOURCE_FOLDER, isInClaudeRulesFolder } from '../config/promptFileLocations.js';
import { PromptHeader, PromptHeaderAttributes } from '../promptFileParser.js';
import { PromptsType, Target } from '../promptTypes.js';

export namespace GithubPromptHeaderAttributes {
	export const mcpServers = 'mcp-servers';
	export const github = 'github';
}

export namespace ClaudeHeaderAttributes {
	export const disallowedTools = 'disallowedTools';
}

export function isTarget(value: unknown): value is Target {
	return value === Target.VSCode || value === Target.GitHubCopilot || value === Target.Claude || value === Target.Undefined;
}


interface IAttributeDefinition {
	readonly type: string;
	readonly description: string;
	readonly defaults?: readonly string[];
	readonly items?: readonly { name: string; description?: string }[];
	readonly enums?: readonly { name: string; description?: string }[];
}

const booleanAttributeEnumValues: readonly IValueEntry[] = [
	{ name: 'true' },
	{ name: 'false' }
];

const targetAttributeEnumValues: readonly IValueEntry[] = [
	{ name: 'vscode' },
	{ name: 'github-copilot' },
];

// Attribute metadata for prompt files (`*.prompt.md`).
export const promptFileAttributes: Record<string, IAttributeDefinition> = {
	[PromptHeaderAttributes.name]: {
		type: 'scalar',
		description: localize('promptHeader.prompt.name', "提示的名称。这也是将运行此提示的 / 命令的名称。"),
	},
	[PromptHeaderAttributes.description]: {
		type: 'scalar',
		description: localize('promptHeader.prompt.description', "有关可重用提示及其作用和使用时机的说明。"),
	},
	[PromptHeaderAttributes.argumentHint]: {
		type: 'scalar',
		description: localize('promptHeader.prompt.argumentHint', "参数提示描述提示期望或支持的输入。"),
	},
	[PromptHeaderAttributes.model]: {
		type: 'scalar | sequence',
		description: localize('promptHeader.prompt.model', "要在此提示中使用的模型。也可以是模型列表。将使用第一个可用模型。"),
	},
	[PromptHeaderAttributes.tools]: {
		type: 'scalar | sequence',
		description: localize('promptHeader.prompt.tools', "要在此提示中使用的工具。"),
		defaults: ['[]', '[\'search\', \'edit\', \'web\']'],
	},
	[PromptHeaderAttributes.agent]: {
		type: 'scalar',
		description: localize('promptHeader.prompt.agent.description', "运行此提示时要使用的智能体。"),
	},
	[PromptHeaderAttributes.mode]: {
		type: 'scalar',
		description: localize('promptHeader.prompt.agent.description', "运行此提示时要使用的智能体。"),
	},
};

// Attribute metadata for instructions files (`*.instructions.md`).
export const instructionAttributes: Record<string, IAttributeDefinition> = {
	[PromptHeaderAttributes.name]: {
		type: 'scalar',
		description: localize('promptHeader.instructions.name', "UI 中显示的指令文件的名称。如果未设置，则名称从文件名派生。"),
	},
	[PromptHeaderAttributes.description]: {
		type: 'scalar',
		description: localize('promptHeader.instructions.description', "指令文件的说明。它可用于提供有关指令的其他上下文或信息，并传递到语言模型作为提示的一部分。"),
	},
	[PromptHeaderAttributes.applyTo]: {
		type: 'scalar',
		description: localize('promptHeader.instructions.applyToRange', "一个或多个 glob 模式(用逗号分隔)，用于描述指令应用于哪些文件。根据这些模式，当上下文包含与其中一个或多个模式匹配的文件时，该文件会自动包含在提示中。如果希望始终添加此文件，请使用 `**`。\r\n示例: `**/*.ts`、`**/*.js`、`client/**`"),
		defaults: [
			'\'**\'',
			'\'**/*.ts, **/*.js\'',
			'\'**/*.php\'',
			'\'**/*.py\''
		],
	},
	[PromptHeaderAttributes.excludeAgent]: {
		type: 'scalar | sequence',
		description: localize('promptHeader.instructions.excludeAgent', "排除使用此指令文件的一个或多个智能体。"),
	},
};

// Attribute metadata for custom agent files (`*.agent.md`).
export const customAgentAttributes: Record<string, IAttributeDefinition> = {
	[PromptHeaderAttributes.name]: {
		type: 'scalar',
		description: localize('promptHeader.agent.name', "智能体在 UI 中显示的名称。"),
	},
	[PromptHeaderAttributes.description]: {
		type: 'scalar',
		description: localize('promptHeader.agent.description', "有关自定义智能体及其作用和使用时机的说明。"),
	},
	[PromptHeaderAttributes.argumentHint]: {
		type: 'scalar',
		description: localize('promptHeader.agent.argumentHint', "参数提示描述自定义智能体期望或支持的输入。"),
	},
	[PromptHeaderAttributes.model]: {
		type: 'scalar | sequence',
		description: localize('promptHeader.agent.model', "指定运行此自定义智能体的模型。也可以是模型列表。将使用第一个可用模型。"),
	},
	[PromptHeaderAttributes.reasoningEffort]: {
		type: 'scalar',
		description: localize('promptHeader.agent.reasoningEffort', 'Specify the reasoning effort used by this custom agent.'),
		enums: [
			{ name: 'low' },
			{ name: 'medium' },
			{ name: 'high' },
			{ name: 'xhigh' },
			{ name: 'max' },
		],
	},
	[PromptHeaderAttributes.tools]: {
		type: 'scalar | sequence',
		description: localize('promptHeader.agent.tools', "自定义智能体可访问的工具集。"),
		defaults: ['[]', '[search, edit, web]'],
	},
	[PromptHeaderAttributes.handOffs]: {
		type: 'sequence',
		description: localize('promptHeader.agent.handoffs', "智能体完成任务后可能的转接操作。"),
	},
	[PromptHeaderAttributes.target]: {
		type: 'scalar',
		description: localize('promptHeader.agent.target', "标头属性(如工具)应用的目标。可能的值为 `github-copilot` 和 `vscode`。"),
		enums: targetAttributeEnumValues,
	},
	[PromptHeaderAttributes.infer]: {
		type: 'scalar',
		description: localize('promptHeader.agent.infer', "控制智能体的可见性。"),
		enums: booleanAttributeEnumValues,
	},
	[PromptHeaderAttributes.agents]: {
		type: 'sequence',
		description: localize('promptHeader.agent.agents', "此智能体可用作子智能体的一个或多个智能体。使用 \"*\" 指定所有可用智能体。"),
		defaults: ['["*"]'],
	},
	[PromptHeaderAttributes.userInvocable]: {
		type: 'scalar',
		description: localize('promptHeader.agent.userInvocable', "用户是否可在 UI 中选择并调用该代理。"),
		enums: booleanAttributeEnumValues,
	},
	[PromptHeaderAttributes.disableModelInvocation]: {
		type: 'scalar',
		description: localize('promptHeader.agent.disableModelInvocation', "如果为 true，则阻止代理被作为子代理调用。"),
		enums: booleanAttributeEnumValues,
	},
	[PromptHeaderAttributes.advancedOptions]: {
		type: 'map',
		description: localize('promptHeader.agent.advancedOptions', "自定义智能体行为的高级选项。"),
	},
	[GithubPromptHeaderAttributes.github]: {
		type: 'map',
		description: localize('promptHeader.agent.github', "代理的 GitHub 特定配置，例如令牌权限。"),
	},
	[PromptHeaderAttributes.hooks]: {
		type: 'map',
		description: localize('promptHeader.agent.hooks', "作用于此智能体的生命周期挂钩。定义仅在此智能体激活时运行的挂钩。"),
	},
};

// Attribute metadata for skill files (`SKILL.md`).
export const skillAttributes: Record<string, IAttributeDefinition> = {
	[PromptHeaderAttributes.name]: {
		type: 'scalar',
		description: localize('promptHeader.skill.name', "技能的名称。"),
	},
	[PromptHeaderAttributes.description]: {
		type: 'scalar',
		description: localize('promptHeader.skill.description', "技能的说明。描述将添加到每个请求中，智能体将使用它来决定何时加载技能。"),
	},
	[PromptHeaderAttributes.argumentHint]: {
		type: 'scalar',
		description: localize('promptHeader.skill.argumentHint', "自动完成时显示的提示，用于指示预期的参数。例如: [issue-number] 或 [filename] [format]"),
	},
	[PromptHeaderAttributes.userInvocable]: {
		type: 'scalar',
		description: localize('promptHeader.skill.userInvocable', "设置为 false 可在 / 菜单中隐藏。用于不应由用户直接调用的后台知识。默认值: true。"),
		enums: booleanAttributeEnumValues,
	},
	[PromptHeaderAttributes.disableModelInvocation]: {
		type: 'scalar',
		description: localize('promptHeader.skill.disableModelInvocation', "设置为 true 可防止代理自动加载此技能。用于你想要通过 /name 手动触发的工作流。默认值: false。"),
		enums: booleanAttributeEnumValues,
	},
	[PromptHeaderAttributes.license]: {
		type: 'scalar | map',
		description: localize('promptHeader.skill.license', "技能的许可证信息。"),
	},
	[PromptHeaderAttributes.compatibility]: {
		type: 'scalar | map',
		description: localize('promptHeader.skill.compatibility', "环境或运行时的兼容性元数据。"),
	},
	[PromptHeaderAttributes.metadata]: {
		type: 'map',
		description: localize('promptHeader.skill.metadata', "技能的附加元数据。"),
	},
	[PromptHeaderAttributes.context]: {
		type: 'scalar',
		description: localize('promptHeader.skill.context', "控制技能的加载方式。设置为 \"fork\" 以生成包含技能指令的子智能体，而非内联返回指令。"),
		enums: [{ name: 'fork', description: localize('promptHeader.skill.context.fork', "生成一个子智能体，并将技能指令作为系统上下文注入。") }],
	},
};

const allAttributeNames: Record<PromptsType, string[]> = {
	[PromptsType.prompt]: Object.keys(promptFileAttributes),
	[PromptsType.instructions]: Object.keys(instructionAttributes),
	[PromptsType.agent]: Object.keys(customAgentAttributes),
	[PromptsType.skill]: Object.keys(skillAttributes),
	[PromptsType.hook]: [], // hooks are JSON files, not markdown with YAML frontmatter
};
const githubCopilotAgentAttributeNames = [PromptHeaderAttributes.name, PromptHeaderAttributes.description, PromptHeaderAttributes.tools, PromptHeaderAttributes.target, GithubPromptHeaderAttributes.mcpServers, GithubPromptHeaderAttributes.github, PromptHeaderAttributes.infer];
const recommendedAttributeNames: Record<PromptsType, string[]> = {
	[PromptsType.prompt]: allAttributeNames[PromptsType.prompt].filter(name => !isNonRecommendedAttribute(name)),
	[PromptsType.instructions]: allAttributeNames[PromptsType.instructions].filter(name => !isNonRecommendedAttribute(name)),
	[PromptsType.agent]: allAttributeNames[PromptsType.agent].filter(name => !isNonRecommendedAttribute(name)),
	[PromptsType.skill]: allAttributeNames[PromptsType.skill].filter(name => !isNonRecommendedAttribute(name)),
	[PromptsType.hook]: [], // hooks are JSON files, not markdown with YAML frontmatter
};

export function getValidAttributeNames(promptType: PromptsType, includeNonRecommended: boolean, target: Target): string[] {
	if (target === Target.Claude) {
		if (promptType === PromptsType.instructions) {
			return Object.keys(claudeRulesAttributes);
		}
		return Object.keys(claudeAgentAttributes);
	} else if (target === Target.GitHubCopilot) {
		if (promptType === PromptsType.agent) {
			return githubCopilotAgentAttributeNames;
		}
	}
	return includeNonRecommended ? allAttributeNames[promptType] : recommendedAttributeNames[promptType];
}

export function isNonRecommendedAttribute(attributeName: string): boolean {
	return attributeName === PromptHeaderAttributes.advancedOptions || attributeName === PromptHeaderAttributes.excludeAgent || attributeName === PromptHeaderAttributes.mode || attributeName === PromptHeaderAttributes.infer;
}

export function getAttributeDefinition(attributeName: string, promptType: PromptsType, target: Target): IAttributeDefinition | undefined {
	switch (promptType) {
		case PromptsType.instructions:
			if (target === Target.Claude) {
				return claudeRulesAttributes[attributeName];
			}
			return instructionAttributes[attributeName];
		case PromptsType.skill:
			return skillAttributes[attributeName];
		case PromptsType.agent:
			if (target === Target.Claude) {
				return claudeAgentAttributes[attributeName];
			}
			return customAgentAttributes[attributeName];
		case PromptsType.prompt:
			return promptFileAttributes[attributeName];
		default:
			return undefined;
	}
}

// The list of tools known to be used by GitHub Copilot custom agents
export const knownGithubCopilotTools = [
	{ name: SpecedToolAliases.execute, description: localize('githubCopilot.execute', "执行命令") },
	{ name: SpecedToolAliases.read, description: localize('githubCopilot.read', "读取文件") },
	{ name: SpecedToolAliases.edit, description: localize('githubCopilot.edit', "正在编辑文件") },
	{ name: SpecedToolAliases.search, description: localize('githubCopilot.search', "搜索文件") },
	{ name: SpecedToolAliases.agent, description: localize('githubCopilot.agent', "使用子智能体") },
];

export interface IValueEntry {
	readonly name: string;
	readonly description?: string;
}

export const knownClaudeTools = [
	{ name: 'Bash', description: localize('claude.bash', "执行 shell 命令"), toolEquivalent: [SpecedToolAliases.execute] },
	{ name: 'Edit', description: localize('claude.edit', "进行目标文件编辑"), toolEquivalent: ['edit/editNotebook', 'edit/editFiles'] },
	{ name: 'Glob', description: localize('claude.glob', "按模式查找文件"), toolEquivalent: ['search/fileSearch'] },
	{ name: 'Grep', description: localize('claude.grep', "使用正则表达式搜索文件内容"), toolEquivalent: ['search/textSearch'] },
	{ name: 'Read', description: localize('claude.read', "读取文件内容"), toolEquivalent: ['read/readFile', 'read/getNotebookSummary'] },
	{ name: 'Write', description: localize('claude.write', "创建/覆盖文件"), toolEquivalent: ['edit/createDirectory', 'edit/createFile', 'edit/createJupyterNotebook'] },
	{ name: 'WebFetch', description: localize('claude.webFetch', "提取 URL 内容"), toolEquivalent: [SpecedToolAliases.web] },
	{ name: 'WebSearch', description: localize('claude.webSearch', "执行 Web 搜索"), toolEquivalent: [SpecedToolAliases.web] },
	{ name: 'Task', description: localize('claude.task', "运行子智能体处理复杂任务"), toolEquivalent: [SpecedToolAliases.agent] },
	{ name: 'Skill', description: localize('claude.skill', "执行技能"), toolEquivalent: [] },
	{ name: 'LSP', description: localize('claude.lsp', "代码智能(需要插件)"), toolEquivalent: [] },
	{ name: 'NotebookEdit', description: localize('claude.notebookEdit', "修改 Jupyter 笔记本"), toolEquivalent: ['edit/editNotebook'] },
	{ name: 'AskUserQuestion', description: localize('claude.askUserQuestion', "提出多选问题"), toolEquivalent: ['vscode/askQuestions'] },
	{ name: 'MCPSearch', description: localize('claude.mcpSearch', "启用工具搜索时搜索 MCP 工具"), toolEquivalent: [] }
];

export const knownClaudeModels = [
	{ name: 'sonnet', description: localize('claude.sonnet', "最新版 Claude Sonnet"), modelEquivalent: 'Claude Sonnet 4.5 (copilot)' },
	{ name: 'opus', description: localize('claude.opus', "最新版 Claude Opus"), modelEquivalent: 'Claude Opus 4.6 (copilot)' },
	{ name: 'haiku', description: localize('claude.haiku', "最新版 Claude Haiku，可快速处理简单任务"), modelEquivalent: 'Claude Haiku 4.5 (copilot)' },
	{ name: 'inherit', description: localize('claude.inherit', "从父智能体或提示继承模型"), modelEquivalent: undefined },
];

export function mapClaudeModels(claudeModelNames: readonly string[]): readonly string[] {
	const result = [];
	for (const name of claudeModelNames) {
		const claudeModel = knownClaudeModels.find(model => model.name === name);
		if (claudeModel && claudeModel.modelEquivalent) {
			result.push(claudeModel.modelEquivalent);
		}
	}
	return result;
}

/**
 * Maps Claude tool names to their VS Code tool equivalents.
 */
export function mapClaudeTools(claudeToolNames: readonly string[]): string[] {
	const result: string[] = [];
	for (const name of claudeToolNames) {
		const claudeTool = knownClaudeTools.find(tool => tool.name === name);
		if (claudeTool) {
			result.push(...claudeTool.toolEquivalent);
		}
	}
	return result;
}

export const claudeAgentAttributes: Record<string, IAttributeDefinition> = {
	'name': {
		type: 'scalar',
		description: localize('attribute.name', "使用小写字母和连字符的唯一标识符(必填)"),
	},
	'description': {
		type: 'scalar',
		description: localize('attribute.description', "委托给此子智能体时(必需)"),
	},
	'tools': {
		type: 'sequence',
		description: localize('attribute.tools', "子智能体可使用的工具数组。若省略，则继承所有工具"),
		defaults: ['Read, Edit, Bash'],
		items: knownClaudeTools
	},
	'disallowedTools': {
		type: 'sequence',
		description: localize('attribute.disallowedTools', "需拒绝的工具，从继承或指定的列表中移除"),
		defaults: ['Write, Edit, Bash'],
		items: knownClaudeTools
	},
	'model': {
		type: 'scalar',
		description: localize('attribute.model', "使用的模型: sonnet、opus、haiku 或 inherit。默认继承。"),
		defaults: ['sonnet', 'opus', 'haiku', 'inherit'],
		enums: knownClaudeModels
	},
	'permissionMode': {
		type: 'scalar',
		description: localize('attribute.permissionMode', "权限模式: default、acceptEdits、dontAsk、bypassPermissions 或 plan。"),
		defaults: ['default', 'acceptEdits', 'dontAsk', 'bypassPermissions', 'plan'],
		enums: [
			{ name: 'default', description: localize('claude.permissionMode.default', "标准行为: 首次使用每个工具时会提示获取权限。") },
			{ name: 'acceptEdits', description: localize('claude.permissionMode.acceptEdits', "自动接受会话的文件编辑权限。") },
			{ name: 'plan', description: localize('claude.permissionMode.plan', "计划模式: Claude 可进行分析，但无法修改文件或执行命令。") },
			{ name: 'delegate', description: localize('claude.permissionMode.delegate', "智能体团队负责人的纯协调模式。仅在智能体团队处于激活状态时可用。") },
			{ name: 'dontAsk', description: localize('claude.permissionMode.dontAsk', "除非通过 /permissions 或 permissions.allow 规则预先批准，否则会自动拒绝工具。") },
			{ name: 'bypassPermissions', description: localize('claude.permissionMode.bypassPermissions', "跳过所有权限提示(需要安全环境，例如容器)。") }
		]
	},
	'skills': {
		type: 'sequence',
		description: localize('attribute.skills', "启动时加载到子智能体上下文的技能。"),
	},
	'mcpServers': {
		type: 'sequence',
		description: localize('attribute.mcpServers', "此子智能体可用的 MCP 服务器。"),
	},
	'hooks': {
		type: 'object',
		description: localize('attribute.hooks', "作用于此子智能体的生命周期挂钩。"),
	},
	'memory': {
		type: 'scalar',
		description: localize('attribute.memory', "持久化内存范围: 用户、项目或本地。启用跨会话学习。"),
		defaults: ['user', 'project', 'local'],
		enums: [
			{ name: 'user', description: localize('claude.memory.user', "跨所有项目保存学习记录。") },
			{ name: 'project', description: localize('claude.memory.project', "子智能体的知识特定于项目，可通过版本控制进行共享。") },
			{ name: 'local', description: localize('claude.memory.local', "子智能体的知识特定于项目，但不应提交至版本控制。") }
		]
	}
};

/**
 * Attributes supported in Claude rules files (`.claude/rules/*.md`).
 * Claude rules use `paths` instead of `applyTo` for glob patterns.
 */
export const claudeRulesAttributes: Record<string, IAttributeDefinition> = {
	'description': {
		type: 'scalar',
		description: localize('attribute.rules.description', "此规则适用范围的描述，用于提供规则应用的上下文。"),
	},
	'paths': {
		type: 'sequence',
		description: localize('attribute.rules.paths', "描述此规则适用文件的 glob 模式数组。基于这些模式，当上下文中包含匹配的文件时，该文件将自动加入提示中。\r\n示例: `['src/**/*.ts', 'test/**']`"),
	},
};

export function isVSCodeOrDefaultTarget(target: Target): boolean {
	return target === Target.VSCode || target === Target.Undefined;
}

export function getTarget(promptType: PromptsType, header: PromptHeader | URI): Target {
	const uri = header instanceof URI ? header : header.uri;
	if (promptType === PromptsType.agent) {
		const parentDir = dirname(uri);
		if (parentDir.path.endsWith(`/${CLAUDE_AGENTS_SOURCE_FOLDER}`)) {
			return Target.Claude;
		}
		if (!(header instanceof URI)) {
			const target = header.target;
			if (target === Target.GitHubCopilot || target === Target.VSCode) {
				return target;
			}
		}
		return Target.Undefined;
	} else if (promptType === PromptsType.instructions) {
		if (isInClaudeRulesFolder(uri)) {
			return Target.Claude;
		}
	}
	return Target.Undefined;
}
