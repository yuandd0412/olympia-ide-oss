/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../../base/browser/dom.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { ChatDebugHookResult, IChatDebugEventHookContent } from '../../common/chatDebugService.js';
import { renderSection, tokenizeContent } from './chatDebugToolCallContentRenderer.js';

const $ = DOM.$;

/**
 * Render a resolved hook execution content with structured sections for
 * hook type, command, result, duration, input, and output.
 * When JSON is detected in input/output, renders it with syntax highlighting.
 */
export async function renderHookContent(content: IChatDebugEventHookContent, languageService: ILanguageService, clipboardService?: IClipboardService, scrollable?: { scanDomNode(): void }): Promise<{ element: HTMLElement; disposables: DisposableStore }> {
	const disposables = new DisposableStore();
	const container = $('div.chat-debug-message-content');
	container.tabIndex = 0;

	// Header: hook type
	DOM.append(container, $('div.chat-debug-message-content-title', undefined, content.hookType));

	// Status summary line
	const statusParts: string[] = [];
	if (content.result !== undefined) {
		statusParts.push(formatHookResult(content.result));
	}
	if (content.exitCode !== undefined) {
		statusParts.push(localize('chatDebug.hook.exitCode', "退出码：{0}", content.exitCode));
	}
	if (content.durationInMillis !== undefined) {
		statusParts.push(localize('chatDebug.hook.duration', "{0} 毫秒", content.durationInMillis));
	}
	if (statusParts.length > 0) {
		DOM.append(container, $('div.chat-debug-message-content-summary', undefined, statusParts.join(' \u00b7 ')));
	}

	// Build collapsible sections for command, input, output, and error
	const sectionsContainer = DOM.append(container, $('div.chat-debug-message-sections'));

	if (content.command) {
		const { plainText, tokenizedHtml } = await tokenizeContent(content.command, languageService);
		renderSection(sectionsContainer, localize('chatDebug.hook.command', "命令"), plainText, tokenizedHtml, disposables, false, clipboardService, scrollable);
	}

	if (content.input) {
		const { plainText, tokenizedHtml } = await tokenizeContent(content.input, languageService);
		renderSection(sectionsContainer, localize('chatDebug.hook.input', "输入"), plainText, tokenizedHtml, disposables, false, clipboardService, scrollable);
	}

	if (content.output) {
		const { plainText, tokenizedHtml } = await tokenizeContent(content.output, languageService);
		renderSection(sectionsContainer, localize('chatDebug.hook.output', "输出"), plainText, tokenizedHtml, disposables, false, clipboardService, scrollable);
	}

	if (content.errorMessage) {
		const { plainText, tokenizedHtml } = await tokenizeContent(content.errorMessage, languageService);
		renderSection(sectionsContainer, localize('chatDebug.hook.error', "错误"), plainText, tokenizedHtml, disposables, false, clipboardService, scrollable);
	}

	return { element: container, disposables };
}

function formatHookResult(result: ChatDebugHookResult): string {
	switch (result) {
		case ChatDebugHookResult.Success:
			return localize('chatDebug.hook.result.success', "成功");
		case ChatDebugHookResult.Error:
			return localize('chatDebug.hook.result.error', "错误");
		case ChatDebugHookResult.NonBlockingError:
			return localize('chatDebug.hook.result.nonBlockingError', "非阻止错误");
		default:
			return String(result);
	}
}

/**
 * Convert a resolved hook content to plain text for clipboard / editor output.
 */
export function hookContentToPlainText(content: IChatDebugEventHookContent): string {
	const lines: string[] = [];
	lines.push(localize('chatDebug.hook.typeLabel', "挂钩类型: {0}", content.hookType));

	if (content.result !== undefined) {
		lines.push(localize('chatDebug.hook.resultLabel', "结果：{0}", formatHookResult(content.result)));
	}
	if (content.exitCode !== undefined) {
		lines.push(localize('chatDebug.hook.exitCodeLabel', "退出码：{0}", content.exitCode));
	}
	if (content.durationInMillis !== undefined) {
		lines.push(localize('chatDebug.hook.durationLabel', "耗时：{0} 毫秒", content.durationInMillis));
	}

	if (content.command) {
		lines.push('');
		lines.push(`[${localize('chatDebug.hook.command', "命令")}]`);
		lines.push(content.command);
	}

	if (content.input) {
		lines.push('');
		lines.push(`[${localize('chatDebug.hook.input', "输入")}]`);
		try {
			const parsed = JSON.parse(content.input);
			lines.push(JSON.stringify(parsed, null, 2));
		} catch {
			lines.push(content.input);
		}
	}

	if (content.output) {
		lines.push('');
		lines.push(`[${localize('chatDebug.hook.output', "输出")}]`);
		try {
			const parsed = JSON.parse(content.output);
			lines.push(JSON.stringify(parsed, null, 2));
		} catch {
			lines.push(content.output);
		}
	}

	if (content.errorMessage) {
		lines.push('');
		lines.push(`[${localize('chatDebug.hook.error', "错误")}]`);
		lines.push(content.errorMessage);
	}

	return lines.join('\n');
}
