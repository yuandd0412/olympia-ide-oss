/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../nls.js';

export namespace AccessibilityHelpNLS {
	export const accessibilityHelpTitle = nls.localize('accessibilityHelpTitle', "无障碍说明");
	export const openingDocs = nls.localize("openingDocs", "正在打开无障碍功能文档页面。");
	export const readonlyDiffEditor = nls.localize("readonlyDiffEditor", "你位于差异编辑器的只读窗格中。");
	export const editableDiffEditor = nls.localize("editableDiffEditor", "你位于差异编辑器的一个窗格中。");
	export const readonlyEditor = nls.localize("readonlyEditor", "你位于只读的代码编辑器中。");
	export const editableEditor = nls.localize("editableEditor", "你位于代码编辑器中。");
	export const defaultWindowTitleIncludesEditorState = nls.localize("defaultWindowTitleIncludesEditorState", "默认情况下，窗口标题设置中会包含活动编辑器状态（如已修改、问题等）。可通过 accessibility.windowTitleOptimized 禁用。");
	export const defaultWindowTitleExcludingEditorState = nls.localize("defaultWindowTitleExcludingEditorState", "默认情况下，窗口标题设置中不包含活动编辑器状态（如已修改、问题等）。可通过 accessibility.windowTitleOptimized 启用。");
	export const toolbar = nls.localize("toolbar", "在工作台中，当屏幕阅读器提示你已进入工具栏时，可用左右方向键在工具栏的操作项之间导航。");
	export const changeConfigToOnMac = nls.localize("changeConfigToOnMac", "将应用配置为针对屏幕阅读器优化（Command+E）。");
	export const changeConfigToOnWinLinux = nls.localize("changeConfigToOnWinLinux", "将应用配置为针对屏幕阅读器优化（Control+E）。");
	export const auto_on = nls.localize("auto_on", "应用已配置为针对屏幕阅读器优化。");
	export const auto_off = nls.localize("auto_off", "应用已配置为永不对屏幕阅读器做优化。");
	export const screenReaderModeEnabled = nls.localize("screenReaderModeEnabled", "已启用屏幕阅读器优化模式。");
	export const screenReaderModeDisabled = nls.localize("screenReaderModeDisabled", "已禁用屏幕阅读器优化模式。");
	export const tabFocusModeOnMsg = nls.localize("tabFocusModeOnMsg", "在当前编辑器中按 Tab 键会将焦点移到下一个可聚焦元素。切换此行为{0}。", '<keybinding:editor.action.toggleTabFocusMode>');
	export const tabFocusModeOffMsg = nls.localize("tabFocusModeOffMsg", "在当前编辑器中按 Tab 键会插入制表符。切换此行为{0}。", '<keybinding:editor.action.toggleTabFocusMode>');
	export const stickScroll = nls.localize("stickScrollKb", "聚焦粘性滚动{0}以聚焦当前嵌套的作用域。", '<keybinding:editor.action.focusStickyDebugConsole>');
	export const suggestActions = nls.localize("suggestActionsKb", "触发表建议控件{0}以显示可能的内联建议。", '<keybinding:editor.action.triggerSuggest>');
	export const acceptSuggestAction = nls.localize("acceptSuggestAction", "接受建议{0}以接受当前选中的建议。", '<keybinding:acceptSelectedSuggestion>');
	export const toggleSuggestionFocus = nls.localize("toggleSuggestionFocus", "在建议控件和编辑器之间切换焦点{0}，并用{1}切换详情焦点以了解建议的更多信息。", '<keybinding:focusSuggestion>', '<keybinding:toggleSuggestionFocus>');
	export const codeFolding = nls.localize("codeFolding", "使用代码折叠收起代码块，并通过\"切换折叠\"命令{0}聚焦你关心的代码。", '<keybinding:editor.toggleFold>');
	export const intellisense = nls.localize("intellisense", "使用 IntelliSense 提高编码效率并减少错误。触发建议{0}。", '<keybinding:editor.action.triggerSuggest>');
	export const showOrFocusHover = nls.localize("showOrFocusHover", "显示或聚焦悬停{0}以查看当前符号的信息。", '<keybinding:editor.action.showHover>');
	export const goToSymbol = nls.localize("goToSymbol", "转到符号{0}以在当前文件的符号之间快速导航。", '<keybinding:workbench.action.gotoSymbol>');
	export const showAccessibilityHelpAction = nls.localize("showAccessibilityHelpAction", "显示无障碍功能帮助");
	export const listSignalSounds = nls.localize("listSignalSoundsCommand", "运行命令\"List Signal Sounds（列出提示音）\"可查看所有提示音及其当前状态。");
	export const listAlerts = nls.localize("listAnnouncementsCommand", "运行命令\"List Signal Announcements（列出播报）\"可查看所有播报及其当前状态。");
	export const announceCursorPosition = nls.localize("announceCursorPosition", "运行命令\"Announce Cursor Position（播报光标位置）\"{0}以听取当前行列号。", '<keybinding:editor.action.announceCursorPosition>');
	export const focusNotifications = nls.localize("focusNotifications", "聚焦通知弹出项{0}以使用键盘导航。接受已聚焦通知的主要操作{1}。", '<keybinding:notifications.focusToasts>', '<keybinding:notification.acceptPrimaryAction>');
	export const quickChat = nls.localize("quickChatCommand", "切换快速聊天{0}以打开或关闭聊天会话。", '<keybinding:workbench.action.quickchat.toggle>');
	export const startInlineChat = nls.localize("startInlineChatCommand", "启动内联聊天{0}以在编辑器中创建聊天会话。", '<keybinding:inlineChat.start>');
	export const startDebugging = nls.localize('debug.startDebugging', "「调试：开始调试」命令{0}将启动一个调试会话。", '<keybinding:workbench.action.debug.start>');
	export const setBreakpoint = nls.localize('debugConsole.setBreakpoint', "\"调试: 内联断点\"命令{0}将在活动编辑器的当前光标位置设置或取消断点。", '<keybinding:editor.debug.action.toggleInlineBreakpoint>');
	export const addToWatch = nls.localize('debugConsole.addToWatch', "\"调试: 添加到监视\"命令{0}会将选中的文本添加到监视视图。", '<keybinding:editor.debug.action.selectionToWatch>');
	export const debugExecuteSelection = nls.localize('debugConsole.executeSelection', "\"调试: 执行所选内容\"命令{0}将在调试控制台中执行选中的文本。", '<keybinding:editor.debug.action.selectionToRepl>');
	export const chatEditorModification = nls.localize('chatEditorModification', "编辑器中包含由聊天产生的待处理修改。");
	export const chatEditorRequestInProgress = nls.localize('chatEditorRequestInProgress', "编辑器正在等待聊天产生的修改。");
	export const chatEditActions = nls.localize('chatEditing.navigation', "使用\"上一个\"{0}和\"下一个\"{1}在编辑器中的修改之间导航，并对当前更改\"接受\"{2}、\"拒绝\"{3}或\"查看差异\"{4}。接受所有文件的修改{5}。", '<keybinding:chatEditor.action.navigatePrevious>', '<keybinding:chatEditor.action.navigateNext>', '<keybinding:chatEditor.action.acceptHunk>', '<keybinding:chatEditor.action.undoHunk>', '<keybinding:chatEditor.action.toggleDiff>', '<keybinding:chatEditor.action.acceptAllEdits>');
	export const editorDictation = nls.localize('editorDictation', "在编辑器中开始或停止听写{0}。", '<keybinding:workbench.action.editorDictation.start>');
}

export namespace InspectTokensNLS {
	export const inspectTokensAction = nls.localize('inspectTokens', "开发者: 检查词元");
}

export namespace GoToLineNLS {
	export const gotoLineActionLabel = nls.localize('gotoLineActionLabel', "转到行/列...");
	export const gotoOffsetActionLabel = nls.localize('gotoOffsetActionLabel', "转到偏移量...");
}

export namespace QuickHelpNLS {
	export const helpQuickAccessActionLabel = nls.localize('helpQuickAccess', "显示所有快速访问提供程序");
}

export namespace QuickCommandNLS {
	export const quickCommandActionLabel = nls.localize('quickCommandActionLabel', "命令面板");
	export const quickCommandHelp = nls.localize('quickCommandActionHelp', "显示并运行命令");
}

export namespace QuickOutlineNLS {
	export const quickOutlineActionLabel = nls.localize('quickOutlineActionLabel', "转到符号...");
	export const quickOutlineByCategoryActionLabel = nls.localize('quickOutlineByCategoryActionLabel', "按类别转到符号...");
}

export namespace StandaloneCodeEditorNLS {
	export const editorViewAccessibleLabel = nls.localize('editorViewAccessibleLabel', "编辑器内容");
}

export namespace ToggleHighContrastNLS {
	export const toggleHighContrast = nls.localize('toggleHighContrast', "切换高对比度主题");
}

export namespace StandaloneServicesNLS {
	export const bulkEditServiceSummary = nls.localize('bulkEditServiceSummary', "已在 {1} 个文件中完成 {0} 处修改");
}
