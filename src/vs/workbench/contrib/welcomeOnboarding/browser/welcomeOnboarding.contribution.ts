/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Load styles for the remaining onboarding variant.
import './media/variationA.css';

import { localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IOnboardingService } from '../common/onboardingService.js';
import { OnboardingVariationA } from './onboardingVariationA.js';

registerSingleton(IOnboardingService, OnboardingVariationA, InstantiationType.Delayed);

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.welcomeOnboarding2026',
			// 标题里不带「2026」——那是上游给这版引导起的实验代号，学生不需要认识它。
			// 类目从 Developer 摘掉：本产品把 Developer 整组从命令面板里藏了，挂着它
			// 就等于只有自动弹出那一次机会，看完想再来一遍的人没有任何入口。
			title: localize2('welcomeOnboarding2026', "Olympia：首次启动引导"),
			f1: true,
		});
	}

	run(accessor: ServicesAccessor): void {
		const onboardingService = accessor.get(IOnboardingService);
		onboardingService.show();
	}
});
