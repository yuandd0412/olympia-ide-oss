/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  题面字段抽取：抓取之后的一次「只补空」请求，由 olympia-contest 通过命令叫起来。
 *
 *  为什么 HTTP 调用在这边而不在 contest 那边：API 密钥只存在本扩展的 SecretStorage
 *  （`KEY_SECRET`），而 `context.secrets` 是每扩展隔离的，olympia-contest 读不到它。
 *  两个自建扩展之间能共享的只有命令，所以这里注册一条，那边只管叫、只管收结果。
 *
 *  行为照搬退役的 Tauri 版（`frontend/src-tauri/src/enrich.rs`）：
 *   * 只交回能对上白名单的字段，填不填、盖不盖由调用方判断——抓回来的原文永远优先。
 *   * 任何失败都退化成了「爬虫拿到的那份照样算数」：没有密钥、没有地址、HTTP 报错、
 *     回的是散文、超时，全部只留一行日志，命令本身永不抛。拉题面不能因为模型离线而
 *     报错，也不能因为模型慢就卡住。
 *   * 严格请求（带 `response_format: json_object`）只试一次。有些自建网关直接拒收这个
 *     字段，另一些收下它却照样回散文，所以两种情况都得把它去掉再问一次；两次共用一个
 *     总预算。
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import {
	CHOSEN_MODEL_STATE_KEY, ERROR_SNIPPET_LEN, EXTRACT_COMMAND, EXTRACT_INPUT_CHAR_CAP,
	EXTRACT_MAX_TOKENS, EXTRACT_SYSTEM_PROMPT, EXTRACT_TEMPERATURE, EXTRACT_TOTAL_BUDGET_MS,
	FALLBACK_CHAT_MODELS, KEY_SECRET
} from './constants';
import { probeModels, readBaseUrl } from './provider';

/** 调用方给来的原料：只有 `text` 会进提示词，而且先截断。 */
export interface ExtractRequest {
	readonly id?: string;
	readonly platform?: string;
	readonly title?: string;
	readonly text?: string;
}

export interface ExtractedSample {
	input: string;
	output: string;
	explain?: string;
}

/** 白名单以后的字段：边界另一侧也只认这几个键。 */
export interface ExtractedFields {
	statement?: string;
	inputFormat?: string;
	outputFormat?: string;
	hint?: string;
	samples?: ExtractedSample[];
}

/** 命令的返回值。抛出去的东西没人接得住，所以失败也以值的形式交回去。 */
export type ExtractResult =
	| { readonly ok: true; readonly fields: ExtractedFields; readonly model: string }
	| { readonly ok: false; readonly reason: string };

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

function asObject(value: unknown): Record<string, unknown> | undefined {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? value as Record<string, unknown>
		: undefined;
}

/**
 * 模型很少老老实实只回一段 JSON：多半套着 ```json 围栏，或者前后加两句客套话。
 * 先剥围栏，剥完还不是 JSON 就退到最外层那对 `{…}` 再试一次——旧版就是这么读的。
 */
export function extractJsonObject(text: string): Record<string, unknown> | undefined {
	const bare = text.trim()
		.replace(/^```(?:json|JSON)?[ \t]*\r?\n?/, '')
		.replace(/\r?\n?```[ \t]*\s*$/, '');
	const direct = asObject(parseJson(bare.trim()));
	if (direct) {
		return direct;
	}
	const start = bare.indexOf('{');
	const end = bare.lastIndexOf('}');
	if (start < 0 || end <= start) {
		return undefined;
	}
	return asObject(parseJson(bare.slice(start, end + 1)));
}

/** 按码位截断：切在半个 emoji 上会让后面那串 JSON 直接坏掉。 */
function capInput(text: string): string {
	const chars = [...text];
	return chars.length <= EXTRACT_INPUT_CHAR_CAP ? text : `${chars.slice(0, EXTRACT_INPUT_CHAR_CAP).join('')}…`;
}

/** 要的正好是那一个 JSON 对象，字段规则同旧版 `build_prompt`。 */
export function buildExtractPrompt(request: ExtractRequest): string {
	const meta = [request.platform ?? '未知来源', request.id ?? '', request.title ?? ''].filter(part => part).join(' ');
	return [
		'你是竞赛题目结构化抽取器。根据下面的题目原文，输出**仅含 JSON**（无 markdown 围栏、无解释），字段如下：',
		'',
		'{',
		'  "statement": "完整题面（保留题意，公式可用 $...$；不要包含输入格式、输出格式与样例这些小节）",',
		'  "inputFormat": "输入格式（纯文本）",',
		'  "outputFormat": "输出格式（纯文本）",',
		'  "samples": [{"input": "...", "output": "..."}],',
		'  "hint": "提示 / Note / 特殊说明 / 数据范围补充；没有则空字符串"',
		'}',
		'',
		'规则：',
		'- 样例必须成对；无法确定输出时可省略 samples 或留空数组。',
		'- 不要编造样例。原文缺失的信息对应字段留空字符串 []。',
		'- 输出必须是合法 JSON。',
		'',
		`【元数据】${meta}`,
		'【题面原文开始】',
		capInput(request.text ?? ''),
		'【题面原文结束】',
	].join('\n');
}

/**
 * 只认白名单里的键，字符串一律去过首尾空白再交出去；模型自己加的字段（难度、时限、
 * 它想顺带改的题号）一个都不带进题面文件。样例里输入输出全空的那种空壳也丢掉。
 */
export function sanitizeFields(obj: Record<string, unknown>): ExtractedFields {
	const fields: ExtractedFields = {};
	for (const key of ['statement', 'inputFormat', 'outputFormat', 'hint'] as const) {
		const value = obj[key];
		if (typeof value === 'string') {
			fields[key] = value.trim();
		}
	}
	if (Array.isArray(obj.samples)) {
		const kept: ExtractedSample[] = [];
		for (const row of obj.samples) {
			const item = asObject(row);
			if (!item) {
				continue;
			}
			const input = typeof item.input === 'string' ? item.input.trim() : '';
			const output = typeof item.output === 'string' ? item.output.trim() : '';
			if (!input && !output) {
				continue;
			}
			const explain = typeof item.explain === 'string' ? item.explain.trim() : '';
			kept.push(explain ? { input, output, explain } : { input, output });
		}
		fields.samples = kept;
	}
	return fields;
}

/** 用户点过的那个 > 服务端列表里的第一个 > 兜底名字：抽取不该为「用哪个模型」再问一次。 */
async function pickModel(context: vscode.ExtensionContext): Promise<string> {
	const chosen = context.globalState.get<string>(CHOSEN_MODEL_STATE_KEY);
	if (chosen && chosen.trim()) {
		return chosen.trim();
	}
	const probe = await probeModels(context);
	const first = probe.ids.find(id => typeof id === 'string' && !!id.trim());
	return first ? first.trim() : FALLBACK_CHAT_MODELS[0];
}

/** 一次抽取请求；`strict` 就是带上 `response_format`。失败一律抛，由叫起来的那两层决定要不要重试。 */
async function askOnce(baseUrl: string, key: string, model: string, prompt: string, strict: boolean, timeoutMs: number): Promise<string> {
	const body: Record<string, unknown> = {
		model,
		messages: [
			{ role: 'system', content: EXTRACT_SYSTEM_PROMPT },
			{ role: 'user', content: prompt },
		],
		temperature: EXTRACT_TEMPERATURE,
		max_tokens: EXTRACT_MAX_TOKENS,
		stream: false,
	};
	if (strict) {
		body.response_format = { type: 'json_object' };
	}
	let response: Response;
	try {
		response = await fetch(`${baseUrl}/chat/completions`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(timeoutMs),
		});
	} catch (error) {
		throw new Error(`连不上：${error instanceof Error ? error.message : String(error)}`);
	}
	if (!response.ok) {
		const detail = await response.text().catch(() => '');
		throw new Error(`服务返回 HTTP ${response.status} ${detail.slice(0, ERROR_SNIPPET_LEN)}`.trim());
	}
	const reply = parseJson(await response.text());
	const content = asObject(reply)?.choices;
	const first = Array.isArray(content) ? asObject(content[0]) : undefined;
	const text = asObject(first?.message)?.content;
	if (typeof text !== 'string' || !text.trim()) {
		throw new Error('回复里没有内容');
	}
	return text;
}

async function extractFields(context: vscode.ExtensionContext, log: vscode.LogOutputChannel, request: ExtractRequest): Promise<ExtractResult> {
	const baseUrl = readBaseUrl();
	if (!baseUrl) {
		return { ok: false, reason: '还没有填写服务地址（baseUrl）' };
	}
	const key = (await context.secrets.get(KEY_SECRET)) ?? '';
	if (!key.trim()) {
		return { ok: false, reason: '还没有设置 API 密钥' };
	}
	const model = await pickModel(context);
	// 两次请求共用这一个预算：预算用剩多少就只给多少，慢服务最多把这一趟拖到 EXTRACT_TOTAL_BUDGET_MS。
	const deadline = Date.now() + EXTRACT_TOTAL_BUDGET_MS;
	const prompt = buildExtractPrompt(request);
	const remaining = () => Math.max(1, deadline - Date.now());

	let strictFailure = '';
	try {
		const reply = await askOnce(baseUrl, key, model, prompt, true, remaining());
		const obj = extractJsonObject(reply);
		if (obj) {
			log.info(`题面抽取 ${request.id ?? ''}：严格请求就拿到了 JSON（模型 ${model}）`);
			return { ok: true, fields: sanitizeFields(obj), model };
		}
		strictFailure = '带了 response_format 却仍然回散文';
	} catch (error) {
		strictFailure = error instanceof Error ? error.message : String(error);
	}

	// 兜底那一次：同一个问题、不带 response_format。有些网关就是认这个组合。
	let reply: string;
	try {
		reply = await askOnce(baseUrl, key, model, prompt, false, remaining());
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		log.warn(`题面抽取 ${request.id ?? ''}失败：${detail}（严格请求：${strictFailure}）`);
		return { ok: false, reason: detail };
	}
	const obj = extractJsonObject(reply);
	if (!obj) {
		log.debug(`题面抽取 ${request.id ?? ''}：模型回的不是 JSON，保持爬虫抓到的字段`);
		return { ok: false, reason: '模型回的不是 JSON' };
	}
	log.info(`题面抽取 ${request.id ?? ''}：去掉了 response_format 才拿到 JSON（模型 ${model}）`);
	return { ok: true, fields: sanitizeFields(obj), model };
}

export function registerExtractCommand(context: vscode.ExtensionContext, log: vscode.LogOutputChannel): void {
	context.subscriptions.push(vscode.commands.registerCommand(EXTRACT_COMMAND, async (request?: ExtractRequest): Promise<ExtractResult> => {
		try {
			return await extractFields(context, log, request ?? {});
		} catch (error) {
			// 命令不许抛：叫起它的那趟是「拉题面」，模型离线不该让它变成一次失败的导入。
			const reason = error instanceof Error ? error.message : String(error);
			log.warn(`题面抽取失败：${reason}`);
			return { ok: false, reason };
		}
	}));
}
