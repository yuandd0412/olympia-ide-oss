/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { AI_CUSTOMIZATION_CATEGORY, AI_CUSTOMIZATION_VIEW_ID, AICustomizationItemMenuId, FOCUS_AI_CUSTOMIZATION_VIEW_ID } from './aiCustomizationTreeView.js';
import { AICustomizationItemDisabledContextKey, AICustomizationItemStorageContextKey, AICustomizationItemTypeContextKey, AICustomizationViewPane } from './aiCustomizationTreeViewViews.js';
import { PromptsType } from '../../../../workbench/contrib/chat/common/promptSyntax/promptTypes.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { URI } from '../../../../base/common/uri.js';
import { IEditorService } from '../../../../workbench/services/editor/common/editorService.js';
import { IFileService, FileSystemProviderCapabilities } from '../../../../platform/files/common/files.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IPromptsService, PromptsStorage } from '../../../../workbench/contrib/chat/common/promptSyntax/service/promptsService.js';
import { IViewsService } from '../../../../workbench/services/views/common/viewsService.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { SessionsView, SessionsViewId } from '../../sessions/browser/views/sessionsView.js';
import { IsSessionsWindowContext } from '../../../../workbench/common/contextkeys.js';
import { TerminalContextKeys } from '../../../../workbench/contrib/terminal/common/terminalContextKey.js';
import { ChatContextKeys } from '../../../../workbench/contrib/chat/common/actions/chatContextKeys.js';
import { IsPhoneLayoutContext } from '../../../common/contextkeys.js';

//#region Utilities

/**
 * Type for context passed to actions from tree context menus.
 * Handles both direct URI arguments and serialized context objects.
 */
type ItemContext = { uri: URI | string; promptType?: string; disabled?: boolean;[key: string]: unknown } | URI | string;

/**
 * Extracts a URI from various context formats.
 * Context can be a URI, string, or an object with uri property.
 */
function extractURI(context: ItemContext): URI {
	if (URI.isUri(context)) {
		return context;
	}
	if (typeof context === 'string') {
		return URI.parse(context);
	}
	if (URI.isUri(context.uri)) {
		return context.uri;
	}
	return URI.parse(context.uri as string);
}

//#endregion

//#region Context Menu Actions

// Open file action
const OPEN_AI_CUSTOMIZATION_FILE_ID = 'aiCustomization.openFile';
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: OPEN_AI_CUSTOMIZATION_FILE_ID,
			title: localize2('open', "打开"),
			icon: Codicon.goToFile,
		});
	}
	async run(accessor: ServicesAccessor, context: ItemContext): Promise<void> {
		const editorService = accessor.get(IEditorService);
		await editorService.openEditor({
			resource: extractURI(context)
		});
	}
});


// Run prompt action
const RUN_PROMPT_FROM_VIEW_ID = 'aiCustomization.runPrompt';
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: RUN_PROMPT_FROM_VIEW_ID,
			title: localize2('runPrompt', "运行提示词"),
			icon: Codicon.play,
		});
	}
	async run(accessor: ServicesAccessor, context: ItemContext): Promise<void> {
		const commandService = accessor.get(ICommandService);
		await commandService.executeCommand('workbench.action.chat.run.prompt.current', extractURI(context));
	}
});

// Delete file action
const DELETE_AI_CUSTOMIZATION_FILE_ID = 'aiCustomization.deleteFile';
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: DELETE_AI_CUSTOMIZATION_FILE_ID,
			title: localize2('delete', "删除"),
			icon: Codicon.trash,
		});
	}
	async run(accessor: ServicesAccessor, context: ItemContext): Promise<void> {
		const fileService = accessor.get(IFileService);
		const dialogService = accessor.get(IDialogService);
		const uri = extractURI(context);
		const name = typeof context === 'object' && !URI.isUri(context) ? (context as { name?: string }).name ?? '' : '';

		if (uri.scheme !== 'file') {
			return;
		}

		const confirmation = await dialogService.confirm({
			message: localize('confirmDelete', "确定要删除“{0}”吗？", name || uri.path),
			primaryButton: localize('delete', "删除"),
		});

		if (confirmation.confirmed) {
			const useTrash = fileService.hasCapability(uri, FileSystemProviderCapabilities.Trash);
			await fileService.del(uri, { useTrash, recursive: true });
		}
	}
});

// Copy path action
const COPY_AI_CUSTOMIZATION_PATH_ID = 'aiCustomization.copyPath';
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: COPY_AI_CUSTOMIZATION_PATH_ID,
			title: localize2('copyPath', "复制路径"),
			icon: Codicon.clippy,
		});
	}
	async run(accessor: ServicesAccessor, context: ItemContext): Promise<void> {
		const clipboardService = accessor.get(IClipboardService);
		const uri = extractURI(context);
		const textToCopy = uri.scheme === 'file' ? uri.fsPath : uri.toString(true);
		await clipboardService.writeText(textToCopy);
	}
});

// Register context menu items

// Inline hover actions (shown as icon buttons on hover)
MenuRegistry.appendMenuItem(AICustomizationItemMenuId, {
	command: { id: DELETE_AI_CUSTOMIZATION_FILE_ID, title: localize('delete', "删除"), icon: Codicon.trash },
	group: 'inline',
	order: 10,
});

// Context menu items (shown on right-click)
MenuRegistry.appendMenuItem(AICustomizationItemMenuId, {
	command: { id: OPEN_AI_CUSTOMIZATION_FILE_ID, title: localize('open', "打开") },
	group: '1_open',
	order: 1,
});

MenuRegistry.appendMenuItem(AICustomizationItemMenuId, {
	command: { id: RUN_PROMPT_FROM_VIEW_ID, title: localize('runPrompt', "运行提示词"), icon: Codicon.play },
	group: '2_run',
	order: 1,
	when: ContextKeyExpr.equals(AICustomizationItemTypeContextKey.key, PromptsType.prompt),
});

MenuRegistry.appendMenuItem(AICustomizationItemMenuId, {
	command: { id: COPY_AI_CUSTOMIZATION_PATH_ID, title: localize('copyPath', "复制路径") },
	group: '3_modify',
	order: 1,
});

MenuRegistry.appendMenuItem(AICustomizationItemMenuId, {
	command: { id: DELETE_AI_CUSTOMIZATION_FILE_ID, title: localize('delete', "删除") },
	group: '3_modify',
	order: 10,
});

// Disable item action
const DISABLE_AI_CUSTOMIZATION_ITEM_ID = 'aiCustomization.disableItem';
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: DISABLE_AI_CUSTOMIZATION_ITEM_ID,
			title: localize2('disable', "禁用"),
			icon: Codicon.eyeClosed,
		});
	}
	async run(accessor: ServicesAccessor, context: ItemContext): Promise<void> {
		if (typeof context !== 'object' || URI.isUri(context)) {
			return;
		}
		const promptsService = accessor.get(IPromptsService);
		const viewsService = accessor.get(IViewsService);
		const uri = extractURI(context);
		const promptType = context.promptType as PromptsType | undefined;
		if (!promptType) {
			return;
		}

		const disabled = promptsService.getDisabledPromptFiles(promptType);
		disabled.add(uri);
		promptsService.setDisabledPromptFiles(promptType, disabled);

		const view = viewsService.getActiveViewWithId<AICustomizationViewPane>(AI_CUSTOMIZATION_VIEW_ID);
		view?.refresh();
	}
});

// Enable item action
const ENABLE_AI_CUSTOMIZATION_ITEM_ID = 'aiCustomization.enableItem';
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: ENABLE_AI_CUSTOMIZATION_ITEM_ID,
			title: localize2('enable', "启用"),
			icon: Codicon.eye,
		});
	}
	async run(accessor: ServicesAccessor, context: ItemContext): Promise<void> {
		if (typeof context !== 'object' || URI.isUri(context)) {
			return;
		}
		const promptsService = accessor.get(IPromptsService);
		const viewsService = accessor.get(IViewsService);
		const uri = extractURI(context);
		const promptType = context.promptType as PromptsType | undefined;
		if (!promptType) {
			return;
		}

		const disabled = promptsService.getDisabledPromptFiles(promptType);
		disabled.delete(uri);
		promptsService.setDisabledPromptFiles(promptType, disabled);

		const view = viewsService.getActiveViewWithId<AICustomizationViewPane>(AI_CUSTOMIZATION_VIEW_ID);
		view?.refresh();
	}
});

// Context menu: Disable (shown when builtin item is enabled)
MenuRegistry.appendMenuItem(AICustomizationItemMenuId, {
	command: { id: DISABLE_AI_CUSTOMIZATION_ITEM_ID, title: localize('disable', "禁用") },
	group: '4_toggle',
	order: 1,
	when: ContextKeyExpr.and(
		ContextKeyExpr.equals(AICustomizationItemDisabledContextKey.key, false),
		ContextKeyExpr.equals(AICustomizationItemStorageContextKey.key, PromptsStorage.builtIn),
		ContextKeyExpr.equals(AICustomizationItemTypeContextKey.key, PromptsType.skill),
	),
});

// Context menu: Enable (shown when builtin item is disabled)
MenuRegistry.appendMenuItem(AICustomizationItemMenuId, {
	command: { id: ENABLE_AI_CUSTOMIZATION_ITEM_ID, title: localize('enable', "启用") },
	group: '4_toggle',
	order: 1,
	when: ContextKeyExpr.and(
		ContextKeyExpr.equals(AICustomizationItemDisabledContextKey.key, true),
		ContextKeyExpr.equals(AICustomizationItemStorageContextKey.key, PromptsStorage.builtIn),
		ContextKeyExpr.equals(AICustomizationItemTypeContextKey.key, PromptsType.skill),
	),
});

// Inline hover: Disable (shown when builtin item is enabled)
MenuRegistry.appendMenuItem(AICustomizationItemMenuId, {
	command: { id: DISABLE_AI_CUSTOMIZATION_ITEM_ID, title: localize('disable', "禁用"), icon: Codicon.eyeClosed },
	group: 'inline',
	order: 5,
	when: ContextKeyExpr.and(
		ContextKeyExpr.equals(AICustomizationItemDisabledContextKey.key, false),
		ContextKeyExpr.equals(AICustomizationItemStorageContextKey.key, PromptsStorage.builtIn),
		ContextKeyExpr.equals(AICustomizationItemTypeContextKey.key, PromptsType.skill),
	),
});

// Inline hover: Enable (shown when builtin item is disabled)
MenuRegistry.appendMenuItem(AICustomizationItemMenuId, {
	command: { id: ENABLE_AI_CUSTOMIZATION_ITEM_ID, title: localize('enable', "启用"), icon: Codicon.eye },
	group: 'inline',
	order: 5,
	when: ContextKeyExpr.and(
		ContextKeyExpr.equals(AICustomizationItemDisabledContextKey.key, true),
		ContextKeyExpr.equals(AICustomizationItemStorageContextKey.key, PromptsStorage.builtIn),
		ContextKeyExpr.equals(AICustomizationItemTypeContextKey.key, PromptsType.skill),
	),
});

//#endregion

//#region Focus Action

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: FOCUS_AI_CUSTOMIZATION_VIEW_ID,
			title: localize2('focusCustomizations', "聚焦聊天自定义"),
			category: AI_CUSTOMIZATION_CATEGORY,
			precondition: ContextKeyExpr.and(IsSessionsWindowContext, ChatContextKeys.enabled, IsPhoneLayoutContext.negate()),
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyC,
				when: ContextKeyExpr.and(IsSessionsWindowContext, ChatContextKeys.enabled, IsPhoneLayoutContext.negate(), TerminalContextKeys.focus.negate()),
			},
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		const sessionsView = await viewsService.openView<SessionsView>(SessionsViewId, false);
		sessionsView?.focusCustomizations();
	}
});

//#endregion
