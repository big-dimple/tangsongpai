# 只回滚普通理牌

最新基线已 fetch 确认为 `70b0581d8ac5c9e8c2b877fc95dc4f7328d8854f`。按用户最终决定停止靠边方案及 AI 调查；本次不是整 PR217 revert。

`GameScene.sortHand` 完整方法逐字节恢复为 `9abedd0195881c64c730f13e26b66c54f94b3716`：点数降序/花色次序打破平手；花色按 ♠♥♣♦ 分组、组内点数降序。两种普通理牌都取消手牌选择、AI 游标及旧候选状态，然后提交原 ReorderHand。移除目标花色两个字段、导入、HandSuitSort helper、选目标 UI 和相应新测试；恢复原 hand-sort-selection 测试。

GameScene AST 对比最新 main：只有 sortHand 方法改变，删除 suitSortTarget/suitSortRunId 两字段。生产改动只有 GameScene 及删除 HandSuitSort，其余全部生产文件不动：PR217 紧凑技能弹窗/确认右侧、PR214 苏轼演出、PR215 布局、PR216 复盘本及领域/存档/音频等保持最新 main。源码一致性见 [equivalence.json](equivalence.json)。

新增最小回滚测试使用从指定旧提交提取、固定 SHA-256 的方法文本 fixture（兼容 CI 浅克隆），比较实际 GameScene 方法与指定旧版原函数的输出，使用同一8张牌含改变过花色的 ID、增强及版次。比较选中/未选和花色→点数→花色互切，检查花色连续、选中清空、AI/候选状态放下、牌张对象与实际规则不变。既有理牌测试恢复原版。最终运行结果见 [tests.txt](tests.txt)。没有继续 AI 根因调查，没有新跑双端浏览器矩阵/六英雄/全量构建或 CI，不将单元替身称为真实手势验证。

自有 `harness/hero-dialog-suit-edge.mjs` 只移除新花色选择及靠边滑选测试段、失效 helper 指纹及不再使用的 import；技能弹窗测试段保留，`node --check` PASS。

集成owner已反向撤掉共享`harness/screenshot.mjs`中新目标花色选择分支，完整文件与9abedd旧版逐字节一致；`harness/ui.mjs`的商店自身geometry判定保持70b0581d原样。组合审查见[integration-review.json](integration-review.json)：只有sortHand方法变化，普通排序12项专测再次通过。自有`harness/batch-214-217-integration.mjs`也只移除已撤销的目标靠边用例，其他路径不扩测、不重跑；历史原证据保留。必要现行计划已改为用户撤销靠边、恢复旧理牌；iPad继续搁置，重点PC横版/手机竖版。

`harness/ui.mjs` 未动；由唯一集成owner按原本批授权合main，最终SHA/CI见交付回执。已停止调查用 Vite5584/浏览器，不另开服务。旧 PR217 证据保留为历史，旧“保留选中/目标靠边”合同已由本次用户决定取消。
