/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../base/common/codicons.js';
import { FileAccess } from '../../base/common/network.js';
import { ThemeIcon } from '../../base/common/themables.js';
import { URI } from '../../base/common/uri.js';
import { localize } from '../../nls.js';
import { ChatEntitlement, IChatSentiment, IQuotaSnapshot } from '../../workbench/services/chat/common/chatEntitlementService.js';
import { IDefaultAccountService } from '../../platform/defaultAccount/common/defaultAccount.js';
import { IAuthenticationService } from '../../workbench/services/authentication/common/authentication.js';

export interface IResolvedAccountInfo {
	readonly accountName: string;
	readonly accountProviderId: string;
	readonly accountProviderLabel: string;
	/**
	 * The icon (avatar) supplied by the authentication provider for this
	 * account, if any.
	 */
	readonly accountIcon?: URI;
}

/**
 * Resolves the current account info by trying the default account service
 * first, then falling back to raw GitHub sessions from the authentication
 * service. The fallback covers the window between session creation and
 * {@link IDefaultAccountService} initialization.
 */
export async function resolveAccountInfo(
	defaultAccountService: IDefaultAccountService,
	authenticationService: IAuthenticationService,
): Promise<IResolvedAccountInfo | undefined> {
	const account = await defaultAccountService.getDefaultAccount();
	if (account) {
		return {
			accountName: account.accountName,
			accountProviderId: account.authenticationProvider.id,
			accountProviderLabel: account.authenticationProvider.name,
			accountIcon: await getSessionAccountIcon(authenticationService, account.authenticationProvider.id, account.sessionId),
		};
	}

	try {
		const sessions = await authenticationService.getSessions('github');
		if (sessions.length > 0) {
			return {
				accountName: sessions[0].account.label,
				accountProviderId: 'github',
				accountProviderLabel: 'GitHub',
				accountIcon: sessions[0].account.icon,
			};
		}
	} catch {
		// Provider not available yet
	}

	return undefined;
}

/**
 * Looks up the icon (avatar) that the authentication provider supplied for the
 * session backing the default account, if any.
 */
async function getSessionAccountIcon(authenticationService: IAuthenticationService, providerId: string, sessionId: string): Promise<URI | undefined> {
	try {
		const sessions = await authenticationService.getSessions(providerId);
		return sessions.find(session => session.id === sessionId)?.account.icon;
	} catch {
		// Provider not available yet
		return undefined;
	}
}

export type AccountTitleBarStateSource = 'account' | 'copilot';
export type AccountTitleBarStateKind = 'default' | 'accent' | 'warning' | 'prominent';

export interface IAccountTitleBarStateContext {
	readonly isAccountLoading: boolean;
	readonly accountName?: string;
	readonly accountProviderLabel?: string;
	readonly entitlement: ChatEntitlement;
	readonly sentiment: IChatSentiment;
	readonly quotas: {
		readonly chat?: IQuotaSnapshot;
		readonly completions?: IQuotaSnapshot;
	};
	/**
	 * Whether the conditional-auth opt-in permits signed-out operation.
	 * When true, a signed-out account shows a calm opt-in sign-in instead of the
	 * alarming "Agents Signed Out". Defaults to `false`, so the opt-in being off
	 * keeps today's behavior.
	 */
	readonly allowSignedOutWhenUsable: boolean;
}

export interface IAccountTitleBarState {
	readonly source: AccountTitleBarStateSource;
	readonly kind: AccountTitleBarStateKind;
	readonly icon: ThemeIcon;
	readonly label: string;
	readonly ariaLabel: string;
	readonly badge?: string;
	readonly dotBadge?: 'warning' | 'error';
	readonly revealLabelOnHover?: boolean;
}

export function getAccountProfileImageUrl(accountProviderId: string | undefined, accountName: string | undefined, accountIcon?: URI): string | undefined {
	if (accountIcon) {
		return FileAccess.uriToBrowserUri(accountIcon).toString(true);
	}

	if (accountProviderId !== 'github' || !accountName?.trim()) {
		return undefined;
	}

	return `https://github.com/${encodeURIComponent(accountName.trim())}.png?size=64`;
}

export function getAccountTitleBarBadgeKey(state: IAccountTitleBarState): string | undefined {
	if (!state.dotBadge) {
		return undefined;
	}

	return `${state.source}:${state.dotBadge}:${state.badge ?? ''}`;
}

export function getAccountTitleBarState(context: IAccountTitleBarStateContext): IAccountTitleBarState {
	if (context.isAccountLoading) {
		return {
			source: 'account',
			kind: 'default',
			icon: ThemeIcon.modify(Codicon.loading, 'spin'),
			label: localize('loadingAccount', "正在加载帐户..."),
			ariaLabel: localize('loadingAccountAria', "正在加载帐户"),
			revealLabelOnHover: true,
		};
	}

	const copilotState = getCopilotPresentation(context.entitlement, context.sentiment, context.quotas, context.allowSignedOutWhenUsable);
	if (copilotState) {
		return copilotState;
	}

	if (context.accountName) {
		return {
			source: 'account',
			kind: 'default',
			icon: Codicon.account,
			label: context.accountName,
			revealLabelOnHover: true,
			ariaLabel: context.accountProviderLabel
				? localize('accountSignedInAria', "已使用 {1} 以 {0} 身份登录", context.accountName, context.accountProviderLabel)
				: localize('accountSignedInAriaNameOnly', "以 {0} 身份登录", context.accountName),
		};
	}

	return {
		source: 'account',
		kind: 'prominent',
		icon: Codicon.account,
		label: localize('signInLabel', "登录"),
		ariaLabel: localize('signInAria', "登录到您的帐户"),
	};
}

function getCopilotPresentation(
	entitlement: ChatEntitlement,
	sentiment: IChatSentiment,
	quotas: { readonly chat?: IQuotaSnapshot; readonly completions?: IQuotaSnapshot },
	allowSignedOutWhenUsable: boolean
): IAccountTitleBarState | undefined {
	if (sentiment.hidden) {
		return undefined;
	}

	if (entitlement === ChatEntitlement.Unknown) {
		if (allowSignedOutWhenUsable) {
			// Signing in is optional, so present a calm affordance.
			return {
				source: 'copilot',
				kind: 'default',
				icon: Codicon.account,
				label: localize('agentsSignInOptional', "登录"),
				ariaLabel: localize('agentsSignInOptionalAria', "Sign in to GitHub to use more agents"),
			};
		}
		return {
			source: 'copilot',
			kind: 'prominent',
			icon: Codicon.account,
			label: localize('agentsSignedOut', "智能体已退出登录"),
			ariaLabel: localize('agentsSignedOutAria', "代理已退出登录"),
		};
	}

	if (sentiment.disabled || sentiment.untrusted) {
		return {
			source: 'copilot',
			kind: 'warning',
			icon: Codicon.account,
			label: localize('copilotUnavailable', "Copilot 不可用"),
			ariaLabel: sentiment.untrusted
				? localize('copilotUnavailableUntrustedAria', "GitHub Copilot 在不受信任的工作区中不可用")
				: localize('copilotUnavailableDisabledAria', "GitHub Copilot 已禁用"),
		};
	}

	const chatQuotaExceeded = quotas.chat?.percentRemaining === 0;
	const completionsQuotaExceeded = quotas.completions?.percentRemaining === 0;
	if (entitlement === ChatEntitlement.Free && (chatQuotaExceeded || completionsQuotaExceeded)) {
		return {
			source: 'copilot',
			kind: 'warning',
			icon: Codicon.account,
			label: localize('copilotQuotaReached', "已达到配额"),
			dotBadge: 'error',
			ariaLabel: getQuotaReachedAriaLabel(chatQuotaExceeded, completionsQuotaExceeded),
		};
	}

	const remainingPercent = getLowestPositivePercent(quotas.chat, quotas.completions);
	if (entitlement === ChatEntitlement.Free && typeof remainingPercent === 'number' && remainingPercent <= 25) {
		return {
			source: 'copilot',
			kind: remainingPercent <= 10 ? 'warning' : 'accent',
			icon: Codicon.account,
			label: localize('copilotTokensRemaining', "剩余令牌"),
			badge: `${remainingPercent}%`,
			dotBadge: remainingPercent <= 10 ? 'error' : 'warning',
			ariaLabel: localize('copilotTokensRemainingAria', "GitHub Copilot 剩余令牌: {0}%", remainingPercent),
		};
	}

	return undefined;
}

function getLowestPositivePercent(...quotas: Array<IQuotaSnapshot | undefined>): number | undefined {
	let lowest: number | undefined;
	for (const quota of quotas) {
		if (typeof quota?.percentRemaining !== 'number' || quota.percentRemaining <= 0) {
			continue;
		}

		lowest = typeof lowest === 'number'
			? Math.min(lowest, quota.percentRemaining)
			: quota.percentRemaining;
	}

	return lowest;
}

function getQuotaReachedAriaLabel(chatQuotaExceeded: boolean, completionsQuotaExceeded: boolean): string {
	if (chatQuotaExceeded && completionsQuotaExceeded) {
		return localize('copilotAllQuotaReachedAria', "已达到 GitHub Copilot 聊天和内联建议配额");
	}

	if (chatQuotaExceeded) {
		return localize('copilotChatQuotaReachedAria', "已达到 GitHub Copilot 聊天配额");
	}

	return localize('copilotCompletionsQuotaReachedAria', "已达到 GitHub Copilot 内联建议配额");
}
