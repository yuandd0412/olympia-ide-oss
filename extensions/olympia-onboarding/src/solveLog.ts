/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Olympia IDE - 解题记录与连续打卡.
 *
 *  跑样例判成 AC 之后写一条记录，存在工程里（`.olympia/solves.json`），跟题面一样跟着文件夹走：
 *  换台机器、重装编辑器，打卡还在。老版本就是这么记的，学生要的不是一个统计图，是「我今天有没有
 *  在推进」这一口气。
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import path from 'path';
import { CMD } from './commands';
import { OLYMPIA_FOLDER, problemsDir, STATEMENT_EXTENSION } from './problemFiles';
import { formatMb as formatPeak } from './memoryProbe';

export interface SolveRecord {
	/** 题号：题面文件名（去掉 .md），和缓存目录里的名字一致。 */
	readonly problem: string;
	readonly title: string;
	readonly at: string;
	/** 最慢那组的耗时。 */
	readonly ms: number;
	readonly peakBytes?: number;
}

const SOLVES_FILE = 'solves.json';
/** 文案里要说这条路径的时候都用它，不要另抄一遍：改的是写文件那一边，说的也得跟着改。 */
export const SOLVES_PATH_LABEL = `${OLYMPIA_FOLDER}/${SOLVES_FILE}`;
/** 只留最近这么多条：再多的文件读起来慢，也没有人翻三百天以前。 */
const MAX_RECORDS = 200;
const RECORD_SETTING = 'train.recordSolves';
const GOAL_SETTING = 'train.dailyGoal';
const EMPTY_VALUE = '还没 AC 过题';

/** 题面第一行的标题（`# P1001 A+B Problem`），记下来才知道这条记录长什么样。 */
export function titleOf(markdown: string): string {
	return /^\s*#\s+(.+?)\s*$/m.exec(markdown)?.[1].trim() ?? '';
}

function solvesPath(): vscode.Uri | undefined {
	const folder = vscode.workspace.workspaceFolders?.[0];
	return folder ? vscode.Uri.joinPath(folder.uri, OLYMPIA_FOLDER, SOLVES_FILE) : undefined;
}

function dayKey(at: string | number | Date): string {
	const d = new Date(at);
	const month = `${d.getMonth() + 1}`.padStart(2, '0');
	const day = `${d.getDate()}`.padStart(2, '0');
	return `${d.getFullYear()}-${month}-${day}`;
}

/** 读记录：没这个文件是常态（新工程），坏了也不能把面板带崩。 */
export async function readSolves(): Promise<SolveRecord[]> {
	const file = solvesPath();
	if (!file) {
		return [];
	}
	let raw: Buffer;
	try {
		raw = await fs.readFile(file.fsPath);
	} catch {
		return [];
	}
	try {
		const parsed: unknown = JSON.parse(raw.toString('utf8'));
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter((item): item is SolveRecord => {
			const record = item as Partial<SolveRecord>;
			return typeof record.problem === 'string' && typeof record.at === 'string';
		}).slice(0, MAX_RECORDS);
	} catch {
		return [];
	}
}

/** 写进文件之后告诉面板：那一行的数字要跟着变。 */
const changed = new vscode.EventEmitter<void>();
export const onSolveLogChange: vscode.Event<void> = changed.event;

/** 写一条 AC 记录（最新在前）。设置关掉就什么都不写。 */
export async function recordSolve(record: SolveRecord): Promise<SolveRecord[] | undefined> {
	if (!vscode.workspace.getConfiguration('olympia').get<boolean>(RECORD_SETTING, true)) {
		return undefined;
	}
	const file = solvesPath();
	if (!file) {
		return undefined;
	}
	const next = [record, ...await readSolves()].slice(0, MAX_RECORDS);
	await fs.mkdir(path.dirname(file.fsPath), { recursive: true });
	await fs.writeFile(file.fsPath, JSON.stringify(next, undefined, '\t'), 'utf8');
	changed.fire();
	return next;
}

/**
 * 连续打卡天数：从今天往回数（今天还没 AC 也不算断，昨天连着就算）。
 * 只按「天」算，同一天刷十题也只是一天——这是打卡，不是题数。
 */
export function streakDays(records: readonly SolveRecord[], now = new Date()): number {
	const days = new Set(records.map(r => dayKey(r.at)));
	if (days.size === 0) {
		return 0;
	}
	const cursor = new Date(now.getTime());
	if (!days.has(dayKey(cursor))) {
		cursor.setDate(cursor.getDate() - 1);
		if (!days.has(dayKey(cursor))) {
			return 0;
		}
	}
	let streak = 0;
	while (days.has(dayKey(cursor))) {
		streak++;
		cursor.setDate(cursor.getDate() - 1);
	}
	return streak;
}

export function solvesToday(records: readonly SolveRecord[], now = new Date()): number {
	const today = dayKey(now);
	return records.filter(r => dayKey(r.at) === today).length;
}

export function dailyGoal(): number {
	const raw = vscode.workspace.getConfiguration('olympia').get<number>(GOAL_SETTING, 3);
	return Number.isFinite(raw) && (raw as number) > 0 ? Math.floor(raw as number) : 3;
}

/** 面板那一行的值。 */
export function solveSummary(records: readonly SolveRecord[]): string {
	if (!records.length) {
		return EMPTY_VALUE;
	}
	const streak = streakDays(records);
	return `${records.length} 题 · 连续 ${streak} 天 · 今日 ${solvesToday(records)}/${dailyGoal()}`;
}

function formatWhen(at: string): string {
	const d = new Date(at);
	return Number.isNaN(d.getTime()) ? at : `${d.getMonth() + 1}月${d.getDate()}日 ${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`;
}

/** 内存的写法跟跑样例那边共用一个函数：同一个字节数不该一处显示 120.4 MB、另一处显示 120 MB。 */
function formatMb(bytes: number | undefined): string {
	return bytes === undefined ? '' : ` · 峰值 ${formatPeak(bytes)}`;
}

/**
 * 这道题缓存的题面。目录要用 `problem.problemsDir` 那一项配置算，
 * 不能写死 `.olympia/problems`：改过目录的人点了「打开」却打不开自己的题面，比不打开还糟。
 */
async function statementFileFor(problem: string): Promise<vscode.Uri | undefined> {
	const dir = problemsDir();
	if (!dir) {
		return undefined;
	}
	const candidate = vscode.Uri.joinPath(dir, `${problem}${STATEMENT_EXTENSION}`);
	try {
		await fs.stat(candidate.fsPath);
	} catch {
		return undefined;
	}
	return candidate;
}

export function registerSolveLog(context: vscode.ExtensionContext): vscode.Disposable {
	const command = vscode.commands.registerCommand(CMD.solveLog, async () => {
		const records = await readSolves();
		if (!records.length) {
			await vscode.window.showInformationMessage(
				`还没有解题记录。跑样例（Ctrl+Alt+J）判成 AC 的时候会自动记一条，记录存在工程的 ${SOLVES_PATH_LABEL} 里。`
			);
			return;
		}
		const picked = await vscode.window.showQuickPick(
			records.map(r => ({
				label: r.problem,
				description: `${r.ms} ms${formatMb(r.peakBytes)}`,
				detail: `${r.title || '（没有标题）'} · ${formatWhen(r.at)}`,
				record: r
			})),
			{
				title: `解题记录 · ${solveSummary(records)}`,
				placeHolder: '按题号或标题搜；选中会在右边列出这组数据是从哪份题面来的',
				ignoreFocusOut: true,
				matchOnDescription: true,
				matchOnDetail: true
			}
		);
		if (picked) {
			const statement = await statementFileFor(picked.record.problem);
			if (statement) {
				await vscode.window.showTextDocument(statement, { preview: true });
			} else {
				await vscode.window.showInformationMessage(`缓存里没有 ${picked.record.problem} 的题面了，重新拉一次（Ctrl+Alt+P）就有。`);
			}
		}
	});
	context.subscriptions.push(command);
	return command;
}
