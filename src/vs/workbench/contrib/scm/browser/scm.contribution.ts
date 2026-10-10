/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContributionsRegistry, registerWorkbenchContribution2, Extensions as WorkbenchExtensions, WorkbenchPhase } from '../../../common/contributions.js';
import { VIEWLET_ID, ISCMService, VIEW_PANE_ID, ISCMProvider, ISCMViewService, REPOSITORIES_VIEW_PANE_ID, HISTORY_VIEW_PANE_ID } from '../common/scm.js';
import { KeyMod, KeyCode } from '../../../../base/common/keyCodes.js';
import { MenuRegistry, MenuId, registerAction2, Action2 } from '../../../../platform/actions/common/actions.js';
import { SCMActiveResourceContextKeyController, SCMActiveRepositoryController } from './activity.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IContextKeyService, ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { KeybindingsRegistry, KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { IViewContainersRegistry, ViewContainerLocation, Extensions as ViewContainerExtensions, IViewsRegistry } from '../../../common/views.js';
import { SCMViewPaneContainer } from './scmViewPaneContainer.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ModesRegistry } from '../../../../editor/common/languages/modesRegistry.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { ContextKeys, SCMViewPane } from './scmViewPane.js';
import { RepositoryPicker } from './scmViewService.js';
import { SCMRepositoriesViewPane } from './scmRepositoriesViewPane.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { Context as SuggestContext } from '../../../../editor/contrib/suggest/browser/suggest.js';
import { InlineCompletionContextKeys } from '../../../../editor/contrib/inlineCompletions/browser/controller/inlineCompletionContextKeys.js';
import { MANAGE_TRUST_COMMAND_ID, WorkspaceTrustContext } from '../../workspace/common/workspace.js';
import { getActiveElement, isActiveElement } from '../../../../base/browser/dom.js';
import { SCMWorkingSetController } from './workingSet.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IListService, WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { isSCMRepository } from './util.js';
import { SCMHistoryViewPane } from './scmHistoryViewPane.js';
import { RemoteNameContext, ResourceContextKey } from '../../../common/contextkeys.js';
import { AccessibleViewRegistry } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { SCMAccessibilityHelp } from './scmAccessibilityHelp.js';
import { EditorContextKeys } from '../../../../editor/common/editorContextKeys.js';
import { SCMHistoryItemContextContribution } from './scmHistoryChatContext.js';
import { ChatContextKeys } from '../../chat/common/actions/chatContextKeys.js';
import { CHAT_SETUP_SUPPORT_ANONYMOUS_ACTION_ID } from '../../chat/browser/actions/chatActions.js';
import { SCMInputContextKeys } from './scmInput.js';
import product from '../../../../platform/product/common/product.js';

ModesRegistry.registerLanguage({
	id: 'scminput',
	extensions: [],
	aliases: [], // hide from language selector
	mimetypes: ['text/x-scm-input']
});

const sourceControlViewIcon = registerIcon('source-control-view-icon', Codicon.sourceControl, localize('sourceControlViewIcon', "源代码管理视图的视图图标。"));

const viewContainer = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
	id: VIEWLET_ID,
	title: localize2('source control', "源代码管理"),
	ctorDescriptor: new SyncDescriptor(SCMViewPaneContainer),
	storageId: 'workbench.scm.views.state',
	icon: sourceControlViewIcon,
	alwaysUseContainerInfo: true,
	order: 2,
	hideIfEmpty: true,
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: true });

const viewsRegistry = Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry);
const containerTitle = localize('source control view', "源代码管理");

viewsRegistry.registerViewWelcomeContent(VIEW_PANE_ID, {
	content: localize('no open repo', "没有注册任何源代码管理提供程序。"),
	when: 'default'
});

viewsRegistry.registerViewWelcomeContent(VIEW_PANE_ID, {
	content: localize('no open repo in an untrusted workspace', "已注册的源代码管理提供程序在受限模式下均不可用。"),
	when: ContextKeyExpr.and(ContextKeyExpr.equals('scm.providerCount', 0), WorkspaceTrustContext.IsEnabled, WorkspaceTrustContext.IsTrusted.toNegated())
});

viewsRegistry.registerViewWelcomeContent(VIEW_PANE_ID, {
	content: `[${localize('manageWorkspaceTrustAction', "管理工作区信任")}](command:${MANAGE_TRUST_COMMAND_ID})`,
	when: ContextKeyExpr.and(ContextKeyExpr.equals('scm.providerCount', 0), WorkspaceTrustContext.IsEnabled, WorkspaceTrustContext.IsTrusted.toNegated())
});

viewsRegistry.registerViewWelcomeContent(HISTORY_VIEW_PANE_ID, {
	content: localize('no history items', "所选的源代码管理提供程序没有任何历史记录。"),
	when: ContextKeys.SCMHistoryItemCount.isEqualTo(0)
});

viewsRegistry.registerViews([{
	id: REPOSITORIES_VIEW_PANE_ID,
	containerTitle,
	name: localize2('scmRepositories', "仓库"),
	singleViewPaneContainerTitle: localize('source control repositories', "源代码管理仓库"),
	ctorDescriptor: new SyncDescriptor(SCMRepositoriesViewPane),
	canToggleVisibility: true,
	hideByDefault: true,
	canMoveView: true,
	weight: 20,
	order: 0,
	when: ContextKeyExpr.and(ContextKeyExpr.has('scm.providerCount'), ContextKeyExpr.notEquals('scm.providerCount', 0)),
	// readonly when = ContextKeyExpr.or(ContextKeyExpr.equals('config.scm.alwaysShowProviders', true), ContextKeyExpr.and(ContextKeyExpr.notEquals('scm.providerCount', 0), ContextKeyExpr.notEquals('scm.providerCount', 1)));
	containerIcon: sourceControlViewIcon
}], viewContainer);

viewsRegistry.registerViews([{
	id: VIEW_PANE_ID,
	containerTitle,
	name: localize2('scmChanges', "更改"),
	singleViewPaneContainerTitle: containerTitle,
	ctorDescriptor: new SyncDescriptor(SCMViewPane),
	canToggleVisibility: true,
	canMoveView: true,
	weight: 40,
	order: 1,
	containerIcon: sourceControlViewIcon,
	openCommandActionDescriptor: {
		id: viewContainer.id,
		mnemonicTitle: localize({ key: 'miViewSCM', comment: ['&& denotes a mnemonic'] }, "源代码管理(&&C)"),
		keybindings: {
			primary: 0,
			win: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyG },
			linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyG },
			mac: { primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.KeyG },
		},
		order: 2,
	}
}], viewContainer);

viewsRegistry.registerViews([{
	id: HISTORY_VIEW_PANE_ID,
	containerTitle,
	name: localize2('scmGraph', "关系图"),
	singleViewPaneContainerTitle: localize('source control graph', "源代码关系图"),
	ctorDescriptor: new SyncDescriptor(SCMHistoryViewPane),
	canToggleVisibility: true,
	canMoveView: true,
	weight: 40,
	order: 2,
	when: ContextKeyExpr.and(
		ContextKeyExpr.has('scm.historyProviderCount'),
		ContextKeyExpr.notEquals('scm.historyProviderCount', 0),
	),
	containerIcon: sourceControlViewIcon
}], viewContainer);

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(SCMActiveRepositoryController, LifecyclePhase.Restored);

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(SCMActiveResourceContextKeyController, LifecyclePhase.Restored);

registerWorkbenchContribution2(
	SCMWorkingSetController.ID,
	SCMWorkingSetController,
	WorkbenchPhase.AfterRestored
);

registerWorkbenchContribution2(
	SCMHistoryItemContextContribution.ID,
	SCMHistoryItemContextContribution,
	WorkbenchPhase.AfterRestored
);

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'scm',
	order: 5,
	title: localize('scmConfigurationTitle', "源代码管理"),
	type: 'object',
	scope: ConfigurationScope.RESOURCE,
	properties: {
		'scm.diffDecorations': {
			type: 'string',
			enum: ['all', 'gutter', 'overview', 'minimap', 'none'],
			enumDescriptions: [
				localize('scm.diffDecorations.all', "在所有可用位置显示差异装饰。"),
				localize('scm.diffDecorations.gutter', "仅在编辑器装订线显示差异装饰。"),
				localize('scm.diffDecorations.overviewRuler', "仅在标尺显示差异装饰。"),
				localize('scm.diffDecorations.minimap', "仅在缩略图显示差异装饰。"),
				localize('scm.diffDecorations.none', "不显示差异装饰。")
			],
			default: 'all',
			description: localize('diffDecorations', "控制编辑器中的差异装饰。")
		},
		'scm.diffDecorationsGutterWidth': {
			type: 'number',
			enum: [1, 2, 3, 4, 5],
			default: 3,
			description: localize('diffGutterWidth', "控制装订线中差异装饰的宽度（像素）（新增与修改）。")
		},
		'scm.diffDecorationsGutterVisibility': {
			type: 'string',
			enum: ['always', 'hover'],
			enumDescriptions: [
				localize('scm.diffDecorationsGutterVisibility.always', "始终在装订线中显示差异装饰。"),
				localize('scm.diffDecorationsGutterVisibility.hover', "仅在悬停时于装订线中显示差异装饰。")
			],
			description: localize('scm.diffDecorationsGutterVisibility', "控制装订线中源代码差异装饰的可见性。"),
			default: 'always'
		},
		'scm.diffDecorationsGutterAction': {
			type: 'string',
			enum: ['diff', 'none'],
			enumDescriptions: [
				localize('scm.diffDecorationsGutterAction.diff', "单击时显示内联差异窥视视图。"),
				localize('scm.diffDecorationsGutterAction.none', "不做任何操作。")
			],
			description: localize('scm.diffDecorationsGutterAction', "控制源代码差异装订线装饰的行为。"),
			default: 'diff'
		},
		'scm.diffDecorationsGutterPattern': {
			type: 'object',
			description: localize('diffGutterPattern', "控制装订线差异装饰是否使用图案。"),
			additionalProperties: false,
			properties: {
				'added': {
					type: 'boolean',
					description: localize('diffGutterPatternAdded', "新增行的装订线差异装饰使用图案。"),
				},
				'modified': {
					type: 'boolean',
					description: localize('diffGutterPatternModifed', "修改行的装订线差异装饰使用图案。"),
				},
			},
			default: {
				'added': false,
				'modified': true
			}
		},
		'scm.diffDecorationsIgnoreTrimWhitespace': {
			type: 'string',
			enum: ['true', 'false', 'inherit'],
			enumDescriptions: [
				localize('scm.diffDecorationsIgnoreTrimWhitespace.true', "忽略行首和行尾空白。"),
				localize('scm.diffDecorationsIgnoreTrimWhitespace.false', "不忽略行首和行尾空白。"),
				localize('scm.diffDecorationsIgnoreTrimWhitespace.inherit', "继承 `diffEditor.ignoreTrimWhitespace` 的设置。")
			],
			description: localize('diffDecorationsIgnoreTrimWhitespace', "控制源代码差异装订线装饰是否忽略行首行尾空白。"),
			default: 'false'
		},
		'scm.alwaysShowActions': {
			type: 'boolean',
			description: localize('alwaysShowActions', "控制源代码管理视图中的行内操作是否始终可见。"),
			default: false
		},
		'scm.countBadge': {
			type: 'string',
			enum: ['all', 'focused', 'off'],
			enumDescriptions: [
				localize('scm.countBadge.all', "显示所有源代码管理提供程序角标数值的总和。"),
				localize('scm.countBadge.focused', "显示当前聚焦的源代码管理提供程序的角标数值。"),
				localize('scm.countBadge.off', "禁用源代码管理角标数值。")
			],
			description: localize('scm.countBadge', "控制活动栏上源代码管理图标的角标数值。"),
			default: 'all'
		},
		'scm.providerCountBadge': {
			type: 'string',
			enum: ['hidden', 'auto', 'visible'],
			enumDescriptions: [
				localize('scm.providerCountBadge.hidden', "隐藏源代码管理提供程序的角标数值。"),
				localize('scm.providerCountBadge.auto', "仅当数值非零时显示源代码管理提供程序的角标。"),
				localize('scm.providerCountBadge.visible', "显示源代码管理提供程序的角标数值。")
			],
			markdownDescription: localize('scm.providerCountBadge', "控制源代码管理提供程序标头上的计数锁屏提醒。当存在多个提供程序或启用 {0} 设置时，以及在“源代码管理存储库”视图中，这些标头将显示在“源代码管理”视图中。", '\`#scm.alwaysShowRepositories#\`'),
			default: 'hidden'
		},
		'scm.defaultViewMode': {
			type: 'string',
			enum: ['tree', 'list'],
			enumDescriptions: [
				localize('scm.defaultViewMode.tree', "以树状显示仓库改动。"),
				localize('scm.defaultViewMode.list', "以列表显示仓库改动。")
			],
			description: localize('scm.defaultViewMode', "控制源代码管理仓库的默认视图模式。"),
			default: 'list'
		},
		'scm.defaultViewSortKey': {
			type: 'string',
			enum: ['name', 'path', 'status'],
			enumDescriptions: [
				localize('scm.defaultViewSortKey.name', "按文件名排序仓库改动。"),
				localize('scm.defaultViewSortKey.path', "按路径排序仓库改动。"),
				localize('scm.defaultViewSortKey.status', "按源代码管理状态排序仓库改动。")
			],
			description: localize('scm.defaultViewSortKey', "控制以列表查看时仓库改动的默认排序方式。"),
			default: 'path'
		},
		'scm.autoReveal': {
			type: 'boolean',
			description: localize('autoReveal', "控制打开文件时源代码管理视图是否自动展开并选中该文件。"),
			default: true
		},
		'scm.inputFontFamily': {
			type: 'string',
			markdownDescription: localize('inputFontFamily', "控制输入消息所使用的字体。`default` 表示使用工作台界面字体，`editor` 表示使用 `#editor.fontFamily#` 的值，也可以指定自定义字体。"),
			default: 'default'
		},
		'scm.inputFontSize': {
			type: 'number',
			markdownDescription: localize('inputFontSize', "控制输入框文字的字号（像素）。"),
			default: 13
		},
		'scm.inputMaxLineCount': {
			type: 'number',
			markdownDescription: localize('inputMaxLines', "控制输入框自动增高的最大行数。"),
			minimum: 1,
			maximum: 50,
			default: 10
		},
		'scm.inputMinLineCount': {
			type: 'number',
			markdownDescription: localize('inputMinLines', "控制输入框自动增高的起始行数。"),
			minimum: 1,
			maximum: 50,
			default: 1
		},
		'scm.alwaysShowRepositories': {
			type: 'boolean',
			markdownDescription: localize('alwaysShowRepository', "控制仓库是否始终显示在源代码管理视图中。"),
			default: false
		},
		'scm.repositories.sortOrder': {
			type: 'string',
			enum: ['discovery time', 'name', 'path'],
			enumDescriptions: [
				localize('scm.repositoriesSortOrder.discoveryTime', "\"代码仓库\"视图中的仓库按发现时间排序；\"源代码管理\"视图中的仓库按被选中的顺序排序。"),
				localize('scm.repositoriesSortOrder.name', "源代码管理仓库视图和源代码管理视图中的仓库按仓库名称排序。"),
				localize('scm.repositoriesSortOrder.path', "源代码管理仓库视图和源代码管理视图中的仓库按仓库路径排序。")
			],
			description: localize('repositoriesSortOrder', "控制源代码管理仓库视图中仓库的排序方式。"),
			default: 'discovery time'
		},
		'scm.repositories.visible': {
			type: 'number',
			description: localize('providersVisible', "控制源代码管理仓库区域中可见的仓库数量。设为 0 时可手动调整视图大小。"),
			default: 10
		},
		'scm.repositories.selectionMode': {
			type: 'string',
			enum: ['multiple', 'single'],
			enumDescriptions: [
				localize('scm.repositories.selectionMode.multiple', "可以同时选中多个仓库。"),
				localize('scm.repositories.selectionMode.single', "一次只能选中一个仓库。")
			],
			description: localize('scm.repositories.selectionMode', "控制源代码管理仓库视图中仓库的选择模式。"),
			default: 'multiple'
		},
		'scm.repositories.explorer': {
			type: 'boolean',
			markdownDescription: localize('scm.repositories.explorer', "控制是否在源代码管理仓库视图中显示仓库构建产物。此功能为实验性功能，仅当 {0} 设为 `{1}` 时生效。", '\`#scm.repositories.selectionMode#\`', 'single'),
			default: false,
			tags: ['experimental']
		},
		'scm.showActionButton': {
			type: 'boolean',
			markdownDescription: localize('showActionButton', "控制是否在源代码管理视图中显示操作按钮。"),
			default: true
		},
		'scm.showInputActionButton': {
			type: 'boolean',
			markdownDescription: localize('showInputActionButton', "控制是否在源代码管理输入框中显示操作按钮。"),
			default: true
		},
		'scm.workingSets.enabled': {
			type: 'boolean',
			description: localize('scm.workingSets.enabled', "控制切换源代码管理历史项分组时是否保存编辑器工作集。"),
			default: false
		},
		'scm.workingSets.default': {
			type: 'string',
			enum: ['empty', 'current'],
			enumDescriptions: [
				localize('scm.workingSets.default.empty', "切换到没有工作集的源代码管理历史项分组时，使用空工作集。"),
				localize('scm.workingSets.default.current', "切换到没有工作集的源代码管理历史项分组时，使用当前工作集。")
			],
			description: localize('scm.workingSets.default', "控制切换到没有工作集的源代码管理历史项分组时使用的默认工作集。"),
			default: 'current'
		},
		'scm.compactFolders': {
			type: 'boolean',
			description: localize('scm.compactFolders', "控制源代码管理视图是否以紧凑形式呈现文件夹。在这种形式下，仅含单个子项的文件夹会被压缩为一个合并的树元素。"),
			default: true
		},
		'scm.graph.pageOnScroll': {
			type: 'boolean',
			description: localize('scm.graph.pageOnScroll', "控制滚动到列表末尾时，源代码管理图视图是否加载下一页项目。"),
			default: true
		},
		'scm.graph.pageSize': {
			type: 'number',
			description: localize('scm.graph.pageSize', "源代码管理图视图默认显示以及加载更多时显示的项目数量。"),
			minimum: 1,
			maximum: 1000,
			default: 50
		},
		'scm.graph.badges': {
			type: 'string',
			enum: ['all', 'filter'],
			enumDescriptions: [
				localize('scm.graph.badges.all', "在源代码管理图视图中显示所有历史项分组的徽标。"),
				localize('scm.graph.badges.filter', "仅在源代码管理图视图中显示用作筛选条件的历史项分组徽标。")
			],
			description: localize('scm.graph.badges', "控制源代码管理图视图中显示哪些徽章。徽章显示在图的右侧，用于标明历史项分组的名称。"),
			default: 'filter'
		},
		'scm.graph.showIncomingChanges': {
			type: 'boolean',
			description: localize('scm.graph.showIncomingChanges', "控制是否在源代码管理图视图中显示传入的更改。"),
			default: true
		},
		'scm.graph.showOutgoingChanges': {
			type: 'boolean',
			description: localize('scm.graph.showOutgoingChanges', "控制是否在源代码管理图视图中显示传出的更改。"),
			default: true
		}
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'scm.acceptInput',
	metadata: { description: localize('scm accept', "源代码管理：接受输入"), args: [] },
	weight: KeybindingWeight.WorkbenchContrib,
	when: ContextKeyExpr.has('scmRepository'),
	primary: KeyMod.CtrlCmd | KeyCode.Enter,
	handler: accessor => {
		const contextKeyService = accessor.get(IContextKeyService);
		const context = contextKeyService.getContext(getActiveElement());
		const repositoryId = context.getValue<string | undefined>('scmRepository');

		if (!repositoryId) {
			return Promise.resolve(null);
		}

		const scmService = accessor.get(ISCMService);
		const repository = scmService.getRepository(repositoryId);

		if (!repository?.provider.acceptInputCommand) {
			return Promise.resolve(null);
		}

		const id = repository.provider.acceptInputCommand.id;
		const args = repository.provider.acceptInputCommand.arguments;
		const commandService = accessor.get(ICommandService);

		return commandService.executeCommand(id, ...(args || []));
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'scm.clearValidation',
	weight: KeybindingWeight.WorkbenchContrib,
	when: ContextKeyExpr.and(
		ContextKeyExpr.has('scmRepository'),
		SCMInputContextKeys.SCMInputHasValidationMessage),
	primary: KeyCode.Escape,
	handler: async (accessor) => {
		const scmViewService = accessor.get(ISCMViewService);
		scmViewService.activeRepository.get()?.repository.input.clearValidation();
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'scm.clearInput',
	weight: KeybindingWeight.WorkbenchContrib,
	when: ContextKeyExpr.and(
		ContextKeyExpr.has('scmRepository'),
		SuggestContext.Visible.toNegated(),
		InlineCompletionContextKeys.inlineSuggestionVisible.toNegated(),
		SCMInputContextKeys.SCMInputHasValidationMessage.toNegated(),
		EditorContextKeys.hasNonEmptySelection.toNegated()),
	primary: KeyCode.Escape,
	handler: async (accessor) => {
		const scmService = accessor.get(ISCMService);
		const contextKeyService = accessor.get(IContextKeyService);

		const context = contextKeyService.getContext(getActiveElement());
		const repositoryId = context.getValue<string | undefined>('scmRepository');
		const repository = repositoryId ? scmService.getRepository(repositoryId) : undefined;
		repository?.input.setValue('', true);
	}
});

const viewNextCommitCommand = {
	description: { description: localize('scm view next commit', "源代码管理：查看下一个提交"), args: [] },
	weight: KeybindingWeight.WorkbenchContrib,
	handler: (accessor: ServicesAccessor) => {
		const contextKeyService = accessor.get(IContextKeyService);
		const scmService = accessor.get(ISCMService);
		const context = contextKeyService.getContext(getActiveElement());
		const repositoryId = context.getValue<string | undefined>('scmRepository');
		const repository = repositoryId ? scmService.getRepository(repositoryId) : undefined;
		repository?.input.showNextHistoryValue();
	}
};

const viewPreviousCommitCommand = {
	description: { description: localize('scm view previous commit', "源代码管理：查看上一个提交"), args: [] },
	weight: KeybindingWeight.WorkbenchContrib,
	handler: (accessor: ServicesAccessor) => {
		const contextKeyService = accessor.get(IContextKeyService);
		const scmService = accessor.get(ISCMService);
		const context = contextKeyService.getContext(getActiveElement());
		const repositoryId = context.getValue<string | undefined>('scmRepository');
		const repository = repositoryId ? scmService.getRepository(repositoryId) : undefined;
		repository?.input.showPreviousHistoryValue();
	}
};

KeybindingsRegistry.registerCommandAndKeybindingRule({
	...viewNextCommitCommand,
	id: 'scm.viewNextCommit',
	when: ContextKeyExpr.and(ContextKeyExpr.has('scmRepository'), ContextKeyExpr.has('scmInputIsInLastPosition'), SuggestContext.Visible.toNegated()),
	primary: KeyCode.DownArrow
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	...viewPreviousCommitCommand,
	id: 'scm.viewPreviousCommit',
	when: ContextKeyExpr.and(ContextKeyExpr.has('scmRepository'), ContextKeyExpr.has('scmInputIsInFirstPosition'), SuggestContext.Visible.toNegated()),
	primary: KeyCode.UpArrow
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	...viewNextCommitCommand,
	id: 'scm.forceViewNextCommit',
	when: ContextKeyExpr.has('scmRepository'),
	primary: KeyMod.Alt | KeyCode.DownArrow
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	...viewPreviousCommitCommand,
	id: 'scm.forceViewPreviousCommit',
	when: ContextKeyExpr.has('scmRepository'),
	primary: KeyMod.Alt | KeyCode.UpArrow
});

CommandsRegistry.registerCommand('scm.openInIntegratedTerminal', async (accessor, ...providers: ISCMProvider[]) => {
	if (!providers || providers.length === 0) {
		return;
	}

	const commandService = accessor.get(ICommandService);
	const listService = accessor.get(IListService);

	let provider = providers.length === 1 ? providers[0] : undefined;

	if (!provider) {
		const list = listService.lastFocusedList;
		const element = list?.getHTMLElement();

		if (list instanceof WorkbenchList && element && isActiveElement(element)) {
			const [index] = list.getFocus();
			const focusedElement = list.element(index);

			// Source Control Repositories
			if (isSCMRepository(focusedElement)) {
				provider = focusedElement.provider;
			}
		}
	}

	if (!provider?.rootUri) {
		return;
	}

	await commandService.executeCommand('openInIntegratedTerminal', provider.rootUri);
});

CommandsRegistry.registerCommand('scm.openInTerminal', async (accessor, provider: ISCMProvider) => {
	if (!provider || !provider.rootUri) {
		return;
	}

	const commandService = accessor.get(ICommandService);
	await commandService.executeCommand('openInTerminal', provider.rootUri);
});

CommandsRegistry.registerCommand('scm.setActiveProvider', async (accessor) => {
	const instantiationService = accessor.get(IInstantiationService);
	const scmViewService = accessor.get(ISCMViewService);

	const placeHolder = localize('scmActiveRepositoryPlaceHolder', "选择活动仓库，输入内容可筛选所有仓库");
	const autoQuickItemDescription = localize('scmActiveRepositoryAutoDescription', "活动仓库会根据活动编辑器自动更新");
	const repositoryPicker = instantiationService.createInstance(RepositoryPicker, placeHolder, autoQuickItemDescription);

	const result = await repositoryPicker.pickRepository();
	if (result?.repository) {
		const repository = result.repository !== 'auto' ? result.repository : undefined;
		scmViewService.pinActiveRepository(repository);
	}
});

MenuRegistry.appendMenuItem(MenuId.SCMSourceControl, {
	group: '99_terminal',
	command: {
		id: 'scm.openInTerminal',
		title: localize('open in external terminal', "在外部终端中打开")
	},
	when: ContextKeyExpr.and(
		RemoteNameContext.isEqualTo(''),
		ContextKeyExpr.equals('scmProviderHasRootUri', true),
		ContextKeyExpr.or(
			ContextKeyExpr.equals('config.terminal.sourceControlRepositoriesKind', 'external'),
			ContextKeyExpr.equals('config.terminal.sourceControlRepositoriesKind', 'both')))
});

MenuRegistry.appendMenuItem(MenuId.SCMSourceControl, {
	group: '99_terminal',
	command: {
		id: 'scm.openInIntegratedTerminal',
		title: localize('open in integrated terminal', "在集成终端中打开")
	},
	when: ContextKeyExpr.and(
		ContextKeyExpr.equals('scmProviderHasRootUri', true),
		ContextKeyExpr.or(
			ContextKeyExpr.equals('config.terminal.sourceControlRepositoriesKind', 'integrated'),
			ContextKeyExpr.equals('config.terminal.sourceControlRepositoriesKind', 'both')))
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'workbench.scm.action.focusPreviousInput',
	weight: KeybindingWeight.WorkbenchContrib,
	when: ContextKeys.RepositoryVisibilityCount.notEqualsTo(0),
	handler: async accessor => {
		const viewsService = accessor.get(IViewsService);
		const scmView = await viewsService.openView<SCMViewPane>(VIEW_PANE_ID);
		if (scmView) {
			scmView.focusPreviousInput();
		}
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'workbench.scm.action.focusNextInput',
	weight: KeybindingWeight.WorkbenchContrib,
	when: ContextKeys.RepositoryVisibilityCount.notEqualsTo(0),
	handler: async accessor => {
		const viewsService = accessor.get(IViewsService);
		const scmView = await viewsService.openView<SCMViewPane>(VIEW_PANE_ID);
		if (scmView) {
			scmView.focusNextInput();
		}
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'workbench.scm.action.focusPreviousResourceGroup',
	weight: KeybindingWeight.WorkbenchContrib,
	handler: async accessor => {
		const viewsService = accessor.get(IViewsService);
		const scmView = await viewsService.openView<SCMViewPane>(VIEW_PANE_ID);
		if (scmView) {
			scmView.focusPreviousResourceGroup();
		}
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'workbench.scm.action.focusNextResourceGroup',
	weight: KeybindingWeight.WorkbenchContrib,
	handler: async accessor => {
		const viewsService = accessor.get(IViewsService);
		const scmView = await viewsService.openView<SCMViewPane>(VIEW_PANE_ID);
		if (scmView) {
			scmView.focusNextResourceGroup();
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'scm.editor.triggerSetup',
			title: localize('scmEditorResolveMergeConflict', "用 AI 解决冲突"),
			icon: Codicon.chatSparkle,
			f1: false,
			menu: {
				id: MenuId.EditorContent,
				when: ContextKeyExpr.and(
					ChatContextKeys.Setup.hidden.negate(),
					ChatContextKeys.Setup.disabledInWorkspace.negate(),
					ChatContextKeys.Setup.completed.negate(),
					ContextKeyExpr.in(ResourceContextKey.Resource.key, 'git.mergeChanges'),
					ContextKeyExpr.equals('git.activeResourceHasMergeConflicts', true)
				)
			}
		});
	}

	override async run(accessor: ServicesAccessor, ...args: unknown[]): Promise<void> {
		const commandService = accessor.get(ICommandService);

		const result = await commandService.executeCommand(CHAT_SETUP_SUPPORT_ANONYMOUS_ACTION_ID, { telemetrySource: 'scm' });
		if (!result) {
			return;
		}

		const command = product.defaultChatAgent?.resolveMergeConflictsCommand;
		if (!command) {
			return;
		}

		await commandService.executeCommand(command, ...args);
	}
});

AccessibleViewRegistry.register(new SCMAccessibilityHelp());
