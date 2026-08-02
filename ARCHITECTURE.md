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
│  └─ data/                      # 页面与 CI 共用的数据 / data shared by page and CI
│     ├─ project.json            # Fork 只需改这一份仓库参数 / one-file fork settings
│     ├─ devices.json            # 机型注册表(177 台,版本/Profile 矩阵) / 177-device registry with branch/profile matrix
│     ├─ menuconfig-index.json   # 独立 menuconfig 目录的本地入口与回退 / local entry and fallback for the external menuconfig catalog
│     ├─ i18n.json               # 11 语言 UI 词条(fallback: en) / 11-language UI strings
│     ├─ timezones.json          # 445 个 LuCI IANA→POSIX 时区映射 / 445 LuCI IANA-to-POSIX timezone mappings
│     └─ <机型>/plugins.json      # 每启用机型的插件表(生成物) / per-enabled-device plugin table (generated)
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
   ├─ parse-request.mjs          # 载荷解析 + 全字段白名单校验 / payload parsing + full whitelist validation
   ├─ sync-blog.mjs              # 同步博客副本 / sync the blog mirror
   └─ serve.mjs                  # 本地静态服务器 / local static server
```

## 数据流 / Data flow

```
config/*.config + plugins-meta.json + plugin-sizes.json ──gen-plugins──▶ site/wrt/data/<机型>/plugins.json
i18n-source.json + i18n-translations.json ──gen-i18n──▶ site/wrt/data/i18n.json
上游分支 makefile ──fetch-catalog──▶ 分支/Profile 目录 ──gen-seed-configs──▶ devices.json + 独立种子 config
独立 WeiG-OpenWrt-Menuconfig-Catalog 按清单扫描 ImmortalWrt、OpenWrt、Lean LEDE 与 hanwckf 兼容源的 Config.in/.targetinfo/.packageinfo ──▶ 发布 schema 驱动的 Target 选择器、完整菜单树和轻量 catalog-data 分片 ──▶ 页面动态处理“无选项则隐藏、单选项则自动选中、多选项才显示下拉框”，未来出现额外 Target 层级也无需改死 HTML。Target 字段和值始终显示上游英文，当前语言译文仅在悬停/聚焦/轻触时出现，非中文语言不回退中文；五列使用 Profile 优先的弹性宽度。Advanced menuconfig 和 Selected options 均可折叠；当前菜单层按实际内容高度展开，超过视口上限才进入内部滚动，普通项每批直接渲染 80 项，Kconfig choice 保留直接选值下拉框，分类卡片与普通选项行使用不同背景，手机选项文字限制为一至两行，所有面包屑祖先可直接跳转。网页优先读取 GitHub raw 并拒绝旧 schema；统一定位框覆盖源码、分支、Target、菜单路径和 symbol，精选 Applications 按软件包符号与 Kconfig 双向关联。Catalog 按分支验证，成功分支立即覆盖滚动数据，失败或损坏分支保留上次成功分片并标记 stale；完整 Release 仍只在全部分支成功时更新
The separate WeiG-OpenWrt-Menuconfig-Catalog scans manifest-selected ImmortalWrt, OpenWrt, Lean LEDE, and hanwckf compatibility branches, then publishes schema-driven Target selectors, the full menu tree, and compact catalog-data shards. The page hides empty selectors, auto-selects a single value, shows a dropdown only for multiple values, and can render future Target levels without hard-coded HTML. Target fields and values always show upstream English, current-locale text is hover/focus/tap-only, and non-Chinese locales never fall back to Chinese; fluid field widths prioritize Profile. Advanced menuconfig and Selected options remain collapsible. An open level grows to actual content height and becomes an internal scroller only past the viewport cap; ordinary options render directly in batches of 80, Kconfig choices keep direct selects, category cards and ordinary option rows use distinct backgrounds, mobile option text is clamped to one or two lines, and every ancestor breadcrumb is clickable. Raw GitHub data is preferred and stale schemas are rejected. One locator covers sources, branches, Targets, menu paths and symbols; curated Applications join Kconfig by package symbol. Catalog results are validated per branch: valid branches replace their rolling data immediately, while failed or corrupt branches retain their last-good shard as `stale`; the complete Release updates only when every branch succeeds.
页面保留旧设备注册表和初始 config 仅用于配置导入与历史请求兼容;新请求按 Target 生成完整 `build-request.json`,Issue 构建以其中 `.config` 为权威输入。
The page retains the legacy device registry and base configs only for imports and historical-request compatibility. New Target requests export a complete `build-request.json`, whose `.config` remains authoritative for Issue builds.
上传配置先等待对应源码/分支 Catalog,再恢复 Target 和已知 menuconfig;Catalog 未收录项保留在分页的导入工作区中,可修改、关闭、删除行或恢复原值。未收录 Target 保持为明确的 `custom-target`,不再静默切换到目录首项。Catalog 以源码英文为权威名称，人工表维护精选应用 11 语，发布阶段按英文内容指纹复用翻译缓存并增量补译所有菜单层级、choice 和普通选项；缺译回退英文并写入覆盖报告，翻译故障不阻断目录发布。
An uploaded config waits for the matching source/branch catalog before restoring the Target and known menuconfig values. Uncatalogued symbols remain editable in a paged import workspace, while an unknown Target stays an explicit `custom-target` instead of silently falling back to the first catalog entry. Upstream English is authoritative; reviewed tables carry curated Applications in 11 languages, while the publish stage reuses content-keyed translations and incrementally translates menu levels, choices, and ordinary options. Missing locales fall back to English and remain visible in coverage reports; translation failures do not block catalog publication.
```

## 构建链路 / Build pipeline

1. 页面下载含完整 `.config` 的 `build-request.json`,并打开 Issue 表单 / page downloads a request containing the complete `.config` and opens the Issue form
2. 新手 Issue 只有一个必填附件框:上传网页生成的 `build-request.json` 即可;已有 `.config` / `config.buildinfo` 先由网页识别并包装。解析器仍兼容带网页元数据头的原始配置 / the beginner Issue has one required attachment field: upload the web-generated `build-request.json`; existing configs are identified and wrapped by the page first, while the parser remains compatible with raw configs carrying web metadata
3. 克隆所选源码@所选分支 → diy 脚本 → feeds → 直接复制 `submitted.config` 为构建 `.config`；项目不主动运行 `make defconfig`，仓库 base config 不参与 Issue 重建 / clone source@branch, run diy and feeds, then copy `submitted.config` directly as the build `.config`; the project does not explicitly run `make defconfig`, and repository base configs do not regenerate Issue builds
4. 先核验固件设置快照并上传 config + build-metadata artifact(编译失败也能拿到)→ 下载与编译按 CPU+1 动态并发,原始输出实时显示并完整写入日志；时区/主题/NTP/opkg 同时写入固件内 `/etc/weig-build-info` / verify the firmware-settings snapshot and upload config + build metadata first; downloads and compilation use CPU+1 dynamic concurrency, streaming raw output live while recording timezone/theme/NTP/opkg in `/etc/weig-build-info`
5. `config-rules.json` 在提交前处理需要人工语义选择的通用 `.config` 规则，可按 Source/Branch/Target、`all`/`any` 符号条件、Y/M 多状态和符号前缀批量维护修正方案；`prompt: always` 可要求新建与导入配置都先明确确认。网页只有在规则处理和请求生成完成后才打开 GitHub，不预开 `about:blank`。软件包互斥由网页与 Issue 解析使用 Catalog 元数据提前检查；Actions 直接采用完整配置。并行编译失败时自动补跑一次最多 60 分钟的 `make -j1 V=s`，补跑成功则以“单线程恢复”继续，仍失败才结束并上传诊断日志。下载失败记录警告后继续；四类 Artifact 均以请求编号开头，如 `006_01-FIRMWARE-ALL-…`，日志保留 14 天并回评 @提交者 / `config-rules.json` handles generic `.config` rules before submission using Source/Branch/Target scopes, `all`/`any` symbol conditions, multi-state Y/M matching, and prefix-based repairs; `prompt: always` can require an explicit choice for both new and imported configurations. GitHub opens only after rule resolution and request generation, never through a pre-opened `about:blank`. Package conflicts are checked early by the page and Issue parser using Catalog metadata; Actions uses the complete config directly. A failed parallel build gets one 60-minute `make -j1 V=s` recovery attempt and continues only if it succeeds, otherwise diagnostic logs are uploaded and the build fails. Download errors warn and continue; all four artifacts begin with the request reference, for example `006_01-FIRMWARE-ALL-…`, with logs retained for 14 days and the submitter mentioned in the Issue
6. `site-version.yml` 在 `site/wrt/**` 或 `VERSION` push 后按内容指纹同步根 `VERSION` 与静态 `site-version.json`；旧八位请求继续兼容，actor 条件阻断机器人提交循环 / site-version automation keeps root `VERSION` and static `site-version.json` together, accepts legacy eight-digit requests, and prevents bot-commit loops

固件时区由 `timezones.json` 同时输出 IANA `zonename` 与 OpenWrt POSIX `timezone`;三条源码通过首启脚本写入两项。/ Firmware timezone selection emits both the IANA `zonename` and OpenWrt POSIX `timezone`; all three source pipelines apply both on first boot.

## 部署 / Deployment

- 主站 / primary: `site/wrt/` → 任意静态托管 / any static hosting
- 备用 / mirror: 博客 `source/wrt/`(Hexo skip_render)→ Cloudflare Pages
- 运行时数据三级降级 / runtime data fallback: 同目录 local → jsDelivr → raw.githubusercontent
