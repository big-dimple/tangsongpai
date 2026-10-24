# 六英雄逐牌可见区域整改

基线 main `ca5e78799c44e683d2b26a5b54f16d3b4fcc898c`，开发分支 `fix/hero-target-edge-bounds-20261019`。仅组件、对应窄测与本页证据；GameScene、ShopScene、规则、存档、原画和原 Lempo 预设未修改。开发分支正常 push 后交 `01a147ad` 顺序整合，不自行发布 main。

本批按父线程已看过的 16361/16362 截图说明修复；本线程未读取 Library 原图。此前整牌外侧烟层、点云及旧蓝焰交接文档按各自日期/SHA保留，不是本批当前表现合同。

## 当前实现

`HeroVisibleSurface.ts` 从真实 outer/visual 的世界矩阵、各自宽高和原牌绘制层级计算单牌可见区域。减去前景牌、文字、按钮、符号边界，选取仍在该牌纸面内的一处小区域：准备最多24×28 CSS像素，生效最多32×44，均不超过本牌宽高40%。没有以整组 union 当作牌、没有外扩搜索；完全被挡住就停止绘制。抬牌、重排、内层位移/缩放变化后更新。保守矩形遮挡可能少画，不能穿到相邻牌上。

`HeroLiveSmoke.ts` 的准备和保存后阶段共用该区域。原 Spooky fBm、ElectricBorder 噪声/弧线数学在同一个 Phaser shader 内形成小范围材质；旧整牌外框主片段、16组裁切 uniform 及旧裁切函数已移除。六人分别为红橙烟焰、传递光带、五瓣局部光纹、上升焰舌、分叉电纹、墨叶旋纹。Canvas、GL失败/降级使用同一区域内24个填充片组成的连续纹理，无圆点、粒子云、边框或额外监听器。

刘娥未保存的合法目标现在持续流动，不再落回静态点云；附着层不再创建默认“待转/已转”文字，原牌“交/主/弃”语义由原 Scene 保留。未保存意图不发布 committed/source，不写入存档；真实已保存的候选/留牌等仍保留其原来源反馈。

苏轼 K♠、2♦、3♥ 等散列目标分别取自己的区域，代理使用原卡作为遮挡层级 owner，不能因为代理被 bringToTop 就压过前景牌。已有实际 cut(p)、实际 arrival、cut(1)/原实体销毁清理合同保留。移除了此路径已无消费者的粒子池/来源光环；不可见目标不再借这些层向旧位置续画。

减少动态冻结材质时钟；隐藏、离屏、源/内层销毁、取消和 Scene shutdown 清理。Scene仍最多8目标/131072 FBO像素。准备低/中/高输出上限24×32、32×48、48×64，生效48×64、64×80、80×96；沿既有20/30/60Hz和帧成本降级。没有新引擎、DOM canvas、RAF、计分时钟或第三方依赖。已有两份许可保留并进入构建。

## 六人实际接线与边界

共同入口是 `src/game/GameScene.ts::syncHeroTargetAttachment`、`src/game/HeroTargetAttachment.ts`；保存核验为 `src/game/HeroAttachmentFacts.ts::savedHeroAttachment`。下表记录当前源码，不将设想记成实现。

|英雄|实际准备 / 生效 / 结束|实际目标与当前形态|仍未验证或缺口|
|---|---|---|---|
|苏轼|合法 `amoExileChoice.discardedIds` 预备；保存后 `begin/presentSushiDiscard`；原计分 owner 的真实 arrival、cut(p)、cut(1)/原牌销毁结束|每张真实待弃/已弃实例，红橙局部烟纹；实际斩切仍用 `SushiSwordSlash.ts` 红橙覆盖|PC/手机实际GPU连续像素未验；本批没有改计分 owner 的时序|
|刘娥|`erxiangChoice.selected.card.id` 的合法选择流动；同一保存 handoff 收据生效；精确 event/target 到达后220ms收束|单张目标的可见纸面传递光带；没有附着层“待转”字样和点云|刘娥专属小耳朵归整合负责人，本批仅提供避让合同，未重复实现或签已接入|
|文成公主|现有 `azaoRelease && azaoChoice.available` 选择释放后预备；保存的 `azaoCharge.release` 生效；真实 multiply 事件结束|`activeScoringIds`，缺省才用 `playedIds`；每张独立五瓣光纹|纯充能、尚未选择释放时不挂卡片材质，原充能数字仍归现有UI；真实GPU未验|
|花蕊夫人|合法 `xiemuBurn` 选择显示待付；实际保存消费后才改已付·待算；真实 multiply 事件结束|实际受益主牌集合逐张上升焰纹，标签按真实支付成本；不把草稿当付款|金币跳数/支付表现归原 owner，本批未改；真实GPU未验|
|秦琼|实际 pending wager 的 `refilledIds`；保存结果后胜只保留 `activeNewIds`，负沿真实待判目标熄灭；真实 won/lost 事件结束|实际新牌逐张分叉电纹，输约不制造成功爆闪|pending/won/lost 领域与对象回归通过，真人理解和GPU观感未验|
|辛弃疾|原 `XinRefillLock.ts` / `GameScene.showXinRefillLockEyes`、`XinRefillSequence` 在实际弃牌保存后、候选揭示前；真实候选/所选/已留均在普通计分前附着；首次真实普通 rank 到达按240ms收束|`pendingRefill.candidateIds` 与实际留牌IDs；每牌墨叶旋纹；来源仅新保存fresh集合，候选阶段 suppressSource|眼神/揭示时序已有接线，本批未编辑Scene；不借计分高光证明被动发动；真实GPU未验|

刘娥耳朵的最小避让接点：Text 自动保护；Image 加 `setData('heroInkPrint',true)`；Graphics 将准确世界边界并入现有 `HeroTargetAttachmentOptions.labelExclusions` 回调。后者本批也转交给 `SushiDiscardCardPresentation` 保护按钮/图形符号。须与现有控制区边界合并，不覆盖原回调，不为其他英雄添加符号。

## 检查与待验

[10文件106项窄测](tests.txt) 与 [TypeScript/400模块生产构建](build.txt) PASS。JS产物 `index-C8Ul2Svy.js`；构建元信息为基线dirty，最终整合同版构建归整合端。覆盖1280/390模型无点击推进3.2秒的散列3弃/5主对照、移动/缩放的真实内层、前景邻牌/自身印刷/耳朵边界/按钮、完全遮挡不外逃、刘娥未保存选中/重选/取消、降动态冻结、隐藏/离屏/销毁；六人真实 SavedRun 收据3秒以上推进、秦琼输约、辛弃疾候选/留牌在普通计分前持续更新及fresh来源、保存往返、实际斩切和原池专用回归均保留。

这是原生 Phaser 对象/Graphics绘制数据、几何、收据与shader资源/uniform边界 double 的工程证据。没有启动本机浏览器，没有GL驱动编译或真实PC/竖屏3秒连续像素，没有手机物理设备性能或美术验收。不能把静态图、函数存在或该模型推进签成动态视觉通过；整合端仍需实际画面批次。P08/H17保持 `in_progress`。
