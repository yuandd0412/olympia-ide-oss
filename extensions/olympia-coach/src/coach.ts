/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  The Olympia coach chat participant.
 *
 *  Deliberately a *coach*, not a solution generator: the prompts push for diagnosis and direction
 *  first, and full AC code only when the student asks for it. The editor buffer is attached as
 *  context when one is open, and when it is not the model is told so, because a model that guesses
 *  at code it cannot see produces confident nonsense about a wrong answer.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { EXAMPLE_BASE_URL } from './constants';
import { listModels, resolveModel } from './model';

const HISTORY_TURNS = 6;
const MAX_DOCUMENT_CHARS = 12_000;

const PERSONA = [
	'你是 Olympia IDE 内置的信息学竞赛（NOIP/NOI/CSP）教练，用简体中文回答。',
	'规则：',
	'- 先诊断，再给方向。默认不要输出完整可提交代码；学生明确要代码时再给，并标出关键行。',
	'- 涉及复杂度时给出关于 n 的显式估计，并对照常见限制（1s 约 1e8 次简单运算）。',
	'- 说清你「看不到」的东西：没有题面、没有评测输出、没有数据范围时，直接说明并列出需要学生补充的信息。',
	'- 不要做超出事实的承诺，不声称自己能访问评测机或在线评测网站。',
].join('\n');

const BY_COMMAND: Record<string, string> = {
	wa: [
		'学生问的是答案错误（WA）的原因。请按可能性从高到低列出至多 3 个候选错因。',
		'每个错因给出：判定依据、如何在本地复现或排除（含构造的小数据）、修复思路（不写完整代码）。',
	].join('\n'),
	hint: [
		'学生只要思路提示。给出问题建模、关键不变量或合适的算法族，最多三步引导。',
		'禁止给出完整实现；可以用伪代码或只描述状态转移。',
	].join('\n'),
	check: [
		'学生准备提交，请做提交前风险检查。逐项覆盖：数组越界与边界 n=0/1、整数溢出（int 与 long long）、',
		'读入是否处理多组数据与 EOF、时间复杂度是否超限、递归深度、输出格式（换行与空格）、未初始化状态。',
		'每项标注「已确认无问题」「可疑」「无法判断」，可疑项说明理由。',
	].join('\n'),
};

const NO_MODEL = [
	'AI 教练还没有可用的模型。',
	'',
	'打开「Olympia AI 设置」（`Ctrl+Shift+P` 输入 olympia ai 设置），在一页里填好三件事：',
	`1. 服务地址：OpenAI 兼容地址，例如 \`${EXAMPLE_BASE_URL}\`（不含 \`/chat/completions\`）。`,
	'2. API 密钥：只存在本机 SecretStorage，页面上读不回原文。',
	'3. 模型：默认自动读取该地址的 `/models`；没有这个接口的网关再手动指定。',
	'',
	'拉取失败的具体原因在「Olympia AI 设置」里会直接显示，也可以点「打开输出日志」查看。',
].join('\n');

function editorContext(): string {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return '（当前没有打开的文件，因此看不到学生的代码。）';
	}
	const text = editor.document.getText().slice(0, MAX_DOCUMENT_CHARS);
	const truncated = editor.document.getText().length > MAX_DOCUMENT_CHARS ? '\n…（文件过长，已截断）' : '';
	return `当前打开的文件：${editor.document.fileName}\n\`\`\`${editor.document.languageId}\n${text}${truncated}\n\`\`\``;
}

function toMessages(history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>): vscode.LanguageModelChatMessage[] {
	const messages: vscode.LanguageModelChatMessage[] = [];
	for (const turn of history.slice(-HISTORY_TURNS)) {
		if (turn instanceof vscode.ChatRequestTurn) {
			messages.push(vscode.LanguageModelChatMessage.User(turn.prompt));
		} else {
			const text = turn.response
				.filter((part): part is vscode.ChatResponseMarkdownPart => part instanceof vscode.ChatResponseMarkdownPart)
				.map(part => part.value.value ?? '')
				.join('');
			if (text.length > 0) {
				messages.push(vscode.LanguageModelChatMessage.Assistant(text));
			}
		}
	}
	return messages;
}

async function handleRequest(
	state: vscode.Memento,
	request: vscode.ChatRequest,
	context: vscode.ChatContext,
	stream: vscode.ChatResponseStream,
	token: vscode.CancellationToken
): Promise<void> {
	const models = await listModels();
	const model = resolveModel(state, models);
	if (!model) {
		stream.markdown(NO_MODEL);
		if (models.length > 1) {
			stream.markdown('\n检测到多个模型，请运行「Olympia：选择 AI 教练使用的模型」指定一个。');
		}
		return;
	}

	const instruction = request.command ? (BY_COMMAND[request.command] ?? '') : '';
	const messages = [
		vscode.LanguageModelChatMessage.Assistant(`${PERSONA}\n\n${instruction}`),
		...toMessages(context.history),
		vscode.LanguageModelChatMessage.User(`${editorContext()}\n\n学生的问题：\n${request.prompt}`),
	];

	try {
		const response = await model.sendRequest(messages, {}, token);
		for await (const chunk of response.text) {
			stream.markdown(chunk);
		}
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		stream.markdown(`模型 \`${model.name}\` 调用失败：${detail}\n\n可以换一个模型，或确认它当前正在运行。`);
	}
}

export function registerCoachParticipant(context: vscode.ExtensionContext): void {
	const participant = vscode.chat.createChatParticipant('olympia.coach', (request, chatContext, stream, token) =>
		handleRequest(context.globalState, request, chatContext, stream, token));
	participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'coach.svg');
	context.subscriptions.push(participant);
}
