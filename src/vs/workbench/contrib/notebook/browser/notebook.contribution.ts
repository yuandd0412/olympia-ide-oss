/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Schemas } from '../../../../base/common/network.js';
import { IDisposable, Disposable, DisposableStore, dispose } from '../../../../base/common/lifecycle.js';
import { parse } from '../../../../base/common/marshalling.js';
import { extname, isEqual } from '../../../../base/common/resources.js';
import { assertType } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { toFormattedString } from '../../../../base/common/jsonFormatter.js';
import { ITextModel, ITextBufferFactory, ITextBuffer } from '../../../../editor/common/model.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ILanguageSelection, ILanguageService } from '../../../../editor/common/languages/language.js';
import { ITextModelContentProvider, ITextModelService } from '../../../../editor/common/services/resolverService.js';
import * as nls from '../../../../nls.js';
import { Extensions, IConfigurationPropertySchema, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { Extensions as WorkbenchExtensions, IWorkbenchContribution, IWorkbenchContributionsRegistry, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { IEditorSerializer, IEditorFactoryRegistry, EditorExtensions } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { NotebookEditor } from './notebookEditor.js';
import { NotebookEditorInput, NotebookEditorInputOptions } from '../common/notebookEditorInput.js';
import { INotebookService } from '../common/notebookService.js';
import { NotebookService } from './services/notebookServiceImpl.js';
import { CellKind, CellUri, IResolvedNotebookEditorModel, NotebookWorkingCopyTypeIdentifier, NotebookSetting, ICellOutput, ICell, NotebookCellsChangeType, NotebookMetadataUri } from '../common/notebookCommon.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IUndoRedoService } from '../../../../platform/undoRedo/common/undoRedo.js';
import { INotebookEditorModelResolverService } from '../common/notebookEditorModelResolverService.js';
import { NotebookDiffEditorInput } from '../common/notebookDiffEditorInput.js';
import { NotebookTextDiffEditor } from './diff/notebookDiffEditor.js';
import { INotebookEditorWorkerService } from '../common/services/notebookWorkerService.js';
import { NotebookEditorWorkerServiceImpl } from './services/notebookWorkerServiceImpl.js';
import { INotebookCellStatusBarService } from '../common/notebookCellStatusBarService.js';
import { NotebookCellStatusBarService } from './services/notebookCellStatusBarServiceImpl.js';
import { INotebookEditorService } from './services/notebookEditorService.js';
import { NotebookEditorWidgetService } from './services/notebookEditorServiceImpl.js';
import { IJSONContributionRegistry, Extensions as JSONExtensions } from '../../../../platform/jsonschemas/common/jsonContributionRegistry.js';
import { IJSONSchema, IJSONSchemaMap } from '../../../../base/common/jsonSchema.js';
import { Event } from '../../../../base/common/event.js';
import { getFormattedOutputJSON, getStreamOutputData } from './diff/diffElementViewModel.js';
import { NotebookModelResolverServiceImpl } from '../common/notebookEditorModelResolverServiceImpl.js';
import { INotebookKernelHistoryService, INotebookKernelService } from '../common/notebookKernelService.js';
import { NotebookKernelService } from './services/notebookKernelServiceImpl.js';
import { IWorkingCopyIdentifier } from '../../../services/workingCopy/common/workingCopy.js';
import { IResourceEditorInput } from '../../../../platform/editor/common/editor.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IWorkingCopyEditorHandler, IWorkingCopyEditorService } from '../../../services/workingCopy/common/workingCopyEditorService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { NotebookRendererMessagingService } from './services/notebookRendererMessagingServiceImpl.js';
import { INotebookRendererMessagingService } from '../common/notebookRendererMessagingService.js';
import { INotebookCellOutlineDataSourceFactory, NotebookCellOutlineDataSourceFactory } from './viewModel/notebookOutlineDataSourceFactory.js';

// Editor Controller
import './controller/coreActions.js';
import './controller/insertCellActions.js';
import './controller/executeActions.js';
import './controller/sectionActions.js';
import './controller/layoutActions.js';
import './controller/editActions.js';
import './controller/cellOutputActions.js';
import './controller/apiActions.js';
import './controller/foldingController.js';
import './controller/chat/notebook.chat.contribution.js';
import './controller/variablesActions.js';

// Editor Contribution
import './contrib/editorHint/emptyCellEditorHint.js';
import './contrib/clipboard/notebookClipboard.js';
import './contrib/find/notebookFind.js';
import './contrib/format/formatting.js';
import './contrib/saveParticipants/saveParticipants.js';
import './contrib/gettingStarted/notebookGettingStarted.js';
import './contrib/layout/layoutActions.js';
import './contrib/marker/markerProvider.js';
import './contrib/navigation/arrow.js';
import './contrib/outline/notebookOutline.js';
import './contrib/profile/notebookProfile.js';
import './contrib/cellStatusBar/statusBarProviders.js';
import './contrib/cellStatusBar/contributedStatusBarItemController.js';
import './contrib/cellStatusBar/executionStatusBarItemController.js';
import './contrib/editorStatusBar/editorStatusBar.js';
import './contrib/undoRedo/notebookUndoRedo.js';
import './contrib/cellCommands/cellCommands.js';
import './contrib/viewportWarmup/viewportWarmup.js';
import './contrib/troubleshoot/layout.js';
import './contrib/debug/notebookBreakpoints.js';
import './contrib/debug/notebookCellPausing.js';
import './contrib/debug/notebookDebugDecorations.js';
import './contrib/execute/executionEditorProgress.js';
import './contrib/kernelDetection/notebookKernelDetection.js';
import './contrib/cellDiagnostics/cellDiagnostics.js';
import './contrib/multicursor/notebookMulticursor.js';
import './contrib/multicursor/notebookSelectionHighlight.js';
import './contrib/notebookVariables/notebookInlineVariables.js';

// Diff Editor Contribution
import './diff/notebookDiffActions.js';

// Services
import { editorOptionsRegistry } from '../../../../editor/common/config/editorOptions.js';
import { NotebookExecutionStateService } from './services/notebookExecutionStateServiceImpl.js';
import { NotebookExecutionService } from './services/notebookExecutionServiceImpl.js';
import { INotebookExecutionService } from '../common/notebookExecutionService.js';
import { INotebookKeymapService } from '../common/notebookKeymapService.js';
import { NotebookKeymapService } from './services/notebookKeymapServiceImpl.js';
import { PLAINTEXT_LANGUAGE_ID } from '../../../../editor/common/languages/modesRegistry.js';
import { INotebookExecutionStateService } from '../common/notebookExecutionStateService.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { NotebookInfo } from '../../../../editor/common/languageFeatureRegistry.js';
import { COMMENTEDITOR_DECORATION_KEY } from '../../comments/browser/commentReply.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { NotebookKernelHistoryService } from './services/notebookKernelHistoryServiceImpl.js';
import { INotebookLoggingService } from '../common/notebookLoggingService.js';
import { NotebookLoggingService } from './services/notebookLoggingServiceImpl.js';
import product from '../../../../platform/product/common/product.js';
import { NotebookVariables } from './contrib/notebookVariables/notebookVariables.js';
import { AccessibleViewRegistry } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { NotebookAccessibilityHelp } from './notebookAccessibilityHelp.js';
import { NotebookAccessibleView } from './notebookAccessibleView.js';
import { DefaultFormatter } from '../../format/browser/formatActionsMultiple.js';
import { NotebookMultiTextDiffEditor } from './diff/notebookMultiDiffEditor.js';
import { NotebookMultiDiffEditorInput } from './diff/notebookMultiDiffEditorInput.js';
import { getFormattedMetadataJSON } from '../common/model/notebookCellTextModel.js';
import { INotebookOutlineEntryFactory, NotebookOutlineEntryFactory } from './viewModel/notebookOutlineEntryFactory.js';
import { getFormattedNotebookMetadataJSON } from '../common/model/notebookMetadataTextModel.js';
import { NotebookOutputEditor } from './outputEditor/notebookOutputEditor.js';
import { NotebookOutputEditorInput } from './outputEditor/notebookOutputEditorInput.js';

/*--------------------------------------------------------------------------------------------- */

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		NotebookEditor,
		NotebookEditor.ID,
		'Notebook Editor'
	),
	[
		new SyncDescriptor(NotebookEditorInput)
	]
);

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		NotebookTextDiffEditor,
		NotebookTextDiffEditor.ID,
		'Notebook Diff Editor'
	),
	[
		new SyncDescriptor(NotebookDiffEditorInput)
	]
);

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		NotebookOutputEditor,
		NotebookOutputEditor.ID,
		'Notebook Output Editor'
	),
	[
		new SyncDescriptor(NotebookOutputEditorInput)
	]
);

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		NotebookMultiTextDiffEditor,
		NotebookMultiTextDiffEditor.ID,
		'Notebook Diff Editor'
	),
	[
		new SyncDescriptor(NotebookMultiDiffEditorInput)
	]
);

class NotebookDiffEditorSerializer implements IEditorSerializer {
	constructor(@IConfigurationService private readonly _configurationService: IConfigurationService) { }
	canSerialize(): boolean {
		return true;
	}

	serialize(input: EditorInput): string {
		assertType(input instanceof NotebookDiffEditorInput);
		return JSON.stringify({
			resource: input.resource,
			originalResource: input.original.resource,
			name: input.getName(),
			originalName: input.original.getName(),
			textDiffName: input.getName(),
			viewType: input.viewType,
		});
	}

	deserialize(instantiationService: IInstantiationService, raw: string) {
		type Data = { resource: URI; originalResource: URI; name: string; originalName: string; viewType: string; textDiffName: string | undefined; group: number };
		const data = <Data>parse(raw);
		if (!data) {
			return undefined;
		}
		const { resource, originalResource, name, viewType } = data;
		if (!data || !URI.isUri(resource) || !URI.isUri(originalResource) || typeof name !== 'string' || typeof viewType !== 'string') {
			return undefined;
		}

		if (this._configurationService.getValue('notebook.experimental.enableNewDiffEditor')) {
			return NotebookMultiDiffEditorInput.create(instantiationService, resource, name, undefined, originalResource, viewType);
		} else {
			return NotebookDiffEditorInput.create(instantiationService, resource, name, undefined, originalResource, viewType);
		}
	}

	static canResolveBackup(editorInput: EditorInput, backupResource: URI): boolean {
		return false;
	}

}
type SerializedNotebookEditorData = { resource: URI; preferredResource: URI; viewType: string; options?: NotebookEditorInputOptions };
class NotebookEditorSerializer implements IEditorSerializer {
	canSerialize(input: EditorInput): boolean {
		return input.typeId === NotebookEditorInput.ID;
	}
	serialize(input: EditorInput): string {
		assertType(input instanceof NotebookEditorInput);
		const data: SerializedNotebookEditorData = {
			resource: input.resource,
			preferredResource: input.preferredResource,
			viewType: input.viewType,
			options: input.options
		};
		return JSON.stringify(data);
	}
	deserialize(instantiationService: IInstantiationService, raw: string) {
		const data = <SerializedNotebookEditorData>parse(raw);
		if (!data) {
			return undefined;
		}
		const { resource, preferredResource, viewType, options } = data;
		if (!data || !URI.isUri(resource) || typeof viewType !== 'string') {
			return undefined;
		}

		const input = NotebookEditorInput.getOrCreate(instantiationService, resource, preferredResource, viewType, options);
		return input;
	}
}

export type SerializedNotebookOutputEditorData = { notebookUri: URI; cellIndex: number; outputIndex: number };
class NotebookOutputEditorSerializer implements IEditorSerializer {
	canSerialize(input: EditorInput): boolean {
		return input.typeId === NotebookOutputEditorInput.ID;
	}
	serialize(input: EditorInput): string | undefined {
		assertType(input instanceof NotebookOutputEditorInput);

		const data = input.getSerializedData(); // in case of cell movement etc get latest indices
		if (!data) {
			return undefined;
		}

		return JSON.stringify(data);
	}
	deserialize(instantiationService: IInstantiationService, raw: string): EditorInput | undefined {
		const data = <SerializedNotebookOutputEditorData>parse(raw);
		if (!data) {
			return undefined;
		}

		const input = instantiationService.createInstance(NotebookOutputEditorInput, data.notebookUri, data.cellIndex, undefined, data.outputIndex);
		return input;
	}
}

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(
	NotebookEditorInput.ID,
	NotebookEditorSerializer
);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(
	NotebookDiffEditorInput.ID,
	NotebookDiffEditorSerializer
);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(
	NotebookOutputEditorInput.ID,
	NotebookOutputEditorSerializer
);

export class NotebookContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.notebook';

	private _uriComparisonKeyComputer?: IDisposable;

	constructor(
		@IUndoRedoService undoRedoService: IUndoRedoService,
		@IConfigurationService configurationService: IConfigurationService,
		@ICodeEditorService private readonly codeEditorService: ICodeEditorService,
	) {
		super();

		this.updateCellUndoRedoComparisonKey(configurationService, undoRedoService);

		// Watch for changes to undoRedoPerCell setting
		this._register(configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(NotebookSetting.undoRedoPerCell)) {
				this.updateCellUndoRedoComparisonKey(configurationService, undoRedoService);
			}
		}));

		// register comment decoration
		this._register(this.codeEditorService.registerDecorationType('comment-controller', COMMENTEDITOR_DECORATION_KEY, {}));
	}

	// Add or remove the cell undo redo comparison key based on the user setting
	private updateCellUndoRedoComparisonKey(configurationService: IConfigurationService, undoRedoService: IUndoRedoService) {
		const undoRedoPerCell = configurationService.getValue<boolean>(NotebookSetting.undoRedoPerCell);

		if (!undoRedoPerCell) {
			// Add comparison key to map cell => main document
			if (!this._uriComparisonKeyComputer) {
				this._uriComparisonKeyComputer = undoRedoService.registerUriComparisonKeyComputer(CellUri.scheme, {
					getComparisonKey: (uri: URI): string => {
						if (undoRedoPerCell) {
							return uri.toString();
						}
						return NotebookContribution._getCellUndoRedoComparisonKey(uri);
					}
				});
			}
		} else {
			// Dispose comparison key
			this._uriComparisonKeyComputer?.dispose();
			this._uriComparisonKeyComputer = undefined;
		}
	}

	private static _getCellUndoRedoComparisonKey(uri: URI) {
		const data = CellUri.parse(uri);
		if (!data) {
			return uri.toString();
		}

		return data.notebook.toString();
	}

	override dispose(): void {
		super.dispose();
		this._uriComparisonKeyComputer?.dispose();
	}
}

class CellContentProvider implements ITextModelContentProvider {

	static readonly ID = 'workbench.contrib.cellContentProvider';

	private readonly _registration: IDisposable;

	constructor(
		@ITextModelService textModelService: ITextModelService,
		@IModelService private readonly _modelService: IModelService,
		@ILanguageService private readonly _languageService: ILanguageService,
		@INotebookEditorModelResolverService private readonly _notebookModelResolverService: INotebookEditorModelResolverService,
	) {
		this._registration = textModelService.registerTextModelContentProvider(CellUri.scheme, this);
	}

	dispose(): void {
		this._registration.dispose();
	}

	async provideTextContent(resource: URI): Promise<ITextModel | null> {
		const existing = this._modelService.getModel(resource);
		if (existing) {
			return existing;
		}
		const data = CellUri.parse(resource);
		// const data = parseCellUri(resource);
		if (!data) {
			return null;
		}

		const ref = await this._notebookModelResolverService.resolve(data.notebook);
		let result: ITextModel | null = null;

		if (!ref.object.isResolved()) {
			return null;
		}

		for (const cell of ref.object.notebook.cells) {
			if (cell.uri.toString() === resource.toString()) {
				const bufferFactory: ITextBufferFactory = {
					create: (defaultEOL) => {
						return { textBuffer: cell.textBuffer as ITextBuffer, disposable: Disposable.None };
					},
					getFirstLineText: (limit: number) => {
						return cell.textBuffer.getLineContent(1).substring(0, limit);
					}
				};
				const languageId = this._languageService.getLanguageIdByLanguageName(cell.language);
				const languageSelection = languageId ? this._languageService.createById(languageId) : (cell.cellKind === CellKind.Markup ? this._languageService.createById('markdown') : this._languageService.createByFilepathOrFirstLine(resource, cell.textBuffer.getLineContent(1)));
				result = this._modelService.createModel(
					bufferFactory,
					languageSelection,
					resource
				);
				break;
			}
		}

		if (!result) {
			ref.dispose();
			return null;
		}

		const once = Event.any(result.onWillDispose, ref.object.notebook.onWillDispose)(() => {
			once.dispose();
			ref.dispose();
		});

		return result;
	}
}

class CellInfoContentProvider {

	static readonly ID = 'workbench.contrib.cellInfoContentProvider';

	private readonly _disposables: IDisposable[] = [];

	constructor(
		@ITextModelService textModelService: ITextModelService,
		@IModelService private readonly _modelService: IModelService,
		@ILanguageService private readonly _languageService: ILanguageService,
		@ILabelService private readonly _labelService: ILabelService,
		@INotebookEditorModelResolverService private readonly _notebookModelResolverService: INotebookEditorModelResolverService,
	) {
		this._disposables.push(textModelService.registerTextModelContentProvider(Schemas.vscodeNotebookCellMetadata, {
			provideTextContent: this.provideMetadataTextContent.bind(this)
		}));

		this._disposables.push(textModelService.registerTextModelContentProvider(Schemas.vscodeNotebookCellOutput, {
			provideTextContent: this.provideOutputTextContent.bind(this)
		}));

		this._disposables.push(this._labelService.registerFormatter({
			scheme: Schemas.vscodeNotebookCellMetadata,
			formatting: {
				label: '${path} (metadata)',
				separator: '/'
			}
		}));

		this._disposables.push(this._labelService.registerFormatter({
			scheme: Schemas.vscodeNotebookCellOutput,
			formatting: {
				label: '${path} (output)',
				separator: '/'
			}
		}));
	}

	dispose(): void {
		dispose(this._disposables);
	}

	async provideMetadataTextContent(resource: URI): Promise<ITextModel | null> {
		const existing = this._modelService.getModel(resource);
		if (existing) {
			return existing;
		}

		const data = CellUri.parseCellPropertyUri(resource, Schemas.vscodeNotebookCellMetadata);
		if (!data) {
			return null;
		}

		const ref = await this._notebookModelResolverService.resolve(data.notebook);
		let result: ITextModel | null = null;

		const mode = this._languageService.createById('json');
		const disposables = new DisposableStore();
		for (const cell of ref.object.notebook.cells) {
			if (cell.handle === data.handle) {
				const cellIndex = ref.object.notebook.cells.indexOf(cell);
				const metadataSource = getFormattedMetadataJSON(ref.object.notebook.transientOptions.transientCellMetadata, cell.metadata, cell.language, true);
				result = this._modelService.createModel(
					metadataSource,
					mode,
					resource
				);
				this._disposables.push(disposables.add(ref.object.notebook.onDidChangeContent(e => {
					if (result && e.rawEvents.some(event => (event.kind === NotebookCellsChangeType.ChangeCellMetadata || event.kind === NotebookCellsChangeType.ChangeCellLanguage) && event.index === cellIndex)) {
						const value = getFormattedMetadataJSON(ref.object.notebook.transientOptions.transientCellMetadata, cell.metadata, cell.language, true);
						if (result.getValue() !== value) {
							result.setValue(value);
						}
					}
				})));
				break;
			}
		}

		if (!result) {
			ref.dispose();
			return null;
		}

		const once = result.onWillDispose(() => {
			disposables.dispose();
			once.dispose();
			ref.dispose();
		});

		return result;
	}

	private parseStreamOutput(op?: ICellOutput): { content: string; mode: ILanguageSelection } | undefined {
		if (!op) {
			return;
		}

		const streamOutputData = getStreamOutputData(op.outputs);
		if (streamOutputData) {
			return {
				content: streamOutputData,
				mode: this._languageService.createById(PLAINTEXT_LANGUAGE_ID)
			};
		}

		return;
	}

	private _getResult(data: {
		notebook: URI;
		outputId?: string | undefined;
	}, cell: ICell) {
		let result: { content: string; mode: ILanguageSelection } | undefined = undefined;

		const mode = this._languageService.createById('json');
		const op = cell.outputs.find(op => op.outputId === data.outputId || op.alternativeOutputId === data.outputId);
		const streamOutputData = this.parseStreamOutput(op);
		if (streamOutputData) {
			result = streamOutputData;
			return result;
		}

		const obj = cell.outputs.map(output => ({
			metadata: output.metadata,
			outputItems: output.outputs.map(opit => ({
				mimeType: opit.mime,
				data: opit.data.toString()
			}))
		}));

		const outputSource = toFormattedString(obj, {});
		result = {
			content: outputSource,
			mode
		};

		return result;
	}

	async provideOutputsTextContent(resource: URI): Promise<ITextModel | null> {
		const existing = this._modelService.getModel(resource);
		if (existing) {
			return existing;
		}

		const data = CellUri.parseCellPropertyUri(resource, Schemas.vscodeNotebookCellOutput);
		if (!data) {
			return null;
		}

		const ref = await this._notebookModelResolverService.resolve(data.notebook);
		const cell = ref.object.notebook.cells.find(cell => cell.handle === data.handle);

		if (!cell) {
			ref.dispose();
			return null;
		}

		const mode = this._languageService.createById('json');
		const model = this._modelService.createModel(getFormattedOutputJSON(cell.outputs || []), mode, resource, true);
		const cellModelListener = Event.any(cell.onDidChangeOutputs ?? Event.None, cell.onDidChangeOutputItems ?? Event.None)(() => {
			model.setValue(getFormattedOutputJSON(cell.outputs || []));
		});

		const once = model.onWillDispose(() => {
			once.dispose();
			cellModelListener.dispose();
			ref.dispose();
		});

		return model;
	}

	async provideOutputTextContent(resource: URI): Promise<ITextModel | null> {
		const existing = this._modelService.getModel(resource);
		if (existing) {
			return existing;
		}

		const data = CellUri.parseCellOutputUri(resource);
		if (!data) {
			return this.provideOutputsTextContent(resource);
		}

		const ref = await this._notebookModelResolverService.resolve(data.notebook);
		const cell = ref.object.notebook.cells.find(cell => !!cell.outputs.find(op => op.outputId === data.outputId || op.alternativeOutputId === data.outputId));

		if (!cell) {
			ref.dispose();
			return null;
		}

		const result = this._getResult(data, cell);

		if (!result) {
			ref.dispose();
			return null;
		}

		const model = this._modelService.createModel(result.content, result.mode, resource);
		const cellModelListener = Event.any(cell.onDidChangeOutputs ?? Event.None, cell.onDidChangeOutputItems ?? Event.None)(() => {
			const newResult = this._getResult(data, cell);

			if (!newResult) {
				return;
			}

			model.setValue(newResult.content);
			model.setLanguage(newResult.mode.languageId);
		});

		const once = model.onWillDispose(() => {
			once.dispose();
			cellModelListener.dispose();
			ref.dispose();
		});

		return model;
	}
}

class NotebookMetadataContentProvider {
	static readonly ID = 'workbench.contrib.notebookMetadataContentProvider';

	private readonly _disposables: IDisposable[] = [];

	constructor(
		@ITextModelService textModelService: ITextModelService,
		@IModelService private readonly _modelService: IModelService,
		@ILanguageService private readonly _languageService: ILanguageService,
		@ILabelService private readonly _labelService: ILabelService,
		@INotebookEditorModelResolverService private readonly _notebookModelResolverService: INotebookEditorModelResolverService,
	) {
		this._disposables.push(textModelService.registerTextModelContentProvider(Schemas.vscodeNotebookMetadata, {
			provideTextContent: this.provideMetadataTextContent.bind(this)
		}));

		this._disposables.push(this._labelService.registerFormatter({
			scheme: Schemas.vscodeNotebookMetadata,
			formatting: {
				label: '${path} (metadata)',
				separator: '/'
			}
		}));
	}

	dispose(): void {
		dispose(this._disposables);
	}

	async provideMetadataTextContent(resource: URI): Promise<ITextModel | null> {
		const existing = this._modelService.getModel(resource);
		if (existing) {
			return existing;
		}

		const data = NotebookMetadataUri.parse(resource);
		if (!data) {
			return null;
		}

		const ref = await this._notebookModelResolverService.resolve(data);
		let result: ITextModel | null = null;

		const mode = this._languageService.createById('json');
		const disposables = new DisposableStore();
		const metadataSource = getFormattedNotebookMetadataJSON(ref.object.notebook.transientOptions.transientDocumentMetadata, ref.object.notebook.metadata);
		result = this._modelService.createModel(
			metadataSource,
			mode,
			resource
		);

		if (!result) {
			ref.dispose();
			return null;
		}

		this._disposables.push(disposables.add(ref.object.notebook.onDidChangeContent(e => {
			if (result && e.rawEvents.some(event => (event.kind === NotebookCellsChangeType.ChangeCellContent || event.kind === NotebookCellsChangeType.ChangeDocumentMetadata || event.kind === NotebookCellsChangeType.ModelChange))) {
				const value = getFormattedNotebookMetadataJSON(ref.object.notebook.transientOptions.transientDocumentMetadata, ref.object.notebook.metadata);
				if (result.getValue() !== value) {
					result.setValue(value);
				}
			}
		})));

		const once = result.onWillDispose(() => {
			disposables.dispose();
			once.dispose();
			ref.dispose();
		});

		return result;
	}
}

class RegisterSchemasContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.registerCellSchemas';

	constructor() {
		super();
		this.registerMetadataSchemas();
	}

	private registerMetadataSchemas(): void {
		const jsonRegistry = Registry.as<IJSONContributionRegistry>(JSONExtensions.JSONContribution);
		const metadataSchema: IJSONSchema = {
			properties: {
				['language']: {
					type: 'string',
					description: 'The language for the cell'
				}
			},
			// patternProperties: allSettings.patternProperties,
			additionalProperties: true,
			allowTrailingCommas: true,
			allowComments: true
		};

		jsonRegistry.registerSchema('vscode://schemas/notebook/cellmetadata', metadataSchema);
	}
}

class NotebookEditorManager implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.notebookEditorManager';

	private readonly _disposables = new DisposableStore();

	constructor(
		@IEditorService private readonly _editorService: IEditorService,
		@INotebookEditorModelResolverService private readonly _notebookEditorModelService: INotebookEditorModelResolverService,
		@IEditorGroupsService editorGroups: IEditorGroupsService
	) {
		// OPEN notebook editor for models that have turned dirty without being visible in an editor
		type E = IResolvedNotebookEditorModel;
		this._disposables.add(Event.debounce<E, E[]>(
			this._notebookEditorModelService.onDidChangeDirty,
			(last, current) => !last ? [current] : [...last, current],
			100
		)(this._openMissingDirtyNotebookEditors, this));

		// CLOSE editors when we are about to open conflicting notebooks
		this._disposables.add(_notebookEditorModelService.onWillFailWithConflict(e => {
			for (const group of editorGroups.groups) {
				const conflictInputs = group.editors.filter(input => input instanceof NotebookEditorInput && input.viewType !== e.viewType && isEqual(input.resource, e.resource));
				const p = group.closeEditors(conflictInputs);
				e.waitUntil(p);
			}
		}));
	}

	dispose(): void {
		this._disposables.dispose();
	}

	private _openMissingDirtyNotebookEditors(models: IResolvedNotebookEditorModel[]): void {
		const result: IResourceEditorInput[] = [];
		for (const model of models) {
			if (model.isDirty() && !this._editorService.isOpened({ resource: model.resource, typeId: NotebookEditorInput.ID, editorId: model.viewType }) && extname(model.resource) !== '.interactive') {
				result.push({
					resource: model.resource,
					options: { inactive: true, preserveFocus: true, pinned: true, override: model.viewType }
				});
			}
		}
		if (result.length > 0) {
			this._editorService.openEditors(result);
		}
	}
}

class SimpleNotebookWorkingCopyEditorHandler extends Disposable implements IWorkbenchContribution, IWorkingCopyEditorHandler {

	static readonly ID = 'workbench.contrib.simpleNotebookWorkingCopyEditorHandler';

	constructor(
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IWorkingCopyEditorService private readonly _workingCopyEditorService: IWorkingCopyEditorService,
		@IExtensionService private readonly _extensionService: IExtensionService,
		@INotebookService private readonly _notebookService: INotebookService
	) {
		super();

		this._installHandler();
	}

	async handles(workingCopy: IWorkingCopyIdentifier): Promise<boolean> {
		const viewType = this.handlesSync(workingCopy);
		if (!viewType) {
			return false;
		}

		return this._notebookService.canResolve(viewType);
	}

	private handlesSync(workingCopy: IWorkingCopyIdentifier): string /* viewType */ | undefined {
		const viewType = this._getViewType(workingCopy);
		if (!viewType || viewType === 'interactive') {
			return undefined;
		}

		return viewType;
	}

	isOpen(workingCopy: IWorkingCopyIdentifier, editor: EditorInput): boolean {
		if (!this.handlesSync(workingCopy)) {
			return false;
		}

		return editor instanceof NotebookEditorInput && editor.viewType === this._getViewType(workingCopy) && isEqual(workingCopy.resource, editor.resource);
	}

	createEditor(workingCopy: IWorkingCopyIdentifier): EditorInput {
		return NotebookEditorInput.getOrCreate(this._instantiationService, workingCopy.resource, undefined, this._getViewType(workingCopy)!);
	}

	private async _installHandler(): Promise<void> {
		await this._extensionService.whenInstalledExtensionsRegistered();

		this._register(this._workingCopyEditorService.registerHandler(this));
	}

	private _getViewType(workingCopy: IWorkingCopyIdentifier) {
		const notebookType = NotebookWorkingCopyTypeIdentifier.parse(workingCopy.typeId);
		if (notebookType && notebookType.viewType === notebookType.notebookType) {
			return notebookType?.viewType;
		}
		return undefined;
	}
}

class NotebookLanguageSelectorScoreRefine {

	static readonly ID = 'workbench.contrib.notebookLanguageSelectorScoreRefine';

	constructor(
		@INotebookService private readonly _notebookService: INotebookService,
		@ILanguageFeaturesService languageFeaturesService: ILanguageFeaturesService,
	) {
		languageFeaturesService.setNotebookTypeResolver(this._getNotebookInfo.bind(this));
	}

	private _getNotebookInfo(uri: URI): NotebookInfo | undefined {
		const cellUri = CellUri.parse(uri);
		if (!cellUri) {
			return undefined;
		}
		const notebook = this._notebookService.getNotebookTextModel(cellUri.notebook);
		if (!notebook) {
			return undefined;
		}
		return {
			uri: notebook.uri,
			type: notebook.viewType
		};
	}
}

const workbenchContributionsRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
registerWorkbenchContribution2(NotebookContribution.ID, NotebookContribution, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(CellContentProvider.ID, CellContentProvider, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(CellInfoContentProvider.ID, CellInfoContentProvider, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(NotebookMetadataContentProvider.ID, NotebookMetadataContentProvider, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(RegisterSchemasContribution.ID, RegisterSchemasContribution, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(NotebookEditorManager.ID, NotebookEditorManager, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(NotebookLanguageSelectorScoreRefine.ID, NotebookLanguageSelectorScoreRefine, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(SimpleNotebookWorkingCopyEditorHandler.ID, SimpleNotebookWorkingCopyEditorHandler, WorkbenchPhase.BlockRestore);
workbenchContributionsRegistry.registerWorkbenchContribution(NotebookVariables, LifecyclePhase.Eventually);

AccessibleViewRegistry.register(new NotebookAccessibleView());
AccessibleViewRegistry.register(new NotebookAccessibilityHelp());

registerSingleton(INotebookService, NotebookService, InstantiationType.Delayed);
registerSingleton(INotebookEditorWorkerService, NotebookEditorWorkerServiceImpl, InstantiationType.Delayed);
registerSingleton(INotebookEditorModelResolverService, NotebookModelResolverServiceImpl, InstantiationType.Delayed);
registerSingleton(INotebookCellStatusBarService, NotebookCellStatusBarService, InstantiationType.Delayed);
registerSingleton(INotebookEditorService, NotebookEditorWidgetService, InstantiationType.Delayed);
registerSingleton(INotebookKernelService, NotebookKernelService, InstantiationType.Delayed);
registerSingleton(INotebookKernelHistoryService, NotebookKernelHistoryService, InstantiationType.Delayed);
registerSingleton(INotebookExecutionService, NotebookExecutionService, InstantiationType.Delayed);
registerSingleton(INotebookExecutionStateService, NotebookExecutionStateService, InstantiationType.Delayed);
registerSingleton(INotebookRendererMessagingService, NotebookRendererMessagingService, InstantiationType.Delayed);
registerSingleton(INotebookKeymapService, NotebookKeymapService, InstantiationType.Delayed);
registerSingleton(INotebookLoggingService, NotebookLoggingService, InstantiationType.Delayed);
registerSingleton(INotebookCellOutlineDataSourceFactory, NotebookCellOutlineDataSourceFactory, InstantiationType.Delayed);
registerSingleton(INotebookOutlineEntryFactory, NotebookOutlineEntryFactory, InstantiationType.Delayed);

const schemas: IJSONSchemaMap = {};
function isConfigurationPropertySchema(x: IConfigurationPropertySchema | { [path: string]: IConfigurationPropertySchema }): x is IConfigurationPropertySchema {
	return (typeof x.type !== 'undefined' || typeof x.anyOf !== 'undefined');
}
for (const editorOption of editorOptionsRegistry) {
	const schema = editorOption.schema;
	if (schema) {
		if (isConfigurationPropertySchema(schema)) {
			schemas[`editor.${editorOption.name}`] = schema;
		} else {
			for (const key in schema) {
				if (Object.hasOwnProperty.call(schema, key)) {
					schemas[key] = schema[key];
				}
			}
		}
	}
}

const editorOptionsCustomizationSchema: IConfigurationPropertySchema = {
	description: nls.localize('notebook.editorOptions.experimentalCustomization', "笔记本中使用的代码编辑器设置。可用于自定义大多数 editor.* 设置。"),
	default: {},
	allOf: [
		{
			properties: schemas,
		}
		// , {
		// 	patternProperties: {
		// 		'^\\[.*\\]$': {
		// 			type: 'object',
		// 			default: {},
		// 			properties: schemas
		// 		}
		// 	}
		// }
	],
	tags: ['notebookLayout']
};

const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
configurationRegistry.registerConfiguration({
	id: 'notebook',
	order: 100,
	title: nls.localize('notebookConfigurationTitle', "笔记本"),
	type: 'object',
	properties: {
		[NotebookSetting.displayOrder]: {
			description: nls.localize('notebook.displayOrder.description', "输出 MIME 类型的优先级列表"),
			type: 'array',
			items: {
				type: 'string'
			},
			default: []
		},
		[NotebookSetting.cellToolbarLocation]: {
			description: nls.localize('notebook.cellToolbarLocation.description', "单元格工具栏显示的位置，或是否隐藏。"),
			type: 'object',
			additionalProperties: {
				markdownDescription: nls.localize('notebook.cellToolbarLocation.viewType', "为特定文件类型配置单元格工具栏位置"),
				type: 'string',
				enum: ['left', 'right', 'hidden']
			},
			default: {
				'default': 'right'
			},
			tags: ['notebookLayout']
		},
		[NotebookSetting.showCellStatusBar]: {
			description: nls.localize('notebook.showCellStatusbar.description', "是否显示单元格状态栏。"),
			type: 'string',
			enum: ['hidden', 'visible', 'visibleAfterExecute'],
			enumDescriptions: [
				nls.localize('notebook.showCellStatusbar.hidden.description', "单元格状态栏始终隐藏。"),
				nls.localize('notebook.showCellStatusbar.visible.description', "单元格状态栏始终可见。"),
				nls.localize('notebook.showCellStatusbar.visibleAfterExecute.description', "单元格状态栏在执行前保持隐藏，执行后显示以呈现执行状态。")],
			default: 'visible',
			tags: ['notebookLayout']
		},
		[NotebookSetting.cellExecutionTimeVerbosity]: {
			description: nls.localize('notebook.cellExecutionTimeVerbosity.description', "控制单元格状态栏中执行时间信息的详细程度。"),
			type: 'string',
			enum: ['default', 'verbose'],
			enumDescriptions: [
				nls.localize('notebook.cellExecutionTimeVerbosity.default.description', "显示单元格执行耗时，悬停提示中提供高级信息。"),
				nls.localize('notebook.cellExecutionTimeVerbosity.verbose.description', "显示单元格上次执行的时间和耗时，悬停提示中提供高级信息。")],
			default: 'default',
			tags: ['notebookLayout']
		},
		[NotebookSetting.textDiffEditorPreview]: {
			description: nls.localize('notebook.diff.enablePreview.description', "是否为笔记本使用增强型文本差异编辑器。"),
			type: 'boolean',
			default: true,
			tags: ['notebookLayout']
		},
		[NotebookSetting.diffOverviewRuler]: {
			description: nls.localize('notebook.diff.enableOverviewRuler.description', "是否在笔记本差异编辑器中呈现概览标尺。"),
			type: 'boolean',
			default: false,
			tags: ['notebookLayout']
		},
		[NotebookSetting.cellToolbarVisibility]: {
			markdownDescription: nls.localize('notebook.cellToolbarVisibility.description', "单元格工具栏在悬停时还是单击时出现。"),
			type: 'string',
			enum: ['hover', 'click'],
			default: 'click',
			tags: ['notebookLayout']
		},
		[NotebookSetting.undoRedoPerCell]: {
			description: nls.localize('notebook.undoRedoPerCell.description', "是否为每个单元格使用独立的撤销/重做栈。"),
			type: 'boolean',
			default: true,
			tags: ['notebookLayout']
		},
		[NotebookSetting.compactView]: {
			description: nls.localize('notebook.compactView.description', "控制是否以紧凑形式呈现笔记本编辑器。例如启用后会减小左侧边距宽度。"),
			type: 'boolean',
			default: true,
			tags: ['notebookLayout']
		},
		[NotebookSetting.focusIndicator]: {
			description: nls.localize('notebook.focusIndicator.description', "控制焦点指示器的呈现位置：沿单元格边框，或位于左侧装订线。"),
			type: 'string',
			enum: ['border', 'gutter'],
			default: 'gutter',
			tags: ['notebookLayout']
		},
		[NotebookSetting.insertToolbarLocation]: {
			description: nls.localize('notebook.insertToolbarPosition.description', "控制插入单元格操作的出现位置。"),
			type: 'string',
			enum: ['betweenCells', 'notebookToolbar', 'both', 'hidden'],
			enumDescriptions: [
				nls.localize('insertToolbarLocation.betweenCells', "在单元格之间悬停时出现的工具栏。"),
				nls.localize('insertToolbarLocation.notebookToolbar', "笔记本编辑器顶部的工具栏。"),
				nls.localize('insertToolbarLocation.both', "两个工具栏都显示。"),
				nls.localize('insertToolbarLocation.hidden', "任何位置都不显示插入操作。"),
			],
			default: 'both',
			tags: ['notebookLayout']
		},
		[NotebookSetting.globalToolbar]: {
			description: nls.localize('notebook.globalToolbar.description', "控制是否在笔记本编辑器内呈现全局工具栏。"),
			type: 'boolean',
			default: true,
			tags: ['notebookLayout']
		},
		[NotebookSetting.stickyScrollEnabled]: {
			description: nls.localize('notebook.stickyScrollEnabled.description', "实验性功能。控制是否在笔记本编辑器中呈现粘性滚动标题。"),
			type: 'boolean',
			default: false,
			tags: ['notebookLayout']
		},
		[NotebookSetting.stickyScrollMode]: {
			description: nls.localize('notebook.stickyScrollMode.description', "控制嵌套粘性行是平铺显示还是缩进显示。"),
			type: 'string',
			enum: ['flat', 'indented'],
			enumDescriptions: [
				nls.localize('notebook.stickyScrollMode.flat', "嵌套粘性行平铺显示。"),
				nls.localize('notebook.stickyScrollMode.indented', "嵌套粘性行缩进显示。"),
			],
			default: 'indented',
			tags: ['notebookLayout']
		},
		[NotebookSetting.consolidatedOutputButton]: {
			description: nls.localize('notebook.consolidatedOutputButton.description', "控制是否在输出工具栏中呈现输出操作。"),
			type: 'boolean',
			default: true,
			tags: ['notebookLayout']
		},
		[NotebookSetting.showFoldingControls]: {
			description: nls.localize('notebook.showFoldingControls.description', "控制何时显示 Markdown 标题折叠箭头。"),
			type: 'string',
			enum: ['always', 'never', 'mouseover'],
			enumDescriptions: [
				nls.localize('showFoldingControls.always', "折叠控件始终可见。"),
				nls.localize('showFoldingControls.never', "从不显示折叠控件，并缩小装订线宽度。"),
				nls.localize('showFoldingControls.mouseover', "仅在鼠标悬停时显示折叠控件。"),
			],
			default: 'mouseover',
			tags: ['notebookLayout']
		},
		[NotebookSetting.dragAndDropEnabled]: {
			description: nls.localize('notebook.dragAndDrop.description', "控制笔记本编辑器是否允许通过拖放移动单元格。"),
			type: 'boolean',
			default: true,
			tags: ['notebookLayout']
		},
		[NotebookSetting.consolidatedRunButton]: {
			description: nls.localize('notebook.consolidatedRunButton.description', "控制运行按钮旁的下拉菜单中是否显示额外操作。"),
			type: 'boolean',
			default: false,
			tags: ['notebookLayout']
		},
		[NotebookSetting.globalToolbarShowLabel]: {
			description: nls.localize('notebook.globalToolbarShowLabel', "控制笔记本工具栏上的操作是否渲染标签。"),
			type: 'string',
			enum: ['always', 'never', 'dynamic'],
			default: 'always',
			tags: ['notebookLayout']
		},
		[NotebookSetting.textOutputLineLimit]: {
			markdownDescription: nls.localize('notebook.textOutputLineLimit', "控制文本输出中显示的行数。若启用 {0}，该设置用于确定输出的滚动高度。", '`#notebook.output.scrolling#`'),
			type: 'number',
			default: 30,
			tags: ['notebookLayout', 'notebookOutputLayout'],
			minimum: 1,
		},
		[NotebookSetting.LinkifyOutputFilePaths]: {
			description: nls.localize('notebook.disableOutputFilePathLinks', "控制是否禁用笔记本单元格输出中的文件路径链接。"),
			type: 'boolean',
			default: true,
			tags: ['notebookOutputLayout']
		},
		[NotebookSetting.minimalErrorRendering]: {
			description: nls.localize('notebook.minimalErrorRendering', "控制是否以最简样式呈现错误输出。"),
			type: 'boolean',
			default: false,
			tags: ['notebookOutputLayout']
		},
		[NotebookSetting.markupFontSize]: {
			markdownDescription: nls.localize('notebook.markup.fontSize', "控制笔记本中呈现的标记内容的字号（像素）。设为 {0} 时使用 {1} 的 120%。", '`0`', '`#editor.fontSize#`'),
			type: 'number',
			default: 0,
			tags: ['notebookLayout']
		},
		[NotebookSetting.markdownLineHeight]: {
			markdownDescription: nls.localize('notebook.markdown.lineHeight', "控制笔记本中 Markdown 单元格的行高（像素）。设为 {0} 时将使用 {1}", '`0`', '`normal`'),
			type: 'number',
			default: 0,
			tags: ['notebookLayout']
		},
		[NotebookSetting.cellEditorOptionsCustomizations]: editorOptionsCustomizationSchema,
		[NotebookSetting.interactiveWindowCollapseCodeCells]: {
			markdownDescription: nls.localize('notebook.interactiveWindow.collapseCodeCells', "控制交互式窗口中的代码单元格是否默认折叠。"),
			type: 'string',
			enum: ['always', 'never', 'fromEditor'],
			default: 'fromEditor'
		},
		[NotebookSetting.outputLineHeight]: {
			markdownDescription: nls.localize('notebook.outputLineHeight', "笔记本单元格内输出文本的行高。\r\n - 设置为 0 时，使用编辑器行高。\r\n - 介于 0 和 8 之间的值将用作字号的乘数。\r\n - 大于或等于 8 的值将用作有效值。"),
			type: 'number',
			default: 0,
			tags: ['notebookLayout', 'notebookOutputLayout']
		},
		[NotebookSetting.outputFontSize]: {
			markdownDescription: nls.localize('notebook.outputFontSize', "笔记本单元格内输出文本的字号。设为 0 时使用 {0}。", '`#editor.fontSize#`'),
			type: 'number',
			default: 0,
			tags: ['notebookLayout', 'notebookOutputLayout']
		},
		[NotebookSetting.outputFontFamily]: {
			markdownDescription: nls.localize('notebook.outputFontFamily', "笔记本单元格内输出文本的字体。留空时使用 {0}。", '`#editor.fontFamily#`'),
			type: 'string',
			tags: ['notebookLayout', 'notebookOutputLayout']
		},
		[NotebookSetting.outputScrolling]: {
			markdownDescription: nls.localize('notebook.outputScrolling', "当笔记本输出超过限制时，初始在可滚动区域内呈现。"),
			type: 'boolean',
			tags: ['notebookLayout', 'notebookOutputLayout'],
			default: typeof product.quality === 'string' && product.quality !== 'stable' // only enable as default in insiders
		},
		[NotebookSetting.outputWordWrap]: {
			markdownDescription: nls.localize('notebook.outputWordWrap', "控制输出中的行是否换行。"),
			type: 'boolean',
			tags: ['notebookLayout', 'notebookOutputLayout'],
			default: false
		},
		[NotebookSetting.defaultFormatter]: {
			description: nls.localize('notebookFormatter.default', "定义默认的笔记本格式化程序，其优先级高于所有其他格式化设置。必须是提供格式化程序的扩展的标识符。"),
			type: ['string', 'null'],
			default: null,
			enum: DefaultFormatter.extensionIds,
			enumItemLabels: DefaultFormatter.extensionItemLabels,
			markdownEnumDescriptions: DefaultFormatter.extensionDescriptions
		},
		[NotebookSetting.formatOnSave]: {
			markdownDescription: nls.localize('notebook.formatOnSave', "保存时格式化笔记本。必须存在可用的格式化程序，且编辑器不处于关闭过程中。当 {0} 设为 `afterDelay` 时，仅在显式保存时才会格式化文件。", '`#files.autoSave#`'),
			type: 'boolean',
			tags: ['notebookLayout'],
			default: false
		},
		[NotebookSetting.insertFinalNewline]: {
			markdownDescription: nls.localize('notebook.insertFinalNewline', "启用后，保存笔记本时在代码单元格末尾插入一个换行符。"),
			type: 'boolean',
			tags: ['notebookLayout'],
			default: false
		},
		[NotebookSetting.formatOnCellExecution]: {
			markdownDescription: nls.localize('notebook.formatOnCellExecution', "执行时格式化笔记本单元格。必须存在可用的格式化程序。"),
			type: 'boolean',
			default: false
		},
		[NotebookSetting.confirmDeleteRunningCell]: {
			markdownDescription: nls.localize('notebook.confirmDeleteRunningCell', "控制删除正在运行的单元格时是否需要确认提示。"),
			type: 'boolean',
			default: true
		},
		[NotebookSetting.findFilters]: {
			markdownDescription: nls.localize('notebook.findFilters', "自定义用于在笔记本单元格中搜索的“查找小组件”行为。启用标记源和标记预览后，“查找小组件”将根据单元格的当前状态搜索源代码或预览。"),
			type: 'object',
			properties: {
				markupSource: {
					type: 'boolean',
					default: true
				},
				markupPreview: {
					type: 'boolean',
					default: true
				},
				codeSource: {
					type: 'boolean',
					default: true
				},
				codeOutput: {
					type: 'boolean',
					default: true
				}
			},
			default: {
				markupSource: true,
				markupPreview: true,
				codeSource: true,
				codeOutput: true
			},
			tags: ['notebookLayout']
		},
		[NotebookSetting.remoteSaving]: {
			markdownDescription: nls.localize('notebook.remoteSaving', "支持在进程之间和跨远程连接增量保存笔记本。启用后，只有对笔记本进行的更改才会发送到扩展主机，以提高大型笔记本和慢速网络连接的性能。"),
			type: 'boolean',
			default: typeof product.quality === 'string' && product.quality !== 'stable', // only enable as default in insiders
			tags: ['experimental']
		},
		[NotebookSetting.scrollToRevealCell]: {
			markdownDescription: nls.localize('notebook.scrolling.revealNextCellOnExecute.description', "运行 {0} 时显示下一个单元格需要滚动多远。", 'notebook.cell.executeAndSelectBelow'),
			type: 'string',
			enum: ['fullCell', 'firstLine', 'none'],
			markdownEnumDescriptions: [
				nls.localize('notebook.scrolling.revealNextCellOnExecute.fullCell.description', "滚动以完整显示下一个单元格。"),
				nls.localize('notebook.scrolling.revealNextCellOnExecute.firstLine.description', "滚动以显示下一个单元格的第一行。"),
				nls.localize('notebook.scrolling.revealNextCellOnExecute.none.description', "不滚动。"),
			],
			default: 'fullCell'
		},
		[NotebookSetting.cellGenerate]: {
			markdownDescription: nls.localize('notebook.cellGenerate', "启用实验性的生成操作，以创建启用了内联聊天的代码单元格。"),
			type: 'boolean',
			default: true
		},
		[NotebookSetting.notebookVariablesView]: {
			markdownDescription: nls.localize('notebook.VariablesView.description', "在调试面板中启用实验性的笔记本变量视图。"),
			type: 'boolean',
			default: false
		},
		[NotebookSetting.notebookInlineValues]: {
			markdownDescription: nls.localize('notebook.inlineValues.description', "控制在单元格执行后是否在笔记本代码单元格中显示内联值。值将保留，直到单元格通过“清除所有输出”工具栏按钮或“笔记本： 清除内联值”命令进行编辑、重新执行或显式清除为止。"),
			type: 'string',
			enum: ['on', 'auto', 'off'],
			enumDescriptions: [
				nls.localize('notebook.inlineValues.on', "始终显示内联值；若未注册内联值提供程序，则回退使用正则表达式。注意：在较大的单元格中使用回退方案可能会影响性能。"),
				nls.localize('notebook.inlineValues.auto', "仅在已注册内联值提供程序时显示内联值。"),
				nls.localize('notebook.inlineValues.off', "从不显示内联值。"),
			],
			default: 'off'
		},
		[NotebookSetting.cellFailureDiagnostics]: {
			markdownDescription: nls.localize('notebook.cellFailureDiagnostics', "显示单元格失败时可用的诊断信息。"),
			type: 'boolean',
			default: true
		},
		[NotebookSetting.outputBackupSizeLimit]: {
			markdownDescription: nls.localize('notebook.backup.sizeLimit', "笔记本输出大小的上限（千字节 KB），超过该值后将不再为热重载备份笔记本文件。设为 0 表示不限制。"),
			type: 'number',
			default: 10000
		},
		[NotebookSetting.multiCursor]: {
			markdownDescription: nls.localize('notebook.multiCursor.enabled', "实验性。在笔记本编辑器的多个单元格中启用一组有限的多光标控件。当前支持核心编辑器操作(键入/剪切/复制/粘贴/合成)和编辑器命令的有限子集。"),
			type: 'boolean',
			default: false
		},
		[NotebookSetting.markupFontFamily]: {
			markdownDescription: nls.localize('notebook.markup.fontFamily', "控制笔记本中呈现的标记内容的字体。留空时将回退到默认的工作台字体。"),
			type: 'string',
			default: '',
			tags: ['notebookLayout']
		}
	}
});
