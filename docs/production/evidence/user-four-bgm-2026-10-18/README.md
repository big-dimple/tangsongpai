# 四首完整用户音乐替换

产品提交 **`b693dc1383cd9091a181b8bccf7f24071722d982`**；依赖集成 **`15cdc0532a2ef5656798bb2429a7a3b2810d8c1d`**；开发分支 `dev/user-four-bgm-20261018`。本批不合 main、不发布主站、不操作 CI/域名，不改共享计划。父会话负责远端浏览器验收。

## 实际来源与采用点

已实际读取 `big-dimple/board-race` 远端 main，并固定为 **`ab72bf69cae445df466c9cd204dba9fda96ce5dc`**：

- [src/audio/audio.ts](https://github.com/big-dimple/board-race/blob/ab72bf69cae445df466c9cd204dba9fda96ce5dc/src/audio/audio.ts#L1649)：原生媒体接既有 Web Audio 音乐总线；`canPlayType('audio/ogg; codecs="vorbis"')` 选 Ogg Vorbis，否则 MP3。
- [src/assets/audio/LICENSES.md](https://github.com/big-dimple/board-race/blob/ab72bf69cae445df466c9cd204dba9fda96ce5dc/src/assets/audio/LICENSES.md)：保留127.3秒完整编曲、固定衰减留混音余量；没有短截歌曲。
- 实际 ffprobe 两个交付文件：Vorbis 48kHz/双声道/标称160kbps，2,367,317字节、127.344秒；MP3 48kHz/双声道/192kbps，3,057,453字节、127.368秒。
- 仓库的 `scripts` 只有发布检查脚本，没有保留音频转换命令或音频资产manifest；音轨来源由上述两条URL import声明。也读取了 package.json、Web App manifest、音频harness。具体文件指纹和采用/修改边界见 [board-race-source-audit.json](board-race-source-audit.json)。

**没有把源码中不存在的行为说成已复用**：参考项目只在能力探测不支持时选MP3，媒体error处理是标记失败。本批补足“探测称支持但真实加载/解码失败”的同曲单次MP3回退，不照搬第二播放器、车辆合成器或自动重试循环。

## 四首原件与完整交付

输入仅来自 `D:\ai\tangsongpai\music`，四首原件均为48kHz双声道320kbps MP3，完整解码成功，源响度分别−7.87/−7.49/−7.03/−8.66 LUFS。原件前后SHA256完全一致。

|曲名|实际场景|完整解码秒数|Vorbis字节|MP3回退字节|固定增益dB|
|---|---|---:|---:|---:|---:|
|tianhu-begin|加载、首页、选角、章节目录|53.832|1,080,836|1,293,165|−8.13|
|moon-shop|普通商店及Boss前商店|46.536|841,256|1,118,061|−8.51|
|go-cake|真正普通战斗；该战结算延续|69.264|1,402,264|1,663,533|−8.97|
|vsboss|真正Boss战；该战结算延续|67.416|1,243,497|1,619,181|−7.34|

首选共 **4,567,853字节（4.36MiB）**，备用共5,693,940字节。不会主动并发请求两套或四首；支持并成功播放Vorbis时不请求MP3，MP3是能力/真实格式失败回退。八份文件均48kHz双声道，采用Vorbis标称160kbps、MP3 192kbps。参考交付约−15.9 LUFS，本批按原曲测量分别计算固定增益至约−16 LUFS，保留动态范围；交付实测Vorbis −15.98至−16.05 LUFS、MP3 −16.26至−16.27 LUFS，true peak最高−7.29dBTP，不额外改变总线或用户音量。

源MP3容器估时与实际完整解码时长略有不同。完整性按源解码帧核实：四首分别2,583,936 / 2,233,728 / 3,324,672 / 3,235,968帧，**两个格式逐首帧数均与原曲完全相同**；10%/50%/90%位置各1秒相关性均>0.98。没有 `-t`、atrim、短loop点、拼接或截成几秒。仅首尾8ms淡入淡出防边沿突变，未改变帧数；这不是无缝循环或听感批准。

完整分析、转换参数、精确命令、原件与产物SHA、峰值/响度和解码检查见 [preparation.json](preparation.json)。可复用脚本为 `scripts/prepare-user-bgm.py`，使用Python标准库和ffmpeg/ffprobe；输入输出目录必须分离，`-n`拒绝覆盖产物，原件不写入。示例：

```text
python scripts/prepare-user-bgm.py --input ORIGINAL_MUSIC_DIR --output NEW_DELIVERY_DIR --report preparation.json
```

## 播放、间隔和有界预热

- 保留应用唯一AudioEngine/Context和现有两个原生媒体槽。同曲场景刷新、加载→首页→选角、详情/背包/menu弹层不重置src、currentTime或新增音轨。
- 用户最终要求为 **整曲真实ended→可取消3000ms间隔→再播放**。所有音乐 `loop=false`，仅自然ended建立音乐间隔；同曲刷新/普通点击不会提早重播。换曲、静音/零音量、隐藏、退出销毁及音乐generation更新取消陈旧等待，旧Promise/回调不能补播。
- 开场曲仍在加载页优先尝试；受限时沿用轻点启音，保留静音偏好，音乐不进入图像加载进度/入场门。真实手势内resume/play，拒绝不当格式失败、不自动换MP3或循环重试。
- 当前首需曲达到可播放状态后才开始一个下一场景的暂停预热；媒体槽最多2个。选角预热商店，商店按实际下一场预热普通/Boss曲，章节目录预热实际将进入的战斗，结算预热商店或失败后开场；省流/2G跳过可选预热，隐藏/静音释放可选请求，不把四首解成JS AudioBuffer常驻。
- 初始不支持Vorbis直接MP3；加载/解码失败或有限启动超时可同曲回退MP3一次，双格式均失败走原有限失败/后续真实手势恢复路径，无下载/播放风暴。中途格式失败在fallback metadata就绪后保留原实际播放位置；陈旧源和换曲不能借此复活。

## 场景核对与必要例外

ShopScene只在三处音乐选择把Boss前商店改为shop；预警视觉和原Boss SFX不改。GameScene仅加章节待入场音乐/预热以及重开目录的生命周期检查；实际战斗仍在已成功入场后按保存的stage.index选普通/Boss曲。已阅Boss规则且从商店直接进入战斗时不短切开场曲，避免无意义的中间换曲。

IntermissionScene按**已保存的实际战斗stage.index**延续曲目，包含冷恢复Boss结算；不能只靠新AudioEngine默认的“上一战”记忆。success/failure服务枚举仍解析为最近真实table/boss，未增加第五首。退出结算进入商店/首页时才换其所属曲。详情、背包和设置继承所在页面。

## 旧曲清理与保护

已从当前树删除9份旧BGM（运行时和art源副本），共 **17,912,136字节**，并删除旧P06 fallback manifest、移除活动manifest/preload/代码/验收脚本引用。清单及实际删除前SHA见 [retired-bgm.json](retired-bgm.json)。Git历史未改、不force，按日期/SHA绑定的旧证据文档未重签。

现存 **30个Ogg/WAV SFX文件**全部与依赖Git blob相同；新加坡五声、战鼓、寺钟保留。`PerformanceAudio.ts`、`foley.ts`、`mixPolicy.ts`及AudioEngine从consumePerformance到scoreImpact/rebound/stopScoreFire的实现片段均与15cdc053一致。[preservation.json](preservation.json) 保存逐文件保护证据和四首本地原件SHA。除音乐选择小段，不修改计分/技能/玩法语义或共享视觉函数。

## 检查与交接

- **PASS**：14个定向文件 **191项**，原始 [tests.json](tests.json)。涵盖曲目/双格式hash/完整帧数、旧曲缺席、普通/Boss结算继承、完整结束后的3秒间隔及各取消边界、能力不支持/误报/双格式失败/预热失败、手势拒绝不误回退、中途回退位置、两槽及首需优先、省流/低网/后台、原薄事件与计分音频回归。
- **PASS**：TypeScript `--noEmit`、Vite生产构建383 modules、4个更新后的浏览器harness `node --check`、转换脚本语法、`git diff --check`、所有源/产物实际ffmpeg完整解码与测量。既有大chunk警告保留。
- **NOT_RUN**：本机或远端浏览器、实际网络并发/手机解码器、真实DOM ended后三秒观测、物理设备、耳听响度/混音/听感。本机browser被用户禁止；没有把单位模型、相关性或ffmpeg测量当实听。

父会话可复用 `tests/audio-lifecycle.browser.mjs` 的真实点击/延迟/失败/近尾自然ended场景。该脚本的受控近尾seek只用于验证ended机制，不能代替听完整曲。联合验收需要同版确认加载手势、选角/商店/Boss前商店、真正开战、冷恢复结算、三秒间隔与取消，以及两槽下载和Vorbis失败MP3回退；音频配方体验验收仍按原同批候选继续。
