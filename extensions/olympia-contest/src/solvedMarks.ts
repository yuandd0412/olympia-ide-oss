/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  题面库里标出「这道我做出来了」。
 *
 *  数据不是这边写的：跑样例判成 AC 时由 olympia-onboarding 记进 `.olympia/solves.json`。
 *  两个扩展各留一份小读取器（共享文件而不是共享代码，跨扩展没有 import 这条路），
 *  所以字段名对不上的风险由 `scripts/oneoff/test-problem-library.mjs` 顶着：
 *  那条检查用**产品自己的写入方**写记录，再用这里的读取方读回来。
 *--------------------------------------------------------------------------------------------*/
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const SOLVES_FOLDER = '.olympia';
const SOLVES_FILE = 'solves.json';

export interface SolvedMark {
	/** AC 过几次：重做同一道题是常事，次数比「做过没有」有用。 */
	readonly times: number;
}

function solvesFile(): string | undefined {
	const folder = vscode.workspace.workspaceFolders?.[0];
	return folder ? path.join(folder.uri.fsPath, SOLVES_FOLDER, SOLVES_FILE) : undefined;
}

/** 题号 → 做过几次。题号按大小写不敏感对齐：题面文件名和记录里的写法可能不同。 */
export async function solvedMarks(): Promise<ReadonlyMap<string, SolvedMark>> {
	const file = solvesFile();
	if (!file) {
		return new Map();
	}
	let records: unknown;
	try {
		records = JSON.parse((await fs.promises.readFile(file, 'utf8')).toString());
	} catch {
		// 新工程里根本没有这个文件；读不出来也不能让题库打不开。
		return new Map();
	}
	if (!Array.isArray(records)) {
		return new Map();
	}
	const marks = new Map<string, SolvedMark>();
	for (const item of records) {
		const problem = (item as { problem?: unknown })?.problem;
		if (typeof problem !== 'string' || !problem.trim()) {
			continue;
		}
		const key = problem.trim().toLowerCase();
		marks.set(key, { times: (marks.get(key)?.times ?? 0) + 1 });
	}
	return marks;
}

/** 题库那一行的「已 AC」字样；没有记录就什么都不加。 */
export function markOf(marks: ReadonlyMap<string, SolvedMark>, id: string): SolvedMark | undefined {
	return marks.get(id.trim().toLowerCase());
}
