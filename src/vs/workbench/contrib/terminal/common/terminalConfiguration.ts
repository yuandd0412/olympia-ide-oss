/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import type { IStringDictionary } from '../../../../base/common/collections.js';
import { IJSONSchemaSnippet } from '../../../../base/common/jsonSchema.js';
import { isMacintosh, isWindows } from '../../../../base/common/platform.js';
import { isString } from '../../../../base/common/types.js';
import { localize } from '../../../../nls.js';
import { ConfigurationScope, Extensions, IConfigurationRegistry, type IConfigurationPropertySchema } from '../../../../platform/configuration/common/configurationRegistry.js';
import product from '../../../../platform/product/common/product.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { TerminalLocationConfigValue, TerminalSettingId } from '../../../../platform/terminal/common/terminal.js';
import { terminalColorSchema, terminalIconSchema } from '../../../../platform/terminal/common/terminalPlatformConfiguration.js';
import { ConfigurationKeyValuePairs, IConfigurationMigrationRegistry, Extensions as WorkbenchExtensions } from '../../../common/configuration.js';
import { terminalContribConfiguration, TerminalContribSettingId } from '../terminalContribExports.js';
import { DEFAULT_COMMANDS_TO_SKIP_SHELL, DEFAULT_LETTER_SPACING, DEFAULT_LINE_HEIGHT, MAXIMUM_FONT_WEIGHT, MINIMUM_FONT_WEIGHT, SUGGESTIONS_FONT_WEIGHT } from './terminal.js';

const terminalDescriptors = '\n- ' + [
	'`\${cwd}`: ' + localize("cwd", "终端当前的工作目录。"),
	'`\${cwdFolder}`: ' + localize('cwdFolder', "终端当前的工作目录，在多根工作区中显示，或在单根工作区中当其取值与初始工作目录不同时显示。在 Windows 上，只有启用 shell 集成后才会显示此项。"),
	'`\${workspaceFolder}`: ' + localize('workspaceFolder', "终端启动时所在的工作区。"),
	'`\${workspaceFolderName}`: ' + localize('workspaceFolderName', "终端启动时所在工作区的 `name`。"),
	'`\${local}`: ' + localize('local', "表示这是远程工作区中的本地终端。"),
	'`\${process}`: ' + localize('process', "终端进程的名称。"),
	'`\${progress}`: ' + localize('progress', "由 `OSC 9;4` 序列上报的进度状态。"),
	'`\${separator}`: ' + localize('separator', "条件分隔符 {0}，仅当它两侧是有值的变量或静态文本时才显示。", '(` - `)'),
	'`\${sequence}`: ' + localize('sequence', "进程提供给终端的名称。"),
	'`\${task}`: ' + localize('task', "表示该终端与某个任务关联。"),
	'`\${shellType}`: ' + localize('shellType', "检测到的 shell 类型。"),
	'`\${shellCommand}`: ' + localize('shellCommand', "根据 shell 集成识别出的正在执行的命令。这同样要求对所检测到的命令行有较高的置信度，在某些提示符框架中可能无法做到。"),
	'`\${shellPromptInput}`: ' + localize('shellPromptInput', "根据 shell 集成得到的 shell 完整提示输入。"),
].join('\n- '); // intentionally concatenated to not produce a string that is too long for translations

let terminalTitle = localize('terminalTitle', "控制终端标题。变量会根据上下文进行替换：");
terminalTitle += terminalDescriptors;

let terminalDescription = localize('terminalDescription', "控制终端描述，显示在标题右侧。变量会根据上下文进行替换：");
terminalDescription += terminalDescriptors;

export const defaultTerminalFontSize = isMacintosh ? 12 : 14;

const terminalConfiguration: IStringDictionary<IConfigurationPropertySchema> = {
	[TerminalSettingId.SendKeybindingsToShell]: {
		markdownDescription: localize('terminal.integrated.sendKeybindingsToShell', "将大多数快捷键分发到终端而非工作台，覆盖 {0}。也可以改用 {0} 进行精细调整。", '`#terminal.integrated.commandsToSkipShell#`'),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.TabsDefaultColor]: {
		description: localize('terminal.integrated.tabs.defaultColor', "默认与终端图标关联的主题颜色 ID。"),
		...terminalColorSchema,
		scope: ConfigurationScope.RESOURCE
	},
	[TerminalSettingId.TabsDefaultIcon]: {
		description: localize('terminal.integrated.tabs.defaultIcon', "默认与终端图标关联的 codicon ID。"),
		...terminalIconSchema,
		default: Codicon.terminal.id,
		scope: ConfigurationScope.RESOURCE
	},
	[TerminalSettingId.TabsEnabled]: {
		description: localize('terminal.integrated.tabs.enabled', "控制终端标签页是否以列表形式显示在终端旁边。禁用后将改为显示一个下拉列表。"),
		type: 'boolean',
		default: true,
	},
	[TerminalSettingId.TabsEnableAnimation]: {
		description: localize('terminal.integrated.tabs.enableAnimation', "控制终端标签页的状态是否支持动画（例如进行中的任务）。"),
		type: 'boolean',
		default: true,
	},
	[TerminalSettingId.TabsHideCondition]: {
		description: localize('terminal.integrated.tabs.hideCondition', "控制终端标签页视图是否在特定条件下隐藏。"),
		type: 'string',
		enum: ['never', 'singleTerminal', 'singleGroup'],
		enumDescriptions: [
			localize('terminal.integrated.tabs.hideCondition.never', "从不隐藏终端标签页视图"),
			localize('terminal.integrated.tabs.hideCondition.singleTerminal', "仅打开一个终端时隐藏终端标签页视图"),
			localize('terminal.integrated.tabs.hideCondition.singleGroup', "仅打开一个终端组时隐藏终端标签页视图"),
		],
		default: 'singleTerminal',
	},
	[TerminalSettingId.TabsShowActiveTerminal]: {
		description: localize('terminal.integrated.tabs.showActiveTerminal', "在视图中显示当前活动终端的信息。当标签页内的标题不可见时，这一点尤其有用。"),
		type: 'string',
		enum: ['always', 'singleTerminal', 'singleTerminalOrNarrow', 'never'],
		enumDescriptions: [
			localize('terminal.integrated.tabs.showActiveTerminal.always', "始终显示活动终端"),
			localize('terminal.integrated.tabs.showActiveTerminal.singleTerminal', "当活动终端是唯一打开的终端时显示它"),
			localize('terminal.integrated.tabs.showActiveTerminal.singleTerminalOrNarrow', "当活动终端是唯一打开的终端，或标签页视图处于窄无文字状态时显示它"),
			localize('terminal.integrated.tabs.showActiveTerminal.never', "从不显示活动终端"),
		],
		default: 'singleTerminalOrNarrow',
	},
	[TerminalSettingId.TabsShowActions]: {
		description: localize('terminal.integrated.tabs.showActions', "控制是否在新建终端按钮旁显示终端的拆分与终止按钮。"),
		type: 'string',
		enum: ['always', 'singleTerminal', 'singleTerminalOrNarrow', 'never'],
		enumDescriptions: [
			localize('terminal.integrated.tabs.showActions.always', "始终显示操作按钮"),
			localize('terminal.integrated.tabs.showActions.singleTerminal', "当它是唯一打开的终端时显示操作按钮"),
			localize('terminal.integrated.tabs.showActions.singleTerminalOrNarrow', "当它是唯一打开的终端，或标签页视图处于窄无文字状态时显示操作按钮"),
			localize('terminal.integrated.tabs.showActions.never', "从不显示操作按钮"),
		],
		default: 'singleTerminalOrNarrow',
	},
	[TerminalSettingId.TabsLocation]: {
		type: 'string',
		enum: ['left', 'right'],
		enumDescriptions: [
			localize('terminal.integrated.tabs.location.left', "在终端左侧显示终端标签页视图"),
			localize('terminal.integrated.tabs.location.right', "在终端右侧显示终端标签页视图")
		],
		default: 'right',
		description: localize('terminal.integrated.tabs.location', "控制终端标签页的位置，可在实际终端的左侧或右侧。")
	},
	[TerminalSettingId.DefaultLocation]: {
		type: 'string',
		enum: [TerminalLocationConfigValue.Editor, TerminalLocationConfigValue.TerminalView],
		enumDescriptions: [
			localize('terminal.integrated.defaultLocation.editor', "在编辑器区域创建终端"),
			localize('terminal.integrated.defaultLocation.view', "在终端视图中创建终端")
		],
		default: 'view',
		description: localize('terminal.integrated.defaultLocation', "控制新建终端显示在何处。"),
		agentsWindow: { default: 'view', readOnly: true },
	},
	[TerminalSettingId.TabsFocusMode]: {
		type: 'string',
		enum: ['singleClick', 'doubleClick'],
		enumDescriptions: [
			localize('terminal.integrated.tabs.focusMode.singleClick', "单击终端标签页时聚焦终端"),
			localize('terminal.integrated.tabs.focusMode.doubleClick', "双击终端标签页时聚焦终端")
		],
		default: 'doubleClick',
		description: localize('terminal.integrated.tabs.focusMode', "控制聚焦某个标签页的终端是发生在双击还是单击时。")
	},
	[TerminalSettingId.TabsAllowAgentCliTitle]: {
		description: localize('terminal.integrated.tabs.allowAgentCliTitle', "控制是否允许智能体命令行工具（例如 Claude Code、Codex、Command Code、GitHub Copilot CLI 和 Gemini CLI）通过转义序列设置终端标签页标题。禁用后将改用所配置的标签页标题模板。"),
		type: 'boolean',
		default: true,
	},
	[TerminalSettingId.MacOptionIsMeta]: {
		description: localize('terminal.integrated.macOptionIsMeta', "控制在 macOS 上是否把终端中的 option 键视为 meta 键。"),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.MacOptionClickForcesSelection]: {
		description: localize('terminal.integrated.macOptionClickForcesSelection', "控制是否在 macOS 上使用 Option+点击时强制选择。这会强制使用常规的（按行）选择，并禁止使用列选择模式，从而可以使用常规的终端选区来复制和粘贴内容，例如在 tmux 中启用了鼠标模式时。"),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.AltClickMovesCursor]: {
		markdownDescription: localize('terminal.integrated.altClickMovesCursor', "启用后，当 {0} 取默认值 {1} 时，Alt/Option + 点击会把提示符光标移动到鼠标所在位置的正下方。该行为能否稳定生效取决于你使用的 shell。", '`#editor.multiCursorModifier#`', '`\'alt\'`'),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.CopyOnSelection]: {
		description: localize('terminal.integrated.copyOnSelection', "控制在终端中选中的文本是否会被复制到剪贴板。"),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.EnableMultiLinePasteWarning]: {
		markdownDescription: localize('terminal.integrated.enableMultiLinePasteWarning', "控制向终端粘贴多行内容时是否显示警告对话框。"),
		type: 'string',
		enum: ['auto', 'always', 'never'],
		markdownEnumDescriptions: [
			localize('terminal.integrated.enableMultiLinePasteWarning.auto', "启用该警告，但在以下情况下不显示：\n\n- 启用了括号粘贴模式（shell 原生支持多行粘贴）\n- 粘贴由 shell 的 readline 处理（在 pwsh 的情况下）。"),
			localize('terminal.integrated.enableMultiLinePasteWarning.always', "文本包含换行符时始终显示警告。"),
			localize('terminal.integrated.enableMultiLinePasteWarning.never', "从不显示警告。")
		],
		default: 'auto'
	},
	[TerminalSettingId.DrawBoldTextInBrightColors]: {
		description: localize('terminal.integrated.drawBoldTextInBrightColors', "控制终端中的粗体文字是否始终使用「明亮」变体的 ANSI 颜色。"),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.FontFamily]: {
		markdownDescription: localize('terminal.integrated.fontFamily', "控制终端字体。默认为 {0} 的值。", '`#editor.fontFamily#`'),
		type: 'string',
	},
	[TerminalSettingId.FontRendering]: {
		markdownDescription: localize('terminal.integrated.fontRendering', "控制在高 DPI 显示器上终端文字的抗锯齿方式。"),
		type: 'string',
		enum: ['inherit', 'grayscale'],
		markdownEnumDescriptions: [
			localize('terminal.integrated.fontRendering.inherit', "跟随 {0}。", '`#workbench.fontAliasing#`'),
			localize('terminal.integrated.fontRendering.grayscale', "使用灰度抗锯齿，可让文字看起来更锐利。在启用 GPU 加速时，可能需要执行**开发人员：重新加载窗口**才能生效。")
		],
		default: 'inherit',
		tags: ['experimental', 'advanced'],
		included: isMacintosh
	},
	[TerminalSettingId.FontLigaturesEnabled]: {
		markdownDescription: localize('terminal.integrated.fontLigatures.enabled', "控制是否在终端中启用字体连字。只有当配置的 {0} 支持连字时才会生效。", `\`#${TerminalSettingId.FontFamily}#\``),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.FontLigaturesFeatureSettings]: {
		markdownDescription: localize('terminal.integrated.fontLigatures.featureSettings', "控制启用连字时使用哪些字体特性设置，格式与 CSS 属性 font-feature-settings 相同。以下是一些示例，是否有效取决于具体字体。") + '\n\n- ' + [
			`\`"calt" off, "ss03"\``,
			`\`"liga" on\``,
			`\`"calt" off, "dlig" on\``
		].join('\n- '),
		type: 'string',
		default: '"calt" on'
	},
	[TerminalSettingId.FontLigaturesFallbackLigatures]: {
		markdownDescription: localize('terminal.integrated.fontLigatures.fallbackLigatures', "当 {0} 已启用但具体的 {1} 无法被解析时，这里给出的是一组总是会被一起绘制的字符序列。这使得即使字体本身不支持连字，也能使用一组固定的连字。", `\`#${TerminalSettingId.GpuAcceleration}#\``, `\`#${TerminalSettingId.FontFamily}#\``),
		type: 'array',
		items: [{ type: 'string' }],
		default: [
			'<--', '<---', '<<-', '<-', '->', '->>', '-->', '--->',
			'<==', '<===', '<<=', '<=', '=>', '=>>', '==>', '===>', '>=', '>>=',
			'<->', '<-->', '<--->', '<---->', '<=>', '<==>', '<===>', '<====>', '::', ':::',
			'<~~', '</', '</>', '/>', '~~>', '==', '!=', '/=', '~=', '<>', '===', '!==', '!===',
			'<:', ':=', '*=', '*+', '<*', '<*>', '*>', '<|', '<|>', '|>', '+*', '=*', '=:', ':>',
			'/*', '*/', '+++', '<!--', '<!---'
		]
	},
	[TerminalSettingId.FontSize]: {
		description: localize('terminal.integrated.fontSize', "控制终端字号（像素）。"),
		type: 'number',
		default: defaultTerminalFontSize,
		minimum: 6,
		maximum: 100
	},
	[TerminalSettingId.LetterSpacing]: {
		description: localize('terminal.integrated.letterSpacing', "控制终端的字间距。该值为整数，表示字符之间额外增加的像素数。"),
		type: 'number',
		default: DEFAULT_LETTER_SPACING
	},
	[TerminalSettingId.LineHeight]: {
		description: localize('terminal.integrated.lineHeight', "控制终端行高。该数值会乘以终端字号，得到实际的行高（像素）。"),
		type: 'number',
		default: DEFAULT_LINE_HEIGHT
	},
	[TerminalSettingId.MinimumContrastRatio]: {
		markdownDescription: localize('terminal.integrated.minimumContrastRatio', "设置后，每个单元格的文字颜色都会调整为满足指定的对比度。请注意，根据 #146406，这一规则不适用于 powerline 字符。示例取值如下。\n\n- 1：不做任何处理，使用标准主题颜色。\n- 4.5：符合 [WCAG AA（最低）](https://www.w3.org/TR/UNDERSTANDING-WCAG20/visual-audio-contrast-contrast.html)（默认值）。\n- 7：符合 [WCAG AAA（增强）](https://www.w3.org/TR/UNDERSTANDING-WCAG20/visual-audio-contrast7.html)。\n- 21：黑底白字或白底黑字。"),
		type: 'number',
		default: 4.5,
		tags: ['accessibility']
	},
	[TerminalSettingId.TabStopWidth]: {
		markdownDescription: localize('terminal.integrated.tabStopWidth', "一个制表位包含的单元格数。"),
		type: 'number',
		minimum: 1,
		default: 8
	},
	[TerminalSettingId.FastScrollSensitivity]: {
		markdownDescription: localize('terminal.integrated.fastScrollSensitivity', "按住 `Alt` 时的滚动速度倍数。"),
		type: 'number',
		default: 5
	},
	[TerminalSettingId.MouseWheelScrollSensitivity]: {
		markdownDescription: localize('terminal.integrated.mouseWheelScrollSensitivity', "应用于鼠标滚轮滚动事件 `deltaY` 的倍数。"),
		type: 'number',
		default: 1
	},
	[TerminalSettingId.BellDuration]: {
		markdownDescription: localize('terminal.integrated.bellDuration', "响铃时在终端标签页内显示提示的毫秒数。"),
		type: 'number',
		default: 1000
	},
	[TerminalSettingId.FontWeight]: {
		'anyOf': [
			{
				type: 'number',
				minimum: MINIMUM_FONT_WEIGHT,
				maximum: MAXIMUM_FONT_WEIGHT,
				errorMessage: localize('terminal.integrated.fontWeightError', "只允许 \"normal\" 和 \"bold\" 关键字，或 1 到 1000 之间的数字。")
			},
			{
				type: 'string',
				pattern: '^(normal|bold|1000|[1-9][0-9]{0,2})$'
			},
			{
				enum: SUGGESTIONS_FONT_WEIGHT,
			}
		],
		description: localize('terminal.integrated.fontWeight', "终端中非粗体文字使用的字重。接受 \"normal\" 和 \"bold\" 关键字，或 1 到 1000 之间的数字。"),
		default: 'normal'
	},
	[TerminalSettingId.FontWeightBold]: {
		'anyOf': [
			{
				type: 'number',
				minimum: MINIMUM_FONT_WEIGHT,
				maximum: MAXIMUM_FONT_WEIGHT,
				errorMessage: localize('terminal.integrated.fontWeightError', "只允许 \"normal\" 和 \"bold\" 关键字，或 1 到 1000 之间的数字。")
			},
			{
				type: 'string',
				pattern: '^(normal|bold|1000|[1-9][0-9]{0,2})$'
			},
			{
				enum: SUGGESTIONS_FONT_WEIGHT,
			}
		],
		description: localize('terminal.integrated.fontWeightBold', "终端中粗体文字使用的字重。接受 \"normal\" 和 \"bold\" 关键字，或 1 到 1000 之间的数字。"),
		default: 'bold'
	},
	[TerminalSettingId.CursorBlinking]: {
		description: localize('terminal.integrated.cursorBlinking', "控制终端光标是否闪烁。"),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.TextBlinking]: {
		description: localize('terminal.integrated.textBlinking', "控制终端中是否启用文字闪烁。"),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.CursorStyle]: {
		description: localize('terminal.integrated.cursorStyle', "控制终端获得焦点时的光标样式。"),
		enum: ['block', 'line', 'underline'],
		default: 'block'
	},
	[TerminalSettingId.CursorStyleInactive]: {
		description: localize('terminal.integrated.cursorStyleInactive', "控制终端未获得焦点时的光标样式。"),
		enum: ['outline', 'block', 'line', 'underline', 'none'],
		default: 'outline'
	},
	[TerminalSettingId.CursorWidth]: {
		markdownDescription: localize('terminal.integrated.cursorWidth', "当 {0} 设为 {1} 时控制光标宽度。", '`#terminal.integrated.cursorStyle#`', '`line`'),
		type: 'number',
		default: 1
	},
	[TerminalSettingId.Scrollback]: {
		description: localize('terminal.integrated.scrollback', "控制终端缓冲区保留的最大行数。我们会依据该值预分配内存以保证流畅体验，因此该值越大，占用的内存也越多。"),
		type: 'number',
		default: 1000
	},
	[TerminalSettingId.DetectLocale]: {
		markdownDescription: localize('terminal.integrated.detectLocale', "控制是否检测并把 $LANG 环境变量设置为符合 UTF-8 的取值，因为 Olympia IDE 的终端只支持来自 shell 的 UTF-8 编码数据。"),
		type: 'string',
		enum: ['auto', 'off', 'on'],
		markdownEnumDescriptions: [
			localize('terminal.integrated.detectLocale.auto', "如果 $LANG 环境变量不存在，或者它的结尾不是 .UTF-8，则设置该变量。"),
			localize('terminal.integrated.detectLocale.off', "不设置 `$LANG` 环境变量。"),
			localize('terminal.integrated.detectLocale.on', "始终设置 `$LANG` 环境变量。")
		],
		default: 'auto'
	},
	[TerminalSettingId.GpuAcceleration]: {
		type: 'string',
		enum: ['auto', 'on', 'off'],
		markdownEnumDescriptions: [
			localize('terminal.integrated.gpuAcceleration.auto', "让 Olympia IDE 自动检测能提供最佳体验的渲染器。"),
			localize('terminal.integrated.gpuAcceleration.on', "在终端中启用 GPU 加速。"),
			localize('terminal.integrated.gpuAcceleration.off', "在终端中禁用 GPU 加速。关闭 GPU 加速后终端渲染会慢很多，但应该能在所有系统上可靠工作。"),
		],
		default: 'auto',
		description: localize('terminal.integrated.gpuAcceleration', "控制终端是否利用 GPU 进行渲染。")
	},
	[TerminalSettingId.TerminalTitleSeparator]: {
		'type': 'string',
		'default': ' - ',
		'markdownDescription': localize("terminal.integrated.tabs.separator", "{0} 和 {1} 使用的分隔符。", `\`#${TerminalSettingId.TerminalTitle}#\``, `\`#${TerminalSettingId.TerminalDescription}#\``)
	},
	[TerminalSettingId.TerminalTitle]: {
		'type': 'string',
		'default': '${process}',
		'markdownDescription': terminalTitle
	},
	[TerminalSettingId.TerminalDescription]: {
		'type': 'string',
		'default': '${task}${separator}${local}${separator}${cwdFolder}',
		'markdownDescription': terminalDescription
	},
	[TerminalSettingId.RightClickBehavior]: {
		type: 'string',
		enum: ['default', 'copyPaste', 'paste', 'selectWord', 'nothing'],
		enumDescriptions: [
			localize('terminal.integrated.rightClickBehavior.default', "显示上下文菜单。"),
			localize('terminal.integrated.rightClickBehavior.copyPaste', "有选中内容时复制，否则粘贴。"),
			localize('terminal.integrated.rightClickBehavior.paste', "右键时粘贴。"),
			localize('terminal.integrated.rightClickBehavior.selectWord', "选中光标下的单词并显示上下文菜单。"),
			localize('terminal.integrated.rightClickBehavior.nothing', "不做任何处理，把事件传递给终端。")
		],
		default: isMacintosh ? 'selectWord' : isWindows ? 'copyPaste' : 'default',
		description: localize('terminal.integrated.rightClickBehavior', "控制终端对右键单击的反应方式。")
	},
	[TerminalSettingId.MiddleClickBehavior]: {
		type: 'string',
		enum: ['default', 'paste'],
		enumDescriptions: [
			localize('terminal.integrated.middleClickBehavior.default', "采用平台默认行为来聚焦终端。在 Linux 上这还会粘贴选中的内容。"),
			localize('terminal.integrated.middleClickBehavior.paste', "中键单击时粘贴。"),
		],
		default: 'default',
		description: localize('terminal.integrated.middleClickBehavior', "控制终端对中键单击的反应方式。")
	},
	[TerminalSettingId.Cwd]: {
		restricted: true,
		description: localize('terminal.integrated.cwd', "终端启动时使用的显式起始路径，它会作为 shell 进程的当前工作目录（cwd）。如果根目录不是一个便于操作的当前工作目录，那么在工作区设置中指定它会格外有用。"),
		type: 'string',
		default: undefined,
		scope: ConfigurationScope.RESOURCE
	},
	[TerminalSettingId.ConfirmOnExit]: {
		description: localize('terminal.integrated.confirmOnExit', "控制窗口关闭时若存在活动的终端会话，是否弹出确认。由某些扩展启动的后台终端不会触发该确认。"),
		type: 'string',
		enum: ['never', 'always', 'hasChildProcesses'],
		enumDescriptions: [
			localize('terminal.integrated.confirmOnExit.never', "从不确认。"),
			localize('terminal.integrated.confirmOnExit.always', "存在终端时总是要求确认。"),
			localize('terminal.integrated.confirmOnExit.hasChildProcesses', "存在带子进程的终端时要求确认。"),
		],
		default: 'never'
	},
	[TerminalSettingId.ConfirmOnKill]: {
		description: localize('terminal.integrated.confirmOnKill', "控制终止存在子进程的终端时是否弹出确认。设为 editor 时，编辑器区域中的终端在存在子进程的情况下会被标记为已更改。请注意，对于像 Git Bash 这类不把自身进程作为 shell 子进程运行的 shell，子进程检测可能无法正常工作。由某些扩展启动的后台终端不会触发该确认。"),
		type: 'string',
		enum: ['never', 'editor', 'panel', 'always'],
		enumDescriptions: [
			localize('terminal.integrated.confirmOnKill.never', "从不确认。"),
			localize('terminal.integrated.confirmOnKill.editor', "终端位于编辑器中时要求确认。"),
			localize('terminal.integrated.confirmOnKill.panel', "终端位于面板中时要求确认。"),
			localize('terminal.integrated.confirmOnKill.always', "终端位于编辑器或面板中时要求确认。"),
		],
		default: 'editor'
	},
	[TerminalSettingId.EnableBell]: {
		markdownDeprecationMessage: localize('terminal.integrated.enableBell', "此设置已弃用。请改用 `terminal.integrated.enableVisualBell` 和 `accessibility.signals.terminalBell` 设置。"),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.EnableVisualBell]: {
		description: localize('terminal.integrated.enableVisualBell', "控制是否启用终端视觉响铃。它会显示在终端名称旁边。"),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.CommandsToSkipShell]: {
		markdownDescription: localize(
			'terminal.integrated.commandsToSkipShell',
			"一组命令 ID，它们的快捷键不会发送给 shell，而是始终由 Olympia IDE 处理。这使得那些通常会被 shell 消费的快捷键能够像终端未获得焦点时那样生效，例如用 Ctrl+P 打开快速打开。\n\n&nbsp;\n\n默认会跳过许多命令。若要覆盖某个默认项、把该命令的快捷键改为发送给 shell，请在该命令前加上 - 字符。例如添加 -workbench.action.quickOpen 即可让 Ctrl+P 传到 shell。\n\n&nbsp;\n\n在设置编辑器中查看时，下面的默认跳过命令列表会被截断。要查看完整列表，请 {1} 并搜索下面列表中的第一条命令。\n\n&nbsp;\n\n默认跳过的命令：\n\n{0}。",
			DEFAULT_COMMANDS_TO_SKIP_SHELL.sort().map(command => `- ${command}`).join('\n'),
			`[${localize('openDefaultSettingsJson', "打开默认设置 JSON")}](command:workbench.action.openRawDefaultSettings '${localize('openDefaultSettingsJson.capitalized', "打开默认设置（JSON）")}')`,

		),
		type: 'array',
		items: {
			type: 'string'
		},
		default: []
	},
	[TerminalSettingId.AllowChords]: {
		markdownDescription: localize('terminal.integrated.allowChords', "是否允许在终端中使用和弦快捷键。请注意，当此项为 true 且按键组合构成和弦时，它会绕过 {0}。如果你希望 Ctrl+K 传给 shell 而不是 Olympia IDE，设为 false 会特别有用。", '`#terminal.integrated.commandsToSkipShell#`'),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.AllowMnemonics]: {
		markdownDescription: localize('terminal.integrated.allowMnemonics', "是否允许菜单栏助记键（例如 Alt+F）触发打开菜单栏。请注意，设为 true 时所有 Alt 按键都会跳过 shell。此项在 macOS 上不起作用。"),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.EnvMacOs]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.env.osx', "环境变量对象，其中的变量会被添加到 Olympia IDE 进程，供 macOS 上的终端使用。设为 null 可删除该环境变量。"),
		type: 'object',
		additionalProperties: {
			type: ['string', 'null']
		},
		default: {}
	},
	[TerminalSettingId.EnvLinux]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.env.linux', "环境变量对象，其中的变量会被添加到 Olympia IDE 进程，供 Linux 上的终端使用。设为 null 可删除该环境变量。"),
		type: 'object',
		additionalProperties: {
			type: ['string', 'null']
		},
		default: {}
	},
	[TerminalSettingId.EnvWindows]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.env.windows', "环境变量对象，其中的变量会被添加到 Olympia IDE 进程，供 Windows 上的终端使用。设为 null 可删除该环境变量。"),
		type: 'object',
		additionalProperties: {
			type: ['string', 'null']
		},
		default: {}
	},
	[TerminalSettingId.EnvironmentChangesRelaunch]: {
		markdownDescription: localize('terminal.integrated.environmentChangesRelaunch', "当扩展希望为其环境提供内容但尚未被交互时，是否自动重新启动终端。"),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.ShowExitAlert]: {
		description: localize('terminal.integrated.showExitAlert', "控制当退出码非零时是否显示「终端进程已终止，退出码为……」的提示。"),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.WindowsUseConptyDll]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.windowsUseConptyDll', "是否使用 Olympia IDE 自带的 conpty.dll（v1.25.260303002），而不是 Windows 捆绑的那个。"),
		type: 'boolean',
		default: true,
	},
	[TerminalSettingId.SplitCwd]: {
		description: localize('terminal.integrated.splitCwd', "控制拆分终端启动时使用的工作目录。"),
		type: 'string',
		enum: ['workspaceRoot', 'initial', 'inherited'],
		enumDescriptions: [
			localize('terminal.integrated.splitCwd.workspaceRoot', "新建的拆分终端将使用工作区根目录作为工作目录。在多根工作区中会让你选择使用哪个根文件夹。"),
			localize('terminal.integrated.splitCwd.initial', "新建的拆分终端将使用父终端启动时的工作目录。"),
			localize('terminal.integrated.splitCwd.inherited', "在 macOS 和 Linux 上，新建拆分终端将使用父终端的工作目录。在 Windows 上则与初始状态相同。"),
		],
		default: 'inherited'
	},
	[TerminalSettingId.WordSeparators]: {
		markdownDescription: localize('terminal.integrated.wordSeparators', "一个字符串，包含在双击选中整个单词以及回退的单词链接检测中需要视为单词分隔符的所有字符。由于它也用于链接检测，如果包含用于检测链接的冒号等字符，那么 file:10:5 这类链接中的行号与列号部分会被忽略。"),
		type: 'string',
		// allow-any-unicode-next-line
		default: ' ()[]{}\',"`─‘’“”|'
	},
	[TerminalSettingId.EnableFileLinks]: {
		description: localize('terminal.integrated.enableFileLinks', "是否在终端中启用文件链接。在网络驱动器上工作时链接可能会变慢，尤其是因为每个文件链接都要与文件系统进行校验。修改此设置只对新打开的终端生效。"),
		type: 'string',
		enum: ['off', 'on', 'notRemote'],
		enumDescriptions: [
			localize('enableFileLinks.off', "始终关闭。"),
			localize('enableFileLinks.on', "始终开启。"),
			localize('enableFileLinks.notRemote', "仅在非远程工作区中启用。")
		],
		default: 'on'
	},
	[TerminalSettingId.AllowedLinkSchemes]: {
		description: localize('terminal.integrated.allowedLinkSchemes', "一个字符串数组，包含终端被允许打开链接的 URI 方案。出于安全考虑，默认只允许其中很小的一部分方案。"),
		type: 'array',
		items: {
			type: 'string'
		},
		default: [
			'file',
			'http',
			'https',
			'mailto',
			'vscode',
			'vscode-insiders',
		]
	},
	[TerminalSettingId.UnicodeVersion]: {
		type: 'string',
		enum: ['6', '11'],
		enumDescriptions: [
			localize('terminal.integrated.unicodeVersion.six', "Unicode 第 6 版。这是一个较旧的版本，在较老的系统上表现更好。"),
			localize('terminal.integrated.unicodeVersion.eleven', "Unicode 第 11 版。此版本在使用较新 Unicode 版本的新系统上支持更好。")
		],
		default: '11',
		description: localize('terminal.integrated.unicodeVersion', "控制终端在计算字符宽度时使用哪个 Unicode 版本。如果你发现表情符号或其它宽字符没有占据正确的宽度，或者退格键删除的内容过多或过少，可以尝试调整此设置。")
	},
	[TerminalSettingId.EnablePersistentSessions]: {
		description: localize('terminal.integrated.enablePersistentSessions', "在窗口重新加载后为该工作区保留终端会话和历史记录。"),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.PersistentSessionReviveProcess]: {
		markdownDescription: localize('terminal.integrated.persistentSessionReviveProcess', "当终端进程必须被关闭时（例如关闭窗口或应用程序时），此项决定何时恢复上一次终端会话的内容与历史记录，并在下次打开工作区时重新创建进程。\n\n注意事项：\n\n- 能否恢复进程的当前工作目录取决于 shell 是否支持。\n- 关闭期间持久化会话的时间是有限的，因此在使用高延迟的远程连接时可能会被中止。"),
		type: 'string',
		enum: ['onExit', 'onExitAndWindowClose', 'never'],
		markdownEnumDescriptions: [
			localize('terminal.integrated.persistentSessionReviveProcess.onExit', "在 Windows/Linux 上最后一个窗口关闭之后，或触发 workbench.action.quit 命令时（命令面板、快捷键、菜单），恢复这些进程。"),
			localize('terminal.integrated.persistentSessionReviveProcess.onExitAndWindowClose', "在 Windows/Linux 上最后一个窗口关闭之后，或触发 workbench.action.quit 命令时（命令面板、快捷键、菜单），或者在窗口关闭时，恢复这些进程。"),
			localize('terminal.integrated.persistentSessionReviveProcess.never', "从不恢复终端缓冲区，也不重建进程。")
		],
		default: 'onExit'
	},
	[TerminalSettingId.HideOnStartup]: {
		description: localize('terminal.integrated.hideOnStartup', "是否在启动时隐藏终端视图，从而在没有持久会话时避免创建终端。"),
		type: 'string',
		enum: ['never', 'whenEmpty', 'always'],
		markdownEnumDescriptions: [
			localize('hideOnStartup.never', "从不在启动时隐藏终端视图。"),
			localize('hideOnStartup.whenEmpty', "仅当没有恢复任何持久会话时才隐藏终端。"),
			localize('hideOnStartup.always', "始终隐藏终端，即使恢复了持久会话。")
		],
		default: 'never',
	},
	[TerminalSettingId.HideOnLastClosed]: {
		description: localize('terminal.integrated.hideOnLastClosed', "是否在最后一个终端关闭时隐藏终端视图。仅当终端是视图容器中唯一可见的视图时才会发生。"),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.CustomGlyphs]: {
		markdownDescription: localize('terminal.integrated.customGlyphs', "是否针对以下 Unicode 范围绘制自定义字形而不使用字体：\n\n{0}\n\n这通常能让连续线条的渲染效果更好，即使使用了行高和字间距设置。此功能仅在启用 {1} 后可用。", [
			'- Box Drawing (U+2500-U+257F)',
			'- Block Elements (U+2580-U+259F)',
			'- Braille Patterns (U+2800-U+28FF)',
			'- Powerline Symbols (U+E0A0-U+E0D4, Private Use Area)',
			'- Progress Indicators (U+EE00-U+EE0B, Private Use Area)',
			'- Git Branch Symbols (U+F5D0-U+F60D, Private Use Area)',
			'- Symbols for Legacy Computing (U+1FB00-U+1FBFF)'
		].join('\n'), `\`#${TerminalSettingId.GpuAcceleration}#\``),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.RescaleOverlappingGlyphs]: {
		markdownDescription: localize('terminal.integrated.rescaleOverlappingGlyphs', "是否对那些宽度为一个单元格、但字形会溢出到后续单元格的字形进行水平缩放。这通常发生在宽度不确定的字符上（例如罗马数字字符 U+2160 及以上），因为等宽字体中并不包含它们。表情符号字形永远不会被缩放。"),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.EnableKittyKeyboardProtocol]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.enableKittyKeyboardProtocol', "是否启用 kitty 键盘协议，它允许终端中的程序请求更详细的键盘输入上报。例如这可以让 Shift+Enter 交由程序处理。"),
		type: 'boolean',
		default: true,
		tags: ['advanced']
	},
	[TerminalSettingId.EnableWin32InputMode]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.enableWin32InputMode', "是否启用 win32 输入模式，它可在 Windows 上提供增强的键盘输入支持。"),
		type: 'boolean',
		default: false,
		tags: ['experimental', 'advanced'],
		experiment: {
			mode: 'auto'
		}
	},
	[TerminalSettingId.ShellIntegrationEnabled]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.shellIntegration.enabled', "决定是否自动注入 shell 集成，以支持增强的命令跟踪和当前工作目录检测等功能。 \n\nShell 集成的工作方式是在 shell 中注入一段启动脚本。该脚本让 Olympia IDE 能够了解终端内部正在发生的事情。\n\n受支持的 shell：\n\n- Linux/macOS：bash、fish、pwsh、zsh\n - Windows：pwsh、git bash\n\n此设置仅在创建终端时生效，因此你需要重启终端才能让它起作用。\n\n 请注意，如果你在终端配置中定义了自定义参数、启用了 {1}、使用了 [复杂的 bash PROMPT_COMMAND](https://code.visualstudio.com/docs/editor/integrated-terminal#_complex-bash-promptcommand)，或者存在其它不受支持的配置，脚本注入可能无法正常工作。要关闭这些装饰，请参阅 {0}。", '`#terminal.integrated.shellIntegration.decorationsEnabled#`', '`#editor.accessibilitySupport#`'),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.ShellIntegrationDecorationsEnabled]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.shellIntegration.decorationsEnabled', "启用 shell 集成后，为每条命令添加装饰标记。"),
		type: 'string',
		enum: ['both', 'gutter', 'overviewRuler', 'never'],
		enumDescriptions: [
			localize('terminal.integrated.shellIntegration.decorationsEnabled.both', "在装订线（左侧）和概览标尺（右侧）显示装饰标记"),
			localize('terminal.integrated.shellIntegration.decorationsEnabled.gutter', "在终端左侧的装订线显示装饰标记"),
			localize('terminal.integrated.shellIntegration.decorationsEnabled.overviewRuler', "在终端右侧的概览标尺显示装饰标记"),
			localize('terminal.integrated.shellIntegration.decorationsEnabled.never', "不显示装饰标记"),
		],
		default: 'both'
	},
	[TerminalSettingId.ShellIntegrationTimeout]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.shellIntegration.timeout', "配置启动之后等待 shell 集成出现的时长（毫秒），超时即判定其不存在。默认值 {0} 会根据是否启用 shell 集成注入、以及是否为远程窗口来采用不同的等待时间。取值在 1 到 499 之间时会被限制为 500 毫秒。如果你的 shell 启动非常缓慢，可以考虑把此值设得大一些。", '`-1`'),
		type: 'integer',
		minimum: -1,
		maximum: 60000,
		default: -1
	},
	[TerminalSettingId.ShellIntegrationQuickFixEnabled]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.shellIntegration.quickFixEnabled', "启用 shell 集成后，为终端命令启用快速修复，提示图标（灯泡或星光）显示在提示符左侧。"),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.ShellIntegrationEnvironmentReporting]: {
		markdownDescription: localize('terminal.integrated.shellIntegration.environmentReporting', "控制是否报告 shell 环境，以便在 {0} 等功能中使用。打印 shell 提示符时可能因此变慢。", `\`#${TerminalContribSettingId.SuggestEnabled}#\``),
		type: 'boolean',
		default: product.quality !== 'stable'
	},
	[TerminalSettingId.SmoothScrolling]: {
		markdownDescription: localize('terminal.integrated.smoothScrolling', "控制终端滚动时是否使用动画。"),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.IgnoreBracketedPasteMode]: {
		markdownDescription: localize('terminal.integrated.ignoreBracketedPasteMode', "控制终端是否忽略括号粘贴模式，即使终端已经进入了该模式，粘贴时也会省略 {0} 和 {1} 序列。当 shell 没有遵守该模式时（例如出现在子 shell 中），此设置会很有用。", '`\\x1b[200~`', '`\\x1b[201~`'),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.EnableImages]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.enableImages', "在终端中启用图片支持，只有启用 {0} 后才会生效。在 Linux 和 macOS 上支持 Sixel 与 iTerm 的内联图片协议。在所有平台上都支持 kitty 图形协议。在 Windows 上，所有图片协议仅对 ConPTY >= v2 的版本有效（Windows 本身即附带该版本），另请参阅 {1}。目前窗口重载或重连之间不会恢复图片。启用后，终端还会同时开启透明模式。", `\`#${TerminalSettingId.GpuAcceleration}#\``, `\`#${TerminalSettingId.WindowsUseConptyDll}#\``),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.FocusAfterRun]: {
		markdownDescription: localize('terminal.integrated.focusAfterRun', "控制执行「终端：在活动终端中运行选中内容」之后，聚焦终端、无障碍缓冲区，还是都不聚焦。"),
		enum: ['terminal', 'accessible-buffer', 'none'],
		default: 'none',
		tags: ['accessibility'],
		markdownEnumDescriptions: [
			localize('terminal.integrated.focusAfterRun.terminal', "始终聚焦终端。"),
			localize('terminal.integrated.focusAfterRun.accessible-buffer', "始终聚焦无障碍缓冲区。"),
			localize('terminal.integrated.focusAfterRun.none', "不做任何操作。"),
		]
	},
	[TerminalSettingId.AllowInUntrustedWorkspace]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.allowInUntrustedWorkspace', "控制是否可以在不受信任的工作区中创建终端。\n\n**此功能会绕过一项安全保护，该保护用于阻止在不受信任的工作区中启动终端。**之所以说它存在安全风险，是因为 shell 往往会被配置成可能根据当前工作目录的内容自动执行代码。只要你的 shell 配置成绝不会在该文件夹中执行代码，使用此功能就是安全的。"),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.DeveloperPtyHostLatency]: {
		description: localize('terminal.integrated.developer.ptyHost.latency', "对所有发往 pty 宿主的调用施加的模拟延迟（毫秒）。这有助于在高延迟条件下测试终端行为。"),
		type: 'number',
		minimum: 0,
		default: 0,
		tags: ['advanced']
	},
	[TerminalSettingId.DeveloperPtyHostStartupDelay]: {
		description: localize('terminal.integrated.developer.ptyHost.startupDelay', "pty 宿主进程的模拟启动延迟（毫秒）。这有助于在启动缓慢的条件下测试终端初始化。"),
		type: 'number',
		minimum: 0,
		default: 0,
		tags: ['advanced']
	},
	[TerminalSettingId.DevMode]: {
		description: localize('terminal.integrated.developer.devMode', "启用终端的开发者模式。这会显示额外的调试信息和 shell 集成序列可视化。"),
		type: 'boolean',
		default: false,
		tags: ['advanced']
	},
	...terminalContribConfiguration,
};

export async function registerTerminalConfiguration(getFontSnippets: () => Promise<IJSONSchemaSnippet[]>) {
	const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
	configurationRegistry.registerConfiguration({
		id: 'terminal',
		order: 100,
		title: localize('terminalIntegratedConfigurationTitle', "集成终端"),
		type: 'object',
		properties: terminalConfiguration,
	});
	terminalConfiguration[TerminalSettingId.FontFamily].defaultSnippets = await getFontSnippets();
}

Registry.as<IConfigurationMigrationRegistry>(WorkbenchExtensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: TerminalSettingId.EnableBell,
		migrateFn: (enableBell, accessor) => {
			const configurationKeyValuePairs: ConfigurationKeyValuePairs = [];
			let announcement = accessor('accessibility.signals.terminalBell')?.announcement ?? accessor('accessibility.alert.terminalBell');
			if (announcement !== undefined && !isString(announcement)) {
				announcement = announcement ? 'auto' : 'off';
			}
			configurationKeyValuePairs.push(['accessibility.signals.terminalBell', { value: { sound: enableBell ? 'on' : 'off', announcement } }]);
			configurationKeyValuePairs.push([TerminalSettingId.EnableBell, { value: undefined }]);
			configurationKeyValuePairs.push([TerminalSettingId.EnableVisualBell, { value: enableBell }]);
			return configurationKeyValuePairs;
		}
	}]);
