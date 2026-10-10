/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IStringDictionary } from '../../../../../base/common/collections.js';
import { localize } from '../../../../../nls.js';
import type { IConfigurationPropertySchema } from '../../../../../platform/configuration/common/configurationRegistry.js';

export const enum TerminalResizeDimensionsOverlaySettingId {
	Enabled = 'terminal.integrated.resizeDimensionsOverlay.enabled',
}

export const terminalResizeDimensionsOverlayConfiguration: IStringDictionary<IConfigurationPropertySchema> = {
	[TerminalResizeDimensionsOverlaySettingId.Enabled]: {
		markdownDescription: localize('resizeDimensionsOverlay.enabled', "控制调整终端大小时是否显示行列信息的可视浮层。"),
		type: 'boolean',
		default: true
	},
};
