# 苏轼表现撤除

基线 main：`3e01adf897d379b50c4575ba7c21cc77d143866c`。开发提交：`a48650b5882378f0205b7bb163ca074b428f6216`。本目录后续提交仅加入证据，不改产品。总计划由另一任务维护，本批未改计划文件，也未合入 main。

按用户否决当前苏轼表现的要求，从真实 GameScene 撤下选技能后的 K 预备框、悬挂“本手倍率”标签与牌体提示；结算不再调用弃牌烟雾、剪影、K 火焰、刀光、传输流线，也跳过本次贬谪的整手扑击、人物光圈和装饰高光。现有“主 / 弃”牌面标记、技能按钮和文字来源继续使用。

弃牌代价仍取已保存 trace 的准确 discardedIds，并等待该技能事件真实到达，再沿用普通弃牌动作。普通弃牌原有配置完整提取到 DiscardMotion，方向、角度、时长和交错延迟保持；没有新造替代特效。中止时只清理已提交的代价牌，不碰主手或计分/存档。

资格、余牌必须含 K 的条件、每场次数、整手倍率、计分和存档代码未改。实际倍率及前后得分继续读规则/事件；受控当前身份实际为弃 6 张、`102 → 306（×3）`。领域/内容/存档目录与刘娥声波及共享 HeroTargetAttachment/HeroLiveSmoke 源码同基线完全一致，保护范围见 [verification.json](verification.json)。旧独立绘图原语与相应独立测试暂留；本批仅从产品入口下线，没有扩大为共享表现库清理。

实际检查：

- `npm test`：407 文件、4951 项通过，见 [tests.txt](tests.txt)。
- 5 个定向测试文件：28 项通过，覆盖代价牌所有权、真实到达、到达前/弃牌中取消、销毁目标、迟到回调、简洁倍率反馈及预备入口，见 [targeted.txt](targeted.txt)。
- `npm run build`（含 typecheck）通过，见 [build.txt](build.txt)。构建保留其原始 base+dirty 信息；实际源文件及 JS 产物 SHA-256 绑定在 verification.json。
- `SMOKE_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium SUSHI_REMOVAL_OUTPUT=/tmp/sushi-removal-browser-pass node harness/sushi-presentation-removal.mjs`：1366×768、390×844、390×740 减少动态、中途减少动态清理、演出中刷新共 5 例通过。原生选牌、取消、改选 K 资格、菜单、出牌、回看、下一次普通弃牌、冷续局均与真实领域命令和保存 checkpoint 完全一致。完整样本中已撤装饰均为 0；见 [browser.json.gz](browser.json.gz)。
- `SMOKE_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium LIUE_EAR_OUTPUT=/tmp/sushi-removal-liue-cross node harness/liue-ear-ripples.mjs`：刘娥桌面/手机/减少动态 3 例通过，声波、改选、取消、菜单、结算清理及真实 328 分保持，见 [liue-cross.json.gz](liue-cross.json.gz)。

两次验证脚本失败保留：[旧菜单入口](initial-harness-failure.json.gz)、[回看后未关菜单](menu-close-harness-failure.json.gz)。修正的是脚本对当前原生 UI 的操作，产品代码没有为此修改；最终 5 例完整通过。

选技能后的实际画面：[桌面](desktop-chosen.png)、[手机](phone-chosen.png)、[手机减少动态](phone-reduced-chosen.png)。这是受控合法存档上的软件浏览器证据，不代替自然获取、真人审美/听感或物理设备验收。未操作试玩站或部署。
