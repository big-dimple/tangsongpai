# 加载音乐/预热＋入场景深粒子统一整合

基线main `4039c8f3402c608fd8ede272cc66df191a336c9c`；harness身份修复b4d235dc，音频最终来源 `53acabc2842eecead220747e483a471a25ba3394`（产品cc97cf31），视觉最终来源 `ceb5e652668abc5a2c00f0aecba0ef13cbce513b`（产品ea81ecae）。均正常合入，无冲突。18份产品/测试/许可文件逐blob等于各自来源，音频来源LF归一化受测指纹全同；没有整份覆盖main/Boot/Loading。完整指纹和预算见[verification.json](verification.json)。

音频只安装自己的main应用绑定与Boot说明/首批资源，粒子只接Loading构造/close和选角render/shutdown；.load-copy轻点启音提示与真实click/键盘解锁保留。单次尝试menu阳关、同实例跨首页/选角；音频播放Promise和装饰均不进入ready gate。先前harness当前新局版本/hash读真实RunLaunch，3个源契约已过，旧S04夹具保持；本批未再改harness。

联合7文件61项PASS，类型及376模块生产构建PASS，见[定向结果](joint-tests.json.gz)、[构建](joint-build.txt.gz)。源码/测试内容检查后仅补本回执与计划再提交；构建元信息如实保留当时基线dirty，不能写成最终main已重跑。来源音频96与视觉29按各自产品范围复用，不累计为本次新增独立用例。无全套或本机浏览器。

新增六张615×768图传输共757,322字节；17.083984375MiB是整个26项首批RGBA解码量，不是网络大小，也不代表全包20MiB预算通过。1122×1402原图字节不变。规则/存档、部署同步脚本、门禁、依赖锁文件均未改；无新外部包/媒体或阻塞性远端依赖，MagicUI固定源码只移植公式，MIT许可随包。

手机32/桌面64节点，30/60Hz上限是配置而非实测帧率；加载Canvas DPR≤2，不改变Phaser全局DPR。复用32×32小笔刷、无全屏模糊；reduced静态，隐藏/离屏/暂停停调度，切页销毁释放。工程整合完成；远端同版自动播放允许/拒绝、实例/currentTime连续、真机锁屏/手势、听感、加载/六人选角连续观感、遮挡/触控与设备性能均待验。H17既有有限PC证据不外推，长版Boss音乐仍待素材/修订，P08仍in_progress。
