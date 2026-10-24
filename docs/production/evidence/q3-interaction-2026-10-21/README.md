# Q3：桌面与390竖屏完整短流程审查

结论：**本次有界软件核查通过，未发现可复现的产品输入缺陷，因此没有虚构产品补丁。** 交付一张动作合同、可重放的专用 harness、真实输入录像/截图及完整前后状态。Q3/P08/H17正式验收仍开放，现行全局计划未改。

基线 main `0d1c4cef14e5ee560376f3098f6a8abd043e1717`，包含PR202 `467551c1`。全部 `src/` 与基线字节相同；专用脚本在最终核查期间的源码指纹保持不变，见唯一机器索引 [index.json](index.json)。已读 AGENTS.md、DELIVERY_PLAN.md、plan.json 和相关UX/ENGINEERING合同；仓库 `.agents/skills` 不存在，`/workspace/.agents`为空。会话最新Q3委派优先于仓库陈旧的唯一Q1任务文字。

## 实际玩家链与结果

1366×768鼠标、390×844 Chromium原生CDP触摸各一次最终完整流程，DPR1、软件Canvas、减少动态。使用已有固定种子 `group-natural-17`，从标题选苏轼→同点成组路线→联合确认自然开局，没有导入存档、修改发牌或未来牌堆读取，也没有刷种子。

1. 实际拒接本章节目录，长按现货查看并取消，金币仍6。
2. 从消耗工具货架购买自然现货黑桃染，快速重复确认仍只有一条 `BuyOffer`，金币6→2；取消使用后库存仍1件。留2金进入牌桌，明确点击“三场对峙”的进入暖场。
3. 长按手牌只打开详情；关闭未选牌、未出牌。选一张拟出牌，进入技能说明后返回保留原草稿；明确选择技能、取消技能均不写局。
4. 带未提交手牌/技能草稿刷新，经标题“继续本局”回到已保存牌桌，手牌选择、助攻和主动技能草稿清空；完整状态/命令日志/存储保持不变。
5. 对自然买入的黑桃染选择真实当前手牌 `clubs-12`，取消不消耗。再次选择后注入**受控IndexedDB配额失败**，快速重复“确认使用”只产生一次失败写入；旧完整状态/日志/存储不变。关闭原面板，经菜单“重试保存”，存储 `current/previous` 与失败候选完全一致，只有一条 `UseConsumable`，工具1→0，目标花色真实变成黑桃，金币仍2。注入只改变存储可用性，没有注入牌、金钱、领域命令或成功结果。
6. 用现有公开手牌计算入口选择 `2♥ 2♠ A♣ A♦`，明确选择苏轼主动当次效果。将出牌按压拖离不提交；390另核原生 `touchCancel` 不提交、不排队。恢复新输入后快速重复出牌，只提交一条 `PlayHand`，实际弃4张余牌，得分546，超过目标400，真实过关奖励+7金。
7. 打开本场详情并返回、刷新后继续恢复同一结果；明确前往筹备商店，再刷新继续到下一店，金币9、commandSeq8。两端最终**整个state、journal、storage三元组逐字段相同**。

每条保存命令均用本次实际journal命令送入原有纯领域计算核对预期，再比对已发布状态和完整checkpoint；没有通过harness调用控制器命令来代替UI。只读/取消操作比对完整三元组，未只看按钮或金币。

## 直接审阅

| 证据 | 桌面 | 390竖屏 |
| --- | --- | --- |
| 连续真实输入录像 | [完整过程](final/videos/page@fda5808f066dfb54a77182f3436bbf79.webm) | [完整过程](final/videos/page@5d9ea9f71315427c008b41da332c16b4.webm) |
| 真实拟出牌与技能 | [截图](final/1366-ready-to-play.png) | [截图](final/390-ready-to-play.png) |
| 配额失败原状态 | [截图](final/1366-save-failed.png) | [截图](final/390-save-failed.png) |
| 实际546过关结果 | [截图](final/1366-actual-result.png) | [截图](final/390-actual-result.png) |
| 继续/恢复下一店 | [截图](final/1366-continued-shop.png) | [截图](final/390-continued-shop.png) |

[精简报告](final/report.json)、[完整状态/日志/存储与失败候选](final/full-state.json.gz)、[动作合同/进度](PROGRESS.md)。

原FAIL全部保留：`review-01`缺录屏ffmpeg；`review-02`陈旧节目单按钮；`review-03`漏切工具货架；`review-04`误用旧工作台tile选择器；`review-05`遗漏当前入场确认。它们均为观察脚本/环境失败，原错误、诊断、截图和已有录像保留，不能计为产品修复。`review-06`只是到恢复牌桌的PROBE；`journey-01`已通过完整链；`final`额外核出牌拖离、原生取消与重复出牌。最终没有扩大视口/种子矩阵。

## 复跑与边界

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/q3-browsers npx playwright install ffmpeg
PLAYWRIGHT_BROWSERS_PATH=/tmp/q3-browsers Q3_OUT=/tmp/q3-review node harness/q3-interaction.mjs
```

需已有依赖与 `/usr/bin/chromium`；脚本在 `finally` 关闭自身浏览器和Vite服务。ffmpeg只装在临时目录。`npm run typecheck`通过；`node scripts/check-production-plan.mjs`通过（32包，P08仍为当前项）。不以测试数量代替体验结论。

长按结论针对**卡牌长按及其关闭尾事件**，不购买、不出牌。现行UX对无详情主按钮的既定合同仍是原位按住后释放执行一次；本批没有改变其手势规则，也没有声称所有长按都被吞掉。独立关闭、目标取消、主按钮拖离、触控取消、购买/使用/出牌重复输入分别核验。

实体手机/GPU触摸合成、听感、审美和正式签收仍未验；没有改布局所以未加短屏/旋转矩阵。未接Q2新成长事实模型；其他英雄、全工具组合与长期平衡不在本次有界结论内。保留已合手机持有区、中央图位、工具展开/顺序以及已认可技能演出，未动规则、数值、掉率、领域/应用保存机制、素材与全局生产计划。

原主链没有执行普通 `DiscardHand`；苏轼主动当次的弃4张是技能代价。本次追加以下最小双端普通弃牌核查，关闭该软件缺口。配额失败核查仍只覆盖原主链工具使用，不外推到每种交易/出弃牌失败入口。

## 追加：普通弃牌最小双端核查

复用原主链 `final/full-state.json.gz` 中真实出牌前的完整合法checkpoint（seq6、校验和 `json-fnv-v1:64a30e4c93de4b70`），未改牌、金币或抽牌顺序。**这次是受控存档复放**：设置阶段正常申请写租约并调用既有 `GameSession.importJSON` 导入该checkpoint，刷新后从标题真实点击继续；之后的选牌、取消、弃牌全部为原生鼠标/CDP触摸。不冒称自然获取或现行菜单存在导入按钮。

两端均实际选中 `clubs-12`（前面黑桃染后显示Q♠）和 `hearts-13`（K♥）。取消选牌后反复点击禁用弃牌不提交；重新选中后将弃牌按压拖离，原草稿与完整保存三元组不变；390另核原生 `touchCancel` 不提交、不排队。随后在同一坐标快速重复点击弃牌，实际只增加一条普通 `DiscardHand`，不是技能弃牌：弃牌次数3→2、已花额度0→1、弃牌动作0→1；出牌次数仍4、playIndex仍0、热度仍0、金币仍2。两张指定牌进入弃牌堆，实际补入4♦和4♠，手牌仍8张，抽牌堆44→42。显示资源数字、卡面与保存结果一致。

实际journal命令经原领域计算逐字段核对；保存current为该结果的完整checkpoint、previous为前一checkpoint、revision只+1。补牌后选择清空、弃牌禁用，再重复点击不扣次；冷刷新继续保留精确结果，不恢复草稿。两端最终state/journal/storage三元组完全相同。无产品缺陷，未改产品源码，未触碰Q2独占的 `JokerGrowthCausality.ts` 或专用测试。

| 普通弃牌证据 | 桌面1366×768 | 390×844触控 |
| --- | --- | --- |
| 连续过程 | [录像](discard-03/videos/page@b57b1cf4068663787b77edbb2cb6dee3.webm) | [录像](discard-03/videos/page@ce8057463abc2e5a98968ae205b213bc.webm) |
| 真实选牌 | [截图](discard-03/1366-selected.png) | [截图](discard-03/390-selected.png) |
| 实际扣次与补牌 | [截图](discard-03/1366-discarded-refilled.png) | [截图](discard-03/390-discarded-refilled.png) |
| 冷恢复 | [截图](discard-03/1366-restored.png) | [截图](discard-03/390-restored.png) |

[普通弃牌报告](discard-03/report.json)、[完整三元组与UI读数](discard-03/full-state.json.gz)。原新增FAIL保留：`discard-01`误找已不存在的旧菜单导入入口；`discard-02`受控设置漏先申请空首页写租约，导入API按合同返回false。均发生在弃牌核查之前，只是脚本前置失败；`discard-03`满足既有前置后双端通过。脚本 `harness/q3-discard.mjs` 可用 `Q3_DISCARD_OUT=/tmp/q3-discard-review` 复跑，自身browser/Vite均在finally退出。实体设备、其他英雄以及各命令的保存失败入口仍未扩验，Q3/P08/H17正式验收保持开放。

交付：[可审PR204](https://github.com/big-dimple/tangsongpai/pull/204)，首个证据提交 `39e4966ed7a6a7a4cca1ae0a6bb7f577b8c4a348` 已push。精确最终head和CI回执以PR与最终交付回复为准；没有合main或操作试玩站。
