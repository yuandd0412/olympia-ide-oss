/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../nls.js';

// Import the effects we need
import { Color } from '../../../../base/common/color.js';
import { registerColor, transparent } from '../colorUtils.js';

// Import the colors we need
import { contrastBorder, focusBorder } from './baseColors.js';


// ----- sash

export const sashHoverBorder = registerColor('sash.hoverBorder',
	focusBorder,
	nls.localize('sashActiveBorder', "活动分隔条的边框颜色。"));


// ----- badge

export const badgeBackground = registerColor('badge.background',
	{ dark: '#4D4D4D', light: '#C4C4C4', hcDark: Color.black, hcLight: '#0F4A85' },
	nls.localize('badgeBackground', "徽标背景颜色。徽标是小块的信息标签，例如搜索结果数量。"));

export const badgeForeground = registerColor('badge.foreground',
	{ dark: Color.white, light: '#333', hcDark: Color.white, hcLight: Color.white },
	nls.localize('badgeForeground', "徽标前景颜色。徽标是小块的信息标签，例如搜索结果数量。"));

export const activityWarningBadgeForeground = registerColor('activityWarningBadge.foreground',
	{ dark: Color.white, light: Color.white, hcDark: Color.white, hcLight: Color.white },
	nls.localize('activityWarningBadge.foreground', "警告活动徽章的前景色"));

export const activityWarningBadgeBackground = registerColor('activityWarningBadge.background',
	{ dark: '#B27C00', light: '#B27C00', hcDark: null, hcLight: '#B27C00' },
	nls.localize('activityWarningBadge.background', "警告活动徽章的背景色"));

export const activityErrorBadgeForeground = registerColor('activityErrorBadge.foreground',
	{ dark: Color.black.lighten(0.2), light: Color.white, hcDark: null, hcLight: Color.black.lighten(0.2) },
	nls.localize('activityErrorBadge.foreground', "错误活动徽章的前景色"));

export const activityErrorBadgeBackground = registerColor('activityErrorBadge.background',
	{ dark: '#F14C4C', light: '#E51400', hcDark: null, hcLight: '#F14C4C' },
	nls.localize('activityErrorBadge.background', "错误活动徽章的背景色"));


// ----- scrollbar

export const scrollbarShadow = registerColor('scrollbar.shadow',
	{ dark: '#000000', light: '#DDDDDD', hcDark: null, hcLight: null },
	nls.localize('scrollbarShadow', "用于指示视图已滚动的滚动条阴影。"));

export const scrollbarSliderBackground = registerColor('scrollbarSlider.background',
	{ dark: Color.fromHex('#797979').transparent(0.4), light: Color.fromHex('#646464').transparent(0.4), hcDark: transparent(contrastBorder, 0.6), hcLight: transparent(contrastBorder, 0.4) },
	nls.localize('scrollbarSliderBackground', "滚动条滑块背景颜色。"));

export const scrollbarSliderHoverBackground = registerColor('scrollbarSlider.hoverBackground',
	{ dark: Color.fromHex('#646464').transparent(0.7), light: Color.fromHex('#646464').transparent(0.7), hcDark: transparent(contrastBorder, 0.8), hcLight: transparent(contrastBorder, 0.8) },
	nls.localize('scrollbarSliderHoverBackground', "悬停时的滚动条滑块背景颜色。"));

export const scrollbarSliderActiveBackground = registerColor('scrollbarSlider.activeBackground',
	{ dark: Color.fromHex('#BFBFBF').transparent(0.4), light: Color.fromHex('#000000').transparent(0.6), hcDark: contrastBorder, hcLight: contrastBorder },
	nls.localize('scrollbarSliderActiveBackground', "单击时的滚动条滑块背景颜色。"));

export const scrollbarBackground = registerColor('scrollbar.background',
	null,
	nls.localize('scrollbarBackground', "滚动条轨道背景颜色。"));


// ----- progress bar

export const progressBarBackground = registerColor('progressBar.background',
	{ dark: Color.fromHex('#0E70C0'), light: Color.fromHex('#0E70C0'), hcDark: contrastBorder, hcLight: contrastBorder },
	nls.localize('progressBarBackground', "长时间运行操作时可显示的进度条背景颜色。"));

// ----- chart

export const chartLine = registerColor('chart.line',
	{ dark: '#236B8E', light: '#236B8E', hcDark: '#236B8E', hcLight: '#236B8E' },
	nls.localize('chartLine', "图表的线条颜色。"));

export const chartAxis = registerColor('chart.axis',
	{ dark: Color.fromHex('#BFBFBF').transparent(0.4), light: Color.fromHex('#000000').transparent(0.6), hcDark: contrastBorder, hcLight: contrastBorder },
	nls.localize('chartAxis', "图表的坐标轴颜色。"));

export const chartGuide = registerColor('chart.guide',
	{ dark: Color.fromHex('#BFBFBF').transparent(0.2), light: Color.fromHex('#000000').transparent(0.2), hcDark: contrastBorder, hcLight: contrastBorder },
	nls.localize('chartGuide', "图表的参考线。"));
