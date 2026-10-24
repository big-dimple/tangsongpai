# 仓库分支与 PR 清理核对（2026-10-22）

**Dot 一键执行入口：** [安全清理脚本](../../scripts/branch_prune.py) + [Dot 执行单](DOT_BRANCH_CLEANUP_RUNBOOK_20261022.md)。脚本默认预览，实际删除仅在 `--apply` 下进行，并当场复核 `main` 差异、开放 PR、保护状态和分支 HEAD。审查数量为快照，不等于已删除数量。

仓库：[big-dimple/tangsongpai](https://github.com/big-dimple/tangsongpai) · 核对基线：`main@37a0e1618129b82cee31b2ab856bb8325d625881`。此为 **2026-10-22 核查快照**，并非自动更新的机器状态；执行任何删除前须重新查询。

## 核查结果

| 类别 | 数量 | 处理原则 |
| --- | ---: | --- |
| 远程分支合计 | 515 | 其中 1 条为 `main` |
| 已合并 PR 的分支仍存在 | 200 | 优先候选；需再次确认相对当前 main `ahead_by=0` |
| 核查开始时开放 PR 的 head | 26 | 默认保留；见下方本次关闭记录 |
| 未找到任何对应 PR 的分支 | 288 | **不等于可删除**，需逐分支比较与核实素材、证据及依赖 |
| 本次已关闭、未合并的历史 PR | 10 | #4–#11、#183、#184；保留对应远程分支与全部历史 |
| 关闭 10 个旧 PR 后开放数量 | 当时 16，后增为 17 | 后续新建 [PR #227](https://github.com/big-dimple/tangsongpai/pull/227)（独有功能成果，必须保留）；以 GitHub 实时页面为准 |

上表 200/26/288 为本次操作前的 PR 归类，合计加上 main 为 515；关闭 PR **不删除分支，也不抹掉提交**。此审查只处理仓库卫生，与产品奇遇开发并行隔离。

## 已逐分支确认 ahead=0，可优先删除

以下与核查时的 main 相比均为 `behind` 且 `ahead_by=0`，没有仅存在于该分支上的 Git 提交（删除前仍须二次检查）：

- 旧 R/V 基线：`feat/R00-baseline-evidence`、`feat/R01-domain-commands`、`feat/R02-rules-v2`、`feat/R03-run-economy`、`feat/R04-recovery-cancellation`、`feat/R05-mobile-layout`、`feat/R06-ci-gates`、`feat/V00-core-graybox`。对应 PR #4–#11 已关闭。
- 已合并近期分支抽检：`feat/b03-emergency-rescue-20261022`、`fix/sushi-k-ink-visibility`、`fix/sushi-dashes-integration-20261021`、`docs/development-plan-reset-20261020`、`docs/q4-planning-20261021`。
- 无开放 PR 的历史分支抽检：`dev/astra-integration-20261015`、`dev/singapore-integration-20261017`、`review/whole-table-art-20261009`。

**未删除远程分支：** 当前 GitHub 连接只提供读取、提交文档和 PR 状态操作，不提供删除 git ref 的写操作，不能伪称已删除。代码托管界面或有删除权限的本地 GitHub CLI 可执行。

## 不得直接删

- **当前奇遇：** [PR #226](https://github.com/big-dimple/tangsongpai/pull/226) / `feat/qiyu-special-animation-plan-20261022`，当时相对 main `ahead=1`，策划尚未合并。
- **隔离研究：** [PR #225](https://github.com/big-dimple/tangsongpai/pull/225) / `feat/b2-polychrome-isolated-candidate-20261022`，`ahead=7`，且含奇遇两阶段研究；[PR #223](https://github.com/big-dimple/tangsongpai/pull/223) / `research/late-multiplier-reachability-20261021`。
- **未合并旧成果：** [PR #188](https://github.com/big-dimple/tangsongpai/pull/188) / `dev/hero-spectacle-pass-20261018`，`ahead=2`；[PR #189](https://github.com/big-dimple/tangsongpai/pull/189) / `fix/hero-visible-rework-20261019`，`ahead=7`。虽然不是当下开发任务，仍不可当作零独有成果分支直接删。
- **历史证据/素材与隔离集成：** `art/handdrawn-runtime-20261004-b2`（`ahead=1`）、`art/handdrawn-runtime-20261004-b11`（`ahead=1`）、`feat/p08-natural-run-evidence-20261004`（`ahead=1`）、`dev/integrate-experience-20261014`（`ahead=9`，其 PR #183 明确不合）。关闭 PR 并不代表应删除独有证据。

## 本次已执行

1. 关闭 **PR #4–#11**（R00–R06、V00）；上述 8 分支分别确认 ahead=0，老 PR 不需要重新合入。
2. 关闭 **PR #183**（PR 自述「仅供集成验证，不合此 PR」）与 **PR #184**（过期且未运行的手机 QA 阻断记录）；**保留两条远程分支**，避免其独有证据丢失。
3. 不关闭、不合并 PR #226/#225/#223；不修改游戏规则、素材、代码、存档或奇遇专项开发分支。

## 删除前复核步骤

执行者用已授权的 GitHub CLI（`gh auth status`）处理一条候选分支前，应确认：非 main / 保护分支；非任何开放 PR 的 head；相对 **当时的** main `ahead_by=0`；不是其他工作或发布依赖；查看分支 HEAD 没有在审查后移动。零 ahead 可做无损清理，**diverged / ahead>0 的分支一律不批量删除**。推荐先对上述 8 条 R/V 老分支逐条处理，再分批清理已合并 PR 分支；不要一次性清掉 288 条无 PR 分支。

示例：`gh api 'repos/big-dimple/tangsongpai/compare/main...feat/R00-baseline-evidence' --jq '.ahead_by'` 返回 0 并完成其余校验后，才能由具备权限的执行者调用 `gh api -X DELETE 'repos/big-dimple/tangsongpai/git/refs/heads/feat/R00-baseline-evidence'`。删除不能等同于历史提交丢失，但不应以 GitHub 可恢复性取代审查。

历史 Q1–Q4 文档/机器台账是之前批次，不得据旧 `currentTask` 擅自派活。**当前唯一产品开发主题是「奇遇」**，只在实际完成并验收对应范围后按用户许可合并。
