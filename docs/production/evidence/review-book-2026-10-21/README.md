# 复盘本真实结算反馈 · 有限受控证据

基线 `9abedd0195881c64c730f13e26b66c54f94b3716`，生产代码提交 `d80180a1ace84fa52ce7f75527ae6dceb9cf3903`。仅改复盘本结算展示及专属测试/证据；domain、规则、并列顺序、存档格式、ShopScene/ShopLayout、GameScene、技能/理牌/苏轼/选角和现行计划未改。源码 SHA-256、验证结果、原视频指纹见 [provenance.json](provenance.json)。最终证据提交只补 harness 冷图准备与本目录。

## 实际链与表现

现有 `r2Run.ts:grantClearItems` 只在 Boss 成功过关时处理持有的 U09。既有并列规则为 `R2_HAND_TYPES` 从低到高找第一个最大使用次数；该项达到 30 级则跳过，不另找下一项。代码未改。

已有 `onStageClear / rule / U09 / upgrade-hand` 事件保存 `targetHandType / resourceBefore / resourceAfter`，足够实现反馈，无需新 domain 接口。展示只读取本场已保存事件，不从持有、章内统计或末手牌型推算收益。当前成功结果且有事件时，原结算纸内显示道具图、“复盘本：两对 Lv2→Lv3”和“升级已保存”。实时过关沿原 `rewardClearId`，局部墨线亮起 900ms；静态收据保留。恢复无实时 token，不重播；重绘、迟到素材、查看详情均不发命令。系统/应用减少动态沿现有开关使用静态文字与图。

## 证据与边界

本组均为**明确受控输入**：预置 U09 持有、已发现两对 Lv2、章内两对使用 2 次及合法公开手牌/前两场路线记录，通过现有 `session.importJSON` 的校验/持久化 API 装载；当前菜单已无导入按钮。最终点牌、跳过技能提醒并出牌使用真实浏览器输入，真实 PlayHand 产出完整 trace。不是自然购买或自然前三场通关，也不是用户附件存档。

末手真实为顺子 10,497；升级对象为本章最多使用的两对，Lv2→Lv3。DOM/Canvas 显示记录的 `sourceEventId` 与事件 `/hand/controlled/settlement/boss-win/command/5/event/16` 一致。完整前后状态、事件、journal 和 IndexedDB 对照见 [report.json.gz](report.json.gz)，可读观察见 [summary.json](summary.json)。

| 有限检查 | 证据 |
| --- | --- |
| 桌面 1366×768、手机 390×844 真实末手→结算；一条收据、实时亮起一次、控件可用 | [桌面](desktop-settled.png)、[手机进入](mobile-entry.png)、[手机静态](mobile-settled.png)、[11.56 秒浏览器视频](mobile.mp4) |
| 系统 reduced-motion 从进入即无复盘本动效，文字/图保留 | [静态](mobile-reduced-settled.png) |
| Data Saver 关闭既有预取，U09 图片延迟 1.5 秒；先有静态文字，图片到达无第二次提醒 | [到达前](mobile-slow-art-entry.png)、[到达后](mobile-slow-art-settled.png) |
| 冷图 404，文字/按钮仍可读可用 | [缺图](mobile-missing-art-settled.png) |
| resize、blur、详情开关、刷新→继续恢复均不改等级/RNG/journal/存档，也不重播；继续只增加 OpenShop 一条命令 | [恢复](mobile-restored.png)、完整前后对照在 report |
| 普通关成功、Boss 失败、未持有 U09 的 Boss 成功均无 U09 反馈 | [普通关](ordinary-owned.png)、[失败](boss-loss-owned.png)、[未持有](boss-win-unowned.png) |

浏览器 8 项通过；`npm test` 416 文件 / 5032 项通过；`npm run build` 通过。专属 8 个测试还覆盖并列低到高、满级不重抽、无来源、重复命令 idempotency、checkpoint 恢复和展示去重。未签真实设备、听感、用户审美或全道具体验；视频为 Chromium 软件浏览器无音频录像，非物理手机/FPS 证据。未查试玩站/部署。

## 复现与原始失败

`node harness/review-book.mjs` 使用 `/usr/bin/chromium` 和现有 Playwright 视频工具。此环境 Playwright 缓存缺 ffmpeg，复现时通过 `/tmp/review-book-playwright/ffmpeg-1011/ffmpeg-linux` 链接到已有 `/usr/bin/ffmpeg`，命令为：

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/review-book-playwright node harness/review-book.mjs
```

先前 6 次 harness 失败的原始 summary 保留在 [harness-failures](harness-failures/)；分别为旧菜单选择器、导入前未取写租约、未确认真实技能提醒、Graphics 无 getBounds、Playwright 缺 ffmpeg、已有预取导致“冷图”假设失效。均修正测试准备/观察，生产规则未因此变更；各原目录和原图仍在 `/tmp/review-book*`，未清除或覆盖为 PASS。最终 8 项 PASS 独立输出 `/tmp/review-book-evidence`。

浏览器和本地 Vite 服务均已正常关闭。PR 留给父线程按精确 head CI 串行集成，不自行合 main。
