/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { AccessibleViewType, AccessibleContentProvider, IAccessibleViewContentProvider, AccessibleViewProviderId } from '../../../../platform/accessibility/browser/accessibleView.js';
import { IAccessibleViewImplementation } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import * as nls from '../../../../nls.js';
import { AccessibilityVerbositySettingId } from '../../accessibility/browser/accessibilityConfiguration.js';
import { OUTPUT_FILTER_FOCUS_CONTEXT } from '../../../services/output/common/output.js';

export class OutputAccessibilityHelp implements IAccessibleViewImplementation {
	readonly type = AccessibleViewType.Help;
	readonly priority = 105;
	readonly name = 'outputFilter';
	readonly when = OUTPUT_FILTER_FOCUS_CONTEXT;

	getProvider(accessor: ServicesAccessor): AccessibleContentProvider {
		return new OutputAccessibilityHelpProvider(accessor.get(IKeybindingService));
	}
}

class OutputAccessibilityHelpProvider extends Disposable implements IAccessibleViewContentProvider {
	readonly id = AccessibleViewProviderId.OutputFindHelp;
	readonly verbositySettingKey = AccessibilityVerbositySettingId.Find;
	readonly options = { type: AccessibleViewType.Help };

	constructor(
		private readonly _keybindingService: IKeybindingService,
	) {
		super();
	}

	provideContent(): string {
		const lines: string[] = [];

		// Header
		lines.push(nls.localize('output.header', "辅助功能帮助: 输出面板筛选器"));
		lines.push(nls.localize('output.context', "你位于“输出”面板筛选器输入中。这不是导航搜索。相反，它会立即隐藏与筛选器不匹配的行，以仅显示要查看的行。"));
		lines.push('');

		// Current Filter Status
		lines.push(nls.localize('output.statusHeader', "当前筛选状态："));
		lines.push(nls.localize('output.statusDesc', "你正在筛选输出。"));
		lines.push('');

		// Inside the Filter Input
		lines.push(nls.localize('output.inputHeader', "在筛选输入框内（它的作用）："));
		lines.push(nls.localize('output.inputDesc', "当你位于筛选器输入中时，焦点将停留在字段中。可以键入、编辑或调整筛选器，而无需退出输入。键入时，“输出”面板会立即更新，以仅显示与筛选器匹配的行。"));
		lines.push('');

		// What Happens When You Filter
		lines.push(nls.localize('output.filterHeader', "筛选时会发生什么："));
		lines.push(nls.localize('output.filterDesc1', "每次更改筛选器文本时，面板都会立即重新生成，以仅显示匹配的行。屏幕阅读器将播报现在可见的行数。这是实时反馈: 键入或删除字符时，显示的行将立即更新。"));
		lines.push(nls.localize('output.filterDesc2', "系统会将正在运行的程序中的新输出追加到面板并自动筛选，因此将立即显示匹配的新输出。"));
		lines.push('');

		// Focus Behavior
		lines.push(nls.localize('output.focusHeader', "焦点行为（重要）："));
		lines.push(nls.localize('output.focusDesc1', "当面板在后台更新时，焦点将保留在筛选器输入中。这是有意为之，以便你可以继续键入而不丢失位置。"));
		lines.push(nls.localize('output.focusDesc2', "如果要查看已筛选的输出，请按向下箭头将焦点从筛选器移到下面的输出内容中。"));
		lines.push(nls.localize('output.focusDesc3', "如果要清除筛选器并查看所有输出，请按 Esc 或删除所有筛选器文本。"));
		lines.push('');

		// Filter Syntax
		lines.push(nls.localize('output.syntaxHeader', "筛选语法与模式："));
		lines.push(nls.localize('output.syntaxText', "- 键入文本: 仅显示包含该文本的行(默认情况下不区分大小写)。"));
		lines.push(nls.localize('output.syntaxExclude', "- !text (排除): 隐藏包含 'text' 的行，以显示所有其他行。"));
		lines.push(nls.localize('output.syntaxEscape', "- \\\\!(转义): 使用反斜杠搜索文本 “!” 字符。"));
		lines.push(nls.localize('output.syntaxMultiple', "- text1、text2 (多个模式): 使用逗号分隔模式以显示与 ANY 模式匹配的行。"));
		lines.push(nls.localize('output.syntaxExample', "示例: 键入 \"error, warning\" 将显示包含 \"error\" 或 \"warning\" 的行。"));
		lines.push('');

		// Keyboard Navigation Summary
		lines.push(nls.localize('output.keyboardHeader', "键盘导航小结："));
		lines.push(nls.localize('output.keyDown', "- 向下箭头: 将焦点从筛选器移动到输出内容中。"));
		lines.push(nls.localize('output.keyTab', "- Tab: 移动到日志级别筛选器按钮(如果可用)。"));
		lines.push(nls.localize('output.keyEscape', "- Escape: 清除筛选器并返回以显示所有输出。"));
		lines.push('');

		// Settings
		lines.push(nls.localize('output.settingsHeader', "你可以调整的设置（{0} 打开设置）：", this._describeCommand('workbench.action.openSettings') || 'Ctrl+,'));
		lines.push(nls.localize('output.settingsIntro', "这些设置会影响输出面板的工作方式。"));
		lines.push(nls.localize('output.settingVerbosity', "- `accessibility.verbosity.find`：控制筛选输入框是否播报无障碍帮助提示。"));
		lines.push(nls.localize('output.settingSmartScroll', "- `output.smartScroll.enabled`: 消息到达时自动滚动到最新输出。"));
		lines.push('');

		// Closing
		lines.push(nls.localize('output.closingHeader', "关闭："));
		lines.push(nls.localize('output.closingDesc', "按 Esc 可清除筛选器并查看所有输出，或关闭“输出”面板。如果重新打开面板，则会保留筛选器文本。"));

		return lines.join('\n');
	}

	private _describeCommand(commandId: string): string | undefined {
		const kb = this._keybindingService.lookupKeybinding(commandId);
		return kb?.getAriaLabel() ?? undefined;
	}

	onClose(): void {
		// No-op
	}
}
