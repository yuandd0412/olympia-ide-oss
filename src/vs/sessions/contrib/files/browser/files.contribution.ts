/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../../workbench/common/contributions.js';
import { IViewContainersRegistry, IViewsRegistry, ViewContainerLocation, Extensions as ViewContainerExtensions, WindowEnablement } from '../../../../workbench/common/views.js';
import { ExplorerView } from '../../../../workbench/contrib/files/browser/views/explorerView.js';
import { ViewPaneContainer } from '../../../../workbench/browser/parts/views/viewPaneContainer.js';
import { IViewsService } from '../../../../workbench/services/views/common/viewsService.js';
import { WorkspaceFolderCountContext } from '../../../../workbench/common/contextkeys.js';
import { SESSIONS_FILES_EMPTY_VIEW_ID, SESSIONS_FILES_VIEW_ID, SessionsExplorerEmptyView, SessionsExplorerView } from './filesView.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { IsPhoneLayoutContext, IsQuickChatSessionContext, SessionHasWorkspaceContext, SinglePaneLayoutEnabledContext } from '../../../common/contextkeys.js';

export const SESSIONS_FILES_CONTAINER_ID = 'workbench.sessions.auxiliaryBar.filesContainer';

const filesViewIcon = registerIcon('sessions-files-view-icon', Codicon.files, localize2('sessionsFilesViewIcon', "在会话窗口中查看文件视图的图标。").value);

const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);

// Files view container
const filesViewContainer = viewContainerRegistry.registerViewContainer({
	id: SESSIONS_FILES_CONTAINER_ID,
	title: localize2('files', "文件"),
	icon: filesViewIcon,
	order: 11,
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [SESSIONS_FILES_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
	storageId: SESSIONS_FILES_CONTAINER_ID,
	hideIfEmpty: true,
	openCommandActionDescriptor: {
		id: SESSIONS_FILES_CONTAINER_ID,
		title: localize2('explore', "资源管理器"),
		mnemonicTitle: localize({ key: 'miFiles', comment: ['&& denotes a mnemonic'] }, "文件(&&E)"),
		keybindings: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyE },
		order: 0
	},
	windowEnablement: WindowEnablement.Sessions,
}, ViewContainerLocation.AuxiliaryBar, { isDefault: true });

export class RegisterFilesViewContribution implements IWorkbenchContribution {

	static readonly ID = 'sessions.registerFilesView';

	constructor() {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry);

		// Re-register the explorer view inside the new Files container
		viewsRegistry.registerViews([{
			id: SESSIONS_FILES_VIEW_ID,
			name: localize2('files', "文件"),
			containerIcon: filesViewIcon,
			ctorDescriptor: new SyncDescriptor(SessionsExplorerView),
			canToggleVisibility: false,
			canMoveView: false,
			when: ContextKeyExpr.and(WorkspaceFolderCountContext.notEqualsTo('0'), IsPhoneLayoutContext.negate(), SessionHasWorkspaceContext),
			windowEnablement: WindowEnablement.Sessions,
		}], filesViewContainer);

		// Register an empty view to show when there are no workspace folders
		viewsRegistry.registerViews([{
			id: SESSIONS_FILES_EMPTY_VIEW_ID,
			name: localize2('files', "文件"),
			containerIcon: filesViewIcon,
			ctorDescriptor: new SyncDescriptor(SessionsExplorerEmptyView),
			canToggleVisibility: false,
			canMoveView: false,
			when: ContextKeyExpr.and(
				IsPhoneLayoutContext.negate(),
				ContextKeyExpr.or(
					ContextKeyExpr.and(WorkspaceFolderCountContext.isEqualTo('0'), SessionHasWorkspaceContext),
					ContextKeyExpr.and(SinglePaneLayoutEnabledContext, IsQuickChatSessionContext),
				),
			),
			windowEnablement: WindowEnablement.Sessions,
		}], filesViewContainer);
	}
}

registerWorkbenchContribution2(RegisterFilesViewContribution.ID, RegisterFilesViewContribution, WorkbenchPhase.BlockStartup);

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'sessions.files.action.collapseExplorerFolders',
			title: localize2('collapseExplorerFolders', "折叠资源管理器中的文件夹"),
			icon: Codicon.collapseAll,
			menu: {
				id: MenuId.ViewTitle,
				group: '1_files',
				order: 10,
				when: ContextKeyExpr.equals('view', SESSIONS_FILES_VIEW_ID),
			},
		});
	}

	run(accessor: ServicesAccessor) {
		const viewsService = accessor.get(IViewsService);
		const view = viewsService.getViewWithId(SESSIONS_FILES_VIEW_ID);
		if (view !== null) {
			(view as ExplorerView).collapseAll();
		}
	}
});
