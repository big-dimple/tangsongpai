# Q2 第一路：成长经营事实交接

> 状态更新：父任务已在本路原提交 `8a869c84` 之后，授权独占 `JokerGrowthCausality.ts` 和专用测试补齐 c04/c06 按需账单。下方原只读审查原样保留；新增产品改动与真实 UI 核验见文末“追加：c04/c06 按需账单”。初始只读阶段的 [CI](https://github.com/big-dimple/tangsongpai/actions/runs/39537679605) 和[计划检查](https://github.com/big-dimple/tangsongpai/actions/runs/39537679502)最终均成功，不能代替追加改动后的精确 head CI。

> 最新追加：用户要求在购买前就说人话、给简短搭配 Tips；本路按父协调扩展4张成长牌的第一层呈现，见文末“追加：买前短说明与搭配”。前一按需账单提交 `43dd4db2` 的 [CI](https://github.com/big-dimple/tangsongpai/actions/runs/39539496947) 与[计划检查](https://github.com/big-dimple/tangsongpai/actions/runs/39539497036)已成功；保留原审查/原 FAIL，不把历史通过代签新 head。

**本轮是只读核对与可复现输入交付，没有改变玩家看到的游戏。** 权威事实目前正确，不为交代码而新增领域模型。已关闭的是这批输入的支付、旧成长读取、新成长保存、过关时机和出售损失的事实不确定性；UI 接入与真人长期成长感仍待后续。唯一索引为 [index.json](index.json)，开工三栏及进度保留在 [PROGRESS.md](PROGRESS.md)。

基线 main `0d1c4cef14e5ee560376f3098f6a8abd043e1717`，已吸收 PR202 的 `467551c11c4c6dcab0026ca9b63016d64846fe5f`。提交前 `git ls-remote` 仍为同一 SHA。GitHub 连接器另核 [push/main CI](https://github.com/big-dimple/tangsongpai/actions/runs/39535774467) 的 domain/browser/docs 和[计划检查](https://github.com/big-dimple/tangsongpai/actions/runs/39535774509)均 success。它们是基线软件门，不是本路 PR 的 CI 或体验签收。

## 三栏结论

| 已经能证明 | 真正缺口 / 本轮保留 | 需要另行数值决定 |
| --- | --- | --- |
| 三条固定当前身份输入均有自然现货与实际扣款；不改供给、金币、手牌或 RNG。买不起失败前后整态相同。 | 成组用满三手才到店；店中两对 Lv.2 已保存，第四手兑现未跑。没有为了补结论继续出牌。 | 这些固定输入只证明可获得路径，不证明掉率、稳定补件或全局胜率。 |
| 顺子首次成长不回灌当手；下一店实付升级后，下一手确实读取 Lv.2 与已存 +10，再保存 +20。 | 同花升级后的下一手刻意打高牌：Lv.1、高牌 43 分，读取已存 +0.5，不新增同花成长。同花 Lv.2 正向读取未覆盖。 | 升级价、收益强弱、留钱是否过强或成长是否过慢，都没有本轮数值授权。 |
| 成长实例出售返还按真实 paidPrice；实例和成长一起失去，本局路线资历不丢。旧 C9 存档身份与 checksum 保持合法。 | 没有自然再次出现同名成长牌，未做自然重买；未把人工改货架的测试当作自然获取证据。 | 目标曲线、前三次资历缓冲、单族封顶和英雄倍率均不改。 |
| 保存/恢复核对完整 checkpoint；查看纯呈现函数不改 state；过关新资历不回算旧手。 | 当前 c04/c06 没有 b10/b03 的同名“加成从哪来”详情入口；已有完整计分回看和泛用成长解释，不能称为全无说明。是否补该按需入口交父协调 UI owner。 | 真人理解、长期成长感、听感、实体设备和正式签收均未验。 |

## 固定短链的实际账

下表均为当前正常新局身份、角色 erxiang、初始 6 金，读取现有自然记录的固定种子/选牌；由真实 `applyCommand` 执行并校验检查点。**这是普通领域命令核验，不是新增浏览器实操，也不是人类自然游玩样本。** 原始三路线属旧身份，只作为输入来源，没有重跑完整旧战役；没有刷种子、修改存档凑成功或通过注入得分。

| 路线及固定种子 | 买入 → 出牌/成长 | 下一店 → 下一手 |
| --- | --- | --- |
| 成组 `group-natural-17` | 自然 b10「炉火纯青」4 金，6→2。两对 182、两对 186、对子 150，累计 518/400。三手依次读取旧值 0/10/20，结算后成长 10/20/30。 | 过关后 7 金；OpenShop 不再发奖励。两对 Lv.1→2 实付 4 金，7→3。已用满三手，停在店内；不声称升级已兑现。 |
| 顺子 `policy-valid-groups` | 起手现货 c04「步步高升」4 金，6→2。沿原公开弃牌/选牌首手顺子 780，读旧成长 0，结算后存 +10。 | 店内 9→5 金，顺子 Lv.1→2。沿原下一场公开弃牌/选牌，顺子 1125/600，实际 Lv.2、读取旧 +10，结算后保存 +20。总两手，只进入一次后续商店。 |
| 同花 `policy-valid-suit` | 起手现货 c06「青出于蓝」6 金，6→0。原选牌同花 676，旧成长读取 +0，结算后存 +0.5。 | 店内 7→3 金，同花 Lv.1→2。下一场打公开第一张高牌，43/600；读取已存 +0.5，无新增成长，基础仍是高牌 Lv.1。总两手、一个店。 |

三个购买后的买不起反例都返回 `not-enough-gold`，state/金币/RNG/命令序号不变。三个升型后的重复购买都返回 `basic-choice-consumed`，没有第二次扣款；同店改牌/染色机会也已用掉。原始失败、每笔命令、实际事件、sourceJokers、savedJokers、旧值和新值见 [audit.json](audit.json)。当前各节点完整 checkpoint 与命令见 [checkpoints.json.gz](checkpoints.json.gz)，可用原 `readCheckpoint` 验证；只是核验产物，不自动导入玩家存档。

每条短链的第一次胜利只使其相关族资历从 0→1，这次出牌仍用清场前 0；下一手族因子仍为 ×1。这不是资历未存或成长丢失。只读 `r2RouteFactor` 核到前三次合格清场因子仍为 1，第四次清场之后下一手才有 G×27/20（S×7/5、F×13/10 同合同）。未为展示倍率再补打四场。

## 经营代价：实例成长与本局资历分开

在三条当前商店的克隆上各执行一次出售，单独标记为反事实，不冒称玩家已卖：b10 已存 +30 卖 2 金；c04 已存 +10 卖 2 金；c06 已存 +0.5 卖 3 金。出售实例后，该实例和成长消失；完整路线账、关卡目标与 RNG 保持原值。主短链没有接受这些出售。

旧 C9 用户自然导出原文件 SHA256 仍为 `085d29b9fd4bcabf638f87c2eeb63f55c17ca553c65ade87e10544337d28f1b9`，其旧 bounded-clear 身份、60047 分和 264 金通过原严格保存校验。本次不重打旧 196 命令战役，从它直接派生一个商店。单独克隆交易是：卖 c04（+100 热度成长丢失，264→266）→买实际货架 e06（实付 5，266→261，初值 0，不补偿购前出售）→卖 c08（261→264，持有中的 e06 实际成长 +0.5）。现金回到 264 不代表零代价：失去原 c04 的直接效果与 +100、c08 的四张顺子资格。路线资历保留，没有把未出牌的 e06 说成已兑现。此链不是新自然样本或 C10 发牌预测。

## 交给父任务的准确 UI 差异和最小接线清单

跨界文件已在会话报告；本分支不写 `src/game`。最初怀疑的“交易成长误称上手”经检查没有确认：`SavedGrowthChange.transactionGrowthChange` 按成功命令前后态、真实 phase 取值，ShopScene 在保存成功后消费；不把猜测作为 bug。

1. `src/game/JokerGrowthCausality.ts:groupGrowthCausality` 限 b10/b03。`ShopScene.inspectJoker` 与 `GameScene.inspectJoker` 因此不给 c04/c06 同名详情按钮。本路当前 c04/c06 的 `presentation.causality[].detail` 确为 null；但 `BuildGrowthProgress`、`JokerExperience.savedExperienceCards`、原完整计分回看已有来源/条件说明，不能重造为“没有成长解释”。
2. 如父任务决定补齐按需账单，直接复用 `GrowthPayoff.growthPayoffs(state)`：已有 instanceId/definitionId/rootId、readCount/readValue、before/after、change/delta/caption，并拒绝已出售、同名新实例或后续余额不匹配的旧回执。`+0` 表示真实读取零；`—`/readCount=0 才表示未读取。不要用当前成长伪造上手读取。c04/c06 当手和店后样本均在本索引，缺一方就只显示当前已存、明确无历史。
3. 保留现有入口层级，在按需详情复用这些字段即可；`GrowthPayoffView.showGrowthPayoff` 当前没有调用者，不必为本轮另开一块主屏布局。c04 样本应讲清“上手用 +10，结算后存 +20”；c06 高牌负例应讲清“用已有 +0.5，未新增；付费升级的同花 Lv.2 本手未读取”。
4. 经营端沿 `r2PracticeQuotes` / `hand-practiced` / `shopPracticeSavedReceipt` 读取实付和等级，沿 `shopReplacementTransactionFacts` 的真实 Sell→Buy 派生保留购后优惠与余额；`shopRouteGrowthFacts` 解释资历保留。已有这些接口，无需新增领域/存档字段。UI owner 只需核现有入口可达、保存成功后展示、取消不耗，以及窄屏文字能读；本路不宣称这些操作已重验。

## 复现与保留项

运行 `node harness/q2-growth-audit.mjs`。入口 bundle 的 BASE_URL 仅供 Node 中读取已有纯呈现代码的资源链接；不启动浏览器或服务，不改产品。输出 [audit-run.txt](audit-run.txt)。`npm run typecheck` 与四个相关既有测试文件通过（[81 项结果](related-checks.txt)）；这些构造反例的测试不是自然获取/玩家体验证据。产品 `src`、既有 `tests`、内容与 CI 配置相对 main 均无差异。

原 FAIL 均保留：`FAIL-1792551913552.txt` 是 Node 缺 `import.meta.env.BASE_URL`；`FAIL-1792551926790.txt` 是核验脚本误认 f03 为售牌成长来源，实际 f03 为首手加成、e06 才是售牌成长。本次按真实 C9 货架先买 e06 再卖其他牌修正了观察器。独立对 harness 加严格类型检查时，`assert.equal` 已缩窄成功分支，后续重复判断的 `result.code` 成为 never，原输出保留在 `FAIL-harness-typecheck.txt`；删去冗余不可达分支后通过。没有更改或放宽产品规则。既有证据目录的 FAIL 全部保留。

仍未验：成组第四手升级兑现、同花升型正向兑现、自然重买/后期新三路线、真人理解、长期经营和平衡、实体设备/听感。当前没有 UI 修复完成声明；P08/Q2 的玩家结果不能由这份审查签完成。不合 main、不查试玩域名、不买素材、不用 Astra；本路没有启动任何自启服务。

## 追加：c04/c06 按需账单

父任务明确给出独占窗口后，仅扩展 `src/game/JokerGrowthCausality.ts` 原函数的 c04/c06 分支，并增加 `tests/q2-growth-causality.test.ts`；ShopScene/GameScene 原调用直接显示既有“加成从哪来”按钮，没有改 Scene、布局、主屏或持久数据。b10/b03 原路径保持。账单复用已有 `growthPayoffs` 的真实、按持有实例匹配的回执：当前已攒、上次出牌前值、上次实际读取、结算后变化及保存值分开显示；用“上次出牌/下次出牌”，不把新成长补算旧分数。

真实读到零显示“实际用到…+0”；没有读取事件则显示“未读取”，即使结算后确有新增也分别说明。无出牌历史或重买的新实例只显示当前值并提示没有记录；已出售来源不再有账单，后续余额与回执不匹配时降级，不借当前值伪造过去。出售丢失、重买从0和跨场保留沿原规则说明。

新增专用测试与原成长、回执相关测试通过；[新增核验输出](ui-unit.txt)、[类型检查](ui-typecheck.txt)。未读取事件的反例与重买身份反例是明确的受控单元输入，不冒称自然获取或浏览器内实际重买。

UI 核验入口为 `node harness/q2-growth-detail.mjs`，只使用桌面1366×900和软件手机390×844两档。受控前置通过原严格 `readCheckpoint` / `IndexedDbSave.commit` 写入启动前的空浏览器存储，随后真实点击“继续”、源牌查看、按需按钮、滚动和关闭，并冷恢复；不在运行中改 state 或调用命令替代玩家操作，不新增任何出牌。原三路线自然输入/普通命令证据保持在原 audit 中；这组已保存状态的详情实操不签自然获取率或实体手机。

原浏览器失败保留在 ui-detail/FAIL-*：前两次沿旧脚本查找当前已不存在的“进度与存档/导入本局”，未进入应用核验，已改为明确披露的启动前严格保存前置；第三次390短触后画面已是成长账单，观察器却继续等待中间按钮而超时；随后长按进入既有调序，不是查看；再一次误以为非折叠持有区也存在 `.shop-held-manager` 列表。以上均保留原图/日志，不为观察器修改 Scene。最终手机商店使用现有“培养路线→查看全部现货与持牌→查看来源与成长→加成从哪来”，牌桌点持有牌后点按需按钮。

[最终双端报告](ui-detail/report.json)的6例 PASS：两档分别 c04 商店 +0→+10、c06 牌桌高牌读取 +0.5 但未新增、无历史（桌面c06/手机c04）。每例查看/滚动/关闭前后完整 state、journal、RNG、IndexedDB/current/previous/revision 与 localStorage 相等；冷恢复也相等，四条有历史路径再次开账单内容一致。关闭按钮48px；手机对话框 x19→371、正文16px，scrollWidth=clientWidth=318，无水平溢出；内容可读到底，没有缩字或主屏面板。已实际看[桌面零读取/新增](ui-detail/1366-c04-shop-top.png)、[手机旧值读取且未新增](ui-detail/390-c06-table-top.png)与[手机无历史](ui-detail/390-no-history-top.png)。报告明确复用同一产品源码 SHA256 下前一次运行已通过的三个桌面结果，最后只重跑手机，不把中途观察器失败藏掉或扩大视口矩阵。

新增/相关6文件36项、项目 typecheck、生产 build 均通过；保留既有 bundle 体积提示。最终报告的单一产品源码 SHA256 为 `9259ff2c11f00c7cca017b613ecc413add494d781cfaf0fef3a2679aae036747`，与最终提交中的该文件核对；报告 head 是采样时的原提交，具体工作树改动由此 hash 绑定。原只读 audit/checkpoints 未重跑或改写。此次实际关闭的是 c04/c06 现有按需账单可达及真实账单可读缺口，非全 Q2/长期体验签收；原未验项继续保留。自启 Vite/Chromium 已在脚本 finally 中关闭。

## 追加：买前短说明与搭配

本轮实际产品文件是新增 `src/game/JokerGrowthDecisionCopy.ts`、调整 `src/game/JokerPlainCopy.ts` 和 `src/game/ShopDecisionCopy.ts`。原账单文件与两个 Scene 不再修改。只针对与本路成长账单相关的 b10/b03/c04/c06；其余牌不套用新模板，梅开二度仍仅“葫芦 ×2 / 同花葫芦 ×3”。更新5个已有文案测试的相应措辞断言，新增专用 `tests/q2-growth-decision-copy.test.ts` 和有限实操 `harness/q2-growth-decision.mjs`；没有改72牌内容、全局布局、规则/价格/掉率、英雄效果或存档。

| 卡牌 | 买前第一层（当前正常新局规则） | 同一层的短 Tips |
| --- | --- | --- |
| c04 步步高升 | 顺子或同花顺热度+50；出牌后攒+10热度，下次出牌起任意牌型都能用。 | 搭配：让普通顺子只需4张的唐宋牌，或改点工具。 |
| c06 青出于蓝 | 打出同花牌型后，攒+0.5倍率，下次出牌起任意牌型都能用。 | 搭配：染色工具，或让普通同花只需4张的唐宋牌。 |
| b10 炉火纯青 | 打出对子等同点组合后，攒+10热度，下次出牌起任意牌型都能用。 | 搭配：同样靠同点组合生效的唐宋牌，或改点工具。 |
| b03 莫逆之交 | 打出对子等同点组合后，攒+0.25倍率，下次出牌起任意牌型都能用。 | 搭配：同样靠同点组合生效的唐宋牌，或改点工具。 |

数值由当前定义/实例读取，不用卡牌ID硬写50/10/0.5：临近上限只显示实际还能攒的量，封顶不承诺再长。第一层保留上限、跨场保留、出售清空，c06 的同花顺/同花葫芦/同花五条仍明说。买前显示“新买入从+0…开始攒”，买后显示“当前已攒…”，复杂的上次读取/新增/累计仍留原按需账单。非同一族的旧身份不采用新句子，历史规则不变；计分暂停仍明确提示。

Tips 的相容性核对是当前定义真实存在 `four-straight` / `four-flush` 修饰，以及现有工具 `shift-rank` / `set-suit` 操作，不假定本店一定有货、不引用易错的具体卡名、不预告胜率。它们只指向可帮助凑对应牌型的组件；没有“高倍率更强”式泛话，也没有新增教程层或面板。

[真实买前/买后报告](plain-language/report.json)为4例 PASS：桌面1366×900和手机390×844各真实正常起局 c04/c06 两条，沿已留存 `policy-valid-groups` / `policy-valid-suit` 种子；没有导入/注入存档、改货架或刷种子，没有新增出牌。每例买前查看→取消保持整态/命令/存储相同；再次查看只点一次购买，实际 c04 6→2 金、c06 6→0 金，一条 BuyOffer 的完整领域结果与 UI 保存相同；买后查看→关闭仍不消费。Tips 在 `.card-ability` 第一层、位于全部 disclosure 外；未展开规则，正常滚动后 Tips 全部在可见区域，横向无溢出。手机买后沿“购物结果→查看新牌”，桌面点持有牌。报告明确复用同版源码的两个已通过桌面例，修正手机观察器后只补手机。

已实际查看 [手机 c04 买前](plain-language/390-c04-before.png) / [买后](plain-language/390-c04-after.png)、[手机 c06 买前](plain-language/390-c06-before.png)和[桌面 c06 买后](plain-language/1366-c06-after.png)。完整8张PNG均在本目录。原新一轮 FAIL 也保留：第一次把原有首次提示的展开误判为规则展开，改为只检查 `.card-rules` 及 Tips 所在 DOM；第二次买后点击“购物结果”后观察器仍找“查看来源与成长”，实际按钮是“查看新牌”，没有为脚本改 Scene。10条旧文案断言及后续两条精确措辞断言的原输出保留在 `plain-copy-first-check.txt` / `FAIL-plain-copy-*-check.txt`；规则/数值断言仍保留。

[针对性72项](plain-copy-check.txt)、[类型](plain-copy-typecheck.txt)、[生产构建](plain-copy-build.txt)及[本地全量413文件/4996项](plain-copy-full-tests.txt)通过。精确新 head CI 另按实际结果记，不由截图或旧 CI 代签。没有启动新长期任务；仍不签真人理解、长期成长感/平衡或实体设备/听感。

**Library 尚有外部阻碍：** 为8张明确请求的截图执行官方 prepared upload helper，写入调用因网络失败；只读 helper 诊断为代理 `403 Forbidden`，正常 Library 工具列表核实没有新增文件，当前无 Library ID。未重复写入。准确动作、文件清单、原因与状态见 [library-status.json](plain-language/library-status.json)；仓库截图和软件交付不受影响，待父任务协调上传通路。
