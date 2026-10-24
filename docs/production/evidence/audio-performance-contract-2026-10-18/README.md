# 同一事件的音频消费与首击包络

产品提交 `0fbca930211ee0ea460c640bd76c8a22e5de66cd`，基线 main `bab78be5be4bc6d8cdb9780ac8a4eebb69f697da`。开发分支 `dev/audio-performance-contract-20261018`，供音频、计分与视觉联合审查。本包不直接合 main，不修改共享计划。

已读取视觉样板 `d57047488dce447578fcfbc5f61702609a552462` 的 [接口原文](https://github.com/big-dimple/tangsongpai/blob/d57047488dce447578fcfbc5f61702609a552462/docs/production/evidence/xin-energy-card-sample-2026-10-18/INTERFACES.md)，并与计分原会话约定以下唯一音频接口。GameScene 接线归计分负责人，本包不修改场景或视觉文件。

## 接口与阶段

`src/audio/PerformanceAudio.ts` 导出 `PerformanceAudioCue`；现有 `AudioEngine.consumePerformance(cue)` 直接消费真实表现回调。只有一个 AudioEngine、原有 Voice 所有者与已有 EffectQueue/Tween 时钟，无新增播放器、时间轴、音频重播定时器或事件总线。

必填：`owner / runId / generation / eventId / sourceId / targetIds / phase / beat / signal / replay`。可选 `speed:1|2|4`（默认1）、`kind:'add'|'key'|'multiply'`、`tier`、`chain`。

- `owner` 必须稳定：计分时使用含完整 `score:ScoreTrace` 的同一个 presentation 对象；成功命令动作使用同代临时 owner。它不能是每次回调都新建的 `{}`，也不能跨代重用。若 owner 含 `state.runId/runId/generation`，与 payload 必须一致。
- `eventId`、`sourceId` 对计分必须来自真实 `event.eventId/sourceInstanceId`，且事件 rootId 匹配 owner.score。sourceId 不是 definitionId、rank 或视觉槽位。牌目标始终是真实实例ID。
- `beat` 结构兼容 `ScoreBeat`，包含未除速度的 `windup/flight/impact/rest` 及可选 phrase；音频窗口取 `beat.impact / speed`，不能由调用方先除后再传 speed。phrase 的 paired、accentWeight、notePulse/pulse 复用现有演出，不另算玩法数值。
- `phase:'activate'`：仅已保存的发动/揭示/选留事实，使用轻主体和纸声，不调用乘法或胜利配方。候选选择强调、每帧、每粒均不调用。
- `phase:'impact'`：只接受真实正向 H/M 变化。按保存算术纠正 kind，普通 `+M` 即使误标 multiply 也不使用鼓或玻璃乘法层。所有者、代次、信号及来源/目标集合固定，重复阶段消耗一次。
- `phase:'rebound'`：只由真实回弹回调调用；没有准入首击就没有第二声。孤立回弹不占用后续合法首击，目标/来源/代次不符不能偷用已准入的回弹。第二声保留首次音高与权重。
- `phase:'settle'`：只有真实 `phase==='finalScore'` 的 eventId 才进入原有 award 配方；局部来源归位的 settle 静默，不把每张牌收回都播成奖励。不要再传常量 `'award'`。

调用同一路径后必须移除对应旧 `sourceCue/scoreImpact/scoreRebound`，避免重复发声。旧 API 继续兼容尚未迁移的路径；本包不会自行覆盖 GameScene。

## 辛弃疾与刘娥边界

辛弃疾弃牌成功锁眼使用 `receipt.commandId+'/xin-refill-lock'`；实际候选揭示用 `discardCommandId+'/candidates'`；成功选留用 `receipt.commandId+'/laohuan-refill'`；后来留牌普通点数使用自己的真实 ScoreEvent ID。这些是不同成功事实，不能按 rank 合并。锁眼阶段不泄漏隐藏候选ID；同候选key的 selectedIds 变化不产生新声音。

同一事件的 `targetIds` 集合固定，可换数组顺序，不能在回弹时换成另一张牌或选中子集。遵守视觉合同的真实 union/fresh 归属；音频不从粒子出生或目标 rank 推算事件。留牌收益仍是普通点数，不新增英雄倍率。刘娥使用真实 `erxiang.handoff/add-multiplier` 与单个目标牌，保持 `+M` 的声音语义。

## 配方与生命周期

已收录的新加坡五声、战鼓和寺钟样本继续由原有采样器使用，素材字节和 BGM 清单未改。乘法首击的玻璃标为 transient，鼓体标为 body，分别压缩包络：配对玻璃最大45ms；鼓体沿用原普通乘法140ms主体窗口，并受实际 impact 窗口约束。短于窗口的音符仍保留现有35ms采样下限。这些是候选播放参数，不是听感批准或新验收指标。

回弹仍为已有较轻、较短木质层，实际回调才播放。缺战鼓但玻璃已解码时保留玻璃并复用已采用的有界合成主体；缺样事件不排队，迟到解码不补播。音高、五声走向和权重继续沿用 phrase，不能随着长链无限升高。

计分声部6、名义增益总和0.12、效果声部16的原上限保持；新增发动配方也走同一个 numeric admission。每owner最多1024个事件记录，使用WeakMap，无音频调度队列。

AbortSignal、快进取消、切场停止拥有的尾音与未兑现回弹；取消后旧owner失效。静音消耗已经到达的阶段，不会在取消静音后补播；同一正常演出的未来不同事件仍可发声。新局用新owner和新signal。减少动态由视觉是否存在真实回弹及 phrase.paired 决定，本包不读取或重置音乐/减少动态偏好。

## 已验证与未验证

- **PASS**：9个定向音频文件 **159项**，原始 [tests.json](tests.json)。包括现有六英雄受控保存事实（含旧局身份夹具）、刘娥真实 +M、辛弃疾选留不伪乘法、正确 final event、实际回调/无timer、重复/错run/错generation/错source/错target/错signal、1/2/4速度包络、首次音高权重缓存、取消/切场/后台/静音/回看/零窗口/缺样不补播、未来事件恢复、密集共享封顶和所有者清理。
- **PASS**：`tsc --noEmit`、Vite生产构建380 modules、`git diff --check`、场景/领域/素材保护范围无差异。既有大chunk警告保留。
- **NOT_RUN**：GameScene与视觉的联合版本、真实原生Tween到音频的时间观测、浏览器、实际听音、物理设备及低频可感知性。本包不声明六英雄完整体验已验收，不把受控单位夹具算自然获得/真人听感。

构建 [build-info.json](build-info.json) 如实保留构建时基线SHA与dirty。检查源文件的LF归一化SHA256及产品提交绑定见 [report.json](report.json)，不是把旧构建信息改签成新SHA。初次检查的夹具/断言修正也在该报告中保留。

定向命令：`vitest run tests/audio-performance.test.ts tests/score-melody-audio.test.ts tests/score-recorded-audio.test.ts tests/audio-mix-policy.test.ts tests/audio-sample-loading.test.ts tests/audio-music-lifecycle.test.ts tests/audio-preferences.test.ts tests/fire-audio.test.ts tests/failure-audio.test.ts`。联合验收需在计分负责人接线后同版本进行：六英雄正确来源和目标、普通 +M/留牌负例、首击/回弹回调、1/2/4速度、快进/取消/静音/重开，并保留真实播放记录与人工听感结论。
