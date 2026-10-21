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
import { CONTEST_STATE_COMMAND, EXAMPLE_BASE_URL, EXTRACT_INPUT_CHAR_CAP as MAX_DOCUMENT_CHARS } from './constants';
import { listModels, resolveOrAskModel } from './model';

const HISTORY_TURNS = 6;
// 一次请求里塞给模型的代码只有一个上限，就是 `EXTRACT_INPUT_CHAR_CAP`（这边按
// `MAX_DOCUMENT_CHARS` 用）：调高一处而另一处没跟上，同一个题面在两条入口里就会被
// 截成两种长度，教练看到的代码半截不同。
/** 题面比代码更容易长（洛谷一份题面常带大段说明与多组样例），给得比代码少一点，留给问题与历史。 */
const MAX_STATEMENT_CHARS = 6_000;
/**
 * 题面库的目录。写题面的是 olympia-contest，这边只读——共享的是文件，不是代码。
 *
 * 目录名不能写死：真源是 olympia-contest 贡献的 `olympia.problem.problemsDir` 设置。
 * 学生改过目录之后，contest 往新目录写题面，而教练还在旧目录里找，结果是「问教练」
 * 每次都回一句「题面库里找不到这道题」——题面明明就在盘上，用户看到的却是我们
 * 承诺过的功能（带题面提问）凭空失灵。跨扩展没有 import 这条路，所以按键名读。
 */
const PROBLEMS_DIR_SETTING = 'problemsDir';
const DEFAULT_PROBLEMS_DIR = '.olympia/problems';

function problemsDir(scope: vscode.Uri): string {
	const configured = vscode.workspace.getConfiguration('olympia.problem', scope).get<string>(PROBLEMS_DIR_SETTING, DEFAULT_PROBLEMS_DIR);
	return (configured ?? '').trim() || DEFAULT_PROBLEMS_DIR;
}

/** 一次列目录最多取这么多份题面。题面库比这大时按题号可能找不到，但那是几千份的量级。 */
const MAX_STATEMENT_FILES = 400;

const PERSONA = [
	'你是 Olympia IDE 内置的信息学竞赛（NOIP/NOI/CSP）教练，用简体中文回答。',
	'规则：',
	'- 先诊断，再给方向。默认不要输出完整可提交代码；学生明确要代码时再给，并标出关键行。',
	'- 涉及复杂度时给出关于 n 的显式估计，并对照常见限制（1s 约 1e8 次简单运算）。',
	'- 题面通常随本轮一起给你（本地题面库里缓存过这道题时）；本轮没给就是没缓存，直说需要学生补题意，别假装看过。',
	'- 你拿不到评测机的结果。学生从「问教练」进来时除外——那条会把判定与每组样例的期望／实际一起贴过来。',
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

const CONTEST_LOCKED = [
	'**比赛模式进行中，AI 教练先不出场。**',
	'',
	'这一局打完再问，或者按 `Ctrl+Alt+C` 退出比赛模式。',
	'这段时间可以用「提交前体检」（`Ctrl+Alt+Enter`）和「跑样例」（`Ctrl+Alt+J`）——那是本地判定，不算外援。',
].join('\n');

/** 比赛状态在 olympia-onboarding 那边；问不到就当作没在比赛，不能把教练锁死。 */
async function contestIsRunning(): Promise<boolean> {
	try {
		return (await vscode.commands.executeCommand(CONTEST_STATE_COMMAND)) === true;
	} catch {
		return false;
	}
}

function editorContext(): string {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return '（当前没有打开的文件，因此看不到学生的代码。）';
	}
	const text = editor.document.getText().slice(0, MAX_DOCUMENT_CHARS);
	const truncated = editor.document.getText().length > MAX_DOCUMENT_CHARS ? '\n…（文件过长，已截断）' : '';
	return `当前打开的文件：${editor.document.fileName}\n\`\`\`${editor.document.languageId}\n${text}${truncated}\n\`\`\``;
}

/**
 * 这道题的题面。学生按 `/wa` 时问的就是「我哪里不符合题意」，不带题面等于让他把题目重述一遍
 * ——老版本是带的，官网和 `/wa` 的说明也写着「结合题面」。
 *
 * 路径按大小写不敏感对齐题号（题面文件名和源文件名可能一个 P53 一个 p53）。
 * 读的是 `olympia.problem.problemsDir` 指向的那个共享目录，不 import olympia-contest：跨扩展没有 import 这条路，
 * 与 solvedMarks 那边是同一个约定。
 */
export async function statementContext(): Promise<string> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	const file = vscode.window.activeTextEditor?.document.uri;
	if (!folder || !file) {
		return '（本轮没有题面：要么没打开工程，要么没打开源文件。）';
	}
	const wanted = basenameOf(file).replace(/\.[^.]*$/, '').toLowerCase();
	const found = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, `${problemsDir(folder.uri)}/*.md`), undefined, MAX_STATEMENT_FILES);
	const hit = found.find(uri => basenameOf(uri).toLowerCase() === `${wanted}.md`) ?? found.find(uri => basenameOf(uri).toLowerCase() === `${wanted}`);
	if (!hit) {
		return `（本轮没有题面：题面库里找不到 ${wanted} 这道题。按 Ctrl+Alt+P 拉一份，或把题意要点补进问题里。）`;
	}
	const markdown = new TextDecoder().decode(await vscode.workspace.fs.readFile(hit)).slice(0, MAX_STATEMENT_CHARS);
	return `这道题的题面（来自本地题面库，过长已截断）：\n\n${markdown}\n`;
}

function basenameOf(uri: vscode.Uri): string {
	return uri.path.split('/').pop() ?? '';
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
	if (await contestIsRunning()) {
		stream.markdown(CONTEST_LOCKED);
		return;
	}
	const models = await listModels();
	const model = await resolveOrAskModel(state, models);
	if (!model) {
		if (models.length) {
			// 配置是好的，只是刚才那个选择框被关掉了——别把人说成没配好。
			stream.markdown(`没有选模型，这一轮先不作答。想改主意随时运行「Olympia：选择 AI 教练使用的模型」（当前有 ${models.length} 个候选）。`);
		} else {
			stream.markdown(NO_MODEL);
		}
		return;
	}

	const instruction = request.command ? (BY_COMMAND[request.command] ?? '') : '';
	const messages = [
		vscode.LanguageModelChatMessage.Assistant(`${PERSONA}\n\n${instruction}`),
		...toMessages(context.history),
		vscode.LanguageModelChatMessage.User(`${await statementContext()}\n${editorContext()}\n\n学生的问题：\n${request.prompt}`),
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
