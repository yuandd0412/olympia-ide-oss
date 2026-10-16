/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../nls.js';
import { INativeHostService } from '../../../platform/native/common/native.js';
import { IEditorService } from '../../services/editor/common/editorService.js';
import { Action2, MenuId } from '../../../platform/actions/common/actions.js';
import { Categories } from '../../../platform/action/common/actionCommonCategories.js';
import { ServicesAccessor } from '../../../platform/instantiation/common/instantiation.js';
import { IWorkbenchEnvironmentService } from '../../services/environment/common/environmentService.js';
import { KeybindingWeight } from '../../../platform/keybinding/common/keybindingsRegistry.js';
import { IsDevelopmentContext } from '../../../platform/contextkey/common/contextkeys.js';
import { KeyCode, KeyMod } from '../../../base/common/keyCodes.js';
import { INativeWorkbenchEnvironmentService } from '../../services/environment/electron-browser/environmentService.js';
import { URI } from '../../../base/common/uri.js';
import { getActiveWindow } from '../../../base/browser/dom.js';
import { IProgressService, ProgressLocation } from '../../../platform/progress/common/progress.js';
import { IDialogService } from '../../../platform/dialogs/common/dialogs.js';
import { IStatusbarEntryAccessor, IStatusbarService, StatusbarAlignment } from '../../services/statusbar/browser/statusbar.js';

export class ToggleDevToolsAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.toggleDevTools',
			title: localize2('toggleDevTools', "切换开发人员工具"),
			category: Categories.Developer,
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib + 50,
				when: IsDevelopmentContext,
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyI,
				mac: { primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyI }
			},
			menu: {
				id: MenuId.MenubarHelpMenu,
				group: '5_tools',
				order: 1,
				// 快捷键那条本来就有 `when: IsDevelopmentContext`，菜单项却谁都看得见：
				// 帮助菜单里因此常驻一条「切换开发人员工具」，学生点开会开出一个 DevTools 窗口，
				// 里面的 Console 是他唯一能敲 `alert()` 的地方。门径和快捷键对齐。
				when: IsDevelopmentContext
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const nativeHostService = accessor.get(INativeHostService);

		return nativeHostService.toggleDevTools({ targetWindowId: getActiveWindow().vscodeWindowId });
	}
}

export class ConfigureRuntimeArgumentsAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.configureRuntimeArguments',
			title: localize2('configureRuntimeArguments', "配置运行时参数"),
			category: Categories.Preferences,
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const environmentService = accessor.get(IWorkbenchEnvironmentService);

		await editorService.openEditor({
			resource: environmentService.argvResource,
			options: { pinned: true }
		});
	}
}

export class ReloadWindowWithExtensionsDisabledAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.reloadWindowWithExtensionsDisabled',
			title: localize2('reloadWindowWithExtensionsDisabled', "在禁用扩展的情况下重新加载"),
			category: Categories.Developer,
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		return accessor.get(INativeHostService).reload({ disableExtensions: true });
	}
}

export class OpenUserDataFolderAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.revealUserDataFolder',
			title: localize2('revealUserDataFolder', "显示用户数据文件夹"),
			category: Categories.Developer,
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const nativeHostService = accessor.get(INativeHostService);
		const environmentService = accessor.get(INativeWorkbenchEnvironmentService);

		return nativeHostService.showItemInFolder(URI.file(environmentService.userDataPath).fsPath);
	}
}

export class ShowGPUInfoAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.showGPUInfo',
			title: localize2('showGPUInfo', "显示 GPU 信息"),
			category: Categories.Developer,
			f1: true
		});
	}

	run(accessor: ServicesAccessor) {
		const nativeHostService = accessor.get(INativeHostService);
		nativeHostService.openGPUInfoWindow();
	}
}

export class ShowContentTracingAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.showContentTracing',
			title: localize2('showContentTracing', "显示内容跟踪"),
			category: Categories.Developer,
			f1: true
		});
	}

	run(accessor: ServicesAccessor) {
		const nativeHostService = accessor.get(INativeHostService);
		nativeHostService.openContentTracingWindow();
	}
}

let activeTracingEntry: IStatusbarEntryAccessor | undefined;

const tracingCategories = [
	'content',
	'renderer_host',
	'browser',
	'renderer',
	'blink',
	'blink.user_timing',
	'netlog',
	'net',
	'v8',
	'disabled-by-default-v8.cpu_profiler',
	'disabled-by-default-v8.compile',
	'disabled-by-default-v8.gc',
	'disabled-by-default-v8.gc_stats',
	'disabled-by-default-devtools.timeline',
	'disabled-by-default-network',
	'disabled-by-default-net',
];

async function startTracingSession(accessor: ServicesAccessor, options: { readonly enableHeapProfiling: boolean }): Promise<void> {
	const nativeHostService = accessor.get(INativeHostService);
	const statusbarService = accessor.get(IStatusbarService);

	const categories = [...tracingCategories];
	if (options.enableHeapProfiling) {
		categories.push('disabled-by-default-memory-infra');
	}

	await nativeHostService.startTracing(categories.join(','), { enableHeapProfiling: options.enableHeapProfiling });

	activeTracingEntry?.dispose();
	activeTracingEntry = statusbarService.addEntry({
		name: localize('startTracing.name', "性能跟踪"),
		text: '$(record) ' + localize('startTracing.recording', "正在录制跟踪(单击停止)"),
		ariaLabel: localize('startTracing.ariaLabel', "正在录制性能跟踪。单击停止录制。"),
		tooltip: localize('startTracing.tooltip', "单击停止录制"),
		kind: 'error',
		command: StopTracing.ID
	}, 'status.tracing', StatusbarAlignment.LEFT, -Number.MAX_VALUE);
}

export class StartTracing extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.startTracing',
			title: localize2('startTracing', "启动跟踪"),
			category: Categories.Developer,
			f1: true
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		await startTracingSession(accessor, { enableHeapProfiling: false });
	}
}

export class StartHeapTracing extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.startHeapTracing',
			title: localize2('startHeapTracing', "开始堆跟踪"),
			category: Categories.Developer,
			f1: true
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		await startTracingSession(accessor, { enableHeapProfiling: true });
	}
}

export class StopTracing extends Action2 {

	static readonly ID = 'workbench.action.stopTracing';

	constructor() {
		super({
			id: StopTracing.ID,
			title: localize2('stopTracing', "停止跟踪"),
			category: Categories.Developer,
			f1: true
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const nativeHostService = accessor.get(INativeHostService);
		const environmentService = accessor.get(INativeWorkbenchEnvironmentService);
		const dialogService = accessor.get(IDialogService);
		const progressService = accessor.get(IProgressService);

		if (!activeTracingEntry && !environmentService.args.trace) {
			const { confirmed } = await dialogService.confirm({
				message: localize('stopTracing.message', "没有正在进行的跟踪会话。使用“开发人员: 启动跟踪”或带有 \"--trace\" 参数启动以开始跟踪。"),
				primaryButton: localize({ key: 'stopTracing.button', comment: ['&& denotes a mnemonic'] }, "重新启动并启用跟踪(&&R)"),
			});

			if (confirmed) {
				return nativeHostService.relaunch({ addArgs: ['--trace'] });
			}

			return;
		}

		await progressService.withProgress({
			location: ProgressLocation.Dialog,
			title: localize('stopTracing.title', "正在创建跟踪文件..."),
			cancellable: false,
			detail: localize('stopTracing.detail', "这可能需要一分钟才能完成。")
		}, () => nativeHostService.stopTracing());

		activeTracingEntry?.dispose();
		activeTracingEntry = undefined;
	}
}
