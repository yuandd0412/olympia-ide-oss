/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Olympia IDE - the command ids the persistent bars invoke.
 *
 *  The bars, the tree and the palette all point at the same commands, and the ids used to be
 *  string literals spread over three files. One table keeps a renamed or removed command from
 *  leaving a button behind that silently does nothing.
 *
 *  The titles and key bindings still live in package.json, which cannot read this file; they are
 *  listed here as the mirror the UI code has to work from.
 *--------------------------------------------------------------------------------------------*/

export const CMD = {
	compileAndRun: 'olympia.compileAndRun',
	compile: 'olympia.compile',
	compileJudgeAccurate: 'olympia.compileJudgeAccurate',
	preSubmitCheck: 'olympia.preSubmitCheck',
	judgeSamples: 'olympia.judgeSamples',
	stressTest: 'olympia.stressTest',
	contestMode: 'olympia.contestMode',
	/** 比赛模式的状态查询口：AI 教练在别的扩展里，只能靠命令问回来。 */
	contestIsRunning: 'olympia.contest.isRunning',
	checkEnvironment: 'olympia.checkEnvironment',
	pickCompileProfile: 'olympia.pickCompileProfile',
	openWebsite: 'olympia.openWebsite',
	problemPull: 'olympia.problem.pull',
	problemPullFromClipboard: 'olympia.problem.pullFromClipboard',
	/** 题面库：由 olympia-contest 注册，面板和这里只是点它一下。 */
	problemOpenStatement: 'olympia.problem.openStatement',
	/** 对拍抓到的那组数据写回题面；同样由 olympia-contest 实现，参数是输入与期望输出。 */
	appendSample: 'olympia.problem.appendSample',
	templateInsert: 'olympia.template.insert',
	aiSettings: 'olympia.ai.settings',
	showProblems: 'workbench.actions.view.problems'
} as const;

/** Key bindings contributed in package.json, shown as the hint next to each button. */
export const KEYS = {
	compileAndRun: 'F9',
	compile: 'Shift+F9',
	compileJudgeAccurate: 'Ctrl+Shift+F9',
	preSubmitCheck: 'Ctrl+Alt+Enter',
	judgeSamples: 'Ctrl+Alt+J',
	stressTest: 'Ctrl+Alt+S',
	contestMode: 'Ctrl+Alt+C',
	checkEnvironment: 'Ctrl+Alt+D',
	problemPull: 'Ctrl+Alt+P',
	problemPullFromClipboard: 'Ctrl+Alt+V',
	openStatement: 'Ctrl+Alt+O',
	templateInsert: 'Ctrl+Alt+T'
} as const;
