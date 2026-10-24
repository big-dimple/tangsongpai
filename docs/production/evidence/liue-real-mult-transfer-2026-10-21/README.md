# 刘娥：真实普通牌点 → 听政倍率

基线：远端 main `6892aabf68f3e8d90dfc0a5597cce7f96025e81d`。原交付候选是 `7d56ed5e05ade7609cc525783f7886784387c684`，其生产代码来自 `427e9998c4adab74977527fcb0ad7f319be751d2`。本次审查窄修的生产提交为 `bb56c1442b2f4270f55d02f48d6d10179847fa35`，只将新增状态由“本手已转入”改为“本次已转入”，同步专用断言和采集证据。最终分支 SHA / 对应 CI 以 PR208 head 与交付回执为准，本文不自引用包含自身的提交。没有合 main、强推、删除分支或访问部署站。

## 本次文案修正的实际落点

本轮仅跑专用单测 12/12 和桌面/390 两例真实 +8 转换，没有重新运行原15例矩阵。两例均从**干净提交 `bb56c144`** 采集，原始 report 的 `dirty` 为空，新增 `sourceHashes` 记录运行前源码/测试/harness 哈希；保存结果仍是倍率10、430分。后续提交只收证据与表述更正，生产文件内容可与这些哈希逐一核对。

| 视口 | 实际命中文字 | 连续过程 |
| --- | --- | --- |
| 桌面 1366×768 | [听政 +8倍率／本次已转入](copy-review/1366-8-normal/impact.png) | [连续录像](copy-review/1366-8-normal/process.webm) |
| 390×844 | [听政 +8倍率／本次已转入](copy-review/390-8-normal/impact.png) | [连续录像](copy-review/390-8-normal/process.webm) |

本轮原始逐帧/保存记录在 `copy-review/report.json.gz`，哈希在 `copy-review/source-sha256.json`，实跑命令与专用单测日志也在该目录。静态截图只证明最终文字，动画仍以连续录像为依据。

## 历史15例与源码版本的关系

以下原矩阵是**历史分阶段采集**，不是全部在最终 PR SHA 重跑：

- skip/reduce/live-reduce/resize/blur/hidden 以及修后 exit 的 report HEAD 为 `6892aabf`，同时明确记录了生产源码 dirty；当时未逐次保存完整运行源码哈希，不能把它们说成 main 原样，也不能用后来的哈希文件倒推为精确最终源码。
- 原双端8/10、stop 后 remove、special、replay、speed4 的 report HEAD 为 `427e9998`，记录的生产文件没有 dirty，但 harness/证据有未提交变化。其生产代码关联可从 HEAD 和 git status 判断，仍不等于整个最终提交在每例上重跑。
- 本目录原 `source-sha256.json` 已逐项对照 **`7d56ed5e` 的 Git tree** 验证匹配；它是该旧候选的文件清单，不是上述 dirty 运行时快照。新文案使用独立的 `copy-review/source-sha256.json`，不覆盖历史哈希或原 FAIL。

`index.json` 已为每例补入原始报告路径、完整采集 dirty 状态及证据身份边界。本次两例与原15例分列，不宣称本次重跑了全部矩阵。

## 实际改动

- 新增刘娥专用 `LiueSkillPayoff.ts`。只接收已保存的 `erxiang.handoff` 首次普通计分事件，显示真实 `+N 倍率`；来自该事件的实际目标牌，上浮蓄力后随原计分时钟进入听政按钮，命中时显示此次技能实际转入量，结束后恢复按钮。
- `GameScene.ts` 仅增加刘娥事件接线、刷新及生命周期清理；既有英雄牌飞行、冲击与计分到达时钟保持。
- `LiueListeningStage.ts` 增加数字蓄力回调与失焦清理；保留原耳形比例和声波。另修正真实场景离场时耳朵销毁回调再次销毁自身的问题。原 main 也能复现，原 FAIL 已保留；修复完全位于刘娥专用模块。
- 数字包不修改源牌 alpha、visible、缩放、存档或规则；不复制苏轼碎裂，不生成素材，不恢复烟雾。增强、版次、重触仍按原规则分别计分。

未写总计划、根 AGENTS、公共 CSS、SceneView、商店、选角或其他英雄模块。附件 `libfile_ca68387a3a388191bb14ff29f27fb989` 未读取，未以它作为完成依据。

## 原候选双端前后与连续录像（旧副文案，保留历史）

静态图只供对照构图和可读性；动画依据以下未经剪辑的浏览器连续录屏。录像为画面轨，不证明系统音频或听感。

| 视口 / 实际源牌 | 原 main | 原候选画面 | 连续录像 |
| --- | --- | --- | --- |
| 1366×768 / 8♠ | [原蓄力](before/1366-charge.png) | [数值来源](after/1366-8-normal/charge.png)、[技能命中](after/1366-8-normal/impact.png) | [原过程](before/1366-process.webm)、[+8 完整过程](after/1366-8-normal/process.webm) |
| 390×844 / 8♠ | [原蓄力](before/390-charge.png) | [数值来源](after/390-8-normal/charge.png)、[技能命中](after/390-8-normal/impact.png) | [原过程](before/390-process.webm)、[+8 完整过程](after/390-8-normal/process.webm) |
| 1366×768 / K♠ | 原主流程/几何同上 | [数值来源](after/1366-10-normal/charge.png)、[技能命中](after/1366-10-normal/impact.png) | [+10 完整过程](after/1366-10-normal/process.webm) |
| 390×844 / K♠ | 原主流程/几何同上 | [数值来源](after/390-10-normal/charge.png)、[技能命中](after/390-10-normal/impact.png) | [+10 完整过程](after/390-10-normal/process.webm) |

每例均由有效当前身份受控 checkpoint 冷启动，正常继续→选牌→选听政目标→取消→重选→真实出牌；重复鼠标/触摸输入仍只有一条保存命令。它们不是自然获取或平衡证据。

| 真实转换 | 事件中热度 | 事件中倍率 | 最终 H / M | 最终得分 |
| --- | --- | --- | --- | --- |
| 8♠ 的普通 8 点 | 35 → 35 | 2 → 10 | 43 / 10 | 430 |
| K♠ 的普通 10 点 | 35 → 35 | 2 → 12 | 45 / 12 | 540 |
| K♠ + 返场纸/箔光 + b06 重触 | 普通点只搬一次，额外事件独立 | 只出现一次 +10 转换 | 150 / 12 | 1800 |
| 2♠ / 回看核验 | 普通点只搬一次 | 2 → 4 | 37 / 4 | 148 |

各例均将实际 state 与同一原始 state + 真实 journal 经 `applyCommand` 得到的完整结果逐项对比，校验保存 checkpoint；来源牌不在 discardPile/destroyedIds。逐帧记录包含源牌、包值、落点、倍率、耳朵 scale、事件 ID。完整原始记录见 `reports/`，摘要见 `index.json`。

## 原候选实跑验证（本次窄修前）

- 原候选生产代码：`npm run verify:ci -- --scope=domain` PASS，414 文件 / 5009 测试，内容核验 PASS。专用生命周期测试 15/15；独立 typecheck 与 `npm run build` PASS（原有 >500 kB bundle 提示保留）。
- 原候选生产代码：本地 Chromium 桌面/手机 `npm run verify:smoke` PASS。Firefox/WebKit 本地未跑；新文案的 PR CI 结果另核精确 head，不沿用旧 CI 作为新 head 的通过证明。
- 真实两端 8 与脸牌 10；选/取消、选牌失效、重复输入、快进、减少动态、运行中切换减少动态、resize 延迟重绘、blur、hidden、场景 stop、stop 后 remove、增强/版次/重触、4 倍速、原生菜单进入的回看均跑过。快进调用现有公开 `fastForward()`；blur/hidden/stop/remove 是明确的生命周期注入，其他主要操作是浏览器鼠标/触控/DOM 输入。对应连续录像在 `lifecycle/`。
- 回看用真实菜单“更多→上手详情→回看演出”，逐帧观察没有新传递包，state/journal/storage 不变。草选/取消也不保存或显示兑现数字。
- `node scripts/check-production-plan.mjs` PASS；未修改计划。

## 原始 FAIL 与残余边界

最初录屏工具报缺少 Playwright ffmpeg，后来安装成功。保留测试夹具 runId 不合法、原生 Text 测试替身不完整、端口占用、旧菜单观察路径等失败日志。编码器后来在本地安装成功，连续录像已落库；没有媒体上传拒绝，未尝试 Library 上传，也没有绕过既有 Library 403。

第一次 domain wrapper 的测试本身 5008/5008 通过，但同时写入证据/调整 harness 触发“source changed”保护，wrapper FAIL。随后冻结输入，最终 wrapper 414 文件 / 5009 测试和内容检查均 PASS；原 FAIL 不删除。

耳朵原 main 离场失败在 `reports/exit-main-baseline.json.gz`，本路修后 stop/正常销毁通过；父容器销毁的专用回归也通过。

两项人工破坏分别记证据归属，未扩大修复：

1. **演出中单独 `heroActionButton.destroy()`**：专用数字清理已运行，但通用 `GameScene.updateHeroControl → SceneView.setEnabled` 继续更新已不存在的 input，报 `Cannot set properties of undefined (setting 'enabled')`。原 main 与本路均复现。目标公共 SceneView 被明确禁止写，未修；不把此注入列为整体通过。
2. **未 stop 就直接 `game.scene.remove('game')`**：仅在 `427e9998` 候选有 FAIL，**未在 main 复现，历史归属未覆盖**。本路专用对象已清理，通用计分队列仍在已销毁场景调用 `focusSource`，报 `Cannot read properties of null (reading 'add')`。这是一项人工绕过 stop 的注入，不能表述为已证实的 main 既有异常；不扩大公共生命周期修复。实际采用 stop→remove 的销毁顺序已通过。原观察器保留在 `checks/direct-remove-observer.mjs`，它含当时本地绝对导入路径，仅供诊断追溯。

当前结果不证明自然获取、长期经营、真实 GPU 手机、真人审美、扬声器/耳机或整体游戏完成；未访问试玩/部署站、未验部署。用户审美仍待审样。

## 复跑

```sh
SMOKE_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
  LIUE_PAYOFF_OUT=/tmp/liue-payoff node harness/liue-skill-payoff.mjs
SMOKE_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
  LIUE_PAYOFF_MODE=checks LIUE_PAYOFF_OUT=/tmp/liue-payoff-checks \
  node harness/liue-skill-payoff.mjs
```

Playwright 需要其可用的视频编码器。本环境使用 `PLAYWRIGHT_BROWSERS_PATH=/tmp/liue-browser`；可用 `LIUE_PAYOFF_PORT` 独立指定本地端口。
