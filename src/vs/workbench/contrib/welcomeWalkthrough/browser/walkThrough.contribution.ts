/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { WalkThroughInput } from './walkThroughInput.js';
import { WalkThroughPart } from './walkThroughPart.js';
import { WalkThroughArrowUp, WalkThroughArrowDown, WalkThroughPageUp, WalkThroughPageDown } from './walkThroughActions.js';
import { WalkThroughSnippetContentProvider } from '../common/walkThroughContentProvider.js';
import { EditorWalkThroughInputSerializer } from './editor/editorWalkThrough.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../common/editor.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { IEditorPaneRegistry, EditorPaneDescriptor } from '../../../browser/editor.js';
import { KeybindingsRegistry } from '../../../../platform/keybinding/common/keybindingsRegistry.js';

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane)
	.registerEditorPane(EditorPaneDescriptor.create(
		WalkThroughPart,
		WalkThroughPart.ID,
		localize('walkThrough.editor.label', "操场"),
	),
		[new SyncDescriptor(WalkThroughInput)]);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(EditorWalkThroughInputSerializer.ID, EditorWalkThroughInputSerializer);

registerWorkbenchContribution2(WalkThroughSnippetContentProvider.ID, WalkThroughSnippetContentProvider, { editorTypeId: WalkThroughPart.ID });

KeybindingsRegistry.registerCommandAndKeybindingRule(WalkThroughArrowUp);

KeybindingsRegistry.registerCommandAndKeybindingRule(WalkThroughArrowDown);

KeybindingsRegistry.registerCommandAndKeybindingRule(WalkThroughPageUp);

KeybindingsRegistry.registerCommandAndKeybindingRule(WalkThroughPageDown);

// 「编辑器操场」整页是上游英文内容、结尾还链到微软文档，面向的是扩展作者而不是写题解的学生；
// 命令注册已经去掉，所以命令面板里也搜不到它。差异编辑器与 walkThrough 的序列化器仍留着：
// 别的内置向导（欢迎页那几张卡片）共用这套编辑器，去掉注册会把它们一起弄坏。
