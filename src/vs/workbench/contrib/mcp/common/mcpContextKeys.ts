/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { Disposable } from '../../../../base/common/lifecycle.js';
import { autorun } from '../../../../base/common/observable.js';
import { localize } from '../../../../nls.js';
import { IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { bindContextKey } from '../../../../platform/observable/common/platformObservableUtils.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IMcpService, LazyCollectionState, McpConnectionState, McpServerCacheState } from './mcpTypes.js';


export namespace McpContextKeys {

	export const serverCount = new RawContextKey<number>('mcp.serverCount', undefined, { type: 'number', description: localize('mcp.serverCount.description', "具有已注册 MCP 服务器数目的上下文键") });
	export const hasUnknownTools = new RawContextKey<boolean>('mcp.hasUnknownTools', undefined, { type: 'boolean', description: localize('mcp.hasUnknownTools.description', "指示是否存在具有未知工具的 MCP 服务器。") });
	/**
	 * A context key that indicates whether there are any servers with errors.
	 *
	 * @type {boolean}
	 * @default undefined
	 * @description This key is used to track the presence of servers with errors in the MCP context.
	 */
	export const hasServersWithErrors = new RawContextKey<boolean>('mcp.hasServersWithErrors', undefined, { type: 'boolean', description: localize('mcp.hasServersWithErrors.description', "指示是否有任何 MCP 服务器存在错误。") });
	export const toolsCount = new RawContextKey<number>('mcp.toolsCount', undefined, { type: 'number', description: localize('mcp.toolsCount.description', "具有已注册 MCP 工具数目的上下文键") });
}


export class McpContextKeysController extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.mcp.contextKey';

	constructor(
		@IMcpService mcpService: IMcpService,
		@IContextKeyService contextKeyService: IContextKeyService,
	) {
		super();

		const ctxServerCount = McpContextKeys.serverCount.bindTo(contextKeyService);
		const ctxToolsCount = McpContextKeys.toolsCount.bindTo(contextKeyService);
		const ctxHasUnknownTools = McpContextKeys.hasUnknownTools.bindTo(contextKeyService);

		this._store.add(bindContextKey(McpContextKeys.hasServersWithErrors, contextKeyService, r => mcpService.servers.read(r).some(c => c.connectionState.read(r).state === McpConnectionState.Kind.Error)));

		this._store.add(autorun(r => {
			const servers = mcpService.servers.read(r);
			const serverTools = servers.map(s => s.tools.read(r));
			ctxServerCount.set(servers.length);
			ctxToolsCount.set(serverTools.reduce((count, tools) => count + tools.length, 0));
			ctxHasUnknownTools.set(mcpService.lazyCollectionState.read(r).state !== LazyCollectionState.AllKnown || servers.some(s => {
				const toolState = s.cacheState.read(r);
				return toolState === McpServerCacheState.Unknown || toolState === McpServerCacheState.Outdated || toolState === McpServerCacheState.RefreshingFromUnknown;
			}));
		}));
	}
}
