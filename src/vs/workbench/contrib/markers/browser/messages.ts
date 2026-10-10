/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from '../../../../nls.js';
import { basename } from '../../../../base/common/resources.js';
import { MarkerSeverity, IRelatedInformation } from '../../../../platform/markers/common/markers.js';
import { ILocalizedString } from '../../../../platform/action/common/action.js';
import { Marker } from './markersModel.js';

export default class Messages {

	public static MARKERS_PANEL_TOGGLE_LABEL: string = nls.localize('problems.view.toggle.label', "切换问题（错误、警告、提示信息）");
	public static MARKERS_PANEL_SHOW_LABEL = nls.localize2('problems.view.focus.label', "聚焦到问题（错误、警告、提示信息）");

	public static PROBLEMS_PANEL_CONFIGURATION_TITLE: string = nls.localize('problems.panel.configuration.title', "问题视图");
	public static PROBLEMS_PANEL_CONFIGURATION_AUTO_REVEAL: string = nls.localize('problems.panel.configuration.autoreveal', "控制问题视图在打开文件时是否自动展开定位到该文件。");
	public static PROBLEMS_PANEL_CONFIGURATION_VIEW_MODE: string = nls.localize('problems.panel.configuration.viewMode', "控制问题视图的默认视图模式。");
	public static PROBLEMS_PANEL_CONFIGURATION_SHOW_CURRENT_STATUS: string = nls.localize('problems.panel.configuration.showCurrentInStatus', "启用后在状态栏中显示当前问题。");
	public static PROBLEMS_PANEL_CONFIGURATION_COMPARE_ORDER: string = nls.localize('problems.panel.configuration.compareOrder', "控制问题的导航顺序。");
	public static PROBLEMS_PANEL_CONFIGURATION_COMPARE_ORDER_SEVERITY: string = nls.localize('problems.panel.configuration.compareOrder.severity', "按严重程度顺序浏览问题");
	public static PROBLEMS_PANEL_CONFIGURATION_COMPARE_ORDER_POSITION: string = nls.localize('problems.panel.configuration.compareOrder.position', "按位置顺序浏览问题");

	public static MARKERS_PANEL_TITLE_PROBLEMS: ILocalizedString = nls.localize2('markers.panel.title.problems', "问题");

	public static MARKERS_PANEL_NO_PROBLEMS_BUILT: string = nls.localize('markers.panel.no.problems.build', "工作区中未检测到问题。");
	public static MARKERS_PANEL_NO_PROBLEMS_ACTIVE_FILE_BUILT: string = nls.localize('markers.panel.no.problems.activeFile.build', "当前文件中未检测到任何问题。");
	public static MARKERS_PANEL_NO_PROBLEMS_FILTERS: string = nls.localize('markers.panel.no.problems.filters', "按提供的筛选条件未找到结果。");

	public static MARKERS_PANEL_ACTION_TOOLTIP_MORE_FILTERS: string = nls.localize('markers.panel.action.moreFilters', "更多筛选条件...");
	public static MARKERS_PANEL_FILTER_LABEL_SHOW_ERRORS: string = nls.localize('markers.panel.filter.showErrors', "显示错误");
	public static MARKERS_PANEL_FILTER_LABEL_SHOW_WARNINGS: string = nls.localize('markers.panel.filter.showWarnings', "显示警告");
	public static MARKERS_PANEL_FILTER_LABEL_SHOW_INFOS: string = nls.localize('markers.panel.filter.showInfos', "显示提示信息");
	public static MARKERS_PANEL_FILTER_LABEL_EXCLUDED_FILES: string = nls.localize('markers.panel.filter.useFilesExclude', "隐藏已排除的文件");
	public static MARKERS_PANEL_FILTER_LABEL_ACTIVE_FILE: string = nls.localize('markers.panel.filter.activeFile', "仅显示活动文件");
	public static MARKERS_PANEL_ACTION_TOOLTIP_FILTER: string = nls.localize('markers.panel.action.filter', "筛选问题");
	public static MARKERS_PANEL_ACTION_TOOLTIP_QUICKFIX: string = nls.localize('markers.panel.action.quickfix', "显示修复方案");
	public static MARKERS_PANEL_FILTER_ARIA_LABEL: string = nls.localize('markers.panel.filter.ariaLabel', "筛选问题");
	public static MARKERS_PANEL_FILTER_PLACEHOLDER: string = nls.localize('markers.panel.filter.placeholder', "筛选条件（例如 text、**/*.ts、!**/node_modules/**、@source:ts）");
	public static MARKERS_PANEL_FILTER_ERRORS: string = nls.localize('markers.panel.filter.errors', "错误");
	public static MARKERS_PANEL_FILTER_WARNINGS: string = nls.localize('markers.panel.filter.warnings', "警告");
	public static MARKERS_PANEL_FILTER_INFOS: string = nls.localize('markers.panel.filter.infos', "提示信息");

	public static MARKERS_PANEL_SINGLE_ERROR_LABEL: string = nls.localize('markers.panel.single.error.label', "1 个错误");
	public static readonly MARKERS_PANEL_MULTIPLE_ERRORS_LABEL = (noOfErrors: number): string => { return nls.localize('markers.panel.multiple.errors.label', "{0} 个错误", '' + noOfErrors); };
	public static MARKERS_PANEL_SINGLE_WARNING_LABEL: string = nls.localize('markers.panel.single.warning.label', "1 条警告");
	public static readonly MARKERS_PANEL_MULTIPLE_WARNINGS_LABEL = (noOfWarnings: number): string => { return nls.localize('markers.panel.multiple.warnings.label', "{0} 条警告", '' + noOfWarnings); };
	public static MARKERS_PANEL_SINGLE_INFO_LABEL: string = nls.localize('markers.panel.single.info.label', "1 条信息");
	public static readonly MARKERS_PANEL_MULTIPLE_INFOS_LABEL = (noOfInfos: number): string => { return nls.localize('markers.panel.multiple.infos.label', "{0} 条信息", '' + noOfInfos); };
	public static MARKERS_PANEL_SINGLE_UNKNOWN_LABEL: string = nls.localize('markers.panel.single.unknown.label', "1 个未知");
	public static readonly MARKERS_PANEL_MULTIPLE_UNKNOWNS_LABEL = (noOfUnknowns: number): string => { return nls.localize('markers.panel.multiple.unknowns.label', "{0} 个未知", '' + noOfUnknowns); };

	public static readonly MARKERS_PANEL_AT_LINE_COL_NUMBER = (ln: number, col: number): string => { return nls.localize('markers.panel.at.ln.col.number', "[第 {0} 行，第 {1} 列]", '' + ln, '' + col); };

	public static readonly MARKERS_TREE_ARIA_LABEL_RESOURCE = (noOfProblems: number, fileName: string, folder: string): string => { return nls.localize('problems.tree.aria.label.resource', "在文件夹 {2} 的文件 {1} 中有 {0} 个问题", noOfProblems, fileName, folder); };
	public static readonly MARKERS_TREE_ARIA_LABEL_MARKER = (marker: Marker): string => {
		const relatedInformationMessage = marker.relatedInformation.length ? nls.localize('problems.tree.aria.label.marker.relatedInformation', " 此问题包含对 {0} 个位置的引用。", marker.relatedInformation.length) : '';
		switch (marker.marker.severity) {
			case MarkerSeverity.Error:
				return marker.marker.source ? nls.localize('problems.tree.aria.label.error.marker', "错误: 行 {1} 和字符 {2} 处的 {0}。{4} 生成的 {3}", marker.marker.message, marker.marker.startLineNumber, marker.marker.startColumn, relatedInformationMessage, marker.marker.source)
					: nls.localize('problems.tree.aria.label.error.marker.nosource', "错误: {1} 行 {2} 列，{0}。{3}", marker.marker.message, marker.marker.startLineNumber, marker.marker.startColumn, relatedInformationMessage);
			case MarkerSeverity.Warning:
				return marker.marker.source ? nls.localize('problems.tree.aria.label.warning.marker', "警告: 行 {1} 和字符 {2} 处的 {0}。{4} 生成的 {3}", marker.marker.message, marker.marker.startLineNumber, marker.marker.startColumn, relatedInformationMessage, marker.marker.source)
					: nls.localize('problems.tree.aria.label.warning.marker.nosource', "警告: {1} 行 {2} 列，{0}。{3}", marker.marker.message, marker.marker.startLineNumber, marker.marker.startColumn, relatedInformationMessage, relatedInformationMessage);

			case MarkerSeverity.Info:
				return marker.marker.source ? nls.localize('problems.tree.aria.label.info.marker', "信息: 行 {1} 和字符 {2} 处的 {0}。{4} 生成的 {3}", marker.marker.message, marker.marker.startLineNumber, marker.marker.startColumn, relatedInformationMessage, marker.marker.source)
					: nls.localize('problems.tree.aria.label.info.marker.nosource', "信息: {1} 行 {2} 列，{0}。{3}", marker.marker.message, marker.marker.startLineNumber, marker.marker.startColumn, relatedInformationMessage);
			default:
				return marker.marker.source ? nls.localize('problems.tree.aria.label.marker', "问题: 行 {1} 和字符 {2} 处的 {0}。{4} 生成的 {3}", marker.marker.source, marker.marker.message, marker.marker.startLineNumber, marker.marker.startColumn, relatedInformationMessage, marker.marker.source)
					: nls.localize('problems.tree.aria.label.marker.nosource', "问题: {1} 行 {2} 列，{0}。{3}", marker.marker.message, marker.marker.startLineNumber, marker.marker.startColumn, relatedInformationMessage);
		}
	};
	public static readonly MARKERS_TREE_ARIA_LABEL_RELATED_INFORMATION = (relatedInformation: IRelatedInformation): string => nls.localize('problems.tree.aria.label.relatedinfo.message', "{3} 的 {1} 行 {2} 列，{0}", relatedInformation.message, relatedInformation.startLineNumber, relatedInformation.startColumn, basename(relatedInformation.resource));
	public static SHOW_ERRORS_WARNINGS_ACTION_LABEL: string = nls.localize('errors.warnings.show.label', "显示错误和警告");
}
