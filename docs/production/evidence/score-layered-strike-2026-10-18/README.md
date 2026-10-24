# Saved score strike layers

Base 3fa25dfefa6e9c18ac314ccd3e4bd86eb868f57f; branch dev/score-layered-strike-20261018. Product SHA is the containing commit. 独立开发候选，交现有集成线程合批。

真实唐宋牌/英雄正收益沿原windup→flight→arrival→rebound→rest增强：原牌面短拖尾、局部双轮廓冲击与定向碎屑、接触压缩、较轻回弹圈；数字保留原旧值切片与新值首个可见帧峰值。零/负数值不创建正收益打击，资源回执、输约不伪造加分。没有增加声音调用、Tween、定时器或Scene update listener。

已复用的成熟实现是JokerScoreStrike原飞行/六片数字切片和inkwaveSpring采样弹簧。已审HeroSkillParticles官方粒子配方及128共享限额，本批没有借用英雄发射器或扩该预算。项目原本无preFX/postFX调用；新增直接调用已核Phaser 3.90源码的preFX.addGlow，仅用于桌面短寿命飞行原画，由原Tween调强度、随copy销毁。手机/Canvas/无FX管线保留几何层，不声称已验证GPU观感。

每次strike只比原实现增加一个短尾Graphics；复用原命中Graphics。每通道拖尾7段；PC最多8射线/6纸屑，手机5/3；原六片数字切片不增。冲击位于当前分数字格内，不铺满屏幕；初始减少动态/回看沿原入口跳过，运行中减少装饰即清空新层。阶段与声音的实际回调、speed及取消窗口均不变。

## 检查

按文件最新结果：8文件81项独立用例通过（首轮64项、层文件最终6项、本次弃牌/选牌与相关检查69项按文件覆盖，不重复计数）。保留六英雄真实TweenManager的1/2/4x单次主击/回弹、取消复位与至少50ms双拍间隔；新增1180/390/320几何边界和1180/390原生唐宋牌完整层/数字/实时降级/abort。npm run build含类型检查通过，397 modules；首次两处类型错误修正后，相关层检查和构建复验通过。源码/报告/产物hash与命令见verification.json。

未运行browser像素、GPU、物理设备、听音、长视频矩阵、全库或CI。工程检查不代签打击观感和性能，P08继续in_progress。

## 合批接口

GameScene只追加同一strike的live effects开关。英雄owner的visual/cardBodyRoot仍以局部中心(0,0)、原width/height为准；外层容器保留语义ID/hit。原committed/source/attached/impact/settled/suspended/cancelled以及eventId/generation/signal不变，impact只在真实arrival。没有改HeroLiveSmoke、SushiDiscardCardPresentation、外层材质、音频、素材、规则或存档。桌面/手机同版肉眼层次及77df双声听感由现有集成线程与父线程验。

## 同批最高优先修复：先见牌，再斩切移走

旧GameScene在开场队列先把所有贬谪成本牌淡出，而真正amo.exile到达更晚。本批删除开场淡出，将实际待弃ID的CardView放入现有settledCards；原target resolver仍交还同一个container/visual/width/height。真实arrival后，由playSushiDiscardExit复用该事件impact段的同一animate/TweenManager调用cutSushiDiscard(id,p)，前38%斩切时牌面alpha仍1，随后消散。cut(1)及Tween完成Promise返回后才删除同一缓存项并销毁该真实牌；取消令Promise结束并只清理已提交成本牌，不恢复领域结果、不补空框。新检查用真实苏轼收据3成本/5主牌，验证任意等待arrival不提前消失、消散过程源仍存活、主牌不受击以及三个阶段abort无旧回调。

准备阶段入口不新增：syncHeroTargetAttachment仍只将amoExileChoice.discardedIds交给previewSushiDiscard，取消/重选走原集合对账。持续红焰准备、红色palette及源失效后停止空框由英雄owner同批负责，必须一起采用，不能单靠本候选签完整视觉修复。附件读取未返回可见像素；3张K♦/J♣/5♦与5主牌的图像事实来自父实际看图记录，本机不声称看过。

选牌不可辨另有真实优先级原因：hover把选牌手势也压成0.7度。本批选牌手势优先于hover，冲量按牌高、角度按牌宽适配，最高7度；旋转角点与现有16px静态抬升共同守原22px预留。64/132px原生检查在保持hover时均超过3度并一次弹性归位，布局/hit不改。
