/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { AccessibleViewProviderId, AccessibleViewType, IAccessibleViewContentProvider } from '../../../../platform/accessibility/browser/accessibleView.js';
import { IAccessibleViewImplementation } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { AccessibilityVerbositySettingId } from '../../accessibility/browser/accessibilityConfiguration.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { AccessibilityHelpNLS } from '../../../../editor/common/standaloneStrings.js';
import { FocusedViewContext, SidebarFocusContext } from '../../../common/contextkeys.js';
import { BREAKPOINTS_VIEW_ID, CALLSTACK_VIEW_ID, LOADED_SCRIPTS_VIEW_ID, VARIABLES_VIEW_ID, WATCH_VIEW_ID } from '../common/debug.js';

export class RunAndDebugAccessibilityHelp implements IAccessibleViewImplementation {
	priority = 120;
	name = 'runAndDebugHelp';
	when = ContextKeyExpr.or(
		ContextKeyExpr.and(ContextKeyExpr.equals('activeViewlet', 'workbench.view.debug'), SidebarFocusContext),
		ContextKeyExpr.equals(FocusedViewContext.key, VARIABLES_VIEW_ID),
		ContextKeyExpr.equals(FocusedViewContext.key, WATCH_VIEW_ID),
		ContextKeyExpr.equals(FocusedViewContext.key, CALLSTACK_VIEW_ID),
		ContextKeyExpr.equals(FocusedViewContext.key, LOADED_SCRIPTS_VIEW_ID),
		ContextKeyExpr.equals(FocusedViewContext.key, BREAKPOINTS_VIEW_ID)
	);
	type: AccessibleViewType = AccessibleViewType.Help;
	getProvider(accessor: ServicesAccessor) {
		return new RunAndDebugAccessibilityHelpProvider(accessor.get(ICommandService), accessor.get(IViewsService));
	}
}

class RunAndDebugAccessibilityHelpProvider extends Disposable implements IAccessibleViewContentProvider {
	public readonly id = AccessibleViewProviderId.RunAndDebug;
	public readonly verbositySettingKey = AccessibilityVerbositySettingId.Debug;
	public readonly options = { type: AccessibleViewType.Help };
	private _focusedView: string | undefined;
	constructor(
		@ICommandService private readonly _commandService: ICommandService,
		@IViewsService private readonly _viewsService: IViewsService
	) {
		super();
		this._focusedView = this._viewsService.getFocusedViewName();
	}

	public onClose(): void {
		switch (this._focusedView) {
			case 'Watch':
				this._commandService.executeCommand('workbench.debug.action.focusWatchView');
				break;
			case 'Variables':
				this._commandService.executeCommand('workbench.debug.action.focusVariablesView');
				break;
			case 'Call Stack':
				this._commandService.executeCommand('workbench.debug.action.focusCallStackView');
				break;
			case 'Breakpoints':
				this._commandService.executeCommand('workbench.debug.action.focusBreakpointsView');
				break;
			default:
				this._commandService.executeCommand('workbench.view.debug');
		}
	}

	public provideContent(): string {
		return [
			localize('debug.showRunAndDebug', "「显示运行和调试」视图命令{0}将打开当前视图。", '<keybinding:workbench.view.debug>'),
			localize('debug.startDebugging', "「调试：开始调试」命令{0}将启动一个调试会话。", '<keybinding:workbench.action.debug.start>'),
			localize('debug.help', "在调试控制台中查看调试输出并求值表达式，可用{0}聚焦到调试控制台。", '<keybinding:workbench.panel.repl.view.focus>'),
			AccessibilityHelpNLS.setBreakpoint,
			AccessibilityHelpNLS.addToWatch,
			localize('onceDebugging', "开始调试后，以下命令将可用："),
			localize('debug.restartDebugging', "- 「调试：重新开始调试」命令{0}将重启当前调试会话。", '<keybinding:workbench.action.debug.restart>'),
			localize('debug.stopDebugging', "- 「调试：停止调试」命令{0}将停止当前调试会话。", '<keybinding:workbench.action.debug.stop>'),
			localize('debug.continue', "- 「调试：继续」命令{0}将继续执行直到下一个断点。", '<keybinding:workbench.action.debug.continue>'),
			localize('debug.stepInto', "- 「调试：步入」命令{0}将步入下一个函数调用。", '<keybinding:workbench.action.debug.stepInto>'),
			localize('debug.stepOver', "- 「调试：步过」命令{0}将步过当前函数调用。", '<keybinding:workbench.action.debug.stepOver>'),
			localize('debug.stepOut', "- 「调试：步出」命令{0}将步出当前函数调用。", '<keybinding:workbench.action.debug.stepOut>'),
			localize('debug.views', "调试 viewlet 由多个视图组成，这些视图可通过以下命令聚焦，也可以通过 tab 键和箭头键导航到："),
			localize('debug.focusBreakpoints', "- 「调试：聚焦到断点视图」命令{0}将聚焦到断点视图。", '<keybinding:workbench.debug.action.focusBreakpointsView>'),
			localize('debug.focusCallStack', "- 「调试：聚焦到调用堆栈视图」命令{0}将聚焦到调用堆栈视图。", '<keybinding:workbench.debug.action.focusCallStackView>'),
			localize('debug.focusVariables', "- 「调试：聚焦到变量视图」命令{0}将聚焦到变量视图。", '<keybinding:workbench.debug.action.focusVariablesView>'),
			localize('debug.focusWatch', "- 「调试：聚焦到监视视图」命令{0}将聚焦到监视视图。", '<keybinding:workbench.debug.action.focusWatchView>'),
			localize('debug.watchSetting', "设置项 {0} 控制是否播报监视变量的变化。", 'accessibility.debugWatchVariableAnnouncements'),
		].join('\n');
	}
}

