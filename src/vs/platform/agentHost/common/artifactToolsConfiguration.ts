/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../nls.js';
import { ConfigurationScope, IConfigurationPropertySchema } from '../../configuration/common/configurationRegistry.js';
import product from '../../product/common/product.js';
import { AgentHostArtifactToolsConfigKey } from './agentHostSchema.js';
import { ArtifactToolsSettingId } from './agentService.js';

export const artifactToolsConfigurationProperties = {
	[ArtifactToolsSettingId]: {
		type: 'boolean',
		description: nls.localize('chat.artifactTools.enabled', "启用后，智能体可以记录产出物——Pull Request、issue、提交、网站、文件等资源——它们会显示在聊天输入框的上方。"),
		default: product.quality !== 'stable',
		scope: ConfigurationScope.APPLICATION,
		tags: ['experimental', 'advanced'],
		experiment: { mode: 'auto' },
		agentHost: { key: AgentHostArtifactToolsConfigKey },
	},
} satisfies Record<string, IConfigurationPropertySchema>;
