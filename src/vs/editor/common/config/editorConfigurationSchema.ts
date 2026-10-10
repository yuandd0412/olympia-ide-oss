/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IJSONSchemaSnippet } from '../../../base/common/jsonSchema.js';
import { diffEditorDefaultOptions } from './diffEditor.js';
import { editorOptionsRegistry } from './editorOptions.js';
import { EDITOR_MODEL_DEFAULTS } from '../core/misc/textModelDefaults.js';
import * as nls from '../../../nls.js';
import { ConfigurationScope, Extensions, IConfigurationNode, IConfigurationPropertySchema, IConfigurationRegistry } from '../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../platform/registry/common/platform.js';

export const editorConfigurationBaseNode = Object.freeze<IConfigurationNode>({
	id: 'editor',
	order: 5,
	type: 'object',
	title: nls.localize('editorConfigurationTitle', "编辑器"),
	scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
});

const editorConfiguration: IConfigurationNode = {
	...editorConfigurationBaseNode,
	properties: {
		'editor.tabSize': {
			type: 'number',
			default: EDITOR_MODEL_DEFAULTS.tabSize,
			minimum: 1,
			maximum: 100,
			markdownDescription: nls.localize('tabSize', "一个制表符等于多少个空格。当 {0} 开启时，会根据文件内容覆盖此设置。", '`#editor.detectIndentation#`')
		},
		'editor.indentSize': {
			'anyOf': [
				{
					type: 'string',
					enum: ['tabSize']
				},
				{
					type: 'number',
					minimum: 1
				}
			],
			default: 'tabSize',
			markdownDescription: nls.localize('indentSize', "用于缩进的空格数量。设为 `\"tabSize\"` 时使用 `#editor.tabSize#` 的值。启用 `#editor.detectIndentation#` 时，该设置会根据文件内容被覆盖。")
		},
		'editor.insertSpaces': {
			type: 'boolean',
			default: EDITOR_MODEL_DEFAULTS.insertSpaces,
			markdownDescription: nls.localize('insertSpaces', "按 `Tab` 时插入空格。当 {0} 开启时，会根据文件内容覆盖此设置。", '`#editor.detectIndentation#`')
		},
		'editor.detectIndentation': {
			type: 'boolean',
			default: EDITOR_MODEL_DEFAULTS.detectIndentation,
			markdownDescription: nls.localize('detectIndentation', "控制打开文件时是否根据内容自动检测 {0} 和 {1}。", '`#editor.tabSize#`', '`#editor.insertSpaces#`')
		},
		'editor.trimAutoWhitespace': {
			type: 'boolean',
			default: EDITOR_MODEL_DEFAULTS.trimAutoWhitespace,
			description: nls.localize('trimAutoWhitespace', "删除自动插入的行尾空白。")
		},
		'editor.largeFileOptimizations': {
			type: 'boolean',
			default: EDITOR_MODEL_DEFAULTS.largeFileOptimizations,
			description: nls.localize('largeFileOptimizations', "对大文件做特殊处理，关闭部分占用内存较大的功能。")
		},
		'editor.wordBasedSuggestions': {
			enum: ['off', 'offWithInlineSuggestions', 'currentDocument', 'matchingDocuments', 'allDocuments'],
			default: 'offWithInlineSuggestions',
			enumDescriptions: [
				nls.localize('wordBasedSuggestions.off', "关闭基于单词的建议。"),
				nls.localize('wordBasedSuggestions.offWithInlineSuggestions', "存在内联建议时关闭基于单词的建议。"),
				nls.localize('wordBasedSuggestions.currentDocument', "仅从活动文档中推荐单词。"),
				nls.localize('wordBasedSuggestions.matchingDocuments', "从所有已打开的同语言文档中推荐单词。"),
				nls.localize('wordBasedSuggestions.allDocuments', "从所有已打开的文档中推荐单词。"),
			],
			description: nls.localize('wordBasedSuggestions', "控制补全是否基于文档中的词语计算，以及基于哪些文档计算。"),
			experiment: { mode: 'auto' },
		},
		'editor.semanticHighlighting.enabled': {
			enum: [true, false, 'configuredByTheme'],
			enumDescriptions: [
				nls.localize('semanticHighlighting.true', "对所有配色主题启用语义高亮。"),
				nls.localize('semanticHighlighting.false', "对所有配色主题禁用语义高亮。"),
				nls.localize('semanticHighlighting.configuredByTheme', "语义高亮由当前配色主题的 `semanticHighlighting` 设置决定。")
			],
			default: 'configuredByTheme',
			description: nls.localize('semanticHighlighting.enabled', "控制对支持的语言显示语义高亮。")
		},
		'editor.stablePeek': {
			type: 'boolean',
			default: false,
			markdownDescription: nls.localize('stablePeek', "双击内容或按 `Escape` 时仍保持窥视编辑器打开。")
		},
		'editor.maxTokenizationLineLength': {
			type: 'integer',
			default: 20_000,
			description: nls.localize('maxTokenizationLineLength', "出于性能考虑，超过该长度的行不做词法分析")
		},
		'editor.experimental.asyncTokenization': {
			type: 'boolean',
			default: true,
			description: nls.localize('editor.experimental.asyncTokenization', "控制词法分析是否在 web worker 中异步进行。"),
			tags: ['experimental'],
		},
		'editor.experimental.asyncTokenizationLogging': {
			type: 'boolean',
			default: false,
			description: nls.localize('editor.experimental.asyncTokenizationLogging', "控制是否记录异步词法分析的日志。仅用于调试。"),
		},
		'editor.experimental.asyncTokenizationVerification': {
			type: 'boolean',
			default: false,
			description: nls.localize('editor.experimental.asyncTokenizationVerification', "控制是否用旧版后台词法分析校验异步结果，可能拖慢速度。仅用于调试。"),
			tags: ['experimental'],
		},
		'editor.experimental.treeSitterTelemetry': {
			type: 'boolean',
			default: false,
			markdownDescription: nls.localize('editor.experimental.treeSitterTelemetry', "控制是否启用 tree-sitter 解析并收集遥测数据。为特定语言设置 `#editor.experimental.preferTreeSitter#` 时优先生效。"),
			tags: ['experimental'],
			experiment: {
				mode: 'auto'
			}
		},
		'editor.experimental.preferTreeSitter.css': {
			type: 'boolean',
			default: false,
			markdownDescription: nls.localize('editor.experimental.preferTreeSitter.css', "控制是否为 css 启用 tree sitter 解析。对 css 而言，此设置的优先级高于 `#editor.experimental.treeSitterTelemetry#`。"),
			tags: ['experimental'],
			experiment: {
				mode: 'auto'
			}
		},
		'editor.experimental.preferTreeSitter.typescript': {
			type: 'boolean',
			default: false,
			markdownDescription: nls.localize('editor.experimental.preferTreeSitter.typescript', "控制是否为 TypeScript 启用 tree-sitter 解析。对 TypeScript 而言，该设置优先于 `#editor.experimental.treeSitterTelemetry#`。"),
			tags: ['experimental'],
			experiment: {
				mode: 'auto'
			}
		},
		'editor.experimental.preferTreeSitter.ini': {
			type: 'boolean',
			default: false,
			markdownDescription: nls.localize('editor.experimental.preferTreeSitter.ini', "控制是否为 ini 启用 tree sitter 解析。对 ini 而言，此设置的优先级高于 `#editor.experimental.treeSitterTelemetry#`。"),
			tags: ['experimental'],
			experiment: {
				mode: 'auto'
			}
		},
		'editor.experimental.preferTreeSitter.regex': {
			type: 'boolean',
			default: false,
			markdownDescription: nls.localize('editor.experimental.preferTreeSitter.regex', "控制是否为 regex 启用 tree sitter 解析。对 regex 而言，此设置的优先级高于 `#editor.experimental.treeSitterTelemetry#`。"),
			tags: ['experimental'],
			experiment: {
				mode: 'auto'
			}
		},
		'editor.language.brackets': {
			type: ['array', 'null'],
			default: null, // We want to distinguish the empty array from not configured.
			description: nls.localize('schema.brackets', "定义用于增加或减少缩进的括号符号。"),
			items: {
				type: 'array',
				items: [
					{
						type: 'string',
						description: nls.localize('schema.openBracket', "起始括号字符或字符串序列。")
					},
					{
						type: 'string',
						description: nls.localize('schema.closeBracket', "结束括号字符或字符串序列。")
					}
				]
			}
		},
		'editor.language.colorizedBracketPairs': {
			type: ['array', 'null'],
			default: null, // We want to distinguish the empty array from not configured.
			description: nls.localize('schema.colorizedBracketPairs', "定义在启用括号对着色时按嵌套层级着色的括号对。"),
			items: {
				type: 'array',
				items: [
					{
						type: 'string',
						description: nls.localize('schema.openBracket', "起始括号字符或字符串序列。")
					},
					{
						type: 'string',
						description: nls.localize('schema.closeBracket', "结束括号字符或字符串序列。")
					}
				]
			}
		},
		'diffEditor.maxComputationTime': {
			type: 'number',
			default: diffEditorDefaultOptions.maxComputationTime,
			description: nls.localize('maxComputationTime', "计算差异的超时时间（毫秒），超时则取消。设为 0 表示不超时。")
		},
		'diffEditor.maxFileSize': {
			type: 'number',
			default: diffEditorDefaultOptions.maxFileSize,
			description: nls.localize('maxFileSize', "计算差异所允许的最大文件大小（MB）。设为 0 表示不限制。")
		},
		'diffEditor.renderSideBySide': {
			type: 'boolean',
			default: diffEditorDefaultOptions.renderSideBySide,
			description: nls.localize('sideBySide', "控制差异编辑器是并排显示还是内联显示。"),
			agentsWindow: { default: true },
		},
		'diffEditor.renderSideBySideInlineBreakpoint': {
			type: 'number',
			default: diffEditorDefaultOptions.renderSideBySideInlineBreakpoint,
			description: nls.localize('renderSideBySideInlineBreakpoint', "当差异编辑器宽度小于该值时，使用内联视图。")
		},
		'diffEditor.useInlineViewWhenSpaceIsLimited': {
			type: 'boolean',
			default: diffEditorDefaultOptions.useInlineViewWhenSpaceIsLimited,
			description: nls.localize('useInlineViewWhenSpaceIsLimited', "启用后，若编辑器宽度过小则使用内联视图。"),
			agentsWindow: { default: true },
		},
		'diffEditor.hideOriginalLineNumbers': {
			type: ['boolean', 'null'],
			default: null,
			description: nls.localize('hideOriginalLineNumbers', "控制是否在内联差异中隐藏原始行号。设为 null 时使用编辑器默认值：紧凑多文件差异编辑器中隐藏，其他差异编辑器中显示。"),
		},
		'diffEditor.renderMarginRevertIcon': {
			type: 'boolean',
			default: diffEditorDefaultOptions.renderMarginRevertIcon,
			description: nls.localize('renderMarginRevertIcon', "启用后，差异编辑器会在字形边距显示还原改动的箭头。"),
			agentsWindow: { default: false },
		},
		'diffEditor.renderGutterMenu': {
			type: 'boolean',
			default: diffEditorDefaultOptions.renderGutterMenu,
			description: nls.localize('renderGutterMenu', "启用后，差异编辑器会显示用于还原和暂存的专用装订线。"),
			agentsWindow: { default: false },
		},
		'diffEditor.ignoreTrimWhitespace': {
			type: 'boolean',
			default: diffEditorDefaultOptions.ignoreTrimWhitespace,
			description: nls.localize('ignoreTrimWhitespace', "启用后，差异编辑器忽略行首和行尾的空白改动。")
		},
		'diffEditor.renderIndicators': {
			type: 'boolean',
			default: diffEditorDefaultOptions.renderIndicators,
			description: nls.localize('renderIndicators', "控制差异编辑器是否为新增/删除的改动显示 +/- 标记。"),
			agentsWindow: { default: false },
		},
		'diffEditor.codeLens': {
			type: 'boolean',
			default: diffEditorDefaultOptions.diffCodeLens,
			description: nls.localize('codeLens', "控制编辑器是否显示 CodeLens。")
		},
		'diffEditor.wordWrap': {
			type: 'string',
			enum: ['off', 'on', 'inherit'],
			default: diffEditorDefaultOptions.diffWordWrap,
			markdownEnumDescriptions: [
				nls.localize('wordWrap.off', "永不换行。"),
				nls.localize('wordWrap.on', "按视口宽度换行。"),
				nls.localize('wordWrap.inherit', "将根据 {0} 设置自动换行。", '`#editor.wordWrap#`'),
			]
		},
		'diffEditor.diffAlgorithm': {
			type: 'string',
			enum: ['legacy', 'advanced', 'advanced-external', 'advanced-wasm'],
			default: diffEditorDefaultOptions.diffAlgorithm,
			markdownEnumDescriptions: [
				nls.localize('diffAlgorithm.legacy', "使用旧版差异算法。"),
				nls.localize('diffAlgorithm.advanced', "使用新版差异算法。"),
				nls.localize('diffAlgorithm.advancedExternal', "使用外部 `@vscode/diff` 包提供的新版差异算法（纯 JavaScript）。"),
				nls.localize('diffAlgorithm.advancedWasm', "使用外部 `@vscode/diff` 包提供的新版差异算法（WebAssembly）。"),
			]
		},
		'diffEditor.hideUnchangedRegions.enabled': {
			type: 'boolean',
			default: diffEditorDefaultOptions.hideUnchangedRegions.enabled,
			markdownDescription: nls.localize('hideUnchangedRegions.enabled', "控制差异编辑器是否显示未改动的区域。"),
			agentsWindow: { default: true },
		},
		'diffEditor.hideUnchangedRegions.revealLineCount': {
			type: 'integer',
			default: diffEditorDefaultOptions.hideUnchangedRegions.revealLineCount,
			markdownDescription: nls.localize('hideUnchangedRegions.revealLineCount', "控制未改动区域使用多少行。"),
			minimum: 1,
		},
		'diffEditor.hideUnchangedRegions.minimumLineCount': {
			type: 'integer',
			default: diffEditorDefaultOptions.hideUnchangedRegions.minimumLineCount,
			markdownDescription: nls.localize('hideUnchangedRegions.minimumLineCount', "控制未改动区域最少使用多少行。"),
			minimum: 1,
		},
		'diffEditor.hideUnchangedRegions.contextLineCount': {
			type: 'integer',
			default: diffEditorDefaultOptions.hideUnchangedRegions.contextLineCount,
			markdownDescription: nls.localize('hideUnchangedRegions.contextLineCount', "控制比较未改动区域时用作上下文的行数。"),
			minimum: 1,
		},
		'diffEditor.experimental.showMoves': {
			type: 'boolean',
			default: diffEditorDefaultOptions.experimental.showMoves,
			markdownDescription: nls.localize('showMoves', "控制差异编辑器是否显示检测到的代码移动。")
		},
		'diffEditor.experimental.showEmptyDecorations': {
			type: 'boolean',
			default: diffEditorDefaultOptions.experimental.showEmptyDecorations,
			description: nls.localize('showEmptyDecorations', "控制差异编辑器是否显示空位装饰，以标示字符插入或删除的位置。"),
		},
		'diffEditor.experimental.useTrueInlineView': {
			type: 'boolean',
			default: diffEditorDefaultOptions.experimental.useTrueInlineView,
			description: nls.localize('useTrueInlineView', "启用后，若编辑器使用内联视图，词语级改动将内联显示。"),
		},
	}
};

function isConfigurationPropertySchema(x: IConfigurationPropertySchema | { [path: string]: IConfigurationPropertySchema }): x is IConfigurationPropertySchema {
	return (typeof x.type !== 'undefined' || typeof x.anyOf !== 'undefined');
}

// Add properties from the Editor Option Registry
for (const editorOption of editorOptionsRegistry) {
	const schema = editorOption.schema;
	if (typeof schema !== 'undefined') {
		if (isConfigurationPropertySchema(schema)) {
			// This is a single schema contribution
			editorConfiguration.properties![`editor.${editorOption.name}`] = schema;
		} else {
			for (const key in schema) {
				if (Object.hasOwnProperty.call(schema, key)) {
					editorConfiguration.properties![key] = schema[key];
				}
			}
		}
	}
}

let cachedEditorConfigurationKeys: { [key: string]: boolean } | null = null;
function getEditorConfigurationKeys(): { [key: string]: boolean } {
	if (cachedEditorConfigurationKeys === null) {
		cachedEditorConfigurationKeys = <{ [key: string]: boolean }>Object.create(null);
		Object.keys(editorConfiguration.properties!).forEach((prop) => {
			cachedEditorConfigurationKeys![prop] = true;
		});
	}
	return cachedEditorConfigurationKeys;
}

export function isEditorConfigurationKey(key: string): boolean {
	const editorConfigurationKeys = getEditorConfigurationKeys();
	return (editorConfigurationKeys[`editor.${key}`] || false);
}

export function isDiffEditorConfigurationKey(key: string): boolean {
	const editorConfigurationKeys = getEditorConfigurationKeys();
	return (editorConfigurationKeys[`diffEditor.${key}`] || false);
}

const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
configurationRegistry.registerConfiguration(editorConfiguration);

export async function registerEditorFontConfigurations(getFontSnippets: () => Promise<IJSONSchemaSnippet[]>) {
	const editorKeysWithFont = ['editor.fontFamily'];
	const fontSnippets = await getFontSnippets();
	for (const key of editorKeysWithFont) {
		if (
			editorConfiguration.properties && editorConfiguration.properties[key]
		) {
			editorConfiguration.properties[key].defaultSnippets = fontSnippets;
		}
	}
}
