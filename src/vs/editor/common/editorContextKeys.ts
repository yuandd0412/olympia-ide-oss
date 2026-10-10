/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../nls.js';
import { RawContextKey } from '../../platform/contextkey/common/contextkey.js';

export namespace EditorContextKeys {

	export const editorSimpleInput = new RawContextKey<boolean>('editorSimpleInput', false, true);
	/**
	 * A context key that is set when the editor's text has focus (cursor is blinking).
	 * Is false when focus is in simple editor widgets (repl input, scm commit input).
	 */
	export const editorTextFocus = new RawContextKey<boolean>('editorTextFocus', false, nls.localize('editorTextFocus', "编辑器文本是否获得焦点（光标闪烁）"));
	/**
	 * A context key that is set when the editor's text or an editor's widget has focus.
	 */
	export const focus = new RawContextKey<boolean>('editorFocus', false, nls.localize('editorFocus', "编辑器或编辑器部件是否获得焦点（例如焦点在查找小部件中）"));

	/**
	 * A context key that is set when any editor input has focus (regular editor, repl input...).
	 */
	export const textInputFocus = new RawContextKey<boolean>('textInputFocus', false, nls.localize('textInputFocus', "编辑器或富文本输入框是否获得焦点（光标闪烁）"));

	export const readOnly = new RawContextKey<boolean>('editorReadonly', false, nls.localize('editorReadonly', "编辑器是否为只读"));
	export const inDiffEditor = new RawContextKey<boolean>('inDiffEditor', false, nls.localize('inDiffEditor', "当前上下文是否为差异编辑器"));
	export const isEmbeddedDiffEditor = new RawContextKey<boolean>('isEmbeddedDiffEditor', false, nls.localize('isEmbeddedDiffEditor', "当前上下文是否为嵌入式差异编辑器"));
	export const inMultiDiffEditor = new RawContextKey<boolean>('inMultiDiffEditor', false, nls.localize('inMultiDiffEditor', "当前上下文是否为多文件差异编辑器"));
	export const multiDiffEditorAllCollapsed = new RawContextKey<boolean>('multiDiffEditorAllCollapsed', undefined, nls.localize('multiDiffEditorAllCollapsed', "多文件差异编辑器中的所有文件是否都已折叠"));
	export const multiDiffEditorItemAllUnchangedRegionsShown = new RawContextKey<boolean>('multiDiffEditorItemAllUnchangedRegionsShown', false, nls.localize('multiDiffEditorItemAllUnchangedRegionsShown', "多文件差异编辑器文件中的所有未更改区域是否都已展开"));
	export const multiDiffEditorRenderSideBySide = new RawContextKey<boolean>('multiDiffEditorRenderSideBySide', true, nls.localize('multiDiffEditorRenderSideBySide', "多文件差异编辑器是否并排显示差异而非内联显示"));
	export const hasChanges = new RawContextKey<boolean>('diffEditorHasChanges', false, nls.localize('diffEditorHasChanges', "差异编辑器是否有更改"));
	export const comparingMovedCode = new RawContextKey<boolean>('comparingMovedCode', false, nls.localize('comparingMovedCode', "是否选中了移动的代码块以供比较"));
	export const accessibleDiffViewerVisible = new RawContextKey<boolean>('accessibleDiffViewerVisible', false, nls.localize('accessibleDiffViewerVisible', "无障碍差异查看器是否可见"));
	export const diffEditorRenderSideBySideInlineBreakpointReached = new RawContextKey<boolean>('diffEditorRenderSideBySideInlineBreakpointReached', false, nls.localize('diffEditorRenderSideBySideInlineBreakpointReached', "是否达到差异编辑器并排渲染的内联断点"));
	export const diffEditorInlineMode = new RawContextKey<boolean>('diffEditorInlineMode', false, nls.localize('diffEditorInlineMode', "内联模式是否处于激活状态"));
	export const diffEditorTemporaryInlineMode = new RawContextKey<boolean>('diffEditorTemporaryInlineMode', false, nls.localize('diffEditorTemporaryInlineMode', "手动调整差异编辑器大小后内联模式是否临时激活"));
	export const diffEditorAutomaticRenderSideBySide = new RawContextKey<boolean>('diffEditorAutomaticRenderSideBySide', true, nls.localize('diffEditorAutomaticRenderSideBySide', "自动差异编辑器布局是否会并排显示"));

	export const diffEditorOriginalWritable = new RawContextKey<boolean>('diffEditorOriginalWritable', false, nls.localize('diffEditorOriginalWritable', "差异编辑器中的修改内容是否可写"));
	export const diffEditorModifiedWritable = new RawContextKey<boolean>('diffEditorModifiedWritable', false, nls.localize('diffEditorModifiedWritable', "差异编辑器中的修改内容是否可写"));
	export const diffEditorOriginalUri = new RawContextKey<string>('diffEditorOriginalUri', '', nls.localize('diffEditorOriginalUri', "原始文档的 uri"));
	export const diffEditorModifiedUri = new RawContextKey<string>('diffEditorModifiedUri', '', nls.localize('diffEditorModifiedUri', "修改后文档的 uri"));

	export const columnSelection = new RawContextKey<boolean>('editorColumnSelection', false, nls.localize('editorColumnSelection', "是否启用 `editor.columnSelection`"));
	export const writable = readOnly.toNegated();
	export const hasNonEmptySelection = new RawContextKey<boolean>('editorHasSelection', false, nls.localize('editorHasSelection', "编辑器中是否有选中的文本"));
	export const hasOnlyEmptySelection = hasNonEmptySelection.toNegated();
	export const hasMultipleSelections = new RawContextKey<boolean>('editorHasMultipleSelections', false, nls.localize('editorHasMultipleSelections', "编辑器中是否有多个选区"));
	export const hasSingleSelection = hasMultipleSelections.toNegated();
	export const tabMovesFocus = new RawContextKey<boolean>('editorTabMovesFocus', false, nls.localize('editorTabMovesFocus', "`Tab` 键是否会将焦点移出编辑器"));
	export const tabDoesNotMoveFocus = tabMovesFocus.toNegated();
	export const isInEmbeddedEditor = new RawContextKey<boolean>('isInEmbeddedEditor', false, true);
	export const canUndo = new RawContextKey<boolean>('canUndo', false, true);
	export const canRedo = new RawContextKey<boolean>('canRedo', false, true);

	export const hoverVisible = new RawContextKey<boolean>('editorHoverVisible', false, nls.localize('editorHoverVisible', "编辑器悬停是否可见"));
	export const hoverFocused = new RawContextKey<boolean>('editorHoverFocused', false, nls.localize('editorHoverFocused', "编辑器悬停是否获得焦点"));

	export const stickyScrollFocused = new RawContextKey<boolean>('stickyScrollFocused', false, nls.localize('stickyScrollFocused', "粘性滚动是否获得焦点"));
	export const stickyScrollVisible = new RawContextKey<boolean>('stickyScrollVisible', false, nls.localize('stickyScrollVisible', "粘性滚动是否可见"));

	export const standaloneColorPickerVisible = new RawContextKey<boolean>('standaloneColorPickerVisible', false, nls.localize('standaloneColorPickerVisible', "独立颜色选择器是否可见"));
	export const standaloneColorPickerFocused = new RawContextKey<boolean>('standaloneColorPickerFocused', false, nls.localize('standaloneColorPickerFocused', "独立颜色选择器是否获得焦点"));

	export const isComposing = new RawContextKey<boolean>('isComposing', false, nls.localize('isComposing', "编辑器是否处于组合模式"));

	/**
	 * A context key that is set when an editor is part of a larger editor, like notebooks or
	 * (future) a diff editor
	 */
	export const inCompositeEditor = new RawContextKey<boolean>('inCompositeEditor', undefined, nls.localize('inCompositeEditor', "编辑器是否属于更大的编辑器（例如笔记本）"));
	export const notInCompositeEditor = inCompositeEditor.toNegated();

	// -- mode context keys
	export const languageId = new RawContextKey<string>('editorLangId', '', nls.localize('editorLangId', "编辑器的语言标识符"));
	export const hasCompletionItemProvider = new RawContextKey<boolean>('editorHasCompletionItemProvider', false, nls.localize('editorHasCompletionItemProvider', "编辑器是否提供补全项"));
	export const hasCodeActionsProvider = new RawContextKey<boolean>('editorHasCodeActionsProvider', false, nls.localize('editorHasCodeActionsProvider', "编辑器是否提供代码操作"));
	export const hasCodeLensProvider = new RawContextKey<boolean>('editorHasCodeLensProvider', false, nls.localize('editorHasCodeLensProvider', "编辑器是否提供代码透镜"));
	export const hasDefinitionProvider = new RawContextKey<boolean>('editorHasDefinitionProvider', false, nls.localize('editorHasDefinitionProvider', "编辑器是否提供定义"));
	export const hasDeclarationProvider = new RawContextKey<boolean>('editorHasDeclarationProvider', false, nls.localize('editorHasDeclarationProvider', "编辑器是否提供声明"));
	export const hasImplementationProvider = new RawContextKey<boolean>('editorHasImplementationProvider', false, nls.localize('editorHasImplementationProvider', "编辑器是否提供实现"));
	export const hasTypeDefinitionProvider = new RawContextKey<boolean>('editorHasTypeDefinitionProvider', false, nls.localize('editorHasTypeDefinitionProvider', "编辑器是否提供类型定义"));
	export const hasHoverProvider = new RawContextKey<boolean>('editorHasHoverProvider', false, nls.localize('editorHasHoverProvider', "编辑器是否提供悬停信息"));
	export const hasDocumentHighlightProvider = new RawContextKey<boolean>('editorHasDocumentHighlightProvider', false, nls.localize('editorHasDocumentHighlightProvider', "编辑器是否提供文档高亮"));
	export const hasDocumentSymbolProvider = new RawContextKey<boolean>('editorHasDocumentSymbolProvider', false, nls.localize('editorHasDocumentSymbolProvider', "编辑器是否提供文档符号"));
	export const hasReferenceProvider = new RawContextKey<boolean>('editorHasReferenceProvider', false, nls.localize('editorHasReferenceProvider', "编辑器是否提供引用"));
	export const hasRenameProvider = new RawContextKey<boolean>('editorHasRenameProvider', false, nls.localize('editorHasRenameProvider', "编辑器是否提供重命名"));
	export const hasSignatureHelpProvider = new RawContextKey<boolean>('editorHasSignatureHelpProvider', false, nls.localize('editorHasSignatureHelpProvider', "编辑器是否提供签名帮助"));
	export const hasInlayHintsProvider = new RawContextKey<boolean>('editorHasInlayHintsProvider', false, nls.localize('editorHasInlayHintsProvider', "编辑器是否提供内联提示"));

	// -- mode context keys: formatting
	export const hasDocumentFormattingProvider = new RawContextKey<boolean>('editorHasDocumentFormattingProvider', false, nls.localize('editorHasDocumentFormattingProvider', "编辑器是否提供文档格式化"));
	export const hasDocumentSelectionFormattingProvider = new RawContextKey<boolean>('editorHasDocumentSelectionFormattingProvider', false, nls.localize('editorHasDocumentSelectionFormattingProvider', "编辑器是否提供所选内容格式化"));
	export const hasMultipleDocumentFormattingProvider = new RawContextKey<boolean>('editorHasMultipleDocumentFormattingProvider', false, nls.localize('editorHasMultipleDocumentFormattingProvider', "编辑器是否提供多种文档格式化"));
	export const hasMultipleDocumentSelectionFormattingProvider = new RawContextKey<boolean>('editorHasMultipleDocumentSelectionFormattingProvider', false, nls.localize('editorHasMultipleDocumentSelectionFormattingProvider', "编辑器是否提供多种所选内容格式化"));

	export const selectionHasDiagnostics = new RawContextKey<boolean>('editorSelectionHasDiagnostics', false, nls.localize('editorSelectionHasDiagnostics', "当前编辑器选区中是否存在任何诊断信息"));
}
