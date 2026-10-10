/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { isMacintosh } from '../../../../base/common/platform.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { CommonFindController } from '../../../../editor/contrib/find/browser/findController.js';
import { CONTEXT_FIND_WIDGET_FOCUSED } from '../../../../editor/contrib/find/browser/findModel.js';
import { localize } from '../../../../nls.js';
import { AccessibleViewProviderId, AccessibleViewType, IAccessibleViewContentProvider, IAccessibleViewOptions } from '../../../../platform/accessibility/browser/accessibleView.js';
import { AccessibleViewRegistry, IAccessibleViewImplementation } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { AccessibilityVerbositySettingId } from '../../accessibility/browser/accessibilityConfiguration.js';

/**
 * Accessible view implementation for Find and Replace help in the code editor.
 * Provides comprehensive accessibility support for the Find dialog, including:
 * - Search status information (current term, match count, position)
 * - Navigation instructions for keyboard control
 * - Focus behavior explanation
 * - Available settings and options
 * - Platform-specific guidance
 *
 * Activated via Alt+F1 when any element in the Find widget is focused.
 */
export class EditorFindAccessibilityHelp implements IAccessibleViewImplementation {
	readonly priority = 105;
	readonly name = 'editor-find';
	readonly when = CONTEXT_FIND_WIDGET_FOCUSED;
	readonly type = AccessibleViewType.Help;

	/**
	 * Creates an accessible view content provider for the active code editor's Find/Replace dialog.
	 * @param accessor Service accessor for retrieving the code editor service
	 * @returns The provider instance, or undefined if no active editor or find controller is found
	 */
	getProvider(accessor: ServicesAccessor) {
		const codeEditorService = accessor.get(ICodeEditorService);
		const codeEditor = codeEditorService.getActiveCodeEditor() || codeEditorService.getFocusedCodeEditor();

		if (!codeEditor) {
			return;
		}

		const findController = CommonFindController.get(codeEditor);
		if (!findController) {
			return;
		}

		return new EditorFindAccessibilityHelpProvider(findController);
	}
}

/**
 * Content provider for the Find and Replace accessibility help.
 * Generates localized, context-aware help information based on the current Find state.
 *
 * The implementation:
 * - Adapts content based on whether Replace mode is active
 * - Provides current search status (term, match count, position)
 * - Explains focus behavior (how focus moves between Find input, Replace input, and editor)
 * - Lists keyboard navigation shortcuts for different contexts
 * - Documents available Find and Replace options
 * - References relevant settings that affect Find behavior
 * - Includes platform-specific guidance where applicable
 */
class EditorFindAccessibilityHelpProvider extends Disposable implements IAccessibleViewContentProvider {
	readonly id = AccessibleViewProviderId.EditorFindHelp;
	readonly verbositySettingKey = AccessibilityVerbositySettingId.Find;
	readonly options: IAccessibleViewOptions = { type: AccessibleViewType.Help };

	constructor(
		private readonly _findController: CommonFindController
	) {
		super();
	}

	/**
	 * Returns focus to the last focused element in the Find widget when the accessibility help is closed.
	 * This handles focus restoration for any element (inputs, checkboxes, buttons) not just the text inputs.
	 */
	onClose(): void {
		this._findController.focusLastElement();
	}

	/**
	 * Generates the complete accessibility help content for Find and Replace.
	 * The content structure varies based on whether Replace mode is visible:
	 *
	 * Replace Mode Content:
	 * - Header identifying the dialog
	 * - Context explaining what the dialog does
	 * - Current search and replace status
	 * - Focus behavior explanation
	 * - Keyboard shortcuts for Find, Replace, and Editor contexts
	 * - Find and Replace options explanation
	 * - Configurable settings documentation
	 * - Platform-specific settings (macOS)
	 *
	 * Find-Only Mode Content:
	 * - Similar structure but without Replace-specific sections
	 *
	 * @returns The complete help text as a newline-joined string for audio announcement
	 */
	provideContent(): string {
		const state = this._findController.getState();
		const isReplaceVisible = state.isReplaceRevealed;
		const searchString = state.searchString;
		const matchCount = state.matchesCount;
		const matchPosition = state.matchesPosition;

		const content: string[] = [];

		if (isReplaceVisible) {
			// ========== REPLACE MODE CONTENT ==========
			content.push(localize('replace.header', "无障碍帮助：编辑器查找和替换"));
			content.push(localize('replace.context', "你当前位于活动编辑器的“查找和替换”对话框中。可通过此对话框查找并替换文本。编辑器是一个独立区域，显示每个匹配项及其上下文。"));
			content.push('');

			// Current Search Status
			content.push(localize('replace.statusHeader', "当前搜索状态："));
			if (searchString) {
				content.push(localize('replace.searchTerm', "你正在搜索：「{0}」。", searchString));
				if (matchCount !== undefined && matchPosition !== undefined) {
					if (matchCount === 0) {
						content.push(localize('replace.noMatches', "在当前文件中没有找到匹配项。试试调整搜索文本或下方的选项。"));
					} else {
						content.push(localize('replace.matchStatus', "第 {0} 个匹配，共 {1} 个。", matchPosition, matchCount));
					}
				}
			} else {
				content.push(localize('replace.noSearchTerm', "尚未输入搜索内容。开始输入以在编辑器中查找匹配项。"));
			}

			const replaceString = state.replaceString;
			if (replaceString) {
				content.push(localize('replace.replaceText', "替换文本：「{0}」。", replaceString));
			} else {
				content.push(localize('replace.noReplaceText', "尚未输入替换文本。按 Tab 键切换到替换输入框并输入替换内容。"));
			}
			content.push('');

			// Inside the Find and Replace Dialog
			content.push(localize('replace.dialogHeader', "在查找和替换对话框内（它的作用）："));
			content.push(localize('replace.dialogDesc', "当你在任一输入框时，焦点会保持在该输入框内。你可以在不离开的情况下键入、编辑或导航匹配项。从“查找”输入导航到匹配项时，编辑器会在后台更新，但焦点仍然停留在对话框中。按 Tab 键可在“查找”和“替换”之间切换。"));
			content.push('');

			// What You Hear
			content.push(localize('replace.hearHeader', "每次跳转到匹配项时你会听到："));
			content.push(localize('replace.hearDesc', "每次导航都会给出完整的语音反馈："));
			content.push(localize('replace.hear1', "1）先朗读包含该匹配项的整行，让你立刻获得上下文。"));
			content.push(localize('replace.hear2', "2）然后播报你在匹配项中的位置，让你知道进度。"));
			content.push(localize('replace.hear3', "3）最后播报具体的行列号，让你精确定位该匹配项。"));
			content.push('');

			// Focus Behavior
			content.push(localize('replace.focusHeader', "焦点行为（重要）："));
			content.push(localize('replace.focusDesc1', "从“查找”对话框内部导航时，当焦点保留在输入中时，编辑器会更新。这是有意为之，以便你不断调整搜索，而不会失去你的位置。"));
			content.push(localize('replace.focusDesc2', "在替换输入框中执行替换时，当前匹配项会被替换，焦点移到下一个匹配项。如果已替换完所有匹配项，对话框会保持打开。"));
			content.push(localize('replace.focusDesc3', "如果你想把焦点移入编辑器去编辑文本，按 Escape 关闭对话框。焦点会回到编辑器中上一次替换的位置。"));
			content.push('');

			// Keyboard Navigation Summary
			content.push(localize('replace.keyboardHeader', "键盘导航小结："));
			content.push('');
			content.push(localize('replace.keyNavFindHeader', "焦点在查找输入框内时："));
			content.push(localize('replace.keyEnter', "- Enter：停留在查找中并移到下一个匹配项。"));
			content.push(localize('replace.keyShiftEnter', "- Shift+Enter：停留在查找中并移到上一个匹配项。"));
			content.push(localize('replace.keyTab', "- Tab：在查找和替换输入框之间切换。"));
			content.push('');
			content.push(localize('replace.keyNavReplaceHeader', "焦点位于替换输入框内时："));
			content.push(localize('replace.keyReplaceEnter', "- Enter：替换当前匹配项并移到下一个。"));
			content.push(localize('replace.keyReplaceOne', "- {0}：仅替换当前匹配项。", '<keybinding:editor.action.replaceOne>'));
			content.push(localize('replace.keyReplaceAll', "- {0}：一次性替换所有匹配项。", '<keybinding:editor.action.replaceAll>'));
			content.push('');
			content.push(localize('replace.keyNavEditorHeader', "焦点在编辑器内时（不在查找输入框中）："));
			content.push(localize('replace.keyF3', "- {0}：跳到下一个匹配项。", '<keybinding:editor.action.nextMatchFindAction>'));
			content.push(localize('replace.keyShiftF3', "- {0}：跳到上一个匹配项。", '<keybinding:editor.action.previousMatchFindAction>'));
			content.push('');
			content.push(localize('replace.keyNavNote', "注意：焦点在编辑器内时不要按 Enter 或 Shift+Enter，否则会插入换行而不是导航。"));
			content.push('');

			// Find and Replace Options
			content.push(localize('replace.optionsHeader', "对话框中的查找和替换选项："));
			content.push(localize('replace.optionCase', "- 区分大小写：只匹配大小写完全一致的内容。"));
			content.push(localize('replace.optionWord', "- 全字匹配：只匹配完整单词。"));
			content.push(localize('replace.optionRegex', "- 正则表达式：使用模式匹配进行高级搜索。"));
			content.push(localize('replace.optionSelection', "- 在选中内容中查找：只匹配当前选区内的内容。"));
			content.push(localize('replace.optionPreserve', "- Preserve Case（保留大小写）：替换时保持原匹配项的大小写形式。"));
			content.push('');

			// Settings
			content.push(localize('replace.settingsHeader', "你可以调整的设置（{0} 打开设置）：", '<keybinding:workbench.action.openSettings>'));
			content.push(localize('replace.settingsIntro', "以下设置会影响查找和替换的行为，或匹配项的高亮方式。"));
			content.push(localize('replace.settingVerbosity', "- `accessibility.verbosity.find`: 控制“查找和替换”输入是否播报辅助功能帮助提示。"));
			content.push(localize('replace.settingFindOnType', "- `editor.find.findOnType`：输入时即执行查找。"));
			content.push(localize('replace.settingCursorMove', "- `editor.find.cursorMoveOnType`：输入时把光标移到最佳匹配项。"));
			content.push(localize('replace.settingSeed', "- `editor.find.seedSearchStringFromSelection`：控制何时用选中文本作为查找的初始内容。"));
			content.push(localize('replace.settingAutoSelection', "- `editor.find.autoFindInSelection`：根据选区类型自动启用「在选中内容中查找」。"));
			content.push(localize('replace.settingLoop', "- `editor.find.loop`：搜索到文件开头或结尾时循环。"));
			content.push(localize('replace.settingExtraSpace', "- `editor.find.addExtraSpaceOnTop`：增加额外滚动空间，避免匹配项被查找替换对话框遮挡。"));
			content.push(localize('replace.settingFindHistory', "- `editor.find.history`：控制是否保存查找搜索历史。"));
			content.push(localize('replace.settingReplaceHistory', "- `editor.find.replaceHistory`：控制是否保存替换历史。"));
			content.push(localize('replace.settingOccurrences', "- `editor.occurrencesHighlight`：高亮当前符号的其他出现处。"));
			content.push(localize('replace.settingOccurrencesDelay', "- `editor.occurrencesHighlightDelay`：控制出现处高亮的延迟时间。"));
			content.push(localize('replace.settingSelectionHighlight', "- `editor.selectionHighlight`：高亮与当前选区相同的其他匹配项。"));
			content.push(localize('replace.settingSelectionMaxLength', "- `editor.selectionHighlightMaxLength`：限制选区高亮的长度。"));
			content.push(localize('replace.settingSelectionMultiline', "- `editor.selectionHighlightMultiline`：控制是否高亮跨行选区。"));

			// Platform-specific setting
			if (isMacintosh) {
				content.push('');
				content.push(localize('replace.macSettingHeader', "平台专属设置（仅 macOS）："));
				content.push(localize('replace.macSetting', "- `editor.find.globalFindClipboard`：在可用时使用 macOS 共享的查找剪贴板。"));
			}

			content.push('');
			content.push(localize('replace.closingHeader', "关闭："));
			content.push(localize('replace.closingDesc', "按 Escape 键关闭查找和替换。焦点会回到编辑器中上一次替换的位置，且你的搜索和替换历史会被保留。"));
		} else {
			// ========== FIND-ONLY MODE CONTENT ==========
			content.push(localize('find.header', "无障碍帮助：编辑器查找"));
			content.push(localize('find.context', "你当前位于活动编辑器的“查找”对话框中。可在此对话框中键入要查找的内容。编辑器是一个独立区域，显示每个匹配项及其上下文。"));
			content.push('');

			// Current Search Status
			content.push(localize('find.statusHeader', "当前搜索状态："));
			if (searchString) {
				content.push(localize('find.searchTerm', "你正在搜索：「{0}」。", searchString));
				if (matchCount !== undefined && matchPosition !== undefined) {
					if (matchCount === 0) {
						content.push(localize('find.noMatches', "在当前文件中没有找到匹配项。试试调整搜索文本或下方的选项。"));
					} else {
						content.push(localize('find.matchStatus', "第 {0} 个匹配，共 {1} 个。", matchPosition, matchCount));
					}
				}
			} else {
				content.push(localize('find.noSearchTerm', "尚未输入搜索内容。开始输入以在编辑器中查找匹配项。"));
			}
			content.push('');

			// Inside the Find Dialog
			content.push(localize('find.dialogHeader', "在查找对话框内（它的作用）："));
			content.push(localize('find.dialogDesc', "当你位于“查找”对话框中时，焦点将停留在字段中。你可以继续键入、编辑搜索文本或在不离开对话框的情况下浏览匹配项。从此处导航到匹配项时，编辑器会在后台更新，但焦点仍然停留在“查找”对话框中。"));
			content.push('');

			// What You Hear
			content.push(localize('find.hearHeader', "每次跳转到匹配项时你会听到："));
			content.push(localize('find.hearDesc', "每次导航都会给出完整的语音反馈，让你始终知道自己的位置。顺序是固定的："));
			content.push(localize('find.hear1', "1）先朗读包含该匹配项的整行，让你立刻获得上下文。"));
			content.push(localize('find.hear2', "2）然后播报你在匹配项中的位置，让你知道进度。"));
			content.push(localize('find.hear3', "3）最后播报具体的行列号，让你精确定位该匹配项。"));
			content.push(localize('find.hearConclusion', "每次向前或向后移动时都会按此顺序播报。"));
			content.push('');

			// Outside the Find Dialog
			content.push(localize('find.outsideHeader', "在查找对话框之外（编辑器内）："));
			content.push(localize('find.outsideDesc', "当焦点在编辑器中而非查找对话框时，你仍然可以在匹配项之间导航。"));
			content.push(localize('find.outsideF3', "- 按 {0} 移到下一个匹配项。", '<keybinding:editor.action.nextMatchFindAction>'));
			content.push(localize('find.outsideShiftF3', "- 按 {0} 移到上一个匹配项。", '<keybinding:editor.action.previousMatchFindAction>'));
			content.push(localize('find.outsideConclusion', "你会听到同样的三步播报：整行内容、匹配位置，然后是行号和列号。"));
			content.push('');

			// Focus Behavior
			content.push(localize('find.focusHeader', "焦点行为（重要）："));
			content.push(localize('find.focusDesc1', "从“查找”对话框内部导航时，当焦点保留在输入中时，编辑器会更新。这是有意为之，以便你不断调整搜索，而不会失去你的位置。"));
			content.push(localize('find.focusDesc2', "如果要将焦点移到编辑器中以编辑文本或检查周围的代码，请按 Esc 关闭“查找”。焦点会回到编辑器中的最近一个匹配项。"));
			content.push('');

			// Keyboard Navigation Summary
			content.push(localize('find.keyboardHeader', "键盘导航小结："));
			content.push('');
			content.push(localize('find.keyNavFindHeader', "焦点在查找输入框内时："));
			content.push(localize('find.keyEnter', "- Enter：停留在查找对话框中并移到下一个匹配项。"));
			content.push(localize('find.keyShiftEnter', "- Shift+Enter：停留在查找对话框中并移到上一个匹配项。"));
			content.push('');
			content.push(localize('find.keyNavEditorHeader', "焦点在编辑器内时（不在查找输入框中）："));
			content.push(localize('find.keyF3', "- {0}：跳到下一个匹配项。", '<keybinding:editor.action.nextMatchFindAction>'));
			content.push(localize('find.keyShiftF3', "- {0}：跳到上一个匹配项。", '<keybinding:editor.action.previousMatchFindAction>'));
			content.push('');
			content.push(localize('find.keyNavNote', "注意：焦点在编辑器内时不要按 Enter 或 Shift+Enter，否则会插入换行而不是导航。"));
			content.push('');

			// Find Options
			content.push(localize('find.optionsHeader', "对话框中的查找选项："));
			content.push(localize('find.optionCase', "- 区分大小写：只匹配大小写完全一致的内容。"));
			content.push(localize('find.optionWord', "- 全字匹配：只匹配完整单词。"));
			content.push(localize('find.optionRegex', "- 正则表达式：使用模式匹配进行高级搜索。"));
			content.push(localize('find.optionSelection', "- 在选中内容中查找：只匹配当前选区内的内容。"));
			content.push('');

			// Settings
			content.push(localize('find.settingsHeader', "你可以调整的设置（{0} 打开设置）：", '<keybinding:workbench.action.openSettings>'));
			content.push(localize('find.settingsIntro', "以下设置会影响查找行为或匹配项的高亮方式。"));
			content.push(localize('find.settingVerbosity', "- `accessibility.verbosity.find`：控制查找输入框是否播报无障碍帮助提示。"));
			content.push(localize('find.settingFindOnType', "- `editor.find.findOnType`：输入时即执行查找。"));
			content.push(localize('find.settingCursorMove', "- `editor.find.cursorMoveOnType`：输入时把光标移到最佳匹配项。"));
			content.push(localize('find.settingSeed', "- `editor.find.seedSearchStringFromSelection`：控制何时用选中文本作为查找的初始内容。"));
			content.push(localize('find.settingAutoSelection', "- `editor.find.autoFindInSelection`：根据选区类型自动启用「在选中内容中查找」。"));
			content.push(localize('find.settingLoop', "- `editor.find.loop`：搜索到文件开头或结尾时循环。"));
			content.push(localize('find.settingCloseOnResult', "- `editor.find.closeOnResult`: 在显式查找导航命令定位到匹配项后关闭“查找”对话框。"));
			content.push(localize('find.settingExtraSpace', "- `editor.find.addExtraSpaceOnTop`: 添加额外的滚动空间，避免匹配项被“查找”对话框遮挡。"));
			content.push(localize('find.settingHistory', "- `editor.find.history`：控制是否保存查找搜索历史。"));
			content.push(localize('find.settingOccurrences', "- `editor.occurrencesHighlight`：高亮当前符号的其他出现处。"));
			content.push(localize('find.settingOccurrencesDelay', "- `editor.occurrencesHighlightDelay`：控制出现处高亮的延迟时间。"));
			content.push(localize('find.settingSelectionHighlight', "- `editor.selectionHighlight`：高亮与当前选区相同的其他匹配项。"));
			content.push(localize('find.settingSelectionMaxLength', "- `editor.selectionHighlightMaxLength`：限制选区高亮的长度。"));
			content.push(localize('find.settingSelectionMultiline', "- `editor.selectionHighlightMultiline`：控制是否高亮跨行选区。"));

			// Platform-specific setting
			if (isMacintosh) {
				content.push('');
				content.push(localize('find.macSettingHeader', "平台专属设置（仅 macOS）："));
				content.push(localize('find.macSetting', "- `editor.find.globalFindClipboard`：在可用时使用 macOS 共享的查找剪贴板。"));
			}

			content.push('');
			content.push(localize('find.closingHeader', "关闭："));
			content.push(localize('find.closingDesc', "按 Esc 可关闭“查找”。焦点会回到编辑器中的最近一个匹配项，并且搜索历史记录将保留。"));
		}

		return content.join('\n');
	}
}

// Register the accessibility help provider
AccessibleViewRegistry.register(new EditorFindAccessibilityHelp());
