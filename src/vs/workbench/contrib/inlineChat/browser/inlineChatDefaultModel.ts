/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ILanguageModelsService } from '../../chat/common/languageModels.js';
import { InlineChatConfigKeys } from '../common/inlineChat.js';
import { createDefaultModelArrays, DefaultModelContribution } from '../../chat/browser/defaultModelContribution.js';

const arrays = createDefaultModelArrays();

export class InlineChatDefaultModel extends DefaultModelContribution {
	static readonly ID = 'workbench.contrib.inlineChatDefaultModel';

	static readonly modelIds = arrays.modelIds;
	static readonly modelLabels = arrays.modelLabels;
	static readonly modelDescriptions = arrays.modelDescriptions;

	constructor(
		@ILanguageModelsService languageModelsService: ILanguageModelsService,
		@ILogService logService: ILogService,
	) {
		super(arrays, {
			configKey: InlineChatConfigKeys.DefaultModel,
			configSectionId: 'inlineChat',
			logPrefix: '[InlineChatDefaultModel]',
			filter: metadata => !!metadata.capabilities?.toolCalling,
		}, languageModelsService, logService);
	}
}


Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	...{ id: 'inlineChat', title: localize('inlineChatConfigurationTitle', "内联聊天"), order: 30, type: 'object' },
	properties: {
		[InlineChatConfigKeys.DefaultModel]: {
			description: localize('inlineChatDefaultModelDescription', "从可用提供者中选择用于内联聊天的默认语言模型。模型名称可能包含括号中的提供者，例如 \"Claude Haiku 4.5 (copilot)\"。"),
			type: 'string',
			default: '',
			order: 1,
			enum: InlineChatDefaultModel.modelIds,
			enumItemLabels: InlineChatDefaultModel.modelLabels,
			markdownEnumDescriptions: InlineChatDefaultModel.modelDescriptions
		}
	}
});
