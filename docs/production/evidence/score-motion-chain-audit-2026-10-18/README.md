# 计分完整调用链有界核查：首次可见数字错过峰值

基线 main `d351271e43dd3c8b7032b7c68aa8e4940687de12`；候选 `dev/score-motion-chain-audit-20261018`。精确产品SHA和源码哈希见 `delivery.json`。本次不启动本机browser，不用截图或模块存在签效果完成；远端动态与听感仍待验，P08保持in_progress。

## 确认的实质断点

复算已保存的 `score-phrase-directed-2026-10-17` PC/4×逐帧数据，并将该证据绑定的 JokerScoreStrike 源码hash与当前d351比对，相同（[分析结果](historical-pulse-analysis.json)）。这些是旧版实录的重新分析，不是d351新浏览器运行。

4×四笔从属来源的可见数字最大pulse分别为约1.0037、1.0064、1.0133、1.0130；关键乘法约1.1064。此前“数值已经更新且显露”检查通过，并不能证明数字确实明显弹出。

原因准确落在 `land()` 的数字恢复采样：旧字隐藏到hold结束，恢复时直接采 `OWNED_SCORE_SPRING.value((elapsed-hold)/recovery)`。峰值在恢复t=0，常落在两帧之间；第一个可见帧已进入衰减甚至反向段。4×普通recovery只有实际50ms，60fps都可能漏掉峰值，33/66ms步长更容易错过。这是有声而数字弱动的具体断点；没有发现新的来源身份或目标反接问题。

## 沿完整链核对

1. `GameScene.presentTrace` 仍按保存的remaining ScoreTrace事件顺序生成ScorePhrase；不改算术/事件顺序。
2. `ownedJokerMotionCue` 校验保存的来源实例/定义/实际收益；`jokerScoreStrikeCue` 仅将真实正收益分到实际H/M，资源/成长不假撞数字。
3. `GameScene.showScoreEvent` 先准备来源windup，再flight；`land()`创建旧字碎片，随后同一arrival Promise释放、显示保存after并由唯一impactAccumulator调用scoreImpact。非数字来源仍走原owned motion。
4. 音频以presentation/eventId/arrival去重，真实before/after决定乘法音色；paired主击缓存同事件信息，来源Tween实际回弹调用一次scoreRebound，没有新timer。
5. 数值来源的回弹、来源牌回位和音频落点沿用原 `STRIKE_RETURN_LANDING`；非数字来源沿用 `OWNED_SOURCE_REBOUND`。本次只修数字首个可见采样，未移动这两个落点或延长时间。
6. reduced-motion默认值为false，不按低配硬件自动设true；实际有效值为保存偏好或系统 `prefers-reduced-motion`。开启后无冲撞/无数字缩放且paired=false、无第二拍，是既有静态合同，不应强行恢复运动。

实际差异只在 `JokerScoreStrike.ts`：同一Tween首次真正可见时采原有峰值，随后在该impact剩余时间收回。原幅度/weight/hold/总时长、主击/第二拍时间、精确after均不变。不新增粒子、声音、全局暂停、独立时钟或通用帧率降级策略。

## 本地检查与限制

- [34项定向](checks/tests.txt)通过，新增1/2/4×与16.7/33.3/66.7ms步长的首可见峰值、原slot收回、独立事件/真实乘法weight检查。
- [当前音频39项](checks/audio-tests.txt)通过，覆盖已保存真实事件、paired去重、缓存音色/weight、取消/静音/后台/abort清理、60个密集双拍原预算。没有改AudioEngine。
- [production build（含typecheck）](checks/build.txt)通过；既有分块提示仍在。`node --check harness/owned-joker-score-motion.mjs`通过。
- 现有harness增加记录实际 `Text.scaleX`，directed模式逐笔要求首可见pulse达到既定峰值且未被版面拟合压平；本地未启动浏览器，此新增渲染断言为 **NOT_RUN，供远端验**，不填PASS。

这笔没有承诺修复低配GPU瓶颈或所有极长掉帧；步长覆盖是Node采样测试，不是实机帧率。来源抬起/左右回弹继续复用原连续证据，本批没有新的本机视觉签收。

## dot远端准确复现

使用本候选构建，通过下方既有harness在隔离测试上下文准备夹具。当前玩家菜单没有进度/存档导入入口，不要求从线上菜单导入；下列人工观察步骤以前置夹具已就绪为条件。[remote-repro-checkpoint.json](remote-repro-checkpoint.json)是同一夹具的校验留档，文件由原 `scoreSourceProcessFixture('chain')` + 第五张多彩满堂喝彩生成，经正式readCheckpoint校验；不是自然获取样本。它明确是冻结旧局身份 `quality-r2-s04-finish-v1`，画面余音袅袅不代表新局贬谪回退。

1. 设390×740或PC；菜单演出4×，关闭应用“减少动态”并确认系统没有reduce，保持音效开启。
2. 导入后关闭开场/技能提示。选择手牌前五张：梅花7（倍+2/多彩）、红桃7、黑桃9、方块9、黑桃7；不选择助攻，点击出牌；若出现真实英雄提醒，点“继续出牌”。
3. 连续看完整13来源发动。重点不是总分：末段“当前倍率+2”与“始终如一×1.5”落M、“聚宝金瓮+40”与“满堂喝彩+90”落H、最后满堂喝彩×1.5落M。每笔新值从碎旧字后显露的第一帧应有原定峰值，再收回；声音仍是一主击、一回弹，不额外响。
4. 重新装载同一夹具各跑1×、4×；如能在远端限制CPU，再记录实际frame delta检查粗帧。不要用静态截图或单独音轨判断同步。
5. 另设减少动态再装载同一夹具一次，预期无飞行/缩放、数字直显与单主击；取消应保精确已提交结果，不能留下新字放大或残响。

远端可复用既有harness生成同一库存/真实输入及连续AV，无需新测试场景（本机不执行）：

```sh
OWNED_MOTION_OUT=shots/score-motion-chain-remote \
OWNED_MOTION_CASES=phone,fast,reduced,cancel-rebound \
OWNED_MOTION_PHRASE=1 OWNED_MOTION_STRIKE=1 OWNED_MOTION_DIRECTED=1 \
node harness/owned-joker-score-motion.mjs
```

保留失败报告；首可见实际scale、13个eventId的一次主击/一次回弹、正确H/M、精确state/oracle都应同时核对。该命令当前仍是远端待跑项。

## 本地整合检查

来源HEAD `cd5808bc67cca81c16427d74bf9a86ec5315e55b` 普通合入main基线 `d351271e43dd3c8b7032b7c68aa8e4940687de12`，无冲突。src/tests/harness与来源完全相同；来源产品 `51e8516fd72f71c38c5024abc21e15967cbc71db` 的34动作数值、39音频及构建按原版本复用，未重跑。合版类型与差异检查PASS。首次类型命令因worktree依赖链接缺失而未启动，日志保留；恢复复用主工作区既有依赖后通过，无重装。正常main发布精确SHA见交付回执/远端；本机浏览器未运行，远端动态和听感保持待验。
