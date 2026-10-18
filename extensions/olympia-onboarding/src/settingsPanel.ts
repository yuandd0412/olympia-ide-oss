/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Olympia 设置：把散在设置页里的 20 项收进一个页面。
 *
 *  原先要改「编译档位」「对拍轮数」「跑样例的内存上限」得先打开设置页，
 *  再输 @ext:olympia.…，还得知道每一项的英文键名。这一页把三扩展清单里 contributions.configuration
 *  的每一条都列出来：分组、控件、说明文字全是从清单本身读的，所以加一项设置只用改 package.json，
 *  这里不会出现第二份需要人肉同步的表。
 *
 *  读写走的是同一个 workspace.getConfiguration()，所以在 settings.json 里改、在这一页改，
 *  两边立刻一致；本页不保存任何状态。
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';

import { CMD } from './commands';

/** 三个 Olympia 扩展的清单是设置的唯一来源。 */
const OLYMPIA_PUBLISHER = 'olympia';
const SETTING_ROOT = 'olympia';
const SETTING_PREFIX = 'olympia.';
const PANEL_VIEW_TYPE = 'olympiaSettings';
const AI_SETTINGS_ROWS = ['olympia.ai.baseUrl', 'olympia.ai.models'];
/** 按 `olympia.<这一段>.…` 分组；标签与顺序集中在这里，新增的一段会落到「其他」。 */
const GROUP_LABELS: Readonly<Record<string, string>> = {
	compiler: '编译器与评测档位',
	judge: '跑样例',
	check: '提交前体检',
	stress: '对拍',
	problem: '题面与题库',
	templates: '代码模板',
	train: '解题记录与打卡',
	debug: '编辑器自带入口',
	ai: 'AI 教练'
};
const GROUP_ORDER = ['compiler', 'judge', 'check', 'stress', 'problem', 'templates', 'train', 'debug', 'ai'];
const GROUP_FALLBACK = '其他';

interface SettingItem {
	readonly key: string;
	readonly group: string;
	readonly label: string;
	readonly hint: string;
	readonly kind: 'boolean' | 'enum' | 'number' | 'string' | 'other';
	readonly choices: readonly { value: string; label: string }[];
	readonly minimum?: number;
	readonly maximum?: number;
	readonly placeholder?: string;
	/** 这一项要不要一个「浏览…」按钮（可执行文件路径）。 */
	readonly pickFile: boolean;
	/** 不在本页编辑，只给一个跳到对应设置面板的按钮。 */
	readonly delegated: boolean;
}

interface SettingValue {
	readonly key: string;
	readonly value: unknown;
	readonly overridden: boolean;
}

function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
}

/**
 * 清单里的说明是 markdownDescription：转义之后再把 **x** / `x` 还原成标签。
 * 先转义是前提，否则设置默认值里出现尖括号就成了注入。
 */
function renderMarkdownLite(text: string): string {
	return escapeHtml(text)
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/`([^`]+)`/g, '<code>$1</code>');
}

/**
 * 第一句当标题，剩下的当说明——清单里本来就是一句名字加几句解释。
 * 标题不裁长度：裁过会把 `#pragma GCC optimize` 这类代码名切成半截，反而更难读。
 */
function splitDescription(text: string): { label: string; hint: string } {
	const parts = text.split(/(?<=[。；])/);
	const label = (parts.shift() ?? text).trim().replace(/[。；]$/, '');
	return { label, hint: parts.join('').trim() };
}

function groupOf(key: string): string {
	const segment = key.slice(SETTING_PREFIX.length).split('.')[0];
	return GROUP_LABELS[segment] ?? GROUP_FALLBACK;
}

function groupRank(group: string): number {
	const segment = group === GROUP_FALLBACK ? '' : Object.keys(GROUP_LABELS).find(name => GROUP_LABELS[name] === group);
	const index = segment ? GROUP_ORDER.indexOf(segment) : -1;
	return index < 0 ? GROUP_ORDER.length : index;
}

/** 搜索框比对的文本：除标签/键名/说明之外还要带上档位值与分组名，否则框里自己举的例子「-O2」一条都搜不到。 */
function searchText(item: SettingItem): string {
	return [item.label, item.key, item.hint, item.group, ...item.choices.flatMap(choice => [choice.value, choice.label])].join(' ');
}

function propertyKind(raw: { type?: string; enum?: readonly string[] }): SettingItem['kind'] {
	if (raw.enum?.length) {
		return 'enum';
	}
	return raw.type === 'boolean' ? 'boolean' : raw.type === 'number' || raw.type === 'integer' ? 'number' : raw.type === 'string' ? 'string' : 'other';
}

/**
 * 从三个扩展的清单里读出所有 `olympia.*` 设置项。
 * 用 extensions.all 而不是读磁盘上的 package.json：装进来的扩展就是这个列表，
 * 停用的扩展（清单还在）也会列出来，不至于出现「页面上没有这项设置」。
 */
function collectSettings(): SettingItem[] {
	const seen = new Set<string>();
	const items: SettingItem[] = [];
	for (const extension of vscode.extensions.all) {
		if (extension.id.split('.')[0] !== OLYMPIA_PUBLISHER) {
			continue;
		}
		const contribution = (extension.packageJSON?.contributes?.configuration ?? []) as unknown;
		for (const block of Array.isArray(contribution) ? contribution : [contribution]) {
			const properties = (block as { properties?: Record<string, any> })?.properties;
			for (const [key, raw] of Object.entries(properties ?? {})) {
				if (!key.startsWith(SETTING_PREFIX) || seen.has(key)) {
					continue;
				}
				seen.add(key);
				const described = splitDescription(String(raw.markdownDescription ?? raw.description ?? key));
				const choices = (raw.enum ?? []).map((value: string, index: number) => ({
					value,
					label: String(raw.enumDescriptions?.[index] ?? value)
				}));
				items.push({
					key,
					group: groupOf(key),
					label: described.label,
					hint: described.hint || String(raw.description ?? ''),
					kind: propertyKind(raw),
					choices,
					minimum: typeof raw.minimum === 'number' ? raw.minimum : undefined,
					maximum: typeof raw.maximum === 'number' ? raw.maximum : undefined,
					placeholder: typeof raw.default === 'string' && raw.default ? raw.default : undefined,
					pickFile: key.endsWith('.path'),
					delegated: AI_SETTINGS_ROWS.includes(key) || propertyKind(raw) === 'other'
				});
			}
		}
	}
	return items.sort((a, b) => groupRank(a.group) - groupRank(b.group) || a.key.localeCompare(b.key));
}

function currentValue(key: string): SettingValue {
	const config = vscode.workspace.getConfiguration();
	const inspected = config.inspect(key);
	// 读「生效值」，不是 globalValue：olympia.compiler.profile 是「选择评测机编译配置」
	// 写到 Workspace 作用域的（见 extension.ts 那条 update）。只看 globalValue 的话，
	// 学生选完档位回到这一页，下拉框显示的是出厂默认，F9 却按刚选的编译——这一栏就是假账。
	return {
		key,
		value: config.get(key),
		overridden: inspected?.workspaceValue !== undefined || inspected?.globalValue !== undefined
	};
}

function allValues(items: readonly SettingItem[]): SettingValue[] {
	return items.map(item => currentValue(item.key));
}

async function writeSetting(key: string, value: unknown): Promise<string | undefined> {
	// 写回真正在生效的那一层：某项已经被写到 Workspace 了还硬写 Global，
	// 工作区那份继续盖着它——页面上改了，编译照旧，而且没有任何地方说为什么。
	const hasWorkspaceValue = vscode.workspace.getConfiguration().inspect(key)?.workspaceValue !== undefined;
	const target = hasWorkspaceValue ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
	try {
		await vscode.workspace.getConfiguration().update(key, value, target);
		return undefined;
	} catch (error) {
		return (error as Error)?.message ?? String(error);
	}
}

function control(item: SettingItem, index: number): string {
	if (item.delegated) {
		return `<button class="secondary" data-ai="${index}">到 AI 设置里改</button>`;
	}
	if (item.kind === 'boolean') {
		return `<label class="switch"><input type="checkbox" data-index="${index}" /></label>`;
	}
	if (item.kind === 'enum') {
		const options = item.choices.map(choice => `<option value="${escapeHtml(choice.value)}">${escapeHtml(choice.label)}</option>`).join('');
		return `<select data-index="${index}">${options}</select>`;
	}
	const bounds = [item.minimum === undefined ? '' : `min="${item.minimum}"`, item.maximum === undefined ? '' : `max="${item.maximum}"`].join(' ');
	const type = item.kind === 'number' ? 'number' : 'text';
	const picker = item.pickFile ? `<button class="secondary" data-browse="${index}">浏览…</button>` : '';
	return `<span class="field"><input type="${type}" ${bounds} data-index="${index}" placeholder="${escapeHtml(item.placeholder ?? '')}" />${picker}</span>`;
}

function rowHtml(item: SettingItem, index: number): string {
	const reset = `<button class="secondary tiny" data-reset="${index}">恢复默认</button>`;
	const hint = item.hint ? `<p class="hint">${renderMarkdownLite(item.hint)}</p>` : '';
	return `<div class="row" data-row="${index}" data-search="${escapeHtml(searchText(item).toLowerCase())}">
	<div class="main"><span class="name">${renderMarkdownLite(item.label)}</span><code class="key">${escapeHtml(item.key)}</code><span class="badge" data-badge="${index}">已改</span></div>
	<div class="side">${control(item, index)}${reset}</div>
	${hint}
</div>`;
}

function sectionHtml(group: string, rows: string): string {
	return `<section data-group="${escapeHtml(group)}"><h2>${escapeHtml(group)}</h2>${rows}</section>`;
}

function renderHtml(nonce: string, cspSource: string, items: readonly SettingItem[]): string {
	// 分组之后的顺序就是排好的顺序；行号用全局下标，和页面里的 rows 数组一一对应。
	const rowsByGroup = new Map<string, string[]>();
	items.forEach((item, index) => {
		const bucket = rowsByGroup.get(item.group) ?? [];
		bucket.push(rowHtml(item, index));
		rowsByGroup.set(item.group, bucket);
	});
	const body = [...rowsByGroup.keys()].map(group => sectionHtml(group, (rowsByGroup.get(group) ?? []).join(''))).join('');
	const css = `
		:root { color-scheme: light dark; }
		body { font-family: var(--vscode-font-family); padding: 0 28px 48px; max-width: 880px; margin: 0 auto; color: var(--vscode-foreground); }
		h1 { font-size: 22px; font-weight: 600; margin: 26px 0 4px; }
		.lead { color: var(--vscode-descriptionForeground); margin: 0 0 16px; font-size: 13px; line-height: 1.6; }
		#filter { width: 100%; box-sizing: border-box; font-size: 13px; padding: 7px 10px; border-radius: 4px;
			background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); }
		section { border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 14px 16px 6px; margin: 14px 0; background: var(--vscode-editor-background); }
		section h2 { font-size: 14px; margin: 0 0 8px; font-weight: 600; }
		.row { padding: 10px 0 12px; border-top: 1px solid var(--vscode-panel-border); }
		.row:first-of-type { border-top: none; }
		.main { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
		.name { font-size: 13px; font-weight: 600; }
		.key { font-size: 11px; color: var(--vscode-descriptionForeground); font-family: var(--vscode-editor-font-family); }
		.badge { display: none; font-size: 11px; color: var(--vscode-editorWarning-foreground); }
		.row.changed .badge { display: inline; }
		.side { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
		.field { display: flex; gap: 6px; align-items: center; flex: 1 1 260px; }
		input[type=text], input[type=number], select { font-family: var(--vscode-font-family); font-size: 13px; padding: 6px 8px; border-radius: 4px;
			background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); }
		input[type=text], input[type=number], select, .field { min-width: 160px; }
		fieldset { border: none; padding: 0; margin: 0; }
		button { font-size: 13px; padding: 5px 12px; border-radius: 4px; border: 1px solid var(--vscode-button-border, transparent);
			background: var(--vscode-button-background); color: var(--vscode-button-foreground); cursor: pointer; }
		button:hover { background: var(--vscode-button-hoverBackground); }
		button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
		button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
		button.tiny { font-size: 11px; padding: 3px 8px; }
		.hint { font-size: 12px; color: var(--vscode-descriptionForeground); margin: 8px 0 0; line-height: 1.6; }
		code { font-family: var(--vscode-editor-font-family); background: var(--vscode-textCodeBlock-background); padding: 1px 5px; border-radius: 3px; }
		footer { display: flex; gap: 8px; align-items: center; margin-top: 18px; flex-wrap: wrap; }
		.note { font-size: 12px; color: var(--vscode-descriptionForeground); }
		.note.err { color: var(--vscode-errorForeground); }
	`;
	const script = `
		const vscode = acquireVsCodeApi();
		const send = message => vscode.postMessage(message);
		const rows = ${JSON.stringify(items.map(item => ({ key: item.key, kind: item.kind }))).replace(/</g, '\\u003c')};

		function controlOf(index) { return document.querySelector('[data-index="' + index + '"]'); }

		function apply(values) {
			values.forEach(item => {
				const row = rows.find(r => r.key === item.key);
				const index = rows.indexOf(row);
				const el = controlOf(index);
				if (el) {
					if (row.kind === 'boolean') { el.checked = item.value === true; }
					else if (el.tagName === 'SELECT' || el.tagName === 'INPUT') { el.value = item.value === undefined ? '' : String(item.value); }
				}
				const line = document.querySelector('[data-row="' + index + '"]');
				if (line) { line.classList.toggle('changed', item.overridden); }
			});
		}

		window.addEventListener('message', event => {
			if (event.data.type === 'values') { apply(event.data.values); }
			if (event.data.type === 'note') { setNote(event.data.text, event.data.kind); }
		});

		function setNote(text, kind) {
			const el = document.getElementById('note');
			el.textContent = text || '';
			el.className = kind === 'err' ? 'note err' : 'note';
		}

		rows.forEach((row, index) => {
			const el = controlOf(index);
			if (!el) { return; }
			const commit = () => {
				const raw = row.kind === 'boolean' ? el.checked : el.value;
				if (row.kind === 'number') {
					// 空着不等于「恢复默认」：以前空值会走 update(key, undefined) 把这一项删掉，
					// 然后回一句「已保存」——学生只是误删了一个字符，设置就没了，还没有提示。
					if (raw === '' || !Number.isFinite(Number(raw))) {
						setNote('这一项要填数字，没填进去。', 'err');
						return;
					}
					if (el.validity && (el.validity.rangeUnderflow || el.validity.rangeOverflow)) {
						setNote('这一项只能在 ' + (el.min || '-∞') + ' 到 ' + (el.max || '+∞') + ' 之间，没填进去。', 'err');
						return;
					}
				}
				send({ type: 'set', key: row.key, value: row.kind === 'number' ? Number(raw) : raw });
			};
			el.addEventListener('change', commit);
		});

		document.querySelectorAll('[data-reset]').forEach(button => button.addEventListener('click', () => {
			const index = Number(button.getAttribute('data-reset'));
			send({ type: 'reset', key: rows[index].key });
		}));
		document.querySelectorAll('[data-browse]').forEach(button => button.addEventListener('click', () => {
			const index = Number(button.getAttribute('data-browse'));
			send({ type: 'browse', key: rows[index].key });
		}));
		document.querySelectorAll('[data-ai]').forEach(button => button.addEventListener('click', () => send({ type: 'aiSettings' })));
		document.getElementById('openSettings').addEventListener('click', () => send({ type: 'openSettings' }));
		document.getElementById('filter').addEventListener('input', event => {
			const text = event.target.value.trim().toLowerCase();
			// 以前只藏行不藏卡片：搜一个对不上的词会留下 8 个空标题的框，看着像页面坏了。
			const boxes = new Map();
			document.querySelectorAll('[data-row]').forEach(row => {
				const on = !text || row.getAttribute('data-search').includes(text);
				row.style.display = on ? '' : 'none';
				const box = row.closest('section');
				if (box) { boxes.set(box, (boxes.get(box) ?? 0) + (on ? 1 : 0)); }
			});
			let hits = 0;
			boxes.forEach((count, box) => { hits += count; box.style.display = count ? '' : 'none'; });
			const empty = document.getElementById('no-match');
			const query = document.getElementById('no-match-q');
			if (query) { query.textContent = text; }
			if (empty) { empty.style.display = hits ? 'none' : ''; }
		});

		send({ type: 'ready' });
	`;
	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Olympia 设置</title>
<style nonce="${nonce}">${css}</style>
</head>
<body>
	<h1>Olympia 设置</h1>
	<p class="lead">改这里就够了：编译档位、跑样例的内存上限、对拍轮数、题面存放位置。写的是 settings.json 里同样的键，改完立刻生效。</p>
	<input type="text" id="filter" placeholder="搜一下，例如「对拍」「内存」「-O2」" />
	${body}
	<p class="lead" id="no-match" style="display:none">没有哪一项对得上「<span id="no-match-q"></span>」。换个词试试，或者直接按编译档位、跑样例、对拍这些分区标题里的字。</p>
	<footer>
		<button id="openSettings" class="secondary">在设置页里搜 olympia</button>
		<span class="note" id="note"></span>
	</footer>
</body>
<script nonce="${nonce}">${script}</script>
</html>`;
}

let panel: vscode.WebviewPanel | undefined;
let items: SettingItem[] = [];

function randomNonce(): string {
	return Array.from({ length: 32 }, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]).join('');
}

/** 每次改动之后都要重发的值：这一份是唯一的路径，别在第二个地方再拼一遍消息。 */
function valuesMessage(): { type: string; values: SettingValue[] } {
	return { type: 'values', values: allValues(items) };
}

async function report(view: vscode.Webview, key: string, error: string | undefined): Promise<void> {
	await view.postMessage({
		type: 'note',
		text: error ? `写不进去：${error}` : `已保存 ${key}`,
		kind: error ? 'err' : undefined
	});
}

/** 跨扩展的命令（AI 设置在 olympia-coach 里）没注册时要把话说清楚，不能只让按钮没反应。 */
async function runDelegated(command: string, missing: string): Promise<void> {
	try {
		await vscode.commands.executeCommand(command);
	} catch {
		await vscode.window.showWarningMessage(missing);
	}
}

async function browseFor(key: string): Promise<void> {
	const picked = await vscode.window.showOpenDialog({
		title: '选择可执行文件',
		canSelectFiles: true,
		canSelectFolders: false,
		canSelectMany: false,
		openLabel: '就用这个'
	});
	const file = picked?.[0]?.fsPath;
	if (!file) {
		return;
	}
	const error = await writeSetting(key, file);
	if (error) {
		await vscode.window.showErrorMessage(`写不进设置：${error}`);
	}
}

export function registerSettingsPanel(): vscode.Disposable {
	const command = vscode.commands.registerCommand(CMD.settings, () => {
		if (panel) {
			panel.reveal(vscode.ViewColumn.One);
			return;
		}
		items = collectSettings();
		const view = vscode.window.createWebviewPanel(PANEL_VIEW_TYPE, 'Olympia 设置', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
		panel = view;
		view.webview.html = renderHtml(randomNonce(), view.webview.cspSource, items);
		view.onDidDispose(() => {
			if (panel === view) {
				panel = undefined;
			}
		});
		const postValues = () => { void view.webview.postMessage(valuesMessage()); };
		view.webview.onDidReceiveMessage(async message => {
			switch (message.type) {
				case 'ready':
					postValues();
					break;
				case 'set': {
					const error = await writeSetting(message.key, message.value);
					await report(view.webview, message.key, error);
					postValues();
					break;
				}
				case 'reset': {
					const error = await writeSetting(message.key, undefined);
					await report(view.webview, message.key, error);
					postValues();
					break;
				}
				case 'browse':
					await browseFor(message.key);
					break;
				case 'aiSettings':
					await runDelegated(CMD.aiSettings, 'AI 设置由 olympia-coach 提供，那个扩展当前没启用。');
					break;
				case 'openSettings':
					await vscode.commands.executeCommand('workbench.action.openSettings', SETTING_ROOT);
					break;
			}
		});
	});
	const changes = vscode.workspace.onDidChangeConfiguration(event => {
		if (panel && event.affectsConfiguration(SETTING_ROOT)) {
			void panel.webview.postMessage(valuesMessage());
		}
	});
	return vscode.Disposable.from(command, changes, { dispose: () => panel?.dispose() });
}
