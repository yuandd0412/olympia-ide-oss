/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Olympia AI Coach — a chat participant for competitive-programming students.
 *
 *  product.json's defaultChatAgent deliberately does NOT name this extension: core's
 *  ensureChatExtensionInitialDisabledState (extensionEnablementService.ts:155-190) force-disables
 *  any built-in whose id equals defaultChatAgent.chatExtensionId until chat setup is completed, so
 *  claiming that slot would leave the coach switched off on every fresh profile. It ships as an
 *  ordinary built-in that registers a participant instead.
 *
 *  Answers come from whatever language model the user configured — a local runtime or their own
 *  key. There is no hosted Olympia account, so nothing here pretends there is one.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { registerCoachParticipant } from './coach';
import { listModels, registerModelPicker } from './model';
import { registerProvider } from './provider';
import { registerSettingsPanel } from './settingsPanel';

export function activate(context: vscode.ExtensionContext): void {
	// Created before the provider registers: it logs why a model listing fell back to the built-in
	// list, which is the only trace of a network failure the user can see.
	// Id ends up as `<extensionId>.<label>.log`, which is the value product.json advertises.
	const log = vscode.window.createOutputChannel('Olympia AI Coach', { log: true });
	context.subscriptions.push(log);

	registerProvider(context, log);
	registerSettingsPanel(context, log);
	registerCoachParticipant(context);
	registerModelPicker(context);

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
