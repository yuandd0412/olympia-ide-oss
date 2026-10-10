/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IStringDictionary } from '../../../../../base/common/collections.js';
import { localize } from '../../../../../nls.js';
import type { IConfigurationPropertySchema } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { TerminalSettingId } from '../../../../../platform/terminal/common/terminal.js';

export const enum TerminalStickyScrollSettingId {
	Enabled = 'terminal.integrated.stickyScroll.enabled',
	MaxLineCount = 'terminal.integrated.stickyScroll.maxLineCount',
	IgnoredCommands = 'terminal.integrated.stickyScroll.ignoredCommands',
}

export interface ITerminalStickyScrollConfiguration {
	enabled: boolean;
	maxLineCount: number;
	ignoredCommands: string[];
}

export const terminalStickyScrollConfiguration: IStringDictionary<IConfigurationPropertySchema> = {
	[TerminalStickyScrollSettingId.Enabled]: {
		markdownDescription: localize('stickyScroll.enabled', "在终端顶部显示当前命令。此功能需要激活 [shell 集成]({0})。参见 {1}。", 'https://code.visualstudio.com/docs/terminal/shell-integration', `\`#${TerminalSettingId.ShellIntegrationEnabled}#\``),
		type: 'boolean',
		default: true
	},
	[TerminalStickyScrollSettingId.MaxLineCount]: {
		markdownDescription: localize('stickyScroll.maxLineCount', "定义最多显示多少条粘滞行。无论此设置如何，粘滞滚动行都不会超过视口的 40%。"),
		type: 'number',
		default: 5,
		minimum: 1,
		maximum: 10
	},
	[TerminalStickyScrollSettingId.IgnoredCommands]: {
		markdownDescription: localize('stickyScroll.ignoredCommands', "不应触发粘滞滚动的命令列表。检测到列表中的命令时，粘滞滚动浮层会被隐藏。"),
		type: 'array',
		items: {
			type: 'string'
		},
		default: [
			'clear',
			'cls',
			'clear-host',
			'agent',
			'agy',
			'copilot',
			'claude',
			'codex',
			'gemini'
		]
	},
};
