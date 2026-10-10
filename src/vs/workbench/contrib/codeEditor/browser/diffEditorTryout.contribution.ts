/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { registerOnboardingTryout } from '../../onboarding/common/onboardingTryout.js';
import { EditorSampleTryoutPayload } from '../../onboarding/common/onboardingTryoutActions.js';

class DiffEditorTryoutContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.diffEditorTryout';

	constructor() {
		super();
		this._register(registerOnboardingTryout<EditorSampleTryoutPayload>({
			id: 'editor.smart-diff',
			title: localize('diffEditor.tryout.title', "尝试智能差异布局"),
			description: localize('diffEditor.tryout.description', "打开一个只读的示例对比。使用「差异视图」选择行内、并排或自动布局，然后调整编辑器尺寸。"),
			presentation: {
				kind: 'editorSample',
				payload: {
					type: 'diff',
					title: localize('diffEditor.tryout.editorTitle', "智能差异布局示例"),
					languageId: 'typescript',
					original: [
						'interface Project {',
						'\tname: string;',
						'\tarchived: boolean;',
						'}',
						'',
						'export function findProject(projects: Project[], name: string): Project | undefined {',
						'\treturn projects.find(project => project.name === name);',
						'}',
						'',
						'export function listProjects(projects: Project[]): string[] {',
						'\treturn projects.map(project => project.name);',
						'}',
					].join('\n'),
					modified: [
						'interface Project {',
						'\tname: string;',
						'\tarchived: boolean;',
						'}',
						'',
						'export function findProject(projects: Project[], name: string): Project | undefined {',
						'\tconst normalizedName = name.trim().toLowerCase();',
						'\treturn projects.find(project => project.name.toLowerCase() === normalizedName);',
						'}',
						'',
						'export function listProjects(projects: Project[]): string[] {',
						'\treturn projects',
						'\t\t.filter(project => !project.archived)',
						'\t\t.map(project => project.name)',
						'\t\t.sort();',
						'}',
					].join('\n'),
				},
			},
		}));
	}
}

registerWorkbenchContribution2(DiffEditorTryoutContribution.ID, DiffEditorTryoutContribution, WorkbenchPhase.BlockRestore);
