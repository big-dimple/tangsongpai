# 成功事件、目标、时序与生命周期接口

产品 `0d5b5ea2a684a1f3adb8a676aaf6d5284cdbe12b`；供父线程、音频原会话01a148ba、计分原会话01a147ec对接。视觉模块归本会话，GameScene由集成负责人顺序修改；本批不新增跨层事件总线、不各自改Scene。下表描述当前接口，不增加玩法、倍率或新的音频触发。

|阶段|可信成功标识／目标|现有调用与时序|
|---|---|---|
|真实弃牌已保存，眼神预备|`savedXinRefillLock(before,result)` 返回 `receipt.commandId+'/xin-refill-lock'`、`runId+'/character'`；拒绝失败／重复／跨run／旧seq／非真实弃牌|`XinRefillSequence.begin(...cue,context,reduced,eyeSlot,finish)`；眼神与弃牌动作并行，Scene等待160ms（reduced0），实际揭示前不携带隐藏候选ID|
|实际候选揭示|`pendingRefill.discardCommandId+'/candidates'`；`targetIds=pendingRefill.candidateIds`|`sequence.reveal(actualVisibleTargets,protectedPrint)` 返回眼部世界坐标，已有牌面揭示160ms，来源流260ms；`preview`用候选key、`confirmed:true`、`suppressSource:true`，避免又发一条头像流；`ignite`仅当前眼神仍active时为true|
|选中候选|同一个候选key及原 `targetIds`，只变 `selectedIds`|`preview({...draft,selectedIds})` 同key更新；现存尾迹厚度×1.25，无新发射器／无新收据／无音频事件|
|选留保存／自动全留|当前成功收据 `receipt.commandId+'/laohuan-refill'`；`fresh=after.handOrder-before.handOrder`，且属于本次实际留牌|Scene `appliedRefill.ids`保存本run／本stage仍在手中的旧已留与fresh并集；`sourceIds=fresh`。`preview`传 `targetIds=union`、`sourceTargetIds=fresh`、`label:'已留'`、`releaseReason:'laohuan.refill'`。保留 `shownPayoffs`去重；非成功不触发|
|持续附着|key仍为最近保存选留eventId，实际可见目标为union|`HeroSkillParticles.sync(...,{phase:'retained',igniteIds:fresh})`；旧牌属于targetIds但不属于本次来源。头像流有限≤420ms，起势仅最初两个出生；持续粒子由Phaser原生delta推进，不作为计分或音频节拍|
|留牌真正计分到达|`retainedRefillImpact(event,appliedRefill.ids)`：真实ScoreEvent为card／rank-／onCardScore／add-heat／depth0／非零／同target|Scene现有arrival后 `process.arrive()`，随后 `impactRetainedCard(targetId,event.eventId,context)`；先移除该牌持续层，再240ms有限收束，Scene同时从appliedRefill.ids删除。此事件是普通点数，不是新英雄倍率|
|刘娥单目标保存兑现|`savedHeroAttachment(trace,'erxiang')` 给 `event.reasonKey='erxiang.handoff'`、`event.operation='add-multiplier'`、`targetIds=[trace.erxiangHandoff.targetId]`|`retainTargets(cue.targetIds)`→`commit(cue.event.eventId,context)`→真实arrival的 `release(cue.event,context)`；默认单目标必须eventId／targetCardId／reason均匹配。只审当前契约，不改她的视觉配方或规则|

`targetIds` 永远是牌实例ID，不能用rank、花色、槽序号、选中索引替代。`sourceTargetIds:[]` 表示没有本次来源终点；`undefined`保留其他既有调用的默认全部来源。第二轮例：旧J♥＋新9♥均持续，但source／起势只能去新9♥。无候选的自动全留也来自成功收据及真实hand差集，不能在视觉层重抽或推算。

音频负责人审同一成功事件的现有 `sourceCue`、scoreImpact、rebound去重／封顶／取消；候选key、选留成功ID和后续ScoreEvent ID是三个不同语义阶段，不可按rank合并，也不能把每粒、每帧、选择强调当新音频事件。计分负责人复用现有ScoreEvent与arrival Promise，来源→目标数值→回弹沿同一eventId推进；视觉不重算事件value、倍率或到达时刻。慢帧也等实际packet arrival，不新增独立sleep猜时。

## 取消与资源所有权

- `EffectContext {generation,signal}`由EffectQueue拥有。clear切代并abort；source、candidate stream、有限收束都沿同一signal取消，异步回调须查signal／token。失败保存无眼神／无附着；同收据重试／duplicate不能重播。
- `HeroTargetAttachment`只持UI临时状态。sourceKeys／ignited负责同owner的来源与起势去重；`preview(undefined)`／clear结束当前状态，`destroy`移除监听器。它不写存档、不把冷恢复变成新发动。
- full持续→隐藏／失焦／离屏／reduced时销毁原生发射器；返回只恢复当前静态或持续表现，不补发来源。牌销毁移除两层；Scene shutdown销毁owner／更新列表；不延迟主流程保存或输入。
- 辛每牌常驻最多9粒；计分先释放常驻再有限9粒，避免同目标18粒；最多8目标72，Scene共用128预约。两张64×32原生缓存纹理共用。d570时其他默认英雄总池硬门待审；后续6815d80f统一修复及边界见下节，仍不宣称六英雄观感已验。

本批自动测试通过只是软件接口证据；远端dot仍须核对真实发动、牌归属、实际arrival、三秒持续强度、reduced和取消。详见 [README.md](README.md)。

## 六英雄共用阶段回调6815d80f

后续产品 `6815d80fc06a4d251f1f9bf6f16b749c2b896cc6` 依赖d570，已统一修复默认五人总池停发并提供 `HeroTargetAttachmentOptions.onPhase?: HeroAttachmentPhaseObserver`。该选项由target owner传给内部苏轼弃牌owner，不需要另建总线或在GameScene为每人再复制一套调度。完整软件证据见 [共用生命周期](../hero-particle-pool-lifecycle-2026-10-18/README.md)。

```ts
type HeroAttachmentPhase = 'committed' | 'source' | 'attached' | 'impact'
  | 'settled' | 'suspended' | 'resumed' | 'cancelled';
// options.onPhase(event): void
// event: owner, activationId, eventId?, reasonKey, targetIds, sourceTargetIds,
//        motion, context?, phase, cause?
```

`owner`为 `card`／`discard`／`retained-impact`，用于区分辛的长期持有状态与后续真实普通点数的有限爆发。快照及两组ID数组冻结；`context`若存在就是原EffectQueue的generation／signal。回调同步观察，不await、不写数值、不调音频；未提供observer时不创建阶段binding快照或额外abort订阅。消费者用原音频／计分owner按同eventId接入，不添加独立计时器或引擎。

|phase|触发与消费者边界|
|---|---|
|committed|成功ScoreEvent的commit或苏轼bindSaved后一次；原始preview没有这一阶段。回调本身不访问store、不证明一笔新交易|
|source|当前owner真的开始已有来源流时一次；无来源、suppressSource、reduced或隐藏后不伪造。辛眼神本身仍由原Scene／XinRefillSequence负责，不由此另播|
|attached|实际目标层已挂载后一次，可为full或静态；targetIds是该owner当前挂载的实例子集。它不证明浏览器像素已可读|
|impact|一般目标只在精确匹配的release；苏轼只在实际arrival Promise完成；辛只在Scene传入真实普通计分eventId。普通点数不变成新英雄倍率|
|settled|一般release完成，苏计分收束清完，辛有限爆发的原生complete；最后一张辛持有牌被消费时，card owner会先结束，再由retained-impact owner报告实际爆发|
|suspended／resumed|隐藏／减少动态的实际可用性变化，按切换发布，不能当新发动、重复音效或新计分。苏隐藏直接结束当前弃牌呈现，无迟到恢复|
|cancelled|当前视觉owner被clear／替换／abort／destroy等结束；携cause，不代表撤销已保存的玩法结果。取消后没有晚到impact／settled；回调内取消也不会让同帧继续建池／流线|

除可用性切换外，每个owner／activation各阶段最多一次；重排／同收据刷新不重发。候选和已留的纯UI preview不带ScoreEvent，`eventId`／`context`可缺；`activationId`仍使用前文真实成功动作key。**不能补造eventId或把它送进计分接口。** 辛此类状态继续由Scene的fast-forward／clear／销毁入口显式取消；不能传一个不拥有它的signal后声称自动取消。有限计分爆发则绑定真实ScoreEvent context。

`reasonKey`在来源／待判期可为既有选择器前缀（例如 `touye.`），不是胜利断言；impact携真实release的 `touye.won.*` 或 `touye.lost.*`。获胜目标只取core.activeNewIds，失败保留待判新牌用于失败淡出；音频／计分按实际ScoreEvent查值与结果。GameScene由01a147ec顺序加这一选项并沿原arrival接口推进，01a148ba接原音频去重／封顶／取消；本分支不修改两者实现。
