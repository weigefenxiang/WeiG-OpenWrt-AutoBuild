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

**[🌐 在线定制](https://www.weigshare.com/wrt/) · [⬇️ 固件下载 / 查看构建](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**语言：** [English](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/blob/dev/README.md) · **简中** · 繁中 · Русский · Español · Português · 日本語 · 한국어 · Deutsch · Français · Tiếng Việt

<details>
<summary><b>🌐 更多语言</b></summary>

العربية · Asturianu · Azərbaycanca · Беларуская · Български · বাংলা · বাংলা (বাংলাদেশ) · Català · Čeština · Dansk · Ελληνικά · فارسی · Suomi · Filipino · Gaeilge · עברית · हिन्दी · Magyar · Bahasa Indonesia · Italiano · ქართული · ລາວ · Lietuvių · Latviešu · മലയാളം · मराठी · Bahasa Melayu · Norsk bokmål · Nederlands · Polski · Português (Brasil) · Română · Slovenčina · Svenska · தமிழ் · Türkçe · Українська · اردو · Màaya t'aan

</details>

**支持源码：** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

## 界面预览

<p align="center">
  <img src="../docs/images/wrt-desktop.png" alt="Wei.G OpenWrt 电脑端界面" width="78.65%"><img src="../docs/images/wrt-mobile.png" alt="Wei.G OpenWrt 手机端界面" width="21.30%">
</p>

## 新手使用：三步在线定制固件

### 1. 选择源码、设备和插件

打开 [**【在线定制页面】**](https://www.weigshare.com/wrt/)，按 **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】** 选择构建目标，在 **【② 勾选插件】** 选择功能，并按需调整 **【Advanced menuconfig】**、时区、主题等选项。

已有配置可点击 **【加载配置】**，导入 `build-request.json`、`.config` 或 `config.buildinfo`，确认源码、设备和插件后继续。

### 2. 提交 GitHub 云编译

提前登录 [**【GitHub】**](https://github.com/login)，再返回 [**【在线定制页面】**](https://www.weigshare.com/wrt/)，依次点击 **【提交云编译】** → **【下载请求并打开 GitHub】**。

网页会下载 `*.json` 请求文件，并自动打开 GitHub Issue 页面。桌面端可将下载的 JSON 文件直接拖入 Issue 的构建请求输入框，然后点击 **【Submit new issue】** 完成提交。

提交成功后，机器人会在 Issue 中回复构建任务链接。

<details>
<summary><strong>提示（点击展开）</strong></summary>

> **提示：** 可以提前点击 **【检】** 查看配置问题和兼容性建议，也可以跳过手动检查。点击 **【下载请求并打开 GitHub】** 时，系统会自动执行配置与兼容性预检。
>
> 如果发现问题，系统会显示原因和修复建议，也可以选择 **【保留并强制继续】**。强制继续不代表问题已解决；如果上游源码 Bug 尚未修复，编译仍有很大概率失败。
>
> 请使用网页自动打开的 GitHub Issue 页面，避免丢失预填的请求信息而导致提交失败。
>
> 仅下载 JSON 请求文件、不提交 Issue，不会开始云编译。
>
> 请勿向公开 Issue、构建请求或日志上传真实密码、令牌等敏感信息。

</details>

### 3. 下载固件

通过 Issue 中的构建链接，或 [Actions → Firmware Download / 固件下载](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml) 找到任务。成功后从底部 **Artifacts** 下载固件；`CONFIG` 为配置，`BUILD-LOGS` 为诊断日志，**不能当作固件刷入**。固件文件保留 **60 天**，请及时下载保存。

**📖 [完整图文教程](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

## 常见问题

<details>
<summary>为什么插件过多时会出现 RootFS 容量不足？</summary>

插件及依赖可能使固件超过 RootFS 容量。对于支持调整分区容量的设备，可在 **【Advanced menuconfig】** → **【Target Images】** 中查找 `TARGET_ROOTFS_PARTSIZE`，按实际需要调整，例如 512 或 1024 MiB。

部分硬路由受闪存容量、分区布局或上游配置限制，无法修改该参数。这时应减少插件，不应照搬 x86 的容量设置。更多案例参见 [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233)。

</details>

<details>
<summary>为什么编译时间过长会导致失败？</summary>

GitHub 托管 Runner 的单个 Job 最长通常为 6 小时。本项目将固件构建 Job 限制为 **350 min（5 小时 50 分钟）**，并设置 **335 min** 编译与诊断执行截止时间，尽量预留日志及证据收集时间。

超过执行时间预算会停止编译，不会暂停并保存进度供下次恢复。插件过多或 Node.js、Rust 等大型依赖都可能增加耗时，可适当精简软件后重新提交。

</details>

<details>
<summary>编译失败后怎么排查？</summary>

进入构建 Run 底部的 **【Artifacts】**，下载 `BUILD-LOGS`，先看 `00-SUMMARY.txt`，再根据日志确认原因。RootFS 容量不足时，应在设备支持的前提下增加容量或减少插件；超时时精简耗时软件；上游源码故障或依赖冲突需按实际错误处理。

可参考 [常见构建失败记录 #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233)。修改配置后重新创建 Issue，不要重跑旧 Run 来验证新配置。

</details>

<details>
<summary>修改旧配置后，应该重跑旧 Run 吗？</summary>

不要用旧 Run 验证新配置。请在当前网页重新加载、检查、导出请求并创建新 Issue；旧 Run 重跑仍使用原请求锁定的代码和数据。
</details>

## 开发与部署

普通用户无需克隆仓库或安装 Node.js。源码、配置和部署说明见 [开发者指南](../docs/DEVELOPER.zh-CN.md) 与 [架构说明](../ARCHITECTURE.md)。

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) 负责采集和发布各源码的分支、设备 Profile、插件、Kconfig 依赖及兼容性数据，供定制网页和云端构建按所选环境使用，无须在 AutoBuild 中另维护一套设备与插件数据库。

## 鸣谢

感谢 [OpenWrt](https://openwrt.org/) / [ImmortalWrt](https://immortalwrt.org/) / [Lean LEDE](https://github.com/coolsnowwolf/lede) / [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x) / [iStoreOS](https://github.com/istoreos/istoreos) / [Lienol](https://github.com/Lienol/openwrt) / [全部插件作者](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) 及所有开源贡献者。

## 许可证

本项目采用 [GNU GPLv3 或更高版本](../LICENSE)。版权与联系方式见 [NOTICE](../NOTICE)。
