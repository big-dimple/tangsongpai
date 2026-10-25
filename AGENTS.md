# 唐宋牌 · 当前协作入口（2026-10-22）

> **最新用户范围优先：现在只做「奇遇」。** 除本次明确授权的仓库分支/文档整理外，不启动 Q1–Q4、旧英雄特效、平衡、多彩扑克、商店或其他产品工作；不复活历史分支、代理任务或旧 PR。此前“禁止清理分支/关闭 PR/直推 main”等限定属于当时的工作批次，不覆盖 2026-10-22 用户对仓库维护的明确授权。

## 奇遇唯一产品方向

- [扑克奇遇玩法与视觉交付（PR #227 + PR #226 合流）](docs/production/POKER_POLYCHROME_ENCOUNTER_IMPLEMENTATION.md)：已将 `feat/poker-polychrome-encounter-20261022`（阶段 1b 扑克多彩奇遇规则、7–9 关独立随机流、18 金事务保存/恢复校验）与 `feat/qiyu-special-animation-plan-20261022`（阶段 2 纸上流彩转场墨卷、六英雄眼神特写与文化典故入画、选牌赋彩祭坛、蓄势→冲击→顿挫→×1.5 爆发 4 阶段仪式、成长账单与多层音效/震动反馈）合并入 `main`。
- [奇遇专场动画计划与落库记录](docs/production/QIYU_SPECIAL_ANIMATION_PLAN_20261022.md)：软件单测与生产构建已完成；真人审美、实体手机与长期自然对局平衡仍待用户在浏览器实机体验确认，不用测试或构建结果替代玩家签收。
- [唐宋入场演出交接记录（2026-10-24）](docs/production/TANGSONG_ENTRANCE_HANDOFF_20261024.md)：首页首次加载/选角群英长卷、六英雄共用入场 cut-in 的现状、美术审查修复和待办；接力者先读这一页。
- [扑克多彩与两阶段奇遇研究（PR #225）](https://github.com/big-dimple/tangsongpai/pull/225) 与 [PR #223](https://github.com/big-dimple/tangsongpai/pull/223) 仍为独立研究，暂保留。
- 用户明确提出「奇遇做完就可以合并提交」。应先完成受影响游戏流程、保存/恢复边界和必要验证，再合并对应完成成果；**不要只凭计划文档宣称奇遇完成**。此前正常发布由 main push 自动部署；本维护工作不触碰部署或试玩站。
- 保持唐宋题材、六英雄已批准素材、PC 横屏与手机竖屏、可跳过/减少动态、保存成功后演出、重复提交不重复奖励的基本约束；实际设计以已批准范围为准，不把候选参数自动定案。

## 任务入口和工程纪律

### 本机验证与交付（2026-10-25 用户更新）

本机配置低，默认不在这里运行构建、类型检查、单元测试或浏览器跑批；用户另行要求时再执行。完成代码审查后直接提交并 push，由 GitHub CI 核验。`Production build` 工作流在 GitHub 构建，服务器每分钟任务只下载对应提交的成功构建产物并发布；脚本源文件为 `scripts/tangsongpai-autodeploy.sh`，安装到 `/usr/local/bin/tangsongpai-autodeploy.sh`。发布依据 `/var/lib/tangsongpai-deploy/deployed-revision`，成功后才更新；不能仅比较本机 HEAD 与远端 main。CI 失败时查看日志并修复；分别报告 push、CI 与线上状态，不将提交成功视为验证通过。本条覆盖旧文档中要求本地先构建、先测试的流程。

当前执行范围以本页最新用户指令和奇遇专项合同为先。[旧统一交付计划](docs/production/DELIVERY_PLAN.md)、[plan.json](docs/production/plan.json)、[ROADMAP](ROADMAP.md) 保留旧 Q1–Q4 包状态与历史证据；其中仍写着 P08/Q1 的“当前项”只是尚未完成同版机器状态迁移的历史快照，**不能据此开新任务**。在奇遇实际合并/落库时由该项 owner 统一更新状态，避免并行覆盖共享文件。

不改坏现有存档或真实计分；成功与失败证据分列，不用 CI、截图、脚本假冒玩家/设备签收；不要擅自修改或删除未合并的独有成果。按照当前任务读取必要的 [规则](docs/production/RULES.md)、[角色玩法](docs/production/CHARACTER_PLAY_PLAN.md)、[交互](docs/production/UX.md)、[工程](docs/production/ENGINEERING.md) 和 [美术](docs/production/ART.md)，无需重读所有历史档案。

## 仓库整理

[2026-10-22 分支/PR 审查记录](docs/production/REPOSITORY_HYGIENE_20261022.md) 与奇遇开发独立：可以关闭已明确废弃、没有独有价值的旧 PR；**删除远端分支前必须重新比较 main，确认 ahead=0、非受保护分支、非开放 PR 的 head，且没有别的工作正在使用**。有独有提交的旧美术、验证或功能候选先保留审查，不按日期或名称批量删除。不得重置/强推 main 或把清理当成合并奇遇。
