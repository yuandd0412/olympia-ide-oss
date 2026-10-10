/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { AccessibleContentProvider, AccessibleViewProviderId, AccessibleViewType } from '../../../../platform/accessibility/browser/accessibleView.js';
import { IAccessibleViewImplementation } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { AccessibilityVerbositySettingId } from '../../accessibility/browser/accessibilityConfiguration.js';
import { KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_FOCUSED } from '../../webview/browser/webview.js';
import { CONTEXT_ACTIVE_WEBVIEW_PANEL_ID } from '../../webviewPanel/browser/webviewEditor.js';
import { WebviewInput } from '../../webviewPanel/browser/webviewEditorInput.js';

export class ReleaseNotesAccessibilityHelp implements IAccessibleViewImplementation {
	readonly priority = 100;
	readonly name = 'releaseNotes';
	readonly type = AccessibleViewType.Help;
	readonly when = ContextKeyExpr.and(CONTEXT_ACTIVE_WEBVIEW_PANEL_ID.isEqualTo('releaseNotes'), KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_FOCUSED.toNegated());

	getProvider(accessor: ServicesAccessor): AccessibleContentProvider | undefined {
		const editorService = accessor.get(IEditorService);
		const input = editorService.activeEditor;
		if (!(input instanceof WebviewInput) || input.viewType !== 'releaseNotes' || !input.webview.isFocused) {
			return undefined;
		}
		return new AccessibleContentProvider(
			AccessibleViewProviderId.ReleaseNotes,
			{ type: AccessibleViewType.Help },
			() => [
				localize('releaseNotes.help.overview', "你正处于发行说明中。使用屏幕阅读器的阅读和标题导航命令来浏览该文档及其目录。"),
				localize('releaseNotes.help.navigation', "按 Tab 或 Shift+Tab 可在链接、设置、更新偏好复选框和可用的安装操作之间移动。按 Enter 可激活链接，按空格或 Enter 可激活安装按钮。"),
				localize('releaseNotes.help.tryouts', "Try This links open locally registered feature examples. Reading, hovering, or focusing a link does not run it. If an example is unavailable, its explanation and any available setup action appear beside it. Setup does not automatically run the example."),
				localize('releaseNotes.help.windows', "某些操作会打开另一个编辑器或窗口，包括智能体窗口。对话示例只是为你准备一份待审阅的输入，不会自动发送。"),
				localize('releaseNotes.help.find', "使用 {0} 在发行说明中查找文本。查找输入框有其自己的无障碍帮助。", '<keybinding:editor.action.webvieweditor.showFind>'),
				localize('releaseNotes.help.close', "按 Escape 键关闭此帮助并把焦点交还发行说明。"),
			].join('\n\n'),
			() => {
				if (!input.isDisposed() && editorService.activeEditor === input) {
					input.webview.focus();
				}
			},
			AccessibilityVerbositySettingId.ReleaseNotes,
		);
	}
}
