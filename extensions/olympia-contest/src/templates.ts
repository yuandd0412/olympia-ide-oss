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
	const out: string[] = ['## 样例数据', ''];
	samples.forEach((s, i) => {
		out.push(`### 样例 ${i + 1}`, '');
		out.push('**输入**', '', '```', s.input, '```', '');
		out.push('**输出**', '', '```', s.output, '```', '');
		if (s.explain) { out.push(`**说明**：${s.explain}`, ''); }
	});
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
	const meta: string[] = [`来源：${p.platform}`];
	if (p.difficulty) { meta.push(`难度：${p.difficulty}`); }
	if (p.timeLimit) { meta.push(`时限：${p.timeLimit}`); }
	if (p.memoryLimit) { meta.push(`内存：${p.memoryLimit}`); }
	if (p.tags.length) { meta.push(`标签：${p.tags.join('、')}`); }
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
