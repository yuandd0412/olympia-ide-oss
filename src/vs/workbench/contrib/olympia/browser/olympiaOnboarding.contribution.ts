/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope } from '../../../../platform/storage/common/storage.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { OlympiaOnboarding } from './olympiaOnboarding.js';
import { OLYMPIA_START_PAGE_INTRO_ANIMATION_CONFIGURATION_KEY } from './olympiaWelcome.contribution.js';

/**
 * 首次启动时的「开始引导」入口。
 *
 * ## 为什么是 `WorkbenchPhase.BlockStartup`
 *
 * 因为**第一帧**要看到的就是极光，不是工作台。
 *
 * `BlockStartup` 对应 `LifecyclePhase.Starting`，而 `contributions.ts` 会在
 * `workbench.ts` 的 `startup()` 里**同步**实例化 Starting 与 Ready 两个阶段的贡献 ——
 * 那发生在 `renderWorkbench()`（创建各个 part）**之前**。
 *
 * 关键在于 `layout.ts` 的 `getContainerFromDocument()`：对主窗口它**直接返回
 * `this.mainContainer`**，并不要求这个容器已经在 document 里。所以这个 overlay
 * 可以在工作台还没成形的时候就挂进 `mainContainer`，等 `mainContainer` 被 append
 * 到 document 时它已经在那儿了 —— 首帧即极光，中间没有任何一次「工作台先亮一下
 * 再被盖住」。
 *
 * ## 首启标记什么时候读
 *
 * `desktop.main.ts` 里 `createStorageService()` 是 **await** 过
 * `storageService.initialize()` 才把 storage 注册进来的，工作台是在那之后才建的。
 * 所以在 `BlockStartup` 读 `StorageScope.PROFILE` 拿到的是**磁盘上的真值**，
 * 不是「还没加载完所以是 undefined」。
 */
class OlympiaOnboardingContribution extends Disposable {

	static readonly ID = 'olympia.contrib.onboarding';

	constructor(
		@IConfigurationService configurationService: IConfigurationService,
		@IStorageService storageService: IStorageService,
		@IWorkbenchEnvironmentService environmentService: IWorkbenchEnvironmentService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super();

		// `--skip-welcome` 明确表达了「别给我看欢迎页」，那也别给引导。
		if (environmentService.skipWelcome) {
			return;
		}

		// 开关走本产品自己的 `olympia.*` 命名空间，不碰上游 `workbench.startupEditor`。
		const enabled = configurationService.getValue<boolean>(OLYMPIA_START_PAGE_INTRO_ANIMATION_CONFIGURATION_KEY) ?? true;
		if (!enabled) {
			return;
		}

		// 首启一次性：看过就不再出现。
		if (storageService.getBoolean(OlympiaOnboarding.STORAGE_KEY, StorageScope.PROFILE)) {
			return;
		}

		this._register(instantiationService.createInstance(OlympiaOnboarding));
	}
}

registerWorkbenchContribution2(OlympiaOnboardingContribution.ID, OlympiaOnboardingContribution, WorkbenchPhase.BlockStartup);
