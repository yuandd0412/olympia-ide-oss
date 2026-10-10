/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../nls.js';
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';


export namespace CommentContextKeys {

	/**
	 * A context key that is set when the active cursor is in a commenting range.
	 */
	export const activeCursorHasCommentingRange = new RawContextKey<boolean>('activeCursorHasCommentingRange', false, {
		description: nls.localize('hasCommentingRange', "活动光标所在位置是否有批注范围"),
		type: 'boolean'
	});

	/**
	 * A context key that is set when the active cursor is in the range of an existing comment.
	 */
	export const activeCursorHasComment = new RawContextKey<boolean>('activeCursorHasComment', false, {
		description: nls.localize('hasComment', "活动光标所在位置是否有批注"),
		type: 'boolean'
	});

	/**
	 * A context key that is set when the active editor has commenting ranges.
	 */
	export const activeEditorHasCommentingRange = new RawContextKey<boolean>('activeEditorHasCommentingRange', false, {
		description: nls.localize('editorHasCommentingRange', "活动编辑器是否有批注范围"),
		type: 'boolean'
	});

	/**
	 * A context key that is set when the workspace has either comments or commenting ranges.
	 */
	export const WorkspaceHasCommenting = new RawContextKey<boolean>('workspaceHasCommenting', false, {
		description: nls.localize('hasCommentingProvider', "打开的工作区是否包含批注或批注范围。"),
		type: 'boolean'
	});

	/**
	 * A context key that is set when the comment thread has no comments.
	 */
	export const commentThreadIsEmpty = new RawContextKey<boolean>('commentThreadIsEmpty', false, { type: 'boolean', description: nls.localize('commentThreadIsEmpty', "当批注线程没有批注时设置") });
	/**
	 * A context key that is set when the comment has no input.
	 */
	export const commentIsEmpty = new RawContextKey<boolean>('commentIsEmpty', false, { type: 'boolean', description: nls.localize('commentIsEmpty', "当批注没有输入内容时设置") });
	/**
	 * The context value of the comment.
	 */
	export const commentContext = new RawContextKey<string>('comment', undefined, { type: 'string', description: nls.localize('comment', "批注的上下文值") });
	/**
	 * The context value of the comment thread.
	 */
	export const commentThreadContext = new RawContextKey<string>('commentThread', undefined, { type: 'string', description: nls.localize('commentThread', "批注线程的上下文值") });
	/**
	 * The comment controller id associated with a comment thread.
	 */
	export const commentControllerContext = new RawContextKey<string>('commentController', undefined, { type: 'string', description: nls.localize('commentController', "与批注线程关联的批注控制器 ID") });

	/**
	 * The comment widget is focused.
	 */
	export const commentFocused = new RawContextKey<boolean>('commentFocused', false, { type: 'boolean', description: nls.localize('commentFocused', "当批注获得焦点时设置") });

	/**
	 * A context key that is set when a comment widget is visible in the editor.
	 */
	export const commentWidgetVisible = new RawContextKey<boolean>('commentWidgetVisible', false, { type: 'boolean', description: nls.localize('commentWidgetVisible', "当编辑器中显示批注部件时设置") });

	/**
	 * A context key that is set when commenting is enabled.
	 */
	export const commentingEnabled = new RawContextKey<boolean>('commentingEnabled', true, {
		description: nls.localize('commentingEnabled', "是否启用批注功能"),
		type: 'boolean'
	});
}
