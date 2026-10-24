# 苏轼逐张斩切：Lempo Sword Slash 有限对照候选

基线为已合入官方Phaser粒子的 main `b805145eae92305a9a719155e8ecaf4f3c4379b9`，分支 `dev/sushi-lempo-slash-20261018`。只替换苏轼真实弃牌局部斩切的绘制，不回滚官方粒子，不修改GameScene、领域、弃牌数量/倍率、180ms原卡淡出或原队列等待。

## 固定来源

[Lempo-FX Sword Slash JSON](https://github.com/Boy1developer/Lempo-FX/blob/755ec9a3a26742d13048b2912c42fab8397490c3/assets/presets/trails/combat/sword_slash.json)，固定提交 `755ec9a3a26742d13048b2912c42fab8397490c3`。原JSON完整保存于 `src/game/presets/lempo-sword-slash.json`，下载字节SHA256 `a0fd1c4f3802031371ff50451ea63d458f8d44c5beb52e08f4620b8a6cbb91bc`；附 [MIT声明](../../../../public/licenses/lempo-fx.MIT.txt)，版权为2026 EG dev。

这是很新的项目，本笔只借其视觉配方做一次对照，**不称成熟方案**。没有导入GDevelop/Pixi/3D或Lempo运行时，没有重写粒子引擎。[上游demo.gif](https://github.com/Boy1developer/Lempo-FX/blob/755ec9a3a26742d13048b2912c42fab8397490c3/docs/screenshots/demo.gif) 是参考入口，不是本游戏动态证据。

## 原样保留与平台适配

`SushiSwordSlash.ts` 接受项目已有 `sushiLocalSlash` 的单牌头尾位置，限定在这条局部对角轨迹上：

- 寿命0.22秒；最多40点、相邻最小2px。40为上限，短牌轨迹按2px间距减少点数。
- 原宽度30→0、widthMult1；宽度曲线 `(0,0) → (.12,1) → (.55,.55) → (1,0)`，smooth插值，双端收尖。以112×159局部牌为参考缩放，并对最宽2.2倍外辉做单牌边界钳制，窄牌不会变成粗框。
- 完整颜色序列：白 `#ffffff` → 冰蓝 `#c4ecff` → 蓝 `#4aa8ff` → 深蓝 `#1f3fff`。透明度序列255→190→0（中点位置0.55），另乘220ms内的尾迹淡出。
- 白芯宽35%，白芯色 `#ffffff`；边色 `#55b8ff`、softness0.6、外辉宽2.2、外辉alpha0.35，强度1.8。用四层局部实心带表达外辉/柔边/色带/白芯，强度映射到Phaser Graphics的透明度并钳制，主绘制保留Additive。
- 该轨迹是确定直线，没有指针输入抖动；保留原 `smoothing:4` 参数，但不引入新的历史平滑系统。`enabled/source/hideParticle` 保留为上游元数据，不用hideParticle关闭刚合入的官方发射器。

上游 `texture:null`、`textureHiFi:slash_streak`、`demoMotion:arc_swing` 均保留原JSON元数据；本笔不载入这两个预留项，不声称已有高清斩痕纹理或弧形动作实现。新对照仍沿项目原局部对角线，而非照搬预留的arc_swing。

## 真正接入位置

`SushiDiscardCardPresentation.cut` 仍只接受同一保存receipt中的真实弃牌ID。首次cut记录本地slashAt，220ms视觉尾迹独立于原180ms卡面淡出：不会把原Tween完成当作尾迹立即完成，不复制/复活卡面，不增加计分等待。使用未被50ms动画步进上限截断的实际delta，低帧率不会把220ms主动放慢；20Hz绘制仍有一帧量化，因此不声称实测了精确40ms差额。原英雄源点→弃牌、官方蓝焰/沿边粒子、实际倍率arrival、取消/隐藏/切场清理全保留。

斩带每段都在同一牌局部几何内，最外辉也不能越出牌；文字和既有遮挡区域采取保守整段避让。两个不连续弃牌之间的普通牌不会落入新路径。减少动态及当前Canvas静态降级分支保持；没有为此对照重做跨场景框架。

## A/B与有限检查

基线 b805145：两条固定宽度短直斩线。候选：同一真实弃牌流程与局部轨迹上，加入完整多段配色、宽度/透明度曲线、白芯、外辉和220ms尾迹。没有增加用户开关或新玩法，仅供集成者作这一项有限视觉比较。

`sushi-lempo-slash`新增5项，加既有苏轼局部/来源11项，共3文件16项通过；类型检查及构建通过（369模块）。覆盖完整参数、配色端点、窄/中/大牌四层边界、双端收尖、点数与段数预算、文字遮挡、非连续目标普通牌、220ms清空与减少动态。每牌最多40点、四层最多156个局部四边形，仅短斩切窗口绘制，无发射器/纹理/监听器新增。

**动态未验**：遵用户要求未使用本机浏览器，也没有用静态几何单测冒充游戏动态。此分支仍是对照候选，真实技能流程中的色辨、Additive在浅纸面的观感、PC/手机、220ms听感/观感及物理设备未验，留 root 用远端dot作有限同版比较。不因上游demo或参数齐全写成已达到视觉目标。
