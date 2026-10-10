/*---------------------------------------------------------------------------------------------
 *  Minimal HTTPS fetch for the contest helper. Node's https module only — the extension
 *  must not depend on anything that is not already in the Electron runtime, because
 *  competition machines are frequently offline except for the judge sites.
 *
 *  Cookie handling matters: 洛谷 answers the first request with `302 -> same URL` plus a
 *  `C3VK` cookie. A browser retries with that cookie and gets the page; a naive client
 *  loops until it is redirected forever. So cookies are collected per request chain and
 *  replayed on the next hop.
 *--------------------------------------------------------------------------------------------*/
import * as https from 'https';
import * as http from 'http';
import type { ClientRequest } from 'http';

export interface FetchResult {
	status: number;
	body: string;
	finalUrl: string;
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) '
	+ 'Chrome/124.0 Safari/537.36 OlympiaIDE/1.140';

const MAX_HOPS = 4;

function readCookieHeader(res: http.IncomingMessage): string {
	const raw = res.headers['set-cookie'];
	if (!raw) { return ''; }
	const list = Array.isArray(raw) ? raw : [raw];
	const jar = new Map<string, string>();
	for (const c of list) {
		const [pair] = c.split(';');
		const eq = pair.indexOf('=');
		if (eq > 0) { jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim()); }
	}
	return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
}

function mergeCookies(jar: string, incoming: string): string {
	const map = new Map<string, string>();
	for (const part of [...jar.split(';'), ...incoming.split(';')]) {
		const s = part.trim();
		const eq = s.indexOf('=');
		if (eq > 0) { map.set(s.slice(0, eq), s.slice(eq + 1)); }
	}
	return [...map].map(([k, v]) => `${k}=${v}`).join('; ');
}

export async function fetchText(
	url: string,
	timeoutMs = 15000,
	extraHeaders: Record<string, string> = {},
): Promise<FetchResult> {
	let current = url;
	let jar = '';

	for (let hop = 0; hop < MAX_HOPS; hop++) {
		const res = await oneHop(current, jar, timeoutMs, extraHeaders);

		const setCookie = readCookieHeader(res.raw);
		if (setCookie) { jar = mergeCookies(jar, setCookie); }

		const location = res.raw.headers.location;
		if (res.status >= 300 && res.status < 400 && location) {
			current = new URL(location, current).toString();
			continue;
		}
		if (res.status >= 400) {
			throw new Error(`请求失败 HTTP ${res.status}：${current}`);
		}
		return { status: res.status, body: res.body, finalUrl: current };
	}

	throw new Error(`重定向次数过多，已放弃：${url}`);
}

function oneHop(
	url: string,
	cookie: string,
	timeoutMs: number,
	extraHeaders: Record<string, string>,
): Promise<{ status: number; body: string; raw: http.IncomingMessage }> {
	return new Promise((resolve, reject) => {
		let settled = false;
		let timer: NodeJS.Timeout | undefined;
		let req: ClientRequest | undefined;

		const done = (err: Error | null, res?: { status: number; body: string; raw: http.IncomingMessage }) => {
			if (settled) { return; }
			settled = true;
			if (timer) { clearTimeout(timer); }
			err ? reject(err) : resolve(res!);
		};

		// Wall-clock deadline. `req.setTimeout` only fires on socket inactivity, so a site
		// that trickles bytes forever would hang the command indefinitely.
		timer = setTimeout(() => {
			try { req?.destroy(); } catch { /* already gone */ }
			done(new Error(`请求超时（${timeoutMs} ms）：${url}`));
		}, timeoutMs);

		let parsed: URL;
		try { parsed = new URL(url); } catch { done(new Error(`URL 无效: ${url}`)); return; }

		const mod = parsed.protocol === 'http:' ? http : https;
		req = mod.request(
			parsed,
			{
				method: 'GET',
				headers: {
					'User-Agent': UA,
					'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
					'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
					// identity avoids a gzipped body we would have to inflate by hand
					'Accept-Encoding': 'identity',
					'Sec-Fetch-Dest': 'document',
					'Sec-Fetch-Mode': 'navigate',
					'Sec-Fetch-Site': 'none',
					...(cookie ? { Cookie: cookie } : {}),
					...extraHeaders,
				},
			},
			res => {
				const chunks: Buffer[] = [];
				res.on('data', (c: Buffer) => chunks.push(c));
				res.on('end', () => done(null, {
					status: res.statusCode ?? 0,
					body: Buffer.concat(chunks).toString('utf8'),
					raw: res,
				}));
				res.on('error', (e: Error) => done(e));
			},
		);

		req.on('error', (e: Error) => done(e));
		req.end();
	});
}
