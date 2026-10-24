# B03 全副同色救场：实施前兼容审查

当前范围更新：**用户明确“不需要接上我这局，我新开就是”**，已撤回旧局迁移工作；救场仅接入新开的独立规则身份。旧身份/旧档原规则继续和导出，不自动迁移、不补快照。下文保留实施前审查原文作为历史证据，旧“待迁移决定/停止实现”状态已失效。当前交付见 [B03 救场验证](evidence/b03-rescue-2026-10-22/README.md)。

历史状态：实现前阻点回报；当时仅文档，尚未实现。

## 已核输入

- 2026-10-22 `git fetch origin main`：远端基线为 `635d7ec56f26b418689ab0fcbe472a67d924489b`，PR222 已合。
- 独立分支：`feat/b03-emergency-rescue-20261022`。开工工作区干净；仓库根 `AGENTS.md`、现行计划入口已读；仓库和 `/workspace/.agents` 未发现 `.agents/skills`。
- 本会话新增的用户批准合同优先于仓库上批已结束的执行队列。不启动 Astra、不操作 B2 候选、不合其他分支、不推 main、不查部署。
- 用户已明确全副改为红桃。单张截图不包含完整存档、身份、整副入场快照或历史命令，无法据此判断真实旧局是否具备迁移证据。

## 最小产品状态、命令与保存方案

建议名称：**应急解封**。只针对 B03。

1. 新的救场规则身份在 `EnterStage` 时记录非空存活整副牌的 `id/suit` 快照、入场命令 ID/序号、Boss 禁用花色；资格为 B03 且快照中每张牌都等于禁用花色。只记录资格所需事实，不复制点数、增强、版次。混色、空组、仅手牌同色、非 B03 均无资格。战中删牌、染色、复制都不重算资格。
2. 场内救场状态只需 `unbought | pending | used`，以及购买收据、成功使用对应的出牌收据；无退款、无第二额度。结束保留收据供校验，下一场重建。仅有该救场规则身份的状态可携带这些字段。
3. 单一 `BuyBossSuitRescue` 命令。UI 确认前无领域修改；命令检查当前序号、可操作阶段、仍有出牌机会、入场资格、未买和至少 5 金，再在一个候选事务内扣 5 金并设 `pending`。不占消耗品格；存款优惠不参与固定 5 金。
4. `pending` 允许正常弃牌准备；合法正常出牌成功提交后变 `used`。非法选择、取消和预览不消耗。双击由已有 saving 锁、序号和收据挡住；保存失败保留旧已发布状态，重试落盘同一个候选，不重新扣款或重新计分。原有不能操作的锁定状态仍尊重；购买本身不新增限制。
5. 增加窄的 B03 豁免事实，贯通有效失效牌列表、分数预览、正式计分和 trace。Boss 身份仍为 B03，原花色/点数/增强/版次不变，红桃条件照常判断。不能通过将通用 `boss` 设为 null 关闭所有 Boss。豁免事实绑定购买与这一手收据，冷恢复和历史结算读同一个事实。
6. 不改既有计分/成长/玻璃/版次/角色时点；本手结算完成恢复封禁。尤其覆盖通关当手的 held gold、成长等既有阶段，不能在中途切换失效集合。场内 UI 固定展示未买（5 金、钱不足原因）／待下次出牌／已用；待用牌面清楚显示本手解封并移除失效链，减少动态仍有文字和静态标记。PC 横版、手机竖版共用窄组件，不改理牌/选角/苏轼/iPad 窗口。

可复用 `SavedRun.submit/performPersist/retry` 和 `IndexedDbSave.commit` 的先保存后发布机制。无需为普通购买另造保存队列。但现有 checkpoint 校验必须识别新规则身份、购买命令、快照、配额、trace 和对应日志事实，不能只改后台分数。

## 旧活动局的具体阻点

| 事实 | 源码边界 | 影响 |
| --- | --- | --- |
| 入场只洗当前存活整副并分区，没有持久化整副入场花色快照 | `r2Run.ts: entryStage / EnterStage` | 当前手牌、当前存活整副都不能证明战中编辑前的资格。 |
| 只保留最近 256 条命令 | `checkpoint.ts: MAX_JOURNAL / makeCheckpoint` | 旧局可能已丢失开局、染色或入场所需重放内容；收据 fingerprint 不能逆推出被丢弃的命令。 |
| 旧字段及开局身份严格校验 | `checkpoint.ts: validateState / action / readCheckpoint`、`r2RouteStarter.ts: routeStarterStartCommand` | 填新字段会被拒绝；换成新身份还会使开局收据不符。不能重写旧 hash 或原收据冒充兼容。 |
| 分区与备份含内容 hash，跨身份备份不会直接保留为 previous | `IndexedDbSave.ts: readPartition / commit`、`checkpoint.ts: restoreSlots` | 迁移必须显式保留原分区并原子发布新分区，不能把普通 import 当成已完成的安全迁移。 |
| trace 校验从原 Boss 重新计算失效牌和 active scoring | `checkpoint.ts: trace`、`GameScene.ts: bossPressureContext / refreshSelection` | 只给 scorer 传空 disabledIds 会与恢复校验、牌面封禁表现矛盾。 |

**结论：当前代码不能无迁移地安全救所有已有活动 B03 局。** 不能因此默默只上新局。当前未获得用户真实导出存档，不能断言该局日志完整、资格已证明或一定能迁移。

## 建议父任务决定的迁移边界

建议先讨论“可证明历史才升级”，并明确它只能覆盖部分旧局：

1. 原 checkpoint 按旧身份完整读取校验，原文和原分区保留。只对明确支持的当前发布身份开放升级，不给所有旧身份自动换规则。
2. 第一版资格证明候选只接受 `journalBaseSeq === 1`、可还原规范开局命令且完整旧规则重放到当前 `stateHash` 完全相同的局。从真实 `EnterStage` 处提取当时整副存活牌快照；任意缺命令、重放失败、hash 不同、没有 B03 入场均拒绝升级。仅凭“入场命令还在最近日志中”仍不够，因为缺少可重放的入场前状态。
3. 新增显式救场规则身份及迁移记录，记录来源旧身份、来源 checkpoint digest、原开局收据及提取的入场事实；保留旧收据不重写。新校验器分开验证迁移来源和升级后的命令；现行角色及 a11 规则沿原身份委托，不能统一换成某个新角色规则。
4. 需要新增原子迁移保存入口：按同一 revision/写租约确认来源仍是当前局，写新分区和迁移证据，再切 meta；原分区原样保留。保存失败继续原档、不扣款、不消耗救场；成功后购买仍走上述真实购买事务。恢复后的规则版本必须可识别，不能伪装为原版本。
5. 日志已截断的旧局：不靠手牌或当前整副倒推，不做猜测升级、不抹档。要覆盖这类局，需要用户另定资格/补偿合同或提供另一份能证明入场的历史 checkpoint；当前合同不能凭空补齐历史。

这是**尚未实施、尚未证明可用**的迁移设计；必须先由父任务收口范围。它涉及新的身份继承、开局收据验证与跨分区迁移，超过一个场内按钮的独立窄改动。若不接受这种迁移边界，需先解决旧活动局合同，再决定新局入口；本分支不擅自选成“只支持新局”。

## 预计文件／方法边界（产品代码均未修改）

| 文件 | 拟改边界及用途 | 并发协调 |
| --- | --- | --- |
| 新 `src/domain/r2BossSuitRescue.ts` | 常量合同、入场快照、资格、状态、有效失效牌函数 | Boss 独占模块 |
| `src/domain/r2Run.ts` | `R2StageState / R2_RULESETS / assertR2Invariants / entryStage / refreshDisabled / r2ScoreContext / transactR2` 中购买和出牌成功节点 | 与 B2 共用；只能局部增补，父统一整合 |
| `src/domain/run.ts` | `Action` 单一购买命令 | 与 B2 共用联合类型 |
| `src/domain/r2GroupUpgrade.ts`、`r2ContentProfiles.ts` | 新救场身份的基身份委托；保留原 identity/hash 行为 | 与 B2 的身份继承可能冲突，迁移决定后再定具体接法 |
| `src/domain/scoreR2.ts` | 窄豁免输入和 trace 字段；保留原事件时点 | 不重写原计分 |
| `src/application/checkpoint.ts` | `action / validateState / trace / readCheckpoint` 校验新身份、快照、配额、豁免证据 | 与 B2 高冲突；禁止整段替换 |
| `src/application/SavedRun.ts`、`src/platform/IndexedDbSave.ts`、`src/game/session.ts` | 普通购买复用原队列；只有迁移方案获定后才新增显式迁移接口 | 迁移所需共享面，当前完全未改 |
| 新 `src/game/BossSuitRescue.ts` 及窄样式 | 固定发现入口、确认、三态文案、失败/保存提示 | 不借用或替换其他弹窗内容 |
| `src/game/GameScene.ts` | `render / bossPressureContext / refreshSelection / previewSelection / updateControls` 等必要挂点 | 与 B2 共用；局部调用新模块 |
| `src/game/BossPressure.ts`、`SavedBossImpact.ts` | 当前及历史牌面读同一豁免事实 | Boss 范围 |
| `src/game/RunLaunch.ts` | 仅 `newRunIdentity` 指向新增身份；`retry` 保留原规则身份 | 先迁移决定，后实施；与 B2 高冲突 |
| 新窄单测与双端 harness | 仅用户要求的资格、事务、一次生效恢复、通关边界 | 不扩无关验证矩阵 |

## 已做验证及未做事项

现有基线命令：

```sh
npm test -- tests/recovery-save.test.ts -t 'round trips full state|keeps only the newest bounded journal|keeps an unsaved result|rejects double clicks|restores only the last valid backup' --reporter=verbose
```

结果：**5 passed，19 skipped**。覆盖 checkpoint 往返、256 条截断保留状态、原备份/不兼容数据保留、失败候选精确重试不重复扣款、保存未完双击挡住。仅验证已有机制，**不代表 B03 新功能或迁移测试通过**。

未做：产品实现、新规则测试、类型检查/构建（产品未改）、PC/手机实际浏览器流程、截图/视频、任何物理真机操作。没有启动游戏服务，没有访问部署，没有读取或写入用户实际存档，没有合并 B2。功能所需有限验证待迁移边界明确后执行，不伪报完成。

阻点状态：**PENDING_SCOPE_DECISION**，并非权限拒绝。依赖动作“接入新救场身份、迁移旧局、场内购买与计分/UI”已停止。独立完成远端/约束/源码审查、最小设计、兼容结论、共享方法清单与上述基线验证。
