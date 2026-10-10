/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/aiCustomizationWelcomePromptLaunchers.css';
import * as DOM from '../../../../../base/browser/dom.js';
import { DomScrollableElement } from '../../../../../base/browser/ui/scrollbar/scrollableElement.js';
import { ScrollbarVisibility } from '../../../../../base/common/scrollable.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import type { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { AICustomizationManagementSection } from './aiCustomizationManagement.js';
import { agentIcon, instructionsIcon, pluginIcon, skillIcon, hookIcon, toolsIcon } from './aiCustomizationIcons.js';
import { IAICustomizationWorkspaceService, IWelcomePageFeatures } from '../../common/aiCustomizationWorkspaceService.js';
import { PromptsType } from '../../common/promptSyntax/promptTypes.js';
import type { IAICustomizationWelcomePageImplementation, ICustomizationMigrationCategorySummary, IWelcomePageCallbacks } from './aiCustomizationWelcomePage.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { getDefaultHoverDelegate } from '../../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { CONFIGURE_DICTATION_INSTRUCTIONS_ACTION_ID, CONFIGURE_VOICE_INSTRUCTIONS_ACTION_ID } from '../actions/configureVoiceInstructionsAction.js';

const $ = DOM.$;

interface IPromptLaunchersCategoryDescription {
	readonly id: AICustomizationManagementSection;
	readonly label: string;
	readonly icon: ThemeIcon;
	readonly description: string;
	readonly promptType?: PromptsType;
}

interface IStandaloneCustomizationDescription {
	readonly label: string;
	readonly icon: ThemeIcon;
	readonly description: string;
	readonly commandId: string;
}

export class PromptLaunchersAICustomizationWelcomePage extends Disposable implements IAICustomizationWelcomePageImplementation {

	private readonly cardDisposables = this._register(new DisposableStore());

	readonly container: HTMLElement;
	private readonly scrollable: DomScrollableElement;
	private cardsContainer: HTMLElement | undefined;
	private firstCard: HTMLElement | undefined;
	private heading: HTMLElement | undefined;
	private inputElement: HTMLInputElement | undefined;
	private visibleSectionIds = new Set<AICustomizationManagementSection>();

	private sentLabel: HTMLElement | undefined;
	private submitBtn: HTMLElement | undefined;
	private inputRow: HTMLElement | undefined;
	private migrationCategories: readonly ICustomizationMigrationCategorySummary[] = [];

	private readonly categoryDescriptions: IPromptLaunchersCategoryDescription[] = [
		{
			id: AICustomizationManagementSection.Marketplace,
			label: localize('customizationMarketplace', "市场"),
			icon: Codicon.search,
			description: localize('customizationMarketplaceDesc', "Discover skills, MCP servers, and plugins for your agents. Review their sources before installing."),
		},
		{
			id: AICustomizationManagementSection.Agents,
			label: localize('agents', "智能体"),
			icon: agentIcon,
			description: localize('agentsDesc', "定义具有专属角色、工具访问权限和特定任务指令的自定义智能体。"),
			promptType: PromptsType.agent,
		},
		{
			id: AICustomizationManagementSection.Skills,
			label: localize('skills', "技能"),
			icon: skillIcon,
			description: localize('skillsDesc', "创建可重用的技能文件，提供特定领域知识和工作流。"),
			promptType: PromptsType.skill,
		},
		{
			id: AICustomizationManagementSection.Instructions,
			label: localize('instructions', "指令"),
			icon: instructionsIcon,
			description: localize('instructionsDesc', "设置始终生效的指令，在整个工作区或用户配置文件中引导 AI 行为。"),
			promptType: PromptsType.instructions,
		},
		{
			id: AICustomizationManagementSection.Hooks,
			label: localize('hooks', "钩子"),
			icon: hookIcon,
			description: localize('hooksDesc', "配置由保存文件或运行任务等事件触发的自动操作。"),
			promptType: PromptsType.hook,
		},
		{
			id: AICustomizationManagementSection.McpServers,
			label: localize('mcpServers', "MCP 服务器"),
			icon: Codicon.server,
			description: localize('mcpServersDesc', "连接外部工具服务器，通过自定义工具和数据源扩展 AI 功能。"),
		},
		{
			id: AICustomizationManagementSection.Plugins,
			label: localize('plugins', "插件"),
			icon: pluginIcon,
			description: localize('pluginsDesc', "安装和管理智能体插件，以添加更多工具、技能和集成。"),
		},
		{
			id: AICustomizationManagementSection.Tools,
			label: localize('tools', "工具"),
			icon: toolsIcon,
			description: localize('toolsDesc', "启用或禁用聊天可用的工具。"),
		},
	];

	private readonly standaloneCustomizations: IStandaloneCustomizationDescription[] = [
		{
			label: localize('voiceModeInstructions', "Voice Mode Instructions"),
			icon: Codicon.voiceMode,
			description: localize('voiceModeInstructionsDesc', "Customize Voice Mode behavior and terminology with voice.md."),
			commandId: CONFIGURE_VOICE_INSTRUCTIONS_ACTION_ID,
		},
		{
			label: localize('dictationInstructions', "Dictation Instructions"),
			icon: Codicon.mic,
			description: localize('dictationInstructionsDesc', "Customize Dictation terminology and transcript formatting with dictation.md."),
			commandId: CONFIGURE_DICTATION_INSTRUCTIONS_ACTION_ID,
		},
	];

	constructor(
		parent: HTMLElement,
		private readonly welcomePageFeatures: IWelcomePageFeatures | undefined,
		private readonly callbacks: IWelcomePageCallbacks,
		private readonly commandService: ICommandService,
		private readonly workspaceService: IAICustomizationWorkspaceService,
		private readonly hoverService: IHoverService,
		private harnessLabel: string,
	) {
		super();

		this.container = $('.welcome-prompts-content-container');
		this.scrollable = this._register(new DomScrollableElement(this.container, {
			horizontal: ScrollbarVisibility.Hidden,
			vertical: ScrollbarVisibility.Auto,
			useShadows: false,
		}));
		const scrollableNode = this.scrollable.getDomNode();
		scrollableNode.classList.add('welcome-prompts-scrollable');
		parent.appendChild(scrollableNode);

		// Re-scan whenever the wrapper changes size so the scrollbar reflects
		// the current overflow state. rebuildCards() scans after content changes.
		const resizeObserver = this._register(new DOM.DisposableResizeObserver('AICustomizationWelcomePagePromptLaunchers.scrollable', () => this.scrollable.scanDomNode()));
		this._register(resizeObserver.observe(scrollableNode));

		const welcomeInner = DOM.append(this.container, $('.welcome-prompts-inner'));

		this.heading = DOM.append(welcomeInner, $('h2.welcome-prompts-heading'));
		this.updateHeading();

		const subtitle = DOM.append(welcomeInner, $('p.welcome-prompts-subtitle'));
		subtitle.textContent = localize('welcomeSubtitle', "定制智能体在项目中的工作方式。为整个团队配置工作区自定义，或创建跨项目跟随你的个人自定义。");

		if (this.welcomePageFeatures?.showGettingStartedBanner !== false) {
			const gettingStarted = DOM.append(welcomeInner, $('.welcome-prompts-primary'));
			const header = DOM.append(gettingStarted, $('.welcome-prompts-section-label'));
			const icon = DOM.append(header, $('span.welcome-prompts-section-label-icon.codicon.codicon-sparkle'));
			icon.setAttribute('aria-hidden', 'true');
			const title = DOM.append(header, $('span'));
			title.textContent = localize('gettingStartedTitle', "自定义智能体");

			const description = DOM.append(gettingStarted, $('p.welcome-prompts-input-helper'));
			description.textContent = localize('gettingStartedDesc', "描述你的偏好和约定，以草拟智能体、技能和指令。");

			const inputRow = DOM.append(gettingStarted, $('.welcome-prompts-input-row'));
			this.inputRow = inputRow;
			this.inputElement = DOM.append(inputRow, $('input.welcome-prompts-input')) as HTMLInputElement;
			this.inputElement.type = 'text';
			this.inputElement.placeholder = localize('workflowInputPlaceholder', "偏好简洁的提交、全面的审查和经过测试的代码...");
			this.inputElement.setAttribute('aria-label', localize('workflowInputAriaLabel', "描述你的偏好以自定义智能体"));

			const submitBtn = DOM.append(inputRow, $('button.welcome-prompts-input-submit'));
			this.submitBtn = submitBtn;
			submitBtn.setAttribute('aria-label', localize('workflowSubmitAriaLabel', "自定义智能体"));
			this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate('element'), submitBtn, localize('workflowSubmitTooltip', "在聊天中打开")));
			const chevron = DOM.append(submitBtn, $('span.codicon.codicon-arrow-up'));
			chevron.setAttribute('aria-hidden', 'true');

			const updateSubmitState = () => {
				const hasValue = !!(this.inputElement?.value?.trim());
				(submitBtn as HTMLButtonElement).disabled = !hasValue;
				submitBtn.classList.toggle('welcome-prompts-input-submit-disabled', !hasValue);
			};

			const submit = () => {
				const value = this.inputElement?.value?.trim();
				if (!value) {
					return;
				}
				let query: string;
				if (this.workspaceService.isSessionsWindow) {
					query = `Generate agent customizations. ${value}`;
				} else {
					query = `/init ${value}`;
				}

				// Show confirmation immediately — before prefillChat so it's visible
				// even if prefillChat navigates focus away from this editor
				if (this.inputElement) {
					this.inputElement.value = '';
				}
				updateSubmitState();
				inputRow.classList.add('sent');
				submitBtn.style.display = 'none';
				if (this.sentLabel) {
					this.sentLabel.remove();
				}
				this.sentLabel = DOM.append(inputRow, $('span.welcome-prompts-sent-label'));
				this.sentLabel.setAttribute('role', 'status');
				this.sentLabel.setAttribute('aria-live', 'polite');
				this.sentLabel.textContent = localize('sentToChat', "已发送到聊天 ✓");

				this.callbacks.prefillChat(query, { isPartialQuery: false, newChat: true });
			};

			this._register(DOM.addDisposableListener(submitBtn, 'click', e => { e.stopPropagation(); submit(); }));
			this._register(DOM.addDisposableListener(this.inputElement, 'keydown', (e: KeyboardEvent) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					submit();
				}
			}));
			this._register(DOM.addDisposableListener(this.inputElement, 'input', () => {
				updateSubmitState();
				// Typing restores the input row from sent state
				this._clearSentState();
			}));
			updateSubmitState();
		}

		this.cardsContainer = DOM.append(welcomeInner, $('.welcome-prompts-cards'));
	}

	private _clearSentState(): void {
		if (this.sentLabel) {
			this.sentLabel.remove();
			this.sentLabel = undefined;
		}
		if (this.submitBtn) {
			this.submitBtn.style.display = '';
		}
		if (this.inputRow) {
			this.inputRow.classList.remove('sent');
		}
	}

	reset(): void {
		this._clearSentState();
	}

	rebuildCards(visibleSectionIds: ReadonlySet<AICustomizationManagementSection>): void {
		if (!this.cardsContainer) {
			return;
		}
		this.visibleSectionIds = new Set(visibleSectionIds);

		this.cardDisposables.clear();
		DOM.clearNode(this.cardsContainer);
		this.firstCard = undefined;

		if (this.migrationCategories.length > 0) {
			const migrationGrid = this.renderOverviewSection(
				localize('overviewNeedsAttention', "Needs Attention"),
				localize('overviewNeedsAttentionDescription', "Review customizations that need an update for the active agent."),
				'welcome-prompts-attention-section',
			);
			this.renderCustomizationMigrationCard(migrationGrid, this.migrationCategories);
		}

		const exploreGrid = this.renderOverviewSection(
			localize('overviewExploreCustomizations', "Explore Customizations"),
			localize('overviewExploreCustomizationsDescription', "Manage what the active agent knows and can do."),
			'welcome-prompts-explore-section',
		);
		for (const section of this.workspaceService.managementSections) {
			const category = this.categoryDescriptions.find(candidate => candidate.id === section);
			if (!category || !visibleSectionIds.has(category.id)) {
				continue;
			}

			const card = DOM.append(exploreGrid, $('button.welcome-prompts-card.welcome-prompts-navigation-card')) as HTMLButtonElement;
			card.type = 'button';
			card.setAttribute('aria-label', localize('openCustomizationCategory', "打开 {0}", category.label));
			if (!this.firstCard) {
				this.firstCard = card;
			}

			const cardHeader = DOM.append(card, $('.welcome-prompts-card-header'));
			const iconEl = DOM.append(cardHeader, $('.welcome-prompts-card-icon'));
			iconEl.classList.add(...ThemeIcon.asClassNameArray(category.icon));
			const labelEl = DOM.append(cardHeader, $('span.welcome-prompts-card-label'));
			labelEl.textContent = category.label;

			const descEl = DOM.append(card, $('p.welcome-prompts-card-description'));
			descEl.textContent = category.description;

			this.cardDisposables.add(DOM.addDisposableListener(card, 'click', () => {
				this.callbacks.selectSection(category.id);
			}));
		}

		if (!this.workspaceService.isSessionsWindow) {
			const otherGrid = this.renderOverviewSection(
				localize('overviewOtherCustomizations', "Other Customizations"),
				localize('overviewOtherCustomizationsDescription', "Configure specialized voice and dictation behavior."),
				'welcome-prompts-other-section',
			);
			for (const customization of this.standaloneCustomizations) {
				this.renderStandaloneCustomization(otherGrid, customization);
			}
		}

		// Content changed — recompute scroll dimensions.
		this.scrollable.scanDomNode();
	}

	private renderOverviewSection(title: string, description: string, className: string): HTMLElement {
		const section = DOM.append(this.cardsContainer!, $('.welcome-prompts-overview-section'));
		section.classList.add(className);
		const heading = DOM.append(section, $('h3.welcome-prompts-overview-section-title'));
		heading.textContent = title;
		const descriptionElement = DOM.append(section, $('p.welcome-prompts-overview-section-description'));
		descriptionElement.textContent = description;
		return DOM.append(section, $('.welcome-prompts-overview-grid'));
	}

	private renderStandaloneCustomization(parent: HTMLElement, customization: IStandaloneCustomizationDescription): void {
		const card = DOM.append(parent, $('button.welcome-prompts-card.welcome-prompts-navigation-card')) as HTMLButtonElement;
		card.type = 'button';
		card.setAttribute('aria-label', localize('configureCategoryAriaLabel', "配置 {0}", customization.label));
		if (!this.firstCard) {
			this.firstCard = card;
		}

		const cardHeader = DOM.append(card, $('.welcome-prompts-card-header'));
		const iconEl = DOM.append(cardHeader, $('.welcome-prompts-card-icon'));
		iconEl.classList.add(...ThemeIcon.asClassNameArray(customization.icon));
		const labelEl = DOM.append(cardHeader, $('span.welcome-prompts-card-label'));
		labelEl.textContent = customization.label;

		const descEl = DOM.append(card, $('p.welcome-prompts-card-description'));
		descEl.textContent = customization.description;

		const configure = () => {
			void this.commandService.executeCommand(customization.commandId);
		};
		this.cardDisposables.add(DOM.addDisposableListener(card, 'click', configure));
	}

	setMigrationCategories(categories: readonly ICustomizationMigrationCategorySummary[]): void {
		const didChange = categories.length !== this.migrationCategories.length
			|| categories.some((category, index) => {
				const previous = this.migrationCategories[index];
				return previous.id !== category.id
					|| previous.count !== category.count
					|| previous.description !== category.description;
			});
		this.migrationCategories = categories;
		if (didChange) {
			this.rebuildCards(this.visibleSectionIds);
		}
	}

	setHarnessLabel(label: string): void {
		if (this.harnessLabel === label) {
			return;
		}
		this.harnessLabel = label;
		this.updateHeading();
	}

	private updateHeading(): void {
		if (this.heading) {
			this.heading.textContent = localize('welcomeHeading', "智能体自定义项");
		}
	}

	private renderCustomizationMigrationCard(parent: HTMLElement, categories: readonly ICustomizationMigrationCategorySummary[]): void {
		const migrationCard = DOM.append(parent, $('button.welcome-prompts-card.welcome-prompts-migration-card')) as HTMLButtonElement;
		migrationCard.type = 'button';
		const totalCount = categories.reduce((total, category) => total + category.count, 0);
		migrationCard.setAttribute('aria-label', localize('reviewCustomizationMigrationsAriaLabel', "Review {0} customizations that need migration", totalCount));

		const cardHeader = DOM.append(migrationCard, $('.welcome-prompts-card-header'));
		const iconEl = DOM.append(cardHeader, $('.welcome-prompts-card-icon'));
		iconEl.classList.add(...ThemeIcon.asClassNameArray(Codicon.warning));
		iconEl.setAttribute('aria-hidden', 'true');
		const labelEl = DOM.append(cardHeader, $('span.welcome-prompts-card-label'));
		labelEl.textContent = localize('customizationMigrationOverviewCardLabel', "Review Customization Migrations");

		const descEl = DOM.append(migrationCard, $('p.welcome-prompts-card-description'));
		descEl.textContent = totalCount === 1
			? localize('customizationMigrationOverviewCardDescriptionSingle', "1 customization needs an update before it can be used by {0}. Review what will change before migrating.", this.harnessLabel)
			: localize('customizationMigrationOverviewCardDescription', "{0} customizations need an update before they can be used by {1}. Review what will change before migrating.", totalCount, this.harnessLabel);

		if (!this.firstCard) {
			this.firstCard = migrationCard;
		}
		const actionLabel = DOM.append(migrationCard, $('span.welcome-prompts-card-action-label'));
		actionLabel.textContent = localize('reviewCustomizationMigrations', "Review Migrations...");
		this.cardDisposables.add(DOM.addDisposableListener(migrationCard, 'click', () => this.callbacks.reviewMigrations()));
	}

	focus(): void {
		// Prefer the prompt input so screen reader / keyboard users land on a meaningful
		// control. If the input isn't rendered (e.g. when the getting-started banner is
		// disabled), fall back to the first focusable card so focus stays inside the
		// welcome page rather than escaping to the surrounding workbench editor.
		if (this.inputElement) {
			this.inputElement.focus();
			return;
		}
		this.firstCard?.focus();
	}
}
