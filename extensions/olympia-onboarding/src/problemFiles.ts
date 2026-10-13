/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  工作区里缓存的题面。
 *
 *  文件由 olympia-contest 写在 `<工作区>/.olympia/problems/<题号>.md`，这边只读不写：
 *  跑样例要从里面取样例数据，面板那一行要报出缓存了几份。两个扩展各列一遍目录迟早会对不上，
 *  所以列目录这件事在这个扩展里只有这一处。
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';

const DEFAULT_PROBLEMS_DIR = '.olympia/problems';
/** 题面文件名去掉后缀就是题号；机房里有人存成 P1001.MD，所以按大小写不敏感剥。 */
export function stripStatementExtension(name: string): string {
	return name.toLowerCase().endsWith(STATEMENT_EXTENSION) ? name.slice(0, -STATEMENT_EXTENSION.length) : name;
}

/** 题面后缀：列目录、监听、去掉后缀拿题号，都在这个扩展里，所以只有这一个值。 */
export const STATEMENT_EXTENSION = '.md';

/** 题面目录；没打开工作区时是 undefined（不是错误，只是没地方读）。 */
export function problemsDir(): vscode.Uri | undefined {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		return undefined;
	}
	const relative = vscode.workspace.getConfiguration('olympia')
		.get<string>('problem.problemsDir', DEFAULT_PROBLEMS_DIR);
	return vscode.Uri.joinPath(folder.uri, relative);
}

/** 目录里所有题面 Markdown。目录不存在（还没拉过题面）返回空数组。 */
export async function statementFiles(): Promise<vscode.Uri[]> {
	const dir = problemsDir();
	if (!dir) {
		return [];
	}
	let entries: readonly [string, vscode.FileType][];
	try {
		entries = await vscode.workspace.fs.readDirectory(dir);
	} catch {
		return [];    // 还没拉过题面，目录都不存在
	}
	return entries
		.filter(([name, type]) => type === vscode.FileType.File && name.toLowerCase().endsWith(STATEMENT_EXTENSION))
		.map(([name]) => vscode.Uri.joinPath(dir, name));
}

/** 题面目录里多一份少一份都回调一次：面板上那个数字要跟着拉题面走。 */
export function watchStatements(onChange: () => void): vscode.Disposable {
	const dir = problemsDir();
	if (!dir) {
		return { dispose() { /* 没打开工作区，本来就没得看 */ } };
	}
	const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(dir, `*${STATEMENT_EXTENSION}`));
	return vscode.Disposable.from(watcher, watcher.onDidCreate(onChange), watcher.onDidDelete(onChange));
}
