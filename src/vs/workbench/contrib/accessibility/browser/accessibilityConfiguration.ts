/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { ConfigurationScope, Extensions, IConfigurationNode, IConfigurationPropertySchema, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { workbenchConfigurationNodeBase, Extensions as WorkbenchExtensions, IConfigurationMigrationRegistry, ConfigurationKeyValuePairs, ConfigurationMigration } from '../../../common/configuration.js';
import { AccessibilitySignal } from '../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { AccessibilityVoiceSettingId, ISpeechService, SPEECH_LANGUAGES } from '../../speech/common/speechService.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { Event } from '../../../../base/common/event.js';
import { isDefined } from '../../../../base/common/types.js';

export const accessibilityHelpIsShown = new RawContextKey<boolean>('accessibilityHelpIsShown', false, true);
export const accessibleViewIsShown = new RawContextKey<boolean>('accessibleViewIsShown', false, true);
export const accessibleViewSupportsNavigation = new RawContextKey<boolean>('accessibleViewSupportsNavigation', false, true);
export const accessibleViewVerbosityEnabled = new RawContextKey<boolean>('accessibleViewVerbosityEnabled', false, true);
export const accessibleViewGoToSymbolSupported = new RawContextKey<boolean>('accessibleViewGoToSymbolSupported', false, true);
export const accessibleViewOnLastLine = new RawContextKey<boolean>('accessibleViewOnLastLine', false, true);
export const accessibleViewCurrentProviderId = new RawContextKey<string>('accessibleViewCurrentProviderId', undefined, undefined);
export const accessibleViewInCodeBlock = new RawContextKey<boolean>('accessibleViewInCodeBlock', undefined, undefined);
export const accessibleViewContainsCodeBlocks = new RawContextKey<boolean>('accessibleViewContainsCodeBlocks', undefined, undefined);
export const accessibleViewHasUnassignedKeybindings = new RawContextKey<boolean>('accessibleViewHasUnassignedKeybindings', undefined, undefined);
export const accessibleViewHasAssignedKeybindings = new RawContextKey<boolean>('accessibleViewHasAssignedKeybindings', undefined, undefined);

/**
 * Miscellaneous settings tagged with accessibility and implemented in the accessibility contrib but
 * were better to live under workbench for discoverability.
 */
export const enum AccessibilityWorkbenchSettingId {
	DimUnfocusedEnabled = 'accessibility.dimUnfocused.enabled',
	DimUnfocusedOpacity = 'accessibility.dimUnfocused.opacity',
	HideAccessibleView = 'accessibility.hideAccessibleView',
	AccessibleViewCloseOnKeyPress = 'accessibility.accessibleView.closeOnKeyPress',
	VerboseChatProgressUpdates = 'accessibility.verboseChatProgressUpdates',
	ShowChatCheckmarks = 'accessibility.chat.showCheckmarks'
}

export const enum ViewDimUnfocusedOpacityProperties {
	Default = 0.75,
	Minimum = 0.2,
	Maximum = 1
}

export const enum AccessibilityVerbositySettingId {
	Terminal = 'accessibility.verbosity.terminal',
	DiffEditor = 'accessibility.verbosity.diffEditor',
	MergeEditor = 'accessibility.verbosity.mergeEditor',
	Chat = 'accessibility.verbosity.panelChat',
	CustomizationMigrations = 'accessibility.verbosity.customizationMigrations',
	CustomizationDiscovery = 'accessibility.verbosity.customizationDiscovery',
	InlineChat = 'accessibility.verbosity.inlineChat',
	TerminalInlineChat = 'accessibility.verbosity.terminalChat',
	TerminalChatOutput = 'accessibility.verbosity.terminalChatOutput',
	InlineCompletions = 'accessibility.verbosity.inlineCompletions',
	KeybindingsEditor = 'accessibility.verbosity.keybindingsEditor',
	Notebook = 'accessibility.verbosity.notebook',
	Editor = 'accessibility.verbosity.editor',
	Hover = 'accessibility.verbosity.hover',
	Notification = 'accessibility.verbosity.notification',
	EmptyEditorHint = 'accessibility.verbosity.emptyEditorHint',
	ReplEditor = 'accessibility.verbosity.replEditor',
	Comments = 'accessibility.verbosity.comments',
	DiffEditorActive = 'accessibility.verbosity.diffEditorActive',
	Debug = 'accessibility.verbosity.debug',
	Walkthrough = 'accessibility.verbosity.walkthrough',
	ReleaseNotes = 'accessibility.verbosity.releaseNotes',
	SourceControl = 'accessibility.verbosity.sourceControl',
	Find = 'accessibility.verbosity.find',
	SessionsChat = 'accessibility.verbosity.sessionsChat',
	NewSessionWelcome = 'accessibility.verbosity.newSessionWelcome',
	SessionsChanges = 'accessibility.verbosity.sessionsChanges',
	ChatQuestionCarousel = 'accessibility.verbosity.chatQuestionCarousel',
	Survey = 'accessibility.verbosity.survey',
	Automations = 'accessibility.verbosity.automations',
	ConnectionDiagnostics = 'accessibility.verbosity.connectionDiagnostics',
	BrowserElementCommenting = 'accessibility.verbosity.browserElementCommenting',
	ChatPetAchievements = 'accessibility.verbosity.chatPetAchievements'
}

const baseVerbosityProperty: IConfigurationPropertySchema = {
	type: 'boolean',
	default: true,
	tags: ['accessibility']
};

export const accessibilityConfigurationNodeBase = Object.freeze<IConfigurationNode>({
	id: 'accessibility',
	title: localize('accessibilityConfigurationTitle', "无障碍"),
	type: 'object'
});

export const soundFeatureBase: IConfigurationPropertySchema = {
	'type': 'string',
	'enum': ['auto', 'on', 'off'],
	'default': 'auto',
	'enumDescriptions': [
		localize('sound.enabled.auto', "连接屏幕阅读器时启用声音。"),
		localize('sound.enabled.on', "启用声音。"),
		localize('sound.enabled.off', "禁用声音。")
	],
	tags: ['accessibility'],
};

const signalFeatureBase: IConfigurationPropertySchema = {
	'type': 'object',
	'tags': ['accessibility'],
	additionalProperties: false,
	default: {
		sound: 'auto',
		announcement: 'auto'
	}
};

export const announcementFeatureBase: IConfigurationPropertySchema = {
	'type': 'string',
	'enum': ['auto', 'off'],
	'default': 'auto',
	'enumDescriptions': [
		localize('announcement.enabled.auto', "启用播报，仅在屏幕阅读器优化模式下生效。"),
		localize('announcement.enabled.off', "禁用播报。")
	],
	tags: ['accessibility'],
};

const defaultNoAnnouncement: IConfigurationPropertySchema = {
	'type': 'object',
	'tags': ['accessibility'],
	additionalProperties: false,
	'default': {
		'sound': 'auto',
	}
};

const configuration: IConfigurationNode = {
	...accessibilityConfigurationNodeBase,
	scope: ConfigurationScope.RESOURCE,
	properties: {
		[AccessibilityVerbositySettingId.Terminal]: {
			description: localize('verbosity.terminal.description', "在终端获得焦点时，提供如何访问终端无障碍帮助菜单的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.DiffEditor]: {
			description: localize('verbosity.diffEditor.description', "在差异编辑器获得焦点时，提供如何在各项更改之间导航的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.Chat]: {
			description: localize('verbosity.chat.description', "在聊天输入框获得焦点时，提供如何访问聊天帮助菜单的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.CustomizationMigrations]: {
			description: localize('verbosity.customizationMigrations.description', "为自定义项迁移检查清单提供如何访问无障碍帮助的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.CustomizationDiscovery]: {
			description: localize('verbosity.customizationDiscovery.description', "在发现自定义项时，提供如何访问无障碍帮助的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.InlineChat]: {
			description: localize('verbosity.interactiveEditor.description', "在输入框获得焦点时，提供如何访问内联编辑器聊天的无障碍帮助菜单，以及如何通过提示了解该功能用法的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.TerminalChatOutput]: {
			description: localize('verbosity.terminalChatOutput.description', "提供如何在无障碍视图中打开聊天终端输出的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.InlineCompletions]: {
			description: localize('verbosity.inlineCompletions.description', "提供如何访问内联补全的悬停提示和无障碍视图的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.KeybindingsEditor]: {
			description: localize('verbosity.keybindingsEditor.description', "在快捷键编辑器的某一行获得焦点时，提供如何修改快捷键以及如何导航到结果表格的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.Notebook]: {
			description: localize('verbosity.notebook', "在笔记本单元格获得焦点时，提供如何将焦点落到单元格容器或内部编辑器上的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.Hover]: {
			description: localize('verbosity.hover', "提供如何在无障碍视图中打开悬停提示的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.Notification]: {
			description: localize('verbosity.notification', "提供如何在无障碍视图中打开通知的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.EmptyEditorHint]: {
			description: localize('verbosity.emptyEditorHint', "提供空文本编辑器中相关操作的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.ReplEditor]: {
			description: localize('verbosity.replEditor.description', "在 REPL 编辑器获得焦点时，提供如何访问 REPL 编辑器无障碍帮助菜单的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.Comments]: {
			description: localize('verbosity.comments', "提供在批注小工具中、或在包含批注的文件中可以执行哪些操作的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.DiffEditorActive]: {
			description: localize('verbosity.diffEditorActive', "在差异编辑器成为活动编辑器时给出提示。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.Debug]: {
			description: localize('verbosity.debug', "在调试控制台或运行和调试视图获得焦点时，提供如何访问调试控制台无障碍帮助对话框的信息。请注意，此项需要重新加载窗口后才会生效。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.Walkthrough]: {
			description: localize('verbosity.walkthrough', "提供如何在无障碍视图中打开演练流程的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityWorkbenchSettingId.AccessibleViewCloseOnKeyPress]: {
			markdownDescription: localize('terminal.integrated.accessibleView.closeOnKeyPress', "按下按键时，关闭无障碍视图并把焦点交还调用它的元素。"),
			type: 'boolean',
			default: true
		},
		[AccessibilityVerbositySettingId.SourceControl]: {
			description: localize('verbosity.scm', "在源代码管理输入框获得焦点时，提供如何访问源代码管理无障碍帮助菜单的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.ReleaseNotes]: {
			description: localize('verbosity.releaseNotes', "在发行说明获得焦点时，提供如何访问发行说明无障碍帮助的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.Find]: {
			description: localize('verbosity.find', "在查找输入框获得焦点时，提供如何访问查找无障碍帮助菜单的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.SessionsChat]: {
			description: localize('verbosity.sessionsChat', "在聊天输入框获得焦点时，提供如何访问智能体窗口无障碍帮助菜单的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.NewSessionWelcome]: {
			description: localize('verbosity.newSessionWelcome', "显示新的会话编辑器时播报欢迎信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.SessionsChanges]: {
			description: localize('verbosity.sessionsChanges', "在更改视图获得焦点时，提供如何访问更改视图无障碍帮助菜单的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.ChatQuestionCarousel]: {
			description: localize('verbosity.chatQuestionCarousel', "提供如何浏览和操作聊天提问轮播控件的信息，包括在适用时如何将焦点移到终端。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.Survey]: {
			description: localize('verbosity.survey', "提供如何浏览和操作调查编辑器窗格的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.Automations]: {
			description: localize('verbosity.automations', "提供如何使用自动化管理视图的信息，包括键盘导航以及如何查看已计划的运行。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.ConnectionDiagnostics]: {
			description: localize('verbosity.connectionDiagnostics', "在报告获得焦点时，提供如何访问连接诊断无障碍帮助的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.BrowserElementCommenting]: {
			description: localize('verbosity.browserElementCommenting', "提供如何在集成浏览器中访问元素批注无障碍帮助的信息。"),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.ChatPetAchievements]: {
			description: localize('verbosity.chatPetAchievements', "在成就弹窗获得焦点时，提供如何访问聊天宠物成就无障碍帮助的信息。"),
			...baseVerbosityProperty
		},
		'accessibility.signalOptions.volume': {
			'description': localize('accessibility.signalOptions.volume', "声音音量百分比（0-100）。"),
			'type': 'number',
			'minimum': 0,
			'maximum': 100,
			'default': 70,
			'tags': ['accessibility']
		},
		'accessibility.signalOptions.debouncePositionChanges': {
			'description': localize('accessibility.signalOptions.debouncePositionChanges', "位置变化是否应去抖动"),
			'type': 'boolean',
			'default': false,
			'tags': ['accessibility']
		},
		'accessibility.signalOptions.experimental.delays.general': {
			'type': 'object',
			'description': 'Delays for all signals besides error and warning at position',
			'additionalProperties': false,
			'properties': {
				'announcement': {
					'description': localize('accessibility.signalOptions.delays.general.announcement', "播报前的延迟（毫秒）。"),
					'type': 'number',
					'minimum': 0,
					'default': 3000
				},
				'sound': {
					'description': localize('accessibility.signalOptions.delays.general.sound', "播放声音前的延迟（毫秒）。"),
					'type': 'number',
					'minimum': 0,
					'default': 400
				}
			},
			'tags': ['accessibility']
		},
		'accessibility.signalOptions.experimental.delays.warningAtPosition': {
			'type': 'object',
			'additionalProperties': false,
			'properties': {
				'announcement': {
					'description': localize('accessibility.signalOptions.delays.warningAtPosition.announcement', "当该位置有警告时，播报前的延迟（毫秒）。"),
					'type': 'number',
					'minimum': 0,
					'default': 3000
				},
				'sound': {
					'description': localize('accessibility.signalOptions.delays.warningAtPosition.sound', "当该位置有警告时，播放声音前的延迟（毫秒）。"),
					'type': 'number',
					'minimum': 0,
					'default': 1000
				}
			},
			'tags': ['accessibility']
		},
		'accessibility.signalOptions.experimental.delays.errorAtPosition': {
			'type': 'object',
			'additionalProperties': false,
			'properties': {
				'announcement': {
					'description': localize('accessibility.signalOptions.delays.errorAtPosition.announcement', "当该位置有错误时，播报前的延迟（毫秒）。"),
					'type': 'number',
					'minimum': 0,
					'default': 3000
				},
				'sound': {
					'description': localize('accessibility.signalOptions.delays.errorAtPosition.sound', "当该位置有错误时，播放声音前的延迟（毫秒）。"),
					'type': 'number',
					'minimum': 0,
					'default': 1000
				}
			},
			'tags': ['accessibility']
		},
		'accessibility.signals.lineHasBreakpoint': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.lineHasBreakpoint', "当当前行有断点时发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.lineHasBreakpoint.sound', "当当前行有断点时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.lineHasBreakpoint.announcement', "当当前行有断点时进行播报。"),
					...announcementFeatureBase
				},
			},
		},
		'accessibility.signals.lineHasInlineSuggestion': {
			...defaultNoAnnouncement,
			'description': localize('accessibility.signals.lineHasInlineSuggestion', "当当前行有内联建议时播放声音/听觉提示。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.lineHasInlineSuggestion.sound', "当当前行有内联建议时播放声音。"),
					...soundFeatureBase,
					'default': 'off'
				}
			}
		},
		'accessibility.signals.nextEditSuggestion': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.nextEditSuggestion', "当出现下一处编辑建议时，播放提示信号 —— 声音/音频提示和/或语音播报（警报）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.nextEditSuggestion.sound', "当存在下一条编辑建议时播放声音。"),
					...soundFeatureBase,
				},
				'announcement': {
					'description': localize('accessibility.signals.nextEditSuggestion.announcement', "当存在下一条编辑建议时进行播报。"),
					...announcementFeatureBase,
				},
			}
		},
		'accessibility.signals.lineHasError': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.lineHasError', "当当前行有错误时发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.lineHasError.sound', "当当前行有错误时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.lineHasError.announcement', "当当前行有错误时进行播报。"),
					...announcementFeatureBase,
					default: 'off'
				},
			},
		},
		'accessibility.signals.lineHasFoldedArea': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.lineHasFoldedArea', "当当前行有可展开的折叠区域时发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.lineHasFoldedArea.sound', "当当前行有可展开的折叠区域时播放声音。"),
					...soundFeatureBase,
					default: 'off'
				},
				'announcement': {
					'description': localize('accessibility.signals.lineHasFoldedArea.announcement', "当当前行有可展开的折叠区域时进行播报。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.lineHasWarning': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.lineHasWarning', "当当前行有警告时发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.lineHasWarning.sound', "当当前行有警告时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.lineHasWarning.announcement', "当当前行有警告时进行播报。"),
					...announcementFeatureBase,
					default: 'off'
				},
			},
		},
		'accessibility.signals.positionHasError': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.positionHasError', "当当前行有警告时发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.positionHasError.sound', "当当前行有警告时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.positionHasError.announcement', "当当前行有警告时进行播报。"),
					...announcementFeatureBase,
					default: 'on'
				},
			},
		},
		'accessibility.signals.positionHasWarning': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.positionHasWarning', "当当前行有警告时发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.positionHasWarning.sound', "当当前行有警告时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.positionHasWarning.announcement', "当当前行有警告时进行播报。"),
					...announcementFeatureBase,
					default: 'on'
				},
			},
		},
		'accessibility.signals.onDebugBreak': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.onDebugBreak', "当调试器在断点处停下时发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.onDebugBreak.sound', "当调试器在断点处停下时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.onDebugBreak.announcement', "当调试器在断点处停下时进行播报。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.noInlayHints': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.noInlayHints', "当读取一行本应含内嵌提示却没有内嵌提示的内容时发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.noInlayHints.sound', "当读取一行本应含内嵌提示却没有内嵌提示的内容时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.noInlayHints.announcement', "当读取一行本应含内嵌提示却没有内嵌提示的内容时进行播报。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.taskCompleted': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.taskCompleted', "当任务完成时发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.taskCompleted.sound', "当任务完成时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.taskCompleted.announcement', "当任务完成时进行播报。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.taskFailed': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.taskFailed', "当任务失败（退出码非零）时发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.taskFailed.sound', "当任务失败（退出码非零）时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.taskFailed.announcement', "当任务失败（退出码非零）时进行播报。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.terminalCommandFailed': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.terminalCommandFailed', "当终端命令失败（退出码非零）时，或在无障碍视图中导航到具有此类退出码的命令时，播放提示信号 —— 声音（音频提示）和/或语音播报（警报）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.terminalCommandFailed.sound', "当终端命令失败（退出码非零），或在无障碍视图中导航到具有该退出码的命令时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.terminalCommandFailed.announcement', "当终端命令失败（退出码非零），或在无障碍视图中导航到具有该退出码的命令时进行播报。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.terminalCommandSucceeded': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.terminalCommandSucceeded', "当终端命令成功（退出码为零）时，或在无障碍视图中导航到具有此类退出码的命令时，播放提示信号 —— 声音（音频提示）和/或语音播报（警报）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.terminalCommandSucceeded.sound', "当终端命令成功（退出码为零），或在无障碍视图中导航到具有该退出码的命令时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.terminalCommandSucceeded.announcement', "当终端命令成功（退出码为零），或在无障碍视图中导航到具有该退出码的命令时进行播报。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.terminalQuickFix': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.terminalQuickFix', "当终端有可用的快速修复时发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.terminalQuickFix.sound', "当终端有可用的快速修复时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.terminalQuickFix.announcement', "当终端有可用的快速修复时进行播报。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.terminalBell': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.terminalBell', "当终端响铃时发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.terminalBell.sound', "当终端响铃时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.terminalBell.announcement', "当终端响铃时进行播报。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.diffLineInserted': {
			...defaultNoAnnouncement,
			'description': localize('accessibility.signals.diffLineInserted', "当焦点移到无障碍差异查看模式下的新增行，或移到下一处/上一处更改时，播放声音/听觉提示。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.sound', "当焦点移到无障碍差异查看模式下的新增行，或移到下一处/上一处更改时，播放声音。"),
					...soundFeatureBase
				}
			}
		},
		'accessibility.signals.diffLineModified': {
			...defaultNoAnnouncement,
			'description': localize('accessibility.signals.diffLineModified', "当焦点移到无障碍差异查看模式下的修改行，或移到下一处/上一处更改时，播放声音/听觉提示。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.diffLineModified.sound', "在无障碍差异查看器模式下，焦点移动到已修改的行，或移动到下一个/上一个更改时，播放提示音。"),
					...soundFeatureBase
				}
			}
		},
		'accessibility.signals.diffLineDeleted': {
			...defaultNoAnnouncement,
			'description': localize('accessibility.signals.diffLineDeleted', "当焦点移到无障碍差异查看模式下的删除行，或移到下一处/上一处更改时，播放声音/听觉提示。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.diffLineDeleted.sound', "当焦点移到无障碍差异查看模式下的删除行，或移到下一处/上一处更改时，播放声音。"),
					...soundFeatureBase
				}
			}
		},
		'accessibility.signals.chatEditModifiedFile': {
			...defaultNoAnnouncement,
			'description': localize('accessibility.signals.chatEditModifiedFile', "显示包含对话编辑改动的文件时播放声音/听觉提示"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.chatEditModifiedFile.sound', "显示包含对话编辑改动的文件时播放声音"),
					...soundFeatureBase
				}
			}
		},
		'accessibility.signals.notebookCellCompleted': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.notebookCellCompleted', "当笔记本单元格执行成功完成时发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.notebookCellCompleted.sound', "当笔记本单元格执行成功完成时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.notebookCellCompleted.announcement', "当笔记本单元格执行成功完成时进行播报。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.notebookCellFailed': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.notebookCellFailed', "当笔记本单元格执行失败时发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.notebookCellFailed.sound', "当笔记本单元格执行失败时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.notebookCellFailed.announcement', "当笔记本单元格执行失败时进行播报。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.progress': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.progress', "在进度进行期间循环发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'default': {
				'sound': 'auto',
				'announcement': 'off'
			},
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.progress.sound', "在进度进行期间循环播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.progress.announcement', "在进度进行期间循环发出提示。"),
					...announcementFeatureBase
				},
			},
		},
		'accessibility.signals.chatRequestSent': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.chatRequestSent', "当发起对话请求时发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.chatRequestSent.sound', "当发起对话请求时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.chatRequestSent.announcement', "当发起对话请求时进行播报。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.chatResponseReceived': {
			...defaultNoAnnouncement,
			'description': localize('accessibility.signals.chatResponseReceived', "收到回复时播放声音/听觉提示。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.chatResponseReceived.sound', "收到回复时播放声音。"),
					...soundFeatureBase
				},
			}
		},
		'accessibility.signals.confetti': {
			...defaultNoAnnouncement,
			'description': localize('accessibility.signals.confetti', "显示彩带庆祝动画时播放欢快的音效。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.confetti.sound', "显示彩带庆祝动画时播放欢快的声音。"),
					...soundFeatureBase
				},
			}
		},
		'accessibility.signals.codeActionTriggered': {
			...defaultNoAnnouncement,
			'description': localize('accessibility.signals.codeActionTriggered', "触发代码操作时播放声音/听觉提示。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.codeActionTriggered.sound', "触发代码操作时播放声音。"),
					...soundFeatureBase
				}
			}
		},
		'accessibility.signals.codeActionApplied': {
			...defaultNoAnnouncement,
			'description': localize('accessibility.signals.codeActionApplied', "代码操作被应用时播放声音/听觉提示。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.codeActionApplied.sound', "代码操作被应用时播放声音。"),
					...soundFeatureBase
				},
			}
		},
		'accessibility.signals.voiceRecordingStarted': {
			...defaultNoAnnouncement,
			'description': localize('accessibility.signals.voiceRecordingStarted', "录音开始时播放声音/听觉提示。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.voiceRecordingStarted.sound', "录音开始时播放声音。"),
					...soundFeatureBase,
				},
			},
			'default': {
				'sound': 'on'
			}
		},
		'accessibility.signals.voiceModeStarted': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.voiceModeStarted', "当语音模式启动时发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.voiceModeStarted.sound', "当语音模式启动时播放声音。"),
					...soundFeatureBase,
				},
				'announcement': {
					'description': localize('accessibility.signals.voiceModeStarted.announcement', "当语音模式启动时进行播报。"),
					...announcementFeatureBase,
				}
			},
			'default': {
				'sound': 'on',
				'announcement': 'auto'
			}
		},
		'accessibility.signals.voiceRecordingStopped': {
			...defaultNoAnnouncement,
			'description': localize('accessibility.signals.voiceRecordingStopped', "录音停止时播放声音/听觉提示。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.voiceRecordingStopped.sound', "录音停止时播放声音。"),
					...soundFeatureBase,
				},
			},
			'default': {
				'sound': 'on'
			}
		},
		'accessibility.signals.voiceModeStopped': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.voiceModeStopped', "当语音模式停止时发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.voiceModeStopped.sound', "当语音模式停止时播放声音。"),
					...soundFeatureBase,
				},
				'announcement': {
					'description': localize('accessibility.signals.voiceModeStopped.announcement', "当语音模式停止时进行播报。"),
					...announcementFeatureBase,
				}
			},
			'default': {
				'sound': 'on',
				'announcement': 'auto'
			}
		},
		'accessibility.signals.clear': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.clear', "当某个区域被清空时（如终端、调试控制台或输出通道）发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.clear.sound', "当某个区域被清空时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.clear.announcement', "当某个区域被清空时进行播报。"),
					...announcementFeatureBase
				},
			},
		},
		'accessibility.signals.editsUndone': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.editsUndone', "当编辑被撤销时发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.editsUndone.sound', "当编辑被撤销时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.editsUndone.announcement', "当编辑被撤销时进行播报。"),
					...announcementFeatureBase
				},
			},
		},
		'accessibility.signals.editsKept': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.editsKept', "当编辑被保留时发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.editsKept.sound', "当编辑被保留时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.editsKept.announcement', "当编辑被保留时进行播报。"),
					...announcementFeatureBase
				},
			},
		},
		'accessibility.signals.save': {
			'type': 'object',
			'tags': ['accessibility'],
			additionalProperties: false,
			'markdownDescription': localize('accessibility.signals.save', "当文件被保存时发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.save.sound', "当文件被保存时播放声音。"),
					'type': 'string',
					'enum': ['userGesture', 'always', 'never'],
					'default': 'never',
					'enumDescriptions': [
						localize('accessibility.signals.save.sound.userGesture', "当用户主动保存文件时播放该声音。"),
						localize('accessibility.signals.save.sound.always', "每当文件被保存时都播放该声音，包括自动保存。"),
						localize('accessibility.signals.save.sound.never', "从不播放声音。")
					],
				},
				'announcement': {
					'description': localize('accessibility.signals.save.announcement', "当文件被保存时进行播报。"),
					'type': 'string',
					'enum': ['userGesture', 'always', 'never'],
					'default': 'never',
					'enumDescriptions': [
						localize('accessibility.signals.save.announcement.userGesture', "当用户主动保存文件时进行播报。"),
						localize('accessibility.signals.save.announcement.always', "每当文件被保存时都进行播报，包括自动保存。"),
						localize('accessibility.signals.save.announcement.never', "从不播报。")
					],
				},
			},
			default: {
				'sound': 'never',
				'announcement': 'never'
			}
		},
		'accessibility.signals.format': {
			'type': 'object',
			'tags': ['accessibility'],
			additionalProperties: false,
			'markdownDescription': localize('accessibility.signals.format', "当文件或笔记本被格式化时发出信号 —— 声音（听觉提示）和/或播报（提示音）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.format.sound', "当文件或笔记本被格式化时播放声音。"),
					'type': 'string',
					'enum': ['userGesture', 'always', 'never'],
					'default': 'never',
					'enumDescriptions': [
						localize('accessibility.signals.format.userGesture', "当用户主动格式化文件时播放该声音。"),
						localize('accessibility.signals.format.always', "每当文件被格式化时都播放该声音，包括设为保存时、输入时、粘贴时或运行单元格时格式化。"),
						localize('accessibility.signals.format.never', "从不播放声音。")
					],
				},
				'announcement': {
					'description': localize('accessibility.signals.format.announcement', "当文件或笔记本被格式化时进行播报。"),
					'type': 'string',
					'enum': ['userGesture', 'always', 'never'],
					'default': 'never',
					'enumDescriptions': [
						localize('accessibility.signals.format.announcement.userGesture', "当用户主动格式化文件时进行播报。"),
						localize('accessibility.signals.format.announcement.always', "每当文件被格式化时都进行播报，包括设为保存时、输入时、粘贴时或运行单元格时格式化。"),
						localize('accessibility.signals.format.announcement.never', "从不播报。")
					],
				},
			},
			default: {
				'sound': 'never',
				'announcement': 'never'
			}
		},
		'accessibility.signals.chatUserActionRequired': {
			...signalFeatureBase,
			'markdownDescription': localize('accessibility.signals.chatUserActionRequired', "当聊天中需要用户进行操作时，播放提示信号 —— 声音（音频提示）和/或语音播报（警报）。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.chatUserActionRequired.sound', "当聊天中需要用户进行操作时，播放提示音。"),
					'type': 'string',
					'enum': ['auto', 'on', 'off'],
					'enumDescriptions': [
						localize('sound.enabled.autoWindow', "连接屏幕阅读器时启用声音。"),
						localize('sound.enabled.on', "启用声音。"),
						localize('sound.enabled.off', "禁用声音。")
					],
				},
				'announcement': {
					'description': localize('accessibility.signals.chatUserActionRequired.announcement', "当聊天中需要用户进行操作时发出播报，其中包含该操作的信息以及如何执行它。"),
					...announcementFeatureBase
				},
			},
			default: {
				'sound': 'auto',
				'announcement': 'auto'
			},
			tags: ['accessibility']
		},
		'accessibility.underlineLinks': {
			'type': 'boolean',
			'description': localize('accessibility.underlineLinks', "控制工作台中的链接是否加下划线。"),
			'default': false,
		},
		'accessibility.debugWatchVariableAnnouncements': {
			'type': 'boolean',
			'description': localize('accessibility.debugWatchVariableAnnouncements', "控制调试监视视图中是否播报变量的变化。"),
			'default': true,
		},
		'accessibility.replEditor.readLastExecutionOutput': {
			'type': 'boolean',
			'description': localize('accessibility.replEditor.readLastExecutedOutput', "控制是否播报原生 REPL 中某次执行的输出。"),
			'default': true,
		},
		'accessibility.replEditor.autoFocusReplExecution': {
			type: 'string',
			enum: ['none', 'input', 'lastExecution'],
			default: 'input',
			description: localize('replEditor.autoFocusAppendedCell', "控制执行代码时是否自动把焦点切换到 REPL。"),
		},
		'accessibility.windowTitleOptimized': {
			'type': 'boolean',
			'default': true,
			'markdownDescription': localize('accessibility.windowTitleOptimized', "控制在屏幕阅读器模式下是否针对屏幕阅读器优化 {0}。启用后，窗口标题末尾会追加 {1}。", '`#window.title#`', '`activeEditorState`')
		},
		'accessibility.openChatEditedFiles': {
			'type': 'boolean',
			'default': false,
			'markdownDescription': localize('accessibility.openChatEditedFiles', "控制当聊天智能体对文件应用了编辑后，是否打开这些文件。")
		},
		'accessibility.verboseChatProgressUpdates': {
			'type': 'boolean',
			'default': true,
			'markdownDescription': localize('accessibility.verboseChatProgressUpdates', "控制聊天请求进行期间是否发出详细的进度播报，包括为 <搜索词> 搜索到 X 条结果、创建了文件 <文件名>、读取了文件 <文件路径> 之类的信息。")
		}
	}
};

export function registerAccessibilityConfiguration() {
	const registry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
	registry.registerConfiguration(configuration);

	registry.registerConfiguration({
		...workbenchConfigurationNodeBase,
		properties: {
			[AccessibilityWorkbenchSettingId.DimUnfocusedEnabled]: {
				description: localize('dimUnfocusedEnabled', "是否将未获得焦点的编辑器和终端变暗，这样可以更清楚地看出输入会送到哪里。它对大多数编辑器都有效，但使用 iframe 的编辑器除外，例如笔记本和扩展的网页视图编辑器。"),
				type: 'boolean',
				default: false,
				tags: ['accessibility'],
				scope: ConfigurationScope.APPLICATION,
			},
			[AccessibilityWorkbenchSettingId.DimUnfocusedOpacity]: {
				markdownDescription: localize('dimUnfocusedOpacity', "未获得焦点的编辑器和终端所用的不透明度（0.2 到 1.0）。仅在启用 {0} 后才会生效。", `\`#${AccessibilityWorkbenchSettingId.DimUnfocusedEnabled}#\``),
				type: 'number',
				minimum: ViewDimUnfocusedOpacityProperties.Minimum,
				maximum: ViewDimUnfocusedOpacityProperties.Maximum,
				default: ViewDimUnfocusedOpacityProperties.Default,
				tags: ['accessibility'],
				scope: ConfigurationScope.APPLICATION,
			},
			[AccessibilityWorkbenchSettingId.HideAccessibleView]: {
				description: localize('accessibility.hideAccessibleView', "控制是否隐藏无障碍视图。"),
				type: 'boolean',
				default: false,
				tags: ['accessibility']
			},
			[AccessibilityWorkbenchSettingId.VerboseChatProgressUpdates]: {
				'type': 'boolean',
				'default': true,
				'markdownDescription': localize('accessibility.verboseChatProgressUpdates', "控制聊天请求进行期间是否发出详细的进度播报，包括为 <搜索词> 搜索到 X 条结果、创建了文件 <文件名>、读取了文件 <文件路径> 之类的信息。")
			},
			[AccessibilityWorkbenchSettingId.ShowChatCheckmarks]: {
				'type': 'boolean',
				'default': false,
				'tags': ['accessibility'],
				'markdownDescription': localize('accessibility.chat.showCheckmarks', "控制是否在聊天回复中已完成的工具调用和其它可折叠项上显示对勾图标。")
			}
		}
	});
}

export { AccessibilityVoiceSettingId };

export const SpeechTimeoutDefault = 0;

export class DynamicSpeechAccessibilityConfiguration extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.dynamicSpeechAccessibilityConfiguration';

	constructor(
		@ISpeechService private readonly speechService: ISpeechService
	) {
		super();

		this._register(Event.runAndSubscribe(speechService.onDidChangeHasSpeechProvider, () => this.updateConfiguration()));
	}

	private updateConfiguration(): void {
		if (!this.speechService.hasSpeechProvider) {
			return; // these settings require a speech provider
		}

		const languages = this.getLanguages();
		const languagesSorted = Object.keys(languages).sort((langA, langB) => {
			return languages[langA].name.localeCompare(languages[langB].name);
		});

		const registry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
		registry.registerConfiguration({
			...accessibilityConfigurationNodeBase,
			properties: {
				[AccessibilityVoiceSettingId.SpeechTimeout]: {
					'markdownDescription': localize('voice.speechTimeout', "在你停止说话之后，语音识别继续保持有效的时长（毫秒）。例如在一次对话中，转写出来的文本会在该超时结束后自动提交。设为 0 可禁用此功能。"),
					'type': 'number',
					'default': SpeechTimeoutDefault,
					'minimum': 0,
					'tags': ['accessibility']
				},
				[AccessibilityVoiceSettingId.IgnoreCodeBlocks]: {
					'markdownDescription': localize('voice.ignoreCodeBlocks', "是否在语音合成中忽略代码片段。"),
					'type': 'boolean',
					'default': false,
					'tags': ['accessibility']
				},
				[AccessibilityVoiceSettingId.SpeechLanguage]: {
					'markdownDescription': localize('voice.speechLanguage', "语音合成与语音识别所使用的语言。选择 auto 会在可能的情况下使用所配置的显示语言。请注意，并非所有显示语言都可能被语音识别和语音合成支持。"),
					'type': 'string',
					'enum': languagesSorted,
					'default': 'auto',
					'tags': ['accessibility'],
					'enumDescriptions': languagesSorted.map(key => languages[key].name),
					'enumItemLabels': languagesSorted.map(key => languages[key].name)
				},
				[AccessibilityVoiceSettingId.AutoSynthesize]: {
					'type': 'string',
					'enum': ['on', 'off'],
					'enumDescriptions': [
						localize('accessibility.voice.autoSynthesize.on', "启用此功能。请注意，当屏幕阅读器启用时，这会禁用 aria 更新。"),
						localize('accessibility.voice.autoSynthesize.off', "禁用该功能。"),
					],
					'markdownDescription': localize('autoSynthesize', "当输入方式为语音时，是否自动朗读文字回复。例如在一次对话中，若用语音发起了聊天请求，回复就会被自动合成朗读。"),
					'default': 'off',
					'tags': ['accessibility']
				}
			}
		});
	}

	private getLanguages(): { [locale: string]: { name: string } } {
		return {
			['auto']: {
				name: localize('speechLanguage.auto', "自动（使用显示语言）")
			},
			...SPEECH_LANGUAGES
		};
	}
}

Registry.as<IConfigurationMigrationRegistry>(WorkbenchExtensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: 'audioCues.volume',
		migrateFn: (value, accessor) => {
			return [
				['accessibility.signalOptions.volume', { value }],
				['audioCues.volume', { value: undefined }]
			];
		}
	}]);

Registry.as<IConfigurationMigrationRegistry>(WorkbenchExtensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: 'audioCues.debouncePositionChanges',
		migrateFn: (value) => {
			return [
				['accessibility.signalOptions.debouncePositionChanges', { value }],
				['audioCues.debouncePositionChanges', { value: undefined }]
			];
		}
	}]);

Registry.as<IConfigurationMigrationRegistry>(WorkbenchExtensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: 'accessibility.signalOptions',
		migrateFn: (value, accessor) => {
			const delayGeneral = getDelaysFromConfig(accessor, 'general');
			const delayError = getDelaysFromConfig(accessor, 'errorAtPosition');
			const delayWarning = getDelaysFromConfig(accessor, 'warningAtPosition');
			const volume = getVolumeFromConfig(accessor);
			const debouncePositionChanges = getDebouncePositionChangesFromConfig(accessor);
			const result: [key: string, { value: any }][] = [];
			if (!!volume) {
				result.push(['accessibility.signalOptions.volume', { value: volume }]);
			}
			if (!!delayGeneral) {
				result.push(['accessibility.signalOptions.experimental.delays.general', { value: delayGeneral }]);
			}
			if (!!delayError) {
				result.push(['accessibility.signalOptions.experimental.delays.errorAtPosition', { value: delayError }]);
			}
			if (!!delayWarning) {
				result.push(['accessibility.signalOptions.experimental.delays.warningAtPosition', { value: delayWarning }]);
			}
			if (!!debouncePositionChanges) {
				result.push(['accessibility.signalOptions.debouncePositionChanges', { value: debouncePositionChanges }]);
			}
			result.push(['accessibility.signalOptions', { value: undefined }]);
			return result;
		}
	}]);


Registry.as<IConfigurationMigrationRegistry>(WorkbenchExtensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: 'accessibility.signals.sounds.volume',
		migrateFn: (value) => {
			return [
				['accessibility.signalOptions.volume', { value }],
				['accessibility.signals.sounds.volume', { value: undefined }]
			];
		}
	}]);

Registry.as<IConfigurationMigrationRegistry>(WorkbenchExtensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: 'accessibility.signals.debouncePositionChanges',
		migrateFn: (value) => {
			return [
				['accessibility.signalOptions.debouncePositionChanges', { value }],
				['accessibility.signals.debouncePositionChanges', { value: undefined }]
			];
		}
	}]);

function getDelaysFromConfig(accessor: (key: string) => any, type: 'general' | 'errorAtPosition' | 'warningAtPosition'): { announcement: number; sound: number } | undefined {
	return accessor(`accessibility.signalOptions.experimental.delays.${type}`) || accessor('accessibility.signalOptions')?.['experimental.delays']?.[`${type}`] || accessor('accessibility.signalOptions')?.delays?.[`${type}`];
}

function getVolumeFromConfig(accessor: (key: string) => any): string | undefined {
	return accessor('accessibility.signalOptions.volume') || accessor('accessibility.signalOptions')?.volume || accessor('accessibility.signals.sounds.volume') || accessor('audioCues.volume');
}

function getDebouncePositionChangesFromConfig(accessor: (key: string) => any): number | undefined {
	return accessor('accessibility.signalOptions.debouncePositionChanges') || accessor('accessibility.signalOptions')?.debouncePositionChanges || accessor('accessibility.signals.debouncePositionChanges') || accessor('audioCues.debouncePositionChanges');
}

Registry.as<IConfigurationMigrationRegistry>(WorkbenchExtensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: AccessibilityVoiceSettingId.AutoSynthesize,
		migrateFn: (value: boolean) => {
			let newValue: string | undefined;
			if (value === true) {
				newValue = 'on';
			} else if (value === false) {
				newValue = 'off';
			} else {
				return [];
			}
			return [
				[AccessibilityVoiceSettingId.AutoSynthesize, { value: newValue }],
			];
		}
	}]);

Registry.as<IConfigurationMigrationRegistry>(WorkbenchExtensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: 'accessibility.signals.chatResponsePending',
		migrateFn: (value, accessor) => {
			return [
				['accessibility.signals.progress', { value }],
				['accessibility.signals.chatResponsePending', { value: undefined }],
			];
		}
	}]);

Registry.as<IConfigurationMigrationRegistry>(WorkbenchExtensions.ConfigurationMigration)
	.registerConfigurationMigrations(AccessibilitySignal.allAccessibilitySignals.map<ConfigurationMigration | undefined>(item => item.legacySoundSettingsKey ? ({
		key: item.legacySoundSettingsKey,
		migrateFn: (sound, accessor) => {
			const configurationKeyValuePairs: ConfigurationKeyValuePairs = [];
			const legacyAnnouncementSettingsKey = item.legacyAnnouncementSettingsKey;
			let announcement: string | undefined;
			if (legacyAnnouncementSettingsKey) {
				announcement = accessor(legacyAnnouncementSettingsKey) ?? undefined;
				if (announcement !== undefined && typeof announcement !== 'string') {
					announcement = announcement ? 'auto' : 'off';
				}
			}
			configurationKeyValuePairs.push([`${item.legacySoundSettingsKey}`, { value: undefined }]);
			configurationKeyValuePairs.push([`${item.settingsKey}`, { value: announcement !== undefined ? { announcement, sound } : { sound } }]);
			return configurationKeyValuePairs;
		}
	}) : undefined).filter(isDefined));

Registry.as<IConfigurationMigrationRegistry>(WorkbenchExtensions.ConfigurationMigration)
	.registerConfigurationMigrations(AccessibilitySignal.allAccessibilitySignals.filter(i => !!i.legacyAnnouncementSettingsKey && !!i.legacySoundSettingsKey).map(item => ({
		key: item.legacyAnnouncementSettingsKey!,
		migrateFn: (announcement, accessor) => {
			const configurationKeyValuePairs: ConfigurationKeyValuePairs = [];
			const sound = accessor(item.settingsKey)?.sound || accessor(item.legacySoundSettingsKey!);
			if (announcement !== undefined && typeof announcement !== 'string') {
				announcement = announcement ? 'auto' : 'off';
			}
			configurationKeyValuePairs.push([`${item.settingsKey}`, { value: announcement !== undefined ? { announcement, sound } : { sound } }]);
			configurationKeyValuePairs.push([`${item.legacyAnnouncementSettingsKey}`, { value: undefined }]);
			configurationKeyValuePairs.push([`${item.legacySoundSettingsKey}`, { value: undefined }]);
			return configurationKeyValuePairs;
		}
	})));
