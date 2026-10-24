# 音乐与菜单先行开发整合

开发分支dev/music-boss-integration-20261018，计划0f86ec9e与15cdc053为祖先。完整音频1d1f61b82225222bdef3fc5ad85fd5fe4a6e3210（产品b693dc1383cd9091a181b8bccf7f24071722d982）正常合为cea52f1323aee03eeb8b16a47346d1dd676449c5，再合菜单22dfd9f4ec6d10eb781b7c1017801a5f7c36676c（产品1a8559b80fd25e3248978f170eb5f966859f0089），得到本地产品/构建edb056561aed13f0a51cb4f8ae3f00a36000152b。最终文档HEAD以交付回执和远端为准。

音乐合并无冲突；菜单只在plan.json产生一处文档冲突，保最新菜单合同和原hoverPinEntry来源证据。活动源码/资源分别精确匹配对应来源，未重写GameScene：音乐必要路由只有GameScene5行、Intermission3行、Shop6行，保75d4表现契约。菜单仅RunMenu/RunMenuInteraction/style及测试，main.ts未改。后续Shop合版须保音乐中的shop路由/下一战预热和结算继承。

音频源范围14文件191项、菜单3文件30项/type/build分别按各自版本复用，不相加为联合验收。本轮5文件37项：bgm-scene3、menu-new-run-confirmation5、music-modal-stack2、score-card-performance13、source-stage-art14，全部PASS。类型/生产构建384模块PASS，index-DGT0G5Nj.js 3012.11kB/gzip882.82kB，既有大chunk警告保留。构建信息原样为edb056561aed13f0a51cb4f8ae3f00a36000152b、clean、2026-10-18T13:25:38.583Z，不改签后续文档HEAD。见[机器验证](verification.json)、[交叉原始JSON](tests.json.gz)、[构建日志](build.txt.gz)与[构建信息](build-info.json)。

四首用户原件SHA当前仍与来源一致；30个SFX与15cdc Git blob一致，PerformanceAudio/foley/mixPolicy保护合同保持，领域/英雄原生模块未改。board-race实际来源ab72bf69cae445df466c9cd204dba9fda96ce5dc，Vorbis优先与能力不支持时MP3来自其源码，本包另外补同曲真实加载/解码失败单次回退，未把后者说成参考项目已有。完整时长53.832/46.536/69.264/67.416秒、自然ended后可取消3秒间隔、两槽预热及全场景继承采用源证据，未重跑完整转换/解码或听完整曲。原始细节见[音频源证据](../user-four-bgm-2026-10-18/README.md)。菜单220ms/pin/触屏文字入口采用[原30项来源](../menu-hover-pin-2026-10-18/README.md)，实际双端仍未验。

按用户13:22停止旧曲曾用/残留分类，不再制作追溯清单，不扩大全仓资产审计。本轮仅[正常dist检查](dist-check.json)：402文件，无原稿目录/测试床/harness/脚本误带；四曲8个格式文件精确匹配动态manifest，合10261793字节，MP3为实际兼容回退用途。无额外删除，保用户原件/SFX/证据及Git历史；未据此宣称所有其他素材引用或总发布预算已验。

用户13:18已明确允许最终成批合main提交，当前先完成音乐+菜单并等原商店最终候选（含13:12道具箱/花钱换货、PC文字对齐、确认扣钱），本次仍仅推dev、main未改。接齐来源与合理工程/可做动态检查后可按该授权正常main；没有预览不阻塞独立代码，也不能签成已验。

原英雄01a149b8与计分01a147ec已重启六英雄后继，继续剩余五人完整动作及更夸张的立绘环绕/真实作用牌表现，排在当前音乐/菜单/Shop批后。顺子DIY方向由原规则01a147f6数学分析后交Shop方案，尚未实现。真实像素、听感、PC/目标手机与预览均未验；预览等新加坡返回，不再查本机凭据。不本地browser/自然长局/全矩阵/CI查询等待/部署域名操作，P08/H17和英雄M1保持未验状态。
