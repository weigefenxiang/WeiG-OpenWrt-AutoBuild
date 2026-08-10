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
    "startup": ["menu", "menu:language"],
    "idle": ["applications", "hidden", "help", "compatibility", "package-mirrors"],
    "startupConcurrency": 2,
    "idleConcurrency": 1,
    "idleDelayMs": 15000
  }
}
```

菜单随页面启动加载；其余资产按空闲队列串行加载，不抢占当前 Source/Branch。缓存的 ref、bytes、SHA-256 一致时直接复用。提交与自检必须等待实际所需资产，不能因后台尚未完成而跳过兼容性检查。

公开 `site/wrt/data/` 仅允许部署身份、UI i18n、时区、项目参数和软件包镜像投影。AutoBuild 已删除机型注册表、种子配置、公共 base config、插件元数据、体积快照和静态软件包说明页。

## 3. Catalog 应用与体积

全局精选应用由 Catalog 的人工刷新工具审计 OpenWrt main、ImmortalWrt master 和 LEDE master 的 LuCI application ID 并求并集；ID 相同即视为同一应用。名单不随每周 Source/Branch 更新自动变化，避免介绍和翻译失控。

Catalog 发布 `applications.json.gz`，包含分组、中文/英文介绍和可选 `sizeBytes`。页面不得额外映射包名。体积由官方 OPKG `Packages` 与 OpenWrt/ImmortalWrt APK `packages.adb` 样本计算依赖闭包后跨源取保守值；原始单位为 bytes，页面按 B/KiB/MiB/GiB 动态显示三位有效数字。无可靠样本时显示未知，不得伪造 1MB 或机型回退值。

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
- `OWNER_BUILD_CONCURRENCY`：仓库所有者并发 1–20，默认 6。
- 非所有者固定最多 3 个活动构建。
- Admission 与 `/cancel` 从新标题解析 `#Issue`，再从 Issue API 核对作者；滚动升级期仍识别旧标题。
- CONFIG、固件、BUILD-LOGS、OPTIONAL-PACKAGES、FIRMWARE-OTHER 全部保留 60 天；内部 RAW-BRIDGE 保留 1 天。

GitHub Actions 原生 Run 日志的保留天数属于仓库 Settings，不由 Workflow YAML 控制；仓库设置建议同样设为 60 天。

## 8. 包级探测

Catalog 的 `Package probe controller` 是手动工具。输入 1–8 个包 ID、Source/Branch glob、`compile` 或 `co-install`、并发数和 dry-run。Controller 从当前 Catalog 数据分支获取所有 Source/Branch，为每个组合派发独立 child Run。

`compile` 把包设为 `m` 后运行 `package/compile`；`co-install` 把包设为 `y`，编译后运行 `package/install`，可发现共同依赖、文件 ownership 或同装失败。它不会构建固件镜像，但 toolchain 和 feeds 首次准备仍需时间。

## 9. 测试与发布

```powershell
node tools/dev-assistant.mjs prepare
node tools/dev-assistant.mjs verify
node tools/serve.mjs
```

`check-all` 运行独立回归、JSON/目录 allowlist、Catalog-only 静态门禁、Actions 命名/并发/取消和 60 天保留期检查。它不维护具体机型或插件清单。

发布顺序：先推 Catalog `dev`，等待 `catalog-dev` 完整发布并验证 root asset 契约；再推 AutoBuild `dev`，等待 CI/Pages，最后在线验证 `index.json`、`applications.json.gz`、`compatibility.json.gz` 与网页实际加载。不要在本轮自动晋级 staging/main。

## 10. 交接

`docs-private/复制给下个ai.txt` 只保留长期硬规则和模板；`docs-private/AI交接指南.txt` 保留精简当前状态、提交 SHA、线上 Run 与未完成事项。不得继续累积聊天流水账。
