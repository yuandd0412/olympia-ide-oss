/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IStringDictionary } from '../../../../../base/common/collections.js';
import type { IJSONSchema } from '../../../../../base/common/jsonSchema.js';
import { localize } from '../../../../../nls.js';
import { type IConfigurationPropertySchema } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { AgentSandboxEnabledValue, AgentSandboxSettingId } from '../../../../../platform/sandbox/common/settings.js';
import { gitAutoApproveRules } from '../../../../../platform/terminal/common/autoApprove/gitAutoApproveRules.js';
import { powershellAutoApproveRules } from '../../../../../platform/terminal/common/autoApprove/powershellAutoApproveRules.js';
import { sortAutoApproveRules } from '../../../../../platform/terminal/common/autoApprove/sortAutoApproveRules.js';
import { TerminalSettingId } from '../../../../../platform/terminal/common/terminal.js';
import { terminalProfileBaseProperties } from '../../../../../platform/terminal/common/terminalPlatformConfiguration.js';
import { PolicyCategory } from '../../../../../base/common/policy.js';

/**
 * Default idle silence timeout in milliseconds. Used as both the configuration
 * default and the runtime fallback when the setting is unavailable.
 */
export const DEFAULT_IDLE_SILENCE_TIMEOUT_MS = 300_000; // 5 minutes

export const enum TerminalChatAgentToolsSettingId {
	EnableAutoApprove = 'chat.tools.terminal.enableAutoApprove',
	AutoApprove = 'chat.tools.terminal.autoApprove',
	AutoApproveWorkspaceNpmScripts = 'chat.tools.terminal.autoApproveWorkspaceNpmScripts',
	IgnoreDefaultAutoApproveRules = 'chat.tools.terminal.ignoreDefaultAutoApproveRules',
	BlockDetectedFileWrites = 'chat.tools.terminal.blockDetectedFileWrites',
	ShellIntegrationTimeout = 'chat.tools.terminal.shellIntegrationTimeout',
	OutputLocation = 'chat.tools.terminal.outputLocation',
	AgentSandboxLinuxFileSystem = 'chat.agent.sandbox.fileSystem.linux',
	AgentSandboxMacFileSystem = 'chat.agent.sandbox.fileSystem.mac',
	AgentSandboxWindowsFileSystem = 'chat.agent.sandbox.fileSystem.windows',
	AgentSandboxAdvancedRuntime = 'chat.agent.sandbox.advanced.runtime',
	PreventShellHistory = 'chat.tools.terminal.preventShellHistory',
	EnforceTimeoutFromModel = 'chat.tools.terminal.enforceTimeoutFromModel',
	IdleSilenceTimeoutMs = 'chat.tools.terminal.idleSilenceTimeoutMs',
	DetachBackgroundProcesses = 'chat.tools.terminal.detachBackgroundProcesses',
	BackgroundNotifications = 'chat.tools.terminal.backgroundNotifications',
	OutputDeltas = 'chat.tools.terminal.outputDeltas',
	OutputCompaction = 'chat.tools.terminal.outputCompaction',
	IdlePollInterval = 'chat.tools.terminal.idlePollInterval',

	TerminalProfileLinux = 'chat.tools.terminal.terminalProfile.linux',
	TerminalProfileMacOs = 'chat.tools.terminal.terminalProfile.osx',
	TerminalProfileWindows = 'chat.tools.terminal.terminalProfile.windows',

	DeprecatedAutoApproveCompatible = 'chat.agent.terminal.autoApprove',
	DeprecatedAutoApprove1 = 'chat.agent.terminal.allowList',
	DeprecatedAutoApprove2 = 'chat.agent.terminal.denyList',
	DeprecatedAutoApprove3 = 'github.copilot.chat.agent.terminal.allowList',
	DeprecatedAutoApprove4 = 'github.copilot.chat.agent.terminal.denyList',
}

export interface ITerminalChatAgentToolsConfiguration {
	autoApprove: { [key: string]: boolean };
	commandReportingAllowList: { [key: string]: boolean };
	shellIntegrationTimeout: number;
}

const autoApproveBoolean: IJSONSchema = {
	type: 'boolean',
	enum: [
		true,
		false,
	],
	enumDescriptions: [
		localize('autoApprove.true', "自动批准模式。"),
		localize('autoApprove.false', "需要显式批准模式。"),
	],
	description: localize('autoApprove.key', "要与之匹配的命令的开头。可以通过将字符串用 \"/\" 字符包裹来提供正则表达式。"),
};

const terminalChatAgentProfileSchema: IJSONSchema = {
	type: 'object',
	required: ['path'],
	properties: {
		path: {
			description: localize('terminalChatAgentProfile.path', "shell 可执行文件的路径。"),
			type: 'string',
		},
		...terminalProfileBaseProperties,
	}
};

export const terminalChatAgentToolsConfiguration: IStringDictionary<IConfigurationPropertySchema> = {
	[TerminalChatAgentToolsSettingId.EnableAutoApprove]: {
		restricted: true,
		description: localize('autoApproveMode.description', "控制「在终端中运行」工具是否自动批准。"),
		type: 'boolean',
		default: true,
		policy: {
			name: 'ChatToolsTerminalEnableAutoApprove',
			category: PolicyCategory.IntegratedTerminal,
			minimumVersion: '1.104',
			localization: {
				description: {
					key: 'autoApproveMode.description',
					value: localize('autoApproveMode.description', "控制「在终端中运行」工具是否自动批准。"),
				}
			}
		},
		agentsWindow: { default: true },
	},
	[TerminalChatAgentToolsSettingId.AutoApprove]: {
		restricted: true,
		markdownDescription: [
			localize('autoApprove.description.intro', "命令或正则表达式的列表，它们控制终端工具命令中的运行是否需要显式批准。这些将与命令的开头进行匹配。在正则表达式中，可以用 {0} 字符包裹字符串，后面再添加可选标志(如 {1})以表示不区分大小写。", '`/`', '`i`'),
			localize('autoApprove.description.values', "设置为 {0} 可自动批准命令，设置为 {1} 始终需要显式批准，设置为 {2} 则可取消设置值。", '`true`', '`false`', '`null`'),
			localize('autoApprove.description.subCommands', "请注意，这些命令和正则表达式是针对完整_命令行_内的每个_子命令_进行计算的，因此 {0} 等需要 {1} 和 {2} 都匹配 {3} 条目，并且不得与 {4} 条目匹配才能自动批准。还应检测 {5} (进程替换)等内联命令。", '`foo && bar`', '`foo`', '`bar`', '`true`', '`false`', '`<(foo)`'),
			localize('autoApprove.description.commandLine', "对象可用于与完整命令行进行匹配，而不是匹配子命令和内联命令，例如 {0}。为了实现自动批准，子命令和命令行都不能被显式拒绝，且需要批准所有子命令或命令行。", '`{ approve: false, matchCommandLine: true }`'),
			localize('autoApprove.defaults', "请注意，系统有一组默认规则用于允许和拒绝命令。建议将 {0} 设置为 {1} ，以忽略所有默认规则，确保不会与你自己的规则发生冲突。这样做需要自行承担风险，默认的拒绝规则旨在防止你运行危险命令。", `\`#${TerminalChatAgentToolsSettingId.IgnoreDefaultAutoApproveRules}#\``, '`true`'),
			[
				localize('autoApprove.description.examples.title', "示例:"),
				`|${localize('autoApprove.description.examples.value', "值")}|${localize('autoApprove.description.examples.description', "描述")}|`,
				'|---|---|',
				'| `\"mkdir\": true` | ' + localize('autoApprove.description.examples.mkdir', "允许所有以 {0} 开头的命令", '`mkdir`'),
				'| `\"npm run build\": true` | ' + localize('autoApprove.description.examples.npmRunBuild', "允许所有以 {0} 开头的命令", '`npm run build`'),
				'| `\"bin/test.sh\": true` | ' + localize('autoApprove.description.examples.binTest', "允许与路径 {0} ({1}、{2} 等)匹配的所有命令", '`bin/test.sh`', '`bin\\test.sh`', '`./bin/test.sh`'),
				'| `\"/^git (status\\|show\\\\b.*)$/\": true` | ' + localize('autoApprove.description.examples.regexGit', "允许 {0} 和所有以 {1} 开头的命令", '`git status`', '`git show`'),
				'| `\"/^Get-ChildItem\\\\b/i\": true` | ' + localize('autoApprove.description.examples.regexCase', "将允许 {0} 命令，而不考虑大小写", '`Get-ChildItem`'),
				'| `\"/.*/\": true` | ' + localize('autoApprove.description.examples.regexAll', "允许所有命令(拒绝的命令仍需要批准)"),
				'| `\"rm\": false` | ' + localize('autoApprove.description.examples.rm', "需要对以 {0} 开头的所有命令进行显式批准", '`rm`'),
				'| `\"/\\\\.ps1/i\": { approve: false, matchCommandLine: true }` | ' + localize('autoApprove.description.examples.ps1', "无论大小写如何，都需要显式批准包含 {0} 的任何命令行", '`".ps1"`'),
				'| `\"rm\": null` | ' + localize('autoApprove.description.examples.rmUnset', "取消设置 {1} 的默认值 {0}", '`false`', '`rm`'),
			].join('\n'),
		].join('\n\n'),
		type: 'object',
		additionalProperties: {
			anyOf: [
				autoApproveBoolean,
				{
					type: 'object',
					properties: {
						approve: autoApproveBoolean,
						matchCommandLine: {
							type: 'boolean',
							enum: [
								true,
								false,
							],
							enumDescriptions: [
								localize('autoApprove.matchCommandLine.true', "与完整命令行进行匹配，例如: `foo && bar`。"),
								localize('autoApprove.matchCommandLine.false', "与子命令和内联命令匹配，例如 `foo && bar` 需要 `foo` 和 `bar` 才能匹配。"),
							],
							description: localize('autoApprove.matchCommandLine', "是否与完整命令行匹配，而不是按子命令和内联命令拆分。"),
						}
					},
					required: ['approve']
				},
				{
					type: 'null',
					description: localize('autoApprove.null', "忽略该模式，这对于取消设置在更高的范围设置的同一模式非常有用。"),
				},
			]
		},
		default: {
			// This is the default set of terminal auto approve commands. Note that these are best
			// effort and do not aim to provide exhaustive coverage to prevent dangerous commands
			// from executing as that is simply not feasible. Workspace trust and warnings of
			// possible prompt injection are _the_ thing protecting the user in agent mode, once
			// that trust boundary has been breached all bets are off as trusting a workspace that
			// contains anything malicious has already compromised the machine.
			//
			// Instead, the focus here is to unblock the user from approving clearly safe commands
			// frequently and cover common edge cases that could arise from the user auto-approving
			// commands.
			//
			// Take for example `find` which looks innocuous and most users are likely to auto
			// approve future calls when offered. However, the `-exec` argument can run anything. So
			// instead of leaving this decision up to the user we provide relatively safe defaults
			// and block common edge cases. So offering these default rules, despite their flaws, is
			// likely to protect the user more in general than leaving everything up to them (plus
			// make agent mode more convenient).

			// #region Safe commands
			//
			// Generally safe and common readonly commands

			cd: true,
			echo: true,
			ls: true,
			dir: true,
			pwd: true,
			cat: true,
			head: true,
			tail: true,
			findstr: true,
			wc: true,
			tr: true,
			cut: true,
			cmp: true,
			which: true,
			basename: true,
			dirname: true,
			realpath: true,
			readlink: true,
			stat: true,
			file: true,
			od: true,
			du: true,
			df: true,
			sleep: true,
			nl: true,

			// grep
			// - Variable
			// - `-f`: Read patterns from file, this is an acceptable risk since you can do similar
			//   with cat
			// - `-P`: PCRE risks include denial of service (memory exhaustion, catastrophic
			//   backtracking) which could lock up the terminal. Older PCRE versions allow code
			//   execution via this flag but this has been patched with CVEs.
			// - Variable injection is possible, but requires setting a variable which would need
			//   manual approval.
			grep: true,

			// #endregion

			// #region Safe sub-commands
			//
			// Safe and common sub-commands

			...gitAutoApproveRules,

			// docker - readonly sub-commands
			'/^docker\\s+(ps|images|info|version|inspect|logs|top|stats|port|diff|search|events)\\b/': true,
			'/^docker\\s+(container|image|network|volume|context|system)\\s+(ls|ps|inspect|history|show|df|info)\\b/': true,
			'/^docker\\s+compose\\s+(ps|ls|top|logs|images|config|version|port|events)\\b/': true,

			// #endregion

			// #region PowerShell

			...powershellAutoApproveRules,

			// #endregion

			// #region Package managers (npm, yarn, pnpm)
			//
			// Read-only commands that don't modify files or execute arbitrary code.

			// npm read-only commands
			'/^npm\\s+(ls|list|outdated|view|info|show|explain|why|root|prefix|bin|search|doctor|fund|repo|bugs|docs|home|help(-search)?)\\b/': true,
			'/^npm\\s+config\\s+(list|get)\\b/': true,
			'/^npm\\s+pkg\\s+get\\b/': true,
			'/^npm\\s+audit$/': true,
			'/^npm\\s+cache\\s+verify\\b/': true,

			// yarn read-only commands
			'/^yarn\\s+(list|outdated|info|why|bin|help|versions)\\b/': true,
			'/^yarn\\s+licenses\\b/': true,
			'/^yarn\\s+audit\\b(?!.*\\bfix\\b)/': true,
			'/^yarn\\s+config\\s+(list|get)\\b/': true,
			'/^yarn\\s+cache\\s+dir\\b/': true,

			// pnpm read-only commands
			'/^pnpm\\s+(ls|list|outdated|why|root|bin|doctor)\\b/': true,
			'/^pnpm\\s+licenses\\b/': true,
			'/^pnpm\\s+audit\\b(?!.*\\bfix\\b)/': true,
			'/^pnpm\\s+config\\s+(list|get)\\b/': true,

			// Safe lockfile-only installs since we trust the workspace and lock file is trusted.
			'npm ci': true,
			'/^npm\\s+ci\\s+\\S/': false,
			'/^yarn\\s+install\\s+--frozen-lockfile\\b/': true,
			'/^yarn\\s+install\\s+--frozen-lockfile\\s+\\S/': false,
			'/^pnpm\\s+install\\s+--frozen-lockfile\\b/': true,
			'/^pnpm\\s+install\\s+--frozen-lockfile\\s+\\S/': false,

			// #endregion

			// #region Safe + disabled args
			//
			// Commands that are generally allowed with special cases we block. Note that shell
			// expansion is handled by the inline command detection when parsing sub-commands.

			// column
			// - `-c`: We block excessive columns that could lead to memory exhaustion.
			column: true,
			'/^column\\b.*\\s-c\\s+[0-9]{4,}/': false,

			// date
			// -s|--set: Sets the system clock
			date: true,
			'/^date\\b.*\\s(-s|--set)\\b/': false,

			// find
			// - `-delete`: Deletes files or directories.
			// - `-exec`/`-execdir`: Execute on results.
			// - `-fprint`/`fprintf`/`fls`: Writes files.
			// - `-ok`/`-okdir`: Like exec but with a confirmation.
			find: true,
			'/^find\\b.*\\s-(delete|exec|execdir|fprint|fprintf|fls|ok|okdir)\\b/': false,

			// rg (ripgrep)
			// - `--pre`: Executes arbitrary command as preprocessor for every file searched.
			// - `--hostname-bin`: Executes arbitrary command to get hostname.
			rg: true,
			'/^rg\\b.*\\s(--pre|--hostname-bin)\\b/': false,

			// sed
			// - `-e`/`--expression`: Add the commands in script to the set of commands to be run
			//   while processing the input.
			// - `-f`/`--file`: Add the commands contained in the file script-file to the set of
			//   commands to be run while processing the input.
			// - standalone `e`: Execute a shell command from the sed script
			// - standalone `r`/`R`: Read arbitrary files into the stream
			// - standalone `w`/`W`: Write pattern space to arbitrary files
			// - `s///e` flag: Executes substitution result as shell command
			// - `s///w` flag: Write substitution result to file
			// - Note that `--sandbox` exists which blocks unsafe commands that could potentially be
			//   leveraged to auto approve
			// - In-place editing (`-i`, `-I`, `--in-place`) is detected and blocked via file write
			//   detection if necessary
			// - These patterns are conservative: a literal `;e ` or `{e ` inside a replacement
			//   string also matches, which asks for confirmation rather than auto-approving.
			// TODO: replace sed deny regexes with a shared script analyzer — https://github.com/microsoft/vscode/issues/329218
			sed: true,
			'/^sed\\b.*\\s(-[a-zA-Z]*(e|f)[a-zA-Z]*|--expression|--file)\\b/': false,
			'/^sed\\b.*s\\/.*\\/.*\\/[ew]/': false,
			// Quoted positional script whose first command is e/r/R/w/W. The opening quote is
			// captured so the closing quote must match it, and whitespace and `!` are allowed
			// around the optional address since sed ignores them. The option prefix also skips
			// the separate operand consumed by -l/--line-length.
			'/^sed\\b(?:\\s+(?:(?:-l|--line-length)\\s+\\S+|--line-length=\\S+|-\\S+))*\\s+([\'"])\\s*(?:(?:\\d+|\\$|\\/(?:\\\\.|[^\\/])*\\/)(?:\\s*,\\s*(?:\\d+|\\$|\\/(?:\\\\.|[^\\/])*\\/))?)?\\s*!?\\s*[erRwW](?:\\s|\\1)/': false,
			// Same dangerous commands after a `;` or `{` separator inside a quoted script.
			// Escaped characters are consumed before testing for the matching closing quote.
			'/^sed\\b(?:\\s+(?:(?:-l|--line-length)\\s+\\S+|--line-length=\\S+|-\\S+))*\\s+([\'"])(?:\\\\.|(?!\\1).)*[;{]\\s*(?:(?:\\d+|\\$|\\/(?:\\\\.|[^\\/])*\\/)(?:\\s*,\\s*(?:\\d+|\\$|\\/(?:\\\\.|[^\\/])*\\/))?)?\\s*!?\\s*[erRwW](?:\\s|\\1|[;}])/': false,
			// Unquoted positional script form (e.g. `sed 1e id`, `sed w file`, `sed /pat/e file`)
			'/^sed\\b(?:\\s+(?:(?:-l|--line-length)\\s+\\S+|--line-length=\\S+|-\\S+))*\\s+(?:(?:\\d+|\\$|\\/(?:\\\\.|[^\\/])*\\/)(?:\\s*,\\s*(?:\\d+|\\$|\\/(?:\\\\.|[^\\/])*\\/))?)?\\s*!?\\s*[erRwW](?:\\s|$)/': false,

			...sortAutoApproveRules,

			// tree
			// - `-o`: Output redirection can write files (`tree -o /etc/something file`) which are
			//   blocked currently
			tree: true,
			'/^tree\\b.*\\s-o\\b/': false,

			// xxd
			// - Only allow flags and a single input file as it's difficult to parse the outfile
			//   positional argument safely.
			'/^xxd$/': true,
			'/^xxd\\b(\\s+-\\S+)*\\s+[^-\\s]\\S*$/': true,

			// #endregion

			// #region Dangerous commands
			//
			// There are countless dangerous commands available on the command line, the defaults
			// here include common ones that the user is likely to want to explicitly approve first.
			// This is not intended to be a catch all as the user needs to opt-in to auto-approve
			// commands, it provides some additional safety when the commands get approved by overly
			// broad user/workspace rules.

			// Deleting files
			rm: false,
			rmdir: false,
			del: false,
			'Remove-Item': false,
			ri: false,
			rd: false,
			erase: false,
			dd: false,

			// Managing/killing processes, dangerous thing to do generally
			kill: false,
			ps: false,
			top: false,
			'Stop-Process': false,
			spps: false,
			taskkill: false,
			'taskkill.exe': false,

			// Web requests, prompt injection concerns
			curl: false,
			wget: false,
			'Invoke-RestMethod': false,
			'Invoke-WebRequest': false,
			'irm': false,
			'iwr': false,

			// File permissions and ownership, messing with these can cause hard to diagnose issues
			chmod: false,
			chown: false,
			'Set-ItemProperty': false,
			'sp': false,
			'Set-Acl': false,

			// General eval/command execution, can lead to anything else running
			jq: false,
			xargs: false,
			eval: false,
			'Invoke-Expression': false,
			iex: false,

			// #endregion
		} satisfies Record<string, boolean | { approve: boolean; matchCommandLine?: boolean }>,
	},
	[TerminalChatAgentToolsSettingId.IgnoreDefaultAutoApproveRules]: {
		restricted: true,
		type: 'boolean',
		default: false,
		tags: ['experimental'],
		markdownDescription: localize('ignoreDefaultAutoApproveRules.description', "是否如 {0} 中所定义，忽略终端工具中的运行使用的内置默认自动批准规则。启用此设置后，终端工具中的运行将忽略默认规则集中的所有规则，但仍会遵循用户设置、远程设置和工作区设置中定义的规则。使用此设置需要自行承担风险，默认自动批准规则旨在防止你运行危险命令。", `\`#${TerminalChatAgentToolsSettingId.AutoApprove}#\``),
	},
	[TerminalChatAgentToolsSettingId.AutoApproveWorkspaceNpmScripts]: {
		restricted: true,
		type: 'boolean',
		// In order to use agent mode the workspace must be trusted, this plus the fact that
		// modifying package.json is protected means this is safe to enable by default.
		default: true,
		tags: ['experimental'],
		markdownDescription: localize('autoApproveWorkspaceNpmScripts.description', "在工作区 package.json 文件中定义了脚本时是否自动批准 npm、yarn 和 pnpm 运行命令。由于该工作区受信任，package.json 中定义的脚本被视为安全，可在未明确批准的情况下运行。"),
	},
	[TerminalChatAgentToolsSettingId.BlockDetectedFileWrites]: {
		restricted: true,
		type: 'string',
		enum: ['never', 'outsideWorkspace', 'all'],
		enumDescriptions: [
			localize('blockFileWrites.never', "允许所有检测到的文件写入。"),
			localize('blockFileWrites.outsideWorkspace', "阻止在工作区外检测到的文件写入。这依赖于 shell 集成功能正常工作，以确定终端的当前工作目录。"),
			localize('blockFileWrites.all', "阻止所有检测到的文件写入。"),
		],
		default: 'outsideWorkspace',
		tags: ['experimental'],
		markdownDescription: localize('blockFileWrites.description', "控制是否在终端工具的运行过程中阻止检测到的文件写入操作。此类操作在被检测到时，无论命令是否通常会自动批准，都需要获得明确批准。请注意，这无法检测所有可能的文件写入方式，目前检测到的方式包括:\r\n\r\n- 文件重定向(通过 bash 或 PowerShell 的 tree sitter 语法检测)\r\n- `sed` 的就地编辑( `-i`、`-I`、`--in-place`)"),
	},
	[TerminalChatAgentToolsSettingId.ShellIntegrationTimeout]: {
		markdownDescription: localize('shellIntegrationTimeout.description', "配置在终端工具中的运行启动新终端时，等待检测到 shell 集成的持续时间(毫秒)。设置为 `0` 以完全跳过等待，默认值 `-1` 基于 {0} 值以及它是否为远程窗口使用可变等待时间。如果 shell 启动速度非常慢，则大值非常有用。", `\`#${TerminalSettingId.ShellIntegrationEnabled}#\``),
		type: 'integer',
		minimum: -1,
		maximum: 60000,
		default: -1,
		markdownDeprecationMessage: localize('shellIntegrationTimeout.deprecated', "请改用 {0}", `\`#${TerminalSettingId.ShellIntegrationTimeout}#\``)
	},
	[TerminalChatAgentToolsSettingId.IdlePollInterval]: {
		markdownDescription: localize('idlePollInterval.description', "配置终端工具中运行使用的空闲轮询间隔(以毫秒为单位)，以检测命令何时完成执行。值越低，命令检测速度越快，但在系统速度慢时可能会导致误报。这主要影响没有 shell 集成的终端，其中使用空闲检测而不是 shell 集成事件。"),
		type: 'integer',
		minimum: 50,
		maximum: 10000,
		default: 1000,
	},
	[TerminalChatAgentToolsSettingId.TerminalProfileLinux]: {
		restricted: true,
		markdownDescription: localize('terminalChatAgentProfile.linux', "在 Linux 上的聊天智能体在终端工具中运行所使用的终端配置文件。"),
		type: ['object', 'null'],
		default: null,
		'anyOf': [
			{ type: 'null' },
			terminalChatAgentProfileSchema
		],
		defaultSnippets: [
			{
				body: {
					path: '${1}'
				}
			}
		]
	},
	[TerminalChatAgentToolsSettingId.TerminalProfileMacOs]: {
		restricted: true,
		markdownDescription: localize('terminalChatAgentProfile.osx', "在 macOS 上的聊天智能体在终端工具中运行所使用的终端配置文件。"),
		type: ['object', 'null'],
		default: null,
		'anyOf': [
			{ type: 'null' },
			terminalChatAgentProfileSchema
		],
		defaultSnippets: [
			{
				body: {
					path: '${1}'
				}
			}
		]
	},
	[TerminalChatAgentToolsSettingId.TerminalProfileWindows]: {
		restricted: true,
		markdownDescription: localize('terminalChatAgentProfile.windows', "在 Windows 上的聊天智能体在终端工具中运行所使用的终端配置文件。"),
		type: ['object', 'null'],
		default: null,
		'anyOf': [
			{ type: 'null' },
			terminalChatAgentProfileSchema
		],
		defaultSnippets: [
			{
				body: {
					path: '${1}'
				}
			}
		]
	},
	[TerminalChatAgentToolsSettingId.OutputLocation]: {
		markdownDescription: localize('outputLocation.description', "在终端工具中显示运行输出的位置。"),
		type: 'string',
		enum: ['terminal', 'chat'],
		enumDescriptions: [
			localize('outputLocation.terminal', "除了聊天，还可以在面板或编辑器中显示终端。"),
			localize('outputLocation.chat', "仅在聊天中显示终端输出。"),
		],
		default: 'chat',
		tags: ['experimental'],
		experiment: {
			mode: 'auto'
		}
	},
	[AgentSandboxSettingId.AgentSandboxEnabled]: {
		markdownDescription: localize('agentSandbox.enabledSetting', "控制智能体模式是否使用沙盒来限制工具的操作。启用后，终端等工具将在沙盒环境中运行，以限制对系统的访问。使用 {0} 以允许所有网络域。", `\`#${AgentSandboxSettingId.AgentSandboxAllowNetwork}#\``),
		type: 'string',
		enum: [AgentSandboxEnabledValue.Off, AgentSandboxEnabledValue.On],
		enumDescriptions: [
			localize('agentSandbox.enabledSetting.offDescription', "为代理模式工具禁用沙盒。"),
			localize('agentSandbox.enabledSetting.onDescription', "为代理模式工具启用沙盒。"),
		],
		default: AgentSandboxEnabledValue.Off,
		tags: ['preview'],
		restricted: true,
		experiment: {
			mode: 'auto'
		},
		policy: {
			name: 'ChatAgentSandboxEnabled',
			category: PolicyCategory.IntegratedTerminal,
			minimumVersion: '1.116',
			localization: {
				description: {
					key: 'agentSandbox.enabledSetting',
					value: localize('agentSandbox.enabledSetting', "控制智能体模式是否使用沙盒来限制工具的操作。启用后，终端等工具将在沙盒环境中运行，以限制对系统的访问。使用 {0} 以允许所有网络域。", `\`#${AgentSandboxSettingId.AgentSandboxAllowNetwork}#\``),
				},
				enumDescriptions: [
					{
						key: 'agentSandbox.enabledSetting.offDescription',
						value: localize('agentSandbox.enabledSetting.offDescription', "为代理模式工具禁用沙盒。"),
					},
					{
						key: 'agentSandbox.enabledSetting.onDescription',
						value: localize('agentSandbox.enabledSetting.onDescription', "为代理模式工具启用沙盒。"),
					},
				]
			}
		}
	},
	[AgentSandboxSettingId.AgentSandboxWindowsEnabled]: {
		markdownDescription: localize('agentSandbox.windowsEnabledSetting', "控制智能体模式在 Windows 上是否使用沙盒。使用 {0} 以允许所有网络域。", `\`#${AgentSandboxSettingId.AgentSandboxAllowNetwork}#\``),
		type: 'string',
		enum: [AgentSandboxEnabledValue.Off, AgentSandboxEnabledValue.On],
		enumDescriptions: [
			localize('agentSandbox.windowsEnabledSetting.offDescription', "在 Windows 上为智能体模式工具禁用沙盒。"),
			localize('agentSandbox.windowsEnabledSetting.onDescription', "为 Windows 上的智能体模式工具启用沙盒化。"),
		],
		default: AgentSandboxEnabledValue.Off,
		tags: ['experimental'],
		restricted: true,
		experiment: {
			mode: 'auto'
		}
	},
	[AgentSandboxSettingId.AgentSandboxAllowNetwork]: {
		markdownDescription: localize('agentSandbox.allowNetwork', "当启用 {0} 时，控制是否允许沙盒中的所有网络域。启用后，沙盒将保留文件系统限制，同时放宽所有网络限制。", `\`#${AgentSandboxSettingId.AgentSandboxEnabled}#\``),
		type: 'boolean',
		default: true,
		tags: ['preview'],
		restricted: true,
		policy: {
			name: 'ChatAgentSandboxAllowNetwork',
			category: PolicyCategory.IntegratedTerminal,
			minimumVersion: '1.127',
			localization: {
				description: {
					key: 'agentSandbox.allowNetwork',
					value: localize('agentSandbox.allowNetwork', "当启用 {0} 时，控制是否允许沙盒中的所有网络域。启用后，沙盒将保留文件系统限制，同时放宽所有网络限制。", `\`#${AgentSandboxSettingId.AgentSandboxEnabled}#\``),
				}
			}
		}
	},
	[AgentSandboxSettingId.AgentSandboxAllowUnsandboxedCommands]: {
		markdownDescription: localize('agentSandbox.allowUnsandboxedCommands', "控制当沙盒命令失败或沙盒限制会阻止命令时，智能体模式终端命令在用户确认后是否可在沙盒外运行。仅当启用 {0} 时适用。", `\`#${AgentSandboxSettingId.AgentSandboxEnabled}#\``),
		type: 'boolean',
		default: true,
		tags: ['preview'],
		restricted: true,
		policy: {
			name: 'ChatAgentSandboxAllowUnsandboxedCommands',
			category: PolicyCategory.IntegratedTerminal,
			minimumVersion: '1.116',
			localization: {
				description: {
					key: 'agentSandbox.allowUnsandboxedCommands',
					value: localize('agentSandbox.allowUnsandboxedCommands', "控制当沙盒命令失败或沙盒限制会阻止命令时，智能体模式终端命令在用户确认后是否可在沙盒外运行。仅当启用 {0} 时适用。", `\`#${AgentSandboxSettingId.AgentSandboxEnabled}#\``),
				}
			}
		}
	},
	[AgentSandboxSettingId.AgentSandboxRetryWithAllowNetworkRequests]: {
		markdownDescription: localize('agentSandbox.retryWithAllowNetworkRequests', "控制在用户确认后，智能体模式终端命令是否可以在沙盒中以不受限制的网络访问重试。这仅在启用 {0} 时适用，并且会在保留文件系统沙盒的同时，放宽已批准命令的网络限制。", `\`#${AgentSandboxSettingId.AgentSandboxEnabled}#\``),
		type: 'boolean',
		default: true,
		tags: ['preview'],
		restricted: true
	},
	[AgentSandboxSettingId.AgentSandboxAllowAutoApprove]: {
		markdownDescription: localize('agentSandbox.allowAutoApprove', "控制是否自动批准在沙盒内运行的智能体模式终端命令。禁用时，“在终端中运行”工具将使用现有审批流程。仅当启用 {0} 时适用。", `\`#${AgentSandboxSettingId.AgentSandboxEnabled}#\``),
		type: 'boolean',
		default: true,
		tags: ['preview'],
		restricted: true,
		policy: {
			name: 'ChatAgentSandboxAllowAutoApprove',
			category: PolicyCategory.IntegratedTerminal,
			minimumVersion: '1.116',
			localization: {
				description: {
					key: 'agentSandbox.allowAutoApprove',
					value: localize('agentSandbox.allowAutoApprove', "控制是否自动批准在沙盒内运行的智能体模式终端命令。禁用时，“在终端中运行”工具将使用现有审批流程。仅当启用 {0} 时适用。", `\`#${AgentSandboxSettingId.AgentSandboxEnabled}#\``),
				}
			}
		}
	},
	[TerminalChatAgentToolsSettingId.AgentSandboxLinuxFileSystem]: {
		markdownDescription: localize('agentSandbox.linuxFileSystemSetting', "注意: 此设置仅在启用 {0} 时生效。控制 Linux 上沙盒中的文件系统访问权限。路径不支持 glob 模式，仅支持字面路径(例如: ./src/、~/.ssh、.env)。需安装 bubblewrap 和 socat，此设置才能生效。", `\`#${AgentSandboxSettingId.AgentSandboxEnabled}#\``),
		type: 'object',
		properties: {
			denyRead: {
				type: 'array',
				description: localize('agentSandbox.linuxFileSystemSetting.denyRead', "禁止读取访问的路径数组。留空表示允许读取所有路径。"),
				items: { type: 'string' },
				default: []
			},
			allowRead: {
				type: 'array',
				description: localize('agentSandbox.linuxFileSystemSetting.allowRead', "在被拒绝区域内重新允许读取的路径数组。优先级高于 denyRead。"),
				items: { type: 'string' },
				default: []
			},
			allowWrite: {
				type: 'array',
				description: localize('agentSandbox.linuxFileSystemSetting.allowWrite', "允许写权限的其他路径的数组。留空则禁止在工作区文件夹、工作区存储文件夹和沙盒临时目录之外进行写入。"),
				items: { type: 'string' },
				default: []
			},
			denyWrite: {
				type: 'array',
				description: localize('agentSandbox.linuxFileSystemSetting.denyWrite', "在允许区域内禁止写入的路径数组（优先级高于 allowWrite）。"),
				items: { type: 'string' },
				default: []
			}
		},
		default: {
			denyRead: [],
			allowRead: [],
			allowWrite: [],
			denyWrite: []
		},
		tags: ['preview'],
		restricted: true,
	},
	[TerminalChatAgentToolsSettingId.AgentSandboxMacFileSystem]: {
		markdownDescription: localize('agentSandbox.macFileSystemSetting', "注意: 此设置仅在启用 {0} 时生效。控制 macOS 上沙盒中的文件系统访问权限。路径还支持 git 格式的 glob 模式(例如: *.ts、./src、./src/**/*.ts、file?.txt)。", `\`#${AgentSandboxSettingId.AgentSandboxEnabled}#\``),
		type: 'object',
		properties: {
			denyRead: {
				type: 'array',
				description: localize('agentSandbox.macFileSystemSetting.denyRead', "禁止读取访问的路径数组。留空表示允许读取所有路径。"),
				items: { type: 'string' },
				default: []
			},
			allowRead: {
				type: 'array',
				description: localize('agentSandbox.macFileSystemSetting.allowRead', "在被拒绝区域内重新允许读取的路径数组。优先级高于 denyRead。"),
				items: { type: 'string' },
				default: []
			},
			allowWrite: {
				type: 'array',
				description: localize('agentSandbox.macFileSystemSetting.allowWrite', "允许写权限的其他路径的数组。留空则禁止在工作区文件夹、工作区存储文件夹和沙盒临时目录之外进行写入。"),
				items: { type: 'string' },
				default: []
			},
			denyWrite: {
				type: 'array',
				description: localize('agentSandbox.macFileSystemSetting.denyWrite', "在允许区域内禁止写入的路径数组（优先级高于 allowWrite）。"),
				items: { type: 'string' },
				default: []
			}
		},
		default: {
			denyRead: [],
			allowRead: [],
			allowWrite: [],
			denyWrite: []
		},
		tags: ['preview'],
		restricted: true,
	},
	[TerminalChatAgentToolsSettingId.AgentSandboxWindowsFileSystem]: {
		markdownDescription: localize('agentSandbox.windowsFileSystemSetting', "注意: 此设置仅在启用 {0} 时生效。控制 Windows 上沙盒中的文件系统访问。路径不支持 glob 模式，仅支持字面路径(例如: C:\\src、C:\\Users\\me.ssh、.env)。", `\`#${AgentSandboxSettingId.AgentSandboxEnabled}#\``),
		type: 'object',
		properties: {
			denyRead: {
				type: 'array',
				description: localize('agentSandbox.windowsFileSystemSetting.denyRead', "拒绝访问的路径数组。留空则允许读取所有路径。"),
				items: { type: 'string' },
				default: []
			},
			allowRead: {
				type: 'array',
				description: localize('agentSandbox.windowsFileSystemSetting.allowRead', "允许只读访问的其他路径的数组。优先级高于 denyRead。"),
				items: { type: 'string' },
				default: []
			},
			allowWrite: {
				type: 'array',
				description: localize('agentSandbox.windowsFileSystemSetting.allowWrite', "允许读/写访问的其他路径的数组。留空则禁止在工作区文件夹、工作区存储文件夹和沙盒临时目录之外进行写入。"),
				items: { type: 'string' },
				default: []
			}
		},
		default: {
			denyRead: [],
			allowRead: [],
			allowWrite: []
		},
		tags: ['preview'],
		restricted: true,
	},
	[AgentSandboxSettingId.AgentSandboxWindowsSchemaVersion]: {
		// Intentionally available only to callers that explicitly set it in settings.json.
		included: false,
		restricted: true,
		type: 'string',
	},
	[TerminalChatAgentToolsSettingId.AgentSandboxAdvancedRuntime]: {
		markdownDescription: localize('agentSandbox.runtimeSetting', "注意: 此设置仅在启用 {0} 时生效。键/值对将传递到沙盒运行时配置的根目录。", `\`#${AgentSandboxSettingId.AgentSandboxEnabled}#\``),
		type: 'object',
		default: {
			enableWeakerNestedSandbox: false
		},
		additionalProperties: true,
		tags: ['preview'],
		restricted: true,
	},
	[TerminalChatAgentToolsSettingId.PreventShellHistory]: {
		type: 'boolean',
		default: true,
		markdownDescription: [
			localize('preventShellHistory.description', "是否将终端工具运行的命令排除在 shell 历史记录之外。有关支持的 shell 及其对应的方法，请参阅下文:"),
			`- \`bash\`: ${localize('preventShellHistory.description.bash', "设置 `HISTCONTROL=ignorespace` 并在命令前添加空格")}`,
			`- \`zsh\`: ${localize('preventShellHistory.description.zsh', "设置 `HIST_IGNORE_SPACE` 选项并在命令前添加空格")}`,
			`- \`fish\`: ${localize('preventShellHistory.description.fish', "设置 `fish_private_mode`，防止任何命令进入历史记录中")}`,
			`- \`pwsh\`: ${localize('preventShellHistory.description.pwsh', "通过 PSReadLine 的 `AddToHistoryHandler` 设置自定义历史记录处理程序，防止任何命令进入历史记录中")}`,
		].join('\n'),
	},
	[TerminalChatAgentToolsSettingId.EnforceTimeoutFromModel]: {
		restricted: true,
		type: 'boolean',
		default: true,
		tags: ['experimental'],
		experiment: {
			mode: 'auto'
		},
		markdownDescription: localize('enforceTimeoutFromModel.description', "是否在运行时强制执行模型在终端工具中提供的超时值。启用后，如果模型提供了超时参数，工具将在该时间后停止跟踪命令，并返回到目前为止收集的输出。"),
	},
	[TerminalChatAgentToolsSettingId.IdleSilenceTimeoutMs]: {
		restricted: true,
		type: 'number',
		default: DEFAULT_IDLE_SILENCE_TIMEOUT_MS,
		minimum: 0,
		tags: ['experimental'],
		experiment: {
			mode: 'auto'
		},
		markdownDescription: localize('idleSilenceTimeoutMs.description', "“在终端运行”工具等待来自同步命令的新输出的毫秒数，超时后移入后台终端并返回至今为止已收集的内容。进程不会终止 - 工具会返回终端 ID，以便模型可以轮询、发送输入或终止进程。设置为 {0} 以禁用。", '`0`'),
	},
	[TerminalChatAgentToolsSettingId.DetachBackgroundProcesses]: {
		included: false,
		restricted: true,
		type: 'boolean',
		default: false,
		tags: ['experimental'],
		markdownDescription: localize('detachBackgroundProcesses.description', "是否分离持久终端进程，使其在 Olympia 退出后仍能继续运行。启用后，以 `mode: \"async\"` (旧版: `isBackground: true`)启动的命令将使用 `nohup` (POSIX)或 `Start-Process` (Windows)包装，使进程在终端释放后仍继续运行。"),
	},
	[TerminalChatAgentToolsSettingId.BackgroundNotifications]: {
		restricted: true,
		type: 'boolean',
		default: true,
		tags: ['experimental'],
		deprecated: true,
		markdownDeprecationMessage: localize('backgroundNotifications.deprecated', "此设置已弃用。终端补全和需要输入通知现在始终启用。"),
		markdownDescription: localize('backgroundNotifications.description', "此设置已弃用，不再生效。对于工具返回后继续运行的任何命令，终端补全和需要输入通知现在始终启用。"),
	},
	[TerminalChatAgentToolsSettingId.OutputDeltas]: {
		restricted: true,
		type: 'boolean',
		default: false,
		tags: ['experimental'],
		experiment: {
			mode: 'auto'
		},
		markdownDescription: localize('outputDeltas.description', "启用后，重复“获取终端输出工具”调用仅返回自上次轮询以来为同一终端执行添加的输出；如果没有新输出，则返回一条简短的“输出未更改”消息。"),
	},
	[TerminalChatAgentToolsSettingId.OutputCompaction]: {
		restricted: true,
		type: 'boolean',
		default: false,
		tags: ['experimental'],
		experiment: {
			mode: 'auto'
		},
		markdownDescription: localize('outputCompaction.description', "启用后，「在终端中运行」工具跑出来的命令输出会先压缩一遍再交回模型：进度条、重复的日志行这类噪音少占 token，重要信息仍然保留。"),
	}
};

for (const id of [
	TerminalChatAgentToolsSettingId.DeprecatedAutoApprove1,
	TerminalChatAgentToolsSettingId.DeprecatedAutoApprove2,
	TerminalChatAgentToolsSettingId.DeprecatedAutoApprove3,
	TerminalChatAgentToolsSettingId.DeprecatedAutoApprove4,
	TerminalChatAgentToolsSettingId.DeprecatedAutoApproveCompatible,
]) {
	terminalChatAgentToolsConfiguration[id] = {
		...(id === TerminalChatAgentToolsSettingId.DeprecatedAutoApproveCompatible ? { restricted: true } : {}),
		deprecated: true,
		markdownDeprecationMessage: localize('autoApprove.deprecated', "请改用 {0}", `\`#${TerminalChatAgentToolsSettingId.AutoApprove}#\``)
	};
}
