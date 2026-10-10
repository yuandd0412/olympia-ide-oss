/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';

// The strings localized in this file will get pulled into the manifest of the language packs.
// So that they are available for VS Code to use without downloading the entire language pack.

export const minimumTranslatedStrings: { [key: string]: string } = {
	showLanguagePackExtensions: localize('showLanguagePackExtensions', "在商店中搜索语言包并将显示语言更改为 {0}。"),
	searchMarketplace: localize('searchMarketplace', "搜索市场"),
	installAndRestartMessage: localize('installAndRestartMessage', "安装语言包并将显示语言更改为 {0}。"),
	installAndRestart: localize('installAndRestart', "安装并重启")
};