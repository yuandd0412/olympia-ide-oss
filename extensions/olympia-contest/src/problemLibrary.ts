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

import { metaOf, platformText, type ProblemMeta } from './templates';
import { markOf, type SolvedMark } from './solvedMarks';

export interface LibraryEntry extends ProblemMeta {
	readonly file: string;
	readonly mtimeMs: number;
}

/** quick pick 的一项：把 entry 带在身上，选中之后不用再按文件名去找。 */
export interface LibraryPick extends vscode.QuickPickItem {
	readonly entry: LibraryEntry;
	/** AC 过几次（0 = 没做过）。留着而不是只留那份文字，将来「只看做出来的」要按它筛。 */
	readonly solvedTimes: number;
}

/** 做出来的题在列表里的样子：一眼扫过去就知道哪道不用再碰。 */
const SOLVED_PREFIX = '✓ ';
const solvedText = (mark: SolvedMark): string => mark.times > 1 ? `已 AC ${mark.times} 次` : '已 AC';

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
			...metaOf(markdown, path.basename(file).replace(/\.md$/i, '')),
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

export function toPicks(entries: readonly LibraryEntry[], workspaceRoot?: string, marks: ReadonlyMap<string, SolvedMark> = new Map()): LibraryPick[] {
	return entries.map(entry => {
		const solved = markOf(marks, entry.id);
		const summary = summaryOf(entry);
		return {
			entry,
			solvedTimes: solved?.times ?? 0,
			label: `${solved ? SOLVED_PREFIX : ''}${entry.id} ${entry.title}`.trim(),
			description: solved ? `${summary} · ${solvedText(solved)}` : summary,
			detail: `${relative(entry.file, workspaceRoot)} · 拉取于 ${ago(entry.mtimeMs)}`,
		};
	});
}

/** 一行能看完的题面摘要；时限内存照题面原文写，不做单位换算。 */
export function summaryOf(entry: LibraryEntry): string {
	const parts = [
		// 老题面里写的是内部 id（来源：luogu），列出来时统一成中文，新题面本来就是中文
		entry.source && platformText(entry.source),
		entry.difficulty,
		entry.timeLimit && `时限 ${entry.timeLimit}`,
		entry.memoryLimit && `内存 ${entry.memoryLimit}`,
		entry.sampleCount ? `样例 ${entry.sampleCount} 组` : undefined,
	];
	return parts.filter(Boolean).join(' · ');
}

/** 打开选中题面的编辑器，关掉预览模式，免得下一道题把它顶掉。 */
export async function showStatement(uri: vscode.Uri): Promise<void> {
	const doc = await vscode.workspace.openTextDocument(uri);
	await vscode.window.showTextDocument(doc, { preview: false });
}

async function markdownFiles(root: string): Promise<string[]> {
	const names = await fs.promises.readdir(root).catch(() => [] as string[]);
	return names
		.filter(name => name.toLowerCase().endsWith('.md'))
		.map(name => path.join(root, name));
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
