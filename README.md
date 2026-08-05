# WeiG-OpenWrt-AutoBuild

![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-f7df1e?logo=javascript&logoColor=black)
![HTML](https://img.shields.io/badge/HTML-5-e34f26?logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS-3-1572b6?logo=css3&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![Bash](https://img.shields.io/badge/Bash-5-4eaa25?logo=gnubash&logoColor=white)
![YAML](https://img.shields.io/badge/YAML-1.2-cb171e?logo=yaml&logoColor=white)

**语言**: 简 · [繁](translations/README.zh-TW.md) · [English](translations/README.en.md) · [Русский](translations/README.ru.md) · [Español](translations/README.es.md) · [Português](translations/README.pt.md) · [日本語](translations/README.ja.md) · [한국어](translations/README.ko.md) · [Deutsch](translations/README.de.md) · [Français](translations/README.fr.md) · [Tiếng Việt](translations/README.vi.md)

OpenWrt 固件**在线定制 + 云编译**。在 [网站](https://wrt.weigeshare.cc.cd/wrt/) 选品牌、型号、插件,GitHub Actions 自动编译,免费自取。

当前仅以下机子为完整维护机型

 **360T7(MT7981)** 
 
 页面里其余 200+ 台机型以**种子模式**开放(仅保证"能刷"、未经实机验证,风险自担。


- 定制页面：[主站 Page](https://www.weigeshare.cc.cd/wrt/) 
- 三种源码：[ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [OpenWrt](https://github.com/openwrt/openwrt) · [Lean](https://github.com/coolsnowwolf/lede)
- **版本分支**：ImmortalWrt 收录全部远程分支；OpenWrt 收录 `main` 与全部 `openwrt-*` 分支，排除 `lede-17.01`、`pcs-standalone-back`、`master`。

网页会按“源码＋分支＋设备 Profile”生成独立配置，只显示该设备真实存在的分支与布局。

---

## 我是用户:怎么定制固件

1. 打开 [定制页面](https://wrt.weigeshare.cc.cd/)，依次选择 **Source → Branch → Target System → Subtarget → Target Profile → 插件**，再填写“构建标识”（方便定位固件）。

2. 点 **提交云编译 → 下载请求并打开 GitHub**，在跳转后的页面只上传刚下载的 `build-request.json`，再点 **Create**；不需要填写机型、源码、版本或分区参数（需登录 GitHub 账号）。已有 `.config` 或 `config.buildinfo` 请先在网页点“加载配置”，识别机型后再提交。

3. 机器人会在 issue 里回复本次构建的链接,整机编译约 **2~3 小时**。

4. 构建完成后,机器人回复通知,打开构建页面,在底部 

**Artifacts** 下载:

   - `时间戳-原文件名.img.gz`:每个最终镜像独立下载，不套 ZIP；首次刷机通常选择含 `factory` 的文件；
   - `时间戳-CONFIG`:用户提交配置、实际开编配置与构建元数据，可留档复现；
   - `时间戳-BUILD-LOGS`:完整下载/编译日志与报错摘录，成功或失败都会提供，保留 14 天；
   - `时间戳-OPTIONAL-PACKAGES` / `时间戳-FIRMWARE-OTHER`:M 软件包，以及 manifest、buildinfo、校验和等辅助资料。
5. 也可以不编译：点 **提交云编译 → 仅下载 .config**，立即拿到按当前选择生成的配置。只有用户主动勾选 **Defconfig** 时，Actions 才执行一次 `make defconfig`；未勾选时完整 `.config` 保持权威输入。下载构建请求 JSON 前，网页会按 `config/001.presets/source-build-requirements.json` 显示当前源码必须具备的配置项，只有用户明确应用后才允许下载。绕过网页提交缺项 JSON，也会在 Issue 解析阶段被拒绝。
6. 页面可加载 `build-request.json`、`.config`、`config.buildinfo`；时区提供 OpenWrt/LuCI 完整 IANA 列表并支持搜索，统一显示为 `(UTC±HH:MM) Region/City`。页面还可选择固件 LuCI 主题、NTP 与 opkg 镜像，提交确认框会再次列出品牌、型号、源码、版本、分区及网页版本。

> 💡 刷好固件后:浏览器访问
 **192.168.1.1** 
 
 用户名: **root**   
 
密   码: **空**
 
 —— Lean 源初始密码是 `password`(默认为空)。
>
> 💡 页面右上角有 **自检** 按钮:一键检测连通性(本地/jsDelivr/raw 三级)、.config 生成逻辑、GitHub 连通性,加载异常时先点它排查。
>
> 💡 勾选带依赖的插件（如 MWAN3 分流助手）会自动帮你勾上前置插件;内核依赖编译时会自动补全,无需操心。
>
> ⚠️ 下载 Artifacts 必须登录 GitHub（ GitHub 的限制）。固件、配置和构建信息保留 30 天, `日志 log` 保留 14 天。
>
> ⚠️ 刷机有风险。如 **108M 大分区** 、 **原厂分区**

### 在 Actions 里找到自己的固件

构建列表按 `Build 定制 · 你的标识 · 源码 版本/固件` 命名,认准自己填的标识即可:仓库 → **Actions** → **custom-build**。

## Fork 自建

如公共仓库排队拥挤,或有特殊需求配置,可以完全自助：

1. 点右上角**⭐Star** 和 **Fork** 把本仓库复刻到你的账号;
2. 到你的 Fork 里 **Settings → Features 勾选 Issues**,再到 **Actions 页面点绿色按钮启用 workflows**;
3. 回到定制页面,第 ④ 步选 **我自己的 Fork** 并填入你的 GitHub 用户名,之后提交的项目就跑在你自己的仓库里;
4. 网页会先下载 `build-request.json`，再打开只有一个必填附件框的 Issue 表单；上传该文件并提交即可。Actions 直接采用文件内的完整 `.config`，不会再从仓库 base config 重建。

## 我是维护者:怎么加插件 / 改配置
<details>
<summary>点击展开查看内容</summary>

数据流:`config/<品牌>/<机型>/*.config`(旧配置导入与历史请求兼容;360T7 当前有 14 份源码/分支/Profile 配置)

`tools/plugins-meta.json`(中文名/分组/说明)→ `tools/gen-plugins.mjs` 生成 → `site/wrt/data/`。新构建参数由 `WeiG-OpenWrt-Menuconfig-Catalog` 动态提供，每次构建以网页导出的 `build-request.json` 内完整 `.config` 为最终输入。
</details>



### 新增一个插件选项

<details>
<summary>点击展开查看内容</summary>

1. 在目标源码/分支的 Catalog 中确认该包存在；若还要维护旧设备兼容层，再确认对应 base config 有 `# CONFIG_PACKAGE_luci-app-xxx is not set` 行；

2. 在 `tools/plugins-meta.json` 的 `plugins` 数组里加一条:`{ "id": "xxx", "name": "中文名", "group": "分组", "desc": "一句话说明", "size": 2, "hot": false }`(包名与 `luci-app-` 后缀不同或三源不同名时,加 `pkgs` 字段显式映射;

3. 有 luci-app 层前置插件时加 `requires: ["前置id"]`,页面会自动联动勾选);

4. 跑 `node tools/gen-plugins.mjs`,脚本会重新生成 `site/wrt/data/360t7/plugins.json`,并确保 base config 只保留在 `config/` 权威目录,同时对"配置里有但没收录"的插件给出警告;
5. 提交 push。页面无需改任何代码,新选项自动出现。

</details>

### 开启/新增一台路由器机型

<details>
<summary>点击展开查看内容</summary>
机型目录在 `site/wrt/data/devices.json`,按品牌组织;360T7 为完整维护档,其余机型为**种子模式**(sources 由模板生成、共用种子插件表、仅保证能开机)。把一台种子机型升级为完整维护档的步骤:

1. 在 `devices.json` 找到该机型,按真实情况补全 `sources`(每源的 config 文件名、versions 分支、variants 变体与分区替换对);
2. 在 `config/<品牌>/<机型id>/` 放上各源的 base 配置,命名规范 `<品牌>_<机型>_<源>.config`(仓库已为大部分机型生成了"最精简能开机"的种子配置,只含目标机型 + LuCI,可直接用或在其上加料);
3. 跑 `node tools/gen-plugins.mjs`(会为每台启用的机型生成各自的 plugins.json);
4. 冒烟:每个源各跑一次云编译确认能出图。

页面与 workflow 代码零改动,`device` 参数照常白名单校验。
</details>

### 目录结构与技术架构

见 [ARCHITECTURE.md](ARCHITECTURE.md)(中英双语)。

### 安全

- Issue 接受 1~3 个 GitHub 自有附件并自动识别 `build-request.json`、`.config`、`config.buildinfo`;请求字段、插件/软件包 id、配置格式、大小、机型目标签名及源码必需项都会校验。完整配置默认是用户提交的权威输入；只有用户主动勾选 Defconfig 时 Actions 才执行一次 `make defconfig` 并校验 Target/Profile/架构与必需包，实际开编配置会随 artifact 一并保留;
- 构建标识(tag)会被清洗为中英文数字与连字符,仅用于 artifact 命名与展示;
- workflow 权限收敛为 `contents: read + issues: write`。

### 文档多语言维护约定

**每次修改本 README ,必须同步更新 `translations/` 下对应语言版本**;开发者文档同理(`docs/DEVELOPER.md` ↔ `docs/DEVELOPER.en.md`)。这是硬性规矩,防止各语言版本漂移。

## 鸣谢

- **源码：** [OpenWrt](https://github.com/openwrt/openwrt) · [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [LEDE](https://github.com/coolsnowwolf/lede) · [hanwckf mt798x](https://github.com/hanwckf/immortalwrt-mt798x) 

- **参考：** [P3TERX](https://github.com/P3TERX/Actions-OpenWrt)


- **LuCI 插件的全部作者**

- **每一位**参与的小伙伴

