/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  带内存采样的进程运行：老版本跑样例会给 MLE，靠的就是盯着子进程的峰值工作集。
 *
 *  Node 自己读不到别的进程的内存，Windows 上又不该为这个装原生依赖，所以借系统自带的
 *  `tasklist.exe`：由我们（Node）继续直接 spawn 被测程序，另一个定时器按 PID 查一次
 *  「Mem Usage」，取最大值当峰值。
 *
 *  为什么不用 PowerShell 当驱动器：试过，`Start-Process -PassThru` 出来的对象在 PowerShell 5.1
 *  里 `ExitCode` 常常是空的——RE 会因此漏判，那比没有内存数字严重得多。进程必须由我们自己起，
 *  退出码、stdin、超时才都在我们手里。
 *
 *  采样只会**少报**峰值：跑得比采样间隔还短的尖峰测不到，所以不会出现「其实没超却判 MLE」。
 *  判 MLE 还需要限制明确（题面写了内存限制，或设置里填了数字）。
 *--------------------------------------------------------------------------------------------*/
import { execFile, spawn } from 'child_process';

import { compilerEnv } from './toolchain';
import { type RunResult } from './stressTest';

/** tasklist 一次可能要一两百毫秒，所以同一时刻只允许有一个在跑；间隔再密也只是排队。 */
const SAMPLE_INTERVAL_MS = 30;
/** kill 之后等多久自己收尾：被测程序的孙子进程攥着 stdout 时 close 永远不会来。 */
const KILL_GRACE_MS = 500;
const TASKLIST = 'tasklist.exe';
const KB = 1024;

export interface SampledRun extends RunResult {
	/** 峰值工作集（字节）；一次都没采到时是 undefined。 */
	readonly peakBytes?: number;
}

/** `tasklist /FO CSV /NH` 的列序：映像名、PID、会话名、会话号、内存。内存是第 5 列。 */
const MEMORY_COLUMN = 4;

/**
 * 从 `tasklist /FO CSV /NH` 的输出里取内存列。列名会跟着系统语言变，所以按**位置**取，
 * 不认标签；数字里可能夹着千分位（`,` `.` 或空格），统一去掉后按 KB 算。
 */
export function parseMemoryKb(tasklistCsv: string): number | undefined {
	const line = tasklistCsv.split(/\r?\n/).find(l => l.trim().startsWith('"'));
	if (!line) {
		return undefined;    // 找不到这个 PID：进程已经退了
	}
	const columns = [...line.matchAll(/"([^"]*)"/g)].map(m => m[1]);
	const cell = columns[MEMORY_COLUMN];
	const kb = cell?.replace(/[^\d]/g, '');
	if (!kb) {
		return undefined;
	}
	const value = Number(kb);
	return Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * 查一次这个 PID 的工作集。**回调一定会被调用一次**，读不到就是 undefined——
 * 采样链靠这次回调决定下一次什么时候查，少调一次就等于采样停了。
 * 导出只给检查台验证这条契约用。
 */
export function sampleOnce(pid: number, onSample: (bytes: number | undefined) => void): void {
	execFile(TASKLIST, ['/NH', '/FO', 'CSV', '/FI', `PID eq ${pid}`], { windowsHide: true, encoding: 'buffer' }, (error, stdout) => {
		if (error) {
			onSample(undefined);
			return;
		}
		const kb = parseMemoryKb(String(stdout));
		onSample(kb === undefined ? undefined : kb * KB);
	});
}

/**
 * 起一个被测程序，顺便报出它的峰值内存。行为和 runProcess 一致，只是多一个 peakBytes；
 * 采不到（比如程序太快）就只是没有 peakBytes，不影响判定。
 */
export function runSampled(program: string, args: readonly string[], cwd: string, stdin: string, timeoutMs: number): Promise<SampledRun> {
	return new Promise(resolve => {
		let stdout = '';
		let stderr = '';
		let timedOut = false;
		let peakBytes = 0;
		let settled = false;
		let timer: NodeJS.Timeout | undefined;

		const child = spawn(program, [...args], { cwd, env: compilerEnv(), windowsHide: true });
		child.stdout.on('data', chunk => { stdout += String(chunk); });
		child.stderr.on('data', chunk => { stderr += String(chunk); });

		/**
		 * 采样是一条链：每查完一次再约下一次。用 setInterval 的话就得配一个
		 * 「上一次还没回来就跳过」的开关，而那次查询一旦不回调，开关就永远卡在 true，
		 * 之后每次采样都被跳过——峰值内存再也测不出来，表现成 MLE 偶发漏判。
		 */
		const sample = (pid: number): void => {
			sampleOnce(pid, bytes => {
				if (settled) {
					return;
				}
				if (bytes !== undefined && bytes > peakBytes) {
					peakBytes = bytes;
				}
				timer = setTimeout(() => sample(pid), SAMPLE_INTERVAL_MS);
			});
		};
		child.on('spawn', () => {
			const pid = child.pid;
			if (pid === undefined || settled) {
				return;
			}
			// 起进程后立刻查一次：跑样例的程序常常只活几百毫秒，等第一个间隔就全错过了
			sample(pid);
		});

		const stop = (error?: Error) => {
			if (settled) {
				return;    // close 和超时兜底谁先到算谁，resolve 第二次没有意义
			}
			settled = true;
			if (timer) {
				clearTimeout(timer);
				timer = undefined;
			}
			const note = error ? `${stderr}${error.message}\n` : stderr;
			resolve({
				stdout,
				stderr: note,
				timedOut,
				failed: !!error || (!timedOut && child.exitCode !== 0),
				code: child.exitCode,
				peakBytes: peakBytes > 0 ? peakBytes : undefined
			});
		};
		const killTimer = setTimeout(() => {
			timedOut = true;
			child.kill();
			// 被测程序留下攥着 stdout 的孙子进程时 close 不会来（shell 出去调别的程序就是这样）：
			// 给一点收尾时间，到点我们自己结束，别把跑样例整个卡死在那儿
			setTimeout(stop, KILL_GRACE_MS).unref?.();
		}, timeoutMs);
		child.on('error', error => { clearTimeout(killTimer); stop(error); });
		child.on('close', () => { clearTimeout(killTimer); stop(); });
		// 程序读完就退出时写 stdin 会 EPIPE，那不是我们的错误
		child.stdin.on('error', () => { /* ignore */ });
		child.stdin.end(stdin);
	});
}

export function formatMb(bytes: number): string {
	const mb = bytes / (1024 * 1024);
	return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}
