/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';

/**
 * An object holding strings shared by multiple parts of the terminal
 */
export const terminalStrings = {
	terminal: localize('terminal', "终端"),
	new: localize('terminal.new', "新建终端"),
	doNotShowAgain: localize('doNotShowAgain', "不再显示"),
	currentSessionCategory: localize('currentSessionCategory', "当前会话"),
	previousSessionCategory: localize('previousSessionCategory', "上一个会话"),
	typeTask: localize('task', "任务"),
	typeLocal: localize('local', "本地"),
	actionCategory: localize2('terminalCategory', "终端"),
	focus: localize2('workbench.action.terminal.focus', "聚焦终端"),
	focusInstance: localize2('workbench.action.terminal.focusInstance', "聚焦终端"),
	focusAndHideAccessibleBuffer: localize2('workbench.action.terminal.focusAndHideAccessibleBuffer', "聚焦终端并隐藏无障碍缓冲区"),
	kill: {
		...localize2('killTerminal', "终止终端"),
		short: localize('killTerminal.short', "终止"),
	},
	moveToEditor: localize2('moveToEditor', "把终端移入编辑器区域"),
	moveIntoNewWindow: localize2('moveIntoNewWindow', "把终端移入新窗口"),
	newInNewWindow: localize2('newInNewWindow', "新建终端窗口"),
	moveToTerminalPanel: localize2('workbench.action.terminal.moveToTerminalPanel', "把终端移入面板"),
	changeIcon: localize2('workbench.action.terminal.changeIcon', "更改图标..."),
	changeColor: localize2('workbench.action.terminal.changeColor', "更改颜色..."),
	split: {
		...localize2('splitTerminal', "拆分终端"),
		short: localize('splitTerminal.short', "拆分"),
	},
	unsplit: localize2('unsplitTerminal', "取消拆分终端"),
	rename: localize2('workbench.action.terminal.rename', "重命名..."),
	toggleSizeToContentWidth: localize2('workbench.action.terminal.sizeToContentWidthInstance', "切换为按内容宽度调整大小"),
	focusHover: localize2('workbench.action.terminal.focusHover', "聚焦悬停"),
	newWithCwd: localize2('workbench.action.terminal.newWithCwd', "在自定义工作目录中创建新终端"),
	renameWithArgs: localize2('workbench.action.terminal.renameWithArg', "重命名当前活动的终端"),
	scrollToPreviousCommand: localize2('workbench.action.terminal.scrollToPreviousCommand', "滚动到上一条命令"),
	scrollToNextCommand: localize2('workbench.action.terminal.scrollToNextCommand', "滚动到下一条命令"),
	revealCommand: localize2('workbench.action.terminal.revealCommand', "在终端中显示该命令"),
};
