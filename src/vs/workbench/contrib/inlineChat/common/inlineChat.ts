/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { MenuId } from '../../../../platform/actions/common/actions.js';
import { Extensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ContextKeyExpr, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { diffInserted, diffRemoved, editorWidgetBackground, editorWidgetBorder, editorWidgetForeground, focusBorder, inputBackground, inputPlaceholderForeground, registerColor, transparent, widgetShadow } from '../../../../platform/theme/common/colorRegistry.js';
import { NOTEBOOK_IS_ACTIVE_EDITOR } from '../../notebook/common/notebookContextKeys.js';

// settings

export const enum InlineChatConfigKeys {
	NotebookAgent = 'inlineChat.notebookAgent',
	DefaultModel = 'inlineChat.defaultModel',
	Affordance = 'inlineChat.affordance',
	FixDiagnostics = 'inlineChat.fixDiagnostics',
	AskInChat = 'inlineChat.askInChat',
}

Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerConfiguration({
	id: 'editor',
	properties: {
		[InlineChatConfigKeys.NotebookAgent]: {
			markdownDescription: localize('notebookAgent', "从笔记本中的内联聊天小组件启用类似智能体的行为。"),
			default: false,
			type: 'boolean',
			tags: ['experimental'],
			experiment: {
				mode: 'startup'
			}
		},
		[InlineChatConfigKeys.Affordance]: {
			description: localize('affordance', "控制选择文本时是否显示内联聊天提示。"),
			default: 'off',
			type: 'string',
			enum: ['off', 'editor'],
			enumDescriptions: [
				localize('affordance.off', "未显示任何提示。"),
				localize('affordance.editor', "在光标位置的编辑器中显示提示。"),
			],
			experiment: {
				mode: 'auto'
			},
			tags: ['experimental'],
			agentsWindow: { default: 'editor' },
		},
		[InlineChatConfigKeys.FixDiagnostics]: {
			description: localize('fixDiagnostics', "控制是否在编辑器中为诊断显示“修复”操作。"),
			default: true,
			type: 'boolean',
			experiment: {
				mode: 'auto'
			},
			tags: ['experimental']
		},
		[InlineChatConfigKeys.AskInChat]: {
			description: localize('askInChat', "控制聊天编辑会话中的文件是否使用“在聊天中提问”而不是“内联聊天”。"),
			default: true,
			type: 'boolean',
		},
	}
});


export const INLINE_CHAT_ID = 'editor.contrib.inlineChatController';

// --- CONTEXT
export const CTX_INLINE_CHAT_POSSIBLE = new RawContextKey<boolean>('inlineChatPossible', false, localize('inlineChatHasPossible', "内联聊天提供程序是否存在以及内联聊天的编辑器是否处于打开状态"));
export const CTX_INLINE_CHAT_HAS_AGENT = new RawContextKey<boolean>('inlineChatHasEditsAgent', false, localize('inlineChatHasEditsAgent', "交互式编辑器中是否存在内联聊天智能体"));
export const CTX_INLINE_CHAT_HAS_NOTEBOOK_INLINE = new RawContextKey<boolean>('inlineChatHasNotebookInline', false, localize('inlineChatHasNotebookInline', "是否存在适用于笔记本单元格的智能体"));
export const CTX_INLINE_CHAT_HAS_NOTEBOOK_AGENT = new RawContextKey<boolean>('inlineChatHasNotebookAgent', false, localize('inlineChatHasNotebookAgent', "是否存在适用于笔记本单元格的智能体"));
export const CTX_INLINE_CHAT_VISIBLE = new RawContextKey<boolean>('inlineChatVisible', false, localize('inlineChatVisible', "交互式编辑器输入是否可见"));
export const CTX_INLINE_CHAT_FOCUSED = new RawContextKey<boolean>('inlineChatFocused', false, localize('inlineChatFocused', "是否聚焦交互式编辑器输入"));
export const CTX_INLINE_CHAT_EDITING = new RawContextKey<boolean>('inlineChatEditing', true, localize('inlineChatEditing', "用户当前在内联聊天中是编辑代码还是生成代码"));
export const CTX_INLINE_CHAT_RESPONSE_FOCUSED = new RawContextKey<boolean>('inlineChatResponseFocused', false, localize('inlineChatResponseFocused', "交互式小组件的响应是否集中"));
export const CTX_INLINE_CHAT_EMPTY = new RawContextKey<boolean>('inlineChatEmpty', false, localize('inlineChatEmpty', "交互式编辑器输入是否为空"));
export const CTX_INLINE_CHAT_OUTER_CURSOR_POSITION = new RawContextKey<'above' | 'below' | ''>('inlineChatOuterCursorPosition', '', localize('inlineChatOuterCursorPosition', "外部编辑器的光标位于交互式编辑器输入的上方还是下方"));
export const CTX_INLINE_CHAT_REQUEST_IN_PROGRESS = new RawContextKey<boolean>('inlineChatRequestInProgress', false, localize('inlineChatRequestInProgress', "内联聊天请求当前是否正在进行"));
export const CTX_INLINE_CHAT_FILE_BELONGS_TO_CHAT = new RawContextKey<boolean>('inlineChatFileBelongsToChat', false, localize('inlineChatFileBelongsToChat', "当前文件是否属于聊天编辑会话"));
export const CTX_INLINE_CHAT_TERMINATED = new RawContextKey<boolean>('inlineChatTerminated', false, localize('inlineChatTerminated', "当前内联聊天会话是否已终止"));
export const CTX_INLINE_CHAT_AFFORDANCE_VISIBLE = new RawContextKey<boolean>('inlineChatAffordanceVisible', false, localize('inlineChatAffordanceVisible', "内联聊天提示小组件是否可见"));

export const CTX_INLINE_CHAT_V2_ENABLED = ContextKeyExpr.or(
	CTX_INLINE_CHAT_HAS_AGENT,
	ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, CTX_INLINE_CHAT_HAS_NOTEBOOK_AGENT)
);

export const CTX_FIX_DIAGNOSTICS_ENABLED = ContextKeyExpr.equals('config.inlineChat.fixDiagnostics', true);
export const CTX_ASK_IN_CHAT_ENABLED = ContextKeyExpr.equals('config.inlineChat.askInChat', true);

// --- (selected) action identifier

export const ACTION_START = 'inlineChat.start';
export const ACTION_ASK_IN_CHAT = 'inlineChat.askInChat';

// --- menus

export const MENU_INLINE_CHAT_WIDGET_SECONDARY = MenuId.for('inlineChatWidget.secondary');
export const MENU_INLINE_CHAT_SIDE = MenuId.for('inlineChatWidget.side');

// --- colors

export const inlineChatForeground = registerColor('inlineChat.foreground', editorWidgetForeground, localize('inlineChat.foreground', "交互式编辑器小组件的前景色"));
export const inlineChatBackground = registerColor('inlineChat.background', editorWidgetBackground, localize('inlineChat.background', "交互式编辑器小组件的背景色"));
export const inlineChatBorder = registerColor('inlineChat.border', editorWidgetBorder, localize('inlineChat.border', "交互式编辑器小组件的边框颜色"));
export const inlineChatShadow = registerColor('inlineChat.shadow', widgetShadow, localize('inlineChat.shadow', "交互式编辑器小组件的阴影颜色"));
export const inlineChatInputBorder = registerColor('inlineChatInput.border', editorWidgetBorder, localize('inlineChatInput.border', "交互式编辑器输入的边框颜色"));
export const inlineChatInputFocusBorder = registerColor('inlineChatInput.focusBorder', focusBorder, localize('inlineChatInput.focusBorder', "聚焦时交互式编辑器输入的边框颜色"));
export const inlineChatInputPlaceholderForeground = registerColor('inlineChatInput.placeholderForeground', inputPlaceholderForeground, localize('inlineChatInput.placeholderForeground', "交互式编辑器输入占位符的前景色"));
export const inlineChatInputBackground = registerColor('inlineChatInput.background', inputBackground, localize('inlineChatInput.background', "交互式编辑器输入的背景色"));

export const inlineChatDiffInserted = registerColor('inlineChatDiff.inserted', transparent(diffInserted, .5), localize('inlineChatDiff.inserted', "交互式编辑器输入中已插入文本的背景色"));
export const overviewRulerInlineChatDiffInserted = registerColor('editorOverviewRuler.inlineChatInserted', { dark: transparent(diffInserted, 0.6), light: transparent(diffInserted, 0.8), hcDark: transparent(diffInserted, 0.6), hcLight: transparent(diffInserted, 0.8) }, localize('editorOverviewRuler.inlineChatInserted', "内联聊天插入内容的概述标尺的标记颜色。"));
export const minimapInlineChatDiffInserted = registerColor('editorMinimap.inlineChatInserted', { dark: transparent(diffInserted, 0.6), light: transparent(diffInserted, 0.8), hcDark: transparent(diffInserted, 0.6), hcLight: transparent(diffInserted, 0.8) }, localize('editorMinimap.inlineChatInserted', "插入了内联聊天的内容的缩略图标记颜色。"));

export const inlineChatDiffRemoved = registerColor('inlineChatDiff.removed', transparent(diffRemoved, .5), localize('inlineChatDiff.removed', "交互式编辑器输入中已删除文本的背景色"));
export const overviewRulerInlineChatDiffRemoved = registerColor('editorOverviewRuler.inlineChatRemoved', { dark: transparent(diffRemoved, 0.6), light: transparent(diffRemoved, 0.8), hcDark: transparent(diffRemoved, 0.6), hcLight: transparent(diffRemoved, 0.8) }, localize('editorOverviewRuler.inlineChatRemoved', "内联聊天删除的内容的概述标尺的标记颜色。"));
