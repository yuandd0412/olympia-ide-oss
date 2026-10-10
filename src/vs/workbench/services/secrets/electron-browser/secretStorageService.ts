/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createSingleCallFunction } from '../../../../base/common/functional.js';
import { isLinux } from '../../../../base/common/platform.js';
import Severity from '../../../../base/common/severity.js';
import { localize } from '../../../../nls.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IEncryptionService, KnownStorageProvider, PasswordStoreCLIOption, isGnome, isKwallet } from '../../../../platform/encryption/common/encryptionService.js';
import { INativeEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { INotificationService, IPromptChoice } from '../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { BaseSecretStorageService, ISecretStorageService } from '../../../../platform/secrets/common/secrets.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IJSONEditingService } from '../../configuration/common/jsonEditing.js';

export class NativeSecretStorageService extends BaseSecretStorageService {

	constructor(
		@INotificationService private readonly _notificationService: INotificationService,
		@IDialogService private readonly _dialogService: IDialogService,
		@IOpenerService private readonly _openerService: IOpenerService,
		@IJSONEditingService private readonly _jsonEditingService: IJSONEditingService,
		@INativeEnvironmentService private readonly _environmentService: INativeEnvironmentService,
		@IStorageService storageService: IStorageService,
		@IEncryptionService encryptionService: IEncryptionService,
		@ILogService logService: ILogService
	) {
		super(
			!!_environmentService.useInMemorySecretStorage,
			storageService,
			encryptionService,
			logService
		);
	}

	override set(key: string, value: string): Promise<void> {
		this._sequencer.queue(key, async () => {
			await this.resolvedStorageService;

			if (this.type !== 'persisted' && !this._environmentService.useInMemorySecretStorage) {
				this._logService.trace('[NativeSecretStorageService] Notifying user that secrets are not being stored on disk.');
				await this.notifyOfNoEncryptionOnce();
			}

		});

		return super.set(key, value);
	}

	private notifyOfNoEncryptionOnce = createSingleCallFunction(() => this.notifyOfNoEncryption());
	private async notifyOfNoEncryption(): Promise<void> {
		const buttons: IPromptChoice[] = [];
		const troubleshootingButton: IPromptChoice = {
			label: localize('troubleshootingButton', "打开疑难解答指南"),
			run: () => this._openerService.open('https://go.microsoft.com/fwlink/?linkid=2239490'),
			// doesn't close dialogs
			keepOpen: true
		};
		buttons.push(troubleshootingButton);

		let errorMessage = localize('encryptionNotAvailableJustTroubleshootingGuide', "无法识别用于在当前桌面环境中存储加密相关数据的 OS keyring。");

		if (!isLinux) {
			this._notificationService.prompt(Severity.Error, errorMessage, buttons);
			return;
		}

		const provider = await this._encryptionService.getKeyStorageProvider();
		if (provider === KnownStorageProvider.basicText) {
			const detail = localize('usePlainTextExtraSentence', "请打开疑难解答指南以解决此问题，也可以使用不用 OS keyring 的较弱加密。");
			const usePlainTextButton: IPromptChoice = {
				label: localize('usePlainText', "使用较弱的加密"),
				run: async () => {
					await this._encryptionService.setUsePlainTextEncryption();
					await this._jsonEditingService.write(this._environmentService.argvResource, [{ path: ['password-store'], value: PasswordStoreCLIOption.basic }], true);
					this.reinitialize();
				}
			};
			buttons.unshift(usePlainTextButton);

			await this._dialogService.prompt({
				type: 'error',
				buttons,
				message: errorMessage,
				detail
			});
			return;
		}

		if (isGnome(provider)) {
			errorMessage = localize('isGnome', "你正在 GNOME 环境中运行，但 OS keyring 不可用用于加密。请确保已安装并运行 gnome-keyring 或其他 libsecret 兼容实现。");
		} else if (isKwallet(provider)) {
			errorMessage = localize('isKwallet', "你正在 KDE 环境中运行，但 OS keyring 不可用于加密。请确保 kwallet 正在运行。");
		}

		this._notificationService.prompt(Severity.Error, errorMessage, buttons);
	}
}

registerSingleton(ISecretStorageService, NativeSecretStorageService, InstantiationType.Delayed);
