/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * 「Olympia 开始页编辑器已就位」的信號。
 *
 * ## 为什么需要它
 *
 * 进入动画是用 `destination-out` 在极光上**擦开一个洞**，露出底下一直都在的真实工作台。
 * 「露出来的那一帧必须是成品」是「全程没有断点」的硬要求 ——
 * 洞擦开的那一刻，编辑器区如果还是空的、几百毫秒后编辑器才弹出来，
 * 那一下就是断点（画面内容突变）。
 *
 * 上游 `startupPage.ts` 打开开始页用的是 `this.editorService.openEditor(...)`，
 * 它返回 promise，但那一行**没有 await** —— 于是 `await this.openOlympiaWelcome()`
 * 立刻返回，工作台的 `Restored` 阶段先到、编辑器后到。
 *
 * 只等 `LifecyclePhase.Restored` 是不够的：它保证的是「工作台骨架建好了」，
 * 不是「开始页画出来了」。
 *
 * ## 协议
 *
 * - 默认**已就位**（`isReady === true`）：没有开始页要开的时候，等它是白等。
 * - `startupPage.ts` 决定要打开开始页时先 `markOpening()`，
 *   等 `openEditor` 的 promise 落地后 `markReady()`。
 * - 引导侧等 `isReady` 为 true 才允许起跑。
 *
 * ## 为什么还要一个「失败」态
 *
 * 早先 `startupPage.ts` 用的是 `try { ... } finally { markReady(); }` ——
 * `finally` 不看结果，**打开失败**也会被报成「已就位」。
 * 于是引导侧擦开洞，洞里是空的编辑器区：几百毫秒后开始页也没出现
 * （它已经失败了，不会再出现）。那一下就是断点，而且是没法自愈的断点。
 *
 * 所以失败必须**单独报出来**：引导侧知道开始页永远不会有，就改走
 * 「整层极光淡出、露出真实工作台」的收场 —— 那是一个正常的空工作台，
 * 而不是「洞里空着」。
 *
 * 只在这一处用信号，而不是让引导侧去 `editorService.editors` 里找开始页：
 * 上游有多个分支（开了文件夹、已经开着别的编辑器）根本不会打开开始页，
 * 引导侧靠猜是猜不出来的 —— 只有「实际开的人」知道开了没有。
 */
class OlympiaWelcomeReadySignal {

	/** 是否正处在「开始页正在打开」的窗口里。 */
	private opening = false;

	/** 开始页打开失败 —— 再等多久都不会有了。 */
	private failed = false;

	/** 即将（或正在）打开开始页 —— 在这段时间里就绪信号为假。 */
	markOpening(): void {
		this.opening = true;
		this.failed = false;
	}

	/** 开始页已经打开完毕（或确定不会打开）—— 就绪信号恢复为真。 */
	markReady(): void {
		this.opening = false;
	}

	/**
	 * 开始页**打开失败**。
	 *
	 * 和 `markReady()` 必须分开：`markReady()` 意味着「洞擦开时洞里是成品」，
	 * `markFailed()` 意味着「洞里只能是空的」。两者对引导侧是完全不同的指令。
	 */
	markFailed(): void {
		this.opening = false;
		this.failed = true;
	}

	/** 开始页是否已经就位（也就是「洞擦开时露出的会是成品」）。 */
	get isReady(): boolean {
		return !this.opening && !this.failed;
	}

	/** 开始页是不是已经彻底打不开了。 */
	get isFailed(): boolean {
		return this.failed;
	}
}

export const olympiaWelcomeReady = new OlympiaWelcomeReadySignal();
