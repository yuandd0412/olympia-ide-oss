/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isEmptyPattern, parse, splitGlobAware } from '../../../../../../base/common/glob.js';
import { Iterable } from '../../../../../../base/common/iterator.js';
import { Range } from '../../../../../../editor/common/core/range.js';
import { localize } from '../../../../../../nls.js';
import { IMarkerData, MarkerSeverity, MarkerTag } from '../../../../../../platform/markers/common/markers.js';
import { ChatMode, IChatMode, IChatModeService } from '../../chatModes.js';
import { ChatModeKind } from '../../constants.js';
import { ILanguageModelChatMetadata, ILanguageModelsService } from '../../languageModels.js';
import { ILanguageModelToolsService, SpecedToolAliases } from '../../tools/languageModelToolsService.js';
import { PromptsType, Target } from '../promptTypes.js';
import { ISequenceValue, IHeaderAttribute, IScalarValue, isPromptFileTildePath, parseCommaSeparatedList, ParsedPromptFile, PromptHeader, IValue, PromptHeaderAttributes } from '../promptFileParser.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { IPromptsService } from '../service/promptsService.js';
import { ILabelService } from '../../../../../../platform/label/common/label.js';
import { AGENTS_SOURCE_FOLDER, CLAUDE_AGENTS_SOURCE_FOLDER, isInClaudeRulesFolder, isSkillFilename, LEGACY_MODE_FILE_EXTENSION, VALID_SKILL_NAME_REGEX } from '../config/promptFileLocations.js';
import { Lazy } from '../../../../../../base/common/lazy.js';
import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { dirname } from '../../../../../../base/common/resources.js';
import { URI } from '../../../../../../base/common/uri.js';
import { HOOKS_BY_TARGET } from '../hookTypes.js';
import { GithubPromptHeaderAttributes } from './promptFileAttributes.js';
import { ILogService } from '../../../../../../platform/log/common/log.js';
import { IPathService } from '../../../../../services/path/common/pathService.js';

export const MARKERS_OWNER_ID = 'prompts-diagnostics-provider';

export const enum PromptValidatorMarkerCode {
	MissingGithubMcpServer = 'promptValidator.missingGithubMcpServer',
	MissingPlaywrightMcpServer = 'promptValidator.missingPlaywrightMcpServer',
	UnknownExtensionReference = 'promptValidator.unknownExtensionReference',
	UnknownMcpServerReference = 'promptValidator.unknownMcpServerReference',
	UnknownExtensionOrMcpServerReference = 'promptValidator.unknownExtensionOrMcpServerReference'
}

export class PromptValidator {
	constructor(
		@ILanguageModelsService private readonly languageModelsService: ILanguageModelsService,
		@ILanguageModelToolsService private readonly languageModelToolsService: ILanguageModelToolsService,
		@IChatModeService private readonly chatModeService: IChatModeService,
		@IFileService private readonly fileService: IFileService,
		@ILabelService private readonly labelService: ILabelService,
		@IPromptsService private readonly promptsService: IPromptsService,
		@ILogService private readonly logger: ILogService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IPathService private readonly pathService: IPathService,
	) { }

	public async validate(promptAST: ParsedPromptFile, promptType: PromptsType, report: (markers: IMarkerData) => void): Promise<void> {
		promptAST.header?.errors.forEach(error => report(toMarker(error.message, error.range, MarkerSeverity.Error)));
		const target = getTarget(promptType, promptAST.header ?? promptAST.uri);
		await this.validateHeader(promptAST, promptType, target, report);
		await this.validateBody(promptAST, target, report);
		await this.validateFileName(promptAST, promptType, report);
		await this.validateSkillAttributes(promptAST, promptType, report);
	}

	private async validateFileName(promptAST: ParsedPromptFile, promptType: PromptsType, report: (markers: IMarkerData) => void): Promise<void> {
		if (promptType === PromptsType.agent && promptAST.uri.path.endsWith(LEGACY_MODE_FILE_EXTENSION)) {
			const location = this.promptsService.getAgentFileURIFromModeFile(promptAST.uri);
			if (location && await this.fileService.canCreateFile(location)) {
				report(toMarker(localize('promptValidator.chatModesRenamedToAgents', "聊天模式已重命名为智能体。请将此文件移动到 {0}", location.toString()), new Range(1, 1, 1, 4), MarkerSeverity.Warning));
			} else {
				report(toMarker(localize('promptValidator.chatModesRenamedToAgentsNoMove', "聊天模式已重命名为智能体。请将该文件移动到 {0}", AGENTS_SOURCE_FOLDER), new Range(1, 1, 1, 4), MarkerSeverity.Warning));
			}
		}
	}

	private async validateSkillAttributes(promptAST: ParsedPromptFile, promptType: PromptsType, report: (markers: IMarkerData) => void): Promise<void> {
		if (promptType !== PromptsType.skill || !promptAST.header) {
			return;
		}

		const nameAttribute = promptAST.header.getAttribute(PromptHeaderAttributes.name);
		if (!nameAttribute) {
			report(toMarker(
				localize('promptValidator.skillNameMissing', "技能必须提供名称。"),
				new Range(1, 1, 1, 4),
				MarkerSeverity.Warning
			));
		} else if (nameAttribute.value.type === 'scalar') {
			const skillName = nameAttribute.value.value.trim();
			if (skillName.length > 0) {
				if (!VALID_SKILL_NAME_REGEX.test(skillName)) {
					report(toMarker(
						localize('promptValidator.skillNameInvalidChars', "技能名称只能包含小写字母、数字和连字符。"),
						nameAttribute.value.range,
						MarkerSeverity.Error
					));
				}

				// Extract folder name from path (e.g., .github/skills/my-skill/SKILL.md -> my-skill)
				const pathParts = promptAST.uri.path.split('/');
				const skillIndex = pathParts.findIndex(part => isSkillFilename(part));
				if (skillIndex > 0) {
					const folderName = pathParts[skillIndex - 1];
					if (folderName && skillName !== folderName) {
						report(toMarker(
							localize('promptValidator.skillNameFolderMismatch', "技能名称“{0}”应与文件夹名称“{1}”匹配。", skillName, folderName),
							nameAttribute.value.range,
							MarkerSeverity.Warning
						));
					}
				}
			}
		}

		const descriptionAttribute = promptAST.header.getAttribute(PromptHeaderAttributes.description);
		if (!descriptionAttribute) {
			report(toMarker(
				localize('promptValidator.skillDescriptionMissing', "技能必须提供描述。"),
				new Range(1, 1, 1, 4),
				MarkerSeverity.Warning
			));

			// Without a description, user-invocable: false is invalid because the skill
			// would be model-only but has no description for the model to decide when to use it.
			if (promptAST.header.userInvocable === false) {
				const userInvocableAttr = promptAST.header.getAttribute(PromptHeaderAttributes.userInvocable);
				if (userInvocableAttr) {
					report(toMarker(
						localize('promptValidator.skillUserInvocableRequiresDescription', "当“用户可调用”为 false 时必须提供描述，因为模型需要描述来决定何时加载技能。"),
						userInvocableAttr.value.range,
						MarkerSeverity.Error
					));
				}
			}

			// Without a description, disable-model-invocation: false (model invocation enabled)
			// is the default but if explicitly set, report an error that a description is needed.
			if (promptAST.header.disableModelInvocation === false) {
				const disableModelInvocationAttr = promptAST.header.getAttribute(PromptHeaderAttributes.disableModelInvocation);
				if (disableModelInvocationAttr) {
					report(toMarker(
						localize('promptValidator.skillModelInvocationRequiresDescription', "启用模型调用时必须提供描述，因为模型需要描述来决定何时加载技能。"),
						disableModelInvocationAttr.value.range,
						MarkerSeverity.Error
					));
				}
			}
		}

		// Validate context: fork — requires the skill tool to be enabled
		const contextAttribute = promptAST.header?.getAttribute(PromptHeaderAttributes.context);
		if (contextAttribute && contextAttribute.value.type === 'scalar' && contextAttribute.value.value.trim() === 'fork') {
			const skillToolEnabled = this.configurationService.getValue<boolean>('github.copilot.chat.skillTool.enabled');
			if (!skillToolEnabled) {
				report(toMarker(
					localize('promptValidator.contextForkNotSupported', "\"context: fork\" 属性要求启用技能工具(github.copilot.chat.skillTool.enabled)。"),
					contextAttribute.value.range,
					MarkerSeverity.Warning
				));
			}
		}
	}

	private async validateBody(promptAST: ParsedPromptFile, target: Target, report: (markers: IMarkerData) => void): Promise<void> {
		const body = promptAST.body;
		if (!body) {
			return;
		}

		// Validate file references
		const fileReferenceChecks: Promise<void>[] = [];
		let userHome: URI | undefined;
		for (const ref of body.fileReferences) {
			if (isPromptFileTildePath(ref.content)) {
				userHome ??= await this.pathService.userHome();
			}
			const resolved = body.resolveFilePath(ref.content, userHome);
			if (!resolved) {
				report(toMarker(localize('promptValidator.invalidFileReference', "无效的文件引用“{0}”。", ref.content), ref.range, MarkerSeverity.Warning));
				continue;
			}
			if (promptAST.uri.scheme === resolved.scheme) {
				// only validate if the link is in the file system of the prompt file
				fileReferenceChecks.push((async () => {
					try {
						const exists = await this.fileService.exists(resolved);
						if (!exists) {
							const loc = this.labelService.getUriLabel(resolved);
							report(toMarker(localize('promptValidator.fileNotFound', "在“{1}”中找不到文件“{0}”。", ref.content, loc), ref.range, MarkerSeverity.Warning));
						}
					} catch (e) {
						this.logger.warn(`Error checking existence of file reference '${ref.content}' resolved to '${resolved.toString()}' in prompt file '${promptAST.uri.toString()}': ${e.message}`);
					}
				})());
			}
		}

		// Validate variable references (tool or toolset names)
		if (body.variableReferences.length && isVSCodeOrDefaultTarget(target)) {
			const headerTools = promptAST.header?.tools;
			const headerToolsMap = headerTools ? this.languageModelToolsService.toToolAndToolSetEnablementMap(headerTools, undefined) : undefined;

			const available = new Set<string>(this.languageModelToolsService.getFullReferenceNames());
			const deprecatedNames = this.languageModelToolsService.getDeprecatedFullReferenceNames();
			for (const variable of body.variableReferences) {
				if (!available.has(variable.name)) {
					if (deprecatedNames.has(variable.name)) {
						const currentNames = deprecatedNames.get(variable.name);
						if (currentNames && currentNames.size > 0) {
							if (currentNames.size === 1) {
								const newName = Array.from(currentNames)[0];
								report(toMarker(localize('promptValidator.deprecatedVariableReference', "工具或工具集 \"{0}\" 已重命名，请改用 \"{1}\"。", variable.name, newName), variable.range, MarkerSeverity.Info));
							} else {
								const newNames = Array.from(currentNames).sort((a, b) => a.localeCompare(b)).join(', ');
								report(toMarker(localize('promptValidator.deprecatedVariableReferenceMultipleNames', "工具或工具集 \"{0}\" 已重命名，请改用以下工具: {1}", variable.name, newNames), variable.range, MarkerSeverity.Info));
							}
						}
					} else {
						const missingGithubServerMarker = this.getMissingGithubMcpServerMarker(variable.name, variable.range);
						if (missingGithubServerMarker) {
							report(missingGithubServerMarker);
						} else {
							const missingPlaywrightServerMarker = this.getMissingPlaywrightMcpServerMarker(variable.name, variable.range);
							if (missingPlaywrightServerMarker) {
								report(missingPlaywrightServerMarker);
							} else {
								report(this.getUnknownToolMarker(variable.name, variable.range, true));
							}
						}
					}
				} else if (headerToolsMap) {
					const tool = this.languageModelToolsService.getToolByFullReferenceName(variable.name);
					if (tool && headerToolsMap.get(tool) === false) {
						report(toMarker(localize('promptValidator.disabledTool', "工具或工具集 \"{0}\" 也需要在标头中启用。", variable.name), variable.range, MarkerSeverity.Warning));
					}
				}
			}
		}

		await Promise.all(fileReferenceChecks);
	}

	private async validateHeader(promptAST: ParsedPromptFile, promptType: PromptsType, target: Target, report: (markers: IMarkerData) => void): Promise<void> {
		const header = promptAST.header;
		if (!header) {
			return;
		}
		const attributes = header.attributes;
		this.checkForInvalidArguments(attributes, promptType, target, report);

		this.validateName(attributes, report);
		this.validateDescription(attributes, report);
		this.validateArgumentHint(attributes, report);
		switch (promptType) {
			case PromptsType.prompt: {
				const agent = await this.validateAgent(attributes, report);
				this.validateTools(attributes, agent?.kind ?? ChatModeKind.Agent, target, report);
				this.validateModel(attributes, agent?.kind ?? ChatModeKind.Agent, report);
				break;
			}
			case PromptsType.instructions:
				if (target === Target.Claude) {
					this.validatePaths(attributes, report);
				} else {
					this.validateApplyTo(attributes, report);
				}
				this.validateExcludeAgent(attributes, report);
				break;

			case PromptsType.agent: {
				this.validateTarget(attributes, report);
				this.validateInfer(attributes, report);
				this.validateUserInvocable(attributes, report);
				this.validateDisableModelInvocation(attributes, report);
				this.validateTools(attributes, ChatModeKind.Agent, target, report);
				this.validateHooks(attributes, target, report);
				if (isVSCodeOrDefaultTarget(target)) {
					this.validateModel(attributes, ChatModeKind.Agent, report);
					this.validateHandoffs(attributes, report);
					await this.validateAgentsAttribute(attributes, header, report);
					this.validateGithubPermissions(attributes, report);
				} else if (target === Target.Claude) {
					this.validateClaudeAttributes(attributes, report);
				} else if (target === Target.GitHubCopilot) {
					this.validateGithubPermissions(attributes, report);
				}
				break;
			}

			case PromptsType.skill:
				this.validateUserInvocable(attributes, report);
				this.validateDisableModelInvocation(attributes, report);
				break;
		}
	}

	private checkForInvalidArguments(attributes: IHeaderAttribute[], promptType: PromptsType, target: Target, report: (markers: IMarkerData) => void): void {
		const validAttributeNames = getValidAttributeNames(promptType, true, target);
		const validGithubCopilotAttributeNames = new Lazy(() => new Set(getValidAttributeNames(promptType, false, Target.GitHubCopilot)));
		for (const attribute of attributes) {
			if (!validAttributeNames.includes(attribute.key)) {
				const supportedNames = new Lazy(() => {
					const names = getValidAttributeNames(promptType, false, target);
					return names.sort().join(', ');
				});
				switch (promptType) {
					case PromptsType.prompt:
						report(toMarker(localize('promptValidator.unknownAttribute.prompt', "提示文件中不支持属性“{0}”。受支持: {1}。", attribute.key, supportedNames.value), attribute.range, MarkerSeverity.Hint, [MarkerTag.Unnecessary]));
						break;
					case PromptsType.agent:
						if (target === Target.GitHubCopilot) {
							report(toMarker(localize('promptValidator.unknownAttribute.github-agent', "自定义 GitHub Copilot 智能体文件中不支持属性 \"{0}\"。受支持: {1}。", attribute.key, supportedNames.value), attribute.range, MarkerSeverity.Hint, [MarkerTag.Unnecessary]));
						} else if (target === Target.Claude) {
							// ignore for now as we don't have a full list of supported attributes for claude target
						} else {
							if (validGithubCopilotAttributeNames.value.has(attribute.key)) {
								report(toMarker(localize('promptValidator.ignoredAttribute.vscode-agent', "在 Olympia 本地运行时忽略属性 \"{0}\"。", attribute.key), attribute.range, MarkerSeverity.Hint, [MarkerTag.Unnecessary]));
							} else {
								report(toMarker(localize('promptValidator.unknownAttribute.vscode-agent', "Olympia 智能体文件中不支持属性 \"{0}\"。受支持: {1}。", attribute.key, supportedNames.value), attribute.range, MarkerSeverity.Hint, [MarkerTag.Unnecessary]));
							}
						}
						break;
					case PromptsType.instructions:
						if (target === Target.Claude) {
							report(toMarker(localize('promptValidator.unknownAttribute.rules', "Olympia 智能体规则文件中不支持属性 \"{0}\"。受支持: {1}。", attribute.key, supportedNames.value), attribute.range, MarkerSeverity.Hint, [MarkerTag.Unnecessary]));
						} else {
							report(toMarker(localize('promptValidator.unknownAttribute.instructions', "指令文件中不支持属性“{0}”。受支持: {1}。", attribute.key, supportedNames.value), attribute.range, MarkerSeverity.Hint, [MarkerTag.Unnecessary]));
						}
						break;
					case PromptsType.skill:
						report(toMarker(localize('promptValidator.unknownAttribute.skill', "Olympia 智能体不支持属性 \"{0}\"。受支持: {1}。", attribute.key, supportedNames.value), attribute.range, MarkerSeverity.Hint, [MarkerTag.Unnecessary]));
						break;
				}
			}
		}
	}



	private validateName(attributes: IHeaderAttribute[], report: (markers: IMarkerData) => void): void {
		const nameAttribute = attributes.find(attr => attr.key === PromptHeaderAttributes.name);
		if (!nameAttribute) {
			return;
		}
		if (nameAttribute.value.type !== 'scalar') {
			report(toMarker(localize('promptValidator.nameMustBeString', "\"name\" 属性必须是字符串。"), nameAttribute.range, MarkerSeverity.Error));
			return;
		}
		if (nameAttribute.value.value.trim().length === 0) {
			report(toMarker(localize('promptValidator.nameShouldNotBeEmpty', "\"name\" 属性不得为空。"), nameAttribute.value.range, MarkerSeverity.Error));
			return;
		}
	}

	private validateDescription(attributes: IHeaderAttribute[], report: (markers: IMarkerData) => void): void {
		const descriptionAttribute = attributes.find(attr => attr.key === PromptHeaderAttributes.description);
		if (!descriptionAttribute) {
			return;
		}
		if (descriptionAttribute.value.type !== 'scalar') {
			report(toMarker(localize('promptValidator.descriptionMustBeString', "\"description\" 属性必须是字符串。"), descriptionAttribute.range, MarkerSeverity.Error));
			return;
		}
		if (descriptionAttribute.value.value.trim().length === 0) {
			report(toMarker(localize('promptValidator.descriptionShouldNotBeEmpty', "\"description\" 属性不得为空。"), descriptionAttribute.value.range, MarkerSeverity.Error));
			return;
		}
	}

	private validateArgumentHint(attributes: IHeaderAttribute[], report: (markers: IMarkerData) => void): void {
		const argumentHintAttribute = attributes.find(attr => attr.key === PromptHeaderAttributes.argumentHint);
		if (!argumentHintAttribute) {
			return;
		}
		if (argumentHintAttribute.value.type !== 'scalar') {
			report(toMarker(localize('promptValidator.argumentHintMustBeString', "\"argument-hint\" 属性必须是字符串。"), argumentHintAttribute.range, MarkerSeverity.Error));
			return;
		}
		if (argumentHintAttribute.value.value.trim().length === 0) {
			report(toMarker(localize('promptValidator.argumentHintShouldNotBeEmpty', "\"argument-hint\" 属性不得为空。"), argumentHintAttribute.value.range, MarkerSeverity.Warning));
			return;
		}
	}

	private validateModel(attributes: IHeaderAttribute[], agentKind: ChatModeKind, report: (markers: IMarkerData) => void): void {
		const attribute = attributes.find(attr => attr.key === PromptHeaderAttributes.model);
		if (!attribute) {
			return;
		}
		if (attribute.value.type !== 'scalar' && attribute.value.type !== 'sequence') {
			report(toMarker(localize('promptValidator.modelMustBeStringOrArray', "\"model\" 特性必须是字符串或字符串数组。"), attribute.value.range, MarkerSeverity.Error));
			return;
		}

		const modelNames: [string, Range][] = [];
		if (attribute.value.type === 'scalar') {
			const modelName = attribute.value.value.trim();
			if (modelName.length === 0) {
				report(toMarker(localize('promptValidator.modelMustBeNonEmpty', "\"model\" 属性必须是非空字符串。"), attribute.value.range, MarkerSeverity.Error));
				return;
			}
			modelNames.push([modelName, attribute.value.range]);
		} else if (attribute.value.type === 'sequence') {
			if (attribute.value.items.length === 0) {
				report(toMarker(localize('promptValidator.modelArrayMustNotBeEmpty', "\"model\" 数组不能为空。"), attribute.value.range, MarkerSeverity.Error));
				return;
			}
			for (const item of attribute.value.items) {
				if (item.type !== 'scalar') {
					report(toMarker(localize('promptValidator.modelArrayMustContainStrings', "\"model\" 数组只能包含字符串。"), item.range, MarkerSeverity.Error));
					return;
				}
				const modelName = item.value.trim();
				if (modelName.length === 0) {
					report(toMarker(localize('promptValidator.modelArrayItemMustBeNonEmpty', "数组中的模型名称必须是非空字符串。"), item.range, MarkerSeverity.Error));
					return;
				}
				modelNames.push([modelName, item.range]);
			}
		}

		const languageModels = this.languageModelsService.getLanguageModelIds();
		if (languageModels.length === 0) {
			// likely the service is not initialized yet
			return;
		}

		for (const [modelName, range] of modelNames) {
			const modelMetadata = this.findModelByName(modelName);
			if (!modelMetadata) {
				report(toMarker(localize('promptValidator.modelNotFound', "将忽略未知模型 \"{0}\"。", modelName), range, MarkerSeverity.Hint, [MarkerTag.Unnecessary]));
			} else if (agentKind === ChatModeKind.Agent && !ILanguageModelChatMetadata.suitableForAgentMode(modelMetadata)) {
				report(toMarker(localize('promptValidator.modelNotSuited', "模型“{0}”不适用于智能体模式。", modelName), range, MarkerSeverity.Warning));
			}
		}
	}

	private validateClaudeAttributes(attributes: IHeaderAttribute[], report: (markers: IMarkerData) => void): void {
		// vaidate all claude-specific attributes that have enum values
		for (const claudeAttributeName in claudeAgentAttributes) {
			const claudeAttribute = claudeAgentAttributes[claudeAttributeName];
			const enumValues = claudeAttribute.enums;
			if (enumValues) {
				const attribute = attributes.find(attr => attr.key === claudeAttributeName);
				if (!attribute) {
					continue;
				}
				if (attribute.value.type !== 'scalar') {
					report(toMarker(localize('promptValidator.claude.attributeMustBeString', "\"{0}\" 属性必须是字符串。", claudeAttributeName), attribute.value.range, MarkerSeverity.Error));
					continue;
				} else {
					const modelName = attribute.value.value.trim();
					if (enumValues.every(model => model.name !== modelName)) {
						const validValues = enumValues.map(model => model.name).join(', ');
						report(toMarker(localize('promptValidator.claude.attributeNotFound', "未知值“{0}”，有效值: {1}。", modelName, validValues), attribute.value.range, MarkerSeverity.Warning));
					}
				}
			}
		}
	}

	private findModelByName(modelName: string): ILanguageModelChatMetadata | undefined {
		const metadataAndId = this.languageModelsService.lookupLanguageModelByQualifiedName(modelName);
		if (metadataAndId && metadataAndId.metadata.isUserSelectable !== false) {
			return metadataAndId.metadata;
		}
		return undefined;
	}

	private async validateAgent(attributes: IHeaderAttribute[], report: (markers: IMarkerData) => void): Promise<IChatMode | undefined> {
		const agentAttribute = attributes.find(attr => attr.key === PromptHeaderAttributes.agent);
		const modeAttribute = attributes.find(attr => attr.key === PromptHeaderAttributes.mode);
		if (modeAttribute) {
			if (agentAttribute) {
				report(toMarker(localize('promptValidator.modeDeprecated', "\"mode\" 属性已弃用。改用 \"agent\" 属性。"), modeAttribute.range, MarkerSeverity.Warning, [MarkerTag.Deprecated]));
			} else {
				report(toMarker(localize('promptValidator.modeDeprecated.useAgent', "\"mode\" 属性已弃用。请将其重命名为 \"agent\"。"), modeAttribute.range, MarkerSeverity.Warning, [MarkerTag.Deprecated]));
			}
		}

		const attribute = attributes.find(attr => attr.key === PromptHeaderAttributes.agent) ?? modeAttribute;
		if (!attribute) {
			return undefined; // default agent for prompts is Agent
		}
		if (attribute.value.type !== 'scalar') {
			report(toMarker(localize('promptValidator.attributeMustBeString', "\"{0}\" 属性必须是字符串。", attribute.key), attribute.value.range, MarkerSeverity.Error));
			return undefined;
		}
		const agentValue = attribute.value.value;
		if (agentValue.trim().length === 0) {
			report(toMarker(localize('promptValidator.attributeMustBeNonEmpty', "\"{0}\" 属性必须是非空字符串。", attribute.key), attribute.value.range, MarkerSeverity.Error));
			return undefined;
		}
		return await this.validateAgentValue(attribute.value, report);
	}

	private async validateAgentValue(value: IScalarValue, report: (markers: IMarkerData) => void): Promise<IChatMode | undefined> {
		const agents = await this.chatModeService.getLocalModes();
		const availableAgents = [];

		// Check if agent exists in builtin or custom agents
		for (const agent of Iterable.concat(agents.builtin, agents.custom)) {
			if (agent.name.get() === value.value) {
				return agent;
			}
			availableAgents.push(agent.name.get()); // collect all available agent names
		}

		const errorMessage = localize('promptValidator.agentNotFound', "未知智能体 \"{0}\"。可用智能体: {1}。", value.value, availableAgents.join(', '));
		report(toMarker(errorMessage, value.range, MarkerSeverity.Warning));
		return undefined;
	}

	private validateTools(attributes: IHeaderAttribute[], agentKind: ChatModeKind, target: Target, report: (markers: IMarkerData) => void): undefined {
		const attribute = attributes.find(attr => attr.key === PromptHeaderAttributes.tools);
		if (!attribute) {
			return;
		}
		if (agentKind !== ChatModeKind.Agent) {
			report(toMarker(localize('promptValidator.toolsOnlyInAgent', "在使用智能体时仅支持 \"tools\" 属性。将忽略属性。"), attribute.range, MarkerSeverity.Warning));
		}
		let value = attribute.value;
		if (value.type === 'scalar') {
			value = parseCommaSeparatedList(value);
		}
		if (value.type !== 'sequence') {
			report(toMarker(localize('promptValidator.toolsMustBeArrayOrMap', "\"tools\" 属性必须是数组或逗号分隔的字符串。"), attribute.value.range, MarkerSeverity.Error));
			return;
		}
		if (target === Target.GitHubCopilot || target === Target.Claude) {
			// no validation for github-copilot target and claude
		} else {
			this.validateVSCodeTools(value, report);
		}
	}

	private validateVSCodeTools(valueItem: ISequenceValue, report: (markers: IMarkerData) => void) {
		if (valueItem.items.length > 0) {
			const available = new Set<string>(this.languageModelToolsService.getFullReferenceNames());
			const deprecatedNames = this.languageModelToolsService.getDeprecatedFullReferenceNames();
			for (const item of valueItem.items) {
				if (item.type !== 'scalar') {
					report(toMarker(localize('promptValidator.eachToolMustBeString', "\"tools\" 属性中的每个工具名称都必须是字符串。"), item.range, MarkerSeverity.Error));
				} else if (item.value) {
					if (!available.has(item.value)) {
						const currentNames = deprecatedNames.get(item.value);
						if (currentNames) {
							if (currentNames?.size === 1) {
								const newName = Array.from(currentNames)[0];
								report(toMarker(localize('promptValidator.toolDeprecated', "工具或工具集 \"{0}\" 已重命名，请改用 \"{1}\"。", item.value, newName), item.range, MarkerSeverity.Info, [MarkerTag.Deprecated]));
							} else {
								const newNames = Array.from(currentNames).sort((a, b) => a.localeCompare(b)).join(', ');
								report(toMarker(localize('promptValidator.toolDeprecatedMultipleNames', "工具或工具集 \"{0}\" 已重命名，请改用以下工具: {1}", item.value, newNames), item.range, MarkerSeverity.Info, [MarkerTag.Deprecated]));
							}
						} else {
							const missingGithubServerMarker = this.getMissingGithubMcpServerMarker(item.value, item.range);
							if (missingGithubServerMarker) {
								report(missingGithubServerMarker);
							} else {
								const missingPlaywrightServerMarker = this.getMissingPlaywrightMcpServerMarker(item.value, item.range);
								if (missingPlaywrightServerMarker) {
									report(missingPlaywrightServerMarker);
								} else {
									report(this.getUnknownToolMarker(item.value, item.range, false));
								}
							}
						}
					}
				}
			}
		}
	}

	private getUnknownToolMarker(toolReferenceName: string, range: Range, isVariableReference: boolean): IMarkerData {
		const splitBySlash = toolReferenceName.split('/');
		const slashCount = splitBySlash.length - 1;
		const hasExtensionLikeName = splitBySlash[0].includes('.');
		if (slashCount >= 2) {
			return toMarker(
				localize(
					'promptValidator.unknownMcpServerReference',
					"Unknown tool '{0}'. It is likely to be a missing MCP server, please ensure it is installed and enabled.",
					toolReferenceName
				),
				range,
				MarkerSeverity.Hint,
				[MarkerTag.Unnecessary],
				PromptValidatorMarkerCode.UnknownMcpServerReference
			);
		}
		if (hasExtensionLikeName) {
			return toMarker(
				localize(
					'promptValidator.unknownExtensionReference',
					"Unknown extension tool '{0}'. It is likely to be a missing extension, please ensure it is installed and enabled.",
					toolReferenceName
				),
				range,
				MarkerSeverity.Hint,
				[MarkerTag.Unnecessary],
				PromptValidatorMarkerCode.UnknownExtensionReference
			);
		}
		if (isVariableReference) {
			return toMarker(
				localize(
					'promptValidator.unknownVariableReference',
					"未知工具或工具集“{0}”。",
					toolReferenceName
				),
				range,
				MarkerSeverity.Hint,
				[MarkerTag.Unnecessary],
				PromptValidatorMarkerCode.UnknownExtensionOrMcpServerReference
			);
		} else {
			return toMarker(
				localize(
					'promptValidator.unknownToolReference',
					"Unknown tool '{0}' will be ignored.",
					toolReferenceName
				),
				range,
				MarkerSeverity.Hint,
				[MarkerTag.Unnecessary],
				PromptValidatorMarkerCode.UnknownExtensionOrMcpServerReference
			);
		}
	}

	private getMissingGithubMcpServerMarker(toolReferenceName: string, range: Range): IMarkerData | undefined {
		if (toolReferenceName !== 'github/*') {
			return undefined;
		}
		return toMarker(
			localize(
				'promptValidator.missingGithubMcpServer',
				"Tool alias '{0}' requires the GitHub MCP server. Enable the built-in server with setting 'github.copilot.chat.githubMcpServer.enabled' or install extension 'io.github.github/github-mcp-server' from Extensions (`@mcp github`).",
				toolReferenceName
			),
			range,
			MarkerSeverity.Hint,
			[MarkerTag.Unnecessary],
			PromptValidatorMarkerCode.MissingGithubMcpServer
		);
	}

	private getMissingPlaywrightMcpServerMarker(toolReferenceName: string, range: Range): IMarkerData | undefined {
		if (toolReferenceName !== 'playwright/*') {
			return undefined;
		}
		return toMarker(
			localize(
				'promptValidator.missingPlaywrightMcpServer',
				"Tool alias '{0}' requires the Playwright MCP server. Install it from Extensions (`@mcp playwright`).",
				toolReferenceName
			),
			range,
			MarkerSeverity.Hint,
			[MarkerTag.Unnecessary],
			PromptValidatorMarkerCode.MissingPlaywrightMcpServer
		);
	}

	private validateApplyTo(attributes: IHeaderAttribute[], report: (markers: IMarkerData) => void): undefined {
		const attribute = attributes.find(attr => attr.key === PromptHeaderAttributes.applyTo);
		if (!attribute) {
			return;
		}
		if (attribute.value.type !== 'scalar') {
			report(toMarker(localize('promptValidator.applyToMustBeString', "\"applyTo\" 属性必须是字符串。"), attribute.value.range, MarkerSeverity.Error));
			return;
		}
		const pattern = attribute.value.value;
		try {
			const patterns = splitGlobAware(pattern, ',');
			if (patterns.length === 0) {
				report(toMarker(localize('promptValidator.applyToMustBeValidGlob', "\"applyTo\" 属性必须是有效的 glob 模式。"), attribute.value.range, MarkerSeverity.Error));
				return;
			}
			for (const pattern of patterns) {
				const globPattern = parse(pattern);
				if (isEmptyPattern(globPattern)) {
					report(toMarker(localize('promptValidator.applyToMustBeValidGlob', "\"applyTo\" 属性必须是有效的 glob 模式。"), attribute.value.range, MarkerSeverity.Error));
					return;
				}
			}
		} catch (_error) {
			report(toMarker(localize('promptValidator.applyToMustBeValidGlob', "\"applyTo\" 属性必须是有效的 glob 模式。"), attribute.value.range, MarkerSeverity.Error));
		}
	}

	private validatePaths(attributes: IHeaderAttribute[], report: (markers: IMarkerData) => void): undefined {
		const attribute = attributes.find(attr => attr.key === PromptHeaderAttributes.paths);
		if (!attribute) {
			return;
		}
		if (attribute.value.type !== 'sequence') {
			report(toMarker(localize('promptValidator.pathsMustBeArray', "\"paths\" 属性必须是 glob 模式的数组。"), attribute.value.range, MarkerSeverity.Error));
			return;
		}
		for (const item of attribute.value.items) {
			if (item.type !== 'scalar') {
				report(toMarker(localize('promptValidator.eachPathMustBeString', "\"paths\" 属性中的每个条目都必须是字符串。"), item.range, MarkerSeverity.Error));
				continue;
			}
			const pattern = item.value.trim();
			if (pattern.length === 0) {
				report(toMarker(localize('promptValidator.pathMustBeNonEmpty', "路径条目必须是非空的 glob 模式。"), item.range, MarkerSeverity.Error));
				continue;
			}
			try {
				const globPattern = parse(pattern);
				if (isEmptyPattern(globPattern)) {
					report(toMarker(localize('promptValidator.pathMustBeValidGlob', "“{0}”不是有效的 glob 模式。", pattern), item.range, MarkerSeverity.Error));
				}
			} catch (_error) {
				report(toMarker(localize('promptValidator.pathMustBeValidGlob', "“{0}”不是有效的 glob 模式。", pattern), item.range, MarkerSeverity.Error));
			}
		}
	}

	private validateExcludeAgent(attributes: IHeaderAttribute[], report: (markers: IMarkerData) => void): undefined {
		const attribute = attributes.find(attr => attr.key === PromptHeaderAttributes.excludeAgent);
		if (!attribute) {
			return;
		}
		if (attribute.value.type !== 'sequence' && attribute.value.type !== 'scalar') {
			report(toMarker(localize('promptValidator.excludeAgentMustBeArray', "\"excludeAgent\" 属性必须是字符串或数组。"), attribute.value.range, MarkerSeverity.Error));
			return;
		}
	}

	private validateHooks(attributes: IHeaderAttribute[], target: Target, report: (markers: IMarkerData) => void): undefined {
		const attribute = attributes.find(attr => attr.key === PromptHeaderAttributes.hooks);
		if (!attribute) {
			return;
		}
		if (attribute.value.type !== 'map') {
			report(toMarker(localize('promptValidator.hooksMustBeMap', "\"hooks\" 属性必须是挂钩事件类型到命令数组的映射。"), attribute.value.range, MarkerSeverity.Error));
			return;
		}
		const validHookNames = new Set(Object.keys(HOOKS_BY_TARGET[target] ?? HOOKS_BY_TARGET[Target.Undefined]));
		for (const prop of attribute.value.properties) {
			if (!validHookNames.has(prop.key.value)) {
				report(toMarker(localize('promptValidator.unknownHookType', "未知的挂钩事件类型“{0}”。受支持: {1}。", prop.key.value, Array.from(validHookNames).join(', ')), prop.key.range, MarkerSeverity.Warning));
			}
			if (prop.value.type !== 'sequence') {
				report(toMarker(localize('promptValidator.hookValueMustBeArray', "挂钩事件“{0}”的值必须是命令对象数组。", prop.key.value), prop.value.range, MarkerSeverity.Error));
				continue;
			}
			for (const item of prop.value.items) {
				this.validateHookCommand(item, target, report);
			}
		}
	}

	private validateHookCommand(item: IValue, target: Target, report: (markers: IMarkerData) => void): void {
		if (item.type !== 'map') {
			report(toMarker(localize('promptValidator.hookCommandMustBeObject', "每个挂钩命令必须是一个对象。"), item.range, MarkerSeverity.Error));
			return;
		}

		// Detect nested matcher format: { matcher?: "...", hooks: [{ type: 'command', command: '...' }] }
		const hooksProperty = item.properties.find(p => p.key.value === 'hooks');
		if (hooksProperty) {
			// Validate that only known matcher properties are present
			for (const prop of item.properties) {
				if (prop.key.value !== 'hooks' && prop.key.value !== 'matcher') {
					report(toMarker(localize('promptValidator.unknownMatcherProperty', "挂钩匹配器中存在未知属性“{0}”。", prop.key.value), prop.key.range, MarkerSeverity.Warning));
				}
			}
			if (hooksProperty.value.type !== 'sequence') {
				report(toMarker(localize('promptValidator.nestedHooksMustBeArray', "匹配器中的“hooks”属性必须是命令对象数组。"), hooksProperty.value.range, MarkerSeverity.Error));
				return;
			}
			for (const nestedItem of hooksProperty.value.items) {
				this.validateHookCommand(nestedItem, target, report);
			}
			return;
		}

		const isCopilotCli = target === Target.GitHubCopilot;

		// Determine valid and command-providing properties based on target
		const validCommandFields = isCopilotCli
			? new Set(['bash', 'powershell'])
			: new Set(['command', 'windows', 'linux', 'osx', 'bash', 'powershell']);

		const validProperties = isCopilotCli
			? new Set(['type', 'bash', 'powershell', 'cwd', 'env', 'timeoutSec'])
			: new Set(['type', 'command', 'windows', 'linux', 'osx', 'bash', 'powershell', 'cwd', 'env', 'timeout']);

		let hasType = false;
		let hasCommandField = false;

		for (const prop of item.properties) {
			const key = prop.key.value;

			if (!validProperties.has(key)) {
				report(toMarker(localize('promptValidator.unknownHookProperty', "挂钩命令中存在未知属性“{0}”。", key), prop.key.range, MarkerSeverity.Warning));
			}

			if (key === 'type') {
				hasType = true;
				if (prop.value.type !== 'scalar' || prop.value.value !== 'command') {
					report(toMarker(localize('promptValidator.hookTypeMustBeCommand', "挂钩命令中的“type”属性必须是“command”。"), prop.value.range, MarkerSeverity.Error));
				}
			} else if (validCommandFields.has(key)) {
				hasCommandField = true;
				if (prop.value.type !== 'scalar' || prop.value.value.trim().length === 0) {
					report(toMarker(localize('promptValidator.hookCommandFieldMustBeNonEmptyString', "挂钩命令中的“{0}”属性必须是非空字符串。", key), prop.value.range, MarkerSeverity.Error));
				}
			} else if (key === 'cwd') {
				if (prop.value.type !== 'scalar') {
					report(toMarker(localize('promptValidator.hookCwdMustBeString', "挂钩命令中的“cwd”属性必须是字符串。"), prop.value.range, MarkerSeverity.Error));
				}
			} else if (key === 'env') {
				if (prop.value.type !== 'map') {
					report(toMarker(localize('promptValidator.hookEnvMustBeMap', "挂钩命令中的“env”属性必须是字符串值的映射。"), prop.value.range, MarkerSeverity.Error));
				} else {
					for (const envProp of prop.value.properties) {
						if (envProp.value.type !== 'scalar') {
							report(toMarker(localize('promptValidator.hookEnvValueMustBeString', "环境变量“{0}”的值必须是字符串。", envProp.key.value), envProp.value.range, MarkerSeverity.Error));
						}
					}
				}
			} else if (key === 'timeout' || key === 'timeoutSec') {
				if (prop.value.type !== 'scalar' || isNaN(Number(prop.value.value))) {
					report(toMarker(localize('promptValidator.hookTimeoutMustBeNumber', "挂钩命令中的“{0}”属性必须是数字。", key), prop.value.range, MarkerSeverity.Error));
				}
			}
		}

		if (!hasType) {
			report(toMarker(localize('promptValidator.hookMissingType', "挂钩命令缺少必需属性“type”。"), item.range, MarkerSeverity.Error));
		}
		if (!hasCommandField) {
			if (isCopilotCli) {
				report(toMarker(localize('promptValidator.hookMissingCopilotCommand', "挂钩命令必须至少指定“bash”或“powershell”中的一项。"), item.range, MarkerSeverity.Error));
			} else {
				report(toMarker(localize('promptValidator.hookMissingCommand', "挂钩命令必须至少指定“command”、“windows”、“linux”或“osx”中的一项。"), item.range, MarkerSeverity.Error));
			}
		}
	}

	private validateHandoffs(attributes: IHeaderAttribute[], report: (markers: IMarkerData) => void): undefined {
		const attribute = attributes.find(attr => attr.key === PromptHeaderAttributes.handOffs);
		if (!attribute) {
			return;
		}
		if (attribute.value.type !== 'sequence') {
			report(toMarker(localize('promptValidator.handoffsMustBeArray', "\"handoffs\" 属性必须是数组。"), attribute.value.range, MarkerSeverity.Error));
			return;
		}
		const seenLabels = new Map<string, Range>();
		for (const item of attribute.value.items) {
			if (item.type !== 'map') {
				report(toMarker(localize('promptValidator.eachHandoffMustBeObject', "\"handoffs\" 属性中的每个转接必须是包含 \"label\"、\"agent\"、\"prompt\" 和(可选) \"send\" 的对象。"), item.range, MarkerSeverity.Error));
				continue;
			}
			const required = new Set(['label', 'agent', 'prompt']);
			for (const prop of item.properties) {
				switch (prop.key.value) {
					case 'label':
						if (prop.value.type !== 'scalar' || prop.value.value.trim().length === 0) {
							report(toMarker(localize('promptValidator.handoffLabelMustBeNonEmptyString', "转接中的 \"label\" 属性必须是非空字符串。"), prop.value.range, MarkerSeverity.Error));
						} else if (!/[a-zA-Z0-9]/.test(prop.value.value)) {
							report(toMarker(localize('promptValidator.handoffLabelMustContainAlphanumeric', "切换中的 \"label\" 属性必须至少包含一个字母数字字符。"), prop.value.range, MarkerSeverity.Error));
						}
						break;
					case 'agent':
						if (prop.value.type !== 'scalar' || prop.value.value.trim().length === 0) {
							report(toMarker(localize('promptValidator.handoffAgentMustBeNonEmptyString', "转接中的 \"agent\" 属性必须是非空字符串。"), prop.value.range, MarkerSeverity.Error));
						} else {
							this.validateAgentValue(prop.value, report);
						}
						break;
					case 'prompt':
						if (prop.value.type !== 'scalar') {
							report(toMarker(localize('promptValidator.handoffPromptMustBeString', "转接中的 \"prompt\" 属性必须是字符串。"), prop.value.range, MarkerSeverity.Error));
						}
						break;
					case 'send':
						if (!isTrueOrFalse(prop.value)) {
							report(toMarker(localize('promptValidator.handoffSendMustBeBoolean', "转接中的 \"send\" 属性必须是布尔值。"), prop.value.range, MarkerSeverity.Error));
						}
						break;
					case 'showContinueOn':
						if (!isTrueOrFalse(prop.value)) {
							report(toMarker(localize('promptValidator.handoffShowContinueOnMustBeBoolean', "转接中的 \"showContinueOn\" 属性必须是布尔型。"), prop.value.range, MarkerSeverity.Error));
						}
						break;
					case 'model':
						if (prop.value.type !== 'scalar') {
							report(toMarker(localize('promptValidator.handoffModelMustBeString', "转接中的 \"model\" 属性必须是字符串。"), prop.value.range, MarkerSeverity.Error));
						}
						break;
					default:
						report(toMarker(localize('promptValidator.unknownHandoffProperty', "转接对象中的未知属性“{0}”。支持的属性为 \"label\"、\"agent\"、\"prompt\" 和(可选) \"send\"、\"showContinueOn\"、\"model\"。", prop.key.value), prop.value.range, MarkerSeverity.Warning));
				}
				required.delete(prop.key.value);
			}
			if (required.size > 0) {
				report(toMarker(localize('promptValidator.missingHandoffProperties', "转接对象中缺少的必需属性 {0}。", Array.from(required).map(s => `'${s}'`).join(', ')), item.range, MarkerSeverity.Error));
			}

			// Detect duplicate labels (case-insensitive, consistent with ExecuteHandoffAction lookup)
			const labelProp = item.properties.find(p => p.key.value === 'label');
			if (labelProp?.value.type === 'scalar') {
				const normalizedLabel = labelProp.value.value.toLowerCase();
				if (normalizedLabel && seenLabels.has(normalizedLabel)) {
					report(toMarker(localize('promptValidator.duplicateHandoffLabel', "重复的切换标签“{0}”。每个切换必须具有唯一的标签。", labelProp.value.value), labelProp.value.range, MarkerSeverity.Error));
				} else if (normalizedLabel) {
					seenLabels.set(normalizedLabel, labelProp.value.range);
				}
			}
		}
	}

	private validateInfer(attributes: IHeaderAttribute[], report: (markers: IMarkerData) => void): undefined {
		const attribute = attributes.find(attr => attr.key === PromptHeaderAttributes.infer);
		if (!attribute) {
			return;
		}
		report(toMarker(localize('promptValidator.inferDeprecated', "\"infer\" 属性已被弃用，建议使用 \"user-invocable\" 和 \"disable-model-invocation\"。"), attribute.value.range, MarkerSeverity.Error));
	}

	private validateTarget(attributes: IHeaderAttribute[], report: (markers: IMarkerData) => void): undefined {
		const attribute = attributes.find(attr => attr.key === PromptHeaderAttributes.target);
		if (!attribute) {
			return;
		}
		if (attribute.value.type !== 'scalar') {
			report(toMarker(localize('promptValidator.targetMustBeString', "\"target\" 属性必须是字符串。"), attribute.value.range, MarkerSeverity.Error));
			return;
		}
		const targetValue = attribute.value.value.trim();
		if (targetValue.length === 0) {
			report(toMarker(localize('promptValidator.targetMustBeNonEmpty', "\"target\" 属性必须是非空字符串。"), attribute.value.range, MarkerSeverity.Error));
			return;
		}
		const validTargets = ['github-copilot', 'vscode'];
		if (!validTargets.includes(targetValue)) {
			report(toMarker(localize('promptValidator.targetInvalidValue', "\"target\" 属性必须是以下项之一: {0}。", validTargets.join(', ')), attribute.value.range, MarkerSeverity.Error));
		}
	}

	private validateUserInvocable(attributes: IHeaderAttribute[], report: (markers: IMarkerData) => void): undefined {
		const attribute = attributes.find(attr => attr.key === PromptHeaderAttributes.userInvocable);
		if (!attribute) {
			return;
		}
		if (!isTrueOrFalse(attribute.value)) {
			report(toMarker(localize('promptValidator.userInvocableMustBeBoolean', "\"user-invocable\" 属性必须是 \"true\" 或 \"false\"。"), attribute.value.range, MarkerSeverity.Error));
			return;
		}
	}

	private validateDisableModelInvocation(attributes: IHeaderAttribute[], report: (markers: IMarkerData) => void): undefined {
		const attribute = attributes.find(attr => attr.key === PromptHeaderAttributes.disableModelInvocation);
		if (!attribute) {
			return;
		}
		if (!isTrueOrFalse(attribute.value)) {
			report(toMarker(localize('promptValidator.disableModelInvocationMustBeBoolean', "\"disable-model-invocation\" 属性必须是 \"true\" 或 \"false\"。"), attribute.value.range, MarkerSeverity.Error));
			return;
		}
	}

	private async validateAgentsAttribute(attributes: IHeaderAttribute[], header: PromptHeader, report: (markers: IMarkerData) => void): Promise<undefined> {
		const attribute = attributes.find(attr => attr.key === PromptHeaderAttributes.agents);
		if (!attribute) {
			return;
		}
		if (attribute.value.type !== 'sequence') {
			report(toMarker(localize('promptValidator.agentsMustBeArray', "\"agents\" 特性必须是数组。"), attribute.value.range, MarkerSeverity.Error));
			return;
		}

		// Collect available agent names
		const agents = (await this.promptsService.getCustomAgents(CancellationToken.None)).filter(a => a.enabled);
		const availableAgentNames = new Set<string>(agents.map(agent => agent.name));
		availableAgentNames.add(ChatMode.Agent.name.get()); // include default agent

		// Check each item is a string and agent exists
		const agentNames: string[] = [];
		for (const item of attribute.value.items) {
			if (item.type !== 'scalar') {
				report(toMarker(localize('promptValidator.eachAgentMustBeString', "\"agents\" 特性中的每个智能体名称必须是字符串。"), item.range, MarkerSeverity.Error));
			} else if (item.value) {
				agentNames.push(item.value);
				if (item.value !== '*' && !availableAgentNames.has(item.value)) {
					report(toMarker(localize('promptValidator.agentInAgentsNotFound', "将忽略未知智能体 \"{0}\"。可用智能体: {1}。", item.value, Array.from(availableAgentNames).join(', ')), item.range, MarkerSeverity.Hint, [MarkerTag.Unnecessary]));
				}
			}
		}

		// If not wildcard and not empty, check that 'agent' tool is available
		if (agentNames.length > 0) {
			const tools = header.tools;
			if (tools && !tools.includes(SpecedToolAliases.agent)) {
				report(toMarker(localize('promptValidator.agentsRequiresAgentTool', "如果指定了 \"agents\" 和 \"tools\"，则 \"agent\" 工具必须包含在 \"tool\" 特性中。"), attribute.value.range, MarkerSeverity.Warning));
			}
		}
	}

	private validateGithubPermissions(attributes: IHeaderAttribute[], report: (markers: IMarkerData) => void): void {
		const attribute = attributes.find(attr => attr.key === GithubPromptHeaderAttributes.github);
		if (!attribute) {
			return;
		}
		if (attribute.value.type !== 'map') {
			report(toMarker(localize('promptValidator.githubMustBeMap', "\"github\" 属性必须是对象。"), attribute.value.range, MarkerSeverity.Error));
			return;
		}
		for (const prop of attribute.value.properties) {
			if (prop.key.value !== 'permissions') {
				report(toMarker(localize('promptValidator.unknownGithubProperty', "\"github\" 对象中存在未知属性 \"{0}\"。支持的属性：\"permissions\"。", prop.key.value), prop.key.range, MarkerSeverity.Warning));
				continue;
			}
			if (prop.value.type !== 'map') {
				report(toMarker(localize('promptValidator.permissionsMustBeMap', "\"permissions\" 属性必须是对象。"), prop.value.range, MarkerSeverity.Error));
				continue;
			}
			for (const permProp of prop.value.properties) {
				const scope = permProp.key.value;
				const scopeInfo = githubPermissionScopes[scope];
				if (!scopeInfo) {
					const validScopes = Object.keys(githubPermissionScopes).sort().join(', ');
					report(toMarker(localize('promptValidator.unknownPermissionScope', "未知的权限范围 \"{0}\"。有效范围: {1}。", scope, validScopes), permProp.key.range, MarkerSeverity.Warning));
					continue;
				}
				if (permProp.value.type !== 'scalar') {
					report(toMarker(localize('promptValidator.permissionValueMustBeString', "\"{0}\" 的权限值必须是字符串。", scope), permProp.value.range, MarkerSeverity.Error));
					continue;
				}
				const value = permProp.value.value;
				if (!scopeInfo.allowedValues.includes(value)) {
					report(toMarker(localize('promptValidator.invalidPermissionValue', "作用域“{1}”的权限值“{0}”无效。允许的值: {2}。", value, scope, scopeInfo.allowedValues.join(', ')), permProp.value.range, MarkerSeverity.Error));
				}
			}
		}
	}
}

export const githubPermissionScopes: Record<string, { allowedValues: string[]; description: string }> = {
	'actions': { allowedValues: ['read', 'write', 'none'], description: localize('githubPermission.actions', "访问 GitHub Actions 工作流并运行") },
	'checks': { allowedValues: ['read', 'none'], description: localize('githubPermission.checks', "访问以检查运行和状态") },
	'contents': { allowedValues: ['read', 'write', 'none'], description: localize('githubPermission.contents', "访问存储库内容(文件、提交、分支)") },
	'discussions': { allowedValues: ['read', 'write', 'none'], description: localize('githubPermission.discussions', "讨论的访问权限") },
	'issues': { allowedValues: ['read', 'write', 'none'], description: localize('githubPermission.issues', "访问问题(读取、创建、更新、评论)") },
	'metadata': { allowedValues: ['read'], description: localize('githubPermission.metadata', "存储库元数据(始终只读)") },
	'pull-requests': { allowedValues: ['read', 'write', 'none'], description: localize('githubPermission.pullRequests', "访问拉取请求(读取、创建、更新、审阅)") },
	'security-events': { allowedValues: ['read', 'none'], description: localize('githubPermission.securityEvents', "访问安全相关事件") },
	'workflows': { allowedValues: ['write', 'none'], description: localize('githubPermission.workflows', "访问以修改工作流文件") },
};

function isTrueOrFalse(value: IValue): boolean {
	if (value.type === 'scalar') {
		return (value.value === 'true' || value.value === 'false') && value.format === 'none';
	}
	return false;
}

const allAttributeNames: Record<PromptsType, string[]> = {
	[PromptsType.prompt]: [PromptHeaderAttributes.name, PromptHeaderAttributes.description, PromptHeaderAttributes.model, PromptHeaderAttributes.tools, PromptHeaderAttributes.mode, PromptHeaderAttributes.agent, PromptHeaderAttributes.argumentHint],
	[PromptsType.instructions]: [PromptHeaderAttributes.name, PromptHeaderAttributes.description, PromptHeaderAttributes.applyTo, PromptHeaderAttributes.excludeAgent],
	[PromptsType.agent]: [PromptHeaderAttributes.name, PromptHeaderAttributes.description, PromptHeaderAttributes.model, PromptHeaderAttributes.reasoningEffort, PromptHeaderAttributes.tools, PromptHeaderAttributes.advancedOptions, PromptHeaderAttributes.handOffs, PromptHeaderAttributes.argumentHint, PromptHeaderAttributes.target, PromptHeaderAttributes.infer, PromptHeaderAttributes.agents, PromptHeaderAttributes.hooks, PromptHeaderAttributes.userInvocable, PromptHeaderAttributes.disableModelInvocation, GithubPromptHeaderAttributes.github],
	[PromptsType.skill]: [PromptHeaderAttributes.name, PromptHeaderAttributes.description, PromptHeaderAttributes.license, PromptHeaderAttributes.compatibility, PromptHeaderAttributes.metadata, PromptHeaderAttributes.argumentHint, PromptHeaderAttributes.userInvocable, PromptHeaderAttributes.disableModelInvocation, PromptHeaderAttributes.context],
	[PromptsType.hook]: [], // hooks are JSON files, not markdown with YAML frontmatter
};
const githubCopilotAgentAttributeNames = [PromptHeaderAttributes.name, PromptHeaderAttributes.description, PromptHeaderAttributes.tools, PromptHeaderAttributes.target, PromptHeaderAttributes.model, PromptHeaderAttributes.reasoningEffort, GithubPromptHeaderAttributes.mcpServers, GithubPromptHeaderAttributes.github, PromptHeaderAttributes.infer];
const recommendedAttributeNames: Record<PromptsType, string[]> = {
	[PromptsType.prompt]: allAttributeNames[PromptsType.prompt].filter(name => !isNonRecommendedAttribute(name)),
	[PromptsType.instructions]: allAttributeNames[PromptsType.instructions].filter(name => !isNonRecommendedAttribute(name)),
	[PromptsType.agent]: allAttributeNames[PromptsType.agent].filter(name => !isNonRecommendedAttribute(name)),
	[PromptsType.skill]: allAttributeNames[PromptsType.skill].filter(name => !isNonRecommendedAttribute(name)),
	[PromptsType.hook]: [], // hooks are JSON files, not markdown with YAML frontmatter
};

export function getValidAttributeNames(promptType: PromptsType, includeNonRecommended: boolean, target: Target): string[] {
	if (target === Target.Claude) {
		if (promptType === PromptsType.instructions) {
			return Object.keys(claudeRulesAttributes);
		}
		return Object.keys(claudeAgentAttributes);
	} else if (target === Target.GitHubCopilot) {
		if (promptType === PromptsType.agent) {
			return githubCopilotAgentAttributeNames;
		}
	}
	return includeNonRecommended ? allAttributeNames[promptType] : recommendedAttributeNames[promptType];
}

export function isNonRecommendedAttribute(attributeName: string): boolean {
	return attributeName === PromptHeaderAttributes.advancedOptions || attributeName === PromptHeaderAttributes.excludeAgent || attributeName === PromptHeaderAttributes.mode || attributeName === PromptHeaderAttributes.infer;
}

export function getAttributeDescription(attributeName: string, promptType: PromptsType, target: Target): string | undefined {
	if (target === Target.Claude) {
		if (promptType === PromptsType.agent) {
			return claudeAgentAttributes[attributeName]?.description;
		}
		if (promptType === PromptsType.instructions) {
			return claudeRulesAttributes[attributeName]?.description;
		}
	}
	switch (promptType) {
		case PromptsType.instructions:
			switch (attributeName) {
				case PromptHeaderAttributes.name:
					return localize('promptHeader.instructions.name', "UI 中显示的指令文件的名称。如果未设置，则名称从文件名派生。");
				case PromptHeaderAttributes.description:
					return localize('promptHeader.instructions.description', "指令文件的说明。它可用于提供有关指令的其他上下文或信息，并传递到语言模型作为提示的一部分。");
				case PromptHeaderAttributes.applyTo:
					return localize('promptHeader.instructions.applyToRange', "一个或多个 glob 模式(用逗号分隔)，用于描述指令应用于哪些文件。根据这些模式，当上下文包含与其中一个或多个模式匹配的文件时，该文件会自动包含在提示中。如果希望始终添加此文件，请使用 `**`。\r\n示例: `**/*.ts`、`**/*.js`、`client/**`");
			}
			break;
		case PromptsType.skill:
			switch (attributeName) {
				case PromptHeaderAttributes.name:
					return localize('promptHeader.skill.name', "技能的名称。");
				case PromptHeaderAttributes.description:
					return localize('promptHeader.skill.description', "技能的说明。描述将添加到每个请求中，智能体将使用它来决定何时加载技能。");
				case PromptHeaderAttributes.argumentHint:
					return localize('promptHeader.skill.argumentHint', "自动完成时显示的提示，用于指示预期的参数。例如: [issue-number] 或 [filename] [format]");
				case PromptHeaderAttributes.userInvocable:
					return localize('promptHeader.skill.userInvocable', "设置为 false 可在 / 菜单中隐藏。用于不应由用户直接调用的后台知识。默认值: true。");
				case PromptHeaderAttributes.disableModelInvocation:
					return localize('promptHeader.skill.disableModelInvocation', "设置为 true 可防止代理自动加载此技能。用于你想要通过 /name 手动触发的工作流。默认值: false。");
			}
			break;
		case PromptsType.agent:
			switch (attributeName) {
				case PromptHeaderAttributes.name:
					return localize('promptHeader.agent.name', "智能体在 UI 中显示的名称。");
				case PromptHeaderAttributes.description:
					return localize('promptHeader.agent.description', "有关自定义智能体及其作用和使用时机的说明。");
				case PromptHeaderAttributes.argumentHint:
					return localize('promptHeader.agent.argumentHint', "参数提示描述自定义智能体期望或支持的输入。");
				case PromptHeaderAttributes.model:
					return localize('promptHeader.agent.model', "指定运行此自定义智能体的模型。也可以是模型列表。将使用第一个可用模型。");
				case PromptHeaderAttributes.tools:
					return localize('promptHeader.agent.tools', "自定义智能体可访问的工具集。");
				case PromptHeaderAttributes.handOffs:
					return localize('promptHeader.agent.handoffs', "智能体完成任务后可能的转接操作。");
				case PromptHeaderAttributes.target:
					return localize('promptHeader.agent.target', "标头属性(如工具)应用的目标。可能的值为 `github-copilot` 和 `vscode`。");
				case PromptHeaderAttributes.infer:
					return localize('promptHeader.agent.infer', "控制智能体的可见性。");
				case PromptHeaderAttributes.agents:
					return localize('promptHeader.agent.agents', "此智能体可用作子智能体的一个或多个智能体。使用 \"*\" 指定所有可用智能体。");
				case PromptHeaderAttributes.hooks:
					return localize('promptHeader.agent.hooks', "作用于此智能体的生命周期挂钩。定义仅在此智能体激活时运行的挂钩。");
				case PromptHeaderAttributes.userInvocable:
					return localize('promptHeader.agent.userInvocable', "用户是否可在 UI 中选择并调用该代理。");
				case PromptHeaderAttributes.disableModelInvocation:
					return localize('promptHeader.agent.disableModelInvocation', "如果为 true，则阻止代理被作为子代理调用。");
				case GithubPromptHeaderAttributes.github:
					return localize('promptHeader.agent.github', "代理的 GitHub 特定配置，例如令牌权限。");
			}
			break;
		case PromptsType.prompt:
			switch (attributeName) {
				case PromptHeaderAttributes.name:
					return localize('promptHeader.prompt.name', "提示的名称。这也是将运行此提示的 / 命令的名称。");
				case PromptHeaderAttributes.description:
					return localize('promptHeader.prompt.description', "有关可重用提示及其作用和使用时机的说明。");
				case PromptHeaderAttributes.argumentHint:
					return localize('promptHeader.prompt.argumentHint', "参数提示描述提示期望或支持的输入。");
				case PromptHeaderAttributes.model:
					return localize('promptHeader.prompt.model', "要在此提示中使用的模型。也可以是模型列表。将使用第一个可用模型。");
				case PromptHeaderAttributes.tools:
					return localize('promptHeader.prompt.tools', "要在此提示中使用的工具。");
				case PromptHeaderAttributes.agent:
				case PromptHeaderAttributes.mode:
					return localize('promptHeader.prompt.agent.description', "运行此提示时要使用的智能体。");
			}
			break;
	}
	return undefined;
}

// The list of tools known to be used by GitHub Copilot custom agents
export const knownGithubCopilotTools = [
	{ name: SpecedToolAliases.execute, description: localize('githubCopilot.execute', "执行命令") },
	{ name: SpecedToolAliases.read, description: localize('githubCopilot.read', "读取文件") },
	{ name: SpecedToolAliases.edit, description: localize('githubCopilot.edit', "正在编辑文件") },
	{ name: SpecedToolAliases.search, description: localize('githubCopilot.search', "搜索文件") },
	{ name: SpecedToolAliases.agent, description: localize('githubCopilot.agent', "使用子智能体") },
];

export interface IValueEntry {
	readonly name: string;
	readonly description?: string;
}

export const knownClaudeTools = [
	{ name: 'Bash', description: localize('claude.bash', "执行 shell 命令"), toolEquivalent: [SpecedToolAliases.execute] },
	{ name: 'Edit', description: localize('claude.edit', "进行目标文件编辑"), toolEquivalent: ['edit/editNotebook', 'edit/editFiles'] },
	{ name: 'Glob', description: localize('claude.glob', "按模式查找文件"), toolEquivalent: ['search/fileSearch'] },
	{ name: 'Grep', description: localize('claude.grep', "使用正则表达式搜索文件内容"), toolEquivalent: ['search/textSearch'] },
	{ name: 'Read', description: localize('claude.read', "读取文件内容"), toolEquivalent: ['read/readFile', 'read/getNotebookSummary'] },
	{ name: 'Write', description: localize('claude.write', "创建/覆盖文件"), toolEquivalent: ['edit/createDirectory', 'edit/createFile', 'edit/createJupyterNotebook'] },
	{ name: 'WebFetch', description: localize('claude.webFetch', "提取 URL 内容"), toolEquivalent: [SpecedToolAliases.web] },
	{ name: 'WebSearch', description: localize('claude.webSearch', "执行 Web 搜索"), toolEquivalent: [SpecedToolAliases.web] },
	{ name: 'Task', description: localize('claude.task', "运行子智能体处理复杂任务"), toolEquivalent: [SpecedToolAliases.agent] },
	{ name: 'Skill', description: localize('claude.skill', "执行技能"), toolEquivalent: [] },
	{ name: 'LSP', description: localize('claude.lsp', "代码智能(需要插件)"), toolEquivalent: [] },
	{ name: 'NotebookEdit', description: localize('claude.notebookEdit', "修改 Jupyter 笔记本"), toolEquivalent: ['edit/editNotebook'] },
	{ name: 'AskUserQuestion', description: localize('claude.askUserQuestion', "提出多选问题"), toolEquivalent: ['vscode/askQuestions'] },
	{ name: 'MCPSearch', description: localize('claude.mcpSearch', "启用工具搜索时搜索 MCP 工具"), toolEquivalent: [] }
];

export const knownClaudeModels = [
	{ name: 'sonnet', description: localize('claude.sonnet', "最新版 Claude Sonnet"), modelEquivalent: 'Claude Sonnet 4.5 (copilot)' },
	{ name: 'opus', description: localize('claude.opus', "最新版 Claude Opus"), modelEquivalent: 'Claude Opus 4.6 (copilot)' },
	{ name: 'haiku', description: localize('claude.haiku', "最新版 Claude Haiku，可快速处理简单任务"), modelEquivalent: 'Claude Haiku 4.5 (copilot)' },
	{ name: 'inherit', description: localize('claude.inherit', "从父智能体或提示继承模型"), modelEquivalent: undefined },
];

export function mapClaudeModels(claudeModelNames: readonly string[]): readonly string[] {
	const result = [];
	for (const name of claudeModelNames) {
		const claudeModel = knownClaudeModels.find(model => model.name === name);
		if (claudeModel && claudeModel.modelEquivalent) {
			result.push(claudeModel.modelEquivalent);
		}
	}
	return result;
}

/**
 * Maps Claude tool names to their VS Code tool equivalents.
 */
export function mapClaudeTools(claudeToolNames: readonly string[]): string[] {
	const result: string[] = [];
	for (const name of claudeToolNames) {
		const claudeTool = knownClaudeTools.find(tool => tool.name === name);
		if (claudeTool) {
			result.push(...claudeTool.toolEquivalent);
		}
	}
	return result;
}

export const claudeAgentAttributes: Record<string, { type: string; description: string; defaults?: string[]; items?: IValueEntry[]; enums?: IValueEntry[] }> = {
	'name': {
		type: 'scalar',
		description: localize('attribute.name', "使用小写字母和连字符的唯一标识符(必填)"),
	},
	'description': {
		type: 'scalar',
		description: localize('attribute.description', "委托给此子智能体时(必需)"),
	},
	'tools': {
		type: 'sequence',
		description: localize('attribute.tools', "子智能体可使用的工具数组。若省略，则继承所有工具"),
		defaults: ['Read, Edit, Bash'],
		items: knownClaudeTools
	},
	'disallowedTools': {
		type: 'sequence',
		description: localize('attribute.disallowedTools', "需拒绝的工具，从继承或指定的列表中移除"),
		defaults: ['Write, Edit, Bash'],
		items: knownClaudeTools
	},
	'model': {
		type: 'scalar',
		description: localize('attribute.model', "使用的模型: sonnet、opus、haiku 或 inherit。默认继承。"),
		defaults: ['sonnet', 'opus', 'haiku', 'inherit'],
		enums: knownClaudeModels
	},
	'permissionMode': {
		type: 'scalar',
		description: localize('attribute.permissionMode', "权限模式: default、acceptEdits、dontAsk、bypassPermissions 或 plan。"),
		defaults: ['default', 'acceptEdits', 'dontAsk', 'bypassPermissions', 'plan'],
		enums: [
			{ name: 'default', description: localize('claude.permissionMode.default', "标准行为: 首次使用每个工具时会提示获取权限。") },
			{ name: 'acceptEdits', description: localize('claude.permissionMode.acceptEdits', "自动接受会话的文件编辑权限。") },
			{ name: 'plan', description: localize('claude.permissionMode.plan', "计划模式: Claude 可进行分析，但无法修改文件或执行命令。") },
			{ name: 'delegate', description: localize('claude.permissionMode.delegate', "智能体团队负责人的纯协调模式。仅在智能体团队处于激活状态时可用。") },
			{ name: 'dontAsk', description: localize('claude.permissionMode.dontAsk', "除非通过 /permissions 或 permissions.allow 规则预先批准，否则会自动拒绝工具。") },
			{ name: 'bypassPermissions', description: localize('claude.permissionMode.bypassPermissions', "跳过所有权限提示(需要安全环境，例如容器)。") }
		]
	},
	'skills': {
		type: 'sequence',
		description: localize('attribute.skills', "启动时加载到子智能体上下文的技能。"),
	},
	'mcpServers': {
		type: 'sequence',
		description: localize('attribute.mcpServers', "此子智能体可用的 MCP 服务器。"),
	},
	'hooks': {
		type: 'object',
		description: localize('attribute.hooks', "作用于此子智能体的生命周期挂钩。"),
	},
	'memory': {
		type: 'scalar',
		description: localize('attribute.memory', "持久化内存范围: 用户、项目或本地。启用跨会话学习。"),
		defaults: ['user', 'project', 'local'],
		enums: [
			{ name: 'user', description: localize('claude.memory.user', "跨所有项目保存学习记录。") },
			{ name: 'project', description: localize('claude.memory.project', "子智能体的知识特定于项目，可通过版本控制进行共享。") },
			{ name: 'local', description: localize('claude.memory.local', "子智能体的知识特定于项目，但不应提交至版本控制。") }
		]
	}
};

/**
 * Attributes supported in Claude rules files (`.claude/rules/*.md`).
 * Claude rules use `paths` instead of `applyTo` for glob patterns.
 */
export const claudeRulesAttributes: Record<string, { type: string; description: string; defaults?: string[]; items?: IValueEntry[]; enums?: IValueEntry[] }> = {
	'description': {
		type: 'scalar',
		description: localize('attribute.rules.description', "此规则适用范围的描述，用于提供规则应用的上下文。"),
	},
	'paths': {
		type: 'sequence',
		description: localize('attribute.rules.paths', "描述此规则适用文件的 glob 模式数组。基于这些模式，当上下文中包含匹配的文件时，该文件将自动加入提示中。\r\n示例: `['src/**/*.ts', 'test/**']`"),
	},
};

export function isVSCodeOrDefaultTarget(target: Target): boolean {
	return target === Target.VSCode || target === Target.Undefined;
}

export function getTarget(promptType: PromptsType, header: PromptHeader | URI): Target {
	const uri = header instanceof URI ? header : header.uri;
	if (promptType === PromptsType.agent) {
		const parentDir = dirname(uri);
		if (parentDir.path.endsWith(`/${CLAUDE_AGENTS_SOURCE_FOLDER}`)) {
			return Target.Claude;
		}
		if (!(header instanceof URI)) {
			const target = header.target;
			if (target === Target.GitHubCopilot || target === Target.VSCode) {
				return target;
			}
		}
		return Target.Undefined;
	} else if (promptType === PromptsType.instructions) {
		if (isInClaudeRulesFolder(uri)) {
			return Target.Claude;
		}
	}
	return Target.Undefined;
}

function toMarker(message: string, range: Range, severity = MarkerSeverity.Error, tags?: MarkerTag[], code?: string): IMarkerData {
	return { severity, message, ...(tags ? { tags } : {}), ...(code ? { code } : {}), ...range };
}
