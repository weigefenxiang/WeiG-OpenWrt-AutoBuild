# Wei.G OpenWrt Firmware Customizer

Build OpenWrt firmware online: pick your device and packages, submit a request on GitHub, and let GitHub Actions do the compilation.

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**📱 Mobile-friendly · 🌙 Light & dark themes · ✅ Multiple OpenWrt-based distributions**

**[🌐 Open the customizer](https://www.weigshare.com/wrt/) · [⬇️ Download firmware](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml)**

**Supported distributions:** [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [OpenWrt](https://github.com/openwrt/openwrt) · [iStoreOS](https://github.com/istoreos/istoreos) · [Lienol](https://github.com/Lienol/openwrt) · [ImmortalWrt (hanwckf MT798x)](https://github.com/hanwckf/immortalwrt-mt798x)

**Language:** **English** · [简中](translations/README.zh-CN.md) · [繁中](translations/README.zh-TW.md) · [Русский](translations/README.ru.md) · [Español](translations/README.es.md) · [Português](translations/README.pt.md) · [日本語](translations/README.ja.md) · [한국어](translations/README.ko.md) · [Deutsch](translations/README.de.md) · [Français](translations/README.fr.md) · [Tiếng Việt](translations/README.vi.md)

<details>
<summary><b>🔤 More languages</b></summary>

<div dir="ltr">
[Asturianu](translations/README.ast.md) &lrm;·&lrm; [Azərbaycanca](translations/README.az.md) &lrm;·&lrm; [Беларуская](translations/README.be.md) &lrm;·&lrm; [Български](translations/README.bg.md) &lrm;·&lrm; [বাংলা](translations/README.bn.md) &lrm;·&lrm; [বাংলা (বাংলাদেশ)](translations/README.bn-BD.md) &lrm;·&lrm; [Català](translations/README.ca.md) &lrm;·&lrm; [Čeština](translations/README.cs.md) &lrm;·&lrm; [Dansk](translations/README.da.md) &lrm;·&lrm; [Ελληνικά](translations/README.el.md) &lrm;·&lrm; [Suomi](translations/README.fi.md) &lrm;·&lrm; [Filipino](translations/README.fil.md) &lrm;·&lrm; [Gaeilge](translations/README.ga.md) &lrm;·&lrm; [हिन्दी](translations/README.hi.md) &lrm;·&lrm; [Magyar](translations/README.hu.md) &lrm;·&lrm; [Bahasa Indonesia](translations/README.id.md) &lrm;·&lrm; [Italiano](translations/README.it.md) &lrm;·&lrm; [ქართული](translations/README.ka.md) &lrm;·&lrm; [ລາວ](translations/README.lo.md) &lrm;·&lrm; [Lietuvių](translations/README.lt.md) &lrm;·&lrm; [Latviešu](translations/README.lv.md) &lrm;·&lrm; [മലയാളം](translations/README.ml.md) &lrm;·&lrm; [मराठी](translations/README.mr.md) &lrm;·&lrm; [Bahasa Melayu](translations/README.ms.md) &lrm;·&lrm; [Norsk bokmål](translations/README.nb-NO.md) &lrm;·&lrm; [Nederlands](translations/README.nl.md) &lrm;·&lrm; [Polski](translations/README.pl.md) &lrm;·&lrm; [Português (Brasil)](translations/README.pt-BR.md) &lrm;·&lrm; [Română](translations/README.ro.md) &lrm;·&lrm; [Slovenčina](translations/README.sk.md) &lrm;·&lrm; [Svenska](translations/README.sv.md) &lrm;·&lrm; [தமிழ்](translations/README.ta.md) &lrm;·&lrm; [Türkçe](translations/README.tr.md) &lrm;·&lrm; [Українська](translations/README.uk.md) &lrm;·&lrm; [Màaya t'aan](translations/README.yua.md) &lrm;·&lrm; [&#x2067;العربية&#x2069;](translations/README.ar.md) &lrm;·&lrm; [&#x2067;فارسی&#x2069;](translations/README.fa.md) &lrm;·&lrm; [&#x2067;עברית&#x2069;](translations/README.he.md) &lrm;·&lrm; [&#x2067;اردو&#x2069;](translations/README.ur.md)
</div>

</details>

## Interface preview

<p align="center">
  <img src="docs/images/wrt-desktop.png" alt="Wei.G OpenWrt desktop interface" width="78.65%"><img src="docs/images/wrt-mobile.png" alt="Wei.G OpenWrt mobile interface" width="21.30%">
</p>

## Get started: build firmware in three steps

**📖 [Illustrated step-by-step guide](https://weigshare.com/posts/WeiG-OpenWrt-AutoBuild-Guide/)**

### 1. Choose your source, device and packages

Open the [**【Firmware Customizer】**](https://www.weigshare.com/wrt/) and select **【Source】** → **【Branch】** → **【Target System】** → **【Subtarget】** → **【Target Profile】**. Pick the features you need under **【② Select packages】**, then adjust **【Advanced menuconfig】**, time zone, theme and other settings as needed.

Already have a configuration? Select **【Load configuration】** to import a `build-request.json`, `.config` or `config.buildinfo`, then review the source, device and package selections.

### 2. Submit your build request on GitHub

[**【Sign in to GitHub】**](https://github.com/login) first. Return to the [**【Firmware Customizer】**](https://www.weigshare.com/wrt/) and choose **【Submit cloud build】** → **【Download request and open GitHub】**.

The page downloads a `*.json` request file and opens a GitHub Issue form. On desktop, drag the downloaded JSON file into the request field, then select **【Submit new issue】**. Once submitted, the automation replies to your Issue with a link to the build run.

<details>
<summary><strong>Important notes (click to expand)</strong></summary>

> **Tip:** Use **【Test】** in the floating toolbar at the bottom right to inspect configuration problems and compatibility suggestions ahead of time. Generating the request through **【Download request and open GitHub】** also runs these checks automatically.
>
> If problems are detected, you can apply the suggested fixes or choose **【Keep and force continue】**. This does not fix the underlying issue: if an upstream source defect remains, compilation may still fail.
>
> Use the GitHub Issue page opened by the customizer so that the prefilled request information is not lost.
>
> Downloading the JSON without submitting the Issue **does not start a build**.
>
> Never post real passwords, tokens or other secrets in public Issues, build requests or logs.

</details>

### 3. Download the firmware

Follow the build link in your Issue, or find the run under [**【Actions → Firmware Download】**](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions/workflows/custom-build.yml). Once it succeeds, download the firmware from **【Artifacts】** at the bottom of the run. `CONFIG` contains configuration files and `BUILD-LOGS` contains diagnostic logs—**neither is a flashable firmware image**. Firmware downloads are retained for **60 days**.

## Frequently asked questions

<details>
<summary>Can selecting too many packages cause a RootFS capacity error?</summary>

Yes. Packages and their dependencies can outgrow the firmware's RootFS partition. On targets that support it, open **【Advanced menuconfig】** → **【Target Images】** and look for `TARGET_ROOTFS_PARTSIZE`. Depending on your device, values such as 512 or 1024 MiB may be appropriate.

Some physical routers cannot change this setting because of flash size, partition layout or upstream restrictions. In that case, remove unnecessary packages rather than copying settings from an x86 build. See [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233) for examples.

</details>

<details>
<summary>Why did my build time out?</summary>

A GitHub-hosted runner normally allows up to six hours per job. This project sets a **350-minute (5 h 50 min)** job limit and a **335-minute** execution deadline to leave time for collecting and uploading diagnostics.

When that deadline is reached, the build stops; it is **not paused for later resumption**. Large packages, including Node.js- or Rust-based dependencies, can make compilation considerably slower.

</details>

<details>
<summary>How should I troubleshoot a failed build?</summary>

Open the run and download **【BUILD-LOGS】** under **【Artifacts】**. Read `00-SUMMARY.txt` first, then inspect the relevant detailed log. If RootFS is full, reduce packages or increase the partition size only if the target supports it; if the build timed out, simplify the selection. Upstream source errors and dependency conflicts need their own fixes.

See [Issue #233](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/issues/233). After changing your configuration, create a **new Issue**.

</details>

<details>
<summary>Can I rerun an old GitHub Actions job after changing my configuration?</summary>

No—not to test the new configuration. Load and check your updated settings in the current customizer, export a new request and submit a new Issue. Rerunning an old job uses its original pinned code and data.

</details>

## Development and deployment

You do **not** need to clone the repository or install Node.js to build firmware through the website. Maintainers can refer to the [Developer Guide](docs/DEVELOPER.md) and [Architecture Overview](translations/ARCHITECTURE/ARCHITECTURE.md) for source, configuration and deployment details.

## Menuconfig Catalog

[Menuconfig Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) collects and publishes the upstream branches, device profiles, packages, Kconfig relationships and compatibility data used by both the website and build worker. AutoBuild does not maintain a separate device or package database.

## Acknowledgements

Thanks to [OpenWrt](https://openwrt.org/), [ImmortalWrt](https://immortalwrt.org/), [Lean LEDE](https://github.com/coolsnowwolf/lede), [iStoreOS](https://github.com/istoreos/istoreos), [Lienol](https://github.com/Lienol/openwrt), [hanwckf MT798x](https://github.com/hanwckf/immortalwrt-mt798x), [all package authors](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog) and everyone who contributes to open source.

## License

Licensed under [GNU GPLv3 or later](LICENSE). See [NOTICE](NOTICE) for copyright and contact information.
