# AGENTS · 项目知识库

这是给开发者和 LLM 的唯一项目 wiki。先读这里，再按任务查 [ENGINEERING](ENGINEERING.md)、[TODO](TODO.md) 和相关源码。不要从历史 PR、日期化交接或旧计划推断当前状态。

## 1. 项目是什么

唐宋牌是唐宋历史人物题材的扑克构筑 H5 游戏。玩家组成扑克牌型，通过热度与倍率得分，并用唐宋牌、工具、长期道具、增强和版次形成构筑。

核心循环：选择英雄与模式 → 出牌／弃牌达成场次目标 → 商店调整构筑 → 完成八章 → 自愿进入无尽。标准局每章有暖场、正场和 Boss 压轴场。

已实现的主要系统：

- 六位英雄及其主动、被动和演出。
- 72 个唐宋牌定义、39 种工具、12 种长期道具。
- 牌组改造、牌型升级、增强、版次、商店、节目单与 Boss。
- D0–D3 难度、12 个固定挑战、三步教程和无尽模式。
- 扑克奇遇、本地保存恢复、键盘触控、桌面与移动布局。
- 音效、音乐、震动、跳过和减少动态。

这些是实现范围，不代表数值平衡、所有设备或真人体验已经验收。

## 2. 英雄与内部 ID

显示名和技术 ID 分离。不要为了改名而重写存档键、规则 ID 或内容哈希。

| 英雄 | 内部 ID | 玩法关键词 |
| --- | --- | --- |
| 苏轼 | `amo` | 贬谪：每场一次，在合适时机舍弃余牌换取关键一手爆发 |
| 秦琼 | `touye` | 弃牌换牌、选择牌型押注，围绕明确目标争取收益 |
| 辛弃疾 | `laohuan` | 换牌时锁定并揭示候选，由玩家选择保留 |
| 刘娥 | `erxiang` | 将关键牌的普通点数转化为倍率，统筹成组牌型 |
| 文成公主 | `azao` | 不同牌型接续蓄势，再选择时机释放 |
| 花蕊夫人 | `xiemu` | 将金币转化为关键一手的倍率，也可留钱经营利息 |

英雄显示与文案入口：`src/game/HeroIdentity.ts`、`src/game/HeroText.ts`。历史内部别名只用于代码兼容，不是玩家显示名。

## 3. 代码导航

| 要查什么 | 优先位置 |
| --- | --- |
| 游戏启动与场景 | `src/main.ts`、`src/game/*Scene.ts` |
| 领域命令入口 | `src/domain/run.ts` |
| 对局与商店 | `src/domain/r2Run.ts`、`src/domain/r2Shop.ts` |
| 计分 | `src/domain/scoreR2.ts`、`src/scoring/` |
| 章节与 Boss | `src/domain/r2Chapter.ts` |
| 模式、难度、挑战、节目单 | `src/content/r2Modes.ts` |
| 工具、道具、增强与版次 | `src/content/r2Tools.ts` |
| 唐宋牌内容 | `src/content/r2-*.json`、`src/domain/r2PublishedContent.*` |
| 存档与恢复 | `src/application/checkpoint.ts`、`src/application/SavedRun.ts` |
| 英雄身份与文案 | `src/game/HeroIdentity.ts`、`src/game/HeroText.ts` |
| 扑克奇遇 | `src/domain/qiyuEvent.ts`、`src/game/QiyuAnimationPresentation.ts` |
| 音频与震动 | `src/audio/`、`src/haptics/` |
| 测试 | `tests/`、`harness/`、`package.json` |

## 4. 修改规则

1. 一次只解决一个明确问题，不顺手重构无关模块，不覆盖有效协作修改。
2. 先读实际调用链和测试，再改代码；策划文字不能覆盖真实实现。
3. 规则变更必须同时考虑命令校验、计分顺序、RNG、存档身份、恢复和重复提交。
4. 显示文本与持久化身份分开；不做全仓名称替换，不让界面文案重写定义或旧存档。
5. 新内容必须具有真实实现和获取路径，不把候选参数、测试角色或未完成能力发布给玩家。
6. 保持规则与表现分离；动画、声音和布局不能决定分数、消耗或奖励。
7. 测试夹具是代码输入。清理文档时保留被源码、测试、harness 或素材工具引用的数据。
8. 按影响范围运行检查，并如实说明未运行项；不删断言、不改规则或放宽超时来制造通过。

详细工程约束和命令见 [ENGINEERING](ENGINEERING.md)。

## 5. 当前工作与文档纪律

- 当前工作只看 [TODO](TODO.md)，完成后删除条目。
- 规则、架构、测试或发布变化直接更新 [ENGINEERING](ENGINEERING.md)。
- 项目知识或代码入口变化直接更新本文件。
- 不新增 ROADMAP、plan.json、DELIVERY_PLAN、WORK_PACKAGES、INDEX、GDD、SCOPE、handoff、review 或证据 README。
- 不为每次提交写回执；Git 历史已经记录变更，CI 记录检查结果。
- 不把仓库文档当成永久授权；分支、提交、推送、合并和删除操作以当前任务为准。
