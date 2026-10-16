/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  本地题面库：把 `.olympia/problems/*.md` 变成一份能搜、能排序的清单。
 *
 *  题面是本扩展自己写下的 Markdown，所以「这是哪道题、什么难度、限时多少」不必再联网查一遍，
 *  直接从文件头两行读（字段的读写共用 `templates.ts` 里那张 FIELD 表）。
 *  老版本的题库是一页 JSON 加一个网页；这里改用 VS Code 的原生做法——搜索交给 quick pick，
 *  面板上只留一行「缓存里有几份题面」，点它就打开这份清单。
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { metaOf, platformText, STATEMENT_EXTENSION, FIELD, type ProblemMeta } from './templates';
import { markOf, type SolvedMark } from './solvedMarks';
import { favoriteKey } from './favorites';

export interface LibraryEntry extends ProblemMeta {
	readonly file: string;
	readonly mtimeMs: number;
}

/** quick pick 的一项：把 entry 带在身上，选中之后不用再按文件名去找。 */
export interface LibraryPick extends vscode.QuickPickItem {
	readonly entry: LibraryEntry;
	/** AC 过几次（0 = 没做过）。留着而不是只留那份文字，将来「只看做出来的」要按它筛。 */
	readonly solvedTimes: number;
	readonly favorite: boolean;
}

/** 做出来的题在列表里的样子：一眼扫过去就知道哪道不用再碰。 */
const SOLVED_PREFIX = '✓ ';
const solvedText = (mark: SolvedMark): string => mark.times > 1 ? `已 AC ${mark.times} 次` : '已 AC';

/**
 * 收藏的题排在最前，标一颗 ★。星标写在 label 里不是装饰：quick pick 默认就按 label 匹配，
 * 所以搜「★」自然只剩收藏的那几道——和「敲 AC 只看做出来的」是同一条免费的路。
 */
const FAVORITE_PREFIX = '★ ';
export const FAVORITE_BUTTON: vscode.QuickInputButton = { iconPath: new vscode.ThemeIcon('star-empty'), tooltip: '收藏这道题（再点一次取消）' };
export const UNFAVORITE_BUTTON: vscode.QuickInputButton = { iconPath: new vscode.ThemeIcon('star-full'), tooltip: '取消收藏' };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 列出题面目录里的每一份 Markdown，按「最近拉的排前面」。
 * 读不出标题的文件（手写的、抓取失败的半成品）也照样列出来，用文件名当题号——
 * 题库少一道，比题库直接报错严重。
 */
export async function readLibrary(root: string): Promise<LibraryEntry[]> {
	const entries: LibraryEntry[] = [];
	for (const file of await markdownFiles(root)) {
		const [markdown, stat] = await Promise.all([
			fs.promises.readFile(file, 'utf8').catch(() => ''),
			fs.promises.stat(file).catch(() => undefined)
		]);
		entries.push({
			...metaOf(markdown, stemOf(file)),
			file,
			mtimeMs: stat?.mtimeMs ?? 0
		});
	}
	return sortByRecent(entries);
}

/** 面板上那一行只想知道数量，不必把每份题面都读一遍。 */
export async function countLibrary(root: string): Promise<number> {
	return (await markdownFiles(root)).length;
}

export function sortByRecent(entries: readonly LibraryEntry[]): LibraryEntry[] {
	return [...entries].sort((a, b) => b.mtimeMs - a.mtimeMs || a.id.localeCompare(b.id, 'en'));
}

export function toPicks(entries: readonly LibraryEntry[], workspaceRoot?: string, marks: ReadonlyMap<string, SolvedMark> = new Map(), favorites: ReadonlySet<string> = new Set()): LibraryPick[] {
	const picks = entries.map(entry => {
		const solved = markOf(marks, entry.id);
		const favorite = favorites.has(favoriteKey(entry.id));
		const summary = summaryOf(entry);
		const tail = [summary, solved ? solvedText(solved) : undefined, favorite ? '已收藏' : undefined].filter(Boolean).join(' · ');
		return {
			entry,
			solvedTimes: solved?.times ?? 0,
			favorite,
			label: `${favorite ? FAVORITE_PREFIX : ''}${solved ? SOLVED_PREFIX : ''}${entry.id} ${entry.title}`.trim(),
			description: tail,
			detail: `${relative(entry.file, workspaceRoot)} · 拉取于 ${ago(entry.mtimeMs)}`,
		};
	});
	// 收藏优先，其余保持「最近拉的在前」。按钮不在这里挂：别的调用方（比如「打开原题网页」）
	// 没有处理按钮的逻辑，挂上去就是一颗点了没反应的 ★。
	return picks.sort((a, b) => Number(b.favorite) - Number(a.favorite));
}

/** 一行能看完的题面摘要；时限内存照题面原文写，不做单位换算。 */
export function summaryOf(entry: LibraryEntry): string {
	const parts = [
		// 老题面里写的是内部 id（来源：luogu），列出来时统一成中文，新题面本来就是中文
		entry.source && platformText(entry.source),
		entry.difficulty,
		entry.timeLimit && `${FIELD.timeLimit} ${entry.timeLimit}`,
		entry.memoryLimit && `${FIELD.memoryLimit} ${entry.memoryLimit}`,
		entry.sampleCount ? `样例 ${entry.sampleCount} 组` : undefined,
	];
	return parts.filter(Boolean).join(' · ');
}

/**
 * 以文本方式打开题面：这是退路，不是主路。主路是侧栏里渲染好的「题面」视图
 * （statementView.ts）——学生读的是题，不是 Markdown 源码。留这条是因为题面偶尔要手改
 * （补样例、改格式），改完侧栏会跟着文件变化重画。
 */
export async function editStatement(uri: vscode.Uri): Promise<void> {
	const doc = await vscode.workspace.openTextDocument(uri);
	await vscode.window.showTextDocument(doc, { preview: false });
}

async function markdownFiles(root: string): Promise<string[]> {
	const names = await fs.promises.readdir(root).catch(() => [] as string[]);
	return names
		.filter(name => name.toLowerCase().endsWith(STATEMENT_EXTENSION))
		.map(name => path.join(root, name));
}

/** 文件名去掉题面后缀就是题号（手写的题面没有标题行时用它兜底）。 */
function stemOf(file: string): string {
	const name = path.basename(file);
	return name.slice(0, name.length - STATEMENT_EXTENSION.length);
}

function relative(file: string, workspaceRoot?: string): string {
	const prefix = workspaceRoot ? `${workspaceRoot.replace(/[\\/]+$/, '')}${path.sep}` : undefined;
	return prefix && file.startsWith(prefix) ? file.slice(prefix.length) : file;
}

/** 只说「几天前」：题库要的是新旧，不是完整时间戳。 */
function ago(mtimeMs: number): string {
	if (!mtimeMs) { return '未知'; }
	const days = Math.floor((Date.now() - mtimeMs) / DAY_MS);
	if (days <= 0) { return '今天'; }
	if (days === 1) { return '昨天'; }
	if (days < 30) { return `${days} 天前`; }
	return new Date(mtimeMs).toLocaleDateString('zh-CN');
}
