/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/olympiaHome.css';

import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';

/**
 * 「打开 Olympia 首页」命令 id。
 *
 * ## 为什么是字面量而不是从别处 import
 *
 * 上游 `gettingStarted.contribution.ts` 要引用它。如果那边 import 本文件，
 * 就等于让上游文件依赖 contrib —— 方向反了（上游不能被 contrib 拖进来）。
 * 所以这里**导出**字面量给本 contrib 内部用，同时让上游文件**再写一遍**字面量，
 * 由 `check-olympia-home.mjs` 的一条断言强制两处必须一致。
 *
 * 改了一处忘了另一处 → 门禁直接红。这比「引一个常量」更安全，因为
 * 常量 import 会把错误变成静默的行为漂移。
 */
export const OLYMPIA_HOME_COMMAND_ID = 'olympia.openHome';

/**
 * 首页上的一个快捷入口。
 *
 * `command` 指向**真实存在**的命令 id：
 *  - `olympia.*` 来自内置扩展 `olympia-contest` / `olympia-onboarding` / `olympia-coach`；
 *  - `workbench.action.*` 来自内核。
 *
 * 扩展的命令不一定被装上（用户可以禁用内置扩展），所以点击时必须先判存在，
 * 不存在就走「这个功能需要 Olympia 扩展」的通知，而不是让内核弹一个
 * 「command not found」。
 */
export interface OlympiaHomeAction {
	/** 入口 id。只用于门禁断言与测试定位，不进 DOM。 */
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly command: string;
	readonly icon: ThemeIcon;
}

/**
 * 首页快捷入口。
 *
 * 顺序 = 视觉顺序 = 阅读顺序。前四个是 Olympia 自己的差异化能力，
 * 后四个是通用动作。两组之间用 CSS 的分组边框分开，用户一眼能看出
 * 「上面这一排是竞赛向的，下面这一排是普通的 IDE 动作」。
 */
export const OLYMPIA_HOME_ACTIONS: readonly OlympiaHomeAction[] = [
	{
		id: 'pull-problem',
		label: localize('olympia.home.action.pullProblem', "拉取题面"),
		description: localize('olympia.home.action.pullProblem.desc', "按题号拉取洛谷题面"),
		command: 'olympia.problem.pull',
		icon: Codicon.cloudDownload,
	},
	{
		id: 'insert-template',
		label: localize('olympia.home.action.insertTemplate', "插入赛制模板"),
		description: localize('olympia.home.action.insertTemplate.desc', "ACM / 普及组模板一键插入"),
		command: 'olympia.template.insert',
		icon: Codicon.symbolSnippet,
	},
	{
		id: 'practice-list',
		label: localize('olympia.home.action.practiceList', "集训清单"),
		description: localize('olympia.home.action.practiceList.desc', "管理自己的练习清单"),
		command: 'olympia.practice.open',
		icon: Codicon.listUnordered,
	},
	{
		id: 'ai-coach',
		label: localize('olympia.home.action.aiCoach', "AI 教练"),
		description: localize('olympia.home.action.aiCoach.desc', "配置模型与 API Key"),
		command: 'olympia.ai.settings',
		icon: Codicon.sparkle,
	},
	{
		id: 'new-file',
		label: localize('olympia.home.action.newFile', "新建文件"),
		description: localize('olympia.home.action.newFile.desc', "创建一个空白源文件"),
		command: 'workbench.action.files.newUntitledFile',
		icon: Codicon.newFile,
	},
	{
		id: 'open-folder',
		label: localize('olympia.home.action.openFolder', "打开文件夹"),
		description: localize('olympia.home.action.openFolder.desc', "把一个练习目录加进来"),
		command: 'workbench.action.files.openFolder',
		icon: Codicon.folderOpened,
	},
	{
		id: 'command-palette',
		label: localize('olympia.home.action.commandPalette', "命令面板"),
		description: localize('olympia.home.action.commandPalette.desc', "所有动作都在这里"),
		command: 'workbench.action.showCommands',
		icon: Codicon.search,
	},
	{
		id: 'settings',
		label: localize('olympia.home.action.settings', "设置"),
		description: localize('olympia.home.action.settings.desc', "语言、主题与 Olympia 选项"),
		command: 'workbench.action.openSettings',
		icon: Codicon.settingsGear,
	},
];

export interface OlympiaHomeViewOptions {
	/** 点击快捷入口时调用。传入命令 id。 */
	readonly runCommand: (command: string) => void;
}

/**
 * 渲染 Olympia 首页的内容（**不含**外层容器）。
 *
 * 三个落点共用这一份渲染：
 *  1. 开始页（`olympia-welcome` scheme 的 EditorPane）—— 启动时看到的那一屏；
 *  2. 空编辑器区（`olympiaHomeEmptyState`）—— 没有任何编辑器打开时盖在编辑区上的那一屏；
 *  3. 「帮助 > 欢迎」—— 打开开始页，也就是第 1 种。
 *
 * 为什么共用：首页是产品的门面，三处内容一旦不一致，用户就会以为是三个不同的页面。
 * 共用一份渲染 = 三处永远一致，改一次三处都变。
 */
export function createOlympiaHomeView(options: OlympiaHomeViewOptions): HTMLElement {
	const root = document.createElement('div');
	root.className = 'olympia-home';

	const header = document.createElement('header');
	header.className = 'olympia-home-header';

	const brand = document.createElement('div');
	brand.className = 'olympia-home-brand';
	const brandDot = document.createElement('span');
	brandDot.className = 'olympia-home-brand-dot';
	const brandWord = document.createElement('span');
	brandWord.className = 'olympia-home-brand-word';
	brandWord.textContent = 'OLYMPIA';
	brand.append(brandDot, brandWord);

	const title = document.createElement('h1');
	title.className = 'olympia-home-title';
	title.textContent = localize('olympia.home.title', "面向 OI 选手的竞赛 IDE");

	const subtitle = document.createElement('p');
	subtitle.className = 'olympia-home-subtitle';
	subtitle.textContent = localize('olympia.home.subtitle', "拉题、练赛、对答案，都在这一屏。");

	header.append(brand, title, subtitle);

	const grid = document.createElement('div');
	grid.className = 'olympia-home-grid';

	for (const action of OLYMPIA_HOME_ACTIONS) {
		grid.appendChild(createActionCard(action, options));
	}

	const footer = document.createElement('footer');
	footer.className = 'olympia-home-footer';
	const footerText = document.createElement('span');
	footerText.className = 'olympia-home-footer-text';
	footerText.textContent = localize('olympia.home.footer', "按 Ctrl+Shift+P 可以执行任意命令。");
	const footerLink = document.createElement('button');
	footerLink.className = 'olympia-home-footer-link';
	footerLink.type = 'button';
	footerLink.textContent = localize('olympia.home.footer.advancedSettings', "完整设置");
	footerLink.addEventListener('click', () => options.runCommand('workbench.action.openSettings2'));
	footer.append(footerText, footerLink);

	root.append(header, grid, footer);
	return root;
}

function createActionCard(action: OlympiaHomeAction, options: OlympiaHomeViewOptions): HTMLElement {
	const button = document.createElement('button');
	button.className = 'olympia-home-card';
	button.type = 'button';
	button.setAttribute('aria-label', `${action.label} — ${action.description}`);

	const icon = document.createElement('span');
	icon.className = 'olympia-home-card-icon';
	icon.classList.add(...ThemeIcon.asClassName(action.icon).split(' '));
	icon.setAttribute('aria-hidden', 'true');

	const label = document.createElement('span');
	label.className = 'olympia-home-card-label';
	label.textContent = action.label;

	const description = document.createElement('span');
	description.className = 'olympia-home-card-desc';
	description.textContent = action.description;

	button.append(icon, label, description);
	button.addEventListener('click', () => options.runCommand(action.command));
	return button;
}

/**
 * 执行首页上的一个快捷入口。
 *
 * ## 为什么要先判存在
 *
 * 首页上的前四个入口指向 `olympia.*` 命令，它们来自**内置扩展**。
 * 内置扩展可以被用户禁用（`--disable-extensions`、扩展页面的开关、
 * 或者某台机器上装坏了）。这时候直接 `executeCommand` 会让内核弹一个
 * 冷冰冰的 "command 'olympia.problem.pull' not found"，用户完全看不懂。
 *
 * 所以这里先查注册表：命令不在就换成一句人话，告诉用户「这个功能现在
 * 不可用，可能是相关扩展被禁用了」。
 *
 * @param command 要执行的命令 id。
 */
export function runOlympiaHomeCommand(
	commandService: ICommandService,
	notificationService: INotificationService,
	command: string
): void {
	if (CommandsRegistry.getCommand(command)) {
		commandService.executeCommand(command);
		return;
	}

	notificationService.info(localize('olympia.home.commandMissing', "当前环境里没有 {0} 这项功能（可能相关扩展被禁用了）。", command));
}
