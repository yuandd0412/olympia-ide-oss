/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../nls.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { IJSONSchema } from '../../../../base/common/jsonSchema.js';
import Severity from '../../../../base/common/severity.js';
import { EXTENSION_IDENTIFIER_PATTERN } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { Extensions, IJSONContributionRegistry } from '../../../../platform/jsonschemas/common/jsonContributionRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IMessage } from './extensions.js';
import { IExtensionDescription, EXTENSION_CATEGORIES, ExtensionIdentifierSet } from '../../../../platform/extensions/common/extensions.js';
import { ExtensionKind } from '../../../../platform/environment/common/environment.js';
import { productSchemaId } from '../../../../platform/product/common/productService.js';
import { ImplicitActivationEvents, IActivationEventsGenerator } from '../../../../platform/extensionManagement/common/implicitActivationEvents.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { allApiProposals } from '../../../../platform/extensions/common/extensionsApiProposals.js';

const schemaRegistry = Registry.as<IJSONContributionRegistry>(Extensions.JSONContribution);

export class ExtensionMessageCollector {

	private readonly _messageHandler: (msg: IMessage) => void;
	private readonly _extension: IExtensionDescription;
	private readonly _extensionPointId: string;

	constructor(
		messageHandler: (msg: IMessage) => void,
		extension: IExtensionDescription,
		extensionPointId: string
	) {
		this._messageHandler = messageHandler;
		this._extension = extension;
		this._extensionPointId = extensionPointId;
	}

	private _msg(type: Severity, message: string): void {
		this._messageHandler({
			type: type,
			message: message,
			extensionId: this._extension.identifier,
			extensionPointId: this._extensionPointId
		});
	}

	public error(message: string): void {
		this._msg(Severity.Error, message);
	}

	public warn(message: string): void {
		this._msg(Severity.Warning, message);
	}

	public info(message: string): void {
		this._msg(Severity.Info, message);
	}
}

export interface IExtensionPointUser<T> {
	description: IExtensionDescription;
	value: T;
	collector: ExtensionMessageCollector;
}

export type IExtensionPointHandler<T> = (extensions: readonly IExtensionPointUser<T>[], delta: ExtensionPointUserDelta<T>) => void;

export interface IExtensionPoint<T> {
	readonly name: string;
	setHandler(handler: IExtensionPointHandler<T>): IDisposable;
	readonly defaultExtensionKind: ExtensionKind[] | undefined;
	readonly canHandleResolver?: boolean;
}

export class ExtensionPointUserDelta<T> {

	private static _toSet<T>(arr: readonly IExtensionPointUser<T>[]): ExtensionIdentifierSet {
		const result = new ExtensionIdentifierSet();
		for (let i = 0, len = arr.length; i < len; i++) {
			result.add(arr[i].description.identifier);
		}
		return result;
	}

	public static compute<T>(previous: readonly IExtensionPointUser<T>[] | null, current: readonly IExtensionPointUser<T>[]): ExtensionPointUserDelta<T> {
		if (!previous || !previous.length) {
			return new ExtensionPointUserDelta<T>(current, []);
		}
		if (!current || !current.length) {
			return new ExtensionPointUserDelta<T>([], previous);
		}

		const previousSet = this._toSet(previous);
		const currentSet = this._toSet(current);

		const added = current.filter(user => !previousSet.has(user.description.identifier));
		const removed = previous.filter(user => !currentSet.has(user.description.identifier));

		return new ExtensionPointUserDelta<T>(added, removed);
	}

	constructor(
		public readonly added: readonly IExtensionPointUser<T>[],
		public readonly removed: readonly IExtensionPointUser<T>[],
	) { }
}

export class ExtensionPoint<T> implements IExtensionPoint<T> {

	public readonly name: string;
	public readonly defaultExtensionKind: ExtensionKind[] | undefined;
	public readonly canHandleResolver?: boolean;

	private _handler: IExtensionPointHandler<T> | null;
	private _users: IExtensionPointUser<T>[] | null;
	private _delta: ExtensionPointUserDelta<T> | null;

	constructor(name: string, defaultExtensionKind: ExtensionKind[] | undefined, canHandleResolver?: boolean) {
		this.name = name;
		this.defaultExtensionKind = defaultExtensionKind;
		this.canHandleResolver = canHandleResolver;
		this._handler = null;
		this._users = null;
		this._delta = null;
	}

	setHandler(handler: IExtensionPointHandler<T>): IDisposable {
		if (this._handler !== null) {
			throw new Error('Handler already set!');
		}
		this._handler = handler;
		this._handle();

		return {
			dispose: () => {
				this._handler = null;
			}
		};
	}

	acceptUsers(users: IExtensionPointUser<T>[]): void {
		this._delta = ExtensionPointUserDelta.compute(this._users, users);
		this._users = users;
		this._handle();
	}

	private _handle(): void {
		if (this._handler === null || this._users === null || this._delta === null) {
			return;
		}

		try {
			this._handler(this._users, this._delta);
		} catch (err) {
			onUnexpectedError(err);
		}
	}
}

const extensionKindSchema: IJSONSchema = {
	type: 'string',
	enum: [
		'ui',
		'workspace'
	],
	enumDescriptions: [
		nls.localize('ui', "界面扩展类型。在远程窗口中，此类扩展仅在本地计算机上可用时才会启用。"),
		nls.localize('workspace', "工作区扩展类型。在远程窗口中，此类扩展仅在远程可用时才会启用。"),
	],
};

const schemaId = 'vscode://schemas/vscode-extensions';
export const schema: IJSONSchema = {
	properties: {
		engines: {
			type: 'object',
			description: nls.localize('vscode.extension.engines', "引擎兼容性。"),
			properties: {
				'vscode': {
					type: 'string',
					description: nls.localize('vscode.extension.engines.vscode', "对于 Olympia 扩展，指定与其兼容的 Olympia 版本。不能为 *。例如: ^1.105.0 表示最低兼容 Olympia 版本 1.105.0。"),
					default: '^1.105.0',
				}
			}
		},
		publisher: {
			description: nls.localize('vscode.extension.publisher', "Olympia IDE 扩展的发布者。"),
			type: 'string'
		},
		displayName: {
			description: nls.localize('vscode.extension.displayName', "该扩展在 Olympia IDE 扩展库中显示时使用的名称。"),
			type: 'string'
		},
		categories: {
			description: nls.localize('vscode.extension.categories', "Olympia IDE 扩展库用于对该扩展进行分类的类别。"),
			type: 'array',
			uniqueItems: true,
			items: {
				oneOf: [{
					type: 'string',
					enum: EXTENSION_CATEGORIES,
				},
				{
					type: 'string',
					const: 'Languages',
					deprecationMessage: nls.localize('vscode.extension.category.languages.deprecated', "请改用 Programming Languages"),
				}]
			}
		},
		galleryBanner: {
			type: 'object',
			description: nls.localize('vscode.extension.galleryBanner', "Olympia IDE 扩展市场中使用的横幅。"),
			properties: {
				color: {
					description: nls.localize('vscode.extension.galleryBanner.color', "Olympia IDE 扩展市场页面标头处的横幅颜色。"),
					type: 'string'
				},
				theme: {
					description: nls.localize('vscode.extension.galleryBanner.theme', "横幅中所用字体的配色主题。"),
					type: 'string',
					enum: ['dark', 'light']
				}
			}
		},
		contributes: {
			description: nls.localize('vscode.extension.contributes', "此程序包所代表的 Olympia IDE 扩展的全部贡献点。"),
			type: 'object',
			// eslint-disable-next-line local/code-no-any-casts
			properties: {
				// extensions will fill in
			} as any as { [key: string]: any },
			default: {}
		},
		preview: {
			type: 'boolean',
			description: nls.localize('vscode.extension.preview', "将该扩展标记为扩展市场中的预览版。"),
		},
		enableProposedApi: {
			type: 'boolean',
			deprecationMessage: nls.localize('vscode.extension.enableProposedApi.deprecated', "请改用 `enabledApiProposals`。"),
		},
		enabledApiProposals: {
			markdownDescription: nls.localize('vscode.extension.enabledApiProposals', "启用 API 建议以试用它们。仅在 **开发期间有效**。**无法使用此属性发布** 扩展。有关更多详细信息，请访问: https://code.visualstudio.com/api/advanced-topics/using-proposed-api"),
			type: 'array',
			uniqueItems: true,
			items: {
				type: 'string',
				enum: Object.keys(allApiProposals).map(proposalName => proposalName),
				markdownEnumDescriptions: Object.values(allApiProposals).map(value => value.proposal)
			}
		},
		api: {
			markdownDescription: nls.localize('vscode.extension.api', "描述此扩展提供的 API。更多内容请访问：https://code.visualstudio.com/api/advanced-topics/remote-extensions#handling-dependencies-with-remote-extensions。"),
			type: 'string',
			enum: ['none'],
			enumDescriptions: [
				nls.localize('vscode.extension.api.none', "完全放弃导出任何 API 的能力。这样一来，依赖此扩展的其他扩展可以在独立的扩展宿主进程或远程计算机中运行。")
			]
		},
		activationEvents: {
			description: nls.localize('vscode.extension.activationEvents', "Olympia IDE 扩展的激活事件。"),
			type: 'array',
			items: {
				type: 'string',
				defaultSnippets: [
					{
						label: 'onWebviewPanel',
						description: nls.localize('vscode.extension.activationEvents.onWebviewPanel', "加载某个 viewType 的网页视图时发出的激活事件"),
						body: 'onWebviewPanel:viewType'
					},
					{
						label: 'onLanguage',
						description: nls.localize('vscode.extension.activationEvents.onLanguage', "每次打开解析为指定语言的文件时发出的激活事件。"),
						body: 'onLanguage:${1:languageId}'
					},
					{
						label: 'onCommand',
						description: nls.localize('vscode.extension.activationEvents.onCommand', "每次调用指定命令时发出的激活事件。"),
						body: 'onCommand:${2:commandId}'
					},
					{
						label: 'onDebug',
						description: nls.localize('vscode.extension.activationEvents.onDebug', "当用户即将开始调试或即将配置调试配置时发出的激活事件。"),
						body: 'onDebug'
					},
					{
						label: 'onDebugInitialConfigurations',
						description: nls.localize('vscode.extension.activationEvents.onDebugInitialConfigurations', "每次需要创建 launch.json（并调用所有 provideDebugConfigurations 方法）时发出的激活事件。"),
						body: 'onDebugInitialConfigurations'
					},
					{
						label: 'onDebugDynamicConfigurations',
						description: nls.localize('vscode.extension.activationEvents.onDebugDynamicConfigurations', "每次需要创建所有调试配置的列表（并调用 dynamic 作用域的所有 provideDebugConfigurations 方法）时发出的激活事件。"),
						body: 'onDebugDynamicConfigurations'
					},
					{
						label: 'onDebugResolve',
						description: nls.localize('vscode.extension.activationEvents.onDebugResolve', "每次即将启动特定类型的调试会话（并需要调用相应的 resolveDebugConfiguration 方法）时发出的激活事件。"),
						body: 'onDebugResolve:${6:type}'
					},
					{
						label: 'onDebugAdapterProtocolTracker',
						description: nls.localize('vscode.extension.activationEvents.onDebugAdapterProtocolTracker', "每次即将启动特定类型的调试会话且可能需要调试协议跟踪器时发出的激活事件。"),
						body: 'onDebugAdapterProtocolTracker:${6:type}'
					},
					{
						label: 'workspaceContains',
						description: nls.localize('vscode.extension.activationEvents.workspaceContains', "每次打开包含至少一个匹配指定 glob 模式文件的文件夹时发出的激活事件。"),
						body: 'workspaceContains:${4:filePattern}'
					},
					{
						label: 'onStartupFinished',
						description: nls.localize('vscode.extension.activationEvents.onStartupFinished', "启动完成后（在所有以 `*` 激活的扩展都完成激活之后）发出的激活事件。"),
						body: 'onStartupFinished'
					},
					{
						label: 'onTaskType',
						description: nls.localize('vscode.extension.activationEvents.onTaskType', "每次需要列出或解析某种类型的任务时发出的激活事件。"),
						body: 'onTaskType:${1:taskType}'
					},
					{
						label: 'onFileSystem',
						description: nls.localize('vscode.extension.activationEvents.onFileSystem', "每次使用给定方案访问文件或文件夹时发出的激活事件。"),
						body: 'onFileSystem:${1:scheme}'
					},
					{
						label: 'onEditSession',
						description: nls.localize('vscode.extension.activationEvents.onEditSession', "每次使用给定方案访问编辑会话时发出的激活事件。"),
						body: 'onEditSession:${1:scheme}'
					},
					{
						label: 'onSearch',
						description: nls.localize('vscode.extension.activationEvents.onSearch', "每次在使用给定方案的文件夹中开始搜索时发出的激活事件。"),
						body: 'onSearch:${7:scheme}'
					},
					{
						label: 'onView',
						body: 'onView:${5:viewId}',
						description: nls.localize('vscode.extension.activationEvents.onView', "每次展开指定视图时发出的激活事件。"),
					},
					{
						label: 'onUri',
						body: 'onUri',
						description: nls.localize('vscode.extension.activationEvents.onUri', "每次打开指向此扩展的系统级 Uri 时发出的激活事件。"),
					},
					{
						label: 'onOpenExternalUri',
						body: 'onOpenExternalUri',
						description: nls.localize('vscode.extension.activationEvents.onOpenExternalUri', "每次打开外部 uri（例如 http 或 https 链接）时发出的激活事件。"),
					},
					{
						label: 'onCustomEditor',
						body: 'onCustomEditor:${9:viewType}',
						description: nls.localize('vscode.extension.activationEvents.onCustomEditor', "每次指定的自定义编辑器变为可见时发出的激活事件。"),
					},
					{
						label: 'onNotebook',
						body: 'onNotebook:${1:type}',
						description: nls.localize('vscode.extension.activationEvents.onNotebook', "每次打开指定的笔记本文档时发出的激活事件。"),
					},
					{
						label: 'onAuthenticationRequest',
						body: 'onAuthenticationRequest:${11:authenticationProviderId}',
						description: nls.localize('vscode.extension.activationEvents.onAuthenticationRequest', "每次从指定的身份验证提供程序请求会话时发出的激活事件。")
					},
					{
						label: 'onRenderer',
						description: nls.localize('vscode.extension.activationEvents.onRenderer', "每次使用笔记本输出呈现器时发出的激活事件。"),
						body: 'onRenderer:${11:rendererId}'
					},
					{
						label: 'onTerminalProfile',
						body: 'onTerminalProfile:${1:terminalId}',
						description: nls.localize('vscode.extension.activationEvents.onTerminalProfile', "启动特定终端配置文件时发出的激活事件。"),
					},
					{
						label: 'onTerminalQuickFixRequest',
						body: 'onTerminalQuickFixRequest:${1:quickFixId}',
						description: nls.localize('vscode.extension.activationEvents.onTerminalQuickFixRequest', "当某条命令与此 ID 关联的选择器匹配时发出的激活事件"),
					},
					{
						label: 'onWalkthrough',
						body: 'onWalkthrough:${1:walkthroughID}',
						description: nls.localize('vscode.extension.activationEvents.onWalkthrough', "打开指定演练流程时发出的激活事件。"),
					},
					{
						label: 'onIssueReporterOpened',
						body: 'onIssueReporterOpened',
						description: nls.localize('vscode.extension.activationEvents.onIssueReporterOpened', "打开问题反馈界面时发出的激活事件。"),
					},
					{
						label: 'onChatParticipant',
						body: 'onChatParticipant:${1:participantId}',
						description: nls.localize('vscode.extension.activationEvents.onChatParticipant', "调用指定聊天参与者时发出的激活事件。"),
					},
					{
						label: 'onChatContextProvider',
						body: 'onChatContextProvider:${1:contextProviderId}',
						description: nls.localize('vscode.extension.activationEvents.onChatContextProvider', "调用指定聊天上下文提供程序时发出的激活事件。"),
					},
					{
						label: 'onLanguageModelChatProvider',
						body: 'onLanguageModelChatProvider:${1:vendor}',
						description: nls.localize('vscode.extension.activationEvents.onLanguageModelChatProvider', "请求给定厂商的聊天模型提供程序时发出的激活事件。"),
					},
					{
						label: 'onLanguageModelTool',
						body: 'onLanguageModelTool:${1:toolId}',
						description: nls.localize('vscode.extension.activationEvents.onLanguageModelTool', "调用指定语言模型工具时发出的激活事件。"),
					},
					{
						label: 'onTerminal',
						body: 'onTerminal:{1:shellType}',
						description: nls.localize('vscode.extension.activationEvents.onTerminal', "打开给定 shell 类型的终端时发出的激活事件。"),
					},
					{
						label: 'onTerminalShellIntegration',
						body: 'onTerminalShellIntegration:${1:shellType}',
						description: nls.localize('vscode.extension.activationEvents.onTerminalShellIntegration', "为给定 shell 类型启用终端 shell 集成时发出的激活事件。"),
					},
					{
						label: 'onMcpCollection',
						description: nls.localize('vscode.extension.activationEvents.onMcpCollection', "每次请求 MCP 服务器中的某个工具时发出的激活事件。"),
						body: 'onMcpCollection:${2:collectionId}',
					},
					{
						label: '*',
						description: nls.localize('vscode.extension.activationEvents.star', "在 Olympia 启动时发出的激活事件。为确保良好的最终用户体验，请仅在其他激活事件组合不适用于你的情况时，才在扩展中使用此事件。"),
						body: '*'
					}
				],
			}
		},
		badges: {
			type: 'array',
			description: nls.localize('vscode.extension.badges', "要在扩展市场扩展页面的侧边栏中显示的徽标数组。"),
			items: {
				type: 'object',
				required: ['url', 'href', 'description'],
				properties: {
					url: {
						type: 'string',
						description: nls.localize('vscode.extension.badges.url', "徽标图片 URL。")
					},
					href: {
						type: 'string',
						description: nls.localize('vscode.extension.badges.href', "徽标链接。")
					},
					description: {
						type: 'string',
						description: nls.localize('vscode.extension.badges.description', "徽标说明。")
					}
				}
			}
		},
		markdown: {
			type: 'string',
			description: nls.localize('vscode.extension.markdown', "控制扩展市场中使用的 Markdown 渲染引擎。可取 github（默认）或 standard。"),
			enum: ['github', 'standard'],
			default: 'github'
		},
		qna: {
			default: 'marketplace',
			description: nls.localize('vscode.extension.qna', "控制市场中的“问与答”(Q&A)链接。设置为 \"marketplace\" 可启用市场的默认“问与答”页面。设置为其他字符串可指向自定义的“问与答”页面。设置为 \"false\" 可完全禁用“问与答”。"),
			anyOf: [
				{
					type: ['string', 'boolean'],
					enum: ['marketplace', false]
				},
				{
					type: 'string'
				}
			]
		},
		extensionDependencies: {
			description: nls.localize('vscode.extension.extensionDependencies', "对其他扩展的依赖。扩展的标识符始终为 ${publisher}.${name}，例如 vscode.csharp。"),
			type: 'array',
			uniqueItems: true,
			items: {
				type: 'string',
				pattern: EXTENSION_IDENTIFIER_PATTERN
			}
		},
		extensionAffinity: {
			description: nls.localize('vscode.extension.extensionAffinity', "如果可能，此扩展应与之共用同一扩展宿主进程的其他扩展。扩展的标识符始终为 ${publisher}.${name}，例如 vscode.git。"),
			type: 'array',
			uniqueItems: true,
			items: {
				type: 'string',
				pattern: EXTENSION_IDENTIFIER_PATTERN
			}
		},
		extensionPack: {
			description: nls.localize('vscode.extension.contributes.extensionPack', "可以一起安装的一组扩展。扩展的标识符始终为 ${publisher}.${name}，例如 vscode.csharp。"),
			type: 'array',
			uniqueItems: true,
			items: {
				type: 'string',
				pattern: EXTENSION_IDENTIFIER_PATTERN
			}
		},
		extensionKind: {
			description: nls.localize('extensionKind', "定义扩展的类型。其中 `ui` 扩展安装并在本地计算机上运行，而 `workspace` 扩展在远程运行。"),
			type: 'array',
			items: extensionKindSchema,
			default: ['workspace'],
			defaultSnippets: [
				{
					body: ['ui'],
					description: nls.localize('extensionKind.ui', "定义一种扩展，连接到远程窗口时只能在本地计算机上运行。")
				},
				{
					body: ['workspace'],
					description: nls.localize('extensionKind.workspace', "定义一种扩展，连接到远程窗口时只能在远程计算机上运行。")
				},
				{
					body: ['ui', 'workspace'],
					description: nls.localize('extensionKind.ui-workspace', "定义一种可在任一侧运行的扩展，但优先在本地计算机上运行。")
				},
				{
					body: ['workspace', 'ui'],
					description: nls.localize('extensionKind.workspace-ui', "定义一种可在任一侧运行的扩展，但优先在远程计算机上运行。")
				},
				{
					body: [],
					description: nls.localize('extensionKind.empty', "定义一种无法在远程上下文中运行的扩展，既不能在本地计算机上运行，也不能在远程计算机上运行。")
				}
			]
		},
		capabilities: {
			description: nls.localize('vscode.extension.capabilities', "声明该扩展支持的能力集合。"),
			type: 'object',
			properties: {
				virtualWorkspaces: {
					description: nls.localize('vscode.extension.capabilities.virtualWorkspaces', "声明是否应在虚拟工作区中启用扩展。虚拟工作区是一个不受任何磁盘资源支持的工作区。当为 false 时，会在虚拟工作区中自动禁用此扩展。默认值为 true。"),
					type: ['boolean', 'object'],
					defaultSnippets: [
						{ label: 'limited', body: { supported: '${1:limited}', description: '${2}' } },
						{ label: 'false', body: { supported: false, description: '${2}' } },
					],
					default: true.valueOf,
					properties: {
						supported: {
							markdownDescription: nls.localize('vscode.extension.capabilities.virtualWorkspaces.supported', "声明该扩展对虚拟工作区的支持程度。"),
							type: ['string', 'boolean'],
							enum: ['limited', true, false],
							enumDescriptions: [
								nls.localize('vscode.extension.capabilities.virtualWorkspaces.supported.limited', "该扩展将在虚拟工作区中启用，但部分功能会被禁用。"),
								nls.localize('vscode.extension.capabilities.virtualWorkspaces.supported.true', "该扩展将在虚拟工作区中启用，全部功能均可用。"),
								nls.localize('vscode.extension.capabilities.virtualWorkspaces.supported.false', "该扩展不会在虚拟工作区中启用。"),
							]
						},
						description: {
							type: 'string',
							markdownDescription: nls.localize('vscode.extension.capabilities.virtualWorkspaces.description', "描述虚拟工作区如何影响扩展的行为，以及为何需要此设置。仅当 `supported` 不为 `true` 时适用。"),
						}
					}
				},
				untrustedWorkspaces: {
					description: nls.localize('vscode.extension.capabilities.untrustedWorkspaces', "声明该扩展在不受信任的工作区中应如何处理。"),
					type: 'object',
					required: ['supported'],
					defaultSnippets: [
						{ body: { supported: '${1:limited}', description: '${2}' } },
					],
					properties: {
						supported: {
							markdownDescription: nls.localize('vscode.extension.capabilities.untrustedWorkspaces.supported', "声明该扩展对不受信任工作区的支持程度。"),
							type: ['string', 'boolean'],
							enum: ['limited', true, false],
							enumDescriptions: [
								nls.localize('vscode.extension.capabilities.untrustedWorkspaces.supported.limited', "该扩展将在不受信任的工作区中启用，但部分功能会被禁用。"),
								nls.localize('vscode.extension.capabilities.untrustedWorkspaces.supported.true', "该扩展将在不受信任的工作区中启用，全部功能均可用。"),
								nls.localize('vscode.extension.capabilities.untrustedWorkspaces.supported.false', "该扩展不会在不受信任的工作区中启用。"),
							]
						},
						restrictedConfigurations: {
							description: nls.localize('vscode.extension.capabilities.untrustedWorkspaces.restrictedConfigurations', "该扩展贡献的配置键列表，在不受信任的工作区中不应使用工作区值。"),
							type: 'array',
							items: {
								type: 'string'
							}
						},
						description: {
							type: 'string',
							markdownDescription: nls.localize('vscode.extension.capabilities.untrustedWorkspaces.description', "描述工作区信任如何影响扩展的行为，以及为何需要此设置。仅当 `supported` 不为 `true` 时适用。"),
						}
					}
				},
				agentsWindow: {
					description: nls.localize('vscode.extension.capabilities.agentsWindow', "声明该扩展是否应在智能体窗口中启用。需要 `agentsWindowActivation` API 提议以及实验性的智能体窗口功能开关。"),
					type: 'object',
					required: ['supported'],
					defaultSnippets: [
						{ body: { supported: true } },
					],
					properties: {
						supported: {
							markdownDescription: nls.localize('vscode.extension.capabilities.agentsWindow.supported', "Declares whether the extension supports running in the Agents window. The extension must enable the `agentsWindowActivation` API proposal and the `extensions.experimental.enableAgentsWindowCapability` setting for this property to take effect."),
							type: 'boolean'
						}
					}
				}
			}
		},
		sponsor: {
			description: nls.localize('vscode.extension.contributes.sponsor', "指定用户可以赞助此扩展的网址。"),
			type: 'object',
			defaultSnippets: [
				{ body: { url: '${1:https:}' } },
			],
			properties: {
				'url': {
					description: nls.localize('vscode.extension.contributes.sponsor.url', "用户可以赞助此扩展的网址。它必须是使用 HTTP 或 HTTPS 协议的合法网址。示例值：https://github.com/sponsors/nvaccess。"),
					type: 'string',
				}
			}
		},
		scripts: {
			type: 'object',
			properties: {
				'vscode:prepublish': {
					description: nls.localize('vscode.extension.scripts.prepublish', "在将此程序包作为 Olympia IDE 扩展发布之前执行的脚本。"),
					type: 'string'
				},
				'vscode:uninstall': {
					description: nls.localize('vscode.extension.scripts.uninstall', "Olympia 扩展的卸载钩子。在扩展从 Olympia 卸载且 Olympia 重启 (关闭后开启) 后执行的脚本。仅支持 Node 脚本。"),
					type: 'string'
				}
			}
		},
		icon: {
			type: 'string',
			description: nls.localize('vscode.extension.icon', "指向 128x128 像素图标的路径。")
		},
		l10n: {
			type: 'string',
			description: nls.localize({
				key: 'vscode.extension.l10n',
				comment: [
					'{Locked="bundle.l10n._locale_.json"}',
					'{Locked="vscode.l10n API"}'
				]
			}, "指向包含本地化文件（bundle.l10n.*.json）的文件夹的相对路径。如果使用 vscode.l10n API，则必须指定。")
		},
		pricing: {
			type: 'string',
			markdownDescription: nls.localize('vscode.extension.pricing', "扩展的定价信息。可以是免费 (默认) 或试用版。有关详细信息，请访问: https://code.visualstudio.com/api/working-with-extensions/publishing-extension#extension-pricing-label"),
			enum: ['Free', 'Trial'],
			default: 'Free'
		}
	}
};

export type removeArray<T> = T extends Array<infer X> ? X : T;

export interface IExtensionPointDescriptor<T> {
	extensionPoint: string;
	deps?: IExtensionPoint<unknown>[];
	jsonSchema: IJSONSchema;
	defaultExtensionKind?: ExtensionKind[];
	canHandleResolver?: boolean;
	/**
	 * A function which runs before the extension point has been validated and which
	 * should collect automatic activation events from the contribution.
	 */
	activationEventsGenerator?: IActivationEventsGenerator<removeArray<T>>;
}

export class ExtensionsRegistryImpl {

	private readonly _extensionPoints = new Map<string, ExtensionPoint<any>>();

	public registerExtensionPoint<T>(desc: IExtensionPointDescriptor<T>): IExtensionPoint<T> {
		if (this._extensionPoints.has(desc.extensionPoint)) {
			throw new Error('Duplicate extension point: ' + desc.extensionPoint);
		}
		const result = new ExtensionPoint<T>(desc.extensionPoint, desc.defaultExtensionKind, desc.canHandleResolver);
		this._extensionPoints.set(desc.extensionPoint, result);
		if (desc.activationEventsGenerator) {
			ImplicitActivationEvents.register(desc.extensionPoint, desc.activationEventsGenerator);
		}

		schema.properties!['contributes'].properties![desc.extensionPoint] = desc.jsonSchema;
		schemaRegistry.registerSchema(schemaId, schema);

		return result;
	}

	public getExtensionPoints(): ExtensionPoint<unknown>[] {
		return Array.from(this._extensionPoints.values());
	}
}

const PRExtensions = {
	ExtensionsRegistry: 'ExtensionsRegistry'
};
Registry.add(PRExtensions.ExtensionsRegistry, new ExtensionsRegistryImpl());
export const ExtensionsRegistry: ExtensionsRegistryImpl = Registry.as(PRExtensions.ExtensionsRegistry);

schemaRegistry.registerSchema(schemaId, schema);


schemaRegistry.registerSchema(productSchemaId, {
	properties: {
		extensionEnabledApiProposals: {
			description: nls.localize('product.extensionEnabledApiProposals', "相应扩展可以自由使用的 API 提议。"),
			type: 'object',
			properties: {},
			additionalProperties: {
				anyOf: [{
					type: 'array',
					uniqueItems: true,
					items: {
						type: 'string',
						enum: Object.keys(allApiProposals),
						markdownEnumDescriptions: Object.values(allApiProposals).map(value => value.proposal)
					}
				}]
			}
		}
	}
});
