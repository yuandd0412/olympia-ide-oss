/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { asCssVariable, asCssVariableName, registerColor, transparent } from '../../../../platform/theme/common/colorRegistry.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IDebugService, State, IDebugSession, IDebugConfiguration } from '../common/debug.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { STATUS_BAR_FOREGROUND, STATUS_BAR_BORDER, COMMAND_CENTER_BACKGROUND } from '../../../common/theme.js';
import { DisposableStore, IDisposable } from '../../../../base/common/lifecycle.js';
import { IStatusbarService } from '../../../services/statusbar/browser/statusbar.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { createStyleSheet } from '../../../../base/browser/domStylesheets.js';


// colors for theming

export const STATUS_BAR_DEBUGGING_BACKGROUND = registerColor('statusBar.debuggingBackground', {
	dark: '#CC6633',
	light: '#CC6633',
	hcDark: '#BA592C',
	hcLight: '#B5200D'
}, localize('statusBarDebuggingBackground', "调试程序时状态栏的背景颜色。状态栏显示在窗口底部"));

export const STATUS_BAR_DEBUGGING_FOREGROUND = registerColor('statusBar.debuggingForeground', {
	dark: STATUS_BAR_FOREGROUND,
	light: STATUS_BAR_FOREGROUND,
	hcDark: STATUS_BAR_FOREGROUND,
	hcLight: '#FFFFFF'
}, localize('statusBarDebuggingForeground', "调试程序时状态栏的前景色。状态栏显示在窗口底部"));

export const STATUS_BAR_DEBUGGING_BORDER = registerColor('statusBar.debuggingBorder', STATUS_BAR_BORDER, localize('statusBarDebuggingBorder', "调试程序时区别于侧边栏和编辑器的状态栏边框颜色。状态栏显示在窗口底部。"));

export const COMMAND_CENTER_DEBUGGING_BACKGROUND = registerColor(
	'commandCenter.debuggingBackground',
	transparent(STATUS_BAR_DEBUGGING_BACKGROUND, 0.258),
	localize('commandCenter-activeBackground', "调试程序时命令中心的背景颜色"),
	true
);

export class StatusBarColorProvider implements IWorkbenchContribution {

	private readonly disposables = new DisposableStore();
	private disposable: IDisposable | undefined;

	private readonly styleSheet = createStyleSheet();

	private set enabled(enabled: boolean) {
		if (enabled === !!this.disposable) {
			return;
		}

		if (enabled) {
			this.disposable = this.statusbarService.overrideStyle({
				priority: 10,
				foreground: STATUS_BAR_DEBUGGING_FOREGROUND,
				background: STATUS_BAR_DEBUGGING_BACKGROUND,
				border: STATUS_BAR_DEBUGGING_BORDER,
			});
		} else {
			this.disposable!.dispose();
			this.disposable = undefined;
		}
	}

	constructor(
		@IDebugService private readonly debugService: IDebugService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		this.debugService.onDidChangeState(this.update, this, this.disposables);
		this.contextService.onDidChangeWorkbenchState(this.update, this, this.disposables);
		this.configurationService.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('debug.enableStatusBarColor') || e.affectsConfiguration('debug.toolBarLocation')) {
				this.update();
			}
		}, undefined, this.disposables);
		this.update();
	}

	protected update(): void {
		const debugConfig = this.configurationService.getValue<IDebugConfiguration>('debug');
		const isInDebugMode = isStatusbarInDebugMode(this.debugService.state, this.debugService.getModel().getSessions());
		if (!debugConfig.enableStatusBarColor) {
			this.enabled = false;
		} else {
			this.enabled = isInDebugMode;
		}

		const isInCommandCenter = debugConfig.toolBarLocation === 'commandCenter';

		this.styleSheet.textContent = isInCommandCenter && isInDebugMode ? `
			.monaco-workbench {
				${asCssVariableName(COMMAND_CENTER_BACKGROUND)}: ${asCssVariable(COMMAND_CENTER_DEBUGGING_BACKGROUND)};
			}
		` : '';
	}

	dispose(): void {
		this.disposable?.dispose();
		this.disposables.dispose();
	}
}

export function isStatusbarInDebugMode(state: State, sessions: IDebugSession[]): boolean {
	if (state === State.Inactive || state === State.Initializing || sessions.every(s => s.suppressDebugStatusbar || s.configuration?.noDebug)) {
		return false;
	}

	return true;
}
