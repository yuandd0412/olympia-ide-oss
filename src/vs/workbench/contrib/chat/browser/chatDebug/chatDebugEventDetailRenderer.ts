/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../../nls.js';
import { IChatDebugEvent } from '../../common/chatDebugService.js';
import { safeIntl } from '../../../../../base/common/date.js';

const numberFormatter = safeIntl.NumberFormat();

/**
 * Format the detail text for a debug event (used when no resolved content is available).
 */
export function formatEventDetail(event: IChatDebugEvent): string {
	switch (event.kind) {
		case 'toolCall': {
			const parts = [localize('chatDebug.detail.tool', "工具: {0}", event.toolName)];
			if (event.toolCallId) { parts.push(localize('chatDebug.detail.callId', "呼叫 ID: {0}", event.toolCallId)); }
			if (event.result) { parts.push(localize('chatDebug.detail.result', "结果：{0}", event.result)); }
			if (event.durationInMillis !== undefined) { parts.push(localize('chatDebug.detail.durationMs', "耗时：{0} 毫秒", numberFormatter.value.format(event.durationInMillis))); }
			if (event.input) { parts.push(`\n${localize('chatDebug.detail.input', "输入:")}\n${event.input}`); }
			if (event.output) { parts.push(`\n${localize('chatDebug.detail.output', "输出：")}\n${event.output}`); }
			return parts.join('\n');
		}
		case 'modelTurn': {
			const parts = [event.model ?? localize('chatDebug.detail.modelTurn', "模型轮次")];
			if (event.inputTokens !== undefined) { parts.push(localize('chatDebug.detail.inputTokens', "输入令牌数: {0}", numberFormatter.value.format(event.inputTokens))); }
			if (event.outputTokens !== undefined) { parts.push(localize('chatDebug.detail.outputTokens', "输出令牌数: {0}", numberFormatter.value.format(event.outputTokens))); }
			if (event.cachedTokens !== undefined) { parts.push(localize('chatDebug.detail.cachedTokens', "缓存的令牌: {0}", numberFormatter.value.format(event.cachedTokens))); }
			if (event.totalTokens !== undefined) { parts.push(localize('chatDebug.detail.totalTokens', "令牌总数: {0}", numberFormatter.value.format(event.totalTokens))); }
			if (event.durationInMillis !== undefined) { parts.push(localize('chatDebug.detail.durationMs', "耗时：{0} 毫秒", numberFormatter.value.format(event.durationInMillis))); }
			return parts.join('\n');
		}
		case 'generic':
			return `${event.name}\n${event.details ?? ''}`;
		case 'subagentInvocation': {
			const parts = [localize('chatDebug.detail.agent', "智能体: {0}", event.agentName)];
			if (event.description) { parts.push(localize('chatDebug.detail.description', "描述: {0}", event.description)); }
			if (event.status) { parts.push(localize('chatDebug.detail.status', "状态：{0}", event.status)); }
			if (event.durationInMillis !== undefined) { parts.push(localize('chatDebug.detail.durationMs', "耗时：{0} 毫秒", numberFormatter.value.format(event.durationInMillis))); }
			if (event.toolCallCount !== undefined) { parts.push(localize('chatDebug.detail.toolCallCount', "工具调用: {0}", numberFormatter.value.format(event.toolCallCount))); }
			if (event.modelTurnCount !== undefined) { parts.push(localize('chatDebug.detail.modelTurnCount', "模型回合: {0}", numberFormatter.value.format(event.modelTurnCount))); }
			return parts.join('\n');
		}
		case 'userMessage': {
			const parts = [localize('chatDebug.detail.userMessage', "用户消息: {0}", event.message)];
			for (const section of event.sections) {
				parts.push(`\n--- ${section.name} ---\n${section.content}`);
			}
			return parts.join('\n');
		}
		case 'agentResponse': {
			const parts = [localize('chatDebug.detail.agentResponse', "智能体响应: {0}", event.message)];
			for (const section of event.sections) {
				parts.push(`\n--- ${section.name} ---\n${section.content}`);
			}
			return parts.join('\n');
		}
	}
}
