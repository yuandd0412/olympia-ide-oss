/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ctxCommentEditorFocused } from './simpleCommentEditor.js';
import { CommentContextKeys } from '../common/commentContextKeys.js';
import * as nls from '../../../../nls.js';
import { AccessibilityVerbositySettingId } from '../../accessibility/browser/accessibilityConfiguration.js';
import { CommentCommandId } from '../common/commentCommandIds.js';
import { ToggleTabFocusModeAction } from '../../../../editor/contrib/toggleTabFocusMode/browser/toggleTabFocusMode.js';
import { IAccessibleViewContentProvider, AccessibleViewProviderId, IAccessibleViewOptions, AccessibleViewType } from '../../../../platform/accessibility/browser/accessibleView.js';
import { IAccessibleViewImplementation } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { Disposable } from '../../../../base/common/lifecycle.js';


export namespace CommentAccessibilityHelpNLS {
	export const intro = nls.localize('intro', "编辑器中包含可评论范围。可用命令包括：");
	export const tabFocus = nls.localize('introWidget', "该部件包含一个用于编写新批注的文本框和若干操作。在使用\"切换 Tab 键移动焦点\"命令{0}启用 Tab 键移动焦点模式后，可用 Tab 键导航到这些操作。", `<keybinding:${ToggleTabFocusModeAction.ID}>`);
	export const commentCommands = nls.localize('commentCommands', "常用的评论命令包括：");
	export const escape = nls.localize('escape', "- 忽略评论{0}。", `<keybinding:${CommentCommandId.Hide}>`);
	export const nextRange = nls.localize('next', "- 转到下一个可评论范围{0}。", `<keybinding:${CommentCommandId.NextRange}>`);
	export const previousRange = nls.localize('previous', "- 转到上一个可评论范围{0}。", `<keybinding:${CommentCommandId.PreviousRange}>`);
	export const nextCommentThread = nls.localize('nextCommentThreadKb', "- 转到下一个评论会话{0}。", `<keybinding:${CommentCommandId.NextThread}>`);
	export const previousCommentThread = nls.localize('previousCommentThreadKb', "- 转到上一个评论会话{0}。", `<keybinding:${CommentCommandId.PreviousThread}>`);
	export const nextCommentedRange = nls.localize('nextCommentedRangeKb', "- 转到下一个已评论范围{0}。", `<keybinding:${CommentCommandId.NextCommentedRange}>`);
	export const previousCommentedRange = nls.localize('previousCommentedRangeKb', "- 转到上一个已评论范围{0}。", `<keybinding:${CommentCommandId.PreviousCommentedRange}>`);
	export const addComment = nls.localize('addCommentNoKb', "- 在当前选区上添加评论{0}。", `<keybinding:${CommentCommandId.Add}>`);
	export const submitComment = nls.localize('submitComment', "- 提交评论{0}。", `<keybinding:${CommentCommandId.Submit}>`);
}

export class CommentsAccessibilityHelpProvider extends Disposable implements IAccessibleViewContentProvider {
	id = AccessibleViewProviderId.Comments;
	verbositySettingKey: AccessibilityVerbositySettingId = AccessibilityVerbositySettingId.Comments;
	options: IAccessibleViewOptions = { type: AccessibleViewType.Help };
	private _element: HTMLElement | undefined;
	provideContent(): string {
		return [CommentAccessibilityHelpNLS.tabFocus, CommentAccessibilityHelpNLS.commentCommands, CommentAccessibilityHelpNLS.escape, CommentAccessibilityHelpNLS.addComment, CommentAccessibilityHelpNLS.submitComment, CommentAccessibilityHelpNLS.nextRange, CommentAccessibilityHelpNLS.previousRange].join('\n');
	}
	onClose(): void {
		this._element?.focus();
	}
}

export class CommentsAccessibilityHelp implements IAccessibleViewImplementation {
	readonly priority = 110;
	readonly name = 'comments';
	readonly type = AccessibleViewType.Help;
	readonly when = ContextKeyExpr.or(ctxCommentEditorFocused, CommentContextKeys.commentFocused);
	getProvider(accessor: ServicesAccessor) {
		return accessor.get(IInstantiationService).createInstance(CommentsAccessibilityHelpProvider);
	}
}
