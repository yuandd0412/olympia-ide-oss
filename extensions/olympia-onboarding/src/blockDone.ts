/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  「一个部件写完了」的判定。
 *
 *  学生说的部件就是顶层那一对花括号：一个函数、一个结构体、main。它闭合的那一刻，
 *  这份文件第一次成为一个能解析的整体——那才是值得查一下的时机，而不是按 Ctrl+S。
 *
 *  只数括号会数进字符串和注释里（`printf("(")`、`// {`），所以要带一个跳过字符串、
 *  字符量和两种注释的扫描。原始字符串字面量（R"(...)"）OI 里不会写，真写了也只会
 *  让某一次检查少一个块，不会报出假错误。
 *--------------------------------------------------------------------------------------------*/

/** 跳过一条 `//` 注释：到行尾为止，`\` 换行续行也跟着跳。 */
function skipLineComment(source: string, from: number): number {
	let i = from;
	while (i < source.length && source[i] !== '\n') {
		if (source[i] === '\\' && i + 1 < source.length && (source[i + 1] === '\n' || source[i + 1] === '\r')) {
			i += 2;
			continue;
		}
		i++;
	}
	return i;
}

/** 跳过 `/* ... *\/`；没闭合就一路到文件尾，与编译器的行为一致。 */
function skipBlockComment(source: string, from: number): number {
	const end = source.indexOf('*/', from + 2);
	return end < 0 ? source.length : end + 2;
}

/** 跳过 `"…"` 与 `'…'`（含 `\'` `\"` 转义）；未闭合就到行尾，学生边写边查时最常见。 */
function skipQuoted(source: string, from: number): number {
	const quote = source[from];
	let i = from + 1;
	while (i < source.length) {
		const ch = source[i];
		if (ch === '\\') { i += 2; continue; }
		if (ch === quote) { return i + 1; }
		if (ch === '\n' && quote === `'`) { return i; }
		i++;
	}
	return i;
}

/**
 * 数顶层花括号闭合了几对（`blocks`），以及此刻的嵌套深度（`depth`）。
 * `blocks` 变大就是「一个部件刚写完」。
 */
export function scanStructure(source: string): { blocks: number; depth: number } {
	let blocks = 0;
	let depth = 0;
	for (let i = 0; i < source.length; i++) {
		const ch = source[i];
		if (ch === '/' && source[i + 1] === '/') { i = skipLineComment(source, i + 2) - 1; continue; }
		if (ch === '/' && source[i + 1] === '*') { i = skipBlockComment(source, i) - 1; continue; }
		if (ch === '"' || ch === `'`) { i = skipQuoted(source, i) - 1; continue; }
		if (ch === '{') { depth++; continue; }
		if (ch === '}') {
			depth = Math.max(0, depth - 1);
			if (depth === 0) { blocks++; }
			continue;
		}
	}
	return { blocks, depth };
}
