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
 * 题号之间用空格、逗号、顿号、分号、句号、换行隔开都算（机房里有人从网页上整段复制）。
 * 「1. P1001 2. P1002」这种带编号的题单也按复制的来：编号那几个 token 丢掉。
 * 顺序按写的来，重复的题号只留第一次——大小写不分，因为题面文件本来就是按大小写不敏感找的。
 */
export function parseProblemIds(raw: string): string[] {
	const seen = new Set<string>();
	const ids: string[] = [];
	for (const token of raw.split(/[\s,，、;；。．)）】]+/)) {
		if (/^\d+[.)、]$/.test(token)) {
			continue;   // 「1.」「2)」这种题单编号
		}
		const id = normalizeProblemId(token);
		if (!isSafeProblemId(id) || seen.has(id.toLowerCase())) {
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

/** 一道题的编号不该被当文件名用：带斜杠、点点、或结尾带句点的都拒掉。 */
export function isSafeProblemId(id: string): boolean {
	return id.length > 0 && id !== '.' && id !== '..' && !/[\\/:*?"<>|]/.test(id) && !id.endsWith('.');
}

/**
 * Codeforces 的题号在网页和「拉取题面」的提示里写成 `1660/C` 或 `1660-C`，而题面文件叫 `1660C.md`。
 * 不收口的话同一道题在清单里就是第三个名字：勾打不上，点一次白拉一遍网络。
 * AtCoder 的 `ABC123_A` 以字母开头，不在这条规则里，不会被拆开。
 */
export function normalizeProblemId(id: string): string {
	const trimmed = id.trim();
	const cf = /^(\d{3,6})[/\-_]([A-Za-z]{1,2})$/.exec(trimmed);
	if (cf) {
		return `${cf[1]}${cf[2].toUpperCase()}`;
	}
	return /^[0-9]/.test(trimmed) ? trimmed.toUpperCase() : trimmed;
}

/** 分钟数：空着算「不设时限」，填了就得是范围内的十进制整数（0x78、1e2 这种不收）。 */
export function parseMinutes(raw: string): number | undefined {
	const text = raw.trim();
	if (!text || !/^\d+$/.test(text)) {
		return undefined;
	}
	const minutes = Number(text);
	return Number.isInteger(minutes) && minutes >= PRACTICE_MINUTES_MIN && minutes <= PRACTICE_MINUTES_MAX
		? minutes
		: undefined;
}

/**
 * 文件里认得的和认不得的分开带回来。
 * 认不得的条目要原样写回去：这一版读不懂就顺手重写整个文件，等于把别人（或以后自己）
 * 攒的清单删掉——那是点了「移掉一道题」之后最不该发生的副作用。
 */
export interface PracticeFile {
	readonly lists: PracticeList[];
	/** 这一版认不出结构的条目，写回时原样附上。 */
	readonly unknown: unknown[];
	/** 文件在、有内容，但一条都没读出来（不是 JSON、是别的形状）：这时候不许重写整个文件。 */
	readonly unreadable: boolean;
}

export async function readPractice(): Promise<PracticeFile> {
	const empty: PracticeFile = { lists: [], unknown: [], unreadable: false };
	const file = practiceFile();
	if (!file) {
		return empty;
	}
	const raw = await fs.promises.readFile(file.fsPath).catch(() => undefined);
	if (raw === undefined || raw.length === 0) {
		return empty;
	}
	// Windows 上「UTF-8 带 BOM」存的文件很常见（PowerShell 重定向、别人手存），BOM 会让 JSON.parse 直接失败。
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, ''));
	} catch {
		return { ...empty, unreadable: true };
	}
	const entries = Array.isArray(parsed)
		? parsed
		: Array.isArray((parsed as { lists?: unknown } | undefined)?.lists)
			? (parsed as { lists: unknown[] }).lists
			: undefined;
	if (!entries) {
		return { ...empty, unreadable: true };
	}
	const lists: PracticeList[] = [];
	const unknown: unknown[] = [];
	for (const entry of entries) {
		const list = normalizeList(entry);
		if (list) {
			lists.push(list);
		} else {
			unknown.push(entry);
		}
	}
	return { lists, unknown, unreadable: false };
}

/** 只要认得的那部分：列清单给用户看的时候用这个。 */
export async function readLists(): Promise<PracticeList[]> {
	return (await readPractice()).lists;
}

/**
 * 写整份文件；返回 undefined 表示写成了，否则是人话版的失败原因（没工作区 / 存不下去）。
 * 先写临时文件再改名：直接 writeFile 会先清空原文件，另一个窗口正好在那一刻读就拿到半截 JSON，
 * 于是走 unreadable 那条路——一个 10 ms 的巧合就成了永久丢失。
 */
export async function writeLists(lists: PracticeList[], keep: readonly unknown[] = []): Promise<string | undefined> {
	const file = practiceFile();
	if (!file) {
		return '没有打开的工作区文件夹';
	}
	const tmp = `${file.fsPath}.${process.pid}.tmp`;
	try {
		await fs.promises.mkdir(path.dirname(file.fsPath), { recursive: true });
		const body = JSON.stringify({ lists: [...lists, ...keep] }, null, 2);
		await fs.promises.writeFile(tmp, `${body}\n`, 'utf8');
		await fs.promises.rename(tmp, file.fsPath);
		return undefined;
	} catch (error) {
		await fs.promises.rm(tmp, { force: true }).catch(() => undefined);
		return error instanceof Error ? error.message : String(error);
	}
}

/** 加题：已有的题号（大小写不分）不重复加，超过上限的丢掉而不是整次取消。 */
export function withExtraProblems(list: PracticeList, extra: readonly string[]): PracticeList {
	const seen = new Set(list.problems.map(id => id.trim().toLowerCase()));
	const problems = [...list.problems];
	for (const id of extra) {
		const key = id.trim().toLowerCase();
		if (!key || seen.has(key) || problems.length >= MAX_PRACTICE_PROBLEMS) {
			continue;
		}
		seen.add(key);
		problems.push(id.trim());
	}
	return { ...list, problems };
}

/** 移题：只按题号认（清单里显示的就是题号，不再造一套 id）。 */
export function withoutProblem(list: PracticeList, id: string): PracticeList {
	const key = id.trim().toLowerCase();
	return { ...list, problems: list.problems.filter(item => item.trim().toLowerCase() !== key) };
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

/**
 * 认得出的一条清单。这一版看不懂的字段原样留着（下次写回还在），
 * 时长也照文件里的值带回来——超出 5–600 的开场时会被比赛模式挡下来重新问，
 * 但不能因为这边觉得它不合理就把学生写的那个数字抹掉。
 */
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
	return Object.assign({}, entry, {
		name,
		problems,
		minutes: typeof raw.minutes === 'number' ? raw.minutes : undefined,
		createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : ''
	});
}
