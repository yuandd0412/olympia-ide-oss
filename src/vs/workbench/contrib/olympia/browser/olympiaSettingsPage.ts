/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/olympiaSettings.css';

import { localize } from '../../../../nls.js';
import { $, append, clearNode, Dimension, EventType, IDomPosition } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
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
	) {
		super(OlympiaSettingsPage.ID, group, telemetryService, themeService, storageService);
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

		append(body, this.renderFooter());
		append(container, nav);
		append(container, body);
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

	private renderBoolean(control: IOlympiaSettingControl, controlId: string): HTMLElement {
		const input = $<HTMLInputElement>('input[type=checkbox]');
		input.id = controlId;
		input.checked = this.readValue(control) === true;
		input.addEventListener(EventType.CHANGE, () => this.writeValue(control, input.checked));
		return input;
	}

	private renderString(control: IOlympiaSettingControl, controlId: string): HTMLElement {
		const input = $<HTMLInputElement>('input[type=text]');
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
		const input = $<HTMLInputElement>('input[type=number]');
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

	private renderEnum(control: IOlympiaSettingControl, controlId: string): HTMLElement {
		const select = $<HTMLSelectElement>('select');
		select.id = controlId;
		const values = control.enumValues ?? [];
		for (const v of values) {
			const option = $<HTMLOptionElement>('option', {}, v.label);
			option.value = v.value;
			append(select, option);
		}
		const current = this.readValue(control);
		if (typeof current === 'string' && current !== '' && !values.some(v => v.value === current)) {
			// 当前值不在枚举里（用户手改过 settings.json，或扩展被移除）。
			// 保留它并原样显示，而不是**改写成第一个枚举值** —— 那是在用户没操作的情况下
			// 改掉他的配置。
			const option = $<HTMLOptionElement>('option', {}, current);
			option.value = current;
			append(select, option);
		}
		if (typeof current === 'string') {
			select.value = current;
		}
		select.addEventListener(EventType.CHANGE, () => {
			if (!values.some(v => v.value === select.value)) {
				return;
			}
			this.writeValue(control, select.value);
		});
		return select;
	}

	private renderTheme(control: IOlympiaSettingControl, controlId: string): HTMLElement {
		const select = $<HTMLSelectElement>('select');
		select.id = controlId;

		const followSystem = $<HTMLOptionElement>('option', {}, localize('olympiaSettings.theme.system', "跟随系统"));
		followSystem.value = '';
		append(select, followSystem);

		for (const theme of this.colorThemes) {
			const option = $<HTMLOptionElement>('option', {}, theme.label);
			// 值必须是 settingsId —— `workbench.colorTheme` 的枚举值就是 settingsId
			// （见 themeConfiguration.ts 里 colorThemeSettingEnum 的构造）。
			// 用 theme.id 写进去，配置值对不上任何主题，回读时找不到当前主题。
			option.value = theme.settingsId;
			append(select, option);
		}
		const current = this.readValue(control);
		if (typeof current === 'string') {
			select.value = current;
			// 主题被卸载时 select.value 会变成 ''，那会让页面显示「跟随系统」，
			// 但实际配置还指着那个不存在的主题 —— 显示与真实状态不一致。
			if (select.value !== current) {
				const option = $<HTMLOptionElement>('option', {}, current);
				option.value = current;
				append(select, option);
				select.value = current;
			}
		}
		select.addEventListener(EventType.CHANGE, () => this.writeValue(control, select.value));
		return select;
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
		const input = $<HTMLInputElement>('input[type=text]');
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
