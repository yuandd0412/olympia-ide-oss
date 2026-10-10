/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { localize } from '../../../../../nls.js';
import { IPlaywrightService } from '../../../../../platform/browserView/common/playwrightService.js';
import { ToolDataSource, type CountTokensCallback, type IPreparedToolInvocation, type IToolData, type IToolImpl, type IToolInvocation, type IToolInvocationPreparationContext, type IToolResult, type ToolProgress } from '../../../chat/common/tools/languageModelToolsService.js';
import { errorResult, getSessionId, invokeFunctionResultToToolResult } from './browserToolHelpers.js';
import { BrowserChatToolReferenceName } from '../../../../../platform/browserView/common/browserChatToolReferenceNames.js';
import { OpenPageToolId } from './openBrowserTool.js';

export const RunPlaywrightCodeToolData: IToolData = {
	id: 'run_playwright_code',
	toolReferenceName: BrowserChatToolReferenceName.RunPlaywrightCode,
	displayName: localize('runPlaywrightCodeTool.displayName', "运行 Playwright 代码"),
	userDescription: localize('runPlaywrightCodeTool.userDescription', "对浏览器页面运行 Playwright 代码片段"),
	modelDescription: `Run a Playwright code snippet to control a browser page. Only use this if other browser tools are insufficient.`,
	icon: Codicon.terminal,
	source: ToolDataSource.Internal,
	inputSchema: {
		type: 'object',
		properties: {
			pageId: {
				type: 'string',
				description: `The browser page ID, acquired from context or the open tool.`
			},
			code: {
				type: 'string',
				description: `The Playwright code to execute. The code must be concise, serve one clear purpose, and be self-contained. You **must not** directly access \`document\` or \`window\` using this tool. You must access it via the provided \`page\` object, e.g. "return page.evaluate(() => document.title)". Omit this when resuming a deferred execution via deferredResultId.`
			},
			deferredResultId: {
				type: 'string',
				description: `If a previous call returned a deferredResultId, pass it here to continue waiting for that execution to complete.`
			},
			timeoutMs: {
				type: 'number',
				description: `Maximum time in milliseconds to wait for the code to complete. Defaults to 5000 (5 seconds).`
			},
		},
		required: ['pageId'],
		$comment: 'Either "code" or "deferredResultId" must be provided.',
	},
};

interface IRunPlaywrightCodeToolParams {
	pageId: string;
	code?: string;
	deferredResultId?: string;
	timeoutMs?: number;
}

export class RunPlaywrightCodeTool implements IToolImpl {
	constructor(
		@IPlaywrightService private readonly playwrightService: IPlaywrightService,
	) { }

	async prepareToolInvocation(context: IToolInvocationPreparationContext, _token: CancellationToken): Promise<IPreparedToolInvocation | undefined> {
		const params = context.parameters as IRunPlaywrightCodeToolParams;

		if (params.deferredResultId) {
			return {
				invocationMessage: new MarkdownString(localize('browser.runCode.waitInvocation', "正在等待 Playwright 代码完成...")),
				pastTenseMessage: new MarkdownString(localize('browser.runCode.waitPast', "已等待 Playwright 代码")),
			};
		}

		const code = params.code ?? '';
		return {
			invocationMessage: new MarkdownString(localize('browser.runCode.invocation', "正在运行 Playwright 代码...")),
			pastTenseMessage: new MarkdownString(localize('browser.runCode.past', "已运行 Playwright 代码")),
			confirmationMessages: {
				title: localize('browser.runCode.confirmTitle', "是否运行 Playwright 代码?"),
				message: new MarkdownString(`\`\`\`javascript\n${code.trim()}\n\`\`\``),
				disclaimer: localize('browser.runCode.confirmDisclaimer', "继续操作前，请确保你信任该代码。"),
				allowAutoConfirm: true,
			}
		};
	}

	async invoke(invocation: IToolInvocation, _countTokens: CountTokensCallback, _progress: ToolProgress, _token: CancellationToken): Promise<IToolResult> {
		const params = invocation.parameters as IRunPlaywrightCodeToolParams;
		const sessionId = getSessionId(invocation);

		if (!params.pageId) {
			return errorResult(`No page ID provided. Use '${OpenPageToolId}' first.`);
		}

		// Resume waiting for a deferred execution
		if (params.deferredResultId) {
			try {
				const result = await this.playwrightService.waitForDeferredResult(sessionId, params.deferredResultId, params.timeoutMs ?? 5_000);
				return invokeFunctionResultToToolResult(result);
			} catch (e) {
				return errorResult(e instanceof Error ? e.message : String(e));
			}
		}

		if (!params.code) {
			return errorResult('Either "code" or "deferredResultId" must be provided.');
		}

		let result;
		try {
			result = await this.playwrightService.invokeFunction(sessionId, params.pageId, `async (page) => { ${params.code} }`, undefined, params.timeoutMs ?? 5_000);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			return errorResult(`Code execution failed: ${message}`);
		}

		return invokeFunctionResultToToolResult(result, params.code.trim());
	}
}
