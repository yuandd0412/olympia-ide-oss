/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { IProductOnboardingTheme } from '../../../../base/common/product.js';

/**
 * Step identifiers for the onboarding walkthrough.
 */
export const enum OnboardingStepId {
	SignIn = 'onboarding.signIn',
	Personalize = 'onboarding.personalize',
	AiPreference = 'onboarding.aiPreference',
}

/**
 * Returns a localized title for each step.
 */
export function getOnboardingStepTitle(stepId: OnboardingStepId): string {
	switch (stepId) {
		case OnboardingStepId.SignIn:
			return localize('onboarding.step.signIn', "登录");
		case OnboardingStepId.Personalize:
			return localize('onboarding.step.personalize', "按你的习惯配置");
		case OnboardingStepId.AiPreference:
			return localize('onboarding.step.aiPreference', "你的 AI 协作方式");
	}
}

/**
 * Returns a localized subtitle for each step.
 */
export function getOnboardingStepSubtitle(stepId: OnboardingStepId): string {
	switch (stepId) {
		case OnboardingStepId.SignIn:
			return localize('onboarding.step.signIn.subtitle', "同步设置、解锁 AI 功能并连接 GitHub");
		case OnboardingStepId.Personalize:
			return localize('onboarding.step.personalize.subtitle', "选择主题和键盘映射");
		case OnboardingStepId.AiPreference:
			return localize('onboarding.step.aiPreference.subtitle', "选择适合你工作流的 AI 协作程度");
	}
}

/**
 * Ordered step IDs for the onboarding flow.
 */
export const ONBOARDING_STEPS: readonly OnboardingStepId[] = [
	OnboardingStepId.SignIn,
	OnboardingStepId.Personalize,
];

/**
 * Theme option for the onboarding personalization step.
 * Sourced from product.json via `onboardingThemes`.
 */
export type IOnboardingThemeOption = IProductOnboardingTheme;

/**
 * AI collaboration preference for the AI style step.
 */
export const enum AiCollaborationMode {
	CodeFirst = 'code-first',
	Balanced = 'balanced',
	AgentForward = 'agent-forward',
}

/**
 * AI collaboration preference option.
 */
export interface IAiPreferenceOption {
	readonly id: AiCollaborationMode;
	readonly label: string;
	readonly description: string;
	readonly icon: string;
}

/**
 * AI collaboration preference options shown in the AI style step.
 */
export const ONBOARDING_AI_PREFERENCE_OPTIONS: readonly IAiPreferenceOption[] = [
	{
		id: AiCollaborationMode.CodeFirst,
		label: localize('onboarding.aiPref.codeFirst', "我自己写代码"),
		description: localize('onboarding.aiPref.codeFirst.desc', "AI 负责给出建议并回答你的提问，每一处改动都由你决定。"),
		icon: 'edit',
	},
	{
		id: AiCollaborationMode.Balanced,
		label: localize('onboarding.aiPref.balanced', "并肩协作"),
		description: localize('onboarding.aiPref.balanced.desc', "行内建议加上对话面板，深入协作；自己写和交给 AI 之间的平衡。"),
		icon: 'layoutSidebarRight',
	},
	{
		id: AiCollaborationMode.AgentForward,
		label: localize('onboarding.aiPref.agentForward', "让 AI 主导"),
		description: localize('onboarding.aiPref.agentForward.desc', "让智能体主导——描述你的需求，然后审阅结果。适合搭架子做探索。"),
		icon: 'copilot',
	},
];

/**
 * Storage key for persisting onboarding completion state.
 */
export const ONBOARDING_STORAGE_KEY = 'welcomeOnboarding.state';

/**
 * Regex matching a single-word GHE instance slug (e.g. "octocat").
 * Only allows characters valid in DNS hostnames (letters, digits, hyphens).
 */
export const GHE_DOMAIN_REGEX = /^[a-zA-Z0-9-]+$/;

/**
 * Regex matching a full GHE instance URI (e.g. "https://octocat.ghe.com").
 */
export const GHE_FULL_URI_REGEX = /^(https:\/\/)?([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.ghe\.com\/?$/;

export const enum GheParseResultKind {
	Empty = 'empty',
	SingleWord = 'singleWord',
	FullUri = 'fullUri',
	Invalid = 'invalid',
}

export type GheParseResult =
	| { readonly kind: GheParseResultKind.Empty }
	| { readonly kind: GheParseResultKind.SingleWord; readonly resolvedUri: string }
	| { readonly kind: GheParseResultKind.FullUri; readonly resolvedUri: string }
	| { readonly kind: GheParseResultKind.Invalid };

/**
 * Parses a GHE instance input value and returns the result kind and resolved URI.
 */
export function parseGheInstanceInput(value: string): GheParseResult {
	const trimmed = value.trim();
	if (!trimmed) {
		return { kind: GheParseResultKind.Empty };
	}

	if (GHE_DOMAIN_REGEX.test(trimmed)) {
		return { kind: GheParseResultKind.SingleWord, resolvedUri: `https://${trimmed}.ghe.com` };
	}

	if (GHE_FULL_URI_REGEX.test(trimmed)) {
		const resolvedUri = trimmed.toLowerCase().startsWith('https://') ? trimmed : `https://${trimmed}`;
		return { kind: GheParseResultKind.FullUri, resolvedUri };
	}

	return { kind: GheParseResultKind.Invalid };
}
