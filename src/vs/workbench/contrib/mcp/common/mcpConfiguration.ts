/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { IJSONSchema, IJSONSchemaMap } from '../../../../base/common/jsonSchema.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IExtensionManifest, IMcpCollectionContribution } from '../../../../platform/extensions/common/extensions.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { mcpSchemaId } from '../../../services/configuration/common/configuration.js';
import { inputsSchema } from '../../../services/configurationResolver/common/configurationResolverSchema.js';
import { Extensions, IExtensionFeaturesRegistry, IExtensionFeatureTableRenderer, IRenderedData, IRowData, ITableData } from '../../../services/extensionManagement/common/extensionFeatures.js';
import { IExtensionPointDescriptor } from '../../../services/extensions/common/extensionsRegistry.js';

const mcpActivationEventPrefix = 'onMcpCollection:';

/**
 * note: `contributedCollectionId` is _not_ the collection ID. The collection
 * ID is formed by passing the contributed ID through `extensionPrefixedIdentifier`
 */
export const mcpActivationEvent = (contributedCollectionId: string) =>
	mcpActivationEventPrefix + contributedCollectionId;

export const enum ExternalDiscoverySource {
	ClaudeDesktop = 'claude-desktop',
	Copilot = 'copilot',
	Windsurf = 'windsurf',
	CursorGlobal = 'cursor-global',
	CursorWorkspace = 'cursor-workspace',
}

export const allDiscoverySources = Object.keys({
	[ExternalDiscoverySource.ClaudeDesktop]: true,
	[ExternalDiscoverySource.Copilot]: true,
	[ExternalDiscoverySource.Windsurf]: true,
	[ExternalDiscoverySource.CursorGlobal]: true,
	[ExternalDiscoverySource.CursorWorkspace]: true,
} satisfies Record<ExternalDiscoverySource, true>) as ExternalDiscoverySource[];

export const discoverySourceLabel: Record<ExternalDiscoverySource, string> = {
	[ExternalDiscoverySource.ClaudeDesktop]: localize('mcp.discovery.source.claude-desktop', "Claude 桌面"),
	[ExternalDiscoverySource.Copilot]: localize('mcp.discovery.source.copilot', "GitHub Copilot CLI"),
	[ExternalDiscoverySource.Windsurf]: localize('mcp.discovery.source.windsurf', "Windsurf"),
	[ExternalDiscoverySource.CursorGlobal]: localize('mcp.discovery.source.cursor-global', "光标(全局)"),
	[ExternalDiscoverySource.CursorWorkspace]: localize('mcp.discovery.source.cursor-workspace', "光标(工作区)"),
};
export const discoverySourceSettingsLabel: Record<ExternalDiscoverySource, string> = {
	[ExternalDiscoverySource.ClaudeDesktop]: localize('mcp.discovery.source.claude-desktop.config', "Claude Desktop 配置(`claude_desktop_config.json`)"),
	[ExternalDiscoverySource.Copilot]: localize('mcp.discovery.source.copilot.config', "GitHub Copilot CLI configuration (`mcp-config.json` in `COPILOT_HOME`, or `~/.copilot/mcp-config.json` when unset)"),
	[ExternalDiscoverySource.Windsurf]: localize('mcp.discovery.source.windsurf.config', "Windsurf 配置(`~/.codeium/windsurf/mcp_config.json`)"),
	[ExternalDiscoverySource.CursorGlobal]: localize('mcp.discovery.source.cursor-global.config', "光标全局配置(`~/.cursor/mcp.json`)"),
	[ExternalDiscoverySource.CursorWorkspace]: localize('mcp.discovery.source.cursor-workspace.config', "光标工作区配置(`.cursor/mcp.json`)"),
};

export const mcpConfigurationSection = 'mcp';
export const mcpDiscoverySection = 'chat.mcp.discovery.enabled';
export const mcpWorkspaceRootConfig = 'chat.mcp.workspaceRootConfig.enabled';
export const mcpServerSamplingSection = 'chat.mcp.serverSampling';
export const mcpServerCollisionBehaviorSection = 'chat.mcp.collisionBehavior';
/**
 * Configuration key for the enterprise-managed MCP IdP bag. The setting is
 * registered with `included: false` so it is hidden from the Settings UI and
 * settings.json IntelliSense; it is intended to be delivered through enterprise
 * policy (Windows Group Policy / macOS managed preferences / Linux
 * `/etc/vscode/policy.json`), with hand-editing of `settings.json` as a
 * developer escape hatch.
 */
export const mcpEnterpriseManagedAuthIdpSection = 'mcp.enterpriseManagedAuth.idp';

/**
 * Shape of the {@link mcpEnterpriseManagedAuthIdpSection} setting. All fields
 * are optional so partial configurations (e.g. just the issuer) remain valid.
 */
export interface IMcpEnterpriseManagedAuthIdpConfig {
	readonly issuer?: string;
	readonly clientId?: string;
	readonly clientSecret?: string;
}

export const enum McpCollisionBehavior {
	Disable = 'disable',
	Suffix = 'suffix',
}

export interface IMcpServerSamplingConfiguration {
	allowedDuringChat?: boolean;
	allowedOutsideChat?: boolean;
	allowedModels?: string[];
}

export const mcpSchemaExampleServers = {
	'mcp-server-time': {
		command: 'python',
		args: ['-m', 'mcp_server_time', '--local-timezone=America/Los_Angeles'],
		env: {},
	}
};

const httpSchemaExamples = {
	'my-mcp-server': {
		url: 'http://localhost:3001/mcp',
		headers: {},
	}
};

const mcpDevModeProps = (stdio: boolean): IJSONSchemaMap => ({
	dev: {
		type: 'object',
		markdownDescription: localize('app.mcp.dev', "已为服务器启用开发模式。如果存在，服务器将立即启动，输出将包含在其输出中。“dev”对象中的属性可以配置其他行为。"),
		examples: [{ watch: 'src/**/*.ts', debug: { type: 'node' } }],
		properties: {
			watch: {
				description: localize('app.mcp.dev.watch', "与工作区文件夹相关的 glob 模式或 glob 模式列表，用于监视。当这些文件发生更改时，MCP 服务器将重新启动。"),
				examples: ['src/**/*.ts'],
				oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
			},
			...(stdio && {
				debug: {
					markdownDescription: localize('app.mcp.dev.debug', "如果已设置，则在启动时使用给定的运行时调试 MCP 服务器。"),
					oneOf: [
						{
							type: 'object',
							required: ['type'],
							properties: {
								type: {
									type: 'string',
									enum: ['node'],
									description: localize('app.mcp.dev.debug.type.node', "使用 Node.js 调试 MCP 服务器。")
								}
							},
							additionalProperties: false
						},
						{
							type: 'object',
							required: ['type'],
							properties: {
								type: {
									type: 'string',
									enum: ['debugpy'],
									description: localize('app.mcp.dev.debug.type.python', "使用 Python 和 debugpy 调试 MCP 服务器。")
								},
								debugpyPath: {
									type: 'string',
									description: localize('app.mcp.dev.debug.debugpyPath', "可执行 debugpy 的路径。")
								},
							},
							additionalProperties: false
						}
					]
				}
			})
		}
	}
});

export const mcpStdioServerSchema: IJSONSchema = {
	type: 'object',
	additionalProperties: false,
	examples: [mcpSchemaExampleServers['mcp-server-time']],
	properties: {
		type: {
			type: 'string',
			enum: ['stdio'],
			description: localize('app.mcp.json.type', "服务器的类型。")
		},
		sandboxEnabled: {
			type: 'boolean',
			default: false,
			description: localize('app.mcp.json.sandboxEnabled', "是否在沙盒环境中运行服务器。")
		},
		command: {
			type: 'string',
			description: localize('app.mcp.json.command', "用于运行服务器的命令。")
		},
		cwd: {
			type: 'string',
			description: localize('app.mcp.json.cwd', "服务器命令的工作目录。在工作区中运行时默认为工作区文件夹。"),
			examples: ['${workspaceFolder}'],
		},
		args: {
			type: 'array',
			description: localize('app.mcp.args.command', "传递给服务器的参数。"),
			items: {
				type: 'string'
			},
		},
		envFile: {
			type: 'string',
			description: localize('app.mcp.envFile.command', "包含服务器环境变量的文件的路径。"),
			examples: ['${workspaceFolder}/.env'],
		},
		env: {
			description: localize('app.mcp.env.command', "传递给服务器的环境变量。"),
			additionalProperties: {
				anyOf: [
					{ type: 'null' },
					{ type: 'string' },
					{ type: 'number' },
				]
			}
		},
		...mcpDevModeProps(true),
	}
};

export const mcpRemoteServerSchema: IJSONSchema = {
	type: 'object',
	additionalProperties: false,
	required: ['url'],
	examples: [httpSchemaExamples['my-mcp-server']],
	properties: {
		type: {
			type: 'string',
			enum: ['http', 'sse'],
			description: localize('app.mcp.json.type', "服务器的类型。")
		},
		transport: {
			type: 'string',
			enum: ['http', 'sse'],
			description: localize('app.mcp.json.transport', "The HTTP transport to preserve when sharing this configuration with other MCP clients."),
		},
		url: {
			type: 'string',
			format: 'uri',
			pattern: '^https?:\\/\\/.+',
			patternErrorMessage: localize('app.mcp.json.url.pattern', "URL 必须以“http://”或“https://”开头。"),
			description: localize('app.mcp.json.url', "可流式传输的 HTTP 或 SSE 终结点的 URL。")
		},
		headers: {
			type: 'object',
			description: localize('app.mcp.json.headers', "发送到服务器的附加标头。"),
			additionalProperties: { type: 'string' },
		},
		oauth: {
			type: 'object',
			description: localize('app.mcp.json.oauth', "用于向服务器进行身份验证的 OAuth 配置。"),
			additionalProperties: false,
			minProperties: 1,
			properties: {
				clientId: {
					type: 'string',
					minLength: 1,
					markdownDescription: localize('app.mcp.json.oauth.clientId', "向服务器进行身份验证时要使用的 OAuth 客户端 ID。当 `enterpriseManaged` 为 `true` 时，这指的是 **resource** 授权服务器的客户端 ID (受保护资源信任的客户端)，而不是 IdP 的客户端 ID。要设置匹配的客户端密码，请使用此字段上方的 *设置客户端密码* 代码信息指示器 - 将密码存储在操作系统机密存储库而不是此文件中。")
				},
				enterpriseManaged: {
					type: 'boolean',
					default: false,
					markdownDescription: localize('app.mcp.json.oauth.enterpriseManaged', "(预览)当设置为 `true` 时，此 MCP 服务器通过 `#mcp.enterpriseManagedAuth.idp#` 配置的 SSO 证书颁发者(使用 OAuth Identity Assertion Authorization Grant (ID-JAG))进行身份验证。完成一次登录后，后续企业管理的服务器将以无提示方式连接。IdP 证书颁发者和客户端凭据从 `#mcp.enterpriseManagedAuth.idp#` 设置中读取；此服务器条目上的 `clientId` 会传递给资源授权服务器。")
				}
			}
		},
		...mcpDevModeProps(false),
	}
};

export const mcpServerSchema: IJSONSchema = {
	id: mcpSchemaId,
	type: 'object',
	title: localize('app.mcp.json.title', "模型上下文协议服务器"),
	allowTrailingCommas: true,
	allowComments: true,
	additionalProperties: false,
	properties: {
		sandbox: {
			description: localize('app.mcp.json.sandbox', "用于确定文件系统和网络访问的沙盒配置。仅在 Mac 操作系统和 Linux 上在服务器级别设置 sandboxEnabled 属性时启用沙盒。"),
			type: 'object',
			additionalProperties: false,
			properties: {
				network: {
					description: localize('app.mcp.json.sandbox.network', "沙盒服务器的网络访问设置。"),
					type: 'object',
					additionalProperties: false,
					properties: {
						allowedDomains: {
							description: localize('app.mcp.json.sandbox.network.allowedDomains', "允许服务器访问的域列表。支持通配符，例如 `*.example.com`。"),
							type: 'array',
							items: { type: 'string' },
							default: []
						},
						deniedDomains: {
							description: localize('app.mcp.json.sandbox.network.deniedDomains', "不允许服务器访问的域列表，例如 `invalid.example.com`。"),
							type: 'array',
							items: { type: 'string' },
							default: []
						}
					}
				},
				filesystem: {
					description: localize('app.mcp.json.sandbox.filesystem', "沙盒服务器的文件系统访问设置。仅 Mac 操作系统支持 Glob 模式。"),
					type: 'object',
					additionalProperties: false,
					properties: {
						denyRead: {
							description: localize('app.mcp.json.sandbox.filesystem.denyRead', "不允许服务器读取的文件路径列表。默认允许读取所有文件，例如 `~/src/secrets`。"),
							type: 'array',
							items: { type: 'string' },
							default: []
						},
						allowWrite: {
							description: localize('app.mcp.json.sandbox.filesystem.allowWrite', "允许服务器写入的文件路径列表，例如 `~/src/`。"),
							type: 'array',
							items: { type: 'string' },
							default: []
						},
						denyWrite: {
							description: localize('app.mcp.json.sandbox.filesystem.denyWrite', "不允许服务器写入的文件路径列表，例如 `~/src/auth/`。"),
							type: 'array',
							items: { type: 'string' },
							default: []
						}
					}
				}
			}
		},
		servers: {
			examples: [
				mcpSchemaExampleServers,
				httpSchemaExamples,
			],
			additionalProperties: {
				oneOf: [
					mcpStdioServerSchema, mcpRemoteServerSchema,
				]
			}
		},
		inputs: inputsSchema.definitions!.inputs
	}
};

export const mcpContributionPoint: IExtensionPointDescriptor<IMcpCollectionContribution[]> = {
	extensionPoint: 'mcpServerDefinitionProviders',
	activationEventsGenerator: function* (contribs) {
		for (const contrib of contribs) {
			if (contrib.id) {
				yield mcpActivationEvent(contrib.id);
			}
		}
	},
	jsonSchema: {
		description: localize('vscode.extension.contributes.mcp', "提供模型上下文协议服务器。此项内容的用户还应使用 `vscode.lm.registerMcpServerDefinitionProvider`。"),
		type: 'array',
		defaultSnippets: [{ body: [{ id: '', label: '' }] }],
		items: {
			additionalProperties: false,
			type: 'object',
			defaultSnippets: [{ body: { id: '', label: '' } }],
			properties: {
				id: {
					description: localize('vscode.extension.contributes.mcp.id', "集合的唯一 ID。"),
					type: 'string'
				},
				label: {
					description: localize('vscode.extension.contributes.mcp.label', "集合的显示名称。"),
					type: 'string'
				},
				when: {
					description: localize('vscode.extension.contributes.mcp.when', "启用此集合时必须为 true 的条件。"),
					type: 'string'
				}
			}
		}
	}
};

class McpServerDefinitionsProviderRenderer extends Disposable implements IExtensionFeatureTableRenderer {

	readonly type = 'table';

	shouldRender(manifest: IExtensionManifest): boolean {
		return !!manifest.contributes?.mcpServerDefinitionProviders && Array.isArray(manifest.contributes.mcpServerDefinitionProviders) && manifest.contributes.mcpServerDefinitionProviders.length > 0;
	}

	render(manifest: IExtensionManifest): IRenderedData<ITableData> {
		const mcpServerDefinitionProviders = manifest.contributes?.mcpServerDefinitionProviders ?? [];
		const headers = [localize('id', "标识符"), localize('name', "名称")];
		const rows: IRowData[][] = mcpServerDefinitionProviders
			.map(mcpServerDefinitionProvider => {
				return [
					new MarkdownString().appendMarkdown(`\`${mcpServerDefinitionProvider.id}\``),
					mcpServerDefinitionProvider.label
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
	id: mcpConfigurationSection,
	label: localize('mcpServerDefinitionProviders', "MCP 服务器"),
	access: {
		canToggle: false
	},
	renderer: new SyncDescriptor(McpServerDefinitionsProviderRenderer),
});
