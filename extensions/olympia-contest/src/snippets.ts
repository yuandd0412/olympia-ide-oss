/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  竞赛写法补全：把每天要敲的那二十来段代码放到补全列表里。
 *
 *  目标只有一个——少打字。所以这些条目按「中文说人话 + 英文别名都能搜到」来做：
 *  敲 `ios`、`fast`、`快速` 都会命中「快速 IO」。老版 Tauri 客户端有同一张表，
 *  fork 里不能因为换了壳就丢掉。
 *
 *  条目是纯数据（CONTEST_SNIPPETS），改内容不需要动注册逻辑；正文用 VS Code 的 snippet
 *  语法写占位符，插入后光标直接落在要改的地方。
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';

export interface ContestSnippet {
	/** 搜得到、也当去重键用的英文名。 */
	readonly id: string;
	/** 补全列表里显示的字。 */
	readonly label: string;
	/** 跟在标签右边的短句，说明这段是干什么的。 */
	readonly detail: string;
	/** 除了 id 之外还能搜到它的别名，中英文都行。 */
	readonly keys: readonly string[];
	/** snippet 正文，`${1:x}` 是占位符。 */
	readonly body: string;
}

/**
 * 正文一律用普通字符串写：snippet 占位符本身就是 `${1:x}`，放进模板字符串里会被当成 JS 表达式。
 * （编译能过，但产物里是一条坏正文，补全出来就是语法错的代码。）
 */
export const CONTEST_SNIPPETS: readonly ContestSnippet[] = [
	{
		id: 'ios', label: '快速 IO', detail: '解除 cin/cout 同步', keys: ['sync', 'fastio', 'cin', 'cout'],
		body: 'ios::sync_with_stdio(false);\ncin.tie(nullptr);'
	},
	{
		id: 'freopen', label: '文件重定向 freopen', detail: 'IOI 赛制读写文件', keys: ['file', 'io', 'in', 'out'],
		body: 'freopen("${1:filename}.in", "r", stdin);\nfreopen("${2:filename}.out", "w", stdout);'
	},
	{
		id: 'll', label: 'long long 别名', detail: '给 long long 起个短名', keys: ['longlong', 'typedef', 'using'],
		body: 'using ll = long long;'
	},
	{
		id: 'allmacro', label: 'all 宏', detail: 'sort(all(v)) 那种写法', keys: ['define', 'macro', 'begin'],
		body: '#define all(x) (x).begin(), (x).end()'
	},
	{
		id: 'vint', label: 'vector<int>', detail: '整型数组', keys: ['vector', 'vi'],
		body: 'vector<int> ${1:v};'
	},
	{
		id: 'vll', label: 'vector<long long>', detail: '长整型数组', keys: ['vector', 'vl'],
		body: 'vector<long long> ${1:v};'
	},
	{
		id: 'pii', label: 'pair<int, int>', detail: '二元组', keys: ['pair'],
		body: 'pair<int, int> ${1:p};'
	},
	{
		id: 'push', label: 'push_back', detail: '往尾部塞一个', keys: ['vector', 'emplace'],
		body: '${1:v}.push_back(${2:x});'
	},
	{
		id: 'sortasc', label: '升序排序', detail: 'sort 默认', keys: ['sort'],
		body: 'sort(${1:v}.begin(), ${1:v}.end());'
	},
	{
		id: 'sortdesc', label: '降序排序', detail: '按从大到小排', keys: ['sort', 'greater', 'desc'],
		body: 'sort(${1:v}.begin(), ${1:v}.end(), greater<>());'
	},
	{
		id: 'lb', label: 'lower_bound 下标', detail: '第一个不小于 x 的位置', keys: ['bound', 'binary'],
		body: 'lower_bound(${1:v}.begin(), ${1:v}.end(), ${2:x}) - ${1:v}.begin()'
	},
	{
		id: 'ub', label: 'upper_bound 下标', detail: '第一个大于 x 的位置', keys: ['bound', 'binary'],
		body: 'upper_bound(${1:v}.begin(), ${1:v}.end(), ${2:x}) - ${1:v}.begin()'
	},
	{
		id: 'pq', label: '小根堆', detail: '堆顶是最小的那个', keys: ['heap', 'priority'],
		body: 'priority_queue<int, vector<int>, greater<int>> ${1:pq};'
	},
	{
		id: 'read', label: '读入一个数', detail: '读一个数进来', keys: ['cin', 'input'],
		body: 'cin >> ${1:x};'
	},
	{
		id: 'write', label: '输出并换行', detail: '输出一行', keys: ['cout', 'output'],
		body: 'cout << ${1:x} << "\\n";'
	},
	{
		id: 'qpow', label: '快速幂', detail: '算 a 的 b 次方模 p', keys: ['pow', 'power', 'mod'],
		body: [
			'long long qpow(long long a, long long b, long long mod) {',
			'    long long res = 1;',
			'    a %= mod;',
			'    for (; b; b >>= 1, a = a * a % mod)',
			'        if (b & 1) { res = res * a % mod; }',
			'    return res;',
			'}'
		].join('\n')
	},
	{
		id: 'dsu', label: '并查集', detail: '带路径压缩的 DSU', keys: ['union', 'find', 'set'],
		body: [
			'struct DSU {',
			'    vector<int> f;',
			'    DSU(int n) : f(n + 1) { iota(f.begin(), f.end(), 0); }',
			'    int find(int x) { return f[x] == x ? x : f[x] = find(f[x]); }',
			'    bool merge(int a, int b) {',
			'        a = find(a); b = find(b);',
			'        if (a == b) { return false; }',
			'        f[a] = b;',
			'        return true;',
			'    }',
			'};'
		].join('\n')
	},
	{
		id: 'sieve', label: '埃氏筛', detail: '筛出 1..n 的质数', keys: ['prime', 'screen'],
		body: [
			'vector<bool> is_comp(${1:n} + 1, false);',
			'vector<int> primes;',
			'for (int i = 2; i <= ${1:n}; i++) {',
			'    if (!is_comp[i]) {',
			'        primes.push_back(i);',
			'        for (long long j = (long long)i * i; j <= ${1:n}; j += i) { is_comp[j] = true; }',
			'    }',
			'}'
		].join('\n')
	},
	{
		id: 'dijkstra', label: 'Dijkstra（堆优化）', detail: '单源最短路', keys: ['shortest', 'graph', 'spfa'],
		body: [
			'vector<long long> dist(n + 1, LLONG_MAX);',
			'priority_queue<pair<long long, int>, vector<pair<long long, int>>, greater<>> pq;',
			'dist[${1:s}] = 0;',
			'pq.push({0, ${1:s}});',
			'while (!pq.empty()) {',
			'    auto [d, u] = pq.top(); pq.pop();',
			'    if (d > dist[u]) { continue; }',
			'    for (auto [v, w] : adj[u]) {',
			'        if (dist[u] + w < dist[v]) {',
			'            dist[v] = dist[u] + w;',
			'            pq.push({dist[v], v});',
			'        }',
			'    }',
			'}'
		].join('\n')
	},
	{
		id: 'bfs', label: 'BFS 层数', detail: '队列 + dist 数组', keys: ['queue', 'search'],
		body: [
			'queue<int> q;',
			'vector<int> dist(n + 1, -1);',
			'q.push(${1:s});',
			'dist[${1:s}] = 0;',
			'while (!q.empty()) {',
			'    int u = q.front(); q.pop();',
			'    for (int v : adj[u]) {',
			'        if (dist[v] == -1) {',
			'            dist[v] = dist[u] + 1;',
			'            q.push(v);',
			'        }',
			'    }',
			'}'
		].join('\n')
	}
];

/** 输入框里打的字要能搜到别名，所以 filterText 把 id、别名、中文名拼在一起。 */
function filterTextOf(snippet: ContestSnippet): string {
	return [snippet.id, snippet.label, snippet.detail, ...snippet.keys].join(' ');
}

/** 提示里给人看的是「插入之后长什么样」，所以把占位符的壳去掉。 */
function plainBody(body: string): string {
	return body.replace(/\$\{\d+:([^}]*)\}/g, '$1').replace(/\$\{\d+\}/g, '');
}

function toCompletionItem(snippet: ContestSnippet, index: number, range: vscode.Range): vscode.CompletionItem {
	const item = new vscode.CompletionItem(snippet.label, vscode.CompletionItemKind.Snippet);
	item.detail = snippet.detail;
	item.documentation = new vscode.MarkdownString(`插入后：\n\n\`\`\`cpp\n${plainBody(snippet.body)}\n\`\`\``);
	item.filterText = filterTextOf(snippet);
	item.insertText = new vscode.SnippetString(snippet.body);
	item.range = range;
	// sortText 决定列表顺序：我们的条目集中在一段里，按 CONTEST_SNIPPETS 的次序排。
	item.sortText = `olympia-${String(index).padStart(3, '0')}`;
	return item;
}

export function registerCppSnippets(): vscode.Disposable {
	return vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'cpp' }, {
		provideCompletionItems(document, position): vscode.CompletionItem[] {
			if (!vscode.workspace.getConfiguration('olympia.templates').get<boolean>('cppSnippets', true)) {
				return [];
			}
			// 有单词就把补全写进这个单词的范围，没有单词时在光标处插入。
			const wordRange = document.getWordRangeAtPosition(position);
			const range = wordRange ?? new vscode.Range(position, position);
			return CONTEST_SNIPPETS.map((snippet, index) => toCompletionItem(snippet, index, range));
		}
	});
}
