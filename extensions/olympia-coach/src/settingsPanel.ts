/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  The one place where a student configures the AI coach: service address, API key, model list.
 *
 *  Before this existed the same task was spread over a settings page (baseUrl, models), a
 *  command-palette password box (the key), a quick pick (the chosen model) and a log channel
 *  (why a listing failed) — and nothing showed whether the key was already set. The panel keeps
 *  the decisions in one form and reads/writes exactly the same storage the provider uses, so
 *  there is no second source of truth.
 *
 *  The API key is never sent into the webview: the page only learns whether one exists and its
 *  last four characters. Entry goes through the password input box, which the webview cannot
 *  read back.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import {
	CONFIG_SECTION, BASE_URL_SETTING, MODELS_SETTING, EXAMPLE_BASE_URL, FALLBACK_CHAT_MODELS,
	CHOSEN_MODEL_STATE_KEY, SETTINGS_COMMAND
} from './constants';
import { probeModels, readBaseUrl, readManualModels, setApiKey, apiKeyTail, invalidateModelsCache, type ModelProbe } from './provider';

interface PanelState {
	baseUrl: string;
	hasKey: boolean;
	keyTail: string;
	mode: 'auto' | 'manual';
	manualModels: string[];
	probe: ModelProbe;
	chosenModel: string | null;
	exampleBaseUrl: string;
	fallbackModels: readonly string[];
}

let openPanel: vscode.WebviewPanel | undefined;

async function collectState(context: vscode.ExtensionContext, probe: ModelProbe): Promise<PanelState> {
	return {
		baseUrl: readBaseUrl(),
		hasKey: probe.hasKey,
		keyTail: await apiKeyTail(context),
		mode: readManualModels().length ? 'manual' : 'auto',
		manualModels: readManualModels(),
		probe,
		chosenModel: context.globalState.get<string>(CHOSEN_MODEL_STATE_KEY) ?? null,
		exampleBaseUrl: EXAMPLE_BASE_URL,
		fallbackModels: FALLBACK_CHAT_MODELS,
	};
}

async function refresh(context: vscode.ExtensionContext, panel: vscode.WebviewPanel, force: boolean): Promise<void> {
	const probe = await probeModels(context, { force });
	await panel.webview.postMessage({ type: 'state', state: await collectState(context, probe) });
}

function renderHtml(nonce: string, cspSource: string): string {
	const css = `
		:root { color-scheme: light dark; }
		body { font-family: var(--vscode-font-family); padding: 0 28px 40px; max-width: 760px; margin: 0 auto; color: var(--vscode-foreground); }
		h1 { font-size: 22px; font-weight: 600; margin: 26px 0 4px; }
		.lead { color: var(--vscode-descriptionForeground); margin: 0 0 22px; font-size: 13px; }
		section { border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 16px 18px; margin-bottom: 16px; background: var(--vscode-editor-background); }
		section h2 { font-size: 14px; margin: 0 0 10px; font-weight: 600; }
		label { display: block; font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 6px; }
		input[type=text], textarea { width: 100%; box-sizing: border-box; font-family: var(--vscode-font-family); font-size: 13px;
			background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); border-radius: 4px; padding: 7px 9px; }
		textarea { min-height: 108px; font-family: var(--vscode-editor-font-family); resize: vertical; }
		.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 10px; }
		button { font-size: 13px; padding: 6px 14px; border-radius: 4px; border: 1px solid var(--vscode-button-border, transparent);
			background: var(--vscode-button-background); color: var(--vscode-button-foreground); cursor: pointer; }
		button:hover { background: var(--vscode-button-hoverBackground); }
		button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
		button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
		.status { display: flex; gap: 8px; align-items: baseline; font-size: 13px; }
		.dot { width: 9px; height: 9px; border-radius: 50%; background: var(--vscode-errorForeground); flex: none; }
		.dot.ok { background: var(--vscode-charts-green); }
		.dot.warn { background: var(--vscode-editorWarning-foreground); }
		.hint { font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 8px; line-height: 1.6; }
		code { font-family: var(--vscode-editor-font-family); background: var(--vscode-textCodeBlock-background); padding: 1px 5px; border-radius: 3px; }
		.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
		.chip { font-size: 12px; padding: 3px 10px; border-radius: 20px; border: 1px solid var(--vscode-panel-border); cursor: pointer;
			background: var(--vscode-list-inactiveSelectionBackground); }
		.chip.on { border-color: var(--vscode-focusBorder); font-weight: 600; }
		.err { color: var(--vscode-errorForeground); }
	`;
	const script = `
		const vscode = acquireVsCodeApi();
		const $ = id => document.getElementById(id);
		const send = (message) => vscode.postMessage(message);

		function setText(id, value) { const el = $(id); if (el) { el.textContent = value; } }
		function setCls(id, cls) { const el = $(id); if (el) { el.className = cls; } }

		window.addEventListener('message', event => {
			const m = event.data;
			if (m.type !== 'state') { return; }
			const s = m.state;
			$('baseUrl').value = s.baseUrl;
			$('manualModels').value = s.manualModels.join('\\n');
			$('manualBox').style.display = s.mode === 'manual' ? 'block' : 'none';
			$('autoBox').style.display = s.mode === 'auto' ? 'block' : 'none';
			$('modeAuto').checked = s.mode === 'auto';
			$('modeManual').checked = s.mode === 'manual';
			setText('keyState', s.hasKey ? ('已设置 ····' + s.keyTail) : '未设置');
			setCls('keyDot', s.hasKey ? 'dot ok' : 'dot');
			setText('probeState', s.probe.ok ? ('可用 · ' + s.probe.ids.length + ' 个模型 · ' + sourceLabel(s.probe)) : '不可用');
			setCls('probeDot', s.probe.ok ? 'dot ok' : 'dot');
			setText('probeDetail', s.probe.ok ? '' : (s.probe.error || '未知原因'));
			$('probeDetail').className = s.probe.ok ? 'hint' : 'hint err';
			const chips = $('chips'); chips.textContent = '';
			(s.probe.ids.length ? s.probe.ids : s.fallbackModels).forEach(id => {
				const chip = document.createElement('span');
				chip.className = 'chip' + (id === s.chosenModel ? ' on' : '');
				chip.textContent = id;
				chip.onclick = () => send({ type: 'chooseModel', id });
				chips.appendChild(chip);
			});
			setText('chosen', s.chosenModel ? ('当前选用：' + s.chosenModel) : (s.probe.ids.length === 1 ? '只有一可用模型，将直接使用' : '尚未选择模型'));
		});

		function sourceLabel(probe) {
			if (probe.source === 'manual') { return '手动指定'; }
			if (probe.source === 'cache') { return '缓存 ' + (probe.cacheAgeSeconds || 0) + ' 秒前'; }
			if (probe.source === 'remote') { return '刚从服务地址拉取'; }
			return '未获取';
		}

		$('saveBaseUrl').onclick = () => send({ type: 'saveBaseUrl', value: $('baseUrl').value });
		$('testBtn').onclick = () => send({ type: 'probe', force: true });
		$('refreshBtn').onclick = () => send({ type: 'refresh' });
		$('saveModels').onclick = () => send({ type: 'saveModels', value: $('manualModels').value });
		$('useAuto').onclick = () => send({ type: 'useAuto' });
		$('setKey').onclick = () => send({ type: 'setKey' });
		$('clearKey').onclick = () => send({ type: 'clearKey' });
		$('openSettingsJson').onclick = () => send({ type: 'openSettingsJson' });
		$('showLog').onclick = () => send({ type: 'showLog' });
		document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', () => {
			send({ type: 'setMode', value: r.value });
		}));
		send({ type: 'ready' });
	`;
	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Olympia AI 设置</title>
<style nonce="${nonce}">${css}</style>
</head>
<body>
	<h1>Olympia AI 设置</h1>
	<p class="lead">AI 教练只用你自己配置的模型：填地址、放密钥、选模型，三件事都在这一页。</p>

	<section>
		<h2>1 · 服务地址</h2>
		<label for="baseUrl">OpenAI 兼容服务的基地址，不含 <code>/chat/completions</code></label>
		<input type="text" id="baseUrl" placeholder="${EXAMPLE_BASE_URL}" />
		<div class="row"><button id="saveBaseUrl">保存地址</button></div>
		<p class="hint">模型列表默认从同一个地址的 <code>/models</code> 读取。</p>
	</section>

	<section>
		<h2>2 · API 密钥</h2>
		<div class="status"><span class="dot" id="keyDot"></span><span id="keyState">未设置</span></div>
		<div class="row">
			<button id="setKey">设置 / 更换密钥</button>
			<button id="clearKey" class="secondary">清除</button>
		</div>
		<p class="hint">密钥只存在本机的 SecretStorage 里，不会写进 settings.json，也不会同步或上传。输入框是密码框，页面读不到它的内容。</p>
	</section>

	<section>
		<h2>3 · 模型</h2>
		<div class="row" style="margin-top:0">
			<label style="margin:0"><input type="radio" name="mode" id="modeAuto" value="auto" /> 自动从 /models 拉取（推荐）</label>
			<label style="margin:0"><input type="radio" name="mode" id="modeManual" value="manual" /> 手动指定</label>
		</div>
		<div id="autoBox">
			<div class="status" style="margin-top:12px"><span class="dot" id="probeDot"></span><span id="probeState">未获取</span></div>
			<p class="hint" id="probeDetail"></p>
			<div class="chips" id="chips"></div>
			<div class="row">
				<button id="testBtn">测试连接</button>
				<button id="refreshBtn" class="secondary">重新拉取</button>
			</div>
			<p class="hint" id="chosen"></p>
		</div>
		<div id="manualBox" style="display:none">
			<label for="manualModels" style="margin-top:12px">每行一个模型 id，保存后只认这份列表（适合没有 <code>/models</code> 接口的网关或离线内网）</label>
			<textarea id="manualModels" spellcheck="false"></textarea>
			<div class="row">
				<button id="saveModels">保存列表</button>
				<button id="useAuto" class="secondary">改回自动拉取</button>
			</div>
		</div>
	</section>

	<section>
		<h2>4 · 高级</h2>
		<div class="row" style="margin-top:0">
			<button id="showLog" class="secondary">打开输出日志</button>
			<button id="openSettingsJson" class="secondary">在设置里编辑（JSON）</button>
		</div>
		<p class="hint">拉取失败时原因会写在这里；本页与 <code>olympia.ai.*</code> 设置项读写同一份数据，改哪边都生效。</p>
	</section>
</body>
<script nonce="${nonce}">${script}</script>
</html>`;
}

async function showApiKeyDialog(context: vscode.ExtensionContext): Promise<void> {
	const key = await vscode.window.showInputBox({
		title: '设置 Olympia AI 教练的 API Key',
		placeHolder: 'sk-…',
		password: true,
		ignoreFocusOut: true,
		prompt: '密钥保存在本机 SecretStorage 中，不会写进 settings.json，也不会同步或上传。留空表示清除。'
	});
	if (key === undefined) {
		return;
	}
	await setApiKey(context, key);
	if (key) {
		const baseUrl = readBaseUrl();
		await vscode.window.showInformationMessage(baseUrl ? 'API Key 已保存。' : 'API Key 已保存。还需要填写服务地址。');
	} else {
		await vscode.window.showInformationMessage('已清除 API Key。');
	}
}

export function registerSettingsPanel(context: vscode.ExtensionContext, log: vscode.LogOutputChannel): void {
	context.subscriptions.push(vscode.commands.registerCommand('olympia.coach.setApiKey', () => showApiKeyDialog(context)));
	context.subscriptions.push(vscode.commands.registerCommand('olympia.coach.showLog', () => log.show(true)));

	context.subscriptions.push(vscode.commands.registerCommand(SETTINGS_COMMAND, async () => {
		if (openPanel) {
			openPanel.reveal(vscode.ViewColumn.One);
			return;
		}
		const panel = vscode.window.createWebviewPanel('olympiaAiSettings', 'Olympia AI 设置', vscode.ViewColumn.One, {
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: []
		});
		openPanel = panel;
		const nonce = Array.from({ length: 32 }, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]).join('');
		panel.webview.html = renderHtml(nonce, panel.webview.cspSource);

		panel.webview.onDidReceiveMessage(async message => {
			const type = typeof message?.type === 'string' ? message.type : '';
			switch (type) {
				case 'ready':
				case 'probe':
					await refresh(context, panel, !!message?.force);
					return;
				case 'refresh':
					invalidateModelsCache();
					await refresh(context, panel, true);
					return;
				case 'saveBaseUrl': {
					const value = typeof message.value === 'string' ? message.value.trim() : '';
					await vscode.workspace.getConfiguration(CONFIG_SECTION).update(BASE_URL_SETTING, value, vscode.ConfigurationTarget.Global);
					invalidateModelsCache();
					break;
				}
				case 'saveModels': {
					const lines: string[] = String(message.value ?? '').split(/\r?\n/).map((line: string) => line.trim()).filter((line: string) => !!line);
					await vscode.workspace.getConfiguration(CONFIG_SECTION).update(MODELS_SETTING, lines, vscode.ConfigurationTarget.Global);
					invalidateModelsCache();
					break;
				}
				case 'useAuto':
					await vscode.workspace.getConfiguration(CONFIG_SECTION).update(MODELS_SETTING, [], vscode.ConfigurationTarget.Global);
					invalidateModelsCache();
					break;
				case 'setMode':
					if (message.value === 'auto') {
						await vscode.workspace.getConfiguration(CONFIG_SECTION).update(MODELS_SETTING, [], vscode.ConfigurationTarget.Global);
					} else if (!readManualModels().length) {
						await vscode.workspace.getConfiguration(CONFIG_SECTION).update(MODELS_SETTING, [...FALLBACK_CHAT_MODELS], vscode.ConfigurationTarget.Global);
					}
					invalidateModelsCache();
					break;
				case 'setKey':
					await showApiKeyDialog(context);
					break;
				case 'clearKey':
					await setApiKey(context, '');
					await vscode.window.showInformationMessage('已清除 API Key。');
					break;
				case 'chooseModel': {
					const id = typeof message.id === 'string' ? message.id : '';
					if (id) {
						await context.globalState.update(CHOSEN_MODEL_STATE_KEY, id);
					}
					break;
				}
				case 'openSettingsJson':
					await vscode.commands.executeCommand('workbench.action.openSettingsJson');
					break;
				case 'showLog':
					await vscode.commands.executeCommand('olympia.coach.showLog');
					break;
			}
			await refresh(context, panel, false);
		});

		panel.onDidDispose(() => { openPanel = undefined; });
	}));
}
