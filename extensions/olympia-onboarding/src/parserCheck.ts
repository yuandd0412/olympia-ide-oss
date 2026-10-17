/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  「写完一个部件就查」那一条用的语法解析器。
 *
 *  为什么不启编译器：一次 `-fsyntax-only` 要 1–2 秒，每写完一个函数就来一下的话，
 *  红波浪线总比学生的手慢。这里用的是扩展自带的 tree-sitter wasm：进程内解析，
 *  实测一个 200 行的 DP 程序冷启 6 ms、之后 0.3–1.1 ms，能认出少分号、括号不配对、
 *  `cout <<` 断在一行中间，而且注释和字符串里的括号不会误报——那正是手写字符扫描做不到的。
 *
 *  它的边界要说死：解析器只看结构，看不见类型错误、未声明的变量、头文件问题。
 *  所以这一条永远产不出「编译通过」这句话；权威判定仍是 g++，在保存和提交前体检时跑。
 *  wasm 加载失败、文件过长而跳过解析，一律回一条 blocked，让面板说「没查」而不是「没问题」。
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { Finding, SOURCE_FILES } from './precheck';

/** 随扩展发出去的三个文件都在 syntax/ 下：运行时 JS、它自己的 wasm、C++ 语法。 */
const SYNTAX_DIR = 'syntax';
const RUNTIME = 'tree-sitter.js';
const CPP_GRAMMAR = 'tree-sitter-cpp.wasm';
/** 再长就不解析了：结构检查的意义是边写边报，几十万字节的文件会让等待重新变明显。 */
const MAX_PARSE_CHARS = 200_000;
/** 一次报太多没意义：根因通常在最前面几条，后面多是连锁反应。 */
const MAX_FINDINGS = 12;
/** 一条提示里最多带这么多原文，够定位就行；ERROR 节点可能吞掉后面几十行。 */
const MAX_SNIPPET_CHARS = 48;

interface Point { readonly row: number; readonly column: number }

interface SyntaxNode {
	readonly type: string;
	readonly text: string;
	readonly isError: boolean;
	readonly isMissing: boolean;
	readonly hasError: boolean;
	readonly startPosition: Point;
	readonly children: readonly SyntaxNode[];
}

interface SyntaxTree { readonly rootNode: SyntaxNode; delete(): void }

/** 运行时导出的那一组里，`init` 挂在 `Parser` 这个类上，不在模块本身（真机踩过一次）。 */
interface TreeSitterModule {
	Parser: {
		init(options: { locateFile(name: string): string }): Promise<unknown>;
		new(): { setLanguage(language: unknown): void; parse(source: string): SyntaxTree };
	};
	Language: { load(file: string): Promise<unknown> };
}

/** 加载只做一次：wasm 读盘加实例化不为零，每个按键做一次就亏了。 */
let parserPromise: Promise<(source: string) => SyntaxNode> | undefined;

function buildParser(extensionDir: string): Promise<(source: string) => SyntaxNode> {
	// 路径要到运行期才知道，所以这里是运行时 require；分隔符统一用 `/`，Windows 上也认。
	const dir = `${extensionDir.replace(/\\/g, '/')}/${SYNTAX_DIR}`;
	// eslint-disable-next-line no-restricted-syntax -- 路径要到运行期才知道，静态 import 拿不到扩展自己的目录
	const module = require(`${dir}/${RUNTIME}`) as TreeSitterModule;
	return Promise.resolve()
		.then(() => module.Parser.init({ locateFile: (name: string) => `${dir}/${name}` }))
		.then(() => module.Language.load(`${dir}/${CPP_GRAMMAR}`))
		.then(language => {
			const parser = new module.Parser();
			parser.setLanguage(language);
			return (source: string): SyntaxNode => parser.parse(source).rootNode;
		});
}

/** 同一个目录只加载一次；失败也要放开锁，下一次改动还能重试（wasm 可能是被安全软件临时锁住）。 */
function ensureParser(extensionDir: string): Promise<(source: string) => SyntaxNode> {
	if (!parserPromise) {
		parserPromise = buildParser(extensionDir).catch(error => {
			parserPromise = undefined;
			throw error;
		});
	}
	return parserPromise;
}

function snippet(text: string): string {
	const oneLine = text.replace(/\s+/g, ' ').trim();
	return oneLine.length > MAX_SNIPPET_CHARS ? `${oneLine.slice(0, MAX_SNIPPET_CHARS)}…` : oneLine;
}

/**
 * MISSING 是解析器「本该在这看到一个 X」的位置，比 ERROR 好定位；
 * ERROR 常常一口吞掉后面几行，所以只报它的开头。
 */
function describe(node: SyntaxNode): { message: string; length: number } {
	if (node.isMissing) {
		return { message: `这里少了 ${node.type}`, length: 1 };
	}
	const head = node.text.split(/\r?\n/)[0] ?? node.type;
	return { message: `从这里开始语法不通：${snippet(head) || node.type}`, length: Math.max(1, Math.min(head.length, MAX_SNIPPET_CHARS)) };
}

function collect(root: SyntaxNode, lineCount: number): Finding[] {
	const findings: Finding[] = [];
	const walk = (node: SyntaxNode): void => {
		if (findings.length >= MAX_FINDINGS) {
			return;
		}
		if (node.isError || node.isMissing) {
			// 已经断在这儿了，不再往里钻：里面的错误全是这一处断链的连锁反应。
			const { message, length } = describe(node);
			findings.push({
				rule: 'parse',
				severity: vscode.DiagnosticSeverity.Error,
				message,
				line: Math.min(Math.max(0, node.startPosition.row), Math.max(0, lineCount - 1)),
				character: Math.max(0, node.startPosition.column),
				length,
				detail: '这是编辑器内置的语法解析给出的结构提示，不是编译器的判定：它看不见类型和未声明的名字。保存或按 Ctrl+Alt+Enter 会真编一遍。'
			});
			return;
		}
		for (const child of node.children) {
			if (child.isError || child.isMissing || child.hasError) {
				walk(child);
			}
		}
	};
	if (root.isError || root.isMissing || root.hasError) {
		walk(root);
	}
	return findings;
}

export interface ParseResult {
	readonly findings: readonly Finding[];
	/** 解析器没跑起来（wasm 不在、加载失败、文件过长）。不能把它当成「没错误」。 */
	readonly blocked?: string;
}

/** 只有 C++ 源文件值得解析；`.c` 走的是另一套语法，别拿 C++ 的树去套。 */
export function wantsParseCheck(document: { fileName: string; languageId: string }): boolean {
	return SOURCE_FILES.test(document.fileName) && document.languageId !== 'c';
}

export async function parseCheck(document: { getText(): string; lineCount: number }, extensionDir: string): Promise<ParseResult> {
	const source = document.getText();
	if (source.length > MAX_PARSE_CHARS) {
		return { findings: [], blocked: `文件超过 ${Math.round(MAX_PARSE_CHARS / 1000)} KB，这一轮没做结构检查。` };
	}
	let parse: (source: string) => SyntaxNode;
	try {
		parse = await ensureParser(extensionDir);
	} catch (error) {
		return { findings: [], blocked: `语法解析器没能加载：${error instanceof Error ? error.message : String(error)}` };
	}
	try {
		return { findings: collect(parse(source), document.lineCount) };
	} catch (error) {
		return { findings: [], blocked: `语法解析中途失败：${error instanceof Error ? error.message : String(error)}` };
	}
}
