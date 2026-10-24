# 顶部五张牌闲置悬浮：聚焦修复候选

基线 `cdfd345fe34402bf7a54646e821bc8ab06453531`，追加分支 `dev/owned-idle-smooth-20261018`。精确产品SHA/源码哈希见 `delivery.json`。本批遵照要求没有启动本机浏览器，没有新增视频/截图，P08仍in_progress，实际视觉与物理设备验收待。

## 先诊断原因

1. `mountOwnedJokerIdle` 原有 `if(time-last<66...)return` 将整个位置/角度/缩放降为约15fps。60fps时每四帧才改一次；低频不仅用于材质，这是闲置自身的硬节流。`OwnedCardTilt.update` 在该return之前，每帧仍执行。
2. 原正弦相位直接用 `time/1700`。hover停止后重开、前后台或场景长暂停会直接跳到绝对时间的新相位。hover/score/drag刚进入禁用状态还会一次性把闲置层设回identity，导致突跳；数值冲撞使用同一层而不在source motion owners集合内，这一次重置也存在覆盖其首帧的风险。
3. `PolychromeCardIridescence` 自己以 `IRIDESCENCE_FRAME_MS=1000/15` 调用Graphics重绘，不设置host位置/角度/缩放。没有将其提到逐帧，也没有提高粒子/纹理/材质预算。
4. `SpringMotion` 原本每帧消费delta、将长delta限制0.1s并分成≤8ms子步；没有闲置欠账累积器。它不是15fps卡顿根因，未修改该稳定性合同。

## 最小产品变化

唯一产品文件 `src/game/OwnedJokerScoreMotion.ts`，只改闲置路径。删除66ms变换门槛；现有Scene update每帧推进活动相位，复用既有SpringCardTransform平滑目标。不增加timer、tween或第二监听器。闲置每帧delta最多50ms，无效/零delta不前进，暂停时间不补跑。恢复时从实际拥有者留下的姿态接回，hover冻结相位与姿态，计分/拖拽时不写该层；reduced motion直接静态。

幅度一次性从 x±0.8/y±2.8/角±1.6° 调为目标 x±1.4/y±5.5/角±2.6°，相位仍五张错开。依据 `scoreArtBounds` 计算实际旋转原画包围框，额外预留手机1.5°/1px、PC3°/2px的既有hover倾斜/视差，限制在固定frame内；必要时轻缩放，不移动命中槽。每帧无需测量DOM，手机模式在挂载时读取一次。阴影随每帧实际高度变化。

ScorePhrase、JokerScoreStrike、GameScene、OwnedCardTilt、SpringMotion、虹彩管理器、AudioEngine/素材、领域规则相对基线均无改动；刚交付的事件顺序/双拍/数值语义保持。

## 实际检查

- [34项定向](checks/tests.txt)：新增闲置8项，结合现有来源/tilt/弹簧/材质/ScorePhrase回归共6文件34项通过。
- 30/60/120fps是Node模拟：路径接近，连续帧都前进，24秒内实际输出可见幅度上下超过5px、两侧角度超过2.4°。直接挂载真实update函数，120次事件对应120次变换写入，DOM框只读一次。
- 四档几何320×568、390×740、844×390、1366×768：五槽各模拟1440帧，真实原画角点加hover预留始终在固定frame内，因此不跨邻槽或漂离命中框。
- 实际update函数的hover冻结、score/drag零抢写、从owner复位后接回、隐藏/异常delta保持、减少动态静态、恢复不补绝对时间及shutdown解绑通过；这些是Node替身，不是浏览器真实输入或物理后台验收。
- [typecheck](checks/typecheck.txt)、[production build](checks/build.txt)通过；构建仅既有分块提示。未做其它长局/全套回归，也未重复调参。

候选只证明源码因果修正和软件边界通过，不能据此签实际帧率、GPU性能、主观自然度或实机流畅性。需父级在实际运行环境继续查看五张闲置连续画面。
