/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Olympia BYOK language-model provider.
//
// product.json already names this extension as the provider (defaultChatAgent.provider.
// providerExtensionId = olympia.olympia-coach, providerUriSetting = olympia.ai.baseUrl) but the
// contribution was never implemented, so vscode.lm.selectModels() returned nothing and @coach
// could not answer. This supplies the missing half: an OpenAI-compatible /chat/completions
// backend that streams into core's response parts.
//
// The key lives in SecretStorage only — never settings.json (plaintext, synced) and never
// globalState — and the entry box is a password field.

import * as vscode from 'vscode';

const VENDOR = 'olympia';
const KEY_SECRET = 'olympia.coach.apiKey';
const DEFAULT_MODELS = ['deepseek-chat', 'deepseek-reasoner'];
const MODELS_CACHE_MS = 5 * 60 * 1000;
const MODELS_TIMEOUT_MS = 5000;

// Endpoints that answer 401 rather than 404 for `/models` (verified against api.deepseek.com on
// 2026-10-11), but the response shape is not documented, so the parse accepts whatever an
// OpenAI-compatible server returns instead of betting on one key name.
const NON_CHAT_ID_HINTS = ['embedding', 'rerank', 'rewriter', 'rewrite', 'moderation', 'tts', 'whisper', 'ocr', 'translator', 'search'];

interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

interface TextPartLike { value: string }

interface ModelRow { id?: unknown; model?: unknown; name?: unknown }

interface ModelsPayload { data?: unknown; models?: unknown }

interface ModelsCache { baseUrl: string; at: number; ids: string[] }

function rowId(row: ModelRow): string | undefined {
	const candidates = [row.id, row.model, row.name];
	for (const candidate of candidates) {
		if (typeof candidate === 'string' && candidate) {
			return candidate;
		}
	}
	return undefined;
}

function isChatModel(id: string): boolean {
	const lower = id.toLowerCase();
	return !NON_CHAT_ID_HINTS.some(hint => lower.includes(hint));
}

export function parseModelIds(json: unknown): string[] {
	let rows: unknown[] | undefined;
	if (Array.isArray(json)) {
		rows = json;
	} else if (json && typeof json === 'object') {
		const payload = json as ModelsPayload;
		rows = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.models) ? payload.models : undefined;
	}
	if (!rows) {
		return [];
	}
	const ids: string[] = [];
	for (const row of rows) {
		if (typeof row === 'string') {
			ids.push(row);
		} else if (row && typeof row === 'object') {
			const id = rowId(row as ModelRow);
			if (id) {
				ids.push(id);
			}
		}
	}
	const unique: string[] = [];
	for (const id of ids) {
		if (isChatModel(id) && !unique.includes(id)) {
			unique.push(id);
		}
	}
	return unique;
}

function isTextPartLike(part: unknown): part is TextPartLike {
	return typeof part === 'object' && part !== null && typeof (part as TextPartLike).value === 'string';
}

function textOf(part: unknown): string {
	if (typeof part === 'string') {
		return part;
	}
	return isTextPartLike(part) ? part.value : '';
}

export class OlympiaChatProvider implements vscode.LanguageModelChatProvider {

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly log: vscode.LogOutputChannel
	) { }

	private modelsCache: ModelsCache | undefined;

	private async credentials(): Promise<{ baseUrl: string; key: string } | undefined> {
		const baseUrl = (vscode.workspace.getConfiguration('olympia.ai').get<string>('baseUrl') ?? '').replace(/\/+$/, '');
		const key = (await this.context.secrets.get(KEY_SECRET)) ?? '';
		if (!baseUrl || !key) {
			return undefined;
		}
		return { baseUrl, key };
	}

	// Empty means "ask the server", which is the default; a non-empty list wins outright so the
	// coach still works with no network round-trip and with a gateway that has no /models route.
	private explicitModels(): string[] {
		const models = vscode.workspace.getConfiguration('olympia.ai').get<string[]>('models');
		return Array.isArray(models) ? models.filter(id => typeof id === 'string' && !!id) : [];
	}

	private async remoteModels(creds: { baseUrl: string; key: string }): Promise<string[]> {
		const cached = this.modelsCache;
		if (cached && cached.baseUrl === creds.baseUrl && Date.now() - cached.at < MODELS_CACHE_MS && cached.ids.length) {
			this.log.info(`model list served from cache (${cached.ids.length} models, age ${Math.round((Date.now() - cached.at) / 1000)}s)`);
			return cached.ids;
		}
		let ids: string[] = [];
		try {
			const response = await fetch(`${creds.baseUrl}/models`, {
				method: 'GET',
				signal: AbortSignal.timeout(MODELS_TIMEOUT_MS),
				headers: { authorization: `Bearer ${creds.key}` }
			});
			if (!response.ok) {
				this.log.warn(`GET ${creds.baseUrl}/models -> HTTP ${response.status}; using the built-in fallback list. Set olympia.ai.models to name your models explicitly.`);
				return [];
			}
			ids = parseModelIds(JSON.parse(await response.text()));
			if (!ids.length) {
				this.log.warn(`GET ${creds.baseUrl}/models returned 200 but no usable model ids; using the built-in fallback list.`);
				return [];
			}
		} catch (error) {
			this.log.warn(`could not list models from ${creds.baseUrl}/models: ${error instanceof Error ? error.message : String(error)}; using the built-in fallback list.`);
			return [];
		}
		this.modelsCache = { baseUrl: creds.baseUrl, at: Date.now(), ids };
		this.log.info(`listed ${ids.length} models from ${creds.baseUrl}/models`);
		return ids;
	}

	invalidateModelsCache(): void {
		this.modelsCache = undefined;
	}

	async provideLanguageModelChatInformation(_options: vscode.PrepareLanguageModelChatModelOptions, _token: vscode.CancellationToken): Promise<vscode.LanguageModelChatInformation[]> {
		const creds = await this.credentials();
		if (!creds) {
			// Silent calls happen while core warms up; prompting there would be noise.
			return [];
		}
		const explicit = this.explicitModels();
		const ids = explicit.length ? explicit : await this.remoteModels(creds);
		return (ids.length ? ids : DEFAULT_MODELS).map(id => ({
			vendor: VENDOR,
			id,
			name: id,
			family: 'Olympia',
			version: '1',
			maxInputTokens: 64000,
			maxOutputTokens: 8000,
			capabilities: { toolCalling: false, imageInput: false },
			tooltip: id,
			detail: '通过 Olympia BYOK 调用'
		}));
	}

	private toChatMessages(messages: readonly vscode.LanguageModelChatRequestMessage[]): ChatMessage[] {
		const out: ChatMessage[] = [];
		for (const message of messages) {
			const content = message.content.map(textOf).join('');
			if (!content) {
				continue;
			}
			// LanguageModelChatMessageRole: User = 1, Assistant = 2.
			out.push({ role: message.role === 2 ? 'assistant' : 'user', content });
		}
		return out;
	}

	async provideLanguageModelChatResponse(model: vscode.LanguageModelChatInformation, messages: readonly vscode.LanguageModelChatRequestMessage[], _options: vscode.ProvideLanguageModelChatResponseOptions, progress: vscode.Progress<vscode.LanguageModelResponsePart>, token: vscode.CancellationToken): Promise<void> {
		const creds = await this.credentials();
		if (!creds) {
			throw new Error('Olympia BYOK: 缺少 baseUrl 或 API Key');
		}
		const abort = new AbortController();
		const subscription = token.onCancellationRequested(() => abort.abort());
		try {
			const response = await fetch(`${creds.baseUrl}/chat/completions`, {
				method: 'POST',
				signal: abort.signal,
				headers: { 'content-type': 'application/json', authorization: `Bearer ${creds.key}` },
				body: JSON.stringify({ model: model.id, stream: true, messages: this.toChatMessages(messages) })
			});
			if (!response.ok || !response.body) {
				const snippet = (await response.text()).slice(0, 200);
				throw new Error(`Olympia BYOK: HTTP ${response.status} ${snippet}`);
			}
			// Server-Sent Events: `data: {json}` lines, terminated by `data: [DONE]`.
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			for (; ;) {
				const { done, value } = await reader.read();
				if (done) {
					break;
				}
				buffer += decoder.decode(value, { stream: true });
				let newline = buffer.indexOf('\n');
				while (newline >= 0) {
					const line = buffer.slice(0, newline).trim();
					buffer = buffer.slice(newline + 1);
					newline = buffer.indexOf('\n');
					if (!line.startsWith('data:')) {
						continue;
					}
					const payload = line.slice(5).trim();
					if (payload === '[DONE]') {
						continue;
					}
					try {
						const parsed = JSON.parse(payload);
						const delta = parsed?.choices?.[0]?.delta?.content;
						if (typeof delta === 'string' && delta) {
							progress.report(new vscode.LanguageModelTextPart(delta));
						}
					} catch {
						// partial or keepalive frame
					}
				}
			}
		} finally {
			subscription.dispose();
		}
	}

	async provideTokenCount(_model: vscode.LanguageModelChatInformation, text: string | vscode.LanguageModelChatRequestMessage, _token: vscode.CancellationToken): Promise<number> {
		const raw = typeof text === 'string' ? text : text.content.map(textOf).join('');
		// No model tokenizer is available offline; CJK runs close to one token per character and
		// Latin near four characters per token, so weight by how much of the input is CJK. This
		// only feeds context-budget estimates.
		const cjk = (raw.match(/[㐀-鿿]/g) ?? []).length;
		const other = raw.length - cjk;
		return Math.max(1, Math.round(cjk + other / 4));
	}
}

export function registerProvider(context: vscode.ExtensionContext, log: vscode.LogOutputChannel): void {
	const provider = new OlympiaChatProvider(context, log);
	context.subscriptions.push(vscode.lm.registerLanguageModelChatProvider(VENDOR, provider));

	// A stale cache would hide a model the user just added at their provider, and a changed baseUrl
	// must never be served the previous host's list.
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('olympia.ai')) {
			provider.invalidateModelsCache();
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('olympia.coach.setApiKey', async () => {
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
		if (key === '') {
			await context.secrets.delete(KEY_SECRET);
			await vscode.window.showInformationMessage('已清除 API Key。');
			return;
		}
		await context.secrets.store(KEY_SECRET, key);
		const baseUrl = vscode.workspace.getConfiguration('olympia.ai').get<string>('baseUrl') ?? '(未设置)';
		await vscode.window.showInformationMessage(`API Key 已保存。请确认 baseUrl 正确：${baseUrl}`);
	}));
}
