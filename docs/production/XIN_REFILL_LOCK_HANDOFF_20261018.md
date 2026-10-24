# 辛弃疾换牌：锁定 → 揭示 → 自主选择

用户明确要求在真实技能发动时使用已有专属眼神，随后揭示实际候选，不能等计分高光才出现。当前仅做表现时序，不扩写人物故事、不生成素材、不改变抽牌/候选顺序、选择数量、消耗或存档。

## 独立组件

`src/game/XinRefillLock.ts`：`savedXinRefillLock(before,result)` 核验真实保存的 `laohuanTrickUsed:false→true`、同局连续回执及真实弃牌事件。失败、重复回执、普通弃牌和已发动状态不产生镜头。返回值只有事件与角色来源 ID，没有候选牌 ID、点数、花色或牌堆数据。

`mountXinRefillLock` 复用当前辛弃疾专属 `eyes` 图和现有局部眼神视图；180ms 扫光只在该眼神矩形内部。owner 普通持有280ms后用既有90ms淡出，减少动态只显示静态图120ms。实时减少动态会移除扫光；dispose/销毁清理自有 tween。不建立新舞台、全屏遮挡、额外素材或独立长期监听器。专图缺失/无空位直接返回，不挡住后续候选。

## GameScene owner 补丁（尚未应用）

[XIN_REFILL_LOCK_OWNER_20261018.patch](XIN_REFILL_LOCK_OWNER_20261018.patch) 的局部边界：

1. 新增组件 import 与 `showXinRefillLockEyes` 方法。使用原 `EffectContext`、`heroClimax`、`refillPresentation` 和清理链，沿用隐藏/Escape/离场取消。
2. `discardSelected`：成功保存之后、原弃牌退场之后排入短镜头；现有 `effects.drain()` 完成后才由原 `renderHand/revealDrawnCards` 展示实际候选并恢复选择。没有提前读/展示隐藏牌，也未动领域命令。
3. `showLaohuanPayoff`：确认留牌保留实际目标附着、原头像/立绘响应、原角色短反馈，移除完整眼神与原1秒眼神等待。候选收起/继续、冷恢复不会重播发动镜头。
4. `showKeyHighlight`：仅当前 `usesLaohuanRefill` 身份抑制辛弃疾完整眼神镜头。真实分数、原计分来源反馈和其他英雄保持；旧身份不借本合同修改。

两份苏轼/辛弃疾补丁共同 `git apply --check` 通过，也在忽略目录的临时副本共同应用并通过 TypeScript 内存覆盖检查；**实际 GameScene 从未编辑或暂存**。并行 Scene/计分 owner 需在其当前源码接入并检查；不允许整份替换。组件提交本身不能签“运行时已采用”。

## 检查与后续验收

本次辛弃疾新增6项（真实回执且 cue 无隐藏数据、取消/失败/重复/普通弃牌拒绝、牌堆不足全留、局部扫光几何、减少动态/销毁清理、缺图/无空位回退），既有 `laohuan-discard-handoff` 4项，共10项通过。苏轼前批7项与类型检查通过；合并 owner 补丁 TypeScript 诊断0。

按用户最新限制，没有启动本地浏览器、游戏、长跑或全矩阵。远程 dot 动态、PC/竖屏、取消与真实 refill 流程同版验证 **NOT_RUN**；由 root 协调 owner 接线后执行。此次不使用旧计分眼神录像证明新发动时序，不签美术、物理设备或听感。
