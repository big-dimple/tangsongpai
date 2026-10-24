# 技能弹窗与目标花色靠左窄修

基线 `9abedd0195881c64c730f13e26b66c54f94b3716`，生产源码提交 `818d8e5cc2f73b7bac8ae20a91b2b4b664ff9c81`。独立分支 `fix/hero-dialog-suit-edge-20261021`，交父唯一集成，不在本路合 main。

## 修改范围

- `HeroSkillDialog.ts/.css`：只对显式挂载的牌桌技能页使用内容高度，上限为安全视口；头尾保留，内容区负责长内容及展开详情的滚动。底部返回移到左侧，确认在右侧，同时保留关闭按钮焦点。秦琼/旧主动辛弃疾的弃牌选择也用这一高度规则；加强根选择器优先级，避免旧的 660px 固定高度覆盖。
- `HeroSkillGuide.ts`、`HeroDiscardChoice.ts`、`AssistChoiceDialog.ts`：挂载上述专属样式。未改通用 `DetailDialog`、`style.css` 或选角/商店说明页。
- `HandSuitSort.ts`：稳定分组，目标花色全部靠左，其他牌全部靠右；两组都保留各自原次序，不改牌张对象。
- `GameScene.ts` **只有三个方法改变**：`inspectAmoExile`、`inspectHeroExplanation`、`sortHand`；另外增加 `suitSortTarget`、`suitSortRunId` 两字段及两条 import。未改任何布局方法。AST 对比已核。技能回调、可用条件及真正出牌/弃牌生效的代码不变。
- 未改苏轼蓄势/蓝色演出、`ShopScene`/`ShopLayout`、选角、Astra、规则/数值/内容身份、存档格式、音频或计划。

## 实际理牌入口与目标来源

牌桌只有 `action/sort-suit`（按钮“花色”），原来按固定 ♠♥♣♦ 顺序并清空选择；没有独立“选同花色”入口。`inspectCandidates` 的“同花/换为这组”仅改选中 ID，不会把牌重新排序，因此本修限定在花色理牌入口。

目标按以下来源确定：当前选中牌只有一种花色 → 同一局已明确整理过、而且当前仍存在的花色 → 让玩家点选花色。首次空选择或混合选择没有已知目标时，不猜最多花色、不随机选花色。对话框只列当前手牌已有的花色和数量；返回不提交命令。

花色理牌保存点按时的选中 ID（中断手势的取消不能覆盖它），不清技能草稿；终止已过期的候选预览/撤销。仍使用原 `ReorderHand`、输入、FLIP、出弃牌路径。点数整理维持原有返回未选状态的行为，不扩改它的合同。

## 有限核验

- 11 个相关单元文件，101 个不同用例已通过。9 文件批次中 86/87 通过，技能说明的一项在并发负载下超过原 5 秒限制；原记录见 [unit-contention-timeout.log](unit-contention-timeout.log)，随后整个说明文件隔离重跑 4/4 通过，见 [guide-isolated-pass.log](guide-isolated-pass.log)。另外两文件 14/14 通过，见 [compatibility-pass.log](compatibility-pass.log)。没有跑全仓测试或宣称全量 CI。
- `npm run build`（包括 `tsc --noEmit`）通过，见 [build.log](build.log)。产物记录生产源码提交 `818d8e5c`，构建 CSS 含最终专属优先级规则；既有大包提示保留。
- 最终浏览器结果、逐页矩形、滚动量、花色顺序、选中 ID 及源码 SHA-256 以 [report.json](report.json) 为准。1366×900 鼠标与 390×740 触摸模拟；六英雄牌桌入口、详情展开、底部操作、秦琼取消确认、苏轼草稿选择/取消、理牌明确选择/重复整理、连续滑选及主动弃牌。受控测试局经现有 `session.importJSON` 校验装载，后续交互为原生鼠标/触摸/DOM；不是自然获得的完整游戏局。
- 花色反例手牌：`♠7 ♥2 ♣9 ♥K ♦4 ♥5 ♥8 ♣3` → `♥2 ♥K ♥5 ♥8 | ♠7 ♣9 ♦4 ♣3`。重复整理次序、选中 ID 均不变；滑选四张红桃后，只有主动点“弃牌”才提交一次命令。完整弃牌后状态与现有 domain 命令计算逐项相等，弃牌次数 3→2。整理不改牌组、RNG、金币、出牌/弃牌资源及历史得分。
- Linux Chromium 151、Canvas、软件渲染；没有物理手机/iPad、WebGL/GPU、音频、帧率或整体审美签收。截图是本路自采，未冒称看过 Library 原附件。

复现：`node harness/hero-dialog-suit-edge.mjs`；只跑理牌/滑选/弃牌可设 `DIALOG_SORT_ONLY=1`。默认两个上述视口，不提高演出速度。脚本结束关闭浏览器及 Vite 服务。

## 原失败与修正

1. [initial-harness-setup-failure.json](initial-harness-setup-failure.json)：旧 harness 依赖已移除的“进度与存档/导入本局”菜单，尚未进入功能验证；改用现有校验导入方法作为 fixture setup。
2. [fixture-king-condition-failure.json](fixture-king-condition-failure.json)：受控苏轼测试把全部 K 放进主手，原确认条件正确禁用。改为只选两张 K，仍有余 K，未改生产条件。
3. [initial-unit-dom-fake-failure.log](initial-unit-dom-fake-failure.log)：旧测试 DOM 替身缺少标准 `firstElementChild/prepend`，补齐替身；另一个苏轼 copy 测试让 open 返回真正的模态结构替身。
4. [before-discard-height-fix.json](before-discard-height-fix.json) 与 [原手机秦琼截图](before-390-touye.png)：早一版检查只核 footer 可达，虽然记录 PASS，但目测发现 Qin 仍高 660px、有多余空白，故该 PASS 不作为最终高度签收。修正专属 CSS 优先级，并增加内容高度与实际内文的差值检查。
5. [overstrict-gap-check-failure.json](overstrict-gap-check-failure.json)：新检查 40px 误伤原生段落边距/内边距合计约 44px；有限容差改为 64px，仍能抓住旧 Qin 大于 160px 的空白，不改产品样式。
6. [cold-boot-navigation-timeout.json](cold-boot-navigation-timeout.json)：与构建并发时冷启动 `load` 导航超过 30 秒。最终采集等构建结束再单独运行，启动等 DOM 和实际 title ready，最多 60 秒；操作阶段仍为 30 秒，没有速度或性能结论。

旧 JSON 中 PNG 路径是当时 `shots/` 下的工作路径；归档的旧图仅上述秦琼 PNG。最终截图和结果在本目录，旧记录不冒充最终版。

## 六英雄覆盖边界

以下均在 1366×900 鼠标及 390×740 触摸模拟各实测一次；不将代码未改当成实际发动覆盖。

| 英雄 | 本路实际 UI 操作 | 未新增的浏览器发动覆盖 / 仅审查或单元 |
| --- | --- | --- |
| 苏轼 | 牌桌说明→贬谪页、折叠/展开、返回、选择贬谪草稿→取消草稿；原局状态不变；确认在右 | 没有新跑一次真实出牌 ×3 或蓝色演出；回调、K 条件和兑现代码未改，原条件及文案单元保留 |
| 刘娥 | 计分牌候选页、折叠/展开、返回，长页滚动与 footer 可达 | 没有新选一个目标后实际技能出牌；候选回调只代码审查 |
| 辛弃疾 | 当前新局的被动说明、规则/示例展开、滚动、返回 | 当前身份无主动确认页；旧档主动另选弃牌的 handoff/过期保护经专属单元核验，未新跑该旧身份浏览器路径 |
| 文成 | 技能页在未蓄势状态下的操作禁用、细则展开、返回与滚动 | 没有新跑蓄势→释放的真实出牌；确认条件/回调未改，只审查 |
| 花蕊夫人 | 三个支付档与说明页、细则展开、返回和滚动 | 没有新付金币实际出牌；真实当前档位/文案与示例经单元核验，回调只审查 |
| 秦琼 | 另选一张弃牌→选押注牌型→确认页→取消；原本主手选择与本局状态不变；footer 顺序与可达 | 没有实际提交这一押注换牌或再打出赌注手；handoff/确认防过期经专属单元核验 |

连续滑选和普通弃牌另用受控文成牌桌实测，与上述技能发动覆盖分开记账。原始 Library 截图没有在本路读取，不作为本路看过的证据。

## 父集成的共享 smoke 适配项

未改 `harness/ui.mjs` 或 `harness/screenshot.mjs`，也未新跑默认全量 smoke。当前 smoke 主循环约 146 行先点数整理清选择，再直接点“花色”等一个 `ReorderHand`；现在应先在目标选择页明确点一种花色，再等待命令。已备好 [smoke-suit-target-owner.patch](smoke-suit-target-owner.patch)，只改该理牌测试段，供唯一集成 owner 合并共享 harness 时使用。它还检查仅打开目标页没有提交命令。此补丁为建议，**本路未应用、未实跑该共享脚本**；专属 harness 已实测相同明确目标交互。商店入口/布局适配继续由父线程负责，不能把本路 PASS 当成整批 CI PASS。

## 最终采集结果

最终 `report.json` 为 **14/14 PASS，页面错误 0**，7 份生产源码 SHA-256 与当前提交完全匹配。苏轼折叠高度为桌面 293.19px、手机 322.88px。秦琼由旧 660px 收为桌面 521.78px、手机 519.78px；两端均通过空白高度检查。手机长页最高占安全视口 716px，刘娥/辛弃疾/文成/花蕊展开后实际滚动量分别为 156/165/161/505px，底部操作仍可达。苏轼展开后内容可全部显示，无需强制造滚动。

桌面/触摸连续滑选四张红桃和一次明确弃牌均 PASS，序号各只增加一次，弃牌次数各 3→2。测试 `finally` 已关闭浏览器和 Vite，结束后 5583 无监听。未查部署域名、未启动试玩服务、未合 main。
