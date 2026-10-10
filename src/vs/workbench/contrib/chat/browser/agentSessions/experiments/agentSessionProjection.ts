/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../../../nls.js';
import { RawContextKey } from '../../../../../../platform/contextkey/common/contextkey.js';

export const inAgentSessionProjection = new RawContextKey<boolean>('chatInAgentSessionProjection', false, { type: 'boolean', description: localize('chatInAgentSessionProjection', "如果 workbench 处于用于查看智能体会话的智能体会话投影模式，则为 True。") });
