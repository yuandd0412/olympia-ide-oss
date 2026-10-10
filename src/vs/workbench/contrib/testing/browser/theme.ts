/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { activityErrorBadgeBackground, activityErrorBadgeForeground, badgeBackground, badgeForeground, chartsGreen, chartsRed, contrastBorder, diffInserted, diffRemoved, editorBackground, editorErrorForeground, editorForeground, editorInfoForeground, opaque, registerColor, transparent } from '../../../../platform/theme/common/colorRegistry.js';
import { listErrorForeground, listWarningForeground } from '../../../../platform/theme/common/colors/listColors.js';
import { registerThemingParticipant } from '../../../../platform/theme/common/themeService.js';
import { TestResultState } from '../common/testTypes.js';

export const testingColorIconFailed = registerColor('testing.iconFailed', listErrorForeground, localize('testing.iconFailed', "测试资源管理器中“失败”图标的颜色。"));

export const testingColorIconErrored = registerColor('testing.iconErrored', listErrorForeground, localize('testing.iconErrored', "测试资源管理器中“出错”图标的颜色。"));

export const testingColorIconPassed = registerColor('testing.iconPassed', {
	dark: '#73c991',
	light: '#73c991',
	hcDark: '#73c991',
	hcLight: '#007100'
}, localize('testing.iconPassed', "测试资源管理器中“已通过”图标的颜色。"));

export const testingColorRunAction = registerColor('testing.runAction', testingColorIconPassed, localize('testing.runAction', "编辑器中“运行”图标的颜色。"));

export const testingColorIconQueued = registerColor('testing.iconQueued', listWarningForeground, localize('testing.iconQueued', "测试资源管理器中“已排队”图标的颜色。"));

export const testingColorIconUnset = registerColor('testing.iconUnset', '#848484', localize('testing.iconUnset', "测试资源管理器中“未设置”图标的颜色。"));

export const testingColorIconSkipped = registerColor('testing.iconSkipped', '#848484', localize('testing.iconSkipped', "测试资源管理器中“已跳过”图标的颜色。"));

export const testingPeekBorder = registerColor('testing.peekBorder', {
	dark: editorErrorForeground,
	light: editorErrorForeground,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('testing.peekBorder', "速览视图边框和箭头的颜色。"));

export const testingMessagePeekBorder = registerColor('testing.messagePeekBorder', {
	dark: editorInfoForeground,
	light: editorInfoForeground,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('testing.messagePeekBorder', "扫视记录的消息时速览视图边框和箭头的颜色。"));

export const testingPeekHeaderBackground = registerColor('testing.peekHeaderBackground', {
	dark: transparent(editorErrorForeground, 0.1),
	light: transparent(editorErrorForeground, 0.1),
	hcDark: null,
	hcLight: null
}, localize('testing.peekBorder', "速览视图边框和箭头的颜色。"));

export const testingPeekMessageHeaderBackground = registerColor('testing.messagePeekHeaderBackground', {
	dark: transparent(editorInfoForeground, 0.1),
	light: transparent(editorInfoForeground, 0.1),
	hcDark: null,
	hcLight: null
}, localize('testing.messagePeekHeaderBackground', "扫视记录的消息时速览视图边框和箭头的颜色。"));

export const testingCoveredBackground = registerColor('testing.coveredBackground', {
	dark: diffInserted,
	light: diffInserted,
	hcDark: null,
	hcLight: null
}, localize('testing.coveredBackground', "未覆盖文本的背景色。"));

export const testingCoveredBorder = registerColor('testing.coveredBorder', {
	dark: transparent(testingCoveredBackground, 0.75),
	light: transparent(testingCoveredBackground, 0.75),
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('testing.coveredBorder', "未覆盖文本的边框颜色。"));

export const testingCoveredGutterBackground = registerColor('testing.coveredGutterBackground', {
	dark: transparent(diffInserted, 0.6),
	light: transparent(diffInserted, 0.6),
	hcDark: chartsGreen,
	hcLight: chartsGreen
}, localize('testing.coveredGutterBackground', "代码已覆盖的区域的装订线颜色。"));

export const testingUncoveredBranchBackground = registerColor('testing.uncoveredBranchBackground', {
	dark: opaque(transparent(diffRemoved, 2), editorBackground),
	light: opaque(transparent(diffRemoved, 2), editorBackground),
	hcDark: null,
	hcLight: null
}, localize('testing.uncoveredBranchBackground', "为未覆盖的分支显示的小组件的背景。"));

export const testingUncoveredBackground = registerColor('testing.uncoveredBackground', {
	dark: diffRemoved,
	light: diffRemoved,
	hcDark: null,
	hcLight: null
}, localize('testing.uncoveredBackground', "未覆盖文本的背景色。"));

export const testingUncoveredBorder = registerColor('testing.uncoveredBorder', {
	dark: transparent(testingUncoveredBackground, 0.75),
	light: transparent(testingUncoveredBackground, 0.75),
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('testing.uncoveredBorder', "未覆盖文本的边框颜色。"));

export const testingUncoveredGutterBackground = registerColor('testing.uncoveredGutterBackground', {
	dark: transparent(diffRemoved, 1.5),
	light: transparent(diffRemoved, 1.5),
	hcDark: chartsRed,
	hcLight: chartsRed
}, localize('testing.uncoveredGutterBackground', "代码未覆盖的区域的装订线颜色。"));

export const testingCoveredMinimapBackground = registerColor('testing.coveredMinimapBackground', {
	dark: transparent(diffInserted, 0.6),
	light: transparent(diffInserted, 0.6),
	hcDark: chartsGreen,
	hcLight: chartsGreen
}, localize('testing.coveredMinimapBackground', "代码已覆盖区域的缩略图颜色。"));

export const testingUncoveredMinimapBackground = registerColor('testing.uncoveredMinimapBackground', {
	dark: transparent(diffRemoved, 1.5),
	light: transparent(diffRemoved, 1.5),
	hcDark: chartsRed,
	hcLight: chartsRed
}, localize('testing.uncoveredMinimapBackground', "代码未覆盖区域的缩略图颜色。"));

export const testingCoverCountBadgeBackground = registerColor('testing.coverCountBadgeBackground', badgeBackground, localize('testing.coverCountBadgeBackground', "指明执行计数的徽章的背景"));

export const testingCoverCountBadgeForeground = registerColor('testing.coverCountBadgeForeground', badgeForeground, localize('testing.coverCountBadgeForeground', "指明执行计数的徽章的前景色"));


const messageBadgeBackground = registerColor(
	'testing.message.error.badgeBackground',
	activityErrorBadgeBackground,
	localize('testing.message.error.badgeBackground', "在编辑器中内联显示的测试错误消息的背景色。")
);
registerColor(
	'testing.message.error.badgeBorder',
	messageBadgeBackground,
	localize('testing.message.error.badgeBorder', "在编辑器中内联显示的测试错误消息的边框颜色。")
);
registerColor(
	'testing.message.error.badgeForeground',
	activityErrorBadgeForeground,
	localize('testing.message.error.badgeForeground', "在编辑器中内联显示的测试错误消息的文本颜色。")
);
registerColor(
	'testing.message.error.lineBackground',
	null,
	localize('testing.message.error.marginBackground', "在编辑器中内联显示的错误消息旁边的边距颜色。")
);
registerColor(
	'testing.message.info.decorationForeground',
	transparent(editorForeground, 0.5),
	localize('testing.message.info.decorationForeground', "在编辑器中内联显示的测试信息消息的文本颜色。")
);
registerColor(
	'testing.message.info.lineBackground',
	null,
	localize('testing.message.info.marginBackground', "在编辑器中内联显示的信息消息旁边的边距颜色。")
);

export const testStatesToIconColors: { [K in TestResultState]?: string } = {
	[TestResultState.Errored]: testingColorIconErrored,
	[TestResultState.Failed]: testingColorIconFailed,
	[TestResultState.Passed]: testingColorIconPassed,
	[TestResultState.Queued]: testingColorIconQueued,
	[TestResultState.Unset]: testingColorIconUnset,
	[TestResultState.Skipped]: testingColorIconSkipped,
};

export const testingRetiredColorIconErrored = registerColor('testing.iconErrored.retired', transparent(testingColorIconErrored, 0.7), localize('testing.iconErrored.retired', "测试资源管理器中“出错”图标的停用颜色。"));

export const testingRetiredColorIconFailed = registerColor('testing.iconFailed.retired', transparent(testingColorIconFailed, 0.7), localize('testing.iconFailed.retired', "测试资源管理器中“失败”图标的停用颜色。"));

export const testingRetiredColorIconPassed = registerColor('testing.iconPassed.retired', transparent(testingColorIconPassed, 0.7), localize('testing.iconPassed.retired', "测试资源管理器中“通过”图标的停用颜色。"));

export const testingRetiredColorIconQueued = registerColor('testing.iconQueued.retired', transparent(testingColorIconQueued, 0.7), localize('testing.iconQueued.retired', "测试资源管理器中“已排队”图标的停用颜色。"));

export const testingRetiredColorIconUnset = registerColor('testing.iconUnset.retired', transparent(testingColorIconUnset, 0.7), localize('testing.iconUnset.retired', "测试资源管理器中“取消设置”图标的停用颜色。"));

export const testingRetiredColorIconSkipped = registerColor('testing.iconSkipped.retired', transparent(testingColorIconSkipped, 0.7), localize('testing.iconSkipped.retired', "测试资源管理器中“已跳过”图标的停用颜色。"));

export const testStatesToRetiredIconColors: { [K in TestResultState]?: string } = {
	[TestResultState.Errored]: testingRetiredColorIconErrored,
	[TestResultState.Failed]: testingRetiredColorIconFailed,
	[TestResultState.Passed]: testingRetiredColorIconPassed,
	[TestResultState.Queued]: testingRetiredColorIconQueued,
	[TestResultState.Unset]: testingRetiredColorIconUnset,
	[TestResultState.Skipped]: testingRetiredColorIconSkipped,
};

registerThemingParticipant((theme, collector) => {

	const editorBg = theme.getColor(editorBackground);

	collector.addRule(`
	.coverage-deco-inline.coverage-deco-hit.coverage-deco-hovered {
		background: ${theme.getColor(testingCoveredBackground)?.transparent(1.3)};
		outline-color: ${theme.getColor(testingCoveredBorder)?.transparent(2)};
	}
	.coverage-deco-inline.coverage-deco-miss.coverage-deco-hovered {
		background: ${theme.getColor(testingUncoveredBackground)?.transparent(1.3)};
		outline-color: ${theme.getColor(testingUncoveredBorder)?.transparent(2)};
	}
		`);

	if (editorBg) {
		const missBadgeBackground = theme.getColor(testingUncoveredBackground)?.transparent(2).makeOpaque(editorBg);
		const errorBadgeBackground = theme.getColor(messageBadgeBackground)?.makeOpaque(editorBg);
		collector.addRule(`
			.coverage-deco-branch-miss-indicator::before {
				border-color: ${missBadgeBackground?.transparent(1.3)};
				background-color: ${missBadgeBackground};
			}
			.monaco-workbench .test-error-content-widget .inner{
				background: ${errorBadgeBackground};
			}
			.monaco-workbench .test-error-content-widget .inner .arrow svg {
				fill: ${errorBadgeBackground};
			}
		`);
	}
});
