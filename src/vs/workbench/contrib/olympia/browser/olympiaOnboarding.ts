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
import {
	OLYMPIA_ONBOARDING_CARD_COUNT,
	OLYMPIA_ONBOARDING_ENTER_DURATION,
	OLYMPIA_ONBOARDING_PARTICLES,
	OLYMPIA_ONBOARDING_PARTICLE_WINDOW,
	olympiaOnboardingEaseOutCubic,
	olympiaOnboardingFrame,
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

/** 扫光带宽（px）。 */
const OLYMPIA_ONBOARDING_SWEEP_BAND = 140;

/** 每个部件对应的工作台 part。 */
const OLYMPIA_ONBOARDING_SWEEP_PARTS: readonly [OlympiaOnboardingSweepTarget, Parts][] = [
	['titlebar', Parts.TITLEBAR_PART],
	['activitybar', Parts.ACTIVITYBAR_PART],
	['editor', Parts.EDITOR_PART],
	['sidebar', Parts.SIDEBAR_PART],
	['panel', Parts.PANEL_PART],
];

export class OlympiaOnboarding implements IDisposable {

	/**
	 * 首启一次性标记。
	 *
	 * 用 PROFILE + MACHINE：跟着用户走，但**不参与设置同步** —— 引导是本机的一次性体验，
	 * 同步到别的机器上会让那边也弹一次，没道理。
	 */
	static readonly STORAGE_KEY = 'olympia.onboarding.completed.v1';

	/** 等工作台恢复的最长等待（秒）。超时后照常开始 —— 工作台会自己把剩下的补齐。 */
	private static readonly RESTORE_WAIT_LIMIT = 2.0;

	private readonly rootElement: HTMLElement;
	private readonly waitingElement: HTMLElement;
	private readonly fxElement: HTMLElement;
	private readonly particleCanvas: HTMLCanvasElement;
	private readonly particleContext: CanvasRenderingContext2D;
	private readonly coreElement: HTMLElement;
	private readonly flashElement: HTMLElement;
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
	private enterRequestedAt = 0;

	private viewportWidth = 0;
	private viewportHeight = 0;
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

		this.coreElement = document.createElement('div');
		this.coreElement.className = 'olympia-onboarding-core';
		this.fxElement.appendChild(this.coreElement);

		for (const [id] of OLYMPIA_ONBOARDING_SWEEP_PARTS) {
			const sweep = document.createElement('div');
			sweep.className = 'olympia-onboarding-sweep';
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
		const delta = this.lastTimestamp === 0 ? 0 : Math.min(0.05, (timestamp - this.lastTimestamp) / 1000);
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
	 * 光核在 2.12s 收掉、扫光在 4.59s 结束、暗角在 5.30s 归零。
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
		this.enterRequestedAt = 0;
		// 界面 chrome 让位给星光。卡片本身不能整体淡出 —— 它们要化成粒子。
		this.cards.element.classList.add('olympia-onboarding-entering');
	}

	/**
	 * 起跑前的最后一道闸：工作台必须已经恢复。
	 *
	 * 如果在 `Restored` 之前就擦洞，露出来的是半成品工作台（编辑器区可能还在转圈、
	 * 侧栏还没建好）—— 那本身就是一次断点。所以这里等。
	 *
	 * 等也有上限：超过 2 秒就照常开始，因为再等下去用户会以为点不动了，
	 * 而且工作台剩下的加载是它自己的事，不是我们的断点。
	 */
	private maybeStartEnter(timestamp: number): void {
		if (this.enterRequestedAt === 0) {
			this.enterRequestedAt = timestamp;
		}
		const restored = this.lifecycleService.phase >= LifecyclePhase.Restored;
		const waited = (timestamp - this.enterRequestedAt) / 1000;
		if (!restored && waited < OlympiaOnboarding.RESTORE_WAIT_LIMIT) {
			this.waitingElement.classList.add('on');
			return;
		}

		this.waitingElement.classList.remove('on');
		// 起点用 rAF 帧时间戳 —— 和卡片补间、背景时钟是同一个时间源。
		// 早先版本这里用 `performance.now()`，与 rAF 时间戳不同源，守卫永远不成立，动画挂死。
		this.enterStart = timestamp;
		this.enterRequested = false;
		this.captureParticleOrigins();
		this.updateSweepRects();
		this.storageService.store(OlympiaOnboarding.STORAGE_KEY, true, StorageScope.PROFILE, StorageTarget.MACHINE);
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

	private renderParticles(progress: number): void {
		const ctx = this.particleContext;
		ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
		if (progress <= 0 || this.particleOrigins.length === 0) {
			return;
		}

		const seconds = progress * OLYMPIA_ONBOARDING_PARTICLE_WINDOW;
		const centerX = this.viewportWidth / 2;
		const centerY = this.viewportHeight / 2;

		for (const particle of OLYMPIA_ONBOARDING_PARTICLES) {
			const local = (seconds - particle.delay) / particle.duration;
			if (local <= 0 || local >= 1) {
				continue;
			}
			const origin = this.particleOrigins[particle.card];
			if (!origin) {
				continue;
			}

			const eased = olympiaOnboardingEaseOutCubic(local);
			const startX = origin.x + Math.cos(particle.angle) * particle.radius;
			const startY = origin.y + Math.sin(particle.angle) * particle.radius;

			let x: number;
			let y: number;
			if (particle.inward) {
				x = startX + (centerX - startX) * eased;
				y = startY + (centerY - startY) * eased;
			} else {
				x = startX + Math.cos(particle.angle) * eased * 240;
				y = startY + Math.sin(particle.angle) * eased * 240;
			}

			// 末段飘散：让轨迹不是一条死板的直线。
			const wobble = (1 - local) * 9;
			x += Math.cos(particle.wobble + local * 12.566) * wobble;
			y += Math.sin(particle.wobble + local * 12.566) * wobble;

			const alpha = Math.sin(local * Math.PI) * 0.95;
			// 辉光用两层圆叠出来，**不用 shadowBlur** —— 全分辨率 shadowBlur 是帧率杀手
			// （headless 软件渲染下实测能掉到 11fps）。
			ctx.globalAlpha = alpha * 0.28;
			ctx.fillStyle = 'rgb(142,186,255)';
			ctx.beginPath();
			ctx.arc(x, y, particle.size * 3.2, 0, Math.PI * 2);
			ctx.fill();

			ctx.globalAlpha = alpha;
			ctx.fillStyle = 'rgb(228,241,255)';
			ctx.beginPath();
			ctx.arc(x, y, particle.size, 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.globalAlpha = 1;
	}

	//#endregion

	//#region 工作台通电扫光

	/**
	 * 记下每个部件的真实矩形。
	 *
	 * 扫光要沿着工作台的真实部件走，而不是按视口猜一个位置 —— 否则「通电」的
	 * 感觉对不上画面里的实际布局（标题栏在哪、侧栏多宽都是布局决定的）。
	 */
	private updateSweepRects(): void {
		const rects = new Map<OlympiaOnboardingSweepTarget, DOMRect>();
		for (const [id, part] of OLYMPIA_ONBOARDING_SWEEP_PARTS) {
			try {
				const element = this.layoutService.getContainer(mainWindow, part);
				if (!element) {
					continue;
				}
				const rect = element.getBoundingClientRect();
				if (rect.width <= 0 || rect.height <= 0) {
					continue;
				}
				rects.set(id, rect);
			} catch {
				// 部件还没就绪（或者这个窗口形状下压根没有这个部件）—— 跳过即可。
			}
		}
		this.sweepRects = rects;
	}

	private renderSweeps(sweeps: readonly { id: OlympiaOnboardingSweepTarget; opacity: number; offset: number }[]): void {
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

			// axis 来自时间线；这里只用它决定光带的方向和推进轴。
			const horizontal = state.id === 'titlebar';
			const band = OLYMPIA_ONBOARDING_SWEEP_BAND;
			if (horizontal) {
				element.classList.add('horizontal');
				element.style.left = `${rect.left}px`;
				element.style.top = `${rect.top}px`;
				element.style.width = `${band}px`;
				element.style.height = `${rect.height}px`;
				const span = rect.width + band;
				element.style.transform = `translate3d(${(state.offset * span + rect.width / 2 - band / 2).toFixed(2)}px, 0, 0)`;
			} else {
				element.classList.remove('horizontal');
				element.style.left = `${rect.left}px`;
				element.style.top = `${rect.top}px`;
				element.style.width = `${rect.width}px`;
				element.style.height = `${band}px`;
				const span = rect.height + band;
				element.style.transform = `translate3d(0, ${(state.offset * span + rect.height / 2 - band / 2).toFixed(2)}px, 0)`;
			}
			element.style.opacity = state.opacity.toFixed(3);
		}
	}

	private renderCore(scale: number, opacity: number): void {
		this.coreElement.style.transform = `scale(${scale.toFixed(4)})`;
		this.coreElement.style.opacity = opacity.toFixed(3);
	}

	//#endregion
}
