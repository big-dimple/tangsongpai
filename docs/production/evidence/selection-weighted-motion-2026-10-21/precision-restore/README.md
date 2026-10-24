# 原64段精度恢复与明确开局入口窄修

[唯一索引](index.json)。基线main `fbdaaeeca2343b58ed26969f735260673ab1528b`；原视觉参考为`53c2abd5bd77a2aee12ed43a030314845bac2da9`。只恢复B轮廓精度/原浮点顺序，以及删除CharacterSelectScene中一次重复确认；其他按钮、时钟、印记、颜色、宽度、粒子数量、演出及规则/存档不改。

## 视觉等价证据

64→24不是纯缓存，先前“小于1 CSS px”也不等于视觉完全无损。本次恢复64段/每条130顶点；保留130点数组复用及相同区间的中心线/法线缓存。保原`start+(end-start)*i/64`和`width*taper*roughness`的求值顺序，不将乘除重排；用Object.is识别缓存区间。参考夹具逐字保留53版本的原几何主体，测试严格deepStrictEqual坐标与顶点顺序（含复用命中、区间变化、退化及早期反向细裂隙），不再用容差。

[result.json](result.json)/[check.mjs](check.mjs)：单桌面场景中7个B阶段，真实Phaser Graphics命令缓冲逐项Object.is相等；同尺寸Canvas渲染每个阶段像素通道差为0，非空阶段确有墨迹。t=.4的[原53 PNG](original53.png)与[恢复64 PNG](restored64.png)像素哈希完全一致。这里验证的是同一引擎/同一输入下的精确B几何和渲染语义；不是用户美术签收或所有物理设备画质认证。

实际原生切换观测峰值回到2532；**1092是撤回的24段方案历史数据，不沿用为新版指标**。本次不测FPS、不做性能矩阵，不承诺整体提速。其他演出绘制代码逐字不变，复用不改调用顺序或样式；若需要改变画面来取舍性能，先让用户看到原作/候选比较，再由用户决定，不能擅自替换，并非永久禁止取舍。

## 只移除这一路二次确认

真实路径：牌桌/筹备菜单“开始新局”（仍先flush原局）→选人物→选路线→“开始对局”。此前有未结束旧局时，confirmChoice再次弹“开始新局？”/“确认开始新局”；现在该明确操作直接调用原来的choose/startRun流程。旧局因此不再有这一次取消弹框；仍可在提交前通过原选角返回流程继续旧局。Title/菜单其他确认、保存错误/候选提示均未删。

只删除5行弹框分支，choose、GameSession.start、保存成功后await确认动画、单次启动guard、路线与开局规则均保持。一次点击仍完整蓄力→离地→落击停顿→复位/收束；重复确认沿既有skip行为，只在落击复位后最早t≥.7收束呈现，不重复建局，未增加跳演出行为。

[start-check.mjs](start-check.mjs)真实桌面原生输入先建一个已保存旧局，再经菜单走该入口。无手牌/存档注入。三例结果：

- 首次single记录在[start-first-fail.json](start-first-fail.json)的已通过case：一次启动、一次实际commit、revision1→2、一次确认Promise完成和一次入店；无新局确认框，路线为straight，完整演出到t>.9，退出节点/监听清理。
- [followup](start-followup-result.json)仅补repeat/save-failure，没有重跑single：重复点击/Enter也只启动/保存/入店一次，最早停止progress≥.7，压缩/22px离地/落击被实际观察；孤立IDB保存失败时无成功演出/入店，旧controller与原保存整tuple不变、候选与原错误提示保留。
- 原FAIL不删：首次repeat用postupdate检查t≥.7，停止回调已同步清掉motion，观察器错过末帧而断言失败。修正为转发原stopFeedback并读取它停止前的原progress，未改产品；原日志与singlePASS一起保留，结果按source hash关联。

所有采集来自提交前工作树，源码SHA256与交审提交精确对应；没有冒称完整最终head重跑。浏览器/Vite在finally退出。既有旧布局FAIL、真机/听感/完整响应式与全组审美边界不扩大签收。A/B平衡实验、难度/英雄数值和其他候选均不触碰。

相关4文件29项测试与类型检查通过，计划结构/链接/原32包状态依赖及diff检查通过。搜索到若干历史扩展harness仍等待旧“确认开始新局”选择器（不在默认CI），本次未改/未跑，不冒称旧全矩阵通过；本次入口合同由更新后的专用单元和实际三例覆盖。
