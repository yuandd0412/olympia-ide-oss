/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { escapeMarkdownSyntaxTokens, MarkdownString } from '../../../../../base/common/htmlContent.js';
import { localize } from '../../../../../nls.js';
import { IPlaywrightService } from '../../../../../platform/browserView/common/playwrightService.js';
import { ToolDataSource, type CountTokensCallback, type IPreparedToolInvocation, type IToolData, type IToolImpl, type IToolInvocation, type IToolInvocationPreparationContext, type IToolResult, type ToolProgress } from '../../../chat/common/tools/languageModelToolsService.js';
import { createBrowserPageLink, DEFAULT_ELEMENT_LABEL, errorResult, getSessionId, playwrightInvoke } from './browserToolHelpers.js';
import { BrowserChatToolReferenceName } from '../../../../../platform/browserView/common/browserChatToolReferenceNames.js';
import { OpenPageToolId } from './openBrowserTool.js';

export const ClickBrowserToolData: IToolData = {
	id: 'click_element',
	toolReferenceName: BrowserChatToolReferenceName.ClickElement,
	displayName: localize('clickBrowserTool.displayName', "单击元素"),
	userDescription: localize('clickBrowserTool.userDescription', "单击浏览器页面中的元素"),
	modelDescription: 'Click on an element in a browser page.',
	icon: Codicon.cursor,
	source: ToolDataSource.Internal,
	inputSchema: {
		type: 'object',
		properties: {
			pageId: {
				type: 'string',
				description: `The browser page ID, acquired from context or the open tool.`
			},
			ref: {
				type: 'string',
				description: 'Element reference to click.'
			},
			selector: {
				type: 'string',
				description: 'Playwright selector of the element to click when "ref" is not available.'
			},
			element: {
				type: 'string',
				description: 'Human-readable description of the element to click (e.g., "submit button", "search icon").'
			},
			dblClick: {
				type: 'boolean',
				description: 'Set to true for double clicks. Default is false.'
			},
			button: {
				type: 'string',
				enum: ['left', 'right', 'middle'],
				description: 'Mouse button to click with. Default is "left".'
			},
		},
		required: ['pageId', 'element'],
		$comment: 'One of "ref" or "selector" is required.',
	},
};

interface IClickBrowserToolParams {
	pageId: string;
	ref?: string;
	selector?: string;
	element?: string;
	dblClick?: boolean;
	button?: 'left' | 'right' | 'middle';
}

export class ClickBrowserTool implements IToolImpl {
	constructor(
		@IPlaywrightService private readonly playwrightService: IPlaywrightService,
	) { }

	async prepareToolInvocation(_context: IToolInvocationPreparationContext, _token: CancellationToken): Promise<IPreparedToolInvocation | undefined> {
		const params = _context.parameters as IClickBrowserToolParams;
		const link = createBrowserPageLink(params.pageId);
		const element = escapeMarkdownSyntaxTokens(params.element ?? DEFAULT_ELEMENT_LABEL);
		return {
			invocationMessage: params.button === 'right'
				? new MarkdownString(localize('browser.click.invocation.right', "正在 {1} 中右键单击 {0}", element, link))
				: params.button === 'middle'
					? new MarkdownString(localize('browser.click.invocation.middle', "正在 {1} 中中键单击 {0}", element, link))
					: params.dblClick
						? new MarkdownString(localize('browser.dblClick.invocation', "正在 {1} 中双击 {0}", element, link))
						: new MarkdownString(localize('browser.click.invocation', "正在 {1} 中单击 {0}", element, link)),
			pastTenseMessage: params.button === 'right'
				? new MarkdownString(localize('browser.click.past.right', "已在 {1} 中右键单击 {0}", element, link))
				: params.button === 'middle'
					? new MarkdownString(localize('browser.click.past.middle', "已在 {1} 中中键单击 {0}", element, link))
					: params.dblClick
						? new MarkdownString(localize('browser.dblClick.past', "已在 {1} 中双击 {0}", element, link))
						: new MarkdownString(localize('browser.click.past', "已在 {1} 中单击 {0}", element, link)),
		};
	}

	async invoke(invocation: IToolInvocation, _countTokens: CountTokensCallback, _progress: ToolProgress, _token: CancellationToken): Promise<IToolResult> {
		const params = invocation.parameters as IClickBrowserToolParams;
		const sessionId = getSessionId(invocation);

		if (!params.pageId) {
			return errorResult(`No page ID provided. Use '${OpenPageToolId}' first.`);
		}

		let selector = params.selector;
		if (params.ref) {
			selector = `aria-ref=${params.ref}`;
		}

		if (!selector) {
			return errorResult('Either a "ref" or "selector" parameter is required.');
		}

		const button = params.button ?? 'left';

		if (params.dblClick) {
			return playwrightInvoke(this.playwrightService, sessionId, params.pageId, (page, sel, btn) => page.locator(sel).dblclick({ button: btn }), selector, button);
		}

		return playwrightInvoke(this.playwrightService, sessionId, params.pageId, (page, sel, btn) => page.locator(sel).click({ button: btn }), selector, button);
	}
}
