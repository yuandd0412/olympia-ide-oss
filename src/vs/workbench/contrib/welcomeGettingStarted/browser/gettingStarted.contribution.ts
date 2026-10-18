/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { GettingStartedInputSerializer, GettingStartedPage, inWelcomeContext } from './gettingStarted.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../common/editor.js';
import { MenuId, registerAction2, Action2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ContextKeyExpr, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IEditorService, SIDE_GROUP } from '../../../services/editor/common/editorService.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IWalkthroughsService } from './gettingStartedService.js';
import { GettingStartedEditorOptions, GettingStartedInput } from './gettingStartedInput.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { ConfigurationScope, Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { workbenchConfigurationNodeBase } from '../../../common/configuration.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { IRemoteAgentService } from '../../../services/remote/common/remoteAgentService.js';
import { isLinux, isMacintosh, isWindows, OperatingSystem as OS } from '../../../../base/common/platform.js';
import { IExtensionManagementServerService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { StartupPageEditorResolverContribution, StartupPageRunnerContribution } from './startupPage.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { AccessibleViewRegistry } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { GettingStartedAccessibleView } from './gettingStartedAccessibleView.js';
import { AgentSessionsWelcomePage } from '../../welcomeAgentSessions/browser/agentSessionsWelcome.js';
import { IChatEntitlementService } from '../../../services/chat/common/chatEntitlementService.js';

export * as icons from './gettingStartedIcons.js';

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.openWalkthrough',
			title: localize2('miWelcome', "欢迎"),
			category: Categories.Help,
			f1: true,
			menu: {
				id: MenuId.MenubarHelpMenu,
				group: '1_welcome',
				order: 1,
			},
			metadata: {
				description: localize2('minWelcomeDescription', "打开演练，以帮助你开始使用 Olympia。")
			}
		});
	}

	public run(
		accessor: ServicesAccessor,
		walkthroughID: string | { category: string; step: string } | undefined,
		optionsOrToSide: { toSide?: boolean; inactive?: boolean } | boolean | undefined
	) {
		const editorService = accessor.get(IEditorService);
		const commandService = accessor.get(ICommandService);
		const configurationService = accessor.get(IConfigurationService);
		const chatEntitlementService = accessor.get(IChatEntitlementService);

		const toSide = typeof optionsOrToSide === 'object' ? optionsOrToSide.toSide : optionsOrToSide;
		const inactive = typeof optionsOrToSide === 'object' ? optionsOrToSide.inactive : false;
		const activeEditor = editorService.activeEditor;

		// If no specific walkthrough is requested and agent sessions welcome is preferred, open that instead
		if (!walkthroughID && !chatEntitlementService.sentiment.hidden && configurationService.getValue<string>('workbench.startupEditor') === 'agentSessionsWelcomePage') {
			commandService.executeCommand(AgentSessionsWelcomePage.COMMAND_ID);
			return;
		} else {
			if (walkthroughID) {
				const selectedCategory = typeof walkthroughID === 'string' ? walkthroughID : walkthroughID.category;
				let selectedStep: string | undefined;
				if (typeof walkthroughID === 'object' && 'category' in walkthroughID && 'step' in walkthroughID) {
					selectedStep = `${walkthroughID.category}#${walkthroughID.step}`;
				} else {
					selectedStep = undefined;
				}

				// If the walkthrough is already open just reveal the step
				if (selectedStep && activeEditor instanceof GettingStartedInput && activeEditor.selectedCategory === selectedCategory) {
					activeEditor.showWelcome = false;
					commandService.executeCommand('walkthroughs.selectStep', selectedStep);
					return;
				}

				let options: GettingStartedEditorOptions;
				if (selectedCategory) {
					// Otherwise open the walkthrough editor with the selected category and step
					options = { selectedCategory, selectedStep, showWelcome: false, preserveFocus: toSide ?? false, inactive };
				} else {
					// Open Welcome page
					options = { selectedCategory, selectedStep, showWelcome: true, preserveFocus: toSide ?? false, inactive };
				}
				editorService.openEditor({
					resource: GettingStartedInput.RESOURCE,
					options
				}, toSide ? SIDE_GROUP : undefined);

			} else {
				editorService.openEditor({
					resource: GettingStartedInput.RESOURCE,
					options: { preserveFocus: toSide ?? false, inactive }
				}, toSide ? SIDE_GROUP : undefined);
			}
		}
	}
});

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(GettingStartedInput.ID, GettingStartedInputSerializer);
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		GettingStartedPage,
		GettingStartedPage.ID,
		localize('welcome', "欢迎")
	),
	[
		new SyncDescriptor(GettingStartedInput)
	]
);

const category = localize2('welcome', "欢迎");

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'welcome.goBack',
			title: localize2('welcome.goBack', "后退"),
			category,
			keybinding: {
				weight: KeybindingWeight.EditorContrib,
				primary: KeyCode.Escape,
				when: inWelcomeContext
			},
			precondition: ContextKeyExpr.equals('activeEditor', 'gettingStartedPage'),
			f1: true
		});
	}

	run(accessor: ServicesAccessor) {
		const editorService = accessor.get(IEditorService);
		const editorPane = editorService.activeEditorPane;
		if (editorPane instanceof GettingStartedPage) {
			editorPane.escape();
		}
	}
});

CommandsRegistry.registerCommand({
	id: 'walkthroughs.selectStep',
	handler: (accessor, stepID: string) => {
		const editorService = accessor.get(IEditorService);
		const editorPane = editorService.activeEditorPane;
		if (editorPane instanceof GettingStartedPage) {
			editorPane.selectStepLoose(stepID);
		} else {
			console.error('Cannot run walkthroughs.selectStep outside of walkthrough context');
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'welcome.markStepComplete',
			title: localize('welcome.markStepComplete', "标记该步骤为已完成"),
			category,
		});
	}

	run(accessor: ServicesAccessor, arg: string) {
		if (!arg) { return; }
		const gettingStartedService = accessor.get(IWalkthroughsService);
		gettingStartedService.progressStep(arg);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'welcome.markStepIncomplete',
			title: localize('welcome.markStepInomplete', "标记该步骤为未完成"),
			category,
		});
	}

	run(accessor: ServicesAccessor, arg: string) {
		if (!arg) { return; }
		const gettingStartedService = accessor.get(IWalkthroughsService);
		gettingStartedService.deprogressStep(arg);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'welcome.showAllWalkthroughs',
			title: localize2('welcome.showAllWalkthroughs', "打开引导..."),
			category,
			f1: true,
			menu: {
				id: MenuId.MenubarHelpMenu,
				group: '1_welcome',
				order: 3,
			},
		});
	}

	private async getQuickPickItems(
		contextService: IContextKeyService,
		gettingStartedService: IWalkthroughsService
	): Promise<IQuickPickItem[]> {
		const categories = await gettingStartedService.getWalkthroughs();
		return categories
			.filter(c => contextService.contextMatchesRules(c.when))
			.map(x => ({
				id: x.id,
				label: x.title,
				detail: x.description,
				description: x.source,
			}));
	}

	async run(accessor: ServicesAccessor) {
		const commandService = accessor.get(ICommandService);
		const contextService = accessor.get(IContextKeyService);
		const quickInputService = accessor.get(IQuickInputService);
		const gettingStartedService = accessor.get(IWalkthroughsService);
		const extensionService = accessor.get(IExtensionService);

		const disposables = new DisposableStore();
		const quickPick = disposables.add(quickInputService.createQuickPick());
		quickPick.canSelectMany = false;
		quickPick.matchOnDescription = true;
		quickPick.matchOnDetail = true;
		quickPick.placeholder = localize('pickWalkthroughs', "选择要打开的演练");
		quickPick.items = await this.getQuickPickItems(contextService, gettingStartedService);
		quickPick.busy = true;
		disposables.add(quickPick.onDidAccept(() => {
			const selection = quickPick.selectedItems[0];
			if (selection) {
				commandService.executeCommand('workbench.action.openWalkthrough', selection.id);
			}
			quickPick.hide();
		}));
		disposables.add(quickPick.onDidHide(() => disposables.dispose()));
		await extensionService.whenInstalledExtensionsRegistered();
		disposables.add(gettingStartedService.onDidAddWalkthrough(async () => {
			quickPick.items = await this.getQuickPickItems(contextService, gettingStartedService);
		}));
		quickPick.show();
		quickPick.busy = false;
	}
});

CommandsRegistry.registerCommand({
	id: 'welcome.newWorkspaceChat',
	handler: (accessor, stepID: string) => {
		const commandService = accessor.get(ICommandService);
		commandService.executeCommand('workbench.action.chat.open', { mode: 'agent', query: '#new ', isPartialQuery: true });
	}
});

export const WorkspacePlatform = new RawContextKey<'mac' | 'linux' | 'windows' | 'webworker' | undefined>('workspacePlatform', undefined, localize('workspacePlatform', "当前工作区所在的平台；在远程或无服务器环境中，该平台可能与界面所在的平台不同"));
class WorkspacePlatformContribution {

	static readonly ID = 'workbench.contrib.workspacePlatform';

	constructor(
		@IExtensionManagementServerService private readonly extensionManagementServerService: IExtensionManagementServerService,
		@IRemoteAgentService private readonly remoteAgentService: IRemoteAgentService,
		@IContextKeyService private readonly contextService: IContextKeyService,
	) {
		this.remoteAgentService.getEnvironment().then(env => {
			const remoteOS = env?.os;

			const remotePlatform = remoteOS === OS.Macintosh ? 'mac'
				: remoteOS === OS.Windows ? 'windows'
					: remoteOS === OS.Linux ? 'linux'
						: undefined;

			if (remotePlatform) {
				WorkspacePlatform.bindTo(this.contextService).set(remotePlatform);
			} else if (this.extensionManagementServerService.localExtensionManagementServer) {
				if (isMacintosh) {
					WorkspacePlatform.bindTo(this.contextService).set('mac');
				} else if (isLinux) {
					WorkspacePlatform.bindTo(this.contextService).set('linux');
				} else if (isWindows) {
					WorkspacePlatform.bindTo(this.contextService).set('windows');
				}
			} else if (this.extensionManagementServerService.webExtensionManagementServer) {
				WorkspacePlatform.bindTo(this.contextService).set('webworker');
			} else {
				console.error('Error: Unable to detect workspace platform');
			}
		});
	}
}

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
	...workbenchConfigurationNodeBase,
	properties: {
		'workbench.welcomePage.walkthroughs.openOnInstall': {
			scope: ConfigurationScope.MACHINE,
			type: 'boolean',
			default: true,
			description: localize('workbench.welcomePage.walkthroughs.openOnInstall', "启用后，安装该扩展时会自动打开它的引导页面。")
		},
		'workbench.startupEditor': {
			'scope': ConfigurationScope.RESOURCE,
			'type': 'string',
			'enum': ['none', 'welcomePage', 'readme', 'newUntitledFile', 'welcomePageInEmptyWorkbench', 'terminal', 'agentSessionsWelcomePage'],
			'enumDescriptions': [
				localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.none' }, "在启动时不打开编辑器。"),
				localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.welcomePage' }, "打开包含帮助开始使用 Olympia 和扩展内容的欢迎页面。"),
				localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.readme' }, "当打开包含自述文件的文件夹时，请打开自述文件，否则会回退到 'welcomePage'。请注意: 仅在作为全局 配置时才遵守此操作，如果在工作区或文件夹配置中进行设置，则此将被忽略。"),
				localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.newUntitledFile' }, "打开新的无标题文本文件(仅在打开空窗口时适用)。"),
				localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.welcomePageInEmptyWorkbench' }, "在打开空工作区时打开欢迎页面。"),
				localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.terminal' }, "在编辑器区域中打开新终端。"),
				localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.agentSessionsWelcomePage' }, "打开“智能体会话欢迎”页。将替代工作台辅助侧栏可见性设置。"),
			],
			'default': 'welcomePage',
			'description': localize('workbench.startupEditor', "控制启动时显示哪个编辑器（当上次会话的编辑器未被恢复时）。"),
			'experiment': { mode: 'auto' },
			agentsWindow: { default: 'none', readOnly: true },
		},
		'workbench.welcomePage.preferReducedMotion': {
			scope: ConfigurationScope.APPLICATION,
			type: 'boolean',
			default: false,
			deprecationMessage: localize('deprecationMessage', "已弃用，请使用全局设置 `workbench.reduceMotion`。"),
			description: localize('workbench.welcomePage.preferReducedMotion', "启用后减少起始页的动画效果。")
		},
		'workbench.welcomePage.experimentalOnboarding': {
			scope: ConfigurationScope.APPLICATION,
			type: 'boolean',
			// 上游默认开：首启弹一层"按你的习惯配置"模态，让你在 5 个主题里选一个。
			// 本产品不跟：主题已经有出厂默认（One Dark Pro），而那层模态会把键盘吃掉——
			// 实测全新 profile 下按 Ctrl+Shift+P 与 Ctrl+Alt+, 都没有反应，直到关掉它，
			// 也就是学生第一次打开软件、照着说明按键时，看到的是"软件没反应"。
			// 关掉它同时让 gettingStarted.ts 那条经典引导页路径重新生效（两头不能都关：
			// startupPage.ts 的 tryShowOnboarding 与这里共用这一个开关）。
			// experiment.mode 一并去掉：留着一个能被远端实验翻回去的口子，出厂行为就不是确定的了。
			default: false,
			tags: ['experimental'],
			description: localize('workbench.welcomePage.experimentalOnboarding', "启用后首次启动显示新版引导流程，而非经典引导页。")
		}
	}
});

registerWorkbenchContribution2(WorkspacePlatformContribution.ID, WorkspacePlatformContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(StartupPageEditorResolverContribution.ID, StartupPageEditorResolverContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(StartupPageRunnerContribution.ID, StartupPageRunnerContribution, WorkbenchPhase.AfterRestored);

AccessibleViewRegistry.register(new GettingStartedAccessibleView());

