/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IStringDictionary } from '../../../../../base/common/collections.js';
import { localize } from '../../../../../nls.js';
import type { IConfigurationPropertySchema } from '../../../../../platform/configuration/common/configurationRegistry.js';

export const enum TerminalAccessibilitySettingId {
	AccessibleViewPreserveCursorPosition = 'terminal.integrated.accessibleViewPreserveCursorPosition',
	AccessibleViewFocusOnCommandExecution = 'terminal.integrated.accessibleViewFocusOnCommandExecution',
}

export const enum TerminalAccessibleViewPreserveCursorPosition {
	Always = 'always',
}

export interface ITerminalAccessibilityConfiguration {
	accessibleViewPreserveCursorPosition: boolean | TerminalAccessibleViewPreserveCursorPosition;
	accessibleViewFocusOnCommandExecution: number;
}

export const terminalAccessibilityConfiguration: IStringDictionary<IConfigurationPropertySchema> = {
	[TerminalAccessibilitySettingId.AccessibleViewPreserveCursorPosition]: {
		markdownDescription: localize('terminal.integrated.accessibleViewPreserveCursorPosition', "控制终端无障碍视图中是否保留光标位置。"),
		type: ['boolean', 'string'],
		enum: [false, true, TerminalAccessibleViewPreserveCursorPosition.Always],
		enumDescriptions: [
			localize('terminal.integrated.accessibleViewPreserveCursorPosition.false', "始终把光标定位在缓冲区底部。"),
			localize('terminal.integrated.accessibleViewPreserveCursorPosition.true', "重新打开时保留光标位置，直到有新的终端内容到来。"),
			localize('terminal.integrated.accessibleViewPreserveCursorPosition.always', "始终保留光标位置，包括有新的终端内容到来时。")
		],
		default: false,
	},
	[TerminalAccessibilitySettingId.AccessibleViewFocusOnCommandExecution]: {
		markdownDescription: localize('terminal.integrated.accessibleViewFocusOnCommandExecution', "执行命令时聚焦到终端无障碍视图。"),
		type: 'boolean',
		default: false
	},
};
