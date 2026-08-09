# 开发者指南

> **语言**:简体中文 · [English](DEVELOPER.en.md)
> 目标:让任何开发者不看对话记录也能接手、修改、迁移本项目。
> **规矩:本文只做“操作手册”,不记修订流水账;任何改动必须同步英文版 DEVELOPER.en.md。**

---

## 1. 总览

- 架构与目录(简版):见根目录 [ARCHITECTURE.md](../ARCHITECTURE.md)(中英双语);**全景详版见下方 1.1**
- 网页入口:双击 `OpenWebPage_打开网页.bat`；Local Preview 无配置即可用，其他环境从本机 `OpenWebPage.local.cmd` 读取 URL，源码不保存服务器地址
- 修改后的标准入口:`node tools/dev-assistant.mjs prepare`，统一执行站点发布字节 canonicalize、`site/wrt` 全量文本校验、版本/siteSha stamp、变更文本、`check-all`、`git diff --check` 与状态输出；只复检不更新时间时运行 `node tools/dev-assistant.mjs verify`
- 业务生成器按实际修改范围运行；本地预览可做页面自检。Blog 正式镜像只在 `main` 晋级后从 `origin/main` 精确同步，不作为普通开发检查步骤
- 所有生成器只依赖 Node.js ≥18 标准库,无 npm 依赖

### 1.1 全景目录架构

> 标注:✍ 人工维护 · ⚙ 生成物(勿手改,改上游源后重跑生成器);未标注 = 代码/脚本,按常规改。

```text
WeiG-OpenWrt-AutoBuild/
├─ OpenWebPage_打开网页.bat        本地预览:自动起服务+开浏览器,打印手机可访问的局域网地址
├─ README.md                    ✍ 用户文档中文源(插件计数标记由 gen-plugins 自动刷新)
├─ ARCHITECTURE.md              ✍ 目录与架构总览(公开,中英双语)
├─ translations/                ⚙ README 十语译文(zh-TW/en/ru/es/pt/ja/ko/de/fr/vi,工作流翻译)
├─ .github/workflows/              GitHub Actions（生产 + 手动路由探针）
│  ├─ custom-build.yml             ★核心:workflow_dispatch-only exact-ref Build Worker
│  ├─ cancel-build.yml             Issue 提交者用 /cancel 取消自己的构建
│  ├─ build-dispatcher.yml         E v2 生产 `[build]` Issue 路由 + 手动 exact-ref Probe/Worker canary
│  ├─ build-routing-probe.yml      E v2 手动只读 Probe Worker（不编译 OpenWrt）
│  ├─ sync-upstream.yml            每周同步上游:机型目录/种子/插件表/说明页,有 diff 才自动提交
│  ├─ mirror-upstream.yml          每月镜像上游仓库防删库(需 secrets.MIRROR_TOKEN)
│  ├─ pages.yml                    main 发布 standalone GitHub Pages
│  └─ ci.yml                       唯一 Required CI:版本/全仓文本/项目契约/差异空白检查
├─ config/                      ✍ base .config 唯一事实源(77 个品牌目录)
│  ├─ 360/360t7/                   360T7 按源码/分支/Profile 生成的配置
│  ├─ platform/x86-64-generic/     通用 Target 的版本化 config
│  └─ <品牌>/<机型>/            ⚙ 其余设备的版本化种子 config(gen-seed-configs 产出)
├─ Shell/                       ✍ 构建期 diy 脚本(按源区分)
│  ├─ diy-immortalwrt.sh           P1 阶段(feeds 前),当前空壳
│  ├─ diy2-360T7.sh                ImmortalWrt 主线默认设置
│  ├─ diy2-openwrt.sh              OpenWrt 官方专用(官方无 default-settings/argon,不能混用)
│  └─ diy2-lede.sh                 Lean LEDE 专用(append 模式)
├─ site/wrt/                       ★ 定制页面 = 部署单元,整目录拷走即可用
│  ├─ index.html                ✍ 页面骨架
│  ├─ app.css                   ✍ 样式(浅深双主题×两档密度,1160px 容器,860/560/400 断点)
│  ├─ app.js                    ✍ UI、Catalog 加载、交互与请求生成；不维护插件专用依赖规则
│  ├─ lib/catalog-engine.js       浏览器/Node 共用的声明式 Catalog 规则解释器
│  ├─ lib/catalog-loader.js       浏览器 Catalog 分片下载、缓存与完整性校验
│  ├─ lib/catalog-schema6.js      schema 6 菜单/隐藏/Help 分片合并器
│  ├─ lib/catalog-search-worker.js Advanced 离线搜索 Worker
│  ├─ lib/build-identity.js      浏览器/Node 共用 dev/staging/main 构建命名规则
│  ├─ lib/package.json            仅将 lib/*.js 声明为 Node ESM，不改变仓库其他 .js
│  ├─ packages.html             ⚙ 软件包用途说明页(gen-pkg-page 产出,11 语内嵌,离线可开)
│  ├─ Wei.G.ico + Wei.G-favicon_little.png   站点图标
│  └─ data/                        页面与 CI 共用的运行时数据
│     ├─ devices.json           ✍⚙ CI/历史请求注册表 176 台机型 + 1 个通用 Target(网页不加载)
│     ├─ i18n.json              ⚙ 11 语 UI 词条(gen-i18n 产出)
│     ├─ timezones.json         ✍ 445 个 LuCI IANA→POSIX 时区映射
│     ├─ 360t7/                 ⚙ plugins.json(242 插件)+ packages.json(4736 原始包)
│     └─ seed/                  ⚙ Catalog/custom-target 共用 plugins.json
├─ tools/                          Node 工具链(≥18,零 npm 依赖)
│  ├─ plugins-meta.json         ✍ 精选插件展示元数据(名/组/说明/体积/hot/locked/warn/pkgs/exclude；不存构建依赖)
│  ├─ plugin-sizes.json         ⚙ 360T7 官方包索引体积快照(218 项,其余回退 meta)
│  ├─ i18n-source.json          ✍ UI 词条中文源表(唯一手改入口,{x} 占位符别动)
│  ├─ i18n-translations.json    ✍ 十语译文表(含繁中,人工/工作流补译)
│  ├─ device-catalog.json       ⚙ 三源版本/设备/Profile 目录(fetch-catalog 产出)
│  ├─ package-baseline-360t7.json ✍ 360T7 开发者软件包三源完整快照
│  ├─ fetch-catalog.mjs            逐分支解析 TARGET_DEVICES 与 Device 模板继承
│  ├─ gen-seed-configs.mjs         目录 → 版本化设备条目 + 最精简 config
│  ├─ gen-plugins.mjs              config × meta → plugins/packages.json + README 计数刷新
│  ├─ gen-i18n.mjs                 校验合并词条 → i18n.json + 翻译对照表
│  ├─ gen-pkg-page.mjs             生成 site/wrt/packages.html
│  ├─ fetch-build-request.mjs      下载 GitHub Issue 附件；支持 REQUEST_EVENT_PATH 固定快照并回退 GITHUB_EVENT_PATH
│  ├─ parse-build-request-identity.mjs E v2 探针只读 sourceEnv/requestCommit/requestId
│  ├─ parse-request.mjs            载荷解析 + 固定 Catalog/源码契约 + 共享引擎严格校验
│  ├─ check-all.mjs                一键体检;check-drift.mjs 上游漂移哨兵
│  ├─ canonicalize-site-release.mjs site/wrt 文本发布字节标准化（复用文本格式规则）
│  ├─ site-release.mjs             site/wrt 原始字节确定性全站 SHA-256；支持 --print/--check
│  ├─ stamp-site-version.mjs       本地生成 VERSION + siteSha256；--check 供 CI 只读验证
│  ├─ gen-build-meta.mjs           生成部署实例 Version/Commit/Branch/Built/siteSha256 元数据
│  ├─ dev-assistant.mjs            Prepare/Verify 编排；不执行 git add/commit/push
│  ├─ sync-blog.mjs                exact mirror + siteSha256 复验(原子替换与失败回滚)
│  └─ serve.mjs                    本地静态服务器(监听 0.0.0.0:8642)
└─ docs/                           上传的开发者文档(仅此二件)
   ├─ DEVELOPER.md                 本指南(纯中文)
   └─ DEVELOPER.en.md              英文版(逐轮同步)
```

## 2. 分述:改哪里、怎么改

### 2.1 页面外观(颜色/字体/断点)

全部在 `site/wrt/app.css` 头部的 CSS 变量里,改一处全站生效:

| 变量 | 作用 | 浅色默认 | 深色默认 |
|---|---|---|---|
| `--bg` / `--card` / `--card2` | 页面/卡片/次级底色 | `#f5f6f8` `#fff` `#f2f4f7` | `#11151c` `#1a202b` `#222a37` |
| `--text` / `--text2` / `--text3` | 主/次/弱文字色 | `#1c2430` `#5b6572` `#667180` | `#e6eaf0` `#9aa4b2` `#93a0b0` |
| `--accent` / `--accent-bg` / `--accent-text` | 主题蓝 | `#2563eb` … | `#4f83f1` … |
| `--danger` / `--warn` / `--ok` / `--gold` | 状态色 | — | — |
| `--radius` / `--shadow` | 圆角/阴影 | `10px` | — |

深色有两份定义(`html[data-theme="dark"]` 手动 + `@media prefers-color-scheme` 自动),**改色要两处同步**。`index.html` 与生成的 `packages.html` 还共享一段极小的同步 Theme Bootstrap：它在 Release Pointer/CSS/app.js 之前读取 `wrt_theme`，按 `light` / `dark` / `auto + prefers-color-scheme` 立即设置首帧背景、`color-scheme` 与 `theme-color`，避免暗色系统先闪白页；`app.js` 后续主题切换必须复用同一个 `__WEIG_APPLY_THEME__`，不能另写第二套判定。
字号体系:正文 17px(紧凑档 15.5px,Aa 按钮切换),胶囊/插件/组头 15px,提示 14px。
响应式断点:860px / 560px / 400px;插件网格 `repeat(auto-fill, minmax(150px,1fr))`(紧凑档 126px)。

### 2.2 界面文案与多语言

- 中文源:`tools/i18n-source.json`(唯一手改入口,`{x}` 占位符别动)
- 其他 10 语:`tools/i18n-translations.json`(含繁中)
- 改完跑 `node tools/gen-i18n.mjs` → 产出 `site/wrt/data/i18n.json`
- 校验规则:网页 11 语必须全部完整,`check-all` 遇到任一缺词条直接失败
- 浏览器语言自动匹配;完全无匹配默认英文
- `i18n.json` 使用网络优先、localStorage 仅作断网回退,避免部署新增词条后本次页面仍使用旧表;`data-i18n` 缺键时保留 HTML 人类可读兜底,不得显示内部键名

### 2.3 插件与原始软件包

- 精选插件元数据:`tools/plugins-meta.json`(中文名/分组/说明/体积/hot/locked 必选锁定/warn 资源警告/pkgs 各源包名映射/exclude 排除)。它只决定快捷入口和展示，不再保存构建依赖；依赖、反向依赖、choice、select、imply、conflict 与 provider 全部来自每周更新的 Catalog。
- 360T7 容量估算优先取 `tools/plugin-sizes.json` 的依赖闭包压缩体积中位数;缺数据时回退 `plugins-meta.json` 的人工估算。该数据仅适用于 MT7981,种子机型始终使用人工值
- 分组顺序 = `groups` 数组顺序("系统基础"第一,"魔法与加速"最后)
- 改完跑 `node tools/gen-plugins.mjs`,会警告"config 里有但没收录"的包；`data/<机型>/packages.json` 继续生成，但只供软件包说明页和 schema 3/4 旧请求兼容使用，网页不再提供重复的“全部软件包”编辑入口。
- 软件包用途说明页:`node tools/gen-pkg-page.mjs` 重新生成 `site/wrt/packages.html`(11 语内嵌,原始包搜索 + 精选插件用途表;插件数据或 pkgpage 词条变更后要重跑,sync-upstream 已自动接入)
- 精选插件名称/用途:`tools/plugins-i18n.json`;除简中原文外的 10 个语言(含独立繁中)必须为 226 项同时提供 `name` 与 `desc`,`gen-plugins` 和 `check-all` 遇到缺译会直接失败。技术包名与 `CONFIG_PACKAGE_*` 不翻译。
- 中文敏感词显示层:`site/wrt/app.js` 里 `ZH_SUB`(中文替换为"魔法")与 `EN_MASK`(英文打星);仅中文界面生效

### 2.4 机型

- 注册表:`site/wrt/data/devices.json`(仅供 CI、生成工具和历史请求兼容;网页不再加载。360T7 完整维护,其余为种子机型)
- 公共网页目录 `site/wrt/data/` 禁止存放 `.config`;唯一权威 base config 位于 `config/`。`gen-plugins.mjs` 会删除旧公共副本并生成插件/软件包索引。
- 机型目录:`tools/device-catalog.json`,由 `node tools/fetch-catalog.mjs` 逐分支解析真实 `TARGET_DEVICES` 与 `Device/*` 模板继承;随后 `node tools/gen-seed-configs.mjs` 按源码/分支/Profile 重建独立最精简配置。
- 网页按 Catalog 动态生成 Target 与全部插件选项。`site/wrt/lib/catalog-engine.js` 是唯一关系计算器；`app.js` 的 `applyCatalogIntent()` 只负责传入用户操作并同步 UI。启用选项时递归加入 Catalog 可唯一确定的强依赖和 `select`，取消依赖时递归关闭失效依赖者，取消插件时清理无其他使用者、未被基础/推荐/导入/用户层保护的自动依赖。共享依赖和用户手动选择的依赖必须保留；`imply`、多 provider 与 deferred 条件交给官方 Kconfig。禁止在 `app.js` 写插件名、语言包或主题联动特例。
- 用户加载 `.config`、JSON 或 `config.buildinfo` 时，网页等待对应 Catalog 后恢复 Target/menuconfig；不再运行全局 `proposeRepairs()` 或静默改写导入配置。已收录符号继续通过同一依赖引擎交互，真正未收录符号保留在导入工作区；上传的完整配置仍是唯一权威输入。
- JSON 导入先执行严格 `JSON.parse`。旧版 WeiG schema 3–6 文件若仅因 `config` 字段中的 `.config` 双引号未转义而损坏，可按固定字段边界安全恢复；恢复器不执行脚本、不使用 `eval`，并要求 WeiG 生成头、`pageVersion` 与 `use_defconfig` 同时存在。成功后提示重新下载为标准 JSON。
- Target 定位搜索框、“当前构建契约”和构建控制共用外层卡片：桌面默认严格为一行三段，定位框固定缩窄并用 `… Subtarget / Target Profile` 保留最有辨识度的尾部提示；契约保持原有折叠行为，只显示标题/Catalog 提交，展开后详情横跨整行。`推荐项`、`配置`、`Defconfig`、`Selected only` 与 `来源` 是契约框外的独立右侧控制组，并保持单行不折行。窄屏可按响应式规则堆叠外层区域，但控制组自身不换行。插件操作不得把全配置 violations 输出到 Toast；直接 package/choice 冲突使用主题对话框展示相关项 N/M/Y。推荐项配置按钮始终保留位置，推荐项关闭时禁用而不是隐藏。
- Catalog 以源码 `.packageinfo`/Kconfig 名称为权威。Advanced 只有一个名称/symbol 搜索框，索引完整 Kconfig symbol、`CONFIG_` symbol、软件包名与 prompt；symbol 同时加入下划线/横线分词形式，因此 `TARGET_ROOTFS_PARTSIZE`、`CONFIG_TARGET_ROOTFS_PARTSIZE`、`ROOTFS` 与 `Root filesystem partition size` 均可命中。长 Help/description 不进入搜索，也不为搜索额外加载 `help` 分片。普通项固定一行：左侧 ID 去掉 `CONFIG_PACKAGE_`，中间说明靠右并单行省略，N/M/Y 固定最右；ID、搜索结果标题与来源徽章使用和 `Advanced menuconfig` 同档主字号，说明文字降一级。bool/tristate 继续进入 Catalog N/M/Y 依赖引擎，Advanced、即时冲突框和兼容性提示共用同一个可选状态集合；类型、当前依赖、隐藏/不可关闭属性不允许的状态不显示。bool 的直接依赖求得 `m` 时按原生 Kconfig 提升为 `y`，不能因此误拒绝合法的 tristate M。string/int/hex 走独立 scalar 编辑路径并先校验值。悬浮、聚焦或轻触 ID/说明显示完整 `CONFIG_*`、当前语言说明、上游英文和菜单路径。
- Catalog schema 6 将每个分支拆为 `core`、`graph`、`menu`、`hidden`、`help` 和当前语言菜单分片。首次选择分支只并行下载 `core + graph`；展开 Advanced 才下载可见菜单与当前语言，首次搜索再补隐藏显示信息。名称/symbol 搜索不加载长 Help，保持 Advanced 的 lazy-load 边界。`graph` 使用 relations schema 3 紧凑数组；schema 5 单体只作为迁移回退。Advanced 每次状态变化递增 revision，Target 上下文、表达式 token、可见性和可选 N/M/Y 集合按 revision 复用；搜索索引在 Worker 中建立，输入经 180 ms 防抖，主线程只接收 symbol ID。Advanced 顶部把可换行的完整路径放左侧、搜索框与固定 `N/M/Y`（无问号）放右侧；空间不足时搜索组整体换到下一行，路径不截断。`Selected only` 与 `Origin` 和推荐项/配置/Defconfig 一起位于“当前构建契约”框外右侧的独立单行控制组。菜单一次最多渲染 80 行并按滚动分页。
- D117 启动性能契约：网页主体必须先完成首次 paint，再自动加载默认 Catalog；schema 6 的 `core + graph` 阶段只允许建立 Target/Profile 默认值需要的 symbol/choice 最小索引，不得提前建立 Advanced 的路径、descendant、名称搜索文本或 Worker 索引。有效 Catalog Cache 命中必须复用已校验/解码的数据，同一 asset 不得再次 gzip 解压或 `JSON.parse`。baseline fixed-point 条件默认值在每一轮共享一个 validation context，并在该轮增量同步普通 symbol；Target-owned context 值不得被 baseline 覆盖。`tools/test-catalog-loader.mjs` 与 `tools/test-catalog-performance.mjs` 会锁定这些约束。
- Advanced 普通项无论是否截断都可打开统一详情弹层；英文界面同样可查看完整 CONFIG symbol、英文说明和路径，其他语言额外显示真实译文。Source/Branch 加载、Catalog commit/hash/bytes 校验、schema 6 分片与 VPS 无 Catalog 的部署约束保持不变。
- 桌面使用悬浮/聚焦，手机轻触 ID 或说明打开详情；点击 N/M/Y 只改变状态。浮层宽度受当前行 N/M/Y 左边界限制。分类、choice、分页、搜索 Worker 和响应式控制继续按既有性能设计运行。
- 网页只接受 schema、commit、压缩字节数与 SHA-256 都符合 index 的 Catalog。新 `build-request` schema 5 同时保存 Catalog 仓库、不可变数据提交、legacy asset/hash/bytes、Catalog/relations schema、上游仓库和源码 commit；Issue 解析器只读取固定 index 并逐字段核对这份版本契约，不再下载单体 Catalog 扫描整份 `.config`，Workflow 按精确上游 commit 构建。schema 3/4 只作为历史请求兼容。`Top level` 固定为可回跳主菜单；精选 Applications 是由浏览器 Catalog 引擎处理依赖的 UI 快捷入口。
- Catalog 的 Publish 按分支校验当前结果。成功分支立即发布新分片；失败或校验损坏的分支隔离本轮结果并沿用 `catalog-data` 的 last-good，index 分别标为 fresh/stale/unavailable。部分失败时滚动目录仍更新、矩阵 Workflow 仍保持红色；只有所有分支都成功且通过校验时才更新完整 Release。
- Catalog 翻译任务使用工作流最小权限 `models: read`，默认每周增量处理 500 条文本；翻译警告写入 `translation-summary.json` 和 Publish Summary。人工表、上游英文与已经成功的目录发布不受模型故障影响。
- 360T7 最小 config 不携带完整 Kconfig 软件包表;开发者搜索所需三源状态保存在 `tools/package-baseline-360t7.json`,由 `gen-plugins` 合并生成 `packages.json`。
- **config 文件里的注释一律保留,不许删**——前端与 CI 都只做行替换

### 2.5 构建链路

- **E v2（生产 exact-ref 路由，已验收）**：Phase A 已通过 dev、含 `/` 分支、stale commit、branch 不存在的真实 Probe 矩阵；Phase B1 又在 Issue #138 / Run `31280106097` 证明真实 `custom-build.yml` Worker 的 Request/Workflow branch 都是 `dev`，Request/Workflow commit 都是 `63aafb274720345df1d5d659dbdebb2307865dd7`，并完成一次全绿的真实 OpenWrt Build Backend。B2/B2.1 把普通 `[build]` Issue 的唯一生产入口切到默认分支 `build-dispatcher.yml`，而 `custom-build.yml` 仅为 `workflow_dispatch` exact-ref Worker。Dispatcher 对 opened 事件使用原始 Issue 快照，经 `REQUEST_EVENT_PATH` 读取唯一 schema 5 JSON，仅解析 `sourceEnv`、完整 `requestCommit`、`requestId`，要求 branch HEAD 精确等于提交，并在派发前重新确认 state/author/created_at/title/body；通过后以 `ref=sourceEnv` 派发 Worker。Worker 再核对 Workflow branch/SHA、Issue 快照/body、精确 checkout 与完整 parser identity。Staging smoke Issue #139 / Dispatcher Run `31283178862` 已证明 Request/Workflow/Checkout 全部是 `staging@4ba62ce099f89d6b55a75c2c93fd3f1618b06b9b`；生产 Issue #140 已证明 main 自动路由后的 Worker 保留原 Issue 作者 `weigefenxiang`，Request/Workflow branch 都是 `main`、commit 都是 `4ba62ce099f89d6b55a75c2c93fd3f1618b06b9b`，`Verify checked-out commit` 成功，随后 `/cancel` 成功。B2 切流前 direct-Issue Worker 的临时准入/取消兼容已在 E 收尾删除；当前每用户准入和取消只匹配 workflow_dispatch Worker。E 收尾已完成 dev → staging → main，并以真实 `[build]` Issue 再次验证 admission + `/cancel`，对应 Worker 成功取消，因此 E v2 已 CLOSED。`probe` 与 Owner-only `build-canary` 继续保留手动诊断。网页 deployment identity 同轮 fresh 加载 `site-version.json` + `build-meta.json`；Version/siteSha256/Branch/full Commit 任一缺失或不一致时 `identity` 门禁阻止云提交。B2.1 的 quoted Workflow `run-name` YAML `#` 语义门禁继续保留。Worker Actions 标题统一为 `requester#Issue 请求主体`；main 直接使用请求主体，非 main 使用标准化 branch identity 并以 `-` 连接请求主体。`run_title` 只属于展示 metadata，不得成为 exact-ref 路由依赖：滚动升级时新 Worker 可接受旧 Dispatcher 缺省该字段并回退旧标题；新 Dispatcher 只有在 GitHub 422 明确提到 `run_title` 输入不兼容时才移除该字段重试旧 Worker；Admission 与 `/cancel` 同时识别两种 workflow_dispatch 标题。`Verify checked-out commit` 显式打印 `Request commit` 与 `Checkout HEAD` 后再断言相等。F 全站 SHA-256 Release Contract 已接通：Release Pointer fresh，页面/资源/运行时 JSON 共用 siteSha256 缓存键。

- Catalog Target 的 `arch`、`archPackages` 与 Target/Profile 身份仍是原子构建契约。Profile 声明包改为紧凑管理列表，默认“跟随上游”不写显式值；只有用户逐项选择“加入”或“排除”时才写 `y`/`n`。提交配置仅在 Defconfig 前进行通用 Catalog 检查；用户勾选后运行一次官方 `make defconfig`，成功输出不再接受项目自定义 post-defconfig 验证。`tools/apply-config-overrides.mjs`、`tools/config-overrides.mjs` 与 `system-overrides.json` 已删除，不再强制 `CONFIG_DEVEL`/`CONFIG_BUILD_LOG`。

- Catalog 选择状态保持基础、推荐、用户覆盖、自动依赖与导入来源层。`catalogDependencySymbols` 只记录引擎自动带入项；关闭插件后，引擎可清理其中不再被任何启用项需要的条目，但 `catalogBaselineValues`、`catalogRecommendedValues`、`catalogImportedSymbols` 和非 `n` 的 `catalogUserOverrides` 均为保护层。Profile 包覆盖另以稀疏 `profilePackageOverrides` 保存，仅记录用户改成 Include/Exclude 的少量条目。

- `.github/workflows/custom-build.yml` 只接受网页生成的 Issue 附件，不再提供 `repository_dispatch` 或隐藏 smoke 配置生成入口。部署实例的 `build-meta.branch` 只作为网页来源身份：`main` 保持无前缀 Issue/Artifact；Actions Worker 标题为 `requester#Issue 请求主体`。任何非 `main` 请求都使用实际 branch 作为前缀，branch 内部 `/` 统一替换为 `_`，例如 `fix/foo` → `[build] fix_foo/请求时间戳/...` 与 `fix_foo-...` Artifact。该规则唯一实现位于 `site/wrt/lib/build-identity.js`，`app.js` 与 `parse-request.mjs` 共用，不按域名判断，也不为 dev/staging/fix/feat 写特判。`build_ref` 仍为稳定的 `请求时间戳-构建标识`，`artifact_ref` 只负责环境感知命名；请求 branch/commit 与实际 Workflow branch/commit 分开写入 Summary/`build-metadata.txt`，旧无前缀 Issue/JSON 继续兼容。时区、主题、NTP、请求/生效软件包镜像与 APK/OPKG 检测结果在提交配置、Summary、`package-mirror-report.json`、`firmware-settings.txt` 与固件内 `/etc/weig-build-info` 交叉核验；固件/config 保留 30 天，完整日志保留 14 天。
- 软件包镜像唯一规范为 `config/001.presets/package-mirrors.json`。修改 Source family、官方 origin、adapter、镜像或回退顺序后运行 `node tools/gen-package-mirrors.mjs`，不得直接维护网页投影。`Shell/apply-package-mirror.sh` 只做非阻断流程包装，`tools/package-mirror-engine.mjs` 根据实际 `.config`、规范 JSON 登记的 capability 文件与 adapter 文件识别 APK/OPKG，不按 Branch 名猜测；只替换已登记根地址，保留陌生自定义 `CONFIG_VERSION_REPO`。自动策略 USTC→PKU→源码默认，手动失败→源码默认，任何镜像问题都不能终止构建。运行 `node tools/test-package-mirror.mjs` 覆盖 OpenWrt/ImmortalWrt/LEDE、未来分支、混合 adapter 与回退矩阵。
- 构建准入默认限制每位提交者同时最多 2 个排队中或运行中的任务；第 3 个 Issue 会自动回评并关闭。仓库所有者按 GitHub 登录名识别，不受此上限限制，并为每次构建使用独立并发组，不会在本项目队列中互相等待。Fork 可在仓库 Variables 设置正整数 `MAX_BUILDS_PER_USER` 覆盖默认值。`cancel-build.yml` 只接受原 Issue 提交者的 `/cancel` 或 `/cancel-build`，先普通取消，15 秒未结束才强制取消；管理员仍可在 Actions 页面管理任意任务。
- 根目录 `VERSION` 是仓库与网页共用的分钟级 `vYYMMDDHHmm` 代码版本；`site-version.json` 保存同一版本、项目输入 fingerprint、`siteSha256` 与 `hashAlgorithm=sha256`。`siteSha256` 递归覆盖 `site/wrt` 的实际发布字节，只排除自引用 pointer 和部署实例 `build-meta.json`。Prepare 必须先运行 `canonicalize-site-release.mjs`，复用 `check-text-format` 的文本分类把已有 Windows 工作树中的 CRLF/LF 落盘为 `.gitattributes` 约定的确定发布字节，再对 `site/wrt` 做全量文本校验，最后才 stamp。`.gitattributes` 必须为 `site/wrt` 每种发布文件类型显式固定 LF/CRLF 或 binary；回归覆盖 stale CRLF 工作树、`core.autocrlf=false/true` 与 clean detached checkout，canonicalize 后必须得到同一 SHA。SHA 算法本身仍对 raw bytes 哈希，不做换行归一化。排障可运行 `node tools/site-release.mjs --print` 或 `--check`。正式改动提交前运行 Prepare，CI 只 `--check`；分支晋级不重新生成 VERSION。网页常驻显示 `MMDDHHmm` 短版本。Catalog Target 的操作栏显示当前 `TARGET_ROOTFS_PARTSIZE`，点击可查看“项目/当前值/路径”并直接定位 Advanced 修改；它不再用历史 `p.size/capacity` 生成 RootFS 百分比。非 Catalog 旧设备仍保留原容量估算。可选 `build-meta.json` 提供部署实例的 Commit/Branch/Built。
- 下载与并行编译使用动态并发；并行编译本身开启 `BUILD_LOG=1`。并行失败后先用 `Shell/collect-build-evidence.sh` 冻结 `BUILD-LOGS/parallel/`，再清空 `openwrt/logs` 并执行最长 180 分钟的 `make -j1 V=s BUILD_LOG=1`，诊断证据独立写入 `BUILD-LOGS/diagnostic/`。即使单线程恢复成功也上传 BUILD-LOGS，`00-SUMMARY.txt` 明确区分 FAILED / RECOVERED / TIMEOUT。Catalog 引擎只在网页交互中执行强依赖、`select`、choice、反向失效关闭和孤立自动依赖清理；后端不再对整份 `.config` 判断插件依赖或冲突，也不保留人工 `config-rules`。用户勾选时仅由官方 `make defconfig` 解析配置；未勾选时直接使用提交配置。
- `config/001.presets/source-build-requirements.json` 目前只承载前端未勾选 Defconfig 时静默加入的 `CONFIG_HAVE_DOT_CONFIG=y`，`site/wrt/data/source-build-requirements.json` 是静态网页副本。后端不读取该规则，也不因缺失而拒绝请求；若以后所有构建都固定运行 Defconfig，可删除这层前端兼容。
- schema 5 解析器只读取固定 Catalog index，核对 revision/legacy 元数据与 `sourceCommit`，不再下载 Catalog 单体或扫描整份 `.config`。后端只保留安全白名单和最小 Target/Profile 身份核对，不检查 ARCH/ARCH_PACKAGES、插件关系、人工兼容规则、主题包状态或构建必需项。Workflow 获取精确上游 commit；可选官方 Defconfig 是唯一后端配置解析步骤。
- `custom-target` 不要求 Profile 预先存在于仓库清单；上传配置中的通用 Target 选择直接作为构建输入，不含 360T7 专用限制，其可用性由所选上游源码负责。
- 全部版本化 base config 默认关闭 PassWall/SSR Plus/VSSR/TinyProxy 及其代理内核/子选项;`check-all.mjs` 会在任一默认 config 出现代理 `CONFIG_PACKAGE_*=y/m` 时直接失败。config 预检把实际开编配置中已选中的代理相关符号写入 `proxy-selected.txt` 和 Summary,用户主动选择时仍可按正常依赖加入
- `tools/parse-request.mjs`:全字段白名单(机型/源/版本/变体/插件±前缀/原始软件包/登录地址/初始密码/时区/主题/NTP/软件包镜像 ID)。新请求写 `firmware.packageMirror`；仅为旧 JSON 兼容读取 `firmware.opkg`，不得把任意镜像 URL 放进请求。新手 Issue 只显示一个必填附件框并推荐网页 JSON;解析器仍接受 1~3 个 GitHub 自有附件并识别 JSON、`.config`、`config.buildinfo`,但无网页元数据头的原始配置必须先回网页加载识别。
- Issue 是唯一构建入口：前端 `applyToConfig()` 生成完整 config → 附件 → `submitted.config` → `openwrt/.config`。旧 `build-config.mjs`、`repository_dispatch` 和 smoke 兼容入口已删除。
- 时区表在 `site/wrt/data/timezones.json`,来源为 OpenWrt LuCI 的 445 项映射。组合框默认只列约 70 个常用城市并按当前 UTC 偏移从 `UTC-12` 到 `UTC+14` 排序；输入搜索时仍查询完整 445 项，`北京`/`北京时间` 只作为 `Asia/Shanghai` 搜索词，不写入显示值。首次访问且没有用户保存值或导入配置时，优先采用浏览器报告的 IANA 时区；手动选择会保存到本机。前端提交 IANA `zonename`,解析器映射并输出 POSIX `timezone`;三个 diy2 脚本用 `files/etc/uci-defaults/10-weig-timezone` 同时写入两项。控件统一为 44px 高，旧 POSIX 请求继续兼容。
- Actions 的全局 `TZ` 只控制 Runner 进程日志时间；不要在 GitHub 托管 Runner 调用 `timedatectl set-timezone`，该操作可能因 systemd 权限被拒绝并让依赖安装步骤失败。固件时区始终由请求字段和 diy2 首启脚本写入，与 Runner 系统时区无关。
- diy 脚本按源区分:官方源用 `diy2-openwrt.sh`,lede 用 `diy2-lede.sh`(都不能复用 ImmortalWrt 系的)
- `sync-upstream.yml` 每周六 18:37 UTC 自动同步上游，只 checkout/commit/push `dev`；自动提交不得使用 `[skip ci]`，因此所有同步结果都必须进入同一个 Required CI。`check-drift.mjs` 只检查通用 OpenWrt 分支策略并在漂移时开 issue；`mirror-upstream.yml` 每月镜像（需 `secrets.MIRROR_TOKEN`）。构建回归测试通过网页生成的真实 Issue 请求执行，不再使用 smoke 派发器。
- `.github/workflows/ci.yml` 是唯一 Required CI，固定 Job 名 `Required CI / 必需检查`。它对所有分支的 push 运行，并对指向 `dev`/`staging`/`main` 的 PR 运行，且故意不使用 `paths:` 过滤；依次验证 VERSION、全仓文本格式、`check-all` 与提交差异空白。CI 只有 `contents: read`，不得改 VERSION、commit 或 push。公开仓库不包含本地私有维护文件时，`check-all` 会明确跳过仅依赖这些私有部署文件的夹具，其余公开契约照常全量执行；本地完整项目仍执行私有夹具。

#### 取消内置项与直接配置构建

- 开发者模式的 `-id` 会把对应 `CONFIG_PACKAGE_*` 写成显式 `# ... is not set`；完整配置默认直接用于构建，只有请求中明确启用 Defconfig 才执行一次官方上游补全。补全结果不再经过项目自定义的前后目标一致性比较。
- `CONFIG_DEFAULT_*` 只提供默认值,不是强制 `select`;它可以与对应 `CONFIG_PACKAGE_*` 的显式关闭状态并存。
- 上游构建系统仍可能按 Kconfig 依赖关系处理被其他选项 `select` 的符号；这不是项目主动运行 `make defconfig`。页面标为 `locked` 的系统基础项不允许取消。
- 因此取消内置项时应先看依赖与风险警示,不要把“显式关闭”误解成“永远不会作为依赖加入”。

### 2.6 文档体系

| 文件 | 上传? | 用途 |
|---|---|---|
| `README.md` + `translations/README.<语言>.md` | ✅ | 用户文档,11 语;**中文 md 改动后必须同步各语言版本** |
| `ARCHITECTURE.md` | ✅ | 目录结构与架构(中英) |
| `docs/DEVELOPER.md`(纯中文)+ `docs/DEVELOPER.en.md`(纯英文) | ✅ | 开发者操作指南,两版内容保持一致;不记修订流水账 |

### 2.7 部署与迁移

- 发布分支采用 `dev → staging → main`。`Promote_Release.bat` 会先 fetch 并检查 fast-forward、exact SHA 与 VERSION/site-version；只有用户明确输入 `y` 才执行 exact push，push 后再次 fetch 并验证 source/target 都等于候选 SHA。Enter、`n` 或其他输入均取消且不修改 refs；禁止 force push。正常晋级不会重新生成 VERSION。VPS staging 必须由 `origin/staging` 的 exact commit 打包，不能直接复制当前工作区。
- GitHub 对 `staging` 与 `main` 使用 Ruleset：要求 status check `Required CI / 必需检查`、Require linear history、阻止 force push、阻止删除；**不启用 Require a pull request before merging**。这不会禁止任何人提交 PR，只是不强制正式 exact-SHA 晋级先制造 PR/merge commit。外部 PR 仍可正常提出，正式发布纪律是先把确认后的修改进入 `dev`，等待同一 SHA 的 Required CI 通过，再 exact promote 到 `staging`/`main`。
- `OpenWebPage_打开网页.bat` 可打开 Local、Standalone Dev Preview、Standalone Staging Preview、VPS Staging、Standalone Cloudflare Production、Standalone GitHub Pages、Blog Production，或同时打开 Staging Preview + VPS。环境 URL 只存在本机覆盖文件，公开代码没有具体主机/IP。
- Local Preview 由 `tools/serve.mjs` 复用 `gen-build-meta.mjs`，在内存中按当前 VERSION、siteSha256、Git 分支和完整 HEAD 提供 `data/build-meta.json`；不读取仓库内可能过期的部署文件，也不改写工作区。这样 `fix/*`、`dev`、`staging`、`main` 会稳定选择对应 Catalog 数据通道。终端若提示工作区有未提交内容，表示页面可预览这些本地内容，但云构建仍只执行显示的已提交 HEAD；当前 HEAD 未推送到上游时，请求可能被 exact-ref Dispatcher 拒绝。旧预览进程的身份不匹配时，先在原窗口输入 `0`，再重新启动 Local Preview。

- 页面整个 `site/wrt/` 目录拷走即可用。F Release Contract 启动时 fresh 获取 `site-version.json` + `build-meta.json`，若当前文档没有 `?r=<siteSha256>` 会先替换到该 URL；CSS/JS/模块/Worker/站内 JSON 都使用相同 `r`。localStorage 的站点数据缓存以 siteSha256 分区，只删除旧 `wrt_cache:*`，用户语言/主题等偏好不清理；普通静态数据的远端回退只使用当前部署 exact commit，禁止跨 Release fallback。Catalog 保留其独立 pinned SHA/commit 契约。`OpenWebPage_打开网页.bat` 在本地预览运行期间可输入 `0` 正常停止 `wrt-server` 并返回启动器主菜单；直接以 `local` 参数调用时则停止后退出。
- 浏览器动态导入的 Catalog 模块固定为 `lib/catalog-engine.js`、`lib/catalog-loader.js` 与 `lib/catalog-schema6.js`，Advanced 搜索使用 `lib/catalog-search-worker.js`。使用 `.js` 是为了直接复用普通静态服务器已有的 JavaScript MIME 映射；`lib/package.json` 的 `type: module` 只负责 Node/CI 导入。旧 `.mjs` 必须删除，部署脚本在打包、远端切换和切换后 HTTP 冒烟三个阶段校验四个脚本；返回非 JavaScript MIME、HTML 回退或缺文件都会恢复上一版。部署包清单统一由 `tools/verify-site-archive.mjs` 以 `shell: false` 调用 `tar` 并一次验证必需/禁止条目，BAT 禁止使用 `tar | findstr`，因此中文、空格路径和 CMD 括号上下文不会改变参数解析。
- Fork 后只需修改 `site/wrt/data/project.json` 的主仓库、Catalog 仓库与博客地址；网页链接、Issue 目标和运行时 Catalog 会自动采用该文件。HTML 中保留的人类可读链接仅是旧部署兜底。
- 独立站部署：`site/wrt/` 本身就是一级静态应用。Cloudflare Pages 建议 Production branch=`main`、Preview branches=`dev/staging`、Build command=`node tools/prepare-web-deployment.mjs`、Output=`site/wrt`；GitHub Pages 发布同一目录。Cloudflare 对 `/wrt/` 必须让 query string 参与 cache key（不要 Ignore Query String）。Release Pointer 以 no-store + refresh query 获取，而带 `?r=<siteSha256>` 的 Release Assets 可安全长缓存；首次从 pre-F 旧页面迁移到 F 时应做一次 Cloudflare purge 或等待旧 HTML TTL，之后发布不依赖 purge。
- 博客发布镜像：正式版晋级 `main` 后运行 `node tools/sync-blog.mjs [博客路径] --ref origin/main`。工具从 exact AutoBuild commit 镜像完整 `site/wrt/`，临时树和启用树均逐文件比对并重算 siteSha256；任何新增/修改/删除/遗漏文件都拒绝激活。`.wrt-source.json` 记录 Version/Commit/siteSha256；`--check` 同时核对完整树、部署 metadata 与 Release SHA。省略 `--ref` 仅用于本地镜像调试。Blog 不承担 dev/staging Preview，也不得发展第二套 WRT 业务代码。
- 文本格式门禁：`node tools/check-text-format.mjs <仓库路径> --changed` 只检查当前 Git 变更与未跟踪文本，按 `.gitattributes` 要求验证源码/数据为 LF、BAT/CMD/PowerShell 为 CRLF、UTF-8 无 BOM，且文件末尾只有一个换行；它只报告、不自动改写。`tools/dev-assistant.mjs prepare`（Windows 可由 `Sync_Deploy.bat` 调用）会按 canonicalize `site/wrt` → `site/wrt --all` → stamp → changed-text → `check-all` → `git diff --check` 的顺序执行；它只提供 Git 状态/建议，不运行 `git add`、`commit` 或 `push`。Git 的“下次将 CRLF 转为 LF”提示只是信息性 warning，真正阻断项会单独列出。

### 2.8 云构建测试指南(手动 Run workflow 实战)

#### 合法组合速查表(最容易踩的坑)

**版本(version)和变体(variant)必须属于所选源码(source)**,配错会被 `parse-request.mjs` 白名单拦下(秒失败,报错里会列出该源的合法选项,照抄重跑即可):

| source | version 可选 | variant 可选 | 备注 |
|---|---|---|---|
| `ImmortalWrt` | 上游全部远程分支 | 当前分支真实存在的 Profile | 无该设备 Profile 的旧分支不会展示 |
| `OpenWrt` | `main` + 全部 `openwrt-*` | 当前分支真实存在的 Profile | 排除 `lede-17.01` / `pcs-standalone-back` / `master` |
| `lede` | `master` | 当前分支真实存在的 Profile | append 模式,插件能否编译取决于 lede feed |

> 为什么手动跑要自己配对:GitHub 的 Run workflow 表单做不了级联下拉。**网页提交没有这个问题**——页面选了源之后版本/变体自动只剩合法项,普通用户不可能配错。

#### 推荐测试顺序(新仓库/大改动后)

1. **单发验证**:网页选择 Catalog 当前 fresh 的 `ImmortalWrt` 稳定分支、一个常见 Target 与 `ttyd`，失败时先排查基建；
2. **issue-ops 验证**:本地 bat 打开页面 → 勾 ttyd → 提交云编译 → GitHub 上点 Create,一分钟内应有机器人回评"构建已开始";
3. **sync-upstream 手动跑一次**:几分钟结束,验证目录抓取与漂移哨兵;
4. **真实 Issue 回归构建**：从网页分别生成需要覆盖的源码/分支/Target 请求；
5. 全绿后再测花活:高级模式(`+homeproxy -turboacc`)、原始软件包(packages 填 `iptables-mod-ipp2p -iptables-mod-ipopt`)、`stock` 变体、自定义 lanip、`@empty` 密码。

#### 失败了怎么读日志

- **秒失败(几秒钟就红)**= 参数校验没过,看 run 日志里 `parse-request` 步骤的中文报错(会列合法选项);校验前没有编译日志是正常的;
- **下载或编译过程** = Actions 控制台实时显示原始输出，同时写入 `download.log` / `build.log`；若页面日志过长被 GitHub 截断，以 `BUILD-LOGS-…` artifact 内的完整文件为准;
- **编译阶段失败或并行失败后被单线程恢复** = 下载 `BUILD-LOGS-…` artifact,按顺序看:
  1. `00-SUMMARY.txt`(**先看这个**):请求/Workflow 两级身份 + Parallel/Diagnostic 结果 + 最后错误目标;
  2. `build-metadata.txt`:VERSION、request branch/commit、workflow branch/commit、上游 commit 与参数;
  3. `parallel/errors.txt` → `parallel/last-targets.txt` → `parallel/tail.txt` → `parallel/build.log`:第一次并行失败的冻结现场;
  4. `parallel/package-logs.tar.gz`(**如存在**):第一次失败时 OpenWrt 生成的分包日志;
  5. `diagnostic/errors.txt` → `diagnostic/last-targets.txt` → `diagnostic/tail.txt` → `diagnostic/build.log`:最长 180 分钟的 `make -j1 V=s BUILD_LOG=1` 现场;
  6. `diagnostic/package-logs.tar.gz`(**如存在**):仅属于单线程诊断阶段，不覆盖 parallel;
  7. `download.log` / `final.config`:下载原始输出与本次真实配置，可拿去本地复现。
- 常见病因对照:`Package xxx is missing` = 该源 feed 没这个包(lede/官方源勾了社区插件、或高级模式强制勾选);`ext4_allocate ... out of space` = RootFS 镜像容量不足，失败摘要会读取最终 `CONFIG_TARGET_ROOTFS_PARTSIZE` 并提示 `Target Images → TARGET_ROOTFS_PARTSIZE`;上游当日损坏 = 同参数隔天重跑或临时换版本分支。

#### 不等云编译的本地快速验证(秒级)

```bash
# 载荷校验(模拟 issue 提交,改 ISSUE_BODY 里的 JSON 即可)
node tools/parse-request.mjs   # 需先设 ISSUE_BODY 环境变量

# 生成最终 .config(与 CI 完全同规则,直接检查产物)
node tools/parse-request.mjs  # 需通过 REQUEST_FILE 或 REQUEST_MANIFEST 指定网页请求附件

# 全仓库体检(语法/数据/一致性,含全部版本化 base config 的代理默认值扫描)
node tools/check-all.mjs
```

#### 其他实用常识

- 单发构建约 2~3 小时（无缓存）；批量回归请分别提交网页 Issue 请求并遵守每用户构建上限；
- Artifacts:独立原始 `.img.gz`、`CONFIG`、`OPTIONAL-PACKAGES`、`FIRMWARE-OTHER` 保留 30 天，`BUILD-LOGS` 保留 14 天，过期重新提交;
- run 列表按 `Build 定制 · 标识 · 源 版本/变体` 命名,测试时 tag 用带日期的昵称(如 `weige-0727`)方便区分批次;
- 取消构建:普通提交者在自己的构建 Issue 回复 `/cancel`;管理员也可在 run 页面右上 Cancel。取消后机器人会回评并关单。

## D100：Catalog Schema 6 与 Actions 构建契约

Catalog 分支索引必须明确包含：

```json
{
  "assets": { "core": {}, "graph": {} },
  "legacy": {
    "asset": "source--branch.json.gz",
    "hash": "<compressed sha256>",
    "bytes": 123,
    "catalogSchema": 5,
    "relationsSchema": 2
  }
}
```

`assets` 服务于网页 Schema 6/Relations 3 运行时；`legacy` 服务于 Actions 的 Schema 5/Relations 2 精确验证。修改请求契约时，必须同步检查 `site/wrt/app.js`、`site/wrt/lib/catalog-loader.js` 和 `tools/parse-request.mjs`。严禁把 `branch.asset/hash/bytes` 与 `MENU_CATALOG.schema` 或 `MENU_CATALOG.relations.schema` 交叉拼接。新分支尚未发布 `legacy` 时，网页可以浏览，但必须阻止提交云编译。

Windows 运行 Catalog 检查使用：

```powershell
npm.cmd test
```

## Catalog 兼容性证据规则

上游 Kconfig/Catalog 暂时无法表达、但已有真实构建证据确认的少量兼容事实，由 `WeiG-OpenWrt-Menuconfig-Catalog` 根目录的 `compatibility.json` 维护并生成单一 `compatibility.json.gz`。它不是第二套依赖数据库。新增规则或字段前，必须依次检查 Kconfig、Catalog relations/index、网页运行模型和请求契约；已有 symbol、类型、N/M/Y、名称、依赖、provider、conflict、SHA 等事实只能通过 package/rule ID 引用，禁止复制。

- 通道固定一一对应：AutoBuild `fix/* → catalog-fix`、`dev → catalog-dev`、`staging → catalog-staging`、`main → catalog-data`。映射集中在 `site/wrt/data/project.json`，预览通道不读取或生成正式 Release/Pages 地址。
- Catalog 成功后 18 秒低优先级预取全局压缩规则。索引刷新后若压缩 SHA 不变，先复用内存，再复用 Cache API，不重复下载；提交请求前必须成功取得并验证规则，缺失/损坏时不能用“强制”绕过。
- 兼容性契约只接受 schema 2：`issue=file-ownership|build-failure` 与 `match=all-installed|all-selected` 组合通用语义，`packages` 接受 1–16 个真实 package ID，`if` 可选，`paths` 只属于文件归属证据。schema 1（含 `ownership`）及其他 schema 必须拒绝；fix、dev、staging、main 分别读取同名 Catalog 数据通道，须先在候选通道验证后再晋级。插件名称、symbol 能力和依赖不复制进规则。
- 人工证据规则只在“一键自检”和实际创建 `build-request.json` 时执行。`all-installed` 只有所有参与包均为 `y` 才触发；`all-selected` 对每个参与包的 `m/y` 都触发，因此也能描述单软件包的已知源码构建失败。弹窗标题、说明与证据区域按 `issue` 通用渲染。三种处理为：“推荐方案”应用共享 Catalog 引擎推导的唯一最低成本方案、在框内按现有 Catalog record 选择 N/M/Y、保留当前状态并强制继续。推荐应用成功后窗口保持打开并刷新实际状态，用户检查后点击关闭/X 才继续；随后只要真正改变任一 N/M/Y，“已应用”就恢复为可再次点击的“推荐方案”，点击当前状态不算变化；应用失败则回滚并留在原窗口。操作栏按“强制、自定义｜关闭、推荐”分组，手机端保持同顺序的两行两列；软件包 ID 与 Advanced 共用同一响应式标题字号，完整说明正文使用由该字号派生且不小于 14px 的共享字号。没有唯一最低成本方案时禁用推荐并明确提示。首次点击强制只进入风险确认页；返回按钮或确认页右上角关闭会回到原选择页并保留 N/M/Y，只有二次点击“确认强制继续”才生成 forced 审计。
- bool/tristate 的 `default` 值及条件表达式统一由共享 Catalog 引擎按声明顺序求值。Catalog model 从现有表达式派生闭世界边界：只在 default 中引用、但未被 record 定义且不属于 Target/依赖上下文的缺失 symbol 按 `n` 处理并继续后备；真正省略的上下文仍 deferred，不得越过当前项。顶层 `if` 切分必须识别引号、转义和括号，不能误切 string 字面值。bool 的 default 或直接依赖求得 `m` 时都按原生 Kconfig 语义归一为 `y`。网页只渲染并序列化共享引擎在当前上下文允许的 N/M/Y，原始表达式或非法值不能成为按钮文字；string（含字面量 `"n"` 和 `"use if available"`）、int、hex 保留原有字面值语义。
- 强制确认只存在内存中，并绑定规则 SHA、数据通道、Source/Branch、`catalogStateRevision` 和触发规则 ID。配置未变化时，自检后提交不重复询问；配置、Source/Branch、规则 SHA 或页面状态变化后必须重新确认。
- 构建端只规范化并保存被强制的规则 ID 及规则 SHA/Source/Branch 审计，不重新执行兼容规则、不锁软件包、不修改 `.config`。Kconfig/Catalog 的现有即时硬冲突仍保持原行为。
- 兼容性开发先在 AutoBuild 与 Catalog 的同名 `fix/*` 代码分支完成，Catalog 数据发布到 `catalog-fix`。只有用户在 CDN 网页验证成功并明确授权后，才可按 `fix → dev → staging` 推进；`main/catalog-data` 在验证前保持冻结。Catalog 仅修改 `compatibility.json` 的提交走现有 `build-index.mjs --compatibility-only` 快速路径，只更新 compatibility 资产与 index 契约；生成器、验证器、工作流或采集配置变化仍运行完整矩阵。

规则字段、证据生命周期和中英文解释见 Catalog 仓库的 `docs/COMPATIBILITY.md` 与 `docs/COMPATIBILITY.en.md`。
