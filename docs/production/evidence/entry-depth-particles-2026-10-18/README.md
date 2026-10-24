# 加载与选角景深粒子候选（2026-10-18）

基线main `2e7f5c04753b1b107d5bcec8d64d8611d7665873`；分支 `dev/entry-depth-particles-20261018`；产品 `ea81ecae35b78b6219eda0df96d5413c7bec75b0`。仅表现层，不改音频、资源队列、进度计算、路由、规则/存档或原图。机器检查见[verification.json](verification.json)。PC/手机动态、主观绚丽程度和设备性能均未验，P08继续in_progress。

## 固定来源与移植范围

采用研究负责人给定的 [Magic UI Floating3DParticles](https://github.com/magicuidesign/magicui/blob/efe76fc5755eca1142dd4f74c1d6f0ace2887e3c/apps/www/registry/magicui/floating-3d-particles.tsx)，固定SHA `efe76fc5755eca1142dd4f74c1d6f0ace2887e3c`。研究提供的引入提交为 `7f260302299754c50bc5cb8900f1cd5fb4638bd4`。本子线程已读该固定源码与[同SHA的MIT许可](https://github.com/magicuidesign/magicui/blob/efe76fc5755eca1142dd4f74c1d6f0ace2887e3c/LICENSE.md)；完整通知保留在 `public/licenses/magicui-floating-3d-particles.MIT.txt`。

`EntryDepthParticles.ts`保留spawn尺寸/透明度扰动、`fov/perspectiveDistance/depthRange`公式和polar投影；把原按帧位移改为delta×60/1000，并将径向范围限制为两侧上升带与当前原画外侧。共用普通TS模型，加载用Canvas2D，选角用Phaser原生Image固定池；未装React、第二引擎或新依赖。上游TSX源码字节数不作为本工程bundle或性能成绩。

## 文件与owner边界

- `LoadingEntryParticles.ts/.css`：只处理初始`#resource-loading .load-scene`的装饰Canvas，读现有`data-load-motion/data-load-paused/open`；不读进度、不参与ready gate。`LoadingScreen.ts`仅新增import/成员、构造末尾`mountLoadingEntryParticles(host)`、close开始销毁，共5行差异；`prepareDestination`与所有音频代码不动，音频owner可保留自己的原逻辑，只接这两个生命周期位置。
- `SelectionEntryParticles.ts`：一个场景controller、两个显示层、固定Image池；只使用现有scene update。`CharacterSelectScene.ts`仅创建controller、render末尾重绑、showHero记录按1122:1402适配的实际原画框，共8行接线。scene shutdown由controller自行清理。
- `index.html`、`HomePage.ts`、`SceneView.ts`、`SelectionStageView.ts`未改。新增Canvas在LoadingScreen构造时创建；CSS仅限定初始加载dialog，不进入首页现有静态clone。bundle前的既有加载首屏保持，新增Canvas在bundle执行后的真实加载阶段工作，不人为延长加载。

## 配置预算与保护

配置为手机32、桌面64节点，depth=.25，手机30Hz／桌面60Hz上限；不宣称这是实测帧率。金/青主色与少量六英雄既有身份色；两侧上升、远近尺寸与深度排序、少量亮芯，非满屏随机彩虹。软光来自缓存32×32渐变小笔刷，无全屏blur或新网络纹理。

加载Canvas自身DPR≤2；选角复用现有共享framebuffer和原生节点，**没有修改全局DPR**或新建高分辨率render target。Phaser原图清晰度维持原合同，其全局DPR不能据此声称已限为2。

前层对实际文字、图片/整张原画、交互区域采取整颗避让，无输入对象；原画本身不染色、不裁切。切英雄、路线或resize跟随现有render销毁旧池，再绑定新布局。隐藏/离屏/blur/暂停/reduced motion取消粒子RAF或移除scene update，事件唤醒；reduced仅画静态帧；退出销毁节点、观察器与监听。加载页既有进度RAF不属于本视觉模块，仍由加载/音频owner维护。画布分配失败时跳过装饰，不阻塞资源门。

## 本次验证与交接

`npm exec vitest -- run tests/entry-depth-particles.test.ts tests/entry-particle-lifecycle.test.ts tests/loading-progress.test.ts tests/selection-layout.test.ts tests/hero-opening-copy.test.ts tests/opening-play-sample.test.ts`：**6文件29项PASS**。覆盖固定公式、60/120Hz等速、数量上限、遮挡、DPR、真正停止/事件唤醒、离屏与文档可见性组合、旧池清理、分配失败及既有加载进度/选角布局/例子合同。均为代码回归，不是用户动态证据。

`npm run build`：类型检查与374模块构建PASS，产物`index-D6L32uwp.js`；仅既有大包分块提示。构建时间`2026-10-18T07:27:56.311Z`，元数据为基线dirty，受测src/tests随后原样提交为上方产品SHA。`git diff --check` PASS。

**未在本机启动浏览器。** 唯一下一步由root协调音频owner的最小hook合版，远端dot同版看加载与六人选角：连续过程、不同深度/身份色、文字与原画可读、移动竖屏、切人/路线/resize、低动态、后台/离屏/销毁及实际性能。不能因来源近期、节点池、静态几何或测试存在签成视觉通过；H17既有苏轼PC有限观察也不外推到本包。

统一整合补记：与另一入场模块及harness源身份修复同批合版，无冲突，所有产品blob保持精确来源；必要交集7文件61项及联合type/376模块构建PASS。共享回执见../entry-startup-integration-2026-10-18/README.md；不签真机听感、观感或性能，P08保持in_progress，精确main/CI以最终回执为准。
