# 唐宋牌（Tangsongpai）

唐宋历史人物题材的扑克构筑 H5 游戏，使用 TypeScript、Phaser 和 Vite，在浏览器本地运行与存档。

六位英雄、八章标准对局、商店与牌组改造、唐宋牌与道具组合、难度挑战、无尽模式和扑克奇遇均已接入。适配桌面横屏、手机竖屏、键盘与触控。

## 运行

建议使用 Node.js 22 和 npm：

以下命令供开发机使用；main 的 GitHub Actions 负责独立 CI 和 Release 产物，服务器接收并发布产物。实际工作流和部署状态须单独核实，详见 [ENGINEERING](ENGINEERING.md)。

```bash
npm ci
npm run dev
```

生产构建与预览：

```bash
npm run build
npm run preview
```

正式运行资源保存在 `public/assets/`。原始素材已完整备份至私有仓库 [tangsongpai-assets](https://github.com/big-dimple/tangsongpai-assets)，来源清单与校验方法见 [ENGINEERING](ENGINEERING.md)。

## 文档

- [TODO](TODO.md)：当前待办，完成后直接移除。
- [ENGINEERING](ENGINEERING.md)：规则、架构、存档、测试与发布。
- [AGENTS](AGENTS.md)：项目知识库、代码导航与协作约定。

除此之外不再维护路线图、阶段计划、任务交接或逐次评审报告。代码、游戏内说明和配置是详细实现的最终依据。
