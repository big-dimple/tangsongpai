# TODO

这里只保留当前收尾工作和代码入口。玩法、计分、经济、存档与奇遇规则不在本项待办内。

## 当前待办

- [ ] 用户自行试玩整合后的 PC 牌桌、PC/手机商店和 PC/手机结算，记录可复现的布局、遮挡、命中、动效或音效问题。
- [ ] 只按试玩反馈修复确认的工程问题；修复后复跑受影响的类型、构建、内容、领域或浏览器检查。
- [ ] 用户反馈前不填写审美通过，也不恢复旧基线计划、长期设备矩阵或额外重构。

自动检查、CI、截图和构建结果只能说明工程门禁状态，不能代替用户的审美、听感、实体设备或自然对局验收。

## 当前实现入口

- PC/移动牌桌：`src/game/PcTableLayout.ts`、`src/game/layout.ts`、`src/game/StageTableArt.ts`、`src/game/GameScene.ts`。
- PC/手机商店：`src/game/ShopLayout.ts`、`src/game/ShopScene.ts`、`src/game/ShopArt.ts`、`src/game/ShopMobileOffers.ts`、`src/game/ShopMobileOffers.css`。
- PC/手机结算：`src/game/IntermissionLayout.ts`、`src/game/PcSettlementPresentation.ts`、`src/game/MobileSettlementPresentation.ts`、`src/game/IntermissionScene.ts`。
- 六张透明人物：`src/game/PcHeroArt.ts`、`public/assets/tangsong-pc-heroes/manifest.json`；只复用现有 `pc` 运行图，不替换 `portrait` 或 `selection` 身份。

## 范围边界

- 透明立绘作为异形结构的主视觉，保留头手、衣袖和武器的完整源画幅；不使用圆形占位或硬裁切。
- 真实分数、收益、购买、保存和导航继续由现有领域命令与存档链路决定；表现层不得发放奖励或改变随机流。
- 任何后续修复都保留手机对局的正式触控路径、键盘路径和标准手柄路径，并同步更新命中、焦点和动画锚点。
