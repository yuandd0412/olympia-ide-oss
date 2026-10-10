/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Agent-sessions color tokens.
//
// Registrations live here in the sessions layer. The workbench entry point
// (`workbench.common.main.ts`) imports this file as a side-effect so the
// tokens are present in the global color registry and JSON theme schema
// for both the main workbench and the sessions workbench.

import { localize } from '../../nls.js';
import { Color } from '../../base/common/color.js';
import { darken, lighten, registerColor, transparent } from '../../platform/theme/common/colorUtils.js';
import { contrastBorder, focusBorder } from '../../platform/theme/common/colorRegistry.js';
import { editorWidgetBackground, editorWidgetBorder, editorBackground, toolbarHoverBackground } from '../../platform/theme/common/colors/editorColors.js';
import { foreground } from '../../platform/theme/common/colors/baseColors.js';
import { buttonBackground, buttonSecondaryBorder, inputBackground, inputBorder, inputForeground, inputPlaceholderForeground } from '../../platform/theme/common/colors/inputColors.js';
import { ACTIVITY_BAR_BADGE_BACKGROUND, ACTIVITY_BAR_BADGE_FOREGROUND, SIDE_BAR_BACKGROUND, SIDE_BAR_FOREGROUND } from '../../workbench/common/theme.js';

// ============================================================================
// Shell background (used by the gradient system)
// ============================================================================

export const agentsBackground = registerColor(
	'agents.background',
	{ dark: editorBackground, light: SIDE_BAR_BACKGROUND, hcDark: editorBackground, hcLight: editorBackground },
	localize('agents.background', "智能体会话窗口 shell 和渐变底色的背景色。")
);

// ============================================================================
// Panels (chat panel, auxiliary bar, terminal panel)
// ============================================================================

export const agentsPanelBackground = registerColor(
	'agentsPanel.background',
	{ dark: SIDE_BAR_BACKGROUND, light: editorBackground, hcDark: SIDE_BAR_BACKGROUND, hcLight: SIDE_BAR_BACKGROUND },
	localize('agentsPanel.background', "智能体会话窗口中卡片面板(聊天、文件、终端)的背景色。")
);

export const agentsDetailBackground = registerColor(
	'agentsDetail.background', editorBackground,
	localize('agentsDetail.background', 'Background color of the docked details pane in the agent sessions window.')
);

export const agentsPanelForeground = registerColor(
	'agentsPanel.foreground', SIDE_BAR_FOREGROUND,
	localize('agentsPanel.foreground', "智能体会话窗口中卡片面板(聊天、文件、终端)的前景色。")
);

export const agentsPanelBorder = registerColor(
	'agentsPanel.border',
	{ dark: transparent(foreground, 0.15), light: transparent(foreground, 0.15), hcDark: contrastBorder, hcLight: contrastBorder },
	localize('agentsPanel.border', "智能体会话窗口中卡片面板(聊天、文件、终端)的边框色。")
);

export const agentsCardBorder = registerColor(
	'agentsCard.border', agentsPanelBorder,
	localize('agentsCard.border', 'Border color of the floating content card (sessions grid and custom view grid) in the agent sessions window.')
);

export const agentsBottomPanelBorder = registerColor(
	'agentsBottomPanel.border', agentsPanelBorder,
	localize('agentsBottomPanel.border', 'Border color of the bottom panel in the agent sessions window.')
);

// ============================================================================
// Gradient background tint
// ============================================================================

export const agentsGradientTintColor = registerColor(
	'agentsGradient.tintColor', buttonBackground,
	localize('agentsGradient.tintColor', "智能体会话窗口 shell 背景渐变中使用的色调。")
);

// ============================================================================
// Agent feedback editor widgets
// ============================================================================

export const agentFeedbackEditorWidgetBackground = registerColor(
	'agentFeedbackEditorWidget.background',
	{ dark: lighten(editorWidgetBackground, 0.08), light: darken(editorWidgetBackground, 0.04), hcDark: Color.black, hcLight: Color.white },
	localize('agentFeedbackEditorWidget.background', "编辑器中显示的智能体反馈小组件的背景色。")
);

export const agentFeedbackEditorWidgetBorder = registerColor(
	'agentFeedbackEditorWidget.border',
	{ dark: transparent(foreground, 0.35), light: transparent(foreground, 0.35), hcDark: contrastBorder, hcLight: contrastBorder },
	localize('agentFeedbackEditorWidget.border', "编辑器中显示的智能体反馈小组件的边框颜色。")
);

export const agentFeedbackInputWidgetBorder = registerColor(
	'agentFeedbackInputWidget.border',
	{ dark: editorWidgetBorder, light: editorWidgetBorder, hcDark: contrastBorder, hcLight: contrastBorder },
	localize('agentFeedbackInputWidget.border', "编辑器中显示的智能体反馈输入小组件的边框颜色。")
);

// ============================================================================
// Update button
// ============================================================================

export const agentsUpdateButtonDownloadingBackground = registerColor(
	'agentsUpdateButton.downloadingBackground', transparent(buttonBackground, 0.4),
	localize('agentsUpdateButton.downloadingBackground', "用于在智能体会话窗口中显示下载进度的更新按钮的背景色。")
);

export const agentsUpdateButtonDownloadedBackground = registerColor(
	'agentsUpdateButton.downloadedBackground', transparent(buttonBackground, 0.7),
	localize('agentsUpdateButton.downloadedBackground', "在智能体会话窗口中完成下载时更新按钮的背景色。")
);

// ============================================================================
// Chat input
// ============================================================================

export const agentsChatInputBackground = registerColor(
	'agentsChatInput.background', inputBackground,
	localize('agentsChatInput.background', "智能体会话窗口中聊天输入字段的背景色。")
);

export const agentsChatInputForeground = registerColor(
	'agentsChatInput.foreground', inputForeground,
	localize('agentsChatInput.foreground', "智能体会话窗口中聊天输入字段的前景色。")
);

export const agentsChatInputBorder = registerColor(
	'agentsChatInput.border', inputBorder,
	localize('agentsChatInput.border', "智能体会话窗口中聊天输入字段的边框色。")
);

export const agentsChatInputFocusBorder = registerColor(
	'agentsChatInput.focusBorder', focusBorder,
	localize('agentsChatInput.focusBorder', "智能体会话窗口中聊天输入字段获得焦点时的边框色。")
);

export const agentsChatInputPlaceholderForeground = registerColor(
	'agentsChatInput.placeholderForeground', inputPlaceholderForeground,
	localize('agentsChatInput.placeholderForeground', "智能体会话窗口中聊天输入字段的占位符文本颜色。")
);

// ============================================================================
// New session button
// ============================================================================

export const agentsNewSessionButtonBackground = registerColor(
	'agentsNewSessionButton.background', '#00000000',
	localize('agentsNewSessionButton.background', "智能体会话边栏中“新建会话”按钮的背景色。")
);

export const agentsNewSessionButtonForeground = registerColor(
	'agentsNewSessionButton.foreground', SIDE_BAR_FOREGROUND,
	localize('agentsNewSessionButton.foreground', "智能体会话边栏中“新建会话”按钮的前景色。")
);

export const agentsNewSessionButtonBorder = registerColor(
	'agentsNewSessionButton.border', buttonSecondaryBorder,
	localize('agentsNewSessionButton.border', "智能体会话边栏中“新建会话”按钮的边框色。")
);

export const agentsNewSessionButtonHoverBackground = registerColor(
	'agentsNewSessionButton.hoverBackground', toolbarHoverBackground,
	localize('agentsNewSessionButton.hoverBackground', "鼠标悬停在智能体会话边栏中“新建会话”按钮时该按钮的背景色。")
);

// ============================================================================
// Badge
// ============================================================================

export const agentsBadgeBackground = registerColor(
	'agentsBadge.background', ACTIVITY_BAR_BADGE_BACKGROUND,
	localize('agentsBadge.background', "智能体会话窗口中徽章的背景色。")
);

export const agentsBadgeForeground = registerColor(
	'agentsBadge.foreground', ACTIVITY_BAR_BADGE_FOREGROUND,
	localize('agentsBadge.foreground', "智能体会话窗口中徽章的前景色。")
);

// ============================================================================
// Unread session indicator
// ============================================================================

export const agentsUnreadBadgeBackground = registerColor(
	'agentsUnreadBadge.background', ACTIVITY_BAR_BADGE_BACKGROUND,
	localize('agentsUnreadBadge.background', "边栏切换按钮上未读会话计数徽章的背景色。")
);

export const agentsUnreadBadgeForeground = registerColor(
	'agentsUnreadBadge.foreground', ACTIVITY_BAR_BADGE_FOREGROUND,
	localize('agentsUnreadBadge.foreground', "边栏切换按钮上未读会话计数标记的前景色。")
);

export const activeSessionViewBackground = registerColor(
	'activeSessionView.background', agentsPanelBackground,
	localize('activeSessionView.background', "智能体会话窗口中活动会话视图的背景色。")
);

export const inactiveSessionViewBackground = registerColor(
	'inactiveSessionView.background', agentsBackground,
	localize('inactiveSessionView.background', "智能体会话窗口中非活动会话视图的背景色。")
);

export const activeSessionViewForeground = registerColor(
	'activeSessionView.foreground', agentsPanelForeground,
	localize('activeSessionView.foreground', "智能体会话窗口中活动会话视图的前景色。")
);

export const inactiveSessionViewForeground = registerColor(
	'inactiveSessionView.foreground', agentsPanelForeground,
	localize('inactiveSessionView.foreground', "智能体会话窗口中非活动会话视图的前景色。")
);
