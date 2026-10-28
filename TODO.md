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

## 四英雄后期增强（评审后实施中）

以 `HERO_BALANCE.md` 的规则合同与两层验收为准；保留既有试玩待办。按辛弃疾、花蕊、秦琼、刘娥依次独立提交，每步包含新旧身份兼容、规则／命令／计分、预览与 AI、界面和测试。实现后由 CI 验证；固定种子与真人试玩分别记录，不能把工程通过写成平衡通过。

- [x] 辛弃疾：实际补入批次、每场寻得、并列选择与恢复；CI 和浏览器结果仍待核验。
- [x] 花蕊：新身份四档支付、余额／利息与旧档兼容；CI 和浏览器结果仍待核验。
- [x] 秦琼：复用补牌证明按有效新牌数分档；CI 和浏览器结果仍待核验。
- [x] 刘娥：同点组逐卡逐次转移与重触发；CI 和浏览器结果仍待核验。
- [x] 固定后期手工程时序：同一手 2500 万经辛／秦／花 ×4 至 1 亿，核对玻璃、多彩、唐宋牌和路线成长先于主动倍率；该受控输入不证明自然可达或平衡。
- [x] 受控构筑的固定种子／资源配对样本和口径已记入 `HERO_BALANCE.md`；不作为自然可达或真人平衡结论。
- [ ] 补自然对局早中后期样本、购物与利息机会成本，核验真实 CI 状态并等待试玩反馈。
