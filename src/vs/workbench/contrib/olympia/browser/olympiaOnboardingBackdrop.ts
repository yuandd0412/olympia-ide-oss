/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mainWindow } from '../../../../base/browser/window.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { OlympiaOnboardingRevealGeometry } from './olympiaOnboardingTimeline.js';

/**
 * 开始引导的动态背景：一层**不透明**的夜空 + 极光缎带。
 *
 * ## 它必须不透明
 *
 * 底下是真实的工作台。如果这层是半透明的，用户会同时看到极光和工作台 —— 那不叫
 * 「动态背景」，那叫「壁纸贴在 IDE 上面」。而且进入动画靠在这层上擦一个洞来露出工作台，
 * 洞要能「擦干净」，这层就必须是完全不透明的。
 *
 * ## 它绝不能被重置
 *
 * 极光的时钟从 overlay 挂载那一刻起一直走，到进入动画结束都不停。曾经的实现是
 * 「切换阶段时重建背景」，结果每次切换极光的相位都会跳一下 —— 那就是断点。
 *
 * ## 弱机优先
 *
 * 极光的辉光画在**半分辨率**离屏画布上（`ctx.filter = 'blur(24px)'`），全分辨率只补
 * 一条细核心线。全分辨率 `shadowBlur` 是软件渲染下最常见的掉帧元凶：同样的画面，
 * headless 软渲染只有 11fps，改成半分辨率后到 27fps 以上。
 */

interface IOlympiaOnboardingRibbon {
	/** 缎带的基准高度（占画布高度的比例）。 */
	readonly y: number;
	/** 振幅。 */
	readonly amp: number;
	/** 横向频率。 */
	readonly freq: number;
	/** 纵向速度。 */
	readonly speed: number;
	/** 线宽。 */
	readonly width: number;
	/** RGB 分量。 */
	readonly color: string;
	/** 能量聚集段的 RGB 分量（比 color 更亮更冷）。 */
	readonly hot: string;
	/** 不透明度。 */
	readonly alpha: number;
}

interface IOlympiaOnboardingStar {
	readonly x: number;
	readonly y: number;
	readonly size: number;
	readonly phase: number;
	readonly speed: number;
	/** 亮度档位。 */
	readonly density: number;
}

interface IOlympiaOnboardingDust {
	readonly x: number;
	readonly y: number;
	readonly size: number;
	readonly speed: number;
	readonly phase: number;
	readonly alpha: number;
}

/**
 * 三条极光缎带。
 *
 * ## 层次靠「宽度 + 色温」，不靠「压 alpha」
 *
 * 三条同宽同亮的带子读作一张贴图；三条一样亮、只靠 alpha 分层的带子读作一层雾。
 * 真正拉开距离的是**宽窄**：一条又宽又柔的底带 + 一条中带 + 一条极细的亮丝，
 * 眼睛立刻读出「远—中—近」。所以 alpha 保持不动（压它会连带压掉背景的流动量，
 * 而背景门禁盯的就是那个量），层次全部交给宽度和色温。
 *
 * ## 为什么去紫
 *
 * 紫 + 蓝 + 青三条同强度的带子，是最典型的「随机取色」观感 —— 像调色盘，不像
 * 一片有光源的天空。改成**蓝 → 蓝青 → 青**的单向渐变之后，整片天空只有一个色相
 * 家族在走，读起来才像同一束光在不同高度散出来的。
 */
const RIBBONS: readonly IOlympiaOnboardingRibbon[] = [
	{ y: 0.30, amp: 0.085, freq: 1.55, speed: 0.115, width: 104, color: '84,124,236', hot: '150,190,255', alpha: 0.20 },
	{ y: 0.54, amp: 0.110, freq: 1.05, speed: -0.085, width: 72, color: '92,150,216', hot: '162,206,255', alpha: 0.17 },
	{ y: 0.74, amp: 0.070, freq: 2.10, speed: 0.150, width: 44, color: '72,178,206', hot: '152,226,240', alpha: 0.15 }
];

function hash1(index: number): number {
	const s = Math.sin(index * 127.1 + 311.7) * 43758.5453;
	return s - Math.floor(s);
}

function hash2(index: number): number {
	const s = Math.sin(index * 269.5 + 183.3) * 24634.6345;
	return s - Math.floor(s);
}

const STARS: readonly IOlympiaOnboardingStar[] = Array.from({ length: 150 }, (_, i) => ({
	x: hash1(i),
	y: hash2(i * 1.3),
	size: 0.4 + hash1(i * 2.2) * 1.6,
	phase: hash2(i * 3.7) * Math.PI * 2,
	speed: 0.25 + hash2(i * 4.1) * 0.7,
	density: hash1(i * 5.3)
}));

const DUST: readonly IOlympiaOnboardingDust[] = Array.from({ length: 90 }, (_, i) => ({
	x: hash1(i * 1.9),
	y: hash2(i * 2.7),
	size: 0.6 + hash1(i * 3.3) * 1.9,
	speed: 0.006 + hash2(i * 4.9) * 0.022,
	phase: hash1(i * 6.1) * Math.PI * 2,
	alpha: 0.10 + hash2(i * 7.7) * 0.30
}));

/**
 * 夜空底色的三个色标。CSS 侧的启动兜底层用的是同一组值。
 *
 * ## 为什么比之前更暗更中性
 *
 * 之前是 `#080b16 / #0a0e1d / #05070e` —— 蓝味很重，整片天空自带一层「滤镜」。
 * 现在压到 `#080b12 / #0a0e16 / #05070c`：几乎只剩明度差，没有色相在抢戏。
 * 天空的任务是**当背景**，不是当主角；主角是极光、洞缘和最后的工作台。
 */
export const OLYMPIA_ONBOARDING_SKY_COLORS = {
	top: '#080b12',
	middle: '#0a0e16',
	bottom: '#05070c'
} as const;

export class OlympiaOnboardingBackdrop implements IDisposable {

	readonly element: HTMLElement;

	private readonly canvas: HTMLCanvasElement;
	private readonly context: CanvasRenderingContext2D;
	/** 半分辨率离屏画布，只用来画辉光。 */
	private readonly glowCanvas: HTMLCanvasElement;
	private readonly glowContext: CanvasRenderingContext2D;

	private width = 0;
	private height = 0;
	private devicePixelRatio = 1;

	/** 指针位置（0..1），极光会跟着轻微偏移。 */
	private pointerX = 0.5;
	private pointerY = 0.5;

	constructor() {
		this.element = document.createElement('div');
		this.element.className = 'olympia-onboarding-backdrop';

		this.canvas = document.createElement('canvas');
		this.canvas.className = 'olympia-onboarding-canvas';
		this.element.appendChild(this.canvas);

		this.glowCanvas = document.createElement('canvas');
		this.glowContext = this.glowCanvas.getContext('2d')!;
		this.context = this.canvas.getContext('2d')!;
	}

	setPointer(normalizedX: number, normalizedY: number): void {
		this.pointerX = normalizedX;
		this.pointerY = normalizedY;
	}

	resize(width: number, height: number): void {
		if (width <= 0 || height <= 0 || (width === this.width && height === this.height)) {
			return;
		}
		this.width = width;
		this.height = height;
		this.devicePixelRatio = Math.min(mainWindow.devicePixelRatio || 1, 2);

		this.canvas.width = Math.round(width * this.devicePixelRatio);
		this.canvas.height = Math.round(height * this.devicePixelRatio);
		this.glowCanvas.width = Math.max(1, Math.round(width / 2));
		this.glowCanvas.height = Math.max(1, Math.round(height / 2));
	}

	/**
	 * 画一帧。
	 *
	 * @param time 背景自己的单调时钟（秒）。**不**会因为进入动画而重置。
	 * @param reveal 要擦开的洞；`undefined` 表示还在配置阶段，不擦。
	 */
	render(time: number, reveal: OlympiaOnboardingRevealGeometry | undefined): void {
		if (this.width <= 0 || this.height <= 0) {
			return;
		}
		const ctx = this.context;
		const width = this.width;
		const height = this.height;

		ctx.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, 0, 0);
		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = 1;

		// 底色永远不透明 —— 保证任何一帧都不是黑屏。
		const sky = ctx.createLinearGradient(0, 0, width * 0.25, height);
		sky.addColorStop(0, OLYMPIA_ONBOARDING_SKY_COLORS.top);
		sky.addColorStop(0.52, OLYMPIA_ONBOARDING_SKY_COLORS.middle);
		sky.addColorStop(1, OLYMPIA_ONBOARDING_SKY_COLORS.bottom);
		ctx.fillStyle = sky;
		ctx.fillRect(0, 0, width, height);

		// 底部地面辉光。
		ctx.globalCompositeOperation = 'lighter';
		const ground = ctx.createRadialGradient(width * 0.5, height * 1.02, 0, width * 0.5, height * 1.02, height * 0.78);
		ground.addColorStop(0, 'rgba(56,94,188,0.10)');
		ground.addColorStop(1, 'rgba(56,94,188,0)');
		ctx.fillStyle = ground;
		ctx.fillRect(0, 0, width, height);

		// 星。
		for (const star of STARS) {
			const twinkle = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time * star.speed + star.phase));
			// 极少数是暖白的「亮星」，其余是冷白且很暗的底噪 ——
			// 星星是背景，不是主角；主角是极光、洞缘和最后的工作台。
			const bright = star.density < 0.08;
			ctx.fillStyle = bright
				? `rgba(255,244,224,${(0.60 * twinkle).toFixed(3)})`
				: `rgba(198,214,246,${(0.14 * twinkle).toFixed(3)})`;
			ctx.beginPath();
			ctx.arc(star.x * width, star.y * height, star.size * (bright ? 1.6 : 1), 0, 6.2832);
			ctx.fill();
		}

		// 极光缎带：辉光在半分辨率离屏画布上做，全分辨率只补一条细核心线。
		const pointerShiftX = (this.pointerX - 0.5) * 26;
		const pointerShiftY = (this.pointerY - 0.5) * 14;
		const glowWidth = this.glowCanvas.width;
		const glowHeight = this.glowCanvas.height;
		const glow = this.glowContext;

		glow.setTransform(1, 0, 0, 1, 0, 0);
		glow.clearRect(0, 0, glowWidth, glowHeight);
		glow.globalCompositeOperation = 'lighter';
		for (const ribbon of RIBBONS) {
			glow.save();
			glow.filter = 'blur(24px)';
			glow.strokeStyle = `rgba(${ribbon.color},${ribbon.alpha * 2.2})`;
			glow.lineWidth = ribbon.width * 1.5;
			glow.lineCap = 'round';
			this.strokeRibbon(glow, ribbon, time + pointerShiftX * 0.004, glowWidth, glowHeight, pointerShiftY * 0.25);
			glow.restore();
		}
		glow.filter = 'none';

		ctx.globalCompositeOperation = 'lighter';
		ctx.drawImage(this.glowCanvas, 0, 0, width, height);
		for (const ribbon of RIBBONS) {
			// 底层：整条冷白细线，很淡。
			ctx.strokeStyle = `rgba(${ribbon.color},${(ribbon.alpha * 0.60).toFixed(3)})`;
			ctx.lineWidth = 2;
			ctx.lineCap = 'round';
			this.strokeRibbon(ctx, ribbon, time + pointerShiftX * 0.004, width, height, pointerShiftY * 0.5);
			ctx.stroke();
			// 中段：能量聚集的那一段更亮更实。缎带于是有「亮头暗尾」的走向，
			// 而不是一条从头到尾一样亮的光带。
			ctx.strokeStyle = `rgba(${ribbon.hot},${(ribbon.alpha * 1.15).toFixed(3)})`;
			ctx.lineWidth = 2.6;
			this.strokeRibbon(ctx, ribbon, time + pointerShiftX * 0.004, width, height, pointerShiftY * 0.5, 0.28, 0.72);
			ctx.stroke();
		}

		// 浮尘。
		for (const dust of DUST) {
			const y = ((dust.y - time * dust.speed) % 1 + 1) % 1;
			const x = dust.x * width + Math.sin(time * 0.28 + dust.phase) * 22;
			ctx.fillStyle = `rgba(204,214,236,${(dust.alpha * 0.38).toFixed(3)})`;
			ctx.beginPath();
			ctx.arc(x, y * height, dust.size, 0, 6.2832);
			ctx.fill();
		}

		// 揭示：在背景上擦开一个椭圆洞，底下的真实工作台自然透出来。
		if (reveal) {
			ctx.save();
			ctx.globalCompositeOperation = 'destination-out';
			ctx.globalAlpha = 1;
			ctx.translate(width / 2, height / 2);
			ctx.scale(1, height / width);
			const hole = ctx.createRadialGradient(0, 0, 0, 0, 0, reveal.radius);
			hole.addColorStop(0, 'rgba(0,0,0,1)');
			hole.addColorStop(reveal.inner / reveal.radius, 'rgba(0,0,0,1)');
			hole.addColorStop(1, 'rgba(0,0,0,0)');
			ctx.fillStyle = hole;
			ctx.beginPath();
			ctx.arc(0, 0, reveal.radius, 0, 6.2832);
			ctx.fill();
			ctx.restore();
		}
	}

	/**
	 * 画一条缎带。`uStart`/`uEnd` 是沿缎带长度方向的区间（0=左端，1=右端）——
	 * 用来只画「能量聚集段」，而不是整条一条亮度。
	 */
	private strokeRibbon(ctx: CanvasRenderingContext2D, ribbon: IOlympiaOnboardingRibbon, time: number, width: number, height: number, offset: number, uStart = 0, uEnd = 1): void {
		const steps = 84;
		const from = Math.max(0, Math.min(1, uStart));
		const to = Math.max(0, Math.min(1, uEnd));
		ctx.beginPath();
		for (let i = 0; i <= steps; i++) {
			const u = from + (to - from) * (i / steps);
			const x = u * width;
			const y = height * ribbon.y
				+ Math.sin(u * ribbon.freq * Math.PI * 2 + time * ribbon.speed * Math.PI * 2) * height * ribbon.amp
				+ Math.sin(u * ribbon.freq * 2.3 * Math.PI * 2 - time * ribbon.speed * Math.PI * 1.7) * height * ribbon.amp * 0.34
				+ offset;
			if (i === 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}
		}
	}

	dispose(): void {
		this.element.remove();
	}
}
