# WeiG-OpenWrt-AutoBuild

An online OpenWrt customizer and GitHub Actions build tool. The browser reads Source, Branch, Target/Profile, Kconfig, curated applications, package-size observations, and compatibility rules directly from [WeiG-OpenWrt-Menuconfig-Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog). AutoBuild no longer carries a second device, seed-config, or plugin database.

**Language**: English · [简体中文](translations/README.zh-CN.md)

- Customizer: [Weige Share](https://www.weigshare.com/wrt/)
- Build repository: [WeiG-OpenWrt-AutoBuild](https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild)
- Data repository: [WeiG-OpenWrt-Menuconfig-Catalog](https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog)

## Usage

1. Select **Source → Branch → Target System → Subtarget → Target Profile**.
2. Change the configuration through curated applications or Advanced menuconfig. N/M/Y, dependencies, defaults, and visibility come from the active Catalog Kconfig.
3. Choose **Submit cloud build → Download request and open GitHub**, upload only the generated `build-request.json`, and create the Issue.
4. Download firmware and supporting artifacts from the bottom of the completed Actions Run.

The page also imports `build-request.json`, `.config`, and `config.buildinfo`. Schema 6 builds reconstruct the authoritative configuration from the exact Catalog Native Profile baseline plus semantic user overrides. **Defconfig** is off by default and, when explicitly enabled, runs only as optional normalization after reconstruction.

## Cloning and project configuration

Maintain two configuration sources with separate responsibilities after cloning:

- `site/wrt/config/site.json` is the sole public-site configuration source. It contains branding, Catalog location and selection/loading policy, web appearance, firmware defaults, and the default build tag. The browser reads this file only.
- `config/build.json` is the sole build-side configuration source. It contains only password mode, `jobs.compile`, `jobs.download`, and `admission.publicActiveBuilds`. It stays at the repository root and must never be read by the browser or deployed as static site content.

Edit the relevant file(s), run `prepare` in the working tree, and commit the configuration together with the controlled output produced by `prepare`:

```powershell
node tools/dev-assistant.mjs prepare
```

`prepare` validates both configuration sources and updates `Shell/build-defaults.conf` for build scripts; generated files are not configuration sources and must not be edited directly. The field boundaries are:

| Configuration file/block | Configurable content | Boundary |
| --- | --- | --- |
| `site/wrt/config/site.json` → `project` | `displayName`, `shortName`, repository, and blog URL | Presentation and link targets only; gateway identity, the `[build]` protocol, and Run/Artifact title formats stay unchanged |
| `site/wrt/config/site.json` → `catalog` | Catalog repository, release tag, Source/Branch preference, preferred Target selector, and loading queue | Catalog remains authoritative for Source, Branch, Target/Profile, packages, Kconfig, and compatibility facts; no inventory is maintained here |
| `site/wrt/config/site.json` → `ui` | Default language and color mode | Controls only the initial web appearance |
| `site/wrt/config/site.json` → `firmware` | LAN address, timezone, theme, NTP, and package mirror | Public firmware defaults only; sensitive values never belong here |
| `site/wrt/config/site.json` → `build` | Default build tag `defaultTag` | Supplies a web default only and cannot bypass request validation |
| `config/build.json` → `password` | `mode`: `prompt`, `empty`, or `secret` | Read by the build side only; not a web setting |
| `config/build.json` → `jobs` | `compile` and `download` concurrency (`auto` or an integer) | Controls build-side concurrency only and cannot change request semantics |
| `config/build.json` → `admission` | `publicActiveBuilds` | Controls the public build admission limit only |

With password mode `prompt`, the submitter supplies the password; `empty` explicitly requests an empty password; `secret` requires the repository Secret `DEFAULT_ROOT_PASSWORD`. Never write the actual password to `config/build.json`, site files, build requests, Issues, or logs.

### Independently deploying `site/wrt`

`site/wrt` is a complete static web site that can be hosted independently. Deploy the entire directory—including `config/`, `data/`, HTML, scripts, and styles—to a Blog, Pages host, or another static host. The actual deployment must run from a clean checkout of the 40-character SHA that contains the committed configuration and controlled output above:

```powershell
node tools/prepare-web-deployment.mjs --commit <40-character SHA> --branch <dev or main>
```

This command creates the ignored `site/wrt/data/build-meta.json`. Deployment must include metadata matching `site-version.json`; missing, invalid, or stale metadata disables submission. The Pages workflow's site-preparation stage only runs `node tools/stamp-site-version.mjs --check` and `prepare-web-deployment`; it does not modify configuration at deployment time. Independent hosting changes only where the page is published, not build identity: a build request must still correspond to the same commit in the target AutoBuild repository. Catalog remains the sole source for Source, Branch, Target/Profile, packages, Kconfig, dependencies, and compatibility facts; repository configuration cannot declare or modify advanced Catalog facts.

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

- Browser and Worker share Catalog graph selection and validation: prefer advertised schema-5 `graphCompact`, otherwise use the legacy graph. The decoded payload owns its relation schema; an optional index declaration must agree. Worker reconstruction still requires complete typed relations and exact source/hash/size identity. Historical configuration import remains supported. If request validation fails before an artifact identity exists, the run retains diagnostic logs without attempting firmware publication.
- The current Source/Branch menu and language load first. Applications, hidden options, help, compatibility, and mirror rules follow the idle queue in `catalog.loading` from `site/wrt/config/site.json`.
- Curated IDs, localized descriptions, and cross-source size observations live in Catalog. Equal IDs are one application. Sizes use three significant digits; missing reliable observations remain explicitly unknown.
- `compatibility.json` accepts schemas 2–5. Schema 4 may bind a verified build failure to one build package through `buildDependency`; new graph decisions derive triggers from the exact Catalog graph, while legacy `triggerPackages` remains readable data only and never drives a new warning or action. Schema-4 relation assets preserve typed defaults, ranges, visibility, choices, select/imply relations, package capabilities, and expression ASTs through the compact encode/decode round-trip. `relationsComplete: true` together with `relationCapabilities` containing `complete-kconfig-relations-v1` certifies the complete typed relation graph. The independent `packageClosureComplete: true` plus `packageClosureCapabilities` containing `complete-package-build-closure-v1` certifies only the package build closure; it never promotes a partial typed relation graph to complete. Schema 5 can keep exact observations in `evidence` while an explicitly reviewed `preventive` policy applies across wildcard environments only where the failed package exists. Unknown or ambiguous graph evidence is inconclusive, and the browser never guesses a warning or action.
- Build-failure recommendations use the exact Catalog graph: reverse indexes find candidates, then each candidate is proved through its forward dependency, select/imply, and package-provider relations. The plan contains the minimum user-controlled roots plus the failed package; shared Kconfig intent performs automatic cleanup. The three layers stay distinct: the upstream `.config` uses `CONFIG_PACKAGE_<name>`, the Catalog/Kconfig model uses `PACKAGE_<name>`, and the build closure uses real package names from upstream `.packageinfo` and Makefiles. Virtual capabilities are provider names only; they never create a config symbol or package record, and an owner does not conflict with its own capability.
- Before compilation, the Worker hashes `.config`, runs `make prepare-tmpinfo V=s`, and requires the before/after hashes to match plus a non-empty real `tmp/.packageinfo`. The closure gate then reads package metadata and Makefiles, resolves real dependency/provider paths, and fails closed before compilation when metadata, alternatives, conditions, or paths are missing or ambiguous.
- The shared runtime preserves native Kconfig boundaries: bool default `m` remains a typed source value, comments are stripped only outside quoted strings, and `@` outside quotes is an ignored-character warning around an ordinary AST; symbols after `@` are retained. Complete active-source proof with no unresolved dynamic preprocessing distinguishes native undefined symbols from Target-projection omissions, and external symbol types are accepted only from real parsed definitions with projection provenance. Unevaluated `$(shell,...)` or dynamic assignments keep relations incomplete and therefore defer the decision.
- Choice `reset if` is preserved as Catalog data, but native mconf/nconf apply it only during an interactive transition from a non-Y choice member to Y by clearing the global `S_DEF_USER` layer. Static import, serialization, Worker reconstruction, and browser interactions do not claim to reproduce that global reset; unsupported or unresolved reset interactions remain explicit `unsupported`/`deferred` results.
- AutoBuild performs no weekly data sync. Newly published Source/Branch data becomes available through Catalog without an AutoBuild source update.

## Tests

### Runtime performance and historical imports

- New Catalog snapshots may advertise `graphCompact` with relation schema 5. The loader prefers it, verifies the immutable asset contract, and decodes shared definition/expression tables without discarding graph facts. Older graph formats and historical configuration/JSON imports remain supported; an advertised asset that fails validation is not silently replaced by another snapshot.
- Provider and dependency indexes are cached per model. Compatibility documents are normalized once at their boundary, and healthy configuration preflight avoids constructing repair plans. Build-failure cleanup may also inspect dependencies of an already-disabled failed target, but those are cleanup candidates, not evidence that they compile that target. Shared, protected, or unresolved dependencies are retained and explained; no static package-family list is maintained.
- A typed default is materialized only when its owning symbol's dependencies permit it. Inactive or unknown owner conditions must not invent positive bool/tristate or scalar defaults and break an unrelated choice such as a theme. Tests cover bool, tristate, string, int, and hex with inactive, unknown, and active owners.
- Import itself does not open a compatibility dialog. Use **Test** or generate/download the build JSON to run configuration preflight and compatibility checks. Apply a recommendation, close its applied-result dialog, and let the same check finish; unresolved evidence stays explicit rather than enabling a guessed repair.

### Local checks

```powershell
node tools/test-catalog-engine.mjs
node tools/test-build-closure.mjs
node tools/check-all.mjs
node tools/dev-assistant.mjs prepare
node tools/dev-assistant.mjs verify
```

Local preview:

```powershell
node tools/serve.mjs
```

Open <http://localhost:8642/> and test Source/Branch switching, Target/Profile, curated applications, Advanced menuconfig, compatibility prompts, self-check, and request export.

## Maintainer boundary

- Catalog is authoritative for Kconfig, dependency, menu, symbol/type, Source/Branch, curated applications, sizes, and compatibility evidence.
- Do not put rule- or plugin-specific conditions in `site/wrt/app.js`, and do not add build-side conflict locks.
- Refresh curated applications manually in Catalog and review their descriptions. Official OPKG/APK indexes update sizes automatically.
- Edit `tools/i18n-source.json` and `tools/i18n-translations.json` for web translations; `site/wrt/data/i18n/` contains generated bundles and must not be edited directly.
- Use the in-page **Package Compatibility Probe** for package regression. It reuses Advanced menuconfig Kconfig state and exposes seven Catalog-described depths from L1 config resolution through L7 reboot validation. L2-L7 use a same-job Baseline B → Final A comparison by default; an explicit Final-only request disables the comparison. GitHub revalidates permissions and requests before creating a Matrix.
- Every AutoBuild modification must run `prepare`, which updates `VERSION` and `site-version.json` in Asia/Shanghai time.
- After cloning, edit `site/wrt/config/site.json` for public-site defaults and `config/build.json` for build-side settings, then run `prepare`. Do not copy Catalog Source/Branch, Target/Profile, or package facts into this repository.

See [ARCHITECTURE.md](ARCHITECTURE.md) and the [Developer Guide](docs/DEVELOPER.en.md).

## License

This project is licensed under [GNU GPLv3 or later](LICENSE). The [Chinese explanation](LICENSE.zh-CN.md) is informational only; see [NOTICE](NOTICE) for copyright and the public contact address.

## Acknowledgements

[OpenWrt](https://github.com/openwrt/openwrt) · [ImmortalWrt](https://github.com/immortalwrt/immortalwrt) · [Lean LEDE](https://github.com/coolsnowwolf/lede) · [hanwckf mt798x](https://github.com/immortalwrt/immortalwrt-mt798x) · LuCI and all package authors.
