/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../nls.js';
import { ContextKeyExpr, RawContextKey } from '../../platform/contextkey/common/contextkey.js';
import { AuxiliaryBarFocusContext, EditorAreaFocusContext } from '../../workbench/common/contextkeys.js';

//#region < --- Active Session --- >

export const IsNewChatSessionContext = new RawContextKey<boolean>('isNewChatSession', true);
export const NewSessionOnboardingHandoffContext = new RawContextKey<boolean>('newSessionOnboardingHandoff', false);
export const SessionIdContext = new RawContextKey<string>('sessionId', '', localize('sessionId', "范围中会话(全局活动会话，或会话视图或上下文菜单覆盖等独立组件中的特定会话)的标识符"));
export const SessionProviderIdContext = new RawContextKey<string>('sessionProviderId', '', localize('sessionProviderId', "范围中会话(全局活动会话，或会话视图或上下文菜单覆盖等独立组件中的特定会话)的提供程序 ID"));
export const SessionTypeContext = new RawContextKey<string>('sessionType', '', localize('sessionType', "范围中会话(全局活动会话，或会话视图或上下文菜单覆盖等独立组件中的特定会话)的会话类型"));
export const SessionWorkspaceIsVirtualContext = new RawContextKey<boolean>('sessionWorkspaceIsVirtual', true, localize('sessionWorkspaceIsVirtual', "会话的工作区是否为虚拟工作区"));
export const SessionHasGitRepositoryContext = new RawContextKey<boolean>('sessionHasGitRepository', false, localize('sessionHasGitRepository', "会话是否具有关联的 Git 存储库"));
export const SessionUsesCombinedConfigPickerContext = new RawContextKey<boolean>('sessionUsesCombinedConfigPicker', false, localize('sessionUsesCombinedConfigPicker', "会话的提供程序是否提供组合模式和模型配置选取器(用于代替独立选取器的手机布局)"));
export const SessionSupportsRenameContext = new RawContextKey<boolean>('sessionSupportsRename', false, localize('sessionSupportsRename', "是否可以重命名会话"));
export const SessionSupportsDeleteContext = new RawContextKey<boolean>('sessionSupportsDelete', false, localize('sessionSupportsDelete', "是否可以删除会话"));

//#endregion

//#region < --- Session View --- >

export const SessionIsCreatedContext = new RawContextKey<boolean>('sessionIsCreated', false, localize('sessionIsCreated', "会话视图的会话是否已创建(显示聊天视图，而非新会话视图)"));
export const SessionIsStickyContext = new RawContextKey<boolean>('sessionIsSticky', false, localize('sessionIsSticky', "会话视图的会话是否在网格中固定"));
export const SessionIsMaximizedContext = new RawContextKey<boolean>('sessionIsMaximized', false, localize('sessionIsMaximized', "会话视图当前是否在会话部分的网格中最大化"));
export const SessionSupportsMultipleChatsContext = new RawContextKey<boolean>('sessionSupportsMultipleChats', false, localize('sessionSupportsMultipleChats', "会话视图的会话是否支持多个聊天"));
export const SessionSupportsForkContext = new RawContextKey<boolean>('sessionSupportsFork', false, localize('sessionSupportsFork', "Whether the session view's session supports forking a chat from a turn into a new peer chat"));
export const SessionSupportsSideChatContext = new RawContextKey<boolean>('sessionSupportsSideChat', false, localize('sessionSupportsSideChat', "Whether the session view's session supports creating a side chat from a turn (via /btw)"));
export const SessionHasMultipleCommittedChatsContext = new RawContextKey<boolean>('sessionHasMultipleCommittedChats', false, localize('sessionHasMultipleCommittedChats', "会话视图的会话是否具有多个已提交(非草稿)聊天，这会提供“对话”菜单可见性"));
export const SessionActiveChatResourceContext = new RawContextKey<string>('sessionActiveChatResource', '', localize('sessionActiveChatResource', "The resource of the chat represented by the session or chat header"));
export const SessionActiveChatHasSideChatsContext = new RawContextKey<boolean>('sessionActiveChatHasSideChats', false, localize('sessionActiveChatHasSideChats', "Whether the chat represented by the session or chat header has side chats"));
export const SessionShouldShowChatTabsContext = new RawContextKey<boolean>('sessionShouldShowChatTabs', false, localize('sessionShouldShowChatTabs', "Whether the session view's chat tab strip is shown, i.e. the session has more than one chat actually showing as a tab. A single visible tab always hides the strip"));
export const SessionHasMultipleOpenChatsContext = new RawContextKey<boolean>('sessionHasMultipleOpenChats', false, localize('sessionHasMultipleOpenChats', "Whether the session view's session has more than one open chat (the tabs shown in the strip, including in-composer drafts). Used to scope chat-to-chat navigation (next/previous chat, the Ctrl+Tab chat switcher)"));
export const SessionActiveChatIsClosableContext = new RawContextKey<boolean>('sessionActiveChatIsClosable', false, localize('sessionActiveChatIsClosable', "Whether the active chat surface can be closed, either by hiding a non-main chat or by removing a side-by-side chat group"));
export const SessionHeaderShowsChatContext = new RawContextKey<boolean>('sessionHeaderShowsChat', false, localize('sessionHeaderShowsChat', "Whether the session-style header represents one chat in a side-by-side chat group rather than the whole session"));
export const SessionHeaderActiveChatIsPinnedContext = new RawContextKey<boolean>('sessionHeaderActiveChatIsPinned', false, localize('sessionHeaderActiveChatIsPinned', "Whether the chat represented by a side-by-side chat group header is pinned"));
export const SessionFocusedChatIsRenameTargetContext = new RawContextKey<boolean>('sessionFocusedChatIsRenameTarget', false, localize('sessionFocusedChatIsRenameTarget', "Whether the focused chat group's visible chat is a non-main chat that should receive the chat-specific rename command instead of the session rename command"));
export const SessionActiveChatIsDeletableContext = new RawContextKey<boolean>('sessionActiveChatIsDeletable', false, localize('sessionActiveChatIsDeletable', "Whether the session's active chat can be permanently deleted from the tab strip, i.e. it is a real, user-created non-main chat (not the main chat and not a tool-spawned subagent chat, which are transient children). Used to scope the delete-chat keybinding"));
export const SessionIsReadContext = new RawContextKey<boolean>('sessionIsRead', true, localize('sessionIsRead', "会话是否已标记为已读"));
export const SessionIsArchivedContext = new RawContextKey<boolean>('sessionIsArchived', false, localize('sessionIsArchived', "范围中的会话是否存档/标记为已完成(全局活动会话，或会话视图或上下文菜单覆盖等独立组件中的特定会话)"));
export const SessionIsActiveContext = new RawContextKey<boolean>('sessionIsActive', false, localize('sessionIsActive', "Whether the session in scope is in progress or needs input"));
export const SessionHasChangesContext = new RawContextKey<boolean>('sessionHasChanges', false, localize('sessionHasChanges', "会话视图的会话是否有待处理的更改(插入或删除)"));
export const SessionHasCachedChangesContext = new RawContextKey<boolean>('sessionHasCachedChanges', false, localize('sessionHasCachedChanges', "Whether the session view's session has remembered changes from the last time its changes pill was shown, while it has not reported its own changes yet. Used to render the changes pill optimistically when a session opens"));
export const SessionHasPullRequestContext = new RawContextKey<boolean>('sessionHasPullRequest', false, localize('sessionHasPullRequest', "会话视图的会话是否与 GitHub 拉取请求相关联"));
export const SessionHasIssuesContext = new RawContextKey<boolean>('sessionHasIssues', false, localize('sessionHasIssues', "Whether the session view's session references at least one GitHub issue"));
export const SessionHasWorkspaceContext = new RawContextKey<boolean>('sessionHasWorkspace', false, localize('sessionHasWorkspace', "会话视图的会话是否具有关联的工作区文件夹"));
export const SessionsChatBackgroundAvailableContext = new RawContextKey<boolean>('sessionsChatBackgroundAvailable', false, localize('sessionsChatBackgroundAvailable', "Whether chat background customization is available for the current color theme"));
export const SessionsChatBackgroundConfiguredContext = new RawContextKey<boolean>('sessionsChatBackgroundConfigured', false, localize('sessionsChatBackgroundConfigured', "Whether a chat background is configured for the current color theme"));
export const SessionsChatBackgroundImageConfiguredContext = new RawContextKey<boolean>('sessionsChatBackgroundImageConfigured', false, localize('sessionsChatBackgroundImageConfigured', "Whether a chat background image is configured for the current color theme"));
export const IsQuickChatSessionContext = new RawContextKey<boolean>('isQuickChatSession', false, localize('isQuickChatSession', "Whether the session in scope is a workspace-less quick chat"));

//#endregion

//#region < --- Sessions Part --- >

export const ActiveSessionsContext = new RawContextKey<string>('activeSessions', '', localize('activeSessions', "活动会话面板的标识符"));
export const SessionsFocusContext = new RawContextKey<boolean>('sessionsFocus', false, localize('sessionsFocus', "会话部分是否拥有键盘焦点"));
export const SessionsVisibleContext = new RawContextKey<boolean>('sessionsVisible', false, localize('sessionsVisible', "会话部分是否可见"));
export const MultipleSessionsVisibleContext = new RawContextKey<boolean>('multipleSessionsVisible', false, localize('multipleSessionsVisible', "会话部分的网格中是否可见多个会话"));
export const SessionsHasClosedItemContext = new RawContextKey<boolean>('sessionsHasClosedItem', false, localize('sessionsHasClosedItem', "Whether a chat or session was closed recently and can be reopened with the Reopen Closed Chat or Session command"));

/**
 * Focus is inside the Agents window's editor surface: an editor part, or the
 * auxiliary bar, which the single-pane layout docks into the side pane as the
 * detail panel (Files/Changes). Shortcuts shared with VS Code's editor
 * commands defer to those commands while this holds.
 */
export const SessionsEditorScopeContext = ContextKeyExpr.or(EditorAreaFocusContext, AuxiliaryBarFocusContext)!;

//#endregion

//#region < --- Custom View Grid --- >

export const CustomViewVisibleContext = new RawContextKey<boolean>('customViewVisible', false, localize('customViewVisible', "Whether a custom view is shown in place of the sessions grid. The side panel and the panel are hidden while it is."));
export const AutomationsCustomViewFocusContext = new RawContextKey<boolean>('automationsCustomViewFocus', false, localize('automationsCustomViewFocus', "Whether the Automations custom view has keyboard focus"));
export const AutomationsHasItemsContext = new RawContextKey<boolean>('automationsHasItems', false, localize('automationsHasItems', "Whether there is at least one automation"));

//#endregion

//#region < --- Changes --- >

/**
 * Id of the first pull request operation the agent host currently advertises
 * for the active session (for example `pr-merge`), or the empty string when
 * none is advertised. Lets client-side contributions to the changes button bar
 * react to the pull request's live state without duplicating it.
 */
export const SessionPrimaryPullRequestOperationContext = new RawContextKey<string>('sessionPrimaryPullRequestOperation', '', localize('sessionPrimaryPullRequestOperation', "The id of the first pull request operation advertised for the active session, or empty when there is none"));

/** Whether Agent Merge is currently enabled on the active session. */
export const SessionAgentMergeEnabledContext = new RawContextKey<boolean>('sessionAgentMergeEnabled', false, localize('sessionAgentMergeEnabled', "True when Agent Merge is enabled for the active agent session"));

/**
 * Whether the active session has an open pull request, independent of whether
 * the agent host has any operation to offer for it. A pull request that is
 * open but blocked — and whose repository does not allow auto-merge — offers
 * no operation, yet is exactly when Agent Merge has work to do.
 */
export const SessionHasOpenPullRequestContext = new RawContextKey<boolean>('sessionHasOpenPullRequest', false, localize('sessionHasOpenPullRequest', "Whether the active session's branch has an open pull request"));

//#endregion

//#region < --- Welcome --- >

export const SessionsWelcomeVisibleContext = new RawContextKey<boolean>('sessionsWelcomeVisible', false, localize('sessionsWelcomeVisible', "会话欢迎覆盖层是否可见"));

//#endregion

//#region < --- Experiments --- >

export const SessionsTitleBarNewSessionEnabledContext = new RawContextKey<boolean>('sessionsTitleBarNewSessionEnabled', false, localize('sessionsTitleBarNewSessionEnabled', "隐藏会话列表时，新会话按钮是否显示在标题栏中(A/B 试验)"));
export const SessionsListPromoteNewChatActionContext = new RawContextKey<boolean>('sessionsListPromoteNewChatAction', false, localize('sessionsListPromoteNewChatAction', "Whether New Chat in This Session replaces Pin or Unpin as the primary action on session rows (A/B experiment)"));

//#endregion

//#region < --- Workspace Picker --- >

export const SessionWorkspacePickerGroupContext = new RawContextKey<string>('sessionWorkspacePickerGroup', '', localize('sessionWorkspacePickerGroup', "会话工作区选取器中当前活动的组选项卡"));

//#endregion

//#region < --- New Session Pickers --- >

export const NewSessionCreationProviderIdContext = new RawContextKey<string>('newSessionCreationProviderId', '', localize('newSessionCreationProviderId', "The provider selected for new session creation before a draft exists"));
export const SessionWorkspacePickerVisibleContext = new RawContextKey<boolean>('sessionWorkspacePickerVisible', false, localize('sessionWorkspacePickerVisible', "是否呈现新会话视图的工作区选取器(而不是被 no-agent-host 空状态替换)"));
export const SessionHarnessPickerVisibleContext = new RawContextKey<boolean>('sessionHarnessPickerVisible', false, localize('sessionHarnessPickerVisible', "新会话视图的工作模式(会话类型)选取器是否可见 - 当最多一个工作模式可以为所选工作区提供服务时将隐藏它"));
export const SessionIsolationPickerVisibleContext = new RawContextKey<boolean>('sessionIsolationPickerVisible', false, localize('sessionIsolationPickerVisible', "新会话视图的隔离选取器是否可见 - 只有在启用隔离选项且工作区具有 git 存储库时才会显示它"));
export const AgentHostSessionTypesAvailableContext = new RawContextKey<boolean>('agentHostSessionTypesAvailable', false, localize('agentHostSessionTypesAvailable', "Whether at least one connected agent-host provider has advertised session types"));

//#endregion

//#region < --- Sessions Picker --- >

export const SessionsPickerVisibleContext = new RawContextKey<boolean>('sessionsPickerVisible', false, localize('sessionsPickerVisible', "会话选取器是否可见"));
export const SessionChatsPickerVisibleContext = new RawContextKey<boolean>('sessionChatsPickerVisible', false, localize('sessionChatsPickerVisible', "Whether the chats picker (chats within the active session) is visible"));

//#endregion

//#region < --- Blocked Sessions --- >

export const SessionsBlockedSessionsVisibleContext = new RawContextKey<boolean>('sessionsBlockedSessionsVisible', false, localize('sessionsBlockedSessionsVisible', "Whether the blocked-sessions dropdown (surfacing sessions that require input) is open in the sessions titlebar"));

//#endregion

//#region < --- Aquarium --- >

export const SessionsAquariumActiveContext = new RawContextKey<boolean>('sessionsAquariumActive', false, localize('sessionsAquariumActive', "会话水族馆覆盖是否处于活动状态"));

//#endregion

//#region < --- Session Navigation --- >

export const CanGoBackContext = new RawContextKey<boolean>('sessionsCanGoBack', false, localize('sessionsCanGoBack', "导航历史记录中是否存在上一个会话"));
export const CanGoForwardContext = new RawContextKey<boolean>('sessionsCanGoForward', false, localize('sessionsCanGoForward', "导航历史记录中是否存在下一个会话"));

//#endregion

//#region < --- Editor --- >

export const EditorMaximizedContext = new RawContextKey<boolean>('editorMaximized', false, localize('editorMaximized', "编辑器区域是否已最大化"));
export const SinglePaneLayoutEnabledContext = new RawContextKey<boolean>('agentSessionsSinglePaneLayoutEnabled', false, localize('agentSessionsSinglePaneLayoutEnabled', "Whether the Agents window is using the single-pane (docked detail panel) layout. Single source of truth for gating single-pane behaviour — set once by the workbench from the layout it was constructed with; features must read this instead of the underlying setting"));
export const SinglePaneChangesEditorTransitionContext = new RawContextKey<boolean>('agentSessionsSinglePaneChangesEditorTransition', false, localize('agentSessionsSinglePaneChangesEditorTransition', "Whether the single-pane Changes editor is being replaced during a session switch"));
export const HasDockedDetailsContext = new RawContextKey<boolean>('agentSessionsHasDockedDetails', false, localize('agentSessionsHasDockedDetails', "Whether the single-pane active editor has a docked detail panel (a managed Changes/Files tab or a text file editor)"));
export const SinglePaneDiffEditorInputActiveContext = new RawContextKey<boolean>('agentSessionsSinglePaneDiffEditorInputActive', false, localize('agentSessionsSinglePaneDiffEditorInputActive', "Whether the active single-pane editor input is a diff, independent of the editor used to render it"));
export const SinglePaneChangesTabMissingContext = new RawContextKey<boolean>('agentSessionsSinglePaneChangesTabMissing', false, localize('agentSessionsSinglePaneChangesTabMissing', "Whether the single-pane session supports a Changes editor but its tab is not currently open"));
export const SinglePaneFilesTabMissingContext = new RawContextKey<boolean>('agentSessionsSinglePaneFilesTabMissing', false, localize('agentSessionsSinglePaneFilesTabMissing', "Whether the single-pane session supports a Files tab but its tab is not currently open"));
export const SinglePaneChangesTabAvailableContext = new RawContextKey<boolean>('agentSessionsSinglePaneChangesTabAvailable', false, localize('agentSessionsSinglePaneChangesTabAvailable', "Whether the single-pane session supports a Changes editor"));
export const SinglePaneFilesTabAvailableContext = new RawContextKey<boolean>('agentSessionsSinglePaneFilesTabAvailable', false, localize('agentSessionsSinglePaneFilesTabAvailable', "Whether the single-pane session supports a Files editor"));

//#endregion

//#region < --- Mobile Layout --- >

export const IsPhoneLayoutContext = new RawContextKey<boolean>('sessionsIsPhoneLayout', false, localize('sessionsIsPhoneLayout', "当前布局是否为手机布局"));
export const KeyboardVisibleContext = new RawContextKey<boolean>('sessionsKeyboardVisible', false, localize('sessionsKeyboardVisible', "虚拟键盘是否可见"));

//#endregion
