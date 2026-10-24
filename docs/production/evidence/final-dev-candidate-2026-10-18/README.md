# 当前最终开发同版候选

分支 `dev/windows-experience-integration-20261017`；被测产品 **e171eb353b2bf2843947afc32c0a08b1260b057c**。最终Git SHA见推送回执，收尾只改文档。已接当前给出的全部来源；没有等待中的源码SHA，也没有扩展本批范围。只普通push dev，main9fe未动。

|已实际接入|准确来源/入口|
|---|---|
|音乐滤波、modal层、真实下一曲准备|e6bec936；AudioEngine/main/ShopScene生命周期保持。|
|整手双声/多彩/H-M来源、idle平滑|cdfd345f＋bffcb58a；idle唯一模块按源追加，材质仍15fps。|
|五人增强与苏轼弃牌来源|ad9fb069→3b094296；已替换苏轼只主手环流预览。两份owner patch实际应用提交92f2824b，非仅存在模块。|
|白话额外加成、常驻菜单及保存入口|dd74020e＋0c9ebae8；保留多彩/技术ID和原保存revision保护。|
|商店大图/整行/共享滚动、路线与花色|4463e3cc→57de14a2；消费前直接换路线，取消/余额不足不锁，实际消耗共享次数后才锁。旧选择即锁规则废止。|
|秦琼/辛弃疾弃牌footer|5fba3ecc；未选可见禁用、卡列滚动、说明折叠、成本风险首层。现有GameScene两角色入口仍调用实际组件。|

## 两份补丁的真实生产接线

[生产入口审计](actual-hook-audit.json)列出实际方法/行号：create379构造HeroTargetAttachment；syncHeroTargetAttachment1042用既有choice.discardedIds预览；presentTrace2242/2243从真实discardedIds逐牌begin/cut；showScoreEvent2007只在非replay的amo.exile事件使用同一actual packet impact Promise送入M落点。playSelected1829真正进入presentTrace，不从旧助攻代替贬谪。

辛弃疾在discardSelected1777实际调用showXinRefillLockEyes：成功/非重复结果检查及this.run赋值先于入队，effects.drain先于现有renderHand/revealDrawnCards；showLaohuanPayoff晚眼神已移除，showKeyHighlight重复入口加guard。inspectTouye1440及inspectLaohuan1446分别调用秦/辛真实选择组件。具体参数和顺序见JSON；[实际GameScene增量](actual-GameScene-wiring.diff.gz)精确等于两份源补丁的16增10删，不整份复制旧场景。

实际源码应用后92f2824b类型通过，最终footer合版e171eb35再一次类型通过。只做必要类型、源码身份与静态入口/调用顺序核对；这不能代签动态。静态观察器曾因构造函数和旧render名称假设中止，纠正观察器后通过，产品未为其改动；记录保留在审计JSON。源Xin patch第7/12行含必要的空行上下文前缀空格，原字节保持；正常空白检查覆盖其余合并文件及实际GameScene应用增量。

来源29/17/13等窄测及各批type/build按各自SHA复用，不与以前112或其他源测试相加。本轮没有本机browser、长局、新矩阵或生产构建；当前预算未重测，原1337预算FAIL未关闭。苏轼当前自动弃余牌×4规则不改；自主选弃、数量收益与具体数值仍待用户确认，没有擅定数值。

## 远端待验

由root协调最终同版Dot一次，重点核PC/390/320商店/路线/花色/原图与菜单实际命中，保存并发/异常、角色footer首屏可达；同一正式连续过程核音乐与SFX旁路、完整计分多彩双声与取消、idle，以及苏轼真实弃牌→arrival/辛弃疾候选揭示前眼神和去重。详细有限清单见[当前验证记录](verification.json)。不扩成新全量或机械长局矩阵；主观强度/听感/实体设备与P08仍未签。

## 最后一次有界回归与新反馈

收口只额外执行sushi-discard-local、xin-refill-lock、hero-discard-footer、workshop-route-state四文件，**4文件21项全部通过**，执行HEAD52ef34a4，运行源码与e171eb35相同。原日志见[最后窄回归](final-targeted-tests.txt)；不与来源或旧112项相加，没有继续扩测试组。实际接线、类型与这次窄回归已完成，无待交源码SHA；main交root按既有授权和审批办理，本分工只push dev。

用户新实测“音乐可能每几秒重播/没听到战鼓”已由root交原音频owner独立排查实际播放/触发链；本回执未核定反馈版本，未证明或否定当前同版阻断，不以文件时长替代听感，也没有为此新增本机试玩。它与远端同版动态/设备验收、未来苏轼规则取舍明确保留，不阻本批既定接线收口；后续确认实际故障再由root处理。
