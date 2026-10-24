# 唐宋入场演出 · 交接记录（2026-10-24）

> 范围：仍属「奇遇」专项的表现层（首页首次加载、选角入场、六英雄切换特写、商店/关卡/压轴/奇遇入场共用 cut-in）。只做演出，不碰存档、计分、RNG。
> 状态：**代码已合入 main。本地 `tsc --noEmit` 零错误；真人审美、实体手机签收都还没做。** 不要用 CI 或截图结果代替玩家签收。

## 1. 已落地内容

| 提交 | 内容 |
| --- | --- |
| `b17b2ce1` | 六英雄共用入场 cut-in `mountHeroEntranceBurst` + 60fps 常驻舞台 `mountHeroLiveStageCanvas`，接入商店/关卡/压轴/奇遇（CI 当时因 6 处类型错误失败） |
| `ef4d1443` | 修复上述类型错误；首页 / 选角加入群英长卷 `mountTangSongEnsembleBurst`；装饰画布放进 closed Shadow Root（CI 通过：docs / domain / browser） |
| `f50a4d26` | 美术审查修复：响应式高清舞台、竖屏立轴版式、首页宣纸色板与布局回归修复、音效减量，并编写交接文档 |
| 本次提交 | 竖屏立轴比例微调（消除多余留白）、首页纸色遮罩柔化（避免闪白）、新增 `tests/tangsong-entrance-burst.test.ts` 专项单测 |

### 代码位置
- [src/game/TangSongEntranceBurst.ts](../../src/game/TangSongEntranceBurst.ts)：**独立入场模块**，包含 `createShadowCanvasHost`、`mountHeroEntranceBurst`、`mountTangSongEnsembleBurst`、`resetTitleEnsembleForTests`。
- [tests/tangsong-entrance-burst.test.ts](../../tests/tangsong-entrance-burst.test.ts)：**专项单测**，覆盖 closed Shadow DOM 隔离（Playwright 与 `document.querySelectorAll('canvas')` 绝不可见）、reduced-motion 禁用、title 模式单次防重与重置、select 模式挂载与清理。
- [src/game/QiyuAnimationPresentation.ts](../../src/game/QiyuAnimationPresentation.ts)：保留奇遇转场/祭坛/仪式与 `mountHeroLiveStageCanvas`，并转出（re-export）上面两个入场函数，原有调用方（GameScene、ShopScene）不受影响。
- [src/game/TitleScene.ts](../../src/game/TitleScene.ts)：`create()` 里调用 `mountTangSongEnsembleBurst(document.body,{mode:'title'})`，在 SHUTDOWN 时清理。
- [src/game/CharacterSelectScene.ts](../../src/game/CharacterSelectScene.ts)：进入时调用群英长卷（`mode:'character-select'`）；`select()` 切换英雄时调用 `mountHeroEntranceBurst(...,{context:'select'})`，450ms 内连续切换不再播音效（避免方向键浏览时音效叠在一起）。

## 2. 本次美术审查发现的问题与修复

1. **首页布局被破坏（严重）**：上一版 CSS `.home-hero > *:not(.qiyu-hero-live-canvas){position:relative}` 把首页 `.load-world`（山水背景）、`.load-side`（竖排题字）、`.load-fan`（牌扇）这些绝对定位元素强改成 relative，首页会错位。→ 已删除该规则，并撤销对 `.home-hero` 的 `position/overflow` 改动。
2. **首页常驻彩带画布和纸本首页风格冲突**：在浅色宣纸首页上叠深色光晕、流彩彩带和偏离中心的涟漪，画面显脏。→ 首页不再挂 `mountHeroLiveStageCanvas`（关卡卡片/奇遇横幅照旧使用）。
3. **画布被拉伸、高分屏发糊（严重）**：旧实现固定 960×540 像素，再用 CSS 拉满全屏；手机竖屏下文字、圆形头像、印章都被拉成椭圆，2× 屏也会糊。→ 新增响应式舞台 `prepareStage`：按实际视口 × devicePixelRatio（上限 2）设画布尺寸；横屏用 960×540、竖屏用 540×960 的设计坐标等比适配并居中；遮罩铺满整个视口。
4. **竖屏版式**：横屏是一行六卡的手卷，竖屏改成 3×2 网格、向下展开的立轴；英雄 cut-in 在竖屏改为头像在上、文字居中的布局。所有文字用 `fitFont` 测量后自动缩小，不再越界、不再压到印章（例如「辛弃疾 · 墨影醉里挑灯看剑」）。
5. **首页配色**：标题模式改用首页自己的宣纸色板（米白纸、墨 `#26313a`、朱砂 `#b8473a`、古金 `#b99a61`、黛青 `#3f606b`），文案沿用加载页的「一纸纳山河 · 落子会群英 / 唐宋牌 / 唐宋群英 · 牌局争锋」，结束后自然衔接到浅色首页，不再先在浅色首页上闪一下黑屏。选角模式保留深色漆面配金，和选角舞台一致。
6. **文案**：删除自编的「进藏 / 百花 / 门神」等说法；选角副标题直接用六枚印文「赤壁 · 看剑 · 定章 · 奉锦 · 凌风 · 冲阵」（来自 `qiyuHeroProfile`）。
7. **首页演出只在首次加载后播一次**（模块级标记），从菜单回到首页不会重播。
8. **音效 / 震动减量**：上一版每次入场叠 5–6 个音效（含计分用的 `multiplier`）。现在完整入场依次为 `curtainOpen` → 盖印 `rareReveal` → 收束 `score(1)`；选角切换只有一个 `sourceCue('character')`，震动用 `selectionChanged`。音频解锁前 AudioEngine 本身不会出声，也不会攒到之后补播。
9. **图像**：头像和眼部条图改为按中心裁切铺满（`drawCover`），不再变形；`Image` 有模块级缓存；图片还没加载好时，头像位置显示姓氏首字的墨字圆章。
10. **细节**：两字印文改为传统竖排；`roundRect` 改用自写路径，兼容旧版 Safari；字体栈加入 Songti SC / STSong / SimSun；装裱边框改为固定在纸面坐标，展开过程中不再错位。

## 3. 已完成优化与后续验证建议

1. **单测覆盖（已完成）**：新增 `tests/tangsong-entrance-burst.test.ts`，验证：
   - closed Shadow DOM 隔离（`document.querySelectorAll('canvas')` 绝不捕获装饰画布）；
   - `reducedMotion` 严格不挂载节点；
   - `mode: 'title'` 单次加载去重及重置机制；
   - `mode: 'character-select'` 挂载与 dispose 完全清理。
2. **版式与视觉调优（已完成）**：
   - 竖屏立轴卡片高度加高至 190px、内容垂直居中、下边缘余白修正为自然呼吸间距；
   - 首页宣纸遮罩不透明度调整为 0.78，消除了退场时的闪白感。
3. **玩家实机签收**：在 PC 横屏、手机竖屏浏览器体验；确认「可跳过/减少动态」设置能彻底关掉全部入场演出。
4. **可选调整**：选角切换 cut-in 仍为全屏横带，450ms 内快速切换已静音；若玩家希望只在立绘区展示，可将 host 换成立绘容器。

## 4. 已知风险
- 本次重构没有在本地跑 `vite build` 和截图核对（额度截止），新版画面还没被人看过，以第 3 节第 2 条的实际截图为准。
- 「自动部署」依赖 root crontab：`* * * * * /usr/local/bin/tangsongpai-autodeploy.sh`（目前**开启**）。push 到 main 后约一分钟内会自动部署。
