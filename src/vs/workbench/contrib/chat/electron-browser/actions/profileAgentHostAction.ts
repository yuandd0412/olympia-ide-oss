/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../../../base/common/buffer.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { getErrorMessage } from '../../../../../base/common/errors.js';
import { Disposable, IDisposable, MutableDisposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../../base/common/network.js';
import { joinPath } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Categories } from '../../../../../platform/action/common/actionCommonCategories.js';
import { Action2 } from '../../../../../platform/actions/common/actions.js';
import { AGENT_HOST_ENABLED_CONTEXT_KEY } from '../../../../../platform/agentHost/common/agentHostEnablementService.js';
import { IAgentHostService } from '../../../../../platform/agentHost/common/agentService.js';
import { ContextKeyExpr, IContextKey, IContextKeyService, RawContextKey } from '../../../../../platform/contextkey/common/contextkey.js';
import { IFileDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { createDecorator, ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { INotificationService, Severity } from '../../../../../platform/notification/common/notification.js';
import { IV8InspectProfilingService, IV8Profile, Utils } from '../../../../../platform/profiling/common/profiling.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { IStatusbarEntryAccessor, IStatusbarService, StatusbarAlignment } from '../../../../services/statusbar/browser/statusbar.js';
import { IEditorService, SIDE_GROUP } from '../../../../services/editor/common/editorService.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { ChatContextKeys } from '../../common/actions/chatContextKeys.js';

const enum AgentHostProfileState {
	None = 'none',
	Starting = 'starting',
	Running = 'running',
	Stopping = 'stopping',
}

const CONTEXT_AGENT_HOST_PROFILE_STATE = new RawContextKey<AgentHostProfileState>('agentHostProfileState', AgentHostProfileState.None);

const IAgentHostProfileService = createDecorator<IAgentHostProfileService>('agentHostProfileService');

interface IAgentHostProfileService {
	readonly _serviceBrand: undefined;

	startProfiling(): Promise<void>;
	stopProfiling(): Promise<void>;
}

class AgentHostProfileService extends Disposable implements IAgentHostProfileService {
	declare readonly _serviceBrand: undefined;

	private readonly profileState: IContextKey<AgentHostProfileState>;
	private readonly statusbarEntry = this._register(new MutableDisposable<IStatusbarEntryAccessor>());
	private readonly profilingNotification = this._register(new MutableDisposable<IDisposable>());
	private sessionId: string | undefined;
	private startPromise: Promise<void> | undefined;
	private isDisposed = false;

	constructor(
		@IAgentHostService private readonly agentHostService: IAgentHostService,
		@IV8InspectProfilingService private readonly profilingService: IV8InspectProfilingService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IFileDialogService private readonly fileDialogService: IFileDialogService,
		@IFileService private readonly fileService: IFileService,
		@IEditorService private readonly editorService: IEditorService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@INotificationService private readonly notificationService: INotificationService,
		@ILogService private readonly logService: ILogService,
	) {
		super();

		this.profileState = CONTEXT_AGENT_HOST_PROFILE_STATE.bindTo(contextKeyService);
		this._register(toDisposable(() => {
			this.isDisposed = true;
			const sessionId = this.sessionId;
			this.sessionId = undefined;
			this.profileState.set(AgentHostProfileState.None);
			if (sessionId) {
				void this.profilingService.stopProfiling(sessionId).catch(error => {
					this.logService.error('Failed to stop the agent host profiling session during disposal', error);
				});
			}
		}));
	}

	startProfiling(): Promise<void> {
		if (this.startPromise) {
			return this.startPromise;
		}
		if (this.sessionId) {
			return Promise.resolve();
		}

		this.profileState.set(AgentHostProfileState.Starting);
		this.startPromise = this.doStartProfiling().finally(() => this.startPromise = undefined);
		return this.startPromise;
	}

	private async doStartProfiling(): Promise<void> {
		try {
			const inspectInfo = await this.agentHostService.getInspectInfo(true);
			if (this.isDisposed) {
				return;
			}
			if (!inspectInfo) {
				this.notificationService.warn(localize('profileAgentHost.noInspectPort', "无法为智能体主机进程启用 Node.js 检查器。"));
				this.profileState.set(AgentHostProfileState.None);
				return;
			}

			const sessionId = await this.profilingService.startProfiling({ host: inspectInfo.host, port: inspectInfo.port });
			if (this.isDisposed) {
				try {
					await this.profilingService.stopProfiling(sessionId);
				} catch (error) {
					this.logService.error('Failed to stop the agent host profiling session during disposal', error);
				}
				return;
			}

			this.sessionId = sessionId;
			this.profileState.set(AgentHostProfileState.Running);
			this.statusbarEntry.value = this.statusbarService.addEntry({
				name: localize('profileAgentHost.statusName', "智能体主机探查器"),
				text: localize('profileAgentHost.statusText', "正在分析智能体主机"),
				ariaLabel: localize('profileAgentHost.statusAriaLabel', "正在分析智能体主机。激活以停止分析。"),
				tooltip: localize('profileAgentHost.statusTooltip', "点击以停止性能分析。"),
				command: StopAgentHostProfileAction.ID,
				showProgress: true,
			}, 'status.agentHostProfiler', StatusbarAlignment.RIGHT);
			if (this.contextKeyService.contextMatchesRules(IsSessionsWindowContext)) {
				const handle = this.notificationService.prompt(
					Severity.Info,
					localize('profileAgentHost.notification', "正在分析本地智能体主机进程。"),
					[{
						label: localize('profileAgentHost.stop', "停止"),
						run: () => void this.stopProfiling(),
					}],
					{
						sticky: true,
						onCancel: () => void this.stopProfiling(),
					},
				);
				this.profilingNotification.value = toDisposable(() => handle.close());
			}
		} catch (error) {
			const sessionId = this.sessionId;
			this.sessionId = undefined;
			this.statusbarEntry.clear();
			this.profilingNotification.clear();
			if (sessionId) {
				try {
					await this.profilingService.stopProfiling(sessionId);
				} catch (stopError) {
					this.logService.error('Failed to clean up the agent host profiling session', stopError);
				}
			}
			if (this.isDisposed) {
				this.logService.error('Failed to start profiling the agent host during disposal', error);
				return;
			}
			this.profileState.set(AgentHostProfileState.None);
			this.notificationService.error(localize('profileAgentHost.startFailed', "未能开始分析智能体主机: {0}", getErrorMessage(error)));
		}
	}

	async stopProfiling(): Promise<void> {
		const sessionId = this.sessionId;
		if (!sessionId) {
			return;
		}

		this.sessionId = undefined;
		this.profileState.set(AgentHostProfileState.Stopping);
		this.statusbarEntry.clear();
		this.profilingNotification.clear();

		let profile: IV8Profile;
		try {
			profile = await this.profilingService.stopProfiling(sessionId);
		} catch (error) {
			this.profileState.set(AgentHostProfileState.None);
			this.notificationService.error(localize('profileAgentHost.stopFailed', "未能停止对智能体主机的分析: {0}", getErrorMessage(error)));
			return;
		}

		if (this.isDisposed) {
			return;
		}

		try {
			const profileUri = await this.saveProfile(profile);
			if (profileUri) {
				const editor = {
					resource: profileUri,
					options: {
						revealIfOpened: true,
						override: 'jsProfileVisualizer.cpuprofile.table',
					},
				};
				if (this.contextKeyService.contextMatchesRules(IsSessionsWindowContext)) {
					await this.editorService.openEditor(editor);
				} else {
					await this.editorService.openEditor(editor, SIDE_GROUP);
				}
			}
		} catch (error) {
			this.notificationService.error(localize('profileAgentHost.saveFailed', "未能保存或打开智能体主机分析: {0}", getErrorMessage(error)));
		} finally {
			this.profileState.set(AgentHostProfileState.None);
		}
	}

	private async saveProfile(profile: IV8Profile): Promise<URI | undefined> {
		let profileUri = await this.fileDialogService.showSaveDialog({
			title: localize('profileAgentHost.saveDialogTitle', "保存智能体主机配置文件"),
			availableFileSystems: [Schemas.file],
			defaultUri: joinPath(await this.fileDialogService.defaultFilePath(), `AgentHost-CPU-${new Date().toISOString().replace(/[-:]/g, '')}.cpuprofile`),
			filters: [{
				name: localize('profileAgentHost.cpuProfiles', "CPU 配置文件"),
				extensions: ['cpuprofile', 'txt'],
			}],
		});
		if (!profileUri) {
			return undefined;
		}

		let dataToWrite = profile;
		if (this.environmentService.isBuilt) {
			dataToWrite = Utils.rewriteAbsolutePaths(dataToWrite, 'piiRemoved');
			profileUri = URI.file(`${profileUri.fsPath}.txt`);
		}

		await this.fileService.writeFile(profileUri, VSBuffer.fromString(JSON.stringify(dataToWrite, undefined, '\t')));
		return profileUri;
	}
}

export class ProfileAgentHostAction extends Action2 {
	static readonly ID = 'workbench.action.chat.profileAgentHost';

	constructor() {
		super({
			id: ProfileAgentHostAction.ID,
			title: localize2('profileAgentHost', "分析本地智能体主机进程"),
			category: Categories.Developer,
			f1: true,
			icon: Codicon.circleFilled,
			precondition: ContextKeyExpr.and(
				ContextKeyExpr.or(
					IsSessionsWindowContext,
					ContextKeyExpr.and(
						ChatContextKeys.enabled,
						AGENT_HOST_ENABLED_CONTEXT_KEY,
					),
				),
				CONTEXT_AGENT_HOST_PROFILE_STATE.notEqualsTo(AgentHostProfileState.Starting),
				CONTEXT_AGENT_HOST_PROFILE_STATE.notEqualsTo(AgentHostProfileState.Running),
				CONTEXT_AGENT_HOST_PROFILE_STATE.notEqualsTo(AgentHostProfileState.Stopping),
			),
		});
	}

	override run(accessor: ServicesAccessor): Promise<void> {
		return accessor.get(IAgentHostProfileService).startProfiling();
	}
}

export class StopAgentHostProfileAction extends Action2 {
	static readonly ID = 'workbench.action.chat.stopAgentHostProfile';

	constructor() {
		super({
			id: StopAgentHostProfileAction.ID,
			title: localize2('stopAgentHostProfile', "停止本地智能体主机分析"),
			category: Categories.Developer,
			f1: true,
			icon: Codicon.debugStop,
			precondition: CONTEXT_AGENT_HOST_PROFILE_STATE.isEqualTo(AgentHostProfileState.Running),
		});
	}

	override run(accessor: ServicesAccessor): Promise<void> {
		return accessor.get(IAgentHostProfileService).stopProfiling();
	}
}

registerSingleton(IAgentHostProfileService, AgentHostProfileService, InstantiationType.Delayed);
