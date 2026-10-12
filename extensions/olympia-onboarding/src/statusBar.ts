/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Olympia IDE - the Olympia chips in the status bar.
 *
 *  Three questions get answered at a glance, in the bar that is always on screen: which judge
 *  am I building for, how do I run this file, and did the pre-flight check find anything. Each
 *  one is also the button for its command, so the palette is never the only way in.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CMD, KEYS } from './commands';
import { activeTarget, renderFlags, targetSummary } from './ojTargets';
import { PRECHECK_SOURCE, SOURCE_FILES } from './precheck';

const PRIORITY_PROFILE = 100;
const PRIORITY_RUN = 90;
const PRIORITY_CHECK = 80;

function isSourceFile(editor: vscode.TextEditor | undefined): boolean {
	return !!editor && SOURCE_FILES.test(editor.document.fileName);
}

/**
 * The last editor that held a C/C++ file. `activeTextEditor` goes undefined whenever focus moves to
 * the palette or any quick input, so following it directly made the two source-only chips blink out
 * the moment the user reached for a command.
 */
let lastSourceEditor: vscode.TextEditor | undefined;

export function registerStatusBar(context: vscode.ExtensionContext): void {
	const profileItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, PRIORITY_PROFILE);
	profileItem.command = CMD.pickCompileProfile;

	const runItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, PRIORITY_RUN);
	runItem.name = 'Olympia';
	runItem.text = `$(play) 编译运行 ${KEYS.compileAndRun}`;
	runItem.tooltip = '按当前评测机参数编译并运行（编译不运行是 Shift+F9）';
	runItem.command = CMD.compileAndRun;

	const checkItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, PRIORITY_CHECK);
	checkItem.name = 'Olympia 体检';
	checkItem.command = CMD.showProblems;

	const render = (): void => {
		const target = activeTarget();
		profileItem.text = `$(goal) ${targetSummary(target)}`;
		profileItem.tooltip = `编译配置：点击切换评测机\n\n${renderFlags(target)}`;
		profileItem.show();

		const active = vscode.window.activeTextEditor;
		if (isSourceFile(active)) {
			lastSourceEditor = active;
		}
		const editor = isSourceFile(active) ? active : lastSourceEditor;
		if (!editor) {
			runItem.hide();
			checkItem.hide();
			return;
		}
		runItem.show();
		const findings = vscode.languages.getDiagnostics(editor.document.uri)
			.filter(diagnostic => diagnostic.source === PRECHECK_SOURCE);
		if (findings.length === 0) {
			checkItem.text = '$(check) 体检通过';
			checkItem.tooltip = '提交前体检：没有会在评测机上编译失败的写法。';
		} else {
			checkItem.text = `$(error) 体检 ${findings.length} 处编译错误`;
			checkItem.tooltip = `提交前体检：${findings.length} 处写法会让评测机的编译器拒绝这份代码。\n\n点击打开「问题」面板。`;
		}
		checkItem.show();
	};

	render();

	context.subscriptions.push(
		profileItem, runItem, checkItem,
		vscode.window.onDidChangeActiveTextEditor(render),
		vscode.workspace.onDidCloseTextDocument(document => {
			if (lastSourceEditor?.document === document) {
				lastSourceEditor = undefined;
				render();
			}
		}),
		vscode.languages.onDidChangeDiagnostics(render),
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('olympia.compiler')) {
				render();
			}
		})
	);
}
