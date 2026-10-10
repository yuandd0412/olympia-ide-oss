/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { OS } from '../../../../base/common/platform.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { localize } from '../../../../nls.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IChatDebugCustomizationLogEntry, IChatDebugEventFileListContent, IChatDebugResolvedEventContent, IChatDebugService } from '../common/chatDebugService.js';
import { isAgentHostTarget } from '../common/chatSessionsService.js';
import { getChatSessionType } from '../common/model/chatUri.js';
import { IChatAgentService } from '../common/participants/chatAgents.js';
import { IChatService } from '../common/chatService/chatService.js';
import { ChatRequestHooks, formatHookCommandLabel } from '../common/promptSyntax/hookSchema.js';
import { HookType } from '../common/promptSyntax/hookTypes.js';
import { PromptsType } from '../common/promptSyntax/promptTypes.js';
import { IHookDiscoveryInfo, type InstructionsCollectionDebugInfo, IPromptDiscoveryInfo, IPromptsService } from '../common/promptSyntax/service/promptsService.js';
import { lastInstructionsCollectionResult } from '../common/promptSyntax/computeAutomaticInstructions.js';

interface ICustomizationEventData {
	readonly debugInfo: InstructionsCollectionDebugInfo;
	readonly hooks: ChatRequestHooks | undefined;
}

/**
 * Bridges prompt discovery information to {@link IChatDebugService}.
 */
export class PromptsDebugContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.promptsDebug';

	private static readonly MAX_DISCOVERY_DETAILS = 10_000;

	/**
	 * Maps debug event IDs to their discovery info, so that
	 * {@link IChatDebugService.resolveEvent} can return rich details.
	 */
	private readonly _discoveryEventDetails = new Map<string, IPromptDiscoveryInfo>();
	private readonly _customizationEventDetails = new Map<string, ICustomizationEventData>();
	private readonly _loggedSessions = new Set<string>();

	constructor(
		@IPromptsService private readonly promptsService: IPromptsService,
		@IChatAgentService chatAgentService: IChatAgentService,
		@IChatService chatService: IChatService,
		@IChatDebugService chatDebugService: IChatDebugService,
		@ILogService logService: ILogService,
	) {
		super();

		// Clean up logged-session entries when sessions are disposed.
		this._register(chatService.onDidDisposeSession(e => {
			for (const sessionResource of e.sessionResources) {
				this._loggedSessions.delete(sessionResource.toString());
			}
		}));

		// Forward discovery log events to the debug service.
		this._register(chatAgentService.onWillInvokeAgent(async e => {
			const sessionKey = e.request.sessionResource.toString();
			const isFirstInvocation = !this._loggedSessions.has(sessionKey);
			this._loggedSessions.add(sessionKey);

			const sessionResource = e.request.sessionResource;

			if (isFirstInvocation) {
				const cts = new CancellationTokenSource();
				try {
					// For agent-host (Copilot CLI) sessions, VS Code core still collects
					// instructions and hooks and passes them into the agent-host request,
					// so those discovery events are relevant. Agent / skill / slash-command
					// discovery reflects VS Code's own chat-participant discovery, which the
					// agent host does not consume (the agent host surfaces its actually loaded
					// customizations separately), so we suppress those to avoid noise.
					const discoveryTypes = isAgentHostTarget(getChatSessionType(sessionResource))
						? [PromptsType.instructions, PromptsType.hook]
						: [PromptsType.agent, PromptsType.instructions, PromptsType.prompt, PromptsType.skill, PromptsType.hook];
					const discoveryInfos = await Promise.all(discoveryTypes.map(type => this.promptsService.getDiscoveryInfo(type, cts.token)));
					for (const discoveryInfo of discoveryInfos) {
						const { name, details } = this.getDiscoveryLogEntry(discoveryInfo);
						const eventId = generateUuid();

						this._discoveryEventDetails.set(eventId, discoveryInfo);

						// Evict oldest entries when the map exceeds the cap.
						if (this._discoveryEventDetails.size > PromptsDebugContribution.MAX_DISCOVERY_DETAILS) {
							const first = this._discoveryEventDetails.keys().next().value;
							if (first !== undefined) {
								this._discoveryEventDetails.delete(first);
							}
						}

						// Enrich details with file paths so they appear in the event
						// payload (e.g. forwarded via onDidReceiveChatDebugEvent to the
						// extension's JSONL file logger).
						const loaded = discoveryInfo.files
							.filter(f => f.status === 'loaded')
							.map(f => f.promptPath.name ?? f.promptPath.uri.path.split('/').pop() ?? f.promptPath.uri.toString());
						const skipped = discoveryInfo.files.filter(f => f.status === 'skipped').map(f => {
							const label = f.promptPath.uri.toString();
							return f.skipReason ? `${label} (${f.skipReason})` : label;
						});
						const folders = discoveryInfo.sourceFolders?.map(sf => sf.uri.path) ?? [];
						const parts: string[] = [];
						if (details) {
							parts.push(details);
						}
						if (loaded.length > 0) {
							parts.push(`loaded: [${truncateList(loaded)}]`);
						}
						if (skipped.length > 0) {
							parts.push(`skipped: [${truncateList(skipped)}]`);
						}
						if (folders.length > 0) {
							parts.push(`folders: [${truncateList(folders)}]`);
						}
						const newDetails = parts.join(' | ') || undefined;

						chatDebugService.log(
							sessionResource,
							name,
							newDetails,
							undefined,
							{ id: eventId, category: 'discovery' },
						);
					}
				} catch (error) {
					logService.error('Error while logging prompt discovery info to chat debug service', error);
				} finally {
					cts.dispose();
				}
			}

			// Log resolved customizations from the last instructions collection.
			const lastResult = lastInstructionsCollectionResult;
			if (!isFirstInvocation && lastResult) {
				const { telemetryEvent: collectionEvent, debugInfo } = lastResult;
				// Fetch the cached hook discovery info.
				let resolvedHooks: ChatRequestHooks | undefined;
				try {
					const hookDiscoveryInfo = await this.promptsService.getDiscoveryInfo(PromptsType.hook, CancellationToken.None) as IHookDiscoveryInfo;
					resolvedHooks = hookDiscoveryInfo.hooksInfo?.hooks;
				} catch (error) {
					logService.warn('Error while fetching hooks for customization debug event', error);
				}

				const parts: string[] = [];
				if (collectionEvent.applyingInstructionsCount > 0) {
					parts.push(localize('customizations.applying', "正在应用 {0}", collectionEvent.applyingInstructionsCount));
				}
				if (collectionEvent.referencedInstructionsCount > 0) {
					parts.push(localize('customizations.referenced', "已引用 {0}", collectionEvent.referencedInstructionsCount));
				}
				if (collectionEvent.agentInstructionsCount > 0) {
					parts.push(localize('customizations.agent', "{0} 智能体", collectionEvent.agentInstructionsCount));
				}
				if (collectionEvent.listedInstructionsCount > 0) {
					parts.push(localize('customizations.listed', "{0} 已列出", collectionEvent.listedInstructionsCount));
				}
				const durationStr = debugInfo.durationInMillis.toFixed(1);
				const summary = parts.length > 0
					? localize('customizationsResolved.details', "在 {2} 毫秒内解析了 {0} 个自定义项({1})", collectionEvent.totalInstructionsCount, parts.join(', '), durationStr)
					: localize('customizationsResolved.none', "未解析任何自定义项");
				const detailSummaries = debugInfo.debugDetails.map(e => {
					const detail = e.reason ? `${e.name} — ${e.reason}` : e.name;
					return `[${e.category}] ${detail}`;
				});
				const details = detailSummaries.length > 0
					? `${summary} | ${detailSummaries.join(', ')}`
					: summary;

				const customizationEventId = generateUuid();
				this._customizationEventDetails.set(customizationEventId, { debugInfo, hooks: resolvedHooks });

				// Evict oldest entries when the map exceeds the cap.
				if (this._customizationEventDetails.size > PromptsDebugContribution.MAX_DISCOVERY_DETAILS) {
					const first = this._customizationEventDetails.keys().next().value;
					if (first !== undefined) {
						this._customizationEventDetails.delete(first);
					}
				}

				chatDebugService.log(
					sessionResource,
					localize('customizationsResolved', "解析自定义项"),
					details,
					undefined,
					{ id: customizationEventId, category: 'customization' },
				);
			}
		}));
		// Register a resolve provider so expanding a discovery event
		// in the Agent Debug Logs shows the full file list.
		this._register(chatDebugService.registerProvider({
			provideChatDebugLog: async () => undefined,
			resolveChatDebugLogEvent: async (eventId) => {
				return this._resolveDiscoveryEvent(eventId) ?? this._resolveCustomizationEvent(eventId);
			}
		}));
	}

	private getDiscoveryLogEntry(discoveryInfo: IPromptDiscoveryInfo): { readonly name: string; readonly details?: string } {

		const durationInMillis = discoveryInfo.durationInMillis.toFixed(1);
		const loadedCount = discoveryInfo.files.filter(file => file.status === 'loaded').length;
		const skippedCount = discoveryInfo.files.length - loadedCount;

		switch (discoveryInfo.type) {
			case PromptsType.prompt:
				return {
					name: localize('promptsService.loadSlashCommands', "斜杠命令发现"),
					details: loadedCount === 1
						? localize('promptsDebugContribution.resolvedSlashCommand', "在 {1} 毫秒内解析了 {0} 个 / 命令", loadedCount, durationInMillis)
						: localize('promptsDebugContribution.resolvedSlashCommands', "在 {1} 毫秒内解析了 {0} 个 / 命令", loadedCount, durationInMillis)
				};
			case PromptsType.agent:
				return {
					name: localize('promptsService.loadAgents', "智能体发现"),
					details: loadedCount === 1
						? localize('promptsDebugContribution.resolvedAgent', "已在 {1} 毫秒内解析 {0} 个智能体", loadedCount, durationInMillis)
						: localize('promptsDebugContribution.resolvedAgents', "{0} 毫秒内解析 {1} 个代理", loadedCount, durationInMillis)
				};
			case PromptsType.skill:
				return {
					name: localize('promptsService.loadSkills', "技能发现"),
					details: loadedCount === 1
						? localize('promptsDebugContribution.resolvedSkill', "{0} 毫秒内解析 {1} 个技能", loadedCount, durationInMillis)
						: localize('promptsDebugContribution.resolvedSkills', "已在 {1} 毫秒内解析 {0} 个技能", loadedCount, durationInMillis)
				};
			case PromptsType.instructions:
				return {
					name: localize('promptsService.loadInstructions', "指令发现"),
					details: loadedCount === 1
						? localize('promptsDebugContribution.resolvedInstruction', "已在 {1} 毫秒内解析 {0} 个指令", loadedCount, durationInMillis)
						: localize('promptsDebugContribution.resolvedInstructions', "已在 {1} 毫秒内解析 {0} 指令", loadedCount, durationInMillis)
				};
			case PromptsType.hook: {
				const hookDiscoveryInfo = discoveryInfo as IHookDiscoveryInfo;
				const hookCount = hookDiscoveryInfo.hooksInfo
					? Object.values(hookDiscoveryInfo.hooksInfo.hooks).reduce((total, hooks) => total + hooks.length, 0)
					: loadedCount;
				const details = skippedCount > 0
					? localize('promptsDebugContribution.resolvedHooksWithSkipped', "在 {2} 毫秒内从 {1} 文件解析了 {0} 个挂钩，跳过了 {3}", hookCount, loadedCount, durationInMillis, skippedCount)
					: hookCount === 1
						? localize('promptsDebugContribution.resolvedHook', "已在 {1} 毫秒内解析 {0} 个挂钩", hookCount, durationInMillis)
						: localize('promptsDebugContribution.resolvedHooks', "{0} 毫秒内解析 {1} 个钩子", hookCount, durationInMillis);
				return {
					name: localize('promptsService.loadHooks', "挂钩发现"),
					details
				};
			}
		}
	}

	private _resolveDiscoveryEvent(eventId: string): IChatDebugResolvedEventContent | undefined {
		const info = this._discoveryEventDetails.get(eventId);
		if (!info) {
			return undefined;
		}

		return this._toFileListContent(info);
	}

	private _resolveCustomizationEvent(eventId: string): IChatDebugResolvedEventContent | undefined {
		const data = this._customizationEventDetails.get(eventId);
		if (!data) {
			return undefined;
		}

		const { debugInfo, hooks } = data;
		const logs: IChatDebugCustomizationLogEntry[] = [...debugInfo.debugDetails];

		// Add hook entries from the resolved hooks — each command carries its sourceUri.
		if (hooks) {
			for (const hookType of Object.values(HookType)) {
				const commands = hooks[hookType];
				if (commands && commands.length > 0) {
					for (const cmd of commands) {
						const commandLabel = formatHookCommandLabel(cmd, OS) || localize('hook.unknownCommand', "(未知命令)");
						logs.push({
							category: 'hook',
							name: commandLabel,
							reason: hookType,
							uri: cmd.sourceUri,
						});
					}
				}
			}
		}

		return {
			kind: 'customizationSummary',
			resolutionLogs: logs,
			durationInMillis: debugInfo.durationInMillis,
			counts: {
				instructions: logs.filter(e => e.category === 'applying' || e.category === 'referenced').length,
				skills: logs.filter(e => e.category === 'skill').length,
				agents: logs.filter(e => e.category === 'custom-agent').length,
				hooks: logs.filter(e => e.category === 'hook').length,
				skipped: logs.filter(e => e.category === 'skipped').length,
			},
		};
	}

	private _toFileListContent(info: IPromptDiscoveryInfo): IChatDebugEventFileListContent {
		return {
			kind: 'fileList',
			discoveryType: info.type,
			durationInMillis: info.durationInMillis,
			files: info.files.map(f => ({
				uri: f.promptPath.uri,
				name: f.promptPath.name,
				status: f.status,
				storage: f.promptPath.storage,
				extensionId: f.promptPath.extension?.identifier.value,
				skipReason: f.skipReason,
				errorMessage: f.errorMessage,
				duplicateOf: f.duplicateOf,
			})),
			sourceFolders: info.sourceFolders?.map(sf => ({
				uri: sf.uri,
				storage: sf.storage,
			})),
		};
	}
}

const MAX_LIST_ITEMS = 100;

/**
 * Join a list of strings, truncating after {@link MAX_LIST_ITEMS} entries.
 * Full details are available via {@link IChatDebugService.resolveEvent}.
 */
function truncateList(items: string[]): string {
	if (items.length <= MAX_LIST_ITEMS) {
		return items.join(', ');
	}

	return items.slice(0, MAX_LIST_ITEMS).join(', ') + ` (+${items.length - MAX_LIST_ITEMS} more)`;
}
