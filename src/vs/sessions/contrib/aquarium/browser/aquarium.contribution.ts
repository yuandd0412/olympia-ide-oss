/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/aquarium.css';
import { localize, localize2 } from '../../../../nls.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { AquariumService, IAquariumService, SESSIONS_DEVELOPER_JOY_ENABLED_SETTING } from './aquariumOverlay.js';

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'sessions',
	properties: {
		[SESSIONS_DEVELOPER_JOY_ENABLED_SETTING]: {
			type: 'boolean',
			default: true,
			description: localize('sessions.developerJoy.enabled', "向智能体窗口添加隐藏彩蛋。"),
			tags: ['experimental'],
		},
	},
});

registerSingleton(IAquariumService, AquariumService, InstantiationType.Delayed);

/**
 * Developer/demo command to fake a fish-feeding streak without waiting days or
 * feeding fish by hand. Lets you pick an alive streak, a died (revivable)
 * streak, or clear it, and updates the toggle tooltip live.
 */
class SimulateFishFeedingStreakAction extends Action2 {

	static readonly ID = 'sessions.aquarium.simulateStreak';

	constructor() {
		super({
			id: SimulateFishFeedingStreakAction.ID,
			title: localize2('aquarium.simulateStreak', "模拟连续喂鱼"),
			f1: true,
			category: Categories.Developer,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const aquariumService = accessor.get(IAquariumService);

		const aliveItem = { id: 'alive', label: localize('aquarium.simulateStreak.alive', "有效连续记录"), detail: localize('aquarium.simulateStreak.aliveDetail', "在切换工具提示中实时显示连续投喂记录。") };
		const diedItem = { id: 'died', label: localize('aquarium.simulateStreak.died', "连续记录已中断(可恢复)"), detail: localize('aquarium.simulateStreak.diedDetail', "留存已中断连续记录，并提供恢复提示。") };
		const clearItem = { id: 'clear', label: localize('aquarium.simulateStreak.clear', "清除连续记录"), detail: localize('aquarium.simulateStreak.clearDetail', "移除所有连续状态。") };

		const scenario = await quickInputService.pick([aliveItem, diedItem, clearItem], {
			placeHolder: localize('aquarium.simulateStreak.placeholder', "选取要模拟的连续打卡方案"),
		});
		if (!scenario) {
			return;
		}

		if (scenario.id === 'clear') {
			aquariumService.simulateStreak(0, true);
			return;
		}

		const raw = await quickInputService.input({
			value: '30',
			prompt: localize('aquarium.simulateStreak.countPrompt', "连续记录应为多少天?"),
			validateInput: async (value) => {
				const n = Number(value);
				return (!Number.isInteger(n) || n <= 0)
					? localize('aquarium.simulateStreak.countInvalid', "请输入大于 0 的整数。")
					: undefined;
			},
		});
		if (raw === undefined) {
			return;
		}

		aquariumService.simulateStreak(Number(raw), scenario.id === 'alive');
	}
}

registerAction2(SimulateFishFeedingStreakAction);

class ToggleAquariumActionVisibilityAction extends Action2 {

	static readonly ID = 'sessions.aquarium.toggleActionVisibility';

	constructor() {
		super({
			id: ToggleAquariumActionVisibilityAction.ID,
			title: localize2('aquarium.toggleActionVisibility', "Toggle Aquarium Action Visibility"),
			f1: true,
			category: Categories.Developer,
		});
	}

	override run(accessor: ServicesAccessor): void {
		accessor.get(IAquariumService).toggleActionVisibility();
	}
}

registerAction2(ToggleAquariumActionVisibilityAction);
