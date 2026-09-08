# 开发者指南

## 0. 克隆与项目配置

克隆者要维护两个职责隔离的配置源。克隆仓库后，公开网页与固件默认编辑 `site/wrt/config/site.json`，构建端策略编辑 `config/build.json`，在工作树运行 `prepare`，并将配置与 `prepare` 产生的受控输出一起提交：

```powershell
node tools/dev-assistant.mjs prepare
```

`prepare` 会验证两份配置，并更新构建脚本使用的 `Shell/build-defaults.conf`。生成文件不能作为配置源直接修改；`config/build.json` 永远不随静态网页部署。字段职责固定如下：

- `site/wrt/config/site.json` 的 `project.displayName` 与 `project.shortName` 只用于页面标题、短品牌和通知等展示文案；`project.repository` 与 `project.blogUrl` 只提供经校验的链接目标，不会参与网关身份、`[build]` 请求标记或 Run/Artifact 标题协议。
- `site/wrt/config/site.json` 的 `catalog.repository`、`catalog.releaseTag`、`catalog.selection` 和现有 `catalog.loading` contract 只控制 Catalog 地址、首选项与加载调度。Source、Branch、Target/Profile、插件、Kconfig 和兼容性事实必须继续从 Catalog 数据读取；这里不能维护清单或高级 Catalog 事实。
- `site/wrt/config/site.json` 的 `ui`、`firmware`、`build.defaultTag` 分别提供网页外观、公开固件默认值和网页默认构建标识；它们不扩大请求协议或事实权威边界。
- `config/build.json` 只提供 `password.mode`、`jobs.compile`、`jobs.download` 与 `admission.publicActiveBuilds`。这些值仅供构建端读取，浏览器不能读取。

密码 `mode` 为 `prompt` 时由提交者输入，`empty` 明确使用空密码，`secret` 必须使用仓库 Secret `DEFAULT_ROOT_PASSWORD`。实际密码绝不写入 `config/build.json`、站点文件、构建请求、Issue 或日志。

`site/wrt` 是可独立托管的完整静态网页，部署时必须保留整个目录及其 `config/`、`data/`、HTML、脚本和样式。实际部署必须从包含上述已提交配置与受控输出的 40 位 SHA 的干净 checkout 执行：

```powershell
node tools/prepare-web-deployment.mjs --commit <40位SHA> --branch <dev或main>
```

该命令生成被忽略的 `site/wrt/data/build-meta.json`。部署必须携带与 `site-version.json` 一致的元数据；元数据缺失、非法或陈旧时提交门禁必须保持禁用。Pages workflow 的站点准备阶段只执行 `node tools/stamp-site-version.mjs --check` 和 `prepare-web-deployment`，不在部署现场修改配置。独立部署只改变网页托管位置，不改变构建身份：请求仍必须对应目标 AutoBuild 仓库的同一提交。

网页翻译只编辑 `tools/i18n-source.json` 与 `tools/i18n-translations.json`；`site/wrt/data/i18n/` 是生成包，不能直接修改。

## 1. 不可突破的边界

1. Catalog 是 Source/Branch、Target/Profile、Kconfig、dependency、menu、symbol/type、精选应用、体积与兼容性证据的权威源。
2. AutoBuild 只实现通用加载、状态转换、序列化、请求和构建工具；不得新增第二套大型 dependency JSON。
3. `site/wrt/app.js` 不写具体插件、规则、冲突路径或源码分支特判。
4. 构建端不加插件冲突锁，不在 feeds 安装后静默删除包。兼容性由 Catalog 证据和网页选择完成，用户仍可二次确认后强制继续。
5. 发现一个根因后要覆盖同数据类型、同执行路径和同风险机制；使用匿名动态变异，不堆触发案例矩阵。
6. 每次修改 AutoBuild 必须最后运行 `prepare`，同步 Asia/Shanghai `VERSION` 与 `site-version.json`。

## 2. 数据加载

`site/wrt/config/site.json` 是公开网页配置源；其中 `catalog.loading` 是既有加载调度 contract。`config/build.json` 是构建端配置源，浏览器不得读取：

```json
{
  "catalog": {
    "loading": {
      "startup": ["menu", "menu:language", "package-mirrors"],
      "idle": ["applications", "hidden", "help", "compatibility"],
      "startupConcurrency": 3,
      "idleConcurrency": 1,
      "idleDelayMs": 15000
    }
  }
}
```

菜单、当前语言分片和软件包镜像投影在首帧后以受限并发共同加载；其余资产按空闲队列串行加载，不抢占当前 Source/Branch。缓存的 ref、bytes、SHA-256 一致时直接复用。提交与自检必须等待实际所需资产，不能因后台尚未完成而跳过兼容性检查。

精选插件仍属于空闲资产；插件区域进入视口或获得交互时提升为用户需求加载，但继续复用同一个 Promise、缓存和执行器。数据未到达时必须显示加载状态，失败时显示通用错误与重试入口，禁止用空白区域冒充“没有插件”。

本地预览的虚拟 `build-meta.json` 必须在每次请求时根据当前 VERSION、站点 SHA、Git 分支和提交重新生成，长期开着服务再运行 Prepare 也不能保留启动时身份。部署元数据只有真正不存在的 HTTP 404 可以按主线缺省处理；网络失败、非法 JSON 或与 `site-version.json` 不一致都必须停止加载，禁止静默退回 `main/catalog-data`。

软件包镜像默认值只看所选固件时区，不看浏览器时区：`Asia/Shanghai` 默认自动选择，其他时区默认跟随源码，缺失时按可用项安全回退。时区变化只重算未显式选择的镜像；用户手动或导入的显式选择保持不变，导入校验前等待同一个共享镜像 Promise。镜像下线只从 `config/policies/package-mirrors.json` 这一权威策略删除并重新生成公开投影；历史导入 ID 继续走通用可用项回退。TUNA 已在[官方镜像站源码变更](https://github.com/tuna/mirror-web/commit/9d31d4b34471ca68037993541af8437d866fc885)中宣布于 2026-08-09 停止 OpenWrt 同步，故不再作为可选预设。

顶部构建概览在桌面把弹性宽度留给 Source/Branch/Target Profile 搜索；折叠契约头只显示标题和箭头，完整 Catalog commit 保留在展开内容和无障碍提示。641–960 px 时搜索独占第一行、契约与控件位于第二行、展开内容位于第三行；手机依次全宽堆叠。此布局不得改变独立的 Advanced menuconfig 搜索契约，也不得缩小展开区字号。

公开 `site/wrt/data/` 仅允许部署身份、UI i18n、时区和软件包镜像等运行时资产；公开项目、品牌、固件默认值和 Catalog 选择/加载策略位于 `site/wrt/config/site.json`。`config/build.json` 不得进入静态站点。AutoBuild 已删除机型注册表、种子配置、公共 base config、插件元数据、体积快照和静态软件包说明页。

## 3. Catalog 应用与体积

全局精选应用由 Catalog 的人工刷新工具审计 OpenWrt main、ImmortalWrt master 和 LEDE master 的 LuCI application ID 并求并集；ID 相同即视为同一应用。名单不随每周 Source/Branch 更新自动变化，避免介绍和翻译失控。

Catalog 发布 `applications.json.gz`，包含分组、中文/英文介绍和可选 `sizeBytes`。页面不得额外映射包名。体积由官方 OPKG `Packages` 与 OpenWrt/ImmortalWrt APK `packages.adb` 样本计算依赖闭包后跨源取保守值；原始单位为 bytes，页面按 B/KiB/MiB/GiB 动态显示三位有效数字。无可靠样本时显示未知，不得伪造 1MB 或机型回退值。

Advanced 的菜单说明由 Catalog 每日翻译任务维护。翻译器按数据分支 `index.json` 精确枚举旧单体和 schema 6 `menu:<lang>` 分片，只稀疏读取这些文件，并同步两类资产；不得扫描或改写 `core/graph/applications/compatibility`。默认上海时间 04:37、每次 5 批。未来 Source/Branch 经 index 自动进入翻译，不在 Workflow 写版本清单。

## 4. Kconfig 状态与序列化

普通精选入口和 Advanced menuconfig 必须进入同一 Catalog intent：

```text
applyMenuValue → catalog-engine.applyUserIntent → menuValues
```

Advanced menuconfig 的 `Root Kconfig options / 根级 Kconfig 选项` 是 `path: []` 的通用展示容器，承载没有父菜单的 Catalog 顶层选项；它不等于上游 `Global build settings`，不得合并或删除。菜单文字属于 UI，选项、类型、状态、依赖和层级仍全部来自 Catalog。

兼容性推荐也只能调用 `applyUserIntent`，并与 Advanced menuconfig 共用同一个 Catalog/Kconfig runtime。N/M/Y 由 option 类型、可见性、依赖和合法 states 判断；不可选状态在 UI 灰化/隐藏，不能仅在点击后报错。若为了达到兼容目标需要先关闭上级选择，`deriveCompatibilityPlans` 只能读取共享 runtime 已建立的反向 Kconfig/package 关系并生成有序步骤，`app.js` 不得再实现一套依赖扫描器。

通用回归至少覆盖：bool、tristate、string empty/non-empty、literal `n`、escaping、int、hex、unknown symbol，以及默认表达式的条件、括号、`&&`/`||`、deferred 和闭世界边界。

schema 4 compact relations 会在 compact 编解码 round-trip 中保留 typed default、range、visibility、choice、select/imply 关系、软件包 capability 和表达式 AST。可选 `graphCompact` 使用 relation schema 5（`interned-definitions-edge-rows-v1`），共享定义/表达式并保留 positional edge 身份；声明时优先读取并校验自身 hash/size/schema，未声明时继续支持旧资产，校验失败不能当作回退信号。只有 `relationsComplete: true` 且 `relationCapabilities` 含 `complete-kconfig-relations-v1`，才表示完整 typed relation graph。`packageClosureComplete: true` 与 `packageClosureCapabilities` 中的 `complete-package-build-closure-v1` 是独立且更窄的软件包构建闭包声明，绝不能提升 typed relation 的完整性。两者都只能信任生产者声明；数据缺失或不完整时保持 inconclusive。

索引和已规范化文档按不可变 model/document 身份缓存。Provider 查找、前向依赖者发现复用索引，不能每个符号或候选都扫描全图；健康预检直接复用校验结果，不构造修复计划。失败包已为 N 时可以贡献正向孤儿依赖清理候选，但不能作为新触发证据；用户根操作后，共享、受保护或消费者未决的依赖必须保留。Planner 和网页应用使用同一派生依赖符号集合。回归使用匿名包图、共享/未知消费者与普通 ownership 规则，不能把包名测试样例变成生产特例。

默认值激活既检查 default 自身条件，也检查所属符号的依赖。主题回退与 compatibility 默认值补齐不能为未启用或未知 owner 注入默认值；owner 引用变成已知时，依赖工作队列必须重新求值。隐藏 bool/tristate 的依赖为 UNKNOWN 时保持 deferred。五种 Kconfig 类型均覆盖 active/inactive/unknown owner，且区分原生 baseline 显式值与新推断值。历史导入迁移和按需检查不变：加载不是新增弹窗或不可变版本拒绝点。

共享 runtime 的 lexer 必须与上游一致：bool default `m` 保留为 typed source value，注释只在引号外删除，引号外的 `@` 只产生 ignored-character warning 并继续构建普通 AST，`@` 后的 symbols 不能丢失。没有未求值动态预处理的完整 active-source proof 才能把名称分类为 native undefined；明确经 `parsed-target-filter` 证明的定义才是 external，未证明 omission 保持 unresolved，动态表达式未求值时 relations 必须保持 incomplete。Choice `reset if` 只在原生 mconf/nconf 把非 Y choice member 交互切换为 Y 时清除全局 `S_DEF_USER`；静态导入、Worker 重建和网页不支持的 reset 交互必须明确为 `unsupported`/`deferred`，不能宣称全局 reset 已实现。

## 5. compatibility schema 2/3/4/5

规则文档接受 schema 2–5。schema 2 保留旧规则形状；schema 3 可增加 `sourceCommits`、`targetScope` 和结构化 `failure`；schema 4 可增加规则级 `buildDependency`，并要求精确 `sourceCommits`。schema 5 还允许 `policy: "preventive"`：`environments` 独立定义通配适用范围，`packageAvailability: "if-present"` 使缺少失败目标的环境直接不适用，`evidence` 则只保存真实观察到故障的精确 Source、Branch、提交和引用。schema 4 的软件包构建依赖规则只有在精确 Catalog 图证明“活动软件包根 → 失败包”的路径时才命中；旧 `triggerPackages` 只为读取旧文档保留，不提供新的图触发入口。共享 Kconfig 执行器会生成解除全部当前活动参与者的最少有序步骤，缺失参与者既不报错也不进入方案。普通规则的 Source 可为具体 ID 或单独的 `*`，Branch 可为精确名或 glob。浏览器必须保留实际 schema，并校验 index 合同的 schema、SHA-256、压缩字节数、JSON 字节数和规则数。

执行器固定为：

```text
evaluateCompatibilityRules → deriveCompatibilityPlans → applyUserIntent
```

推荐计划可以包含“先关闭上级选择、再关闭兼容目标”的有序用户步骤，以及由共享 Kconfig runtime 自动产生的下级失效/依赖清理；两者都必须来自同一次通用状态计算。页面只负责展示并按顺序把步骤送回 `applyUserIntent`，不得自行推导依赖关系。

schema 4 的 build-dependency 建议中，Catalog 反向索引只负责找候选；每个候选都必须用自身的前向 dependency、select/imply 和 package-provider 关系证明，然后才生成最少的用户可控根节点与失败包。条件、候选、provider 或边未知/有歧义时结果为 inconclusive，不得猜测告警或动作。

页面文案按 `issue` 通用渲染。推荐按钮应用后弹窗保留；相关值再次变化时按钮恢复为“推荐方案”；强制继续必须进入第二确认视图。`app.js` 内不得出现规则 ID、插件名或冲突文件路径。

兼容性检查按需执行：只有用户单击右下角“检”或真正生成/下载 schema 6 `build-request.json` 时，才针对当时的最终 Source/Branch/Target/Kconfig 运行评估并显示推荐。页面加载、导入 `.config`/JSON、切换 Source/Branch/Target、增删插件和修改 Menuconfig 都不得执行当前选择的兼容性检查或弹窗；兼容性资产可以按既有低优先级队列预取，但预取不等于评估。

## 6. 构建请求和后端

只接受 schema 6 `build-request.json`。请求锁定 Catalog 身份并只携带最小 Target/Profile 身份与 semantic overrides；Worker 从请求锁定的 exact Native Profile baseline 加上 semantic overrides 确定性重建 `reconstructed.config`，它才是最终构建语义权威。不得恢复 submitted full `.config` 第二权威、Worker 端点击重放或用户意图猜测。

Defconfig 默认关闭。开启时只能在 `reconstructed.config` 已经确定之后运行上游 `make defconfig` 做可选 normalization；Defconfig 不得补全缺失 baseline、推导用户意图或替代 Catalog 身份。后端只做格式、最小 Target/Profile 身份、Catalog 契约、固件参数和路径安全校验，不重新判断插件依赖。

无论是否开启 Defconfig，下载和编译前都会只核对 `request-overrides.json` 中的有效 Kconfig 值。门禁不比较整份 `.config`、不读取 `plugins`，也不检查未被覆盖的 baseline 项；显式值被改写时以 `configuration-override-mismatch` 停止，并保存 `config-verification.json`。

编译前 Worker 会对权威 `.config` 做 hash，运行 `make prepare-tmpinfo V=s`，并要求前后 hash 相同且真实的 `tmp/.packageinfo` 非空。随后闭包门禁读取该元数据和上游软件包 Makefile，解析真实 dependency/provider 路径；元数据、候选、条件或路径缺失/有歧义时，在编译前 fail-closed。

## 7. Actions 命名、并发和保留

- Run：`staging-时间/标签#Issue/Target/Source/Branch/Profile`
- Artifact：`staging-时间-标签#Issue-BUILD-LOGS`
- 仓库所有者不受项目级构建并发限制；实际同时运行数仍受 GitHub 托管 Runner 配额约束。
- 非所有者固定最多 3 个排队或运行中的活动构建，按 Issue 创建时间和 Run ID 决定准入；构建不再使用取模槽位，避免空闲容量被碰撞浪费。
- Admission 与 `/cancel` 从新标题解析 `#Issue`，再从 Issue API 核对作者；滚动升级期仍识别旧标题。
- CONFIG、固件、BUILD-LOGS、OPTIONAL-PACKAGES、FIRMWARE-OTHER 全部保留 60 天；内部 RAW-BRIDGE 保留 1 天。

GitHub Actions 原生 Run 日志的保留天数属于仓库 Settings，不由 Workflow YAML 控制；仓库设置建议同样设为 60 天。

## 8. 包级探测

网页右下角“检”立即打开原自检界面；标题栏可进入“插件兼容探针”。Probe 与 Advanced menuconfig 直接共用同一份 `menuValues`，两边点击都只把真实 Kconfig symbol 交给 `setMenuValue()` / `applyMenuValue()`；前端不再把 `PACKAGE_<name>` 反向改写为 `PACKAGE_luci-app-<name>`。因此选择 `PACKAGE_x` 不会反选依赖它的 LuCI 应用，而选择 `PACKAGE_luci-app-x` 时，只有上游 Kconfig/package 关系声明的正向依赖才会自动启用 `PACKAGE_x` 等依赖。Probe 的“已选择”只展示相对当前 Source/Branch/Target Kconfig baseline 发生变化的 `PACKAGE_*`，上游默认启用项不计入；摘要固定一行，超出通过 `+N` 弹层查看。搜索结果本身仍显示完整实时 Kconfig 状态。底部长说明不再常驻，改为“说明”按钮，放在“预览计划”左侧并用弹层展示。

三层软件包名称必须分开：上游 `.config` 使用 `CONFIG_PACKAGE_<name>`，Catalog/Kconfig 模型使用 `PACKAGE_<name>`，构建闭包图使用 `.packageinfo` 与软件包 Makefile 中的真实 `<name>`。virtual capability 只是 provider 名称，不得生成 `CONFIG_`/`PACKAGE_` 符号或可选择软件包记录；owner 自己提供的 capability 也不得与自身冲突。

Probe 提交使用 schema 3：Advanced menuconfig 的最终配置生成链仍用于展示用户直接变化与自动联动，但 Issue 对 L1–L7 一律只携带直接 `packageIntent` 及由它派生的紧凑变更前/后 `CONFIG_PACKAGE_*=m/y` 投影。完整 836 项或 Defconfig 后的 276 项不进入请求；Catalog 服务端再次规范化直接 Root，每个 Source/Branch Job 再用 Catalog Target/Profile 选择器和上游 Defconfig 自动补齐依赖。Source/Branch/Target/Profile 与覆盖参数独立传递，Catalog 不通过 curated application ID 或 `applications.json.gz` 二次映射软件包。

Catalog 资产契约校验是隐含 `L0`，不是用户可选深度。页面把七个短按钮固定在“探测深度”右侧同一行，当前项高亮并显示勾号；完整名称与说明由 Catalog `probeUi.strings` 提供，并通过全站共享 tooltip 展示。顺序固定为：`L1 config-resolve` 官方配置求解、`L2 package-compile` 软件包编译、`L3 rootfs-integration` 根系统集成、`L4 firmware-integration` 单次 Final 固件集成、`L5 boot-smoke` 上游 qemustart 启动自检、`L6 runtime-health` 运行健康、`L7 reboot-validation` 重启验证。L2-L7 逐级复用已完成 Stage，不构建对照固件；所有深度都必须使用上游配置解析，不能关闭 Defconfig。自动目标可在一个 Job 内顺序尝试合法后备目标。Matrix 最多 256 项；仓库所有者使用完整计划并发，其他写协作者强制最多 3，普通访客不能启动 Matrix。规范化证据保留 60 天，完整日志保留 30 天；只有所有合法环境都因软件包原因失败才能判为完全不兼容，证据只供审查，不自动修改规则。

多包共同失败只在全部已计划目标都属于软件包阶段失败后执行有限预算的通用 delta 缩减；它只输出候选最小失败集合。依赖安装、克隆、feeds、构建和启动输出共同组成 30 天完整日志；基础设施、下载、超时和基线固件失败不得进入兼容性结论。

网页不生成或上传独立的 `probe-request.json` / 配置文件；它把 schema-3 状态压缩进 Catalog 专用 Issue 的预填状态字段。默认分支上的轻量 Issue 网关验证状态哈希、权限和 Issue 身份，再把 worker 派发到请求中的精确代码通道；worker 重新读取同一 Issue 状态后才创建 Matrix。网关由 Issue 事件触发，不轮询；它本身必须先晋级到默认分支，之后才能从网页验证 dev/staging/main 全链路。`workflow_dispatch` 仍是管理员回退入口。请求者或具有 write/maintain/admin 权限的协作者可在同一 Issue 准确回复 `/cancel`。

新增插件或规则必须先复用 Catalog 现有数据，横向审计同类型、同执行路径和同风险，再运行探针取得证据；AutoBuild `app.js` 不得新增插件名或专用执行器。探针并发、覆盖、超时和保留期只记录在 Catalog `.github/automation-policy.json`；AutoBuild 只保留通道映射，测试负责阻止数据重复与 YAML/JSON 漂移。

## 9. 测试与发布

```powershell
node tools/test-catalog-engine.mjs
node tools/test-build-closure.mjs
node tools/check-all.mjs
node tools/dev-assistant.mjs prepare
node tools/dev-assistant.mjs verify
node tools/serve.mjs
```

`check-all` 运行独立回归、JSON/目录 allowlist、Catalog-only 静态门禁、Actions 命名/并发/取消和 60 天保留期检查。它不维护具体机型或插件清单。

Catalog 运行数据变化时，先验证并发布该快照，再推 AutoBuild，核对 CI/Pages 及网页实际使用的数据通道；纯代码变化可以复用已验证不可变快照，不能仅因代码晋级重复启动重型生成。正常代码晋级为 `fix-* → dev → staging → main`。Catalog 代码与正式数据生命周期分离：Catalog `main` 只生成 `catalog-candidate`，仅手动 Production Gate 能把已验证候选晋级到 `catalog-main`。AutoBuild 的 dev/staging/main 分别读取 `catalog-dev`/`catalog-staging`/`catalog-main`，不读取 `catalog-candidate`。fix CI 不能代替 dev 网页证据，必须现场核对部署元数据、站点身份、Catalog provenance/assetRef/complete 和交互。

## 10. Catalog 选择与最终配置

Prompt/menu 可见性约束交互编辑，不代表隐藏的原生默认值非法；缺失的 scalar 不作为已启用配置项检查。Worker 重建保留 Native Profile baseline，只核对显式覆盖，不得对整份 baseline 套用交互校验；独立的上游构建闭包检查仍生效。浏览器测试必须等待 Catalog baseline 和字体就绪后再测浮层，不能把页面外壳已显示当作加载完成。

跨 parser/runtime 修改时执行
`node tools/test-catalog-producer-contract.mjs --producer-root <Catalog-checkout>`。
该显式集成测试比较真实 producer 与网页 decoder 的完整定义变体、来源及关系，
并验证 producer typed scalar default 的求值；它不是线上跨仓库运行依赖，
也不替代 Linux 原生解析器与完整生成 CI。编辑器/求值器保存语义字符串：
仅在导入时解码原生 `.config` 字面量，在导出时编码一次。Kconfig 反斜杠不使用
JSON 转义语义；构建请求 JSON 本身仍正常使用 JSON 编码。

`site/wrt/config/site.json` 的 `catalog.selection` 只保存很小的选择策略：Source 优先级、开发分支优先级，以及首选 Target selector 值；`catalog.loading` 只保存现有加载调度 contract。Source/Branch/Target/Profile 的真实清单仍完全来自 Catalog；首选 Target 不存在时必须退回 Catalog 中首个完整有效路径。默认策略只用于首次选择或新 Source/Branch，绝不能覆盖当前控件、有效状态或显式请求。

menu 与 applications shard 无论先后到达，都必须进入同一个 Catalog-ready reconciliation，统一刷新精选应用、Advanced、构建契约、统计和提交门禁。menu 未完成时精选项只能显示为 loading 并禁用，不能永久判为 unavailable。

Advanced 标题按钮、程序定位和搜索框共用一个异步展开协调器；搜索框出现首个非空字符时必须在搜索防抖前立即展开，且不能丢失输入焦点、重复下载或被较早的异步请求反向覆盖。清空搜索不自动折叠。

导入配置时，`Selected options` 语义按钮位于导入统计卡左侧，整个按钮区域都可展开；恢复上传值仍是统计卡内的独立操作。选项工作区位于概览行下方并始终占满整行，折叠时整体隐藏，手机端概览改为上下单列。没有导入统计或没有 Selected-only 状态时，剩余卡片自动占满一行。

最终 `.config` 的主题由 Catalog/Kconfig effective resolver 统一解析：用户显式值优先，否则解析当前 Target/Profile 包、default、dependency/select 与 choice；若仍为空，则按 Catalog 稳定顺序通过同一 `applyUserIntent` 依赖闭包选择首个合法候选，并跳过用户显式关闭项。解析结果及其依赖闭包必须显式写入生成配置。配置下载、自检、提交和固件设置快照共用该结果；无记录或全部候选被显式关闭时才失败，禁止写具体主题名兜底。

## 11. 精选插件选择状态

精选插件的复选框、分组徽标、底部统计、已选清单与构建契约必须共用同一选择状态。Catalog Target 以 `catalogUserOverrides` 为用户意图权威，旧入口才使用本地 selected/removed 集合；`removed` 表示真实排除，禁止计入任何“已选”数字。

用户把值切回 `catalogInheritedValue()` 时，必须通过通用归一器删除多余覆盖并按 restore 状态同步精选插件。默认 `n` 的插件执行“勾选→取消”后不得留下显式 `n`；默认 `y` 的插件取消后仍保留真实排除，重新勾选后再恢复继承状态。依赖与冲突仍只通过 Catalog/Kconfig 的 `applyUserIntent` 执行。

插件复选框具有统一视觉契约：可选未勾选为白色、可选已勾选为强调色、禁用或锁定为灰色，并保留清晰的键盘焦点。样式只依据标准 checked/disabled 状态，不允许按插件名或规则 ID 特判。
