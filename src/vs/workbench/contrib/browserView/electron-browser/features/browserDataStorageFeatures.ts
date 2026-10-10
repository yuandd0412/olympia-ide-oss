/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../../nls.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { BrowserEditor, BrowserEditorContribution, BrowserActionCategory, BrowserActionGroup } from '../browserEditor.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { workbenchConfigurationNodeBase } from '../../../../common/configuration.js';
import { IBrowserViewModel, IBrowserViewWorkbenchService } from '../../common/browserView.js';
import { BrowserViewCommandId, BrowserViewStorageScope } from '../../../../../platform/browserView/common/browserView.js';
import { IContextKey, IContextKeyService, ContextKeyExpr, RawContextKey } from '../../../../../platform/contextkey/common/contextkey.js';
import { Action2, registerAction2, MenuId } from '../../../../../platform/actions/common/actions.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import type { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';

export const CONTEXT_BROWSER_STORAGE_SCOPE = new RawContextKey<string>('browserStorageScope', '', localize('browser.storageScope', "当前浏览器视图的存储作用域"));

class BrowserEditorStorageScopeContribution extends BrowserEditorContribution {
	private readonly _storageScopeContext: IContextKey<string>;

	constructor(
		editor: BrowserEditor,
		@IContextKeyService contextKeyService: IContextKeyService,
	) {
		super(editor);
		this._storageScopeContext = CONTEXT_BROWSER_STORAGE_SCOPE.bindTo(contextKeyService);
	}

	protected override onModelAttached(model: IBrowserViewModel, _store: DisposableStore): void {
		this._storageScopeContext.set(model.storageScope);
	}

	override onModelDetached(): void {
		this._storageScopeContext.reset();
	}
}

BrowserEditor.registerContribution(BrowserEditorStorageScopeContribution);

class ClearGlobalBrowserStorageAction extends Action2 {
	static readonly ID = BrowserViewCommandId.ClearGlobalStorage;

	constructor() {
		super({
			id: ClearGlobalBrowserStorageAction.ID,
			title: localize2('browser.clearGlobalStorageAction', "清除存储(全局)"),
			category: BrowserActionCategory,
			icon: Codicon.clearAll,
			f1: true,
			menu: {
				id: MenuId.BrowserActionsToolbar,
				group: BrowserActionGroup.Data,
				order: 20,
				when: ContextKeyExpr.equals(CONTEXT_BROWSER_STORAGE_SCOPE.key, BrowserViewStorageScope.Global),
				isHiddenByDefault: true,
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const browserViewWorkbenchService = accessor.get(IBrowserViewWorkbenchService);
		await browserViewWorkbenchService.clearGlobalStorage();
	}
}

class ClearWorkspaceBrowserStorageAction extends Action2 {
	static readonly ID = BrowserViewCommandId.ClearWorkspaceStorage;

	constructor() {
		super({
			id: ClearWorkspaceBrowserStorageAction.ID,
			title: localize2('browser.clearWorkspaceStorageAction', "清除存储(工作区)"),
			category: BrowserActionCategory,
			icon: Codicon.clearAll,
			f1: true,
			menu: {
				id: MenuId.BrowserActionsToolbar,
				group: BrowserActionGroup.Data,
				order: 20,
				when: ContextKeyExpr.equals(CONTEXT_BROWSER_STORAGE_SCOPE.key, BrowserViewStorageScope.Workspace),
				isHiddenByDefault: true,
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const browserViewWorkbenchService = accessor.get(IBrowserViewWorkbenchService);
		await browserViewWorkbenchService.clearWorkspaceStorage();
	}
}

class ClearEphemeralBrowserStorageAction extends Action2 {
	static readonly ID = BrowserViewCommandId.ClearEphemeralStorage;

	constructor() {
		super({
			id: ClearEphemeralBrowserStorageAction.ID,
			title: localize2('browser.clearEphemeralStorageAction', "清除存储(临时)"),
			category: BrowserActionCategory,
			icon: Codicon.clearAll,
			f1: true,
			precondition: ContextKeyExpr.equals(CONTEXT_BROWSER_STORAGE_SCOPE.key, BrowserViewStorageScope.Ephemeral),
			menu: {
				id: MenuId.BrowserActionsToolbar,
				group: BrowserActionGroup.Data,
				order: 20,
				when: ContextKeyExpr.equals(CONTEXT_BROWSER_STORAGE_SCOPE.key, BrowserViewStorageScope.Ephemeral),
				isHiddenByDefault: true,
			}
		});
	}

	async run(accessor: ServicesAccessor, browserEditor = accessor.get(IEditorService).activeEditorPane): Promise<void> {
		if (browserEditor instanceof BrowserEditor) {
			await browserEditor.model?.clearStorage();
		}
	}
}

class ClearAgentBrowserStorageAction extends Action2 {
	static readonly ID = BrowserViewCommandId.ClearAgentStorage;

	constructor() {
		super({
			id: ClearAgentBrowserStorageAction.ID,
			title: localize2('browser.clearAgentStorageAction', 'Clear Storage (Agent)'),
			category: BrowserActionCategory,
			icon: Codicon.clearAll,
			f1: true,
			precondition: ContextKeyExpr.equals(CONTEXT_BROWSER_STORAGE_SCOPE.key, BrowserViewStorageScope.Agent),
			menu: {
				id: MenuId.BrowserActionsToolbar,
				group: BrowserActionGroup.Data,
				order: 20,
				when: ContextKeyExpr.equals(CONTEXT_BROWSER_STORAGE_SCOPE.key, BrowserViewStorageScope.Agent),
				isHiddenByDefault: true,
			}
		});
	}

	async run(accessor: ServicesAccessor, browserEditor = accessor.get(IEditorService).activeEditorPane): Promise<void> {
		if (browserEditor instanceof BrowserEditor) {
			await browserEditor.model?.clearStorage();
		}
	}
}

registerAction2(ClearGlobalBrowserStorageAction);
registerAction2(ClearWorkspaceBrowserStorageAction);
registerAction2(ClearEphemeralBrowserStorageAction);
registerAction2(ClearAgentBrowserStorageAction);

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	...workbenchConfigurationNodeBase,
	properties: {
		'workbench.browser.dataStorage': {
			type: 'string',
			enum: [
				'default',
				BrowserViewStorageScope.Global,
				BrowserViewStorageScope.Workspace,
				BrowserViewStorageScope.Ephemeral,
				BrowserViewStorageScope.Agent
			],
			markdownEnumDescriptions: [
				localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'browser.dataStorage.default' }, "本地工作区使用 `global`，远程工作区使用 `workspace`。"),
				localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'browser.dataStorage.global' }, "所有浏览器视图在所有工作区中共享一个持久会话。与远程会话不兼容。"),
				localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'browser.dataStorage.workspace' }, "同一工作区内的浏览器视图共享持久会话。如果没有打开任何工作区，则使用 `ephemeral` 存储。"),
				localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'browser.dataStorage.ephemeral' }, "每个浏览器视图拥有独立会话，关闭时会清理该会话。"),
				localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'browser.dataStorage.agent' }, 'Browser views share one in-memory session that is cleaned up when the application is closed. This session is shared with agent-opened browser pages, so **all data including local storage and cookies will be accessible by agents.** When agent network filtering is enabled, requests from this session are restricted by the configured network domain policy.')
			],
			restricted: true,
			default: 'default',
			markdownDescription: localize(
				{ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'browser.dataStorage' },
				"控制浏览器数据(Cookie、缓存、存储)在浏览器视图之间的共享方式。\r\n\r\n**注意**: 在不受信任的工作区中，此设置会被忽略，始终使用 `ephemeral` 存储。"
			),
			scope: ConfigurationScope.WINDOW,
			order: 100
		}
	}
});
