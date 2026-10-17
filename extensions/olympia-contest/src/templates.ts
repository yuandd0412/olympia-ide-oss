/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  赛制模板: ACM 赛制 (单文件 judge) 与 IOI 赛制 (函数接口 + grader).
 *
 *  Both are the shape Chinese OI training expects: 洛谷/Codeforces 用 ACM 模板，NOIP/省选用
 *  IOI 模板（函数实现 + 评测机调用）。The templates are intentionally plain C++17 so they
 *  compile with the bundled toolchain without extra flags.
 *--------------------------------------------------------------------------------------------*/

export type ContestFormat = 'acm' | 'ioi';

export const ACM_TEMPLATE = `// Olympia ACM 赛制模板 — C++17
#include <bits/stdc++.h>
using namespace std;

using ll = long long;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // TODO: 在这里读入并求解
    int n;
    cin >> n;

    // TODO: 在这里输出答案

    return 0;
}
`;

export const IOI_TEMPLATE = `// Olympia IOI 赛制模板 — C++17
// 评测机通过下面的接口调用你的实现，不要写 main 函数。
#include <bits/stdc++.h>
using namespace std;

using ll = long long;

// TODO: 把下面这个函数替换成题目要求的签名
ll solve(vector<int> a) {
    ll ans = 0;
    for (int x : a) { ans += x; }
    return ans;
}
`;

export function templateFor(format: ContestFormat): string {
	return format === 'ioi' ? IOI_TEMPLATE : ACM_TEMPLATE;
}

export const FORMAT_LABEL: Record<ContestFormat, string> = {
	acm: 'ACM 赛制（单文件 main.cpp）',
	ioi: 'IOI 赛制（函数接口 + 评测机）',
};

/**
 * 学生自己那份模板放在工程里，不在设置里：一个 .cpp 文件他能直接打开改、直接看效果，
 * 比让他在 settings.json 里手写带 `\n` 的字符串现实得多，而且跟着文件夹走到机房。
 */
export const TEMPLATE_FOLDER = '.olympia';
export const TEMPLATE_FILE = 'template.cpp';
/** 题面默认目录：跟着 Olympia 那个文件夹走，改一处就整个产品一起挪。 */
export const DEFAULT_PROBLEMS_DIR = `${TEMPLATE_FOLDER}/problems`;
export const MY_TEMPLATE_LABEL = '我的模板';
export const MY_TEMPLATE_HINT = `${TEMPLATE_FOLDER}/${TEMPLATE_FILE}，你自己写的那份`;

/** sample cases rendered as a fenced block, ready to paste next to the statement */
export function renderSamples(samples: { input: string; output: string; explain?: string }[]): string {
	if (!samples.length) { return ''; }
	const out: string[] = [SAMPLES_SECTION, ''];
	samples.forEach((s, i) => {
		out.push(renderSampleBlock(i + 1, s), '');
	});
	return out.join('\n');
}

/**
 * 一组样例长什么样。拉题面写样例、对拍补样例都从这里出：
 * 跑样例那头是按同样的标记读回来的（`### 样例 N` + `**输入**` / `**输出**`），
 * 两处各写一遍迟早会对不上。
 */
export function renderSampleBlock(index: number, sample: { input: string; output: string; explain?: string }): string {
	const out: string[] = [`${SAMPLE_HEADING} ${index}`, ''];
	out.push(`**${CASE_INPUT}**`, '', '```', sample.input, '```', '');
	out.push(`**${CASE_OUTPUT}**`, '', '```', sample.output, '```', '');
	if (sample.explain) { out.push(`**${CASE_EXPLAIN}**：${sample.explain}`, ''); }
	return out.join('\n');
}

/** 样例块里的三个字段名，和 `renderSampleBlock` 用的是同一份。 */
export const CASE_INPUT = '输入';
export const CASE_OUTPUT = '输出';
export const CASE_EXPLAIN = '说明';

export interface ParsedSample {
	readonly number: number;
	readonly input: string;
	readonly output: string;
	readonly explain: string;
}

/**
 * 把题面里已有的每组样例读回来（写的时候用的就是上面那几个常量，所以读也按同一张表）。
 * 只有一处需要它：重新拉题面时要把学生自己加的样例搬回新文件里。
 */
export function parseSampleBlocks(markdown: string): ParsedSample[] {
	const blocks = markdown.matchAll(new RegExp(`${SAMPLE_HEADING}\\s*(\\d+)([\\s\\S]*?)(?=\\n${SAMPLE_HEADING}|\\n##\\s|$)`, 'g'));
	const parsed: ParsedSample[] = [];
	for (const block of blocks) {
		const body = block[2] ?? '';
		const fields = [...body.matchAll(new RegExp(`\\*\\*(${CASE_INPUT}|${CASE_OUTPUT}|${CASE_EXPLAIN})\\*\\*\\s*\\r?\\n\\s*(?:\`{3}[^\\n]*\\r?\\n([\\s\\S]*?)\`{3}|([^\\n]*))`, 'g'))];
		const field = (name: string): string => {
			const found = fields.find(entry => entry[1] === name);
			return (found?.[2] ?? found?.[3] ?? '').trim();
		};
		parsed.push({
			number: Number(block[1]) || parsed.length + 1,
			input: field(CASE_INPUT),
			output: field(CASE_OUTPUT),
			explain: field(CASE_EXPLAIN),
		});
	}
	return parsed;
}

export function renderStatement(p: {
	id: string; title: string; url: string; platform: string;
	statement: string; inputFormat: string; outputFormat: string;
	hint: string; tags: string[]; difficulty?: string;
	timeLimit?: string; memoryLimit?: string; contest?: string;
	samples: { input: string; output: string; explain?: string }[];
}): string {
	const L: string[] = [];
	L.push(`# ${p.id} ${p.title}`, '');
	const meta: string[] = [`${FIELD.source}：${platformText(p.platform)}`];
	if (p.difficulty) { meta.push(`${FIELD.difficulty}：${p.difficulty}`); }
	if (p.timeLimit) { meta.push(`${FIELD.timeLimit}：${p.timeLimit}`); }
	if (p.memoryLimit) { meta.push(`${FIELD.memoryLimit}：${p.memoryLimit}`); }
	if (p.tags.length) { meta.push(`${FIELD.tags}：${p.tags.join('、')}`); }
	L.push(`> ${meta.join(' ｜ ')}`, `> ${FIELD.sourceLink}：${p.url}`, '');
	L.push('## 题目描述', '', p.statement || '_（未能解析出题面，请点击原文链接查看）_', '');

	if (p.inputFormat) { L.push('## 输入格式', '', p.inputFormat, ''); }
	if (p.outputFormat) { L.push('## 输出格式', '', p.outputFormat, ''); }

	const samples = renderSamples(p.samples);
	if (samples) { L.push(samples, ''); }
	if (p.hint) { L.push('## 说明 / 提示', '', p.hint, ''); }

	L.push('---', '', `由 Olympia 竞赛助手于 ${new Date().toLocaleString('zh-CN')} 拉取。`);
	return L.join('\n');
}

/**
 * 题面文件里写平台名而不是内部 id：学生打开 `.olympia/problems/P1001.md` 看到的应该是「来源：洛谷」。
 * 这张表同时供拉题面的界面文案用，两处共用一个来源。
 */
export const PLATFORM_TEXT: Record<string, string> = {
	luogu: '洛谷',
	codeforces: 'Codeforces',
	atcoder: 'AtCoder',
};

export const platformText = (platform: string): string => PLATFORM_TEXT[platform] ?? platform;

/**
 * 题面 Markdown 的字段名。写的人（`renderStatement`）和读的人（本地题库）共用这一张表：
 * 改了字段名只改这里，否则题库会静默读不出标题，页面上只剩一个题号。
 */
export const FIELD = { source: '来源', difficulty: '难度', timeLimit: '时限', memoryLimit: '内存', tags: '标签', sourceLink: '原文链接' } as const;
/** 题面文件的后缀：写下它的是 `renderStatement` 那条路，读回来的是题面库，两边共用这一个值。 */
export const STATEMENT_EXTENSION = '.md';
export const SAMPLE_HEADING = '### 样例';
/** 样例区的小节标题；补样例时要找的就是它。 */
export const SAMPLES_SECTION = '## 样例数据';
/** 元信息行里各字段之间的分隔符：写题面的、读题面的、侧栏剥页眉的，都从这里取。 */
export const META_SEPARATOR = '｜';
/** 元信息只在文件开头，多读几行给手写题面留余量。 */
const META_SCAN_LINES = 12;
/** 题号长什么样：P1001 / B3001 / UVA100 / 1660C / ABC300_A。用来区分「# 题号 标题」和手写的「# 标题」。 */
export const PROBLEM_ID = /^[A-Za-z]{0,6}\d{1,8}[A-Za-z]?(_[A-Za-z0-9]{1,3})?$/;

export interface ProblemMeta {
	readonly id: string;
	readonly title: string;
	readonly source?: string;
	readonly difficulty?: string;
	readonly timeLimit?: string;
	readonly memoryLimit?: string;
	/** 题面页脚那行原文链接；手写的题面没有它。 */
	readonly url?: string;
	readonly sampleCount: number;
}

/**
 * 从一份题面 Markdown 里读出标题与元信息。读不出来也要给出结果：
 * 手写的、或只抓了一半的题面照样能进题库，用文件名当题号。
 */
export function metaOf(markdown: string, fallbackId: string): ProblemMeta {
	// 标题行有两种：「# P1001 A+B Problem」（拉下来的）和「# 线段树练习」（手写的）。
	// 只有第一个词看着像题号才算题号，否则整行都是标题，题号退回文件名。
	const heading = /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim() ?? '';
	const [first, ...rest] = heading.split(/\s+/);
	const idFromHeading = PROBLEM_ID.test(first ?? '') ? first : undefined;
	const fields = new Map<string, string>();
	for (const line of markdown.split(/\r?\n/, META_SCAN_LINES)) {
		if (!line.startsWith('>')) { continue; }
		for (const part of line.slice(1).split(META_SEPARATOR)) {
			const index = part.indexOf('：');
			if (index > 0) {
				fields.set(part.slice(0, index).trim(), part.slice(index + 1).trim());
			}
		}
	}
	return {
		id: idFromHeading || fallbackId,
		title: idFromHeading ? rest.join(' ') : heading,
		source: fields.get(FIELD.source),
		difficulty: fields.get(FIELD.difficulty),
		timeLimit: fields.get(FIELD.timeLimit),
		memoryLimit: fields.get(FIELD.memoryLimit),
		url: fields.get(FIELD.sourceLink),
		sampleCount: [...markdown.matchAll(new RegExp(`^${SAMPLE_HEADING}`, 'gm'))].length,
	};
}
