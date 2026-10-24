# Smoke现行入场确认补步（2026-10-18）

基线main `485ba12debfed86433466af2213688df4384c8c9`。原[CI39108817666](https://github.com/big-dimple/tangsongpai/actions/runs/39108817666)的domain/docs均success，browser构建376模块PASS；失败为[screenshot第89行等手牌超时](https://github.com/big-dimple/tangsongpai/actions/runs/39108817666/job/117620340946)。该次已越过新局身份断言和首店购买，原日志未带卡住时状态快照，不声称其后流程已验。

现行GameScene.awaitStageEntry明确在stage-ready等待章节目录；BlindSelectPresentation按真实入口显示进入暖场/正场或迎战强敌，点击后才由产品提交EnterStage并发牌。此门已有ffab813及[开战前流程](../prebattle-flow-2026-10-17/README.md)，本轮smoke仍在LeaveShop后直接等cardViews，是明确漏步，不是应被删掉的产品确认。

仅本脚本4处同类离店路径接入新辅助：等待真实目录或已入场状态，有目录时按鼠标/触控点其原生主按钮；随后仍要求await-input且存在真实牌面。已入场不额外点、未发牌仍失败，新增phase/目录/牌数诊断；没有私有函数调用、状态改写或调高默认超时。后续ready/翻牌/计分断言保留。

两份mjs语法PASS，4个[Node契约模型](entry-contract.json)PASS（含真实缺牌仍失败），现有目录单文件[12项](directory-tests.json.gz)PASS。首次单测在断言前因本工作区依赖映射缺失未启动；恢复到主目录现存锁定依赖后直接执行本地Vitest，不把该次当功能失败或通过。规则/产品源码、全部旧版本专测、部署同步脚本及门禁均未改；无全套、构建或本地浏览器。完整[交叉回执](verification.json)。

新browser全链仍待CI/远端，不把模型或本次修复签成视觉/手机/听感通过。f46ef5be次数规则候选及effect-contract已审阅，当前XinRefillLock首次布尔过滤仍阻第二次；等待英雄特效配套再合，不混入本修复。P08保持in_progress。
