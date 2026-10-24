/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/olympiaWelcome.css';

import { localize } from '../../../../nls.js';
import { $, Dimension, IDomPosition } from '../../../../base/browser/dom.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { IWorkbenchThemeService } from '../../../services/themes/common/workbenchThemeService.js';
import { OlympiaWelcomeInput } from './olympiaWelcomeInput.js';
import { createOlympiaHomeView, runOlympiaHomeCommand } from './olympiaHomeView.js';

/**
 * Olympia 首页（兼作启动开始页，替代上游 VS Code 三段式欢迎页）。
 *
 * 为什么是独立的 EditorPane 而不是复用 `GettingStartedPage`：
 * 上游 `StartupPageEditorResolverContribution` 用 `registerEditor('walkThrough:/**')` +
 * `canSupportResource: uri => uri.scheme === 'walkThrough'` 做的是 **scheme 级**认领，
 * 新页如果复用同一个 scheme 会被上游 GettingStartedInput 直接抢走。所以本产品用独立
 * scheme `olympia-welcome`（见 `olympiaWelcomeInput.ts`）。
 *
 * ## 内容来自哪
 *
 * 页面本身是空壳容器（`.olympiaWelcome`），真正的内容是 `olympiaHomeView.ts` 里那份
 * **共享首页视图**。三处落点（开始页 / 空编辑区 / 帮助>欢迎）共用同一份渲染，
 * 所以三处永远一致。
 */
export class OlympiaWelcomePage extends EditorPane {

	public static readonly ID = 'olympiaWelcomePage';

	private readonly container: HTMLElement;

	get editorInput(): OlympiaWelcomeInput | undefined {
		return this._input as OlympiaWelcomeInput | undefined;
	}

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IWorkbenchThemeService protected override readonly themeService: IWorkbenchThemeService,
		@IStorageService storageService: IStorageService,
		@ICommandService private readonly commandService: ICommandService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super(OlympiaWelcomePage.ID, group, telemetryService, themeService, storageService);

		this.container = $('.olympiaWelcome', {
			role: 'document',
			tabindex: 0,
			'aria-label': localize('olympiaWelcomeAriaLabel', "Olympia 首页。")
		});
	}

	protected override createEditor(parent: HTMLElement): void {
		parent.appendChild(this.container);
		this.container.appendChild(createOlympiaHomeView({
			runCommand: command => runOlympiaHomeCommand(this.commandService, this.notificationService, command)
		}));
	}

	// 首页是纯 CSS 布局（宽度自适应、超过高度时内部滚动），不需要按 dimension 重排。
	// 但 `Composite` 把 `layout` 声明为抽象方法，不实现会直接编译不过。
	layout(dimension: Dimension, position?: IDomPosition): void {
		// no-op
	}
}
