# 奇兵突起 / 野火春风说明修正

基线：main `ca5e78799c44e683d2b26a5b54f16d3b4fcc898c`。本批在 `dev/joker-d02-wildfire-copy-20261019` 交付，由既有整合负责人接收。

## 已核对的规则

- **奇兵突起（d02）**：每次出牌，手里没打出的牌中，点数是 2、3、4、5 中任一种的，每张加 6 热度，最多 4 张。不必凑齐四种点数，同点牌分别算；停用牌跳过，再按手牌从左到右取前四张。只给本次出牌加热度，不加留手牌的普通点数，也不永久成长。
- **野火春风（a08）**：每张打出的计分牌，若点数是 2、3、4、5 中任一种，就多加 20 热度。同点牌分别算；打出但没参与计分的附带牌、停用牌、留手牌不算。符合的牌实际再次计分时再次获得加成，不永久成长。

正式名称来自 `src/game/tangsongCardNames.ts`。定义来自 `src/content/r2-jokers.json` 的两个 hook；判定来自 `src/domain/r2Conditions.ts` 的 `rank-in` / `held-rank-first`，后者对 `validHeld` 先筛选点数再截取上限。`src/domain/scoreR2.ts` 排除停用留手牌，再执行逐张计分、重触发与留手 hook。

## 修改范围

`JokerPlayerTemplates.json` 只改 a08/d02 两项；`JokerPlainCopy.ts` 让这两个实际规则签名使用清楚的主句，并同步时机、每张加值和留手上限；`JokerCompact.ts` 给短标签补“点”字。d02 详情删除与实际留手加成相矛盾的旧句。数值、点数列表、上限继续绑定正式定义。

规则、内容、身份、存档、名称、美术、场景和音频源码均未修改。

## 验证

- 四个定向文件共 **25/25**：`low-rank-joker-copy`、`joker-plain-quantity`、`joker-player-copy`、`joker-compact`。
- 新增六项测试使用正式 `scoreR2Hand`，核对重复点数、低点附带牌、留手与停用排除、真实 encore-paper 重触发、d02 先跳过停用再取上限、普通点数与无成长；同时核对六个当前新局身份和已发布 v11 的两个实际 hook。
- 渲染测试用克隆定义调整点数/加值/上限，确认展示动态读取定义，不把当前数值写死。
- `npm run typecheck` 通过；Vite 生产构建通过（399 modules，既有大 chunk 提示）。`git diff --check` 通过。

本批未运行浏览器、长局、全矩阵、CI、域名或部署检查；由整合负责人接收开发分支并按当前统一计划处理。
