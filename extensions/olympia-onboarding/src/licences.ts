/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  许可证与第三方组件：产品自带的文本，离线也能读到。
 *
 *  Olympia 装在机房里，多数时候没有网。上游把「许可证」菜单项指向 `product.licenseUrl`
 *  （一个 GitHub 页面），在这台机器上点了就是一张打不开的网页——既读不到 MIT 要求的版权与
 *  许可文本，也读不到 MinGW 工具链那份 GPL 的书面要约。所以这里改成打开**随安装包一起
 *  发出去的文件**，并且优先打开我们自己那份中文清单（它逐条说明每个组件的许可证与出处）。
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { dirname, join } from 'path';

/**
 * 按打开的优先级排：先是 Olympia 自己的中文清单，再是上游的 MIT 与第三方清单，最后是 Chromium
 * 那份巨大的 HTML。文件名就是产品目录里看到的样子，不在第二个地方复制一遍。
 */
import { DOCS } from './site';

const LICENCE_DOCS: readonly { readonly file: string; readonly label: string }[] = [
	{ file: 'NOTICE.olympia.txt', label: 'Olympia 许可证与第三方组件' },
	{ file: 'GPL-3.0.txt', label: 'GPL-3.0 许可证（Olympia 自研部分）' },
	{ file: 'LICENSE.txt', label: 'MIT 许可证' },
	{ file: 'ThirdPartyNotices.txt', label: '第三方组件声明' },
	{ file: 'LICENSES.chromium.html', label: 'Chromium 许可证' }
];

/**
 * `vscode.env.appRoot` 在装机产物里是 `<安装目录>\resources\app`，上游那三个文本文件都落在
 * 这一层；开发树里它是仓库根（`oss/`），文件名相同。少一层猜测：真找不到时按上一层再试一次，
 * 这样即使某天打包目录改了布局，这条命令也不会静默打开一个空白页。
 */
function candidateRoots(): string[] {
	const appRoot = vscode.env.appRoot;
	return [appRoot, dirname(dirname(appRoot))];
}

async function existing(paths: readonly string[]): Promise<string | undefined> {
	for (const path of paths) {
		try {
			await vscode.workspace.fs.stat(vscode.Uri.file(path));
			return path;
		} catch {
			// 这一层没有，换下一个候选根目录。
		}
	}
	return undefined;
}

async function findLicenceDocs(): Promise<{ readonly found: readonly string[]; readonly missing: readonly string[] }> {
	const found: string[] = [];
	const missing: string[] = [];
	for (const doc of LICENCE_DOCS) {
		const hit = await existing(candidateRoots().map(root => join(root, doc.file)));
		if (hit) {
			found.push(hit);
		} else {
			missing.push(doc.file);
		}
	}
	return { found, missing };
}

/** 面板那一行与命令面板都走这里：一次打开找到的全部许可文本，标题说清是哪一份。 */
export async function openLicenceNotices(): Promise<boolean> {
	const { found, missing } = await findLicenceDocs();
	if (!found.length) {
		const action = await vscode.window.showWarningMessage(
			`在这台机器的 Olympia 目录里没找到许可证文本（${LICENCE_DOCS.map(d => d.file).join('、')}）。安装可能被安全软件动过。`,
			'打开官网查看'
		);
		if (action === '打开官网查看') {
			await vscode.env.openExternal(vscode.Uri.parse(DOCS));
		}
		return false;
	}
	for (const path of found) {
		const editor = await vscode.window.showTextDocument(vscode.Uri.file(path), { preview: true, preserveFocus: false });
		// preview: true 让这几份文本共用一个预览标签，不会在学生开了三个文件之后又挤进来四个。
		void editor;
	}
	if (missing.length) {
		await vscode.window.showInformationMessage(`这份安装里没有 ${missing.join('、')}，其余许可证文本已经打开。`);
	}
	return true;
}
