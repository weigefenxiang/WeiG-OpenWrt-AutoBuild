# 项目结构与技术架构

**语言：** [English](../../docs/ARCHITECTURE.md) · **简中** · 繁中 · Русский · Español · Português · 日本語 · 한국어 · Deutsch · Français · Tiếng Việt

<details>
<summary>🌐 更多语言</summary>

<bdi dir="rtl">العربية</bdi> · Asturianu · Azərbaycanca · Беларуская · Български · বাংলা · বাংলা (বাংলাদেশ) · Català · Čeština · Dansk · Ελληνικά · <bdi dir="rtl">فارسی</bdi> · Suomi · Filipino · Gaeilge · <bdi dir="rtl">עברית</bdi> · हिन्दी · Magyar · Bahasa Indonesia · Italiano · ქართული · ລາວ · Lietuvių · Latviešu · മലയാളം · मराठी · Bahasa Melayu · Norsk bokmål · Nederlands · Polski · Português (Brasil) · Română · Slovenčina · Svenska · தமிழ் · Türkçe · Українська · <bdi dir="rtl">اردو</bdi> · Màaya t'aan

</details>

Wei.G OpenWrt AutoBuild 是基于 GitHub Actions 的静态网页固件定制工具。网页以 [Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) 作为上游设备、原生 Kconfig、软件包和兼容性证据的权威数据源。构建 Worker 依据锁定的数据快照重建配置，再调用上游流程编译固件。

## 1. 系统职责边界

```mermaid
flowchart LR
  U["OpenWrt 系上游源码和 feeds"] --> C["Menuconfig Catalog"]
  C -->|"验证过的不可变数据快照"| B["AutoBuild 网页"]
  B -->|"schema 6 构建请求"| I["GitHub 构建 Issue"]
  I --> D["Issue 分发器"]
  D -->|"精确代码和 Catalog 身份"| W["固件构建 Worker"]
  W --> A["固件、配置与诊断日志"]
```

**Menuconfig Catalog 负责数据事实：** 发现 Source/Branch，采集原生 Target/Profile 配置基线、Kconfig 符号及类型关系，发布精选应用、已安装大小观测和限定环境的兼容性证据。不可变资产、校验值与来源信息共同确定网页和 Worker 实际使用的数据。

**AutoBuild 负责交互与编排：** 显示 Catalog 数据，通过共享的原生 Kconfig 求值器处理用户显式选择，展示兼容性建议，导出构建请求并交给 Worker。AutoBuild 不另建设备矩阵、软件包数据库、种子配置清单或按源码特判的依赖引擎。

**固件 Worker 负责重建与执行：** 校验请求及锁定输入，从原生 Profile 基线和语义覆盖重建配置，核对用户显式覆盖的实际值，再执行上游构建命令。网页提供的兼容建议及用户明确作出的强制继续选择，不应被 Worker 的第二套软件包兼容门禁暗中推翻。详见 [运行配置契约](../../docs/RUNTIME-CONFIG-CONTRACT.md)。

## 2. 项目目录

```text
WeiG-OpenWrt-AutoBuild/
├── .github/workflows/               构建分发、Worker、CI、取消和发布
├── Shell/                           通用上游构建适配器
├── config/build.json                构建端配置，不部署给浏览器
├── config/build.schema.json
├── docs/
│   ├── ARCHITECTURE.md              英文架构文档
│   ├── DEVELOPER.md                 英文开发者指南
│   ├── DEVELOPER.zh-CN.md           中文开发者指南
│   └── RUNTIME-CONFIG-CONTRACT.md   配置与执行契约
├── translations/
│   ├── README.zh-CN.md              中文项目介绍
│   └── ARCHITECTURE/
│       └── ARCHITECTURE.zh-CN.md    本中文架构文档
├── site/wrt/
│   ├── config/site.json             公开网页和固件默认配置
│   ├── index.html                   静态网页外壳
│   ├── app.js                       浏览器入口
│   ├── lib/                         Catalog、Kconfig、界面和构建控制模块
│   └── data/                        生成的翻译和部署身份数据
├── tools/                           校验、请求与部署工具
└── VERSION                          代码行为版本
```

`site/wrt/lib/` 的源码按职责划分多个模块；上图仅归纳目录职责，不逐个枚举所有文件。

## 3. 项目配置与部署

项目有两套职责独立的配置权威。

| 文件 | 职责 | 边界 |
| --- | --- | --- |
| `site/wrt/config/site.json` | 品牌、Catalog 地址、Source/Branch 偏好、加载策略、界面和公开固件默认值 | 随网页发布，不含敏感信息，不复制 Catalog 的设备及插件事实 |
| `config/build.json` | 密码模式、编译／下载并发及公开构建准入策略 | 仅构建端使用，绝不作为浏览器静态资源部署 |

真实密码、令牌等敏感信息不得写入公开站点文件、构建请求、Issue 或日志。密码模式和仓库 Secrets 由可信构建端负责处理。

网页翻译的维护源是 `tools/i18n-source.json` 与 `tools/i18n-translations.json`；`site/wrt/data/i18n/` 仅存放生成文件，不另行维护独立翻译副本。

`site/wrt/` 可作为完整静态网站独立部署。部署元数据必须与预期分支、提交及站点身份一致，否则提交入口不可用。配置及生成文件提交后，可通过现有工具按精确提交准备部署：

```powershell
node tools/prepare-web-deployment.mjs --commit <40位SHA> --branch <dev或main>
```

## 4. Catalog 快照与发布通道

AutoBuild 的代码生命周期与 Catalog 的运行数据生命周期独立。仅有代码变更，不意味着必须重新生成或晋级 Catalog 数据。

| AutoBuild 代码分支 | 默认 Catalog 运行数据 |
| --- | --- |
| `fix-*` | 已验证的 `catalog-dev`；需要其他快照时须显式指定并验证 |
| `dev` | `catalog-dev` |
| `staging` | `catalog-staging` |
| `main` | `catalog-main` |

Catalog 数据通道解析到不可变 `assetRef`。浏览器核验数据来源、manifest、长度和哈希；构建请求携带对应的锁定 Catalog 身份；Worker 不能偷偷替换成更新或其它来源的数据。

`catalog-candidate` 属于 Catalog 正式发布前的候选身份层，**不是**浏览器运行数据来源。若运行数据没有变化、原快照仍有效，通道发布应复用原有不可变资产。Source、Branch、Target/Profile、Kconfig、依赖与兼容性事实只能由 Catalog 提供，不能在 AutoBuild 中复制第二份长期清单。

## 5. 网页选择与提交预检

用户依次选择 **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**，再通过精选应用或 **【Advanced menuconfig】** 修改配置。

- 原生 Kconfig 的符号类型、默认值、可见性、选择项、依赖及 `select`/`imply` 语义，均由共享 Catalog 模型求值。显式用户意图与自动推导的联动状态分开保留。
- 网页支持导入已有 `build-request.json`、`.config` 或 `config.buildinfo`，但新的固件构建应从当前验证过的选择重新导出请求。
- 勾选插件或导入配置时，不自动弹出兼容性推荐。用户主动点击 **【检】**，或生成构建请求时，才执行相关原生一致性与限定环境兼容性预检。
- 兼容性推荐针对当前真实配置计算；用户可以应用建议，也可以明确选择 **【保留并强制继续】**。保留意图不等于保证上游能成功编译。
- 软件包容量仅是匹配精确架构及原生版本的参考估计，未知大小不按零计算。插件数量和 RootFS 容量提醒属于建议，不构成新的构建门禁。

## 6. 构建请求与固件 Worker

网页导出的 JSON 构建请求采用 **schema 6**，锁定 AutoBuild 代码提交与 Catalog 数据快照，并记录 Source/Branch、原生 Target/Profile 身份、语义用户覆盖、固件设置和用户确认的风险选择。

默认分支的 Issue 分发器核验请求和提交者，再把构建派发至请求锁定的精确代码提交。Worker 根据同一份锁定的 Catalog 数据，以**原生 Profile 基线 + 用户显式语义覆盖**确定性重建 `reconstructed.config`。

`Defconfig` 默认关闭。用户明确开启时，也只能在权威配置完成重建后，再选择运行上游 `make defconfig`。下载或编译前，Worker 仅核对用户显式 Kconfig 覆盖的最终有效值，不要求整份 `.config` 字节一致，也不建立第二套软件包兼容性判定。

固件构建 Job 上限为 **350 min**，并设置 **335 min** 的执行截止时间，尽量为日志及证据收集预留时间。达到执行时间上限会停止编译，不会暂停并保留进度等待续编。失败时可下载 `BUILD-LOGS`，优先查看 `00-SUMMARY.txt`。正常发布的固件及相关下载文件通常保留 **60 天**。

## 7. Package Probe 属于独立流程

Catalog 侧的 Package Probe 用于收集软件包编译和运行证据，不取代固件 Worker，也不自动成为固件构建兼容性门禁。

其七级深度分别是：L1 配置解析、L2 软件包编译、L3 RootFS 集成、L4 固件集成、L5 启动冒烟测试、L6 运行健康检查、L7 重启验证。L2–L7 默认先执行不安装请求插件的 Baseline，再执行携带用户意图的 Final，并复用已完成的阶段；允许请求显式选择支持的 Final-only 模式。

探测证据必须保留精确 Source/Branch/commit/Target 身份，区分软件包本身故障与上游、基础设施、容量、资源和超时问题。探测结果不会自动修改 Catalog 兼容性规则。

## 8. 验证与分支发布

正常代码晋级路径为 `fix-* → dev → staging → main`。开发必须遵循真实分支父子提交关系；验证通过的 `fix-*` 在条件满足时非强制快进 `dev`。 `staging` 与 `main` 是晋级目标，不直接进行功能开发。只有 Cloudflare Pages 完成该次精确代码版本的部署，才算交付完成。

`VERSION` 表示代码行为版本。纯文档变更不提升版本号；若受跟踪的文档或检查工具变化影响指纹，应使用现有 `--keep-version` 机制刷新发布身份：

```powershell
node tools/dev-assistant.mjs prepare --keep-version
node tools/dev-assistant.mjs verify
```

仓库的 `tools/check-all.mjs` 与专项回归用于核对契约。CI 与 Pages 成功，仅证明对应代码和部署门禁通过，并不意味着每一种上游 Source/Branch/插件组合都已实际编译固件。

参见 [英文开发者指南](../../docs/DEVELOPER.md)、[运行配置契约](../../docs/RUNTIME-CONFIG-CONTRACT.md) 和 [英文架构文档](../../docs/ARCHITECTURE.md)。
