# 唐宋牌（Tangsongpai）

一款以唐宋历史人物为题材的扑克构筑 H5 游戏。玩家通过出牌、弃牌、牌组改造与装备搭配，在逐章提升的目标中完成构筑。

基于 **TypeScript + Phaser + Vite**，在浏览器中运行，无需后端服务。

## 游戏内容

- **六位英雄**：苏轼、秦琼、辛弃疾、刘娥、文成公主、花蕊夫人，各自拥有不同的能力侧重。
- **扑克构筑**：以扑克牌型为基础，通过热度与倍率计分，组合唐宋牌、消耗品、长期道具、卡牌增强与版次效果。
- **完整局流程**：标准局共八章，每章包含暖场、正场和 Boss 压轴场；场间可进入商店调整构筑。
- **多种玩法**：包含难度解锁、固定条件挑战和通关后的无尽模式。
- **扑克奇遇**：标准模式中可遇到特殊事件，为符合条件的扑克赋予多彩版次。
- **本地存档**：支持保存和恢复当前对局；存档保存在浏览器本地。
- **多端交互**：适配桌面横屏与手机竖屏，支持触控和键盘操作，并提供音效、震动及减少动态等反馈设置。

具体数值、触发顺序和模式条件以游戏内说明及[规则文档](docs/production/RULES.md)为准。

## 本地开发

建议使用 Node.js 22 和 npm。

```bash
npm ci
npm run dev
```

开发服务器启动后，按终端输出的地址访问游戏。

### 构建与预览

```bash
npm run build
npm run preview
```

生产文件输出到 `dist/`。项目使用相对资源路径，可部署到静态站点子目录。

## 常用检查

```bash
npm run typecheck       # TypeScript 类型检查
npm test                # Vitest 单元测试
npm run verify:content  # 内容配置校验
npm run verify          # 类型检查、测试与生产构建
```

浏览器、布局、存档恢复及资源检查等专项命令见 [`package.json`](package.json)；其中部分命令需要 Playwright 浏览器或相应素材工具环境，不属于基础开发的前置条件。

## 项目结构

```text
src/
  application/   对局控制、存档与检查点
  cards/         扑克与牌型相关逻辑
  content/       角色、装备、关卡和模式内容
  core/          通用基础能力
  domain/        领域规则
  game/          Phaser 场景与游戏界面
  jokers/        唐宋牌效果
  run/           对局流程
  scoring/       计分与结算
public/          静态资源
scripts/         内容、构建和发布检查脚本
tests/           单元测试与测试数据
harness/         浏览器和布局验证脚本
docs/            策划、规则与工程文档
```

规则状态与界面表现分离：出牌、购买等操作先由规则层完成校验和状态提交，再由表现层播放反馈。

## 文档

- [策划文档入口](docs/GDD.md)
- [现行规则](docs/production/RULES.md)
- [内容定义](docs/production/CONTENT.md)
- [工程说明](docs/production/ENGINEERING.md)
- [交互说明](docs/production/UX.md)
- [开发协作约定](AGENTS.md)

`ROADMAP.md`、`TODO.md` 及 `docs/archive/` 中的部分内容是历史计划或阶段记录，不应视为当前功能清单或开发排期。
