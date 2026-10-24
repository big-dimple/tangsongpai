# 辛弃疾卡周短流光／墨绿气流：单批工程候选

**有限PC恢复更新：** root在bab78be5同版dot实玩（父记录10:21）已看到候选、选中及已留牌的墨绿余迹，来源只飞向新3♥，“完全消失”回归得到有限恢复验证。表现仍细／淡，未达绚丽附着目标；手机、音频与设备性能未验，H17/P08保持开放。287a38的09:52回退及出生偏移修复过程仍保留，最新观察与下一批建议见文末。本次只更新文档，不调参、不改运行源码、不额外发布。

基线 `9e1959cb8c89227348c81c923006754aa4902ed3`，分支 `dev/xin-perimeter-energy-20261018`，产品 `e0ed4f3d3fde8d5011d0f2fca8c9e135de24333c`。仅改`HeroSkillParticles`、`HeroTargetAttachment`及独立`XinPerimeterEnergy`配方，GameScene无改动。父会话在旧版41aef038的有限PC观察是稀疏小绿点／细线。本批先完成一个辛弃疾工程样板；**当前仅PC消失回归有限恢复，质感未认可，手机／音频／设备性能未验；H17/P08保持in_progress，experienceAccepted=false**。

## 点状表现的源码原因

已核对项目固定Phaser3.90.0的`Particle.fire/update`、`EmitterOp`、`ParticleEmitter.preUpdate`及Canvas/WebGL renderer。没有下载新配方或纹理，原官方配方出处及MIT声明继续保留于`HeroSkillParticles`和`public/licenses/phaser3-particle-recipes.MIT.txt`。

| 路径 | 旧版实际配置与结果 | 本批处理 |
| --- | --- | --- |
| 持续边缘 | frequency40、life360、quantity1、cap9、speed0；24个边缘点依次出生，粒子本身保持原位并缩小。64px牌上的32px柔点初始全图直径约9.15px，其中实色核更小，随后继续缩小、淡出 | 原纹理沿切线拉伸，用原生x/y/rotate EmitterOp沿项目已有圆角外沿移动；每个出生有原生年龄驱动的短位移 |
| 短fire | cap7、frequency32、寿命480–650ms、向上45–75速度、只发射450ms；64px牌初始全图约14.08px。WebGL ADD叠在浅纸上容易发浅 | 辛弃疾改为持续亮核3粒＋墨绿余迹6粒，均NORMAL；深色余迹先加入牌容器，浅色核随后加入，避免亮部被余迹盖住 |
| Canvas | 不支持粒子tint，旧配置删除color后，两层同用glow单色柔点 | 复用同一32×32柔光生成器，分别缓存ink深绿及spark浅色纹理，核／余迹均真实运动，不依赖tint |
| 静态附加层 | 完整动态下仍以`full:false`画每牌最多4个小圆点，容易强化点状观感 | 只在辛弃疾完整动态样板中清掉这层圆点；减少动态保留原静态归属标记 |
| 层级／遮挡 | 发射器在真实牌容器内，中心死亡区保护本牌＋其他文字；无法证明拉长后的整张纹理不碰到牌面 | 仍附着真实容器，新增整个旋转、缩放后纹理AABB的alpha避让，覆盖本牌、其他完整牌面、文字、原画、控件和屏边；圆角处长度缩至45% |

这些源码事实解释了点状表现，但本会话没有读取父实玩当时的渲染器与减少动态设置，不能反推那一帧必然走哪条分支。远端复验需先明确游戏“减少动态”和系统prefers-reduced-motion状态；减少动态中的静态点不计为持续动态证据。

## 当前样板的具体差异

`XinPerimeterEnergy`只向现有Phaser发射器提供原生配置，使用已有`exteriorOrbitPoint`外沿；序号由原生frequency发射节拍驱动，运动使用Phaser的lifeT，未新增RAF、timer、引擎或游戏随机数。查明Phaser3.90的`emitter.elapsed`只在有限duration时递增，本样板持续流动不使用它计时。x/y/rotate/scaleX共享同一年龄采样缓存。

| 64px牌上的纹理尺寸／基调 | 候选 | 已留 |
| --- | --- | --- |
| 亮核完整纹理长度／厚度 | 约16×3px | 约21.8×3.8px |
| 余迹完整纹理长度／厚度 | 约34.6×6px | 约46.1×8px |
| 余迹基准alpha | .5328 | .74 |
| 出生相位周期 | 3200ms | 2600ms |

尺寸随原生年龄轻微呼吸并在圆角缩短，柔边来自原32px渐变。出生点交替分布在两个相隔半周的短流上，切线决定旋转方向；没有增加整圈粗框。候选／待留仍由实际选择标签区分，确认真实保存后才采用更明确的“已留”表现。

新成功眼神对应候选的初始高光仅增强头两次出生，不增加发射数量；确认留牌的增强只接本次真实`sourceTargetIds`。旧留牌保留常态归属，hide／低动态／重绑返回不补播增强；原先420ms有限来源飞线与手牌差集修复保持，未加入持续来源飞线。所有效果对象均无交互，不修改牌hit区。

配置稳态发射节拍上限从旧边缘25次／秒变为亮核5＋余迹6.25＝11.25次／秒，实际出生还受帧间隔、池上限与死亡区影响；每牌持续上限3＋6＝9，与旧持续9相同。七候选14发射器、63粒上限（旧初始112）；八目标16发射器、72粒上限，仍服从Scene总128。WebGL复用现有白柔光纹理，Canvas两张颜色缓存名义RGBA像素数据合计8192字节；没有逐帧纹理生成、媒体下载或新依赖。CPU／显卡与设备帧率未实测，不用上述预算签性能。

现有柔光纹理足够完成这批方向、明暗与柔边结构，目前没有阻塞性素材缺口；它仍是解析柔光形状，不能据此宣称已有手绘烟丝层次或达到用户认可的质感。

## 工程检查

- 最终9文件70项PASS：`npm exec vitest -- run tests/xin-perimeter-energy.test.ts tests/hero-native-particles.test.ts tests/xin-seven-candidates.test.ts tests/xin-repeat-sequence.test.ts tests/hero-retained-ownership.test.ts tests/hero-target-attachment.test.ts tests/hero-attachment-viewport.test.ts tests/xin-refill-sequence.test.ts tests/hero-action-chain-order.test.ts`。
- 新测试调用固定Phaser实际`Particle.fire/update`及实际EmitterOp，确认10ms／20ms两种delta分割在同一年龄得到相同位置、旋转与alpha，粒子实际沿外沿移动，核／余迹拉伸、候选／已留强度分层及初始增强有限。共享发射器alpha回调实际接入旋转、缩放坐标：纹理尖端接触外部控件时即隐藏，离开后可见；所有测试的渲染外壳仍为Node模拟，未声称真实浏览器渲染。
- Canvas两色缓存仅生成一次，完整双层预算、普通牌对照、隐藏／离屏／低动态清理与无迟到增强、七候选、真实SavedRun两次普通弃牌、来源差集、专用眼神及取消链均在本批范围通过。其他英雄未传新appearance时保持原配方，未改规则或数值。
- `npm run build`类型与379模块PASS，产物`index-cGmHdb0e.js`，时间2026-10-18T09:33:31.485Z。元数据为9e1959cb＋dirty工作树；运行源码随后原样提交为上述产品，新模块当时为未跟踪文件因此不在build-info的modifiedFiles列表里。之后只补了Canvas生命周期测试并重新typecheck PASS。`git diff --check` PASS。
- 开发期间修正了Phaser onEmit可选particle类型签名，旧七候选112预算断言同步为当前63；不把中间失败写成全程通过。没有本地浏览器／全套／CI。`domain/application/content/public/GameScene/package*`无本批改动。

## 交root的同版dot复验

整合产品后分别在PC与竖屏真实新局两次普通弃牌，记录眼神→三候选停留超过3秒→部分选择“待留”→确认“已留”。需看到候选短流与已留较强流的区别、亮核／墨绿余迹连续运动，点数与原画可读，普通旁牌无误附着。第二次只给本次新留牌有限来源与初始增强，旧留牌不重播。再核减少动态静态、隐藏／返回、离屏／退出清理、触控、卡堆不足与快进。持续录屏、主观强度、听感及物理设备性能仍待验；如果仍像扁软点，按同版画面继续窄修，不能用这份Node证据签视觉通过。

## 最新 main 联合整合回执

基线 main `470091912bc225cfbaec09827cb37abf1ab13704`，父已核验该版CI39115601991成功，本线程未重复查询旧CI。正常无冲突合入来源 `ab0d4eb1d5da260bb3d73c241fb961b91ce014dc`，其运行源码与产品 `e0ed4f3d3fde8d5011d0f2fca8c9e135de24333c` 相同；合并后本批3个运行文件及3个测试逐blob精确来源，无整合自改产品。GameScene／被动标签与提醒排除／飞线差集状态、最新13项已绿合同、规则／存档实现、菜单／加载／音频／原图，以及harness／脚本／门禁／依赖均与最新main相同。

来源9文件70项、类型及379模块构建按精确版本复用。仅补有限交叉4文件19项PASS：被动两次真实弃牌选留后直接出牌、实际SavedRun序号和独立眼神、七候选63预算／普通旁牌对照、本次来源差集与旧牌归属；不与来源70相加。联合`npm run build`的TypeScript及379模块PASS，产物`index-cGmHdb0e.js`与来源一致；构建元数据为47009191加待提交普通合并，随后仅写文档。计划与diff检查PASS，结果压缩保留在本目录integration-*.gz。

未跑本地浏览器、全套或自然长局。新样板亮核／墨绿余迹、候选／已留强弱、旧牌不重播增强的同版实际画面仍交父远端dot；先记录减少动态和渲染器分支，再看持续3秒以上过程。配置预算不等于实际性能，Node工程结果不签商业质感、听感、手机或物理设备验收；H17/P08保持in_progress、experienceAccepted=false。

## 可见性回归最小修正

root回传同版dot远端PC `287a38cea83a92195a3a5a9a87ace69100749a94`：正场辛弃疾弃A♥，三候选2♠／5♥／10♣；候选、选中5♥、确认留5♥三个阶段的截图观察均看不到新牌周能量，确认后的头像飞线及“已留”标签仍正常。观察时间为09:52 UTC，不是只截发射前一帧；截图像素未作为附件交给本会话。本记录确认该版出现视觉回退，先前70项工程通过不代表可见性通过。

根因是新配方对固定Phaser3.90出生回调语义的适配错误：`Particle.fire`用`this.x += ops.x.onEmit(...)`及y同式累加偏移；`ParticleEmitter.emitParticle`在出生被DeathZone拒绝时把该Particle放回dead池，**此分支保留x/y**，只有正常寿命死亡的preUpdate路径才调用`setPosition()`清零。旧测试逐次新建Particle并替代getDeathZone，漏掉了“拒绝出生→同一池对象再次fire”。例如一次左侧出生留下x=-60.8，下次返回右侧绝对x=60.8，实际相加成0，落回本牌，再次被杀；y也会累加漂移。这使邻牌／原画／标签的正常保护区连续拒绝错误出生位置。

修复分支 `fix/xin-perimeter-visible-20261018` 以main287a38为基线，产品`b4f4a365103396b07675f159e59cd0370c5c0d7c`只将两处onEmit改为`目标x - particle.x`和`目标y - particle.y`，onUpdate仍返回绝对位置。数量、尺寸、混合、纹理、死亡区及全纹理alpha保护均未改；其他英雄、GameScene、规则、存档、眼神与既有有限飞线均无本批改动。

新增`tests/xin-native-emitter-runtime.test.ts`直接构造固定版本的**ParticleEmitter、Particle、EmitterOp／EmitterColorOp、Frame、Container、Graphics、Zone、DeathZone、DisplayList和UpdateList**。真实DisplayList工厂登记、真实父容器转移及preupdate／update场景节拍运行3.2秒；使用实际layout的三候选和八张手牌排列。牌面／字样范围用Phaser Zone表示，Scene系统外壳、纹理源及字体像素仍是测试壳，未创建本地浏览器／游戏，不把对象状态当成浏览器画面验收。

将相同三阶段测试运行在旧出生代码上，5♥的非透明粒子样本均为0：候选／选中／已留三个一秒段都是`[0,0,0]`；错误落入本牌的出生检查分别23／23／20次，三个用例均FAIL。第一张2♠也为0，10♣曾有少量有效样本，因此不能声称所有ID在所有时刻都为0。修复后三阶段均PASS：有效alpha、正尺寸／Frame、有限坐标的样本总量超过100，三个时间段分别超过10，出生中心不再错误进入本牌；真实死亡区仍会拒绝合法被遮挡点，没有关闭裁剪。普通旁牌没有发射器，结束后真实UpdateList归零。单牌基准也通过，共4项新增原生对象回归。

最终**10文件74项PASS**：`npm exec vitest -- run tests/xin-native-emitter-runtime.test.ts tests/xin-perimeter-energy.test.ts tests/hero-native-particles.test.ts tests/xin-seven-candidates.test.ts tests/xin-repeat-sequence.test.ts tests/hero-retained-ownership.test.ts tests/hero-target-attachment.test.ts tests/hero-attachment-viewport.test.ts tests/xin-refill-sequence.test.ts tests/hero-action-chain-order.test.ts`。测试初次类型检查使用了声明中未公开的alive池字段，已改用正式`forEachAlive/getAliveParticleCount` API。最终`npm run build`类型与379模块PASS，产物`index-mRzCsG02.js`，时间2026-10-18T10:05:00.469Z，元数据为287a38＋dirty出生补丁；受测运行源码随后原样提交为上方产品，原生测试当时为未跟踪文件。`git diff --check` PASS。

下一步由root整合此最小修复后，在同版dot复走A♥→2♠／5♥／10♣→选5♥→确认，跨三个阶段录屏，确认真实屏幕重新可见并保持可读／可点。PC修复后像素、竖屏、质感与设备性能仍未验；不以新增原生对象测试签视觉通过，不扩散到其他英雄。

## 两行出生修复联合回执

以main `287a38cea83a92195a3a5a9a87ace69100749a94` 正常无冲突合入 `87a9baf16525f134a21435ca35ec36efba489b2e`（产品 `b4f4a365103396b07675f159e59cd0370c5c0d7c`）。运行源码与新增原生回归逐blob精确来源，整合未自改运行或测试；本批运行差异仅XinPerimeterEnergy的x/y两返回值及解释注释。粒子数量、尺寸、混合、纹理、死亡区和全纹理alpha保护均原样保留，GameScene／被动提醒排除／飞线差集、规则／存档、原图／音频／菜单加载、已绿合同及全部harness／脚本／门禁／依赖均未改。

精确来源10文件74项、类型及构建按原范围复用。联合只补4文件19项PASS：真实Phaser发射器／三阶段死亡区池复用、被动后直接出牌、两次实际SavedRun和眼神、七候选63预算／普通旁牌及清理；不与来源74相加。联合`npm run build`类型与379模块PASS，产物`index-mRzCsG02.js`与来源一致，构建元数据为287a38加待提交修复；随后仅追加文档。计划与diff检查PASS，原始结果压缩为visibility-integration-*.gz。

父已核验旧287a38的CI39116628078成功，但同版PC候选／选中／已留粒子消失已证实工程检查的可见性盲点，不能用旧绿CI签像素正确。本整合不重复查询旧CI或启动本地浏览器／全套／自然长局。修复后由父在部署同版dot按原A♥→三候选→选5♥→确认跨阶段持续复验；屏幕可见性、质感、竖屏、听感和物理设备性能仍待确认，H17/P08保持in_progress，experienceAccepted=false。

## bab78be5有限PC恢复观察

父会话回传同版远端dot PC `bab78be5be4bc6d8cdb9780ac8a4eebb69f697da`，记录时间10:21：新弃8♥后，候选10♥／K♣／3♥周边可见墨绿细长余迹；选3♥后其顶部可见移动短亮痕；确认后头像只飞向新3♥，后续3♥顶部与右侧仍可见余迹。按钮和选留操作正常。因此只把“完全消失”这一回归标为有限验证恢复，不关闭完整视觉目标。

父主观评价仍相当细／淡，未达到用户要求的绚丽附着。手机与音频未验；本会话未收到录像／截图附件，也不补签3秒连续录屏、其他英雄或设备性能。没有重跑软件测试或构建，本次仅校验JSON与文档差异；上方74项／联合19项仍按各自原版本范围保留。本轮没有运行时补丁、参数调整或新发布。

## 10:21恢复观察时的下一批建议（历史提案）

后续用户已明确阶段方向，当前排程见[唯一总计划](../../DELIVERY_PLAN.md#hero-av-stage-20261018)；下文保留观察时提案，不另起任务或单独发布。

先锁定一个辛弃疾可验视觉样板：PC和390×844竖屏均在正常缩放、无hover／点击下连续观察超过3秒，同屏放普通牌对照；查看者无需放大就能指出受影响牌及流动方向。样板应能分辨短亮核、墨绿气流和柔边尾迹，候选较轻、确认“已留”更明确，点数／花色／原画可读，触控可用。先按这些条件决定一批的画面目标，再实施和同版复验，避免连续零散调参发版。

移动预算先保持现有上限：辛弃疾每牌3核＋6余迹、最多8可见目标72粒，Scene共享128；仍为32px缓存纹理、20Hz归属检查及原生delta更新，隐藏／离屏／退出清理、减少动态静态、不补播旧牌增强和有限来源飞线继续作为验收条件。记录手机、DPR、渲染器与帧时对照，预算数字不能代签设备性能。

| 英雄覆盖建议 | 下一批需核对的实际挂载点 |
| --- | --- |
| 辛弃疾：先完成样板 | 眼神成功→全体真实候选→仅本次保存留牌增强；旧已留保留归属，计分与离手按真实事件释放 |
| 刘娥：样板认可后优先检验复用 | 单张真实交棒目标，来源→目标→实际计分到达及清理，便于验证单牌层次 |
| 苏轼：后续独立确认 | 同实例弃牌代理、斩切与实际倍率到达，普通主牌不误附着 |
| 秦琼：后续独立确认 | 已保存新抽牌、实际赢／输范围及释放 |
| 文成公主：后续独立确认 | 实际蓄层释放事件及真实受益范围 |
| 花蕊夫人：后续独立确认 | 实际付款保存与倍率受益牌范围 |

上表是给父会话的覆盖建议，未自动解锁或派发其他英雄开发，不修改任何规则／数值。其余英雄仍需各自实际过程证据，不能把辛弃疾的有限恢复当作六英雄覆盖完成。
