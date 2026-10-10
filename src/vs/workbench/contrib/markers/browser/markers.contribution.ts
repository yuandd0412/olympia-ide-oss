/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './markersFileDecorations.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { Extensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { KeybindingsRegistry, KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { localize, localize2 } from '../../../../nls.js';
import { Marker, RelatedInformation, ResourceMarkers } from './markersModel.js';
import { MarkersView } from './markersView.js';
import { MenuId, registerAction2, Action2 } from '../../../../platform/actions/common/actions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { MarkersViewMode, Markers, MarkersContextKeys } from '../common/markers.js';
import Messages from './messages.js';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IMarkersView } from './markers.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { Disposable, IDisposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { IStatusbarEntryAccessor, IStatusbarService, StatusbarAlignment, IStatusbarEntry } from '../../../services/statusbar/browser/statusbar.js';
import { IMarkerService, MarkerStatistics } from '../../../../platform/markers/common/markers.js';
import { ViewContainer, IViewContainersRegistry, Extensions as ViewContainerExtensions, ViewContainerLocation, IViewsRegistry, WindowEnablement } from '../../../common/views.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { getVisbileViewContextKey, FocusedViewContext } from '../../../common/contextkeys.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { ViewAction } from '../../../browser/parts/views/viewPane.js';
import { IActivityService, NumberBadge } from '../../../services/activity/common/activity.js';
import { viewFilterSubmenu } from '../../../browser/parts/views/viewFilter.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { problemsConfigurationNodeBase } from '../../../common/configuration.js';
import { MarkerChatContextContribution } from './markersChatContext.js';
import { AccessibleViewRegistry } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { ProblemsAccessibilityHelp } from './markersAccessibilityHelp.js';

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: Markers.MARKER_OPEN_ACTION_ID,
	weight: KeybindingWeight.WorkbenchContrib,
	when: ContextKeyExpr.and(MarkersContextKeys.MarkerFocusContextKey),
	primary: KeyCode.Enter,
	mac: {
		primary: KeyCode.Enter,
		secondary: [KeyMod.CtrlCmd | KeyCode.DownArrow]
	},
	handler: (accessor, args: any) => {
		const markersView = accessor.get(IViewsService).getActiveViewWithId<MarkersView>(Markers.MARKERS_VIEW_ID)!;
		markersView.openFileAtElement(markersView.getFocusElement(), false, false, true);
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: Markers.MARKER_OPEN_SIDE_ACTION_ID,
	weight: KeybindingWeight.WorkbenchContrib,
	when: ContextKeyExpr.and(MarkersContextKeys.MarkerFocusContextKey),
	primary: KeyMod.CtrlCmd | KeyCode.Enter,
	mac: {
		primary: KeyMod.WinCtrl | KeyCode.Enter
	},
	handler: (accessor, args: any) => {
		const markersView = accessor.get(IViewsService).getActiveViewWithId<MarkersView>(Markers.MARKERS_VIEW_ID)!;
		markersView.openFileAtElement(markersView.getFocusElement(), false, true, true);
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: Markers.MARKER_SHOW_PANEL_ID,
	weight: KeybindingWeight.WorkbenchContrib,
	when: undefined,
	primary: undefined,
	handler: async (accessor, args: any) => {
		await accessor.get(IViewsService).openView(Markers.MARKERS_VIEW_ID);
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: Markers.MARKER_SHOW_QUICK_FIX,
	weight: KeybindingWeight.WorkbenchContrib,
	when: MarkersContextKeys.MarkerFocusContextKey,
	primary: KeyMod.CtrlCmd | KeyCode.Period,
	handler: (accessor, args: any) => {
		const markersView = accessor.get(IViewsService).getActiveViewWithId<MarkersView>(Markers.MARKERS_VIEW_ID)!;
		const focusedElement = markersView.getFocusElement();
		if (focusedElement instanceof Marker) {
			markersView.showQuickFixes(focusedElement);
		}
	}
});

// configuration
Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerConfiguration({
	...problemsConfigurationNodeBase,
	'properties': {
		'problems.autoReveal': {
			'description': Messages.PROBLEMS_PANEL_CONFIGURATION_AUTO_REVEAL,
			'type': 'boolean',
			'default': true
		},
		'problems.defaultViewMode': {
			'description': Messages.PROBLEMS_PANEL_CONFIGURATION_VIEW_MODE,
			'type': 'string',
			'default': 'tree',
			'enum': ['table', 'tree'],
		},
		'problems.showCurrentInStatus': {
			'description': Messages.PROBLEMS_PANEL_CONFIGURATION_SHOW_CURRENT_STATUS,
			'type': 'boolean',
			'default': false
		},
		'problems.sortOrder': {
			'description': Messages.PROBLEMS_PANEL_CONFIGURATION_COMPARE_ORDER,
			'type': 'string',
			'default': 'severity',
			'enum': ['severity', 'position'],
			'enumDescriptions': [
				Messages.PROBLEMS_PANEL_CONFIGURATION_COMPARE_ORDER_SEVERITY,
				Messages.PROBLEMS_PANEL_CONFIGURATION_COMPARE_ORDER_POSITION,
			],
		},
	}
});

const markersViewIcon = registerIcon('markers-view-icon', Codicon.warning, localize('markersViewIcon', "查看标记视图的图标。"));

// markers view container
const VIEW_CONTAINER: ViewContainer = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
	id: Markers.MARKERS_CONTAINER_ID,
	title: Messages.MARKERS_PANEL_TITLE_PROBLEMS,
	icon: markersViewIcon,
	hideIfEmpty: true,
	order: 0,
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [Markers.MARKERS_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
	storageId: Markers.MARKERS_VIEW_STORAGE_ID,
	windowEnablement: WindowEnablement.Both
}, ViewContainerLocation.Panel, { doNotRegisterOpenCommand: true });

Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews([{
	id: Markers.MARKERS_VIEW_ID,
	containerIcon: markersViewIcon,
	name: Messages.MARKERS_PANEL_TITLE_PROBLEMS,
	canToggleVisibility: true,
	canMoveView: true,
	ctorDescriptor: new SyncDescriptor(MarkersView),
	openCommandActionDescriptor: {
		id: 'workbench.actions.view.problems',
		mnemonicTitle: localize({ key: 'miMarker', comment: ['&& denotes a mnemonic'] }, "问题(&&P)"),
		keybindings: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyM },
		order: 0,
	},
	windowEnablement: WindowEnablement.Both
}], VIEW_CONTAINER);

// workbench
const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);

// actions
registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: `workbench.actions.table.${Markers.MARKERS_VIEW_ID}.viewAsTree`,
			title: localize('viewAsTree', "以树状显示"),
			metadata: {
				description: localize2('viewAsTreeDescription', "以树状图显示问题视图。")
			},
			menu: {
				id: MenuId.ViewTitle,
				when: ContextKeyExpr.and(ContextKeyExpr.equals('view', Markers.MARKERS_VIEW_ID), MarkersContextKeys.MarkersViewModeContextKey.isEqualTo(MarkersViewMode.Table)),
				group: 'navigation',
				order: 3
			},
			icon: Codicon.listTree,
			viewId: Markers.MARKERS_VIEW_ID
		});
	}

	async runInView(serviceAccessor: ServicesAccessor, view: IMarkersView): Promise<void> {
		view.setViewMode(MarkersViewMode.Tree);
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: `workbench.actions.table.${Markers.MARKERS_VIEW_ID}.viewAsTable`,
			title: localize('viewAsTable', "以表格视图显示"),
			metadata: {
				description: localize2('viewAsTableDescription', "以表格显示问题视图。")
			},
			menu: {
				id: MenuId.ViewTitle,
				when: ContextKeyExpr.and(ContextKeyExpr.equals('view', Markers.MARKERS_VIEW_ID), MarkersContextKeys.MarkersViewModeContextKey.isEqualTo(MarkersViewMode.Tree)),
				group: 'navigation',
				order: 3
			},
			icon: Codicon.listFlat,
			viewId: Markers.MARKERS_VIEW_ID
		});
	}

	async runInView(serviceAccessor: ServicesAccessor, view: IMarkersView): Promise<void> {
		view.setViewMode(MarkersViewMode.Table);
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: `workbench.actions.${Markers.MARKERS_VIEW_ID}.toggleErrors`,
			title: localize('show errors', "显示错误"),
			metadata: {
				description: localize2('toggleErrorsDescription', "在问题视图中显示或隐藏错误。")
			},
			category: localize('problems', "问题"),
			toggled: MarkersContextKeys.ShowErrorsFilterContextKey,
			menu: {
				id: viewFilterSubmenu,
				group: '1_filter',
				when: ContextKeyExpr.equals('view', Markers.MARKERS_VIEW_ID),
				order: 1
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}

	async runInView(serviceAccessor: ServicesAccessor, view: IMarkersView): Promise<void> {
		view.filters.showErrors = !view.filters.showErrors;
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: `workbench.actions.${Markers.MARKERS_VIEW_ID}.toggleWarnings`,
			title: localize('show warnings', "显示警告"),
			metadata: {
				description: localize2('toggleWarningsDescription', "在问题视图中显示或隐藏警告。")
			},
			category: localize('problems', "问题"),
			toggled: MarkersContextKeys.ShowWarningsFilterContextKey,
			menu: {
				id: viewFilterSubmenu,
				group: '1_filter',
				when: ContextKeyExpr.equals('view', Markers.MARKERS_VIEW_ID),
				order: 2
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}

	async runInView(serviceAccessor: ServicesAccessor, view: IMarkersView): Promise<void> {
		view.filters.showWarnings = !view.filters.showWarnings;
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: `workbench.actions.${Markers.MARKERS_VIEW_ID}.toggleInfos`,
			title: localize('show infos', "显示提示信息"),
			category: localize('problems', "问题"),
			toggled: MarkersContextKeys.ShowInfoFilterContextKey,
			metadata: {
				description: localize2('toggleInfosDescription', "在问题视图中显示或隐藏提示信息。")
			},
			menu: {
				id: viewFilterSubmenu,
				group: '1_filter',
				when: ContextKeyExpr.equals('view', Markers.MARKERS_VIEW_ID),
				order: 3
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}

	async runInView(serviceAccessor: ServicesAccessor, view: IMarkersView): Promise<void> {
		view.filters.showInfos = !view.filters.showInfos;
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: `workbench.actions.${Markers.MARKERS_VIEW_ID}.toggleActiveFile`,
			title: localize('show active file', "仅显示活动文件"),
			metadata: {
				description: localize2('toggleActiveFileDescription', "在问题视图中仅显示来自活动文件的问题（错误、警告、提示信息）。")
			},
			category: localize('problems', "问题"),
			toggled: MarkersContextKeys.ShowActiveFileFilterContextKey,
			menu: {
				id: viewFilterSubmenu,
				group: '2_filter',
				when: ContextKeyExpr.equals('view', Markers.MARKERS_VIEW_ID),
				order: 1
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}

	async runInView(serviceAccessor: ServicesAccessor, view: IMarkersView): Promise<void> {
		view.filters.activeFile = !view.filters.activeFile;
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: `workbench.actions.${Markers.MARKERS_VIEW_ID}.toggleExcludedFiles`,
			title: localize('show excluded files', "显示已排除的文件"),
			metadata: {
				description: localize2('toggleExcludedFilesDescription', "在问题视图中显示或隐藏已排除的文件。")
			},
			category: localize('problems', "问题"),
			toggled: MarkersContextKeys.ShowExcludedFilesFilterContextKey.negate(),
			menu: {
				id: viewFilterSubmenu,
				group: '2_filter',
				when: ContextKeyExpr.equals('view', Markers.MARKERS_VIEW_ID),
				order: 2
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}

	async runInView(serviceAccessor: ServicesAccessor, view: IMarkersView): Promise<void> {
		view.filters.excludedFiles = !view.filters.excludedFiles;
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.problems.focus',
			title: Messages.MARKERS_PANEL_SHOW_LABEL,
			category: Categories.View,
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		accessor.get(IViewsService).openView(Markers.MARKERS_VIEW_ID, true);
	}
});

abstract class MarkersViewAction extends ViewAction<IMarkersView> {

	protected getSelectedMarkers(markersView: IMarkersView): Marker[] {
		const selection = markersView.getFocusedSelectedElements() || markersView.getAllResourceMarkers();
		const markers: Marker[] = [];
		const addMarker = (marker: Marker) => {
			if (!markers.includes(marker)) {
				markers.push(marker);
			}
		};
		for (const selected of selection) {
			if (selected instanceof ResourceMarkers) {
				selected.markers.forEach(addMarker);
			} else if (selected instanceof Marker) {
				addMarker(selected);
			}
		}
		return markers;
	}
}

registerAction2(class extends MarkersViewAction {
	constructor() {
		const when = ContextKeyExpr.and(FocusedViewContext.isEqualTo(Markers.MARKERS_VIEW_ID), MarkersContextKeys.MarkersTreeVisibilityContextKey, MarkersContextKeys.RelatedInformationFocusContextKey.toNegated());
		super({
			id: Markers.MARKER_COPY_ACTION_ID,
			title: localize2('copyMarker', "复制"),
			menu: {
				id: MenuId.ProblemsPanelContext,
				when,
				group: 'navigation'
			},
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyCode.KeyC,
				when
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}
	async runInView(serviceAccessor: ServicesAccessor, markersView: IMarkersView): Promise<void> {
		const clipboardService = serviceAccessor.get(IClipboardService);
		const markers = this.getSelectedMarkers(markersView);
		if (markers.length) {
			await clipboardService.writeText(`[${markers}]`);
		}
	}
});

registerAction2(class extends MarkersViewAction {
	constructor() {
		super({
			id: Markers.MARKER_COPY_MESSAGE_ACTION_ID,
			title: localize2('copyMessage', "复制消息"),
			menu: {
				id: MenuId.ProblemsPanelContext,
				when: MarkersContextKeys.MarkerFocusContextKey,
				group: 'navigation'
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}
	async runInView(serviceAccessor: ServicesAccessor, markersView: IMarkersView): Promise<void> {
		const clipboardService = serviceAccessor.get(IClipboardService);

		const markers = this.getSelectedMarkers(markersView);
		if (markers.length) {
			await clipboardService.writeText(markers.map(m => m.marker.message).join('\n'));
		}
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: Markers.RELATED_INFORMATION_COPY_MESSAGE_ACTION_ID,
			title: localize2('copyMessage', "复制消息"),
			menu: {
				id: MenuId.ProblemsPanelContext,
				when: MarkersContextKeys.RelatedInformationFocusContextKey,
				group: 'navigation'
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}
	async runInView(serviceAccessor: ServicesAccessor, markersView: IMarkersView): Promise<void> {
		const clipboardService = serviceAccessor.get(IClipboardService);
		const element = markersView.getFocusElement();
		if (element instanceof RelatedInformation) {
			await clipboardService.writeText(element.raw.message);
		}
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: Markers.FOCUS_PROBLEMS_FROM_FILTER,
			title: localize('focusProblemsList', "聚焦到问题视图"),
			keybinding: {
				when: MarkersContextKeys.MarkerViewFilterFocusContextKey,
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyCode.DownArrow
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}
	async runInView(serviceAccessor: ServicesAccessor, markersView: IMarkersView): Promise<void> {
		markersView.focus();
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: Markers.MARKERS_VIEW_FOCUS_FILTER,
			title: localize('focusProblemsFilter', "聚焦到问题筛选框"),
			keybinding: {
				when: FocusedViewContext.isEqualTo(Markers.MARKERS_VIEW_ID),
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyCode.KeyF
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}
	async runInView(serviceAccessor: ServicesAccessor, markersView: IMarkersView): Promise<void> {
		markersView.focusFilter();
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: Markers.MARKERS_VIEW_SHOW_MULTILINE_MESSAGE,
			title: localize2('show multiline', "以多行显示消息"),
			category: localize('problems', "问题"),
			menu: {
				id: MenuId.CommandPalette,
				when: ContextKeyExpr.has(getVisbileViewContextKey(Markers.MARKERS_VIEW_ID))
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}
	async runInView(serviceAccessor: ServicesAccessor, markersView: IMarkersView): Promise<void> {
		markersView.setMultiline(true);
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: Markers.MARKERS_VIEW_SHOW_SINGLELINE_MESSAGE,
			title: localize2('show singleline', "以单行显示消息"),
			category: localize('problems', "问题"),
			menu: {
				id: MenuId.CommandPalette,
				when: ContextKeyExpr.has(getVisbileViewContextKey(Markers.MARKERS_VIEW_ID))
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}
	async runInView(serviceAccessor: ServicesAccessor, markersView: IMarkersView): Promise<void> {
		markersView.setMultiline(false);
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: Markers.MARKERS_VIEW_CLEAR_FILTER_TEXT,
			title: localize('clearFiltersText', "清除筛选文本"),
			category: localize('problems', "问题"),
			keybinding: {
				when: MarkersContextKeys.MarkerViewFilterFocusContextKey,
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyCode.Escape
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}
	async runInView(serviceAccessor: ServicesAccessor, markersView: IMarkersView): Promise<void> {
		markersView.clearFilterText();
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: `workbench.actions.treeView.${Markers.MARKERS_VIEW_ID}.collapseAll`,
			title: localize('collapseAll', "全部折叠"),
			menu: {
				id: MenuId.ViewTitle,
				when: ContextKeyExpr.and(ContextKeyExpr.equals('view', Markers.MARKERS_VIEW_ID), MarkersContextKeys.MarkersViewModeContextKey.isEqualTo(MarkersViewMode.Tree)),
				group: 'navigation',
				order: 2,
			},
			icon: Codicon.collapseAll,
			viewId: Markers.MARKERS_VIEW_ID
		});
	}
	async runInView(serviceAccessor: ServicesAccessor, view: IMarkersView): Promise<void> {
		return view.collapseAll();
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: Markers.TOGGLE_MARKERS_VIEW_ACTION_ID,
			title: Messages.MARKERS_PANEL_TOGGLE_LABEL,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		if (viewsService.isViewVisible(Markers.MARKERS_VIEW_ID)) {
			viewsService.closeView(Markers.MARKERS_VIEW_ID);
		} else {
			viewsService.openView(Markers.MARKERS_VIEW_ID, true);
		}
	}
});

class MarkersStatusBarContributions extends Disposable implements IWorkbenchContribution {

	private markersStatusItem: IStatusbarEntryAccessor;
	private markersStatusItemOff: IStatusbarEntryAccessor | undefined;

	constructor(
		@IMarkerService private readonly markerService: IMarkerService,
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		super();
		this.markersStatusItem = this._register(this.statusbarService.addEntry(this.getMarkersItem(), 'status.problems', StatusbarAlignment.LEFT, 50 /* Medium Priority */));

		const addStatusBarEntry = () => {
			this.markersStatusItemOff = this.statusbarService.addEntry(this.getMarkersItemTurnedOff(), 'status.problemsVisibility', StatusbarAlignment.LEFT, 49);
		};

		// Add the status bar entry if the problems is not visible
		let config = this.configurationService.getValue('problems.visibility');
		if (!config) {
			addStatusBarEntry();
		}

		this._register(this.markerService.onMarkerChanged(() => {
			this.markersStatusItem.update(this.getMarkersItem());
		}));

		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('problems.visibility')) {
				this.markersStatusItem.update(this.getMarkersItem());

				// Update based on what setting was changed to.
				config = this.configurationService.getValue('problems.visibility');
				if (!config && !this.markersStatusItemOff) {
					addStatusBarEntry();
				} else if (config && this.markersStatusItemOff) {
					this.markersStatusItemOff.dispose();
					this.markersStatusItemOff = undefined;
				}
			}
		}));
	}

	private getMarkersItem(): IStatusbarEntry {
		const markersStatistics = this.markerService.getStatistics();
		const tooltip = this.getMarkersTooltip(markersStatistics);
		return {
			name: localize('status.problems', "问题"),
			text: this.getMarkersText(markersStatistics),
			ariaLabel: tooltip,
			tooltip,
			command: 'workbench.actions.view.toggleProblems'
		};
	}

	private getMarkersItemTurnedOff(): IStatusbarEntry {
		// Update to true, config checked before `getMarkersItemTurnedOff` is called.
		this.statusbarService.updateEntryVisibility('status.problemsVisibility', true);
		const openSettingsCommand = 'workbench.action.openSettings';
		const configureSettingsLabel = '@id:problems.visibility';
		const tooltip = localize('status.problemsVisibilityOff', "问题检测已关闭。点击以打开设置。");
		return {
			name: localize('status.problemsVisibility', "问题可见性"),
			text: '$(whole-word)',
			ariaLabel: tooltip,
			tooltip,
			kind: 'warning',
			command: { title: openSettingsCommand, arguments: [configureSettingsLabel], id: openSettingsCommand }
		};
	}

	private getMarkersTooltip(stats: MarkerStatistics): string {
		const errorTitle = (n: number) => localize('totalErrors', "错误：{0}", n);
		const warningTitle = (n: number) => localize('totalWarnings', "警告：{0}", n);
		const infoTitle = (n: number) => localize('totalInfos', "提示信息：{0}", n);

		const titles: string[] = [];

		if (stats.errors > 0) {
			titles.push(errorTitle(stats.errors));
		}

		if (stats.warnings > 0) {
			titles.push(warningTitle(stats.warnings));
		}

		if (stats.infos > 0) {
			titles.push(infoTitle(stats.infos));
		}

		if (titles.length === 0) {
			return localize('noProblems', "没有问题");
		}

		return titles.join(', ');
	}

	private getMarkersText(stats: MarkerStatistics): string {
		const problemsText: string[] = [];

		// Errors
		problemsText.push('$(error) ' + this.packNumber(stats.errors));

		// Warnings
		problemsText.push('$(warning) ' + this.packNumber(stats.warnings));

		// Info (only if any)
		if (stats.infos > 0) {
			problemsText.push('$(info) ' + this.packNumber(stats.infos));
		}

		return problemsText.join(' ');
	}

	private packNumber(n: number): string {
		const manyProblems = localize('manyProblems', "1 万+");
		return n > 9999 ? manyProblems : n > 999 ? n.toString().charAt(0) + 'K' : n.toString();
	}
}

workbenchRegistry.registerWorkbenchContribution(MarkersStatusBarContributions, LifecyclePhase.Restored);

registerWorkbenchContribution2(MarkerChatContextContribution.ID, MarkerChatContextContribution, WorkbenchPhase.AfterRestored);

class ActivityUpdater extends Disposable implements IWorkbenchContribution {

	private readonly activity = this._register(new MutableDisposable<IDisposable>());

	constructor(
		@IActivityService private readonly activityService: IActivityService,
		@IMarkerService private readonly markerService: IMarkerService
	) {
		super();
		this._register(this.markerService.onMarkerChanged(() => this.updateBadge()));
		this.updateBadge();
	}

	private updateBadge(): void {
		const { errors, warnings, infos } = this.markerService.getStatistics();
		const total = errors + warnings + infos;
		if (total > 0) {
			const message = localize('totalProblems', "总计 {0} 个问题", total);
			this.activity.value = this.activityService.showViewActivity(Markers.MARKERS_VIEW_ID, { badge: new NumberBadge(total, () => message) });
		} else {
			this.activity.value = undefined;
		}
	}
}

workbenchRegistry.registerWorkbenchContribution(ActivityUpdater, LifecyclePhase.Restored);

// Register Accessible View Help
AccessibleViewRegistry.register(new ProblemsAccessibilityHelp());
