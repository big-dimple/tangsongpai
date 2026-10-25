# 策划与工程文档索引

先阅读根目录 [README](../../README.md) 和 [AGENTS](../../AGENTS.md)，再按修改范围选择文档。现行规则与代码相互印证；日期化交接、旧计划和 PR 状态只用于历史追溯。

## 产品与规则

| 文档 | 内容 |
| --- | --- |
| [PRODUCT](PRODUCT.md) | 产品目标、范围与核心循环 |
| [RULES](RULES.md) | 出牌、计分、角色、关卡、经济与模式规则 |
| [CONTENT](CONTENT.md) | 唐宋牌、消耗品、长期道具、Boss 与内容定义 |
| [CHARACTER_PLAY_PLAN](CHARACTER_PLAY_PLAN.md) | 六英雄的能力、决策与表现设计 |
| [POKER_POLYCHROME_ENCOUNTER_IMPLEMENTATION](POKER_POLYCHROME_ENCOUNTER_IMPLEMENTATION.md) | 扑克奇遇规则、实现与保存边界 |

## 体验与工程

| 文档 | 内容 |
| --- | --- |
| [UX](UX.md) | 桌面与触控交互、信息层级和反馈 |
| [ART](ART.md) | 美术方向、素材与呈现约束 |
| [ENGINEERING](ENGINEERING.md) | 架构、命令、存档、随机、演出和部署约定 |
| [QUALITY](QUALITY.md) | 工程检查、实机验证与验收证据边界 |
| [HERO_TEXT_SPEC_20261015](HERO_TEXT_SPEC_20261015.md) | 英雄文案规范；结合当前实现使用 |
| [TANGSONG_ENTRANCE_HANDOFF_20261024](TANGSONG_ENTRANCE_HANDOFF_20261024.md) | 入场演出的实现位置、已知风险和验证建议 |

## 当前状态入口

- [产品路线](../../ROADMAP.md)：当前产品基线和后续方向。
- [当前待办](../../TODO.md)：尚未完成的实机、体验与平衡验证。

`plan.json`、`DELIVERY_PLAN.md` 和 `WORK_PACKAGES.md` 保留历史工作包及阶段证据，不再作为当前自动派工入口。

## 历史资料

- [归档目录](../archive/)：旧策划、阶段快照和历史材料。
- [2026-10-20 前计划快照](history/planning-before-20261020/DELIVERY_PLAN.md)：旧交付计划的固定历史记录。
- [分支与 PR 审查记录](REPOSITORY_HYGIENE_20261022.md)：一次仓库维护工作的历史证据，不是长期待办。

引用历史文档时保留其日期和当时结论，不把其中的“当前”“待开发”“未合并”直接套用到现在的 `main`。
