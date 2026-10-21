/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { createMarkdownCommandLink } from '../../../../base/common/htmlContent.js';
import { Disposable, DisposableMap, DisposableStore } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { autorun, observableFromEvent } from '../../../../base/common/observable.js';
import { isMacintosh, isWeb } from '../../../../base/common/platform.js';
import { PolicyCategory } from '../../../../base/common/policy.js';
import { registerEditorFeature } from '../../../../editor/common/editorFeatures.js';
import * as nls from '../../../../nls.js';
import { AccessibleViewRegistry } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { registerAction2 } from '../../../../platform/actions/common/actions.js';
import '../../../../platform/agentHost/browser/agentHostEnablementService.js';
import '../../../../platform/agentHost/common/agentHostEnablementService.js';
import { AgentHostMapLegacySettingsToManagedSettingsSettingId } from '../../../../platform/agentHost/common/agentHostManagedSettings.js';
import { AgentHostAutoReplyEnabledConfigKey, AgentHostEditAutoApprovePatternsConfigKey, AgentHostExternalSessionsMode, AgentHostGlobalAutoApproveEnabledConfigKey, AgentHostMcpConnectorsEnabledConfigKey, AgentHostMigrateLegacyCopilotCliEnabledConfigKey, AgentHostSessionCatalogEnabledConfigKey, AgentHostSessionSyncEnabledConfigKey, AgentHostShowExternalSessionsConfigKey } from '../../../../platform/agentHost/common/agentHostSchema.js';
import '../../../../platform/agentHost/common/agentHostStarter.config.contribution.js';
import { AgentMergeSettingId } from '../../../../platform/agentHost/common/agentMerge.js';
import { AgentHostAhpJsonlLoggingSettingId, AgentHostAllowSignedOutWhenUsableSettingId, AgentHostSdkSandboxEnabledSettingId, AgentHostSdkSandboxWindowsEnabledSettingId, CodexPreferAgentHostEditorSettingId } from '../../../../platform/agentHost/common/agentService.js';
import { AgentHostCopilotModelCapabilityOverridesSettingId, AgentHostCopilotRuntimePathSettingId, AgentHostCopilotSdkLogLevelSettingId, AgentHostCustomTerminalToolEnabledSettingId, AgentHostHydraFusionEnabledSettingId, AgentHostOpus48PromptEnabledSettingId, AgentHostShellToolInitScriptEnabledSettingId, AgentHostToolSearchDeferThresholdSettingId, AgentHostToolSearchEnabledSettingId, CopilotAutoModeTierOverrideSettingId, CopilotClaudeAdvisorEnabledSettingId, CopilotCliConfigKey, CopilotSkillCharBudgetSettingId, CopilotTgrepEnabledSettingId, copilotSdkLogLevelSettingValues, DEFAULT_COPILOT_SKILL_CHAR_BUDGET, normalizeSkillCharBudget } from '../../../../platform/agentHost/common/copilotCliConfig.js';
import { CopilotSemanticSearchEnabledSettingId } from '../../../../platform/agentHost/common/semanticSearchConstants.js';
import { ChatMicrosoftAuthenticationEnabledSettingId, DEFAULT_EDIT_AUTO_APPROVE_PATTERNS, mergeChatEditAutoApprovePatterns } from '../../../../platform/chat/common/chatSettings.js';
import { reasoningEffortLevels } from '../../../../platform/agentHost/common/reasoningEffort.js';
import { ChatSessionArchiveActionWordingSettingId } from '../../../../platform/chat/common/sessionArchiveActions.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { AgentHostConfigurationSyncScope, Extensions as ConfigurationExtensions, ConfigurationScope, IConfigurationNode, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IContextKey, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { CustomizationMarketplaceConfiguration } from '../../../../platform/customizationMarketplace/common/customizationMarketplaceSources.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IJSONContributionRegistry, Extensions as JSONExtensions } from '../../../../platform/jsonschemas/common/jsonContributionRegistry.js';
import { DEFAULT_LOCAL_TRANSCRIPTION_MODEL } from '../../../../platform/localTranscription/common/localTranscription.js';
import { McpAccessValue, McpAutoStartValue, mcpAccessConfig, mcpAllowedServersConfig, mcpAppsEnabledConfig, mcpAutoStartConfig, mcpDeniedServersConfig, mcpGalleryServiceEnablementConfig, mcpGalleryServiceUrlConfig } from '../../../../platform/mcp/common/mcpManagement.js';
import { AgentNetworkFilterService, IAgentNetworkFilterService } from '../../../../platform/networkFilter/common/networkFilterService.js';
import { AgentNetworkDomainSettingId } from '../../../../platform/networkFilter/common/settings.js';
import { COPILOT_ALLOWED_MCP_SERVERS_KEY, COPILOT_ALLOW_MANAGED_HOOKS_ONLY_CONFIG, COPILOT_ALLOW_MANAGED_HOOKS_ONLY_KEY, COPILOT_ALLOW_MANAGED_MCP_SERVERS_ONLY_CONFIG, COPILOT_ALLOW_MANAGED_MCP_SERVERS_ONLY_KEY, COPILOT_DENIED_MCP_SERVERS_KEY, COPILOT_DISABLE_BYPASS_PERMISSIONS_MODE_KEY, COPILOT_ENABLED_PLUGINS_KEY, COPILOT_EXTRA_MARKETPLACES_KEY, COPILOT_MODEL_KEY, COPILOT_STRICT_MARKETPLACES_KEY, COPILOT_STRICT_PLUGIN_ONLY_CUSTOMIZATION_CONFIG, COPILOT_STRICT_PLUGIN_ONLY_CUSTOMIZATION_KEY, COPILOT_TOP_LEVEL_MODEL_KEY, managedModelValue, managedSettingsDisabledValue, managedSettingValue } from '../../../../platform/policy/common/copilotManagedSettings.js';
import product from '../../../../platform/product/common/product.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { AgentSandboxEnabledValue, AgentSandboxSettingId } from '../../../../platform/sandbox/common/settings.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { type ConfigurationKeyValuePairs, Extensions, IConfigurationMigrationRegistry } from '../../../common/configuration.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../common/editor.js';
import { IWorkbenchAssignmentService } from '../../../services/assignment/common/assignmentService.js';
import { ChatEntitlement, IChatEntitlementService } from '../../../services/chat/common/chatEntitlementService.js';
import { IEditorResolverService, RegisteredEditorPriority } from '../../../services/editor/common/editorResolverService.js';
import { IPathService } from '../../../services/path/common/pathService.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { AddConfigurationType, AssistedTypes } from '../../mcp/browser/mcpCommandsAddConfiguration.js';
import { McpCollisionBehavior, allDiscoverySources, discoverySourceSettingsLabel, mcpDiscoverySection, mcpEnterpriseManagedAuthIdpSection, mcpServerCollisionBehaviorSection, mcpServerSamplingSection, mcpWorkspaceRootConfig } from '../../mcp/common/mcpConfiguration.js';
import { autoApprovePolicyValue } from '../common/agentHostConfigPolicy.js';
import { IChatVariablesService } from '../common/attachments/chatVariables.js';
import { IChatDebugService } from '../common/chatDebugService.js';
import { ChatDebugServiceImpl } from '../common/chatDebugServiceImpl.js';
import { ChatModeService, IChatMode, IChatModeService, IChatModes } from '../common/chatModes.js';
import { IChatService } from '../common/chatService/chatService.js';
import { ChatRequestOriginService, IChatRequestOriginService } from '../common/chatRequestOrigin.js';
import { ChatService } from '../common/chatService/chatServiceImpl.js';
import { IChatSessionsService } from '../common/chatSessionsService.js';
import { ChatSideChatService, IChatSideChatService } from '../common/chatSideChatService.js';
import { BYOKUtilityModelDefault, ChatAIDisabledSettingId, ChatAgentLocation, ChatConfiguration, ChatClosedPromoNotification, ChatDefaultPermissionLevel, ChatModeKind, CustomizationMigrationHintMode, ChatNotificationMode, ChatPermissionLevel } from '../common/constants.js';
import { agentsWindowHandoffConfigurationProperties } from './agentSessionsConfiguration.js';
import { chatProgressConfigurationProperties } from './chatProgressConfiguration.js';
import { customizationMarketplaceConfigurationProperties } from './aiCustomization/customizationMarketplaceConfiguration.js';
import { CodeMapperService, ICodeMapperService } from '../common/editing/chatCodeMapperService.js';
import { IChatEditingService } from '../common/editing/chatEditingService.js';
import { ILanguageModelIgnoredFilesService, LanguageModelIgnoredFilesService } from '../common/ignoredFiles.js';
import { ILanguageModelsService, LanguageModelsService } from '../common/languageModels.js';
import { ILanguageModelStatsService, LanguageModelStatsService } from '../common/languageModelStats.js';
import { ChatTransferService, IChatTransferService } from '../common/model/chatTransferService.js';
import { ChatAgentNameService, ChatAgentService, IChatAgentNameService, IChatAgentService } from '../common/participants/chatAgents.js';
import { ChatSlashCommandService, IChatSlashCommandService } from '../common/participants/chatSlashCommands.js';
import { ISessionChatPillVisibilityService, SessionChatPillVisibility } from '../common/sessionChatPills.js';
import { AgentPluginDiscoveryPriority, IAgentPluginService, agentPluginDiscoveryRegistry } from '../common/plugins/agentPluginService.js';
import { ChatPromptFilesExtensionPointHandler } from '../common/promptSyntax/chatPromptFilesContribution.js';
import { PromptsConfig, isTildePath } from '../common/promptSyntax/config/config.js';
import { AGENTS_SOURCE_FOLDER, AGENT_FILE_EXTENSION, CLAUDE_AGENTS_SOURCE_FOLDER, COPILOT_USER_AGENTS_SOURCE_FOLDER, DEFAULT_HOOK_FILE_PATHS, DEFAULT_INSTRUCTIONS_SOURCE_FOLDERS, DEFAULT_SKILL_SOURCE_FOLDERS, INSTRUCTIONS_DEFAULT_SOURCE_FOLDER, INSTRUCTION_FILE_EXTENSION, LEGACY_MODE_DEFAULT_SOURCE_FOLDER, LEGACY_MODE_FILE_EXTENSION, PROMPT_DEFAULT_SOURCE_FOLDER, PROMPT_FILE_EXTENSION, SKILL_FILENAME } from '../common/promptSyntax/config/promptFileLocations.js';
import { HOOK_SCHEMA_URI, hookFileSchema } from '../common/promptSyntax/hookSchema.js';
import { AgentHostAgentDebugLogEnabledSettingId, AgentHostAgentDebugLogMaxEventsSettingId, getDocumentationUrl, PromptFileSource, PromptsType } from '../common/promptSyntax/promptTypes.js';
import { ICustomizationMigrationService } from '../common/promptSyntax/service/customizationMigrationService.js';
import { CustomizationMigrationTelemetryService, ICustomizationMigrationTelemetryService } from '../common/promptSyntax/service/customizationMigrationTelemetryService.js';
import { CustomizationMigrationService } from './aiCustomization/customizationMigrationServiceImpl.js';
import { IPromptsService } from '../common/promptSyntax/service/promptsService.js';
import { PromptsService } from '../common/promptSyntax/service/promptsServiceImpl.js';
import { BuiltinToolsContribution } from '../common/tools/builtinTools/tools.js';
import { ChatArtifactsService, IChatArtifactsService } from '../common/tools/chatArtifactsService.js';
import { ChatTodoListService, IChatTodoListService } from '../common/tools/chatTodoListService.js';
import { ILanguageModelToolsConfirmationService } from '../common/tools/languageModelToolsConfirmationService.js';
import { LanguageModelToolsExtensionPointHandler } from '../common/tools/languageModelToolsContribution.js';
import { ILanguageModelToolsService } from '../common/tools/languageModelToolsService.js';
import { IVoiceChatService, VoiceChatService } from '../common/voiceChatService.js';
import '../common/widget/chatColors.js';
import { IChatLayoutService } from '../common/widget/chatLayoutService.js';
import { ChatResponseResourceFileSystemProvider, ChatResponseResourceWorkbenchContribution, IChatResponseResourceFileSystemProvider } from '../common/widget/chatResponseResourceFileSystemProvider.js';
import { ChatTerminalOutputTextModelService, ChatTerminalOutputTextModelWorkbenchContribution, IChatTerminalOutputTextModelService } from './agentSessions/agentHost/chatTerminalOutputTextModelContentProvider.js';
import { ChatWidgetHistoryService, IChatWidgetHistoryService } from '../common/widget/chatWidgetHistoryService.js';
import { registerChatAccessibilityActions } from './actions/chatAccessibilityActions.js';
import { AgentChatAccessibilityHelp, EditsChatAccessibilityHelp, PanelChatAccessibilityHelp, QuickChatAccessibilityHelp } from './actions/chatAccessibilityHelp.js';
import { ModeOpenChatGlobalAction, registerChatActions } from './actions/chatActions.js';
import { ChatAgentRecommendation } from './actions/chatAgentRecommendationActions.js';
import { CodeBlockActionRendering, registerChatCodeBlockActions, registerChatCodeCompareBlockActions } from './actions/chatCodeblockActions.js';
import { ChatContextContributions } from './actions/chatContext.js';
import { registerChatContextActions } from './actions/chatContextActions.js';
import { ChatCopyActionRendering, registerChatCopyActions } from './actions/chatCopyActions.js';
import { ChatModelFeedbackSurveyActionRendering, registerChatModelFeedbackSurveyActions } from './actions/chatModelFeedbackSurveyActions.js';
import { ChatHarnessSwitchFeedbackSurveyService, IChatHarnessSwitchFeedbackSurveyService } from './feedbackSurvey/chatHarnessSwitchFeedbackSurveyService.js';
import { ChatModelFeedbackSurveyService, IChatModelFeedbackSurveyService } from './feedbackSurvey/chatModelFeedbackSurveyService.js';
import { ChatModelFeedbackSurveyPromptContribution } from './feedbackSurvey/chatModelFeedbackSurveyPromptContribution.js';
import { registerChatDeveloperActions } from './actions/chatDeveloperActions.js';
import { registerChatElicitationActions } from './actions/chatElicitationActions.js';
import { registerChatExecuteActions } from './actions/chatExecuteActions.js';
import { registerChatFileTreeActions } from './actions/chatFileTreeActions.js';
import { registerChatFindActions } from './actions/chatFindActions.js';
import { ChatGettingStartedContribution } from './actions/chatGettingStarted.js';
import { registerChatExportActions } from './actions/chatImportExport.js';
import { registerLanguageModelActions } from './actions/chatLanguageModelActions.js';
import { registerMoveActions } from './actions/chatMoveActions.js';
import { registerNewChatActions } from './actions/chatNewActions.js';
import { registerChatOpenAgentDebugPanelAction } from './actions/chatOpenAgentDebugPanelAction.js';
import { registerChatPluginActions } from './actions/chatPluginActions.js';
import { registerChatPromptNavigationActions } from './actions/chatPromptNavigationActions.js';
import { registerChatQueueActions } from './actions/chatQueueActions.js';
import { registerQuickChatActions } from './actions/chatQuickInputActions.js';
import { registerChatSpeechToTextActions } from './actions/chatSpeechToTextActions.js';
import { registerChatTitleActions } from './actions/chatTitleActions.js';
import { registerChatToolActions } from './actions/chatToolActions.js';
import { ChatTransferContribution } from './actions/chatTransfer.js';
import { CONFIGURE_DICTATION_INSTRUCTIONS_ACTION_ID, registerConfigureSpeechInstructionsActions } from './actions/configureVoiceInstructionsAction.js';
import './agentSessions/agentSessions.contribution.js';
import { AgentHostChatDebugContribution } from './chatDebug/agentHostChatDebugProvider.js';
import { ChatDebugEditor } from './chatDebug/chatDebugEditor.js';
import { ChatDebugEditorInput, ChatDebugEditorInputSerializer } from './chatDebug/chatDebugEditorInput.js';
import { ChatGoalSummaryService, IChatGoalSummaryService } from './chatGoalSummaryService.js';
import { ChatSubmitRequestHandlerService, IChatSubmitRequestHandlerService } from './chatSubmitRequestHandlerService.js';
import { PromptsDebugContribution } from './promptsDebugContribution.js';
import { PromptLanguageFeaturesProvider } from './promptSyntax/promptFileContributions.js';
import { ChatSpeechToTextService, DICTATION_MAI_MODEL_ID, DictationSettingId, IChatSpeechToTextService } from './speechToText/chatSpeechToTextService.js';
import { IVoiceCodeTranscriptionClient, VoiceCodeTranscriptionClient } from './speechToText/voiceCodeTranscriptionClient.js';
import './telemetry/chatEditorTopologyTelemetry.js';
import './telemetry/chatModelCountTelemetry.js';
import { ChatToolRiskAssessmentService, IChatToolRiskAssessmentService } from './tools/chatToolRiskAssessmentService.js';
import { ClientToolSetsContribution } from './tools/clientToolSetsContribution.js';
import { RenameToolContribution } from './tools/renameTool.js';
import { UsagesToolContribution } from './tools/usagesTool.js';
import './voiceClient/micCaptureService.js';
import './voiceClient/ttsPlaybackService.js';
import './voiceClient/voiceClientService.js';
import './voiceClient/voiceSessionController.js';
import './voiceClient/voiceToolDispatchService.js';
import './voiceInputMode/voiceInputMode.js';
import { ChatVoiceInputModeAction, ChatVoiceInputModeToggleListenAction, registerVoiceInputModeSimulateActions } from './voiceInputMode/voiceInputModeActionViewItem.js';

import { ChatContextKeys } from '../common/actions/chatContextKeys.js';
import { AICustomizationManagementCommands } from '../common/aiCustomizationWorkspaceService.js';

import { ChatAccessibilityService } from './accessibility/chatAccessibilityService.js';
import './aiCustomization/aiCustomizationItemsModel.js';
import './aiCustomization/aiCustomizationManagement.contribution.js';
import './aiCustomization/aiCustomizationWorkspaceService.js';
import './aiCustomization/customizationHarnessService.js';
import './attachments/chatAttachmentModel.js';
import { ChatAttachmentResolveService, IChatAttachmentResolveService } from './attachments/chatAttachmentResolveService.js';
import { ChatAttachmentWidgetRegistry, IChatAttachmentWidgetRegistry } from './attachments/chatAttachmentWidgetRegistry.js';
import { ChatContextPickService, IChatContextPickService } from './attachments/chatContextPickService.js';
import { ChatReferenceAttachmentWidgetContribution } from './attachments/chatReferenceAttachmentWidget.contribution.js';
import { TranscriptContextAttachmentWidgetContribution } from './attachments/transcriptContextAttachmentWidget.contribution.js';
import { ChatViewId, IChatAccessibilityService, IChatCodeBlockContextProviderService, IChatPasteTargetService, IChatWidgetService, IQuickChatService, isIChatResourceViewContext, isIChatViewViewContext } from './chat.js';
import { ChatEditingEditorAccessibility } from './chatEditing/chatEditingEditorAccessibility.js';
import { registerChatEditorActions } from './chatEditing/chatEditingEditorActions.js';
import { ChatEditingEditorContextKeys } from './chatEditing/chatEditingEditorContextKeys.js';
import { ChatEditingEditorOverlay } from './chatEditing/chatEditingEditorOverlay.js';
import { ChatEditingService } from './chatEditing/chatEditingServiceImpl.js';
import { ChatEditingNotebookFileSystemProviderContrib } from './chatEditing/notebook/chatEditingNotebookFileSystemProvider.js';
import './chatManagement/chatManagement.contribution.js';
import { ChatOutlineCreator } from './chatOutlineCreator.js';
import { ChatLanguageModelsDataContribution, LanguageModelsConfigurationService } from './languageModelsConfigurationService.js';
import { ChatMarkdownAnchorService, IChatMarkdownAnchorService } from './widget/chatContentParts/chatMarkdownAnchorService.js';
import { ChatLayoutService } from './widget/chatLayoutService.js';
import './widget/input/chatInputNoticeHub.js';
import './widget/input/chatInputNotificationService.js';
import { ChatInputBoxContentProvider } from './widget/input/editor/chatEditorInputContentProvider.js';
import { ChatEditor, IChatEditorOptions } from './widgetHosts/editor/chatEditor.js';
import { ChatEditorInput, ChatEditorInputSerializer } from './widgetHosts/editor/chatEditorInput.js';

import { ILanguageModelsConfigurationService } from '../common/languageModelsConfiguration.js';
import { IAgentPluginRepositoryService } from '../common/plugins/agentPluginRepositoryService.js';
import { AgentPluginService, ConfiguredAgentPluginDiscovery, CopilotCliAgentPluginDiscovery, ExtensionAgentPluginDiscovery, MarketplaceAgentPluginDiscovery } from '../common/plugins/agentPluginServiceImpl.js';
import { IPluginGitService } from '../common/plugins/pluginGitService.js';
import { IPluginInstallService } from '../common/plugins/pluginInstallService.js';
import { DEFAULT_PLUGIN_MARKETPLACE } from '../common/plugins/marketplaceReference.js';
import { IPluginMarketplaceService, PluginMarketplaceService } from '../common/plugins/pluginMarketplaceService.js';
import { IWorkspacePluginSettingsService, WorkspacePluginSettingsService } from '../common/plugins/workspacePluginSettingsService.js';
import { VALID_PROMPT_FOLDER_PATTERN } from '../common/promptSyntax/utils/promptFilesLocator.js';
import { IToolResultCompressor } from '../common/tools/toolResultCompressor.js';
import { ChatResponseAccessibleView } from './accessibility/chatResponseAccessibleView.js';
import { ChatTerminalOutputAccessibleView } from './accessibility/chatTerminalOutputAccessibleView.js';
import { AgentPluginCommandsContribution } from './agentPluginCommands.js';
import { AgentPluginEditor } from './agentPluginEditor/agentPluginEditor.js';
import { AgentPluginEditorInput } from './agentPluginEditor/agentPluginEditorInput.js';
import { AgentPluginRepositoryService } from './agentPluginRepositoryService.js';
import { AgentHostImportConversationStore, IAgentHostImportConversationStore } from './agentSessions/agentHost/agentHostImportConversationStore.js';
import { ISessionSummaryHoverService, SessionSummaryHoverService } from './agentSessions/sessionSummaryHoverService.js';
import { ChatDynamicVariableModel } from './attachments/chatDynamicVariables.js';
import { ChatImplicitContextContribution } from './attachments/chatImplicitContext.js';
import { ChatPasteTargetService } from './attachments/chatPasteTargetService.js';
import { ChatVariablesService } from './attachments/chatVariables.js';
import { ChatImageCarouselService, IChatImageCarouselService } from './chatImageCarouselService.js';
import { EditorChatUsageContribution } from './editorChatUsage.contribution.js';
import { ChatOutputRendererService, IChatOutputRendererService } from './chatOutputItemRenderer.js';
import { ChatCompatibilityNotifier, ChatExtensionPointHandler } from './chatParticipant.contribution.js';
import { ChatPetAchievementsAccessibilityHelp, ChatPetContextContribution, ChatPetCustomizationAchievementContribution, ChatPetEditingAchievementContribution } from './chatPetAchievements.contribution.js';
import { ChatPetService, IChatPetService } from './chatPetService.js';
import { ChatPetWidgetService, IChatPetWidgetService } from './widget/chatPetWidgetService.js';
import { ChatPromoNotificationContribution } from './chatPromoNotification.js';
import { ChatExpNotificationContribution } from './expNotification/chatExpNotificationContribution.js';
import { ChatQuotaNotificationContribution } from './chatQuotaNotification.js';
import { ChatRepoInfoContribution } from './chatRepoInfo.js';
import { ChatSetupContribution, ChatTeardownContribution } from './chatSetup/chatSetupContributions.js';
import { ChatSessionOptionSlashCommandsContribution, ChatSlashCommandsContribution } from './chatSlashCommands.js';
import { ChatStatusBarEntry } from './chatStatus/chatStatusEntry.js';
import { ChatTipService, IChatTipService } from './chatTipService.js';
import { ChatWindowNotifier } from './chatWindowNotifier.js';
import { AgentPluginRecommendations } from './claudePluginRecommendations.js';
import { ChatCodeBlockContextProviderService } from './codeBlockContextProviderService.js';
import { ExploreAgentDefaultModel } from './exploreAgentDefaultModel.js';
import { HasByokModelsContribution } from './hasByokModelsContribution.js';
import { PlanAgentDefaultModel } from './planAgentDefaultModel.js';
import './planReviewFeedback/planReviewFeedbackEditorOverlay.js';
import { IPlanReviewFeedbackService, PlanReviewFeedbackService } from './planReviewFeedback/planReviewFeedbackService.js';
import { PluginAutoUpdate } from './pluginAutoUpdate.js';
import { BrowserPluginGitCommandService } from './pluginGitCommandService.js';
import { PluginInstallService } from './pluginInstallService.js';
import { PluginUrlHandler } from './pluginUrlHandler.js';
import './promptSyntax/promptCodingAgentActionContribution.js';
import './promptSyntax/promptToolsCodeLensProvider.js';
import './promptSyntax/promptToolSetsCodeLensProvider.js';
import { PromptUrlHandler } from './promptSyntax/promptUrlHandler.js';
import './promptTimeline/promptTimeline.contribution.js';
import { LanguageModelToolsConfirmationService } from './tools/languageModelToolsConfirmationService.js';
import { LanguageModelToolsService, globalAutoApproveDescription } from './tools/languageModelToolsService.js';
import { ToolResultCompressorService } from './tools/toolResultCompressorService.js';
import { ConfigureToolSets, UserToolSetsContributions } from './tools/toolSetsContribution.js';
import { UtilityModelContribution, UtilitySmallModelContribution } from './utilityModelContribution.js';
import { ChatViewsWelcomeHandler } from './viewsWelcome/chatViewsWelcomeHandler.js';
import './widget/chatContentParts/chatSubagentOpenChat.js';
import { ChatFindAccessibilityHelp } from './widget/chatFind/chatFindAccessibilityHelp.js';
import { ChatWidget } from './widget/chatWidget.js';
import { ChatWidgetService } from './widget/chatWidgetService.js';
import { ChatQueuePickerRendering } from './widget/input/chatQueuePickerActionItem.js';
import './widget/input/editor/agentHostInputCompletions.js';
import './widget/input/editor/chatInputCommandArgumentHint.js';
import './widget/input/editor/chatInputCompletions.js';
import './widget/input/editor/chatInputEditorContrib.js';
import './widget/input/editor/chatInputEditorHover.js';
import { ChatPasteProvidersFeature } from './widget/input/editor/chatPasteProviders.js';
import { QuickChatService } from './widgetHosts/chatQuick.js';
import { IRepositoryPickerOptions, PICK_REPOSITORY_COMMAND_ID, RepositoryPicker } from './agentSessions/repositoryPicker.js';

/**
 * 本产品（product.defaultChatAgent.byokOnly）不跑 Copilot 账号、Copilot SDK、智能体主机与
 * 定制市场那套机器。它们的设置项出厂默认本来就全是关，从设置页挡掉不改变任何行为，只是
 * 学生不再看见一排读不通的英文选项。默认值不是"关"的条目留下来了，理由登记在
 * scripts/oneoff/check-byok-settings.mjs 里，改这条开关前先看那份表。
 */
const byokProductIneligible = !product.defaultChatAgent?.byokOnly;

CommandsRegistry.registerCommand('_chat.notifyQuestionCarouselAnswer', (accessor: ServicesAccessor, resolveId: string, answers?: import('../common/chatService/chatService.js').IChatQuestionAnswers) => {
	accessor.get(IChatService).notifyQuestionCarouselAnswer('', resolveId, answers);
});

CommandsRegistry.registerCommand(PICK_REPOSITORY_COMMAND_ID, async (accessor: ServicesAccessor, repositoriesCommand: string, options?: IRepositoryPickerOptions) => {
	if (typeof repositoriesCommand !== 'string' || !repositoriesCommand || repositoriesCommand === PICK_REPOSITORY_COMMAND_ID) {
		throw new Error('A repository search command is required');
	}
	const commandService = accessor.get(ICommandService);
	const store = new DisposableStore();
	try {
		const picker = store.add(accessor.get(IInstantiationService).createInstance(RepositoryPicker));
		return await picker.pickRepository(async query => {
			const repositories = await commandService.executeCommand<readonly string[]>(repositoriesCommand, query);
			if (!Array.isArray(repositories) || !repositories.every(repository => typeof repository === 'string')) {
				throw new Error('The repository search command did not return repository names');
			}
			return repositories;
		}, options);
	} finally {
		store.dispose();
	}
});

const toolReferenceNameEnumValues: string[] = [];
const toolReferenceNameEnumDescriptions: string[] = [];

// Register JSON schema for hook files
const jsonContributionRegistry = Registry.as<IJSONContributionRegistry>(JSONExtensions.JSONContribution);
jsonContributionRegistry.registerSchema(HOOK_SCHEMA_URI, hookFileSchema);

// Register configuration
const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
const migrationsTabLink = createMarkdownCommandLink({
	id: AICustomizationManagementCommands.OpenEditor,
	text: nls.localize('chat.locations.migrate', "迁移标签页"),
	tooltip: nls.localize('chat.locations.migrate.tooltip', "打开「迁移」标签页"),
	arguments: [{ migration: true }],
});
configurationRegistry.registerConfiguration({
	id: 'chatSidebar',
	// allow-any-unicode-next-line
	title: nls.localize('interactiveSessionConfigurationTitle', "聊天"),
	type: 'object',
	properties: {
		'chat.experimentalSessionsWindowOverride': {
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.experimentalSessionsWindowOverride', "如果为 true，将针对扩展启用特定于会话窗口的行为。"),
			default: false,
			tags: ['experimental'],
			agentsWindow: { default: true },
		},
		'chat.experimentalModelPicker': {
			type: 'boolean',
			description: nls.localize('chat.experimentalModelPicker', "When enabled, the model picker uses provider tabs and a model details page for information and configuration. Open details from a model's information button or the thinking effort and context readout in the chat input."),
			default: false,
			tags: ['experimental'],
			experiment: { mode: 'auto' },
		},
		[ChatConfiguration.ExperimentalModePermissionsPicker]: {
			type: 'boolean',
			description: nls.localize('chat.experimentalModePermissionsPicker', "Shows mode and permissions in a combined picker with expandable permission choices for Copilot Agent Host sessions."),
			default: product.quality !== 'stable',
			tags: ['experimental'],
		},
		'chat.fontSize': {
			type: 'number',
			// allow-any-unicode-next-line
			description: nls.localize('chat.fontSize', "控制聊天消息中的字号(以像素为单位)。"),
			default: 13,
			minimum: 6,
			maximum: 100
		},
		'chat.fontFamily': {
			type: 'string',
			// allow-any-unicode-next-line
			description: nls.localize('chat.fontFamily', "控制聊天消息中的字体系列。"),
			default: 'default'
		},
		'dictation.enabled': {
			type: 'boolean',
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('dictation.enabled', "开启后，聊天输入框会出现麦克风按钮，听写快捷键也会生效。桌面端使用所选的本地转写模型，网页端走云端转写。\n\n本产品在出厂时把它关着：语音听写要一份我们不随安装器附带的转写模型，装上麦克风按钮只会多出一个学生按了只会等到报错的图标。需要时把这一项勾上即可整套恢复。"),
			// Olympia 出厂默认关。这一项同时决定聊天输入框的麦克风按钮、听写快捷键和
			// 「Dictate: …」那一组命令（它们的 precondition 读的是同一个 chatSpeechToTextConfigured）；
			// 上游默认 true 是给 Copilot 用户的，本产品 BYOK-only，转写模型不在安装器里。
			default: false,
			tags: ['experimental'],
			policy: {
				name: 'DictationEnabled',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.131',
				localization: {
					description: {
						key: 'dictation.enabled.policy',
						value: nls.localize('dictation.enabled.policy', "Controls whether dictation is available across the product (chat input, editor, and terminal).")
					}
				},
			}
		},
		'dictation.model': {
			included: byokProductIneligible, // 本产品没有托管助手，这一条没有对应的东西可设
			type: 'string',
			enum: [
				DEFAULT_LOCAL_TRANSCRIPTION_MODEL,
				DICTATION_MAI_MODEL_ID,
			],
			enumItemLabels: [
				nls.localize('dictation.model.nemotronMultilingual.label', "Nemotron 3.5 ASR (Multilingual) — On-Device"),
				nls.localize('dictation.model.mai.label', "MAI — Cloud"),
			],
			markdownEnumDescriptions: [
				nls.localize('dictation.model.nemotronMultilingual', "NVIDIA Nemotron 3.5 多语种流式 RNN-T，通过 Microsoft Foundry Local 在本机运行。可离线使用，音频不会离开这台机器。语言跟随语音模式的设置自动选择：该设置为“自动”时，先按显示语言，其次按系统或浏览器的区域设置，最后回落到模型自行识别。首次使用时下载并缓存在磁盘上。"),
				nls.localize('dictation.model.mai', "Cloud transcription through the same Microsoft AI voice service used by Voice Mode. Requires a network connection and GitHub sign-in; audio is streamed to the service."),
			],
			markdownDescription: nls.localize('dictation.model', "听写使用的模型。本机模型在首次使用时下载，并通过 Microsoft Foundry Local 在本机运行；云端选项会把音频流式送到 Microsoft 的语音服务。在网页版里，用户选择与默认的“本机”方案会改用云端转写，因为本机转写在网页上不被支持；如果策略要求本机转写，网页版就没有听写可用。"),
			default: isWeb ? DICTATION_MAI_MODEL_ID : DEFAULT_LOCAL_TRANSCRIPTION_MODEL,
			tags: ['experimental'],
			experiment: { mode: 'auto' },
			policy: {
				name: 'DictationModel',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.136',
				localization: {
					description: {
						key: 'dictation.model.policy',
						value: nls.localize('dictation.model.policy', "Controls the transcription model used for dictation.")
					},
					enumDescriptions: [
						{
							key: 'dictation.model.nemotronMultilingual.policy',
							value: nls.localize('dictation.model.nemotronMultilingual.policy', "Use the on-device transcription model. Audio does not leave the device.")
						},
						{
							key: 'dictation.model.mai.policy',
							value: nls.localize('dictation.model.mai.policy', "Use the cloud transcription service. Audio is streamed to the service.")
						},
					]
				},
			}
		},
		[DictationSettingId.ShowTranscript]: {
			type: 'boolean',
			markdownDescription: nls.localize('dictation.showTranscript', "Controls whether the transcript is shown while dictating. The final transcript is inserted when dictation ends."),
			default: true,
			tags: ['experimental']
		},
		[DictationSettingId.ShowButton]: {
			type: 'boolean',
			markdownDescription: nls.localize('dictation.showButton', "Controls whether the dictation microphone button is shown in the chat input. When hidden, dictation can still be started with its keyboard shortcut."),
			default: true,
			tags: ['experimental']
		},
		'dictation.experimental.llmCleanup': {
			included: byokProductIneligible, // 本产品没有托管助手，这一条没有对应的东西可设
			type: 'boolean',
			markdownDescription: nls.localize('dictation.experimental.llmCleanup', "Experimental: when dictation ends, the final transcript is passed through a small language model to restore punctuation, capitalization, paragraphs, and lists. Requires Copilot to be enabled; the transcript is sent to the language model for cleanup. Falls back to the raw transcript when no model is available. Use [dictation instructions](command:{0}) to customize terminology and formatting.", CONFIGURE_DICTATION_INSTRUCTIONS_ACTION_ID),
			default: true,
			tags: ['experimental'],
			policy: {
				name: 'DictationLLMCleanup',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.136',
				localization: {
					description: {
						key: 'dictation.experimental.llmCleanup.policy',
						value: nls.localize('dictation.experimental.llmCleanup.policy', "Controls whether final dictation transcripts are sent to a language model for cleanup.")
					}
				},
			}
		},
		'dictation.experimental.llmCleanupModel': {
			included: byokProductIneligible, // 本产品没有托管助手，这一条没有对应的东西可设
			type: 'string',
			enum: ['auto', 'copilot-utility-small', 'gpt-5.6-luna'],
			markdownDescription: nls.localize('dictation.experimental.llmCleanupModel', "Controls the language model used for experimental dictation cleanup. `auto` follows the experiment-provided default."),
			default: 'auto',
			tags: ['experimental'],
			experiment: {
				mode: 'auto'
			}
		},
		'chat.editor.fontSize': {
			type: 'number',
			// allow-any-unicode-next-line
			description: nls.localize('interactiveSession.editor.fontSize', "控制聊天代码块中的字号(以像素为单位)。"),
			default: isMacintosh ? 12 : 14,
		},
		'chat.editor.fontFamily': {
			type: 'string',
			// allow-any-unicode-next-line
			description: nls.localize('interactiveSession.editor.fontFamily', "控制聊天代码块中的字体系列。"),
			default: 'default'
		},
		'chat.editor.fontWeight': {
			type: 'string',
			// allow-any-unicode-next-line
			description: nls.localize('interactiveSession.editor.fontWeight', "控制聊天代码块中的字体粗细。"),
			default: 'default'
		},
		'chat.editor.wordWrap': {
			type: 'string',
			// allow-any-unicode-next-line
			description: nls.localize('interactiveSession.editor.wordWrap', "控制行是否应整合在聊天代码块中。"),
			default: 'off',
			enum: ['on', 'off']
		},
		'chat.editor.lineHeight': {
			type: 'number',
			// allow-any-unicode-next-line
			description: nls.localize('interactiveSession.editor.lineHeight', "聊天代码块中的行高(以像素为单位)。使用 0 可根据字号计算行高。"),
			default: 0
		},
		[ChatConfiguration.AgentStatusEnabled]: {
			type: 'string',
			enum: ['hidden', 'badge', 'compact'],
			enumDescriptions: [
				// allow-any-unicode-next-line
				nls.localize('chat.agentsControl.hidden', "智能体状态指示器从标题栏隐藏。"),
				// allow-any-unicode-next-line
				nls.localize('chat.agentsControl.badge', "将智能体状态显示为命令中心旁边的徽章。"),
				// allow-any-unicode-next-line
				nls.localize('chat.agentsControl.compact', "将命令中心搜索框替换为压缩智能体状态指示器和统一聊天小组件。"),
			],
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.agentsControl.enabled', "控制“智能体状态”指示器在标题栏命令中心中的显示方式。设置为 `hidden` 时，不显示指示器。其他值显示指示器，并自动启用 {0}。未读和正在进行会话指示器要求启用 {1}。", '`#window.commandCenter#`', '`#chat.viewSessions.enabled#`'),
			default: 'hidden',
			tags: ['experimental']
		},
		[ChatConfiguration.UnifiedAgentsBar]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.unifiedAgentsBar.enabled', "将命令中心搜索框替换为统一聊天和搜索小组件。"),
			default: false,
			tags: ['experimental']
		},
		[ChatConfiguration.AgentSessionProjectionEnabled]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.agentSessionProjection.enabled', "控制是否启用智能体会话投影模式以在重点工作区中查看智能体会话。"),
			default: false,
			tags: ['experimental'],
		},
		[ChatConfiguration.MigrateLegacyCopilotCliSessions]: {
			included: byokProductIneligible, // 本产品没有托管助手，这一条没有对应的东西可设
			type: 'boolean',
			markdownDescription: nls.localize('chat.agentSessions.migrateLegacyCopilotCli', "Controls whether legacy extension host Copilot CLI chat sessions are migrated in place to the Agent host when opened, so their history becomes editable. When disabled, legacy sessions open as before.\n\nChanging this setting requires a restart to take effect."),
			default: false,
			tags: ['experimental'],
			// Migration is a global, one-time behavior over the shared agent host, so it is a
			// single value for all windows rather than a per-window preference.
			scope: ConfigurationScope.APPLICATION,
			experiment: {
				mode: 'startup'
			},
			agentHost: { key: AgentHostMigrateLegacyCopilotCliEnabledConfigKey },
		},
		[ChatConfiguration.SessionCatalogEnabled]: {
			type: 'boolean',
			markdownDescription: nls.localize('chat.agentHost.sessionCatalog', "Controls whether the agent session list is served from the Agent host's session catalog. When disabled, sessions are listed from provider metadata and per-session storage instead, which is slower.\n\nChanging this setting requires a restart to take effect."),
			default: true,
			tags: ['experimental', 'advanced'],
			// The catalog backs the shared agent host, so it is a single value for all
			// windows rather than a per-window preference.
			scope: ConfigurationScope.APPLICATION,
			experiment: {
				mode: 'startup'
			},
			agentHost: { key: AgentHostSessionCatalogEnabledConfigKey },
		},
		[ChatConfiguration.ShowExternalAgentSessions]: {
			type: 'string',
			enum: [AgentHostExternalSessionsMode.None, AgentHostExternalSessionsMode.Recent, AgentHostExternalSessionsMode.Last24Hours, AgentHostExternalSessionsMode.Last7Days, AgentHostExternalSessionsMode.Last30Days],
			enumDescriptions: [
				nls.localize('chat.agentSessions.showExternal.none', "Do not show external sessions."),
				nls.localize('chat.agentSessions.showExternal.recent', "Show up to the 2 most recent external sessions updated in the last 7 days. At startup, external sessions older than the second-most-recently updated local session are hidden."),
				nls.localize('chat.agentSessions.showExternal.last24Hours', "Show external sessions updated in the last 24 hours."),
				nls.localize('chat.agentSessions.showExternal.last7Days', "Show external sessions updated in the last 7 days."),
				nls.localize('chat.agentSessions.showExternal.last30Days', "Show external sessions updated in the last 30 days."),
			],
			default: AgentHostExternalSessionsMode.Recent,
			markdownDescription: nls.localize('chat.agentSessions.showExternal', "Controls which external agent sessions are shown. External sessions are sessions that were created in a different application and have not received a message from this application yet."),
			tags: ['experimental'],
			experiment: { mode: 'auto' },
			agentHost: { key: AgentHostShowExternalSessionsConfigKey },
		},
		[ChatConfiguration.SaveBeforeSend]: {
			type: 'boolean',
			description: nls.localize('chat.saveBeforeSend', "Controls whether all dirty editors except untitled editors are saved before sending a chat message."),
			default: true,
		},
		'chat.implicitContext.enabled': {
			type: 'object',
			// allow-any-unicode-next-line
			description: nls.localize('chat.implicitContext.enabled.1', "允许自动将活动编辑器用作指定聊天位置的聊天上下文。"),
			additionalProperties: {
				type: 'string',
				enum: ['never', 'first', 'always'],
				// allow-any-unicode-next-line
				description: nls.localize('chat.implicitContext.value', "隐式上下文的值。"),
				enumDescriptions: [
					// allow-any-unicode-next-line
					nls.localize('chat.implicitContext.value.never', "从不启用隐式上下文。"),
					// allow-any-unicode-next-line
					nls.localize('chat.implicitContext.value.first', "已为第一次交互启用隐式上下文。"),
					// allow-any-unicode-next-line
					nls.localize('chat.implicitContext.value.always', "始终启用隐式上下文。")
				]
			},
			default: {
				'panel': 'always',
			},
			tags: ['experimental'],
			experiment: {
				mode: 'startup'
			},
			agentsWindow: { default: { 'panel': 'never' } },
		},
		'chat.implicitContext.suggestedContext': {
			type: 'boolean',
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.implicitContext.suggestedContext', "控制是否显示新的隐式上下文流。在“询问和编辑”模式下，上下文将自动包含在内。使用智能体时，将以附件的形式建议上下文。选择内容始终作为上下文包含在内。"),
			default: true,
			agentsWindow: { default: false },
		},
		'chat.implicitContext.includeActiveEditor': {
			type: 'boolean',
			markdownDescription: nls.localize('chat.implicitContext.includeActiveEditor', "启用后，当前编辑器里的文件会自动作为上下文发出去，而不是只作为建议附上。选中的内容和手动附加的文件始终会带上。\n\n注意：这一项目前只影响智能体主机那一类会话。"),
			default: true,
			tags: ['experimental'],
			agentsWindow: { default: false },
		},
		'chat.editing.autoAcceptDelay': {
			type: 'number',
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.editing.autoAcceptDelay', "自动接受聊天所做更改的延迟时间。值以秒为单位，`0` 表示禁用，最大为 `100` 秒。"),
			default: 0,
			minimum: 0,
			maximum: 100
		},
		'chat.editing.confirmEditRequestRemoval': {
			type: 'boolean',
			scope: ConfigurationScope.APPLICATION,
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.editing.confirmEditRequestRemoval', "是否在删除请求及其关联的编辑之前显示确认消息。"),
			default: true,
		},
		'chat.editing.confirmEditRequestRetry': {
			type: 'boolean',
			scope: ConfigurationScope.APPLICATION,
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.editing.confirmEditRequestRetry', "是否在重试请求及其关联的编辑之前显示确认消息。"),
			default: true,
		},
		'chat.editing.explainChanges.enabled': {
			type: 'boolean',
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.editing.explainChanges.enabled', "控制是否显示“聊天”面板中的“解释”按钮和 SCM 视图中的“解释更改”上下文菜单。这是一项实验性功能。"),
			default: false,
			tags: ['experimental'],
			experiment: {
				mode: 'auto'
			}
		},
		[ChatConfiguration.RevealNextChangeOnResolve]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.editing.revealNextChangeOnResolve', "控制编辑器在保留或撤消聊天编辑后是否自动显示下一个更改。"),
			default: true,
		},
		[ChatConfiguration.OpenChangedFileInDiffEditor]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.editing.openChangedFileInDiffEditor', "控制在聊天响应的已更改文件列表中选择文件时，是在显示聊天所做更改的差异编辑器中打开文件，还是在常规编辑器中打开。按住 `kbstyle(Alt)` 再选择文件，会以相反的方式打开它。"),
			default: true,
		},
		'chat.tips.enabled': {
			type: 'boolean',
			scope: ConfigurationScope.APPLICATION,
			// allow-any-unicode-next-line
			description: nls.localize('chat.tips.enabled', "控制提示是否显示在聊天中的用户消息上方。新提示会频繁添加，这有助于你及时了解最新功能。"),
			default: true,
		},
		'chat.upvoteAnimation': {
			type: 'string',
			enum: ['off', 'confetti', 'floatingThumbs', 'pulseWave', 'radiantLines'],
			enumDescriptions: [
				// allow-any-unicode-next-line
				nls.localize('chat.upvoteAnimation.off', "未显示动画。"),
				// allow-any-unicode-next-line
				nls.localize('chat.upvoteAnimation.confetti', "在点赞按钮周围显示五彩纸屑爆炸动画。"),
				// allow-any-unicode-next-line
				nls.localize('chat.upvoteAnimation.floatingThumbs', "显示从按钮上升的浮动点赞图标。"),
				// allow-any-unicode-next-line
				nls.localize('chat.upvoteAnimation.pulseWave', "显示从按钮扩散的脉冲环。"),
				// allow-any-unicode-next-line
				nls.localize('chat.upvoteAnimation.radiantLines', "显示从按钮发出的光线。"),
			],
			// allow-any-unicode-next-line
			description: nls.localize('chat.upvoteAnimation', "控制点击聊天响应上的点赞按钮时是否显示动画。"),
			default: 'floatingThumbs',
		},
		'chat.experimental.detectParticipant.enabled': {
			type: 'boolean',
			// allow-any-unicode-next-line
			deprecationMessage: nls.localize('chat.experimental.detectParticipant.enabled.deprecated', "此设置已弃用。请改用“chat.detectParticipant.enabled”。"),
			// allow-any-unicode-next-line
			description: nls.localize('chat.experimental.detectParticipant.enabled', "为 panel 聊天启用聊天参与者自动删除功能。"),
			default: null
		},
		[ChatConfiguration.IncrementalRendering]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.experimental.incrementalRendering.enabled', "启用聊天响应流式传输时的增量渲染，并可选择块级动画。"),
			default: false,
			tags: ['experimental'],
		},
		[ChatConfiguration.RichLinks]: {
			type: 'boolean',
			description: nls.localize('chat.experimental.richLinks.enabled', "启用后，聊天里受支持的链接会渲染成带实时信息的卡片；为此可能向链接所属的服务发起需要登录态的请求。"),
			default: false,
			tags: ['experimental'],
			experiment: { mode: 'auto' },
		},
		[ChatConfiguration.IncrementalRenderingStyle]: {
			type: 'string',
			enum: ['none', 'fade', 'rise', 'blur', 'scale', 'slide', 'reveal'],
			enumDescriptions: [
				// allow-any-unicode-next-line
				nls.localize('chat.experimental.incrementalRendering.animationStyle.none', "无动画。内容立即显示。"),
				// allow-any-unicode-next-line
				nls.localize('chat.experimental.incrementalRendering.animationStyle.fade', "简单的不透明度从 0 淡入到 1。"),
				// allow-any-unicode-next-line
				nls.localize('chat.experimental.incrementalRendering.animationStyle.rise', "内容向上升起并淡入。"),
				// allow-any-unicode-next-line
				nls.localize('chat.experimental.incrementalRendering.animationStyle.blur', "内容从模糊状态淡入。"),
				// allow-any-unicode-next-line
				nls.localize('chat.experimental.incrementalRendering.animationStyle.scale', "内容从略小尺寸放大显示。"),
				// allow-any-unicode-next-line
				nls.localize('chat.experimental.incrementalRendering.animationStyle.slide', "内容从左侧滑入。"),
				// allow-any-unicode-next-line
				nls.localize('chat.experimental.incrementalRendering.animationStyle.reveal', "内容从上到下显示，带有柔和渐变边缘。"),
			],
			// allow-any-unicode-next-line
			description: nls.localize('chat.experimental.incrementalRendering.animationStyle', "控制增量渲染的动画样式。"),
			default: 'fade',
			tags: ['experimental'],
		},
		[ChatConfiguration.IncrementalRenderingBuffering]: {
			type: 'string',
			enum: ['off', 'word', 'paragraph'],
			enumDescriptions: [
				// allow-any-unicode-next-line
				nls.localize('chat.experimental.incrementalRendering.buffering.off', "令牌到达时立即渲染内容。"),
				// allow-any-unicode-next-line
				nls.localize('chat.experimental.incrementalRendering.buffering.word', "逐字显示内容。"),
				// allow-any-unicode-next-line
				nls.localize('chat.experimental.incrementalRendering.buffering.paragraph', "缓冲内容至段落分隔处再进行渲染。"),
			],
			// allow-any-unicode-next-line
			description: nls.localize('chat.experimental.incrementalRendering.buffering', "控制增量渲染过程中内容在渲染前的缓冲方式。缓冲级别越低，渲染越快，但可能显示不完整句子或未成型的 Markdown。"),
			default: 'word',
			tags: ['experimental'],
		},
		[ChatConfiguration.CollapseCompletedResponses]: {
			type: 'boolean',
			description: nls.localize('chat.agent.collapseCompletedResponses', "Controls whether completed chat responses collapse intermediate work while keeping the final response visible."),
			default: true,
		},
		'chat.detectParticipant.enabled': {
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.detectParticipant.enabled', "为 panel 聊天启用聊天参与者自动删除功能。"),
			default: true
		},
		[ChatConfiguration.ExperimentalStickyScrollEnabled]: {
			type: 'boolean',
			description: nls.localize('chat.experimental.stickyScroll.enabled', "Controls whether chat requests use experimental tree-based sticky scroll instead of the sticky prompt header."),
			default: true,
			tags: ['experimental'],
		},
		[ChatConfiguration.InlineReferencesStyle]: {
			type: 'string',
			enum: ['box', 'link'],
			enumDescriptions: [
				// allow-any-unicode-next-line
				nls.localize('chat.inlineReferences.style.box', "将文件和符号引用显示为带图标的方框小组件。"),
				// allow-any-unicode-next-line
				nls.localize('chat.inlineReferences.style.link', "将文件和符号引用显示为不带图标的简单蓝色链接。")
			],
			// allow-any-unicode-next-line
			description: nls.localize('chat.inlineReferences.style', "控制在聊天消息中显示文件和符号引用的方式。"),
			default: 'box'
		},
		[ChatConfiguration.EditorAssociations]: {
			type: 'object',
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.editorAssociations', "将 [glob 模式](https://aka.ms/vscode-glob-patterns)配置为编辑器以打开聊天中的文件(例如 `\"*.md\": \"vscode.markdown.preview.editor\"`)。"),
			additionalProperties: {
				type: 'string'
			},
			default: {
			}
		},
		[ChatConfiguration.NotifyWindowOnConfirmation]: {
			type: 'string',
			enum: ['off', 'windowNotFocused', 'always'],
			enumDescriptions: [
				// allow-any-unicode-next-line
				nls.localize('chat.notifyWindowOnConfirmation.off', "从不显示用于确认的操作系统通知。"),
				// allow-any-unicode-next-line
				nls.localize('chat.notifyWindowOnConfirmation.windowNotFocused', "当未聚焦窗口时，显示操作系统通知以进行确认。"),
				// allow-any-unicode-next-line
				nls.localize('chat.notifyWindowOnConfirmation.always', "始终显示用于确认的操作系统通知，即使窗口处于焦点。"),
			],
			// allow-any-unicode-next-line
			description: nls.localize('chat.notifyWindowOnConfirmation', "控制在确认或问题需要输入时，聊天会话是否应向用户呈现操作系统通知。这包括窗口徽章和通知横幅。"),
			default: 'windowNotFocused',
		},
		[ChatConfiguration.AutoReply]: {
			default: false,
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.autoReply.description', "告知智能体用户当前不在并让其自行判断，自动跳过问题轮播。这是一个高级设置，可能会因不完整上下文而导致意外选择或操作。"),
			type: 'boolean',
			scope: ConfigurationScope.APPLICATION_MACHINE,
			tags: ['experimental', 'advanced'],
			agentHost: { key: AgentHostAutoReplyEnabledConfigKey },
		},
		[ChatConfiguration.AutopilotAdvancedEnabled]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.autopilot.advanced.enabled', "启用**高级 Autopilot**，这是一个单开关功能，可启用所有高级 Autopilot 行为，让智能体代为处理更多循环。目前，每次 Autopilot 轮次后，一个小型快速模型会评估原始请求是否已完成；如果没有，Autopilot 会根据该评估继续工作，并将其作为下一轮的指导，而不是依赖智能体自行发出完成信号。"),
			default: false,
			tags: ['experimental'],
		},
		[ChatConfiguration.DefaultPermissionLevel]: {
			type: 'string',
			enum: [ChatPermissionLevel.Default, ChatPermissionLevel.AutoApprove, ChatPermissionLevel.Autopilot],
			enumItemLabels: [
				// allow-any-unicode-next-line
				nls.localize('chat.permissions.default.default.label', "默认审批"),
				// allow-any-unicode-next-line
				nls.localize('chat.permissions.default.autoApprove.label', "绕过审批"),
				// allow-any-unicode-next-line
				nls.localize('chat.permissions.default.autopilot.label', "Autopilot (预览版)"),
			],
			enumDescriptions: [
				// allow-any-unicode-next-line
				nls.localize('chat.permissions.default.default.description', "以默认审批方式启动新聊天会话。"),
				// allow-any-unicode-next-line
				nls.localize('chat.permissions.default.autoApprove.description', "以绕过审批模式启动新聊天会话。"),
				// allow-any-unicode-next-line
				nls.localize('chat.permissions.default.autopilot.description', "以 Autopilot 模式启动新聊天会话。"),
			],
			// allow-any-unicode-next-line
			description: nls.localize('chat.permissions.default.settingDescription', "控制新本地聊天会话的默认权限选取器模式。你仍可按会话更改权限模式，且每个会话会记住所使用的权限模式。如果企业策略禁用自动审批，新会话将使用默认审批。"),
			default: ChatPermissionLevel.Default,
		},
		[ChatConfiguration.PermissionsSandboxToggleEnabled]: {
			type: 'boolean',
			default: true,
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.experimental.permissionsSandboxToggle.enabled', "控制权限选取器是否在“默认批准”选项上显示内联的“终端沙盒化”切换开关。切换开关反映并更新 `#chat.agent.sandbox.enabled#`。"),
			tags: ['experimental'],
			experiment: {
				mode: 'auto'
			},
		},
		[ChatConfiguration.DefaultConfiguration]: {
			type: 'object',
			additionalProperties: false,
			properties: {
				mode: {
					type: 'string',
					enum: ['interactive', 'plan', 'autopilot'],
					enumDescriptions: [
						// allow-any-unicode-next-line
						nls.localize('chat.defaultConfiguration.mode.interactive', "交互式 - 分步协作。"),
						// allow-any-unicode-next-line
						nls.localize('chat.defaultConfiguration.mode.plan', "计划 — 先计划，准备好后执行。"),
						// allow-any-unicode-next-line
						nls.localize('chat.defaultConfiguration.mode.autopilot', "Autopilot - 从头到尾自主迭代。"),
					],
					default: 'interactive',
					// allow-any-unicode-next-line
					description: nls.localize('chat.defaultConfiguration.mode.description', "新智能体会话的启动模式。"),
				},
				approvals: {
					type: 'string',
					enum: [ChatDefaultPermissionLevel.Manual, ChatDefaultPermissionLevel.Assisted, ChatDefaultPermissionLevel.AllowAll],
					enumDescriptions: [
						// allow-any-unicode-next-line
						nls.localize('chat.defaultConfiguration.approvals.manual', "手动权限 — 审批设置不适用时询问。"),
						// allow-any-unicode-next-line
						nls.localize('chat.defaultConfiguration.approvals.assisted', "辅助权限 — 执行工具前先评估风险。"),
						// allow-any-unicode-next-line
						nls.localize('chat.defaultConfiguration.approvals.allowAll', "全部允许 — 直接执行工具调用，不再询问。"),
					],
					default: ChatDefaultPermissionLevel.Manual,
					// allow-any-unicode-next-line
					description: nls.localize('chat.defaultConfiguration.approvals.description', "新智能体会话的起始审批行为。如果企业策略禁用自动审批，新会话将使用默认审批。"),
				},
			},
			default: { mode: 'interactive', approvals: ChatDefaultPermissionLevel.Manual },
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.defaultConfiguration.settingDescription', "控制新智能体会话的默认配置。你仍然可以按会话更改模式和审批行为，每个会话都会记住所使用的设置。"),
		},
		[ChatConfiguration.DefaultModel]: {
			type: 'string',
			default: '',
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.defaultModel.description', "新聊天对话的默认模型。填模型系列名称以使用该系列中最新可用的模型，或填你在 AI 设置里配好的完整模型 ID。你仍然可以在对话中切换模型；每个新对话都从此模型开始。"),
			experiment: {
				mode: 'auto'
			},
			policy: {
				name: 'ChatDefaultModel',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.127',
				value: managedModelValue(),
				managedSettings: {
					[COPILOT_MODEL_KEY]: { type: 'string' },
					[COPILOT_TOP_LEVEL_MODEL_KEY]: { type: 'string' },
				},
				localization: {
					description: {
						key: 'chat.defaultModel.policy',
						// allow-any-unicode-next-line
						value: nls.localize('chat.defaultModel.policy', "设置新对话的默认聊天模型。接受“自动”、模型系列名称(例如 \"opus\" 或 \"gemini\")或完整模型 ID。用户仍然可以在对话中切换模型。")
					}
				},
			},
		},
		[ChatConfiguration.GlobalAutoApprove]: {
			default: false,
			markdownDescription: globalAutoApproveDescription.value,
			type: 'boolean',
			scope: ConfigurationScope.APPLICATION_MACHINE,
			tags: ['experimental'],
			agentHost: { key: AgentHostGlobalAutoApproveEnabledConfigKey },
			policy: {
				name: 'ChatToolsAutoApprove',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.99',
				value: autoApprovePolicyValue,
				managedSettings: {
					[COPILOT_DISABLE_BYPASS_PERMISSIONS_MODE_KEY]: { type: 'string' },
				},
				localization: {
					description: {
						key: 'autoApprove3.description',
						// allow-any-unicode-next-line
						value: nls.localize('autoApprove3.description', "全局自动批准也称为“YOLO 模式”，它会完全禁用对所有工作区中所有工具的手动审批，从而允许智能体完全自主地执行操作。此操作极为危险，并且“从不”建议使用，因为即使是 Codespaces 和开发容器等容器化环境也会将用户密钥转发到可能遭到入侵的容器中。\r\n\r\n此功能会禁用关键安全保护，并导致攻击者能够更容易地入侵计算机。\r\n\r\n注意: 此设置仅控制工具审批，不会阻止智能体提问。要自动回答智能体的问题，请使用 `#chat.autoReply#` 设置。")
					}
				},
			}
		},
		[ChatConfiguration.SessionSyncEnabled]: {
			default: false,
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.sessionSync.enabled', "启用会话同步到 GitHub.com。启用后，Copilot 会话数据将同步到你的 GitHub 帐户，实现跨设备访问并提供更丰富的见解。还需要启用 `#github.copilot.chat.localIndex.enabled#`。"),
			type: 'boolean',
			// 这条承诺的是「Copilot 会话数据同步到你的 GitHub 帐户」，而本产品只有 BYOK 教练：
			// 没有 GitHub 帐户可同步，也没有那条链路。留着它等于在设置里挂一个按下去不会有任何
			// 结果的开关。included 为假时这条不进注册表、设置界面也搜不到（与
			// extensions.verifySignature 用 isNative 是同一机制）。
			included: !product.defaultChatAgent?.byokOnly,
			tags: ['experimental'],
			experiment: {
				mode: 'auto'
			},
			policy: {
				name: 'CopilotSessionSync',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.121',
				value: (policyData) => policyData.cloud_session_storage_enabled === false ? false : undefined,
				localization: {
					description: {
						key: 'chat.sessionSync.enabled.policy',
						// allow-any-unicode-next-line
						value: nls.localize('chat.sessionSync.enabled.policy', "启用与 GitHub.com 的会话同步，以实现跨设备的 Copilot 会话历史记录共享。如果被组织策略禁用，则会话数据仅保留在本地。"),
					}
				},
			},
			agentHost: { key: AgentHostSessionSyncEnabledConfigKey },
		},
		[ChatConfiguration.SessionSyncExcludeRepositories]: {
			type: 'array',
			items: { type: 'string' },
			default: [],
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.sessionSync.excludeRepositories', "要从会话同步中排除的存储库模式。使用准确的 `owner/repo` 名称或通配符模式，如 `my-org/*`。匹配存储库的会话仅存储在本地。"),
			tags: ['experimental', 'advanced'],
		},
		[ChatConfiguration.AutoApproveEdits]: {
			default: DEFAULT_EDIT_AUTO_APPROVE_PATTERNS,
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.tools.autoApprove.edits', "控制是否自动批准智能体所做的编辑。默认设置是批准所有编辑，但对某些文件所做的可能会导致立即产生意外副作用的编辑除外，例如 `**/.vscode/*.json`。\r\n\r\n设置为 `true` 会自动批准对匹配文件的编辑，设置为 `false` 则始终需要显式批准。匹配给定文件的最后一个模式决定是否自动批准编辑。"),
			type: 'object',
			additionalProperties: {
				type: 'boolean',
			},
			scope: ConfigurationScope.APPLICATION,
			agentHost: {
				key: AgentHostEditAutoApprovePatternsConfigKey,
				transform: mergeChatEditAutoApprovePatterns,
			},
		},
		[ChatConfiguration.AutoApprovedUrls]: {
			default: {
				'https://code.visualstudio.com': true,
				'https://github.com/microsoft/vscode/wiki/*': true,
			},
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.tools.fetchPage.approvedUrls', "控制在聊天工具请求时哪些 URL 会得到自动批准。键是 URL 模式，值可以是 `true` 以表示批准请求和响应，可以是 `false` 以表示拒绝，还可以是包含 `approveRequest` 和 `approveResponse` 属性的对象，以用于进行细粒度控制。\r\n\r\n示例:\r\n- `\"https://example.com\": true` - 批准对 example.com 的所有请求\r\n- `\"https://*.example.com\": true` - 批准对 example.com 任意子域的所有请求\r\n- `\"https://example.com/api/*\": { \"approveRequest\": true, \"approveResponse\": false }` - 批准对 example.com/api 路径的请求，但不批准响应"),
			type: 'object',
			additionalProperties: {
				oneOf: [
					{ type: 'boolean' },
					{
						type: 'object',
						properties: {
							approveRequest: { type: 'boolean' },
							approveResponse: { type: 'boolean' }
						}
					}
				]
			}
		},
		[ChatConfiguration.EligibleForAutoApproval]: {
			default: {},
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.tools.eligibleForAutoApproval', "控制哪些工具有资格获得自动批准。设置为 `false` 的工具将始终提出确认，且从不提供自动批准选项。默认行为(或将工具设置为 `true`)可能使工具提供自动批准选项。"),
			type: 'object',
			propertyNames: {
				enum: toolReferenceNameEnumValues,
				enumDescriptions: toolReferenceNameEnumDescriptions,
			},
			additionalProperties: {
				type: 'boolean',
			},
			examples: [
				{
					'fetch': false,
					'runTask': false
				}
			],
			policy: {
				name: 'ChatToolsEligibleForAutoApproval',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.107',
				localization: {
					description: {
						key: 'chat.tools.eligibleForAutoApproval',
						// allow-any-unicode-next-line
						value: nls.localize('chat.tools.eligibleForAutoApproval', "控制哪些工具有资格获得自动批准。设置为 `false` 的工具将始终提出确认，且从不提供自动批准选项。默认行为(或将工具设置为 `true`)可能使工具提供自动批准选项。")
					}
				},
			}
		},
		[ChatConfiguration.ArtifactsEnabled]: {
			default: false,
			// allow-any-unicode-next-line
			description: nls.localize('chat.artifacts.enabled', "控制生成工件视图在聊天中是否可用。"),
			type: 'boolean',
			tags: ['experimental']
		},
		[ChatConfiguration.ArtifactsRulesByMimeType]: {
			default: {
				'image/*': { groupName: 'Screenshots', onlyShowGroup: true }
			},
			// allow-any-unicode-next-line
			description: nls.localize('chat.artifacts.rules.byMimeType', "按 MIME 类型从工具结果中提取工件的规则。将 MIME 类型模式(例如 \"image/*\")映射到组配置。"),
			type: 'object',
			additionalProperties: {
				type: 'object',
				properties: {
					// allow-any-unicode-next-line
					groupName: { type: 'string', description: nls.localize('chat.artifacts.rules.groupName', "工件组的显示名称。") },
					// allow-any-unicode-next-line
					onlyShowGroup: { type: 'boolean', description: nls.localize('chat.artifacts.rules.onlyShowGroup', "为 true 时，仅显示组标题而非单个项。") }
				},
				required: ['groupName']
			},
			tags: ['experimental']
		},
		[ChatConfiguration.ArtifactsRulesByFilePath]: {
			default: {
				'**/*plan*.md': { groupName: 'Plans' }
			},
			// allow-any-unicode-next-line
			description: nls.localize('chat.artifacts.rules.byFilePath', "按文件路径模式从写入的文件中提取工件的规则。将 glob 模式映射到组配置。"),
			type: 'object',
			additionalProperties: {
				type: 'object',
				properties: {
					// allow-any-unicode-next-line
					groupName: { type: 'string', description: nls.localize('chat.artifacts.rules.byFilePath.groupName', "工件组的显示名称。") },
					// allow-any-unicode-next-line
					onlyShowGroup: { type: 'boolean', description: nls.localize('chat.artifacts.rules.byFilePath.onlyShowGroup', "为 true 时，仅显示组标题而非单个项。") }
				},
				required: ['groupName']
			},
			tags: ['experimental']
		},
		[ChatConfiguration.ArtifactsRulesByMemoryFilePath]: {
			default: {
				'**/*plan*.md': { groupName: 'Plans' }
			},
			// allow-any-unicode-next-line
			description: nls.localize('chat.artifacts.rules.byMemoryFilePath', "通过内存文件路径模式从内存工具调用中提取工件的规则。将 glob 模式映射到组配置。"),
			type: 'object',
			additionalProperties: {
				type: 'object',
				properties: {
					// allow-any-unicode-next-line
					groupName: { type: 'string', description: nls.localize('chat.artifacts.rules.byMemoryFilePath.groupName', "工件组的显示名称。") },
					// allow-any-unicode-next-line
					onlyShowGroup: { type: 'boolean', description: nls.localize('chat.artifacts.rules.byMemoryFilePath.onlyShowGroup', "为 true 时，仅显示组标题而非单个项。") }
				},
				required: ['groupName']
			},
			tags: ['experimental']
		},
		'chat.undoRequests.restoreInput': {
			default: true,
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.undoRequests.restoreInput', "控制在发出撤消请求时是否应还原聊天的输入。输入将使用已还原请求的文本填充。"),
			type: 'boolean',
		},
		'chat.editRequests': {
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.editRequests', "启用在聊天中编辑请求。借助此操作，可以更改请求内容并将其重新提交到模型。"),
			type: 'string',
			enum: ['inline', 'hover', 'input', 'none'],
			default: 'inline',
		},
		[ChatConfiguration.PasteAsAttachmentThreshold]: {
			markdownDescription: nls.localize('chat.pasteAsAttachmentThreshold', "The number of characters a paste must exceed before it is added to the chat input as an attachment instead of being inserted inline. Set this to a very large number to always paste inline."),
			type: 'number',
			minimum: 0,
			default: 10000,
		},
		[ChatConfiguration.ChatViewSessionsEnabled]: {
			type: 'boolean',
			default: true,
			// allow-any-unicode-next-line
			description: nls.localize('chat.viewSessions.enabled', "当聊天为空时，显示聊天代理会话；如果聊天视图宽度足够，则显示在侧边。"),
			agentsWindow: { default: false },
		},
		[ChatConfiguration.ChatViewSessionsOrientation]: {
			type: 'string',
			enum: ['stacked', 'sideBySide'],
			enumDescriptions: [
				// allow-any-unicode-next-line
				nls.localize('chat.viewSessions.orientation.stacked', "除非已有聊天会话可见，否则聊天会话垂直堆叠显示在聊天输入框上方。"),
				// allow-any-unicode-next-line
				nls.localize('chat.viewSessions.orientation.sideBySide', "如果有足够空间，则并排显示聊天会话；否则，除非已有聊天会话可见，否则堆叠显示在聊天输入框上方。")
			],
			default: 'sideBySide',
			// allow-any-unicode-next-line
			description: nls.localize('chat.viewSessions.orientation', "控制聊天代理会话视图在与聊天并排显示时的方向。"),
		},
		[ChatConfiguration.ChatViewProgressBadgeEnabled]: {
			type: 'boolean',
			default: false,
			// allow-any-unicode-next-line
			description: nls.localize('chat.viewProgressBadge.enabled', "当在聊天视图中打开的智能体会话正在进行时，在该视图上显示进度徽章。"),
		},
		[ChatSessionArchiveActionWordingSettingId]: {
			type: 'string',
			enum: ['archive', 'done'],
			enumDescriptions: [
				nls.localize('chat.experimental.sessionArchiveActionWording.archive', "Use Archive, Archive All, Unarchive, and Unarchive All."),
				nls.localize('chat.experimental.sessionArchiveActionWording.done', "使用「标记为已完成」「全部标记为已完成」「恢复」「全部恢复」。"),
			],
			default: 'done',
			tags: ['experimental'],
			experiment: { mode: 'startup' },
			description: nls.localize('chat.experimental.sessionArchiveActionWording', "Controls the wording and icons used by actions that archive and unarchive chat sessions, as well as the label of the archived sessions section."),
		},
		[ChatConfiguration.AgentsHandoffTipMode]: {
			type: 'string',
			enum: ['hidden', 'default', 'custom'],
			enumDescriptions: [
				// allow-any-unicode-next-line
				nls.localize('chat.agentsHandoffTip.mode.hidden', "永不显示转接提示。"),
				// allow-any-unicode-next-line
				nls.localize('chat.agentsHandoffTip.mode.default', "显示包含默认说明的转接提示。"),
				// allow-any-unicode-next-line
				nls.localize('chat.agentsHandoffTip.mode.custom', "显示包含备用说明的转接提示。"),
			],
			default: 'hidden',
			tags: ['experimental'],
			experiment: { mode: 'startup' },
			// allow-any-unicode-next-line
			description: nls.localize('chat.agentsHandoffTip.mode', "控制聊天输入位置上方显示的提示，以在智能体窗口中继续符合条件的智能体会话。"),
		},
		[ChatConfiguration.BtwTipEnabled]: {
			type: 'boolean',
			default: false,
			tags: ['experimental'],
			experiment: { mode: 'startup' },
			markdownDescription: nls.localize('chat.btwTip.enabled', "Controls whether the Agents Window shows a tip about using `/btw` to ask side questions."),
		},
		[CodexPreferAgentHostEditorSettingId]: {
			type: 'boolean',
			markdownDescription: nls.localize('chat.editor.codex.preferAgentHost', "When enabled, Codex sessions opened from the regular workbench (sidebar chat) run inside the agent host process using the Codex App Server instead of the OpenAI extension. Only one Codex implementation surfaces per window. Requires `#chat.agentHost.codexAgent.enabled#`."),
			default: product.quality !== 'stable',
			tags: ['experimental'],
			experiment: { mode: 'startup' },
		},
		[ChatConfiguration.ChatContextUsageEnabled]: {
			type: 'boolean',
			default: true,
			// allow-any-unicode-next-line
			description: nls.localize('chat.contextUsage.enabled', "在聊天输入中显示上下文窗口使用情况指示器。"),
		},
		[ChatConfiguration.Verbose]: {
			type: 'boolean',
			default: true,
			description: nls.localize('chat.verbose', "Show request and completion timestamps. Hover over a completion timestamp to show the elapsed response time."),
		},
		[ChatConfiguration.ProgressBorder]: {
			type: 'boolean',
			default: true,
			markdownDescription: nls.localize('chat.progressBorder.enabled', "Show an animated gradient border around the chat input while the agent is working or thinking. Has no effect when reduced motion is enabled."),
		},
		...chatProgressConfigurationProperties,
		[ChatConfiguration.SessionStateIndicatorEnabled]: {
			type: 'boolean',
			default: false,
			markdownDescription: nls.localize('chat.experimental.sessionStateIndicator.enabled', "Enable state indicators around chat editor sessions that are in progress, need input, or have an unvisited completion. Customize the borders with `chat.sessionStateIndicator.inProgressBorder`, `chat.sessionStateIndicator.needsInputBorder`, and `chat.sessionStateIndicator.unvisitedBorder` in `#workbench.colorCustomizations#`."),
			tags: ['experimental'],
		},
		[ChatConfiguration.NotifyWindowOnResponseReceived]: {
			type: 'string',
			enum: ['off', 'windowNotFocused', 'always'],
			enumDescriptions: [
				// allow-any-unicode-next-line
				nls.localize('chat.notifyWindowOnResponseReceived.off', "从不显示用于响应的操作系统通知。"),
				// allow-any-unicode-next-line
				nls.localize('chat.notifyWindowOnResponseReceived.windowNotFocused', "当未聚焦窗口时，显示操作系统通知以进行响应。"),
				// allow-any-unicode-next-line
				nls.localize('chat.notifyWindowOnResponseReceived.always', "始终显示响应的操作系统通知，即使窗口处于焦点。"),
			],
			default: 'windowNotFocused',
			// allow-any-unicode-next-line
			description: nls.localize('chat.notifyWindowOnResponseReceived', "控制在接收到响应时，聊天会话是否应向用户呈现操作系统通知。这包括窗口徽章和通知横幅。"),
		},
		'chat.checkpoints.enabled': {
			type: 'boolean',
			default: true,
			// allow-any-unicode-next-line
			description: nls.localize('chat.checkpoints.enabled', "在聊天中启用检查点。使用检查点可以将聊天还原到以前的状态。"),
		},
		'chat.checkpoints.showFileChanges': {
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.checkpoints.showFileChanges', "控制是否显示聊天检查点文件更改。"),
			default: false
		},
		[mcpAccessConfig]: {
			type: 'string',
			// allow-any-unicode-next-line
			description: nls.localize('chat.mcp.access', "控制对已安装的模型上下文协议服务器的访问。"),
			enum: [
				McpAccessValue.None,
				McpAccessValue.Registry,
				McpAccessValue.All
			],
			enumDescriptions: [
				// allow-any-unicode-next-line
				nls.localize('chat.mcp.access.none', "无法访问 MCP 服务器。"),
				// allow-any-unicode-next-line
				nls.localize('chat.mcp.access.registry', "允许访问 Olympia 连接到的注册表中安装的 MCP 服务器。"),
				// allow-any-unicode-next-line
				nls.localize('chat.mcp.access.any', "允许访问任何已安装的 MCP 服务器。")
			],
			default: McpAccessValue.All,
			policy: {
				name: 'ChatMCP',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.99',
				value: (policyData) => {
					if (policyData.mcp === false) {
						return McpAccessValue.None;
					}
					if (policyData.mcpAccess === 'registry_only') {
						return McpAccessValue.Registry;
					}
					return undefined;
				},
				localization: {
					description: {
						key: 'chat.mcp.access',
						// allow-any-unicode-next-line
						value: nls.localize('chat.mcp.access', "控制对已安装的模型上下文协议服务器的访问。")
					},
					enumDescriptions: [
						{
							// allow-any-unicode-next-line
							key: 'chat.mcp.access.none', value: nls.localize('chat.mcp.access.none', "无法访问 MCP 服务器。"),
						},
						{
							// allow-any-unicode-next-line
							key: 'chat.mcp.access.registry', value: nls.localize('chat.mcp.access.registry', "允许访问 Olympia 连接到的注册表中安装的 MCP 服务器。"),
						},
						{
							// allow-any-unicode-next-line
							key: 'chat.mcp.access.any', value: nls.localize('chat.mcp.access.any', "允许访问任何已安装的 MCP 服务器。")
						}
					]
				},
			}
		},
		[mcpAllowedServersConfig]: {
			type: ['array', 'null'],
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					serverName: { type: 'string', minLength: 1, description: nls.localize('chat.mcp.allowedServers.serverName', "Match a server by its configured name.") },
					serverUrl: { type: 'string', minLength: 1, description: nls.localize('chat.mcp.allowedServers.serverUrl', "Match a remote server by its URL. Supports `*` wildcards, for example `https://*.example.com/*`.") },
					serverCommand: { type: 'array', minItems: 1, items: { type: 'string' }, description: nls.localize('chat.mcp.allowedServers.serverCommand', "Match a local server by its exact command invocation, given as the command followed by its arguments.") },
				},
				oneOf: [
					{ required: ['serverName'] },
					{ required: ['serverUrl'] },
					{ required: ['serverCommand'] },
				],
			},
			markdownDescription: nls.localize('chat.mcp.allowedServers', "Enterprise-managed allowlist that controls which Model Context Protocol servers may be installed and run. When set, only servers matching an entry are permitted; any other server is blocked. Servers can be matched by name, remote URL pattern (with `*` wildcards), or local command invocation. Omit entirely to allow all servers (subject to the deny list). Delivered via enterprise policy for governance; this setting is not surfaced to end users."),
			default: null,
			scope: ConfigurationScope.APPLICATION,
			// Governance-only: delivered via the `ChatAllowedMcpServers` enterprise policy and hidden
			// from the Settings UI so it is not configurable by end users.
			included: false,
			policy: {
				name: 'ChatAllowedMcpServers',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.130',
				value: managedSettingValue(COPILOT_ALLOWED_MCP_SERVERS_KEY),
				managedSettings: {
					[COPILOT_ALLOWED_MCP_SERVERS_KEY]: { type: 'string' },
				},
				localization: {
					description: {
						key: 'chat.mcp.allowedServers.policy',
						value: nls.localize('chat.mcp.allowedServers.policy', "Allowlist of Model Context Protocol servers. When set, only servers matching an entry may be installed or run; omit entirely to allow all servers (subject to the deny list).")
					}
				},
			}
		},
		[mcpDeniedServersConfig]: {
			type: ['array', 'null'],
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					serverName: { type: 'string', minLength: 1, description: nls.localize('chat.mcp.deniedServers.serverName', "Match a server by its configured name.") },
					serverUrl: { type: 'string', minLength: 1, description: nls.localize('chat.mcp.deniedServers.serverUrl', "Match a remote server by its URL. Supports `*` wildcards, for example `https://*.example.com/*`.") },
					serverCommand: { type: 'array', minItems: 1, items: { type: 'string' }, description: nls.localize('chat.mcp.deniedServers.serverCommand', "Match a local server by its exact command invocation, given as the command followed by its arguments.") },
				},
				oneOf: [
					{ required: ['serverName'] },
					{ required: ['serverUrl'] },
					{ required: ['serverCommand'] },
				],
			},
			markdownDescription: nls.localize('chat.mcp.deniedServers', "Enterprise-managed denylist of Model Context Protocol servers. Servers matching any entry are unconditionally blocked from being installed or run, even if they also match the allow list — deny rules always take precedence. Servers can be matched by name, remote URL pattern (with `*` wildcards), or local command invocation. Delivered via enterprise policy for governance; this setting is not surfaced to end users."),
			default: null,
			scope: ConfigurationScope.APPLICATION,
			// Governance-only: delivered via the `ChatDeniedMcpServers` enterprise policy and hidden
			// from the Settings UI so it is not configurable by end users.
			included: false,
			policy: {
				name: 'ChatDeniedMcpServers',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.130',
				value: managedSettingValue(COPILOT_DENIED_MCP_SERVERS_KEY),
				managedSettings: {
					[COPILOT_DENIED_MCP_SERVERS_KEY]: { type: 'string' },
				},
				localization: {
					description: {
						key: 'chat.mcp.deniedServers.policy',
						value: nls.localize('chat.mcp.deniedServers.policy', "Denylist of Model Context Protocol servers. Servers matching any entry are blocked from being installed or run, even if they also match the allow list; deny rules always take precedence.")
					}
				},
			}
		},
		[COPILOT_ALLOW_MANAGED_MCP_SERVERS_ONLY_CONFIG]: {
			type: 'boolean',
			default: false,
			scope: ConfigurationScope.APPLICATION,
			included: false,
			description: nls.localize('chat.mcp.allowManagedServersOnly', "Use only the enterprise-managed MCP allowlist when deciding which servers may run."),
			policy: {
				name: 'ChatAllowManagedMcpServersOnly',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.132',
				value: managedSettingValue(COPILOT_ALLOW_MANAGED_MCP_SERVERS_ONLY_KEY),
				managedSettings: {
					[COPILOT_ALLOW_MANAGED_MCP_SERVERS_ONLY_KEY]: { type: 'boolean' },
				},
				localization: {
					description: {
						key: 'chat.mcp.allowManagedServersOnly.policy',
						value: nls.localize('chat.mcp.allowManagedServersOnly.policy', "Use only the enterprise-managed MCP allowlist when deciding which servers may run.")
					}
				},
			}
		},
		[mcpAutoStartConfig]: {
			type: 'string',
			// allow-any-unicode-next-line
			description: nls.localize('chat.mcp.autostart', "控制在提交聊天消息时是否应自动启动 MCP 服务器。"),
			default: McpAutoStartValue.NewAndOutdated,
			enum: [
				McpAutoStartValue.Never,
				McpAutoStartValue.OnlyNew,
				McpAutoStartValue.NewAndOutdated
			],
			enumDescriptions: [
				// allow-any-unicode-next-line
				nls.localize('chat.mcp.autostart.never', "绝不要自动启动 MCP 服务器。"),
				// allow-any-unicode-next-line
				nls.localize('chat.mcp.autostart.onlyNew', "仅自动启动从未运行过的新 MCP 服务器。"),
				// allow-any-unicode-next-line
				nls.localize('chat.mcp.autostart.newAndOutdated', "自动启动尚未运行的新的和过时的 MCP 服务器。")
			],
			tags: ['experimental'],
		},
		[mcpAppsEnabledConfig]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.mcp.ui.enabled', "控制 MCP 服务器是否可以为工具调用提供自定义 UI。"),
			default: true,
			tags: ['experimental'],
		},
		[mcpEnterpriseManagedAuthIdpSection]: {
			type: 'object',
			default: {},
			scope: ConfigurationScope.APPLICATION,
			tags: ['preview', 'experimental'],
			additionalProperties: false,
			included: false,
			properties: {
				issuer: {
					type: 'string',
					format: 'uri',
					// allow-any-unicode-next-line
					markdownDescription: nls.localize('mcp.enterpriseManagedAuth.idp.issuer', "SSO 授权服务器的 OAuth/OIDC 证书颁发者 URL。必须是 `https://` URL。"),
				},
				clientId: {
					type: 'string',
					// allow-any-unicode-next-line
					markdownDescription: nls.localize('mcp.enterpriseManagedAuth.idp.clientId', "向此设备的 SSO 证书颁发者注册的 OAuth 客户端 ID。"),
				},
				clientSecret: {
					type: 'string',
					// allow-any-unicode-next-line
					markdownDescription: nls.localize('mcp.enterpriseManagedAuth.idp.clientSecret', "与 `clientId` 配对的 OAuth 客户端密码。仅用于本地开发。"),
				},
			},
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('mcp.enterpriseManagedAuth.idp', "(预览)用于企业管理的模型上下文协议(MCP)服务器的 OAuth/OIDC IdP 配置。通常通过企业策略(Windows 组策略/macOS 托管首选项/Linux `/etc/vscode/policy.json`)提供；开发人员可以手动编辑 `settings.json` 以进行本地测试。属性: `issuer` (HTTPS URL)、`clientId`、`clientSecret`。"),
			policy: {
				name: 'McpEnterpriseManagedAuthIdp',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.122',
				localization: {
					description: {
						key: 'mcp.enterpriseManagedAuth.idp.policy',
						// allow-any-unicode-next-line
						value: nls.localize('mcp.enterpriseManagedAuth.idp.policy', "用于企业管理的模型上下文协议(MCP)服务器身份验证的 OAuth/OIDC IdP 配置。"),
					}
				}
			},
		},
		[mcpServerCollisionBehaviorSection]: {
			type: 'string',
			// allow-any-unicode-next-line
			description: nls.localize('chat.mcp.collisionBehavior', "控制发现多个同名 MCP 服务器时的行为。\"disable\" 禁用低优先级重复项。\"suffix\" 追加数字后缀以区分。"),
			enum: [
				McpCollisionBehavior.Disable,
				McpCollisionBehavior.Suffix,
			],
			enumDescriptions: [
				// allow-any-unicode-next-line
				nls.localize('chat.mcp.collisionBehavior.disable', "禁用名称重复的低优先级服务器。"),
				// allow-any-unicode-next-line
				nls.localize('chat.mcp.collisionBehavior.suffix', "为名称重复的服务器追加数字后缀。"),
			],
			default: McpCollisionBehavior.Disable,
		},
		[mcpServerSamplingSection]: {
			type: 'object',
			// allow-any-unicode-next-line
			description: nls.localize('chat.mcp.serverSampling', "配置向 MCP 服务器公开哪些模型以进行采样(在后台发出模型请求)。可以在“{0}”命令下以图形方式编辑此设置。", 'MCP: ' + nls.localize('mcp.list', "列出服务器")),
			scope: ConfigurationScope.RESOURCE,
			additionalProperties: {
				type: 'object',
				properties: {
					allowedDuringChat: {
						type: 'boolean',
						// allow-any-unicode-next-line
						description: nls.localize('chat.mcp.serverSampling.allowedDuringChat', "是否允许此服务器在聊天会话中的工具调用期间发出采样请求。"),
						default: true,
					},
					allowedOutsideChat: {
						type: 'boolean',
						// allow-any-unicode-next-line
						description: nls.localize('chat.mcp.serverSampling.allowedOutsideChat', "是否允许此服务器在聊天会话之外发出采样请求。"),
						default: false,
					},
					allowedModels: {
						type: 'array',
						items: {
							type: 'string',
							// allow-any-unicode-next-line
							description: nls.localize('chat.mcp.serverSampling.model', "MCP 服务器有权访问的模型。"),
						},
					}
				}
			},
		},
		[AssistedTypes[AddConfigurationType.NuGetPackage].enabledConfigKey]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.mcp.assisted.nuget.enabled.description', "为 AI 辅助的 MCP 服务器安装启用 NuGet 包。对于 .NET 包(NuGet.org)，用于按中央注册表中的名称安装 MCP 服务器。"),
			default: false,
			tags: ['experimental'],
			experiment: {
				mode: 'startup'
			}
		},
		[ChatConfiguration.ExtensionToolsEnabled]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.extensionToolsEnabled', "使用由第三方扩展提供的工具启用。"),
			default: true,
			policy: {
				name: 'ChatAgentExtensionTools',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.99',
				localization: {
					description: {
						key: 'chat.extensionToolsEnabled',
						// allow-any-unicode-next-line
						value: nls.localize('chat.extensionToolsEnabled', "使用由第三方扩展提供的工具启用。")
					}
				},
			}
		},
		[ChatConfiguration.PluginsEnabled]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.plugins.enabled', "在聊天中启用智能体插件集成。"),
			default: true,
			policy: {
				name: 'ChatPluginsEnabled',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.116',
				localization: {
					description: {
						key: 'chat.plugins.enabled',
						// allow-any-unicode-next-line
						value: nls.localize('chat.plugins.enabled', "在聊天中启用智能体插件集成。"),
					}
				},
			},
		},
		[ChatConfiguration.PluginLocations]: {
			type: 'object',
			additionalProperties: { type: 'boolean' },
			restricted: true,
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.pluginLocations', "要发现的插件目录。每个键都是直接指向插件文件夹的路径，值为 `true` 表示启用，`false` 表示禁用。路径可以是绝对路径、相对于工作区根目录的路径，或以 `~/` 开头的用户主目录路径。"),
			scope: ConfigurationScope.MACHINE,
			tags: ['experimental'],
		},
		[ChatConfiguration.EnabledPlugins]: {
			type: 'object',
			additionalProperties: { type: 'boolean' },
			markdownDescription: nls.localize('chat.plugins.enabledPlugins', "Controls which [agent plugins](https://aka.ms/vscode-agent-plugins) are enabled or disabled. Keys are plugin IDs in `<plugin>@<marketplace>` form (where marketplace is defined in {1}); values enable (`true`) or disable (`false`) the plugin. Discovered alongside the path-keyed entries in {0}. When set by policy, entries are additive: plugins mapped to `true` are enabled in addition to the user's own plugins, and only plugins mapped to `false` are blocked from loading.", `\`#${ChatConfiguration.PluginLocations}#\``, `\`#${ChatConfiguration.PluginMarketplaces}#\``),
			scope: ConfigurationScope.APPLICATION,
			policy: {
				name: 'ChatEnabledPlugins',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.122',
				value: managedSettingValue(COPILOT_ENABLED_PLUGINS_KEY),
				managedSettings: {
					[COPILOT_ENABLED_PLUGINS_KEY]: { type: 'string' },
				},
				localization: {
					description: {
						key: 'chat.plugins.enabledPlugins.policy',
						// allow-any-unicode-next-line
						value: nls.localize('chat.plugins.enabledPlugins.policy', "插件启用。键是 `{plugin}@{marketplace}` 形式的插件 ID；值用于启用或禁用插件。"),
					}
				},
			},
		},
		[ChatConfiguration.PluginMarketplaces]: {
			type: 'array',
			items: {
				type: 'string',
			},
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.plugins.marketplaces', "要查询的插件市场。条目可以是 GitHub 速记(`owner/repo` 或 `owner/repo#ref`)、直接 Git 存储库 URI (`https://...git`、`ssh://...git` 或 `git@host:path.git`，可以选择为每项附加后缀 `#ref`)，也可以是本地存储库 URI (`file:///...`)。等效的 GitHub 速记和 URI 条目会被去重。"),
			default: [DEFAULT_PLUGIN_MARKETPLACE],
			scope: ConfigurationScope.APPLICATION,
			tags: ['experimental'],
		},
		[ChatConfiguration.ExtraMarketplaces]: {
			// Policy-only delivery slot for enterprise-managed marketplace entries (via the
			// `ChatExtraMarketplaces` policy). Consumers union this with `chat.plugins.marketplaces`.
			//
			// Stored as a named string map. Explicit update overrides are JSON-encoded
			// inside the value string so the Settings Editor can use its inline object renderer.
			// This ensures:
			//   - The Settings Editor (ComplexObject renderer) can display entries inline when
			//     managed by policy, rather than only showing "Edit in settings.json".
			//   - Marketplace names are preserved for `enabledPlugins["plugin@<name>"]` resolution.
			//
			type: 'object',
			additionalProperties: { type: ['string'] as ['string'] },
			default: {},
			scope: ConfigurationScope.APPLICATION,
			included: false,
			markdownDescription: nls.localize('chat.plugins.extraMarketplaces', "Enterprise-managed additional plugin marketplaces. Unioned with {0}. An entry's `autoUpdate` value overrides {1} for plugins from that marketplace.", `\`#${ChatConfiguration.PluginMarketplaces}#\``, '`#extensions.autoUpdate#`'),
			policy: {
				name: 'ChatExtraMarketplaces',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.122',
				value: managedSettingValue(COPILOT_EXTRA_MARKETPLACES_KEY),
				managedSettings: {
					[COPILOT_EXTRA_MARKETPLACES_KEY]: { type: 'string' },
				},
				localization: {
					description: {
						key: 'chat.plugins.extraMarketplaces.policy',
						// allow-any-unicode-next-line
						value: nls.localize('chat.plugins.extraMarketplaces.policy', "要查询的其他插件市场。键是市场名称；值是 GitHub 速记(`owner/repo[#ref]`)或 Git URI (`{url}[#ref]`)。"),
					}
				},
			},
		},
		[ChatConfiguration.StrictMarketplaces]: {
			included: byokProductIneligible, // 本产品没有托管助手，这一条没有对应的东西可设
			type: ['array', 'null'],
			items: {
				type: 'object',
				properties: {
					source: {
						type: 'string',
						enum: ['github', 'git', 'url', 'npm', 'file', 'directory', 'hostPattern', 'pathPattern'],
					},
					repo: { type: 'string' },
					url: { type: 'string' },
					ref: { type: 'string' },
					path: { type: 'string' },
					package: { type: 'string' },
					hostPattern: { type: 'string' },
					pathPattern: { type: 'string' },
					headers: { type: 'object', additionalProperties: { type: 'string' } },
				},
				required: ['source'],
			},
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.plugins.strictMarketplaces', "企业管理的插件市场源允许列表。设置后，只能安装与这些条目之一匹配的市场；空数组会阻止所有市场。这不会以追溯方式禁用已安装的插件。每个条目都是一个对象，具有 `source` 鉴别器(`github`、`git`、`url`、`npm`、`file`、`directory`、`hostPattern` 或 `pathPattern`)以及相应的字段。通常通过企业策略提供。"),
			default: null,
			restricted: true,
			scope: ConfigurationScope.APPLICATION,
			tags: ['experimental'],
			policy: {
				name: 'ChatStrictMarketplaces',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.122',
				value: managedSettingValue(COPILOT_STRICT_MARKETPLACES_KEY),
				managedSettings: {
					[COPILOT_STRICT_MARKETPLACES_KEY]: { type: 'string' },
				},
				localization: {
					description: {
						key: 'chat.plugins.strictMarketplaces.policy',
						// allow-any-unicode-next-line
						value: nls.localize('chat.plugins.strictMarketplaces.policy', "插件市场源的允许列表。设置后，仅信任与条目匹配的市场；空数组会阻止所有市场。"),
					}
				},
			},
		},
		[COPILOT_STRICT_PLUGIN_ONLY_CUSTOMIZATION_CONFIG]: {
			type: 'boolean',
			default: false,
			scope: ConfigurationScope.APPLICATION,
			included: false,
			description: nls.localize('chat.customizations.strictPluginOnlyCustomization', "Blocks standalone user and workspace skills, agents, hooks, instructions, and MCP servers while keeping eligible plugin customizations available."),
			policy: {
				name: 'ChatStrictPluginOnlyCustomization',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.132',
				value: managedSettingValue(COPILOT_STRICT_PLUGIN_ONLY_CUSTOMIZATION_KEY),
				managedSettings: {
					[COPILOT_STRICT_PLUGIN_ONLY_CUSTOMIZATION_KEY]: { type: 'boolean' },
				},
				localization: {
					description: {
						key: 'chat.customizations.strictPluginOnlyCustomization.policy',
						value: nls.localize('chat.customizations.strictPluginOnlyCustomization.policy', "Blocks standalone user and workspace skills, agents, hooks, instructions, and MCP servers while keeping eligible plugin customizations available.")
					}
				},
			}
		},
		[COPILOT_ALLOW_MANAGED_HOOKS_ONLY_CONFIG]: {
			type: 'boolean',
			default: false,
			scope: ConfigurationScope.APPLICATION,
			included: false,
			description: nls.localize('chat.hooks.allowManagedOnly', "Allows hooks only from enterprise-managed sources and plugins force-enabled by policy."),
			policy: {
				name: 'ChatAllowManagedHooksOnly',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.132',
				value: managedSettingValue(COPILOT_ALLOW_MANAGED_HOOKS_ONLY_KEY),
				managedSettings: {
					[COPILOT_ALLOW_MANAGED_HOOKS_ONLY_KEY]: { type: 'boolean' },
				},
				localization: {
					description: {
						key: 'chat.hooks.allowManagedOnly.policy',
						value: nls.localize('chat.hooks.allowManagedOnly.policy', "Allows hooks only from enterprise-managed sources and plugins force-enabled by policy.")
					}
				},
			}
		},
		[ChatConfiguration.AgentEnabled]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.agent.enabled.description', "启用后，可以从聊天中激活智能体模式，并且可以使用智能体上下文中带有副作用的工具。"),
			default: true,
			order: 1,
			policy: {
				name: 'ChatAgentMode',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.99',
				value: (policyData) => policyData.chat_agent_enabled === false ? false : undefined,
				localization: {
					description: {
						key: 'chat.agent.enabled.description',
						// allow-any-unicode-next-line
						value: nls.localize('chat.agent.enabled.description', "启用后，可以从聊天中激活智能体模式，并且可以使用智能体上下文中带有副作用的工具。"),
					}
				}
			}
		},
		[AgentNetworkDomainSettingId.NetworkFilter]: {
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.agent.networkFilter', "启用后，智能体工具(提取工具、集成浏览器)的网络访问将根据 {0} 和 {1} 进行限制。启用 {2} 时，域筛选也会应用于这些工具。", `\`#${AgentNetworkDomainSettingId.AllowedNetworkDomains}#\``, `\`#${AgentNetworkDomainSettingId.DeniedNetworkDomains}#\``, `\`#${AgentSandboxSettingId.AgentSandboxEnabled}#\``),
			type: 'boolean',
			default: false,
			scope: ConfigurationScope.APPLICATION,
			restricted: true,
			policy: {
				name: 'ChatAgentNetworkFilter',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.116',
				localization: {
					description: {
						key: 'chat.agent.networkFilter',
						// allow-any-unicode-next-line
						value: nls.localize('chat.agent.networkFilter', "启用后，智能体工具(提取工具、集成浏览器)的网络访问将根据 {0} 和 {1} 进行限制。启用 {2} 时，域筛选也会应用于这些工具。", `\`#${AgentNetworkDomainSettingId.AllowedNetworkDomains}#\``, `\`#${AgentNetworkDomainSettingId.DeniedNetworkDomains}#\``, `\`#${AgentSandboxSettingId.AgentSandboxEnabled}#\``),
					}
				}
			}
		},
		[AgentNetworkDomainSettingId.AllowedNetworkDomains]: {
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.agent.allowedNetworkDomains', "智能体工具(提取工具、集成浏览器)允许进行网络访问的域。在启用 {0} 或 {1} 时应用。当 {2} 启用时，允许所有域。支持 {3} 等通配符。允许列表和拒绝列表均为空时，所有域均被阻止。拒绝的域(请参阅{4})优先。", `\`#${AgentNetworkDomainSettingId.NetworkFilter}#\``, `\`#${AgentSandboxSettingId.AgentSandboxEnabled}#\``, `\`#${AgentSandboxSettingId.AgentSandboxAllowNetwork}#\``, '`*.example.com`', `\`#${AgentNetworkDomainSettingId.DeniedNetworkDomains}#\``),
			type: 'array',
			items: { type: 'string' },
			default: [],
			scope: ConfigurationScope.APPLICATION,
			restricted: true,
			policy: {
				name: 'ChatAgentAllowedNetworkDomains',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.116',
				localization: {
					description: {
						key: 'chat.agent.allowedNetworkDomains',
						// allow-any-unicode-next-line
						value: nls.localize('chat.agent.allowedNetworkDomains', "智能体工具(提取工具、集成浏览器)允许进行网络访问的域。在启用 {0} 或 {1} 时应用。当 {2} 启用时，允许所有域。支持 {3} 等通配符。允许列表和拒绝列表均为空时，所有域均被阻止。拒绝的域(请参阅{4})优先。", `\`#${AgentNetworkDomainSettingId.NetworkFilter}#\``, `\`#${AgentSandboxSettingId.AgentSandboxEnabled}#\``, `\`#${AgentSandboxSettingId.AgentSandboxAllowNetwork}#\``, '`*.example.com`', `\`#${AgentNetworkDomainSettingId.DeniedNetworkDomains}#\``),
					}
				}
			}
		},
		[AgentNetworkDomainSettingId.DeniedNetworkDomains]: {
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.agent.deniedNetworkDomains', "智能体工具(提取工具、集成浏览器)拒绝进行网络访问的域。在启用 {0} 或 {1} 时应用。当 {2} 启用时不适用。优先于 {3}。支持 {4} 等通配符。", `\`#${AgentNetworkDomainSettingId.NetworkFilter}#\``, `\`#${AgentSandboxSettingId.AgentSandboxEnabled}#\``, `\`#${AgentSandboxSettingId.AgentSandboxAllowNetwork}#\``, `\`#${AgentNetworkDomainSettingId.AllowedNetworkDomains}#\``, '`*.example.com`'),
			type: 'array',
			items: { type: 'string' },
			default: [],
			scope: ConfigurationScope.APPLICATION,
			restricted: true,
			policy: {
				name: 'ChatAgentDeniedNetworkDomains',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.116',
				localization: {
					description: {
						key: 'chat.agent.deniedNetworkDomains',
						// allow-any-unicode-next-line
						value: nls.localize('chat.agent.deniedNetworkDomains', "智能体工具(提取工具、集成浏览器)拒绝进行网络访问的域。在启用 {0} 或 {1} 时应用。当 {2} 启用时不适用。优先于 {3}。支持 {4} 等通配符。", `\`#${AgentNetworkDomainSettingId.NetworkFilter}#\``, `\`#${AgentSandboxSettingId.AgentSandboxEnabled}#\``, `\`#${AgentSandboxSettingId.AgentSandboxAllowNetwork}#\``, `\`#${AgentNetworkDomainSettingId.AllowedNetworkDomains}#\``, '`*.example.com`'),
					}
				}
			}
		},
		[ChatConfiguration.DefaultNewSessionMode]: {
			type: 'string',
			// allow-any-unicode-next-line
			description: nls.localize('chat.newSession.defaultMode', "新聊天会话的默认模式。若为空，则使用聊天视图的默认模式。"),
			// Olympia：BYOK 产品里没有智能体编排那套（也没有能驱动它的模型），新会话默认落在「提问」。
			// 同一个键在下面那个实验回调里还会被注册一次，两处都要保住这个默认值。
			default: product.defaultChatAgent?.byokOnly ? ChatModeKind.Ask : '',
		},
		[ChatConfiguration.AgentHostDebugLogsDefaultExportLocation]: {
			type: 'string',
			pattern: '^((\\/|\\\\\\\\|[a-zA-Z]:\\\\).*)?$',
			patternErrorMessage: nls.localize('chat.agentHost.debugLogs.defaultExportLocation.error', "The default Agent Host debug-log export location must be an absolute path (for example, C:\\\\myFolder or /myFolder)."),
			description: nls.localize('chat.agentHost.debugLogs.defaultExportLocation', "The default folder for archives and folders created by the Developer: Export Agent Host Debug Logs command. When empty or unavailable, the default file-dialog location is used."),
			default: '',
			scope: ConfigurationScope.APPLICATION,
			ignoreSync: true,
			tags: ['advanced'],
		},
		[AgentHostAhpJsonlLoggingSettingId]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.agentHost.ahpJsonlLogging', "启用时，将智能体主机连接的所有 AHP 传输消息记录到窗口日志目录下的 JSONL 文件中。"),
			default: product.quality !== 'stable',
			tags: ['experimental', 'advanced'],
		},
		[AgentHostAgentDebugLogEnabledSettingId]: {
			type: 'boolean',
			markdownDescription: nls.localize('chat.agentHost.agentDebugLog.enabled', "Enable agent debug logging for agent host sessions: surface their debug events in the agent debug panel. Takes effect immediately; only sessions that run while this is enabled are captured."),
			default: false,
			tags: ['experimental', 'advanced'],
			experiment: {
				mode: 'startup'
			},
		},
		[AgentHostAgentDebugLogMaxEventsSettingId]: {
			type: 'number',
			minimum: 10,
			markdownDescription: nls.localize('chat.agentHost.agentDebugLog.maxEventsInMemory', "Maximum number of debug events kept in memory per agent host session for the agent debug panel. Older events beyond this limit are dropped from the in-memory buffer, which also lowers the totals (such as token usage) shown in the panel overview."),
			default: 10000,
			tags: ['experimental', 'advanced'],
			experiment: {
				mode: 'startup'
			},
		},
		[AgentHostCustomTerminalToolEnabledSettingId]: {
			included: byokProductIneligible,
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.agentHost.customTerminalTool.enabled', "启用后，Copilot SDK 会话使用智能体主机终端工具替代，而非 SDK 的默认终端行为。"),
			default: false,
			tags: ['experimental', 'advanced'],
			policy: {
				name: 'ChatAgentHostCustomTerminalTool',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.137',
				value: managedSettingsDisabledValue,
				localization: {
					description: {
						key: 'chat.agentHost.customTerminalTool.enabled.policy',
						value: nls.localize('chat.agentHost.customTerminalTool.enabled.policy', "Enable the Agent Host custom terminal tool override for Copilot SDK sessions."),
					}
				}
			},
		},
		[AgentHostShellToolInitScriptEnabledSettingId]: {
			included: byokProductIneligible, // 本产品没有托管助手，这一条没有对应的东西可设
			type: 'boolean',
			markdownDescription: nls.localize('chat.agentHost.shellTool.initScript.enabled', "When enabled, Copilot SDK sessions load your shell profile (`~/.bashrc` on macOS and Linux, PowerShell profiles on Windows) and activate the Python environment selected for the workspace before each shell command. Python activation requires the Python Environments extension with `#python-envs.terminal.autoActivationType#` set to `shellStartup`. Local windows only."),
			default: false,
			tags: ['experimental', 'advanced'],
			scope: ConfigurationScope.APPLICATION,
		},
		[AgentHostCopilotSdkLogLevelSettingId]: {
			included: byokProductIneligible,
			type: 'string',
			enum: [...copilotSdkLogLevelSettingValues],
			enumDescriptions: [
				nls.localize('chat.agentHost.copilotSdk.logLevel.info', "Log informational messages. Running Olympia IDE with trace logging still enables all Copilot SDK runtime diagnostics."),
				nls.localize('chat.agentHost.copilotSdk.logLevel.trace', "Log all Copilot SDK runtime diagnostics."),
			],
			markdownDescription: nls.localize('chat.agentHost.copilotSdk.logLevel', "Controls the log level for the Copilot SDK runtime used by the local agent host. Changing this setting restarts the Copilot SDK client; active sessions are reloaded when next used."),
			default: 'info',
			scope: ConfigurationScope.APPLICATION,
			tags: ['experimental', 'advanced'],
		},
		[AgentHostCopilotRuntimePathSettingId]: {
			type: 'string',
			markdownDescription: nls.localize('chat.agentHost.copilot.runtimePath', "Absolute path to a local `copilot-runtime` executable. The bundled Copilot SDK wrapper remains in use. Empty uses the bundled runtime. Changing this setting restarts the Copilot SDK client after active turns finish."),
			default: '',
			scope: ConfigurationScope.APPLICATION,
			ignoreSync: true,
			tags: ['experimental', 'advanced'],
			included: false,
			agentHost: {
				key: CopilotCliConfigKey.RuntimePath,
				scope: AgentHostConfigurationSyncScope.Local,
			},
		},
		[CopilotClaudeAdvisorEnabledSettingId]: {
			included: byokProductIneligible, // 本产品没有托管助手，这一条没有对应的东西可设
			type: 'boolean',
			markdownDescription: nls.localize('chat.copilot.claudeAdvisor.enabled', "When enabled, Copilot Agent Host sessions using a supported Claude model can call the provider-native Advisor tool. Changing this setting restarts the Copilot SDK client after active turns finish."),
			default: false,
			tags: ['experimental', 'advanced'],
			scope: ConfigurationScope.APPLICATION,
		},
		[CopilotTgrepEnabledSettingId]: {
			included: byokProductIneligible, // 本产品没有托管助手，这一条没有对应的东西可设
			type: 'boolean',
			markdownDescription: nls.localize('chat.copilot.tgrep.enabled', "When enabled, local Copilot Agent Host sessions force-enable tgrep indexed search, bypassing the repository-size threshold. Requires a local Git repository on a non-virtual filesystem. Changing this setting restarts the Copilot SDK client after active turns finish."),
			default: false,
			experiment: { mode: 'auto' },
			tags: ['experimental', 'advanced'],
			scope: ConfigurationScope.APPLICATION,
		},
		[AgentHostMapLegacySettingsToManagedSettingsSettingId]: {
			included: byokProductIneligible, // 本产品没有托管助手，这一条没有对应的东西可设
			type: 'boolean',
			markdownDescription: nls.localize('chat.agentHost.copilot.mapLegacySettingsToManagedSettings', "When enabled, maps supported legacy Olympia IDE settings to equivalent Copilot SDK managed settings for local Agent Host sessions. Only restrictions are mapped, and only from globally-scoped values — workspace and folder values are ignored. Applies to local sessions using the Copilot agent; remote hosts and other agents are unaffected. This compatibility bridge is temporary and is not used for new settings."),
			default: false,
			scope: ConfigurationScope.APPLICATION_MACHINE,
			tags: ['experimental', 'advanced'],
		},
		[AgentHostOpus48PromptEnabledSettingId]: {
			included: byokProductIneligible,
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.agentHost.opus48Prompt.enabled', "启用此选项后，运行 Claude Opus 4.8 模型的 Copilot SDK 会话会在默认系统消息之上应用针对 Opus 4.8 调优的系统提示部分覆盖。"),
			default: false,
			tags: ['experimental', 'advanced'],
		},
		[AgentHostToolSearchEnabledSettingId]: {
			type: 'boolean',
			description: nls.localize('chat.agentHost.copilot.toolSearch.enabled', "When enabled, Copilot SDK sessions defer MCP and non-core Olympia IDE tools behind a tool-search tool so the model discovers them on demand instead of loading every tool definition up front."),
			default: true,
			tags: ['experimental', 'advanced'],
		},
		[AgentHostToolSearchDeferThresholdSettingId]: {
			type: 'number',
			description: nls.localize('chat.agentHost.copilot.toolSearch.deferThreshold', "Minimum number of tools before MCP and external tools are deferred behind tool search. Set to 0 to always defer external tools. Only effective when tool search is enabled."),
			default: 1,
			minimum: 0,
			tags: ['experimental', 'advanced'],
		},
		[CopilotSkillCharBudgetSettingId]: {
			type: 'number',
			description: nls.localize('chat.copilot.skillCharBudget', "Maximum number of characters available for skill descriptions in the Copilot SDK system message."),
			default: DEFAULT_COPILOT_SKILL_CHAR_BUDGET,
			minimum: 1,
			// 这条只往智能体主机的 Copilot SDK 会话里同步；BYOK 产品跑不出那种会话，
			// 留在设置页就是一个没人能用的英文数字框。
			included: !product.defaultChatAgent?.byokOnly,
			experiment: { mode: 'startup' },
			scope: ConfigurationScope.APPLICATION,
			tags: ['experimental', 'advanced'],
			agentHost: {
				key: CopilotCliConfigKey.SkillCharBudget,
				transform: value => normalizeSkillCharBudget(typeof value === 'number' ? value : undefined),
				scope: AgentHostConfigurationSyncScope.Local,
			},
		},
		[CopilotSemanticSearchEnabledSettingId]: {
			included: byokProductIneligible,
			type: 'boolean',
			description: nls.localize('chat.copilot.semanticSearch.enabled', "Controls whether Copilot Agent Host sessions can use Olympia IDE's semantic workspace search. When disabled, semantic search is unavailable."),
			default: false,
			experiment: { mode: 'auto' },
			tags: ['experimental', 'advanced'],
		},
		[AgentHostHydraFusionEnabledSettingId]: {
			included: byokProductIneligible, // 本产品没有托管助手，这一条没有对应的东西可设
			type: 'boolean',
			markdownDescription: nls.localize('chat.copilot.hydraFusion.enabled', "When enabled, makes the experimental HydraFusion model available to local Copilot Agent Host sessions. Changing this setting restarts the local Copilot runtime."),
			default: true,
			experiment: { mode: 'startup' },
			scope: ConfigurationScope.APPLICATION_MACHINE,
			tags: ['preview', 'experimental', 'advanced'],
		},
		[CopilotAutoModeTierOverrideSettingId]: {
			included: byokProductIneligible, // 本产品没有托管助手，这一条没有对应的东西可设
			type: ['string', 'null'],
			markdownDescription: nls.localize('chat.copilot.autoModeTierOverride', "Override Auto's \"Optimize for\" preference for evals and debugging. Accepts `efficiency`, `balance`, or `intelligence` in both Copilot Chat and Copilot SDK sessions; `fast` is extension-only. Set to `null` to clear."),
			default: null,
			tags: ['advanced'],
		},
		[AgentHostCopilotModelCapabilityOverridesSettingId]: {
			included: byokProductIneligible, // 本产品没有托管助手，这一条没有对应的东西可设
			type: 'object',
			markdownDescription: nls.localize('chat.agentHost.copilot.modelCapabilityOverrides', "Per-model overrides for Copilot Agent Host sessions. Use `*` to match every model. Supports model family, reasoning effort, tool filters, model capabilities, and YAML prompt overrides."),
			additionalProperties: {
				type: 'object',
				properties: {
					family: {
						type: 'string',
						description: nls.localize('chat.agentHost.copilot.modelCapabilityOverrides.family', "Route the model to another family's tuned system prompt and tool profile (e.g. `claude-opus-4.8`). The model id sent to the runtime is unaffected, so the session still runs on the selected model."),
					},
					reasoningEffort: {
						type: 'string',
						enum: [...reasoningEffortLevels],
						description: nls.localize('chat.agentHost.copilot.modelCapabilityOverrides.reasoningEffort', "Reasoning effort for sessions on this model, overriding the model picker's thinking level. Use the `*` entry to set it for every model. Unrecognized values are ignored."),
					},
					availableTools: {
						type: 'array',
						items: { type: 'string' },
						description: nls.localize('chat.agentHost.copilot.modelCapabilityOverrides.availableTools', "When set, only matching tools are available to sessions on this model. Patterns: bare tool names, `builtin:*` or `builtin:<name>` (Copilot runtime tools), `mcp:*` or `mcp:<name>` (MCP server tools), and `custom:*` or `custom:<name>` (every tool Olympia IDE registers with the SDK, including the agent host's own terminal tools); a bare `*` expands to all three sources."),
					},
					excludedTools: {
						type: 'array',
						items: { type: 'string' },
						description: nls.localize('chat.agentHost.copilot.modelCapabilityOverrides.excludedTools', "Tools disabled for sessions on this model; same pattern syntax as `availableTools` and takes precedence over it. Note that `custom:*` and a bare `*` also disable the agent host's own terminal tools registered with the SDK."),
					},
					modelCapabilities: {
						type: 'object',
						additionalProperties: true,
						description: nls.localize('chat.agentHost.copilot.modelCapabilityOverrides.modelCapabilities', "Per-property model capability overrides passed through to the Copilot SDK's `modelCapabilities` session field (e.g. `{ \"supports\": { \"vision\": false }, \"limits\": { \"max_context_window_tokens\": 64000 } }`), deep-merged over the runtime's resolved defaults for this model. Applied when the session launches or resumes."),
					},
					promptOverrideString: {
						type: 'string',
						description: nls.localize('chat.agentHost.copilot.modelCapabilityOverrides.promptOverrideString', "Inline YAML containing `systemPrompt` and/or `toolDescriptions` overrides. Takes precedence over `promptOverrideFile`. A system prompt replaces all Agent Host and SDK prompt sections and guardrails."),
					},
					promptOverrideFile: {
						type: 'string',
						description: nls.localize('chat.agentHost.copilot.modelCapabilityOverrides.promptOverrideFile', "Path to a YAML file containing `systemPrompt` and/or `toolDescriptions` overrides. Ignored when `promptOverrideString` is configured."),
					},
				},
			},
			default: {},
			scope: ConfigurationScope.APPLICATION,
			tags: ['experimental', 'advanced'],
		},
		[AgentHostAllowSignedOutWhenUsableSettingId]: {
			included: byokProductIneligible, // 本产品没有托管助手，这一条没有对应的东西可设
			type: 'boolean',
			markdownDescription: nls.localize('chat.agentHost.allowSignedOutWhenUsable', "When enabled, Agent Host sessions remain available while signed out. The Agents window opens without forcing GitHub sign-in, and editor chat lets you select the Copilot harness. Agents usable without GitHub (for example Codex with ChatGPT authentication or Claude in native mode with your own Anthropic credentials) work while signed out; agents that require GitHub prompt you to add a model or sign in. When disabled (the default), GitHub sign-in is required before the Agents window opens."),
			default: false,
			scope: ConfigurationScope.APPLICATION,
			tags: ['experimental', 'advanced'],
			experiment: { mode: 'startup' }
		},
		[ChatMicrosoftAuthenticationEnabledSettingId]: {
			type: 'boolean',
			markdownDescription: nls.localize('chat.microsoftAuthentication.enabled', "启用后，登录对话框会提供“使用 Microsoft 账户继续”，用它换取组织绑定的 GitHub 身份，且仅对当前窗口有效。Olympia 走自己的服务地址与密钥（BYOK），不接 Microsoft / GitHub 账户，这一项保持关闭即可。"),
			default: false,
			scope: ConfigurationScope.APPLICATION,
			tags: ['experimental', 'advanced'],
			// OLYMPIA-TRIM: 读它的是 chatSetupRunner.ts 那段「登录对话框要提供哪几个按钮」。
			// 本产品 product.json 里 byokOnly: true，不走 Microsoft / GitHub 账户，所以默认的 false 就是终态。
			// 我先前想把它整个挡掉（以为是个没人读的死开关），是判断错了：
			// 它有活的读者，只是在本产品里永远不该开启。留在设置里、用说明讲清楚，比藏掉更诚实。
			// Read when a sign-in dialog opens, so `startup` keeps the offered buttons stable for the
			// life of the window instead of changing under a dialog the user already has open.
			experiment: { mode: 'startup' }
		},
		[AgentHostSdkSandboxEnabledSettingId]: {
			included: byokProductIneligible,
			type: 'string',
			enum: [AgentSandboxEnabledValue.Off, AgentSandboxEnabledValue.On],
			markdownDescription: nls.localize('chat.agentHost.sdkSandbox.enabled.description', "Deprecated sandbox mode for the Copilot SDK's built-in shell tool on macOS and Linux."),
			markdownDeprecationMessage: nls.localize('chat.agentHost.sdkSandbox.enabled.deprecated', "This setting no longer has any effect. Use `#chat.agent.sandbox.enabled#` for both the SDK's built-in shell tool and the Agent Host's custom terminal tool."),
			default: AgentSandboxEnabledValue.Off,
			tags: ['experimental', 'advanced'],
		},
		[AgentHostSdkSandboxWindowsEnabledSettingId]: {
			included: byokProductIneligible,
			type: 'string',
			enum: [AgentSandboxEnabledValue.Off, AgentSandboxEnabledValue.On],
			markdownDescription: nls.localize('chat.agentHost.sdkSandbox.enabledWindows.description', "Deprecated sandbox mode for the Copilot SDK's built-in shell tool on Windows."),
			markdownDeprecationMessage: nls.localize('chat.agentHost.sdkSandbox.enabledWindows.deprecated', "This setting no longer has any effect. Use `#chat.agent.sandbox.enabledWindows#` for both the SDK's built-in shell tool and the Agent Host's custom terminal tool."),
			default: AgentSandboxEnabledValue.Off,
			tags: ['experimental', 'advanced'],
		},
		[ChatConfiguration.ToolConfirmationCarousel]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.tools.confirmationCarousel', "启用后，多个工具确认会批量显示在输入框上方的轮播中。"),
			default: true,
		},
		[ChatConfiguration.ToolRiskAssessmentEnabled]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.tools.riskAssessment.enabled', "启用此选项后，工具确认会显示由 LLM 生成的风险等级(安全/警告/仔细审查)及简短说明。"),
			default: true,
			experiment: {
				mode: 'auto'
			},
		},
		[ChatConfiguration.ToolRiskAssessmentModel]: {
			type: 'string',
			// allow-any-unicode-next-line
			description: nls.localize('chat.tools.riskAssessment.model', "用于生成工具风险评估的语言模型 ID。应为小型、快速的模型。"),
			default: 'copilot-utility-small',
			tags: ['experimental', 'advanced'],
			experiment: {
				mode: 'auto'
			},
		},
		[ChatConfiguration.PlanAgentDefaultModel]: {
			type: 'string',
			// allow-any-unicode-next-line
			description: nls.localize('chat.planAgent.defaultModel.description', "从可用提供程序中选择要用于“计划”智能体的默认语言模型。"),
			default: '',
			enum: PlanAgentDefaultModel.modelIds,
			enumItemLabels: PlanAgentDefaultModel.modelLabels,
			markdownEnumDescriptions: PlanAgentDefaultModel.modelDescriptions
		},
		[ChatConfiguration.ExploreAgentDefaultModel]: {
			type: 'string',
			// allow-any-unicode-next-line
			description: nls.localize('chat.exploreAgent.defaultModel.description', "从可用提供程序中选择要用于“浏览”子智能体的默认语言模型。"),
			default: '',
			enum: ExploreAgentDefaultModel.modelIds,
			enumItemLabels: ExploreAgentDefaultModel.modelLabels,
			markdownEnumDescriptions: ExploreAgentDefaultModel.modelDescriptions
		},
		[ChatConfiguration.BYOKUtilityModelDefault]: {
			type: 'string',
			markdownDescription: nls.localize('chat.byokUtilityModelDefault.description', "Controls the default model used by built-in utility flows when the selected main agent model is a bring your own key (BYOK) model. This setting has no effect when the selected main agent model is provided by GitHub Copilot. A specific model configured in {0} or {1} takes precedence.", '`#chat.utilityModel#`', '`#chat.utilitySmallModel#`'),
			enum: [BYOKUtilityModelDefault.None, BYOKUtilityModelDefault.MainAgent, BYOKUtilityModelDefault.Copilot],
			enumItemLabels: [
				// allow-any-unicode-next-line
				nls.localize('chat.byokUtilityModelDefault.none.label', "无"),
				nls.localize('chat.byokUtilityModelDefault.mainAgent.label', "Main Agent Model"),
				nls.localize('chat.byokUtilityModelDefault.copilot.label', "GitHub Copilot"),
			],
			markdownEnumDescriptions: [
				nls.localize('chat.byokUtilityModelDefault.none.description', "Do not use a default utility model."),
				nls.localize('chat.byokUtilityModelDefault.mainAgent.description', "Use the selected BYOK main agent model."),
				nls.localize('chat.byokUtilityModelDefault.copilot.description', "Use the default GitHub Copilot utility models."),
			],
			default: BYOKUtilityModelDefault.Copilot,
		},
		[ChatConfiguration.UtilityModel]: {
			type: 'string',
			description: nls.localize('chat.utilityModel.description', "Override the language model used by built-in utility flows. Leave empty to use the configured default behavior."),
			default: '',
			enum: UtilityModelContribution.modelIds,
			enumItemLabels: UtilityModelContribution.modelLabels,
			markdownEnumDescriptions: UtilityModelContribution.modelDescriptions
		},
		[ChatConfiguration.UtilitySmallModel]: {
			type: 'string',
			description: nls.localize('chat.utilitySmallModel.description', "Override the language model used by built-in small/fast utility flows. A fast and inexpensive model is recommended. Leave empty to use the configured default behavior."),
			default: '',
			enum: UtilitySmallModelContribution.modelIds,
			enumItemLabels: UtilitySmallModelContribution.modelLabels,
			markdownEnumDescriptions: UtilitySmallModelContribution.modelDescriptions
		},
		[ChatConfiguration.RequestQueueingDefaultAction]: {
			type: 'string',
			enum: ['queue', 'steer'],
			enumDescriptions: [
				// allow-any-unicode-next-line
				nls.localize('chat.requestQueuing.defaultAction.queue', "将消息排入队列，待当前请求完成后发送。"),
				// allow-any-unicode-next-line
				nls.localize('chat.requestQueuing.defaultAction.steer', "通过立即发送消息引导当前请求，发出信号让当前请求让步。"),
			],
			// allow-any-unicode-next-line
			description: nls.localize('chat.requestQueuing.defaultAction.description', "控制请求进行时队列按钮的默认操作。"),
			default: 'steer',
		},
		[ChatConfiguration.EnableMath]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.mathEnabled.description', "使用 KaTeX 在聊天答复中启用数学渲染。"),
			default: true,
		},
		[ChatConfiguration.ShowCodeBlockProgressAnimation]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.codeBlock.showProgressAnimation.description', "应用编辑时，在代码块药丸形状中显示进度动画。如果禁用，则改为显示进度百分比。"),
			default: true,
			tags: ['experimental'],
		},
		[mcpDiscoverySection]: {
			type: 'object',
			properties: Object.fromEntries(allDiscoverySources.map(k => [k, { type: 'boolean', description: discoverySourceSettingsLabel[k] }])),
			additionalProperties: false,
			default: Object.fromEntries(allDiscoverySources.map(k => [k, false])),
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('mcp.discovery.enabled', "配置从各种其他应用程序的配置中发现模型上下文协议服务器。"),
		},
		[mcpWorkspaceRootConfig]: {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.WINDOW,
			tags: ['experimental'],
			markdownDescription: nls.localize('mcp.workspaceRootConfig.enabled', "手动添加 MCP 服务器时，一并给出工作区根目录的 `.mcp.json` 作为写入目标。已有 `.vscode/mcp.json` 时让用户选写哪个文件。既有 `.mcp.json` 仍可以单独打开和读取，与这一项无关。"),
		},
		[mcpGalleryServiceEnablementConfig]: {
			type: 'boolean',
			default: false,
			tags: ['preview'],
			// allow-any-unicode-next-line
			description: nls.localize('chat.mcp.gallery.enabled', "为模型上下文协议(MCP)服务器启用默认商城。"),
			included: product.quality === 'stable'
		},
		[mcpGalleryServiceUrlConfig]: {
			type: 'string',
			// allow-any-unicode-next-line
			description: nls.localize('mcp.gallery.serviceUrl', "配置 MCP 库服务 URL 以连接到以下位置:"),
			default: '',
			scope: ConfigurationScope.APPLICATION,
			tags: ['usesOnlineServices', 'advanced'],
			included: false,
			policy: {
				name: 'McpGalleryServiceUrl',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.101',
				value: (policyData) => policyData.mcpRegistryUrl,
				localization: {
					description: {
						key: 'mcp.gallery.serviceUrl',
						// allow-any-unicode-next-line
						value: nls.localize('mcp.gallery.serviceUrl', "配置 MCP 库服务 URL 以连接到以下位置:"),
					}
				}
			},
		},
		[PromptsConfig.INSTRUCTIONS_LOCATION_KEY]: {
			type: 'object',
			title: nls.localize(
				'chat.instructions.config.locations.title',
				// allow-any-unicode-next-line
				"指令文件位置",
			),
			markdownDescription: nls.localize(
				'chat.instructions.config.locations.description',
				// allow-any-unicode-next-line
				"指定可在聊天会话中附加的指令文件(`*{0}`)的位置。[了解详细信息]({1})。\r\n\r\n相对路径是从工作区的根文件夹解析的。",
				INSTRUCTION_FILE_EXTENSION,
				getDocumentationUrl(PromptsType.instructions),
			),
			default: {
				...DEFAULT_INSTRUCTIONS_SOURCE_FOLDERS.map((folder) => ({ [folder.path]: true })).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
			},
			markdownDeprecationMessage: nls.localize('chat.instructions.config.locations.deprecated', "This setting and the Local agent harness will be removed in a future release. Review the {0} in the Agent Customizations editor to move instructions into supported locations.", migrationsTabLink),
			deprecationMessageSeverity: 'info',
			additionalProperties: { type: 'boolean' },
			propertyNames: {
				pattern: VALID_PROMPT_FOLDER_PATTERN,
				// allow-any-unicode-next-line
				patternErrorMessage: nls.localize('chat.instructionsLocations.invalidPath', "路径必须是相对路径或以 \"~/\" 开头。不支持绝对路径和 \"\\\" 分隔符。Glob 模式已弃用，并将在将来的版本中移除。"),
			},
			restricted: true,
			tags: ['prompts', 'reusable prompts', 'prompt snippets', 'instructions'],
			examples: [
				{
					[DEFAULT_INSTRUCTIONS_SOURCE_FOLDERS[0].path]: true,
				},
				{
					[INSTRUCTIONS_DEFAULT_SOURCE_FOLDER]: true,
					'/Users/vscode/repos/instructions': true,
				},
			],
		},
		[PromptsConfig.PROMPT_LOCATIONS_KEY]: {
			type: 'object',
			title: nls.localize(
				'chat.reusablePrompts.config.locations.title',
				// allow-any-unicode-next-line
				"提示文件位置",
			),
			markdownDescription: nls.localize(
				'chat.reusablePrompts.config.locations.description',
				// allow-any-unicode-next-line
				"指定可在聊天会话中运行的可重用提示文件(`*{0}`)的位置。[了解详细信息]({1})。\r\n\r\n相对路径是从工作区的根文件夹解析的。",
				PROMPT_FILE_EXTENSION,
				getDocumentationUrl(PromptsType.prompt),
			),
			default: {
				[PROMPT_DEFAULT_SOURCE_FOLDER]: true,
			},
			markdownDeprecationMessage: nls.localize('chat.reusablePrompts.config.locations.deprecated', "This setting and the Local agent harness will be removed in a future release. Review the {0} in the Agent Customizations editor to convert prompt files into skills.", migrationsTabLink),
			deprecationMessageSeverity: 'info',
			additionalProperties: { type: 'boolean' },
			unevaluatedProperties: { type: 'boolean' },
			propertyNames: {
				pattern: VALID_PROMPT_FOLDER_PATTERN,
				// allow-any-unicode-next-line
				patternErrorMessage: nls.localize('chat.promptFileLocations.invalidPath', "路径必须是相对路径或以 \"~/\" 开头。不支持绝对路径和 \"\\\" 分隔符。Glob 模式已弃用，并将在将来的版本中移除。"),
			},
			restricted: true,
			tags: ['prompts', 'reusable prompts', 'prompt snippets', 'instructions'],
			examples: [
				{
					[PROMPT_DEFAULT_SOURCE_FOLDER]: true,
				},
				{
					[PROMPT_DEFAULT_SOURCE_FOLDER]: true,
					'/Users/vscode/repos/prompts': true,
				},
			],
		},
		[PromptsConfig.MODE_LOCATION_KEY]: {
			type: 'object',
			title: nls.localize(
				'chat.mode.config.locations.title',
				// allow-any-unicode-next-line
				"模式文件位置",
			),
			markdownDescription: nls.localize(
				'chat.mode.config.locations.description',
				// allow-any-unicode-next-line
				"指定自定义聊天模式文件的位置(`*{0}`)。[了解详细信息]({1})。\r\n\r\n相对路径是从工作区的根文件夹解析的。",
				LEGACY_MODE_FILE_EXTENSION,
				getDocumentationUrl(PromptsType.agent),
			),
			default: {
				[LEGACY_MODE_DEFAULT_SOURCE_FOLDER]: true,
			},
			markdownDeprecationMessage: nls.localize('chat.mode.config.locations.deprecated', "这条设置和内置的本地 agent 运行环境会在后续版本移除。聊天模式现在叫自定义 agent，文件放在 .github/agents 目录下；旧的可以在 {0} 里迁到受支持的位置。", migrationsTabLink),
			deprecationMessageSeverity: 'info',
			additionalProperties: { type: 'boolean' },
			unevaluatedProperties: { type: 'boolean' },
			restricted: true,
			tags: ['experimental', 'prompts', 'reusable prompts', 'prompt snippets', 'instructions'],
			examples: [
				{
					[LEGACY_MODE_DEFAULT_SOURCE_FOLDER]: true,
				},
				{
					[LEGACY_MODE_DEFAULT_SOURCE_FOLDER]: true,
					'/Users/vscode/repos/chatmodes': true,
				},
			],
		},
		[PromptsConfig.AGENTS_LOCATION_KEY]: {
			type: 'object',
			title: nls.localize(
				'chat.agents.config.locations.title',
				// allow-any-unicode-next-line
				"智能体文件位置",
			),
			markdownDescription: nls.localize(
				'chat.agents.config.locations.description',
				// allow-any-unicode-next-line
				"指定自定义智能体文件的位置(`*{0}`)。[了解详细信息]({1})。\r\n\r\n相对路径是从工作区的根文件夹解析的。",
				AGENT_FILE_EXTENSION,
				getDocumentationUrl(PromptsType.agent),
			),
			default: {
				[AGENTS_SOURCE_FOLDER]: true,
				[CLAUDE_AGENTS_SOURCE_FOLDER]: true,
				[COPILOT_USER_AGENTS_SOURCE_FOLDER]: true,
			},
			markdownDeprecationMessage: nls.localize('chat.agents.config.locations.deprecated', "This setting and the Local agent harness will be removed in a future release. Review the {0} in the Agent Customizations editor to move agents into supported locations.", migrationsTabLink),
			deprecationMessageSeverity: 'info',
			additionalProperties: { type: 'boolean' },
			propertyNames: {
				pattern: VALID_PROMPT_FOLDER_PATTERN,
				// allow-any-unicode-next-line
				patternErrorMessage: nls.localize('chat.agentLocations.invalidPath', "路径必须是相对路径或以 \"~/\" 开头。不支持绝对路径和 \"\\\" 分隔符。"),
			},
			restricted: true,
			tags: ['prompts', 'reusable prompts', 'prompt snippets', 'instructions'],
			examples: [
				{
					[AGENTS_SOURCE_FOLDER]: true,
				},
				{
					[AGENTS_SOURCE_FOLDER]: true,
					'my-agents': true,
					'../shared-agents': true,
					'~/.copilot/agents': true,
				},
			],
		},
		[PromptsConfig.USE_AGENT_MD]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			title: nls.localize('chat.useAgentMd.title', "使用 AGENTS.md 文件",),
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.useAgentMd.description', "控制是否将在工作区根目录中找到的 `AGENTS.md` 文件中的指令附加到所有聊天请求。",),
			default: true,
			restricted: true,
			disallowConfigurationDefault: true,
			tags: ['prompts', 'reusable prompts', 'prompt snippets', 'instructions']
		},
		[PromptsConfig.USE_NESTED_AGENT_MD]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			title: nls.localize('chat.useNestedAgentMd.title', "使用嵌套的 AGENTS.md 文件",),
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.useNestedAgentMd.description', "控制是否在所有聊天请求中列出在工作区中找到的嵌套 `AGENTS.md` 文件中的指令。如果 `read` 工具可用，则语言模型可以按需加载这些技能。",),
			default: false,
			restricted: true,
			disallowConfigurationDefault: true,
			tags: ['experimental', 'prompts', 'reusable prompts', 'prompt snippets', 'instructions']
		},
		[PromptsConfig.USE_CLAUDE_MD]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			title: nls.localize('chat.useClaudeMd.title', "使用 CLAUDE.md 文件",),
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.useClaudeMd.description', "控制是否将工作区根目录、.claude 和 ～/.claude 文件夹中找到的 `CLAUDE.md` 文件中的说明附加到所有聊天请求中。",),
			default: true,
			restricted: true,
			disallowConfigurationDefault: true,
			tags: ['prompts', 'reusable prompts', 'prompt snippets', 'instructions']
		},
		[PromptsConfig.USE_AGENT_SKILLS]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			title: nls.localize('chat.useAgentSkills.title', "使用智能体技能",),
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.useAgentSkills.description', "控制是否将技能作为专用功能提供给聊天请求。技能是从在 `#chat.agentSkillsLocations#` 中配置的文件夹加载的。如果 `read` 工具可用，则语言模型可以按需加载这些技能。详细了解[智能体技能](https://aka.ms/vscode-agent-skills)。",),
			default: true,
			restricted: true,
			disallowConfigurationDefault: true,
			tags: ['prompts', 'reusable prompts', 'prompt snippets', 'instructions']
		},
		[PromptsConfig.USE_SKILL_ADHERENCE_PROMPT]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			title: nls.localize('chat.useSkillAdherencePrompt.title', "使用技能遵从提示",),
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.useSkillAdherencePrompt.description', "控制是否使用更强的技能遵从提示，以鼓励模型在相关时立即调用技能，而不是仅仅公布技能。"),
			default: false,
			restricted: true,
			disallowConfigurationDefault: true,
			tags: ['experimental', 'prompts', 'reusable prompts', 'prompt snippets', 'instructions'],
			experiment: {
				mode: 'auto'
			}
		},
		[PromptsConfig.INCLUDE_APPLYING_INSTRUCTIONS]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			title: nls.localize('chat.includeApplyingInstructions.title', "包括应用指令",),
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.includeApplyingInstructions.description', "控制聊天请求中是否自动包含具有匹配 \"applyTo\" 特性的指令。",),
			default: true,
			restricted: true,
			disallowConfigurationDefault: true,
			tags: ['prompts', 'reusable prompts', 'prompt snippets', 'instructions']
		},
		[PromptsConfig.INCLUDE_REFERENCED_INSTRUCTIONS]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			title: nls.localize('chat.includeReferencedInstructions.title', "包含引用的指令",),
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.includeReferencedInstructions.description', "控制是否在聊天请求中自动包含引用的指令。",),
			default: false,
			restricted: true,
			disallowConfigurationDefault: true,
			tags: ['prompts', 'reusable prompts', 'prompt snippets', 'instructions']
		},
		[PromptsConfig.USE_CUSTOMIZATIONS_IN_PARENT_REPOS]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			title: nls.localize('chat.useCustomizationsInParentRepos.title', "使用父级存储库中的自定义项",),
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.useCustomizationsInParentRepos.description', "控制是否在父级存储库中使用聊天自定义文件。",),
			default: false,
			restricted: true,
			disallowConfigurationDefault: true,
			tags: ['prompts', 'reusable prompts', 'prompt snippets', 'instructions']
		},
		[PromptsConfig.SKILLS_LOCATION_KEY]: {
			type: 'object',
			// allow-any-unicode-next-line
			title: nls.localize('chat.agentSkillsLocations.title', "智能体技能位置",),
			markdownDescription: nls.localize(
				'chat.agentSkillsLocations.description',
				// allow-any-unicode-next-line
				"指定可在聊天会话中使用的智能体技能(`{0}`)的位置。[了解详细信息]({1})。\r\n\r\n每个路径都应包含具有 SKILL.md 文件的技能子文件夹(例如，如果你有 `my-skills/skillA/SKILL.md`，则添加 `my-skills`)。相对路径是从工作区的根文件夹解析的。",
				SKILL_FILENAME,
				getDocumentationUrl(PromptsType.skill),
			),
			default: {
				...DEFAULT_SKILL_SOURCE_FOLDERS.map((folder) => ({ [folder.path]: true })).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
			},
			markdownDeprecationMessage: nls.localize('chat.agentSkillsLocations.deprecated', "This setting and the Local agent harness will be removed in a future release. Review the {0} in the Agent Customizations editor to move skills into supported locations.", migrationsTabLink),
			deprecationMessageSeverity: 'info',
			additionalProperties: { type: 'boolean' },
			propertyNames: {
				pattern: VALID_PROMPT_FOLDER_PATTERN,
				// allow-any-unicode-next-line
				patternErrorMessage: nls.localize('chat.agentSkillsLocations.invalidPath', "路径必须是相对路径或以 \"~/\" 开头。不支持绝对路径和 \"\\\" 分隔符。"),
			},
			restricted: true,
			tags: ['prompts', 'reusable prompts', 'prompt snippets', 'instructions'],
			examples: [
				{
					[DEFAULT_SKILL_SOURCE_FOLDERS[0].path]: true,
				},
				{
					[DEFAULT_SKILL_SOURCE_FOLDERS[0].path]: true,
					'my-skills': true,
					'../shared-skills': true,
					'~/.custom/skills': true,
				},
			],
		},
		[PromptsConfig.HOOKS_LOCATION_KEY]: {
			type: 'object',
			// allow-any-unicode-next-line
			title: nls.localize('chat.hookFilesLocations.title', "挂钩文件位置",),
			markdownDescription: nls.localize(
				'chat.hookFilesLocations.description',
				// allow-any-unicode-next-line
				"指定挂钩配置文件的路径，这些文件定义了要在智能体工作流关键节点执行的自定义 Shell 命令。[了解详细信息]({0})。\r\n\r\n相对路径是从工作区的根文件夹解析的。支持 Copilot 挂钩(`*.json`)和 Claude Code 挂钩(`settings.json`、`settings.local.json`)。",
				getDocumentationUrl(PromptsType.hook),
			),
			default: {
				...DEFAULT_HOOK_FILE_PATHS.map((f) => ({ [f.path]: true })).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
			},
			additionalProperties: { type: 'boolean' },
			propertyNames: {
				pattern: VALID_PROMPT_FOLDER_PATTERN,
				// allow-any-unicode-next-line
				patternErrorMessage: nls.localize('chat.hookFilesLocations.invalidPath', "路径必须是相对路径或以 \"~/\" 开头。不支持绝对路径和 \"\\\" 分隔符。"),
			},
			restricted: true,
			tags: ['preview', 'prompts', 'hooks', 'agent'],
			examples: [
				{
					[DEFAULT_HOOK_FILE_PATHS[0].path]: true,
				},
				{
					[DEFAULT_HOOK_FILE_PATHS[0].path]: true,
					'custom-hooks/hooks.json': true,
				},
			],
			agentsWindow: { default: { '.claude/settings.local.json': false, '.claude/settings.json': false, '~/.claude/settings.json': false } },
		},
		[PromptsConfig.USE_CHAT_HOOKS]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			title: nls.localize('chat.useHooks.title', "使用聊天挂钩",),
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.useHooks.description', "控制聊天挂钩是否在智能体工作流的关键节点执行。挂钩从 `#chat.hookFilesLocations#` 中配置的文件加载。",),
			default: true,
			restricted: true,
			disallowConfigurationDefault: true,
			tags: ['preview', 'prompts', 'hooks', 'agent'],
			policy: {
				name: 'ChatHooks',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.109',
				value: (policyData) => policyData.chat_preview_features_enabled === false ? false : undefined,
				localization: {
					description: {
						key: 'chat.useHooks.description',
						// allow-any-unicode-next-line
						value: nls.localize('chat.useHooks.description', "控制聊天挂钩是否在智能体工作流的关键节点执行。挂钩从 `#chat.hookFilesLocations#` 中配置的文件加载。",)
					}
				},
			}
		},
		[PromptsConfig.USE_CLAUDE_HOOKS]: {
			included: byokProductIneligible,
			type: 'boolean',
			// allow-any-unicode-next-line
			title: nls.localize('chat.useClaudeHooks.title', "使用 Claude 挂钩",),
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.useClaudeHooks.description', "控制来自 Claude 配置文件的挂钩是否可执行。禁用后，仅使用 Copilot 格式的挂钩。挂钩从 `#chat.hookFilesLocations#` 中配置的文件加载。",),
			default: false,
			restricted: true,
			disallowConfigurationDefault: true,
			tags: ['preview', 'prompts', 'hooks', 'agent']
		},
		[PromptsConfig.PROMPT_FILES_SUGGEST_KEY]: {
			type: 'object',
			scope: ConfigurationScope.RESOURCE,
			title: nls.localize(
				'chat.promptFilesRecommendations.title',
				// allow-any-unicode-next-line
				"提示文件建议",
			),
			markdownDescription: nls.localize(
				'chat.promptFilesRecommendations.description',
				// allow-any-unicode-next-line
				"配置要在聊天欢迎视图中推荐的提示文件。每个键都是提示文件名，值可以是 `true`，以表示始终推荐，`false` 则表示从不推荐，也可以是 [when 子句](https://aka.ms/vscode-when-clause)表达式，如 `resourceExtname == .js` or `resourceLangId == markdown`。",
			),
			default: {},
			additionalProperties: {
				oneOf: [
					{ type: 'boolean' },
					{ type: 'string' }
				]
			},
			tags: ['prompts', 'reusable prompts', 'prompt snippets', 'instructions'],
			examples: [
				{
					'plan': true,
					'a11y-audit': 'resourceExtname == .html',
					'document': 'resourceLangId == markdown'
				}
			],
		},
		[ChatConfiguration.TodosShowWidget]: {
			type: 'boolean',
			default: true,
			// allow-any-unicode-next-line
			description: nls.localize('chat.tools.todos.showWidget', "控制是否在聊天输入上方显示待办事项列表小组件。启用后，小组件显示智能体创建的待办事项，并随进度更新。"),
		},
		[ChatConfiguration.ThinkingStyle]: {
			type: 'string',
			default: 'fixedScrolling',
			enum: ['collapsed', 'collapsedPreview', 'fixedScrolling'],
			enumDescriptions: [
				// allow-any-unicode-next-line
				nls.localize('chat.agent.thinkingMode.collapsed', "默认情况下，思考部分将会折叠。"),
				// allow-any-unicode-next-line
				nls.localize('chat.agent.thinkingMode.collapsedPreview', "思考部分将会先展开，然后在遇到非思考部分后折叠。"),
				// allow-any-unicode-next-line
				nls.localize('chat.agent.thinkingMode.fixedScrolling', "在固定高度且自动滚动的流式面板中展示思考过程；单击标题可展开至全高。"),
			],
			// allow-any-unicode-next-line
			description: nls.localize('chat.agent.thinkingStyle', "控制如何呈现思考。"),
			tags: ['experimental'],
		},
		[ChatConfiguration.ThinkingGenerateTitles]: {
			type: 'boolean',
			default: true,
			// allow-any-unicode-next-line
			description: nls.localize('chat.agent.thinking.generateTitles', "控制是否使用 LLM 为思考部分生成摘要标题。"),
			tags: ['experimental'],
		},
		'chat.agent.thinking.collapsedTools': {
			type: 'string',
			default: 'always',
			enum: ['off', 'withThinking', 'always'],
			enumDescriptions: [
				// allow-any-unicode-next-line
				nls.localize('chat.agent.thinking.collapsedTools.off', "工具调用单独显示，不会折叠到思考部分。"),
				// allow-any-unicode-next-line
				nls.localize('chat.agent.thinking.collapsedTools.withThinking', "当存在思考时，工具调用会折叠到思考部分。"),
				// allow-any-unicode-next-line
				nls.localize('chat.agent.thinking.collapsedTools.always', "工具调用始终折叠，即使没有思考。"),
			],
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.agent.thinking.collapsedTools', "控制工具调用相对于思考部分的显示方式。"),
			tags: ['experimental'],
		},
		[ChatConfiguration.TerminalToolsInThinking]: {
			type: 'boolean',
			default: true,
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.agent.thinking.terminalTools', "启用后，终端工具调用将以简化的视图显示在思考下拉列表中。"),
			tags: ['experimental'],
		},
		[ChatConfiguration.SimpleTerminalCollapsible]: {
			type: 'boolean',
			default: true,
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.tools.terminal.simpleCollapsible', "启用后，终端工具调用始终以简化视图显示在可折叠容器中。"),
			tags: ['experimental'],
		},
		[ChatConfiguration.TerminalOutputReflow]: {
			type: 'boolean',
			default: true,
			description: nls.localize('chat.tools.terminal.outputReflow', "Controls whether terminal output in chat reflows to fit the available width. When disabled, previews use the terminal's column count, or 80 columns when no terminal is available, and scroll horizontally when needed. This does not resize the terminal running the command."),
		},
		[ChatConfiguration.CompressOutputEnabled]: {
			type: 'boolean',
			default: false,
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.tools.compressOutput.enabled', "对工具输出(例如 `git diff`、`ls -l` 或 `npm install`)进行后处理，以在发送给模型前减少令牌使用量。"),
			tags: ['preview'],
			experiment: {
				mode: 'auto'
			}
		},
		[ChatConfiguration.ThinkingPhrases]: {
			type: 'object',
			default: {
				mode: 'append',
				phrases: []
			},
			properties: {
				mode: {
					type: 'string',
					enum: ['replace', 'append'],
					default: 'append',
					// allow-any-unicode-next-line
					description: nls.localize('chat.agent.thinking.phrases.mode', "\"replace\" 完全替换所有默认短语；\"append\" 将你的短语添加到所有默认类别。")
				},
				phrases: {
					type: 'array',
					items: { type: 'string' },
					default: [],
					// allow-any-unicode-next-line
					description: nls.localize('chat.agent.thinking.phrases.phrases', "自定义加载消息，以便在思考、工作进度、终端和工具操作期间显示。")
				}
			},
			additionalProperties: false,
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.agent.thinking.phrases', "自定义智能体思考和进度指示器期间显示的加载消息。使用 `\"mode\": \"replace\"` 以仅使用你的短语，或使用 `\"mode\": \"append\"` 将其添加到默认短语中。"),
			tags: ['experimental'],
		},
		[ChatConfiguration.AutoExpandToolFailures]: {
			type: 'boolean',
			default: true,
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.tools.autoExpandFailures', "启用后，会在聊天 UI 中自动展开工具故障以显示错误详细信息。"),
		},
		[ChatAIDisabledSettingId]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.disableAIFeatures', "禁用并隐藏内置的 AI 功能，包括 AI 教练的聊天与内联建议。"),
			default: false,
			scope: ConfigurationScope.WINDOW,
		},
		[ChatConfiguration.TitleBarSignInEnabled]: {
			included: byokProductIneligible,
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.titleBar.signIn.enabled', "控制退出登录时是否在标题栏显示 Copilot 登录按钮。禁用时，登录入口将回退到状态栏。"),
			default: false,
		},
		[ChatConfiguration.WelcomePageSignInEnabled]: {
			included: byokProductIneligible, // 本产品没有托管助手，这一条没有对应的东西可设
			type: 'boolean',
			description: nls.localize('chat.welcomePage.signIn.enabled', "Controls whether the Welcome page shows a GitHub sign-in button instead of the Agents window button when signed out."),
			default: false,
			tags: ['experimental'],
			experiment: { mode: 'auto' },
		},
		[ChatConfiguration.TitleBarOpenInAgentsWindowEnabled]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.titleBar.openInAgentsWindow.enabled', "控制是否在标题栏中显示“在智能体窗口中打开”按钮。"),
			// Olympia：BYOK-only 的产品没有智能体窗口可去，出厂就把这个按钮关掉，而不是只靠上下文键兜底。
			default: !product.defaultChatAgent?.byokOnly,
		},
		[ChatConfiguration.OpenInAgentsWindowRevealCurrentSession]: {
			type: 'boolean',
			description: nls.localize('chat.experimental.openInAgentsWindow.revealCurrentSession', "Controls whether Open in Agents Window reveals the current local Agent Host session instead of opening a new session."),
			default: false,
			tags: ['experimental'],
			experiment: { mode: 'auto' },
		},
		...agentsWindowHandoffConfigurationProperties,
		'chat.approvedAccountOrganizations': {
			type: 'array',
			items: { type: 'string' },
			// allow-any-unicode-next-line
			description: nls.localize('chat.approvedAccountOrganizations', "允许其成员使用 AI 功能的 GitHub 组织登录名列表。设置为非空列表时，AI 功能将被禁用，直到用户登录属于指定组织之一的 GitHub 帐户且帐户级策略数据已解析。设置为 \"*\" 以允许任何已通过身份验证的 GitHub 或 GitHub Enterprise 帐户。"),
			default: [],
			included: false,
			policy: {
				name: 'ChatApprovedAccountOrganizations',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.118',
				localization: {
					description: {
						key: 'chat.approvedAccountOrganizations.policy.description',
						// allow-any-unicode-next-line
						value: nls.localize('chat.approvedAccountOrganizations.policy.description', "将此策略设置为非空列表会激活已批准帐户限制: 所有 AI 功能将被禁用，直到用户登录的 GitHub 帐户所属组织与该列表存在交集，并且帐户端策略数据已解析。比较不区分大小写。使用 \"*\" 作为通配符，接受任何已登录的 GitHub 或 GHE 帐户(适用于未显示组织列表的 GHE 部署)。")
					}
				}
			}
		},
		'chat.allowAnonymousAccess': { // TODO@bpasero remove me eventually
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.allowAnonymousAccess', "控制聊天中是否允许匿名访问。"),
			default: false,
			included: false,
			tags: ['experimental'],
			experiment: {
				mode: 'auto'
			}
		},
		[ChatConfiguration.GrowthNotificationEnabled]: {
			included: byokProductIneligible,
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.growthNotification', "控制是否在智能体会话视图中显示增长通知以鼓励新用户试用 Copilot。"),
			default: false,
			tags: ['experimental'],
			experiment: {
				mode: 'auto'
			}
		},
		[ChatConfiguration.ChatClosedPromoNotification]: {
			included: byokProductIneligible,
			type: 'string',
			enum: [ChatClosedPromoNotification.None, ChatClosedPromoNotification.CopilotIconPopup],
			enumItemLabels: [
				// allow-any-unicode-next-line
				nls.localize('chat.closedPromoNotification.none.label', "无"),
				nls.localize('chat.closedPromoNotification.copilotIconPopup.label', "Copilot Icon Popup"),
			],
			enumDescriptions: [
				nls.localize('chat.closedPromoNotification.none.description', "Do not show a promo on the Copilot icon when Chat is closed."),
				nls.localize('chat.closedPromoNotification.copilotIconPopup.description', "Show a promo tooltip when hovering or clicking the Copilot status icon while Chat is closed. Viewing the offer clears its indicator; the offer remains available for the current window session. Choosing Try dismisses the offer and its chat banner."),
			],
			description: nls.localize('chat.closedPromoNotification', "Controls whether a live model promo is shown on the Copilot icon when Chat is closed. When explicitly set, this overrides the experiment without an experiment lookup. Otherwise, eligible promos use the experiment treatment."),
			default: ChatClosedPromoNotification.None,
			tags: ['experimental'],
		},
		[ChatConfiguration.RestoreLastPanelSession]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.restoreLastPanelSession', "控制重新启动后是否在面板中恢复上一次会话。"),
			default: false
		},
		[ChatConfiguration.ExitAfterDelegation]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.exitAfterDelegation', "控制在将请求委派给另一个会话后，聊天面板是否自动关闭。"),
			default: false,
			tags: ['preview'],
		},
		'chat.extensionUnification.enabled': {
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.extensionUnification.enabled', "启用统一 GitHub Copilot 扩展。启用后，所有 GitHub Copilot 功能均通过 GitHub Copilot 聊天助手扩展提供。禁用时，GitHub Copilot 和 GitHub Copilot 聊天助手扩展独立运行。"),
			default: true,
			tags: ['experimental'],
			experiment: {
				mode: 'auto'
			}
		},
		[ChatConfiguration.SubagentsAllowInvocationsFromSubagents]: {
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.subagents.allowInvocationsFromSubagents', "允许子代理调用其他子代理。"),
			// allow-any-unicode-next-line
			markdownDescription: nls.localize('chat.subagents.allowInvocationsFromSubagents.md', "控制子代理是否可以调用其他子代理。启用后，嵌套层级最多为 5 级。"),
			default: false,
			experiment: {
				mode: 'auto'
			}
		},
		[ChatConfiguration.SubagentsDefaultToAuto]: {
			type: 'boolean',
			markdownDescription: nls.localize('chat.subagents.defaultToAuto', "Controls whether local subagents use the Auto model when neither the tool call nor the selected agent specifies a model. Explicit tool and agent model selections take precedence. Subagents of a BYOK main model continue to use that model. Auto routing is not constrained by the main model's fixed cost tier."),
			default: false,
			tags: ['experimental'],
			experiment: {
				mode: 'auto'
			},
		},
		[ChatConfiguration.SubagentsShowCreditUsage]: {
			type: 'boolean',
			description: nls.localize('chat.subagents.showCreditUsage', "Controls whether AI credit usage is shown next to the duration for subagents."),
			default: false,
		},
		[ChatConfiguration.TerminalAgentHostEnabled]: {
			type: 'boolean',
			description: nls.localize('chat.terminal.agentHost.enabled', "Controls whether Terminal Chat is backed by the Agent Host instead of the extension host. Applied on startup."),
			default: false,
			tags: ['experimental'],
			experiment: {
				mode: 'startup'
			}
		},
		[ChatConfiguration.InlineChatAgentHostEnabled]: {
			type: 'boolean',
			description: nls.localize('chat.inlineChat.agentHost.enabled', "Controls whether editor inline chat is backed by the Agent Host instead of the extension host. Applied on startup."),
			default: false,
			tags: ['experimental'],
			experiment: {
				mode: 'startup'
			}
		},
		[ChatConfiguration.CollectInstructionsInExtension]: {
			included: byokProductIneligible,
			type: 'boolean',
			// allow-any-unicode-next-line
			description: nls.localize('chat.experimental.collectInstructionsInExtension', "启用后，自动指令收集(.instructions.md、智能体指令、自定义项索引)将由 GitHub Copilot 对话助手扩展而不是核心工作台执行。"),
			default: false,
			tags: ['experimental'],
		},
		[ChatConfiguration.ChatCustomizationsStructuredPreviewEnabled]: {
			type: 'boolean',
			tags: ['preview'],
			// allow-any-unicode-next-line
			description: nls.localize('chat.customizations.structuredPreview.enabled', "控制“聊天自定义”编辑器是否为 Markdown 自定义文件(智能体、技能、指令、提示)显示结构化预览。禁用时，编辑器将始终在嵌入式代码编辑器中打开原始 Markdown。"),
			default: false,
		},
		[ChatConfiguration.ChatCustomizationsToggleStyle]: {
			type: 'string',
			enum: ['checkbox', 'switch'],
			enumDescriptions: [
				nls.localize('chat.experimental.customizations.toggleStyle.checkbox', "Use checkboxes for customization enablement controls."),
				nls.localize('chat.experimental.customizations.toggleStyle.switch', "Use switches for customization enablement controls."),
			],
			tags: ['experimental'],
			description: nls.localize('chat.experimental.customizations.toggleStyle', "Controls whether Plugin, MCP, and Tools customization pages use checkboxes or switches for enablement."),
			default: 'switch',
		},
		...customizationMarketplaceConfigurationProperties,
		[CustomizationMarketplaceConfiguration.CopilotConnectorsEnabled]: {
			included: byokProductIneligible,
			type: 'boolean',
			tags: ['experimental'],
			description: nls.localize('chat.customizations.copilotConnectors.enabled', "Enables Copilot connectors in the unified marketplace and exposes connected connector MCP servers in Chat Customizations and Copilot agent sessions."),
			default: false,
			scope: ConfigurationScope.APPLICATION,
			experiment: { mode: 'auto' },
			agentHost: { key: AgentHostMcpConnectorsEnabledConfigKey },
		},
		[ChatConfiguration.ChatCustomizationsPromptMigrationEnabled]: {
			type: 'boolean',
			tags: ['experimental'],
			description: nls.localize('chat.customizations.promptMigration.enabled', "Controls whether the Chat Customizations editor offers to convert prompt files into skills for agent-host harnesses, which ignore prompt files. When disabled, the migration card and sidebar shortcut are hidden."),
			default: true,
		},
		[ChatConfiguration.ChatCustomizationsUserDataMigrationEnabled]: {
			type: 'boolean',
			tags: ['experimental'],
			description: nls.localize('chat.customizations.userDataMigration.enabled', "Controls whether the Chat Customizations editor offers to move agents and instructions stored in user data to the active agent-host harness, which ignores the user data location. When disabled, the migration card and sidebar shortcut are hidden."),
			default: false,
		},
		[ChatConfiguration.ChatCustomizationsLocationsMigrationEnabled]: {
			type: 'boolean',
			tags: ['experimental'],
			description: nls.localize('chat.customizations.locationsMigration.enabled', "Controls whether the Chat Customizations editor offers to move agents, instructions, and skills from configured locations that are not supported by the active agent-host harness. When disabled, the migration card and sidebar shortcut are hidden."),
			default: false,
		},
		[ChatConfiguration.ChatCustomizationsMcpServerMigrationEnabled]: {
			type: 'boolean',
			tags: ['experimental'],
			description: nls.localize('chat.customizations.mcpServerMigration.enabled', "Controls whether Olympia IDE shows MCP server migration actions, hints, compatibility badges, and compatibility details. Migration moves eligible workspace MCP servers out of .vscode/mcp.json and into a .mcp.json file at the workspace root, where the active agent-host harness discovers them directly."),
			default: false,
		},
		[ChatConfiguration.ChatCustomizationsMigrationHint]: {
			type: 'string',
			enum: [CustomizationMigrationHintMode.Never, CustomizationMigrationHintMode.Once, CustomizationMigrationHintMode.Always],
			enumDescriptions: [
				nls.localize('chat.customizations.migrationHint.never', "Never show customization migration hints in chat."),
				nls.localize('chat.customizations.migrationHint.once', "Show a customization migration hint once per chat session."),
				nls.localize('chat.customizations.migrationHint.always', "Show a customization migration hint for every chat request."),
			],
			description: nls.localize('chat.customizations.migrationHint', "Controls whether chat shows information about customizations that are not used by the active Agent Host harness."),
			default: CustomizationMigrationHintMode.Never,
			tags: ['experimental'],
			experiment: { mode: 'auto' },
		}
	}
});
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		ChatEditor,
		ChatEditorInput.EditorID,
		// allow-any-unicode-next-line
		nls.localize('chat', "聊天")
	),
	[
		new SyncDescriptor(ChatEditorInput)
	]
);
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		ChatDebugEditor,
		ChatDebugEditorInput.ID,
		// allow-any-unicode-next-line
		nls.localize('chatDebug', "调试视图")
	),
	[
		new SyncDescriptor(ChatDebugEditorInput)
	]
);
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		AgentPluginEditor,
		AgentPluginEditor.ID,
		// allow-any-unicode-next-line
		nls.localize('agentPlugin', "智能体插件")
	),
	[
		new SyncDescriptor(AgentPluginEditorInput)
	]
);
function isStringKeyedObject(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function migrateChatDefaultConfiguration(value: unknown): Record<string, unknown> | undefined {
	if (!isStringKeyedObject(value)) {
		return undefined;
	}
	let approvals: ChatDefaultPermissionLevel;
	switch (value.approvals) {
		case ChatPermissionLevel.Default:
			approvals = ChatDefaultPermissionLevel.Manual;
			break;
		case ChatPermissionLevel.AutoApprove:
			approvals = ChatDefaultPermissionLevel.AllowAll;
			break;
		default:
			return undefined;
	}
	return { ...value, approvals };
}

/** Maps the retired boolean form of the Agent Merge merge setting onto its enum. */
function migrateAgentMergeMergePullRequest(value: unknown): unknown {
	return typeof value === 'boolean' ? (value ? 'always' : 'never') : value;
}

Registry.as<IConfigurationMigrationRegistry>(Extensions.ConfigurationMigration).registerConfigurationMigrations([
	{
		key: 'chat.agentSessions.defaultConfiguration',
		migrateFn: (value, _accessor) => ([
			['chat.agentSessions.defaultConfiguration', { value: undefined }],
			[ChatConfiguration.DefaultConfiguration, { value: migrateChatDefaultConfiguration(value) ?? value }]
		])
	},
	{
		key: ChatConfiguration.DefaultConfiguration,
		migrateFn: value => ({ value: migrateChatDefaultConfiguration(value) ?? value })
	},
	{
		key: 'chat.experimental.autoApprovals.enabled',
		migrateFn: () => ({ value: undefined })
	},
	{
		key: 'chat.assistedPermissions.enabled',
		migrateFn: () => ({ value: undefined })
	},
	{
		key: 'chat.agentSessions.sessionCatalog.enabled',
		// The setting is application-scoped, so an existing value can live in the
		// application settings file. Without this the migration only inspects the
		// user target and silently drops such a value.
		includeApplication: true,
		migrateFn: (value, accessor) => {
			const pairs: ConfigurationKeyValuePairs = [['chat.agentSessions.sessionCatalog.enabled', { value: undefined }]];
			if (accessor(ChatConfiguration.SessionCatalogEnabled) === undefined) {
				pairs.push([ChatConfiguration.SessionCatalogEnabled, { value }]);
			}
			return pairs;
		}
	},
	{
		key: 'chat.experimental.detectParticipant.enabled',
		migrateFn: (value, _accessor) => ([
			['chat.experimental.detectParticipant.enabled', { value: undefined }],
			['chat.detectParticipant.enabled', { value: value !== false }]
		])
	},
	{
		key: 'chat.useCopilotModelsForUtilityModels',
		migrateFn: (value: unknown, valueAccessor) => {
			const result: ConfigurationKeyValuePairs = [['chat.useCopilotModelsForUtilityModels', { value: undefined }]];
			if (typeof value === 'boolean' && valueAccessor(ChatConfiguration.BYOKUtilityModelDefault) === undefined) {
				result.push([ChatConfiguration.BYOKUtilityModelDefault, { value: value ? BYOKUtilityModelDefault.Copilot : BYOKUtilityModelDefault.None }]);
			}
			return result;
		}
	},
	{
		key: 'chat.useClaudeSkills',
		migrateFn: (value, _accessor) => ([
			['chat.useClaudeSkills', { value: undefined }],
			['chat.useAgentSkills', { value }]
		])
	},
	{
		key: mcpDiscoverySection,
		migrateFn: (value: unknown) => {
			if (typeof value === 'boolean') {
				return { value: Object.fromEntries(allDiscoverySources.map(k => [k, value])) };
			}

			return { value };
		}
	},
	{
		key: ChatConfiguration.ShowExternalAgentSessions,
		migrateFn: (value: unknown) => ({
			value: value === 'all'
				? AgentHostExternalSessionsMode.Last30Days
				: value,
		})
	},
	{
		key: ChatConfiguration.NotifyWindowOnConfirmation,
		migrateFn: (value: unknown) => {
			if (value === true) {
				return { value: ChatNotificationMode.WindowNotFocused };
			} else if (value === false) {
				return { value: ChatNotificationMode.Off };
			}
			return [];
		}
	},
	{
		key: ChatConfiguration.NotifyWindowOnResponseReceived,
		migrateFn: (value: unknown) => {
			if (value === true) {
				return { value: ChatNotificationMode.WindowNotFocused };
			} else if (value === false) {
				return { value: ChatNotificationMode.Off };
			}
			return [];
		}
	},
	{
		key: 'chat.plugins.paths',
		migrateFn: (value: unknown, _accessor) => ([
			['chat.plugins.paths', { value: undefined }],
			[ChatConfiguration.PluginLocations, { value }]
		])
	},
	// Agent Merge settings dropped the `agentHost` segment from their ids. Without
	// this an explicit opt-out (for example `fixCI: false`) would silently revert to
	// the permissive default for sessions that already have Agent Merge enabled.
	...Object.values(AgentMergeSettingId).map(settingId => {
		const legacyKey = settingId.replace(/^chat\./, 'chat.agentHost.');
		return {
			key: legacyKey,
			migrateFn: (value: unknown, accessor: (key: string) => unknown): ConfigurationKeyValuePairs => {
				const pairs: ConfigurationKeyValuePairs = [[legacyKey, { value: undefined }]];
				// Never clobber an explicitly configured new key (e.g. after settings
				// sync brought both keys across versions).
				if (accessor(settingId) === undefined) {
					pairs.push([settingId, { value: settingId === AgentMergeSettingId.MergePullRequest ? migrateAgentMergeMergePullRequest(value) : value }]);
				}
				return pairs;
			}
		};
	}),
	{
		// `chat.agentMerge.mergePullRequest` became a three-way enum. An explicit
		// `true` must keep merging rather than fall back to the `never` default.
		key: AgentMergeSettingId.MergePullRequest,
		migrateFn: (value: unknown): ConfigurationKeyValuePairs => {
			if (typeof value !== 'boolean') {
				return [];
			}
			return [[AgentMergeSettingId.MergePullRequest, { value: migrateAgentMergeMergePullRequest(value) }]];
		}
	},
	{
		// The on-device dictation runtime moved to Foundry Local; the old
		// transformers.js/onnxruntime model IDs no longer resolve and would fail
		// with an unknown-model error. Map any explicitly-stored legacy value to
		// the new default so existing users keep working. Also migrate the setting
		// from its old `chat.speechToText.model` id to `dictation.model`.
		key: 'chat.speechToText.model',
		migrateFn: (value: unknown, accessor) => {
			const legacyModelIds = [
				'onnx-community/whisper-tiny',
				'onnx-community/whisper-base',
				'onnx-community/whisper-small',
				'onnx-community/nemotron-3.5-asr-streaming-0.6b-onnx-int4',
				'nemotron-speech-streaming-en-0.6b',
			];
			const migrated = (typeof value === 'string' && legacyModelIds.includes(value))
				? DEFAULT_LOCAL_TRANSCRIPTION_MODEL
				: value;
			const pairs: ConfigurationKeyValuePairs = [['chat.speechToText.model', { value: undefined }]];
			// Never clobber an explicitly configured new key (e.g. after settings
			// sync brought both keys across versions).
			if (accessor('dictation.model') === undefined) {
				pairs.push(['dictation.model', { value: migrated }]);
			}
			return pairs;
		}
	},
	{
		// Existing users may have the former English-only default stored
		// explicitly. Move them to the multilingual replacement as well.
		key: 'dictation.model',
		migrateFn: value => ({
			value: value === 'nemotron-speech-streaming-en-0.6b'
				? DEFAULT_LOCAL_TRANSCRIPTION_MODEL
				: value
		})
	},
	{
		// Dictation settings were regrouped under the top-level `dictation.*`
		// namespace (they govern dictation across chat, editor, and terminal).
		key: 'chat.speechToText.enabled',
		migrateFn: (value: unknown, accessor) => {
			const pairs: ConfigurationKeyValuePairs = [['chat.speechToText.enabled', { value: undefined }]];
			if (accessor('dictation.enabled') === undefined) {
				pairs.push(['dictation.enabled', { value }]);
			}
			return pairs;
		}
	},
	{
		// `chat.speechToText.mode` was removed (the shortcut is always tap-toggle /
		// hold-to-talk); clear it so it does not linger as an unknown setting.
		key: 'chat.speechToText.mode',
		migrateFn: () => ([['chat.speechToText.mode', { value: undefined }]])
	},
]);

class ChatResolverContribution extends Disposable {

	static readonly ID = 'workbench.contrib.chatResolver';

	private readonly _editorRegistrations = this._register(new DisposableMap<string>());

	constructor(
		@IChatSessionsService chatSessionsService: IChatSessionsService,
		@IEditorResolverService private readonly editorResolverService: IEditorResolverService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();

		this._registerEditor(Schemas.vscodeChatEditor);
		this._registerEditor(Schemas.vscodeLocalChatSession);

		this._register(chatSessionsService.onDidChangeContentProviderSchemes((e) => {
			for (const scheme of e.added) {
				this._registerEditor(scheme);
			}
			for (const scheme of e.removed) {
				this._editorRegistrations.deleteAndDispose(scheme);
			}
		}));

		for (const scheme of chatSessionsService.getContentProviderSchemes()) {
			this._registerEditor(scheme);
		}
	}

	private _registerEditor(scheme: string): void {
		this._editorRegistrations.set(scheme, this.editorResolverService.registerEditor(`${scheme}:**/**`,
			{
				id: ChatEditorInput.EditorID,
				// allow-any-unicode-next-line
				label: nls.localize('chat', "聊天"),
				priority: RegisteredEditorPriority.builtin
			},
			{
				singlePerResource: true,
				canSupportResource: resource => resource.scheme === scheme,
			},
			{
				createEditorInput: ({ resource, options }) => {
					return {
						editor: this.instantiationService.createInstance(ChatEditorInput, resource, options as IChatEditorOptions),
						options
					};
				}
			}
		));
	}
}

class CopilotTelemetryContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.copilotTelemetry';

	constructor(
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IChatEntitlementService private readonly chatEntitlementService: IChatEntitlementService,
	) {
		super();

		this.updateCommonProperties();

		this._register(this.chatEntitlementService.onDidChangeEntitlement(() => {
			this.updateCommonProperties();
		}));
	}

	private updateCommonProperties(): void {
		const copilotTrackingId = this.chatEntitlementService.copilotTrackingId;
		if (copilotTrackingId) {
			// __GDPR__COMMON__ "common.copilotTrackingId" : { "endPoint": "GoogleAnalyticsID", "classification": "EndUserPseudonymizedInformation", "purpose": "BusinessInsight", "comment": "The anonymized Copilot analytics tracking ID from the entitlement API." }
			this.telemetryService.setCommonProperty('common.copilotTrackingId', copilotTrackingId);
		}

		if (this.chatEntitlementService.isInternal) {
			this.telemetryService.setCommonProperty('common.msftInternal', true);
		}
	}
}

class ChatDebugResolverContribution implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.chatDebugResolver';

	constructor(
		@IEditorResolverService editorResolverService: IEditorResolverService,
	) {
		editorResolverService.registerEditor(
			`${ChatDebugEditorInput.RESOURCE.scheme}:**/**`,
			{
				id: ChatDebugEditorInput.ID,
				// allow-any-unicode-next-line
				label: nls.localize('chatDebug', "调试视图"),
				priority: RegisteredEditorPriority.exclusive
			},
			{
				singlePerResource: true,
				canSupportResource: resource => resource.scheme === ChatDebugEditorInput.RESOURCE.scheme
			},
			{
				createEditorInput: () => {
					return {
						editor: ChatDebugEditorInput.instance,
						options: { pinned: true }
					};
				}
			}
		);
	}
}

class ChatAgentSettingContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.chatAgentSetting';
	private readonly newChatButtonExperimentIcon;

	constructor(
		@IWorkbenchAssignmentService private readonly experimentService: IWorkbenchAssignmentService,
		@IChatEntitlementService private readonly entitlementService: IChatEntitlementService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
	) {
		super();
		this.newChatButtonExperimentIcon = ChatContextKeys.newChatButtonExperimentIcon.bindTo(this.contextKeyService);
		this.registerMaxRequestsSetting();
		this.registerNewChatButtonIcon();
		this.registerDefaultModeSetting();
	}


	private registerMaxRequestsSetting(): void {
		let lastNode: IConfigurationNode | undefined;
		const registerMaxRequestsSetting = () => {
			const treatmentId = this.entitlementService.entitlement === ChatEntitlement.Free ?
				'chatAgentMaxRequestsFree' :
				'chatAgentMaxRequestsPro';
			this.experimentService.getTreatment<number>(treatmentId).then((value) => {
				const node: IConfigurationNode = {
					id: 'chatSidebar',
					// allow-any-unicode-next-line
					title: nls.localize('interactiveSessionConfigurationTitle', "聊天"),
					type: 'object',
					properties: {
						'chat.agent.maxRequests': {
							type: 'number',
							// allow-any-unicode-next-line
							markdownDescription: nls.localize('chat.agent.maxRequests', "使用智能体时每轮次允许的最大请求数。达到限制后，将要求确认以继续。"),
							default: value ?? 50,
							order: 2,
							agentsWindow: { default: 1000 },
						},
					}
				};
				configurationRegistry.updateConfigurations({ remove: lastNode ? [lastNode] : [], add: [node] });
				lastNode = node;
			});
		};
		this._register(Event.runAndSubscribe(Event.debounce(this.entitlementService.onDidChangeEntitlement, () => { }, 1000), () => registerMaxRequestsSetting()));
	}

	private registerNewChatButtonIcon(): void {
		this.experimentService.getTreatment<string>('chatNewButtonIcon').then((value) => {
			const supportedValues = ['copilot', 'new-session', 'comment'];
			if (typeof value === 'string' && supportedValues.includes(value)) {
				this.newChatButtonExperimentIcon.set(value);
			} else {
				this.newChatButtonExperimentIcon.reset();
			}
		});
	}

	private registerDefaultModeSetting(): void {
		this.experimentService.getTreatment<string>('chatDefaultNewSessionMode').then(value => {
			const node: IConfigurationNode = {
				id: 'chatSidebar',
				// allow-any-unicode-next-line
				title: nls.localize('interactiveSessionConfigurationTitle', "聊天"),
				type: 'object',
				properties: {
					[ChatConfiguration.DefaultNewSessionMode]: {
						type: 'string',
						// allow-any-unicode-next-line
						description: nls.localize('chat.newSession.defaultMode', "新聊天会话的默认模式。若为空，则使用聊天视图的默认模式。"),
						// 这个实验节点拿同一个键又注册了一遍配置，会盖掉上面那条静态默认值。
						// 本产品不接实验（chat.experimental 出厂就是 false），value 永远是 undefined，
						// 所以 byokOnly 的默认值必须在这里也接住，否则「提问」模式白设了。
						default: typeof value === 'string' ? value : (product.defaultChatAgent?.byokOnly ? ChatModeKind.Ask : ''),
					}
				}
			};
			configurationRegistry.updateConfigurations({ add: [node], remove: [] });
		});
	}
}

class ChatForegroundSessionCountContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.chatForegroundSessionCount';

	private readonly foregroundSessionCountContextKey: IContextKey<number>;

	constructor(
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IChatWidgetService private readonly chatWidgetService: IChatWidgetService,
		@IViewsService private readonly viewsService: IViewsService,
	) {
		super();
		this.foregroundSessionCountContextKey = ChatContextKeys.foregroundSessionCount.bindTo(this.contextKeyService);

		this._register(this.chatWidgetService.onDidAddWidget(() => {
			this.updateForegroundSessionCount();
		}));

		this._register(this.chatWidgetService.onDidChangeWidgetVisibility(() => {
			this.updateForegroundSessionCount();
		}));

		this._register(Event.filter(this.viewsService.onDidChangeViewVisibility, e => e.id === ChatViewId)(() => {
			this.updateForegroundSessionCount();
		}));

		this.updateForegroundSessionCount();
	}

	private updateForegroundSessionCount(): void {
		let count = this.viewsService.isViewVisible(ChatViewId) ? 1 : 0;

		for (const widget of this.chatWidgetService.getWidgetsByLocations(ChatAgentLocation.Chat)) {
			if (!widget.visible) {
				continue;
			}

			if (isIChatViewViewContext(widget.viewContext)) {
				continue;
			}

			if (isIChatResourceViewContext(widget.viewContext) && widget.viewContext.isQuickChat) {
				continue;
			}

			count++;
		}

		this.foregroundSessionCountContextKey.set(count);
	}
}


/**
 * Given builtin and custom modes, returns only the custom mode IDs that should have actions registered.
 * Custom modes whose names conflict with builtin modes are excluded.
 * If there are name collisions among custom modes, the later mode in the list wins.
 */
function getCustomModesWithUniqueNames(builtinModes: readonly IChatMode[], customModes: readonly IChatMode[]): Set<string> {
	const customModeIds = new Set<string>();
	const builtinNames = new Set(builtinModes.map(mode => mode.name.get()));
	const customNameToId = new Map<string, string>();

	for (const mode of customModes) {
		const modeName = mode.name.get();

		// Skip custom modes that conflict with builtin mode names
		if (builtinNames.has(modeName)) {
			continue;
		}

		// If there is a name collision among custom modes, the later one in the list wins
		const existingId = customNameToId.get(modeName);
		if (existingId) {
			customModeIds.delete(existingId);
		}

		customNameToId.set(modeName, mode.id);
		customModeIds.add(mode.id);
	}

	return customModeIds;
}

/**
 * Workbench contribution to register actions for custom chat modes via events
 */
class ChatAgentActionsContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.chatAgentActions';

	private readonly _modeActionDisposables = new DisposableMap<string>();

	constructor(
		@IChatModeService _chatModeService: IChatModeService,
		@IChatWidgetService private readonly chatWidgetService: IChatWidgetService,
	) {
		super();
		this._store.add(this._modeActionDisposables);

		const focusedWidget = observableFromEvent(this, this.chatWidgetService.onDidChangeFocusedSession, () => this.chatWidgetService.lastFocusedWidget);
		this._register(autorun(reader => {
			const chatModes = focusedWidget.read(reader)?.input.currentChatModesObs.read(reader);
			this._syncModeActions(chatModes);
		}));
	}

	private _syncModeActions(chatModes: IChatModes | undefined): void {
		if (!chatModes) {
			this._modeActionDisposables.clearAndDisposeAll();
			return;
		}

		const { builtin, custom } = chatModes;
		const currentModeIds = getCustomModesWithUniqueNames(builtin, custom);

		// Remove modes that no longer exist and those replaced by modes later in the list with same name.
		for (const modeId of this._modeActionDisposables.keys()) {
			if (!currentModeIds.has(modeId)) {
				this._modeActionDisposables.deleteAndDispose(modeId);
			}
		}

		// Register new modes.
		for (const mode of custom) {
			if (currentModeIds.has(mode.id) && !this._modeActionDisposables.has(mode.id)) {
				this._registerModeAction(mode);
			}
		}
	}

	private _registerModeAction(mode: IChatMode): void {
		const actionClass = class extends ModeOpenChatGlobalAction {
			constructor() {
				super(mode);
			}
		};
		this._modeActionDisposables.set(mode.id, registerAction2(actionClass));
	}
}

class HookSchemaAssociationContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.hookSchemaAssociation';

	private readonly _registrations = this._register(new DisposableStore());

	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IPathService private readonly _pathService: IPathService,
	) {
		super();
		this._updateAssociations();
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(PromptsConfig.HOOKS_LOCATION_KEY)) {
				this._updateAssociations();
			}
		}));
	}

	private async _updateAssociations(): Promise<void> {
		this._registrations.clear();

		const folders = PromptsConfig.promptSourceFolders(this._configurationService, PromptsType.hook);
		const userHomeUri = await this._pathService.userHome();
		const userHome = userHomeUri.fsPath ?? userHomeUri.path;

		for (const folder of folders) {
			// Skip Claude settings files — they use a different schema format
			if (folder.source === PromptFileSource.ClaudeWorkspace || folder.source === PromptFileSource.ClaudeWorkspaceLocal || folder.source === PromptFileSource.ClaudePersonal) {
				continue;
			}

			// Expand tilde paths to absolute paths so the JSON language service can match them
			const resolvedPath = isTildePath(folder.path)
				? userHome + folder.path.substring(1)
				: folder.path;

			// If it's a specific .json file, use it directly; otherwise treat as directory
			const glob = resolvedPath.toLowerCase().endsWith('.json')
				? resolvedPath
				: `${resolvedPath}/*.json`;

			this._registrations.add(
				jsonContributionRegistry.registerSchemaAssociation(HOOK_SCHEMA_URI, glob)
			);
		}
	}
}

class ToolReferenceNamesContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.toolReferenceNames';

	constructor(
		@ILanguageModelToolsService private readonly _languageModelToolsService: ILanguageModelToolsService,
	) {
		super();
		this._updateToolReferenceNames();
		this._register(this._languageModelToolsService.onDidChangeTools(() => this._updateToolReferenceNames()));
	}

	private _updateToolReferenceNames(): void {
		const tools =
			Array.from(this._languageModelToolsService.getAllToolsIncludingDisabled())
				.filter((tool): tool is typeof tool & { toolReferenceName: string } => typeof tool.toolReferenceName === 'string')
				.sort((a, b) => a.toolReferenceName.localeCompare(b.toolReferenceName));
		toolReferenceNameEnumValues.length = 0;
		toolReferenceNameEnumDescriptions.length = 0;
		for (const tool of tools) {
			toolReferenceNameEnumValues.push(tool.toolReferenceName);
			toolReferenceNameEnumDescriptions.push(nls.localize(
				'chat.toolReferenceName.description',
				"{0} - {1}",
				tool.toolReferenceName,
				tool.userDescription || tool.displayName
			));
		}
		configurationRegistry.notifyConfigurationSchemaUpdated({
			id: 'chatSidebar',
			properties: {
				[ChatConfiguration.EligibleForAutoApproval]: {}
			}
		});
	}
}

/**
 * Forces the eager {@link ChatSpeechToTextService} to instantiate at startup so
 * it can publish the `chatSpeechToTextConfigured` context key that gates the
 * dictation (mic) button. Registered singletons are created lazily on first
 * access, so without this the key would never be set and the button never shows.
 */
class ChatSpeechToTextInitContribution implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.chatSpeechToTextInit';

	constructor(
		@IChatSpeechToTextService _chatSpeechToTextService: IChatSpeechToTextService,
	) {
		// Injecting the service is enough to construct it.
	}
}

AccessibleViewRegistry.register(new ChatTerminalOutputAccessibleView());
AccessibleViewRegistry.register(new ChatResponseAccessibleView());
AccessibleViewRegistry.register(new PanelChatAccessibilityHelp());
AccessibleViewRegistry.register(new QuickChatAccessibilityHelp());
AccessibleViewRegistry.register(new EditsChatAccessibilityHelp());
AccessibleViewRegistry.register(new AgentChatAccessibilityHelp());
AccessibleViewRegistry.register(new ChatFindAccessibilityHelp());
AccessibleViewRegistry.register(new ChatPetAchievementsAccessibilityHelp());

registerEditorFeature(ChatInputBoxContentProvider);
Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(ChatEditorInput.TypeID, ChatEditorInputSerializer);
Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(ChatDebugEditorInput.ID, ChatDebugEditorInputSerializer);

registerWorkbenchContribution2(CopilotTelemetryContribution.ID, CopilotTelemetryContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(EditorChatUsageContribution.ID, EditorChatUsageContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChatSpeechToTextInitContribution.ID, ChatSpeechToTextInitContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChatResolverContribution.ID, ChatResolverContribution, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(ChatDebugResolverContribution.ID, ChatDebugResolverContribution, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(PromptsDebugContribution.ID, PromptsDebugContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(AgentHostChatDebugContribution.ID, AgentHostChatDebugContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChatLanguageModelsDataContribution.ID, ChatLanguageModelsDataContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChatSlashCommandsContribution.ID, ChatSlashCommandsContribution, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(ChatSessionOptionSlashCommandsContribution.ID, ChatSessionOptionSlashCommandsContribution, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(ChatOutlineCreator.ID, ChatOutlineCreator, WorkbenchPhase.AfterRestored);

registerWorkbenchContribution2(ChatExtensionPointHandler.ID, ChatExtensionPointHandler, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(LanguageModelToolsExtensionPointHandler.ID, LanguageModelToolsExtensionPointHandler, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(ChatPromptFilesExtensionPointHandler.ID, ChatPromptFilesExtensionPointHandler, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChatCompatibilityNotifier.ID, ChatCompatibilityNotifier, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(CodeBlockActionRendering.ID, CodeBlockActionRendering, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChatCopyActionRendering.ID, ChatCopyActionRendering, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChatModelFeedbackSurveyActionRendering.ID, ChatModelFeedbackSurveyActionRendering, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChatModelFeedbackSurveyPromptContribution.ID, ChatModelFeedbackSurveyPromptContribution, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(ChatImplicitContextContribution.ID, ChatImplicitContextContribution, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(ChatViewsWelcomeHandler.ID, ChatViewsWelcomeHandler, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(ChatGettingStartedContribution.ID, ChatGettingStartedContribution, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(ChatSetupContribution.ID, ChatSetupContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChatQuotaNotificationContribution.ID, ChatQuotaNotificationContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(ChatPromoNotificationContribution.ID, ChatPromoNotificationContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(ChatExpNotificationContribution.ID, ChatExpNotificationContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(HasByokModelsContribution.ID, HasByokModelsContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChatTeardownContribution.ID, ChatTeardownContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(ChatStatusBarEntry.ID, ChatStatusBarEntry, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(BuiltinToolsContribution.ID, BuiltinToolsContribution, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(ClientToolSetsContribution.ID, ClientToolSetsContribution, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(UsagesToolContribution.ID, UsagesToolContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(RenameToolContribution.ID, RenameToolContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChatAgentSettingContribution.ID, ChatAgentSettingContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(ChatForegroundSessionCountContribution.ID, ChatForegroundSessionCountContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(ChatAgentActionsContribution.ID, ChatAgentActionsContribution, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(HookSchemaAssociationContribution.ID, HookSchemaAssociationContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(ToolReferenceNamesContribution.ID, ToolReferenceNamesContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(ChatAgentRecommendation.ID, ChatAgentRecommendation, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(ChatEditingEditorAccessibility.ID, ChatEditingEditorAccessibility, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(ChatQueuePickerRendering.ID, ChatQueuePickerRendering, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChatEditingEditorOverlay.ID, ChatEditingEditorOverlay, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(ChatEditingEditorContextKeys.ID, ChatEditingEditorContextKeys, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(ChatTransferContribution.ID, ChatTransferContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChatContextContributions.ID, ChatContextContributions, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(PromptUrlHandler.ID, PromptUrlHandler, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(PluginUrlHandler.ID, PluginUrlHandler, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChatEditingNotebookFileSystemProviderContrib.ID, ChatEditingNotebookFileSystemProviderContrib, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(ChatResponseResourceWorkbenchContribution.ID, ChatResponseResourceWorkbenchContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChatTerminalOutputTextModelWorkbenchContribution.ID, ChatTerminalOutputTextModelWorkbenchContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(UserToolSetsContributions.ID, UserToolSetsContributions, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(PromptLanguageFeaturesProvider.ID, PromptLanguageFeaturesProvider, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(ChatWindowNotifier.ID, ChatWindowNotifier, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(ChatRepoInfoContribution.ID, ChatRepoInfoContribution, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(AgentPluginRecommendations.ID, AgentPluginRecommendations, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(AgentPluginCommandsContribution.ID, AgentPluginCommandsContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(PluginAutoUpdate.ID, PluginAutoUpdate, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(ChatReferenceAttachmentWidgetContribution.ID, ChatReferenceAttachmentWidgetContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(TranscriptContextAttachmentWidgetContribution.ID, TranscriptContextAttachmentWidgetContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(ChatPetContextContribution.ID, ChatPetContextContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChatPetCustomizationAchievementContribution.ID, ChatPetCustomizationAchievementContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(ChatPetEditingAchievementContribution.ID, ChatPetEditingAchievementContribution, WorkbenchPhase.AfterRestored);

registerChatActions();
registerChatAccessibilityActions();
registerChatCopyActions();
registerChatModelFeedbackSurveyActions();
registerChatOpenAgentDebugPanelAction();
registerChatCodeBlockActions();
registerChatCodeCompareBlockActions();
registerChatFileTreeActions();
registerChatPromptNavigationActions();
registerChatTitleActions();
registerChatExecuteActions();
registerChatFindActions();
registerAction2(ChatVoiceInputModeAction);
registerAction2(ChatVoiceInputModeToggleListenAction);
registerVoiceInputModeSimulateActions();
registerChatSpeechToTextActions();
registerConfigureSpeechInstructionsActions();
registerChatQueueActions();
registerQuickChatActions();
registerChatExportActions();
registerMoveActions();
registerNewChatActions();
registerChatContextActions();
registerChatDeveloperActions();
registerChatEditorActions();
registerChatElicitationActions();
registerChatToolActions();
registerLanguageModelActions();
registerChatPluginActions();
registerAction2(ConfigureToolSets);
registerEditorFeature(ChatPasteProvidersFeature);

agentPluginDiscoveryRegistry.register(new SyncDescriptor(ConfiguredAgentPluginDiscovery), AgentPluginDiscoveryPriority.Configured);
agentPluginDiscoveryRegistry.register(new SyncDescriptor(MarketplaceAgentPluginDiscovery), AgentPluginDiscoveryPriority.Marketplace);
agentPluginDiscoveryRegistry.register(new SyncDescriptor(ExtensionAgentPluginDiscovery), AgentPluginDiscoveryPriority.Extension);
agentPluginDiscoveryRegistry.register(new SyncDescriptor(CopilotCliAgentPluginDiscovery), AgentPluginDiscoveryPriority.CopilotCli);

registerSingleton(IChatResponseResourceFileSystemProvider, ChatResponseResourceFileSystemProvider, InstantiationType.Delayed);
registerSingleton(IChatTerminalOutputTextModelService, ChatTerminalOutputTextModelService, InstantiationType.Delayed);
registerSingleton(IChatSpeechToTextService, ChatSpeechToTextService, InstantiationType.Eager);
registerSingleton(IVoiceCodeTranscriptionClient, VoiceCodeTranscriptionClient, InstantiationType.Delayed);
registerSingleton(IChatTransferService, ChatTransferService, InstantiationType.Delayed);
registerSingleton(IChatService, ChatService, InstantiationType.Delayed);
registerSingleton(IChatWidgetService, ChatWidgetService, InstantiationType.Delayed);
registerSingleton(ISessionChatPillVisibilityService, SessionChatPillVisibility, InstantiationType.Delayed);
registerSingleton(IChatPasteTargetService, ChatPasteTargetService, InstantiationType.Delayed);
registerSingleton(IChatSideChatService, ChatSideChatService, InstantiationType.Delayed);
registerSingleton(IChatRequestOriginService, ChatRequestOriginService, InstantiationType.Delayed);
registerSingleton(IChatHarnessSwitchFeedbackSurveyService, ChatHarnessSwitchFeedbackSurveyService, InstantiationType.Delayed);
registerSingleton(IChatModelFeedbackSurveyService, ChatModelFeedbackSurveyService, InstantiationType.Delayed);
registerSingleton(IChatPetService, ChatPetService, InstantiationType.Delayed);
registerSingleton(IChatPetWidgetService, ChatPetWidgetService, InstantiationType.Delayed);
registerSingleton(IQuickChatService, QuickChatService, InstantiationType.Delayed);
registerSingleton(IChatAccessibilityService, ChatAccessibilityService, InstantiationType.Delayed);
registerSingleton(IChatWidgetHistoryService, ChatWidgetHistoryService, InstantiationType.Delayed);
registerSingleton(ILanguageModelsConfigurationService, LanguageModelsConfigurationService, InstantiationType.Delayed);
registerSingleton(ILanguageModelsService, LanguageModelsService, InstantiationType.Delayed);
registerSingleton(ILanguageModelStatsService, LanguageModelStatsService, InstantiationType.Delayed);
registerSingleton(IChatSlashCommandService, ChatSlashCommandService, InstantiationType.Delayed);
registerSingleton(IChatAgentService, ChatAgentService, InstantiationType.Delayed);
registerSingleton(IChatAgentNameService, ChatAgentNameService, InstantiationType.Delayed);
registerSingleton(IChatVariablesService, ChatVariablesService, InstantiationType.Delayed);
registerSingleton(IAgentPluginService, AgentPluginService, InstantiationType.Delayed);
registerSingleton(IPluginMarketplaceService, PluginMarketplaceService, InstantiationType.Delayed);
registerSingleton(IWorkspacePluginSettingsService, WorkspacePluginSettingsService, InstantiationType.Delayed);
registerSingleton(IAgentPluginRepositoryService, AgentPluginRepositoryService, InstantiationType.Delayed);
registerSingleton(IPluginGitService, BrowserPluginGitCommandService, InstantiationType.Delayed);
registerSingleton(IPluginInstallService, PluginInstallService, InstantiationType.Delayed);
registerSingleton(ILanguageModelToolsService, LanguageModelToolsService, InstantiationType.Delayed);
registerSingleton(IToolResultCompressor, ToolResultCompressorService, InstantiationType.Delayed);
registerSingleton(ILanguageModelToolsConfirmationService, LanguageModelToolsConfirmationService, InstantiationType.Delayed);
registerSingleton(IChatToolRiskAssessmentService, ChatToolRiskAssessmentService, InstantiationType.Delayed);
registerSingleton(IChatGoalSummaryService, ChatGoalSummaryService, InstantiationType.Delayed);
registerSingleton(IChatSubmitRequestHandlerService, ChatSubmitRequestHandlerService, InstantiationType.Delayed);
registerSingleton(IVoiceChatService, VoiceChatService, InstantiationType.Delayed);
registerSingleton(IChatCodeBlockContextProviderService, ChatCodeBlockContextProviderService, InstantiationType.Delayed);
registerSingleton(ICodeMapperService, CodeMapperService, InstantiationType.Delayed);
registerSingleton(IChatEditingService, ChatEditingService, InstantiationType.Delayed);
registerSingleton(IChatMarkdownAnchorService, ChatMarkdownAnchorService, InstantiationType.Delayed);
registerSingleton(IAgentNetworkFilterService, AgentNetworkFilterService, InstantiationType.Delayed);
registerSingleton(ILanguageModelIgnoredFilesService, LanguageModelIgnoredFilesService, InstantiationType.Delayed);
registerSingleton(IPromptsService, PromptsService, InstantiationType.Delayed);
registerSingleton(ICustomizationMigrationService, CustomizationMigrationService, InstantiationType.Delayed);
registerSingleton(ICustomizationMigrationTelemetryService, CustomizationMigrationTelemetryService, InstantiationType.Delayed);
registerSingleton(IChatContextPickService, ChatContextPickService, InstantiationType.Delayed);
registerSingleton(IChatModeService, ChatModeService, InstantiationType.Delayed);
registerSingleton(IChatAttachmentResolveService, ChatAttachmentResolveService, InstantiationType.Delayed);
registerSingleton(IChatAttachmentWidgetRegistry, ChatAttachmentWidgetRegistry, InstantiationType.Delayed);
registerSingleton(IChatTodoListService, ChatTodoListService, InstantiationType.Delayed);
registerSingleton(IChatArtifactsService, ChatArtifactsService, InstantiationType.Delayed);
registerSingleton(IChatOutputRendererService, ChatOutputRendererService, InstantiationType.Delayed);
registerSingleton(IChatLayoutService, ChatLayoutService, InstantiationType.Delayed);
registerSingleton(IPlanReviewFeedbackService, PlanReviewFeedbackService, InstantiationType.Delayed);
registerSingleton(IChatTipService, ChatTipService, InstantiationType.Delayed);
registerSingleton(IChatDebugService, ChatDebugServiceImpl, InstantiationType.Delayed);
registerSingleton(IChatImageCarouselService, ChatImageCarouselService, InstantiationType.Delayed);
registerSingleton(IAgentHostImportConversationStore, AgentHostImportConversationStore, InstantiationType.Delayed);
registerSingleton(ISessionSummaryHoverService, SessionSummaryHoverService, InstantiationType.Delayed);

ChatWidget.CONTRIBS.push(ChatDynamicVariableModel);
