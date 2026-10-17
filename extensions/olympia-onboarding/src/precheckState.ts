/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  「这份代码到底查过没有、查到了哪一层」这件事的一个事实来源。
 *
 *  为什么要有它：工具面板和状态栏原来都拿 `getDiagnostics()` 的空数组当"没问题"，
 *  可空数组有两种来源——查完确实没问题，和**根本没查过**（刚打开窗口时那个文件已经是活动
 *  编辑器，没有"变化"就没有检查）。第二种情况下写「无问题」，就是 2026-10-16 那次误报的
 *  形状：`cout <<` 断在一行中间，面板却全绿。
 *
 *  现在又多了一层，所以只记版本不够了：写完一个部件跑的是内置语法解析（不启编译器），
 *  它说"没报错"只等于结构没断。绿色勾是让人在提交前信任它的，所以那一层必须写清楚。
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';

/** `structure` = 只跑了进程内的语法解析；`compiled` = 真的用评测机那套开关编过一遍。 */
export type CheckLevel = 'structure' | 'compiled';

/** 两处界面各要一句合适长度的话：面板放得下解释，状态栏只放结论。 */
export const STRUCTURE_LABEL_PANEL = '结构没报错 · 未编译';
export const STRUCTURE_LABEL_STATUS = '结构没报错';

const checked = new Map<string, { version: number; level: CheckLevel }>();

function keyOf(uri: vscode.Uri): string {
	return uri.toString();
}

/** 检查的两半都落地之后才调用：只跑了模式规则不算查完。 */
export function markChecked(document: vscode.TextDocument, level: CheckLevel): void {
	checked.set(keyOf(document.uri), { version: document.version, level });
}

export function isChecked(document: vscode.TextDocument): boolean {
	return checked.get(keyOf(document.uri))?.version === document.version;
}

/** 这份文档当前那一层查完了；没查过就是 undefined（不能当作 compiled）。 */
export function checkLevel(document: vscode.TextDocument): CheckLevel | undefined {
	const entry = checked.get(keyOf(document.uri));
	return entry && entry.version === document.version ? entry.level : undefined;
}

export function forgetDocument(uri: vscode.Uri): void {
	checked.delete(keyOf(uri));
}
