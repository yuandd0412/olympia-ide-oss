/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../nls.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import './commentsEditorContribution.js';
import { ICommentService, CommentService, IWorkspaceCommentThreadsEvent } from './commentService.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable, IDisposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { Extensions, IWorkbenchContribution, IWorkbenchContributionsRegistry } from '../../../common/contributions.js';
import { IActivityService, NumberBadge } from '../../../services/activity/common/activity.js';
import { COMMENTS_VIEW_ID } from './commentsTreeViewer.js';
import { CommentThreadState } from '../../../../editor/common/languages.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { CONTEXT_KEY_HAS_COMMENTS, CONTEXT_KEY_SOME_COMMENTS_EXPANDED, CommentsPanel } from './commentsView.js';
import { ViewAction } from '../../../browser/parts/views/viewPane.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { revealCommentThread } from './commentsController.js';
import { MarshalledCommentThreadInternal } from '../../../common/comments.js';
import { accessibleViewCurrentProviderId, accessibleViewIsShown } from '../../accessibility/browser/accessibilityConfiguration.js';
import { AccessibleViewProviderId } from '../../../../platform/accessibility/browser/accessibleView.js';
import { AccessibleViewRegistry } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { CommentsAccessibleView, CommentThreadAccessibleView } from './commentsAccessibleView.js';
import { CommentsAccessibilityHelp } from './commentsAccessibility.js';

registerAction2(class Collapse extends ViewAction<CommentsPanel> {
	constructor() {
		super({
			viewId: COMMENTS_VIEW_ID,
			id: 'comments.collapse',
			title: nls.localize('collapseAll', "全部折叠"),
			f1: false,
			icon: Codicon.collapseAll,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				when: ContextKeyExpr.and(ContextKeyExpr.and(ContextKeyExpr.equals('view', COMMENTS_VIEW_ID), CONTEXT_KEY_HAS_COMMENTS), CONTEXT_KEY_SOME_COMMENTS_EXPANDED),
				order: 100
			}
		});
	}
	runInView(_accessor: ServicesAccessor, view: CommentsPanel) {
		view.collapseAll();
	}
});

registerAction2(class Expand extends ViewAction<CommentsPanel> {
	constructor() {
		super({
			viewId: COMMENTS_VIEW_ID,
			id: 'comments.expand',
			title: nls.localize('expandAll', "全部展开"),
			f1: false,
			icon: Codicon.expandAll,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				when: ContextKeyExpr.and(ContextKeyExpr.and(ContextKeyExpr.equals('view', COMMENTS_VIEW_ID), CONTEXT_KEY_HAS_COMMENTS), ContextKeyExpr.not(CONTEXT_KEY_SOME_COMMENTS_EXPANDED.key)),
				order: 100
			}
		});
	}
	runInView(_accessor: ServicesAccessor, view: CommentsPanel) {
		view.expandAll();
	}
});

registerAction2(class Reply extends Action2 {
	constructor() {
		super({
			id: 'comments.reply',
			title: nls.localize('reply', "回复"),
			icon: Codicon.reply,
			precondition: ContextKeyExpr.equals('canReply', true),
			menu: [{
				id: MenuId.CommentsViewThreadActions,
				order: 100
			},
			{
				id: MenuId.AccessibleView,
				when: ContextKeyExpr.and(accessibleViewIsShown, ContextKeyExpr.equals(accessibleViewCurrentProviderId.key, AccessibleViewProviderId.Comments)),
			}]
		});
	}

	override run(accessor: ServicesAccessor, marshalledCommentThread: MarshalledCommentThreadInternal): void {
		const commentService = accessor.get(ICommentService);
		const editorService = accessor.get(IEditorService);
		const uriIdentityService = accessor.get(IUriIdentityService);
		revealCommentThread(commentService, editorService, uriIdentityService, marshalledCommentThread.thread, marshalledCommentThread.thread.comments![marshalledCommentThread.thread.comments!.length - 1], true);
	}
});

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'comments',
	order: 20,
	title: nls.localize('commentsConfigurationTitle', "注释"),
	type: 'object',
	properties: {
		'comments.openPanel': {
			enum: ['neverOpen', 'openOnSessionStart', 'openOnSessionStartWithComments'],
			default: 'openOnSessionStartWithComments',
			description: nls.localize('openComments', "控制批注面板何时打开。"),
			restricted: false,
			markdownDeprecationMessage: nls.localize('comments.openPanel.deprecated', "此设置已弃用，请改用 `comments.openView`。")
		},
		'comments.openView': {
			enum: ['never', 'file', 'firstFile', 'firstFileUnresolved'],
			enumDescriptions: [nls.localize('comments.openView.never', "批注视图永远不会被打开。"), nls.localize('comments.openView.file', "当激活的文件含有评论时打开批注视图。"), nls.localize('comments.openView.firstFile', "如果本次会话中批注视图尚未打开过，那么在首次激活含评论的文件时会自动打开。"), nls.localize('comments.openView.firstFileUnresolved', "如果本次会话中尚未打开批注视图且该批注未解决，那么在会话中首次激活带批注的文件时会打开该视图。")],
			default: 'firstFile',
			description: nls.localize('comments.openView', "控制批注视图何时打开。"),
			restricted: false
		},
		'comments.useRelativeTime': {
			type: 'boolean',
			default: true,
			description: nls.localize('useRelativeTime', "控制评论时间戳是否使用相对时间（例如「1 天前」）。")
		},
		'comments.visible': {
			type: 'boolean',
			default: true,
			description: nls.localize('comments.visible', "控制具有注释范围和注释的编辑器中注释栏和注释线程的可见性。注释仍可通过“注释”视图访问，并会导致以运行命令 “Comments: Toggle Editor Commenting” 切换注释的相同方式切换打开注释。")
		},
		'comments.maxHeight': {
			type: 'boolean',
			default: true,
			description: nls.localize('comments.maxHeight', "控制批注小部件是滚动还是展开。")
		},
		'comments.collapseOnResolve': {
			type: 'boolean',
			default: true,
			description: nls.localize('collapseOnResolve', "控制评论会话在解决后是否自动折叠。")
		},
		'comments.thread.confirmOnCollapse': {
			type: 'string',
			enum: ['whenHasUnsubmittedComments', 'never'],
			enumDescriptions: [nls.localize('confirmOnCollapse.whenHasUnsubmittedComments', "折叠含有未提交评论的会话时显示确认对话框。"), nls.localize('confirmOnCollapse.never', "折叠评论会话时从不显示确认对话框。")],
			default: 'whenHasUnsubmittedComments',
			description: nls.localize('confirmOnCollapse', "控制折叠评论会话时是否显示确认对话框。")
		}
	}
});

registerSingleton(ICommentService, CommentService, InstantiationType.Delayed);

export class UnresolvedCommentsBadge extends Disposable implements IWorkbenchContribution {
	private readonly activity = this._register(new MutableDisposable<IDisposable>());
	private totalUnresolved = 0;

	constructor(
		@ICommentService private readonly _commentService: ICommentService,
		@IActivityService private readonly activityService: IActivityService) {
		super();
		this._register(this._commentService.onDidSetAllCommentThreads(this.onAllCommentsChanged, this));
		this._register(this._commentService.onDidUpdateCommentThreads(this.onCommentsUpdated, this));
		this._register(this._commentService.onDidDeleteDataProvider(this.onCommentsUpdated, this));
	}

	private onAllCommentsChanged(e: IWorkspaceCommentThreadsEvent): void {
		let unresolved = 0;
		for (const thread of e.commentThreads) {
			if (thread.state === CommentThreadState.Unresolved) {
				unresolved++;
			}
		}
		this.updateBadge(unresolved);
	}

	private onCommentsUpdated(): void {
		let unresolved = 0;
		for (const resource of this._commentService.commentsModel.resourceCommentThreads) {
			for (const thread of resource.commentThreads) {
				if (thread.threadState === CommentThreadState.Unresolved) {
					unresolved++;
				}
			}
		}
		this.updateBadge(unresolved);
	}

	private updateBadge(unresolved: number) {
		if (unresolved === this.totalUnresolved) {
			return;
		}

		this.totalUnresolved = unresolved;
		const message = nls.localize('totalUnresolvedComments', "{0} 条未解决批注", this.totalUnresolved);
		this.activity.value = this.activityService.showViewActivity(COMMENTS_VIEW_ID, { badge: new NumberBadge(this.totalUnresolved, () => message) });
	}
}

Registry.as<IWorkbenchContributionsRegistry>(Extensions.Workbench).registerWorkbenchContribution(UnresolvedCommentsBadge, LifecyclePhase.Eventually);

AccessibleViewRegistry.register(new CommentsAccessibleView());
AccessibleViewRegistry.register(new CommentThreadAccessibleView());
AccessibleViewRegistry.register(new CommentsAccessibilityHelp());
