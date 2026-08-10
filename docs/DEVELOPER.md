# 开发者指南

## 1. 不可突破的边界

1. Catalog 是 Source/Branch、Target/Profile、Kconfig、dependency、menu、symbol/type、精选应用、体积与兼容性证据的权威源。
2. AutoBuild 只实现通用加载、状态转换、序列化、请求和构建工具；不得新增第二套大型 dependency JSON。
3. `site/wrt/app.js` 不写具体插件、规则、冲突路径或源码分支特判。
4. 构建端不加插件冲突锁，不在 feeds 安装后静默删除包。兼容性由 Catalog 证据和网页选择完成，用户仍可二次确认后强制继续。
5. 发现一个根因后要覆盖同数据类型、同执行路径和同风险机制；使用匿名动态变异，不堆触发案例矩阵。
6. 每次修改 AutoBuild 必须最后运行 `prepare`，同步 Asia/Shanghai `VERSION` 与 `site-version.json`。

## 2. 数据加载

`site/wrt/data/project.json` 是加载顺序参数：

```json
{
  "catalogLoadPolicy": {
    "startup": ["menu", "menu:language", "package-mirrors"],
    "idle": ["applications", "hidden", "help", "compatibility"],
    "startupConcurrency": 3,
    "idleConcurrency": 1,
    "idleDelayMs": 15000
  }
}
```

菜单、当前语言分片和软件包镜像投影在首帧后以受限并发共同加载；其余资产按空闲队列串行加载，不抢占当前 Source/Branch。缓存的 ref、bytes、SHA-256 一致时直接复用。提交与自检必须等待实际所需资产，不能因后台尚未完成而跳过兼容性检查。

精选插件仍属于空闲资产；插件区域进入视口或获得交互时提升为用户需求加载，但继续复用同一个 Promise、缓存和执行器。数据未到达时必须显示加载状态，失败时显示通用错误与重试入口，禁止用空白区域冒充“没有插件”。

本地预览的虚拟 `build-meta.json` 必须在每次请求时根据当前 VERSION、站点 SHA、Git 分支和提交重新生成，长期开着服务再运行 Prepare 也不能保留启动时身份。部署元数据只有真正不存在的 HTTP 404 可以按主线缺省处理；网络失败、非法 JSON 或与 `site-version.json` 不一致都必须停止加载，禁止静默退回 `main/catalog-data`。

软件包镜像默认值只看所选固件时区，不看浏览器时区：`Asia/Shanghai` 默认自动选择，其他时区默认跟随源码，缺失时按可用项安全回退。时区变化只重算未显式选择的镜像；用户手动或导入的显式选择保持不变，导入校验前等待同一个共享镜像 Promise。

顶部构建概览在桌面把弹性宽度留给 Source/Branch/Target Profile 搜索；折叠契约头只显示标题和箭头，完整 Catalog commit 保留在展开内容和无障碍提示。641–960 px 时搜索独占第一行、契约与控件位于第二行、展开内容位于第三行；手机依次全宽堆叠。此布局不得改变独立的 Advanced menuconfig 搜索契约，也不得缩小展开区字号。

公开 `site/wrt/data/` 仅允许部署身份、UI i18n、时区、项目参数和软件包镜像投影。AutoBuild 已删除机型注册表、种子配置、公共 base config、插件元数据、体积快照和静态软件包说明页。

## 3. Catalog 应用与体积

全局精选应用由 Catalog 的人工刷新工具审计 OpenWrt main、ImmortalWrt master 和 LEDE master 的 LuCI application ID 并求并集；ID 相同即视为同一应用。名单不随每周 Source/Branch 更新自动变化，避免介绍和翻译失控。

Catalog 发布 `applications.json.gz`，包含分组、中文/英文介绍和可选 `sizeBytes`。页面不得额外映射包名。体积由官方 OPKG `Packages` 与 OpenWrt/ImmortalWrt APK `packages.adb` 样本计算依赖闭包后跨源取保守值；原始单位为 bytes，页面按 B/KiB/MiB/GiB 动态显示三位有效数字。无可靠样本时显示未知，不得伪造 1MB 或机型回退值。

Advanced 的菜单说明由 Catalog 每日翻译任务维护。翻译器按数据分支 `index.json` 精确枚举旧单体和 schema 6 `menu:<lang>` 分片，只稀疏读取这些文件，并同步两类资产；不得扫描或改写 `core/graph/applications/compatibility`。默认上海时间 04:37、每次 5 批。未来 Source/Branch 经 index 自动进入翻译，不在 Workflow 写版本清单。

## 4. Kconfig 状态与序列化

普通精选入口和 Advanced menuconfig 必须进入同一 Catalog intent：

```text
applyMenuValue → catalog-engine.applyUserIntent → menuValues
```

兼容性推荐也只能调用 `applyUserIntent`。N/M/Y 由 option 类型、可见性、依赖和合法 states 判断；不可选状态在 UI 灰化/隐藏，不能仅在点击后报错。

通用回归至少覆盖：bool、tristate、string empty/non-empty、literal `n`、escaping、int、hex、unknown symbol，以及默认表达式的条件、括号、`&&`/`||`、deferred 和闭世界边界。

## 5. compatibility schema 2

规则文档只接受 schema 2。Source 可为具体 ID 或单独的 `*`；Branch 可为精确名或 glob。`*` Source 不得和具体 Source 混用。规则支持一个软件包，因此已知单包构建失败不需要伪造“两包冲突”。

执行器固定为：

```text
evaluateCompatibilityRules → deriveCompatibilityPlans → applyUserIntent
```

页面文案按 `issue` 通用渲染。推荐按钮应用后弹窗保留；相关值再次变化时按钮恢复为“推荐方案”；强制继续必须进入第二确认视图。`app.js` 内不得出现规则 ID、插件名或冲突文件路径。

## 6. 构建请求和后端

只接受一个 schema 5 `build-request.json`。解析器从固定 Catalog revision 的 index 获取 Source repository、Branch 和 `build.diy1/diy2`；完整 `.config` 是权威配置。请求不再接受第二套 `packages` 字段，也不读取本地机型或插件白名单。

Defconfig 开启时上游只运行一次 `make defconfig`；关闭时保持网页配置。后端只做格式、Target/Profile、Catalog 契约、固件参数和路径安全校验，不重新判断插件依赖。

## 7. Actions 命名、并发和保留

- Run：`staging-时间/标签#Issue/Target/Source/Branch/Profile`
- Artifact：`staging-时间-标签#Issue-BUILD-LOGS`
- 仓库所有者不受项目级构建并发限制；实际同时运行数仍受 GitHub 托管 Runner 配额约束。
- 非所有者固定最多 3 个排队或运行中的活动构建，按 Issue 创建时间和 Run ID 决定准入；构建不再使用取模槽位，避免空闲容量被碰撞浪费。
- Admission 与 `/cancel` 从新标题解析 `#Issue`，再从 Issue API 核对作者；滚动升级期仍识别旧标题。
- CONFIG、固件、BUILD-LOGS、OPTIONAL-PACKAGES、FIRMWARE-OTHER 全部保留 60 天；内部 RAW-BRIDGE 保留 1 天。

GitHub Actions 原生 Run 日志的保留天数属于仓库 Settings，不由 Workflow YAML 控制；仓库设置建议同样设为 60 天。

## 8. 包级探测

网页右下角“检”立即打开原自检界面；自检标题栏在关闭按钮左侧显示“插件兼容探针”，点击后打开响应式网页内工作区。工作区的文案、应用映射和 Source/Branch 清单全部来自 Catalog；用户可搜索并选择最多 8 个应用，设置深度、范围、Target 覆盖，预览精确请求、复制请求或打开自动填好的 GitHub Issue。

探针请求为 schema 1，可输入 1–8 个 Catalog 应用 ID 或 package ID，选择全部/当前/指定 Source/Branch，以及自动目标、当前 Target/Profile 或全部代表目标。Controller 从当前代码频道对应的数据分支获取并校验 `index.json`、`applications.json.gz` 与匹配 Branch 的 `core` 分片，用应用 ID 解析真实包，再生成动态 Matrix；不得维护 Source/Branch 或 Target 版本表。

四个深度依次是：`package-compile` 编译包与依赖闭包；`rootfs-integration` 安装进 RootFS 发现 ownership/同装问题；`firmware-integration` 在同一环境构建基础固件与加入软件包的固件作 A/B 对照；实验性的 `boot-smoke`（界面中文固定为“启动自检”）只检查 Catalog 允许目标的通用启动标志。自动目标可在一个 Job 内顺序尝试合法后备目标。Matrix 最多 256 项；仓库所有者使用完整计划并发，其他写协作者强制最多 3，普通访客不能启动 Matrix。规范化证据保留 60 天，完整日志保留 30 天；只有所有合法环境都因软件包原因失败才能判为完全不兼容，证据只供审查，不自动修改规则。

多包共同失败只在全部已计划目标都属于软件包阶段失败后执行有限预算的通用 delta 缩减；它只输出候选最小失败集合。依赖安装、克隆、feeds、构建和启动输出共同组成 30 天完整日志；基础设施、下载、超时和基线固件失败不得进入兼容性结论。

网页只在 Issue 隐藏块中提交短 Base64URL 请求；Catalog Workflow 在创建 Matrix 前重新验证权限、schema、资产合约、包映射、Source/Branch 与 Target/Profile。`workflow_dispatch` 是管理员回退入口。Issue 触发只在默认分支上的 Workflow 生效，因此 dev/staging 验证先使用手动派发，待 main 晋级后再验证网页 Issue 全链路。

新增插件或规则必须先复用 Catalog 现有数据，横向审计同类型、同执行路径和同风险，再运行探针取得证据；AutoBuild `app.js` 不得新增插件名或专用执行器。探针并发、覆盖、超时和保留期只记录在 Catalog `.github/automation-policy.json`；AutoBuild 只保留通道映射，测试负责阻止数据重复与 YAML/JSON 漂移。

## 9. 测试与发布

```powershell
node tools/dev-assistant.mjs prepare
node tools/dev-assistant.mjs verify
node tools/serve.mjs
```

`check-all` 运行独立回归、JSON/目录 allowlist、Catalog-only 静态门禁、Actions 命名/并发/取消和 60 天保留期检查。它不维护具体机型或插件清单。

发布顺序：同一频道总是先推 Catalog，等待数据分支发布并验证 root asset 契约，再推 AutoBuild，等待 CI/Pages，最后在线验证 `index.json`、`applications.json.gz`、`compatibility.json.gz` 与网页实际加载。正常晋级为 `dev → staging → main`。

## 10. 交接

`docs-private/复制给下个ai.txt` 只保留长期硬规则和模板；`docs-private/AI交接指南.txt` 保留精简当前状态、提交 SHA、线上 Run 与未完成事项。不得继续累积聊天流水账。

## 11. Catalog 选择与最终配置

`site/wrt/data/project.json` 只保存很小的选择策略：Source 优先级、开发分支优先级，以及首选 Target selector 值。Source/Branch/Target/Profile 的真实清单仍完全来自 Catalog；首选 Target 不存在时必须退回 Catalog 中首个完整有效路径。默认策略只用于首次选择或新 Source/Branch，绝不能覆盖当前控件、有效状态或显式请求。

menu 与 applications shard 无论先后到达，都必须进入同一个 Catalog-ready reconciliation，统一刷新精选应用、Advanced、构建契约、统计和提交门禁。menu 未完成时精选项只能显示为 loading 并禁用，不能永久判为 unavailable。

Advanced 标题按钮、程序定位和搜索框共用一个异步展开协调器；搜索框出现首个非空字符时必须在搜索防抖前立即展开，且不能丢失输入焦点、重复下载或被较早的异步请求反向覆盖。清空搜索不自动折叠。

导入配置时，`Selected options` 语义按钮位于导入统计卡左侧，整个按钮区域都可展开；恢复上传值仍是统计卡内的独立操作。选项工作区位于概览行下方并始终占满整行，折叠时整体隐藏，手机端概览改为上下单列。没有导入统计或没有 Selected-only 状态时，剩余卡片自动占满一行。

最终 `.config` 的主题由 Catalog/Kconfig effective resolver 统一解析：用户显式值优先，否则解析当前 Target/Profile 包、default、dependency/select 与 choice；若仍为空，则按 Catalog 稳定顺序通过同一 `applyUserIntent` 依赖闭包选择首个合法候选，并跳过用户显式关闭项。解析结果及其依赖闭包必须显式写入生成配置。配置下载、自检、提交和固件设置快照共用该结果；无记录或全部候选被显式关闭时才失败，禁止写具体主题名兜底。

## 12. 精选插件选择状态

精选插件的复选框、分组徽标、底部统计、已选清单与构建契约必须共用同一选择状态。Catalog Target 以 `catalogUserOverrides` 为用户意图权威，旧入口才使用本地 selected/removed 集合；`removed` 表示真实排除，禁止计入任何“已选”数字。

用户把值切回 `catalogInheritedValue()` 时，必须通过通用归一器删除多余覆盖并按 restore 状态同步精选插件。默认 `n` 的插件执行“勾选→取消”后不得留下显式 `n`；默认 `y` 的插件取消后仍保留真实排除，重新勾选后再恢复继承状态。依赖与冲突仍只通过 Catalog/Kconfig 的 `applyUserIntent` 执行。

插件复选框具有统一视觉契约：可选未勾选为白色、可选已勾选为强调色、禁用或锁定为灰色，并保留清晰的键盘焦点。样式只依据标准 checked/disabled 状态，不允许按插件名或规则 ID 特判。
