# 唐宋牌（Tangsongpai）

唐宋历史人物题材的扑克构筑 H5 游戏。六位英雄为苏轼、秦琼、辛弃疾、刘娥、文成公主、花蕊夫人。TypeScript、Phaser 与 Vite；规则与表现分离，支持本地保存/恢复。

## 当前工作范围（2026-10-22）

**现阶段只推进「奇遇」。** 当前 [奇遇专项策划 PR #226](https://github.com/big-dimple/tangsongpai/pull/226) 仍是**未合 main 的文档草案**，不代表游戏功能、动画或设备验收完成。历史 Q1–Q4 待办暂停，不要按旧计划自动启动其他产品开发。奇遇完整实现并核验后，按用户授权合并交付；独立多彩/成长研究不因此自动启用。

仓库整理另见 [分支与 PR 审查记录](docs/production/REPOSITORY_HYGIENE_20261022.md)。清理分支与奇遇产品改动分开，未合并有独有成果的分支不按日期清除。

## 本地开发

```bash
npm ci
npm run dev
```

需要 Node 22/npm；生产构建用 `npm run build`。云端 HOME 缓存不可写时可用 `npm ci --cache /workspace/.npm`。

开发先读 [AGENTS](AGENTS.md)（最新范围）→ [奇遇专项计划 PR #226](https://github.com/big-dimple/tangsongpai/pull/226) → 相应 [生产文档目录](docs/production/INDEX.md)。[旧统一交付计划](docs/production/DELIVERY_PLAN.md)、[plan.json](docs/production/plan.json)、[ROADMAP](ROADMAP.md) 用于历史包/证据/正式门追溯，不能将旧「当前项」误当最新授权。

历史快照、CI 与脚本测试不等于用户审美或实机验收。检查命令见 [package.json](package.json)，按实际更改选必要项；不借维护任务修改游戏代码或试玩部署。
