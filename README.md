# WeiG-OpenWrt-AutoBuild

OpenWrt 固件在线定制与 GitHub Actions 云编译工具。网页直接读取 [WeiG-OpenWrt-Menuconfig-Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) 的 Source、Branch、Target/Profile、Kconfig、精选应用、软件包体积与兼容性规则；AutoBuild 不再维护第二套机型、种子配置或插件数据库。

**语言**：简体中文 · [English](translations/README.en.md)

- 定制页面：[Weige Share](https://www.weigeshare.cc.cd/wrt/)
- 构建仓库：[WeiG-OpenWrt-AutoBuild](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild)
- 数据仓库：[WeiG-OpenWrt-Menuconfig-Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog)

## 使用方法

1. 依次选择 **Source → Branch → Target System → Subtarget → Target Profile**。
2. 用精选应用或 Advanced menuconfig 修改配置；N/M/Y、依赖、默认值和可见性均以当前 Catalog 的 Kconfig 为准。
3. 点 **提交云编译 → 下载请求并打开 GitHub**，只上传网页生成的 `build-request.json` 后创建 Issue。
4. Actions 完成后，在 Run 底部下载固件和资料。

网页也可导入 `build-request.json`、`.config` 或 `config.buildinfo`。只有主动启用 **Defconfig** 时，构建端才运行一次上游 `make defconfig`；否则网页导出的完整 `.config` 是权威输入。

## 克隆与项目配置

克隆者或部署者的项目级默认值唯一源是 `config/project.json`。复制仓库后编辑这一个文件，然后运行：

```powershell
node tools/dev-assistant.mjs prepare
```

`prepare` 会校验配置，并重新生成 `site/wrt/data/project.json` 与 `Shell/build-defaults.conf`；这两个文件都是生成投影，不要直接编辑后提交。配置字段边界如下：

| 区块 | 可配置内容 | 边界 |
| --- | --- | --- |
| `project` | `displayName`、`shortName`、仓库地址、博客地址 | 名称只用于站点展示；不会改变网关身份、`[build]` 协议或 Run/Artifact 标题格式 |
| `catalog` | Catalog 仓库、发布标签、Source/Branch 首选顺序、首选 Target selector | Source、Branch、Target/Profile、插件和兼容性事实仍由 Catalog 数据负责，不在这里维护清单 |
| `ui` | 默认语言、颜色模式 | 仅控制网页初始外观 |
| `firmware` | LAN 地址、时区、主题、NTP、软件包镜像、密码模式 | 只提供构建默认值；敏感内容不得写入配置 |
| `build` | 默认构建标识、编译/下载并发 | 仅控制默认值，不能绕过构建请求校验 |
| `admission` | 公共活动构建上限 | 只控制准入策略 |

密码模式为 `prompt` 时由提交者填写；`empty` 表示明确使用空密码；`secret` 模式必须在该仓库的 Secrets 中配置 `DEFAULT_ROOT_PASSWORD`。实际密码绝不能写入 `config/project.json`、生成的站点数据、构建请求、Issue 或日志。

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

- 页面启动后优先下载当前 Source/Branch 的菜单和语言；精选应用、隐藏项、帮助、兼容性规则和镜像策略按 `project.json` 的空闲队列顺序后台加载。
- 精选应用名单、中文/英文介绍与跨源软件包体积都属于 Catalog。应用 ID 相同即视为同一项；体积显示三位有效数字，缺少可靠官方观测时明确显示未知。
- `compatibility.json` 只接受 schema 2。Source 可用 `*`，Branch 可用 glob；规则只描述证据和冲突，网页仍通过同一 Catalog 执行器生成最小修改方案，也允许用户二次确认后强制继续。
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
- 包级回归使用网页自检中的“插件兼容探针”。它复用 Advanced menuconfig 的 Kconfig 状态，并按 Catalog 说明提供 L1 配置求解到 L7 重启验证七级深度；L4 只构建一次 Final 固件，GitHub 在创建 Matrix 前重新校验权限和请求。
- 每次修改 AutoBuild 必须运行 `prepare`，按 Asia/Shanghai 更新 `VERSION` 与 `site-version.json`。
- 克隆后修改默认值只编辑 `config/project.json`，再运行 `prepare` 生成公开投影；不要把 Catalog 的 Source/Branch、Target/Profile 或插件事实复制到本仓库。

更完整的边界和流程见 [ARCHITECTURE.md](ARCHITECTURE.md) 与 [开发者指南](docs/DEVELOPER.md)。

## 许可证

本项目以 [GNU GPLv3 或更高版本](LICENSE) 发布；[中文说明](LICENSE.zh-CN.md) 仅供参考。版权与公开联系方式见 [NOTICE](NOTICE)。

## 鸣谢

[OpenWrt](https://github.com/openwrt/openwrt) · [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [hanwckf mt798x](https://github.com/hanwckf/immortalwrt-mt798x) · LuCI 及所有软件包作者。
