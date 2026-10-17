/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  浏览器插件交题面进来的那份「合同」。
 *
 *  有些题面我们拉不到：学校 OJ 要先登录，洛谷团队赛要在自己账号的权限里。插件跑在用户已经
 *  登录的浏览器里，看到的正是编辑器看不到的那一面，所以让它把渲染好的题面交回来。
 *
 *  这一版只埋接口，不埋实现：一份带版本号的载荷、一套校验、一个写文件的入口，
 *  外加「写出来的文件必须能被题库读回来」这条不变量（`metaOf` 是唯一的验收人）。
 *  故意没有开任何监听——localhost 端口和 `olympia://` 深链都是同一台机器上任何网页都能敲的
 *  入口，等产品真要连接时再单独决定它长什么样、要不要问一句。插件眼下能用的交法只有把载荷
 *  交给 `HANDOFF_COMMAND` 那条命令（未来的桥接层来调），或按 `HANDOFF_DIR` 那个约定投递。
 *--------------------------------------------------------------------------------------------*/
import * as fs from 'fs';
import * as path from 'path';

import { FIELD, META_SEPARATOR, PROBLEM_ID, SAMPLES_SECTION, SAMPLE_HEADING, STATEMENT_EXTENSION, platformText } from './templates';
import { customSamplesOf, withCustomSamples } from './statementSamples';

/** 协议名与版本：插件那边写的必须和这里一模一样，对不上就整份退回，不猜。 */
export const HANDOFF_PROTOCOL = 'olympia.statementHandoff';
export const HANDOFF_VERSION = 1;
/** 接收命令的 id。没进命令面板（插件不是学生按的东西），但一直是可调的。 */
export const HANDOFF_COMMAND = 'olympia.problem.receiveHandoff';
/**
 * 投递目录的约定。写在这里是为了让「谁来读它」有个唯一答案——
 * 目前没有人在读：埋这个常量的作用是让将来加 watcher 的那一次不必再定一遍路径。
 */
export const HANDOFF_DIR = '.olympia/handoff';

/** 比这个还短的正文，多半是登录页或错误页，不是题面。 */
const MIN_MARKDOWN_CHARS = 80;
/** 一次交过来的样例上限：再多说明插件抓错了页面，而不是这道题真有这么多样例。 */
const MAX_SAMPLES = 20;

export interface HandoffSample {
	readonly input: string;
	readonly output: string;
}

export interface HandoffProblem {
	readonly id: string;
	readonly title: string;
	/** 平台原样字符串（`luogu` 或学校 OJ 自己起的名字都行）；已知的那几个会被念成中文。 */
	readonly platform?: string;
	readonly difficulty?: string;
	readonly timeLimit?: string;
	readonly memoryLimit?: string;
	readonly tags?: readonly string[];
	/** 用户当时打开的那一页——「打开原题网页」靠它，没有的话题库里这份就没有提交入口。 */
	readonly url?: string;
}

/** 插件交来的东西长这样。`markdown` 是正文，不含我们那两行页眉（页眉由这边生成）。 */
export interface StatementHandoff {
	readonly protocol: string;
	readonly version: number;
	readonly problem: HandoffProblem;
	readonly markdown: string;
	readonly samples?: readonly HandoffSample[];
	/** 插件抓这一页的时刻（ISO 字符串），只用于「这份题面多久了」，不参与判定。 */
	readonly fetchedAt?: string;
}

const text = (value: unknown): string | undefined => {
	const trimmed = typeof value === 'string' ? value.trim() : '';
	return trimmed || undefined;
};

export type HandoffRejection = { readonly ok: false; readonly reason: string };

/**
 * 校验一份外部载荷。任何一条不成立就整份退回，并说清是哪一条——
 * 插件是学生装的，它出错时学生看到的必须是「哪一步不对」，不是一个静默的失败。
 */
export function parseHandoff(raw: unknown): { readonly ok: true; readonly value: StatementHandoff } | HandoffRejection {
	if (typeof raw !== 'object' || raw === null) {
		return { ok: false, reason: '载荷不是一个对象：插件交上来的应当是一段 JSON。' };
	}
	const given = raw as Partial<StatementHandoff> & { problem?: unknown };
	if (given.protocol !== HANDOFF_PROTOCOL) {
		return { ok: false, reason: `这不是 Olympia 的题面载荷（协议字段是 ${JSON.stringify(given.protocol ?? null)}，应为 ${JSON.stringify(HANDOFF_PROTOCOL)}）。` };
	}
	if (given.version !== HANDOFF_VERSION) {
		return { ok: false, reason: `这份载荷是第 ${String(given.version)} 版，本产品只认第 ${HANDOFF_VERSION} 版——请把浏览器插件升到与编辑器配套的版本。` };
	}
	if (typeof given.problem !== 'object' || given.problem === null) {
		return { ok: false, reason: '载荷里没有 problem 那一段（题号、标题这些信息应该在它里面）。' };
	}
	const problem = given.problem as Partial<HandoffProblem>;
	const id = text(problem.id);
	if (!id) {
		return { ok: false, reason: '载荷里没有题号：题面库按题号认文件，缺了就无处可放。' };
	}
	// 题号会被拼成文件名，所以它必须长得像题号——规则与题库读标题时用的是同一条（templates.ts）。
	if (!PROBLEM_ID.test(id)) {
		return { ok: false, reason: `题号「${id}」不像一个题号（应为 P1001 / B3001 / ABC300_A 这一类），不能拿它当文件名。` };
	}
	const title = text(problem.title);
	if (!title) {
		return { ok: false, reason: `第 ${id} 题的载荷里没有标题。` };
	}
	const markdown = typeof given.markdown === 'string' ? given.markdown.trim() : '';
	if (markdown.length < MIN_MARKDOWN_CHARS) {
		return { ok: false, reason: `第 ${id} 题的正文只有 ${markdown.length} 个字符（少于 ${MIN_MARKDOWN_CHARS}）——多半抓到的是登录页或错误页，不是题面。` };
	}
	const samples = Array.isArray(given.samples) ? given.samples : [];
	if (samples.length > MAX_SAMPLES) {
		return { ok: false, reason: `第 ${id} 题一次交了 ${samples.length} 组样例（上限 ${MAX_SAMPLES}），更像抓错了页面。` };
	}
	const usable: HandoffSample[] = [];
	for (const item of samples) {
		const input = text((item as HandoffSample | undefined)?.input);
		const output = text((item as HandoffSample | undefined)?.output);
		if (input && output) {
			usable.push({ input, output });
		}
	}
	return {
		ok: true,
		value: {
			protocol: HANDOFF_PROTOCOL,
			version: HANDOFF_VERSION,
			problem: {
				id,
				title,
				platform: text(problem.platform),
				difficulty: text(problem.difficulty),
				timeLimit: text(problem.timeLimit),
				memoryLimit: text(problem.memoryLimit),
				tags: Array.isArray(problem.tags) ? problem.tags.map(String).filter(Boolean) : undefined,
				url: text(problem.url)
			},
			markdown,
			samples: usable.length ? usable : undefined,
			fetchedAt: text(given.fetchedAt)
		}
	};
}

/**
 * 把载荷写成一份题面 Markdown。页眉那两行的字段名全部取自 `FIELD`，
 * 分隔符取自 `META_SEPARATOR`——也就是说这份文件能被题库读回来，不是靠「照着抄一份格式」，
 * 而是靠它和读的那一边共用同一张表。
 */
export function renderHandoff(handoff: StatementHandoff): string {
	const { problem } = handoff;
	const meta: string[] = [];
	const platform = problem.platform ? platformText(problem.platform) : undefined;
	if (platform) {
		meta.push(`${FIELD.source}：${platform}`);
	}
	if (problem.difficulty) {
		meta.push(`${FIELD.difficulty}：${problem.difficulty}`);
	}
	if (problem.timeLimit) {
		meta.push(`${FIELD.timeLimit}：${problem.timeLimit}`);
	}
	if (problem.memoryLimit) {
		meta.push(`${FIELD.memoryLimit}：${problem.memoryLimit}`);
	}
	if (problem.tags?.length) {
		meta.push(`${FIELD.tags}：${problem.tags.join(' ')}`);
	}
	// 原文链接放在最后一项：题库读它，「打开原题网页」也读它，缺了那份题面就没有提交入口。
	if (problem.url) {
		meta.push(`${FIELD.sourceLink}：${problem.url}`);
	}

	const lines = [`# ${problem.id} ${problem.title}`, ''];
	if (meta.length) {
		lines.push(`> ${meta.join(META_SEPARATOR)}`, '');
	}
	// 正文里如果自带一级标题（插件常会连页面标题一起抓），去掉它，免得出现两个标题行。
	const body = handoff.markdown.replace(/^\s*#\s+.+\n+/, '');
	lines.push(body.trimEnd(), '');
	if (handoff.samples?.length) {
		lines.push('', SAMPLES_SECTION, '');
		handoff.samples.forEach((sample, index) => {
			lines.push(`${SAMPLE_HEADING} ${index + 1}`, '', '```input', sample.input.trimEnd(), '```', '', '```output', sample.output.trimEnd(), '```', '');
		});
	}
	return `${lines.join('\n').trimEnd()}\n`;
}

/**
 * 写进题面库。已有一份时，学生自己补过的样例会被带过来——和在线拉取走的是同一条保样例逻辑。
 * 返回写成的那个文件路径。
 */
export async function writeHandoff(handoff: StatementHandoff, root: string): Promise<string> {
	await fs.promises.mkdir(root, { recursive: true });
	const file = path.join(root, `${handoff.problem.id}${STATEMENT_EXTENSION}`);
	// 与在线拉取同一条保样例逻辑：学生自己补过的样例，重新交一份不能把它们冲掉。
	const previous = await fs.promises.readFile(file, 'utf8').catch(() => '');
	const custom = previous ? customSamplesOf(previous) : [];
	await fs.promises.writeFile(file, withCustomSamples(renderHandoff(handoff), custom), 'utf8');
	return file;
}
