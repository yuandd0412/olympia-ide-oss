/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../nls.js';
import * as paths from '../../../../base/common/path.js';
import { IExternalTerminalSettings } from '../../../../platform/externalTerminal/common/externalTerminal.js';
import { MenuId, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { KeyMod, KeyCode } from '../../../../base/common/keyCodes.js';
import { IHistoryService } from '../../../services/history/common/history.js';
import { KeybindingsRegistry, KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { Schemas } from '../../../../base/common/network.js';
import { IConfigurationRegistry, Extensions, ConfigurationScope, type IConfigurationPropertySchema } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { IExternalTerminalService } from '../../../../platform/externalTerminal/electron-browser/externalTerminalService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { TerminalContextKeys } from '../../terminal/common/terminalContextKey.js';
import { IRemoteAuthorityResolverService } from '../../../../platform/remote/common/remoteAuthorityResolver.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { URI } from '../../../../base/common/uri.js';
import { IsSessionsWindowContext } from '../../../common/contextkeys.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';

const OPEN_NATIVE_CONSOLE_COMMAND_ID = 'workbench.action.terminal.openNativeConsole';
KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: OPEN_NATIVE_CONSOLE_COMMAND_ID,
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyC,
	when: ContextKeyExpr.and(TerminalContextKeys.notFocus, IsSessionsWindowContext.negate()),
	weight: KeybindingWeight.WorkbenchContrib,
	handler: async (accessor) => {
		const historyService = accessor.get(IHistoryService);
		// Open external terminal in local workspaces
		const terminalService = accessor.get(IExternalTerminalService);
		const configurationService = accessor.get(IConfigurationService);
		const remoteAuthorityResolverService = accessor.get(IRemoteAuthorityResolverService);
		const workspaceContextService = accessor.get(IWorkspaceContextService);
		const quickInputService = accessor.get(IQuickInputService);
		const labelService = accessor.get(ILabelService);
		const config = configurationService.getValue<IExternalTerminalSettings>('terminal.external');

		// When there are multiple workspace folders, let the user pick one
		const folders = workspaceContextService.getWorkspace().folders;
		let root: URI | undefined;
		if (folders.length > 1) {
			const folderPicks: IQuickPickItem[] = folders.map(folder => ({
				label: folder.name,
				description: labelService.getUriLabel(folder.uri, { relative: true })
			}));
			const pick = await quickInputService.pick(folderPicks, {
				placeHolder: nls.localize('selectWorkspace', "选择工作区文件夹")
			});
			if (!pick) {
				return;
			}
			root = folders[folderPicks.indexOf(pick)].uri;
		} else {
			root = historyService.getLastActiveWorkspaceRoot();
		}

		// It's a local workspace, open the root
		if (root?.scheme === Schemas.file) {
			terminalService.openTerminal(config, root.fsPath);
			return;
		}

		// If it's a remote workspace, open the canonical URI if it is a local folder
		try {
			if (root?.scheme === Schemas.vscodeRemote) {
				const canonicalUri = await remoteAuthorityResolverService.getCanonicalURI(root);
				if (canonicalUri.scheme === Schemas.file) {
					terminalService.openTerminal(config, canonicalUri.fsPath);
					return;
				}
			}
		} catch { }

		// Open the current file's folder if it's local or its canonical URI is local
		// Opens current file's folder, if no folder is open in editor
		const activeFile = historyService.getLastActiveFile(Schemas.file);
		if (activeFile?.scheme === Schemas.file) {
			terminalService.openTerminal(config, paths.dirname(activeFile.fsPath));
			return;
		}
		try {
			if (activeFile?.scheme === Schemas.vscodeRemote) {
				const canonicalUri = await remoteAuthorityResolverService.getCanonicalURI(activeFile);
				if (canonicalUri.scheme === Schemas.file) {
					terminalService.openTerminal(config, canonicalUri.fsPath);
					return;
				}
			}
		} catch { }

		// Fallback to opening without a cwd which will end up using the local home path
		terminalService.openTerminal(config, undefined);
	}
});

MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: OPEN_NATIVE_CONSOLE_COMMAND_ID,
		title: nls.localize2('globalConsoleAction', "打开新的外部终端")
	}
});

export class ExternalTerminalContribution implements IWorkbenchContribution {

	public _serviceBrand: undefined;
	constructor(@IExternalTerminalService private readonly _externalTerminalService: IExternalTerminalService) {
		this._updateConfiguration();
	}

	private async _updateConfiguration(): Promise<void> {
		const terminals = await this._externalTerminalService.getDefaultTerminalForPlatforms();
		const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
		const terminalKindProperties: Partial<IConfigurationPropertySchema> = {
			type: 'string',
			enum: [
				'integrated',
				'external',
				'both'
			],
			enumDescriptions: [
				nls.localize('terminal.kind.integrated', "显示集成终端操作。"),
				nls.localize('terminal.kind.external', "显示外部终端操作。"),
				nls.localize('terminal.kind.both', "同时显示集成和外部终端操作。")
			],
			default: 'integrated'
		};
		configurationRegistry.registerConfiguration({
			id: 'externalTerminal',
			order: 100,
			title: nls.localize('terminalConfigurationTitle', "外部终端"),
			type: 'object',
			properties: {
				'terminal.explorerKind': {
					...terminalKindProperties,
					description: nls.localize('explorer.openInTerminalKind', "在终端中从资源管理器打开文件时，确定将启动哪种类型的终端"),
				},
				'terminal.sourceControlRepositoriesKind': {
					...terminalKindProperties,
					description: nls.localize('sourceControlRepositories.openInTerminalKind', "当从终端中从“源代码管理存储库”视图中打开文件时，确定将启动哪种类型的终端"),
				},
				'terminal.external.windowsExec': {
					type: 'string',
					description: nls.localize('terminal.external.windowsExec', "自定义要在 Windows 上运行的终端。"),
					default: terminals.windows,
					scope: ConfigurationScope.APPLICATION
				},
				'terminal.external.osxExec': {
					type: 'string',
					description: nls.localize('terminal.external.osxExec', "定义在 macOS 上运行的终端应用程序。"),
					default: terminals.osx,
					scope: ConfigurationScope.APPLICATION
				},
				'terminal.external.linuxExec': {
					type: 'string',
					description: nls.localize('terminal.external.linuxExec', "自定义要在 Linux 上运行的终端。"),
					default: terminals.linux,
					scope: ConfigurationScope.APPLICATION
				}
			}
		});
	}
}

// Register workbench contributions
const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(ExternalTerminalContribution, LifecyclePhase.Restored);
