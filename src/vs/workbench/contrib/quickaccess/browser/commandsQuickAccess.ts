/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isFirefox } from '../../../../base/browser/browser.js';
import { raceTimeout, timeout } from '../../../../base/common/async.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { stripIcons } from '../../../../base/common/iconLabels.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { Language } from '../../../../base/common/platform.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { IEditor } from '../../../../editor/common/editorCommon.js';
import { AbstractEditorCommandsQuickAccessProvider } from '../../../../editor/contrib/quickAccess/browser/commandsQuickAccess.js';
import { localize, localize2 } from '../../../../nls.js';
import { isLocalizedString } from '../../../../platform/action/common/action.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { Action2, IMenuService, MenuId, MenuItemAction, SubmenuItemAction } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationChangeEvent, IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { CommandsHistory, ICommandQuickPick } from '../../../../platform/quickinput/browser/commandsQuickAccess.js';
import { TriggerAction } from '../../../../platform/quickinput/browser/pickerQuickAccess.js';
import { DefaultQuickAccessFilterValue } from '../../../../platform/quickinput/common/quickAccess.js';
import { IQuickInputService, IQuickPickSeparator } from '../../../../platform/quickinput/common/quickInput.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IWorkbenchQuickAccessConfiguration } from '../../../browser/quickaccess.js';
import { CommandInformationResult, IAiRelatedInformationService, RelatedInformationType } from '../../../services/aiRelatedInformation/common/aiRelatedInformation.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { createKeybindingCommandQuery } from '../../../services/preferences/browser/keybindingsEditorModel.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { CHAT_OPEN_ACTION_ID } from '../../chat/browser/actions/chatActions.js';
import { ASK_QUICK_QUESTION_ACTION_ID } from '../../chat/browser/actions/chatQuickInputActions.js';
import { ForceUpdateAgentPluginsCommandId, RefreshAgentPluginMarketplacesCommandId, UpdateAgentPluginsCommandId } from '../../chat/browser/chat.js';
import { IChatAgentService } from '../../chat/common/participants/chatAgents.js';
import { ChatAgentLocation } from '../../chat/common/constants.js';

/**
 * 「开发人员」整组不进命令面板。
 *
 * 这一组是一百多条上游自己调试 VS Code 用的命令（切换运行时参数、打开进程资源管理器、
 * 性能跟踪、重新加载 Web 视图、智能体主机探查器…），本产品里没有能用它们的人：
 * 学生按 Ctrl+Shift+P 是为了找功能，不是为了一份他读不懂的日志。留在面板里只有一个作用——
 * 把「Olympia: …」挤到要翻两屏才找得到。类目名读的是 `Categories.Developer` 自己的值，
 * 所以汉化改了叫法这里跟着变，不会出现「文档里叫开发人员、过滤按另一个字符串」。
 *
 * 'MCP' 是第二组。上游注释写明「缩略语不做汉化」（`mcpCommands.ts` 里那个 category），
 * 所以面板里那六行永远是大写英文开头，且全是给智能体挂外部工具用的配置命令
 * （添加服务器 / 浏览服务器 / 从清单文件安装…）——本产品 BYOK-only，没有需要它的人。
 * 掉的只是面板入口：`mcp.json` 里配了的服务器照旧自启，功能没被拆。
 *
 * 「账户」是第三组：本产品没有托管账号（活动栏那枚账户按钮出厂就是关的），这几条点开
 * 只能得到一个空列表。上游把它的类目在五个工作区命令里各写一遍 `localize2('accounts', …)`，
 * 所以这里没法读现成常量——先把那张表补上 `Categories.Account`，五处一起改读它，
 * 过滤再按同一个值收，避免出现第三份「账户」字符串。
 */
const HIDDEN_COMMAND_CATEGORIES: readonly string[] = [Categories.Developer.value, 'MCP', Categories.Account.value];
/**
 * 这组里放行两条：「重新加载窗口」是手册里会让学生按的那一个（窗口不对劲时先重载，
 * 不用重开整个程序，也不丢已打开的文件）；「打开日志文件夹」是出问题让我们来查时唯一
 * 要说清路径的入口。放行名单按命令 id 写，类目还是整组关掉。
 */
const KEPT_COMMANDS_IN_HIDDEN_CATEGORIES: readonly string[] = [
	'workbench.action.reloadWindow',
	'workbench.action.openLogsFolder',
];
/**
 * 整组类目之外，按命令 id 单条摘掉的面板入口。
 *
 * 「刷新插件市场」属于上游的智能体插件（agent plugins）那一套：从 marketplace 清单拉第三方
 * 插件包。本产品只内置 Olympia 教练一个参与者，学生的机器上既没有 marketplace 清单，也没有
 * 需要他手动刷新的东西——点它只会得到一条英文的「刷新失败」通知。所以只摘面板入口：
 * `chatPlugins.json` 里真配了清单时，命令照旧能用（id 还在 CommandsRegistry 里），
 * 与 'MCP' 那组的处理口径一致。
 *
 * 判据是「这个产品里有没有人会点它」，不是「汉化做没做」——标题现在还是英文，
 * 但一条没人需要的命令翻成中文也只是多一行占位的中文。
 *
 * 写成函数而不是模块级常量：id 来自 chat 那一侧的导出，若在模块初始化时就取值，
 * 一旦两条模块互相引用就会拿到 undefined，过滤会一声不响地失效。调用时再取，
 * 循环里每次比较都读的是当前值。
 */
/**
 * 摘掉的名单在调用时取值（避免模块初始化顺序把它变成 undefined）——见上方注释。
 *
 * 三条都属于智能体插件（agent plugins）那一组：从 marketplace 刷新清单、检查插件更新、
 * 强制更新。真机上把上面两条摘掉后再念一次面板，露出来的正是它们的两个兄弟，所以整组一起收：
 * 学生手上没有需要更新的第三方智能体插件，教练是内置的。
 */
function hiddenCommandIds(): readonly string[] {
	return [
		RefreshAgentPluginMarketplacesCommandId,
		UpdateAgentPluginsCommandId,
		ForceUpdateAgentPluginsCommandId,
	];
}

export class CommandsQuickAccessProvider extends AbstractEditorCommandsQuickAccessProvider {

	private static AI_RELATED_INFORMATION_MAX_PICKS = 5;
	private static AI_RELATED_INFORMATION_DEBOUNCE = 200;

	// If extensions are not yet registered, we wait for a little moment to give them
	// a chance to register so that the complete set of commands shows up as result
	// We do not want to delay functionality beyond that time though to keep the commands
	// functional.
	private readonly extensionRegistrationRace: Promise<boolean | undefined>;

	private useAiRelatedInfo = false;

	protected get activeTextEditorControl(): IEditor | undefined { return this.editorService.activeTextEditorControl; }

	get defaultFilterValue(): DefaultQuickAccessFilterValue | undefined {
		if (this.configuration.preserveInput) {
			return DefaultQuickAccessFilterValue.LAST;
		}

		return undefined;
	}

	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IMenuService private readonly menuService: IMenuService,
		@IExtensionService extensionService: IExtensionService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IKeybindingService keybindingService: IKeybindingService,
		@ICommandService commandService: ICommandService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IDialogService dialogService: IDialogService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IEditorGroupsService private readonly editorGroupService: IEditorGroupsService,
		@IPreferencesService private readonly preferencesService: IPreferencesService,
		@IProductService private readonly productService: IProductService,
		@IAiRelatedInformationService private readonly aiRelatedInformationService: IAiRelatedInformationService,
		@IChatAgentService private readonly chatAgentService: IChatAgentService,
	) {
		super({
			showAlias: !Language.isDefaultVariant(),
			noResultsPick: () => ({
				label: localize('noCommandResults', "没有匹配的命令"),
				commandId: ''
			}),
		}, instantiationService, keybindingService, commandService, telemetryService, dialogService);

		this.extensionRegistrationRace = raceTimeout(extensionService.whenInstalledExtensionsRegistered(), 800);
		this._register(configurationService.onDidChangeConfiguration((e) => this.updateOptions(e)));
		this.updateOptions();
	}

	private get configuration() {
		const commandPaletteConfig = this.configurationService.getValue<IWorkbenchQuickAccessConfiguration>().workbench.commandPalette;

		return {
			preserveInput: commandPaletteConfig.preserveInput,
			showAskInChat: commandPaletteConfig.showAskInChat,
			experimental: commandPaletteConfig.experimental
		};
	}

	private updateOptions(e?: IConfigurationChangeEvent): void {
		if (e && !e.affectsConfiguration('workbench.commandPalette.experimental')) {
			return;
		}

		const config = this.configuration;
		const suggestedCommandIds = config.experimental.suggestCommands && this.productService.commandPaletteSuggestedCommandIds?.length
			? new Set(this.productService.commandPaletteSuggestedCommandIds)
			: undefined;
		this.options.suggestedCommandIds = suggestedCommandIds;
		this.useAiRelatedInfo = config.experimental.enableNaturalLanguageSearch;
	}

	protected async getCommandPicks(token: CancellationToken): Promise<Array<ICommandQuickPick>> {

		// wait for extensions registration or 800ms once
		await this.extensionRegistrationRace;

		if (token.isCancellationRequested) {
			return [];
		}

		return [
			...this.getCodeEditorCommandPicks(),
			...this.getGlobalCommandPicks()
		].map(picks => ({
			...picks,
			buttons: [{
				iconClass: ThemeIcon.asClassName(Codicon.gear),
				tooltip: localize('configure keybinding', "配置快捷键"),
			}],
			trigger: (): TriggerAction => {
				this.preferencesService.openGlobalKeybindingSettings(false, { query: createKeybindingCommandQuery(picks.commandId, picks.commandWhen) });
				return TriggerAction.CLOSE_PICKER;
			},
		}));
	}

	protected hasAdditionalCommandPicks(filter: string, token: CancellationToken): boolean {
		if (
			!this.useAiRelatedInfo
			|| token.isCancellationRequested
			|| filter === ''
			|| !this.aiRelatedInformationService.isEnabled()
		) {
			return false;
		}

		return true;
	}

	protected async getAdditionalCommandPicks(allPicks: ICommandQuickPick[], picksSoFar: ICommandQuickPick[], filter: string, token: CancellationToken): Promise<Array<ICommandQuickPick | IQuickPickSeparator>> {
		if (!this.hasAdditionalCommandPicks(filter, token)) {
			return [];
		}

		let additionalPicks: (ICommandQuickPick | IQuickPickSeparator)[] = [];
		try {
			// Wait a bit to see if the user is still typing
			await timeout(CommandsQuickAccessProvider.AI_RELATED_INFORMATION_DEBOUNCE, token);
			additionalPicks = await this.getRelatedInformationPicks(allPicks, picksSoFar, filter, token);
		} catch (e) {
			// Ignore and continue to add "Ask in Chat" option
		}

		// If enabled in settings, add "Ask in Chat" option after a separator (if needed).
		if (this.configuration.showAskInChat) {
			const defaultAgent = this.chatAgentService.getDefaultAgent(ChatAgentLocation.Chat);
			if (defaultAgent) {
				if (picksSoFar.length || additionalPicks.length) {
					additionalPicks.push({
						type: 'separator'
					});
				}

				additionalPicks.push({
					label: localize('commandsQuickAccess.askInChat', "在对话中询问：{0}", filter),
					commandId: this.configuration.experimental.askChatLocation === 'quickChat' ? ASK_QUICK_QUESTION_ACTION_ID : CHAT_OPEN_ACTION_ID,
					args: [filter],
					buttons: [{
						iconClass: ThemeIcon.asClassName(Codicon.gear),
						tooltip: localize('commandsQuickAccess.configureAskInChatSetting', "配置可见性"),
					}],
					trigger: () => {
						void this.preferencesService.openSettings({ jsonEditor: false, query: 'workbench.commandPalette.showAskInChat' });
						return TriggerAction.CLOSE_PICKER;
					},
				});
			}
		}

		return additionalPicks;
	}

	private async getRelatedInformationPicks(allPicks: ICommandQuickPick[], picksSoFar: ICommandQuickPick[], filter: string, token: CancellationToken) {
		const relatedInformation = await this.aiRelatedInformationService.getRelatedInformation(
			filter,
			[RelatedInformationType.CommandInformation],
			token
		) as CommandInformationResult[];

		// Sort by weight descending to get the most relevant results first
		relatedInformation.sort((a, b) => b.weight - a.weight);

		const setOfPicksSoFar = new Set(picksSoFar.map(p => p.commandId));
		const additionalPicks = new Array<ICommandQuickPick | IQuickPickSeparator>();

		for (const info of relatedInformation) {
			if (additionalPicks.length === CommandsQuickAccessProvider.AI_RELATED_INFORMATION_MAX_PICKS) {
				break;
			}
			const pick = allPicks.find(p => p.commandId === info.command && !setOfPicksSoFar.has(p.commandId));
			if (pick) {
				additionalPicks.push(pick);
			}
		}

		return additionalPicks;
	}

	private getGlobalCommandPicks(): ICommandQuickPick[] {
		const globalCommandPicks: ICommandQuickPick[] = [];
		const scopedContextKeyService = this.editorService.activeEditorPane?.scopedContextKeyService || this.editorGroupService.activeGroup.scopedContextKeyService;
		const globalCommandsMenu = this.menuService.getMenuActions(MenuId.CommandPalette, scopedContextKeyService);
		const globalCommandsMenuActions = globalCommandsMenu
			.reduce((r, [, actions]) => [...r, ...actions], <Array<MenuItemAction | SubmenuItemAction | string>>[])
			.filter(action => action instanceof MenuItemAction && action.enabled) as MenuItemAction[];

		for (const action of globalCommandsMenuActions) {

			// Label
			let label = (typeof action.item.title === 'string' ? action.item.title : action.item.title.value) || action.item.id;

			// Category
			const category = typeof action.item.category === 'string' ? action.item.category : action.item.category?.value;
			// 整组类目按掉：见文件顶部 HIDDEN_COMMAND_CATEGORIES 的理由。放行名单在这里，
			// 所以「重新加载窗口」这种学生真要用的一条不会被一起带走。
			if (category && HIDDEN_COMMAND_CATEGORIES.includes(category) && !KEPT_COMMANDS_IN_HIDDEN_CATEGORIES.includes(action.item.id)) {
				continue;
			}
			// 单条摘掉的面板入口：见上方 hiddenCommandIds() 的理由。
			if (hiddenCommandIds().includes(action.item.id)) {
				continue;
			}
			if (category) {
				label = localize('commandWithCategory', "{0}: {1}", category, label);
			}

			// Alias
			const aliasLabel = typeof action.item.title !== 'string' ? action.item.title.original : undefined;
			const aliasCategory = (category && action.item.category && typeof action.item.category !== 'string') ? action.item.category.original : undefined;
			const commandAlias = (aliasLabel && category) ?
				aliasCategory ? `${aliasCategory}: ${aliasLabel}` : `${category}: ${aliasLabel}` :
				aliasLabel;

			const metadataDescription = action.item.metadata?.description;
			const commandDescription = metadataDescription === undefined || isLocalizedString(metadataDescription)
				? metadataDescription
				// TODO: this type will eventually not be a string and when that happens, this should simplified.
				: { value: metadataDescription, original: metadataDescription };
			globalCommandPicks.push({
				commandId: action.item.id,
				commandWhen: action.item.precondition?.serialize(),
				commandAlias,
				label: stripIcons(label),
				commandDescription,
				commandCategory: category,
			});
		}

		return globalCommandPicks;
	}
}

//#region Actions

export class ShowAllCommandsAction extends Action2 {

	static readonly ID = 'workbench.action.showCommands';

	constructor() {
		super({
			id: ShowAllCommandsAction.ID,
			title: localize2('showTriggerActions', "显示所有命令"),
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				when: undefined,
				primary: !isFirefox ? (KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyP) : undefined,
				secondary: [KeyCode.F1]
			},
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		accessor.get(IQuickInputService).quickAccess.show(CommandsQuickAccessProvider.PREFIX);
	}
}

export class ClearCommandHistoryAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.clearCommandHistory',
			title: localize2('clearCommandHistory', "清除命令历史记录"),
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		const storageService = accessor.get(IStorageService);
		const dialogService = accessor.get(IDialogService);

		const commandHistoryLength = CommandsHistory.getConfiguredCommandHistoryLength(configurationService);
		if (commandHistoryLength > 0) {

			// Ask for confirmation
			const { confirmed } = await dialogService.confirm({
				type: 'warning',
				message: localize('confirmClearMessage', "要清空最近使用的命令历史吗？"),
				detail: localize('confirmClearDetail', "此操作不可撤销！"),
				primaryButton: localize({ key: 'clearButtonLabel', comment: ['&& denotes a mnemonic'] }, "清除(&&C)")
			});

			if (!confirmed) {
				return;
			}

			CommandsHistory.clearHistory(configurationService, storageService);
		}
	}
}

//#endregion
