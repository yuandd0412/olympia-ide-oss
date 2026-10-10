/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  A very small HTML -> Markdown converter, scoped to what judge sites actually emit.
 *
 *  This is deliberately not a general converter: pulling in a DOM library would add a
 *  runtime dependency to a build that has to stay self-contained. It handles the tags
 *  Luogu / Codeforces / AtCoder use for statements and strips everything else.
 *--------------------------------------------------------------------------------------------*/

const ENTITIES: Record<string, string> = {
	amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ',
	hellip: '…', mdash: '—', ndash: '–', le: '≤', ge: '≥', times: '×', divide: '÷',
	minus: '−', prime: '′', middot: '·', larr: '←', rarr: '→', harr: '↔',
	alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', pi: 'π', sigma: 'σ', omega: 'ω',
	Sigma: 'Σ', Omega: 'Ω', infin: '∞', ne: '≠', leq: '≤', geq: '≥', sum: '∑',
	radic: '√', sub: '⊂', sup: '⊃', sube: '⊆', supe: '⊇', cap: '∩', cup: '∪',
};

export function decodeEntities(s: string): string {
	return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body: string) => {
		if (body[0] === '#') {
			const code = body[1] === 'x' || body[1] === 'X'
				? parseInt(body.slice(2), 16)
				: parseInt(body.slice(1), 10);
			return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : m;
		}
		return ENTITIES[body] ?? ENTITIES[body.toLowerCase()] ?? m;
	});
}

/** strip script/style entirely, then tags, keeping the text and the newlines we care about */
function strip(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, '')
		.replace(/<style[\s\S]*?<\/style>/gi, '')
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|li|tr|h[1-6]|pre)>/gi, '\n')
		.replace(/<li[^>]*>/gi, '- ')
		.replace(/<[^>]+>/g, '');
}

/** keep <pre> blocks as fenced code so samples survive verbatim */
function preserveCode(html: string): string {
	const out: string[] = [];
	let idx = 0;
	const re = /<pre[^>]*>([\s\S]*?)<\/pre>/gi;
	let m: RegExpExecArray | null;
	while ((m = re.exec(html)) !== null) {
		out.push(strip(html.slice(idx, m.index)));
		const code = decodeEntities(m[1].replace(/<[^>]+>/g, '')).replace(/\r/g, '').replace(/\n+$/, '');
		out.push(`\n@@CODE@@\n${code}\n@@CODE@@\n`);
		idx = m.index + m[0].length;
	}
	out.push(strip(html.slice(idx)));
	return out.join('');
}

function normalise(md: string): string {
	return md
		.replace(/\r/g, '')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.split('\n')
		.map(l => l.replace(/[ \t]{2,}/g, ' ').trimEnd())
		.join('\n')
		.trim();
}

export function htmlToMarkdown(html: string): string {
	if (!html) { return ''; }
	const withCode = preserveCode(html);
	const parts = withCode.split('@@CODE@@');
	const rebuilt = parts
		.map((p, i) => (i % 2 === 0 ? p : `\n\`\`\`\n${p.trim()}\n\`\`\`\n`))
		.join('');
	return normalise(decodeEntities(rebuilt));
}

/** grab the inner HTML of the first element matching a class/id substring */
export function sliceByMarker(html: string, marker: string, tagHint = 'div'): string {
	const re = new RegExp(`<${tagHint}[^>]*(?:class|id)=["'][^"']*${marker}[^"']*["'][^>]*>([\\s\\S]*?)</${tagHint}>`, 'i');
	const m = re.exec(html);
	return m ? m[1] : '';
}
