# 英雄演出接线契约

产品 `0110d725022283d62cd527340728ddae01678f9d`；新身份 `quality-r2-refill-handoff-frequency-v2`。此处只交规则事实，英雄会话负责新效果；本批没有修改XinRefillLock等视觉模块。

辛弃疾：使用导出的laohuanRefillRepeats(before)判断重复身份。真实触发是保存成功的普通DiscardHand，result.ok && !result.duplicate，同runId、receipt.seq===after.commandSeq===before.commandSeq+1，且result.events存在cards-discarded；cardIds为真实弃牌，应逐一在before.handOrder及after.discardPile中核对。普通action现在可完全不带laohuanTrick字段，不能以该字段是否为true作为新规则的触发判据。特殊贬谪／普通出牌补牌没有这个DiscardHand收据，不得混入。

眼神锁定沿用eventId=receipt.commandId+'/xin-refill-lock'、sourceInstanceId=after.runId+'/character'，每个真实弃牌收据各一代。

候选选择：after.pendingRefill非空时，discardCommandId必须等于本次receipt.commandId；candidateIds是本次固定实际候选，required／gap是实际应留数。揭示前的眼神或扫描不得展示未揭示牌数据。候选≤gap时没有pending，实际全部保留；keptIds取after.handOrder中不属于before.handOrder的真实新增ID，不能补造两张候选。

选定落点：保存成功且!duplicate的ChooseRefill，以before.pendingRefill为来源；实际selectedIds是command.action.selectedIds，规范顺序为before.pendingRefill.candidateIds.filter(id=>selectedIds.includes(id))，并须出现在after.handOrder。未选ID进入after.playedPile，不能当第二次普通弃牌。该命令的events沿用空数组，因此不要等待不存在的角色计分事件；以已保存receipt.commandId作为唯一效果键。

当前必需owner修改：src/game/XinRefillLock.ts:13的before.stage.laohuanTrickUsed!==false会过滤第二次正常弃牌。新身份应依上述真实收据／cards-discarded／pending来源校验，不能再要求首次false→true翻转；after布尔仍可true，因为它是历史发生标记，不再是次数限制。本批GameScene.discardSelected已将正常自动触发纳入现有trick演出路径，但该模块过滤未由本owner越界改写。

刘娥：erxiangHandoffLimit(run)返回2；实际次数stage.erxiangHandoffUses为0/1/2，erxiangChoice.remaining提供当前剩余次数。每次真实保存的PlayHand，trace.erxiangHandoff.targetId非null，并存在reasonKey='erxiang.handoff'的add-multiplier事件；targetCardId为唯一真实核心，value为本次转移的实际普通点数（A11、JQK10、数字按牌面）。每手只这一张首次普通计分发生H→M；增强、额外加成、后续重触继续原时序。它是加倍率，不是multiply-multiplier，不能触发乘倍率专用触觉或画成乘法。

所有事件按receipt／eventId去重，只在真实保存成功后发生；取消、失败、duplicate不演，快进／后台／shutdown按现有EffectContext取消规则处理。不新增全屏粒子或用静态文本代替这批由英雄会话负责的动作。
