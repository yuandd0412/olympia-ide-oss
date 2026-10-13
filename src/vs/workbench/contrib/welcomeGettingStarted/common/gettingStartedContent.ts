/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import themePickerContent from './media/theme_picker.js';
import themePickerSmallContent from './media/theme_picker_small.js';
import notebookProfileContent from './media/notebookProfile.js';
import { localize } from '../../../../nls.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from '../../../../platform/accessibility/common/accessibility.js';
import { URI } from '../../../../base/common/uri.js';
import product from '../../../../platform/product/common/product.js';

interface IGettingStartedContentProvider {
	(): string;
}

const defaultChat = {
	documentationUrl: product.defaultChatAgent?.documentationUrl ?? '',
	provider: product.defaultChatAgent?.provider ?? { default: { name: '' } },
	publicCodeMatchesUrl: product.defaultChatAgent?.publicCodeMatchesUrl ?? '',
	termsStatementUrl: product.defaultChatAgent?.termsStatementUrl ?? '',
	privacyStatementUrl: product.defaultChatAgent?.privacyStatementUrl ?? ''
};

export function copilotSettingsMessage(manageSettingsUrl: string): string {
	return localize({ key: 'settings', comment: ['{Locked="["}', '{Locked="]({0})"}', '{Locked="]({1})"}'] }, "{0} Copilot 可能会显示 [公共代码]({1})建议并使用你的数据来改进产品。你可以随时更改这些 [设置]({2})。", defaultChat.provider.default.name, defaultChat.publicCodeMatchesUrl, manageSettingsUrl);
}

class GettingStartedContentProviderRegistry {

	private readonly providers = new Map<string, IGettingStartedContentProvider>();

	registerProvider(moduleId: string, provider: IGettingStartedContentProvider): void {
		this.providers.set(moduleId, provider);
	}

	getProvider(moduleId: string): IGettingStartedContentProvider | undefined {
		return this.providers.get(moduleId);
	}
}
export const gettingStartedContentRegistry = new GettingStartedContentProviderRegistry();

export async function moduleToContent(resource: URI): Promise<string> {
	if (!resource.query) {
		throw new Error('Getting Started: invalid resource');
	}

	const query = JSON.parse(resource.query);
	if (!query.moduleId) {
		throw new Error('Getting Started: invalid resource');
	}

	const provider = gettingStartedContentRegistry.getProvider(query.moduleId);
	if (!provider) {
		throw new Error(`Getting Started: no provider registered for ${query.moduleId}`);
	}

	return provider();
}

gettingStartedContentRegistry.registerProvider('vs/workbench/contrib/welcomeGettingStarted/common/media/theme_picker', themePickerContent);
gettingStartedContentRegistry.registerProvider('vs/workbench/contrib/welcomeGettingStarted/common/media/theme_picker_small', themePickerSmallContent);
gettingStartedContentRegistry.registerProvider('vs/workbench/contrib/welcomeGettingStarted/common/media/notebookProfile', notebookProfileContent);
// Register empty media for accessibility walkthrough
gettingStartedContentRegistry.registerProvider('vs/workbench/contrib/welcomeGettingStarted/common/media/empty', () => '');

const setupIcon = registerIcon('getting-started-setup', Codicon.zap, localize('getting-started-setup-icon', "起始页「安装」分类使用的图标"));
const beginnerIcon = registerIcon('getting-started-beginner', Codicon.lightbulb, localize('getting-started-beginner-icon', "起始页「新手入门」分类使用的图标"));

export type BuiltinGettingStartedStep = {
	id: string;
	title: string;
	description: string;
	completionEvents?: string[];
	when?: string;
	media:
	| { type: 'image'; path: string | { hc: string; hcLight?: string; light: string; dark: string }; altText: string }
	| { type: 'svg'; path: string; altText: string }
	| { type: 'markdown'; path: string }
	| { type: 'video'; path: string | { hc: string; hcLight?: string; light: string; dark: string }; poster?: string | { hc: string; hcLight?: string; light: string; dark: string }; altText: string };
};

export type BuiltinGettingStartedCategory = {
	id: string;
	title: string;
	description: string;
	isFeatured: boolean;
	next?: string;
	icon: ThemeIcon;
	when?: string;
	content:
	| { type: 'steps'; steps: BuiltinGettingStartedStep[] };
	walkthroughPageTitle: string;
};

export type BuiltinGettingStartedStartEntry = {
	id: string;
	title: string;
	description: string;
	icon: ThemeIcon;
	when?: string;
	content:
	| { type: 'startEntry'; command: string };
};

type GettingStartedWalkthroughContent = BuiltinGettingStartedCategory[];
type GettingStartedStartEntryContent = BuiltinGettingStartedStartEntry[];

export const startEntries: GettingStartedStartEntryContent = [
	{
		id: 'welcome.showNewFileEntries',
		title: localize('gettingStarted.newFile.title', "新建文件..."),
		description: localize('gettingStarted.newFile.description', "新建未命名文本文件、笔记本或自定义编辑器。"),
		icon: Codicon.newFile,
		content: {
			type: 'startEntry',
			command: 'command:welcome.showNewFileEntries',
		}
	},
	{
		id: 'topLevelOpenMac',
		title: localize('gettingStarted.openMac.title', "打开..."),
		description: localize('gettingStarted.openMac.description', "打开文件或文件夹开始工作"),
		icon: Codicon.folderOpened,
		when: '!isWeb && isMac',
		content: {
			type: 'startEntry',
			command: 'command:workbench.action.files.openFileFolder',
		}
	},
	{
		id: 'topLevelOpenFile',
		title: localize('gettingStarted.openFile.title', "打开文件..."),
		description: localize('gettingStarted.openFile.description', "打开一个文件开始工作"),
		icon: Codicon.goToFile,
		when: 'isWeb || !isMac',
		content: {
			type: 'startEntry',
			command: 'command:workbench.action.files.openFile',
		}
	},
	{
		id: 'topLevelOpenFolder',
		title: localize('gettingStarted.openFolder.title', "打开文件夹..."),
		description: localize('gettingStarted.openFolder.description', "打开一个文件夹开始工作"),
		icon: Codicon.folderOpened,
		when: '!isWeb && !isMac',
		content: {
			type: 'startEntry',
			command: 'command:workbench.action.files.openFolder',
		}
	},
	{
		id: 'topLevelOpenFolderWeb',
		title: localize('gettingStarted.openFolder.title', "打开文件夹..."),
		description: localize('gettingStarted.openFolder.description', "打开一个文件夹开始工作"),
		icon: Codicon.folderOpened,
		when: '!openFolderWorkspaceSupport && workbenchState == \'workspace\'',
		content: {
			type: 'startEntry',
			command: 'command:workbench.action.files.openFolderViaWorkspace',
		}
	},
	{
		id: 'topLevelGitClone',
		title: localize('gettingStarted.topLevelGitClone.title', "克隆 Git 仓库..."),
		description: localize('gettingStarted.topLevelGitClone.description', "把远程仓库克隆到本地文件夹"),
		when: 'false',
		icon: Codicon.sourceControl,
		content: {
			type: 'startEntry',
			command: 'command:git.clone',
		}
	},
	{
		id: 'topLevelGitOpen',
		title: localize('gettingStarted.topLevelGitOpen.title', "打开仓库..."),
		description: localize('gettingStarted.topLevelGitOpen.description', "连接远程仓库或拉取请求，以浏览、搜索、编辑和提交"),
		when: 'false',
		icon: Codicon.sourceControl,
		content: {
			type: 'startEntry',
			command: 'command:remoteHub.openRepository',
		}
	},
	{
		id: 'topLevelRemoteOpen',
		title: localize('gettingStarted.topLevelRemoteOpen.title', "连接到..."),
		description: localize('gettingStarted.topLevelRemoteOpen.description', "连接到远程开发工作区。"),
		when: 'false',
		icon: Codicon.remote,
		content: {
			type: 'startEntry',
			command: 'command:workbench.action.remote.showMenu',
		}
	},
	{
		id: 'topLevelOpenTunnel',
		title: localize('gettingStarted.topLevelOpenTunnel.title', "打开隧道..."),
		description: localize('gettingStarted.topLevelOpenTunnel.description', "通过隧道连接到远程机器"),
		when: 'false',
		icon: Codicon.remote,
		content: {
			type: 'startEntry',
			command: 'command:workbench.action.remote.showWebStartEntryActions',
		}
	},
	{
		id: 'topLevelNewWorkspaceChat',
		title: localize('gettingStarted.newWorkspaceChat.title', "新建工作区..."),
		description: localize('gettingStarted.newWorkspaceChat.description', "通过对话创建新工作区"),
		icon: Codicon.chatSparkle,
		when: 'false',
		content: {
			type: 'startEntry',
			command: 'command:welcome.newWorkspaceChat',
		}
	},
];

const Button = (title: string, href: string) => `[${title}](${href})`;

const CopilotStepTitle = localize('gettingStarted.copilotSetup.title', "免费使用 Copilot 的 AI 功能");
const CopilotDescription = localize({ key: 'gettingStarted.copilotSetup.description', comment: ['{Locked="["}', '{Locked="]({0})"}'] }, "可以使用 [Copilot]({0}) 通过自然语言执行跨多个文件生成代码、修复错误、询问代码相关问题等操作。", defaultChat.documentationUrl ?? '');
const CopilotTermsString = localize({ key: 'gettingStarted.copilotSetup.terms', comment: ['{Locked="]({2})"}', '{Locked="]({3})"}'] }, "继续使用 {0} Copilot 即表示你同意 {1} 的[条款]({2})和[隐私声明]({3})", defaultChat.provider.default.name, defaultChat.provider.default.name, defaultChat.termsStatementUrl, defaultChat.privacyStatementUrl);
const CopilotAnonymousButton = Button(localize('setupCopilotButton.setup', "使用 AI 功能"), `command:workbench.action.chat.triggerSetupAnonymousWithoutDialog`);
const CopilotSignedOutButton = Button(localize('setupCopilotButton.setup', "使用 AI 功能"), `command:workbench.action.chat.triggerSetup`);
const CopilotSignedInButton = Button(localize('setupCopilotButton.setup', "使用 AI 功能"), `command:workbench.action.chat.triggerSetup`);
const CopilotCompleteButton = Button(localize('setupCopilotButton.chatWithCopilot', "开始对话"), 'command:workbench.action.chat.open');

function createCopilotSetupStep(id: string, button: string, includeTerms: boolean): BuiltinGettingStartedStep {
	const description = includeTerms ?
		`${CopilotDescription}\n${CopilotTermsString}\n${button}` :
		`${CopilotDescription}\n${button}`;

	return {
		id,
		title: CopilotStepTitle,
		description,
		when: 'false',
		media: {
			type: 'svg', altText: 'Olympia IDE Copilot multi file edits', path: 'multi-file-edits.svg'
		},
	};
}

export const walkthroughs: GettingStartedWalkthroughContent = [
	{
		id: 'Setup',
		title: localize('gettingStarted.setup.title', "从零开始用 Olympia"),
		description: localize('gettingStarted.setup.description', "配置你的编辑器，掌握基础，然后开始写代码"),
		isFeatured: true,
		icon: setupIcon,
		when: '!isWeb',
		walkthroughPageTitle: localize('gettingStarted.setup.walkthroughPageTitle', "安装程序 Olympia"),
		next: 'Beginner',
		content: {
			type: 'steps',
			steps: [
				createCopilotSetupStep('CopilotSetupAnonymous', CopilotAnonymousButton, true),
				createCopilotSetupStep('CopilotSetupSignedOut', CopilotSignedOutButton, false),
				createCopilotSetupStep('CopilotSetupComplete', CopilotCompleteButton, false),
				createCopilotSetupStep('CopilotSetupSignedIn', CopilotSignedInButton, false),
				{
					id: 'pickColorTheme',
					title: localize('gettingStarted.pickColor.title', "选择你的主题"),
					description: localize('gettingStarted.pickColor.description.interpolated', "合适的主题能让你更专注于代码，也更护眼、用起来更舒服。\n{0}", Button(localize('titleID', "浏览颜色主题"), 'command:workbench.action.selectTheme')),
					completionEvents: [
						'onSettingChanged:workbench.colorTheme',
						'onCommand:workbench.action.selectTheme'
					],
					media: { type: 'markdown', path: 'theme_picker', }
				},
				{
					id: 'videoTutorial',
					title: localize('gettingStarted.videoTutorial.title', "看一遍快捷键和判题流程"),
					description: localize('gettingStarted.videoTutorial.description.interpolated', "文档里写着每个功能的快捷键、跑样例怎么判 AC/WA/TLE/MLE、对拍怎么配数据，比视频查得快。\n{0}", Button(localize('watch', "打开 Olympia 文档"), 'https://olympia.dpdns.org/docs/')),
					media: { type: 'svg', altText: 'Olympia IDE Settings', path: 'learn.svg' },
				}
			]
		}
	},

	{
		id: 'SetupWeb',
		title: localize('gettingStarted.setupWeb.title', "开始使用网页版 Olympia"),
		description: localize('gettingStarted.setupWeb.description', "配置你的编辑器，掌握基础，然后开始写代码"),
		isFeatured: true,
		icon: setupIcon,
		when: 'isWeb',
		next: 'Beginner',
		walkthroughPageTitle: localize('gettingStarted.setupWeb.walkthroughPageTitle', "安装程序 Olympia Web"),
		content: {
			type: 'steps',
			steps: [
				{
					id: 'pickColorThemeWeb',
					title: localize('gettingStarted.pickColor.title', "选择你的主题"),
					description: localize('gettingStarted.pickColor.description.interpolated', "合适的主题能让你更专注于代码，也更护眼、用起来更舒服。\n{0}", Button(localize('titleID', "浏览颜色主题"), 'command:workbench.action.selectTheme')),
					completionEvents: [
						'onSettingChanged:workbench.colorTheme',
						'onCommand:workbench.action.selectTheme'
					],
					media: { type: 'markdown', path: 'theme_picker', }
				},
				{
					id: 'menuBarWeb',
					title: localize('gettingStarted.menuBar.title', "刚刚好的界面"),
					description: localize('gettingStarted.menuBar.description.interpolated', "完整菜单栏已收纳到下拉菜单中，为代码腾出空间。可随时切换显示方式以加快访问。\n{0}", Button(localize('toggleMenuBar', "切换菜单栏"), 'command:workbench.action.toggleMenuBar')),
					when: 'isWeb',
					media: {
						type: 'svg', altText: 'Comparing menu dropdown with the visible menu bar.', path: 'menuBar.svg'
					},
				},
				{
					id: 'extensionsWebWeb',
					title: localize('gettingStarted.extensions.title', "用扩展来写代码"),
					description: localize('gettingStarted.extensionsWeb.description.interpolated', "扩展是 Olympia IDE 的强化插件，网页端可用的扩展也越来越多。\n{0}", Button(localize('browsePopularWeb', "浏览热门网页版扩展"), 'command:workbench.extensions.action.showPopularExtensions')),
					when: 'workspacePlatform == \'webworker\'',
					media: {
						type: 'svg', altText: 'Olympia IDE extension marketplace with featured language extensions', path: 'extensions-web.svg'
					},
				},
				{
					id: 'findLanguageExtensionsWeb',
					title: localize('gettingStarted.findLanguageExts.title', "全面支持各种语言"),
					description: localize('gettingStarted.findLanguageExts.description.interpolated', "语法高亮、行内建议、代码检查和调试帮你写得更聪明。许多语言已内置，更多语言可通过扩展添加。\n{0}", Button(localize('browseLangExts', "浏览语言扩展"), 'command:workbench.extensions.action.showLanguageExtensions')),
					when: 'workspacePlatform != \'webworker\'',
					media: {
						type: 'svg', altText: 'Language extensions', path: 'languages.svg'
					},
				},
				{
					id: 'settingsSyncWeb',
					title: localize('gettingStarted.settingsSync.title', "跨设备同步设置"),
					description: localize('gettingStarted.settingsSync.description.interpolated', "备份并同步你重要的个性化配置到所有设备。\n{0}", Button(localize('enableSync', "备份与同步设置"), 'command:workbench.userDataSync.actions.turnOn')),
					when: 'syncStatus != uninitialized',
					completionEvents: ['onEvent:sync-enabled'],
					media: {
						type: 'svg', altText: 'The "Turn on Sync" entry in the settings gear menu.', path: 'settingsSync.svg'
					},
				},
				{
					id: 'commandPaletteTaskWeb',
					title: localize('gettingStarted.commandPalette.title', "用命令面板解锁生产力"),
					description: localize('gettingStarted.commandPalette.description.interpolated', "不用碰鼠标，在 Olympia IDE 里执行命令完成任何操作。\n{0}", Button(localize('commandPalette', "打开命令面板"), 'command:workbench.action.showCommands')),
					media: { type: 'svg', altText: 'Command Palette overlay for searching and executing commands.', path: 'commandPalette.svg' },
				},
				{
					id: 'pickAFolderTask-WebWeb',
					title: localize('gettingStarted.setup.OpenFolder.title', "打开你的代码"),
					description: localize('gettingStarted.setup.OpenFolderWeb.description.interpolated', "一切就绪，可以开始写代码了。你可以打开本地项目或远程仓库，把代码文件载入 Olympia IDE。\n{0}\n{1}", Button(localize('openFolder', "打开文件夹"), 'command:workbench.action.addRootFolder'), Button(localize('openRepository', "打开仓库"), 'command:remoteHub.openRepository')),
					when: 'workspaceFolderCount == 0',
					media: {
						type: 'svg', altText: 'Explorer view showing buttons for opening folder and cloning repository.', path: 'openFolder.svg'
					}
				},
				{
					id: 'quickOpenWeb',
					title: localize('gettingStarted.quickOpen.title', "在文件之间快速跳转"),
					description: localize('gettingStarted.quickOpen.description.interpolated', "一次按键即可在文件间瞬时跳转。提示：按右方向键可打开多个文件。\n{0}", Button(localize('quickOpen', "快速打开文件"), 'command:toSide:workbench.action.quickOpen')),
					when: 'workspaceFolderCount != 0',
					media: {
						type: 'svg', altText: 'Go to file in quick search.', path: 'search.svg'
					}
				}
			]
		}
	},
	{
		id: 'SetupAccessibility',
		title: localize('gettingStarted.setupAccessibility.title', "无障碍功能入门"),
		description: localize('gettingStarted.setupAccessibility.description', "了解让 Olympia IDE 更易用的工具与快捷键。注意有些操作无法在本引导页面中直接执行。"),
		isFeatured: true,
		icon: setupIcon,
		when: CONTEXT_ACCESSIBILITY_MODE_ENABLED.key,
		next: 'Setup',
		walkthroughPageTitle: localize('gettingStarted.setupAccessibility.walkthroughPageTitle', "安装程序 Olympia 辅助功能"),
		content: {
			type: 'steps',
			steps: [
				{
					id: 'accessibilityHelp',
					title: localize('gettingStarted.accessibilityHelp.title', "使用无障碍帮助对话框了解功能"),
					description: localize('gettingStarted.accessibilityHelp.description.interpolated', "辅助功能帮助对话框提供有关功能内容以及用于操作功能的命令/键绑定的信息。\r\n 由于焦点位于编辑器、终端、笔记本、聊天响应、注释或调试控制台上，可使用“打开辅助功能帮助”命令打开相关对话框。\r\n{0}", Button(localize('openAccessibilityHelp', "打开无障碍帮助"), 'command:editor.action.accessibilityHelp')),
					media: {
						type: 'markdown', path: 'empty'
					}
				},
				{
					id: 'accessibleView',
					title: localize('gettingStarted.accessibleView.title', "屏幕阅读器用户可以在无障碍视图中逐行、逐字符地查看内容。"),
					description: localize('gettingStarted.accessibleView.description.interpolated', "辅助视图可用于终端、悬停、通知、批注、笔记本输出、聊天响应、内联完成和调试控制台输出。\r\n 如果焦点位于这些功能上，则可以使用“打开辅助视图”命令打开它。\r\n{0}", Button(localize('openAccessibleView', "打开无障碍视图"), 'command:editor.action.accessibleView')),
					media: {
						type: 'markdown', path: 'empty'
					}
				},
				{
					id: 'verbositySettings',
					title: localize('gettingStarted.verbositySettings.title', "控制 aria 标签的详细程度"),
					description: localize('gettingStarted.verbositySettings.description.interpolated', "工作台周围存在功能对应的屏幕阅读器详细程度设置，以便用户熟悉某项功能后，避免听到有关如何操作该功能的提示。例如，存在辅助功能帮助对话框的功能将指示如何打开对话框，直到该功能的详细程度设置被禁用。\r\n 可通过运行“打开辅助功能设置”命令来配置这些和其他辅助功能设置。\r\n{0}", Button(localize('openVerbositySettings', "打开无障碍设置"), 'command:workbench.action.openAccessibilitySettings')),
					media: {
						type: 'markdown', path: 'empty'
					}
				},
				{
					id: 'commandPaletteTaskAccessibility',
					title: localize('gettingStarted.commandPaletteAccessibility.title', "用命令面板解锁生产力"),
					description: localize('gettingStarted.commandPaletteAccessibility.description.interpolated', "不用碰鼠标，在 Olympia IDE 里执行命令完成任何操作。\n{0}", Button(localize('commandPalette', "打开命令面板"), 'command:workbench.action.showCommands')),
					media: { type: 'markdown', path: 'empty' },
				},
				{
					id: 'keybindingsAccessibility',
					title: localize('gettingStarted.keyboardShortcuts.title', "自定义键盘快捷键"),
					description: localize('gettingStarted.keyboardShortcuts.description.interpolated', "找到常用的命令后，为它们创建自定义快捷键，一键直达。\n{0}", Button(localize('keyboardShortcuts', "键盘快捷方式"), 'command:toSide:workbench.action.openGlobalKeybindings')),
					media: {
						type: 'markdown', path: 'empty',
					}
				},
				{
					id: 'accessibilitySignals',
					title: localize('gettingStarted.accessibilitySignals.title', "精细调整你想通过音频或盲文设备接收的无障碍提示"),
					description: localize('gettingStarted.accessibilitySignals.description.interpolated', "辅助功能声音和公告会在各种事件的工作台周围播放。\r\n 可以使用“列出信号声音和列出信号公告”命令来发现和配置这些功能。\r\n{0}\r\n{1}", Button(localize('listSignalSounds', "列出提示音"), 'command:signals.sounds.help'), Button(localize('listSignalAnnouncements', "列出语音提示"), 'command:accessibility.announcement.help')),
					media: {
						type: 'markdown', path: 'empty'
					}
				},
				{
					id: 'hover',
					title: localize('gettingStarted.hover.title', "在编辑器中悬停可查看变量或符号的更多信息"),
					description: localize('gettingStarted.hover.description.interpolated', "当焦点在编辑器中的变量或符号上时，可用「显示悬停」或「打开悬停」命令聚焦悬停内容。\n{0}", Button(localize('showOrFocusHover', "显示或聚焦悬停"), 'command:editor.action.showHover')),
					media: {
						type: 'markdown', path: 'empty'
					}
				},
				{
					id: 'goToSymbol',
					title: localize('gettingStarted.goToSymbol.title', "在文件中跳转到符号"),
					description: localize('gettingStarted.goToSymbol.description.interpolated', "「转到符号」命令可用于在文档的重要位置之间跳转。\n{0}", Button(localize('openGoToSymbol', "转到符号"), 'command:editor.action.goToSymbol')),
					media: {
						type: 'markdown', path: 'empty'
					}
				},
				{
					id: 'codeFolding',
					title: localize('gettingStarted.codeFolding.title', "用代码折叠收起代码块，专注于你关心的部分。"),
					description: localize('gettingStarted.codeFolding.description.interpolated', "用「切换折叠」命令折叠或展开代码块。\n{0}\n 用「递归切换折叠」命令递归折叠或展开\n{1}\n", Button(localize('toggleFold', "切换折叠"), 'command:editor.toggleFold'), Button(localize('toggleFoldRecursively', "递归切换折叠"), 'command:editor.toggleFoldRecursively')),
					media: {
						type: 'markdown', path: 'empty'
					}
				},
				{
					id: 'intellisense',
					title: localize('gettingStarted.intellisense.title', "用智能提示提高编码效率"),
					description: localize('gettingStarted.intellisense.description.interpolated', "可以使用 Trigger Intellisense 命令打开 Intellisense 建议。\r\n{0}\r\n 可以使用触发器内联建议触发内联 Intellisense 建议\r\n{1}\r\n 有用的设置包括 editor.inlineCompletionsAccessibilityVerbose 和 editor.screenReaderAnnounceInlineSuggestion。", Button(localize('triggerIntellisense', "触发智能提示"), 'command:editor.action.triggerSuggest'), Button(localize('triggerInlineSuggestion', "触发内联建议"), 'command:editor.action.inlineSuggest.trigger')),
					media: {
						type: 'markdown', path: 'empty'
					}
				},
				{
					id: 'accessibilitySettings',
					title: localize('gettingStarted.accessibilitySettings.title', "配置无障碍设置"),
					description: localize('gettingStarted.accessibilitySettings.description.interpolated', "执行「打开无障碍设置」命令即可配置无障碍设置。\n{0}", Button(localize('openAccessibilitySettings', "打开无障碍设置"), 'command:workbench.action.openAccessibilitySettings')),
					media: { type: 'markdown', path: 'empty' }
				},
				{
					id: 'dictation',
					title: localize('gettingStarted.dictation.title', "用语音听写在编辑器和终端中输入代码与文本"),
					description: localize('gettingStarted.dictation.description.interpolated', "听写功能允许你通过语音编写代码和文本。可使用“语音: 在编辑器中开始听写”命令来激活它。\r\n{0}\r\n 在终端中进行听写时，请使用“语音: 在终端开始听写”和“语音: 在终端停止听写”命令。\r\n{1}\r\n{2}", Button(localize('toggleDictation', "语音：在编辑器中开始听写"), 'command:workbench.action.editorDictation.start'), Button(localize('terminalStartDictation', "终端：在终端中开始听写"), 'command:workbench.action.terminal.startVoice'), Button(localize('terminalStopDictation', "终端：在终端中停止听写"), 'command:workbench.action.terminal.stopVoice')),
					when: 'hasSpeechProvider',
					media: { type: 'markdown', path: 'empty' }
				}
			]
		}
	},
	{
		id: 'Beginner',
		isFeatured: false,
		title: localize('gettingStarted.beginner.title', "学习基础知识"),
		icon: beginnerIcon,
		description: localize('gettingStarted.beginner.description', "概览最核心的功能"),
		walkthroughPageTitle: localize('gettingStarted.beginner.walkthroughPageTitle', "基本功能"),
		content: {
			type: 'steps',
			steps: [
				{
					id: 'settingsAndSync',
					title: localize('gettingStarted.settings.title', "调整你的设置"),
					description: localize('gettingStarted.settingsAndSync.description.interpolated', "自定义 Olympia IDE 的方方面面，并[同步](command:workbench.userDataSync.actions.turnOn)到各个设备。\n{0}", Button(localize('tweakSettings', "打开设置"), 'command:toSide:workbench.action.openSettings')),
					when: 'workspacePlatform != \'webworker\' && syncStatus != uninitialized',
					completionEvents: ['onEvent:sync-enabled'],
					media: {
						type: 'svg', altText: 'Olympia IDE Settings', path: 'settings.svg'
					},
				},
				{
					id: 'extensions',
					title: localize('gettingStarted.extensions.title', "用扩展来写代码"),
					description: localize('gettingStarted.extensions.description.interpolated', "扩展是 Olympia IDE 的强化插件：既有余下开箱即用功能，也有彻底新增的能力。\n{0}", Button(localize('browsePopular', "浏览热门扩展"), 'command:workbench.extensions.action.showPopularExtensions')),
					when: 'workspacePlatform != \'webworker\'',
					media: {
						type: 'svg', altText: 'Olympia IDE extension marketplace with featured language extensions', path: 'extensions.svg'
					},
				},
				{
					id: 'terminal',
					title: localize('gettingStarted.terminal.title', "内置终端"),
					description: localize('gettingStarted.terminal.description.interpolated', "在代码旁边直接运行 shell 命令、实时查看构建输出。\n{0}", Button(localize('showTerminal', "打开终端"), 'command:workbench.action.terminal.toggleTerminal')),
					when: 'workspacePlatform != \'webworker\' && remoteName != codespaces && !terminalIsOpen',
					media: {
						type: 'svg', altText: 'Integrated terminal running a few npm commands', path: 'terminal.svg'
					},
				},
				{
					id: 'debugging',
					title: localize('gettingStarted.debug.title', "看着你的代码跑起来"),
					description: localize('gettingStarted.debug.description.interpolated', "配置启动项，加速「编辑-构建-测试-调试」循环。\n{0}", Button(localize('runProject', "运行你的项目"), 'command:workbench.action.debug.selectandstart')),
					when: 'false',
					media: {
						type: 'svg', altText: 'Run and debug view.', path: 'debug.svg',
					},
				},
				{
					id: 'scmClone',
					title: localize('gettingStarted.scm.title', "用 Git 管理你的代码"),
					description: localize('gettingStarted.scmClone.description.interpolated', "为你的项目配置内置版本控制，追踪改动并与他人协作。\n{0}", Button(localize('cloneRepo', "克隆仓库"), 'command:git.clone')),
					when: 'false',
					media: {
						type: 'svg', altText: 'Source Control view.', path: 'git.svg',
					},
				},
				{
					id: 'scmSetup',
					title: localize('gettingStarted.scm.title', "用 Git 管理你的代码"),
					description: localize('gettingStarted.scmSetup.description.interpolated', "为你的项目配置内置版本控制，追踪改动并与他人协作。\n{0}", Button(localize('initRepo', "初始化 Git 仓库"), 'command:git.init')),
					when: 'false',
					media: {
						type: 'svg', altText: 'Source Control view.', path: 'git.svg',
					},
				},
				{
					id: 'scm',
					title: localize('gettingStarted.scm.title', "用 Git 管理你的代码"),
					description: localize('gettingStarted.scm.description.interpolated', "不用再查 Git 命令了，Git 与 GitHub 工作流已无缝集成。\n{0}", Button(localize('openSCM', "打开源代码管理"), 'command:workbench.view.scm')),
					when: 'false',
					media: {
						type: 'svg', altText: 'Source Control view.', path: 'git.svg',
					},
				},
				{
					id: 'installGit',
					title: localize('gettingStarted.installGit.title', "安装 Git"),
					description: localize({ key: 'gettingStarted.installGit.description.interpolated', comment: ['The placeholders are command link items should not be translated'] }, "安装 Git 以跟踪项目中的更改。\r\n{0}\r\n安装后 {1}重新加载窗口{2} 以完成 Git 安装。", Button(localize('installGit', "安装 Git"), 'https://aka.ms/vscode-install-git'), '[', '](command:workbench.action.reloadWindow)'),
					when: 'false',
					media: {
						type: 'svg', altText: 'Install Git.', path: 'git.svg',
					},
					completionEvents: [
						'onContext:git.state == initialized'
					]
				},

				{
					id: 'tasks',
					title: localize('gettingStarted.tasks.title', "自动化你的项目任务"),
					when: 'false',
					description: localize('gettingStarted.tasks.description.interpolated', "为常用流程创建任务，享受运行脚本并自动检查结果的集成体验。\n{0}", Button(localize('runTasks', "运行自动检测到的任务"), 'command:workbench.action.tasks.runTask')),
					media: {
						type: 'svg', altText: 'Task runner.', path: 'runTask.svg',
					},
				},
				{
					id: 'shortcuts',
					title: localize('gettingStarted.shortcuts.title', "自定义快捷键"),
					description: localize('gettingStarted.shortcuts.description.interpolated', "找到常用的命令后，为它们创建自定义快捷键，一键直达。\n{0}", Button(localize('keyboardShortcuts', "键盘快捷方式"), 'command:toSide:workbench.action.openGlobalKeybindings')),
					media: {
						type: 'svg', altText: 'Interactive shortcuts.', path: 'shortcuts.svg',
					}
				},
				{
					id: 'workspaceTrust',
					title: localize('gettingStarted.workspaceTrust.title', "安全地浏览和编辑代码"),
					description: localize('gettingStarted.workspaceTrust.description.interpolated', "打开一个文件夹时，Olympia 会先限制扩展自动执行代码，确认这个文件夹是你自己的再放开。\r\n打开文件/文件夹时会提示你授予信任，以后始终可以 {0}。", Button(localize('enableTrust', "启用信任"), 'command:toSide:workbench.trust.manage')),
					when: 'workspacePlatform != \'webworker\' && !isWorkspaceTrusted && workspaceFolderCount == 0',
					media: {
						type: 'svg', altText: 'Workspace Trust editor in Restricted mode and a primary button for switching to Trusted mode.', path: 'workspaceTrust.svg'
					},
				},
			]
		}
	},
	{
		id: 'notebooks',
		title: localize('gettingStarted.notebook.title', "自定义笔记本"),
		description: '',
		icon: setupIcon,
		isFeatured: false,
		when: 'false',
		walkthroughPageTitle: localize('gettingStarted.notebook.walkthroughPageTitle', "笔记本"),
		content: {
			type: 'steps',
			steps: [
				{
					completionEvents: ['onCommand:notebook.setProfile'],
					id: 'notebookProfile',
					title: localize('gettingStarted.notebookProfile.title', "选择笔记本的布局"),
					description: localize('gettingStarted.notebookProfile.description', "把笔记本调成你喜欢的样子"),
					when: 'userHasOpenedNotebook',
					media: {
						type: 'markdown', path: 'notebookProfile'
					}
				},
			]
		}
	}
];
