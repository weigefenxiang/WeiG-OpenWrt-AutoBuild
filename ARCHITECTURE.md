# 目录结构与技术架构 / Project Structure & Architecture

## 1. 双仓职责 / Two-repository boundary

```mermaid
flowchart LR
  U["OpenWrt source repositories"] --> C["Menuconfig Catalog"]
  C -->|"index + immutable assets"| W["AutoBuild static web app"]
  W -->|"schema 5 request + pinned Catalog contract"| A["GitHub Actions worker"]
  A --> F["Firmware and 60-day artifacts"]
```

Catalog 是数据层：

- 自动发现 Source/Branch；
- 提取 Target/Profile、Kconfig menu、symbol/type、默认值、依赖和帮助；
- 发布 schema 2/3/4/5 兼容性证据、精选应用及跨源体积观测；
- 提供手动包级探测工具。

AutoBuild 是通用工具层：

- 绑定当前代码分支到相应 Catalog 数据分支；
- 渲染 Catalog、执行通用 Kconfig intent 与兼容性方案；
- 导出 schema 5 完整请求并进行 exact-ref 路由；
- 调用上游构建脚本、收集和发布产物。

Catalog is the data layer. AutoBuild is a generic consumer and build orchestrator. AutoBuild must not duplicate device matrices, seed configs, plugin catalogs, dependencies, or rule-specific package knowledge.

## 2. 当前目录 / Current layout

```text
WeiG-OpenWrt-AutoBuild/
├─ .github/workflows/          build routing, worker, cancellation, CI and Pages
├─ Shell/                      generic upstream/build adapters
├─ config/build.json           build-side password/jobs/admission configuration
├─ config/build.schema.json    build-side configuration schema
├─ config/policies/            one small package-mirror policy
├─ docs/                       bilingual developer documentation
├─ site/wrt/
│  ├─ config/
│  │  ├─ site.json             public web/firmware/default configuration
│  │  └─ site.schema.json      public site configuration schema
│  ├─ index.html               static UI shell
│  ├─ app.css                  shared responsive presentation
│  ├─ app.js                   generic Catalog consumer
│  ├─ lib/
│  │  ├─ catalog-loader.js     immutable index/asset contract loader
│  │  ├─ catalog-engine.js     Kconfig + compatibility executor
│  │  ├─ catalog-schema6.js    split Catalog asset reader
│  │  ├─ site-config.js        shared site configuration validator/adapter
│  │  └─ build-identity.js     shared Issue/Run/Artifact naming
│  └─ data/                    deployment identity, i18n, timezone and mirror runtime assets
├─ tools/                      preparation, validation, request and deployment tools
└─ VERSION                     Asia/Shanghai project version
```

There is intentionally no local device tree, public base config, generated package page, or weekly upstream-data synchronizer.

### 项目配置 / Project configuration

克隆者要维护两个职责隔离的配置源：`site/wrt/config/site.json` 是公开网页的唯一配置源，负责品牌、Catalog 地址与选择/加载策略、网页外观、固件默认值和默认构建标识；`config/build.json` 是构建端的唯一配置源，只负责 `password.mode`、`jobs.compile`、`jobs.download` 与 `admission.publicActiveBuilds`。浏览器只读取 `site/wrt/config/site.json`，绝不能读取或部署 `config/build.json`。

在工作树按需编辑对应配置后运行 `node tools/dev-assistant.mjs prepare`；它会校验两份配置并更新构建脚本使用的 `Shell/build-defaults.conf`。配置与 `prepare` 产生的受控输出必须一起提交，生成文件不能反向作为配置源直接编辑。

`site/wrt/config/site.json` 中，`project.displayName` 和 `project.shortName` 只负责页面标题、短品牌和通知展示；`project.repository` 与 `project.blogUrl` 只提供经校验的链接目标，不会改变网关身份、`[build]` 请求协议或 Run/Artifact 标题格式。`catalog.repository`、`catalog.releaseTag`、`catalog.selection` 与既有 `catalog.loading` 调度 contract 只描述 Catalog 地址、首选项和加载顺序；Source、Branch、Target/Profile、Kconfig、插件、依赖和兼容性事实仍由 Catalog runtime data 负责，不能在项目配置中复制清单或声明高级 Catalog 事实。`ui`、`firmware` 与 `build.defaultTag` 分别提供网页外观、公开固件默认值和网页默认构建标识。

密码模式 `prompt` 由提交者输入，`empty` 明确使用空密码；`secret` 模式必须配置仓库 Secret `DEFAULT_ROOT_PASSWORD`。实际密码不得写入 `config/build.json`、站点文件、构建请求、Issue 或日志。网页翻译的权威源是 `tools/i18n-source.json` 与 `tools/i18n-translations.json`；`site/wrt/data/i18n/` 只保存生成包。公开文案保持中性，不把工具、模型或厂商名称写进公共界面。

`site/wrt` 是完整的静态网页业务源，可独立托管。部署必须保留整个目录及其 `config/`、`data/`、HTML、脚本和样式。配置与受控输出提交后，实际部署要从该 40 位 SHA 的干净 checkout 执行：

```powershell
node tools/prepare-web-deployment.mjs --commit <40位SHA> --branch <dev或main>
```

该命令生成被忽略的 `site/wrt/data/build-meta.json`。部署必须携带与 `site-version.json` 一致的元数据；缺失、非法或陈旧元数据时提交门禁保持禁用。Pages workflow 的站点准备阶段只执行 `node tools/stamp-site-version.mjs --check` 和 `prepare-web-deployment`，不在部署现场修改配置。独立托管只改变网页发布位置，不改变构建身份：每个构建请求仍必须对应目标 AutoBuild 仓库的同一提交。Catalog 的 Source、Branch、Target/Profile、插件、Kconfig、依赖和兼容性事实仍全部由 Catalog 提供，AutoBuild 配置不能声明或修改高级 Catalog 事实。

The clone-specific configuration has two isolated authorities. `site/wrt/config/site.json` is the sole public-site source for branding, Catalog location and selection/loading policy, web appearance, firmware defaults, and the default build tag. `config/build.json` is the sole build-side source and contains only `password.mode`, `jobs.compile`, `jobs.download`, and `admission.publicActiveBuilds`. The browser reads `site/wrt/config/site.json` only; it must never read or deploy `config/build.json`.

After editing the relevant source in the working tree, run `node tools/dev-assistant.mjs prepare`. It validates both sources and updates `Shell/build-defaults.conf` for build scripts. Commit both configuration sources together with the controlled output produced by `prepare`; generated files are not configuration sources and must not be edited as such.

In `site/wrt/config/site.json`, `project.displayName` and `project.shortName` are presentation-only page-title, short-brand, and notice values; `project.repository` and `project.blogUrl` provide validated link targets only. They do not alter gateway identity, the `[build]` request protocol, or Run/Artifact title formats. `catalog.repository`, `catalog.releaseTag`, `catalog.selection`, and the existing `catalog.loading` scheduling contract describe Catalog location, preferences, and loading order only. Catalog runtime data remains authoritative for Source, Branch, Target/Profile, Kconfig, packages, dependencies, and compatibility facts; project configuration may not copy an inventory or declare advanced Catalog facts. `ui`, `firmware`, and `build.defaultTag` provide web appearance, public firmware defaults, and the web's default build tag.

With password mode `prompt`, the submitter supplies the password; `empty` explicitly requests an empty password; `secret` requires the repository Secret `DEFAULT_ROOT_PASSWORD`. Never write the actual password to `config/build.json`, site files, build requests, Issues, or logs. The translation authorities are `tools/i18n-source.json` and `tools/i18n-translations.json`; `site/wrt/data/i18n/` contains generated bundles only. Keep public wording neutral and do not add tool, model, or vendor names to the public interface.

`site/wrt` is the complete static web-site business source and can be hosted independently. Deploy the entire directory, including `config/`, `data/`, HTML, scripts, and styles. The actual deployment must run from a clean checkout of the committed 40-character SHA after the configuration and controlled output have been committed:

```powershell
node tools/prepare-web-deployment.mjs --commit <40-character SHA> --branch <dev or main>
```

This command creates the ignored `site/wrt/data/build-meta.json`. Deployment must include metadata matching `site-version.json`; missing, invalid, or stale metadata keeps the submission gate disabled. The Pages workflow's site-preparation stage only runs `node tools/stamp-site-version.mjs --check` and `prepare-web-deployment`; it does not modify configuration at deployment time. Independent hosting changes only where the page is published, not build identity: every build request must still correspond to the same commit in the target AutoBuild repository. Catalog remains the sole source for Source, Branch, Target/Profile, packages, Kconfig, dependencies, and compatibility facts; AutoBuild configuration cannot declare or modify advanced Catalog facts.

## 3. Catalog channels and loading / Catalog 通道与加载

AutoBuild code channels bind to data branches:

| AutoBuild | Catalog data |
| --- | --- |
| `fix/*` | `catalog-fix` |
| `dev` | `catalog-dev` |
| `staging` | `catalog-staging` |
| `main` | `catalog-data` |

These are **runtime consumption channels**, not Catalog build destinations. Catalog code and production data have independent lifecycles: Catalog `main` builds only `catalog-candidate`; only the Catalog Production Gate may promote that verified snapshot to `catalog-data`. AutoBuild therefore keeps `main → catalog-data` and never reads `catalog-candidate` at runtime. This separation lets Catalog code reach `main` without implicitly changing production users, while `dev` and `staging` continue to consume their matching data branches.

The browser loads `site/wrt/config/site.json`, then loads the current menu, language shard, and package-mirror projection with bounded startup concurrency. Its `catalog.loading` object controls the low-priority queue for applications, hidden options, help, and compatibility evidence. `config/build.json` is build-side only and is never loaded by the browser. Every asset is checked against its index byte length and SHA-256 contract. A matching immutable cache entry is reused; submit and self-check still await the assets they actually validate. Prefetching compatibility evidence does not evaluate the current selection.

浏览器先读取 `site/wrt/config/site.json`，再以受限启动并发加载当前菜单、语言分片和软件包镜像投影；其中 `catalog.loading` 控制精选应用、隐藏项、帮助和兼容性证据的低优先级队列。`config/build.json` 只供构建端使用，浏览器永不加载。每项资产都按 index 的字节长度与 SHA-256 contract 校验；匹配的不可变缓存可复用，提交与自检仍必须等待实际需要验证的资产。预取兼容性证据不等于评估当前选择。

Catalog 自动发现由 Catalog 配置决定。当前策略覆盖：

- OpenWrt：`main` 与 `openwrt-*`；
- ImmortalWrt：`master` 与 `openwrt-*`；
- LEDE：`master` 与 `openwrt-*`；
- 其他登记源：按各自配置。

未来 `openwrt-26.xx`、`27.xx` 及后续分支由 Catalog 自动发现和发布，AutoBuild 无需每周提交源码。Catalog 的每日翻译也从 `index.json` 枚举 Branch 与 schema 6 语言分片，因此新分支不要求修改翻译代码。

## 4. Selection and serialization / 选择与序列化

Both curated applications and Advanced menuconfig resolve to Catalog `PACKAGE_*` records. The single state transition is:

```text
user intent → catalog-engine dependency/select cascade → state map → Kconfig serializer
```

- bool/tristate use legal Catalog states only;
- string, empty string, literal `n`, escaping, int, hex, and unknown imported symbols retain type-aware serialization;
- Target/Profile and hidden defaults are derived from Catalog, not source-specific JavaScript constants;
- the page never carries a second dependency JSON;
- concrete package/rule names are forbidden in `app.js`.

Advanced menuconfig preserves parentless Catalog `path: []` records under the synthetic UI label **Root Kconfig options / 根级 Kconfig 选项**. This container is distinct from upstream **Global build settings**; removing or merging it would make top-level Kconfig records unreachable. Only the label is local UI text, while the records and their semantics remain Catalog-owned.

## 5. Compatibility evidence / 兼容性证据

`compatibility.json.gz` accepts schemas 2–5. Schema 2 keeps the legacy shape; schema 3 adds exact source-commit, target-scope, and failure evidence; schema 4 adds verified `buildDependency` data. Schema 5 can separate an explicitly reviewed global `preventive` applicability policy from exact `evidence`: wildcard environments match only when the failed package exists, while evidence continues to name only observed Source/Branch/commit identities. Rules use generic fields:

- `issue`: `file-ownership` or `build-failure`;
- `match`: `all-installed` or `all-selected`;
- `scope`: named Source or `*`, with exact Branch or glob;
- one to sixteen package IDs, optional Kconfig condition, paths where applicable, and evidence references.

Execution remains:

```text
evaluateCompatibilityRules
  → deriveCompatibilityPlans
  → applyUserIntent
```

The browser renders data-driven wording, keeps the modal open after applying a recommendation, resets the action when the user changes a relevant state, and requires a second explicit confirmation for force-continue. The backend does not add conflict locks or feed-time package removals.

Compatibility evaluation is on demand: only the bottom-right **Test** control and actual schema-6 JSON generation/download evaluate the final Source/Branch/Target/Kconfig state. Page load, config import, selector changes, plugin changes, and Menuconfig edits do not evaluate the current selection or open a compatibility modal. The immutable evidence asset may be prefetched by the existing low-priority queue, but that prefetch is not an evaluation.

## 6. Build request and Actions identity / 构建请求与 Actions 身份

The browser exports one schema 5 `build-request.json` with:

- exact AutoBuild branch/full commit;
- exact Catalog revision and source asset contract;
- Source/Branch and Catalog build-adapter names;
- Target/Profile build contract and full `.config`;
- user tag, firmware settings, Defconfig state, and forced compatibility evidence.

The default-branch dispatcher freezes the Issue snapshot, validates exact branch HEAD, then dispatches the worker on that exact ref. Run titles and artifacts bind to the Issue:

```text
staging-260810_0857/匿名#161/Generic_x86/64/lede/master/generic
staging-260810_0857-匿名#161-BUILD-LOGS
```

`/cancel` and admission parse the same `#Issue` identity and query the Issue author. Non-owner users are limited to three queued or running builds by one chronological admission policy. The repository owner has no project-level limit, and build jobs use no modulo concurrency slots; GitHub-hosted runner quotas remain external. All downloadable build artifacts retain 60 days; the internal raw bridge retains one day only.

## 7. Package probes / 包级探测

The bottom-right web **检** control opens self-test immediately. Probe and Advanced menuconfig use the same live `menuValues` and the same `setMenuValue()` → `applyMenuValue()` → Catalog/Kconfig intent path. The clicked symbol is never reverse-mapped to a LuCI package: selecting `PACKAGE_x` changes only that symbol and its forward dependencies, while selecting `PACKAGE_luci-app-x` can enable `PACKAGE_x` only when the upstream Kconfig/package relation requires it. Probe's **Selected / 已选择** summary is a one-line diff from the current Source/Branch/Target Kconfig baseline, so upstream defaults are hidden there; overflow is folded behind `+N`. The result list still reflects the complete live Kconfig state. Permanent policy copy is removed from the workspace and opened from an **Info / 说明** action left of Preview. Submit serializes only direct `packageIntent` and compact before/after projections into the Catalog Issue state token. The complete Advanced menuconfig/Defconfig state remains local UI evidence; every Probe environment resolves dependencies again from Catalog Target/Profile selectors and upstream Defconfig. No `probe-request.json` file or second package-selection model exists.

The controller consumes the schema-3 package state serialized by Advanced menuconfig, preserves Baseline, direct Intent, Final `m/y` values, and applies the five-dimensional Catalog environment scope plus coverage without mapping curated application IDs back into packages. The UI renders one Catalog-described, shared-tooltip depth interface in this fixed order: `config-resolve`, `package-compile`, `rootfs-integration`, `firmware-integration`, `boot-smoke`, `runtime-health`, `reboot-validation`. Each Matrix job:

1. shallow/filtered clones one Source/Branch;
2. installs feeds;
3. selects one to eight packages on a Catalog-derived legal Target/Profile, preferring x86/64 for automatic coverage;
4. after implicit `L0` asset validation, runs one of seven generic selectable depths: L1 official config resolution, L2 package compile, L3 RootFS integration, L4 one Final firmware integration, L5 upstream qemustart boot smoke, L6 runtime health, or L7 reboot validation; L2-L7 progressively reuse completed stages;
5. tries configured fallback targets sequentially inside an automatic-target Job and records coverage without treating infrastructure failures as package failures;
6. uploads normalized evidence for 60 days and full logs for 30 days.

The Issue carries one schema-3 compressed state token, not an uploaded request file. Catalog's default-branch gateway validates the state hash, permissions and Issue identity, then dispatches the worker to the request's exact code channel; the worker re-reads the same Issue state before a Matrix exists. The Matrix is capped at 256 jobs. The owner can use the complete planned concurrency without a project cap, other write collaborators are capped at 3, and visitors cannot start it. Source/Branch rows come only from Catalog index. Evidence never edits compatibility rules automatically, and only 100% package-caused failure across all legal environments may become a global incompatibility conclusion. The requester or a write collaborator can reply with exactly `/cancel`; normal cancellation precedes force cancellation.

## 8. Release identity and promotion / 发布身份与晋级

Every AutoBuild change runs `node tools/dev-assistant.mjs prepare`. It canonicalizes site bytes, writes an Asia/Shanghai `VERSION`, synchronizes `site-version.json`, calculates the full-site SHA-256, and runs generic checks. `verify` is read-only.

Normal promotion remains `dev → staging → main`; Catalog and AutoBuild advance independently but each AutoBuild channel reads its matching Catalog data channel. Publish Catalog before the matching AutoBuild channel whenever an asset contract changes.
