/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../../nls.js';
import { IConfigurationPropertySchema } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { CustomizationMarketplaceConfiguration } from '../../../../../platform/customizationMarketplace/common/customizationMarketplaceSources.js';

export const customizationMarketplaceConfigurationProperties = {
	[CustomizationMarketplaceConfiguration.MarketplaceEnabled]: {
		type: 'boolean',
		tags: ['experimental'],
		description: localize('chat.customizations.marketplace.enabled', "启用了定制来源时，页面显示「发现」而不是「概览」。关掉之后，定制管理页里仍保留原来的市场发现入口。"),
		default: false,
	},
	[CustomizationMarketplaceConfiguration.AgentFinderPublicFeedEnabled]: {
		type: 'boolean',
		tags: ['experimental'],
		description: localize('chat.customizations.marketplace.sources.publicFeed.enabled', "市场显示时，把 GitHub Feed 作为技能、MCP 服务器与插件的来源之一。市场或这一项关掉后，就不会去查询 GitHub Feed。"),
		default: true,
	},
} satisfies Record<string, IConfigurationPropertySchema>;
