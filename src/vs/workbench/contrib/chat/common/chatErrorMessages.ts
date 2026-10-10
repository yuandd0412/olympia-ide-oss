/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type { ErrorInfo } from '../../../../platform/agentHost/common/state/protocol/state.js';
import { ChatEntitlement } from '../../../services/chat/common/chatEntitlementService.js';
import { ChatErrorLevel, IChatResponseErrorDetails } from './chatService/chatService.js';

/**
 * Mirror of the Copilot extension's `ChatFetchResponseType` (see
 * `extensions/copilot/src/platform/chat/common/commonTypes.ts`). These string
 * values are forwarded verbatim from the agent host harnesses (Copilot CLI,
 * Claude, Codex) over `_meta`, so they MUST stay in sync with the extension.
 */
export const enum ChatFetchResponseType {
	OffTopic = 'offTopic',
	Canceled = 'canceled',
	Filtered = 'filtered',
	FilteredRetry = 'filteredRetry',
	PromptFiltered = 'promptFiltered',
	Length = 'length',
	RateLimited = 'rateLimited',
	QuotaExceeded = 'quotaExceeded',
	ExtensionBlocked = 'extensionBlocked',
	BadRequest = 'badRequest',
	NotFound = 'notFound',
	Failed = 'failed',
	Unknown = 'unknown',
	NetworkError = 'networkError',
	AgentUnauthorized = 'agent_unauthorized',
	AgentFailedDependency = 'agent_failed_dependency',
	InvalidStatefulMarker = 'invalid_stateful_marker',
	Success = 'success'
}

/**
 * Mirror of the Copilot extension's `FilterReason` (see
 * `extensions/copilot/src/platform/networking/common/openai.ts`).
 */
export const enum FilterReason {
	Hate = 'hate',
	SelfHarm = 'self_harm',
	Sexual = 'sexual',
	Violence = 'violence',
	Copyright = 'snippy',
	Prompt = 'prompt'
}

/**
 * Raw error payload forwarded from an agent host harness. This is the
 * serialized `ChatFetchError` from the Copilot extension. Because it crosses
 * the extension/core boundary as untyped JSON inside `_meta`, every field is
 * optional and consumers type-cast based on `type`.
 */
export interface IChatFetchErrorPayload {
	readonly type: ChatFetchResponseType | string;
	readonly reason?: string;
	readonly reasonDetail?: string;
	readonly requestId?: string;
	readonly serverRequestId?: string | undefined;
	readonly category?: FilterReason | string;
	readonly retryAfter?: number;
	readonly rateLimitKey?: string;
	readonly isAuto?: boolean;
	readonly capiError?: { code?: string; message?: string };
}

/**
 * The full forwarded chat error payload, including the user-context fields that
 * the extension would normally read from the Copilot token. This is the value
 * placed at `_meta.chatError` by the harnesses.
 */
export interface IForwardedChatError {
	readonly fetchError: IChatFetchErrorPayload;
	readonly copilotPlan?: string;
	readonly isUsageBasedBilling?: boolean;
	readonly quotaResetDate?: string;
}

const RATE_LIMIT_LEARN_MORE_URL = 'https://aka.ms/github-copilot-rate-limit-error';
const FILTERED_DOCS_URL = 'https://aka.ms/copilot-chat-filtered-docs';
const GITHUB_SUPPORT_URL = 'https://support.github.com/contact';

/**
 * Localized "canceled" message. Mirrors the extension's `CanceledMessage`,
 * which is intentionally not localized there; we localize it in core.
 */
const CanceledMessage: IChatResponseErrorDetails = { message: localize('chatError.canceled', "已取消") };

/**
 * Converts a number of seconds into a human readable, localized string like
 * "6 hours 50 minutes". Based on the Copilot extension's
 * `secondsToHumanReadableTime` (`extensions/copilot/src/util/common/time.ts`),
 * but the unit fragments are externalized so they translate in non-English
 * locales.
 */
function secondsToHumanReadableTime(seconds: number): string {
	if (seconds < 90) {
		return localize('chatError.duration.seconds', "{0} 秒", seconds);
	}

	const minutes = Math.floor(seconds / 60);
	if (seconds <= 5400) {
		return localize('chatError.duration.minutes', "{0} 分钟", minutes);
	}

	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;

	if (remainingMinutes > 0) {
		return localize('chatError.duration.hoursMinutes', "{0} 小时 {1} 分钟", hours, remainingMinutes);
	}
	return localize('chatError.duration.hours', "{0} 小时", hours);
}

function getRateLimitMessage(fetchError: IChatFetchErrorPayload, copilotPlan: string | undefined): string {
	const retryAfterString = fetchError.retryAfter ? secondsToHumanReadableTime(fetchError.retryAfter) : localize('chatError.aMoment', "片刻");
	const code = fetchError.capiError?.code;
	if (code?.startsWith('agent_mode_limit_exceeded')) { // Rate limited in agent mode
		return localize({ key: 'chatError.rateLimit.agentMode', comment: [`{Locked=']({'}`] }, "很抱歉，你已超出智能体模式速率限制。请切换到询问模式，然后在 {0} 后重试。[了解更多]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
	}
	if (code?.startsWith('model_overloaded') || code?.startsWith('upstream_provider_rate_limit')) {
		if (fetchError.isAuto) {
			return localize({ key: 'chatError.rateLimit.overloadedAuto', comment: [`{Locked=']({'}`] }, "很抱歉，上游模型提供程序目前面临的需求量较大。请在 {0} 后重试。[了解更多]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
		}
		return localize({ key: 'chatError.rateLimit.overloaded', comment: [`{Locked=']({'}`] }, "很抱歉，上游模型提供程序目前面临的需求量较大。请在 {0} 后重试或考虑切换到“自动”。[了解更多]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
	}
	if (code?.startsWith('user_global_rate_limited')) {
		if (copilotPlan === 'free' || copilotPlan === 'individual' || copilotPlan === 'individual_pro' || copilotPlan === 'edu') {
			return localize({ key: 'chatError.rateLimit.sessionUpgrade', comment: [`{Locked=']({'}`] }, "你已达到会话速率限制。请升级计划或等待 {0} 后重置限制。[了解详细信息]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
		}
		return localize({ key: 'chatError.rateLimit.session', comment: [`{Locked=']({'}`] }, "你已达到会话速率限制。请等待 {0} 后重置限制。[了解详细信息]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
	}
	if (code?.startsWith('user_weekly_rate_limited')) {
		if (fetchError.retryAfter) {
			const resetDate = new Date(Date.now() + fetchError.retryAfter * 1000);
			const resetDateString = resetDate.toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
			if (fetchError.isAuto) {
				return localize({ key: 'chatError.rateLimit.weeklyDateAuto', comment: [`{Locked=']({'}`] }, "你已达到周速率限制。请等到你的限制在 {0} 重置。[了解详细信息]({1})", resetDateString, RATE_LIMIT_LEARN_MORE_URL);
			}
			return localize({ key: 'chatError.rateLimit.weeklyDate', comment: [`{Locked=']({'}`] }, "你已达到周速率限制。请切换到自动模型以继续工作，或等到你的限制在 {0} 重置。[了解详细信息]({1})", resetDateString, RATE_LIMIT_LEARN_MORE_URL);
		}
		if (fetchError.isAuto) {
			return localize({ key: 'chatError.rateLimit.weeklyAuto', comment: [`{Locked=']({'}`] }, "你已达到周速率限制。请等待 {0} 后重置限制。[了解详细信息]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
		}
		return localize({ key: 'chatError.rateLimit.weekly', comment: [`{Locked=']({'}`] }, "你已达到周速率限制。请切换到自动模型以继续工作，或等待 {0} 后重置限制。[了解详细信息]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
	}
	if (code?.startsWith('user_model_rate_limited')) {
		if (fetchError.isAuto) {
			return localize({ key: 'chatError.rateLimit.modelAuto', comment: [`{Locked=']({'}`] }, "你已达到此模型的速率限制。请在 {0} 后重试。[了解更多]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
		}
		return localize({ key: 'chatError.rateLimit.model', comment: [`{Locked=']({'}`] }, "你已达到此模型的速率限制。请尝试切换到“自动”或在 {0} 后重试。[了解更多]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
	}
	if (code?.startsWith('integration_rate_limited')) {
		return localize({ key: 'chatError.rateLimit.integration', comment: [`{Locked=']({'}`] }, "很抱歉，GitHub Copilot 对话助手当前正遇到高需求。请在 {0} 后重试。[了解更多]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
	}

	if (fetchError.capiError?.code && fetchError.capiError?.message) {
		if (fetchError.isAuto) {
			return localize({ key: 'chatError.rateLimit.serverAuto', comment: [`{Locked=']({'}`] }, "很抱歉，你已达到速率限制。请等待 {0}，然后重试。[了解详细信息]({1})\r\n\r\n服务器错误: {2}\r\n错误代码: {3}", retryAfterString, RATE_LIMIT_LEARN_MORE_URL, fetchError.capiError.message, fetchError.capiError.code);
		}
		return localize({ key: 'chatError.rateLimit.server', comment: [`{Locked=']({'}`] }, "很抱歉，你已受到速率限制。请等待 {0}后重试，或考虑切换到自动模式。[了解详情]({1})\r\n\r\n服务器错误: {2}\r\n错误代码: {3}", retryAfterString, RATE_LIMIT_LEARN_MORE_URL, fetchError.capiError.message, fetchError.capiError.code);
	}

	if (fetchError.isAuto) {
		return localize({ key: 'chatError.rateLimit.genericAuto', comment: [`{Locked=']({'}`] }, "很抱歉，你的请求受速率限制。请等待 {0}，然后重试。[了解详情]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
	}
	return localize({ key: 'chatError.rateLimit.generic', comment: [`{Locked=']({'}`] }, "很抱歉，你的请求受到了速率限制。请等待 {0}后重试，或考虑切换到自动模式。[了解详情]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
}

export function getQuotaMessageForPlan(copilotPlan: string | undefined, isUsageBasedBilling?: boolean, quotaResetDate?: string): string {
	const resetDateString = quotaResetDate
		? new Date(quotaResetDate).toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
		: undefined;

	if (isUsageBasedBilling) {
		switch (copilotPlan) {
			case 'free':
				return resetDateString
					? localize('chatError.quota.ubb.freeDate', "你已达到每月额度限制。请升级到 Copilot Pro，或等到你的额度在 {0} 重置。", resetDateString)
					: localize('chatError.quota.ubb.free', "你已达到每月额度限制。请升级到 Copilot Pro 或等待你的额度重置。");
			case 'individual':
				return resetDateString
					? localize('chatError.quota.ubb.individualDate', "你已达到每月额度限制。请启用额外的付费额度、升级到 Copilot Pro+，或等到你的额度在 {0} 重置。", resetDateString)
					: localize('chatError.quota.ubb.individual', "你已达到每月额度限制。请启用额外的付费额度、升级到 Copilot Pro+ 或等待你的额度重置。");
			case 'edu':
				return resetDateString
					? localize('chatError.quota.ubb.eduDate', "你已达到每月额度限制。请启用额外的付费额度，升级到 Copilot Pro，或等到你的额度在 {0} 重置。", resetDateString)
					: localize('chatError.quota.ubb.edu', "你已达到每月额度限制。请启用额外的付费额度，升级到 Copilot Pro，或等待你的额度重置。");
			case 'individual_pro':
			case 'individual_max':
				return resetDateString
					? localize('chatError.quota.ubb.proDate', "你已达到每月额度限制。请启用额外的付费额度，或等到你的额度在 {0} 重置。", resetDateString)
					: localize('chatError.quota.ubb.pro', "你已达到每月额度限制。请启用额外的付费额度或等待你的额度重置。");
			case 'business':
			case 'enterprise':
				return resetDateString
					? localize('chatError.quota.ubb.businessDate', "你已达到额度限制。要继续工作，请联系你组织的 Copilot 管理员，或等到你的额度在 {0} 重置。", resetDateString)
					: localize('chatError.quota.ubb.business', "你已达到额度限制。要继续工作，请联系你组织的 Copilot 管理员或等待你的额度重置。");
			default:
				return resetDateString
					? localize('chatError.quota.ubb.defaultDate', "你已达到额度限制。对于其他付费额度，请联系组织的 Copilot 管理员，或等到你的额度在 {0} 重置。", resetDateString)
					: localize('chatError.quota.ubb.default', "你已达到额度限制。对于其他付费额度，请联系组织的 Copilot 管理员或等待你的额度重置。");
		}
	}

	switch (copilotPlan) {
		case 'free':
			return localize('chatError.quota.free', "你已达到每月聊天消息数配额。请升级到 Copilot Pro 或等待你的授权额度更新。");
		case 'individual':
			return localize('chatError.quota.individual', "你已用尽高级模型配额。请启用额外付费高级请求，升级到 Copilot Pro+，或等待授权额度以续订。");
		case 'edu':
			return localize('chatError.quota.edu', "你已用尽高级模型配额。请启用额外的付费高级请求，升级到 Copilot Pro，或等待你的配额续订。");
		case 'individual_pro':
		case 'individual_max':
			return localize('chatError.quota.pro', "你已用尽高级模型配额。请启用额外付费高级请求，或等待授权额度以续订。");
		case 'business':
		case 'enterprise':
			return localize('chatError.quota.business', "你已用尽额度。要继续工作，请联系你组织的 Copilot 管理员或等待你的授权额度更新。");
		default:
			return localize('chatError.quota.default', "你已用尽高级模型配额。对于其他付费高级请求，请联系组织的 Copilot 管理员或等待你的授权额度更新。");
	}
}

function getQuotaHitMessage(fetchError: IChatFetchErrorPayload, copilotPlan: string | undefined, isUsageBasedBilling?: boolean, quotaResetDate?: string): string {
	let code = fetchError.capiError?.code;
	if (code === 'free_quota_exceeded') {
		code = 'quota_exceeded'; // Remap this to the generic quota code so we get per plan handling
	}
	if (code === 'quota_exceeded') {
		return getQuotaMessageForPlan(copilotPlan, isUsageBasedBilling, quotaResetDate);
	} else if (code === 'overage_limit_reached') {
		return localize({ key: 'chatError.quota.overage', comment: [`{Locked=']({'}`] }, "目前无法累积额外高级请求。请联系 [GitHub 支持]({0})以继续使用 Copilot。", GITHUB_SUPPORT_URL);
	} else if (code === 'additional_spend_limit_reached') {
		return localize('chatError.quota.additionalSpend', "你已达到计划的额外使用限制。请升级你的计划以继续。");
	} else if (code === 'billing_not_configured' && fetchError.capiError?.message) {
		return fetchError.capiError.message;
	} else if (fetchError.capiError?.code && fetchError.capiError?.message) {
		return localize('chatError.quota.server', "已超过配额\r\n\r\n服务器错误: {0}\r\n错误代码: {1}", fetchError.capiError.message, fetchError.capiError.code);
	} else {
		return localize('chatError.quota.generic', "已超过配额");
	}
}

export function getFilteredMessage(category: FilterReason | string, supportsMarkdown: boolean = true): string {
	switch (category) {
		case FilterReason.Copyright:
			if (supportsMarkdown) {
				return localize({ key: 'chatError.filtered.copyrightMd', comment: [`{Locked='](https://aka.ms/copilot-chat-filtered-docs)'}`] }, "很抱歉，响应与公共代码匹配，因此已被阻止。请重写你的提示。[了解详细信息]({0})。", FILTERED_DOCS_URL);
			}
			return localize('chatError.filtered.copyright', "很抱歉，响应与公共代码匹配，因此已被阻止。请重写你的提示。");
		case FilterReason.Prompt:
			if (supportsMarkdown) {
				return localize({ key: 'chatError.filtered.promptMd', comment: [`{Locked='](https://aka.ms/copilot-chat-filtered-docs)'}`] }, "很抱歉，你的提示已由负责任 AI 服务筛选。请重写提示，然后重试。[了解详细信息]({0})。", FILTERED_DOCS_URL);
			}
			return localize('chatError.filtered.prompt', "很抱歉，你的提示已由负责任 AI 服务过滤。请重写提示，然后重试。");
		default:
			if (supportsMarkdown) {
				return localize({ key: 'chatError.filtered.defaultMd', comment: [`{Locked='](https://aka.ms/copilot-chat-filtered-docs)'}`] }, "很抱歉，响应已被负责任 AI 服务筛选。请重写提示，然后重试。[了解详细信息]({0})。", FILTERED_DOCS_URL);
			}
			return localize('chatError.filtered.default', "很抱歉，响应已被负责任 AI 服务过滤。请重写你的提示，然后重试。");
	}
}

/**
 * Builds the user-facing {@link IChatResponseErrorDetails} from a forwarded raw
 * chat fetch error. This is the core analog of the Copilot extension's
 * `getErrorDetailsFromChatFetchError`. Unlike the extension, core has no
 * access to the GitHub outage status, so the outage note is never appended
 * (assume no outage).
 */
export function getChatErrorDetailsFromFetchError(fetchError: IChatFetchErrorPayload, copilotPlan: string | undefined, isUsageBasedBilling?: boolean, quotaResetDate?: string): IChatResponseErrorDetails {
	return { code: fetchError.type, ...getChatErrorDetailsInner(fetchError, copilotPlan, isUsageBasedBilling, quotaResetDate) };
}

function getChatErrorDetailsInner(fetchError: IChatFetchErrorPayload, copilotPlan: string | undefined, isUsageBasedBilling?: boolean, quotaResetDate?: string): IChatResponseErrorDetails {
	const requestId = fetchError.requestId ?? '';
	const reason = fetchError.reason ?? '';
	switch (fetchError.type) {
		case ChatFetchResponseType.OffTopic:
			return { message: localize('chatError.offTopic', "很抱歉，我只能帮助处理与编程相关的问题。") };
		case ChatFetchResponseType.Canceled:
			return CanceledMessage;
		case ChatFetchResponseType.RateLimited:
			return {
				message: getRateLimitMessage(fetchError, copilotPlan),
				level: ChatErrorLevel.Info,
				isRateLimited: true
			};
		case ChatFetchResponseType.QuotaExceeded:
			return {
				message: getQuotaHitMessage(fetchError, copilotPlan, isUsageBasedBilling, quotaResetDate),
				isQuotaExceeded: true,
				...(fetchError.capiError?.code && { code: fetchError.capiError.code }),
			};
		case ChatFetchResponseType.BadRequest:
		case ChatFetchResponseType.Failed:
			return fetchError.serverRequestId
				? { message: localize('chatError.failedWithServerId', "很抱歉，你的请求失败。请重试。\r\n\r\n客户端请求 ID: {0}\r\n\r\nGH 请求 ID: {1}\r\n\r\n原因: {2}", requestId, fetchError.serverRequestId, reason) }
				: { message: localize('chatError.failed', "很抱歉，你的请求失败。请重试。\r\n\r\n客户端请求 ID: {0}\r\n\r\n原因: {1}", requestId, reason) };
		case ChatFetchResponseType.NetworkError:
			return { message: localize('chatError.network', "抱歉，出现网络错误。请稍后重试。请求 ID: {0}\r\n\r\n原因: {1}", requestId, reason) };
		case ChatFetchResponseType.Filtered:
		case ChatFetchResponseType.PromptFiltered:
			return {
				message: getFilteredMessage(fetchError.category ?? ''),
				responseIsFiltered: true,
				level: ChatErrorLevel.Info,
			};
		case ChatFetchResponseType.AgentUnauthorized:
			return { message: localize('chatError.somethingWrong', "很抱歉，出现了问题。") };
		case ChatFetchResponseType.AgentFailedDependency:
			return { message: reason };
		case ChatFetchResponseType.Length:
			return { message: localize('chatError.length', "很抱歉，响应达到了长度限制。请改述你的提示。") };
		case ChatFetchResponseType.NotFound:
			return { message: localize('chatError.notFound', "很抱歉，找不到资源。") };
		case ChatFetchResponseType.Unknown:
			return { message: localize('chatError.unknown', "很抱歉，未返回响应。") };
		case ChatFetchResponseType.ExtensionBlocked:
			return { message: localize('chatError.extensionBlocked', "很抱歉，出现了问题。") };
		case ChatFetchResponseType.InvalidStatefulMarker:
			// should be unreachable, retried within the endpoint
			return { message: localize('chatError.invalidStatefulMarker', "你的聊天会话状态无效，请开始新的聊天。") };
		default:
			return { message: reason || localize('chatError.somethingWrong', "很抱歉，出现了问题。") };
	}
}

/**
 * Type guard for the forwarded chat error payload placed at `_meta.chatError`
 * by the agent host harnesses.
 */
function isForwardedChatError(value: unknown): value is IForwardedChatError {
	return !!value
		&& typeof value === 'object'
		&& 'fetchError' in value
		&& !!(value as IForwardedChatError).fetchError
		&& typeof (value as IForwardedChatError).fetchError === 'object'
		&& typeof (value as IForwardedChatError).fetchError.type === 'string';
}

/**
 * Extracts and formats {@link IChatResponseErrorDetails} from the `_meta`
 * forwarded by an agent host harness, if present. Returns `undefined` when no
 * forwarded chat error is found so callers can fall back to their existing
 * error handling.
 *
 * The agent host does not know the signed-in user's plan, so callers in core
 * pass an {@link IChatErrorContext} (resolved from `IChatEntitlementService`)
 * whose fields take precedence over the values forwarded in `_meta`.
 */
export function getChatErrorDetailsFromMeta(error: ErrorInfo | undefined, context?: IChatErrorContext): IChatResponseErrorDetails | undefined {
	const meta = error?._meta;
	const chatError = meta?.chatError;
	if (!isForwardedChatError(chatError)) {
		return undefined;
	}
	return getChatErrorDetailsFromFetchError(
		chatError.fetchError,
		context?.copilotPlan ?? chatError.copilotPlan,
		context?.isUsageBasedBilling ?? chatError.isUsageBasedBilling,
		context?.quotaResetDate ?? chatError.quotaResetDate,
	);
}

/**
 * User-context overrides for {@link getChatErrorDetailsFromMeta}. When a field
 * is set it takes precedence over the value forwarded by the agent host. Core
 * resolves these from `IChatEntitlementService`.
 */
export interface IChatErrorContext {
	readonly copilotPlan?: string;
	readonly isUsageBasedBilling?: boolean;
	readonly quotaResetDate?: string;
}

/**
 * Maps a core {@link ChatEntitlement} to the Copilot plan string understood by
 * the quota/rate-limit message helpers (mirrors the Copilot extension's
 * `CopilotToken.copilotPlan` values).
 */
export function getCopilotPlanFromEntitlement(entitlement: ChatEntitlement): string | undefined {
	switch (entitlement) {
		case ChatEntitlement.Free:
			return 'free';
		case ChatEntitlement.Pro:
			return 'individual';
		case ChatEntitlement.ProPlus:
			return 'individual_pro';
		case ChatEntitlement.Max:
			return 'individual_max';
		case ChatEntitlement.Business:
			return 'business';
		case ChatEntitlement.Enterprise:
			return 'enterprise';
		case ChatEntitlement.EDU:
			return 'edu';
		default:
			return undefined;
	}
}
