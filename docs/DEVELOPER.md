# 开发者指南

> **语言**:简体中文 · [English](DEVELOPER.en.md)
> docs/ 目录整个上传 GitHub;私有运维文档在根目录 docs-private/(gitignore,不上传)。
> 目标:让任何开发者不看对话记录也能接手、修改、迁移本项目。
> **规矩:本文只做"操作手册",不记修订流水账(历史见 docs-private/方案记录.txt);任何改动必须同步英文版 DEVELOPER.en.md。**

---

## 1. 总览

- 架构与目录(简版):见根目录 [ARCHITECTURE.md](../ARCHITECTURE.md)(中英双语);**全景详版见下方 1.1**
- 本地预览:双击 `OpenWebPage_打开网页.bat`(会打印手机可访问的局域网地址)
- 一键体检:双击 `Check_检查.bat`(全脚本语法 + 全数据 JSON + 一致性抽查)
- 改动后三板斧:`node tools/gen-plugins.mjs` → 本地预览页面点右上角"自检" → `node tools/sync-blog.mjs`
- 所有生成器只依赖 Node.js ≥18 标准库,无 npm 依赖

### 1.1 全景目录架构

> 标注:✍ 人工维护 · ⚙ 生成物(勿手改,改上游源后重跑生成器)· 🔒 不上传 GitHub;未标注 = 代码/脚本,按常规改。

```text
WeiG-OpenWrt-AutoBuild/
├─ OpenWebPage_打开网页.bat        本地预览:自动起服务+开浏览器,打印手机可访问的局域网地址
├─ Check_检查.bat                  一键体检(调用 tools/check-all.mjs)
├─ README.md                    ✍ 用户文档中文源(插件计数标记由 gen-plugins 自动刷新)
├─ ARCHITECTURE.md              ✍ 目录与架构总览(公开,中英双语)
├─ translations/                ⚙ README 十语译文(zh-TW/en/ru/es/pt/ja/ko/de/fr/vi,工作流翻译)
├─ .github/workflows/              GitHub Actions 五条
│  ├─ custom-build.yml             ★核心:Issue 构建 + 隐藏 smoke 触发;独立固件 + 四类辅助产物
│  ├─ cancel-build.yml             Issue 提交者用 /cancel 取消自己的构建
│  ├─ sync-upstream.yml            每周同步上游:机型目录/种子/插件表/说明页,有 diff 才自动提交
│  ├─ mirror-upstream.yml          每月镜像上游仓库防删库(需 secrets.MIRROR_TOKEN)
│  └─ smoke-all.yml                一键触发三源隐藏最小构建(健康巡检)
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
│  ├─ build-config.mjs             仅隐藏 smoke 兼容生成
│  ├─ fetch-build-request.mjs      下载 GitHub Issue 附件(严格域名/数量/大小)
│  ├─ parse-request.mjs            载荷解析 + 固定 Catalog/源码契约 + 共享引擎严格校验
│  ├─ validate-catalog-config.mjs   Defconfig/覆盖项后复用同一引擎做构建前校验
│  ├─ check-all.mjs                一键体检;check-drift.mjs 上游漂移哨兵
│  ├─ sync-blog.mjs                Unicode 安全逐文件镜像(分块哈希、原子替换与失败回滚)
│  └─ serve.mjs                    本地静态服务器(监听 0.0.0.0:8642)
├─ docs/                           上传的开发者文档(仅此二件)
│  ├─ DEVELOPER.md                 本指南(纯中文)
│  └─ DEVELOPER.en.md              英文版(逐轮同步)
└─ docs-private/                🔒 私有文档(gitignore,永不上传)
   ├─ AI交接指南.txt               交接必读(规矩/坑/债务/进行中工单)
   ├─ 定制器-最终方案.txt          As-Built 规格书(每轮整体刷新)
   ├─ 方案记录.txt                 全部修订历史(只追加)
   ├─ 部署与同步.md                部署运维(私有域名等)
   ├─ 翻译对照表.md              ⚙ 11 语对照表(gen-i18n 产出)
   └─ temp/                        改动暂存区(backup/=原件备份;弄完才移回正式位置)
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

深色有两份定义(`html[data-theme="dark"]` 手动 + `@media prefers-color-scheme` 自动),**改色要两处同步**。
字号体系:正文 17px(紧凑档 15.5px,Aa 按钮切换),胶囊/插件/组头 15px,提示 14px。
响应式断点:860px / 560px / 400px;插件网格 `repeat(auto-fill, minmax(150px,1fr))`(紧凑档 126px)。

### 2.2 界面文案与多语言

- 中文源:`tools/i18n-source.json`(唯一手改入口,`{x}` 占位符别动)
- 其他 10 语:`tools/i18n-translations.json`(含繁中)
- 改完跑 `node tools/gen-i18n.mjs` → 产出 `site/wrt/data/i18n.json` + `docs-private/翻译对照表.md`
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
- Catalog 以源码 `.packageinfo`/Kconfig 英文为权威名称。Advanced 搜索只索引软件包/选项名称及名称译文，不索引 symbol、路径、用途或长说明。普通项固定一行：左侧 ID 去掉 `CONFIG_PACKAGE_`，中间说明靠右并单行省略，N/M/Y 固定最右。悬浮、聚焦或轻触 ID/说明显示完整 `CONFIG_*`、当前语言说明、上游英文和菜单路径，弹层不得覆盖 N/M/Y，且不加“中文/English/Index/Path”前缀。工具栏继续保持单行。
- Catalog schema 6 将每个分支拆为 `core`、`graph`、`menu`、`hidden`、`help` 和当前语言菜单分片。首次选择分支只并行下载 `core + graph`；展开 Advanced 才下载可见菜单与当前语言，首次搜索再补隐藏显示信息，用户点击被截断的完整说明时才下载长 Help。`graph` 使用 relations schema 3 紧凑数组；schema 5 单体只作为迁移回退。Advanced 每次状态变化递增 revision，Target 上下文、表达式 token、可见性和最大 N/M/Y 等级按 revision 复用；搜索索引在 Worker 中一次建立，输入经 180 ms 防抖，主线程只接收 symbol ID。默认搜索不纳入长 Help，菜单一次最多渲染 80 行并按滚动分页，避免巨大 Catalog 反复创建全部 DOM。
- Advanced 普通项无论是否截断都可打开统一详情弹层；英文界面同样可查看完整 CONFIG symbol、英文说明和路径，其他语言额外显示真实译文。Source/Branch 加载、Catalog commit/hash/bytes 校验、schema 6 分片与 VPS 无 Catalog 的部署约束保持不变。
- 桌面使用悬浮/聚焦，手机轻触 ID 或说明打开详情；点击 N/M/Y 只改变状态。浮层宽度受当前行 N/M/Y 左边界限制。分类、choice、分页、搜索 Worker 和响应式控制继续按既有性能设计运行。
- 网页只接受 schema、commit、压缩字节数与 SHA-256 都符合 index 的 Catalog。新 `build-request` schema 5 同时保存 Catalog 仓库、不可变数据提交、分片名/字节数/SHA-256、Catalog/relations schema、上游仓库和上游源码 commit；Issue 解析必须下载同一提交中的同一分片并按该精确上游 commit 构建。schema 3/4 只作为历史请求兼容。`Top level` 固定为可回跳主菜单；精选 Applications 只是 UI 快捷入口，其可用性和所有依赖都由 Catalog 决定。
- Catalog 的 Publish 按分支校验当前结果。成功分支立即发布新分片；失败或校验损坏的分支隔离本轮结果并沿用 `catalog-data` 的 last-good，index 分别标为 fresh/stale/unavailable。部分失败时滚动目录仍更新、矩阵 Workflow 仍保持红色；只有所有分支都成功且通过校验时才更新完整 Release。
- Catalog 翻译任务使用工作流最小权限 `models: read`，默认每周增量处理 500 条文本；翻译警告写入 `translation-summary.json` 和 Publish Summary。人工表、上游英文与已经成功的目录发布不受模型故障影响。
- 360T7 最小 config 不携带完整 Kconfig 软件包表;开发者搜索所需三源状态保存在 `tools/package-baseline-360t7.json`,由 `gen-plugins` 合并生成 `packages.json`。
- **config 文件里的注释一律保留,不许删**——前端与 CI 都只做行替换

### 2.5 构建链路

- Catalog Target 的 `arch`、`archPackages` 与 Target/Profile 身份仍是原子构建契约。Profile 声明包改为紧凑管理列表，默认“跟随上游”不写显式值；只有用户逐项选择“加入”或“排除”时才写 `y`/`n`。提交配置仅在 Defconfig 前进行通用 Catalog 检查；用户勾选后运行一次官方 `make defconfig`，成功输出不再接受项目自定义 post-defconfig 验证。`tools/apply-config-overrides.mjs`、`tools/config-overrides.mjs` 与 `system-overrides.json` 已删除，不再强制 `CONFIG_DEVEL`/`CONFIG_BUILD_LOG`。

- Catalog 选择状态保持基础、推荐、用户覆盖、自动依赖与导入来源层。`catalogDependencySymbols` 只记录引擎自动带入项；关闭插件后，引擎可清理其中不再被任何启用项需要的条目，但 `catalogBaselineValues`、`catalogRecommendedValues`、`catalogImportedSymbols` 和非 `n` 的 `catalogUserOverrides` 均为保护层。Profile 包覆盖另以稀疏 `profilePackageOverrides` 保存，仅记录用户改成 Include/Exclude 的少量条目。

- `.github/workflows/custom-build.yml`:网页用户只通过 Issue 附件构建；`Smoke All` 通过隐藏 `repository_dispatch` 触发兼容构建，因此 Actions 不再展示旧手动参数表单。Issue 标题使用 `[build] 请求时间戳/构建标识/Target/Source/Branch/Profile`；解析器把 `build_ref` 规范化为 `请求时间戳-构建标识`。每个上游 `.img.gz` 以该前缀加原文件名作为独立、无 ZIP 外壳的 Artifact，辅助资料相应命名为 `请求时间戳-构建标识-CONFIG`、`BUILD-LOGS`、`OPTIONAL-PACKAGES`、`FIRMWARE-OTHER`。时区、主题、NTP、opkg 在提交配置、Summary、`firmware-settings.txt` 与固件内 `/etc/weig-build-info` 交叉核验；固件/config 保留 30 天，完整日志保留 14 天。
- 软件源镜像由 `diy2-generic.sh` 自动兼容：旧版 opkg 源改写 `distfeeds.conf`；APK 源（25.12+）改写构建期 `VERSION_REPO`，由源码生成 `distfeeds.list`。网页选择 `Asia/Shanghai` 时，如果用户尚未手动选择镜像，会默认选取当前 Source 第一个可用的中国内地镜像；切换 Source 时重新验证可用性。`check-all` 必须保证全部现行 Source（ImmortalWrt、OpenWrt、lede）至少有一个中国内地镜像。不要把 APK 的生成文件当作源码内固定文件。
- 构建准入默认限制每位提交者同时最多 2 个排队中或运行中的任务；第 3 个 Issue 会自动回评并关闭。仓库所有者按 GitHub 登录名识别，不受此上限限制，并为每次构建使用独立并发组，不会在本项目队列中互相等待。Fork 可在仓库 Variables 设置正整数 `MAX_BUILDS_PER_USER` 覆盖默认值。`cancel-build.yml` 只接受原 Issue 提交者的 `/cancel` 或 `/cancel-build`，先普通取消，15 秒未结束才强制取消；管理员仍可在 Actions 页面管理任意任务。
- 根目录 `VERSION` 是仓库与网页共用的分钟级 `vYYMMDDHHmm` 版本源；`site-version.json` 是静态部署副本。Actions Summary 同时记录 VERSION、请求网页版本、定制器 commit、上游 commit 和完整输入参数。
- 下载与并行编译使用动态并发并保留完整日志；并行失败后执行 `make -j1 V=s BUILD_LOG=1`，无需修改 `.config` 即请求上游分包日志。浏览器、`parse-request.mjs` 与 `validate-catalog-config.mjs` 共用 Catalog 引擎，但 CI 只验证提交配置一次；post-defconfig 模式已删除。网页自动执行强依赖、`select`、choice 与反向失效关闭，不自动执行弱 `imply` 或猜测多 provider。人工 `config-rules` 兼容层本轮保持不变。
- `config/001.presets/source-build-requirements.json` 是 Source/Branch/Target 构建必需项的唯一维护源，`site/wrt/data/source-build-requirements.json` 只是静态网页副本。范围字段支持 `sources`、`branches`、`systems`、`subtargets`、`profiles` 与通配符 `*`；每项只声明明确的 Kconfig `symbol` 和 `n/m/y` 值。网页允许单独下载未补项的 `.config` 供用户编辑，但下载构建请求 JSON 前必须弹窗说明并由用户明确应用；`parse-request.mjs` 使用同一源二次检查，缺项请求在克隆上游前直接拒绝。维护新源只改权威 JSON 并同步网页副本，不得在 Workflow 或插件 JS 中另写特判。
- schema 5 解析器先按请求中的不可变 Catalog revision/asset/hash/bytes 取得同一分片，核验 Source/Branch/Target/Profile、架构、白名单和提交前标准关系，再输出 Catalog 的 `sourceCommit`。Workflow 获取该精确 commit；可选官方 Defconfig 成功后直接进入编译，不再调用共享引擎做后置否决，也不执行系统配置覆盖。
- `custom-target` 不要求 Profile 预先存在于仓库清单；上传配置中的通用 Target 选择直接作为构建输入，不含 360T7 专用限制，其可用性由所选上游源码负责。
- 全部版本化 base config 默认关闭 PassWall/SSR Plus/VSSR/TinyProxy 及其代理内核/子选项;`check-all.mjs` 会在任一默认 config 出现代理 `CONFIG_PACKAGE_*=y/m` 时直接失败。config 预检把实际开编配置中已选中的代理相关符号写入 `proxy-selected.txt` 和 Summary,用户主动选择时仍可按正常依赖加入
- `tools/parse-request.mjs`:全字段白名单(机型/源/版本/变体/插件±前缀/原始软件包/登录地址/初始密码/时区/主题/NTP/opkg)。新手 Issue 只显示一个必填附件框并推荐网页 JSON;解析器仍接受 1~3 个 GitHub 自有附件并识别 JSON、`.config`、`config.buildinfo`,但无网页元数据头的原始配置必须先回网页加载识别。
- Issue 正式链路不调用 `build-config.mjs`:前端 `applyToConfig()` 生成完整 config → 附件 → `submitted.config` → `openwrt/.config`;`build-config.mjs` 只保留给内部 smoke 的隐藏 `repository_dispatch` 兼容入口。
- 时区表在 `site/wrt/data/timezones.json`,来源为 OpenWrt LuCI 的 445 项映射。组合框默认只列约 70 个常用城市并按当前 UTC 偏移从 `UTC-12` 到 `UTC+14` 排序；输入搜索时仍查询完整 445 项，`北京`/`北京时间` 只作为 `Asia/Shanghai` 搜索词，不写入显示值。首次访问且没有用户保存值或导入配置时，优先采用浏览器报告的 IANA 时区；手动选择会保存到本机。前端提交 IANA `zonename`,解析器映射并输出 POSIX `timezone`;三个 diy2 脚本用 `files/etc/uci-defaults/10-weig-timezone` 同时写入两项。控件统一为 44px 高，旧 POSIX 请求继续兼容。
- Actions 的全局 `TZ` 只控制 Runner 进程日志时间；不要在 GitHub 托管 Runner 调用 `timedatectl set-timezone`，该操作可能因 systemd 权限被拒绝并让依赖安装步骤失败。固件时区始终由请求字段和 diy2 首启脚本写入，与 Runner 系统时区无关。
- diy 脚本按源区分:官方源用 `diy2-openwrt.sh`,lede 用 `diy2-lede.sh`(都不能复用 ImmortalWrt 系的)
- `sync-upstream.yml` 每周六 18:37 UTC 自动同步上游并提交;`check-drift.mjs` 只检查通用 OpenWrt 分支策略并在漂移时开 issue;`mirror-upstream.yml` 每月镜像(需 `secrets.MIRROR_TOKEN`);`smoke-all.yml` 一键触发三源隐藏最小构建。
- `site-version.yml` 监听 `site/wrt/**` 与 `VERSION` push,按内容指纹同时更新根 `VERSION` 和 `site-version.json`，由机器人一次提交；解析器继续接受旧 `vYYMMDDHH` 请求。桌面端版本号位于“加载配置”左侧，560px 以下改在页脚右侧；`github.actor` 条件防止提交循环。

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
| `docs-private/方案记录.txt` | ❌ | 历史修订记录(逐轮追加) |
| `docs-private/定制器-最终方案.txt` | ❌ | As-Built 规格书(每轮整体刷新) |
| `docs-private/翻译对照表.md` | ❌ | 生成物,人工校对用 |
| `docs-private/部署与同步.md` | ❌ | 部署运维(域名/CDN 等私有信息) |

### 2.7 部署与迁移

- 页面整个 `site/wrt/` 目录拷走即可用；Catalog 使用精确缓存 → GitHub Raw 最新 index → jsDelivr/GitHub Raw 固定提交分片 → 完整 GitHub Release，VPS 不保存 Catalog；其他静态数据使用相对路径和本地优先降级。`OpenWebPage_打开网页.bat` 只保留一个可见的 `wrt-server` 窗口，关闭该窗口即停止本地预览。
- 浏览器动态导入的 Catalog 模块固定为 `lib/catalog-engine.js`、`lib/catalog-loader.js` 与 `lib/catalog-schema6.js`，Advanced 搜索使用 `lib/catalog-search-worker.js`。使用 `.js` 是为了直接复用普通静态服务器已有的 JavaScript MIME 映射；`lib/package.json` 的 `type: module` 只负责 Node/CI 导入。旧 `.mjs` 必须删除，部署脚本在打包、远端切换和切换后 HTTP 冒烟三个阶段校验四个脚本；返回非 JavaScript MIME、HTML 回退或缺文件都会恢复上一版。部署包清单统一由 `tools/verify-site-archive.mjs` 以 `shell: false` 调用 `tar` 并一次验证必需/禁止条目，BAT 禁止使用 `tar | findstr`，因此中文、空格路径和 CMD 括号上下文不会改变参数解析。
- Fork 后只需修改 `site/wrt/data/project.json` 的主仓库、Catalog 仓库与博客地址；网页链接、Issue 目标和运行时 Catalog 会自动采用该文件。HTML 中保留的人类可读链接仅是旧部署兜底。
- 博客副本：`node tools/sync-blog.mjs [博客路径]` 会把 `site/wrt/` 完整精确镜像到博客 `source/wrt/`，包括 `.config` 和空目录。实现不使用 `fs.cpSync()`，而是按 Catalog 无关的通用目录树逐目录创建、逐文件复制，并以分块 SHA-256 校验临时副本后原子替换；中文、空格路径和大二进制文件使用同一逻辑，失败时保留或恢复旧副本。CLI 会输出复制进度；`--check` 仅比较完整目录树，完全一致返回 0，有差异返回 3。
- 文本格式门禁：`node tools/check-text-format.mjs <仓库路径> --changed` 只检查当前 Git 变更与未跟踪文本，按 `.gitattributes` 要求验证源码/数据为 LF、BAT/CMD/PowerShell 为 CRLF、UTF-8 无 BOM，且文件末尾只有一个换行；它只报告、不自动改写。`Sync_Deploy.bat` 的主仓库选项会在完整 `check-all` 和 `git diff --check` 前先运行该门禁，Git 的“下次将 CRLF 转为 LF”提示只是信息性 warning，真正阻断项会单独列出。

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
4. **smoke-all 一键三连发**:三条产线各来一个最小构建;
5. 全绿后再测花活:高级模式(`+homeproxy -turboacc`)、原始软件包(packages 填 `iptables-mod-ipp2p -iptables-mod-ipopt`)、`stock` 变体、自定义 lanip、`@empty` 密码。

#### 失败了怎么读日志

- **秒失败(几秒钟就红)**= 参数校验没过,看 run 日志里 `parse-request` 步骤的中文报错(会列合法选项);校验前没有编译日志是正常的;
- **下载或编译过程** = Actions 控制台实时显示原始输出，同时写入 `download.log` / `build.log`；若页面日志过长被 GitHub 截断，以 `BUILD-LOGS-…` artifact 内的完整文件为准;
- **编译阶段失败** = 下载 `BUILD-LOGS-…` artifact,按顺序看:
  1. `00-SUMMARY.txt`(**先看这个**):构建参数 + 报错关键字聚合计数 + 最后出错的 make 目标;
  2. `build-metadata.txt`:VERSION、两级 commit、参数与 v2ray 最终状态;
  3. `build-diagnostic.log`(**如存在**):失败后单线程 `V=s` 的优先诊断依据;
  4. `download.log` / `build.log`:完整原始输出;
  5. `errors.txt` / `tail-200.txt`:报错行摘录与结尾上下文;
  6. `package-logs.tar.gz`(**如存在**):某个包编译失败时看 `logs/<路径>/` 下对应日志;
  7. `final.config`:本次真实使用的完整配置,可拿去本地复现。
- 常见病因对照:`Package xxx is missing` = 该源 feed 没这个包(lede/官方源勾了社区插件、或高级模式强制勾选);`No space left` / 镜像超限 = 插件太多或 stock 变体容量不足;上游当日损坏 = 同参数隔天重跑或临时换版本分支。

#### 不等云编译的本地快速验证(秒级)

```bash
# 载荷校验(模拟 issue 提交,改 ISSUE_BODY 里的 JSON 即可)
node tools/parse-request.mjs   # 需先设 ISSUE_BODY 环境变量

# 生成最终 .config(与 CI 完全同规则,直接检查产物)
node tools/build-config.mjs --device 360t7 --source OpenWrt --version main --variant qihoo_360t7 --plugins "ttyd +homeproxy" --out %TEMP%\t.config

# 全仓库体检(语法/数据/一致性,含全部版本化 base config 的代理默认值扫描)
node tools/check-all.mjs
```

#### 其他实用常识

- 单发构建约 2~3 小时(无缓存);GitHub 免费并发约 20 job,smoke-all 四连发会并行跑;
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
