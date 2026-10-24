# 六英雄视觉强度批：亮核、尾迹、立绘呼应与有限爆发

依赖联合候选 `15cdc0532a2ef5656798bb2429a7a3b2810d8c1d`，其中视觉模块与25872095逐文件相同。开发分支 `dev/hero-spectacle-pass-20261018`；产品 `1dc5c09170918910f85727bde048105834d44a9e`。按用户13:18继续六人整批开发的指令推进，不等待预览才实现；仅交集成，不自行合main／部署／开本地浏览器。P08/H17保持in_progress，真实像素／听感／设备未验。

## 本批实际采用

五人的旧小柔光点改为懒生成的原生亮核＋弯曲尾迹，均在现有Phaser发射器、池和真实目标容器内运行。新纹理为32×32芯／64×32尾，预着色NORMAL合成使Canvas／WebGL都保留深色身体、明亮中心与透明外缘。各自造型为苏蓝焰刃、刘蓝焰、文金瓣、花橙焰屑、秦蓝紫旋纹；辛既有绿墨双层完整样板保留。

持续尾迹在牌顶34／64 CSS像素两层短流，以及有空间的上侧通道运动；两层反向，花瓣与旋纹有独立朝向，蓝焰／焰屑侧流上升。宽尾迹仍逐整张旋转位图检查原画、点数花色、非目标牌和控件，没放宽文字保护。整手标签造成中间牌遮挡已在手机原生对象测试中暴露并修正为分层通道，未降低原30次末段逐ID采样阈值。

真实arrival才将原边缘池变成1.42倍线性尺寸的短爆发，仍每目标最多9粒，180ms收束；有限发动芯仍450ms停发，620ms单粒寿命，持续尾960ms／110ms发射、maxAlive9／原生回收。辛既有3＋6和240ms有限爆发保留。秦失败保留真实待判新牌，弱化到0.3透明度、关闭立绘庆祝且不放大，按原失败标签淡出。

立绘／手机头像外侧由 `HeroSourceEcho` 复用既有 `drawHeroAtmosphere`，每owner最多一个非交互Graphics、6个解析图形、144段描线，随既有手机20Hz／PC30Hz更新，不另开RAF／timer／引擎。整幅人物原画和其余UI仍作保护区；没有立绘／头像时不拿道具箱或技能按钮补造立绘环。减少动态移除动态层，保留原静态标记；隐藏／离屏／退出／销毁释放，恢复不补播发动。

## 成熟来源的有界适配

已实际提取 [Spooky Smoke源文件](https://github.com/pulkitxm/claude-directory/blob/f3d7e12f34bf7d90130dce3ec3b26cf69c29794e/shaders/spooky-smoke-shader/src/components/ui/spooky-smoke-animation.tsx) 的rnd／noise／fBm数学部分，精确公开HEAD `f3d7e12f34bf7d90130dce3ec3b26cf69c29794e`，根MIT版权2026 Pulkit已核。仅两层噪声一次性烘焙入苏轼现有64×32尾纹理，输出着色密度alpha与透明边缘；运动由Phaser继续负责。没有采用原React、独立WebGL画布、DPR扩张、preserveDrawingBuffer、RAF或不透明灰底。许可随构建保存在 `public/licenses/spooky-smoke.MIT.txt`，`dist/licenses/spooky-smoke.MIT.txt`已确认存在。本批不能称完整原demo或动态fBm着色器已接入。

已读 [Paper Gem Smoke固定源码](https://github.com/paper-design/shaders/blob/ad5571db3c95769756d7b27ab8ee79684fea4a57/packages/shaders/src/shaders/gem-smoke.ts)，其9×9采样与轮廓预处理仍适合另评单英雄低分辨率短爆发；本批未集成，也不把备查链接算成功能。原Phaser配方及苏Lempo斩切的既有许可与预设保持。

新增纹理最多五人×(32×32＋64×32)×RGBA4＝61,440字节名义RGBA（60KiB），只首次创建；辛既有16KiB单列。Canvas缓冲、GPU副本和真实设备耗时没有用名义像素冒充实测。没有新依赖、原画改字节、规则随机数或存档字段。

## 真实作用集合与owner接口

|英雄|保持的真实集合／动作|本批视觉层|
|---|---|---|
|苏轼|真实 `amoExile.discardedIds`，含实际被弃K；各自代理承接原Lempo斩切与actual arrival，非主手|蓝焰刃芯、带两层噪声的蓝烟尾、外侧立绘呼应和到达收束|
|刘娥|唯一保存目标 `erxiangHandoff.targetId`，原单牌＋M动作保留|蓝焰芯／尾、立绘呼应与到达爆发|
|文成公主|真实蓄势／释放后的activeScoringIds，保留既有空集回退|金色五瓣芯／散瓣尾、反向两层短流、到达放大|
|花蕊夫人|当前真实付费事件的计分受益牌，不把代价或旁牌当目标|橙色焰屑／火种尾、向上侧流、到达放大|
|秦琼|保存补牌待判集合；胜后只activeNewIds，失败仍是待判新牌的失败淡出|蓝紫旋纹；胜利到达放大，失败不放大／不庆祝|
|辛弃疾|d570已留union持续、本次fresh差集来源／起势、真实普通点数收束|既有完整芯尾保留；已留可用同一立绘呼应，候选suppressSource继续生效|

GameScene／音频／ScorePerformance／HeroAttachmentPhases没有改动。联合15cdc已有 `observeHeroAttachmentPhase`、`commit`、`release`、苏 `beginSushiDiscard/presentSushiDiscard(arrival)`、辛 `impactRetainedCard` 入口，新效果由原owner直接挂载，**本批无需新增GameScene补丁**。计分唯一owner继续在自己的窗口扩展其余五人的实牌姿态／数值动作；原Liu单牌＋M样板不被覆盖。保留真实ScoreEvent ID、targetIds、generation／signal、实际arrival以及原观察回调，视觉不重算数值／代价／命中框，不加第二音频引擎。M2开发已启动，完整六人声画链与M3仍待整合及真实验收。

## 定向证据

新增 `tests/hero-spectacle-pass.test.ts` 20项：五人两种renderer的实际原生发射器各3600ms、宽／厚整位图有效面积与移动、文字／自身／普通旁牌完整保护、同池爆发和清理；10张缓存形状／色板与60KiB预算；真实Graphics立绘／头像选择、运动与遮挡；五人当前身份真实SavedRun owner的立绘呼应、苏实际K／目标集合、减少动态／隐藏／退出；秦真实失败；两层噪声透明密度、确定性和不采样RNG。

已有29项六人真实收据／池／取消、辛双renderer完整阶段、苏真实代理／Lempo和两份联合score接口合同一并通过。当前身份的手牌／牌堆／金币前置是明确受控分区；发动与最后保存是真实命令，不是自然通关。实际Phaser Particle／EmitterOps／Frame／Container／Image／Graphics／DeathZone／DisplayList／UpdateList运行，纹理管理器、字体与场景有测试壳；Canvas路径命令和像素数据测试没有启动浏览器／GPU。几何、RGBA与对象可见性不等于真实画面、FPS或审美验收。

```powershell
npm exec vitest -- run tests/hero-spectacle-pass.test.ts tests/hero-native-pool-lifecycle.test.ts tests/hero-native-particles.test.ts tests/hero-attachment-facts.test.ts tests/hero-target-attachment.test.ts tests/hero-attachment-viewport.test.ts tests/hero-retained-ownership.test.ts tests/sushi-discard-local.test.ts tests/sushi-discard-visibility.test.ts tests/sushi-discard-origin.test.ts tests/sushi-lempo-slash.test.ts tests/xin-formal-card-sample.test.ts tests/xin-native-emitter-runtime.test.ts tests/xin-perimeter-energy.test.ts tests/xin-seven-candidates.test.ts tests/xin-repeat-sequence.test.ts tests/xin-refill-sequence.test.ts tests/hero-action-chain-order.test.ts tests/score-performance.test.ts tests/score-card-performance.test.ts
npm run build
```

20文件190项PASS，类型及386模块构建PASS。`2026-10-18T13:40:08.018Z`，`index-Bhhh4LDU.js` 3,011.49kB／gzip883.20kB。元信息15cdc dirty（5个tracked＋5个当时未追踪文件），均原样纳入产品；构建后没有运行时代码改动。diff检查PASS。没有全套、CI／域名检查、生产发布、音乐／Boss／menu／原画改动。

父／dot审同版开发候选：先普通牌对照下各真实目标停留至少3.2秒，再真实arrival；桌面1180与390竖屏记录renderer／动态设置／SHA，核亮芯、身体与软尾的面积和层次、立绘外侧呼应、实际K／秦胜负／群组归属、原画文字和点击清楚、同回执不重播、reduced／后台／离场清理。静帧不能证明持续。当前截图／录像／听感／物理手机／FPS均NOT_RUN；缺预览不作为转生产的理由。
