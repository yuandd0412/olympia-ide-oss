/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../nls.js';
import { AgentHostAutoArchiveMergedSessionsAfterDaysConfigKey, AgentHostAutoDeleteArchivedMergedSessionsAfterDaysConfigKey } from '../../../../platform/agentHost/common/agentHostSchema.js';
import { ConfigurationScope, Extensions as ConfigurationExtensions, IConfigurationPropertySchema, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import product from '../../../../platform/product/common/product.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ConfigurationKeyValuePairs, Extensions as WorkbenchConfigurationExtensions, IConfigurationMigrationRegistry } from '../../../common/configuration.js';
import { AGENT_SESSION_CLEANUP_SETTINGS_TAG, ChatConfiguration, CopilotHarnessIntroductionMode, DEFAULT_AGENTS_HANDOFF_TIP_DELAY_SECONDS } from '../common/constants.js';

const legacyAutoArchiveMergedSessionsAfterDaysSetting = 'chat.agentSessions.autoArchiveMergedSessionsAfterDays';
const legacyAutoDeleteArchivedMergedSessionsAfterDaysSetting = 'chat.agentSessions.autoDeleteArchivedMergedSessionsAfterDays';

export const agentsWindowHandoffConfigurationProperties = {
	[ChatConfiguration.OpenInAgentsWindowTransferDraft]: {
		type: 'boolean',
		description: nls.localize('chat.openInAgentsWindow.transferDraft', "新建对话切到智能体窗口时，把当前的提问和附件一起带过去。那边已有的草稿会被保留。"),
		default: product.quality === 'insider',
		tags: ['experimental'],
		experiment: { mode: 'auto' },
	},
	[ChatConfiguration.AgentsParallelWorkBannerEnabled]: {
		type: 'boolean',
		description: nls.localize('chat.agentsParallelWorkBanner.enabled', "已有智能体主机会话在跑时，新开一个智能体主机会话就在智能体窗口里提示可以并行干活。"),
		default: false,
		tags: ['experimental'],
		experiment: { mode: 'auto' },
	},
	[ChatConfiguration.CopilotHarnessIntroductionMode]: {
		type: 'string',
		enum: [CopilotHarnessIntroductionMode.Off, CopilotHarnessIntroductionMode.NewSession, CopilotHarnessIntroductionMode.AfterRequest],
		enumDescriptions: [
			nls.localize('chat.copilotHarnessIntroduction.off', "Do not show the Copilot harness introduction."),
			nls.localize('chat.copilotHarnessIntroduction.newSession', "Show the introduction when a new Copilot harness session starts."),
			nls.localize('chat.copilotHarnessIntroduction.afterRequest', "Show the introduction after the first request is submitted in a new Copilot harness session."),
		],
		description: nls.localize('chat.copilotHarnessIntroduction.mode', "Controls when the introduction to the new Copilot experience is shown."),
		default: product.quality === 'insider' ? CopilotHarnessIntroductionMode.NewSession : CopilotHarnessIntroductionMode.Off,
		// 这个产品介绍的是 Copilot 那套 harness，BYOK 产品里没有它；出厂默认本来就是 Off，
		// 所以从注册表里拿掉不改变任何行为，只是设置页不再摆三条看不懂也用处没有的英文选项。
		included: !product.defaultChatAgent?.byokOnly,
		tags: ['experimental'],
		experiment: { mode: 'auto' },
	},
	[ChatConfiguration.HarnessSwitchFeedbackSurveyEnabled]: {
		type: 'boolean',
		description: nls.localize('chat.harnessSwitchFeedbackSurvey.enabled', "Show a one-time feedback survey after switching from Copilot to Local."),
		default: false,
		// 同上：这个调查问的是「从 Copilot 切到本地」的体验，本产品没有可切走的那一侧。
		included: !product.defaultChatAgent?.byokOnly,
		tags: ['experimental'],
		experiment: { mode: 'auto' },
	},
	[ChatConfiguration.AgentsHandoffTipDelaySeconds]: {
		type: 'number',
		minimum: 0,
		default: DEFAULT_AGENTS_HANDOFF_TIP_DELAY_SECONDS,
		markdownDescription: nls.localize('chat.agentsHandoffTip.delaySeconds', "设置发出最后一条消息之后，隔多少秒才提议「把进行中的会话接进智能体窗口」。需要把 `#chat.agentsHandoffTip.mode#` 设成 `default` 或 `custom` 才会生效。"),
		tags: ['experimental', 'advanced'],
		experiment: { mode: 'auto' },
	},
} satisfies Record<string, IConfigurationPropertySchema>;

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'chat',
	properties: {
		[ChatConfiguration.UnifiedWorkspacePicker]: {
			included: !product.defaultChatAgent?.byokOnly, // 本产品没有托管助手，也没有可挂的第三方编码智能体
			type: 'boolean',
			default: product.quality !== 'stable',
			scope: ConfigurationScope.APPLICATION,
			description: nls.localize('sessions.chat.unifiedWorkspacePicker.enabled', "Controls whether the Agents Window uses the unified workspace picker, which combines GitHub and remote workspaces, provides search, and, when supported, allows creating sessions with no workspace."),
			tags: ['experimental'],
			experiment: { mode: 'auto' },
		},
		[ChatConfiguration.AutoMarkAsDoneMergedSessionsAfterDays]: {
			type: 'integer',
			minimum: 0,
			default: 0,
			scope: ConfigurationScope.APPLICATION,
			tags: ['preview', AGENT_SESSION_CLEANUP_SETTINGS_TAG],
			markdownDescription: nls.localize('autoMarkAsDoneMergedSessions.description', "Controls the number of inactive days before agent sessions with a merged pull request are automatically marked as done. Marking a session as done safely removes its eligible worktree. Permanent deletion is controlled separately by {0}. Set to 0 to disable automatically marking sessions as done. The recommended value is 15.", '`#chat.agentSessions.autoDeleteMarkedAsDoneMergedSessionsAfterDays#`'),
			agentHost: { key: AgentHostAutoArchiveMergedSessionsAfterDaysConfigKey },
		},
		[ChatConfiguration.AutoDeleteMarkedAsDoneMergedSessionsAfterDays]: {
			type: 'integer',
			minimum: 0,
			default: 0,
			scope: ConfigurationScope.APPLICATION,
			tags: ['preview', AGENT_SESSION_CLEANUP_SETTINGS_TAG],
			markdownDescription: nls.localize('autoDeleteMarkedAsDoneMergedSessions.description', "Controls the number of days after being automatically marked as done before agent sessions with a merged pull request are permanently deleted. Retained eligible worktrees are safely removed before deletion. Automatically marking sessions as done is controlled separately by {0}. Set to 0 to disable permanent deletion. The recommended value is 15.", '`#chat.agentSessions.autoMarkAsDoneMergedSessionsAfterDays#`'),
			agentHost: { key: AgentHostAutoDeleteArchivedMergedSessionsAfterDaysConfigKey },
		},
	},
});

Registry.as<IConfigurationMigrationRegistry>(WorkbenchConfigurationExtensions.ConfigurationMigration).registerConfigurationMigrations([{
	key: legacyAutoArchiveMergedSessionsAfterDaysSetting,
	includeApplication: true,
	migrateFn: (value, accessor) => {
		const pairs: ConfigurationKeyValuePairs = [[legacyAutoArchiveMergedSessionsAfterDaysSetting, { value: undefined }]];
		if (accessor(ChatConfiguration.AutoMarkAsDoneMergedSessionsAfterDays) === undefined) {
			pairs.push([ChatConfiguration.AutoMarkAsDoneMergedSessionsAfterDays, { value }]);
		}
		return pairs;
	},
}, {
	key: legacyAutoDeleteArchivedMergedSessionsAfterDaysSetting,
	includeApplication: true,
	migrateFn: (value, accessor) => {
		const pairs: ConfigurationKeyValuePairs = [[legacyAutoDeleteArchivedMergedSessionsAfterDaysSetting, { value: undefined }]];
		if (accessor(ChatConfiguration.AutoDeleteMarkedAsDoneMergedSessionsAfterDays) === undefined) {
			pairs.push([ChatConfiguration.AutoDeleteMarkedAsDoneMergedSessionsAfterDays, { value }]);
		}
		return pairs;
	},
}]);
