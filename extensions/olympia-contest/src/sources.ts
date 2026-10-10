/*---------------------------------------------------------------------------------------------
 *  Problem sources: 洛谷 / Codeforces / AtCoder.
 *
 *  Everything here was written against the live sites (build/debug-contest-fetch.mjs).
 * The shapes below are the ones those sites actually return today, not the ones the old
 * VS Code docs imply:
 *
 *  - 洛谷 embeds its whole data model as JSON in `<script id="lentille-context">`. The
 *    statement lives under `data.problem.contenu.{description,formatI,formatO,hint}` —
 *    NOT under `description`/`inputFormat` on the problem itself — and is already
 *    Markdown, so there is no lossy HTML round-trip. `samples` is an array of tuples
 *    `[input, output, explain?]`, `limits` is `{time:[ms], memory:[KB]}` per test point,
 *    and `tags` holds numeric tag ids with no name table on the page, so we omit them
 *    rather than print raw ids.
 *    The site answers the first request with `302 -> same URL` + a `C3VK` cookie; net.ts
 *    replays it, which is why this works at all.
 *
 *  - Codeforces puts Cloudflare "Just a moment..." managed challenge in front of the
 *    HTML pages (verified: `cf-mitigated: challenge`), so statement text cannot be
 *    fetched programmatically. Their JSON API is NOT behind the challenge, so we use it
 *    for metadata and hand the statement to the browser.
 *
 *  - AtCoder serves plain HTML shaped as a flat list of
 *    `<div class="part"><section><h3>heading</h3>…</section></div>` blocks. The page carries
 *    the Japanese copy first (`<span class="lang-ja">`) and the English copy second
 *    (`<span class="lang-en">`), and the two are distinguishable by their HEADINGS rather than
 *    by any container: `問題文` / `入力例 1` vs `Problem Statement` / `Sample Input 1`. Samples
 *    are therefore matched by heading text instead of by scanning `io-style` — `io-style` only
 *    holds the Input/Output format blocks and never contains a sample at all.
 *--------------------------------------------------------------------------------------------*/
import { fetchText } from './net';
import { htmlToMarkdown, sliceByMarker, decodeEntities } from './html2md';

export type Platform = 'luogu' | 'codeforces' | 'atcoder';

export interface Sample {
	input: string;
	output: string;
	explain?: string;
}

export interface Problem {
	platform: Platform;
	id: string;
	title: string;
	url: string;
	statement: string;
	inputFormat: string;
	outputFormat: string;
	samples: Sample[];
	hint: string;
	tags: string[];
	difficulty?: string;
	contest?: string;
	timeLimit?: string;
	memoryLimit?: string;
	/** true when the statement body could not be fetched and only metadata is available */
	metadataOnly?: boolean;
}

export function detectPlatform(raw: string): Platform | undefined {
	const s = raw.trim();
	if (/^P\d{3,5}$/i.test(s) || /luogu|洛谷/i.test(s)) { return 'luogu'; }
	if (/^(cf)?\d{1,5}\s*[\/_]?\s*[A-Z]{0,2}$/i.test(s) || /codeforces/i.test(s)) { return 'codeforces'; }
	if (/^[A-Za-z]{3}\d{3}[_-][A-Za-z0-9]+$/i.test(s) || /atcoder/i.test(s)) { return 'atcoder'; }
	return undefined;
}

// ------------------------------------------------------------------ 洛谷

const LUOGU_DIFFICULTY = ['', '暂无评分', '入门', '普及-', '普及/提高-', '提高+/省选-', 'NOI/NOI+/CTSC'];

export async function fetchLuogu(id: string, timeoutMs: number): Promise<Problem> {
	const pid = id.toUpperCase().replace(/^LUOGU\s*/, '');
	if (!/^P\d{3,5}$/.test(pid)) {
		throw new Error('洛谷题号格式应为 P1001 这样。');
	}
	const url = `https://www.luogu.com.cn/problem/${pid}`;
	const { body } = await fetchText(url, timeoutMs);

	const m = /<script[^>]*id=["']lentille-context["'][^>]*>([\s\S]*?)<\/script>/i.exec(body);
	if (!m) { throw new Error('未能从洛谷页面读取数据（页面结构可能已变更）。'); }

	let ctx: any;
	try { ctx = JSON.parse(m[1]); } catch { throw new Error('洛谷页面数据解析失败。'); }

	const p = ctx?.data?.problem;
	if (!p) { throw new Error(`洛谷上找不到题目 ${pid}。`); }

	const c = p.contenu ?? {};
	const samples: Sample[] = (p.samples ?? [])
		.filter((s: any) => Array.isArray(s) && s.length >= 2)
		.map((s: any[]) => ({
			input: String(s[0] ?? '').replace(/^\n+|\n+$/g, ''),
			output: String(s[1] ?? '').replace(/^\n+|\n+$/g, ''),
			explain: s[2] ? String(s[2]).trim() : undefined,
		}));

	const time = p.limits?.time?.[0];
	const memKB = p.limits?.memory?.[0];

	return {
		platform: 'luogu',
		id: String(p.pid ?? pid),
		title: decodeEntities(String(p.name ?? pid)),
		url,
		statement: String(c.description ?? '').trim(),
		inputFormat: String(c.formatI ?? '').trim(),
		outputFormat: String(c.formatO ?? '').trim(),
		samples,
		hint: String(c.hint ?? '').trim(),
		// Luogu exposes tag ids only; printing them would be noise, so leave this empty.
		tags: [],
		difficulty: LUOGU_DIFFICULTY[p.difficulty] ?? '',
		timeLimit: typeof time === 'number' ? `${time} ms` : undefined,
		memoryLimit: typeof memKB === 'number' ? `${Math.round(memKB / 1024)} MB` : undefined,
	};
}

// -------------------------------------------------------------- Codeforces

interface CfProblem {
	contestId: number;
	index: string;
	name: string;
	type?: string;
	rating?: number;
	tags?: string[];
}

function parseCodeforcesRef(raw: string): { contestId: string; index: string } | undefined {
	const cleaned = raw.toUpperCase().replace(/^CODEFORCES\.?COM?\s*/i, '').replace(/^CF\s*/, '');
	const m = cleaned.match(/^(\d{3,5})\s*[\/_-]?\s*([A-Z]{1,2})$/);
	return m ? { contestId: m[1], index: m[2] || 'A' } : undefined;
}

export async function fetchCodeforces(id: string, timeoutMs: number, fetchMetadata = false): Promise<Problem> {
	const ref = parseCodeforcesRef(id);
	if (!ref) {
		throw new Error('Codeforces 题号请写成「场次编号+题号字母」，例如 1660C 或 1660/C。');
	}
	const url = `https://codeforces.com/contest/${ref.contestId}/problem/${ref.index}`;

	// Metadata comes from the official API, which is NOT behind Cloudflare. It is opt-in
	// because the only endpoint that reliably answers here is `problemset.problems` (~10 MB),
	// which turned a 2 s command into a 12 s one on a student connection.
	let meta: CfProblem | undefined;
	if (fetchMetadata) {
		const apiTries = [
			`https://codeforces.com/api/contest.standings?contestId=${ref.contestId}&from=1&count=5`,
			'https://codeforces.com/api/problemset.problems',
		];
		for (const api of apiTries) {
			try {
				const r = await fetchText(api, timeoutMs);
				const j = JSON.parse(r.body);
				const list: CfProblem[] = api.includes('standings')
					? (j?.result?.rows ?? []).map((x: any) => x.problem).filter(Boolean)
					: (j?.result?.problems ?? []);
				meta = list.find(
					(p: CfProblem) => String(p.contestId) === ref.contestId && String(p.index).toUpperCase() === ref.index,
				);
				if (meta) { break; }
			} catch {
				// try the next endpoint
			}
		}
	}

	// statement text is behind a Cloudflare managed challenge and cannot be fetched here
	let statement = '';
	let note = '';
	try {
		const r = await fetchText(url, timeoutMs, { Referer: 'https://codeforces.com/' });
		const inner = sliceByMarker(r.body, 'problem-statement', 'div');
		if (inner) { statement = htmlToMarkdown(inner); }
	} catch (err: any) {
		note = String(err?.message ?? err);
	}

	if (!statement) {
		note = note || 'Codeforces 的题面网页有 Cloudflare 人机校验，无法自动抓取。已附上题目信息与原题链接，点击即可在浏览器中查看。';
	}

	const samples: Sample[] = [];
	return {
		platform: 'codeforces',
		id: `${ref.contestId}${ref.index}`,
		title: meta ? decodeEntities(meta.name) : '',
		url,
		statement: statement || `_题面需在浏览器中打开：${url}_${note ? `\n\n> ${note}` : ''}`,
		inputFormat: '',
		outputFormat: '',
		samples,
		hint: '',
		tags: meta?.tags ?? [],
		difficulty: typeof meta?.rating === 'number' ? `${meta.rating}` : undefined,
		contest: ref.contestId,
		metadataOnly: !statement,
	};
}

// ----------------------------------------------------------------- AtCoder

/**
 * AtCoder lays every section out as `<div class="part"><section><h3>heading</h3>…</section></div>`
 * and renders the page twice — Japanese inside `<span class="lang-ja">` first, English inside
 * `<span class="lang-en">` after. The two copies are only distinguishable by their headings
 * (`問題文` vs `Problem Statement`), never by a stable container attribute, so we match on the
 * heading text and cut the block at the first `</section>`.
 */
function sectionAfter(html: string, headingPattern: RegExp): string {
	const m = headingPattern.exec(html);
	if (!m) { return ''; }
	const rest = html.slice(m.index + m[0].length);
	const end = rest.search(/<\/section>/i);
	return end < 0 ? rest : rest.slice(0, end);
}

/** first `<pre>` in a chunk, as plain text (samples must survive verbatim) */
function firstPreText(html: string): string {
	const m = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html);
	if (!m) { return ''; }
	return decodeEntities(m[1].replace(/<[^>]+>/g, '')).replace(/\r/g, '').replace(/^\n+|\n+$/g, '');
}

/** AtCoder serves every block twice (lang-ja first, lang-en second); match the English heading. */
function pickLangEn(block: string): string {
	const en = /<span class="lang-en">([\s\S]*?)<\/span>/i.exec(block);
	if (en) { return en[1]; }
	return block;
}

export async function fetchAtcoder(id: string, timeoutMs: number): Promise<Problem> {
	const cleaned = id.toUpperCase().replace(/^ATCODER\.?JP?\s*/i, '');
	const m = cleaned.match(/^([A-Z]{3}\d{3})[_-]([A-Z0-9]+)$/);
	if (!m) {
		throw new Error('AtCoder 题号请写成「比赛编号_题目编号」，例如 ABC300_A。');
	}
	const contest = m[1];
	const task = m[2];
	const url = `https://atcoder.jp/contests/${contest}/tasks/${contest}_${task}`;
	const { body } = await fetchText(url, timeoutMs);

	if (!/Problem Statement|Sample Input/i.test(body)) {
		throw new Error(`未能从 AtCoder 页面读取题面（${url}）。`);
	}

	const title = decodeEntities(
		(/<span class="lang-en">([\s\S]*?)<\/span>\s*<\/h1>/i.exec(body)?.[1]
			?? /<title>([\s\S]*?)<\/title>/i.exec(body)?.[1]
			?? `${contest}_${task}`).replace(/<[^>]+>/g, '').trim(),
	);

	// statement: the block headed "Problem Statement". The English heading text keeps us out of
	// the Japanese copy, so no lang-en/ja bookkeeping is needed here.
	const statementHtml = sectionAfter(body, /<h3>\s*Problem Statement\s*<\/h3>/i);

	// Input / Output format live in the `io-style` block and are plain English on this site.
	const inputFormat = sectionAfter(body, /<h3>\s*Input\s*<\/h3>/i);
	const outputFormat = sectionAfter(body, /<h3>\s*Output\s*<\/h3>/i);

	// Samples: each is its own `part` with a `Sample Input N` / `Sample Output N` heading, NOT
	// nested in `io-style` (which only holds the Input/Output format blocks). Pair them by index
	// rather than by document order, so a stray block between two samples cannot shift pairing.
	// The headings only appear in the English copy — the Japanese one says 入力例 N — so a
	// first-match lookup per index is enough to stay on the English half.
	const collect = (kind: 'Input' | 'Output') => {
		const map = new Map<number, string>();
		for (const mm of body.matchAll(new RegExp(`<h3>\\s*Sample ${kind}\\s+(\\d+)\\s*<\\/h3>`, 'gi'))) {
			const n = Number(mm[1]);
			if (map.has(n)) { continue; }
			const text = firstPreText(sectionAfter(body, new RegExp(`<h3>\\s*Sample ${kind}\\s+${n}\\s*<\\/h3>`, 'i')));
			if (text) { map.set(n, text); }
		}
		return map;
	};
	const inputs = collect('Input');
	const outputs = collect('Output');

	const samples: Sample[] = [];
	for (const n of [...inputs.keys()].sort((a, b) => a - b)) {
		const input = inputs.get(n);
		if (!input) { continue; }
		const outBlock = sectionAfter(body, new RegExp(`<h3>\\s*Sample Output\\s+${n}\\s*<\\/h3>`, 'i'));
		// everything after the <pre> in a Sample Output block is AtCoder's own explanation
		const explain = htmlToMarkdown(outBlock.replace(/<pre[^>]*>[\s\S]*?<\/pre>/i, '')).trim();
		samples.push({ input, output: outputs.get(n) ?? '', explain: explain || undefined });
	}

	return {
		platform: 'atcoder',
		id: `${contest}_${task}`,
		title,
		url,
		statement: htmlToMarkdown(pickLangEn(statementHtml)),
		inputFormat: inputFormat ? htmlToMarkdown(inputFormat) : '',
		outputFormat: outputFormat ? htmlToMarkdown(outputFormat) : '',
		samples,
		hint: '',
		// AtCoder problem pages carry no per-problem tag list — the sidebar links are contest
		// navigation, so leave tags empty rather than surfacing navigation as if it were metadata.
		tags: [],
		contest,
	};
}

export async function fetchProblem(id: string, platform: Platform, timeoutMs: number, fetchMetadata = false): Promise<Problem> {
	switch (platform) {
		case 'luogu': return fetchLuogu(id, timeoutMs);
		case 'codeforces': return fetchCodeforces(id, timeoutMs, fetchMetadata);
		case 'atcoder': return fetchAtcoder(id, timeoutMs);
	}
}