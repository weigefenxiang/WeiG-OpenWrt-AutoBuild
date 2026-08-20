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
- 包级回归使用网页自检中的“插件兼容探针”。它复用 Advanced menuconfig 的 Kconfig 状态，并按 Catalog 说明提供 L1 配置求解到 L7 重启验证七级深度；L4 只构建一次 Final 固件，GitHub 在创建 Matrix 前重新校验权限和请求。
- 每次修改 AutoBuild 必须运行 `prepare`，按 Asia/Shanghai 更新 `VERSION` 与 `site-version.json`。

更完整的边界和流程见 [ARCHITECTURE.md](ARCHITECTURE.md) 与 [开发者指南](docs/DEVELOPER.md)。

## 许可证

本项目以 [GNU GPLv3 或更高版本](LICENSE) 发布；[中文说明](LICENSE.zh-CN.md) 仅供参考。版权与公开联系方式见 [NOTICE](NOTICE)。

## 鸣谢

[OpenWrt](https://github.com/openwrt/openwrt) · [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [hanwckf mt798x](https://github.com/hanwckf/immortalwrt-mt798x) · LuCI 及所有软件包作者。
