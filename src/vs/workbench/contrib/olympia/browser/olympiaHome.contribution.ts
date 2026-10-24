/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { registerEditorEmptyStateRenderer } from '../../../services/editor/browser/editorEmptyStateService.js';
import { createOlympiaEmptyStateRenderer, OLYMPIA_HOME_EMPTY_STATE_CONFIGURATION_KEY } from './olympiaHomeEmptyState.js';
import { OLYMPIA_HOME_COMMAND_ID } from './olympiaHomeView.js';
import { OlympiaWelcomeInput } from './olympiaWelcomeInput.js';

/**
 * 「打开 Olympia 首页」。
 *
 * 首页本体是 `OlympiaWelcomePage`（`olympia-welcome` scheme）—— 和启动时看到的那一页
 * 是**同一个** EditorPane。首页和开始页如果做成两套 UI，用户会以为是两个不同的页面，
 * 内容一旦不一致就会显得很业余。
 *
 * 这个命令有三个调用方：
 *  1. 命令面板（`f1: true`）；
 *  2. 上游「帮助 > 欢迎」被接管后的落点（见 `gettingStarted.contribution.ts`）；
 *  3. 用户自己绑的快捷键。
 *
 * 打开时用 `pinned: true` —— 首页是一个「随时可以回到」的页面，不该被别的标签页挤掉。
 */
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: OLYMPIA_HOME_COMMAND_ID,
			title: localize2('olympia.openHome', "打开 Olympia 首页"),
			category: Categories.Help,
			f1: true,
			metadata: {
				description: localize2('olympia.openHome.description', "打开面向 OI 选手的 Olympia 首页。")
			}
		});
	}

	public async run(accessor: ServicesAccessor): Promise<void> {
		const instantiationService = accessor.get(IInstantiationService);
		const editorService = accessor.get(IEditorService);
		const input = instantiationService.createInstance(OlympiaWelcomeInput);
		await editorService.openEditor(input, { pinned: true });
	}
});

/**
 * 把 Olympia 首页接管空编辑区。
 *
 * ## 为什么要「注册 / 注销」，而不是「注册一次」
 *
 * `olympia.home.emptyState` 关掉时要**完全退回**上游那套快捷键提示。
 * 内核那边只认「当前有没有渲染器」，所以关掉开关就注销渲染器，内核收到事件后
 * 重画成上游占位页 —— 退回去是原子的，不需要在内核里补任何分支。
 *
 * ## 为什么要走内核扩展点，而不是让内核直接 import contrib
 *
 * `src/vs/workbench/browser/**` 不允许 import `src/vs/workbench/contrib/**`
 * （`eslint.config.js` 里 `src/vs/workbench/~` 的 `code-import-patterns` restrictions：
 * contrib 只在测试文件里才放行）。扩展点住在 `services/editor/browser/`，
 * 两边都 import 得到，分层规则也不破。
 */
class OlympiaEmptyStateContribution extends Disposable {

	static readonly ID = 'olympia.contrib.homeEmptyState';

	private readonly registrationStore = this._register(new DisposableStore());

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ICommandService private readonly commandService: ICommandService,
		@INotificationService private readonly notificationService: INotificationService
	) {
		super();

		this.updateRegistration();

		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(OLYMPIA_HOME_EMPTY_STATE_CONFIGURATION_KEY)) {
				this.updateRegistration();
			}
		}));
	}

	private updateRegistration(): void {
		this.registrationStore.clear();

		if (!this.configurationService.getValue<boolean>(OLYMPIA_HOME_EMPTY_STATE_CONFIGURATION_KEY)) {
			return;
		}

		this.registrationStore.add(registerEditorEmptyStateRenderer(
			createOlympiaEmptyStateRenderer(this.commandService, this.notificationService)
		));
	}
}

registerWorkbenchContribution2(OlympiaEmptyStateContribution.ID, OlympiaEmptyStateContribution, WorkbenchPhase.BlockRestore);
