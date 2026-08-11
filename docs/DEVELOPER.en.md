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
    "startup": ["menu", "menu:language", "package-mirrors"],
    "idle": ["applications", "hidden", "help", "compatibility"],
    "startupConcurrency": 3,
    "idleConcurrency": 1,
    "idleDelayMs": 15000
  }
}
```

The menu, its active language shard, and package-mirror projection load together after first paint with bounded concurrency. Other assets follow the low-priority queue without competing with the active Source/Branch. Matching ref/bytes/SHA-256 cache entries are reused. Submit and self-check still await required assets, so background timing can never skip compatibility validation.

Curated applications remain an idle asset. Entering or interacting with the plugin section promotes that one asset to user-demand loading while retaining the same Promise, cache, and executor. The section must show an explicit loading state before data arrives and a generic error/retry action after failure; an empty panel must never masquerade as “no plugins.”

Local preview regenerates its virtual `build-meta.json` from the current VERSION, site SHA, Git branch, and commit on every request, so a long-running server cannot retain its startup identity across Prepare. Only an actual HTTP 404 may represent optional mainline metadata. Network failures, invalid JSON, and metadata that disagrees with `site-version.json` must stop bootstrap instead of silently falling back to `main/catalog-data`.

The default package mirror follows the selected firmware timezone, never the browser timezone: `Asia/Shanghai` selects automatic routing and every other timezone selects the source default, with an availability-based safe fallback. A timezone change recomputes only a non-explicit selection. Manual and imported explicit selections remain stable, and import awaits the same shared mirror promise before validating its value. Retired mirrors are removed only from canonical `config/policies/package-mirrors.json`, then the public projection is regenerated; an unavailable imported ID follows the generic fallback. TUNA's [official mirror-site change](https://github.com/tuna/mirror-web/commit/9d31d4b34471ca68037993541af8437d866fc885) announced that OpenWrt sync stopped on 2026-08-09, so it is no longer an advertised preset.

The top build overview reserves flexible desktop width for the Source/Branch/Target Profile locator; its compact contract header contains only the title and chevron, while the full Catalog commit remains in the expanded body and accessible hint. The 641–960 px layout places the locator on its own first row, contract and controls on the second, and expanded content on the third. Mobile stacks those four regions. This layout must not change the separate Advanced menuconfig search contract or reduce expanded-body typography.

Public `site/wrt/data/` contains deployment identity, UI i18n, timezones, project parameters, and the package-mirror projection only. Device registries, seed configs, public base configs, plugin metadata, local size snapshots, and the generated package page are retired.

## 3. Catalog applications and sizes

The manually invoked Catalog refresh tool audits LuCI application IDs across OpenWrt main, ImmortalWrt master, and LEDE master, then keeps their union. Equal IDs are one application. This list does not change automatically with weekly Source/Branch refreshes because descriptions and translations require review.

Catalog publishes `applications.json.gz` with groups, Chinese/English descriptions, and optional `sizeBytes`. The browser must not add package mappings. Official OPKG `Packages` and APK `packages.adb` samples produce dependency-closure observations; Catalog keeps a conservative cross-source value in bytes. The UI formats three significant digits in B/KiB/MiB/GiB and explicitly reports unknown observations.

Catalog's daily translation workflow owns Advanced menu descriptions. It enumerates legacy bundles and schema-6 `menu:<lang>` shards precisely from the data-branch `index.json`, sparse-fetches only those files, and updates both representations. It must not scan or rewrite `core/graph/applications/compatibility`. The default schedule is 04:37 Asia/Shanghai with five batches. Future Source/Branch entries join through the index without a workflow version list.

## 4. Kconfig state and serialization

Curated and Advanced inputs share one intent path:

```text
applyMenuValue → catalog-engine.applyUserIntent → menuValues
```

Advanced menuconfig's `Root Kconfig options / 根级 Kconfig 选项` is the generic display container for Catalog `path: []` records without a parent menu. It is not upstream `Global build settings` and must not be merged or removed. Only the container label is UI text; records, types, states, dependencies, and hierarchy remain Catalog-owned.

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
- The repository owner has no project-level build concurrency limit; actual parallel execution remains bounded by GitHub-hosted runner quotas.
- Other users have at most three queued or running builds, admitted by Issue creation time and Run ID. Builds no longer use modulo slots, so collisions cannot strand otherwise free capacity.
- Admission and `/cancel` parse `#Issue`, then verify the Issue author through the API; old titles remain recognized during rolling upgrades.
- CONFIG, firmware, BUILD-LOGS, OPTIONAL-PACKAGES, and FIRMWARE-OTHER retain 60 days; RAW-BRIDGE retains one day.

GitHub's native Run-log retention is a repository Setting rather than Workflow YAML; set it to 60 days as well.

## 8. Package probes

The bottom-right web **检** control opens the existing self-test immediately. Its header shows **Package compatibility probe** before Close; clicking it opens a responsive in-page workspace. Catalog supplies the strings, application mappings, and Source/Branch inventory. The four depths appear as one `L1–L4` row; help is revealed only by hover, keyboard focus, or clicking ⓘ. Source/Branch scope and Target coverage share one select row, while custom scope exposes searchable checkboxes. The bounded-height desktop modal gives its only normal scrollbar to package results; only low-height screens enable emergency outer scrolling. Each result uses `package ID | current-language title | description`, falls back through Chinese and English Catalog text, and reuses the global menu tooltip for complete truncated text. IDs remain complete, while narrower screens reflow each row into two or three lines. Catalog-curated applications rank first, remaining LuCI applications second, and ordinary packages third; punctuation-only text is invalid. The plan starts collapsed, and Preview, Copy, and Submit remain the final actions.

The schema-1 request accepts one to eight Catalog application or package IDs; all, current, or explicit Source/Branch entries; and automatic, current Target/Profile, or all representative Target coverage. The controller reads and verifies `index.json`, `applications.json.gz`, and each matched Branch's `core` shard from the data branch paired with the code channel. It maps application IDs to real packages before creating the dynamic Matrix and keeps no Source/Branch or Target version list.

Catalog asset validation is implicit `L0`, not a selectable depth. The four selectable depths are `L1 package-compile` for the package/dependency closure, `L2 rootfs-integration` for RootFS ownership and co-install failures, `L3 firmware-integration` for baseline versus package-enabled firmware A/B, and experimental `L4 boot-smoke` (Chinese UI: “启动自检”) for generic boot-ready markers on Catalog-approved targets. Automatic coverage can try valid fallback targets sequentially inside one Job. The Matrix is capped at 256 jobs. The owner uses full planned concurrency, other write collaborators are capped at three, and visitors cannot start the Matrix. Normalized evidence retains 60 days and full logs 30 days. Only package-caused failure across every legal environment is fully incompatible; evidence never edits rules automatically.

A multi-package failure enters bounded generic delta reduction only after every planned target fails at a package stage, and produces only a candidate minimal failing set. Dependency installation, clone, feeds, build, and boot output make up the 30-day complete log. Infrastructure, download, timeout, and baseline-firmware failures cannot become compatibility conclusions.

The browser places only a short Base64URL request in a hidden Issue block. Before creating a Matrix, the Catalog Workflow revalidates permission, schema, asset contracts, package mappings, Source/Branch, and Target/Profile. `workflow_dispatch` is the administrator fallback. Issue-trigger execution uses the Workflow on the default branch, so dev/staging validation uses manual dispatch first and the browser Issue route is tested after promotion to main.

For a new plugin or rule, first reuse existing Catalog data, audit the same type, execution path, and risk, then run the probe for evidence. AutoBuild `app.js` cannot gain package names or dedicated executors. Probe concurrency, coverage, timeouts, and retention live only in Catalog's `.github/automation-policy.json`; AutoBuild keeps only channel mapping, with tests preventing duplicated data and YAML/JSON drift.

## 9. Test and publish

```powershell
node tools/dev-assistant.mjs prepare
node tools/dev-assistant.mjs verify
node tools/serve.mjs
```

`check-all` runs executable regressions, JSON/directory allowlists, Catalog-only architecture gates, Actions naming/concurrency/cancel checks, and 60-day retention checks. It carries no device or package case list.

For every channel, publish Catalog first, wait for its data branch and root-asset contracts, then publish AutoBuild, wait for CI/Pages, and online-test `index.json`, `applications.json.gz`, `compatibility.json.gz`, and browser loading. Normal promotion is `dev → staging → main`.

## 10. Handoff

`docs-private/复制给下个ai.txt` contains durable hard rules/templates only. `docs-private/AI交接指南.txt` contains the compact current status, commits, online Runs, and remaining work. Do not append chat history.

## 11. Catalog selection and final configuration

`site/wrt/data/project.json` carries only a small selection policy: Source priority, development-branch priority, and preferred Target selector values. Catalog remains the sole inventory of real Sources, Branches, Targets, and Profiles. A missing preferred Target must fall back to the first complete valid Catalog path. Defaults apply only to first selection or a new Source/Branch; they must never overwrite the current control, valid state, or an explicit request.

Menu and applications shards converge through one Catalog-ready reconciliation regardless of arrival order. It refreshes curated applications, Advanced, the build contract, statistics, and submit gate. Before menu completion, curated entries are disabled with a loading state; they are not permanently classified as unavailable.

The Advanced title button, programmatic symbol focus, and search field share one asynchronous expansion coordinator. The first non-empty search character expands before the search debounce without losing input focus, duplicating downloads, or allowing an older async request to reverse newer state. Clearing search does not collapse the panel.

In an imported workspace, the semantic `Selected options` button sits left of the import-summary card and its whole button area toggles expansion; restore-uploaded-values remains an independent action inside the summary card. The option workspace sits below that overview and always spans the full row, hides as one unit when collapsed, and uses a one-column mobile overview. If either the import summary or Selected-only state is absent, the remaining card fills the row.

One Catalog/Kconfig effective resolver selects the final `.config` theme. Explicit user state wins; otherwise it evaluates the active Target/Profile packages, defaults, dependencies/selects, and choices. If that remains empty, it walks stable Catalog order and uses the same `applyUserIntent` dependency closure to select the first legal candidate, skipping explicit user exclusions. The resolved symbol and its dependency closure are written explicitly into the generated config and shared by download, self-test, submit, and firmware-settings snapshots. No records or all candidates explicitly disabled are genuine failures; named fallback themes are forbidden.

## 12. Curated-plugin selection state

Curated checkboxes, group badges, bottom statistics, the selection drawer, and the build contract must share one selection state. Catalog Target uses `catalogUserOverrides` as the authority for user intent; only legacy paths use the local selected/removed sets. `removed` means a real exclusion and must never be counted by a label that says “selected.”

When a user returns a value to `catalogInheritedValue()`, the generic normalizer must delete the redundant override and synchronize the curated item as a restore. A default-`n` item must leave no explicit `n` after “select, then cancel.” A default-`y` item remains a real exclusion when disabled and returns to inherited state when re-enabled. Dependencies and conflicts continue to flow only through the Catalog/Kconfig `applyUserIntent` executor.

Curated checkboxes have one visual contract: enabled and unchecked is white, enabled and checked uses the accent color, disabled or locked is grey, and keyboard focus stays visible. Styling depends only on standard checked/disabled states; package names and rule IDs are forbidden.
