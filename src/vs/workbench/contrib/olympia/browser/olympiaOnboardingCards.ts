/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableListener } from '../../../../base/browser/dom.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ConfigurationTarget, IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IRecentFolder, IRecentWorkspace, IWorkspacesService } from '../../../../platform/workspaces/common/workspaces.js';
import {
	OLYMPIA_CONFIG_CHECK_ENABLED,
	OLYMPIA_CONFIG_COMPILER_OPTIMIZATION,
	OLYMPIA_CONFIG_COMPILER_PROFILE,
	OLYMPIA_CONFIG_CPP_SNIPPETS,
	OLYMPIA_CONFIG_EDITOR_FONT_SIZE,
	OLYMPIA_CONFIG_EDITOR_FONT_FAMILY,
	OLYMPIA_CONFIG_EDITOR_LINE_HEIGHT,
	OLYMPIA_CONFIG_EDITOR_MINIMAP,
	OLYMPIA_CONFIG_EDITOR_SMOOTH_CARET,
	OLYMPIA_CONFIG_JUDGE_MEMORY_LIMIT,
	OLYMPIA_CONFIG_PROBLEMS_DIR,
	OLYMPIA_CONFIG_TEMPLATE_ON_PULL,
	OLYMPIA_CONFIG_TRAIN_DAILY_GOAL,
	OLYMPIA_CONFIG_TRAIN_RECORD_SOLVES,
	OLYMPIA_ONBOARDING_CONFIG_DEFAULTS,
	OLYMPIA_ONBOARDING_EDITOR_FALLBACKS
} from './olympiaOnboardingConfig.js';
import {
	OLYMPIA_JUDGE_TARGETS,
	olympiaActiveJudgeTarget,
	olympiaJudgeTargetSummary,
	olympiaRenderJudgeFlags
} from './olympiaJudgeTargets.js';
import {
	OLYMPIA_ONBOARDING_CARD_COUNT,
	OLYMPIA_ONBOARDING_CARD_STEP,
	olympiaOnboardingCardLayout,
	olympiaOnboardingClamp,
	olympiaOnboardingEaseOutCubic
} from './olympiaOnboardingTimeline.js';

/**
 * 开始引导的**卡片配置**层。
 *
 * 形态照鸿蒙：一张卡浮在动态背景上，可以跟手左右滑；点选项直接改配置，改完立刻能看到
 * 「这个配置会带来什么后果」的预览。
 *
 * ## 一条硬规矩：卡上不许出现编造的值
 *
 * 早期原型在预览块里写过 `GCC 12.2`、`g++ 13.2.0` 这种**看起来很像真的**数字 ——
 * 但评测机的 GCC 版本是洛谷/NOI 文档里的值，本地编译器版本我们根本不知道。
 * 这种数字比不写更糟：用户会照着它对版本，对不上就以为装坏了。
 *
 * 所以这里显示的每一个值都来自：
 *  - 评测机表（`olympiaJudgeTargets.ts`，与扩展逐字一致）；
 *  - 扩展 `package.json` 的默认值（`olympiaOnboardingConfig.ts`，静态断言比对）；
 *  - 用户当前配置（`IConfigurationService`）；
 *  - 扩展真实注册的命令与快捷键。
 */

export interface IOlympiaOnboardingCardsDelegate {

	/** 切到下一张卡（最后一张时表示「开始」）。 */
	readonly onNext: () => void;

	/** 直接进入（跳过引导）。 */
	readonly onBeginEnter: () => void;
}

interface IOlympiaOnboardingOption {
	/** 显示文本。 */
	readonly label: string;
	/** 选中判定用的值（字符串形态，和当前配置 `String()` 之后比较）。 */
	readonly value: string;
	/**
	 * 真正写进配置的值。
	 *
	 * 不填就写 `value`（也就是字符串）。但**数字和布尔类型的配置必须显式给**：
	 * `olympia.judge.memoryLimitMb` 的 schema 是 `number`，写字符串会被配置校验
	 * 拒绝 —— `updateValue` 直接抛错，选择就永远存不下来。
	 */
	readonly configValue?: unknown;
	/** 悬浮说明（可选）。 */
	readonly title?: string;
}

interface IOlympiaOnboardingRow {
	readonly label: string;
	readonly kind: 'value' | 'options' | 'toggle';
	readonly value?: string;
	readonly options?: readonly IOlympiaOnboardingOption[];
	readonly checked?: boolean;
	/**
	 * 开关写进配置的值。
	 *
	 * 默认写布尔。但有些「开关」对应的配置项其实是**枚举字符串** ——
	 * `editor.cursorSmoothCaretAnimation` 的 schema 是 `off | explicit | on`，
	 * 写布尔会被配置校验拒绝，用户的选择就永远存不下来。
	 */
	readonly toggleValues?: { readonly on: unknown; readonly off: unknown };
	readonly configurationKey?: string;
	/** 异步取值的行（比如「最近工程」），取到之后填进去。 */
	readonly asyncValue?: () => Promise<string>;
}

interface IOlympiaOnboardingCardDescriptor {
	readonly id: 'compile' | 'editor' | 'contest' | 'practice';
	readonly icon: string;
	readonly title: string;
	readonly subtitle: string;
	readonly rows: readonly IOlympiaOnboardingRow[];
	readonly preview: () => HTMLElement[];
}

/**
 * 最近打开的是「文件夹」还是「工作区」。
 *
 * 两者结构不同（`IRecentFolder` 有 `folderUri`，`IRecentWorkspace` 有 `workspace`），
 * 但它们是联合类型，写 `'folderUri' in entry` 会在联合上收窄 —— 只是本仓的 lint 不允许
 * 裸用 `in`。写成**类型谓词函数**之后既合法，又保留了收窄能力。
 */
function isRecentFolder(entry: IRecentFolder | IRecentWorkspace): entry is IRecentFolder {
	return 'folderUri' in entry;
}

export class OlympiaOnboardingCards implements IDisposable {

	/**
	 * 读不到 `editor.fontFamily` 时的中性等宽栈。
	 *
	 * 刻意**不**写上游的平台默认值（Windows 是 Consolas、macOS 是 Menlo、Linux 是 Droid
	 * Sans Mono）—— 那等于在 core 里抄一份会漂移的默认值。这里只是「一个能用的等宽字体」，
	 * 读得到真实配置时永远用真实值。
	 */
	private static readonly MONO_FALLBACK = `ui-monospace, SFMono-Regular, 'Cascadia Mono', Consolas, 'Liberation Mono', monospace`;

	readonly element: HTMLElement;

	private readonly delegate: IOlympiaOnboardingCardsDelegate;

	private readonly trackElement: HTMLElement;
	private readonly cardElements: HTMLElement[] = [];
	private readonly dotElements: HTMLElement[] = [];
	private readonly bodyElements: HTMLElement[] = [];
	private readonly previewElements: HTMLElement[] = [];
	private readonly footerElements: HTMLElement[] = [];

	/** 卡片轨道位置（浮点）。 */
	private position = 0;
	private positionTarget = 0;
	private tween: { from: number; to: number; start: number; duration: number } | null = null;

	/**
	 * 最近一帧的 rAF 时间戳。
	 *
	 * 补间的起点必须和 `render(now)` 的 `now` **同源**。早先这里用 `performance.now()`，
	 * 而渲染用的是 rAF 帧时间戳 —— 两者虽然共享同一个单调时钟，但 rAF 给的是**帧起始**
	 * 时刻，补间起点会比渲染时钟晚半帧到一帧，滑动跟手度会随帧率抖动。
	 * 记下帧时间戳就够了：事件回调发生在两帧之间，用最近一帧的时刻当起点，
	 * 下一帧算出来的进度正好是 0 起算，误差恒为 0。
	 */
	private lastFrameTime = 0;

	/** 跟手拖拽。 */
	private dragging = false;
	private dragStartX = 0;
	private dragStartPosition = 0;
	private dragDelta = 0;
	private lastX = 0;
	private lastTime = 0;
	private velocity = 0;

	/**
	 * 扩展还没注册配置时，写不进去的值先攒着，等注册好了再补写。
	 *
	 * 这个 map 同时是「用户当前选择的真相」—— 卡片显示和预览都优先读它。
	 */
	private readonly pendingWrites = new Map<string, unknown>();

	/** 正在写、还没回来的键，避免同一个键被重复写。 */
	private readonly writingKeys = new Set<string>();

	/** 补写重试的帧计数（约每 30 帧试一次）。 */
	private flushCounter = 0;

	private readonly disposables: IDisposable[] = [];

	constructor(
		delegate: IOlympiaOnboardingCardsDelegate,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IWorkspacesService private readonly workspacesService: IWorkspacesService
	) {
		this.delegate = delegate;

		this.element = document.createElement('div');
		this.element.className = 'olympia-onboarding-cards';

		this.element.appendChild(this.createBrand());
		this.element.appendChild(this.createSkip());

		const halo = document.createElement('div');
		halo.className = 'olympia-onboarding-halo';
		this.element.appendChild(halo);

		this.trackElement = document.createElement('div');
		this.trackElement.className = 'olympia-onboarding-track';
		this.element.appendChild(this.trackElement);

		for (let index = 0; index < OLYMPIA_ONBOARDING_CARD_COUNT; index++) {
			const card = this.createCard(index);
			this.cardElements.push(card.element);
			this.bodyElements.push(card.body);
			this.previewElements.push(card.preview);
			this.footerElements.push(card.footer);
			this.trackElement.appendChild(card.element);
		}

		this.element.appendChild(this.createDots());
		this.element.appendChild(this.createNav());
		this.element.appendChild(this.createHint());

		this.registerInteractions();
		this.refresh();
	}

	/** 当前选中的是第几张卡（0 基）。 */
	get activeCard(): number {
		return Math.round(this.positionTarget);
	}

	/**
	 * 每张卡当前在视口里的矩形（已含 transform 后的实际位置）。
	 *
	 * 进入动画里「卡片化成星光」需要知道每张卡的视觉中心 —— 那是粒子起飞的位置。
	 * 这里给的是 `getBoundingClientRect()`，也就是**用户眼睛看到的位置**，
	 * 不是未变换的布局位置；否则卡片一旦被拖到轨道中间，星光就会从旁边冒出来。
	 *
	 * 只在进入动画起跑时读一次（4 次布局读），不要每帧读。
	 */
	getCardRects(): readonly DOMRect[] {
		return this.cardElements.map(element => element.getBoundingClientRect());
	}

	/** 让卡片层整体淡出（进入动画开始时）。 */
	setVisible(visible: boolean): void {
		this.element.classList.toggle('hidden', !visible);
	}

	/**
	 * 每帧调用：推进补间并把位置写进卡片自己的 transform。
	 *
	 * 位置**只**由卡片自己的 transform 承担。轨道再 translate 一次的话位移会被算两遍，
	 * 卡片跑得比手指快一倍，「跟手 1:1」直接崩。
	 */
	render(now: number, dissolve: number): void {
		this.lastFrameTime = now;

		// 扩展还没注册配置时写入会失败并被暂存。这里按帧重试，
		// 不依赖「扩展注册恰好触发一次 onDidChangeConfiguration」这种时序巧合 ——
		// 用户点完卡片可能马上就点「开始」，那时扩展往往还没注册完。
		this.flushCounter++;
		if (this.flushCounter >= 30) {
			this.flushCounter = 0;
			void this.flushPendingWrites();
		}

		if (this.tween) {
			const progress = olympiaOnboardingClamp((now - this.tween.start) / this.tween.duration, 0, 1);
			this.position = this.tween.from + (this.tween.to - this.tween.from) * olympiaOnboardingEaseOutCubic(progress);
			if (progress >= 1) {
				this.position = this.tween.to;
				this.tween = null;
			}
		}

		const effective = this.position + this.dragDelta / OLYMPIA_ONBOARDING_CARD_STEP;
		for (let index = 0; index < this.cardElements.length; index++) {
			const layout = olympiaOnboardingCardLayout(index, effective, dissolve);
			const element = this.cardElements[index];
			element.style.transform = `translate3d(${layout.translateX.toFixed(2)}px, ${layout.translateY.toFixed(2)}px, 0) scale(${layout.scale.toFixed(4)})`;
			element.style.opacity = layout.opacity.toFixed(3);
			element.style.zIndex = String(layout.zIndex);
			element.style.pointerEvents = layout.interactive ? 'auto' : 'none';
		}

		const active = olympiaOnboardingClamp(Math.round(effective), 0, this.cardElements.length - 1);
		for (let index = 0; index < this.dotElements.length; index++) {
			this.dotElements[index].classList.toggle('on', index === active);
		}
	}

	/** 跳到指定卡片（0 基）。 */
	goto(index: number): void {
		const target = olympiaOnboardingClamp(index, 0, this.cardElements.length - 1);
		this.positionTarget = target;
		this.tween = { from: this.position, to: target, start: this.lastFrameTime, duration: 460 };
	}

	/** 相对步进。 */
	step(delta: number): void {
		this.goto(Math.round(this.positionTarget) + delta);
	}

	/** 配置变化后重新渲染卡片内容。 */
	refresh(): void {
		for (let index = 0; index < OLYMPIA_ONBOARDING_CARD_COUNT; index++) {
			const descriptor = this.descriptorFor(index);
			this.bodyElements[index].replaceChildren(...this.buildRows(descriptor.rows));
			this.footerElements[index].replaceChildren(...this.buildFooter(descriptor, index));
		}
		this.refreshPreview();
		void this.flushPendingWrites();
	}

	/**
	 * 只重建预览区。
	 *
	 * 预览区是「这次选择会带来什么后果」，必须跟着改；
	 * 行区（开关 / 选项）自己有本地状态，整片重建会把用户刚按下的按钮换掉 ——
	 * 所以两者分开刷：行区由点击就地更新，预览区才重建。
	 */
	private refreshPreview(): void {
		for (let index = 0; index < OLYMPIA_ONBOARDING_CARD_COUNT; index++) {
			const descriptor = this.descriptorFor(index);
			this.previewElements[index].replaceChildren(...descriptor.preview());
		}
	}

	dispose(): void {
		// 最后再试一次：overlay 消失时如果还有没写下去的选择，别白白丢掉。
		void this.flushPendingWrites();
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
		this.disposables.length = 0;
		this.element.remove();
	}

	//#region 读取与写入配置

	private readConfig(key: string): unknown {
		// 用户已经选过、但扩展还没注册所以暂时写不下去的值 —— 以用户的选择为准。
		// 否则扩展注册前，卡片会显示扩展的默认值，用户点了看着像「没生效」。
		if (this.pendingWrites.has(key)) {
			return this.pendingWrites.get(key);
		}
		const value = this.configurationService.getValue(key);
		if (value !== undefined) {
			return value;
		}
		if (Object.hasOwn(OLYMPIA_ONBOARDING_CONFIG_DEFAULTS, key)) {
			return OLYMPIA_ONBOARDING_CONFIG_DEFAULTS[key];
		}
		if (Object.hasOwn(OLYMPIA_ONBOARDING_EDITOR_FALLBACKS, key)) {
			return OLYMPIA_ONBOARDING_EDITOR_FALLBACKS[key];
		}
		return undefined;
	}

	/**
	 * 等宽字体。
	 *
	 * CSS 里不能写 `var(--vscode-editor-font-family)` —— 白名单里没有这个变量，
	 * stylelint 会判红；写死一个栈又和用户改过的 `editor.fontFamily` 对不上。
	 * 所以这里从配置服务读**真实值**（含上游按平台给的默认值），再以内联样式写到元素上。
	 */
	private monoFontFamily(): string {
		const family = this.readConfig(OLYMPIA_CONFIG_EDITOR_FONT_FAMILY);
		if (typeof family === 'string' && family.trim().length > 0) {
			return family;
		}
		return OlympiaOnboardingCards.MONO_FALLBACK;
	}

	/**
	 * 把用户的选择写进配置。
	 *
	 * `olympia.*` 这些键属于内置扩展，扩展没扫描完之前 `updateValue` 会抛
	 * 「unknown configuration」。所以先把值记在 `pendingWrites` 里（它同时也是
	 * 「用户当前选择的真相」，卡片和预览都读它），等扩展注册完再补写 ——
	 * 否则用户的选择永远存不下来。
	 */
	private async writeConfig(key: string, value: unknown): Promise<void> {
		this.pendingWrites.set(key, value);
		await this.flushPendingWrites();
	}

	/** 扩展注册完配置后，把之前攒着的写入补上。 */
	private async flushPendingWrites(): Promise<void> {
		for (const key of [...this.pendingWrites.keys()]) {
			if (this.writingKeys.has(key)) {
				continue;   // 正在写，等它回来再说
			}
			const value = this.pendingWrites.get(key);
			if (value === undefined || this.configurationService.getValue(key) === undefined) {
				continue;   // 还是没注册，下一次再试
			}
			this.writingKeys.add(key);
			try {
				await this.configurationService.updateValue(key, value, ConfigurationTarget.USER);
				// 期间用户又改过的话，留着新值，下一轮再写 —— 别把新选择抹掉。
				if (this.pendingWrites.get(key) === value) {
					this.pendingWrites.delete(key);
				}
			} catch {
				// 还是写不进去 —— 留在 map 里，等下一轮。
			} finally {
				this.writingKeys.delete(key);
			}
		}
	}

	//#endregion

	//#region 交互

	private registerInteractions(): void {
		this.disposables.push(this.configurationService.onDidChangeConfiguration(() => this.refresh()));

		const track = this.trackElement;

		// 拖拽监听挂在 window 上，而不是给 track 做指针捕获。
		// 指针捕获会把后续指针事件（含兼容鼠标事件）都改派到 track，
		// 卡里的按钮就收不到 click —— 「下一步」「跳过」会点不动。
		this.disposables.push(addDisposableListener(track, 'pointerdown', (event: PointerEvent) => {
			if (event.button !== 0) {
				return;
			}
			const target = event.target as HTMLElement | null;
			if (target && target.closest('button')) {
				return;   // 按在控件上，不当作拖拽
			}
			this.dragging = true;
			this.tween = null;
			this.dragStartX = event.clientX;
			this.dragStartPosition = this.position;
			this.dragDelta = 0;
			this.lastX = event.clientX;
			this.lastTime = performance.now();
			this.velocity = 0;
			track.classList.add('dragging');
		}));

		this.disposables.push(addDisposableListener(mainWindow, 'pointermove', (event: PointerEvent) => {
			if (!this.dragging) {
				return;
			}
			const delta = event.clientX - this.dragStartX;
			// 跟手 1:1：手指位移直接转成轨道位移，边界外才做阻尼。
			const minPixels = -this.dragStartPosition * OLYMPIA_ONBOARDING_CARD_STEP;
			const maxPixels = (this.cardElements.length - 1 - this.dragStartPosition) * OLYMPIA_ONBOARDING_CARD_STEP;
			let offset = -delta;
			if (offset < minPixels) {
				offset = minPixels + (offset - minPixels) * 0.30;
			}
			if (offset > maxPixels) {
				offset = maxPixels + (offset - maxPixels) * 0.30;
			}
			this.dragDelta = offset;
			const now = performance.now();
			const elapsed = Math.max(1, now - this.lastTime);
			this.velocity = (event.clientX - this.lastX) / elapsed * 1000;
			this.lastX = event.clientX;
			this.lastTime = now;
		}));

		const endDrag = () => {
			if (!this.dragging) {
				return;
			}
			this.dragging = false;
			track.classList.remove('dragging');
			const moved = this.dragStartPosition + this.dragDelta / OLYMPIA_ONBOARDING_CARD_STEP;
			let target = Math.round(moved);
			if (Math.abs(this.velocity) > 420) {
				target = this.velocity < 0 ? Math.ceil(moved) : Math.floor(moved);
			}
			this.dragDelta = 0;
			this.goto(target);
		};
		this.disposables.push(addDisposableListener(mainWindow, 'pointerup', endDrag));
		this.disposables.push(addDisposableListener(mainWindow, 'pointercancel', endDrag));

		this.disposables.push(addDisposableListener(track, 'wheel', (event: WheelEvent) => {
			event.preventDefault();
			this.step(event.deltaY > 0 ? 1 : -1);
		}, { passive: false }));

		this.disposables.push(addDisposableListener(mainWindow.document, 'keydown', (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target && target.closest('button, input, textarea')) {
				return;   // 焦点在控件上时不抢按键
			}
			if (event.key === 'ArrowRight') {
				this.step(1);
			} else if (event.key === 'ArrowLeft') {
				this.step(-1);
			} else if (event.key === 'Enter') {
				this.delegate.onNext();
			}
		}));
	}

	//#endregion

	//#region 卡片内容

	private descriptorFor(index: number): IOlympiaOnboardingCardDescriptor {
		switch (index) {
			case 0: return this.compileCard();
			case 1: return this.editorCard();
			case 2: return this.contestCard();
			default: return this.practiceCard();
		}
	}

	private compileCard(): IOlympiaOnboardingCardDescriptor {
		const target = olympiaActiveJudgeTarget(this.readConfig(OLYMPIA_CONFIG_COMPILER_PROFILE) as string | undefined);
		const optimization = (this.readConfig(OLYMPIA_CONFIG_COMPILER_OPTIMIZATION) as string | undefined) ?? 'none';
		const flags = olympiaRenderJudgeFlags(target).split(' ');
		const optSwitch = optimization.trim().length === 0 || optimization === 'none' ? [] : [optimization.trim()];
		const command = ['g++', ...flags, ...optSwitch, '-o', 'main.exe', 'main.cpp'].join(' ');

		return {
			id: 'compile',
			icon: 'settings-gear',
			title: localize('olympia.onboarding.compile.title', "编译配置"),
			subtitle: 'olympia.compiler.*',
			rows: [
				{
					label: localize('olympia.onboarding.compile.judge', "评测机"),
					kind: 'options',
					configurationKey: OLYMPIA_CONFIG_COMPILER_PROFILE,
					options: OLYMPIA_JUDGE_TARGETS.map(candidate => ({
						label: candidate.label,
						value: candidate.id,
						title: localize('olympia.onboarding.compile.judge.title', "{0} · GCC {1} · {2}", candidate.label, candidate.gcc, candidate.std.toUpperCase())
					}))
				},
				{ label: localize('olympia.onboarding.compile.std', "C++ 标准"), kind: 'value', value: target.std.toUpperCase() },
				{ label: localize('olympia.onboarding.compile.gcc', "评测机 GCC"), kind: 'value', value: target.gcc },
				{
					label: localize('olympia.onboarding.compile.optimization', "优化等级"),
					kind: 'options',
					configurationKey: OLYMPIA_CONFIG_COMPILER_OPTIMIZATION,
					options: [
						{ label: localize('olympia.onboarding.compile.optimization.none', "无"), value: 'none' },
						{ label: '-O2', value: '-O2' },
						{ label: '-O3', value: '-O3' }
					]
				}
			],
			preview: () => [
				this.caption(localize('olympia.onboarding.compile.preview', "评测机同款编译命令")),
				this.pipe([
					{ text: 'main.cpp', key: true },
					{ text: 'g++', key: false },
					{ text: olympiaJudgeTargetSummary(target), key: false }
				]),
				this.command(command)
			]
		};
	}

	private editorCard(): IOlympiaOnboardingCardDescriptor {
		const fontSize = Number(this.readConfig(OLYMPIA_CONFIG_EDITOR_FONT_SIZE) ?? 14);
		const lineHeight = Number(this.readConfig(OLYMPIA_CONFIG_EDITOR_LINE_HEIGHT) ?? 0);
		const minimap = this.readConfig(OLYMPIA_CONFIG_EDITOR_MINIMAP) !== false;
		const caret = this.readConfig(OLYMPIA_CONFIG_EDITOR_SMOOTH_CARET);
		// 上游枚举是 `off | explicit | on`（老值 `cursorSmoothing` 已经被改掉了）。
		const smoothCaret = caret === 'on' || caret === 'explicit';

		return {
			id: 'editor',
			icon: 'editor-layout',
			title: localize('olympia.onboarding.editor.title', "编辑器手感"),
			subtitle: 'editor.*',
			rows: [
				{
					label: localize('olympia.onboarding.editor.fontSize', "字号"),
					kind: 'options',
					configurationKey: OLYMPIA_CONFIG_EDITOR_FONT_SIZE,
					options: [12, 13, 14, 16].map(value => ({ label: String(value), value: String(value), configValue: value }))
				},
				{
					label: localize('olympia.onboarding.editor.lineHeight', "行高"),
					kind: 'options',
					configurationKey: OLYMPIA_CONFIG_EDITOR_LINE_HEIGHT,
					options: [
						{ label: localize('olympia.onboarding.editor.lineHeight.auto', "跟随"), value: '0', configValue: 0 },
						{ label: '1.3', value: '1.3', configValue: 1.3 },
						{ label: '1.5', value: '1.5', configValue: 1.5 },
						{ label: '1.7', value: '1.7', configValue: 1.7 }
					]
				},
				{
					label: localize('olympia.onboarding.editor.minimap', "缩略图"),
					kind: 'toggle',
					configurationKey: OLYMPIA_CONFIG_EDITOR_MINIMAP,
					checked: minimap
				},
				{
					label: localize('olympia.onboarding.editor.caret', "光标动画"),
					kind: 'toggle',
					configurationKey: OLYMPIA_CONFIG_EDITOR_SMOOTH_CARET,
					checked: smoothCaret,
					// 这个键的 schema 是 `off | explicit | on` —— 写布尔会被配置校验拒绝。
					toggleValues: { on: 'on', off: 'off' }
				}
			],
			preview: () => [
				this.caption(localize('olympia.onboarding.editor.preview', "按当前主题渲染的样子")),
				this.codeSample(fontSize, lineHeight)
			]
		};
	}

	private contestCard(): IOlympiaOnboardingCardDescriptor {
		const recordSolves = this.readConfig(OLYMPIA_CONFIG_TRAIN_RECORD_SOLVES) !== false;
		const checkEnabled = this.readConfig(OLYMPIA_CONFIG_CHECK_ENABLED) !== false;

		return {
			id: 'contest',
			icon: 'star-full',
			title: localize('olympia.onboarding.contest.title', "竞赛模式"),
			subtitle: 'olympia.judge.* · olympia.train.*',
			rows: [
				{
					label: localize('olympia.onboarding.contest.memory', "内存上限"),
					kind: 'options',
					configurationKey: OLYMPIA_CONFIG_JUDGE_MEMORY_LIMIT,
					options: [
						{ label: localize('olympia.onboarding.contest.memory.judge', "跟评测机"), value: '0', configValue: 0 },
						{ label: '128 MB', value: '128', configValue: 128 },
						{ label: '256 MB', value: '256', configValue: 256 },
						{ label: '512 MB', value: '512', configValue: 512 }
					]
				},
				{
					label: localize('olympia.onboarding.contest.dailyGoal', "每日题量"),
					kind: 'options',
					configurationKey: OLYMPIA_CONFIG_TRAIN_DAILY_GOAL,
					options: [1, 3, 5, 10].map(value => ({ label: String(value), value: String(value), configValue: value }))
				},
				{
					label: localize('olympia.onboarding.contest.record', "记录通过"),
					kind: 'toggle',
					configurationKey: OLYMPIA_CONFIG_TRAIN_RECORD_SOLVES,
					checked: recordSolves
				},
				{
					label: localize('olympia.onboarding.contest.check', "提交前自检"),
					kind: 'toggle',
					configurationKey: OLYMPIA_CONFIG_CHECK_ENABLED,
					checked: checkEnabled
				}
			],
			preview: () => [
				this.caption(localize('olympia.onboarding.contest.preview', "交卷前这四步")),
				this.flow([
					{ label: localize('olympia.onboarding.contest.step.check', "语法自检"), key: 'Ctrl+Alt+Enter' },
					{ label: localize('olympia.onboarding.contest.step.compile', "评测机编译"), key: 'Ctrl+Shift+F9' },
					{ label: localize('olympia.onboarding.contest.step.samples', "样例校验"), key: 'Ctrl+Alt+J' },
					{ label: localize('olympia.onboarding.contest.step.stress', "压力测试"), key: 'Ctrl+Alt+S' }
				])
			]
		};
	}

	private practiceCard(): IOlympiaOnboardingCardDescriptor {
		const problemsDir = (this.readConfig(OLYMPIA_CONFIG_PROBLEMS_DIR) as string | undefined) ?? '.olympia/problems';
		const templateOnPull = this.readConfig(OLYMPIA_CONFIG_TEMPLATE_ON_PULL) === true;
		const snippets = this.readConfig(OLYMPIA_CONFIG_CPP_SNIPPETS) !== false;

		return {
			id: 'practice',
			icon: 'beaker',
			title: localize('olympia.onboarding.practice.title', "开始做题"),
			subtitle: 'olympia.problem.*',
			rows: [
				{
					label: localize('olympia.onboarding.practice.dir', "练习目录"),
					kind: 'options',
					configurationKey: OLYMPIA_CONFIG_PROBLEMS_DIR,
					options: [
						{ label: '.olympia/problems', value: '.olympia/problems' },
						{ label: 'problems', value: 'problems' },
						{ label: localize('olympia.onboarding.practice.dir.zh', "题目"), value: '题目' }
					]
				},
				{
					label: localize('olympia.onboarding.practice.template', "拉题时建模板"),
					kind: 'toggle',
					configurationKey: OLYMPIA_CONFIG_TEMPLATE_ON_PULL,
					checked: templateOnPull
				},
				{
					label: localize('olympia.onboarding.practice.snippets', "代码片段"),
					kind: 'toggle',
					configurationKey: OLYMPIA_CONFIG_CPP_SNIPPETS,
					checked: snippets
				},
				{
					label: localize('olympia.onboarding.practice.recent', "最近工程"),
					kind: 'value',
					value: '',
					asyncValue: () => this.recentWorkspaceLabel()
				}
			],
			preview: () => [
				this.caption(localize('olympia.onboarding.practice.preview', "工程里会长成这样")),
				this.directory(problemsDir)
			]
		};
	}

	/**
	 * 最近打开的工程名。
	 *
	 * `IRecentFolder` 给的是 `folderUri`，`IRecentWorkspace` 给的是 `workspace.id`
	 * （一条 `IWorkspaceIdentifier`）。两者不是同一个字段，必须按 `in` 收窄 ——
	 * 直接写 `first.workspaceUri` 编译不过，硬写 `as any` 则是把类型信息扔掉。
	 */
	private async recentWorkspaceLabel(): Promise<string> {
		const empty = localize('olympia.onboarding.practice.recent.empty', "还没有");
		try {
			const recent = await this.workspacesService.getRecentlyOpened();
			const first = recent.workspaces[0];
			if (!first) {
				return empty;
			}
			if (isRecentFolder(first)) {
				return first.folderUri.fsPath || empty;
			}
			return first.workspace.id || empty;
		} catch {
			return empty;
		}
	}

	//#endregion

	//#region DOM 构件

	private createBrand(): HTMLElement {
		const brand = document.createElement('div');
		brand.className = 'olympia-onboarding-brand';
		const dot = document.createElement('span');
		dot.className = 'olympia-onboarding-brand-dot';
		brand.appendChild(dot);
		const text = document.createElement('span');
		text.textContent = 'OLYMPIA';
		brand.appendChild(text);
		return brand;
	}

	private createSkip(): HTMLElement {
		const skip = document.createElement('button');
		skip.className = 'olympia-onboarding-skip';
		skip.type = 'button';
		skip.textContent = localize('olympia.onboarding.skip', "跳过引导");
		skip.addEventListener('click', () => this.delegate.onBeginEnter());
		return skip;
	}

	private createDots(): HTMLElement {
		const dots = document.createElement('div');
		dots.className = 'olympia-onboarding-dots';
		for (let index = 0; index < OLYMPIA_ONBOARDING_CARD_COUNT; index++) {
			const dot = document.createElement('i');
			dots.appendChild(dot);
			this.dotElements.push(dot);
		}
		return dots;
	}

	private createNav(): HTMLElement {
		const nav = document.createElement('div');
		nav.className = 'olympia-onboarding-nav';
		const previous = document.createElement('button');
		previous.className = 'olympia-onboarding-nav-button';
		previous.type = 'button';
		previous.textContent = '‹';
		previous.setAttribute('aria-label', localize('olympia.onboarding.previous', "上一张"));
		previous.addEventListener('click', () => this.step(-1));
		const next = document.createElement('button');
		next.className = 'olympia-onboarding-nav-button';
		next.type = 'button';
		next.textContent = '›';
		next.setAttribute('aria-label', localize('olympia.onboarding.next', "下一张"));
		next.addEventListener('click', () => this.step(1));
		nav.appendChild(previous);
		nav.appendChild(next);
		return nav;
	}

	private createHint(): HTMLElement {
		const hint = document.createElement('div');
		hint.className = 'olympia-onboarding-hint';
		hint.textContent = localize('olympia.onboarding.hint', "拖动或用 ← → 切换");
		return hint;
	}

	private createCard(index: number): { element: HTMLElement; body: HTMLElement; preview: HTMLElement; footer: HTMLElement } {
		const descriptor = this.descriptorFor(index);

		const element = document.createElement('div');
		element.className = 'olympia-onboarding-card';
		element.dataset.card = String(index);

		const header = document.createElement('div');
		header.className = 'olympia-onboarding-card-header';
		const icon = document.createElement('span');
		icon.className = `olympia-onboarding-card-icon codicon codicon-${descriptor.icon}`;
		header.appendChild(icon);
		const titles = document.createElement('div');
		const title = document.createElement('h2');
		title.textContent = descriptor.title;
		titles.appendChild(title);
		const subtitle = document.createElement('p');
		subtitle.textContent = descriptor.subtitle;
		titles.appendChild(subtitle);
		header.appendChild(titles);
		element.appendChild(header);

		const body = document.createElement('div');
		body.className = 'olympia-onboarding-card-body';
		element.appendChild(body);

		const preview = document.createElement('div');
		preview.className = 'olympia-onboarding-card-preview';
		element.appendChild(preview);

		const footer = document.createElement('div');
		footer.className = 'olympia-onboarding-card-footer';
		element.appendChild(footer);

		return { element, body, preview, footer };
	}

	private buildRows(rows: readonly IOlympiaOnboardingRow[]): HTMLElement[] {
		const elements: HTMLElement[] = [];
		for (const row of rows) {
			const container = document.createElement('div');
			container.className = 'olympia-onboarding-row';
			const label = document.createElement('span');
			label.className = 'olympia-onboarding-row-label';
			label.textContent = row.label;
			container.appendChild(label);

			switch (row.kind) {
				case 'value': {
					const value = document.createElement('span');
					value.className = 'olympia-onboarding-row-value';
					value.textContent = row.value ?? '';
					container.appendChild(value);
					if (row.asyncValue) {
						row.asyncValue().then(text => { value.textContent = text; }, () => { value.textContent = ''; });
					}
					break;
				}
				case 'options': {
					const group = document.createElement('div');
					group.className = 'olympia-onboarding-options';
					const current = row.configurationKey ? this.readConfig(row.configurationKey) : undefined;
					const chips: HTMLElement[] = [];
					for (const option of row.options ?? []) {
						const chip = document.createElement('button');
						chip.className = 'olympia-onboarding-option';
						chip.type = 'button';
						chip.textContent = option.label;
						if (option.title) {
							chip.title = option.title;
						}
						chip.classList.toggle('selected', String(current) === option.value);
						chip.addEventListener('click', event => {
							event.stopPropagation();
							// 立刻改选中态。配置写下去是异步的（`olympia.*` 还要等扩展注册），
							// 等配置事件再改，用户会觉得「点了没反应」。
							for (const sibling of chips) {
								sibling.classList.remove('selected');
							}
							chip.classList.add('selected');
							if (row.configurationKey) {
								// 数字型配置（字号 / 内存上限 / 每日题量）写字符串会被 schema 拒绝。
								const value = option.configValue !== undefined ? option.configValue : option.value;
								// 先写：`writeConfig` 会同步把值记进 `pendingWrites`，
								// 预览区读的就是它 —— 顺序反了预览会显示旧值。
								void this.writeConfig(row.configurationKey, value);
							}
							this.refreshPreview();
						});
						chips.push(chip);
						group.appendChild(chip);
					}
					container.appendChild(group);
					break;
				}
				case 'toggle': {
					const toggle = document.createElement('button');
					toggle.className = 'olympia-onboarding-toggle';
					toggle.type = 'button';
					toggle.setAttribute('role', 'switch');
					// 本地状态：连点两次必须写两个不同的值，不能一直写初始值。
					let checked = row.checked === true;
					toggle.setAttribute('aria-checked', String(checked));
					toggle.classList.toggle('on', checked);
					toggle.addEventListener('click', event => {
						event.stopPropagation();
						checked = !checked;
						toggle.setAttribute('aria-checked', String(checked));
						toggle.classList.toggle('on', checked);
						if (row.configurationKey) {
							// 枚举型开关（比如光标动画）写的是字符串，不是布尔。
							const values = row.toggleValues;
							const value = values
								? (checked ? values.on : values.off)
								: checked;
							// 先写：`writeConfig` 会同步把值记进 `pendingWrites`，
							// 预览区读的就是它 —— 顺序反了预览会显示旧值。
							void this.writeConfig(row.configurationKey, value);
						}
						this.refreshPreview();
					});
					container.appendChild(toggle);
					break;
				}
			}
			elements.push(container);
		}
		return elements;
	}

	private buildFooter(descriptor: IOlympiaOnboardingCardDescriptor, index: number): HTMLElement[] {
		const footer: HTMLElement[] = [];
		const isLast = descriptor.id === 'practice';
		// 还剩几张是**算出来**的 —— 写死「还有三张」会在第二张卡上说错。
		const remaining = OLYMPIA_ONBOARDING_CARD_COUNT - 1 - index;
		const status = document.createElement('span');
		status.className = 'olympia-onboarding-card-status';
		const dot = document.createElement('i');
		status.appendChild(dot);
		status.appendChild(document.createTextNode(
			isLast
				? localize('olympia.onboarding.card.ready', "准备好了就开始")
				: localize('olympia.onboarding.card.more', "还有 {0} 张", remaining)
		));
		footer.push(status);

		const button = document.createElement('button');
		button.className = isLast ? 'olympia-onboarding-cta primary' : 'olympia-onboarding-cta';
		button.type = 'button';
		button.textContent = isLast
			? localize('olympia.onboarding.cta.start', "开始做题")
			: localize('olympia.onboarding.cta.next', "下一步");
		button.addEventListener('click', event => {
			event.stopPropagation();
			this.delegate.onNext();
		});
		footer.push(button);
		return footer;
	}

	private caption(text: string): HTMLElement {
		const caption = document.createElement('div');
		caption.className = 'olympia-onboarding-preview-caption';
		caption.textContent = text;
		return caption;
	}

	private pipe(nodes: readonly { text: string; key: boolean }[]): HTMLElement {
		const pipe = document.createElement('div');
		pipe.className = 'olympia-onboarding-pipe';
		const fontFamily = this.monoFontFamily();
		nodes.forEach((node, index) => {
			if (index > 0) {
				const arrow = document.createElement('span');
				arrow.className = 'olympia-onboarding-pipe-arrow';
				arrow.textContent = '→';
				pipe.appendChild(arrow);
			}
			const chip = document.createElement('span');
			chip.className = node.key ? 'olympia-onboarding-pipe-node key' : 'olympia-onboarding-pipe-node';
			chip.textContent = node.text;
			if (node.key) {
				chip.style.fontFamily = fontFamily;
			}
			pipe.appendChild(chip);
		});
		return pipe;
	}

	private command(text: string): HTMLElement {
		const command = document.createElement('div');
		command.className = 'olympia-onboarding-command';
		command.style.fontFamily = this.monoFontFamily();
		command.textContent = text;
		return command;
	}

	private flow(steps: readonly { label: string; key: string }[]): HTMLElement {
		const flow = document.createElement('div');
		flow.className = 'olympia-onboarding-flow';
		const fontFamily = this.monoFontFamily();
		steps.forEach((step, index) => {
			if (index > 0) {
				const line = document.createElement('span');
				line.className = 'olympia-onboarding-flow-line';
				flow.appendChild(line);
			}
			const column = document.createElement('div');
			column.className = 'olympia-onboarding-flow-step';
			const marker = document.createElement('i');
			column.appendChild(marker);
			const label = document.createElement('span');
			label.textContent = step.label;
			column.appendChild(label);
			const key = document.createElement('kbd');
			key.style.fontFamily = fontFamily;
			key.textContent = step.key;
			column.appendChild(key);
			flow.appendChild(column);
		});
		return flow;
	}

	private directory(problemsDir: string): HTMLElement {
		const list = document.createElement('div');
		list.className = 'olympia-onboarding-directory';
		list.style.fontFamily = this.monoFontFamily();
		const rows: readonly (readonly [string, boolean])[] = [
			[`${problemsDir}/`, true],
			[localize('olympia.onboarding.practice.dir.statement', "<题号>.md  题面"), false],
			['.olympia/template.cpp', false],
			['.olympia/practice.json', false]
		];
		for (const [text, key] of rows) {
			const row = document.createElement('div');
			row.className = key ? 'olympia-onboarding-directory-row key' : 'olympia-onboarding-directory-row';
			row.textContent = text;
			list.appendChild(row);
		}
		return list;
	}

	private codeSample(fontSize: number, lineHeight: number): HTMLElement {
		const code = document.createElement('div');
		code.className = 'olympia-onboarding-code';
		code.style.fontFamily = this.monoFontFamily();
		code.style.fontSize = `${fontSize}px`;
		code.style.lineHeight = lineHeight > 0 ? String(lineHeight) : '1.55';

		// 一段真实、能编译的 C++（求 1..n 的和）。
		const lines: readonly (readonly (readonly [string, string] | null)[])[] = [
			[['comment', '#include <bits/stdc++.h>']],
			[['keyword', 'using namespace std;']],
			[null],
			[['type', 'int'], ['plain', ' main() {']],
			[['plain', '    '], ['type', 'int'], ['plain', ' n; cin >> n;']],
			[['plain', '    '], ['type', 'long long'], ['plain', ' ans = 0;']],
			[['plain', '    '], ['keyword', 'for'], ['plain', ' ('], ['type', 'int'], ['plain', ' i = 1; i <= n; ++i)']],
			[['plain', '        ans += i;']],
			[['plain', '    '], ['plain', 'cout << ans << '], ['string', `'\\n'`], ['plain', ';']],
			[['plain', '    '], ['keyword', 'return'], ['plain', ' 0;']],
			[['plain', '}']]
		];

		for (const line of lines) {
			const lineElement = document.createElement('div');
			lineElement.className = 'olympia-onboarding-code-line';
			for (const token of line ?? []) {
				if (!token) {
					continue;
				}
				const span = document.createElement('span');
				span.className = `olympia-onboarding-token ${token[0]}`;
				span.textContent = token[1];
				lineElement.appendChild(span);
			}
			code.appendChild(lineElement);
		}

		// 光标挂在最后一行末尾。
		const lastLine = code.lastElementChild;
		if (lastLine) {
			const caret = document.createElement('span');
			caret.className = 'olympia-onboarding-caret';
			lastLine.appendChild(caret);
		}
		return code;
	}

	//#endregion
}
