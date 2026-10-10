/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../../nls.js';
import { registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { AgentHostLocalFilePermissionsSettingId } from '../../../../../platform/agentHost/common/agentHostResourceService.js';
import { RemoteAgentHostAutoConnectSettingId, RemoteAgentHostsSettingId } from '../../../../../platform/agentHost/common/remoteAgentHostService.js';
import { TunnelAgentHostsSettingId } from '../../../../../platform/agentHost/common/tunnelAgentHost.js';
import { WslAutoStartSettingId } from '../../../../../platform/agentHost/common/wslRemoteAgentHost.js';
import { ConfigurationScope, Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { OpenAgentHostStateFileAction } from '../../agentHost/browser/openAgentHostStateFileAction.js';
import '../../../../../workbench/contrib/chat/browser/remoteAgentHost/remoteAgentHost.contribution.js';
import './remoteAgentHostActions.js';
import './manageRemoteAgentHosts.js';
import '../../agentHost/browser/agentHostAgentPicker.js';

registerAction2(OpenAgentHostStateFileAction);

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	properties: {
		[RemoteAgentHostAutoConnectSettingId]: {
			type: 'boolean',
			description: nls.localize('chat.remoteAgentHosts.autoConnect', "启动时自动连接到在线开发隧道和 SSH 配置的远程代理主机。禁用后，仍会显示缓存会话，但仅在需要时建立连接。"),
			default: true,
			scope: ConfigurationScope.APPLICATION,
			tags: ['experimental', 'advanced'],
		},
		'chat.sshRemoteAgentHostCommand': {
			type: 'string',
			description: nls.localize('chat.sshRemoteAgentHostCommand', "用于开发: 覆盖通过 SSH 启动远程代理主机所用的命令。设置后，将跳过 CLI 自动安装并改为运行此命令。此命令必须向 stdout 或 stderr 输出匹配 ws://127.0.0.1:PORT (可选择性带有 ?tkn=TOKEN)的 WebSocket URL。/"),
			default: '',
			scope: ConfigurationScope.APPLICATION,
			tags: ['experimental', 'advanced'],
		},
		'chat.wslRemoteAgentHostCommand': {
			type: 'string',
			description: nls.localize('chat.wslRemoteAgentHostCommand', "For development: Override the command used to start the remote agent host in WSL. When set, skips automatic CLI installation and runs this command instead. The command must print a WebSocket URL matching ws://127.0.0.1:PORT (optionally with ?tkn=TOKEN) to stdout or stderr."),
			default: '',
			scope: ConfigurationScope.APPLICATION,
			tags: ['experimental', 'advanced'],
		},
		'chat.agentHost.forwardSSHAgent': {
			type: 'boolean',
			description: nls.localize('chat.agentHost.forwardSSHAgent', "启用后，在 SSH 代理主机连接到其 SSH 配置包含 `ForwardAgent yes` 的主机时，将本地 SSH 代理转发到远程计算机。仅对受信任主机启用此功能。必须重启远程代理主机进程，此设置才能生效。"),
			default: false,
			scope: ConfigurationScope.APPLICATION,
			tags: ['experimental', 'advanced'],
		},
		[WslAutoStartSettingId]: {
			type: 'boolean',
			description: nls.localize('chat.agentHost.wsl.autoStart', "Automatically start a WSL distribution when opening a chat whose distribution is not running. When disabled, the chat shows a Start button instead."),
			default: false,
			scope: ConfigurationScope.APPLICATION,
			tags: ['experimental', 'advanced'],
		},
		[RemoteAgentHostsSettingId]: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					address: { type: 'string', description: nls.localize('chat.remoteAgentHosts.address', "远程智能体主机的 WebSocket 地址(例如 \"localhost:3000\")。") },
					name: { type: 'string', description: nls.localize('chat.remoteAgentHosts.name', "此远程代理主机的显示名称。") },
					connectionToken: { type: 'string', description: nls.localize('chat.remoteAgentHosts.connectionToken', "用于远程代理主机身份验证的可选连接令牌。") },
				},
				required: ['address', 'name'],
			},
			description: nls.localize('chat.remoteAgentHosts', "要连接的 WebSocket 远程智能体主机地址列表(例如 \"localhost:3000\")。SSH 远程智能体主机详细信息由 Olympia 管理。"),
			default: [],
			scope: ConfigurationScope.APPLICATION,
			restricted: true,
			tags: ['experimental', 'advanced'],
		},
		[TunnelAgentHostsSettingId]: {
			type: 'array',
			items: { type: 'string' },
			description: nls.localize('chat.remoteAgentTunnels', "连接到远程智能体主机时要查找的其他开发隧道名称。除了从你的帐户自动枚举的隧道外，还会查找这些隧道。"),
			default: [],
			scope: ConfigurationScope.APPLICATION,
			tags: ['experimental', 'advanced'],
		},
		[AgentHostLocalFilePermissionsSettingId]: {
			type: 'object',
			description: nls.localize('chat.agentHost.localFilePermissions', "远程代理主机的每主机文件系统授权。将远程代理主机地址映射到 URI 字符串及主机已获授权的访问模式(`r` 表示读取，`rw` 表示读取和写入)。主机未经提示无法读取或写入授权 URI 之外的任何文件；URI 授权包含子级。此设置通常由代理主机权限提示维护，极少手动编辑。"),
			additionalProperties: {
				type: 'object',
				additionalProperties: {
					oneOf: [
						{
							type: 'string',
							enum: ['r', 'rw'],
							enumDescriptions: [
								nls.localize('chat.agentHost.localFilePermissions.read', "只读权限。"),
								nls.localize('chat.agentHost.localFilePermissions.readWrite', "读取和写入权限。"),
							],
						},
						{
							type: 'object',
							properties: {
								mode: { type: 'string', enum: ['r', 'rw'] },
								lexicalUri: {
									type: 'string',
									description: nls.localize('chat.agentHost.localFilePermissions.lexicalUri', "Original resource URI used to display accessible directory entries."),
								},
							},
							required: ['mode', 'lexicalUri'],
							additionalProperties: false,
						},
					],
				},
			},
			default: {},
			scope: ConfigurationScope.APPLICATION,
			restricted: true,
			tags: ['experimental', 'advanced'],
		},
	},
});
