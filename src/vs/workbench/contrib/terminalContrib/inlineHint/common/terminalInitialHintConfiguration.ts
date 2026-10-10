/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStringDictionary } from '../../../../../base/common/collections.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationPropertySchema } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { TerminalSettingId } from '../../../../../platform/terminal/common/terminal.js';

export const enum TerminalInitialHintSettingId {
	Enabled = 'terminal.integrated.initialHint',
}

export const terminalInitialHintConfiguration: IStringDictionary<IConfigurationPropertySchema> = {
	[TerminalInitialHintSettingId.Enabled]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.initialHint', "控制第一个无输入的终端在获得焦点时是否显示可用操作提示。仅当 {0} 已禁用时才会显示。", `\`#${TerminalSettingId.SendKeybindingsToShell}#\``),
		type: 'boolean',
		default: true,
		agentsWindow: { default: false },
	},
};
