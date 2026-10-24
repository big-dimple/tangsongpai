# 苏轼真实弃牌逐张蓝焰与斩切交接

分支 `dev/sushi-discard-origin-prep-20261018`，基于六英雄增强候选 `5b9dd206` 的后续证据与方向纠正。用户确认视觉：每张真实弃牌单独蓝焰，局部斩切、散片，再由这些实例把力量送往真实计分落点。其他五人增强候选保留；不恢复苏轼主牌组边框，不修改自主选牌、弃牌张数、倍率或任何领域数值。

## 产品与接线边界

- `SushiDiscardCardPresentation` 为每个实际弃牌 ID 建一个独立局部容器，跟随原牌世界变换；不改变原牌位姿/透明度，不复制卡面。原牌淡出仍由既有 Scene 动画所有。
- 斩线端点与笔宽收在单张牌内；中间非目标牌和文字进入遮挡保护。原牌销毁后仅保留最后来源位置的能量粒子，没有复活卡面。
- `savedSushiDiscardReceipt` 只接受同一真实保存事件及弃牌分区，排除主牌；`present` 只响应 owner 提供的真实 arrival。到达前空间进度封顶，不把时间耗尽当成真实入账。
- 现有 `HeroTargetAttachment` 提供 `previewSushiDiscard / beginSushiDiscard / cutSushiDiscard / presentSushiDiscard`，共用原 update 与清理链；20Hz、最多8个可见来源与32片是渲染预算，不是规则。
- 减少动态保留静态来源标记，跳过斩切、粒子飞行；取消清空，隐藏/blur 后已提交演出不复活。普通牌无 ID 匹配不会接入。

**GameScene 尚未接线。** 它由并行计分/场景负责人持有，本分支没有修改该文件。最小补丁 [SUSHI_DISCARD_LOCAL_OWNER_20261018.patch](SUSHI_DISCARD_LOCAL_OWNER_20261018.patch) 已 `git apply --check`，待 owner 在其当前源码手工接入：

1. `syncHeroTargetAttachment`：从当前合法选择的 `choice.discardedIds` 预览；不再用 `activeScoringIds`。
2. `presentTrace`：在既有真实弃牌淡出前绑定保存 receipt，把既有 tween progress 传给逐张 `cut`。复用原180ms/逐张延时，不增加队列等待。
3. `showScoreEvent`：在既有 `impact` Promise 建立处传入当前真实倍率落点及既有 beat 时长。若以后领域改变落点，由计分 owner 适配；本模块不推算倍率。

接入前，泛用 `amo.exile` 主牌光环被抑制，新蓝焰不会被旧错误 hook 自动启动。不能把组件存在写成场景表现已采用。

## 跨牌范围问题与通用合同

旧 `9fe60fc5` 的 `HeroTargetAttachment.groupCard` 将多个目标的世界坐标取 min/max，生成首目标至末目标的整体包围矩形，再沿整体矩形画角/带。非连续目标之间的普通牌因此落在框内。增强候选 `5b9dd206` 已按独立目标绘制实体气氛；其 `union(boxes)` 仍供组标签定位与来源方向计算，不是合法的跨牌笔画区域。

本次苏轼实现不调用多牌 union。可推广到其他非连续目标的合同：每段装饰笔画必须属于一个真实实例的局部几何；组标签可用整体范围排版，但不能沿该范围描框；来源传输应裁掉非目标完整卡面。此次不批量改动其他五人。

## 本批检查与验收限制

`tests/sushi-discard-origin.test.ts`、`tests/sushi-discard-local.test.ts` 共7项通过；类型检查通过；owner patch 可应用性检查通过。覆盖真实 receipt/错误主牌拒绝、非连续目标之间的普通牌、单牌斩线边界、取消销毁自有层且不动原卡、减少动态与来源预算。

未启动本地浏览器，未跑本地游戏、截图、全矩阵或新素材生成。动态/PC/竖屏/美术感受均 **NOT_RUN**，由 root 先协调 owner 接线，再用远程 dot 同版验证；旧本地增强证据不代签此次弃牌方向。未来自主弃牌选择与按张数爆发未实施。
