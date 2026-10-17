/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Olympia IDE - submission pre-flight check ("提交前体检") — the pattern half.
 *
 *  A live check for the things that end a submission: the judge's compiler rejecting code that
 *  MSVC accepts. Every rule below therefore reports a *compile error*, not a style
 *  opinion — findings that merely made a program score worse (freopen, mixed IO, leaks, CRLF)
 *  were removed, because a checker that cries warning on correct code teaches students to
 *  ignore the one signal that matters.
 *
 *    - optimized builds reject `#pragma GCC optimize` / `__attribute__((optimize))`
 *    - `asm` and the alternative operator names are identifiers on MSVC but keywords in GNU C++
 *    - `gets`, `random_shuffle` and `register` were removed from the C++ standard
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { activeTarget } from './ojTargets';

/** The diagnostic source every rule writes, so the bars can tell our findings from the compiler's. */
export const PRECHECK_SOURCE = '提交前体检';

export type RuleId =
	| 'pragmaOptimize'
	| 'reservedWord'
	| 'removedCpp'
	/** 语法这一半不在这里：见 syntaxCheck.ts（真的把代码编一遍）。 */
	| 'syntax'
	/** 结构这一半也不在这里：见 parserCheck.ts（进程内的语法解析，不启编译器）。 */
	| 'parse';

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
	// 注释和字符串里出现这些词不会让评测机编译失败，所以一律在挖空后的文本上匹配；
	// stripCommentsAndStrings 保持偏移量不变，位置照样能落回原文。
	const code = stripCommentsAndStrings(ctx.text);
	re.lastIndex = 0;
	const hit = re.exec(code);
	if (!hit) {
		return undefined;
	}
	const { line, character } = positionOf(ctx.text, hit.index);
	return { rule, severity, message, line, character, length: Math.min(hit[0].length || 1, 80), detail };
}

// ---------------------------------------------------------------------------------------------
// individual rules
// ---------------------------------------------------------------------------------------------

function checkPragmaOptimize(ctx: RuleContext): Finding | undefined {
	// 本地开不开优化与这条无关：交上去的源码到了评测机上，那边自己会再叠一层优化开关，
	// 源码级 optimize 属性与它冲突时是编译失败，不是「跑得慢」。
	return finding(
		ctx, 'pragmaOptimize', vscode.DiagnosticSeverity.Error,
		/#\s*pragma\s+GCC\s+optimize|__attribute__\s*\(\(\s*optimize/,
		'检测到源码级优化属性。在开启优化的评测机上，这类写法可能直接编译失败。',
		'把本文件的优化属性删掉，改由 Olympia 按评测机参数统一加 -O2。'
	);
}

/** Keywords that MSVC accepts as identifiers but GNU C++ does not: the alternative operator
 *  names, which GNU always reserves and MSVC only reserves in conformance mode, plus `asm`.
 *  The gap between a type and the name must stay on one line, otherwise `#define int long long`
 *  followed by `using namespace std;` reads as a declaration and the rule invents an error.
 */
const RESERVED = /\b(?:unsigned|signed|short|long|float|double|void|int|char|bool|auto|size_t|int\d*_t)[ \t]+\**[ \t]*(asm|and|and_eq|bitand|bitor|compl|not|not_eq|or|or_eq|xor|xor_eq)\b[ \t]*(?![ \t]*(?:\(|::))/g;

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
		detail: 'MSVC 允许把它当变量名，GNU 编译器不允许。这是典型的「本地 AC、赛场 CE」。'
	};
}

const REMOVED: ReadonlyArray<{ re: RegExp; what: string }> = [
	{ re: /\bgets\s*\(/, what: 'gets' },
	{ re: /\brandom_shuffle\s*\(/, what: 'random_shuffle' },
	{ re: /\bregister\s+\w/, what: 'register' },
];

/** 上面三个是 C++17 起移除的。NOI 档位还是 c++14，在那里它们照样编得过，报出来就是误报。 */
const REMOVED_SINCE = 17;

function activeStdYear(): number {
	const match = /c\+\+(\d{2})/.exec(activeTarget().std);
	return match ? Number(match[1]) : REMOVED_SINCE;
}

function checkRemovedCpp(ctx: RuleContext): Finding | undefined {
	if (activeStdYear() < REMOVED_SINCE) {
		return undefined;
	}
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
		{ id: 'pragmaOptimize', defaultOn: true, run: checkPragmaOptimize },
		{ id: 'reservedWord', defaultOn: true, run: checkReservedWord },
		{ id: 'removedCpp', defaultOn: true, run: checkRemovedCpp },
	];

export function analyse(text: string): Finding[] {
	const ctx: RuleContext = { text };
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
	diagnostic.source = PRECHECK_SOURCE;
	if (finding.detail) {
		diagnostic.code = finding.detail;
	}
	return diagnostic;
}

export const SOURCE_FILES = /\.(?:c|cc|cpp|cxx|c\+\+|h|hh|hpp|hxx)$/i;