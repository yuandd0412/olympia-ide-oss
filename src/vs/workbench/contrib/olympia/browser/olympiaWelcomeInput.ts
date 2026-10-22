/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { URI } from '../../../../base/common/uri.js';
import { IUntypedEditorInput } from '../../../common/editor.js';

export const olympiaWelcomeInputTypeId = 'workbench.editors.olympiaWelcomeInput';

export class OlympiaWelcomeInput extends EditorInput {

	static readonly ID = olympiaWelcomeInputTypeId;

	static readonly RESOURCE = URI.from({ scheme: 'olympia-welcome', authority: 'olympia', path: '/welcome' });

	override get typeId(): string {
		return OlympiaWelcomeInput.ID;
	}

	override get editorId(): string | undefined {
		return this.typeId;
	}

	override toUntyped(): IUntypedEditorInput {
		return {
			resource: OlympiaWelcomeInput.RESOURCE,
			options: {
				override: OlympiaWelcomeInput.ID,
				pinned: false
			}
		};
	}

	get resource(): URI | undefined {
		return OlympiaWelcomeInput.RESOURCE;
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(other)) {
			return true;
		}
		return other instanceof OlympiaWelcomeInput;
	}

	override getName() {
		return localize('olympiaWelcome', "Olympia 开始页");
	}
}
