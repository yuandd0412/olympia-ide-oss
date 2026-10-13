/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  集训清单：一份起了名字的题目清单，外加这一场的时长，存在工程的 .olympia/practice.json 里。
 *
 *  老版本（Tauri 那份）就有这个东西，它的清单来自一份 PDF 题单。这一版没有 PDF 阅读器，
 *  所以题目由学生自己填题号，但「命名 + 一组题 + 一个时长」这三件事是一样的：
 *  开一场的倒计时从清单来，不用每次重新报一遍题号，也不用重新想今天打哪几道。
 *  文件跟着工程走，机房那台机器打开同一个文件夹就是同一份清单。
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TEMPLATE_FOLDER } from './templates';

export const PRACTICE_FILE = 'practice.json';
/** 一场最多列这么多题：再多就不是清单了，是把整本习题册搬进来。 */
export const MAX_PRACTICE_PROBLEMS = 100;
/** 时长和比赛模式那边同一个口径：少于 5 分钟不像一场比赛，多于 600 分钟多半是填错了。 */
export const PRACTICE_MINUTES_MIN = 5;
export const PRACTICE_MINUTES_MAX = 600;

export interface PracticeList {
	name: string;
	problems: string[];
	/** 这一场的分钟数；没填就是「不设时限」，开场时按平时的方式问。 */
	minutes?: number;
	createdAt: string;
}

/** 清单文件的位置；没打开工作区时是 undefined（不是错误，只是没地方存）。 */
export function practiceFile(): vscode.Uri | undefined {
	const folder = vscode.workspace.workspaceFolders?.[0];
	return folder ? vscode.Uri.joinPath(folder.uri, TEMPLATE_FOLDER, PRACTICE_FILE) : undefined;
}

/**
 * 题号之间用空格、逗号、顿号、分号、换行隔开都算（机房里有人从网页上整段复制）。
 * 顺序按写的来，重复的题号只留第一次——大小写不分，因为题面文件本来就是按大小写不敏感找的。
 */
export function parseProblemIds(raw: string): string[] {
	const seen = new Set<string>();
	const ids: string[] = [];
	for (const token of raw.split(/[\s,，、;；]+/)) {
		const id = token.trim();
		if (!id || seen.has(id.toLowerCase())) {
			continue;
		}
		seen.add(id.toLowerCase());
		ids.push(id);
		if (ids.length >= MAX_PRACTICE_PROBLEMS) {
			break;
		}
	}
	return ids;
}

/** 分钟数：空着算「不设时限」，填了就得是范围内的整数。 */
export function parseMinutes(raw: string): number | undefined {
	const text = raw.trim();
	if (!text) {
		return undefined;
	}
	const minutes = Number(text);
	return Number.isInteger(minutes) && minutes >= PRACTICE_MINUTES_MIN && minutes <= PRACTICE_MINUTES_MAX
		? minutes
		: undefined;
}

/** 读清单；文件不存在、不是 JSON、或者条目缺字段，都只丢掉那一条而不是让面板打不开。 */
export async function readLists(): Promise<PracticeList[]> {
	const file = practiceFile();
	if (!file) {
		return [];
	}
	const text = await fs.promises.readFile(file.fsPath, 'utf8').catch(() => '');
	if (!text) {
		return [];
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return [];
	}
	const entriesField = (parsed as { lists?: unknown } | undefined)?.lists;
	const entries = Array.isArray(entriesField) ? entriesField : [];
	const lists: PracticeList[] = [];
	for (const entry of entries) {
		const list = normalizeList(entry);
		if (list) {
			lists.push(list);
		}
	}
	return lists;
}

/** 写整份文件；没地方写（没开工作区）时返回 false，让调用方把话说明白。 */
export async function writeLists(lists: PracticeList[]): Promise<boolean> {
	const file = practiceFile();
	if (!file) {
		return false;
	}
	await fs.promises.mkdir(path.dirname(file.fsPath), { recursive: true });
	await fs.promises.writeFile(file.fsPath, `${JSON.stringify({ lists }, null, 2)}\n`, 'utf8');
	return true;
}

/** 同一份清单的判定：名字的大小写和前后空格都不算差别（删除和顶掉用同一条规则）。 */
export function isSameName(a: string, b: string): boolean {
	return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** 同名清单按后面的那份算：改题目就是重存一次，不会攒出一堆「CSP-J 模拟 3」。 */
export function mergeLists(lists: PracticeList[], next: PracticeList): PracticeList[] {
	const kept = lists.filter(list => !isSameName(list.name, next.name));
	kept.push(next);
	return kept;
}

function normalizeList(entry: unknown): PracticeList | undefined {
	if (!entry || typeof entry !== 'object') {
		return undefined;
	}
	const raw = entry as { name?: unknown; problems?: unknown; minutes?: unknown; createdAt?: unknown };
	const name = typeof raw.name === 'string' ? raw.name.trim() : '';
	if (!name || !Array.isArray(raw.problems)) {
		return undefined;
	}
	const problems = parseProblemIds(raw.problems.filter((id): id is string => typeof id === 'string').join(' '));
	if (!problems.length) {
		return undefined;
	}
	const minutes = typeof raw.minutes === 'number' && Number.isInteger(raw.minutes)
		&& raw.minutes >= PRACTICE_MINUTES_MIN && raw.minutes <= PRACTICE_MINUTES_MAX
		? raw.minutes
		: undefined;
	return { name, problems, minutes, createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '' };
}
