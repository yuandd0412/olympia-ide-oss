/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { toAction } from '../../../../base/common/actions.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { ITunnelApplicationConfig } from '../../../../base/common/product.js';
import { joinPath } from '../../../../base/common/resources.js';
import { isNumber, isObject, isString } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ConfigurationTarget, IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { Extensions as ConfigurationExtensions, ConfigurationScope, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ContextKeyExpr, IContextKey, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { INativeEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogger, ILoggerService } from '../../../../platform/log/common/log.js';
import { INotificationService, NotificationPriority, Severity } from '../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IProgress, IProgressService, IProgressStep, ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { IQuickInputService, IQuickPickItem, IQuickPickSeparator, QuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { CONFIGURATION_KEY_HOST_NAME, CONFIGURATION_KEY_PREFIX, CONFIGURATION_KEY_PREVENT_SLEEP, ConnectionInfo, INACTIVE_TUNNEL_MODE, IRemoteTunnelService, IRemoteTunnelSession, LOGGER_NAME, LOG_ID, MAX_TUNNEL_NAME_LENGTH, TunnelStatus } from '../../../../platform/remoteTunnel/common/remoteTunnel.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IWorkspaceContextService, isUntitledWorkspace } from '../../../../platform/workspace/common/workspace.js';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { AuthenticationSession, IAuthenticationService } from '../../../services/authentication/common/authentication.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IOutputService } from '../../../services/output/common/output.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';

export const REMOTE_TUNNEL_CATEGORY = localize2('remoteTunnel.category', "远程隧道");

type CONTEXT_KEY_STATES = 'connected' | 'connecting' | 'disconnected';

export const REMOTE_TUNNEL_CONNECTION_STATE_KEY = 'remoteTunnelConnection';
export const REMOTE_TUNNEL_CONNECTION_STATE = new RawContextKey<CONTEXT_KEY_STATES>(REMOTE_TUNNEL_CONNECTION_STATE_KEY, 'disconnected');
const REMOTE_TUNNEL_HAS_LINK = new RawContextKey<boolean>('remoteTunnelHasLink', false);

const REMOTE_TUNNEL_USED_STORAGE_KEY = 'remoteTunnelServiceUsed';
const REMOTE_TUNNEL_PROMPTED_PREVIEW_STORAGE_KEY = 'remoteTunnelServicePromptedPreview';
const REMOTE_TUNNEL_EXTENSION_RECOMMENDED_KEY = 'remoteTunnelExtensionRecommended';
const REMOTE_TUNNEL_HAS_USED_BEFORE = 'remoteTunnelHasUsed';
const REMOTE_TUNNEL_EXTENSION_TIMEOUT = 4 * 60 * 1000; // show the recommendation that a machine started using tunnels if it joined less than 4 minutes ago

const INVALID_TOKEN_RETRIES = 2;

interface UsedOnHostMessage { hostName: string; timeStamp: number }

type ExistingSessionItem = { session: AuthenticationSession; providerId: string; label: string; description: string };
type IAuthenticationProvider = { id: string; scopes: string[] };
type AuthenticationProviderOption = IQuickPickItem & { provider: IAuthenticationProvider };

export interface IRemoteTunnelStartOptions {
	readonly authenticationProviderId?: 'github';
	readonly showServiceOption?: boolean;
	readonly showSuccessNotification?: boolean;
}

/** Matches `is_valid_name` in the CLI's `cli/src/tunnels/dev_tunnels.rs`. */
const TUNNEL_NAME_REGEX = /^[\w-]+$/;

export const RemoteTunnelCommandIds = {
	turnOn: 'workbench.remoteTunnel.actions.turnOn',
	turnOff: 'workbench.remoteTunnel.actions.turnOff',
	connecting: 'workbench.remoteTunnel.actions.connecting',
	manage: 'workbench.remoteTunnel.actions.manage',
	showLog: 'workbench.remoteTunnel.actions.showLog',
	configure: 'workbench.remoteTunnel.actions.configure',
	rename: 'workbench.remoteTunnel.actions.rename',
	copyToClipboard: 'workbench.remoteTunnel.actions.copyToClipboard',
	learnMore: 'workbench.remoteTunnel.actions.learnMore',
} as const;

// name shown in nofications
namespace RemoteTunnelCommandLabels {
	export const turnOn = localize('remoteTunnel.actions.turnOn', "打开远程隧道访问...");
	export const turnOff = localize('remoteTunnel.actions.turnOff', "关闭远程隧道访问...");
	export const showLog = localize('remoteTunnel.actions.showLog', "显示远程隧道服务日志");
	export const configure = localize('remoteTunnel.actions.configure', "配置隧道名称...");
	export const copyToClipboard = localize('remoteTunnel.actions.copyToClipboard', "将浏览器 URI 复制到剪贴板");
	export const learnMore = localize('remoteTunnel.actions.learnMore', "Tunnel 入门");
}

export async function promptToRenameRemoteTunnel(
	quickInputService: IQuickInputService,
	configurationService: IConfigurationService,
	currentName: string | undefined,
): Promise<void> {
	const name = await quickInputService.input({
		title: localize('renameTunnel.title', "Rename Tunnel"),
		prompt: localize('renameTunnel.prompt', "Enter a name for this tunnel."),
		value: currentName,
		placeHolder: localize('renameTunnel.placeholder', "Leave blank to use this machine's host name."),
		validateInput: async input => {
			if (input.length === 0) {
				return undefined;
			}
			if (input.length > MAX_TUNNEL_NAME_LENGTH) {
				return localize('renameTunnel.maxLength', "The name must not be longer than {0} characters.", MAX_TUNNEL_NAME_LENGTH);
			}
			if (!TUNNEL_NAME_REGEX.test(input) || input.startsWith('-')) {
				return localize('renameTunnel.invalidName', "名称只能由字母、数字、下划线和短划线组成。不得以短划线开头。");
			}
			return undefined;
		},
	});

	if (name !== undefined) {
		await configurationService.updateValue(CONFIGURATION_KEY_HOST_NAME, name || undefined, ConfigurationTarget.USER);
	}
}


export class RemoteTunnelWorkbenchContribution extends Disposable implements IWorkbenchContribution {

	private readonly connectionStateContext: IContextKey<CONTEXT_KEY_STATES>;
	private readonly hasLinkContext: IContextKey<boolean>;

	private readonly serverConfiguration: ITunnelApplicationConfig;

	private connectionInfo: ConnectionInfo | undefined;

	private readonly logger: ILogger;

	private expiredSessions: Set<string> = new Set();

	constructor(
		@IAuthenticationService private readonly authenticationService: IAuthenticationService,
		@IDialogService private readonly dialogService: IDialogService,
		@IExtensionService private readonly extensionService: IExtensionService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IProductService productService: IProductService,
		@IStorageService private readonly storageService: IStorageService,
		@ILoggerService loggerService: ILoggerService,
		@IQuickInputService private readonly quickInputService: IQuickInputService,
		@INativeEnvironmentService private environmentService: INativeEnvironmentService,
		@IRemoteTunnelService private remoteTunnelService: IRemoteTunnelService,
		@ICommandService private commandService: ICommandService,
		@IWorkspaceContextService private workspaceContextService: IWorkspaceContextService,
		@IProgressService private progressService: IProgressService,
		@INotificationService private notificationService: INotificationService
	) {
		super();

		this.logger = this._register(loggerService.createLogger(joinPath(environmentService.logsHome, `${LOG_ID}.log`), { id: LOG_ID, name: LOGGER_NAME }));

		this.connectionStateContext = REMOTE_TUNNEL_CONNECTION_STATE.bindTo(this.contextKeyService);
		this.hasLinkContext = REMOTE_TUNNEL_HAS_LINK.bindTo(this.contextKeyService);

		const serverConfiguration = productService.tunnelApplicationConfig;
		if (!serverConfiguration || !productService.tunnelApplicationName) {
			// Olympia deliberately ships without remote tunneling: the feature is backed by a
			// Microsoft cloud service and requires tunnelApplicationConfig credentials we do not
			// have and must not forge. This is the expected "not available" state, not a failure,
			// so it is logged at info level -- an [error] on every start would mask real errors.
			this.logger.info('Remote tunneling is not configured in product.json; the feature stays disabled.');
			this.serverConfiguration = { authenticationProviders: {}, editorWebUrl: '', extension: { extensionId: '', friendlyName: '' } };
			return;
		}
		this.serverConfiguration = serverConfiguration;

		this._register(this.remoteTunnelService.onDidChangeTunnelStatus(s => this.handleTunnelStatusUpdate(s)));

		this.registerCommands();

		this.initialize();

		this.recommendRemoteExtensionIfNeeded();
	}

	private handleTunnelStatusUpdate(status: TunnelStatus) {
		this.connectionInfo = undefined;
		this.hasLinkContext.set(false);
		if (status.type === 'disconnected') {
			if (status.onTokenFailed) {
				this.expiredSessions.add(status.onTokenFailed.sessionId);
			}
			this.connectionStateContext.set('disconnected');
		} else if (status.type === 'connecting') {
			this.connectionStateContext.set('connecting');
		} else if (status.type === 'connected') {
			this.connectionInfo = status.info;
			this.hasLinkContext.set(!!status.info.link);
			this.connectionStateContext.set('connected');
		}
	}

	private async recommendRemoteExtensionIfNeeded() {
		await this.extensionService.whenInstalledExtensionsRegistered();

		const remoteExtension = this.serverConfiguration.extension;
		const shouldRecommend = async () => {
			if (this.storageService.getBoolean(REMOTE_TUNNEL_EXTENSION_RECOMMENDED_KEY, StorageScope.APPLICATION)) {
				return false;
			}
			if (await this.extensionService.getExtension(remoteExtension.extensionId)) {
				return false;
			}
			const usedOnHostMessage = this.storageService.get(REMOTE_TUNNEL_USED_STORAGE_KEY, StorageScope.APPLICATION);
			if (!usedOnHostMessage) {
				return false;
			}
			let usedTunnelName: string | undefined;
			try {
				const message = JSON.parse(usedOnHostMessage);
				if (!isObject(message)) {
					return false;
				}
				const { hostName, timeStamp } = message as UsedOnHostMessage;
				if (!isString(hostName)! || !isNumber(timeStamp) || new Date().getTime() > timeStamp + REMOTE_TUNNEL_EXTENSION_TIMEOUT) {
					return false;
				}
				usedTunnelName = hostName;
			} catch (_) {
				// problems parsing the message, likly the old message format
				return false;
			}
			const currentTunnelName = await this.remoteTunnelService.getTunnelName();
			if (!currentTunnelName || currentTunnelName === usedTunnelName) {
				return false;
			}
			return usedTunnelName;
		};
		const recommed = async () => {
			const usedOnHost = await shouldRecommend();
			if (!usedOnHost) {
				return false;
			}
			this.notificationService.notify({
				severity: Severity.Info,
				priority: NotificationPriority.OPTIONAL,
				message:
					localize(
						{
							key: 'recommend.remoteExtension',
							comment: ['{0} will be a tunnel name, {1} will the link address to the web UI, {6} an extension name. [label](command:commandId) is a markdown link. Only translate the label, do not modify the format']
						},
						"隧道 \"{0}\" 可用于远程访问。{1} 扩展可用于连接到该隧道。",
						usedOnHost, remoteExtension.friendlyName
					),
				actions: {
					primary: [
						toAction({
							id: 'showExtension', label: localize('action.showExtension', "显示扩展"), run: () => {
								return this.commandService.executeCommand('workbench.extensions.action.showExtensionsWithIds', [remoteExtension.extensionId]);
							}
						}),
						toAction({
							id: 'doNotShowAgain', label: localize('action.doNotShowAgain', "不再显示"), run: () => {
								this.storageService.store(REMOTE_TUNNEL_EXTENSION_RECOMMENDED_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
							}
						}),
					]
				}
			});
			return true;
		};
		if (await shouldRecommend()) {
			const disposables = this._register(new DisposableStore());
			disposables.add(this.storageService.onDidChangeValue(StorageScope.APPLICATION, REMOTE_TUNNEL_USED_STORAGE_KEY, disposables)(async () => {
				const success = await recommed();
				if (success) {
					disposables.dispose();
				}
			}));
		}
	}

	private async initialize(): Promise<void> {
		const [mode, status] = await Promise.all([
			this.remoteTunnelService.getMode(),
			this.remoteTunnelService.getTunnelStatus(),
		]);

		this.handleTunnelStatusUpdate(status);

		if (mode.active && mode.session.token) {
			return; // already initialized, token available
		}

		const doInitialStateDiscovery = async (progress?: IProgress<IProgressStep>) => {
			const listener = progress && this.remoteTunnelService.onDidChangeTunnelStatus(status => {
				switch (status.type) {
					case 'connecting':
						if (status.progress) {
							progress.report({ message: status.progress });
						}
						break;
				}
			});
			let newSession: IRemoteTunnelSession | undefined;
			if (mode.active) {
				const token = await this.getSessionToken(mode.session);
				if (token) {
					newSession = { ...mode.session, token };
				}
			}
			const status = await this.remoteTunnelService.initialize(mode.active && newSession ? { ...mode, session: newSession } : INACTIVE_TUNNEL_MODE);
			listener?.dispose();

			if (status.type === 'connected') {
				this.connectionInfo = status.info;
				this.connectionStateContext.set('connected');
				return;
			}
		};


		const hasUsed = this.storageService.getBoolean(REMOTE_TUNNEL_HAS_USED_BEFORE, StorageScope.APPLICATION, false);

		if (hasUsed) {
			await this.progressService.withProgress(
				{
					location: ProgressLocation.Window,
					title: localize({ key: 'initialize.progress.title', comment: ['Only translate \'Looking for remote tunnel\', do not change the format of the rest (markdown link format)'] }, "[正在查找远程隧道](command:{0})", RemoteTunnelCommandIds.showLog),
				},
				doInitialStateDiscovery
			);
		} else {
			doInitialStateDiscovery(undefined);
		}
	}

	private getPreferredTokenFromSession(session: ExistingSessionItem) {
		return session.session.accessToken || session.session.idToken;
	}

	private async startTunnel(asService: boolean, authenticationProviderId?: 'github'): Promise<ConnectionInfo | undefined> {
		if (this.connectionInfo) {
			return this.connectionInfo;
		}

		this.storageService.store(REMOTE_TUNNEL_HAS_USED_BEFORE, true, StorageScope.APPLICATION, StorageTarget.MACHINE);

		let tokenProblems = false;
		for (let i = 0; i < INVALID_TOKEN_RETRIES; i++) {
			tokenProblems = false;

			const authenticationSession = await this.getAuthenticationSession(authenticationProviderId);
			if (authenticationSession === undefined) {
				this.logger.info('No authentication session available, not starting tunnel');
				return undefined;
			}

			const result = await this.progressService.withProgress(
				{
					location: ProgressLocation.Notification,
					title: localize({ key: 'startTunnel.progress.title', comment: ['Only translate \'Starting remote tunnel\', do not change the format of the rest (markdown link format)'] }, "[正在启动远程隧道](command:{0})", RemoteTunnelCommandIds.showLog),
				},
				(progress: IProgress<IProgressStep>) => {
					return new Promise<ConnectionInfo | undefined>((s, e) => {
						let completed = false;
						const listener = this.remoteTunnelService.onDidChangeTunnelStatus(status => {
							switch (status.type) {
								case 'connecting':
									if (status.progress) {
										progress.report({ message: status.progress });
									}
									break;
								case 'connected':
									listener.dispose();
									completed = true;
									s(status.info);
									if (status.serviceInstallFailed) {
										this.notificationService.notify({
											severity: Severity.Warning,
											message: localize(
												{
													key: 'remoteTunnel.serviceInstallFailed',
													comment: ['{Locked="](command:{0})"}']
												},
												"作为服务安装失败，我们已回退到运行此会话的隧道。有关详细信息，请参阅 [error log](command:{0})。",
												RemoteTunnelCommandIds.showLog,
											),
										});
									}
									break;
								case 'disconnected':
									listener.dispose();
									completed = true;
									tokenProblems = !!status.onTokenFailed;
									s(undefined);
									break;
							}
						});
						const token = this.getPreferredTokenFromSession(authenticationSession);
						const account: IRemoteTunnelSession = { sessionId: authenticationSession.session.id, token, providerId: authenticationSession.providerId, accountLabel: authenticationSession.session.account.label };
						this.remoteTunnelService.startTunnel({ active: true, asService, session: account }).then(status => {
							if (!completed && (status.type === 'connected' || status.type === 'disconnected')) {
								listener.dispose();
								if (status.type === 'connected') {
									s(status.info);
								} else {
									tokenProblems = !!status.onTokenFailed;
									s(undefined);
								}
							}
						});
					});
				}
			);
			if (result || !tokenProblems) {
				return result;
			}
		}
		return undefined;
	}

	private async getAuthenticationSession(authenticationProviderId?: 'github'): Promise<ExistingSessionItem | undefined> {
		if (authenticationProviderId) {
			return this.getAuthenticationSessionForProvider(authenticationProviderId);
		}

		const authenticationProviders = await this.getAuthenticationProviders();
		const sessions = await this.getAllSessions(authenticationProviders);
		const disposables = new DisposableStore();
		const quickpick = disposables.add(this.quickInputService.createQuickPick<ExistingSessionItem | AuthenticationProviderOption | IQuickPickItem>({ useSeparators: true }));
		quickpick.ok = false;
		quickpick.placeholder = localize('accountPreference.placeholder', "登录帐户以启用远程访问");
		quickpick.ignoreFocusOut = true;
		quickpick.items = await this.createQuickpickItems(sessions, authenticationProviders);

		return new Promise((resolve, reject) => {
			disposables.add(quickpick.onDidHide((e) => {
				resolve(undefined);
				disposables.dispose();
			}));

			disposables.add(quickpick.onDidAccept(async (e) => {
				const selection = quickpick.selectedItems[0];
				if ('provider' in selection) {
					const session = await this.authenticationService.createSession(selection.provider.id, selection.provider.scopes);
					resolve(this.createExistingSessionItem(session, selection.provider.id));
				} else if ('session' in selection) {
					resolve(selection);
				} else {
					resolve(undefined);
				}
				quickpick.hide();
			}));

			quickpick.show();
		});
	}

	private async getAuthenticationSessionForProvider(providerId: 'github'): Promise<ExistingSessionItem | undefined> {
		const provider = (await this.getAuthenticationProviders()).find(provider => provider.id === providerId);
		if (!provider) {
			return undefined;
		}

		const session = (await this.getAllSessions([provider]))[0];
		if (session) {
			return session;
		}

		return this.createExistingSessionItem(
			await this.authenticationService.createSession(provider.id, provider.scopes),
			provider.id
		);
	}

	private createExistingSessionItem(session: AuthenticationSession, providerId: string): ExistingSessionItem {
		return {
			label: session.account.label,
			description: this.authenticationService.getProvider(providerId).label,
			session,
			providerId
		};
	}

	private async createQuickpickItems(sessions: ExistingSessionItem[], authenticationProviders: readonly IAuthenticationProvider[]): Promise<(ExistingSessionItem | AuthenticationProviderOption | IQuickPickSeparator | IQuickPickItem & { canceledAuthentication: boolean })[]> {
		const options: (ExistingSessionItem | AuthenticationProviderOption | IQuickPickSeparator | IQuickPickItem & { canceledAuthentication: boolean })[] = [];

		if (sessions.length) {
			options.push({ type: 'separator', label: localize('signed in', "已登录") });
			options.push(...sessions);
			options.push({ type: 'separator', label: localize('others', "其他") });
		}

		for (const authenticationProvider of authenticationProviders) {
			const signedInForProvider = sessions.some(account => account.providerId === authenticationProvider.id);
			const provider = this.authenticationService.getProvider(authenticationProvider.id);
			if (!signedInForProvider || provider.supportsMultipleAccounts) {
				options.push({ label: localize({ key: 'sign in using account', comment: ['{0} will be a auth provider (e.g. Github)'] }, "使用 {0} 登录", provider.label), provider: authenticationProvider });
			}
		}

		return options;
	}

	/**
	 * Returns all authentication sessions available from {@link getAuthenticationProviders}.
	 */
	private async getAllSessions(authenticationProviders?: readonly IAuthenticationProvider[]): Promise<ExistingSessionItem[]> {
		const accounts = new Map<string, ExistingSessionItem>();
		const currentAccount = await this.remoteTunnelService.getMode();
		let currentSession: ExistingSessionItem | undefined;

		for (const provider of authenticationProviders ?? await this.getAuthenticationProviders()) {
			const sessions = await this.authenticationService.getSessions(provider.id, provider.scopes);

			for (const session of sessions) {
				if (!this.expiredSessions.has(session.id)) {
					const item = this.createExistingSessionItem(session, provider.id);
					accounts.set(item.session.account.id, item);
					if (currentAccount.active && currentAccount.session.sessionId === session.id) {
						currentSession = item;
					}
				}
			}
		}

		if (currentSession !== undefined) {
			accounts.set(currentSession.session.account.id, currentSession);
		}

		return [...accounts.values()];
	}

	private async getSessionToken(session: IRemoteTunnelSession | undefined): Promise<string | undefined> {
		if (session) {
			const sessionItem = (await this.getAllSessions()).find(s => s.session.id === session.sessionId);
			if (sessionItem) {
				return this.getPreferredTokenFromSession(sessionItem);
			}
		}
		return undefined;
	}

	/**
	 * Returns all authentication providers which can be used to authenticate
	 * to the remote storage service, based on product.json configuration
	 * and registered authentication providers.
	 */
	private async getAuthenticationProviders(): Promise<IAuthenticationProvider[]> {
		// Get the list of authentication providers configured in product.json
		const authenticationProviders = this.serverConfiguration.authenticationProviders;
		const configuredAuthenticationProviders = Object.keys(authenticationProviders).reduce<IAuthenticationProvider[]>((result, id) => {
			result.push({ id, scopes: authenticationProviders[id].scopes });
			return result;
		}, []);

		// Filter out anything that isn't currently available through the authenticationService
		const availableAuthenticationProviders = this.authenticationService.declaredProviders;

		return configuredAuthenticationProviders.filter(({ id }) => availableAuthenticationProviders.some(provider => provider.id === id));
	}

	private registerCommands() {
		const that = this;

		this._register(registerAction2(class extends Action2 {
			constructor() {
				super({
					id: RemoteTunnelCommandIds.turnOn,
					title: RemoteTunnelCommandLabels.turnOn,
					category: REMOTE_TUNNEL_CATEGORY,
					precondition: ContextKeyExpr.equals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, 'disconnected'),
					menu: [{
						id: MenuId.CommandPalette,
					},
					{
						id: MenuId.AccountsContext,
						group: '2_remoteTunnel',
						when: ContextKeyExpr.equals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, 'disconnected'),
					}]
				});
			}

			async run(accessor: ServicesAccessor, options?: IRemoteTunnelStartOptions) {
				const notificationService = accessor.get(INotificationService);
				const clipboardService = accessor.get(IClipboardService);
				const commandService = accessor.get(ICommandService);
				const storageService = accessor.get(IStorageService);
				const dialogService = accessor.get(IDialogService);
				const quickInputService = accessor.get(IQuickInputService);
				const productService = accessor.get(IProductService);

				const didNotifyPreview = storageService.getBoolean(REMOTE_TUNNEL_PROMPTED_PREVIEW_STORAGE_KEY, StorageScope.APPLICATION, false);
				if (!didNotifyPreview) {
					const { confirmed } = await dialogService.confirm({
						message: localize('tunnel.preview', "远程隧道目前为预览版。请使用“帮助: 报告问题”命令报告任何问题。"),
						primaryButton: localize({ key: 'enable', comment: ['&& denotes a mnemonic'] }, "启用(&&E)")
					});
					if (!confirmed) {
						return;
					}

					storageService.store(REMOTE_TUNNEL_PROMPTED_PREVIEW_STORAGE_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
				}

				const asService = options?.showServiceOption === false
					? false
					: await new Promise<boolean | undefined>(resolve => {
						const disposables = new DisposableStore();
						const quickPick = disposables.add(quickInputService.createQuickPick<IQuickPickItem & { service: boolean }>());
						quickPick.placeholder = localize('tunnel.enable.placeholder', "选择要如何启用访问权限");
						quickPick.items = [
							{ service: false, label: localize('tunnel.enable.session', "启用此会话"), description: localize('tunnel.enable.session.description', "每当打开时 {0} 运行", productService.nameShort) },
							{ service: true, label: localize('tunnel.enable.service', "作为服务安装"), description: localize('tunnel.enable.service.description', "每次登录时运行") }
						];
						disposables.add(quickPick.onDidAccept(() => {
							resolve(quickPick.selectedItems[0]?.service);
							quickPick.hide();
						}));
						disposables.add(quickPick.onDidHide(() => {
							disposables.dispose();
							resolve(undefined);
						}));
						quickPick.show();
					});

				if (asService === undefined) {
					return; // no-op
				}

				const connectionInfo = await that.startTunnel(/* installAsService= */ asService, options?.authenticationProviderId);

				if (connectionInfo) {
					if (options?.showSuccessNotification !== false) {
						const remoteExtension = that.serverConfiguration.extension;
						if (connectionInfo.link && connectionInfo.domain) {
							const linkToOpen = that.getLinkToOpen(connectionInfo.link);
							const linkToOpenForMarkdown = linkToOpen.toString(false).replace(/\)/g, '%29');
							notificationService.notify({
								severity: Severity.Info,
								message:
									localize(
										{
											key: 'progress.turnOn.final',
											comment: ['{0} will be the tunnel name, {1} will the link address to the web UI, {6} an extension name, {7} a link to the extension documentation. [label](command:commandId) is a markdown link. Only translate the label, do not modify the format']
										},
										"现在，可以通过安全隧道 [{0}](command:{4}) 随时随地访问此计算机。要通过其他计算机进行连接，请使用生成的 [{1}]({2})链接，或者在桌面或 Web 中使用 [{6}]({7})扩展。可以通过“Olympia 帐户”菜单 [配置](command:{3}) 或 [关闭](command:{5})此访问权限。",
										connectionInfo.tunnelName, connectionInfo.domain, linkToOpenForMarkdown, RemoteTunnelCommandIds.manage, RemoteTunnelCommandIds.configure, RemoteTunnelCommandIds.turnOff, remoteExtension.friendlyName, 'https://code.visualstudio.com/docs/remote/tunnels'
									),
								actions: {
									primary: [
										toAction({ id: 'copyToClipboard', label: localize('action.copyToClipboard', "将浏览器链接复制到剪贴板"), run: () => clipboardService.writeText(linkToOpen.toString(true)) }),
										toAction({
											id: 'showExtension', label: localize('action.showExtension', "显示扩展"), run: () => {
												return commandService.executeCommand('workbench.extensions.action.showExtensionsWithIds', [remoteExtension.extensionId]);
											}
										})
									]
								}
							});
						} else {
							notificationService.notify({
								severity: Severity.Info,
								message: localize('progress.turnOn.final.noLink', "Remote Tunnel Access is enabled for {0}. You can [configure](command:{1}) or [turn off](command:{2}) this access via the Olympia IDE Accounts menu.", connectionInfo.tunnelName, RemoteTunnelCommandIds.configure, RemoteTunnelCommandIds.turnOff),
							});
						}
					}
					const usedOnHostMessage: UsedOnHostMessage = { hostName: connectionInfo.tunnelName, timeStamp: new Date().getTime() };
					storageService.store(REMOTE_TUNNEL_USED_STORAGE_KEY, JSON.stringify(usedOnHostMessage), StorageScope.APPLICATION, StorageTarget.USER);
				} else {
					notificationService.notify({
						severity: Severity.Info,
						message: localize('progress.turnOn.failed',
							"无法启用远程隧道访问。有关详细信息，请查看远程隧道服务日志。"),
					});
					await commandService.executeCommand(RemoteTunnelCommandIds.showLog);
				}
			}

		}));

		this._register(registerAction2(class extends Action2 {
			constructor() {
				super({
					id: RemoteTunnelCommandIds.manage,
					title: localize('remoteTunnel.actions.manage.on.v2', "远程隧道访问已启用"),
					category: REMOTE_TUNNEL_CATEGORY,
					menu: [{
						id: MenuId.AccountsContext,
						group: '2_remoteTunnel',
						when: ContextKeyExpr.equals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, 'connected'),
					}]
				});
			}

			async run() {
				that.showManageOptions();
			}
		}));

		this._register(registerAction2(class extends Action2 {
			constructor() {
				super({
					id: RemoteTunnelCommandIds.rename,
					title: localize2('remoteTunnel.actions.rename', 'Rename Tunnel'),
					category: REMOTE_TUNNEL_CATEGORY,
					menu: [{
						id: MenuId.CommandPalette,
						when: ContextKeyExpr.notEquals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, ''),
					}]
				});
			}

			async run(accessor: ServicesAccessor) {
				await promptToRenameRemoteTunnel(
					accessor.get(IQuickInputService),
					accessor.get(IConfigurationService),
					that.connectionInfo?.tunnelName ?? await that.remoteTunnelService.getTunnelName(),
				);
			}
		}));

		this._register(registerAction2(class extends Action2 {
			constructor() {
				super({
					id: RemoteTunnelCommandIds.connecting,
					title: localize('remoteTunnel.actions.manage.connecting', "远程隧道访问正在连接"),
					category: REMOTE_TUNNEL_CATEGORY,
					menu: [{
						id: MenuId.AccountsContext,
						group: '2_remoteTunnel',
						when: ContextKeyExpr.equals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, 'connecting'),
					}]
				});
			}

			async run() {
				that.showManageOptions();
			}
		}));


		this._register(registerAction2(class extends Action2 {
			constructor() {
				super({
					id: RemoteTunnelCommandIds.turnOff,
					title: RemoteTunnelCommandLabels.turnOff,
					category: REMOTE_TUNNEL_CATEGORY,
					precondition: ContextKeyExpr.notEquals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, 'disconnected'),
					menu: [{
						id: MenuId.CommandPalette,
						when: ContextKeyExpr.notEquals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, ''),
					}]
				});
			}

			async run() {
				const message =
					that.connectionInfo?.isAttached ?
						localize('remoteTunnel.turnOffAttached.confirm', "是否要关闭远程隧道访问? 这也将停止在外部启动的服务。") :
						localize('remoteTunnel.turnOff.confirm', "是否要关闭远程隧道访问?");

				const { confirmed } = await that.dialogService.confirm({ message });
				if (confirmed) {
					that.remoteTunnelService.stopTunnel();
				}
			}
		}));

		this._register(registerAction2(class extends Action2 {
			constructor() {
				super({
					id: RemoteTunnelCommandIds.showLog,
					title: RemoteTunnelCommandLabels.showLog,
					category: REMOTE_TUNNEL_CATEGORY,
					menu: [{
						id: MenuId.CommandPalette,
						when: ContextKeyExpr.notEquals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, ''),
					}]
				});
			}

			async run(accessor: ServicesAccessor) {
				const outputService = accessor.get(IOutputService);
				outputService.showChannel(LOG_ID);
			}
		}));

		this._register(registerAction2(class extends Action2 {
			constructor() {
				super({
					id: RemoteTunnelCommandIds.configure,
					title: RemoteTunnelCommandLabels.configure,
					category: REMOTE_TUNNEL_CATEGORY,
					menu: [{
						id: MenuId.CommandPalette,
						when: ContextKeyExpr.notEquals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, ''),
					}]
				});
			}

			async run(accessor: ServicesAccessor) {
				const preferencesService = accessor.get(IPreferencesService);
				preferencesService.openSettings({ query: CONFIGURATION_KEY_PREFIX });
			}
		}));

		this._register(registerAction2(class extends Action2 {
			constructor() {
				super({
					id: RemoteTunnelCommandIds.copyToClipboard,
					title: RemoteTunnelCommandLabels.copyToClipboard,
					category: REMOTE_TUNNEL_CATEGORY,
					precondition: ContextKeyExpr.and(
						ContextKeyExpr.equals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, 'connected'),
						REMOTE_TUNNEL_HAS_LINK.isEqualTo(true),
					),
					menu: [{
						id: MenuId.CommandPalette,
						when: ContextKeyExpr.and(
							ContextKeyExpr.equals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, 'connected'),
							REMOTE_TUNNEL_HAS_LINK.isEqualTo(true),
						),
					}]
				});
			}

			async run(accessor: ServicesAccessor) {
				const clipboardService = accessor.get(IClipboardService);
				if (that.connectionInfo?.link) {
					const linkToOpen = that.getLinkToOpen(that.connectionInfo.link);
					clipboardService.writeText(linkToOpen.toString(true));
				}

			}
		}));

		this._register(registerAction2(class extends Action2 {
			constructor() {
				super({
					id: RemoteTunnelCommandIds.learnMore,
					title: RemoteTunnelCommandLabels.learnMore,
					category: REMOTE_TUNNEL_CATEGORY,
					menu: []
				});
			}

			async run(accessor: ServicesAccessor) {
				const openerService = accessor.get(IOpenerService);
				await openerService.open('https://aka.ms/vscode-server-doc');
			}
		}));
	}

	private getLinkToOpen(link: string): URI {
		const workspace = this.workspaceContextService.getWorkspace();
		const folders = workspace.folders;
		let resource;
		if (folders.length === 1) {
			resource = folders[0].uri;
		} else if (workspace.configuration && !isUntitledWorkspace(workspace.configuration, this.environmentService)) {
			resource = workspace.configuration;
		}
		const tunnelLink = URI.parse(link);
		if (resource?.scheme === Schemas.file) {
			return joinPath(tunnelLink, resource.path);
		}
		return joinPath(tunnelLink, this.environmentService.userHome.path);
	}


	private async showManageOptions() {
		const account = await this.remoteTunnelService.getMode();

		return new Promise<void>((c, e) => {
			const disposables = new DisposableStore();
			const quickPick = this.quickInputService.createQuickPick({ useSeparators: true });
			quickPick.placeholder = localize('manage.placeholder', "选择要调用的命令");
			disposables.add(quickPick);
			const items: Array<QuickPickItem> = [];
			items.push({ id: RemoteTunnelCommandIds.learnMore, label: RemoteTunnelCommandLabels.learnMore });
			if (this.connectionInfo) {
				quickPick.title =
					this.connectionInfo.isAttached ?
						localize({ key: 'manage.title.attached', comment: ['{0} is the tunnel name'] }, "已为 {0} 启用远程隧道访问(已在外部启动)", this.connectionInfo.tunnelName) :
						localize({ key: 'manage.title.orunning', comment: ['{0} is the tunnel name'] }, "已为 {0} 启用远程隧道访问", this.connectionInfo.tunnelName);

				if (this.connectionInfo.link && this.connectionInfo.domain) {
					items.push({ id: RemoteTunnelCommandIds.copyToClipboard, label: RemoteTunnelCommandLabels.copyToClipboard, description: this.connectionInfo.domain });
				}
			} else {
				quickPick.title = localize('manage.title.off', "未启用远程隧道访问");
			}
			items.push({ id: RemoteTunnelCommandIds.showLog, label: localize('manage.showLog', "显示日志") });
			items.push({ type: 'separator' });
			items.push({ id: RemoteTunnelCommandIds.configure, label: localize('manage.tunnelName', "更改隧道名称"), description: this.connectionInfo?.tunnelName });
			items.push({ id: RemoteTunnelCommandIds.turnOff, label: RemoteTunnelCommandLabels.turnOff, description: account.active ? `${account.session.accountLabel} (${account.session.providerId})` : undefined });

			quickPick.items = items;
			disposables.add(quickPick.onDidAccept(() => {
				if (quickPick.selectedItems[0] && quickPick.selectedItems[0].id) {
					this.commandService.executeCommand(quickPick.selectedItems[0].id);
				}
				quickPick.hide();
			}));
			disposables.add(quickPick.onDidHide(() => {
				disposables.dispose();
				c();
			}));
			quickPick.show();
		});
	}
}


const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(RemoteTunnelWorkbenchContribution, LifecyclePhase.Restored);

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	type: 'object',
	properties: {
		[CONFIGURATION_KEY_HOST_NAME]: {
			description: localize('remoteTunnelAccess.machineName', "远程隧道访问注册名。如果未设置，则使用主机名。"),
			type: 'string',
			scope: ConfigurationScope.APPLICATION,
			ignoreSync: true,
			pattern: '^(\\w[\\w-]*)?$',
			patternErrorMessage: localize('remoteTunnelAccess.machineNameRegex', "名称只能由字母、数字、下划线和短划线组成。不得以短划线开头。"),
			maxLength: 20,
			default: ''
		},
		[CONFIGURATION_KEY_PREVENT_SLEEP]: {
			description: localize('remoteTunnelAccess.preventSleep', "启用远程隧道访问时，防止计算机进入休眠。"),
			type: 'boolean',
			scope: ConfigurationScope.APPLICATION,
			default: false,
		}
	}
});
