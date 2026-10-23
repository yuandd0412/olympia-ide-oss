/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ConfigurationScope, Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { EditorExtensions } from '../../../common/editor.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { IEditorResolverService, RegisteredEditorPriority } from '../../../services/editor/common/editorResolverService.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { OlympiaWelcomeInput } from './olympiaWelcomeInput.js';
import { OlympiaWelcomePage } from './olympiaWelcomePage.js';

/**
 * 本产品自己的开始页开关。
 *
 * 为什么不复用上游 `workbench.startupEditor`：上游那个 enum 只有 7 个值，且
 * `registerConfiguration` 是按 property key 逐个写入的——往上游节点里塞新 key 会
 * 污染上游配置面板，同名 key 则直接**覆盖**上游定义。所以另开 `olympia.*` 命名空间，
 * 并且配置节点用独立 id `'olympia'`（上游 `workbenchConfigurationNodeBase` 的 id 是 `'workbench'`）。
 */
export const OLYMPIA_START_PAGE_CONFIGURATION_KEY = 'olympia.startPage';
export const OLYMPIA_START_PAGE_INTRO_ANIMATION_CONFIGURATION_KEY = 'olympia.startPage.showIntroAnimation';

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
	id: 'olympia',
	order: 6,
	title: localize('olympiaConfigurationTitle', "Olympia"),
	type: 'object',
	properties: {
		[OLYMPIA_START_PAGE_CONFIGURATION_KEY]: {
			scope: ConfigurationScope.RESOURCE,
			type: 'boolean',
			default: true,
			description: localize('olympia.startPage', "启动时打开 Olympia 开始页，替代 VS Code 欢迎页。")
		},
		[OLYMPIA_START_PAGE_INTRO_ANIMATION_CONFIGURATION_KEY]: {
			scope: ConfigurationScope.RESOURCE,
			type: 'boolean',
			default: true,
			description: localize('olympia.startPage.showIntroAnimation', "首次启动时播放 Olympia 开始引导：动态背景 + 卡片配置 + 无介绍的进入动画。关闭后直接进入开始页。")
		},
	}
});

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		OlympiaWelcomePage,
		OlympiaWelcomePage.ID,
		localize('olympiaWelcome', "Olympia 开始页")
	),
	[
		new SyncDescriptor(OlympiaWelcomeInput)
	]
);

class OlympiaWelcomeEditorResolverContribution extends Disposable {

	static readonly ID = 'olympia.contrib.welcomeEditorResolver';

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IEditorResolverService editorResolverService: IEditorResolverService
	) {
		super();

		// scheme 级认领，和上游 GettingStartedInput 同构，但用的是本产品自己的 scheme。
		//
		// pattern 写**字面量**而不是 `${OlympiaWelcomeInput.RESOURCE.scheme}:/**`：
		// 运行时两者等价，但字面量能被静态断言直接校验，也让 review 的人一眼看出认领的是哪个 scheme。
		// 代价是 scheme 在两个文件里各出现一次 —— 所以 `check-olympia-start-page.mjs` 有一条断言
		// 强制两处字面量必须一致，改了一处忘了另一处会直接红。
		this._register(editorResolverService.registerEditor(
			'olympia-welcome:/**',
			{
				id: OlympiaWelcomeInput.ID,
				label: localize('olympiaWelcomeDisplayName', "Olympia 开始页"),
				priority: RegisteredEditorPriority.builtin,
			},
			{
				singlePerResource: true,
				canSupportResource: uri => uri.scheme === OlympiaWelcomeInput.RESOURCE.scheme,
			},
			{
				createEditorInput: () => {
					return {
						editor: this.instantiationService.createInstance(OlympiaWelcomeInput),
						options: {
							pinned: false
						}
					};
				}
			}
		));
	}
}

registerWorkbenchContribution2(OlympiaWelcomeEditorResolverContribution.ID, OlympiaWelcomeEditorResolverContribution, WorkbenchPhase.BlockRestore);
