/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IJSONSchema } from '../../../../base/common/jsonSchema.js';
import * as nls from '../../../../nls.js';
import { ExtensionsRegistry } from '../../../services/extensions/common/extensionsRegistry.js';
import { NotebookEditorPriority, ContributedNotebookRendererEntrypoint, RendererMessagingSpec } from '../common/notebookCommon.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IExtensionManifest } from '../../../../platform/extensions/common/extensions.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IExtensionFeatureTableRenderer, IRenderedData, ITableData, IRowData, IExtensionFeaturesRegistry, Extensions } from '../../../services/extensionManagement/common/extensionFeatures.js';
import { Registry } from '../../../../platform/registry/common/platform.js';

const NotebookEditorContribution = Object.freeze({
	type: 'type',
	displayName: 'displayName',
	selector: 'selector',
	priority: 'priority',
});

export interface INotebookEditorContribution {
	readonly [NotebookEditorContribution.type]: string;
	readonly [NotebookEditorContribution.displayName]: string;
	readonly [NotebookEditorContribution.selector]?: readonly { filenamePattern?: string; excludeFileNamePattern?: string }[];
	readonly [NotebookEditorContribution.priority]?: string;
}

const NotebookRendererContribution = Object.freeze({
	id: 'id',
	displayName: 'displayName',
	mimeTypes: 'mimeTypes',
	entrypoint: 'entrypoint',
	hardDependencies: 'dependencies',
	optionalDependencies: 'optionalDependencies',
	requiresMessaging: 'requiresMessaging',
});

export interface INotebookRendererContribution {
	readonly [NotebookRendererContribution.id]?: string;
	readonly [NotebookRendererContribution.displayName]: string;
	readonly [NotebookRendererContribution.mimeTypes]?: readonly string[];
	readonly [NotebookRendererContribution.entrypoint]: ContributedNotebookRendererEntrypoint;
	readonly [NotebookRendererContribution.hardDependencies]: readonly string[];
	readonly [NotebookRendererContribution.optionalDependencies]: readonly string[];
	readonly [NotebookRendererContribution.requiresMessaging]: RendererMessagingSpec;
}

const NotebookPreloadContribution = Object.freeze({
	type: 'type',
	entrypoint: 'entrypoint',
	localResourceRoots: 'localResourceRoots',
});

interface INotebookPreloadContribution {
	readonly [NotebookPreloadContribution.type]: string;
	readonly [NotebookPreloadContribution.entrypoint]: string;
	readonly [NotebookPreloadContribution.localResourceRoots]: readonly string[];
}

const notebookProviderContribution: IJSONSchema = {
	description: nls.localize('contributes.notebook.provider', "提供笔记本文档处理程序。"),
	type: 'array',
	defaultSnippets: [{ body: [{ type: '', displayName: '', 'selector': [{ 'filenamePattern': '' }] }] }],
	items: {
		type: 'object',
		required: [
			NotebookEditorContribution.type,
			NotebookEditorContribution.displayName,
			NotebookEditorContribution.selector,
		],
		properties: {
			[NotebookEditorContribution.type]: {
				type: 'string',
				description: nls.localize('contributes.notebook.provider.viewType', "笔记本类型。"),
			},
			[NotebookEditorContribution.displayName]: {
				type: 'string',
				description: nls.localize('contributes.notebook.provider.displayName', "笔记本的可读名称。"),
			},
			[NotebookEditorContribution.selector]: {
				type: 'array',
				description: nls.localize('contributes.notebook.provider.selector', "适用于笔记本的一组 glob 模式。"),
				items: {
					type: 'object',
					properties: {
						filenamePattern: {
							type: 'string',
							description: nls.localize('contributes.notebook.provider.selector.filenamePattern', "启用笔记本的 glob 模式。"),
						},
						excludeFileNamePattern: {
							type: 'string',
							description: nls.localize('contributes.notebook.selector.provider.excludeFileNamePattern', "禁用笔记本的 glob 模式。")
						}
					}
				}
			},
			[NotebookEditorContribution.priority]: {
				type: 'string',
				markdownDeprecationMessage: nls.localize('contributes.priority', "控制在用户打开文件时是否自动启用自定义编辑器。用户可能会使用 \"workbench.editorAssociations\" 设置覆盖此项。"),
				enum: [
					NotebookEditorPriority.default,
					NotebookEditorPriority.option,
				],
				markdownEnumDescriptions: [
					nls.localize('contributes.priority.default', "在用户打开资源时自动使用此编辑器，前提是没有为该资源注册其他默认的自定义编辑器。"),
					nls.localize('contributes.priority.option', "在用户打开资源时不会自动使用此编辑器，但用户可使用 `Reopen With` 命令切换到此编辑器。"),
				],
				default: 'default'
			}
		}
	}
};

const defaultRendererSnippet = Object.freeze({ id: '', displayName: '', mimeTypes: [''], entrypoint: '' });

const notebookRendererContribution: IJSONSchema = {
	description: nls.localize('contributes.notebook.renderer', "提供笔记本输出渲染器。"),
	type: 'array',
	defaultSnippets: [{ body: [defaultRendererSnippet] }],
	items: {
		defaultSnippets: [{ body: defaultRendererSnippet }],
		allOf: [
			{
				type: 'object',
				required: [
					NotebookRendererContribution.id,
					NotebookRendererContribution.displayName,
				],
				properties: {
					[NotebookRendererContribution.id]: {
						type: 'string',
						description: nls.localize('contributes.notebook.renderer.viewType', "笔记本输出渲染器的唯一标识符。"),
					},
					[NotebookRendererContribution.displayName]: {
						type: 'string',
						description: nls.localize('contributes.notebook.renderer.displayName', "笔记本输出渲染器的可读名称。"),
					},
					[NotebookRendererContribution.hardDependencies]: {
						type: 'array',
						uniqueItems: true,
						items: { type: 'string' },
						markdownDescription: nls.localize('contributes.notebook.renderer.hardDependencies', "呈现器所需的内核依赖项的列表。如果 \"NotebookKernel\" 中存在任何依赖关系，则可以使用呈现器。"),
					},
					[NotebookRendererContribution.optionalDependencies]: {
						type: 'array',
						uniqueItems: true,
						items: { type: 'string' },
						markdownDescription: nls.localize('contributes.notebook.renderer.optionalDependencies', "呈现器可利用的软内核依赖项的列表。如果 \"NotebookKernel\" 中存在任何依赖关系，则呈现器将优先于不与内核交互的呈现器。"),
					},
					[NotebookRendererContribution.requiresMessaging]: {
						default: 'never',
						enum: [
							'always',
							'optional',
							'never',
						],
						enumDescriptions: [
							nls.localize('contributes.notebook.renderer.requiresMessaging.always', "消息传递是必需的。仅当它是可在扩展主机中运行的扩展的一部分时，才会使用该呈现器。"),
							nls.localize('contributes.notebook.renderer.requiresMessaging.optional', "有可用的消息传递时，呈现器效果更好，但不强制要求。"),
							nls.localize('contributes.notebook.renderer.requiresMessaging.never', "呈现器不需要消息传递。"),
						],
						description: nls.localize('contributes.notebook.renderer.requiresMessaging', "定义呈现器是否需要通过 \"createRendererMessaging\" 与扩展主机通信。具有较强消息传递要求的呈现器可能在所有环境中都不起作用。"),
					},
				}
			},
			{
				oneOf: [
					{
						required: [
							NotebookRendererContribution.entrypoint,
							NotebookRendererContribution.mimeTypes,
						],
						properties: {
							[NotebookRendererContribution.mimeTypes]: {
								type: 'array',
								description: nls.localize('contributes.notebook.selector', "适用于笔记本的一组 glob 模式。"),
								items: {
									type: 'string'
								}
							},
							[NotebookRendererContribution.entrypoint]: {
								description: nls.localize('contributes.notebook.renderer.entrypoint', "要在 Web 视图中加载用于呈现扩展的文件。"),
								type: 'string',
							},
						}
					},
					{
						required: [
							NotebookRendererContribution.entrypoint,
						],
						properties: {
							[NotebookRendererContribution.entrypoint]: {
								description: nls.localize('contributes.notebook.renderer.entrypoint', "要在 Web 视图中加载用于呈现扩展的文件。"),
								type: 'object',
								required: ['extends', 'path'],
								properties: {
									extends: {
										type: 'string',
										description: nls.localize('contributes.notebook.renderer.entrypoint.extends', "此呈现器扩展的现有呈现器。"),
									},
									path: {
										type: 'string',
										description: nls.localize('contributes.notebook.renderer.entrypoint', "要在 Web 视图中加载用于呈现扩展的文件。"),
									},
								}
							},
						}
					}
				]
			}
		]
	}
};

const notebookPreloadContribution: IJSONSchema = {
	description: nls.localize('contributes.preload.provider', "提供笔记本预加载。"),
	type: 'array',
	defaultSnippets: [{ body: [{ type: '', entrypoint: '' }] }],
	items: {
		type: 'object',
		required: [
			NotebookPreloadContribution.type,
			NotebookPreloadContribution.entrypoint
		],
		properties: {
			[NotebookPreloadContribution.type]: {
				type: 'string',
				description: nls.localize('contributes.preload.provider.viewType', "笔记本类型。"),
			},
			[NotebookPreloadContribution.entrypoint]: {
				type: 'string',
				description: nls.localize('contributes.preload.entrypoint', "Web 视图中加载的文件的路径。"),
			},
			[NotebookPreloadContribution.localResourceRoots]: {
				type: 'array',
				items: { type: 'string' },
				description: nls.localize('contributes.preload.localResourceRoots', "Web 视图中应允许的其他资源的路径。"),
			},
		}
	}
};

export const notebooksExtensionPoint = ExtensionsRegistry.registerExtensionPoint<INotebookEditorContribution[]>({
	extensionPoint: 'notebooks',
	jsonSchema: notebookProviderContribution,
	activationEventsGenerator: function* (contribs: readonly INotebookEditorContribution[]) {
		for (const contrib of contribs) {
			if (contrib.type) {
				yield `onNotebookSerializer:${contrib.type}`;
			}
		}
	}
});

export const notebookRendererExtensionPoint = ExtensionsRegistry.registerExtensionPoint<INotebookRendererContribution[]>({
	extensionPoint: 'notebookRenderer',
	jsonSchema: notebookRendererContribution,
	activationEventsGenerator: function* (contribs: readonly INotebookRendererContribution[]) {
		for (const contrib of contribs) {
			if (contrib.id) {
				yield `onRenderer:${contrib.id}`;
			}
		}
	}
});

export const notebookPreloadExtensionPoint = ExtensionsRegistry.registerExtensionPoint<INotebookPreloadContribution[]>({
	extensionPoint: 'notebookPreload',
	jsonSchema: notebookPreloadContribution,
});

class NotebooksDataRenderer extends Disposable implements IExtensionFeatureTableRenderer {

	readonly type = 'table';

	shouldRender(manifest: IExtensionManifest): boolean {
		return !!manifest.contributes?.notebooks;
	}

	render(manifest: IExtensionManifest): IRenderedData<ITableData> {
		const contrib = manifest.contributes?.notebooks || [];
		if (!contrib.length) {
			return { data: { headers: [], rows: [] }, dispose: () => { } };
		}

		const headers = [
			nls.localize('Notebook id', "标识符"),
			nls.localize('Notebook name', "名称"),
		];

		const rows: IRowData[][] = contrib
			.sort((a, b) => a.type.localeCompare(b.type))
			.map(notebook => {
				return [
					notebook.type,
					notebook.displayName
				];
			});

		return {
			data: {
				headers,
				rows
			},
			dispose: () => { }
		};
	}
}

class NotebookRenderersDataRenderer extends Disposable implements IExtensionFeatureTableRenderer {

	readonly type = 'table';

	shouldRender(manifest: IExtensionManifest): boolean {
		return !!manifest.contributes?.notebookRenderer;
	}

	render(manifest: IExtensionManifest): IRenderedData<ITableData> {
		const contrib = manifest.contributes?.notebookRenderer || [];
		if (!contrib.length) {
			return { data: { headers: [], rows: [] }, dispose: () => { } };
		}

		const headers = [
			nls.localize('Notebook renderer name', "名称"),
			nls.localize('Notebook mimetypes', "Mimetypes"),
		];

		const rows: IRowData[][] = contrib
			.sort((a, b) => a.displayName.localeCompare(b.displayName))
			.map(notebookRenderer => {
				return [
					notebookRenderer.displayName,
					notebookRenderer.mimeTypes.join(',')
				];
			});

		return {
			data: {
				headers,
				rows
			},
			dispose: () => { }
		};
	}
}

Registry.as<IExtensionFeaturesRegistry>(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
	id: 'notebooks',
	label: nls.localize('notebooks', "笔记本"),
	access: {
		canToggle: false
	},
	renderer: new SyncDescriptor(NotebooksDataRenderer),
});

Registry.as<IExtensionFeaturesRegistry>(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
	id: 'notebookRenderer',
	label: nls.localize('notebookRenderer', "笔记本呈现器"),
	access: {
		canToggle: false
	},
	renderer: new SyncDescriptor(NotebookRenderersDataRenderer),
});
