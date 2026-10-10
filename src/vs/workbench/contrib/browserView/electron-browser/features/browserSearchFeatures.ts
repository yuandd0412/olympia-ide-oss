/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../../nls.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { workbenchConfigurationNodeBase } from '../../../../common/configuration.js';
import { BROWSER_SEARCH_ENGINES, BROWSER_SEARCH_NONE, BrowserSearchEngineId, BrowserSearchEngineSettingId } from '../../common/browserSearch.js';

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	...workbenchConfigurationNodeBase,
	properties: {
		[BrowserSearchEngineSettingId]: {
			type: 'string',
			enum: [BROWSER_SEARCH_NONE, ...BROWSER_SEARCH_ENGINES.map(e => e.id)],
			enumItemLabels: [localize('browser.search.engine.none', "无"), ...BROWSER_SEARCH_ENGINES.map(e => e.label)],
			default: BrowserSearchEngineId.Bing,
			markdownDescription: localize(
				'browser.searchEngine',
				"控制从集成浏览器的地址栏搜索 Web 时使用的搜索引擎。选择“无”以禁用搜索。"
			),
			scope: ConfigurationScope.APPLICATION,
			order: 110
		}
	}
});
