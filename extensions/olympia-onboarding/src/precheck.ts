/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Olympia IDE - submission pre-flight check ("提交前体检").
 *
 *  Scans a C/C++ translation unit for the failure modes that make a solution pass locally and
 *  fail on the judge. Every rule below corresponds to a real, documented cause rather than a
 *  generic style nit:
 *
 *    - the judge runs Linux; CRLF line endings can turn a correct answer into a PE
 *    - optimized builds reject `#pragma GCC optimize` / `__attribute__((optimize))`
 *    - the judge defines ONLINE_JUDGE, and code that assumes it is always defined misbehaves
 *    - the judge scores by peak memory, so an unbalanced allocation means MLE not WA
 *    - `asm` / `bool` / `true` are valid identifiers on MSVC but keywords in GNU C++
 *    - local `freopen` debugging shims swallow stdin on the judge
 *    - mixing cin/cout with scanf/printf desynchronises unless sync_with_stdio is disabled
 *    - `gets`, `random_shuffle` and `register` were removed from the C++ standard
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export type RuleId =
	| 'crlf'
	| 'pragmaOptimize'
	| 'onlineJudge'
	| 'memoryLeak'
	| 'reservedWord'
	| 'freopen'
	| 'ioMix'
	| 'removedCpp';

export interface Finding {
	readonly rule: RuleId;
	readonly severity: vscode.DiagnosticSeverity;
	readonly message: string;
	readonly line: number;
	readonly character: number;
	readonly length: number;
	readonly detail?: string;
}

interface RuleContext {
	readonly text: string;
	readonly profile: string;
}

function config(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration('olympia');
}

function ruleEnabled(rule: string, fallback: boolean): boolean {
	return config().get<boolean>(`check.rules.${rule}`, fallback);
}

/** Zero-based offset of the first match, or -1. */
function indexOf(re: RegExp, text: string): number {
	const m = re.exec(text);
	return m ? m.index : -1;
}

/** Converts an absolute offset into a zero-based line and character. */
function positionOf(text: string, offset: number): { line: number; character: number } {
	const before = text.slice(0, offset);
	const line = before.split('\n').length - 1;
	const lastBreak = before.lastIndexOf('\n');
	return { line, character: offset - lastBreak - 1 };
}

function finding(ctx: RuleContext, rule: RuleId, severity: vscode.DiagnosticSeverity,
	re: RegExp, message: string, detail?: string): Finding | undefined {
	const idx = indexOf(re, ctx.text);
	if (idx < 0) {
		return undefined;
	}
	const { line, character } = positionOf(ctx.text, idx);
	const hit = re.exec(ctx.text);
	const length = hit && hit[0].length > 0 ? Math.min(hit[0].length, 80) : 1;
	return { rule, severity, message, line, character, length, detail };
}

// ---------------------------------------------------------------------------------------------
// individual rules
// ---------------------------------------------------------------------------------------------

function checkCrlf(ctx: RuleContext): Finding | undefined {
	const idx = ctx.text.indexOf('\r\n');
	if (idx < 0) {
		return undefined;
	}
	const { line, character } = positionOf(ctx.text, idx);
	return {
		rule: 'crlf',
		severity: vscode.DiagnosticSeverity.Error,
		message: '文件使用了 CRLF 行尾符。评测机是 Linux，建议在提交前转为 LF。',
		line,
		character,
		length: 2,
		detail: '把 "files.eol" 设为 "\\n"，或用「文件 -> 更改行尾符序列 -> LF」保存一次。'
	};
}

function checkPragmaOptimize(ctx: RuleContext): Finding | undefined {
	// only flag when the build is actually optimized, otherwise it is legal
	if (config().get<string>('compiler.optimization', 'none') === 'none') {
		return undefined;
	}
	return finding(
		ctx, 'pragmaOptimize', vscode.DiagnosticSeverity.Error,
		/#\s*pragma\s+GCC\s+optimize|__attribute__\s*\(\(\s*optimize/,
		'检测到源码级优化属性。在开启优化的评测机上，这类写法可能直接编译失败。',
		'把本文件的优化属性删掉，改由 Olympia 按评测机参数统一加 -O2。'
	);
}

function checkOnlineJudge(ctx: RuleContext): Finding | undefined {
	if (ctx.profile === 'custom') {
		return undefined;
	}
	if (/#\s*ifdef\s+ONLINE_JUDGE|defined\s*\(\s*ONLINE_JUDGE\s*\)|#\s*ifndef\s+ONLINE_JUDGE/.test(ctx.text)) {
		return undefined;
	}
	// only worth mentioning when the file actually contains debug scaffolding
	if (!/freopen\s*\(|getchar\s*\(\s*\)|system\s*\(\s*"pause"|puts\s*\(\s*"Press/.test(ctx.text)) {
		return undefined;
	}
	return {
		rule: 'onlineJudge',
		severity: vscode.DiagnosticSeverity.Information,
		message: '文件里有本地调试代码，但没有用 ONLINE_JUDGE 宏区分环境。',
		line: 0,
		character: 0,
		length: 1,
		detail: '评测机会定义 ONLINE_JUDGE（洛谷为 luogu）。建议写成 #ifdef ONLINE_JUDGE 跳过调试分支。'
	};
}

function checkMemoryLeak(ctx: RuleContext): Finding | undefined {
	const text = stripCommentsAndStrings(ctx.text);
	const allocs =
		countAll(text, /\bnew\s+(?!\[)[A-Za-z_]/g) +
		countAll(text, /\bnew\s*\[/g) +
		countAll(text, /\bmalloc\s*\(/g) +
		countAll(text, /\bcalloc\s*\(/g) +
		countAll(text, /\brealloc\s*\(/g);
	if (allocs === 0) {
		return undefined;
	}
	const frees =
		countAll(text, /\bdelete\b/g) + countAll(text, /\bfree\s*\(/g);
	if (frees >= allocs) {
		return undefined;
	}
	const idx = indexOf(/\b(?:new\s+|malloc\s*\(|calloc\s*\(|realloc\s*\()/, text);
	const { line, character } = positionOf(ctx.text, idx < 0 ? 0 : idx);
	return {
		rule: 'memoryLeak',
		severity: vscode.DiagnosticSeverity.Warning,
		message: `分配了 ${allocs} 处，但只看到 ${frees} 处释放。评测机按峰值内存计分，可能 MLE。`,
		line,
		character,
		length: 1,
		detail: '确认每条分配路径都有对应的 delete / free；循环内分配尤其容易漏。'
	};
}

/** Keywords that MSVC accepts as identifiers but GNU C++ does not. */
const RESERVED = /\b(?:int|char|short|long|float|double|bool|auto|unsigned|signed|size_t|int\d*_t)\s+\**\s*(asm|bool|true|false|this|new|delete|template|typename|namespace|operator|explicit|export|friend|mutable|virtual|using)\b/g;

function checkReservedWord(ctx: RuleContext): Finding | undefined {
	const text = stripCommentsAndStrings(ctx.text);
	RESERVED.lastIndex = 0;
	const m = RESERVED.exec(text);
	if (!m) {
		return undefined;
	}
	const { line, character } = positionOf(ctx.text, m.index);
	return {
		rule: 'reservedWord',
		severity: vscode.DiagnosticSeverity.Error,
		message: `「${m[1]}」在 GNU C++ 里是关键字，本地能编过但评测机编不过。`,
		line,
		character,
		length: m[1].length,
		detail: 'Windows 的 MSVC 允许把它当变量名，GNU 编译器不允许。这是典型的「本地 AC、赛场 CE」。'
	};
}

function checkFreopen(ctx: RuleContext): Finding | undefined {
	return finding(
		ctx, 'freopen', vscode.DiagnosticSeverity.Warning,
		/\bfreopen\s*\(/,
		'检测到 freopen。评测机上没有这些本地文件，freopen 失败会让 stdin/stdout 变成空流。',
		'把本地调试用的 freopen 放进 #ifdef ONLINE_JUDGE 的反面分支，或提交前注释掉。'
	);
}

function checkIoMix(ctx: RuleContext): Finding | undefined {
	const text = stripCommentsAndStrings(ctx.text);
	const usesStream = /\b(?:cin|cout)\b/.test(text);
	const usesCstdio = /\b(?:scanf|printf|fprintf|sprintf|sscanf|fgets|puts)\s*\(/.test(text);
	if (!usesStream || !usesCstdio) {
		return undefined;
	}
	if (/sync_with_stdio\s*\(\s*false\s*\)/.test(text)) {
		return undefined;
	}
	return finding(
		ctx, 'ioMix', vscode.DiagnosticSeverity.Warning,
		/\b(?:cin|cout)\b/,
		'同时使用了 cin/cout 和 scanf/printf，但没有关闭同步，输出很容易乱序。',
		'在 main 开头加 ios::sync_with_stdio(false); cin.tie(nullptr); 或者干脆只用一种 IO。'
	);
}

const REMOVED: ReadonlyArray<{ re: RegExp; what: string }> = [
	{ re: /\bgets\s*\(/, what: 'gets' },
	{ re: /\brandom_shuffle\s*\(/, what: 'random_shuffle' },
	{ re: /\bregister\s+\w/, what: 'register' },
];

function checkRemovedCpp(ctx: RuleContext): Finding | undefined {
	const text = stripCommentsAndStrings(ctx.text);
	for (const entry of REMOVED) {
		const idx = indexOf(entry.re, text);
		if (idx < 0) {
			continue;
		}
		const { line, character } = positionOf(ctx.text, idx);
		return {
			rule: 'removedCpp',
			severity: vscode.DiagnosticSeverity.Error,
			message: `「${entry.what}」已被 C++ 标准移除，用 \`-std=c++14\` 以上的评测机会编译失败。`,
			line,
			character,
			length: entry.what.length,
			detail: entry.what === 'gets'
				? '改用 fgets(buf + k, sizeof(buf) - k, stdin) 或 std::getline。'
				: entry.what === 'random_shuffle'
					? '改用 std::shuffle(v.begin(), v.end(), mt19937(种子))。'
					: '直接删掉 register 关键字。'
		};
	}
	return undefined;
}

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------

function countAll(text: string, re: RegExp): number {
	re.lastIndex = 0;
	let n = 0;
	while (re.exec(text) !== null) {
		n++;
	}
	return n;
}

/**
 * Removes comments and string literals so that rule matching never fires on text that only
 * appears inside a comment or a string. Block comments and line comments are blanked rather
 * than deleted, which keeps every offset stable.
 */
export function stripCommentsAndStrings(text: string): string {
	const out: string[] = [];
	let i = 0;
	const n = text.length;
	const blank = (from: number, to: number): void => {
		for (let k = from; k < to; k++) {
			out.push(text[k] === '\n' ? '\n' : ' ');
		}
	};

	while (i < n) {
		const ch = text[i];
		const next = text[i + 1];

		if (ch === '/' && next === '/') {
			let j = i;
			while (j < n && text[j] !== '\n') { j++; }
			blank(i, j);
			i = j;
			continue;
		}
		if (ch === '/' && next === '*') {
			let j = i + 2;
			while (j < n && !(text[j] === '*' && text[j + 1] === '/')) { j++; }
			j = Math.min(j + 2, n);
			blank(i, j);
			i = j;
			continue;
		}
		if (ch === '"' || ch === '\'') {
			const quote = ch;
			let j = i + 1;
			while (j < n && text[j] !== quote) {
				j += (text[j] === '\\') ? 2 : 1;
			}
			j = Math.min(j + 1, n);
			blank(i, j);
			i = j;
			continue;
		}
		out.push(ch);
		i++;
	}
	return out.join('');
}

// ---------------------------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------------------------

const CHECKERS: ReadonlyArray<{
	readonly id: RuleId;
	readonly defaultOn: boolean;
	readonly run: (ctx: RuleContext) => Finding | undefined;
}> = [
		{ id: 'crlf', defaultOn: true, run: checkCrlf },
		{ id: 'pragmaOptimize', defaultOn: true, run: checkPragmaOptimize },
		{ id: 'onlineJudge', defaultOn: true, run: checkOnlineJudge },
		{ id: 'memoryLeak', defaultOn: true, run: checkMemoryLeak },
		{ id: 'reservedWord', defaultOn: true, run: checkReservedWord },
		{ id: 'freopen', defaultOn: true, run: checkFreopen },
		{ id: 'ioMix', defaultOn: true, run: checkIoMix },
		{ id: 'removedCpp', defaultOn: true, run: checkRemovedCpp },
	];

export function analyse(text: string, profile: string): Finding[] {
	const ctx: RuleContext = { text, profile };
	const findings: Finding[] = [];
	for (const checker of CHECKERS) {
		if (!ruleEnabled(checker.id, checker.defaultOn)) {
			continue;
		}
		const hit = checker.run(ctx);
		if (hit) {
			findings.push(hit);
		}
	}
	return findings;
}

export function toDiagnostic(finding: Finding): vscode.Diagnostic {
	const range = new vscode.Range(
		new vscode.Position(finding.line, finding.character),
		new vscode.Position(finding.line, finding.character + Math.max(1, finding.length))
	);
	const diagnostic = new vscode.Diagnostic(range, finding.message, finding.severity);
	diagnostic.source = '提交前体检';
	if (finding.detail) {
		diagnostic.code = finding.detail;
	}
	return diagnostic;
}

export const SOURCE_FILES = /\.(?:c|cc|cpp|cxx|c\+\+|h|hh|hpp|hxx)$/i;