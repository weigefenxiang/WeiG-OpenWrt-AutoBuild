# 目录结构与技术架构 / Project Structure & Architecture

> 本文档可公开,随代码一起维护。/ Public document, maintained together with the code.

## 技术栈 / Tech stack

- 前端:纯 HTML5 + CSS3 + JavaScript(ES2020),零框架、零构建 / Frontend: vanilla HTML5 + CSS3 + JavaScript, no framework, no build step
- 工具链:Node.js(≥18,仅标准库) / Tooling: Node.js (≥18, standard library only)
- CI:GitHub Actions(YAML)+ Bash / CI: GitHub Actions (YAML) + Bash
- 数据:纯 JSON 文件,无数据库、无后端 / Data: plain JSON files, no database, no backend

## 目录结构 / Directory layout

```
├─ OpenWebPage_打开网页.bat      # 双击本地预览,带手机访问地址 / double-click local preview, prints phone URL
├─ ARCHITECTURE.md               # 本文档 / this document
├─ README.md + translations/     # 多语言说明 / multilingual READMEs
├─ .github/workflows/
│  ├─ custom-build.yml           # Issue 附件权威构建 + 隐藏 smoke 兼容 / authoritative Issue attachment + hidden smoke compatibility
│  └─ cancel-build.yml           # Issue 作者 /cancel 取消自己的构建 / Issue-author-only build cancellation
├─ config/<品牌>/<机型>/          # base 配置,按品牌分层 / base configs, grouped by brand
│  └─ 360/360t7/*.config         # 360T7 源码/分支/Profile 独立配置 / per-source, branch and profile configs
├─ Shell/                        # diy 脚本(默认 IP/时区/驱动替换) / diy scripts (defaults, driver swaps)
├─ site/wrt/                     # 定制页面,整目录可搬家 / the customizer page, fully portable
│  ├─ index.html / app.css / app.js
│  ├─ lib/catalog-engine.js     # 浏览器/Node 共用的 Catalog 规则解释器 / shared Catalog rule engine for browser and Node
│  ├─ lib/catalog-loader.js     # 浏览器 Catalog 分片下载/缓存/校验器 / split Catalog fetch/cache/validation loader
│  ├─ lib/catalog-schema6.js    # schema 6 显示分片合并器 / schema-6 display-shard merger
│  ├─ lib/catalog-search-worker.js # Advanced 搜索 Worker / Advanced search worker
│  ├─ lib/package.json          # 仅把 lib/*.js 标记为 Node ESM / scopes lib/*.js as Node ESM only
│  └─ data/                      # 页面与 CI 共用的数据 / data shared by page and CI
│     ├─ project.json            # Fork 只需改这一份仓库参数 / one-file fork settings
│     ├─ devices.json            # CI/历史请求注册表(网页不加载) / CI and legacy-request registry (not loaded by the page)
│     ├─ menuconfig-index.json   # 独立 menuconfig 目录的本地入口与回退 / local entry and fallback for the external menuconfig catalog
│     ├─ i18n.json               # 11 语言 UI 词条(fallback: en) / 11-language UI strings
│     ├─ timezones.json          # 445 个 LuCI IANA→POSIX 时区映射 / 445 LuCI IANA-to-POSIX timezone mappings
│     ├─ seed/plugins.json       # Catalog/custom-target 共用插件表 / shared Catalog/custom-target plugin table
│     └─ 360t7/{plugins,packages}.json # 完整维护机型索引 / full-maintenance device indexes
└─ tools/                        # Node 工具链 / Node tooling
   ├─ plugins-meta.json          # 插件元数据,人工维护 / plugin metadata, hand-maintained
   ├─ plugin-sizes.json          # 360T7 官方包体积快照 / official-package size snapshot for 360T7
   ├─ i18n-source.json           # 中文词条源表 / Chinese source strings
   ├─ i18n-translations.json     # 9 语译文 / translations
   ├─ device-catalog.json        # 三源分支/机型/Profile 目录 / three-source branch/device/profile catalog
   ├─ package-baseline-360t7.json # 360T7 三源完整软件包快照 / full active-source package snapshot
   ├─ gen-plugins.mjs            # config × meta → plugins.json
   ├─ gen-i18n.mjs               # 词条校验合并 → i18n.json / validate & merge strings
   ├─ gen-seed-configs.mjs       # 机型目录 → 版本化 Profile config / catalog → versioned profile configs
   ├─ fetch-build-request.mjs    # 下载并限制 GitHub Issue 附件 / fetch allowlisted GitHub Issue attachment
   ├─ parse-request.mjs          # 载荷、安全白名单、Target/Profile 身份与 Catalog 版本契约 / payload, safety allowlists, Target/Profile identity, and Catalog version contract
   ├─ check-text-format.mjs      # 变更文本 LF/CRLF/BOM/EOF 门禁 / changed-text LF/CRLF/BOM/EOF gate
   ├─ sync-blog.mjs              # Unicode 安全逐文件镜像+分块哈希回滚 / Unicode-safe iterative mirror + chunked-hash rollback
   └─ serve.mjs                  # 本地静态服务器 / local static server
```

## 数据流 / Data flow

```
config/*.config + plugins-meta.json + plugin-sizes.json ──gen-plugins──▶ site/wrt/data/seed/plugins.json + 360t7/{plugins,packages}.json
i18n-source.json + i18n-translations.json ──gen-i18n──▶ site/wrt/data/i18n.json
上游分支 makefile ──fetch-catalog──▶ 分支/Profile 目录 ──gen-seed-configs──▶ devices.json + 独立种子 config
独立 WeiG-OpenWrt-Menuconfig-Catalog 按清单扫描 ImmortalWrt、OpenWrt、Lean LEDE 与 hanwckf 兼容源的 Config.in/.targetinfo/.packageinfo ──▶ 按 Kconfig symbol 合并声明并发布 Target、菜单、隐藏项、必需依赖、choice/select/conflict/provides 与反向索引 ──▶ `site/wrt/lib/catalog-engine.js` 在浏览器和 Node 中解释同一份 Catalog。`app.js` 的 `applyCatalogIntent()` 仅把用户 N/M/Y 操作交给引擎并同步 UI，不包含插件名或语言包特例。启用项目时只递归补齐能够唯一确定的强依赖和 `select`；关闭依赖时递归关闭失效依赖者；关闭项目时清理仅由自动依赖层带入、已无使用者且未被基础/推荐/导入/用户层保护的孤立依赖。`imply`、多 provider 和 deferred 条件不由网页猜测。后端不再用 Catalog 扫描整份 `.config` 的插件依赖、choice 或冲突；仅保留请求安全白名单、固定 Catalog/源码版本契约以及最小 Target/Profile 身份核对。用户勾选时运行官方 `make defconfig`，未勾选时直接采用提交配置；两种路径都不再写入 `CONFIG_DEVEL`/`CONFIG_BUILD_LOG`。Profile 软件包只作为 Catalog 可读列表展示，默认“跟随上游”不写显式值，用户可逐项加入或排除。网页仍按固定提交/hash/bytes 校验和加载 Catalog 分片，VPS 不保存 Catalog。
The separate WeiG-OpenWrt-Menuconfig-Catalog scans manifest-selected ImmortalWrt, OpenWrt, Lean LEDE, and hanwckf branches, merges declarations by Kconfig symbol, and publishes Targets, menus, hidden records, mandatory dependencies, choices, selects, conflicts, providers, and reverse indexes. `site/wrt/lib/catalog-engine.js` interprets that single Catalog in both browser and Node. `applyCatalogIntent()` in `app.js` is only a UI adapter: it submits a user N/M/Y intent to the engine and synchronizes state, without plugin-name or translation-package exceptions. Enabling an item recursively adds only uniquely determined mandatory dependencies and `select` targets; disabling a dependency recursively disables invalid dependents; disabling an item prunes only auto-added dependencies that have no remaining consumer and are not protected by baseline, recommended, imported, or explicit user state. The page does not guess `imply`, multiple-provider, or deferred relationships. The backend no longer scans the complete `.config` for Catalog package dependencies, choices, or conflicts. It keeps only request-safety allowlists, pinned Catalog/source contracts, and minimal Target/Profile identity verification. Optional upstream `make defconfig` is the only backend configuration resolver; when it is disabled, the submitted config is used directly. Neither path writes `CONFIG_DEVEL` or `CONFIG_BUILD_LOG`. Profile packages are an informational Catalog list: Follow upstream writes nothing, while users may explicitly Include or Exclude individual rows. Catalog assets remain commit/hash/bytes pinned and are never stored on the VPS.
网页不再加载旧设备注册表或公共 base config;`devices.json`、`config-manifest.json` 与 `config/` 权威配置仅由 CI、生成工具和历史请求兼容链使用。新请求按 Target 生成完整 `build-request.json`,Issue 构建以其中 `.config` 为权威输入。
The page no longer loads the legacy device registry or public base configs. `devices.json`, `config-manifest.json`, and authoritative configs under `config/` are retained only for CI, generators, and legacy-request compatibility. New Target requests export a complete `build-request.json`, whose `.config` remains authoritative for Issue builds.
上传配置先等待对应源码/分支 Catalog,再恢复 Target 和已知 menuconfig;Catalog 未收录项保留在分页的导入工作区中,可修改、关闭、删除行或恢复原值。未收录 Target 保持为明确的 `custom-target`,不再静默切换到目录首项。Catalog 以源码英文为权威名称，人工表维护精选应用 11 语，发布阶段按英文内容指纹复用翻译缓存并增量补译所有菜单层级、choice 和普通选项；缺译回退英文并写入覆盖报告，翻译故障不阻断目录发布。
An uploaded config waits for the matching source/branch catalog before restoring the Target and known menuconfig values. Uncatalogued symbols remain editable in a paged import workspace, while an unknown Target stays an explicit `custom-target` instead of silently falling back to the first catalog entry. Upstream English is authoritative; reviewed tables carry curated Applications in 11 languages, while the publish stage reuses content-keyed translations and incrementally translates menu levels, choices, and ordinary options. Missing locales fall back to English and remain visible in coverage reports; translation failures do not block catalog publication.
```

## D102 页面控制与构建身份 / UI controls and build identity

Catalog 顶部定位框与 Advanced 搜索是两条独立索引：前者只覆盖 Source、Branch、Target System、Subtarget、Target Profile；后者只覆盖软件包/选项名称及名称译文，不读取说明、路径或 CONFIG symbol。Advanced 每项固定一行：左侧显示去掉 `CONFIG_PACKAGE_` 的 ID，中间靠右显示当前语言说明与上游英文，最右 N/M/Y 固定不被文本或弹层遮挡。悬浮、聚焦或轻触 ID/说明时显示完整 `CONFIG_*`、当前语言说明、英文说明和菜单路径，不带“中文/English/Index/Path”前缀。`Top level`、名称搜索、Selected only、Origin 与 `N/M/Y ?` 保持同一横向工具栏。

The Catalog locator and Advanced search use separate indexes. The locator covers only Source, Branch, Target System, Subtarget, and Target Profile; Advanced indexes only package/option names and localized names, never descriptions, paths, or CONFIG symbols. Every Advanced option stays on one row: the left column shows the ID without `CONFIG_PACKAGE_`, the flexible right-aligned middle shows locale text plus upstream English, and fixed N/M/Y controls remain unobstructed. Hover, focus, or tap on the ID/description shows the full `CONFIG_*` symbol, locale text, English text, and menu path without labels such as Chinese, English, Index, or Path. `Top level`, name search, Selected only, Origin, and `N/M/Y ?` remain one horizontal toolbar.

选择 `Asia/Shanghai` 且用户未手动选择镜像时，前端从当前 Source 的中国内地镜像白名单中选择第一个可用项；设备清单与 Catalog 清单中的每个现行 Source 都必须至少有一个中国镜像。hanwckf 的 `openwrt-21.02` 兼容源继续复用 USTC/PKU 的 ImmortalWrt 镜像路径。Issue 标题把构建标识放在请求时间戳后，解析器生成 `请求时间戳-构建标识` 的 `build_ref`，因此 CONFIG、日志和固件 Artifact 共用该前缀。

With `Asia/Shanghai`, and before an explicit mirror choice, the frontend selects the first available Mainland China mirror for the current Source; every active Source from both the device registry and Catalog index must expose at least one China mirror. The hanwckf `openwrt-21.02` compatibility source continues to reuse the USTC/PKU ImmortalWrt mirror paths. The Issue title places the build tag after the request timestamp, and the parser emits `request-stamp-build-tag` as `build_ref`, so CONFIG, log, and firmware Artifacts share that prefix.

## Catalog 选择状态 / Catalog selection state

Catalog Target 页面把当前配置拆成四个语义层，而不是把所有 `y/m` 软件包都算作用户插件：

- `baseline`：Target/Profile 契约与在完整 Target 上下文中成立的上游 Kconfig 默认值；
- `recommended`：最低启动、默认主题等网页推荐预设；
- `userOverrides`：用户明确启用、排除或修改的值；
- `resolved`：前三层叠加后由共享 Catalog 引擎补齐或清理依赖得到的最终状态。

精选插件计数只读取 `userOverrides`，首次选定 Target/Profile 时保持 0；上游默认、推荐、依赖、导入、用户选择和明确排除仍作为来源层展示。Profile 声明包不再锁定或自动写入，而是在“Profile 软件包”紧凑列表中默认跟随上游，用户可单独选择加入/排除。取消插件时只清理无其他使用者且非用户明确选择的自动依赖。

The Catalog Target page separates the effective configuration into four semantic layers instead of counting every `y/m` package as a user-selected plugin:

- `baseline`: the Target/Profile contract plus upstream Kconfig defaults that are satisfied in the complete Target context;
- `recommended`: web presets such as minimum-boot and the default theme;
- `userOverrides`: values explicitly enabled, excluded, or edited by the user;
- `resolved`: the effective state after the shared Catalog engine applies dependency closure to those layers.

The curated-plugin counter reads only `userOverrides`, so a newly selected Target/Profile starts at zero. Upstream defaults, recommendations, dependencies, imports, explicit selections, and exclusions remain visible origin layers. Profile-declared packages are no longer locked or automatically written; a compact Profile packages manager defaults every row to Follow upstream and lets the user explicitly Include or Exclude it. Disabling a plugin prunes only auto-added dependencies that have no remaining consumer and were not explicitly selected.

## 构建链路 / Build pipeline

Target/Profile 是后端唯一核对的 `.config` 身份：配置必须且只能选择请求中的目标设备/Profile。`arch`、`archPackages` 与 Profile 包仅作展示/构建元数据，不再作为后端拒绝条件。Profile 包默认 Follow upstream 不写配置，只有用户 Include/Exclude 才生成对应 `CONFIG_PACKAGE_*`。 / Target/Profile is the only `.config` identity checked by the backend: the config must select exactly the requested device/Profile. `arch`, `archPackages`, and Profile packages remain display/build metadata, not rejection conditions. Follow upstream writes no package value, while explicit Include/Exclude actions emit `CONFIG_PACKAGE_*`.

1. 页面在未勾选 Defconfig 时静默补入前端构建标志 `CONFIG_HAVE_DOT_CONFIG=y`，然后下载含完整 `.config` 的 `build-request.json` 并打开 Issue；后端不因该标志缺失而拒绝请求 / when Defconfig is disabled, the page silently adds the frontend build marker `CONFIG_HAVE_DOT_CONFIG=y`, then downloads a request containing the complete `.config`; the backend does not reject a request because this marker is missing
2. 新手 Issue 只有一个必填附件框:上传网页生成的 `build-request.json` 即可;已有 `.config` / `config.buildinfo` 先由网页识别并包装。解析器仍兼容带网页元数据头的原始配置 / the beginner Issue has one required attachment field: upload the web-generated `build-request.json`; existing configs are identified and wrapped by the page first, while the parser remains compatible with raw configs carrying web metadata
3. schema 5 请求按固定 Catalog index 中的版本契约核对源码 commit，并复制 `submitted.config`。解析器只核对安全白名单与最小 Target/Profile 身份，不判断插件依赖、人工兼容规则、架构派生字段、主题包或构建必需项。用户勾选时运行一次官方 `make defconfig`；未勾选时直接进入下载/编译。并行编译失败后使用 `make -j1 V=s BUILD_LOG=1` 生成详细诊断日志 / schema-5 requests verify the pinned source commit through the fixed Catalog index and copy `submitted.config`. The parser checks only safety allowlists and minimal Target/Profile identity; it does not judge plugin dependencies, manual compatibility rules, derived architecture fields, theme-package state, or build requirements. Optional upstream `make defconfig` runs only when requested; otherwise download/compile starts directly. Failed parallel compilation retries with `make -j1 V=s BUILD_LOG=1`.
4. 先核验固件设置快照并上传 config + build-metadata artifact(编译失败也能拿到)→ 下载与编译按 CPU+1 动态并发,原始输出实时显示并完整写入日志；时区/主题/NTP/opkg 同时写入固件内 `/etc/weig-build-info` / verify the firmware-settings snapshot and upload config + build metadata first; downloads and compilation use CPU+1 dynamic concurrency, streaming raw output live while recording timezone/theme/NTP/opkg in `/etc/weig-build-info`
5. Catalog 标准关系只在网页交互层由共享引擎处理；人工 `config-rules`、后端整配置 Catalog 校验和隐藏 smoke 配置生成器均已删除。后端不重复推断插件依赖，最终解析由可选的官方 Defconfig 或上游构建系统完成。并行编译失败时以 `make -j1 V=s BUILD_LOG=1` 生成诊断，仍失败才结束并上传日志 / Catalog-standard relations are handled only by the shared browser interaction engine. Manual `config-rules`, backend whole-config Catalog validation, and the hidden smoke config generator are removed. The backend does not re-infer package dependencies; optional upstream Defconfig or the upstream build system resolves the final configuration. A failed parallel build uses `make -j1 V=s BUILD_LOG=1` for diagnostics before failing and uploading logs.
6. `site-version.yml` 在 `site/wrt/**` 或 `VERSION` push 后按内容指纹同步根 `VERSION` 与静态 `site-version.json`；旧八位请求继续兼容，actor 条件阻断机器人提交循环 / site-version automation keeps root `VERSION` and static `site-version.json` together, accepts legacy eight-digit requests, and prevents bot-commit loops

固件时区由 `timezones.json` 同时输出 IANA `zonename` 与 OpenWrt POSIX `timezone`;三条源码通过首启脚本写入两项。/ Firmware timezone selection emits both the IANA `zonename` and OpenWrt POSIX `timezone`; all three source pipelines apply both on first boot.

## 部署 / Deployment

- 主站 / primary: `site/wrt/` → 任意静态托管 / any static hosting
- 浏览器模块 / browser modules: Catalog 共享模块统一使用 `.js`，沿用静态服务器默认 JavaScript MIME；`site/wrt/lib/package.json` 仅让 Node 把这些 `.js` 解释为 ESM。部署包必须包含两模块且不得残留旧 `.mjs`，切换后通过真实 HTTP MIME/HTML 冒烟，否则回滚 / Catalog shared modules use `.js` so ordinary static-server JavaScript MIME applies; the scoped package file is only for Node ESM interpretation. Deployments require both modules, reject legacy `.mjs`, and roll back when live HTTP MIME/body smoke checks fail
- 备用 / mirror: `sync-blog.mjs` 将 `site/wrt/` 以 Unicode 安全的逐目录/逐文件复制完整镜像到博客 `source/wrt/`（Hexo skip_render，含 `.config`/空目录，删除目标残留，以分块 SHA-256 验证临时副本后原子替换）→ Cloudflare Pages / Unicode-safe iterative exact mirror of `site/wrt/` into blog `source/wrt/`, including `.config`/empty directories, stale-file removal, chunked SHA-256 staging verification, atomic swap, and rollback
- 提交前文本门禁 / pre-commit text gate: `check-text-format.mjs --changed` 按 `.gitattributes` 检查本轮变更的 LF/CRLF、UTF-8 无 BOM 与单一 EOF 换行，只报告不改写；`Sync_Deploy.bat` 主仓库操作在 `check-all` 前调用 / validates changed-file LF/CRLF, no-BOM UTF-8, and one final newline before `check-all`, without rewriting files
- Catalog 运行时数据链 / Catalog runtime data chain: 精确缓存 exact cache → GitHub Raw 最新 index latest index → jsDelivr/GitHub Raw 固定提交分片 pinned-commit shard → 完整 GitHub Release complete Release；VPS 不保存 Catalog，其他静态数据仍使用同目录优先的降级链 / other static data still prefers same-directory fallbacks

## Catalog schema 6 与 Advanced 性能 / Catalog schema 6 and Advanced performance

Catalog 运行时不再把 Target、完整关系、菜单、隐藏说明、长 Help 和所有语言塞进一个对象。浏览器初始只取 `core + graph`；Advanced 按需加载 `menu`、当前语言、隐藏显示信息和 Help。`graph` 使用 relations schema 3 的字符串/表达式池、数组记录、位标志和整数邻接表；旧 schema 5 单体在迁移期仅作回退。

The runtime no longer puts Targets, the full relation graph, display menus, hidden descriptions, long Help, and every locale into one object. Initial selection fetches only `core + graph`; Advanced lazily fetches menu, current-locale, hidden-display, and Help shards. The graph uses relations schema 3 string/expression pools, array records, bit flags, and integer adjacency lists; the schema-5 monolith is migration fallback only.

Advanced 在状态 revision 内复用 Target 上下文、表达式 token、可见性、最大状态和目录索引；搜索由独立 Worker 建立二元词索引并返回 symbol ID。默认搜索排除长 Help，显示列表按 80 行分页，避免每次展开或键入都重新扫描、解析并重建全部 DOM。

Within one state revision, Advanced reuses Target context, expression tokens, visibility, maximum state, and path indexes. A dedicated Worker builds a bigram search index and returns symbol IDs. Default search excludes long Help, and display is paged in bounded 80-row chunks so expansion and typing do not repeatedly parse and rebuild the entire DOM.

## D100 Catalog 运行契约与构建契约分离

Schema 6 浏览器运行时使用 `core + graph`，其关系模型为 Relations Schema 3；构建请求仍以 Schema 5 `legacy` 元数据锁定 Catalog/源码版本，但 GitHub Actions 不再下载该单体对整份 `.config` 做语义验证。`index.json` 的每个分支因此同时发布两类互不混用的契约：

- `assets.*`：浏览器运行分片；
- `legacy`：构建验证单体，包含 `asset/hash/bytes/catalogSchema/relationsSchema`。

网页生成 `build-request.json` 时只能从同一个 `branch.legacy` 对象读取资产、哈希、大小和两个 schema，禁止从 `MENU_CATALOG` 运行对象拼接 schema。解析器读取固定 index 中的 `legacy` 并逐字段核对请求，用于锁定版本而非插件依赖判定；不再下载或解压单体 Catalog。根级 `asset/hash/bytes` 仅作为迁移期旧客户端镜像。
