# PR215 iPad分支独立审查

结论：未发现生产阻断，可进入本批后续统一集成；当前按父协调不合main、不创建PR、不改生产/共享文件。精确head14b75a42748f258d20863a82bd3b0cafeb9d1daa；基线main9abedd0195881c64c730f13e26b66c54f94b3716。PR215由原线程成功创建，无需本路重试。

CI39602787270、计划39602787286均completed/success。独立运行现有layout/shop-layout/shop-boss-layout3文件100项PASS；原提交typecheck/build及其日志已审，未为状态重复构建。证据index的6份生产/测试/harness源码hash逐项匹配14b75a42。

生产diff仅ShopLayout.ts、ShopScene.ts、layout.ts。前者按首货架边界收窄中间布局左按钮并留12px；文字按实际品质/用途/交易行高度堆叠，连同命中框延展；后者仅未显式请求模式且可用700–899、长宽比>=1.15时复用既有portrait table。规则/存档/素材/Astra选角模块无改。

geometry.json为只读基线/分支构建比较：390×844、390×740、844×390、1280×720、1366×768、1080×810、1080×714的table+shop几何strictEqual；810×1080/984手牌546→786，768×1024为504→744；显式desktop请求原样。受影响iPad竖屏selectionLayout完整输出strictEqual（hud.top仍8），SceneView按钮不读mode、选角仍用独立layout，无选角视觉分支变化。不是新设备/性能矩阵。

input.json为单一810×1080/DPR2 Chromium原生自然短流程，保一局6金/seq1：章节目右缘(192.3333,134)打开本章节目单；道具箱右缘(192.3333,186)打开道具箱；消耗工具货架→复演购买详情→取消；自选做牌dialog打开、旋转1080×810仍在、返回商店按钮可达并实际关闭。每步state/journal/storage tuple hash均6a3a753cbbebdf9593aab7b76b4cdffb349ca5df0a289af0b7887869a128bc1e，pageerror0，无购买/状态注入。补的只是作者未直接覆盖的工坊/工具/右缘路径，不重复整条四视口回归。

原报告已独核：810首店旧200px章节目与首货品重叠3.667px，旧tap(210,130)误入商品有原日志/FAIL；修后该旧坐标已不属章节目，不能继续要求旧坐标开章节目。作者自然实购4金、6→2/seq1→2，入场后seq4，810/1080及合成96px工具栏预算旋转保持选中、持有、金币/seq。原768兼容、启动超时/临时探针误坐标FAIL、一次音频ERR_ABORTED都保留，不冒称全网请求/听感通过。

需父协调的共享测试辅助器（非生产阻断）：harness/ui.mjs:22以shop.view.layout.mode==='portrait'推断手机商店；新iPad的table view是portrait而shop.geometry().portrait=false，helper会错走手机库存代理。建议统一集成owner将该单处判断改为实际shop geometry.portrait；本路未抢写，其他路若调用shop/action/chapter或items须注意。生产ShopScene工坊/货架走独立geometry条件，本次真实输入已验证可达，不是玩家路径故障。

仍未验：物理iPad8、Safari/WebKit、用户实际工具栏innerHeight/缩放、安全区、所称完整横屏错乱、物理弱GPU/听感。810×984等96px扣高仅合成情景。不得据此签全响应式或全部iPad问题已解决。

本目录含geometry.mjs/json、input.mjs/json及必要复核截图，供本路后续合批时纳入唯一集成索引；当前不为阶段审查另开文档PR。Chromium/Vite5810在finally退出，工作区干净。
