# 真实来源牌与统一阶段样板

状态：开发候选，P08 仍为 in_progress。基线 `bab78be5be4bc6d8cdb9780ac8a4eebb69f697da`；本批不合 main，不操作 CI、部署或域名，不启动本地 browser。

音频依赖原提交 `0fbca930211ee0ea460c640bd76c8a22e5de66cd` 与证据 `f08b1f03485c5f68c547db94c6d256d068d9e395` 已顺序接入本分支（本地对应 caaf3b69/482fe48b）。整合者若已采用原提交，仅取本批 GameScene/样板提交即可，不重复叠加音频。

视觉最终依赖原链 `32eef8d5→0d5b5ea2→d5704748→6815d80f→25872095` 已完整接入（本地20861f58→dfb57f42→38b24c0d→cd26f98b→9a2ada20），没有逐文件复制旧 Scene。本批自身首笔为 `599a41a8`；后续补 GameScene 的六人 observer 接线及旧测试壳新接口断言。最终 HEAD 以普通 dev push 回执为准；已取原依赖的整合者只取本批自身两笔，避免重复 cherry-pick。

## 已实现

1. `ScorePerformance` 只投影真实保存事件、来源和牌实例，使用音频侧唯一 PerformanceAudioCue。EffectQueue/ScorePhrase/Phaser TweenManager 保持原有时钟。
2. 正向 H/M 数字 arrival、真实 Tween rebound 和最终 finalScore 统一接音频入口，去掉相同路径的旧发声；成功换牌锁定/留牌使用独立成功动作身份，空英雄检查不再通用唱响。
3. 刘娥真实单牌 +M 完整样板：实际牌先蓄势→向 M 飞行→旧字碎裂、数字更新→弹簧回弹→同对象归位。不是额外乘法，不改领域算术、规则、保存或事件顺序。其材质/附着保持原子对象，hit 固定。
4. 六英雄共用 onPhase 已由 GameScene 单入口观察，真实保存正向来源可申请同一 activate；preview/attached/suspended/resumed/cancelled 仅记录，局部 settled 不变 award。数字 impact 保留唯一 arrival 点。三个旧 Scene 测试壳已按新消费接口和受控 speed 补齐，保留原顺序/可见性/持有并集断言，并新增真实动作 ID、fresh 目标及旧 sourceCue 零调用断言。

接口、归属和其他五英雄未完成部分见 [INTERFACES.md](INTERFACES.md)。

## 验证与边界

- 新增真实保存事实与实际容器受控组件测试：六英雄来源语义、伪造/跨 root/零值拒绝，1/2/4x，M 到达前不更新/不碎旧字，数值首个可见帧峰值，windup/flight/hold/rebound/hidden disposal/shutdown 取消及迟到更新无效，原对象/子材质/父容器/hit 恢复。
- 最终联合版本相关 **27 文件、261 测试通过**，类型检查与生产构建通过，日志见 tests.txt/typecheck.txt/build.txt。包括同一真实 Tween→ScorePerformance→AudioEngine 准入联测：arrival 前零主击，首击一次、实际回弹一次，1/2/4x 间隔均 ≥50ms；取消后不能补播，以及六人真实保存观察身份、3秒原生池持续与取消。构建383模块，仅保留既有大 chunk 提示。
- 本地无 browser、无试听、无物理设备验收。组件替身不代表像素、布局、最终音画同版或听感通过。

## 远端短验入口（待执行）

`remote-erxiang-checkpoint.json` 是 makeCheckpoint 生成并 readCheckpoint 验证的正式导入包；`saved-facts.json` 是同一合法动作生成的真实 ScoreTrace 与 1/2/4x 时序投影。不存在自造 ScoreEvent。

1. PC 1366×768、390×844、320×568、844×390，导入本目录 checkpoint；选 `spades-8/hearts-8`，将刘娥目标设为 `spades-8`（已保存前的 UI 草稿），正常出牌一次；快进/减少动态另用同一包独立导入。
2. 观察真实 `erxiang.handoff`：仅该目标牌蓄势，向 M 而非 H/total；M 在 arrival 才更新，首击/回弹与真实阶段一致，牌和附着完整归位。对照 saved-facts 中 before/after 与 finalScore。
3. 1/2/4x 各一次；蓄势/飞行/停顿/回弹分别快进，另测隐藏与重进。不得残留位移、隐藏数字、碎片、迟响或重复 award。
4. 回看保持实际保存顺序与最终值，静音；减少动态保持清楚静态来源/结果，不飞牌或二次回弹发声。无有效技能/空目标时没有样板动作或激活音。
5. 这是受控样板验收，不是自然获取、整局、其他五英雄完整动作、主观听感或物理手机通过。
