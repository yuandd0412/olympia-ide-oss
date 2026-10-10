/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../../nls.js';
import { ContextKeyExpr, RawContextKey } from '../../../../../platform/contextkey/common/contextkey.js';
import { IsWebContext } from '../../../../../platform/contextkey/common/contextkeys.js';
import { RemoteNameContext } from '../../../../common/contextkeys.js';
import { ViewContainerLocation } from '../../../../common/views.js';
import { ChatEntitlementContextKeys } from '../../../../services/chat/common/chatEntitlementService.js';
import { ChatAccountPolicyGateActiveContext } from '../../../../services/policies/common/accountPolicyService.js';
import { ChatAgentLocation, ChatModeKind, ChatPermissionLevel } from '../constants.js';

export namespace ChatContextKeys {
	export const responseVote = new RawContextKey<string>('chatSessionResponseVote', '', { type: 'string', description: localize('interactiveSessionResponseVote', "对响应投赞成票后，其设置为 \"up\"。投反对票时，设置为 \"down\"。否则为空字符串。") });
	export const responseDetectedAgentCommand = new RawContextKey<boolean>('chatSessionResponseDetectedAgentOrCommand', false, { type: 'boolean', description: localize('chatSessionResponseDetectedAgentOrCommand', "当自动检测到代理或命令时") });
	export const responseSupportsIssueReporting = new RawContextKey<boolean>('chatResponseSupportsIssueReporting', false, { type: 'boolean', description: localize('chatResponseSupportsIssueReporting', "如果当前聊天响应支持问题报告，则为 True。") });
	export const responseIsFiltered = new RawContextKey<boolean>('chatSessionResponseFiltered', false, { type: 'boolean', description: localize('chatResponseFiltered', "服务器筛选掉聊天响应时为 True。") });
	export const responseHasError = new RawContextKey<boolean>('chatSessionResponseError', false, { type: 'boolean', description: localize('chatResponseErrored', "当聊天响应导致错误时为 True。") });
	export const responseHasFeedbackSurvey = new RawContextKey<boolean>('chatSessionResponseHasFeedbackSurvey', false, { type: 'boolean', description: localize('chatResponseHasFeedbackSurvey', "True when an inline model feedback survey is offered for the chat response, which replaces the helpful and unhelpful actions.") });
	export const responseFeedbackSurveyOpen = new RawContextKey<boolean>('chatSessionResponseFeedbackSurveyOpen', false, { type: 'boolean', description: localize('chatResponseFeedbackSurveyOpen', "True when the inline model feedback survey is showing for the chat response.") });
	export const requestInProgress = new RawContextKey<boolean>('chatSessionRequestInProgress', false, { type: 'boolean', description: localize('interactiveSessionRequestInProgress', "当前请求仍在进行时为 True。") });
	export const transcriptProgressActive = new RawContextKey<boolean>('chatTranscriptProgressActive', false, { type: 'boolean', description: localize('chatTranscriptProgressActive', "True while cancellable transcript preparation is running.") });
	export const hasActiveRequest = new RawContextKey<boolean>('chatSessionHasActiveRequest', false, { type: 'boolean', description: localize('chatSessionHasActiveRequest', "若当前聊天响应尚未完成，则为 true，无论工具调用或获取等中间状态如何。") });
	export const currentlyEditing = new RawContextKey<boolean>('chatSessionCurrentlyEditing', false, { type: 'boolean', description: localize('interactiveSessionCurrentlyEditing', "编辑当前请求时为 True。") });
	export const currentlyEditingInput = new RawContextKey<boolean>('chatSessionCurrentlyEditingInput', false, { type: 'boolean', description: localize('interactiveSessionCurrentlyEditingInput', "编辑底部的当前请求输入时为 True。") });

	export const enum EditingRequestType {
		Sent = 's',
		Queue = 'q',
		Steer = 'st',
	}
	export const editingRequestType = new RawContextKey<EditingRequestType | undefined>('chatEditingSentRequest', undefined, { type: 'string', description: localize('chatEditingSentRequest', "当前编辑请求的类型。") });

	export const isResponse = new RawContextKey<boolean>('chatResponse', false, { type: 'boolean', description: localize('chatResponse', "聊天项是一个响应。") });
	export const isRequest = new RawContextKey<boolean>('chatRequest', false, { type: 'boolean', description: localize('chatRequest', "聊天项是一个请求") });
	export const contextMenuIsBackground = new RawContextKey<boolean>('chatContextMenuIsBackground', false, { type: 'boolean', description: localize('chatContextMenuIsBackground', "Whether the chat context menu was opened from the transcript background rather than chat item content.") });
	export const contextMenuHasLink = new RawContextKey<boolean>('chatContextMenuHasLink', false, { type: 'boolean', description: localize('chatContextMenuHasLink', "Whether the chat context menu was opened on a link.") });
	export const contextMenuHasAvailableEditors = new RawContextKey<boolean>('chatContextMenuHasAvailableEditors', false, { type: 'boolean', description: localize('chatContextMenuHasAvailableEditors', "Whether the chat context menu link can be opened with an alternate editor.") });
	export const isFirstRequest = new RawContextKey<boolean>('chatFirstRequest', false, { type: 'boolean', description: localize('chatFirstRequest', "聊天项是会话中的第一个请求。") });
	export const isPendingRequest = new RawContextKey<boolean>('chatRequestIsPending', false, { type: 'boolean', description: localize('chatRequestIsPending', "当聊天请求在队列中挂起时，为 True。") });
	export const itemId = new RawContextKey<string>('chatItemId', '', { type: 'string', description: localize('chatItemId', "聊天项的 ID。") });
	export const lastItemId = new RawContextKey<string[]>('chatLastItemId', [], { type: 'string', description: localize('chatLastItemId', "最后一个聊天项的 ID。") });

	export const editApplied = new RawContextKey<boolean>('chatEditApplied', false, { type: 'boolean', description: localize('chatEditApplied', "应用聊天文本编辑后为 True。") });

	export const inputHasText = new RawContextKey<boolean>('chatInputHasText', false, { type: 'boolean', description: localize('interactiveInputHasText', "如果聊天输入包含文本，则为 True。") });
	export const inputHasSendableContent = new RawContextKey<boolean>('chatInputHasSendableContent', false, { type: 'boolean', description: localize('interactiveInputHasSendableContent', "当聊天输入包含可发送的文本或文件附件时为 True。") });
	export const inputHasFocus = new RawContextKey<boolean>('chatInputHasFocus', false, { type: 'boolean', description: localize('interactiveInputHasFocus', "如果聊天输入具有焦点，则为 True。") });
	export const inChatInput = new RawContextKey<boolean>('inChatInput', false, { type: 'boolean', description: localize('inInteractiveInput', "当焦点位于聊天输入中时为 true，否则为 false。") });
	export const inChatSession = new RawContextKey<boolean>('inChat', false, { type: 'boolean', description: localize('inChat', "当焦点位于聊天小组件中时为 true，否则为 false。") });
	export const inChatQuestionCarousel = new RawContextKey<boolean>('inChatQuestionCarousel', false, { type: 'boolean', description: localize('inChatQuestionCarousel', "当焦点位于聊天问题轮播时为 true。") });
	export const chatQuestionCarouselHasTerminal = new RawContextKey<boolean>('chatQuestionCarouselHasTerminal', false, { type: 'boolean', description: localize('chatQuestionCarouselHasTerminal', "当聊天问题轮播由终端触发且存在可聚焦的终端时，为 True。") });
	export const inChatEditor = new RawContextKey<boolean>('inChatEditor', false, { type: 'boolean', description: localize('inChatEditor', "焦点是否在聊天编辑器中。") });
	export const findSupported = new RawContextKey<boolean>('chatFindSupported', false, { type: 'boolean', description: localize('chatFindSupported', "True when the chat widget hosting the current focus supports transcript Find.") });
	export const findWidgetVisible = new RawContextKey<boolean>('chatFindWidgetVisible', false, { type: 'boolean', description: localize('chatFindWidgetVisible', "True when the chat transcript Find widget is visible.") });
	export const findInputFocused = new RawContextKey<boolean>('chatFindInputFocused', false, { type: 'boolean', description: localize('chatFindInputFocused', "True when the chat transcript Find widget's input box has focus.") });
	export const findWidgetFocused = new RawContextKey<boolean>('chatFindWidgetFocused', false, { type: 'boolean', description: localize('chatFindWidgetFocused', "True when any part of the chat transcript Find widget has focus.") });
	export const inChatTodoList = new RawContextKey<boolean>('inChatTodoList', false, { type: 'boolean', description: localize('inChatTodoList', "当焦点位于聊天待办事项列表中时为 true。") });
	export const inChatTip = new RawContextKey<boolean>('inChatTip', false, { type: 'boolean', description: localize('inChatTip', "当焦点位于聊天提示中时为 true。") });
	export const inChatComposer = new RawContextKey<boolean>('inChatComposer', false, { type: 'boolean', description: localize('inChatComposer', "True when focus is in an Agents window chat composer or one of the notices above it.") });
	export const multipleChatTips = new RawContextKey<boolean>('multipleChatTips', false, { type: 'boolean', description: localize('multipleChatTips', "当有多个聊天提示可用时为 true。") });
	export const inChatTerminalToolOutput = new RawContextKey<boolean>('inChatTerminalToolOutput', false, { type: 'boolean', description: localize('inChatTerminalToolOutput', "当焦点位于聊天终端输出区域时为 True。") });
	export const chatModeKind = new RawContextKey<ChatModeKind>('chatAgentKind', ChatModeKind.Ask, { type: 'string', description: localize('agentKind', "当前智能体的“类型”。") });
	export const chatPermissionLevel = new RawContextKey<ChatPermissionLevel>('chatPermissionLevel', ChatPermissionLevel.Default, { type: 'string', description: localize('chatPermissionLevel', "当前工具自动批准的权限级别。") });
	export const chatModeName = new RawContextKey<string>('chatModeName', '', { type: 'string', description: localize('chatModeName', "当前聊天模式的名称(例如，对于自定义模式为“计划”)。") });
	export const chatModelId = new RawContextKey<string>('chatModelId', '', { type: 'string', description: localize('chatModelId', "当前所选聊天模型的短 ID(例如 \"gpt-4.1\")。") });
	export const speechToTextRecording = new RawContextKey<boolean>('chatSpeechToTextRecording', false, { type: 'boolean', description: localize('chatSpeechToTextRecording', "True while the chat input is recording audio for speech-to-text transcription.") });
	export const speechToTextConfigured = new RawContextKey<boolean>('chatSpeechToTextConfigured', false, { type: 'boolean', description: localize('chatSpeechToTextConfigured', "True when speech-to-text is available for dictating into the chat input.") });
	export const speechToTextPreparing = new RawContextKey<boolean>('chatSpeechToTextPreparing', false, { type: 'boolean', description: localize('chatSpeechToTextPreparing', "True while the selected speech-to-text backend is preparing.") });
	export const speechToTextUsesMai = new RawContextKey<boolean>('chatSpeechToTextUsesMai', false, { type: 'boolean', description: localize('chatSpeechToTextUsesMai', "True when dictation uses the MAI cloud transcription backend.") });

	export const supported = ContextKeyExpr.or(IsWebContext.negate(), RemoteNameContext.notEqualsTo(''), ContextKeyExpr.has('config.chat.experimental.serverlessWebEnabled'));
	export const enabled = new RawContextKey<boolean>('chatIsEnabled', false, { type: 'boolean', description: localize('chatIsEnabled', "启用聊天时为 True，因为默认聊天参与者是使用实现激活的。") });
	export const accountPolicyGateActive = ChatAccountPolicyGateActiveContext;

	/**
	 * True when the chat widget is locked to the coding agent session.
	 */
	export const lockedToCodingAgent = new RawContextKey<boolean>('lockedToCodingAgent', false, { type: 'boolean', description: localize('lockedToCodingAgent', "当聊天小组件锁定到编码智能体会话时为 True。") });
	export const lockedCodingAgentId = new RawContextKey<string>('lockedCodingAgentId', '', { type: 'string', description: localize('lockedCodingAgentId', "当聊天小组件锁定到编码智能体会话时的智能体 ID。") });
	/**
	 * Widget-scoped: true when the chat shown in this widget is read-only (non-interactive),
	 * e.g. an observable worker chat. Read-only chats hide the composer and do not offer
	 * mutating actions such as Start Over or Restore Checkpoint.
	 */
	export const inputBlocked = new RawContextKey<boolean>('chatInputBlocked', false, { type: 'boolean', description: localize('chatInputBlocked', "True when sending to the current chat is temporarily blocked.") });
	export const readOnly = new RawContextKey<boolean>('chatIsReadonly', false, { type: 'boolean', description: localize('chatIsReadonly', "True when the chat shown in the widget is read-only (non-interactive).") });
	/**
	 * Widget-scoped: true when this chat widget is locked to an Agent Host-backed chat session.
	 */
	export const chatIsAgentHostSession = new RawContextKey<boolean>('chatIsAgentHostSession', false, { type: 'boolean', description: localize('chatIsAgentHostSession', "如果聊天小组件锁定到智能体主机会话，则为 True。") });
	/**
	 * Widget-scoped: logical Agent Host provider ID for this chat widget, e.g. `copilotcli`, `claude`, or `codex`.
	 */
	export const chatAgentHostProviderId = new RawContextKey<string>('chatAgentHostProviderId', '', { type: 'string', description: localize('chatAgentHostProviderId', "聊天小组件锁定到智能体主机会话时的智能体主机提供程序 ID。") });
	/** Widget-scoped: whether the locked Agent Host provider pins an immutable primary working directory. */
	export const chatAgentHostHasImmutablePrimaryWorkingDirectory = new RawContextKey<boolean>('chatAgentHostHasImmutablePrimaryWorkingDirectory', false, { type: 'boolean', description: localize('chatAgentHostHasImmutablePrimaryWorkingDirectory', "True when the locked Agent Host provider pins an immutable primary working directory.") });
	/** Widget-scoped: whether the multi-root Folder picker should be shown for this session. Defaults to hidden; the harness decision reveals it, so the chip never flashes visible-then-hidden. */
	export const chatAgentHostFolderPickerVisible = new RawContextKey<boolean>('chatAgentHostFolderPickerVisible', false, { type: 'boolean', description: localize('chatAgentHostFolderPickerVisible', "True when the multi-root Folder picker should be shown for this Agent Host session (revealed by the harness decision).") });
	/**
	 * True when the chat session has a customAgentTarget defined in its contribution,
	 * which means the mode picker should be shown with filtered custom agents.
	 */
	export const chatSessionHasCustomAgentTarget = new RawContextKey<boolean>('chatSessionHasCustomAgentTarget', false, { type: 'boolean', description: localize('chatSessionHasCustomAgentTarget', "如果聊天会话定义了 customAgentTarget 来筛选模式，则为 True。") });
	/**
	 * True when the current chat session has models that specifically target it
	 * via `targetChatSessionType`, which means the model picker should be shown
	 * even when the widget is locked to a coding agent.
	 */
	export const chatSessionHasTargetedModels = new RawContextKey<boolean>('chatSessionHasTargetedModels', false, { type: 'boolean', description: localize('chatSessionHasTargetedModels', "如果聊天会话具有通过 targetChatSessionType 定位的语言模型，则为 True。") });
	export const agentSupportsAttachments = new RawContextKey<boolean>('agentSupportsAttachments', false, { type: 'boolean', description: localize('agentSupportsAttachments', "当聊天智能体支持附件时为 true。") });
	export const withinEditSessionDiff = new RawContextKey<boolean>('withinEditSessionDiff', false, { type: 'boolean', description: localize('withinEditSessionDiff', "当聊天小组件调度到编辑会话聊天时，为 True。") });
	export const filePartOfEditSession = new RawContextKey<boolean>('filePartOfEditSession', false, { type: 'boolean', description: localize('filePartOfEditSession', "当聊天小组件位于包含编辑会话的文件中时，为 True。") });

	export const extensionParticipantRegistered = new RawContextKey<boolean>('chatPanelExtensionParticipantRegistered', false, { type: 'boolean', description: localize('chatPanelExtensionParticipantRegistered', "为扩展面板注册默认聊天参与者时为 True。") });
	export const panelParticipantRegistered = new RawContextKey<boolean>('chatPanelParticipantRegistered', false, { type: 'boolean', description: localize('chatParticipantRegistered', "为面板注册默认聊天参与者时为 True。") });
	export const chatEditingCanUndo = new RawContextKey<boolean>('chatEditingCanUndo', false, { type: 'boolean', description: localize('chatEditingCanUndo', "如果可以在编辑面板中撤消交互，则为 True。") });
	export const chatEditingCanRedo = new RawContextKey<boolean>('chatEditingCanRedo', false, { type: 'boolean', description: localize('chatEditingCanRedo', "如果可以在编辑面板中重做交互，则为 True。") });
	export const languageModelsAreUserSelectable = new RawContextKey<boolean>('chatModelsAreUserSelectable', false, { type: 'boolean', description: localize('chatModelsAreUserSelectable', "如果用户可以手动选择聊天模型，则为 True。") });
	export const nonCopilotLanguageModelsAreUserSelectable = new RawContextKey<boolean>('chatNonCopilotModelsAreUserSelectable', false, { type: 'boolean', description: localize('chatNonCopilotModelsAreUserSelectable', "当存在来自非 Copilot 供应商的用户可选聊天模型时为 True。") });
	export const chatSessionHasModels = new RawContextKey<boolean>('chatSessionHasModels', false, { type: 'boolean', description: localize('chatSessionHasModels', "当聊天处于参与的聊天会话中且该会话有可用的“模型”显示时为 True。") });
	export const chatSessionOptionsValid = new RawContextKey<boolean>('chatSessionOptionsValid', true, { type: 'boolean', description: localize('chatSessionOptionsValid', "如果所有选定的会话选项都存在于各自的选项组项中，则为 true。") });
	export const extensionInvalid = new RawContextKey<boolean>('chatExtensionInvalid', false, { type: 'boolean', description: localize('chatExtensionInvalid', "已安装的聊天扩展无效且需要更新时为 True。") });
	export const inputCursorAtTop = new RawContextKey<boolean>('chatCursorAtTop', false);
	export const inputHasAgent = new RawContextKey<boolean>('chatInputHasAgent', false);
	export const location = new RawContextKey<ChatAgentLocation>('chatLocation', undefined);
	export const inQuickChat = new RawContextKey<boolean>('quickChatHasFocus', false, { type: 'boolean', description: localize('inQuickChat', "如果快速聊天 UI 具有焦点，则为 true，否则为 false。") });
	export const inAgentSessionsWelcome = new RawContextKey<boolean>('inAgentSessionsWelcome', false, { type: 'boolean', description: localize('inAgentSessionsWelcome', "如果聊天输入位于智能体会话欢迎页内，则为 True。") });
	export const inAutomationsDialog = new RawContextKey<boolean>('inAutomationsDialog', false, { type: 'boolean', description: localize('inAutomationsDialog', "True when the chat input is within the automations dialog.") });
	export const chatSessionType = new RawContextKey<string>('chatSessionType', '', { type: 'string', description: localize('chatSessionType', "当前聊天会话的类型。") });
	export const hasFileAttachments = new RawContextKey<boolean>('chatHasFileAttachments', false, { type: 'boolean', description: localize('chatHasFileAttachments', "当聊天有文件附件时为 True。") });
	export const chatSessionIsEmpty = new RawContextKey<boolean>('chatSessionIsEmpty', true, { type: 'boolean', description: localize('chatSessionIsEmpty', "当前聊天会话没有请求时为 True。") });
	export const hasPendingRequests = new RawContextKey<boolean>('chatHasPendingRequests', false, { type: 'boolean', description: localize('chatHasPendingRequests', "当队列中有待处理请求时，为 True。") });
	export const chatSessionHasDebugData = new RawContextKey<boolean>('chatSessionHasDebugData', false, { type: 'boolean', description: localize('chatSessionHasDebugData', "当前聊天会话有调试日志数据时为 True。") });
	export const chatSessionHasDebugTools = new RawContextKey<boolean>('chatSessionHasDebugTools', false, { type: 'boolean', description: localize('chatSessionHasDebugTools', "当前聊天会话中启用调试工具时为 True。") });

	export const remoteJobCreating = new RawContextKey<boolean>('chatRemoteJobCreating', false, { type: 'boolean', description: localize('chatRemoteJobCreating', "创建远程编码智能体作业时为 True。") });
	export const hasRemoteCodingAgent = new RawContextKey<boolean>('hasRemoteCodingAgent', false, localize('hasRemoteCodingAgent', "是否有可用的远程编码智能体"));
	export const hasCanDelegateProviders = new RawContextKey<boolean>('chatHasCanDelegateProviders', false, { type: 'boolean', description: localize('chatHasCanDelegateProviders', "如果存在可提供委派支持的聊天会话提供程序，则为 true。") });
	export const enableRemoteCodingAgentPromptFileOverlay = new RawContextKey<boolean>('enableRemoteCodingAgentPromptFileOverlay', false, localize('enableRemoteCodingAgentPromptFileOverlay', "是否启用远程编码智能体提示文件覆盖功能"));
	/** Used by the extension to skip the quit confirmation when #new wants to open a new folder */
	export const skipChatRequestInProgressMessage = new RawContextKey<boolean>('chatSkipRequestInProgressMessage', false, { type: 'boolean', description: localize('chatSkipRequestInProgressMessage', "如果应跳过“聊天请求正在进行中”消息，则为 True。") });

	// Re-exported from chat entitlement service
	export const Setup = ChatEntitlementContextKeys.Setup;
	export const Entitlement = ChatEntitlementContextKeys.Entitlement;
	export const chatQuotaExceeded = ChatEntitlementContextKeys.chatQuotaExceeded;
	export const completionsQuotaExceeded = ChatEntitlementContextKeys.completionsQuotaExceeded;

	export const Editing = {
		hasToolConfirmation: new RawContextKey<boolean>('chatHasToolConfirmation', false, { type: 'boolean', description: localize('chatEditingHasToolConfirmation', "如果存在工具确认，则为 True。") }),
		hasElicitationRequest: new RawContextKey<boolean>('chatHasElicitationRequest', false, { type: 'boolean', description: localize('chatEditingHasElicitationRequest', "当聊天诱导请求挂起时为 true。") }),
		hasQuestionCarousel: new RawContextKey<boolean>('chatHasQuestionCarousel', false, { type: 'boolean', description: localize('chatEditingHasQuestionCarousel', "当聊天输入中呈现问题轮播时，值为 True。") }),
	};

	export const Tools = {
		toolsCount: new RawContextKey<number>('toolsCount', 0, { type: 'number', description: localize('toolsCount', "聊天中可用工具的数量。") })
	};

	export const foregroundSessionCount = new RawContextKey<number>('chatForegroundSessionCount', 0, { type: 'number', description: localize('chatForegroundSessionCount', "各聊天界面中可见的前台聊天会话数量。") });

	export const Modes = {
		hasCustomChatModes: new RawContextKey<boolean>('chatHasCustomAgents', false, { type: 'boolean', description: localize('chatHasAgents', "如果聊天具有可用的自定义智能体，则为 True。") }),
		agentModeDisabledByPolicy: new RawContextKey<boolean>('chatAgentModeDisabledByPolicy', false, { type: 'boolean', description: localize('chatAgentModeDisabledByPolicy', "当组织策略禁用智能体模式时为 True。") }),
	};

	export const panelLocation = new RawContextKey<ViewContainerLocation>('chatPanelLocation', undefined, { type: 'number', description: localize('chatPanelLocation', "聊天面板的位置。") });

	export const agentSessionsViewerFocused = new RawContextKey<boolean>('agentSessionsViewerFocused', true, { type: 'boolean', description: localize('agentSessionsViewerFocused', "如果聊天视图中的代理会话视图是焦点。") });
	export const agentSessionsViewerOrientation = new RawContextKey<number>('agentSessionsViewerOrientation', undefined, { type: 'number', description: localize('agentSessionsViewerOrientation', "代理会话视图在聊天视图中的方向。") });
	export const agentSessionsViewerPosition = new RawContextKey<number>('agentSessionsViewerPosition', undefined, { type: 'number', description: localize('agentSessionsViewerPosition', "代理会话视图在聊天视图中的位置。") });
	export const agentSessionsViewerVisible = new RawContextKey<boolean>('agentSessionsViewerVisible', undefined, { type: 'boolean', description: localize('agentSessionsViewerVisible', "聊天视图中代理会话视图的可见性。") });
	export const agentSessionType = new RawContextKey<string>('chatSessionType', '', { type: 'string', description: localize('agentSessionType', "当前代理会话项的类型。") });
	export const isAgentSessionChild = new RawContextKey<boolean>('agentSessionIsChild', false, { type: 'boolean', description: localize('agentSessionIsChild', "True when the current agent session item is a child chat.") });
	/**
	 * Whether the agent session item has an associated pull request. Tri-state, so gate with
	 * `chatSessionPullRequest != 'none'` to keep contributions visible when the state is unknown.
	 */
	export const agentSessionPullRequest = new RawContextKey<string>('chatSessionPullRequest', '', { type: 'string', description: localize('agentSessionPullRequest', "Whether the current agent session item has an associated pull request: 'available' or 'none'. Unset when the pull request state is unknown.") });
	export const chatSessionSupportsDelegation = new RawContextKey<boolean>('chatSessionSupportsDelegation', true, { type: 'boolean', description: localize('chatSessionSupportsDelegation', "当前会话类型支持委派时为 True。") });
	export const hasPendingDelegationTarget = new RawContextKey<boolean>('chatHasPendingDelegationTarget', false, { type: 'boolean', description: localize('chatHasPendingDelegationTarget', "如果已选择委派(继续执行)目标，但尚未提交请求，则为 True。") });
	export const chatSessionSupportsFork = new RawContextKey<boolean>('chatSessionSupportsFork', false, { type: 'boolean', description: localize('chatSessionSupportsFork', "如果当前聊天会话提供程序支持分叉对话则为 True。") });
	export const chatSessionSupportsRename = new RawContextKey<boolean>('chatSessionSupportsRename', false, { type: 'boolean', description: localize('chatSessionSupportsRename', "True when the current chat session supports renaming.") });
	export const agentSessionSection = new RawContextKey<string>('agentSessionSection', '', { type: 'string', description: localize('agentSessionSection', "当前代理会话部分项的部分。") });
	export const isArchivedAgentSession = new RawContextKey<boolean>('agentSessionIsArchived', false, { type: 'boolean', description: localize('agentSessionIsArchived', "当聊天会话项存档时为 True。") });
	export const isPinnedAgentSession = new RawContextKey<boolean>('agentSessionIsPinned', false, { type: 'boolean', description: localize('agentSessionIsPinned', "固定智能体会话项时为 True。") });
	export const isReadAgentSession = new RawContextKey<boolean>('agentSessionIsRead', false, { type: 'boolean', description: localize('agentSessionIsRead', "当代理会话项已读时为 True。") });
	export const hasMultipleAgentSessionsSelected = new RawContextKey<boolean>('agentSessionHasMultipleSelected', false, { type: 'boolean', description: localize('agentSessionHasMultipleSelected', "选择多个智能体会话时为 True。") });
	export const hasAgentSessionChanges = new RawContextKey<boolean>('agentSessionHasChanges', false, { type: 'boolean', description: localize('agentSessionHasChanges', "当前代理会话项有更改时为 True。") });

	export const isKatexMathElement = new RawContextKey<boolean>('chatIsKatexMathElement', false, { type: 'boolean', description: localize('chatIsKatexMathElement', "聚焦 KaTeX 数学元素时为 true。") });

	/**
	 * True when the user has submitted a chat request using any of the `/create-*` slash commands.
	 * This is persisted in application storage and used to suppress onboarding tips once discovered.
	 */
	export const hasUsedCreateSlashCommands = new RawContextKey<boolean>('chatHasUsedCreateSlashCommands', false, { type: 'boolean', description: localize('chatHasUsedCreateSlashCommands', "当用户已使用任何 /create-* / 命令时为 true。") });

	export const contextUsageHasBeenOpened = new RawContextKey<boolean>('chatContextUsageHasBeenOpened', false, { type: 'boolean', description: localize('chatContextUsageHasBeenOpened', "当用户打开上下文窗口使用情况详细信息时为 True。") });

	export const newChatButtonExperimentIcon = new RawContextKey<string>('chatNewChatButtonExperimentIcon', '', { type: 'string', description: localize('chatNewChatButtonExperimentIcon', "“新建聊天”按钮的图标变体，由实验控制。取值: \"copilot\"、\"new-session\"、\"comment\"，或默认为空。") });
}

export namespace ChatContextKeyExprs {

	export const inEditingMode = ContextKeyExpr.or(
		ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Edit),
		ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Agent),
	);

	/**
	 * True when the locked coding agent is an Agent Host session.
	 * These sessions use {@link AgentHostSnapshotController} which supports checkpoint-based restore.
	 */
	export const isAgentHostSession = ChatContextKeys.chatIsAgentHostSession.isEqualTo(true);

	/**
	 * True when an agent session item (e.g. in the sessions viewer) is an agent
	 * host session (agent-host-* or remote-*). Keyed on {@link ChatContextKeys.agentSessionType}
	 * rather than the locked coding agent, for use in session item menus and keybindings.
	 */
	export const isAgentHostSessionItem = ContextKeyExpr.or(
		ContextKeyExpr.regex(ChatContextKeys.agentSessionType.key, /^agent-host-/),
		ContextKeyExpr.regex(ChatContextKeys.agentSessionType.key, /^remote-/),
	);
}
