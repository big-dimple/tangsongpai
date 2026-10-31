# ENGINEERING

本文件是唯一的工程说明。详细定义以源码、配置和测试为准；不要从历史 PR 或旧交接恢复规则。

## 1. 技术栈与命令

- TypeScript、Phaser 3.90、Vite、Vitest、Playwright。
- 建议使用 Node.js 22，依赖使用 `npm ci` 和锁文件安装。
- 游戏是纯静态 H5；核心运行不需要后端、Blender 或素材生成工具。

开发侧默认在推送 main 前，在 Dot 远端开发电脑或本机完成完整 CI 与生产构建，按改动补跑专项；用户明确指示例外时如实报告。main 的 GitHub Actions 再对该提交独立执行门禁、构建和 Release 发布；是否启用及成功以实际运行结果为准。提交和推送以当前任务授权为准；新加坡服务器仅取件、校验并发布，不代跑测试或构建。提交、产物交付与部署是不同状态。

```bash
npm run dev             # 开发服务器
npm run typecheck       # 类型检查
npm test                # 单元测试
npm run verify:content  # 内容配置校验
npm run build           # 类型检查与生产构建
npm run preview         # 预览构建产物
npm run verify          # 类型检查、测试、构建
```

浏览器、恢复、布局、素材等专项命令见 `package.json`。专项检查按实际改动选择；用户明确要求例外时如实报告未执行或失败的检查。

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

动态无尽策略已接入 main：新标准局的独立身份在继续无尽时按真实末场累计分冷启动，旧无尽局可在商店显式选择并从下一章冷启动；旧身份和已公布本章目标不变。普通场以两次成功场的累计最终分确认持续输出，失败、跳场与 Boss 分不更新普通样本。目标在下一场商店准备前冻结，每场原身份的静态目标是下限；未来未冻结目标显示待定。Boss 在未折扣锚上按公开限制分档，锁定时全部有效牌属于 B03 禁用花色的特殊档另作折算，不反向降低普通锚。数学式与边界见 `TODO.md`。

该策略的命令、清关与锁定来源随检查点保存；保留最近四场和一个来源回执绑定的压缩边界，并保留最近普通样本。已冻结目标不随商店改牌或重试变化，回执校验用于一致性检查，不是密码签名或防作弊证明。历史命令回执仍受现有保存大小上限约束；不应将这些证据视为可以恢复旧档中从未记录的历史场分。

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
- 新局唐宋牌增强身份在各英雄原有完整身份上追加独立版本：箭无虚发 `d07` 全有效计分 +1.5 倍率，巧借东风 `jiedongfeng` 合格牌型 +3 倍率，宾主尽欢 `b07` 全有效计分 +50 热度，朱砂点绛／挥毫泼墨 `c02`／`c03` 每张合格牌 +12 热度；条件、售价、顺序与英雄能力不变。旧存档和重试保留原定义。
- 新局再以独立 `targeted-value-v1` 身份增加无中生有 `d10` 每手基础 +12 热度、炉火纯青 `b10` 每手基础 +20 热度及莫逆之交 `b03` 每手基础 +1 倍率，原空槽、成长条件和上限不变；既有动态无尽与更早存档保留各自身份和定义。新增效果与既有成长按独立事件记录，检查点验证来源、顺序、数量与金额。
- 新局 `purchase-value-v1` 在上述身份基础上独立调整：无中生有基础热度 +24（空槽另每格 +12、最多四格），炉火纯青基础热度 +40（成组结算后成长 +10），莫逆之交基础倍率 +1.5（成组结算后成长 +0.25）；价格、增长时机和上限不变。`targeted-value-v1` 及更早存档继续使用原定义和哈希，重试不迁移。受控同一手两对、第五槽比较和多彩成本由 `tests/purchase-value-sample.test.ts` 验证；单个样本不代表自然触发率或购买收益。
- 新局 `voice-choice-v1` 身份可在自选做牌以原价4金购买留个声（T13），与升级、改牌和染色共用每店一次；随机现货仍独立，旧身份保留原获取路径和哈希。购买后选择1–2张，覆盖增强须确认，Q10 禁止增强。留声纸每张有效留牌 +1 倍率；余音绕梁按手牌顺序在前两张有效留声纸各自加1后分别 ×1.2，未调整数值。
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
- 消耗工具可销毁（`DestroyConsumable`），长期道具同样可销毁（`DestroyLongTermItem`，按 `definitionId`，限商店／出牌阶段，无退款）；二者都走领域命令并进存档校验。
- 花蕊新局身份的赏赐为 2／4／6／8 金分别 ×1.5／×2／×3／×4，每场一次；扣款发生在计分前，持币钩子和过关利息读取扣后余额，主动倍率在路线成长之后结算。余额不足拒绝整档，旧身份保留原档位和结算时点。
- 秦琼新局身份沿用押注补牌实例与存档证明：目标命中且 1／2／3 张及以上新补牌参与有效计分分别 ×2／×3／×4；错目标或零张有效新牌为 ×0.85。不押的 ×1.15 保持原时点，已押倍率在路线成长之后；旧身份的成功倍率和时点不变。
- 辛弃疾寻得新局身份：每次正常弃牌成功后清除上一批；候选确认或不足自动全留时，记录实际补入实例。只允许下一手选择最大同点有效计分组，成功按数量 ×2／×3／×4，并在路线成长后结算；成功出牌清除批次，每场一次。静场保留换牌而停用寻得，关闭角色能力的挑战停用两者。弃牌回执绑定手牌和抽牌快照摘要，保存批次来源、固定候选和选择命令供检查点验证；预览与 AI 只读取公开留牌，不读取来源中的未来牌堆。旧身份保持原换牌规则。
- 刘娥同点组新局身份逐张逐次转移实际普通点数，压零不转，重触同样执行；事件保留原触发根和深度，增强、版次与触发次数不变。检查点逐事件验证，预览给真实结果并允许伤分；旧身份仍只转所选牌首次普通点数。
- 唐宋牌触发条件支持出牌序号窗口（`play-window`，含上下界）；回马枪为第 3–5 次出牌触发、第 6 次起不再触发的实现样例。
- `CHROMIUM_PATH=/usr/bin/chromium node harness/pc-landscape.mjs` 对实际预览运行四尺寸新局、购买、两手出牌、结算和继续；`PC_URL`、`PC_OUT`、`PC_SIZES` 可指定前后版本与输出。截图和 report 存入忽略的 shots，自动通过不代表审美验收。
- 规则 RNG 与视觉 RNG 分离；预览使用只读快照或克隆，不能推进真实随机流，也不能泄露未来牌堆和货架。

## 6. 存档与恢复

浏览器以 IndexedDB 保存完整检查点和有界命令日志，并保留上一份有效检查点。

- 存档只包含可序列化领域状态，不包含 Phaser 对象、DOM、动画句柄或个人设备信息。
- 先在临时状态完成命令，再持久化并发布新状态；保存失败时保留原局和可重试候选，明确提示未保存。
- 恢复后可直接展示已确定结果或重放表现，两种方式的规则状态必须一致。
- 内容版本、规则身份、模式和内容哈希共同隔离存档；旧数据不静默迁移或清空，应保留导出路径。
- 多标签页使用写者租约或版本比较，避免两个页面互相覆盖。
- 首屏恢复读取有 2.5 秒上限；用户在恢复尚未完成或读取失败时明确开始新局，可立即进入页面内存存储，不等待旧局读取；仍须取得写者租约，保护其他正在游戏的页面。过期恢复的读取、失败和收尾不得覆盖新局、释放新操作的忙碌锁或改写存储状态。
- 超时但尚未开始新局时，菜单的“重试读取”会重新绑定 IndexedDB 并恢复持久存储；已有内存新局不被重试读取覆盖。浏览器冒烟在验证刷新恢复前等待持久存储就绪，避免把有意的内存兜底误判为持久化失败。
- 内存新局通过菜单外的轻量常驻状态条提示“本局暂未保存，刷新会丢失”，菜单标记待处理提示；旧档仍保留。刷新恢复原 IndexedDB 存档，不自动迁移或把内存局宣称为已持久化。存储恢复后重新加载并开始的新局仍按正常租约、revision 校验和检查点备份写入，再次刷新恢复新局。内存控制器在同页继续或接管时仍绑定原内存存储，不能混入磁盘 revision。`player-entry-storage.test.ts` 覆盖无存档、未结束旧局、挂起、迟到成功/失败/租约、保存失败重试及新局刷新。 `node tests/player-entry-recovery.browser.mjs` 用 Chromium 的真实 IndexedDB、Web Locks 与页面刷新验证五条主路径；可用 `SMOKE_CHROMIUM_EXECUTABLE_PATH` 指定已有浏览器。`node tests/player-entry-recovery-ui.browser.mjs` 通过真实触控验证首页→选角→路线→商店→牌桌，断言关闭菜单时风险提示可见且不覆盖按钮、迟到恢复不跳回旧局，按 HEAD 保存报告和截图。这两个脚本需显式执行，不属于默认 CI browser scope。

## 7. 表现、输入与资源

牌桌菜单提供画面大小：默认依据浏览器的 `medium` 默认字号判断是否请求最多 1.2 倍画布放大，也可显式选择标准或较大并保存在浏览器中。画布放大会重排并同步命中坐标；320×568 无安全区时可放大 1.1 倍，手牌按空间分页，安全区不足时自动降低倍率。若上安全区 44px、下安全区 34px，即使标准倍率手牌也偏小，需单独的滚动布局。用户请求大字时，首页、加载页面及原生详情弹窗的文字会放大并重排，较长弹窗整体滚动；这不表示覆盖所有系统辅助字号设置。

- 动画消费已经确定的 ScoreTrace／事件，不反向计算分数。
- 每代演出拥有独立取消信号；场景关闭时清理 tween、timer、监听和视图引用，旧回调不得操作新对局。
- 英雄技能保留既有来源线和舞台线的样式，在线条外沿叠加小段移动的蓝白电弧；来源线并行绘制窗口为 900ms，不增加技能队列等待。来源轨迹遇计分板、唐宋牌区域或出牌区域时只保留来源一侧，避免穿板后露出断段；其他受保护内容仍需避让。已保存的技能目标牌在飞行与命中时以牌体为锚显示细蓝白余电，单次最长 1000ms 并随牌面、其他牌和控件裁剪，不延长计分或输入等待。减少动态时不显示电流，提前释放或跳过可截断，电流层随演出清理。
- 多彩扑克牌采用独立光谱彩缘：牌桌与奇遇预览保留流光，商店工具小牌为静态内缘；减少动态时静止，牌面、选中与停用标识保持可见。唐宋牌与其他版次使用原有表现。
- 牌桌提示文字按画布密度生成纹理；开场动画若已实际出现且场内有安全空间，可继续显示不阻挡输入的短文字，切场、弹窗或出牌时取消。
- 跳过、快进、静音、减少动态、后台切换和 resize 不改变规则结果，也不重复奖励。
- 群英卷轴仅在每次页面加载后的首页播放一次：保留浅色纸卷，六人完整亮相后额外停留 1 秒，总长 2.6 秒，展开、落印与淡出保持原节奏；可直接操作离开首页，减少动态时跳过。选角页不重播群英卷轴，仅重置本局单人登场演出的播放额度。
- 桌面横屏与手机竖屏共用 CSS 坐标和明确命中区域；触控、键盘与标准手柄均为正式输入路径。
- PC 牌桌新版由 SceneView 的 game 场景显式启用，几何函数 PcTableLayout 只消费尺寸/安全区/手牌数据，默认不开启；实际入口排除 primary coarse pointer，要求至少 1180×640 可用横向空间。移动牌桌保留正式触控几何，同时由 StageTableArt 绘制当前英雄的透明纸面层。
- PC 以 1920×1080、1920×924 和 1366×768 为主要画幅，牌桌在宽屏将外框限至 1600px、构筑匣限至 1100px；战绩板与实际落牌带并排，手牌与紧凑操作区位于其下。按安全区与内容高度分配构筑牌和落牌带，保证最低 64×89.6px 落牌及留白；状态、构筑、手牌、动画、命中与手柄焦点共享最终几何。PC 构筑摘要按完整数字与符号折行、省略，卡图和同槽摘要均可打开详情或拖动调序。
- PC 手牌下方以固定最大宽度紧凑排列弃牌、理牌和出牌，技能独立位于出牌右侧；技能状态和手牌命中保持独立。`PcActionKeyboard` 为现有画布动作提供同步禁用状态与次数/技能说明的原生键盘焦点，复用原动作回调；画布仍处理鼠标，手柄继续使用原几何目标。重排、缩放和场景关闭须保持或清理焦点，不把键盘代理重复加入手柄目标；移动布局不挂载该代理。最低高度 PC 接入手柄时，提示条移到顶部留白，避免压缩画布触发短屏回退；断开恢复原显示。
- PC 商店固定上方持牌轨道，三件现货各自整合图、规则、报价和购买入口；实际商品区必须满足最坏版次/禁用说明的276px内容预算，否则回退紧凑货架，不能强夹文字高度导致交叠；购买继续使用现有确认与命令校验。PC 结算按人物与内容整体居中，将成绩及奖励与实际牌组并列、下一步置于其下；极长内容仍可滚动。IntermissionLayout、PcSettlementPresentation 和 IntermissionScroll 展示实际末手组合、已保存热度/倍率/入账和奖励；长去向文字保留详情入口，事实来自 settlementFacts，禁止表现层重新计分。
- beginPcSettlementCut 是 PC-only 非阻塞暖纸 DOM 衔接，不是旧牌桌截图，不修改 PaperFlow 或奇遇切场。它不等待动画再执行导航，减少动态时不播放，拥有明确清理上限；结算入场同样不决定规则或奖励。
- PC 牌桌与 PC/手机竖屏结算使用独立 `pc` purpose（沿用技术键，不替换既有 portrait/selection）：`public/assets/tangsong-pc-heroes/manifest.json` 注册六张 896×1120 带 alpha WebP（合计 1,794,950 字节）。`PcHeroArt` 按各自衣袖、双锤和剑的轮廓定义比例与水平落点，完整保留源画幅；PC 人物保留透明边缘并落在独立位置，结算以淡色圆形背光承托人物。
- 透明图只在实际 PC 牌桌、商店英雄席、移动牌桌或 PC/手机竖屏结算请求当前英雄；复用原有受控图片队列与结果取消生命周期，不加入首页六人预加载。`portrait`、`selection` 与角色详情仍使用原路径，存档身份和玩法规则不变。
- 手机竖屏结算由 `MobileSettlementPresentation` 独立绘制：人物/成绩主区、全宽奖励、去向和稳定按钮，紧凑屏压缩人物区而非把 PC 三栏缩小。长去向可点标题展开全文；失败、跳场、通关仍走真实既有操作。
- 平板和短横屏的通用 `drawSettlement` 同样读取 `settlementFacts` 的末手牌型、实际打出的组合和计算解释；关键牌来源不得替代组合，`playedIds` 不等于 `activeScoringIds`。短屏通过既有结算滚动访问后续操作。`node harness/fallback-settlement.mjs` 验证 1024×768、740×390 的来源/多手累计/失败/跳过及 PC、手机竖屏回归，截图和报告写入忽略的 `shots/fallback-settlement`。
- 通用图片加载器只对注册的 `pc` purpose 使用 400,000 字节、896×1120 像素限额，并继续校验键/URL/真实尺寸；其他图片保留原 128 KiB / 600,000 像素限额。
- PC 牌桌与商店道具箱共用 `pcToolInventoryContent` 的 22px 图标轨道与独立文字区，12px 间隔、绝对定位，保留原按钮功能和手机样式。
- `node tools/build-pc-hero-art.mjs <原图目录>` 可重建运行图及 SHA/alpha/来源映射。源图为用户 Desktop/lihui/table 六张 1122×1402 PNG，原文件保留在外部；不向 public 复制原图，不生成新人物，不裁头手或武器。WebP quality 84、alphaQuality 100、无放大。
- 手柄采用浏览器 [Gamepad 标准映射](https://www.w3.org/TR/gamepad/#remapping)：方向键／左摇杆移动焦点，底部键确认或选牌，右侧键返回或取消选择，左侧键出牌，顶部键弃牌；Xbox 分别显示 A／B／X／Y，Sony、Nintendo 按设备显示对应键名。LB／RB 调整聚焦手牌或唐宋牌顺序，在商店其它位置切换货架，在弹窗中逐项导航；LT／RT 按点数／花色整理，View 查看聚焦牌详情，Start 开关菜单；右摇杆滚动。
- `GamepadInput` 只让方向导航连发，确认、出牌、弃牌、调序等按键每次按下仅执行一次；首次连接、断线重连和后台恢复须回到中立位置。未知映射不猜测键位。`GamepadNavigation` 只调用 `SceneView` 注册的有效操作及顶层原生弹窗控件，不模拟键盘、不绕过现有命令校验。关闭、切场景和换回鼠标／键盘会清理焦点表现；手柄提示显示时为牌桌保留独立底栏。
- 有独立操作按钮的选择卡片通过 `WholeActionSurface` 将标题、说明与留白接入同一按钮；嵌套控件、禁用按钮及文本选择保持各自行为。点击选择卡片仍由原有确认流程决定是否提交。
- 音频统一走应用级总线，处理解锁、后台 suspend、音量偏好和实例清理。
- 资源使用注册表与 `BASE_URL`；源素材、运行时变体和预览文件分开，首屏只加载必要资源。`BootScene` 先关闭静态首屏并进入标题，旧局 IndexedDB 恢复与 opening 图片恢复由 `prepareDestinationBackground` 后台运行；缺图保留 `ResourceRecovery` 重试，不得阻塞新局入口。
- 当前素材清单为 `docs/assets/inventory.json`，素材检查工具位于 `tools/blender/`。
- 英雄文案数据为 `src/content/hero-text-spec.json`；清理文档不改其内容，也不将文案技能说明当成所有旧存档共用的规则。

本轮三条视觉重做线的实现入口已经合并：`PcTableLayout`/`StageTableArt` 负责牌桌，`ShopLayout`/`ShopScene`/`ShopArt`/`ShopMobileOffers` 负责商店，`IntermissionLayout`/`PcSettlementPresentation`/`MobileSettlementPresentation` 负责结算。后续只处理用户试玩后可复现的工程问题，不把检查数量写成审美结论。

## 8. 测试、CI 与发布

现有检查可分为两类：

- `domain`：`npm test` 与 `npm run verify:content`。
- `browser`：`npm run build` 与 `npm run verify:smoke`。

`release-candidate.yml` 在 main 推送或手动运行时，在只读 job 中针对同一检出运行完整 `verify:ci`、生成并验证单一归档、SHA256 和 manifest。仅 main 的独立发布 job 使用内置 `GITHUB_TOKEN` 的 `contents: write`：先创建或检查草稿，下载并逐字节核对完整资产，再核对标签及 main 并发布为 latest；失败时不发布不完整包。重复运行只可继续完整且字节相同的草稿，不覆盖现有正式 Release。校验与发布不是 GitHub 的原子事务，main 可能在最后检查后变化；部署侧仍须按 `sourceRevision` 和当前 main 精确匹配，实际安装的服务器行为需单独核实。工作流的启用状态和实际运行结果需分别核实。

推送 main 前，在 Dot 远端开发电脑或开发者本机执行完整 CI。`npm ci` 按锁文件安装依赖；`verify:ci` 顺序运行完整单元测试、内容校验、类型检查与唯一生产构建、Chromium 桌面和手机冒烟。冒烟脚本另建供测试使用的 e2e 预览，不是交付的生产包；生产产物为 `dist/`。优先使用已安装的系统 Chrome／Chromium，通过项目支持的路径配置；以下分别为 Bash 和 PowerShell 示例，路径按实际机器调整：

```bash
npm ci
SMOKE_BROWSERS=chromium SMOKE_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run verify:ci -- --scope=all
```

```powershell
npm ci
$env:SMOKE_BROWSERS = 'chromium'
$env:SMOKE_CHROMIUM_EXECUTABLE_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run verify:ci -- --scope=all
```

`npm run verify:ci -- --scope=domain|browser|all` 也可执行对应组合；`all` 默认只选 Chromium，上述配置明确指定系统浏览器。也可使用已安装的 Playwright Chromium。专项恢复、布局、故障和素材检查按相关改动另跑。检查全部通过后核对 `shots/ci/all.json` 中的提交 SHA、各步骤状态和退出码，以及前后源码、索引和 HEAD 一致；确认检查覆盖即将推送的提交，才推送 main。检查未运行或失败时明确报告，不以发布成功代替 CI 结果。测试使用的 JSON／压缩夹具属于代码输入，不为追求目录整洁而删除。

手柄、场景输入、选择卡片或对应 harness 发生变更时，按适用范围另跑 `test:gamepad:browser`；该脚本的系统浏览器路径变量为 `CHROMIUM_PATH`，与冒烟脚本的 `SMOKE_CHROMIUM_EXECUTABLE_PATH` 不同。专项结果与失败截图保存在 `shots/gamepad/` 中，同样核对提交 SHA、结果和退出码。

牌面遮挡检查测量包含父容器变换的实际四边形相交面积；旋转后的外接矩形包含牌外空白，不能代替真实遮挡。

### 开发电脑：交付 Release 给服务器

服务器当前每分钟检查 GitHub `big-dimple/tangsongpai` 的 main，**只接收与 main 的完整提交 SHA 完全一致的已发布 Release，匹配依据是 Release 资产 `manifest.json` 的 `sourceRevision`，不是 Release 标签名**。它不读取入库的 `dist/`，也不会在服务器上安装依赖、构建或测试。当前服务器的取件脚本已安装；仓库中旧的自动部署脚本尚未同步，不能以它判断服务器实际行为。没有匹配的 Release 时，服务器保留线上旧版本并继续等待。

此前 `dist/` 被误提交进 main：先在开发电脑核对 `git status` 和最新 main，保留他人改动。根据本次用户要求，在开发侧将 `dist/` 恢复为忽略项并从 Git **索引**移除（例如添加 `.gitignore` 的 `dist/` 后执行 `git rm -r --cached -- dist`，不删除本地构建目录），提交该清理；不要改写、重置或强推历史。此后提交源码、不提交 `dist/`。当前误入库产物的 `build-info.json` 对应其前一个源码提交，不能把它标成清理提交或最新 main 的构建；必须针对最终提交重新执行 CI 和唯一生产构建。

按以下顺序在远端开发电脑操作，推送和创建 Release 按用户授权执行：

1. 在干净工作区提交准备发布的最终源码及上述清理，确认 `git status --short` 没有修改。执行上面的 `npm ci`、`npm run verify:ci -- --scope=all`，以及本次改动需要的专项。失败立即停止；不能补写或伪造 CI 结果，也不能在服务器代跑。
2. 核对 `shots/ci/all.json`：`scope` 为 `all`，`status` 为 `PASS`，`exitCode` 为 `0`，`testedCommit` 为当前完整 `git rev-parse HEAD`；`before` 与 `after` 完全一致且 `head` 是该 SHA；`test`、`verify:content`、`build`、`verify:smoke` 四个步骤都 `PASS` 且 `childExitCode` 为 `0`。`dist/build-info.json` 的 `revision` 必须等于同一 SHA，`sourceStatus` 是 `clean`、`modified` 是 `false`。`dist/index.html` 必须存在。
3. 在同一个未修改的检出目录运行 `python3 scripts/prepare-release-artifact.py`（Windows 可用 `python`）。它复核上述报告、当前源码快照和构建身份，不重跑构建；输出 `shots/deploy/<完整 SHA>/` 内的三个文件。若拒绝，修复原因并按需重跑 CI，不要手改报告或构建信息。`shots/` 和 `dist/` 不提交到 main。
4. 推送通过 CI 的提交到 main；推送前确认远端 main 没有新增工作，禁止强推。若 main 已变化，保留他人修改，基于最新 main 合并后重新执行 CI、构建和打包。服务器要求 Release 的 `manifest.json` `sourceRevision`、归档内 `build-info.json` 的 `revision` 与 main **完全一致**，祖先提交不够。
5. 建立草稿 Release，上传以下三个文件，核对内容后再发布。**GitHub 禁止创建 40 或 64 位纯十六进制字符的分支或标签名（pre-receive 拒绝），因此 Release 标签统一为 `v` + 完整 SHA**（例如 `v3499dae8…`），标签必须指向该提交，不能是分支名或缩写；服务器一律以 `manifest.json` 的 `sourceRevision` 匹配 main，标签名只用于人读定位。服务器只处理已发布的正式 Release，草稿、预发布、缺件、sourceRevision 不匹配或校验失败都会等待或拒绝。

服务器要求文件名和内容如下：

- `dist.tar.gz`：生产构建归档，解开根目录直接包含 `index.html`、`build-info.json` 与素材目录；不能包含符号链接、不安全路径或特殊文件。
- `dist.tar.gz.sha256`：单行 `<64位小写SHA256>  dist.tar.gz`，校验值必须匹配归档。
- `manifest.json`：`schemaVersion: 1`、`sourceRevision: "<完整 SHA>"`、`artifact: {"name":"dist.tar.gz","sha256":"<归档 SHA256>"}`，以及 `buildInfo`（与归档内 `build-info.json` 完全相同）和 `ci`（原样复制已通过的 `shots/ci/all.json`）。以上打包脚本生成该格式。

Bash 示例（先完成并核对上述 CI，仓库和 GitHub CLI 已登录）：

```bash
python3 scripts/prepare-release-artifact.py
revision=$(git rev-parse HEAD)
artifact_dir="shots/deploy/$revision"
gh release create "v$revision" --repo big-dimple/tangsongpai --target "$revision" --draft --title "$revision" --notes "CI-verified production artifact" "$artifact_dir/dist.tar.gz" "$artifact_dir/dist.tar.gz.sha256" "$artifact_dir/manifest.json"
verify_dir=$(mktemp -d)
gh release download "v$revision" --repo big-dimple/tangsongpai --dir "$verify_dir" --pattern 'dist.tar.gz' --pattern 'dist.tar.gz.sha256' --pattern 'manifest.json'
cmp "$artifact_dir/dist.tar.gz" "$verify_dir/dist.tar.gz"
cmp "$artifact_dir/dist.tar.gz.sha256" "$verify_dir/dist.tar.gz.sha256"
cmp "$artifact_dir/manifest.json" "$verify_dir/manifest.json"
(cd "$verify_dir" && sha256sum -c dist.tar.gz.sha256)
gh release edit "v$revision" --repo big-dimple/tangsongpai --draft=false
```

Windows PowerShell 使用 `python scripts/prepare-release-artifact.py`、`$revision = (git rev-parse HEAD).Trim()`、`$artifactDir = "shots/deploy/$revision"`，其余 `gh release create/download/edit` 参数相同；用 `Get-FileHash -Algorithm SHA256` 和文件内容核对下载资产。发布后确认三个资产均已上传、Release 不再是草稿、标签指向该 SHA，且远端 main 仍是该 SHA。认证应使用有仓库访问权限的账号；SHA256 只证明文件一致，不单独证明来源。

分别报告推送 SHA、CI 状态、Release 交付和公网 `https://pai.hp666.cc/build-info.json` 的实际 revision；Release 发布后服务器通常在下一分钟开始处理，上传与域名传播还需要时间，不保证固定上线时刻。服务器只获取、校验、上传和确认；没有匹配包或验证失败时不会把旧版本称为新版本。历史本机 CI 报告不代表当前提交通过 CI。

GitHub 仓库为 `big-dimple/tangsongpai`，Cloudflare Pages 项目为 `dachoupai`。GitHub 工作流是否启用及运行成功以实际 Actions 状态为准；自动检查不代表真人、美术、设备或平衡验收。检查失败时查看日志并修复，不通过放宽检查或伪造结果交付。

## 9. 文档维护

项目只维护 `TODO.md`、本文件和 `AGENTS.md` 三份核心文档，README 仅作入口。规则变化直接更新本文件，当前工作只更新 TODO，不新增路线图、工作包、日期化交接、评审回执或证据 README。必要测试数据与其使用者放在一起；已有 `docs/production/evidence/` 中的 JSON、压缩数据及脚本是历史测试输入，不是当前任务或验收状态，删除或迁移前同时核对直接引用、拼接路径与导入关系。新的检查输出放被忽略的 `shots/` 或 CI artifact，避免重新堆积进 docs。
