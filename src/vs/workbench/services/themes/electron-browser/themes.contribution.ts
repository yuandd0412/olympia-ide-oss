/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ThemeSettings } from '../common/workbenchThemeService.js';
import { COLOR_THEME_CONFIGURATION_SETTINGS_TAG, formatSettingAsLink } from '../common/themeConfiguration.js';
import { isLinux } from '../../../../base/common/platform.js';

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
	properties: {
		[ThemeSettings.SYSTEM_COLOR_THEME]: {
			type: 'string',
			enum: ['default', 'auto', 'light', 'dark'],
			enumDescriptions: [
				localize('window.systemColorTheme.default', "本机小组件颜色与系统颜色匹配。"),
				localize('window.systemColorTheme.auto', "对浅色主题使用浅色本机小组件颜色，对深色主题使用深色本机小组件颜色。"),
				localize('window.systemColorTheme.light', "使用浅色本机小组件颜色。"),
				localize('window.systemColorTheme.dark', "使用深色本机小组件颜色。"),
			],
			markdownDescription: localize({ key: 'window.systemColorTheme', comment: ['{0} and {1} will become links to other settings.'] }, "设置本机 UI 元素的颜色模式，例如本机对话框、菜单和标题栏。即使在浅色模式下配置 OS，也可以为窗口选择深色系统颜色主题。还可以配置为根据 {0} 设置自动调整。\r\n\r\n注意: 启用 {1} 时会忽略此设置。", formatSettingAsLink(ThemeSettings.COLOR_THEME), formatSettingAsLink(ThemeSettings.DETECT_COLOR_SCHEME)),
			default: 'default',
			included: !isLinux,
			scope: ConfigurationScope.APPLICATION,
			tags: [COLOR_THEME_CONFIGURATION_SETTINGS_TAG],
		}
	}
});
