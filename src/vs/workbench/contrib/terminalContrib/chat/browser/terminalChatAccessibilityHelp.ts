/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../../nls.js';
import { AccessibleViewProviderId, AccessibleViewType, AccessibleContentProvider } from '../../../../../platform/accessibility/browser/accessibleView.js';
import { IAccessibleViewImplementation } from '../../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { AccessibilityVerbositySettingId } from '../../../accessibility/browser/accessibilityConfiguration.js';
import { ITerminalService } from '../../../terminal/browser/terminal.js';
import { TerminalChatCommandId, TerminalChatContextKeys } from './terminalChat.js';
import { TerminalChatController } from './terminalChatController.js';

export class TerminalChatAccessibilityHelp implements IAccessibleViewImplementation {
	readonly priority = 110;
	readonly name = 'terminalChat';
	readonly when = TerminalChatContextKeys.focused;
	readonly type = AccessibleViewType.Help;
	getProvider(accessor: ServicesAccessor) {
		const terminalService = accessor.get(ITerminalService);

		const instance = terminalService.activeInstance;
		if (!instance) {
			return;
		}

		const helpText = getAccessibilityHelpText(accessor);
		return new AccessibleContentProvider(
			AccessibleViewProviderId.TerminalChat,
			{ type: AccessibleViewType.Help },
			() => helpText,
			() => TerminalChatController.get(instance)?.terminalChatWidget?.focus(),
			AccessibilityVerbositySettingId.TerminalInlineChat,
		);
	}
}

export function getAccessibilityHelpText(accessor: ServicesAccessor): string {
	const keybindingService = accessor.get(IKeybindingService);
	const content = [];
	const openAccessibleViewKeybinding = keybindingService.lookupKeybinding('editor.action.accessibleView')?.getAriaLabel();
	const runCommandKeybinding = keybindingService.lookupKeybinding(TerminalChatCommandId.RunCommand)?.getAriaLabel();
	const insertCommandKeybinding = keybindingService.lookupKeybinding(TerminalChatCommandId.InsertCommand)?.getAriaLabel();
	const makeRequestKeybinding = keybindingService.lookupKeybinding(TerminalChatCommandId.MakeRequest)?.getAriaLabel();
	const startChatKeybinding = keybindingService.lookupKeybinding(TerminalChatCommandId.Start)?.getAriaLabel();
	const focusResponseKeybinding = keybindingService.lookupKeybinding('chat.action.focus')?.getAriaLabel();
	const focusInputKeybinding = keybindingService.lookupKeybinding('workbench.action.chat.focusInput')?.getAriaLabel();
	content.push(localize('inlineChat.overview', "内联对话在终端中进行，适合用来建议终端命令。请注意 AI 生成的代码可能有误。"));
	content.push(localize('inlineChat.access', "可以用命令「终端: 开始对话（{0}）」激活，它会聚焦到输入框。", startChatKeybinding));
	content.push(makeRequestKeybinding ? localize('inlineChat.input', "输入框是用户可以键入请求并可以发出请求的位置({0})。按 Escape 键后，将会关闭小组件并放弃所有内容，然后终端将重新处于焦点模式。", makeRequestKeybinding) : localize('inlineChat.inputNoKb', "输入框是用户可以键入请求，并且可以通过按 Tab 键转到“发出请求”按钮来发出请求的位置，目前无法通过键绑定触发此操作。按 Escape 键后，将会关闭小组件并放弃所有内容，然后终端将重新处于焦点模式。"));
	content.push(openAccessibleViewKeybinding ? localize('inlineChat.inspectResponseMessage', "可以在无障碍视图({0})中检查响应。", openAccessibleViewKeybinding) : localize('inlineChat.inspectResponseNoKb', "在以输入框为焦点时，通过“打开可访问视图”命令检查可访问视图中的响应，该命令当前无法通过键绑定触发。"));
	content.push(focusResponseKeybinding ? localize('inlineChat.focusResponse', "从输入框({0})访问响应。", focusResponseKeybinding) : localize('inlineChat.focusResponseNoKb', "通过按 Tab 键或为命令“焦点终端响应”分配键绑定，从输入框访问响应。"));
	content.push(focusInputKeybinding ? localize('inlineChat.focusInput', "从响应访问输入框({0})。", focusInputKeybinding) : localize('inlineChat.focusInputNoKb', "通过 shift+tabbing 或为命令: 焦点终端输入分配键绑定，从输入框访问响应。"));
	content.push(runCommandKeybinding ? localize('inlineChat.runCommand', "焦点位于输入框或命令编辑器中时，执行终端: 运行聊天命令({0})操作。", runCommandKeybinding) : localize('inlineChat.runCommandNoKb', "通过按 Tab 键转到按钮来运行命令，因为当前无法通过键绑定触发操作。"));
	content.push(insertCommandKeybinding ? localize('inlineChat.insertCommand', "在焦点放在输入框命令编辑器中时，执行终端: 插入聊天命令({0})操作。", insertCommandKeybinding) : localize('inlineChat.insertCommandNoKb', "通过按 Tab 键切换到按钮来插入命令，因为当前该操作不能通过键绑定触发。"));
	content.push(localize('inlineChat.toolbar', "按 Tab 键可访问命令、状态、消息回复等条件性内容。"));
	content.push(localize('chat.signals', "可通过带有 signals.chat 前缀的设置更改辅助功能信号。默认情况下，如果请求超过 4 秒，你将听到一个声音，指示仍在进行中。"));
	return content.join('\n');
}
