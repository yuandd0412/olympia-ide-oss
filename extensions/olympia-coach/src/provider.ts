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
//
// Listing models is factored into probeModels() so the provider and the settings UI ask the
// same question and get the same answer, including why a listing failed.

import * as vscode from 'vscode';
import {
	CONFIG_SECTION, BASE_URL_SETTING, MODELS_SETTING, KEY_SECRET, VENDOR, VENDOR_LABEL,
	FALLBACK_CHAT_MODELS, MODELS_CACHE_MS, MODELS_TIMEOUT_MS, MAX_INPUT_TOKENS, MAX_OUTPUT_TOKENS,
	ERROR_SNIPPET_LEN, LATIN_CHARS_PER_TOKEN
} from './constants';

// Endpoints that answer 401 rather than 404 for `/models` (verified against api.deepseek.com on
// 2026-10-11), but the response shape is not documented, so the parse accepts whatever an
// OpenAI-compatible server returns instead of betting on one key name.
const NON_CHAT_ID_HINTS = ['embedding', 'rerank', 'rewriter', 'rewrite', 'moderation', 'tts', 'whisper', 'ocr', 'translator', 'search'];

interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

interface TextPartLike { value: string }

interface ModelRow { id?: unknown; model?: unknown; name?: unknown }

interface ModelsPayload { data?: unknown; models?: unknown }

interface ModelsCache { baseUrl: string; at: number; ids: string[] }

/** Where the model list currently comes from, and what went wrong when it does not. */
export interface ModelProbe {
	ok: boolean;
	source: 'manual' | 'remote' | 'cache' | 'none';
	baseUrl: string;
	hasKey: boolean;
	ids: string[];
	status?: number;
	error?: string;
	cacheAgeSeconds?: number;
}

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

function textOf(part: unknown): string {
	if (typeof part === 'string') {
		return part;
	}
	return isTextPartLike(part) ? part.value : '';
}

function isTextPartLike(part: unknown): part is TextPartLike {
	return typeof part === 'object' && part !== null && typeof (part as TextPartLike).value === 'string';
}

export function readBaseUrl(): string {
	return (vscode.workspace.getConfiguration(CONFIG_SECTION).get<string>(BASE_URL_SETTING) ?? '').trim().replace(/\/+$/, '');
}

// Empty means "ask the server", which is the default; a non-empty list wins outright so the
// coach still works with no network round-trip and with a gateway that has no /models route.
export function readManualModels(): string[] {
	const models = vscode.workspace.getConfiguration(CONFIG_SECTION).get<string[]>(MODELS_SETTING);
	return Array.isArray(models) ? models.filter(id => typeof id === 'string' && !!id.trim()) : [];
}

async function readKey(context: vscode.ExtensionContext): Promise<string> {
	return (await context.secrets.get(KEY_SECRET)) ?? '';
}

let modelsCache: ModelsCache | undefined;

/** Drops the cached listing so the next ask goes back to the server. */
export function invalidateModelsCache(): void {
	modelsCache = undefined;
}

/**
 * Asks the configured endpoint what models exist, without guessing on the user's behalf: an
 * unconfigured or unreachable service is reported, never papered over with a made-up model.
 * The caller shows or logs `error`; nothing here pops a prompt, because core warms up silently.
 */
export async function probeModels(context: vscode.ExtensionContext, options?: { force?: boolean }): Promise<ModelProbe> {
	const baseUrl = readBaseUrl();
	const key = await readKey(context);
	const manual = readManualModels();
	if (manual.length) {
		return { ok: true, source: 'manual', baseUrl, hasKey: !!key, ids: manual };
	}
	if (!baseUrl) {
		return { ok: false, source: 'none', baseUrl, hasKey: !!key, ids: [], error: '还没有填写服务地址（baseUrl）' };
	}
	const cached = modelsCache;
	const cacheAgeSeconds = cached && cached.baseUrl === baseUrl ? Math.round((Date.now() - cached.at) / 1000) : undefined;
	if (!options?.force && cached && cached.baseUrl === baseUrl && (cacheAgeSeconds ?? 0) * 1000 < MODELS_CACHE_MS && cached.ids.length) {
		return { ok: true, source: 'cache', baseUrl, hasKey: !!key, ids: cached.ids, cacheAgeSeconds };
	}
	const headers: Record<string, string> = key ? { authorization: `Bearer ${key}` } : {};
	let response: Response;
	try {
		response = await fetch(`${baseUrl}/models`, { method: 'GET', signal: AbortSignal.timeout(MODELS_TIMEOUT_MS), headers });
	} catch (error) {
		return { ok: false, source: 'none', baseUrl, hasKey: !!key, ids: [], error: `连不上：${error instanceof Error ? error.message : String(error)}` };
	}
	if (!response.ok) {
		return {
			ok: false, source: 'none', baseUrl, hasKey: !!key, ids: [], status: response.status,
			error: `服务返回 HTTP ${response.status}${response.status === 401 ? '（密钥无效或未发送）' : ''}`
		};
	}
	let ids: string[];
	try {
		ids = parseModelIds(JSON.parse(await response.text()));
	} catch {
		return { ok: false, source: 'none', baseUrl, hasKey: !!key, ids: [], status: response.status, error: '返回的内容不是 JSON，无法解析模型列表' };
	}
	if (!ids.length) {
		return { ok: false, source: 'none', baseUrl, hasKey: !!key, ids: [], status: response.status, error: '返回 200，但里面没有可用的模型 id（可能是网关只支持 /chat/completions）' };
	}
	modelsCache = { baseUrl, at: Date.now(), ids };
	return { ok: true, source: 'remote', baseUrl, hasKey: !!key, ids };
}

export class OlympiaChatProvider implements vscode.LanguageModelChatProvider {

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly log: vscode.LogOutputChannel
	) { }

	async provideLanguageModelChatInformation(_options: vscode.PrepareLanguageModelChatModelOptions, _token: vscode.CancellationToken): Promise<vscode.LanguageModelChatInformation[]> {
		const baseUrl = readBaseUrl();
		const key = await readKey(this.context);
		if (!baseUrl || !key) {
			// Silent calls happen while core warms up; prompting there would be noise.
			return [];
		}
		const probe = await probeModels(this.context);
		if (!probe.ok) {
			this.log.warn(`${probe.error ?? '未知原因'}；回落到内置模型列表，可在 Olympia AI 设置里手动指定。`);
		} else if (probe.source === 'remote') {
			this.log.info(`已从 ${probe.baseUrl}/models 读到 ${probe.ids.length} 个模型`);
		}
		const ids = probe.ids.length ? probe.ids : [...FALLBACK_CHAT_MODELS];
		return ids.map(id => ({
			vendor: VENDOR,
			id,
			name: id,
			family: 'Olympia',
			version: '1',
			maxInputTokens: MAX_INPUT_TOKENS,
			maxOutputTokens: MAX_OUTPUT_TOKENS,
			capabilities: { toolCalling: false, imageInput: false },
			tooltip: id,
			detail: `通过 ${VENDOR_LABEL} 调用`
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
		const baseUrl = readBaseUrl();
		const key = await readKey(this.context);
		if (!baseUrl || !key) {
			throw new Error(`${VENDOR_LABEL}: 缺少 baseUrl 或 API Key，请在 Olympia AI 设置里填写`);
		}
		const abort = new AbortController();
		const subscription = token.onCancellationRequested(() => abort.abort());
		try {
			const response = await fetch(`${baseUrl}/chat/completions`, {
				method: 'POST',
				signal: abort.signal,
				headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
				body: JSON.stringify({ model: model.id, stream: true, messages: this.toChatMessages(messages) })
			});
			if (!response.ok || !response.body) {
				const snippet = (await response.text()).slice(0, ERROR_SNIPPET_LEN);
				throw new Error(`${VENDOR_LABEL}: HTTP ${response.status} ${snippet}`);
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
		return Math.max(1, Math.round(cjk + other / LATIN_CHARS_PER_TOKEN));
	}
}

export async function setApiKey(context: vscode.ExtensionContext, key: string): Promise<void> {
	if (key) {
		await context.secrets.store(KEY_SECRET, key);
	} else {
		await context.secrets.delete(KEY_SECRET);
	}
	invalidateModelsCache();
}

/** Last few characters, safe to show; the key itself never leaves SecretStorage. */
export async function apiKeyTail(context: vscode.ExtensionContext): Promise<string> {
	const key = (await context.secrets.get(KEY_SECRET)) ?? '';
	return key.length <= 4 ? '' : key.slice(-4);
}

export function registerProvider(context: vscode.ExtensionContext, log: vscode.LogOutputChannel): void {
	const provider = new OlympiaChatProvider(context, log);
	context.subscriptions.push(vscode.lm.registerLanguageModelChatProvider(VENDOR, provider));

	// A stale cache would hide a model the user just added at their provider, and a changed baseUrl
	// must never be served the previous host's list.
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration(CONFIG_SECTION)) {
			invalidateModelsCache();
		}
	}));
}
