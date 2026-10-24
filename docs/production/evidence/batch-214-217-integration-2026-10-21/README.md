# PR214–217 独立复核与同版集成

四项工程已按214→215→216→217合入源码main `351e1eab0c9effd13d473ed1dbe53cc8826bdd84`；[唯一索引](index.json)保精确head/merge/PR检查。当前文档/有限交叉脚本独立收口PR不追加生产修改。含本记录的最终main SHA及push/main CI在交付回执核实，避免文档自引用不存在的最终SHA。

## 独立复核

- [iPad审查](independent/ipad/REVIEW.md)：100项相关测试；七个既有手机/桌面端点完整几何等价，三个窄高平板的选角几何严格等价；一次810自然商店章节/道具右缘、工具取消、工坊开合/旋转，state+journal+storage不变。
- [苏轼审查](independent/sushi/REVIEW.md)：64项相关测试；8源码/8媒体hash核对，采集生产文件与最终head逐字节相同；真实新×3=306、旧身份×4=408。两K软件样本CPU p95 0.2→1.9ms、帧p95 20.7→21.5ms、+5对象，结束归基线；未宣传零影响。
- [复盘本审查](independent/review-book/REVIEW.md)：8项相关测试、6源码hash及原8例账本核对。只读真正U09 onStageClear升级事件，末手顺子与最常用两对分开；恢复/缩放/迟图不重播，减少动态静态；不是自然获得道具。
- [技能/理牌审查](independent/dialog-suit.json)：7源码hash与原14例核对，唯一选中花色→同局明确目标→玩家选择；稳定保ID，取消不提交。短页紧凑/长页滚动，关闭左/确认右。六人页面不代六人施放；旧辛主动仅单元/代码。

[源代码并集证明](source-integration.json)：GameScene只改变syncHeroTargetAttachment、presentTrace、inspectAmoExile、inspectHeroExplanation、sortHand五方法，未覆盖。领域、application、content、public与Astra选角/路线源码对9abedd无差异。两共享辅助器以217独立提交`df6a74de`适配真实商店几何和明确花色选择，未改生产代码。

## 同一候选实际操作

候选`e6dc6f2e`合四个已审head后采集，生产源码与最终四路main相同；[cross-check.json](cross-check.json)逐文件hash及操作证据齐全。[脚本](../../../../harness/batch-214-217-integration.mjs)只用一浏览器上下文810×1080（一次1080×810往返）→390×740，不扩大设备矩阵。

1. **自然入口**：真实选苏轼/路线/保存进入→商店章节/道具→购买详情取消→进入牌桌。取消不改state/journal/存储，旋转保状态与选中ID。
2. **受控苏轼**：现有校验导入合法fixture后原生选牌→紧凑技能页返回→确认草稿；蓝只在两真实代价K出现，草稿无命令。真实PlayHand一次、全状态等于applyCommand、×3=306；可见蓄势→原K碎裂→倍率到达及最终清理。[平板蓝K](tablet-blue-compact.png)。
3. **受控手机理牌**：目标页返回不改完整存储；明确红桃靠左，重复整理稳定且保选中ID；原生连续滑选四红桃→明确弃牌一次，完整状态等于原领域命令，弃牌3→2。[滑选](phone-suit-sweep.png)。
4. **受控手机U09**：导入已拥有U09/两对Lv2的合法局后原生出牌，胜利末手顺子而真实最常用两对Lv2→3，提示eventId等于保存事件；冷恢复静态不重播，继续仅一次命令，等级不重加。[升级](phone-review-book.png)。

组合7文件44项相关单测及[typecheck](typecheck.log)通过；[390共享smoke](shared-mobile-smoke.json)编译构建+完整真实选角/筹备/普通出弃/恢复链通过，支持[原始日志](shared-mobile-smoke.log)。没有重跑六人全矩阵或5032项本地测试；远端CI按既有流程执行，不以测试量代玩家验收。

## 保留的FAIL与未验

首次集成采样要求捕获很短的`release`中间帧，断言[FAIL](attempts/release-frame-miss.json)及[日志](attempts/release-frame-miss.log)/[结束画面](attempts/release-frame-miss.png)保留。补充记录完整123帧后，仍未捕获该短子阶段，不能写成逐帧release观感已通过；采样已确认可见蓄势、碎裂时蓄势层已清、×3传送到达，相关单元直接验证精确释放/复位时点。未改生产时序或为通过而削减画面。此次只纠正“必须看到短中间帧”的观察出口；不归咎环境、不签性能改善。

原四路失败和边界分别沿[苏轼](../sushi-blue-king-charge-2026-10-21/README.md)、[iPad](../ipad-layout-2026-10-21/README.md)、[复盘本](../review-book-2026-10-21/README.md)、[技能/理牌](../hero-dialog-suit-edge-2026-10-21/README.md)保留，没有复制大量历史图/报告。

软件Chromium触摸/合成工具栏不是物理iPad8/Safari/GPU。未签全响应式、六英雄实际施放、自然获得U09、长期成长/平衡、美术或听感。Astra原作与64精度保持，A/B仅研究未采用，卖后重买不做，旧候选暂停，没有下一波派工。脚本finally关闭context/browser/Vite；最终交付再核服务退出，不查试玩/部署域名。

用户收口决定：已合iPad修复保留；追加iPad排查/真机追踪按用户意愿搁置，不作为待办。以上未验仅保存历史事实，后续重点PC横版/手机竖版，不追加本次验证。
