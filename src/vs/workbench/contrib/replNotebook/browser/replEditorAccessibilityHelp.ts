/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IAccessibleViewImplementation } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { localize } from '../../../../nls.js';
import { AccessibleViewProviderId, AccessibleViewType, AccessibleContentProvider } from '../../../../platform/accessibility/browser/accessibleView.js';
import { AccessibilityVerbositySettingId } from '../../accessibility/browser/accessibilityConfiguration.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { IS_COMPOSITE_NOTEBOOK, NOTEBOOK_CELL_LIST_FOCUSED } from '../../notebook/common/notebookContextKeys.js';

export class ReplEditorInputAccessibilityHelp implements IAccessibleViewImplementation {
	readonly priority = 105;
	readonly name = 'REPL Editor Input';
	readonly when = ContextKeyExpr.and(IS_COMPOSITE_NOTEBOOK, NOTEBOOK_CELL_LIST_FOCUSED.negate());
	readonly type: AccessibleViewType = AccessibleViewType.Help;
	getProvider(accessor: ServicesAccessor) {
		return getAccessibilityHelpProvider(accessor.get(ICodeEditorService), getAccessibilityInputHelpText());
	}
}

function getAccessibilityInputHelpText(): string {
	return [
		localize('replEditor.inputOverview', "你位于 REPL 编辑器输入框中，此框将接受要在 REPL 中执行的代码。"),
		localize('replEditor.execute', "执行命令{0}将计算输入框中的表达式。", '<keybinding:repl.execute>'),
		localize('replEditor.configReadExecution', "设置“accessibility.replEditor.readLastExecutionOutput”控制执行完成时是否将自动读取输出。"),
		localize('replEditor.autoFocusRepl', "设置“accessibility.replEditor.autoFocusReplExecution”控制在执行代码后焦点是否会自动移动到 REPL。"),
		localize('replEditor.focusLastItemAdded', "Focus Last 执行命令{0} 会将焦点移动到 REPL 历史记录中最后执行的项。", '<keybinding:repl.focusLastItemExecuted>'),
		localize('replEditor.inputAccessibilityView', "从此输入框运行“打开访问性视图”命令{0} 时，上一次执行的输出将显示在辅助功能视图中。", '<keybinding:editor.action.accessibleView>'),
		localize('replEditor.focusReplInput', "焦点输入编辑器命令{0} 会将焦点恢复到此编辑器。", '<keybinding:repl.input.focus>'),
	].join('\n');
}

export class ReplEditorHistoryAccessibilityHelp implements IAccessibleViewImplementation {
	readonly priority = 105;
	readonly name = 'REPL Editor History';
	readonly when = ContextKeyExpr.and(IS_COMPOSITE_NOTEBOOK, NOTEBOOK_CELL_LIST_FOCUSED);
	readonly type: AccessibleViewType = AccessibleViewType.Help;
	getProvider(accessor: ServicesAccessor) {
		return getAccessibilityHelpProvider(accessor.get(ICodeEditorService), getAccessibilityHistoryHelpText());
	}
}

function getAccessibilityHistoryHelpText(): string {
	return [
		localize('replEditor.historyOverview', "你位于 REPL 历史记录中，此历史记录是已在 REPL 中执行的单元格的列表。每个单元格都有一个输入、一个输出和一个单元格容器。"),
		localize('replEditor.focusCellEditor', "“编辑单元格”命令{0} 会将焦点移动到单元格输入的只读编辑器。", '<keybinding:notebook.cell.edit>'),
		localize('replEditor.cellNavigation', "“退出编辑”命令{0} 将焦点移动到单元格容器，其中向上和向下箭头还会在历史记录中的单元格之间移动焦点。", '<keybinding:notebook.cell.quitEdit>'),
		localize('replEditor.accessibilityView', "浏览项目输出的可访问视图的历史记录时，运行“打开访问性视图”命令{0}。", '<keybinding:editor.action.accessibleView>'),
		localize('replEditor.focusInOutput', "聚焦输出命令{0}会在聚焦于以前执行的项时将焦点设在输出上。", '<keybinding:notebook.cell.focusInOutput>'),
		localize('replEditor.focusReplInputFromHistory', "聚焦输入编辑器命令{0}会将焦点移动到 REPL 输入框。", '<keybinding:repl.input.focus>'),
		localize('replEditor.focusLastItemAdded', "Focus Last 执行命令{0} 会将焦点移动到 REPL 历史记录中最后执行的项。", '<keybinding:repl.focusLastItemExecuted>'),
	].join('\n');
}

function getAccessibilityHelpProvider(editorService: ICodeEditorService, helpText: string) {
	const activeEditor = editorService.getActiveCodeEditor()
		|| editorService.getFocusedCodeEditor();

	if (!activeEditor) {
		return;
	}

	return new AccessibleContentProvider(
		AccessibleViewProviderId.ReplEditor,
		{ type: AccessibleViewType.Help },
		() => helpText,
		() => activeEditor.focus(),
		AccessibilityVerbositySettingId.ReplEditor,
	);
}
