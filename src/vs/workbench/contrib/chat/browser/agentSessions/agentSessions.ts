/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../../nls.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { URI } from '../../../../../base/common/uri.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { foreground, listActiveSelectionForeground, registerColor, transparent } from '../../../../../platform/theme/common/colorRegistry.js';
import { getChatSessionType } from '../../common/model/chatUri.js';
import { isAgentHostTarget, SessionType } from '../../common/chatSessionsService.js';
import { IChatRequestVariableEntry } from '../../common/attachments/chatVariableEntries.js';
import { MenuId } from '../../../../../platform/actions/common/actions.js';

export const AgentSessionChatContextMenu = new MenuId('AgentSessionChatContext');

export enum AgentSessionProviders {
	Local = SessionType.Local,
	Background = SessionType.CopilotCLI,
	Cloud = SessionType.CopilotCloud,
	Codex = SessionType.Codex,
	Growth = SessionType.Growth,
	AgentHostCopilot = SessionType.AgentHostCopilot,
	AgentHostClaude = SessionType.AgentHostClaude,
	AgentHostCodex = SessionType.AgentHostCodex,
}

/**
 * A session target is either a well-known {@link AgentSessionProviders} enum
 * value or a dynamic string for dynamically-registered providers (e.g. remote
 * agent hosts like `remote-{authority}-copilot`).
 * TODO@roblourens HACK
 */
export type AgentSessionTarget = AgentSessionProviders | (string & {});

export function isBuiltInAgentSessionProvider(provider: AgentSessionTarget): boolean {
	return provider === AgentSessionProviders.Local ||
		provider === AgentSessionProviders.Background ||
		provider === AgentSessionProviders.Cloud;
}

export function getAgentSessionProvider(sessionResource: URI | string): AgentSessionProviders | undefined {
	const type = URI.isUri(sessionResource) ? getChatSessionType(sessionResource) : sessionResource;
	switch (type) {
		case AgentSessionProviders.Local:
		case AgentSessionProviders.Background:
		case AgentSessionProviders.Cloud:
		case AgentSessionProviders.Codex:
		case AgentSessionProviders.AgentHostCopilot:
		case AgentSessionProviders.AgentHostClaude:
		case AgentSessionProviders.AgentHostCodex:
			return type;
		default:
			return undefined;
	}
}

export function getAgentSessionProviderName(provider: AgentSessionTarget): string {
	switch (provider) {
		case AgentSessionProviders.Local:
			return localize('chat.session.providerLabel.local', "本地");
		case AgentSessionProviders.Background:
			return localize('chat.session.providerLabel.background', "Copilot CLI");
		case AgentSessionProviders.Cloud:
			return localize('chat.session.providerLabel.cloud', "云");
		case AgentSessionProviders.AgentHostClaude:
			return 'Claude';
		case AgentSessionProviders.Codex:
		case AgentSessionProviders.AgentHostCodex:
			return 'Codex';
		case AgentSessionProviders.Growth:
			return 'Growth';
		case AgentSessionProviders.AgentHostCopilot:
			return localize('chat.session.providerLabel.agentHostCopilot', "Copilot");
		default:
			return provider;
	}
}

export function getAgentSessionProviderIcon(provider: AgentSessionTarget): ThemeIcon {
	switch (provider) {
		case AgentSessionProviders.Local:
			return Codicon.vm;
		case AgentSessionProviders.Background:
			return Codicon.copilot;
		case AgentSessionProviders.Cloud:
			return Codicon.cloud;
		case AgentSessionProviders.Codex:
		case AgentSessionProviders.AgentHostCodex:
			return Codicon.openai;
		case AgentSessionProviders.AgentHostClaude:
			return Codicon.claude;
		case AgentSessionProviders.Growth:
			return Codicon.lightbulb;
		case AgentSessionProviders.AgentHostCopilot:
			return Codicon.copilot;
		default:
			return Codicon.extensions;
	}
}

export function isFirstPartyAgentSessionProvider(provider: AgentSessionTarget): boolean {
	switch (provider) {
		case AgentSessionProviders.Local:
		case AgentSessionProviders.Background:
		case AgentSessionProviders.Cloud:
		case AgentSessionProviders.AgentHostCopilot:
			return true;
		case AgentSessionProviders.AgentHostClaude:
		case AgentSessionProviders.Codex:
		case AgentSessionProviders.AgentHostCodex:
		case AgentSessionProviders.Growth:
			return false;
		default:
			return false;
	}
}

/**
 * Re-exported from `common/chatSessionsService.ts` so existing browser-layer
 * callers keep working without changing imports.
 */
export { isAgentHostTarget };

/**
 * Generic command used to delegate ("Continue in…") an existing conversation to
 * a new agent host session. The conversation transcript travels as an
 * attachment so the target agent can pick up the work.
 *
 * Both VS Code (the main window) and the Agents window surface agent host
 * sessions, but they open sessions through different infrastructure. To avoid
 * registering a command per session type, agent host delegation is funneled
 * through this single command id. The Agents window registers a handler that
 * creates the target session via its session management service; in the main
 * window the chat action opens the session directly. The command id is
 * intentionally a plain string constant so the `vs/sessions` layer can register
 * a handler for it without importing chat browser internals.
 */
export const CHAT_DELEGATE_TO_AGENT_HOST_SESSION_COMMAND_ID = 'workbench.action.chat.delegateToAgentHostSession';

/**
 * Arguments passed to {@link CHAT_DELEGATE_TO_AGENT_HOST_SESSION_COMMAND_ID}.
 * The values are passed by reference within a single renderer, so rich types
 * such as the attached context entries survive the command invocation.
 */
export interface IAgentHostDelegationRequest {
	/** The target agent host session type, e.g. `agent-host-copilotcli`. */
	readonly type: string;
	/** Human readable name of the target session type. */
	readonly displayName: string;
	/** The user prompt to send to the new session. */
	readonly prompt: string;
	/** Attachments to include with the first request (e.g. the prior transcript). */
	readonly attachedContext?: IChatRequestVariableEntry[];
}

export function getAgentCanContinueIn(provider: AgentSessionTarget): boolean {
	switch (provider) {
		case AgentSessionProviders.Local:
			return false;
		case AgentSessionProviders.Background:
		case AgentSessionProviders.Cloud:
		case AgentSessionProviders.AgentHostCopilot:
			return true;
		case AgentSessionProviders.Codex:
		case AgentSessionProviders.Growth:
			return false;
		default:
			return isAgentHostTarget(provider);
	}
}

export function getAgentSessionProviderDescription(provider: AgentSessionTarget): string {
	switch (provider) {
		case AgentSessionProviders.Local:
			return localize('chat.session.providerDescription.local', "在 Olympia 聊天中运行任务。智能体通过聊天循环访问，并以交互方式在主工作区上实现更改。");
		case AgentSessionProviders.Background:
			return localize('chat.session.providerDescription.background', "将任务委托给在计算机上本地运行的后台代理程序。智能体通过聊天循环访问，并在 Git 工作树中异步工作，以使用 GitHub Copilot CLI 实现与主工作区隔离的更改。");
		case AgentSessionProviders.Cloud:
			return localize('chat.session.providerDescription.cloud', "将任务委托给 GitHub Copilot 编码智能体。智能体通过聊天循环访问，并在云中异步工作，以根据需要实现更改和拉取请求。");
		case AgentSessionProviders.AgentHostClaude:
			return localize('chat.session.providerDescription.claude', "使用 GitHub Copilot 订阅中包含的 Claude 模型，将任务委派给 Claude Agent SDK。智能体通过聊天循环访问，并以交互方式在主工作区上实现更改。");
		case AgentSessionProviders.Codex:
			return localize('chat.session.providerDescription.codex', "在编辑器中打开新的 Codex 会话。可以从聊天会话视图管理 Codex 会话。");
		case AgentSessionProviders.AgentHostCodex:
			return localize('chat.session.providerDescription.agentHostCodex', "Work with OpenAI's Codex agent using your ChatGPT or GitHub Copilot subscription.");
		case AgentSessionProviders.Growth:
			return localize('chat.session.providerDescription.growth', "了解 Copilot 功能。");
		case AgentSessionProviders.AgentHostCopilot:
			return localize('chat.session.providerDescription.agentHostCopilot', "Run a Copilot SDK agent in the local agent host process.");
		default:
			return '';
	}
}

export enum AgentSessionsViewerOrientation {
	Stacked = 1,
	SideBySide,
}

export enum AgentSessionsViewerPosition {
	Left = 1,
	Right,
}

export interface IAgentSessionsControl {

	readonly element: HTMLElement | undefined;

	refresh(): void;
	openFind(): void;

	reveal(sessionResource: URI): boolean;

	clearFocus(): void;
	hasFocusOrSelection(): boolean;

	resetSectionCollapseState(): void;
	collapseAllSections(): void;
}

export const agentSessionReadIndicatorForeground = registerColor(
	'agentSessionReadIndicator.foreground',
	{ dark: transparent(foreground, 0.2), light: transparent(foreground, 0.2), hcDark: null, hcLight: null },
	localize('agentSessionReadIndicatorForeground', "代理会话中已读指示器的前景色。")
);

export const agentSessionSelectedBadgeBorder = registerColor(
	'agentSessionSelectedBadge.border',
	{ dark: transparent(listActiveSelectionForeground, 0.3), light: transparent(listActiveSelectionForeground, 0.3), hcDark: foreground, hcLight: foreground },
	localize('agentSessionSelectedBadgeBorder', "所选代理会话项中徽章的边框颜色。")
);

export const agentSessionSelectedUnfocusedBadgeBorder = registerColor(
	'agentSessionSelectedUnfocusedBadge.border',
	{ dark: transparent(foreground, 0.3), light: transparent(foreground, 0.3), hcDark: foreground, hcLight: foreground },
	localize('agentSessionSelectedUnfocusedBadgeBorder', "视图未聚焦时所选代理代理项中徽章的边框颜色。")
);

export const AGENT_SESSION_RENAME_ACTION_ID = 'agentSession.rename';
export const AGENT_SESSION_DELETE_ACTION_ID = 'agentSession.delete';
