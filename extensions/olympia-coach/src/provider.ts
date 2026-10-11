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

interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

interface TextPartLike { value: string }

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

	constructor(private readonly context: vscode.ExtensionContext) { }

	private async credentials(): Promise<{ baseUrl: string; key: string } | undefined> {
		const baseUrl = (vscode.workspace.getConfiguration('olympia.ai').get<string>('baseUrl') ?? '').replace(/\/+$/, '');
		const key = (await this.context.secrets.get(KEY_SECRET)) ?? '';
		if (!baseUrl || !key) {
			return undefined;
		}
		return { baseUrl, key };
	}

	private configuredModels(): string[] {
		const models = vscode.workspace.getConfiguration('olympia.ai').get<string[]>('models');
		return Array.isArray(models) && models.length ? models : DEFAULT_MODELS;
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

	async provideLanguageModelChatInformation(_options: vscode.PrepareLanguageModelChatModelOptions, _token: vscode.CancellationToken): Promise<vscode.LanguageModelChatInformation[]> {
		if (!await this.credentials()) {
			// Silent calls happen while core warms up; prompting there would be noise.
			return [];
		}
		return this.configuredModels().map(id => ({
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

export function registerProvider(context: vscode.ExtensionContext): void {
	context.subscriptions.push(vscode.lm.registerLanguageModelChatProvider(VENDOR, new OlympiaChatProvider(context)));

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
