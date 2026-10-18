/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { IConfigurationPropertySchema } from '../../../../platform/configuration/common/configurationRegistry.js';
import product from '../../../../platform/product/common/product.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions, IConfigurationMigrationRegistry } from '../../../common/configuration.js';
import { ChatConfiguration, ChatProgressAnimation, ChatProgressVerbosity } from '../common/constants.js';

export const chatProgressConfigurationProperties = {
	[ChatConfiguration.PersistentProgress]: {
		type: 'string',
		default: product.quality === 'insider' ? ChatProgressAnimation.Draw : ChatProgressAnimation.Off,
		enum: Object.values(ChatProgressAnimation),
		enumItemLabels: [
			localize('chat.progressAnimation.off.label', "关"),
			localize('chat.progressAnimation.draw.label', "绘制"),
			localize('chat.progressAnimation.drawMonochrome.label', "绘制（单色）"),
			localize('chat.progressAnimation.drawMonochromeNoIcon.label', "绘制（单色，无图标）"),
		],
		enumDescriptions: [
			localize('chat.progressAnimation.off', "保持原来的思考、工具与运行进度渲染，不加常驻指示条，也不显示 Olympia 图标。"),
			localize('chat.progressAnimation.draw', "依次沿右侧斜带、右边缘、左侧斜带画出进度，再按同样的逆时针方向和步数擦掉。"),
			localize('chat.progressAnimation.drawMonochrome', "用「绘制」这套动画，但配色按 Olympia 图标的灰度处理。高对比度主题仍走自己的对比色。"),
			localize('chat.progressAnimation.drawMonochromeNoIcon', "常驻进度文字和工具渲染跟「绘制（单色）」一样，只是把 Olympia 图标藏掉。"),
		],
		markdownDescription: localize('chat.experimental.persistentProgress', "在回答结束前，底部保留一条工作进度指示：可以是彩色或单色的绘制动画，也可以不要图标。默认值按发布渠道定：Insiders 用「绘制」，Stable 用「关」；实验可能覆盖这两种默认，手动设过的那一项优先。工具调用是否展开跟随 {0}；推理部分会拆成可折叠的预览，这会打断工具链。独立的工具仍保留自己的图标。已经完成的回答继续跟随 {1}。这一项取代原来的内部工作进度；终端活动的动画和富子任务的药丸标签不受影响。改动立即生效；开了「减少动效」时指示条仍然显示，只是不做动画。", `\`#${ChatConfiguration.PersistentProgressVerbosity}#\``, `\`#${ChatConfiguration.CollapseCompletedResponses}#\``),
		tags: ['experimental'],
		experiment: { mode: 'auto' },
	},
	[ChatConfiguration.PersistentProgressVerbosity]: {
		type: 'string',
		default: ChatProgressVerbosity.Compact,
		enum: Object.values(ChatProgressVerbosity),
		enumItemLabels: [
			localize('chat.progressVerbosity.verbose.label', "详细"),
			localize('chat.progressVerbosity.compact.label', "紧凑"),
		],
		enumDescriptions: [
			localize('chat.progressVerbosity.verbose', "工具调用一直保持展开，串成没有标题行的一列，也不设内部滚动高度。"),
			localize('chat.progressVerbosity.compact', "运行时先预览工具调用；正文继续往下或回答结束时，把每一组收成一行可展开的摘要。"),
		],
		markdownDescription: localize('chat.experimental.persistentProgressVerbosity', "在 {0} 启用时，控制工具调用显示多少细节。默认是「紧凑」：思考或正文重新开始、或者回答结束时，就地收起工具分组。要细看就展开那条摘要。常驻进度选「关」时这一项不起作用。改动立即生效。", `\`#${ChatConfiguration.PersistentProgress}#\``),
		tags: ['experimental'],
		experiment: { mode: 'auto' },
	},
} satisfies Record<string, IConfigurationPropertySchema>;

Registry.as<IConfigurationMigrationRegistry>(Extensions.ConfigurationMigration).registerConfigurationMigrations([{
	key: ChatConfiguration.PersistentProgress,
	migrateFn: value => ['weave', 'orbit', 'accordion', 'dial'].includes(value) ? { value: ChatProgressAnimation.Draw } : [],
}, {
	key: ChatConfiguration.PersistentProgressVerbosity,
	migrateFn: value => value === 'notVerbose' ? { value: ChatProgressVerbosity.Compact } : [],
}]);
