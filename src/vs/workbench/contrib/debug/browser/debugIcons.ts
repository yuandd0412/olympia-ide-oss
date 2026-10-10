/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { localize } from '../../../../nls.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';

export const debugConsoleViewIcon = registerIcon('debug-console-view-icon', Codicon.debugConsole, localize('debugConsoleViewIcon', "查看调试控制台视图的图标。"));
export const runViewIcon = registerIcon('run-view-icon', Codicon.debugAlt, localize('runViewIcon', "查看运行视图的图标。"));
export const variablesViewIcon = registerIcon('variables-view-icon', Codicon.debugAlt, localize('variablesViewIcon', "查看变量视图的图标。"));
export const watchViewIcon = registerIcon('watch-view-icon', Codicon.debugAlt, localize('watchViewIcon', "查看监视视图的图标。"));
export const callStackViewIcon = registerIcon('callstack-view-icon', Codicon.debugAlt, localize('callStackViewIcon', "查看调用堆栈视图的图标。"));
export const breakpointsViewIcon = registerIcon('breakpoints-view-icon', Codicon.debugAlt, localize('breakpointsViewIcon', "查看断点视图的图标。"));
export const loadedScriptsViewIcon = registerIcon('loaded-scripts-view-icon', Codicon.debugAlt, localize('loadedScriptsViewIcon', "查看已加载脚本视图的图标。"));

export const breakpoint = {
	regular: registerIcon('debug-breakpoint', Codicon.debugBreakpoint, localize('debugBreakpoint', "断点的图标。")),
	disabled: registerIcon('debug-breakpoint-disabled', Codicon.debugBreakpointDisabled, localize('debugBreakpointDisabled', "已禁用的断点的图标。")),
	unverified: registerIcon('debug-breakpoint-unverified', Codicon.debugBreakpointUnverified, localize('debugBreakpointUnverified', "未验证的断点的图标。")),
	pending: registerIcon('debug-breakpoint-pending', Codicon.debugBreakpointPending, localize('debugBreakpointPendingOnTrigger', "等待另一个断点的断点的图标。")),
};
export const functionBreakpoint = {
	regular: registerIcon('debug-breakpoint-function', Codicon.debugBreakpointFunction, localize('debugBreakpointFunction', "函数断点的图标。")),
	disabled: registerIcon('debug-breakpoint-function-disabled', Codicon.debugBreakpointFunctionDisabled, localize('debugBreakpointFunctionDisabled', "已禁用的函数断点的图标。")),
	unverified: registerIcon('debug-breakpoint-function-unverified', Codicon.debugBreakpointFunctionUnverified, localize('debugBreakpointFunctionUnverified', "未验证的函数断点的图标。"))
};
export const conditionalBreakpoint = {
	regular: registerIcon('debug-breakpoint-conditional', Codicon.debugBreakpointConditional, localize('debugBreakpointConditional', "条件断点的图标。")),
	disabled: registerIcon('debug-breakpoint-conditional-disabled', Codicon.debugBreakpointConditionalDisabled, localize('debugBreakpointConditionalDisabled', "已禁用的条件断点的图标。")),
	unverified: registerIcon('debug-breakpoint-conditional-unverified', Codicon.debugBreakpointConditionalUnverified, localize('debugBreakpointConditionalUnverified', "未验证的条件断点的图标。"))
};
export const dataBreakpoint = {
	regular: registerIcon('debug-breakpoint-data', Codicon.debugBreakpointData, localize('debugBreakpointData', "数据断点的图标。")),
	disabled: registerIcon('debug-breakpoint-data-disabled', Codicon.debugBreakpointDataDisabled, localize('debugBreakpointDataDisabled', "已禁用的数据断点的图标。")),
	unverified: registerIcon('debug-breakpoint-data-unverified', Codicon.debugBreakpointDataUnverified, localize('debugBreakpointDataUnverified', "未验证的数据断点的图标。")),
};
export const logBreakpoint = {
	regular: registerIcon('debug-breakpoint-log', Codicon.debugBreakpointLog, localize('debugBreakpointLog', "日志断点的图标。")),
	disabled: registerIcon('debug-breakpoint-log-disabled', Codicon.debugBreakpointLogDisabled, localize('debugBreakpointLogDisabled', "已禁用的日志断点的图标。")),
	unverified: registerIcon('debug-breakpoint-log-unverified', Codicon.debugBreakpointLogUnverified, localize('debugBreakpointLogUnverified', "未验证的日志断点的图标。")),
};

export const debugBreakpointHint = registerIcon('debug-hint', Codicon.debugHint, localize('debugBreakpointHint', "在编辑器字形边距中悬停时显示的断点提示的图标。"));
export const debugBreakpointUnsupported = registerIcon('debug-breakpoint-unsupported', Codicon.debugBreakpointUnsupported, localize('debugBreakpointUnsupported', "不受支持的断点的图标。"));

export const allBreakpoints = [breakpoint, functionBreakpoint, conditionalBreakpoint, dataBreakpoint, logBreakpoint];


export const debugStackframe = registerIcon('debug-stackframe', Codicon.debugStackframe, localize('debugStackframe', "编辑器字形边距中显示的堆栈帧的图标。"));
export const debugStackframeFocused = registerIcon('debug-stackframe-focused', Codicon.debugStackframeFocused, localize('debugStackframeFocused', "编辑器字形边距中显示的具有焦点的堆栈帧的图标。"));

export const debugGripper = registerIcon('debug-gripper', Codicon.gripper, localize('debugGripper', "调试条控制手柄的图标。"));

export const debugRestartFrame = registerIcon('debug-restart-frame', Codicon.debugRestartFrame, localize('debugRestartFrame', "“调试重启帧”操作的图标。"));

export const debugStop = registerIcon('debug-stop', Codicon.debugStop, localize('debugStop', "“调试停止”操作的图标。"));
export const debugDisconnect = registerIcon('debug-disconnect', Codicon.debugDisconnect, localize('debugDisconnect', "“调试断开”操作的图标。"));
export const debugRestart = registerIcon('debug-restart', Codicon.debugRestart, localize('debugRestart', "“调试重启”操作的图标。"));
export const debugStepOver = registerIcon('debug-step-over', Codicon.debugStepOver, localize('debugStepOver', "“调试越过子函数”操作的图标。"));
export const debugStepInto = registerIcon('debug-step-into', Codicon.debugStepInto, localize('debugStepInto', "“调试进入子函数”的图标。"));
export const debugStepOut = registerIcon('debug-step-out', Codicon.debugStepOut, localize('debugStepOut', "“调试跳出子函数”操作的图标。"));
export const debugStepBack = registerIcon('debug-step-back', Codicon.debugStepBack, localize('debugStepBack', "“调试单步后退”操作的图标。"));
export const debugPause = registerIcon('debug-pause', Codicon.debugPause, localize('debugPause', "“调试暂停”操作的图标。"));
export const debugContinue = registerIcon('debug-continue', Codicon.debugContinue, localize('debugContinue', "“调试继续”操作的图标。"));
export const debugReverseContinue = registerIcon('debug-reverse-continue', Codicon.debugReverseContinue, localize('debugReverseContinue', "“调试反向继续”操作的图标。"));
export const debugRun = registerIcon('debug-run', Codicon.run, localize('debugRun', "运行或调试操作的图标。"));

export const debugStart = registerIcon('debug-start', Codicon.debugStart, localize('debugStart', "“调试启动”操作的图标。"));
export const debugConfigure = registerIcon('debug-configure', Codicon.gear, localize('debugConfigure', "“调试配置”操作的图标。"));
export const debugConsole = registerIcon('debug-console', Codicon.gear, localize('debugConsole', "调试控制台的“打开”操作的图标。"));
export const debugRemoveConfig = registerIcon('debug-remove-config', Codicon.trash, localize('debugRemoveConfig', "用于删除调试配置的图标。"));

export const debugCollapseAll = registerIcon('debug-collapse-all', Codicon.collapseAll, localize('debugCollapseAll', "调试视图中“全部折叠”操作的图标。"));
export const callstackViewSession = registerIcon('callstack-view-session', Codicon.bug, localize('callstackViewSession', "“调用堆栈”视图中会话图标的图标。"));
export const debugConsoleClearAll = registerIcon('debug-console-clear-all', Codicon.clearAll, localize('debugConsoleClearAll', "调试控制台中“全部清除”操作的图标。"));
export const watchExpressionsRemoveAll = registerIcon('watch-expressions-remove-all', Codicon.closeAll, localize('watchExpressionsRemoveAll', "监视视图中“全部删除”操作的图标。"));
export const watchExpressionRemove = registerIcon('watch-expression-remove', Codicon.removeClose, localize('watchExpressionRemove', "监视视图中“删除”操作的图标。"));
export const watchExpressionsAdd = registerIcon('watch-expressions-add', Codicon.add, localize('watchExpressionsAdd', "监视视图中“添加”操作的图标。"));
export const watchExpressionsAddFuncBreakpoint = registerIcon('watch-expressions-add-function-breakpoint', Codicon.add, localize('watchExpressionsAddFuncBreakpoint', "监视视图中“添加函数断点”操作的图标。"));
export const watchExpressionsAddDataBreakpoint = registerIcon('watch-expressions-add-data-breakpoint', Codicon.variableGroup, localize('watchExpressionsAddDataBreakpoint', "断点视图中添加数据断点操作的图标。"));

export const breakpointsRemoveAll = registerIcon('breakpoints-remove-all', Codicon.closeAll, localize('breakpointsRemoveAll', "“断点”视图中“全部删除”操作的图标。"));
export const breakpointsActivate = registerIcon('breakpoints-activate', Codicon.activateBreakpoints, localize('breakpointsActivate', "“断点”视图中“激活”操作的图标。"));

export const debugConsoleEvaluationInput = registerIcon('debug-console-evaluation-input', Codicon.arrowSmallRight, localize('debugConsoleEvaluationInput', "调试评估输入标记的图标。"));
export const debugConsoleEvaluationPrompt = registerIcon('debug-console-evaluation-prompt', Codicon.chevronRight, localize('debugConsoleEvaluationPrompt', "调试评估提示的图标。"));

export const debugInspectMemory = registerIcon('debug-inspect-memory', Codicon.fileBinary, localize('debugInspectMemory', "检查内存操作的图标。"));
