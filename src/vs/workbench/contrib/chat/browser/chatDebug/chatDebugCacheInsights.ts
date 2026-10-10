/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Heuristics engine for the Cache Explorer. Takes the raw diff between two
 * requests (A = previous, B = current) and produces an ordered list of
 * human-readable findings explaining *why* the prompt cache behaved the way
 * it did and what — if anything — can be done about it.
 *
 * The heuristics mirror how providers key prefix caches. The prompt renders
 * as `tools → system → messages`, and a byte change anywhere invalidates
 * everything after it. So findings are emitted in cache-key order: the first
 * non-OK finding is the earliest (and therefore the real) cache breaker.
 *
 * All functions are pure — no DOM, no services — so they can be unit tested
 * in isolation.
 */

import { safeIntl } from '../../../../../base/common/date.js';
import { localize } from '../../../../../nls.js';
import { CacheDiffKind, ICacheDiffResult, INormalizedMessage } from './chatDebugCacheDiff.js';

const numberFormatter = safeIntl.NumberFormat();

function fmt(n: number): string {
	return numberFormatter.value.format(n);
}

/** Severity of a single cache finding. Rendered as a codicon + color. */
export const enum CacheInsightSeverity {
	/** Expected, healthy behavior (e.g. new turn appended). */
	Ok = 'ok',
	/** Context that helps interpretation but isn't actionable. */
	Info = 'info',
	/** Suspicious but not definitively avoidable (e.g. likely expiration). */
	Warning = 'warning',
	/** An avoidable cache break the user should investigate. */
	Critical = 'critical',
}

/**
 * Coarse classification of what broke (or didn't break) the cache for one
 * request pair. Used for rail chips and cross-turn aggregation.
 */
export const enum CacheBreakCategory {
	/** Pure append or fully stable prefix — the cache behaved as designed. */
	Healthy = 'healthy',
	/** Prefix byte-identical but the cache still missed — TTL/eviction. */
	Expiration = 'expiration',
	Model = 'model',
	Tools = 'tools',
	System = 'system',
	Options = 'options',
	/** Conversation history rewritten or truncated in place. */
	History = 'history',
	/** Continuations and other pairs we can't classify. */
	Unknown = 'unknown',
}

/** One human-readable finding about the cache behavior of the current request. */
export interface ICacheInsight {
	readonly severity: CacheInsightSeverity;
	/** Short, scannable summary — doubles as the headline verdict for the first non-OK finding. */
	readonly title: string;
	/** Evidence: what exactly differs and by how much. */
	readonly detail?: string;
	/** Actionable guidance derived from how prefix caches work. */
	readonly hint?: string;
	/** Name of the Components entry this finding refers to (e.g. `system`, `tools`, `messages[7]`). */
	readonly component?: string;
	/** Break category this finding contributes to, for cross-turn aggregation. */
	readonly category?: CacheBreakCategory;
}

/** A request-option change, pre-formatted by the caller for display. */
export interface ICacheInsightOptionDelta {
	readonly key: string;
	readonly previousLabel: string;
	readonly currentLabel: string;
}

export interface ICacheInsightsInput {
	readonly aModel: string | undefined;
	readonly bModel: string | undefined;
	readonly aSystem: string | undefined;
	readonly bSystem: string | undefined;
	readonly aTools: string | undefined;
	readonly bTools: string | undefined;
	readonly aMessages: readonly INormalizedMessage[];
	readonly bMessages: readonly INormalizedMessage[];
	readonly diff: ICacheDiffResult;
	readonly optionsDiff: readonly ICacheInsightOptionDelta[];
	/** Cache hit percentage (0-100) reported for the current request. */
	readonly hitPct: number;
	/** Total input tokens reported for the current request (0 when unknown). */
	readonly inputTokens: number;
	/** Minutes elapsed between the start of the previous and the current request. */
	readonly minutesSincePrevious: number | undefined;
	/** True when the current request is a Responses API continuation (delta-only wire input). */
	readonly isContinuation: boolean;
	/** True when the previous request is a Responses API continuation. */
	readonly previousIsContinuation: boolean;
	/** False when message-level positional diffing is suppressed (either side is a continuation). */
	readonly compareInputMessages: boolean;
}

/** How two unequal strings relate to each other structurally. */
export const enum StringDivergenceShape {
	/** B is a strict suffix of A — leading bytes were removed. */
	LeadingRemoved = 'leadingRemoved',
	/** A is a strict suffix of B — bytes were prepended. */
	LeadingAdded = 'leadingAdded',
	/** B is a strict prefix of A — trailing bytes were removed. */
	TrailingRemoved = 'trailingRemoved',
	/** A is a strict prefix of B — bytes were appended. */
	TrailingAdded = 'trailingAdded',
	/** The change happens somewhere in the middle. */
	InnerEdit = 'innerEdit',
}

/** Maximum excerpt length captured for the changed region on each side. */
const CHANGED_EXCERPT_CAP = 120;

export interface IStringDivergence {
	readonly shape: StringDivergenceShape;
	/** Number of leading chars shared by both sides. */
	readonly commonPrefix: number;
	/** Number of trailing chars shared by both sides (disjoint from the prefix). */
	readonly commonSuffix: number;
	readonly aLength: number;
	readonly bLength: number;
	/** Excerpt of the changed region on the A side (capped). */
	readonly aChanged: string;
	/** Excerpt of the changed region on the B side (capped). */
	readonly bChanged: string;
}

/**
 * Locate where two strings diverge: the shared leading/trailing spans and
 * the changed region in between. Returns `undefined` when the strings are
 * equal. The common prefix and suffix never overlap, so
 * `commonPrefix + commonSuffix <= min(aLength, bLength)`.
 */
export function analyzeStringDivergence(a: string, b: string): IStringDivergence | undefined {
	if (a === b) {
		return undefined;
	}
	const aLength = a.length;
	const bLength = b.length;
	const minLength = Math.min(aLength, bLength);
	let commonPrefix = 0;
	while (commonPrefix < minLength && a.charCodeAt(commonPrefix) === b.charCodeAt(commonPrefix)) {
		commonPrefix++;
	}
	let commonSuffix = 0;
	while (commonSuffix < minLength - commonPrefix && a.charCodeAt(aLength - 1 - commonSuffix) === b.charCodeAt(bLength - 1 - commonSuffix)) {
		commonSuffix++;
	}

	let shape: StringDivergenceShape;
	if (commonPrefix === bLength && bLength < aLength) {
		shape = StringDivergenceShape.TrailingRemoved;
	} else if (commonPrefix === aLength && aLength < bLength) {
		shape = StringDivergenceShape.TrailingAdded;
	} else if (commonSuffix === bLength && bLength < aLength) {
		shape = StringDivergenceShape.LeadingRemoved;
	} else if (commonSuffix === aLength && aLength < bLength) {
		shape = StringDivergenceShape.LeadingAdded;
	} else {
		shape = StringDivergenceShape.InnerEdit;
	}

	return {
		shape,
		commonPrefix,
		commonSuffix,
		aLength,
		bLength,
		aChanged: a.substring(commonPrefix, aLength - commonSuffix).slice(0, CHANGED_EXCERPT_CAP),
		bChanged: b.substring(commonPrefix, bLength - commonSuffix).slice(0, CHANGED_EXCERPT_CAP),
	};
}

/** One-line human-readable description of a string divergence. */
export function describeStringDivergence(d: IStringDivergence): string {
	switch (d.shape) {
		case StringDivergenceShape.TrailingAdded:
			return localize('chatDebug.cache.div.appended', "已追加 {0} 个字符 - 之前的内容将作为共享前缀保留", fmt(d.bLength - d.aLength));
		case StringDivergenceShape.TrailingRemoved:
			return localize('chatDebug.cache.div.truncated', "已移除最后 {0} 个字符 - 剩余内容仍与之前的字节匹配", fmt(d.aLength - d.bLength));
		case StringDivergenceShape.LeadingAdded:
			return localize('chatDebug.cache.div.prepended', "前置了 {0} 个字符 - 此块不再以相同的字节开头", fmt(d.bLength - d.aLength));
		case StringDivergenceShape.LeadingRemoved:
			return localize('chatDebug.cache.div.leadingRemoved', "已前置 {0} 个字符 - 此块不再以相同的字节开头", fmt(d.aLength - d.bLength));
		case StringDivergenceShape.InnerEdit:
			return localize('chatDebug.cache.div.innerEdit', "已就地编辑 - 第一个差异出现在字符 {0} 处({1} 个前导字符和 {2} 个尾随字符未更改)", fmt(d.commonPrefix), fmt(d.commonPrefix), fmt(d.commonSuffix));
	}
}

/** Categories of volatile values that classically break prompt caches. */
export const enum VolatileValueKind {
	Timestamp = 'timestamp',
	Uuid = 'uuid',
	Counter = 'counter',
}

interface IVolatilePattern {
	readonly kind: VolatileValueKind;
	readonly re: RegExp;
}

const VOLATILE_PATTERNS: readonly IVolatilePattern[] = [
	{ kind: VolatileValueKind.Uuid, re: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/ },
	{ kind: VolatileValueKind.Timestamp, re: /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?\b/ },
	{ kind: VolatileValueKind.Timestamp, re: /\b\d{1,2}:\d{2}:\d{2}\b/ },
	{ kind: VolatileValueKind.Counter, re: /\b\d{10,13}\b/ },
];

/**
 * Detect whether the changed region on both sides carries the *same kind* of
 * volatile value (timestamp, UUID, epoch-like counter) with *different*
 * contents — the classic silent cache invalidator: `datetime.now()` or a
 * request id interpolated into the prompt.
 */
export function detectVolatileValue(aChanged: string, bChanged: string): VolatileValueKind | undefined {
	for (const { kind, re } of VOLATILE_PATTERNS) {
		const aMatch = re.exec(aChanged)?.[0];
		const bMatch = re.exec(bChanged)?.[0];
		if (aMatch !== undefined && bMatch !== undefined && aMatch !== bMatch) {
			return kind;
		}
	}
	return undefined;
}

/** Context kept around the changed region when scanning for volatile values. */
const VOLATILE_CONTEXT = 24;
/** Cap on the scanned window so huge edits stay cheap to regex. */
const VOLATILE_WINDOW_CAP = 240;

/**
 * Run volatile-value detection on a window *around* the changed region of
 * each side. The shared prefix often eats the head of a volatile value
 * (`09:15:00` vs `09:21:42` diverges after `09:`), so matching only the
 * changed bytes would miss the pattern; the surrounding context restores it.
 * Identical values inside the context (e.g. the same date on both sides)
 * are ignored because {@link detectVolatileValue} requires the matched
 * values to differ.
 */
function detectVolatileValueAround(a: string, b: string, dv: IStringDivergence): VolatileValueKind | undefined {
	const start = Math.max(0, dv.commonPrefix - VOLATILE_CONTEXT);
	const aWindow = a.substring(start, Math.min(dv.aLength - dv.commonSuffix + VOLATILE_CONTEXT, start + VOLATILE_WINDOW_CAP));
	const bWindow = b.substring(start, Math.min(dv.bLength - dv.commonSuffix + VOLATILE_CONTEXT, start + VOLATILE_WINDOW_CAP));
	return detectVolatileValue(aWindow, bWindow);
}

function volatileValueLabel(kind: VolatileValueKind): string {
	switch (kind) {
		case VolatileValueKind.Timestamp: return localize('chatDebug.cache.volatile.timestamp', "时间戳");
		case VolatileValueKind.Uuid: return localize('chatDebug.cache.volatile.uuid', "唯一 ID (UUID)");
		case VolatileValueKind.Counter: return localize('chatDebug.cache.volatile.counter', "较大的变化数字");
	}
}

/** Structured comparison of two JSON tool catalogs. */
export interface IToolCatalogDelta {
	readonly added: readonly string[];
	readonly removed: readonly string[];
	/** Tools present on both sides whose definition bytes differ. */
	readonly modified: readonly string[];
	/** True when the set and every definition match — only the order differs. */
	readonly reorderedOnly: boolean;
	readonly aCount: number;
	readonly bCount: number;
}

function parseToolList(toolsJson: string | undefined): Map<string, string> | undefined {
	if (!toolsJson) {
		return undefined;
	}
	let raw: unknown;
	try {
		raw = JSON.parse(toolsJson);
	} catch {
		return undefined;
	}
	if (!Array.isArray(raw)) {
		return undefined;
	}
	const out = new Map<string, string>();
	for (let i = 0; i < raw.length; i++) {
		const item = raw[i] as { name?: unknown; type?: unknown; function?: { name?: unknown } } | null;
		const name =
			(item && typeof item.name === 'string' && item.name) ||
			(item && item.function && typeof item.function.name === 'string' && item.function.name) ||
			(item && typeof item.type === 'string' && item.type) ||
			`#${i}`;
		let serialized: string;
		try {
			serialized = JSON.stringify(item);
		} catch {
			serialized = String(item);
		}
		// Collisions (duplicate names) concatenate so a duplicated entry still
		// reads as a modification rather than silently matching.
		out.set(name, (out.get(name) ?? '') + serialized);
	}
	return out;
}

/**
 * Compare two tool catalogs at the tool level: which tools were added,
 * removed, or had their definition change — or whether the catalog was
 * merely reordered (same tools, same bytes, different order). Returns
 * `undefined` when either side isn't a parseable JSON array, in which case
 * callers should fall back to byte-level divergence.
 */
export function analyzeToolCatalog(aTools: string | undefined, bTools: string | undefined): IToolCatalogDelta | undefined {
	const a = parseToolList(aTools);
	const b = parseToolList(bTools);
	if (!a || !b) {
		return undefined;
	}
	const added: string[] = [];
	const removed: string[] = [];
	const modified: string[] = [];
	for (const [name, def] of b) {
		const aDef = a.get(name);
		if (aDef === undefined) {
			added.push(name);
		} else if (aDef !== def) {
			modified.push(name);
		}
	}
	for (const name of a.keys()) {
		if (!b.has(name)) {
			removed.push(name);
		}
	}
	return {
		added,
		removed,
		modified,
		reorderedOnly: added.length === 0 && removed.length === 0 && modified.length === 0,
		aCount: a.size,
		bCount: b.size,
	};
}

const severityRank: Record<CacheInsightSeverity, number> = {
	[CacheInsightSeverity.Ok]: 0,
	[CacheInsightSeverity.Info]: 1,
	[CacheInsightSeverity.Warning]: 2,
	[CacheInsightSeverity.Critical]: 3,
};

/** The highest severity present in a findings list (Ok when empty). */
export function maxInsightSeverity(insights: readonly ICacheInsight[]): CacheInsightSeverity {
	let max = CacheInsightSeverity.Ok;
	for (const i of insights) {
		if (severityRank[i.severity] > severityRank[max]) {
			max = i.severity;
		}
	}
	return max;
}

/** The first warning-or-worse finding — the headline verdict. */
export function primaryInsight(insights: readonly ICacheInsight[]): ICacheInsight | undefined {
	return insights.find(i => i.severity === CacheInsightSeverity.Critical)
		?? insights.find(i => i.severity === CacheInsightSeverity.Warning);
}

/** Cache hit below this is treated as "the cache effectively missed". */
const EFFECTIVE_MISS_PCT = 1;
/** Typical provider prompt-cache TTL, used in the expiration hint. */
const TYPICAL_TTL_MINUTES = 5;
/**
 * Most providers only walk back a bounded number of content blocks to find
 * a prior cache entry (~20 on Anthropic); appending more than this in one
 * turn can silently miss the cache.
 */
const LOOKBACK_WINDOW_BLOCKS = 20;
/**
 * Upper bound of the per-model minimum cacheable prefix size (1,024-4,096
 * tokens depending on model). Prompts below this may silently never cache.
 */
const MIN_CACHEABLE_TOKENS = 4096;

/**
 * Produce the ordered findings list for an A→B request comparison.
 *
 * Findings are emitted in provider cache-key order (model, tools, system,
 * options, messages) so the first critical finding is the earliest byte
 * change — the one that actually broke the cache; later changes are
 * recomputed regardless.
 */
export function computeCacheInsights(input: ICacheInsightsInput): ICacheInsight[] {
	const out: ICacheInsight[] = [];
	const modelChanged = input.aModel !== input.bModel;
	const toolsChanged = (input.aTools ?? '') !== (input.bTools ?? '');
	const systemChanged = (input.aSystem ?? '') !== (input.bSystem ?? '');

	if (modelChanged) {
		out.push({
			severity: CacheInsightSeverity.Critical,
			title: localize('chatDebug.cache.insight.model.title', "模型已更改"),
			detail: localize('chatDebug.cache.insight.model.detail', "{0} → {1}", input.aModel ?? '—', input.bModel ?? '—'),
			hint: localize('chatDebug.cache.insight.model.hint', "提示缓存的范围限定为模型 - 切换模型会重新计算整个提示。通过单独的请求链路由需要不同模型的子任务，这样，主循环就能保留其缓存。"),
			category: CacheBreakCategory.Model,
		});
	}

	if (toolsChanged) {
		out.push(toolsInsight(input.aTools, input.bTools));
	}

	if (systemChanged) {
		out.push(systemInsight(input.aSystem, input.bSystem));
	}

	if (input.optionsDiff.length > 0) {
		out.push({
			severity: CacheInsightSeverity.Warning,
			title: localize('chatDebug.cache.insight.options.title', "请求选项已更改"),
			detail: input.optionsDiff.map(d => `${d.key}: ${d.previousLabel} → ${d.currentLabel}`).join(' · '),
			hint: localize('chatDebug.cache.insight.options.hint', "大多数提供程序会将选项视为缓存键的一部分。当缓存复用很重要时，请使每个请求的选项保持稳定。"),
			category: CacheBreakCategory.Options,
		});
	}

	if (input.compareInputMessages) {
		out.push(...messageInsights(input, modelChanged || toolsChanged || systemChanged));
		if (!modelChanged && !toolsChanged && !systemChanged && input.optionsDiff.length === 0 && !input.diff.break) {
			out.push(stablePrefixInsight(input));
		}
	} else if (input.isContinuation) {
		out.push({
			severity: CacheInsightSeverity.Info,
			title: localize('chatDebug.cache.insight.continuation.title', "响应 API 续传"),
			detail: localize('chatDebug.cache.insight.continuation.detail', "此请求只捕获线路增量；先前上下文由 previous_response_id 引用，并在提供程序端重建。分析仅限于系统、工具和请求选项。"),
			category: CacheBreakCategory.Unknown,
		});
	} else if (input.previousIsContinuation) {
		out.push({
			severity: CacheInsightSeverity.Info,
			title: localize('chatDebug.cache.insight.prevContinuation.title', "已抑制消息比较"),
			detail: localize('chatDebug.cache.insight.prevContinuation.detail', "上一个请求是 Responses API 的延续(仅增量线路输入)；如果将此完整请求与其做位置差异对比，会得出错误结论。"),
			category: CacheBreakCategory.Unknown,
		});
	}

	return out;
}

function toolsInsight(aTools: string | undefined, bTools: string | undefined): ICacheInsight {
	const delta = analyzeToolCatalog(aTools, bTools);
	const component = 'tools';
	if (delta?.reorderedOnly) {
		return {
			severity: CacheInsightSeverity.Critical,
			title: localize('chatDebug.cache.insight.toolsReorder.title', "工具定义已重新排序"),
			detail: localize('chatDebug.cache.insight.toolsReorder.detail', "具有相同定义的相同 {0} 工具，按不同顺序发送。", fmt(delta.bCount)),
			hint: localize('chatDebug.cache.insight.toolsReorder.hint', "工具会在提示的最开头呈现 - 仅仅重新排序仍会更改字节并使整个缓存失效。请以确定性方式序列化工具列表(例如按名称排序)。"),
			component,
			category: CacheBreakCategory.Tools,
		};
	}
	if (delta && (delta.added.length > 0 || delta.removed.length > 0)) {
		const parts: string[] = [];
		if (delta.added.length > 0) {
			parts.push(localize('chatDebug.cache.insight.toolsAdded', "已添加: {0}", delta.added.join(', ')));
		}
		if (delta.removed.length > 0) {
			parts.push(localize('chatDebug.cache.insight.toolsRemoved', "已移除: {0}", delta.removed.join(', ')));
		}
		if (delta.modified.length > 0) {
			parts.push(localize('chatDebug.cache.insight.toolsModified', "已修改: {0}", delta.modified.join(', ')));
		}
		return {
			severity: CacheInsightSeverity.Critical,
			title: localize('chatDebug.cache.insight.toolsSet.title', "工具目录已更改({0} → {1} 个工具)", fmt(delta.aCount), fmt(delta.bCount)),
			detail: parts.join(' · '),
			hint: localize('chatDebug.cache.insight.toolsSet.hint', "工具定义会先于其他所有内容呈现，因此在会话中添加或移除工具会使整个提示失效。在会话期间使工具集保持稳定，或使用延迟/追加式工具加载，而不是替换工具目录。"),
			component,
			category: CacheBreakCategory.Tools,
		};
	}
	if (delta && delta.modified.length > 0) {
		return {
			severity: CacheInsightSeverity.Critical,
			title: localize('chatDebug.cache.insight.toolsDef.title', "工具定义已修改"),
			detail: localize('chatDebug.cache.insight.toolsDef.detail', "已更改: {0}", delta.modified.join(', ')),
			hint: localize('chatDebug.cache.insight.toolsDef.hint', "更改工具说明或架构会从工具块开始重写提示。请检查工具说明中的动态内容(计数、路径、时间戳)。"),
			component,
			category: CacheBreakCategory.Tools,
		};
	}
	// Not parseable as JSON arrays — fall back to byte-level divergence.
	const dv = analyzeStringDivergence(aTools ?? '', bTools ?? '');
	return {
		severity: CacheInsightSeverity.Critical,
		title: localize('chatDebug.cache.insight.tools.title', "工具目录已更改"),
		detail: dv ? describeStringDivergence(dv) : undefined,
		hint: localize('chatDebug.cache.insight.tools.hint', "工具目录是提示的第一个块 - 此处的任何字节更改都会使整个缓存失效。"),
		component,
		category: CacheBreakCategory.Tools,
	};
}

function systemInsight(aSystem: string | undefined, bSystem: string | undefined): ICacheInsight {
	const dv = analyzeStringDivergence(aSystem ?? '', bSystem ?? '');
	const volatile = dv ? detectVolatileValueAround(aSystem ?? '', bSystem ?? '', dv) : undefined;
	return {
		severity: CacheInsightSeverity.Critical,
		title: localize('chatDebug.cache.insight.system.title', "系统提示已更改"),
		detail: dv
			? localize('chatDebug.cache.insight.system.detail', "{0} → {1} 个字符 · {2}", fmt(dv.aLength), fmt(dv.bLength), describeStringDivergence(dv))
			: undefined,
		hint: volatile
			? localize('chatDebug.cache.insight.system.volatileHint', "更改后的区域看起来像是 {0} - 插入到系统提示中的易变值会在每次请求时中断缓存。请将动态内容移到对话历史记录之后或将其删除。", volatileValueLabel(volatile))
			: localize('chatDebug.cache.insight.system.hint', "系统提示更改会使工具块之后的所有内容失效。请在会话生命周期内使系统提示的字节保持稳定，并将每轮上下文注入最新消息中。"),
		component: 'system',
		category: CacheBreakCategory.System,
	};
}

function messageInsights(input: ICacheInsightsInput, hasEarlierBreak: boolean): ICacheInsight[] {
	const { diff } = input;
	if (!diff.break) {
		return [];
	}
	const out: ICacheInsight[] = [];
	const idx = diff.break.index;
	const component = `messages[${idx}]`;
	const counts = diff.counts;

	if (diff.break.kind === CacheDiffKind.OnlyInB) {
		// The first divergence is a message appended past the end of the
		// previous request — the healthy growth pattern. (A positional zip
		// can only report OnlyInB as the *first* divergence when everything
		// before it was identical.)
		out.push({
			// Downgrade to Info when an earlier tier already broke the cache:
			// the append is still fine, but it isn't the story of this request.
			severity: hasEarlierBreak ? CacheInsightSeverity.Info : CacheInsightSeverity.Ok,
			title: localize('chatDebug.cache.insight.append.title', "已追加新消息 - 预期增长"),
			detail: localize('chatDebug.cache.insight.append.detail', "在 {1} 之后新增的 {0} 条消息未更改 - 共享前缀已扩展，未中断。未缓存的令牌是写入缓存以供下一次请求使用的新后缀。", fmt(counts.onlyInB), fmt(counts.identical)),
			component,
			category: CacheBreakCategory.Healthy,
		});
		// Cache lookback window: providers walk back a bounded number of
		// content blocks (~20) to find a prior cache entry. A single turn
		// that appends more than that can miss the previous entry even
		// though the prefix is byte-identical.
		if (counts.onlyInB > LOOKBACK_WINDOW_BLOCKS) {
			out.push({
				severity: CacheInsightSeverity.Warning,
				title: localize('chatDebug.cache.insight.lookback.title', "已追加 {0} 个块 - 超出了典型的缓存回溯窗口", fmt(counts.onlyInB)),
				detail: localize('chatDebug.cache.insight.lookback.detail', "提供程序通常会回溯约 {0} 个内容块，以查找先前的缓存条目；即使前缀匹配，追加更多内容的轮次也可能遗漏该条目，而没有任何提示。", LOOKBACK_WINDOW_BLOCKS),
				hint: localize('chatDebug.cache.insight.lookback.hint', "在长时间的工具循环中，每隔约 15 个块放置一个中间缓存断点，这样，下一个请求仍然能够找到缓存条目。"),
			});
		}
		return out;
	}

	if (diff.break.kind === CacheDiffKind.OnlyInA) {
		out.push({
			severity: CacheInsightSeverity.Critical,
			title: localize('chatDebug.cache.insight.truncated.title', "历史记录已在消息[{0}]处截断", idx),
			detail: localize('chatDebug.cache.insight.truncated.detail', "上一个请求中存在的 {0} 条消息在此请求中缺失。", fmt(counts.onlyInA)),
			hint: localize('chatDebug.cache.insight.truncated.hint', "历史切片或压缩会缩短前缀 - 缓存只能匹配到截断位置，之后的所有内容都会重新计算。"),
			component,
			category: CacheBreakCategory.History,
		});
		return out;
	}

	// In-place change (content drift or length change) inside shared history.
	const tok = diff.signature.find(t => t.index === idx);
	const role = tok?.bRole ?? tok?.aRole ?? 'message';
	const aMsg = input.aMessages[idx];
	const bMsg = input.bMessages[idx];
	const dv = aMsg && bMsg ? analyzeStringDivergence(aMsg.text, bMsg.text) : undefined;
	const volatile = dv && aMsg && bMsg ? detectVolatileValueAround(aMsg.text, bMsg.text, dv) : undefined;
	const detailParts: string[] = [];
	if (aMsg && bMsg) {
		detailParts.push(localize('chatDebug.cache.insight.drift.sizes', "{0} 条消息， {1} → {2} 个字符", role, fmt(aMsg.charLength), fmt(bMsg.charLength)));
	}
	if (dv) {
		detailParts.push(describeStringDivergence(dv));
	}
	out.push({
		severity: CacheInsightSeverity.Critical,
		title: localize('chatDebug.cache.insight.drift.title', "历史记录已在消息[{0}]处重写", idx),
		detail: detailParts.join(' · '),
		hint: volatile
			? localize('chatDebug.cache.insight.drift.volatileHint', "更改后的区域看起来像 {0} - 一个重新呈现到对话历史记录中的易变值会在每次请求时中断前缀。", volatileValueLabel(volatile))
			: localize('chatDebug.cache.insight.drift.hint', "若要重复使用缓存的前缀，请求之间会话历史记录的字节必须相同。重新序列化的 {0} 个轮次(去掉空白、删除推理或前导文本、重新格式化工具调用)会使其后面的所有内容失效，而没有任何提示。", role),
		component,
		category: CacheBreakCategory.History,
	});

	const changedAfterBreak = counts.contentDrift + counts.lengthChange + counts.onlyInA + counts.onlyInB - 1;
	if (changedAfterBreak > 0) {
		out.push({
			severity: CacheInsightSeverity.Info,
			title: localize('chatDebug.cache.insight.afterBreak.title', "中断后还有 {0} 个位置发生更改", fmt(changedAfterBreak)),
			detail: localize('chatDebug.cache.insight.afterBreak.detail', "一旦前缀在消息[{0}]处中断，之后的所有内容都会重新计算 - 请先修复第一个中断。", idx),
		});
	}
	return out;
}

function stablePrefixInsight(input: ICacheInsightsInput): ICacheInsight {
	if (input.hitPct < EFFECTIVE_MISS_PCT) {
		// Byte-identical prefix, nothing changed, yet ~0% served from cache.
		// Two candidate explanations we can tell apart from the data we have:
		// a prompt below the provider's minimum cacheable prefix size never
		// caches at all; otherwise the entry almost certainly expired or was
		// evicted. We can't observe the provider cache directly, so both
		// stay "likely"/"may".
		if (input.inputTokens > 0 && input.inputTokens < MIN_CACHEABLE_TOKENS) {
			return {
				severity: CacheInsightSeverity.Warning,
				title: localize('chatDebug.cache.insight.tooSmall.title', "提示可能低于可缓存的最小大小"),
				detail: localize('chatDebug.cache.insight.tooSmall.detail', "{0} 个输入令牌 - 提供程序只会缓存超过最小前缀大小的提示(大约为 1,024-4,096 个令牌，具体取决于模型)，较小的提示不会缓存，而且没有任何提示。", fmt(input.inputTokens)),
				hint: localize('chatDebug.cache.insight.tooSmall.hint', "较小的实用工具请求(标题、摘要)通常低于阈值；这类请求的命中率为 0% 是正常现象，无需优化。"),
				category: CacheBreakCategory.Expiration,
			};
		}
		const minutes = input.minutesSincePrevious;
		const gap = minutes !== undefined && minutes >= 1
			? localize('chatDebug.cache.insight.expired.gap', "  距上次请求已过去 {0} 分钟。", fmt(Math.round(minutes)))
			: '';
		return {
			severity: CacheInsightSeverity.Warning,
			title: localize('chatDebug.cache.insight.expired.title', "缓存可能已过期"),
			detail: localize('chatDebug.cache.insight.expired.detail', "提示与上一个请求的字节完全相同，但只有 {0}% 由缓存提供。{1}", input.hitPct.toFixed(2), gap),
			hint: localize('chatDebug.cache.insight.expired.hint', "提供程序提示缓存会在处于非活动状态几分钟后过期(通常约为 {0} 分钟)。若两次请求之间间隔的时间较长，即使未进行任何更改，也会重新计算完整提示。", TYPICAL_TTL_MINUTES),
			category: CacheBreakCategory.Expiration,
		};
	}
	return {
		severity: CacheInsightSeverity.Ok,
		title: localize('chatDebug.cache.insight.stable.title', "提示前缀完全稳定"),
		detail: localize('chatDebug.cache.insight.stable.detail', "未检测到差异 - {0}% 的输入令牌由缓存提供。", input.hitPct.toFixed(2)),
		category: CacheBreakCategory.Healthy,
	};
}

/** Resolve the break category for one request pair from its findings. */
export function categorizeCacheBreak(insights: readonly ICacheInsight[]): CacheBreakCategory {
	const primary = primaryInsight(insights);
	if (primary?.category) {
		return primary.category;
	}
	for (const i of insights) {
		if (i.category) {
			return i.category;
		}
	}
	return CacheBreakCategory.Unknown;
}

/** Human-readable label for a break category. */
export function cacheBreakCategoryLabel(category: CacheBreakCategory): string {
	switch (category) {
		case CacheBreakCategory.Healthy: return localize('chatDebug.cache.category.healthy', "正常增长");
		case CacheBreakCategory.Expiration: return localize('chatDebug.cache.category.expiration', "到期/不可缓存");
		case CacheBreakCategory.Model: return localize('chatDebug.cache.category.model', "模型已更改");
		case CacheBreakCategory.Tools: return localize('chatDebug.cache.category.tools', "工具目录已更改");
		case CacheBreakCategory.System: return localize('chatDebug.cache.category.system', "系统提示已更改");
		case CacheBreakCategory.Options: return localize('chatDebug.cache.category.options', "请求选项已更改");
		case CacheBreakCategory.History: return localize('chatDebug.cache.category.history', "历史记录已重写");
		case CacheBreakCategory.Unknown: return localize('chatDebug.cache.category.unknown', "未分类");
	}
}

/** Break categories that are avoidable on the client side. */
const AVOIDABLE_CATEGORIES: readonly CacheBreakCategory[] = [
	CacheBreakCategory.Model,
	CacheBreakCategory.Tools,
	CacheBreakCategory.System,
	CacheBreakCategory.Options,
	CacheBreakCategory.History,
];

/** The outcome of analyzing one consecutive request pair in a session. */
export interface ISessionPairOutcome {
	/** Index of the current (B) turn in the session's turn list. */
	readonly turnIndex: number;
	readonly category: CacheBreakCategory;
	/** Input tokens of the B request that were not served from cache. */
	readonly lostTokens: number;
}

/** Aggregate stats for one break category across a session. */
export interface ISessionCategoryStat {
	readonly category: CacheBreakCategory;
	readonly count: number;
	readonly lostTokens: number;
}

/** Token counts for one turn, used for the token-weighted overall hit rate. */
export interface ISessionTurnTokens {
	readonly inputTokens: number;
	readonly cachedTokens: number;
}

/**
 * Token-weighted cache hit across a whole session. Per-request percentages
 * overweight small utility calls; weighting by input tokens shows the real
 * cost picture.
 */
export interface ISessionOverallHit {
	readonly inputTokens: number;
	readonly cachedTokens: number;
	/** `cachedTokens / inputTokens` as a percentage (0-100). */
	readonly hitPct: number;
	/** Number of turns that reported token usage. */
	readonly turnCount: number;
}

/** Cross-turn cache health report for a whole session. */
export interface ISessionCacheReport {
	readonly pairCount: number;
	readonly healthyCount: number;
	/** Uncached tokens across pairs whose break was avoidable. */
	readonly avoidableLostTokens: number;
	/** Token-weighted overall hit rate; undefined when no turn reported usage. */
	readonly overall: ISessionOverallHit | undefined;
	/** Per-category stats, sorted by lost tokens descending (healthy excluded). */
	readonly byCategory: readonly ISessionCategoryStat[];
	/** Per-turn category, for rail decoration. */
	readonly causeByTurnIndex: ReadonlyMap<number, CacheBreakCategory>;
	/** Session-level findings: recurring invalidators and the overall verdict. */
	readonly findings: readonly ICacheInsight[];
}

/** A recurring break category needs at least this many occurrences. */
const RECURRING_THRESHOLD = 2;

/**
 * Aggregate per-pair outcomes into a session-level report: which break
 * categories recur (a one-off break is a curiosity; a recurring one is a
 * bug), how many tokens each cost, and the token-weighted overall hit rate
 * across all turns (`turnTokens` covers every turn, including the first,
 * which has no pair).
 */
export function buildSessionCacheReport(pairs: readonly ISessionPairOutcome[], turnTokens: readonly ISessionTurnTokens[] = []): ISessionCacheReport {
	let overallInput = 0;
	let overallCached = 0;
	let overallTurns = 0;
	for (const t of turnTokens) {
		if (t.inputTokens > 0) {
			overallInput += t.inputTokens;
			overallCached += Math.min(t.cachedTokens, t.inputTokens);
			overallTurns++;
		}
	}
	const overall: ISessionOverallHit | undefined = overallInput > 0
		? { inputTokens: overallInput, cachedTokens: overallCached, hitPct: (overallCached / overallInput) * 100, turnCount: overallTurns }
		: undefined;

	const stats = new Map<CacheBreakCategory, { count: number; lostTokens: number }>();
	const causeByTurnIndex = new Map<number, CacheBreakCategory>();
	let healthyCount = 0;
	let avoidableLostTokens = 0;
	for (const pair of pairs) {
		causeByTurnIndex.set(pair.turnIndex, pair.category);
		if (pair.category === CacheBreakCategory.Healthy) {
			healthyCount++;
			continue;
		}
		const stat = stats.get(pair.category) ?? { count: 0, lostTokens: 0 };
		stat.count++;
		stat.lostTokens += pair.lostTokens;
		stats.set(pair.category, stat);
		if (AVOIDABLE_CATEGORIES.includes(pair.category)) {
			avoidableLostTokens += pair.lostTokens;
		}
	}

	const byCategory = [...stats.entries()]
		.map(([category, s]) => ({ category, count: s.count, lostTokens: s.lostTokens }))
		.sort((a, b) => b.lostTokens - a.lostTokens);

	const findings: ICacheInsight[] = [];
	for (const stat of byCategory) {
		if (stat.count < RECURRING_THRESHOLD) {
			continue;
		}
		if (AVOIDABLE_CATEGORIES.includes(stat.category)) {
			findings.push({
				severity: CacheInsightSeverity.Critical,
				title: localize('chatDebug.cache.session.recurring.title', "定期缓存失效: 每 {2} 组请求对里，就有 {1} 组中出现 {0} 次失效", cacheBreakCategoryLabel(stat.category), fmt(stat.count), fmt(pairs.length)),
				detail: localize('chatDebug.cache.session.recurring.detail', "这些请求中约有 {0} 个令牌被重新计算。反复出现的中断是系统性问题 - 请在每次出现中断时查找相同的根本原因。", fmt(stat.lostTokens)),
				category: stat.category,
			});
		} else if (stat.category === CacheBreakCategory.Expiration) {
			findings.push({
				severity: CacheInsightSeverity.Warning,
				title: localize('chatDebug.cache.session.expiration.title', "缓存可能已过期 {0} 次", fmt(stat.count)),
				detail: localize('chatDebug.cache.session.expiration.detail', "在空闲间隔后，或在低于可缓存最小值的提示中，会重新计算约 {0} 个令牌。", fmt(stat.lostTokens)),
				hint: localize('chatDebug.cache.session.expiration.hint', "如果工作流中必然会出现较长的间隔，可以考虑使用更长 TTL 的缓存，或在用户返回前预热缓存。"),
				category: stat.category,
			});
		}
	}
	if (findings.length === 0 && pairs.length > 0 && healthyCount === pairs.length) {
		findings.push({
			severity: CacheInsightSeverity.Ok,
			title: localize('chatDebug.cache.session.allHealthy.title', "所有请求对均已顺利添加前缀"),
			detail: localize('chatDebug.cache.session.allHealthy.detail', "每个请求都追加了新消息或与上一个提示完全匹配 - 此会话中没有可避免的缓存中断。"),
			category: CacheBreakCategory.Healthy,
		});
	}

	return { pairCount: pairs.length, healthyCount, avoidableLostTokens, overall, byCategory, causeByTurnIndex, findings };
}
