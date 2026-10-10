/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../nls.js';
import { getActiveWindow } from '../../../../base/browser/dom.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { Action2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INativeHostService } from '../../../../platform/native/common/native.js';

export class OpenWebviewDeveloperToolsAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.webview.openDeveloperTools',
			title: nls.localize2('openToolsLabel', "打开 Webview 开发人员工具"),
			category: Categories.Developer,
			metadata: {
				description: nls.localize('openToolsDescription', "打开活动 Web 视图的开发人员工具")
			},
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const nativeHostService = accessor.get(INativeHostService);

		// eslint-disable-next-line no-restricted-syntax
		const iframeWebviewElements = getActiveWindow().document.querySelectorAll('iframe.webview.ready');
		if (iframeWebviewElements.length) {
			console.info(nls.localize('iframeWebviewAlert', "使用标准开发工具调试基于 iFrame 的 Web 视图"));
			nativeHostService.openDevTools();
		}
	}
}
