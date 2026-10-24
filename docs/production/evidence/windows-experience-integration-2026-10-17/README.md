# Windows 音频、整手节奏与当前文档联合候选

仅开发分支 `dev/windows-experience-integration-20261017`，基线 main `9fe60fc581227829df6caadc712a5bd0fed74bc4`。被测产品提交 `1337da6f13d83db4aa154a200721581c83c976e6`；音频来源 e6bec936、整手来源 cdfd345f（产品113fbe92）、当前文档756b3eca已合。冲突只在两份计划，保留双方候选及 H07/H10/H17/H18/H19、15条历史待核验事实。12份运行时模块逐份精确等于对应来源；领域/应用规则/存档与公共资源无增量。见 [准确版本与范围](verification.json)。

实际复查6文件42项，再补 source-stage-art、录音/旋律/混音当前合同4文件70项，共112项通过。类型与生产构建通过，362模块、397文件/37,182,549B，预算仍FAIL。使用当前已批准音频合同，不声称早期原音频断言保持不变。来源132项/3浏览器、35项/7案例分别按自身版本复用，不和本轮相加。生产构建记录为clean1337；联合浏览器构建为同运行时1337，仅SSR驱动设置为tracked dirty，另有新观察驱动未跟踪，原始状态保留，不改签成最终文档提交的重跑。

|同版实际案例|结果|
|---|---|
|PC完整手|853帧、约13.63s；13有效来源真实双声，2次多彩飞行在flight/impact/return均有材质；H/M真实目标与保存after匹配，规则oracle一致。47次score调用时音乐20kHz，SFX/UI直达master；最多3计分声部/2媒体slot。|
|390关键回弹取消|796帧；原生菜单中在accent/rebound实际点击快进。46次score调用，其中45次在音乐低通<500Hz，SFX/UI始终绕过音乐滤波；取消后声部/撞击/旧字纹理全0，无迟响，完整保存结果仍精确一致。|

直接查看 [PC实际音画](pc/av-continuous.webm)、[390取消实际音画](cancel-rebound/av-continuous.webm)、[PC乘法命中](pc/multiply-hit.png)、[取消后](cancel-rebound/clean.png)。录音来自实际Canvas与同一AudioEngine master，无另配音轨；逐帧和路由/调用见 [联合原报告](joint-report.json) 与 [原来源驱动完整报告](source-driver-report.json.gz)。这是公开导入受控旧s04身份的正式应用原生流程，旧“余音袅袅”正确；不签新苏轼新局、自然获取或长局。未试听、不签主观重量/整体视觉/实体设备/P08完成。

首轮因该worktree无依赖，vitest/tsc未启动；随后仅联接主工作区已装依赖。SSR夹具启动首轮未进入案例，安全停止后沿已有Windows驱动禁用发现/HMR/watch，未改产品或源断言。三份未执行记录与实际成功日志均保留。两案浏览器在用户停止本机试玩指示前已结束并关闭自建上下文；后续不在本机新增/继续试玩，正式最终同版试玩由root协调远端dot一次，标PENDING_REMOTE_DOT。

## 公开版本修复的独立复核

用户Sentinel_63490afdfdcc819186893c293800c7f6确认：新加坡服务器本地测试时切换了分支，现已修复。这是用户确认的部署原因，与本任务独立HTTP事实分开。修复后仅一次读pai.hp666.cc（23:51 UTC）：实际JS已为index-Cwfn86Em.js，SHA256 `6401c3f9a4cf736264fc9033be0b50d3993484707a410263214fddc8aaf88e00`，内嵌C03/main9fe，构建时间2026-10-17T23:47:08.784Z，dirty仅声明package-lock.json；含贬谪/新音频，无旧商店短句。9份指定音频全部200正确媒体类型，完整字节数和SHA256吻合当前main。build-info端点此次超时，不重试、不假称其通过；版本依据为实际入口JS内嵌记录。见 [单次原始复核](post-repair-readonly.json)。没有播放、部署、CDN修改或新增根因排查，23:17–23:29旧包证据保留为当时历史。

截图按已发布main逐项对照：新局苏轼贬谪已采用（CharacterRunCopy40；旧存档按自身身份）；“待出牌/已出牌”孤字已有动态位置修复（GameScene1092/2218、stage-table-art既有8项与来源390图）；旧顶栏大培养已降持牌旁次级入口（610来源，ShopScene317/554）。这不豁免当前手机空位/整行商品购买H18、菜单与干净用户状态H19、六英雄理想强度H17。商店purpose cebf仍待手机完整大图行/共享滚动追加，不签旧候选视觉通过；dd740文案及各owner最终SHA后续顺序接入。
