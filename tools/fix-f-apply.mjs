#!/usr/bin/env node
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const write = (path, text) => writeFileSync(resolve(ROOT, path), text, 'utf8');

function replaceOnce(text, before, after, label) {
  const first = text.indexOf(before);
  const second = first < 0 ? -1 : text.indexOf(before, first + before.length);
  if (first < 0 || second >= 0) throw new Error(`${label}: expected exactly one literal match`);
  return text.slice(0, first) + after + text.slice(first + before.length);
}

function replaceRange(text, startMarker, endMarker, replacement, label) {
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`${label}: start marker not found`);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`${label}: end marker not found`);
  if (text.indexOf(startMarker, start + startMarker.length) >= 0) {
    throw new Error(`${label}: duplicate start marker`);
  }
  return text.slice(0, start) + replacement + text.slice(end);
}

let app = read('site/wrt/app.js');
app = replaceOnce(app,
  "let CATALOG_LOADER_MODULE = null, CATALOG_SCHEMA6_MODULE = null, BUILD_IDENTITY_MODULE = null, CATALOG_LOADER = null;\nlet MENU_CATALOG_DATA_REF = 'catalog-data';\nlet catalogShardLoader = null, catalogMenuLoadingPromise = null;\nlet catalogHiddenLoadingPromise = null, catalogHelpLoadingPromise = null, packageMirrorsPromise = null;",
  "let CATALOG_LOADER_MODULE = null, CATALOG_SCHEMA6_MODULE = null, BUILD_IDENTITY_MODULE = null, CATALOG_LOADER = null;\nlet PROFILE_BASELINE_MODULE = null, PROFILE_BASELINE_STORE = null, ACTIVE_PROFILE_BASELINE = null;\nlet profileBaselineKey = '', catalogProfileBaselineLoadingPromise = null;\nlet MENU_CATALOG_DATA_REF = 'catalog-data';\nlet catalogShardLoader = null, catalogMenuLoadingPromise = null;\nlet catalogHiddenLoadingPromise = null, catalogHelpLoadingPromise = null, packageMirrorsPromise = null;",
  'profile baseline globals');

const baselineHelpers = `async function ensureProfileBaselineModule() {
  if (!PROFILE_BASELINE_MODULE) {
    PROFILE_BASELINE_MODULE = await import(releaseAssetUrl('./lib/profile-baseline.js'));
  }
  return PROFILE_BASELINE_MODULE;
}
async function ensureCatalogProfileBaselines(source = selectedCatalogSource(), branch = selectedCatalogBranch(source)) {
  const revision = String(MENU_INDEX?.assetRef || '').trim().toLowerCase();
  const key = [source?.id, branch?.branch || branch?.id, branch?.commit, revision].join('|');
  if (PROFILE_BASELINE_STORE && profileBaselineKey === key) return PROFILE_BASELINE_STORE;
  if (catalogProfileBaselineLoadingPromise?.key === key) return catalogProfileBaselineLoadingPromise.promise;
  const contract = branch?.assets?.profileBaselines;
  if (!source || !branch || !catalogShardLoader || !contract?.asset) {
    throw new Error('Catalog Native Profile baseline is unavailable');
  }
  const promise = (async () => {
    const module = await ensureProfileBaselineModule();
    const document = await catalogShardLoader('profileBaselines');
    if (!document) throw new Error('Catalog Native Profile baseline shard is unavailable');
    const store = module.createProfileBaselineStore(document, {
      sourceId: source.id,
      branch: branch.branch,
      commit: branch.commit,
      schema: contract.schema,
      encoding: contract.encoding,
      profiles: contract.profiles,
      configGroups: contract.configGroups,
    });
    PROFILE_BASELINE_STORE = store;
    profileBaselineKey = key;
    return store;
  })();
  catalogProfileBaselineLoadingPromise = { key, promise };
  try { return await promise; }
  finally {
    if (catalogProfileBaselineLoadingPromise?.promise === promise) catalogProfileBaselineLoadingPromise = null;
  }
}
function resolveActiveProfileBaseline(target = state.device?.target) {
  if (!PROFILE_BASELINE_STORE || !target) return null;
  return PROFILE_BASELINE_STORE.resolve({
    system: target.system,
    subtarget: target.subtarget,
    profile: target.profile,
    profileSymbol: target.profileSymbol,
    profileSelector: target.profileSelector,
  });
}
function nativeProfileBaselineEntries() {
  if (!ACTIVE_PROFILE_BASELINE || !PROFILE_BASELINE_MODULE) {
    throw new Error('Native Profile baseline has not been resolved for the selected Target Profile');
  }
  return parseConfigEntries(PROFILE_BASELINE_MODULE.serializeConfigMap(ACTIVE_PROFILE_BASELINE.values));
}
`;
app = replaceOnce(app,
  'async function loadCatalog(source, branch, applyDefault = true, requested = null, options = {}) {',
  `${baselineHelpers}\nasync function loadCatalog(source, branch, applyDefault = true, requested = null, options = {}) {`,
  'profile baseline helpers');

app = replaceOnce(app,
  '    CATALOG_MODEL = remote.model;\n    catalogShardLoader = remote.loadShard || null;\n    if (catalog.splitAssets) catalog.menu = CATALOG_SCHEMA6_MODULE.createRuntimeMenu(CATALOG_MODEL);',
  '    CATALOG_MODEL = remote.model;\n    catalogShardLoader = remote.loadShard || null;\n    PROFILE_BASELINE_STORE = null;\n    ACTIVE_PROFILE_BASELINE = null;\n    profileBaselineKey = \"\";\n    await ensureCatalogProfileBaselines(activeSource, activeBranch);\n    if (catalog.splitAssets) catalog.menu = CATALOG_SCHEMA6_MODULE.createRuntimeMenu(CATALOG_MODEL);',
  'load profile baseline with Catalog bundle');

app = replaceOnce(app,
  '    MENU_CATALOG = null;\n    CATALOG_MODEL = null;\n    catalogShardLoader = null;\n    menuCatalogKey = \"\";',
  '    MENU_CATALOG = null;\n    CATALOG_MODEL = null;\n    catalogShardLoader = null;\n    PROFILE_BASELINE_STORE = null;\n    ACTIVE_PROFILE_BASELINE = null;\n    profileBaselineKey = \"\";\n    menuCatalogKey = \"\";',
  'clear profile baseline after Catalog failure');

app = replaceOnce(app,
  '  state.device = device;\n  const needsBaseline = targetChanged || !catalogBaselineValues.size;\n  if (needsBaseline) initializeCatalogBaseline();',
  '  state.device = device;\n  await ensureCatalogProfileBaselines(sourceRow, branchRow);\n  ACTIVE_PROFILE_BASELINE = resolveActiveProfileBaseline(device.target);\n  if (!ACTIVE_PROFILE_BASELINE) {\n    throw new Error(`Native Profile baseline does not contain ${device.target.system}/${device.target.subtarget}/${device.target.profileSymbol}`);\n  }\n  const needsBaseline = targetChanged || !catalogBaselineValues.size;\n  if (needsBaseline) initializeCatalogBaseline();',
  'resolve active Native Profile baseline');

app = replaceRange(app,
  'function initializeCatalogBaseline() {',
  '\nfunction snapshotCatalogBaseline() {',
`function initializeCatalogBaseline() {
  menuValues.clear();
  menuTouched.clear();
  catalogBaselineValues.clear();
  catalogBaselineOrigins.clear();
  catalogRecommendedValues.clear();
  catalogDependencySymbols.clear();
  catalogImportedSymbols.clear();
  catalogUserOverrides.clear();
  state.sel.clear();
  state.removed.clear();
  const entries = nativeProfileBaselineEntries();
  for (const option of menuSearchOptions) {
    const entry = entries.get(option.symbol);
    if (!entry) continue;
    const fallback = option.type === 'string' ? '' : 'n';
    const value = normalizeImportedKconfigValue(entry, option.type, fallback);
    if (value === undefined) {
      throw new Error(\`Native Profile baseline value cannot be normalized: CONFIG_\${option.symbol}\`);
    }
    menuValues.set(option.symbol, value);
  }
  markCatalogStateChanged();
  snapshotCatalogBaseline();
}
`, 'initialize Native Profile baseline');

app = replaceRange(app,
  'function backfillCatalogBaselineForLoadedOptions() {',
  '\nfunction catalogInheritedValue(symbol) {',
`function backfillCatalogBaselineForLoadedOptions() {
  const missing = menuSearchOptions.filter((option) =>
    option?.symbol && !catalogBaselineValues.has(option.symbol));
  if (!missing.length) return;
  const entries = nativeProfileBaselineEntries();
  for (const option of missing) {
    const entry = entries.get(option.symbol);
    if (!entry) continue;
    const fallback = option.type === 'string' ? '' : 'n';
    const value = normalizeImportedKconfigValue(entry, option.type, fallback);
    if (value === undefined) continue;
    catalogBaselineValues.set(option.symbol, value);
    if (!menuTouched.has(option.symbol) && !catalogUserOverrides.has(option.symbol) &&
        !catalogImportedSymbols.has(option.symbol)) {
      menuValues.set(option.symbol, value);
    }
    if (value !== 'n' && value !== '') {
      catalogBaselineOrigins.set(option.symbol, {
        kind: 'kconfig-default', detail: 'Native Profile baseline',
      });
    }
  }
}
`, 'backfill Native Profile baseline');

app = replaceRange(app,
  'function catalogTargetConfig() {',
  '\nfunction applyProfilePackageOverrides(text) {',
`function catalogTargetConfig() {
  if (!ACTIVE_PROFILE_BASELINE || !PROFILE_BASELINE_MODULE) {
    throw new Error('Native Profile baseline has not finished loading');
  }
  return applyMenuConfig(PROFILE_BASELINE_MODULE.serializeConfigMap(ACTIVE_PROFILE_BASELINE.values));
}
`, 'generate from Native Profile baseline');

app = replaceOnce(app,
  "    ['menuconfig', !isCatalog || Boolean(MENU_CATALOG && menuOptionBySymbol.size)],\n    ['theme', Boolean($('fwThemeBox')?.options?.length && $('fwThemeBox')?.value)],",
  "    ['menuconfig', !isCatalog || Boolean(MENU_CATALOG && menuOptionBySymbol.size)],\n    ['profile-baseline', !isCatalog || Boolean(ACTIVE_PROFILE_BASELINE && PROFILE_BASELINE_STORE)],\n    ['theme', Boolean($('fwThemeBox')?.options?.length && $('fwThemeBox')?.value)],",
  'submit readiness baseline gate');

app = replaceOnce(app,
`async function generateResolvedConfigText(options = {}) {
  return generateConfigText(options);
}
`,
`async function generateResolvedConfigText(options = {}) {
  return generateConfigText(options);
}
function buildRequestOverrides(configText) {
  if (!ACTIVE_PROFILE_BASELINE || !PROFILE_BASELINE_MODULE) {
    throw new Error('Native Profile baseline has not finished loading');
  }
  const finalValues = PROFILE_BASELINE_MODULE.parseConfigMap(configText);
  return PROFILE_BASELINE_MODULE.diffProfileBaseline(ACTIVE_PROFILE_BASELINE, finalValues);
}
`, 'request override helper');

app = replaceOnce(app,
  '        const config = await generateResolvedConfigText();\n        const payload = {\n          schema: 5,',
  '        const config = await generateResolvedConfigText();\n        const overrides = buildRequestOverrides(config);\n        const payload = {\n          schema: 6,',
  'schema 6 payload');
app = replaceOnce(app,
  '          variant: state.variant.id, plugins, tag, lanip: state.lanip, config,',
  '          variant: state.variant.id, plugins, tag, lanip: state.lanip, overrides,',
  'remove full config from request');

app = replaceOnce(app,
  "  const explicit = payload && Array.isArray(payload.plugins) ? payload.plugins : null;",
  "  const explicit = payload && payload.schema !== 6 && Array.isArray(payload.plugins) ? payload.plugins : null;",
  'schema6 plugin display is not authority');
app = replaceOnce(app,
  '        let defaultValue = simpleKconfigDefault(option);',
  '        let defaultValue = catalogBaselineValues.get(option.symbol) ?? simpleKconfigDefault(option);',
  'import comparison uses Native baseline');

const importV6 = `async function reconstructSchema6Import(payload) {
  if (!payload || payload.schema !== 6 || !Array.isArray(payload.overrides) || !payload.customTarget) return null;
  const revision = String(payload.catalog?.revision || '').trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(revision) || revision !== String(MENU_INDEX?.assetRef || '').trim().toLowerCase()) {
    throw new Error('This build request uses a different immutable Catalog snapshot; load the matching page release before importing it');
  }
  const source = MENU_INDEX?.sources?.find((item) => item.id === payload.source);
  const branch = source?.branches?.find((item) =>
    item.id === payload.version && (!payload.branch || item.branch === payload.branch));
  if (!source || !branch || branch.state === 'unavailable') throw new Error('Build request Source/Branch is unavailable');
  if (payload.catalog?.sourceCommit && String(branch.commit || '').toLowerCase() !== String(payload.catalog.sourceCommit).toLowerCase()) {
    throw new Error('Build request upstream commit does not match the immutable Catalog snapshot');
  }
  const target = payload.customTarget;
  const request = {
    sourceId: source.id,
    branchId: branch.id,
    system: target.system,
    subtarget: target.subtarget,
    profileSymbol: target.profileSymbol || (target.profile ? \`DEVICE_\${target.profile}\` : ''),
  };
  await loadCatalog(source, branch, false, request);
  renderCatalogPicker(false, request);
  await applyCatalogTarget();
  if (!ACTIVE_PROFILE_BASELINE) throw new Error('Native Profile baseline could not be resolved for this build request');
  const values = PROFILE_BASELINE_MODULE.applyProfileOverrides(ACTIVE_PROFILE_BASELINE, payload.overrides);
  return {
    config: PROFILE_BASELINE_MODULE.serializeConfigMap(values),
    configId: ['catalog-target', source.id, branch.id, state.variant.id].join('/'),
  };
}
`;
app = replaceOnce(app,
  '\nasync function importConfigFile(file) {',
  `\n${importV6}\nasync function importConfigFile(file) {`,
  'schema6 import helper');

app = replaceOnce(app,
`      if (typeof payload.config !== 'string') throw new Error(t('import.jsonNoConfig'));
      text = payload.config;
    }
    text = text.replace(/\\r\\n/g, '\\n');
`,
`      if (payload.schema === 6) {
        const restored = await reconstructSchema6Import(payload);
        if (!restored) throw new Error(t('import.jsonInvalid', { msg: 'invalid schema 6 request' }));
        text = restored.config;
        payload.__restoredConfigId = restored.configId;
      } else {
        if (typeof payload.config !== 'string') throw new Error(t('import.jsonNoConfig'));
        text = payload.config;
      }
    }
    text = text.replace(/\\r\\n/g, '\\n');
`, 'schema6 JSON import');
app = replaceOnce(app,
  '    const configId = await selectImportedTarget(text, file.name, payload);',
  '    const configId = payload?.__restoredConfigId || await selectImportedTarget(text, file.name, payload);',
  'reuse schema6 resolved target');

if (!app.includes('schema: 6') || app.includes('variant: state.variant.id, plugins, tag, lanip: state.lanip, config,')) {
  throw new Error('app.js schema6 request conversion failed');
}
write('site/wrt/app.js', app);

let workflow = read('.github/workflows/custom-build.yml');
const submittedCount = (workflow.match(/submitted\.config/g) || []).length;
if (submittedCount < 3) throw new Error(`custom-build submitted.config anchor count too small: ${submittedCount}`);
workflow = workflow.replaceAll('SUBMITTED_CONFIG_OUT: submitted.config',
  'PROFILE_BASELINE_CONFIG_OUT: profile-baseline.config\n          RECONSTRUCTED_CONFIG_OUT: reconstructed.config\n          REQUEST_OVERRIDES_OUT: request-overrides.json');
workflow = workflow.replaceAll('submitted.config', 'reconstructed.config');
workflow = workflow.replaceAll('submitted_sha256', 'reconstructed_sha256');
workflow = replaceOnce(workflow,
`            openwrt/.config
            reconstructed.config
            pre-defconfig.config`,
`            openwrt/.config
            profile-baseline.config
            reconstructed.config
            request-overrides.json
            pre-defconfig.config`, 'config evidence files');
workflow = replaceOnce(workflow,
  'cp reconstructed.config request-audit.json package-mirror-report.json pre-defconfig.config defconfig.config defconfig.diff defconfig.log build.config failure-logs/ 2>/dev/null || true',
  'cp profile-baseline.config reconstructed.config request-overrides.json request-audit.json package-mirror-report.json pre-defconfig.config defconfig.config defconfig.diff defconfig.log build.config failure-logs/ 2>/dev/null || true',
  'failure config evidence');
if (/submitted\.config|SUBMITTED_CONFIG_OUT|submitted_sha256/.test(workflow)) {
  throw new Error('retired submitted.config authority remains in custom-build workflow');
}
write('.github/workflows/custom-build.yml', workflow);

let checkAll = read('tools/check-all.mjs');
checkAll = replaceOnce(checkAll,
  "  'test-kconfig-serializer.mjs',",
  "  'test-kconfig-serializer.mjs',\n  'test-profile-baseline.mjs',",
  'register profile baseline regression');
checkAll = replaceOnce(checkAll,
  "const engine = readFileSync(join(ROOT, 'site', 'wrt', 'lib', 'catalog-engine.js'), 'utf8');\nconst parser = readFileSync",
  "const engine = readFileSync(join(ROOT, 'site', 'wrt', 'lib', 'catalog-engine.js'), 'utf8');\nconst profileBaseline = readFileSync(join(ROOT, 'site', 'wrt', 'lib', 'profile-baseline.js'), 'utf8');\nconst parser = readFileSync",
  'load profile baseline architecture source');
checkAll = replaceOnce(checkAll,
  "parser.includes('Catalog Source 缺少有效构建工具') && parser.includes('schema 5 only accepts a Catalog target') &&",
  "parser.includes('Catalog Source 缺少有效构建工具') && parser.includes('schema 6 only accepts a Catalog target') &&\n  parser.includes('createProfileBaselineStore') && parser.includes('applyProfileOverrides') &&\n  profileBaseline.includes('branch-common-plus-exact-config-groups-v1') &&\n  !parser.includes('submitted.config') &&",
  'Catalog-only schema6 architecture contract');
write('tools/check-all.mjs', checkAll);

for (const path of ['site/wrt/app.js', '.github/workflows/custom-build.yml', 'tools/check-all.mjs']) {
  const text = read(path);
  if (text.includes('\r\n')) throw new Error(`${path}: CRLF introduced`);
}

rmSync(resolve(ROOT, 'tools/fix-f-apply.mjs'));
rmSync(resolve(ROOT, '.github/workflows/fix-f-apply.yml'));
console.log('Guarded fix-F runtime patch applied; temporary patch entrypoints removed.');
