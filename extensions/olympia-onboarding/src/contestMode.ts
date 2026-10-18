/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  比赛模式：给一段倒计时，让本地练习和真实比赛的节奏一致。
 *
 *  状态栏常驻一枚计时 chip，剩余时间同时反映到 Olympia 面板的「当前环境」里。
 *  结束时间记在 workspaceState，窗口重载或误关之后还能接着走，不至于把一场比赛作废。
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';

import { CMD } from './commands';

const ENDS_AT_KEY = 'olympia.contest.endsAt';
/** 常见赛制时长（分钟），自定义走输入框。 */
const DURATIONS: readonly number[] = [60, 90, 120, 180, 240, 300, 360];
/** CSP / NOIP 那一档：既要在选择列表里标出来，也是自定义输入框的预填值。 */
const DEFAULT_CONTEST_MINUTES = 120;
const CONTEST_MINUTES_MIN = 1;
const CONTEST_MINUTES_MAX = 600;
/** 倒计时、状态栏、面板行的刷新间隔。 */
const TICK_INTERVAL_MS = 1000;
/** 倒计时要比编译器、运行、体检三个 chip 更靠左，所以优先级最高。 */
const STATUS_PRIORITY = 110;
/** 比赛进行中要把 AI 教练关掉（和老版本一致）；界面侧的 when 子句读这个键。 */
const CONTEST_RUNNING_CONTEXT = 'olympia.contest.running';

let statusItem: vscode.StatusBarItem | undefined;
let ticker: NodeJS.Timeout | undefined;
let endsAt: number | undefined;
let onChange: (() => void) | undefined;
let publishedRunning: boolean | undefined;
let endAnnounced = false;

function remainingMs(): number | undefined {
	return endsAt === undefined ? undefined : endsAt - Date.now();
}

function format(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const pad = (n: number): string => n.toString().padStart(2, '0');
	return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** 面板「当前环境」用的一句话；没在比赛时返回 undefined。 */
export function contestSummary(): string | undefined {
	const left = remainingMs();
	if (left === undefined) {
		return undefined;
	}
	return left <= 0 ? '比赛时间到' : `比赛剩余 ${format(left)}`;
}

/** 让面板在时间跳动时刷新，避免自己起第二个定时器。 */
export function onContestChange(listener: () => void): void {
	onChange = listener;
}

export function isContestRunning(): boolean {
	const left = remainingMs();
	return left !== undefined && left > 0;
}

/** 上下文键只在真的翻转时写一次，不让每秒的 tick 都敲一遍 setContext。 */
function publishRunning(): void {
	const running = isContestRunning();
	if (publishedRunning === running) {
		return;
	}
	publishedRunning = running;
	void vscode.commands.executeCommand('setContext', CONTEST_RUNNING_CONTEXT, running);
}

function render(context: vscode.ExtensionContext): void {
	publishRunning();
	if (!statusItem) {
		return;
	}
	const left = remainingMs();
	if (left === undefined) {
		statusItem.hide();
		return;
	}
	if (left <= 0) {
		statusItem.text = '$(clock) 时间到';
		statusItem.tooltip = '比赛时间到。点这里结束比赛模式。';
		statusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
		announceEnd(context);
		// 到点之后不用再数了：以前 ticker 一直跑到下次重载，每秒把整棵工具面板刷新一遍
		// （render → onChange → tree.fire），而界面上只是一枚不动的橙色 chip。
		// chip 要留着让学生点，所以这里只停表，不调 stop()。
		if (ticker) {
			clearInterval(ticker);
			ticker = undefined;
		}
	} else {
		statusItem.text = `$(clock) ${format(left)}`;
		statusItem.tooltip = `比赛剩余 ${format(left)}，结束于 ${new Date(endsAt as number).toLocaleTimeString()}。点这里结束比赛模式。`;
		statusItem.backgroundColor = undefined;
	}
	statusItem.show();
	onChange?.();
}

/**
 * 时间到提醒一次就够。放在 render 里是为了让两条路径都走到：新开比赛走的
 * 是 start 的 tick，重载后接着走的是 registerContestMode 恢复时的 tick——
 * 后者以前没人提醒，窗口一重开比赛就无声无息地结束了。
 */
function announceEnd(context: vscode.ExtensionContext): void {
	if (endAnnounced) {
		return;
	}
	endAnnounced = true;
	void vscode.window.showWarningMessage('比赛时间到。', '结束比赛模式').then(action => {
		if (action) {
			stop(context, false);
		}
	});
}

function stop(context: vscode.ExtensionContext, notify: boolean): void {
	if (ticker) {
		clearInterval(ticker);
		ticker = undefined;
	}
	const left = remainingMs();
	endsAt = undefined;
	endAnnounced = false;
	publishRunning();
	if (statusItem) {
		statusItem.hide();
	}
	void context.workspaceState.update(ENDS_AT_KEY, undefined);
	onChange?.();
	if (notify && left !== undefined && left > 0) {
		void vscode.window.showInformationMessage(`已退出比赛模式，剩余 ${format(left)} 作废。`);
	}
}

function start(context: vscode.ExtensionContext, minutes: number): void {
	endsAt = Date.now() + minutes * 60 * 1000;
	endAnnounced = false;
	void context.workspaceState.update(ENDS_AT_KEY, endsAt);
	if (ticker) {
		clearInterval(ticker);
	}
	ticker = setInterval(() => render(context), TICK_INTERVAL_MS);
	render(context);
	void vscode.window.showInformationMessage(`比赛模式开始：${minutes} 分钟，结束于 ${new Date(endsAt).toLocaleTimeString()}。`);
}

/** 输入框的提示和最终采纳走同一条规则，免得两处判定各说各话。 */
function minutesInRange(raw: string): number | undefined {
	const minutes = Number(raw.trim());
	return Number.isInteger(minutes) && minutes >= CONTEST_MINUTES_MIN && minutes <= CONTEST_MINUTES_MAX
		? minutes
		: undefined;
}

/** 集训清单带着分钟数来开场：合法就直接开场；不合法照旧问，别让一个错值静默变成 0 分钟的比赛。 */
function requestedMinutes(raw: unknown): number | undefined {
	return typeof raw === 'number' && Number.isInteger(raw) && raw >= CONTEST_MINUTES_MIN && raw <= CONTEST_MINUTES_MAX
		? raw
		: undefined;
}

async function askDuration(): Promise<number | undefined> {
	const picked = await vscode.window.showQuickPick(
		[
			...DURATIONS.map(minutes => ({ label: `${minutes} 分钟`, description: minutes === DEFAULT_CONTEST_MINUTES ? 'CSP / NOIP 常见时长' : undefined, minutes })),
			{ label: '自定义…', description: '输入分钟数', minutes: 0 }
		],
		{ title: '比赛时长', ignoreFocusOut: true }
	);
	if (!picked) {
		return undefined;
	}
	if (picked.minutes > 0) {
		return picked.minutes;
	}
	const raw = await vscode.window.showInputBox({
		prompt: '比赛时长（分钟）',
		value: String(DEFAULT_CONTEST_MINUTES),
		ignoreFocusOut: true,
		validateInput: v => minutesInRange(v) === undefined
			? `请输入 ${CONTEST_MINUTES_MIN} 到 ${CONTEST_MINUTES_MAX} 之间的整数分钟数`
			: undefined
	});
	return minutesInRange(raw ?? '');
}

/**
 * 停用（禁用再启用、重载）时把模块状态收干净。留着 endsAt 的话，下次激活时
 * `isContestRunning()` 还是 true，chip 却已经不在了——AI 教练会一直显示「比赛进行中」。
 */
function release(): void {
	if (ticker) {
		clearInterval(ticker);
		ticker = undefined;
	}
	endsAt = undefined;
	endAnnounced = false;
	publishRunning();
	statusItem = undefined;
	onChange = undefined;
}

export function registerContestMode(context: vscode.ExtensionContext): vscode.Disposable {
	statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, STATUS_PRIORITY);
	statusItem.command = CMD.contestMode;

	const stored = context.workspaceState.get<number>(ENDS_AT_KEY);
	if (typeof stored === 'number') {
		if (stored > Date.now()) {
			endsAt = stored;
			endAnnounced = false;
			render(context);
			ticker = setInterval(() => render(context), TICK_INTERVAL_MS);
		} else {
			// 窗口关掉的这段时间里比赛已经结束了：把键清掉，别让下次重载再判一遍。
			void context.workspaceState.update(ENDS_AT_KEY, undefined);
		}
	}

	const command = vscode.commands.registerCommand(CMD.contestMode, async (minutes?: unknown) => {
		const requested = requestedMinutes(minutes);
		if (endsAt !== undefined) {
			const left = remainingMs() as number;
			if (left > 0) {
				const action = await vscode.window.showWarningMessage(
					`比赛还在进行（剩余 ${format(left)}）。要结束比赛模式吗？`, '结束比赛模式');
				if (action) {
					stop(context, false);
					// 收尾之后又带着新的时长来（清单上点了「开始这一场」）：那就开新的一场。
					if (requested !== undefined) {
						start(context, requested);
					}
				}
				return;
			}
			stop(context, false);
			// 上一场已经时间到、还没人收尾：这一按就是要开新的一场上，不能只把旧的清掉就返回。
			// 以前 requested 为空时直接 return，实测第一次 Ctrl+Alt+C 什么也不发生（chip 消失、
			// 也不问时长），得再按一次才出时长框——学生只会认为快捷键坏了。
			// 收尾之后往下走就行：带着时长来的（清单上点「开始这一场」）由下面第一个分支开新场，
			// 空手来的落到时长询问，跟「没有在进行中的比赛」完全同一条路。
		}
		if (requested !== undefined) {
			start(context, requested);
			return;
		}
		const asked = await askDuration();
		if (asked) {
			start(context, asked);
		}
	});

	const isRunning = vscode.commands.registerCommand(CMD.contestIsRunning, () => isContestRunning());

	return vscode.Disposable.from(statusItem, command, isRunning, { dispose: release });
}
