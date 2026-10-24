# v3新增测试契约同步

来源为main791e32b6的CI39100615381新增16项失败与browser身份断言，仅修这些遗漏；原41项旧展示/布局/快照未修改。

代码提交：`4c09e29e73f7325c9e9163a1e6b6b8d555acc976`，完整tree：`27bca641c9dc5bd0343be8badb60f368a4c085b9`。实际检查执行于base `791e32b6e7198f47b7e091cdb236c6846384e25d` 加本笔9文件工作树，执行后该内容原样提交；不是声称在干净的791e32b6上测过新断言。

## 修改边界

- 11项新开局/新候选/起手测试分别期待苏轼v3、花蕊v3，其余四人仍S04；旧局恢复、接管、导入及同局重试的原身份断言保留。
- 3项支付夹具：core-build用20金本金付合法10金，实际扣后10金仍停用20金持币门槛；同时检查cost/goldBefore/goldAfter/multiplier。结算夹具只在current分支改10金，legacy默认及独立30金分支原样；当前高分结算固定期望343837406，并断言实际10金、余70金和×3，没有从被测结果生成期望。
- 1项苏轼新局展示预期×3；1项全身份遍历为花蕊专属v2/v3选择花蕊角色，其他旧身份分派规则保留。
- browser只将明确点击苏轼并新开局之后的旧S04版本断言改为苏轼v3，保留原断言与其余操作；未启动浏览器。

## 实际验证

7文件146项PASS，详见[原始输出](affected-tests.txt.gz)。命令：

`npm test -- tests/c04-mode-save.test.ts tests/recovery-save.test.ts tests/core-build.test.ts tests/route-starter.test.ts tests/settlement-presentation.test.ts tests/opening-signature.test.ts tests/tangsong-player-terms.test.ts`

`npm run typecheck` PASS，见[原始输出](typecheck.txt.gz)。`node --check harness/screenshot.mjs` 与 `git diff --check` PASS。没有重跑全套、原41项或本机browser，没有修改生产源码、冻结内容、依赖、门禁或部署脚本；原v1/v2领域用例文件未改。

本笔只完成已知新增测试遗漏，不签整体CI、动态体验或自然平衡通过；P08仍in_progress。main最终SHA见交付回执/远端；父线程后续核实对应CI，本会话不查询或重跑CI。
