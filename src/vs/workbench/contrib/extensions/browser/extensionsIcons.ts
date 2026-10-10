/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { localize } from '../../../../nls.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';

export const extensionsViewIcon = registerIcon('extensions-view-icon', Codicon.extensions, localize('extensionsViewIcon', "查看扩展视图的图标。"));

export const manageExtensionIcon = registerIcon('extensions-manage', Codicon.gear, localize('manageExtensionIcon', "扩展视图中“管理”操作的图标。"));

export const clearSearchResultsIcon = registerIcon('extensions-clear-search-results', Codicon.clearAll, localize('clearSearchResultsIcon', "扩展视图中“清除搜索结果”操作的图标。"));
export const refreshIcon = registerIcon('extensions-refresh', Codicon.refresh, localize('refreshIcon', "扩展视图中“刷新”操作的图标。"));
export const filterIcon = registerIcon('extensions-filter', Codicon.filter, localize('filterIcon', "扩展视图中“筛选器”操作的图标。"));

export const installLocalInRemoteIcon = registerIcon('extensions-install-local-in-remote', Codicon.cloudDownload, localize('installLocalInRemoteIcon', "扩展视图中“在远程安装本地扩展”操作的图标。"));
export const installWorkspaceRecommendedIcon = registerIcon('extensions-install-workspace-recommended', Codicon.cloudDownload, localize('installWorkspaceRecommendedIcon', "扩展视图中“安装工作区建议的扩展”操作的图标。"));
export const configureRecommendedIcon = registerIcon('extensions-configure-recommended', Codicon.pencil, localize('configureRecommendedIcon', "扩展视图中“配置建议的扩展”操作的图标。"));

export const syncEnabledIcon = registerIcon('extensions-sync-enabled', Codicon.sync, localize('syncEnabledIcon', "用于指示扩展已同步的图标。"));
export const syncIgnoredIcon = registerIcon('extensions-sync-ignored', Codicon.syncIgnored, localize('syncIgnoredIcon', "用于指示在同步时忽略扩展的图标。"));
export const remoteIcon = registerIcon('extensions-remote', Codicon.remote, localize('remoteIcon', "用于在扩展视图和编辑器中指示扩展是远程内容的图标。"));
export const installCountIcon = registerIcon('extensions-install-count', Codicon.cloudDownload, localize('installCountIcon', "扩展视图和编辑器中随安装计数一起显示的图标。"));
export const privateExtensionIcon = registerIcon('extensions-private', Codicon.lock, localize('lockIcon', "为扩展视图和编辑器中的专用扩展显示的图标。"));
export const ratingIcon = registerIcon('extensions-rating', Codicon.star, localize('ratingIcon', "扩展视图和编辑器中随评级一起显示的图标。"));
export const preReleaseIcon = registerIcon('extensions-pre-release', Codicon.versions, localize('preReleaseIcon', "为具有预发布版本的扩展在扩展视图和编辑器中显示的图标。"));
export const sponsorIcon = registerIcon('extensions-sponsor', Codicon.heartFilled, localize('sponsorIcon', "用于在扩展视图和编辑器中赞助扩展的图标。"));

export const starFullIcon = registerIcon('extensions-star-full', Codicon.starFull, localize('starFullIcon', "扩展编辑器中用于评级的实心星形图标。"));
export const starHalfIcon = registerIcon('extensions-star-half', Codicon.starHalf, localize('starHalfIcon', "扩展编辑器中用于评级的半星图标。"));
export const starEmptyIcon = registerIcon('extensions-star-empty', Codicon.starEmpty, localize('starEmptyIcon', "扩展编辑器中用于评级的中空星形图标。"));

export const errorIcon = registerIcon('extensions-error-message', Codicon.error, localize('errorIcon', "在扩展编辑器中显示带有错误消息的图标。"));
export const warningIcon = registerIcon('extensions-warning-message', Codicon.warning, localize('warningIcon', "扩展编辑器中随警告消息一同显示的图标。"));
export const infoIcon = registerIcon('extensions-info-message', Codicon.info, localize('infoIcon', "扩展编辑器中随信息消息一同显示的图标。"));

export const trustIcon = registerIcon('extension-workspace-trust', Codicon.shield, localize('trustIcon', "扩展编辑器中随工作区信任消息一同显示的图标。"));
export const activationTimeIcon = registerIcon('extension-activation-time', Codicon.history, localize('activationtimeIcon', "在扩展编辑器中显示带有激活时间消息的图标。"));
export const restartRequiredIcon = registerIcon('extension-restart-required', Codicon.refresh, localize('restartRequiredIcon', "扩展视图中，当扩展需要重启时显示的图标。"));
