/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  往题面里补一组样例。
 *
 *  题面 Markdown 就是本地那份可编辑的测试用例表：学生想加边界数据，改这个文件就行，
 *  跑样例读的也是它。这里做的是「对拍抓到的那组数据」这一条路——不一致的现场最容易忘，
 *  停下来问一句、点一下，它就永久留在题面里了。
 *
 *  写出来的形状必须和 `renderSamples` 一致（跑样例按同样的标记读回来），所以这里只调用它，
 *  不另写一份 Markdown 拼接。
 *--------------------------------------------------------------------------------------------*/
import { parseSampleBlocks, renderSampleBlock, SAMPLES_SECTION, SAMPLE_HEADING } from './templates';
import { type LibraryEntry } from './problemLibrary';

export interface SampleToAppend {
	readonly input: string;
	readonly output: string;
	readonly explain?: string;
}

export interface AppendResult {
	readonly markdown: string;
	readonly index: number;
}

/** 面板里手动加样例时留下的提示，学生照着填。这行字同时也是「这条样例是学生自己加的」的记号。 */
export const MANUAL_EXPLAIN = '自己加的样例：把数据填进上面两个代码块再跑样例，期望输出空着的那组会被跳过。';

/**
 * 认「不是题面自带的样例」的记号：自己加的、对拍补的。
 * 对拍那条文案由 olympia-onboarding 的 stressTest.ts 拼（跨扩展 import 不了），改的时候要两边一起改。
 */
export const CUSTOM_MARKERS: readonly string[] = ['自己加的样例', '对拍第'];

/** 重新拉题面之前先把这些挑出来，新文件写完再原样贴回去。 */
export function customSamplesOf(markdown: string): SampleToAppend[] {
	return parseSampleBlocks(markdown)
		.filter(sample => CUSTOM_MARKERS.some(marker => sample.explain.includes(marker)))
		.map(sample => ({ input: sample.input, output: sample.output, explain: sample.explain }));
}

/** 把一组组样例按顺序贴回题面，编号顺着已有最大的往后排。 */
export function withCustomSamples(markdown: string, custom: readonly SampleToAppend[]): string {
	return custom.reduce((text, sample) => appendSample(text, sample).markdown, markdown);
}

/**
 * 追加到样例小节末尾。没有这个小节（题面只抓了一半、或手写的）就新起一节，
 * 放在页脚的 `---` 之前；连页脚也没有就接在文末。
 */
export function appendSample(markdown: string, sample: SampleToAppend): AppendResult {
	const index = lastSampleIndex(markdown) + 1;
	const lines = markdown.split(/\r?\n/);
	const at = insertionPoint(lines);
	const next = [...lines.slice(0, at), ...renderSampleBlock(index, sample).split('\n'), ...lines.slice(at)];
	return { markdown: next.join('\n').replace(/\n{3,}/g, '\n\n'), index };
}

/** 已有的最大样例编号；一道样例都没有时是 0，下一组就是「样例 1」。 */
export function lastSampleIndex(markdown: string): number {
	let last = 0;
	for (const match of markdown.matchAll(new RegExp(`${SAMPLE_HEADING}\\s*(\\d+)`, 'g'))) {
		const value = Number(match[1]);
		if (Number.isFinite(value) && value > last) {
			last = value;
		}
	}
	return last;
}

function insertionPoint(lines: string[]): number {
	const start = lines.findIndex(line => line.trim() === SAMPLES_SECTION);
	if (start < 0) {
		const footer = lines.findIndex(line => line.trim() === '---');
		return footer >= 0 ? footer : lines.length;    // 新起的小节插在页脚之前
	}
	// 小节末尾 = 下一个二级标题或页脚之前；都没有就是文件末尾
	let end = lines.length;
	for (let i = start + 1; i < lines.length; i++) {
		if (/^##\s/.test(lines[i]) || lines[i].trim() === '---') {
			end = i;
			break;
		}
	}
	while (end > start + 1 && lines[end - 1].trim() === '') {
		end--;    // 别把空行堆在小节边界上
	}
	return end;
}

/**
 * 该补进哪道题：文件名/题号能对上就直接用，对不上就让学生在题面库里挑一个。
 * 返回 undefined 表示用户取消了。
 */
export async function pickTarget(
	entries: readonly LibraryEntry[],
	hint: string | undefined,
	choose: (picks: readonly LibraryEntry[]) => Promise<LibraryEntry | undefined>
): Promise<LibraryEntry | undefined> {
	const wanted = hint?.replace(/\.[^.]+$/, '').toLowerCase();
	const exact = wanted ? entries.find(entry => entry.id.toLowerCase() === wanted) : undefined;
	return exact ?? choose(entries);
}
