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
│  ├─ lib/catalog-loader.js     # 浏览器 Catalog 下载/缓存/校验器 / browser Catalog fetch/cache/validation loader
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
   ├─ build-config.mjs           # 仅 dispatch/smoke 兼容生成 / legacy dispatch/smoke generation only
   ├─ fetch-build-request.mjs    # 下载并限制 GitHub Issue 附件 / fetch allowlisted GitHub Issue attachment
   ├─ parse-request.mjs          # 载荷解析 + Catalog 契约/配置校验 / payload parsing + Catalog contract/config validation
   ├─ validate-catalog-config.mjs # 构建前复用同一引擎严格校验 / strict pre-build validation through the same engine
   ├─ check-text-format.mjs      # 变更文本 LF/CRLF/BOM/EOF 门禁 / changed-text LF/CRLF/BOM/EOF gate
   ├─ sync-blog.mjs              # Unicode 安全逐文件镜像+分块哈希回滚 / Unicode-safe iterative mirror + chunked-hash rollback
   └─ serve.mjs                  # 本地静态服务器 / local static server
```

## 数据流 / Data flow

```
config/*.config + plugins-meta.json + plugin-sizes.json ──gen-plugins──▶ site/wrt/data/seed/plugins.json + 360t7/{plugins,packages}.json
i18n-source.json + i18n-translations.json ──gen-i18n──▶ site/wrt/data/i18n.json
上游分支 makefile ──fetch-catalog──▶ 分支/Profile 目录 ──gen-seed-configs──▶ devices.json + 独立种子 config
独立 WeiG-OpenWrt-Menuconfig-Catalog 按清单扫描 ImmortalWrt、OpenWrt、Lean LEDE 与 hanwckf 兼容源的 Config.in/.targetinfo/.packageinfo ──▶ 按 Kconfig symbol 合并重复定义并发布 schema 驱动的 Target 选择器、可见菜单、隐藏 Kconfig/packageinfo-only 记录、完整依赖表达式、choice/select/imply/conflict/provides 关系与反向索引 ──▶ `site/wrt/lib/catalog-engine.js` 在浏览器与 Node 中解释同一份声明式数据。普通菜单只渲染可见项；Advanced 搜索同时覆盖隐藏项，可查看并清理旧配置残留。用户开启项目时引擎只补齐能够唯一确定的必要依赖，关闭项目时重新计算完整表达式并递归关闭真正失效的依赖者；不在 `app.js` 中维护插件名、语言包前缀或主题特例。浏览器初始化顺序为 Catalog 建模 → Target/Profile → `TARGET_*`/架构/Target Feature/Profile 契约 → 默认主题和最低启动预设。依赖求值统一返回 satisfied/unsatisfied/deferred：交互与 pre-defconfig 阶段延后上游隐藏默认值并信任 Catalog 目标契约包，已知错误的 Target 条件仍立即拒绝；post-defconfig 阶段拒绝全部剩余 deferred。推荐预设失败只回滚预设，不卸载已经验证通过的 Catalog，也不把配置错误包装成 Catalog 加载失败。Target 字段和值始终显示上游英文，当前语言译文仅在悬停/聚焦/轻触时出现，非中文语言不回退中文；五列使用 Profile 优先的弹性宽度。网页优先从 GitHub Raw 获取最新 index，再按 index 固定的 Git 提交依次尝试 jsDelivr、GitHub Raw 和完整 GitHub Release 分片；每个候选都必须通过 bytes/hash/gzip/JSON/schema/relations/共享引擎全链验证后才接受。浏览器按 commit/hash/bytes 精确契约校验，VPS 不保存 Catalog；新请求还锁定 Catalog 数据提交、分片哈希/字节数与 Catalog 记录的上游源码 commit。Catalog 按分支验证，成功分支立即覆盖滚动数据，失败或损坏分支保留上次成功分片并标记 stale；完整 Release 仍只在全部分支成功时更新。
The separate WeiG-OpenWrt-Menuconfig-Catalog scans manifest-selected ImmortalWrt, OpenWrt, Lean LEDE, and hanwckf compatibility branches, merges duplicate Kconfig declarations by symbol, and publishes schema-driven Target selectors, the visible menu, hidden Kconfig/packageinfo-only records, complete dependency expressions, choice/select/imply/conflict/provides relations, and reverse indexes. `site/wrt/lib/catalog-engine.js` interprets the same declarative data in both the browser and Node. The normal tree renders visible options only, while Advanced search also exposes hidden records for inspection and cleanup of imported residues. Enabling an item adds only uniquely determined mandatory dependencies; disabling an item re-evaluates complete expressions and recursively disables only dependents that are actually invalid. `app.js` contains no plugin-name, translation-package-prefix, or theme dependency exceptions. Browser startup is ordered as Catalog model → Target/Profile → `TARGET_*`/architecture/Target-feature/Profile contract → default theme and minimum-boot presets. Dependency evaluation has standardized satisfied/unsatisfied/deferred states: interactive and pre-defconfig phases defer upstream hidden defaults and trust Catalog target-contract packages while still rejecting known target mismatches; post-defconfig rejects every remaining deferred relation. A recommended-preset failure rolls back only the preset, keeps the validated Catalog loaded, and never masquerades as Catalog transport failure. Target labels remain upstream English with locale text on hover/focus/tap. The browser fetches the latest index from GitHub Raw first, then tries the shard pinned by that index through jsDelivr, GitHub Raw, and the complete GitHub Release. A candidate is accepted only after bytes/hash/gzip/JSON/schema/relations/shared-engine validation. A schema-5 request additionally pins the Catalog data revision, shard hash/size, and upstream source commit recorded by Catalog. Catalog results are validated per branch: valid branches replace rolling data, failed or corrupt branches retain last-good data as `stale`, and the complete Release updates only when every branch succeeds.
网页不再加载旧设备注册表或公共 base config;`devices.json`、`config-manifest.json` 与 `config/` 权威配置仅由 CI、生成工具和历史请求兼容链使用。新请求按 Target 生成完整 `build-request.json`,Issue 构建以其中 `.config` 为权威输入。
The page no longer loads the legacy device registry or public base configs. `devices.json`, `config-manifest.json`, and authoritative configs under `config/` are retained only for CI, generators, and legacy-request compatibility. New Target requests export a complete `build-request.json`, whose `.config` remains authoritative for Issue builds.
上传配置先等待对应源码/分支 Catalog,再恢复 Target 和已知 menuconfig;Catalog 未收录项保留在分页的导入工作区中,可修改、关闭、删除行或恢复原值。未收录 Target 保持为明确的 `custom-target`,不再静默切换到目录首项。Catalog 以源码英文为权威名称，人工表维护精选应用 11 语，发布阶段按英文内容指纹复用翻译缓存并增量补译所有菜单层级、choice 和普通选项；缺译回退英文并写入覆盖报告，翻译故障不阻断目录发布。
An uploaded config waits for the matching source/branch catalog before restoring the Target and known menuconfig values. Uncatalogued symbols remain editable in a paged import workspace, while an unknown Target stays an explicit `custom-target` instead of silently falling back to the first catalog entry. Upstream English is authoritative; reviewed tables carry curated Applications in 11 languages, while the publish stage reuses content-keyed translations and incrementally translates menu levels, choices, and ordinary options. Missing locales fall back to English and remain visible in coverage reports; translation failures do not block catalog publication.
```

## Catalog 选择状态 / Catalog selection state

Catalog Target 页面把当前配置拆成四个语义层，而不是把所有 `y/m` 软件包都算作用户插件：

- `baseline`：Target/Profile 契约与在完整 Target 上下文中成立的上游 Kconfig 默认值；
- `recommended`：最低启动、默认主题等网页推荐预设；
- `userOverrides`：用户明确启用、排除或修改的值；
- `resolved`：前三层叠加后由共享 Catalog 引擎补齐或清理依赖得到的最终状态。

精选插件计数只读取 `userOverrides`，因此首次选定 Target/Profile 时保持 0；基础包仍在插件卡片和 Advanced menuconfig 中显示真实启用状态与来源。Advanced 可按 Target/Profile、上游默认、推荐、依赖、导入、用户选择或明确排除筛选；“恢复默认”删除用户覆盖并回到继承值。D99-A 继续锁定 Target/Profile 明确要求的软件包；安全精简策略留给 D99-B，Relations 紧凑数组/分片留给 D99-C。

The Catalog Target page separates the effective configuration into four semantic layers instead of counting every `y/m` package as a user-selected plugin:

- `baseline`: the Target/Profile contract plus upstream Kconfig defaults that are satisfied in the complete Target context;
- `recommended`: web presets such as minimum-boot and the default theme;
- `userOverrides`: values explicitly enabled, excluded, or edited by the user;
- `resolved`: the effective state after the shared Catalog engine applies dependency closure to those layers.

The curated-plugin counter reads only `userOverrides`, so a newly selected Target/Profile starts at zero. Baseline packages still appear as enabled in curated cards and Advanced menuconfig with their actual origin. Advanced can filter Target/Profile, upstream defaults, recommendations, dependencies, imports, user selections, and explicit exclusions; Restore default removes only the user override. D99-A keeps Target/Profile-declared packages locked. Safe baseline slimming is deferred to D99-B, and compact/sharded Relations data to D99-C.

## 构建链路 / Build pipeline

Catalog Target 的 `arch`、`archPackages`、Target/Profile 与 Profile 必需包是一个不可拆分的构建契约：Catalog 从上游 `Target-Arch` 原样发布真实构建架构，网页写入 `CONFIG_<arch>`、`CONFIG_ARCH`、`CONFIG_TARGET_ARCH_PACKAGES` 并自动加入 Profile 必需包，解析器按同一分支 Catalog 逐项复核；缺失、架构不匹配或 Catalog 无法读取时直接拒绝请求 / A Catalog Target treats `arch`, `archPackages`, Target/Profile, and Profile-required packages as one atomic build contract. Catalog publishes upstream `Target-Arch` verbatim; the page writes `CONFIG_<arch>`, `CONFIG_ARCH`, and `CONFIG_TARGET_ARCH_PACKAGES`, adds required Profile packages, and the parser rejects missing or mismatched contract data.

1. 页面先按 `source-build-requirements.json` 匹配 Source/Branch/Target 必需项，用户明确应用后才下载含完整 `.config` 的 `build-request.json` 并打开 Issue；解析器用同一 JSON 二次拒绝缺项请求 / the page first matches Source/Branch/Target requirements from `source-build-requirements.json`; only after explicit acceptance does it download a request containing the complete `.config` and open the Issue, while the parser rejects omissions using the same JSON
2. 新手 Issue 只有一个必填附件框:上传网页生成的 `build-request.json` 即可;已有 `.config` / `config.buildinfo` 先由网页识别并包装。解析器仍兼容带网页元数据头的原始配置 / the beginner Issue has one required attachment field: upload the web-generated `build-request.json`; existing configs are identified and wrapped by the page first, while the parser remains compatible with raw configs carrying web metadata
3. schema 5 请求按 Catalog 记录的精确上游 commit 克隆源码，旧 schema 3/4 请求才按分支兼容；随后执行 diy/feeds 并复制 `submitted.config`。默认直接作为构建 `.config`：pre-defconfig 校验信任 Catalog Target/Profile 契约并延后上游隐藏默认值；只有用户明确勾选 Defconfig 才执行一次 `make defconfig`，随后用同一引擎以 post-defconfig 模式拒绝任何剩余 deferred、不满足依赖、choice 或冲突 / schema-5 requests clone the exact upstream commit recorded by Catalog, while legacy schema 3/4 requests retain branch-based compatibility. After diy/feeds, `submitted.config` remains authoritative: pre-defconfig validation trusts the Catalog Target/Profile contract and defers upstream hidden defaults. An explicitly enabled Defconfig runs once, followed by post-defconfig validation with the same engine, which rejects every remaining deferred or unsatisfied dependency, choice, or conflict
4. 先核验固件设置快照并上传 config + build-metadata artifact(编译失败也能拿到)→ 下载与编译按 CPU+1 动态并发,原始输出实时显示并完整写入日志；时区/主题/NTP/opkg 同时写入固件内 `/etc/weig-build-info` / verify the firmware-settings snapshot and upload config + build metadata first; downloads and compilation use CPU+1 dynamic concurrency, streaming raw output live while recording timezone/theme/NTP/opkg in `/etc/weig-build-info`
5. Catalog 标准关系由共享引擎统一处理：网页交互、导入修复预览、Issue 解析与构建前严格校验不再各写一套依赖/choice/冲突逻辑。`config-rules.json` 仍暂时独立处理需要人工语义选择或实际构建验证得到的兼容规则；本轮明确不迁入 Catalog，迁移前不得删除。网页完成两层处理后才打开 GitHub。并行编译失败时自动补跑一次最多 60 分钟的 `make -j1 V=s`，补跑成功则以“单线程恢复”继续，仍失败才结束并上传诊断日志 / Catalog-standard relations are handled by one shared engine across browser interaction, import repair previews, Issue parsing, and strict pre-build validation. `config-rules.json` remains a separate temporary layer for semantic choices and empirically verified build compatibility; migration into Catalog is explicitly deferred and these files must not be removed yet. GitHub opens only after both layers complete. A failed parallel build gets one 60-minute `make -j1 V=s` recovery attempt and continues only if it succeeds; otherwise diagnostics are uploaded and the build fails
6. `site-version.yml` 在 `site/wrt/**` 或 `VERSION` push 后按内容指纹同步根 `VERSION` 与静态 `site-version.json`；旧八位请求继续兼容，actor 条件阻断机器人提交循环 / site-version automation keeps root `VERSION` and static `site-version.json` together, accepts legacy eight-digit requests, and prevents bot-commit loops

固件时区由 `timezones.json` 同时输出 IANA `zonename` 与 OpenWrt POSIX `timezone`;三条源码通过首启脚本写入两项。/ Firmware timezone selection emits both the IANA `zonename` and OpenWrt POSIX `timezone`; all three source pipelines apply both on first boot.

## 部署 / Deployment

- 主站 / primary: `site/wrt/` → 任意静态托管 / any static hosting
- 浏览器模块 / browser modules: Catalog 共享模块统一使用 `.js`，沿用静态服务器默认 JavaScript MIME；`site/wrt/lib/package.json` 仅让 Node 把这些 `.js` 解释为 ESM。部署包必须包含两模块且不得残留旧 `.mjs`，切换后通过真实 HTTP MIME/HTML 冒烟，否则回滚 / Catalog shared modules use `.js` so ordinary static-server JavaScript MIME applies; the scoped package file is only for Node ESM interpretation. Deployments require both modules, reject legacy `.mjs`, and roll back when live HTTP MIME/body smoke checks fail
- 备用 / mirror: `sync-blog.mjs` 将 `site/wrt/` 以 Unicode 安全的逐目录/逐文件复制完整镜像到博客 `source/wrt/`（Hexo skip_render，含 `.config`/空目录，删除目标残留，以分块 SHA-256 验证临时副本后原子替换）→ Cloudflare Pages / Unicode-safe iterative exact mirror of `site/wrt/` into blog `source/wrt/`, including `.config`/empty directories, stale-file removal, chunked SHA-256 staging verification, atomic swap, and rollback
- 提交前文本门禁 / pre-commit text gate: `check-text-format.mjs --changed` 按 `.gitattributes` 检查本轮变更的 LF/CRLF、UTF-8 无 BOM 与单一 EOF 换行，只报告不改写；`Sync_Deploy.bat` 主仓库操作在 `check-all` 前调用 / validates changed-file LF/CRLF, no-BOM UTF-8, and one final newline before `check-all`, without rewriting files
- Catalog 运行时数据链 / Catalog runtime data chain: 精确缓存 exact cache → GitHub Raw 最新 index latest index → jsDelivr/GitHub Raw 固定提交分片 pinned-commit shard → 完整 GitHub Release complete Release；VPS 不保存 Catalog，其他静态数据仍使用同目录优先的降级链 / other static data still prefers same-directory fallbacks
