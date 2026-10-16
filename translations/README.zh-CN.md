# Wei.G OpenWrt 固件在线定制

在网页选择设备和插件，提交 GitHub 请求，让云端为你编译 OpenWrt 固件。

**📱 手机自适应 · 🌙 明暗主题 · ✅ 支持多种 OpenWrt 系源码**

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

[![GitHub Actions](https://img.shields.io/badge/Build-GitHub%20Actions-2088FF)](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml) [![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](../LICENSE)

**[🌐 在线定制](https://www.weigshare.com/wrt/) · [⬇️ 固件下载 / 查看构建](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**语言：** [English](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/blob/dev/README.md) · **简中** · 繁中 · Русский · Español · Português · 日本語 · 한국어 · Deutsch · Français · Tiếng Việt

<details>
<summary><b>🌐 更多语言</b></summary>

العربية · Asturianu · Azərbaycanca · Беларуская · Български · বাংলা · বাংলা (বাংলাদেশ) · Català · Čeština · Dansk · Ελληνικά · فارسی · Suomi · Filipino · Gaeilge · עברית · हिन्दी · Magyar · Bahasa Indonesia · Italiano · ქართული · ລາວ · Lietuvių · Latviešu · മലയാളം · मराठी · Bahasa Melayu · Norsk bokmål · Nederlands · Polski · Português (Brasil) · Română · Slovenčina · Svenska · தமிழ் · Türkçe · Українська · اردو · Màaya t'aan

> 语言列表参考 OpenWrt / ImmortalWrt / LEDE 的 LuCI 翻译支持；目前 README 仅提供英文和简中，其它语言暂未提供翻译链接。

</details>

**支持源码：** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt)

> 实际可选设备和插件以当前源码、分支与 Target Profile 为准。刷机前请确认设备型号、硬件版本及刷机/救援方法，并备份原有配置。

## 界面预览

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt 电脑端界面" height="320">
  <img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt 手机端界面" height="320">
</p>

## 新手使用：三步在线定制固件

### 1. 选择源码、设备和插件

打开 [在线定制页面](https://www.weigshare.com/wrt/)，按 **Source → Branch → Target System → Subtarget → Target Profile** 选择构建目标，在「② 勾选插件」选择功能，并按需调整 Advanced menuconfig、时区、主题等选项。

已有配置可点「加载配置」，导入 `build-request.json`、`.config` 或 `config.buildinfo`，确认源码、设备和插件后再继续。提交前点击 **「检」** 查看配置问题与兼容性推荐，必要时调整并重新检查。

### 2. 提交 GitHub 云编译

点击 **「提交云编译 → 下载请求并打开 GitHub」**，登录 GitHub，将下载的 `build-request.json` 上传至新打开的 Issue 页面并提交。机器人会在 Issue 回复构建任务链接；**只下载请求文件、不提交 Issue 不会开始编译**。

> 请勿向公开 Issue、构建请求或日志上传真实密码、令牌等敏感信息。

### 3. 下载固件

通过 Issue 中的构建链接，或 [Actions → Firmware Download / 固件下载](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml) 找到任务。成功后从底部 **Artifacts** 下载固件；`CONFIG` 为配置，`BUILD-LOGS` 为诊断日志，**不能当作固件刷入**。产物保留 **60 天**，请及时保存。

**📖 [完整图文教程（简中）](https://weigshare.com/zh-CN/posts/WeiG-OpenWrt-AutoBuild-Guide/)**
## 常见问题

<details>
<summary>找不到我的设备或插件？</summary>

可用项取决于源码、版本和设备。确认完整型号与所选版本；不要用近似型号替代。没有提供的插件不能保证强行启用后能编译。
</details>

<details>
<summary>为什么没有显示插件大小？</summary>

不是所有源、版本和架构都提供可靠的安装大小。页面会区分加载中、加载失败和缺少匹配数据；失败时可以重试。没有大小不影响查看已启用插件清单，也不会凭空显示 0 B。
</details>

<details>
<summary>修改旧配置后，应该重跑旧 Run 吗？</summary>

不要用旧 Run 验证新配置。请在当前网页重新加载、检查、导出请求并创建新 Issue；旧 Run 重跑仍使用原请求锁定的代码和数据。
</details>

## 开发与部署

普通用户无需克隆仓库或安装 Node.js。源码、配置和部署说明见 [开发者指南](../docs/DEVELOPER.md) 与 [架构说明](../ARCHITECTURE.md)。

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) 负责采集和发布各源码的分支、设备 Profile、插件、Kconfig 依赖及兼容性数据，供定制网页和云端构建按所选环境使用，无须在 AutoBuild 中另维护一套设备与插件数据库。

## 鸣谢

感谢 [OpenWrt](https://openwrt.org/) / [ImmortalWrt](https://immortalwrt.org/) / [Lean LEDE](https://github.com/coolsnowwolf/lede) / [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) / [iStoreOS](https://github.com/istoreos/istoreos) / [Lienol](https://github.com/Lienol/openwrt) / [LuCI](https://github.com/openwrt/luci) / [全部插件作者](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) 及所有开源贡献者。

## 许可证

本项目采用 [GNU GPLv3 或更高版本](../LICENSE)。版权与联系方式见 [NOTICE](../NOTICE)。
