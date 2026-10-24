/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { EditorExtensions } from '../../../common/editor.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IEditorResolverService, RegisteredEditorPriority } from '../../../services/editor/common/editorResolverService.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { OlympiaSettingsInput } from './olympiaSettingsInput.js';
import { OlympiaSettingsPage } from './olympiaSettingsPage.js';
import { OLYMPIA_SETTINGS_COMMAND_ID } from './olympiaSettingsSchema.js';

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		OlympiaSettingsPage,
		OlympiaSettingsPage.ID,
		localize('olympiaSettings', "Olympia 设置")
	),
	[
		new SyncDescriptor(OlympiaSettingsInput)
	]
);

/**
 * 打开 Olympia 简化设置页。
 *
 * 这是 `workbench.action.openSettings` 被劫持后的落点 —— 判据在
 * `olympiaSettingsInterceptor.ts` 里（那是个零 import 的纯函数模块，
 * 上游 `preferences.contribution.ts` 直接用它）。
 */
CommandsRegistry.registerCommand({
	id: OLYMPIA_SETTINGS_COMMAND_ID,
	handler: async (accessor: ServicesAccessor) => {
		const instantiationService = accessor.get(IInstantiationService);
		const editorService = accessor.get(IEditorService);
		const input = instantiationService.createInstance(OlympiaSettingsInput);
		await editorService.openEditor(input, { pinned: true });
	}
});

class OlympiaSettingsEditorResolverContribution extends Disposable {

	static readonly ID = 'olympia.contrib.settingsEditorResolver';

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IEditorResolverService editorResolverService: IEditorResolverService
	) {
		super();

		// pattern 写**字面量**而不是 `${OlympiaSettingsInput.RESOURCE.scheme}:/**`：
		// 运行时两者等价，但字面量能被静态断言直接校验，也让 review 的人一眼看出认领的是哪个 scheme。
		// 代价是 scheme 在两个文件里各出现一次 —— 所以 `check-olympia-settings-page.mjs` 有一条断言
		// 强制两处字面量必须一致，改了一处忘了另一处会直接红。
		this._register(editorResolverService.registerEditor(
			'olympia-settings:/**',
			{
				id: OlympiaSettingsInput.ID,
				label: localize('olympiaSettingsDisplayName', "Olympia 设置"),
				priority: RegisteredEditorPriority.builtin,
			},
			{
				singlePerResource: true,
				canSupportResource: uri => uri.scheme === OlympiaSettingsInput.RESOURCE.scheme,
			},
			{
				createEditorInput: () => {
					return {
						editor: this.instantiationService.createInstance(OlympiaSettingsInput),
						options: {
							pinned: true
						}
					};
				}
			}
		));
	}
}

registerWorkbenchContribution2(OlympiaSettingsEditorResolverContribution.ID, OlympiaSettingsEditorResolverContribution, WorkbenchPhase.BlockRestore);
