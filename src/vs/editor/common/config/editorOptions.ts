/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as arrays from '../../../base/common/arrays.js';
import { IMarkdownString } from '../../../base/common/htmlContent.js';
import { IJSONSchema } from '../../../base/common/jsonSchema.js';
import * as objects from '../../../base/common/objects.js';
import * as platform from '../../../base/common/platform.js';
import { ScrollbarVisibility } from '../../../base/common/scrollable.js';
import { Constants } from '../../../base/common/uint.js';
import { EDITOR_FONT_DEFAULTS, FONT_VARIATION_OFF, FONT_VARIATION_TRANSLATE, FontInfo } from './fontInfo.js';
import { EDITOR_MODEL_DEFAULTS } from '../core/misc/textModelDefaults.js';
import { USUAL_WORD_SEPARATORS } from '../core/wordHelper.js';
import * as nls from '../../../nls.js';
import { AccessibilitySupport } from '../../../platform/accessibility/common/accessibility.js';
import { IConfigurationPropertySchema } from '../../../platform/configuration/common/configurationRegistry.js';

//#region typed options

/**
 * Configuration options for auto closing quotes and brackets
 */
export type EditorAutoClosingStrategy = 'always' | 'languageDefined' | 'beforeWhitespace' | 'never';

/**
 * Configuration options for auto wrapping quotes and brackets
 */
export type EditorAutoSurroundStrategy = 'languageDefined' | 'quotes' | 'brackets' | 'never';

/**
 * Configuration options for typing over closing quotes or brackets
 */
export type EditorAutoClosingEditStrategy = 'always' | 'auto' | 'never';

type Unknown<T> = { [K in keyof T]: unknown };

/**
 * Configuration options for auto indentation in the editor
 */
export const enum EditorAutoIndentStrategy {
	None = 0,
	Keep = 1,
	Brackets = 2,
	Advanced = 3,
	Full = 4
}

/**
 * Configuration options for the editor.
 */
export interface IEditorOptions {
	/**
	 * This editor is used inside a diff editor.
	 */
	inDiffEditor?: boolean;
	/**
	 * This editor is allowed to use variable line heights.
	 */
	allowVariableLineHeights?: boolean;
	/**
	 * This editor is allowed to use variable font-sizes and font-families
	 */
	allowVariableFonts?: boolean;
	/**
	 * This editor is allowed to use variable font-sizes and font-families in accessibility mode
	 */
	allowVariableFontsInAccessibilityMode?: boolean;
	/**
	 * The aria label for the editor's textarea (when it is focused).
	 */
	ariaLabel?: string;

	/**
	 * Whether the aria-required attribute should be set on the editors textarea.
	 */
	ariaRequired?: boolean;
	/**
	 * Control whether a screen reader announces inline suggestion content immediately.
	 */
	screenReaderAnnounceInlineSuggestion?: boolean;
	/**
	 * The `tabindex` property of the editor's textarea
	 */
	tabIndex?: number;
	/**
	 * Render vertical lines at the specified columns.
	 * Defaults to empty array.
	 */
	rulers?: (number | IRulerOption)[];
	/**
	 * Locales used for segmenting lines into words when doing word related navigations or operations.
	 *
	 * Specify the BCP 47 language tag of the word you wish to recognize (e.g., ja, zh-CN, zh-Hant-TW, etc.).
	 * Defaults to empty array
	 */
	wordSegmenterLocales?: string | string[];
	/**
	 * A string containing the word separators used when doing word navigation.
	 * Defaults to `~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?
	 */
	wordSeparators?: string;
	/**
	 * Enable Linux primary clipboard.
	 * Defaults to true.
	 */
	selectionClipboard?: boolean;
	/**
	 * Control the rendering of line numbers.
	 * If it is a function, it will be invoked when rendering a line number and the return value will be rendered.
	 * Otherwise, if it is a truthy, line numbers will be rendered normally (equivalent of using an identity function).
	 * Otherwise, line numbers will not be rendered.
	 * Defaults to `on`.
	 */
	lineNumbers?: LineNumbersType;
	/**
	 * Controls the minimal number of visible leading and trailing lines surrounding the cursor.
	 * Defaults to 0.
	*/
	cursorSurroundingLines?: number;
	/**
	 * Controls when `cursorSurroundingLines` should be enforced
	 * Defaults to `default`, `cursorSurroundingLines` is not enforced when cursor position is changed
	 * by mouse.
	*/
	cursorSurroundingLinesStyle?: 'default' | 'all';
	/**
	 * Render last line number when the file ends with a newline.
	 * Defaults to 'on' for Windows and macOS and 'dimmed' for Linux.
	*/
	renderFinalNewline?: 'on' | 'off' | 'dimmed';
	/**
	 * Remove unusual line terminators like LINE SEPARATOR (LS), PARAGRAPH SEPARATOR (PS).
	 * Defaults to 'prompt'.
	 */
	unusualLineTerminators?: 'auto' | 'off' | 'prompt';
	/**
	 * Should the corresponding line be selected when clicking on the line number?
	 * Defaults to true.
	 */
	selectOnLineNumbers?: boolean;
	/**
	 * Control the width of line numbers, by reserving horizontal space for rendering at least an amount of digits.
	 * Defaults to 5.
	 */
	lineNumbersMinChars?: number;
	/**
	 * Enable the rendering of the glyph margin.
	 * Defaults to true in vscode and to false in monaco-editor.
	 */
	glyphMargin?: boolean;
	/**
	 * The width reserved for line decorations (in px).
	 * Line decorations are placed between line numbers and the editor content.
	 * You can pass in a string in the format floating point followed by "ch". e.g. 1.3ch.
	 * Defaults to 10.
	 */
	lineDecorationsWidth?: number | string;
	/**
	 * When revealing the cursor, a virtual padding (px) is added to the cursor, turning it into a rectangle.
	 * This virtual padding ensures that the cursor gets revealed before hitting the edge of the viewport.
	 * Defaults to 30 (px).
	 */
	revealHorizontalRightPadding?: number;
	/**
	 * Render the editor selection with rounded borders.
	 * Defaults to true.
	 */
	roundedSelection?: boolean;
	/**
	 * Class name to be added to the editor.
	 */
	extraEditorClassName?: string;
	/**
	 * Should the editor be read only. See also `domReadOnly`.
	 * Defaults to false.
	 */
	readOnly?: boolean;
	/**
	 * The message to display when the editor is readonly.
	 */
	readOnlyMessage?: IMarkdownString;
	/**
	 * Should the textarea used for input use the DOM `readonly` attribute.
	 * Defaults to false.
	 */
	domReadOnly?: boolean;
	/**
	 * Enable linked editing.
	 * Defaults to false.
	 */
	linkedEditing?: boolean;
	/**
	 * deprecated, use linkedEditing instead
	 */
	renameOnType?: boolean;
	/**
	 * Should the editor render validation decorations.
	 * Defaults to editable.
	 */
	renderValidationDecorations?: 'editable' | 'on' | 'off';
	/**
	 * Control the behavior and rendering of the scrollbars.
	 */
	scrollbar?: IEditorScrollbarOptions;
	/**
	 * Control the behavior of sticky scroll options
	 */
	stickyScroll?: IEditorStickyScrollOptions;
	/**
	 * Control the behavior and rendering of the minimap.
	 */
	minimap?: IEditorMinimapOptions;
	/**
	 * Control the behavior of the find widget.
	 */
	find?: IEditorFindOptions;
	/**
	 * Display overflow widgets as `fixed`.
	 * Defaults to `false`.
	 */
	fixedOverflowWidgets?: boolean;
	/**
	 * Allow content widgets and overflow widgets to overflow the editor viewport.
	 * Defaults to `true`.
	 */
	allowOverflow?: boolean;
	/**
	 * The number of vertical lanes the overview ruler should render.
	 * Defaults to 3.
	 */
	overviewRulerLanes?: number;
	/**
	 * Controls if a border should be drawn around the overview ruler.
	 * Defaults to `true`.
	 */
	overviewRulerBorder?: boolean;
	/**
	 * Control the cursor animation style, possible values are 'blink', 'smooth', 'phase', 'expand' and 'solid'.
	 * Defaults to 'blink'.
	 */
	cursorBlinking?: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid';
	/**
	 * Zoom the font in the editor when using the mouse wheel in combination with holding Ctrl.
	 * Defaults to false.
	 */
	mouseWheelZoom?: boolean;
	/**
	 * Control the mouse pointer style, either 'text' or 'default' or 'copy'
	 * Defaults to 'text'
	 */
	mouseStyle?: 'text' | 'default' | 'copy';
	/**
	 * Enable smooth caret animation.
	 * Defaults to 'off'.
	 */
	cursorSmoothCaretAnimation?: 'off' | 'explicit' | 'on';
	/**
	 * Control the cursor style in insert mode.
	 * Defaults to 'line'.
	 */
	cursorStyle?: 'line' | 'block' | 'underline' | 'line-thin' | 'block-outline' | 'underline-thin';
	/**
	 * Control the cursor style in overtype mode.
	 * Defaults to 'block'.
	 */
	overtypeCursorStyle?: 'line' | 'block' | 'underline' | 'line-thin' | 'block-outline' | 'underline-thin';
	/**
	 *  Controls whether paste in overtype mode should overwrite or insert.
	 */
	overtypeOnPaste?: boolean;
	/**
	 * Control the width of the cursor when cursorStyle is set to 'line'
	 */
	cursorWidth?: number;
	/**
	 * Control the height of the cursor when cursorStyle is set to 'line'
	 */
	cursorHeight?: number;
	/**
	 * Enable font ligatures.
	 * Defaults to false.
	 */
	fontLigatures?: boolean | string;
	/**
	 * Enable font variations.
	 * Defaults to false.
	 */
	fontVariations?: boolean | string;
	/**
	 * Controls whether to use default color decorations or not using the default document color provider
	 */
	defaultColorDecorators?: 'auto' | 'always' | 'never';
	/**
	 * Disable the use of `transform: translate3d(0px, 0px, 0px)` for the editor margin and lines layers.
	 * The usage of `transform: translate3d(0px, 0px, 0px)` acts as a hint for browsers to create an extra layer.
	 * Defaults to false.
	 */
	disableLayerHinting?: boolean;
	/**
	 * Disable the optimizations for monospace fonts.
	 * Defaults to false.
	 */
	disableMonospaceOptimizations?: boolean;
	/**
	 * Should the cursor be hidden in the overview ruler.
	 * Defaults to false.
	 */
	hideCursorInOverviewRuler?: boolean;
	/**
	 * Enable that scrolling can go one screen size after the last line.
	 * Defaults to true.
	 */
	scrollBeyondLastLine?: boolean;
	/**
	 * Scroll editor on middle click
	 */
	scrollOnMiddleClick?: boolean;
	/**
	 * Enable that scrolling can go beyond the last column by a number of columns.
	 * Defaults to 5.
	 */
	scrollBeyondLastColumn?: number;
	/**
	 * Enable that the editor animates scrolling to a position.
	 * Defaults to false.
	 */
	smoothScrolling?: boolean;
	/**
	 * Enable that the editor will install a ResizeObserver to check if its container dom node size has changed.
	 * Defaults to false.
	 */
	automaticLayout?: boolean;
	/**
	 * Control the wrapping of the editor.
	 * When `wordWrap` = "off", the lines will never wrap.
	 * When `wordWrap` = "on", the lines will wrap at the viewport width.
	 * When `wordWrap` = "wordWrapColumn", the lines will wrap at `wordWrapColumn`.
	 * When `wordWrap` = "bounded", the lines will wrap at min(viewport width, wordWrapColumn).
	 * Defaults to "off".
	 */
	wordWrap?: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
	/**
	 * Control whether an indicator is rendered at the wrapping column of soft wrapped lines.
	 * Defaults to false.
	 */
	wordWrapIndicator?: boolean;
	/**
	 * Override the `wordWrap` setting.
	 */
	wordWrapOverride1?: 'off' | 'on' | 'inherit';
	/**
	 * Override the `wordWrapOverride1` setting.
	 */
	wordWrapOverride2?: 'off' | 'on' | 'inherit';
	/**
	 * Control the wrapping of the editor.
	 * When `wordWrap` = "off", the lines will never wrap.
	 * When `wordWrap` = "on", the lines will wrap at the viewport width.
	 * When `wordWrap` = "wordWrapColumn", the lines will wrap at `wordWrapColumn`.
	 * When `wordWrap` = "bounded", the lines will wrap at min(viewport width, wordWrapColumn).
	 * Defaults to 80.
	 */
	wordWrapColumn?: number;
	/**
	 * Control indentation of wrapped lines. Can be: 'none', 'same', 'indent' or 'deepIndent'.
	 * Defaults to 'same' in vscode and to 'none' in monaco-editor.
	 */
	wrappingIndent?: 'none' | 'same' | 'indent' | 'deepIndent';
	/**
	 * Controls the wrapping strategy to use.
	 * Defaults to 'simple'.
	 */
	wrappingStrategy?: 'simple' | 'advanced';
	/**
	 * Create a softwrap on every quoted "\n" literal.
	 * Defaults to false.
	 */
	wrapOnEscapedLineFeeds?: boolean;
	/**
	 * Configure word wrapping characters. A break will be introduced before these characters.
	 */
	wordWrapBreakBeforeCharacters?: string;
	/**
	 * Configure word wrapping characters. A break will be introduced after these characters.
	 */
	wordWrapBreakAfterCharacters?: string;
	/**
	 * Sets whether line breaks appear wherever the text would otherwise overflow its content box.
	 * When wordBreak = 'normal', Use the default line break rule.
	 * When wordBreak = 'keepAll', Word breaks should not be used for Chinese/Japanese/Korean (CJK) text. Non-CJK text behavior is the same as for normal.
	 */
	wordBreak?: 'normal' | 'keepAll';
	/**
	 * Performance guard: Stop rendering a line after x characters.
	 * Defaults to 10000.
	 * Use -1 to never stop rendering
	 */
	stopRenderingLineAfter?: number;
	/**
	 * Configure the editor's hover.
	 */
	hover?: IEditorHoverOptions;
	/**
	 * Enable detecting links and making them clickable.
	 * Defaults to true.
	 */
	links?: boolean;
	/**
	 * Enable inline color decorators and color picker rendering.
	 */
	colorDecorators?: boolean;
	/**
	 * Controls what is the condition to spawn a color picker from a color dectorator
	 */
	colorDecoratorsActivatedOn?: 'clickAndHover' | 'click' | 'hover';
	/**
	 * Controls the max number of color decorators that can be rendered in an editor at once.
	 */
	colorDecoratorsLimit?: number;
	/**
	 * Control the behaviour of comments in the editor.
	 */
	comments?: IEditorCommentsOptions;
	/**
	 * Enable custom contextmenu.
	 * Defaults to true.
	 */
	contextmenu?: boolean;
	/**
	 * A multiplier to be used on the `deltaX` and `deltaY` of mouse wheel scroll events.
	 * Defaults to 1.
	 */
	mouseWheelScrollSensitivity?: number;
	/**
	 * FastScrolling mulitplier speed when pressing `Alt`
	 * Defaults to 5.
	 */
	fastScrollSensitivity?: number;
	/**
	 * Enable that the editor scrolls only the predominant axis. Prevents horizontal drift when scrolling vertically on a trackpad.
	 * Defaults to true.
	 */
	scrollPredominantAxis?: boolean;
	/**
	 * Make scrolling inertial - mostly useful with touchpad on linux.
	 */
	inertialScroll?: boolean;
	/**
	 * Enable that the selection with the mouse and keys is doing column selection.
	 * Defaults to false.
	 */
	columnSelection?: boolean;
	/**
	 * The modifier to be used to add multiple cursors with the mouse.
	 * Defaults to 'alt'
	 */
	multiCursorModifier?: 'ctrlCmd' | 'alt';
	/**
	 * Merge overlapping selections.
	 * Defaults to true
	 */
	multiCursorMergeOverlapping?: boolean;
	/**
	 * Configure the behaviour when pasting a text with the line count equal to the cursor count.
	 * Defaults to 'spread'.
	 */
	multiCursorPaste?: 'spread' | 'full';
	/**
	 * Controls the max number of text cursors that can be in an active editor at once.
	 */
	multiCursorLimit?: number;
	/**
	 * Enables middle mouse button to open links and Go To Definition
	 */
	mouseMiddleClickAction?: MouseMiddleClickAction;
	/**
	 * Configure the editor's accessibility support.
	 * Defaults to 'auto'. It is best to leave this to 'auto'.
	 */
	accessibilitySupport?: 'auto' | 'off' | 'on';
	/**
	 * Controls the number of lines in the editor that can be read out by a screen reader
	 */
	accessibilityPageSize?: number;
	/**
	 * Suggest options.
	 */
	suggest?: ISuggestOptions;
	inlineSuggest?: IInlineSuggestOptions;
	/**
	 * Smart select options.
	 */
	smartSelect?: ISmartSelectOptions;
	/**
	 *
	 */
	gotoLocation?: IGotoLocationOptions;
	/**
	 * Enable quick suggestions (shadow suggestions)
	 * Defaults to true.
	 */
	quickSuggestions?: boolean | QuickSuggestionsValue | IQuickSuggestionsOptions;
	/**
	 * Quick suggestions show delay (in ms)
	 * Defaults to 10 (ms)
	 */
	quickSuggestionsDelay?: number;
	/**
	 * Controls the spacing around the editor.
	 */
	padding?: IEditorPaddingOptions;
	/**
	 * Parameter hint options.
	 */
	parameterHints?: IEditorParameterHintOptions;
	/**
	 * Options for auto closing brackets.
	 * Defaults to language defined behavior.
	 */
	autoClosingBrackets?: EditorAutoClosingStrategy;
	/**
	 * Options for auto closing comments.
	 * Defaults to language defined behavior.
	 */
	autoClosingComments?: EditorAutoClosingStrategy;
	/**
	 * Options for auto closing quotes.
	 * Defaults to language defined behavior.
	 */
	autoClosingQuotes?: EditorAutoClosingStrategy;
	/**
	 * Options for pressing backspace near quotes or bracket pairs.
	 */
	autoClosingDelete?: EditorAutoClosingEditStrategy;
	/**
	 * Options for typing over closing quotes or brackets.
	 */
	autoClosingOvertype?: EditorAutoClosingEditStrategy;
	/**
	 * Options for auto surrounding.
	 * Defaults to always allowing auto surrounding.
	 */
	autoSurround?: EditorAutoSurroundStrategy;
	/**
	 * Controls whether the editor should automatically adjust the indentation when users type, paste, move or indent lines.
	 * Defaults to advanced.
	 */
	autoIndent?: 'none' | 'keep' | 'brackets' | 'advanced' | 'full';
	/**
	 * Boolean which controls whether to autoindent on paste
	 */
	autoIndentOnPaste?: boolean;
	/**
	 * Boolean which controls whether to autoindent on paste within a string when autoIndentOnPaste is enabled.
	 */
	autoIndentOnPasteWithinString?: boolean;
	/**
	 * Emulate selection behaviour of tab characters when using spaces for indentation.
	 * This means selection will stick to tab stops.
	 */
	stickyTabStops?: boolean;
	/**
	 * Enable format on type.
	 * Defaults to false.
	 */
	formatOnType?: boolean;
	/**
	 * Enable format on paste.
	 * Defaults to false.
	 */
	formatOnPaste?: boolean;
	/**
	 * Controls the width used to render full-width characters.
	 * Defaults to 'font'.
	 */
	fullwidthCharacterWidth?: 'font' | 'twoCells';
	/**
	 * Controls whether double-clicking next to a bracket or quote selects the content inside.
	 * Defaults to true.
	 */
	doubleClickSelectsBlock?: boolean;
	/**
	 * Controls if the editor should allow to move selections via drag and drop.
	 * Defaults to false.
	 */
	dragAndDrop?: boolean;
	/**
	 * Enable the suggestion box to pop-up on trigger characters.
	 * Defaults to true.
	 */
	suggestOnTriggerCharacters?: boolean;
	/**
	 * Accept suggestions on ENTER.
	 * Defaults to 'on'.
	 */
	acceptSuggestionOnEnter?: 'on' | 'smart' | 'off';
	/**
	 * Accept suggestions on provider defined characters.
	 * Defaults to true.
	 */
	acceptSuggestionOnCommitCharacter?: boolean;
	/**
	 * Enable snippet suggestions. Default to 'true'.
	 */
	snippetSuggestions?: 'top' | 'bottom' | 'inline' | 'none';
	/**
	 * Copying without a selection copies the current line.
	 */
	emptySelectionClipboard?: boolean;
	/**
	 * Syntax highlighting is copied.
	 */
	copyWithSyntaxHighlighting?: boolean;
	/**
	 * The history mode for suggestions.
	 */
	suggestSelection?: 'first' | 'recentlyUsed' | 'recentlyUsedByPrefix';
	/**
	 * The font size for the suggest widget.
	 * Defaults to the editor font size.
	 */
	suggestFontSize?: number;
	/**
	 * The line height for the suggest widget.
	 * Defaults to the editor line height.
	 */
	suggestLineHeight?: number;
	/**
	 * Enable tab completion.
	 */
	tabCompletion?: 'on' | 'off' | 'onlySnippets';
	/**
	 * Enable selection highlight.
	 * Defaults to true.
	 */
	selectionHighlight?: boolean;
	/**
	 * Enable selection highlight for multiline selections.
	 * Defaults to false.
	 */
	selectionHighlightMultiline?: boolean;
	/**
	 * Maximum length (in characters) for selection highlights.
	 * Set to 0 to have an unlimited length.
	 */
	selectionHighlightMaxLength?: number;
	/**
	 * Controls how occurrences of selected text are matched for occurrence selection and highlighting.
	 * Defaults to 'findOptions', which uses the Find widget's match case and whole word settings.
	 */
	selectedTextMatchMode?: 'findOptions' | 'caseSensitive' | 'caseInsensitive';
	/**
	 * Enable semantic occurrences highlight.
	 * Defaults to 'singleFile'.
	 * 'off' disables occurrence highlighting
	 * 'singleFile' triggers occurrence highlighting in the current document
	 * 'multiFile'  triggers occurrence highlighting across valid open documents
	 */
	occurrencesHighlight?: 'off' | 'singleFile' | 'multiFile';
	/**
	 * Controls delay for occurrences highlighting
	 * Defaults to 250.
	 * Minimum value is 0
	 * Maximum value is 2000
	 */
	occurrencesHighlightDelay?: number;
	/**
	 * Show code lens
	 * Defaults to true.
	 */
	codeLens?: boolean;
	/**
	 * Code lens font family. Defaults to editor font family.
	 */
	codeLensFontFamily?: string;
	/**
	 * Code lens font size. Default to 90% of the editor font size
	 */
	codeLensFontSize?: number;
	/**
	 * Control the behavior and rendering of the code action lightbulb.
	 */
	lightbulb?: IEditorLightbulbOptions;
	/**
	 * Timeout for running code actions on save.
	 */
	codeActionsOnSaveTimeout?: number;
	/**
	 * Enable code folding.
	 * Defaults to true.
	 */
	folding?: boolean;
	/**
	 * Selects the folding strategy. 'auto' uses the strategies contributed for the current document, 'indentation' uses the indentation based folding strategy.
	 * Defaults to 'auto'.
	 */
	foldingStrategy?: 'auto' | 'indentation';
	/**
	 * Enable highlight for folded regions.
	 * Defaults to true.
	 */
	foldingHighlight?: boolean;
	/**
	 * Auto fold imports folding regions.
	 * Defaults to true.
	 */
	foldingImportsByDefault?: boolean;
	/**
	 * Maximum number of foldable regions.
	 * Defaults to 5000.
	 */
	foldingMaximumRegions?: number;
	/**
	 * Controls whether the fold actions in the gutter stay always visible or hide unless the mouse is over the gutter.
	 * Defaults to 'mouseover'.
	 */
	showFoldingControls?: 'always' | 'never' | 'mouseover';
	/**
	 * Controls whether clicking on the empty content after a folded line will unfold the line.
	 * Defaults to false.
	 */
	unfoldOnClickAfterEndOfLine?: boolean;
	/**
	 * Enable highlighting of matching brackets.
	 * Defaults to 'always'.
	 */
	matchBrackets?: 'never' | 'near' | 'always';
	/**
	 * Enable experimental rendering using WebGPU.
	 * Defaults to 'off'.
	 */
	experimentalGpuAcceleration?: 'on' | 'off';
	/**
	 * Enable experimental whitespace rendering.
	 * Defaults to 'svg'.
	 */
	experimentalWhitespaceRendering?: 'svg' | 'font' | 'off';
	/**
	 * Enable rendering of whitespace.
	 * Defaults to 'selection'.
	 */
	renderWhitespace?: 'none' | 'boundary' | 'selection' | 'trailing' | 'all';
	/**
	 * Enable rendering of control characters.
	 * Defaults to true.
	 */
	renderControlCharacters?: boolean;
	/**
	 * Enable rendering of current line highlight.
	 * Defaults to all.
	 */
	renderLineHighlight?: 'none' | 'gutter' | 'line' | 'all';
	/**
	 * Control if the current line highlight should be rendered only the editor is focused.
	 * Defaults to false.
	 */
	renderLineHighlightOnlyWhenFocus?: boolean;
	/**
	 * Inserting and deleting whitespace follows tab stops.
	 */
	useTabStops?: boolean;
	/**
	 * Controls whether the editor should automatically remove indentation whitespace when joining lines with Delete.
	 * Defaults to false.
	 */
	trimWhitespaceOnDelete?: boolean;
	/**
	 * The font family
	 */
	fontFamily?: string;
	/**
	 * The font weight
	 */
	fontWeight?: string;
	/**
	 * The font size
	 */
	fontSize?: number;
	/**
	 * The line height
	 */
	lineHeight?: number;
	/**
	 * The letter spacing
	 */
	letterSpacing?: number;
	/**
	 * Controls fading out of unused variables.
	 */
	showUnused?: boolean;
	/**
	 * Controls whether to focus the inline editor in the peek widget by default.
	 * Defaults to false.
	 */
	peekWidgetDefaultFocus?: 'tree' | 'editor';

	/**
	 * Sets a placeholder for the editor.
	 * If set, the placeholder is shown if the editor is empty.
	*/
	placeholder?: string | undefined;

	/**
	 * Controls whether the definition link opens element in the peek widget.
	 * Defaults to false.
	 */
	definitionLinkOpensInPeek?: boolean;
	/**
	 * Controls strikethrough deprecated variables.
	 */
	showDeprecated?: boolean;
	/**
	 * Controls whether suggestions allow matches in the middle of the word instead of only at the beginning
	 */
	matchOnWordStartOnly?: boolean;
	/**
	 * Control the behavior and rendering of the inline hints.
	 */
	inlayHints?: IEditorInlayHintsOptions;
	/**
	 * Control if the editor should use shadow DOM.
	 */
	useShadowDOM?: boolean;
	/**
	 * Controls the behavior of editor guides.
	*/
	guides?: IGuidesOptions;

	/**
	 * Controls the behavior of the unicode highlight feature
	 * (by default, ambiguous and invisible characters are highlighted).
	 */
	unicodeHighlight?: IUnicodeHighlightOptions;

	/**
	 * Configures bracket pair colorization (disabled by default).
	*/
	bracketPairColorization?: IBracketPairColorizationOptions;

	/**
	 * Controls dropping into the editor from an external source.
	 *
	 * When enabled, this shows a preview of the drop location and triggers an `onDropIntoEditor` event.
	 */
	dropIntoEditor?: IDropIntoEditorOptions;

	/**
	 * Sets whether the new experimental edit context should be used instead of the text area.
	 */
	editContext?: boolean;

	/**
	 * Controls whether to render rich HTML screen reader content when the EditContext is enabled
	 */
	renderRichScreenReaderContent?: boolean;

	/**
	 * Controls support for changing how content is pasted into the editor.
	 */
	pasteAs?: IPasteAsOptions;

	/**
	 * Controls whether the editor / terminal receives tabs or defers them to the workbench for navigation.
	 */
	tabFocusMode?: boolean;

	/**
	 * Controls whether the accessibility hint should be provided to screen reader users when an inline completion is shown.
	 */
	inlineCompletionsAccessibilityVerbose?: boolean;
}

/**
 * @internal
 * The width of the minimap gutter, in pixels.
 */
export const MINIMAP_GUTTER_WIDTH = 8;

export type DiffEditorViewMode = 'inline' | 'sideBySide' | 'automatic';

export interface IDiffEditorBaseOptions {
	/**
	 * Allow the user to resize the diff editor split view.
	 * Defaults to true.
	 */
	enableSplitViewResizing?: boolean;

	/**
	 * The default ratio when rendering side-by-side editors.
	 * Must be a number between 0 and 1, min sizes apply.
	 * Defaults to 0.5
	 */
	splitViewDefaultRatio?: number;

	/**
	 * Render the differences in two side-by-side editors.
	 * Defaults to true.
	 */
	renderSideBySide?: boolean;

	/**
	 * When `renderSideBySide` is enabled, `useInlineViewWhenSpaceIsLimited` is set,
	 * and the diff editor has a width less than `renderSideBySideInlineBreakpoint`, the inline view is used.
	 */
	renderSideBySideInlineBreakpoint?: number | undefined;

	/**
	 * When `renderSideBySide` is enabled, `useInlineViewWhenSpaceIsLimited` is set,
	 * and the diff editor has a width less than `renderSideBySideInlineBreakpoint`, the inline view is used.
	 */
	useInlineViewWhenSpaceIsLimited?: boolean;

	/**
	 * If set, the diff editor is optimized for small views.
	 * Defaults to `false`.
	*/
	compactMode?: boolean;

	/**
	 * If set, the original editor's line numbers are hidden in the inline view.
	 * Defaults to `false`.
	 * @internal
	*/
	hideOriginalLineNumbers?: boolean;

	/**
	 * Timeout in milliseconds after which diff computation is cancelled.
	 * Defaults to 5000.
	 */
	maxComputationTime?: number;

	/**
	 * Maximum supported file size in MB.
	 * Defaults to 50.
	 */
	maxFileSize?: number;

	/**
	 * Compute the diff by ignoring leading/trailing whitespace
	 * Defaults to true.
	 */
	ignoreTrimWhitespace?: boolean;

	/**
	 * Render +/- indicators for added/deleted changes.
	 * Defaults to true.
	 */
	renderIndicators?: boolean;

	/**
	 * Shows icons in the glyph margin to revert changes.
	 * Default to true.
	 */
	renderMarginRevertIcon?: boolean;

	/**
	 * Indicates if the gutter menu should be rendered.
	*/
	renderGutterMenu?: boolean;

	/**
	 * Original model should be editable?
	 * Defaults to false.
	 */
	originalEditable?: boolean;

	/**
	 * Should the diff editor enable code lens?
	 * Defaults to false.
	 */
	diffCodeLens?: boolean;

	/**
	 * Is the diff editor should render overview ruler
	 * Defaults to true
	 */
	renderOverviewRuler?: boolean;

	/**
	 * Control the wrapping of the diff editor.
	 */
	diffWordWrap?: 'off' | 'on' | 'inherit';

	/**
	 * Diff Algorithm
	*/
	diffAlgorithm?: 'legacy' | 'advanced' | 'advanced-external' | 'advanced-wasm';

	/**
	 * Whether the diff editor aria label should be verbose.
	 */
	accessibilityVerbose?: boolean;

	experimental?: {
		/**
		 * Defaults to false.
		 */
		showMoves?: boolean;

		showEmptyDecorations?: boolean;

		/**
		 * Only applies when `renderSideBySide` is set to false.
		*/
		useTrueInlineView?: boolean;
	};

	/**
	 * Is the diff editor inside another editor
	 * Defaults to false
	 */
	isInEmbeddedEditor?: boolean;

	/**
	 * If the diff editor should only show the difference review mode.
	 */
	onlyShowAccessibleDiffViewer?: boolean;

	hideUnchangedRegions?: {
		enabled?: boolean;
		revealLineCount?: number;
		minimumLineCount?: number;
		contextLineCount?: number;
	};
}

/**
 * Configuration options for the diff editor.
 */
export interface IDiffEditorOptions extends IEditorOptions, IDiffEditorBaseOptions {
}

/**
 * @internal
 */
export type ValidDiffEditorBaseOptions = Readonly<Required<IDiffEditorBaseOptions>>;

//#endregion

/**
 * An event describing that the configuration of the editor has changed.
 */
export class ConfigurationChangedEvent {
	private readonly _values: boolean[];
	/**
	 * @internal
	 */
	constructor(values: boolean[]) {
		this._values = values;
	}
	public hasChanged(id: EditorOption): boolean {
		return this._values[id];
	}
}

/**
 * All computed editor options.
 */
export interface IComputedEditorOptions {
	get<T extends EditorOption>(id: T): FindComputedEditorOptionValueById<T>;
}

//#region IEditorOption

/**
 * @internal
 */
export interface IEnvironmentalOptions {
	readonly memory: ComputeOptionsMemory | null;
	readonly outerWidth: number;
	readonly outerHeight: number;
	readonly fontInfo: FontInfo;
	readonly extraEditorClassName: string;
	readonly isDominatedByLongLines: boolean;
	readonly viewLineCount: number;
	readonly lineNumbersDigitCount: number;
	readonly emptySelectionClipboard: boolean;
	readonly pixelRatio: number;
	readonly tabFocusMode: boolean;
	readonly inputMode: 'insert' | 'overtype';
	readonly accessibilitySupport: AccessibilitySupport;
	readonly glyphMarginDecorationLaneCount: number;
	readonly editContextSupported: boolean;
}

/**
 * @internal
 */
export class ComputeOptionsMemory {

	public stableMinimapLayoutInput: IMinimapLayoutInput | null;
	public stableFitMaxMinimapScale: number;
	public stableFitRemainingWidth: number;

	constructor() {
		this.stableMinimapLayoutInput = null;
		this.stableFitMaxMinimapScale = 0;
		this.stableFitRemainingWidth = 0;
	}
}

export interface IEditorOption<K extends EditorOption, V> {
	readonly id: K;
	readonly name: string;
	defaultValue: V;
	/**
	 * @internal
	 */
	readonly schema: IConfigurationPropertySchema | { [path: string]: IConfigurationPropertySchema } | undefined;
	/**
	 * @internal
	 */
	validate(input: unknown): V;
	/**
	 * @internal
	 */
	compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: V): V;

	/**
	 * Might modify `value`.
	*/
	applyUpdate(value: V | undefined, update: V): ApplyUpdateResult<V>;
}

/**
 * @internal
 */
type PossibleKeyName0<V> = { [K in keyof IEditorOptions]: IEditorOptions[K] extends V | undefined ? K : never }[keyof IEditorOptions];
/**
 * @internal
 */
type PossibleKeyName<V> = NonNullable<PossibleKeyName0<V>>;

/**
 * @internal
 */
abstract class BaseEditorOption<K extends EditorOption, T, V> implements IEditorOption<K, V> {

	public readonly id: K;
	public readonly name: string;
	public readonly defaultValue: V;
	public readonly schema: IConfigurationPropertySchema | { [path: string]: IConfigurationPropertySchema } | undefined;

	constructor(id: K, name: PossibleKeyName<T>, defaultValue: V, schema?: IConfigurationPropertySchema | { [path: string]: IConfigurationPropertySchema }) {
		this.id = id;
		this.name = name;
		this.defaultValue = defaultValue;
		this.schema = schema;
	}

	public applyUpdate(value: V | undefined, update: V): ApplyUpdateResult<V> {
		return applyUpdate(value, update);
	}

	public abstract validate(input: unknown): V;

	public compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: V): V {
		return value;
	}
}

export class ApplyUpdateResult<T> {
	constructor(
		public readonly newValue: T,
		public readonly didChange: boolean
	) { }
}

function applyUpdate<T>(value: T | undefined, update: T): ApplyUpdateResult<T> {
	if (typeof value !== 'object' || typeof update !== 'object' || !value || !update) {
		return new ApplyUpdateResult(update, value !== update);
	}
	if (Array.isArray(value) || Array.isArray(update)) {
		const arrayEquals = Array.isArray(value) && Array.isArray(update) && arrays.equals(value, update);
		return new ApplyUpdateResult(update, !arrayEquals);
	}
	let didChange = false;
	for (const key in update) {
		if (update.hasOwnProperty(key)) {
			const result = applyUpdate(value[key], update[key]);
			if (result.didChange) {
				value[key] = result.newValue;
				didChange = true;
			}
		}
	}
	return new ApplyUpdateResult(value, didChange);
}

/**
 * @internal
 */
abstract class ComputedEditorOption<K extends EditorOption, V> implements IEditorOption<K, V> {

	public readonly id: K;
	public readonly name: '_never_';
	public readonly defaultValue: V;
	public readonly schema: IConfigurationPropertySchema | undefined = undefined;

	constructor(id: K, defaultValue: V) {
		this.id = id;
		this.name = '_never_';
		this.defaultValue = defaultValue;
	}

	public applyUpdate(value: V | undefined, update: V): ApplyUpdateResult<V> {
		return applyUpdate(value, update);
	}

	public validate(input: unknown): V {
		return this.defaultValue;
	}

	public abstract compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: V): V;
}

abstract class SimpleEditorOption<K extends EditorOption, V> implements IEditorOption<K, V> {

	public readonly id: K;
	public readonly name: PossibleKeyName<V>;
	public readonly defaultValue: V;
	public readonly schema: IConfigurationPropertySchema | undefined;

	constructor(id: K, name: PossibleKeyName<V>, defaultValue: V, schema?: IConfigurationPropertySchema) {
		this.id = id;
		this.name = name;
		this.defaultValue = defaultValue;
		this.schema = schema;
	}

	public applyUpdate(value: V | undefined, update: V): ApplyUpdateResult<V> {
		return applyUpdate(value, update);
	}

	public abstract validate(input: unknown): V;

	public compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: V): V {
		return value;
	}
}

/**
 * @internal
 */
export function boolean(value: unknown, defaultValue: boolean): boolean {
	if (typeof value === 'undefined') {
		return defaultValue;
	}
	if (value === 'false') {
		// treat the string 'false' as false
		return false;
	}
	return Boolean(value);
}

class EditorBooleanOption<K extends EditorOption> extends SimpleEditorOption<K, boolean> {

	constructor(id: K, name: PossibleKeyName<boolean>, defaultValue: boolean, schema: IConfigurationPropertySchema | undefined = undefined) {
		if (typeof schema !== 'undefined') {
			schema.type = 'boolean';
			schema.default = defaultValue;
		}
		super(id, name, defaultValue, schema);
	}

	public override validate(input: unknown): boolean {
		return boolean(input, this.defaultValue);
	}
}

/**
 * @internal
 */
export function clampedInt<T = number>(value: unknown, defaultValue: T, minimum: number, maximum: number): number | T {
	if (typeof value === 'string') {
		value = parseInt(value, 10);
	}
	if (typeof value !== 'number' || isNaN(value)) {
		return defaultValue;
	}
	let r = value;
	r = Math.max(minimum, r);
	r = Math.min(maximum, r);
	return r | 0;
}

class EditorIntOption<K extends EditorOption> extends SimpleEditorOption<K, number> {

	public static clampedInt<T>(value: unknown, defaultValue: T, minimum: number, maximum: number): number | T {
		return clampedInt(value, defaultValue, minimum, maximum);
	}

	public readonly minimum: number;
	public readonly maximum: number;

	constructor(id: K, name: PossibleKeyName<number>, defaultValue: number, minimum: number, maximum: number, schema: IConfigurationPropertySchema | undefined = undefined) {
		if (typeof schema !== 'undefined') {
			schema.type = 'integer';
			schema.default = defaultValue;
			schema.minimum = minimum;
			schema.maximum = maximum;
		}
		super(id, name, defaultValue, schema);
		this.minimum = minimum;
		this.maximum = maximum;
	}

	public override validate(input: unknown): number {
		return EditorIntOption.clampedInt(input, this.defaultValue, this.minimum, this.maximum);
	}
}
/**
 * @internal
 */
export function clampedFloat<T extends number>(value: unknown, defaultValue: T, minimum: number, maximum: number): number | T {
	if (typeof value === 'undefined') {
		return defaultValue;
	}
	const r = EditorFloatOption.float(value, defaultValue);
	return EditorFloatOption.clamp(r, minimum, maximum);
}

class EditorFloatOption<K extends EditorOption> extends SimpleEditorOption<K, number> {

	public readonly minimum: number | undefined;
	public readonly maximum: number | undefined;

	public static clamp(n: number, min: number, max: number): number {
		if (n < min) {
			return min;
		}
		if (n > max) {
			return max;
		}
		return n;
	}

	public static float(value: unknown, defaultValue: number): number {
		if (typeof value === 'string') {
			value = parseFloat(value);
		}
		if (typeof value !== 'number' || isNaN(value)) {
			return defaultValue;
		}
		return value;
	}

	public readonly validationFn: (value: number) => number;

	constructor(id: K, name: PossibleKeyName<number>, defaultValue: number, validationFn: (value: number) => number, schema?: IConfigurationPropertySchema, minimum?: number, maximum?: number) {
		if (typeof schema !== 'undefined') {
			schema.type = 'number';
			schema.default = defaultValue;
			schema.minimum = minimum;
			schema.maximum = maximum;
		}
		super(id, name, defaultValue, schema);
		this.validationFn = validationFn;
		this.minimum = minimum;
		this.maximum = maximum;
	}

	public override validate(input: unknown): number {
		return this.validationFn(EditorFloatOption.float(input, this.defaultValue));
	}
}

class EditorStringOption<K extends EditorOption> extends SimpleEditorOption<K, string> {

	public static string(value: unknown, defaultValue: string): string {
		if (typeof value !== 'string') {
			return defaultValue;
		}
		return value;
	}

	constructor(id: K, name: PossibleKeyName<string>, defaultValue: string, schema: IConfigurationPropertySchema | undefined = undefined) {
		if (typeof schema !== 'undefined') {
			schema.type = 'string';
			schema.default = defaultValue;
		}
		super(id, name, defaultValue, schema);
	}

	public override validate(input: unknown): string {
		return EditorStringOption.string(input, this.defaultValue);
	}
}

/**
 * @internal
 */
export function stringSet<T extends string>(value: unknown, defaultValue: T, allowedValues: ReadonlyArray<T>, renamedValues?: Record<string, T>): T {
	if (typeof value !== 'string') {
		return defaultValue;
	}
	if (renamedValues && value in renamedValues) {
		return renamedValues[value];
	}
	if (allowedValues.indexOf(value as T) === -1) {
		return defaultValue;
	}
	return value as T;
}

class EditorStringEnumOption<K extends EditorOption, V extends string> extends SimpleEditorOption<K, V> {

	private readonly _allowedValues: ReadonlyArray<V>;

	constructor(id: K, name: PossibleKeyName<V>, defaultValue: V, allowedValues: ReadonlyArray<V>, schema: IConfigurationPropertySchema | undefined = undefined) {
		if (typeof schema !== 'undefined') {
			schema.type = 'string';
			schema.enum = allowedValues.slice(0);
			schema.default = defaultValue;
		}
		super(id, name, defaultValue, schema);
		this._allowedValues = allowedValues;
	}

	public override validate(input: unknown): V {
		return stringSet<V>(input, this.defaultValue, this._allowedValues);
	}
}

class EditorEnumOption<K extends EditorOption, T extends string, V> extends BaseEditorOption<K, T, V> {

	private readonly _allowedValues: T[];
	private readonly _convert: (value: T) => V;

	constructor(id: K, name: PossibleKeyName<T>, defaultValue: V, defaultStringValue: string, allowedValues: T[], convert: (value: T) => V, schema: IConfigurationPropertySchema | undefined = undefined) {
		if (typeof schema !== 'undefined') {
			schema.type = 'string';
			schema.enum = allowedValues;
			schema.default = defaultStringValue;
		}
		super(id, name, defaultValue, schema);
		this._allowedValues = allowedValues;
		this._convert = convert;
	}

	public validate(input: unknown): V {
		if (typeof input !== 'string') {
			return this.defaultValue;
		}
		if (this._allowedValues.indexOf(<T>input) === -1) {
			return this.defaultValue;
		}
		return this._convert(<T>input);
	}
}

//#endregion

//#region autoIndent

function _autoIndentFromString(autoIndent: 'none' | 'keep' | 'brackets' | 'advanced' | 'full'): EditorAutoIndentStrategy {
	switch (autoIndent) {
		case 'none': return EditorAutoIndentStrategy.None;
		case 'keep': return EditorAutoIndentStrategy.Keep;
		case 'brackets': return EditorAutoIndentStrategy.Brackets;
		case 'advanced': return EditorAutoIndentStrategy.Advanced;
		case 'full': return EditorAutoIndentStrategy.Full;
	}
}

//#endregion

//#region accessibilitySupport

class EditorAccessibilitySupport extends BaseEditorOption<EditorOption.accessibilitySupport, 'auto' | 'off' | 'on', AccessibilitySupport> {

	constructor() {
		super(
			EditorOption.accessibilitySupport, 'accessibilitySupport', AccessibilitySupport.Unknown,
			{
				type: 'string',
				enum: ['auto', 'on', 'off'],
				enumDescriptions: [
					nls.localize('accessibilitySupport.auto', "使用平台 API 检测是否连接了屏幕阅读器。"),
					nls.localize('accessibilitySupport.on', "针对屏幕阅读器优化。"),
					nls.localize('accessibilitySupport.off', "假定未连接屏幕阅读器。"),
				],
				default: 'auto',
				tags: ['accessibility'],
				description: nls.localize('accessibilitySupport', "控制界面是否以针对屏幕阅读器优化的模式运行。")
			}
		);
	}

	public validate(input: unknown): AccessibilitySupport {
		switch (input) {
			case 'auto': return AccessibilitySupport.Unknown;
			case 'off': return AccessibilitySupport.Disabled;
			case 'on': return AccessibilitySupport.Enabled;
		}
		return this.defaultValue;
	}

	public override compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: AccessibilitySupport): AccessibilitySupport {
		if (value === AccessibilitySupport.Unknown) {
			// The editor reads the `accessibilitySupport` from the environment
			return env.accessibilitySupport;
		}
		return value;
	}
}

//#endregion

//#region comments

/**
 * Configuration options for editor comments
 */
export interface IEditorCommentsOptions {
	/**
	 * Insert a space after the line comment token and inside the block comments tokens.
	 * Defaults to true.
	 */
	insertSpace?: boolean;
	/**
	 * Ignore empty lines when inserting line comments.
	 * Defaults to true.
	 */
	ignoreEmptyLines?: boolean;
}

/**
 * @internal
 */
export type EditorCommentsOptions = Readonly<Required<IEditorCommentsOptions>>;

class EditorComments extends BaseEditorOption<EditorOption.comments, IEditorCommentsOptions, EditorCommentsOptions> {

	constructor() {
		const defaults: EditorCommentsOptions = {
			insertSpace: true,
			ignoreEmptyLines: true,
		};
		super(
			EditorOption.comments, 'comments', defaults,
			{
				'editor.comments.insertSpace': {
					type: 'boolean',
					default: defaults.insertSpace,
					description: nls.localize('comments.insertSpace', "控制添加注释时是否插入空格。")
				},
				'editor.comments.ignoreEmptyLines': {
					type: 'boolean',
					default: defaults.ignoreEmptyLines,
					description: nls.localize('comments.ignoreEmptyLines', "控制在使用切换、添加或移除行注释的操作时是否忽略空行。")
				},
			}
		);
	}

	public validate(_input: unknown): EditorCommentsOptions {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue;
		}
		const input = _input as Unknown<IEditorCommentsOptions>;
		return {
			insertSpace: boolean(input.insertSpace, this.defaultValue.insertSpace),
			ignoreEmptyLines: boolean(input.ignoreEmptyLines, this.defaultValue.ignoreEmptyLines),
		};
	}
}

//#endregion

//#region cursorBlinking

/**
 * The kind of animation in which the editor's cursor should be rendered.
 */
export const enum TextEditorCursorBlinkingStyle {
	/**
	 * Hidden
	 */
	Hidden = 0,
	/**
	 * Blinking
	 */
	Blink = 1,
	/**
	 * Blinking with smooth fading
	 */
	Smooth = 2,
	/**
	 * Blinking with prolonged filled state and smooth fading
	 */
	Phase = 3,
	/**
	 * Expand collapse animation on the y axis
	 */
	Expand = 4,
	/**
	 * No-Blinking
	 */
	Solid = 5
}

/**
 * @internal
 */
export function cursorBlinkingStyleFromString(cursorBlinkingStyle: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid'): TextEditorCursorBlinkingStyle {
	switch (cursorBlinkingStyle) {
		case 'blink': return TextEditorCursorBlinkingStyle.Blink;
		case 'smooth': return TextEditorCursorBlinkingStyle.Smooth;
		case 'phase': return TextEditorCursorBlinkingStyle.Phase;
		case 'expand': return TextEditorCursorBlinkingStyle.Expand;
		case 'solid': return TextEditorCursorBlinkingStyle.Solid;
	}
}

//#endregion

//#region cursorStyle

/**
 * The style in which the editor's cursor should be rendered.
 */
export enum TextEditorCursorStyle {
	/**
	 * As a vertical line (sitting between two characters).
	 */
	Line = 1,
	/**
	 * As a block (sitting on top of a character).
	 */
	Block = 2,
	/**
	 * As a horizontal line (sitting under a character).
	 */
	Underline = 3,
	/**
	 * As a thin vertical line (sitting between two characters).
	 */
	LineThin = 4,
	/**
	 * As an outlined block (sitting on top of a character).
	 */
	BlockOutline = 5,
	/**
	 * As a thin horizontal line (sitting under a character).
	 */
	UnderlineThin = 6
}

/**
 * @internal
 */
export function cursorStyleToString(cursorStyle: TextEditorCursorStyle): 'line' | 'block' | 'underline' | 'line-thin' | 'block-outline' | 'underline-thin' {
	switch (cursorStyle) {
		case TextEditorCursorStyle.Line: return 'line';
		case TextEditorCursorStyle.Block: return 'block';
		case TextEditorCursorStyle.Underline: return 'underline';
		case TextEditorCursorStyle.LineThin: return 'line-thin';
		case TextEditorCursorStyle.BlockOutline: return 'block-outline';
		case TextEditorCursorStyle.UnderlineThin: return 'underline-thin';
	}
}

/**
 * @internal
 */
export function cursorStyleFromString(cursorStyle: 'line' | 'block' | 'underline' | 'line-thin' | 'block-outline' | 'underline-thin'): TextEditorCursorStyle {
	switch (cursorStyle) {
		case 'line': return TextEditorCursorStyle.Line;
		case 'block': return TextEditorCursorStyle.Block;
		case 'underline': return TextEditorCursorStyle.Underline;
		case 'line-thin': return TextEditorCursorStyle.LineThin;
		case 'block-outline': return TextEditorCursorStyle.BlockOutline;
		case 'underline-thin': return TextEditorCursorStyle.UnderlineThin;
	}
}

//#endregion

//#region editorClassName

class EditorClassName extends ComputedEditorOption<EditorOption.editorClassName, string> {

	constructor() {
		super(EditorOption.editorClassName, '');
	}

	public compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, _: string): string {
		const classNames = ['monaco-editor'];
		if (options.get(EditorOption.extraEditorClassName)) {
			classNames.push(options.get(EditorOption.extraEditorClassName));
		}
		if (env.extraEditorClassName) {
			classNames.push(env.extraEditorClassName);
		}
		if (options.get(EditorOption.mouseStyle) === 'default') {
			classNames.push('mouse-default');
		} else if (options.get(EditorOption.mouseStyle) === 'copy') {
			classNames.push('mouse-copy');
		}

		if (options.get(EditorOption.showUnused)) {
			classNames.push('showUnused');
		}

		if (options.get(EditorOption.showDeprecated)) {
			classNames.push('showDeprecated');
		}

		return classNames.join(' ');
	}
}

//#endregion

//#region emptySelectionClipboard

class EditorEmptySelectionClipboard extends EditorBooleanOption<EditorOption.emptySelectionClipboard> {

	constructor() {
		super(
			EditorOption.emptySelectionClipboard, 'emptySelectionClipboard', true,
			{ description: nls.localize('emptySelectionClipboard', "控制未选中内容时复制是否复制当前整行。") }
		);
	}

	public override compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: boolean): boolean {
		return value && env.emptySelectionClipboard;
	}
}

//#endregion

//#region find

/**
 * Configuration options for editor find widget
 */
export interface IEditorFindOptions {
	/**
	* Controls whether the cursor should move to find matches while typing.
	*/
	cursorMoveOnType?: boolean;
	/**
	 * Controls whether the find widget should search as you type.
	 */
	findOnType?: boolean;
	/**
	 * Controls if we seed search string in the Find Widget with editor selection.
	 */
	seedSearchStringFromSelection?: 'never' | 'always' | 'selection';
	/**
	 * Controls if Find in Selection flag is turned on in the editor.
	 */
	autoFindInSelection?: 'never' | 'always' | 'multiline';
	/*
	 * Controls whether the Find Widget should add extra lines on top of the editor.
	 */
	addExtraSpaceOnTop?: boolean;
	/**
	 * @internal
	 * Controls if the Find Widget should read or modify the shared find clipboard on macOS
	 */
	globalFindClipboard?: boolean;
	/**
	 * Controls whether the search result and diff result automatically restarts from the beginning (or the end) when no further matches can be found
	 */
	loop?: boolean;
	/**
	 * Controls whether to close the Find Widget after an explicit find navigation command lands on a match.
	 */
	closeOnResult?: boolean;
	/**
	 * @internal
	 * Controls how the find widget search history should be stored
	 */
	history?: 'never' | 'workspace';
	/**
	 * @internal
	 * Controls how the replace widget search history should be stored
	 */
	replaceHistory?: 'never' | 'workspace';
}

/**
 * @internal
 */
export type EditorFindOptions = Readonly<Required<IEditorFindOptions>>;

class EditorFind extends BaseEditorOption<EditorOption.find, IEditorFindOptions, EditorFindOptions> {

	constructor() {
		const defaults: EditorFindOptions = {
			cursorMoveOnType: true,
			findOnType: true,
			seedSearchStringFromSelection: 'always',
			autoFindInSelection: 'never',
			globalFindClipboard: false,
			addExtraSpaceOnTop: true,
			loop: true,
			closeOnResult: false,
			history: 'workspace',
			replaceHistory: 'workspace',
		};
		super(
			EditorOption.find, 'find', defaults,
			{
				'editor.find.cursorMoveOnType': {
					type: 'boolean',
					default: defaults.cursorMoveOnType,
					description: nls.localize('find.cursorMoveOnType', "控制输入时光标是否自动跳到匹配处。")
				},
				'editor.find.seedSearchStringFromSelection': {
					type: 'string',
					enum: ['never', 'always', 'selection'],
					default: defaults.seedSearchStringFromSelection,
					enumDescriptions: [
						nls.localize('editor.find.seedSearchStringFromSelection.never', "始终不从编辑器选区填充搜索字符串。"),
						nls.localize('editor.find.seedSearchStringFromSelection.always', "始终从编辑器选区填充搜索字符串，包括光标处的单词。"),
						nls.localize('editor.find.seedSearchStringFromSelection.selection', "仅从编辑器选区填充搜索字符串。")
					],
					description: nls.localize('find.seedSearchStringFromSelection', "控制查找控件的搜索词是否取自编辑器当前选区。")
				},
				'editor.find.autoFindInSelection': {
					type: 'string',
					enum: ['never', 'always', 'multiline'],
					default: defaults.autoFindInSelection,
					enumDescriptions: [
						nls.localize('editor.find.autoFindInSelection.never', "从不自动启用\"在选中项中查找\"（默认）。"),
						nls.localize('editor.find.autoFindInSelection.always', "始终自动启用\"在选中项中查找\"。"),
						nls.localize('editor.find.autoFindInSelection.multiline', "当选中多行内容时自动启用\"在选中项中查找\"。")
					],
					description: nls.localize('find.autoFindInSelection', "控制自动启用「在选中内容中查找」的条件。")
				},
				'editor.find.globalFindClipboard': {
					type: 'boolean',
					default: defaults.globalFindClipboard,
					description: nls.localize('find.globalFindClipboard', "控制查找控件在 macOS 上是否读写系统共享的查找剪贴板。"),
					included: platform.isMacintosh
				},
				'editor.find.addExtraSpaceOnTop': {
					type: 'boolean',
					default: defaults.addExtraSpaceOnTop,
					description: nls.localize('find.addExtraSpaceOnTop', "控制查找控件是否在编辑器上方留出额外行高。为 true 时，查找控件显示期间可滚动到第一行之上。")
				},
				'editor.find.loop': {
					type: 'boolean',
					default: defaults.loop,
					description: nls.localize('find.loop', "控制找不到后续匹配时，是否自动从头（或从尾）重新搜索。")
				},
				'editor.find.closeOnResult': {
					type: 'boolean',
					default: defaults.closeOnResult,
					description: nls.localize('find.closeOnResult', "控制执行查找跳转并落到结果上后，查找控件是否自动关闭。")
				},
				'editor.find.history': {
					type: 'string',
					enum: ['never', 'workspace'],
					default: 'workspace',
					enumDescriptions: [
						nls.localize('editor.find.history.never', "不存储来自查找小部件的搜索历史。"),
						nls.localize('editor.find.history.workspace', "在活动工作区中存储搜索历史"),
					],
					description: nls.localize('find.history', "控制查找历史记录的存储方式")
				},
				'editor.find.replaceHistory': {
					type: 'string',
					enum: ['never', 'workspace'],
					default: 'workspace',
					enumDescriptions: [
						nls.localize('editor.find.replaceHistory.never', "不存储来自替换小部件的历史。"),
						nls.localize('editor.find.replaceHistory.workspace', "在活动工作区中存储替换历史"),
					],
					description: nls.localize('find.replaceHistory', "控制替换历史记录的存储方式")
				},
				'editor.find.findOnType': {
					type: 'boolean',
					default: defaults.findOnType,
					description: nls.localize('find.findOnType', "控制查找控件是否边输入边搜索。")
				},
			}
		);
	}

	public validate(_input: unknown): EditorFindOptions {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue;
		}
		const input = _input as Unknown<IEditorFindOptions>;
		return {
			cursorMoveOnType: boolean(input.cursorMoveOnType, this.defaultValue.cursorMoveOnType),
			findOnType: boolean(input.findOnType, this.defaultValue.findOnType),
			seedSearchStringFromSelection: typeof input.seedSearchStringFromSelection === 'boolean'
				? (input.seedSearchStringFromSelection ? 'always' : 'never')
				: stringSet<'never' | 'always' | 'selection'>(input.seedSearchStringFromSelection, this.defaultValue.seedSearchStringFromSelection, ['never', 'always', 'selection']),
			autoFindInSelection: typeof input.autoFindInSelection === 'boolean'
				? (input.autoFindInSelection ? 'always' : 'never')
				: stringSet<'never' | 'always' | 'multiline'>(input.autoFindInSelection, this.defaultValue.autoFindInSelection, ['never', 'always', 'multiline']),
			globalFindClipboard: boolean(input.globalFindClipboard, this.defaultValue.globalFindClipboard),
			addExtraSpaceOnTop: boolean(input.addExtraSpaceOnTop, this.defaultValue.addExtraSpaceOnTop),
			loop: boolean(input.loop, this.defaultValue.loop),
			closeOnResult: boolean(input.closeOnResult, this.defaultValue.closeOnResult),
			history: stringSet<'never' | 'workspace'>(input.history, this.defaultValue.history, ['never', 'workspace']),
			replaceHistory: stringSet<'never' | 'workspace'>(input.replaceHistory, this.defaultValue.replaceHistory, ['never', 'workspace']),
		};
	}
}

//#endregion

//#region fontLigatures

/**
 * @internal
 */
export class EditorFontLigatures extends BaseEditorOption<EditorOption.fontLigatures, boolean | string, string> {

	public static OFF = '"liga" off, "calt" off';
	public static ON = '"liga" on, "calt" on';

	constructor() {
		super(
			EditorOption.fontLigatures, 'fontLigatures', EditorFontLigatures.OFF,
			{
				anyOf: [
					{
						type: 'boolean',
						description: nls.localize('fontLigatures', "启用或禁用字体连字（'calt' 和 'liga' 字体特性）。改为字符串可细粒度控制 'font-feature-settings' CSS 属性。"),
					},
					{
						type: 'string',
						description: nls.localize('fontFeatureSettings', "显式的 'font-feature-settings' CSS 属性。如果只需要开关连字，也可以传入布尔值。")
					}
				],
				description: nls.localize('fontLigaturesGeneral', "配置字体连字或字体特性。可以是布尔值以启用/禁用连字，也可以是 CSS 'font-feature-settings' 属性的字符串值。"),
				default: false
			}
		);
	}

	public validate(input: unknown): string {
		if (typeof input === 'undefined') {
			return this.defaultValue;
		}
		if (typeof input === 'string') {
			if (input === 'false' || input.length === 0) {
				return EditorFontLigatures.OFF;
			}
			if (input === 'true') {
				return EditorFontLigatures.ON;
			}
			return input;
		}
		if (Boolean(input)) {
			return EditorFontLigatures.ON;
		}
		return EditorFontLigatures.OFF;
	}
}

//#endregion

//#region fontVariations

/**
 * @internal
 */
export class EditorFontVariations extends BaseEditorOption<EditorOption.fontVariations, boolean | string, string> {
	// Text is laid out using default settings.
	public static OFF = FONT_VARIATION_OFF;

	// Translate `fontWeight` config to the `font-variation-settings` CSS property.
	public static TRANSLATE = FONT_VARIATION_TRANSLATE;

	constructor() {
		super(
			EditorOption.fontVariations, 'fontVariations', EditorFontVariations.OFF,
			{
				anyOf: [
					{
						type: 'boolean',
						description: nls.localize('fontVariations', "启用/禁用从 font-weight 到 font-variation-settings 的转换。改为字符串可对 'font-variation-settings' CSS 属性进行更精细的控制。"),
					},
					{
						type: 'string',
						description: nls.localize('fontVariationSettings', "显式的 'font-variation-settings' CSS 属性。如果只需要把 font-weight 映射到 font-variation-settings，也可以传入布尔值。")
					}
				],
				description: nls.localize('fontVariationsGeneral', "配置字体变体。它可以是一个布尔值，用于启用或禁用从 font-weight 到 font-variation-settings 的转换；也可以是一个字符串，表示 CSS 属性 font-variation-settings 的取值。"),
				default: false
			}
		);
	}

	public validate(input: unknown): string {
		if (typeof input === 'undefined') {
			return this.defaultValue;
		}
		if (typeof input === 'string') {
			if (input === 'false') {
				return EditorFontVariations.OFF;
			}
			if (input === 'true') {
				return EditorFontVariations.TRANSLATE;
			}
			return input;
		}
		if (Boolean(input)) {
			return EditorFontVariations.TRANSLATE;
		}
		return EditorFontVariations.OFF;
	}

	public override compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: string): string {
		// The value is computed from the fontWeight if it is true.
		// So take the result from env.fontInfo
		return env.fontInfo.fontVariationSettings;
	}
}

//#endregion

//#region fontInfo

class EditorFontInfo extends ComputedEditorOption<EditorOption.fontInfo, FontInfo> {

	constructor() {
		super(EditorOption.fontInfo, new FontInfo({
			pixelRatio: 0,
			fontFamily: '',
			fontWeight: '',
			fontSize: 0,
			fontFeatureSettings: '',
			fontVariationSettings: '',
			lineHeight: 0,
			letterSpacing: 0,
			isMonospace: false,
			typicalHalfwidthCharacterWidth: 0,
			typicalFullwidthCharacterWidth: 0,
			canUseHalfwidthRightwardsArrow: false,
			spaceWidth: 0,
			middotWidth: 0,
			wsmiddotWidth: 0,
			maxDigitWidth: 0,
		}, false));
	}

	public compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, _: FontInfo): FontInfo {
		return env.fontInfo;
	}
}

//#endregion

//#region effectiveCursorStyle

class EffectiveCursorStyle extends ComputedEditorOption<EditorOption.effectiveCursorStyle, TextEditorCursorStyle> {

	constructor() {
		super(EditorOption.effectiveCursorStyle, TextEditorCursorStyle.Line);
	}

	public compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, _: TextEditorCursorStyle): TextEditorCursorStyle {
		return env.inputMode === 'overtype' ?
			options.get(EditorOption.overtypeCursorStyle) :
			options.get(EditorOption.cursorStyle);
	}
}

//#endregion

//#region effectiveExperimentalEditContext

class EffectiveEditContextEnabled extends ComputedEditorOption<EditorOption.effectiveEditContext, boolean> {

	constructor() {
		super(EditorOption.effectiveEditContext, false);
	}

	public compute(env: IEnvironmentalOptions, options: IComputedEditorOptions): boolean {
		return env.editContextSupported && options.get(EditorOption.editContext);
	}
}

//#endregion

//#region effectiveAllowVariableFonts

class EffectiveAllowVariableFonts extends ComputedEditorOption<EditorOption.effectiveAllowVariableFonts, boolean> {

	constructor() {
		super(EditorOption.effectiveAllowVariableFonts, false);
	}

	public compute(env: IEnvironmentalOptions, options: IComputedEditorOptions): boolean {
		const accessibilitySupport = env.accessibilitySupport;
		if (accessibilitySupport === AccessibilitySupport.Enabled) {
			return options.get(EditorOption.allowVariableFontsInAccessibilityMode);
		} else {
			return options.get(EditorOption.allowVariableFonts);
		}
	}
}

//#engregion

//#region effectiveFullwidthCharacterWidth

class EffectiveFullwidthCharacterWidth extends ComputedEditorOption<EditorOption.effectiveFullwidthCharacterWidth, 'font' | 'twoCells'> {

	constructor() {
		super(EditorOption.effectiveFullwidthCharacterWidth, 'font');
	}

	public compute(env: IEnvironmentalOptions, options: IComputedEditorOptions): 'font' | 'twoCells' {
		if (options.get(EditorOption.fullwidthCharacterWidth) === 'twoCells' && env.fontInfo.isMonospace) {
			return 'twoCells';
		}
		return 'font';
	}
}

//#endregion

//#region fontSize

class EditorFontSize extends SimpleEditorOption<EditorOption.fontSize, number> {

	constructor() {
		super(
			EditorOption.fontSize, 'fontSize', EDITOR_FONT_DEFAULTS.fontSize,
			{
				type: 'number',
				minimum: 6,
				maximum: 100,
				default: EDITOR_FONT_DEFAULTS.fontSize,
				description: nls.localize('fontSize', "控制字号（像素）。")
			}
		);
	}

	public override validate(input: unknown): number {
		const r = EditorFloatOption.float(input, this.defaultValue);
		if (r === 0) {
			return EDITOR_FONT_DEFAULTS.fontSize;
		}
		return EditorFloatOption.clamp(r, 6, 100);
	}
	public override compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: number): number {
		// The final fontSize respects the editor zoom level.
		// So take the result from env.fontInfo
		return env.fontInfo.fontSize;
	}
}

//#endregion

//#region fontWeight

class EditorFontWeight extends BaseEditorOption<EditorOption.fontWeight, string, string> {
	private static SUGGESTION_VALUES = ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
	private static MINIMUM_VALUE = 1;
	private static MAXIMUM_VALUE = 1000;

	constructor() {
		super(
			EditorOption.fontWeight, 'fontWeight', EDITOR_FONT_DEFAULTS.fontWeight,
			{
				anyOf: [
					{
						type: 'number',
						minimum: EditorFontWeight.MINIMUM_VALUE,
						maximum: EditorFontWeight.MAXIMUM_VALUE,
						errorMessage: nls.localize('fontWeightErrorMessage', "只允许 \"normal\" 和 \"bold\" 关键字，或 1 到 1000 之间的数字。")
					},
					{
						type: 'string',
						pattern: '^(normal|bold|1000|[1-9][0-9]{0,2})$'
					},
					{
						enum: EditorFontWeight.SUGGESTION_VALUES
					}
				],
				default: EDITOR_FONT_DEFAULTS.fontWeight,
				description: nls.localize('fontWeight', "控制字重。接受 \"normal\" 和 \"bold\" 关键字，或 1 到 1000 之间的数字。")
			}
		);
	}

	public validate(input: unknown): string {
		if (input === 'normal' || input === 'bold') {
			return input;
		}
		return String(EditorIntOption.clampedInt(input, EDITOR_FONT_DEFAULTS.fontWeight, EditorFontWeight.MINIMUM_VALUE, EditorFontWeight.MAXIMUM_VALUE));
	}
}

//#endregion

//#region gotoLocation

export type GoToLocationValues = 'peek' | 'gotoAndPeek' | 'goto';

/**
 * Configuration options for go to location
 */
export interface IGotoLocationOptions {

	multiple?: GoToLocationValues;

	multipleDefinitions?: GoToLocationValues;
	multipleTypeDefinitions?: GoToLocationValues;
	multipleDeclarations?: GoToLocationValues;
	multipleImplementations?: GoToLocationValues;
	multipleReferences?: GoToLocationValues;
	multipleTests?: GoToLocationValues;

	alternativeDefinitionCommand?: string;
	alternativeTypeDefinitionCommand?: string;
	alternativeDeclarationCommand?: string;
	alternativeImplementationCommand?: string;
	alternativeReferenceCommand?: string;
	alternativeTestsCommand?: string;
}

/**
 * @internal
 */
export type GoToLocationOptions = Readonly<Required<IGotoLocationOptions>>;

class EditorGoToLocation extends BaseEditorOption<EditorOption.gotoLocation, IGotoLocationOptions, GoToLocationOptions> {

	constructor() {
		const defaults: GoToLocationOptions = {
			multiple: 'peek',
			multipleDefinitions: 'peek',
			multipleTypeDefinitions: 'peek',
			multipleDeclarations: 'peek',
			multipleImplementations: 'peek',
			multipleReferences: 'peek',
			multipleTests: 'peek',
			alternativeDefinitionCommand: 'editor.action.goToReferences',
			alternativeTypeDefinitionCommand: 'editor.action.goToReferences',
			alternativeDeclarationCommand: 'editor.action.goToReferences',
			alternativeImplementationCommand: '',
			alternativeReferenceCommand: '',
			alternativeTestsCommand: '',
		};
		const jsonSubset: IJSONSchema = {
			type: 'string',
			enum: ['peek', 'gotoAndPeek', 'goto'],
			default: defaults.multiple,
			enumDescriptions: [
				nls.localize('editor.gotoLocation.multiple.peek', "显示结果的速览视图（默认）"),
				nls.localize('editor.gotoLocation.multiple.gotoAndPeek', "转到主要结果并显示速览视图"),
				nls.localize('editor.gotoLocation.multiple.goto', "转到主要结果并启用无需速览的其他结果导航")
			]
		};
		const alternativeCommandOptions = ['', 'editor.action.referenceSearch.trigger', 'editor.action.goToReferences', 'editor.action.peekImplementation', 'editor.action.goToImplementation', 'editor.action.peekTypeDefinition', 'editor.action.goToTypeDefinition', 'editor.action.peekDeclaration', 'editor.action.revealDeclaration', 'editor.action.peekDefinition', 'editor.action.revealDefinitionAside', 'editor.action.revealDefinition'];
		super(
			EditorOption.gotoLocation, 'gotoLocation', defaults,
			{
				'editor.gotoLocation.multiple': {
					deprecationMessage: nls.localize('editor.gotoLocation.multiple.deprecated', "此设置已废弃，请改用 'editor.editor.gotoLocation.multipleDefinitions' 或 'editor.editor.gotoLocation.multipleImplementations' 等单独设置。"),
				},
				'editor.gotoLocation.multipleDefinitions': {
					description: nls.localize('editor.editor.gotoLocation.multipleDefinitions', "当存在多个目标位置时，控制「转到定义」命令的行为。"),
					...jsonSubset,
				},
				'editor.gotoLocation.multipleTypeDefinitions': {
					description: nls.localize('editor.editor.gotoLocation.multipleTypeDefinitions', "当存在多个目标位置时，控制「转到类型定义」命令的行为。"),
					...jsonSubset,
				},
				'editor.gotoLocation.multipleDeclarations': {
					description: nls.localize('editor.editor.gotoLocation.multipleDeclarations', "当存在多个目标位置时，控制「转到声明」命令的行为。"),
					...jsonSubset,
				},
				'editor.gotoLocation.multipleImplementations': {
					description: nls.localize('editor.editor.gotoLocation.multipleImplemenattions', "当存在多个目标位置时，控制「转到实现」命令的行为。"),
					...jsonSubset,
				},
				'editor.gotoLocation.multipleReferences': {
					description: nls.localize('editor.editor.gotoLocation.multipleReferences', "当存在多个目标位置时，控制「转到引用」命令的行为。"),
					...jsonSubset,
				},
				'editor.gotoLocation.alternativeDefinitionCommand': {
					type: 'string',
					default: defaults.alternativeDefinitionCommand,
					enum: alternativeCommandOptions,
					description: nls.localize('alternativeDefinitionCommand', "当「转到定义」的结果就是当前位置时，执行的其他命令 ID。")
				},
				'editor.gotoLocation.alternativeTypeDefinitionCommand': {
					type: 'string',
					default: defaults.alternativeTypeDefinitionCommand,
					enum: alternativeCommandOptions,
					description: nls.localize('alternativeTypeDefinitionCommand', "当「转到类型定义」的结果就是当前位置时，执行的其他命令 ID。")
				},
				'editor.gotoLocation.alternativeDeclarationCommand': {
					type: 'string',
					default: defaults.alternativeDeclarationCommand,
					enum: alternativeCommandOptions,
					description: nls.localize('alternativeDeclarationCommand', "当「转到声明」的结果就是当前位置时，执行的其他命令 ID。")
				},
				'editor.gotoLocation.alternativeImplementationCommand': {
					type: 'string',
					default: defaults.alternativeImplementationCommand,
					enum: alternativeCommandOptions,
					description: nls.localize('alternativeImplementationCommand', "当「转到实现」的结果就是当前位置时，执行的其他命令 ID。")
				},
				'editor.gotoLocation.alternativeReferenceCommand': {
					type: 'string',
					default: defaults.alternativeReferenceCommand,
					enum: alternativeCommandOptions,
					description: nls.localize('alternativeReferenceCommand', "当「转到引用」的结果就是当前位置时，执行的其他命令 ID。")
				},
			}
		);
	}

	public validate(_input: unknown): GoToLocationOptions {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue;
		}
		const input = _input as Unknown<IGotoLocationOptions>;
		return {
			multiple: stringSet<GoToLocationValues>(input.multiple, this.defaultValue.multiple, ['peek', 'gotoAndPeek', 'goto']),
			multipleDefinitions: stringSet<GoToLocationValues>(input.multipleDefinitions, 'peek', ['peek', 'gotoAndPeek', 'goto']),
			multipleTypeDefinitions: stringSet<GoToLocationValues>(input.multipleTypeDefinitions, 'peek', ['peek', 'gotoAndPeek', 'goto']),
			multipleDeclarations: stringSet<GoToLocationValues>(input.multipleDeclarations, 'peek', ['peek', 'gotoAndPeek', 'goto']),
			multipleImplementations: stringSet<GoToLocationValues>(input.multipleImplementations, 'peek', ['peek', 'gotoAndPeek', 'goto']),
			multipleReferences: stringSet<GoToLocationValues>(input.multipleReferences, 'peek', ['peek', 'gotoAndPeek', 'goto']),
			multipleTests: stringSet<GoToLocationValues>(input.multipleTests, 'peek', ['peek', 'gotoAndPeek', 'goto']),
			alternativeDefinitionCommand: EditorStringOption.string(input.alternativeDefinitionCommand, this.defaultValue.alternativeDefinitionCommand),
			alternativeTypeDefinitionCommand: EditorStringOption.string(input.alternativeTypeDefinitionCommand, this.defaultValue.alternativeTypeDefinitionCommand),
			alternativeDeclarationCommand: EditorStringOption.string(input.alternativeDeclarationCommand, this.defaultValue.alternativeDeclarationCommand),
			alternativeImplementationCommand: EditorStringOption.string(input.alternativeImplementationCommand, this.defaultValue.alternativeImplementationCommand),
			alternativeReferenceCommand: EditorStringOption.string(input.alternativeReferenceCommand, this.defaultValue.alternativeReferenceCommand),
			alternativeTestsCommand: EditorStringOption.string(input.alternativeTestsCommand, this.defaultValue.alternativeTestsCommand),
		};
	}
}

//#endregion

//#region hover

/**
 * Configuration options for editor hover
 */
export interface IEditorHoverOptions {
	/**
	 * Enable the hover.
	 * Defaults to 'on'.
	 */
	enabled?: 'on' | 'off' | 'onKeyboardModifier';
	/**
	 * Delay for showing the hover.
	 * Defaults to 300.
	 */
	delay?: number;
	/**
	 * Is the hover sticky such that it can be clicked and its contents selected?
	 * Defaults to true.
	 */
	sticky?: boolean;
	/**
	 * Controls how long the hover is visible after you hovered out of it.
	 * Require sticky setting to be true.
	 */
	hidingDelay?: number;
	/**
	 * Should the hover be shown above the line if possible?
	 * Defaults to false.
	 */
	above?: boolean;
	/**
	 * Should long line warning hovers be shown (tokenization skipped, rendering paused)?
	 * Defaults to true.
	 */
	showLongLineWarning?: boolean;
}

/**
 * @internal
 */
export type EditorHoverOptions = Readonly<Required<IEditorHoverOptions>>;

class EditorHover extends BaseEditorOption<EditorOption.hover, IEditorHoverOptions, EditorHoverOptions> {

	constructor() {
		const defaults: EditorHoverOptions = {
			enabled: 'on',
			delay: 300,
			hidingDelay: 300,
			sticky: true,
			above: true,
			showLongLineWarning: true,
		};
		super(
			EditorOption.hover, 'hover', defaults,
			{
				'editor.hover.enabled': {
					type: 'string',
					enum: ['on', 'off', 'onKeyboardModifier'],
					default: defaults.enabled,
					markdownEnumDescriptions: [
						nls.localize('hover.enabled.on', "悬停提示已启用。"),
						nls.localize('hover.enabled.off', "悬停提示已禁用。"),
						nls.localize('hover.enabled.onKeyboardModifier', "按住 `{0}` 或 `Alt`（与 `#editor.multiCursorModifier#` 相反的修饰键）时显示悬停提示", platform.isMacintosh ? `Command` : `Control`)
					],
					description: nls.localize('hover.enabled', "控制是否显示悬停提示。"),
					keywords: ['hint', 'info', 'tooltip']
				},
				'editor.hover.delay': {
					type: 'number',
					default: defaults.delay,
					minimum: 0,
					maximum: 10000,
					description: nls.localize('hover.delay', "控制显示悬停提示前的延迟（毫秒）。")
				},
				'editor.hover.sticky': {
					type: 'boolean',
					default: defaults.sticky,
					description: nls.localize('hover.sticky', "控制鼠标移入悬停提示时它是否保持可见。")
				},
				'editor.hover.hidingDelay': {
					type: 'integer',
					minimum: 0,
					default: defaults.hidingDelay,
					markdownDescription: nls.localize('hover.hidingDelay', "控制隐藏悬停提示前的延迟（毫秒）。需要启用 `#editor.hover.sticky#`。")
				},
				'editor.hover.above': {
					type: 'boolean',
					default: defaults.above,
					description: nls.localize('hover.above', "空间足够时优先把悬停提示显示在行上方。")
				},
				'editor.hover.showLongLineWarning': {
					type: 'boolean',
					default: defaults.showLongLineWarning,
					description: nls.localize('hover.showLongLineWarning', "控制是否显示长行警告类悬停提示，例如在跳过分词或暂停渲染时。")
				},
			}
		);
	}

	public validate(_input: unknown): EditorHoverOptions {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue;
		}
		const input = _input as Unknown<IEditorHoverOptions>;
		return {
			enabled: stringSet<'on' | 'off' | 'onKeyboardModifier'>(input.enabled, this.defaultValue.enabled, ['on', 'off', 'onKeyboardModifier']),
			delay: EditorIntOption.clampedInt(input.delay, this.defaultValue.delay, 0, 10000),
			sticky: boolean(input.sticky, this.defaultValue.sticky),
			hidingDelay: EditorIntOption.clampedInt(input.hidingDelay, this.defaultValue.hidingDelay, 0, 600000),
			above: boolean(input.above, this.defaultValue.above),
			showLongLineWarning: boolean(input.showLongLineWarning, this.defaultValue.showLongLineWarning),
		};
	}
}

//#endregion

//#region layoutInfo

/**
 * A description for the overview ruler position.
 */
export interface OverviewRulerPosition {
	/**
	 * Width of the overview ruler
	 */
	readonly width: number;
	/**
	 * Height of the overview ruler
	 */
	readonly height: number;
	/**
	 * Top position for the overview ruler
	 */
	readonly top: number;
	/**
	 * Right position for the overview ruler
	 */
	readonly right: number;
}

export const enum RenderMinimap {
	None = 0,
	Text = 1,
	Blocks = 2,
}

/**
 * The internal layout details of the editor.
 */
export interface EditorLayoutInfo {

	/**
	 * Full editor width.
	 */
	readonly width: number;
	/**
	 * Full editor height.
	 */
	readonly height: number;

	/**
	 * Left position for the glyph margin.
	 */
	readonly glyphMarginLeft: number;
	/**
	 * The width of the glyph margin.
	 */
	readonly glyphMarginWidth: number;

	/**
	 * The number of decoration lanes to render in the glyph margin.
	 */
	readonly glyphMarginDecorationLaneCount: number;

	/**
	 * Left position for the line numbers.
	 */
	readonly lineNumbersLeft: number;
	/**
	 * The width of the line numbers.
	 */
	readonly lineNumbersWidth: number;

	/**
	 * Left position for the line decorations.
	 */
	readonly decorationsLeft: number;
	/**
	 * The width of the line decorations.
	 */
	readonly decorationsWidth: number;

	/**
	 * Left position for the content (actual text)
	 */
	readonly contentLeft: number;
	/**
	 * The width of the content (actual text)
	 */
	readonly contentWidth: number;

	/**
	 * Layout information for the minimap
	 */
	readonly minimap: EditorMinimapLayoutInfo;

	/**
	 * The number of columns (of typical characters) fitting on a viewport line.
	 */
	readonly viewportColumn: number;

	readonly isWordWrapMinified: boolean;
	readonly isViewportWrapping: boolean;
	readonly wrappingColumn: number;

	/**
	 * The width of the vertical scrollbar.
	 */
	readonly verticalScrollbarWidth: number;
	/**
	 * The height of the horizontal scrollbar.
	 */
	readonly horizontalScrollbarHeight: number;

	/**
	 * The position of the overview ruler.
	 */
	readonly overviewRuler: OverviewRulerPosition;
}

/**
 * The internal layout details of the editor.
 */
export interface EditorMinimapLayoutInfo {
	readonly renderMinimap: RenderMinimap;
	readonly minimapLeft: number;
	readonly minimapWidth: number;
	readonly minimapHeightIsEditorHeight: boolean;
	readonly minimapIsSampling: boolean;
	readonly minimapScale: number;
	readonly minimapLineHeight: number;
	readonly minimapCanvasInnerWidth: number;
	readonly minimapCanvasInnerHeight: number;
	readonly minimapCanvasOuterWidth: number;
	readonly minimapCanvasOuterHeight: number;
}

/**
 * @internal
 */
export interface EditorLayoutInfoComputerEnv {
	readonly memory: ComputeOptionsMemory | null;
	readonly outerWidth: number;
	readonly outerHeight: number;
	readonly isDominatedByLongLines: boolean;
	readonly lineHeight: number;
	readonly viewLineCount: number;
	readonly lineNumbersDigitCount: number;
	readonly typicalHalfwidthCharacterWidth: number;
	readonly maxDigitWidth: number;
	readonly pixelRatio: number;
	readonly glyphMarginDecorationLaneCount: number;
}

/**
 * @internal
 */
export interface IEditorLayoutComputerInput {
	readonly outerWidth: number;
	readonly outerHeight: number;
	readonly isDominatedByLongLines: boolean;
	readonly lineHeight: number;
	readonly lineNumbersDigitCount: number;
	readonly typicalHalfwidthCharacterWidth: number;
	readonly maxDigitWidth: number;
	readonly pixelRatio: number;
	readonly glyphMargin: boolean;
	readonly lineDecorationsWidth: string | number;
	readonly folding: boolean;
	readonly minimap: Readonly<Required<IEditorMinimapOptions>>;
	readonly scrollbar: InternalEditorScrollbarOptions;
	readonly lineNumbers: InternalEditorRenderLineNumbersOptions;
	readonly lineNumbersMinChars: number;
	readonly scrollBeyondLastLine: boolean;
	readonly wordWrap: 'wordWrapColumn' | 'on' | 'off' | 'bounded';
	readonly wordWrapColumn: number;
	readonly wordWrapMinified: boolean;
	readonly accessibilitySupport: AccessibilitySupport;
}

/**
 * @internal
 */
export interface IMinimapLayoutInput {
	readonly outerWidth: number;
	readonly outerHeight: number;
	readonly lineHeight: number;
	readonly typicalHalfwidthCharacterWidth: number;
	readonly pixelRatio: number;
	readonly scrollBeyondLastLine: boolean;
	readonly paddingTop: number;
	readonly paddingBottom: number;
	readonly minimap: Readonly<Required<IEditorMinimapOptions>>;
	readonly verticalScrollbarWidth: number;
	readonly viewLineCount: number;
	readonly remainingWidth: number;
	readonly isViewportWrapping: boolean;
}

/**
 * @internal
 */
export class EditorLayoutInfoComputer extends ComputedEditorOption<EditorOption.layoutInfo, EditorLayoutInfo> {

	constructor() {
		super(EditorOption.layoutInfo, {
			width: 0,
			height: 0,
			glyphMarginLeft: 0,
			glyphMarginWidth: 0,
			glyphMarginDecorationLaneCount: 0,
			lineNumbersLeft: 0,
			lineNumbersWidth: 0,
			decorationsLeft: 0,
			decorationsWidth: 0,
			contentLeft: 0,
			contentWidth: 0,
			minimap: {
				renderMinimap: RenderMinimap.None,
				minimapLeft: 0,
				minimapWidth: 0,
				minimapHeightIsEditorHeight: false,
				minimapIsSampling: false,
				minimapScale: 1,
				minimapLineHeight: 1,
				minimapCanvasInnerWidth: 0,
				minimapCanvasInnerHeight: 0,
				minimapCanvasOuterWidth: 0,
				minimapCanvasOuterHeight: 0,
			},
			viewportColumn: 0,
			isWordWrapMinified: false,
			isViewportWrapping: false,
			wrappingColumn: -1,
			verticalScrollbarWidth: 0,
			horizontalScrollbarHeight: 0,
			overviewRuler: {
				top: 0,
				width: 0,
				height: 0,
				right: 0
			}
		});
	}

	public compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, _: EditorLayoutInfo): EditorLayoutInfo {
		return EditorLayoutInfoComputer.computeLayout(options, {
			memory: env.memory,
			outerWidth: env.outerWidth,
			outerHeight: env.outerHeight,
			isDominatedByLongLines: env.isDominatedByLongLines,
			lineHeight: env.fontInfo.lineHeight,
			viewLineCount: env.viewLineCount,
			lineNumbersDigitCount: env.lineNumbersDigitCount,
			typicalHalfwidthCharacterWidth: env.fontInfo.typicalHalfwidthCharacterWidth,
			maxDigitWidth: env.fontInfo.maxDigitWidth,
			pixelRatio: env.pixelRatio,
			glyphMarginDecorationLaneCount: env.glyphMarginDecorationLaneCount
		});
	}

	public static computeContainedMinimapLineCount(input: {
		viewLineCount: number;
		scrollBeyondLastLine: boolean;
		paddingTop: number;
		paddingBottom: number;
		height: number;
		lineHeight: number;
		pixelRatio: number;
	}): { typicalViewportLineCount: number; extraLinesBeforeFirstLine: number; extraLinesBeyondLastLine: number; desiredRatio: number; minimapLineCount: number } {
		const typicalViewportLineCount = input.height / input.lineHeight;
		const extraLinesBeforeFirstLine = Math.floor(input.paddingTop / input.lineHeight);
		let extraLinesBeyondLastLine = Math.floor(input.paddingBottom / input.lineHeight);
		if (input.scrollBeyondLastLine) {
			extraLinesBeyondLastLine = Math.max(extraLinesBeyondLastLine, typicalViewportLineCount - 1);
		}
		const desiredRatio = (extraLinesBeforeFirstLine + input.viewLineCount + extraLinesBeyondLastLine) / (input.pixelRatio * input.height);
		const minimapLineCount = Math.floor(input.viewLineCount / desiredRatio);
		return { typicalViewportLineCount, extraLinesBeforeFirstLine, extraLinesBeyondLastLine, desiredRatio, minimapLineCount };
	}

	private static _computeMinimapLayout(input: IMinimapLayoutInput, memory: ComputeOptionsMemory): EditorMinimapLayoutInfo {
		const outerWidth = input.outerWidth;
		const outerHeight = input.outerHeight;
		const pixelRatio = input.pixelRatio;

		if (!input.minimap.enabled) {
			return {
				renderMinimap: RenderMinimap.None,
				minimapLeft: 0,
				minimapWidth: 0,
				minimapHeightIsEditorHeight: false,
				minimapIsSampling: false,
				minimapScale: 1,
				minimapLineHeight: 1,
				minimapCanvasInnerWidth: 0,
				minimapCanvasInnerHeight: Math.floor(pixelRatio * outerHeight),
				minimapCanvasOuterWidth: 0,
				minimapCanvasOuterHeight: outerHeight,
			};
		}

		// Can use memory if only the `viewLineCount` and `remainingWidth` have changed
		const stableMinimapLayoutInput = memory.stableMinimapLayoutInput;
		const couldUseMemory = (
			stableMinimapLayoutInput
			// && input.outerWidth === lastMinimapLayoutInput.outerWidth !!! INTENTIONAL OMITTED
			&& input.outerHeight === stableMinimapLayoutInput.outerHeight
			&& input.lineHeight === stableMinimapLayoutInput.lineHeight
			&& input.typicalHalfwidthCharacterWidth === stableMinimapLayoutInput.typicalHalfwidthCharacterWidth
			&& input.pixelRatio === stableMinimapLayoutInput.pixelRatio
			&& input.scrollBeyondLastLine === stableMinimapLayoutInput.scrollBeyondLastLine
			&& input.paddingTop === stableMinimapLayoutInput.paddingTop
			&& input.paddingBottom === stableMinimapLayoutInput.paddingBottom
			&& input.minimap.enabled === stableMinimapLayoutInput.minimap.enabled
			&& input.minimap.side === stableMinimapLayoutInput.minimap.side
			&& input.minimap.size === stableMinimapLayoutInput.minimap.size
			&& input.minimap.showSlider === stableMinimapLayoutInput.minimap.showSlider
			&& input.minimap.renderCharacters === stableMinimapLayoutInput.minimap.renderCharacters
			&& input.minimap.maxColumn === stableMinimapLayoutInput.minimap.maxColumn
			&& input.minimap.scale === stableMinimapLayoutInput.minimap.scale
			&& input.verticalScrollbarWidth === stableMinimapLayoutInput.verticalScrollbarWidth
			// && input.viewLineCount === lastMinimapLayoutInput.viewLineCount !!! INTENTIONAL OMITTED
			// && input.remainingWidth === lastMinimapLayoutInput.remainingWidth !!! INTENTIONAL OMITTED
			&& input.isViewportWrapping === stableMinimapLayoutInput.isViewportWrapping
		);

		const lineHeight = input.lineHeight;
		const typicalHalfwidthCharacterWidth = input.typicalHalfwidthCharacterWidth;
		const scrollBeyondLastLine = input.scrollBeyondLastLine;
		const minimapRenderCharacters = input.minimap.renderCharacters;
		let minimapScale = (pixelRatio >= 2 ? Math.round(input.minimap.scale * 2) : input.minimap.scale);
		const minimapMaxColumn = input.minimap.maxColumn;
		const minimapSize = input.minimap.size;
		const minimapSide = input.minimap.side;
		const verticalScrollbarWidth = input.verticalScrollbarWidth;
		const viewLineCount = input.viewLineCount;
		const remainingWidth = input.remainingWidth;
		const isViewportWrapping = input.isViewportWrapping;

		const baseCharHeight = minimapRenderCharacters ? 2 : 3;
		let minimapCanvasInnerHeight = Math.floor(pixelRatio * outerHeight);
		const minimapCanvasOuterHeight = minimapCanvasInnerHeight / pixelRatio;
		let minimapHeightIsEditorHeight = false;
		let minimapIsSampling = false;
		let minimapLineHeight = baseCharHeight * minimapScale;
		let minimapCharWidth = minimapScale / pixelRatio;
		let minimapWidthMultiplier: number = 1;

		if (minimapSize === 'fill' || minimapSize === 'fit') {
			const { typicalViewportLineCount, extraLinesBeforeFirstLine, extraLinesBeyondLastLine, desiredRatio, minimapLineCount } = EditorLayoutInfoComputer.computeContainedMinimapLineCount({
				viewLineCount: viewLineCount,
				scrollBeyondLastLine: scrollBeyondLastLine,
				paddingTop: input.paddingTop,
				paddingBottom: input.paddingBottom,
				height: outerHeight,
				lineHeight: lineHeight,
				pixelRatio: pixelRatio
			});
			// ratio is intentionally not part of the layout to avoid the layout changing all the time
			// when doing sampling
			const ratio = viewLineCount / minimapLineCount;

			if (ratio > 1) {
				minimapHeightIsEditorHeight = true;
				minimapIsSampling = true;
				minimapScale = 1;
				minimapLineHeight = 1;
				minimapCharWidth = minimapScale / pixelRatio;
			} else {
				let fitBecomesFill = false;
				let maxMinimapScale = minimapScale + 1;

				if (minimapSize === 'fit') {
					const effectiveMinimapHeight = Math.ceil((extraLinesBeforeFirstLine + viewLineCount + extraLinesBeyondLastLine) * minimapLineHeight);
					if (isViewportWrapping && couldUseMemory && remainingWidth <= memory.stableFitRemainingWidth) {
						// There is a loop when using `fit` and viewport wrapping:
						// - view line count impacts minimap layout
						// - minimap layout impacts viewport width
						// - viewport width impacts view line count
						// To break the loop, once we go to a smaller minimap scale, we try to stick with it.
						fitBecomesFill = true;
						maxMinimapScale = memory.stableFitMaxMinimapScale;
					} else {
						fitBecomesFill = (effectiveMinimapHeight > minimapCanvasInnerHeight);
					}
				}

				if (minimapSize === 'fill' || fitBecomesFill) {
					minimapHeightIsEditorHeight = true;
					const configuredMinimapScale = minimapScale;
					minimapLineHeight = Math.min(lineHeight * pixelRatio, Math.max(1, Math.floor(1 / desiredRatio)));
					if (isViewportWrapping && couldUseMemory && remainingWidth <= memory.stableFitRemainingWidth) {
						// There is a loop when using `fill` and viewport wrapping:
						// - view line count impacts minimap layout
						// - minimap layout impacts viewport width
						// - viewport width impacts view line count
						// To break the loop, once we go to a smaller minimap scale, we try to stick with it.
						maxMinimapScale = memory.stableFitMaxMinimapScale;
					}
					minimapScale = Math.min(maxMinimapScale, Math.max(1, Math.floor(minimapLineHeight / baseCharHeight)));
					if (minimapScale > configuredMinimapScale) {
						minimapWidthMultiplier = Math.min(2, minimapScale / configuredMinimapScale);
					}
					minimapCharWidth = minimapScale / pixelRatio / minimapWidthMultiplier;
					minimapCanvasInnerHeight = Math.ceil((Math.max(typicalViewportLineCount, extraLinesBeforeFirstLine + viewLineCount + extraLinesBeyondLastLine)) * minimapLineHeight);
					if (isViewportWrapping) {
						// remember for next time
						memory.stableMinimapLayoutInput = input;
						memory.stableFitRemainingWidth = remainingWidth;
						memory.stableFitMaxMinimapScale = minimapScale;
					} else {
						memory.stableMinimapLayoutInput = null;
						memory.stableFitRemainingWidth = 0;
					}
				}
			}
		}

		// Given:
		// (leaving 2px for the cursor to have space after the last character)
		// viewportColumn = (contentWidth - verticalScrollbarWidth - 2) / typicalHalfwidthCharacterWidth
		// minimapWidth = viewportColumn * minimapCharWidth
		// contentWidth = remainingWidth - minimapWidth
		// What are good values for contentWidth and minimapWidth ?

		// minimapWidth = ((contentWidth - verticalScrollbarWidth - 2) / typicalHalfwidthCharacterWidth) * minimapCharWidth
		// typicalHalfwidthCharacterWidth * minimapWidth = (contentWidth - verticalScrollbarWidth - 2) * minimapCharWidth
		// typicalHalfwidthCharacterWidth * minimapWidth = (remainingWidth - minimapWidth - verticalScrollbarWidth - 2) * minimapCharWidth
		// (typicalHalfwidthCharacterWidth + minimapCharWidth) * minimapWidth = (remainingWidth - verticalScrollbarWidth - 2) * minimapCharWidth
		// minimapWidth = ((remainingWidth - verticalScrollbarWidth - 2) * minimapCharWidth) / (typicalHalfwidthCharacterWidth + minimapCharWidth)

		const minimapMaxWidth = Math.floor(minimapMaxColumn * minimapCharWidth);
		const minimapWidth = Math.min(minimapMaxWidth, Math.max(0, Math.floor(((remainingWidth - verticalScrollbarWidth - 2) * minimapCharWidth) / (typicalHalfwidthCharacterWidth + minimapCharWidth))) + MINIMAP_GUTTER_WIDTH);

		let minimapCanvasInnerWidth = Math.floor(pixelRatio * minimapWidth);
		const minimapCanvasOuterWidth = minimapCanvasInnerWidth / pixelRatio;
		minimapCanvasInnerWidth = Math.floor(minimapCanvasInnerWidth * minimapWidthMultiplier);

		const renderMinimap = (minimapRenderCharacters ? RenderMinimap.Text : RenderMinimap.Blocks);
		const minimapLeft = (minimapSide === 'left' ? 0 : (outerWidth - minimapWidth - verticalScrollbarWidth));

		return {
			renderMinimap,
			minimapLeft,
			minimapWidth,
			minimapHeightIsEditorHeight,
			minimapIsSampling,
			minimapScale,
			minimapLineHeight,
			minimapCanvasInnerWidth,
			minimapCanvasInnerHeight,
			minimapCanvasOuterWidth,
			minimapCanvasOuterHeight,
		};
	}

	public static computeLayout(options: IComputedEditorOptions, env: EditorLayoutInfoComputerEnv): EditorLayoutInfo {
		const outerWidth = env.outerWidth | 0;
		const outerHeight = env.outerHeight | 0;
		const lineHeight = env.lineHeight | 0;
		const lineNumbersDigitCount = env.lineNumbersDigitCount | 0;
		const typicalHalfwidthCharacterWidth = env.typicalHalfwidthCharacterWidth;
		const maxDigitWidth = env.maxDigitWidth;
		const pixelRatio = env.pixelRatio;
		const viewLineCount = env.viewLineCount;

		const wordWrapOverride2 = options.get(EditorOption.wordWrapOverride2);
		const wordWrapOverride1 = (wordWrapOverride2 === 'inherit' ? options.get(EditorOption.wordWrapOverride1) : wordWrapOverride2);
		const wordWrap = (wordWrapOverride1 === 'inherit' ? options.get(EditorOption.wordWrap) : wordWrapOverride1);

		const wordWrapColumn = options.get(EditorOption.wordWrapColumn);
		const wordWrapIndicator = options.get(EditorOption.wordWrapIndicator);
		const isDominatedByLongLines = env.isDominatedByLongLines;

		const showGlyphMargin = options.get(EditorOption.glyphMargin);
		const showLineNumbers = (options.get(EditorOption.lineNumbers).renderType !== RenderLineNumbersType.Off);
		const lineNumbersMinChars = options.get(EditorOption.lineNumbersMinChars);
		const scrollBeyondLastLine = options.get(EditorOption.scrollBeyondLastLine);
		const padding = options.get(EditorOption.padding);
		const minimap = options.get(EditorOption.minimap);

		const scrollbar = options.get(EditorOption.scrollbar);
		const verticalScrollbarWidth = scrollbar.verticalScrollbarSize;
		const verticalScrollbarHasArrows = scrollbar.verticalHasArrows;
		const scrollbarArrowSize = scrollbar.arrowSize;
		const horizontalScrollbarHeight = scrollbar.horizontalScrollbarSize;

		const folding = options.get(EditorOption.folding);
		const showFoldingDecoration = options.get(EditorOption.showFoldingControls) !== 'never';

		let lineDecorationsWidth = options.get(EditorOption.lineDecorationsWidth);
		if (folding && showFoldingDecoration) {
			lineDecorationsWidth += 16;
		}

		let lineNumbersWidth = 0;
		if (showLineNumbers) {
			const digitCount = Math.max(lineNumbersDigitCount, lineNumbersMinChars);
			lineNumbersWidth = Math.round(digitCount * maxDigitWidth);
		}

		let glyphMarginWidth = 0;
		if (showGlyphMargin) {
			glyphMarginWidth = lineHeight * env.glyphMarginDecorationLaneCount;
		}

		let glyphMarginLeft = 0;
		let lineNumbersLeft = glyphMarginLeft + glyphMarginWidth;
		let decorationsLeft = lineNumbersLeft + lineNumbersWidth;
		let contentLeft = decorationsLeft + lineDecorationsWidth;

		const remainingWidth = outerWidth - glyphMarginWidth - lineNumbersWidth - lineDecorationsWidth;

		let isWordWrapMinified = false;
		let isViewportWrapping = false;
		let wrappingColumn = -1;

		if (options.get(EditorOption.accessibilitySupport) === AccessibilitySupport.Enabled && wordWrapOverride1 === 'inherit' && isDominatedByLongLines) {
			// Force viewport width wrapping if model is dominated by long lines
			isWordWrapMinified = true;
			isViewportWrapping = true;
		} else if (wordWrap === 'on' || wordWrap === 'bounded') {
			isViewportWrapping = true;
		} else if (wordWrap === 'wordWrapColumn') {
			wrappingColumn = wordWrapColumn;
		}

		const minimapLayout = EditorLayoutInfoComputer._computeMinimapLayout({
			outerWidth: outerWidth,
			outerHeight: outerHeight,
			lineHeight: lineHeight,
			typicalHalfwidthCharacterWidth: typicalHalfwidthCharacterWidth,
			pixelRatio: pixelRatio,
			scrollBeyondLastLine: scrollBeyondLastLine,
			paddingTop: padding.top,
			paddingBottom: padding.bottom,
			minimap: minimap,
			verticalScrollbarWidth: verticalScrollbarWidth,
			viewLineCount: viewLineCount,
			remainingWidth: remainingWidth,
			isViewportWrapping: isViewportWrapping,
		}, env.memory || new ComputeOptionsMemory());

		if (minimapLayout.renderMinimap !== RenderMinimap.None && minimapLayout.minimapLeft === 0) {
			// the minimap is rendered to the left, so move everything to the right
			glyphMarginLeft += minimapLayout.minimapWidth;
			lineNumbersLeft += minimapLayout.minimapWidth;
			decorationsLeft += minimapLayout.minimapWidth;
			contentLeft += minimapLayout.minimapWidth;
		}
		const contentWidth = remainingWidth - minimapLayout.minimapWidth;

		// (leaving 2px for the cursor to have space after the last character)
		const viewportColumn = Math.max(1, Math.floor((contentWidth - verticalScrollbarWidth - 2) / typicalHalfwidthCharacterWidth));

		const verticalArrowSize = (verticalScrollbarHasArrows ? scrollbarArrowSize : 0);

		if (isViewportWrapping) {
			// compute the actual wrappingColumn
			// (leaving the rightmost column for the word wrap indicator so that it does not overlap
			// the wrapped text or end up underneath the vertical scrollbar)
			wrappingColumn = Math.max(1, viewportColumn - (wordWrapIndicator ? 1 : 0));
			if (wordWrap === 'bounded') {
				wrappingColumn = Math.min(wrappingColumn, wordWrapColumn);
			}
		}

		return {
			width: outerWidth,
			height: outerHeight,

			glyphMarginLeft: glyphMarginLeft,
			glyphMarginWidth: glyphMarginWidth,
			glyphMarginDecorationLaneCount: env.glyphMarginDecorationLaneCount,

			lineNumbersLeft: lineNumbersLeft,
			lineNumbersWidth: lineNumbersWidth,

			decorationsLeft: decorationsLeft,
			decorationsWidth: lineDecorationsWidth,

			contentLeft: contentLeft,
			contentWidth: contentWidth,

			minimap: minimapLayout,

			viewportColumn: viewportColumn,

			isWordWrapMinified: isWordWrapMinified,
			isViewportWrapping: isViewportWrapping,
			wrappingColumn: wrappingColumn,

			verticalScrollbarWidth: verticalScrollbarWidth,
			horizontalScrollbarHeight: horizontalScrollbarHeight,

			overviewRuler: {
				top: verticalArrowSize,
				width: verticalScrollbarWidth,
				height: (outerHeight - 2 * verticalArrowSize),
				right: 0
			}
		};
	}
}

//#endregion

//#region WrappingStrategy
class WrappingStrategy extends BaseEditorOption<EditorOption.wrappingStrategy, 'simple' | 'advanced', 'simple' | 'advanced'> {

	constructor() {
		super(EditorOption.wrappingStrategy, 'wrappingStrategy', 'simple',
			{
				'editor.wrappingStrategy': {
					enumDescriptions: [
						nls.localize('wrappingStrategy.simple', "假定所有字符宽度相同。这是一种快速算法，对等宽字体和某些脚本（如拉丁字符）等字形等宽的情况能正确工作。"),
						nls.localize('wrappingStrategy.advanced', "将换行点的计算交给浏览器处理。这是一种较慢的算法，大文件下可能导致卡顿，但在所有情况下都能正确工作。")
					],
					type: 'string',
					enum: ['simple', 'advanced'],
					default: 'simple',
					description: nls.localize('wrappingStrategy', "控制计算换行点所用的算法。注意：在无障碍模式下会使用「高级」算法以获得最佳体验。")
				}
			}
		);
	}

	public validate(input: unknown): 'simple' | 'advanced' {
		return stringSet<'simple' | 'advanced'>(input, 'simple', ['simple', 'advanced']);
	}

	public override compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: 'simple' | 'advanced'): 'simple' | 'advanced' {
		const accessibilitySupport = options.get(EditorOption.accessibilitySupport);
		if (accessibilitySupport === AccessibilitySupport.Enabled) {
			// if we know for a fact that a screen reader is attached, we switch our strategy to advanced to
			// help that the editor's wrapping points match the textarea's wrapping points
			return 'advanced';
		}
		return value;
	}
}
//#endregion

//#region lightbulb

export enum ShowLightbulbIconMode {
	Off = 'off',
	OnCode = 'onCode',
	On = 'on'
}

/**
 * Configuration options for editor lightbulb
 */
export interface IEditorLightbulbOptions {
	/**
	 * Enable the lightbulb code action.
	 * The three possible values are `off`, `on` and `onCode` and the default is `onCode`.
	 * `off` disables the code action menu.
	 * `on` shows the code action menu on code and on empty lines.
	 * `onCode` shows the code action menu on code only.
	 */
	enabled?: ShowLightbulbIconMode;
}

/**
 * @internal
 */
export type EditorLightbulbOptions = Readonly<Required<IEditorLightbulbOptions>>;

class EditorLightbulb extends BaseEditorOption<EditorOption.lightbulb, IEditorLightbulbOptions, EditorLightbulbOptions> {

	constructor() {
		const defaults: EditorLightbulbOptions = { enabled: ShowLightbulbIconMode.OnCode };
		super(
			EditorOption.lightbulb, 'lightbulb', defaults,
			{
				'editor.lightbulb.enabled': {
					type: 'string',
					enum: [ShowLightbulbIconMode.Off, ShowLightbulbIconMode.OnCode, ShowLightbulbIconMode.On],
					default: defaults.enabled,
					enumDescriptions: [
						nls.localize('editor.lightbulb.enabled.off', "禁用代码操作菜单。"),
						nls.localize('editor.lightbulb.enabled.onCode', "当光标位于有代码的行上时显示代码操作菜单。"),
						nls.localize('editor.lightbulb.enabled.on', "当光标位于有代码的行上或空行上时显示代码操作菜单。"),
					],
					description: nls.localize('enabled', "在编辑器中启用代码操作灯泡图标。")
				}
			}
		);
	}

	public validate(_input: unknown): EditorLightbulbOptions {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue;
		}
		const input = _input as Unknown<IEditorLightbulbOptions>;
		return {
			enabled: stringSet(input.enabled, this.defaultValue.enabled, [ShowLightbulbIconMode.Off, ShowLightbulbIconMode.OnCode, ShowLightbulbIconMode.On])
		};
	}
}

//#endregion

//#region stickyScroll

export interface IEditorStickyScrollOptions {
	/**
	 * Enable the sticky scroll
	 */
	enabled?: boolean;
	/**
	 * Maximum number of sticky lines to show
	 */
	maxLineCount?: number;
	/**
	 * Model to choose for sticky scroll by default
	 */
	defaultModel?: 'outlineModel' | 'foldingProviderModel' | 'indentationModel';
	/**
	 * Define whether to scroll sticky scroll with editor horizontal scrollbae
	 */
	scrollWithEditor?: boolean;
}

/**
 * @internal
 */
export type EditorStickyScrollOptions = Readonly<Required<IEditorStickyScrollOptions>>;

class EditorStickyScroll extends BaseEditorOption<EditorOption.stickyScroll, IEditorStickyScrollOptions, EditorStickyScrollOptions> {

	constructor() {
		const defaults: EditorStickyScrollOptions = { enabled: true, maxLineCount: 5, defaultModel: 'outlineModel', scrollWithEditor: true };
		super(
			EditorOption.stickyScroll, 'stickyScroll', defaults,
			{
				'editor.stickyScroll.enabled': {
					type: 'boolean',
					default: defaults.enabled,
					description: nls.localize('editor.stickyScroll.enabled', "在编辑器顶部滚动时显示嵌套的当前作用域。")
				},
				'editor.stickyScroll.maxLineCount': {
					type: 'number',
					default: defaults.maxLineCount,
					minimum: 1,
					maximum: 20,
					description: nls.localize('editor.stickyScroll.maxLineCount', "定义最多显示多少条粘滞行。")
				},
				'editor.stickyScroll.defaultModel': {
					type: 'string',
					enum: ['outlineModel', 'foldingProviderModel', 'indentationModel'],
					default: defaults.defaultModel,
					description: nls.localize('editor.stickyScroll.defaultModel', "定义用于确定哪些行会被粘住的模型。如果大纲模型不存在，则回退到折叠提供程序模型，再回退到缩进模型。这三处都遵循同样的优先顺序。")
				},
				'editor.stickyScroll.scrollWithEditor': {
					type: 'boolean',
					default: defaults.scrollWithEditor,
					description: nls.localize('editor.stickyScroll.scrollWithEditor', "允许通过编辑器的水平滚动条滚动粘滞视图。")
				},
			}
		);
	}

	public validate(_input: unknown): EditorStickyScrollOptions {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue;
		}
		const input = _input as Unknown<IEditorStickyScrollOptions>;
		return {
			enabled: boolean(input.enabled, this.defaultValue.enabled),
			maxLineCount: EditorIntOption.clampedInt(input.maxLineCount, this.defaultValue.maxLineCount, 1, 20),
			defaultModel: stringSet<'outlineModel' | 'foldingProviderModel' | 'indentationModel'>(input.defaultModel, this.defaultValue.defaultModel, ['outlineModel', 'foldingProviderModel', 'indentationModel']),
			scrollWithEditor: boolean(input.scrollWithEditor, this.defaultValue.scrollWithEditor)
		};
	}
}

//#endregion

//#region inlayHints

/**
 * Configuration options for editor inlayHints
 */
export interface IEditorInlayHintsOptions {
	/**
	 * Enable the inline hints.
	 * Defaults to true.
	 */
	enabled?: 'on' | 'off' | 'offUnlessPressed' | 'onUnlessPressed';

	/**
	 * Font size of inline hints.
	 * Default to 90% of the editor font size.
	 */
	fontSize?: number;

	/**
	 * Font family of inline hints.
	 * Defaults to editor font family.
	 */
	fontFamily?: string;

	/**
	 * Enables the padding around the inlay hint.
	 * Defaults to false.
	 */
	padding?: boolean;

	/**
	 * Maximum length for inlay hints per line
	 * Set to 0 to have an unlimited length.
	 */
	maximumLength?: number;
}

/**
 * @internal
 */
export type EditorInlayHintsOptions = Readonly<Required<IEditorInlayHintsOptions>>;

class EditorInlayHints extends BaseEditorOption<EditorOption.inlayHints, IEditorInlayHintsOptions, EditorInlayHintsOptions> {

	constructor() {
		const defaults: EditorInlayHintsOptions = { enabled: 'on', fontSize: 0, fontFamily: '', padding: false, maximumLength: 43 };
		super(
			EditorOption.inlayHints, 'inlayHints', defaults,
			{
				'editor.inlayHints.enabled': {
					type: 'string',
					default: defaults.enabled,
					description: nls.localize('inlayHints.enable', "在编辑器中启用内嵌提示（inlay hints）。"),
					enum: ['on', 'onUnlessPressed', 'offUnlessPressed', 'off'],
					markdownEnumDescriptions: [
						nls.localize('editor.inlayHints.on', "内嵌提示已启用"),
						nls.localize('editor.inlayHints.onUnlessPressed', "内嵌提示默认显示，按住 {0} 时隐藏", platform.isMacintosh ? `Ctrl+Option` : `Ctrl+Alt`),
						nls.localize('editor.inlayHints.offUnlessPressed', "内嵌提示默认隐藏，按住 {0} 时显示", platform.isMacintosh ? `Ctrl+Option` : `Ctrl+Alt`),
						nls.localize('editor.inlayHints.off', "内嵌提示已禁用"),
					],
				},
				'editor.inlayHints.fontSize': {
					type: 'number',
					default: defaults.fontSize,
					markdownDescription: nls.localize('inlayHints.fontSize', "控制编辑器中内嵌提示的字号。当配置值小于 {1} 或大于编辑器字号时，默认使用 {0}。", '`#editor.fontSize#`', '`5`')
				},
				'editor.inlayHints.fontFamily': {
					type: 'string',
					default: defaults.fontFamily,
					markdownDescription: nls.localize('inlayHints.fontFamily', "控制编辑器中内嵌提示的字体。设为空时使用 {0}。", '`#editor.fontFamily#`')
				},
				'editor.inlayHints.padding': {
					type: 'boolean',
					default: defaults.padding,
					description: nls.localize('inlayHints.padding', "启用编辑器中内嵌提示周围的内边距。")
				},
				'editor.inlayHints.maximumLength': {
					type: 'number',
					default: defaults.maximumLength,
					markdownDescription: nls.localize('inlayHints.maximumLength', "单行内嵌提示在被编辑器截断前允许的最大总长度。设为 `0` 表示永不截断")
				}
			}
		);
	}

	public validate(_input: unknown): EditorInlayHintsOptions {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue;
		}
		const input = _input as Unknown<IEditorInlayHintsOptions>;
		if (typeof input.enabled === 'boolean') {
			input.enabled = input.enabled ? 'on' : 'off';
		}
		return {
			enabled: stringSet<'on' | 'off' | 'offUnlessPressed' | 'onUnlessPressed'>(input.enabled, this.defaultValue.enabled, ['on', 'off', 'offUnlessPressed', 'onUnlessPressed']),
			fontSize: EditorIntOption.clampedInt(input.fontSize, this.defaultValue.fontSize, 0, 100),
			fontFamily: EditorStringOption.string(input.fontFamily, this.defaultValue.fontFamily),
			padding: boolean(input.padding, this.defaultValue.padding),
			maximumLength: EditorIntOption.clampedInt(input.maximumLength, this.defaultValue.maximumLength, 0, Number.MAX_SAFE_INTEGER),
		};
	}
}

//#endregion

//#region lineDecorationsWidth

class EditorLineDecorationsWidth extends BaseEditorOption<EditorOption.lineDecorationsWidth, number | string, number> {

	constructor() {
		super(EditorOption.lineDecorationsWidth, 'lineDecorationsWidth', 10);
	}

	public validate(input: unknown): number {
		if (typeof input === 'string' && /^\d+(\.\d+)?ch$/.test(input)) {
			const multiple = parseFloat(input.substring(0, input.length - 2));
			return -multiple; // negative numbers signal a multiple
		} else {
			return EditorIntOption.clampedInt(input, this.defaultValue, 0, 1000);
		}
	}

	public override compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: number): number {
		if (value < 0) {
			// negative numbers signal a multiple
			return EditorIntOption.clampedInt(-value * env.fontInfo.typicalHalfwidthCharacterWidth, this.defaultValue, 0, 1000);
		} else {
			return value;
		}
	}
}

//#endregion

//#region lineHeight

class EditorLineHeight extends EditorFloatOption<EditorOption.lineHeight> {

	constructor() {
		super(
			EditorOption.lineHeight, 'lineHeight',
			EDITOR_FONT_DEFAULTS.lineHeight,
			x => EditorFloatOption.clamp(x, 0, 150),
			{ markdownDescription: nls.localize('lineHeight', "控制行高。\n - 设为 0 时会根据字号自动计算行高。\n - 0 到 8 之间的取值会作为字号的倍数使用。\n - 大于或等于 8 的取值会直接作为有效值使用。") },
			0,
			150
		);
	}

	public override compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: number): number {
		// The lineHeight is computed from the fontSize if it is 0.
		// Moreover, the final lineHeight respects the editor zoom level.
		// So take the result from env.fontInfo
		return env.fontInfo.lineHeight;
	}
}

//#endregion

//#region minimap

/**
 * Configuration options for editor minimap
 */
export interface IEditorMinimapOptions {
	/**
	 * Enable the rendering of the minimap.
	 * Defaults to true.
	 */
	enabled?: boolean;
	/**
	 * Control the rendering of minimap.
	 */
	autohide?: 'none' | 'mouseover' | 'scroll';
	/**
	 * Control the side of the minimap in editor.
	 * Defaults to 'right'.
	 */
	side?: 'right' | 'left';
	/**
	 * Control the minimap rendering mode.
	 * Defaults to 'actual'.
	 */
	size?: 'proportional' | 'fill' | 'fit';
	/**
	 * Control the rendering of the minimap slider.
	 * Defaults to 'mouseover'.
	 */
	showSlider?: 'always' | 'mouseover';
	/**
	 * Render the actual text on a line (as opposed to color blocks).
	 * Defaults to true.
	 */
	renderCharacters?: boolean;
	/**
	 * Limit the width of the minimap to render at most a certain number of columns.
	 * Defaults to 120.
	 */
	maxColumn?: number;
	/**
	 * Relative size of the font in the minimap. Defaults to 1.
	 */
	scale?: number;
	/**
	 * Whether to show named regions as section headers. Defaults to true.
	 */
	showRegionSectionHeaders?: boolean;
	/**
	 * Whether to show MARK: comments as section headers. Defaults to true.
	 */
	showMarkSectionHeaders?: boolean;
	/**
	 * When specified, is used to create a custom section header parser regexp.
	 * Must contain a match group named 'label' (written as (?<label>.+)) that encapsulates the section header.
	 * Optionally can include another match group named 'separator'.
	 * To match multi-line headers like:
	 *   // ==========
	 *   // My Section
	 *   // ==========
	 * Use a pattern like: ^={3,}\n^\/\/ *(?<label>[^\n]*?)\n^={3,}$
	 */
	markSectionHeaderRegex?: string;
	/**
	 * Font size of section headers. Defaults to 9.
	 */
	sectionHeaderFontSize?: number;
	/**
	 * Spacing between the section header characters (in CSS px). Defaults to 1.
	 */
	sectionHeaderLetterSpacing?: number;
}

/**
 * @internal
 */
export type EditorMinimapOptions = Readonly<Required<IEditorMinimapOptions>>;

class EditorMinimap extends BaseEditorOption<EditorOption.minimap, IEditorMinimapOptions, EditorMinimapOptions> {

	constructor() {
		const defaults: EditorMinimapOptions = {
			enabled: true,
			size: 'proportional',
			side: 'right',
			showSlider: 'mouseover',
			autohide: 'none',
			renderCharacters: true,
			maxColumn: 120,
			scale: 1,
			showRegionSectionHeaders: true,
			showMarkSectionHeaders: true,
			markSectionHeaderRegex: '\\bMARK:\\s*(?<separator>\-?)\\s*(?<label>.*)$',
			sectionHeaderFontSize: 9,
			sectionHeaderLetterSpacing: 1,
		};
		super(
			EditorOption.minimap, 'minimap', defaults,
			{
				'editor.minimap.enabled': {
					type: 'boolean',
					default: defaults.enabled,
					description: nls.localize('minimap.enabled', "控制是否显示缩略图（minimap）。")
				},
				'editor.minimap.autohide': {
					type: 'string',
					enum: ['none', 'mouseover', 'scroll'],
					enumDescriptions: [
						nls.localize('minimap.autohide.none', "缩略图始终显示。"),
						nls.localize('minimap.autohide.mouseover', "鼠标不在缩略图上时隐藏缩略图，鼠标移入时显示。"),
						nls.localize('minimap.autohide.scroll', "仅当编辑器滚动时显示缩略图"),
					],
					default: defaults.autohide,
					description: nls.localize('minimap.autohide', "控制是否自动隐藏缩略图。")
				},
				'editor.minimap.size': {
					type: 'string',
					enum: ['proportional', 'fill', 'fit'],
					enumDescriptions: [
						nls.localize('minimap.size.proportional', "缩略图与编辑器内容同尺寸（可能会滚动）。"),
						nls.localize('minimap.size.fill', "缩略图会按需拉伸或收缩以填满编辑器高度（不滚动）。"),
						nls.localize('minimap.size.fit', "缩略图会按需缩小，确保不会大于编辑器（不滚动）。"),
					],
					default: defaults.size,
					description: nls.localize('minimap.size', "控制缩略图的尺寸。")
				},
				'editor.minimap.side': {
					type: 'string',
					enum: ['left', 'right'],
					default: defaults.side,
					description: nls.localize('minimap.side', "控制缩略图渲染在哪一侧。")
				},
				'editor.minimap.showSlider': {
					type: 'string',
					enum: ['always', 'mouseover'],
					default: defaults.showSlider,
					description: nls.localize('minimap.showSlider', "控制缩略图滑块何时显示。")
				},
				'editor.minimap.scale': {
					type: 'number',
					default: defaults.scale,
					minimum: 1,
					maximum: 3,
					enum: [1, 2, 3],
					description: nls.localize('minimap.scale', "缩略图中绘制内容的缩放比例：1、2 或 3。")
				},
				'editor.minimap.renderCharacters': {
					type: 'boolean',
					default: defaults.renderCharacters,
					description: nls.localize('minimap.renderCharacters', "渲染行中的实际字符，而不是色块。")
				},
				'editor.minimap.maxColumn': {
					type: 'number',
					default: defaults.maxColumn,
					description: nls.localize('minimap.maxColumn', "限制缩略图宽度，最多渲染指定数量的列。")
				},
				'editor.minimap.showRegionSectionHeaders': {
					type: 'boolean',
					default: defaults.showRegionSectionHeaders,
					description: nls.localize('minimap.showRegionSectionHeaders', "控制是否把命名区域作为分节标题显示在缩略图中。")
				},
				'editor.minimap.showMarkSectionHeaders': {
					type: 'boolean',
					default: defaults.showMarkSectionHeaders,
					description: nls.localize('minimap.showMarkSectionHeaders', "控制是否把 MARK: 注释作为分节标题显示在缩略图中。")
				},
				'editor.minimap.markSectionHeaderRegex': {
					type: 'string',
					default: defaults.markSectionHeaderRegex,
					description: nls.localize('minimap.markSectionHeaderRegex', "定义用于在注释中查找分节标题的正则表达式。该正则必须包含一个名为 label 的命名捕获组（写作 (?<label>.+)）来包裹分节标题，否则不会生效。你还可以选择性地加入另一个名为 separator 的捕获组。在模式中使用换行符可以匹配跨行的标题。"),
				},
				'editor.minimap.sectionHeaderFontSize': {
					type: 'number',
					default: defaults.sectionHeaderFontSize,
					description: nls.localize('minimap.sectionHeaderFontSize', "控制缩略图中分节标题的字号。")
				},
				'editor.minimap.sectionHeaderLetterSpacing': {
					type: 'number',
					default: defaults.sectionHeaderLetterSpacing,
					description: nls.localize('minimap.sectionHeaderLetterSpacing', "控制分节标题字符之间的间距（像素）。这有助于在小字号下提升标题的可读性。")
				}
			}
		);
	}

	public validate(_input: unknown): EditorMinimapOptions {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue;
		}
		const input = _input as Unknown<IEditorMinimapOptions>;

		// Validate mark section header regex
		let markSectionHeaderRegex = this.defaultValue.markSectionHeaderRegex;
		const inputRegex = input.markSectionHeaderRegex;
		if (typeof inputRegex === 'string') {
			try {
				new RegExp(inputRegex, 'd');
				markSectionHeaderRegex = inputRegex;
			} catch { }
		}

		return {
			enabled: boolean(input.enabled, this.defaultValue.enabled),
			autohide: stringSet<'none' | 'mouseover' | 'scroll'>(input.autohide, this.defaultValue.autohide, ['none', 'mouseover', 'scroll']),
			size: stringSet<'proportional' | 'fill' | 'fit'>(input.size, this.defaultValue.size, ['proportional', 'fill', 'fit']),
			side: stringSet<'right' | 'left'>(input.side, this.defaultValue.side, ['right', 'left']),
			showSlider: stringSet<'always' | 'mouseover'>(input.showSlider, this.defaultValue.showSlider, ['always', 'mouseover']),
			renderCharacters: boolean(input.renderCharacters, this.defaultValue.renderCharacters),
			scale: EditorIntOption.clampedInt(input.scale, 1, 1, 3),
			maxColumn: EditorIntOption.clampedInt(input.maxColumn, this.defaultValue.maxColumn, 1, 10000),
			showRegionSectionHeaders: boolean(input.showRegionSectionHeaders, this.defaultValue.showRegionSectionHeaders),
			showMarkSectionHeaders: boolean(input.showMarkSectionHeaders, this.defaultValue.showMarkSectionHeaders),
			markSectionHeaderRegex: markSectionHeaderRegex,
			sectionHeaderFontSize: EditorFloatOption.clamp(EditorFloatOption.float(input.sectionHeaderFontSize, this.defaultValue.sectionHeaderFontSize), 4, 32),
			sectionHeaderLetterSpacing: EditorFloatOption.clamp(EditorFloatOption.float(input.sectionHeaderLetterSpacing, this.defaultValue.sectionHeaderLetterSpacing), 0, 5),
		};
	}
}

//#endregion

//#region multiCursorModifier

function _multiCursorModifierFromString(multiCursorModifier: 'ctrlCmd' | 'alt'): 'altKey' | 'metaKey' | 'ctrlKey' {
	if (multiCursorModifier === 'ctrlCmd') {
		return (platform.isMacintosh ? 'metaKey' : 'ctrlKey');
	}
	return 'altKey';
}

//#endregion

//#region padding

/**
 * Configuration options for editor padding
 */
export interface IEditorPaddingOptions {
	/**
	 * Spacing between top edge of editor and first line.
	 */
	top?: number;
	/**
	 * Spacing between bottom edge of editor and last line.
	 */
	bottom?: number;
}

/**
 * @internal
 */
export type InternalEditorPaddingOptions = Readonly<Required<IEditorPaddingOptions>>;

class EditorPadding extends BaseEditorOption<EditorOption.padding, IEditorPaddingOptions, InternalEditorPaddingOptions> {

	constructor() {
		super(
			EditorOption.padding, 'padding', { top: 0, bottom: 0 },
			{
				'editor.padding.top': {
					type: 'number',
					default: 0,
					minimum: 0,
					maximum: 1000,
					description: nls.localize('padding.top', "控制编辑器上边缘与第一行之间的间距。")
				},
				'editor.padding.bottom': {
					type: 'number',
					default: 0,
					minimum: 0,
					maximum: 1000,
					description: nls.localize('padding.bottom', "控制编辑器下边缘与最后一行之间的间距。")
				}
			}
		);
	}

	public validate(_input: unknown): InternalEditorPaddingOptions {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue;
		}
		const input = _input as Unknown<IEditorPaddingOptions>;

		return {
			top: EditorIntOption.clampedInt(input.top, 0, 0, 1000),
			bottom: EditorIntOption.clampedInt(input.bottom, 0, 0, 1000)
		};
	}
}
//#endregion

//#region parameterHints

/**
 * Configuration options for parameter hints
 */
export interface IEditorParameterHintOptions {
	/**
	 * Enable parameter hints.
	 * Defaults to true.
	 */
	enabled?: boolean;
	/**
	 * Enable cycling of parameter hints.
	 * Defaults to false.
	 */
	cycle?: boolean;
}

/**
 * @internal
 */
export type InternalParameterHintOptions = Readonly<Required<IEditorParameterHintOptions>>;

class EditorParameterHints extends BaseEditorOption<EditorOption.parameterHints, IEditorParameterHintOptions, InternalParameterHintOptions> {

	constructor() {
		const defaults: InternalParameterHintOptions = {
			enabled: true,
			cycle: true
		};
		super(
			EditorOption.parameterHints, 'parameterHints', defaults,
			{
				'editor.parameterHints.enabled': {
					type: 'boolean',
					default: defaults.enabled,
					description: nls.localize('parameterHints.enabled', "启用弹窗，在输入时显示参数文档和类型信息。")
				},
				'editor.parameterHints.cycle': {
					type: 'boolean',
					default: defaults.cycle,
					description: nls.localize('parameterHints.cycle', "控制参数提示菜单到达列表末尾时是循环还是关闭。")
				},
			}
		);
	}

	public validate(_input: unknown): InternalParameterHintOptions {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue;
		}
		const input = _input as Unknown<IEditorParameterHintOptions>;
		return {
			enabled: boolean(input.enabled, this.defaultValue.enabled),
			cycle: boolean(input.cycle, this.defaultValue.cycle)
		};
	}
}

//#endregion

//#region pixelRatio

class EditorPixelRatio extends ComputedEditorOption<EditorOption.pixelRatio, number> {

	constructor() {
		super(EditorOption.pixelRatio, 1);
	}

	public compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, _: number): number {
		return env.pixelRatio;
	}
}

//#endregion

//#region

class PlaceholderOption extends BaseEditorOption<EditorOption.placeholder, string | undefined, string | undefined> {
	constructor() {
		super(EditorOption.placeholder, 'placeholder', undefined);
	}

	public validate(input: unknown): string | undefined {
		if (typeof input === 'undefined') {
			return this.defaultValue;
		}
		if (typeof input === 'string') {
			return input;
		}
		return this.defaultValue;
	}
}
//#endregion

//#region quickSuggestions

export type QuickSuggestionsValue = 'on' | 'inline' | 'off' | 'offWhenInlineCompletions';

/**
 * Configuration options for quick suggestions
 */
export interface IQuickSuggestionsOptions {
	other?: boolean | QuickSuggestionsValue;
	comments?: boolean | QuickSuggestionsValue;
	strings?: boolean | QuickSuggestionsValue;
}

export interface InternalQuickSuggestionsOptions {
	readonly other: QuickSuggestionsValue;
	readonly comments: QuickSuggestionsValue;
	readonly strings: QuickSuggestionsValue;
}

class EditorQuickSuggestions extends BaseEditorOption<EditorOption.quickSuggestions, boolean | QuickSuggestionsValue | IQuickSuggestionsOptions, InternalQuickSuggestionsOptions> {

	public override readonly defaultValue: InternalQuickSuggestionsOptions;

	constructor() {
		const defaults: InternalQuickSuggestionsOptions = {
			other: 'offWhenInlineCompletions',
			comments: 'off',
			strings: 'off'
		};
		const types: IJSONSchema[] = [
			{ type: 'boolean' },
			{
				type: 'string',
				enum: ['on', 'inline', 'off', 'offWhenInlineCompletions'],
				enumDescriptions: [nls.localize('on', "快速建议显示在建议控件内"), nls.localize('inline', "快速建议以幽灵文本（ghost text）显示"), nls.localize('off', "快速建议已禁用"), nls.localize('offWhenInlineCompletions', "显示内联补全时，快速建议被禁用")]
			}
		];
		super(EditorOption.quickSuggestions, 'quickSuggestions', defaults, {
			anyOf: [
				{ type: 'boolean' },
				{
					type: 'string',
					enum: ['on', 'inline', 'off', 'offWhenInlineCompletions'],
					enumDescriptions: [nls.localize('quickSuggestions.topLevel.on', "对所有词法单元类型启用快速建议"), nls.localize('quickSuggestions.topLevel.inline', "对所有词法单元类型以幽灵文本显示快速建议"), nls.localize('quickSuggestions.topLevel.off', "对所有词法单元类型禁用快速建议"), nls.localize('quickSuggestions.topLevel.offWhenInlineCompletions', "显示内联补全时，对所有词法单元类型禁用快速建议")]
				},
				{
					type: 'object',
					additionalProperties: false,
					properties: {
						strings: {
							anyOf: types,
							default: defaults.strings,
							description: nls.localize('quickSuggestions.strings', "在字符串内启用快速建议。")
						},
						comments: {
							anyOf: types,
							default: defaults.comments,
							description: nls.localize('quickSuggestions.comments', "在注释内启用快速建议。")
						},
						other: {
							anyOf: types,
							default: defaults.other,
							description: nls.localize('quickSuggestions.other', "在字符串和注释之外启用快速建议。")
						},
					},
				}
			],
			default: defaults,
			markdownDescription: nls.localize('quickSuggestions', "控制输入时是否自动弹出建议。可以针对在注释、字符串等位置输入分别进行控制。快速建议可以配置为以虚影文字显示，或通过建议小工具显示。此外请留意 {0} 设置，它控制是否由特殊字符触发建议。", '`#editor.suggestOnTriggerCharacters#`'),
			experiment: {
				mode: 'auto'
			}
		});
		this.defaultValue = defaults;
	}

	public validate(input: unknown): InternalQuickSuggestionsOptions {
		if (typeof input === 'boolean') {
			// boolean -> all on/off
			const value = input ? 'on' : 'off';
			return { comments: value, strings: value, other: value };
		}
		if (typeof input === 'string') {
			// string shorthand -> apply same value to all token types
			const allowedValues: QuickSuggestionsValue[] = ['on', 'inline', 'off', 'offWhenInlineCompletions'];
			const validated = stringSet<QuickSuggestionsValue>(input as QuickSuggestionsValue, this.defaultValue.other, allowedValues);
			return { comments: validated, strings: validated, other: validated };
		}
		if (!input || typeof input !== 'object') {
			// invalid input
			return this.defaultValue;
		}

		const { other, comments, strings } = (<IQuickSuggestionsOptions>input);
		const allowedValues: QuickSuggestionsValue[] = ['on', 'inline', 'off', 'offWhenInlineCompletions'];
		let validatedOther: QuickSuggestionsValue;
		let validatedComments: QuickSuggestionsValue;
		let validatedStrings: QuickSuggestionsValue;

		if (typeof other === 'boolean') {
			validatedOther = other ? 'on' : 'off';
		} else {
			validatedOther = stringSet(other, this.defaultValue.other, allowedValues);
		}
		if (typeof comments === 'boolean') {
			validatedComments = comments ? 'on' : 'off';
		} else {
			validatedComments = stringSet(comments, this.defaultValue.comments, allowedValues);
		}
		if (typeof strings === 'boolean') {
			validatedStrings = strings ? 'on' : 'off';
		} else {
			validatedStrings = stringSet(strings, this.defaultValue.strings, allowedValues);
		}
		return {
			other: validatedOther,
			comments: validatedComments,
			strings: validatedStrings
		};
	}
}

//#endregion

//#region renderLineNumbers

export type LineNumbersType = 'on' | 'off' | 'relative' | 'interval' | ((lineNumber: number) => string);

export const enum RenderLineNumbersType {
	Off = 0,
	On = 1,
	Relative = 2,
	Interval = 3,
	Custom = 4
}

export interface InternalEditorRenderLineNumbersOptions {
	readonly renderType: RenderLineNumbersType;
	readonly renderFn: ((lineNumber: number) => string) | null;
}

class EditorRenderLineNumbersOption extends BaseEditorOption<EditorOption.lineNumbers, LineNumbersType, InternalEditorRenderLineNumbersOptions> {

	constructor() {
		super(
			EditorOption.lineNumbers, 'lineNumbers', { renderType: RenderLineNumbersType.On, renderFn: null },
			{
				type: 'string',
				enum: ['off', 'on', 'relative', 'interval'],
				enumDescriptions: [
					nls.localize('lineNumbers.off', "不渲染行号。"),
					nls.localize('lineNumbers.on', "以绝对行号渲染。"),
					nls.localize('lineNumbers.relative', "以与光标位置相差的行数渲染。"),
					nls.localize('lineNumbers.interval', "每 10 行渲染一次行号。")
				],
				default: 'on',
				description: nls.localize('lineNumbers', "控制行号的显示方式。")
			}
		);
	}

	public validate(lineNumbers: unknown): InternalEditorRenderLineNumbersOptions {
		let renderType: RenderLineNumbersType = this.defaultValue.renderType;
		let renderFn: ((lineNumber: number) => string) | null = this.defaultValue.renderFn;

		if (typeof lineNumbers !== 'undefined') {
			if (typeof lineNumbers === 'function') {
				renderType = RenderLineNumbersType.Custom;
				renderFn = lineNumbers as ((lineNumber: number) => string);
			} else if (lineNumbers === 'interval') {
				renderType = RenderLineNumbersType.Interval;
			} else if (lineNumbers === 'relative') {
				renderType = RenderLineNumbersType.Relative;
			} else if (lineNumbers === 'on') {
				renderType = RenderLineNumbersType.On;
			} else {
				renderType = RenderLineNumbersType.Off;
			}
		}

		return {
			renderType,
			renderFn
		};
	}
}

//#endregion

//#region renderValidationDecorations

/**
 * @internal
 */
export function filterValidationDecorations(options: IComputedEditorOptions): boolean {
	const renderValidationDecorations = options.get(EditorOption.renderValidationDecorations);
	if (renderValidationDecorations === 'editable') {
		return options.get(EditorOption.readOnly);
	}
	return renderValidationDecorations === 'on' ? false : true;
}

//#endregion

//#region filterFontDecorations

/**
 * @internal
 */
export function filterFontDecorations(options: IComputedEditorOptions): boolean {
	return !options.get(EditorOption.effectiveAllowVariableFonts);
}

//#endregion

//#region rulers

export interface IRulerOption {
	readonly column: number;
	readonly color: string | null;
}

class EditorRulers extends BaseEditorOption<EditorOption.rulers, (number | IRulerOption)[], IRulerOption[]> {

	constructor() {
		const defaults: IRulerOption[] = [];
		const columnSchema: IJSONSchema = { type: 'number', description: nls.localize('rulers.size', "该编辑器标尺按多少个等宽字符的位置渲染。") };
		super(
			EditorOption.rulers, 'rulers', defaults,
			{
				type: 'array',
				items: {
					anyOf: [
						columnSchema,
						{
							type: [
								'object'
							],
							properties: {
								column: columnSchema,
								color: {
									type: 'string',
									description: nls.localize('rulers.color', "该编辑器标尺的颜色。"),
									format: 'color-hex'
								}
							}
						}
					]
				},
				default: defaults,
				description: nls.localize('rulers', "每隔一定数量的等宽字符渲染一条垂直标尺。可传入多个值绘制多条标尺。数组为空时不绘制标尺。")
			}
		);
	}

	public validate(input: unknown): IRulerOption[] {
		if (Array.isArray(input)) {
			const rulers: IRulerOption[] = [];
			for (const _element of input) {
				if (typeof _element === 'number') {
					rulers.push({
						column: EditorIntOption.clampedInt(_element, 0, 0, 10000),
						color: null
					});
				} else if (_element && typeof _element === 'object') {
					const element = _element as IRulerOption;
					rulers.push({
						column: EditorIntOption.clampedInt(element.column, 0, 0, 10000),
						color: element.color
					});
				}
			}
			rulers.sort((a, b) => a.column - b.column);
			return rulers;
		}
		return this.defaultValue;
	}
}

//#endregion

//#region readonly

/**
 * Configuration options for readonly message
 */
class ReadonlyMessage extends BaseEditorOption<EditorOption.readOnlyMessage, IMarkdownString | undefined, IMarkdownString | undefined> {
	constructor() {
		const defaults = undefined;

		super(
			EditorOption.readOnlyMessage, 'readOnlyMessage', defaults
		);
	}

	public validate(_input: unknown): IMarkdownString | undefined {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue;
		}
		return _input as IMarkdownString;
	}
}

//#endregion

//#region scrollbar

/**
 * Configuration options for editor scrollbars
 */
export interface IEditorScrollbarOptions {
	/**
	 * The size of arrows (if displayed).
	 * Defaults to 11.
	 * **NOTE**: This option cannot be updated using `updateOptions()`
	 */
	arrowSize?: number;
	/**
	 * Render vertical scrollbar.
	 * Defaults to 'auto'.
	 */
	vertical?: 'auto' | 'visible' | 'hidden';
	/**
	 * Render horizontal scrollbar.
	 * Defaults to 'auto'.
	 */
	horizontal?: 'auto' | 'visible' | 'hidden';
	/**
	 * Cast horizontal and vertical shadows when the content is scrolled.
	 * Defaults to true.
	 * **NOTE**: This option cannot be updated using `updateOptions()`
	 */
	useShadows?: boolean;
	/**
	 * Render arrows at the top and bottom of the vertical scrollbar.
	 * Defaults to false.
	 * **NOTE**: This option cannot be updated using `updateOptions()`
	 */
	verticalHasArrows?: boolean;
	/**
	 * Render arrows at the left and right of the horizontal scrollbar.
	 * Defaults to false.
	 * **NOTE**: This option cannot be updated using `updateOptions()`
	 */
	horizontalHasArrows?: boolean;
	/**
	 * Listen to mouse wheel events and react to them by scrolling.
	 * Defaults to true.
	 */
	handleMouseWheel?: boolean;
	/**
	 * Always consume mouse wheel events (always call preventDefault() and stopPropagation() on the browser events).
	 * Defaults to true.
	 * **NOTE**: This option cannot be updated using `updateOptions()`
	 */
	alwaysConsumeMouseWheel?: boolean;
	/**
	 * Height in pixels for the horizontal scrollbar.
	 * Defaults to 12 (px).
	 */
	horizontalScrollbarSize?: number;
	/**
	 * Width in pixels for the vertical scrollbar.
	 * Defaults to 14 (px).
	 */
	verticalScrollbarSize?: number;
	/**
	 * Width in pixels for the vertical slider.
	 * Defaults to `verticalScrollbarSize`.
	 * **NOTE**: This option cannot be updated using `updateOptions()`
	 */
	verticalSliderSize?: number;
	/**
	 * Height in pixels for the horizontal slider.
	 * Defaults to `horizontalScrollbarSize`.
	 * **NOTE**: This option cannot be updated using `updateOptions()`
	 */
	horizontalSliderSize?: number;
	/**
	 * Scroll gutter clicks move by page vs jump to position.
	 * Defaults to false.
	 */
	scrollByPage?: boolean;

	/**
	 * When set, the horizontal scrollbar will not increase content height.
	 * Defaults to false.
	 */
	ignoreHorizontalScrollbarInContentHeight?: boolean;
}

export interface InternalEditorScrollbarOptions {
	readonly arrowSize: number;
	readonly vertical: ScrollbarVisibility;
	readonly horizontal: ScrollbarVisibility;
	readonly useShadows: boolean;
	readonly verticalHasArrows: boolean;
	readonly horizontalHasArrows: boolean;
	readonly handleMouseWheel: boolean;
	readonly alwaysConsumeMouseWheel: boolean;
	readonly horizontalScrollbarSize: number;
	readonly horizontalSliderSize: number;
	readonly verticalScrollbarSize: number;
	readonly verticalSliderSize: number;
	readonly scrollByPage: boolean;
	readonly ignoreHorizontalScrollbarInContentHeight: boolean;
}

function _scrollbarVisibilityFromString(visibility: unknown, defaultValue: ScrollbarVisibility): ScrollbarVisibility {
	if (typeof visibility !== 'string') {
		return defaultValue;
	}
	switch (visibility) {
		case 'hidden': return ScrollbarVisibility.Hidden;
		case 'visible': return ScrollbarVisibility.Visible;
		default: return ScrollbarVisibility.Auto;
	}
}

class EditorScrollbar extends BaseEditorOption<EditorOption.scrollbar, IEditorScrollbarOptions, InternalEditorScrollbarOptions> {

	constructor() {
		const defaults: InternalEditorScrollbarOptions = {
			vertical: ScrollbarVisibility.Auto,
			horizontal: ScrollbarVisibility.Auto,
			arrowSize: 11,
			useShadows: true,
			verticalHasArrows: false,
			horizontalHasArrows: false,
			horizontalScrollbarSize: 12,
			horizontalSliderSize: 12,
			verticalScrollbarSize: 14,
			verticalSliderSize: 14,
			handleMouseWheel: true,
			alwaysConsumeMouseWheel: true,
			scrollByPage: false,
			ignoreHorizontalScrollbarInContentHeight: false,
		};
		super(
			EditorOption.scrollbar, 'scrollbar', defaults,
			{
				'editor.scrollbar.vertical': {
					type: 'string',
					enum: ['auto', 'visible', 'hidden'],
					enumDescriptions: [
						nls.localize('scrollbar.vertical.auto', "垂直滚动条仅在必要时显示。"),
						nls.localize('scrollbar.vertical.visible', "垂直滚动条始终显示。"),
						nls.localize('scrollbar.vertical.fit', "垂直滚动条始终隐藏。"),
					],
					default: 'auto',
					description: nls.localize('scrollbar.vertical', "控制垂直滚动条的可见性。")
				},
				'editor.scrollbar.horizontal': {
					type: 'string',
					enum: ['auto', 'visible', 'hidden'],
					enumDescriptions: [
						nls.localize('scrollbar.horizontal.auto', "水平滚动条仅在必要时显示。"),
						nls.localize('scrollbar.horizontal.visible', "水平滚动条始终显示。"),
						nls.localize('scrollbar.horizontal.fit', "水平滚动条始终隐藏。"),
					],
					default: 'auto',
					description: nls.localize('scrollbar.horizontal', "控制水平滚动条的可见性。")
				},
				'editor.scrollbar.verticalScrollbarSize': {
					type: 'number',
					default: defaults.verticalScrollbarSize,
					description: nls.localize('scrollbar.verticalScrollbarSize', "垂直滚动条的宽度。")
				},
				'editor.scrollbar.horizontalScrollbarSize': {
					type: 'number',
					default: defaults.horizontalScrollbarSize,
					description: nls.localize('scrollbar.horizontalScrollbarSize', "水平滚动条的高度。")
				},
				'editor.scrollbar.scrollByPage': {
					type: 'boolean',
					default: defaults.scrollByPage,
					description: nls.localize('scrollbar.scrollByPage', "控制单击时是按页滚动还是跳转到单击位置。")
				},
				'editor.scrollbar.ignoreHorizontalScrollbarInContentHeight': {
					type: 'boolean',
					default: defaults.ignoreHorizontalScrollbarInContentHeight,
					description: nls.localize('scrollbar.ignoreHorizontalScrollbarInContentHeight', "启用后，水平滚动条不会增大编辑器内容的尺寸。")
				}
			}
		);
	}

	public validate(_input: unknown): InternalEditorScrollbarOptions {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue;
		}
		const input = _input as Unknown<IEditorScrollbarOptions>;
		const horizontalScrollbarSize = EditorIntOption.clampedInt(input.horizontalScrollbarSize, this.defaultValue.horizontalScrollbarSize, 0, 1000);
		const verticalScrollbarSize = EditorIntOption.clampedInt(input.verticalScrollbarSize, this.defaultValue.verticalScrollbarSize, 0, 1000);
		return {
			arrowSize: EditorIntOption.clampedInt(input.arrowSize, this.defaultValue.arrowSize, 0, 1000),
			vertical: _scrollbarVisibilityFromString(input.vertical, this.defaultValue.vertical),
			horizontal: _scrollbarVisibilityFromString(input.horizontal, this.defaultValue.horizontal),
			useShadows: boolean(input.useShadows, this.defaultValue.useShadows),
			verticalHasArrows: boolean(input.verticalHasArrows, this.defaultValue.verticalHasArrows),
			horizontalHasArrows: boolean(input.horizontalHasArrows, this.defaultValue.horizontalHasArrows),
			handleMouseWheel: boolean(input.handleMouseWheel, this.defaultValue.handleMouseWheel),
			alwaysConsumeMouseWheel: boolean(input.alwaysConsumeMouseWheel, this.defaultValue.alwaysConsumeMouseWheel),
			horizontalScrollbarSize: horizontalScrollbarSize,
			horizontalSliderSize: EditorIntOption.clampedInt(input.horizontalSliderSize, horizontalScrollbarSize, 0, 1000),
			verticalScrollbarSize: verticalScrollbarSize,
			verticalSliderSize: EditorIntOption.clampedInt(input.verticalSliderSize, verticalScrollbarSize, 0, 1000),
			scrollByPage: boolean(input.scrollByPage, this.defaultValue.scrollByPage),
			ignoreHorizontalScrollbarInContentHeight: boolean(input.ignoreHorizontalScrollbarInContentHeight, this.defaultValue.ignoreHorizontalScrollbarInContentHeight),
		};
	}
}

//#endregion

//#region UnicodeHighlight

export type InUntrustedWorkspace = 'inUntrustedWorkspace';

/**
 * @internal
*/
export const inUntrustedWorkspace: InUntrustedWorkspace = 'inUntrustedWorkspace';

/**
 * Configuration options for unicode highlighting.
 */
export interface IUnicodeHighlightOptions {

	/**
	 * Controls whether all non-basic ASCII characters are highlighted. Only characters between U+0020 and U+007E, tab, line-feed and carriage-return are considered basic ASCII.
	 */
	nonBasicASCII?: boolean | InUntrustedWorkspace;

	/**
	 * Controls whether characters that just reserve space or have no width at all are highlighted.
	 */
	invisibleCharacters?: boolean;

	/**
	 * Controls whether characters are highlighted that can be confused with basic ASCII characters, except those that are common in the current user locale.
	 */
	ambiguousCharacters?: boolean;

	/**
	 * Controls whether characters in comments should also be subject to unicode highlighting.
	 */
	includeComments?: boolean | InUntrustedWorkspace;

	/**
	 * Controls whether characters in strings should also be subject to unicode highlighting.
	 */
	includeStrings?: boolean | InUntrustedWorkspace;

	/**
	 * Defines allowed characters that are not being highlighted.
	 */
	allowedCharacters?: Record<string, true>;

	/**
	 * Unicode characters that are common in allowed locales are not being highlighted.
	 */
	allowedLocales?: Record<string | '_os' | '_vscode', true>;
}

/**
 * @internal
 */
export type InternalUnicodeHighlightOptions = Required<Readonly<IUnicodeHighlightOptions>>;

/**
 * @internal
 */
export const unicodeHighlightConfigKeys = {
	allowedCharacters: 'editor.unicodeHighlight.allowedCharacters',
	invisibleCharacters: 'editor.unicodeHighlight.invisibleCharacters',
	nonBasicASCII: 'editor.unicodeHighlight.nonBasicASCII',
	ambiguousCharacters: 'editor.unicodeHighlight.ambiguousCharacters',
	includeComments: 'editor.unicodeHighlight.includeComments',
	includeStrings: 'editor.unicodeHighlight.includeStrings',
	allowedLocales: 'editor.unicodeHighlight.allowedLocales',
};

class UnicodeHighlight extends BaseEditorOption<EditorOption.unicodeHighlighting, IUnicodeHighlightOptions, InternalUnicodeHighlightOptions> {
	constructor() {
		const defaults: InternalUnicodeHighlightOptions = {
			nonBasicASCII: inUntrustedWorkspace,
			invisibleCharacters: true,
			ambiguousCharacters: true,
			includeComments: inUntrustedWorkspace,
			includeStrings: true,
			allowedCharacters: {},
			allowedLocales: { _os: true, _vscode: true },
		};

		super(
			EditorOption.unicodeHighlighting, 'unicodeHighlight', defaults,
			{
				[unicodeHighlightConfigKeys.nonBasicASCII]: {
					restricted: true,
					type: ['boolean', 'string'],
					enum: [true, false, inUntrustedWorkspace],
					default: defaults.nonBasicASCII,
					description: nls.localize('unicodeHighlight.nonBasicASCII', "控制是否高亮所有非基本 ASCII 字符。仅 U+0020 到 U+007E 之间的字符、制表符、换行符和回车符被视为基本 ASCII。")
				},
				[unicodeHighlightConfigKeys.invisibleCharacters]: {
					restricted: true,
					type: 'boolean',
					default: defaults.invisibleCharacters,
					description: nls.localize('unicodeHighlight.invisibleCharacters', "控制是否高亮仅用于占位、完全没有宽度的字符。")
				},
				[unicodeHighlightConfigKeys.ambiguousCharacters]: {
					restricted: true,
					type: 'boolean',
					default: defaults.ambiguousCharacters,
					description: nls.localize('unicodeHighlight.ambiguousCharacters', "控制是否高亮那些可能与基本 ASCII 字符混淆的字符（当前用户语言区域中常见的除外）。")
				},
				[unicodeHighlightConfigKeys.includeComments]: {
					restricted: true,
					type: ['boolean', 'string'],
					enum: [true, false, inUntrustedWorkspace],
					default: defaults.includeComments,
					description: nls.localize('unicodeHighlight.includeComments', "控制注释中的字符是否也接受 Unicode 高亮。")
				},
				[unicodeHighlightConfigKeys.includeStrings]: {
					restricted: true,
					type: ['boolean', 'string'],
					enum: [true, false, inUntrustedWorkspace],
					default: defaults.includeStrings,
					description: nls.localize('unicodeHighlight.includeStrings', "控制字符串中的字符是否也接受 Unicode 高亮。")
				},
				[unicodeHighlightConfigKeys.allowedCharacters]: {
					restricted: true,
					type: 'object',
					default: defaults.allowedCharacters,
					description: nls.localize('unicodeHighlight.allowedCharacters', "定义允许出现且不被高亮的字符。"),
					additionalProperties: {
						type: 'boolean'
					}
				},
				[unicodeHighlightConfigKeys.allowedLocales]: {
					restricted: true,
					type: 'object',
					additionalProperties: {
						type: 'boolean'
					},
					default: defaults.allowedLocales,
					description: nls.localize('unicodeHighlight.allowedLocales', "在允许的语言区域中常见的 Unicode 字符不会被高亮。")
				},
			}
		);
	}

	public override applyUpdate(value: Required<Readonly<IUnicodeHighlightOptions>> | undefined, update: Required<Readonly<IUnicodeHighlightOptions>>): ApplyUpdateResult<Required<Readonly<IUnicodeHighlightOptions>>> {
		let didChange = false;
		if (update.allowedCharacters && value) {
			// Treat allowedCharacters atomically
			if (!objects.equals(value.allowedCharacters, update.allowedCharacters)) {
				value = { ...value, allowedCharacters: update.allowedCharacters };
				didChange = true;
			}
		}
		if (update.allowedLocales && value) {
			// Treat allowedLocales atomically
			if (!objects.equals(value.allowedLocales, update.allowedLocales)) {
				value = { ...value, allowedLocales: update.allowedLocales };
				didChange = true;
			}
		}

		const result = super.applyUpdate(value, update);
		if (didChange) {
			return new ApplyUpdateResult(result.newValue, true);
		}
		return result;
	}

	public validate(_input: unknown): InternalUnicodeHighlightOptions {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue;
		}
		const input = _input as Unknown<IUnicodeHighlightOptions>;
		return {
			nonBasicASCII: primitiveSet<boolean | InUntrustedWorkspace>(input.nonBasicASCII, inUntrustedWorkspace, [true, false, inUntrustedWorkspace]),
			invisibleCharacters: boolean(input.invisibleCharacters, this.defaultValue.invisibleCharacters),
			ambiguousCharacters: boolean(input.ambiguousCharacters, this.defaultValue.ambiguousCharacters),
			includeComments: primitiveSet<boolean | InUntrustedWorkspace>(input.includeComments, inUntrustedWorkspace, [true, false, inUntrustedWorkspace]),
			includeStrings: primitiveSet<boolean | InUntrustedWorkspace>(input.includeStrings, inUntrustedWorkspace, [true, false, inUntrustedWorkspace]),
			allowedCharacters: this.validateBooleanMap(input.allowedCharacters, this.defaultValue.allowedCharacters),
			allowedLocales: this.validateBooleanMap(input.allowedLocales, this.defaultValue.allowedLocales),
		};
	}

	private validateBooleanMap(map: unknown, defaultValue: Record<string, true>): Record<string, true> {
		if ((typeof map !== 'object') || !map) {
			return defaultValue;
		}
		const result: Record<string, true> = {};
		for (const [key, value] of Object.entries(map)) {
			if (value === true) {
				result[key] = true;
			}
		}
		return result;
	}
}

//#endregion

//#region inlineSuggest

export interface IInlineSuggestOptions {
	/**
	 * Enable or disable the rendering of automatic inline completions.
	*/
	enabled?: boolean;

	/**
	 * Configures the mode.
	 * Use `prefix` to only show ghost text if the text to replace is a prefix of the suggestion text.
	 * Use `subword` to only show ghost text if the replace text is a subword of the suggestion text.
	 * Use `subwordSmart` to only show ghost text if the replace text is a subword of the suggestion text, but the subword must start after the cursor position.
	 * Defaults to `prefix`.
	*/
	mode?: 'prefix' | 'subword' | 'subwordSmart';

	showToolbar?: 'always' | 'onHover' | 'never';

	syntaxHighlightingEnabled?: boolean;

	suppressSuggestions?: boolean;

	minShowDelay?: number;
	suppressInSnippetMode?: boolean;
	/**
	 * Does not clear active inline suggestions when the editor loses focus.
	 */
	keepOnBlur?: boolean;

	/**
	 * Font family for inline suggestions.
	 */
	fontFamily?: string | 'default';

	edits?: {
		allowCodeShifting?: 'always' | 'horizontal' | 'never';

		renderSideBySide?: 'never' | 'auto';

		showCollapsed?: boolean;

		showLongDistanceHint?: boolean;

		/**
		 * Controls how many lines of surrounding context are shown above and below the target line
		 * in the long distance inline suggestion hint preview. `0` shows only the target line.
		 */
		longDistanceHintContextLineCount?: number;

		/**
		* @internal
		*/
		enabled?: boolean;
	};

	/**
	* @internal
	*/
	triggerCommandOnProviderChange?: boolean;

	/**
	* @internal
	*/
	experimental?: {
		/**
		* @internal
		*/
		suppressInlineSuggestions?: string;

		/**
		* @internal
		*/
		emptyResponseInformation?: boolean;

		showOnSuggestConflict?: 'always' | 'never' | 'whenSuggestListIsIncomplete';
	};
}

type RequiredRecursive<T> = {
	[P in keyof T]-?: T[P] extends object | undefined ? RequiredRecursive<T[P]> : T[P];
};

/**
 * @internal
 */
export type InternalInlineSuggestOptions = Readonly<RequiredRecursive<IInlineSuggestOptions>>;

/**
 * Configuration options for inline suggestions
 */
class InlineEditorSuggest extends BaseEditorOption<EditorOption.inlineSuggest, IInlineSuggestOptions, InternalInlineSuggestOptions> {
	constructor() {
		const defaults: InternalInlineSuggestOptions = {
			enabled: true,
			mode: 'subwordSmart',
			showToolbar: 'onHover',
			suppressSuggestions: false,
			keepOnBlur: false,
			fontFamily: 'default',
			syntaxHighlightingEnabled: true,
			minShowDelay: 0,
			suppressInSnippetMode: true,
			edits: {
				enabled: true,
				showCollapsed: false,
				renderSideBySide: 'auto',
				allowCodeShifting: 'always',
				showLongDistanceHint: true,
				longDistanceHintContextLineCount: 0,
			},
			triggerCommandOnProviderChange: false,
			experimental: {
				suppressInlineSuggestions: '',
				showOnSuggestConflict: 'never',
				emptyResponseInformation: true,
			},
		};

		super(
			EditorOption.inlineSuggest, 'inlineSuggest', defaults,
			{
				'editor.inlineSuggest.enabled': {
					type: 'boolean',
					default: defaults.enabled,
					description: nls.localize('inlineSuggest.enabled', "控制是否在编辑器中自动显示内联建议。")
				},
				'editor.inlineSuggest.showToolbar': {
					type: 'string',
					default: defaults.showToolbar,
					enum: ['always', 'onHover', 'never'],
					enumDescriptions: [
						nls.localize('inlineSuggest.showToolbar.always', "每当显示内联建议时，都显示内联建议工具栏。"),
						nls.localize('inlineSuggest.showToolbar.onHover', "悬停到内联建议上时显示内联建议工具栏。"),
						nls.localize('inlineSuggest.showToolbar.never', "从不显示内联建议工具栏。"),
					],
					description: nls.localize('inlineSuggest.showToolbar', "控制何时显示内联建议工具栏。"),
				},
				'editor.inlineSuggest.syntaxHighlightingEnabled': {
					type: 'boolean',
					default: defaults.syntaxHighlightingEnabled,
					description: nls.localize('inlineSuggest.syntaxHighlightingEnabled', "控制是否为编辑器中的内联建议显示语法高亮。"),
				},
				'editor.inlineSuggest.suppressSuggestions': {
					type: 'boolean',
					default: defaults.suppressSuggestions,
					description: nls.localize('inlineSuggest.suppressSuggestions', "控制内联建议与建议控件的交互方式。启用后，当有内联建议可用时不会自动显示建议控件。")
				},
				'editor.inlineSuggest.suppressInSnippetMode': {
					type: 'boolean',
					default: defaults.suppressInSnippetMode,
					description: nls.localize('inlineSuggest.suppressInSnippetMode', "控制处于代码片段模式时是否抑制内联建议。"),
				},
				'editor.inlineSuggest.minShowDelay': {
					type: 'number',
					default: 0,
					minimum: 0,
					maximum: 10000,
					description: nls.localize('inlineSuggest.minShowDelay', "控制输入后显示内联建议前的最小延迟（毫秒）。"),
				},
				'editor.inlineSuggest.experimental.suppressInlineSuggestions': {
					type: 'string',
					default: defaults.experimental.suppressInlineSuggestions,
					tags: ['experimental'],
					description: nls.localize('inlineSuggest.suppressInlineSuggestions', "禁止指定扩展 ID 的内联补全 —— 使用英文逗号分隔。"),
					experiment: {
						mode: 'auto'
					}
				},
				'editor.inlineSuggest.experimental.emptyResponseInformation': {
					type: 'boolean',
					default: defaults.experimental.emptyResponseInformation,
					tags: ['experimental'],
					description: nls.localize('inlineSuggest.emptyResponseInformation', "控制是否发送来自内联建议提供程序的请求信息。"),
					experiment: {
						mode: 'auto'
					}
				},
				'editor.inlineSuggest.triggerCommandOnProviderChange': {
					type: 'boolean',
					default: defaults.triggerCommandOnProviderChange,
					tags: ['experimental'],
					description: nls.localize('inlineSuggest.triggerCommandOnProviderChange', "控制内联建议提供程序变化时是否触发命令。"),
					experiment: {
						mode: 'auto'
					}
				},
				'editor.inlineSuggest.experimental.showOnSuggestConflict': {
					type: 'string',
					default: defaults.experimental.showOnSuggestConflict,
					tags: ['experimental'],
					enum: ['always', 'never', 'whenSuggestListIsIncomplete'],
					description: nls.localize('inlineSuggest.showOnSuggestConflict', "控制出现建议冲突时是否显示内联建议。"),
					experiment: {
						mode: 'auto'
					}
				},
				'editor.inlineSuggest.fontFamily': {
					type: 'string',
					default: defaults.fontFamily,
					description: nls.localize('inlineSuggest.fontFamily', "控制内联建议的字体。")
				},
				'editor.inlineSuggest.edits.allowCodeShifting': {
					type: 'string',
					default: defaults.edits.allowCodeShifting,
					description: nls.localize('inlineSuggest.edits.allowCodeShifting', "控制显示建议时是否为内联建议腾出空间而移动代码。"),
					enum: ['always', 'horizontal', 'never'],
					tags: ['nextEditSuggestions']
				},
				'editor.inlineSuggest.edits.showLongDistanceHint': {
					type: 'boolean',
					default: defaults.edits.showLongDistanceHint,
					description: nls.localize('inlineSuggest.edits.showLongDistanceHint', "控制是否显示距离较远的内联建议。"),
					tags: ['nextEditSuggestions', 'experimental']
				},
				'editor.inlineSuggest.edits.longDistanceHintContextLineCount': {
					type: 'number',
					default: defaults.edits.longDistanceHintContextLineCount,
					minimum: 0,
					maximum: 10,
					description: nls.localize('inlineSuggest.edits.longDistanceHintContextLineCount', "控制长距离内联建议预览中，目标行上下显示多少行上下文。设为 0 则只显示目标行。"),
					tags: ['nextEditSuggestions', 'experimental'],
					experiment: {
						mode: 'auto'
					}
				},
				'editor.inlineSuggest.edits.renderSideBySide': {
					type: 'string',
					default: defaults.edits.renderSideBySide,
					description: nls.localize('inlineSuggest.edits.renderSideBySide', "控制较大的建议是否可以并排显示。"),
					enum: ['auto', 'never'],
					enumDescriptions: [
						nls.localize('editor.inlineSuggest.edits.renderSideBySide.auto', "空间足够时较大的建议将并排显示，否则显示在下方。"),
						nls.localize('editor.inlineSuggest.edits.renderSideBySide.never', "较大的建议从不并排显示，始终显示在下方。"),
					],
					tags: ['nextEditSuggestions']
				},
				'editor.inlineSuggest.edits.showCollapsed': {
					type: 'boolean',
					default: defaults.edits.showCollapsed,
					description: nls.localize('inlineSuggest.edits.showCollapsed', "控制建议是否先折叠显示，直到跳转到它。"),
					tags: ['nextEditSuggestions']
				},
			}
		);
	}

	public validate(_input: unknown): InternalInlineSuggestOptions {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue;
		}
		const input = _input as Unknown<IInlineSuggestOptions>;
		return {
			enabled: boolean(input.enabled, this.defaultValue.enabled),
			mode: stringSet(input.mode, this.defaultValue.mode, ['prefix', 'subword', 'subwordSmart']),
			showToolbar: stringSet(input.showToolbar, this.defaultValue.showToolbar, ['always', 'onHover', 'never']),
			suppressSuggestions: boolean(input.suppressSuggestions, this.defaultValue.suppressSuggestions),
			keepOnBlur: boolean(input.keepOnBlur, this.defaultValue.keepOnBlur),
			fontFamily: EditorStringOption.string(input.fontFamily, this.defaultValue.fontFamily),
			syntaxHighlightingEnabled: boolean(input.syntaxHighlightingEnabled, this.defaultValue.syntaxHighlightingEnabled),
			minShowDelay: EditorIntOption.clampedInt(input.minShowDelay, 0, 0, 10000),
			suppressInSnippetMode: boolean(input.suppressInSnippetMode, this.defaultValue.suppressInSnippetMode),
			edits: this._validateEdits(input.edits),
			triggerCommandOnProviderChange: boolean(input.triggerCommandOnProviderChange, this.defaultValue.triggerCommandOnProviderChange),
			experimental: this._validateExperimental(input.experimental),
		};
	}

	private _validateEdits(_input: unknown): InternalInlineSuggestOptions['edits'] {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue.edits;
		}
		const input = _input as Unknown<InternalInlineSuggestOptions['edits']>;
		return {
			enabled: boolean(input.enabled, this.defaultValue.edits.enabled),
			showCollapsed: boolean(input.showCollapsed, this.defaultValue.edits.showCollapsed),
			allowCodeShifting: stringSet(input.allowCodeShifting, this.defaultValue.edits.allowCodeShifting, ['always', 'horizontal', 'never']),
			showLongDistanceHint: boolean(input.showLongDistanceHint, this.defaultValue.edits.showLongDistanceHint),
			longDistanceHintContextLineCount: EditorIntOption.clampedInt(input.longDistanceHintContextLineCount, this.defaultValue.edits.longDistanceHintContextLineCount, 0, 10),
			renderSideBySide: stringSet(input.renderSideBySide, this.defaultValue.edits.renderSideBySide, ['never', 'auto']),
		};
	}

	private _validateExperimental(_input: unknown): InternalInlineSuggestOptions['experimental'] {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue.experimental;
		}
		const input = _input as Unknown<InternalInlineSuggestOptions['experimental']>;
		return {
			suppressInlineSuggestions: EditorStringOption.string(input.suppressInlineSuggestions, this.defaultValue.experimental.suppressInlineSuggestions),
			showOnSuggestConflict: stringSet(input.showOnSuggestConflict, this.defaultValue.experimental.showOnSuggestConflict, ['always', 'never', 'whenSuggestListIsIncomplete']),
			emptyResponseInformation: boolean(input.emptyResponseInformation, this.defaultValue.experimental.emptyResponseInformation),
		};
	}
}

//#endregion

//#region bracketPairColorization

export interface IBracketPairColorizationOptions {
	/**
	 * Enable or disable bracket pair colorization.
	*/
	enabled?: boolean;

	/**
	 * Use independent color pool per bracket type.
	*/
	independentColorPoolPerBracketType?: boolean;
}

/**
 * @internal
 */
export type InternalBracketPairColorizationOptions = Readonly<Required<IBracketPairColorizationOptions>>;

/**
 * Configuration options for inline suggestions
 */
class BracketPairColorization extends BaseEditorOption<EditorOption.bracketPairColorization, IBracketPairColorizationOptions, InternalBracketPairColorizationOptions> {
	constructor() {
		const defaults: InternalBracketPairColorizationOptions = {
			enabled: EDITOR_MODEL_DEFAULTS.bracketPairColorizationOptions.enabled,
			independentColorPoolPerBracketType: EDITOR_MODEL_DEFAULTS.bracketPairColorizationOptions.independentColorPoolPerBracketType,
		};

		super(
			EditorOption.bracketPairColorization, 'bracketPairColorization', defaults,
			{
				'editor.bracketPairColorization.enabled': {
					type: 'boolean',
					default: defaults.enabled,
					markdownDescription: nls.localize('bracketPairColorization.enabled', "控制是否启用括号对着色。使用 {0} 可覆盖括号高亮颜色。", '`#workbench.colorCustomizations#`')
				},
				'editor.bracketPairColorization.independentColorPoolPerBracketType': {
					type: 'boolean',
					default: defaults.independentColorPoolPerBracketType,
					description: nls.localize('bracketPairColorization.independentColorPoolPerBracketType', "控制每种括号类型是否拥有各自独立的颜色池。")
				},
			}
		);
	}

	public validate(_input: unknown): InternalBracketPairColorizationOptions {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue;
		}
		const input = _input as Unknown<IBracketPairColorizationOptions>;
		return {
			enabled: boolean(input.enabled, this.defaultValue.enabled),
			independentColorPoolPerBracketType: boolean(input.independentColorPoolPerBracketType, this.defaultValue.independentColorPoolPerBracketType),
		};
	}
}

//#endregion

//#region guides

export interface IGuidesOptions {
	/**
	 * Enable rendering of bracket pair guides.
	 * Defaults to false.
	*/
	bracketPairs?: boolean | 'active';

	/**
	 * Enable rendering of vertical bracket pair guides.
	 * Defaults to 'active'.
	 */
	bracketPairsHorizontal?: boolean | 'active';

	/**
	 * Enable highlighting of the active bracket pair.
	 * Defaults to true.
	*/
	highlightActiveBracketPair?: boolean;

	/**
	 * Enable rendering of indent guides.
	 * Defaults to true.
	 */
	indentation?: boolean;

	/**
	 * Enable highlighting of the active indent guide.
	 * Defaults to true.
	 */
	highlightActiveIndentation?: boolean | 'always';
}

/**
 * @internal
 */
export type InternalGuidesOptions = Readonly<Required<IGuidesOptions>>;

/**
 * Configuration options for inline suggestions
 */
class GuideOptions extends BaseEditorOption<EditorOption.guides, IGuidesOptions, InternalGuidesOptions> {
	constructor() {
		const defaults: InternalGuidesOptions = {
			bracketPairs: false,
			bracketPairsHorizontal: 'active',
			highlightActiveBracketPair: true,

			indentation: true,
			highlightActiveIndentation: true
		};

		super(
			EditorOption.guides, 'guides', defaults,
			{
				'editor.guides.bracketPairs': {
					type: ['boolean', 'string'],
					enum: [true, 'active', false],
					enumDescriptions: [
						nls.localize('editor.guides.bracketPairs.true', "启用括号对参考线。"),
						nls.localize('editor.guides.bracketPairs.active', "仅为当前活动的括号对启用括号对参考线。"),
						nls.localize('editor.guides.bracketPairs.false', "禁用括号对参考线。"),
					],
					default: defaults.bracketPairs,
					description: nls.localize('editor.guides.bracketPairs', "控制是否启用括号对参考线。")
				},
				'editor.guides.bracketPairsHorizontal': {
					type: ['boolean', 'string'],
					enum: [true, 'active', false],
					enumDescriptions: [
						nls.localize('editor.guides.bracketPairsHorizontal.true', "在垂直括号对参考线之外启用水平参考线。"),
						nls.localize('editor.guides.bracketPairsHorizontal.active', "仅为当前活动的括号对启用水平参考线。"),
						nls.localize('editor.guides.bracketPairsHorizontal.false', "禁用水平括号对参考线。"),
					],
					default: defaults.bracketPairsHorizontal,
					description: nls.localize('editor.guides.bracketPairsHorizontal', "控制是否启用水平括号对参考线。")
				},
				'editor.guides.highlightActiveBracketPair': {
					type: 'boolean',
					default: defaults.highlightActiveBracketPair,
					description: nls.localize('editor.guides.highlightActiveBracketPair', "控制编辑器是否高亮当前活动的括号对。")
				},
				'editor.guides.indentation': {
					type: 'boolean',
					default: defaults.indentation,
					description: nls.localize('editor.guides.indentation', "控制编辑器是否渲染缩进参考线。")
				},
				'editor.guides.highlightActiveIndentation': {
					type: ['boolean', 'string'],
					enum: [true, 'always', false],
					enumDescriptions: [
						nls.localize('editor.guides.highlightActiveIndentation.true', "高亮当前的缩进参考线。"),
						nls.localize('editor.guides.highlightActiveIndentation.always', "即使已高亮括号参考线，也高亮当前的缩进参考线。"),
						nls.localize('editor.guides.highlightActiveIndentation.false', "不高亮当前的缩进参考线。"),
					],
					default: defaults.highlightActiveIndentation,

					description: nls.localize('editor.guides.highlightActiveIndentation', "控制编辑器是否高亮当前的缩进参考线。")
				}
			}
		);
	}

	public validate(_input: unknown): InternalGuidesOptions {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue;
		}
		const input = _input as Unknown<IGuidesOptions>;
		return {
			bracketPairs: primitiveSet(input.bracketPairs, this.defaultValue.bracketPairs, [true, false, 'active']),
			bracketPairsHorizontal: primitiveSet(input.bracketPairsHorizontal, this.defaultValue.bracketPairsHorizontal, [true, false, 'active']),
			highlightActiveBracketPair: boolean(input.highlightActiveBracketPair, this.defaultValue.highlightActiveBracketPair),

			indentation: boolean(input.indentation, this.defaultValue.indentation),
			highlightActiveIndentation: primitiveSet(input.highlightActiveIndentation, this.defaultValue.highlightActiveIndentation, [true, false, 'always']),
		};
	}
}

function primitiveSet<T extends string | boolean>(value: unknown, defaultValue: T, allowedValues: T[]): T {
	const idx = allowedValues.indexOf(value as T);
	if (idx === -1) {
		return defaultValue;
	}
	return allowedValues[idx];
}

//#endregion

//#region suggest

/**
 * Configuration options for editor suggest widget
 */
export interface ISuggestOptions {
	/**
	 * Overwrite word ends on accept. Default to false.
	 */
	insertMode?: 'insert' | 'replace';
	/**
	 * Enable graceful matching. Defaults to true.
	 */
	filterGraceful?: boolean;
	/**
	 * Prevent quick suggestions when a snippet is active. Defaults to true.
	 */
	snippetsPreventQuickSuggestions?: boolean;
	/**
	 * Favors words that appear close to the cursor.
	 */
	localityBonus?: boolean;
	/**
	 * Enable using global storage for remembering suggestions.
	 */
	shareSuggestSelections?: boolean;
	/**
	 * Select suggestions when triggered via quick suggest or trigger characters
	 */
	selectionMode?: 'always' | 'never' | 'whenTriggerCharacter' | 'whenQuickSuggestion';
	/**
	 * Enable or disable icons in suggestions. Defaults to true.
	 */
	showIcons?: boolean;
	/**
	 * Enable or disable the suggest status bar.
	 */
	showStatusBar?: boolean;
	/**
	 * Enable or disable the rendering of the suggestion preview.
	 */
	preview?: boolean;
	/**
	 * Configures the mode of the preview.
	*/
	previewMode?: 'prefix' | 'subword' | 'subwordSmart';
	/**
	 * Show details inline with the label. Defaults to true.
	 */
	showInlineDetails?: boolean;
	/**
	 * Grow the suggest widget's preferred width to fit the inline detail text so it
	 * is not truncated. Defaults to false.
	 * @internal
	 */
	fitWidthToDetails?: boolean;
	/**
	 * Show method-suggestions.
	 */
	showMethods?: boolean;
	/**
	 * Show function-suggestions.
	 */
	showFunctions?: boolean;
	/**
	 * Show constructor-suggestions.
	 */
	showConstructors?: boolean;
	/**
	 * Show deprecated-suggestions.
	 */
	showDeprecated?: boolean;
	/**
	 * Controls whether suggestions allow matches in the middle of the word instead of only at the beginning
	 */
	matchOnWordStartOnly?: boolean;
	/**
	 * Show field-suggestions.
	 */
	showFields?: boolean;
	/**
	 * Show variable-suggestions.
	 */
	showVariables?: boolean;
	/**
	 * Show class-suggestions.
	 */
	showClasses?: boolean;
	/**
	 * Show struct-suggestions.
	 */
	showStructs?: boolean;
	/**
	 * Show interface-suggestions.
	 */
	showInterfaces?: boolean;
	/**
	 * Show module-suggestions.
	 */
	showModules?: boolean;
	/**
	 * Show property-suggestions.
	 */
	showProperties?: boolean;
	/**
	 * Show event-suggestions.
	 */
	showEvents?: boolean;
	/**
	 * Show operator-suggestions.
	 */
	showOperators?: boolean;
	/**
	 * Show unit-suggestions.
	 */
	showUnits?: boolean;
	/**
	 * Show value-suggestions.
	 */
	showValues?: boolean;
	/**
	 * Show constant-suggestions.
	 */
	showConstants?: boolean;
	/**
	 * Show enum-suggestions.
	 */
	showEnums?: boolean;
	/**
	 * Show enumMember-suggestions.
	 */
	showEnumMembers?: boolean;
	/**
	 * Show keyword-suggestions.
	 */
	showKeywords?: boolean;
	/**
	 * Show text-suggestions.
	 */
	showWords?: boolean;
	/**
	 * Show color-suggestions.
	 */
	showColors?: boolean;
	/**
	 * Show file-suggestions.
	 */
	showFiles?: boolean;
	/**
	 * Show reference-suggestions.
	 */
	showReferences?: boolean;
	/**
	 * Show folder-suggestions.
	 */
	showFolders?: boolean;
	/**
	 * Show typeParameter-suggestions.
	 */
	showTypeParameters?: boolean;
	/**
	 * Show issue-suggestions.
	 */
	showIssues?: boolean;
	/**
	 * Show user-suggestions.
	 */
	showUsers?: boolean;
	/**
	 * Show snippet-suggestions.
	 */
	showSnippets?: boolean;
}

/**
 * @internal
 */
export type InternalSuggestOptions = Readonly<Required<ISuggestOptions>>;

class EditorSuggest extends BaseEditorOption<EditorOption.suggest, ISuggestOptions, InternalSuggestOptions> {

	constructor() {
		const defaults: InternalSuggestOptions = {
			insertMode: 'insert',
			filterGraceful: true,
			snippetsPreventQuickSuggestions: false,
			localityBonus: false,
			shareSuggestSelections: false,
			selectionMode: 'always',
			showIcons: true,
			showStatusBar: false,
			preview: false,
			previewMode: 'subwordSmart',
			showInlineDetails: true,
			fitWidthToDetails: false,
			showMethods: true,
			showFunctions: true,
			showConstructors: true,
			showDeprecated: true,
			matchOnWordStartOnly: true,
			showFields: true,
			showVariables: true,
			showClasses: true,
			showStructs: true,
			showInterfaces: true,
			showModules: true,
			showProperties: true,
			showEvents: true,
			showOperators: true,
			showUnits: true,
			showValues: true,
			showConstants: true,
			showEnums: true,
			showEnumMembers: true,
			showKeywords: true,
			showWords: true,
			showColors: true,
			showFiles: true,
			showReferences: true,
			showFolders: true,
			showTypeParameters: true,
			showSnippets: true,
			showUsers: true,
			showIssues: true,
		};
		super(
			EditorOption.suggest, 'suggest', defaults,
			{
				'editor.suggest.insertMode': {
					type: 'string',
					enum: ['insert', 'replace'],
					enumDescriptions: [
						nls.localize('suggest.insertMode.insert', "插入建议且不覆盖光标右侧的文本。"),
						nls.localize('suggest.insertMode.replace', "插入建议并覆盖光标右侧的文本。"),
					],
					default: defaults.insertMode,
					description: nls.localize('suggest.insertMode', "控制接受补全时是否覆盖单词。注意：这取决于扩展是否选择启用此功能。")
				},
				'editor.suggest.filterGraceful': {
					type: 'boolean',
					default: defaults.filterGraceful,
					description: nls.localize('suggest.filterGraceful', "控制建议的筛选和排序是否考虑小的拼写错误。")
				},
				'editor.suggest.localityBonus': {
					type: 'boolean',
					default: defaults.localityBonus,
					description: nls.localize('suggest.localityBonus', "控制排序是否优先选择出现在光标附近的词。")
				},
				'editor.suggest.shareSuggestSelections': {
					type: 'boolean',
					default: defaults.shareSuggestSelections,
					markdownDescription: nls.localize('suggest.shareSuggestSelections', "控制记住的建议选择是否在多个工作区和窗口之间共享（需要 `#editor.suggestSelection#`）。")
				},
				'editor.suggest.selectionMode': {
					type: 'string',
					enum: ['always', 'never', 'whenTriggerCharacter', 'whenQuickSuggestion'],
					enumDescriptions: [
						nls.localize('suggest.insertMode.always', "自动触发 IntelliSense 时总是选中一条建议。"),
						nls.localize('suggest.insertMode.never', "自动触发 IntelliSense 时从不选中建议。"),
						nls.localize('suggest.insertMode.whenTriggerCharacter', "仅当由触发字符触发 IntelliSense 时才选中建议。"),
						nls.localize('suggest.insertMode.whenQuickSuggestion', "仅当输入过程中触发 IntelliSense 时才选中建议。"),
					],
					default: defaults.selectionMode,
					markdownDescription: nls.localize('suggest.selectionMode', "控制建议小工具弹出时是否默认选中某条建议。请注意，这只适用于自动触发的建议（{0} 和 {1}）；如果是显式调用（例如通过 Ctrl+Space），则总会选中一条建议。", '`#editor.quickSuggestions#`', '`#editor.suggestOnTriggerCharacters#`')
				},
				'editor.suggest.snippetsPreventQuickSuggestions': {
					type: 'boolean',
					default: defaults.snippetsPreventQuickSuggestions,
					description: nls.localize('suggest.snippetsPreventQuickSuggestions', "控制激活的代码片段是否阻止快速建议。")
				},
				'editor.suggest.showIcons': {
					type: 'boolean',
					default: defaults.showIcons,
					description: nls.localize('suggest.showIcons', "控制是否在建议中显示图标。")
				},
				'editor.suggest.showStatusBar': {
					type: 'boolean',
					default: defaults.showStatusBar,
					description: nls.localize('suggest.showStatusBar', "控制建议控件底部状态栏的可见性。")
				},
				'editor.suggest.preview': {
					type: 'boolean',
					default: defaults.preview,
					description: nls.localize('suggest.preview', "控制是否在编辑器中预览接受建议后的结果。")
				},
				'editor.suggest.showInlineDetails': {
					type: 'boolean',
					default: defaults.showInlineDetails,
					description: nls.localize('suggest.showInlineDetails', "控制建议详情是与标签同行显示，还是仅在详情小部件中显示。")
				},
				'editor.suggest.filteredTypes': {
					type: 'object',
					deprecationMessage: nls.localize('deprecated', "此设置已弃用，请改用 'editor.suggest.showKeywords' 或 'editor.suggest.showSnippets' 等单独设置。")
				},
				'editor.suggest.showMethods': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showMethods', "启用后，IntelliSense 会显示 `method`（方法）建议。")
				},
				'editor.suggest.showFunctions': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showFunctions', "启用后，IntelliSense 会显示 `function`（函数）建议。")
				},
				'editor.suggest.showConstructors': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showConstructors', "启用后，IntelliSense 会显示 `constructor`（构造函数）建议。")
				},
				'editor.suggest.showDeprecated': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showDeprecated', "启用后，IntelliSense 会显示 `deprecated`（已弃用）建议。")
				},
				'editor.suggest.matchOnWordStartOnly': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.matchOnWordStartOnly', "启用后，智能感知筛选要求首个字符在单词起始处匹配。例如在 Console 或 WebContext 上输入 c 可以匹配，但在 description 上则不行。禁用后，智能感知会显示更多结果，但仍会按匹配质量排序。")
				},
				'editor.suggest.showFields': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showFields', "启用后，IntelliSense 会显示 `field`（字段）建议。")
				},
				'editor.suggest.showVariables': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showVariables', "启用后，IntelliSense 会显示 `variable`（变量）建议。")
				},
				'editor.suggest.showClasses': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showClasss', "启用后，IntelliSense 会显示 `class`（类）建议。")
				},
				'editor.suggest.showStructs': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showStructs', "启用后，IntelliSense 会显示 `struct`（结构体）建议。")
				},
				'editor.suggest.showInterfaces': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showInterfaces', "启用后，IntelliSense 会显示 `interface`（接口）建议。")
				},
				'editor.suggest.showModules': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showModules', "启用后，IntelliSense 会显示 `module`（模块）建议。")
				},
				'editor.suggest.showProperties': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showPropertys', "启用后，IntelliSense 会显示 `property`（属性）建议。")
				},
				'editor.suggest.showEvents': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showEvents', "启用后，IntelliSense 会显示 `event`（事件）建议。")
				},
				'editor.suggest.showOperators': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showOperators', "启用后，IntelliSense 会显示 `operator`（运算符）建议。")
				},
				'editor.suggest.showUnits': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showUnits', "启用后，IntelliSense 会显示 `unit`（单元）建议。")
				},
				'editor.suggest.showValues': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showValues', "启用后，IntelliSense 会显示 `value`（值）建议。")
				},
				'editor.suggest.showConstants': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showConstants', "启用后，IntelliSense 会显示 `constant`（常量）建议。")
				},
				'editor.suggest.showEnums': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showEnums', "启用后，IntelliSense 会显示 `enum`（枚举）建议。")
				},
				'editor.suggest.showEnumMembers': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showEnumMembers', "启用后，IntelliSense 会显示 `enumMember`（枚举成员）建议。")
				},
				'editor.suggest.showKeywords': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showKeywords', "启用后，IntelliSense 会显示 `keyword`（关键字）建议。")
				},
				'editor.suggest.showWords': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showTexts', "启用后，IntelliSense 会显示 `text`（文本）建议。")
				},
				'editor.suggest.showColors': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showColors', "启用后，IntelliSense 会显示 `color`（颜色）建议。")
				},
				'editor.suggest.showFiles': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showFiles', "启用后，IntelliSense 会显示 `file`（文件）建议。")
				},
				'editor.suggest.showReferences': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showReferences', "启用后，IntelliSense 会显示 `reference`（引用）建议。")
				},
				'editor.suggest.showCustomcolors': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showCustomcolors', "启用后，IntelliSense 会显示 `customcolor`（自定义颜色）建议。")
				},
				'editor.suggest.showFolders': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showFolders', "启用后，IntelliSense 会显示 `folder`（文件夹）建议。")
				},
				'editor.suggest.showTypeParameters': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showTypeParameters', "启用后，IntelliSense 会显示 `typeParameter`（类型参数）建议。")
				},
				'editor.suggest.showSnippets': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showSnippets', "启用后，IntelliSense 会显示 `snippet`（代码片段）建议。")
				},
				'editor.suggest.showUsers': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showUsers', "启用后，IntelliSense 会显示 `user`（用户）建议。")
				},
				'editor.suggest.showIssues': {
					type: 'boolean',
					default: true,
					markdownDescription: nls.localize('editor.suggest.showIssues', "启用后，IntelliSense 会显示 `issues`（问题）建议。")
				}
			}
		);
	}

	public validate(_input: unknown): InternalSuggestOptions {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue;
		}
		const input = _input as Unknown<ISuggestOptions>;
		return {
			insertMode: stringSet(input.insertMode, this.defaultValue.insertMode, ['insert', 'replace']),
			filterGraceful: boolean(input.filterGraceful, this.defaultValue.filterGraceful),
			snippetsPreventQuickSuggestions: boolean(input.snippetsPreventQuickSuggestions, this.defaultValue.filterGraceful),
			localityBonus: boolean(input.localityBonus, this.defaultValue.localityBonus),
			shareSuggestSelections: boolean(input.shareSuggestSelections, this.defaultValue.shareSuggestSelections),
			selectionMode: stringSet(input.selectionMode, this.defaultValue.selectionMode, ['always', 'never', 'whenQuickSuggestion', 'whenTriggerCharacter']),
			showIcons: boolean(input.showIcons, this.defaultValue.showIcons),
			showStatusBar: boolean(input.showStatusBar, this.defaultValue.showStatusBar),
			preview: boolean(input.preview, this.defaultValue.preview),
			previewMode: stringSet(input.previewMode, this.defaultValue.previewMode, ['prefix', 'subword', 'subwordSmart']),
			showInlineDetails: boolean(input.showInlineDetails, this.defaultValue.showInlineDetails),
			fitWidthToDetails: boolean(input.fitWidthToDetails, this.defaultValue.fitWidthToDetails),
			showMethods: boolean(input.showMethods, this.defaultValue.showMethods),
			showFunctions: boolean(input.showFunctions, this.defaultValue.showFunctions),
			showConstructors: boolean(input.showConstructors, this.defaultValue.showConstructors),
			showDeprecated: boolean(input.showDeprecated, this.defaultValue.showDeprecated),
			matchOnWordStartOnly: boolean(input.matchOnWordStartOnly, this.defaultValue.matchOnWordStartOnly),
			showFields: boolean(input.showFields, this.defaultValue.showFields),
			showVariables: boolean(input.showVariables, this.defaultValue.showVariables),
			showClasses: boolean(input.showClasses, this.defaultValue.showClasses),
			showStructs: boolean(input.showStructs, this.defaultValue.showStructs),
			showInterfaces: boolean(input.showInterfaces, this.defaultValue.showInterfaces),
			showModules: boolean(input.showModules, this.defaultValue.showModules),
			showProperties: boolean(input.showProperties, this.defaultValue.showProperties),
			showEvents: boolean(input.showEvents, this.defaultValue.showEvents),
			showOperators: boolean(input.showOperators, this.defaultValue.showOperators),
			showUnits: boolean(input.showUnits, this.defaultValue.showUnits),
			showValues: boolean(input.showValues, this.defaultValue.showValues),
			showConstants: boolean(input.showConstants, this.defaultValue.showConstants),
			showEnums: boolean(input.showEnums, this.defaultValue.showEnums),
			showEnumMembers: boolean(input.showEnumMembers, this.defaultValue.showEnumMembers),
			showKeywords: boolean(input.showKeywords, this.defaultValue.showKeywords),
			showWords: boolean(input.showWords, this.defaultValue.showWords),
			showColors: boolean(input.showColors, this.defaultValue.showColors),
			showFiles: boolean(input.showFiles, this.defaultValue.showFiles),
			showReferences: boolean(input.showReferences, this.defaultValue.showReferences),
			showFolders: boolean(input.showFolders, this.defaultValue.showFolders),
			showTypeParameters: boolean(input.showTypeParameters, this.defaultValue.showTypeParameters),
			showSnippets: boolean(input.showSnippets, this.defaultValue.showSnippets),
			showUsers: boolean(input.showUsers, this.defaultValue.showUsers),
			showIssues: boolean(input.showIssues, this.defaultValue.showIssues),
		};
	}
}

//#endregion

//#region smart select

export interface ISmartSelectOptions {
	selectLeadingAndTrailingWhitespace?: boolean;
	selectSubwords?: boolean;
}

/**
 * @internal
 */
export type SmartSelectOptions = Readonly<Required<ISmartSelectOptions>>;

class SmartSelect extends BaseEditorOption<EditorOption.smartSelect, ISmartSelectOptions, SmartSelectOptions> {

	constructor() {
		super(
			EditorOption.smartSelect, 'smartSelect',
			{
				selectLeadingAndTrailingWhitespace: true,
				selectSubwords: true,
			},
			{
				'editor.smartSelect.selectLeadingAndTrailingWhitespace': {
					description: nls.localize('selectLeadingAndTrailingWhitespace', "是否总是选中首尾的空白字符。"),
					default: true,
					type: 'boolean'
				},
				'editor.smartSelect.selectSubwords': {
					description: nls.localize('selectSubwords', "是否选中子词（例如 'fooBar' 或 'foo_bar' 中的 'foo'）。"),
					default: true,
					type: 'boolean'
				}
			}
		);
	}

	public validate(input: unknown): Readonly<Required<ISmartSelectOptions>> {
		if (!input || typeof input !== 'object') {
			return this.defaultValue;
		}
		return {
			selectLeadingAndTrailingWhitespace: boolean((input as ISmartSelectOptions).selectLeadingAndTrailingWhitespace, this.defaultValue.selectLeadingAndTrailingWhitespace),
			selectSubwords: boolean((input as ISmartSelectOptions).selectSubwords, this.defaultValue.selectSubwords),
		};
	}
}

//#endregion

//#region wordSegmenterLocales

/**
 * Locales used for segmenting lines into words when doing word related navigations or operations.
 *
 * Specify the BCP 47 language tag of the word you wish to recognize (e.g., ja, zh-CN, zh-Hant-TW, etc.).
 */
class WordSegmenterLocales extends BaseEditorOption<EditorOption.wordSegmenterLocales, string | string[], string[]> {
	constructor() {
		const defaults: string[] = [];

		super(
			EditorOption.wordSegmenterLocales, 'wordSegmenterLocales', defaults,
			{
				anyOf: [
					{
						type: 'string',
					}, {
						type: 'array',
						items: {
							type: 'string'
						}
					}
				],
				description: nls.localize('wordSegmenterLocales', "进行与单词相关的导航或操作时用于分词的区域设置。指定要识别的单词所使用的 BCP 47 语言标记（例如 ja、zh-CN、zh-Hant-TW 等）。"),
				type: 'array',
				items: {
					type: 'string',
				},
				default: defaults,
			},
		);
	}

	public validate(input: unknown): string[] {
		if (typeof input === 'string') {
			input = [input];
		}
		if (Array.isArray(input)) {
			const validLocales: string[] = [];
			for (const locale of input) {
				if (typeof locale === 'string') {
					try {
						if (Intl.Segmenter.supportedLocalesOf(locale).length > 0) {
							validLocales.push(locale);
						}
					} catch {
						// ignore invalid locales
					}
				}
			}
			return validLocales;
		}

		return this.defaultValue;
	}
}


//#endregion

//#region wrappingIndent

/**
 * Describes how to indent wrapped lines.
 */
export const enum WrappingIndent {
	/**
	 * No indentation => wrapped lines begin at column 1.
	 */
	None = 0,
	/**
	 * Same => wrapped lines get the same indentation as the parent.
	 */
	Same = 1,
	/**
	 * Indent => wrapped lines get +1 indentation toward the parent.
	 */
	Indent = 2,
	/**
	 * DeepIndent => wrapped lines get +2 indentation toward the parent.
	 */
	DeepIndent = 3
}

class WrappingIndentOption extends BaseEditorOption<EditorOption.wrappingIndent, 'none' | 'same' | 'indent' | 'deepIndent', WrappingIndent> {

	constructor() {
		super(EditorOption.wrappingIndent, 'wrappingIndent', WrappingIndent.Same,
			{
				'editor.wrappingIndent': {
					type: 'string',
					enum: ['none', 'same', 'indent', 'deepIndent'],
					enumDescriptions: [
						nls.localize('wrappingIndent.none', "不缩进。折行从第 1 列开始。"),
						nls.localize('wrappingIndent.same', "折行与父级保持相同缩进。"),
						nls.localize('wrappingIndent.indent', "折行相对父级多缩进 1 级。"),
						nls.localize('wrappingIndent.deepIndent', "折行相对父级多缩进 2 级。"),
					],
					description: nls.localize('wrappingIndent', "控制折行的缩进。"),
					default: 'same'
				}
			}
		);
	}

	public validate(input: unknown): WrappingIndent {
		switch (input) {
			case 'none': return WrappingIndent.None;
			case 'same': return WrappingIndent.Same;
			case 'indent': return WrappingIndent.Indent;
			case 'deepIndent': return WrappingIndent.DeepIndent;
		}
		return WrappingIndent.Same;
	}

	public override compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, value: WrappingIndent): WrappingIndent {
		const accessibilitySupport = options.get(EditorOption.accessibilitySupport);
		if (accessibilitySupport === AccessibilitySupport.Enabled) {
			// if we know for a fact that a screen reader is attached, we use no indent wrapping to
			// help that the editor's wrapping points match the textarea's wrapping points
			return WrappingIndent.None;
		}
		return value;
	}
}

//#endregion

//#region wrappingInfo

export interface EditorWrappingInfo {
	readonly isDominatedByLongLines: boolean;
	readonly isWordWrapMinified: boolean;
	readonly isViewportWrapping: boolean;
	readonly wrappingColumn: number;
}

class EditorWrappingInfoComputer extends ComputedEditorOption<EditorOption.wrappingInfo, EditorWrappingInfo> {

	constructor() {
		super(EditorOption.wrappingInfo, {
			isDominatedByLongLines: false,
			isWordWrapMinified: false,
			isViewportWrapping: false,
			wrappingColumn: -1
		});
	}

	public compute(env: IEnvironmentalOptions, options: IComputedEditorOptions, _: EditorWrappingInfo): EditorWrappingInfo {
		const layoutInfo = options.get(EditorOption.layoutInfo);

		return {
			isDominatedByLongLines: env.isDominatedByLongLines,
			isWordWrapMinified: layoutInfo.isWordWrapMinified,
			isViewportWrapping: layoutInfo.isViewportWrapping,
			wrappingColumn: layoutInfo.wrappingColumn,
		};
	}
}

//#endregion

//#region dropIntoEditor

/**
 * Configuration options for editor drop into behavior
 */
export interface IDropIntoEditorOptions {
	/**
	 * Enable dropping into editor.
	 * Defaults to true.
	 */
	enabled?: boolean;

	/**
	 * Controls if a widget is shown after a drop.
	 * Defaults to 'afterDrop'.
	 */
	showDropSelector?: 'afterDrop' | 'never';
}

/**
 * @internal
 */
export type EditorDropIntoEditorOptions = Readonly<Required<IDropIntoEditorOptions>>;

class EditorDropIntoEditor extends BaseEditorOption<EditorOption.dropIntoEditor, IDropIntoEditorOptions, EditorDropIntoEditorOptions> {

	constructor() {
		const defaults: EditorDropIntoEditorOptions = { enabled: true, showDropSelector: 'afterDrop' };
		super(
			EditorOption.dropIntoEditor, 'dropIntoEditor', defaults,
			{
				'editor.dropIntoEditor.enabled': {
					type: 'boolean',
					default: defaults.enabled,
					markdownDescription: nls.localize('dropIntoEditor.enabled', "控制是否可以按住 `Shift` 键把文件拖放到文本编辑器中（而不是在编辑器中打开该文件）。"),
				},
				'editor.dropIntoEditor.showDropSelector': {
					type: 'string',
					markdownDescription: nls.localize('dropIntoEditor.showDropSelector', "控制向编辑器拖放文件时是否显示选择小部件。该小部件让你决定文件的放置方式。"),
					enum: [
						'afterDrop',
						'never'
					],
					enumDescriptions: [
						nls.localize('dropIntoEditor.showDropSelector.afterDrop', "文件被拖放到编辑器后显示放置方式选择小部件。"),
						nls.localize('dropIntoEditor.showDropSelector.never', "从不显示放置方式选择小部件，始终使用默认的放置处理方式。"),
					],
					default: 'afterDrop',
				},
			}
		);
	}

	public validate(_input: unknown): EditorDropIntoEditorOptions {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue;
		}
		const input = _input as Unknown<IDropIntoEditorOptions>;
		return {
			enabled: boolean(input.enabled, this.defaultValue.enabled),
			showDropSelector: stringSet(input.showDropSelector, this.defaultValue.showDropSelector, ['afterDrop', 'never']),
		};
	}
}

//#endregion

//#region pasteAs

/**
 * Configuration options for editor pasting as into behavior
 */
export interface IPasteAsOptions {
	/**
	 * Enable paste as functionality in editors.
	 * Defaults to true.
	 */
	enabled?: boolean;

	/**
	 * Controls if a widget is shown after a drop.
	 * Defaults to 'afterPaste'.
	 */
	showPasteSelector?: 'afterPaste' | 'never';
}

/**
 * @internal
 */
export type EditorPasteAsOptions = Readonly<Required<IPasteAsOptions>>;

class EditorPasteAs extends BaseEditorOption<EditorOption.pasteAs, IPasteAsOptions, EditorPasteAsOptions> {

	constructor() {
		const defaults: EditorPasteAsOptions = { enabled: true, showPasteSelector: 'afterPaste' };
		super(
			EditorOption.pasteAs, 'pasteAs', defaults,
			{
				'editor.pasteAs.enabled': {
					type: 'boolean',
					default: defaults.enabled,
					markdownDescription: nls.localize('pasteAs.enabled', "控制是否可以按不同方式粘贴内容。"),
				},
				'editor.pasteAs.showPasteSelector': {
					type: 'string',
					markdownDescription: nls.localize('pasteAs.showPasteSelector', "控制向编辑器粘贴内容时是否显示选择小部件。该小部件让你决定内容的粘贴方式。"),
					enum: [
						'afterPaste',
						'never'
					],
					enumDescriptions: [
						nls.localize('pasteAs.showPasteSelector.afterPaste', "内容被粘贴到编辑器后显示粘贴方式选择小部件。"),
						nls.localize('pasteAs.showPasteSelector.never', "从不显示粘贴方式选择小部件，始终使用默认的粘贴行为。"),
					],
					default: 'afterPaste',
				},
			}
		);
	}

	public validate(_input: unknown): EditorPasteAsOptions {
		if (!_input || typeof _input !== 'object') {
			return this.defaultValue;
		}
		const input = _input as Unknown<IPasteAsOptions>;
		return {
			enabled: boolean(input.enabled, this.defaultValue.enabled),
			showPasteSelector: stringSet(input.showPasteSelector, this.defaultValue.showPasteSelector, ['afterPaste', 'never']),
		};
	}
}

//#endregion

/**
 * @internal
 */
export const editorOptionsRegistry: IEditorOption<EditorOption, unknown>[] = [];

function register<K extends EditorOption, V>(option: IEditorOption<K, V>): IEditorOption<K, V> {
	editorOptionsRegistry[option.id] = option;
	return option;
}

export const enum EditorOption {
	acceptSuggestionOnCommitCharacter,
	acceptSuggestionOnEnter,
	accessibilitySupport,
	accessibilityPageSize,
	allowOverflow,
	allowVariableLineHeights,
	allowVariableFonts,
	allowVariableFontsInAccessibilityMode,
	ariaLabel,
	ariaRequired,
	autoClosingBrackets,
	autoClosingComments,
	screenReaderAnnounceInlineSuggestion,
	autoClosingDelete,
	autoClosingOvertype,
	autoClosingQuotes,
	autoIndent,
	autoIndentOnPaste,
	autoIndentOnPasteWithinString,
	automaticLayout,
	autoSurround,
	bracketPairColorization,
	guides,
	codeLens,
	codeLensFontFamily,
	codeLensFontSize,
	colorDecorators,
	colorDecoratorsLimit,
	columnSelection,
	comments,
	contextmenu,
	copyWithSyntaxHighlighting,
	cursorBlinking,
	cursorSmoothCaretAnimation,
	cursorStyle,
	cursorSurroundingLines,
	cursorSurroundingLinesStyle,
	cursorWidth,
	cursorHeight,
	disableLayerHinting,
	disableMonospaceOptimizations,
	domReadOnly,
	dragAndDrop,
	dropIntoEditor,
	editContext,
	emptySelectionClipboard,
	experimentalGpuAcceleration,
	experimentalWhitespaceRendering,
	extraEditorClassName,
	fastScrollSensitivity,
	find,
	fixedOverflowWidgets,
	folding,
	foldingStrategy,
	foldingHighlight,
	foldingImportsByDefault,
	foldingMaximumRegions,
	unfoldOnClickAfterEndOfLine,
	fontFamily,
	fontInfo,
	fontLigatures,
	fontSize,
	fontWeight,
	fontVariations,
	formatOnPaste,
	formatOnType,
	glyphMargin,
	gotoLocation,
	hideCursorInOverviewRuler,
	hover,
	inDiffEditor,
	inlineSuggest,
	letterSpacing,
	lightbulb,
	lineDecorationsWidth,
	lineHeight,
	lineNumbers,
	lineNumbersMinChars,
	linkedEditing,
	links,
	matchBrackets,
	minimap,
	mouseStyle,
	mouseWheelScrollSensitivity,
	mouseWheelZoom,
	multiCursorMergeOverlapping,
	multiCursorModifier,
	mouseMiddleClickAction,
	multiCursorPaste,
	multiCursorLimit,
	occurrencesHighlight,
	occurrencesHighlightDelay,
	overtypeCursorStyle,
	overtypeOnPaste,
	overviewRulerBorder,
	overviewRulerLanes,
	padding,
	pasteAs,
	parameterHints,
	peekWidgetDefaultFocus,
	placeholder,
	definitionLinkOpensInPeek,
	quickSuggestions,
	quickSuggestionsDelay,
	readOnly,
	readOnlyMessage,
	renameOnType,
	renderRichScreenReaderContent,
	renderControlCharacters,
	renderFinalNewline,
	renderLineHighlight,
	renderLineHighlightOnlyWhenFocus,
	renderValidationDecorations,
	renderWhitespace,
	revealHorizontalRightPadding,
	roundedSelection,
	rulers,
	scrollbar,
	scrollBeyondLastColumn,
	scrollBeyondLastLine,
	scrollPredominantAxis,
	selectionClipboard,
	selectionHighlight,
	selectionHighlightMaxLength,
	selectionHighlightMultiline,
	selectedTextMatchMode,
	selectOnLineNumbers,
	showFoldingControls,
	showUnused,
	snippetSuggestions,
	smartSelect,
	smoothScrolling,
	stickyScroll,
	stickyTabStops,
	stopRenderingLineAfter,
	suggest,
	suggestFontSize,
	suggestLineHeight,
	suggestOnTriggerCharacters,
	suggestSelection,
	tabCompletion,
	tabIndex,
	trimWhitespaceOnDelete,
	unicodeHighlighting,
	unusualLineTerminators,
	useShadowDOM,
	useTabStops,
	wordBreak,
	wordSegmenterLocales,
	wordSeparators,
	wordWrap,
	wordWrapBreakAfterCharacters,
	wordWrapBreakBeforeCharacters,
	wordWrapColumn,
	wordWrapOverride1,
	wordWrapOverride2,
	wrappingIndent,
	wrappingStrategy,
	showDeprecated,
	inertialScroll,
	inlayHints,
	wrapOnEscapedLineFeeds,
	wordWrapIndicator,
	// Leave these at the end (because they have dependencies!)
	effectiveCursorStyle,
	editorClassName,
	pixelRatio,
	tabFocusMode,
	layoutInfo,
	wrappingInfo,
	defaultColorDecorators,
	colorDecoratorsActivatedOn,
	inlineCompletionsAccessibilityVerbose,
	effectiveEditContext,
	scrollOnMiddleClick,
	effectiveAllowVariableFonts,
	doubleClickSelectsBlock,
	fullwidthCharacterWidth,
	// Must come after `fullwidthCharacterWidth`, which it is computed from.
	effectiveFullwidthCharacterWidth
}

export const EditorOptions = {
	acceptSuggestionOnCommitCharacter: register(new EditorBooleanOption(
		EditorOption.acceptSuggestionOnCommitCharacter, 'acceptSuggestionOnCommitCharacter', true,
		{ markdownDescription: nls.localize('acceptSuggestionOnCommitCharacter', "控制是否在输入提交字符时接受建议。例如在 JavaScript 中，分号（`;`）可以是提交字符，用于接受建议并输入该字符。") }
	)),
	acceptSuggestionOnEnter: register(new EditorStringEnumOption(
		EditorOption.acceptSuggestionOnEnter, 'acceptSuggestionOnEnter',
		'on' as 'on' | 'smart' | 'off',
		['on', 'smart', 'off'] as const,
		{
			markdownEnumDescriptions: [
				'',
				nls.localize('acceptSuggestionOnEnterSmart', "仅当建议会带来文本变更时，才用 `Enter` 接受它。"),
				''
			],
			markdownDescription: nls.localize('acceptSuggestionOnEnter', "控制除 `Tab` 之外，是否也用 `Enter` 接受建议。有助于避免「插入换行」与「接受建议」之间的歧义。")
		}
	)),
	accessibilitySupport: register(new EditorAccessibilitySupport()),
	accessibilityPageSize: register(new EditorIntOption(EditorOption.accessibilityPageSize, 'accessibilityPageSize', 500, 1, Constants.MAX_SAFE_SMALL_INTEGER,
		{
			description: nls.localize('accessibilityPageSize', "控制屏幕阅读器一次可以朗读编辑器中的多少行。检测到屏幕阅读器时，我们会自动把默认值设为 500。警告：取值大于默认值会带来性能开销。"),
			tags: ['accessibility']
		}
	)),
	allowOverflow: register(new EditorBooleanOption(
		EditorOption.allowOverflow, 'allowOverflow', true,
	)),
	allowVariableLineHeights: register(new EditorBooleanOption(
		EditorOption.allowVariableLineHeights, 'allowVariableLineHeights', true,
		{
			description: nls.localize('allowVariableLineHeights', "控制是否允许在编辑器中使用可变行高。")
		}
	)),
	allowVariableFonts: register(new EditorBooleanOption(
		EditorOption.allowVariableFonts, 'allowVariableFonts', true,
		{
			description: nls.localize('allowVariableFonts', "控制是否允许在编辑器中使用可变字体。")
		}
	)),
	allowVariableFontsInAccessibilityMode: register(new EditorBooleanOption(
		EditorOption.allowVariableFontsInAccessibilityMode, 'allowVariableFontsInAccessibilityMode', false,
		{
			description: nls.localize('allowVariableFontsInAccessibilityMode', "控制是否允许在无障碍模式的编辑器中使用可变字体。"),
			tags: ['accessibility']
		}
	)),
	ariaLabel: register(new EditorStringOption(
		EditorOption.ariaLabel, 'ariaLabel', nls.localize('editorViewAccessibleLabel', "编辑器内容")
	)),
	ariaRequired: register(new EditorBooleanOption(
		EditorOption.ariaRequired, 'ariaRequired', false, undefined
	)),
	screenReaderAnnounceInlineSuggestion: register(new EditorBooleanOption(
		EditorOption.screenReaderAnnounceInlineSuggestion, 'screenReaderAnnounceInlineSuggestion', true,
		{
			description: nls.localize('screenReaderAnnounceInlineSuggestion', "控制屏幕阅读器是否播报内联建议。"),
			tags: ['accessibility']
		}
	)),
	autoClosingBrackets: register(new EditorStringEnumOption(
		EditorOption.autoClosingBrackets, 'autoClosingBrackets',
		'languageDefined' as 'always' | 'languageDefined' | 'beforeWhitespace' | 'never',
		['always', 'languageDefined', 'beforeWhitespace', 'never'] as const,
		{
			enumDescriptions: [
				'',
				nls.localize('editor.autoClosingBrackets.languageDefined', "使用语言配置来确定何时自动闭合括号。"),
				nls.localize('editor.autoClosingBrackets.beforeWhitespace', "仅当光标位于空白字符左侧时才自动闭合括号。"),
				'',
			],
			description: nls.localize('autoClosingBrackets', "控制用户输入左括号后，编辑器是否自动补全右括号。")
		}
	)),
	autoClosingComments: register(new EditorStringEnumOption(
		EditorOption.autoClosingComments, 'autoClosingComments',
		'languageDefined' as 'always' | 'languageDefined' | 'beforeWhitespace' | 'never',
		['always', 'languageDefined', 'beforeWhitespace', 'never'] as const,
		{
			enumDescriptions: [
				'',
				nls.localize('editor.autoClosingComments.languageDefined', "使用语言配置来确定何时自动闭合注释。"),
				nls.localize('editor.autoClosingComments.beforeWhitespace', "仅当光标位于空白字符左侧时才自动闭合注释。"),
				'',
			],
			description: nls.localize('autoClosingComments', "控制用户输入注释起始符后，编辑器是否自动补全注释结束符。")
		}
	)),
	autoClosingDelete: register(new EditorStringEnumOption(
		EditorOption.autoClosingDelete, 'autoClosingDelete',
		'auto' as 'always' | 'auto' | 'never',
		['always', 'auto', 'never'] as const,
		{
			enumDescriptions: [
				'',
				nls.localize('editor.autoClosingDelete.auto', "仅当相邻的右引号或右括号是自动插入的时才将其移除。"),
				'',
			],
			description: nls.localize('autoClosingDelete', "控制删除时编辑器是否移除相邻的右引号或右括号。")
		}
	)),
	autoClosingOvertype: register(new EditorStringEnumOption(
		EditorOption.autoClosingOvertype, 'autoClosingOvertype',
		'auto' as 'always' | 'auto' | 'never',
		['always', 'auto', 'never'] as const,
		{
			enumDescriptions: [
				'',
				nls.localize('editor.autoClosingOvertype.auto', "仅当右引号或右括号是自动插入的，打键时才直接跳过它。"),
				'',
			],
			description: nls.localize('autoClosingOvertype', "控制编辑器是否在输入右引号或右括号时直接跳过它们。")
		}
	)),
	autoClosingQuotes: register(new EditorStringEnumOption(
		EditorOption.autoClosingQuotes, 'autoClosingQuotes',
		'languageDefined' as 'always' | 'languageDefined' | 'beforeWhitespace' | 'never',
		['always', 'languageDefined', 'beforeWhitespace', 'never'] as const,
		{
			enumDescriptions: [
				'',
				nls.localize('editor.autoClosingQuotes.languageDefined', "使用语言配置来确定何时自动闭合引号。"),
				nls.localize('editor.autoClosingQuotes.beforeWhitespace', "仅当光标位于空白字符左侧时才自动闭合引号。"),
				'',
			],
			description: nls.localize('autoClosingQuotes', "控制用户输入左引号后，编辑器是否自动补全右引号。")
		}
	)),
	autoIndent: register(new EditorEnumOption(
		EditorOption.autoIndent, 'autoIndent',
		EditorAutoIndentStrategy.Full, 'full',
		['none', 'keep', 'brackets', 'advanced', 'full'],
		_autoIndentFromString,
		{
			enumDescriptions: [
				nls.localize('editor.autoIndent.none', "编辑器不会自动插入缩进。"),
				nls.localize('editor.autoIndent.keep', "编辑器将保持当前行的缩进。"),
				nls.localize('editor.autoIndent.brackets', "编辑器将保持当前行的缩进，并遵循语言定义的括号规则。"),
				nls.localize('editor.autoIndent.advanced', "编辑器将保持当前行的缩进，遵循语言定义的括号规则，并调用语言定义的特殊 onEnterRules。"),
				nls.localize('editor.autoIndent.full', "编辑器将保持当前行的缩进、遵循语言定义的括号、调用语言定义的特殊 onEnterRules，并遵循语言定义的 indentationRules。"),
			],
			description: nls.localize('autoIndent', "控制用户输入、粘贴、移动或缩进行时，编辑器是否自动调整缩进。")
		}
	)),
	autoIndentOnPaste: register(new EditorBooleanOption(
		EditorOption.autoIndentOnPaste, 'autoIndentOnPaste', false,
		{ description: nls.localize('autoIndentOnPaste', "控制编辑器是否自动为粘贴的内容添加缩进。") }
	)),
	autoIndentOnPasteWithinString: register(new EditorBooleanOption(
		EditorOption.autoIndentOnPasteWithinString, 'autoIndentOnPasteWithinString', true,
		{ description: nls.localize('autoIndentOnPasteWithinString', "控制粘贴到字符串内部时编辑器是否自动为粘贴内容添加缩进。在 autoIndentOnPaste 为 true 时生效。") }
	)),
	automaticLayout: register(new EditorBooleanOption(
		EditorOption.automaticLayout, 'automaticLayout', false,
	)),
	autoSurround: register(new EditorStringEnumOption(
		EditorOption.autoSurround, 'autoSurround',
		'languageDefined' as 'languageDefined' | 'quotes' | 'brackets' | 'never',
		['languageDefined', 'quotes', 'brackets', 'never'] as const,
		{
			enumDescriptions: [
				nls.localize('editor.autoSurround.languageDefined', "使用语言配置来确定何时自动为选中内容加上外围符号。"),
				nls.localize('editor.autoSurround.quotes', "加引号，但不加括号。"),
				nls.localize('editor.autoSurround.brackets', "加括号，但不加引号。"),
				''
			],
			description: nls.localize('autoSurround', "控制输入引号或括号时，编辑器是否自动为选中内容加上外围符号。")
		}
	)),
	bracketPairColorization: register(new BracketPairColorization()),
	bracketPairGuides: register(new GuideOptions()),
	stickyTabStops: register(new EditorBooleanOption(
		EditorOption.stickyTabStops, 'stickyTabStops', false,
		{ description: nls.localize('stickyTabStops', "在使用空格缩进时模拟制表符的选择行为。选中区域会吸附到制表位。") }
	)),
	codeLens: register(new EditorBooleanOption(
		EditorOption.codeLens, 'codeLens', true,
		{ description: nls.localize('codeLens', "控制编辑器是否显示 CodeLens。") }
	)),
	codeLensFontFamily: register(new EditorStringOption(
		EditorOption.codeLensFontFamily, 'codeLensFontFamily', '',
		{ description: nls.localize('codeLensFontFamily', "控制 CodeLens 的字体。") }
	)),
	codeLensFontSize: register(new EditorIntOption(EditorOption.codeLensFontSize, 'codeLensFontSize', 0, 0, 100, {
		type: 'number',
		default: 0,
		minimum: 0,
		maximum: 100,
		markdownDescription: nls.localize('codeLensFontSize', "控制 CodeLens 的字号（像素）。设为 0 时使用 `#editor.fontSize#` 的 90%。")
	})),
	colorDecorators: register(new EditorBooleanOption(
		EditorOption.colorDecorators, 'colorDecorators', true,
		{ description: nls.localize('colorDecorators', "控制编辑器是否渲染内联颜色装饰器和颜色选择器。") }
	)),
	colorDecoratorActivatedOn: register(new EditorStringEnumOption(EditorOption.colorDecoratorsActivatedOn, 'colorDecoratorsActivatedOn', 'clickAndHover' as 'clickAndHover' | 'hover' | 'click', ['clickAndHover', 'hover', 'click'] as const, {
		enumDescriptions: [
			nls.localize('editor.colorDecoratorActivatedOn.clickAndHover', "单击和悬停颜色装饰器时都显示颜色选择器"),
			nls.localize('editor.colorDecoratorActivatedOn.hover', "悬停颜色装饰器时显示颜色选择器"),
			nls.localize('editor.colorDecoratorActivatedOn.click', "单击颜色装饰器时显示颜色选择器")
		],
		description: nls.localize('colorDecoratorActivatedOn', "控制从颜色装饰器弹出颜色选择器的条件。")
	})),
	colorDecoratorsLimit: register(new EditorIntOption(
		EditorOption.colorDecoratorsLimit, 'colorDecoratorsLimit', 500, 1, 1000000,
		{
			markdownDescription: nls.localize('colorDecoratorsLimit', "控制一个编辑器中同时最多渲染多少个颜色装饰器。")
		}
	)),
	columnSelection: register(new EditorBooleanOption(
		EditorOption.columnSelection, 'columnSelection', false,
		{ description: nls.localize('columnSelection', "启用后，使用鼠标和按键进行选择时将进行列选择。") }
	)),
	comments: register(new EditorComments()),
	contextmenu: register(new EditorBooleanOption(
		EditorOption.contextmenu, 'contextmenu', true,
	)),
	copyWithSyntaxHighlighting: register(new EditorBooleanOption(
		EditorOption.copyWithSyntaxHighlighting, 'copyWithSyntaxHighlighting', true,
		{ description: nls.localize('copyWithSyntaxHighlighting', "控制复制到剪贴板时是否带上语法高亮。") }
	)),
	cursorBlinking: register(new EditorEnumOption(
		EditorOption.cursorBlinking, 'cursorBlinking',
		TextEditorCursorBlinkingStyle.Blink, 'blink',
		['blink', 'smooth', 'phase', 'expand', 'solid'],
		cursorBlinkingStyleFromString,
		{ description: nls.localize('cursorBlinking', "控制光标动画样式。") }
	)),
	cursorSmoothCaretAnimation: register(new EditorStringEnumOption(
		EditorOption.cursorSmoothCaretAnimation, 'cursorSmoothCaretAnimation',
		'off' as 'off' | 'explicit' | 'on',
		['off', 'explicit', 'on'] as const,
		{
			enumDescriptions: [
				nls.localize('cursorSmoothCaretAnimation.off', "平滑光标动画已禁用。"),
				nls.localize('cursorSmoothCaretAnimation.explicit', "仅当用户通过明确的手势移动光标时，才启用平滑光标动画。"),
				nls.localize('cursorSmoothCaretAnimation.on', "始终启用平滑光标动画。")
			],
			description: nls.localize('cursorSmoothCaretAnimation', "控制是否启用平滑光标动画。")
		}
	)),
	cursorStyle: register(new EditorEnumOption(
		EditorOption.cursorStyle, 'cursorStyle',
		TextEditorCursorStyle.Line, 'line',
		['line', 'block', 'underline', 'line-thin', 'block-outline', 'underline-thin'],
		cursorStyleFromString,
		{ description: nls.localize('cursorStyle', "控制插入输入模式下的光标样式。") }
	)),
	overtypeCursorStyle: register(new EditorEnumOption(
		EditorOption.overtypeCursorStyle, 'overtypeCursorStyle',
		TextEditorCursorStyle.Block, 'block',
		['line', 'block', 'underline', 'line-thin', 'block-outline', 'underline-thin'],
		cursorStyleFromString,
		{ description: nls.localize('overtypeCursorStyle', "控制覆盖输入模式下的光标样式。") }
	)),
	cursorSurroundingLines: register(new EditorIntOption(
		EditorOption.cursorSurroundingLines, 'cursorSurroundingLines',
		0, 0, Constants.MAX_SAFE_SMALL_INTEGER,
		{ description: nls.localize('cursorSurroundingLines', "控制光标周围可见的前置行（最小 0）和后置行（最小 1）的最小数量。在其他一些编辑器中称为 'scrollOff' 或 'scrollOffset'。") }
	)),
	cursorSurroundingLinesStyle: register(new EditorStringEnumOption(
		EditorOption.cursorSurroundingLinesStyle, 'cursorSurroundingLinesStyle',
		'default' as 'default' | 'all',
		['default', 'all'] as const,
		{
			enumDescriptions: [
				nls.localize('cursorSurroundingLinesStyle.default', "`cursorSurroundingLines` 仅在通过键盘或 API 触发时才生效。"),
				nls.localize('cursorSurroundingLinesStyle.all', "`cursorSurroundingLines` 始终生效。")
			],
			markdownDescription: nls.localize('cursorSurroundingLinesStyle', "控制何时应用 `#editor.cursorSurroundingLines#`。")
		}
	)),
	cursorWidth: register(new EditorIntOption(
		EditorOption.cursorWidth, 'cursorWidth',
		0, 0, Constants.MAX_SAFE_SMALL_INTEGER,
		{ markdownDescription: nls.localize('cursorWidth', "当 `#editor.cursorStyle#` 设为 `line` 时，控制光标的宽度。") }
	)),
	cursorHeight: register(new EditorIntOption(
		EditorOption.cursorHeight, 'cursorHeight',
		0, 0, Constants.MAX_SAFE_SMALL_INTEGER,
		{ markdownDescription: nls.localize('cursorHeight', "当 `#editor.cursorStyle#` 设为 `line` 时，控制光标的高度。光标的最大高度取决于行高。") }
	)),
	disableLayerHinting: register(new EditorBooleanOption(
		EditorOption.disableLayerHinting, 'disableLayerHinting', false,
	)),
	disableMonospaceOptimizations: register(new EditorBooleanOption(
		EditorOption.disableMonospaceOptimizations, 'disableMonospaceOptimizations', false
	)),
	domReadOnly: register(new EditorBooleanOption(
		EditorOption.domReadOnly, 'domReadOnly', false,
	)),
	doubleClickSelectsBlock: register(new EditorBooleanOption(
		EditorOption.doubleClickSelectsBlock, 'doubleClickSelectsBlock', true,
		{ description: nls.localize('doubleClickSelectsBlock', "控制双击括号或引号旁边时是否选中其内部内容。") }
	)),
	dragAndDrop: register(new EditorBooleanOption(
		EditorOption.dragAndDrop, 'dragAndDrop', true,
		{ description: nls.localize('dragAndDrop', "控制是否允许通过拖放移动选中的内容。") }
	)),
	emptySelectionClipboard: register(new EditorEmptySelectionClipboard()),
	dropIntoEditor: register(new EditorDropIntoEditor()),
	editContext: register(new EditorBooleanOption(
		EditorOption.editContext, 'editContext', true,
		{
			description: nls.localize('editContext', "设置是否改用 EditContext API（而非文本区域）为编辑器提供输入。"),
			included: platform.isChrome || platform.isEdge || platform.isNative
		}
	)),
	renderRichScreenReaderContent: register(new EditorBooleanOption(
		EditorOption.renderRichScreenReaderContent, 'renderRichScreenReaderContent', false,
		{
			markdownDescription: nls.localize('renderRichScreenReaderContent', "当 `#editor.editContext#` 启用时，是否渲染富文本的屏幕阅读器内容。"),
		}
	)),
	stickyScroll: register(new EditorStickyScroll()),
	experimentalGpuAcceleration: register(new EditorStringEnumOption(
		EditorOption.experimentalGpuAcceleration, 'experimentalGpuAcceleration',
		'off' as 'off' | 'on',
		['off', 'on'] as const,
		{
			tags: ['experimental'],
			enumDescriptions: [
				nls.localize('experimentalGpuAcceleration.off', "使用常规的基于 DOM 的渲染。"),
				nls.localize('experimentalGpuAcceleration.on', "使用 GPU 加速。"),
			],
			description: nls.localize('experimentalGpuAcceleration', "控制是否使用实验性的 GPU 加速来渲染编辑器。")
		}
	)),
	experimentalWhitespaceRendering: register(new EditorStringEnumOption(
		EditorOption.experimentalWhitespaceRendering, 'experimentalWhitespaceRendering',
		'svg' as 'svg' | 'font' | 'off',
		['svg', 'font', 'off'] as const,
		{
			enumDescriptions: [
				nls.localize('experimentalWhitespaceRendering.svg', "使用基于 svg 的新渲染方法。"),
				nls.localize('experimentalWhitespaceRendering.font', "使用基于字体字符的新渲染方法。"),
				nls.localize('experimentalWhitespaceRendering.off', "使用稳定的渲染方法。"),
			],
			description: nls.localize('experimentalWhitespaceRendering', "控制是否用新的实验性方法渲染空白字符。")
		}
	)),
	extraEditorClassName: register(new EditorStringOption(
		EditorOption.extraEditorClassName, 'extraEditorClassName', '',
	)),
	fastScrollSensitivity: register(new EditorFloatOption(
		EditorOption.fastScrollSensitivity, 'fastScrollSensitivity',
		5, x => (x <= 0 ? 5 : x),
		{ markdownDescription: nls.localize('fastScrollSensitivity', "按住 `Alt` 时的滚动速度倍数。") }
	)),
	find: register(new EditorFind()),
	fixedOverflowWidgets: register(new EditorBooleanOption(
		EditorOption.fixedOverflowWidgets, 'fixedOverflowWidgets', false,
	)),
	folding: register(new EditorBooleanOption(
		EditorOption.folding, 'folding', true,
		{ description: nls.localize('folding', "控制是否启用编辑器代码折叠。") }
	)),
	foldingStrategy: register(new EditorStringEnumOption(
		EditorOption.foldingStrategy, 'foldingStrategy',
		'auto' as 'auto' | 'indentation',
		['auto', 'indentation'] as const,
		{
			enumDescriptions: [
				nls.localize('foldingStrategy.auto', "如果有特定语言的折叠策略则使用它，否则使用基于缩进的策略。"),
				nls.localize('foldingStrategy.indentation', "使用基于缩进的折叠策略。"),
			],
			description: nls.localize('foldingStrategy', "控制计算折叠范围的策略。")
		}
	)),
	foldingHighlight: register(new EditorBooleanOption(
		EditorOption.foldingHighlight, 'foldingHighlight', true,
		{ description: nls.localize('foldingHighlight', "控制编辑器是否高亮已折叠的区域。") }
	)),
	foldingImportsByDefault: register(new EditorBooleanOption(
		EditorOption.foldingImportsByDefault, 'foldingImportsByDefault', false,
		{ description: nls.localize('foldingImportsByDefault', "控制编辑器是否自动折叠 import 区域。") }
	)),
	foldingMaximumRegions: register(new EditorIntOption(
		EditorOption.foldingMaximumRegions, 'foldingMaximumRegions',
		5000, 10, 65000, // limit must be less than foldingRanges MAX_FOLDING_REGIONS
		{ description: nls.localize('foldingMaximumRegions', "可折叠区域的最大数量。增大该值可能会在当前源码包含大量可折叠区域时降低编辑器的响应速度。") }
	)),
	unfoldOnClickAfterEndOfLine: register(new EditorBooleanOption(
		EditorOption.unfoldOnClickAfterEndOfLine, 'unfoldOnClickAfterEndOfLine', false,
		{ description: nls.localize('unfoldOnClickAfterEndOfLine', "控制单击折叠行之后的空白内容时是否展开该行。") }
	)),
	fontFamily: register(new EditorStringOption(
		EditorOption.fontFamily, 'fontFamily', EDITOR_FONT_DEFAULTS.fontFamily,
		{ description: nls.localize('fontFamily', "控制字体。") }
	)),
	fontInfo: register(new EditorFontInfo()),
	fontLigatures2: register(new EditorFontLigatures()),
	fontSize: register(new EditorFontSize()),
	fontWeight: register(new EditorFontWeight()),
	fontVariations: register(new EditorFontVariations()),
	formatOnPaste: register(new EditorBooleanOption(
		EditorOption.formatOnPaste, 'formatOnPaste', false,
		{ description: nls.localize('formatOnPaste', "控制编辑器是否自动格式化粘贴的内容。必须存在可用的格式化程序，且该程序能够格式化文档中的某个范围。") }
	)),
	formatOnType: register(new EditorBooleanOption(
		EditorOption.formatOnType, 'formatOnType', false,
		{ description: nls.localize('formatOnType', "控制输入后编辑器是否自动格式化该行。") }
	)),
	fullwidthCharacterWidth: register(new EditorStringEnumOption(
		EditorOption.fullwidthCharacterWidth, 'fullwidthCharacterWidth',
		'font' as 'font' | 'twoCells',
		['font', 'twoCells'] as const,
		{
			enumDescriptions: [
				nls.localize('fullwidthCharacterWidth.font', "使用字体定义的宽度渲染全角字符。"),
				nls.localize('fullwidthCharacterWidth.twoCells', "把全角字符渲染为正好占据两个字符单元格并居中显示。仅对等宽字体生效。不适用于由多个码点组成的全角字符，也不适用于 GPU 渲染。此项会对行渲染产生性能影响。"),
			],
			description: nls.localize('fullwidthCharacterWidth', "控制渲染全角字符时使用的宽度。")
		}
	)),
	glyphMargin: register(new EditorBooleanOption(
		EditorOption.glyphMargin, 'glyphMargin', true,
		{ description: nls.localize('glyphMargin', "控制编辑器是否渲染字形边距。字形边距主要用于调试。") }
	)),
	gotoLocation: register(new EditorGoToLocation()),
	hideCursorInOverviewRuler: register(new EditorBooleanOption(
		EditorOption.hideCursorInOverviewRuler, 'hideCursorInOverviewRuler', false,
		{ description: nls.localize('hideCursorInOverviewRuler', "控制是否在概览标尺中隐藏光标。") }
	)),
	hover: register(new EditorHover()),
	inDiffEditor: register(new EditorBooleanOption(
		EditorOption.inDiffEditor, 'inDiffEditor', false
	)),
	inertialScroll: register(new EditorBooleanOption(
		EditorOption.inertialScroll, 'inertialScroll', false,
		{ description: nls.localize('inertialScroll', "启用惯性滚动 —— 在 Linux 上对触控板尤其有用。") }
	)),
	letterSpacing: register(new EditorFloatOption(
		EditorOption.letterSpacing, 'letterSpacing',
		EDITOR_FONT_DEFAULTS.letterSpacing, x => EditorFloatOption.clamp(x, -5, 20),
		{ description: nls.localize('letterSpacing', "控制字间距（像素）。") }
	)),
	lightbulb: register(new EditorLightbulb()),
	lineDecorationsWidth: register(new EditorLineDecorationsWidth()),
	lineHeight: register(new EditorLineHeight()),
	lineNumbers: register(new EditorRenderLineNumbersOption()),
	lineNumbersMinChars: register(new EditorIntOption(
		EditorOption.lineNumbersMinChars, 'lineNumbersMinChars',
		5, 1, 300
	)),
	linkedEditing: register(new EditorBooleanOption(
		EditorOption.linkedEditing, 'linkedEditing', false,
		{ description: nls.localize('linkedEditing', "控制是否启用编辑器的联动编辑。视语言而定，编辑时会同步更新相关符号（例如 HTML 标签）。") }
	)),
	links: register(new EditorBooleanOption(
		EditorOption.links, 'links', true,
		{ description: nls.localize('links', "控制编辑器是否检测链接并使其可点击。") }
	)),
	matchBrackets: register(new EditorStringEnumOption(
		EditorOption.matchBrackets, 'matchBrackets',
		'always' as 'never' | 'near' | 'always',
		['always', 'near', 'never'] as const,
		{ description: nls.localize('matchBrackets', "高亮匹配的括号。") }
	)),
	minimap: register(new EditorMinimap()),
	mouseStyle: register(new EditorStringEnumOption(
		EditorOption.mouseStyle, 'mouseStyle',
		'text' as 'text' | 'default' | 'copy',
		['text', 'default', 'copy'] as const,
	)),
	mouseWheelScrollSensitivity: register(new EditorFloatOption(
		EditorOption.mouseWheelScrollSensitivity, 'mouseWheelScrollSensitivity',
		1, x => (x === 0 ? 1 : x),
		{ markdownDescription: nls.localize('mouseWheelScrollSensitivity', "应用于鼠标滚轮滚动事件 `deltaX` 和 `deltaY` 的倍数。") }
	)),
	mouseWheelZoom: register(new EditorBooleanOption(
		EditorOption.mouseWheelZoom, 'mouseWheelZoom', false,
		{
			markdownDescription: platform.isMacintosh
				? nls.localize('mouseWheelZoom.mac', "使用鼠标滚轮并按住 `Cmd` 时缩放编辑器字体。")
				: nls.localize('mouseWheelZoom', "使用鼠标滚轮并按住 `Ctrl` 时缩放编辑器字体。")
		}
	)),
	multiCursorMergeOverlapping: register(new EditorBooleanOption(
		EditorOption.multiCursorMergeOverlapping, 'multiCursorMergeOverlapping', true,
		{ description: nls.localize('multiCursorMergeOverlapping', "当多个光标重叠时将它们合并。") }
	)),
	multiCursorModifier: register(new EditorEnumOption(
		EditorOption.multiCursorModifier, 'multiCursorModifier',
		'altKey', 'alt',
		['ctrlCmd', 'alt'],
		_multiCursorModifierFromString,
		{
			markdownEnumDescriptions: [
				nls.localize('multiCursorModifier.ctrlCmd', "在 Windows 和 Linux 上映射为 `Control`，在 macOS 上映射为 `Command`。"),
				nls.localize('multiCursorModifier.alt', "在 Windows 和 Linux 上映射为 `Alt`，在 macOS 上映射为 `Option`。")
			],
			markdownDescription: nls.localize({
				key: 'multiCursorModifier',
				comment: [
					'- `ctrlCmd` refers to a value the setting can take and should not be localized.',
					'- `Control` and `Command` refer to the modifier keys Ctrl or Cmd on the keyboard and can be localized.'
				]
			}, "用来通过鼠标添加多个光标的修饰键。跳转到定义和打开链接的鼠标操作会相应调整，以免与`多光标修饰键`冲突。")
		}
	)),
	mouseMiddleClickAction: register(new EditorStringEnumOption(
		EditorOption.mouseMiddleClickAction, 'mouseMiddleClickAction', 'default' as MouseMiddleClickAction,
		['default', 'openLink', 'ctrlLeftClick'] as MouseMiddleClickAction[],
		{ description: nls.localize('mouseMiddleClickAction', "控制在编辑器中点击鼠标中键时会发生什么。") }
	)),
	multiCursorPaste: register(new EditorStringEnumOption(
		EditorOption.multiCursorPaste, 'multiCursorPaste',
		'spread' as 'spread' | 'full',
		['spread', 'full'] as const,
		{
			markdownEnumDescriptions: [
				nls.localize('multiCursorPaste.spread', "每个光标粘贴文本中的一行。"),
				nls.localize('multiCursorPaste.full', "每个光标粘贴完整文本。")
			],
			markdownDescription: nls.localize('multiCursorPaste', "控制当粘贴文本的行数与光标数量一致时的粘贴行为。")
		}
	)),
	multiCursorLimit: register(new EditorIntOption(
		EditorOption.multiCursorLimit, 'multiCursorLimit', 10000, 1, 100000,
		{
			markdownDescription: nls.localize('multiCursorLimit', "控制活动编辑器中同时最多可存在多少个光标。")
		}
	)),
	occurrencesHighlight: register(new EditorStringEnumOption(
		EditorOption.occurrencesHighlight, 'occurrencesHighlight',
		'singleFile' as 'off' | 'singleFile' | 'multiFile',
		['off', 'singleFile', 'multiFile'] as const,
		{
			markdownEnumDescriptions: [
				nls.localize('occurrencesHighlight.off', "不高亮出现处。"),
				nls.localize('occurrencesHighlight.singleFile', "仅在当前文件中高亮出现处。"),
				nls.localize('occurrencesHighlight.multiFile', "实验性功能：在所有有效的已打开文件中高亮出现处。")
			],
			markdownDescription: nls.localize('occurrencesHighlight', "控制是否在已打开的文件之间高亮所有出现处。")
		}
	)),
	occurrencesHighlightDelay: register(new EditorIntOption(
		EditorOption.occurrencesHighlightDelay, 'occurrencesHighlightDelay',
		0, 0, 2000,
		{
			description: nls.localize('occurrencesHighlightDelay', "控制高亮出现处之前的延迟（毫秒）。"),
			tags: ['preview']
		}
	)),
	overtypeOnPaste: register(new EditorBooleanOption(
		EditorOption.overtypeOnPaste, 'overtypeOnPaste', true,
		{ description: nls.localize('overtypeOnPaste', "控制粘贴时是否覆盖。") }
	)),
	overviewRulerBorder: register(new EditorBooleanOption(
		EditorOption.overviewRulerBorder, 'overviewRulerBorder', true,
		{ description: nls.localize('overviewRulerBorder', "控制是否在概览标尺周围绘制边框。") }
	)),
	overviewRulerLanes: register(new EditorIntOption(
		EditorOption.overviewRulerLanes, 'overviewRulerLanes',
		3, 0, 3
	)),
	padding: register(new EditorPadding()),
	pasteAs: register(new EditorPasteAs()),
	parameterHints: register(new EditorParameterHints()),
	peekWidgetDefaultFocus: register(new EditorStringEnumOption(
		EditorOption.peekWidgetDefaultFocus, 'peekWidgetDefaultFocus',
		'tree' as 'tree' | 'editor',
		['tree', 'editor'] as const,
		{
			enumDescriptions: [
				nls.localize('peekWidgetDefaultFocus.tree', "打开速览视图时聚焦到树"),
				nls.localize('peekWidgetDefaultFocus.editor', "打开速览视图时聚焦到编辑器")
			],
			description: nls.localize('peekWidgetDefaultFocus', "控制速览小部件中聚焦到内联编辑器还是树。")
		}
	)),
	placeholder: register(new PlaceholderOption()),
	definitionLinkOpensInPeek: register(new EditorBooleanOption(
		EditorOption.definitionLinkOpensInPeek, 'definitionLinkOpensInPeek', false,
		{ description: nls.localize('definitionLinkOpensInPeek', "控制「转到定义」的鼠标操作是否总是打开速览小部件。") }
	)),
	quickSuggestions: register(new EditorQuickSuggestions()),
	quickSuggestionsDelay: register(new EditorIntOption(
		EditorOption.quickSuggestionsDelay, 'quickSuggestionsDelay',
		10, 0, Constants.MAX_SAFE_SMALL_INTEGER,
		{
			description: nls.localize('quickSuggestionsDelay', "控制显示快速建议前的延迟（毫秒）。"),
			experiment: {
				mode: 'auto'
			}
		}
	)),
	readOnly: register(new EditorBooleanOption(
		EditorOption.readOnly, 'readOnly', false,
	)),
	readOnlyMessage: register(new ReadonlyMessage()),
	renameOnType: register(new EditorBooleanOption(
		EditorOption.renameOnType, 'renameOnType', false,
		{ description: nls.localize('renameOnType', "控制编辑器是否在输入时自动重命名。"), markdownDeprecationMessage: nls.localize('renameOnTypeDeprecate', "已弃用，请改用 `#editor.linkedEditing#`。") }
	)),
	renderControlCharacters: register(new EditorBooleanOption(
		EditorOption.renderControlCharacters, 'renderControlCharacters', true,
		{ description: nls.localize('renderControlCharacters', "控制编辑器是否渲染控制字符。"), restricted: true }
	)),
	renderFinalNewline: register(new EditorStringEnumOption(
		EditorOption.renderFinalNewline, 'renderFinalNewline',
		(platform.isLinux ? 'dimmed' : 'on') as 'off' | 'on' | 'dimmed',
		['off', 'on', 'dimmed'] as const,
		{ description: nls.localize('renderFinalNewline', "当文件以换行符结尾时，仍渲染最后一行的行号。") }
	)),
	renderLineHighlight: register(new EditorStringEnumOption(
		EditorOption.renderLineHighlight, 'renderLineHighlight',
		'line' as 'none' | 'gutter' | 'line' | 'all',
		['none', 'gutter', 'line', 'all'] as const,
		{
			enumDescriptions: [
				'',
				'',
				'',
				nls.localize('renderLineHighlight.all', "同时高亮装订线和当前行。"),
			],
			description: nls.localize('renderLineHighlight', "控制编辑器如何渲染当前行高亮。")
		}
	)),
	renderLineHighlightOnlyWhenFocus: register(new EditorBooleanOption(
		EditorOption.renderLineHighlightOnlyWhenFocus, 'renderLineHighlightOnlyWhenFocus', false,
		{ description: nls.localize('renderLineHighlightOnlyWhenFocus', "控制是否仅在编辑器获得焦点时才渲染当前行高亮。") }
	)),
	renderValidationDecorations: register(new EditorStringEnumOption(
		EditorOption.renderValidationDecorations, 'renderValidationDecorations',
		'editable' as 'editable' | 'on' | 'off',
		['editable', 'on', 'off'] as const
	)),
	renderWhitespace: register(new EditorStringEnumOption(
		EditorOption.renderWhitespace, 'renderWhitespace',
		'selection' as 'selection' | 'none' | 'boundary' | 'trailing' | 'all',
		['none', 'boundary', 'selection', 'trailing', 'all'] as const,
		{
			enumDescriptions: [
				'',
				nls.localize('renderWhitespace.boundary', "渲染空白字符，但词与词之间的单个空格除外。"),
				nls.localize('renderWhitespace.selection', "仅在选中的文本上渲染空白字符。"),
				nls.localize('renderWhitespace.trailing', "仅渲染行尾的空白字符。"),
				''
			],
			description: nls.localize('renderWhitespace', "控制编辑器如何渲染空白字符。")
		}
	)),
	revealHorizontalRightPadding: register(new EditorIntOption(
		EditorOption.revealHorizontalRightPadding, 'revealHorizontalRightPadding',
		15, 0, 1000,
	)),
	roundedSelection: register(new EditorBooleanOption(
		EditorOption.roundedSelection, 'roundedSelection', true,
		{ description: nls.localize('roundedSelection', "控制选中区域是否使用圆角。") }
	)),
	rulers: register(new EditorRulers()),
	scrollbar: register(new EditorScrollbar()),
	scrollBeyondLastColumn: register(new EditorIntOption(
		EditorOption.scrollBeyondLastColumn, 'scrollBeyondLastColumn',
		4, 0, Constants.MAX_SAFE_SMALL_INTEGER,
		{ description: nls.localize('scrollBeyondLastColumn', "控制超出多少个字符后编辑器开始水平滚动。") }
	)),
	scrollBeyondLastLine: register(new EditorBooleanOption(
		EditorOption.scrollBeyondLastLine, 'scrollBeyondLastLine', true,
		{ description: nls.localize('scrollBeyondLastLine', "控制编辑器是否可以滚动到最后一行之后。") }
	)),
	scrollOnMiddleClick: register(new EditorBooleanOption(
		EditorOption.scrollOnMiddleClick, 'scrollOnMiddleClick', false,
		{ description: nls.localize('scrollOnMiddleClick', "控制按下鼠标中键时编辑器是否滚动。") }
	)),
	scrollPredominantAxis: register(new EditorBooleanOption(
		EditorOption.scrollPredominantAxis, 'scrollPredominantAxis', true,
		{ description: nls.localize('scrollPredominantAxis', "同时垂直和水平滚动时，仅沿主要轴滚动。可防止在触控板上垂直滚动时发生水平漂移。") }
	)),
	selectionClipboard: register(new EditorBooleanOption(
		EditorOption.selectionClipboard, 'selectionClipboard', true,
		{
			description: nls.localize('selectionClipboard', "控制是否支持 Linux 的主剪贴板。"),
			included: platform.isLinux
		}
	)),
	selectionHighlight: register(new EditorBooleanOption(
		EditorOption.selectionHighlight, 'selectionHighlight', true,
		{ description: nls.localize('selectionHighlight', "控制编辑器是否高亮与选中内容相似的匹配项。") }
	)),
	selectionHighlightMaxLength: register(new EditorIntOption(
		EditorOption.selectionHighlightMaxLength, 'selectionHighlightMaxLength',
		200, 0, Constants.MAX_SAFE_SMALL_INTEGER,
		{ description: nls.localize('selectionHighlightMaxLength', "控制选中内容超过多少个字符后不再高亮相似匹配。设为 0 表示不限制。") }
	)),
	selectionHighlightMultiline: register(new EditorBooleanOption(
		EditorOption.selectionHighlightMultiline, 'selectionHighlightMultiline', false,
		{ description: nls.localize('selectionHighlightMultiline', "控制编辑器是否高亮跨多行的选中匹配项。") }
	)),
	selectedTextMatchMode: register(new EditorStringEnumOption(
		EditorOption.selectedTextMatchMode, 'selectedTextMatchMode',
		'findOptions' as 'findOptions' | 'caseSensitive' | 'caseInsensitive',
		['findOptions', 'caseSensitive', 'caseInsensitive'] as const,
		{
			enumDescriptions: [
				nls.localize('selectedTextMatchMode.findOptions', "使用查找小部件的「区分大小写」和「全字匹配」设置。"),
				nls.localize('selectedTextMatchMode.caseSensitive', "区分大小写地匹配出现处，且独立于查找小部件的设置。"),
				nls.localize('selectedTextMatchMode.caseInsensitive', "不区分大小写地匹配出现处，且独立于查找小部件的设置。"),
			],
			markdownDescription: nls.localize('selectedTextMatchMode', "控制在选择下一个、上一个或全部匹配项以及高亮选中项时，如何匹配所选文本的出现位置。caseSensitive 与 caseInsensitive 独立于查找小工具来匹配子串。空选中项总是从区分大小写的整词搜索开始。")
		}
	)),
	selectOnLineNumbers: register(new EditorBooleanOption(
		EditorOption.selectOnLineNumbers, 'selectOnLineNumbers', true,
	)),
	showFoldingControls: register(new EditorStringEnumOption(
		EditorOption.showFoldingControls, 'showFoldingControls',
		'mouseover' as 'always' | 'never' | 'mouseover',
		['always', 'never', 'mouseover'] as const,
		{
			enumDescriptions: [
				nls.localize('showFoldingControls.always', "始终显示折叠控件。"),
				nls.localize('showFoldingControls.never', "从不显示折叠控件，并缩小装订线宽度。"),
				nls.localize('showFoldingControls.mouseover', "仅当鼠标位于装订线上时显示折叠控件。"),
			],
			description: nls.localize('showFoldingControls', "控制装订线上的折叠控件何时显示。")
		}
	)),
	showUnused: register(new EditorBooleanOption(
		EditorOption.showUnused, 'showUnused', true,
		{ description: nls.localize('showUnused', "控制未使用代码的淡出效果。") }
	)),
	showDeprecated: register(new EditorBooleanOption(
		EditorOption.showDeprecated, 'showDeprecated', true,
		{ description: nls.localize('showDeprecated', "控制是否为已弃用的变量添加删除线。") }
	)),
	inlayHints: register(new EditorInlayHints()),
	snippetSuggestions: register(new EditorStringEnumOption(
		EditorOption.snippetSuggestions, 'snippetSuggestions',
		'inline' as 'top' | 'bottom' | 'inline' | 'none',
		['top', 'bottom', 'inline', 'none'] as const,
		{
			enumDescriptions: [
				nls.localize('snippetSuggestions.top', "把代码片段建议显示在其他建议之上。"),
				nls.localize('snippetSuggestions.bottom', "把代码片段建议显示在其他建议之下。"),
				nls.localize('snippetSuggestions.inline', "把代码片段建议与其他建议一起显示。"),
				nls.localize('snippetSuggestions.none', "不显示代码片段建议。"),
			],
			description: nls.localize('snippetSuggestions', "控制代码片段是否与其他建议一起显示，以及如何排序。")
		}
	)),
	smartSelect: register(new SmartSelect()),
	smoothScrolling: register(new EditorBooleanOption(
		EditorOption.smoothScrolling, 'smoothScrolling', false,
		{ description: nls.localize('smoothScrolling', "控制编辑器滚动时是否使用动画。") }
	)),
	stopRenderingLineAfter: register(new EditorIntOption(
		EditorOption.stopRenderingLineAfter, 'stopRenderingLineAfter',
		10000, -1, Constants.MAX_SAFE_SMALL_INTEGER,
	)),
	suggest: register(new EditorSuggest()),
	inlineSuggest: register(new InlineEditorSuggest()),
	inlineCompletionsAccessibilityVerbose: register(new EditorBooleanOption(EditorOption.inlineCompletionsAccessibilityVerbose, 'inlineCompletionsAccessibilityVerbose', false,
		{ description: nls.localize('inlineCompletionsAccessibilityVerbose', "控制显示内联补全时是否向屏幕阅读器用户提供无障碍提示。") })),
	suggestFontSize: register(new EditorIntOption(
		EditorOption.suggestFontSize, 'suggestFontSize',
		0, 0, 1000,
		{ markdownDescription: nls.localize('suggestFontSize', "建议控件的字号。设为 {0} 时使用 {1} 的值。", '`0`', '`#editor.fontSize#`') }
	)),
	suggestLineHeight: register(new EditorIntOption(
		EditorOption.suggestLineHeight, 'suggestLineHeight',
		0, 0, 1000,
		{ markdownDescription: nls.localize('suggestLineHeight', "建议控件的行高。设为 {0} 时使用 {1} 的值。最小值为 8。", '`0`', '`#editor.lineHeight#`') }
	)),
	suggestOnTriggerCharacters: register(new EditorBooleanOption(
		EditorOption.suggestOnTriggerCharacters, 'suggestOnTriggerCharacters', true,
		{ description: nls.localize('suggestOnTriggerCharacters', "控制输入触发字符时建议是否自动弹出。") }
	)),
	suggestSelection: register(new EditorStringEnumOption(
		EditorOption.suggestSelection, 'suggestSelection',
		'first' as 'first' | 'recentlyUsed' | 'recentlyUsedByPrefix',
		['first', 'recentlyUsed', 'recentlyUsedByPrefix'] as const,
		{
			markdownEnumDescriptions: [
				nls.localize('suggestSelection.first', "总是选中第一条建议。"),
				nls.localize('suggestSelection.recentlyUsed', "优先选中最近用过的建议，除非继续输入选中了别的建议。例如 `console.| -> console.log`，因为最近补全过 `log`。"),
				nls.localize('suggestSelection.recentlyUsedByPrefix', "根据此前补全过这些建议的前缀来选择建议，例如 `co -> console`、`con -> const`。"),
			],
			description: nls.localize('suggestSelection', "控制显示建议列表时如何预选建议。")
		}
	)),
	tabCompletion: register(new EditorStringEnumOption(
		EditorOption.tabCompletion, 'tabCompletion',
		'off' as 'on' | 'off' | 'onlySnippets',
		['on', 'off', 'onlySnippets'] as const,
		{
			enumDescriptions: [
				nls.localize('tabCompletion.on', "Tab 补全：按 Tab 键时插入匹配度最高的建议。"),
				nls.localize('tabCompletion.off', "禁用 Tab 补全。"),
				nls.localize('tabCompletion.onlySnippets', "当前缀匹配时用 Tab 补全代码片段。在未启用 'quickSuggestions' 时效果最佳。"),
			],
			description: nls.localize('tabCompletion', "启用 Tab 补全。")
		}
	)),
	tabIndex: register(new EditorIntOption(
		EditorOption.tabIndex, 'tabIndex',
		0, -1, Constants.MAX_SAFE_SMALL_INTEGER
	)),
	trimWhitespaceOnDelete: register(new EditorBooleanOption(
		EditorOption.trimWhitespaceOnDelete, 'trimWhitespaceOnDelete', false,
		{ description: nls.localize('trimWhitespaceOnDelete', "控制删除换行符时，编辑器是否也删除下一行的缩进空白。") }
	)),
	unicodeHighlight: register(new UnicodeHighlight()),
	unusualLineTerminators: register(new EditorStringEnumOption(
		EditorOption.unusualLineTerminators, 'unusualLineTerminators',
		'prompt' as 'auto' | 'off' | 'prompt',
		['auto', 'off', 'prompt'] as const,
		{
			enumDescriptions: [
				nls.localize('unusualLineTerminators.auto', "自动移除异常的行尾符。"),
				nls.localize('unusualLineTerminators.off', "忽略异常的行尾符。"),
				nls.localize('unusualLineTerminators.prompt', "提示是否移除异常的行尾符。"),
			],
			description: nls.localize('unusualLineTerminators', "移除可能引发问题的异常行尾符。")
		}
	)),
	useShadowDOM: register(new EditorBooleanOption(
		EditorOption.useShadowDOM, 'useShadowDOM', true
	)),
	useTabStops: register(new EditorBooleanOption(
		EditorOption.useTabStops, 'useTabStops', true,
		{ description: nls.localize('useTabStops', "空格和制表符的插入与删除会与制表位对齐。") }
	)),
	wordBreak: register(new EditorStringEnumOption(
		EditorOption.wordBreak, 'wordBreak',
		'normal' as 'normal' | 'keepAll',
		['normal', 'keepAll'] as const,
		{
			markdownEnumDescriptions: [
				nls.localize('wordBreak.normal', "使用默认的换行规则。"),
				nls.localize('wordBreak.keepAll', "中日韩（CJK）文本不使用断词规则。非 CJK 文本的行为与正常情况相同。"),
			],
			description: nls.localize('wordBreak', "控制中日韩（CJK）文本使用的断词规则。")
		}
	)),
	wordSegmenterLocales: register(new WordSegmenterLocales()),
	wordSeparators: register(new EditorStringOption(
		EditorOption.wordSeparators, 'wordSeparators', USUAL_WORD_SEPARATORS,
		{ description: nls.localize('wordSeparators', "执行与单词相关的导航或操作时，用作单词分隔符的字符。") }
	)),
	wordWrap: register(new EditorStringEnumOption(
		EditorOption.wordWrap, 'wordWrap',
		'off' as 'off' | 'on' | 'wordWrapColumn' | 'bounded',
		['off', 'on', 'wordWrapColumn', 'bounded'] as const,
		{
			markdownEnumDescriptions: [
				nls.localize('wordWrap.off', "永不换行。"),
				nls.localize('wordWrap.on', "按视口宽度换行。"),
				nls.localize({
					key: 'wordWrap.wordWrapColumn',
					comment: [
						'- `editor.wordWrapColumn` refers to a different setting and should not be localized.'
					]
				}, "将在 `#editor.wordWrapColumn#` 处换行。"),
				nls.localize({
					key: 'wordWrap.bounded',
					comment: [
						'- viewport means the edge of the visible window size.',
						'- `editor.wordWrapColumn` refers to a different setting and should not be localized.'
					]
				}, "将在视口与 `#editor.wordWrapColumn#` 两者中较小的位置换行。"),
			],
			description: nls.localize({
				key: 'wordWrap',
				comment: [
					'- \'off\', \'on\', \'wordWrapColumn\' and \'bounded\' refer to values the setting can take and should not be localized.',
					'- `editor.wordWrapColumn` refers to a different setting and should not be localized.'
				]
			}, "控制行的换行方式。")
		}
	)),
	wordWrapIndicator: register(new EditorBooleanOption(
		EditorOption.wordWrapIndicator, 'wordWrapIndicator', false,
		{
			markdownDescription: nls.localize({
				key: 'wordWrapIndicator',
				comment: []
			}, "控制是否在换行处的换行列渲染指示标记。仅在启用 `#editor.wordWrap#` 时生效。")
		}
	)),
	wordWrapBreakAfterCharacters: register(new EditorStringOption(
		EditorOption.wordWrapBreakAfterCharacters, 'wordWrapBreakAfterCharacters',
		// allow-any-unicode-next-line
		' \t})]?|/&.,;¢°′″‰℃、。｡､￠，．：；？！％・･ゝゞヽヾーァィゥェォッャュョヮヵヶぁぃぅぇぉっゃゅょゎゕゖㇰㇱㇲㇳㇴㇵㇶㇷㇸㇹㇺㇻㇼㇽㇾㇿ々〻ｧｨｩｪｫｬｭｮｯｰ”〉》」』】〕）］｝｣',
	)),
	wordWrapBreakBeforeCharacters: register(new EditorStringOption(
		EditorOption.wordWrapBreakBeforeCharacters, 'wordWrapBreakBeforeCharacters',
		// allow-any-unicode-next-line
		'([{‘“〈《「『【〔（［｛｢£¥＄￡￥+＋'
	)),
	wordWrapColumn: register(new EditorIntOption(
		EditorOption.wordWrapColumn, 'wordWrapColumn',
		80, 1, Constants.MAX_SAFE_SMALL_INTEGER,
		{
			markdownDescription: nls.localize({
				key: 'wordWrapColumn',
				comment: [
					'- `editor.wordWrap` refers to a different setting and should not be localized.',
					'- \'wordWrapColumn\' and \'bounded\' refer to values the different setting can take and should not be localized.'
				]
			}, "当 `#editor.wordWrap#` 为 `wordWrapColumn` 或 `bounded` 时，控制编辑器的换行列。")
		}
	)),
	wordWrapOverride1: register(new EditorStringEnumOption(
		EditorOption.wordWrapOverride1, 'wordWrapOverride1',
		'inherit' as 'off' | 'on' | 'inherit',
		['off', 'on', 'inherit'] as const
	)),
	wordWrapOverride2: register(new EditorStringEnumOption(
		EditorOption.wordWrapOverride2, 'wordWrapOverride2',
		'inherit' as 'off' | 'on' | 'inherit',
		['off', 'on', 'inherit'] as const
	)),
	wrapOnEscapedLineFeeds: register(new EditorBooleanOption(
		EditorOption.wrapOnEscapedLineFeeds, 'wrapOnEscapedLineFeeds', false,
		{ markdownDescription: nls.localize('wrapOnEscapedLineFeeds', "控制启用自动换行时，字面形式的换行标记是否触发换行。\n\n例如：\n```c\nchar* str=\"hello\\nworld\"\n```\n会显示为\n```c\nchar* str=\"hello\\n\n           world\"\n```。") }
	)),

	// Leave these at the end (because they have dependencies!)
	effectiveCursorStyle: register(new EffectiveCursorStyle()),
	editorClassName: register(new EditorClassName()),
	defaultColorDecorators: register(new EditorStringEnumOption(
		EditorOption.defaultColorDecorators, 'defaultColorDecorators', 'auto' as 'auto' | 'always' | 'never',
		['auto', 'always', 'never'] as const,
		{
			enumDescriptions: [
				nls.localize('editor.defaultColorDecorators.auto', "仅当没有扩展提供颜色装饰器时，才显示默认颜色装饰器。"),
				nls.localize('editor.defaultColorDecorators.always', "始终显示默认颜色装饰器。"),
				nls.localize('editor.defaultColorDecorators.never', "从不显示默认颜色装饰器。"),
			],
			description: nls.localize('defaultColorDecorators', "控制是否使用默认的文档颜色提供程序显示内联颜色装饰。")
		}
	)),
	pixelRatio: register(new EditorPixelRatio()),
	tabFocusMode: register(new EditorBooleanOption(EditorOption.tabFocusMode, 'tabFocusMode', false,
		{ markdownDescription: nls.localize('tabFocusMode', "控制 Tab 键由编辑器处理，还是交给工作台用于导航。") }
	)),
	layoutInfo: register(new EditorLayoutInfoComputer()),
	wrappingInfo: register(new EditorWrappingInfoComputer()),
	wrappingIndent: register(new WrappingIndentOption()),
	wrappingStrategy: register(new WrappingStrategy()),
	effectiveEditContextEnabled: register(new EffectiveEditContextEnabled()),
	effectiveAllowVariableFonts: register(new EffectiveAllowVariableFonts()),
	effectiveFullwidthCharacterWidth: register(new EffectiveFullwidthCharacterWidth())
};

type EditorOptionsType = typeof EditorOptions;
type FindEditorOptionsKeyById<T extends EditorOption> = { [K in keyof EditorOptionsType]: EditorOptionsType[K]['id'] extends T ? K : never }[keyof EditorOptionsType];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComputedEditorOptionValue<T extends IEditorOption<any, any>> = T extends IEditorOption<any, infer R> ? R : never;
export type FindComputedEditorOptionValueById<T extends EditorOption> = NonNullable<ComputedEditorOptionValue<EditorOptionsType[FindEditorOptionsKeyById<T>]>>;

export type MouseMiddleClickAction = 'default' | 'openLink' | 'ctrlLeftClick';
