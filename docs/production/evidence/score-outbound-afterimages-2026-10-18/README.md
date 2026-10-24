# Outbound original-image afterimages — incremental

Base b658f4787d106397859d907995b9576ded87bbe5; same branch dev/score-layered-strike-20261018. Only apply this containing incremental commit after b658f478.

按用户最新“去的时候有残影，回的时候直接收”执行：唐宋牌出击原画与立绘原有正向动作采样真实历史姿态，复用同一texture/frame、原点、翻转和色彩，形成保留原图轮廓的残影。不是线/烟替代。桌面3张、手机2张有限池懒创建与循环复用；不新增纹理/解码。命中同步释放整个残影池；回位不生成，不保留回程淡残影。

沿原Tween的elapsed采样，没有新增时钟、Tween、RAF、update listener或sound。立绘仅挂已有bindActionGesture及已有保存回执动作，不新增整张立绘飞行；不改HeroPortraitScoreMotion或英雄材质模块。减少动态清空旧样本，恢复只从当前姿态开始；abort、source/parent销毁与shutdown清理，不影响原牌、输入或分数更新。

本增量最终3文件21项及type/build通过（398 modules）。原生PC/手机唐宋牌链验证出击有原纹理Image、命中与回位均无残影；另查原图姿态/池容量/静止零创建/降级恢复/四类取消。首轮降级旧槽复活已修，坐标断言按浮点精度校正；最终同批21项全绿。未重跑旧整套矩阵。源码、报告和产物hash见verification.json。

Browser像素/GPU、物理设备性能和听感未验；由父与现有集成线程同版观察。不等待Library或域名，不修改规则/存档/音频/素材。旧b658弃牌生命周期和选牌修复保持。
