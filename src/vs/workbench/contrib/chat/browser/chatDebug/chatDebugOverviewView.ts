/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../../base/browser/dom.js';
import { BreadcrumbsWidget } from '../../../../../base/browser/ui/breadcrumbs/breadcrumbsWidget.js';
import { Button } from '../../../../../base/browser/ui/button/button.js';
import { RunOnceScheduler } from '../../../../../base/common/async.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { URI } from '../../../../../base/common/uri.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { defaultBreadcrumbsWidgetStyles, defaultButtonStyles } from '../../../../../platform/theme/browser/defaultStyles.js';
import { ChatDebugLogLevel, IChatDebugEvent, IChatDebugService } from '../../common/chatDebugService.js';
import { safeIntl } from '../../../../../base/common/date.js';
import { IChatService } from '../../common/chatService/chatService.js';
import { ChatAgentLocation } from '../../common/constants.js';
import { IChatSessionsService, localChatSessionType } from '../../common/chatSessionsService.js';
import { getChatSessionType, LocalChatSessionUri } from '../../common/model/chatUri.js';
import { IChatWidgetService } from '../chat.js';
import { IPreferencesService } from '../../../../services/preferences/common/preferences.js';
import { isAgentHostSession } from './agentHostLogSources.js';
import { isChatDebugLoggingEnabledForSession, renderChatDebugLoggingDisabledMessage } from './chatDebugEnablement.js';
import { setupBreadcrumbKeyboardNavigation, TextBreadcrumbItem } from './chatDebugTypes.js';

const $ = DOM.$;
const numberFormatter = safeIntl.NumberFormat();
const aicFormatter = safeIntl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NANO_AIU_PER_AIC = 1_000_000_000;

export const enum OverviewNavigation {
	Home = 'home',
	Logs = 'logs',
	FlowChart = 'flowchart',
	CacheExplorer = 'cache',
	WireLog = 'wirelog',
}

export class ChatDebugOverviewView extends Disposable {

	private readonly _onNavigate = this._register(new Emitter<OverviewNavigation>());
	readonly onNavigate = this._onNavigate.event;

	readonly container: HTMLElement;
	private readonly content: HTMLElement;
	private readonly breadcrumbWidget: BreadcrumbsWidget;
	private readonly loadDisposables = this._register(new DisposableStore());

	private currentSessionResource: URI | undefined;
	private metricsContainer: HTMLElement | undefined;
	private isFirstLoad: boolean = true;
	private readonly refreshScheduler: RunOnceScheduler;

	constructor(
		parent: HTMLElement,
		@IChatService private readonly chatService: IChatService,
		@IChatDebugService private readonly chatDebugService: IChatDebugService,
		@IChatWidgetService private readonly chatWidgetService: IChatWidgetService,
		@IChatSessionsService private readonly chatSessionsService: IChatSessionsService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IPreferencesService private readonly preferencesService: IPreferencesService,
	) {
		super();
		this.container = DOM.append(parent, $('.chat-debug-overview'));
		DOM.hide(this.container);

		this.refreshScheduler = this._register(new RunOnceScheduler(() => this.doRefresh(), 100));

		// Breadcrumb
		const breadcrumbContainer = DOM.append(this.container, $('.chat-debug-breadcrumb'));
		this.breadcrumbWidget = this._register(new BreadcrumbsWidget(breadcrumbContainer, 3, undefined, Codicon.chevronRight, defaultBreadcrumbsWidgetStyles));
		this._register(setupBreadcrumbKeyboardNavigation(breadcrumbContainer, this.breadcrumbWidget));
		this._register(this.breadcrumbWidget.onDidSelectItem(e => {
			if (e.type === 'select' && e.item instanceof TextBreadcrumbItem) {
				this.breadcrumbWidget.setSelection(undefined);
				const items = this.breadcrumbWidget.getItems();
				const idx = items.indexOf(e.item);
				if (idx === 0) {
					this._onNavigate.fire(OverviewNavigation.Home);
				}
			}
		}));

		this.content = DOM.append(this.container, $('.chat-debug-overview-content'));
	}

	setSession(sessionResource: URI): void {
		this.currentSessionResource = sessionResource;
		this.isFirstLoad = true;
	}

	show(): void {
		DOM.show(this.container);
		this.load();
	}

	hide(): void {
		DOM.hide(this.container);
		this.refreshScheduler.cancel();
	}

	refresh(): void {
		if (this.container.style.display !== 'none') {
			if (!this.refreshScheduler.isScheduled()) {
				this.refreshScheduler.schedule();
			}
		}
	}

	private doRefresh(): void {
		// On refresh, only update the metrics section in-place
		if (this.metricsContainer && this.currentSessionResource) {
			DOM.clearNode(this.metricsContainer);
			const events = this.chatDebugService.getEvents(this.currentSessionResource);
			this.renderMetricsContent(this.metricsContainer, events);
			this.isFirstLoad = false;
		} else {
			this.load();
		}
	}

	updateBreadcrumb(): void {
		if (!this.currentSessionResource) {
			return;
		}
		const sessionTitle = this.chatService.getSessionTitle(this.currentSessionResource) || LocalChatSessionUri.parseLocalSessionId(this.currentSessionResource) || this.currentSessionResource.toString();
		this.breadcrumbWidget.setItems([
			new TextBreadcrumbItem(localize('chatDebug.title', "智能体调试日志"), true),
			new TextBreadcrumbItem(sessionTitle),
		]);
	}

	private load(): void {
		DOM.clearNode(this.content);
		this.loadDisposables.clear();
		this.updateBreadcrumb();

		if (!this.currentSessionResource) {
			return;
		}

		const sessionTitle = this.chatService.getSessionTitle(this.currentSessionResource) || LocalChatSessionUri.parseLocalSessionId(this.currentSessionResource) || this.currentSessionResource.toString();

		const titleRow = DOM.append(this.content, $('.chat-debug-overview-title-row'));
		const titleEl = DOM.append(titleRow, $('h2.chat-debug-overview-title'));
		DOM.append(titleEl, $(`span${ThemeIcon.asCSSSelector(Codicon.comment)}`));
		titleEl.append(sessionTitle);

		const titleActions = DOM.append(titleRow, $('.chat-debug-overview-title-actions'));

		const revealSessionBtn = this.loadDisposables.add(new Button(titleActions, { ariaLabel: localize('chatDebug.revealChatSession', "显示聊天会话"), title: localize('chatDebug.revealChatSession', "显示聊天会话") }));
		revealSessionBtn.element.classList.add('chat-debug-icon-button');
		revealSessionBtn.icon = Codicon.goToFile;
		this.loadDisposables.add(revealSessionBtn.onDidClick(() => {
			if (this.currentSessionResource) {
				this.chatWidgetService.openSession(this.currentSessionResource);
			}
		}));

		// Session details section
		this.renderSessionDetails(this.currentSessionResource);

		// Derived overview metrics — show shimmer only on the very first load
		// AND when there are no events yet. If events were already streamed
		// (e.g. while viewing logs), render them immediately so the shimmer
		// doesn't get stuck forever waiting for an event that already fired.
		const events = this.chatDebugService.getEvents(this.currentSessionResource);
		this.renderDerivedOverview(events, this.isFirstLoad && events.length === 0);
		this.isFirstLoad = false;
	}

	private renderSessionDetails(sessionUri: URI): void {
		const model = this.chatService.getSession(sessionUri);

		interface DetailItem { label: string; value: string }
		const details: DetailItem[] = [];

		// Session type
		const sessionType = getChatSessionType(sessionUri);
		const contribution = this.chatSessionsService.getChatSessionContribution(sessionType);
		const sessionTypeName = contribution?.displayName || (sessionType === localChatSessionType
			? localize('chatDebug.sessionType.local', "本地")
			: sessionType);
		details.push({ label: localize('chatDebug.detail.sessionType', "会话类型"), value: sessionTypeName });

		if (model) {
			const locationLabel = this.getLocationLabel(model.initialLocation);
			details.push({ label: localize('chatDebug.detail.location', "位置"), value: locationLabel });

			const inProgress = model.requestInProgress.get();
			const statusLabel = inProgress
				? localize('chatDebug.status.inProgress', "进行中")
				: localize('chatDebug.status.idle', "空闲");
			details.push({ label: localize('chatDebug.detail.status', "状态"), value: statusLabel });

			const timing = model.timing;
			details.push({ label: localize('chatDebug.detail.created', "已创建"), value: new Date(timing.created).toLocaleString() });

			if (timing.lastRequestEnded) {
				details.push({ label: localize('chatDebug.detail.lastActivity', "上一个活动"), value: new Date(timing.lastRequestEnded).toLocaleString() });
			} else if (timing.lastRequestStarted) {
				details.push({ label: localize('chatDebug.detail.lastActivity', "上一个活动"), value: new Date(timing.lastRequestStarted).toLocaleString() });
			}
		}

		if (details.length > 0) {
			const section = DOM.append(this.content, $('.chat-debug-overview-section'));
			DOM.append(section, $('h3.chat-debug-overview-section-label', undefined, localize('chatDebug.sessionDetails', "会话详细信息")));

			const detailsGrid = DOM.append(section, $('.chat-debug-overview-details'));
			for (const detail of details) {
				const row = DOM.append(detailsGrid, $('.chat-debug-overview-detail-row'));
				DOM.append(row, $('span.chat-debug-overview-detail-label', undefined, detail.label));
				DOM.append(row, $('span.chat-debug-overview-detail-value', undefined, detail.value));
			}
		}
	}

	private getLocationLabel(location: ChatAgentLocation): string {
		switch (location) {
			case ChatAgentLocation.Chat: return localize('chatDebug.location.chat', "聊天面板");
			case ChatAgentLocation.Terminal: return localize('chatDebug.location.terminal', "终端");
			case ChatAgentLocation.Notebook: return localize('chatDebug.location.notebook', "笔记本");
			case ChatAgentLocation.EditorInline: return localize('chatDebug.location.editor', "编辑器内联");
			default: return String(location);
		}
	}

	private renderDerivedOverview(events: readonly IChatDebugEvent[], showShimmer: boolean): void {
		// When agent debug logging is disabled for this session, no metrics are
		// captured. Surface a hint to enable the setting instead of an empty
		// summary, while still keeping the navigation buttons below.
		if (!isChatDebugLoggingEnabledForSession(this.configurationService, this.currentSessionResource)) {
			this.metricsContainer = undefined;
			const disabledSection = DOM.append(this.content, $('.chat-debug-overview-section'));
			renderChatDebugLoggingDisabledMessage(disabledSection, this.currentSessionResource, this.preferencesService, this.loadDisposables);
		} else {
			const metricsSection = DOM.append(this.content, $('.chat-debug-overview-section'));
			DOM.append(metricsSection, $('h3.chat-debug-overview-section-label', undefined, localize('chatDebug.summary', "摘要")));

			this.metricsContainer = DOM.append(metricsSection, $('.chat-debug-overview-metrics'));

			if (showShimmer) {
				this.renderMetricsShimmer(this.metricsContainer);
			} else {
				this.renderMetricsContent(this.metricsContainer, events);
			}
		}

		// Explore actions
		const actionsSection = DOM.append(this.content, $('.chat-debug-overview-section'));
		DOM.append(actionsSection, $('h3.chat-debug-overview-section-label', undefined, localize('chatDebug.exploreTraceData', "浏览跟踪数据")));

		const row = DOM.append(actionsSection, $('.chat-debug-overview-actions'));

		const viewLogsBtn = this.loadDisposables.add(new Button(row, { ...defaultButtonStyles, secondary: true, supportIcons: true, title: localize('chatDebug.viewLogs', "查看日志") }));
		viewLogsBtn.element.classList.add('chat-debug-overview-action-button');
		viewLogsBtn.label = `$(list-flat) ${localize('chatDebug.viewLogs', "查看日志")}`;
		this.loadDisposables.add(viewLogsBtn.onDidClick(() => {
			this._onNavigate.fire(OverviewNavigation.Logs);
		}));

		const flowChartBtn = this.loadDisposables.add(new Button(row, { ...defaultButtonStyles, secondary: true, supportIcons: true, title: localize('chatDebug.agentFlowChart', "智能体流程图") }));
		flowChartBtn.element.classList.add('chat-debug-overview-action-button');
		flowChartBtn.label = `$(type-hierarchy) ${localize('chatDebug.agentFlowChart', "智能体流程图")}`;
		this.loadDisposables.add(flowChartBtn.onDidClick(() => {
			this._onNavigate.fire(OverviewNavigation.FlowChart);
		}));

		const cacheBtn = this.loadDisposables.add(new Button(row, { ...defaultButtonStyles, secondary: true, supportIcons: true, title: localize('chatDebug.cacheExplorer', "缓存资源管理器") }));
		cacheBtn.element.classList.add('chat-debug-overview-action-button');
		cacheBtn.label = `$(database) ${localize('chatDebug.cacheExplorer', "缓存资源管理器")}`;
		this.loadDisposables.add(cacheBtn.onDidClick(() => {
			this._onNavigate.fire(OverviewNavigation.CacheExplorer);
		}));

		// The AHP log is only meaningful for Agent Host sessions.
		if (isAgentHostSession(this.currentSessionResource)) {
			const wireLogBtn = this.loadDisposables.add(new Button(row, { ...defaultButtonStyles, secondary: true, supportIcons: true, title: localize('chatDebug.ahpLog', "AHP Log") }));
			wireLogBtn.element.classList.add('chat-debug-overview-action-button');
			wireLogBtn.label = `$(arrow-swap) ${localize('chatDebug.ahpLog', "AHP Log")}`;
			this.loadDisposables.add(wireLogBtn.onDidClick(() => {
				this._onNavigate.fire(OverviewNavigation.WireLog);
			}));
		}

	}

	private renderMetricsShimmer(container: HTMLElement): void {
		// Show placeholder shimmer cards while provider data is loading
		const placeholderLabels = [
			localize('chatDebug.metric.modelTurns', "模型回合"),
			localize('chatDebug.metric.toolCalls', "工具调用"),
			localize('chatDebug.metric.totalInputTokens', "输入令牌总数"),
			localize('chatDebug.metric.totalOutputTokens', "输出令牌总数"),
			localize('chatDebug.metric.totalCachedInputTokens', "缓存的输入令牌总数"),
			localize('chatDebug.metric.totalTokens', "令牌总数"),
			localize('chatDebug.metric.errors', "错误"),
		];
		for (const label of placeholderLabels) {
			const card = DOM.append(container, $('.chat-debug-overview-metric-card'));
			DOM.append(card, $('div.chat-debug-overview-metric-label', undefined, label));
			const valueEl = DOM.append(card, $('div.chat-debug-overview-metric-value'));
			const shimmer = DOM.append(valueEl, $('span.chat-debug-overview-metric-shimmer'));
			shimmer.textContent = '\u00A0'; // non-breaking space for height
		}
	}

	private renderMetricsContent(container: HTMLElement, events: readonly IChatDebugEvent[]): void {
		const modelTurns = events.filter(e => e.kind === 'modelTurn');
		const toolCalls = events.filter(e => e.kind === 'toolCall');
		const errors = events.filter(e =>
			(e.kind === 'generic' && e.level === ChatDebugLogLevel.Error) ||
			(e.kind === 'toolCall' && e.result === 'error')
		);

		const fmt = numberFormatter.value;
		const totalInputTokens = modelTurns.reduce((sum, e) => sum + (e.inputTokens ?? 0), 0);
		const totalOutputTokens = modelTurns.reduce((sum, e) => sum + (e.outputTokens ?? 0), 0);
		const totalCachedTokens = modelTurns.reduce((sum, e) => sum + (e.cachedTokens ?? 0), 0);
		const totalTokens = modelTurns.reduce((sum, e) => sum + (e.totalTokens ?? 0), 0);
		const totalCopilotUsageNanoAiu = modelTurns.reduce((sum, e) => sum + (e.copilotUsageNanoAiu ?? 0), 0);

		interface OverviewMetric { label: string; value: string }
		const metrics: OverviewMetric[] = [
			{ label: localize('chatDebug.metric.modelTurns', "模型回合"), value: fmt.format(modelTurns.length) },
			{ label: localize('chatDebug.metric.toolCalls', "工具调用"), value: fmt.format(toolCalls.length) },
			{ label: localize('chatDebug.metric.totalInputTokens', "输入令牌总数"), value: fmt.format(totalInputTokens) },
			{ label: localize('chatDebug.metric.totalOutputTokens', "输出令牌总数"), value: fmt.format(totalOutputTokens) },
			{ label: localize('chatDebug.metric.totalCachedInputTokens', "缓存的输入令牌总数"), value: fmt.format(totalCachedTokens) },
			{ label: localize('chatDebug.metric.totalTokens', "令牌总数"), value: fmt.format(totalTokens) },
			{ label: localize('chatDebug.metric.errors', "错误"), value: fmt.format(errors.length) },
		];

		if (totalCopilotUsageNanoAiu > 0) {
			const aic = totalCopilotUsageNanoAiu / NANO_AIU_PER_AIC;
			metrics.push({ label: localize('chatDebug.metric.copilotUsage', "Copilot 使用情况(AIC)"), value: aicFormatter.value.format(aic) });
		}

		for (const metric of metrics) {
			const card = DOM.append(container, $('.chat-debug-overview-metric-card'));
			DOM.append(card, $('div.chat-debug-overview-metric-label', undefined, metric.label));
			DOM.append(card, $('div.chat-debug-overview-metric-value', undefined, metric.value));
		}
	}
}
