/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { MenuRegistry } from '../../../../platform/actions/common/actions.js';

import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContribution, Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry } from '../../../common/contributions.js';
import { isProposedApiEnabled } from '../../../services/extensions/common/extensions.js';
import { ExtensionsRegistry } from '../../../services/extensions/common/extensionsRegistry.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IRemoteCodingAgent, IRemoteCodingAgentsService } from '../common/remoteCodingAgentsService.js';

interface IRemoteCodingAgentExtensionPoint {
	id: string;
	command: string;
	displayName: string;
	description?: string;
	followUpRegex?: string;
	when?: string;
}

const extensionPoint = ExtensionsRegistry.registerExtensionPoint<IRemoteCodingAgentExtensionPoint[]>({
	extensionPoint: 'remoteCodingAgents',
	jsonSchema: {
		description: localize('remoteCodingAgentsExtPoint', "为聊天小组件提供远程编码智能体集成。"),
		type: 'array',
		items: {
			type: 'object',
			properties: {
				id: {
					description: localize('remoteCodingAgentsExtPoint.id', "此项的唯一标识符。"),
					type: 'string',
				},
				command: {
					description: localize('remoteCodingAgentsExtPoint.command', "要执行的命令的标识符。该命令必须在“命令”部分中声明。"),
					type: 'string'
				},
				displayName: {
					description: localize('remoteCodingAgentsExtPoint.displayName', "此项的用户友好名称，用于在菜单中显示。"),
					type: 'string'
				},
				description: {
					description: localize('remoteCodingAgentsExtPoint.description', "用于菜单和工具提示的远程智能体的说明。"),
					type: 'string'
				},
				followUpRegex: {
					description: localize('remoteCodingAgentsExtPoint.followUpRegex', "现有聊天对话中最后一次出现的模式将发送到参与扩展，以方便后续答复。"),
					type: 'string',
				},
				when: {
					description: localize('remoteCodingAgentsExtPoint.when', "此条件必须为 true 才能显示此项。"),
					type: 'string'
				},
			},
			required: ['command', 'displayName'],
		}
	}
});

export class RemoteCodingAgentsContribution extends Disposable implements IWorkbenchContribution {
	constructor(
		@IRemoteCodingAgentsService private readonly remoteCodingAgentsService: IRemoteCodingAgentsService
	) {
		super();
		extensionPoint.setHandler(extensions => {
			for (const ext of extensions) {
				if (!isProposedApiEnabled(ext.description, 'remoteCodingAgents')) {
					continue;
				}
				if (!Array.isArray(ext.value)) {
					continue;
				}
				for (const contribution of ext.value) {
					const command = MenuRegistry.getCommand(contribution.command);
					if (!command) {
						continue;
					}

					const agent: IRemoteCodingAgent = {
						id: contribution.id,
						command: contribution.command,
						displayName: contribution.displayName,
						description: contribution.description,
						followUpRegex: contribution.followUpRegex,
						when: contribution.when
					};
					this.remoteCodingAgentsService.registerAgent(agent);
				}
			}
		});
	}
}

const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(RemoteCodingAgentsContribution, LifecyclePhase.Restored);
