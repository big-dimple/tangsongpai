# 音乐过渡与真实下一曲准备

分支 `dev/music-filter-transition-20261017`，基线为已只读核对远端一致的 main `9fe60fc581227829df6caadc712a5bd0fed74bc4`。本批是待整合候选；P08 仍 in_progress。被测产品源码归一化 LF 的 SHA-256 在 [report.json](report.json)，构建标记在 [build-info.json](build-info.json)。

## 新加坡建议的真实落地点

核对的是上述 main 的生产调用，以及保留来源 `ca843a64b02cb630e52a691abb055b6f40aeae76` / `fbb614a84087060c99e8973c118a473771448984` 的模块；没有用文档或原型测试床代替生产接线。

| 范围 | main 的实际入口及范围 |
| --- | --- |
| 指定 BGM | `GameScene.create → AudioEngine.setScene(table/boss) → getTrackForScene/startMusic`，分别到 Tang-Song Cyber Groove / Stranger Things；Shop 的 Boss 备战也调用 boss。菜单阳关、商店舒伯特、成功醉渔保留。当前是场景单轨与两个 slot 交叉淡入。 |
| 指定 7 个 SFX | `GameScene.impactAccumulator/呈现来源 → AudioEngine.scoreImpact → FOLEY`：普通数字到达按 phrase.pulse 选五声；实际乘倍率走战鼓/玻璃；`GameScene` 最后 award 走编钟，按实际总分档叠层。`scoreRebound` 是来源回弹回调，不是单独定时器；Intermission 的普通 success 音仍是原配方。 |
| 合成回退 | `AudioEngine.synthScoreFallback` 已接 `scoreImpact/scoreRebound` 的整族采样缺失分支，复用现有 context/voice retain-release。不是直接启用历史 `PentatonicSynth` 的第二引擎。 |
| 弹簧与倾斜 | `GameScene.renderJokerRack → mountOwnedJokerIdle → OwnedCardTilt → SpringCardTransform/Spring1D.step` 已真实运行；仅实际持有唐宋牌的内层倾斜。计分回弹仍用 `inkwaveSpring` 的既有曲线，普通扑克用 ScorePosture；没有把所有牌和按钮换成新物理系统。Shop 未调用 mountOwnedJokerIdle。 |
| 微停顿与节拍 | `GameScene.showScoreEvent → prepareJokerScoreStrike.fly/land`，时长由 `scorePhrase → jokerStrikeBeat` 合成；同一可取消 tween 内有 40/50ms 局部 hold。OwnedJokerIdle 消费 scoreHitStop 时令倾斜 dt=0。没有全局暂停规则/输入/保存。ScorePhrase/EffectQueue 原已按 trace 顺序运行；历史 HitStopManager、第二 timeline/ScoringRhythmOrchestrator 未接入。 |
| 低通/嵌套层 | 基线 main 确实未接入：音乐 gain 直接到 master；没有 AudioFilterTransition/getAudioContext/attachMusicFilter 的生产调用。本批补上，见下。 |
| 仍未做 | 历史 CardTiltEffect 的整张 DOM 3D 透视/移动镜面不在生产调用；恒定案几、跨场景景深仍是后继。不能把当前随身牌 2D 倾斜、局部撞分与薄烟签成完整动态体验完成。 |

## 本批正式接线

- `AudioEngine.enableAudio → MusicFilter.attach`：`music gain → 唯一低通 → master`；SFX/UI 继续直达 master。沿新加坡 450Hz / 20kHz、0.35s / 0.28s 思路；快速逆转从实际包络位置续接。设备滤波创建失败时保留原直连，不能因此无声。
- `ShopScene.create` 取得独立音乐层，shutdown/destroy 幂等释放。`main → installMusicModalStack` 按实际原生 dialog 身份跟踪详情、原图放大、菜单与战前目录；先取得替换层再释放旧层，复用同一详情节点不会重复计层，子层关闭不恢复仍有父层的音乐。没有改共享 DetailDialog/CardArtZoomModal。
- 全层退出回清晰；新局取消保留仍打开的菜单层，确认新局则随实际关闭恢复。Game destroy 断开 observer、清空层级、停止音乐/音效并移除应用音频手势/可见性监听，旧事件不能唤回声音。
- 修实原 `preloadSceneMusic` 的空提示：沿同一最多两个原生媒体 slot，暂停的下一曲设置真实 src / preload=auto / load；不创建音频 context、不 play。第一次播放优先复用匹配的已准备元素及缓冲，两个 slot 都在交叉淡入时将提示延至旧 slot 退场。选角提示商店；商店按实际下一场准备 table/boss；牌桌闲时准备商店。没有预读未来胜败或隐藏牌序。
- 音乐 0、静音、后台、新开场会释放未使用预载；save-data / 2g 不做推测预载。暖机错误没有自动重试环；实际播放沿既有手势恢复、8s 播放期限与有限曲目失败预算。曲目、资源字节、30%/80%默认与已有设置不变。

## 真实动态与音频证据

[连续原生流程视频](native-flow.webm) 含商店→详情→全屏原图→返回→暖场目录→牌桌→菜单→新局取消/确认。另有同段实际 post-compressor/ceiling [混音录音](actual-music-and-ui.webm)；录音区间与步骤的 performance.now 时间在 report，视频和音频为独立捕获，不宣称逐帧同步。没有生成或替换音乐素材。实际静帧及视频抽帧仅作内部像素检查，交付保留动态证据。

Windows / Node v22.20.0 / Chromium 153.0.8010.12。`heard=false`；真人听感、扬声器/耳机和物理设备为 NOT_RUN。

| 检查 | 实际结果 |
| --- | --- |
| 定向单测 | PASS，12 文件 132 项；首组 9 文件 92 项、混音/失败/火声 3 文件 40 项。包括预载前无 play、同元素无 load 重置、交叉淡入后的延迟准备、省流、预载失败/0音量/后台/新开场清理。 |
| 类型 / 构建 / 差异 | PASS，tsc --noEmit；生产 e2e build；git diff --check。未改 GameScene、领域/存档/经济、FOLEY/曲目及资源、共享鉴赏模块。 |
| PC 原生 14 步 | PASS，深度 1→2→3→2→1→0；全部退出回20kHz。菜单 Escape、快速开闭、新局取消/确认与销毁通过，3 案例无 pageerror。 |
| 实际音乐路由 | PASS，music→filter→master，music 无旁路，SFX/UI 直连。450Hz 时 4kHz 响应 -38.37dB，回清晰约0.01dB；同一 context、最多2 slot。 |
| 手势前准备 | PASS，context 尚未创建、play 调用为0、媒体暂停，菜单曲已有267.562秒缓冲；这证明实际请求，不是暖机函数空跑。 |
| 选角→首店 | PASS，1279.4ms 时商店曲已静默缓冲53.234s；1668.3ms首次播放复用同元素，已有完整217.939592s缓冲。Shop 初建不会用下一桌面提示覆盖这首即将播放的曲目。 |
| 390 首次入场 | PASS，1442.6ms 时仍在商店，下一桌面曲 readyState=4 / 已缓冲41.739116s / play=0；1677.4ms首次 play 时同元素、同2次 load、相同完整缓冲、最多2 slot。首次入场没有才从零发起媒体资源请求。 |
| 生命周期诊断 | PASS，音乐0严格暂停；恢复/后台回前台仍保留详情层；销毁后 depth=0 / context suspended，点击和可见性事件不重开声音。此项是受控 API/销毁诊断，不冒称物理后台测试。 |
| 滤波不可用 | PASS，受控首次 createBiquadFilter 抛错，原菜单曲仍真实播放、音量0.3；无 pageerror。 |
| 录音可用性 | Opus / 48kHz / 立体声 / 7.09s；ffmpeg volumedetect 均值 -36.2dB、峰值 -12.1dB。只证明有有效混音与有界电平，不签音色或响度审美。 |

首次两轮浏览器脚本使用了过期的流程假设：未点击暖场目录便等待全层退出、未展开折叠菜单便点隐藏入口。已改走真实入口；产品滤波在这两处均符合实际打开层。原 FAIL 报告保留为 [战前目录](failed-before-stage-entry.json) / [折叠菜单](failed-before-menu-dock.json)。新增预载测试还发现首曲启动会覆盖已准备的另一曲，已修成优先保留暖机 slot，最终回归通过。

## 下一步与遗留

先由父级整合本候选，再与计分演出线程的当前版本合核一段真实连续动态视听；本批不改其编排。之后才按统一计划推进恒定案几/景深切场，不能用新文档数量代替画面变化。

弱网/省流可使浏览器忽略推测预载，仍按正常手势播放与失败恢复，不保证任何设备首次无等待；本批只证明上述本机实际请求/缓冲。主观音乐过渡重量、长局疲劳、整体验收与 P08 正式门仍待人验。没有 main/CI/部署操作。

## 2026-10-18：几秒循环与未听到战鼓的进一步核对

用户进一步实测后，不能再用文件45.7秒证明实际播放正确。三层事实及窄测试记录在 [runtime-triage](runtime-triage-20261018.json)：

1. **文件长度**仍是45.714秒，没有源码 loopStart/loopEnd 子区间。
2. **播放器实际回跳**尚未观察。main9fe 与候选各用4个窄案例（字面导入各自源码）检查 shop/boss 重绘同名setScene、UI声、预载、unlock、暂停恢复；模拟媒体没有 seek/src/load 重置。此结果不证明现场没有重播，不能据此否定反馈。
3. **素材内部短乐句重复**已确认：84 BPM 的同一8音琶音每1.428571秒重复，16小节共32遍；鼓型每2.857143秒重复，固定铺底只有声像/延迟及11.428571秒LFO变化。实际MP3的相应频谱周期相似度约0.985。不是整段PCM完全复制，但“几秒一直同一乐句”的感受有直接素材依据，仍需要真正有发展段落的长曲。

战鼓只有真实保存的 ×M 事件才走 `scoreImpact(kind=multiply)`，普通加倍率及最后H×M不算。当前原0.797秒战鼓会截为非配对140ms、配对最多45ms，名义增益0.028再乘phrase强弱；该行为不能签作听感足够。**已确认且最小修复的缺口**是：只要玻璃已解码，旧 `recorded=any layer` 会掩盖未加载/失败的战鼓家族，导致仅玻璃、没有战鼓或回退。现在仅在战鼓家族缺失时先走既有合成body，再保留可用玻璃，沿原6声部/0.12增益预算、AbortSignal和不迟到补播合同；不新增素材/Context/音量值。该缺口原已存在于main9fe，不是新预载引入；尚未证明用户那一手正好命中此条件。手机低频缺失仍只是待验假设。

把新缺家族回退要求直接对固定main源码运行，得到3通过/1失败（预期1次回退，实际0次），[保留原RED报告](main-drum-regression-red-20261018.json)；main文件未改。新候选实际通过3文件60项、类型检查与362模块生产构建；缺家族密集/静音/取消回收、样本齐全优先、不迟到重播均有定向断言。首次新夹具遗漏Q的原生参数方法导致1项失败，修夹具后通过，未对产品放宽断言。**本轮没有运行本机浏览器或试听**，原 e6 视频/录音不算新修复的运行验收。

### 给dot远端的最短运行观察

可在已有远端Playwright/CDP页、应用bundle执行前注入 [music-runtime-observer](../../../../harness/music-runtime-observer.mjs)，然后重新载入一次。它不调用play、seek、调音量或发额外音频请求；70秒后自动恢复所有包装，最多5000条记录。这里只做了语法检查，远端运行仍待执行。

```js
import {installMusicRuntimeObserver} from './harness/music-runtime-observer.mjs';
await page.addInitScript(installMusicRuntimeObserver);
await page.reload();
// 沿原生页面继续已有Boss备战存档；不要修改领域状态。
// 完成下列短观察后导出结果：
const report = await page.evaluate(() => window.__stopMusicRuntimeObserver());
```

- 先在Boss备战闲置10秒，再用约20秒切商品tab、开关详情；进入该Boss后等到跨过一次完整文件边界，总观察约60–70秒。用 `__markMusicRuntime('idle/tab/detail/enter-boss')` 标记动作，保留页面构建SHA。
- 看 `media:tick` 的 **id/src/duration/currentTime/loop/paused/readyState/networkState/error/buffered**；结合 `set:src`、`set:currentTime`、`call:load`、seeking/emptied/error与context/visibility事件。时间持续但琶音每1.43秒相似是内部乐句；未到duration便回跳则是另一个播放器/加载问题，应连同触发事件回传，不能以本地单测否定。
- 用一手本局已持来源实际触发 ×M，并从本局导出/回看保存事件确认operation及M前后值；若没有真实乘倍率来源则记未触发，不用“最终H×M”冒充。看 `sample:response/decoded` 是否先有战鼓、`sfx:start` 的战鼓URL/offset/rate、`synth:start` 的低音回退及route中gain/filter自动化；同一source id的 `sfx:stop` 可识别计划尾音与提前取消/抢占。

集成告知：没有在窄测试中复现阻断级播放器回跳；真实client播放仍pending。新增战鼓缺家族修复可连同原音频候选整合，但完整音量/低频可闻性、真实动态与长曲需求仍未签，不把工程通过写成“用户听感已修复”。
