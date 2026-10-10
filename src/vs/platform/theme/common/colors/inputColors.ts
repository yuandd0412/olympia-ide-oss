/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../nls.js';

// Import the effects we need
import { Color, RGBA } from '../../../../base/common/color.js';
import { registerColor, transparent, lighten, darken, ColorTransformType } from '../colorUtils.js';

// Import the colors we need
import { foreground, contrastBorder, focusBorder, iconForeground } from './baseColors.js';
import { editorWidgetBackground } from './editorColors.js';
import { listHoverBackground } from './listColors.js';


// ----- input

export const inputBackground = registerColor('input.background',
	{ dark: '#3C3C3C', light: Color.white, hcDark: Color.black, hcLight: Color.white },
	nls.localize('inputBoxBackground', "输入框背景。"));

export const inputForeground = registerColor('input.foreground',
	foreground,
	nls.localize('inputBoxForeground', "输入框前景。"));

export const inputBorder = registerColor('input.border',
	{ dark: null, light: null, hcDark: contrastBorder, hcLight: contrastBorder },
	nls.localize('inputBoxBorder', "输入框边框。"));

export const inputActiveOptionBorder = registerColor('inputOption.activeBorder',
	{ dark: '#007ACC', light: '#007ACC', hcDark: contrastBorder, hcLight: contrastBorder },
	nls.localize('inputBoxActiveOptionBorder', "输入字段中已激活选项的边框颜色。"));

export const inputActiveOptionHoverBackground = registerColor('inputOption.hoverBackground',
	{ dark: '#5a5d5e80', light: '#b8b8b850', hcDark: null, hcLight: null },
	nls.localize('inputOption.hoverBackground', "输入字段中已激活选项的背景颜色。"));

export const inputActiveOptionBackground = registerColor('inputOption.activeBackground',
	{ dark: transparent(focusBorder, 0.4), light: transparent(focusBorder, 0.2), hcDark: Color.transparent, hcLight: Color.transparent },
	nls.localize('inputOption.activeBackground', "输入字段中选项的悬停背景颜色。"));

export const inputActiveOptionForeground = registerColor('inputOption.activeForeground',
	{ dark: Color.white, light: Color.black, hcDark: foreground, hcLight: foreground },
	nls.localize('inputOption.activeForeground', "输入字段中已激活选项的前景色。"));

export const inputPlaceholderForeground = registerColor('input.placeholderForeground',
	{ light: transparent(foreground, 0.5), dark: transparent(foreground, 0.5), hcDark: transparent(foreground, 0.7), hcLight: transparent(foreground, 0.7) },
	nls.localize('inputPlaceholderForeground', "输入框中占位文本的前景色。"));


// ----- input validation

export const inputValidationInfoBackground = registerColor('inputValidation.infoBackground',
	{ dark: '#063B49', light: '#D6ECF2', hcDark: Color.black, hcLight: Color.white },
	nls.localize('inputValidationInfoBackground', "信息级别输入校验的背景颜色。"));

export const inputValidationInfoForeground = registerColor('inputValidation.infoForeground',
	{ dark: null, light: null, hcDark: null, hcLight: foreground },
	nls.localize('inputValidationInfoForeground', "信息级别输入校验的前景色。"));

export const inputValidationInfoBorder = registerColor('inputValidation.infoBorder',
	{ dark: '#007acc', light: '#007acc', hcDark: contrastBorder, hcLight: contrastBorder },
	nls.localize('inputValidationInfoBorder', "信息级别输入校验的边框颜色。"));

export const inputValidationWarningBackground = registerColor('inputValidation.warningBackground',
	{ dark: '#352A05', light: '#F6F5D2', hcDark: Color.black, hcLight: Color.white },
	nls.localize('inputValidationWarningBackground', "警告级别输入校验的背景颜色。"));

export const inputValidationWarningForeground = registerColor('inputValidation.warningForeground',
	{ dark: null, light: null, hcDark: null, hcLight: foreground },
	nls.localize('inputValidationWarningForeground', "警告级别输入校验的前景色。"));

export const inputValidationWarningBorder = registerColor('inputValidation.warningBorder',
	{ dark: '#B89500', light: '#B89500', hcDark: contrastBorder, hcLight: contrastBorder },
	nls.localize('inputValidationWarningBorder', "警告级别输入校验的边框颜色。"));

export const inputValidationErrorBackground = registerColor('inputValidation.errorBackground',
	{ dark: '#5A1D1D', light: '#F2DEDE', hcDark: Color.black, hcLight: Color.white },
	nls.localize('inputValidationErrorBackground', "错误级别输入校验的背景颜色。"));

export const inputValidationErrorForeground = registerColor('inputValidation.errorForeground',
	{ dark: null, light: null, hcDark: null, hcLight: foreground },
	nls.localize('inputValidationErrorForeground', "错误级别输入校验的前景色。"));

export const inputValidationErrorBorder = registerColor('inputValidation.errorBorder',
	{ dark: '#BE1100', light: '#BE1100', hcDark: contrastBorder, hcLight: contrastBorder },
	nls.localize('inputValidationErrorBorder', "错误级别输入校验的边框颜色。"));


// ----- select

export const selectBackground = registerColor('dropdown.background',
	{ dark: '#3C3C3C', light: Color.white, hcDark: Color.black, hcLight: Color.white },
	nls.localize('dropdownBackground', "下拉框背景。"));

export const selectListBackground = registerColor('dropdown.listBackground',
	{ dark: null, light: null, hcDark: Color.black, hcLight: Color.white },
	nls.localize('dropdownListBackground', "下拉列表背景。"));

export const selectForeground = registerColor('dropdown.foreground',
	{ dark: '#F0F0F0', light: foreground, hcDark: Color.white, hcLight: foreground },
	nls.localize('dropdownForeground', "下拉框前景。"));

export const selectBorder = registerColor('dropdown.border',
	{ dark: selectBackground, light: '#CECECE', hcDark: contrastBorder, hcLight: contrastBorder },
	nls.localize('dropdownBorder', "下拉框边框。"));


// ------ button

export const buttonForeground = registerColor('button.foreground',
	Color.white,
	nls.localize('buttonForeground', "按钮前景颜色。"));

export const buttonSeparator = registerColor('button.separator',
	transparent(buttonForeground, .4),
	nls.localize('buttonSeparator', "按钮分隔线颜色。"));

export const buttonBackground = registerColor('button.background',
	{ dark: '#0E639C', light: '#007ACC', hcDark: Color.black, hcLight: '#0F4A85' },
	nls.localize('buttonBackground', "按钮背景颜色。"));

export const buttonHoverBackground = registerColor('button.hoverBackground',
	{ dark: lighten(buttonBackground, 0.2), light: darken(buttonBackground, 0.2), hcDark: buttonBackground, hcLight: buttonBackground },
	nls.localize('buttonHoverBackground', "悬停时的按钮背景颜色。"));

export const buttonBorder = registerColor('button.border',
	contrastBorder,
	nls.localize('buttonBorder', "按钮边框颜色。"));

export const buttonSecondaryForeground = registerColor('button.secondaryForeground',
	{ dark: foreground, light: foreground, hcDark: Color.white, hcLight: foreground },
	nls.localize('buttonSecondaryForeground', "次要按钮前景颜色。"));

export const buttonSecondaryBackground = registerColor('button.secondaryBackground',
	{ dark: listHoverBackground, light: listHoverBackground, hcDark: null, hcLight: Color.white },
	nls.localize('buttonSecondaryBackground', "次要按钮背景颜色。"));

export const buttonSecondaryBorder = registerColor('button.secondaryBorder',
	{ dark: transparent(foreground, 0.15), light: transparent(foreground, 0.15), hcDark: contrastBorder, hcLight: contrastBorder },
	nls.localize('buttonSecondaryBorder', "次要按钮边框颜色。"));

export const buttonSecondaryHoverBackground = registerColor('button.secondaryHoverBackground',
	{ dark: lighten(listHoverBackground, 0.2), light: lighten(listHoverBackground, 0.2), hcDark: null, hcLight: null },
	nls.localize('buttonSecondaryHoverBackground', "悬停时的次要按钮背景颜色。"));

// ------ radio

export const radioActiveForeground = registerColor('radio.activeForeground',
	inputActiveOptionForeground,
	nls.localize('radioActiveForeground', "选中单选项的前景色。"));

export const radioActiveBackground = registerColor('radio.activeBackground',
	inputActiveOptionBackground,
	nls.localize('radioBackground', "选中单选项的背景颜色。"));

export const radioActiveBorder = registerColor('radio.activeBorder',
	inputActiveOptionBorder,
	nls.localize('radioActiveBorder', "选中单选项的边框颜色。"));

export const radioInactiveForeground = registerColor('radio.inactiveForeground',
	null,
	nls.localize('radioInactiveForeground', "未选中单选项的前景色。"));

export const radioInactiveBackground = registerColor('radio.inactiveBackground',
	null,
	nls.localize('radioInactiveBackground', "未选中单选项的背景颜色。"));

export const radioInactiveBorder = registerColor('radio.inactiveBorder',
	{ light: transparent(radioActiveForeground, .2), dark: transparent(radioActiveForeground, .2), hcDark: transparent(radioActiveForeground, .4), hcLight: transparent(radioActiveForeground, .2) },
	nls.localize('radioInactiveBorder', "未选中单选项的边框颜色。"));

export const radioInactiveHoverBackground = registerColor('radio.inactiveHoverBackground',
	inputActiveOptionHoverBackground,
	nls.localize('radioHoverBackground', "悬停在未选中单选项上时的背景颜色。"));

// ------ checkbox

export const checkboxBackground = registerColor('checkbox.background',
	selectBackground,
	nls.localize('checkbox.background', "复选框小部件的背景颜色。"));

export const checkboxSelectBackground = registerColor('checkbox.selectBackground',
	editorWidgetBackground,
	nls.localize('checkbox.select.background', "所在元素被选中时复选框小部件的背景颜色。"));

export const checkboxForeground = registerColor('checkbox.foreground',
	selectForeground,
	nls.localize('checkbox.foreground', "复选框小部件的前景色。"));

export const checkboxBorder = registerColor('checkbox.border',
	selectBorder,
	nls.localize('checkbox.border', "复选框小部件的边框颜色。"));

export const checkboxSelectBorder = registerColor('checkbox.selectBorder',
	iconForeground,
	nls.localize('checkbox.select.border', "所在元素被选中时复选框小部件的边框颜色。"));

export const checkboxDisabledBackground = registerColor('checkbox.disabled.background',
	{ op: ColorTransformType.Mix, color: checkboxBackground, with: checkboxForeground, ratio: 0.33 },
	nls.localize('checkbox.disabled.background', "禁用状态复选框的背景。"));

export const checkboxDisabledForeground = registerColor('checkbox.disabled.foreground',
	{ op: ColorTransformType.Mix, color: checkboxForeground, with: checkboxBackground, ratio: 0.33 },
	nls.localize('checkbox.disabled.foreground', "禁用状态复选框的前景。"));


// ------ keybinding label

export const keybindingLabelBackground = registerColor('keybindingLabel.background',
	{ dark: new Color(new RGBA(128, 128, 128, 0.17)), light: new Color(new RGBA(221, 221, 221, 0.4)), hcDark: Color.transparent, hcLight: Color.transparent },
	nls.localize('keybindingLabelBackground', "快捷键标签的背景颜色。快捷键标签用于表示键盘快捷键。"));

export const keybindingLabelForeground = registerColor('keybindingLabel.foreground',
	{ dark: Color.fromHex('#CCCCCC'), light: Color.fromHex('#555555'), hcDark: Color.white, hcLight: foreground },
	nls.localize('keybindingLabelForeground', "快捷键标签的前景色。快捷键标签用于表示键盘快捷键。"));

export const keybindingLabelBorder = registerColor('keybindingLabel.border',
	{ dark: new Color(new RGBA(51, 51, 51, 0.6)), light: new Color(new RGBA(204, 204, 204, 0.4)), hcDark: new Color(new RGBA(111, 195, 223)), hcLight: contrastBorder },
	nls.localize('keybindingLabelBorder', "快捷键标签的边框颜色。快捷键标签用于表示键盘快捷键。"));

export const keybindingLabelBottomBorder = registerColor('keybindingLabel.bottomBorder',
	{ dark: new Color(new RGBA(68, 68, 68, 0.6)), light: new Color(new RGBA(187, 187, 187, 0.4)), hcDark: new Color(new RGBA(111, 195, 223)), hcLight: foreground },
	nls.localize('keybindingLabelBottomBorder', "快捷键标签的底部边框颜色。快捷键标签用于表示键盘快捷键。"));
