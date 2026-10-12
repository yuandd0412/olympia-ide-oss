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

export const ACM_TEMPLATE = `// ${'$'}Olympia ACM 赛制模板 — C++17
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
	out.push('**输入**', '', '```', sample.input, '```', '');
	out.push('**输出**', '', '```', sample.output, '```', '');
	if (sample.explain) { out.push(`**说明**：${sample.explain}`, ''); }
	return out.join('\n');
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
	L.push(`> ${meta.join(' ｜ ')}`, `> 原文链接：${p.url}`, '');
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
export const FIELD = { source: '来源', difficulty: '难度', timeLimit: '时限', memoryLimit: '内存', tags: '标签' } as const;
export const SAMPLE_HEADING = '### 样例';
/** 样例区的小节标题；补样例时要找的就是它。 */
export const SAMPLES_SECTION = '## 样例数据';
const META_SEPARATOR = '｜';
/** 元信息只在文件开头，多读几行给手写题面留余量。 */
const META_SCAN_LINES = 12;
/** 题号长什么样：P1001 / B3001 / UVA100 / 1660C / ABC300_A。用来区分「# 题号 标题」和手写的「# 标题」。 */
const PROBLEM_ID = /^[A-Za-z]{0,6}\d{1,8}[A-Za-z]?(_[A-Za-z0-9]{1,3})?$/;

export interface ProblemMeta {
	readonly id: string;
	readonly title: string;
	readonly source?: string;
	readonly difficulty?: string;
	readonly timeLimit?: string;
	readonly memoryLimit?: string;
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
		sampleCount: [...markdown.matchAll(new RegExp(`^${SAMPLE_HEADING}`, 'gm'))].length,
	};
}
