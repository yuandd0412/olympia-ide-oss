/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { localize } from '../../../../nls.js';
import { registerIcon, spinningLoading } from '../../../../platform/theme/common/iconRegistry.js';
import { registerThemingParticipant } from '../../../../platform/theme/common/themeService.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { testingColorRunAction, testStatesToIconColors, testStatesToRetiredIconColors } from './theme.js';
import { TestResultState } from '../common/testTypes.js';

export const testingViewIcon = registerIcon('test-view-icon', Codicon.beaker, localize('testViewIcon', "查看测试视图的图标。"));
export const testingResultsIcon = registerIcon('test-results-icon', Codicon.checklist, localize('testingResultsIcon', "测试结果的图标。"));
export const testingRunIcon = registerIcon('testing-run-icon', Codicon.run, localize('testingRunIcon', "“运行测试”操作的图标。"));
export const testingRerunIcon = registerIcon('testing-rerun-icon', Codicon.debugRerun, localize('testingRerunIcon', "“重新运行测试”操作的图标。"));
export const testingRunAllIcon = registerIcon('testing-run-all-icon', Codicon.runAll, localize('testingRunAllIcon', "“运行所有测试”操作的图标。"));
// todo: https://github.com/microsoft/vscode-codicons/issues/72
export const testingDebugAllIcon = registerIcon('testing-debug-all-icon', Codicon.debugAltSmall, localize('testingDebugAllIcon', "“调试所有测试”操作的图标。"));
export const testingDebugIcon = registerIcon('testing-debug-icon', Codicon.debugAltSmall, localize('testingDebugIcon', "“调试测试”操作的图标。"));
export const testingCoverageIcon = registerIcon('testing-coverage-icon', Codicon.runCoverage, localize('testingCoverageIcon', "“运行覆盖率测试”操作的图标。"));
export const testingCoverageAllIcon = registerIcon('testing-coverage-all-icon', Codicon.runAllCoverage, localize('testingRunAllWithCoverageIcon', "“对所有测试运行覆盖率测试”操作的图标。"));
export const testingCancelIcon = registerIcon('testing-cancel-icon', Codicon.debugStop, localize('testingCancelIcon', "用于取消正在进行的测试运行的图标。"));
export const testingFilterIcon = registerIcon('testing-filter', Codicon.filter, localize('filterIcon', "“测试”视图中“筛选器”操作的图标。"));
export const testingHiddenIcon = registerIcon('testing-hidden', Codicon.eyeClosed, localize('hiddenIcon', "在隐藏的测试显示时其旁边出现的图标。"));

export const testingShowAsList = registerIcon('testing-show-as-list-icon', Codicon.listTree, localize('testingShowAsList', "当测试资源管理器(树形式)被禁用时显示的图标。"));
export const testingShowAsTree = registerIcon('testing-show-as-list-icon', Codicon.listFlat, localize('testingShowAsTree', "当测试资源管理器(列表形式)被禁用时显示的图标。"));

export const testingUpdateProfiles = registerIcon('testing-update-profiles', Codicon.gear, localize('testingUpdateProfiles', "显示的用于更新测试配置文件的图标。"));
export const testingRefreshTests = registerIcon('testing-refresh-tests', Codicon.refresh, localize('testingRefreshTests', "用于刷新测试的按钮上的图标。"));
export const testingTurnContinuousRunOn = registerIcon('testing-turn-continuous-run-on', Codicon.eye, localize('testingTurnContinuousRunOn', "用于打开连续测试运行的图标。"));
export const testingTurnContinuousRunOff = registerIcon('testing-turn-continuous-run-off', Codicon.eyeClosed, localize('testingTurnContinuousRunOff', "用于关闭连续测试运行的图标。"));
export const testingContinuousIsOn = registerIcon('testing-continuous-is-on', Codicon.eye, localize('testingTurnContinuousRunIsOn', "用于测试迭起的连续运行处于打开状态时的图标。"));
export const testingCancelRefreshTests = registerIcon('testing-cancel-refresh-tests', Codicon.stop, localize('testingCancelRefreshTests', "用于取消刷新测试的按钮上的图标。"));

export const testingCoverageReport = registerIcon('testing-coverage', Codicon.coverage, localize('testingCoverage', "表示测试覆盖率的图标"));
export const testingWasCovered = registerIcon('testing-was-covered', Codicon.check, localize('testingWasCovered', "表示元素已覆盖的图标"));
export const testingCoverageMissingBranch = registerIcon('testing-missing-branch', Codicon.question, localize('testingMissingBranch', "表示没有范围的未覆盖块的图标"));

export const testingStatesToIcons = new Map<TestResultState, ThemeIcon>([
	[TestResultState.Errored, registerIcon('testing-error-icon', Codicon.issues, localize('testingErrorIcon', "针对有错误的测试显示的图标。"))],
	[TestResultState.Failed, registerIcon('testing-failed-icon', Codicon.error, localize('testingFailedIcon', "针对失败的测试显示的图标。"))],
	[TestResultState.Passed, registerIcon('testing-passed-icon', Codicon.pass, localize('testingPassedIcon', "针对通过的测试显示的图标。"))],
	[TestResultState.Queued, registerIcon('testing-queued-icon', Codicon.history, localize('testingQueuedIcon', "针对排队的测试显示的图标。"))],
	[TestResultState.Running, spinningLoading],
	[TestResultState.Skipped, registerIcon('testing-skipped-icon', Codicon.debugStepOver, localize('testingSkippedIcon', "针对跳过的测试显示的图标。"))],
	[TestResultState.Unset, registerIcon('testing-unset-icon', Codicon.circleOutline, localize('testingUnsetIcon', "针对处于未设置状态的测试显示的图标。"))],
]);

registerThemingParticipant((theme, collector) => {
	for (const [state, icon] of testingStatesToIcons.entries()) {
		const color = testStatesToIconColors[state];
		const retiredColor = testStatesToRetiredIconColors[state];
		if (!color) {
			continue;
		}
		collector.addRule(`.monaco-workbench ${ThemeIcon.asCSSSelector(icon)} {
			color: ${theme.getColor(color)} !important;
		}`);
		if (!retiredColor) {
			continue;
		}
		collector.addRule(`
			.test-explorer .computed-state.retired${ThemeIcon.asCSSSelector(icon)},
			.testing-run-glyph.retired${ThemeIcon.asCSSSelector(icon)}{
				color: ${theme.getColor(retiredColor)} !important;
			}
		`);
	}

	collector.addRule(`
		.monaco-editor .glyph-margin-widgets ${ThemeIcon.asCSSSelector(testingRunIcon)},
		.monaco-editor .glyph-margin-widgets ${ThemeIcon.asCSSSelector(testingRunAllIcon)},
		.monaco-editor .glyph-margin-widgets ${ThemeIcon.asCSSSelector(testingDebugIcon)},
		.monaco-editor .glyph-margin-widgets ${ThemeIcon.asCSSSelector(testingDebugAllIcon)} {
			color: ${theme.getColor(testingColorRunAction)};
		}
	`);
});
