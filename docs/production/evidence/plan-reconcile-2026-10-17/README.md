# 当前计划与证据索引补正

这是文档整理，不是新的游戏测试或整体签收。P08仍in_progress，三大体验目标仍未达标。

- [15条待核验原始证据](legacy-evidence-index.json)保存原路径、字节SHA256、原taskId/testedCommit及缺口；原文件不改，不把base/product或当前main猜作执行提交。它们从合格evidence列表移到强制reads及unverifiedEvidence，继续明确待核验。
- [新加坡](singapore-evidence.json)、[手机](mobile-evidence.json)、[苏轼](sushi-evidence.json)仅适配已有明确执行版本：根testedCommit分别来自原生产构建cd85ac5b、44df03f4、7c2c09df；各单测/浏览器批次仍保留其实际HEAD和脏工作区/源码指纹说明。不是在main9fe60fc5重跑，也不把来源508项扩写成最新全部验收。
- main9fe60fc5的发布状态单独同步；冻结产品7c2c09df、20文件240项、390原生及构建记录不改。预算/15条历史真实性缺口/初次全量失败及内容预检未完成仍开放。
- 文档校验通过只证明结构与可追溯引用。没有改校验器、删反例、放宽领域/视觉或人验门；本分支只普通推开发分支，不直接main，不查CI/域名、不部署。

本批实际仅运行[文档校验](validation.txt)：`check-production-plan --self-test`（1有效＋13非法反例）及当前计划均通过；另静态核对JSON兼容heroes逐字段不变、15原始Git blob不变、三个适配testedCommit来自原构建字段、游戏源码/测试/harness/工作流/校验器无改动。结构错误消除不代表15条待核验的执行真实性已补齐。

按用户紧急要求另做一次[公开版本只读观察](live-version-readonly.json)：首页/版本JSON/实际JS一致指向旧dirty da671包，而非main9fe。这里只留HTTP元数据、哈希、标识与短上下文；完整下载留ignored shots，不将旧产品bundle复制进仓库/发布包。用户已撤销点击故障含义，目的性商店共享区归H18，版次白话出口并回原H10，不开重复术语事项。没有改部署。

## 两个公开入口与音频只读核对（23:29 UTC）

`pai.hp666.cc` 与 `tangsongpai.pages.dev` 的首页、build-info、实际入口 JS 和 BGM manifest 全部逐字节相同。两边实际入口均为 `index-BGS8xiMH.js`（SHA256 `101ff387b720a2554dbaacd5ecaab013fe33c7366c18f668ba0aef40f0511285`），内嵌 `da671af2` 和旧商店短句，没有 `amo.exile` 或 `gamefeel-rfc` 引用。build-info 的时间为 `2026-10-17T13:25:49.996Z`，dirty 文件为 package-lock.json。这是实际旧包证据，不能仅归因于自定义域名。

当前 main9fe 的新 BGM 只用于 table/boss；menu 阳关、shop 舒伯特和 success 醉渔保留，因此单独听到旧商店音乐不能判断新音频未采用。但公开旧 JS 内嵌的仍是旧 boss/table 清单；`pai.hp666.cc` 的新音频 2 MP3 + 7 OGG 轻量请求均返回首页 HTML，旧 boss MP3 完整响应则为 audio/mpeg，完整 SHA256 与旧清单吻合。表格音频仅比较返回前缀，不声称完整哈希通过。未播放音频，未替换资源。

两入口的 Cache-Control 均为 `public, max-age=0, must-revalidate`；这些响应未带 CF-Cache-Status/Age，不能据缺失头断言缓存命中、失效或根因。未追加变体查询、清缓存、改配置、重建或部署。仓库静态检查只找到检查/构建/诊断 workflows，没有实际部署脚本或部署步骤；ENGINEERING 只记录用户从 main 自动部署。真实生产部署记录、所用分支/提交、构建日志、外部作业日志与域名项目映射尚不可得，无法判断自动部署是否运行及原因，不能推断 CI 阻断部署。完整紧凑响应、音频路径/哈希与静态检查边界见 [只读证据](live-version-readonly.json)。


后续修复：用户确认新加坡服务器本地测试切换分支已纠正；23:51单次独立HTTP核实实际JS已C03/main9fe、9份指定音频全哈希吻合，build-info请求超时保留。上述旧包观察仍按23:17–23:29时点保留。见[新记录及用户确认/独立事实边界](../windows-experience-integration-2026-10-17/README.md)。
