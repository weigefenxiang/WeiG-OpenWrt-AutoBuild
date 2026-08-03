# WeiG-OpenWrt-AutoBuild

![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-f7df1e?logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-Semantic-e34f26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-No_Framework-1572b6?logo=css3&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Tooling-339933?logo=nodedotjs&logoColor=white)
![Shell](https://img.shields.io/badge/Shell-Bash-4eaa25?logo=gnubash&logoColor=white)
![YAML](https://img.shields.io/badge/YAML-GitHub_Actions-cb171e?logo=yaml&logoColor=white)

**Language**: [简体中文](../README.md) · [繁體中文](README.zh-TW.md) · English · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md)

**Online customization + cloud builds** for OpenWrt firmware. Pick a source tree, a version, and your plugins on a web page; GitHub Actions compiles everything automatically, and the firmware is yours to download for free.

Currently the **360T7 (MT7981)** is the fully maintained device; the 200+ other devices on the page are open in **seed mode** (guaranteed only to the "it boots" level, not verified on real hardware — use at your own risk; see the maintainer section below for how to promote one to the fully maintained tier).

⭐ **A Star is the biggest support you can give — your Stars are what keep me updating!**

- Customization page (main site): <https://wrt.weigefenxiang.cc.cd>
- Customization page (backup copy on the blog): <https://www.weigeshare.cc.cd/wrt/>
- Three source production lines: [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [OpenWrt official](https://github.com/openwrt/openwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede)
- **Version branches**: all ImmortalWrt remote branches are indexed. OpenWrt includes `main` and every `openwrt-*` branch, excluding `lede-17.01`, `pcs-standalone-back`, and `master`. The page generates a separate config per source, branch, and device profile, and only shows combinations that really exist upstream.
- The interface supports **11 languages** (Simplified Chinese / Traditional Chinese / English / Russian / Spanish / Portuguese / Japanese / Korean / German / French / Vietnamese), follows your browser language automatically, and can be switched manually in the top-right corner; missing translations fall back to English

---

## I'm a user: how do I customize firmware

1. Open the customization page, choose **source → partition variant → plugins** in order, and fill in a "build tag" (your nickname, used to find your firmware later).
2. Click **Submit cloud build → Download request and open GitHub**. On the page that opens, upload only the newly downloaded `build-request.json`, then click **Create**. No device, source, version, or partition fields are required (GitHub login required). For an existing `.config` or `config.buildinfo`, load it on the web page first so the target can be identified.
3. The bot replies in the issue with a link to this build; a full compilation takes about **2–3 hours**.
4. When the build finishes, the bot comments again to notify you. Open the build page and download from **Artifacts** at the bottom:
   - `FIRMWARE-ALL-…`: all firmware and verification files; most first-time users use the file containing `factory`;
   - `CONFIG-…`: submitted config, effective build config, and build metadata for reproducibility;
   - `BUILD-LOGS-…`: complete download/build logs and error excerpts, provided on success or failure and kept for 14 days.
5. To skip compilation, choose **Submit cloud build → Download .config only** and save the generated configuration. A real build never runs `make defconfig`. Before a build-request JSON can be downloaded, the page lists the options required by the selected source from `config/001.presets/source-build-requirements.json` and applies them only after explicit confirmation. A JSON that bypasses the page and omits them is rejected by the Issue parser.
6. The page loads `build-request.json`, `.config`, and `config.buildinfo`. Its searchable timezone field contains the complete OpenWrt/LuCI IANA list in the uniform `(UTC±HH:MM) Region/City` format. You can also select the firmware LuCI theme, NTP preset, and opkg mirror; the confirmation dialog repeats the brand, model, source, version, partition, and page version.

> 💡 After flashing: point your browser at **192.168.1.1** (or the address you customized on the submit page), username **root**, **empty password** (set one immediately on first login) — only the Lean LEDE source ships with the initial password `password`.
>
> 💡 There is a **Self-check** button in the top-right corner of the page: one click tests data-source reachability (local / jsDelivr / raw, three tiers), the .config generation logic, and GitHub connectivity. If the page fails to load properly, click it first to troubleshoot.
>
> 💡 Selecting a plugin with dependencies (such as the MWAN3 traffic-splitting helper) automatically selects its prerequisite plugins for you; kernel/library-level dependencies are resolved automatically at build time, so there is nothing to worry about.
>
> ⚠️ Downloading Artifacts requires being logged in to GitHub (a GitHub restriction). Firmware, config and build-info artifacts are kept for 30 days; `BUILD-LOGS` is kept for 14 days.
>
> ⚠️ Flashing carries risk. The **108M large-partition** variant requires that you have already flashed the unbrickable U-Boot (ubootmod); the **stock-partition** variant flashes directly without repartitioning, but space is tight — selecting too many plugins will make the build fail or the image not fit.

### Finding your firmware in Actions

Builds in the list are named `Build 定制 · 你的标识 · 源码 版本/变体` — just look for the tag you entered: repository → **Actions** → **custom-build**.

## Fork and build it yourself

If you don't want to queue in the public repository, or you want to change the default configuration, you can go fully self-service:

1. Click **Fork** in the top-right corner to copy this repository to your account;
2. In your Fork, go to **Settings → Features and enable Issues**, then go to the **Actions page and click the green button to enable workflows**;
3. Back on the customization page, in step ④ choose **My own Fork** and enter your GitHub username; builds you submit from then on run on your own free quota;
4. The page downloads `build-request.json` and opens an Issue form with a single required attachment field. Upload that file and submit. Actions uses the complete `.config` inside it directly and never rebuilds the request from the repository base config.

## I'm a maintainer: how do I add plugins / change configs

Data flow: `config/<brand>/<device>/*.config` remains for legacy imports and historical requests (360T7 currently has 14 source/branch/profile configs). New build parameters come dynamically from `WeiG-OpenWrt-Menuconfig-Catalog`; every Issue build uses the complete `.config` exported in `build-request.json` as its final input.

### Adding a new plugin option

1. Confirm the package exists in the Catalog for the target source and branch. If the legacy-device compatibility layer also needs it, confirm its base config contains `# CONFIG_PACKAGE_luci-app-xxx is not set`;
2. Add an entry to the `plugins` array in `tools/plugins-meta.json`: `{ "id": "xxx", "name": "Chinese name", "group": "group", "desc": "one-line description", "size": 2, "hot": false }` (if the package name differs from the `luci-app-` suffix or differs across the sources, add a `pkgs` field for an explicit mapping; if it has luci-app-level prerequisite plugins, add `requires: ["prerequisite-id"]` and the page will auto-select them together);
3. Run `node tools/gen-plugins.mjs`; the script regenerates `site/wrt/data/360t7/plugins.json` and syncs the base config copies, while warning about plugins that "exist in the config but are not catalogued";
4. Commit and push. The page needs no code changes — the new option appears automatically.

### Enabling / adding a router device

The device catalog lives in `site/wrt/data/devices.json`, organized by brand; the 360T7 is the fully maintained tier, and every other device is in **seed mode** (its sources are template-generated, it shares the seed plugin table, and only booting is guaranteed). Steps to promote a seed device to the fully maintained tier:

1. Find the device in `devices.json` and complete its `sources` according to reality (per-source config file name, versions branches, variants and partition replacement pairs);
2. Place each source's base config under `config/<brand>/<device-id>/`, following the naming convention `<brand>_<device>_<source>.config` (the repository already ships "minimal bootable" seed configs for most devices — target device + LuCI only — which you can use directly or build upon);
3. Run `node tools/gen-plugins.mjs` (it generates a separate plugins.json for every enabled device);
4. Smoke test: run one cloud build per source to confirm images come out.

Zero changes to the page or workflow code; the `device` parameter is whitelist-validated as usual.

### Directory layout and technical architecture

See [ARCHITECTURE.md](../ARCHITECTURE.md) (bilingual, Chinese and English).

### Security

- Issues accept 1–3 GitHub-hosted attachments and auto-detect `build-request.json`, `.config`, and `config.buildinfo`; fields, whitelists, size, target signature, and source-required options are validated. The submitted full config is authoritative; Actions never runs `make defconfig`, and the effective build config is retained in the artifact.
- The build tag is sanitized down to Chinese/English characters, digits, and hyphens, and is used only for artifact naming and display;
- Workflow permissions are narrowed to `contents: read + issues: write`.

### Multilingual documentation maintenance convention

**Every time this README (or any user-facing md file) is modified, the corresponding language versions under `translations/` must be updated in the same change**; the same applies to the developer docs (`docs/DEVELOPER.md` ↔ `docs/DEVELOPER.en.md`). This is a hard rule to keep the language versions from drifting apart.

## Acknowledgements

Thanks to all the open-source projects and authors who contributed to this project, directly or indirectly:

- **Sources**: [OpenWrt](https://github.com/openwrt/openwrt) · [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede)
- **Infrastructure**: [GitHub Actions](https://github.com/features/actions) (cloud builds) · [Cloudflare Pages](https://pages.cloudflare.com/) (backup site hosting)
- **All authors of the <!--plugin-count-->226<!--/plugin-count--> LuCI plugins**, as well as ecosystem projects such as LuCI, Hexo, and the Butterfly theme;
- Every user who submits an issue, reports a problem, or gives a Star.

This project merely orchestrates and invokes the projects above; all copyrights belong to their respective authors.
