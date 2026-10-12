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
import { renderStatement, templateFor, FORMAT_LABEL, type ContestFormat } from './templates';
import { registerCppSnippets } from './snippets';

const PLATFORM_LABEL: Record<Platform, string> = {
	luogu: '洛谷',
	codeforces: 'Codeforces',
	atcoder: 'AtCoder',
};

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
			(Object.keys(PLATFORM_LABEL) as Platform[]).map(p => ({ label: PLATFORM_LABEL[p], p })),
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
		{ location: vscode.ProgressLocation.Notification, title: `正在从 ${PLATFORM_LABEL[ref.platform]} 拉取题面 ${ref.id}…`, cancellable: false },
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
						`${PLATFORM_LABEL[ref.platform]} 的题面网页有人机校验，已写入题目信息。是否在浏览器中打开原题？`,
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
	const entries = await fs.promises.readdir(root).catch(() => [] as string[]);
	const files = entries.filter(f => f.endsWith('.md'));
	if (!files.length) {
		vscode.window.showInformationMessage('还没有缓存的题面，先用「拉取题面」抓一道吧。');
		return;
	}
	const picked = await vscode.window.showQuickPick(files.map(f => ({
		label: f.replace(/\.md$/, ''),
		description: f,
	})), { title: '已缓存的题面', ignoreFocusOut: true });
	if (!picked) { return; }
	const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(root, picked.description)));
	await vscode.window.showTextDocument(doc, { preview: false });
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
	);

	context.subscriptions.push(registerCppSnippets());
}

export function deactivate(): void {
	// nothing to clean up
}
