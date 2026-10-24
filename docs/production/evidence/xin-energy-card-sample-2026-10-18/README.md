# 辛弃疾正式牌面能量样板

开发分支 `dev/xin-energy-card-sample-20261018`；产品 `0d5b5ea2a684a1f3adb8a676aaf6d5284cdbe12b`。运行时基线 main `bab78be5be4bc6d8cdb9780ac8a4eebb69f697da`，分支起点为仅文档的 `32eef8d5c0e3e8b348d26f32f1e2d95c3c154c3b`。仅交父线程审样，不合 main、不部署。H17/P08 保持 `in_progress`，`experienceAccepted=false`。

## 完整候选

使用正式 `HeroTargetAttachment` 和 Phaser 原生发射器接在实际候选／已留牌上，无独立演示页。两张缓存 64×32 Canvas 纹理分别画收尖亮芯、深绿弯曲墨尾和柔光，Canvas/WebGL 共用预着色纹理。顶部短流和右上短流持续运行；相邻牌／文字／按钮遮挡时保留整张位图的保护检查，不画整圈粗框，不覆盖原画或点数花色。

候选完整位图高度为芯9／尾14，选中候选实时 ×1.25；已留为芯12／尾20。实际着色轮廓比完整透明位图窄，这些几何值不能代替画面观感。选中只更新活跃发射器状态，不重建、不重播来源；新留牌前两个出生粒子有短暂1.1倍尺寸起势，旧留牌继续流动但不重播起势／来源。真实出牌的首次普通点数到达时，先释放该牌持续9粒，再在同一牌生成最多9粒、240ms的有限收束，避免持续层与爆发层叠加。

每牌芯3＋尾6、最多8目标72、共用Scene128预约预算保持。两纹理名义RGBA合计16KiB，只首次创建，不逐帧重画、下载或改原图。没有新RAF、定时器、规则随机数、规则／存档／音频改动；GameScene与其余五英雄视觉配方未改。

## 持续性缺陷与生命周期

真实 Phaser3.90 `ParticleEmitter.atLimit()` 在尝试 `dead.pop()` 前检查 alive＋dead；旧 `maxParticles=cap` 会在池填满后永久停发，即使 `emitting=true`。本批仅辛弃疾将总池硬门设为0，保留 `maxAliveParticles=3/6`。原生发射先复用dead、存活达到cap就停，因此总分配自然仍≤cap；测试逐帧检查 `getParticleCount()`（含alive＋dead），没有把“存活≤9”冒充“总池≤9”。上一批出生坐标 `target-current` 修复继续保留。

离屏／隐藏／失焦移除发射器，减少动态保留既有静态标记，返回可重建当前持续层但不迟发来源或重播起势。真实牌销毁、abort、场景退出／shutdown 清除原生更新列表及事件订阅。选中位移、父容器缩放／旋转和牌旋转由真实世界矩阵跟随。

其他英雄默认配方仍有相同总池硬门，本批按授权只审刘娥单目标成功契约，未签其持续3秒视觉或扩大修复；阶段整体改造时应纳入共同生命周期审查。

后续整体阶段产品6815d80f已在独立开发分支修复共同硬门，并按当前六人真实目标提供阶段回调；见[共用池与生命周期证据](../hero-particle-pool-lifecycle-2026-10-18/README.md)。本节保留d570交付时的范围，不把后续软件结果签成这批真实像素验收。

## 软件证据及边界

`tests/xin-formal-card-sample.test.ts`：1180×757 DPR1和390×844 DPR2，各执行WebGL／Canvas分支。使用当前新局身份与真实SavedRun，连续两次普通弃1张→实际三候选→选中一张→成功保存留牌；每阶段观察3520ms，前320ms预热后检查足够宽／厚且alpha>0.35的原生尾迹，最大连续缺失≤128ms。旧／新留牌、普通对照、真实普通计分到达、恢复、减少动态、隐藏及销毁均检查。合计四个正式收据场景。

同文件另有两尺寸8目标容量场景，父容器位移／缩放／旋转、牌±2°、4200ms逐帧检查每牌总池≤9／全部≤72，隐藏后清空。此两项ID明确为 `capacity-only`，是容量契约，不能充当自然收据证据。刘娥一项使用自然合法对子、真实保存失败后retry，确认唯一目标及 `erxiang.handoff` 的 `add-multiplier` 事件，仅消费同一保存事件，错误目标不释放，不误带辛弃疾纹理。

夹具执行真实 ParticleEmitter、Particle、EmitterOps、Frame、Container、Image、Graphics、Zone、DeathZone、DisplayList／UpdateList；纹理管理器、场景壳与字体边界是测试替身，没有启动浏览器、GPU或真实字体栅格。连续粒子几何通过不能写成真实连续画面通过。既有GameScene方法测试另核对保存→眼神→实际揭示→输入恢复和取消，不改眼神／音频实现。

```powershell
npm exec vitest -- run tests/xin-formal-card-sample.test.ts tests/xin-native-emitter-runtime.test.ts tests/xin-perimeter-energy.test.ts tests/hero-native-particles.test.ts tests/xin-seven-candidates.test.ts tests/xin-repeat-sequence.test.ts tests/hero-retained-ownership.test.ts tests/hero-target-attachment.test.ts tests/hero-attachment-viewport.test.ts tests/xin-refill-sequence.test.ts tests/hero-action-chain-order.test.ts
npm run build
```

结果：11文件82项PASS；typecheck／Vite380模块PASS，`index-HXzh1Uz0.js` 2,994.03kB／gzip877.65kB，时间 `2026-10-18T10:54:10.420Z`。构建信息为32eef8d5 dirty：当时6个已追踪改动＋3个未追踪新文件均随后纳入产品，运行时代码未再变化；最后仅改测试标题。`git diff --check` PASS。无全套、CI或域名检查。

## 父线程远端dot的三秒入口

1. 明确打开此开发产品版本；记录构建SHA、1180×757或390×844、renderer、动态设置。新局选辛弃疾、普通模式，进入正式牌局，完整动态开启。
2. 普通弃1张，保存成功后眼神先行、实际三候选揭示。指针移出牌区，不hover／点击，连续录候选至少3.2秒。
3. 只选一张后移开指针，再录3.2秒。应仅选中牌的流迹变厚，选择／点数／花色仍清楚，无重新发动或整圈框。
4. 确认留牌，移开指针录3.2秒。来源只去这次新牌，牌上已留标记和更明确的墨尾保持；旁边普通牌无同色流迹。
5. 再普通弃1张并选留，记录旧牌继续、新牌单独来源／起势；实际出含留牌的手牌，检查普通点数到达才收束。随后切减少动态、隐藏／返回、离场，检查无迟到重播与残留。不同阶段的按钮操作不计入该阶段3秒无人为触发观察时间。

## 参考截图应比较的区别

与bab78be5有限PC观察的“细／淡线”比较：候选应一眼看见有面积的深绿身体、亮头和软尾，选中层次明显，已留更清晰且不是大框；原画、点数花色、文字与按钮全可读。保留同屏普通牌作对照，手机重叠牌仍可分辨归属。单张截图只核外观；运动、持续性须同一阶段相隔3秒的连续过程／录像核验，不能用不同点击后截图证明。

本地浏览器、同版PC／竖屏录像／截图、主观强度、听感、物理设备和性能均 `NOT_RUN`，交父线程远端dot。无素材阻塞；软件证据不能签成商业质感通过。下一阶段六英雄真实发动→作用牌→持续附着→计分爆发的对接见 [INTERFACES.md](INTERFACES.md)，本批不接额外规则／音频实现。
