# 辛弃疾：保存→眼神→候选→留牌连续演出候选

规则依赖为已交付 `f46ef5bec0ab244ec70fc8221bf19e5abfe0c47e`（规则产品0110d725）；本分支 `dev/xin-refill-sequence-20261018` 已快进到该依赖。本包产品 `69a16e61be9f718ccf03afd9537a66c88e63589b`，相对规则依赖没有domain/application/content或原图改动。读取并对齐了[规则负责人演出契约](../refill-handoff-frequency-2026-10-18/effect-contract.md)，不另改辛弃疾次数或刘娥规则。

**工程检查通过，视觉/动态/触控与设备性能未验。** 本机没有启动浏览器；不以函数、几何或单测存在签成更酷。H17/P08保持in_progress，交root用dot同版验收。检查索引见[verification.json](verification.json)。

## 定位到的断点与本次改动

- 旧XinRefillLock要求发动前历史标记为false，第二次普通弃牌前该标记已true，会丢掉眼神。现在新身份使用`laohuanRefillRepeats(before)`＋真实成功非duplicate收据、同run/连续seq、cards-discarded真实ID及pending来源验证，不要求false→true；正常动作不需要laohuanTrick字段。无pending的真实牌堆不足也按重复身份识别，不补造两张候选。旧身份普通弃牌仍不冒充发动。
- 旧眼神局限于小技能槽，扫描后先释放，再串行角色提示，最后才从牌堆揭候选。新`XinRefillSequence`只借用暂时闲置的分数主体区，保持原8:3眼神整图；旧分数数字短暂隐藏后恢复，分数内容不变。眼神与原弃牌动作并行，160ms准备包含在原弃牌等待内，减少动态为0；移除辛弃疾额外串行角色提示。
- 到实际候选揭示才写入候选ID，保留眼神，调用已复用`drawHeroOriginStream`的最多2路能量头；现有发牌方法仅Xin分支从眼神世界坐标出发（160ms到位、20ms错峰、两段65ms翻面），普通补牌仍走原牌堆/240ms路径。260ms连接及眼神90ms释放不阻塞候选输入。轨迹始终在实际移动牌面下方，文字/图片/交互区与普通牌有遮挡保护。
- 全部真实候选进入即有“候选”标记与周边流动，部分勾选即标“待留”，不等选满。确认保存后才标“已留”；实际选择按before.pendingRefill.candidateIds规范顺序投影，未留ID不当第二次弃牌。已保存、仍在本场手中的留牌归属合并保留，不被下一次选留覆盖；首次正数普通计分冲击合同继续保留。
- 共用层旧上限5目标还会漏掉弃5张时的第6/7候选。仅Xin候选/留牌使用既有8目标上限，其他英雄上限不变；七候选实测构造14个原生发射器、预算112/128，普通牌没有标签或发射器。候选全牌面与文字保护，未新增粗框套框。
- Escape或下一次触控可快进，先结清正在移动的候选牌，再取消源演出；无拦截输入的新对象。保存成功的ChooseRefill在重建手牌前清旧源，覆盖键盘确认；取消、后台/resize、原视图销毁、shutdown及迟到回调清理。冷恢复/收起重开只有真实候选周边状态，`ignite=false`不重播发动，专用眼神不因恢复或计分重放。

## 用户原图与现成表现范围

实际复用`hero-eyes-laohuan`，文件`public/assets/tangsong-eyes/laohuan.eyes-375b308030e5.webp`，768×288、130860字节。已查看原画，未改裁切、alpha、笔触或字节；本次Get-FileHash结果仍为`375b308030e5e789f9c8d1d80807c739bb3fc820c73fefb09c330083349a26a1`，匹配原manifest。缺该专用纹理时跳过眼神，不换别人的眼图。

复用现有HeroClimax、HeroSkillParticles及HeroCardAttachmentAtmosphere；没有新引擎、依赖、音频/图片或阻塞加载资源。原生粒子全场128预算不变，动态候选仍由既有可见性、低动态与scene清理管理。没有扩大到其余英雄美术整改。

## 第二次普通弃牌的具体证据

`tests/xin-repeat-sequence.test.ts`在Node中使用真实`SavedRun`内存SaveStore、领域命令和实际GameScene的discardSelected/showXinRefillLockEyes/toggleCard/chooseRefill/showLaohuanPayoff；Phaser绘制对象及时间模拟，**不是浏览器动态**。

1. 真实新身份初始存档→LeaveShop→EnterStage，两次正常DiscardHand请求都完全不带laohuanTrick字段。
2. 第一次眼神键`xin/repeat/command/4/xin-refill-lock`；第二次开始时历史标记已true，仍生成独立代次与`xin/repeat/command/6/xin-refill-lock`。before/after连续seq及实际弃牌/固定候选ID由真实保存结果核对。
3. 两轮均先验证未选满不提交，再通过实际toggleCard选留、ChooseRefill成功；未留进playedPile。每轮保存后`readCheckpoint`有效且`SavedRun.restore(...).state`与场景一致；两轮已留实际ID归属保留。累计只消耗两次正常弃牌、6条实际journal命令与7次store提交，无演出额外命令。
4. `xin-seven-candidates.test.ts`直接驱动共享渲染器：七张实际候选每张都有标签及两个发射器，第七张可显示“待留”；普通牌无效果，销毁释放所有发射器/update监听。它只证明构造/预算/清理，不能签画面观感。

最终命令：`npm exec vitest -- run tests/xin-repeat-sequence.test.ts tests/xin-seven-candidates.test.ts tests/xin-refill-sequence.test.ts tests/xin-refill-lock.test.ts tests/hero-action-chain-order.test.ts tests/hero-retained-ownership.test.ts tests/hero-target-attachment.test.ts tests/refill-layout-recovery.test.ts tests/hero-native-particles.test.ts tests/hero-attachment-facts.test.ts tests/hero-attachment-viewport.test.ts tests/hero-climax.test.ts tests/score-table.test.ts tests/refill-handoff-frequency.test.ts`。

结果**14文件105项PASS**。`npm run build`类型及377模块构建PASS，产物`index-CXDWIiPO.js`；构建时间2026-10-18T08:27:40.834Z、元数据为首产品e3e2ae60加dirty清理补丁，受测src/tests随后原样提交为上方最终产品。`git diff --check` PASS。开发期间Phaser泛型与测试夹具/序号期待错误已修正；新真实收据序号为4/6，不把初轮检查写成全绿。

## 远端唯一下一步

root正常整合本分支（已含规则f46依赖）后，dot分别PC/竖屏真实新局连续普通弃牌两次，录完整眼神→同源候选→选留过程及候选停留3秒以上；检查七候选末位、部分选择/确认、触控和文字/原画可读。另核对快进、减少动态、后台/resize/退出、缺图与牌堆不足。主观强度、听感、物理设备和性能保持未验，不能用先前苏轼有限PC观察代签本包，也不写整体完成百分比。

## 第二次选留来源飞线最小修正

root回传远端dot在main `41aef038aede64ddf570bf325545c65333dbbe50` 的有限PC实玩观察：两次普通弃牌均自动发动，眼神各出现一次，三候选可点击，弃牌资源3→2→1、出牌次数保持4。第一次弃5♣，候选4♥／J♥／10♣，留J♥；第二次弃7♣，候选9♥／7♥／K♥，留9♥。两张留牌均在手，旧J♥归属保留。但第二次确认后，头像同时向旧J♥和新9♥发出轨迹。此处仅记录parent提供的观察，未收到独立录像或截图文件；本会话未运行浏览器。该PC观察不覆盖手机、音频或持续录屏。root主观只看到小绿点／细线，**粒子质感未认可，H17/P08继续in_progress，experienceAccepted=false**。

在独立分支 `fix/xin-retain-source-delta-20261018` 以该main为基线复现：共享渲染器将持续归属的旧／新两张牌一并传入`drawHeroOriginStream`，正好产生两路来源。产品 `b2c4d3ac432476e700d3f0d8fe06d18ea15fa7b9` 只分开两类临时展示ID：`targetIds`继续保留本场仍在手中的全部已留归属，`sourceTargetIds`只含本次真实保存新增的留牌；实际来源几何和飞线元数据都使用后者。选择刷新保留这组本次ID，移出手牌会过滤，缺少本次来源信息时传空组，不回退旧归属。其他英雄未传此字段时保持原路径，现有原生粒子样式／预算与规则、保存、原图、音频未改。

回归先出现3项失败（来源集合别名、真实保存后未提供本次来源、实际绘制仍收到旧牌终点），修复后定向**7文件45项PASS**：真实SavedRun＋实际GameScene方法完成两次各弃1张／3候选／留1张，第二轮持续归属两张而来源只含本次before/after手牌差集；共享渲染器用真实绘制函数验证仅新牌矩形进入飞线，原两张“已留”仍在，刷新时进度不重置，空来源清除飞线，未指定字段的默认路径保持。状态对数组复制，来源牌离手及缺少来源信息、七候选／普通对照／清理均通过。绘图节点和时间仍在Node中模拟，不代签修正后的动态体验。

命令：`npm exec vitest -- run tests/xin-repeat-sequence.test.ts tests/xin-seven-candidates.test.ts tests/hero-retained-ownership.test.ts tests/hero-target-attachment.test.ts tests/hero-attachment-facts.test.ts tests/hero-attachment-viewport.test.ts tests/hero-native-particles.test.ts`。`npm run build`类型检查与377模块PASS，产物`index-6T2L0kMR.js`，时间2026-10-18T09:02:31.786Z；构建元数据为41aef038＋dirty修正，运行源码随后原样提交为b2c4d3ac（其后只校正测试的20Hz步长期待）。`git diff --check` PASS。未跑全套、本地浏览器或CI。

交root正常合并此开发分支后，在同版远端dot重走上述两次各留一张：第二次来源应仅去新9♥，旧J♥继续保持归属；提供连续3秒以上过程，再补竖屏／触控／减少动态／后台退出。粒子强度与质感保持单独未通过，不以这次目标正确性修复签收。
