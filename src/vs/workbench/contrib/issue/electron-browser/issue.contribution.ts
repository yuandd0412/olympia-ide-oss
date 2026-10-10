/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from '../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../nls.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IProcessService } from '../../../../platform/process/common/process.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IQuickAccessRegistry, Extensions as QuickAccessExtensions } from '../../../../platform/quickinput/common/quickAccess.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions, IWorkbenchContributionsRegistry } from '../../../common/contributions.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { EditorExtensions } from '../../../common/editor.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IssueQuickAccess } from '../browser/issueQuickAccess.js';
import '../browser/issueTroubleshoot.js';
import './issueReporterKeybindings.js';
import { BaseIssueContribution } from '../common/issue.contribution.js';
import { IIssueFormService, IWorkbenchIssueService, IssueType } from '../common/issue.js';
import { NativeIssueService } from './issueService.js';
import { NativeIssueFormService } from './nativeIssueFormService.js';
import { IScreenshotService } from '../browser/screenshotService.js';
import { NativeScreenshotService } from './nativeScreenshotService.js';
import { IRecordingService } from '../browser/recordingService.js';
import { NativeRecordingService } from './nativeRecordingService.js';
import { IGitHubUploadService } from '../browser/githubUploadService.js';
import { NativeGitHubUploadService } from './nativeGitHubUploadService.js';
import { IssueReporterEditorPane } from './issueReporterEditorPane.js';
import { IssueReporterEditorInput } from '../browser/issueReporterEditorInput.js';

//#region Issue Contribution
registerSingleton(IWorkbenchIssueService, NativeIssueService, InstantiationType.Delayed);
registerSingleton(IIssueFormService, NativeIssueFormService, InstantiationType.Delayed);
registerSingleton(IScreenshotService, NativeScreenshotService, InstantiationType.Delayed);
registerSingleton(IRecordingService, NativeRecordingService, InstantiationType.Delayed);
registerSingleton(IGitHubUploadService, NativeGitHubUploadService, InstantiationType.Delayed);

// Settings
Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'issueReporter',
	title: localize('issueReporterConfigurationTitle', "问题报告器"),
	type: 'object',
	properties: {
		'issueReporter.wizard.enabled': {
			type: 'boolean',
			default: false,
			description: localize('issueReporter.wizard.enabled', "启用新版问题报告程序向导，而非经典问题报告程序。"),
			experiment: { mode: 'auto' }
		},
		'issueReporter.wizard.fullWorkspaceScan': {
			type: 'boolean',
			default: true,
			description: localize('issueReporter.wizard.fullWorkspaceScan', "为问题报告程序向导自动收集性能诊断信息时，遍历整个工作区，而非在默认 20,000 文件上限处停止。如果扫描拖慢向导初始呈现，请在超大型工作区中将此项设置为 false。"),
			experiment: { mode: 'auto' }
		},
	}
});

// Editor pane for tab display mode
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		IssueReporterEditorPane,
		IssueReporterEditorPane.ID,
		localize('issueReporterEditorPaneTitle', "问题报告器")
	),
	[new SyncDescriptor(IssueReporterEditorInput)]
);

class NativeIssueContribution extends BaseIssueContribution {

	constructor(
		@IProductService productService: IProductService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		super(productService, configurationService);

		if (!configurationService.getValue<boolean>('telemetry.feedback.enabled')) {
			return;
		}

		if (productService.reportIssueUrl) {
			this._register(registerAction2(ReportPerformanceIssueUsingReporterAction));
		}

		let disposable: IDisposable | undefined;

		const registerQuickAccessProvider = () => {
			disposable = Registry.as<IQuickAccessRegistry>(QuickAccessExtensions.Quickaccess).registerQuickAccessProvider({
				ctor: IssueQuickAccess,
				prefix: IssueQuickAccess.PREFIX,
				contextKey: 'inReportIssuePicker',
				placeholder: localize('tasksQuickAccessPlaceholder', "键入要报告的扩展名。"),
				helpEntries: [{
					description: localize('openIssueReporter', "打开问题报告程序"),
					commandId: 'workbench.action.openIssueReporter'
				}]
			});
		};

		this._register(configurationService.onDidChangeConfiguration(e => {
			if (!configurationService.getValue<boolean>('extensions.experimental.issueQuickAccess') && disposable) {
				disposable.dispose();
				disposable = undefined;
			} else if (!disposable) {
				registerQuickAccessProvider();
			}
		}));

		if (configurationService.getValue<boolean>('extensions.experimental.issueQuickAccess')) {
			registerQuickAccessProvider();
		}
	}
}
Registry.as<IWorkbenchContributionsRegistry>(Extensions.Workbench).registerWorkbenchContribution(NativeIssueContribution, LifecyclePhase.Restored);

class ReportPerformanceIssueUsingReporterAction extends Action2 {

	static readonly ID = 'workbench.action.reportPerformanceIssueUsingReporter';

	constructor() {
		super({
			id: ReportPerformanceIssueUsingReporterAction.ID,
			title: localize2({ key: 'reportPerformanceIssue', comment: [`Here, 'issue' means problem or bug`] }, "报告性能问题..."),
			category: Categories.Help,
			f1: true
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const issueService = accessor.get(IWorkbenchIssueService); // later can just get IIssueFormService

		return issueService.openReporter({ issueType: IssueType.PerformanceIssue });
	}
}

CommandsRegistry.registerCommand('_issues.getSystemStatus', (accessor) => {
	return accessor.get(IProcessService).getSystemStatus();
});

// #endregion
