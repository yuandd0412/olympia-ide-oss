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
import { renderStatement, templateFor, FORMAT_LABEL, PLATFORM_TEXT, platformText, MY_TEMPLATE_LABEL, MY_TEMPLATE_HINT, TEMPLATE_FOLDER, TEMPLATE_FILE, STATEMENT_EXTENSION, type ContestFormat } from './templates';
import { readLibrary, showStatement, toPicks } from './problemLibrary';
import { markOf, solvedMarks } from './solvedMarks';
import { appendSample as appendSampleTo, customSamplesOf, MANUAL_EXPLAIN, pickTarget, withCustomSamples } from './statementSamples';
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
	const file = path.join(root, `${p.id}${STATEMENT_EXTENSION}`);
	// 题面里可能已经有学生自己加的样例（面板补的、对拍补的），重新拉一次不能把它们冲掉
	const previous = await fs.promises.readFile(file, 'utf8').catch(() => '');
	const custom = previous ? customSamplesOf(previous) : [];
	await fs.promises.writeFile(file, withCustomSamples(renderStatement(p), custom), 'utf8');
	if (custom.length) {
		vscode.window.showInformationMessage(`题面已更新，你加的 ${custom.length} 组样例保留了。`);
	}
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
						// 拉完题面建新文件正是模板最该出现的一刻：有自己那份就用自己那份。
						await fs.promises.writeFile(seed, await readMyTemplate() ?? templateFor('acm'), 'utf8');
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
	// 做过的题打个勾：题库刷到一半回来接着做，靠记忆挑「哪道还没 AC」是最亏的。
	const marks = await solvedMarks();
	const solved = entries.filter(entry => markOf(marks, entry.id)).length;
	const picks = toPicks(entries, vscode.workspace.workspaceFolders?.[0]?.uri.fsPath, marks);
	const picked = await vscode.window.showQuickPick(picks, {
		title: solved ? `题面库（缓存 ${entries.length} 道，已 AC ${solved} 道）` : `题面库（缓存了 ${entries.length} 道题）`,
		placeHolder: solved ? '按题号或标题搜；敲 AC 只看做出来的题' : '按题号或标题搜，例如 P1001、并查集',
		matchOnDescription: true,
		matchOnDetail: true,
		ignoreFocusOut: true,
	});
	if (!picked) { return; }
	await showStatement(vscode.Uri.file(picked.entry.file));
}

/** 对拍抓到的那组数据传过来时带这些字段；从命令面板直接调用时一个都没有。 */
interface AppendSampleArgs {
	readonly hint?: string;
	readonly input?: string;
	readonly output?: string;
	readonly explain?: string;
}

/** 这道题的题面是不是正开着且有没保存的改动。 */
function hasUnsavedEdits(file: string): boolean {
	const wanted = file.toLowerCase();
	return vscode.workspace.textDocuments.some(doc => doc.isDirty && doc.uri.fsPath.toLowerCase() === wanted);
}

/**
 * 把一组样例写进题面。带参数是对拍在补它抓到的那组数据（期望输出取正解的输出）；
 * 不带参数是从命令面板来的，加一组空的占位样例并把文件打开让人填——
 * 题面就是本地那份可编辑的用例表，不需要再造一个只有 Olympia 认的格式。
 */
async function appendSample(args?: AppendSampleArgs): Promise<boolean> {
	const partial = (args?.input === undefined) !== (args?.output === undefined);
	if (partial) {
		vscode.window.showWarningMessage('补一组样例要同时给出输入和期望输出，只给一半没法写。');
		return false;
	}
	const manual = args?.input === undefined && args?.output === undefined;
	const root = await problemsRoot();
	if (!root) { return false; }
	const entries = await readLibrary(root);
	if (!entries.length) {
		vscode.window.showInformationMessage('题面库里还没有题面，样例没地方写。先按 Ctrl+Alt+P 拉一道题的题面。');
		return false;
	}
	const target = await pickTarget(entries, args?.hint, async list => {
		const picked = await vscode.window.showQuickPick(toPicks(list, vscode.workspace.workspaceFolders?.[0]?.uri.fsPath), {
			title: '这组样例补进哪道题',
			placeHolder: manual
				? `给题面库里的哪道题加一组样例（缓存了 ${list.length} 道）`
				: `当前文件没有同名题面，从题面库里挑一道（缓存了 ${list.length} 道）`,
			matchOnDescription: true,
			matchOnDetail: true,
			ignoreFocusOut: true,
		});
		return picked?.entry;
	});
	if (!target) { return false; }

	// 题面在编辑器里有没保存的改动时不能写磁盘：那份改动保存时会把刚补的样例盖掉
	if (hasUnsavedEdits(target.file)) {
		vscode.window.showWarningMessage(`「${target.id}」的题面在编辑器里有没保存的改动。先按 Ctrl+S 保存，再补样例。`);
		return false;
	}
	const markdown = await fs.promises.readFile(target.file, 'utf8');
	const added = appendSampleTo(markdown, manual
		? { input: '', output: '', explain: MANUAL_EXPLAIN }
		: { input: args?.input ?? '', output: args?.output ?? '', explain: args?.explain });
	await fs.promises.writeFile(target.file, added.markdown, 'utf8');
	if (manual) {
		// 加完就打开让人填，不弹一句「已添加」然后什么都不动
		await showStatement(vscode.Uri.file(target.file));
		return true;
	}
	const action = await vscode.window.showInformationMessage(
		`已把「样例 ${added.index}」写进 ${target.id} 的题面，下次跑样例会带上它。`,
		'打开题面',
	);
	if (action === '打开题面') {
		await showStatement(vscode.Uri.file(target.file));
	}
	return true;
}

/** 学生自己那份模板的位置；没打开工作区就没有。 */
function myTemplateFile(): vscode.Uri | undefined {
	const folder = vscode.workspace.workspaceFolders?.[0];
	return folder ? vscode.Uri.joinPath(folder.uri, TEMPLATE_FOLDER, TEMPLATE_FILE) : undefined;
}

/** 只有内容才算模板：新建出来还没填过的空文件不该被当成一份模板插进代码。 */
async function readMyTemplate(): Promise<string | undefined> {
	const file = myTemplateFile();
	if (!file) {
		return undefined;
	}
	try {
		const text = await fs.promises.readFile(file.fsPath, 'utf8');
		return text.trim() ? text : undefined;
	} catch {
		return undefined;
	}
}

/** 打开我的模板；没有就用 ACM 模板建一份，让学生改现成的而不是从空白开始。 */
async function editMyTemplate(): Promise<void> {
	const file = myTemplateFile();
	if (!file) {
		await vscode.window.showWarningMessage('先打开一个文件夹，我的模板存在工程里的 .olympia/template.cpp。');
		return;
	}
	if (!fs.existsSync(file.fsPath)) {
		await fs.promises.mkdir(path.dirname(file.fsPath), { recursive: true });
		await fs.promises.writeFile(file.fsPath, templateFor('acm'), 'utf8');
	}
	const doc = await vscode.workspace.openTextDocument(file);
	await vscode.window.showTextDocument(doc, { preview: false });
}

interface TemplateChoice {
	readonly label: string;
	readonly description?: string;
	readonly format?: ContestFormat;
	readonly mine?: boolean;
	readonly edit?: boolean;
}

async function insertTemplate(): Promise<void> {
	const my = await readMyTemplate();
	const formats = (Object.keys(FORMAT_LABEL) as ContestFormat[]).map(f => ({ label: FORMAT_LABEL[f], format: f }));
	const choices: TemplateChoice[] = [
		...(my ? [{ label: MY_TEMPLATE_LABEL, description: MY_TEMPLATE_HINT, mine: true }] : []),
		...formats,
		{ label: my ? '编辑我的模板…' : '新建我的模板（拿 ACM 模板打底）…', edit: true }
	];
	const picked = await vscode.window.showQuickPick(choices, {
		title: '选择赛制模板',
		placeHolder: my ? '我的模板排在最前面，直接回车就是用你自己那份' : '建一份你自己的模板，以后每次都省事',
		ignoreFocusOut: true,
	});
	if (!picked) { return; }
	if (picked.edit) {
		await editMyTemplate();
		return;
	}
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage('请先打开一个 C++ 文件。');
		return;
	}
	const body = picked.mine ? my : templateFor(picked.format ?? 'acm');
	if (!body) {
		await vscode.window.showWarningMessage('我的模板是空的，先填几行再插。');
		return;
	}
	await editor.edit(b => b.insert(editor.selection.active, body));
	vscode.window.showInformationMessage(
		picked.mine ? '已插入你的模板。不想用它了就按 Ctrl+Alt+T 选「编辑我的模板」。'
			: `已插入${picked.format === 'ioi' ? ' IOI' : ' ACM'} 赛制模板。`
	);
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
		// 面板和命令面板里给一条直达入口：想改模板的人不该先被问「插哪个模板」。
		vscode.commands.registerCommand('olympia.template.editMy', editMyTemplate),
		vscode.commands.registerCommand('olympia.problem.openStatement', openCached),
		vscode.commands.registerCommand('olympia.problem.appendSample', appendSample),
	);

	context.subscriptions.push(registerCppSnippets());
}

export function deactivate(): void {
	// nothing to clean up
}
