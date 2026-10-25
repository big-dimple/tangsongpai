# 策划文档入口

唐宋牌是一款唐宋历史人物题材的扑克构筑 H5 游戏。项目简介、运行方式和当前功能见根目录 [README](../README.md)。

## 现行设计

- [产品目标与核心循环](production/PRODUCT.md)
- [出牌、计分、角色、关卡和经济规则](production/RULES.md)
- [唐宋牌、消耗品、长期道具与 Boss 内容](production/CONTENT.md)
- [六英雄决策与表现设计](production/CHARACTER_PLAY_PLAN.md)
- [扑克奇遇规则与实现边界](production/POKER_POLYCHROME_ENCOUNTER_IMPLEMENTATION.md)
- [桌面、触控、信息层级与反馈](production/UX.md)
- [美术方向与素材约束](production/ART.md)

完整分类见[策划与工程文档索引](production/INDEX.md)，当前方向和待办分别见 [ROADMAP](../ROADMAP.md) 与 [TODO](../TODO.md)。

## 使用约定

- 具体实现以 `main` 代码为准；文档中的初始参数不等于已经完成平衡验证。
- 修改规则或内容前，同时核对相关类型、目录数据、存档版本和测试，不只修改策划文本。
- 日期化交接、旧 PR 描述、`docs/archive/` 和历史工作包只用于追溯，不作为当前功能或任务依据。
- 工程检查、真人审美、听感、实体设备和自然对局平衡分别验收，不相互替代。
