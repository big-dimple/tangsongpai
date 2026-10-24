# 六英雄音画阶段开发整合

仅开发分支 dev/hero-av-stage-integration-20261018。基线 main bab78be5be4bc6d8cdb9780ac8a4eebb69f697da；产品合并 364689937e7ce25ef81628c85e2518a8fd1c4e81，父提交 8fef9193 和 75d4f9734e9cd606820f7c2a64effb60a4c1862f。阶段计划3db92554为祖先，32eef8d5有限PC观察保留。最终文档提交与远端分支SHA以交付回执为准，main未合、未推。

## 来源与职责

计分原会话01a147ec的完整候选75d4f973已包含音频f08b1f03与视觉25872095（含d570）的等价提交：音频caaf3b69/482fe48b，视觉20861f58/dfb57f42/38b24c0d/cd26f98b/9a2ada20。仅正常合入完整候选一次，没有再次cherry-pick依赖。27份运行源码/测试逐blob精确等于75d4f973；三份公共文档冲突保留双方历史/来源与现行阶段，不改GameScene实现。

音频01a148ba与计分01a147ec已于10:54/11:00启动并直接协调eventId/sourceId/runId/generation/phase。GameScene唯一实现owner是计分；Windows只做精确合版、必要文档冲突与联合检查。英雄01a149b8交完整辛样板、统一其余五人池满停发修复与六人真实目标/onPhase接口。当前阶段职责已同步总计划、plan.json与角色计划，不再写等待父另派。

采用的完整动作样板是刘娥实际spades-8到M，真实+M从2到10、最终430，牌与附着同对象蓄势/撞击/回弹归位；六人阶段观察与同一音频消费入口已接。其余五人的完整牌动作尚未完成，六人池修复和阶段接线不能签六人美术/完整体验。

## 验证

来源范围分别复用：音频9文件159项、视觉17文件140项、计分最终联合27文件261项及各自类型/构建。都只按原版本范围保留，不相加成新验收。

本轮6文件82项全部通过：source-stage-art14、score-card-performance13、score-performance17、hero-native-pool-lifecycle29、hero-action-chain-order8、xin-repeat-sequence1。覆盖96KiB源图合同、真实来源/目标和音频准入、六人3秒原生池持续与取消、辛连续普通弃牌/新牌差集。既有音频测试随批准后的现行合同采用，不声称历史原断言不变通过。

npm run build实际完成类型检查与383模块生产构建；index-yuaXCblw.js 3005.10kB/gzip880.94kB，既有大chunk警告保留。构建信息原样记录364689937e7ce25ef81628c85e2518a8fd1c4e81、sourceStatus=clean、2026-10-18T11:37:17.715Z。后续仅文档/证据提交，不把该构建改签为后续SHA。机器来源表、[验证记录](verification.json)、[测试原始JSON](tests.json.gz)、[构建日志](build.txt.gz)与[原始构建信息](build-info.json)一并保留。

src/domain、public、harness、scripts、package.json/package-lock.json及.github相对基线完全无改动；六张原图、指定音频素材、高光资源及96KiB合同保持。没有本地browser、自然长局、全套/新增矩阵、CI查询/等待、生产部署或域名改动。结构检查仍32工作包、current=P08，不代表玩法验收。

## 非生产预览阻塞

目标动作：向现有Cloudflare Pages项目tangsongpai发布独立开发分支预览。仓库无Pages/wrangler发布配置或依赖；Windows无wrangler命令；常用Cloudflare凭据环境变量和已知Wrangler默认登录文件均未发现。没有读取秘密值或扫描无关凭据。无法在既有认证下核对项目生产分支/预览配置并部署，因此动作NOT_ATTEMPTED，既非被拒绝也非结果不明。

此前d570分支标准别名build-info请求404、GitHub该分支deployment/status/check均无可用入口，仅说明没有已确认的可访问预览，不能断言账户内绝无环境。[官方预览说明](https://developers.cloudflare.com/pages/configuration/preview-deployments/)描述独立预览与分支别名；本机现缺已有认证的项目访问/发布途径。未新建令牌、登录、改权限/安全设置/自动部署脚本，未切新加坡服务分支，也未用生产发版获取预览。当前真实预览URL和服务端构建SHA均null；上方为本地正式构建SHA。

P08/H17继续in_progress。父与既有dot仍需实际PC/目标手机连续画面、声音和操作审样；共同池同版远端持续/目标/清理与设备实核、其余五人完整动作、听感/长链后段节奏仍开放。C04/A03/V01/L01与原发布预算不自动关闭。
