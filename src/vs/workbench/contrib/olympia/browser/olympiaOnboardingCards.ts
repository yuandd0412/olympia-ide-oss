/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableListener } from '../../../../base/browser/dom.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ConfigurationTarget, IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import {
	OLYMPIA_CONFIG_COMPILER_PROFILE,
	OLYMPIA_CONFIG_EDITOR_FONT_SIZE,
	OLYMPIA_CONFIG_PROBLEMS_DIR,
	OLYMPIA_ONBOARDING_CONFIG_DEFAULTS,
	OLYMPIA_ONBOARDING_EDITOR_FALLBACKS
} from './olympiaOnboardingConfig.js';
import { OLYMPIA_JUDGE_TARGETS } from './olympiaJudgeTargets.js';
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
 * 形态照各大手机厂的开机引导：**一个标题，一句描述，下面一个选择**。
 * 没有参数墙，没有预览面板，没有开关，没有命令行 —— 卡上只回答一个问题：
 * 「这一项你选哪个？」
 *
 * ## 三张卡，三件事
 *
 * 1. 选择评测环境 —— 代码交给哪台评测机编译运行；
 * 2. 调整代码字号 —— 长时间写代码时眼睛舒不舒服；
 * 3. 选择练习目录 —— 题目和解题代码放在哪个文件夹。
 *
 * 其余配置（优化等级、行高、缩略图、光标动画、内存上限、记录通过、提交前自检、
 * 拉题时建模板、代码片段等）**移出引导**，但设置里仍然可以改 ——
 * 引导期的每一个决定都会变成一次「以后还要去设置里翻」的负担。
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
 *  - 用户当前配置（`IConfigurationService`）。
 */

export interface IOlympiaOnboardingCardsDelegate {

	/** 切到下一张卡（最后一张时表示「开始」）。 */
	readonly onNext: () => void;

	/** 直接进入（跳过引导）。 */
	readonly onBeginEnter: () => void;
}

/**
 * 一个可选项。
 *
 * 「选中判定用的值」与「真正写进配置的值」分开：
 *
 *  - `value` 是**字符串**形态，用来和当前配置 `String()` 之后比较；
 *  - `configValue` 是真正写进配置的值。**数字和布尔类型的配置必须显式给**：
 *    `editor.fontSize` 的 schema 是 `number`，写字符串会被配置校验拒绝 ——
 *    `updateValue` 直接抛错，选择就永远存不下来。
 */
interface IOlympiaOnboardingChoice {

	/** 主标题：选什么。 */
	readonly label: string;

	/** 副说明（可选）：这一项是什么意思。 */
	readonly description?: string;

	/** 选中判定用的值（字符串形态）。 */
	readonly value: string;

	/** 真正写进配置的值；不填就写 `value`（字符串）。 */
	readonly configValue?: unknown;
}

/**
 * 一张卡的**描述**。
 *
 * 一张卡只对应**一个**配置项、一**个**选择列表 —— 这是「标题 + 描述 + 一个选择」
 * 这条产品线的直接结果，也是这套卡片比旧版简单得多的原因。
 */
interface IOlympiaOnboardingCardDescriptor {
	readonly id: 'compile' | 'editor' | 'practice';

	/** 卡上的标题。 */
	readonly title: string;

	/** 卡上的一句解释：这一项为什么值得现在决定。 */
	readonly description: string;

	/** 这一张卡写的是哪个配置键。 */
	readonly configurationKey: string;

	/** 下面的选择列表。 */
	readonly choices: readonly IOlympiaOnboardingChoice[];
}

/**
 * 一张卡在 DOM 上的**绑定**：结构归结构，状态归状态。
 *
 * 结构和状态分开不是为了「配置一变不硬切」—— 现在选择列表**只在构造期建一次**，
 * 运行期一个元素都不换。这里分开只是为了读得清楚：
 * 「有哪些选项」是结构，「选中了哪个」是状态。
 */
interface IOlympiaOnboardingCardBinding {

	/** 卡片容器本身。 */
	readonly element: HTMLElement;

	/** 「未保存」标记（平时是空的）。 */
	readonly unsavedElement: HTMLElement;

	/** 每一个可选项（与 DOM 里的按钮一一对应）。 */
	readonly choices: readonly { readonly element: HTMLElement; readonly value: string }[];
}

export class OlympiaOnboardingCards implements IDisposable {

	/** 补写重试的间隔（毫秒）。 */
	private static readonly FLUSH_RETRY_INTERVAL = 400;

	/**
	 * 补写重试的上限（次）。
	 *
	 * 400ms × 60 ≈ 24 秒，足够等内置扩展把 `olympia.*` 注册完。
	 * 到点还写不进去就放弃 —— 那是扩展的问题，不该把用户永远吊在这儿。
	 *
	 * 这里的「次」是**重试轮数**：由重试定时器驱动的轮次才计数，
	 * 用户随手点一下触发的补写不算（否则多戳两下就提前放弃）。
	 */
	private static readonly FLUSH_RETRY_LIMIT = 60;

	readonly element: HTMLElement;

	private readonly delegate: IOlympiaOnboardingCardsDelegate;

	private readonly trackElement: HTMLElement;
	private readonly cardElements: HTMLElement[] = [];
	private readonly dotElements: HTMLElement[] = [];
	private readonly footerElements: HTMLElement[] = [];

	/** 每张卡的绑定（与 `cardElements` 一一对应）。 */
	private readonly cardBindings: IOlympiaOnboardingCardBinding[] = [];

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
	 *
	 * 初值用 -1 而不是 0：rAF 时间戳是非负的单调时钟，0 也是合法取值。
	 * 拿合法域里的一个值当「还没渲染过」，等于赌「0 永不出现」。
	 */
	private lastFrameTime = -1;

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
	 * 这个 map 同时是「用户当前选择的真相」—— 卡片显示也优先读它。
	 */
	private readonly pendingWrites = new Map<string, unknown>();

	/**
	 * 用户**最后表达过**的意图，不管写进去没有。
	 *
	 * `pendingWrites` 会被消费掉 —— 写成功一次就删一次。于是它答不了
	 * 「这个键现在**应该**是什么值」。而这个答案在一种情况下是必需的：
	 * 一次卡住的写入被放弃之后又**迟到落地**，把配置盖回旧值；
	 * 那时候得拿它跟真值对一下，把用户的选择补写回去。
	 */
	private readonly lastIntended = new Map<string, unknown>();

	/**
	 * 正在写、还没回来的键，避免同一个键被重复写。
	 *
	 * 值是**这一次写入的代号**，不是单纯的「这个键在写」：
	 * 「放弃写入」会把键从表里摘掉，而**上一次**写入的 promise 之后还可能才回来 ——
	 * 它的 `finally` 如果照旧无脑 `delete(key)`，就会把**新一轮**写入的标记一起摘掉。
	 * 于是同一个键上跑起两个并发写入，配置最终落在谁手里全看完成顺序 ——
	 * 慢的那次会盖掉用户后来选的那个值。
	 *
	 * 代号对不上就不摘：标记只属于发起它的那一次写入。
	 */
	private readonly writingKeys = new Map<string, symbol>();

	/** 补写重试的帧计数（约每 30 帧试一次）。 */
	private flushCounter = 0;

	/**
	 * 补写重试的定时器。
	 *
	 * **故意不进 `disposables`** —— overlay 消失之后也得继续写。
	 * 用户点完卡片就点「开始」的话，内置扩展往往还没注册完，
	 * 这时 overlay 已经没了、rAF 也停了；没有这个重试，选择就白点了。
	 */
	private flushRetryTimer: number | null = null;

	/**
	 * 每个键各自**等了多少个重试轮**。
	 *
	 * 早先这里是**一个全局**计数，任一键写成功就把它清零。后果是：
	 * 一个键（比如配置项被上游删了）会永久失败，它带着别的键一起把额度耗光；
	 * 而它自己失败多少次，全被别的键的成功掩盖。额度耗尽后直接 `return` ——
	 * 用户的选择静默消失，控制台外没有任何痕迹。
	 *
	 * 改成 per-key 之后：写不进去的键自己算自己的账，到自己的上限就摘掉并明确报错，
	 * 不再拖累别的键。
	 *
	 * 计的是**轮**不是**次数**：额度承诺的是「400ms × 60 ≈ 24 秒」这个**时间预算**。
	 * 在途 / 未注册 / 写异常三条路径各算一轮，所以「这个键等了多久」和「额度还剩多少」
	 * 始终对得上 —— 按尝试次数算的话，一次在途跳过就能把预算拖长，
	 * 而一个永不 settle 的写入会让预算永远用不完。
	 */
	private readonly pendingWriteRounds = new Map<string, number>();

	/**
	 * 没能保存上的配置项 → 原因。
	 *
	 * 键是配置键，值是给用户看的原因（「配置 X 尚未注册」之类）。
	 * 空 = 没有没保存上的项；这张卡会因此显示「未保存」。
	 */
	private readonly unsavedKeys = new Map<string, string>();

	/**
	 * 进入动画**已经起跑**。
	 *
	 * 从这一刻起，卡片区的 DOM **结构**不许再变。
	 *
	 * 进入动画里卡片正在化成粒子、工作台正在从洞里长出来 ——
	 * 这时候把选择列表整个换掉（`replaceChildren`），
	 * 就是「全程没有断点」要防的那一帧硬切。
	 *
	 * 「状态」照旧可以就地改（选中态、「未保存」标记）——
	 * 那些不动 DOM 结构，不会造成跳变。
	 */
	private entering = false;

	private readonly disposables: IDisposable[] = [];

	constructor(
		delegate: IOlympiaOnboardingCardsDelegate,
		@IConfigurationService private readonly configurationService: IConfigurationService
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
			this.cardBindings.push(card.binding);
			this.footerElements.push(card.footer);
			this.trackElement.appendChild(card.element);
		}

		this.element.appendChild(this.createDots());
		this.element.appendChild(this.createNav());
		this.element.appendChild(this.createHint());

		// 页脚只建一次：它的内容（「还有几张」+ CTA）只跟卡片序号有关，跟配置无关。
		// 每次配置变化都重建它没有意义，只会把用户正按着的按钮换掉。
		for (let index = 0; index < OLYMPIA_ONBOARDING_CARD_COUNT; index++) {
			const descriptor = this.descriptorFor(index);
			for (const child of this.buildFooter(descriptor, index)) {
				this.footerElements[index].appendChild(child);
			}
		}

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
	 * 只在进入动画起跑时读一次（3 次布局读），不要每帧读。
	 */
	getCardRects(): readonly DOMRect[] {
		return this.cardElements.map(element => element.getBoundingClientRect());
	}

	/** 让卡片层整体淡出（进入动画开始时）。 */
	setVisible(visible: boolean): void {
		this.element.classList.toggle('hidden', !visible);
	}

	/**
	 * 进入动画起跑：从这一刻起，卡片区的 DOM **结构**冻结。
	 *
	 * 为什么要有这个开关：
	 *
	 *  - 扩展注册 `olympia.*` 配置项会连着触发 `onDidChangeConfiguration` → `refresh()`；
	 *    「放弃写入」的收场路径也会刷一次。
	 *    这些路径今天都只改**状态**，但它们是**未来**某个「整片重建」的唯一入口 ——
	 *    入口一旦存在，就必须在进入动画期间关上。
	 *  - 起跑那一帧 dissolve 还是 1，卡片是**看得见**的。用户正好按住它开始拖拽的话，
	 *    拖拽是挂在 window 上的 pointermove，会跟着手指继续跑，把正在化掉的卡片拖偏。
	 *    所以这里当场把指针事件掐掉，并把可能已经起手的拖拽复位。
	 */
	beginEnterAnimation(): void {
		this.entering = true;
		// 立刻断掉输入，不等下一帧。
		for (const element of this.cardElements) {
			element.style.pointerEvents = 'none';
		}
		this.dragging = false;
		this.dragDelta = 0;
		this.tween = null;
		this.trackElement.classList.remove('dragging');
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
			// 进入动画起跑后，卡片一律不再吃指针事件。
			// 只看 `layout.interactive` 不够：起跑那一帧 dissolve 还是 1，
			// interactive 还是 true —— 那一帧卡片看得见、点得动。
			const clickable = !this.entering && layout.interactive;
			element.style.pointerEvents = clickable ? 'auto' : 'none';
		}

		const active = olympiaOnboardingClamp(Math.round(effective), 0, this.cardElements.length - 1);
		for (let index = 0; index < this.dotElements.length; index++) {
			this.dotElements[index].classList.toggle('on', index === active);
		}
	}

	/** 跳到指定卡片（0 基）。 */
	goto(index: number): void {
		// 进入动画起跑后，轨道不许再动。
		// 正在化掉的卡片突然跳位（滚轮、翻页按钮、拖拽惯性）就是断点。
		// 所有位置变化都从这里出去，所以守在这里就够 —— step() 也走这条。
		if (this.entering) {
			return;
		}
		const target = olympiaOnboardingClamp(index, 0, this.cardElements.length - 1);
		this.positionTarget = target;
		if (this.lastFrameTime < 0) {
			// 还没渲染过第一帧 —— 没有「当前位置」可以补间。
			// 早先这里照样起补间，`start` 是 0，进度一步就冲到 1，
			// 卡片会从当前位置瞬移过去（跟手滑动的第一下就跳）。
			// 首帧之前本来也没有「当前画面」，直接定位到目标是最诚实的做法。
			this.position = target;
			this.tween = null;
			return;
		}
		this.tween = { from: this.position, to: target, start: this.lastFrameTime, duration: 460 };
	}

	/** 相对步进。 */
	step(delta: number): void {
		this.goto(Math.round(this.positionTarget) + delta);
	}

	/**
	 * 配置变化后刷新卡片内容。
	 *
	 * 只刷**状态**（选中哪个、这一项有没有保存上），不动结构：
	 * 选择列表的 DOM 在构造期就建好了，运行期一个元素都不换。
	 */
	refresh(): void {
		this.updateCardStates();
		void this.flushPendingWrites();
	}

	/**
	 * 就地更新每张卡的状态。
	 *
	 * 这一层是「配置一变不硬切」的关键：DOM 元素不动，只改类名和文本。
	 */
	private updateCardStates(): void {
		// 进入动画期间：卡片区**冻结**。
		// 卡片正在化成粒子，这时候去改结构就是「全程没有断点」要防的那一帧硬切。
		// 状态都改不得 —— 选中态一变也是一次可见的跳变。
		if (this.entering) {
			return;
		}
		for (let index = 0; index < OLYMPIA_ONBOARDING_CARD_COUNT; index++) {
			const descriptor = this.descriptorFor(index);
			const binding = this.cardBindings[index];
			if (!binding) {
				continue;
			}
			const current = this.readConfig(descriptor.configurationKey);
			for (const choice of binding.choices) {
				const selected = String(current) === choice.value;
				choice.element.classList.toggle('selected', selected);
				choice.element.setAttribute('aria-checked', String(selected));
			}
			this.updateCardUnsavedState(descriptor, binding);
		}
	}

	/**
	 * 把「这一项没能保存」如实说给用户。
	 *
	 * 写入失败只往 console 里写一句的话，界面上看不出任何区别 ——
	 * 用户点了「C++23」，配置写不进去，他看到的还是那个选中的选项，
	 * 于是以为配置生效了；等进了 IDE 才发现设置根本没变。
	 *
	 * 标记挂在**卡片**上（不在某个选项上）：一张卡只有一个配置项，
	 * 「没保存上」说的是这一整张卡的事；而挂在选项上时，
	 * 一旦选项列表被替换，提示会跟着消失。
	 */
	private updateCardUnsavedState(descriptor: IOlympiaOnboardingCardDescriptor, binding: IOlympiaOnboardingCardBinding): void {
		const reason = this.unsavedKeys.get(descriptor.configurationKey);
		if (reason) {
			binding.element.classList.add('olympia-onboarding-card-has-unsaved');
			binding.unsavedElement.textContent = localize('olympia.onboarding.row.unsaved', "未保存");
			binding.unsavedElement.title = reason;
			return;
		}
		binding.element.classList.remove('olympia-onboarding-card-has-unsaved');
		binding.unsavedElement.textContent = '';
		binding.unsavedElement.title = '';
	}

	dispose(): void {
		// 最后再试一次：overlay 消失时如果还有没写下去的选择，别白白丢掉。
		void this.flushPendingWrites();
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
		this.disposables.length = 0;
		this.unsavedKeys.clear();
		this.element.remove();
		// `flushRetryTimer` **故意不取消** —— 还没写下去的选择要继续写完，
		// 不能因为引导已经消失就把用户的选择丢掉（见 scheduleFlushRetry 的说明）。
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
	 * 把用户的选择写进配置。
	 *
	 * `olympia.*` 这些键属于内置扩展，扩展没扫描完之前 `updateValue` 会抛
	 * 「unknown configuration」。所以先把值记在 `pendingWrites` 里（它同时也是
	 * 「用户当前选择的真相」，卡片读它），等扩展注册完再补写 ——
	 * 否则用户的选择永远存不下来。
	 */
	private async writeConfig(key: string, value: unknown): Promise<void> {
		// 用户又点了一次 —— 上一轮「没保存上」的标记先撤掉。
		// 这次要是又写不进去，`abandonWriteIfExhausted` 会重新标上。
		this.unsavedKeys.delete(key);
		this.pendingWrites.set(key, value);
		// 意图单独记一份 —— 待写值会被消费掉，但「用户最后想要什么」不能跟着消失。
		this.lastIntended.set(key, value);
		await this.flushPendingWrites();
	}

	/**
	 * 扩展注册完配置后，把之前攒着的写入补上。
	 *
	 * `isRetryRound` 区分「用户随手点了一下」和「重试定时器又转了一圈」：
	 *
	 *  - **重试轮**才消耗额度（`pendingWriteRounds`）。额度承诺的是
	 *    「400ms × 60 ≈ 24 秒」——那是**重试轮数**，不是用户点击次数。
	 *    如果每次点击都计数，用户多戳两下就会提前放弃，24 秒的承诺变成几秒。
	 *  - 非重试轮只是「顺手试一次」，不计数，但一样会把重试定时器续上。
	 *
	 * 额度按**轮**消耗，而且**每个还在等的键每一轮都消耗** ——
	 * 不管这一轮它到底写没写成功。三条分支（在途 / 未注册 / 写异常）
	 * 走的都是同一个计数器，所以「等了多少轮」和「额度还剩多少」始终对得上。
	 */
	private async flushPendingWrites(isRetryRound: boolean = false): Promise<void> {
		for (const key of [...this.pendingWrites.keys()]) {
			// 本轮看到的待写值 —— 放弃写入时靠它判断「用户是不是又改过了」。
			const pendingValue = this.pendingWrites.get(key);
			if (this.writingKeys.has(key)) {
				// 正在写 —— 但**这一轮照样消耗额度**。
				// 不消耗的话有两个洞：
				//   ① 一次正常的在途写入就能白嫖掉一轮，24 秒的承诺被拖长；
				//   ② 写入的 promise 永不 settle 时（配置服务抽风），这个键每一轮都被跳过，
				//      配额永远用不完 —— 「到点就放弃」的承诺就彻底破了（变成无限心跳）。
				if (isRetryRound) {
					this.abandonWriteIfExhausted(key, `配置 ${key} 的写入还没回来`, undefined, pendingValue);
				}
				continue;
			}
			const value = pendingValue;
			if (value === undefined) {
				// 没有值可写。留着它只会让重试定时器永远停不下来。
				this.pendingWrites.delete(key);
				this.pendingWriteRounds.delete(key);
				continue;
			}
			if (this.configurationService.getValue(key) === undefined) {
				// 扩展还没注册这个键 —— 现在写下去必定抛「unknown configuration」。
				// 这里**不能**直接跳过：跳过就没有下一次尝试了，用户的选择会永远存不下来。
				// 但也不能无限重试：这条路径以前**不计数**，于是「400ms × 60」的额度承诺
				// 在这里根本不成立 —— 扩展永远不注册，就永远重试下去。
				if (isRetryRound) {
					if (this.abandonWriteIfExhausted(key, `配置 ${key} 尚未注册（内置扩展还没注册这个配置项）`, undefined, value)) {
						continue;
					}
				}
				this.scheduleFlushRetry();
				continue;
			}
			// 这次写入的**代号** —— `finally` 里只摘自己发起的那一次。
			const writeToken = Symbol(key);
			this.writingKeys.set(key, writeToken);
			try {
				await this.configurationService.updateValue(key, value, ConfigurationTarget.USER);
				// 期间用户又改过的话，留着新值，下一轮再写 —— 别把新选择抹掉。
				if (this.pendingWrites.get(key) === value) {
					this.pendingWrites.delete(key);
				}
				this.pendingWriteRounds.delete(key);
				// 写进去了，之前那句「没保存上」就不成立了。
				this.unsavedKeys.delete(key);
			} catch (error) {
				// 还是写不进去 —— 留在 map 里，等下一轮。
				// 这里必须留痕：静默吞掉的话，用户点了「开始」却发现设置没变，
				// 而我们连「为什么」都不知道。
				if (isRetryRound) {
					if (this.abandonWriteIfExhausted(key, `配置 ${key} 写入失败：${error}`, error, value)) {
						continue;
					}
				}
				this.scheduleFlushRetry();
			} finally {
				// 只摘**自己发起的那一次**。
				if (this.writingKeys.get(key) === writeToken) {
					this.writingKeys.delete(key);
				} else {
					// 这次写入已经被放弃（或已经被新一轮接管）了。
					// 它要是最后真的落地，写的可能是**过时**的值 —— 得把用户的选择补写回去。
					this.rewriteIfStale(key, value);
				}
			}
		}
		// 还有没写下去的键，就一定要有下一次尝试。
		// 上面每个 `continue` 分支都可能提前退出这一轮 —— 如果不在这里统一续上，
		// 一个键放弃写入就会把**别的**键的重试链一起掐断。
		if (this.pendingWrites.size > 0) {
			this.scheduleFlushRetry();
		}
	}

	/**
	 * 记一轮账，并在额度用尽时收场。
	 *
	 * **每一轮都调用它**（在途 / 未注册 / 写异常三条分支都调），所以计数和
	 * 「这个键等了多久」始终一致 —— 额度是**时间预算**（400ms × 60 ≈ 24 秒），
	 * 不是「尝试次数」。按尝试次数算的话，一次在途跳过就能把预算拖长，
	 * 而一个永不 settle 的写入会让预算永远用不完。
	 *
	 * 返回 true 表示「已经放弃写入」，调用方不要再往下走。
	 *
	 * 摘掉之后 `readConfig()` 会回到配置真值 —— 但**界面不会自己变**：
	 * 选中态还停在用户刚点的那个选项上，不刷一次的话界面就在撒谎。
	 * 这里刷卡片状态，但**不**走 `refresh()`：它会再触发一轮写入，形成递归。
	 */
	private abandonWriteIfExhausted(key: string, reason: string, error?: unknown, attemptedValue?: unknown): boolean {
		const rounds = (this.pendingWriteRounds.get(key) ?? 0) + 1;
		this.pendingWriteRounds.set(key, rounds);
		if (rounds === 1 || rounds % 10 === 0) {
			console.warn(`[Olympia] ${reason}（第 ${rounds} 轮）`);
		}
		if (rounds < OlympiaOnboardingCards.FLUSH_RETRY_LIMIT) {
			return false;
		}
		console.error(`[Olympia] 配置 ${key} 等了 ${rounds} 轮还没写进去，已放弃写入：${error === undefined ? reason : String(error)}`);
		// 只摘**用户还没改过**的那个待写值。
		// 用户在这 24 秒里又点了一次（待写值换成了新的）的话，新值还得写进去 ——
		// 跟着旧值一起摘掉的话，用户刚点的选择就白点了。
		if (this.pendingWrites.get(key) === attemptedValue) {
			this.pendingWrites.delete(key);
			// **说给用户听** —— 只写 console 的话，界面跟没事一样，
			// 用户以为自己的选择生效了（见 updateCardUnsavedState 的说明）。
			// 放在这个 if 里面：用户后来又改过的话，新值还在写，
			// 旧值的失败不该算到新值头上。
			this.unsavedKeys.set(key, reason);
			// 这个意图已经彻底放弃了 —— 留着它，迟到的写入会拿它当「用户还想要」，
			// 把一个用户已经不想要的旧值又补写回去。
			this.lastIntended.delete(key);
		}
		// 留下的（用户改过的）新值算**另一次尝试**，给它自己的预算 ——
		// 不然新值只配捡旧值的残羹。
		this.pendingWriteRounds.delete(key);
		// 卡死的写入也别占着这个键 —— 不然用户后来再点同一个选项，
		// 写入会被「正在写」挡住，他的选择就白点了。
		//
		// 摘的时候**代号**也一起失效：旧写入回来时 `finally` 发现代号对不上，
		// 就不会把新一轮写入的标记误摘掉（那会造成同一个键并发写）。
		this.writingKeys.delete(key);
		this.updateCardStates();
		return true;
	}

	/**
	 * 一次**被放弃**的写入最后真的落地了 —— 而且它写的值已经过时。
	 *
	 * 时序：写入卡住 → 24 秒后放弃（键被摘掉）→ 用户又点了同一项 → 新一轮写入先完成
	 * → 旧写入这时才回来，把配置盖回**旧值**。用户看到的是「我选了 B，设置里却是 A」。
	 *
	 * 所以旧写入落地时要比一下「用户最后想要什么」和「现在实际是什么」：
	 * 不一致就把用户的选择补写回去。
	 *
	 * 写入**失败**走到这里不会重复排队 —— 失败时写的值就是用户想要的值，
	 * 两者相等，直接返回。
	 */
	private rewriteIfStale(key: string, writtenValue: unknown): void {
		const intended = this.lastIntended.get(key);
		if (intended === undefined || intended === writtenValue) {
			return;
		}
		if (this.configurationService.getValue(key) === intended) {
			return;
		}
		this.pendingWrites.set(key, intended);
		this.pendingWriteRounds.delete(key);
		this.scheduleFlushRetry();
	}

	/**
	 * 安排下一次补写重试。
	 *
	 * 这个定时器**不进 `disposables`** —— overlay 消失之后也得继续写。
	 * 用户点完卡片就点「开始」的话，内置扩展往往还没注册完，
	 * 这时 overlay 已经没了、rAF 也停了；没有这个重试，选择就白点了。
	 */
	private scheduleFlushRetry(): void {
		if (this.flushRetryTimer !== null || this.pendingWrites.size === 0) {
			return;
		}
		// 额度是**每个键各自的**（见 `pendingWriteRounds`）——
		// 这里不再有一道全局闸门，否则一个永远写不进去的键会把别的键一起拖死。
		this.flushRetryTimer = mainWindow.setTimeout(() => {
			this.flushRetryTimer = null;
			// 定时器驱动的这一轮才消耗重试额度（见 flushPendingWrites 的说明）。
			void this.flushPendingWrites(true);
		}, OlympiaOnboardingCards.FLUSH_RETRY_INTERVAL);
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
			// 进入动画起跑后，轨道不再接受新的按压。
			// 卡片自己已经 pointer-events: none，但按压事件挂在整条轨道上 ——
			// 不挡的话，起跑后按下轨道会重新置上 dragging，手感像还活着。
			if (this.entering) {
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
			if (!this.dragging || this.entering) {
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
			default: return this.practiceCard();
		}
	}

	/**
	 * 第一张卡：选评测机。
	 *
	 * 选项的副说明是**评测机表里的真实值**（GCC 版本 + C++ 标准），
	 * 不是设计稿里手写的数字 —— 表里没有的数字不许出现在卡上。
	 */
	private compileCard(): IOlympiaOnboardingCardDescriptor {
		return {
			id: 'compile',
			title: localize('olympia.onboarding.compile.title', "选择评测环境"),
			description: localize('olympia.onboarding.compile.description', "你写的代码会交给评测机编译和运行。选一个你平时比赛用的环境就够了。"),
			configurationKey: OLYMPIA_CONFIG_COMPILER_PROFILE,
			choices: OLYMPIA_JUDGE_TARGETS.map(candidate => ({
				label: candidate.label,
				description: localize('olympia.onboarding.compile.judge.description', "GCC {0} · {1}", candidate.gcc, candidate.std.toUpperCase()),
				value: candidate.id
			}))
		};
	}

	/**
	 * 第二张卡：代码字号。
	 *
	 * `editor.fontSize` 的 schema 是 `number`，所以每个选项都必须带
	 * `configValue`（数字）—— 写字符串会被配置校验拒绝。
	 */
	private editorCard(): IOlympiaOnboardingCardDescriptor {
		const sizes: readonly { readonly size: number; readonly description: string }[] = [
			{ size: 12, description: localize('olympia.onboarding.editor.fontSize.compact', "紧凑，一屏能看更多代码") },
			{ size: 13, description: localize('olympia.onboarding.editor.fontSize.small', "偏小") },
			{ size: 14, description: localize('olympia.onboarding.editor.fontSize.standard', "标准") },
			{ size: 16, description: localize('olympia.onboarding.editor.fontSize.large', "大字号，看得更清楚") }
		];
		return {
			id: 'editor',
			title: localize('olympia.onboarding.editor.title', "调整代码字号"),
			description: localize('olympia.onboarding.editor.description', "编辑器里代码显示多大，直接影响你长时间写代码时眼睛的舒适度。"),
			configurationKey: OLYMPIA_CONFIG_EDITOR_FONT_SIZE,
			choices: sizes.map(entry => ({
				label: String(entry.size),
				description: entry.description,
				value: String(entry.size),
				configValue: entry.size
			}))
		};
	}

	/**
	 * 第三张卡：练习目录。
	 *
	 * 两个选项都是**真实会写进配置**的目录名；默认值
	 * `.olympia/problems` 是扩展 `package.json` 里的默认值。
	 */
	private practiceCard(): IOlympiaOnboardingCardDescriptor {
		return {
			id: 'practice',
			title: localize('olympia.onboarding.practice.title', "选择练习目录"),
			description: localize('olympia.onboarding.practice.description', "你的题目和解题代码会放在这个文件夹里。放哪都行，找得到就好。"),
			configurationKey: OLYMPIA_CONFIG_PROBLEMS_DIR,
			choices: [
				{
					label: '.olympia/problems',
					description: localize('olympia.onboarding.practice.dir.hidden', "默认 · 隐藏文件夹"),
					value: '.olympia/problems'
				},
				{
					label: 'problems',
					description: localize('olympia.onboarding.practice.dir.plain', "普通文件夹"),
					value: 'problems'
				}
			]
		};
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
		// 文案说的是「跳过**剩下**的引导」——
		// 因为点选项就已经把选择写进配置了，这个按钮只是不再往下走流程，
		// 已经选好的照旧生效。说「跳过引导」会让人以为自己的选择被丢了。
		skip.textContent = localize('olympia.onboarding.skip', "跳过剩余引导");
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

	private createCard(index: number): { element: HTMLElement; binding: IOlympiaOnboardingCardBinding; footer: HTMLElement } {
		const descriptor = this.descriptorFor(index);

		const element = document.createElement('div');
		element.className = 'olympia-onboarding-card';
		element.dataset.card = String(index);

		const header = document.createElement('div');
		header.className = 'olympia-onboarding-card-header';
		const title = document.createElement('h2');
		title.className = 'olympia-onboarding-card-title';
		title.textContent = descriptor.title;
		header.appendChild(title);
		const description = document.createElement('p');
		description.className = 'olympia-onboarding-card-description';
		description.textContent = descriptor.description;
		header.appendChild(description);
		element.appendChild(header);

		// 「未保存」标记挂在**卡片**上，不挂在某个选项上 ——
		// 一张卡只有一个配置项，「没保存上」说的是这一整张卡的事。
		const unsaved = document.createElement('p');
		unsaved.className = 'olympia-onboarding-card-unsaved';
		element.appendChild(unsaved);

		const choices = this.buildChoices(descriptor);
		element.appendChild(choices.container);

		const footer = document.createElement('div');
		footer.className = 'olympia-onboarding-card-footer';
		element.appendChild(footer);

		return { element, binding: { element, unsavedElement: unsaved, choices: choices.items }, footer };
	}

	/**
	 * 建出选择列表。
	 *
	 * 结构是**竖排单选**：一个 `radiogroup`，里面每个可选项是一个 `role="radio"`
	 * 的按钮（20px 的圆点标记 + 主标题 + 副说明）。
	 *
	 * 这个列表**只在构造期建一次**，运行期不重建 —— 重建就意味着
	 * 用户手指正按着的那个按钮会被整个换掉，换掉的一瞬间就是硬切。
	 */
	private buildChoices(descriptor: IOlympiaOnboardingCardDescriptor): { container: HTMLElement; items: { element: HTMLElement; value: string }[] } {
		const container = document.createElement('div');
		container.className = 'olympia-onboarding-choices';
		container.setAttribute('role', 'radiogroup');
		container.setAttribute('aria-label', descriptor.title);
		const items: { element: HTMLElement; value: string }[] = [];
		for (const choice of descriptor.choices) {
			const button = document.createElement('button');
			button.className = 'olympia-onboarding-choice';
			button.type = 'button';
			button.setAttribute('role', 'radio');
			button.setAttribute('aria-checked', 'false');
			button.dataset.value = choice.value;

			const marker = document.createElement('span');
			marker.className = 'olympia-onboarding-choice-marker';
			button.appendChild(marker);

			const text = document.createElement('span');
			text.className = 'olympia-onboarding-choice-text';
			const label = document.createElement('span');
			label.className = 'olympia-onboarding-choice-label';
			label.textContent = choice.label;
			text.appendChild(label);
			if (choice.description) {
				const hint = document.createElement('span');
				hint.className = 'olympia-onboarding-choice-description';
				hint.textContent = choice.description;
				text.appendChild(hint);
			}
			button.appendChild(text);

			button.addEventListener('click', event => {
				event.stopPropagation();
				// 立刻改选中态。配置写下去是异步的（`olympia.*` 还要等扩展注册），
				// 等配置事件再改，用户会觉得「点了没反应」。
				for (const sibling of items) {
					sibling.element.classList.remove('selected');
					sibling.element.setAttribute('aria-checked', 'false');
				}
				button.classList.add('selected');
				button.setAttribute('aria-checked', 'true');
				// 数字型配置（字号）写字符串会被 schema 拒绝 —— 必须写数字。
				const value = choice.configValue !== undefined ? choice.configValue : choice.value;
				// 先写：`writeConfig` 会同步把值记进 `pendingWrites`，
				// 卡片读的就是它 —— 顺序反了会先刷出旧值。
				void this.writeConfig(descriptor.configurationKey, value);
				// 刷新整张卡：选中态与「未保存」标记一起刷。
				this.refresh();
			});

			items.push({ element: button, value: choice.value });
			container.appendChild(button);
		}
		return { container, items };
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
				? localize('olympia.onboarding.card.ready', "准备就绪")
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

	//#endregion
}
