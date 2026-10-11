/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Which language model the coach talks to.
 *
 *  Olympia ships no cloud account of its own, so the coach runs entirely on models the user
 *  configures themselves (a local runtime, or any bring-your-own-key provider). Nothing here
 *  invents credentials: an empty list really means "no model configured yet", and the caller is
 *  expected to say so instead of answering from the prompt alone.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';

const CHOSEN_KEY = 'olympia.coach.model';

/** Models the user has actually granted this extension access to. */
export async function listModels(): Promise<vscode.LanguageModelChat[]> {
	try {
		return await vscode.lm.selectChatModels();
	} catch {
		// Denying model access is a normal choice, not a failure to report as a bug.
		return [];
	}
}

function describe(model: vscode.LanguageModelChat): string {
	return `${model.name} · ${model.vendor} · ${model.family}`;
}

/**
 * The stored pick when it is still available, the only available model when there is exactly one,
 * and undefined otherwise — never a silent guess between several candidates.
 */
export function resolveModel(state: vscode.Memento, models: readonly vscode.LanguageModelChat[]): vscode.LanguageModelChat | undefined {
	const stored = state.get<string>(CHOSEN_KEY);
	if (stored) {
		const match = models.find(model => model.id === stored);
		if (match) {
			return match;
		}
	}
	return models.length === 1 ? models[0] : undefined;
}

export function registerModelPicker(context: vscode.ExtensionContext): void {
	context.subscriptions.push(vscode.commands.registerCommand('olympia.coach.selectModel', async () => {
		const models = await listModels();
		if (models.length === 0) {
			await vscode.window.showInformationMessage(
				'还没有可用的语言模型。请先运行「Olympia：设置 AI 教练的 API Key」，并在设置里填写 olympia.ai.baseUrl（olympia.ai.models 留空即自动从该地址的 /models 读取模型列表）。原因会写在输出面板「Olympia AI Coach」里。');
			return;
		}
		const picked = await vscode.window.showQuickPick(
			models.map(model => ({ label: describe(model), model })),
			{ placeHolder: '选择 AI 教练使用的模型' });
		if (picked) {
			await context.globalState.update(CHOSEN_KEY, picked.model.id);
			await vscode.window.showInformationMessage(`AI 教练将使用 ${describe(picked.model)}。`);
		}
	}));
}
