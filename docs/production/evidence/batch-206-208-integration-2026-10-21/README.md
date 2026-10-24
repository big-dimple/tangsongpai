# PR206–208 同版最小交叉核验

唯一数据索引：[index.json](index.json)。生产源码输入main `4c69111e1e966e1b99a1c03e89beaff96e0bb05a`；采集从干净提交`ad8d6f78e193e53e75c8210c45f1ac783c10b1ae`启动（仅多本目录check.mjs），七份受影响生产文件SHA-256在索引中。关浏览器/Vite在finally完成；没有生产兼容补丁。

## 已合映射与CI口径

| PR | 精确审查head | main merge | merge push CI / plan |
| --- | --- | --- | --- |
| [206](https://github.com/big-dimple/tangsongpai/pull/206) | d28983e4fe5b16f905b4e4896c1bf9486c2fd96b | 1faa660e8487e4c713a160ba5065184db84d0c6a | [39573729363](https://github.com/big-dimple/tangsongpai/actions/runs/39573729363) cancelled / [39573729205](https://github.com/big-dimple/tangsongpai/actions/runs/39573729205) success |
| [207](https://github.com/big-dimple/tangsongpai/pull/207) | 63f20b8ddd034363048258ae30dc7c79c3e617e8 | 0b9b3bd64832b7b799d182772bd2c45bad0b694f | [39573741866](https://github.com/big-dimple/tangsongpai/actions/runs/39573741866) cancelled / [39573741887](https://github.com/big-dimple/tangsongpai/actions/runs/39573741887) success |
| [208](https://github.com/big-dimple/tangsongpai/pull/208) | 2793744488c9e91f7c292a36a9dbcbbb5fa0493d | 4c69111e1e966e1b99a1c03e89beaff96e0bb05a | [39573753247](https://github.com/big-dimple/tangsongpai/actions/runs/39573753247) success / [39573753111](https://github.com/big-dimple/tangsongpai/actions/runs/39573753111) success |

三个PR精确head的完整CI/计划均成功（各PR保留链接）。中间main完整CI被后续main并发策略取消，不当通过；208集成源码完整/计划均成功。本目录随独立计划收口PR进入main，最终含文档merge的精确SHA及push/main两项终态以交付回执为准，不能拿这里源码SHA代替。

## 实际输入与玩家结果

[check.mjs](check.mjs)以Chromium正常动态1×播放。桌面1366×768、软件触控390×844各一次固定已有自然种子`group-natural-17`；没有注入手牌/存档、搜索种子、偷读未来牌序、故障注入或六英雄矩阵。游戏postrender只读观察，不修改生产方法或数值。

两端结果相同：

- 标题→选辛→选刘→再点同刘→成组路线→重复确认。切换/朱印被观察到；`ShopScene`只create一次、新局revision1，英雄/种子正确。
- 首店公开供给，先拒绝节目→炉火纯青b10查看→取消：state/journal/storage整tuple哈希不变。完整简明成长说明/Tips仍在。再次查看、重复购买：只一条BuyOffer，实付4金、6→2。重复进入只一条LeaveShop，再按公开入场按钮只一条EnterStage。
- 公开手牌助手切牌型，选出2♥/2♠/A♣/A♦；目标对话框选实际可见A♣（普通11点），草稿不保存。重复独立出牌：一条PlayHand。真实`erxiang.handoff`同eventId从M2→13，飞包`+11 倍率`→`听政 +11倍率`/`本次已转入`；charge/flight/impact/settled被观察到，源牌active/visible/alpha1、耳朵scale1、结束无残留。
- 最终H80×M13=1040，过目标400，奖励后金币9，phase stage-cleared；没有第二次扣款/建局/出牌，pageerror0。
- 390首店容器366px，scrollWidth=clientWidth366、两张完整货图可见；购买后原紧凑持有区/进入按钮几何保留。

| 证据 | 桌面1366 | 390触控 |
| --- | --- | --- |
| 选角确认朱印 | [PNG](1366-seal.png) | [PNG](390-seal.png) |
| 首店图外层级 | [PNG](1366-shop.png) | [PNG](390-shop.png)、[购后持有区](390-shop-owned.png) |
| 真实+11到达 | [PNG](1366-impact.png) | [PNG](390-impact.png) |
| 1040结果 | [PNG](1366-result.png) | [PNG](390-result.png) |
| 原速连续过程（只有画面） | [WebM](1366-process.webm) | [WebM](390-process.webm) |

已实际查看390店面/到达、桌面选角帧；牌点和操作未被新效果覆盖。截图的897是到达中间累计分，不冒称最终1040；最终值见结果图/保存事件。只签同版操作与真实数字，不签审美/理解或听感。

## 原FAIL和未覆盖

原各路证据不删：[206](../shop-reading-hierarchy-2026-10-21/README.md)、[207](../selection-ink-seal-2026-10-21/README.md)、[208](../liue-real-mult-transfer-2026-10-21/README.md)。207旧综合布局基线/改后均27组后的缩放开局超时，根因未知、后3视口未跑；本次固定两视口正常开局通过不改写该FAIL、不宣称全响应式。208历史15例mixed dirty不等于全最终SHA重跑；最终文案双端干净来源另有hash。强删技能按钮的SceneView异常main/current同源旧问题；直接remove未stop只在427e999故障注入FAIL，不能称main已复现；正常stop→remove通过。本次不重跑故障注入、不改公共生命周期。

全六英雄整体美学、其他英雄真实效果、长期平衡/成长、完整响应式、真人理解、外放/耳机、物理GPU手机和正式门仍开放；视频没有系统音轨，不签听感。只有辛顶部眼睛明确获用户满意。卖后重买用户明确不做，不列待办，旧Q2候选不自动恢复。没有新任务或部署检查。
