/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import Severity from '../../../../base/common/severity.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { ASSISTED_APPROVAL_DONT_SHOW_AGAIN_KEY, AUTO_APPROVE_DONT_SHOW_AGAIN_KEY, AUTOPILOT_DONT_SHOW_AGAIN_KEY } from './chatPermissionStorageKeys.js';
import { ChatConfiguration, ChatPermissionLevel } from './constants.js';

/**
 * In-memory record of warnings already accepted in this VS Code session.
 * Checked alongside the persisted "Don't show again" storage value so that the
 * warning isn't repeated within a session even when the user didn't tick the
 * checkbox.
 *
 * Per-renderer; the `StorageScope.PROFILE` storage entry is what synchronizes
 * the dismissed state across windows (workbench and Agents).
 */
const shownWarnings = new Set<ChatPermissionLevel>();

function dontShowAgainKey(level: ChatPermissionLevel): string | undefined {
	if (level === ChatPermissionLevel.Autopilot) {
		return AUTOPILOT_DONT_SHOW_AGAIN_KEY;
	}
	if (level === ChatPermissionLevel.AutoApprove) {
		return AUTO_APPROVE_DONT_SHOW_AGAIN_KEY;
	}
	if (level === ChatPermissionLevel.Assisted) {
		return ASSISTED_APPROVAL_DONT_SHOW_AGAIN_KEY;
	}
	return undefined;
}

/**
 * Clears the in-process suppression set so that previously accepted (but not
 * persistently dismissed) warnings will be shown again within this session.
 * Call this alongside removing the persisted storage keys when implementing a
 * "reset" developer action.
 */
export function resetShownWarnings(): void {
	shownWarnings.clear();
}

/**
 * Relative "auto-approval reach" of each elevated level, used to suppress
 * lower-level warnings once a stronger one has been accepted. Bypass Approvals
 * and Autopilot both auto-approve *every* tool call, so confirming either in
 * this session (or persistently) implies acceptance of the other — the user is
 * not warned again when stepping between them (e.g. Autopilot → Bypass).
 */
const ELEVATION_RANK: ReadonlyMap<ChatPermissionLevel, number> = new Map([
	[ChatPermissionLevel.Assisted, 1],
	[ChatPermissionLevel.AutoApprove, 2],
	[ChatPermissionLevel.Autopilot, 2],
]);

export function hasShownElevatedWarning(level: ChatPermissionLevel, storageService: IStorageService): boolean {
	const rank = ELEVATION_RANK.get(level);
	if (rank === undefined) {
		return false;
	}
	// Accepting any elevated level whose reach is >= this one (in this session
	// or persistently) suppresses the warning.
	for (const [candidate, candidateRank] of ELEVATION_RANK) {
		if (candidateRank < rank) {
			continue;
		}
		if (shownWarnings.has(candidate)) {
			return true;
		}
		const key = dontShowAgainKey(candidate);
		if (key && storageService.getBoolean(key, StorageScope.PROFILE, false)) {
			return true;
		}
	}
	return false;
}

interface IElevatedWarningCopy {
	readonly title: string;
	readonly confirm: string;
	readonly icon: ThemeIcon;
	readonly detail: string;
}

function getElevatedWarningCopy(level: ChatPermissionLevel, defaultSettingKey: string, levelLabel?: string): IElevatedWarningCopy | undefined {
	switch (level) {
		case ChatPermissionLevel.Assisted:
			levelLabel ??= localize('permissions.assisted', "Auto Approvals");
			return {
				title: localize('permissions.assisted.warning.title', "Enable {0}?", levelLabel),
				confirm: localize('permissions.assisted.warning.confirm', "启用"),
				icon: Codicon.sparkle,
				detail: localize('permissions.assisted.warning.detail', "{0} uses model recommendations to approve tool calls. Copilot will still ask when the model requires approval, excludes the request from automatic approval, or cannot make a recommendation.\n\nTo make this the starting permission level for new sessions, change the [{1}](command:workbench.action.openSettings?%5B%22{1}%22%5D) setting.", levelLabel, defaultSettingKey),
			};
		case ChatPermissionLevel.Autopilot:
			return {
				title: localize('permissions.autopilot.warning.title', "是否启用 Autopilot?"),
				confirm: localize('permissions.autopilot.warning.confirm', "启用"),
				icon: Codicon.rocket,
				detail: localize('permissions.autopilot.warning.detail', "Autopilot 会自动批准所有工具调用，并自主继续工作，直到任务完成。这包括终端命令、文件编辑和外部工具调用。智能体会代表你做出决策，无需确认。\r\n\r\n可以随时通过单击“停止”按钮来停止智能体。此操作仅适用于当前会话。\r\n\r\n若要将此项设置为新会话的初始权限级别，请更改 [{0}](command:workbench.action.openSettings?%5B%22{0}%22%5D)设置。", defaultSettingKey),
			};
		case ChatPermissionLevel.AutoApprove:
			levelLabel ??= localize('permissions.autoApprove', "绕过审批");
			return {
				title: localize('permissions.autoApprove.warning.title', "Enable {0}?", levelLabel),
				confirm: localize('permissions.autoApprove.warning.confirm', "启用"),
				icon: Codicon.warning,
				detail: localize('permissions.autoApprove.warning.detail', "绕过审批将自动批准所有工具调用，无需确认。这包括文件编辑、终端命令和外部工具调用。\r\n\r\n若要将此项设置为新会话的初始权限级别，请更改 [{0}](command:workbench.action.openSettings?%5B%22{0}%22%5D)设置。", levelLabel, defaultSettingKey),
			};
		default:
			return undefined;
	}
}

/**
 * If `level` is an elevated permission level (Bypass Approvals or Autopilot)
 * that hasn't already been confirmed in this session or persistently
 * dismissed, show the corresponding warning dialog. Returns:
 *
 * - `true` if the level is not elevated, has already been confirmed, or the
 *   user accepts the dialog. In these cases the caller should proceed to apply
 *   the level.
 * - `false` if the user cancels the dialog. The caller should abort the
 *   permission change.
 *
 * When the user ticks "Don't show again", the choice is persisted in
 * `StorageScope.PROFILE`, which is shared across the workbench and Agents
 * windows so a dismissal in one applies to the other.
 *
 * `options.defaultSettingKey` controls which "make this the default" setting
 * the dialog links to — local chat uses `chat.permissions.default` (the
 * default), while agent-host sessions pass
 * `chat.defaultConfiguration`.
 */
export async function maybeConfirmElevatedPermissionLevel(
	level: ChatPermissionLevel,
	dialogService: IDialogService,
	storageService: IStorageService,
	options?: { readonly defaultSettingKey?: string; readonly levelLabel?: string },
): Promise<boolean> {
	const key = dontShowAgainKey(level);
	if (!key || hasShownElevatedWarning(level, storageService)) {
		return true;
	}

	const copy = getElevatedWarningCopy(level, options?.defaultSettingKey ?? ChatConfiguration.DefaultPermissionLevel, options?.levelLabel);
	if (!copy) {
		return true;
	}

	const result = await dialogService.prompt({
		type: Severity.Warning,
		message: copy.title,
		buttons: [
			{
				label: copy.confirm,
				run: () => true,
			},
			{
				label: localize('permissions.warning.cancel', "取消"),
				run: () => false,
			},
		],
		checkbox: {
			label: localize('permissions.warning.dontShowAgain', "不再显示"),
			checked: false,
		},
		custom: {
			icon: copy.icon,
			markdownDetails: [{
				markdown: new MarkdownString(
					copy.detail,
					{ isTrusted: { enabledCommands: ['workbench.action.openSettings'] } },
				),
			}],
		},
	});
	if (result.result !== true) {
		return false;
	}
	if (result.checkboxChecked) {
		storageService.store(key, true, StorageScope.PROFILE, StorageTarget.USER);
	}
	shownWarnings.add(level);
	return true;
}
