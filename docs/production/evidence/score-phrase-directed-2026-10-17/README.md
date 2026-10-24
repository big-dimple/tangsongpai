# 整手节拍与全部有效来源双拍：软件样本

基线 `9fe60fc581227829df6caadc712a5bd0fed74bc4`；独立分支 `dev/score-phrase-directed-20261017`。产品 SHA 见 `delivery.json`。P08 仍 **in_progress**，未试听，未做物理手机或主观重量/整体体验验收。

直接观看：[PC 连续音画](after/pc/av-continuous.webm)、[390 连续音画](after/phone/av-continuous.webm)、[390 / 4×](after/fast/av-continuous.webm)、[十亿倍率 / 4×](after/billion/av-continuous.webm)。包含真实 Canvas 与同一 AudioEngine master 的 VP8+Opus，没有另配音轨。对照：[原 PC](before/pc/av-continuous.webm)、[原 4×](before/fast/av-continuous.webm)。

像素检查：[PC 多彩飞行](after/pc/polychrome-flight.png)、[390 多彩飞行](after/phone/polychrome-flight.png)、[390 乘法命中](after/phone/multiply-hit.png)、[390 新值回弹](after/phone/multiply-pop.png)、[收束](after/phone/converge.png)。多彩与收束图片由原始录像用本机 Playwright 附带 FFmpeg 解码；定位时间由首个 postrender 估算，元数据保留，不把其近似时间当精确同步判据。精确同步以实际 Tween/音频调用/声部/逐帧记录为准。

旧包16330的“条件帮助”遮住待出标题已在本批当前9fe基线复核：[同版390选牌截图](after/phone/selected.png)完整显示“待出牌”，条件帮助位于右下技能行（运行时框 x334/y453.6/w44/h44），与标题不相交；上述动态命中截图完整显示“已出牌”。未复现孤立“牌”字，无新增布局改动，未回滚苏轼贬谪规则。此检查只描述本地当前源码，不把旧域名包当当前包。

## 产品变化

- 同一个 ScorePhrase 预算贯穿 EffectQueue 与 JokerScoreStrike。按已保存顺序起势、连发、最大真实乘倍率重拍、H/M 汇聚及总分收束，不排序、不跳过事件、不改算术。
- 所有结算前真实有效来源均双拍，包括重触；同一 eventId 的 arrival 只发一次主击，同一 Tween 的实际回弹发一次第二声。源牌内层抬起、左右摆动；固定槽位/命中不动。结算后成长保留弱单回执。
- 普通填拍缩短、减轻，来源拍渐密；连发传既有 `pulse` 五声轮廓 0..4 与 `accentWeight`，不持续升八度或反复使用厚层。唯一最大真实乘倍率在 4×仍有独立蓄势、命中及回撤留白。
- 飞行副本改为图像与材质同一个容器，使用保存的真实 edition、同一共享 15fps 多彩组件；源牌飞行时仍保 42% 可见度。H 命中热度、M 命中倍率，旧字碎裂后显示保存 after，总分仅最后汇聚。
- 未改 AudioEngine/素材、领域/应用规则、EffectQueue、手机布局、英雄专属附着；保留苏轼贬谪基线。没有复制原型 Orchestrator/HitStop timeline、独立 AudioContext 或 timer。

保留来源实际提交为 `fbb614a84087060c99e8973c118a473771448984`，已只读比较其 `ScoringRhythmOrchestrator.ts` 与 `HitStopPresentationTimeline.ts`。采用整手层级和关键拍留白；继续使用现有精确 Rational、真实来源身份及单一可取消队列，未采用原型 Number 算术/替代身份/第二时钟。

## 实际结果

| 同一库存 | 基线 | 本批 |
|---|---:|---:|
| 有效来源双拍 | 6 / 13 | 13 / 13 |
| PC 实际 presentation 区间 | 17.39s | 13.54s |
| 390 / 4× 实际区间 | 7.88s | 7.86s |
| 4×关键乘法实际事件区间 | 300ms | 451ms |
| 4×来源连发前四/后四间隔均值 | 750 / 425ms | 716 / 383ms |

4×总时长基本持平，增加了全来源第二拍与关键可见性。来源间隔包括真实从属数字，未宣称每个相邻数字都单调加速。普通 PC/390/4×的主击→第二声实际范围约65–132ms；全部13来源在活动阶段实测抬起超过4px、角度同时越过±1°，不拿休息漂浮凑摆动。每案5笔真实数值来源均命中正确H/M，临时旧字隐藏及精确 after 显露，途中总分 pulse=1；多彩在飞行/命中/回撤逐帧有材质实例。共享材质最多3项，真实计分声部最多3，十亿样本最多6，均未超预算。

PC、390、4×、减少动态、十亿倍率、关键蓄势取消、关键回弹取消共7项 PASS。十亿样本有5笔真实数值来源与1笔后成长：前5笔全双拍，后成长不摆动、不双拍、weight<0.3。减少动态无冲撞副本，数字始终可见。两处原生取消按钮实际派发 phase 分别是 accent/windup 与 accent/rebound；随后计分声部/冲撞对象/旧字纹理均0，源牌alpha恢复1，无迟响。

所有完整/取消样本结束后状态与真实领域 oracle 精确一致；PC/手机原生重复出牌输入没有重复命令。PC hover冻结/键盘、PC及390长按调序仍通过。受控检查点导入不代表自然获取或完整长局。

本次复用的 chain/billion 库存明确使用 frozen pre-exile 的 `quality-r2-s04-finish-v1` 身份，画面“余音袅袅”属于该控制样本，不能据此判断当前新局贬谪缺失；实际 contentHash 记录在 `delivery.json`。领域/新局身份/贬谪专属代码相对9fe无改动，本批没有额外跑一次新贬谪闭环。

35项定向单测、typecheck、production build均通过。构建只有既有500kB分块提示。详见 [summary.json](summary.json)、[计划与实际时间分列的 CSV](timeline.csv)、[检查记录](checks/)。基础与后续两次运行的运行时源码哈希一致性已核验，基线源码哈希也与9fe实际Git对象比对一致。

## 原始失败与复检

原报告不改写为 PASS：[初次矩阵](first-matrix-report.json.gz) 内PC/390/减少动态/4×通过，大数停在旧观察断言；[第二次观察失败](second-observer-failure-report.json.gz) 与截图/逐帧保存在 [observer-failures](observer-failures/)。第一次要求结算后成长也摆动，第二次要求窄屏大数显示未经宽度压缩的文本；分别改为明确检查轻回执，以及同时检查真实 fullText 与非空压缩显示。没有改产品来迎合这两条断言。最终 [边界/大数原报告](final-boundaries-report.json.gz) PASS，和前四案使用相同产品源码哈希。

首轮单测快进总时长未过，已缩短从属数字预算，保留原 .55 总时长界限与双拍/可见性下限；新增成长回执测试首次筛错操作名，修为真实 `add-growth`。失败日志、修正后35项全过日志均保留。

本批未重跑320/短横、后台、回看、销毁、六英雄或长局，不借旧证据填本批 PASS。听感、真人理解、物理设备及整体爽感仍待验。
