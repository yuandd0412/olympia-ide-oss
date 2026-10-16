/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKey, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { ChatEntitlementContextKeys } from '../../../services/chat/common/chatEntitlementService.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { ChatContextKeys } from '../common/actions/chatContextKeys.js';
import { ChatAIDisabledSettingId } from '../common/constants.js';
import { COPILOT_VENDOR_ID, ILanguageModelsService } from '../common/languageModels.js';
import { ILanguageModelsConfigurationService } from '../common/languageModelsConfiguration.js';

/**
 * Owns the `github.copilot.hasByokModels` context key. The key is true iff:
 *  - `github.copilot.clientByokEnabled` is true (set by `ChatEntitlementService` + Copilot extension),
 *  - `chat.aiDisabled` is off, and
 *  - the language-models configuration has at least one non-Copilot vendor group (at any time),
 *    or a non-Copilot vendor is contributed by an extension in a `byokOnly` product (Olympia),
 *    or — pre extension scan — the `chatNonCopilotModelsAreUserSelectable` signal is on.
 *
 * Strategy (avoids activating BYOK extensions just to gate UI):
 *  1. Restore the last persisted answer for correct warm-reload UI.
 *  2. Configured non-Copilot vendor groups are a positive signal at any time.
 *  3. Pre-registration only, also trust the `chatNonCopilotModelsAreUserSelectable` signal
 *     (post-registration it can be stale — model cache lags behind group removal).
 *  4. Only persist `false` after both extension scan and first config load complete, so startup
 *     latency doesn't clobber a previously-true answer.
 *
 * Eager so the key is bound before any sign-in UI renders.
 */
export class HasByokModelsContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.hasByokModels';

	private static readonly STORAGE_KEY_LAST_KNOWN = 'chat.hasByokModels.lastKnown';

	private static readonly TRACKED_KEYS = new Set([
		ChatEntitlementContextKeys.clientByokEnabled.key,
		ChatContextKeys.nonCopilotLanguageModelsAreUserSelectable.key,
	]);

	private readonly _hasByokModels: IContextKey<boolean>;
	private _extensionsRegistered = false;
	private _configurationLoaded = false;

	constructor(
		@ILanguageModelsConfigurationService private readonly _languageModelsConfigurationService: ILanguageModelsConfigurationService,
		@IContextKeyService private readonly _contextKeyService: IContextKeyService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IStorageService private readonly _storageService: IStorageService,
		@IExtensionService extensionService: IExtensionService,
		@IProductService private readonly _productService: IProductService,
		@ILanguageModelsService private readonly _languageModelsService: ILanguageModelsService,
	) {
		super();

		this._hasByokModels = ChatEntitlementContextKeys.hasByokModels.bindTo(this._contextKeyService);

		this._restore();
		this._update();

		extensionService.whenInstalledExtensionsRegistered().then(() => {
			if (!this._store.isDisposed) {
				this._extensionsRegistered = true;
				this._update();
			}
		});

		this._languageModelsConfigurationService.whenReady.then(() => {
			if (!this._store.isDisposed) {
				this._configurationLoaded = true;
				this._update();
			}
		});

		this._register(Event.any(
			Event.filter(this._configurationService.onDidChangeConfiguration, e => e.affectsConfiguration(ChatAIDisabledSettingId)),
			Event.filter(this._contextKeyService.onDidChangeContext, e => e.affectsSome(HasByokModelsContribution.TRACKED_KEYS)),
			this._languageModelsConfigurationService.onDidChangeLanguageModelGroups,
		)(() => this._update()));
	}

	private _isFeatureEnabled(): boolean {
		return !this._configurationService.getValue<boolean>(ChatAIDisabledSettingId)
			&& !!this._contextKeyService.getContextKeyValue<boolean>(ChatEntitlementContextKeys.clientByokEnabled.key);
	}

	private _restore(): void {
		if (!this._isFeatureEnabled()) {
			this._hasByokModels.set(false);
			return;
		}
		this._hasByokModels.set(this._storageService.getBoolean(HasByokModelsContribution.STORAGE_KEY_LAST_KNOWN, StorageScope.APPLICATION, false));
	}

	private _setResult(value: boolean): void {
		this._hasByokModels.set(value);
		this._storageService.store(HasByokModelsContribution.STORAGE_KEY_LAST_KNOWN, value, StorageScope.APPLICATION, StorageTarget.MACHINE);
	}

	private _update(): void {
		if (!this._isFeatureEnabled()) {
			this._setResult(false);
			return;
		}

		const hasByokVendor = this._languageModelsConfigurationService.getLanguageModelsProviderGroups().some(g => g.vendor !== COPILOT_VENDOR_ID);
		if (hasByokVendor) {
			this._setResult(true);
			return;
		}

		// Olympia：本产品的模型由我们自己注册的 vendor 提供（olympia-coach 贡献 languageModelChatProviders
		// 再用 lm.registerLanguageModelChatProvider 填上），它不写 chatLanguageModels.json——那个文件是
		// Copilot 那套「配置提供方」界面的存储。只认文件的话这个 key 永远是 false，模型选择器停在
		// 「先配置」分支，我们的模型根本列不出来。byokOnly 下贡献点里有一个非 copilot 的 vendor
		// 就等于产品自带一条 BYOK 路。
		if (this._productService.defaultChatAgent?.byokOnly
			&& this._languageModelsService.getVendors().some(v => v.vendor !== COPILOT_VENDOR_ID)) {
			this._setResult(true);
			return;
		}

		// Pre-registration only: trust the user-selectable signal as an optimistic positive.
		// Post-registration it can be stale (model cache lags behind group removal), so ignore.
		if (!this._extensionsRegistered && this._contextKeyService.getContextKeyValue<boolean>(ChatContextKeys.nonCopilotLanguageModelsAreUserSelectable.key)) {
			this._setResult(true);
			return;
		}

		// Defer negative result until startup signals have settled.
		if (this._extensionsRegistered && this._configurationLoaded) {
			this._setResult(false);
		}
	}
}
