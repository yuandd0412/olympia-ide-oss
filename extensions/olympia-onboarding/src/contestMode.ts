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
const ENDED_AT_KEY = 'olympia.contest.endedAt';
/** 常见赛制时长（分钟），自定义走输入框。 */
const DURATIONS: readonly number[] = [60, 90, 120, 180, 240, 300, 360];
/** CSP / NOIP 那一档：既要在选择列表里标出来，也是自定义输入框的预填值。 */
const DEFAULT_CONTEST_MINUTES = 120;
const CONTEST_MINUTES_MIN = 1;
const CONTEST_MINUTES_MAX = 600;
/** 倒计时要比编译器、运行、体检三个 chip 更靠左，所以优先级最高。 */
const STATUS_PRIORITY = 110;

let statusItem: vscode.StatusBarItem | undefined;
let ticker: NodeJS.Timeout | undefined;
let endsAt: number | undefined;
let onChange: (() => void) | undefined;

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

function render(): void {
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
	} else {
		statusItem.text = `$(clock) ${format(left)}`;
		statusItem.tooltip = `比赛剩余 ${format(left)}，结束于 ${new Date(endsAt as number).toLocaleTimeString()}。点这里结束比赛模式。`;
		statusItem.backgroundColor = undefined;
	}
	statusItem.show();
	onChange?.();
}

function stop(context: vscode.ExtensionContext, notify: boolean): void {
	if (ticker) {
		clearInterval(ticker);
		ticker = undefined;
	}
	const left = remainingMs();
	endsAt = undefined;
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
	void context.workspaceState.update(ENDS_AT_KEY, endsAt);
	void context.workspaceState.update(ENDED_AT_KEY, undefined);
	if (ticker) {
		clearInterval(ticker);
	}
	let announced = false;
	ticker = setInterval(() => {
		const left = remainingMs();
		if (left !== undefined && left <= 0 && !announced) {
			announced = true;
			void vscode.window.showWarningMessage('比赛时间到。', '结束比赛模式').then(action => {
				if (action) {
					stop(context, false);
				}
			});
			void context.workspaceState.update(ENDED_AT_KEY, Date.now());
		}
		render();
	}, 1000);
	render();
	void vscode.window.showInformationMessage(`比赛模式开始：${minutes} 分钟，结束于 ${new Date(endsAt).toLocaleTimeString()}。`);
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
		validateInput: v => {
			const n = Number(v.trim());
			return n >= CONTEST_MINUTES_MIN && n <= CONTEST_MINUTES_MAX
				? undefined
				: `请输入 ${CONTEST_MINUTES_MIN} 到 ${CONTEST_MINUTES_MAX} 之间的分钟数`;
		}
	});
	const minutes = Number((raw ?? '').trim());
	return Number.isFinite(minutes) && minutes >= 1 ? minutes : undefined;
}

export function registerContestMode(context: vscode.ExtensionContext): vscode.Disposable {
	statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, STATUS_PRIORITY);
	statusItem.command = CMD.contestMode;

	const stored = context.workspaceState.get<number>(ENDS_AT_KEY);
	if (typeof stored === 'number' && stored > Date.now()) {
		endsAt = stored;
		render();
		ticker = setInterval(render, 1000);
	}

	const command = vscode.commands.registerCommand(CMD.contestMode, async () => {
		if (endsAt !== undefined) {
			const left = remainingMs() as number;
			if (left > 0) {
				const action = await vscode.window.showWarningMessage(
					`比赛还在进行（剩余 ${format(left)}）。要结束比赛模式吗？`, '结束比赛模式');
				if (action) {
					stop(context, false);
				}
				return;
			}
			stop(context, false);
			return;
		}
		const minutes = await askDuration();
		if (minutes) {
			start(context, minutes);
		}
	});

	return vscode.Disposable.from(statusItem, command, { dispose: () => { if (ticker) { clearInterval(ticker); } } });
}
