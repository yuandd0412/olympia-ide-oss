/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { KeyCode, KeyMod } from '../../../../../base/common/keyCodes.js';
import { localize2 } from '../../../../../nls.js';
import { AccessibleViewProviderId } from '../../../../../platform/accessibility/browser/accessibleView.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { KeybindingWeight } from '../../../../../platform/keybinding/common/keybindingsRegistry.js';
import { accessibleViewCurrentProviderId, accessibleViewIsShown } from '../../../accessibility/browser/accessibilityConfiguration.js';
import { registerActiveInstanceAction } from '../../../terminal/browser/terminalActions.js';
import { registerTerminalContribution } from '../../../terminal/browser/terminalExtensions.js';
import { TerminalContextKeys } from '../../../terminal/common/terminalContextKey.js';
import { terminalStrings } from '../../../terminal/common/terminalStrings.js';
import { TerminalLinksCommandId } from '../common/terminal.links.js';
import { ITerminalLinkProviderService } from './links.js';
import { TerminalLinkContribution } from './terminalLinkContribution.js';
import { TerminalLinkProviderService } from './terminalLinkProviderService.js';

// #region Services

registerSingleton(ITerminalLinkProviderService, TerminalLinkProviderService, InstantiationType.Delayed);

// #endregion

registerTerminalContribution(TerminalLinkContribution.ID, TerminalLinkContribution, true);

// #region Actions

const category = terminalStrings.actionCategory;

registerActiveInstanceAction({
	id: TerminalLinksCommandId.OpenDetectedLink,
	title: localize2('workbench.action.terminal.openDetectedLink', "打开检测到的链接..."),
	f1: true,
	category,
	precondition: TerminalContextKeys.terminalHasBeenCreated,
	keybinding: [{
		primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyO,
		weight: KeybindingWeight.WorkbenchContrib + 1,
		when: TerminalContextKeys.focus
	}, {
		primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyG,
		weight: KeybindingWeight.WorkbenchContrib + 1,
		when: ContextKeyExpr.and(accessibleViewIsShown, ContextKeyExpr.equals(accessibleViewCurrentProviderId.key, AccessibleViewProviderId.Terminal))
	},
	],
	run: (activeInstance) => TerminalLinkContribution.get(activeInstance)?.showLinkQuickpick()
});
registerActiveInstanceAction({
	id: TerminalLinksCommandId.OpenWebLink,
	title: localize2('workbench.action.terminal.openLastUrlLink', "打开最后一个 URL 链接"),
	metadata: {
		description: localize2('workbench.action.terminal.openLastUrlLink.description', "在终端中打开最后一个检测到的 URL/URI 链接")
	},
	f1: true,
	category,
	precondition: TerminalContextKeys.terminalHasBeenCreated,
	run: (activeInstance) => TerminalLinkContribution.get(activeInstance)?.openRecentLink('url')
});
registerActiveInstanceAction({
	id: TerminalLinksCommandId.OpenFileLink,
	title: localize2('workbench.action.terminal.openLastLocalFileLink', "打开最后一个本地文件链接"),
	f1: true,
	category,
	precondition: TerminalContextKeys.terminalHasBeenCreated,
	run: (activeInstance) => TerminalLinkContribution.get(activeInstance)?.openRecentLink('localFile')
});

// #endregion
