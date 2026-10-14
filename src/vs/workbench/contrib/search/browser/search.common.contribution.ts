/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Common search service registrations shared between the main workbench and the Agents window.

import * as nls from '../../../../nls.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ConfigurationScope, Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { registerContributions as replaceContributions } from './replaceContributions.js';
import { registerContributions as notebookSearchContributions } from './notebookSearch/notebookSearchContributions.js';
import { ISearchHistoryService, SearchHistoryService } from '../common/searchHistoryService.js';
import { searchConfigurationNode } from '../common/search.js';
import { DEFAULT_MAX_SEARCH_RESULTS, SEARCH_EXCLUDE_CONFIG, SearchSortOrder } from '../../../services/search/common/search.js';

replaceContributions();
notebookSearchContributions();
registerSingleton(ISearchHistoryService, SearchHistoryService, InstantiationType.Delayed);

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	...searchConfigurationNode,
	properties: {
		[SEARCH_EXCLUDE_CONFIG]: {
			type: 'object',
			markdownDescription: nls.localize('exclude', "配置用于在全文搜索和快速打开的文件搜索中排除文件和文件夹的 `glob 模式`。若要将文件从快速打开的最近打开列表中排除，模式必须为绝对路径（例如 `**/node_modules/**`）。会继承 `#files.exclude#` 设置中的所有 glob 模式。"),
			default: { '**/node_modules': true, '**/bower_components': true, '**/*.code-search': true },
			additionalProperties: {
				anyOf: [
					{
						type: 'boolean',
						description: nls.localize('exclude.boolean', "用于匹配文件路径的 glob 模式。设为 true 或 false 以启用或禁用该模式。"),
					},
					{
						type: 'object',
						properties: {
							when: {
								type: 'string', // expression ({ "**/*.js": { "when": "$(basename).js" } })
								pattern: '\\w*\\$\\(basename\\)\\w*',
								default: '$(basename).ext',
								markdownDescription: nls.localize({ key: 'exclude.when', comment: ['\\$(basename) should not be translated'] }, "对匹配文件的同级文件进行额外检查。使用 \\$(basename) 变量表示匹配的文件名。")
							}
						}
					}
				]
			},
			scope: ConfigurationScope.RESOURCE
		},
		'search.useIgnoreFiles': {
			type: 'boolean',
			markdownDescription: nls.localize('useIgnoreFiles', "控制搜索文件时是否使用 `.gitignore` 和 `.ignore` 文件。"),
			default: true,
			scope: ConfigurationScope.RESOURCE
		},
		'search.useGlobalIgnoreFiles': {
			type: 'boolean',
			markdownDescription: nls.localize('useGlobalIgnoreFiles', "控制搜索文件时是否使用全局 gitignore 文件（例如 `$HOME/.config/git/ignore`）。需要启用 {0}。", '`#search.useIgnoreFiles#`'),
			default: false,
			scope: ConfigurationScope.RESOURCE
		},
		'search.useParentIgnoreFiles': {
			type: 'boolean',
			markdownDescription: nls.localize('useParentIgnoreFiles', "控制搜索文件时是否使用父级目录中的 `.gitignore` 和 `.ignore` 文件。需要启用 {0}。", '`#search.useIgnoreFiles#`'),
			default: false,
			scope: ConfigurationScope.RESOURCE
		},
		'search.ripgrep.maxThreads': {
			type: 'number',
			description: nls.localize('search.ripgrep.maxThreads', "搜索使用的线程数。设为 0 时由引擎自动决定。"),
			default: 0
		},
		'search.followSymlinks': {
			type: 'boolean',
			description: nls.localize('search.followSymlinks', "控制搜索时是否跟随符号链接。"),
			default: true
		},
		'search.smartCase': {
			type: 'boolean',
			description: nls.localize('search.smartCase', "如果搜索词全为小写则忽略大小写，否则区分大小写。"),
			default: false
		},
		'search.maxResults': {
			type: ['number', 'null'],
			default: DEFAULT_MAX_SEARCH_RESULTS,
			markdownDescription: nls.localize('search.maxResults', "控制搜索结果的最大数量，可设为 `null`（空）表示不限制。")
		},
		'search.sortOrder': {
			type: 'string',
			enum: [SearchSortOrder.Default, SearchSortOrder.FileNames, SearchSortOrder.Type, SearchSortOrder.Modified, SearchSortOrder.CountDescending, SearchSortOrder.CountAscending],
			default: SearchSortOrder.Default,
			enumDescriptions: [
				nls.localize('searchSortOrder.default', "结果按文件夹名和文件名以字母顺序排序。"),
				nls.localize('searchSortOrder.filesOnly', "结果忽略文件夹顺序，按文件名以字母顺序排序。"),
				nls.localize('searchSortOrder.type', "结果按文件扩展名以字母顺序排序。"),
				nls.localize('searchSortOrder.modified', "结果按最后修改时间倒序排序。"),
				nls.localize('searchSortOrder.countDescending', "结果按每个文件的匹配数倒序排序。"),
				nls.localize('searchSortOrder.countAscending', "结果按每个文件的匹配数正序排序。")
			],
			description: nls.localize('search.sortOrder', "控制搜索结果的排序方式。")
		},
		'search.searchOnType': {
			type: 'boolean',
			default: true,
			description: nls.localize('search.searchOnType', "输入时即搜索全部文件。")
		},
		'search.searchOnTypeDebouncePeriod': {
			type: 'number',
			default: 300,
			markdownDescription: nls.localize('search.searchOnTypeDebouncePeriod', "启用 {0} 时，控制从键入字符到开始搜索之间的等待时间（毫秒）。{0} 关闭时无效。", '`#search.searchOnType#`')
		},
	}
});
