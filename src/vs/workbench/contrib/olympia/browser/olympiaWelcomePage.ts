/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/olympiaWelcome.css';

import { localize } from '../../../../nls.js';
import { $, Dimension, IDomPosition } from '../../../../base/browser/dom.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { IWorkbenchThemeService } from '../../../services/themes/common/workbenchThemeService.js';
import { OlympiaWelcomeInput } from './olympiaWelcomeInput.js';

/**
 * Olympia 开始页（替代上游 VS Code 三段式欢迎页）。
 *
 * 为什么是独立的 EditorPane 而不是复用 `GettingStartedPage`：
 * 上游 `StartupPageEditorResolverContribution` 用 `registerEditor('walkThrough:/**')` +
 * `canSupportResource: uri => uri.scheme === 'walkThrough'` 做的是 **scheme 级**认领，
 * 新页如果复用同一个 scheme 会被上游 GettingStartedInput 直接抢走。所以本产品用独立
 * scheme `olympia-welcome`（见 `olympiaWelcomeInput.ts`）。
 *
 * M1 只落地「管线」：独立 scheme + 独立 EditorPane + 独立配置节点 + 启动路由分支。
 * 视觉（落地页布局 + 一镜到底开场动画）待原型评审通过后在同一个文件里落地。
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
	) {
		super(OlympiaWelcomePage.ID, group, telemetryService, themeService, storageService);

		this.container = $('.olympiaWelcome', {
			role: 'document',
			tabindex: 0,
			'aria-label': localize('olympiaWelcomeAriaLabel', "Olympia 开始页。")
		});
	}

	protected override createEditor(parent: HTMLElement): void {
		parent.appendChild(this.container);
	}

	// M1 阶段落地页还没有滚动内容，布局阶段无需做任何处理。
	// 但 `Composite` 把 `layout` 声明为抽象方法，不实现会直接编译不过。
	layout(dimension: Dimension, position?: IDomPosition): void {
		// no-op
	}
}
