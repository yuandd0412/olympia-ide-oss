/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../nls.js';
import { Action2 } from '../../../platform/actions/common/actions.js';
import { ILocalizedString } from '../../../platform/action/common/action.js';
import product from '../../../platform/product/common/product.js';
import { IDialogService } from '../../../platform/dialogs/common/dialogs.js';
import { ServicesAccessor } from '../../../platform/instantiation/common/instantiation.js';
import { INativeHostService } from '../../../platform/native/common/native.js';
import { toErrorMessage } from '../../../base/common/errorMessage.js';
import { IProductService } from '../../../platform/product/common/productService.js';
import { isCancellationError } from '../../../base/common/errors.js';

const shellCommandCategory: ILocalizedString = localize2('shellCommand', "Shell 命令");

export class InstallShellScriptAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.installCommandLine',
			title: localize2('install', "在 PATH 中安装“{0}”命令", product.applicationName),
			category: shellCommandCategory,
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const nativeHostService = accessor.get(INativeHostService);
		const dialogService = accessor.get(IDialogService);
		const productService = accessor.get(IProductService);

		try {
			await nativeHostService.installShellCommand();

			dialogService.info(localize('successIn', "已成功在 PATH 中安装了 Shell 命令“{0}”。", productService.applicationName));
		} catch (error) {
			if (isCancellationError(error)) {
				return;
			}

			dialogService.error(toErrorMessage(error));
		}
	}
}

export class UninstallShellScriptAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.uninstallCommandLine',
			title: localize2('uninstall', "从 PATH 中卸载“{0}”命令", product.applicationName),
			category: shellCommandCategory,
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const nativeHostService = accessor.get(INativeHostService);
		const dialogService = accessor.get(IDialogService);
		const productService = accessor.get(IProductService);

		try {
			await nativeHostService.uninstallShellCommand();

			dialogService.info(localize('successFrom', "已成功从 PATH 卸载 Shell 命令“{0}”。", productService.applicationName));
		} catch (error) {
			if (isCancellationError(error)) {
				return;
			}

			dialogService.error(toErrorMessage(error));
		}
	}
}
