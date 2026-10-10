/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../nls.js';
import { registerColor, editorBackground, contrastBorder, transparent, opaque, oneOf, editorWidgetBackground, textLinkForeground, lighten, darken, focusBorder, activeContrastBorder, editorWidgetForeground, editorErrorForeground, editorWarningForeground, editorInfoForeground, treeIndentGuidesStroke, errorForeground, listActiveSelectionBackground, listActiveSelectionForeground, listInactiveSelectionBackground, listInactiveSelectionForeground, listHoverBackground, listHoverForeground, editorForeground, toolbarHoverBackground, inputBorder, widgetBorder, scrollbarShadow } from '../../platform/theme/common/colorRegistry.js';
import { foreground } from '../../platform/theme/common/colors/baseColors.js';
import { IColorTheme } from '../../platform/theme/common/themeService.js';
import { Color } from '../../base/common/color.js';
import { ColorScheme } from '../../platform/theme/common/theme.js';

// < --- Workbench (not customizable) --- >

export function WORKBENCH_BACKGROUND(theme: IColorTheme): Color {
	switch (theme.type) {
		case ColorScheme.LIGHT:
			return Color.fromHex('#F3F3F3');
		case ColorScheme.HIGH_CONTRAST_LIGHT:
			return Color.fromHex('#FFFFFF');
		case ColorScheme.HIGH_CONTRAST_DARK:
			return Color.fromHex('#000000');
		default:
			return Color.fromHex('#252526');
	}
}

// < --- Tabs --- >

//#region Tab Background

export const TAB_ACTIVE_BACKGROUND = registerColor('tab.activeBackground', editorBackground, localize('tabActiveBackground', "活动编辑器组中活动标签页的背景颜色。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

export const TAB_UNFOCUSED_ACTIVE_BACKGROUND = registerColor('tab.unfocusedActiveBackground', TAB_ACTIVE_BACKGROUND, localize('tabUnfocusedActiveBackground', "未聚焦编辑器组中活动标签页的背景颜色。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

export const TAB_INACTIVE_BACKGROUND = registerColor('tab.inactiveBackground', {
	dark: '#2D2D2D',
	light: '#ECECEC',
	hcDark: null,
	hcLight: null,
}, localize('tabInactiveBackground', "活动编辑器组中非活动标签页的背景颜色。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

export const TAB_UNFOCUSED_INACTIVE_BACKGROUND = registerColor('tab.unfocusedInactiveBackground', TAB_INACTIVE_BACKGROUND, localize('tabUnfocusedInactiveBackground', "未聚焦编辑器组中非活动标签页的背景颜色。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

//#endregion

//#region Tab Foreground

export const TAB_ACTIVE_FOREGROUND = registerColor('tab.activeForeground', {
	dark: Color.white,
	light: '#333333',
	hcDark: Color.white,
	hcLight: '#292929'
}, localize('tabActiveForeground', "活动编辑器组中活动标签页的前景色。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

export const TAB_INACTIVE_FOREGROUND = registerColor('tab.inactiveForeground', {
	dark: transparent(TAB_ACTIVE_FOREGROUND, 0.5),
	light: transparent(TAB_ACTIVE_FOREGROUND, 0.7),
	hcDark: Color.white,
	hcLight: '#292929'
}, localize('tabInactiveForeground', "活动编辑器组中非活动标签页的前景色。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

export const TAB_UNFOCUSED_ACTIVE_FOREGROUND = registerColor('tab.unfocusedActiveForeground', {
	dark: transparent(TAB_ACTIVE_FOREGROUND, 0.5),
	light: transparent(TAB_ACTIVE_FOREGROUND, 0.7),
	hcDark: Color.white,
	hcLight: '#292929'
}, localize('tabUnfocusedActiveForeground', "未聚焦编辑器组中活动标签页的前景色。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

export const TAB_UNFOCUSED_INACTIVE_FOREGROUND = registerColor('tab.unfocusedInactiveForeground', {
	dark: transparent(TAB_INACTIVE_FOREGROUND, 0.5),
	light: transparent(TAB_INACTIVE_FOREGROUND, 0.5),
	hcDark: Color.white,
	hcLight: '#292929'
}, localize('tabUnfocusedInactiveForeground', "未聚焦编辑器组中非活动标签页的前景色。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

//#endregion

//#region Tab Hover Foreground/Background

export const TAB_HOVER_BACKGROUND = registerColor('tab.hoverBackground', null, localize('tabHoverBackground', "悬停时的标签页背景颜色。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

export const TAB_UNFOCUSED_HOVER_BACKGROUND = registerColor('tab.unfocusedHoverBackground', {
	dark: transparent(TAB_HOVER_BACKGROUND, 0.5),
	light: transparent(TAB_HOVER_BACKGROUND, 0.7),
	hcDark: null,
	hcLight: null
}, localize('tabUnfocusedHoverBackground', "在未聚焦编辑器组中悬停时的标签页背景颜色。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

export const TAB_HOVER_FOREGROUND = registerColor('tab.hoverForeground', null, localize('tabHoverForeground', "悬停时的标签页前景色。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

export const TAB_UNFOCUSED_HOVER_FOREGROUND = registerColor('tab.unfocusedHoverForeground', {
	dark: transparent(TAB_HOVER_FOREGROUND, 0.5),
	light: transparent(TAB_HOVER_FOREGROUND, 0.5),
	hcDark: null,
	hcLight: null
}, localize('tabUnfocusedHoverForeground', "在未聚焦编辑器组中悬停时的标签页前景色。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

//#endregion

//#region Tab Borders

export const TAB_BORDER = registerColor('tab.border', {
	dark: '#252526',
	light: '#F3F3F3',
	hcDark: contrastBorder,
	hcLight: contrastBorder,
}, localize('tabBorder', "用于分隔标签页的边框。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

export const TAB_LAST_PINNED_BORDER = registerColor('tab.lastPinnedBorder', {
	dark: treeIndentGuidesStroke,
	light: treeIndentGuidesStroke,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('lastPinnedTabBorder', "用于将固定标签页与其他标签页分隔开的边框。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

export const TAB_ACTIVE_BORDER = registerColor('tab.activeBorder', null, localize('tabActiveBorder', "活动标签页底部的边框。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

export const TAB_UNFOCUSED_ACTIVE_BORDER = registerColor('tab.unfocusedActiveBorder', {
	dark: transparent(TAB_ACTIVE_BORDER, 0.5),
	light: transparent(TAB_ACTIVE_BORDER, 0.7),
	hcDark: null,
	hcLight: null
}, localize('tabActiveUnfocusedBorder', "未聚焦编辑器组中活动标签页底部的边框。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

export const TAB_ACTIVE_BORDER_TOP = registerColor('tab.activeBorderTop', {
	dark: null,
	light: null,
	hcDark: null,
	hcLight: '#B5200D'
}, localize('tabActiveBorderTop', "活动标签页顶部的边框。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

export const TAB_UNFOCUSED_ACTIVE_BORDER_TOP = registerColor('tab.unfocusedActiveBorderTop', {
	dark: transparent(TAB_ACTIVE_BORDER_TOP, 0.5),
	light: transparent(TAB_ACTIVE_BORDER_TOP, 0.7),
	hcDark: null,
	hcLight: '#B5200D'
}, localize('tabActiveUnfocusedBorderTop', "未聚焦编辑器组中活动标签页顶部的边框。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

export const TAB_SELECTED_BORDER_TOP = registerColor('tab.selectedBorderTop', {
	dark: focusBorder,
	light: focusBorder,
	hcDark: activeContrastBorder,
	hcLight: activeContrastBorder
}, localize('tabSelectedBorderTop', "选中标签页顶部的边框。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

export const TAB_SELECTED_BACKGROUND = registerColor('tab.selectedBackground', listInactiveSelectionBackground, localize('tabSelectedBackground', "选中标签页的背景。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

export const TAB_SELECTED_FOREGROUND = registerColor('tab.selectedForeground', TAB_ACTIVE_FOREGROUND, localize('tabSelectedForeground', "选中标签页的前景色。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));


export const TAB_HOVER_BORDER = registerColor('tab.hoverBorder', null, localize('tabHoverBorder', "悬停时用于突出显示标签页的边框。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

export const TAB_UNFOCUSED_HOVER_BORDER = registerColor('tab.unfocusedHoverBorder', {
	dark: transparent(TAB_HOVER_BORDER, 0.5),
	light: transparent(TAB_HOVER_BORDER, 0.7),
	hcDark: null,
	hcLight: contrastBorder
}, localize('tabUnfocusedHoverBorder', "在未聚焦编辑器组中悬停时，用于突出显示标签页的边框。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

//#endregion

//#region Tab Drag and Drop Border

export const TAB_DRAG_AND_DROP_BORDER = registerColor('tab.dragAndDropBorder', {
	dark: TAB_ACTIVE_FOREGROUND,
	light: TAB_ACTIVE_FOREGROUND,
	hcDark: activeContrastBorder,
	hcLight: activeContrastBorder
}, localize('tabDragAndDropBorder', "标签页之间的边框，用于表示可以在两个标签页之间插入新标签页。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

//#endregion

//#region Tab Modified Border

export const TAB_ACTIVE_MODIFIED_BORDER = registerColor('tab.activeModifiedBorder', {
	dark: '#3399CC',
	light: '#33AAEE',
	hcDark: null,
	hcLight: contrastBorder
}, localize('tabActiveModifiedBorder', "活动编辑器组中已修改的活动标签页顶部的边框。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

export const TAB_INACTIVE_MODIFIED_BORDER = registerColor('tab.inactiveModifiedBorder', {
	dark: transparent(TAB_ACTIVE_MODIFIED_BORDER, 0.5),
	light: transparent(TAB_ACTIVE_MODIFIED_BORDER, 0.5),
	hcDark: Color.white,
	hcLight: contrastBorder
}, localize('tabInactiveModifiedBorder', "活动编辑器组中已修改的非活动标签页顶部的边框。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

export const TAB_UNFOCUSED_ACTIVE_MODIFIED_BORDER = registerColor('tab.unfocusedActiveModifiedBorder', {
	dark: transparent(TAB_ACTIVE_MODIFIED_BORDER, 0.5),
	light: transparent(TAB_ACTIVE_MODIFIED_BORDER, 0.7),
	hcDark: Color.white,
	hcLight: contrastBorder
}, localize('unfocusedActiveModifiedBorder', "未聚焦编辑器组中已修改的活动标签页顶部的边框。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

export const TAB_UNFOCUSED_INACTIVE_MODIFIED_BORDER = registerColor('tab.unfocusedInactiveModifiedBorder', {
	dark: transparent(TAB_INACTIVE_MODIFIED_BORDER, 0.5),
	light: transparent(TAB_INACTIVE_MODIFIED_BORDER, 0.5),
	hcDark: Color.white,
	hcLight: contrastBorder
}, localize('unfocusedINactiveModifiedBorder', "未聚焦编辑器组中已修改的非活动标签页顶部的边框。标签页是编辑器区域中编辑器的容器，一个编辑器组中可以打开多个标签页，也可以有多个编辑器组。"));

//#endregion

// < --- Editors --- >

export const EDITOR_PANE_BACKGROUND = registerColor('editorPane.background', editorBackground, localize('editorPaneBackground', "居中编辑器布局中显示在编辑器区域左右两侧的编辑器窗格背景颜色。"));

export const EDITOR_GROUP_EMPTY_BACKGROUND = registerColor('editorGroup.emptyBackground', null, localize('editorGroupEmptyBackground', "空编辑器组的背景颜色。编辑器组是编辑器的容器。"));

export const EDITOR_GROUP_FOCUSED_EMPTY_BORDER = registerColor('editorGroup.focusedEmptyBorder', {
	dark: null,
	light: null,
	hcDark: focusBorder,
	hcLight: focusBorder
}, localize('editorGroupFocusedEmptyBorder', "处于聚焦状态的空编辑器组的边框颜色。编辑器组是编辑器的容器。"));

export const EDITOR_GROUP_HEADER_TABS_BACKGROUND = registerColor('editorGroupHeader.tabsBackground', {
	dark: '#252526',
	light: '#F3F3F3',
	hcDark: null,
	hcLight: null
}, localize('tabsContainerBackground', "启用标签页时，编辑器组标题栏的背景颜色。编辑器组是编辑器的容器。"));

export const EDITOR_GROUP_HEADER_CONNECTED_TABS_BACKGROUND = registerColor('editorGroupHeader.connectedTabsBackground', EDITOR_GROUP_HEADER_TABS_BACKGROUND, localize('connectedTabsContainerBackground', "编辑器组标题栏中关联标签页的背景颜色。编辑器组是编辑器的容器。"));

export const EDITOR_GROUP_HEADER_TABS_BORDER = registerColor('editorGroupHeader.tabsBorder', null, localize('tabsContainerBorder', "启用标签页时，编辑器组标题栏的边框颜色。编辑器组是编辑器的容器。"));

export const EDITOR_GROUP_HEADER_NO_TABS_BACKGROUND = registerColor('editorGroupHeader.noTabsBackground', editorBackground, localize('editorGroupHeaderBackground', "当 (\"workbench.editor.showTabs\": \"single\") 时，编辑器组标题栏的背景颜色。编辑器组是编辑器的容器。"));

export const EDITOR_GROUP_HEADER_BORDER = registerColor('editorGroupHeader.border', {
	dark: null,
	light: null,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('editorTitleContainerBorder', "编辑器组标题栏的边框颜色。编辑器组是编辑器的容器。"));

export const EDITOR_GROUP_BORDER = registerColor('editorGroup.border', {
	dark: '#444444',
	light: '#E7E7E7',
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('editorGroupBorder', "用于分隔多个编辑器组的颜色。编辑器组是编辑器的容器。"));

export const EDITOR_DRAG_AND_DROP_BACKGROUND = registerColor('editorGroup.dropBackground', {
	dark: Color.fromHex('#53595D').transparent(0.5),
	light: Color.fromHex('#2677CB').transparent(0.18),
	hcDark: null,
	hcLight: Color.fromHex('#0F4A85').transparent(0.50)
}, localize('editorDragAndDropBackground', "拖动编辑器时的背景颜色。该颜色应带有透明度，以便编辑器内容仍然可以透出。"));

export const EDITOR_DROP_INTO_PROMPT_FOREGROUND = registerColor('editorGroup.dropIntoPromptForeground', editorWidgetForeground, localize('editorDropIntoPromptForeground', "拖动文件时显示在编辑器上方的文字前景色。该文字会提示用户可以按住 Shift 键将文件放入编辑器。"));

export const EDITOR_DROP_INTO_PROMPT_BACKGROUND = registerColor('editorGroup.dropIntoPromptBackground', editorWidgetBackground, localize('editorDropIntoPromptBackground', "拖动文件时显示在编辑器上方的文字背景色。该文字会提示用户可以按住 Shift 键将文件放入编辑器。"));

export const EDITOR_DROP_INTO_PROMPT_BORDER = registerColor('editorGroup.dropIntoPromptBorder', {
	dark: null,
	light: null,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('editorDropIntoPromptBorder', "拖动文件时显示在编辑器上方的文字边框色。该文字会提示用户可以按住 Shift 键将文件放入编辑器。"));

export const SIDE_BY_SIDE_EDITOR_HORIZONTAL_BORDER = registerColor('sideBySideEditor.horizontalBorder', EDITOR_GROUP_BORDER, localize('sideBySideEditor.horizontalBorder', "在编辑器组中从上到下并排显示两个编辑器时，用于分隔两者的颜色。"));

export const SIDE_BY_SIDE_EDITOR_VERTICAL_BORDER = registerColor('sideBySideEditor.verticalBorder', EDITOR_GROUP_BORDER, localize('sideBySideEditor.verticalBorder', "在编辑器组中从左到右并排显示两个编辑器时，用于分隔两者的颜色。"));


// < --- Output Editor -->

const OUTPUT_VIEW_BACKGROUND = registerColor('outputView.background', null, localize('outputViewBackground', "输出视图的背景颜色。"));


registerColor('outputViewStickyScroll.background', OUTPUT_VIEW_BACKGROUND, localize('outputViewStickyScrollBackground', "输出视图中粘性滚动的背景颜色。"));


// < --- Banner --- >

export const BANNER_BACKGROUND = registerColor('banner.background', {
	dark: listActiveSelectionBackground,
	light: darken(listActiveSelectionBackground, 0.3),
	hcDark: listActiveSelectionBackground,
	hcLight: listActiveSelectionBackground
}, localize('banner.background', "横幅的背景颜色。横幅显示在窗口标题栏下方。"));

export const BANNER_FOREGROUND = registerColor('banner.foreground', listActiveSelectionForeground, localize('banner.foreground', "横幅的前景色。横幅显示在窗口标题栏下方。"));

export const BANNER_ICON_FOREGROUND = registerColor('banner.iconForeground', editorInfoForeground, localize('banner.iconForeground', "横幅的图标颜色。横幅显示在窗口标题栏下方。"));

// < --- Status --- >

export const STATUS_BAR_FOREGROUND = registerColor('statusBar.foreground', {
	dark: '#FFFFFF',
	light: '#FFFFFF',
	hcDark: '#FFFFFF',
	hcLight: editorForeground
}, localize('statusBarForeground', "打开工作区或文件夹时的状态栏前景色。状态栏显示在窗口底部。"));

export const STATUS_BAR_NO_FOLDER_FOREGROUND = registerColor('statusBar.noFolderForeground', STATUS_BAR_FOREGROUND, localize('statusBarNoFolderForeground', "未打开任何文件夹时的状态栏前景色。状态栏显示在窗口底部。"));

export const STATUS_BAR_BACKGROUND = registerColor('statusBar.background', {
	dark: '#007ACC',
	light: '#007ACC',
	hcDark: null,
	hcLight: null,
}, localize('statusBarBackground', "打开工作区或文件夹时的状态栏背景色。状态栏显示在窗口底部。"));

export const STATUS_BAR_INACTIVE_BACKGROUND = registerColor('statusBar.inactiveBackground', {
	dark: null,
	light: null,
	hcDark: null,
	hcLight: null,
}, localize('statusBarInactiveBackground', "已打开工作区或文件夹但窗口未激活时的状态栏背景色。调试等其他背景覆盖项的优先级更高。若未设置，则沿用当前的状态栏背景。"));

export const STATUS_BAR_NO_FOLDER_BACKGROUND = registerColor('statusBar.noFolderBackground', {
	dark: '#68217A',
	light: '#68217A',
	hcDark: null,
	hcLight: null,
}, localize('statusBarNoFolderBackground', "未打开任何文件夹时的状态栏背景色。状态栏显示在窗口底部。"));

export const STATUS_BAR_BORDER = registerColor('statusBar.border', {
	dark: null,
	light: null,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('statusBarBorder', "用于分隔状态栏与侧边栏、编辑器的边框颜色。状态栏显示在窗口底部。"));

export const STATUS_BAR_FOCUS_BORDER = registerColor('statusBar.focusBorder', {
	dark: STATUS_BAR_FOREGROUND,
	light: STATUS_BAR_FOREGROUND,
	hcDark: null,
	hcLight: STATUS_BAR_FOREGROUND
}, localize('statusBarFocusBorder', "通过键盘导航聚焦时的状态栏边框颜色。状态栏显示在窗口底部。"));

export const STATUS_BAR_NO_FOLDER_BORDER = registerColor('statusBar.noFolderBorder', STATUS_BAR_BORDER, localize('statusBarNoFolderBorder', "未打开任何文件夹时，用于分隔状态栏与侧边栏、编辑器的边框颜色。状态栏显示在窗口底部。"));

export const STATUS_BAR_ITEM_ACTIVE_BACKGROUND = registerColor('statusBarItem.activeBackground', {
	dark: Color.white.transparent(0.18),
	light: Color.white.transparent(0.18),
	hcDark: Color.white.transparent(0.18),
	hcLight: Color.black.transparent(0.18)
}, localize('statusBarItemActiveBackground', "点击时的状态栏项背景颜色。状态栏显示在窗口底部。"));

export const STATUS_BAR_ITEM_FOCUS_BORDER = registerColor('statusBarItem.focusBorder', {
	dark: STATUS_BAR_FOREGROUND,
	light: STATUS_BAR_FOREGROUND,
	hcDark: null,
	hcLight: activeContrastBorder
}, localize('statusBarItemFocusBorder', "通过键盘导航聚焦时的状态栏项边框颜色。状态栏显示在窗口底部。"));

export const STATUS_BAR_ITEM_HOVER_BACKGROUND = registerColor('statusBarItem.hoverBackground', {
	dark: Color.white.transparent(0.12),
	light: Color.black.transparent(0.12),
	hcDark: Color.black,
	hcLight: Color.white
}, localize('statusBarItemHoverBackground', "悬停时的状态栏项背景颜色。状态栏显示在窗口底部。"));

export const STATUS_BAR_ITEM_HOVER_FOREGROUND = registerColor('statusBarItem.hoverForeground', STATUS_BAR_FOREGROUND, localize('statusBarItemHoverForeground', "悬停时的状态栏项前景色。状态栏显示在窗口底部。"));

export const STATUS_BAR_ITEM_COMPACT_HOVER_BACKGROUND = registerColor('statusBarItem.compactHoverBackground', {
	dark: Color.white.transparent(0.12),
	light: Color.black.transparent(0.12),
	hcDark: Color.black,
	hcLight: Color.white
}, localize('statusBarItemCompactHoverBackground', "悬停于包含两个悬停状态的项目时，状态栏项的背景颜色。状态栏显示在窗口底部。"));

export const STATUS_BAR_PROMINENT_ITEM_FOREGROUND = registerColor('statusBarItem.prominentForeground', STATUS_BAR_FOREGROUND, localize('statusBarProminentItemForeground', "状态栏突出显示项目的前景色。突出显示的项目会与其他状态栏条目区分开来，以标示其重要性。状态栏显示在窗口底部。"));

export const STATUS_BAR_PROMINENT_ITEM_BACKGROUND = registerColor('statusBarItem.prominentBackground', Color.black.transparent(0.5), localize('statusBarProminentItemBackground', "状态栏突出显示项目的背景色。突出显示的项目会与其他状态栏条目区分开来，以标示其重要性。状态栏显示在窗口底部。"));

export const STATUS_BAR_PROMINENT_ITEM_HOVER_FOREGROUND = registerColor('statusBarItem.prominentHoverForeground', STATUS_BAR_ITEM_HOVER_FOREGROUND, localize('statusBarProminentItemHoverForeground', "悬停时状态栏突出显示项目的前景色。突出显示的项目会与其他状态栏条目区分开来，以标示其重要性。状态栏显示在窗口底部。"));

export const STATUS_BAR_PROMINENT_ITEM_HOVER_BACKGROUND = registerColor('statusBarItem.prominentHoverBackground', STATUS_BAR_ITEM_HOVER_BACKGROUND, localize('statusBarProminentItemHoverBackground', "悬停时状态栏突出显示项目的背景色。突出显示的项目会与其他状态栏条目区分开来，以标示其重要性。状态栏显示在窗口底部。"));

export const STATUS_BAR_ERROR_ITEM_BACKGROUND = registerColor('statusBarItem.errorBackground', {
	dark: darken(errorForeground, .4),
	light: darken(errorForeground, .4),
	hcDark: null,
	hcLight: '#B5200D'
}, localize('statusBarErrorItemBackground', "状态栏错误项目的背景色。错误项目会与其他状态栏条目区分开来，以标示错误状态。状态栏显示在窗口底部。"));

export const STATUS_BAR_ERROR_ITEM_FOREGROUND = registerColor('statusBarItem.errorForeground', Color.white, localize('statusBarErrorItemForeground', "状态栏错误项目的前景色。错误项目会与其他状态栏条目区分开来，以标示错误状态。状态栏显示在窗口底部。"));

export const STATUS_BAR_ERROR_ITEM_HOVER_FOREGROUND = registerColor('statusBarItem.errorHoverForeground', STATUS_BAR_ITEM_HOVER_FOREGROUND, localize('statusBarErrorItemHoverForeground', "悬停时状态栏错误项目的前景色。错误项目会与其他状态栏条目区分开来，以标示错误状态。状态栏显示在窗口底部。"));

export const STATUS_BAR_ERROR_ITEM_HOVER_BACKGROUND = registerColor('statusBarItem.errorHoverBackground', STATUS_BAR_ITEM_HOVER_BACKGROUND, localize('statusBarErrorItemHoverBackground', "悬停时状态栏错误项目的背景色。错误项目会与其他状态栏条目区分开来，以标示错误状态。状态栏显示在窗口底部。"));

export const STATUS_BAR_WARNING_ITEM_BACKGROUND = registerColor('statusBarItem.warningBackground', {
	dark: darken(editorWarningForeground, .4),
	light: darken(editorWarningForeground, .4),
	hcDark: null,
	hcLight: '#895503'
}, localize('statusBarWarningItemBackground', "状态栏警告项目的背景色。警告项目会与其他状态栏条目区分开来，以标示警告状态。状态栏显示在窗口底部。"));

export const STATUS_BAR_WARNING_ITEM_FOREGROUND = registerColor('statusBarItem.warningForeground', Color.white, localize('statusBarWarningItemForeground', "状态栏警告项目的前景色。警告项目会与其他状态栏条目区分开来，以标示警告状态。状态栏显示在窗口底部。"));

export const STATUS_BAR_WARNING_ITEM_HOVER_FOREGROUND = registerColor('statusBarItem.warningHoverForeground', STATUS_BAR_ITEM_HOVER_FOREGROUND, localize('statusBarWarningItemHoverForeground', "悬停时状态栏警告项目的前景色。警告项目会与其他状态栏条目区分开来，以标示警告状态。状态栏显示在窗口底部。"));

export const STATUS_BAR_WARNING_ITEM_HOVER_BACKGROUND = registerColor('statusBarItem.warningHoverBackground', STATUS_BAR_ITEM_HOVER_BACKGROUND, localize('statusBarWarningItemHoverBackground', "悬停时状态栏警告项目的背景色。警告项目会与其他状态栏条目区分开来，以标示警告状态。状态栏显示在窗口底部。"));


// < --- Activity Bar --- >

export const ACTIVITY_BAR_BACKGROUND = registerColor('activityBar.background', {
	dark: '#333333',
	light: '#2C2C2C',
	hcDark: '#000000',
	hcLight: '#FFFFFF'
}, localize('activityBarBackground', "活动栏的背景颜色。活动栏显示在最左侧或最右侧，用于在侧边栏的各个视图之间切换。"));

export const ACTIVITY_BAR_FOREGROUND = registerColor('activityBar.foreground', {
	dark: Color.white,
	light: Color.white,
	hcDark: Color.white,
	hcLight: editorForeground
}, localize('activityBarForeground', "处于活动状态时活动栏项的前景色。活动栏显示在最左侧或最右侧，用于在侧边栏的各个视图之间切换。"));

export const ACTIVITY_BAR_INACTIVE_FOREGROUND = registerColor('activityBar.inactiveForeground', {
	dark: transparent(ACTIVITY_BAR_FOREGROUND, 0.4),
	light: transparent(ACTIVITY_BAR_FOREGROUND, 0.4),
	hcDark: Color.white,
	hcLight: editorForeground
}, localize('activityBarInActiveForeground', "处于非活动状态时活动栏项的前景色。活动栏显示在最左侧或最右侧，用于在侧边栏的各个视图之间切换。"));

export const ACTIVITY_BAR_BORDER = registerColor('activityBar.border', {
	dark: null,
	light: null,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('activityBarBorder', "用于分隔活动栏与侧边栏的边框颜色。活动栏显示在最左侧或最右侧，用于在侧边栏的各个视图之间切换。"));

export const ACTIVITY_BAR_ACTIVE_BORDER = registerColor('activityBar.activeBorder', {
	dark: ACTIVITY_BAR_FOREGROUND,
	light: ACTIVITY_BAR_FOREGROUND,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('activityBarActiveBorder', "活动项的活动栏边框颜色。活动栏显示在最左侧或最右侧，用于在侧边栏的各个视图之间切换。"));

export const ACTIVITY_BAR_ACTIVE_FOCUS_BORDER = registerColor('activityBar.activeFocusBorder', {
	dark: null,
	light: null,
	hcDark: null,
	hcLight: '#B5200D'
}, localize('activityBarActiveFocusBorder', "活动项的活动栏聚焦边框颜色。活动栏显示在最左侧或最右侧，用于在侧边栏的各个视图之间切换。"));

export const ACTIVITY_BAR_ACTIVE_BACKGROUND = registerColor('activityBar.activeBackground', null, localize('activityBarActiveBackground', "活动项的活动栏背景颜色。活动栏显示在最左侧或最右侧，用于在侧边栏的各个视图之间切换。"));

export const ACTIVITY_BAR_DRAG_AND_DROP_BORDER = registerColor('activityBar.dropBorder', {
	dark: ACTIVITY_BAR_FOREGROUND,
	light: ACTIVITY_BAR_FOREGROUND,
	hcDark: null,
	hcLight: null,
}, localize('activityBarDragAndDropBorder', "活动栏项目的拖放反馈颜色。活动栏显示在最左侧或最右侧，用于在侧边栏的各个视图之间切换。"));

export const ACTIVITY_BAR_BADGE_BACKGROUND = registerColor('activityBarBadge.background', {
	dark: '#007ACC',
	light: '#007ACC',
	hcDark: '#000000',
	hcLight: '#0F4A85'
}, localize('activityBarBadgeBackground', "活动通知徽标的背景颜色。活动栏显示在最左侧或最右侧，用于在侧边栏的各个视图之间切换。"));

export const ACTIVITY_BAR_BADGE_FOREGROUND = registerColor('activityBarBadge.foreground', Color.white, localize('activityBarBadgeForeground', "活动通知徽标的前景色。活动栏显示在最左侧或最右侧，用于在侧边栏的各个视图之间切换。"));

export const ACTIVITY_BAR_TOP_FOREGROUND = registerColor('activityBarTop.foreground', {
	dark: '#E7E7E7',
	light: '#424242',
	hcDark: Color.white,
	hcLight: editorForeground
}, localize('activityBarTop', "活动栏位于顶部/底部时，其中活动项的前景色。活动栏用于在侧边栏的各个视图之间切换。"));

export const ACTIVITY_BAR_TOP_ACTIVE_BORDER = registerColor('activityBarTop.activeBorder', {
	dark: ACTIVITY_BAR_TOP_FOREGROUND,
	light: ACTIVITY_BAR_TOP_FOREGROUND,
	hcDark: contrastBorder,
	hcLight: '#B5200D'
}, localize('activityBarTopActiveFocusBorder', "活动栏位于顶部/底部时，活动项的聚焦边框颜色。活动栏用于在侧边栏的各个视图之间切换。"));

export const ACTIVITY_BAR_TOP_ACTIVE_BACKGROUND = registerColor('activityBarTop.activeBackground', null, localize('activityBarTopActiveBackground', "活动栏位于顶部/底部时，活动项的背景颜色。活动栏用于在侧边栏的各个视图之间切换。"));

export const ACTIVITY_BAR_TOP_INACTIVE_FOREGROUND = registerColor('activityBarTop.inactiveForeground', {
	dark: transparent(ACTIVITY_BAR_TOP_FOREGROUND, 0.6),
	light: transparent(ACTIVITY_BAR_TOP_FOREGROUND, 0.75),
	hcDark: Color.white,
	hcLight: editorForeground
}, localize('activityBarTopInActiveForeground', "活动栏位于顶部/底部时，非活动项的前景色。活动栏用于在侧边栏的各个视图之间切换。"));

export const ACTIVITY_BAR_TOP_DRAG_AND_DROP_BORDER = registerColor('activityBarTop.dropBorder', ACTIVITY_BAR_TOP_FOREGROUND, localize('activityBarTopDragAndDropBorder', "活动栏位于顶部/底部时，其中项目的拖放反馈颜色。活动栏用于在侧边栏的各个视图之间切换。"));

export const ACTIVITY_BAR_TOP_BACKGROUND = registerColor('activityBarTop.background', null, localize('activityBarTopBackground', "活动栏设置为顶部/底部时的背景颜色。"));


// < --- Panels --- >

export const PANEL_BACKGROUND = registerColor('panel.background', editorBackground, localize('panelBackground', "面板的背景颜色。面板显示在编辑器区域下方，包含输出和集成终端等视图。"));

export const PANEL_BORDER = registerColor('panel.border', {
	dark: Color.fromHex('#808080').transparent(0.35),
	light: Color.fromHex('#808080').transparent(0.35),
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('panelBorder', "用于分隔面板与编辑器的面板边框颜色。面板显示在编辑器区域下方，包含输出和集成终端等视图。"));

export const PANEL_TITLE_BORDER = registerColor('panelTitle.border', {
	dark: null,
	light: null,
	hcDark: PANEL_BORDER,
	hcLight: PANEL_BORDER
}, localize('panelTitleBorder', "面板标题底部的边框颜色，用于分隔标题与视图。面板显示在编辑器区域下方，包含输出和集成终端等视图。"));

export const PANEL_ACTIVE_TITLE_FOREGROUND = registerColor('panelTitle.activeForeground', {
	dark: '#E7E7E7',
	light: '#424242',
	hcDark: Color.white,
	hcLight: editorForeground
}, localize('panelActiveTitleForeground', "活动面板的标题颜色。面板显示在编辑器区域下方，包含输出和集成终端等视图。"));

export const PANEL_INACTIVE_TITLE_FOREGROUND = registerColor('panelTitle.inactiveForeground', {
	dark: transparent(PANEL_ACTIVE_TITLE_FOREGROUND, 0.6),
	light: transparent(PANEL_ACTIVE_TITLE_FOREGROUND, 0.75),
	hcDark: Color.white,
	hcLight: editorForeground
}, localize('panelInactiveTitleForeground', "非活动面板的标题颜色。面板显示在编辑器区域下方，包含输出和集成终端等视图。"));

export const PANEL_ACTIVE_TITLE_BORDER = registerColor('panelTitle.activeBorder', {
	dark: PANEL_ACTIVE_TITLE_FOREGROUND,
	light: PANEL_ACTIVE_TITLE_FOREGROUND,
	hcDark: contrastBorder,
	hcLight: '#B5200D'
}, localize('panelActiveTitleBorder', "活动面板标题的边框颜色。面板显示在编辑器区域下方，包含输出和集成终端等视图。"));

export const PANEL_TITLE_BADGE_BACKGROUND = registerColor('panelTitleBadge.background', ACTIVITY_BAR_BADGE_BACKGROUND, localize('panelTitleBadgeBackground', "面板标题徽标的背景颜色。面板显示在编辑器区域下方，包含输出和集成终端等视图。"));

export const PANEL_TITLE_BADGE_FOREGROUND = registerColor('panelTitleBadge.foreground', ACTIVITY_BAR_BADGE_FOREGROUND, localize('panelTitleBadgeForeground', "面板标题徽标的前景色。面板显示在编辑器区域下方，包含输出和集成终端等视图。"));

export const PANEL_INPUT_BORDER = registerColor('panelInput.border', {
	dark: inputBorder,
	light: Color.fromHex('#ddd'),
	hcDark: inputBorder,
	hcLight: inputBorder
}, localize('panelInputBorder', "面板中输入框的边框。"));

export const PANEL_DRAG_AND_DROP_BORDER = registerColor('panel.dropBorder', PANEL_ACTIVE_TITLE_FOREGROUND, localize('panelDragAndDropBorder', "面板标题的拖放反馈颜色。面板显示在编辑器区域下方，包含输出和集成终端等视图。"));

export const PANEL_SECTION_DRAG_AND_DROP_BACKGROUND = registerColor('panelSection.dropBackground', EDITOR_DRAG_AND_DROP_BACKGROUND, localize('panelSectionDragAndDropBackground', "面板分区的拖放反馈颜色。该颜色应带有透明度，以便面板分区仍然可以透出。面板显示在编辑器区域下方，包含输出和集成终端等视图。面板分区是嵌套在面板内部的视图。"));

export const PANEL_SECTION_HEADER_BACKGROUND = registerColor('panelSectionHeader.background', {
	dark: Color.fromHex('#808080').transparent(0.2),
	light: Color.fromHex('#808080').transparent(0.2),
	hcDark: null,
	hcLight: null,
}, localize('panelSectionHeaderBackground', "面板分区标题的背景颜色。面板显示在编辑器区域下方，包含输出和集成终端等视图。面板分区是嵌套在面板内部的视图。"));

export const PANEL_SECTION_HEADER_FOREGROUND = registerColor('panelSectionHeader.foreground', null, localize('panelSectionHeaderForeground', "面板分区标题的前景色。面板显示在编辑器区域下方，包含输出和集成终端等视图。面板分区是嵌套在面板内部的视图。"));

export const PANEL_SECTION_HEADER_BORDER = registerColor('panelSectionHeader.border', contrastBorder, localize('panelSectionHeaderBorder', "面板中纵向堆叠多个视图时所用的分区标题边框颜色。面板显示在编辑器区域下方，包含输出和集成终端等视图。面板分区是嵌套在面板内部的视图。"));

export const PANEL_SECTION_BORDER = registerColor('panelSection.border', PANEL_BORDER, localize('panelSectionBorder', "面板中横向堆叠多个视图时所用的分区边框颜色。面板显示在编辑器区域下方，包含输出和集成终端等视图。面板分区是嵌套在面板内部的视图。"));

export const PANEL_STICKY_SCROLL_BACKGROUND = registerColor('panelStickyScroll.background', PANEL_BACKGROUND, localize('panelStickyScrollBackground', "面板中粘性滚动的背景颜色。"));

export const PANEL_STICKY_SCROLL_BORDER = registerColor('panelStickyScroll.border', null, localize('panelStickyScrollBorder', "面板中粘性滚动的边框颜色。"));

export const PANEL_STICKY_SCROLL_SHADOW = registerColor('panelStickyScroll.shadow', scrollbarShadow, localize('panelStickyScrollShadow', "面板中粘性滚动的阴影颜色。"));


// < --- Browser --- >

export const BROWSER_BORDER = registerColor('browser.border', TAB_BORDER, localize('browserBorder', "集成浏览器页面的边框颜色。"));


// < --- Profiles --- >

export const PROFILE_BADGE_BACKGROUND = registerColor('profileBadge.background', {
	dark: '#4D4D4D',
	light: '#C4C4C4',
	hcDark: Color.white,
	hcLight: Color.black
}, localize('profileBadgeBackground', "个人资料徽标的背景颜色。该徽标显示在活动栏的设置齿轮图标上方。"));

export const PROFILE_BADGE_FOREGROUND = registerColor('profileBadge.foreground', {
	dark: Color.white,
	light: '#333333',
	hcDark: Color.black,
	hcLight: Color.white
}, localize('profileBadgeForeground', "个人资料徽标的前景色。该徽标显示在活动栏的设置齿轮图标上方。"));


// < --- Remote --- >

export const STATUS_BAR_REMOTE_ITEM_BACKGROUND = registerColor('statusBarItem.remoteBackground', ACTIVITY_BAR_BADGE_BACKGROUND, localize('statusBarItemRemoteBackground', "状态栏上远程指示器的背景颜色。"));

export const STATUS_BAR_REMOTE_ITEM_FOREGROUND = registerColor('statusBarItem.remoteForeground', ACTIVITY_BAR_BADGE_FOREGROUND, localize('statusBarItemRemoteForeground', "状态栏上远程指示器的前景色。"));

export const STATUS_BAR_REMOTE_ITEM_HOVER_FOREGROUND = registerColor('statusBarItem.remoteHoverForeground', STATUS_BAR_ITEM_HOVER_FOREGROUND, localize('statusBarRemoteItemHoverForeground', "悬停时状态栏上远程指示器的前景色。"));

export const STATUS_BAR_REMOTE_ITEM_HOVER_BACKGROUND = registerColor('statusBarItem.remoteHoverBackground', {
	dark: STATUS_BAR_ITEM_HOVER_BACKGROUND,
	light: STATUS_BAR_ITEM_HOVER_BACKGROUND,
	hcDark: STATUS_BAR_ITEM_HOVER_BACKGROUND,
	hcLight: null
}, localize('statusBarRemoteItemHoverBackground', "悬停时状态栏上远程指示器的背景色。"));

export const STATUS_BAR_OFFLINE_ITEM_BACKGROUND = registerColor('statusBarItem.offlineBackground', '#6c1717', localize('statusBarItemOfflineBackground', "工作台处于离线状态时的状态栏项背景颜色。"));

export const STATUS_BAR_OFFLINE_ITEM_FOREGROUND = registerColor('statusBarItem.offlineForeground', STATUS_BAR_REMOTE_ITEM_FOREGROUND, localize('statusBarItemOfflineForeground', "工作台处于离线状态时的状态栏项前景色。"));

export const STATUS_BAR_OFFLINE_ITEM_HOVER_FOREGROUND = registerColor('statusBarItem.offlineHoverForeground', STATUS_BAR_ITEM_HOVER_FOREGROUND, localize('statusBarOfflineItemHoverForeground', "工作台处于离线状态时的状态栏项悬停前景色。"));

export const STATUS_BAR_OFFLINE_ITEM_HOVER_BACKGROUND = registerColor('statusBarItem.offlineHoverBackground', {
	dark: STATUS_BAR_ITEM_HOVER_BACKGROUND,
	light: STATUS_BAR_ITEM_HOVER_BACKGROUND,
	hcDark: STATUS_BAR_ITEM_HOVER_BACKGROUND,
	hcLight: null
}, localize('statusBarOfflineItemHoverBackground', "工作台处于离线状态时的状态栏项悬停背景色。"));

export const EXTENSION_BADGE_BACKGROUND = registerColor('extensionBadge.remoteBackground', ACTIVITY_BAR_BADGE_BACKGROUND, localize('extensionBadge.remoteBackground', "扩展视图中远程徽标的背景颜色。"));
export const EXTENSION_BADGE_FOREGROUND = registerColor('extensionBadge.remoteForeground', ACTIVITY_BAR_BADGE_FOREGROUND, localize('extensionBadge.remoteForeground', "扩展视图中远程徽标的前景色。"));


// < --- Side Bar --- >

export const SIDE_BAR_BACKGROUND = registerColor('sideBar.background', {
	dark: '#252526',
	light: '#F3F3F3',
	hcDark: '#000000',
	hcLight: '#FFFFFF'
}, localize('sideBarBackground', "侧边栏的背景颜色。侧边栏是资源管理器和搜索等视图的容器。"));

export const SIDE_BAR_FOREGROUND = registerColor('sideBar.foreground', null, localize('sideBarForeground', "侧边栏的前景色。侧边栏是资源管理器和搜索等视图的容器。"));

export const SIDE_BAR_BORDER = registerColor('sideBar.border', {
	dark: null,
	light: null,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('sideBarBorder', "侧边栏与编辑器分隔那一侧的边框颜色。侧边栏是资源管理器和搜索等视图的容器。"));

export const SIDE_BAR_TITLE_BACKGROUND = registerColor('sideBarTitle.background', SIDE_BAR_BACKGROUND, localize('sideBarTitleBackground', "侧边栏标题的背景颜色。侧边栏是资源管理器和搜索等视图的容器。"));

export const SIDE_BAR_TITLE_FOREGROUND = registerColor('sideBarTitle.foreground', SIDE_BAR_FOREGROUND, localize('sideBarTitleForeground', "侧边栏标题的前景色。侧边栏是资源管理器和搜索等视图的容器。"));

export const SIDE_BAR_TITLE_BORDER = registerColor('sideBarTitle.border', {
	dark: null,
	light: null,
	hcDark: SIDE_BAR_BORDER,
	hcLight: SIDE_BAR_BORDER
}, localize('sideBarTitleBorder', "侧边栏标题底部的边框颜色，用于分隔标题与视图。侧边栏是资源管理器和搜索等视图的容器。"));

export const SIDE_BAR_DRAG_AND_DROP_BACKGROUND = registerColor('sideBar.dropBackground', EDITOR_DRAG_AND_DROP_BACKGROUND, localize('sideBarDragAndDropBackground', "侧边栏分区的拖放反馈颜色。该颜色应带有透明度，以便侧边栏分区仍然可以透出。侧边栏是资源管理器和搜索等视图的容器。侧边栏分区是嵌套在侧边栏内部的视图。"));

export const SIDE_BAR_SECTION_HEADER_BACKGROUND = registerColor('sideBarSectionHeader.background', {
	dark: Color.fromHex('#808080').transparent(0.2),
	light: Color.fromHex('#808080').transparent(0.2),
	hcDark: null,
	hcLight: null
}, localize('sideBarSectionHeaderBackground', "侧边栏分区标题的背景颜色。侧边栏是资源管理器和搜索等视图的容器。侧边栏分区是嵌套在侧边栏内部的视图。"));

export const SIDE_BAR_SECTION_HEADER_FOREGROUND = registerColor('sideBarSectionHeader.foreground', SIDE_BAR_FOREGROUND, localize('sideBarSectionHeaderForeground', "侧边栏分区标题的前景色。侧边栏是资源管理器和搜索等视图的容器。侧边栏分区是嵌套在侧边栏内部的视图。"));

export const SIDE_BAR_SECTION_HEADER_BORDER = registerColor('sideBarSectionHeader.border', contrastBorder, localize('sideBarSectionHeaderBorder', "侧边栏分区标题的边框颜色。侧边栏是资源管理器和搜索等视图的容器。侧边栏分区是嵌套在侧边栏内部的视图。"));

export const ACTIVITY_BAR_TOP_BORDER = registerColor('sideBarActivityBarTop.border', SIDE_BAR_SECTION_HEADER_BORDER, localize('sideBarActivityBarTopBorder', "顶部/底部活动栏与视图之间的边框颜色。"));

export const SIDE_BAR_STICKY_SCROLL_BACKGROUND = registerColor('sideBarStickyScroll.background', SIDE_BAR_BACKGROUND, localize('sideBarStickyScrollBackground', "侧边栏中粘性滚动的背景颜色。"));

export const SIDE_BAR_STICKY_SCROLL_BORDER = registerColor('sideBarStickyScroll.border', null, localize('sideBarStickyScrollBorder', "侧边栏中粘性滚动的边框颜色。"));

export const SIDE_BAR_STICKY_SCROLL_SHADOW = registerColor('sideBarStickyScroll.shadow', scrollbarShadow, localize('sideBarStickyScrollShadow', "侧边栏中粘性滚动的阴影颜色。"));

// < --- Surface --- >

// Generic framed container surfaces ("cards"). Used by the modern workbench
// layout to frame the floating parts (side bar, panel, auxiliary bar, editor).
// Defaults mirror the agent sessions window's panel treatment so the look is
// shared, but themes can target these tokens independently.

export const SURFACE_BACKGROUND = registerColor('surface.background', {
	dark: SIDE_BAR_BACKGROUND,
	light: editorBackground,
	hcDark: SIDE_BAR_BACKGROUND,
	hcLight: SIDE_BAR_BACKGROUND
}, localize('surfaceBackground', "新式布局中带边框容器表面（卡片）的背景颜色，例如浮动的工作台面板。"));

export const SURFACE_FOREGROUND = registerColor('surface.foreground', SIDE_BAR_FOREGROUND, localize('surfaceForeground', "新式布局中带边框容器表面（卡片）的前景色，例如浮动的工作台面板。"));

export const SURFACE_BORDER = registerColor('surface.border', {
	dark: opaque(transparent(foreground, 0.15), SURFACE_BACKGROUND),
	light: opaque(transparent(foreground, 0.15), SURFACE_BACKGROUND),
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('surfaceBorder', "新式布局中带边框容器表面（卡片）的边框颜色，例如浮动的工作台面板。"));

export const EDITOR_BORDER = registerColor('editor.border', SURFACE_BORDER, localize('editorBorder', "新式布局中编辑器表面的边框颜色。"));

export const MODERN_PANEL_BORDER = registerColor('modernPanel.border', SURFACE_BORDER, localize('modernPanelBorder', "启用新式界面时面板表面的边框颜色。"));

// Dark and light themes use `foreground` at 40% alpha.
// High contrast themes keep the foreground opaque so the grips stay legible.
export const MODERN_SASH_GRIP_FOREGROUND = registerColor('modernSash.gripForeground', {
	dark: transparent(foreground, 0.4),
	light: transparent(foreground, 0.4),
	hcDark: foreground,
	hcLight: foreground
}, localize('modernSashGripForeground', "启用新式界面时标记工作台各部分之间可调整边界的拖拽手柄颜色。"));

// < --- Modern Tabs --- >

export const MODERN_TAB_ACTIVE_BACKGROUND = registerColor('modernTab.activeBackground', listInactiveSelectionBackground, localize('modernTabActiveBackground', "启用新式标签页样式时活动标签页的背景颜色。"));

export const MODERN_TAB_ACTIVE_FOREGROUND = registerColor('modernTab.activeForeground', oneOf(listInactiveSelectionForeground, foreground), localize('modernTabActiveForeground', "启用新式标签页样式时活动标签页的前景色。"));

export const MODERN_TAB_HOVER_BACKGROUND = registerColor('modernTab.hoverBackground', listHoverBackground, localize('modernTabHoverBackground', "悬停于标签页且启用新式标签页样式时标签页的背景颜色。"));

export const MODERN_TAB_HOVER_FOREGROUND = registerColor('modernTab.hoverForeground', oneOf(listHoverForeground, foreground), localize('modernTabHoverForeground', "悬停于标签页且启用新式标签页样式时标签页的前景色。"));

// < --- Modern Editor Tabs --- >

export const MODERN_EDITOR_TAB_ACTIVE_BACKGROUND = registerColor('modernEditorTab.activeBackground', MODERN_TAB_ACTIVE_BACKGROUND, localize('modernEditorTabActiveBackground', "启用新式标签页样式时活动编辑器标签页的背景颜色。"));

export const MODERN_EDITOR_TAB_ACTIVE_ACTION_BACKGROUND = registerColor('modernEditorTab.activeActionBackground', opaque(MODERN_EDITOR_TAB_ACTIVE_BACKGROUND, editorBackground), localize('modernEditorTabActiveActionBackground', "启用新式标签页样式时活动编辑器标签页上标签页操作的不透明背景颜色。"));

export const MODERN_EDITOR_TAB_ACTIVE_FOREGROUND = registerColor('modernEditorTab.activeForeground', MODERN_TAB_ACTIVE_FOREGROUND, localize('modernEditorTabActiveForeground', "启用新式标签页样式时活动编辑器标签页的前景色。"));

export const MODERN_EDITOR_TAB_INACTIVE_BACKGROUND = registerColor('modernEditorTab.inactiveBackground', Color.transparent, localize('modernEditorTabInactiveBackground', "启用新式标签页样式时非活动编辑器标签页的背景颜色。"));

export const MODERN_EDITOR_TAB_HOVER_BACKGROUND = registerColor('modernEditorTab.hoverBackground', MODERN_TAB_HOVER_BACKGROUND, localize('modernEditorTabHoverBackground', "悬停于编辑器标签页且启用新式标签页样式时标签页的背景颜色。"));

export const MODERN_EDITOR_TAB_HOVER_ACTION_BACKGROUND = registerColor('modernEditorTab.hoverActionBackground', opaque(MODERN_EDITOR_TAB_HOVER_BACKGROUND, editorBackground), localize('modernEditorTabHoverActionBackground', "悬停于编辑器标签页且启用新式标签页样式时标签页操作的不透明背景颜色。"));

export const MODERN_EDITOR_TAB_HOVER_FOREGROUND = registerColor('modernEditorTab.hoverForeground', MODERN_TAB_HOVER_FOREGROUND, localize('modernEditorTabHoverForeground', "悬停于编辑器标签页且启用新式标签页样式时标签页的前景色。"));

export const MODERN_EDITOR_TAB_ACTIVE_HOVER_BACKGROUND = registerColor('modernEditorTab.activeHoverBackground', MODERN_EDITOR_TAB_HOVER_BACKGROUND, localize('modernEditorTabActiveHoverBackground', "悬停于活动编辑器标签页且启用新式标签页样式时标签页的背景颜色。"));

export const MODERN_EDITOR_TAB_ACTIVE_HOVER_ACTION_BACKGROUND = registerColor('modernEditorTab.activeHoverActionBackground', opaque(MODERN_EDITOR_TAB_ACTIVE_HOVER_BACKGROUND, editorBackground), localize('modernEditorTabActiveHoverActionBackground', "悬停于活动编辑器标签页且启用新式标签页样式时标签页操作的不透明背景颜色。"));

export const MODERN_EDITOR_TAB_SELECTED_ACTION_BACKGROUND = registerColor('modernEditorTab.selectedActionBackground', opaque(TAB_SELECTED_BACKGROUND, editorBackground), localize('modernEditorTabSelectedActionBackground', "启用新式标签页样式时选中编辑器标签页上标签页操作的不透明背景颜色。"));

// < --- Modern Activity Bar --- >

export const MODERN_ACTIVITY_BAR_BACKGROUND = registerColor('modernActivityBar.background', ACTIVITY_BAR_BACKGROUND, localize('modernActivityBarBackground', "启用新式界面时默认边侧位置活动栏的背景颜色。"));

export const MODERN_ACTIVITY_BAR_INACTIVE_BACKGROUND = registerColor('modernActivityBar.inactiveBackground', MODERN_ACTIVITY_BAR_BACKGROUND, localize('modernActivityBarInactiveBackground', "窗口未激活、处于默认边侧位置且启用新式界面时活动栏的背景颜色。"));

const DEPRECATED_MODERN_ACTIVITY_BAR_ACTIVE_BACKGROUND = registerColor('modernActivityBar.activeBackground', null, localize('modernActivityBarActiveBackground', "启用新式界面时默认边侧位置活动栏中活动项的背景颜色。"), false, localize('modernActivityBarActiveBackgroundDeprecated', "'modernActivityBar.activeBackground' 已弃用，请改用 'modernActivityBarItem.activeBackground'。"));

const DEPRECATED_MODERN_ACTIVITY_BAR_ACTIVE_FOREGROUND = registerColor('modernActivityBar.activeForeground', null, localize('modernActivityBarActiveForeground', "启用新式界面时默认边侧位置活动栏中活动项的前景色。"), false, localize('modernActivityBarActiveForegroundDeprecated', "'modernActivityBar.activeForeground' 已弃用，请改用 'modernActivityBarItem.activeForeground'。"));

const DEPRECATED_MODERN_ACTIVITY_BAR_HOVER_BACKGROUND = registerColor('modernActivityBar.hoverBackground', null, localize('modernActivityBarHoverBackground', "启用新式界面时，悬停于默认边侧位置活动栏项目的背景颜色。"), false, localize('modernActivityBarHoverBackgroundDeprecated', "'modernActivityBar.hoverBackground' 已弃用，请改用 'modernActivityBarItem.hoverBackground'。"));

const DEPRECATED_MODERN_ACTIVITY_BAR_HOVER_FOREGROUND = registerColor('modernActivityBar.hoverForeground', null, localize('modernActivityBarHoverForeground', "启用新式界面时，悬停于默认边侧位置活动栏项目的前景色。"), false, localize('modernActivityBarHoverForegroundDeprecated', "'modernActivityBar.hoverForeground' 已弃用，请改用 'modernActivityBarItem.hoverForeground'。"));

export const MODERN_ACTIVITY_BAR_ITEM_ACTIVE_BACKGROUND = registerColor('modernActivityBarItem.activeBackground', oneOf(DEPRECATED_MODERN_ACTIVITY_BAR_ACTIVE_BACKGROUND, MODERN_TAB_ACTIVE_BACKGROUND), localize('modernActivityBarItemActiveBackground', "启用新式界面时默认边侧位置活动栏中活动项的背景颜色。"));

export const MODERN_ACTIVITY_BAR_ITEM_ACTIVE_FOREGROUND = registerColor('modernActivityBarItem.activeForeground', oneOf(DEPRECATED_MODERN_ACTIVITY_BAR_ACTIVE_FOREGROUND, MODERN_TAB_ACTIVE_FOREGROUND), localize('modernActivityBarItemActiveForeground', "启用新式界面时默认边侧位置活动栏中活动项的前景色。"));

export const MODERN_ACTIVITY_BAR_ITEM_HOVER_BACKGROUND = registerColor('modernActivityBarItem.hoverBackground', oneOf(DEPRECATED_MODERN_ACTIVITY_BAR_HOVER_BACKGROUND, MODERN_TAB_HOVER_BACKGROUND), localize('modernActivityBarItemHoverBackground', "启用新式界面时，悬停于默认边侧位置活动栏项目的背景颜色。"));

export const MODERN_ACTIVITY_BAR_ITEM_HOVER_FOREGROUND = registerColor('modernActivityBarItem.hoverForeground', oneOf(DEPRECATED_MODERN_ACTIVITY_BAR_HOVER_FOREGROUND, MODERN_TAB_HOVER_FOREGROUND), localize('modernActivityBarItemHoverForeground', "启用新式界面时，悬停于默认边侧位置活动栏项目的前景色。"));

export const MODERN_ACTIVITY_BAR_BORDER = registerColor('modernActivityBar.border', SURFACE_BORDER, localize('modernActivityBarBorder', "启用新式界面时默认边侧位置活动栏的边框颜色。"));

// < --- Title Bar --- >

export const TITLE_BAR_ACTIVE_FOREGROUND = registerColor('titleBar.activeForeground', {
	dark: '#CCCCCC',
	light: '#333333',
	hcDark: '#FFFFFF',
	hcLight: '#292929'
}, localize('titleBarActiveForeground', "窗口处于活动状态时的标题栏前景色。"));

export const TITLE_BAR_INACTIVE_FOREGROUND = registerColor('titleBar.inactiveForeground', {
	dark: transparent(TITLE_BAR_ACTIVE_FOREGROUND, 0.6),
	light: transparent(TITLE_BAR_ACTIVE_FOREGROUND, 0.6),
	hcDark: null,
	hcLight: '#292929'
}, localize('titleBarInactiveForeground', "窗口未激活时的标题栏前景色。"));

export const TITLE_BAR_ACTIVE_BACKGROUND = registerColor('titleBar.activeBackground', {
	dark: '#3C3C3C',
	light: '#DDDDDD',
	hcDark: '#000000',
	hcLight: '#FFFFFF'
}, localize('titleBarActiveBackground', "窗口处于活动状态时的标题栏背景色。"));

export const TITLE_BAR_INACTIVE_BACKGROUND = registerColor('titleBar.inactiveBackground', {
	dark: transparent(TITLE_BAR_ACTIVE_BACKGROUND, 0.6),
	light: transparent(TITLE_BAR_ACTIVE_BACKGROUND, 0.6),
	hcDark: null,
	hcLight: null,
}, localize('titleBarInactiveBackground', "窗口未激活时的标题栏背景色。"));

export const MODERN_UI_SHELL_BACKGROUND = registerColor('modernUI.shellBackground', TITLE_BAR_ACTIVE_BACKGROUND, localize('modernUIShellBackground', "启用新式界面时浮动工作台表面周围可见外壳的背景颜色。"));

export const MODERN_UI_INACTIVE_SHELL_BACKGROUND = registerColor('modernUI.inactiveShellBackground', TITLE_BAR_INACTIVE_BACKGROUND, localize('modernUIInactiveShellBackground', "窗口未激活且启用新式界面时浮动工作台表面周围可见外壳的背景颜色。"));

export const TITLE_BAR_BORDER = registerColor('titleBar.border', {
	dark: null,
	light: null,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('titleBarBorder', "标题栏的边框颜色。"));

// < --- Menubar --- >

export const MENUBAR_SELECTION_FOREGROUND = registerColor('menubar.selectionForeground', TITLE_BAR_ACTIVE_FOREGROUND, localize('menubarSelectionForeground', "菜单栏中所选菜单项的前景色。"));

export const MENUBAR_SELECTION_BACKGROUND = registerColor('menubar.selectionBackground', {
	dark: toolbarHoverBackground,
	light: toolbarHoverBackground,
	hcDark: null,
	hcLight: null,
}, localize('menubarSelectionBackground', "菜单栏中所选菜单项的背景色。"));

export const MENUBAR_SELECTION_BORDER = registerColor('menubar.selectionBorder', {
	dark: null,
	light: null,
	hcDark: activeContrastBorder,
	hcLight: activeContrastBorder,
}, localize('menubarSelectionBorder', "菜单栏中所选菜单项的边框颜色。"));

// < --- Command Center --- >

// foreground (inactive and active)
export const COMMAND_CENTER_FOREGROUND = registerColor(
	'commandCenter.foreground',
	TITLE_BAR_ACTIVE_FOREGROUND,
	localize('commandCenter-foreground', "命令中心的前景色"),
	false
);
export const COMMAND_CENTER_ACTIVEFOREGROUND = registerColor(
	'commandCenter.activeForeground',
	MENUBAR_SELECTION_FOREGROUND,
	localize('commandCenter-activeForeground', "命令中心处于活动状态时的前景色"),
	false
);
export const COMMAND_CENTER_INACTIVEFOREGROUND = registerColor(
	'commandCenter.inactiveForeground',
	TITLE_BAR_INACTIVE_FOREGROUND,
	localize('commandCenter-inactiveForeground', "窗口未激活时命令中心的前景色"),
	false
);
// background (inactive and active)
export const COMMAND_CENTER_BACKGROUND = registerColor(
	'commandCenter.background',
	{ dark: Color.white.transparent(0.05), hcDark: null, light: Color.black.transparent(0.05), hcLight: null },
	localize('commandCenter-background', "命令中心的背景色"),
	false
);
export const COMMAND_CENTER_ACTIVEBACKGROUND = registerColor(
	'commandCenter.activeBackground',
	{ dark: Color.white.transparent(0.08), hcDark: MENUBAR_SELECTION_BACKGROUND, light: Color.black.transparent(0.08), hcLight: MENUBAR_SELECTION_BACKGROUND },
	localize('commandCenter-activeBackground', "命令中心处于活动状态时的背景色"),
	false
);
// border: active and inactive. defaults to active background
export const COMMAND_CENTER_BORDER = registerColor(
	'commandCenter.border', { dark: transparent(TITLE_BAR_ACTIVE_FOREGROUND, .20), hcDark: contrastBorder, light: transparent(TITLE_BAR_ACTIVE_FOREGROUND, .20), hcLight: contrastBorder },
	localize('commandCenter-border', "命令中心的边框颜色"),
	false
);
export const COMMAND_CENTER_ACTIVEBORDER = registerColor(
	'commandCenter.activeBorder', { dark: transparent(TITLE_BAR_ACTIVE_FOREGROUND, .30), hcDark: TITLE_BAR_ACTIVE_FOREGROUND, light: transparent(TITLE_BAR_ACTIVE_FOREGROUND, .30), hcLight: TITLE_BAR_ACTIVE_FOREGROUND },
	localize('commandCenter-activeBorder', "命令中心处于活动状态时的边框颜色"),
	false
);
// border: defaults to active background
export const COMMAND_CENTER_INACTIVEBORDER = registerColor(
	'commandCenter.inactiveBorder', transparent(TITLE_BAR_INACTIVE_FOREGROUND, .25),
	localize('commandCenter-inactiveBorder', "窗口未激活时命令中心的边框颜色"),
	false
);


// < --- Notifications --- >

export const NOTIFICATIONS_CENTER_BORDER = registerColor('notificationCenter.border', {
	dark: widgetBorder,
	light: widgetBorder,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('notificationCenterBorder', "通知中心的边框颜色。通知从窗口右下角滑入。"));

export const NOTIFICATIONS_TOAST_BORDER = registerColor('notificationToast.border', {
	dark: widgetBorder,
	light: widgetBorder,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('notificationToastBorder', "通知浮窗的边框颜色。通知从窗口右下角滑入。"));

export const NOTIFICATIONS_FOREGROUND = registerColor('notifications.foreground', editorWidgetForeground, localize('notificationsForeground', "通知的前景色。通知从窗口右下角滑入。"));

export const NOTIFICATIONS_BACKGROUND = registerColor('notifications.background', editorWidgetBackground, localize('notificationsBackground', "通知的背景色。通知从窗口右下角滑入。"));

export const NOTIFICATIONS_LINKS = registerColor('notificationLink.foreground', textLinkForeground, localize('notificationsLink', "通知链接的前景色。通知从窗口右下角滑入。"));

export const NOTIFICATIONS_CENTER_HEADER_FOREGROUND = registerColor('notificationCenterHeader.foreground', null, localize('notificationCenterHeaderForeground', "通知中心标题栏的前景色。通知从窗口右下角滑入。"));

export const NOTIFICATIONS_CENTER_HEADER_BACKGROUND = registerColor('notificationCenterHeader.background', {
	dark: lighten(NOTIFICATIONS_BACKGROUND, 0.3),
	light: darken(NOTIFICATIONS_BACKGROUND, 0.05),
	hcDark: NOTIFICATIONS_BACKGROUND,
	hcLight: NOTIFICATIONS_BACKGROUND
}, localize('notificationCenterHeaderBackground', "通知中心标题栏的背景色。通知从窗口右下角滑入。"));

export const NOTIFICATIONS_BORDER = registerColor('notifications.border', NOTIFICATIONS_CENTER_HEADER_BACKGROUND, localize('notificationsBorder', "通知中心中用于与其他通知分隔的边框颜色。通知从窗口右下角滑入。"));

export const NOTIFICATIONS_ERROR_ICON_FOREGROUND = registerColor('notificationsErrorIcon.foreground', editorErrorForeground, localize('notificationsErrorIconForeground', "错误通知图标所使用的颜色。通知从窗口右下角滑入。"));

export const NOTIFICATIONS_WARNING_ICON_FOREGROUND = registerColor('notificationsWarningIcon.foreground', editorWarningForeground, localize('notificationsWarningIconForeground', "警告通知图标所使用的颜色。通知从窗口右下角滑入。"));

export const NOTIFICATIONS_INFO_ICON_FOREGROUND = registerColor('notificationsInfoIcon.foreground', editorInfoForeground, localize('notificationsInfoIconForeground', "信息通知图标所使用的颜色。通知从窗口右下角滑入。"));

export const WINDOW_ACTIVE_BORDER = registerColor('window.activeBorder', {
	dark: null,
	light: null,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('windowActiveBorder', "在 macOS 或 Linux 上，窗口处于活动状态时窗口边框所使用的颜色。在 Linux 上需要自定义标题栏样式以及自定义或隐藏的窗口控件。"));

export const WINDOW_INACTIVE_BORDER = registerColor('window.inactiveBorder', {
	dark: null,
	light: null,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('windowInactiveBorder', "在 macOS 或 Linux 上，窗口未激活时窗口边框所使用的颜色。在 Linux 上需要自定义标题栏样式以及自定义或隐藏的窗口控件。"));
