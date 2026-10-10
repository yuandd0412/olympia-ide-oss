/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../../nls.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { Action } from '../../../../../base/common/actions.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { isCancellationError } from '../../../../../base/common/errors.js';
import { toErrorMessage } from '../../../../../base/common/errorMessage.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { StopWatch } from '../../../../../base/common/stopwatch.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { URI } from '../../../../../base/common/uri.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { ITextEditorOptions } from '../../../../../platform/editor/common/editor.js';
import { ICodeEditor, isCodeEditor } from '../../../../../editor/browser/editorBrowser.js';
import { EndOfLinePreference } from '../../../../../editor/common/model.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { SnippetController2 } from '../../../../../editor/contrib/snippet/browser/snippetController2.js';
import { IEditorService } from '../../../../../workbench/services/editor/common/editorService.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { addWebSocketRemoteAgentHostEntry, IRemoteAgentHostService, parseRemoteAgentHostInput, RemoteAgentHostConnectionStatus, RemoteAgentHostEntryType, RemoteAgentHostInputValidationError, RemoteAgentHostsEnabledSettingId } from '../../../../../platform/agentHost/common/remoteAgentHostService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { computeSSHConnectionKey, ISSHRemoteAgentHostService, isSSHHostKeyDeniedError, SSHAuthMethod, type ISSHAgentHostConfig, type ISSHResolvedConfig } from '../../../../../platform/agentHost/common/sshRemoteAgentHost.js';
import { isTunnelHosted, ITunnelAgentHostService, TUNNEL_ADDRESS_PREFIX, type ITunnelInfo } from '../../../../../platform/agentHost/common/tunnelAgentHost.js';
import { IWSLRemoteAgentHostService, WSL_INSTALL_DOCS_URL, type IWSLDistro } from '../../../../../platform/agentHost/common/wslRemoteAgentHost.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService, ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { INotificationService, Severity } from '../../../../../platform/notification/common/notification.js';
import { IQuickInputButton, IQuickInputService, IQuickPick, IQuickPickItem } from '../../../../../platform/quickinput/common/quickInput.js';
import { IRemoteTunnelService, TunnelStatus } from '../../../../../platform/remoteTunnel/common/remoteTunnel.js';
import { IAuthenticationService } from '../../../../../workbench/services/authentication/common/authentication.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { SessionsCategories } from '../../../../common/categories.js';
import { categorizeSSHConnectError, logSSHConnectAttempt } from '../../../../common/sessionsTelemetry.js';
import { SessionWorkspacePickerGroupContext } from '../../../../common/contextkeys.js';
import { Menus } from '../../../../browser/menus.js';
import { ISessionsService } from '../../../../services/sessions/browser/sessionsService.js';
import { ISessionsProvidersService } from '../../../../services/sessions/browser/sessionsProvidersService.js';
import { IAgentHostSessionsProvider, isAgentHostProvider } from '../../../../common/agentHostSessionsProvider.js';
import { runServerUpgrade } from './remoteHostOptions.js';
import { IConnectionDiagnosticsService } from './connectionDiagnostics.js';
import { SESSION_WORKSPACE_GROUP_REMOTE } from '../../../../services/sessions/common/session.js';
import { ISessionsPartService } from '../../../../services/sessions/browser/sessionsPartService.js';

/** Action / command IDs registered by this file. */
export const RemoteAgentHostCommandIds = {
	addRemoteAgentHost: 'sessions.remoteAgentHost.add',
	connectViaSSH: 'workbench.action.sessions.connectViaSSH',
	addNewSSHHost: 'workbench.action.sessions.addNewSSHHost',
	configureSSHHosts: 'workbench.action.sessions.configureSSHHosts',
	connectViaTunnel: 'workbench.action.sessions.connectViaTunnel',
	connectViaWSL: 'workbench.action.sessions.connectViaWSL',
	manageRemoteAgentHosts: 'workbench.action.sessions.manageRemoteAgentHosts',
	updateRemoteAgentHost: 'workbench.action.sessions.updateRemoteAgentHost',
} as const;

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: RemoteAgentHostCommandIds.addRemoteAgentHost,
			title: localize2('addRemoteAgentHost', "添加远程代理主机..."),
			category: SessionsCategories.Sessions,
			f1: true,
			precondition: ContextKeyExpr.equals(`config.${RemoteAgentHostsEnabledSettingId}`, true),
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const remoteAgentHostService = accessor.get(IRemoteAgentHostService);
		const quickInputService = accessor.get(IQuickInputService);
		const notificationService = accessor.get(INotificationService);
		const configurationService = accessor.get(IConfigurationService);

		// Prompt for address
		const address = await quickInputService.input({
			title: localize('addRemoteTitle', "添加远程代理主机"),
			prompt: localize('addRemotePrompt', "粘贴主机、host:port 或 WebSocket URL。示例: {0}", 'ws://127.0.0.1:8089'),
			placeHolder: 'ws://127.0.0.1:8080?tkn=abc-123',
			ignoreFocusLost: true,
			validateInput: async value => {
				const result = parseRemoteAgentHostInput(value);
				if (result.error === RemoteAgentHostInputValidationError.Empty) {
					return localize('addRemoteValidationEmpty', "输入远程代理主机地址。");
				}
				if (result.error === RemoteAgentHostInputValidationError.Invalid) {
					return localize('addRemoteValidationInvalid', "输入有效的主机、host:port 或 WebSocket URL。");
				}
				return undefined;
			},
		});
		if (!address) {
			return;
		}
		const parsed = parseRemoteAgentHostInput(address);
		if (!parsed.parsed) {
			return;
		}

		// Prompt for display name
		const defaultName = parsed.parsed.suggestedName;
		const name = await quickInputService.input({
			title: localize('nameRemoteTitle', "为远程代理主机命名"),
			prompt: localize('nameRemotePrompt', "输入此远程代理主机的显示名称。"),
			placeHolder: localize('nameRemotePlaceholder', "我的远程智能体"),
			value: defaultName,
			valueSelection: [0, defaultName.length],
			ignoreFocusLost: true,
			validateInput: async value => value.trim() ? undefined : localize('nameRemoteValidationEmpty', "为此远程代理主机输入一个名称。"),
		});
		if (!name?.trim()) {
			return;
		}

		// Connect
		try {
			await addWebSocketRemoteAgentHostEntry(configurationService, {
				name: name.trim(),
				connectionToken: parsed.parsed.connectionToken,
				connection: {
					type: RemoteAgentHostEntryType.WebSocket,
					address: parsed.parsed.address,
				},
			});
			await remoteAgentHostService.waitForConnection(parsed.parsed.address);
		} catch {
			notificationService.error(localize('addRemoteFailed', "未能连接到远程代理主机 {0}。", parsed.parsed.address));
		}
	}
});

// ---- Connect via SSH -------------------------------------------------------

interface ISSHAuthMethodPickItem extends IQuickPickItem {
	readonly method: SSHAuthMethod;
}

/**
 * Parse a free-form SSH connection string of the form `[user@]host[:port]`.
 * Returns `undefined` for empty or invalid input.
 */
export function parseSSHHostInput(value: string): { host: string; username?: string; port?: number } | undefined {
	const trimmed = value.trim();
	if (!trimmed) {
		return undefined;
	}
	const atIdx = trimmed.indexOf('@');
	if (atIdx === 0 || atIdx === trimmed.length - 1) {
		return undefined;
	}
	let username: string | undefined;
	let hostPart: string;
	if (atIdx !== -1) {
		username = trimmed.substring(0, atIdx);
		hostPart = trimmed.substring(atIdx + 1);
	} else {
		hostPart = trimmed;
	}
	if (!hostPart) {
		return undefined;
	}
	let host: string;
	let port: number | undefined;
	const colonIdx = hostPart.lastIndexOf(':');
	if (colonIdx !== -1) {
		host = hostPart.substring(0, colonIdx);
		const portStr = hostPart.substring(colonIdx + 1);
		if (!host) {
			return undefined;
		}
		if (portStr) {
			const portNum = Number(portStr);
			if (!Number.isInteger(portNum) || portNum <= 0 || portNum > 65535) {
				return undefined;
			}
			port = portNum;
		}
	} else {
		host = hostPart;
	}
	if (!host) {
		return undefined;
	}
	return { host, username, port };
}

function validateSSHHostInput(value: string): string | undefined {
	const v = value.trim();
	if (!v) {
		return localize('sshHostEmpty', "输入 SSH 主机。");
	}
	const atIdx = v.indexOf('@');
	if (atIdx === 0) {
		return localize('sshUsernameMissingInHost', "请在 \"@\" 前输入用户名。");
	}
	if (atIdx === v.length - 1) {
		return localize('sshHostMissingAfterAt', "请在 \"@\" 后输入主机名。");
	}
	const hostPart = atIdx !== -1 ? v.substring(atIdx + 1) : v;
	if (!hostPart) {
		return localize('sshHostMissingAfterAt', "请在 \"@\" 后输入主机名。");
	}
	const colonIdx = hostPart.lastIndexOf(':');
	if (colonIdx !== -1) {
		const hostName = hostPart.substring(0, colonIdx);
		const portStr = hostPart.substring(colonIdx + 1);
		if (!hostName) {
			return localize('sshHostMissingAfterAt', "请在 \"@\" 后输入主机名。");
		}
		if (portStr) {
			const portNum = Number(portStr);
			if (!Number.isInteger(portNum) || portNum <= 0 || portNum > 65535) {
				return localize('sshHostInvalidPort', "请输入一个有效的端口号。");
			}
		}
	}
	return undefined;
}

interface ISSHAliasPickItem extends IQuickPickItem {
	readonly kind: 'alias';
	readonly hostAlias: string;
}

interface ISSHNewHostPickItem extends IQuickPickItem {
	kind: 'new-host';
	hostInput: string;
}

interface ISSHFooterPickItem extends IQuickPickItem {
	readonly kind: 'add-config' | 'configure';
}

type SSHHostPickerItem = ISSHAliasPickItem | ISSHNewHostPickItem | ISSHFooterPickItem;

async function promptToConnectViaSSH(
	accessor: ServicesAccessor,
	options: { showBackButton?: boolean } = {},
): Promise<'back' | void> {
	const sshService = accessor.get(ISSHRemoteAgentHostService);
	const quickInputService = accessor.get(IQuickInputService);
	const notificationService = accessor.get(INotificationService);
	const instantiationService = accessor.get(IInstantiationService);
	const commandService = accessor.get(ICommandService);

	const configHosts = await sshService.listSSHConfigHosts().catch(() => [] as string[]);

	const aliasItems: ISSHAliasPickItem[] = configHosts.map(h => ({
		kind: 'alias',
		hostAlias: h,
		label: h,
	}));
	const addHostItem: ISSHFooterPickItem = {
		kind: 'add-config',
		label: '$(plus) ' + localize('sshAddNewHost', "添加新的 SSH 主机..."),
		alwaysShow: true,
	};
	const configureHostsItem: ISSHFooterPickItem = {
		kind: 'configure',
		label: localize('sshConfigureHosts', "配置 SSH 主机..."),
		alwaysShow: true,
	};
	const newHostItem: ISSHNewHostPickItem = {
		kind: 'new-host',
		hostInput: '',
		label: '',
		alwaysShow: true,
	};

	const result = await new Promise<'back' | SSHHostPickerItem | undefined>((resolve) => {
		const store = new DisposableStore();
		const picker = store.add(quickInputService.createQuickPick<SSHHostPickerItem>());
		picker.title = localize('sshHostTitle', "通过 SSH 连接");
		picker.placeholder = localize('sshHostPickerPlaceholder', "选择已配置的 SSH 主机或输入 user@host");
		picker.ignoreFocusOut = true;
		picker.matchOnDescription = true;
		if (options.showBackButton) {
			picker.buttons = [quickInputService.backButton];
		}

		let newHostVisible = false;
		const updateItems = () => {
			const items: SSHHostPickerItem[] = [...aliasItems];
			if (newHostVisible) {
				items.push(newHostItem);
			}
			items.push(addHostItem);
			items.push(configureHostsItem);
			picker.items = items;
		};
		updateItems();

		store.add(picker.onDidChangeValue(value => {
			const parsed = parseSSHHostInput(value);
			if (parsed) {
				newHostItem.hostInput = value.trim();
				newHostItem.label = `\u27a4 ${value.trim()}`;
				if (!newHostVisible) {
					newHostVisible = true;
					updateItems();
				} else {
					// Force item refresh so the label updates
					picker.items = picker.items;
				}
			} else if (newHostVisible) {
				newHostVisible = false;
				updateItems();
			}
		}));

		store.add(picker.onDidTriggerButton(button => {
			if (button === quickInputService.backButton) {
				resolve('back');
				picker.hide();
			}
		}));
		store.add(picker.onDidAccept(() => {
			const selected = picker.selectedItems[0];
			resolve(selected);
			picker.hide();
		}));
		store.add(picker.onDidHide(() => {
			resolve(undefined);
			store.dispose();
		}));
		picker.show();
	});

	if (result === 'back') {
		return 'back';
	}

	if (!result) {
		return;
	}

	if (result.kind === 'add-config' || result.kind === 'configure') {
		const cmdId = result.kind === 'add-config'
			? RemoteAgentHostCommandIds.addNewSSHHost
			: RemoteAgentHostCommandIds.configureSSHHosts;
		// Pass back callback so sub-picker can navigate back to this SSH picker
		const onBackToSSH = () => instantiationService.invokeFunction(a => promptToConnectViaSSH(a, options));
		await commandService.executeCommand(cmdId, onBackToSSH);
		return;
	}

	if (result.kind === 'alias') {
		await instantiationService.invokeFunction(accessor =>
			connectToConfiguredSSHHost(accessor, result.hostAlias)
		);
		return;
	}

	// kind === 'new-host'
	const newHost = result as ISSHNewHostPickItem;
	const parsed = parseSSHHostInput(newHost.hostInput);
	if (!parsed) {
		notificationService.error(validateSSHHostInput(newHost.hostInput) ?? localize('sshHostInvalid', "SSH 主机无效。"));
		return;
	}
	await instantiationService.invokeFunction(accessor =>
		promptForCredentialsAndConnect(accessor, parsed.host, parsed.username, parsed.port)
	);
}

async function connectToConfiguredSSHHost(
	accessor: ServicesAccessor,
	hostAlias: string,
): Promise<void> {
	const sshService = accessor.get(ISSHRemoteAgentHostService);
	const notificationService = accessor.get(INotificationService);
	const instantiationService = accessor.get(IInstantiationService);

	let resolvedConfig: ISSHResolvedConfig;
	try {
		resolvedConfig = await sshService.resolveSSHConfig(hostAlias);
	} catch (err) {
		notificationService.error(localize('sshResolveConfigFailed', "未能解析 {0} 的 SSH 配置: {1}", hostAlias, String(err)));
		return;
	}

	const host = resolvedConfig.hostname;
	const username = resolvedConfig.user;
	const port = resolvedConfig.port !== 22 ? resolvedConfig.port : undefined;
	const suggestedName = hostAlias;

	// Pass through the first resolved IdentityFile (if any) as the explicit
	// key. The main process is responsible for de-duplicating against its
	// default-key scan, so we don't need to filter here.
	const defaultKeyPath = resolvedConfig.identityFile[0];

	if (username) {
		const config: ISSHAgentHostConfig = {
			host,
			port,
			username,
			authMethod: SSHAuthMethod.Agent,
			privateKeyPath: defaultKeyPath,
			identityAgent: resolvedConfig.identityAgent,
			agentForward: resolvedConfig.forwardAgent || undefined,
			name: suggestedName,
			sshConfigHost: hostAlias,
		};
		const connectionAddress = await instantiationService.invokeFunction(accessor =>
			connectWithProgress(accessor, config, suggestedName)
		);
		if (connectionAddress) {
			await instantiationService.invokeFunction(accessor => promptForRemoteFolder(accessor, connectionAddress));
		}
		return;
	}

	// Fallback: alias resolved without a user — fall through to manual flow
	await instantiationService.invokeFunction(accessor =>
		promptForCredentialsAndConnect(accessor, host, undefined, port, suggestedName, defaultKeyPath, resolvedConfig.identityAgent)
	);
}

async function promptForCredentialsAndConnect(
	accessor: ServicesAccessor,
	host: string,
	username: string | undefined,
	port: number | undefined,
	suggestedName?: string,
	defaultKeyPath?: string,
	identityAgent?: string,
): Promise<void> {
	const quickInputService = accessor.get(IQuickInputService);
	const instantiationService = accessor.get(IInstantiationService);

	if (!username) {
		const usernameInput = await quickInputService.input({
			title: localize('sshUsernameTitle', "SSH 用户名"),
			prompt: localize('sshUsernamePrompt', "请输入 {0} 的用户名。", host),
			placeHolder: 'root',
			ignoreFocusLost: true,
			validateInput: async value => value.trim() ? undefined : localize('sshUsernameEmpty', "输入用户名。"),
		});
		if (!usernameInput) {
			return;
		}
		username = usernameInput.trim();
	}

	const authPicks: ISSHAuthMethodPickItem[] = [
		{
			method: SSHAuthMethod.Agent,
			label: localize('sshAuthAgent', "SSH 智能体"),
			description: localize('sshAuthAgentDesc', "使用正在运行的 SSH 代理进行身份验证"),
		},
		{
			method: SSHAuthMethod.KeyFile,
			label: localize('sshAuthKey', "私钥文件"),
			description: localize('sshAuthKeyDesc', "使用私钥文件进行身份验证"),
		},
		{
			method: SSHAuthMethod.Password,
			label: localize('sshAuthPassword', "密码"),
			description: localize('sshAuthPasswordDesc', "使用密码进行身份验证"),
		},
	];

	const authPicked = await quickInputService.pick(authPicks, {
		title: localize('sshAuthTitle', "身份验证方法"),
		placeHolder: localize('sshAuthPlaceholder', "选择对 {0} 进行身份验证的方式", host),
		ignoreFocusLost: true,
	});
	if (!authPicked) {
		return;
	}
	const authMethod = authPicked.method;

	let privateKeyPath: string | undefined;
	let password: string | undefined;

	if (authMethod === SSHAuthMethod.KeyFile) {
		const keyPath = await quickInputService.input({
			title: localize('sshKeyTitle', "私钥路径"),
			prompt: localize('sshKeyPrompt', "输入 SSH 私钥的路径。"),
			placeHolder: '~/.ssh/id_rsa',
			value: defaultKeyPath ?? '~/.ssh/id_rsa',
			ignoreFocusLost: true,
			validateInput: async value => value.trim() ? undefined : localize('sshKeyEmpty', "请输入密钥文件路径。"),
		});
		if (!keyPath) {
			return;
		}
		privateKeyPath = keyPath.trim();
	} else if (authMethod === SSHAuthMethod.Password) {
		const pw = await quickInputService.input({
			title: localize('sshPasswordTitle', "SSH 密码"),
			prompt: localize('sshPasswordPrompt', "请输入 {0}@{1} 的密码。", username, host),
			password: true,
			ignoreFocusLost: true,
			validateInput: async value => value ? undefined : localize('sshPasswordEmpty', "请输入密码。"),
		});
		if (!pw) {
			return;
		}
		password = pw;
	}

	const defaultName = suggestedName ?? `${username}@${host}`;
	const name = await quickInputService.input({
		title: localize('sshNameTitle', "命名远程智能体"),
		prompt: localize('sshNamePrompt', "请为此 SSH 远程代理输入显示名称。"),
		placeHolder: localize('sshNamePlaceholder', "我的远程智能体"),
		value: defaultName,
		valueSelection: [0, defaultName.length],
		ignoreFocusLost: true,
		validateInput: async value => value.trim() ? undefined : localize('sshNameEmpty', "输入名称。"),
	});
	if (!name) {
		return;
	}

	const config: ISSHAgentHostConfig = {
		host,
		port,
		username,
		authMethod,
		privateKeyPath,
		identityAgent,
		password,
		name: name.trim(),
	};

	const connectionAddress = await instantiationService.invokeFunction(accessor =>
		connectWithProgress(accessor, config, host)
	);
	if (connectionAddress) {
		await instantiationService.invokeFunction(accessor => promptForRemoteFolder(accessor, connectionAddress));
	}
}

export async function connectWithProgress(
	accessor: ServicesAccessor,
	config: ISSHAgentHostConfig,
	displayHost: string,
): Promise<string | undefined> {
	const sshService = accessor.get(ISSHRemoteAgentHostService);
	const remoteAgentHostService = accessor.get(IRemoteAgentHostService);
	const notificationService = accessor.get(INotificationService);
	const telemetryService = accessor.get(ITelemetryService);
	const stopwatch = StopWatch.create(false);

	const address = computeSSHConnectionKey(config);
	if (remoteAgentHostService.connections.some(connection => connection.address === address && RemoteAgentHostConnectionStatus.isConnected(connection.status))) {
		return address;
	}

	const handle = notificationService.notify({
		severity: Severity.Info,
		message: localize('sshConnecting', "正在通过 SSH 连接到 {0}...", displayHost),
		progress: { infinite: true },
	});

	const progressListener = sshService.onDidReportConnectProgress?.(progress => {
		if (progress.connectionKey === address) {
			handle.updateMessage(progress.message);
		}
	});

	try {
		const connection = await sshService.connect(config);
		logSSHConnectAttempt(telemetryService, {
			operation: 'connect',
			userInitiated: config.userInitiated ?? true,
			attempt: 1,
			durationMs: stopwatch.elapsed(),
			success: true,
			willRetry: false,
		});
		handle.close();
		return connection.localAddress;
	} catch (err) {
		logSSHConnectAttempt(telemetryService, {
			operation: 'connect',
			userInitiated: config.userInitiated ?? true,
			attempt: 1,
			durationMs: stopwatch.elapsed(),
			success: false,
			willRetry: false,
			errorCategory: categorizeSSHConnectError(err),
		});
		handle.close();
		if (isCancellationError(err) || isSSHHostKeyDeniedError(err)) {
			// A refused host key needs no generic error on top: either the user
			// declined the prompt themselves, or the host key UI has already
			// shown a specific notification with a way to recover.
			return undefined;
		}
		notificationService.error(localize('sshConnectFailed', "未能通过 SSH 连接到 {0}: {1}", displayHost, String(err)));
		return undefined;
	} finally {
		progressListener?.dispose();
	}
}

/**
 * After a successful SSH connection, show the remote folder picker and
 * pre-select the chosen folder in the workspace picker.
 */
async function promptForRemoteFolder(
	accessor: ServicesAccessor,
	address: string,
): Promise<void> {
	const sessionsProvidersService = accessor.get(ISessionsProvidersService);
	const sessionsService = accessor.get(ISessionsService);
	const sessionsPartService = accessor.get(ISessionsPartService);

	// The factory-backed entry fires onDidChangeConnections before its handshake completes, so the provider should exist by now.
	const provider = sessionsProvidersService.getProviders().find((p): p is IAgentHostSessionsProvider => isAgentHostProvider(p) && p.remoteAddress === address);
	if (!provider) {
		return;
	}

	// Use the provider's existing browse action to show the folder picker
	const browseAction = provider.browseActions[0];
	if (!browseAction) {
		return;
	}

	const workspace = await browseAction.run();
	if (!workspace) {
		return;
	}
	const folderUri = workspace.folders[0]?.root;
	if (!folderUri) {
		return;
	}

	sessionsService.openNewSession();
	sessionsPartService.getSessionView(sessionsService.activeSession.get()?.sessionId)?.selectWorkspace(folderUri);
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: RemoteAgentHostCommandIds.connectViaSSH,
			title: localize2('connectViaSSH', "通过 SSH 连接到远程代理主机"),
			shortTitle: localize2('connectViaSSHShort', "SSH"),
			category: SessionsCategories.Sessions,
			f1: true,
			icon: Codicon.remote,
			precondition: ContextKeyExpr.equals(`config.${RemoteAgentHostsEnabledSettingId}`, true),
			menu: {
				id: Menus.SessionWorkspaceManage,
				order: 20,
				when: SessionWorkspacePickerGroupContext.isEqualTo(SESSION_WORKSPACE_GROUP_REMOTE),
			},
		});
	}

	override async run(accessor: ServicesAccessor, onBack?: () => void): Promise<void> {
		const result = await promptToConnectViaSSH(accessor, { showBackButton: !!onBack });
		if (result === 'back') {
			onBack?.();
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: RemoteAgentHostCommandIds.addNewSSHHost,
			title: localize2('addNewSSHHost', "添加新的 SSH 主机..."),
			category: SessionsCategories.Sessions,
			f1: true,
			precondition: ContextKeyExpr.equals(`config.${RemoteAgentHostsEnabledSettingId}`, true),
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const sshService = accessor.get(ISSHRemoteAgentHostService);
		const editorService = accessor.get(IEditorService);
		const fileService = accessor.get(IFileService);
		const notificationService = accessor.get(INotificationService);

		let configUri;
		try {
			configUri = await sshService.ensureUserSSHConfig();
		} catch (err) {
			notificationService.error(localize('sshConfigCreateFailed', "创建 SSH 配置文件失败: {0}", String(err)));
			return;
		}

		const editorPane = await editorService.openEditor({ resource: configUri, options: { pinned: true } satisfies ITextEditorOptions });
		if (!editorPane) {
			return;
		}
		const control = editorPane.getControl();
		if (!isCodeEditor(control) || !control.hasModel()) {
			return;
		}
		const editor = control as ICodeEditor;
		const model = editor.getModel();
		if (!model) {
			return;
		}

		// Append a snippet at end of document. Read file content for length;
		// fall back to model length to avoid races.
		let appendNewline = false;
		try {
			const stat = await fileService.stat(configUri);
			if (stat.size > 0) {
				const content = model.getValueInRange(model.getFullModelRange(), EndOfLinePreference.LF);
				appendNewline = content.length > 0 && !content.endsWith('\n');
			}
		} catch {
			// ignore
		}
		const lastLine = model.getLineCount();
		const lastCol = model.getLineMaxColumn(lastLine);
		editor.setSelection(new Range(lastLine, lastCol, lastLine, lastCol));

		const snippet = (appendNewline ? '\n' : '') + 'Host ${1:alias}\n    HostName ${2:hostname}\n    User ${3:user}\n';
		SnippetController2.get(editor)?.insert(snippet);
		editor.focus();
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: RemoteAgentHostCommandIds.configureSSHHosts,
			title: localize2('configureSSHHosts', "配置 SSH 主机..."),
			category: SessionsCategories.Sessions,
			f1: true,
			precondition: ContextKeyExpr.equals(`config.${RemoteAgentHostsEnabledSettingId}`, true),
		});
	}

	override async run(accessor: ServicesAccessor, onBack?: () => void): Promise<void> {
		const sshService = accessor.get(ISSHRemoteAgentHostService);
		const editorService = accessor.get(IEditorService);
		const quickInputService = accessor.get(IQuickInputService);
		const notificationService = accessor.get(INotificationService);

		let configFiles: URI[];
		try {
			configFiles = await sshService.listSSHConfigFiles();
		} catch (err) {
			notificationService.error(localize('sshConfigListFailed', "列出 SSH 配置文件失败: {0}", String(err)));
			return;
		}

		// Always offer the user-config fallback so we have something openable.
		if (configFiles.length === 0) {
			try {
				const uri = await sshService.ensureUserSSHConfig();
				await editorService.openEditor({ resource: uri, options: { pinned: true } satisfies ITextEditorOptions });
			} catch (err) {
				notificationService.error(localize('sshConfigOpenFailed', "打开 SSH 配置文件失败: {0}", String(err)));
			}
			return;
		}

		interface ISSHConfigFilePickItem extends IQuickPickItem {
			readonly uri: URI;
			readonly isUserConfig: boolean;
		}
		const userConfigUri = configFiles[0];
		const items: ISSHConfigFilePickItem[] = configFiles.map((uri, index) => ({
			label: uri.fsPath,
			uri,
			isUserConfig: index === 0,
		}));

		// If there's only one file, skip the picker and open it directly.
		// If onBack is provided we still need to show the picker to offer navigation.
		if (items.length === 1 && !onBack) {
			const picked = items[0];
			try {
				const uri = picked.isUserConfig
					? await sshService.ensureUserSSHConfig().catch(() => userConfigUri)
					: picked.uri;
				await editorService.openEditor({ resource: uri, options: { pinned: true } satisfies ITextEditorOptions });
			} catch (err) {
				notificationService.error(localize('sshConfigOpenFailed', "打开 SSH 配置文件失败: {0}", String(err)));
			}
			return;
		}

		const picked = await new Promise<'back' | ISSHConfigFilePickItem | undefined>(resolve => {
			const store = new DisposableStore();
			const picker = store.add(quickInputService.createQuickPick<ISSHConfigFilePickItem>());
			picker.title = localize('sshConfigPickTitle', "选择要编辑的 SSH 配置文件");
			picker.placeholder = localize('sshConfigPickPlaceholder', "选择 SSH 配置文件");
			picker.items = items;
			if (onBack) {
				picker.buttons = [quickInputService.backButton];
			}
			store.add(picker.onDidTriggerButton(button => {
				if (button === quickInputService.backButton) {
					resolve('back');
					picker.hide();
				}
			}));
			store.add(picker.onDidAccept(() => {
				resolve(picker.selectedItems[0]);
				picker.hide();
			}));
			store.add(picker.onDidHide(() => {
				resolve(undefined);
				store.dispose();
			}));
			picker.show();
		});

		if (picked === 'back') {
			onBack?.();
			return;
		}
		if (!picked) {
			return;
		}

		try {
			// If the user picked the user config, ensure it exists (creating it on demand)
			// before opening so we don't try to open a file that's not there yet.
			const uri = picked.isUserConfig
				? await sshService.ensureUserSSHConfig().catch(() => userConfigUri)
				: picked.uri;
			await editorService.openEditor({ resource: uri, options: { pinned: true } satisfies ITextEditorOptions });
		} catch (err) {
			notificationService.error(localize('sshConfigOpenFailed', "打开 SSH 配置文件失败: {0}", String(err)));
		}
	}
});

// ---- Connect via Dev Tunnel -------------------------------------------------

interface ITunnelPickItem extends IQuickPickItem {
	readonly tunnel: ITunnelInfo;
}

function sortTunnelsByName(tunnels: readonly ITunnelInfo[]): ITunnelInfo[] {
	return [...tunnels].sort((a, b) => a.name.localeCompare(b.name));
}

async function promptToConnectViaTunnel(
	accessor: ServicesAccessor,
	options: { showBackButton?: boolean } = {},
): Promise<'back' | void> {
	const tunnelService = accessor.get(ITunnelAgentHostService);
	const diagnosticsService = accessor.get(IConnectionDiagnosticsService);
	const quickInputService = accessor.get(IQuickInputService);
	const notificationService = accessor.get(INotificationService);
	const authenticationService = accessor.get(IAuthenticationService);
	const instantiationService = accessor.get(IInstantiationService);
	const productService = accessor.get(IProductService);
	const dialogService = accessor.get(IDialogService);
	const remoteTunnelService = accessor.get(IRemoteTunnelService);
	const store = new DisposableStore();
	let remoteTunnelStatus: TunnelStatus = { type: 'uninitialized' };
	let hasReceivedRemoteTunnelStatus = false;
	let tunnels: ITunnelInfo[] = [];
	// eslint-disable-next-line prefer-const
	let tunnelPicker: IQuickPick<ITunnelPickItem> | undefined;
	const deleteTunnelButton: IQuickInputButton = {
		iconClass: ThemeIcon.asClassName(Codicon.trash),
		tooltip: localize('tunnelDeleteTooltip', "Delete Dev Tunnel"),
	};
	const isHostedTunnel = (tunnel: ITunnelInfo): boolean => isTunnelHosted(remoteTunnelStatus.type === 'connected' ? remoteTunnelStatus.info : undefined, tunnel);
	const toTunnelPickItems = (tunnelInfos: readonly ITunnelInfo[]): ITunnelPickItem[] => sortTunnelsByName(tunnelInfos)
		.filter(tunnel => !isHostedTunnel(tunnel))
		.map(tunnel => ({
			label: tunnel.name,
			description: tunnel.hostConnectionCount > 0
				? localize('tunnelPickOnline', "{0} · Online", tunnel.tunnelId)
				: localize('tunnelPickOffline', "{0} · Offline", tunnel.tunnelId),
			buttons: tunnelService.canDeleteTunnels ? [deleteTunnelButton] : undefined,
			tunnel,
		}));
	const updateTunnelPickerItems = () => {
		if (tunnelPicker) {
			tunnelPicker.items = toTunnelPickItems(tunnels);
		}
	};
	store.add(remoteTunnelService.onDidChangeTunnelStatus(status => {
		hasReceivedRemoteTunnelStatus = true;
		remoteTunnelStatus = status;
		updateTunnelPickerItems();
	}));
	const initialRemoteTunnelStatus = await remoteTunnelService.getTunnelStatus();
	if (!hasReceivedRemoteTunnelStatus) {
		remoteTunnelStatus = initialRemoteTunnelStatus;
	}

	// Step 1: Determine auth provider — try cached sessions first, then prompt
	// This used to call tunnelService.getAuthProvider, but for now we're Github-
	// only for the remote AH connection.
	const authProvider = 'github';

	// Trigger interactive auth for the chosen provider
	const scopes = productService.tunnelApplicationConfig?.authenticationProviders?.[authProvider]?.scopes ?? [];
	try {
		if (!(await authenticationService.getSessions(authProvider, scopes)).length) {
			await authenticationService.createSession(authProvider, scopes, { activateImmediate: true });
		}
	} catch {
		store.dispose();
		notificationService.error(localize('tunnelAuthFailed', "身份验证失败。请重试。"));
		return;
	}

	// Step 2: Show tunnel picker immediately in busy state while enumerating
	tunnelPicker = store.add(quickInputService.createQuickPick<ITunnelPickItem>());
	tunnelPicker.title = localize('tunnelPickTitle', "通过开发隧道连接");
	tunnelPicker.placeholder = localize('tunnelPickPlaceholder', "选择要连接的开发隧道");
	tunnelPicker.busy = true;
	if (options.showBackButton) {
		tunnelPicker.buttons = [quickInputService.backButton];
	}
	tunnelPicker.show();

	try {
		tunnels = await diagnosticsService.trackDiscovery('interactive', onDiagnostic => tunnelService.listTunnels({ authProvider, onDiagnostic }));
	} catch (err) {
		store.dispose();
		notificationService.error(localize('tunnelListFailed', "未能列出开发隧道: {0}", err instanceof Error ? err.message : String(err)));
		return;
	}

	if (tunnels.length === 0) {
		store.dispose();
		notificationService.info(localize('tunnelNoneFound', "未找到支持智能体主机的开发隧道。请在另一台计算机上使用 \"code tunnel\" 启动隧道。"));
		return;
	}

	if (toTunnelPickItems(tunnels).length === 0) {
		store.dispose();
		notificationService.info(localize('tunnelOnlyLocalFound', "This machine is already hosting the only available dev tunnel."));
		return;
	}

	updateTunnelPickerItems();
	tunnelPicker.busy = false;

	// Step 3: Wait for user selection
	const picked = await new Promise<'back' | ITunnelPickItem | undefined>(resolve => {
		// While the modal delete confirmation is up the picker loses focus and
		// may hide itself. `isDeleting` suppresses the hide handler for that
		// window so the pick isn't cancelled, and the picker is re-shown once
		// the confirmation resolves.
		let isDeleting = false;
		store.add(tunnelPicker.onDidTriggerButton(button => {
			if (button === quickInputService.backButton) {
				resolve('back');
				tunnelPicker.hide();
			}
		}));
		store.add(tunnelPicker.onDidAccept(() => {
			if (isDeleting) {
				return;
			}
			const picked = tunnelPicker.selectedItems[0];
			if (picked && isHostedTunnel(picked.tunnel)) {
				updateTunnelPickerItems();
				return;
			}
			resolve(picked);
			tunnelPicker.hide();
		}));
		store.add(tunnelPicker.onDidTriggerItemButton(async event => {
			if (event.button !== deleteTunnelButton || isDeleting) {
				return;
			}
			if (isHostedTunnel(event.item.tunnel)) {
				updateTunnelPickerItems();
				return;
			}

			const previousIgnoreFocusOut = tunnelPicker.ignoreFocusOut;
			isDeleting = true;
			tunnelPicker.ignoreFocusOut = true;
			let keepOpen = true;
			try {
				const confirmation = await dialogService.confirm({
					type: 'warning',
					message: localize('tunnelDeleteConfirmation', "Are you sure you want to delete dev tunnel '{0}'?", event.item.tunnel.name),
					detail: localize('tunnelDeleteDetail', "The tunnel may be recreated if a machine starts hosting it again."),
					primaryButton: localize('tunnelDeleteButton', "删除(&&D)"),
				});
				if (!confirmation.confirmed) {
					return;
				}
				if (isHostedTunnel(event.item.tunnel)) {
					updateTunnelPickerItems();
					return;
				}

				tunnelPicker.busy = true;
				await tunnelService.deleteTunnel(event.item.tunnel, authProvider);
				tunnels = tunnels.filter(tunnel => tunnel.tunnelId !== event.item.tunnel.tunnelId);
				updateTunnelPickerItems();
				try {
					tunnels = await diagnosticsService.trackDiscovery('afterDelete', onDiagnostic => tunnelService.listTunnels({ authProvider, onDiagnostic }));
				} catch (err) {
					notificationService.error(localize('tunnelRefreshAfterDeleteFailed', "Deleted dev tunnel '{0}', but failed to refresh dev tunnels: {1}", event.item.tunnel.name, err instanceof Error ? err.message : String(err)));
					return;
				}
				if (toTunnelPickItems(tunnels).length === 0) {
					keepOpen = false;
					notificationService.info(localize('tunnelNoneFoundAfterDelete', "未找到支持智能体主机的开发隧道。请在另一台计算机上使用 \"code tunnel\" 启动隧道。"));
					return;
				}

				updateTunnelPickerItems();
			} catch (err) {
				notificationService.error(localize('tunnelDeleteFailed', "Failed to delete dev tunnel '{0}': {1}", event.item.tunnel.name, err instanceof Error ? err.message : String(err)));
			} finally {
				tunnelPicker.busy = false;
				tunnelPicker.ignoreFocusOut = previousIgnoreFocusOut;
				isDeleting = false;
				if (keepOpen) {
					tunnelPicker.show();
				} else {
					// The picker may already be hidden behind the confirmation
					// dialog, in which case `hide()` is a no-op and would never
					// fire `onDidHide`, so settle the pick explicitly here.
					resolve(undefined);
					tunnelPicker.hide();
					store.dispose();
				}
			}
		}));
		store.add(tunnelPicker.onDidHide(() => {
			if (isDeleting) {
				return;
			}
			resolve(undefined);
			store.dispose();
		}));
	});

	if (picked === 'back') {
		return 'back';
	}
	if (!picked) {
		return;
	}

	// Step 4: Connect to the tunnel with progress notification
	const handle = notificationService.notify({
		severity: Severity.Info,
		message: localize('tunnelConnecting', "正在连接到隧道“{0}”...", picked.tunnel.name),
		progress: { infinite: true },
	});

	try {
		// `connect` caches the tunnel internally before wiring the live
		// connection — no separate `cacheTunnel` call needed here.
		tunnelService.clearTunnelDismissal(picked.tunnel.tunnelId);
		await tunnelService.connect(picked.tunnel, authProvider, { userInitiated: true });
		handle.close();
	} catch (err) {
		handle.close();
		notificationService.error(localize('tunnelConnectFailed', "未能连接到隧道“{0}”: {1}", picked.tunnel.name, err instanceof Error ? err.message : String(err)));
		return;
	}

	// Step 5: Open folder picker (same pattern as SSH)
	await instantiationService.invokeFunction(accessor => promptForTunnelFolder(accessor, picked.tunnel));
}

/**
 * After a successful tunnel connection, show the remote folder picker and
 * pre-select the chosen folder in the workspace picker.
 */
async function promptForTunnelFolder(
	accessor: ServicesAccessor,
	tunnel: ITunnelInfo,
): Promise<void> {
	const sessionsProvidersService = accessor.get(ISessionsProvidersService);
	const sessionsService = accessor.get(ISessionsService);
	const sessionsPartService = accessor.get(ISessionsPartService);

	const tunnelAddress = `${TUNNEL_ADDRESS_PREFIX}${tunnel.tunnelId}`;

	// The provider is created by TunnelAgentHostContribution when the
	// tunnel is cached (via onDidChangeTunnels / _reconcileProviders).
	const provider = sessionsProvidersService.getProviders().find((p): p is IAgentHostSessionsProvider => isAgentHostProvider(p) && p.remoteAddress === tunnelAddress);
	if (!provider) {
		return;
	}

	// Use the provider's existing browse action to show the folder picker
	const browseAction = provider.browseActions[0];
	if (!browseAction) {
		return;
	}

	const workspace = await browseAction.run();
	if (!workspace) {
		return;
	}
	const folderUri = workspace.folders[0]?.root;
	if (!folderUri) {
		return;
	}

	sessionsService.openNewSession();
	sessionsPartService.getSessionView(sessionsService.activeSession.get()?.sessionId)?.selectWorkspace(folderUri, { providerId: provider.id });
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: RemoteAgentHostCommandIds.connectViaTunnel,
			title: localize2('connectViaTunnel', "通过开发隧道连接到远程智能体主机"),
			shortTitle: localize2('connectViaTunnelShort', "隧道..."),
			category: SessionsCategories.Sessions,
			f1: true,
			icon: Codicon.cloud,
			precondition: ContextKeyExpr.equals(`config.${RemoteAgentHostsEnabledSettingId}`, true),
			menu: {
				id: Menus.SessionWorkspaceManage,
				order: 10,
				when: SessionWorkspacePickerGroupContext.isEqualTo(SESSION_WORKSPACE_GROUP_REMOTE),
			},
		});
	}

	override async run(accessor: ServicesAccessor, onBack?: () => void): Promise<void> {
		const result = await promptToConnectViaTunnel(accessor, { showBackButton: !!onBack });
		if (result === 'back') {
			onBack?.();
		}
	}
});

// ---- Connect via WSL -------------------------------------------------------

interface IWSLDistroPickItem extends IQuickPickItem {
	readonly distro: IWSLDistro;
}

async function promptToConnectViaWSL(
	accessor: ServicesAccessor,
	options: { showBackButton?: boolean } = {},
): Promise<'back' | void> {
	const wslService = accessor.get(IWSLRemoteAgentHostService);
	const notificationService = accessor.get(INotificationService);
	const quickInputService = accessor.get(IQuickInputService);
	const openerService = accessor.get(IOpenerService);
	const instantiationService = accessor.get(IInstantiationService);
	const logService = accessor.get(ILogService);

	const installAction = new Action(
		'wsl.openDocs',
		localize('wslInstallDocsAction', "安装 WSL"),
		undefined,
		true,
		() => openerService.open(URI.parse(WSL_INSTALL_DOCS_URL)),
	);

	if (!(await wslService.isWSLAvailable())) {
		notificationService.notify({
			severity: Severity.Info,
			message: localize('wslNotInstalled', "未安装或未启用适用于 Linux 的 Windows 子系统。"),
			actions: { primary: [installAction] },
		});
		return;
	}

	let distros: IWSLDistro[];
	try {
		distros = await wslService.listDistros();
	} catch (err) {
		logService.error('[WSL] listDistros failed', err);
		notificationService.error(localize('wslListFailed', "未能列出 WSL 分发版: {0}", toErrorMessage(err)));
		return;
	}

	if (distros.length === 0) {
		notificationService.notify({
			severity: Severity.Info,
			message: localize('wslNoDistros', "未安装任何 WSL 2 分发版。"),
			actions: { primary: [installAction] },
		});
		return;
	}

	const items: IWSLDistroPickItem[] = distros.map(d => ({
		label: d.name,
		description: d.isRunning ? localize('wslDistroRunning', "正在运行") : localize('wslDistroStopped', "已停止"),
		detail: d.isDefault ? localize('wslDistroDefault', "默认分发版") : undefined,
		distro: d,
	}));

	let picked: IWSLDistroPickItem | undefined;
	if (items.length === 1 && !options.showBackButton) {
		picked = items[0];
	} else {
		const result = await new Promise<'back' | IWSLDistroPickItem | undefined>(resolve => {
			const store = new DisposableStore();
			const picker = store.add(quickInputService.createQuickPick<IWSLDistroPickItem>());
			picker.title = localize('wslPickTitle', "通过 WSL 连接");
			picker.placeholder = localize('wslPickPlaceholder', "选择要连接到的 WSL 分发版");
			picker.items = items;
			if (options.showBackButton) {
				picker.buttons = [quickInputService.backButton];
			}
			store.add(picker.onDidTriggerButton(button => {
				if (button === quickInputService.backButton) {
					resolve('back');
					picker.hide();
				}
			}));
			store.add(picker.onDidAccept(() => {
				resolve(picker.selectedItems[0]);
				picker.hide();
			}));
			store.add(picker.onDidHide(() => {
				resolve(undefined);
				store.dispose();
			}));
			picker.show();
		});

		if (result === 'back') {
			return 'back';
		}
		if (!result) {
			return;
		}
		picked = result;
	}

	const handle = notificationService.notify({
		severity: Severity.Info,
		message: localize('wslConnecting', "正在连接到 WSL 分发版“{0}”...", picked.distro.name),
		progress: { infinite: true },
	});

	const expectedKey = `wsl:${picked.distro.name}`;
	const progressListener = wslService.onDidReportConnectProgress?.(progress => {
		if (progress.connectionKey === expectedKey) {
			handle.updateMessage(progress.message);
		}
	});

	try {
		await wslService.connect({ distro: picked.distro.name, name: picked.distro.name });
		handle.close();
	} catch (err) {
		handle.close();
		if (isCancellationError(err)) {
			return;
		}
		logService.error(`[WSL] Connect to '${picked.distro.name}' failed`, err);
		notificationService.error(localize('wslConnectFailed', "未能连接到 WSL 分发版“{0}”: {1}", picked.distro.name, toErrorMessage(err)));
		return;
	} finally {
		progressListener?.dispose();
	}

	await instantiationService.invokeFunction(accessor => promptForWSLFolder(accessor, picked.distro.name));
}

/**
 * After a successful WSL connection, show the remote folder picker and
 * pre-select the chosen folder in the workspace picker.
 */
async function promptForWSLFolder(
	accessor: ServicesAccessor,
	distro: string,
): Promise<void> {
	const sessionsProvidersService = accessor.get(ISessionsProvidersService);
	const sessionsService = accessor.get(ISessionsService);
	const sessionsPartService = accessor.get(ISessionsPartService);

	const wslAddress = `wsl:${distro}`;
	const provider = sessionsProvidersService.getProviders().find((p): p is IAgentHostSessionsProvider => isAgentHostProvider(p) && p.remoteAddress === wslAddress);
	if (!provider) {
		return;
	}

	const browseAction = provider.browseActions[0];
	if (!browseAction) {
		return;
	}

	const workspace = await browseAction.run();
	if (!workspace) {
		return;
	}
	const folderUri = workspace.folders[0]?.root;
	if (!folderUri) {
		return;
	}

	sessionsService.openNewSession();
	sessionsPartService.getSessionView(sessionsService.activeSession.get()?.sessionId)?.selectWorkspace(folderUri, { providerId: provider.id });
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: RemoteAgentHostCommandIds.connectViaWSL,
			title: localize2('connectViaWSL', "通过 WSL 连接到远程代理主机"),
			shortTitle: localize2('connectViaWSLShort', "WSL..."),
			category: SessionsCategories.Sessions,
			f1: true,
			icon: Codicon.terminalLinux,
			precondition: ContextKeyExpr.and(
				ContextKeyExpr.equals('isWindows', true),
				ContextKeyExpr.equals(`config.${RemoteAgentHostsEnabledSettingId}`, true),
			),
			menu: {
				id: Menus.SessionWorkspaceManage,
				order: 15,
				when: ContextKeyExpr.and(
					ContextKeyExpr.equals('isWindows', true),
					SessionWorkspacePickerGroupContext.isEqualTo(SESSION_WORKSPACE_GROUP_REMOTE),
				),
			},
		});
	}

	override async run(accessor: ServicesAccessor, onBack?: () => void): Promise<void> {
		const result = await promptToConnectViaWSL(accessor, { showBackButton: !!onBack });
		if (result === 'back') {
			onBack?.();
		}
	}
});

/**
 * Force-update a remote agent host server that rejected our protocol
 * version because it is running an old build. Connecting to such a host
 * leaves it in the `incompatible` state; when the host was spawned by a
 * VS Code CLI willing to receive upgrade signals it advertises an upgrade
 * method, which this command invokes via the shared {@link runServerUpgrade}
 * flow. Exposed in the command palette so the update is reachable without
 * first opening the host's options quickpick.
 */
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: RemoteAgentHostCommandIds.updateRemoteAgentHost,
			title: localize2('updateRemoteAgentHost', "更新远程智能体主机服务器..."),
			category: SessionsCategories.Sessions,
			f1: true,
			precondition: ContextKeyExpr.equals(`config.${RemoteAgentHostsEnabledSettingId}`, true),
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const sessionsProvidersService = accessor.get(ISessionsProvidersService);
		const quickInputService = accessor.get(IQuickInputService);
		const notificationService = accessor.get(INotificationService);
		const instantiationService = accessor.get(IInstantiationService);

		const remoteHosts = sessionsProvidersService.getProviders()
			.filter(isAgentHostProvider)
			.filter(provider => !!provider.remoteAddress);
		let incompatibleCount = 0;
		const upgradable = remoteHosts
			.map(provider => {
				const status = provider.connectionStatus?.get();
				if (!RemoteAgentHostConnectionStatus.isIncompatible(status)) {
					return undefined;
				}
				incompatibleCount++;
				return status.vscodeUpgradeMethod ? { provider, method: status.vscodeUpgradeMethod } : undefined;
			})
			.filter((entry): entry is { provider: IAgentHostSessionsProvider; method: string } => !!entry);

		if (upgradable.length === 0) {
			// Distinguish "nothing is incompatible" from "incompatible hosts exist
			// but none was spawned by a VS Code CLI that can update it in place".
			notificationService.info(incompatibleCount > 0
				? localize('updateRemoteAgentHost.noneUpgradable', "无法从此处更新任何远程智能体主机。必须手动更新不兼容的主机，然后重新连接。")
				: localize('updateRemoteAgentHost.none', "没有需要更新的远程智能体主机。"));
			return;
		}

		let target = upgradable[0];
		if (upgradable.length > 1) {
			type UpdateHostPickItem = IQuickPickItem & { entry: { provider: IAgentHostSessionsProvider; method: string } };
			const picked = await quickInputService.pick<UpdateHostPickItem>(
				upgradable.map(entry => ({
					label: entry.provider.label,
					description: entry.provider.remoteAddress,
					entry,
				})),
				{ placeHolder: localize('updateRemoteAgentHost.pick', "选择要更新的远程智能体主机") },
			);
			if (!picked) {
				return;
			}
			target = picked.entry;
		}

		await instantiationService.invokeFunction(runServerUpgrade, target.provider, target.method);
	}
});
