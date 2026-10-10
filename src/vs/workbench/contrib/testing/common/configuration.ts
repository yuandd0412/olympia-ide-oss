/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { observableFromEvent } from '../../../../base/common/observable.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IConfigurationNode } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ConfigurationKeyValuePairs, Extensions, IConfigurationMigrationRegistry } from '../../../common/configuration.js';

export const enum TestingConfigKeys {
	AutoOpenPeekView = 'testing.automaticallyOpenPeekView',
	AutoOpenPeekViewDuringContinuousRun = 'testing.automaticallyOpenPeekViewDuringAutoRun',
	OpenResults = 'testing.automaticallyOpenTestResults',
	FollowRunningTest = 'testing.followRunningTest',
	DefaultGutterClickAction = 'testing.defaultGutterClickAction',
	GutterEnabled = 'testing.gutterEnabled',
	SaveBeforeTest = 'testing.saveBeforeTest',
	AlwaysRevealTestOnStateChange = 'testing.alwaysRevealTestOnStateChange',
	CountBadge = 'testing.countBadge',
	ShowAllMessages = 'testing.showAllMessages',
	CoveragePercent = 'testing.displayedCoveragePercent',
	ShowCoverageInExplorer = 'testing.showCoverageInExplorer',
	CoverageBarThresholds = 'testing.coverageBarThresholds',
	CoverageToolbarEnabled = 'testing.coverageToolbarEnabled',
	CoverageMinimapEnabled = 'testing.coverageMinimapEnabled',
	ResultsViewLayout = 'testing.resultsView.layout',
}

export const enum AutoOpenTesting {
	NeverOpen = 'neverOpen',
	OpenOnTestStart = 'openOnTestStart',
	OpenOnTestFailure = 'openOnTestFailure',
	OpenExplorerOnTestStart = 'openExplorerOnTestStart',
}

export const enum AutoOpenPeekViewWhen {
	FailureVisible = 'failureInVisibleDocument',
	FailureAnywhere = 'failureAnywhere',
	Never = 'never',
}

export const enum DefaultGutterClickAction {
	Run = 'run',
	Debug = 'debug',
	Coverage = 'runWithCoverage',
	ContextMenu = 'contextMenu',
}

export const enum TestingCountBadge {
	Failed = 'failed',
	Off = 'off',
	Passed = 'passed',
	Skipped = 'skipped',
}

export const enum TestingDisplayedCoveragePercent {
	TotalCoverage = 'totalCoverage',
	Statement = 'statement',
	Minimum = 'minimum',
}

export const enum TestingResultsViewLayout {
	TreeLeft = 'treeLeft',
	TreeRight = 'treeRight',
}

export const testingConfiguration: IConfigurationNode = {
	id: 'testing',
	order: 21,
	title: localize('testConfigurationTitle', "测试"),
	type: 'object',
	properties: {
		[TestingConfigKeys.AutoOpenPeekView]: {
			description: localize('testing.automaticallyOpenPeekView', "配置何时自动打开错误“速览”视图。"),
			enum: [
				AutoOpenPeekViewWhen.FailureAnywhere,
				AutoOpenPeekViewWhen.FailureVisible,
				AutoOpenPeekViewWhen.Never,
			],
			default: AutoOpenPeekViewWhen.Never,
			enumDescriptions: [
				localize('testing.automaticallyOpenPeekView.failureAnywhere', "无论故障在何处，都自动打开。"),
				localize('testing.automaticallyOpenPeekView.failureInVisibleDocument', "在可见文档中测试失败时自动打开。"),
				localize('testing.automaticallyOpenPeekView.never', "从不自动打开。"),
			],
		},
		[TestingConfigKeys.ShowAllMessages]: {
			description: localize('testing.showAllMessages', "控制是否显示来自所有测试运行的消息。"),
			type: 'boolean',
			default: false,
		},
		[TestingConfigKeys.AutoOpenPeekViewDuringContinuousRun]: {
			description: localize('testing.automaticallyOpenPeekViewDuringContinuousRun', "控制是否在连续运行模式期间自动打开“速览”视图。"),
			type: 'boolean',
			default: false,
		},
		[TestingConfigKeys.CountBadge]: {
			description: localize('testing.countBadge', "控制活动栏上“测试”图标上的计数锁屏提醒。"),
			enum: [
				TestingCountBadge.Failed,
				TestingCountBadge.Off,
				TestingCountBadge.Passed,
				TestingCountBadge.Skipped,
			],
			enumDescriptions: [
				localize('testing.countBadge.failed', "显示失败的测试数"),
				localize('testing.countBadge.off', "禁用测试计数锁屏提醒"),
				localize('testing.countBadge.passed', "显示通过的测试数"),
				localize('testing.countBadge.skipped', "显示跳过的测试数"),
			],
			default: TestingCountBadge.Failed,
		},
		[TestingConfigKeys.FollowRunningTest]: {
			description: localize('testing.followRunningTest', "控制是否应在“测试资源管理器”视图中遵循正在运行的测试。"),
			type: 'boolean',
			default: false,
		},
		[TestingConfigKeys.DefaultGutterClickAction]: {
			description: localize('testing.defaultGutterClickAction', "控制在装订线中左键单击测试修饰时要执行的操作。"),
			enum: [
				DefaultGutterClickAction.Run,
				DefaultGutterClickAction.Debug,
				DefaultGutterClickAction.Coverage,
				DefaultGutterClickAction.ContextMenu,
			],
			enumDescriptions: [
				localize('testing.defaultGutterClickAction.run', "运行测试。"),
				localize('testing.defaultGutterClickAction.debug', "调试测试。"),
				localize('testing.defaultGutterClickAction.coverage', "运行覆盖率测试。"),
				localize('testing.defaultGutterClickAction.contextMenu', "打开上下文菜单以获取更多选项。"),
			],
			default: DefaultGutterClickAction.Run,
		},
		[TestingConfigKeys.GutterEnabled]: {
			description: localize('testing.gutterEnabled', "控制是否在编辑器装订线中显示测试修饰。"),
			type: 'boolean',
			default: true,
		},
		[TestingConfigKeys.SaveBeforeTest]: {
			description: localize('testing.saveBeforeTest', "控制是否在运行测试之前保存所有脏编辑器。"),
			type: 'boolean',
			default: true,
		},
		[TestingConfigKeys.OpenResults]: {
			enum: [
				AutoOpenTesting.NeverOpen,
				AutoOpenTesting.OpenOnTestStart,
				AutoOpenTesting.OpenOnTestFailure,
				AutoOpenTesting.OpenExplorerOnTestStart,
			],
			enumDescriptions: [
				localize('testing.openTesting.neverOpen', "从不自动打开测试视图"),
				localize('testing.openTesting.openOnTestStart', "测试开始时打开测试结果视图"),
				localize('testing.openTesting.openOnTestFailure', "任何测试失败时打开测试视图"),
				localize('testing.openTesting.openExplorerOnTestStart', "启动测试时打开测试资源管理器"),
			],
			default: 'openOnTestStart',
			description: localize('testing.openTesting', "控制何时打开测试视图。")
		},
		[TestingConfigKeys.AlwaysRevealTestOnStateChange]: {
			markdownDescription: localize('testing.alwaysRevealTestOnStateChange', "{0} 开启时始终显示执行的测试。如果关闭此设置，则只会显示失败的测试。", '`#testing.followRunningTest#`'),
			type: 'boolean',
			default: false,
		},
		[TestingConfigKeys.ShowCoverageInExplorer]: {
			description: localize('testing.ShowCoverageInExplorer', "是否应在“文件资源管理器”视图中降低测试覆盖。"),
			type: 'boolean',
			default: true,
		},
		[TestingConfigKeys.CoveragePercent]: {
			markdownDescription: localize('testing.displayedCoveragePercent', "配置默认情况下针对测试覆盖率显示的具体百分比。"),
			default: TestingDisplayedCoveragePercent.TotalCoverage,
			enum: [
				TestingDisplayedCoveragePercent.TotalCoverage,
				TestingDisplayedCoveragePercent.Statement,
				TestingDisplayedCoveragePercent.Minimum,
			],
			enumDescriptions: [
				localize('testing.displayedCoveragePercent.totalCoverage', "组合语句、函数和分支覆盖率的计算。"),
				localize('testing.displayedCoveragePercent.statement', "语句覆盖率。"),
				localize('testing.displayedCoveragePercent.minimum', "语句、函数和分支覆盖率的最小值。"),
			],
		},
		[TestingConfigKeys.CoverageBarThresholds]: {
			markdownDescription: localize('testing.coverageBarThresholds', "配置测试覆盖率栏中百分比使用的颜色。"),
			default: { red: 0, yellow: 60, green: 90 },
			properties: {
				red: { type: 'number', minimum: 0, maximum: 100, default: 0 },
				yellow: { type: 'number', minimum: 0, maximum: 100, default: 60 },
				green: { type: 'number', minimum: 0, maximum: 100, default: 90 },
			},
		},
		[TestingConfigKeys.CoverageToolbarEnabled]: {
			description: localize('testing.coverageToolbarEnabled', "控制是否在编辑器中显示覆盖率工具栏。"),
			type: 'boolean',
			default: false, // todo@connor4312: disabled by default until UI sync
		},
		[TestingConfigKeys.CoverageMinimapEnabled]: {
			description: localize('testing.coverageMinimapEnabled', "控制是否在缩略图中显示覆盖率指示器。"),
			type: 'boolean',
			default: true,
		},
		[TestingConfigKeys.ResultsViewLayout]: {
			description: localize('testing.resultsView.layout', "控制“测试结果”视图的布局。"),
			enum: [
				TestingResultsViewLayout.TreeRight,
				TestingResultsViewLayout.TreeLeft,
			],
			enumDescriptions: [
				localize('testing.resultsView.layout.treeRight', "在右侧显示测试运行树，在左侧显示详细信息。"),
				localize('testing.resultsView.layout.treeLeft', "在左侧显示测试运行树，在右侧显示详细信息。"),
			],
			default: TestingResultsViewLayout.TreeRight,
		},
	}
};

Registry.as<IConfigurationMigrationRegistry>(Extensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: 'testing.openTesting',
		migrateFn: (value: AutoOpenTesting): ConfigurationKeyValuePairs => {
			return [[TestingConfigKeys.OpenResults, { value }]];
		}
	}]);

export interface ITestingCoverageBarThresholds {
	red: number;
	green: number;
	yellow: number;
}

export interface ITestingConfiguration {
	[TestingConfigKeys.AutoOpenPeekView]: AutoOpenPeekViewWhen;
	[TestingConfigKeys.AutoOpenPeekViewDuringContinuousRun]: boolean;
	[TestingConfigKeys.CountBadge]: TestingCountBadge;
	[TestingConfigKeys.FollowRunningTest]: boolean;
	[TestingConfigKeys.DefaultGutterClickAction]: DefaultGutterClickAction;
	[TestingConfigKeys.GutterEnabled]: boolean;
	[TestingConfigKeys.SaveBeforeTest]: boolean;
	[TestingConfigKeys.OpenResults]: AutoOpenTesting;
	[TestingConfigKeys.AlwaysRevealTestOnStateChange]: boolean;
	[TestingConfigKeys.ShowAllMessages]: boolean;
	[TestingConfigKeys.CoveragePercent]: TestingDisplayedCoveragePercent;
	[TestingConfigKeys.ShowCoverageInExplorer]: boolean;
	[TestingConfigKeys.CoverageBarThresholds]: ITestingCoverageBarThresholds;
	[TestingConfigKeys.CoverageToolbarEnabled]: boolean;
	[TestingConfigKeys.CoverageMinimapEnabled]: boolean;
	[TestingConfigKeys.ResultsViewLayout]: TestingResultsViewLayout;
}

export const getTestingConfiguration = <K extends TestingConfigKeys>(config: IConfigurationService, key: K) => config.getValue<ITestingConfiguration[K]>(key);

export const observeTestingConfiguration = <K extends TestingConfigKeys>(config: IConfigurationService, key: K) => observableFromEvent(config.onDidChangeConfiguration, () =>
	getTestingConfiguration(config, key));
