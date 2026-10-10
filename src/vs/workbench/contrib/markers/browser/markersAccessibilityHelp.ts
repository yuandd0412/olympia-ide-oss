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
import { MarkersContextKeys } from '../common/markers.js';

export class ProblemsAccessibilityHelp implements IAccessibleViewImplementation {
	readonly type = AccessibleViewType.Help;
	readonly priority = 105;
	readonly name = 'problemsFilter';
	readonly when = MarkersContextKeys.MarkerViewFilterFocusContextKey;

	getProvider(accessor: ServicesAccessor): AccessibleContentProvider {
		return new ProblemsAccessibilityHelpProvider(accessor.get(IKeybindingService));
	}
}

class ProblemsAccessibilityHelpProvider extends Disposable implements IAccessibleViewContentProvider {
	readonly id = AccessibleViewProviderId.ProblemsFilterHelp;
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
		lines.push(nls.localize('problems.header', "辅助功能帮助: 问题面板筛选器"));
		lines.push(nls.localize('problems.context', "你位于“问题”面板筛选器输入中。这是筛选器，而不是导航搜索。它会立即隐藏与筛选器不匹配的问题，仅显示要看到的问题。"));
		lines.push('');

		// Current Filter Status
		lines.push(nls.localize('problems.statusHeader', "当前筛选状态："));
		lines.push(nls.localize('problems.statusDesc', "你正在筛选问题。"));
		lines.push('');

		// Inside the Filter Input
		lines.push(nls.localize('problems.inputHeader', "在筛选输入框内（它的作用）："));
		lines.push(nls.localize('problems.inputDesc', "当你位于筛选器输入中时，焦点将停留在字段中。可以键入、编辑或调整筛选器，而无需退出输入。键入时，“问题”面板会立即更新，以仅显示与筛选器匹配的问题。"));
		lines.push('');

		// What Happens When You Filter
		lines.push(nls.localize('problems.filterHeader', "筛选时会发生什么："));
		lines.push(nls.localize('problems.filterDesc1', "每次更改筛选器文本时，面板都会立即重新生成，以仅显示匹配的问题。屏幕阅读器会播报当前可见的问题数量。这是实时反馈: 键入或删除字符时，显示的问题将立即更新。"));
		lines.push(nls.localize('problems.filterDesc2', "该面板搜索问题消息、文件名和错误代码，以便你可以按这些详细信息中的任何一个进行筛选。"));
		lines.push('');

		// Focus Behavior
		lines.push(nls.localize('problems.focusHeader', "焦点行为（重要）："));
		lines.push(nls.localize('problems.focusDesc1', "当面板在后台更新时，焦点将保留在筛选器输入中。这是有意为之，以便你可以继续键入而不丢失位置。"));
		lines.push(nls.localize('problems.focusDesc2', "如果要导航筛选的问题，请按向下箭头将焦点从筛选器移到下面的问题列表中。"));
		lines.push(nls.localize('problems.focusDesc3', "当问题成为焦点时，请按 Enter 在编辑器中导航到该问题。"));
		lines.push(nls.localize('problems.focusDesc4', "如果要清除筛选器并查看所有问题，请按 Esc 或删除所有筛选器文本。"));
		lines.push('');

		// Filter Syntax
		lines.push(nls.localize('problems.syntaxHeader', "筛选语法与模式："));
		lines.push(nls.localize('problems.syntaxText', "- 键入文本: 显示其消息、文件路径或代码包含该文本的问题。"));
		lines.push(nls.localize('problems.syntaxExclude', "- !text (排除): 隐藏包含文本的问题，显示所有其他内容。"));
		lines.push(nls.localize('problems.syntaxExample', "示例: 键入 \"node_modules\" 可隐藏 node_modules 中的所有问题。"));
		lines.push('');

		// Severity and Scope Filtering
		lines.push(nls.localize('problems.severityHeader', "严重性和范围筛选:"));
		lines.push(nls.localize('problems.severityIntro', "筛选器输入上方是严重级别和范围的切换按钮:"));
		lines.push(nls.localize('problems.severityErrors', "- 错误按钮: 切换以显示或隐藏错误问题。"));
		lines.push(nls.localize('problems.severityWarnings', "- 警告按钮: 切换以显示或隐藏警告问题。"));
		lines.push(nls.localize('problems.severityInfo', "- 信息按钮: 切换以显示或隐藏信息性问题。"));
		lines.push(nls.localize('problems.severityActiveFile', "-“仅活跃文件”按钮: 启用后，仅显示当前打开的文件中的问题。"));
		lines.push(nls.localize('problems.severityConclusion', "这些按钮与文本筛选器协同工作。"));
		lines.push('');

		// Keyboard Navigation Summary
		lines.push(nls.localize('problems.keyboardHeader', "键盘导航小结："));
		lines.push(nls.localize('problems.keyDown', "- 向下箭头: 将焦点从筛选器移动到问题列表中。"));
		lines.push(nls.localize('problems.keyTab', "- 选项卡: 移动到严重性和范围切换按钮。"));
		lines.push(nls.localize('problems.keyEnter', "- Enter (出现问题时): 在编辑器中导航到该问题。"));
		lines.push(nls.localize('problems.keyF8', "- {0}: 从编辑器中的任何位置全局移动到下一个问题。", this._describeCommand('editor.action.marker.nextInFiles') || 'F8'));
		lines.push(nls.localize('problems.keyShiftF8', "- {0}: 从编辑器中的任何位置全局移动到上一个问题。", this._describeCommand('editor.action.marker.prevInFiles') || 'Shift+F8'));
		lines.push(nls.localize('problems.keyEscape', "- Esc: 清除筛选器并返回以显示所有问题。"));
		lines.push('');

		// Settings
		lines.push(nls.localize('problems.settingsHeader', "你可以调整的设置（{0} 打开设置）：", this._describeCommand('workbench.action.openSettings') || 'Ctrl+,'));
		lines.push(nls.localize('problems.settingsIntro', "这些设置会影响“问题”面板。"));
		lines.push(nls.localize('problems.settingVerbosity', "- `accessibility.verbosity.find`：控制筛选输入框是否播报无障碍帮助提示。"));
		lines.push(nls.localize('problems.settingAutoReveal', "- `problems.autoReveal`: 选择问题时自动在编辑器中显示问题。"));
		lines.push(nls.localize('problems.settingViewMode', "- `problems.defaultViewMode`: 将问题显示为表或树。"));
		lines.push(nls.localize('problems.settingSortOrder', "- `problems.sortOrder`: 按严重性或位置对问题进行排序。"));
		lines.push(nls.localize('problems.settingShowCurrent', "- `problems.showCurrentInStatus`: 在状态栏中显示当前问题。"));
		lines.push('');

		// Closing
		lines.push(nls.localize('problems.closingHeader', "关闭："));
		lines.push(nls.localize('problems.closingDesc', "按 Esc 清除筛选器并查看所有问题。如果重新打开面板，则会保留筛选器文本。问题会从整个工作区显示；使用“仅活跃文件”可将焦点放在单个文件上。"));

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
