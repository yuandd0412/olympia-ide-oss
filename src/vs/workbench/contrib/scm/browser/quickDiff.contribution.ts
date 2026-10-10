/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorContributionInstantiation, registerEditorContribution } from '../../../../editor/browser/editorExtensions.js';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { localize } from '../../../../nls.js';
import { MenuId, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IQuickDiffService } from '../common/quickDiff.js';
import { QuickDiffService } from '../common/quickDiffService.js';
import { QuickDiffWorkbenchController } from './quickDiffDecorator.js';
import { IQuickDiffModelService, QuickDiffModelService } from './quickDiffModel.js';
import { QuickDiffEditorController } from './quickDiffWidget.js';

MenuRegistry.appendMenuItem(MenuId.EditorLineNumberContext, {
	title: localize('quickDiffDecoration', "差异装饰"),
	submenu: MenuId.SCMQuickDiffDecorations,
	when: ContextKeyExpr.or(
		ContextKeyExpr.equals('config.scm.diffDecorations', 'all'),
		ContextKeyExpr.equals('config.scm.diffDecorations', 'gutter')),
	group: '9_quickDiffDecorations'
});

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(QuickDiffWorkbenchController, LifecyclePhase.Restored);

registerEditorContribution(QuickDiffEditorController.ID,
	QuickDiffEditorController, EditorContributionInstantiation.AfterFirstRender);

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'scm',
	order: 5,
	title: localize('scmConfigurationTitle', "源代码管理"),
	type: 'object',
	scope: ConfigurationScope.RESOURCE,
	properties: {
		'scm.diffDecorations': {
			type: 'string',
			enum: ['all', 'gutter', 'overview', 'minimap', 'none'],
			enumDescriptions: [
				localize('scm.diffDecorations.all', "在所有可用位置显示差异装饰。"),
				localize('scm.diffDecorations.gutter', "仅在编辑器装订线显示差异装饰。"),
				localize('scm.diffDecorations.overviewRuler', "仅在标尺显示差异装饰。"),
				localize('scm.diffDecorations.minimap', "仅在缩略图显示差异装饰。"),
				localize('scm.diffDecorations.none', "不显示差异装饰。")
			],
			default: 'all',
			description: localize('diffDecorations', "控制编辑器中的差异装饰。")
		},
		'scm.diffDecorationsGutterWidth': {
			type: 'number',
			enum: [1, 2, 3, 4, 5],
			default: 3,
			description: localize('diffGutterWidth', "控制装订线中差异装饰的宽度（像素）（新增与修改）。")
		},
		'scm.diffDecorationsGutterVisibility': {
			type: 'string',
			enum: ['always', 'hover'],
			enumDescriptions: [
				localize('scm.diffDecorationsGutterVisibility.always', "始终在装订线中显示差异装饰。"),
				localize('scm.diffDecorationsGutterVisibility.hover', "仅在悬停时于装订线中显示差异装饰。")
			],
			description: localize('scm.diffDecorationsGutterVisibility', "控制装订线中源代码差异装饰的可见性。"),
			default: 'always'
		},
		'scm.diffDecorationsGutterAction': {
			type: 'string',
			enum: ['diff', 'none'],
			enumDescriptions: [
				localize('scm.diffDecorationsGutterAction.diff', "单击时显示内联差异窥视视图。"),
				localize('scm.diffDecorationsGutterAction.none', "不做任何操作。")
			],
			description: localize('scm.diffDecorationsGutterAction', "控制源代码差异装订线装饰的行为。"),
			default: 'diff'
		},
		'scm.diffDecorationsGutterPattern': {
			type: 'object',
			description: localize('diffGutterPattern', "控制装订线差异装饰是否使用图案。"),
			additionalProperties: false,
			properties: {
				'added': {
					type: 'boolean',
					description: localize('diffGutterPatternAdded', "新增行的装订线差异装饰使用图案。"),
				},
				'modified': {
					type: 'boolean',
					description: localize('diffGutterPatternModifed', "修改行的装订线差异装饰使用图案。"),
				},
			},
			default: {
				'added': false,
				'modified': true
			}
		},
		'scm.diffDecorationsIgnoreTrimWhitespace': {
			type: 'string',
			enum: ['true', 'false', 'inherit'],
			enumDescriptions: [
				localize('scm.diffDecorationsIgnoreTrimWhitespace.true', "忽略行首和行尾空白。"),
				localize('scm.diffDecorationsIgnoreTrimWhitespace.false', "不忽略行首和行尾空白。"),
				localize('scm.diffDecorationsIgnoreTrimWhitespace.inherit', "继承 `diffEditor.ignoreTrimWhitespace` 的设置。")
			],
			description: localize('diffDecorationsIgnoreTrimWhitespace', "控制源代码差异装订线装饰是否忽略行首行尾空白。"),
			default: 'false'
		}
	}
});

registerSingleton(IQuickDiffService, QuickDiffService, InstantiationType.Delayed);
registerSingleton(IQuickDiffModelService, QuickDiffModelService, InstantiationType.Delayed);
