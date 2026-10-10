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
import { IAgentNetworkFilterService } from '../../../../../platform/networkFilter/common/networkFilterService.js';
import { createBrowserPageLink, errorResult, getBrowserNetworkPolicyError, getBrowserPageResourceNavigationError, getExternalTunnelNetworkPolicyError, getSessionId, playwrightInvoke, remoteUrlRewriteNotice, rewriteRemoteLocalhostUrl } from './browserToolHelpers.js';
import { BrowserChatToolReferenceName } from '../../../../../platform/browserView/common/browserChatToolReferenceNames.js';
import { IBrowserViewWorkbenchService } from '../../common/browserView.js';
import { IRemoteExplorerService } from '../../../../services/remote/common/remoteExplorerService.js';
import { OpenPageToolId } from './openBrowserTool.js';

export const NavigateBrowserToolData: IToolData = {
	id: 'navigate_page',
	toolReferenceName: BrowserChatToolReferenceName.NavigatePage,
	displayName: localize('navigateBrowserTool.displayName', "导航页面"),
	userDescription: localize('navigateBrowserTool.userDescription', "导航或重新加载浏览器页面"),
	modelDescription: 'Navigate a browser page by URL, history, or reload.',
	icon: Codicon.arrowRight,
	source: ToolDataSource.Internal,
	inputSchema: {
		type: 'object',
		properties: {
			pageId: {
				type: 'string',
				description: `The browser page ID to navigate, acquired from context or the open tool.`
			},
			type: {
				type: 'string',
				enum: ['url', 'back', 'forward', 'reload'],
				description: 'Navigation type: "url" to navigate to a URL (default, requires "url" param), "back" or "forward" for history, "reload" to refresh.'
			},
			url: {
				type: 'string',
				description: 'The URL to navigate to. Required when type is "url".'
			},
		},
		required: ['pageId'],
	},
};

interface INavigateBrowserToolParams {
	pageId: string;
	type?: 'url' | 'back' | 'forward' | 'reload';
	url?: string;
}

export class NavigateBrowserTool implements IToolImpl {
	constructor(
		@IPlaywrightService private readonly playwrightService: IPlaywrightService,
		@IAgentNetworkFilterService private readonly agentNetworkFilterService: IAgentNetworkFilterService,
		@IBrowserViewWorkbenchService private readonly browserViewService: IBrowserViewWorkbenchService,
		@IRemoteExplorerService private readonly remoteExplorerService: IRemoteExplorerService,
	) { }

	async prepareToolInvocation(context: IToolInvocationPreparationContext, _token: CancellationToken): Promise<IPreparedToolInvocation | undefined> {
		const params = context.parameters as INavigateBrowserToolParams;
		const link = createBrowserPageLink(params.pageId);
		switch (params.type) {
			case 'reload':
				return {
					invocationMessage: new MarkdownString(localize('browser.reload.invocation', "正在重新加载 {0}", link)),
					pastTenseMessage: new MarkdownString(localize('browser.reload.past', "已重新加载 {0}", link)),
					icon: Codicon.refresh,
				};
			case 'back':
				return {
					invocationMessage: new MarkdownString(localize('browser.goBack.invocation', "正在 {0} 中向后导航", link)),
					pastTenseMessage: new MarkdownString(localize('browser.goBack.past', "已在 {0} 中向后导航", link)),
					icon: Codicon.arrowLeft,
				};
			case 'forward':
				return {
					invocationMessage: new MarkdownString(localize('browser.goForward.invocation', "正在 {0} 中向前导航", link)),
					pastTenseMessage: new MarkdownString(localize('browser.goForward.past', "已在 {0} 中向前导航", link)),
					icon: Codicon.arrowRight,
				};
			default: {
				if (!params.url) {
					throw new Error('The "url" parameter is required when type is "url".');
				}
				const parsed = URL.parse(params.url);
				if (!parsed) {
					throw new Error('You must provide a complete, valid URL.');
				}

				params.url = parsed.href;

				const resourceNavigationError = this.getResourceNavigationError(params.pageId, params.url);
				if (resourceNavigationError) {
					throw new Error(resourceNavigationError);
				}

				const networkPolicyError = getBrowserNetworkPolicyError(params.url, this.agentNetworkFilterService);
				if (networkPolicyError) {
					throw new Error(networkPolicyError);
				}

				return {
					invocationMessage: new MarkdownString(localize('browser.navigate.invocation', "正在 {1} 中导航到 {0}", parsed.href, link)),
					pastTenseMessage: new MarkdownString(localize('browser.navigate.past', "已在 {1} 中导航到 {0}", parsed.href, link)),
					confirmationMessages: {
						title: localize('browser.navigate.confirmTitle', "是否导航浏览器?"),
						message: localize('browser.navigate.confirmMessage', "这会将浏览器导航到 {0}，并允许代理访问其内容。", parsed.href),
						allowAutoConfirm: true,
					},
				};
			}
		}
	}

	async invoke(invocation: IToolInvocation, _countTokens: CountTokensCallback, _progress: ToolProgress, _token: CancellationToken): Promise<IToolResult> {
		const params = invocation.parameters as INavigateBrowserToolParams;
		const sessionId = getSessionId(invocation);

		if (!params.pageId) {
			return errorResult(`No page ID provided. Use '${OpenPageToolId}' first.`);
		}

		switch (params.type) {
			case 'reload':
				return playwrightInvoke(this.playwrightService, sessionId, params.pageId, (page) => page.reload({ waitUntil: 'domcontentloaded' }));
			case 'back':
				return playwrightInvoke(this.playwrightService, sessionId, params.pageId, (page) => page.goBack({ waitUntil: 'domcontentloaded' }));
			case 'forward':
				return playwrightInvoke(this.playwrightService, sessionId, params.pageId, (page) => page.goForward({ waitUntil: 'domcontentloaded' }));
			default: {
				const networkPolicyError = getBrowserNetworkPolicyError(params.url!, this.agentNetworkFilterService);
				if (networkPolicyError) {
					return errorResult(networkPolicyError);
				}

				const resourceNavigationError = this.getResourceNavigationError(params.pageId, params.url!);
				if (resourceNavigationError) {
					return errorResult(resourceNavigationError);
				}

				// In a remote workspace without the remote proxy, the integrated
				// browser runs locally and cannot reach the remote's localhost directly.
				// Rewrite to the forwarded local address (if any) so the page can be reached.
				const rewrite = rewriteRemoteLocalhostUrl(params.url!, this.browserViewService, this.remoteExplorerService);
				const tunnelPolicyError = getExternalTunnelNetworkPolicyError(rewrite, this.agentNetworkFilterService);
				if (tunnelPolicyError) {
					return errorResult(tunnelPolicyError);
				}
				const result = await playwrightInvoke(this.playwrightService, sessionId, params.pageId, (page, target) => {
					return page.goto(target, { waitUntil: 'domcontentloaded' });
				}, rewrite.url);
				return rewrite.rewritten
					? { ...result, content: [remoteUrlRewriteNotice(params.url!, rewrite.url), ...result.content] }
					: result;
			}
		}
	}

	private getResourceNavigationError(pageId: string, target: string): string | undefined {
		const editor = this.browserViewService.getKnownBrowserViews().get(pageId);
		return getBrowserPageResourceNavigationError(editor, target);
	}
}
