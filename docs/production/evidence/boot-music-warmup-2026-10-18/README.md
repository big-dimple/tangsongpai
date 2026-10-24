# 加载页音乐与选角资源准备

产品提交：`cc97cf316eafd8370d66d87cb971619f99629dd7`。基线 main：`2e7f5c04753b1b107d5bcec8d64d8611d7665873`。开发分支：`dev/boot-music-warmup-20261018`。本轮不写共享计划、不直接发布 main，不运行本机浏览器或全套矩阵。

## 根因与资源选择

原启动必须先调用 `unlock()` 才允许任何音乐，加载阶段也没有请求播放；菜单曲只在首页/选角阶段使用。原来的真实音轨预热、单应用 AudioContext 和两个有界媒体槽已经在基线，继续使用，不复制第二套播放器。

沿用菜单《阳关三叠》，加载→首页→选角仍是 `menu`，保持当前播放实例和位置。读取已存音量后，应用入口只尝试一次有声播放，音乐 Promise 不进入资源准备门。浏览器禁止时显示“轻点画面启音”；真实 click（或 Enter/空格）内立即调用 resume/play，等待两者 Promise 并检查 running。NotAllowed 不记成坏音轨，不跳备用曲、不循环重试、不因切页/回前台重复尝试。旧 resume 的迟到拒绝不能暂停新的播放。允许自动播放也保留首次真实点击的音效解锁，不重启背景曲。

首批从 20 项增加到 **26 项**：8 个纸面纹样、6 个头像、6 个选角缩略图、6 张 **615×768** 完整选角立绘。六张新增文件共 757,322 字节，整个首批 4,478,464 像素，RGBA **17.083984375 MiB**，小于原 20 MiB 每批上限。全部走既有共享纹理解码/恢复队列，进度仍按真实解码完成计数，失败不报 100%。六张 1122×1402 原图字节未改。

72 张唐宋牌、道具、眼部及头像裁切等不加入首批；完整小牌目录仍由原后台队列准备，省流量/2G 限制继续生效。本轮不增加第二个开场加载画面或固定等待时长。后续场景缺少实际所需资源时保留原紧凑准备提示。

## 检查与边界

- **PASS**：10 个文件 96 项定向测试，原始结果 [tests.json](tests.json)。覆盖自动播放允许/拒绝、停留/切页无重复播放、真实点击同步 resume/play、悬挂/迟到 Promise、非 running 不能冒称成功、锁屏拒绝后等待下一次手势、静音/零音量/精确音量保留，以及资源解码、进度、滤镜、弹窗和计分音频回归。
- **PASS**：TypeScript `--noEmit`；Vite 生产构建，372 modules。保留既有大 chunk 警告。构建元信息 [build-info.json](build-info.json) 如实保留构建时基线 SHA + dirty，完整参与检查的 LF 归一化源文件 SHA256 见 [report.json](report.json)，与产品提交内容一致。
- **PASS**：`git diff --check`。
- **NOT_RUN**：本机浏览器、远端实际媒体观察、Safari/iOS/Android 真机、锁屏操作、听感和视觉批准。本轮没有截屏、录像或真人听感结果。单测媒体/Context 模型不能替代这些验收。

定向命令：`vitest run tests/audio-music-lifecycle.test.ts tests/opening-audio.test.ts tests/scene-resources.test.ts tests/loading-progress.test.ts tests/audio-sample-loading.test.ts tests/audio-preferences.test.ts tests/music-filter.test.ts tests/music-modal-stack.test.ts tests/resource-recovery.test.ts tests/score-melody-audio.test.ts`。类型/构建命令：`tsc --noEmit`、`vite build --outDir shots/boot-music-warmup-build`。

## 粒子视觉线程接入边界

本轮新增 `src/audio/OpeningAudio.ts/.css`；修改 `AudioEngine` 的启动/手势/生命周期、`SceneResources.openingResources()`，以及 `main.ts` 中安装/销毁启动绑定的几行。`BootScene` 只有说明注释调整。**未改** `index.html`、`LoadingScreen.ts/.css`、`LoadingProgress`、`StageImageWarmup`、`ImageWarmupQueue`、`CharacterSelectScene`、`SelectionStageView`、`GameScene`、`ShopScene`、共用鉴赏模块。

加载粒子可放 `#resource-loading .load-scene` / `.load-world` 的独立 Canvas2D 层；随 loading DOM 移除停止自己的 RAF/监听，不持有加载门。低动态和暂停可读取既有 `data-load-motion="reduce"`、`data-load-paused`，音乐偏好与低动态独立。选角粒子由视觉线程在自己的选角展示生命周期挂载并清理，不调用 setScene/unlock，不覆盖音频或队列函数。

“轻点画面启音”在加载页 `.load-copy` 内，转首页后位于 `.home-entry` 内；如锁屏后其它场景还需手势，则用独立顶部轻提示，普通画面点击也能解锁。请保留该按钮和应用级手势绑定，不再新增另一套播放器/强制入场按钮。

## 远端实际验收交接

1. 核对最终集成版本与本包源文件指纹；允许自动播放和禁止自动播放两个真实策略分别打开。首次访问无法保证有声，不把静音画面当播放成功。
2. 允许时观察加载→首页→选角的 menu 媒体实例、currentTime、play/src/seek 调用，确认不断点不重播，最多一条有声菜单轨；预备的 shop 元素应保持暂停。
3. 拒绝时停留、切页、回前台不应不断 play；轻点画面即可尝试，无额外强制按钮。资源就绪可照常入场，网络/自动播放不应混为故障。
4. 音乐 0/静音偏好刷新保持。普通音量例如音乐 7%/音效 81% 在后台与恢复后保持原值；检查首次点击的 UI/音效路由正常。
5. 真机锁屏/切后台恢复被拒绝或 interrupted 时，下一次真实点击恢复；记录 context.state 和 play/resume Promise，不能仅看 UI 文案。

官方依据：[Chrome autoplay](https://developer.chrome.com/blog/autoplay)、[WebKit 自动播放策略](https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/)、[HTMLMediaElement.play Promise](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play)、[iOS Safari interrupted 状态](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state#resuming_interrupted_play_states_in_ios_safari)。

统一整合补记：与另一入场模块及harness源身份修复同批合版，无冲突，所有产品blob保持精确来源；必要交集7文件61项及联合type/376模块构建PASS。共享回执见../entry-startup-integration-2026-10-18/README.md；不签真机听感、观感或性能，P08保持in_progress，精确main/CI以最终回执为准。
