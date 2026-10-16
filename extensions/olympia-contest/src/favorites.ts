/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  题面库的「收藏」：把这道题标出来，下次打开题库它排在最前面。
 *
 *  老版本的题库有 ★ 收藏，这一版一度只剩「按最近拉取排序」。缓存到一两百道题之后，
 *  学生真正要找的不是最近拉的那道，而是「我还没做完的那几道」——所以收藏必须存在本地，
 *  而且跟着工程文件夹走（机房拷 `.olympia\` 就带走），不存在账号里。
 *  文件格式和 solves.json 一样：一个题号数组，坏文件不影响题库打开。
 *--------------------------------------------------------------------------------------------*/
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const FOLDER = '.olympia';
const FILE = 'favorites.json';

function favoritesFile(): string | undefined {
	const folder = vscode.workspace.workspaceFolders?.[0];
	return folder ? path.join(folder.uri.fsPath, FOLDER, FILE) : undefined;
}

/** 题号按大小写不敏感对齐题面文件名（`P1001` 与 `p1001` 是同一道题）。 */
export function favoriteKey(id: string): string {
	return id.trim().toLowerCase();
}

export async function readFavorites(): Promise<ReadonlySet<string>> {
	const file = favoritesFile();
	if (!file) { return new Set(); }
	let records: unknown;
	try {
		records = JSON.parse((await fs.promises.readFile(file, 'utf8')).toString());
	} catch {
		return new Set();
	}
	if (!Array.isArray(records)) { return new Set(); }
	return new Set(records.filter((item): item is string => typeof item === 'string' && !!item.trim()).map(favoriteKey));
}

/**
 * 点上那颗 ★：收藏就加进名单，再点一次取消。
 * 返回新的状态（true = 现在收藏着），调用方用它决定要不要提示。
 * 写失败要说出来——静默失败的话，学生会以为收藏住了，换台机器才发现没有。
 */
export async function toggleFavorite(id: string): Promise<boolean | undefined> {
	const file = favoritesFile();
	if (!file) { return undefined; }
	const next = new Set(await readFavorites());
	const key = favoriteKey(id);
	const added = !next.has(key);
	if (added) { next.add(key); } else { next.delete(key); }
	try {
		await fs.promises.mkdir(path.dirname(file), { recursive: true });
		const ids = [...next].sort();
		await fs.promises.writeFile(file, `${JSON.stringify(ids, undefined, '\t')}\n`, 'utf8');
		return added;
	} catch (err) {
		void vscode.window.showErrorMessage(`收藏没写进去：检查工程的 ${FOLDER}/${FILE} 是否可写（${(err as Error)?.message ?? err}）。`);
		return undefined;
	}
}
