/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IAccessibleViewImplementation } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { IS_COMPOSITE_NOTEBOOK, NOTEBOOK_EDITOR_FOCUSED } from '../common/notebookContextKeys.js';
import { localize } from '../../../../nls.js';
import { ICodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { AccessibleViewProviderId, AccessibleViewType, AccessibleContentProvider } from '../../../../platform/accessibility/browser/accessibleView.js';
import { AccessibilityVerbositySettingId } from '../../accessibility/browser/accessibilityConfiguration.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IVisibleEditorPane } from '../../../common/editor.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';

export class NotebookAccessibilityHelp implements IAccessibleViewImplementation {
	readonly priority = 105;
	readonly name = 'notebook';
	readonly when = ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, IS_COMPOSITE_NOTEBOOK.negate());
	readonly type: AccessibleViewType = AccessibleViewType.Help;
	getProvider(accessor: ServicesAccessor) {
		const activeEditor = accessor.get(ICodeEditorService).getActiveCodeEditor()
			|| accessor.get(ICodeEditorService).getFocusedCodeEditor()
			|| accessor.get(IEditorService).activeEditorPane;

		if (!activeEditor) {
			return;
		}
		return getAccessibilityHelpProvider(accessor, activeEditor);
	}
}

function getAccessibilityHelpText(): string {
	return [
		localize('notebook.overview', "笔记本视图是代码单元格和 Markdown 单元格的集合。可以执行代码单元格，该单元格下方将直接生成输出。"),
		localize('notebook.cell.edit', "“编辑单元格”命令 {0} 将焦点放在单元格输入上。", '<keybinding:notebook.cell.edit>'),
		localize('notebook.cell.quitEdit', "“退出编辑”命令 {0} 将焦点设置在单元格容器上。如果虚拟光标处于活动状态，则可能需要先按两次默认(Escape)键才会退出虚拟光标。", '<keybinding:notebook.cell.quitEdit>'),
		localize('notebook.cell.focusInOutput', "“焦点输出”命令 {0} 将在单元格的输出中设置焦点。", '<keybinding:notebook.cell.focusInOutput>'),
		localize('notebook.focusNextEditor', "“聚焦到下一个单元格编辑器”命令 {0} 将在下一个单元格的编辑器中设置焦点。", '<keybinding:notebook.focusNextEditor>'),
		localize('notebook.focusPreviousEditor', "“聚焦到上一个单元格编辑器”命令 {0} 将在上一个单元格的编辑器中设置焦点。", '<keybinding:notebook.focusPreviousEditor>'),
		localize('notebook.cellNavigation', "焦点位于外部单元格容器上时，向上和向下箭头也将在单元格之间移动焦点。"),
		localize('notebook.cell.executeAndFocusContainer', "“执行单元格”命令 {0} 执行当前具有焦点的单元格。", '<keybinding:notebook.cell.executeAndFocusContainer>'),
		localize('notebook.cell.insertCodeCellBelowAndFocusContainer', "“在上方 {0} 和下方 {1} 插入单元格”命令将创建新的空代码单元格。", '<keybinding:notebook.cell.insertCodeCellAbove>', '<keybinding:notebook.cell.insertCodeCellBelow>'),
		localize('notebook.changeCellType', "“将单元格更改为代码/Markdown”命令用于在单元格类型之间切换。")
	].join('\n');
}

function getAccessibilityHelpProvider(accessor: ServicesAccessor, editor: ICodeEditor | IVisibleEditorPane) {
	const helpText = getAccessibilityHelpText();
	return new AccessibleContentProvider(
		AccessibleViewProviderId.Notebook,
		{ type: AccessibleViewType.Help },
		() => helpText,
		() => editor.focus(),
		AccessibilityVerbositySettingId.Notebook,
	);
}
