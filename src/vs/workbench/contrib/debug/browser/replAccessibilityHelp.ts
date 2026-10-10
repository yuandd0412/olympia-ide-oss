/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { AccessibleViewProviderId, AccessibleViewType, IAccessibleViewContentProvider } from '../../../../platform/accessibility/browser/accessibleView.js';
import { IAccessibleViewImplementation } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { getReplView, Repl } from './repl.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { AccessibilityVerbositySettingId } from '../../accessibility/browser/accessibilityConfiguration.js';
import { localize } from '../../../../nls.js';
import { CONTEXT_IN_DEBUG_REPL } from '../common/debug.js';

export class ReplAccessibilityHelp implements IAccessibleViewImplementation {
	priority = 120;
	name = 'replHelp';
	when = ContextKeyExpr.or(
		ContextKeyExpr.equals('focusedView', 'workbench.panel.repl.view'),
		CONTEXT_IN_DEBUG_REPL
	);
	type: AccessibleViewType = AccessibleViewType.Help;
	getProvider(accessor: ServicesAccessor) {
		const viewsService = accessor.get(IViewsService);
		const replView = getReplView(viewsService);
		if (!replView) {
			return undefined;
		}
		return new ReplAccessibilityHelpProvider(replView);
	}
}

class ReplAccessibilityHelpProvider extends Disposable implements IAccessibleViewContentProvider {
	public readonly id = AccessibleViewProviderId.ReplHelp;
	public readonly verbositySettingKey = AccessibilityVerbositySettingId.Find;
	public readonly options = { type: AccessibleViewType.Help };
	constructor(private readonly _replView: Repl) {
		super();
	}

	public onClose(): void {
		this._replView.focusFilter();
	}

	public provideContent(): string {
		const content: string[] = [];

		// Header
		content.push(localize('repl.header', "无障碍帮助：调试控制台筛选"));
		content.push(localize('repl.context', "你位于调试控制台筛选器输入框中。该筛选器会即时隐藏与筛选器不匹配的控制台消息，仅显示你想要查看的消息。"));
		content.push('');

		// Current Filter Status
		content.push(localize('repl.statusHeader', "当前筛选状态："));
		content.push(localize('repl.statusDesc', "你正在筛选控制台输出。"));
		content.push('');

		// Inside the Filter Input
		content.push(localize('repl.inputHeader', "在筛选输入框内（它的作用）："));
		content.push(localize('repl.inputDesc', "当你位于筛选器输入中时，焦点将停留在字段中。可以键入、编辑或调整筛选器，而无需退出输入。键入时，控制台会立即更新，以仅显示与筛选器匹配的消息。"));
		content.push('');

		// What Happens When You Filter
		content.push(localize('repl.filterHeader', "筛选时会发生什么："));
		content.push(localize('repl.filterDesc', "每次更改筛选器文本时，控制台都会立即重新生成，以仅显示匹配的消息。屏幕阅读器将播报现在可见的消息数。这是实时反馈: 文本搜索控制台输出、变量值和日志消息。"));
		content.push('');

		// Focus Behavior
		content.push(localize('repl.focusHeader', "焦点行为（重要）："));
		content.push(localize('repl.focusDesc1', "控制台在后台更新时，你的焦点会保留在筛选输入框内。这是有意设计的，让你无需移开视线即可继续输入。"));
		content.push(localize('repl.focusDesc2', "如果要查看筛选后的控制台输出，按下箭头键把焦点从筛选框移到上方的控制台消息。"));
		content.push(localize('repl.focusDesc3', "重要提示: 控制台输入区域位于控制台底部(与筛选器分开)。要对表达式求值，请导航到控制台输入(筛选的消息之后)并键入表达式。"));
		content.push('');

		// Distinguishing Filter from Console Input
		content.push(localize('repl.distinguishHeader', "区分筛选框与控制台输入："));
		content.push(localize('repl.distinguishFilter', "你现在所在的是筛选输入框。它只隐藏或显示消息，不会运行代码。"));
		content.push(localize('repl.distinguishConsole', "控制台输入位于控制台底部(所有显示的消息之后)。这就是在调试期间键入并按 Enter 以对表达式求值的位置。"));
		content.push(localize('repl.distinguishSwitch', "要切换到控制台输入框并求值表达式，请使用 {0} 聚焦到控制台输入。", '<keybinding:workbench.panel.repl.view.focus>'));
		content.push('');

		// Filter Syntax
		content.push(localize('repl.syntaxHeader', "筛选语法与模式："));
		content.push(localize('repl.syntaxText', "- 输入文本：仅显示包含该文本的消息。"));
		content.push(localize('repl.syntaxExclude', "- !文本（排除）：隐藏包含该文本的消息，显示其他所有消息。"));
		content.push('');

		// Keyboard Navigation Summary
		content.push(localize('repl.keyboardHeader', "键盘导航小结："));
		content.push(localize('repl.keyDown', "- 箭头下键：把焦点从筛选框移到控制台输出。"));
		content.push(localize('repl.keyTab', "- Tab：移动到其他控制台控件（如果有）。"));
		content.push(localize('repl.keyEscape', "- Escape：清除筛选条件或关闭筛选框。"));
		content.push(localize('repl.keyFocus', "- {0}：聚焦到控制台输入框以求值表达式。", '<keybinding:workbench.panel.repl.view.focus>'));
		content.push('');

		// Settings
		content.push(localize('repl.settingsHeader', "你可以调整的设置（{0} 打开设置）：", '<keybinding:workbench.action.openSettings>'));
		content.push(localize('repl.settingsIntro', "以下设置会影响调试控制台。"));
		content.push(localize('repl.settingVerbosity', "- `accessibility.verbosity.find`：控制筛选输入框是否播报无障碍帮助提示。"));
		content.push(localize('repl.settingCloseOnEnd', "- `debug.console.closeOnEnd`：调试会话结束时自动关闭调试控制台。"));
		content.push(localize('repl.settingFontSize', "- `debug.console.fontSize`：控制台中的字号。"));
		content.push(localize('repl.settingFontFamily', "- `debug.console.fontFamily`：控制台中的字体。"));
		content.push(localize('repl.settingWordWrap', "- `debug.console.wordWrap`：控制台中自动换行。"));
		content.push(localize('repl.settingHistory', "- `debug.console.historySuggestions`：建议之前输入过的内容。"));
		content.push(localize('repl.settingCollapse', "- `debug.console.collapseIdenticalLines`：将重复消息折叠并显示次数。"));
		content.push(localize('repl.settingMaxLines', "- `debug.console.maximumLines`：控制台保留的最大消息条数。"));
		content.push('');

		// Closing
		content.push(localize('repl.closingHeader', "关闭："));
		content.push(localize('repl.closingDesc', "按 Escape 清除筛选条件，或关闭调试控制台。重新打开控制台时你的筛选文本会被保留。"));

		return content.join('\n');
	}
}

