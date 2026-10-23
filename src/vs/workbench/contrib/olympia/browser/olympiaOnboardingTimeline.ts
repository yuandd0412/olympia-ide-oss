/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Olympia 开始引导的**纯函数**时间线引擎。
 *
 * 这个文件里没有任何 DOM 依赖、没有计时器、没有随机数：
 *  - 所有视觉状态都是「相对时间 t（秒）」的纯函数；
 *  - 所有随机性都由**索引**推导（`olympiaOnboardingHash1/2`），不是 `Math.random()`。
 *
 * 这么做的原因有两个，都不是洁癖：
 *
 * 1. **「同一 t 永远同一张图」**。如果星光的轨迹依赖 `Math.random()` 或依赖 rAF 的
 *    实际帧间隔，那么同一段动画在两次运行里会画出不同的粒子分布 —— 没法写断言，
 *    也没法在真机上复现「上一版好看、这一版不好看」到底改了什么。
 * 2. **可静态断言**。把时间线抽成纯函数之后，「进入动画必须有多长」「暗角峰值必须
 *    在某个时刻归零」「擦洞半径必须覆盖画布四角」这些约束就能被写成脚本断言，
 *    而不是靠人肉读代码。
 *
 * 时间线总览（`enterTime` 单位：秒，0 = 进入动画开始那一帧）：
 *
 * ```
 *  0.00 ─ 0.60   卡片化成星光（逐张淡出）
 *  0.00 ─ 1.25   星光粒子飞向画面中心
 *  0.18 ─ 1.18   光核聚合长大
 *  1.14 ─ 1.62   闪点（一次性过曝，随后回落）
 *  1.30 ─ 2.10   暗角升起（峰值 0.35）
 *  1.35 ─ 2.25   波前剥离：在极光上擦开一个椭圆洞
 *  2.35 ─ 4.59   工作台「通电」扫光（标题栏 → 活动栏 → 编辑器 → 侧栏 → 面板）
 *  3.50 ─ 5.30   暗角退场归零
 *  5.40          进入动画结束（洞已完全打开，极光 alpha 归零）
 * ```
 */

/** 进入动画总时长（秒）。洞在这之前已经完全打开，极光 alpha 归零。 */
export const OLYMPIA_ONBOARDING_ENTER_DURATION = 5.40;

/** 卡片宽度 / 间距（px）。轨道步距 = 宽度 + 间距。 */
export const OLYMPIA_ONBOARDING_CARD_WIDTH = 352;
export const OLYMPIA_ONBOARDING_CARD_GAP = 34;
export const OLYMPIA_ONBOARDING_CARD_STEP = OLYMPIA_ONBOARDING_CARD_WIDTH + OLYMPIA_ONBOARDING_CARD_GAP;

/** 波前剥离的时间窗（秒）。 */
export const OLYMPIA_ONBOARDING_REVEAL_START = 1.35;
export const OLYMPIA_ONBOARDING_REVEAL_END = 2.25;

/** 暗角：升起 → 退场归零。结束时必须是 0，否则整窗带着一圈黑边，像加了一层滤镜。 */
export const OLYMPIA_ONBOARDING_VIGNETTE_RISE_START = 1.30;
export const OLYMPIA_ONBOARDING_VIGNETTE_RISE_END = 2.10;
export const OLYMPIA_ONBOARDING_VIGNETTE_FALL_START = 3.50;
export const OLYMPIA_ONBOARDING_VIGNETTE_FALL_END = 5.30;
export const OLYMPIA_ONBOARDING_VIGNETTE_PEAK = 0.35;

/** 卡片消散的时间窗（秒）。 */
export const OLYMPIA_ONBOARDING_DISSOLVE_END = 0.60;

/**
 * 星光粒子的整体飞行窗口（秒）。
 *
 * 必须 ≥ 单颗粒子的「延迟 + 时长」上限，否则尾部的粒子会在半空中被时间轴掐掉 ——
 * 那看着像粒子凭空消失，而不是飞完了。
 */
export const OLYMPIA_ONBOARDING_PARTICLE_WINDOW = 1.60;

/**
 * 确定性伪随机：只依赖索引，不依赖时间，也不依赖 `Math.random()`。
 *
 * 用 `sin` 的经典哈希取小数部分。它不是密码学哈希，但我们要的是「稳定 + 均匀 + 便宜」。
 */
export function olympiaOnboardingHash1(index: number): number {
	const s = Math.sin(index * 127.1 + 311.7) * 43758.5453;
	return s - Math.floor(s);
}

export function olympiaOnboardingHash2(index: number): number {
	const s = Math.sin(index * 269.5 + 183.3) * 24634.6345;
	return s - Math.floor(s);
}

export function olympiaOnboardingClamp(value: number, min: number, max: number): number {
	return value < min ? min : value > max ? max : value;
}

/** 区间归一化：t 落在 [from, to] 内返回 0..1，之外夹紧。 */
export function olympiaOnboardingSegment(t: number, from: number, to: number): number {
	return olympiaOnboardingClamp((t - from) / (to - from), 0, 1);
}

/** 区间内的钟形包络（0 → 1 → 0）。 */
export function olympiaOnboardingEnvelope(t: number, from: number, to: number): number {
	return Math.sin(olympiaOnboardingSegment(t, from, to) * Math.PI);
}

export function olympiaOnboardingEaseOutCubic(p: number): number {
	return 1 - Math.pow(1 - p, 3);
}

export function olympiaOnboardingEaseOutQuint(p: number): number {
	return 1 - Math.pow(1 - p, 5);
}

export function olympiaOnboardingEaseInOut(p: number): number {
	return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

/**
 * 揭示几何：极光上被擦开的那个洞。
 *
 * 为什么角落距离是 `W / √2` 而不是 `hypot(W/2, H/2)`：
 * 画布里做了 `scale(1, H/W)` 的纵向压缩，所以在**圆空间**里画出来的半径 R 覆盖的是
 * x∈[-R, R]、y∈[-R·H/W, R·H/W]。要让洞盖住画布四角，需要 R ≥ W/√2（角点到中心的
 * 圆空间距离），而不是 hypot(W/2, H/2)。按后者算，洞盖不住四角，画面四角会残留一圈
 * 极光 —— 肉眼看不太出来，但收尾那一刻就是一次可见的跳变。
 *
 * 波前光环和擦洞必须共用这一份几何（历史上各算各的，光环跑到洞外，看着像一圈脏雾）。
 */
export interface OlympiaOnboardingRevealGeometry {
	/** 剥离进度 0..1。 */
	readonly progress: number;
	/** 画布角点到中心的圆空间距离。 */
	readonly corner: number;
	/** 软边宽度。 */
	readonly band: number;
	/** 洞的外半径。 */
	readonly radius: number;
	/** 洞的全透明内半径。 */
	readonly inner: number;
}

export function olympiaOnboardingRevealGeometry(enterTime: number, viewportWidth: number): OlympiaOnboardingRevealGeometry | undefined {
	const progress = olympiaOnboardingSegment(enterTime, OLYMPIA_ONBOARDING_REVEAL_START, OLYMPIA_ONBOARDING_REVEAL_END);
	if (progress <= 0) {
		return undefined;
	}
	const corner = viewportWidth / Math.SQRT2;
	const band = corner * 0.30;
	const radius = (corner + band) * olympiaOnboardingEaseInOut(progress);
	return { progress, corner, band, radius, inner: Math.max(0, radius - band) };
}

/** 一颗星光粒子。全部字段都由 (card, index) 推导。 */
export interface OlympiaOnboardingParticle {
	/** 粒子属于哪张卡（0..3）。 */
	readonly card: number;
	/** 卡内序号。 */
	readonly index: number;
	/** 起始方向（弧度）。 */
	readonly angle: number;
	/** 起始半径（px）。 */
	readonly radius: number;
	/** 速度系数。 */
	readonly speed: number;
	/** 起飞延迟（秒）。 */
	readonly delay: number;
	/** 飞行时长（秒）。 */
	readonly duration: number;
	/** 尺寸（px）。 */
	readonly size: number;
	/** true = 飞向中心；false = 向外飘散。 */
	readonly inward: boolean;
	/** 摆动相位。 */
	readonly wobble: number;
}

/** 每张卡化出的粒子数。 */
const OLYMPIA_ONBOARDING_PARTICLES_PER_CARD = 26;

/** 参与卡片配置的卡片数。 */
export const OLYMPIA_ONBOARDING_CARD_COUNT = 4;

function buildParticles(): readonly OlympiaOnboardingParticle[] {
	const particles: OlympiaOnboardingParticle[] = [];
	for (let card = 0; card < OLYMPIA_ONBOARDING_CARD_COUNT; card++) {
		for (let index = 0; index < OLYMPIA_ONBOARDING_PARTICLES_PER_CARD; index++) {
			const k = card * 97 + index * 13;
			particles.push({
				card,
				index,
				angle: olympiaOnboardingHash1(k * 1.7) * Math.PI * 2,
				radius: 40 + olympiaOnboardingHash2(k * 2.3) * 150,
				speed: 0.35 + olympiaOnboardingHash2(k * 3.1) * 0.55,
				delay: olympiaOnboardingHash2(k * 4.7) * 0.42,
				duration: 0.62 + olympiaOnboardingHash2(k * 5.3) * 0.55,
				size: 1.1 + olympiaOnboardingHash1(k * 6.1) * 2.1,
				inward: olympiaOnboardingHash1(k) < 0.72,
				wobble: olympiaOnboardingHash1(k * 7.3) * Math.PI * 2,
			});
		}
	}
	return particles;
}

/** 星光粒子表。模块加载时构建一次，之后完全静态。 */
export const OLYMPIA_ONBOARDING_PARTICLES: readonly OlympiaOnboardingParticle[] = buildParticles();

/** 工作台「通电」扫光的部件。 */
export type OlympiaOnboardingSweepTarget = 'titlebar' | 'activitybar' | 'editor' | 'sidebar' | 'panel';

export interface OlympiaOnboardingSweep {
	readonly id: OlympiaOnboardingSweepTarget;
	readonly start: number;
	readonly end: number;
	/** 扫光方向：x = 横向，y = 纵向。 */
	readonly axis: 'x' | 'y';
}

/** 扫光按「解剖顺序」排列：先标题栏，再活动栏、编辑器、侧栏、最后面板。 */
export const OLYMPIA_ONBOARDING_SWEEPS: readonly OlympiaOnboardingSweep[] = [
	{ id: 'titlebar', start: 2.35, end: 3.05, axis: 'x' },
	{ id: 'activitybar', start: 2.67, end: 3.47, axis: 'y' },
	{ id: 'editor', start: 2.97, end: 3.85, axis: 'y' },
	{ id: 'sidebar', start: 3.35, end: 4.13, axis: 'y' },
	{ id: 'panel', start: 3.79, end: 4.59, axis: 'y' },
];

export interface OlympiaOnboardingSweepState {
	readonly id: OlympiaOnboardingSweepTarget;
	/** 0..1，0 = 不显示。 */
	readonly opacity: number;
	/** -1..1，0 = 部件正中。 */
	readonly offset: number;
}

/** 某一帧的全部视觉状态。渲染层只需要读这个结构。 */
export interface OlympiaOnboardingFrame {
	readonly reveal: OlympiaOnboardingRevealGeometry | undefined;
	/** 光核缩放。0 = 不存在。 */
	readonly coreScale: number;
	/** 光核不透明度 0..1。 */
	readonly coreOpacity: number;
	/** 闪点不透明度 0..1。 */
	readonly flashOpacity: number;
	/** 暗角不透明度 0..1。 */
	readonly vignetteOpacity: number;
	/** 卡片存留系数：1 = 完整，0 = 全部化成星光。 */
	readonly cardDissolve: number;
	/** 星光粒子的整体进度 0..1（0 = 还没起飞）。 */
	readonly particleProgress: number;
	readonly sweeps: readonly OlympiaOnboardingSweepState[];
}

/**
 * 计算进入动画在 `enterTime` 时刻的完整视觉状态。
 *
 * 注意：这里的 `enterTime` 是**相对时间**，由宿主用 rAF 的帧时间戳做原点。
 * 早先的版本用 `performance.now()` 和 rAF 时间戳相减，两者不同源，算出来会是负数，
 * 于是 `if (enterT >= 0)` 这种守卫永远不成立 —— 动画挂死。
 */
export function olympiaOnboardingFrame(enterTime: number, viewportWidth: number): OlympiaOnboardingFrame {
	const t = Math.max(0, enterTime);

	// 光核：0.18 → 1.18 聚合长大，1.14 → 1.52 闪点时额外胀一下，1.72 → 2.12 波前一动就收掉。
	const grow = olympiaOnboardingSegment(t, 0.18, 1.18);
	const flash = olympiaOnboardingEnvelope(t, 1.14, 1.52);
	const coreFade = 1 - olympiaOnboardingSegment(t, 1.72, 2.12);
	const coreScale = olympiaOnboardingEaseOutCubic(grow) * (1 + flash * 1.35) * 5.5;
	const coreOpacity = olympiaOnboardingClamp(grow * 1.25, 0, 1) * coreFade;

	// 闪点：只有 1.14 → 1.62 那一小段有峰值，其余时间必须是 0。
	const flashProgress = olympiaOnboardingSegment(t, 1.14, 1.62);
	const flashOpacity = (flashProgress > 0 && flashProgress < 1) ? Math.sin(flashProgress * Math.PI) * 0.32 : 0;

	// 暗角：升起 → 退场归零。结束时必须精确为 0。
	const vignetteRise = olympiaOnboardingSegment(t, OLYMPIA_ONBOARDING_VIGNETTE_RISE_START, OLYMPIA_ONBOARDING_VIGNETTE_RISE_END);
	const vignetteFall = olympiaOnboardingSegment(t, OLYMPIA_ONBOARDING_VIGNETTE_FALL_START, OLYMPIA_ONBOARDING_VIGNETTE_FALL_END);
	const vignetteOpacity = vignetteRise * OLYMPIA_ONBOARDING_VIGNETTE_PEAK * (1 - vignetteFall);

	// 卡片：0 → 0.60 化成星光。
	const cardDissolve = 1 - olympiaOnboardingSegment(t, 0, OLYMPIA_ONBOARDING_DISSOLVE_END);

	// 粒子：0 → PARTICLE_WINDOW。
	const particleProgress = olympiaOnboardingSegment(t, 0, OLYMPIA_ONBOARDING_PARTICLE_WINDOW);

	const sweeps: OlympiaOnboardingSweepState[] = OLYMPIA_ONBOARDING_SWEEPS.map(sweep => {
		const progress = olympiaOnboardingSegment(t, sweep.start, sweep.end);
		const active = t >= sweep.start && t <= sweep.end;
		if (!active) {
			return { id: sweep.id, opacity: 0, offset: 0 };
		}
		const eased = olympiaOnboardingEaseInOut(progress);
		return {
			id: sweep.id,
			opacity: Math.sin(progress * Math.PI) * 0.95,
			offset: eased * 2 - 1,
		};
	});

	return {
		reveal: olympiaOnboardingRevealGeometry(t, viewportWidth),
		coreScale,
		coreOpacity,
		flashOpacity,
		vignetteOpacity,
		cardDissolve,
		particleProgress,
		sweeps,
	};
}

/** 一张卡片在某一帧的摆放。 */
export interface OlympiaOnboardingCardLayout {
	readonly translateX: number;
	readonly translateY: number;
	readonly scale: number;
	readonly opacity: number;
	readonly zIndex: number;
	readonly interactive: boolean;
}

/**
 * 计算第 `index` 张卡在轨道位置 `position`（浮点）上的摆放。
 *
 * 位置**只**由卡片自己的 transform 承担。曾经轨道也做了一次 translate，等于位移被
 * 算了两次 —— 卡片跑得比手指快一倍，「跟手 1:1」的观感直接崩掉。
 */
export function olympiaOnboardingCardLayout(index: number, position: number, dissolve: number): OlympiaOnboardingCardLayout {
	const delta = index - position;
	const distance = Math.min(Math.abs(delta), 1.6);
	const scale = 1 - distance * 0.055;
	// 二级衰减：|delta| > 1 的卡片快速淡出，避免被视口边缘截断成「半截字」。
	const fade = olympiaOnboardingClamp(1 - Math.max(0, distance - 1) * 1.6, 0, 1);
	const opacity = olympiaOnboardingClamp(1 - distance * 0.50, 0, 1) * fade * dissolve;
	return {
		translateX: delta * OLYMPIA_ONBOARDING_CARD_STEP,
		translateY: Math.abs(delta) * 10,
		scale,
		opacity,
		zIndex: 100 - Math.round(distance * 10),
		interactive: distance < 0.5 && dissolve >= 1,
	};
}
