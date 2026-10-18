/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { localize } from '../../../../nls.js';
import { ContextKeyExpr, ContextKeyExpression } from '../../../../platform/contextkey/common/contextkey.js';
import { IsWebContext } from '../../../../platform/contextkey/common/contextkeys.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { ChatConfiguration, ChatModeKind, OPEN_AGENTS_WINDOW_COMMAND_ID, OPEN_AGENTS_WINDOW_PRECONDITION, OPEN_WORKSPACE_IN_AGENTS_WINDOW_COMMAND_ID } from '../common/constants.js';
import { ChatContextKeys } from '../common/actions/chatContextKeys.js';
import { IsSessionsWindowContext } from '../../../common/contextkeys.js';
import { localChatSessionType } from '../common/chatSessionsService.js';
import { ITipExclusionConfig } from './chatTipEligibilityTracker.js';
import { TipTrackingCommands } from './chatTipStorageKeys.js';
import {
	GENERATE_AGENT_COMMAND_ID,
	GENERATE_AGENT_INSTRUCTIONS_COMMAND_ID,
	GENERATE_PROMPT_COMMAND_ID,
	GENERATE_SKILL_COMMAND_ID,
	INSERT_FORK_CONVERSATION_COMMAND_ID,
	INSERT_TROUBLESHOOT_COMMAND_ID,
} from './actions/chatActions.js';

export const enum ChatTipTier {
	Foundational = 'foundational',
	Qol = 'qol',
}

/**
 * Treatment names for tip messages overridable via the workbench assignment service.
 */
export const enum ChatTipExperiment {
	OpenAgentsWindowTip = 'openagentswindowtip',
}

/**
 * Context provided to tip builders for dynamic message construction.
 */
export interface ITipBuildContext {
	/**
	 * Keybinding service for looking up keyboard shortcuts.
	 */
	readonly keybindingService: IKeybindingService;
	/**
	 * Experimental tip message overrides keyed by treatment name (see {@link ChatTipExperiment}).
	 * Builders should fall back to their default localized strings when a treatment is not set.
	 */
	readonly experimentalTipMessages: ReadonlyMap<string, string>;
}

/**
 * Gets the display label for a command, looking it up from MenuRegistry.
 * Falls back to extracting a readable name from the command ID.
 */
export function getCommandLabel(commandId: string): string {
	const command = MenuRegistry.getCommand(commandId);
	if (command?.title) {
		// Handle both string and ILocalizedString formats
		return typeof command.title === 'string' ? command.title : command.title.value;
	}
	// Fallback: extract readable name from command ID
	// e.g., 'workbench.action.chat.openEditSession' -> 'openEditSession'
	const parts = commandId.split('.');
	return parts[parts.length - 1];
}

/**
 * Formats a keybinding for display in a tip message.
 * Returns empty string if no keybinding is bound.
 */
function formatKeybinding(ctx: ITipBuildContext, commandId: string): string {
	const kb = ctx.keybindingService.lookupKeybinding(commandId);
	return kb ? ` (${kb.getLabel()})` : '';
}

/**
 * Extracts command IDs from command: links in a markdown string.
 * Used to automatically populate enabledCommands for trusted markdown.
 */
export function extractCommandIds(markdown: string): string[] {
	const commandPattern = /\[.*?\]\(command:([^?\s)]+)/g;
	const commands = new Set<string>();
	let match;
	while ((match = commandPattern.exec(markdown)) !== null) {
		commands.add(match[1]);
	}
	return [...commands];
}

/**
 * Interface for tip definitions in the catalog.
 */
export interface ITipDefinition extends ITipExclusionConfig {
	readonly id: string;
	readonly tier: ChatTipTier;
	/**
	 * Optional priority for ordering tips within the same tier.
	 * Lower values are shown first.
	 */
	readonly priority?: number;
	/**
	 * Builds the tip message dynamically at runtime.
	 * This enables keybindings and command labels to be looked up fresh.
	 * The returned MarkdownString should NOT include the "Tip:" prefix.
	 */
	buildMessage(ctx: ITipBuildContext): MarkdownString;
	/**
	 * When clause expression that determines if this tip is eligible to be shown.
	 */
	readonly when?: ContextKeyExpression;
	/**
	 * Command IDs that must be registered for this tip to be eligible.
	 */
	readonly requiresCommands?: readonly string[];
	/**
	 * Chat mode names that must be available in the current widget for this tip to
	 * be eligible.
	 */
	readonly requiresModeNames?: readonly string[];
	/**
	 * Chat model IDs for which this tip is eligible (lowercase).
	 */
	readonly onlyWhenModelIds?: readonly string[];
	/**
	 * Setting keys that, if changed from default, make this tip ineligible.
	 */
	readonly excludeWhenSettingsChanged?: readonly string[];
	/**
	 * Command IDs that dismiss this tip when clicked from the tip markdown.
	 */
	readonly dismissWhenCommandsClicked?: readonly string[];
}

// -----------------------------------------------------------------------------
// Tip Catalog
// -----------------------------------------------------------------------------

/**
 * Static catalog of tips. Tips are built dynamically at runtime to enable
 * keybindings and command labels to be resolved fresh.
 * 上游原文照抄；Olympia 实际发出去的是下面过滤过的 TIP_CATALOG。
 */
const ALL_TIPS: readonly ITipDefinition[] = [
	{
		id: 'tip.switchToAuto',
		tier: ChatTipTier.Foundational,
		priority: 0,
		buildMessage(_ctx) {
			return new MarkdownString(
				localize(
					'tip.switchToAuto',
					"使用 GPT-4.1?请尝试在模型选取器中切换到 [Auto](command:workbench.action.chat.openModelPicker \"Open Model Picker\")，以提升编码性能。"
				)
			);
		},
		onlyWhenModelIds: ['gpt-4.1'],
	},
	{
		id: 'tip.init',
		tier: ChatTipTier.Foundational,
		priority: 50,
		buildMessage(ctx) {
			const kb = formatKeybinding(ctx, GENERATE_AGENT_INSTRUCTIONS_COMMAND_ID);
			return new MarkdownString(
				localize(
					'tip.init',
					"使用 [{0}](command:{1} \"Run /init\"){2} 为 AI 编码智能体生成或更新工作区指令文件。",
					'/init',
					GENERATE_AGENT_INSTRUCTIONS_COMMAND_ID,
					kb
				)
			);
		},
		when: ChatContextKeys.chatSessionType.isEqualTo(localChatSessionType),
		excludeWhenCommandsExecuted: [
			GENERATE_AGENT_INSTRUCTIONS_COMMAND_ID,
			TipTrackingCommands.CreateAgentInstructionsUsed,
		],
	},
	{
		id: 'tip.createPrompt',
		tier: ChatTipTier.Foundational,
		buildMessage(ctx) {
			const kb = formatKeybinding(ctx, GENERATE_PROMPT_COMMAND_ID);
			return new MarkdownString(
				localize(
					'tip.createPrompt',
					"使用 [{0}](command:{1} \"Run /create-prompt\"){2} 与智能体生成可重复使用的提示文件。",
					'/create-prompt',
					GENERATE_PROMPT_COMMAND_ID,
					kb
				)
			);
		},
		when: ChatContextKeys.chatSessionType.isEqualTo(localChatSessionType),
		excludeWhenCommandsExecuted: [
			GENERATE_PROMPT_COMMAND_ID,
			TipTrackingCommands.CreatePromptUsed,
		],
	},
	{
		id: 'tip.createAgent',
		tier: ChatTipTier.Foundational,
		priority: 30,
		buildMessage(ctx) {
			const kb = formatKeybinding(ctx, GENERATE_AGENT_COMMAND_ID);
			return new MarkdownString(
				localize(
					'tip.createAgent',
					"使用 [{0}](command:{1} \"Run /create-agent\"){2} 为工作流搭建自定义智能体。",
					'/create-agent',
					GENERATE_AGENT_COMMAND_ID,
					kb
				)
			);
		},
		when: ChatContextKeys.chatSessionType.isEqualTo(localChatSessionType),
		excludeWhenCommandsExecuted: [
			GENERATE_AGENT_COMMAND_ID,
			TipTrackingCommands.CreateAgentUsed,
		],
	},
	{
		id: 'tip.createSkill',
		tier: ChatTipTier.Foundational,
		priority: 40,
		buildMessage(ctx) {
			const kb = formatKeybinding(ctx, GENERATE_SKILL_COMMAND_ID);
			return new MarkdownString(
				localize(
					'tip.createSkill',
					"使用 [{0}](command:{1} \"Run /create-skill\"){2} 创建在相关时智能体可加载的技能。",
					'/create-skill',
					GENERATE_SKILL_COMMAND_ID,
					kb
				)
			);
		},
		when: ChatContextKeys.chatSessionType.isEqualTo(localChatSessionType),
		excludeWhenCommandsExecuted: [
			GENERATE_SKILL_COMMAND_ID,
			TipTrackingCommands.CreateSkillUsed,
		],
	},
	{
		id: 'tip.planMode',
		tier: ChatTipTier.Foundational,
		priority: 20,
		buildMessage(ctx) {
			const kb = formatKeybinding(ctx, 'workbench.action.chat.openPlan');
			return new MarkdownString(
				localize(
					'tip.planMode',
					"在实现更改之前，请尝试 [{0}](command:workbench.action.chat.openPlan \"Start Plan Mode\"){1} 以进行研究和计划。",
					'Plan agent',
					kb
				)
			);
		},
		when: ChatContextKeys.chatModeName.notEqualsTo('Plan'),
		requiresModeNames: ['Plan'],
		excludeWhenCommandsExecuted: ['workbench.action.chat.openPlan'],
		excludeWhenModesUsed: ['Plan'],
	},
	{
		id: 'tip.attachFiles',
		tier: ChatTipTier.Qol,
		buildMessage() {
			return new MarkdownString(
				localize('tip.attachFiles', "用 # 引用文件或文件夹，把题面、数据或另一份代码一起发给教练。")
			);
		},
		excludeWhenCommandsExecuted: [
			'workbench.action.chat.attachContext',
			'workbench.action.chat.attachFile',
			'workbench.action.chat.attachFolder',
			'workbench.action.chat.attachSelection',
			TipTrackingCommands.AttachFilesReferenceUsed,
		],
	},
	{
		id: 'tip.codeActions',
		tier: ChatTipTier.Qol,
		buildMessage() {
			return new MarkdownString(
				localize('tip.codeActions', "在编辑器中选择代码块，然后右键单击以访问更多 AI 操作。")
			);
		},
		when: IsSessionsWindowContext.negate(),
		excludeWhenCommandsExecuted: ['inlineChat.start'],
	},
	{
		id: 'tip.undoChanges',
		tier: ChatTipTier.Qol,
		buildMessage() {
			return new MarkdownString(
				localize('tip.undoChanges', "将鼠标悬停在之前的请求上，选择“还原检查点”以撤消聊天对话中该点之后的更改。")
			);
		},
		when: ContextKeyExpr.and(
			ChatContextKeys.chatSessionType.isEqualTo(localChatSessionType),
			ContextKeyExpr.or(
				ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Agent),
				ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Edit),
			),
		),
		excludeWhenCommandsExecuted: ['workbench.action.chat.restoreCheckpoint', 'workbench.action.chat.restoreLastCheckpoint'],
	},
	{
		id: 'tip.messageQueueing',
		tier: ChatTipTier.Qol,
		buildMessage() {
			return new MarkdownString(
				localize('tip.messageQueueing', "通过发送跟进消息在任务中引导智能体。它们排队并按顺序应用。")
			);
		},
		when: ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Agent),
		excludeWhenCommandsExecuted: ['workbench.action.chat.queueMessage', 'workbench.action.chat.steerWithMessage'],
	},
	{
		id: 'tip.btw',
		tier: ChatTipTier.Qol,
		buildMessage() {
			return new MarkdownString(
				localize('tip.btw', "Use `/btw <question>` to ask a side question without adding it to the current conversation.")
			);
		},
		when: ContextKeyExpr.and(
			ContextKeyExpr.equals(`config.${ChatConfiguration.BtwTipEnabled}`, true),
			IsSessionsWindowContext,
			ContextKeyExpr.has('sessionIsCreated'),
			ContextKeyExpr.not('sessionIsArchived'),
			ContextKeyExpr.has('sessionSupportsSideChat'),
		),
		excludeWhenCommandsExecuted: [TipTrackingCommands.BtwUsed],
	},
	{
		id: 'tip.forkConversation',
		tier: ChatTipTier.Qol,
		buildMessage(ctx) {
			const kb = formatKeybinding(ctx, INSERT_FORK_CONVERSATION_COMMAND_ID);
			return new MarkdownString(
				localize(
					'tip.forkConversation',
					"使用 [{0}](command:{1} \"Run /fork\"){2} 分支会话。在不丢失原始上下文的情况下探索不同方法。",
					'/fork',
					INSERT_FORK_CONVERSATION_COMMAND_ID,
					kb
				)
			);
		},
		excludeWhenCommandsExecuted: [
			INSERT_FORK_CONVERSATION_COMMAND_ID,
			'workbench.action.chat.forkConversation',
			TipTrackingCommands.ForkConversationUsed,
		],
	},
	{
		id: 'tip.mermaid',
		tier: ChatTipTier.Qol,
		buildMessage() {
			return new MarkdownString(
				localize('tip.mermaid', "要求智能体绘制关系图或流程图。它可以在聊天中直接呈现 Mermaid 图表。")
			);
		},
		when: ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Agent),
		excludeWhenToolsInvoked: ['renderMermaidDiagram'],
	},
	{
		id: 'tip.subagents',
		tier: ChatTipTier.Qol,
		buildMessage() {
			return new MarkdownString(
				localize('tip.subagents', "还有其他任务要处理?启动新会话以同时运行多个智能体。")
			);
		},
		when: ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Agent),
		excludeWhenToolsInvoked: ['runSubagent'],
	},
	{
		id: 'tip.thinkingPhrases',
		tier: ChatTipTier.Qol,
		buildMessage() {
			return new MarkdownString(
				localize(
					'tip.thinkingPhrases',
					"自定义智能体使用 [{0}](command:workbench.action.openSettings?%5B%22{1}%22%5D \"Open Settings\") 时显示的加载消息。",
					'thinking phrases',
					ChatConfiguration.ThinkingPhrases
				)
			);
		},
		when: ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Agent),
		excludeWhenSettingsChanged: [ChatConfiguration.ThinkingPhrases],
		dismissWhenCommandsClicked: ['workbench.action.openSettings'],
	},
	{
		id: 'tip.autoAcceptDelay',
		tier: ChatTipTier.Qol,
		buildMessage() {
			return new MarkdownString(
				localize(
					'tip.autoAcceptDelay',
					"配置 [{0}](command:workbench.action.openSettings?%5B%22chat.editing.autoAcceptDelay%22%5D \"打开设置\")以在短暂倒计时后自动接受来自智能体的更改。",
					'auto-accept delay'
				)
			);
		},
		when: ContextKeyExpr.and(
			IsSessionsWindowContext.negate(),
			ContextKeyExpr.or(
				ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Agent),
				ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Edit),
			),
		),
		excludeWhenSettingsChanged: ['chat.editing.autoAcceptDelay'],
		dismissWhenCommandsClicked: ['workbench.action.openSettings'],
	},
	{
		id: 'tip.troubleshoot',
		tier: ChatTipTier.Qol,
		buildMessage(ctx) {
			const kb = formatKeybinding(ctx, INSERT_TROUBLESHOOT_COMMAND_ID);
			return new MarkdownString(
				localize(
					'tip.troubleshoot',
					"一些内容无法工作?输入 [{0}](command:{1} \"Run /troubleshoot\"){2} <问题> 从调试日志诊断问题。",
					'/troubleshoot',
					INSERT_TROUBLESHOOT_COMMAND_ID,
					kb
				)
			);
		},
		when: ChatContextKeys.chatSessionType.isEqualTo(localChatSessionType),
		excludeWhenToolsInvoked: ['listDebugEvents'],
	},
	{
		id: 'tip.agentsWindow',
		tier: ChatTipTier.Qol,
		buildMessage(ctx) {
			const defaultMessage = localize(
				'tip.agentsWindow',
				"在 [智能体窗口](命令:{0}“打开智能体窗口”)中一次性跨多个项目工作。",
				OPEN_AGENTS_WINDOW_COMMAND_ID
			);
			const experimentalTemplate = ctx.experimentalTipMessages.get(ChatTipExperiment.OpenAgentsWindowTip);
			const message = experimentalTemplate
				? experimentalTemplate.replace(/\{0\}/g, OPEN_AGENTS_WINDOW_COMMAND_ID)
				: defaultMessage;
			return new MarkdownString(message);
		},
		when: ContextKeyExpr.and(IsWebContext.negate(), OPEN_AGENTS_WINDOW_PRECONDITION),
		excludeWhenCommandsExecuted: [
			OPEN_AGENTS_WINDOW_COMMAND_ID,
			OPEN_WORKSPACE_IN_AGENTS_WINDOW_COMMAND_ID,
		],
	},
	{
		id: 'tip.copilotCli',
		tier: ChatTipTier.Qol,
		buildMessage() {
			return new MarkdownString(
				localize(
					'tip.copilotCli',
					"通过 [Copilot CLI](command:workbench.action.chat.openNewChatSessionInPlace.copilotcli?%5B%22sidebar%22%5D \"Switch to Copilot CLI\")并行运行智能体。"
				)
			);
		},
		when: ContextKeyExpr.and(
			IsSessionsWindowContext.negate(),
			ChatContextKeys.chatSessionType.isEqualTo(localChatSessionType),
			ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Agent),
			ChatContextKeys.hasCanDelegateProviders,
		),
		excludeWhenCommandsExecuted: ['workbench.action.chat.openNewChatSessionInPlace.copilotcli'],
	},
	{
		id: 'tip.defaultPermissions',
		tier: ChatTipTier.Qol,
		buildMessage() {
			return new MarkdownString(
				localize(
					'tip.defaultPermissions',
					"配置 [{0}](command:workbench.action.openSettings?%5B%22{1}%22%5D \"Open Settings\")，以绕过审批模式或 Autopilot 模式启动新会话。",
					'default permissions',
					ChatConfiguration.DefaultPermissionLevel
				)
			);
		},
		when: ContextKeyExpr.or(
			ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Agent),
			ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Edit),
		),
		excludeWhenSettingsChanged: [ChatConfiguration.DefaultPermissionLevel],
		dismissWhenCommandsClicked: ['workbench.action.openSettings'],
	},
];

/**
 * Olympia 不展示的提示。这几条讲的是搭自定义智能体、写技能、子代理、试用「智能体窗口」，
 * 以及我们不随包发的 Copilot CLI——竞赛工作流里没有对应的动作，而聊天框下面那条提示位
 * 一次只显示一条，占着它不如显示学生真会用到的（附件、计划模式、消息排队那些都留着）。
 * tip.init 也在里面：它让人去生成 AGENTS.md，那是给编码智能体看的工程约定文件，
 * 而这条提示在真机上正好落在「没有可用模型」那一屏的下面（截图里能看到）。
 * tip.createPrompt 是同一类：/init 换成了 /create-prompt，主语还是「智能体」，
 * 把 tip.init 藏掉之后它就顶了上来（真机截图 coach-handoff.png）。
 * tip.troubleshoot 也是：它写着「输入 /troubleshoot <问题> 从调试日志诊断问题」，
 * 而那一步靠的是上游智能体的 listDebugEvents 工具——本产品只有 BYOK 教练，
 * 输进去就是一段普通文本发给模型，不会去读日志。首屏提示位不能许诺做不到的事。
 * tip.forkConversation 是另一类：/fork 本身能用，但「把一次会话分叉出去对比做法」是
 * 编码智能体的多分支玩法，教练问答里没有对应动作；而真机上这条正好顶在首屏那一条
 * 提示位上（2026-10-17 拍官网首屏图时看到）。提示位一次只放一条，占着它不如放学生真会用的。
 */
const TIPS_HIDDEN_IN_OLYMPIA: readonly string[] = [
	'tip.createAgent',
	'tip.createSkill',
	'tip.subagents',
	'tip.agentsWindow',
	'tip.copilotCli',
	'tip.init',
	'tip.createPrompt',
	'tip.troubleshoot',
	'tip.forkConversation',
	// tip.codeActions 是全新 profile 首屏实测到的那一条：它写着「选中代码块，然后右键单击
	// 以访问更多 AI 操作」，而那些右键项是上游 Copilot 的代码操作菜单；本产品没有托管助手，
	// 学生照做只会点开一个跟自己无关的菜单。首屏提示位不能拿这个占格子。
	// （tip.btw 那条文案还是英文，不用动：它自己的 when 挂着 IsSessionsWindowContext，
	// 只可能在智能体窗口出现，而那个窗口在本产品整条关掉了——学生看不到。）
	'tip.codeActions',
];

export const TIP_CATALOG: readonly ITipDefinition[] = ALL_TIPS.filter(tip => !TIPS_HIDDEN_IN_OLYMPIA.includes(tip.id));
