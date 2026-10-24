/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { URI } from '../../../../base/common/uri.js';
import { IUntypedEditorInput } from '../../../common/editor.js';

export const olympiaSettingsInputTypeId = 'workbench.editors.olympiaSettingsInput';

/**
 * Olympia 简化设置页的编辑器输入。
 *
 * ## 为什么是独立 scheme
 *
 * 上游 `PreferencesEditorInput` 用 `vscode-settings:` scheme 认领设置资源。
 * 本页是**另一张页面**，不是上游设置页的变体，所以用独立 scheme `olympia-settings`
 * —— 与 `OlympiaWelcomeInput`（`olympia-welcome`）同一套思路。
 *
 * 代价：scheme 字面量在 contribution 里还要再写一次（`registerEditor` 的 pattern）。
 * `check-olympia-settings-page.mjs` 有一条断言强制两处字面量一致。
 */
export class OlympiaSettingsInput extends EditorInput {

	static readonly ID = olympiaSettingsInputTypeId;

	static readonly RESOURCE = URI.from({ scheme: 'olympia-settings', authority: 'olympia', path: '/settings' });

	override get typeId(): string {
		return OlympiaSettingsInput.ID;
	}

	override get editorId(): string | undefined {
		return this.typeId;
	}

	override toUntyped(): IUntypedEditorInput {
		return {
			resource: OlympiaSettingsInput.RESOURCE,
			options: {
				override: OlympiaSettingsInput.ID,
				pinned: true
			}
		};
	}

	get resource(): URI | undefined {
		return OlympiaSettingsInput.RESOURCE;
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(other)) {
			return true;
		}
		return other instanceof OlympiaSettingsInput;
	}

	override getName() {
		return localize('olympiaSettings', "Olympia 设置");
	}
}
