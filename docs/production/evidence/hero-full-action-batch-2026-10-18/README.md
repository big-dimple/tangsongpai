# 六英雄真实实牌动作整批候选

状态：开发候选；P08/H17 保持 `in_progress`。本批继续刘娥样板后的其余五人，不合 main、不部署、不启动本地 browser，不采用新四曲分支。正式像素、同版听感与物理设备验收仍未执行。

分支 `dev/score-source-gesture-contract-20261018`，前批 `75d4f9734e9cd606820f7c2a64effb60a4c1862f`。先取视觉产品 `1dc5c09170918910f85727bde048105834d44a9e`，本地对应 `55839ba653bd87fb3ec63e3cc432763a61e113cf`；视觉专属证据原样取自 `2e165a35e6ae2aa2735a5a1c6cb256adbf8b30c0`，未取其全局计划修改。整合者若已取视觉产品，只需再取本批动作产品提交；最终产品 SHA 见普通 push 回执。原音频 `0fbca930/f08b1f03` 已由前批采用，本批没有重复改 AudioEngine、BGM、素材或唯一 PerformanceAudioCue 类型。

## 实际动作与真实数值

|英雄|本批动作|保留的事实边界|
|---|---|---|
|苏轼|含实际 K 的代价牌沿既有逐牌斩切消失；真实主计分受益组随后一起蓄势、到 M、回弹归位|`costIds` 与 `targetIds` 分开；一次真实乘法只撞击一次，不逐牌重复倍率|
|刘娥|唯一保存目标实牌与材质整体向 M 递交、碎旧字、回弹|真实 `+M` 保持加法，不用乘法鼓冒充|
|文成公主|真实释放将本手受益组一起向 M 递交；未释放且实际蓄势变化时，最终计分后给小幅牌面/头像回执|蓄势读取成功命令的 before/after；不造 ScoreEvent 或倍率，封顶无变化不播；重置不庆祝|
|花蕊夫人|先显示真实金币扣除，再由受益组完成同一倍率姿态|金币只读实际 burn；代价滚动静音，未付费不生成能力动作|
|秦琼|成功弃牌押型先以真实命令 ID 锁定；胜后只有 `activeNewIds` 向 M；失败待判新牌短暂收冷、归位|失败按实际 M 惩罚滚动，不发正向撞击/回弹、碎字或庆祝，不把旧牌当新牌|
|辛弃疾|原每弃牌被动/眼神顺序保留；真实选留后，新留牌与立绘/头像共用一次轻回执；之后本手普通点数事件由该实牌向 H|候选/选留不是倍率；已留并集与本次 fresh 差集仍分开；真正点数到达才计分和发声|

`HeroScoreAction` 从同一保存 trace 校验 root/event/source、真实作用集合及正向算术。群组临时 carrier 只收纳原实牌容器和材质；外层 hit 不动。一个事件只走一个读数与声音落点；结束、取消、销毁后按原父容器和层序恢复同一对象、位置、角度、缩放、透明度。原画和规则、存档键、RNG、事件排序均未改变。

## 一个阶段时钟

继续使用 EffectQueue、ScorePhrase 和现有 Phaser TweenManager。真实牌面 windup/flight/land 原有三个 Tween 槽位向立绘及手机头像发送有效 elapsed；没有为立绘另起 Tween、timer、RAF 或引擎。arrival 更新 H/M、碎旧字并准入唯一 `consumePerformance(impact)`；同一个 land Tween 到真实 rebound 才准入第二声。1/2/4x 均保留至少 50ms 实际双拍间隔，声音不另排回弹定时器。只给真正 finalScore 发送结算 settle；其余局部 settled 不变 award。

减少动态、回看、后台、generation 更换、abort 与销毁沿现有生命周期收束。取消既恢复实牌和立绘，也重新应用数字实际缩放，而非只重置 data。视觉粒子/尾迹仍由原有原生池收束；它们不是另一条数值或声音时钟。新视觉强度、烟尾数学适配、许可和池预算见 [视觉批证据](../hero-spectacle-pass-2026-10-18/README.md)。

## 本地验证

- 相关 **48 文件 / 475 项 PASS**；最后两处小调整（取消时读数实际缩放复位、计分后蓄势轻回执权重）后，再跑受影响 **10 文件 / 112 项 PASS**。两轮不相加当作覆盖数。
- 新增真实保存事实测试，以及真实固定版本 Phaser TweenManager/Container/Image 联测。后者 25 项包含六英雄 × 1/2/4x、4 个取消阶段、3 档秦琼失败；连到真实 AudioEngine 准入，音源播放函数为 spy。确认 arrival 前零主击、各一次主击/真实回弹、间隔至少 50ms、无第二立绘 Tween、同实牌/材质/父层序恢复及取消后不补声。
- `npm run typecheck` PASS；`npm run build` PASS，388 modules，`index-Db0dr0p2.js` 3,024.25kB / gzip 887.48kB，保留既有大 chunk 提示。原始 build-info 为 `55839ba6 dirty`，不改写成未来提交；包含新未追踪文件的实际源哈希另存 `source-hashes.json`。
- 日志、压缩原始 JSON 及精确文件列表见 `validation.json`。原生组件场景/纹理/字体有测试壳，没有 browser/GPU、系统扬声器或真人试听；不能据此签最终画面、听感、FPS 或物理设备。

完整单测曾尝试 **388 文件 / 4761 项，4750 PASS / 11 FAIL**，发生在最后两处调整之前，不能签全套通过。修正两个旧 haptics 测试壳后，相关测试通过；工作区 TEMP 加 Git ceiling 后 build-info 检查通过，布局用例独立通过。失败用例隔离复查 7 文件 / 78 项，仍有以下 **7 项**，本批未更改这些门或生产规则来放行：

|文件|剩余项|精确现象|
|---|---:|---|
|`ci-gates.test.mjs`|1|本地 CRLF 使原始 `split('  browser:\n')` 无匹配；LF 归一后能匹配。只读本地用例，没有操作 CI|
|`core-build-window.test.ts`|1|存档原始字节 SHA 随 CRLF 改变；LF 归一 SHA 与前批 Git blob 完全相同|
|`public-art-privacy.test.mjs`|2|Windows 创建目录 symlink 返回 `EPERM`；未改系统权限|
|`c02-chain.test.ts`|3|内容 CLI 子进程 status 为 null；独立有界探针同样 `ETIMEDOUT` / `SIGTERM`，stderr 为空；未认定超时根因|

诊断详见 `platform-recheck.json` 与压缩原始报告。需要在父级可用环境复核完整门，不能把本地相关绿项替代全套。

## 同版短验包（待父级执行）

`remote-cases.json` 列出 10 个场景、正式 checkpoint、真实普通命令、保存 event/source/作用集合与 1/2/4x beat。每份 checkpoint 已由 `makeCheckpoint` 生成并经 `readCheckpoint` 验证；包含六人能力、文成蓄势增长、秦琼失败，以及从普通弃牌开始观察辛/秦前置的两份。手牌/牌堆/金币的前置为明确受控分区，不冒充自然获取或通关。后续动作由真实 SavedRun 提交，不手造 ScoreEvent。辛选留后可用 `remote-laohuan-kept.json` 继续普通点数；实际音画须从选留前包验证。

1. 同一最终开发版本分别用 PC 1366×768、390×844、320×568、844×390，导入对应包，按 cases 的 action 操作。先观察真实目标尾迹至少 3.2s，再提交，录 renderer、动态设置、版本和声音。
2. 对照保存事实：苏代价 K 与主手分开、刘 +M 不变乘法、文蓄势/释放分开、花先扣实际金币、秦锁定/胜负作用集合、辛先被动眼神再候选选留及普通点数。普通旁牌/原画/点数花色/控件与 hit 应保持清楚。
3. 1/2/4x 各短验；在 windup/flight/hold/rebound 中分别快进或隐藏、离场重入。看同一实牌/材质归位、无悬空 carrier/残缩放/重复结算/迟响。回看静音；减少动态维持静态来源和真实数值，不飞牌或发第二回弹声。
4. 实际主击/回弹是否清楚、整手轻重与结算后蓄势是否够轻，以及手机群组缩到读数附近是否仍可读，均为未验项。当前没有截图、录屏、试听、物理手机或正式整体批准。
