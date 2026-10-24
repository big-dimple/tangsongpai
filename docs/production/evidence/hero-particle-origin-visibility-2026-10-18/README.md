# H17 手机源点与弃K粒子返修（2026-10-18）

开发分支 `fix/hero-particle-origin-visibility-20261018`，基线 main `bda242398dc44680fa853975ea743fc8a64204ee`；产品提交 `e0f2c3a552f885d965624333737a69bddcd5b716`。机器证据索引见[verification.json](verification.json)。用户真实反例 `Sentinel_a3e7fa5a4d408191a639311dc867d4ee`：手机新开Su v3，贬谪像从道具箱发出，被弃K周围没有明显粒子；`Sentinel_d4b2d016913081918161a8299c5599e4` 要求核查其余五人。H17已明确重新返修，P08保持in_progress；已合入工程不算体验通过。

## 可定位根因与修复

1. `GameScene` 的源点回调原取技能按钮右边界再加16px；实际手机布局该点为持有区左边界+8px，320/390px均落入道具箱。新 `HeroEffectOrigin` 每次取活头像的世界边界中心，隐藏时退到技能中心，检查祖先隐藏及CSS屏幕边界，不缓存布局、不乘DPR。苏轼和其余五人共用这一真实回调，通用组件优先显式锚点，避免被装饰立绘启发式覆盖。发射图层带 `source/sourceKind/targetIds/savedEventId` 供远端定位。
2. **Phaser 3.90真实API错误**：`node_modules/phaser/src/gameobjects/particles/zones/DeathZone.js` 的 `willKill` 传入 `particle.worldPosition`，既有代码却按局部坐标再次变换，并重复叠加fire发射器偏移。右侧K如世界x=300会被变到x=600后当作屏外死亡，六人共用此缺陷。现在world只逆变换一次到本牌裁剪面/根遮挡区，屏幕判断直接用world；发射器偏移已含在world中。新增直接加载真实Phaser DeathZone的六种配色回归，旧基线6项均失败，修复后6项均通过。此前局部坐标mock未覆盖实际API，不能继续作为已正确显示的证据。
3. 既有Canvas分支完全关掉原生粒子，只留下静态标记。现在Canvas使用缓存32×32、预着色渐变位图和NORMAL混合，保留真实运动粒子；WebGL继续官方配方颜色梯度。没有假定用户实际用了哪种渲染器。共用场景池仍最多128粒子/8目标，每目标7个短起焰+9个周边；Canvas按实际配色缓存，六人最多6张小位图。
4. 苏轼保存后原立即开始180ms淡出，被弃K来不及清楚承接起焰。现仅非replay的完整动态先停留260ms（仍保留每牌30ms错峰），再走原180ms淡出/局部220ms Lempo刀光。减少动态0延迟，replay保持原时序。只调整展示时间，不改变当前新局×3或“实际弃余牌含当前点数K”的规则。
5. `refreshSelection` 会把真实牌面提到早建代理上方；保存弃牌代理现在每次更新提到牌面前，文字/原画与非目标仍由死亡区保护。多个真实弃牌不再彼此当整张普通牌裁掉周边粒子；所有真实文字、图片及普通牌仍受保护。本牌内部始终由局部死亡区裁掉。仅真实discardedIds建代理；存活来源离屏、隐藏或祖先隐藏会停止代理及粒子。牌面实际销毁后保留捕获位置的能量，直到同一真实arrival/冲击结束或abort/root销毁清除，不复活牌面。

## 六人目标链与窄验证

没有改domain、存档、ID、能力数值、原画、商店或全局渲染设置。

|英雄|保留的真实目标/阶段|本次覆盖|
|---|---|---|
|苏轼 amo|已保存 `amo.exile` 的实际discardedIds，包含实际弃K；不投到主牌|世界坐标、活头像源点、蓝焰/刀光停留、前层代理、真实arrival/abort寿命、非目标和文字保护|
|刘娥 erxiang|真实交棒目标与同一保存事件释放|共用源点/死亡区/Canvas；保存ID、释放/取消链|
|花蕊 xiemu|实际付费事件中的activeScoringIds|共用源点/死亡区/Canvas；实际事件与倍率链不改|
|文成 azao|实际释放事件中的activeScoringIds|共用源点/死亡区/Canvas；实际事件与倍率链不改|
|秦琼 touye|真实押注保存后锁目标；结算仅activeNewIds，失败不冒充成功|共用源点/死亡区/Canvas；锁定/胜负真实阶段|
|辛弃疾 laohuan|保存弃牌后先凝视，再揭候选；保存留牌ID持续归属，首次正数普通计分冲击|共用源点/死亡区/Canvas；直接调用GameScene弃牌链与留牌/计分回归|

`npm exec vitest -- run tests/hero-native-particles.test.ts tests/hero-effect-origin.test.ts tests/sushi-discard-local.test.ts tests/sushi-discard-visibility.test.ts tests/sushi-lempo-slash.test.ts tests/sushi-discard-origin.test.ts tests/hero-action-chain-order.test.ts tests/hero-retained-ownership.test.ts tests/hero-attachment-facts.test.ts tests/hero-target-attachment.test.ts tests/hero-attachment-viewport.test.ts tests/touye-locked-state.test.ts`

结果：**12文件72项通过**（2026-10-18）。包括真实Phaser世界死亡区、旋转/缩放父坐标、DPR CSS边界、Canvas着色缓存、目标上限、隐藏/销毁/重绑、真实discardedIds代理移除/冲击/abort与存活来源隐藏/离屏、现有辛弃疾凝视先后链。仅代码回归，无浏览器。

`npm run build`：**PASS**，类型检查通过，Vite构建370模块（产物JS `index-Cn-Ggj3_.js`）；仅既有大包分块提示，无新增依赖或资源。`git diff --check`通过。

## 父线程转述的有限PC观察

父线程 `01a0ff29-5792-7524-8980-f2037b2c30ce` 后续报告：远端dot的 `4429` 同版PC真实新局，主手10♦／J♣／J♠／10♥为两对，实际弃4♦／7♥／K♣／7♦。保存后能看到从左上真实头像向弃牌发出的蓝色轨迹，K上方有蓝色运动粒子；最终630＝210×3，胜400目标。此记录仅按父线程转述，当前子线程没有运行浏览器；该消息未附精确部署SHA或截图/视频文件路径，原始远端证据由父线程持有。

已捕获范围为起焰阶段单帧与最终结果，支持这一PC场景的源点不再位于道具箱、实际弃K上方能看见粒子的有限观察。**不能据此签整段刀光、持续动态、手机或六英雄全验通过。** 父线程主观暂看仍像蓝点，不足以声称达到用户要求的明显蓝焰；不因此启动新一轮无依据改动。手机、完整过程和视觉强度继续待验，H17不通过，P08仍in_progress。

## 远端待验与唯一交接

**本机未启动浏览器/游戏，PC/手机动态与主观效果未验。** 不用上游demo、静态截图、函数或单测存在代签。root整合后在远端dot用同版新局复查：手机被弃K可辨识承接头像蓝焰→自身刀光→真实分数转移，其余五人真实目标/阶段；连续过程、普通牌对照、文字可读、reduced motion、隐藏/离屏/场景退出清理。保持用户反例和体验待验，不写整体完成百分比。开发分支正常push交root，未操作main或CI/域名。

整合补记：main bda242398dc44680fa853975ea743fc8a64204ee上正常无冲突合入最终来源b033213c95a06ae3938db752ea13c937cd03e143。src/tests/harness/public及依赖文件与来源和被测产品e0f2c3a5相同；domain、音频、素材及上一批菜单保持不变。精确复用来源12文件72项及类型/370模块构建，不重跑产品测试或本机浏览器；合版计划与diff检查另核。H17保留用户手机反例、修复已整合/远端动态待验，P08仍in_progress；按授权普通合main/push，精确main与CI链接见最终回执。
