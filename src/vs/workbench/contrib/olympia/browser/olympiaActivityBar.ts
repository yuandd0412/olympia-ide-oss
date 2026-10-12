/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Olympia 的活动栏裁剪：把信息学竞赛用不到的视图容器从左侧栏摘掉。
 *
 *  不改上游的注册代码。ViewContainersRegistry.deregisterViewContainer 会发
 *  onDidDeregisterViewContainer，侧栏、标题栏和「打开视图」的默认命令都监听它，所以图标
 *  与命令一起消失，而上游文件保持原样 —— 下次拉 upstream 不会在这里产生冲突。
 *
 *  下面两个 import 是刻意的：先让这两个贡献完成注册，再在本模块顶层把它们登记的容器摘掉，
 *  这样不依赖 workbench.common.main.ts 里的 import 顺序。
 *--------------------------------------------------------------------------------------------*/
import '../../debug/browser/debug.contribution.js';
import '../../scm/browser/scm.contribution.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions, IViewContainersRegistry } from '../../../common/views.js';
import { VIEWLET_ID as DEBUG_VIEWLET_ID } from '../../debug/common/debug.js';
import { VIEWLET_ID as SCM_VIEWLET_ID } from '../../scm/common/scm.js';

/**
 * 侧栏上对 OI 工作流无用的容器。加一条就少一个图标，理由写在上面。
 */
const HIDDEN_VIEWLETS: readonly string[] = [
	// 断点调试不是竞赛工作流：评测机上是「编译 + 运行 + 对拍」，F9 已经接管，
	// 而且本产品不随包 js-debug，留着只有一个永远灰着的图标。
	DEBUG_VIEWLET_ID,
	// 机房不做版本管理，题目与代码是本地文件；git 扩展本身也没进包，
	// 于是「源代码管理」只剩一个点开就提示没有提供程序的空壳。
	SCM_VIEWLET_ID,
];

const containerRegistry = Registry.as<IViewContainersRegistry>(Extensions.ViewContainersRegistry);

for (const viewletId of HIDDEN_VIEWLETS) {
	const container = containerRegistry.get(viewletId);
	if (container) {
		containerRegistry.deregisterViewContainer(container);
	}
}
