# 商店图外阅读层级 · 第二路

基线：`6892aabf68f3e8d90dfc0a5597cce7f96025e81d`。开工 `git fetch origin` 核远端一致；根 AGENTS / 总计划只读，以本次用户已确认授权执行。仅生产 `ShopScene.ts` / `ShopJokerPresentation.ts`、新专用 harness 与本目录。

实际改动：桌面货架名称 15→18px 深青绿；实际价格 16→18px，查看详情退为 14px 右侧次级提示；桌面原整块选中底色改局部细描边；手机普通价格深青绿、禁购价格朱砂红、已购灰色，点开后保留局部查看描边。用途文案/字号原本可用，保留。进入牌桌原本已清楚，保留深青绿、位置、大小与行为。局部样式不触碰共享 CSS / SceneView。

## 同视口对照与连续录像

| 视口 | 初始货架 | 查看后取消 | 正常动态完整操作 |
| --- | --- | --- | --- |
| 1366 | [原版](before-02/1366-initial.png) / [改后](after-01/1366-initial.png) | [原版](before-02/1366-selected.png) / [改后](after-01/1366-selected.png) | [原版录像](before-02/videos/page@ecae128b3921144a9b8a4130e5b48b07.webm) / [改后录像](after-01/videos/page@ff0fb8ec0048cb17351b2046784f494f.webm) |
| 390 | [原版](before-02/390-initial.png) / [改后](after-01/390-initial.png) | [原版](before-02/390-selected.png) / [改后](after-01/390-selected.png) | [原版录像](before-02/videos/page@75bbedd7bfc6d7a98c70624c35c165f8.webm) / [改后录像](after-01/videos/page@6424132d8735bd8a4e07a334bb953f22.webm) |

每组还保留 `*-detail.png`、`*-purchased.png`、`*-unaffordable.png`、`*-workshop.png`、`*-enter.png`、`*-table.png`。截图用于阅读层级与几何；动态只看连续 WebM，不用截图宣称动画通过。录像无剪辑，包含本地真实选角进入筹备至牌桌发牌；没有新增动画或修改已认可手牌飞行/冲击。

同种子 `group-natural-17`、苏轼、成组路线，原版/改后均真实 UI：查看→取消→购买连续确认两次→自然剩余缺钱商品详情→取消→自选工具查看→连续进入两次→明确进场。买炉火纯青实际 4 金，6→2，BuyOffer / LeaveShop / EnterStage 各只入 journal 一次；详情/取消/工具查看没有命令。完整 state、journal、存储与 applyCommand 一致，前后精确相同，见 [比较](comparison.json) 及各组 `full-state.json.gz`。

390×844 软件触控与桌面 1366×900。手机初始中央完整显示两张图且可向下滚动；购买后持有牌紧凑底部。前后 layout、原生货架、卡图和文字框边界逐项相同；工具原有全部展开、仅组内大字号第一保持，工具和购买详情文字前后一致。保留最新简明说明/真实 Tips，梅开二度仍由原模块输出严格两句，没有追加文案。

## 验证与限制

- `npm run typecheck`：通过；相关 8 文件 / 92 测试通过（shop-mobile-offers、shop-flow-components、shop-layout、shop-decision-copy、q2-growth-decision-copy、group-upgrade-ui-copy、shop、r2-shop）。
- 全量 `npm test`：413 文件 / 4996 测试通过；`npm run build`（含 tsc）：通过。实际日志见 [tests.log](tests.log) / [build.log](build.log)。构建原有 >500kB chunk 警告保留。
- 原版命令：`SHOP_REVIEW_LABEL=before-02 PLAYWRIGHT_BROWSERS_PATH=/tmp/shop-reading-browsers node harness/shop-reading-hierarchy.mjs`；改后用 `after-01`。浏览器均为环境 Chromium，本地 Vite；结束关闭浏览器和服务。
- 原始失败保留在 `before` / `before-01`；前者是环境 ffmpeg 缺失，后者是 harness 对初始自然货架缺钱的错误假设。修正观察顺序，没有换种子、导入局或改产品来凑通过。
- 未跑：实体手机/GPU/听感、其余英雄/全商品/全版本/优惠矩阵、长期平衡与真人理解。未查部署或试玩站，未生成/采购素材。没有媒体上传操作或绕过历史 Library 403；原始证据随仓库开发分支交付。
- 工程通过不代表用户审美、整屏音画或整体游戏完成。现有卡图风格与长说明截断的取舍仍待用户审样；本路不扩大改页面或重画卡图。

[机器索引](index.json) 记录双端录像时长、源码 SHA256 和原始失败。最终交付 SHA、PR 与该 SHA 的 CI 在 PR/回执精确核实；本目录不自引用提交 SHA。
