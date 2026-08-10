# Developer Guide

## 1. Non-negotiable boundary

1. Catalog is authoritative for Source/Branch, Target/Profile, Kconfig, dependency, menu, symbol/type, curated applications, sizes, and compatibility evidence.
2. AutoBuild implements generic loading, transitions, serialization, requests, and build tooling only. Do not add a second large dependency JSON.
3. Do not put package, rule, conflict-path, or source-branch special cases in `site/wrt/app.js`.
4. Do not add build-side plugin locks or silently remove packages after feed installation. Catalog evidence and browser choices handle compatibility; users retain a second-confirmation force path.
5. After finding one root cause, cover the same data type, path, and risk mechanism through anonymous mutations instead of a growing trigger-case matrix.
6. Every AutoBuild modification ends with `prepare`, synchronizing the Asia/Shanghai `VERSION` and `site-version.json`.

## 2. Data loading

`site/wrt/data/project.json` owns the configurable order:

```json
{
  "catalogLoadPolicy": {
    "startup": ["menu", "menu:language"],
    "idle": ["applications", "hidden", "help", "compatibility", "package-mirrors"],
    "startupConcurrency": 2,
    "idleConcurrency": 1,
    "idleDelayMs": 15000
  }
}
```

The menu loads with the page; other assets follow the low-priority queue without competing with the active Source/Branch. Matching ref/bytes/SHA-256 cache entries are reused. Submit and self-check still await required assets, so background timing can never skip compatibility validation.

Public `site/wrt/data/` contains deployment identity, UI i18n, timezones, project parameters, and the package-mirror projection only. Device registries, seed configs, public base configs, plugin metadata, local size snapshots, and the generated package page are retired.

## 3. Catalog applications and sizes

The manually invoked Catalog refresh tool audits LuCI application IDs across OpenWrt main, ImmortalWrt master, and LEDE master, then keeps their union. Equal IDs are one application. This list does not change automatically with weekly Source/Branch refreshes because descriptions and translations require review.

Catalog publishes `applications.json.gz` with groups, Chinese/English descriptions, and optional `sizeBytes`. The browser must not add package mappings. Official OPKG `Packages` and APK `packages.adb` samples produce dependency-closure observations; Catalog keeps a conservative cross-source value in bytes. The UI formats three significant digits in B/KiB/MiB/GiB and explicitly reports unknown observations.

## 4. Kconfig state and serialization

Curated and Advanced inputs share one intent path:

```text
applyMenuValue → catalog-engine.applyUserIntent → menuValues
```

Compatibility recommendations also call `applyUserIntent`. Legal N/M/Y states come from option type, visibility, dependencies, and Catalog states; unavailable states must be disabled/hidden before a click.

Generic mutation coverage includes bool, tristate, empty/non-empty string, literal `n`, escaping, int, hex, unknown symbols, conditional defaults, parentheses, `&&`/`||`, deferred state, and closed-world boundaries.

## 5. Compatibility schema 2

Only schema 2 is accepted. Source can be a named ID or a standalone `*`; Branch can be exact or a glob. Wildcard Source cannot mix with named Sources. One-package rules are valid, so a known single-package build failure never needs a fake pair.

The executor stays:

```text
evaluateCompatibilityRules → deriveCompatibilityPlans → applyUserIntent
```

The modal renders generic text by `issue`. Applying a recommendation keeps it open; a relevant state change restores the action; force-continue requires a second confirmation view. No rule ID, package name, or conflict path belongs in `app.js`.

## 6. Request and backend

The backend accepts one schema-5 `build-request.json`. From the pinned Catalog revision it reads Source repository, Branch, and `build.diy1/diy2`; the full `.config` is authoritative. There is no second `packages` field and no local device/plugin allowlist.

An enabled Defconfig runs upstream `make defconfig` once. Otherwise the browser config remains unchanged. The backend validates format, Target/Profile identity, Catalog contract, firmware settings, and path safety; it does not re-decide plugin dependencies.

## 7. Actions identity, concurrency, retention

- Run: `staging-time/tag#Issue/Target/Source/Branch/Profile`
- Artifact: `staging-time-tag#Issue-BUILD-LOGS`
- Repository owner: `OWNER_BUILD_CONCURRENCY`, 1–20, default 6.
- Other users: at most 3 active builds.
- Admission and `/cancel` parse `#Issue`, then verify the Issue author through the API; old titles remain recognized during rolling upgrades.
- CONFIG, firmware, BUILD-LOGS, OPTIONAL-PACKAGES, and FIRMWARE-OTHER retain 60 days; RAW-BRIDGE retains one day.

GitHub's native Run-log retention is a repository Setting rather than Workflow YAML; set it to 60 days as well.

## 8. Package probes

Catalog's manual **Package probe controller** accepts one to eight IDs, Source/Branch globs, `compile` or `co-install`, concurrency, and dry-run. It reads the current Catalog data-branch index and dispatches one child Run per matched Source/Branch.

`compile` selects packages as `m` and runs `package/compile`. `co-install` selects them as `y` and also runs `package/install`, exposing shared-dependency, ownership, and co-install failures. No firmware image is built, though initial feeds/toolchain preparation still costs time.

## 9. Test and publish

```powershell
node tools/dev-assistant.mjs prepare
node tools/dev-assistant.mjs verify
node tools/serve.mjs
```

`check-all` runs executable regressions, JSON/directory allowlists, Catalog-only architecture gates, Actions naming/concurrency/cancel checks, and 60-day retention checks. It carries no device or package case list.

Publish Catalog `dev` first, wait for a complete `catalog-dev` publication and root-asset verification, then push AutoBuild `dev`, wait for CI/Pages, and online-test `index.json`, `applications.json.gz`, `compatibility.json.gz`, and actual browser loading. Do not promote staging/main in this task.

## 10. Handoff

`docs-private/复制给下个ai.txt` contains durable hard rules/templates only. `docs-private/AI交接指南.txt` contains the compact current status, commits, online Runs, and remaining work. Do not append chat history.
