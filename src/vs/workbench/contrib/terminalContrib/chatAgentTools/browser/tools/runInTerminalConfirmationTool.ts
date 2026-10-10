/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { Codicon } from '../../../../../../base/common/codicons.js';
import { escapeMarkdownSyntaxTokens, MarkdownString } from '../../../../../../base/common/htmlContent.js';
import { localize } from '../../../../../../nls.js';
import { CountTokensCallback, IPreparedToolInvocation, IToolData, IToolInvocation, IToolInvocationPreparationContext, IToolResult, ToolDataSource, ToolInvocationPresentation, ToolProgress } from '../../../../chat/common/tools/languageModelToolsService.js';
import { RunInTerminalTool } from './runInTerminalTool.js';
import { TerminalToolId } from './toolIds.js';

export const ConfirmTerminalCommandToolData: IToolData = {
	id: TerminalToolId.ConfirmTerminalCommand,
	displayName: localize('confirmTerminalCommandTool.displayName', "确认终端命令"),
	modelDescription: [
		'This tool allows you to get explicit user confirmation for a terminal command without executing it.',
		'',
		'When to use:',
		'- When you need to verify user approval before executing a command',
		'- When you want to show command details, auto-approval status, and simplified versions to the user',
		'- When you need the user to review a potentially risky command',
		'',
		'The tool will:',
		'- Show the command with syntax highlighting',
		'- Display auto-approval status if enabled',
		'- Show simplified version of the command if applicable',
		'- Provide custom actions for creating auto-approval rules',
		'- Return approval/rejection status',
		'',
		'After confirmation, use a tool to actually execute the command.'
	].join('\n'),
	userDescription: localize('confirmTerminalCommandTool.userDescription', "用于确认终端命令的工具"),
	source: ToolDataSource.Internal,
	icon: Codicon.shield,
	inputSchema: {
		type: 'object',
		properties: {
			command: {
				type: 'string',
				description: 'The command to confirm with the user.'
			},
			explanation: {
				type: 'string',
				description: 'A one-sentence description of what the command does. This will be shown to the user in the confirmation dialog.'
			},
			goal: {
				type: 'string',
				description: 'A short description of the goal or purpose of the command.'
			},
			mode: {
				type: 'string',
				enum: ['sync', 'async'],
				description: 'Execution mode this command would use if run.'
			},
			sandboxBypass: {
				type: 'boolean',
				description: 'Set to true when the command will run outside the sandbox. The confirmation makes the elevated risk clear to the user.'
			},
			sandboxBypassReason: {
				type: 'string',
				description: 'A short explanation of why the command needs to run outside the sandbox. Only meaningful when sandboxBypass is true.'
			},
		},
		required: [
			'command',
			'explanation',
			'goal',
			'mode',
		]
	}
};

export class ConfirmTerminalCommandTool extends RunInTerminalTool {
	protected override get _enableCommandLineSandboxRewriting() {
		return false;
	}

	override async prepareToolInvocation(context: IToolInvocationPreparationContext, token: CancellationToken): Promise<IPreparedToolInvocation | undefined> {
		const preparedInvocation = await super.prepareToolInvocation(context, token);
		if (preparedInvocation) {
			preparedInvocation.presentation = ToolInvocationPresentation.HiddenAfterComplete;

			// Always force a confirmation when the LLM wants to bypass the sandbox: leaving the sandbox is an
			// elevation of privilege the user must approve, even if the command would otherwise be auto-approved.
			const params = context.parameters as { sandboxBypass?: boolean; sandboxBypassReason?: string };
			if (params.sandboxBypass === true) {
				const title = localize('confirmTerminalCommandTool.sandboxBypass.title', "要在沙盒外的终端中运行吗？");
				const reason = typeof params.sandboxBypassReason === 'string' ? escapeMarkdownSyntaxTokens(params.sandboxBypassReason.trim()) : '';
				const message = new MarkdownString(reason
					? localize('confirmTerminalCommandTool.sandboxBypass.message.reason', "该命令将在沙盒外运行。\n\n原因：{0}", reason)
					: localize('confirmTerminalCommandTool.sandboxBypass.message', "该命令将在沙盒外运行。"));
				if (preparedInvocation.confirmationMessages) {
					preparedInvocation.confirmationMessages.title = title;
					preparedInvocation.confirmationMessages.message = message;
				} else {
					preparedInvocation.confirmationMessages = { title, message };
				}
			}
		}
		return preparedInvocation;
	}
	override async invoke(invocation: IToolInvocation, countTokens: CountTokensCallback, progress: ToolProgress, token: CancellationToken): Promise<IToolResult> {
		// This is a confirmation-only tool - just return success
		return {
			content: [{
				kind: 'text',
				value: 'yes'
			}]
		};
	}
}
