/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/olympiaOnboarding.css';

import { addDisposableListener } from '../../../../base/browser/dom.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { ILifecycleService, LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { OlympiaOnboardingBackdrop } from './olympiaOnboardingBackdrop.js';
import { OlympiaOnboardingCards } from './olympiaOnboardingCards.js';
import { olympiaWelcomeReady } from './olympiaWelcomeReady.js';
import {
	OLYMPIA_ONBOARDING_CARD_COUNT,
	OLYMPIA_ONBOARDING_ENTER_DURATION,
	OLYMPIA_ONBOARDING_PARTICLES,
	OLYMPIA_ONBOARDING_PARTICLE_WINDOW,
	OLYMPIA_ONBOARDING_SEAM_Y,
	OLYMPIA_ONBOARDING_SWEEPS,
	olympiaOnboardingClamp,
	olympiaOnboardingFrame,
	olympiaOnboardingSweepTravel,
	OlympiaOnboardingRevealGeometry,
	OlympiaOnboardingSweepState,
	OlympiaOnboardingSweepTarget
} from './olympiaOnboardingTimeline.js';

/**
 * 一次性的「开始引导」：动态背景 + 卡片配置 + 5 秒进入动画。
 *
 * ## 这套东西要解决的核心问题：全程没有断点
 *
 * 「断点」指的是画面从 A 跳到 B 的那一瞬间 —— 黑屏、场景重建、欢迎页切工作台。
 * 要没有断点，只有一种做法：**让 A 和 B 从第一帧就同时存在**。
 *
 * 所以这里的层次是（从下往上）：
 *
 * ```
 *   .monaco-workbench      ← 真实工作台，从第一帧就在那儿，一直都在
 *   .olympia-onboarding    ← 本次引导的 overlay
 *     ├ .olympia-onboarding-splash    首帧兜底（canvas 画出来后淡出）
 *     ├ .olympia-onboarding-backdrop  不透明极光画布
 *     ├ .olympia-onboarding-cards     卡片配置层
 *     └ .olympia-onboarding-fx        星光 / 光核 / 闪点 / 暗角 / 通电扫光
 * ```
 *
 * 进入动画**不是**「把极光关掉、显示工作台」，而是**在极光上擦开一个洞**，
 * 底下一直都在的真实工作台自然透出来。所以：
 *
 *  - 没有一层被移除或重建 —— 只有 alpha 在变；
 *  - 极光的时钟**永不重置**，进入动画期间它还在流动；
 *  - 所有动画共用**同一个时间源**（rAF 的帧时间戳）；
 *  - 收尾时把 overlay 整个删掉是**不可见**的 —— 那时洞已经擦净、卡片已经化成星光、
 *    暗角已经退到 0、扫光已经结束。
 *
 * ## 挂载点为什么是 `layoutService.getContainer(mainWindow)`
 *
 * 不是 `document.body`：body 挂载会盖住对话框、快速输入、通知这些浮层，
 * 破坏它们各自的 z-index 语义（浮层在 2540~2575，overlay 在 2530）。
 *
 * 挂进 `mainContainer`（`.monaco-workbench`）意味着 overlay 和工作台在同一个
 * 层叠上下文里，浮层仍然能盖住我们 —— 这正是我们要的。
 *
 * 而且 `getContainerFromDocument()` 对主窗口是**直接返回 `this.mainContainer`**，
 * 不要求它已经在 document 里。所以这个 overlay 可以在工作台还没渲染时就挂进去，
 * 等 `mainContainer` 被 append 到 document 时它已经在那儿了 —— **首帧即极光**。
 */

/** overlay 相对工作台的 z-index。盖住标题栏（2500），但让开窗口按钮（3000）、快速输入（2550）、对话框（2575）、通知（2545）。 */
const OLYMPIA_ONBOARDING_Z_INDEX = 2530;

/**
 * 扫光带宽（px）。
 *
 * 从 140 收到 128：带宽越窄，光带越像「一道刀锋」而不是「一块柔光板」。
 * 柔光板扫过去的时候边界是糊的，糊边界读作「贴图在动」；窄带 + 硬核才有方向感。
 *
 * 改这个数是安全的：几何门（`analyze-sweep-bands.mjs`）的带宽和位移**全部从 DOM 矩形实测**，
 * 不是从这里读常量 —— 所以脚本自动跟着变。
 */
const OLYMPIA_ONBOARDING_SWEEP_BAND = 128;

/**
 * 每个部件对应的工作台 part。
 *
 * 只列**默认就存在**的部件。底部面板（`Parts.PANEL_PART`）默认是收起的，
 * 拿不到矩形 → 那道扫光永远不会亮 → 时间线上留下一段死区。
 * 状态栏（`Parts.STATUSBAR_PART`）是常驻的，替掉底部面板正好补上最后一道。
 */
const OLYMPIA_ONBOARDING_SWEEP_PARTS: readonly [OlympiaOnboardingSweepTarget, Parts][] = [
	['titlebar', Parts.TITLEBAR_PART],
	['activitybar', Parts.ACTIVITYBAR_PART],
	['editor', Parts.EDITOR_PART],
	['sidebar', Parts.SIDEBAR_PART],
	['statusbar', Parts.STATUSBAR_PART],
];

/**
 * 强调拍：整段扫光演出里**唯一**不一样的那一道 —— 最早开始的那道。
 *
 * 五道扫光同强度同颜色读作「一段流水」；有一道不一样，读者才读成「点亮了」。
 *
 * 它是**静态的设计决定**，所以在构造期一次性定好，不在每帧的渲染分支里判断 ——
 * 那样做既没有意义，又会让「扫光方向必须来自 axis」这条约束变得难以判断。
 */
const OLYMPIA_ONBOARDING_ACCENT_SWEEP: OlympiaOnboardingSweepTarget =
	OLYMPIA_ONBOARDING_SWEEPS.reduce((a, b) => (a.start <= b.start ? a : b)).id;

export class OlympiaOnboarding implements IDisposable {

	/**
	 * 首启一次性标记。
	 *
	 * 用 PROFILE + MACHINE：跟着用户走，但**不参与设置同步** —— 引导是本机的一次性体验，
	 * 同步到别的机器上会让那边也弹一次，没道理。
	 */
	static readonly STORAGE_KEY = 'olympia.onboarding.completed.v1';

	/**
	 * 起跑闸门的**硬上限**（秒）。
	 *
	 * 起跑要同时满足两个条件：工作台骨架已恢复（`Restored`），且开始页已经画出来。
	 * 少任何一个，洞擦开那一刻露出来的就是半成品 —— 那本身就是一次断点。
	 *
	 * 但也不能无限等：万一某个扩展把工作台卡住，用户会永远停在这层极光上，
	 * 那比露一次半成品更糟。所以到点强制放行。
	 */
	private static readonly ENTER_GATE_WAIT_LIMIT = 15.0;

	/**
	 * 开始页打不开时的收场淡出时长（毫秒）。
	 *
	 * 260ms：比 CSS 里 `.olympia-onboarding-fading` 的 transition 长一点，
	 * 保证淡出走完了才把整层删掉 —— 提前删会在淡到一半时硬切。
	 */
	private static readonly ABORT_FADE_MS = 300;

	private readonly rootElement: HTMLElement;
	private readonly waitingElement: HTMLElement;
	private readonly fxElement: HTMLElement;
	private readonly particleCanvas: HTMLCanvasElement;
	private readonly particleContext: CanvasRenderingContext2D;
	private readonly coreElement: HTMLElement;
	private readonly flashElement: HTMLElement;
	private readonly rimElement: HTMLElement;
	private readonly vignetteElement: HTMLElement;
	private readonly sweepElements = new Map<OlympiaOnboardingSweepTarget, HTMLElement>();

	private readonly backdrop: OlympiaOnboardingBackdrop;
	private readonly cards: OlympiaOnboardingCards;

	private readonly disposables: IDisposable[] = [];

	private animationFrame: number | null = null;
	private lastTimestamp = 0;
	/** 背景自己的单调时钟（秒）。**永不重置。 */
	private backdropTime = 0;
	private painted = false;

	/** 进入动画的起点（rAF 帧时间戳）。null = 还没起跑。 */
	private enterStart: number | null = null;
	/** 用户已经点了「开始 / 跳过」，但工作台还没恢复。 */
	private enterRequested = false;
	/**
	 * 「点了开始」的时刻（rAF 帧时间戳）。-1 = 还没点。
	 *
	 * 用 -1 而不是 0 当哨兵：rAF 时间戳是**非负**的单调时钟，0 也是它的合法取值。
	 * 拿合法域里的一个值当「未设置」，等于赌「0 永不出现」——
	 * 真出现了，等待时长恒为 0，硬上限就永远不触发，闸门无限等待。
	 */
	private enterRequestedAt = -1;
	/** 收场淡出用的定时器（开始页打不开时的退路）。 */
	private fadeTimer: number | null = null;

	private viewportWidth = 0;
	private viewportHeight = 0;
	/** 光缝在视口里的像素 y。粒子汇聚目标、光缝本体、点火条三者必须落在同一条线上。 */
	private seamY = -1;
	private particleOrigins: { x: number; y: number }[] = [];
	private sweepRects = new Map<OlympiaOnboardingSweepTarget, DOMRect>();

	private disposed = false;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@IStorageService private readonly storageService: IStorageService,
		@ILifecycleService private readonly lifecycleService: ILifecycleService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService
	) {
		this.rootElement = document.createElement('div');
		this.rootElement.className = 'olympia-onboarding';
		this.rootElement.style.zIndex = String(OLYMPIA_ONBOARDING_Z_INDEX);

		// 首帧兜底层。canvas 画出第一帧之后它淡出，之后极光画布是唯一的不透明层 ——
		// 擦出来的洞才能真正透出底下的工作台。
		const splashElement = document.createElement('div');
		splashElement.className = 'olympia-onboarding-splash';
		this.rootElement.appendChild(splashElement);

		this.backdrop = new OlympiaOnboardingBackdrop();
		this.rootElement.appendChild(this.backdrop.element);

		this.cards = instantiationService.createInstance(OlympiaOnboardingCards, {
			onNext: () => this.handleNext(),
			onBeginEnter: () => this.requestEnter(),
		});
		this.rootElement.appendChild(this.cards.element);

		// 效果层：星光粒子、光核、闪点、暗角、通电扫光。
		this.fxElement = document.createElement('div');
		this.fxElement.className = 'olympia-onboarding-fx';

		this.particleCanvas = document.createElement('canvas');
		this.particleCanvas.className = 'olympia-onboarding-particles';
		this.fxElement.appendChild(this.particleCanvas);
		this.particleContext = this.particleCanvas.getContext('2d')!;

		// 洞缘环：波前撕开极光时的那道亮边。
		//
		// 它**必须**是独立的 DOM 层，不能画回背景 canvas —— 背景 canvas 是
		// 「不透明极光」，往它上面补像素会破坏 `check-backdrop-continuity` 的
		// 洞 alpha 单调判据（C1）。独立 DOM 层不碰背景像素。
		this.rimElement = document.createElement('div');
		this.rimElement.className = 'olympia-onboarding-rim';
		this.fxElement.appendChild(this.rimElement);

		this.coreElement = document.createElement('div');
		this.coreElement.className = 'olympia-onboarding-core';
		this.fxElement.appendChild(this.coreElement);

		for (const [id] of OLYMPIA_ONBOARDING_SWEEP_PARTS) {
			const sweep = document.createElement('div');
			sweep.className = 'olympia-onboarding-sweep';
			if (id === OLYMPIA_ONBOARDING_ACCENT_SWEEP) {
				sweep.classList.add('accent');
			}
			this.fxElement.appendChild(sweep);
			this.sweepElements.set(id, sweep);
		}

		this.flashElement = document.createElement('div');
		this.flashElement.className = 'olympia-onboarding-flash';
		this.fxElement.appendChild(this.flashElement);

		this.vignetteElement = document.createElement('div');
		this.vignetteElement.className = 'olympia-onboarding-vignette';
		this.fxElement.appendChild(this.vignetteElement);

		this.rootElement.appendChild(this.fxElement);

		// 等工作台恢复时的提示条。
		this.waitingElement = document.createElement('div');
		this.waitingElement.className = 'olympia-onboarding-waiting';
		this.waitingElement.textContent = localize('olympia.onboarding.waiting', "正在准备工作台…");
		this.rootElement.appendChild(this.waitingElement);

		this.disposables.push(this.layoutService.onDidLayoutMainContainer(() => this.handleResize()));
		this.disposables.push(addDisposableListener(mainWindow, 'resize', () => this.handleResize()));

		// 极光跟着指针轻微偏移。
		this.disposables.push(addDisposableListener(this.rootElement, 'pointermove', (event: PointerEvent) => {
			const width = this.viewportWidth || 1;
			const height = this.viewportHeight || 1;
			this.backdrop.setPointer(event.clientX / width, event.clientY / height);
		}));

		this.mount();
		this.start();
	}

	//#region 生命周期

	private mount(): void {
		const container = this.layoutService.getContainer(mainWindow);
		container.appendChild(this.rootElement);
	}

	private start(): void {
		this.animationFrame = mainWindow.requestAnimationFrame(this.onFrame);
	}

	private readonly onFrame = (timestamp: number): void => {
		this.animationFrame = null;
		if (this.disposed) {
			return;
		}
		try {
			this.renderFrame(timestamp);
		} catch (error) {
			// 一帧算错不能把整条 rAF 链掐断 —— 断了整个引导就僵在最后一帧，
			// 而且再也醒不过来。
			onUnexpectedError(error);
		}
		if (!this.disposed) {
			this.animationFrame = mainWindow.requestAnimationFrame(this.onFrame);
		}
	};

	dispose(): void {
		this.disposed = true;
		if (this.animationFrame !== null) {
			mainWindow.cancelAnimationFrame(this.animationFrame);
			this.animationFrame = null;
		}
		if (this.fadeTimer !== null) {
			mainWindow.clearTimeout(this.fadeTimer);
			this.fadeTimer = null;
		}
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
		this.disposables.length = 0;
		this.cards.dispose();
		this.backdrop.dispose();
		this.rootElement.remove();
	}

	//#endregion

	//#region 每帧

	private renderFrame(timestamp: number): void {
		const delta = this.lastTimestamp === 0 ? 0 : Math.min(0.05, Math.max(0, (timestamp - this.lastTimestamp) / 1000));
		this.lastTimestamp = timestamp;
		// 背景自己的时钟**永不重置** —— 进入动画期间极光还在流动，这是「同一张图」的前提。
		this.backdropTime += delta;

		const width = this.rootElement.clientWidth || mainWindow.innerWidth;
		const height = this.rootElement.clientHeight || mainWindow.innerHeight;
		if (width !== this.viewportWidth || height !== this.viewportHeight) {
			this.viewportWidth = width;
			this.viewportHeight = height;
			this.backdrop.resize(width, height);
			this.resizeParticleCanvas(width, height);
			this.updateSweepRects();
			// 光缝 / 点火条的位置跟着真实视口走 —— CSS 里写死的 top:44% 只是兜底。
			this.layoutFx();
		}

		if (this.enterRequested && this.enterStart === null) {
			this.maybeStartEnter(timestamp);
		}

		// `elapsed` 为负表示还没进入 —— 时间线内部会 clamp 到 0，
		// 于是 reveal 是 undefined、卡片不消散、光核/闪点/暗角全是 0。
		const elapsed = this.enterStart === null ? -1 : (timestamp - this.enterStart) / 1000;
		const frame = olympiaOnboardingFrame(elapsed, width);

		this.backdrop.render(this.backdropTime, frame.reveal);
		this.cards.render(timestamp, frame.cardDissolve);
		this.renderParticles(frame.particleProgress);
		this.renderCore(frame.coreScale, frame.coreOpacity);
		this.renderRim(frame.reveal);
		this.flashElement.style.opacity = frame.flashOpacity.toFixed(3);
		this.vignetteElement.style.opacity = frame.vignetteOpacity.toFixed(3);
		this.renderSweeps(frame.sweeps);

		if (!this.painted) {
			// canvas 已经画出第一帧 → 兜底层可以淡出了。
			this.painted = true;
			this.rootElement.classList.add('olympia-onboarding-painted');
		}

		if (elapsed >= OLYMPIA_ONBOARDING_ENTER_DURATION) {
			this.finish();
		}
	}

	/**
	 * 收尾：把 overlay 整个删掉。
	 *
	 * 这一步必须是**不可见**的 —— 判定条件全部在时间线里对齐了：
	 * 洞在 2.25s 就擦净（reveal 进度 1 时全画布透明）、卡片在 0.60s 就化成星光、
	 * 光核在 2.12s 收掉、暗角在 2.25s 归零（与洞同步，工作台一露面就不再被压暗）、
	 * 最后一道扫光在 5.25s 结束。
	 * 5.40s 时屏幕上已经没有任何属于 overlay 的像素了。
	 */
	private finish(): void {
		this.dispose();
	}

	private resizeParticleCanvas(width: number, height: number): void {
		const ratio = Math.min(mainWindow.devicePixelRatio || 1, 2);
		this.particleCanvas.width = Math.max(1, Math.round(width * ratio));
		this.particleCanvas.height = Math.max(1, Math.round(height * ratio));
		this.particleContext.setTransform(ratio, 0, 0, ratio, 0, 0);
	}

	private handleResize(): void {
		this.viewportWidth = 0;
		this.viewportHeight = 0;
		this.updateSweepRects();
	}

	//#endregion

	//#region 进入动画的时序

	/** 卡片上的「下一步 / 开始做题」。最后一张卡 = 开始。 */
	private handleNext(): void {
		if (this.enterStart !== null || this.enterRequested) {
			return;
		}
		if (this.cards.activeCard >= OLYMPIA_ONBOARDING_CARD_COUNT - 1) {
			this.requestEnter();
		} else {
			this.cards.step(1);
		}
	}

	/** 用户表示「我配好了，开始吧」。 */
	private requestEnter(): void {
		if (this.enterStart !== null || this.enterRequested) {
			return;
		}
		this.enterRequested = true;
		this.enterRequestedAt = -1;
		// 注意：**这里不能**摘掉界面 chrome。
		// 摘了 chrome，用户就只剩一颗药丸 —— 「跳过」和翻页全都没了。
		// 万一闸门等了很久（工作台被扩展卡住），用户连退路都没有。
		// chrome 让位给星光，要等闸门真正放行的那一帧才发生（见 `maybeStartEnter`）。
	}

	/**
	 * 起跑前的最后一道闸：**工作台已恢复，且开始页已就位**。
	 *
	 * ## 为什么两个条件都要
	 *
	 * - `LifecyclePhase.Restored` 只保证「工作台骨架建好了」；
	 * - `olympiaWelcomeReady.isReady` 保证「开始页真的画出来了」。
	 *
	 * 只等前者的旧版本有个真实存在的洞：上游 `startupPage.ts` 打开开始页时
	 * **没有 await** `openEditor`，所以 `Restored` 先到、编辑器后到。
	 * 洞一擦开，底下是空编辑器区；几百毫秒后开始页才弹出来 —— 画面内容突变，
	 * 那一下就是断点。
	 *
	 * ## 等待期间不擦洞
	 *
	 * 等就等，**不能**因为等太久就提前擦洞 —— 擦出来的半成品工作台比继续等更糟。
	 * 只有硬上限到了才强制放行（宁可露一次半成品，也不能把用户永远卡在这里）。
	 */
	private maybeStartEnter(timestamp: number): void {
		if (this.enterRequestedAt < 0) {
			this.enterRequestedAt = timestamp;
		}
		const waited = (timestamp - this.enterRequestedAt) / 1000;
		const restored = this.lifecycleService.phase >= LifecyclePhase.Restored;
		const welcomeReady = olympiaWelcomeReady.isReady;

		if (olympiaWelcomeReady.isFailed) {
			// 开始页打不开 ——「擦洞露出开始页」这场演出做不了，洞里只能是空的。
			// 改走收场：整层极光淡出，露出（没有开始页的）真实工作台。
			// 那是一个正常的空工作台，而不是「洞里空着」。
			this.abortEnter();
			return;
		}

		if ((!restored || !welcomeReady) && waited < OlympiaOnboarding.ENTER_GATE_WAIT_LIMIT) {
			this.waitingElement.classList.add('on');
			return;
		}

		this.waitingElement.classList.remove('on');
		// 界面 chrome 让位给星光。卡片本身不能整体淡出 —— 它们要化成粒子。
		// 这一行**必须**在闸门放行之后：放行之前摘掉 chrome，用户就只剩一颗药丸，
		// 「跳过」和翻页全被关掉 —— 出了岔子连退路都没有。
		this.cards.element.classList.add('olympia-onboarding-entering');
		// 卡片区的 DOM **结构**从这一刻起冻结 ——
		// 扩展注册配置项触发的 refresh、以及「放弃写入」的收场路径，
		// 都会重建预览区（`replaceChildren`）。在动画中间换掉它，
		// 就是「全程没有断点」要防的那一帧硬切。
		this.cards.beginEnterAnimation();
		// 起点用 rAF 帧时间戳 —— 和卡片补间、背景时钟是同一个时间源。
		// 早先版本这里用 `performance.now()`，与 rAF 时间戳不同源，守卫永远不成立，动画挂死。
		this.enterStart = timestamp;
		this.enterRequested = false;
		this.captureParticleOrigins();
		this.updateSweepRects();
		this.storageService.store(OlympiaOnboarding.STORAGE_KEY, true, StorageScope.PROFILE, StorageTarget.MACHINE);
	}

	/**
	 * 收场：开始页打不开时的退路。
	 *
	 * 「擦洞露出开始页」这场演出做不了 —— 洞里只能是空的编辑器区。
	 * 那就整层极光淡出，露出（没有开始页的）真实工作台：
	 * 那是一个**正常的**空工作台（用户可以自己开文件），
	 * 而不是「洞里空着、像坏了」。
	 *
	 * 淡出而不是直接删：直接删是硬切（极光没了、工作台突然冒出来），
	 * 那也是断点。淡出是这层极光自己退场。
	 */
	private abortEnter(): void {
		this.enterRequested = false;
		// 这里**不**重置 `enterStart`：它此刻必然还是 `null`。
		// 闸门放行之前 `enterStart` 只在 `maybeStartEnter` 里被赋值，而那一处
		// 紧接着就把 `enterRequested` 置回 false —— 帧循环里
		// `if (this.enterRequested && this.enterStart === null)` 的第二个条件
		// 就不再成立，`maybeStartEnter` 不会再被调用。
		// 换句话说，走到这里的路径上**从来没有**正在跑的进入动画要取消：
		// 收场只可能发生在「还没起跑」的时候。
		this.waitingElement.classList.remove('on');
		this.rootElement.classList.add('olympia-onboarding-fading');
		this.fadeTimer = mainWindow.setTimeout(() => {
			this.fadeTimer = null;
			this.finish();
		}, OlympiaOnboarding.ABORT_FADE_MS);
	}

	//#endregion

	//#region 星光粒子

	/**
	 * 记下每张卡此刻的视觉中心 —— 那是粒子起飞的位置。
	 *
	 * 只读一次布局（4 次 `getBoundingClientRect()`），不要每帧读。
	 */
	private captureParticleOrigins(): void {
		const canvasRect = this.particleCanvas.getBoundingClientRect();
		const rects = this.cards.getCardRects();
		this.particleOrigins = [];
		for (let index = 0; index < OLYMPIA_ONBOARDING_CARD_COUNT; index++) {
			const rect = rects[index];
			if (!rect) {
				this.particleOrigins.push({ x: this.viewportWidth / 2, y: this.viewportHeight / 2 });
				continue;
			}
			this.particleOrigins.push({
				x: rect.left + rect.width / 2 - canvasRect.left,
				y: rect.top + rect.height / 2 - canvasRect.top,
			});
		}
	}

	/**
	 * 画星光粒子。
	 *
	 * ## 这一段曾经是最廉价的地方
	 *
	 * 老实现是：粒子从卡片中心**沿直线**飞向画面中心，颜色一律冷白，
	 * 一个圆点，飞到哪儿算哪儿。结果读作「一圈小圆点在飞」。
	 *
	 * 现在改成四件事：
	 *
	 * 1. **持续加速的吸入**（`local^1.7`）—— 起飞慢、收尾快，像被引力掰过去，
	 *    而不是匀速平移。
	 * 2. **法向弓形弧线** —— 起末落回直线上，中途鼓出去。现实里没有任何东西在真空中
	 *    走绝对直线；直线是廉价感的最大单点。
	 * 3. **有方向的光斑 + 两段拖尾** —— 光是有朝向的，不是无头苍蝇。
	 * 4. **汇聚目标是光缝**，不是画面中心 —— 粒子被吸进一道**可见的**缝里，
	 *    才有「能量被收进某处」的意思。
	 *
	 * 景深（`depth`）统一决定尺寸、亮度、拖尾长度 —— 四个属性各给一份随机数的话，
	 * 就会出现「又大又暗」「又小又亮」这种互相打架的组合，一眼就不是真实的空间。
	 */
	private renderParticles(progress: number): void {
		const ctx = this.particleContext;
		ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
		if (progress <= 0 || this.particleOrigins.length === 0) {
			return;
		}

		const seconds = progress * OLYMPIA_ONBOARDING_PARTICLE_WINDOW;
		const centerX = this.viewportWidth / 2;
		const seamY = this.seamY >= 0 ? this.seamY : this.viewportHeight * OLYMPIA_ONBOARDING_SEAM_Y;

		// 加色混合：粒子之间叠在一起会自然变亮，像真的光。
		ctx.globalCompositeOperation = 'lighter';

		for (const particle of OLYMPIA_ONBOARDING_PARTICLES) {
			const local = (seconds - particle.delay) / particle.duration;
			if (local <= 0 || local >= 1) {
				continue;
			}
			const origin = this.particleOrigins[particle.card];
			if (!origin) {
				continue;
			}

			const startX = origin.x + Math.cos(particle.angle) * particle.radius;
			const startY = origin.y + Math.sin(particle.angle) * particle.radius;

			// 汇聚目标：光缝上的一段。粒子各自带一个横纵偏移，于是汇聚成的是
			// 「一条缝」，而不是一个点 —— 点只会读成聚拢，缝才读成能量被收进某处。
			// 少数向外飘的粒子（12%）不参与汇聚，它们是画面噪音的残留。
			const targetX = particle.inward
				? centerX + particle.seamX
				: startX + Math.cos(particle.angle) * 260;
			const targetY = particle.inward
				? seamY + particle.seamY
				: startY + Math.sin(particle.angle) * 260;

			// 持续加速：慢起飞、快收尾。
			const pull = Math.pow(local, 1.7);
			const dx = targetX - startX;
			const dy = targetY - startY;
			let x = startX + dx * pull;
			let y = startY + dy * pull;

			// 法向弓形：沿路径法线鼓出去，起末归零。
			const dist = Math.hypot(dx, dy) || 1;
			const nx = -dy / dist;
			const ny = dx / dist;
			const bow = Math.sin(local * Math.PI) * particle.swirl * Math.min(96, dist * 0.24);
			x += nx * bow;
			y += ny * bow;

			// 速度方向：拉长光斑 + 定位拖尾都要用它。
			const accel = 1.7 * Math.pow(local, 0.7);
			const bowRate = bow * Math.PI * Math.cos(local * Math.PI);
			const vx = dx * accel + nx * bowRate;
			const vy = dy * accel + ny * bowRate;
			const speed = Math.hypot(vx, vy);
			const ux = speed > 1e-4 ? vx / speed : 0;
			const uy = speed > 1e-4 ? vy / speed : 0;
			const heading = Math.atan2(uy, ux);

			// 景深：尺寸 / 亮度 / 拖尾长度共用一个数。
			const depth = particle.depth;
			const size = particle.size * (0.5 + depth * 0.9);
			// 前 18% 淡入（不是「一亮到底」），末段阻尼衰减（被光缝吸进去）。
			const alpha = Math.min(1, local / 0.18) * Math.pow(1 - local, 1.2) * (0.34 + depth * 0.66);

			// 暖白金是主体，冷白是配角。全部冷白 = 没有焦点。
			const halo = particle.warm ? '255,206,140' : '138,178,255';
			const core = particle.warm ? '255,247,231' : '216,233,255';

			// 两段递减的短影：光有方向，所以有拖尾。
			const trail = (7 + depth * 18) * (0.35 + local * 0.9);
			for (let seg = 1; seg <= 2; seg++) {
				const back = seg / 3;
				ctx.globalAlpha = alpha * (seg === 1 ? 0.32 : 0.15);
				ctx.fillStyle = `rgb(${halo})`;
				ctx.beginPath();
				ctx.ellipse(x - ux * trail * back, y - uy * trail * back, size * (1.05 - back * 0.3), size * 0.5, heading, 0, Math.PI * 2);
				ctx.fill();
			}

			// 主体：沿速度方向拉长的光斑 + 里面那颗更亮的核心。
			ctx.globalAlpha = alpha * 0.28;
			ctx.fillStyle = `rgb(${halo})`;
			ctx.beginPath();
			ctx.ellipse(x, y, size * 2.9, size * 1.1, heading, 0, Math.PI * 2);
			ctx.fill();

			ctx.globalAlpha = alpha;
			ctx.fillStyle = `rgb(${core})`;
			ctx.beginPath();
			ctx.ellipse(x, y, size * 1.5, size * 0.6, heading, 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = 'source-over';
	}

	//#endregion

	//#region 工作台通电扫光

	/**
	 * 记下每个部件的真实矩形。
	 *
	 * 扫光要沿着工作台的真实部件走，而不是按视口猜一个位置 —— 否则「通电」的
	 * 感觉对不上画面里的实际布局（标题栏在哪、侧栏多宽都是布局决定的）。
	 *
	 * ## 取不到矩形时必须兜底，不能跳过
	 *
	 * 有些部件在这个窗口形状下压根不存在（底部面板默认收起、侧栏被折叠、
	 * 用户把状态栏关掉了……）。早先的实现是 `continue` 跳过 —— 结果那道扫光
	 * 永远不会亮，时间线上就留下一段「什么都没发生」的死区：整段通电演出
	 * 凭空少一拍，观众一眼就看出那里缺了东西。
	 *
	 * 所以取不到真实矩形时退回到整块工作台：光带从屏幕这头扫到那头，
	 * 语义上仍然是「工作台通电」，而且不依赖任何具体布局。
	 */
	private updateSweepRects(): void {
		const rects = new Map<OlympiaOnboardingSweepTarget, DOMRect>();
		const viewport = this.rootElement.getBoundingClientRect();
		for (const [id, part] of OLYMPIA_ONBOARDING_SWEEP_PARTS) {
			let rect: DOMRect | undefined;
			try {
				const element = this.layoutService.getContainer(mainWindow, part);
				if (element) {
					const candidate = element.getBoundingClientRect();
					if (candidate.width > 0 && candidate.height > 0) {
						rect = candidate;
					}
				}
			} catch {
				// 部件还没就绪（或者这个窗口形状下压根没有这个部件）—— 走下面的兜底。
			}
			if (!rect) {
				if (viewport.width <= 0 || viewport.height <= 0) {
					// 连整块工作台都还没有尺寸（overlay 刚挂上去）：这一帧先不给矩形。
					continue;
				}
				rect = viewport;
			}
			rects.set(id, rect);
		}
		this.sweepRects = rects;
	}

	private renderSweeps(sweeps: readonly OlympiaOnboardingSweepState[]): void {
		for (const state of sweeps) {
			const element = this.sweepElements.get(state.id);
			if (!element) {
				continue;
			}
			const rect = this.sweepRects.get(state.id);
			if (!rect || state.opacity <= 0) {
				element.style.opacity = '0';
				continue;
			}

			// 方向**照时间线走**（axis 字段）。之前这里写死成「只有 titlebar 是横向」，
			// 时间线上的 axis 改了也不会生效 —— 那个字段等于没有。
			const horizontal = state.axis === 'x';
			const band = OLYMPIA_ONBOARDING_SWEEP_BAND;
			if (horizontal) {
				element.classList.add('horizontal');
				element.style.left = `${rect.left}px`;
				element.style.top = `${rect.top}px`;
				element.style.width = `${band}px`;
				element.style.height = `${rect.height}px`;
				element.style.transform = `translate3d(${olympiaOnboardingSweepTravel(state.offset, rect.width, band).toFixed(2)}px, 0, 0)`;
			} else {
				element.classList.remove('horizontal');
				element.style.left = `${rect.left}px`;
				element.style.top = `${rect.top}px`;
				element.style.width = `${rect.width}px`;
				element.style.height = `${band}px`;
				element.style.transform = `translate3d(0, ${olympiaOnboardingSweepTravel(state.offset, rect.height, band).toFixed(2)}px, 0)`;
			}
			element.style.opacity = state.opacity.toFixed(3);
		}
	}

	private renderCore(scale: number, opacity: number): void {
		this.coreElement.style.transform = `scale(${scale.toFixed(4)})`;
		this.coreElement.style.opacity = opacity.toFixed(3);
	}

	/**
	 * 把光缝和点火条放到真实视口里的那条线上。
	 *
	 * 三者必须落在**同一像素**上：粒子汇聚目标、光缝本体、点火条。
	 * 差几像素的话，粒子会飞向一条看不见的线 —— 观感上就是「粒子吸到一半断了」。
	 *
	 * CSS 里写死的 `top: 44%` 只是首帧兜底（视口还没量到时），量到之后一律以这里为准。
	 */
	private layoutFx(): void {
		const seamY = Math.round((this.viewportHeight || 0) * OLYMPIA_ONBOARDING_SEAM_Y);
		if (seamY === this.seamY) {
			return;
		}
		this.seamY = seamY;
		this.coreElement.style.top = `${seamY}px`;
		this.flashElement.style.top = `${seamY}px`;
	}

	/**
	 * 洞缘环：波前撕开极光时的那道亮边。
	 *
	 * ## 为什么必须是独立 DOM 层
	 *
	 * 洞是在背景 canvas 上用 `destination-out` 擦出来的 —— 那里 alpha 从 1 渐变到 0，
	 * 边缘是一段**软边**。软边读作「橡皮擦蹭过去」，不读作「撕开」。
	 *
	 * 要让边缘读作「撕开」，需要一道**硬的、有方向的亮边**。但如果把这道亮边画回
	 * 背景 canvas，就会往洞的 alpha 上补像素 —— 破坏 `check-backdrop-continuity` 的
	 * 洞 alpha 单调判据（C1）。所以它只能是独立 DOM 层：不碰背景像素。
	 *
	 * 几何必须和洞完全一致：洞在画布里是 `scale(1, H/W)` 后的椭圆，
	 * 所以环也是同样的椭圆（x 半径 = radius，y 半径 = radius × H/W）。
	 */
	private renderRim(reveal: OlympiaOnboardingRevealGeometry | undefined): void {
		if (!reveal) {
			this.rimElement.style.opacity = '0';
			return;
		}
		const width = this.viewportWidth || 1;
		const height = this.viewportHeight || 1;
		const radius = reveal.radius;
		const ry = radius * (height / width);

		this.rimElement.style.left = `${((width - radius * 2) / 2).toFixed(1)}px`;
		this.rimElement.style.top = `${((height - ry * 2) / 2).toFixed(1)}px`;
		this.rimElement.style.width = `${(radius * 2).toFixed(1)}px`;
		this.rimElement.style.height = `${(ry * 2).toFixed(1)}px`;

		// 环只在波前扫过时最亮；progress 走到 1 时**精确**归零 ——
		// 那时洞已经擦净，工作台必须一点遮挡都不剩。
		const fadeIn = olympiaOnboardingClamp(reveal.progress / 0.28, 0, 1);
		const fadeOut = olympiaOnboardingClamp((1 - reveal.progress) / 0.35, 0, 1);
		this.rimElement.style.opacity = (fadeIn * fadeOut * 0.9).toFixed(3);
	}

	//#endregion
}
