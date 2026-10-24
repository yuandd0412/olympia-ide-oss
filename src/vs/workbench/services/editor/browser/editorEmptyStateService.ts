/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';

/**
 * 「空编辑区占位」的渲染器。
 *
 * 没有任何编辑器打开的编辑器组，默认会显示上游那套「VS Code 大 logo + 快捷键提示」。
 * 这是一个**通用扩展点**：任何一层都可以注册一个渲染器，把这一屏换成自己的内容；
 * 没有注册时上游行为完全不变。
 *
 * ## 为什么这个扩展点住在 services 层
 *
 * 消费方（内核的 `editorGroupWatermark.ts`）和提供方（产品自己的 contrib）分处不同的层，
 * 而 `src/vs/workbench/browser/**` **不允许** import `src/vs/workbench/contrib/**`
 * （见 `eslint.config.js` 里 `src/vs/workbench/~` 的 `code-import-patterns` restrictions：
 * contrib 只在测试文件里才放行）。
 *
 * 所以扩展点必须待在两边都能 import 的位置：
 * `vs/workbench/{common,browser}/**`，以及 `vs/workbench/services/` 底下的各个服务目录。
 * 这里选 `services/editor/browser/` —— 它本来就是「编辑器相关服务」的归处，
 * 而这个扩展点要往 DOM 里塞东西，属于 browser 层的职责。
 */
export interface IEditorEmptyStateRenderer {

	/**
	 * 把空编辑区渲染成自定义内容。
	 *
	 * @param container 一个**空**的容器节点。渲染器负责往里填内容。
	 */
	render(container: HTMLElement): void;
}

const _onDidChangeEditorEmptyStateRenderer = new Emitter<void>();

/**
 * 空编辑区占位渲染器发生变化时触发（注册与注销都会触发）。
 */
export const onDidChangeEditorEmptyStateRenderer = _onDidChangeEditorEmptyStateRenderer.event;

let editorEmptyStateRenderer: IEditorEmptyStateRenderer | undefined;

/**
 * 注册空编辑区占位渲染器。
 *
 * 同一时刻只保留一个渲染器，重复注册会**覆盖**前一个。
 * 释放返回的 disposable 会注销渲染器 —— 只注销自己注册的那一个，
 * 被别人覆盖之后再释放这个 disposable 不会把别人的渲染器踢掉。
 * 注销之后上游占位页随即恢复。
 */
export function registerEditorEmptyStateRenderer(renderer: IEditorEmptyStateRenderer): IDisposable {
	editorEmptyStateRenderer = renderer;
	_onDidChangeEditorEmptyStateRenderer.fire();

	return {
		dispose: () => {
			if (editorEmptyStateRenderer === renderer) {
				editorEmptyStateRenderer = undefined;
				_onDidChangeEditorEmptyStateRenderer.fire();
			}
		}
	};
}

/**
 * 当前生效的空编辑区占位渲染器；没有注册时返回 `undefined`，此时用上游占位页。
 */
export function getEditorEmptyStateRenderer(): IEditorEmptyStateRenderer | undefined {
	return editorEmptyStateRenderer;
}
