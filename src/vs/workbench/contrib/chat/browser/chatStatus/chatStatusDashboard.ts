/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, EventType, addDisposableListener, EventHelper, disposableWindowInterval, getWindow } from '../../../../../base/browser/dom.js';
import { Gesture, EventType as TouchEventType } from '../../../../../base/browser/touch.js';
import { ActionBar } from '../../../../../base/browser/ui/actionbar/actionbar.js';
import { renderLabelWithIcons } from '../../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Button } from '../../../../../base/browser/ui/button/button.js';
import { SelectBox } from '../../../../../base/browser/ui/selectBox/selectBox.js';
import { Checkbox, TriStateCheckbox } from '../../../../../base/browser/ui/toggle/toggle.js';
import { IAction, toAction, WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification } from '../../../../../base/common/actions.js';
import { Sequencer } from '../../../../../base/common/async.js';
import { CancellationToken, cancelOnDispose } from '../../../../../base/common/cancellation.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { safeIntl } from '../../../../../base/common/date.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { MutableDisposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { parseLinkedText } from '../../../../../base/common/linkedText.js';
import { language } from '../../../../../base/common/platform.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { isObject } from '../../../../../base/common/types.js';
import { URI } from '../../../../../base/common/uri.js';
import { IInlineCompletionsService } from '../../../../../editor/browser/services/inlineCompletionsService.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { ITextResourceConfigurationService } from '../../../../../editor/common/services/textResourceConfiguration.js';
import { ILanguageFeaturesService } from '../../../../../editor/common/services/languageFeatures.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { localize } from '../../../../../nls.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { ConfigurationTarget, getConfigValueInTarget, IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IHoverService, nativeHoverDelegate } from '../../../../../platform/hover/browser/hover.js';
import { IMarkdownRendererService } from '../../../../../platform/markdown/browser/markdownRenderer.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { Link } from '../../../../../platform/opener/browser/link.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { defaultButtonStyles, defaultCheckboxStyles, defaultSelectBoxStyles } from '../../../../../platform/theme/browser/defaultStyles.js';
import { DomWidget } from '../../../../../platform/domWidget/browser/domWidget.js';
import { EditorResourceAccessor, SideBySideEditor } from '../../../../common/editor.js';
import { IChatEntitlementService, ChatEntitlementService, ChatEntitlement, IQuotaSnapshot, getChatPlanName, getQuotaReset, getQuotaUsage, QuotaUsageKind } from '../../../../services/chat/common/chatEntitlementService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IContextViewService } from '../../../../../platform/contextview/browser/contextView.js';
import { isNewUser } from './chatStatus.js';
import { IChatStatusItemService, ChatStatusEntry } from './chatStatusItemService.js';
import { GitHubPaths, IDefaultAccountService } from '../../../../../platform/defaultAccount/common/defaultAccount.js';
import product from '../../../../../platform/product/common/product.js';
import { isCompletionsEnabled } from '../../../../../editor/common/services/completionsEnablement.js';

const defaultChat = product.defaultChatAgent;
const completionsConfigurationTargets = [
	ConfigurationTarget.WORKSPACE_FOLDER,
	ConfigurationTarget.WORKSPACE,
	ConfigurationTarget.USER_REMOTE,
	ConfigurationTarget.USER_LOCAL,
	ConfigurationTarget.APPLICATION,
] as const;

interface ISettingsAccessor {
	readSetting: () => boolean;
	writeSetting: (value: boolean) => Promise<void>;
}
type ChatSettingChangedClassification = {
	owner: 'bpasero';
	comment: 'Provides insight into chat settings changed from the chat status entry.';
	settingIdentifier: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The identifier of the setting that changed.' };
	settingMode?: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The optional editor language for which the setting changed.' };
	settingEnablement: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether the setting got enabled or disabled.' };
};
type ChatSettingChangedEvent = {
	settingIdentifier: string;
	settingMode?: string;
	settingEnablement: 'enabled' | 'disabled';
};

export interface IChatStatusDashboardOptions {
	/** When true, disables the Inline Suggestions settings section (toggles for all files, language, next edit). */
	disableInlineSuggestionsSettings?: boolean;
	/** When true, disables the inline completions model selection section. */
	disableModelSelection?: boolean;
	/** When true, disables the inline completions provider options section. */
	disableProviderOptions?: boolean;
	/** When true, disables the completions snooze button. */
	disableCompletionsSnooze?: boolean;
	/** When true, the Quick Settings region is rendered always-expanded without a collapsible header. */
	disableQuickSettingsCollapsible?: boolean;

	/**
	 * When provided, the title header (plan name + manage / CTA actions) is
	 * rendered into this caller-owned container instead of inline at the top
	 * of the dashboard. Use this to embed the title header in a host layout
	 * without reaching into the dashboard's private DOM.
	 */
	titleHeaderContainer?: HTMLElement;
	/**
	 * When true, uses a compact 2x2 grid layout for quota indicators:
	 * plan name + percentage on the top row, reset date + label on the bottom.
	 * The separate header (plan name + manage action) is not rendered.
	 */
	compactQuotaLayout?: boolean;
	/**
	 * When provided, CTA buttons (Manage Budget, Upgrade) are rendered into
	 * this caller-owned container instead of the dashboard header. Use this
	 * in compact mode to place action buttons in the host header.
	 */
	ctaButtonsContainer?: HTMLElement;
}

export class ChatStatusDashboard extends DomWidget {

	private static readonly QUICK_SETTINGS_COLLAPSED_KEY = 'chatStatusDashboard.quickSettingsCollapsed';

	readonly element = $('div.chat-status-bar-entry-tooltip');

	private readonly dateFormatter = safeIntl.DateTimeFormat(language, { month: 'short', day: 'numeric' });
	private readonly timeFormatter = safeIntl.DateTimeFormat(language, { hour: 'numeric', minute: 'numeric' });
	private readonly quotaPercentageFormatter = safeIntl.NumberFormat(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 });
	private readonly quotaCreditsFormatter = safeIntl.NumberFormat(language, { maximumFractionDigits: 2, minimumFractionDigits: 0 });


	constructor(
		private readonly options: IChatStatusDashboardOptions | undefined,
		@IChatEntitlementService private readonly chatEntitlementService: ChatEntitlementService,
		@IChatStatusItemService private readonly chatStatusItemService: IChatStatusItemService,
		@ICommandService private readonly commandService: ICommandService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IEditorService private readonly editorService: IEditorService,
		@IHoverService private readonly hoverService: IHoverService,
		@ILanguageService private readonly languageService: ILanguageService,
		@IOpenerService private readonly openerService: IOpenerService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@ITextResourceConfigurationService private readonly textResourceConfigurationService: ITextResourceConfigurationService,
		@IInlineCompletionsService private readonly inlineCompletionsService: IInlineCompletionsService,
		@IMarkdownRendererService private readonly markdownRendererService: IMarkdownRendererService,
		@ILanguageFeaturesService private readonly languageFeaturesService: ILanguageFeaturesService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IStorageService private readonly storageService: IStorageService,
		@IDefaultAccountService private readonly defaultAccountService: IDefaultAccountService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();

		this.render();
	}

	private render(): void {
		const token = cancelOnDispose(this._store);

		const { chat, premiumChat, completions } = this.chatEntitlementService.quotas;
		const hasQuotas = !!(chat || premiumChat);
		const isAnonymousWithSentiment = this.chatEntitlementService.anonymous && this.chatEntitlementService.sentiment.completed;
		const isPooledQuotaDepleted = premiumChat?.unlimited && premiumChat.hasQuota === false;
		const hasUsageSection = hasQuotas || isAnonymousWithSentiment;
		const hasVisibleUsageContent = chat?.unlimited === false ||
			premiumChat?.unlimited === false ||
			(!this.options?.compactQuotaLayout && completions?.unlimited === false) ||
			isAnonymousWithSentiment ||
			isPooledQuotaDepleted;
		const contributedEntries = [...this.chatStatusItemService.getEntries()];
		const hasQuickSettingsContent =
			!this.options?.disableInlineSuggestionsSettings ||
			!this.options?.disableModelSelection ||
			!this.options?.disableProviderOptions ||
			!this.options?.disableCompletionsSnooze;

		// Title header with plan name, CTA buttons, and manage action
		let headerAdditionalSpendButton: Button | undefined;
		let headerUpgradeButton: Button | undefined;
		if (hasUsageSection && !this.options?.compactQuotaLayout) {
			const planName = getChatPlanName(this.chatEntitlementService.entitlement);
			const headerHost = this.options?.titleHeaderContainer ?? this.element;
			const header = this.renderHeader(headerHost, this._store, planName, toAction({
				id: 'workbench.action.manageCopilot',
				label: localize('quotaLabel', "管理 Copilot 设置"),
				tooltip: localize('quotaTooltip', "管理 Copilot 设置"),
				class: ThemeIcon.asClassName(Codicon.settings),
				run: () => this.runCommandAndClose(() => this.openGitHubUrl(GitHubPaths.copilotSettings)),
			}));

			// Add Additional Spend / Upgrade buttons to the header
			const canConfigureAdditionalSpend = this.chatEntitlementService.entitlement === ChatEntitlement.EDU || this.chatEntitlementService.entitlement === ChatEntitlement.Pro || this.chatEntitlementService.entitlement === ChatEntitlement.ProPlus || this.chatEntitlementService.entitlement === ChatEntitlement.Max;
			const showUpgrade = this.chatEntitlementService.quotas.canUpgradePlan ?? false;

			const actionBarElement = header.lastElementChild;

			if (canConfigureAdditionalSpend) {
				headerAdditionalSpendButton = this._store.add(new Button(header, { ...defaultButtonStyles, hoverDelegate: nativeHoverDelegate, secondary: true }));
				headerAdditionalSpendButton.element.classList.add('header-cta-button');
				headerAdditionalSpendButton.label = localize('manageBudget', "管理预算");
				this._store.add(headerAdditionalSpendButton.onDidClick(() => {
					this.telemetryService.publicLog2<WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification>('workbenchActionExecuted', { id: 'workbench.action.chat.manageAdditionalSpend', from: 'chat-status' });
					this.runCommandAndClose(() => this.openGitHubUrl(GitHubPaths.billingBudgets));
				}));
				if (actionBarElement) {
					header.insertBefore(headerAdditionalSpendButton.element, actionBarElement);
				}
			}

			if (showUpgrade) {
				headerUpgradeButton = this._store.add(new Button(header, { ...defaultButtonStyles, hoverDelegate: nativeHoverDelegate }));
				headerUpgradeButton.element.classList.add('header-cta-button');
				headerUpgradeButton.label = localize('upgrade', "升级");
				this._store.add(headerUpgradeButton.onDidClick(() => this.runCommandAndClose('workbench.action.chat.upgradePlan')));
				if (actionBarElement) {
					header.insertBefore(headerUpgradeButton.element, actionBarElement);
				}
			}
		}

		// CTA buttons for compact mode — rendered into a caller-provided container
		if (hasUsageSection && this.options?.compactQuotaLayout && this.options.ctaButtonsContainer) {
			const ctaContainer = this.options.ctaButtonsContainer;
			const canConfigureAdditionalSpend = this.chatEntitlementService.entitlement === ChatEntitlement.EDU || this.chatEntitlementService.entitlement === ChatEntitlement.Pro || this.chatEntitlementService.entitlement === ChatEntitlement.ProPlus || this.chatEntitlementService.entitlement === ChatEntitlement.Max;
			const showUpgrade = this.chatEntitlementService.quotas.canUpgradePlan ?? false;

			if (canConfigureAdditionalSpend) {
				headerAdditionalSpendButton = this._store.add(new Button(ctaContainer, { ...defaultButtonStyles, hoverDelegate: nativeHoverDelegate, secondary: true }));
				headerAdditionalSpendButton.label = localize('manageBudget', "管理预算");
				this._store.add(headerAdditionalSpendButton.onDidClick(() => {
					this.telemetryService.publicLog2<WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification>('workbenchActionExecuted', { id: 'workbench.action.chat.manageAdditionalSpend', from: 'chat-status' });
					this.runCommandAndClose(() => this.openGitHubUrl(GitHubPaths.billingBudgets));
				}));
			}

			if (showUpgrade) {
				headerUpgradeButton = this._store.add(new Button(ctaContainer, { ...defaultButtonStyles, hoverDelegate: nativeHoverDelegate }));
				headerUpgradeButton.label = localize('upgrade', "升级");
				this._store.add(headerUpgradeButton.onDidClick(() => this.runCommandAndClose('workbench.action.chat.upgradePlan')));
			}
		}

		// Compact mode class for CSS targeting
		if (this.options?.compactQuotaLayout) {
			this.element.classList.add('compact');
		}

		// Always trigger a fresh quota fetch when the dashboard opens
		const updatePromise = this.chatEntitlementService.update(token);

		// Usage section — always shown inline
		if (hasVisibleUsageContent) {
			this.renderUsageContent(this.element, token, headerAdditionalSpendButton, headerUpgradeButton, updatePromise);
		}

		// Premium chat included indicator (shown when premium chat is unlimited)
		const hasPremiumUnlimited = !!premiumChat?.unlimited;
		const premiumChatUsage = getQuotaUsage(premiumChat);
		if (premiumChatUsage?.kind === QuotaUsageKind.CreditsUsed) {
			this.createCreditsUsedIndicator(this.element, premiumChatUsage.creditsUsed, this.formatQuotaResetLabel(premiumChat));
		} else if (hasPremiumUnlimited) {
			const includedTitle = this.chatEntitlementService.quotas.usageBasedBilling
				? localize('includedTitleTBB', "额度")
				: localize('includedTitle', "高级请求");
			const getIncludedDescription = () => {
				if (isPooledQuotaDepleted) {
					return {
						compact: localize('premiumLimitReachedCompact', "已达 {0} 上限。", includedTitle),
						default: localize('premiumLimitReached', "已达到组织限制。")
					};
				}

				return {
					compact: localize('premiumIncludedCompact', "你的组织计划包含 {0}。", includedTitle),
					default: localize('premiumIncluded', "包含在组织的计划中。")
				};
			};
			const includedDescription = getIncludedDescription();
			const includedContainer = this.element.appendChild($('div.quota-indicator.included'));
			if (this.options?.compactQuotaLayout) {
				const planName = getChatPlanName(this.chatEntitlementService.entitlement);
				includedContainer.classList.add('compact');
				includedContainer.appendChild($('div.quota-title', undefined, planName));
				includedContainer.appendChild($('div.description', undefined, includedDescription.compact));
			} else {
				includedContainer.appendChild($('div.quota-title', undefined, includedTitle));
				includedContainer.appendChild($('div.description', undefined, includedDescription.default));
			}
		}

		// Next Edit Suggestions — collapsible region
		if (hasQuickSettingsContent) {
			const hasContentAbove = hasUsageSection || hasVisibleUsageContent || hasPremiumUnlimited;
			this.renderInlineSuggestionsSection(hasContentAbove);
		}

		// Contributed sections (e.g. Codebase Semantic Index) — each gets its own collapsible
		if (contributedEntries.length > 0) {
			this.renderContributedSections(contributedEntries);
		}

		// New to Chat / Signed out
		this.renderSetupSection();
	}

	private renderUsageContent(container: HTMLElement, token: CancellationToken, headerAdditionalSpendButton: Button | undefined, headerUpgradeButton: Button | undefined, updatePromise: Promise<void>): void {
		const { chat: chatQuota, completions: completionsQuota, premiumChat: premiumChatQuota } = this.chatEntitlementService.quotas;
		const compact = !!this.options?.compactQuotaLayout;
		const planName = compact ? getChatPlanName(this.chatEntitlementService.entitlement) : undefined;

		if (chatQuota || premiumChatQuota || completionsQuota) {

			// Global quota callout (shown at the top, before quota indicators)
			const globalCalloutUpdater = this.createGlobalQuotaCallout(container);
			const { calloutVisible: initialCalloutVisible } = globalCalloutUpdater();

			// Update header additional spend button visibility based on callout
			if (headerAdditionalSpendButton) {
				headerAdditionalSpendButton.element.style.display = initialCalloutVisible ? '' : 'none';
			}

			// Update header upgrade button visibility: hide when manage budget button is visible
			if (headerUpgradeButton) {
				headerUpgradeButton.element.style.display = (headerAdditionalSpendButton && initialCalloutVisible) ? 'none' : '';
			}

			let chatQuotaIndicator: ((quota: IQuotaSnapshot | string) => void) | undefined;
			if (chatQuota && !chatQuota.unlimited && (!this.chatEntitlementService.quotas.usageBasedBilling || this.chatEntitlementService.entitlement === ChatEntitlement.Free)) {
				const chatLabel = this.chatEntitlementService.quotas.usageBasedBilling && this.chatEntitlementService.entitlement === ChatEntitlement.Free
					? localize('creditsLabel', "额度")
					: localize('chatsLabel', "对话消息");
				chatQuotaIndicator = this.createQuotaIndicator(container, chatQuota, chatLabel, this.formatQuotaResetLabel(chatQuota), compact ? planName : undefined);
			}

			let premiumChatQuotaIndicator: ((quota: IQuotaSnapshot | string) => void) | undefined;
			if (premiumChatQuota && !premiumChatQuota.unlimited && premiumChatQuota.percentRemaining >= 0) {
				const isUBB = this.chatEntitlementService.quotas.usageBasedBilling;
				const premiumChatLabel = isUBB
					? localize('creditsLabel', "额度")
					: this.chatEntitlementService.quotas.additionalUsageEnabled ? localize('includedPremiumChatsLabel', "包含的高级请求") : localize('premiumChatsLabel', "高级请求");
				premiumChatQuotaIndicator = this.createQuotaIndicator(container, premiumChatQuota, premiumChatLabel, this.formatQuotaResetLabel(premiumChatQuota), compact ? planName : undefined);
			}

			// Additional Budget indicator (overage bar, shown when overage_entitlement > 0)
			let additionalBudgetIndicator: ((quota: IQuotaSnapshot | string) => void) | undefined;
			let additionalBudgetElement: HTMLElement | undefined;
			const initialOverageEntitlement = this.chatEntitlementService.quotas.additionalUsageEntitlement ?? 0;
			if (initialOverageEntitlement > 0) {
				const overageCount = this.chatEntitlementService.quotas.additionalUsageCount ?? 0;
				const overagePercentRemaining = Math.max(0, Math.min(100, ((initialOverageEntitlement - overageCount) / initialOverageEntitlement) * 100));
				const overageSnapshot: IQuotaSnapshot = {
					percentRemaining: overagePercentRemaining,
					unlimited: false,
					entitlement: initialOverageEntitlement,
					quotaRemaining: Math.max(0, initialOverageEntitlement - overageCount),
					resetAt: premiumChatQuota?.resetAt,
				};
				const additionalBudgetLabel = localize('additionalBudgetLabel', "额外预算");
				additionalBudgetIndicator = this.createQuotaIndicator(container, overageSnapshot, additionalBudgetLabel, this.formatQuotaResetLabel(overageSnapshot), compact ? additionalBudgetLabel : undefined);
				additionalBudgetElement = container.lastElementChild as HTMLElement;
				const isPremiumExhausted = premiumChatQuota && premiumChatQuota.percentRemaining <= 0;
				if (!isPremiumExhausted) {
					additionalBudgetElement.classList.add('muted');
				}
			}

			let completionsQuotaIndicator: ((quota: IQuotaSnapshot | string) => void) | undefined;
			const showCompletions = !compact && completionsQuota && !completionsQuota.unlimited && completionsQuota.percentRemaining >= 0
				&& (!this.chatEntitlementService.quotas.usageBasedBilling || this.chatEntitlementService.entitlement === ChatEntitlement.Free);
			if (showCompletions) {
				completionsQuotaIndicator = this.createQuotaIndicator(container, completionsQuota, localize('completionsLabel', "内联建议"), this.formatQuotaResetLabel(completionsQuota), compact ? planName : undefined);
			}

			// Update indicators from current quota state
			const updateIndicators = () => {
				const { chat: chatQuota, premiumChat: premiumChatQuota, completions: completionsQuota } = this.chatEntitlementService.quotas;
				if (chatQuota) {
					chatQuotaIndicator?.(chatQuota);
				}
				if (premiumChatQuota) {
					premiumChatQuotaIndicator?.(premiumChatQuota);
				}
				if (completionsQuota) {
					completionsQuotaIndicator?.(completionsQuota);
				}
				if (additionalBudgetIndicator && additionalBudgetElement) {
					const overageEntitlement = this.chatEntitlementService.quotas.additionalUsageEntitlement ?? 0;
					const overageCount = this.chatEntitlementService.quotas.additionalUsageCount ?? 0;
					if (overageEntitlement > 0) {
						const overagePercentRemaining = Math.max(0, Math.min(100, ((overageEntitlement - overageCount) / overageEntitlement) * 100));
						additionalBudgetIndicator({
							percentRemaining: overagePercentRemaining,
							unlimited: false,
							entitlement: overageEntitlement,
							quotaRemaining: Math.max(0, overageEntitlement - overageCount),
						});
					}
					const premiumExhausted = premiumChatQuota && premiumChatQuota.percentRemaining <= 0;
					additionalBudgetElement.classList.toggle('muted', !premiumExhausted);
				}
				const { calloutVisible } = globalCalloutUpdater();
				if (headerAdditionalSpendButton) {
					headerAdditionalSpendButton.element.style.display = calloutVisible ? '' : 'none';
					headerAdditionalSpendButton.label = localize('manageBudget', "管理预算");
				}
				if (headerUpgradeButton) {
					headerUpgradeButton.element.style.display = (headerAdditionalSpendButton && calloutVisible) ? 'none' : '';
				}
			};

			// Update once when the initial fetch completes
			(async () => {
				await updatePromise;
				if (token.isCancellationRequested) {
					return;
				}
				updateIndicators();
			})();

			// Update dynamically when quota data changes while the dashboard is open
			this._store.add(this.chatEntitlementService.onDidChangeQuotaRemaining(() => updateIndicators()));
			this._store.add(this.chatEntitlementService.onDidChangeQuotaExceeded(() => updateIndicators()));
		}

		// Anonymous Indicator
		else if (this.chatEntitlementService.anonymous && this.chatEntitlementService.sentiment.completed) {
			this.createQuotaIndicator(container, localize('quotaLimited', "受限"), localize('chatsLabel', "对话消息"));
		}
	}

	private renderInlineSuggestionsSection(hasContentAbove: boolean): void {
		const nonCollapsible = !!this.options?.disableQuickSettingsCollapsible;
		const collapsed = !nonCollapsible && this.storageService.getBoolean(ChatStatusDashboard.QUICK_SETTINGS_COLLAPSED_KEY, StorageScope.PROFILE, true);

		// Compute status based on effective enablement for the active editor's language
		const activeLanguageId = this.editorService.activeTextEditorLanguageId;
		const getStatusText = () => {
			if (!this.canUseChat()) {
				return localize('inlineSuggestionsDisabled', "已禁用");
			}
			const enabled = activeLanguageId
				? isCompletionsEnabled(this.configurationService, activeLanguageId)
				: isCompletionsEnabled(this.configurationService);
			return enabled
				? localize('inlineSuggestionsEnabled', "已启用")
				: localize('inlineSuggestionsDisabled', "已禁用");
		};

		let disclosureHeader: HTMLElement | undefined;
		let chevron: HTMLElement | undefined;
		let statusEl: HTMLElement | undefined;
		if (!nonCollapsible) {
			disclosureHeader = this.element.appendChild($('button.collapsible-header'));
			if (!hasContentAbove) {
				disclosureHeader.classList.add('no-border');
			}
			disclosureHeader.setAttribute('aria-expanded', String(!collapsed));

			disclosureHeader.appendChild($('span.collapsible-label', undefined, localize('inlineSuggestionsTab', "内联建议")));

			chevron = disclosureHeader.appendChild($('span.collapsible-chevron'));
			chevron.classList.add(...ThemeIcon.asClassNameArray(collapsed ? Codicon.chevronRightCompact : Codicon.chevronDownCompact));

			statusEl = disclosureHeader.appendChild($('span.collapsible-status', undefined, getStatusText()));
		}

		const collapsibleContent = this.element.appendChild($('div.collapsible-content'));
		const collapsibleInner = collapsibleContent.appendChild($('div.collapsible-inner'));
		if (collapsed) {
			collapsibleContent.classList.add('collapsed');
			collapsibleInner.inert = true;
		}

		if (disclosureHeader && chevron) {
			const toggle = () => {
				const isCollapsed = collapsibleContent.classList.toggle('collapsed');
				collapsibleInner.inert = isCollapsed;
				disclosureHeader!.setAttribute('aria-expanded', String(!isCollapsed));
				chevron!.className = 'collapsible-chevron';
				chevron!.classList.add(...ThemeIcon.asClassNameArray(isCollapsed ? Codicon.chevronRightCompact : Codicon.chevronDownCompact));
				this.storageService.store(ChatStatusDashboard.QUICK_SETTINGS_COLLAPSED_KEY, isCollapsed, StorageScope.PROFILE, StorageTarget.USER);
			};

			this._store.add(addDisposableListener(disclosureHeader, EventType.CLICK, () => toggle()));
		}

		// Update status text when completions setting changes
		if (statusEl) {
			this._store.add(this.configurationService.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration(defaultChat.completionsEnablementSetting)) {
					statusEl!.textContent = getStatusText();
				}
			}));
		}

		this.renderInlineSuggestionsContent(collapsibleInner);
	}

	private renderContributedSections(contributedEntries: ChatStatusEntry[]): void {
		for (const item of contributedEntries) {
			const headerLabel = typeof item.label === 'string' ? item.label : item.label.label;
			let headerLink = typeof item.label === 'string' ? undefined : item.label.link;
			let linkDescription = typeof item.label === 'string' ? undefined : item.label.helpText;
			const section = this.element.appendChild($('div.contributed-section'));

			// Single non-collapsible header row
			const header = section.appendChild($('div.collapsible-header.non-collapsible'));
			header.appendChild($('span.collapsible-label', undefined, headerLabel));

			// Info icon (replaces chevron) — shows helpText in a nested hover
			if (linkDescription || headerLink) {
				const infoIcon = header.appendChild($('span.contributed-info-icon'));
				infoIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.info));

				this._store.add(this.hoverService.setupDelayedHover(infoIcon, () => {
					const hoverContent = new MarkdownString('', { isTrusted: true });
					if (linkDescription) {
						hoverContent.appendText(linkDescription);
					}
					if (headerLink) {
						if (linkDescription) {
							hoverContent.appendText(' ');
						}
						hoverContent.appendMarkdown(`[${localize('learnMore', "了解更多")}](${headerLink})`);
					}
					return { content: hoverContent };
				}, { reducedDelay: true }));
			}

			// Status text (right-aligned via margin-left: auto)
			const statusEl = header.appendChild($('span.collapsible-status'));
			const statusDisposables = this._store.add(new MutableDisposable<DisposableStore>());
			const renderStatus = (text: string): void => {
				const newStore = new DisposableStore();
				statusDisposables.value = newStore;
				this.renderTextPlus(statusEl, text, newStore);
			};
			renderStatus(item.description);

			// Show tooltip on hover of the status text
			let currentTooltip = item.tooltip;
			if (currentTooltip) {
				this._store.add(this.hoverService.setupDelayedHover(statusEl, () => ({
					content: currentTooltip ?? '',
				}), { reducedDelay: true }));
			}

			// Detail (action link) rendered inline
			const sectionDisposables = this._store.add(new MutableDisposable());
			const sectionStore = new DisposableStore();
			sectionDisposables.value = sectionStore;

			let detailEl: HTMLElement | undefined;
			if (item.detail) {
				detailEl = section.appendChild($('div.contributed-detail'));
				this.renderTextPlus(detailEl, item.detail, sectionStore);
			}

			// Listen for updates to re-render status and detail
			this._store.add(this.chatStatusItemService.onDidChange(e => {
				if (e.entry.id === item.id) {
					// Update status in header
					statusEl.textContent = '';
					renderStatus(e.entry.description);
					currentTooltip = e.entry.tooltip;

					// Update mutable hover content references
					headerLink = typeof e.entry.label === 'string' ? undefined : e.entry.label.link;
					linkDescription = typeof e.entry.label === 'string' ? undefined : e.entry.label.helpText;

					// Re-render detail content
					const newStore = new DisposableStore();
					sectionDisposables.value = newStore;

					if (detailEl) {
						if (e.entry.detail) {
							detailEl.textContent = '';
							this.renderTextPlus(detailEl, e.entry.detail, newStore);
						} else {
							detailEl.remove();
							detailEl = undefined;
						}
					} else if (e.entry.detail) {
						detailEl = section.appendChild($('div.contributed-detail'));
						this.renderTextPlus(detailEl, e.entry.detail, newStore);
					}
				}
			}));
		}
	}

	private renderSetupSection(): void {
		const hasByokModels = this.chatEntitlementService.hasByokModels;
		const newUser = isNewUser(this.chatEntitlementService) && !hasByokModels;
		const anonymousUser = this.chatEntitlementService.anonymous;
		const disabled = this.chatEntitlementService.sentiment.disabled || this.chatEntitlementService.sentiment.untrusted;
		// Keep the Sign-in entry visible even when BYOK models are present so air-gapped
		// users can still authenticate to unlock the full Copilot experience.
		const signedOut = this.chatEntitlementService.entitlement === ChatEntitlement.Unknown;
		if (!(newUser || signedOut || disabled)) {
			return;
		}

		this.element.appendChild($('hr'));

		let descriptionText: string | MarkdownString;
		let descriptionClass = '.description';
		if (newUser && anonymousUser) {
			descriptionText = new MarkdownString(localize({ key: 'activeDescriptionAnonymous', comment: ['{Locked="]({2})"}', '{Locked="]({3})"}'] }, "继续使用 {0} Copilot 即表示你同意 {1} 的[条款]({2})和[隐私声明]({3})", defaultChat.provider.default.name, defaultChat.provider.default.name, defaultChat.termsStatementUrl, defaultChat.privacyStatementUrl), { isTrusted: true });
			descriptionClass = `${descriptionClass}.terms`;
		} else if (newUser) {
			descriptionText = localize('activateDescription', "设置 Copilot 以使用 AI 功能。");
		} else if (anonymousUser) {
			descriptionText = localize('enableMoreDescription', "登录以启用更多 Copilot AI 功能。");
		} else if (disabled) {
			descriptionText = localize('enableDescription', "启用 Copilot 以使用 AI 功能。");
		} else {
			descriptionText = localize('signInDescription', "登录以使用 GitHub Copilot AI 功能。");
		}

		let buttonLabel: string;
		if (newUser) {
			buttonLabel = localize('enableAIFeatures', "使用 AI 功能");
		} else if (anonymousUser) {
			buttonLabel = localize('enableMoreAIFeatures', "启用更多 AI 功能");
		} else if (disabled) {
			buttonLabel = localize('enableCopilotButton', "启用 AI 功能");
		} else {
			buttonLabel = localize('signInToUseAIFeatures', "登录以使用 GitHub Copilot");
		}

		let commandId: string;
		if (newUser && anonymousUser) {
			commandId = 'workbench.action.chat.triggerSetupAnonymousWithoutDialog';
		} else {
			commandId = 'workbench.action.chat.triggerSetup';
		}

		if (typeof descriptionText === 'string') {
			this.element.appendChild($(`div${descriptionClass}`, undefined, descriptionText));
		} else {
			this.element.appendChild($(`div${descriptionClass}`, undefined, this._store.add(this.markdownRendererService.render(descriptionText)).element));
		}

		const button = this._store.add(new Button(this.element, { ...defaultButtonStyles, hoverDelegate: nativeHoverDelegate }));
		button.label = buttonLabel;
		this._store.add(button.onDidClick(() => this.runCommandAndClose(commandId)));
	}

	private renderInlineSuggestionsContent(container: HTMLElement): void {
		// Settings (editor-specific)
		if (!this.options?.disableInlineSuggestionsSettings) {
			this.createSettings(container);
		}

		const providers = (!this.options?.disableModelSelection || !this.options?.disableProviderOptions) ? this.languageFeaturesService.inlineCompletionsProvider.allNoModel() : undefined;

		// Model Selection (editor-specific)
		if (!this.options?.disableModelSelection && providers) {
			const provider = providers.find(p => p.modelInfo && p.modelInfo.models.length > 0);

			if (provider) {
				const modelInfo = provider.modelInfo!;
				const currentModel = modelInfo.models.find(m => m.id === modelInfo.currentModelId);

				if (currentModel) {
					const modelContainer = container.appendChild($('div.model-selection'));

					modelContainer.appendChild($('span.model-text', undefined, localize('modelLabel', "模型")));

					const selectOptions = modelInfo.models.map(m => ({ text: m.name }));
					const selectedIndex = modelInfo.models.findIndex(m => m.id === modelInfo.currentModelId);
					const selectBox = this._store.add(new SelectBox(selectOptions, Math.max(0, selectedIndex), this.contextViewService, defaultSelectBoxStyles, { ariaLabel: localize('selectModel', "选择模型"), optionsAsChildren: true }));
					const selectContainer = modelContainer.appendChild($('div.model-select-container'));
					selectBox.render(selectContainer);
					this._store.add(selectBox.onDidSelect(async e => {
						const selectedModel = modelInfo.models[e.index];
						if (selectedModel && selectedModel.id !== modelInfo.currentModelId && provider.setModelId) {
							await provider.setModelId(selectedModel.id);
						}
					}));
				}
			}
		}

		// Provider Options (editor-specific)
		if (!this.options?.disableProviderOptions && providers) {
			for (const provider of providers) {
				if (provider.providerOptions && provider.providerOptions.length > 0) {
					for (const option of provider.providerOptions) {
						const currentValue = option.values.find(v => v.id === option.currentValueId);
						if (currentValue) {
							const optionContainer = container.appendChild($('div.suggest-option-selection'));

							optionContainer.appendChild($('span.suggest-option-text', undefined, option.label));

							const selectOptions = option.values.map(v => ({ text: v.label }));
							const selectedIndex = option.values.findIndex(v => v.id === option.currentValueId);
							const selectBox = this._store.add(new SelectBox(selectOptions, Math.max(0, selectedIndex), this.contextViewService, defaultSelectBoxStyles, { ariaLabel: localize('selectOption', "选择 {0}", option.label), optionsAsChildren: true }));
							const selectContainer = optionContainer.appendChild($('div.suggest-option-select-container'));
							selectBox.render(selectContainer);
							this._store.add(selectBox.onDidSelect(async e => {
								const selectedValue = option.values[e.index];
								if (selectedValue && selectedValue.id !== option.currentValueId && provider.setProviderOption) {
									await provider.setProviderOption(option.id, selectedValue.id);
								}
							}));
						}
					}
				}
			}
		}

		// Completions Snooze (editor-specific)
		if (!this.options?.disableCompletionsSnooze && this.canUseChat()) {
			const snooze = append(container, $('div.snooze-completions'));
			this.createCompletionsSnooze(snooze, localize('settings.snooze', "暂缓"));
		}
	}

	private canUseChat(): boolean {
		if (!this.chatEntitlementService.sentiment.completed || this.chatEntitlementService.sentiment.disabled || this.chatEntitlementService.sentiment.untrusted) {
			return false; // chat not completed or not enabled
		}

		if (this.chatEntitlementService.entitlement === ChatEntitlement.Unknown || this.chatEntitlementService.entitlement === ChatEntitlement.Available) {
			return this.chatEntitlementService.anonymous; // signed out or not-yet-signed-up users can only use Chat if anonymous access is allowed
		}

		if (this.chatEntitlementService.entitlement === ChatEntitlement.Free && this.chatEntitlementService.quotas.chat?.percentRemaining === 0 && this.chatEntitlementService.quotas.completions?.percentRemaining === 0) {
			return false; // free user with no quota left
		}

		return true;
	}

	private renderHeader(container: HTMLElement, disposables: DisposableStore, label: string, action?: IAction): HTMLElement {
		const header = container.appendChild($('div.header'));
		header.appendChild($('span.header-label', undefined, label));

		if (action) {
			const toolbar = disposables.add(new ActionBar(header, { hoverDelegate: nativeHoverDelegate }));
			toolbar.push([action], { icon: true, label: false });
		}

		return header;
	}

	private renderTextPlus(target: HTMLElement, text: string, store: DisposableStore): void {
		for (const node of parseLinkedText(text).nodes) {
			if (typeof node === 'string') {
				const parts = renderLabelWithIcons(node);
				target.append(...parts);
			} else {
				store.add(new Link(target, node, undefined, this.hoverService, this.openerService));
			}
		}
	}

	private openGitHubUrl(path: string): void {
		const url = this.defaultAccountService.resolveGitHubUrl(path);
		if (!url) {
			this.notificationService.error(localize('githubUrlUnavailable', "无法获取 GitHub Enterprise 地址。请登录后重试。"));
			return;
		}
		this.openerService.open(URI.parse(url));
	}

	private runCommandAndClose(commandOrFn: string | ((...args: unknown[]) => void), ...args: unknown[]): void {
		if (typeof commandOrFn === 'function') {
			commandOrFn(...args);
		} else {
			this.telemetryService.publicLog2<WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification>('workbenchActionExecuted', { id: commandOrFn, from: 'chat-status' });
			this.commandService.executeCommand(commandOrFn, ...args);
		}

		this.hoverService.hideHover(true);
	}

	private formatQuotaResetLabel(quota: IQuotaSnapshot | undefined): string | undefined {
		const reset = getQuotaReset(quota, this.chatEntitlementService.quotas);
		if (!reset) {
			return undefined;
		}

		return reset.hasTime
			? localize('quotaResetsAt', "{0} 将于 {1} 重置", this.dateFormatter.value.format(reset.date), this.timeFormatter.value.format(reset.date))
			: localize('quotaResets', "{0} 将重置", this.dateFormatter.value.format(reset.date));
	}

	private createCreditsUsedIndicator(container: HTMLElement, creditsUsed: number, resetLabel: string | undefined): void {
		const isCompact = !!this.options?.compactQuotaLayout;

		const resetValue = $('span.quota-reset');
		if (resetLabel) {
			resetValue.textContent = resetLabel;
		}

		const quotaPercentage = $('div.quota-percentage', undefined,
			$('span.quota-value', undefined, this.quotaCreditsFormatter.value.format(creditsUsed)),
			$('span.quota-value-suffix', undefined, isCompact
				? localize('quotaLabelUsed', "已用 {0}", localize('creditsLabel', "额度"))
				: localize('creditsUsedLabel', "Credits Used"))
		);

		const indicatorElement = $('div.quota-indicator.included.credits-used', undefined,
			...isCompact ? [$('div.quota-title', undefined, getChatPlanName(this.chatEntitlementService.entitlement))] : [],
			$('div.quota-details', undefined,
				quotaPercentage,
				resetValue
			)
		);
		if (isCompact) {
			indicatorElement.classList.add('compact');
		}

		container.appendChild(indicatorElement);
	}

	private createQuotaIndicator(container: HTMLElement, quota: IQuotaSnapshot | string, label: string, resetLabel?: string, compactTitle?: string): (quota: IQuotaSnapshot | string) => void {
		const isCompact = !!compactTitle;
		const quotaValue = $('span.quota-value');
		const quotaValueText = isCompact ? quotaValue.appendChild($('span.quota-value-text')) : quotaValue;
		const quotaValueSuffix = $('span.quota-value-suffix');
		const quotaBit = $('div.quota-bit');
		const resetValue = $('span.quota-reset');

		if (resetLabel) {
			resetValue.textContent = resetLabel;
		}

		const quotaPercentage = $('div.quota-percentage', undefined,
			quotaValue,
			quotaValueSuffix
		);
		quotaPercentage.tabIndex = isCompact ? -1 : 0;

		const indicatorElement = $('div.quota-indicator', undefined,
			$('div.quota-title', undefined,
				$('span', undefined, isCompact ? compactTitle : label),
				...isCompact ? [] : [resetValue]
			),
			$('div.quota-details', undefined,
				quotaPercentage,
				...isCompact ? [resetValue] : []
			),
			...isCompact ? [] : [$('div.quota-bar', undefined, quotaBit)]
		);
		if (isCompact) {
			indicatorElement.classList.add('compact');
		}
		container.appendChild(indicatorElement);

		let currentQuota: IQuotaSnapshot | string = quota;
		let isHovered = false;

		const showPercentage = () => {
			if (typeof currentQuota === 'string') {
				quotaValueText.textContent = currentQuota;
				quotaValueSuffix.textContent = '';
			} else {
				const usedPercentage = Math.max(0, 100 - currentQuota.percentRemaining);
				quotaValueText.textContent = localize('quotaDisplay', "{0}%", this.quotaPercentageFormatter.value.format(Math.floor(usedPercentage)));
				quotaValueSuffix.textContent = isCompact
					? localize('quotaLabelUsed', "已用 {0}", label)
					: ` ${localize('quotaUsed', "已使用")}`;
			}
		};

		const showCredits = () => {
			if (typeof currentQuota === 'string') {
				return;
			}

			const usage = getQuotaUsage(currentQuota);
			if (usage?.kind !== QuotaUsageKind.Percentage || usage.used === undefined || usage.total === undefined) {
				return;
			}

			const usedFormatted = this.quotaCreditsFormatter.value.format(usage.used);
			const totalFormatted = this.quotaCreditsFormatter.value.format(usage.total);
			quotaValueText.textContent = localize('quotaCreditsDisplay', "{0} / {1}", usedFormatted, totalFormatted);
			quotaValueSuffix.textContent = isCompact
				? localize('quotaLabelUsed', "已用 {0}", label)
				: ` ${localize('quotaUsed', "已使用")}`;
		};

		const hoverTarget = isCompact ? quotaValueText : quotaPercentage;
		this._store.add(addDisposableListener(hoverTarget, EventType.MOUSE_ENTER, () => { isHovered = true; showCredits(); }));
		this._store.add(addDisposableListener(hoverTarget, EventType.MOUSE_LEAVE, () => { isHovered = false; showPercentage(); }));
		this._store.add(addDisposableListener(hoverTarget, EventType.FOCUS, () => { isHovered = true; showCredits(); }));
		this._store.add(addDisposableListener(hoverTarget, EventType.BLUR, () => { isHovered = false; showPercentage(); }));

		const update = (quota: IQuotaSnapshot | string) => {
			currentQuota = quota;

			let usedPercentage: number;
			if (typeof quota === 'string') {
				usedPercentage = 0;
			} else {
				usedPercentage = Math.max(0, 100 - quota.percentRemaining);
			}

			if (isHovered) {
				showCredits();
			} else {
				showPercentage();
			}
			quotaBit.style.width = `${usedPercentage}%`;
		};

		update(quota);

		return update;
	}

	private createGlobalQuotaCallout(container: HTMLElement): () => { calloutVisible: boolean; additionalUsageEnabled: boolean } {
		const calloutIcon = $('span.callout-icon');
		const calloutText = $('span.callout-text');
		const quotaCallout = container.appendChild($('div.quota-callout', undefined, calloutIcon, calloutText));
		quotaCallout.style.display = 'none';

		const update = () => {
			const quotas = this.chatEntitlementService.quotas;
			const additionalUsageEnabled = quotas.additionalUsageEnabled ?? false;
			const isEnterpriseUser = this.chatEntitlementService.entitlement === ChatEntitlement.Enterprise || this.chatEntitlementService.entitlement === ChatEntitlement.Business;
			const isUsageBasedBilling = quotas.usageBasedBilling === true;

			// Only chat quotas drive the global callout. Reaching the inline
			// suggestions (completions) limit pauses ghost text only, so it must
			// not trigger the "Copilot is paused" message reserved for chat limits.
			const allQuotas: IQuotaSnapshot[] = [];
			if (quotas.chat && !quotas.chat.unlimited) { allQuotas.push(quotas.chat); }
			if (quotas.premiumChat && !quotas.premiumChat.unlimited) { allQuotas.push(quotas.premiumChat); }

			const maxUsedPercentage = allQuotas.length > 0 ? Math.max(...allQuotas.map(q => Math.max(0, 100 - q.percentRemaining))) : 0;
			const isPooledQuotaExhausted = quotas.premiumChat?.unlimited && quotas.premiumChat.hasQuota === false;

			// Business/Enterprise: hasQuota === false is the authoritative signal
			// that the org has blocked usage, regardless of overages or remaining quota.
			if (isEnterpriseUser && isPooledQuotaExhausted) {
				quotaCallout.style.display = '';
				quotaCallout.className = 'quota-callout info';
				calloutIcon.className = `callout-icon ${ThemeIcon.asClassName(Codicon.info)}`;
				calloutText.textContent = localize('quotaBudgetExceededEnterprise', "你的组织或企业已超出其 Copilot 预算。请与管理员联系以恢复使用。");
			} else if (maxUsedPercentage >= 100 && additionalUsageEnabled) {
				quotaCallout.style.display = '';
				quotaCallout.className = 'quota-callout info';
				calloutIcon.className = `callout-icon ${ThemeIcon.asClassName(Codicon.info)}`;
				calloutText.textContent = isEnterpriseUser
					? localize('quotaAdditionalUsageActiveEnterprise', "Copilot 已暂停，因为已达到限制。请联系管理员以提高限制。")
					: isUsageBasedBilling
						? localize('quotaAdditionalUsageActive', "已配置额外预算。使用将持续到限制重置。")
						: localize('quotaBudgetActive', "已配置高级请求预算。使用将持续到限制重置。");
			} else if (maxUsedPercentage >= 75 && maxUsedPercentage < 100 && additionalUsageEnabled) {
				quotaCallout.style.display = '';
				quotaCallout.className = 'quota-callout info';
				calloutIcon.className = `callout-icon ${ThemeIcon.asClassName(Codicon.info)}`;
				calloutText.textContent = isEnterpriseUser
					? localize('quotaAdditionalUsageApproachingEnterprise', "达到限制时，Copilot 将暂停。请联系管理员以提高限制。")
					: isUsageBasedBilling
						? localize('quotaAdditionalUsageApproaching', "达到限制后使用额外预算。")
						: localize('quotaBudgetApproaching', "达到限制后，将使用高级请求预算。");
			} else if ((maxUsedPercentage >= 100 || isPooledQuotaExhausted) && !additionalUsageEnabled) {
				quotaCallout.style.display = '';
				quotaCallout.className = 'quota-callout info';
				calloutIcon.className = `callout-icon ${ThemeIcon.asClassName(Codicon.info)}`;
				calloutText.textContent = isEnterpriseUser
					? localize('quotaPausedEnterprise', "Copilot 已暂停，直至配额重置。请与管理员联系以获取详细信息。")
					: localize('quotaPaused', "Copilot 已暂停，直至配额重置。");
			} else if (maxUsedPercentage >= 75 && !additionalUsageEnabled) {
				quotaCallout.style.display = '';
				quotaCallout.className = 'quota-callout info';
				calloutIcon.className = `callout-icon ${ThemeIcon.asClassName(Codicon.info)}`;
				calloutText.textContent = isEnterpriseUser
					? localize('quotaWarningEnterprise', "达到限制时，Copilot 将暂停。请与管理员联系以获取详细信息。")
					: localize('quotaWarning', "达到限制时，Copilot 将暂停。");
			} else {
				quotaCallout.style.display = 'none';
			}

			return { calloutVisible: quotaCallout.style.display !== 'none', additionalUsageEnabled };
		};

		update();

		return update;
	}

	private createSettings(container: HTMLElement): void {
		const modeId = this.editorService.activeTextEditorLanguageId;
		const settings = container.appendChild($('div.settings'));

		// --- Inline Suggestions
		{
			const globalSetting = append(settings, $('div.setting'));
			this.createInlineSuggestionsSetting(globalSetting, localize('settings.codeCompletions.allFiles', "幽灵文本建议"), '*');

			const overriddenHint = globalSetting.appendChild($('span.setting-overridden'));
			const updateOverriddenHint = () => {
				const obj = this.configurationService.getValue<Record<string, boolean>>(defaultChat.completionsEnablementSetting);
				const configuredValue = modeId ? this.findConfiguredCompletionsValue(modeId) : undefined;
				const hasOverride = modeId && configuredValue && isObject(obj) && Boolean(configuredValue.value[modeId]) !== Boolean(obj['*']);
				overriddenHint.textContent = hasOverride ? localize('settings.overridden', "（已覆盖）") : '';
			};
			updateOverriddenHint();

			if (modeId) {
				const languageSetting = append(settings, $('div.setting'));
				const languageName = this.languageService.getLanguageName(modeId) ?? modeId;
				this.createTriStateLanguageSetting(languageSetting, localize('settings.codeCompletions.language', "{0} 的幽灵文本建议", languageName), modeId, updateOverriddenHint);
			}
		}

		// --- Next edit suggestions
		{
			const setting = append(settings, $('div.setting'));
			this.createNextEditSuggestionsSetting(setting, localize('settings.nextEditSuggestions', "下一处编辑建议"), this.getCompletionsSettingAccessor(modeId));
		}
	}

	private createSetting(container: HTMLElement, settingIdsToReEvaluate: string[], label: string, accessor: ISettingsAccessor): Checkbox {
		const checkbox = this._store.add(new Checkbox(label, Boolean(accessor.readSetting()), { ...defaultCheckboxStyles }));
		container.appendChild(checkbox.domNode);

		const settingLabel = append(container, $('span.setting-label', undefined, label));
		this._store.add(Gesture.addTarget(settingLabel));
		[EventType.CLICK, TouchEventType.Tap].forEach(eventType => {
			this._store.add(addDisposableListener(settingLabel, eventType, e => {
				if (checkbox?.enabled) {
					EventHelper.stop(e, true);

					checkbox.checked = !checkbox.checked;
					accessor.writeSetting(checkbox.checked);
					checkbox.focus();
				}
			}));
		});

		this._store.add(checkbox.onChange(() => {
			accessor.writeSetting(checkbox.checked);
		}));

		this._store.add(this.configurationService.onDidChangeConfiguration(e => {
			if (settingIdsToReEvaluate.some(id => e.affectsConfiguration(id))) {
				checkbox.checked = Boolean(accessor.readSetting());
			}
		}));

		if (!this.canUseChat()) {
			container.classList.add('disabled');
			checkbox.disable();
			checkbox.checked = false;
		}

		return checkbox;
	}

	private createInlineSuggestionsSetting(container: HTMLElement, label: string, modeId: string | undefined): void {
		this.createSetting(container, [defaultChat.completionsEnablementSetting], label, this.getCompletionsSettingAccessor(modeId));
	}

	private createTriStateLanguageSetting(container: HTMLElement, label: string, modeId: string, onStateChange: () => void): void {
		const settingId = defaultChat.completionsEnablementSetting;

		const getState = (): boolean | 'mixed' => {
			const configuredValue = this.findConfiguredCompletionsValue(modeId);
			return configuredValue ? Boolean(configuredValue.value[modeId]) : 'mixed';
		};

		let requestedState = getState();
		let pendingWrites = 0;
		const checkbox = this._store.add(new TriStateCheckbox(label, requestedState, { ...defaultCheckboxStyles }));
		container.appendChild(checkbox.domNode);

		const settingLabel = append(container, $('span.setting-label', undefined, label));
		this._store.add(Gesture.addTarget(settingLabel));
		const writeSequencer = new Sequencer();
		const renderState = (state: boolean | 'mixed') => {
			requestedState = state;
			checkbox.checked = state;
			checkbox.domNode.setAttribute('aria-checked', state === 'mixed' ? 'mixed' : String(state));
		};
		const getNextState = () => requestedState === true ? false : requestedState === false ? 'mixed' : true;

		const writeState = async (state: boolean | 'mixed') => {
			const configuredValue = this.findConfiguredCompletionsValue(modeId) ?? this.findConfiguredCompletionsValue();
			if (state === 'mixed') {
				for (const configuredValue of this.findConfiguredCompletionsValues(modeId)) {
					const { [modeId]: _, ...rest } = configuredValue.value;
					await this.configurationService.updateValue(settingId, rest, configuredValue.target);
				}
			} else {
				const value = { ...configuredValue?.value, [modeId]: state };
				if (configuredValue) {
					await this.configurationService.updateValue(settingId, value, configuredValue.target);
				} else {
					await this.configurationService.updateValue(settingId, value);
				}
			}

			const enabled = isCompletionsEnabled(this.configurationService, modeId);
			this.telemetryService.publicLog2<ChatSettingChangedEvent, ChatSettingChangedClassification>('chatStatus.settingChanged', {
				settingIdentifier: settingId,
				settingMode: modeId,
				settingEnablement: enabled ? 'enabled' : 'disabled'
			});
		};
		const requestStateChange = () => {
			const state = getNextState();
			renderState(state);
			pendingWrites++;
			void writeSequencer.queue(async () => {
				try {
					await writeState(state);
				} finally {
					pendingWrites--;
				}
			}).catch(error => {
				if (pendingWrites === 0) {
					renderState(getState());
					onStateChange();
				}
				this.notificationService.error(error);
			});
		};
		renderState(requestedState);

		[EventType.CLICK, TouchEventType.Tap].forEach(eventType => {
			this._store.add(addDisposableListener(settingLabel, eventType, e => {
				if (checkbox?.enabled) {
					EventHelper.stop(e, true);
					requestStateChange();
					checkbox.focus();
				}
			}));
		});

		this._store.add(checkbox.onChange(() => {
			renderState(requestedState);
			requestStateChange();
		}));

		this._store.add(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(settingId)) {
				const state = getState();
				if (pendingWrites === 0 || state === requestedState) {
					renderState(state);
					onStateChange();
				}
			}
		}));

		if (!this.canUseChat()) {
			container.classList.add('disabled');
			checkbox.disable();
			checkbox.checked = false;
		}
	}

	private findConfiguredCompletionsValue(modeId?: string): { target: ConfigurationTarget; value: Record<string, boolean> } | undefined {
		return this.findConfiguredCompletionsValues(modeId)[0];
	}

	private findConfiguredCompletionsValues(modeId?: string): { target: ConfigurationTarget; value: Record<string, boolean> }[] {
		const inspected = this.configurationService.inspect<Record<string, boolean>>(defaultChat.completionsEnablementSetting);
		const result: { target: ConfigurationTarget; value: Record<string, boolean> }[] = [];
		for (const target of completionsConfigurationTargets) {
			const value = getConfigValueInTarget(inspected, target);
			if (isObject(value) && (!modeId || Object.prototype.hasOwnProperty.call(value, modeId))) {
				result.push({ target, value });
			}
		}
		return result;
	}

	private getCompletionsSettingAccessor(modeId = '*'): ISettingsAccessor {
		const settingId = defaultChat.completionsEnablementSetting;

		return {
			readSetting: () => isCompletionsEnabled(this.configurationService, modeId),
			writeSetting: (value: boolean) => {
				this.telemetryService.publicLog2<ChatSettingChangedEvent, ChatSettingChangedClassification>('chatStatus.settingChanged', {
					settingIdentifier: settingId,
					settingMode: modeId,
					settingEnablement: value ? 'enabled' : 'disabled'
				});

				let result = this.configurationService.getValue<Record<string, boolean>>(settingId);
				if (!isObject(result)) {
					result = Object.create(null);
				}

				return this.configurationService.updateValue(settingId, { ...result, [modeId]: value });
			}
		};
	}

	private createNextEditSuggestionsSetting(container: HTMLElement, label: string, completionsSettingAccessor: ISettingsAccessor): void {
		const nesSettingId = defaultChat.nextEditSuggestionsSetting;
		const completionsSettingId = defaultChat.completionsEnablementSetting;
		const resource = EditorResourceAccessor.getOriginalUri(this.editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });

		const checkbox = this.createSetting(container, [nesSettingId, completionsSettingId], label, {
			readSetting: () => completionsSettingAccessor.readSetting() && this.textResourceConfigurationService.getValue<boolean>(resource, nesSettingId),
			writeSetting: (value: boolean) => {
				this.telemetryService.publicLog2<ChatSettingChangedEvent, ChatSettingChangedClassification>('chatStatus.settingChanged', {
					settingIdentifier: nesSettingId,
					settingEnablement: value ? 'enabled' : 'disabled'
				});

				return this.textResourceConfigurationService.updateValue(resource, nesSettingId, value);
			}
		});

		// enablement of NES depends on completions setting
		// so we have to update our checkbox state accordingly
		if (!completionsSettingAccessor.readSetting()) {
			container.classList.add('disabled');
			checkbox.disable();
		}

		this._store.add(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(completionsSettingId)) {
				if (completionsSettingAccessor.readSetting() && this.canUseChat()) {
					checkbox.enable();
					container.classList.remove('disabled');
				} else {
					checkbox.disable();
					container.classList.add('disabled');
				}
			}
		}));
	}

	private createCompletionsSnooze(container: HTMLElement, label: string): void {
		const isEnabled = () => {
			const completionsEnabled = isCompletionsEnabled(this.configurationService);
			const completionsEnabledActiveLanguage = isCompletionsEnabled(this.configurationService, this.editorService.activeTextEditorLanguageId);
			return completionsEnabled || completionsEnabledActiveLanguage;
		};

		const button = this._store.add(new Button(container, { disabled: !isEnabled(), ...defaultButtonStyles, hoverDelegate: nativeHoverDelegate, secondary: true }));

		const timerDisplay = container.appendChild($('span.snooze-label'));

		const actionBar = container.appendChild($('div.snooze-action-bar'));
		const toolbar = this._store.add(new ActionBar(actionBar, { hoverDelegate: nativeHoverDelegate }));
		const cancelAction = toAction({
			id: 'workbench.action.cancelSnoozeStatusBarLink',
			label: localize('cancelSnooze', "取消暂缓"),
			run: () => this.inlineCompletionsService.cancelSnooze(),
			class: ThemeIcon.asClassName(Codicon.stopCircle)
		});

		const update = (isEnabled: boolean) => {
			container.classList.toggle('disabled', !isEnabled);
			toolbar.clear();

			const timeLeftMs = this.inlineCompletionsService.snoozeTimeLeft;
			if (!isEnabled || timeLeftMs <= 0) {
				timerDisplay.textContent = localize('completions.snooze5minutesTitle', "隐藏建议 5 分钟");
				timerDisplay.title = '';
				button.label = label;
				button.setTitle(localize('completions.snooze5minutes', "隐藏内联建议 5 分钟"));
				return true;
			}

			const timeLeftSeconds = Math.ceil(timeLeftMs / 1000);
			const minutes = Math.floor(timeLeftSeconds / 60);
			const seconds = timeLeftSeconds % 60;

			timerDisplay.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds} ${localize('completions.remainingTime', "剩余")}`;
			timerDisplay.title = localize('completions.snoozeTimeDescription', "内联建议将在剩余时间内保持隐藏");
			button.label = localize('completions.plus5min', "+5 分钟");
			button.setTitle(localize('completions.snoozeAdditional5minutes', "再暂缓 5 分钟"));
			toolbar.push([cancelAction], { icon: true, label: false });

			return false;
		};

		// Update every second if there's time remaining
		const timerDisposables = this._store.add(new DisposableStore());
		function updateIntervalTimer() {
			timerDisposables.clear();
			const enabled = isEnabled();

			if (update(enabled)) {
				return;
			}

			timerDisposables.add(disposableWindowInterval(
				getWindow(container),
				() => update(enabled),
				1000
			));
		}
		updateIntervalTimer();

		this._store.add(button.onDidClick(() => {
			this.inlineCompletionsService.snooze();
			update(isEnabled());
		}));

		this._store.add(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(defaultChat.completionsEnablementSetting)) {
				button.enabled = isEnabled();
			}
			updateIntervalTimer();
		}));

		this._store.add(this.inlineCompletionsService.onDidChangeIsSnoozing(() => {
			updateIntervalTimer();
		}));
	}
}
