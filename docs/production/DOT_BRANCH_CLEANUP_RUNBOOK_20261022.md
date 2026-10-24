# Dot 执行单：清理唐宋牌远程垃圾分支

**日期：2026-10-22｜仓库：`big-dimple/tangsongpai`｜任务类型：仅仓库维护**

当前唯一产品开发主题是**奇遇**。本执行单只允许清理冗余远程分支，不允许合并其他功能、修改存档/规则/代码、不允许改动奇遇分支，也不需要动线上试玩站。

## 直接执行

仓库已提供 [scripts/branch_prune.py](../../scripts/branch_prune.py)。它**默认只预览**，必须显式传 `--apply` 才会删远程分支。只需标准 Python 3.10+ 和已授权的 GitHub CLI 或 `GH_TOKEN`，不需要安装 Python 包。

```bash
git clone https://github.com/big-dimple/tangsongpai.git
cd tangsongpai
gh auth status
python3 scripts/branch_prune.py --repo big-dimple/tangsongpai --report /tmp/tangsongpai-branch-dry-run.json
```

先看生成报告的 `counts` 和 `SAFE_CANDIDATE_DRY_RUN` 清单，确认当前 Dot/其他 Agent 正在使用的分支不在待删列表。只有 **无独有提交（ahead_by=0）、无开放 PR、非受保护分支、非主分支、未命中奇遇/研究保留规则** 才能删。

确认后按每批最多 100 条逐步清理，重复执行直到没有新的 `SAFE_CANDIDATE_DRY_RUN`：

```bash
python3 scripts/branch_prune.py --repo big-dimple/tangsongpai --apply --max-delete 100 --report /tmp/tangsongpai-branch-apply-1.json
```

程序对每条即将删除的分支**再次检查**：当前 HEAD 必须与预览时相同、非 protected、没有开放 PR、与最新 main 对比 ahead=0；否则跳过并在报告中给出原因。输出 `DELETED`、`UNIQUE_COMMITS_RETAIN`、`OPEN_PR`、`PROTECTED` 和 `ERROR_RETAIN` 数量。GitHub 403/404/429/写权限不足时，不可绕过安全检查或使用 force push。

## 明确保留

- `main`。
- **奇遇 PR #226**：`feat/qiyu-special-animation-plan-20261022`，与奇遇专项开发相关，不能删。
- **隔离研究 PR #225**：`feat/b2-polychrome-isolated-candidate-20261022`；以及 PR #223：`research/late-multiplier-reachability-20261021`。不要把研究误合入 main。
- 所有尚未合并且有 `ahead_by>0` 的功能、原始素材、美术、证据和隔离验证分支，包括旧 PR #188/#189、以及已关闭 PR #183/#184 的独有证据分支。
- 所有其他开放 PR 的 head（不能为了清理分支而擅自关闭其 PR）。

## 预期容量与首批优先候选

2026-10-22 清点时有 **515** 条远程分支：`main` 1，已合并 PR 的分支 200，开放 PR 的 head 26，未对应 PR 的其他分支 288。本轮已安全关闭 10 个过期 PR（#4–#11、#183、#184）；关闭当时开放 PR 为 16，随后新建了 [PR #227](https://github.com/big-dimple/tangsongpai/pull/227)，复核时为 17。该新 PR 的 `feat/poker-polychrome-encounter-20261022` 分支包含独有功能代码，**必须保留**。实际可删数量以脚本当场的 `SAFE_CANDIDATE_DRY_RUN` 为准，不拿 200 或 288 直接当删除数量。

已经相对 10 月 22 日 `main@37a0e161` 单独核对 ahead=0 的首批样例：

```text
feat/R00-baseline-evidence
feat/R01-domain-commands
feat/R02-rules-v2
feat/R03-run-economy
feat/R04-recovery-cancellation
feat/R05-mobile-layout
feat/R06-ci-gates
feat/V00-core-graybox
feat/b03-emergency-rescue-20261022
fix/sushi-k-ink-visibility
fix/sushi-dashes-integration-20261021
docs/development-plan-reset-20261020
docs/q4-planning-20261021
dev/astra-integration-20261015
dev/singapore-integration-20261017
review/whole-table-art-20261009
```

这些为**待二次校验的删除候选**，不是已删除清单。

## Dot 回执（必须提供）

最终反馈一张简表：**清理前分支数 / 已删除数 / 剩余分支数 / ahead>0 保留数 / 开放 PR 保护数 / 失败或人工复核数**。贴出 preview 和 apply 两份 JSON 报告路径，列出每条 `ERROR_RETAIN` 的原因，以及删除后 GitHub 远程分支总数。只执行分支清理，不恢复其他开发、PR 合并或部署工作。

此文档与 [2026-10-22 核查记录](REPOSITORY_HYGIENE_20261022.md) 共同作为 Dot 执行依据。**不用重复问清理授权**，但不能以“清理垃圾”为名合入或抹掉独有内容。
