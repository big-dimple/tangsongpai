# 非首屏资源门 S0

基线 51b0bdd73e02b1f3b385488943cfbc9e6a035ca1；产品 e61304d98fcc81ef96ab10df3e4b39169734ff01。用户14:14确认手机选英雄后停在“准备本店现货”。本批只恢复商店、牌桌及其他非首屏导航立即进入；现货图沿 StageImageWarmup 与场景既有回退后台补载。

根因：非 Boot 的 prepareDestination 会对任意缺图新建 LoadingScreen，并 await ResourceRecovery.run()；失败资源即使永久失败仍每30/60秒恢复，导航没有完成出口。现在只有 Boot 传入的现有加载窗保留首屏必要图片门；后续调用立即返回 true，同时取消旧 preparation owner。不新增等待 UI，不改 AudioEngine、GameScene、ShopScene、领域、存档、资源或第二波特效。

新7项在精确51b0基线为3过4失败（创建新加载窗／同key旧owner等待），修复后交叉 10 文件 54 项全过。原 Boot 实际解码门、失败诚实进度、取消／销毁与晚回包保护保留；TypeScript及384模块正式构建通过。原始红绿结果、构建日志压缩保留，源码SHA256和构建dirty指纹见 verification.json、build-info.json。

音频原owner在精确51b0复核3文件66项（738ms）通过，产品零改动；本整合仅按来源复用，不当作本机重跑、浏览器复现或真人听感。BGM不在导航等待链；具体用户失败资源URL及BGM因果未证实。

本地浏览器禁用，真实手机“选英雄→商店→牌桌”恢复由父dot在新main同版核。选角“选路线”无响应另待核：未选人物时苏轼可仅为预览，本批没有推测性改选角。旧CI域4失败与菜单hover/pin旧定位器已定位但本S0不顺带改；详见 verification.json。第二波新功能发布暂停，P08/H17/M1与像素／听感／真机验收未关闭。
