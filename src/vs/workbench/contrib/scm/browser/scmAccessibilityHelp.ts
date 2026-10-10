/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { AccessibleViewType, AccessibleContentProvider, IAccessibleViewContentProvider, AccessibleViewProviderId } from '../../../../platform/accessibility/browser/accessibleView.js';
import { IAccessibleViewImplementation } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { FocusedViewContext, SidebarFocusContext } from '../../../common/contextkeys.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { AccessibilityVerbositySettingId } from '../../accessibility/browser/accessibilityConfiguration.js';
import { HISTORY_VIEW_PANE_ID, ISCMViewService, REPOSITORIES_VIEW_PANE_ID, VIEW_PANE_ID } from '../common/scm.js';

export class SCMAccessibilityHelp implements IAccessibleViewImplementation {
	readonly name = 'scm';
	readonly type = AccessibleViewType.Help;
	readonly priority = 100;
	readonly when = ContextKeyExpr.or(
		ContextKeyExpr.and(ContextKeyExpr.equals('activeViewlet', 'workbench.view.scm'), SidebarFocusContext),
		ContextKeyExpr.equals(FocusedViewContext.key, REPOSITORIES_VIEW_PANE_ID),
		ContextKeyExpr.equals(FocusedViewContext.key, VIEW_PANE_ID),
		ContextKeyExpr.equals(FocusedViewContext.key, HISTORY_VIEW_PANE_ID)
	);

	getProvider(accessor: ServicesAccessor): AccessibleContentProvider {
		const commandService = accessor.get(ICommandService);
		const scmViewService = accessor.get(ISCMViewService);
		const viewsService = accessor.get(IViewsService);

		return new SCMAccessibilityHelpContentProvider(commandService, scmViewService, viewsService);
	}
}

class SCMAccessibilityHelpContentProvider extends Disposable implements IAccessibleViewContentProvider {
	readonly id = AccessibleViewProviderId.SourceControl;
	readonly verbositySettingKey = AccessibilityVerbositySettingId.SourceControl;
	readonly options = { type: AccessibleViewType.Help };

	private _focusedView: string | undefined;

	constructor(
		@ICommandService private readonly _commandService: ICommandService,
		@ISCMViewService private readonly _scmViewService: ISCMViewService,
		@IViewsService private readonly _viewsService: IViewsService
	) {
		super();
		this._focusedView = this._viewsService.getFocusedViewName();
	}

	onClose(): void {
		switch (this._focusedView) {
			case 'Source Control':
				this._commandService.executeCommand('workbench.scm');
				break;
			case 'Source Control Repositories':
				this._commandService.executeCommand('workbench.scm.repositories');
				break;
			case 'Source Control Graph':
				this._commandService.executeCommand('workbench.scm.history');
				break;
			default:
				this._commandService.executeCommand('workbench.view.scm');
		}
	}

	provideContent(): string {
		const content: string[] = [];

		// Active Repository State
		if (this._scmViewService.visibleRepositories.length > 1) {
			const repositoryList = this._scmViewService.visibleRepositories.map(r => r.provider.name).join(', ');
			content.push(localize('state-msg1', "可见仓库：{0}", repositoryList));
		}

		const focusedRepository = this._scmViewService.focusedRepository;
		if (focusedRepository) {
			content.push(localize('state-msg2', "仓库：{0}", focusedRepository.provider.name));

			// History Item Reference
			const currentHistoryItemRef = focusedRepository.provider.historyProvider.get()?.historyItemRef.get();
			if (currentHistoryItemRef) {
				content.push(localize('state-msg3', "历史项引用：{0}", currentHistoryItemRef.name));
			}

			// Commit Message
			if (focusedRepository.input.visible && focusedRepository.input.enabled && focusedRepository.input.value !== '') {
				content.push(localize('state-msg4', "提交信息：{0}", focusedRepository.input.value));
			}

			// Action Button
			const actionButton = focusedRepository.provider.actionButton.get();
			if (actionButton) {
				const label = actionButton.command.tooltip ?? actionButton.command.title;
				const enablementLabel = actionButton.enabled ? localize('enabled', "已启用") : localize('disabled', "已禁用");
				content.push(localize('state-msg5', "操作按钮：{0}，{1}", label, enablementLabel));
			}

			// Resource Groups
			const resourceGroups: string[] = [];
			for (const resourceGroup of focusedRepository.provider.groups) {
				resourceGroups.push(`${resourceGroup.label} (${resourceGroup.resources.length} resource(s))`);
			}

			focusedRepository.provider.groups.map(g => g.label).join(', ');
			content.push(localize('state-msg6', "资源分组：{0}", resourceGroups.join(', ')));
		}

		// Source Control Repositories
		content.push(localize('scm-repositories-msg1', "使用「源代码管理：聚焦到源代码管理仓库视图」命令打开源代码管理仓库视图。"));
		content.push(localize('scm-repositories-msg2', "源代码管理仓库视图列出工作区中的所有仓库，仅在工作区包含多个仓库时显示。"));
		content.push(localize('scm-repositories-msg3', "打开源代码管理仓库视图后，你可以："));
		content.push(localize('scm-repositories-msg4', " - 使用上/下方向键在仓库列表中导航。"));
		content.push(localize('scm-repositories-msg5', " - 使用 Enter 或空格键选择仓库。"));
		content.push(localize('scm-repositories-msg6', " - 使用 Shift + 上/下方向键选择多个仓库。"));

		// Source Control
		content.push(localize('scm-msg1', "使用「源代码管理：聚焦到源代码管理视图」命令打开源代码管理视图。"));
		content.push(localize('scm-msg2', "“源代码管理”视图显示存储库的资源组和资源。如果工作区包含多个存储库，它将列出在“源代码管理存储库”视图中选择的存储库的资源组和资源。"));
		content.push(localize('scm-msg3', "打开源代码管理视图后，你可以："));
		content.push(localize('scm-msg4', " - 使用上/下方向键在仓库、资源组和资源列表中导航。"));
		content.push(localize('scm-msg5', " - 使用空格键展开或折叠资源组。"));

		// Source Control Graph
		content.push(localize('scm-graph-msg1', "使用「源代码管理：聚焦到源代码管理图视图」命令打开源代码管理图视图。"));
		content.push(localize('scm-graph-msg2', "源代码管理图视图以图的形式展示仓库的历史项。如果工作区包含多个仓库，则会列出活动仓库的历史项。"));
		content.push(localize('scm-graph-msg3', "打开源代码管理图视图后，你可以："));
		content.push(localize('scm-graph-msg4', " - 使用上/下方向键在历史项列表中导航。"));
		content.push(localize('scm-graph-msg5', " - 使用空格键在多文件差异编辑器中打开历史项详情。"));

		return content.join('\n');
	}
}
