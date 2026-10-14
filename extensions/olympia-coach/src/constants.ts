/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Every number, id and default the AI coach depends on, in one place.
 *
 *  These used to be spread across provider.ts, coach.ts, model.ts and package.json, where the
 *  same value (a timeout, a fallback model name, the cache lifetime) could be edited in one file
 *  and silently disagree with the others. The settings UI and the provider must agree, so they
 *  read from here.
 *--------------------------------------------------------------------------------------------*/

/** Language-model vendor id registered with `vscode.lm`, and named in product.json. */
export const VENDOR = 'olympia';
export const VENDOR_LABEL = 'Olympia BYOK';

/** SecretStorage key for the API key. The key never goes into settings.json or globalState. */
export const KEY_SECRET = 'olympia.coach.apiKey';

/** globalState key remembering which model the user picked. */
export const CHOSEN_MODEL_STATE_KEY = 'olympia.coach.model';

export const CONFIG_SECTION = 'olympia.ai';
export const BASE_URL_SETTING = 'baseUrl';
export const MODELS_SETTING = 'models';

/** Used when the server refuses to list models, so the picker is never empty for no reason. */
export const FALLBACK_CHAT_MODELS: readonly string[] = ['deepseek-chat', 'deepseek-reasoner'];

/** Shown as the placeholder in the settings UI and in the `baseUrl` description. */
export const EXAMPLE_BASE_URL = 'https://api.deepseek.com/v1';

export const MODELS_CACHE_MS = 5 * 60 * 1000;
export const MODELS_TIMEOUT_MS = 5000;

/** Context-window guesses advertised to core; no offline tokenizer is available. */
export const MAX_INPUT_TOKENS = 64000;
export const MAX_OUTPUT_TOKENS = 8000;

/** How much of an error body to surface in a message. */
export const ERROR_SNIPPET_LEN = 200;

/** Rough Latin-script characters-per-token, used only for context-budget estimates. */
export const LATIN_CHARS_PER_TOKEN = 4;

export const OUTPUT_CHANNEL_NAME = 'Olympia AI Coach';

/** Name of the settings command, so other surfaces (model picker, walkthroughs) can link to it. */
export const SETTINGS_COMMAND = 'olympia.ai.settings';
export const SHOW_LOG_COMMAND = 'olympia.coach.showLog';

/** 比赛是否进行中，由 olympia-onboarding 的这条命令回答；比赛时教练不出场。 */
export const CONTEST_STATE_COMMAND = 'olympia.contest.isRunning';

// ------------------------------------------------------------------ 题面字段抽取（olympia-contest 调用）
// 这一组值来自退役的 Tauri 版 `frontend/src-tauri/src/enrich.rs`，照搬不改：
// 抓取之后让模型把残缺的字段补一次，只补空的，任何时候都不盖掉爬虫已经拿到的东西。

/**
 * 「补题面」的命令 id。写在题面里的键只有这一条路能跨过扩展边界：密钥存在本扩展的
 * SecretStorage，`context.secrets` 是每扩展隔离的，olympia-contest 读不到，所以 HTTP 调用留在这边。
 * 这条命令不是给人点的，所以不进 package.json 的命令面板。
 */
export const EXTRACT_COMMAND = 'olympia.ai.extract';

/** 整轮抽取的墙上时钟预算：严格那一次和它的重试共用，慢服务绝不该把拉题面卡住。 */
export const EXTRACT_TOTAL_BUDGET_MS = 45000;

/** 结构化抽取不是聊天：温度压低，一次最多 4096 个 token。 */
export const EXTRACT_TEMPERATURE = 0.1;
export const EXTRACT_MAX_TOKENS = 4096;

/** 题面原文进提示词之前先截断，不把没有上限的正文发出去。 */
export const EXTRACT_INPUT_CHAR_CAP = 12000;

/** 两次请求都带这一句 system；`response_format` 只在严格那一次带。 */
export const EXTRACT_SYSTEM_PROMPT = 'You extract contest problem fields as strict JSON only.';
