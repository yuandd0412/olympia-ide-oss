/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { fromNow } from '../../../base/common/date.js';
import { isLinuxSnap } from '../../../base/common/platform.js';
import { localize } from '../../../nls.js';
import { IOSProperties } from '../../native/common/native.js';
import { IProductService } from '../../product/common/productService.js';
import { process } from '../../../base/parts/sandbox/electron-browser/globals.js';

function formatCopilotVersion(version: string | undefined): string {
	return version?.replace(/-(?:canary|unstable)(?=\.|$)/, '').replace(/\.unsigned$/, '') || 'Unknown';
}

export function createNativeAboutDialogDetails(productService: IProductService, osProps: IOSProperties): { title: string; details: string; detailsToCopy: string } {
	let version = productService.version;
	if (productService.target) {
		version = `${version} (${productService.target} setup)`;
	} else if (productService.darwinUniversalAssetId) {
		version = `${version} (Universal)`;
	}

	const copilotRuntimeVersion = formatCopilotVersion(productService.copilotVersions?.runtime);
	const copilotSdkVersion = formatCopilotVersion(productService.copilotVersions?.sdk);

	const getDetails = (useAgo: boolean): string => {
		return localize({ key: 'aboutDetail', comment: ['Electron, Chromium, Node.js, V8 and Copilot are product names that need no translation'] },
			"版本: {0}\r\n提交: {1}\r\n日期: {2}\r\nElectron: {3}\r\nElectronBuildId: {4}\r\nChromium: {5}\r\nNode.js: {6}\r\nV8: {7}\r\nOS: {8}",
			version,
			productService.commit || 'Unknown',
			productService.date ? `${productService.date}${useAgo ? ' (' + fromNow(new Date(productService.date), true) + ')' : ''}` : 'Unknown',
			process.versions['electron'],
			process.versions['microsoft-build'],
			process.versions['chrome'],
			process.versions['node'],
			process.versions['v8'],
			copilotRuntimeVersion,
			copilotSdkVersion,
			`${osProps.type} ${osProps.arch} ${osProps.release}${isLinuxSnap ? ' snap' : ''}`
		);
	};

	const details = getDetails(true);
	const detailsToCopy = getDetails(false);

	return {
		title: productService.nameLong,
		details: details,
		detailsToCopy: detailsToCopy
	};
}
