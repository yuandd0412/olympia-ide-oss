/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { localize } from '../../../../nls.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';

export const searchDetailsIcon = registerIcon('search-details', Codicon.ellipsis, localize('searchDetailsIcon', "用于显示搜索详情的图标。"));
export const searchActivityBarIcon = registerIcon('search-see-more', Codicon.goToSearch, localize('searchSeeMoreIcon', "用于在搜索视图中查看更多上下文的图标。"));

export const searchShowContextIcon = registerIcon('search-show-context', Codicon.listSelection, localize('searchShowContextIcon', "用于在搜索编辑器中切换显示上下文的图标。"));
export const searchHideReplaceIcon = registerIcon('search-hide-replace', Codicon.chevronRight, localize('searchHideReplaceIcon', "用于在搜索视图中折叠替换区域的图标。"));
export const searchShowReplaceIcon = registerIcon('search-show-replace', Codicon.chevronDown, localize('searchShowReplaceIcon', "用于在搜索视图中展开替换区域的图标。"));
export const searchReplaceAllIcon = registerIcon('search-replace-all', Codicon.replaceAll, localize('searchReplaceAllIcon', "用于在搜索视图中全部替换的图标。"));
export const searchReplaceIcon = registerIcon('search-replace', Codicon.replace, localize('searchReplaceIcon', "用于在搜索视图中替换的图标。"));
export const searchRemoveIcon = registerIcon('search-remove', Codicon.close, localize('searchRemoveIcon', "用于移除搜索结果的图标。"));

export const searchRefreshIcon = registerIcon('search-refresh', Codicon.refresh, localize('searchRefreshIcon', "用于在搜索视图中刷新的图标。"));
export const searchCollapseAllIcon = registerIcon('search-collapse-results', Codicon.collapseAll, localize('searchCollapseAllIcon', "用于在搜索视图中折叠结果的图标。"));
export const searchExpandAllIcon = registerIcon('search-expand-results', Codicon.expandAll, localize('searchExpandAllIcon', "用于在搜索视图中展开结果的图标。"));
export const searchShowAsTree = registerIcon('search-tree', Codicon.listTree, localize('searchShowAsTree', "用于在搜索视图中以树形显示结果的图标。"));
export const searchShowAsList = registerIcon('search-list', Codicon.listFlat, localize('searchShowAsList', "用于在搜索视图中以列表显示结果的图标。"));
export const searchClearIcon = registerIcon('search-clear-results', Codicon.clearAll, localize('searchClearIcon', "用于在搜索视图中清除结果的图标。"));
export const searchStopIcon = registerIcon('search-stop', Codicon.searchStop, localize('searchStopIcon', "用于在搜索视图中停止搜索的图标。"));

export const searchViewIcon = registerIcon('search-view-icon', Codicon.searchLarge, localize('searchViewIcon', "搜索视图的视图图标。"));

export const searchNewEditorIcon = registerIcon('search-new-editor', Codicon.newFile, localize('searchNewEditorIcon', "用于打开新搜索编辑器操作的图标。"));
export const searchOpenInFileIcon = registerIcon('search-open-in-file', Codicon.goToFile, localize('searchOpenInFile', "用于跳转到当前搜索结果所在文件操作的图标。"));

export const searchSparkleFilled = registerIcon('search-sparkle-filled', Codicon.sparkleFilled, localize('searchSparkleFilled', "用于在搜索中显示 AI 结果的图标。"));
export const searchSparkleEmpty = registerIcon('search-sparkle-empty', Codicon.sparkle, localize('searchSparkleEmpty', "用于在搜索中隐藏 AI 结果的图标。"));
