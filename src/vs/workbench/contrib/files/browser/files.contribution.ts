/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../nls.js';
import { sep } from '../../../../base/common/path.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope, IConfigurationPropertySchema } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { IFileEditorInput, IEditorFactoryRegistry, EditorExtensions } from '../../../common/editor.js';
import { AutoSaveConfiguration, HotExitConfiguration, FILES_EXCLUDE_CONFIG, FILES_ASSOCIATIONS_CONFIG, FILES_READONLY_INCLUDE_CONFIG, FILES_READONLY_EXCLUDE_CONFIG, FILES_READONLY_FROM_PERMISSIONS_CONFIG } from '../../../../platform/files/common/files.js';
import { SortOrder, LexicographicOptions, FILE_EDITOR_INPUT_ID, BINARY_TEXT_FILE_MODE, UndoConfirmLevel, IFilesConfiguration } from '../common/files.js';
import { TextFileEditorTracker } from './editors/textFileEditorTracker.js';
import { TextFileSaveErrorHandler } from './editors/textFileSaveErrorHandler.js';
import { FileEditorInput } from './editors/fileEditorInput.js';
import { BinaryFileEditor } from './editors/binaryFileEditor.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { isNative, isWeb, isWindows } from '../../../../base/common/platform.js';
import { ExplorerViewletViewsContribution } from './explorerViewlet.js';
import { IEditorPaneRegistry, EditorPaneDescriptor } from '../../../browser/editor.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ExplorerService, UNDO_REDO_SOURCE } from './explorerService.js';
import { GUESSABLE_ENCODINGS, SUPPORTED_ENCODINGS } from '../../../services/textfile/common/encoding.js';
import { Schemas } from '../../../../base/common/network.js';
import { WorkspaceWatcher } from './workspaceWatcher.js';
import { editorConfigurationBaseNode } from '../../../../editor/common/config/editorConfigurationSchema.js';
import { DirtyFilesIndicator } from '../common/dirtyFilesIndicator.js';
import { UndoCommand, RedoCommand } from '../../../../editor/browser/editorExtensions.js';
import { IUndoRedoService } from '../../../../platform/undoRedo/common/undoRedo.js';
import { IExplorerService } from './files.js';
import { FileEditorInputSerializer, FileEditorWorkingCopyEditorHandler } from './editors/fileEditorHandler.js';
import { ModesRegistry } from '../../../../editor/common/languages/modesRegistry.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { TextFileEditor } from './editors/textFileEditor.js';

class FileUriLabelContribution implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.fileUriLabel';

	constructor(@ILabelService labelService: ILabelService) {
		labelService.registerFormatter({
			scheme: Schemas.file,
			formatting: {
				label: '${authority}${path}',
				separator: sep,
				tildify: !isWindows,
				normalizeDriveLetter: isWindows,
				authorityPrefix: sep + sep,
				workspaceSuffix: ''
			}
		});
	}
}

registerSingleton(IExplorerService, ExplorerService, InstantiationType.Delayed);

// Register file editors

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		TextFileEditor,
		TextFileEditor.ID,
		nls.localize('textFileEditor', "文本文件编辑器")
	),
	[
		new SyncDescriptor(FileEditorInput)
	]
);

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		BinaryFileEditor,
		BinaryFileEditor.ID,
		nls.localize('binaryFileEditor', "二进制文件编辑器")
	),
	[
		new SyncDescriptor(FileEditorInput)
	]
);

// Register default file input factory
Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerFileEditorFactory({

	typeId: FILE_EDITOR_INPUT_ID,

	createFileEditor: (resource, preferredResource, preferredName, preferredDescription, preferredEncoding, preferredLanguageId, preferredContents, instantiationService): IFileEditorInput => {
		return instantiationService.createInstance(FileEditorInput, resource, preferredResource, preferredName, preferredDescription, preferredEncoding, preferredLanguageId, preferredContents);
	},

	isFileEditor: (obj): obj is IFileEditorInput => {
		return obj instanceof FileEditorInput;
	}
});

// Register Editor Input Serializer & Handler
Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(FILE_EDITOR_INPUT_ID, FileEditorInputSerializer);
registerWorkbenchContribution2(FileEditorWorkingCopyEditorHandler.ID, FileEditorWorkingCopyEditorHandler, WorkbenchPhase.BlockRestore);

// Register Explorer views
registerWorkbenchContribution2(ExplorerViewletViewsContribution.ID, ExplorerViewletViewsContribution, WorkbenchPhase.BlockStartup);

// Register Text File Editor Tracker
registerWorkbenchContribution2(TextFileEditorTracker.ID, TextFileEditorTracker, WorkbenchPhase.BlockStartup);

// Register Text File Save Error Handler
registerWorkbenchContribution2(TextFileSaveErrorHandler.ID, TextFileSaveErrorHandler, WorkbenchPhase.BlockStartup);

// Register uri display for file uris
registerWorkbenchContribution2(FileUriLabelContribution.ID, FileUriLabelContribution, WorkbenchPhase.BlockStartup);

// Register Workspace Watcher
registerWorkbenchContribution2(WorkspaceWatcher.ID, WorkspaceWatcher, WorkbenchPhase.AfterRestored);

// Register Dirty Files Indicator
registerWorkbenchContribution2(DirtyFilesIndicator.ID, DirtyFilesIndicator, WorkbenchPhase.BlockStartup);

// Configuration
const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);

const hotExitConfiguration: IConfigurationPropertySchema = isNative ?
	{
		'type': 'string',
		'scope': ConfigurationScope.APPLICATION,
		'enum': [HotExitConfiguration.OFF, HotExitConfiguration.ON_EXIT, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE],
		'default': HotExitConfiguration.ON_EXIT,
		'markdownEnumDescriptions': [
			nls.localize('hotExit.off', "禁用热退出。关闭含有未保存更改的编辑器窗口时将弹出提示。"),
			nls.localize('hotExit.onExit', "在 Windows/Linux 上最后一个窗口关闭之后，或触发 workbench.action.quit 命令时（命令面板、快捷键、菜单），将触发热退出。下次启动时会恢复所有未打开文件夹的窗口。可以通过「文件 > 打开最近使用的文件 > 更多...」查看此前打开过且含有未保存文件的窗口列表。"),
			nls.localize('hotExit.onExitAndWindowClose', "在 Windows/Linux 上最后一个窗口关闭之后，或触发 workbench.action.quit 命令时（命令面板、快捷键、菜单），以及对于任何打开了文件夹的窗口（无论它是否是最后一个窗口），都会触发热退出。下次启动时会恢复所有未打开文件夹的窗口。可以通过「文件 > 打开最近使用的文件 > 更多...」查看此前打开过且含有未保存文件的窗口列表。")
		],
		'markdownDescription': nls.localize('hotExit', "热退出控制是否在会话之间记住未保存的文件，从而在退出编辑器时跳过保存提示。", HotExitConfiguration.ON_EXIT, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE)
	} : {
		'type': 'string',
		'scope': ConfigurationScope.APPLICATION,
		'enum': [HotExitConfiguration.OFF, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE],
		'default': HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE,
		'markdownEnumDescriptions': [
			nls.localize('hotExit.off', "禁用热退出。关闭含有未保存更改的编辑器窗口时将弹出提示。"),
			nls.localize('hotExit.onExitAndWindowCloseBrowser', "当浏览器退出或窗口、标签页关闭时将触发热退出。")
		],
		'markdownDescription': nls.localize('hotExit', "热退出控制是否在会话之间记住未保存的文件，从而在退出编辑器时跳过保存提示。", HotExitConfiguration.ON_EXIT, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE)
	};

configurationRegistry.registerConfiguration({
	'id': 'files',
	'order': 9,
	'title': nls.localize('filesConfigurationTitle', "文件"),
	'type': 'object',
	'properties': {
		[FILES_EXCLUDE_CONFIG]: {
			'type': 'object',
			'markdownDescription': nls.localize('exclude', "配置用于排除文件和文件夹的 `glob 模式`。例如，资源管理器会根据此设置决定显示或隐藏哪些文件和文件夹。搜索专用的排除项请参阅 search.exclude 设置；依据 .gitignore 忽略文件请参阅 explorer.excludeGitIgnore 设置。"),
			'default': {
				...{ '**/.git': true, '**/.svn': true, '**/.hg': true, '**/.jj': true, '**/.DS_Store': true, '**/Thumbs.db': true },
				...(isWeb ? { '**/*.crswap': true /* filter out swap files used for local file access */ } : undefined)
			},
			'scope': ConfigurationScope.RESOURCE,
			'additionalProperties': {
				'anyOf': [
					{
						'type': 'boolean',
						'enum': [true, false],
						'enumDescriptions': [nls.localize('trueDescription', "启用该模式。"), nls.localize('falseDescription', "禁用该模式。")],
						'description': nls.localize('files.exclude.boolean', "用于匹配文件路径的 glob 模式。设为 true 或 false 以启用或禁用该模式。"),
					},
					{
						'type': 'object',
						'properties': {
							'when': {
								'type': 'string', // expression ({ "**/*.js": { "when": "$(basename).js" } })
								'pattern': '\\w*\\$\\(basename\\)\\w*',
								'default': '$(basename).ext',
								'markdownDescription': nls.localize({ key: 'files.exclude.when', comment: ['\\$(basename) should not be translated'] }, "对匹配文件的同级文件进行额外检查。使用 \\$(basename) 变量表示匹配的文件名。")
							}
						}
					}
				]
			}
		},
		[FILES_ASSOCIATIONS_CONFIG]: {
			'type': 'object',
			'markdownDescription': nls.localize('associations', "配置文件与语言之间关联关系的 `glob 模式`（例如 \"*.extension\": \"html\"）。模式中若包含路径分隔符，则按文件的绝对路径匹配，否则按文件名匹配。这些关联的优先级高于已安装语言的默认关联。"),
			'additionalProperties': {
				'type': 'string'
			}
		},
		'files.encoding': {
			'type': 'string',
			'enum': Object.keys(SUPPORTED_ENCODINGS),
			'default': 'utf8',
			'description': nls.localize('encoding', "读写文件时使用的默认字符集编码。此设置也可按语言单独配置。"),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE,
			'enumDescriptions': Object.keys(SUPPORTED_ENCODINGS).map(key => SUPPORTED_ENCODINGS[key].labelLong),
			'enumItemLabels': Object.keys(SUPPORTED_ENCODINGS).map(key => SUPPORTED_ENCODINGS[key].labelLong)
		},
		'files.autoGuessEncoding': {
			'type': 'boolean',
			'default': false,
			'markdownDescription': nls.localize('autoGuessEncoding', "启用后，编辑器在打开文件时会尝试猜测其字符集编码。此设置也可以按语言分别配置。请注意，文本搜索不会遵循此设置，只有 {0} 遵循。", '`#files.encoding#`'),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.candidateGuessEncodings': {
			'type': 'array',
			'items': {
				'type': 'string',
				'enum': Object.keys(GUESSABLE_ENCODINGS),
				'enumDescriptions': Object.keys(GUESSABLE_ENCODINGS).map(key => GUESSABLE_ENCODINGS[key].labelLong)
			},
			'default': [],
			'markdownDescription': nls.localize('candidateGuessEncodings', "编辑器应当尝试猜测的字符集编码列表。如果对非 UTF-8 内容的猜测失败，那么只有当某个旧式编码是候选中唯一无损匹配时才会采用它。如果无法确定编码，则遵循 {0}。", '`#files.encoding#`'),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.eol': {
			'type': 'string',
			'enum': [
				'\n',
				'\r\n',
				'auto'
			],
			'enumDescriptions': [
				nls.localize('eol.LF', "LF（换行）"),
				nls.localize('eol.CRLF', "CRLF（回车换行）"),
				nls.localize('eol.auto', "使用操作系统特定的行尾符。")
			],
			'default': 'auto',
			'description': nls.localize('eol', "默认的行尾符。"),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.enableTrash': {
			'type': 'boolean',
			'default': true,
			'description': nls.localize('useTrash', "删除时把文件/文件夹移入系统回收站（Windows 上为回收站）。禁用后将永久删除文件/文件夹。")
		},
		'files.trimTrailingWhitespace': {
			'type': 'boolean',
			'default': false,
			'description': nls.localize('trimTrailingWhitespace', "启用后，保存文件时会裁剪行尾空白字符。"),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.trimTrailingWhitespaceInRegexAndStrings': {
			'type': 'boolean',
			'default': true,
			'description': nls.localize('trimTrailingWhitespaceInRegexAndStrings', "启用后，保存时或执行「移除尾部空格」操作时，会把多行字符串和正则表达式中的尾部空白去掉。当没有最新的词法信息时，这可能导致某些行的空白没有被清除。"),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.insertFinalNewline': {
			'type': 'boolean',
			'default': false,
			'description': nls.localize('insertFinalNewline', "启用后，保存文件时会在文件末尾插入一个换行符。"),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.trimFinalNewlines': {
			'type': 'boolean',
			'default': false,
			'description': nls.localize('trimFinalNewlines', "启用后，保存文件时会裁剪文件末尾换行符之后的所有换行。"),
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
		},
		'files.autoSave': {
			'type': 'string',
			'enum': [AutoSaveConfiguration.OFF, AutoSaveConfiguration.AFTER_DELAY, AutoSaveConfiguration.ON_FOCUS_CHANGE, AutoSaveConfiguration.ON_WINDOW_CHANGE],
			'markdownEnumDescriptions': [
				nls.localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'files.autoSave.off' }, "有更改的编辑器永远不会被自动保存。"),
				nls.localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'files.autoSave.afterDelay' }, "有更改的编辑器会在配置的 `#files.autoSaveDelay#` 之后自动保存。"),
				nls.localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'files.autoSave.onFocusChange' }, "编辑器失去焦点时会自动保存其更改。"),
				nls.localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'files.autoSave.onWindowChange' }, "窗口失去焦点时会自动保存编辑器中的更改。")
			],
			'default': isWeb ? AutoSaveConfiguration.AFTER_DELAY : AutoSaveConfiguration.OFF,
			'markdownDescription': nls.localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'autoSave' }, "控制是否自动保存包含未保存更改的编辑器。", AutoSaveConfiguration.OFF, AutoSaveConfiguration.AFTER_DELAY, AutoSaveConfiguration.ON_FOCUS_CHANGE, AutoSaveConfiguration.ON_WINDOW_CHANGE, AutoSaveConfiguration.AFTER_DELAY),
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			agentsWindow: { default: 'afterDelay' },
		},
		'files.autoSaveDelay': {
			'type': 'number',
			'default': 1000,
			'minimum': 0,
			'markdownDescription': nls.localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'autoSaveDelay' }, "控制自动保存包含未保存更改的编辑器之前等待的毫秒数。仅当 `#files.autoSave#` 设为 `{0}` 时生效。", AutoSaveConfiguration.AFTER_DELAY),
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.autoSaveWorkspaceFilesOnly': {
			'type': 'boolean',
			'default': false,
			'markdownDescription': nls.localize('autoSaveWorkspaceFilesOnly', "启用后，自动保存的范围将仅限于已打开工作区内的文件。仅当启用 {0} 时生效。", '`#files.autoSave#`'),
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.autoSaveWhenNoErrors': {
			'type': 'boolean',
			'default': false,
			'markdownDescription': nls.localize('autoSaveWhenNoErrors', "启用后，编辑器的`自动保存`将仅限于在触发自动保存的那一刻没有报出任何错误的文件。仅在启用 {0} 后生效。", '`#files.autoSave#`'),
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.watcherExclude': {
			'type': 'object',
			'patternProperties': {
				'.*': { 'type': 'boolean' }
			},
			'default': {
				// Avoiding a '**' pattern here which results in a very complex
				// RegExp that can slow things down significantly in large workspaces
				'.git/objects/**': true,
				'.git/subtree-cache/**': true,
				'.hg/store/**': true,
				'*/.git/objects/**': true,
				'*/.git/subtree-cache/**': true,
				'*/.hg/store/**': true
			},
			'markdownDescription': nls.localize('watcherExclude', "配置要从文件监视中排除的路径或 `glob 模式`。路径既可以是相对于被监视文件夹的相对路径，也可以是绝对路径；glob 模式则始终相对于被监视文件夹进行匹配。如果你发现文件监视进程占用了大量 CPU，请确保把不太关心的大文件夹（例如构建输出目录）排除在外。"),
			'scope': ConfigurationScope.RESOURCE
		},
		'files.watcherInclude': {
			'type': 'array',
			'items': {
				'type': 'string'
			},
			'default': [],
			'description': nls.localize('watcherInclude', "配置需要额外监视其内部变化的工作区路径。默认情况下，所有工作区文件夹都会被递归监视，符号链接文件夹除外。你可以显式添加绝对路径或相对路径，以支持监视符号链接文件夹。相对路径会依据当前打开的工作区解析为绝对路径。"),
			'scope': ConfigurationScope.RESOURCE
		},
		'files.hotExit': hotExitConfiguration,
		'files.defaultLanguage': {
			'type': 'string',
			'markdownDescription': nls.localize('defaultLanguage', "分配给新文件的默认语言标识符。如果配置为 `${activeEditorLanguage}`，将使用当前活动文本编辑器的语言标识符（如果有）。")
		},
		[FILES_READONLY_INCLUDE_CONFIG]: {
			'type': 'object',
			'patternProperties': {
				'.*': { 'type': 'boolean' }
			},
			'default': {},
			'markdownDescription': nls.localize('filesReadonlyInclude', "配置要标记为只读的路径或 `glob 模式`。除非使用绝对路径，否则 glob 模式始终相对于工作区文件夹的路径进行求值。你可以通过 files.readonlyExclude 设置排除匹配的路径。来自只读文件系统提供程序的文件无论此设置如何都始终是只读的。"),
			'scope': ConfigurationScope.RESOURCE
		},
		[FILES_READONLY_EXCLUDE_CONFIG]: {
			'type': 'object',
			'patternProperties': {
				'.*': { 'type': 'boolean' }
			},
			'default': {},
			'markdownDescription': nls.localize('filesReadonlyExclude', "配置要从只读标记中排除的路径或 `glob 模式`，它们原先是因为匹配 files.readonlyInclude 设置而被标记的。除非使用绝对路径，否则 glob 模式始终相对于工作区文件夹的路径进行求值。来自只读文件系统提供程序的文件无论此设置如何都始终是只读的。"),
			'scope': ConfigurationScope.RESOURCE
		},
		[FILES_READONLY_FROM_PERMISSIONS_CONFIG]: {
			'type': 'boolean',
			'markdownDescription': nls.localize('filesReadonlyFromPermissions', "当文件权限表明为只读时，将文件标记为只读。可通过 `#files.readonlyInclude#` 和 `#files.readonlyExclude#` 设置覆盖。"),
			'default': false
		},
		'files.restoreUndoStack': {
			'type': 'boolean',
			'description': nls.localize('files.restoreUndoStack', "重新打开文件时恢复撤销栈。"),
			'default': true
		},
		'files.saveConflictResolution': {
			'type': 'string',
			'enum': [
				'askUser',
				'overwriteFileOnDisk'
			],
			'enumDescriptions': [
				nls.localize('askUser', "将拒绝保存，并要求手动解决保存冲突。"),
				nls.localize('overwriteFileOnDisk', "将用编辑器中的更改覆盖磁盘上的文件，以解决保存冲突。")
			],
			'description': nls.localize('files.saveConflictResolution', "当某个文件在此期间已被其它程序修改、而你又把它保存到磁盘时，就可能发生保存冲突。为防止数据丢失，系统会请你比较编辑器中的改动与磁盘上的版本。只有当你经常遇到保存冲突错误时才应修改此设置，贸然使用它反而可能造成数据丢失。"),
			'default': 'askUser',
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.dialog.defaultPath': {
			'type': 'string',
			'pattern': '^((\\/|\\\\\\\\|[a-zA-Z]:\\\\).*)?$', // slash OR UNC-root OR drive-root OR undefined
			'patternErrorMessage': nls.localize('defaultPathErrorMessage', "文件对话框的默认路径必须是绝对路径（例如 C:\\\\myFolder 或 /myFolder）。"),
			'description': nls.localize('fileDialogDefaultPath', "文件对话框的默认路径，会覆盖用户主目录路径。仅在没有特定上下文路径（如最近打开的文件或文件夹）时使用。"),
			'scope': ConfigurationScope.MACHINE
		},
		'files.simpleDialog.enable': {
			'type': 'boolean',
			'description': nls.localize('files.simpleDialog.enable', "启用用于打开和保存文件及文件夹的简易文件对话框。启用后该对话框会替代系统文件对话框。"),
			'default': false
		},
		'files.participants.timeout': {
			type: 'number',
			default: 60000,
			markdownDescription: nls.localize('files.participants.timeout', "创建、重命名和删除的文件参与者超时时间（毫秒）。使用 `0` 表示禁用参与者。"),
		}
	}
});

configurationRegistry.registerConfiguration({
	...editorConfigurationBaseNode,
	properties: {
		'editor.formatOnSave': {
			'type': 'boolean',
			'markdownDescription': nls.localize('formatOnSave', "保存时格式化文件。必须存在可用的格式化程序，且编辑器不处于关闭过程中。当 {0} 设为 `afterDelay` 时，仅在显式保存时才会格式化文件。", '`#files.autoSave#`'),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE,
		},
		'editor.formatOnSaveMode': {
			'type': 'string',
			'default': 'file',
			'enum': [
				'file',
				'modifications',
				'modificationsIfAvailable'
			],
			'enumDescriptions': [
				nls.localize({ key: 'everything', comment: ['This is the description of an option'] }, "格式化整个文件。"),
				nls.localize({ key: 'modification', comment: ['This is the description of an option'] }, "仅格式化修改部分。需要源代码管理，以及支持 '格式化所选内容' 的格式化程序。"),
				nls.localize({ key: 'modificationIfAvailable', comment: ['This is the description of an option'] }, "仅尝试格式化修改部分（需要源代码管理，以及支持 '格式化所选内容' 的格式化程序）。如果无法使用源代码管理，则会格式化整个文件。"),
			],
			'markdownDescription': nls.localize('formatOnSaveMode', "控制「保存时格式化」是格式化整个文件还是仅格式化修改部分。仅在启用 `#editor.formatOnSave#` 时生效。"),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE,
		},
	}
});

configurationRegistry.registerConfiguration({
	'id': 'explorer',
	'order': 10,
	'title': nls.localize('explorerConfigurationTitle', "文件资源管理器"),
	'type': 'object',
	'properties': {
		'explorer.openEditors.visible': {
			'type': 'number',
			'description': nls.localize({ key: 'openEditorsVisible', comment: ['Open is an adjective'] }, "\"打开的编辑器\"窗格初始显示的编辑器最大数量。超出该限制将显示滚动条，并允许调整窗格大小以显示更多项。"),
			'default': 9,
			'minimum': 1
		},
		'explorer.openEditors.minVisible': {
			'type': 'number',
			'description': nls.localize({ key: 'openEditorsVisibleMin', comment: ['Open is an adjective'] }, "在\"打开的编辑器\"窗格中预先分配的编辑器槽位最小数量。如果设为 0，该窗格将根据编辑器数量动态调整大小。"),
			'default': 0,
			'minimum': 0
		},
		'explorer.openEditors.sortOrder': {
			'type': 'string',
			'enum': ['editorOrder', 'alphabetical', 'fullPath'],
			'description': nls.localize({ key: 'openEditorsSortOrder', comment: ['Open is an adjective'] }, "控制\"打开的编辑器\"窗格中编辑器的排序方式。"),
			'enumDescriptions': [
				nls.localize('sortOrder.editorOrder', "编辑器按标签页显示的顺序排列。"),
				nls.localize('sortOrder.alphabetical', "在每个编辑器组内，编辑器按标签页名称的字母顺序排列。"),
				nls.localize('sortOrder.fullPath', "在每个编辑器组内，编辑器按完整路径的字母顺序排列。")
			],
			'default': 'editorOrder'
		},
		'explorer.autoReveal': {
			'type': ['boolean', 'string'],
			'enum': [true, false, 'focusNoScroll'],
			'default': true,
			'enumDescriptions': [
				nls.localize('autoReveal.on', "将显示并选中对应文件。"),
				nls.localize('autoReveal.off', "不会显示并选中对应文件。"),
				nls.localize('autoReveal.focusNoScroll', "不会将文件滚动到可视区域，但仍会获得焦点。"),
			],
			'description': nls.localize('autoReveal', "控制资源管理器在打开文件时是否自动显示并选中它们。")
		},
		'explorer.autoRevealExclude': {
			'type': 'object',
			'markdownDescription': nls.localize('autoRevealExclude', "配置要从资源管理器的「打开时显示并选中」行为中排除的文件和文件夹路径或 `glob 模式`。除非使用绝对路径，否则 glob 模式始终相对于工作区文件夹的路径进行求值。"),
			'default': { '**/node_modules': true, '**/bower_components': true },
			'additionalProperties': {
				'anyOf': [
					{
						'type': 'boolean',
						'description': nls.localize('explorer.autoRevealExclude.boolean', "用于匹配文件路径的 glob 模式。设为 true 或 false 以启用或禁用该模式。"),
					},
					{
						type: 'object',
						properties: {
							when: {
								type: 'string', // expression ({ "**/*.js": { "when": "$(basename).js" } })
								pattern: '\\w*\\$\\(basename\\)\\w*',
								default: '$(basename).ext',
								description: nls.localize('explorer.autoRevealExclude.when', "对匹配文件的同级文件进行额外检查。使用 {0} 变量表示匹配的文件名。", '$(basename)')
							}
						}
					}
				]
			}
		},
		'explorer.enableDragAndDrop': {
			'type': 'boolean',
			'description': nls.localize('enableDragAndDrop', "控制资源管理器是否允许通过拖放移动文件和文件夹。此设置仅对资源管理器内部的拖放生效。"),
			'default': true
		},
		'explorer.confirmDragAndDrop': {
			'type': 'boolean',
			'description': nls.localize('confirmDragAndDrop', "控制通过拖放移动文件和文件夹时是否要求确认。"),
			'default': true
		},
		'explorer.confirmPasteNative': {
			'type': 'boolean',
			'description': nls.localize('confirmPasteNative', "控制粘贴本地文件和文件夹时是否要求确认。"),
			'default': true
		},
		'explorer.confirmDelete': {
			'type': 'boolean',
			'description': nls.localize('confirmDelete', "控制删除文件和文件夹时资源管理器是否要求确认。"),
			'default': true
		},
		'explorer.enableUndo': {
			'type': 'boolean',
			'description': nls.localize('enableUndo', "控制资源管理器是否支持撤销文件和文件夹操作。"),
			'default': true
		},
		'explorer.confirmUndo': {
			'type': 'string',
			'enum': [UndoConfirmLevel.Verbose, UndoConfirmLevel.Default, UndoConfirmLevel.Light],
			'description': nls.localize('confirmUndo', "控制撤销操作时资源管理器是否要求确认。"),
			'default': UndoConfirmLevel.Default,
			'enumDescriptions': [
				nls.localize('enableUndo.verbose', "所有撤销操作前资源管理器都会提示。"),
				nls.localize('enableUndo.default', "破坏性撤销操作前资源管理器会提示。"),
				nls.localize('enableUndo.light', "获得焦点时，资源管理器在撤销操作前不会提示。"),
			],
		},
		'explorer.expandSingleFolderWorkspaces': {
			'type': 'boolean',
			'description': nls.localize('expandSingleFolderWorkspaces', "控制资源管理器初始化时是否展开只包含一个文件夹的多根工作区"),
			'default': true
		},
		'explorer.sortOrder': {
			'type': 'string',
			'enum': [SortOrder.Default, SortOrder.Mixed, SortOrder.FilesFirst, SortOrder.Type, SortOrder.Modified, SortOrder.FoldersNestsFiles],
			'default': SortOrder.Default,
			'enumDescriptions': [
				nls.localize('sortOrder.default', "文件和文件夹按名称排序。文件夹显示在文件之前。"),
				nls.localize('sortOrder.mixed', "文件和文件夹按名称排序。文件与文件夹交错排列。"),
				nls.localize('sortOrder.filesFirst', "文件和文件夹按名称排序。文件显示在文件夹之前。"),
				nls.localize('sortOrder.type', "文件和文件夹先按扩展名类型分组，再按名称排序。文件夹显示在文件之前。"),
				nls.localize('sortOrder.modified', "文件和文件夹按最后修改日期降序排列。文件夹显示在文件之前。"),
				nls.localize('sortOrder.foldersNestsFiles', "文件和文件夹按名称排序。文件夹显示在文件之前。含有嵌套子项的文件显示在其他文件之前。")
			],
			'markdownDescription': nls.localize('sortOrder', "控制资源管理器中基于属性的文件和文件夹排序方式。启用 `#explorer.fileNesting.enabled#` 时，同时控制嵌套文件的排序。")
		},
		'explorer.sortOrderLexicographicOptions': {
			'type': 'string',
			'enum': [LexicographicOptions.Default, LexicographicOptions.Upper, LexicographicOptions.Lower, LexicographicOptions.Unicode],
			'default': LexicographicOptions.Default,
			'enumDescriptions': [
				nls.localize('sortOrderLexicographicOptions.default', "大写和小写名称混合排列。"),
				nls.localize('sortOrderLexicographicOptions.upper', "大写名称分组排列在小写名称之前。"),
				nls.localize('sortOrderLexicographicOptions.lower', "小写名称分组排列在大写名称之前。"),
				nls.localize('sortOrderLexicographicOptions.unicode', "按 Unicode 顺序排列名称。")
			],
			'description': nls.localize('sortOrderLexicographicOptions', "控制资源管理器中文件和文件夹名称的字典序排序方式。")
		},
		'explorer.sortOrderReverse': {
			'type': 'boolean',
			'description': nls.localize('sortOrderReverse', "控制是否反转文件和文件夹的排序顺序。"),
			'default': false,
		},
		'explorer.decorations.colors': {
			type: 'boolean',
			description: nls.localize('explorer.decorations.colors', "控制文件装饰是否使用颜色。"),
			default: true
		},
		'explorer.decorations.badges': {
			type: 'boolean',
			description: nls.localize('explorer.decorations.badges', "控制文件装饰是否使用徽章。"),
			default: true
		},
		'explorer.incrementalNaming': {
			'type': 'string',
			enum: ['simple', 'smart', 'disabled'],
			enumDescriptions: [
				nls.localize('simple', "在复制后的名称末尾追加 'copy' 一词，可能还会追加一个数字。"),
				nls.localize('smart', "在复制后的名称末尾添加一个数字。如果名称中已含有数字，则尝试增大该数字。"),
				nls.localize('disabled', "禁用增量命名。如果已存在两个同名文件，将提示你覆盖已有文件。")
			],
			description: nls.localize('explorer.incrementalNaming', "控制粘贴时为重复的资源管理器项命名所采用的策略。"),
			default: 'simple'
		},
		'explorer.autoOpenDroppedFile': {
			'type': 'boolean',
			'description': nls.localize('autoOpenDroppedFile', "控制将文件拖放到资源管理器时是否自动打开"),
			'default': true
		},
		'explorer.compactFolders': {
			'type': 'boolean',
			'description': nls.localize('compressSingleChildFolders', "控制资源管理器是否以紧凑形式呈现文件夹。在这种形式下，只有一个子项的文件夹会被压缩合并为一个树节点。例如这对于 Java 的包结构会很有用。"),
			'default': true
		},
		'explorer.copyRelativePathSeparator': {
			'type': 'string',
			'enum': [
				'/',
				'\\',
				'auto'
			],
			'enumDescriptions': [
				nls.localize('copyRelativePathSeparator.slash', "使用斜杠作为路径分隔符。"),
				nls.localize('copyRelativePathSeparator.backslash', "使用反斜杠作为路径分隔符。"),
				nls.localize('copyRelativePathSeparator.auto', "使用操作系统特定的路径分隔符。"),
			],
			'description': nls.localize('copyRelativePathSeparator', "复制相对文件路径时使用的路径分隔符。"),
			'default': 'auto'
		},
		'explorer.copyPathSeparator': {
			'type': 'string',
			'enum': [
				'/',
				'\\',
				'auto'
			],
			'enumDescriptions': [
				nls.localize('copyPathSeparator.slash', "使用斜杠作为路径分隔符。"),
				nls.localize('copyPathSeparator.backslash', "使用反斜杠作为路径分隔符。"),
				nls.localize('copyPathSeparator.auto', "使用操作系统特定的路径分隔符。"),
			],
			'description': nls.localize('copyPathSeparator', "复制文件路径时使用的路径分隔符。"),
			'default': 'auto'
		},
		'explorer.excludeGitIgnore': {
			type: 'boolean',
			markdownDescription: nls.localize('excludeGitignore', "控制是否解析 .gitignore 中的条目并将其从资源管理器中排除。与 {0} 类似。", '`#files.exclude#`'),
			default: false,
			scope: ConfigurationScope.RESOURCE
		},
		'explorer.fileNesting.enabled': {
			'type': 'boolean',
			scope: ConfigurationScope.RESOURCE,
			'markdownDescription': nls.localize('fileNestingEnabled', "控制资源管理器中是否启用文件嵌套。文件嵌套可以将目录下的相关文件在视觉上归组到同一个父文件下。"),
			'default': false,
		},
		'explorer.fileNesting.expand': {
			'type': 'boolean',
			'markdownDescription': nls.localize('fileNestingExpand', "控制是否自动展开文件嵌套。需设置 {0} 才能生效。", '`#explorer.fileNesting.enabled#`'),
			'default': true,
		},
		'explorer.fileNesting.patterns': {
			'type': 'object',
			scope: ConfigurationScope.RESOURCE,
			'markdownDescription': nls.localize('fileNestingPatterns', "控制资源管理器中的文件嵌套方式。必须设置 {0} 后才会生效。每个 __Item__ 表示一个父级模式，可以包含一个匹配任意字符串的 * 字符。每个 __Value__ 表示一组以英文逗号分隔的子级模式，它们会嵌套显示在对应父级之下。子级模式中可以包含以下特殊标记：\n- ${capture}：匹配父级模式中 * 解析得到的值\n- ${basename}：匹配父文件的基名，即 file.ts 中的 file\n- ${extname}：匹配父文件的扩展名，即 file.ts 中的 ts\n- ${dirname}：匹配父文件所在的目录名，即 src/file.ts 中的 src\n- *：匹配任意字符串，每个子级模式中只能使用一次。", '`#explorer.fileNesting.enabled#`'),
			patternProperties: {
				'^[^*]*\\*?[^*]*$': {
					markdownDescription: nls.localize('fileNesting.description', "每个键的模式最多可包含一个 `*` 字符，它将匹配任意字符串。"),
					type: 'string',
					pattern: '^([^,*]*\\*?[^,*]*)(, ?[^,*]*\\*?[^,*]*)*$',
				}
			},
			additionalProperties: false,
			'default': {
				'*.ts': '${capture}.js',
				'*.js': '${capture}.js.map, ${capture}.min.js, ${capture}.d.ts',
				'*.jsx': '${capture}.js',
				'*.tsx': '${capture}.ts',
				'tsconfig.json': 'tsconfig.*.json',
				'package.json': 'package-lock.json, yarn.lock, pnpm-lock.yaml, bun.lockb, bun.lock',
			}
		}
	}
});

UndoCommand.addImplementation(110, 'explorer', (accessor: ServicesAccessor) => {
	const undoRedoService = accessor.get(IUndoRedoService);
	const explorerService = accessor.get(IExplorerService);
	const configurationService = accessor.get(IConfigurationService);

	const explorerCanUndo = configurationService.getValue<IFilesConfiguration>().explorer.enableUndo;
	if (explorerService.hasViewFocus() && undoRedoService.canUndo(UNDO_REDO_SOURCE) && explorerCanUndo) {
		undoRedoService.undo(UNDO_REDO_SOURCE);
		return true;
	}

	return false;
});

RedoCommand.addImplementation(110, 'explorer', (accessor: ServicesAccessor) => {
	const undoRedoService = accessor.get(IUndoRedoService);
	const explorerService = accessor.get(IExplorerService);
	const configurationService = accessor.get(IConfigurationService);

	const explorerCanUndo = configurationService.getValue<IFilesConfiguration>().explorer.enableUndo;
	if (explorerService.hasViewFocus() && undoRedoService.canRedo(UNDO_REDO_SOURCE) && explorerCanUndo) {
		undoRedoService.redo(UNDO_REDO_SOURCE);
		return true;
	}

	return false;
});

ModesRegistry.registerLanguage({
	id: BINARY_TEXT_FILE_MODE,
	aliases: ['Binary'],
	mimetypes: ['text/x-code-binary']
});
