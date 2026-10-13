/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Olympia 竞赛助手 — 题面拉取、赛制模板、已缓存题面浏览。
 *
 *  Design notes:
 *   * Everything is a normal built-in extension; no activation cost beyond a few ms.
 *   * The pulled statement is written as Markdown under <workspace>/.olympia/problems so it
 *     can be committed alongside the solution, or opened with the built-in Markdown preview.
 *   * All user-visible strings are already Chinese; this extension never falls back to English.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { detectPlatform, fetchProblem, type Platform, type Problem } from './sources';
import { renderStatement, templateFor, FORMAT_LABEL, PLATFORM_TEXT, platformText, MY_TEMPLATE_LABEL, MY_TEMPLATE_HINT, TEMPLATE_FOLDER, TEMPLATE_FILE, DEFAULT_PROBLEMS_DIR, STATEMENT_EXTENSION, type ContestFormat } from './templates';
import { readLibrary, showStatement, toPicks } from './problemLibrary';
import { markOf, solvedMarks, type SolvedMark } from './solvedMarks';
import { MAX_PRACTICE_PROBLEMS, PRACTICE_FILE, PRACTICE_MINUTES_MAX, PRACTICE_MINUTES_MIN, isSameName, mergeLists, parseMinutes, parseProblemIds, practiceFile, readLists, readPractice, withExtraProblems, withoutProblem, writeLists, type PracticeList } from './practiceList';
import { appendSample as appendSampleTo, customSamplesOf, MANUAL_EXPLAIN, pickTarget, withCustomSamples } from './statementSamples';
import { registerCppSnippets } from './snippets';

function cfg() {
	const c = vscode.workspace.getConfiguration('olympia.problem');
	return {
		problemsDir: c.get<string>('problemsDir', DEFAULT_PROBLEMS_DIR),
		templateOnPull: c.get<boolean>('templateOnPull', false),
		timeoutMs: c.get<number>('requestTimeoutMs', 15000),
		cfMetadata: c.get<boolean>('cfMetadata', false),
	};
}

async function problemsRoot(): Promise<string | undefined> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		vscode.window.showWarningMessage('请先打开一个工作区文件夹，再拉取题面。');
		return undefined;
	}
	const root = path.join(folder.uri.fsPath, cfg().problemsDir);
	await fs.promises.mkdir(root, { recursive: true });
	return root;
}

async function askProblemRef(initial?: string): Promise<{ id: string; platform: Platform } | undefined> {
	const id = await vscode.window.showInputBox({
		title: '拉取题面',
		prompt: '输入题号，例如 P1001（洛谷）、1660C（Codeforces）、ABC123_A（AtCoder）',
		placeHolder: 'P1001',
		value: initial,
		ignoreFocusOut: true,
		validateInput: v => (v.trim() ? undefined : '请输入题号'),
	});
	if (!id) { return undefined; }

	let platform = detectPlatform(id);
	if (!platform) {
		const picked = await vscode.window.showQuickPick(
			(Object.keys(PLATFORM_TEXT) as Platform[]).map(p => ({ label: platformText(p), p })),
			{ title: '无法从题号判断来源，请选择平台', ignoreFocusOut: true },
		);
		if (!picked) { return undefined; }
		platform = picked.p;
	}
	return { id: id.trim(), platform };
}

async function writeProblem(p: Problem): Promise<vscode.Uri | undefined> {
	const root = await problemsRoot();
	if (!root) { return undefined; }
	const file = path.join(root, `${p.id}${STATEMENT_EXTENSION}`);
	// 题面里可能已经有学生自己加的样例（面板补的、对拍补的），重新拉一次不能把它们冲掉
	const previous = await fs.promises.readFile(file, 'utf8').catch(() => '');
	const custom = previous ? customSamplesOf(previous) : [];
	await fs.promises.writeFile(file, withCustomSamples(renderStatement(p), custom), 'utf8');
	if (custom.length) {
		vscode.window.showInformationMessage(`题面已更新，你加的 ${custom.length} 组样例保留了。`);
	}
	return vscode.Uri.file(file);
}

async function pullProblem(ref: { id: string; platform: Platform }): Promise<void> {
	const { timeoutMs, templateOnPull, cfMetadata } = cfg();
	await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: `正在从 ${platformText(ref.platform)} 拉取题面 ${ref.id}…`, cancellable: false },
		async () => {
			try {
				const problem = await fetchProblem(ref.id, ref.platform, timeoutMs, cfMetadata);
				const uri = await writeProblem(problem);
				if (!uri) { return; }

				if (templateOnPull) {
					const seed = path.join(path.dirname(uri.fsPath), `${problem.id}.cpp`);
					if (!fs.existsSync(seed)) {
						// 拉完题面建新文件正是模板最该出现的一刻：有自己那份就用自己那份。
						await fs.promises.writeFile(seed, await readMyTemplate() ?? templateFor('acm'), 'utf8');
					}
				}

				const doc = await vscode.workspace.openTextDocument(uri);
				await vscode.window.showTextDocument(doc, { preview: false });

				if (problem.metadataOnly) {
					const open = await vscode.window.showInformationMessage(
						`${platformText(ref.platform)} 的题面网页有人机校验，已写入题目信息。是否在浏览器中打开原题？`,
						'在浏览器中打开',
					);
					if (open) { await vscode.env.openExternal(vscode.Uri.parse(problem.url)); }
				} else {
					vscode.window.showInformationMessage(
						`已拉取 ${problem.id} ${problem.title || ''}（${problem.samples.length} 组样例）`.trim(),
					);
				}
			} catch (err: any) {
				vscode.window.showErrorMessage(`拉取题面失败：${err?.message ?? err}`);
			}
		},
	);
}

async function openCached(): Promise<void> {
	const root = await problemsRoot();
	if (!root) { return; }
	const entries = await readLibrary(root);
	if (!entries.length) {
		vscode.window.showInformationMessage('还没有缓存的题面，先用「拉取题面」（Ctrl+Alt+P）抓一道吧。');
		return;
	}
	// 做过的题打个勾：题库刷到一半回来接着做，靠记忆挑「哪道还没 AC」是最亏的。
	const marks = await solvedMarks();
	const solved = entries.filter(entry => markOf(marks, entry.id)).length;
	const picks = toPicks(entries, vscode.workspace.workspaceFolders?.[0]?.uri.fsPath, marks);
	const picked = await vscode.window.showQuickPick(picks, {
		title: solved ? `题面库（缓存 ${entries.length} 道，已 AC ${solved} 道）` : `题面库（缓存了 ${entries.length} 道题）`,
		placeHolder: solved ? '按题号或标题搜；敲 AC 只看做出来的题' : '按题号或标题搜，例如 P1001、并查集',
		matchOnDescription: true,
		matchOnDetail: true,
		ignoreFocusOut: true,
	});
	if (!picked) { return; }
	await showStatement(vscode.Uri.file(picked.entry.file));
}

/** 比赛模式在 olympia-onboarding 那边；清单只是把时长交给它，计时和锁 AI 都归它。 */
const CONTEST_MODE_COMMAND = 'olympia.contestMode';

/** 清单菜单里的一行：要么是个题号，要么是「开始这一场」「加一道题」这类动作。 */
interface PracticePick extends vscode.QuickPickItem {
	readonly action?: 'start' | 'add' | 'minutes' | 'remove' | 'delete';
	readonly problemId?: string;
	readonly list?: PracticeList;
}

function acCount(list: PracticeList, marks: ReadonlyMap<string, SolvedMark>): number {
	return list.problems.filter(id => markOf(marks, id)).length;
}

/**
 * 目录里已经拉过的题号 → 那个文件真正叫什么（键小写）。
 * 用真实文件名而不是把清单里的题号直接拼成路径：清单写 `P1001`、文件叫 `p1001.md` 时，
 * 拼出来的路径在 Windows 上碰巧能用，在别的文件系统上就变成「明明缓存了却又去拉一遍」。
 */
async function cachedStatements(root: string): Promise<ReadonlyMap<string, string>> {
	const names = await fs.promises.readdir(root).catch(() => []);
	const byId = new Map<string, string>();
	for (const name of names) {
		if (!name.toLowerCase().endsWith(STATEMENT_EXTENSION)) {
			continue;
		}
		byId.set(name.slice(0, -STATEMENT_EXTENSION.length).toLowerCase(), name);
	}
	return byId;
}

function problemHint(id: string, marks: ReadonlyMap<string, SolvedMark>, cached: ReadonlyMap<string, string>): string {
	const mark = markOf(marks, id);
	const where = cached.has(id.trim().toLowerCase()) ? '题面在本地' : '还没拉过题面，点了去拉';
	return mark ? `已 AC ${mark.times} 次 · ${where}` : where;
}

/** 一道题：本地有题面就打开那个文件，没有就直接去拉（题号认不出平台时让学生挑，和「拉取题面」同一条路）。 */
async function openOrPull(id: string, root: string | undefined, cached: ReadonlyMap<string, string>): Promise<void> {
	const file = root ? cached.get(id.trim().toLowerCase()) : undefined;
	if (root && file) {
		await showStatement(vscode.Uri.file(path.join(root, file)));
		return;
	}
	const platform = detectPlatform(id);
	if (platform) {
		await pullProblem({ id, platform });
		return;
	}
	const ref = await askProblemRef(id);
	if (ref) {
		await pullProblem(ref);
	}
}

/** 时长那两处输入（新建、改时长）共用一条判定，免得提示和采纳各说各话。 */
function validateMinutes(value: string): string | undefined {
	return !value.trim() || parseMinutes(value) !== undefined
		? undefined
		: `要写 ${PRACTICE_MINUTES_MIN}–${PRACTICE_MINUTES_MAX} 之间的整数，或者留空`;
}

/**
 * 整份写回。两种情况一律不动文件并把话说明白：
 * 文件存在但这一版读不懂（覆盖写会顺手删掉 Olympia 不认识的条目），以及存不下去（只读、盘满）。
 */
async function writeListsSafe(lists: PracticeList[]): Promise<boolean> {
	const disk = await readPractice();
	if (disk.unreadable) {
		void vscode.window.showErrorMessage(`清单文件读不出内容，Olympia 没有改动它：检查工程的 ${TEMPLATE_FOLDER}/${PRACTICE_FILE}（可能是别的版本写的，或者手工改坏了）。`);
		return false;
	}
	const problem = await writeLists(lists, disk.unknown);
	if (problem) {
		void vscode.window.showErrorMessage(`清单没能保存：${problem}`);
		return false;
	}
	return true;
}

/** 改完立刻落盘；没写成就返回 undefined，调用方直接收场（原因上面已经说过了）。 */
async function saveList(list: PracticeList): Promise<PracticeList | undefined> {
	return await writeListsSafe(mergeLists((await readPractice()).lists, list)) ? list : undefined;
}

/** 三步输入：名字 → 题号 → 时长。任何一步取消都算没建，不留半份清单。 */
async function createPracticeList(): Promise<PracticeList | undefined> {
	const name = await vscode.window.showInputBox({
		title: '新建集训清单',
		prompt: '给这份清单起个名字，例如「CSP-J 模拟 3」。同名清单会被这一份顶掉，改题目不用先删。',
		placeHolder: 'CSP-J 模拟 3',
		ignoreFocusOut: true,
		validateInput: value => value.trim() ? undefined : '名字不能空着',
	});
	if (!name) { return undefined; }

	const typed = await vscode.window.showInputBox({
		title: `${name.trim()}：这一场的题目`,
		prompt: `题号之间用空格隔开，例如 P1001 P7076 1660C（逗号、顿号、换行隔开也算，最多 ${MAX_PRACTICE_PROBLEMS} 题）。`,
		placeHolder: 'P1001 P1002 P1308',
		ignoreFocusOut: true,
	});
	if (typed === undefined) { return undefined; }
	const problems = parseProblemIds(typed);
	if (!problems.length) {
		void vscode.window.showWarningMessage('清单里一道题都没有：题号要写成 P1001 P1002 这样。');
		return undefined;
	}

	const minutesText = await vscode.window.showInputBox({
		title: '这一场多少分钟',
		prompt: '留空表示不设时限，开场时再问；也可以先空着，之后靠「比赛模式」（Ctrl+Alt+C）自己选时长。',
		placeHolder: '120',
		ignoreFocusOut: true,
		validateInput: validateMinutes,
	});
	if (minutesText === undefined) { return undefined; }

	if (!practiceFile()) {
		void vscode.window.showWarningMessage(`先打开一个文件夹：清单存在工程的 ${TEMPLATE_FOLDER}/${PRACTICE_FILE} 里，跟着工程走到机房。`);
		return undefined;
	}
	const list: PracticeList = { name: name.trim(), problems, minutes: parseMinutes(minutesText), createdAt: new Date().toISOString() };
	return await saveList(list);
}

/** 选中一份清单之后的菜单：开场、逐题，以及就地改题目/时长（改完立刻回到这份菜单）。 */
async function showPractice(list: PracticeList, marks: ReadonlyMap<string, SolvedMark>): Promise<void> {
	let current = list;
	for (; ;) {
		const root = await problemsRoot();
		const cached = root ? await cachedStatements(root) : new Map<string, string>();
		const done = acCount(current, marks);
		const picks: PracticePick[] = [
			{
				label: '开始这一场',
				description: current.minutes ? `${current.minutes} 分钟，期间 AI 教练不出场` : '现在问时长',
				action: 'start',
			},
			{ label: '加一道题…', description: `题号写进来就行，不用先拉题面（${current.problems.length}/${MAX_PRACTICE_PROBLEMS}）`, action: 'add' },
			{ label: '改时长…', description: current.minutes ? `现在一场 ${current.minutes} 分钟` : '现在不设时限', action: 'minutes' },
			...current.problems.map(id => ({
				label: markOf(marks, id) ? `✓ ${id}` : id,
				description: problemHint(id, marks, cached),
				problemId: id,
			})),
			{ label: '移掉一道题…', description: '只从这份单子里去掉，题面文件留着', action: 'remove' },
			{ label: '删掉这份清单', description: '题面和解题记录都留着，删的只是这份单子', action: 'delete' },
		];
		const picked = await vscode.window.showQuickPick(picks, {
			title: `${current.name}（${current.problems.length} 题 · 已 AC ${done} 道）`,
			placeHolder: '点一道题就打开它的题面（没拉过的会先去拉）',
			matchOnDescription: true,
			ignoreFocusOut: true,
		});
		if (!picked) { return; }

		if (picked.action === 'start') {
			// 比赛模式在另一个扩展里：它被禁用或激活失败时，点了必须说一句人话，
			// 而不是让工作区弹一条英文的 Node 错误把「开始这一场」变成一次莫名失败的点击。
			try {
				await vscode.commands.executeCommand(CONTEST_MODE_COMMAND, current.minutes);
			} catch {
				void vscode.window.showWarningMessage('比赛模式没能开始：Olympia 的入门扩展没有在运行。清单没动，题面也都在。');
			}
			return;
		}
		if (picked.action === 'delete') {
			const confirmed = await vscode.window.showWarningMessage(
				`删掉清单「${current.name}」？题面和解题记录都不动，删的只是这份题目单。`, '删除');
			if (confirmed) {
				const rest = (await readLists()).filter(item => !isSameName(item.name, current.name));
				if (await writeListsSafe(rest)) {
					void vscode.window.showInformationMessage(`清单「${current.name}」删掉了。`);
				}
			}
			return;
		}

		if (picked.action === 'add') {
			const typed = await vscode.window.showInputBox({
				title: `${current.name}：加一道题`,
				prompt: `题号，例如 P3367；一次加几道就用空格隔开。现在 ${current.problems.length} 题，上限 ${MAX_PRACTICE_PROBLEMS} 题。`,
				placeHolder: 'P3367 P3371',
				ignoreFocusOut: true,
			});
			if (typed === undefined) { continue; }
			const extra = parseProblemIds(typed);
			const next = withExtraProblems(current, extra);
			const added = next.problems.length - current.problems.length;
			if (!added) {
				// 满了和「已经在了」是两回事，说错了学生就不知道下一步该做什么。
				void vscode.window.showWarningMessage(current.problems.length >= MAX_PRACTICE_PROBLEMS
					? `这份清单已经 ${MAX_PRACTICE_PROBLEMS} 题满了：要先移掉几道，或者另建一份。`
					: extra.length
						? '这些题号已经在清单里了，没有新题要加。'
						: '没认出题目编号：要写成 P3367 这样，几个题号用空格隔开。');
				continue;
			}
			if (added < extra.length) {
				void vscode.window.showWarningMessage(`只加进去 ${added} 道：其余的要么已经在清单里，要么这张单子到 ${MAX_PRACTICE_PROBLEMS} 题的上限了。`);
			}
			const saved = await saveList(next);
			if (!saved) { return; }
			current = saved;
			continue;
		}

		if (picked.action === 'minutes') {
			const raw = await vscode.window.showInputBox({
				title: `${current.name}：这一场多少分钟`,
				prompt: '改完「开始这一场」就按新的分钟数计时；留空表示不设时限。',
				value: current.minutes ? String(current.minutes) : '',
				placeHolder: '120',
				ignoreFocusOut: true,
				validateInput: validateMinutes,
			});
			if (raw === undefined) { continue; }
			const saved = await saveList({ ...current, minutes: parseMinutes(raw) });
			if (!saved) { return; }
			current = saved;
			continue;
		}

		if (picked.action === 'remove') {
			if (current.problems.length === 1) {
				// 空清单读回来会被丢掉：让「删整份」走它自己的那条路，别在这里悄悄消失。
				void vscode.window.showWarningMessage(`${current.name} 只剩一道题了：移掉就成空清单。想删整份单子请选「删掉这份清单」。`);
				continue;
			}
			const target = await vscode.window.showQuickPick(
				current.problems.map(id => ({ label: id })),
				{ title: `从「${current.name}」里移掉哪一道`, placeHolder: '移掉只改这份单子，题面和做题记录都不动', ignoreFocusOut: true }
			);
			if (!target) { continue; }
			const saved = await saveList(withoutProblem(current, target.label));
			if (!saved) { return; }
			current = saved;
			continue;
		}

		if (picked.problemId) {
			await openOrPull(picked.problemId, root, cached);
			return;
		}
	}
}

async function showPracticeLists(): Promise<void> {
	const lists = await readLists();
	const marks = await solvedMarks();
	const picks: PracticePick[] = [
		...lists.map(list => ({
			label: list.name,
			description: `${list.problems.length} 题 · 已 AC ${acCount(list, marks)}`,
			detail: list.minutes ? `一场 ${list.minutes} 分钟` : '不设时限',
			list,
		})),
		{ label: '新建集训清单…', description: '名字 + 题号 + 时长，存进工程的 practice.json' },
	];
	const picked = await vscode.window.showQuickPick(picks, {
		title: lists.length ? `集训清单（${lists.length} 份）` : '集训清单',
		placeHolder: lists.length ? '选一份清单：开始这一场、逐题看题面，或者删掉它' : '还没有清单，起个名字建一份',
		matchOnDescription: true,
		matchOnDetail: true,
		ignoreFocusOut: true,
	});
	if (!picked) { return; }
	if (picked.list) {
		await showPractice(picked.list, marks);
		return;
	}
	const created = await createPracticeList();
	if (created) {
		await showPractice(created, await solvedMarks());
	}
}

/** 对拍抓到的那组数据传过来时带这些字段；从命令面板直接调用时一个都没有。 */
interface AppendSampleArgs {
	readonly hint?: string;
	readonly input?: string;
	readonly output?: string;
	readonly explain?: string;
}

/** 这道题的题面是不是正开着且有没保存的改动。 */
function hasUnsavedEdits(file: string): boolean {
	const wanted = file.toLowerCase();
	return vscode.workspace.textDocuments.some(doc => doc.isDirty && doc.uri.fsPath.toLowerCase() === wanted);
}

/**
 * 把一组样例写进题面。带参数是对拍在补它抓到的那组数据（期望输出取正解的输出）；
 * 不带参数是从命令面板来的，加一组空的占位样例并把文件打开让人填——
 * 题面就是本地那份可编辑的用例表，不需要再造一个只有 Olympia 认的格式。
 */
async function appendSample(args?: AppendSampleArgs): Promise<boolean> {
	const partial = (args?.input === undefined) !== (args?.output === undefined);
	if (partial) {
		vscode.window.showWarningMessage('补一组样例要同时给出输入和期望输出，只给一半没法写。');
		return false;
	}
	const manual = args?.input === undefined && args?.output === undefined;
	const root = await problemsRoot();
	if (!root) { return false; }
	const entries = await readLibrary(root);
	if (!entries.length) {
		vscode.window.showInformationMessage('题面库里还没有题面，样例没地方写。先按 Ctrl+Alt+P 拉一道题的题面。');
		return false;
	}
	const target = await pickTarget(entries, args?.hint, async list => {
		const picked = await vscode.window.showQuickPick(toPicks(list, vscode.workspace.workspaceFolders?.[0]?.uri.fsPath), {
			title: '这组样例补进哪道题',
			placeHolder: manual
				? `给题面库里的哪道题加一组样例（缓存了 ${list.length} 道）`
				: `当前文件没有同名题面，从题面库里挑一道（缓存了 ${list.length} 道）`,
			matchOnDescription: true,
			matchOnDetail: true,
			ignoreFocusOut: true,
		});
		return picked?.entry;
	});
	if (!target) { return false; }

	// 题面在编辑器里有没保存的改动时不能写磁盘：那份改动保存时会把刚补的样例盖掉
	if (hasUnsavedEdits(target.file)) {
		vscode.window.showWarningMessage(`「${target.id}」的题面在编辑器里有没保存的改动。先按 Ctrl+S 保存，再补样例。`);
		return false;
	}
	const markdown = await fs.promises.readFile(target.file, 'utf8');
	const added = appendSampleTo(markdown, manual
		? { input: '', output: '', explain: MANUAL_EXPLAIN }
		: { input: args?.input ?? '', output: args?.output ?? '', explain: args?.explain });
	await fs.promises.writeFile(target.file, added.markdown, 'utf8');
	if (manual) {
		// 加完就打开让人填，不弹一句「已添加」然后什么都不动
		await showStatement(vscode.Uri.file(target.file));
		return true;
	}
	const action = await vscode.window.showInformationMessage(
		`已把「样例 ${added.index}」写进 ${target.id} 的题面，下次跑样例会带上它。`,
		'打开题面',
	);
	if (action === '打开题面') {
		await showStatement(vscode.Uri.file(target.file));
	}
	return true;
}

/** 学生自己那份模板的位置；没打开工作区就没有。 */
function myTemplateFile(): vscode.Uri | undefined {
	const folder = vscode.workspace.workspaceFolders?.[0];
	return folder ? vscode.Uri.joinPath(folder.uri, TEMPLATE_FOLDER, TEMPLATE_FILE) : undefined;
}

/** 只有内容才算模板：新建出来还没填过的空文件不该被当成一份模板插进代码。 */
async function readMyTemplate(): Promise<string | undefined> {
	const file = myTemplateFile();
	if (!file) {
		return undefined;
	}
	try {
		const text = await fs.promises.readFile(file.fsPath, 'utf8');
		return text.trim() ? text : undefined;
	} catch {
		return undefined;
	}
}

/** 打开我的模板；没有就用 ACM 模板建一份，让学生改现成的而不是从空白开始。 */
async function editMyTemplate(): Promise<void> {
	const file = myTemplateFile();
	if (!file) {
		await vscode.window.showWarningMessage(`先打开一个文件夹，我的模板存在工程里的 ${TEMPLATE_FOLDER}/${TEMPLATE_FILE}。`);
		return;
	}
	if (!fs.existsSync(file.fsPath)) {
		await fs.promises.mkdir(path.dirname(file.fsPath), { recursive: true });
		await fs.promises.writeFile(file.fsPath, templateFor('acm'), 'utf8');
	}
	const doc = await vscode.workspace.openTextDocument(file);
	await vscode.window.showTextDocument(doc, { preview: false });
}

interface TemplateChoice {
	readonly label: string;
	readonly description?: string;
	readonly format?: ContestFormat;
	readonly mine?: boolean;
	readonly edit?: boolean;
}

async function insertTemplate(): Promise<void> {
	const my = await readMyTemplate();
	const formats = (Object.keys(FORMAT_LABEL) as ContestFormat[]).map(f => ({ label: FORMAT_LABEL[f], format: f }));
	const choices: TemplateChoice[] = [
		...(my ? [{ label: MY_TEMPLATE_LABEL, description: MY_TEMPLATE_HINT, mine: true }] : []),
		...formats,
		{ label: my ? '编辑我的模板…' : '新建我的模板（拿 ACM 模板打底）…', edit: true }
	];
	const picked = await vscode.window.showQuickPick(choices, {
		title: '选择赛制模板',
		placeHolder: my ? '我的模板排在最前面，直接回车就是用你自己那份' : '建一份你自己的模板，以后每次都省事',
		ignoreFocusOut: true,
	});
	if (!picked) { return; }
	if (picked.edit) {
		await editMyTemplate();
		return;
	}
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage('请先打开一个 C++ 文件。');
		return;
	}
	const body = picked.mine ? my : templateFor(picked.format ?? 'acm');
	if (!body) {
		await vscode.window.showWarningMessage('我的模板是空的，先填几行再插。');
		return;
	}
	await editor.edit(b => b.insert(editor.selection.active, body));
	vscode.window.showInformationMessage(
		picked.mine ? '已插入你的模板。不想用它了就按 Ctrl+Alt+T 选「编辑我的模板」。'
			: `已插入${picked.format === 'ioi' ? ' IOI' : ' ACM'} 赛制模板。`
	);
}

/**
 * 剪贴板里通常是整条链接（https://www.luogu.com.cn/problem/P1001），也可能就是裸题号。
 * detectPlatform 认域名，而 fetch* 只认题号，所以这里把 URL 折回题号，两边才对得上。
 */
function refFromClipboard(raw: string): { id: string; platform: Platform } | undefined {
	const text = raw.trim().split(/\s+/)[0];
	const platform = detectPlatform(text);
	if (!platform) {
		return undefined;
	}
	const segments = text.replace(/^[a-z]+:\/\//i, '').split(/[?#]/)[0].split('/').filter(s => s.length > 0);
	const last = segments[segments.length - 1] ?? text;
	const previous = segments[segments.length - 2];
	// Codeforces 的题号是 URL 最后两段拼出来的：/problemset/problem/1660/C → 1660C
	if (platform === 'codeforces' && previous && /^\d+$/.test(previous) && /^[A-Za-z]{1,2}$/.test(last)) {
		return { id: `${previous}${last.toUpperCase()}`, platform };
	}
	return { id: last, platform };
}

export function activate(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('olympia.problem.pull', async () => {
			const ref = await askProblemRef();
			if (ref) { await pullProblem(ref); }
		}),
		vscode.commands.registerCommand('olympia.problem.pullFromClipboard', async () => {
			const clip = await vscode.env.clipboard.readText();
			if (!clip.trim()) {
				vscode.window.showWarningMessage('剪贴板里没有内容。');
				return;
			}
			const ref = refFromClipboard(clip);
			if (ref) {
				await pullProblem(ref);
				return;
			}
			// 认不出来就退回输入框，但把剪贴板内容预填进去，别让人再敲一遍。
			const typed = await askProblemRef(clip.trim().slice(0, 80));
			if (typed) { await pullProblem(typed); }
		}),
		vscode.commands.registerCommand('olympia.template.insert', insertTemplate),
		// 面板和命令面板里给一条直达入口：想改模板的人不该先被问「插哪个模板」。
		vscode.commands.registerCommand('olympia.template.editMy', editMyTemplate),
		vscode.commands.registerCommand('olympia.problem.openStatement', openCached),
		vscode.commands.registerCommand('olympia.problem.appendSample', appendSample),
		vscode.commands.registerCommand('olympia.practice.open', showPracticeLists),
		vscode.commands.registerCommand('olympia.practice.new', async () => {
			const created = await createPracticeList();
			if (created) {
				await showPractice(created, await solvedMarks());
			}
		}),
	);

	context.subscriptions.push(registerCppSnippets());
}

export function deactivate(): void {
	// nothing to clean up
}
