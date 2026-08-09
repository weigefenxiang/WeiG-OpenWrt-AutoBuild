# 目录结构与技术架构 / Project Structure & Architecture

> 本文档可公开,随代码一起维护。/ Public document, maintained together with the code.

## 技术栈 / Tech stack

- 前端:纯 HTML5 + CSS3 + JavaScript(ES2020),零框架、零构建 / Frontend: vanilla HTML5 + CSS3 + JavaScript, no framework, no build step
- 工具链:Node.js(≥18,仅标准库) / Tooling: Node.js (≥18, standard library only)
- CI:GitHub Actions(YAML)+ Bash / CI: GitHub Actions (YAML) + Bash
- 数据:纯 JSON 文件,无数据库、无后端 / Data: plain JSON files, no database, no backend

## 目录结构 / Directory layout

```
├─ OpenWebPage_打开网页.bat      # Local/Preview/Staging/Production 网页入口 / web environment launcher
├─ OpenWebPage.local.example.cmd # 本机 URL 配置空模板 / local-only URL template
├─ Promote_Release.bat           # exact SHA 晋级:确认后 push + 远端复验 / confirmed exact-SHA promotion + remote verification
├─ ARCHITECTURE.md               # 本文档 / this document
├─ README.md + translations/     # 多语言说明 / multilingual READMEs
├─ .github/workflows/
│  ├─ custom-build.yml           # E v2 exact-ref workflow_dispatch Build Worker / exact-ref workflow_dispatch Build Worker
│  ├─ cancel-build.yml           # Issue 作者 /cancel 取消自己的构建 / Issue-author-only build cancellation
│  ├─ build-dispatcher.yml       # E v2 生产 Issue 路由 + 手动 Probe/Worker canary / production Issue router + manual Probe/Worker canary
│  └─ build-routing-probe.yml    # E v2 手动只读 Worker 探针 / manual read-only routing probe worker
├─ config/<品牌>/<机型>/          # base 配置,按品牌分层 / base configs, grouped by brand
│  └─ 360/360t7/*.config         # 360T7 源码/分支/Profile 独立配置 / per-source, branch and profile configs
├─ Shell/                        # diy 脚本 + 通用软件包镜像框架 / diy scripts + shared package-mirror framework
├─ config/001.presets/package-mirrors.json # APK/OPKG 镜像唯一规范数据 / canonical APK/OPKG mirror rules
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
   ├─ parse-build-request-identity.mjs # E v2 探针只读 sourceEnv/requestCommit/requestId / routing-envelope-only parser
   ├─ parse-request.mjs          # 载荷、安全白名单、Target/Profile 身份与 Catalog 版本契约 / payload, safety allowlists, Target/Profile identity, and Catalog version contract
   ├─ check-text-format.mjs      # 变更文本 LF/CRLF/BOM/EOF 门禁 / changed-text LF/CRLF/BOM/EOF gate
   ├─ canonicalize-site-release.mjs # Prepare 前把 site/wrt 文本落盘为确定 LF/CRLF 发布字节 / canonical release bytes before hashing
   ├─ site-release.mjs           # site/wrt 原始字节的确定性全站 SHA-256；支持 --print/--check / deterministic full-site SHA-256 over raw deployable bytes
   ├─ sync-blog.mjs              # 当前树或 exact ref → 博客 exact mirror + siteSha256 证明 / current tree or exact ref → exact blog mirror + siteSha256 proof
   ├─ promote-release.mjs        # dev→staging→main FF-only 晋级事务 / FF-only exact promotion transaction
   ├─ prepare-web-deployment.mjs # 生成可选 Version/Commit/Branch/Built/siteSha256 元数据 / prepares release-bound deployment metadata
   ├─ prepare-site-deployment.mjs # 从 exact Git ref 打包 site/wrt / packages site/wrt from an exact Git ref
   ├─ gen-package-mirrors.mjs    # 生成网页精简镜像表 / generates the public mirror projection
   ├─ package-mirror-engine.mjs  # APK/OPKG 检测、回退与原子改写 / APK/OPKG detection, fallback and atomic rewrite
   └─ serve.mjs                  # 本地静态服务器 / local static server
```

Build environment identity is deployment metadata, not application configuration. `build-meta.branch` is generated from the deployment branch; `site/wrt/lib/build-identity.js` is the single naming authority shared by the browser and request parser. Every non-`main` branch adds the same sanitized branch identity to `[build]` Action titles and Artifact names; `main` remains unprefixed. The page bootstrap fetches `site-version.json` and `build-meta.json` together with a fresh no-store release check; `site-version.json` carries the deterministic full-site `siteSha256`, while `build-meta.json` must match that SHA plus version/branch/full commit before cloud submission can be enabled. No hostname or provider-specific branch detection belongs in `app.js`.
Before that asynchronous release bootstrap, every directly openable WRT HTML page runs the same tiny synchronous Theme Bootstrap. It resolves the saved `wrt_theme` (`light`/`dark`) or system `prefers-color-scheme` (`auto`) before first paint, sets the canvas background plus browser `color-scheme`/`theme-color`, and exposes the same apply helper used by `app.js`; this prevents a white first frame while release metadata and immutable assets are still loading. The package-reference generator emits the identical bootstrap so direct `packages.html` navigation follows the same contract.

## 数据流 / Data flow

```
config/*.config + plugins-meta.json + plugin-sizes.json ──gen-plugins──▶ site/wrt/data/seed/plugins.json + 360t7/{plugins,packages}.json
i18n-source.json + i18n-translations.json ──gen-i18n──▶ site/wrt/data/i18n.json
上游分支 makefile ──fetch-catalog──▶ 分支/Profile 目录 ──gen-seed-configs──▶ devices.json + 独立种子 config
独立 WeiG-OpenWrt-Menuconfig-Catalog 按清单扫描 ImmortalWrt、OpenWrt、Lean LEDE 与 hanwckf 兼容源的 Config.in/.targetinfo/.packageinfo ──▶ 按 Kconfig symbol 合并声明并发布 Target、菜单、隐藏项、必需依赖、choice/select/conflict/provides 与反向索引 ──▶ `site/wrt/lib/catalog-engine.js` 在浏览器和 Node 中解释同一份 Catalog。`app.js` 的 `applyCatalogIntent()` 仅把用户 N/M/Y 操作交给引擎并同步 UI，不包含插件名或语言包特例。启用项目时只递归补齐能够唯一确定的强依赖和 `select`；关闭依赖时递归关闭失效依赖者；关闭项目时清理仅由自动依赖层带入、已无使用者且未被基础/推荐/导入/用户层保护的孤立依赖。`imply`、多 provider 和 deferred 条件不由网页猜测。后端不再用 Catalog 扫描整份 `.config` 的插件依赖、choice 或冲突；仅保留请求安全白名单、固定 Catalog/源码版本契约以及最小 Target/Profile 身份核对。用户勾选时运行官方 `make defconfig`，未勾选时直接采用提交配置；两种路径都不再写入 `CONFIG_DEVEL`/`CONFIG_BUILD_LOG`。Profile 软件包只作为 Catalog 可读列表展示，默认“跟随上游”不写显式值，用户可逐项加入或排除。网页仍按固定提交/hash/bytes 校验和加载 Catalog 分片，VPS 不保存 Catalog。

Catalog 交互只报告本次操作产生的直接冲突，不再把整份配置的 `violations` 通过全局 Toast 展开。结构化 `CatalogIntentError` 交给网页主题冲突框，用户可在冲突项间选择最终 N/M/Y，再一次应用切换。顶部 Target 定位、“当前构建契约”和构建控制位于同一卡片；桌面默认严格一行三段：左侧定位框缩窄且用 `… Subtarget / Target Profile` 保留辨识度更高的尾部提示，中间契约保持原折叠标题，右侧 `推荐项/配置/Defconfig/Selected only/来源` 位于契约边框之外并整组不换行。契约展开后详情横跨整行，以 Source/Branch、Target/Subtarget、Profile/Packages、Catalog/Architecture 两列展示。导入器先严格 `JSON.parse`，仅对具有 WeiG schema/pageVersion/config/use_defconfig 特征的旧版损坏 JSON 安全恢复内嵌 `.config` 引号，不使用 `eval`，成功后提示重新导出标准 JSON。推荐项“配置”按钮保持固定位置，关闭推荐项时可见但禁用。
The separate WeiG-OpenWrt-Menuconfig-Catalog scans manifest-selected ImmortalWrt, OpenWrt, Lean LEDE, and hanwckf branches, merges declarations by Kconfig symbol, and publishes Targets, menus, hidden records, mandatory dependencies, choices, selects, conflicts, providers, and reverse indexes. `site/wrt/lib/catalog-engine.js` interprets that single Catalog in both browser and Node. `applyCatalogIntent()` in `app.js` is only a UI adapter: it submits a user N/M/Y intent to the engine and synchronizes state, without plugin-name or translation-package exceptions. Enabling an item recursively adds only uniquely determined mandatory dependencies and `select` targets; disabling a dependency recursively disables invalid dependents; disabling an item prunes only auto-added dependencies that have no remaining consumer and are not protected by baseline, recommended, imported, or explicit user state. The page does not guess `imply`, multiple-provider, or deferred relationships. The backend no longer scans the complete `.config` for Catalog package dependencies, choices, or conflicts. It keeps only request-safety allowlists, pinned Catalog/source contracts, and minimal Target/Profile identity verification. Optional upstream `make defconfig` is the only backend configuration resolver; when it is disabled, the submitted config is used directly. Neither path writes `CONFIG_DEVEL` or `CONFIG_BUILD_LOG`. Profile packages are an informational Catalog list: Follow upstream writes nothing, while users may explicitly Include or Exclude individual rows. Catalog assets remain commit/hash/bytes pinned and are never stored on the VPS.
网页不再加载旧设备注册表或公共 base config;`devices.json`、`config-manifest.json` 与 `config/` 权威配置仅由 CI、生成工具和历史请求兼容链使用。新请求按 Target 生成完整 `build-request.json`,Issue 构建以其中 `.config` 为权威输入。
The page no longer loads the legacy device registry or public base configs. `devices.json`, `config-manifest.json`, and authoritative configs under `config/` are retained only for CI, generators, and legacy-request compatibility. New Target requests export a complete `build-request.json`, whose `.config` remains authoritative for Issue builds.
上传配置先等待对应源码/分支 Catalog,再恢复 Target 和已知 menuconfig;Catalog 未收录项保留在分页的导入工作区中,可修改、关闭、删除行或恢复原值。未收录 Target 保持为明确的 `custom-target`,不再静默切换到目录首项。Catalog 以源码英文为权威名称，人工表维护精选应用 11 语，发布阶段按英文内容指纹复用翻译缓存并增量补译所有菜单层级、choice 和普通选项；缺译回退英文并写入覆盖报告，翻译故障不阻断目录发布。
An uploaded config waits for the matching source/branch catalog before restoring the Target and known menuconfig values. Uncatalogued symbols remain editable in a paged import workspace, while an unknown Target stays an explicit `custom-target` instead of silently falling back to the first catalog entry. Upstream English is authoritative; reviewed tables carry curated Applications in 11 languages, while the publish stage reuses content-keyed translations and incrementally translates menu levels, choices, and ordinary options. Missing locales fall back to English and remain visible in coverage reports; translation failures do not block catalog publication.
```

## D102 页面控制与构建身份 / UI controls and build identity

Catalog 顶部定位框与 Advanced 搜索是两条独立索引：前者只覆盖 Source、Branch、Target System、Subtarget、Target Profile；后者使用单一名称/symbol 搜索，覆盖完整 Kconfig symbol、`CONFIG_` 形式、软件包名、prompt/名称译文，并把下划线/横线规范化为空格以支持 `TARGET_ROOTFS_PARTSIZE`、`target rootfs partsize` 等等价查询；长 Help/description 与菜单路径不进入搜索，也不为搜索加载 help shard。Advanced 每项固定一行：左侧显示去掉 `CONFIG_PACKAGE_` 的 ID，中间靠右显示当前语言说明与上游英文，最右 N/M/Y 固定不被文本或弹层遮挡；ID、Search results 与来源徽章使用和 `Advanced menuconfig` 同档主字号，说明降一级。bool/tristate 交给 Catalog Intent Engine，string/int/hex 由 scalar editor 直接保存并校验。Advanced 顶部只保留完整可换行路径以及右侧搜索框 + `N/M/Y`（无问号）；`Selected only` 与 `Origin` 已移到上方契约框外的独立构建控制组，路径仍不截断。

The Catalog locator and Advanced search use separate indexes. The locator covers only Source, Branch, Target System, Subtarget, and Target Profile; Advanced uses one name/symbol index containing the full Kconfig symbol, its `CONFIG_` form, package name, prompt/localized names, and separator-normalized symbol words, while long Help/description and menu paths stay out of search. Every Advanced option stays on one row: the left column shows the ID without `CONFIG_PACKAGE_`, the flexible right-aligned middle shows locale text plus upstream English, and fixed N/M/Y controls remain unobstructed. IDs, `Search results`, and origin badges use the same primary size as `Advanced menuconfig`; descriptions are secondary. bool/tristate values use the Catalog Intent Engine, while string/int/hex values use the validated scalar editor. The Advanced header now keeps only the complete wrapping breadcrumb plus search and `N/M/Y` without a question mark. `Selected only` and `Origin` moved into the independent build-control group outside the contract frame above, and the breadcrumb is never truncated.

构建来源身份使用同一条通用规则：`main` 保持无前缀；任何非 `main` 的实际请求分支都加入构建身份，分支名内部 `/` 统一显示为 `_`。因此 `fix/foo` 的 Issue/Actions 为 `[build] fix_foo/<request>/...`，Artifact 为 `fix_foo-<build-ref>-...`。请求 branch/commit 与实际 Workflow branch/commit 分别写入构建元数据和失败摘要，避免 Issue 由非 main 页面提交但 Workflow 来自默认分支时混淆。 / Build-origin identity follows one generic rule: `main` stays unprefixed, while every non-main request branch is prefixed after replacing internal `/` with `_`. Request branch/commit and the executing Workflow branch/commit are recorded separately in metadata and failure summaries.

E v2 已完成生产验证。Phase A 用真实 GitHub Actions Run 覆盖 dev 正向、含 `/` 分支、stale commit 拒绝与 branch 不存在拒绝；Phase B1 又以 Issue #138 / Run 31280106097 证明真实 `custom-build.yml` Worker 的 `REQUEST_BRANCH=WORKFLOW_BRANCH=dev`、`REQUEST_COMMIT=WORKFLOW_COMMIT=63aafb274720345df1d5d659dbdebb2307865dd7`，并完成一次全绿的真实 OpenWrt Build Backend。B2/B2.1 将普通 `[build]` Issue 的唯一生产入口切到默认分支 `build-dispatcher.yml`：Dispatcher 固定 opened 事件快照，只从 schema 5 `build-request.json` 读取 `sourceEnv`、完整 `requestCommit` 与 `requestId`，要求远端 branch HEAD 精确等于请求提交，并在派发前再次核对 Issue state/author/created_at/title/body；通过后以 `workflow_dispatch(ref=sourceEnv)` 启动该分支上的 `custom-build.yml`。Worker 不监听 `issues: opened`，并独立核对 workflow branch/SHA、Issue 快照、精确 checkout 与 JSON identity。Staging smoke Issue #139 / Dispatcher Run 31283178862 证明 Request/Workflow/Checkout 全部落在 `staging@4ba62ce099f89d6b55a75c2c93fd3f1618b06b9b`；生产 Issue #140 又证明 main 自动路由后的 Worker 保留 `REQUESTER=weigefenxiang`，Request/Workflow branch 均为 `main`、commit 均为同一 `4ba62ce...`，`Verify checked-out commit` 成功，随后 `/cancel` 成功取消该 Worker。B2 切流前 direct-Issue Worker 的临时准入/取消兼容代码在本收尾中删除；当前准入和取消只匹配 workflow_dispatch Worker。E 收尾随后已完成 dev → staging → main，并用真实 `[build]` Issue 再次验证 admission + `/cancel`，对应 Worker 成功取消，因此 E v2 已 CLOSED。`probe` 与 Owner-only `build-canary` 继续作为手动诊断模式。网页 deployment identity 使用同轮 fresh `site-version.json` + `build-meta.json`；缺失或 version/siteSha256/branch/full-SHA 不一致时禁止云提交。B2.1 的 quoted `run-name` YAML `#` 语义门禁继续保留。Worker 的 Actions 标题使用 `requester#Issue` 开头；main 直接接请求主体，非 main 使用已标准化的环境身份并以 `-` 连接请求主体（如 `fix/foo` → `fix_foo-...`）。`run_title` 只是展示元数据而不是路由身份：新 Worker 允许旧 Dispatcher 省略它并回退旧标题；新 Dispatcher 仅在 GitHub 422 明确指向 `run_title` 不兼容时去掉该字段重试旧 Worker，Admission 与 `/cancel` 在滚动升级期间同时识别新旧 workflow_dispatch 标题。精确 checkout 步骤显式打印 `Request commit` 与 `Checkout HEAD` 后再断言相等。F 全站 SHA-256 Release Contract 已落地：Release Pointer 每次启动 fresh/no-store 获取，页面、静态资源与普通运行时 JSON 统一绑定 `siteSha256`，旧 Release 缓存不能与新 Release 混用；Blog exact mirror 也以同一 SHA 作为激活门禁。 / F full-site SHA-256 release caching is implemented: the pointer is fetched fresh, pages/assets/runtime JSON are keyed by one siteSha256, and Blog activation must prove that same release SHA. E v2 is production-validated. Phase A covered positive dev, slash-branch, stale-commit rejection, and missing-branch rejection; Phase B1 then proved a real exact-ref Worker and a full green OpenWrt backend build. B2/B2.1 make the default-branch Dispatcher the single production `[build]` Issue entrypoint, freeze and revalidate the Issue, read only the schema-5 route envelope, require branch HEAD to equal the full request commit, and dispatch the workflow_dispatch-only Worker on that ref. Staging Issue #139 / Dispatcher Run 31283178862 proved request/workflow/checkout identity at `staging@4ba62ce...`; production Issue #140 proved automatic main routing, preserved the original requester, matched request/workflow branch and commit, passed exact checkout verification, and successfully exercised `/cancel`. Pre-cutover direct-Issue admission/cancellation compatibility is removed; current controls match workflow_dispatch Workers only. `run_title` is display metadata, never routing identity: new Workers accept its absence from old Dispatchers and fall back to the legacy title, while new Dispatchers retry without that field only when GitHub returns a 422 that explicitly references `run_title`; Admission and `/cancel` recognize both workflow_dispatch title shapes during rolling upgrades. Manual Probe and owner-only build-canary remain. Deployment identity remains one fresh site-version/build-meta pair with matching siteSha256, and the quoted `run-name` YAML-hash gate remains.

软件包镜像由 `config/001.presets/package-mirrors.json` 唯一维护：JSON 记录 Source family、官方根地址、APK/OPKG adapter、镜像根地址与回退策略；`gen-package-mirrors.mjs` 生成不含真实 URL 的网页投影。浏览器按实际 IANA 时区选择请求策略：中国内地时区默认 `auto`，其他地区默认 `source-default`。源码检出并完成可选 Defconfig 后，`package-mirror-engine.mjs` 读取真实 `.config`、规范 JSON 登记的 capability 文件和明确 adapter 文件，识别 APK、OPKG 或混合状态；Branch 只进入报告，不用于硬编码判断。自动策略为 USTC → PKU → 源码默认，手动镜像失败直接回源码默认；探测失败、文件缺失和内部错误均写入 `package-mirror-report.json` 并继续构建。已知官方/镜像根地址才会原子替换，陌生的用户 `CONFIG_VERSION_REPO` 保持不动。Issue 标题把构建标识放在请求时间戳后，解析器生成 `请求时间戳-构建标识` 的 `build_ref`，因此 CONFIG、日志和固件 Artifact 共用该前缀。

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
3. schema 5 请求按固定 Catalog index 中的版本契约核对源码 commit，并复制 `submitted.config`。解析器只核对安全白名单与最小 Target/Profile 身份，不判断插件依赖、人工兼容规则、架构派生字段、主题包或构建必需项。用户勾选时运行一次官方 `make defconfig`；未勾选时直接进入下载/编译。并行编译使用 `BUILD_LOG=1`；失败后先冻结 `parallel/` 原始现场，再清空仅日志目录并运行最长 180 分钟的 `make -j1 V=s BUILD_LOG=1`，其证据独立保存到 `diagnostic/` / schema-5 requests verify the pinned source commit through the fixed Catalog index and copy `submitted.config`. The parser checks only safety allowlists and minimal Target/Profile identity; it does not judge plugin dependencies, manual compatibility rules, derived architecture fields, theme-package state, or build requirements. Optional upstream `make defconfig` runs only when requested; otherwise download/compile starts directly. Parallel compilation enables `BUILD_LOG=1`; on failure its evidence is frozen under `parallel/` before a separate, at-most-180-minute `make -j1 V=s BUILD_LOG=1` diagnostic snapshot under `diagnostic/`.
4. 完成可选 Defconfig 后运行非阻断软件包镜像框架，生成 `package-mirror-report.json`，再核验固件设置快照并上传 config + build-metadata artifact；下载与编译按 CPU+1 动态并发，原始输出实时显示并完整写入日志。时区/主题/NTP、请求镜像、生效镜像与包管理器同时写入固件内 `/etc/weig-build-info` / after optional Defconfig, run the non-blocking package-mirror framework, emit `package-mirror-report.json`, verify the firmware snapshot, and upload config/build metadata; downloads and compilation use CPU+1 while the firmware records timezone/theme/NTP plus requested/effective mirror and package manager in `/etc/weig-build-info`
5. Catalog 标准关系只在网页交互层由共享引擎处理；人工 `config-rules`、后端整配置 Catalog 校验和隐藏 smoke 配置生成器均已删除。后端不重复推断插件依赖，最终解析由可选的官方 Defconfig 或上游构建系统完成。只要并行阶段失败就上传分层 BUILD-LOGS，即使单线程诊断后来恢复成功；`00-SUMMARY.txt` 明确区分并行失败、诊断成功/失败/180 分钟超时与最终恢复状态 / Catalog-standard relations are handled only by the shared browser interaction engine. Manual `config-rules`, backend whole-config Catalog validation, and the hidden smoke config generator are removed. The backend does not re-infer package dependencies; optional upstream Defconfig or the upstream build system resolves the final configuration. Any parallel failure produces layered BUILD-LOGS even when the single-thread diagnostic later recovers; `00-SUMMARY.txt` distinguishes parallel failure, diagnostic success/failure/180-minute timeout, and final recovery state.
6. 本地 Prepare 先由 `canonicalize-site-release.mjs` 按现有文本格式契约把 `site/wrt` 文本落盘为确定的 LF/CRLF 发布字节，再由 `stamp-site-version.mjs` 按 tools/Workflow/Shell/config/site 项目指纹生成 `VERSION`；`site-release.mjs` 随后对 `site/wrt` 实际发布字节递归计算确定性 `siteSha256`（仅排除自引用 `site-version.json` 与部署实例 `build-meta.json`）。`site-version.json` 保存 Version + project fingerprint + siteSha256；CI 仅以 `--check` 验证。`build-meta.json` 记录 Version/Commit/Branch/Built/siteSha256，必须与 Release Pointer 匹配。Git checkout 字节由 `.gitattributes` 固定；Prepare 在哈希前先 canonicalize 已有 Windows 工作树，再验证 `site/wrt` 全量文本格式。回归同时覆盖 stale CRLF 工作树、`core.autocrlf=false/true` 与 clean detached checkout，三者 canonicalize 后必须得到同一 raw-byte siteSha256；SHA 算法本身仍不归一化 CRLF/LF。`site-release.mjs --print/--check` 可直接诊断实际 SHA/Pointer。旧八位请求继续兼容 / local Prepare canonicalizes existing working-tree release bytes before stamping, then hashes exact bytes; Git attributes plus stale-CRLF/autocrlf/clean-checkout regression prove one release SHA without weakening raw-byte semantics; CI validates only, while deployment metadata must match the same release SHA.

固件时区由 `timezones.json` 同时输出 IANA `zonename` 与 OpenWrt POSIX `timezone`;三条源码通过首启脚本写入两项。/ Firmware timezone selection emits both the IANA `zonename` and OpenWrt POSIX `timezone`; all three source pipelines apply both on first boot.

## 部署 / Deployment

- `site/wrt/` 是唯一 WRT 网页源码和可独立搬迁的纯静态部署单元；核心功能不依赖 VPS、数据库或自建 API / `site/wrt/` is the single WRT web source and portable static deployment unit; core functionality requires no VPS, database, or custom API.
- 发布链 / release chain: `dev → staging → main`。`Promote_Release.bat`/`promote-release.mjs` 先 fetch 并验证 exact commit、VERSION 与 fast-forward；仅在用户明确输入 `y` 后 push exact SHA，随后再次 fetch 并要求 source/target 都等于该 SHA。Enter/`n`/其他输入均取消且不改 refs；不使用 force push / promotion requires explicit confirmation, exact push, and post-push remote verification.
- Staging: `prepare-site-deployment.mjs` 从 `origin/staging` 的 detached worktree 打包，不包含当前工作区或后续 dev 修改；VPS 与 Standalone Preview 以相同 AutoBuild Commit 身份核对 / staging packages are created from the exact `origin/staging` commit, excluding local/dev changes.
- Standalone web: `site/wrt/` 可直接部署为独立站点。Cloudflare Pages 以 `main` 为 Production、`dev/staging` 为 Preview；GitHub Pages Workflow 只从 `main` 发布同一静态目录。两种平台都不拥有第二套业务代码 / `site/wrt/` is a first-class standalone app: Cloudflare uses `main` for Production and `dev/staging` for previews, while GitHub Pages publishes the same directory from `main`.
- Release cache contract: `site-version.json` 是 Release Pointer，启动时以 fresh/no-store + cache-busting query 获取；HTML 自身先跳转到 `?r=<siteSha256>`，CSS/JS/模块/Worker/站内 JSON 全部复用同一 `r`。运行时 localStorage 数据缓存按 siteSha256 命名并只清理旧 `wrt_cache:*`，不清用户偏好；GitHub/jsDelivr 数据回退只允许当前部署 exact commit，不跨 Release 回退。Cloudflare `/wrt/` 必须让 query string 参与 cache key，不能使用 Ignore Query String。/ The pointer is fresh; page/assets/data are release-keyed and may be cached long-term without mixing releases.
- Blog publication: 正式版只在 AutoBuild `main` 晋级后用 `sync-blog.mjs --ref origin/main` 精确镜像到 Hexo `source/wrt/`；临时树与启用树都必须同时通过逐文件 exact mirror 和同一 `siteSha256`，`.wrt-source.json` 记录 Version/Commit/siteSha256。新增、修改、删除或漏同步任何站点文件都会使验证失败。Blog 是 Production 镜像，不承担 dev/staging Preview / the blog mirrors only exact origin/main and proves the same full-site SHA before activation.
- `build-meta.json` 仅在具体部署产物中生成；Standalone Cloudflare/GitHub Pages/VPS 可拥有不同 Built 时间，但 Version + siteSha256 + Commit/Branch 必须形成一致部署身份。缺失/不匹配时页面仍可浏览，但云提交保持禁用 / deployment metadata may differ in Built time, but must bind to the same release SHA and exact Git identity.
- 浏览器模块 / browser modules: Catalog 共享模块统一使用 `.js` 和普通 JavaScript MIME；部署包拒绝旧 `.mjs` 并执行真实 HTTP 冒烟/回滚 / shared Catalog modules use `.js`, deployments reject legacy `.mjs`, and live MIME/body smoke checks protect rollback.
- 提交前 Prepare / pre-commit Prepare: `tools/dev-assistant.mjs prepare` 固定执行 `canonicalize site/wrt bytes → site/wrt 全量文本校验 → VERSION/siteSha stamp → changed text → check-all → git diff --check`；它不执行 Git add/commit/push。分支晋级仅由独立 Promote 工具在用户明确确认后执行 exact push / local Prepare never stages, commits, or pushes; branch promotion is the separate confirmed exact-push transaction.
- Catalog 运行时数据链 / Catalog runtime data chain: Catalog 自身继续使用独立的 asset SHA/commit 完整性契约；站内静态 JSON 则先取当前 Release 本地资源，必要时仅回退到当前 `build-meta.commit` 的 jsDelivr/GitHub Raw exact commit，所有 URL 仍绑定同一 siteSha256，不允许回退到其它 Release / Catalog keeps its own pinned integrity contract while ordinary site data is release-scoped and exact-commit-only.

## Catalog schema 6 与 Advanced 性能 / Catalog schema 6 and Advanced performance

Catalog 运行时不再把 Target、完整关系、菜单、隐藏说明、长 Help 和所有语言塞进一个对象。浏览器初始只取 `core + graph`；Advanced 按需加载 `menu`、当前语言、隐藏显示信息和 Help。`graph` 使用 relations schema 3 的字符串/表达式池、数组记录、位标志和整数邻接表；旧 schema 5 单体在迁移期仅作回退。

The runtime no longer puts Targets, the full relation graph, display menus, hidden descriptions, long Help, and every locale into one object. Initial selection fetches only `core + graph`; Advanced lazily fetches menu, current-locale, hidden-display, and Help shards. The graph uses relations schema 3 string/expression pools, array records, bit flags, and integer adjacency lists; the schema-5 monolith is migration fallback only.

Advanced 在状态 revision 内复用 Target 上下文、表达式 token、可见性、最大状态和目录索引；搜索由独立 Worker 建立二元词索引并返回 symbol ID。默认搜索排除长 Help，显示列表按 80 行分页，避免每次展开或键入都重新扫描、解析并重建全部 DOM。


D117 进一步把首屏启动工作与 Advanced 工作分离：页面主体先完成首次绘制，再启动自动 Catalog 加载；schema 6 的 `core + graph` 首次只建立 Target/Profile 默认值真正需要的 symbol/choice 最小索引，菜单路径、名称搜索文本、descendant map 与搜索 Worker 只在请求 `menu` 分片后建立。有效 Cache API 命中只执行一次 bytes/hash 校验、gzip 解压和 JSON 解析。Kconfig fixed-point 默认值计算改为每一轮共享一个 Target validation context，不再为每个条件 default 重建，同时继续以 Target-owned context 值为权威。

Within one state revision, Advanced reuses Target context, expression tokens, visibility, maximum state, and path indexes. A dedicated Worker builds a bigram search index and returns symbol IDs. Default search excludes long Help, and display is paged in bounded 80-row chunks so expansion and typing do not repeatedly parse and rebuild the entire DOM.


D117 further separates startup work from Advanced work. The page shell is painted before automatic Catalog loading starts; a schema-6 `core + graph` load builds only the symbol/choice indexes needed by Target/Profile defaults. Menu paths, localized search text, descendant maps, and the search Worker are built only after the `menu` shard is requested. A valid Cache API hit is hash/size-checked, decompressed, and JSON-decoded exactly once. Fixed-point Kconfig default evaluation shares one Target validation context per pass instead of rebuilding it for every conditional default while keeping Target-owned context values authoritative.

## D100 Catalog 运行契约与构建契约分离

Schema 6 浏览器运行时使用 `core + graph`，其关系模型为 Relations Schema 3；构建请求仍以 Schema 5 `legacy` 元数据锁定 Catalog/源码版本，但 GitHub Actions 不再下载该单体对整份 `.config` 做语义验证。`index.json` 的每个分支因此同时发布两类互不混用的契约：

- `assets.*`：浏览器运行分片；
- `legacy`：构建验证单体，包含 `asset/hash/bytes/catalogSchema/relationsSchema`。

网页生成 `build-request.json` 时只能从同一个 `branch.legacy` 对象读取资产、哈希、大小和两个 schema，禁止从 `MENU_CATALOG` 运行对象拼接 schema。解析器读取固定 index 中的 `legacy` 并逐字段核对请求，用于锁定版本而非插件依赖判定；不再下载或解压单体 Catalog。根级 `asset/hash/bytes` 仅作为迁移期旧客户端镜像。
