# 六英雄共用粒子池持续性与阶段接口

依赖完整辛弃疾候选 `d57047488dce447578fcfbc5f61702609a552462`，开发分支 `fix/hero-particle-pool-lifecycle-20261018`；产品 `6815d80fc06a4d251f1f9bf6f16b749c2b896cc6`。仅交父线程审查／开发预览，不合 main、不部署、不打开本地浏览器。H17/P08继续 `in_progress`，体验未验收。

## 修复与保留

真实Phaser3.90复现基线：同一个六人测试，辛通过，其余五人的3秒后有效粒子采样全部为0，5 FAIL／1 PASS。`maxParticles=7/9`在复用dead前被alive＋dead总池硬门挡住。共用默认配方改为 `maxParticles:0`，仍以 `maxAliveParticles:7/9` 和原生 `dead.pop()`限制实际总分配。辛既有3＋6保持，未调所有人的颜色／尺寸／速度／频率／混合、形状配方或文本。修复后有限火花仍450ms停发并自行清完，边缘流持续；一次到达的爆发仍有限，不把火花改成永久烟。

逐帧检查的是每个发射器 `getParticleCount()`（alive＋dead），不是只看alive。默认每目标最多7火花＋9边缘，8目标总预约128；火花结束后边缘池最多72。辛每目标3＋6、8目标72；所有owner共用同Scene128预约。清完后另一个8目标owner能重新取得全部128预约。无新纹理、素材、引擎、RAF或音频系统。

减少动态会关闭未结束的来源窗口，返回只恢复当前附着，不重新发动。隐藏／离屏由原owner停止；苏轼隐藏结束已绑定弃牌呈现，其他持有目标可静态／持续恢复。原生生命周期、世界矩阵、文字／非目标死亡区均保留。

## 真实目标审查

|英雄|实际目标与结束条件|本批受控收据检查|
|---|---|---|
|苏轼|`trace.amoExile.discardedIds` 的独立代理；非主手，也非随便找一张K。计分arrival才收束，随后代理清理|当前身份，合法对子＋实际弃余6张；其中一个原牌在800ms销毁后，代理仍按该ID持续至实际arrival，不粘到主手|
|刘娥|`trace.erxiangHandoff.targetId` 唯一牌；eventId／targetCardId／reason匹配才释放|当前身份、真实合法对子、唯一目标；错误保存eventId不触发impact|
|文成公主|真实蓄势命令后 `trace.sets.activeScoringIds`（既有空集回退playedIds）|先真实蓄势再真实释放；4张实际计分牌，非剩余手牌|
|花蕊夫人|实际付费保存事件的活跃计分牌，同样保留既有回退|当前3金档真实付费，4张实际受益牌；不把金币或UI旁牌当目标|
|秦琼|待判是本次refilledIds；胜后收窄为core.activeNewIds；输时保留待判新牌做失败淡出，不伪造正收益目标|实际押三条／补2张，胜后只有新clubs-8；另测失败reason、原待判2ID与到达清理|
|辛弃疾|旧已留＋新已留union持续，来源／起势只取本次fresh差集；首次真实普通点数arrival收束|沿用d570完整样板；本批再核真实选留、普通计分到达及其独立有限爆发生命周期|

六人的运行时配方保持原有身份：苏青蓝烟与既有斩切、刘蓝焰、文金色花瓣、花橙色焰屑、秦蓝紫旋纹、辛绿墨尾。这里表示原代码色板／形状归属被保留，不能当主观六人视觉质感已合格。

## 软件验证

新增 `tests/hero-native-pool-lifecycle.test.ts` 共29项：六人独立原生池3800ms；六人手机8目标容量3800ms；六人真实SavedRun PC目标3600ms与手机3600ms后取消；秦失败契约；早期减少动态／隐藏返回；3项在阶段回调中取消防止同帧复活。PC／手机实际目标分别逐ID检查3秒后的有效样本，不用一张有光掩盖其他目标消失。

独立池1280×720；容量390×844 DPR2；受控收据PC1180×844 DPR1、手机390×844 DPR2。当前身份、公开手牌／牌堆分区和40金是**明确受控前置**；发动、蓄势、押注、付费、选留及最终保存均走真实命令和SavedRun，checkpoint可恢复。不能写成自然完整通关或供应平衡证据。六人共同新用例执行WebGL分支的真实发射／池／回收；既有Canvas色板与辛双renderer阶段检查一并保留，不宣称其余五人Canvas真实画面已验。

原生对象包括ParticleEmitter、Particle、EmitterOps、Frame、Container、Image、Graphics、Zone、DeathZone、DisplayList／UpdateList；场景／纹理管理器／字体边界是测试壳，无浏览器／GPU／真实字体像素。辛的纯preview已留状态沿现有Scene取消入口显式 `clear()`，不会凭一个不属于它的abort signal自动清除；其余已commit／苏绑定收据使用已有EffectContext取消。此边界已写在接口中，不能隐瞒。

```powershell
npm exec vitest -- run tests/hero-native-pool-lifecycle.test.ts tests/hero-native-particles.test.ts tests/hero-attachment-facts.test.ts tests/hero-target-attachment.test.ts tests/hero-attachment-viewport.test.ts tests/hero-retained-ownership.test.ts tests/sushi-discard-local.test.ts tests/sushi-discard-visibility.test.ts tests/sushi-discard-origin.test.ts tests/sushi-lempo-slash.test.ts tests/xin-formal-card-sample.test.ts tests/xin-native-emitter-runtime.test.ts tests/xin-perimeter-energy.test.ts tests/xin-seven-candidates.test.ts tests/xin-repeat-sequence.test.ts tests/xin-refill-sequence.test.ts tests/hero-action-chain-order.test.ts
npm run build
```

最终17文件140项PASS；类型及Vite381模块PASS。构建 `2026-10-18T11:17:29.576Z`，`index-DoVNRx-2.js` 2,998.06kB／gzip878.77kB；元信息是d570 dirty，4个已跟踪＋3个新文件随后原样纳入产品。`git diff --check` PASS。初次类型检查发现夹具动态require让root成为any，已补真实Container类型；未放宽产品或测试阈值。

## 交给父／音频／计分

阶段接口的唯一说明在 [INTERFACES.md新增共用接口](../xin-energy-card-sample-2026-10-18/INTERFACES.md#六英雄共用阶段回调6815d80f)，实现为 `HeroTargetAttachmentOptions.onPhase`，由同一视觉owner派发苏弃牌、一般目标和辛有限爆发的只读快照。原音频会话01a148ba、GameScene／计分会话01a147ec顺序接入现有成功事件与arrival，不新增第二引擎、不各自改Scene。本分支没有添加Scene订阅或改音频实现。

待父线程开发预览审辛完整样板，并在同版六人真实发动→作用牌→持续→计分到达链检查外观、听感、触摸与设备性能；本地浏览器、PC／手机连续像素录像、物理设备均NOT_RUN。已有无预览不能转为上生产的理由。本批只证明池持续性、目标责任和接口生命周期，不签整体体验完成。
