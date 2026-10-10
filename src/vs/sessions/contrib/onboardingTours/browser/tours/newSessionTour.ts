/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IObservable } from '../../../../../base/common/observable.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { EditorPartModalContext } from '../../../../../workbench/common/contextkeys.js';
import { ChatContextKeys } from '../../../../../workbench/contrib/chat/common/actions/chatContextKeys.js';
import { IOnboardingScenario } from '../../../../../workbench/contrib/onboarding/common/onboardingScenario.js';
import { ISpotlightPayload, SPOTLIGHT_PRESENTATION_KIND } from '../../../../../workbench/contrib/onboarding/browser/spotlight/spotlightTypes.js';
import { localize } from '../../../../../nls.js';
import { NewSessionOnboardingHandoffContext } from '../../../../common/contextkeys.js';

/**
 * Spotlight steps shown after the user presses the pulsing "New Session"
 * button. The tour runs in the new-session view and teaches the workspace and
 * isolation options:
 *
 *  1. The workspace picker.
 *  2. The isolation picker (worktree vs folder).
 *
 * Each `targetId` matches a `data-onboarding-id` set via `markOnboardingTarget`:
 *  - `sessions.newSession.workspacePicker` — contrib/chat/browser/sessionWorkspacePicker.ts
 *  - `sessions.newSession.isolation` — provider-specific config/isolation pickers
 */
export const NEW_SESSION_TOUR_ID = 'sessions.onboarding.newSession';

/**
 * Shared "shown" persistence key for the new-session onboarding tours. The
 * The new-session tour variants teach the same setup flow, so they record their
 * once-per-user state under this single key.
 *
 * The value matches {@link NEW_SESSION_TOUR_ID} so users who already saw the
 * original tour (state persisted under that id) are not shown the variant.
 */
export const NEW_SESSION_ONBOARDING_SEEN_KEY = NEW_SESSION_TOUR_ID;

/**
 * ExP treatment flag names for Tour 2's A/B experiment.
 *
 * - `behaviorFlag` — boolean: `true` shows the tour (treatment), `false` is control.
 * - `assignmentContextIdFlag` — string: the current arm's ExP variant name, which
 *   MUST start with the reserved `onb-` prefix (see
 *   `ONBOARDING_ASSIGNMENT_CONTEXT_PREFIX`). It is distinct from Tour 1's id so the
 *   two tours report into separate scorecards.
 */
const NEW_SESSION_EXPERIMENT = {
	behaviorFlag: 'onb.newSession.show',
	assignmentContextIdFlag: 'onb.newSession.id',
} as const;

const newSessionPayload: ISpotlightPayload = {
	steps: [
		{
			id: 'workspacePicker',
			targetId: 'sessions.newSession.workspacePicker',
			title: localize('sessions.onboarding.workspace.title', "跨工作区工作"),
			description: localize('sessions.onboarding.workspace.description', "在你处理的文件夹和存储库之间进行选择。在单个工作区中或跨多个工作区一次运行多个会话。"),
			placement: 'above',
		},
		{
			id: 'isolation',
			targetId: 'sessions.newSession.isolation',
			title: localize('sessions.onboarding.isolation.title', "隔离你的工作"),
			description: localize('sessions.onboarding.isolation.description', "使用工作树在同一项目中处理多个任务，而不会发生冲突。每个任务保持隔离，以便你可以自由、安全地进行试验。"),
			placement: 'below',
		},
	],
};

/**
 * Builds the "new session" tour scenario. The provided `signal` controls *when*
 * the spotlight steps become eligible — it is driven by
 * {@link NewSessionTourContribution}, which flips it after the eligible user
 * presses the pulsing New Session button.
 * `ChatContextKeys.enabled` keeps the tour hidden when AI features are disabled.
 * The modal-editor gate keeps the tour hidden while a modal editor is showing.
 */
export function createNewSessionTour(signal: IObservable<boolean>): IOnboardingScenario<ISpotlightPayload> {
	return {
		id: NEW_SESSION_TOUR_ID,
		seenKey: NEW_SESSION_ONBOARDING_SEEN_KEY,
		when: ContextKeyExpr.and(ChatContextKeys.enabled, EditorPartModalContext.toNegated(), NewSessionOnboardingHandoffContext.toNegated()),
		trigger: { kind: 'observable', signal },
		priority: 100,
		experiment: NEW_SESSION_EXPERIMENT,
		presentation: {
			kind: SPOTLIGHT_PRESENTATION_KIND,
			payload: newSessionPayload,
		},
	};
}
