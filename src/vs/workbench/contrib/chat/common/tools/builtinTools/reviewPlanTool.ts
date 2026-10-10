/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { raceCancellation } from '../../../../../../base/common/async.js';
import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { Codicon } from '../../../../../../base/common/codicons.js';
import { CancellationError } from '../../../../../../base/common/errors.js';
import { MarkdownString } from '../../../../../../base/common/htmlContent.js';
import { IJSONSchema, IJSONSchemaMap } from '../../../../../../base/common/jsonSchema.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../../base/common/themables.js';
import { URI } from '../../../../../../base/common/uri.js';
import { generateUuid } from '../../../../../../base/common/uuid.js';
import { localize } from '../../../../../../nls.js';
import { ILogService } from '../../../../../../platform/log/common/log.js';
import { IChatPlanApprovalAction, IChatPlanReviewResult, IChatService } from '../../chatService/chatService.js';
import { IChatRequestModel } from '../../model/chatModel.js';
import { ChatPlanReviewData } from '../../model/chatProgressTypes/chatPlanReviewData.js';
import { CountTokensCallback, IPreparedToolInvocation, IToolData, IToolImpl, IToolInvocation, IToolInvocationPreparationContext, IToolResult, ToolDataSource, ToolProgress } from '../languageModelToolsService.js';

export const ReviewPlanToolId = 'vscode_reviewPlan';

export interface IReviewPlanParams {
	readonly title?: string;
	readonly plan?: string;
	readonly content: string;
	readonly actions: IChatPlanApprovalAction[];
	readonly canProvideFeedback: boolean;
}

export function createReviewPlanToolData(): IToolData {
	const approvalActionSchema: IJSONSchema & { properties: IJSONSchemaMap } = {
		type: 'object',
		properties: {
			label: {
				type: 'string',
				description: 'Short action label shown in the dropdown button.'
			},
			description: {
				type: 'string',
				description: 'Optional detail shown below the label in the dropdown list.'
			},
			default: {
				type: 'boolean',
				description: 'Whether this action should be selected by default.'
			},
			permissionLevel: {
				type: 'string',
				enum: ['autopilot'],
				description: 'When set to "autopilot", a confirmation dialog is shown before proceeding.'
			}
		},
		required: ['label']
	};

	const inputSchema: IJSONSchema & { properties: IJSONSchemaMap } = {
		type: 'object',
		properties: {
			title: {
				type: 'string',
				description: 'Title displayed in the widget header. Defaults to "Plan summary" if omitted.'
			},
			plan: {
				type: 'string',
				description: 'Optional URI of an editable plan file. An Edit button in the widget header opens it in the editor.'
			},
			content: {
				type: 'string',
				description: 'Markdown content rendered in the body of the widget. May be the plan summary or full plan text.'
			},
			actions: {
				type: 'array',
				description: 'List of approval actions offered in the primary dropdown button. Order is preserved.',
				items: approvalActionSchema,
				minItems: 1
			},
			canProvideFeedback: {
				type: 'boolean',
				description: 'When true, an additional feedback textarea is shown below the plan content.'
			}
		},
		required: ['content', 'actions', 'canProvideFeedback']
	};

	return {
		id: ReviewPlanToolId,
		toolReferenceName: 'reviewPlan',
		canBeReferencedInPrompt: false,
		icon: ThemeIcon.fromId(Codicon.checklist.id),
		displayName: localize('tool.reviewPlan.displayName', "审阅计划"),
		userDescription: localize('tool.reviewPlan.userDescription', "请用户审阅并批准计划后再继续。"),
		modelDescription: 'Use this tool to present a plan to the user for review. Provide the plan content as markdown, a list of approval actions (with optional default), and whether the user can provide freeform feedback. Optionally provide a URI to the backing plan file so the user can edit it. The tool returns the chosen action, whether the plan was rejected, and any feedback.',
		source: ToolDataSource.Internal,
		inputSchema
	};
}

export const ReviewPlanToolData: IToolData = createReviewPlanToolData();

export class ReviewPlanTool extends Disposable implements IToolImpl {

	constructor(
		@IChatService private readonly chatService: IChatService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	async invoke(invocation: IToolInvocation, _countTokens: CountTokensCallback, _progress: ToolProgress, token: CancellationToken): Promise<IToolResult> {
		const parameters = invocation.parameters as IReviewPlanParams;
		const { title, plan, content, actions, canProvideFeedback } = parameters;

		if (!actions || actions.length === 0) {
			throw new Error(localize('reviewPlanTool.noActions', "必须提供至少一项审批操作。"));
		}

		const { request } = this.getRequest(invocation.context?.sessionResource, invocation.chatRequestId);
		if (!request) {
			this.logService.warn('[ReviewPlanTool] Missing chat context; returning rejected result.');
			return this.toResult({ rejected: true });
		}

		let planUri: URI | undefined;
		if (plan) {
			try {
				planUri = URI.parse(plan);
			} catch {
				try {
					planUri = URI.file(plan);
				} catch {
					planUri = undefined;
				}
			}
		}

		const reviewData = new ChatPlanReviewData(
			title ?? localize('reviewPlanTool.defaultTitle', "审阅计划"),
			content,
			actions,
			canProvideFeedback,
			planUri?.toJSON(),
			generateUuid(),
		);

		this.chatService.appendProgress(request, reviewData);

		const result = await raceCancellation(reviewData.completion.p, token);
		if (token.isCancellationRequested) {
			reviewData.dismiss();
			throw new CancellationError();
		}

		return this.toResult(result ?? { rejected: true });
	}

	async prepareToolInvocation(context: IToolInvocationPreparationContext, _token: CancellationToken): Promise<IPreparedToolInvocation | undefined> {
		const parameters = context.parameters as IReviewPlanParams;
		if (!parameters.actions || parameters.actions.length === 0) {
			throw new Error(localize('reviewPlanTool.noActions', "必须提供至少一项审批操作。"));
		}
		return {
			invocationMessage: new MarkdownString(localize('reviewPlanTool.invocation', "正在请你审阅计划")),
			pastTenseMessage: new MarkdownString(localize('reviewPlanTool.invocation.past', "已要求你审阅计划"))
		};
	}

	private toResult(result: IChatPlanReviewResult): IToolResult {
		return {
			content: [{ kind: 'text', value: JSON.stringify(result) }]
		};
	}

	private getRequest(chatSessionResource: URI | undefined, chatRequestId: string | undefined): { request: IChatRequestModel | undefined } {
		if (!chatSessionResource) {
			return { request: undefined };
		}
		const model = this.chatService.getSession(chatSessionResource);
		if (!model) {
			return { request: undefined };
		}
		let request: IChatRequestModel | undefined;
		if (chatRequestId) {
			request = model.getRequests().find(r => r.id === chatRequestId);
		}
		if (!request) {
			request = model.getRequests().at(-1);
		}
		return { request };
	}
}
