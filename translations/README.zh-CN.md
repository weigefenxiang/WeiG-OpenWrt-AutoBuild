# WeiG-OpenWrt-AutoBuild

OpenWrt 固件在线定制与 GitHub Actions 云编译工具。网页直接读取 [WeiG-OpenWrt-Menuconfig-Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) 的 Source、Branch、Target/Profile、Kconfig、精选应用、软件包体积与兼容性规则；AutoBuild 不再维护第二套机型、种子配置或插件数据库。

**语言**：[English](README.en.md) · 简体中文

- 定制页面：[Weige Share](https://www.weigshare.com/wrt/)
- 构建仓库：[WeiG-OpenWrt-AutoBuild](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild)
- 数据仓库：[WeiG-OpenWrt-Menuconfig-Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog)

## 使用方法

1. 依次选择 **Source → Branch → Target System → Subtarget → Target Profile**。
2. 用精选应用或 Advanced menuconfig 修改配置；N/M/Y、依赖、默认值和可见性均以当前 Catalog 的 Kconfig 为准。
3. 点 **提交云编译 → 下载请求并打开 GitHub**，只上传网页生成的 `build-request.json` 后创建 Issue。
4. Actions 完成后，在 Run 底部下载固件和资料。

网页也可导入 `build-request.json`、`.config` 或 `config.buildinfo`。Schema 6 构建以精确的 Catalog Native Profile 基线加语义化用户 overrides 重建权威配置。**Defconfig** 默认关闭；只有用户主动启用时，才在重建完成后作为可选规范化步骤运行。

## 克隆与项目配置

克隆者或部署者要分别维护两个职责隔离的配置源：

- `site/wrt/config/site.json` 是公开网页的唯一配置源，包含品牌、Catalog 地址与选择/加载策略、网页外观、固件默认值和默认构建标识。浏览器只读取这个文件。
- `config/build.json` 是构建端的唯一配置源，只包含密码模式、`jobs.compile`、`jobs.download` 和 `admission.publicActiveBuilds`。它属于仓库根目录，绝不能被浏览器读取或部署到静态站点。

复制仓库后按需编辑对应文件，在工作树运行 `prepare`，并将配置与 `prepare` 产生的受控输出一起提交：

```powershell
node tools/dev-assistant.mjs prepare
```

`prepare` 会校验两份配置并更新构建脚本使用的 `Shell/build-defaults.conf`；生成文件不能作为配置源直接修改。配置字段边界如下：

| 配置文件/区块 | 可配置内容 | 边界 |
| --- | --- | --- |
| `site/wrt/config/site.json` → `project` | `displayName`、`shortName`、仓库地址、博客地址 | 只用于站点展示和链接；不会改变网关身份、`[build]` 协议或 Run/Artifact 标题格式 |
| `site/wrt/config/site.json` → `catalog` | Catalog 仓库、发布标签、Source/Branch 首选顺序、首选 Target selector、加载队列 | Source、Branch、Target/Profile、插件、Kconfig 和兼容性事实仍由 Catalog 数据负责，不在这里维护清单 |
| `site/wrt/config/site.json` → `ui` | 浏览器自动语言、颜色模式 | `defaultLanguage` 保留为兼容字段并固定为 `auto`；按浏览器语言选择，无匹配时使用英文 |
| `site/wrt/config/site.json` → `firmware` | LAN 地址、时区、主题、NTP、软件包镜像 | `timezone` 仍是构建请求缺省值，不覆盖网页浏览器时区检测；敏感内容不得写入配置 |
| `site/wrt/config/site.json` → `build` | 默认构建标识 `defaultTag` | 只提供网页默认值，不能绕过构建请求校验 |
| `config/build.json` → `password` | `mode`：`prompt`、`empty` 或 `secret` | 仅由构建端读取，不属于网页配置 |
| `config/build.json` → `jobs` | `compile`、`download` 并发（整数或 `auto`） | 仅控制构建端并发，不能改变请求语义 |
| `config/build.json` → `admission` | `publicActiveBuilds` | 仅控制公共构建准入上限 |

网页语言由浏览器 `navigator.languages` 自动选择；没有匹配翻译时回退英文。网页时区按“已保存选择 → 浏览器精确匹配 → 相同 UTC 偏移 → `Etc/GMT`”选择；`firmware.timezone` 仍保留为构建请求的默认值，但不会覆盖这次浏览器检测。

密码模式为 `prompt` 时由提交者填写；`empty` 表示明确使用空密码；`secret` 模式必须在该仓库的 Secrets 中配置 `DEFAULT_ROOT_PASSWORD`。实际密码绝不能写入 `config/build.json`、站点文件、构建请求、Issue 或日志。

### 独立部署 `site/wrt`

`site/wrt` 是可独立托管的完整静态网页；将整个目录（包括 `config/`、`data/`、HTML、脚本和样式）部署到 Blog、Pages 或其他静态站点即可。实际部署必须从包含上述已提交配置和受控输出的 40 位 SHA 的干净 checkout 运行：

```powershell
node tools/prepare-web-deployment.mjs --commit <40位SHA> --branch <dev或main>
```

该命令会生成被忽略的 `site/wrt/data/build-meta.json`。部署必须携带与 `site-version.json` 匹配的元数据；元数据缺失、非法或陈旧时，网页会禁用提交。Pages workflow 的站点准备阶段只执行 `node tools/stamp-site-version.mjs --check` 和 `prepare-web-deployment`，不在部署现场修改配置。独立托管只改变网页的发布位置，不改变构建身份：构建请求仍必须对应目标 AutoBuild 仓库的同一提交。Catalog 的 Source、Branch、Target/Profile、插件、Kconfig、依赖和兼容性事实仍全部来自 Catalog；本仓库配置不能声明或修改这些高级 Catalog 事实。

## 产物与命名

Run 显示名采用：

```text
staging-260810_0857/匿名#161/Generic_x86/64/lede/master/generic
```

Artifact 采用：

```text
staging-260810_0857-匿名#161-BUILD-LOGS
```

构建标识仍由用户填写；`#161` 是原始 Build Issue 编号。所有用户可下载的固件、CONFIG、BUILD-LOGS、OPTIONAL-PACKAGES 和 FIRMWARE-OTHER 统一保留 **60 天**。仅供同一 Run 内部转发原始镜像的 RAW-BRIDGE 保留 1 天并在发布后删除。

## 数据与兼容性

- 页面启动后优先下载当前 Source/Branch 的菜单和语言；精选应用、隐藏项、帮助、兼容性规则和镜像策略按 `site/wrt/config/site.json` 中 `catalog.loading` 的空闲队列顺序后台加载。
- 精选应用名单、中文/英文介绍与跨源软件包体积都属于 Catalog。应用 ID 相同即视为同一项；体积显示三位有效数字，缺少可靠官方观测时明确显示未知。
- `compatibility.json` 接受 schema 2–5。schema 4 可通过 `buildDependency` 将已验证的构建故障绑定到一个构建包及直接触发入口；schema 5 可把精确观测保存在 `evidence`，并让经明确审核的 `preventive` 策略仅在失败包真实存在的通配环境中适用。规则仍只是数据，网页继续使用同一通用 Catalog/Kconfig 执行器生成建议并保留强制继续。
- AutoBuild 不做每周数据同步；未来 Source/Branch 和 Catalog 数据分支发布后，网页自动读取，无需更新 AutoBuild 源码。

## 快速测试

```powershell
node tools/dev-assistant.mjs prepare
node tools/dev-assistant.mjs verify
```

本地预览：

```powershell
node tools/serve.mjs
```

打开 <http://localhost:8642/>，测试 Source/Branch 切换、Target/Profile、精选应用、Advanced menuconfig、兼容性弹窗、自检和请求下载。

## 维护边界

- Catalog 是 Kconfig、dependency、menu、symbol/type、Source/Branch、精选应用、体积和兼容性规则的权威数据源。
- `site/wrt/app.js` 不得写具体插件或规则特判；构建端不加插件冲突锁。
- 新增或调整精选应用请在 Catalog 运行人工刷新工具并审核介绍；体积由官方 OPKG/APK 索引自动计算。
- 修改网页翻译请编辑 `tools/i18n-source.json` 与 `tools/i18n-translations.json`；`site/wrt/data/i18n/` 是生成包，不要直接编辑。
- 包级回归使用网页自检中的“插件兼容探针”。它复用 Advanced menuconfig 的 Kconfig 状态，并按 Catalog 说明提供 L1 配置求解到 L7 重启验证七级深度。L2-L7 默认在同一 Job 内执行 Baseline B → Final A 对照；只有显式选择 Final-only 才关闭对照。GitHub 在创建 Matrix 前重新校验权限和请求。
- 每次修改 AutoBuild 必须运行 `prepare`，按 Asia/Shanghai 更新 `VERSION` 与 `site-version.json`。
- 克隆后按职责分别编辑 `site/wrt/config/site.json` 与 `config/build.json`，再运行 `prepare`；不要把 Catalog 的 Source/Branch、Target/Profile 或插件事实复制到本仓库。

更完整的边界和流程见 [ARCHITECTURE.md](../ARCHITECTURE.md) 与 [开发者指南](../docs/DEVELOPER.md)。

## 许可证

本项目以 [GNU GPLv3 或更高版本](../LICENSE) 发布；[中文说明](../LICENSE.zh-CN.md) 仅供参考。版权与公开联系方式见 [NOTICE](../NOTICE)。

## 鸣谢

[OpenWrt](https://github.com/openwrt/openwrt) · [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [hanwckf mt798x](https://github.com/immortalwrt/immortalwrt-mt798x) · LuCI 及所有软件包作者。
