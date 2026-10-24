# iPad 8 布局窄修

基线 `9abedd0195881c64c730f13e26b66c54f94b3716`，源码提交见 [index.json](index.json)。本批只改 `ShopLayout.ts`、`ShopScene.ts`、`layout.ts`，未改 GameScene、技能对话框、理牌、技能演出、规则或存档。此报告与图片不是物理 iPad 签收。

## 尺寸更正

初诊768×1024是典型旧款iPad尺寸，并非iPad 8的准确面板预算。Apple [iPad 8规格](https://support.apple.com/en-us/118451)为1620×2160物理像素。结合DPR2，以810×1080 CSS和反向1080×810为主要模拟基准（同面板尺寸的本地Playwright iPad gen7预设也是810×1080/DPR2）。浏览器工具栏情景用810×984和1080×714，即合成扣除96px；这不是测得用户实机innerHeight，仍受iPadOS、标签栏/工具栏、缩放和显示模式影响。768×1024/1024×768及其占高情景的先前通过记录仍保留为兼容观察，不冒称iPad 8准确实机尺寸。

## 原因及修复

- 768/810宽的商店落入700–999中间布局，而非竖版或完整桌面分支。左按钮宽200px，与居中420px货架第一件商品交叠。810时，章节目按钮x12..212，首商品x208.333..316.333，交叠3.667×44px；在旧版实际tap(210,130)打开“狭路相逢 · 购买详情”。[原截图](before-overlap-input.png)、[真实输入状态](before-native-input.json)、[同一回归断言旧版FAIL](before-assertion.json)。768时交叠24.667px，与初诊一致。
- 商店品质行在copyY+24，购后余额提示在priceY-54=copyY+22，14px文字行只错开2px。修后按已渲染的品质/用途下沿排列交易提示，再按真实提示高度安排价格及对应商品命中框；普通版和购后余额不再相压。
- 修后商店左按钮根据首件货架实际左边界收宽并留12px间隔，其他货架/手机/桌面几何沿用。点击修后节目按钮右边缘实际打开“本章节目单”，商品详情仍可点，取消不改变seq/金币；旋转中的购买详情内容/对局状态保留。[修后商店](after-shop.png)、[右边缘输入结果](after-chapter-input.png)。原(210,130)已不在章节目按钮内，不能错误要求该坐标继续打开节目单。
- 牌桌原810竖屏为desktop，固定扣除240px侧栏，手牌仅546px。仅对可用宽700–899px、可用高宽比>=1.15且未显式指定模式的纵向牌桌，使用已有竖向排布；810竖屏手牌为786px，768为744px。手机、横屏、近方窗口和>=900宽的桌面规则沿用，未粗暴全局替换700断点。[原牌桌](before-table.png)、[修后竖屏](after-table.png)、[横屏](after-landscape.png)、[占高横屏](after-toolbar.png)。

`layout.ts`是SceneView共享几何函数，因此诊断mode会随竖向牌桌选择变化；选角与商店仍使用它们自己的断点和构图，未把它们切换成手机商品列表。未复现的“横屏全部错乱”仍不签已全部解决。横屏商店原有有效高度712px门槛/结构切换保留，本批未把它认定为不可达缺陷。

## 验证及保留的失败

- `vitest run tests/layout.test.ts tests/shop-layout.test.ts tests/shop-boss-layout.test.ts`：实际匹配3文件，共100项通过，见 [unit-layout.log](unit-layout.log)。原桌面大牌断言的768×1024样例移入新增竖向容量合同；新增检查全宽手牌、8/9/14张可达、技能/出弃与手牌无交叠、安全边距，横屏/近方仍desktop。
- `tsc --noEmit`通过；Vite生产构建通过，[build.log](build.log)保留原bundle体积提示。
- `NODE_OPTIONS=--import=/workspace/.cloud-tools/system-chromium.mjs node harness/ipad-layout.mjs`（本任务环境系统Chromium启动适配，普通环境装好Playwright Chromium后直接node）：[after.json](after.json)状态PASS，Chromium151.0.7922.173，DPR2触摸模拟。自然标题→苏轼→同点路线→商店→实际购买一张→暖场→选牌；四个主要尺寸、实际旋转和压高，选中牌/seq/金币/持有数保持。修后节目边缘、商品和牌桌均以原生touch/DOM输入验证；未写入状态或直接切scene。390×844手机和1280×720桌面各一条有限自然链也通过，没有扩设备矩阵。
- [compatibility-768.json](compatibility-768.json)为先行768尺寸同一生产字节的通过记录。
- [before-assertion.json](before-assertion.json)是当前回归脚本运行旧生产基线产生的真实商品/按钮交叠FAIL，之后才用修后PASS对照。不是把旧layout脚本超时当作产品反例。
- [initial-probe-resize-timeout.json](initial-probe-resize-timeout.json)保留临时探针在切回竖屏后立刻按旧帧坐标点路线、误点原画所致超时。正式脚本等待canvas尺寸与下一稳定帧，再读实际camera/命中框点击；不是更改产品来迁就探针。
- [initial-boot-timeout.json](initial-boot-timeout.json)保留并发构建/多个本地Vite期间初载20秒未进入title的FAIL，无__harness/JS异常；根因未确定。停止其他服务后，以允许首次模块加载的60秒boot等待串行重跑通过。没有据此认定产品或浏览器缺陷。
- 修后原生请求记录中有一次切页/关闭时音频go-cake.ogg的ERR_ABORTED，未冒称所有音频下载或听感已验。页面JS错误列表为空。

## 验证边界与集成

本地Vite/Chromium模拟，未跑Safari、WebKit或物理iPad，没有查询部署域名。用户提供的手机技能框/复盘本截图未混作iPad证据。实际iPad工具栏高度、截图和完整横屏异常仍缺；真实弱GPU、审美及物理触摸签收保留。代码和证据分提交；本路只推独立分支/建PR，由主线程串行集成，未自行合main。所有本任务浏览器/本地服务在交付前关闭。
