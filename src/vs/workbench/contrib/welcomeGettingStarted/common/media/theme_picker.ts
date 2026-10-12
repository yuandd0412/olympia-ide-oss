/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { escape } from '../../../../../base/common/strings.js';
import { localize } from '../../../../../nls.js';
import product from '../../../../../platform/product/common/product.js';
import { ThemeSettingDefaults } from '../../../../services/themes/common/workbenchThemeService.js';

/**
 * 出厂默认主题。产品没有 `defaultColorTheme` 时退回上游的「深色现代」，
 * 于是这个文件对 fork 和对本仓库都是同一份代码。
 */
const PRODUCT_DARK = ThemeSettingDefaults.COLOR_THEME_PRODUCT_DARK;
const PRODUCT_DARK_LABEL = product.defaultColorTheme
	? localize('productDark', "Olympia 默认 · {0}", product.defaultColorTheme)
	: localize('dark', "深色现代");

export default () => `
<checklist>
	<div class="theme-picker-row">
		<checkbox when-checked="setTheme:${PRODUCT_DARK}" checked-on="config.workbench.colorTheme == '${PRODUCT_DARK}'">
			<img width="200" src="./dark.png"/>
			${escape(PRODUCT_DARK_LABEL)}
		</checkbox>
		<checkbox when-checked="setTheme:${ThemeSettingDefaults.COLOR_THEME_LIGHT}" checked-on="config.workbench.colorTheme == '${ThemeSettingDefaults.COLOR_THEME_LIGHT}'">
			<img width="200" src="./light.png"/>
			${escape(localize('light', "浅色现代"))}
		</checkbox>
	</div>
	<div class="theme-picker-row">
		<checkbox when-checked="setTheme:${ThemeSettingDefaults.COLOR_THEME_HC_DARK}" checked-on="config.workbench.colorTheme == '${ThemeSettingDefaults.COLOR_THEME_HC_DARK}'">
			<img width="200" src="./dark-hc.png"/>
			${escape(localize('HighContrast', "深色高对比度"))}
		</checkbox>
		<checkbox when-checked="setTheme:${ThemeSettingDefaults.COLOR_THEME_HC_LIGHT}" checked-on="config.workbench.colorTheme == '${ThemeSettingDefaults.COLOR_THEME_HC_LIGHT}'">
			<img width="200" src="./light-hc.png"/>
			${escape(localize('HighContrastLight', "浅色高对比度"))}
		</checkbox>
	</div>
</checklist>
<checkbox class="theme-picker-link" when-checked="command:workbench.action.selectTheme" checked-on="false">
	${escape(localize('seeMore', "查看更多主题..."))}
</checkbox>
`;
