/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IEditorEmptyStateRenderer } from '../../../services/editor/browser/editorEmptyStateService.js';
import { createOlympiaHomeView, runOlympiaHomeCommand } from './olympiaHomeView.js';

/**
 * 「编辑器区为空时显示 Olympia 首页」开关。
 *
 * 默认开着 —— 空编辑区在 VS Code 里是「VS Code 大 logo + 一堆快捷键」，
 * 那是给通用 IDE 看的。对 OI 选手来说，这一屏更适合放「拉题 / 插模板 / 集训清单 /
 * AI 教练」这些真正会点到的入口。
 *
 * 留这个开关是因为空编辑区占位页是**每个编辑器组**都会渲染的，万一有人不喜欢，
 * 关掉就退回上游那套快捷键提示，不需要重装。
 */
export const OLYMPIA_HOME_EMPTY_STATE_CONFIGURATION_KEY = 'olympia.home.emptyState';

/**
 * 造一个把 Olympia 首页渲染进空编辑区的渲染器。
 *
 * 内核那边只认「当前有没有渲染器」，不关心渲染器长什么样 —— 它只负责把一个
 * **空容器**交给渲染器。所以这个工厂返回的对象就是内核扩展点
 * `IEditorEmptyStateRenderer` 的实现。
 *
 * @param commandService 执行首页快捷入口时用。
 * @param notificationService 快捷入口对应的命令不存在时，用来给用户一句话提示。
 */
export function createOlympiaEmptyStateRenderer(
	commandService: ICommandService,
	notificationService: INotificationService
): IEditorEmptyStateRenderer {
	return {
		render(container: HTMLElement): void {
			// ## 为什么「只渲染一次」
			//
			// 内核的 watermark `render()` 会被反复调用（配置变化、工作台状态变化、
			// 渲染器注册/注销）。首页内容是静态的（入口列表不随这些状态变化），
			// 重复构建只会白白丢焦点、丢滚动位置，所以第一次渲染之后保持原样。
			//
			// 渲染器被注销时内核会清空这个容器，所以「注销 → 再注册」之后重新渲染是安全的。
			if (container.firstChild) {
				return;
			}

			container.appendChild(createOlympiaHomeView({
				runCommand: command => runOlympiaHomeCommand(commandService, notificationService, command)
			}));
		}
	};
}
