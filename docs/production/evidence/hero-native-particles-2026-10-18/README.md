# 六英雄：固定 Phaser3 官方粒子配方接线候选

分支 `dev/hero-skill-chain-audit-20261018`，主线输入 `524bacf6d324777e7c6ecd6e7e1a7d0c5baa9146`；先行生命周期修复 `758318af`，见[复现与旧失败](../hero-skill-chain-audit-2026-10-18/README.md)。本笔是父线程选定开源方案后的接线候选，精确最终 SHA 见交付回执。不是视觉验收通过或整体体验完成。

## 复用来源与适配

固定 `phaserjs/examples` 提交 `68140eca72525d5034b783a262270715ddc17b78` 的 `public/3.86`，没有使用面向Phaser4的官网默认分支，也未改变项目Phaser3.90.0或增加依赖。

- [fire effects.js](https://github.com/phaserjs/examples/blob/68140eca72525d5034b783a262270715ddc17b78/public/3.86/src/game%20objects/particle%20emitter/fire%20effects.js)：复用颜色序列、quad/quart out、sine缩放和ADD短高光。每牌 fire 最大7粒，寿命480–650ms、frequency32、speed45–75；明确 `emitting:false`，真实保存后 `start(0,450)`，没有示例的advance预热。
- [emit zone loop.js](https://github.com/phaserjs/examples/blob/68140eca72525d5034b783a262270715ddc17b78/public/3.86/src/game%20objects/particle%20emitter/emit%20zone%20loop.js)：复用24点 edge顺序发射，Circle替换为项目已有 `attachmentEdgePoint` 的单牌外沿路径。持续 edge最大9粒、frequency40、寿命360ms，speed0，由顺序与缩放形成沿边光流。纸面采用NORMAL混色维持英雄颜色，短高光保留ADD。持续 emitter 的生命周期明确由真实目标所有权控制，使用start(0)而非在complete里无限restart；实际计分时停止持续发射、短爆发9粒/180ms。
- [add emitter to container.js](https://github.com/phaserjs/examples/blob/68140eca72525d5034b783a262270715ddc17b78/public/3.86/src/game%20objects/container/add%20emitter%20to%20container.js)：复用 `scene.add.particles(0,0,key,config)` 后加入真实牌Container，不重复scale、不设交互、不按槽位查找。苏轼使用同实例ID的局部代理容器以保留弃牌淡出后能源位置，不复制牌面。
- 生命周期依 [Phaser3.90 ParticleEmitter](https://github.com/phaserjs/phaser/blob/v3.90.0/src/gameobjects/particles/ParticleEmitter.js)：短fire一次complete后destroy，取消/切场/牌销毁直接destroy；没有pause冻结残留，也没有把frequency0当关闭。

源码保留出处，附 [MIT声明](../../../../public/licenses/phaser3-particle-recipes.MIT.txt)。上游 [README的源码/素材区分](https://github.com/phaserjs/examples/blob/68140eca72525d5034b783a262270715ddc17b78/README.md#license) 不混用：示例atlas只用于临时研究，**不进入运行包**。项目未发现现成白柔光粒子图，因此用一次性缓存的32×32原生Canvas柔光纹理，沿用上述官方发射配方；没有外部图像资源、逐帧生成纹理或新增原画。

## 六英雄实际链

| 英雄 | 真实成功来源 / 局部目标 | 当前接线 |
| --- | --- | --- |
| 苏轼 | 保存的 `amoExile.discardedIds` | 确认前仅静态候选记号；真实保存后英雄技能源点→真实弃牌代理，蓝焰/沿边粒子，既有逐张斩切保留；实际倍率arrival才爆发，随后清理。主牌和普通旁牌不附着；不改弃牌数量/选择/×4规则 |
| 秦琼 | 已保存押注的 `refill.refilledIds` | 实际新牌持续紫色光流；真实赢时只保留 `activeNewIds`，按真实胜/负事件释放。锁定/换牌中/结算中/已用语义保持，无待完成残留的新分支 |
| 辛弃疾 | 换牌成功保存→已有专属眼神→真实候选揭示；确认保存的留牌ID | 未确认候选只标记；确认留下的牌保留绿叶色粒子直到实际使用/离手。换选普通出牌不重指目标。实际第一次正值普通计分到达才作单牌短爆发，重复计分/0分/倍率事件不伪装技能增益；不增加英雄算术 |
| 刘娥 | 真实保存的 `erxiangHandoff.targetId` | 成功保存后从英雄源点流向这张真实被改计分的牌，蓝色持续流，实际交棒到达爆发。取消/改选保留静态意图，不提前虚放成功 |
| 文成公主 | 实际蓄层释放事件、当手真实计分ID | 保存前静态目标，保存后金色光流，真实释放到达爆发/回弹沿用原牌计分响应；不改蓄层/数值 |
| 花蕊夫人 | 实际支付保存事件、当手真实计分ID | 付款前只标记，保存后红橙余焰，实际倍率到达才爆发；原支付档位和已付语义保持 |

旧助攻身份仍读自身 assist IDs，不被新苏轼贬谪替换。英雄源点传输复用项目已有裁切曲线和遮挡路径，新增目标粒子复用官方发射器；没有新写第二套粒子引擎。组标签可在整体范围上排版，效果始终逐真实牌，不沿多牌范围画大框。

## 预算、可读性与清理

`HeroSkillParticles` 以Scene共享预算严格限制原生最大128存活/分配粒子（每可见目标7 fire＋9 edge，最多8个目标），加既有来源光流最多2个头仍低于144起点。所有者更新20Hz手机/30Hz桌面，原生粒子由现有Phaser池更新。没有每帧new图元/纹理、全屏shader或第二引擎。离屏/隐藏目标释放发射器，来源重绑不重复初始fire；hidden/reduced返回只恢复合法沿边状态，不补播迟到成功。

单牌本地死亡区保护完整卡面，外部死亡区保护文字、非目标牌与屏幕边界；不存在跨行整体描框。参考[Canvas粒子renderer](https://github.com/phaserjs/phaser/blob/v3.90.0/src/gameobjects/particles/ParticleEmitterCanvasRenderer.js) 的颜色限制：普通Canvas和减少动态不运行白纹理颜色渐变，保留已有有色静态目标标记；不会无声退成白色提示。实际对比效果仍需远端观察。

辛弃疾已留牌记录仅为本Scene临时显示状态，不入存档；离手、不同run/stage或create重置后清空，冷恢复不复活演出。所有 emitter 的complete/destroy及原牌destroy监听均自有，clear/abort/切场清理；此前Scene计分时长/串行队列没有新增等待。

## 检查与仍未验收

必要窄测10文件56项全部通过，包括官方配置/24点局部范围/六配色、真实成功门、预算128、fire有限时长、清理和不重播、Canvas静态分支、实际Scene的辛弃疾眼神→揭示顺序、已留真实牌持有/离手和普通计分筛选、秦琼真实赢/输状态、苏轼真实弃牌/单实例斩切。`npm run build`内类型检查与Vite构建通过（367模块）；不用旧结果代签。

**远端动态阻塞**：当前 CUA inventory只有本机Edge，没有`dot`浏览器。只做清单读取，没有打开或操作本机标签。按用户限制未启动本机浏览器、游戏或十二路矩阵，不能在此环境完成“真正技能链动态演示”。需要root提供可用远端dot并在本分支同版核验：三秒不点击持续流动、六英雄实际成功来源/目标、PC与竖屏、普通牌对照、实际计分爆发、减少动态、取消/隐藏/切场归零。上述全部动态/美术观感/低配实测 **NOT_RUN**，不是测试床或模块存在就已体验达标。

## 联合整合检查

与手机商店 `b42c145acb0ad71552cdf979f7e7c7cc33b12d06` 在main基线 `524bacf6d324777e7c6ecd6e7e1a7d0c5baa9146` 上普通合并，无冲突。英雄六个产品文件与 `f7864e56dc5b189a9efd4171013ad36a049cd642`、商店三个产品文件与其来源分别完全相同；联合类型及差异检查PASS。AST静态核对实际Scene构造、保存来源、弃牌斩切/同一arrival与辛弃疾已留牌首次普通计分到达入口，原生emitter经实际manager/step调用；不是浏览器或动态PASS。来源56项及商店32项/各自构建按原版本复用，本轮未重跑；实际main SHA见交付回执/远端，合入不关闭P08或远端动态待验。
