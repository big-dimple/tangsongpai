# 策划与执行目录

**仓库维护交接：** [Dot 分支清理执行单](DOT_BRANCH_CLEANUP_RUNBOOK_20261022.md) · [分支审计及已关闭 PR](REPOSITORY_HYGIENE_20261022.md) · [可执行脚本](../../scripts/branch_prune.py)。这条维护线与奇遇产品开发分开，不由旧 Q1–Q4 触发。

> **2026-10-22 最新工作范围：仅奇遇。** 首版草案见 [PR #226](https://github.com/big-dimple/tangsongpai/pull/226)（尚未合 main、未交付游戏功能），独立研究见 [PR #225](https://github.com/big-dimple/tangsongpai/pull/225)（draft，非规则授权）。旧 Q1–Q4 与 plan.json 中 P08 指针是历史状态，不再自动派工。本轮 [分支/PR清理审查](REPOSITORY_HYGIENE_20261022.md) 与产品奇遇工作隔离。

## 当前阅读入口

[AGENTS](../../AGENTS.md) → [DELIVERY_PLAN当前统一执行计划](DELIVERY_PLAN.md#当前统一执行计划) → [plan.json](plan.json)中的currentTask/currentItem。只有这一条队列；README、ROADMAP、TODO和handoff均为路标，不另排任务。

|文档|唯一职责|
|---|---|
|DELIVERY_PLAN|Q1–Q4玩家结果、先后依赖、有限验收/完成条件和插队机制|
|plan.json|正式32包与Q项状态、当前指针、用户最新决定、外部输入和基线|
|[扑克奇遇阶段1b](POKER_POLYCHROME_ENCOUNTER_IMPLEMENTATION.md)|用户后续明确批准的7–9真实关／18金候选：规则／保存／静态入口交付，后续Astra只读视觉接口；独立PR未合，不恢复其他旧任务|
|[CHARACTER_PLAY_PLAN](CHARACTER_PLAY_PLAN.md)|当前六英雄规则/资格/成本/次数与真实取舍，不另设队列|
|[ART](ART.md) / [美术交接](HERO_ART_HANDOFF_20261015.md)|现有三男三女与已交资源、呈现约束；不凭旧稿重画|
|[UX](UX.md) / [ENGINEERING](ENGINEERING.md)|输入/信息/生命周期与规则保存边界|
|[文本规范](HERO_TEXT_SPEC_20261015.md)|按版本的角色文案；JSON为运行时身份映射，不在本轮修改|
|[WORK_PACKAGES](WORK_PACKAGES.md)|32个正式包合同，P08指回现行队列；旧M命名不作当前排程|
|[QUALITY](QUALITY.md)|工程、用户体验、设备和正式门的证据边界|
|[需求归属](REQUIREMENTS_DECISIONS_COMMITMENTS.md)|将需求映射到Q项/暂停项，不再次复制进度与下一动作|

只读当前Q项需要的合同和原始证据；不要把105份专题、96份P08历史evidence或整份旧台账设为默认必读。

## 历史与证据

清理前完整[总计划](history/planning-before-20261020/DELIVERY_PLAN.md)、[机器台账](history/planning-before-20261020/plan.json)、[交接](history/planning-before-20261020/development-handoff.md)、[旧工作包](history/planning-before-20261020/WORK_PACKAGES.md)、[UX](history/planning-before-20261020/UX.md)、[角色计划](history/planning-before-20261020/CHARACTER_PLAY_PLAN.md)、[旧美术任务书](history/planning-before-20261020/HERO_ART_HANDOFF_20261015.md)和[需求回执](history/planning-before-20261020/REQUIREMENTS_DECISIONS_COMMITMENTS.md)保留原日期/SHA/FAIL；相对链接固定到清理前提交，避免归档搬家造成错链。

其余*_SCOPE、原型、审查、旧START卡是专题/历史合同，只有被当前Q项明确引用时才使用，旧“当前/授权/待开发”不自动生效。原[DECISIONS](DECISIONS.md)、[CONTENT](CONTENT.md)、[RULES](RULES.md)按版本解释，不据旧草案重设计现行规则。

原证据全部保留，本轮不删除文件、分支或PR。工程PASS不能代签审美/好玩/目标设备；来源探针/受控前置/自然过程分别标，缺失输入不伪造。未来按产品批保一个精简索引和必要前后过程，引用既有材料，不堆重复回执。
