# 六英雄多层能量／苏轼真实预备与斩切

基线 main `3fa25dfefa6e9c18ac314ccd3e4bd86eb868f57f`；分支 `dev/hero-energy-layers-20261018`；产品 `a2f8839604f2ccc80e0a586affaa1b88902156ce`。必须与计分 owner 的 `b658f4787d106397859d907995b9576ded87bbe5` 同批集成：该包保留 `settledCards` 原实体到 actual arrival 后的真实斩切／消散 Tween 完成，本包负责材料与清理。没有修改 GameScene、领域、存档、音频或原画。

**实际复用：** 保留 Spooky 实时烟气；实际提取 [ElectricBorder](https://github.com/DavidHDev/react-bits/blob/main/src/content/Animations/ElectricBorder/ElectricBorder.jsx) 的梯度插值／解析导数、tangent/normal 曲线投影、斜率补偿距离和 core/haze/hot 辉光。源码快照 SHA256 与完整 MIT＋Commons Clause 在 `public/licenses/react-bits-electric-border.LICENSE.txt`，正常 dist 也包含。WebGL2 uint/hash 改为有界 float 梯度，适配当前 Phaser GLSL ES1；不搬 React、独立 WebGL 引擎、hover、RAF 或包。下列编排为应用自身实现；没有声称复用了冲击波／碎裂源码。Gem Smoke 未采用。

|英雄|同一烟气＋能量核的不同形态|
|---|---|
|苏轼|红橙烟焰、刀弧尾迹；实际 cut 时白热红橙斩切|
|刘娥|相向传递光带与移动能量束|
|文成公主|宽五瓣光冠及外层花瓣纹|
|花蕊夫人|从下角向上攀升的宽焰舌|
|秦琼|分离的上下分叉电弧；真实输约同次更新熄灭电层|
|辛弃疾|顺时针三叶螺旋与墨云反向层次|

**苏轼时序：** 现有 `previewSushiDiscard` 只消费有效选择的真实待弃集合，持续预备而不保存、不发布 committed、不允许 cut；重选转移、取消撤除，5张主牌无挂载。保存收据确认后才绑定实际 ID/event/generation/signal。计分 owner 继续交还同一个 outer/visual/width/height，内层中心 `(0,0)`、外层身份／命中不变。`cut(p)` 直接驱动红切与每牌 shader 收束；没有独立 slashClock，也不再由 arrival 后 impactMs 超时清掉仍在斩切的牌。只有真实 arrival 与全部 cut(1)／源销毁完成后才 settled。

原实体／明确内层销毁时立即移除其效果与监听；隐藏、透明、离屏停止，不能向旧坐标续画空框。效果层不销毁实际牌，最后移走仍归计分 owner。保留 Lempo 原预设字节、曲线和采样；红橙 palette 是产品覆盖。手机重叠牌按实际绘制层级遮挡：后层图像不假挡住前牌，文字继续保护；刀带裁出可见部分，仍限单牌内、40采样点／每牌最多156填充片，不穿过前景普通牌。旧“原牌消失后持续空代理／独立220ms尾迹”的测试合同已被这些回归替换。

**预算与兼容：** 新层直接合在原 FBO，无新增 framebuffer／timer／update listener／声音。Scene仍最多8目标、131072像素；低中高沿64×96/20Hz、96×128/30Hz、160×192/60Hz及现有实测帧成本降级，细节上限1/2/3，保护区移动时按既有策略及时重绘。额外 uniform 后仍在已要求的32 fragment vectors内；varying 两端继续显式 mediump。透明度使用 premultiplied compositing，整张原画与前景文字遮罩保留，CSS像素宽度随实际FBO分辨率适配。Canvas走已有轻量配方；低动态静态红焰标记，取消／退出清理。

**检查：** [9文件104项](tests.txt) 与[类型／396模块构建](build.txt) PASS；JS产物 `index-Ds-9QKEY.js`，两份许可均存在。六英雄每人分别在1280／390模型以真实SavedRun收据推进3.65秒，全部实际目标持续更新且普通牌无挂载；另有3张预备／5张主牌、取消重选、实际 arrival 后切到.45并停住仍有红色Graphics与shader、cut1与实际内层销毁即时清理、保存往返等回归。竖屏[遮挡反例](phone-mask-before.txt)曾失败，修正后同一断言通过；不重复累计重跑数。

**边界：** 原生对象／Tween／Graphics 的工程检查与 shader资源提交 double 不能证明真实GPU画面。没有运行本机浏览器、GL驱动编译、PC/手机实际连续像素、听感或物理设备性能；未看本轮Library截图，只按父线程已看图的阶段说明处理。构建在产品提交前使用同一源码完成，build-info仍标基线dirty；集成最终同版构建归原集成线程。正常开发分支push交同批集成，不等Library／域名。P08/H17仍in_progress，视觉未验收。
