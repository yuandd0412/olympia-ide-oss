/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/olympiaSettings.css';

import { localize } from '../../../../nls.js';
import { $, append, clearNode, Dimension, EventType, IDomPosition } from '../../../../base/browser/dom.js';
import { ISelectOptionItem, SelectBox } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { Toggle, unthemedToggleStyles } from '../../../../base/browser/ui/toggle/toggle.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { defaultSelectBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { IWorkbenchColorTheme, IWorkbenchThemeService } from '../../../services/themes/common/workbenchThemeService.js';
import { IOlympiaSettingControl, OLYMPIA_SETTINGS_GROUPS, olympiaSettingControls } from './olympiaSettingsSchema.js';
import { OlympiaSettingsInput } from './olympiaSettingsInput.js';

/**
 * Olympia 简化设置页。
 *
 * ## 这是什么
 *
 * 一张**取代**原生设置页（`workbench.action.openSettings`）的自绘页面。
 * 页面上的每一项都绑定**真实的 configuration key**，改完立刻生效。
 *
 * ## 为什么不做成 webview
 *
 * webview 要多一套 CSP / 消息通道 / 资源 URI 的来回，改一次配置要走 postMessage。
 * 而这一页要读写的全是 VS Code 自己的配置项 —— 直接用 `IConfigurationService`
 * 在同一个渲染进程里读写，是最短的路径，也是最短的出错路径。
 *
 * ## 逃生口
 *
 * 页面底部有「高级设置」按钮，执行 `workbench.action.openSettings2` 打开**原生**设置页。
 * 这是刻意保留的：简化页只覆盖高频项，剩下几千个上游配置项仍然要能到达。
 * 把原生页彻底封死，等于「功能存在但找不到」，那比不做替换更糟。
 */
export class OlympiaSettingsPage extends EditorPane {

	public static readonly ID = 'olympiaSettingsPage';

	/** 高级设置按钮执行的命令 id。原生设置页永远保留。 */
	static readonly OPEN_NATIVE_SETTINGS_COMMAND_ID = 'workbench.action.openSettings2';

	private container: HTMLElement | undefined;

	/** 主题清单。1.140 的 getColorThemes() 是异步的，所以这里缓存一份已取到的。 */
	private colorThemes: readonly IWorkbenchColorTheme[] = [];

	/** 主题清单只取一次。取到之后靠 render() 重画补上。 */
	private colorThemesRequested = false;

	/** 每个分组对应的区块元素。导航点击时直接拿它滚过去，不用回头查选择器。 */
	private readonly sectionElements = new Map<string, HTMLElement>();

	/** 导航按钮。用于「取消上一个高亮」。 */
	private readonly navItems: HTMLButtonElement[] = [];

	/**
	 * 每一次重画都要重建的部件。
	 *
	 * 目前只有下拉框（SelectBox 是 Widget，自带监听器和 ContextView 弹层）。
	 * 页面会因为配置变化整体重画 —— 不释放上一轮的话，监听器会一次次叠加，
	 * 用户改一次配置就多一份回调，最后表现为「点一下下拉跳好几次」。
	 */
	private readonly renderDisposables: DisposableStore;

	get editorInput(): OlympiaSettingsInput | undefined {
		return this._input as OlympiaSettingsInput | undefined;
	}

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IWorkbenchThemeService protected override readonly themeService: IWorkbenchThemeService,
		@IStorageService storageService: IStorageService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ICommandService private readonly commandService: ICommandService,
		@IContextViewService private readonly contextViewService: IContextViewService,
	) {
		super(OlympiaSettingsPage.ID, group, telemetryService, themeService, storageService);
		this.renderDisposables = this._register(new DisposableStore());
	}

	protected override createEditor(parent: HTMLElement): void {
		this.container = $('.olympiaSettings', {
			role: 'document',
			tabindex: 0,
			'aria-label': localize('olympiaSettingsAriaLabel', "Olympia 设置。")
		});
		parent.appendChild(this.container);

		// 主题清单是异步的：先画一版（主题下拉暂时只有「跟随系统」），取到之后再重画一次。
		this.loadColorThemes();
		this.render();

		// 配置变了就把页面重画一次 —— 主题、下拉、开关都要跟着变。
		// 监听的是**本页涉及的那批 key**，不是全量：全量监听会在任何设置变动时
		// 重画整页，代价大且会打断用户正在输入的输入框。
		const affected = olympiaSettingControls().map(c => c.key);
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			// affectsConfiguration 只接受单个 section —— 1.140 的签名没有数组重载。
			// 逐个问一次比监听全量配置便宜得多（只对本页这几十个 key 有反应）。
			if (affected.some(key => e.affectsConfiguration(key))) {
				this.render();
			}
		}));
	}

	public override clearInput(): void {
		super.clearInput();
		// **故意不清 DOM**。
		//
		// 上游 editorPanes.ts 的 doHideActiveEditorPane() 在隐藏编辑器时会调 clearInput()；
		// 而把同一个编辑器再显示出来时，doShowEditor() 走的是 inputMatches 分支 ——
		// 只调 setOptions()，**不会**再调 setInput()。
		// 所以这里如果把 DOM 清了，页面就再也画不回来了（用户第二次打开设置是一片空白）。
		//
		// 本页内容是「schema + 当前配置值」推导出来的，没有随 input 变化的状态，
		// 不清 DOM 也不会泄漏什么。
	}

	public override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		// 重新画一遍：clearInput() 可能已经把内容清掉了，也可能配置在编辑器隐藏期间被改过。
		this.render();
	}

	// 本页内容高度不固定（分组的行数会随版本变），滚动交给容器自己处理。
	layout(dimension: Dimension, position?: IDomPosition): void {
		// no-op
	}

	// -------------------------------------------------------------------------
	// 渲染
	// -------------------------------------------------------------------------

	private render(): void {
		const container = this.container;
		if (!container) {
			return;
		}
		// 先释放上一轮的下拉框，再清 DOM —— 顺序反了会留下没被 dispose 的 Widget。
		this.renderDisposables.clear();
		clearNode(container);

		const nav = $('.olympiaSettings-nav');
		const body = $('.olympiaSettings-body');

		// 元素是我们自己建的，所以直接持有引用 —— 不用 querySelector 回头找。
		// 上游 eslint 的 no-restricted-syntax 明令禁止在 workbench 代码里用选择器。
		this.sectionElements.clear();
		this.navItems.length = 0;

		for (const group of OLYMPIA_SETTINGS_GROUPS) {
			const section = $('.olympiaSettings-group');
			section.dataset.group = group.id;
			append(section, $('h2.olympiaSettings-groupTitle', {}, group.title));

			for (const control of group.controls) {
				append(section, this.renderControl(control));
			}

			append(body, section);
			this.sectionElements.set(group.id, section);

			const navItem = $<HTMLButtonElement>('button.olympiaSettings-navItem');
			navItem.textContent = group.title;
			navItem.dataset.group = group.id;
			navItem.type = 'button';
			navItem.addEventListener(EventType.CLICK, () => {
				this.sectionElements.get(group.id)?.scrollIntoView({ block: 'start' });
				for (const item of this.navItems) {
					item.classList.remove('olympiaSettings-navItem-active');
				}
				navItem.classList.add('olympiaSettings-navItem-active');
			});
			this.navItems.push(navItem);
			append(nav, navItem);
		}

		/*
		 * 三块的顺序：导航 → 内容 → 底栏。
		 *
		 * 底栏**必须挂在 container 上**，不能塞进 body：
		 * body 是可滚动的（overflow-y: auto），塞进去就成了内容的一部分，
		 * 滚到底才看得到 —— 而底栏的语义是「一直贴在底部」。
		 * CSS 里 .olympiaSettings 是 grid（两列两行），footer 占第二行，天然贴底。
		 */
		append(container, nav);
		append(container, body);
		append(container, this.renderFooter());
	}

	private renderControl(control: IOlympiaSettingControl): HTMLElement {
		const row = $('.olympiaSettings-row');
		row.dataset.key = control.key;

		const labelBox = $('.olympiaSettings-rowLabel');
		const controlId = `olympia-setting-${control.key.replace(/[^a-zA-Z0-9]+/g, '-')}`;
		const label = $<HTMLLabelElement>('label', {}, control.label);
		label.htmlFor = controlId;
		append(labelBox, label);
		if (control.description) {
			append(labelBox, $('.olympiaSettings-rowDesc', {}, control.description));
		}
		append(row, labelBox);

		const controlBox = $('.olympiaSettings-rowControl');
		switch (control.type) {
			case 'boolean':
				append(controlBox, this.renderBoolean(control, controlId));
				break;
			case 'number':
				append(controlBox, this.renderNumber(control, controlId));
				break;
			case 'enum':
				append(controlBox, this.renderEnum(control, controlId));
				break;
			case 'theme':
				append(controlBox, this.renderTheme(control, controlId));
				break;
			case 'array':
				append(controlBox, this.renderArray(control, controlId));
				break;
			case 'string':
			default:
				append(controlBox, this.renderString(control, controlId));
				break;
		}
		append(row, controlBox);

		return row;
	}

	/**
	 * 布尔开关。
	 *
	 * **不用原生 `<input type="checkbox">`** —— 两个原因：
	 *
	 * 1. 上游的 `$()` helper（src/vs/base/browser/dom.ts:1445 的 SELECTOR_REGEX）
	 *    只解析 tag / id / class 三段，`input[type=checkbox]` 里的属性段会被**静默丢弃**：
	 *    不报错，但元素上根本没有 type 属性 → 渲染出来是一个**没有类型的文本框**。
	 *    真机上 16 个布尔项全部变成文本框，就是这么来的。
	 * 2. 原生 checkbox 的外观不受工作台主题控制（白底浅色方块），
	 *    和整页自绘控件不是一套皮。
	 *
	 * 改用上游 `Toggle`（原生设置页用的同一个控件）：
	 * 自绘勾号、支持点击 / 空格 / 回车切换、颜色随主题走。
	 * 外观按原生设置页的 `.setting-value-checkbox` 对齐（见 media/olympiaSettings.css）。
	 */
	private renderBoolean(control: IOlympiaSettingControl, controlId: string): HTMLElement {
		const toggle = new Toggle({
			icon: Codicon.check,
			actionClassName: 'olympiaSettings-checkbox',
			isChecked: this.readValue(control) === true,
			title: control.label,
			...unthemedToggleStyles
		});
		toggle.domNode.id = controlId;
		toggle.domNode.setAttribute('aria-label', control.label);

		// Toggle 自己处理点击 / 空格 / 回车，这里只订阅变化。
		this.renderDisposables.add(toggle);
		this.renderDisposables.add(toggle.onChange(() => {
			this.writeValue(control, toggle.checked);
		}));

		return toggle.domNode;
	}

	private renderString(control: IOlympiaSettingControl, controlId: string): HTMLElement {
		// `$('input[type=text]')` 里的属性段会被上游 `$()` **静默丢弃** →
		// 元素上没有 type 属性 → 退回浏览器默认外观（白底浅字）。
		// 类型在这里显式设死，样式按自有 class 选。
		const input = $<HTMLInputElement>('input');
		input.type = 'text';
		input.classList.add('olympiaSettings-input');
		input.id = controlId;
		const current = this.readValue(control);
		input.value = typeof current === 'string' ? current : '';
		if (control.placeholder) {
			input.placeholder = control.placeholder;
		}
		// 用 CHANGE 而不是 INPUT：每敲一个键就写一次配置会把配置文件写爆，
		// 而且会触发全局 onDidChangeConfiguration —— 自己写进去的值把自己读回来，
		// 正在输入的输入框会被重画清空。
		input.addEventListener(EventType.CHANGE, () => this.writeValue(control, input.value));
		return input;
	}

	private renderNumber(control: IOlympiaSettingControl, controlId: string): HTMLElement {
		// 同样是先设死 type —— 否则 min/max 约束根本不会生效。
		// 与原生设置页一致（preferences/browser/settingsTree.ts:2007 用的是 type: 'number'）。
		const input = $<HTMLInputElement>('input');
		input.type = 'number';
		input.classList.add('olympiaSettings-input');
		input.id = controlId;
		if (typeof control.min === 'number') {
			input.min = String(control.min);
		}
		if (typeof control.max === 'number') {
			input.max = String(control.max);
		}
		const current = this.readValue(control);
		input.value = typeof current === 'number' && Number.isFinite(current) ? String(current) : '';
		input.addEventListener(EventType.CHANGE, () => {
			const parsed = Number(input.value);
			// 空串 Number('') === 0 —— 那会把「清空」悄悄变成「设成 0」。
			if (input.value.trim() === '' || !Number.isFinite(parsed)) {
				return;
			}
			this.writeValue(control, parsed);
		});
		return input;
	}

	/**
	 * 枚举下拉。
	 *
	 * **不用原生 `<select>`**。
	 *
	 * 原生 `<select>` 在暗色主题下展开就是**系统弹窗**：白底白字 / 白底黑字，
	 * 跟工作台完全是两套皮，而且弹层不受工作台主题控制 —— 这正是用户点名的红线。
	 * 这里改用上游 `SelectBox`（`vs/base/browser/ui/selectBox`），
	 * 它是 **VS Code 原生设置页用的同一个控件**：展开的是自绘列表，
	 * 颜色取 `dropdown.background` / `dropdown.border` / `list.*`，
	 * 和整个工作台（含原生设置页）完全一致。
	 */
	private renderEnum(control: IOlympiaSettingControl, controlId: string): HTMLElement {
		const values = control.enumValues ?? [];
		const current = this.readValue(control);

		// 选项表：下拉框只回「索引」，真正的值必须自己按索引取回来。
		const options: { value: string; label: string }[] = values.map(v => ({ value: v.value, label: v.label }));

		// 当前值不在枚举里（用户手改过 settings.json，或对应扩展被移除）：
		// 补一个同名选项，**原样显示**，而不是把它改写成第一个枚举值 ——
		// 那是在用户没操作的情况下改掉他的配置。
		if (typeof current === 'string' && current !== '' && !values.some(v => v.value === current)) {
			options.push({ value: current, label: current });
		}

		return this.renderDropdown(options, this.indexOfValue(options, current), control, controlId);
	}

	/**
	 * 主题下拉。
	 *
	 * 和枚举下拉一样走 `SelectBox`，理由同上。
	 * 主题的**值必须是 settingsId** —— `workbench.colorTheme` 的枚举值就是 settingsId
	 * （见 themeConfiguration.ts 里 colorThemeSettingEnum 的构造）。
	 * 用 theme.id 写进去，配置值对不上任何主题，回读时找不到当前主题。
	 */
	private renderTheme(control: IOlympiaSettingControl, controlId: string): HTMLElement {
		const options: { value: string; label: string }[] = [
			{ value: '', label: localize('olympiaSettings.theme.system', "跟随系统") }
		];

		for (const theme of this.colorThemes) {
			options.push({ value: theme.settingsId, label: theme.label });
		}

		const current = this.readValue(control);
		let selectedIndex = this.indexOfValue(options, current);
		if (selectedIndex < 0 && typeof current === 'string' && current !== '') {
			// 主题被卸载时，列表里没有它 → 补一项。
			// 不补的话下拉框会显示「跟随系统」，但配置还指着那个不存在的主题 ——
			// 显示与真实状态不一致，用户会以为自己改过主题。
			options.push({ value: current, label: current });
			selectedIndex = options.length - 1;
		}

		return this.renderDropdown(options, selectedIndex < 0 ? 0 : selectedIndex, control, controlId);
	}

	/** 在选项表里找当前值的位置；找不到返回 -1。 */
	private indexOfValue(options: { value: string; label: string }[], current: unknown): number {
		if (typeof current !== 'string') {
			return -1;
		}
		return options.findIndex(o => o.value === current);
	}

	/**
	 * 画一个下拉框。
	 *
	 * 用上游 `SelectBox`，并且**强制** `useCustomDrawn: true`：
	 * 上游默认在 macOS 上会用原生 `<select>`（系统弹窗），只有显式要求才走自绘列表。
	 * 展开的列表由 ContextView 挂在工作台根上，不受滚动容器裁剪，
	 * 颜色/圆角/焦点态全部跟原生设置页一致。
	 */
	private renderDropdown(options: { value: string; label: string }[], selectedIndex: number, control: IOlympiaSettingControl, controlId: string): HTMLElement {
		const wrapper = $('.olympiaSettings-dropdown');

		const selectBox = new SelectBox(
			options.map(o => ({ text: o.label } satisfies ISelectOptionItem)),
			selectedIndex,
			this.contextViewService,
			defaultSelectBoxStyles,
			{
				useCustomDrawn: true,
				ariaLabel: control.label
			}
		);
		this.renderDisposables.add(selectBox);
		selectBox.render(wrapper);

		// 标签的 htmlFor 要指向真实控件。SelectBox 渲染出来的 <select> 自己没有 id，
		// 这里从 wrapper 的第一个子元素上取（不用 querySelector：上游 eslint 明令禁止）。
		const select = wrapper.firstElementChild as HTMLElement | null;
		if (select) {
			select.id = controlId;
		}

		this.renderDisposables.add(selectBox.onDidSelect(e => {
			const picked = options[e.index];
			if (!picked) {
				return;
			}
			this.writeValue(control, picked.value);
		}));

		return wrapper;
	}

	/**
	 * 取一次主题清单，取到后重画整页。
	 *
	 * 只在首次需要时取 —— 主题清单不会在会话中途变成另一种东西，
	 * 而每一页重画都去 await 一次异步调用会让重画出现可见的延迟。
	 */
	private loadColorThemes(): void {
		if (this.colorThemesRequested) {
			return;
		}
		this.colorThemesRequested = true;
		this.themeService.getColorThemes().then(themes => {
			this.colorThemes = themes;
			this.render();
		}, () => {
			// 取不到主题就只留「跟随系统」，不能让整页崩掉。
			this.colorThemes = [];
		});
	}

	private renderArray(control: IOlympiaSettingControl, controlId: string): HTMLElement {
		// 数组项按逗号分隔输入，用普通文本框（类型同样显式设死）。
		const input = $<HTMLInputElement>('input');
		input.type = 'text';
		input.classList.add('olympiaSettings-input');
		input.id = controlId;
		const current = this.readValue(control);
		input.value = Array.isArray(current) ? current.join(', ') : '';
		if (control.placeholder) {
			input.placeholder = control.placeholder;
		}
		input.addEventListener(EventType.CHANGE, () => {
			const items = input.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
			this.writeValue(control, items);
		});
		return input;
	}

	private renderFooter(): HTMLElement {
		const footer = $('.olympiaSettings-footer');
		const advanced = $<HTMLButtonElement>('button.olympiaSettings-advanced');
		advanced.type = 'button';
		advanced.textContent = localize('olympiaSettings.advanced.button', "高级设置（完整设置页）");
		advanced.title = localize('olympiaSettings.advanced.button.title', "打开 VS Code 的完整设置页，可访问本页未列出的所有配置项。");
		advanced.addEventListener(EventType.CLICK, () => {
			this.commandService.executeCommand(OlympiaSettingsPage.OPEN_NATIVE_SETTINGS_COMMAND_ID);
		});
		append(footer, advanced);
		return footer;
	}

	// -------------------------------------------------------------------------
	// 配置读写
	// -------------------------------------------------------------------------

	private readValue(control: IOlympiaSettingControl): unknown {
		return this.configurationService.getValue(control.key);
	}

	private writeValue(control: IOlympiaSettingControl, value: unknown): void {
		// updateValue 是异步的；失败要吞掉，否则会变成一个没人处理的 rejection。
		// 写失败（比如 key 已不存在）时页面上的值会与真实配置不一致 —— 但那是上游的问题，
		// 这里不该因此把整个编辑器带崩。
		this.configurationService.updateValue(control.key, value).catch(() => undefined);
	}
}
