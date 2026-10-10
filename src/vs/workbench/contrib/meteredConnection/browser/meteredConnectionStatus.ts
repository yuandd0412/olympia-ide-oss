/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IMeteredConnectionService } from '../../../../platform/meteredConnection/common/meteredConnection.js';
import { IStatusbarEntry, IStatusbarEntryAccessor, IStatusbarService, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';

export class MeteredConnectionStatusContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.meteredConnectionStatus';

	private readonly statusBarEntry = this._register(new MutableDisposable<IStatusbarEntryAccessor>());

	constructor(
		@IMeteredConnectionService private readonly meteredConnectionService: IMeteredConnectionService,
		@IStatusbarService private readonly statusbarService: IStatusbarService,
	) {
		super();

		this.updateStatusBarEntry(this.meteredConnectionService.isConnectionMetered);

		this._register(this.meteredConnectionService.onDidChangeIsConnectionMetered(isMetered => {
			this.updateStatusBarEntry(isMetered);
		}));
	}

	private updateStatusBarEntry(isMetered: boolean): void {
		if (isMetered) {
			if (!this.statusBarEntry.value) {
				this.statusBarEntry.value = this.statusbarService.addEntry(
					this.getStatusBarEntry(),
					MeteredConnectionStatusContribution.ID,
					StatusbarAlignment.RIGHT,
					-Number.MAX_VALUE // Show at the far right
				);
			}
		} else {
			this.statusBarEntry.clear();
		}
	}

	private getStatusBarEntry(): IStatusbarEntry {
		return {
			name: localize('status.meteredConnection', "按流量计费的连接"),
			text: '$(radio-tower)',
			ariaLabel: localize('status.meteredConnection.ariaLabel', "已启用按流量计费的连接"),
			tooltip: localize('status.meteredConnection.tooltip', "已启用按流量计费的连接。一些自动功能(如扩展更新、设置同步和自动 Git 操作)会暂停，以减少数据使用量。"),
			kind: 'warning',
			command: {
				id: 'workbench.action.configureMeteredConnection',
				title: localize('status.meteredConnection.configure', "配置")
			},
			showInAllWindows: true
		};
	}
}
