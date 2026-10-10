/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { TestExplorerViewMode, TestExplorerViewSorting } from './constants.js';
import { TestRunProfileBitset } from './testTypes.js';

export namespace TestingContextKeys {
	export const providerCount = new RawContextKey('testing.providerCount', 0);
	export const canRefreshTests = new RawContextKey('testing.canRefresh', false, { type: 'boolean', description: localize('testing.canRefresh', "指示任何测试控制器是否具有附加的刷新处理程序。") });
	export const isRefreshingTests = new RawContextKey('testing.isRefreshing', false, { type: 'boolean', description: localize('testing.isRefreshing', "指示当前是否有任何测试控制器正在刷新测试。") });
	export const isContinuousModeOn = new RawContextKey<boolean>('testing.isContinuousModeOn', false, { type: 'boolean', description: localize('testing.isContinuousModeOn', "指示连续测试模式是否处于打开状态。") });
	export const hasDebuggableTests = new RawContextKey('testing.hasDebuggableTests', false, { type: 'boolean', description: localize('testing.hasDebuggableTests', "指示是否有测试控制器注册了调试配置") });
	export const hasRunnableTests = new RawContextKey('testing.hasRunnableTests', false, { type: 'boolean', description: localize('testing.hasRunnableTests', "指示是否有测试控制器注册了运行配置") });
	export const hasCoverableTests = new RawContextKey('testing.hasCoverableTests', false, { type: 'boolean', description: localize('testing.hasCoverableTests', "指示是否有测试控制器注册了覆盖率配置") });
	export const hasNonDefaultProfile = new RawContextKey('testing.hasNonDefaultProfile', false, { type: 'boolean', description: localize('testing.hasNonDefaultConfig', "指示是否有测试控制器注册了非默认配置") });
	export const hasConfigurableProfile = new RawContextKey('testing.hasConfigurableProfile', false, { type: 'boolean', description: localize('testing.hasConfigurableConfig', "指示是否可以配置测试配置") });
	export const supportsContinuousRun = new RawContextKey('testing.supportsContinuousRun', false, { type: 'boolean', description: localize('testing.supportsContinuousRun', "指示是否支持持续运行测试") });
	export const isParentRunningContinuously = new RawContextKey('testing.isParentRunningContinuously', false, { type: 'boolean', description: localize('testing.isParentRunningContinuously', "指示测试的父级是否持续运行，在测试项的菜单上下文中设置") });
	export const activeEditorHasTests = new RawContextKey('testing.activeEditorHasTests', false, { type: 'boolean', description: localize('testing.activeEditorHasTests', "指示当前编辑器中是否存在任何测试") });
	export const cursorInsideTestRange = new RawContextKey('testing.cursorInsideTestRange', false, { type: 'boolean', description: localize('testing.cursorInsideTestRange', "光标当前是否在测试范围内") });
	export const isTestCoverageOpen = new RawContextKey('testing.isTestCoverageOpen', false, { type: 'boolean', description: localize('testing.isTestCoverageOpen', "指示测试覆盖率报表是否已打开") });
	export const hasCoverageInFile = new RawContextKey('testing.hasCoverageInFile', false, { type: 'boolean', description: localize('testing.hasCoverageInFile', "指示当前编辑器中已报告覆盖情况。") });
	export const hasPerTestCoverage = new RawContextKey('testing.hasPerTestCoverage', false, { type: 'boolean', description: localize('testing.hasPerTestCoverage', "指示每测试覆盖率是否可用") });
	export const hasInlineCoverageDetails = new RawContextKey('testing.hasInlineCoverageDetails', false, { type: 'boolean', description: localize('testing.hasInlineCoverageDetails', "指示是否可以将详细的逐行覆盖率信息用于内联显示") });
	export const isCoverageFilteredToTest = new RawContextKey('testing.isCoverageFilteredToTest', false, { type: 'boolean', description: localize('testing.isCoverageFilteredToTest', "指示覆盖率是否已筛选为单个测试") });
	export const coverageToolbarEnabled = new RawContextKey('testing.coverageToolbarEnabled', true, { type: 'boolean', description: localize('testing.coverageToolbarEnabled', "指示是否已启用覆盖率工具栏") });
	export const inlineCoverageEnabled = new RawContextKey('testing.inlineCoverageEnabled', false, { type: 'boolean', description: localize('testing.inlineCoverageEnabled', "指示是否显示内联覆盖率") });
	export const canGoToRelatedCode = new RawContextKey('testing.canGoToRelatedCode', false, { type: 'boolean', description: localize('testing.canGoToRelatedCode', "控制器是否实现查找与测试相关的代码的功能") });
	export const canGoToRelatedTest = new RawContextKey('testing.canGoToRelatedTest', false, { type: 'boolean', description: localize('testing.canGoToRelatedTest', "控制器是否实现查找与代码相关的测试的功能") });
	export const peekHasStack = new RawContextKey('testing.peekHasStack', false, { type: 'boolean', description: localize('testing.peekHasStack', "速览视图中显示的消息是否具有堆栈跟踪") });

	export const capabilityToContextKey: { [K in TestRunProfileBitset]: RawContextKey<boolean> } = {
		[TestRunProfileBitset.Run]: hasRunnableTests,
		[TestRunProfileBitset.Coverage]: hasCoverableTests,
		[TestRunProfileBitset.Debug]: hasDebuggableTests,
		[TestRunProfileBitset.HasNonDefaultProfile]: hasNonDefaultProfile,
		[TestRunProfileBitset.HasConfigurable]: hasConfigurableProfile,
		[TestRunProfileBitset.SupportsContinuousRun]: supportsContinuousRun,
	};

	export const hasAnyResults = new RawContextKey<boolean>('testing.hasAnyResults', false);
	export const viewMode = new RawContextKey<TestExplorerViewMode>('testing.explorerViewMode', TestExplorerViewMode.List);
	export const viewSorting = new RawContextKey<TestExplorerViewSorting>('testing.explorerViewSorting', TestExplorerViewSorting.ByLocation);
	export const isRunning = new RawContextKey<boolean>('testing.isRunning', false);
	export const isInPeek = new RawContextKey<boolean>('testing.isInPeek', false);
	export const isPeekVisible = new RawContextKey<boolean>('testing.isPeekVisible', false);

	export const peekItemType = new RawContextKey<string | undefined>('peekItemType', undefined, {
		type: 'string',
		description: localize('testing.peekItemType', "输出速览视图中项的类型。类型为“测试”、“消息”、“任务”或“结果”。"),
	});
	export const controllerId = new RawContextKey<string | undefined>('controllerId', undefined, {
		type: 'string',
		description: localize('testing.controllerId', "当前测试项的控制器 ID")
	});
	export const testItemExtId = new RawContextKey<string | undefined>('testId', undefined, {
		type: 'string',
		description: localize('testing.testId', "当前测试项的 ID，在创建或打开测试项的菜单时设置")
	});
	export const testItemHasUri = new RawContextKey<boolean>('testing.testItemHasUri', false, {
		type: 'boolean',
		description: localize('testing.testItemHasUri', "指示测试项是否已定义 URI 的布尔值")
	});
	export const testItemIsHidden = new RawContextKey<boolean>('testing.testItemIsHidden', false, {
		type: 'boolean',
		description: localize('testing.testItemIsHidden', "指示测试项是否处于隐藏状态的布尔值")
	});
	export const testMessageContext = new RawContextKey<string>('testMessage', undefined, {
		type: 'string',
		description: localize('testing.testMessage', "“testMessage.contextValue”中设置的值，可在编辑器/内容和测试/消息/上下文中使用")
	});
	export const testResultOutdated = new RawContextKey<boolean>('testResultOutdated', undefined, {
		type: 'boolean',
		description: localize('testing.testResultOutdated', "结果过时时，编辑器/内容和测试/消息/上下文中的可用值")
	});
	export const testResultState = new RawContextKey<string>('testResultState', undefined, {
		type: 'string',
		description: localize('testing.testResultState', "指示项状态的值可用测试/项/结果。")
	});
	export const testProfileContextGroup = new RawContextKey<string>('testing.profile.context.group', undefined, {
		type: 'string',
		description: localize('testing.profile.context.group', "存在配置测试配置文件子菜单的菜单类型。\"run\"、\"debug\" 或 \"coverage\"")
	});
}
