/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { isMacintosh } from '../../../../base/common/platform.js';
import { localize } from '../../../../nls.js';
import { AccessibleViewProviderId, AccessibleViewType, AccessibleContentProvider, IAccessibleViewContentProvider, IAccessibleViewOptions } from '../../../../platform/accessibility/browser/accessibleView.js';
import { IAccessibleViewImplementation } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { AccessibilityVerbositySettingId } from '../../accessibility/browser/accessibilityConfiguration.js';
import { SearchContext } from '../common/constants.js';
import { ISearchViewModelWorkbenchService } from './searchTreeModel/searchViewModelWorkbenchService.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { getSearchView } from './searchActionsBase.js';

export class SearchAccessibilityHelp implements IAccessibleViewImplementation {
	readonly priority = 105;
	readonly name = 'search';
	readonly type = AccessibleViewType.Help;
	readonly when = SearchContext.SearchInputBoxFocusedKey;

	getProvider(accessor: ServicesAccessor): AccessibleContentProvider | undefined {
		const searchViewModelService = accessor.get(ISearchViewModelWorkbenchService);
		const viewsService = accessor.get(IViewsService);

		const searchModel = searchViewModelService.searchModel;
		if (!searchModel) {
			return undefined;
		}

		return new SearchAccessibilityHelpProvider(searchModel, viewsService);
	}
}

class SearchAccessibilityHelpProvider extends Disposable implements IAccessibleViewContentProvider {
	readonly id = AccessibleViewProviderId.SearchHelp;
	readonly verbositySettingKey = AccessibilityVerbositySettingId.Find;
	readonly options: IAccessibleViewOptions = { type: AccessibleViewType.Help };

	constructor(
		private readonly _searchModel: { searchResult: { count: () => number }; replaceActive: boolean },
		private readonly _viewsService: IViewsService
	) {
		super();
	}

	onClose(): void {
		getSearchView(this._viewsService)?.focus();
	}

	provideContent(): string {
		const content: string[] = [];
		const resultCount = this._searchModel.searchResult.count();
		const isReplaceMode = this._searchModel.replaceActive;

		// Header
		content.push(localize('search.header', "无障碍帮助：跨文件搜索"));
		content.push(localize('search.context', "你正处于搜索视图。这个工作区级工具可以在工作区的所有文件中查找文本或模式。"));
		content.push('');

		// Current Search Status
		content.push(localize('search.statusHeader', "当前搜索状态："));
		content.push(localize('search.statusIntro', "你正在整个工作区中搜索。"));
		if (resultCount !== undefined) {
			if (resultCount === 0) {
				content.push(localize('search.noResults', "未找到结果。请检查搜索词或调整下方选项。"));
			} else {
				content.push(localize('search.resultCount', "找到 {0} 个结果。", resultCount));
			}
		} else {
			content.push(localize('search.noSearch', "输入搜索词以查找结果。"));
		}
		content.push('');

		// Inside the Search Input
		content.push(localize('search.inputHeader', "在搜索输入框内（它的作用）："));
		content.push(localize('search.inputDesc', "当你位于搜索输入中时，焦点将停留在字段中。可以在不离开输入的情况下键入搜索词并导航搜索结果列表。导航到结果时，编辑器会在后台更新以显示匹配项。"));
		content.push('');

		// What You Hear
		content.push(localize('search.hearHeader', "每次移动到结果时你会听到的内容："));
		content.push(localize('search.hearDesc', "每次导航都会给出完整的语音反馈："));
		content.push(localize('search.hear1', "1) 首先播报结果所在的文件名，让你知道匹配项在哪个文件里。"));
		content.push(localize('search.hear2', "2) 接着播报包含匹配项的整行内容，让你立即获得上下文。"));
		content.push(localize('search.hear3', "3) 然后播报你在结果中的位置，让你知道浏览进度。"));
		content.push(localize('search.hear4', "4) 最后播报具体的行号和列号，让你确切知道匹配项在文件中的位置。"));
		content.push('');

		// Focus Behavior
		content.push(localize('search.focusHeader', "焦点行为（重要）："));
		content.push(localize('search.focusDesc1', "在搜索输入框内移动时，编辑器会同步更新，而焦点仍保留在搜索框中。这是有意设计的，你可以在不丢失当前位置的情况下继续细化搜索条件。"));
		content.push(localize('search.focusDesc2', "按 Tab 键会将焦点移到输入框下方的结果树，可以在其中浏览并打开结果。在某个结果上按 Enter 键会在编辑器中显示匹配位置。"));
		content.push(localize('search.focusDesc3', "如果你想把焦点切到编辑器去编辑某个搜索结果，请用 {0} 导航到该结果并自动聚焦到该处的编辑器。", '<keybinding:search.action.focusNextSearchResult>'));
		content.push('');

		// Keyboard Navigation Summary
		content.push(localize('search.keyboardHeader', "键盘导航小结："));
		content.push('');
		content.push(localize('search.keyNavSearchHeader', "焦点位于搜索输入框内时："));
		content.push(localize('search.keyEnter', "- Enter：运行或刷新搜索。"));
		content.push(localize('search.keyTab', "- Tab：把焦点移到下方的结果树。"));
		content.push('');
		content.push(localize('search.keyNavResultsHeader', "浏览搜索结果时："));
		content.push(localize('search.keyArrow', "- 箭头下键：在结果树中逐项浏览。"));
		content.push(localize('search.keyResultEnter', "- Enter（当某个结果获得焦点时）：在编辑器中跳转到该结果。"));
		content.push('');
		content.push(localize('search.keyNavGlobalHeader', "在任意位置（搜索输入框或编辑器）中："));
		content.push(localize('search.keyF4', "- {0}：跳转到下一个结果并聚焦到编辑器。", '<keybinding:search.action.focusNextSearchResult>'));
		content.push(localize('search.keyShiftF4', "- {0}：跳转到上一个结果并聚焦到编辑器。", '<keybinding:search.action.focusPreviousSearchResult>'));
		content.push('');

		// Search Options
		content.push(localize('search.optionsHeader', "对话框中的搜索选项："));
		content.push(localize('search.optionCase', "- 区分大小写：只匹配大小写完全一致的内容。"));
		content.push(localize('search.optionWord', "- 全字匹配：只匹配完整单词。"));
		content.push(localize('search.optionRegex', "- 正则表达式：使用模式匹配进行高级搜索。"));
		content.push('');

		// Replace Mode
		if (isReplaceMode) {
			content.push(localize('search.replaceHeader', "跨文件替换（替换模式已激活）："));
			content.push(localize('search.replaceDesc1', "按 Tab 键切换到替换输入框并输入替换文本。"));
			content.push(localize('search.replaceDesc2', "你可以替换单个匹配项，也可以一次性替换全部匹配项。"));
			content.push(localize('search.replaceWarning', "警告：此操作会影响多个文件。请确认你搜索的正是想要替换的内容。"));
			content.push('');
		}

		// Settings
		content.push(localize('search.settingsHeader', "你可以调整的设置（{0} 打开设置）：", '<keybinding:workbench.action.openSettings>'));
		content.push(localize('search.settingsIntro', "以下设置会影响跨文件搜索的行为。"));
		content.push(localize('search.settingVerbosity', "- `accessibility.verbosity.find`：控制搜索输入框是否播报无障碍帮助提示。"));
		content.push(localize('search.settingSmartCase', "- `search.smartCase`：当搜索词全为小写时使用不区分大小写的搜索。"));
		content.push(localize('search.settingSearchOnType', "- `search.searchOnType`：输入时即搜索所有文件。"));
		content.push(localize('search.settingDebounce', "- `search.searchOnTypeDebouncePeriod`：输入时开始搜索前的等待时间（毫秒）。"));
		content.push(localize('search.settingMaxResults', "- `search.maxResults`：最多显示的搜索结果数。"));
		content.push(localize('search.settingCollapse', "- `search.collapseResults`：展开或折叠结果。"));
		content.push(localize('search.settingLineNumbers', "- `search.showLineNumbers`：为结果显示行号。"));
		content.push(localize('search.settingSortOrder', "- `search.sortOrder`：按文件名、类型、修改时间或匹配数排序结果。"));
		content.push(localize('search.settingContextLines', "- `search.searchEditor.defaultNumberOfContextLines`：匹配项周围显示的上下文行数。"));
		content.push(localize('search.settingViewMode', "- `search.defaultViewMode`：以列表或树状图显示结果。"));
		content.push(localize('search.settingActions', "- `search.actionsPosition`：操作按钮的位置。"));

		// Replace-specific setting
		if (isReplaceMode) {
			content.push(localize('search.settingReplacePreview', "- `search.useReplacePreview`：替换匹配项时打开预览。"));
		}

		// Platform-specific setting
		if (isMacintosh) {
			content.push('');
			content.push(localize('search.macSettingHeader', "平台专属设置（仅 macOS）："));
			content.push(localize('search.macSetting', "- `search.globalFindClipboard`：在可用时使用 macOS 共享的查找剪贴板。"));
		}

		content.push('');
		content.push(localize('search.closingHeader', "关闭："));
		content.push(localize('search.closingDesc', "按 Escape 键关闭搜索。焦点会回到编辑器，且你的搜索历史会被保留。"));

		return content.join('\n');
	}
}
