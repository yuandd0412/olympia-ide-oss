/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Olympia AI Coach — the chat agent product.json already points at.
 *
 *  product.json's defaultChatAgent names this extension id, its output channel and one debug
 *  command. Those three are honoured here so the workbench's chat management page shows a real
 *  state instead of dangling references; the answers themselves come from whatever language model
 *  the user configured, never from a hosted Olympia account, which does not exist.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { registerCoachParticipant } from './coach';
import { listModels, registerModelPicker } from './model';

export function activate(context: vscode.ExtensionContext): void {
	registerCoachParticipant(context);
	registerModelPicker(context);

	// Id ends up as `<extensionId>.<label>.log`, which is the value product.json advertises.
	context.subscriptions.push(vscode.window.createOutputChannel('Olympia AI Coach', { log: true }));

	context.subscriptions.push(vscode.commands.registerCommand('olympia.coach.debug.extensionState', async () => {
		const models = await listModels();
		return {
			version: context.extension?.packageJSON.version ?? '0.0.0',
			chosenModel: context.globalState.get<string>('olympia.coach.model') ?? null,
			availableModels: models.map(model => ({ id: model.id, name: model.name, vendor: model.vendor, family: model.family })),
		};
	}));
}

export function deactivate(): void { }
