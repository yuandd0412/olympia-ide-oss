/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  侧栏里的「题面」视图：拉下来的题面渲染成能读的页面，跟代码并排放。
 *
 *  为什么不再是"编辑区新开一个 .md"：学生要读的是题面，编辑区给他的是 Markdown 源码，
 *  `$O(n\log n)$` 在那儿就是一串反斜杠；而且题面是只读参考，不该抢走写代码的那个标签页。
 *
 *  渲染不自己造轮子：Markdown → HTML 用产品自带的 `markdown.api.render`（markdown-language-features），
 *  公式样式表用随包的 KaTeX（markdown-math 的 notebook-out/katex.min.css）。两边都按扩展 id 在运行时
 *  解析，不抄上游的哈希文件名、也不把路径写死。任何一环拿不到就退回"显示原文 + 说明原因"，
 *  绝不静默给一块白屏——白屏比降级难查得多。
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { FIELD, META_SEPARATOR, metaOf, platformText, STATEMENT_EXTENSION, type ProblemMeta } from './templates';

/** 视图与命令的 id：贡献点、这里、检查台都只从这一处取。 */
export const STATEMENT_VIEW_ID = 'olympia.statement';
export const CMD = {
	show: 'olympia.statement.show',
	refresh: 'olympia.statement.refresh',
	openRaw: 'olympia.statement.openRaw',
	pull: 'olympia.problem.pull',
	pick: 'olympia.problem.openStatement',
} as const;

/**
 * `CMD.show` 的键位，写成人类可读的样子，与 package.json 的 keybindings 一字不差。
 * 文案里要告诉学生按哪个键时从这里取，不要在句子里再敲一遍 —— 改键位的人不会
 * 去搜散在各处的中文提示，写死的那份就会一直说一个已经不存在的组合键。
 * （`scripts/oneoff/check-keybinding-mirrors.mjs` 逐条对拍这两处。）
 */
export const STATEMENT_SHOW_KEY = 'Ctrl+Alt+M';

/** 提供公式样式的扩展；它不在了也要能看题面，所以是"尽力找到"而不是硬依赖。 */
const KATEX_EXTENSION_ID = 'vscode.markdown-math';
const KATEX_CSS = 'notebook-out/katex.min.css';
/** 渲染这一路走不通时给学生的话——说清楚为什么只剩纯文本，而不是假装一切正常。 */
const FALLBACK_NOTE = '这台 Olympia 上没有找到 Markdown 渲染器，下面显示的是题面原文。';
/** 标题行与那两行 `>` 元信息已经变成页眉了，正文里再出现一遍就是重复。 */
const TITLE_LINE = /^#\s/;
/** 元信息行是引用块；正文里学生自己写的 `>` 引用不能一起剥掉。 */
const META_QUOTE_PREFIX = '>';

interface Rendered {
	readonly meta: ProblemMeta;
	readonly body: string;
	/** true 表示 body 是渲染好的 HTML；false 表示是原文（降级）。 */
	readonly rendered: boolean;
}

export class StatementViewProvider implements vscode.WebviewViewProvider {

	private view: vscode.WebviewView | undefined;
	private file: vscode.Uri | undefined;
	private fileWatcher: vscode.Disposable | undefined;
	/** 公式样式表所在扩展的目录；resolve 时定一次，与 localResourceRoots 是同一个决定。 */
	private katexRoot: vscode.Uri | undefined;
	private readonly disposables: vscode.Disposable[] = [];

	constructor(private readonly extensionUri: vscode.Uri) { }

	resolveWebviewView(view: vscode.WebviewView): void {
		this.view = view;
		this.katexRoot = katexRoot();
		view.webview.options = {
			enableScripts: true,
			localResourceRoots: this.katexRoot ? [this.extensionUri, this.katexRoot] : [this.extensionUri],
		};
		view.onDidChangeVisibility(() => {
			if (view.visible) {
				void this.paint();
			}
		});
		view.webview.onDidReceiveMessage(async message => {
			if (message?.type === 'open' && typeof message.href === 'string' && /^https?:/i.test(message.href)) {
				await vscode.env.openExternal(vscode.Uri.parse(message.href));
			} else if (message?.type === 'command' && typeof message.id === 'string') {
				// 页面上每个按钮都对应一条真命令：空按钮比没按钮更坏，学生点了什么也不会发生。
				await vscode.commands.executeCommand(message.id);
			}
		}, undefined, this.disposables);
		void this.paint();
	}

	/**
	 * 把某份题面放进侧栏。视图可能还没被创建（首次使用、或学生把它从齿轮里勾掉过），
	 * 所以先按 `<viewId>.focus` 让它现身，再画——反过来会画到一个还不存在的 webview 上，
	 * 结果是"命令跑了但什么都没发生"。
	 */
	async show(uri: vscode.Uri): Promise<boolean> {
		this.file = uri;
		await this.watch(uri);
		try {
			await vscode.commands.executeCommand(`${STATEMENT_VIEW_ID}.focus`);
		} catch {
			return false;   // 视图没注册（贡献点被改坏）——调用方退回编辑器，别把题面弄丢
		}
		await this.paint();
		return true;
	}

	currentFile(): vscode.Uri | undefined {
		return this.file;
	}

	/** 视图工具栏上的「刷新」：把当前这份文件重新读一遍再画（题面是文件，可能被外部改过）。 */
	async refresh(): Promise<void> {
		await this.paint();
	}

	/** 只盯当前这一份：重新拉题面会就地覆盖同一个文件，侧栏得跟着变。 */
	private async watch(uri: vscode.Uri): Promise<void> {
		this.fileWatcher?.dispose();
		const pattern = new vscode.RelativePattern(vscode.Uri.joinPath(uri, '..'), `*${STATEMENT_EXTENSION}`);
		const watcher = vscode.workspace.createFileSystemWatcher(pattern);
		this.fileWatcher = vscode.Disposable.from(
			watcher,
			watcher.onDidChange(e => { if (e.fsPath === uri.fsPath) { void this.paint(); } }),
			watcher.onDidDelete(e => { if (e.fsPath === uri.fsPath) { this.file = undefined; void this.paint(); } }),
		);
	}

	private async paint(): Promise<void> {
		if (!this.view) {
			return;
		}
		const rendered = this.file ? await renderStatement(this.file) : undefined;
		this.view.webview.html = this.html(rendered, this.file);
	}

	private html(rendered: Rendered | undefined, file: vscode.Uri | undefined): string {
		const { webview } = this.view!;
		const nonce = randomNonce();
		const css = this.katexRoot ? webview.asWebviewUri(vscode.Uri.joinPath(this.katexRoot, KATEX_CSS)) : undefined;
		const meta = rendered?.meta;
		const chips = meta ? chipsOf(meta) : [];
		const body = rendered
			? `<div class="body${rendered.rendered ? '' : ' raw'}">${rendered.body}</div>`
			: emptyState();
		return `<!DOCTYPE html>
<html lang="zh-cn">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: https:; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
${css ? `<link rel="stylesheet" href="${css}">` : ''}
<style>
	:root { color-scheme: light dark }
	body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-sideBar-background); margin: 0; padding: 10px 12px 24px; line-height: 1.62; }
	header h1 { font-size: 1.1em; margin: 0 0 6px; word-break: break-word; }
	.chips { display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 8px; }
	.chip { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 3px; padding: 1px 6px; font-size: .85em; }
	.chip b { font-weight: 400; opacity: .72; margin-right: 3px; }
	.src { font-size: .88em; margin: 0 0 10px; }
	.body { word-break: break-word; }
	.body h1, .body h2, .body h3 { font-size: 1.02em; margin: 14px 0 5px; color: var(--vscode-textLink-foreground); }
	.body p { margin: 6px 0; }
	.body pre { background: var(--vscode-textCodeBlock-background); padding: 7px 9px; overflow-x: auto; margin: 6px 0; }
	.body code { font-family: var(--vscode-editor-font-family); font-size: .95em; }
	.body table { border-collapse: collapse; width: 100%; margin: 6px 0; }
	.body th, .body td { border: 1px solid var(--vscode-panel-border); padding: 3px 6px; text-align: left; vertical-align: top; }
	.body blockquote { margin: 6px 0; padding: 2px 0 2px 9px; border-left: 3px solid var(--vscode-textBlockQuote-border); color: var(--vscode-descriptionForeground); }
	.body.raw { white-space: pre-wrap; font-family: var(--vscode-editor-font-family); font-size: .92em; }
	.note { color: var(--vscode-descriptionForeground); font-size: .88em; margin: 4px 0 10px; }
	.file { color: var(--vscode-descriptionForeground); font-size: .82em; margin-top: 14px; word-break: break-all; }
	.empty { padding: 12px 2px; color: var(--vscode-descriptionForeground); }
	.empty h2 { font-size: 1em; color: var(--vscode-foreground); margin: 0 0 8px; }
	button { font: inherit; color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; border-radius: 2px; padding: 4px 9px; margin: 4px 4px 0 0; cursor: pointer; }
	button:hover { background: var(--vscode-button-hoverBackground); }
	a { color: var(--vscode-textLink-foreground); }
</style>
</head>
<body>
<header>
	${meta ? `<h1>${escapeHtml(`${meta.id}${meta.title ? ` ${meta.title}` : ''}`)}</h1>` : ''}
	<div class="chips">${chips.join('')}</div>
	${meta?.url ? `<div class="src"><a href="${escapeHtml(meta.url)}">原题页面</a></div>` : ''}
</header>
${body}
${file ? `<div class="file">${escapeHtml(vscode.workspace.asRelativePath(file, false))}</div>` : ''}
<script nonce="${nonce}">
	const api = acquireVsCodeApi();
	document.addEventListener('click', e => {
		const el = e.target;
		if (!(el instanceof HTMLElement)) { return; }
		const button = el.closest('button[data-cmd]');
		if (button) { e.preventDefault(); void api.postMessage({ type: 'command', id: button.getAttribute('data-cmd') }); return; }
		const link = el.closest('a[href]');
		const href = link && link.getAttribute('href');
		if (href && /^https?:/i.test(href)) { e.preventDefault(); void api.postMessage({ type: 'open', href }); }
	});
</script>
</body>
</html>`;
	}

	dispose(): void {
		this.fileWatcher?.dispose();
		for (const d of this.disposables) { d.dispose(); }
	}
}

function chipsOf(meta: ProblemMeta): string[] {
	const pairs: readonly (readonly [string, string | undefined])[] = [
		[FIELD.source, meta.source && platformText(meta.source)],
		[FIELD.difficulty, meta.difficulty],
		[FIELD.timeLimit, meta.timeLimit],
		[FIELD.memoryLimit, meta.memoryLimit],
		['样例', meta.sampleCount ? `${meta.sampleCount} 组` : undefined],
	];
	const chips: string[] = [];
	for (const [label, value] of pairs) {
		if (value) {
			chips.push(`<span class="chip"><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>`);
		}
	}
	return chips;
}

function emptyState(): string {
	return `<div class="empty"><h2>侧栏里还没有题面</h2>
	<p>拉一道题（<code>Ctrl+Alt+P</code>），或从题面库里挑一道：题面渲染在这里，代码区不受影响。</p>
	<button data-cmd="${CMD.pull}">拉取题面</button><button data-cmd="${CMD.pick}">从题面库选</button></div>`;
}

function randomNonce(): string {
	return Array.from({ length: 32 }, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]).join('');
}

/** 原文里要按文本处理的那几个字符。渲染过的 HTML 不走这里。 */
function escapeHtml(text: string): string {
	return text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

function katexRoot(): vscode.Uri | undefined {
	return vscode.extensions.getExtension(KATEX_EXTENSION_ID)?.extensionUri;
}

/**
 * 读一份题面并渲染。渲染器不在（被裁掉、或上游把命令改名了）时返回原文并标 rendered=false，
 * 页面上写明原因——降级是可以看见的，白屏不是。
 */
async function renderStatement(uri: vscode.Uri): Promise<Rendered | undefined> {
	let text: string;
	try {
		text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
	} catch {
		return undefined;
	}
	const fallbackId = (uri.path.split('/').pop() ?? '').replace(new RegExp(`\\${STATEMENT_EXTENSION}$`, 'i'), '');
	const meta = metaOf(text, fallbackId);
	const body = bodyOf(text);
	try {
		const html = await vscode.commands.executeCommand<string>('markdown.api.render', body);
		if (typeof html === 'string' && html.trim()) {
			return { meta, body: html, rendered: true };
		}
	} catch {
		// 落到降级
	}
	return { meta, body: `<div class="note">${escapeHtml(FALLBACK_NOTE)}</div>${escapeHtml(body)}`, rendered: false };
}

/**
 * 去掉页眉已经承担的部分：第一行的 `# 题号 标题`，以及 `> 来源：… ｜ …`、`> 原文链接：…`。
 * 只按位置与前缀剥：正文里出现的 `## 输入格式` 和学生自己写的 `>` 引用都得留着。
 */
function bodyOf(markdown: string): string {
	const lines = markdown.split(/\r?\n/);
	if (lines.length && TITLE_LINE.test(lines[0])) {
		lines.shift();
	}
	return lines
		.filter(line => !(line.startsWith(META_QUOTE_PREFIX) && (line.includes(META_SEPARATOR) || line.includes(FIELD.sourceLink))))
		.join('\n')
		.trim();
}
