# Hero score status and finite card body response

Base: 0e38137c1c4f4197ee27e8d61ebc57682e52065f. Branch: dev/hero-score-status-20261018. Product commit: containing commit of this directory. No main/CI/deploy action.

已保存的结局仍立即进入领域状态；演出中的公共英雄按钮、头像说明和ARIA统一显示“结算中”，正常完成或快进完成后才恢复真实状态。六英雄真实过关存档均覆盖，存档与trace不改。

原手牌布局、选中抬升和命中区域仍由外层容器负责。原印刷牌面进入内层card/body：选牌和合法草稿只做一次有限轻抬/倾斜，真实正向HeroScoreAction的targetIds由同一个EffectContext/ScoreBeat驱动朝来源蓄势与短甩回正。只复用现有弹簧和Scene update；没有新RAF、定时器、音频调用或技能消费。选择/弃牌标记保留外层，真实计分优先于输入；减少动态、取消、销毁回正。

最终同次定向运行：11文件105项全部通过；npm run build（含tsc）通过，391 modules，保留既有大chunk警告。命令、逐文件结果、LF源码hash和构建hash见verification.json。未做browser/GPU/物理设备/听音验收，也未跑全库矩阵。P08仍in_progress。

## 合批接点

外围负责人保留AttachmentCard.container为原外层cardFace，避免把目标牌误识别成旁牌遮挡；只将外围视觉挂到新增visual或container.getData('cardBodyRoot')。外围遍历本牌文字/原画时需按祖先归属识别新的内层，不能再假定印刷对象的直接parent就是外层。阶段身份和原arrival回调保持不变；本批没有改外围模块，内层贴合待该负责人合批接入。

音频候选77df5f4adef8691cc2e5e5c6adc7b91e707206c9未采入本分支，交父线程同批整合。本批不改consumePerformance或主击/回弹回调。现有真实Tween的名义impact→rebound窗口（ms）如下；帧采样可稍晚，原生测试在六英雄1/2/4x均验证实际至少50ms。

| 乐句 | 1x | 2x | 4x |
| --- | ---: | ---: | ---: |
| opening | 79.286 | 59.643 | 53.095 |
| run，progress=.5 | 70.119 | 55.060 | 53.095 |
| accent | 112.619 | 83.810 | 82.500 |

公式为(hold + recovery × STRIKE_RETURN_LANDING) / speed。主击沿唯一arrival，第二声只沿同Tween真实rebound，继续复用owner/run/generation/eventId/sourceId/targetIds/signal；无需另发一套声音。完整合批的像素贴合与双声听感仍待整合线程验。
