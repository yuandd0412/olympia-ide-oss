/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as extensionsRegistry from '../../../services/extensions/common/extensionsRegistry.js';
import * as nls from '../../../../nls.js';
import { IDebuggerContribution, ICompound, IBreakpointContribution } from './debug.js';
import { launchSchemaId } from '../../../services/configuration/common/configuration.js';
import { IJSONSchema } from '../../../../base/common/jsonSchema.js';
import { inputsSchema } from '../../../services/configurationResolver/common/configurationResolverSchema.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Extensions, IExtensionFeatureTableRenderer, IExtensionFeaturesRegistry, IRenderedData, IRowData, ITableData } from '../../../services/extensionManagement/common/extensionFeatures.js';
import { IExtensionManifest } from '../../../../platform/extensions/common/extensions.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';

// debuggers extension point
export const debuggersExtPoint = extensionsRegistry.ExtensionsRegistry.registerExtensionPoint<IDebuggerContribution[]>({
	extensionPoint: 'debuggers',
	defaultExtensionKind: ['workspace'],
	jsonSchema: {
		description: nls.localize('vscode.extension.contributes.debuggers', "用于调试适配器。"),
		type: 'array',
		defaultSnippets: [{ body: [{ type: '' }] }],
		items: {
			additionalProperties: false,
			type: 'object',
			defaultSnippets: [{ body: { type: '', program: '', runtime: '' } }],
			properties: {
				type: {
					description: nls.localize('vscode.extension.contributes.debuggers.type', "此调试适配器的唯一标识符。"),
					type: 'string'
				},
				label: {
					description: nls.localize('vscode.extension.contributes.debuggers.label', "此调试适配器的显示名称。"),
					type: 'string'
				},
				program: {
					description: nls.localize('vscode.extension.contributes.debuggers.program', "调试适配器程序的路径。可以是绝对路径，也可以是相对于扩展文件夹的路径。"),
					type: 'string'
				},
				args: {
					description: nls.localize('vscode.extension.contributes.debuggers.args', "传递给适配器的可选参数。"),
					type: 'array'
				},
				runtime: {
					description: nls.localize('vscode.extension.contributes.debuggers.runtime', "当 program 属性不是可执行文件、需要借助运行时时的可选运行时。"),
					type: 'string'
				},
				runtimeArgs: {
					description: nls.localize('vscode.extension.contributes.debuggers.runtimeArgs', "可选的运行时参数。"),
					type: 'array'
				},
				variables: {
					description: nls.localize('vscode.extension.contributes.debuggers.variables', "将 `launch.json` 中的交互式变量（例如 ${action.pickProcess}）映射到命令。"),
					type: 'object'
				},
				initialConfigurations: {
					description: nls.localize('vscode.extension.contributes.debuggers.initialConfigurations', "用于生成初始 `launch.json` 的配置。"),
					type: ['array', 'string'],
				},
				languages: {
					description: nls.localize('vscode.extension.contributes.debuggers.languages', "可将此调试扩展视为「默认调试器」的语言列表。"),
					type: 'array'
				},
				configurationSnippets: {
					description: nls.localize('vscode.extension.contributes.debuggers.configurationSnippets', "用于在 `launch.json` 中添加新配置的代码片段。"),
					type: 'array'
				},
				configurationAttributes: {
					description: nls.localize('vscode.extension.contributes.debuggers.configurationAttributes', "用于校验 `launch.json` 的 JSON Schema 配置。"),
					type: 'object'
				},
				when: {
					description: nls.localize('vscode.extension.contributes.debuggers.when', "必须为 true 才能启用此类型调试器的条件。请考虑根据需要为此项使用 “shellExecutionSupported”、“virtualWorkspace”、“resourceScheme” 或扩展定义的上下文键。"),
					type: 'string',
					default: ''
				},
				hiddenWhen: {
					description: nls.localize('vscode.extension.contributes.debuggers.hiddenWhen', "当该条件为 true 时，此调试器类型会从调试器列表中隐藏，但仍然启用。"),
					type: 'string',
					default: ''
				},
				deprecated: {
					description: nls.localize('vscode.extension.contributes.debuggers.deprecated', "用于标记该调试类型已弃用的可选消息。"),
					type: 'string',
					default: ''
				},
				windows: {
					description: nls.localize('vscode.extension.contributes.debuggers.windows', "Windows 平台专用设置。"),
					type: 'object',
					properties: {
						runtime: {
							description: nls.localize('vscode.extension.contributes.debuggers.windows.runtime', "Windows 上使用的运行时。"),
							type: 'string'
						}
					}
				},
				osx: {
					description: nls.localize('vscode.extension.contributes.debuggers.osx', "macOS 平台专用设置。"),
					type: 'object',
					properties: {
						runtime: {
							description: nls.localize('vscode.extension.contributes.debuggers.osx.runtime', "macOS 上使用的运行时。"),
							type: 'string'
						}
					}
				},
				linux: {
					description: nls.localize('vscode.extension.contributes.debuggers.linux', "Linux 平台专用设置。"),
					type: 'object',
					properties: {
						runtime: {
							description: nls.localize('vscode.extension.contributes.debuggers.linux.runtime', "Linux 上使用的运行时。"),
							type: 'string'
						}
					}
				},
				strings: {
					description: nls.localize('vscode.extension.contributes.debuggers.strings', "此调试适配器贡献的界面文案。"),
					type: 'object',
					properties: {
						unverifiedBreakpoints: {
							description: nls.localize('vscode.extension.contributes.debuggers.strings.unverifiedBreakpoints', "当此调试适配器支持的语言中存在未经验证的断点时，此消息将显示在断点悬停时和断点视图中。支持 Markdown 和命令链接。"),
							type: 'string'
						}
					}
				}
			}
		}
	}
});

// breakpoints extension point #9037
export const breakpointsExtPoint = extensionsRegistry.ExtensionsRegistry.registerExtensionPoint<IBreakpointContribution[]>({
	extensionPoint: 'breakpoints',
	jsonSchema: {
		description: nls.localize('vscode.extension.contributes.breakpoints', "添加断点。"),
		type: 'array',
		defaultSnippets: [{ body: [{ language: '' }] }],
		items: {
			type: 'object',
			additionalProperties: false,
			defaultSnippets: [{ body: { language: '' } }],
			properties: {
				language: {
					description: nls.localize('vscode.extension.contributes.breakpoints.language', "允许为该语言设置断点。"),
					type: 'string'
				},
				when: {
					description: nls.localize('vscode.extension.contributes.breakpoints.when', "启用该语言断点的必要条件。请酌情将其与调试器的 when 子句匹配。"),
					type: 'string',
					default: ''
				}
			}
		}
	}
});

// debug general schema

export const presentationSchema: IJSONSchema = {
	type: 'object',
	description: nls.localize('presentation', "关于如何在调试配置下拉菜单和命令面板中展示该配置的显示选项。"),
	properties: {
		hidden: {
			type: 'boolean',
			default: false,
			description: nls.localize('presentation.hidden', "控制是否在配置下拉菜单和命令面板中显示该配置。")
		},
		group: {
			type: 'string',
			default: '',
			description: nls.localize('presentation.group', "该配置所属的分组。用于在配置下拉菜单和命令面板中分组和排序。")
		},
		order: {
			type: 'number',
			default: 1,
			description: nls.localize('presentation.order', "该配置在分组内的排序。用于在配置下拉菜单和命令面板中分组和排序。")
		}
	},
	default: {
		hidden: false,
		group: '',
		order: 1
	}
};
const defaultCompound: ICompound = { name: 'Compound', configurations: [] };
export const launchSchema: IJSONSchema = {
	id: launchSchemaId,
	type: 'object',
	title: nls.localize('app.launch.json.title', "启动"),
	allowTrailingCommas: true,
	allowComments: true,
	required: [],
	default: { version: '0.2.0', configurations: [], compounds: [] },
	properties: {
		version: {
			type: 'string',
			description: nls.localize('app.launch.json.version', "此文件格式的版本。"),
			default: '0.2.0'
		},
		configurations: {
			type: 'array',
			description: nls.localize('app.launch.json.configurations', "配置列表。可通过 IntelliSense 添加新配置或编辑现有配置。"),
			items: {
				defaultSnippets: [],
				'type': 'object',
				oneOf: []
			}
		},
		compounds: {
			type: 'array',
			description: nls.localize('app.launch.json.compounds', "复合配置列表。每个复合配置引用多个将一起启动的配置。"),
			items: {
				type: 'object',
				required: ['name', 'configurations'],
				properties: {
					name: {
						type: 'string',
						description: nls.localize('app.launch.json.compound.name', "复合配置名称，显示在启动配置的下拉菜单中。")
					},
					presentation: presentationSchema,
					configurations: {
						type: 'array',
						default: [],
						items: {
							oneOf: [{
								enum: [],
								description: nls.localize('useUniqueNames', "请使用唯一的配置名称。")
							}, {
								type: 'object',
								required: ['name'],
								properties: {
									name: {
										enum: [],
										description: nls.localize('app.launch.json.compound.name', "复合配置名称，显示在启动配置的下拉菜单中。")
									},
									folder: {
										enum: [],
										description: nls.localize('app.launch.json.compound.folder', "复合配置所在文件夹的名称。")
									}
								}
							}]
						},
						description: nls.localize('app.launch.json.compounds.configurations', "将作为该复合配置一部分启动的配置名称。")
					},
					stopAll: {
						type: 'boolean',
						default: false,
						description: nls.localize('app.launch.json.compound.stopAll', "控制手动终止其中一个会话是否会停止该复合配置的所有会话。")
					},
					preLaunchTask: {
						type: 'string',
						default: '',
						description: nls.localize('compoundPrelaunchTask', "复合配置中任一配置开始前要运行的任务。")
					}
				},
				default: defaultCompound
			},
			default: [
				defaultCompound
			]
		},
		inputs: inputsSchema.definitions!.inputs
	}
};

class DebuggersDataRenderer extends Disposable implements IExtensionFeatureTableRenderer {

	readonly type = 'table';

	shouldRender(manifest: IExtensionManifest): boolean {
		return !!manifest.contributes?.debuggers;
	}

	render(manifest: IExtensionManifest): IRenderedData<ITableData> {
		const contrib = manifest.contributes?.debuggers || [];
		if (!contrib.length) {
			return { data: { headers: [], rows: [] }, dispose: () => { } };
		}

		const headers = [
			nls.localize('debugger name', "名称"),
			nls.localize('debugger type', "类型"),
		];

		const rows: IRowData[][] = contrib.map(d => {
			return [
				d.label ?? '',
				d.type
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
	id: 'debuggers',
	label: nls.localize('debuggers', "调试器"),
	access: {
		canToggle: false
	},
	renderer: new SyncDescriptor(DebuggersDataRenderer),
});

