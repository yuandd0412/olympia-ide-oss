/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import * as arrays from '../../../../base/common/arrays.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { IWorkspaceContextService, UNKNOWN_EMPTY_WINDOW_WORKSPACE, WorkbenchState } from '../../../../platform/workspace/common/workspace.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ILifecycleService, LifecyclePhase, StartupKind } from '../../../services/lifecycle/common/lifecycle.js';
import { Disposable, } from '../../../../base/common/lifecycle.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { joinPath } from '../../../../base/common/resources.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { GettingStartedEditorOptions, GettingStartedInput, gettingStartedInputTypeId } from './gettingStartedInput.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { getTelemetryLevel } from '../../../../platform/telemetry/common/telemetryUtils.js';
import { TelemetryLevel } from '../../../../platform/telemetry/common/telemetry.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { localize } from '../../../../nls.js';
import { IEditorResolverService, RegisteredEditorPriority } from '../../../services/editor/common/editorResolverService.js';
import { TerminalCommandId } from '../../terminal/common/terminal.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { AuxiliaryBarMaximizedContext } from '../../../common/contextkeys.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { getActiveElement } from '../../../../base/browser/dom.js';
import { isWeb } from '../../../../base/common/platform.js';
import { IOnboardingService } from '../../welcomeOnboarding/common/onboardingService.js';
import { ONBOARDING_STORAGE_KEY } from '../../welcomeOnboarding/common/onboardingTypes.js';
import { OlympiaWelcomeInput, olympiaWelcomeInputTypeId } from '../../olympia/browser/olympiaWelcomeInput.js';

export const restoreWalkthroughsConfigurationKey = 'workbench.welcomePage.restorableWalkthroughs';
export type RestoreWalkthroughsConfigurationValue = { folder: string; category?: string; step?: string };

// Olympia 开始页开关。本产品自己的键，不复用上游 `workbench.startupEditor`：
// 上游那个 enum 只有 7 个值，且 `registerConfiguration` 按 property key 逐个写入，
// 往上游节点里加 key 会污染上游配置面板，同名 key 则会覆盖上游定义。
// 配置注册在 contrib/olympia/browser/olympiaWelcome.contribution.ts（node id 用独立的 'olympia'）。
const olympiaStartPageConfigurationKey = 'olympia.startPage';

const configurationKey = 'workbench.startupEditor';
const oldConfigurationKey = 'workbench.welcome.enabled';
const telemetryOptOutStorageKey = 'workbench.telemetryOptOutShown';

export class StartupPageEditorResolverContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.startupPageEditorResolver';

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IEditorResolverService editorResolverService: IEditorResolverService
	) {
		super();

		this._register(editorResolverService.registerEditor(
			`${GettingStartedInput.RESOURCE.scheme}:/**`,
			{
				id: GettingStartedInput.ID,
				label: localize('welcome.displayName', "起始页"),
				priority: RegisteredEditorPriority.builtin,
			},
			{
				singlePerResource: true,
				canSupportResource: uri => uri.scheme === GettingStartedInput.RESOURCE.scheme,
			},
			{
				createEditorInput: ({ options }) => {
					return {
						editor: this.instantiationService.createInstance(GettingStartedInput, options as GettingStartedEditorOptions),
						options: {
							...options,
							pinned: false
						}
					};
				}
			}
		));
	}
}

export class StartupPageRunnerContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.startupPageRunner';
	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IEditorService private readonly editorService: IEditorService,
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@ILifecycleService private readonly lifecycleService: ILifecycleService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IProductService private readonly productService: IProductService,
		@ICommandService private readonly commandService: ICommandService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@IStorageService private readonly storageService: IStorageService,
		@INotificationService private readonly notificationService: INotificationService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IOnboardingService private readonly onboardingService: IOnboardingService,
	) {
		super();

		this.tryShowOnboarding();
		this.run().then(undefined, onUnexpectedError);
		this._register(this.editorService.onDidCloseEditor((e) => {
			if (e.editor instanceof GettingStartedInput) {
				e.editor.selectedCategory = undefined;
				e.editor.selectedStep = undefined;
			}
		}));
	}

	private async run() {

		// Wait for resolving startup editor until we are restored to reduce startup pressure
		await this.lifecycleService.when(LifecyclePhase.Restored);

		if (AuxiliaryBarMaximizedContext.getValue(this.contextKeyService)) {
			// If the auxiliary bar is maximized, we do not show the welcome page.
			return;
		}

		// Always open Welcome page for first-launch, no matter what is open or which startupEditor is set.
		if (
			this.productService.enableTelemetry
			&& this.productService.showTelemetryOptOut
			&& getTelemetryLevel(this.configurationService) !== TelemetryLevel.NONE
			&& !this.environmentService.skipWelcome
			&& !this.storageService.get(telemetryOptOutStorageKey, StorageScope.PROFILE)
		) {
			this.storageService.store(telemetryOptOutStorageKey, true, StorageScope.PROFILE, StorageTarget.USER);
		}

		if (this.tryOpenWalkthroughForFolder()) {
			return;
		}

		// Olympia 开始页：本产品自己的开关，优先于上游 `workbench.startupEditor`。
		// 上游这条分支本身一行没动，这里只多了一个出口；其余接线都在 contrib/olympia 里。
		const olympiaStartPageEnabled = this.configurationService.getValue<boolean>(olympiaStartPageConfigurationKey) ?? true;
		if (olympiaStartPageEnabled
			&& this.lifecycleService.startupKind !== StartupKind.ReloadedWindow
			&& (!this.editorService.activeEditor || this.layoutService.openedDefaultEditors)) {
			await this.openOlympiaWelcome();
			return;
		}

		const enabled = isStartupPageEnabled(this.configurationService, this.contextService, this.environmentService);
		if (enabled && this.lifecycleService.startupKind !== StartupKind.ReloadedWindow) {

			// Open the welcome even if we opened a set of default editors
			if (!this.editorService.activeEditor || this.layoutService.openedDefaultEditors) {
				const startupEditorSetting = this.configurationService.inspect<string>(configurationKey);

				if (startupEditorSetting.value === 'readme') {
					await this.openReadme();
				} else if (startupEditorSetting.value === 'welcomePage' || startupEditorSetting.value === 'welcomePageInEmptyWorkbench') {
					await this.openGettingStarted(true);
				} else if (startupEditorSetting.value === 'terminal') {
					this.commandService.executeCommand(TerminalCommandId.CreateTerminalEditor);
				}
			}
		}
	}

	private tryOpenWalkthroughForFolder(): boolean {
		const toRestore = this.storageService.get(restoreWalkthroughsConfigurationKey, StorageScope.PROFILE);
		if (!toRestore) {
			return false;
		}
		else {
			const restoreData: RestoreWalkthroughsConfigurationValue = JSON.parse(toRestore);
			const currentWorkspace = this.contextService.getWorkspace();
			if (restoreData.folder === UNKNOWN_EMPTY_WINDOW_WORKSPACE.id || restoreData.folder === currentWorkspace.folders[0].uri.toString()) {
				const options: GettingStartedEditorOptions = { selectedCategory: restoreData.category, selectedStep: restoreData.step, pinned: false, preserveFocus: this.shouldPreserveFocus() };
				this.editorService.openEditor({
					resource: GettingStartedInput.RESOURCE,
					options
				});
				this.storageService.remove(restoreWalkthroughsConfigurationKey, StorageScope.PROFILE);
				return true;
			}
		}
		return false;
	}

	private async openReadme() {
		const readmes = arrays.coalesce(
			await Promise.all(this.contextService.getWorkspace().folders.map(
				async folder => {
					const folderUri = folder.uri;
					const folderStat = await this.fileService.resolve(folderUri).catch(onUnexpectedError);
					const files = folderStat?.children ? folderStat.children.map(child => child.name).sort() : [];
					const file = files.find(file => file.toLowerCase() === 'readme.md') || files.find(file => file.toLowerCase().startsWith('readme'));
					if (file) { return joinPath(folderUri, file); }
					else { return undefined; }
				})));

		if (!this.editorService.activeEditor) {
			if (readmes.length) {
				const isMarkDown = (readme: URI) => readme.path.toLowerCase().endsWith('.md');
				await Promise.all([
					this.commandService.executeCommand('markdown.showPreview', null, readmes.filter(isMarkDown), { locked: true }).catch(error => {
						this.notificationService.error(localize('startupPage.markdownPreviewError', "无法打开 Markdown 预览: {0}。\r\n\r\n请确保已启用 Markdown 扩展。", error.message));
					}),
					this.editorService.openEditors(readmes.filter(readme => !isMarkDown(readme)).map(readme => ({ resource: readme, options: { preserveFocus: this.shouldPreserveFocus() } }))),
				]);
			} else {
				// If no readme is found, default to showing the welcome page.
				await this.openGettingStarted();
			}
		}
	}

	private async openGettingStarted(showTelemetryNotice?: boolean) {
		const startupEditorTypeID = gettingStartedInputTypeId;
		const editor = this.editorService.activeEditor;

		// Ensure that the welcome editor won't get opened more than once
		if (editor?.typeId === startupEditorTypeID || this.editorService.editors.some(e => e.typeId === startupEditorTypeID)) {
			return;
		}

		if (startupEditorTypeID === gettingStartedInputTypeId) {
			this.editorService.openEditor({
				resource: GettingStartedInput.RESOURCE,
				options: {
					index: editor ? 0 : undefined,
					pinned: false,
					preserveFocus: this.shouldPreserveFocus(),
					...{ showTelemetryNotice }
				},
			});
		}
	}

	/**
	 * 打开 Olympia 开始页。去重逻辑与上游 `openGettingStarted` 同构：
	 * 已经开着就别再开一次，否则每次启动都抢焦点。
	 */
	private async openOlympiaWelcome() {
		const editor = this.editorService.activeEditor;

		if (editor?.typeId === olympiaWelcomeInputTypeId || this.editorService.editors.some(e => e.typeId === olympiaWelcomeInputTypeId)) {
			return;
		}

		this.editorService.openEditor({
			resource: OlympiaWelcomeInput.RESOURCE,
			options: {
				index: editor ? 0 : undefined,
				pinned: false,
				preserveFocus: this.shouldPreserveFocus(),
			},
		});
	}

	private shouldPreserveFocus(): boolean {
		const activeElement = getActiveElement();
		if (!activeElement || activeElement === mainWindow.document.body || this.layoutService.hasFocus(Parts.EDITOR_PART)) {
			return false; // steal focus if nothing meaningful is focused or editor area has focus
		}

		return true; // do not steal focus
	}

	private tryShowOnboarding(): void {
		if (this.environmentService.skipWelcome) {
			return; // skip welcome flag is set
		}

		if (isWeb) {
			return; // not supported on web (e.g. codespaces, github.dev)
		}

		if (!this.configurationService.getValue<boolean>('workbench.welcomePage.experimentalOnboarding')) {
			return; // experimental onboarding is disabled
		}

		// 上游在这里挡的是「AI 导向的引导」：`sentiment.hidden` 为真时不给看。
		// 但本产品走 byokOnly，OnboardingVariationA 已经把「登录 / 解锁 Copilot / 连接 GitHub」
		// 整一步过滤掉（onboardingVariationA.ts 的 byokOnly 分支），剩下的只有一步全中文的
		// 「选颜色主题 + 键盘映射」。留着这个 return 等于把首启引导整条丢掉，而
		// `gettingStarted.ts:1022` 又因为同一个 experimentalOnboarding 开关不显示经典
		// walkthrough——两头都没有，新用户什么都拿不到。
		if (!this.storageService.isNew(StorageScope.APPLICATION)) {
			return; // only show onboarding for new users who have never used the product before
		}

		if (this.storageService.getBoolean(ONBOARDING_STORAGE_KEY, StorageScope.APPLICATION)) {
			return; // onboarding already completed
		}

		// Show the onboarding overlay on top of the welcome page
		this.onboardingService.show();

		// Mark onboarding as completed when dismissed
		this._register(this.onboardingService.onDidDismiss(() => {
			this.storageService.store(ONBOARDING_STORAGE_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
		}));
	}
}

function isStartupPageEnabled(configurationService: IConfigurationService, contextService: IWorkspaceContextService, environmentService: IWorkbenchEnvironmentService) {
	if (environmentService.skipWelcome) {
		return false;
	}

	const startupEditor = configurationService.inspect<string>(configurationKey);
	if (!startupEditor.userValue && !startupEditor.workspaceValue) {
		const welcomeEnabled = configurationService.inspect(oldConfigurationKey);
		if (welcomeEnabled.value !== undefined && welcomeEnabled.value !== null) {
			return welcomeEnabled.value;
		}
	}

	return startupEditor.value === 'welcomePage'
		|| startupEditor.value === 'readme'
		|| (contextService.getWorkbenchState() === WorkbenchState.EMPTY && startupEditor.value === 'welcomePageInEmptyWorkbench')
		|| startupEditor.value === 'terminal';
}
