# ENGINEERING

本文件是唯一的工程说明。详细定义以源码、配置和测试为准；不要从历史 PR 或旧交接恢复规则。

## 1. 技术栈与命令

- TypeScript、Phaser 3.90、Vite、Vitest、Playwright。
- 建议使用 Node.js 22，依赖使用 `npm ci` 和锁文件安装。
- 游戏是纯静态 H5；核心运行不需要后端、Blender 或素材生成工具。

本机 `/var/www/tangsongpai` 为低配服务器，默认不运行下列构建、类型检查、单元测试或浏览器跑批，用户另行要求时再执行。完成审查后按授权提交并 push，由 GitHub CI 验证。以下命令供开发机和 CI 按需使用。

```bash
npm run dev             # 开发服务器
npm run typecheck       # 类型检查
npm test                # 单元测试
npm run verify:content  # 内容配置校验
npm run build           # 类型检查与生产构建
npm run preview         # 预览构建产物
npm run verify          # 类型检查、测试、构建
```

浏览器、恢复、布局、素材等专项命令见 `package.json`。按实际改动选择检查，不必为纯文档修改运行完整浏览器矩阵。

手柄专项为 `npm run test:gamepad:browser`：注入浏览器设备快照，经真实导航与按钮完成选角、商店、选牌与出牌，并检查弹窗隔离、长按、重连与整块点击。输出位于 `shots/gamepad/`，不代替实体手柄验收；输入边沿、摇杆漂移、焦点几何和点击转发由常规 Vitest 用例覆盖。

## 2. 目录与依赖方向

```text
src/
  application/  对局控制、检查点、持久化与恢复
  cards/        扑克类型、牌型和卡牌基础能力
  content/      模式、工具、道具与内容配置
  core/         通用基础能力
  domain/       命令、对局、计分、商店、Boss 与随机规则
  game/         Phaser 场景、输入、视图和演出
  audio/        音频总线、偏好与生命周期
  haptics/      震动反馈
  platform/     视口、渲染和浏览器适配
  run/          对局流程辅助
  scoring/      计分辅助
public/         运行时静态资源
scripts/        内容、构建、CI 与发布检查
tests/          单元测试及测试数据
harness/        浏览器和布局专项验证
analysis/       可复算分析工具
art/            素材源文件与来源信息
docs/assets/    当前素材清单和必要记录
docs/production/  保留的历史测试数据，仍被 tests／harness 读取
tools/          离线素材工具
```

依赖方向保持为：界面调用应用与领域能力，领域不依赖 Phaser、DOM 或音频。相同规则不得在场景、测试和 harness 中各复制一份。

## 3. 对局与计分

标准局共八章，每章暖场、正场、Boss 压轴三场。玩家通过出牌和弃牌达成目标，场间在商店购买、出售、调序和改造构筑；正常通关后可自愿进入无尽。

基础规则：

- 标准牌组为四花色 2–A，共 52 个独立实例；复制牌必须生成新实例 ID。
- 默认手牌上限 8，每次出牌或弃牌选择 1–5 张；每场默认 4 次出牌、3 次弃牌。
- 牌型包含高牌、对子、两对、三条、顺子、同花、葫芦、四条、同花顺、五条、同花葫芦和同花五条。
- 普通点数为 2–10 按面值，J/Q/K 为 10，A 为 11。
- 计分使用牌型热度与倍率，通常在最终得分时向下取整；苏轼「贬谪」先取普通整数得分，再乘该存档身份的倍率。大数使用有理数和十进制字符串序列化，不以浮点近似代替。

一手计分的关键顺序：

1. 校验阶段、资源和实例，固定本手快照。
2. 应用公开 Boss 规则并识别牌型与有效计分牌。
3. 依次处理计分牌、留在手中的牌和适用于当前身份的前置角色能力；单张牌也可能触发唐宋牌钩子。
4. 整手唐宋牌通常按槽位从左到右执行，本体后紧接其版次；B13 将此阶段反序。加法与乘法按实际发生顺序应用。
5. 应用路线成长倍率与该身份的延后角色倍率，再计算最终得分及后续成长、销毁、奖励、补牌与胜负。秦琼、花蕊夫人、文成公主的主动倍率等时点由存档身份决定，核对 `r2ScoreContext`、`scoreR2Hand` 及兼容测试，不能用统一顺序覆盖旧局。
6. 状态与轨迹原子保存后，表现层才播放结果。

“打出”“参与成型”“有效计分”“留在手中”是不同集合，不得混用。重触发只重复指定卡牌对应的计分步骤，不重新执行整手、角色或所有唐宋牌。

## 4. 内容、模式与奇遇

- 当前发布内容为 72 个唐宋牌定义、39 种工具、12 种长期道具，以及扑克增强和普通／闪箔／全息／多彩版次。
- `src/content/r2Modes.ts` 定义普通、教程、挑战模式，D0–D3 难度、12 个固定条件挑战和 4 种节目单。
- 模式、难度、挑战和节目单开关进入对局身份及存储分区，不得在恢复时静默改成默认配置。
- 扑克奇遇在符合身份的标准局、普通八章内，按独立随机流每 7–9 次有效过场触发。玩家可支付 18 金，为一张仍存活、无版次的持久扑克赋予多彩；与本店培养／改牌共用一次机会，扣款、赋予、机会消耗和回执必须同事务保存。
- 内容新增或修改必须通过 schema 与内容校验；未实现的能力不能进入获取池。

## 5. 命令、随机与不变量

所有改变对局的操作走统一领域命令。界面禁用按钮只是提示，不能代替领域校验。

- 命令携带 `runId`、`commandId`、`expectedSeq`，由串行队列处理。
- 失败返回原状态，金币、次数、实例和 RNG 均不变化。
- 重复命令幂等，过期序号拒绝，成功奖励只能发放一次。
- 实例 ID 唯一，同一活动实例只能位于一个牌区；整数资源非负，槽位与事件数量有上限。
- 相同版本、内容哈希、种子和命令序列应得到相同结果。
- 规则 RNG 与视觉 RNG 分离；预览使用只读快照或克隆，不能推进真实随机流，也不能泄露未来牌堆和货架。

## 6. 存档与恢复

浏览器以 IndexedDB 保存完整检查点和有界命令日志，并保留上一份有效检查点。

- 存档只包含可序列化领域状态，不包含 Phaser 对象、DOM、动画句柄或个人设备信息。
- 先在临时状态完成命令，再持久化并发布新状态；保存失败时保留原局和可重试候选，明确提示未保存。
- 恢复后可直接展示已确定结果或重放表现，两种方式的规则状态必须一致。
- 内容版本、规则身份、模式和内容哈希共同隔离存档；旧数据不静默迁移或清空，应保留导出路径。
- 多标签页使用写者租约或版本比较，避免两个页面互相覆盖。
- 首屏恢复读取有 2.5 秒上限；若旧 IndexedDB 请求悬挂，先进入新局并使用仅限当前页面的内存候选存储，原存档不删除，刷新后可重试恢复。正常读取与保存仍使用 IndexedDB。

## 7. 表现、输入与资源

- 动画消费已经确定的 ScoreTrace／事件，不反向计算分数。
- 每代演出拥有独立取消信号；场景关闭时清理 tween、timer、监听和视图引用，旧回调不得操作新对局。
- 跳过、快进、静音、减少动态、后台切换和 resize 不改变规则结果，也不重复奖励。
- 群英卷轴仅在每次页面加载后的首页播放一次：保留浅色纸卷，六人完整亮相后额外停留 1 秒，总长 2.6 秒，展开、落印与淡出保持原节奏；可直接操作离开首页，减少动态时跳过。选角页不重播群英卷轴，仅重置本局单人登场演出的播放额度。
- 桌面横屏与手机竖屏共用 CSS 坐标和明确命中区域；触控、键盘与标准手柄均为正式输入路径。
- PC 牌桌新版由 SceneView 的 game 场景显式启用，几何函数 PcTableLayout 只消费尺寸/安全区/手牌数据，默认不开启；实际入口排除 primary coarse pointer，要求至少 1180×640 可用横向空间。移动牌桌保留正式触控几何，同时由 StageTableArt 绘制当前英雄的透明纸面层。
- PC 的 hud 覆盖完整侧栏，heroRows、heroPortrait、inventoryEntry/helpEntry 与最终 scoreBoard/playedArea 一起从布局输出；渲染、命中、手柄焦点与计分来源避让共用这些几何，不能只移动可见图片。
- PC 结算由 IntermissionLayout、PcSettlementPresentation 和 IntermissionScroll 配合实现上锚画幅海报，不对整块内容二次垂直居中。长去向文字可进入现有只读详情弹窗，真实分数/收益仍来自原 settlementFacts。
- beginPcSettlementCut 是 PC-only 非阻塞暖纸 DOM 衔接，不是旧牌桌截图，不修改 PaperFlow 或奇遇切场。它不等待动画再执行导航，减少动态时不播放，拥有明确清理上限；结算入场同样不决定规则或奖励。
- PC 牌桌与 PC/手机竖屏结算使用独立 `pc` purpose（沿用技术键，不替换既有 portrait/selection）：`public/assets/tangsong-pc-heroes/manifest.json` 注册六张 896×1120 带 alpha WebP（合计 1,794,950 字节）。`PcHeroArt` 按各自衣袖、双锤和剑的轮廓定义比例与水平落点，完整保留源画幅；结算人物向左越出文字版心，成绩与收益/按钮分列，上锚而非整组居中。
- 透明图只在实际 PC 牌桌、商店英雄席、移动牌桌或 PC/手机竖屏结算请求当前英雄；复用原有受控图片队列与结果取消生命周期，不加入首页六人预加载。`portrait`、`selection` 与角色详情仍使用原路径，存档身份和玩法规则不变。
- 手机竖屏结算由 `MobileSettlementPresentation` 独立绘制：人物/成绩主区、全宽奖励、去向和稳定按钮，紧凑屏压缩人物区而非把 PC 三栏缩小。长去向可点标题展开全文；失败、跳场、通关仍走真实既有操作。
- 通用图片加载器只对注册的 `pc` purpose 使用 400,000 字节、896×1120 像素限额，并继续校验键/URL/真实尺寸；其他图片保留原 128 KiB / 600,000 像素限额。
- PC 牌桌与商店道具箱共用 `pcToolInventoryContent` 的 22px 图标轨道与独立文字区，12px 间隔、绝对定位，保留原按钮功能和手机样式。
- `node tools/build-pc-hero-art.mjs <原图目录>` 可重建运行图及 SHA/alpha/来源映射。源图为用户 Desktop/lihui/table 六张 1122×1402 PNG，原文件保留在外部；不向 public 复制原图，不生成新人物，不裁头手或武器。WebP quality 84、alphaQuality 100、无放大。
- 手柄采用浏览器 [Gamepad 标准映射](https://www.w3.org/TR/gamepad/#remapping)：方向键／左摇杆移动焦点，底部键确认或选牌，右侧键返回或取消选择，左侧键出牌，顶部键弃牌；Xbox 分别显示 A／B／X／Y，Sony、Nintendo 按设备显示对应键名。LB／RB 调整聚焦手牌或唐宋牌顺序，在商店其它位置切换货架，在弹窗中逐项导航；LT／RT 按点数／花色整理，View 查看聚焦牌详情，Start 开关菜单；右摇杆滚动。
- `GamepadInput` 只让方向导航连发，确认、出牌、弃牌、调序等按键每次按下仅执行一次；首次连接、断线重连和后台恢复须回到中立位置。未知映射不猜测键位。`GamepadNavigation` 只调用 `SceneView` 注册的有效操作及顶层原生弹窗控件，不模拟键盘、不绕过现有命令校验。关闭、切场景和换回鼠标／键盘会清理焦点表现；手柄提示显示时为牌桌保留独立底栏。
- 有独立操作按钮的选择卡片通过 `WholeActionSurface` 将标题、说明与留白接入同一按钮；嵌套控件、禁用按钮及文本选择保持各自行为。点击选择卡片仍由原有确认流程决定是否提交。
- 音频统一走应用级总线，处理解锁、后台 suspend、音量偏好和实例清理。
- 资源使用注册表与 `BASE_URL`；源素材、运行时变体和预览文件分开，首屏只加载必要资源。
- 当前素材清单为 `docs/assets/inventory.json`，素材检查工具位于 `tools/blender/`。
- 英雄文案数据为 `src/content/hero-text-spec.json`；清理文档不改其内容，也不将文案技能说明当成所有旧存档共用的规则。

本轮三条视觉重做线的实现入口已经合并：`PcTableLayout`/`StageTableArt` 负责牌桌，`ShopLayout`/`ShopScene`/`ShopArt`/`ShopMobileOffers` 负责商店，`IntermissionLayout`/`PcSettlementPresentation`/`MobileSettlementPresentation` 负责结算。后续只处理用户试玩后可复现的工程问题，不把检查数量写成审美结论。

## 8. 测试、CI 与发布

CI 只保留两类常规门禁：

- `domain`：`npm test` 与 `npm run verify:content`。
- `browser`：`npm run build` 与 `npm run verify:smoke`。

`npm run verify:ci -- --scope=domain|browser|all` 可执行对应组合。专项恢复、布局、故障和素材检查只在相关改动时运行。测试使用的 JSON／压缩夹具属于代码输入，不为追求目录整洁而删除。

浏览器 CI 在手柄、场景输入、选择卡片或对应 harness 发生变更时另跑 `test:gamepad:browser`；手动触发 CI 时同样运行。专项结果与失败截图保留在同一浏览器 artifact 的 `shots/gamepad/` 中。

牌面遮挡检查测量包含父容器变换的实际四边形相交面积；旋转后的外接矩形包含牌外空白，不能代替真实遮挡。

`main` 的 `Production build` 工作流生成 `tangsongpai-dist-<完整提交 SHA>` 产物。服务器每分钟运行自动发布，只下载远端 `main` 对应提交的成功构建，不在服务器本地构建。脚本源文件为 `scripts/tangsongpai-autodeploy.sh`，安装于 `/usr/local/bin/tangsongpai-autodeploy.sh`；日志为 `/var/log/tangsongpai-autodeploy.log`。修改仓库脚本不会自动更新已安装脚本或 crontab。

发布状态以 `/var/lib/tangsongpai-deploy/deployed-revision` 为准，公开域名 `https://pai.hp666.cc/build-info.json` 必须返回同一 revision，且 `sourceStatus=clean`、`modified=false`；域名核验成功后才更新成功记录。不能只比较本机 HEAD 和远端 `main`，也不能把 push 或构建成功当成线上已更新。

GitHub 仓库为 `big-dimple/tangsongpai`；Cloudflare Pages 项目仍为 `dachoupai`，这是现用托管标识，不能随仓库改名替换。技术 ID、存档格式、内容版本与哈希同样不能做全仓名称替换。

CI 失败时查看对应日志并修复。`CI` 与 `Production build` 独立运行；自动部署等待同一远端提交的最新 push CI 与生产构建均成功，`--force` 也不能绕过检查。提交／push、CI 与线上状态分别报告；CI、截图和脚本不能代替真人审美、听感、实体设备或自然对局平衡验收。

## 9. 文档维护

项目只维护 `TODO.md`、本文件和 `AGENTS.md` 三份核心文档，README 仅作入口。规则变化直接更新本文件，当前工作只更新 TODO，不新增路线图、工作包、日期化交接、评审回执或证据 README。必要测试数据与其使用者放在一起；已有 `docs/production/evidence/` 中的 JSON、压缩数据及脚本是历史测试输入，不是当前任务或验收状态，删除或迁移前同时核对直接引用、拼接路径与导入关系。新的检查输出放被忽略的 `shots/` 或 CI artifact，避免重新堆积进 docs。
