/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Olympia 竞赛助手 — 题面拉取、赛制模板、已缓存题面浏览。
 *
 *  Design notes:
 *   * Everything is a normal built-in extension; no activation cost beyond a few ms.
 *   * The pulled statement is written as Markdown under <workspace>/.olympia/problems so it
 *     can be committed alongside the solution, or opened with the built-in Markdown preview.
 *   * All user-visible strings are already Chinese; this extension never falls back to English.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { detectPlatform, fetchProblem, type Platform, type Problem } from './sources';
import { renderStatement, templateFor, FORMAT_LABEL, PLATFORM_TEXT, platformText, type ContestFormat } from './templates';
import { readLibrary, showStatement, toPicks } from './problemLibrary';
import { appendSample as appendSampleTo, pickTarget } from './statementSamples';
import { registerCppSnippets } from './snippets';

function cfg() {
	const c = vscode.workspace.getConfiguration('olympia.problem');
	return {
		problemsDir: c.get<string>('problemsDir', '.olympia/problems'),
		templateOnPull: c.get<boolean>('templateOnPull', false),
		timeoutMs: c.get<number>('requestTimeoutMs', 15000),
		cfMetadata: c.get<boolean>('cfMetadata', false),
	};
}

async function problemsRoot(): Promise<string | undefined> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		vscode.window.showWarningMessage('请先打开一个工作区文件夹，再拉取题面。');
		return undefined;
	}
	const root = path.join(folder.uri.fsPath, cfg().problemsDir);
	await fs.promises.mkdir(root, { recursive: true });
	return root;
}

async function askProblemRef(initial?: string): Promise<{ id: string; platform: Platform } | undefined> {
	const id = await vscode.window.showInputBox({
		title: '拉取题面',
		prompt: '输入题号，例如 P1001（洛谷）、1660C（Codeforces）、ABC123_A（AtCoder）',
		placeHolder: 'P1001',
		value: initial,
		ignoreFocusOut: true,
		validateInput: v => (v.trim() ? undefined : '请输入题号'),
	});
	if (!id) { return undefined; }

	let platform = detectPlatform(id);
	if (!platform) {
		const picked = await vscode.window.showQuickPick(
			(Object.keys(PLATFORM_TEXT) as Platform[]).map(p => ({ label: platformText(p), p })),
			{ title: '无法从题号判断来源，请选择平台', ignoreFocusOut: true },
		);
		if (!picked) { return undefined; }
		platform = picked.p;
	}
	return { id: id.trim(), platform };
}

async function writeProblem(p: Problem): Promise<vscode.Uri | undefined> {
	const root = await problemsRoot();
	if (!root) { return undefined; }
	const file = path.join(root, `${p.id}.md`);
	await fs.promises.writeFile(file, renderStatement(p), 'utf8');
	return vscode.Uri.file(file);
}

async function pullProblem(ref: { id: string; platform: Platform }): Promise<void> {
	const { timeoutMs, templateOnPull, cfMetadata } = cfg();
	await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: `正在从 ${platformText(ref.platform)} 拉取题面 ${ref.id}…`, cancellable: false },
		async () => {
			try {
				const problem = await fetchProblem(ref.id, ref.platform, timeoutMs, cfMetadata);
				const uri = await writeProblem(problem);
				if (!uri) { return; }

				if (templateOnPull) {
					const seed = path.join(path.dirname(uri.fsPath), `${problem.id}.cpp`);
					if (!fs.existsSync(seed)) {
						await fs.promises.writeFile(seed, templateFor('acm'), 'utf8');
					}
				}

				const doc = await vscode.workspace.openTextDocument(uri);
				await vscode.window.showTextDocument(doc, { preview: false });

				if (problem.metadataOnly) {
					const open = await vscode.window.showInformationMessage(
						`${platformText(ref.platform)} 的题面网页有人机校验，已写入题目信息。是否在浏览器中打开原题？`,
						'在浏览器中打开',
					);
					if (open) { await vscode.env.openExternal(vscode.Uri.parse(problem.url)); }
				} else {
					vscode.window.showInformationMessage(
						`已拉取 ${problem.id} ${problem.title || ''}（${problem.samples.length} 组样例）`.trim(),
					);
				}
			} catch (err: any) {
				vscode.window.showErrorMessage(`拉取题面失败：${err?.message ?? err}`);
			}
		},
	);
}

async function openCached(): Promise<void> {
	const root = await problemsRoot();
	if (!root) { return; }
	const entries = await readLibrary(root);
	if (!entries.length) {
		vscode.window.showInformationMessage('还没有缓存的题面，先用「拉取题面」（Ctrl+Alt+P）抓一道吧。');
		return;
	}
	const picks = toPicks(entries, vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
	const picked = await vscode.window.showQuickPick(picks, {
		title: `题面库（缓存了 ${entries.length} 道题）`,
		placeHolder: '按题号或标题搜，例如 P1001、并查集',
		matchOnDescription: true,
		matchOnDetail: true,
		ignoreFocusOut: true,
	});
	if (!picked) { return; }
	await showStatement(vscode.Uri.file(picked.entry.file));
}

/** 对拍抓到不一致时传过来的参数；命令故意不进命令面板，因为没有这组数据它什么都做不了。 */
interface AppendSampleArgs {
	readonly hint?: string;
	readonly input?: string;
	readonly output?: string;
	readonly explain?: string;
}

/**
 * 把一组数据永久留在题面里，之后每次跑样例都会带上它。
 * 对拍停下来的那一刻是记这组数据的最好时机——再跑一轮可能就复现不出来了。
 */
async function appendSample(args?: AppendSampleArgs): Promise<boolean> {
	if (args?.input === undefined || args?.output === undefined) {
		vscode.window.showWarningMessage('补充样例需要一组输入和期望输出：这条命令是给对拍点的，手动加样例请直接在题面 Markdown 里写。');
		return false;
	}
	const root = await problemsRoot();
	if (!root) { return false; }
	const entries = await readLibrary(root);
	if (!entries.length) {
		vscode.window.showInformationMessage('题面库里还没有题面，样例没地方写。先按 Ctrl+Alt+P 拉一道题的题面。');
		return false;
	}
	const target = await pickTarget(entries, args.hint, async list => {
		const picked = await vscode.window.showQuickPick(toPicks(list, vscode.workspace.workspaceFolders?.[0]?.uri.fsPath), {
			title: '这组样例补进哪道题',
			placeHolder: `当前文件没有同名题面，从题面库里挑一道（缓存了 ${list.length} 道）`,
			matchOnDescription: true,
			matchOnDetail: true,
			ignoreFocusOut: true,
		});
		return picked?.entry;
	});
	if (!target) { return false; }

	const markdown = await fs.promises.readFile(target.file, 'utf8');
	const added = appendSampleTo(markdown, { input: args.input, output: args.output, explain: args.explain });
	await fs.promises.writeFile(target.file, added.markdown, 'utf8');
	const action = await vscode.window.showInformationMessage(
		`已把「样例 ${added.index}」写进 ${target.id} 的题面，下次跑样例会带上它。`,
		'打开题面',
	);
	if (action === '打开题面') {
		await showStatement(vscode.Uri.file(target.file));
	}
	return true;
}

async function insertTemplate(): Promise<void> {
	const picked = await vscode.window.showQuickPick(
		(Object.keys(FORMAT_LABEL) as ContestFormat[]).map(f => ({ label: FORMAT_LABEL[f], f })),
		{ title: '选择赛制模板', ignoreFocusOut: true },
	);
	if (!picked) { return; }
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage('请先打开一个 C++ 文件。');
		return;
	}
	await editor.edit(b => b.insert(editor.selection.active, templateFor(picked.f)));
	vscode.window.showInformationMessage(`已插入${picked.f === 'ioi' ? ' IOI' : ' ACM'} 赛制模板。`);
}

/**
 * 剪贴板里通常是整条链接（https://www.luogu.com.cn/problem/P1001），也可能就是裸题号。
 * detectPlatform 认域名，而 fetch* 只认题号，所以这里把 URL 折回题号，两边才对得上。
 */
function refFromClipboard(raw: string): { id: string; platform: Platform } | undefined {
	const text = raw.trim().split(/\s+/)[0];
	const platform = detectPlatform(text);
	if (!platform) {
		return undefined;
	}
	const segments = text.replace(/^[a-z]+:\/\//i, '').split(/[?#]/)[0].split('/').filter(s => s.length > 0);
	const last = segments[segments.length - 1] ?? text;
	const previous = segments[segments.length - 2];
	// Codeforces 的题号是 URL 最后两段拼出来的：/problemset/problem/1660/C → 1660C
	if (platform === 'codeforces' && previous && /^\d+$/.test(previous) && /^[A-Za-z]{1,2}$/.test(last)) {
		return { id: `${previous}${last.toUpperCase()}`, platform };
	}
	return { id: last, platform };
}

export function activate(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('olympia.problem.pull', async () => {
			const ref = await askProblemRef();
			if (ref) { await pullProblem(ref); }
		}),
		vscode.commands.registerCommand('olympia.problem.pullFromClipboard', async () => {
			const clip = await vscode.env.clipboard.readText();
			if (!clip.trim()) {
				vscode.window.showWarningMessage('剪贴板里没有内容。');
				return;
			}
			const ref = refFromClipboard(clip);
			if (ref) {
				await pullProblem(ref);
				return;
			}
			// 认不出来就退回输入框，但把剪贴板内容预填进去，别让人再敲一遍。
			const typed = await askProblemRef(clip.trim().slice(0, 80));
			if (typed) { await pullProblem(typed); }
		}),
		vscode.commands.registerCommand('olympia.template.insert', insertTemplate),
		vscode.commands.registerCommand('olympia.problem.openStatement', openCached),
		vscode.commands.registerCommand('olympia.problem.appendSample', appendSample),
	);

	context.subscriptions.push(registerCppSnippets());
}

export function deactivate(): void {
	// nothing to clean up
}
