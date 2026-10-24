# 保存事件与技能计分演出接口

基线 `bab78be5be4bc6d8cdb9780ac8a4eebb69f697da`。GameScene 单 owner；音频侧唯一类型是 `src/audio/PerformanceAudio.ts` 的 `PerformanceAudioCue`，唯一入口是 `AudioEngine.consumePerformance(cue)`。本批不复制音频类型，不修改音频配方、HeroTargetAttachment 或粒子模块。

## 六人真实来源审计

| 英雄 | 已保存的真实事实 | 正确数字端点 | 当前缺口/本批状态 |
| --- | --- | --- | --- |
| 苏轼 | `amo.exile` 的实际弃余牌；历史助攻另读 `assist.ids` | 当前领域事件实际乘 M；不能按文案另造 total 运算 | 弃牌流已有专属呈现，音频 arrival 已统一；完整收回/共阶段动作仍待下一方案 |
| 秦琼 | 已保存押型与判定，胜利来源只读 `core.activeNewIds`；失败没有虚构新牌兑现 | 实际胜负事件的 M 乘法/减益 | 已统一保存事件描述；失败不当正向技能唱响，完整牌动作待续 |
| 辛弃疾 | 成功 discard/ChooseRefill 的 receipt 与实际 fresh kept IDs | 留牌本身不改 H/M；之后普通牌点到 H | 锁定/留牌激活已统一；持久 union 与本轮 sourceTargetIds=fresh 分开，候选揭示仍由视觉侧回调持有 |
| 刘娥 | `erxiangHandoff.targetId` 与精确 `erxiang.handoff` | 普通点数 **加 M** | 本批完整实际单牌动作样板 |
| 文成公主 | 已保存 `azaoCharge.release` 和实际 scoring/played IDs | 实际释放事件乘 M | 已统一保存事件与头像 rebound 回调；多牌载体动作待续 |
| 花蕊夫人 | 已保存 `xiemuBurn.cost`；实际 scoring/played IDs | 真实技能事件乘 M；金币成本不是额外计分 | 已统一保存事件与头像 rebound 回调；金币代价到牌组动作待续 |

审计依据为当前 `scoreR2.ts`、`HeroAttachmentFacts.ts`、`HeroPortraitScoreMotion.ts` 与 GameScene 实际队列。旧 standalone 编排器未接入，不据此宣称已使用；真实主链仍是 EffectQueue + Phaser TweenManager + 已采用弹簧。

## 时钟与身份

- `owner`：计分使用同一 presentation 对象；成功命令使用同 run/generation/signal 的临时 owner。
- `runId/generation/eventId/sourceId`：来自保存状态、EffectContext 和真实 ScoreEvent。`sourceId=event.sourceInstanceId`。命令激活使用成功保存的动作 ID。
- `targetIds`：真实牌实例集合。刘娥仅保存的 `erxiangHandoff.targetId`；牌点仅该牌；无牌端点的唐宋牌事件传空集合，不能用唐宋牌 ID 冒充手牌 ID。
- `beat/speed`：来自原有 ScorePhrase，Phaser TweenManager 应用 1/2/4 倍速。回弹回调只把 beat.impact 替换成该 Tween 实际剩余槽位；音频自行换算实际毫秒。
- `signal/replay`：同一 EffectQueue signal；回看仍传 replay=true，由音频消费但不发声。取消不排补声。

没有新增 timer、EffectQueue、AudioContext 或独立回弹时钟。`activate` 在已保存技能动作开始时；`impact` 在真实 arrival 同帧；`rebound` 来自真实视觉 Tween 回调；`settle` 只传真正 `finalScore` ID。单张牌收回不是 settle 奖励。

## 本批完整样板

刘娥 `erxiang.handoff` 是 `onCardScore/add-multiplier`，普通点数转为 **+M**。复用 JokerScoreStrike 的蓄势、飞行、旧数字碎片、新数字峰值、弹簧回弹；sourceCard 模式移动实际居中的牌容器，原父容器不变，所有原画/材质/附着子对象同行，独立 hit 不动。结束/取消恢复同一对象的原位置、缩放、角度和透明度。

该事件跳过竞争的 illuminateCard、头像 pose 和独立 payoff overlay。其 ScoreBeat 从整手真实顺序生成，仅这一已保存目标事件取得 strike/paired 槽位；其余事件的时长不被样板重写。4x 仍沿用既有 ≥50ms 双拍落点可见下限。

其余英雄接同一真实事件描述/音频入口，头像真实 rebound 回调也透传；本批不宣称其他五人的完整牌动作方案已经完成。普通 +M 不因 kind 标记而变成真实乘法；音频对 owner.score 再校验。

## 六人阶段候选联合接线

已顺序接入视觉最终依赖 `32eef8d5→0d5b5ea2→d5704748→6815d80f→25872095`。GameScene 创建 HeroTargetAttachment 时传入唯一 `onPhase` observer，内部苏轼 owner 共用该观察入口；不修改视觉模块配方。

观察快照保留在实际牌容器及当前匹配计分读数的 `heroAttachmentPhase` data 中，供同版短验核对。只有 `phase='source'`、full、同 generation/context、非空真实 sourceTargetIds、精确保存的正向 character ScoreEvent 才可申请 canonical activate；与 Scene 的技能开始回退使用相同 presentation/eventId，由 AudioEngine 消费去重。旧 ID、错误目标、纯 preview、无 context、负收益都不能因此生成技能声音。

`impact` 观察只记录真实到达，数字主击仍唯一留在 impactAccumulator；`settled` 是局部视觉清完，**不能**映射成音频 `settle`。suspended/resumed/attached/committed/cancelled 不变成新音符。候选/已留 preview 缺失 ScoreEvent 时不补造 eventId/context，锁定与留牌命令音仍只从成功命令调用。

## 与视觉侧的边界

遵循 `xin-energy-card-sample-2026-10-18/INTERFACES.md`：持久附着 union 是 `targetIds`，新一轮来源端点是 `sourceTargetIds=fresh`；旧留牌不能被重新点燃或重新发激活音。留牌音频使用 fresh retained IDs；激活使用保存 command ID，选择强调不发声。锁定音使用 `/xin-refill-lock`，留牌使用 `/laohuan-refill`，之后普通牌点使用各自真实 ScoreEvent ID。

候选揭示的视觉回调仍由视觉侧持有，本批不为每帧/每粒子/重新勾选候选补音。若后续需要独立揭示音，应从实际 reveal 回调使用 `/candidates` 和当时实际可见实例，不能提前泄露候选或复用锁定 ID。

## 旧调用去重

正向 H/M arrival 与真正 finalScore 已迁移到 consumePerformance，原同路径 scoreImpact/flight/常量 award 调用移除。数字到达不再额外 sourceCue('character')。保留的旧 scoreImpact/scoreRebound 仅服务没有 H/M 算术的既有唐宋牌来源反馈（如 retrigger/growth），不与本契约数字事件重叠。
