/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { assertNever } from '../../../../base/common/assert.js';
import { disposableTimeout } from '../../../../base/common/async.js';
import { parse as parseJsonc } from '../../../../base/common/jsonc.js';
import { mnemonicButtonLabel } from '../../../../base/common/labels.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { autorunSelfDisposable } from '../../../../base/common/observable.js';
import { basename, isEqual } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ConfigurationTarget, IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IMcpRemoteServerConfiguration, IMcpServerConfiguration, IMcpServerVariable, IMcpStdioServerConfiguration, McpServerType } from '../../../../platform/mcp/common/mcpPlatformTypes.js';
import { IAllowedMcpServersService, IGalleryMcpServerConfiguration, RegistryType } from '../../../../platform/mcp/common/mcpManagement.js';
import { IMcpResourceScannerService } from '../../../../platform/mcp/common/mcpResourceScannerService.js';
import { getCopilotGlobalMcpConfigurationError } from '../../../../platform/mcp/common/mcpCopilotGlobalConfiguration.js';
import { McpResourceFormat } from '../../../../platform/mcp/common/mcpWorkspaceConfiguration.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IQuickInputService, IQuickPickItem, QuickPickInput } from '../../../../platform/quickinput/common/quickInput.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { isWorkspaceFolder, IWorkspaceContextService, IWorkspaceFolder, WorkbenchState } from '../../../../platform/workspace/common/workspace.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IWorkbenchLocalMcpServer, IWorkbenchMcpManagementService, WorkspaceMcpConfigKind } from '../../../services/mcp/common/mcpWorkbenchManagementService.js';
import { IUserDataProfileService } from '../../../services/userDataProfile/common/userDataProfile.js';
import { IMcpWorkspaceInstallTargetService } from '../../../services/mcp/common/mcpWorkspaceInstallTargetService.js';
import { IAgentHostCustomizationService } from '../../chat/browser/agentSessions/agentHost/agentHostCustomizationService.js';
import { IChatWidgetService } from '../../chat/browser/chat.js';
import { isAgentHostTarget } from '../../chat/common/chatSessionsService.js';
import { getChatSessionType } from '../../chat/common/model/chatUri.js';
import { McpCommandIds } from '../common/mcpCommandIds.js';
import { allDiscoverySources, ExternalDiscoverySource, mcpDiscoverySection, mcpWorkspaceRootConfig } from '../common/mcpConfiguration.js';
import { getMcpGenerationSchema, McpGeneratedConfiguration, normalizeMcpGeneratedConfiguration } from '../common/mcpConfigurationGeneration.js';
import { IMcpRegistry } from '../common/mcpRegistryTypes.js';
import { IMcpService, McpConnectionState } from '../common/mcpTypes.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IWorkspaceMcpConfigurationTarget, McpConfigurationDestination } from './mcpConfigurationDestination.js';
import { IMcpCopilotGlobalConfigurationService } from '../common/mcpCopilotGlobalConfigurationService.js';

export const enum AddConfigurationType {
	Stdio,
	HTTP,

	NpmPackage,
	PipPackage,
	NuGetPackage,
	DockerImage,
}

type AssistedConfigurationType = AddConfigurationType.NpmPackage | AddConfigurationType.PipPackage | AddConfigurationType.NuGetPackage | AddConfigurationType.DockerImage;

type McpInstallTarget = { kind: 'local'; target: ConfigurationTarget | IWorkspaceFolder } | { kind: 'agentHost'; session: URI };

export const AssistedTypes = {
	[AddConfigurationType.NpmPackage]: {
		title: localize('mcp.npm.title', "输入 NPM 包名"),
		placeholder: localize('mcp.npm.placeholder', "包名（例如 @org/package）"),
		pickLabel: localize('mcp.serverType.npm', "NPM 包"),
		pickDescription: localize('mcp.serverType.npm.description', "从 NPM 包名安装"),
		enabledConfigKey: null, // always enabled
	},
	[AddConfigurationType.PipPackage]: {
		title: localize('mcp.pip.title', "输入 Pip 包名"),
		placeholder: localize('mcp.pip.placeholder', "包名（例如 package-name）"),
		pickLabel: localize('mcp.serverType.pip', "Pip 包"),
		pickDescription: localize('mcp.serverType.pip.description', "从 Pip 包名安装"),
		enabledConfigKey: null, // always enabled
	},
	[AddConfigurationType.NuGetPackage]: {
		title: localize('mcp.nuget.title', "输入 NuGet 包名"),
		placeholder: localize('mcp.nuget.placeholder', "包名（例如 Package.Name）"),
		pickLabel: localize('mcp.serverType.nuget', "NuGet 包"),
		pickDescription: localize('mcp.serverType.nuget.description', "从 NuGet 包名安装"),
		enabledConfigKey: 'chat.mcp.assisted.nuget.enabled',
	},
	[AddConfigurationType.DockerImage]: {
		title: localize('mcp.docker.title', "输入 Docker 镜像名"),
		placeholder: localize('mcp.docker.placeholder', "图像名称(例如 mcp/imagename)"),
		pickLabel: localize('mcp.serverType.docker', "Docker 映像"),
		pickDescription: localize('mcp.serverType.docker.description', "从 Docker 映像安装"),
		enabledConfigKey: null, // always enabled
	},
};

const enum AddConfigurationCopilotCommand {
	/** Returns whether MCP enhanced setup is enabled. */
	IsSupported = 'github.copilot.chat.mcp.setup.check',

	/** Takes an npm/pip package name, validates its owner. */
	ValidatePackage = 'github.copilot.chat.mcp.setup.validatePackage',

	/** Returns the resolved MCP configuration. */
	StartFlow = 'github.copilot.chat.mcp.setup.flow',
}

type ValidatePackageResult =
	{ state: 'ok'; publisher: string; name?: string; version?: string }
	| { state: 'error'; error: string; helpUri?: string; helpUriLabel?: string };

type AddServerData = {
	packageType: string;
};
type AddServerClassification = {
	owner: 'digitarald';
	comment: 'Generic details for adding a new MCP server';
	packageType: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The type of MCP server package' };
};
type AddServerCompletedData = {
	packageType: string;
	serverType: string | undefined;
	target: string;
};
type AddServerCompletedClassification = {
	owner: 'digitarald';
	comment: 'Generic details for successfully adding model-assisted MCP server';
	packageType: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The type of MCP server package' };
	serverType: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The type of MCP server' };
	target: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The target of the MCP server configuration' };
};

type McpSetupDestination = {
	installTarget: McpInstallTarget;
	format: McpResourceFormat;
	workspaceConfig?: WorkspaceMcpConfigKind;
	resource?: URI;
};

export class McpAddConfigurationCommand {
	constructor(
		private readonly configurationTarget: IWorkspaceMcpConfigurationTarget | undefined,
		@IQuickInputService private readonly _quickInputService: IQuickInputService,
		@IWorkbenchMcpManagementService private readonly _mcpManagementService: IWorkbenchMcpManagementService,
		@IWorkspaceContextService private readonly _workspaceService: IWorkspaceContextService,
		@IWorkbenchEnvironmentService private readonly _environmentService: IWorkbenchEnvironmentService,
		@ICommandService private readonly _commandService: ICommandService,
		@IMcpRegistry private readonly _mcpRegistry: IMcpRegistry,
		@IOpenerService private readonly _openerService: IOpenerService,
		@IEditorService private readonly _editorService: IEditorService,
		@IFileService private readonly _fileService: IFileService,
		@INotificationService private readonly _notificationService: INotificationService,
		@ITelemetryService private readonly _telemetryService: ITelemetryService,
		@IMcpService private readonly _mcpService: IMcpService,
		@ILabelService private readonly _label: ILabelService,
		@IUserDataProfileService private readonly _userDataProfileService: IUserDataProfileService,
		@IMcpCopilotGlobalConfigurationService private readonly _copilotGlobalConfigurationService: IMcpCopilotGlobalConfigurationService,
		@IMcpResourceScannerService private readonly _mcpResourceScannerService: IMcpResourceScannerService,
		@IAllowedMcpServersService private readonly _allowedMcpServersService: IAllowedMcpServersService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IAgentHostCustomizationService private readonly _agentHostCustomizations: IAgentHostCustomizationService,
		@IChatWidgetService private readonly _chatWidgetService: IChatWidgetService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IMcpWorkspaceInstallTargetService private readonly _workspaceInstallTargetService: IMcpWorkspaceInstallTargetService,
	) { }

	private async getServerType(): Promise<AddConfigurationType | undefined> {
		type TItem = { kind: AddConfigurationType | 'browse' | 'discovery' } & IQuickPickItem;
		const items: QuickPickInput<TItem>[] = [
			{ kind: AddConfigurationType.Stdio, label: localize('mcp.serverType.command', "命令(stdio)"), description: localize('mcp.serverType.command.description', "运行实现 MCP 协议的本地命令") },
			{ kind: AddConfigurationType.HTTP, label: localize('mcp.serverType.http', "HTTP (HTTP 或服务器发送的事件)"), description: localize('mcp.serverType.http.description', "连接到实现 MCP 协议的远程 HTTP 服务器") }
		];

		let aiSupported: boolean | undefined;
		try {
			aiSupported = await this._commandService.executeCommand<boolean>(AddConfigurationCopilotCommand.IsSupported);
		} catch {
			// ignored
		}

		if (aiSupported) {
			items.unshift({ type: 'separator', label: localize('mcp.serverType.manual', "手动安装") });

			const elligableTypes = Object.entries(AssistedTypes).map(([type, { pickLabel, pickDescription, enabledConfigKey }]) => {
				if (enabledConfigKey) {
					const enabled = this._configurationService.getValue<boolean>(enabledConfigKey) ?? false;
					if (!enabled) {
						return;
					}
				}
				return {
					kind: Number(type) as AddConfigurationType,
					label: pickLabel,
					description: pickDescription,
				};
			}).filter(x => !!x);

			items.push(
				{ type: 'separator', label: localize('mcp.serverType.copilot', "模型辅助") },
				...elligableTypes
			);
		}

		items.push({ type: 'separator' });

		const discovery = this._configurationService.getValue<{ [K in ExternalDiscoverySource]: boolean }>(mcpDiscoverySection);
		if (discovery && typeof discovery === 'object' && allDiscoverySources.some(d => !discovery[d])) {
			items.push({
				kind: 'discovery',
				label: localize('mcp.servers.discovery', "从另一个应用程序添加..."),
			});
		}

		items.push({
			kind: 'browse',
			label: localize('mcp.servers.browse', "浏览 MCP 服务器..."),
		});

		const result = await this._quickInputService.pick<TItem>(items, {
			placeHolder: localize('mcp.serverType.placeholder', "选择要添加的 MCP 服务器类型"),
		});

		if (result?.kind === 'browse') {
			this._commandService.executeCommand(McpCommandIds.Browse);
			return undefined;
		}

		if (result?.kind === 'discovery') {
			this._commandService.executeCommand('workbench.action.openSettings', mcpDiscoverySection);
			return undefined;
		}

		return result?.kind;
	}

	private async getStdioConfig(): Promise<IMcpStdioServerConfiguration | undefined> {
		const command = await this._quickInputService.input({
			title: localize('mcp.command.title', "输入命令"),
			placeHolder: localize('mcp.command.placeholder', "要运行的命令(带有可选参数)"),
			ignoreFocusLost: true,
		});

		if (!command) {
			return undefined;
		}

		this._telemetryService.publicLog2<AddServerData, AddServerClassification>('mcp.addserver', {
			packageType: 'stdio'
		});

		// Split command into command and args, handling quotes
		const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g)!;
		return {
			type: McpServerType.LOCAL,
			command: parts[0].replace(/"/g, ''),

			args: parts.slice(1).map(arg => arg.replace(/"/g, ''))
		};
	}

	private async getSSEConfig(): Promise<IMcpRemoteServerConfiguration | undefined> {
		const url = await this._quickInputService.input({
			title: localize('mcp.url.title', "输入服务器 URL"),
			placeHolder: localize('mcp.url.placeholder', "MCP 服务器的 URL (例如，http://localhost:3000)"),
			ignoreFocusLost: true,
		});

		if (!url) {
			return undefined;
		}

		this._telemetryService.publicLog2<AddServerData, AddServerClassification>('mcp.addserver', {
			packageType: 'sse'
		});

		return { url, type: McpServerType.REMOTE };
	}

	private async getServerId(suggestion = `my-mcp-server-${generateUuid().split('-')[0]}`): Promise<string | undefined> {
		const id = await this._quickInputService.input({
			title: localize('mcp.serverId.title', "输入服务器 ID"),
			placeHolder: localize('mcp.serverId.placeholder', "此服务器的唯一标识符"),
			value: suggestion,
			ignoreFocusLost: true,
		});

		return id;
	}

	private async getInstallTarget(): Promise<McpInstallTarget | undefined> {
		if (this.configurationTarget) {
			return { kind: 'local', target: this.configurationTarget.folder };
		}

		const options: (IQuickPickItem & { target: McpInstallTarget })[] = [];
		const session = this.getCurrentAgentHostSession();
		if (session) {
			options.push({
				target: { kind: 'agentHost', session },
				label: localize('mcp.target.agentHost', "添加到当前智能体会话"),
			});
		}

		options.push({
			target: { kind: 'local', target: ConfigurationTarget.USER_LOCAL },
			label: localize('mcp.target.user', "全局"),
			description: localize('mcp.target.user.description', "在所有工作区中可用，在本地运行"),
		});

		const raLabel = this._environmentService.remoteAuthority && this._label.getHostLabel(Schemas.vscodeRemote, this._environmentService.remoteAuthority);
		if (raLabel) {
			options.push({ target: { kind: 'local', target: ConfigurationTarget.USER_REMOTE }, label: localize('mcp.target.remote', "远程"), description: localize('mcp.target..remote.description', "在此远程计算机上可用，在 {0} 上运行", raLabel) });
		}

		const workbenchState = this._workspaceService.getWorkbenchState();
		const workspaceTargets = this._workspaceInstallTargetService.getTargets();
		const target = workbenchState === WorkbenchState.FOLDER
			? workspaceTargets.find(isWorkspaceFolder)
			: workspaceTargets.find(target => target === ConfigurationTarget.WORKSPACE);
		if (target !== undefined) {
			if (this._environmentService.remoteAuthority) {
				options.push({ target: { kind: 'local', target }, label: localize('mcp.target.workspace', "工作区"), description: localize('mcp.target.workspace.description.remote', "在此工作区中可用，在 {0} 上运行", raLabel) });
			} else {
				options.push({ target: { kind: 'local', target }, label: localize('mcp.target.workspace', "工作区"), description: localize('mcp.target.workspace.description', "在此工作区中可用，在本地运行") });
			}
		}
		if (workbenchState === WorkbenchState.WORKSPACE && this._configurationService.getValue<boolean>(mcpWorkspaceRootConfig)) {
			for (const folder of workspaceTargets.filter(isWorkspaceFolder)) {
				options.push({ target: { kind: 'local', target: folder }, label: localize('mcp.target.workspaceFolderLabel', "工作区（{0}）", folder.name), description: localize('mcp.target.workspaceFolder', "工作区文件夹") });
			}
		}

		if (options.length === 1) {
			return options[0].target;
		}

		const targetPick = await this._quickInputService.pick(options, {
			title: localize('mcp.target.title', "添加 MCP 服务器"),
			placeHolder: localize('mcp.target.placeholder', "选择配置目标")
		});

		return targetPick?.target;
	}

	private getCurrentAgentHostSession(): URI | undefined {
		const focusedSession = this._chatWidgetService.lastFocusedWidget?.viewModel?.sessionResource;
		if (focusedSession && isAgentHostTarget(getChatSessionType(focusedSession))) {
			return focusedSession;
		}

		let session: URI | undefined;
		for (const widget of this._chatWidgetService.getAllWidgets()) {
			const candidate = widget.viewModel?.sessionResource;
			if (!candidate || !isAgentHostTarget(getChatSessionType(candidate))) {
				continue;
			}
			if (session && !isEqual(session, candidate)) {
				return undefined;
			}
			session = candidate;
		}
		return session;
	}

	private async getSetupDestination(): Promise<McpSetupDestination | undefined> {
		const installTarget = await this.getInstallTarget();
		if (!installTarget) {
			return undefined;
		}
		if (installTarget.kind === 'local') {
			if (installTarget.target === ConfigurationTarget.USER_LOCAL) {
				const resource = await this._copilotGlobalConfigurationService.getConfigurationResource();
				if (resource) {
					const selected = await this._quickInputService.pick([
						{ id: 'copilot', label: localize('mcp.target.copilotGlobal', "Copilot Global"), description: this._label.getUriLabel(resource) },
						{ id: 'vscode', label: localize('mcp.target.userConfigurationDeprecated', "用户配置（已弃用）"), description: this._label.getUriLabel(this._userDataProfileService.currentProfile.mcpResource) },
					], {
						title: localize('mcp.target.title', "添加 MCP 服务器"),
						placeHolder: localize('mcp.target.global.placeholder', "选择全局配置"),
					});
					if (!selected) {
						return undefined;
					}
					if (selected.id === 'copilot') {
						return { installTarget, format: McpResourceFormat.CopilotGlobal, resource };
					}
				}
			}
		}
		return { installTarget, format: McpResourceFormat.Vscode };
	}

	private async getAssistedConfig(type: AssistedConfigurationType, format: McpResourceFormat): Promise<McpGeneratedConfiguration | undefined> {
		const packageName = await this._quickInputService.input({
			ignoreFocusLost: true,
			title: AssistedTypes[type].title,
			placeHolder: AssistedTypes[type].placeholder,
		});

		if (!packageName) {
			return undefined;
		}

		const enum LoadAction {
			Retry = 'retry',
			Cancel = 'cancel',
			Allow = 'allow',
			OpenUri = 'openUri',
		}

		const loadingQuickPickStore = new DisposableStore();
		const loadingQuickPick = loadingQuickPickStore.add(this._quickInputService.createQuickPick<IQuickPickItem & { id: LoadAction; helpUri?: URI }>());
		loadingQuickPick.title = localize('mcp.loading.title', "正在加载包详细信息...");
		loadingQuickPick.busy = true;
		loadingQuickPick.ignoreFocusOut = true;

		const packageType = this.getPackageType(type);

		this._telemetryService.publicLog2<AddServerData, AddServerClassification>('mcp.addserver', {
			packageType: packageType!
		});

		this._commandService.executeCommand<ValidatePackageResult>(
			AddConfigurationCopilotCommand.ValidatePackage,
			{
				type: packageType,
				name: packageName,
				targetFormat: format,
				targetConfig: getMcpGenerationSchema(format),
			}
		).then(result => {
			if (!result || result.state === 'error') {
				loadingQuickPick.title = result?.error || 'Unknown error loading package';

				const items: Array<IQuickPickItem & { id: LoadAction; helpUri?: URI }> = [];

				if (result?.helpUri) {
					items.push({
						id: LoadAction.OpenUri,
						label: result.helpUriLabel ?? localize('mcp.error.openHelpUri', "打开帮助 URL"),
						helpUri: URI.parse(result.helpUri),
					});
				}

				items.push(
					{ id: LoadAction.Retry, label: localize('mcp.error.retry', "尝试其他包") },
					{ id: LoadAction.Cancel, label: localize('cancel', "取消") },
				);

				loadingQuickPick.items = items;
			} else {
				loadingQuickPick.title = localize(
					'mcp.confirmPublish', "是否从 {2} 安装 {0}{1}?",
					result.name ?? packageName,
					result.version ? `@${result.version}` : '',
					result.publisher);
				loadingQuickPick.items = [
					{ id: LoadAction.Allow, label: localize('allow', "允许") },
					{ id: LoadAction.Cancel, label: localize('cancel', "取消") }
				];
			}
			loadingQuickPick.busy = false;
		}, () => {
			loadingQuickPick.title = localize('mcp.package.loadFailed', "Unable to load MCP package details. Try again.");
			loadingQuickPick.items = [{ id: LoadAction.Retry, label: localize('mcp.error.retry', "尝试其他包") }, { id: LoadAction.Cancel, label: localize('cancel', "取消") }];
			loadingQuickPick.busy = false;
		});

		const loadingAction = await new Promise<{ id: LoadAction; helpUri?: URI } | undefined>(resolve => {
			loadingQuickPickStore.add(loadingQuickPick.onDidAccept(() => resolve(loadingQuickPick.selectedItems[0])));
			loadingQuickPickStore.add(loadingQuickPick.onDidHide(() => resolve(undefined)));
			loadingQuickPick.show();
		}).finally(() => loadingQuickPickStore.dispose());

		switch (loadingAction?.id) {
			case LoadAction.Retry:
				return this.getAssistedConfig(type, format);
			case LoadAction.OpenUri:
				if (loadingAction.helpUri) { this._openerService.open(loadingAction.helpUri); }
				return undefined;
			case LoadAction.Allow:
				break;
			case LoadAction.Cancel:
			default:
				return undefined;
		}

		const config = await this._commandService.executeCommand<McpGeneratedConfiguration | undefined>(
			AddConfigurationCopilotCommand.StartFlow,
			{
				name: packageName,
				type: packageType
			}
		);

		return config;
	}

	/** Shows the location of a server config once it's discovered. */
	private showOnceDiscovered(installed: IWorkbenchLocalMcpServer) {
		const store = new DisposableStore();
		store.add(disposableTimeout(() => store.dispose(), 5000));
		const observer = autorunSelfDisposable(reader => {
			const servers = this._mcpService.servers.read(reader);
			const server = servers.find(s => s.definition.id === installed.id);

			if (server) {
				const collection = this._mcpRegistry.collections.read(reader).find(collection => collection.id === server.collection.id);
				const definition = collection?.serverDefinitions.read(reader).find(definition => definition.id === installed.id);
				this._editorService.openEditor({
					resource: installed.mcpResource,
					options: {
						selection: definition?.presentation?.origin?.range,
						preserveFocus: true,
					}
				});

				server.start({ promptType: 'all-untrusted' }).then(state => {
					if (state.state === McpConnectionState.Kind.Error) {
						server.showOutput();
					}
				});

				reader.dispose();
				store.dispose();
			}
		});
		if (!store.isDisposed) {
			store.add(observer);
		}
	}

	public async run(): Promise<void> {
		// Step 1: Choose server type
		const serverType = await this.getServerType();
		if (serverType === undefined) {
			return;
		}

		// Step 2: Get server details based on type
		let config: IMcpServerConfiguration | undefined;
		let suggestedName: string | undefined;
		let inputs: IMcpServerVariable[] | undefined;
		let inputValues: Record<string, string> | undefined;
		let destination: McpSetupDestination | undefined;
		switch (serverType) {
			case AddConfigurationType.Stdio:
				config = await this.getStdioConfig();
				break;
			case AddConfigurationType.HTTP:
				config = await this.getSSEConfig();
				break;
			case AddConfigurationType.NpmPackage:
			case AddConfigurationType.PipPackage:
			case AddConfigurationType.NuGetPackage:
			case AddConfigurationType.DockerImage: {
				destination = await this.getSetupDestination();
				if (!destination) {
					return;
				}
				const installTarget = destination.installTarget;
				if (installTarget.kind === 'local' && isWorkspaceFolder(installTarget.target)) {
					const workspaceConfig = await this._instantiationService.createInstance(McpConfigurationDestination).selectForAdd(installTarget.target, undefined, this.configurationTarget?.kind);
					if (workspaceConfig === undefined) {
						return;
					}
					destination.workspaceConfig = workspaceConfig;
					destination.format = workspaceConfig === WorkspaceMcpConfigKind.Root ? McpResourceFormat.WorkspaceRoot : McpResourceFormat.Vscode;
				}
				const r = await this.getAssistedConfig(serverType, destination.format);
				config = r ? normalizeMcpGeneratedConfiguration(r, destination.format) : undefined;
				suggestedName = r?.name;
				inputs = r?.inputs;
				inputValues = r?.inputValues;
				break;
			}
			default:
				assertNever(serverType);
		}

		if (!config) {
			return;
		}

		// Step 3: Get server ID
		const name = await this.getServerId(suggestedName);
		if (!name) {
			return;
		}

		// Step 4: Choose configuration target
		destination ??= await this.getSetupDestination();
		if (!destination) {
			return;
		}
		const { installTarget } = destination;

		if (installTarget.kind === 'agentHost') {
			if (Object.hasOwn(AssistedTypes, serverType) && (inputs?.length || JSON.stringify(config).includes('${input:'))) {
				throw new Error(localize('mcp.agentHost.inputsUnsupported', "This server requires Olympia IDE input variables. Add it to a Olympia IDE configuration file instead of the current agent session."));
			}
			this._agentHostCustomizations.addMcpServer(installTarget.session, name, config);
			return;
		}

		const { target } = installTarget;
		const installable = { name, config, inputs };
		if (destination.format === McpResourceFormat.CopilotGlobal && destination.resource) {
			const resource = destination.resource;
			const error = getCopilotGlobalMcpConfigurationError(installable);
			if (error) {
				if (!Object.hasOwn(AssistedTypes, serverType)) {
					throw new Error(error);
				}
				const fallback = await this._quickInputService.pick([{
					label: localize('mcp.target.userConfigurationDeprecated', "用户配置（已弃用）"),
					detail: error,
				}], { placeHolder: localize('mcp.target.vscodeRequired', "This server requires Olympia IDE configuration"), ignoreFocusLost: true });
				if (!fallback) {
					return;
				}
			} else {
				const allowed = this._allowedMcpServersService.isAllowed(installable);
				if (allowed !== true) {
					throw new Error(allowed.value);
				}
				await this._mcpResourceScannerService.addMcpServers([installable], resource, undefined, McpResourceFormat.CopilotGlobal);
				await this._editorService.openEditor({ resource });
				this._notificationService.info(localize('mcp.copilotGlobal.added', "Added MCP server '{0}' to {1}. Set any referenced environment variables on the agent-host machine before starting a new Copilot session. Olympia IDE input variables are not supported in this file.", name, this._label.getUriLabel(resource)));
				return;
			}
		}
		const workspaceConfig = isWorkspaceFolder(target)
			? destination.workspaceConfig === undefined
				? await this._instantiationService.createInstance(McpConfigurationDestination).selectForAdd(target, installable, this.configurationTarget?.kind)
				: await this._instantiationService.createInstance(McpConfigurationDestination).checkGenerated(target, installable, destination.workspaceConfig, !!this.configurationTarget)
			: undefined;
		if (isWorkspaceFolder(target) && workspaceConfig === undefined) {
			return;
		}
		const installed = await this._mcpManagementService.install(installable, { target, workspaceConfig });

		if (inputValues) {
			for (const [key, value] of Object.entries(inputValues)) {
				await this._mcpRegistry.setSavedInput(key, (isWorkspaceFolder(target) ? ConfigurationTarget.WORKSPACE_FOLDER : target) ?? ConfigurationTarget.WORKSPACE, value);
			}
		}

		const packageType = this.getPackageType(serverType);
		if (packageType) {
			this._telemetryService.publicLog2<AddServerCompletedData, AddServerCompletedClassification>('mcp.addserver.completed', {
				packageType,
				serverType: config.type,
				target: target === ConfigurationTarget.WORKSPACE ? 'workspace' : 'user'
			});
		}

		this.showOnceDiscovered(installed);
	}

	public async pickForUrlHandler(resource: URI, showIsPrimary = false): Promise<void> {
		const name = decodeURIComponent(basename(resource)).replace(/\.json$/, '');
		const placeHolder = localize('install.title', "安装 MCP 服务器 {0}", name);

		const items: IQuickPickItem[] = [
			{ id: 'install', label: localize('install.start', "安装服务器") },
			{ id: 'show', label: localize('install.show', "显示配置", name) },
			{ id: 'rename', label: localize('install.rename', "重命名“{0}”", name) },
			{ id: 'cancel', label: localize('cancel', "取消") },
		];
		if (showIsPrimary) {
			[items[0], items[1]] = [items[1], items[0]];
		}

		const pick = await this._quickInputService.pick(items, { placeHolder, ignoreFocusLost: true });
		const getEditors = () => this._editorService.findEditors(resource);

		switch (pick?.id) {
			case 'show':
				await this._editorService.openEditor({ resource });
				break;
			case 'install':
				await this._editorService.save(getEditors());
				try {
					const contents = await this._fileService.readFile(resource);
					const { inputs, ...config }: IMcpServerConfiguration & { inputs?: IMcpServerVariable[] } = parseJsonc(contents.value.toString());
					const installed = await this._mcpManagementService.install({ name, config, inputs });
					this._editorService.closeEditors(getEditors());
					this.showOnceDiscovered(installed);
				} catch (e) {
					this._notificationService.error(localize('install.error', "安装 MCP 服务器 {0} 时出错: {1}", name, e.message));
					await this._editorService.openEditor({ resource });
				}
				break;
			case 'rename': {
				const newName = await this._quickInputService.input({ placeHolder: localize('install.newName', "输入新名称"), value: name });
				if (newName) {
					const newURI = resource.with({ path: `/${encodeURIComponent(newName)}.json` });
					await this._editorService.save(getEditors());
					await this._fileService.move(resource, newURI);
					return this.pickForUrlHandler(newURI, showIsPrimary);
				}
				break;
			}
		}
	}

	private getPackageType(serverType: AddConfigurationType): string | undefined {
		switch (serverType) {
			case AddConfigurationType.NpmPackage:
				return 'npm';
			case AddConfigurationType.PipPackage:
				return 'pip';
			case AddConfigurationType.NuGetPackage:
				return 'nuget';
			case AddConfigurationType.DockerImage:
				return 'docker';
			case AddConfigurationType.Stdio:
				return 'stdio';
			case AddConfigurationType.HTTP:
				return 'sse';
			default:
				return undefined;
		}
	}
}

export class McpInstallFromManifestCommand {
	constructor(
		@IFileDialogService private readonly _fileDialogService: IFileDialogService,
		@IFileService private readonly _fileService: IFileService,
		@IQuickInputService private readonly _quickInputService: IQuickInputService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IWorkbenchMcpManagementService private readonly _mcpManagementService: IWorkbenchMcpManagementService,
		@ILogService private readonly _logService: ILogService,
	) { }

	async run(): Promise<void> {
		// Step 1: Open file dialog to select the manifest file
		const result = await this._fileDialogService.showOpenDialog({
			title: localize('mcp.installFromManifest.title', "选择 MCP 服务器清单"),
			filters: [{ name: localize('mcp.installFromManifest.filter', "MCP 清单"), extensions: ['json'] }],
			canSelectFiles: true,
			canSelectMany: false,
			openLabel: mnemonicButtonLabel(localize({ key: 'mcp.installFromManifest.openLabel', comment: ['&& denotes a mnemonic'] }, "安装(&&I)"))
		});

		if (!result?.[0]) {
			return;
		}

		const manifestUri = result[0];

		// Step 2: Read and parse the manifest file
		let manifest: unknown;
		try {
			const contents = await this._fileService.readFile(manifestUri);
			manifest = parseJsonc(contents.value.toString());
		} catch (e) {
			this._notificationService.error(localize('mcp.installFromManifest.readError', "清单文件读取失败: {0}", e.message));
			return;
		}

		if (!manifest || typeof manifest !== 'object') {
			this._notificationService.error(localize('mcp.installFromManifest.invalidJson', "清单文件无效: 应为 JSON 对象"));
			return;
		}

		// Step 3: Validate and extract configuration from gallery manifest
		const galleryManifest = manifest as IGalleryMcpServerConfiguration & { name?: string };

		// Determine package type from manifest
		let packageType: RegistryType;
		if (Array.isArray(galleryManifest.packages) && galleryManifest.packages.length > 0) {
			packageType = galleryManifest.packages[0].registryType;
		} else if (Array.isArray(galleryManifest.remotes) && galleryManifest.remotes.length > 0) {
			packageType = RegistryType.REMOTE;
		} else {
			this._notificationService.error(localize('mcp.installFromManifest.invalidManifest', "清单无效: 应为包含至少一个条目的 \"packages\" 或 \"remotes\""));
			return;
		}

		let config: IMcpServerConfiguration;
		let inputs: IMcpServerVariable[] | undefined;
		try {
			const { mcpServerConfiguration, notices } = this._mcpManagementService.getMcpServerConfigurationFromManifest(galleryManifest, packageType);
			config = mcpServerConfiguration.config;
			inputs = mcpServerConfiguration.inputs;

			if (notices.length > 0) {
				this._logService.warn(`MCP Management Service: Warnings while installing the MCP server from ${manifestUri.path}`, notices);
			}
		} catch (e) {
			this._notificationService.error(localize('mcp.installFromManifest.parseError', "分析清单失败: {0}", e.message));
			return;
		}

		// Step 4: Get server name from manifest or prompt user
		let name = galleryManifest.name;
		if (!name) {
			name = await this._quickInputService.input({
				title: localize('mcp.installFromManifest.serverId.title', "输入服务器 ID"),
				placeHolder: localize('mcp.installFromManifest.serverId.placeholder', "此服务器的唯一标识符"),
				value: basename(manifestUri).replace(/\.json$/i, ''),
				ignoreFocusLost: true,
			});

			if (!name) {
				return;
			}
		}

		// Step 5: Install to user settings
		try {
			await this._mcpManagementService.install({ name, config, inputs });
			this._notificationService.info(localize('mcp.installFromManifest.success', "MCP 服务器“{0}”安装成功", name));
		} catch (e) {
			this._notificationService.error(localize('mcp.installFromManifest.installError', "未能安装 MCP 服务器: {0}", e.message));
		}
	}
}
