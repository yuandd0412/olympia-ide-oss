/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * 设置入口劫持的判据。
 *
 * ## 这个文件为什么必须「零 import」
 *
 * 它被 `contrib/preferences/browser/preferences.contribution.ts`（上游文件）import，
 * 用来决定 `workbench.action.openSettings` 该不该转交给 Olympia 简化设置页。
 * 如果这里再 import 任何 workbench 模块，就有可能形成
 * `preferences.contribution → olympiaSettingsInterceptor → … → preferences.contribution`
 * 的环 —— 那个环在 webpack 里表现为「初始化顺序未定义」的诡异崩溃，而且极难定位。
 *
 * 所以这里只放**纯函数**，不碰任何服务。它的可测试性反而更好：门禁脚本可以直接
 * 从源码里抠出判据做真值表验证，不需要起 workbench。
 */

/**
 * `workbench.action.openSettings` 的参数形状（只取判据关心的几个字段）。
 *
 * 字段名与上游 `IOpenSettingsActionOptions` 对齐，但不 import 它的类型 —— 同上，避免环。
 */
export interface IOlympiaOpenSettingsArgs {
	readonly query?: string;
	readonly focusSearch?: boolean;
	readonly openToSide?: boolean;
	readonly revealSetting?: unknown;
}

/**
 * 该不该把这次「打开设置」劫持到 Olympia 简化设置页。
 *
 * ## 判据
 *
 * **只有「完全无参」才接管。** 只要调用方带了下面任意一个意图，就走原生设置页：
 *
 * | 参数 | 为什么放行原生 |
 * |---|---|
 * | `query`（哪怕是空串） | 调用方想定位到某个具体设置项。简化设置页没有搜索与 `@id:` 定位能力，接管等于把用户丢在一屏无关内容上。 |
 * | `focusSearch` | 同上，调用方明确要聚焦搜索框。 |
 * | `openToSide` | 调用方要求在侧边打开，原生页是编辑器，自绘页不是，语义对不上。 |
 * | `revealSetting` | 调用方要定位并可选中某个键，原生页才有这个能力。 |
 *
 * ## 为什么 `query` 用「存在」而不是「非空」判断
 *
 * `query: ''` 是「存在但为空」。判成「存在」走原生更安全：空串是一个退化输入，
 * 走原生页最多显示一个空搜索框，走自绘页则是**丢掉调用方的意图**。
 * 保守的一侧永远是原生页 —— 它是完整能力的那个。
 *
 * ## 这条判据的反面责任
 *
 * 被劫持之后，原生设置页**必须仍然可达**（`workbench.action.openSettings2` 永远不改，
 * 且简化设置页底部有「高级设置」按钮指向它）。否则一旦简化设置页缺了某个能力，
 * 用户就再也找不到了 —— 那才是「完全替换」真正危险的地方。
 */
export function olympiaShouldInterceptSettings(args: IOlympiaOpenSettingsArgs | undefined): boolean {
	if (!args) {
		return true;
	}
	if (args.query !== undefined) {
		return false;
	}
	if (args.focusSearch === true) {
		return false;
	}
	if (args.openToSide === true) {
		return false;
	}
	if (args.revealSetting !== undefined) {
		return false;
	}
	return true;
}
