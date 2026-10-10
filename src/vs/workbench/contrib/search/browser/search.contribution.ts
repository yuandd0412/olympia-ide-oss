/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import * as platform from '../../../../base/common/platform.js';
import * as nls from '../../../../nls.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Extensions as QuickAccessExtensions, IQuickAccessRegistry } from '../../../../platform/quickinput/common/quickAccess.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { Extensions as ViewExtensions, IViewContainersRegistry, IViewDescriptor, IViewsRegistry, ViewContainerLocation } from '../../../common/views.js';
import { searchViewIcon } from './searchIcons.js';
import { SearchView } from './searchView.js';
import { registerContributions as searchWidgetContributions } from './searchWidget.js';
import { SearchViewModelWorkbenchService } from './searchTreeModel/searchModel.js';
import { ISearchViewModelWorkbenchService } from './searchTreeModel/searchViewModelWorkbenchService.js';
import { VIEWLET_ID, ViewMode, VIEW_ID, SemanticSearchBehavior } from '../../../services/search/common/search.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { assertType } from '../../../../base/common/types.js';
import { getWorkspaceSymbols, IWorkspaceSymbol, searchConfigurationNode } from '../common/search.js';
import * as Constants from '../common/constants.js';
import { SearchChatContextContribution } from './searchChatContext.js';

import './searchActionsCopy.js';
import './searchActionsFind.js';
import './searchActionsNav.js';
import './searchActionsRemoveReplace.js';
import './searchActionsTopBar.js';
import './searchActionsTextQuickAccess.js';
import './searchQuickAccess.contribution.js';
import './search.common.contribution.js';
import { TEXT_SEARCH_QUICK_ACCESS_PREFIX, TextSearchQuickAccess } from './quickTextSearch/textSearchQuickAccess.js';
import { Extensions, IConfigurationMigrationRegistry } from '../../../common/configuration.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { AccessibleViewRegistry } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { SearchAccessibilityHelp } from './searchAccessibilityHelp.js';

registerSingleton(ISearchViewModelWorkbenchService, SearchViewModelWorkbenchService, InstantiationType.Delayed);

searchWidgetContributions();

registerWorkbenchContribution2(SearchChatContextContribution.ID, SearchChatContextContribution, WorkbenchPhase.AfterRestored);

AccessibleViewRegistry.register(new SearchAccessibilityHelp());

const SEARCH_MODE_CONFIG = 'search.mode';

const viewContainer = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry).registerViewContainer({
	id: VIEWLET_ID,
	title: nls.localize2('search', "搜索"),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [VIEWLET_ID, { mergeViewWithContainerWhenSingleView: true }]),
	hideIfEmpty: true,
	icon: searchViewIcon,
	order: 1,
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: true });

const viewDescriptor: IViewDescriptor = {
	id: VIEW_ID,
	containerIcon: searchViewIcon,
	name: nls.localize2('search', "搜索"),
	ctorDescriptor: new SyncDescriptor(SearchView),
	canToggleVisibility: false,
	canMoveView: true,
	openCommandActionDescriptor: {
		id: viewContainer.id,
		mnemonicTitle: nls.localize({ key: 'miViewSearch', comment: ['&& denotes a mnemonic'] }, "搜索(&&S)"),
		keybindings: {
			primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyF,
			// Yes, this is weird. See #116188, #115556, #115511, and now #124146, for examples of what can go wrong here.
			when: ContextKeyExpr.regex('neverMatch', /doesNotMatch/)
		},
		order: 1
	}
};

// Register search default location to sidebar
Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([viewDescriptor], viewContainer);

// Register Quick Access Handler
const quickAccessRegistry = Registry.as<IQuickAccessRegistry>(QuickAccessExtensions.Quickaccess);

quickAccessRegistry.registerQuickAccessProvider({
	ctor: TextSearchQuickAccess,
	prefix: TEXT_SEARCH_QUICK_ACCESS_PREFIX,
	contextKey: 'inTextSearchPicker',
	placeholder: nls.localize('textSearchPickerPlaceholder', "在工作区文件中搜索文本。"),
	helpEntries: [
		{
			description: nls.localize('textSearchPickerHelp', "搜索文本"),
			commandId: Constants.SearchCommandIds.QuickTextSearchActionId,
			commandCenterOrder: 25,
		}
	]
});

// Configuration
const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
	...searchConfigurationNode,
	properties: {
		[SEARCH_MODE_CONFIG]: {
			type: 'string',
			enum: ['view', 'reuseEditor', 'newEditor'],
			default: 'view',
			markdownDescription: nls.localize('search.mode', "控制新的「搜索：在文件中查找」和「在文件夹中查找」在哪里执行：在搜索视图中，或在搜索编辑器中。"),
			enumDescriptions: [
				nls.localize('search.mode.view', "在搜索视图中搜索（面板或侧边栏中）。"),
				nls.localize('search.mode.reuseEditor', "在已有的搜索编辑器中搜索，若没有则新建一个。"),
				nls.localize('search.mode.newEditor', "在新的搜索编辑器中搜索。"),
			]
		},
		'search.quickOpen.includeSymbols': {
			type: 'boolean',
			description: nls.localize('search.quickOpen.includeSymbols', "快速打开的文件结果中是否包含全局符号搜索的结果。"),
			default: false
		},
		'search.quickOpen.includeHistory': {
			type: 'boolean',
			description: nls.localize('search.quickOpen.includeHistory', "快速打开的文件结果中是否包含最近打开文件的搜索结果。"),
			default: true,
			agentsWindow: { default: false },
		},
		'search.quickOpen.history.filterSortOrder': {
			type: 'string',
			enum: ['default', 'recency'],
			default: 'default',
			enumDescriptions: [
				nls.localize('filterSortOrder.default', "历史记录按与筛选条件的相关度排序，相关度高的排在前面。"),
				nls.localize('filterSortOrder.recency', "历史记录按最近使用时间排序，最近打开的排在前面。")
			],
			description: nls.localize('filterSortOrder', "控制快速打开筛选时编辑器历史的排序方式。")
		},
		'search.globalFindClipboard': {
			type: 'boolean',
			default: false,
			description: nls.localize('search.globalFindClipboard', "控制搜索视图在 macOS 上是否读写系统共享的查找剪贴板。"),
			included: platform.isMacintosh
		},
		'search.collapseResults': {
			type: 'string',
			enum: ['auto', 'alwaysCollapse', 'alwaysExpand'],
			enumDescriptions: [
				nls.localize('search.collapseResults.auto', "结果少于 10 条的文件自动展开，其余折叠。"),
				'',
				''
			],
			default: 'alwaysExpand',
			description: nls.localize('search.collapseAllResults', "控制搜索结果是折叠还是展开。"),
		},
		'search.useReplacePreview': {
			type: 'boolean',
			default: true,
			description: nls.localize('search.useReplacePreview', "控制选中或替换匹配项时是否打开替换预览。"),
		},
		'search.showLineNumbers': {
			type: 'boolean',
			default: false,
			description: nls.localize('search.showLineNumbers', "控制是否为搜索结果显示行号。"),
		},
		'search.actionsPosition': {
			type: 'string',
			enum: ['auto', 'right'],
			enumDescriptions: [
				nls.localize('search.actionsPositionAuto', "搜索视图较窄时把操作栏放在右侧，较宽时紧跟在内容之后。"),
				nls.localize('search.actionsPositionRight', "始终把操作栏放在右侧。"),
			],
			default: 'right',
			description: nls.localize('search.actionsPosition', "控制搜索视图中各行操作栏的位置。")
		},
		'search.seedWithNearestWord': {
			type: 'boolean',
			default: false,
			description: nls.localize('search.seedWithNearestWord', "当当前编辑器没有选区时，用光标最近的词作为搜索初始词。")
		},
		'search.seedOnFocus': {
			type: 'boolean',
			default: false,
			markdownDescription: nls.localize('search.seedOnFocus', "聚焦搜索视图时，用编辑器中选中的文本填充搜索框。无论点击搜索视图还是触发 `workbench.views.search.focus` 命令都会执行。")
		},
		'search.decorations.colors': {
			type: 'boolean',
			description: nls.localize('search.decorations.colors', "控制搜索结果的文件装饰是否使用颜色。"),
			default: true
		},
		'search.decorations.badges': {
			type: 'boolean',
			description: nls.localize('search.decorations.badges', "控制搜索文件装饰是否使用徽标。"),
			default: true
		},
		'search.defaultViewMode': {
			type: 'string',
			enum: [ViewMode.Tree, ViewMode.List],
			default: ViewMode.List,
			enumDescriptions: [
				nls.localize('scm.defaultViewMode.tree', "以树状图显示搜索结果。"),
				nls.localize('scm.defaultViewMode.list', "以列表显示搜索结果。")
			],
			description: nls.localize('search.defaultViewMode', "控制搜索结果的默认视图模式。")
		},
		'search.quickAccess.preserveInput': {
			type: 'boolean',
			description: nls.localize('search.quickAccess.preserveInput', "控制下次打开快速搜索时是否恢复上次输入的内容。"),
			default: false
		},
		'search.experimental.closedNotebookRichContentResults': {
			type: 'boolean',
			description: nls.localize('search.experimental.closedNotebookResults', "显示已关闭笔记本的编辑器富内容结果。更改此设置后请刷新搜索结果。"),
			default: false
		},
		'search.experimental.useIgnoreFilesInFindFiles': {
			type: 'boolean',
			default: false,
			markdownDescription: nls.localize('search.experimental.useIgnoreFilesInFindFiles', "启用后，旧版 `findFiles` 扩展 API 会遵循用户的 `#search.useIgnoreFiles#` 设置，而非始终忽略 `.gitignore`。显式传递 `null` 作为 `exclude` 参数的扩展仍会获取未筛选的结果。无论此设置如何，都会发送遥测数据以帮助确定未来默认值。"),
			tags: ['experimental'],
		},
		'search.searchView.semanticSearchBehavior': {
			type: 'string',
			description: nls.localize('search.searchView.semanticSearchBehavior', "控制搜索视图中显示的语义搜索结果的行为。"),
			enum: [SemanticSearchBehavior.Manual, SemanticSearchBehavior.RunOnEmpty, SemanticSearchBehavior.Auto],
			default: SemanticSearchBehavior.Manual,
			enumDescriptions: [
				nls.localize('search.searchView.semanticSearchBehavior.manual', "仅手动请求语义搜索结果。"),
				nls.localize('search.searchView.semanticSearchBehavior.runOnEmpty', "仅当文本搜索结果为空时才自动请求语义结果。"),
				nls.localize('search.searchView.semanticSearchBehavior.auto', "每次搜索都自动请求语义结果。")
			],
			tags: ['preview'],
		},
		'search.searchView.keywordSuggestions': {
			type: 'boolean',
			description: nls.localize('search.searchView.keywordSuggestions', "在搜索视图中启用关键字建议。"),
			default: false,
			tags: ['preview'],
		},
	}
});

CommandsRegistry.registerCommand('_executeWorkspaceSymbolProvider', async function (accessor, ...args): Promise<IWorkspaceSymbol[]> {
	const [query] = args;
	assertType(typeof query === 'string');
	const result = await getWorkspaceSymbols(query);
	return result.map(item => item.symbol);
});

// todo: @andreamah get rid of this after a few iterations
Registry.as<IConfigurationMigrationRegistry>(Extensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: 'search.experimental.quickAccess.preserveInput',
		migrateFn: (value, _accessor) => ([
			['search.quickAccess.preserveInput', { value }],
			['search.experimental.quickAccess.preserveInput', { value: undefined }]
		])
	}]);
