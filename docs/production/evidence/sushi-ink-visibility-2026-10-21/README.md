# 苏轼真实代价 K：遮挡修复与墨线精修

独立分支 `fix/sushi-k-ink-visibility`，基线为本轮 fetch 核实的 main `de837ed893dab9b34abcbdba214caf5321c01c15`。修后实际采集于干净源码 head `3cfaafb5e39c7dca9cf87a9cf3061b928c2fbe54`，双端报告均记录 `dirty: ""`。后续提交仅保存本证据，不改产品代码。交付 [draft PR222](https://github.com/big-dimple/tangsongpai/pull/222)，不合并、不推 main；最终含证据 head 的 CI 另在交付回执核实，不把源码输入当最终 head。

## 直接观看

| 场景 | 修前（同一合法检查点/同一选牌） | 修后 |
| --- | --- | --- |
| PC 1366×768 | [修前](pc/before.png) | [修后](pc/armed-a.png) · [另一动态时刻](pc/armed-b.png) |
| 手机竖版 390×844 | [修前](phone/before.png) | [修后](phone/armed-a.png) · [另一动态时刻](phone/armed-b.png) |

原速完整过程：[PC MP4](pc/process-1x.mp4) / [原始 WebM](pc/process-1x.webm)；[手机 MP4](phone/process-1x.mp4) / [原始 WebM](phone/process-1x.webm)。MP4 仅转码，未剪接、未变速；含载入、两次同检查点恢复与减少动态过程。演出设置 1×，录制无音轨，不宣称听感验收。

手机细节：[取消](phone/cancelled.png) · [改选主手 K 后仅另一 K 蓄势](phone/main-k-excluded.png) · [菜单隔离](phone/menu-blocked.png) · [确认后的 K 蓄势](phone/score-dashes.png) · [真实 K 碎裂](phone/fracture.png) · [×3 传送](phone/factor-flight.png) · [倍率落定](phone/gold.png) · [减少动态](phone/reduced-static.png)。PC 同名画面位于 `pc/`。

## 根因与可见差异

不是单纯层级不足。原准备态已经在每次更新时 `bringToTop(holder)`，但传给 `SushiKingEnergy` 的避让区包含**所有其他整张牌**，不区分前后。手机叠牌时，后方牌覆盖 K 左半部、前方牌覆盖右半部，两者并集完全覆盖原中心轨迹；浏览器实测两 K 在修前全部准备态绘制中没有任何虚线（`lines: []`、`polygons: []`）。PC 不叠牌时原虚线存在，但蓝色双层硬直线和菱形尖粒较碎。

修后只使用真正位于前面的牌面，以及牌点/文字/操作避让区，从**本张真实 K 内**选择露出的纸面。手机虚线落在 K 下半部露出的纸条，PC 环绕 K 牌画；不借邻牌或抬升到弹窗层。保留 12 槽和既有时钟驱动，用 8 段采样的收笔弧形替代方头双直线与尖粒，深青绿主色、两笔克制朱砂、很细纸色衬边；中间没有填充。

确认时把同一 K 的遮挡信息交给已有蓄势/收缩对象，避免突然跳回被遮住的中心。原 K 细框、`windup*.62` 碎裂衔接、一次实际倍率到达和真实牌销毁流程不变。生产差异仅 `SushiKingEnergy.ts`、`SushiDiscardCardPresentation.ts`、`SushiKingCharge.ts`，哈希见 [index.json](index.json)。GameScene、规则/倍率/次数/存档、理牌、其他英雄及 Astra 选角/路线均未改；无蓝团、整屏闪光或旧烟雾，无性能削减或性能收益主张。

## 有限验证

- 实际 headless Chromium 151.0.7922.173，PC 1366×768 与手机 390×844、DPR1。手机开启 mobile/touch 模拟；牌桌使用真实 touch 输入，技能初次确认使用真实 DOM click，后续确认使用 touch。这是云端浏览器模拟，**不是手机/iPad/Safari 真机**。不追 iPad、不扩六英雄矩阵。
- 沿用 `sushiSkillLocationFixture` 校验合法检查点，再经真实继续游戏、选牌、技能确认、出牌。不是自然抽到这手牌；未改运行时规则状态以伪造成功。修前/修后为相同手牌、同样的 8 对主手与两张代价 K，截图为原始整屏；动态相位不是锁帧逐像素比较。
- 双端都验证取消、重选、主手 K 排除、多 K/相邻牌、菜单隐藏、合成 blur/focus 隐藏恢复；准备操作前后完整保存一致。每个准备态 K 有 24 个窄弧多边形（12 笔×纸边/墨线），PC 245 次绘制、手机 259 次绘制；实际绘制顶点没有进入传入的受保护区。该几何核对是辅助证据，另已目视检查原图和视频联系表，不将源码断言冒充画面验收。
- 确认后双端看到真实 8 片 K 碎裂、单个 ×3 传送、金字“本次得分 ×3”落定；捕获 PC 1 帧 / 手机 3 帧 release。最终实际得分 306、事件因子 3，完整状态严格等于领域命令结果，保存严格等于检查点；结束准备对象为 0。
- 通过真实设置勾选减少动态后，同一检查点重跑：两 K 无旋转墨线，仅一条真实倍率说明，350ms 后绘制命令不变；出牌仍 306，结束对象 0。旧 ×4 身份由相关单元测试覆盖，未新增旧身份浏览器矩阵。
- 相关 7 文件 39 项测试通过：`sushi-blue-energy`、`sushi-king-preparation`、`sushi-king-charge`、`sushi-discard-visibility`、`sushi-skill-payoff`、`sushi-discard-exit`、`sushi-discard-origin`。包括叠牌回归、打印区域避让、重复/取消、旧 ×4、清理与碎裂。最终 [typecheck](typecheck.txt) / [build](build.txt) 通过，构建仅原有大包提示。CI 运行项目既定门，不另刷浏览器大矩阵。

原始观察：[PC 修前](pc/before-report.json.gz) / [修后](pc/after-report.json.gz)，[手机修前](phone/before-report.json.gz) / [修后](phone/after-report.json.gz)。报告 `geometry` 保留的是用于对照根因的旧全牌遮挡探针；实际绘制使用的遮挡输入在每条 `draws[].boxes`。报告不包含新造得分。

复现：`PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright SUSHI_DASHES_OUTPUT=shots/sushi-visibility-pc-after node harness/sushi-ink-visibility.mjs`；加 `SUSHI_PHONE=1` 为手机。端口 5733，harness 的 finally 关闭 context/browser/Vite。首次旧脚本因缺 Playwright FFmpeg 未能录制，原失败保存在 [initial-recorder-failure.json.gz](initial-recorder-failure.json.gz)，安装依赖后已重新采集。精修加宽笔触时新增几何专测曾发现 0.102px 越出安全纸面，已以笔触半宽计算轨迹半径修正，最终 39 项通过；没有删除旧失败或旧证据目录。

未验：物理设备、Safari、iPad、听感、全遮住或超窄到不足 12×16px 可用纸面的极端布局、自然长局与整体审美签收。完全不可见的 K 不向邻牌或弹窗投射虚线。没有借本修复继续下批任务；交付后停服务。
