# 当前开发交接

> **2026-10-22 更新：当前唯一产品开发主题为「奇遇」。** 首版合同在 [PR #226](https://github.com/big-dimple/tangsongpai/pull/226)，尚未实现或合并；旧 Q1–Q4 本批回执以下保留为历史。仓库整理见 [分支/PR审查](production/REPOSITORY_HYGIENE_20261022.md)，不代表删除远程分支或自动部署。

接手从[AGENTS](../AGENTS.md)进入；唯一派工为[DELIVERY_PLAN当前队列](production/DELIVERY_PLAN.md#当前统一执行计划)，状态为[plan.json](production/plan.json)。本页不再叠加候选回执或“最新下一步”。

本批开发输入main `3909cc6437e230ff4c8919994c862f5976f9c4de`，[push CI](https://github.com/big-dimple/tangsongpai/actions/runs/39438504009)成功，仍不代签体验。苏轼一次真实倍率飘字已独立提交 `944411f0`，做牌工具展开/大字号前置独立提交 `23663fb3`，候选[PR196](https://github.com/big-dimple/tangsongpai/pull/196)。

保留用户认可的牌飞行与冲击；以《炉石传说》的演出节奏/反馈结构为参考，沿唐宋牌现有素材实现“蓄力→加速冲击→命中顿挫→数字爆发并清晰落定”。这组具体实现要素是落实方向，不冒称用户逐项指定；不搬用其素材。苏轼旧烟雾不恢复，K需有合格触发反馈和一次真实整手倍率；其余五人（含刘娥耳朵声波）保留现有效果基线，具体遮挡按证据修正，不整套推翻。此前助手提出的“目标牌永留牌区/撤飞牌/整体撤耳/越简洁越好”已被用户新指示覆盖，不作为批准。

当前Q1六英雄完整决策与表现；后续Q2成长经营、Q3核心交互/移动、Q4整屏手绘音画。每项在总计划定义玩家结果、依赖、有限验收和下一动作。外部审美/设备待定不封锁独立工程，也不被工程绿冒充验收。

规则事实、已交素材、输入合同分别读[角色玩法](production/CHARACTER_PLAY_PLAN.md)、[ART](production/ART.md)、[UX](production/UX.md)。六英雄及共同系统已有代码，不据旧“未实现/未合main/下一项”重复开发。Git/产品权限只按本会话，不从历史文件扩权；本轮不删除分支、关闭PR或操作试玩站。

旧交接完整保留于[清理前快照](production/history/planning-before-20261020/development-handoff.md)，原SHA/失败不改。只在当前批确有产品/输入/结论变化时更新一个交接点，不为每次CI或参数回执再写一份报告。
