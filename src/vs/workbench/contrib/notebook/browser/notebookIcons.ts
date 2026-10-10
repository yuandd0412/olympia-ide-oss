/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { localize } from '../../../../nls.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';

export const selectKernelIcon = registerIcon('notebook-kernel-select', Codicon.serverEnvironment, localize('selectKernelIcon', "配置用于在笔记本编辑器中选择内核的图标。"));
export const executeIcon = registerIcon('notebook-execute', Codicon.play, localize('executeIcon', "笔记本编辑器中的执行图标。"));
export const executeAboveIcon = registerIcon('notebook-execute-above', Codicon.runAbove, localize('executeAboveIcon', "用于在笔记本编辑器中在单元格上方进行执行的图标。"));
export const executeBelowIcon = registerIcon('notebook-execute-below', Codicon.runBelow, localize('executeBelowIcon', "用于在笔记本编辑器中在单元格下方进行执行的图标。"));
export const stopIcon = registerIcon('notebook-stop', Codicon.primitiveSquare, localize('stopIcon', "用于在笔记本编辑器中停止执行的图标。"));
export const deleteCellIcon = registerIcon('notebook-delete-cell', Codicon.trash, localize('deleteCellIcon', "用于在笔记本编辑器中删除单元格的图标。"));
export const executeAllIcon = registerIcon('notebook-execute-all', Codicon.runAll, localize('executeAllIcon', "用于在笔记本编辑器中执行所有单元格的图标。"));
export const editIcon = registerIcon('notebook-edit', Codicon.pencil, localize('editIcon', "用于在笔记本编辑器中编辑单元格的图标。"));
export const stopEditIcon = registerIcon('notebook-stop-edit', Codicon.check, localize('stopEditIcon', "用于在笔记本编辑器中停止编辑单元格的图标。"));
export const moveUpIcon = registerIcon('notebook-move-up', Codicon.arrowUp, localize('moveUpIcon', "用于在笔记本编辑器中上移单元格的图标。"));
export const moveDownIcon = registerIcon('notebook-move-down', Codicon.arrowDown, localize('moveDownIcon', "用于在笔记本编辑器中下移单元格的图标。"));
export const clearIcon = registerIcon('notebook-clear', Codicon.clearAll, localize('clearIcon', "用于在笔记本编辑器中清除单元格输出的图标。"));
export const splitCellIcon = registerIcon('notebook-split-cell', Codicon.splitVertical, localize('splitCellIcon', "用于在笔记本编辑器中拆分单元格的图标。"));
export const successStateIcon = registerIcon('notebook-state-success', Codicon.check, localize('successStateIcon', "用于在笔记本编辑器中指示成功状态的图标。"));
export const errorStateIcon = registerIcon('notebook-state-error', Codicon.error, localize('errorStateIcon', "用于在笔记本编辑器中指示错误状态的图标。"));
export const pendingStateIcon = registerIcon('notebook-state-pending', Codicon.clock, localize('pendingStateIcon', "用于在笔记本编辑器中指示挂起状态的图标。"));
export const executingStateIcon = registerIcon('notebook-state-executing', Codicon.sync, localize('executingStateIcon', "用于在笔记本编辑器中指示执行状态的图标。"));

export const collapsedIcon = registerIcon('notebook-collapsed', Codicon.chevronRight, localize('collapsedIcon', "用于在笔记本编辑器中批注已折叠部分的图标。"));
export const expandedIcon = registerIcon('notebook-expanded', Codicon.chevronDown, localize('expandedIcon', "用于在笔记本编辑器中批注已展开部分的图标。"));
export const openAsTextIcon = registerIcon('notebook-open-as-text', Codicon.fileCode, localize('openAsTextIcon', "用于在文本编辑器中打开笔记本的图标。"));
export const revertIcon = registerIcon('notebook-revert', Codicon.discard, localize('revertIcon', "笔记本编辑器中的还原图标。"));
export const toggleWhitespace = registerIcon('notebook-diff-cell-toggle-whitespace', Codicon.whitespace, localize('toggleWhitespace', "差异编辑器中“切换空白”操作的图标"));
export const renderOutputIcon = registerIcon('notebook-render-output', Codicon.preview, localize('renderOutputIcon', "用于在差异编辑器中呈现输出的图标。"));
export const mimetypeIcon = registerIcon('notebook-mimetype', Codicon.code, localize('mimetypeIcon', "MIME 类型笔记本编辑器的图标。"));
export const copyIcon = registerIcon('notebook-copy', Codicon.copy, localize('copyIcon', "将内容复制到剪贴板的图标"));
export const saveIcon = registerIcon('notebook-save', Codicon.save, localize('saveIcon', "用于将内容保存到磁盘的图标"));

export const previousChangeIcon = registerIcon('notebook-diff-editor-previous-change', Codicon.arrowUp, localize('previousChangeIcon', "差异编辑器中上一个更改操作的图标"));
export const nextChangeIcon = registerIcon('notebook-diff-editor-next-change', Codicon.arrowDown, localize('nextChangeIcon', "差异编辑器中下一个更改操作的图标"));

export const variablesViewIcon = registerIcon('variables-view-icon', Codicon.variableGroup, localize('variablesViewIcon', "查看变量视图的图标。"));
