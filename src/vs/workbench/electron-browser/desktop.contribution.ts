/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from '../../platform/registry/common/platform.js';
import { localize, localize2 } from '../../nls.js';
import { MenuRegistry, MenuId, registerAction2 } from '../../platform/actions/common/actions.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../platform/configuration/common/configurationRegistry.js';
import { KeyMod, KeyCode } from '../../base/common/keyCodes.js';
import { isLinux, isMacintosh, isWindows } from '../../base/common/platform.js';
import { ConfigureRuntimeArgumentsAction, ToggleDevToolsAction, ReloadWindowWithExtensionsDisabledAction, OpenUserDataFolderAction, ShowGPUInfoAction, ShowContentTracingAction, StopTracing, StartTracing, StartHeapTracing } from './actions/developerActions.js';
import { ZoomResetAction, ZoomOutAction, ZoomInAction, CloseWindowAction, SwitchWindowAction, QuickSwitchWindowAction, SwitchToMainWindowAction, FocusWindowAction, NewWindowTabHandler, ShowPreviousWindowTabHandler, ShowNextWindowTabHandler, MoveWindowTabToNewWindowHandler, MergeWindowTabsHandlerHandler, ToggleWindowTabsBarHandler, ToggleWindowAlwaysOnTopAction, DisableWindowAlwaysOnTopAction, EnableWindowAlwaysOnTopAction, CloseOtherWindowsAction } from './actions/windowActions.js';
import { ContextKeyExpr } from '../../platform/contextkey/common/contextkey.js';
import { KeybindingsRegistry, KeybindingWeight } from '../../platform/keybinding/common/keybindingsRegistry.js';
import { CommandsRegistry } from '../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../platform/instantiation/common/instantiation.js';
import { IsMacContext } from '../../platform/contextkey/common/contextkeys.js';
import { INativeHostService } from '../../platform/native/common/native.js';
import { IJSONContributionRegistry, Extensions as JSONExtensions } from '../../platform/jsonschemas/common/jsonContributionRegistry.js';
import { IJSONSchema } from '../../base/common/jsonSchema.js';
import { InstallShellScriptAction, UninstallShellScriptAction } from './actions/installActions.js';
import { EditorsVisibleContext, SingleEditorGroupsContext } from '../common/contextkeys.js';
import { TELEMETRY_SETTING_ID } from '../../platform/telemetry/common/telemetry.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { ShutdownReason } from '../services/lifecycle/common/lifecycle.js';
import { NativeWindow } from './window.js';
import { ModifierKeyEmitter } from '../../base/browser/dom.js';
import { applicationConfigurationNodeBase, securityConfigurationNodeBase } from '../common/configuration.js';
import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL } from '../../platform/window/electron-browser/window.js';
import product from '../../platform/product/common/product.js';

// Actions
(function registerActions(): void {

	// Actions: Zoom
	registerAction2(ZoomInAction);
	registerAction2(ZoomOutAction);
	registerAction2(ZoomResetAction);

	// Actions: Window
	registerAction2(SwitchWindowAction);
	registerAction2(QuickSwitchWindowAction);
	registerAction2(SwitchToMainWindowAction);
	registerAction2(FocusWindowAction);
	registerAction2(CloseWindowAction);
	registerAction2(CloseOtherWindowsAction);
	registerAction2(ToggleWindowAlwaysOnTopAction);
	registerAction2(EnableWindowAlwaysOnTopAction);
	registerAction2(DisableWindowAlwaysOnTopAction);

	if (isMacintosh) {
		// macOS: behave like other native apps that have documents
		// but can run without a document opened and allow to close
		// the window when the last document is closed
		// (https://github.com/microsoft/vscode/issues/126042)
		KeybindingsRegistry.registerKeybindingRule({
			id: CloseWindowAction.ID,
			weight: KeybindingWeight.WorkbenchContrib,
			when: ContextKeyExpr.and(EditorsVisibleContext.toNegated(), SingleEditorGroupsContext),
			primary: KeyMod.CtrlCmd | KeyCode.KeyW
		});
	}

	// Actions: Install Shell Script (macOS only)
	if (isMacintosh) {
		registerAction2(InstallShellScriptAction);
		registerAction2(UninstallShellScriptAction);
	}

	// Quit
	KeybindingsRegistry.registerCommandAndKeybindingRule({
		id: 'workbench.action.quit',
		weight: KeybindingWeight.WorkbenchContrib,
		async handler(accessor: ServicesAccessor) {
			const nativeHostService = accessor.get(INativeHostService);
			const configurationService = accessor.get(IConfigurationService);

			const confirmBeforeClose = configurationService.getValue<'always' | 'never' | 'keyboardOnly'>('window.confirmBeforeClose');
			if (confirmBeforeClose === 'always' || (confirmBeforeClose === 'keyboardOnly' && ModifierKeyEmitter.getInstance().isModifierPressed)) {
				const confirmed = await NativeWindow.confirmOnShutdown(accessor, ShutdownReason.QUIT);
				if (!confirmed) {
					return; // quit prevented by user
				}
			}

			nativeHostService.quit();
		},
		when: undefined,
		mac: { primary: KeyMod.CtrlCmd | KeyCode.KeyQ },
		linux: { primary: KeyMod.CtrlCmd | KeyCode.KeyQ }
	});

	// Actions: macOS Native Tabs
	if (isMacintosh) {
		for (const command of [
			{ handler: NewWindowTabHandler, id: 'workbench.action.newWindowTab', title: localize2('newTab', "新建窗口标签页") },
			{ handler: ShowPreviousWindowTabHandler, id: 'workbench.action.showPreviousWindowTab', title: localize2('showPreviousTab', "显示上一个窗口标签页") },
			{ handler: ShowNextWindowTabHandler, id: 'workbench.action.showNextWindowTab', title: localize2('showNextWindowTab', "显示下一个窗口标签页") },
			{ handler: MoveWindowTabToNewWindowHandler, id: 'workbench.action.moveWindowTabToNewWindow', title: localize2('moveWindowTabToNewWindow', "将窗口标签页移到新窗口") },
			{ handler: MergeWindowTabsHandlerHandler, id: 'workbench.action.mergeAllWindowTabs', title: localize2('mergeAllWindowTabs', "合并所有窗口") },
			{ handler: ToggleWindowTabsBarHandler, id: 'workbench.action.toggleWindowTabsBar', title: localize2('toggleWindowTabsBar', "切换窗口标签栏的显示") }
		]) {
			CommandsRegistry.registerCommand(command.id, command.handler);

			MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
				command,
				when: ContextKeyExpr.equals('config.window.nativeTabs', true)
			});
		}
	}

	// Actions: Developer
	registerAction2(ReloadWindowWithExtensionsDisabledAction);
	registerAction2(ConfigureRuntimeArgumentsAction);
	registerAction2(ToggleDevToolsAction);
	registerAction2(OpenUserDataFolderAction);
	registerAction2(ShowGPUInfoAction);
	registerAction2(ShowContentTracingAction);
	registerAction2(StopTracing);
	registerAction2(StartTracing);
	registerAction2(StartHeapTracing);
})();

// Menu
(function registerMenu(): void {

	// Quit
	MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
		group: 'z_Exit',
		command: {
			id: 'workbench.action.quit',
			title: localize({ key: 'miExit', comment: ['&& denotes a mnemonic'] }, "退出(&&X)")
		},
		order: 1,
		when: IsMacContext.toNegated()
	});
})();

// Configuration
(function registerConfiguration(): void {
	const registry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);

	// Application
	registry.registerConfiguration({
		...applicationConfigurationNodeBase,
		'properties': {
			'application.shellEnvironmentResolutionTimeout': {
				'type': 'number',
				'default': 10,
				'minimum': 1,
				'maximum': 120,
				'included': !isWindows,
				'scope': ConfigurationScope.APPLICATION,
				'markdownDescription': localize('application.shellEnvironmentResolutionTimeout', "控制当应用程序并非从终端启动时，放弃解析 shell 环境之前的超时时间（秒）。更多信息请参阅我们的[文档](https://go.microsoft.com/fwlink/?linkid=2149667)。")
			}
		}
	});

	// Window
	registry.registerConfiguration({
		'id': 'window',
		'order': 8,
		'title': localize('windowConfigurationTitle', "窗口"),
		'type': 'object',
		'properties': {
			'window.confirmSaveUntitledWorkspace': {
				'type': 'boolean',
				'default': true,
				'description': localize('confirmSaveUntitledWorkspace', "控制切换到另一个工作区时，是否弹出确认对话框，询问要保存还是丢弃当前窗口中打开的未命名工作区。禁用该确认对话框后，未命名工作区将始终被丢弃。"),
			},
			'window.openWithoutArgumentsInNewWindow': {
				'type': 'string',
				'enum': ['on', 'off'],
				'enumDescriptions': [
					localize('window.openWithoutArgumentsInNewWindow.on', "打开一个新的空窗口。"),
					localize('window.openWithoutArgumentsInNewWindow.off', "聚焦最后一个处于活动状态的运行实例。")
				],
				'default': isMacintosh ? 'off' : 'on',
				'scope': ConfigurationScope.APPLICATION,
				'markdownDescription': localize('openWithoutArgumentsInNewWindow', "控制在不带参数启动第二个实例时，是打开一个新的空窗口，还是让最后一个运行实例获得焦点。\n请注意，仍然存在一些会忽略此设置的情况（例如使用了 --new-window 或 --reuse-window 命令行选项时）。")
			},
			'window.restoreWindows': {
				'type': 'string',
				'enum': ['preserve', 'all', 'folders', 'one', 'none'],
				'enumDescriptions': [
					localize('window.reopenFolders.preserve', "始终重新打开所有窗口。如果打开了某个文件夹或工作区（例如从命令行打开），除非它之前已经打开过，否则会在新窗口中打开。如果打开的是文件，则会与此前打开的编辑器一起在某个已恢复的窗口中打开。"),
					localize('window.reopenFolders.all', "除非打开了文件夹、工作区或文件（例如从命令行打开），否则重新打开所有窗口。如果打开的是文件，它会替换该窗口中此前打开的编辑器。"),
					localize('window.reopenFolders.folders', "重新打开所有曾打开过文件夹或工作区的窗口，除非打开了文件夹、工作区或文件（例如从命令行打开）。如果打开的是文件，它会替换该窗口中此前打开的编辑器。"),
					localize('window.reopenFolders.one', "重新打开最后一个活动窗口，除非打开了文件夹、工作区或文件（例如从命令行打开）。如果打开的是文件，它会替换该窗口中此前打开的编辑器。"),
					localize('window.reopenFolders.none', "从不重新打开窗口。除非打开了某个文件夹或工作区（例如从命令行打开），否则会出现一个空窗口。")
				],
				'default': 'all',
				'scope': ConfigurationScope.APPLICATION,
				'description': localize('restoreWindows', "控制打开时如何恢复窗口以及其中的编辑器。")
			},
			'window.restoreFullscreen': {
				'type': 'boolean',
				'default': false,
				'scope': ConfigurationScope.APPLICATION,
				'description': localize('restoreFullscreen', "控制窗口若以全屏模式退出，重新打开时是否也恢复为全屏模式。")
			},
			'window.zoomLevel': {
				'type': 'number',
				'default': 0,
				'minimum': MIN_ZOOM_LEVEL,
				'maximum': MAX_ZOOM_LEVEL,
				'markdownDescription': localize({ comment: ['{0} will be a setting name rendered as a link'], key: 'zoomLevel' }, "调整所有窗口的默认缩放级别。在 0（例如 1）之上或之下（例如 -1）每增减一档，代表放大或缩小 20%。你也可以输入小数，以更精细的粒度调整缩放级别。{0} 用于配置「放大」和「缩小」命令是对所有窗口还是仅对活动窗口应用缩放级别。", '`#window.zoomPerWindow#`'),
				ignoreSync: true,
				tags: ['accessibility']
			},
			'window.zoomPerWindow': {
				'type': 'boolean',
				'default': true,
				'markdownDescription': localize({ comment: ['{0} will be a setting name rendered as a link'], key: 'zoomPerWindow' }, "控制「放大」和「缩小」命令是对所有窗口还是仅对活动窗口应用缩放级别。{0} 用于配置所有窗口的默认缩放级别。", '`#window.zoomLevel#`'),
				tags: ['accessibility']
			},
			'window.newWindowDimensions': {
				'type': 'string',
				'enum': ['default', 'inherit', 'offset', 'maximized', 'fullscreen'],
				'enumDescriptions': [
					localize('window.newWindowDimensions.default', "在屏幕中央打开新窗口。"),
					localize('window.newWindowDimensions.inherit', "以与最后一个活动窗口相同的尺寸打开新窗口。"),
					localize('window.newWindowDimensions.offset', "以与最后一个活动窗口相同的尺寸、并带位置偏移的方式打开新窗口。"),
					localize('window.newWindowDimensions.maximized', "以最大化方式打开新窗口。"),
					localize('window.newWindowDimensions.fullscreen', "以全屏模式打开新窗口。")
				],
				'default': 'default',
				'scope': ConfigurationScope.APPLICATION,
				'description': localize('newWindowDimensions', "控制已经打开至少一个窗口后，再打开新窗口时的尺寸。请注意，此设置不会影响打开的第一个窗口；第一个窗口始终会恢复到你上次关闭时留下的尺寸和位置。")
			},
			'window.closeWhenEmpty': {
				'type': 'boolean',
				'default': false,
				'description': localize('closeWhenEmpty', "控制关闭最后一个编辑器时是否也关闭该窗口。此设置仅对不显示文件夹的窗口生效。")
			},
			'window.doubleClickIconToClose': {
				'type': 'boolean',
				'default': false,
				'scope': ConfigurationScope.APPLICATION,
				'markdownDescription': localize('window.doubleClickIconToClose', "启用后，双击标题栏中的应用程序图标将关闭窗口，此时将无法再通过该图标拖动窗口。仅当 {0} 设为 custom 时此设置才生效。", '`#window.titleBarStyle#`')
			},
			'window.titleBarStyle': {
				'type': 'string',
				'enum': ['native', 'custom'],
				'default': 'custom',
				'scope': ConfigurationScope.APPLICATION,
				'description': localize('titleBarStyle', "调整窗口标题栏的外观，可选择由操作系统原生呈现或使用自定义样式。更改后需要完全重启才会生效。"),
			},
			'window.controlsStyle': {
				'type': 'string',
				'enum': ['native', 'custom', 'hidden'],
				'default': 'native',
				'included': !isMacintosh,
				'scope': ConfigurationScope.APPLICATION,
				'description': localize('controlsStyle', "调整窗口控件的外观，可选择由操作系统原生呈现、自定义绘制或隐藏。更改后需要完全重启才会生效。"),
			},
			'window.customTitleBarVisibility': {
				'type': 'string',
				'enum': ['auto', 'windowed', 'never'],
				'markdownEnumDescriptions': [
					localize(`window.customTitleBarVisibility.auto`, "自动改变自定义标题栏的可见性。"),
					localize(`window.customTitleBarVisibility.windowed`, "在全屏模式下隐藏自定义标题栏；不在全屏时则自动改变自定义标题栏的可见性。"),
					localize(`window.customTitleBarVisibility.never`, "当 {0} 设为 native 时隐藏自定义标题栏。", '`#window.titleBarStyle#`'),
				],
				'default': 'auto',
				'scope': ConfigurationScope.APPLICATION,
				'markdownDescription': localize('window.customTitleBarVisibility', "调整自定义标题栏何时显示。使用 windowed 时，自定义标题栏可以在全屏模式下被隐藏；使用 never 时，只有在 {0} 设为 native 的情况下，才会在非全屏模式下隐藏自定义标题栏。", '`#window.titleBarStyle#`'),
			},
			'window.menuStyle': {
				'type': 'string',
				'enum': ['custom', 'native', 'inherit'],
				'markdownEnumDescriptions': isMacintosh ?
					[
						localize(`window.menuStyle.custom.mac`, "使用自定义上下文菜单。"),
						localize(`window.menuStyle.native.mac`, "使用原生上下文菜单。"),
						localize(`window.menuStyle.inherit.mac`, "使上下文菜单样式与 {0} 中定义的标题栏样式保持一致。", '`#window.titleBarStyle#`'),
					] :
					[
						localize(`window.menuStyle.custom`, "使用自定义菜单。"),
						localize(`window.menuStyle.native`, "使用原生菜单。当 {0} 设为 {1} 时此项将被忽略。", '`#window.titleBarStyle#`', '`custom`'),
						localize(`window.menuStyle.inherit`, "使菜单样式与 {0} 中定义的标题栏样式保持一致。", '`#window.titleBarStyle#`'),
					],
				'default': product.quality !== 'stable' ? 'inherit' : (isMacintosh ? 'native' : 'inherit'), // TODO@bpasero figure out the default
				'scope': ConfigurationScope.APPLICATION,
				'markdownDescription': isMacintosh ?
					localize('window.menuStyle.mac', "调整上下文菜单的外观，可选择由操作系统原生呈现、自定义，或继承 {0} 中定义的标题栏样式。", '`#window.titleBarStyle#`') :
					localize('window.menuStyle', "调整菜单样式，可选择由操作系统原生呈现、自定义，或继承 {0} 中定义的标题栏样式。此项同时会影响上下文菜单的外观。更改后需要完全重启才会生效。", '`#window.titleBarStyle#`'),
				agentsWindow: { default: 'custom' },
			},
			'window.dialogStyle': {
				'type': 'string',
				'enum': ['native', 'custom'],
				'default': 'native',
				'scope': ConfigurationScope.APPLICATION,
				'description': localize('dialogStyle', "调整对话框的外观，可选择由操作系统原生呈现或使用自定义样式。"),
				agentsWindow: { default: 'custom' },
			},
			'window.nativeTabs': {
				'type': 'boolean',
				'default': false,
				'scope': ConfigurationScope.APPLICATION,
				'description': localize('window.nativeTabs', "启用 macOS 原生的窗口标签页。请注意，更改后需要完全重启才会生效，并且原生标签页会使已配置的自定义标题栏样式失效。"),
				'included': isMacintosh,
			},
			'window.nativeFullScreen': {
				'type': 'boolean',
				'default': true,
				'description': localize('window.nativeFullScreen', "控制在 macOS 上是否使用原生全屏。禁用此选项可以避免进入全屏时 macOS 新建一个桌面空间。"),
				'scope': ConfigurationScope.APPLICATION,
				'included': isMacintosh
			},
			'window.clickThroughInactive': {
				'type': 'boolean',
				'default': true,
				'scope': ConfigurationScope.APPLICATION,
				'description': localize('window.clickThroughInactive', "启用后，点击未活动的窗口会同时激活该窗口，并在鼠标下方的元素可点击时触发它。禁用后，点击未活动窗口的任意位置只会激活它，需要再点击一次才能触发该元素。"),
				'included': isMacintosh
			},
			'window.border': {
				'type': 'string',
				'default': 'default',
				'markdownDescription': (() => {
					let windowBorderDescription = localize('window.border.prefix', "控制窗口的边框颜色，可选项如下。");
					windowBorderDescription += '\n- ' + [
						localize('window.border.default', "{0}：遵循配色主题设置，回退到 Windows 设置。", '`default`'),
						localize('window.border.system', "{0}：仅遵循 Windows 设置。", '`system`'),
						localize('window.border.off', "{0}：禁用边框颜色。", '`off`'),
						localize('window.border.color', "{0}：以十六进制、RGB、RGBA、HSL 或 HSLA 格式指定具体颜色。", '`<color>`'),
					].join('\n- ');
					windowBorderDescription += '\n\n' + localize('window.border.suffix', "使用 {0} 可以为活动窗口和非活动窗口分别设置不同的颜色。当 {1} 设为 {2} 时，此设置将被忽略。", '`#workbench.colorCustomizations#`', '`#window.titleBarStyle#`', '`native`');

					return windowBorderDescription;
				})(),
				'included': isWindows
			}
		}
	});

	// Telemetry
	registry.registerConfiguration({
		'id': 'telemetry',
		'order': 110,
		title: localize('telemetryConfigurationTitle', "遥测"),
		'type': 'object',
		'properties': {
			'telemetry.enableCrashReporter': {
				'type': 'boolean',
				'description': localize('telemetry.enableCrashReporting', "启用崩溃报告的收集，这有助于我们提升稳定性。\n此选项需要重启后才会生效。"),
				'default': true,
				'tags': ['usesOnlineServices', 'telemetry'],
				'markdownDeprecationMessage': localize('enableCrashReporterDeprecated', "如果此设置为 false，无论新设置的取值如何，都不会发送任何遥测数据。由于已合并到 {0} 设置中，此项已弃用。", `\`#${TELEMETRY_SETTING_ID}#\``),
			}
		}
	});

	// Keybinding
	registry.registerConfiguration({
		'id': 'keyboard',
		'order': 15,
		'type': 'object',
		'title': localize('keyboardConfigurationTitle', "键盘"),
		'properties': {
			'keyboard.touchbar.enabled': {
				'type': 'boolean',
				'default': true,
				'description': localize('touchbar.enabled', "如果键盘带有 Touch Bar，则启用 macOS 的 Touch Bar 按钮。"),
				'included': isMacintosh
			},
			'keyboard.touchbar.ignored': {
				'type': 'array',
				'items': {
					'type': 'string'
				},
				'default': [],
				'markdownDescription': localize('touchbar.ignored', "一组标识符，指定 Touch Bar 中不应显示的条目（例如 workbench.action.navigateBack）。"),
				'included': isMacintosh
			}
		}
	});

	// Security
	registry.registerConfiguration({
		...securityConfigurationNodeBase,
		'properties': {
			'security.promptForLocalFileProtocolHandling': {
				'type': 'boolean',
				'default': true,
				'markdownDescription': localize('security.promptForLocalFileProtocolHandling', "启用后，每当即将通过协议处理程序打开本地文件或工作区时，都会弹出对话框请求确认。"),
				'scope': ConfigurationScope.APPLICATION
			},
			'security.promptForRemoteFileProtocolHandling': {
				'type': 'boolean',
				'default': true,
				'markdownDescription': localize('security.promptForRemoteFileProtocolHandling', "启用后，每当即将通过协议处理程序打开远程文件或工作区时，都会弹出对话框请求确认。"),
				'scope': ConfigurationScope.APPLICATION
			}
		}
	});
})();

// JSON Schemas
(function registerJSONSchemas(): void {
	const argvDefinitionFileSchemaId = 'vscode://schemas/argv';
	const jsonRegistry = Registry.as<IJSONContributionRegistry>(JSONExtensions.JSONContribution);
	const schema: IJSONSchema = {
		id: argvDefinitionFileSchemaId,
		allowComments: true,
		allowTrailingCommas: true,
		description: 'VSCode static command line definition file',
		type: 'object',
		additionalProperties: false,
		properties: {
			locale: {
				type: 'string',
				description: localize('argv.locale', "要使用的显示语言。选择其它语言需要先安装对应的语言包。")
			},
			'disable-lcd-text': {
				type: 'boolean',
				description: localize('argv.disableLcdText', "禁用 LCD 字体抗锯齿。")
			},
			'proxy-bypass-list': {
				type: 'string',
				description: localize('argv.proxyBypassList', "对给定的以分号分隔的主机列表绕过代理。示例值 \"<local>;*.microsoft.com;*foo.com;1.2.3.4:5678\" 表示除以下目标外，其它所有主机都使用代理服务器：本地地址（localhost、127.0.0.1 等）、microsoft.com 的子域、包含后缀 foo.com 的主机，以及 1.2.3.4:5678 上的任何目标。")
			},
			'disable-hardware-acceleration': {
				type: 'boolean',
				description: localize('argv.disableHardwareAcceleration', "禁用硬件加速。只有在遇到图形显示问题时才应修改此选项。")
			},
			'force-color-profile': {
				type: 'string',
				markdownDescription: localize('argv.forceColorProfile', "允许覆盖要使用的颜色配置文件。如果你发现颜色显示异常，可以尝试将其设为 srgb 并重启。")
			},
			'enable-crash-reporter': {
				type: 'boolean',
				markdownDescription: localize('argv.enableCrashReporter', "允许关闭崩溃报告。修改该取值后应当重启应用。")
			},
			'crash-reporter-id': {
				type: 'string',
				markdownDescription: localize('argv.crashReporterId', "用于关联由此应用实例上报的崩溃报告的唯一标识符。")
			},
			'enable-proposed-api': {
				type: 'array',
				description: localize('argv.enebleProposedApi', "为一组扩展 ID（例如 vscode.git）启用提议 API。提议 API 尚不稳定，可能在任何时候发生破坏性变更而不另行通知。此项只应出于扩展开发与测试的目的而设置。"),
				items: {
					type: 'string'
				}
			},
			'log-level': {
				type: ['string', 'array'],
				description: localize('argv.logLevel', "要使用的日志级别。默认为 info。可选取值为 error、warn、info、debug、trace、off。")
			},
			'disable-chromium-sandbox': {
				type: 'boolean',
				description: localize('argv.disableChromiumSandbox', "禁用 Chromium 沙箱。在 Linux 上以提权方式运行 Olympia IDE，或在 Windows 上运行于 AppLocker 之下时，此选项会很有用。")
			},
			'use-inmemory-secretstorage': {
				type: 'boolean',
				description: localize('argv.useInMemorySecretStorage', "确保使用内存中的存储来保存机密，而不是使用操作系统的凭据存储。运行 Olympia IDE 的扩展测试时，或当你遇到凭据存储方面的困难时，通常会用到这一项。")
			},
			'remote-debugging-port': {
				type: 'string',
				description: localize('argv.remoteDebuggingPort', "指定用于远程调试的端口。")
			},
			'js-flags': {
				type: 'string',
				description: localize('argv.jsFlags', "指定要传入的 V8 JavaScript 引擎标志（例如 --max-old-space-size=4096）。这些标志会应用到主进程、渲染进程和实用工具进程。")
			}
		}
	};
	if (isLinux) {
		schema.properties!['force-renderer-accessibility'] = {
			type: 'boolean',
			description: localize('argv.force-renderer-accessibility', "强制渲染进程处于可访问状态。只有当你在 Linux 上使用屏幕阅读器时才应修改此项；在其它平台上渲染进程会自动变为可访问。如果设置了 editor.accessibilitySupport: on，该标志会自动开启。"),
		};
		schema.properties!['password-store'] = {
			type: 'string',
			description: localize('argv.passwordStore', "配置在 Linux 上用于保存机密信息的后端。在 Windows 和 macOS 上该参数会被忽略。")
		};
	}
	if (isWindows) {
		schema.properties!['enable-rdp-display-tracking'] = {
			type: 'boolean',
			description: localize('argv.enableRDPDisplayTracking', "确保在 RDP 重新连接后，最大化的窗口能够恢复到正确的显示器上。")
		};
	}

	jsonRegistry.registerSchema(argvDefinitionFileSchemaId, schema);
})();
