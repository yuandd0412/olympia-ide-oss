/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isStandalone } from '../../base/browser/browser.js';
import { isLinux, isMacintosh, isNative, isWeb, isWindows } from '../../base/common/platform.js';
import { localize } from '../../nls.js';
import { Extensions as ConfigurationExtensions, ConfigurationScope, IConfigurationRegistry } from '../../platform/configuration/common/configurationRegistry.js';
import product from '../../platform/product/common/product.js';
import { Registry } from '../../platform/registry/common/platform.js';
import { ConfigurationKeyValuePairs, ConfigurationMigrationWorkbenchContribution, DynamicWindowConfiguration, DynamicWorkbenchSecurityConfiguration, Extensions, IConfigurationMigrationRegistry, problemsConfigurationNodeBase, windowConfigurationNodeBase, workbenchConfigurationNodeBase } from '../common/configuration.js';
import { WorkbenchPhase, registerWorkbenchContribution2 } from '../common/contributions.js';
import { NotificationsPosition, NotificationsSettings } from '../common/notifications.js';
import { ACCOUNTS_AVATAR_SETTING } from '../services/authentication/common/authentication.js';
import { CustomEditorLabelService } from '../services/editor/common/customEditorLabelService.js';
import { MOUSE_BACK_FORWARD_NAVIGATION_SETTING } from '../services/history/common/history.js';
import { ActivityBarPosition, EditorActionsLocation, EditorTabsMode, LayoutSettings, ModernUIDensity, ModernUIEditorTabStyle } from '../services/layout/browser/layoutService.js';
import { defaultWindowTitle, defaultWindowTitleSeparator } from './parts/titlebar/windowTitle.js';

const registry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);

// Configuration
(function registerConfiguration(): void {

	// Migration support
	registerWorkbenchContribution2(ConfigurationMigrationWorkbenchContribution.ID, ConfigurationMigrationWorkbenchContribution, WorkbenchPhase.Eventually);

	// Dynamic Configuration
	registerWorkbenchContribution2(DynamicWorkbenchSecurityConfiguration.ID, DynamicWorkbenchSecurityConfiguration, WorkbenchPhase.AfterRestored);

	// Workbench
	registry.registerConfiguration({
		...workbenchConfigurationNodeBase,
		'properties': {
			'workbench.externalBrowser': {
				type: 'string',
				markdownDescription: localize('browser', "配置用于在外部打开 http 或 https 链接的浏览器。可以是浏览器名称（edge、chrome、firefox），也可以是浏览器可执行文件的绝对路径。若未设置，则使用系统默认浏览器。"),
				included: isNative,
				restricted: true
			},
			'workbench.editor.titleScrollbarSizing': {
				type: 'string',
				enum: ['default', 'large'],
				enumDescriptions: [
					localize('workbench.editor.titleScrollbarSizing.default', "默认大小。"),
					localize('workbench.editor.titleScrollbarSizing.large', "增大尺寸，以便更容易用鼠标抓取。")
				],
				description: localize('tabScrollbarHeight', "控制编辑器标题区域中用于标签页和导航头的滚动条高度。"),
				default: 'default',
			},
			'workbench.editor.titleScrollbarVisibility': {
				type: 'string',
				enum: ['auto', 'visible', 'hidden'],
				enumDescriptions: [
					localize('workbench.editor.titleScrollbarVisibility.auto', "水平滚动条仅在必要时显示。"),
					localize('workbench.editor.titleScrollbarVisibility.visible', "水平滚动条始终显示。"),
					localize('workbench.editor.titleScrollbarVisibility.hidden', "水平滚动条始终隐藏。")
				],
				description: localize('titleScrollbarVisibility', "控制编辑器标题区域中用于标签页和导航头的滚动条可见性。"),
				default: 'auto',
			},
			[LayoutSettings.EDITOR_TABS_MODE]: {
				'type': 'string',
				'enum': [EditorTabsMode.MULTIPLE, EditorTabsMode.SINGLE, EditorTabsMode.NONE],
				'enumDescriptions': [
					localize('workbench.editor.showTabs.multiple', "每个编辑器在编辑器标题区中显示为一个标签页。"),
					localize('workbench.editor.showTabs.single', "活动编辑器在编辑器标题区中显示为一个大标签页。"),
					localize('workbench.editor.showTabs.none', "不显示编辑器标题区。"),
				],
				'description': localize('showEditorTabs', "控制已打开的编辑器是显示为多个独立标签页、合并为一个大标签页，还是不显示标题区域。"),
				'default': 'multiple'
			},
			[LayoutSettings.EDITOR_ACTIONS_LOCATION]: {
				'type': 'string',
				'enum': [EditorActionsLocation.DEFAULT, EditorActionsLocation.TITLEBAR, EditorActionsLocation.HIDDEN],
				'markdownEnumDescriptions': [
					localize({ comment: ['{0} will be a setting name rendered as a link'], key: 'workbench.editor.editorActionsLocation.default' }, "当 {0} 设为 {1} 时，在窗口标题栏中显示编辑器操作；否则编辑器操作显示在编辑器标签栏中。", '`#workbench.editor.showTabs#`', '`none`'),
					localize({ comment: ['{0} will be a setting name rendered as a link'], key: 'workbench.editor.editorActionsLocation.titleBar' }, "在窗口标题栏中显示编辑器操作。若 {0} 设为 {1}，则隐藏编辑器操作。", '`#window.customTitleBarVisibility#`', '`never`'),
					localize('workbench.editor.editorActionsLocation.hidden', "不显示编辑器操作。"),
				],
				'markdownDescription': localize('editorActionsLocation', "控制编辑器操作的显示位置。"),
				'default': 'default',
				agentsWindow: { default: 'default', readOnly: true },
			},
			'workbench.editor.alwaysShowEditorActions': {
				'type': 'boolean',
				'markdownDescription': localize('alwaysShowEditorActions', "控制是否始终显示编辑器操作，即使编辑器组未处于活动状态。"),
				'default': false
			},
			'workbench.editor.wrapTabs': {
				'type': 'boolean',
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'wrapTabs' }, "控制标签页超出可用空间时是换行显示还是显示滚动条。当 {0} 不为 '{1}' 时该设置无效。", '`#workbench.editor.showTabs#`', '`multiple`'),
				'default': false
			},
			'workbench.editor.scrollToSwitchTabs': {
				'type': 'boolean',
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'scrollToSwitchTabs' }, "控制在标签页上滚动是否会打开它们。默认情况下，在标签页上滚动只会显示相邻标签页，而不会打开它们。你可以在滚动时按住 Shift 键，以在该时段内改变这一行为。当 {0} 不等于 {1} 时，此设置将被忽略。", '`#workbench.editor.showTabs#`', '`multiple`'),
				'default': false
			},
			'workbench.editor.highlightModifiedTabs': {
				'type': 'boolean',
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'highlightModifiedTabs' }, "控制是否为包含未保存更改的编辑器标签页绘制顶部边框。当 {0} 不为 {1} 时该设置无效。", '`#workbench.editor.showTabs#`', `multiple`),
				'default': false
			},
			'workbench.editor.decorations.badges': {
				'type': 'boolean',
				'markdownDescription': localize('decorations.badges', "控制编辑器文件装饰是否使用徽章。"),
				'default': true
			},
			'workbench.editor.decorations.colors': {
				'type': 'boolean',
				'markdownDescription': localize('decorations.colors', "控制编辑器文件装饰是否使用颜色。"),
				'default': true
			},
			[CustomEditorLabelService.SETTING_ID_ENABLED]: {
				'type': 'boolean',
				'markdownDescription': localize('workbench.editor.label.enabled', "控制是否应用自定义的工作台编辑器标签。"),
				'default': true,
			},
			[CustomEditorLabelService.SETTING_ID_PATTERNS]: {
				'type': 'object',
				'markdownDescription': (() => {
					let customEditorLabelDescription = localize('workbench.editor.label.patterns', "控制编辑器标签的渲染方式。每个 __Item__ 都是一个匹配文件路径的模式，同时支持相对路径和绝对路径。相对路径必须包含 WORKSPACE_FOLDER（例如 WORKSPACE_FOLDER/src/**.tsx 或 */src/**.tsx）。绝对路径模式必须以 / 开头。若有多个模式同时匹配，将选择匹配路径最长的那个。每个 __Value__ 是当 __Item__ 匹配时用于渲染编辑器标签的模板，其中的变量会根据上下文进行替换：");
					customEditorLabelDescription += '\n- ' + [
						localize('workbench.editor.label.dirname', "`${dirname}`：文件所在文件夹的名称（例如 `WORKSPACE_FOLDER/folder/file.txt -> folder`）。"),
						localize('workbench.editor.label.nthdirname', "`${dirname(N)}`：文件所在的第 n 级父文件夹的名称（例如 N=2: WORKSPACE_FOLDER/static/folder/file.txt -> WORKSPACE_FOLDER）。可以使用负数从路径开头处选取文件夹（例如 N=-1: WORKSPACE_FOLDER/folder/file.txt -> WORKSPACE_FOLDER）。如果 __Item__ 是绝对路径模式，那么第一个文件夹（N=-1）指的是绝对路径中的第一个文件夹，否则对应工作区文件夹。"),
						localize('workbench.editor.label.filename', "`${filename}`：不含扩展名的文件名（例如 `WORKSPACE_FOLDER/folder/file.txt -> file`）。"),
						localize('workbench.editor.label.extname', "`${extname}`：文件扩展名（例如 `WORKSPACE_FOLDER/folder/file.txt -> txt`）。"),
						localize('workbench.editor.label.nthextname', "`${extname(N)}`：文件以英文句点分隔的第 n 个扩展名（例如 N=2: WORKSPACE_FOLDER/folder/file.ext1.ext2.ext3 -> ext1）。可以使用负数从扩展名开头处选取（例如 N=-1: WORKSPACE_FOLDER/folder/file.ext1.ext2.ext3 -> ext2）。"),
					].join('\n- '); // intentionally concatenated to not produce a string that is too long for translations
					customEditorLabelDescription += '\n\n' + localize('customEditorLabelDescriptionExample', "示例：`\"**/static/**/*.html\": \"${filename} - ${dirname} (${extname})\"` 会把文件 `WORKSPACE_FOLDER/static/folder/file.html` 渲染为 `file - folder (html)`。");

					return customEditorLabelDescription;
				})(),
				additionalProperties:
				{
					type: ['string', 'null'],
					markdownDescription: localize('workbench.editor.label.template', "模式匹配时要渲染的模板。可以包含变量 ${dirname}、${filename} 和 ${extname}。"),
					minLength: 1,
					pattern: '.*[a-zA-Z0-9].*'
				},
				'default': {}
			},
			'workbench.editor.labelFormat': {
				'type': 'string',
				'enum': ['default', 'short', 'medium', 'long'],
				'enumDescriptions': [
					localize('workbench.editor.labelFormat.default', "显示文件名。启用标签页后，如果同一组中有两个同名文件，则会附加各自路径中用于区分的部分。禁用标签页时，如果编辑器处于活动状态，则会显示相对于工作区文件夹的路径。"),
					localize('workbench.editor.labelFormat.short', "显示文件名及其所在目录名。"),
					localize('workbench.editor.labelFormat.medium', "显示文件名及其相对于工作区文件夹的路径。"),
					localize('workbench.editor.labelFormat.long', "显示文件名及其绝对路径。")
				],
				'default': 'default',
				'description': localize('tabDescription', "控制编辑器标签的格式。"),
			},
			'workbench.editor.untitled.labelFormat': {
				'type': 'string',
				'enum': ['content', 'name'],
				'enumDescriptions': [
					localize('workbench.editor.untitled.labelFormat.content', "未命名文件的名称取自其第一行的内容，除非该文件已关联到某个文件路径。如果该行为空或不含单词字符，则会回退为使用名称本身。"),
					localize('workbench.editor.untitled.labelFormat.name', "未命名文件的名称不根据文件内容生成。"),
				],
				'default': 'content',
				'description': localize('untitledLabelFormat', "控制未命名编辑器标签的格式。"),
			},
			'workbench.editor.empty.hint': {
				'type': 'string',
				'enum': ['text', 'hidden'],
				'default': 'text',
				'markdownDescription': localize("workbench.editor.empty.hint", "控制编辑器为空时的提示文字是否可见。")
			},
			'workbench.editor.languageDetection': {
				type: 'boolean',
				default: true,
				description: localize('workbench.editor.languageDetection', "控制文本编辑器中的语言是否会被自动检测，除非该语言已通过语言选择器显式设置。也可以按语言分别配置，以便指定哪些语言不需要关闭自动检测。这对于 Markdown 这类经常内嵌其它语言的语言很有用，因为内嵌内容可能会让语言检测误以为当前是内嵌的那种语言，而不是 Markdown。"),
				scope: ConfigurationScope.LANGUAGE_OVERRIDABLE
			},
			'workbench.editor.historyBasedLanguageDetection': {
				type: 'boolean',
				default: true,
				description: localize('workbench.editor.historyBasedLanguageDetection', "允许在语言检测中利用编辑器历史记录。这会让自动语言检测更偏向最近打开过的语言，并且使自动检测在较小的输入上也能正常工作。"),
			},
			'workbench.editor.preferHistoryBasedLanguageDetection': {
				type: 'boolean',
				default: false,
				description: localize('workbench.editor.preferBasedLanguageDetection', "启用后，会优先使用考虑编辑器历史记录的语言检测模型。"),
			},
			'workbench.editor.languageDetectionHints': {
				type: 'object',
				default: { 'untitledEditors': true, 'notebookEditors': true },
				description: localize('workbench.editor.showLanguageDetectionHints', "启用后，当编辑器语言与检测到的内容语言不匹配时，在状态栏显示快速修复入口。"),
				additionalProperties: false,
				properties: {
					untitledEditors: {
						type: 'boolean',
						description: localize('workbench.editor.showLanguageDetectionHints.editors', "在未命名文本编辑器中显示"),
					},
					notebookEditors: {
						type: 'boolean',
						description: localize('workbench.editor.showLanguageDetectionHints.notebook', "在笔记本编辑器中显示"),
					}
				}
			},
			'workbench.editor.tabActionLocation': {
				type: 'string',
				enum: ['left', 'right'],
				default: 'right',
				markdownDescription: localize({ comment: ['{0} will be a setting name rendered as a link'], key: 'tabActionLocation' }, "控制编辑器标签操作按钮（关闭、取消固定）的位置。当 {0} 不为 {1} 时该设置无效。", '`#workbench.editor.showTabs#`', '`multiple`')
			},
			'workbench.editor.tabActionReserveSpace': {
				type: 'boolean',
				default: true,
				description: localize('workbench.editor.tabActionReserveSpace', "控制新版界面的编辑器标签页是否始终为标签操作按钮预留空间。禁用时，干净的标签页保持紧凑；带常驻脏标记或固定标记的标签页仍会预留空间。")
			},
			'workbench.editor.tabActionCloseVisibility': {
				type: 'boolean',
				default: true,
				description: localize('workbench.editor.tabActionCloseVisibility', "控制标签页关闭按钮的可见性。")
			},
			'workbench.editor.tabActionUnpinVisibility': {
				type: 'boolean',
				default: true,
				description: localize('workbench.editor.tabActionUnpinVisibility', "控制标签页取消固定按钮的可见性。")
			},
			'workbench.editor.showTabIndex': {
				'type': 'boolean',
				'default': false,
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'showTabIndex' }, "启用后显示标签页序号。当 {0} 不为 {1} 时该设置无效。", '`#workbench.editor.showTabs#`', '`multiple`')
			},
			'workbench.editor.tabSizing': {
				'type': 'string',
				'enum': ['fit', 'shrink', 'fixed'],
				'default': 'fit',
				'enumDescriptions': [
					localize('workbench.editor.tabSizing.fit', "始终保持标签页足够大，以显示完整的编辑器标签。"),
					localize('workbench.editor.tabSizing.shrink', "当可用空间不足以一次显示所有标签页时，允许标签页缩小。"),
					localize('workbench.editor.tabSizing.fixed', "使所有标签页大小一致，同时在可用空间不足时允许它们缩小。")
				],
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'tabSizing' }, "控制编辑器标签页的大小。当 {0} 不为 {1} 时该设置无效。", '`#workbench.editor.showTabs#`', '`multiple`')
			},
			'workbench.editor.tabSizingFixedMinWidth': {
				'type': 'number',
				'default': 50,
				'minimum': 38,
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'workbench.editor.tabSizingFixedMinWidth' }, "当 {0} 大小设为 {1} 时，控制标签页的最小宽度。", '`#workbench.editor.tabSizing#`', '`fixed`')
			},
			'workbench.editor.tabSizingFixedMaxWidth': {
				'type': 'number',
				'default': 160,
				'minimum': 38,
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'workbench.editor.tabSizingFixedMaxWidth' }, "当 {0} 大小设为 {1} 时，控制标签页的最大宽度。", '`#workbench.editor.tabSizing#`', '`fixed`')
			},
			'window.density.editorTabHeight': {
				'type': 'string',
				'enum': ['default', 'compact'],
				'default': 'default',
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'workbench.editor.tabHeight' }, "控制编辑器标签页的高度。当 {0} 不为 {1} 时，该设置同样适用于标题控制栏。", '`#workbench.editor.showTabs#`', '`multiple`')
			},
			[LayoutSettings.MODERN_UI_DENSITY]: {
				'type': 'string',
				'enum': [ModernUIDensity.Default, ModernUIDensity.Compact],
				'enumDescriptions': [
					localize('windowDensityLayout.default', "使用工作台各部分之间的标准间距。"),
					localize('windowDensityLayout.compact', "移除工作台各部分之间的间隙并缩小其内部间距，为内容提供更多空间。"),
				],
				'default': ModernUIDensity.Default,
				'markdownDescription': localize({ key: 'windowDensityLayout', comment: ['{0} is a placeholder for a setting identifier.'] }, "控制工作台布局的间距密度。仅在启用 {0} 时生效。", '`#workbench.experimental.modernUI#`'),
			},
			'workbench.editor.pinnedTabSizing': {
				'type': 'string',
				'enum': ['normal', 'compact', 'shrink'],
				'default': 'normal',
				'enumDescriptions': [
					localize('workbench.editor.pinnedTabSizing.normal', "固定的标签页沿用未固定标签页的外观。"),
					localize('workbench.editor.pinnedTabSizing.compact', "固定的标签页以紧凑形式显示，仅包含图标或编辑器名称的首字母。"),
					localize('workbench.editor.pinnedTabSizing.shrink', "固定的标签页缩小为紧凑的固定大小，显示编辑器名称的部分内容。")
				],
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'pinnedTabSizing' }, "控制固定编辑器标签页的大小。固定标签页排在所有已打开标签页的最前面，通常在取消固定前不会关闭。当 {0} 不为 {1} 时该设置无效。", '`#workbench.editor.showTabs#`', '`multiple`')
			},
			'workbench.editor.pinnedTabsOnSeparateRow': {
				'type': 'boolean',
				'default': false,
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'workbench.editor.pinnedTabsOnSeparateRow' }, "启用后，固定标签页显示在其他所有标签页上方的独立行中。当 {0} 不为 {1} 时该设置无效。", '`#workbench.editor.showTabs#`', '`multiple`'),
			},
			'workbench.editor.preventPinnedEditorClose': {
				'type': 'string',
				'enum': ['keyboardAndMouse', 'keyboard', 'mouse', 'never'],
				'default': 'keyboardAndMouse',
				'enumDescriptions': [
					localize('workbench.editor.preventPinnedEditorClose.always', "使用鼠标中键或键盘时，始终阻止关闭固定的编辑器。"),
					localize('workbench.editor.preventPinnedEditorClose.onlyKeyboard', "使用键盘时阻止关闭固定的编辑器。"),
					localize('workbench.editor.preventPinnedEditorClose.onlyMouse', "使用鼠标中键时阻止关闭固定的编辑器。"),
					localize('workbench.editor.preventPinnedEditorClose.never', "从不阻止关闭固定的编辑器。")
				],
				description: localize('workbench.editor.preventPinnedEditorClose', "控制使用键盘或鼠标中键关闭时，是否关闭固定的编辑器。"),
			},
			'workbench.editor.splitSizing': {
				'type': 'string',
				'enum': ['auto', 'distribute', 'split'],
				'default': 'auto',
				'enumDescriptions': [
					localize('workbench.editor.splitSizingAuto', "将活动编辑器组拆分为等份，除非所有编辑器组已经是等份；此时会将所有编辑器组拆分为等份。"),
					localize('workbench.editor.splitSizingDistribute', "将所有编辑器组拆分为等份。"),
					localize('workbench.editor.splitSizingSplit', "将活动编辑器组拆分为等份。")
				],
				'description': localize('splitSizing', "控制拆分时编辑器组的大小。"),
				'keywords': ['pane']
			},
			'workbench.editor.splitOnDragAndDrop': {
				'type': 'boolean',
				'default': true,
				'description': localize('splitOnDragAndDrop', "控制是否可以通过将编辑器或文件拖放到编辑器区域边缘来拆分编辑器组。"),
				'keywords': ['pane']
			},
			'workbench.editor.dragToOpenWindow': {
				'type': 'boolean',
				'default': true,
				'markdownDescription': localize('dragToOpenWindow', "控制是否可以将编辑器拖出窗口以在新窗口中打开。拖动时按住 `Alt` 键可动态切换此行为。")
			},
			'workbench.editor.focusRecentEditorAfterClose': {
				'type': 'boolean',
				'description': localize('focusRecentEditorAfterClose', "控制关闭编辑器时是按最近使用顺序还是从左到右。"),
				'default': true
			},
			'workbench.editor.showIcons': {
				'type': 'boolean',
				'description': localize('showIcons', "控制已打开的编辑器是否显示图标。该功能需要同时启用文件图标主题。"),
				'default': true
			},
			'workbench.editor.enablePreview': {
				'type': 'boolean',
				'description': localize('enablePreview', "控制打开编辑器时是否使用预览模式。每个编辑器组最多只能存在一个处于预览模式的编辑器。该编辑器会在标签页、标题标签以及已打开的编辑器视图中以斜体显示其文件名。其内容会被下一个以预览模式打开的编辑器替换。在预览模式的编辑器中做出修改会将其持久保留，双击它的标签、或在它的标签右键菜单中选择「保持打开」也一样。从资源管理器中双击打开文件会立即保留对应的编辑器。"),
				'default': true
			},
			'workbench.editor.enablePreviewFromQuickOpen': {
				'type': 'boolean',
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'enablePreviewFromQuickOpen' }, "控制从快速打开中打开的编辑器是否显示为预览编辑器。预览编辑器不会保持打开，会被反复复用，直到通过双击或编辑显式将其设为保持打开。启用后，在选择前按住 Ctrl 可以非预览方式打开编辑器。当 {0} 不等于 {1} 时，此设置将被忽略。", '`#workbench.editor.showTabs#`', '`multiple`'),
				'default': false
			},
			'workbench.editor.enablePreviewFromCodeNavigation': {
				'type': 'boolean',
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'enablePreviewFromCodeNavigation' }, "控制从编辑器启动代码导航时，该编辑器是否仍保持预览状态。预览编辑器不会保持打开，会被反复复用，直到通过双击或编辑显式将其设为保持打开。当 {0} 不等于 {1} 时，此设置将被忽略。", '`#workbench.editor.showTabs#`', '`multiple`'),
				'default': false
			},
			'workbench.editor.closeOnFileDelete': {
				'type': 'boolean',
				'description': localize('closeOnFileDelete', "控制显示文件的编辑器，在该文件被其它进程删除或重命名时是否自动关闭。禁用后，遇到此类事件时编辑器会保持打开。请注意，在应用程序内部删除文件始终会关闭对应的编辑器，而存在未保存更改的编辑器则永远不会关闭，以保护你的数据。"),
				'default': false
			},
			'workbench.editor.openPositioning': {
				'type': 'string',
				'enum': ['left', 'right', 'first', 'last'],
				'default': 'right',
				'markdownDescription': localize({ comment: ['{0}, {1}, {2}, {3} will be a setting name rendered as a link'], key: 'editorOpenPositioning' }, "控制编辑器打开的位置。选择 {0} 或 {1} 可在当前活动编辑器的左侧或右侧打开；选择 {2} 或 {3} 可独立于当前活动编辑器打开。", '`left`', '`right`', '`first`', '`last`')
			},
			'workbench.editor.openSideBySideDirection': {
				'type': 'string',
				'enum': ['right', 'down'],
				'default': 'right',
				'markdownDescription': localize('sideBySideDirection', "控制并排打开的编辑器（例如从资源管理器中打开时）的默认方向。默认情况下，编辑器会打开在当前活动编辑器的右侧。如果改为 down，则编辑器会打开在当前活动编辑器的下方。这也会影响编辑器工具栏中的拆分编辑器操作。")
			},
			'workbench.editor.closeEmptyGroups': {
				'type': 'boolean',
				'description': localize('closeEmptyGroups', "控制关闭组内最后一个标签页时空编辑器组的行为。启用时空组会自动关闭；禁用时空组会保留在布局中。"),
				'default': true,
				'keywords': ['pane']
			},
			'workbench.editor.revealIfOpen': {
				'type': 'boolean',
				'description': localize('revealIfOpen', "控制打开某个编辑器时，如果它在任一可见的组中已经打开，是否将其显示出来。禁用时，编辑器会优先在当前活动的编辑器组中打开。启用时，已经打开的编辑器会被直接显示，而不是在当前活动的编辑器组中重复打开。请注意，有些情况下此设置会被忽略，例如强制在指定组中打开编辑器，或强制在当前活动组的侧边打开时。"),
				'default': false
			},
			'workbench.editor.useModal': {
				'type': 'string',
				'enum': ['off', 'some', 'all'],
				'enumDescriptions': [
					localize('useModal.off', "编辑器从不在模态浮层中打开。"),
					localize('useModal.some', "某些编辑器（如设置和键盘快捷方式）可能在居中的模态浮层中打开。"),
					localize('useModal.all', "所有编辑器都在居中的模态浮层中打开。"),
				],
				'description': localize('useModal', "控制编辑器是否在模态浮层中打开。"),
				'default': 'some',
				experiment: {
					mode: 'startup'
				}
			},
			'workbench.editor.swipeToNavigate': {
				'type': 'boolean',
				'description': localize('swipeToNavigate', "使用三指水平滑动在打开的文件之间导航。注意：系统偏好设置 > 触控板 > 更多手势 > \"页面之间轻扫\"必须设为\"用两指或三指轻扫\"。"),
				'default': false,
				'included': isMacintosh && !isWeb
			},
			[MOUSE_BACK_FORWARD_NAVIGATION_SETTING]: {
				'type': 'boolean',
				'description': localize('mouseBackForwardToNavigate', "启用鼠标第四、第五按键来执行\"后退\"和\"前进\"命令。"),
				'default': true
			},
			'workbench.editor.navigationScope': {
				'type': 'string',
				'enum': ['default', 'editorGroup', 'editor'],
				'default': 'default',
				'markdownDescription': localize('navigationScope', "控制编辑器中\"后退\"\"前进\"等命令的历史导航范围。"),
				'enumDescriptions': [
					localize('workbench.editor.navigationScopeDefault', "在所有已打开的编辑器和编辑器组之间导航。"),
					localize('workbench.editor.navigationScopeEditorGroup', "仅在活动编辑器组的编辑器中导航。"),
					localize('workbench.editor.navigationScopeEditor', "仅在活动编辑器中导航。")
				],
			},
			'workbench.editor.restoreViewState': {
				'type': 'boolean',
				'markdownDescription': localize('restoreViewState', "在编辑器被关闭后重新打开时，恢复它上一次的编辑器视图状态（例如滚动位置）。编辑器视图状态按编辑器组分别存储，并在该组关闭时被丢弃。如果某个编辑器组没有找到先前的视图状态，可以使用 {0} 设置，以跨所有编辑器组沿用最后一次已知的视图状态。", '`#workbench.editor.sharedViewState#`'),
				'default': true,
				'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE
			},
			'workbench.editor.sharedViewState': {
				'type': 'boolean',
				'description': localize('sharedViewState', "在所有编辑器组之间保留最近的编辑器视图状态（如滚动位置）；若找不到该编辑器组特有的视图状态，则恢复此状态。"),
				'default': false
			},
			'workbench.editor.restoreEditors': {
				'type': 'boolean',
				'description': localize('restoreOnStartup', "控制启动时是否恢复编辑器。禁用时，仅从上次的会话中恢复有未保存更改的编辑器。"),
				'default': true,
				agentsWindow: { default: false, readOnly: true },
			},
			'workbench.editor.splitInGroupLayout': {
				'type': 'string',
				'enum': ['vertical', 'horizontal'],
				'default': 'horizontal',
				'markdownDescription': localize('splitInGroupLayout', "控制在编辑器组内拆分编辑器时采用垂直还是水平布局。"),
				'enumDescriptions': [
					localize('workbench.editor.splitInGroupLayoutVertical', "编辑器自上而下排列。"),
					localize('workbench.editor.splitInGroupLayoutHorizontal', "编辑器自左向右排列。")
				]
			},
			'workbench.editor.centeredLayoutAutoResize': {
				'type': 'boolean',
				'default': true,
				'description': localize('centeredLayoutAutoResize', "控制居中布局在打开多个组时是否自动调整为最大宽度。当只剩一个组时会恢复为原始居中宽度。")
			},
			'workbench.editor.centeredLayoutFixedWidth': {
				'type': 'boolean',
				'default': false,
				'description': localize('centeredLayoutDynamicWidth', "控制居中布局在调整窗口大小时是否尝试保持宽度恒定。")
			},
			'workbench.editor.doubleClickTabToToggleEditorGroupSizes': {
				'type': 'string',
				'enum': ['maximize', 'expand', 'off'],
				'default': 'expand',
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'doubleClickTabToToggleEditorGroupSizes' }, "控制双击标签页时如何调整编辑器组大小。当 {0} 不为 {1} 时该设置无效。", '`#workbench.editor.showTabs#`', '`multiple`'),
				'enumDescriptions': [
					localize('workbench.editor.doubleClickTabToToggleEditorGroupSizes.maximize', "隐藏所有其他编辑器组，并将当前编辑器组最大化以占满整个编辑区域。"),
					localize('workbench.editor.doubleClickTabToToggleEditorGroupSizes.expand', "通过将所有其他编辑器组缩到最小，使当前编辑器组占据尽可能多的空间。"),
					localize('workbench.editor.doubleClickTabToToggleEditorGroupSizes.off', "双击标签页时不调整任何编辑器组的大小。")
				],
				agentsWindow: { default: 'maximize', readOnly: true },
			},
			'workbench.editor.limit.enabled': {
				'type': 'boolean',
				'default': false,
				'description': localize('limitEditorsEnablement', "控制是否限制已打开编辑器的数量。启用后，较久未使用的编辑器会被关闭以为新编辑器腾出空间。")
			},
			'workbench.editor.limit.value': {
				'type': 'number',
				'default': 10,
				'exclusiveMinimum': 0,
				'markdownDescription': localize('limitEditorsMaximum', "控制已打开编辑器的最大数量。使用 {0} 设置可控制该限制是按编辑器组还是对所有组生效。", '`#workbench.editor.limit.perEditorGroup#`')
			},
			'workbench.editor.limit.excludeDirty': {
				'type': 'boolean',
				'default': false,
				'description': localize('limitEditorsExcludeDirty', "控制统计已打开编辑器数量时是否排除有未保存更改的编辑器。")
			},
			'workbench.editor.limit.perEditorGroup': {
				'type': 'boolean',
				'default': false,
				'description': localize('perEditorGroup', "控制已打开编辑器数量上限是按编辑器组生效还是对所有编辑器组生效。")
			},
			'workbench.localHistory.enabled': {
				'type': 'boolean',
				'default': true,
				'description': localize('localHistoryEnabled', "控制是否启用本地文件历史记录。启用后，已保存的编辑器内容会被存储到备份位置，以便日后恢复或查阅。修改此设置不会影响已有的本地文件历史记录条目。"),
				'scope': ConfigurationScope.RESOURCE
			},
			'workbench.localHistory.maxFileSize': {
				'type': 'number',
				'default': 256,
				'minimum': 1,
				'description': localize('localHistoryMaxFileSize', "控制多大的文件（以 KB 为单位）才纳入本地文件历史记录。超过该大小的文件不会被加入本地文件历史记录。修改此设置不会影响已有的本地文件历史记录条目。"),
				'scope': ConfigurationScope.RESOURCE
			},
			'workbench.localHistory.maxFileEntries': {
				'type': 'number',
				'default': 50,
				'minimum': 0,
				'description': localize('localHistoryMaxFileEntries', "控制每个文件的本地历史记录条目上限。当某文件的本地历史条目数超过该值时，最旧的条目将被丢弃。"),
				'scope': ConfigurationScope.RESOURCE
			},
			'workbench.localHistory.exclude': {
				'type': 'object',
				'patternProperties': {
					'.*': { 'type': 'boolean' }
				},
				'markdownDescription': localize('exclude', "配置要从本地文件历史记录中排除的文件路径或 [glob 模式](https://aka.ms/vscode-glob-patterns)。除非使用绝对路径，否则 glob 模式始终相对于工作区文件夹的路径进行求值。修改此设置不会影响已有的本地文件历史记录条目。"),
				'scope': ConfigurationScope.RESOURCE
			},
			'workbench.localHistory.mergeWindow': {
				'type': 'number',
				'default': 10,
				'minimum': 1,
				'markdownDescription': localize('mergeWindow', "配置一个以秒为单位的时间间隔，在该间隔内本地文件历史记录的最后一条记录会被新加入的记录替换。这有助于减少新增记录的总量，例如在启用自动保存时。此设置仅对来源相同的记录生效。修改此设置不会影响已有的本地文件历史记录条目。"),
				'scope': ConfigurationScope.RESOURCE
			},
			'workbench.commandPalette.history': {
				'type': 'number',
				'description': localize('commandHistory', "控制命令面板保留在历史记录中的最近使用命令数量。设为 0 可禁用命令历史。"),
				'default': 50,
				'minimum': 0
			},
			'workbench.commandPalette.preserveInput': {
				'type': 'boolean',
				'description': localize('preserveInput', "控制下次打开命令面板时是否恢复上次输入的内容。"),
				'default': false
			},
			'workbench.commandPalette.experimental.suggestCommands': {
				'type': 'boolean',
				tags: ['experimental'],
				'description': localize('suggestCommands', "控制命令面板是否显示常用命令列表。"),
				'default': false
			},
			'workbench.commandPalette.experimental.askChatLocation': {
				'type': 'string',
				tags: ['experimental'],
				'description': localize('askChatLocation', "控制命令面板在何处向聊天提问。"),
				'default': 'chatView',
				enum: ['chatView', 'quickChat'],
				enumDescriptions: [
					localize('askChatLocation.chatView', "在聊天视图中提问。"),
					localize('askChatLocation.quickChat', "在快速聊天中提问。")
				]
			},
			'workbench.commandPalette.showAskInChat': {
				'type': 'boolean',
				tags: ['experimental'],
				'description': localize('showAskInChat', "控制命令面板底部是否显示\"在聊天中提问\"选项。"),
				'default': true
			},
			'workbench.commandPalette.experimental.enableNaturalLanguageSearch': {
				'type': 'boolean',
				tags: ['experimental'],
				'description': localize('enableNaturalLanguageSearch', "控制命令面板是否包含相似命令。必须安装提供自然语言支持的扩展。"),
				'default': true
			},
			'workbench.quickOpen.closeOnFocusLost': {
				'type': 'boolean',
				'description': localize('closeOnFocusLost', "控制快速打开在失去焦点后是否自动关闭。"),
				'default': true
			},
			'workbench.quickOpen.preserveInput': {
				'type': 'boolean',
				'description': localize('workbench.quickOpen.preserveInput', "控制下次打开快速打开时是否恢复上次输入的内容。"),
				'default': false
			},
			'workbench.settings.openDefaultSettings': {
				'type': 'boolean',
				'description': localize('openDefaultSettings', "控制打开设置时是否同时打开显示所有默认设置的编辑器。"),
				'default': false
			},
			'workbench.settings.useSplitJSON': {
				'type': 'boolean',
				'markdownDescription': localize('useSplitJSON', "控制以 JSON 格式编辑设置时是否使用分栏 JSON 编辑器。"),
				'default': false
			},
			'workbench.settings.openDefaultKeybindings': {
				'type': 'boolean',
				'description': localize('openDefaultKeybindings', "控制打开快捷键设置时是否同时打开显示所有默认快捷键的编辑器。"),
				'default': false
			},
			'workbench.settings.alwaysShowAdvancedSettings': {
				'type': 'boolean',
				'description': localize('alwaysShowAdvancedSettings', "控制设置编辑器是否始终显示高级设置，而无需 `@tag:advanced` 筛选器。"),
				'default': product.quality !== 'stable'
			},
			'workbench.sideBar.location': {
				'type': 'string',
				'enum': ['left', 'right'],
				'default': 'left',
				'description': localize('sideBarLocation', "控制主侧边栏和活动栏的位置。它们可以显示在工作台的左侧或右侧，辅助侧边栏则显示在工作台的另一侧。"),
				agentsWindow: { default: 'left', readOnly: true },
			},
			'workbench.panel.showLabels': {
				'type': 'boolean',
				'default': true,
				'description': localize('panelShowLabels', "控制面板标题中的活动项显示为标签还是图标。"),
			},
			'workbench.panel.defaultLocation': {
				'type': 'string',
				'enum': ['left', 'bottom', 'top', 'right'],
				'default': 'bottom',
				'description': localize('panelDefaultLocation', "控制新工作区中面板（终端、调试控制台、输出、问题）的默认位置，可显示在编辑区域的下、上、右或左侧。"),
				agentsWindow: { default: 'bottom', readOnly: true },
			},
			'workbench.panel.opensMaximized': {
				'type': 'string',
				'enum': ['always', 'never', 'preserve'],
				'default': 'preserve',
				'description': localize('panelOpensMaximized', "控制面板是否以最大化方式打开。可以始终最大化打开、从不最大化打开，或恢复为上次关闭前的状态。"),
				'enumDescriptions': [
					localize('workbench.panel.opensMaximized.always', "打开面板时始终最大化。"),
					localize('workbench.panel.opensMaximized.never', "打开面板时从不最大化。"),
					localize('workbench.panel.opensMaximized.preserve', "将面板恢复为关闭前的状态。")
				],
				agentsWindow: { default: 'never', readOnly: true },
			},
			'workbench.secondarySideBar.defaultVisibility': {
				'type': 'string',
				'enum': ['hidden', 'visibleInWorkspace', 'visible', 'maximizedInWorkspace', 'maximized'],
				'default': 'visibleInWorkspace',
				'description': localize('secondarySideBarDefaultVisibility', "控制首次打开的工作区或空窗口中辅助侧边栏的默认可见性。可由智能体会话启动编辑器设置覆盖。"),
				'enumDescriptions': [
					localize('workbench.secondarySideBar.defaultVisibility.hidden', "辅助侧边栏默认隐藏。"),
					localize('workbench.secondarySideBar.defaultVisibility.visibleInWorkspace', "打开工作区时辅助侧边栏默认可见。"),
					localize('workbench.secondarySideBar.defaultVisibility.visible', "辅助侧边栏默认可见。"),
					localize('workbench.secondarySideBar.defaultVisibility.maximizedInWorkspace', "打开工作区时辅助侧边栏默认可见并最大化。"),
					localize('workbench.secondarySideBar.defaultVisibility.maximized', "辅助侧边栏默认可见并最大化。")
				],
				agentsWindow: { default: 'visibleInWorkspace', readOnly: true },
			},
			'workbench.secondarySideBar.forceMaximized': {
				'type': 'boolean',
				'default': false,
				tags: ['experimental'],
				'description': localize('secondarySideBarForceMaximized', "在支持辅助侧边栏最大化的布局中，控制是否强制辅助侧边栏在启动时以及没有打开的编辑器时始终以最大化方式显示。"),
				agentsWindow: { default: false, readOnly: true },
			},
			'workbench.secondarySideBar.showLabels': {
				'type': 'boolean',
				'default': true,
				'markdownDescription': localize('secondarySideBarShowLabels', "控制辅助侧边栏标题中的活动项显示为标签还是图标。仅当 {0} 不为 {1} 时生效。", '`#workbench.activityBar.location#`', '`top`'),
				agentsWindow: { default: true, readOnly: true },
			},
			'workbench.statusBar.visible': {
				'type': 'boolean',
				'default': true,
				'description': localize('statusBarVisibility', "控制工作台底部状态栏的可见性。"),
				agentsWindow: { default: false, readOnly: true },
			},
			[NotificationsSettings.NOTIFICATIONS_POSITION]: {
				'type': 'string',
				'enum': [NotificationsPosition.BOTTOM_RIGHT, NotificationsPosition.BOTTOM_LEFT, NotificationsPosition.TOP_RIGHT],
				'default': NotificationsPosition.BOTTOM_RIGHT,
				'description': localize('notificationsPosition', "控制通知弹出项和通知中心的位置。"),
				'enumDescriptions': [
					localize('workbench.notifications.position.bottom-right', "在右下角显示通知。"),
					localize('workbench.notifications.position.bottom-left', "在左下角显示通知。"),
					localize('workbench.notifications.position.top-right', "在右上角显示通知，与操作系统级通知类似。")
				],
				'tags': ['experimental'],
				'experiment': {
					'mode': 'auto'
				}
			},
			[NotificationsSettings.NOTIFICATIONS_BUTTON]: {
				'type': 'boolean',
				'default': true,
				'description': localize('notificationsButton', "控制标题栏中\"通知\"按钮的可见性。仅当通知位于右上角时生效。")
			},
			[ACCOUNTS_AVATAR_SETTING]: {
				'type': 'boolean',
				'default': true,
				'description': localize('accountsShowAvatar', "控制账户相关界面（如活动栏中的\"账户\"项）是否显示已登录账户的头像。")
			},
			[LayoutSettings.ACTIVITY_BAR_LOCATION]: {
				'type': 'string',
				'enum': ['default', 'top', 'bottom', 'hidden'],
				'default': 'default',
				'markdownDescription': localize({ comment: ['This is the description for a setting'], key: 'activityBarLocation' }, "控制活动栏相对于主侧边栏和辅助侧边栏的位置。"),
				'enumDescriptions': [
					localize('workbench.activityBar.location.default', "活动栏显示在主侧边栏的侧边、辅助侧边栏的上方。"),
					localize('workbench.activityBar.location.top', "活动栏显示在主侧边栏和辅助侧边栏的上方。"),
					localize('workbench.activityBar.location.bottom', "活动栏显示在主侧边栏和辅助侧边栏的下方。"),
					localize('workbench.activityBar.location.hide', "在主侧边栏和辅助侧边栏中隐藏活动栏。")
				],
				agentsWindow: { default: 'default', readOnly: true },
			},
			[LayoutSettings.ACTIVITY_BAR_AUTO_HIDE]: {
				'type': 'boolean',
				'default': false,
				'markdownDescription': localize({ comment: ['This is the description for a setting'], key: 'activityBarAutoHide' }, "控制当只有一个视图容器时是否自动隐藏活动栏。当 {0} 设为 {1} 或 {2} 时，这适用于主侧边栏和辅助侧边栏。", '`#workbench.activityBar.location#`', '`top`', '`bottom`'),
				agentsWindow: { default: false, readOnly: true },
			},
			[LayoutSettings.ACTIVITY_BAR_COMPACT]: {
				'type': 'boolean',
				'default': false,
				'markdownDescription': localize({ comment: ['This is the description for a setting'], key: 'activityBarCompact' }, "控制活动栏是否使用图标更小、宽度更窄的紧凑布局。仅当 {0} 设为 {1} 时生效。", '`#workbench.activityBar.location#`', '`default`'),
				agentsWindow: { default: false, readOnly: true },
			},
			'workbench.activityBar.iconClickBehavior': {
				'type': 'string',
				'enum': ['toggle', 'focus'],
				'default': 'toggle',
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'activityBarIconClickBehavior' }, "控制单击工作台中活动栏图标时的行为。当 {0} 不为 {1} 时该设置无效。", '`#workbench.activityBar.location#`', '`default`'),
				'enumDescriptions': [
					localize('workbench.activityBar.iconClickBehavior.toggle', "如果点击的项已可见，则隐藏主侧边栏。"),
					localize('workbench.activityBar.iconClickBehavior.focus', "如果点击的项已可见，则聚焦主侧边栏。")
				],
				agentsWindow: { default: 'toggle', readOnly: true },
			},
			'workbench.view.alwaysShowHeaderActions': {
				'type': 'boolean',
				'default': false,
				'description': localize('viewVisibility', "控制视图标题操作按钮的可见性。视图标题操作可以始终可见，也可以仅在该视图获得焦点或被悬停时可见。")
			},
			'workbench.view.showQuietly': {
				'type': 'object',
				'description': localize('workbench.view.showQuietly', "当扩展请求显示一个隐藏的视图时，改为显示一个可点击的状态栏提示。"),
				'scope': ConfigurationScope.WINDOW,
				'properties': {
					'workbench.panel.output': {
						'type': 'boolean',
						'description': localize('workbench.panel.output', "输出视图")
					}
				},
				'additionalProperties': false
			},
			'workbench.fontAliasing': {
				'type': 'string',
				'enum': ['default', 'antialiased', 'none', 'auto'],
				'default': 'default',
				'description':
					localize('fontAliasing', "控制工作台中的字体抗锯齿方式。"),
				'enumDescriptions': [
					localize('workbench.fontAliasing.default', "亚像素字体平滑。在大多数非视网膜屏幕上，这能给出最锐利的文字。"),
					localize('workbench.fontAliasing.antialiased', "按像素而非亚像素对字体进行平滑处理，可能让字体整体看起来更细。"),
					localize('workbench.fontAliasing.none', "禁用字体平滑，文字将呈现锯齿状的锐利边缘。"),
					localize('workbench.fontAliasing.auto', "根据显示器的 DPI 自动应用 `default` 或 `antialiased`。")
				],
				'included': isMacintosh
			},
			'workbench.settings.editor': {
				'type': 'string',
				'enum': ['ui', 'json'],
				'enumDescriptions': [
					localize('settings.editor.ui', "使用设置界面编辑器。"),
					localize('settings.editor.json', "使用 JSON 文件编辑器。"),
				],
				'description': localize('settings.editor.desc', "确定默认使用哪个设置编辑器。"),
				'default': 'ui',
				'scope': ConfigurationScope.WINDOW
			},
			'workbench.settings.showAISearchToggle': {
				'type': 'boolean',
				'default': true,
				'description': localize('settings.showAISearchToggle', "控制执行搜索且 AI 搜索结果可用后，设置编辑器的搜索栏中是否显示 AI 搜索结果开关。"),
			},
			'workbench.hover.delay': {
				'type': 'number',
				'description': localize('workbench.hover.delay', "控制工作台项（例如某些扩展提供的树视图项）在悬停后延迟多少毫秒才显示悬停提示。已经显示出来的项目可能需要刷新后才会反映这一设置的变化。"),
				// Testing has indicated that on Windows and Linux 500 ms matches the native hovers most closely.
				// On Mac, the delay is 1500.
				'default': isMacintosh ? 1500 : 500,
				'minimum': 0
			},
			'workbench.hover.reducedDelay': {
				'type': 'number',
				'description': localize('workbench.hover.reducedDelay', "控制在需要更快反馈的特定场景中显示悬停所采用的缩短延迟（毫秒）。"),
				'default': 500,
				'minimum': 0
			},
			'workbench.reduceMotion': {
				type: 'string',
				description: localize('workbench.reduceMotion', "控制工作台是否减少动画渲染。"),
				'enumDescriptions': [
					localize('workbench.reduceMotion.on', "始终以减少动效方式渲染。"),
					localize('workbench.reduceMotion.off', "不以减少动效方式渲染"),
					localize('workbench.reduceMotion.auto', "根据操作系统配置以减少动效方式渲染。"),
				],
				default: 'auto',
				tags: ['accessibility'],
				enum: ['on', 'off', 'auto']
			},
			'workbench.reduceTransparency': {
				type: 'string',
				description: localize('workbench.reduceTransparency', "控制工作台是否减少透明和模糊效果以提升性能。"),
				'enumDescriptions': [
					localize('workbench.reduceTransparency.on', "始终不使用透明和模糊效果渲染。"),
					localize('workbench.reduceTransparency.off', "不减少透明和模糊效果。"),
					localize('workbench.reduceTransparency.auto', "根据操作系统配置减少透明和模糊效果。"),
				],
				default: 'off',
				tags: ['accessibility'],
				enum: ['on', 'off', 'auto']
			},
			'workbench.navigationControl.enabled': {
				'type': 'boolean',
				'default': true,
				'markdownDescription': isWeb ?
					localize('navigationControlEnabledWeb', "控制是否显示标题栏中的导航控件。") :
					localize({ key: 'navigationControlEnabled', comment: ['{0}, {1} is a placeholder for a setting identifier.'] }, "控制是否在自定义标题栏中显示导航控件。仅当 {0} 不为 {1} 时生效。", '`#window.customTitleBarVisibility#`', '`never`'),
				agentsWindow: { default: false, readOnly: true },
			},
			[LayoutSettings.LAYOUT_ACTIONS]: {
				'type': 'boolean',
				'default': true,
				'markdownDescription': isWeb ?
					localize('layoutControlEnabledWeb', "控制是否显示标题栏中的布局控件。") :
					localize({ key: 'layoutControlEnabled', comment: ['{0}, {1} is a placeholder for a setting identifier.'] }, "控制是否在自定义标题栏中显示布局控件。仅当 {0} 不为 {1} 时生效。", '`#window.customTitleBarVisibility#`', '`never`'),
				agentsWindow: { default: true, readOnly: true },
			},
			'workbench.layoutControl.type': {
				'type': 'string',
				'enum': ['menu', 'toggles', 'both'],
				'enumDescriptions': [
					localize('layoutcontrol.type.menu', "显示一个按钮，点击后展开布局选项下拉列表。"),
					localize('layoutcontrol.type.toggles', "显示多个按钮，用于切换面板和侧边栏的可见性。"),
					localize('layoutcontrol.type.both', "同时显示下拉按钮和切换按钮。"),
				],
				'default': 'both',
				'description': localize('layoutControlType', "控制自定义标题栏中的布局控件显示为单个菜单按钮还是多个界面切换按钮。"),
				agentsWindow: { default: 'both', readOnly: true },
			},
			'workbench.tips.enabled': {
				'type': 'boolean',
				'default': true,
				'description': localize('tips.enabled', "启用后，在没有打开编辑器时显示水印提示。"),
				agentsWindow: { default: false },
			},
			[LayoutSettings.SHADOWS]: {
				'type': 'boolean',
				'default': true,
				'description': localize('shadows', "控制是否在侧面板和其他工作台元素周围显示阴影效果。")
			},
			[LayoutSettings.MODERN_UI]: {
				'type': 'boolean',
				'default': true,
				'description': localize('modernUI', "控制是否启用新式界面。启用后，侧边栏和底部面板会以带圆角和间距的浮动卡片形式显示，并应用一套全新的工作台样式，与智能体窗口的设计保持一致。"),
				experiment: { mode: 'auto' },
			},
			[LayoutSettings.MODERN_UI_UPPERCASE_VIEW_HEADERS]: {
				'type': 'boolean',
				'default': false,
				'tags': ['experimental'],
				'markdownDescription': localize({ key: 'modernUIUppercaseViewHeaders', comment: ['{0} is a placeholder for a setting identifier.'] }, "控制启用 {0} 时，视图标题、侧边栏标题和面板标签页是否使用大写文本。", '`#workbench.experimental.modernUI#`'),
			},
			[LayoutSettings.MODERN_UI_EDITOR_TAB_STYLE]: {
				'type': 'string',
				'enum': [ModernUIEditorTabStyle.Connected, ModernUIEditorTabStyle.Pill],
				'enumDescriptions': [
					localize('modernUIEditorTabStyle.connected', "用外边框和弧形肩部将活动标签页与编辑区域连接起来。"),
					localize('modernUIEditorTabStyle.pill', "将编辑器标签页显示为独立的圆角标签。"),
				],
				'default': ModernUIEditorTabStyle.Connected,
				'tags': ['experimental'],
				'markdownDescription': localize({ key: 'modernUIEditorTabStyle', comment: ['{0} is a placeholder for a setting identifier.'] }, "控制启用 {0} 时的编辑器标签页样式，以及智能体窗口中聊天和侧面板的标签页样式。高对比度主题会保留明确的选中与焦点边框。", '`#workbench.experimental.modernUI#`'),
			},
		}
	});

	// Window

	let windowTitleDescription = localize('windowTitle', "根据当前上下文（如已打开的工作区或活动编辑器）控制窗口标题。变量会依据上下文进行替换：");
	windowTitleDescription += '\n- ' + [
		localize('activeEditorShort', "`${activeEditorShort}`：文件名（例如 myFile.txt）。"),
		localize('activeEditorMedium', "`${activeEditorMedium}`：文件相对于工作区文件夹的路径（例如 myFolder/myFileFolder/myFile.txt）。"),
		localize('activeEditorLong', "`${activeEditorLong}`：文件的完整路径（例如 /Users/Development/myFolder/myFileFolder/myFile.txt）。"),
		localize('activeEditorLanguageId', "`${activeEditorLanguageId}`：活动编辑器的语言标识符（例如 typescript）。"),
		localize('activeFolderShort', "`${activeFolderShort}`：文件所在文件夹的名称（例如 myFileFolder）。"),
		localize('activeFolderMedium', "`${activeFolderMedium}`：文件所在文件夹相对于工作区文件夹的路径（例如 myFolder/myFileFolder）。"),
		localize('activeFolderLong', "`${activeFolderLong}`：文件所在文件夹的完整路径（例如 /Users/Development/myFolder/myFileFolder）。"),
		localize('folderName', "`${folderName}`：文件所在工作区文件夹的名称（例如 myFolder）。"),
		localize('folderPath', "`${folderPath}`：文件所在工作区文件夹的文件路径（例如 /Users/Development/myFolder）。"),
		localize('rootName', "`${rootName}`：工作区名称，可选包含远程名称和工作区标识（例如 myFolder、myRemoteFolder [SSH] 或 myWorkspace (Workspace)）。"),
		localize('rootNameShort', "`${rootNameShort}`：不带后缀的工作区简称（例如 myFolder、myRemoteFolder 或 myWorkspace）。"),
		localize('rootPath', "`${rootPath}`：已打开工作区或文件夹的文件路径（例如 /Users/Development/myWorkspace）。"),
		localize('profileName', "`${profileName}`：打开该工作区所用的配置文件名称（例如 Data Science（Profile））。使用默认配置文件时忽略此项。"),
		localize('appName', "`${appName}`：例如 Olympia IDE。"),
		localize('remoteName', "`${remoteName}`：例如 SSH"),
		localize('dirty', "`${dirty}`：活动编辑器存在未保存更改时的指示标记。"),
		localize('focusedView', "`${focusedView}`：当前获得焦点的视图名称。"),
		localize('activeRepositoryName', "`${activeRepositoryName}`：活动仓库的名称（例如 vscode）。"),
		localize('activeRepositoryBranchName', "`${activeRepositoryBranchName}`：活动仓库中活动分支的名称（例如 main）。"),
		localize('activeEditorState', "`${activeEditorState}`：提供活动编辑器状态的信息（例如已修改）。在屏幕阅读器模式下启用 {0} 后，默认会追加此项。", '`accessibility.windowTitleOptimized`'),
		localize('separator', "`${separator}`：条件分隔符（\" - \"），仅当其两侧是带值的变量或静态文本时才显示。")
	].join('\n- '); // intentionally concatenated to not produce a string that is too long for translations

	registry.registerConfiguration({
		...windowConfigurationNodeBase,
		'properties': {
			'window.title': {
				'type': 'string',
				'default': defaultWindowTitle,
				'markdownDescription': windowTitleDescription,
				agentsWindow: { default: '${appName}', readOnly: true },
			},
			'window.titleSeparator': {
				'type': 'string',
				'default': defaultWindowTitleSeparator,
				'markdownDescription': localize("window.titleSeparator", "{0} 使用的分隔符。", '`#window.title#`')
			},
			[LayoutSettings.COMMAND_CENTER]: {
				type: 'boolean',
				default: true,
				markdownDescription: isWeb ?
					localize('window.commandCenterWeb', "与窗口标题一起显示命令启动器。") :
					localize({ key: 'window.commandCenter', comment: ['{0}, {1} is a placeholder for a setting identifier.'] }, "与窗口标题一起显示命令启动器。仅当 {0} 不为 {1} 时生效。", '`#window.customTitleBarVisibility#`', '`never`'),
				agentsWindow: { default: false, readOnly: true },
			},
			'window.menuBarVisibility': {
				'type': 'string',
				'enum': ['classic', 'visible', 'toggle', 'hidden', 'compact'],
				'markdownEnumDescriptions': [
					localize('window.menuBarVisibility.classic', "菜单显示在窗口顶部，仅在全屏模式下隐藏。"),
					localize('window.menuBarVisibility.visible', "菜单始终显示在窗口顶部，即使在全屏模式下也是如此。"),
					isMacintosh ?
						localize('window.menuBarVisibility.toggle.mac', "菜单默认隐藏，可通过执行\"聚焦应用程序菜单\"命令显示在窗口顶部。") :
						localize('window.menuBarVisibility.toggle', "菜单默认隐藏，可通过 Alt 键显示在窗口顶部。"),
					localize('window.menuBarVisibility.hidden', "菜单始终隐藏。"),
					isWeb ?
						localize('window.menuBarVisibility.compact.web', "菜单在侧边栏中显示为一个紧凑按钮。") :
						localize({ key: 'window.menuBarVisibility.compact', comment: ['{0}, {1} is a placeholder for a setting identifier.'] }, "菜单在侧边栏中显示为一个紧凑按钮。当 {0} 为 {1} 且 {2} 为 {3} 或 {4} 时该设置无效。", '`#window.titleBarStyle#`', '`native`', '`#window.menuStyle#`', '`native`', '`inherit`')
				],
				'default': isWeb ? 'compact' : 'classic',
				'scope': ConfigurationScope.APPLICATION,
				'markdownDescription': isMacintosh ?
					localize('menuBarVisibility.mac', "控制菜单栏的可见性。设置为 toggle 表示菜单栏处于隐藏状态，执行「聚焦应用程序菜单」将显示它。设置为 compact 则会把菜单移入侧边栏。") :
					localize('menuBarVisibility', "控制菜单栏的可见性。设置为 toggle 表示菜单栏处于隐藏状态，按一次 Alt 键将显示它。设置为 compact 则会把菜单移入侧边栏。"),
				'included': isWindows || isLinux || isWeb
			},
			'window.enableMenuBarMnemonics': {
				'type': 'boolean',
				'default': true,
				'scope': ConfigurationScope.APPLICATION,
				'description': localize('enableMenuBarMnemonics', "控制是否可以通过 Alt 键快捷键打开主菜单。禁用助记符后，可以将这些 Alt 键快捷键改为绑定到编辑器命令。"),
				'included': isWindows || isLinux
			},
			'window.customMenuBarAltFocus': {
				'type': 'boolean',
				'default': true,
				'scope': ConfigurationScope.APPLICATION,
				'markdownDescription': localize('customMenuBarAltFocus', "控制按 Alt 键时是否聚焦菜单栏。该设置不影响用 Alt 键切换菜单栏显示。"),
				'included': isWindows || isLinux,
				agentsWindow: { default: false, readOnly: true },
			},
			'window.openFilesInNewWindow': {
				'type': 'string',
				'enum': ['on', 'off', 'default'],
				'enumDescriptions': [
					localize('window.openFilesInNewWindow.on', "文件将在新窗口中打开。"),
					localize('window.openFilesInNewWindow.off', "文件将在已打开该文件所在文件夹的窗口中打开，或在最后活动的窗口中打开。"),
					isMacintosh ?
						localize('window.openFilesInNewWindow.defaultMac', "除非通过程序坞或访达打开，否则文件将在已打开该文件所在文件夹的窗口中打开，或在最后活动的窗口中打开。") :
						localize('window.openFilesInNewWindow.default', "除非从应用内部选取（例如通过\"文件\"菜单），否则文件将在新窗口中打开。")
				],
				'default': 'off',
				'scope': ConfigurationScope.APPLICATION,
				'markdownDescription':
					isMacintosh ?
						localize('openFilesInNewWindowMac', "控制在使用命令行或文件对话框时，文件是否应该在新窗口中打开。\n请注意，仍然存在一些会忽略此设置的情况（例如使用了 --new-window 或 --reuse-window 命令行选项时）。") :
						localize('openFilesInNewWindow', "控制在使用命令行或文件对话框时，文件是否应该在新窗口中打开。\n请注意，仍然存在一些会忽略此设置的情况（例如使用了 --new-window 或 --reuse-window 命令行选项时）。")
			},
			'window.openFoldersInNewWindow': {
				'type': 'string',
				'enum': ['on', 'off', 'default'],
				'enumDescriptions': [
					localize('window.openFoldersInNewWindow.on', "文件夹将在新窗口中打开。"),
					localize('window.openFoldersInNewWindow.off', "文件夹将替换最后活动的窗口。"),
					localize('window.openFoldersInNewWindow.default', "除非从应用内部选取文件夹（例如通过\"文件\"菜单），否则文件夹将在新窗口中打开。")
				],
				'default': 'default',
				'scope': ConfigurationScope.APPLICATION,
				'markdownDescription': localize('openFoldersInNewWindow', "控制文件夹应该在新窗口中打开，还是替换最后一个活动窗口。\n请注意，仍然存在一些会忽略此设置的情况（例如使用了 --new-window 或 --reuse-window 命令行选项时）。")
			},
			'window.confirmBeforeClose': {
				'type': 'string',
				'enum': ['always', 'keyboardOnly', 'never'],
				'enumDescriptions': [
					isWeb ?
						localize('window.confirmBeforeClose.always.web', "始终尝试请求确认。请注意，浏览器仍可能在未经确认的情况下关闭标签页或窗口。") :
						localize('window.confirmBeforeClose.always', "始终要求确认。"),
					isWeb ?
						localize('window.confirmBeforeClose.keyboardOnly.web', "仅当使用快捷键关闭窗口时才请求确认。请注意，某些情况下可能无法检测。") :
						localize('window.confirmBeforeClose.keyboardOnly', "仅当使用快捷键时才请求确认。"),
					isWeb ?
						localize('window.confirmBeforeClose.never.web', "除非即将丢失数据，否则从不主动请求确认。") :
						localize('window.confirmBeforeClose.never', "从不主动请求确认。")
				],
				'default': (isWeb && !isStandalone()) ? 'keyboardOnly' : 'never', // on by default in web, unless PWA, never on desktop
				'markdownDescription': isWeb ?
					localize('confirmBeforeCloseWeb', "控制关闭浏览器标签页或窗口之前是否显示确认对话框。请注意，即使启用了此设置，浏览器仍可能在不确认的情况下关闭标签页或窗口，并且此设置只是一种提示，在所有情况下都不一定生效。") :
					localize('confirmBeforeClose', "控制关闭窗口或退出应用程序前是否显示确认对话框。"),
				'scope': ConfigurationScope.APPLICATION
			}
		}
	});

	// Dynamic Window Configuration
	registerWorkbenchContribution2(DynamicWindowConfiguration.ID, DynamicWindowConfiguration, WorkbenchPhase.Eventually);

	// Problems
	registry.registerConfiguration({
		...problemsConfigurationNodeBase,
		'properties': {
			'problems.visibility': {
				'type': 'boolean',
				'default': true,
				'description': localize('problems.visibility', "控制问题是否在整个编辑器和工作台中可见。"),
			},
		}
	});

})();

Registry.as<IConfigurationMigrationRegistry>(Extensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: 'workbench.activityBar.visible', migrateFn: (value: unknown) => {
			const result: ConfigurationKeyValuePairs = [];
			if (value !== undefined) {
				result.push(['workbench.activityBar.visible', { value: undefined }]);
			}
			if (value === false) {
				result.push([LayoutSettings.ACTIVITY_BAR_LOCATION, { value: ActivityBarPosition.HIDDEN }]);
			}
			return result;
		}
	}]);

Registry.as<IConfigurationMigrationRegistry>(Extensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: LayoutSettings.ACTIVITY_BAR_LOCATION, migrateFn: (value: unknown) => {
			const results: ConfigurationKeyValuePairs = [];
			if (value === 'side') {
				results.push([LayoutSettings.ACTIVITY_BAR_LOCATION, { value: ActivityBarPosition.DEFAULT }]);
			}
			return results;
		}
	}]);

Registry.as<IConfigurationMigrationRegistry>(Extensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: 'workbench.editor.doubleClickTabToToggleEditorGroupSizes', migrateFn: (value: unknown) => {
			const results: ConfigurationKeyValuePairs = [];
			if (typeof value === 'boolean') {
				value = value ? 'expand' : 'off';
				results.push(['workbench.editor.doubleClickTabToToggleEditorGroupSizes', { value }]);
			}
			return results;
		}
	}, {
		key: LayoutSettings.EDITOR_TABS_MODE, migrateFn: (value: unknown) => {
			const results: ConfigurationKeyValuePairs = [];
			if (typeof value === 'boolean') {
				value = value ? EditorTabsMode.MULTIPLE : EditorTabsMode.SINGLE;
				results.push([LayoutSettings.EDITOR_TABS_MODE, { value }]);
			}
			return results;
		}
	}, {
		key: 'workbench.editor.tabCloseButton', migrateFn: (value: unknown) => {
			const result: ConfigurationKeyValuePairs = [];
			if (value === 'left' || value === 'right') {
				result.push(['workbench.editor.tabActionLocation', { value }]);
			} else if (value === 'off') {
				result.push(['workbench.editor.tabActionCloseVisibility', { value: false }]);
			}
			return result;
		}
	}, {
		key: 'zenMode.hideTabs', migrateFn: (value: unknown) => {
			const result: ConfigurationKeyValuePairs = [['zenMode.hideTabs', { value: undefined }]];
			if (value === true) {
				result.push(['zenMode.showTabs', { value: 'single' }]);
			}
			return result;
		}
	}]);

// Migrate the previous standalone experiments (`workbench.experimental.floatingPanels`
// and `workbench.experimental.styleOverrides`) onto the consolidated
// `workbench.experimental.modernUI` toggle. Either of the old settings being on
// enables the unified Modern UI Update experiment.
Registry.as<IConfigurationMigrationRegistry>(Extensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: 'workbench.experimental.floatingPanels', migrateFn: (value: unknown, valueAccessor) => {
			const result: ConfigurationKeyValuePairs = [['workbench.experimental.floatingPanels', { value: undefined }]];
			if (value === true && valueAccessor(LayoutSettings.MODERN_UI) === undefined) {
				result.push([LayoutSettings.MODERN_UI, { value: true }]);
			}
			return result;
		}
	}, {
		key: 'workbench.experimental.styleOverrides', migrateFn: (value: unknown, valueAccessor) => {
			const result: ConfigurationKeyValuePairs = [['workbench.experimental.styleOverrides', { value: undefined }]];
			if (Array.isArray(value) && value.length > 0 && valueAccessor(LayoutSettings.MODERN_UI) === undefined) {
				result.push([LayoutSettings.MODERN_UI, { value: true }]);
			}
			return result;
		}
	}]);
