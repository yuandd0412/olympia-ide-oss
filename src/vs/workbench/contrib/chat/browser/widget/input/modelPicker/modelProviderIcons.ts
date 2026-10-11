/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../../../../base/common/themables.js';
import { localize } from '../../../../../../../nls.js';
import { registerIcon } from '../../../../../../../platform/theme/common/iconRegistry.js';
import { ILanguageModelChatMetadataAndIdentifier, isAutoLanguageModel } from '../../../../common/languageModels.js';
import { getCompactCodicon } from '../../../chatIcons.js';
import { isHydraFusionModel } from './modelPickerPresentation.js';

const copilotModelProviderIcon = registerIcon('chat-model-provider-copilot', Codicon.copilotCompact, localize('chatModelProviderCopilotIcon', "Copilot 模型图标。"));
const openAIModelProviderIcon = registerIcon('chat-model-provider-openai', Codicon.openai, localize('chatModelProviderOpenAIIcon', "OpenAI 模型图标。"));
const claudeModelProviderIcon = registerIcon('chat-model-provider-claude', Codicon.claude, localize('chatModelProviderClaudeIcon', "Claude 模型图标。"));
const geminiModelProviderIcon = registerIcon('chat-model-provider-gemini', Codicon.googleGemini, localize('chatModelProviderGeminiIcon', "Gemini 模型图标。"));
const kimiModelProviderIcon = registerIcon('chat-model-provider-kimi', Codicon.kimi, localize('chatModelProviderKimiIcon', "Kimi 模型图标。"));
const microsoftModelProviderIcon = registerIcon('chat-model-provider-microsoft', Codicon.microsoft, localize('chatModelProviderMicrosoftIcon', "Microsoft 模型图标。"));
const xAIModelProviderIcon = registerIcon('chat-model-provider-xai', Codicon.xai, localize('chatModelProviderXAIIcon', "xAI 模型图标。"));
const genericModelProviderIcon = registerIcon('chat-model-provider-generic', Codicon.sparkle, localize('chatModelProviderGenericIcon', "其他模型提供方的图标。"));
const genericModelProviderCompactIcon = registerIcon('chat-model-provider-generic-compact', Codicon.sparkleCompact, localize('chatModelProviderGenericCompactIcon', "其他模型提供方的紧凑图标。"));

/**
 * The provider icon matching a free-form identity string (vendor, family, model
 * or provider name). Falls back to a generic icon when nothing matches.
 */
export function getProviderIconForIdentity(identity: string, copilotIdentity: string = identity): ThemeIcon {
	const normalized = identity.toLowerCase();
	if (normalized.includes('grok') || normalized.includes('xai')) {
		return xAIModelProviderIcon;
	}
	if (normalized.includes('claude') || normalized.includes('anthropic')) {
		return claudeModelProviderIcon;
	}
	if (normalized.includes('gemini') || normalized.includes('google')) {
		return geminiModelProviderIcon;
	}
	if (normalized.includes('kimi') || normalized.includes('moonshot')) {
		return kimiModelProviderIcon;
	}
	if (normalized.includes('microsoft') || /\bmai\b/.test(normalized)) {
		return microsoftModelProviderIcon;
	}
	if (normalized.includes('openai') || normalized.includes('chatgpt') || normalized.includes('gpt') || normalized.includes('codex') || /\bo[134]\b/.test(normalized)) {
		return openAIModelProviderIcon;
	}
	// Checked last, so a more specific match always wins.
	if (copilotIdentity.toLowerCase().includes('copilot')) {
		return copilotModelProviderIcon;
	}
	return genericModelProviderIcon;
}

export function getModelProviderIcon(model: ILanguageModelChatMetadataAndIdentifier): ThemeIcon {
	const identity = `${model.metadata.vendor} ${model.metadata.family} ${model.metadata.id} ${model.metadata.name}`;
	if (/grok|xai/i.test(identity)) {
		return xAIModelProviderIcon;
	}
	if (model.metadata.isBYOK) {
		return genericModelProviderIcon;
	}
	if (isAutoLanguageModel(model) || isHydraFusionModel(model)) {
		return copilotModelProviderIcon;
	}
	// The Copilot fallback reads the model's own name only: the vendor is `copilot` for
	// every first-party model, so including it would brand the whole catalogue.
	return getProviderIconForIdentity(identity, `${model.metadata.id} ${model.metadata.name}`);
}

export function getModelPickerIcon(model: ILanguageModelChatMetadataAndIdentifier): ThemeIcon {
	return model.metadata.statusIcon ?? getModelProviderIcon(model);
}

export function getCompactModelPickerIcon(model: ILanguageModelChatMetadataAndIdentifier): ThemeIcon {
	const icon = getModelPickerIcon(model);
	return icon.id === genericModelProviderIcon.id ? genericModelProviderCompactIcon : getCompactCodicon(icon);
}
