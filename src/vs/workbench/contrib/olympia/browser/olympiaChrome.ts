/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Olympia 的界面裁剪：把 BYOK 产品里不该出现的上游入口按掉。
 *
 *  `defaultChatAgent.byokOnly` 已经把托管助手的登录 / 配额 / 升级链路整条摘掉，但状态栏和
 *  活动栏底部还留着几处上游入口：一枚「Copilot 状态」chip、一枚远程图标，和一个「账户」按钮
 *  （点开就是登录托管账号）。这些的门径和 byokOnly 不是同一个判断，所以在这里按产品开关显式
 *  关掉——用户如果自己在别处打开过「账户」入口，我们不再覆盖他的选择。
 *--------------------------------------------------------------------------------------------*/
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { IStatusbarService } from '../../../services/statusbar/browser/statusbar.js';

/** 状态栏里属于托管助手 / 本产品没有的能力的条目。 */
const HIDDEN_STATUS_ENTRIES: readonly string[] = [
	// 「Copilot 状态 / 内联建议已禁用」：本产品没有托管助手，这枚 chip 只会让人以为要登录。
	'chat.statusBarEntry',
	// 左下角那枚远程图标（`remoteIndicator.ts:579`，优先级=最前，所以它是学生第一眼看到的图标）。
	// 点开是一个空的远程选择器——本产品没有远程开发，也不打算有。
	'status.host',
	// 转发端口图标和远程图标是两套注册（`remoteExplorer.ts:162`），只按掉 host 会留下它。
	'status.forwardedPorts',
	// 「按流量计费的连接」警告（`meteredConnectionStatus.ts:34`）：机房用手机热点时会自己冒出来，
	// 而它的提示文案说的是扩展更新、设置同步、Git 自动操作——这三样本产品都没有。
	'workbench.contrib.meteredConnectionStatus',
	// 调试 chip（`debugStatus.ts:26`）：默认要首次会话才出现，但它是设置里一步就能常显的东西，
	// 而调试视图整栏已经从侧栏摘掉了（olympiaActivityBar），点它只能进「选择调试环境」的空列表。
	'status.debug',
	// 下面三枚都是开发者工具跑起来才出现的红/进度 chip，入口在「开发人员」命令组里；
	// 那组命令已从命令面板整组摘掉，这里是最后一道保险：万一有人从别处按响了跟踪，
	// 状态栏最左边会出现一枚他不知道怎么关的图标。
	'status.tracing',
	'status.profiler',
	'status.agentHostProfiler',
];

/** 上游用同一个 key 控制活动栏底部的「账户」按钮（默认显示）。 */
const SHOW_ACCOUNTS_KEY = 'workbench.activity.showAccounts';

class OlympiaChromeContribution implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.olympiaChromeTrim';

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IStorageService private readonly storageService: IStorageService,
		@IProductService productService: IProductService,
	) {
		if (!productService.defaultChatAgent?.byokOnly) {
			return;
		}

		for (const entryId of HIDDEN_STATUS_ENTRIES) {
			this.statusbarService.updateEntryVisibility(entryId, false);
		}

		// 只在没人动过时写默认值：这是出厂姿态，不是强制策略。
		if (this.storageService.get(SHOW_ACCOUNTS_KEY, StorageScope.PROFILE) === undefined) {
			this.storageService.store(SHOW_ACCOUNTS_KEY, false, StorageScope.PROFILE, StorageTarget.USER);
		}
	}
}

registerWorkbenchContribution2(OlympiaChromeContribution.ID, OlympiaChromeContribution, WorkbenchPhase.BlockRestore);
