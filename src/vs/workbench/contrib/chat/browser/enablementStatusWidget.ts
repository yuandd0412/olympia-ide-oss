/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { reset } from '../../../../base/browser/dom.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { IObservable, autorun } from '../../../../base/common/observable.js';
import { localize } from '../../../../nls.js';
import { IMarkdownRendererService } from '../../../../platform/markdown/browser/markdownRenderer.js';
import { ContributionEnablementState } from '../common/enablement.js';

/**
 * A small reusable widget that renders an enablement status message inside
 * a `.status` container, matching the style used by the extension and MCP
 * server editors. The message is shown only when the contribution is
 * disabled and is rendered as markdown with a theme icon prefix.
 */
export class EnablementStatusWidget extends Disposable {

	private readonly _renderDisposables = this._register(new MutableDisposable());

	constructor(
		private readonly _container: HTMLElement,
		enablement: IObservable<ContributionEnablementState>,
		private readonly _labels: {
			disabledProfile: string;
			disabledWorkspace: string;
		},
		@IMarkdownRendererService private readonly _markdownRendererService: IMarkdownRendererService,
	) {
		super();
		this._register(autorun(reader => {
			this._render(enablement.read(reader));
		}));
	}

	private _render(state: ContributionEnablementState): void {
		reset(this._container);
		this._renderDisposables.value = undefined;

		let message: string | undefined;
		if (state === ContributionEnablementState.DisabledProfile) {
			message = this._labels.disabledProfile;
		} else if (state === ContributionEnablementState.DisabledWorkspace) {
			message = this._labels.disabledWorkspace;
		}

		if (!message) {
			return;
		}

		const markdown = new MarkdownString('', { isTrusted: true, supportThemeIcons: true });
		markdown.appendMarkdown(`$(${Codicon.info.id})&nbsp;`);
		markdown.appendText(message);
		const rendered = this._markdownRendererService.render(markdown);
		this._renderDisposables.value = rendered;
		this._container.appendChild(rendered.element);
	}
}

/** Default labels for plugin enablement status. */
export const pluginEnablementLabels = {
	disabledProfile: localize('pluginDisabled', "此插件已禁用。"),
	disabledWorkspace: localize('pluginDisabledWorkspace', "已为此工作区禁用此插件。"),
};

/** Default labels for MCP server enablement status. */
export const mcpServerEnablementLabels = {
	disabledProfile: localize('mcpServerDisabled', "此 MCP 服务器已禁用。"),
	disabledWorkspace: localize('mcpServerDisabledWorkspace', "已为此工作区禁用此 MCP 服务器。"),
};
