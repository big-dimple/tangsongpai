# 既有CI展示契约有界闭环（2026-10-18）

基线main `2e7f5c04753b1b107d5bcec8d64d8611d7665873`，原CI [39106012361](https://github.com/big-dimple/tangsongpai/actions/runs/39106012361)。仅读取两个已失败job日志，41项与此前集合逐名相同；分类见[CI输入](ci-input-summary.json)，当前验证见[verification.json](verification.json)。本批仅8份现有测试和证据/计划，运行源码、规则、存档、素材、依赖、harness/scripts和门禁均未改。

|原失败|依据与处理|
|---|---|
|26项展示断言|商店c58ae033已撤可见星级而保留内部评估，改为选购依据；98bc4635正名及白话/留牌说明已采用。只同步标题、当前牌名、效果/条件字段；星级数值、现金风险、封禁、真实保存、还原对象和状态不变断言保留。|
|14项旧展示投影|精确ca1fba93源码复现14个原哈希；与2e7逐字段比较，仅短效果/时机拆分、旧词正名、已存状态白话及主区去冗余。六张冻结规则定义字节完全相同。原历史fixture保留；当前完整展示另列严格哈希，额外校验原contentHash和冻结定义哈希。|
|1项布局哈希|精确212e23d5复现原哈希，完整记录266叶子差异；仅390/320竖屏变化，两个844横屏完全相同。差异对应bdafa604已批准的独立区域/缩短空预览/英雄技能入口；该布局文件此后未改。当前完整几何与横屏严格锁定，不代签像素、审美或物理设备。|

批准来源：[商店撤星](../shop-experience-2026-10-17/README.md)、[白话拆分](../player-copy-closeout-2026-10-17/README.md)、[留牌白话](../hero-review-menu-2026-10-18/README.md)、[手机空间](../mobile-table-space-2026-10-17/README.md)。[当前严格基线](approved-presentation-contracts.json)、[旧展示字段差异](legacy-display-audit.json.gz)、[旧/现完整投影及冻结定义](legacy-display-before-current.json.gz)、[布局前后坐标](layout-before-current.json.gz)保留完整审计链；没有直接覆盖旧证据。

第一批7文件67 PASS，14个尚未审计旧哈希仅由本地命令暂过滤；审计后第二批2文件35 PASS、无跳过。按每文件最后一次完整结果合并，8文件94个独立用例全部PASS，8个当前C2案例复查；实际102次执行不能写成102个独立通过。见[第一批](display-tests-first.json.gz)、[审计后批次](audited-baselines-tests.json.gz)、[类型PASS](typecheck.txt.gz)。未重跑全套/构建或本地浏览器，CI门禁与测试注册无skip/删除。

browser精确阻塞是harness/screenshot.mjs:81：前面版本断言已为Su v3，仍用S04哈希json-fnv-v1:65b545bd97c0fdf1比较实际正确的json-fnv-v1:cf857ebc71020ca8。失败发生在首店后续购买/技能流程之前，不是身份回退、启动或构建故障。本轮明确不改脚本，未修改；待脚本owner同步这一断言，后续browser场景尚未验。本批不声称CI全绿；H17/H18手机动态、听感、审美及P08继续待验。

## 澄清后的harness定向修复

“不改脚本”仅指部署/同步与门禁配置。当前新局smoke的版本和hash现统一读取src/game/RunLaunch.ts的newRunIdentity(amo,group)，通过已有Vite纯内存打包，不抄第二份常量、不增加依赖或持有server。两份mjs语法与3个定向契约PASS：实际Su v3常量、真实规则注册表、旧助攻夹具仍S04；见[合同](smoke-new-run-contract.json)和[日志](smoke-new-run-contract.txt.gz)。最初Windows SSR装载超时已记录，最终实现不使用该路径；未启动浏览器，后续端到端仍待CI/远端。

14项基线对应98bc4635正名与6a67b0e7玩家白话：唐宋牌→唐宋牌、补effectLine/timingLine、已存值/买入初值白话、删除主区重复时机；旧c06高阶两型不成长等资格仍保留在完整规则。不是只换hash：原历史fixture保留，当前全文哈希另列，新增原contentHash与冻结定义哈希保护，14原哈希先全数重建。布局对应bdafa604手机独立区域、缩短空预览及技能头像入口；当前layout blob与该来源相同，两种竖屏266叶子差异、两个横屏零差异，另加横屏严格哈希。此项明确只作工程结构基线，本轮无新增动态证据；审美、真机和实际遮挡问题仍待验，不因锁定结构而隐藏。
