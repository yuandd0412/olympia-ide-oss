/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { localize } from '../../../../nls.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';

export const mcpServerIcon = registerIcon('mcp-server', Codicon.mcp, localize('mcpServer', "用于 MCP 服务器的图标。"));
export const mcpServerRemoteIcon = registerIcon('mcp-server-remote', Codicon.remote, localize('mcpServerRemoteIcon', "指示 MCP 服务器适用于远程用户范围的图标。"));
export const mcpServerWorkspaceIcon = registerIcon('mcp-server-workspace', Codicon.rootFolder, localize('mcpServerWorkspaceIcon', "指示 MCP 服务器适用于工作区范围的图标。"));
export const mcpStarredIcon = registerIcon('mcp-server-starred', Codicon.starFull, localize('starredIcon', "随星标状态一起显示的图标。"));
export const mcpLicenseIcon = registerIcon('mcp-server-license', Codicon.law, localize('licenseIcon', "随许可证状态一起显示的图标。"));
