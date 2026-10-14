/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  题面抓回来之后的 AI 补空（移植自退役 Tauri 版的 `frontend/src-tauri/src/enrich.rs`）。
 *
 *  爬虫碰上网站改版就会漏掉样例、说明、输入输出格式。这时候叫一次用户自己配的模型，
 *  让它把原文抽成一个 JSON 对象，然后**只往空着的字段里填**：抓回来有内容的地方永远
 *  以抓回来的为准。洛谷的题面是从页面里的 JSON 直接取的，除了提示以外都在，那就已经
 *  算抓全了——空提示不该触发一次改写，否则模型会往一份完整题面里塞它自己写的提示。
 *
 *  任何一次失败都只是「没有 AI 这一趟」：没有密钥、服务没配、命令没注册、教练扩展没装、
 *  模型回的是散文、整轮超时——爬虫拿到那份照样写进文件，导入既不报错也不卡住。
 *
 *  HTTP 调用不在这里：API 密钥存在 olympia-coach 的 SecretStorage 里，`context.secrets`
 *  是每扩展隔离的，本扩展读不到，所以只通过一条命令跨过边界（`EXTRACT_COMMAND`）。
 *  那个扩展的对应实现是 `olympia-coach/src/extract.ts`。
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import type { Problem, Sample } from './sources';

/** 抽取命令由 olympia-coach 注册；两个自建扩展之间能共享的只有命令，所以这里只能把 id 写第二遍。 */
export const EXTRACT_COMMAND = 'olympia.ai.extract';

/** product.json 的 `defaultChatAgent.providerExtensionId` 用的就是这个 id；命令在那边，得先把它叫起来。 */
export const COACH_EXTENSION_ID = 'olympia.olympia-coach';

/**
 * 题面短到不足这个数就当是抓漏了一截（旧版按 80 字节判，这里按字符判）。
 * 只有 HTML 那几个来源用得上这条：洛谷给的是结构化 JSON，短题面就是题本身短。
 */
export const MIN_STATEMENT_CHARS = 80;

/** 补完了哪几块，就说哪几块的名字——通知栏那行字要说的就是它。 */
export const FIELD_LABEL = {
	statement: '题面',
	inputFormat: '输入格式',
	outputFormat: '输出格式',
	hint: '提示',
	samples: '样例',
} as const;

/** 命令那头的返回值（形状和 `olympia-coach/src/extract.ts` 里的一致）。 */
export type ExtractReply =
	| { readonly ok: true; readonly fields?: ExtractedFields; readonly model?: string }
	| { readonly ok: false; readonly reason?: string };

export interface ExtractedSample {
	input: string;
	output: string;
	explain?: string;
}

export interface ExtractedFields {
	statement?: string;
	inputFormat?: string;
	outputFormat?: string;
	hint?: string;
	samples?: ExtractedSample[];
}

/** 旧版 ingest 写「Luogu」、更早的存档写「洛谷」，本平台 id 是小写的：三种写法都算洛谷。 */
function isLuogu(problem: Problem): boolean {
	const labels: string[] = ['luogu', 'Luogu', '洛谷'];
	return labels.includes(problem.platform);
}

const blank = (text: string | undefined): boolean => !text || !text.trim();

/**
 * 值不值得为这道题去问一次模型。metadataOnly 直接跳过：根本没有抓回来的正文可抽，
 * 而现有的流程已经会问「要不要在浏览器里打开原题」了。
 */
export function needsEnrichment(problem: Problem): boolean {
	if (problem.metadataOnly) { return false; }
	// 正文都没抓到：无从抽起，问了也是白问。
	if (blank(problem.statement)) { return false; }
	if (blank(problem.inputFormat) || blank(problem.outputFormat)) { return true; }
	if (!problem.samples.length || problem.samples.some(sample => blank(sample.input) || blank(sample.output))) { return true; }
	// 到这里只剩「除了提示以外都齐」这一种情况：洛谷就此收手，别的来源再补一次提示。
	if (isLuogu(problem)) { return false; }
	if (blank(problem.hint)) { return true; }
	return problem.statement.trim().length < MIN_STATEMENT_CHARS;
}

/**
 * 只填空着（或明显残缺）的字段，返回补了哪几块——空数组就是什么都没动过。
 * 这里不碰 vscode，所以检查台可以直接驱动它。
 */
export function mergeExtracted(problem: Problem, fields: ExtractedFields): string[] {
	const filled: string[] = [];

	const statement = typeof fields.statement === 'string' ? fields.statement.trim() : '';
	const scraped = problem.statement.trim();
	if (statement && (blank(scraped) || scraped.length < MIN_STATEMENT_CHARS)) {
		problem.statement = statement;
		filled.push(FIELD_LABEL.statement);
	}

	for (const key of ['inputFormat', 'outputFormat', 'hint'] as const) {
		const raw = fields[key];
		const value = typeof raw === 'string' ? raw.trim() : '';
		if (value && blank(problem[key])) {
			problem[key] = value;
			filled.push(FIELD_LABEL[key]);
		}
	}

	const incoming = (Array.isArray(fields.samples) ? fields.samples : [])
		.filter(sample => sample && (!blank(sample.input) || !blank(sample.output)));
	if (!incoming.length) { return filled; }

	const allBlank = !problem.samples.length || problem.samples.every(sample => blank(sample.input) && blank(sample.output));
	if (allBlank) {
		problem.samples = incoming.map<Sample>(sample => sample.explain
			? { input: sample.input, output: sample.output, explain: sample.explain }
			: { input: sample.input, output: sample.output });
		filled.push(FIELD_LABEL.samples);
		return filled;
	}
	// 已经有成型的样例了：那只往现有那几对的空格里填，多出来的整组一律不要。
	let touched = false;
	problem.samples.forEach((sample, index) => {
		const source = incoming[index];
		if (!source) { return; }
		if (blank(sample.input) && !blank(source.input)) { sample.input = source.input; touched = true; }
		if (blank(sample.output) && !blank(source.output)) { sample.output = source.output; touched = true; }
		if (!sample.explain && source.explain) { sample.explain = source.explain; touched = true; }
	});
	if (touched) { filled.push(FIELD_LABEL.samples); }
	return filled;
}

/**
 * 叫一次抽取、把结果并回去，返回补了哪几块（没人补就回空数组）。
 * 这一趟什么都不会抛出去：coach 没装、命令没注册、模型离线，都只是「没有 AI 这一趟」。
 */
export async function enrichProblem(problem: Problem): Promise<string[]> {
	if (!needsEnrichment(problem)) { return []; }
	const request = { id: problem.id, platform: problem.platform as string, title: problem.title, text: problem.statement };
	let reply: ExtractReply | undefined;
	try {
		// 命令是教练那边注册的，没激活就先激活；它回什么、为什么回不了，都由那边写进日志。
		await vscode.extensions.getExtension(COACH_EXTENSION_ID)?.activate();
		reply = await vscode.commands.executeCommand(EXTRACT_COMMAND, request) as ExtractReply | undefined;
	} catch {
		return [];
	}
	if (!reply || reply.ok !== true) { return []; }
	return mergeExtracted(problem, reply.fields ?? {});
}
