# WeiG-OpenWrt-AutoBuild

An online OpenWrt customizer and GitHub Actions build tool. The browser reads Source, Branch, Target/Profile, Kconfig, curated applications, package-size observations, and compatibility rules directly from [WeiG-OpenWrt-Menuconfig-Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog). AutoBuild no longer carries a second device, seed-config, or plugin database.

**Language**: [简体中文](../README.md) · English

- Customizer: [Weige Share](https://www.weigeshare.cc.cd/wrt/)
- Build repository: [WeiG-OpenWrt-AutoBuild](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild)
- Data repository: [WeiG-OpenWrt-Menuconfig-Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog)

## Usage

1. Select **Source → Branch → Target System → Subtarget → Target Profile**.
2. Change the configuration through curated applications or Advanced menuconfig. N/M/Y, dependencies, defaults, and visibility come from the active Catalog Kconfig.
3. Choose **Submit cloud build → Download request and open GitHub**, upload only the generated `build-request.json`, and create the Issue.
4. Download firmware and supporting artifacts from the bottom of the completed Actions Run.

The page also imports `build-request.json`, `.config`, and `config.buildinfo`. Upstream `make defconfig` runs only when the user explicitly enables **Defconfig**; otherwise the exported full `.config` is authoritative.

## Names and retention

Run title:

```text
staging-260810_0857/anonymous#161/Generic_x86/64/lede/master/generic
```

Artifact:

```text
staging-260810_0857-anonymous#161-BUILD-LOGS
```

The user build tag is preserved and `#161` is the original Build Issue. All downloadable firmware, CONFIG, BUILD-LOGS, OPTIONAL-PACKAGES, and FIRMWARE-OTHER artifacts are retained for **60 days**. The internal RAW-BRIDGE alone stays for one day and is deleted after publication.

## Data and compatibility

- The current Source/Branch menu and language load first. Applications, hidden options, help, compatibility, and mirror rules follow the idle queue configured in `project.json`.
- Curated IDs, Chinese/English descriptions, and cross-source size observations live in Catalog. Equal IDs are one application. Sizes use three significant digits; missing reliable observations remain explicitly unknown.
- `compatibility.json` accepts schema 2 only. Source supports `*` and Branch supports globs. Rules provide evidence; the browser uses the same Catalog executor for the minimum plan and preserves the confirmed force-continue path.
- AutoBuild performs no weekly data sync. Newly published Source/Branch data becomes available through Catalog without an AutoBuild source update.

## Tests

```powershell
node tools/dev-assistant.mjs prepare
node tools/dev-assistant.mjs verify
node tools/serve.mjs
```

Open <http://localhost:8642/> and test Source/Branch switching, Target/Profile, curated applications, Advanced menuconfig, compatibility prompts, self-check, and request export.

## Maintainer boundary

- Catalog is authoritative for Kconfig, dependency, menu, symbol/type, Source/Branch, curated applications, sizes, and compatibility evidence.
- Do not put rule- or plugin-specific conditions in `site/wrt/app.js`, and do not add build-side conflict locks.
- Refresh curated applications manually in Catalog and review their descriptions. Official OPKG/APK indexes update sizes automatically.
- Use Catalog's manual **Package probe controller** for package regression. It dispatches one bounded child Run per Catalog Source/Branch, compiles only selected package closures, and optionally checks co-installation without building firmware images.
- Every AutoBuild modification must run `prepare`, which updates `VERSION` and `site-version.json` in Asia/Shanghai time.

See [ARCHITECTURE.md](../ARCHITECTURE.md) and the [Developer Guide](../docs/DEVELOPER.en.md).

## Acknowledgements

[OpenWrt](https://github.com/openwrt/openwrt) · [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [hanwckf mt798x](https://github.com/hanwckf/immortalwrt-mt798x) · LuCI and all package authors.
