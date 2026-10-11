/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isHTMLAnchorElement } from '../../../../../../../base/browser/dom.js';
import { renderMarkdown } from '../../../../../../../base/browser/markdownRenderer.js';
import { MarkdownString } from '../../../../../../../base/common/htmlContent.js';
import { DisposableStore } from '../../../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../../../base/common/uri.js';
import { localize } from '../../../../../../../nls.js';
import { IOpenerService } from '../../../../../../../platform/opener/common/opener.js';
import { ILanguageModelChatMetadata } from '../../../../common/languageModels.js';

/** One cost metric, with the value for each context tier. */
export interface IModelCostMetric {
	readonly label: string;
	readonly standard: number | null | undefined;
	readonly extended: number | null | undefined;
}

/** The cost metrics a model reports, in the order they are shown. */
export function getModelCostMetrics(metadata: ILanguageModelChatMetadata): IModelCostMetric[] {
	return [
		{ label: localize('models.inputCostLabel', "输入"), standard: metadata.inputCost, extended: metadata.longContextInputCost },
		{ label: localize('models.outputCostLabel', "输出"), standard: metadata.outputCost, extended: metadata.longContextOutputCost },
		{ label: localize('models.cacheCostLabel', "缓存读取"), standard: metadata.cacheCost, extended: metadata.longContextCacheCost },
		{ label: localize('models.cacheWriteCostLabel', "缓存写入"), standard: metadata.cacheWriteCost, extended: metadata.longContextCacheWriteCost },
	].filter(metric => metric.standard !== undefined || metric.extended !== undefined);
}

export function formatModelCost(cost: number | null | undefined): string {
	return typeof cost === 'number' ? String(cost) : localize('models.cost.unknown', "未知");
}

/** The unit the cost numbers are given in, stated once above them. */
export function getCreditsPerMillionTokensLabel(): string {
	return localize('models.creditsPerMillionTokens', "每 100 万 token 的额度");
}

export function getMaxContextLabel(): string {
	return localize('models.contextSize', "最大上下文");
}

/** Renders a model's description markdown. The caller places and classes the element. */
export function renderModelDescription(tooltip: string, openerService: IOpenerService, store: DisposableStore, learnMoreUrl?: URI): { readonly element: HTMLElement; readonly learnMoreLink: HTMLAnchorElement | undefined } {
	const content = new MarkdownString(tooltip, { supportThemeIcons: true });
	if (learnMoreUrl) {
		content.appendMarkdown(tooltip ? ' ' : '').appendLink(learnMoreUrl, localize('chat.modelPicker.learnMore', "了解更多"));
	}
	const rendered = store.add(renderMarkdown(content, {
		actionHandler: link => { void openerService.open(link, { allowCommands: false, fromUserGesture: true }); },
	}));
	const possibleLearnMoreLink = learnMoreUrl ? rendered.element.lastElementChild?.lastElementChild : undefined;
	return {
		element: rendered.element,
		learnMoreLink: isHTMLAnchorElement(possibleLearnMoreLink) ? possibleLearnMoreLink : undefined,
	};
}
