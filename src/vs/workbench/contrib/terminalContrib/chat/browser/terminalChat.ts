/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../../nls.js';
import { MenuId } from '../../../../../platform/actions/common/actions.js';
import { RawContextKey } from '../../../../../platform/contextkey/common/contextkey.js';

export const enum TerminalChatCommandId {
	Start = 'workbench.action.terminal.chat.start',
	Close = 'workbench.action.terminal.chat.close',
	MakeRequest = 'workbench.action.terminal.chat.makeRequest',
	Cancel = 'workbench.action.terminal.chat.cancel',
	RunCommand = 'workbench.action.terminal.chat.runCommand',
	RunFirstCommand = 'workbench.action.terminal.chat.runFirstCommand',
	InsertCommand = 'workbench.action.terminal.chat.insertCommand',
	InsertFirstCommand = 'workbench.action.terminal.chat.insertFirstCommand',
	ViewInChat = 'workbench.action.terminal.chat.viewInChat',
	RerunRequest = 'workbench.action.terminal.chat.rerunRequest',
	ViewHiddenChatTerminals = 'workbench.action.terminal.chat.viewHiddenChatTerminals',
	OpenTerminalSettingsLink = 'workbench.action.terminal.chat.openTerminalSettingsLink',
	DisableSessionAutoApproval = 'workbench.action.terminal.chat.disableSessionAutoApproval',
	FocusMostRecentChatTerminalOutput = 'workbench.action.terminal.chat.focusMostRecentChatTerminalOutput',
	FocusMostRecentChatTerminal = 'workbench.action.terminal.chat.focusMostRecentChatTerminal',
	ToggleChatTerminalOutput = 'workbench.action.terminal.chat.toggleChatTerminalOutput',
	FocusChatInstanceAction = 'workbench.action.terminal.chat.focusChatInstance',
	ContinueInBackground = 'workbench.action.terminal.chat.continueInBackground',
}

export const MENU_TERMINAL_CHAT_WIDGET_INPUT_SIDE_TOOLBAR = MenuId.for('terminalChatWidget');
export const MENU_TERMINAL_CHAT_WIDGET_STATUS = MenuId.for('terminalChatWidget.status');
export const MENU_TERMINAL_CHAT_WIDGET_TOOLBAR = MenuId.for('terminalChatWidget.toolbar');
export const MENU_CHAT_TERMINAL_TOOL_PROGRESS = MenuId.for('chatTerminalToolProgress');

export const enum TerminalChatContextKeyStrings {
	ChatFocus = 'terminalChatFocus',
	ChatVisible = 'terminalChatVisible',
	ChatActiveRequest = 'terminalChatActiveRequest',
	ChatInputHasText = 'terminalChatInputHasText',
	ChatAgentRegistered = 'terminalChatAgentRegistered',
	ChatResponseEditorFocused = 'terminalChatResponseEditorFocused',
	ChatResponseContainsCodeBlock = 'terminalChatResponseContainsCodeBlock',
	ChatResponseContainsMultipleCodeBlocks = 'terminalChatResponseContainsMultipleCodeBlocks',
	ChatResponseSupportsIssueReporting = 'terminalChatResponseSupportsIssueReporting',
	ChatSessionResponseVote = 'terminalChatSessionResponseVote',
	ChatUsesAgentHost = 'terminalChatUsesAgentHost',
	ChatHasTerminals = 'hasChatTerminals',
	ChatHasHiddenTerminals = 'hasHiddenChatTerminals',
	ChatToolHasInstance = 'chatTerminalToolHasInstance',
	ChatToolCanContinueInBackground = 'chatTerminalToolCanContinueInBackground',
	ChatToolHasOutput = 'chatTerminalToolHasOutput',
	ChatToolUsesCollapsible = 'chatTerminalToolUsesCollapsible',
	ChatToolIsHiddenTerminal = 'chatTerminalToolIsHiddenTerminal',
	ChatToolOutputExpanded = 'chatTerminalToolOutputExpanded',
}


export namespace TerminalChatContextKeys {

	/** Whether the chat widget is focused */
	export const focused = new RawContextKey<boolean>(TerminalChatContextKeyStrings.ChatFocus, false, localize('chatFocusedContextKey', "聊天视图是否为焦点。"));

	/** Whether the chat widget is visible */
	export const visible = new RawContextKey<boolean>(TerminalChatContextKeyStrings.ChatVisible, false, localize('chatVisibleContextKey', "聊天视图是否可见。"));

	/** Whether there is an active chat request */
	export const requestActive = new RawContextKey<boolean>(TerminalChatContextKeyStrings.ChatActiveRequest, false, localize('chatRequestActiveContextKey', "是否存在活动聊天请求。"));

	/** Whether the chat input has text */
	export const inputHasText = new RawContextKey<boolean>(TerminalChatContextKeyStrings.ChatInputHasText, false, localize('chatInputHasTextContextKey', "聊天输入是否包含文本。"));

	/** The chat response contains at least one code block */
	export const responseContainsCodeBlock = new RawContextKey<boolean>(TerminalChatContextKeyStrings.ChatResponseContainsCodeBlock, false, localize('chatResponseContainsCodeBlockContextKey', "聊天响应是否包含代码块。"));

	/** The chat response contains multiple code blocks */
	export const responseContainsMultipleCodeBlocks = new RawContextKey<boolean>(TerminalChatContextKeyStrings.ChatResponseContainsMultipleCodeBlocks, false, localize('chatResponseContainsMultipleCodeBlocksContextKey', "聊天响应是否包含多个代码块。"));

	/** A chat agent exists for the terminal location */
	export const hasChatAgent = new RawContextKey<boolean>(TerminalChatContextKeyStrings.ChatAgentRegistered, false, localize('chatAgentRegisteredContextKey', "是否已为终端位置注册聊天代理。"));

	/** Whether the chat session is backed by the Agent Host */
	export const usesAgentHost = new RawContextKey<boolean>(TerminalChatContextKeyStrings.ChatUsesAgentHost, false, localize('terminalChatUsesAgentHostContextKey', "Whether the terminal chat session is backed by the Agent Host."));

	/** Has terminals created via chat */
	export const hasChatTerminals = new RawContextKey<boolean>(TerminalChatContextKeyStrings.ChatHasTerminals, false, localize('terminalHasChatTerminals', "是否存在聊天终端。"));

	/** Has hidden chat terminals */
	export const hasHiddenChatTerminals = new RawContextKey<boolean>(TerminalChatContextKeyStrings.ChatHasHiddenTerminals, false, localize('terminalHasHiddenChatTerminals', "是否存在隐藏的聊天终端。"));

	/** Whether the per-instance terminal tool progress part has a terminal instance attached */
	export const chatToolHasInstance = new RawContextKey<boolean>(TerminalChatContextKeyStrings.ChatToolHasInstance, false);

	/** Whether the continue-in-background action is available */
	export const chatToolCanContinueInBackground = new RawContextKey<boolean>(TerminalChatContextKeyStrings.ChatToolCanContinueInBackground, false);

	/** Whether terminal output is available for display */
	export const chatToolHasOutput = new RawContextKey<boolean>(TerminalChatContextKeyStrings.ChatToolHasOutput, false);

	/** Whether the terminal tool uses a collapsible wrapper */
	export const chatToolUsesCollapsible = new RawContextKey<boolean>(TerminalChatContextKeyStrings.ChatToolUsesCollapsible, false);

	/** Whether the associated terminal is hidden from the user */
	export const chatToolIsHiddenTerminal = new RawContextKey<boolean>(TerminalChatContextKeyStrings.ChatToolIsHiddenTerminal, false);

	/** Whether the terminal output section is currently expanded */
	export const chatToolOutputExpanded = new RawContextKey<boolean>(TerminalChatContextKeyStrings.ChatToolOutputExpanded, false);
}
