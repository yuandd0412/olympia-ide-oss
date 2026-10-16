/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  「这份代码到底查过没有」这件事的一个事实来源。
 *
 *  为什么要有它：工具面板和状态栏原来都拿 `getDiagnostics()` 的空数组当"没问题"，
 *  可空数组有两种来源——查完确实没问题，和**根本没查过**（刚打开窗口时那个文件已经是活动
 *  编辑器，没有"变化"就没有检查）。第二种情况下写「无问题」，就是 2026-10-16 那次误报的
 *  形状：`cout <<` 断在一行中间，面板却全绿。
 *
 *  所以这里只记一件事：某个文档的某个版本，检查（含语法那一半）跑完了。没记上就是没查过。
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';

const checked = new Map<string, number>();

function keyOf(uri: vscode.Uri): string {
	return uri.toString();
}

/** 语法那一半也落地之后才调用：只跑了模式规则不算查完。 */
export function markChecked(document: vscode.TextDocument): void {
	checked.set(keyOf(document.uri), document.version);
}

export function isChecked(document: vscode.TextDocument): boolean {
	return checked.get(keyOf(document.uri)) === document.version;
}

export function forgetDocument(uri: vscode.Uri): void {
	checked.delete(keyOf(uri));
}
