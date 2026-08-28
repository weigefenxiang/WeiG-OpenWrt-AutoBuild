/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Configuration and build-request import, normalization, and restoration.
 */
'use strict';

function importStateSnapshot() {
  return {
    device: state.device?.id || '',
    source: state.source?.id || '',
    version: state.version?.id || '',
    variant: state.variant?.id || '',
    importedConfigId: state.importedConfigId || '',
  };
}
function importLogStep(stage, detail = {}) {
  if (!lastImportLog) return;
  lastImportLog.events.push({ time: new Date().toISOString(), stage, ...detail });
}
function beginImportLog(file) {
  lastImportLog = {
    schema: 1,
    startedAt: new Date().toISOString(),
    pageVersion: state.siteVersion,
    browser: navigator.userAgent,
    file: { name: file?.name || '', size: file?.size || 0, type: file?.type || '' },
    events: [],
  };
  importLogStep('start');
  $('importLogBtn').hidden = true;
}
function finishImportLog(status, error) {
  if (!lastImportLog) return;
  const detail = { status, state: importStateSnapshot() };
  if (error) {
    detail.error = {
      name: error.name || 'Error',
      message: error.message || String(error),
      stack: error.stack || '',
    };
  }
  importLogStep(status, detail);
  lastImportLog.finishedAt = new Date().toISOString();
  lastImportLog.status = status;
  $('importLogBtn').hidden = false;
}
function downloadImportLog() {
  if (!lastImportLog) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const text = 'WeiG OpenWrt config import diagnostic log\n' +
    'Privacy: full config content and passwords are not recorded.\n\n' +
    JSON.stringify(lastImportLog, null, 2) + '\n';
  downloadBlob(text, 'text/plain;charset=utf-8', `wrt-import-${lastImportLog.status || 'running'}-${stamp}.log`);
}
function showImportError(error) {
  finishImportLog('error', error);
  openModal(t('import.errorTitle'));
  const body = $('modalBody');
  body.textContent = '';
  const summary = document.createElement('p');
  summary.className = 'import-error';
  summary.textContent = t('import.fail', { msg: error.message || String(error) });
  const note = document.createElement('p');
  note.className = 'import-log-note';
  note.textContent = t('import.logPrivacy');
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const download = document.createElement('button');
  download.type = 'button';
  download.className = 'btn btn-primary';
  download.textContent = t('import.downloadLog');
  download.addEventListener('click', downloadImportLog);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn';
  close.textContent = t('btn.close');
  close.addEventListener('click', closeModal);
  actions.append(download, close);
  body.append(summary, note, actions);
}
function targetLines(text) {
  return text.replace(/\r\n/g, '\n').split('\n').filter((line) =>
    /^CONFIG_TARGET_(?:BOARD|SUBTARGET|PROFILE|ARCH_PACKAGES)=/.test(line) ||
    /^CONFIG_TARGET_.*_DEVICE_.*=y$/.test(line)).sort();
}
function importedConfigMeta(text, fileName, payload) {
  const values = parseConfigValues(text);
  const generated = text.match(
    /^# device=([^\s]+) source=([^\s]+) version=([^\s]+)(?: \(([^)]+)\))?.* variant=([^\s]+)$/m);
  const payloadParts = typeof payload?.configId === 'string' ? payload.configId.split('/') : [];
  const name = String(fileName || '').toLowerCase();
  const deviceLine = [...values].find(([symbol, value]) =>
    /^TARGET_.*_DEVICE_/.test(symbol) && value === 'y')?.[0] || '';
  const deviceParts = deviceLine.match(/^TARGET_(.+)_(.+)_DEVICE_(.+)$/);
  const clean = (value) => String(value || '').replace(/^"|"$/g, '');
  const sourceHintFromCatalog = (MENU_INDEX?.sources || []).find((source) =>
    [...new Set([source.id, source.label].filter(Boolean))].some((value) => {
      const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return CATALOG_ENGINE.catalogFileNameTokenMatch(value, name) ||
        new RegExp(`^#\\s*${escaped}\\s+Configuration\\s*$`, 'im').test(text);
    }))?.id || '';
  const sourceHint = payload?.source || generated?.[2] || payloadParts[1] ||
    sourceHintFromCatalog;
  let branchHint = payload?.version || generated?.[4] || generated?.[3] || payloadParts[2] || '';
  const knownBranches = [...new Set((MENU_INDEX?.sources || [])
    .flatMap((source) => (source.branches || []).map((branch) => branch.branch)))];
  const namedBranch = knownBranches.find((branch) => CATALOG_ENGINE.catalogFileNameTokenMatch(
    branch, name, [branch.match(/\d+(?:\.\d+)+$/)?.[0]],
  ));
  if (!branchHint && namedBranch) branchHint = namedBranch;
  const profileSymbol = clean(values.get('TARGET_PROFILE')) ||
    (deviceParts?.[3] ? `DEVICE_${deviceParts[3]}` : '');
  return {
    sourceHint,
    branchHint,
    system: clean(values.get('TARGET_BOARD')) || deviceParts?.[1] || '',
    subtarget: clean(values.get('TARGET_SUBTARGET')) || deviceParts?.[2] || '',
    profileSymbol: profileSymbol
      ? (profileSymbol.startsWith('DEVICE_') ? profileSymbol : `DEVICE_${profileSymbol}`) : '',
  };
}
function chooseImportedSourceBranch(meta) {
  const sources = MENU_INDEX?.sources || [];
  if (!sources.length) return Promise.reject(new Error('Catalog source index is empty'));
  importLogStep('source-branch-candidates', {
    detectedSource: meta.sourceHint || '',
    detectedBranch: meta.branchHint || '',
    sources: sources.map((source) => ({
      id: source.id,
      branches: source.branches.map((branch) => ({
        id: branch.id, branch: branch.branch, state: branch.state || 'fresh',
      })),
    })),
  });
  return new Promise((resolve) => {
    openModal(t('import.sourceTitle'));
    $('modal').querySelector('.modal').classList.add('modal-import-source');
    const body = $('modalBody');
    body.textContent = '';
    const intro = document.createElement('p');
    intro.textContent = t('import.sourceIntro');
    const form = document.createElement('div');
    form.className = 'import-source-grid';
    const sourceField = document.createElement('label');
    sourceField.className = 'import-source-field';
    const sourceLabel = document.createElement('span');
    sourceLabel.textContent = t('target.field.source');
    const sourceSelect = document.createElement('select');
    sourceSelect.className = 'target-select';
    const detectedSource = sources.find((source) => source.id === meta.sourceHint);
    const currentSource = sources.find((source) => source.id === state.source?.id);
    for (const source of sources) {
      const option = document.createElement('option');
      option.value = source.id;
      option.textContent = source.label || source.id;
      sourceSelect.appendChild(option);
    }
    sourceSelect.value = (detectedSource || currentSource || sources[0]).id;
    sourceField.append(sourceLabel, sourceSelect);

    const branchField = document.createElement('label');
    branchField.className = 'import-source-field';
    const branchLabel = document.createElement('span');
    branchLabel.textContent = t('target.field.branch');
    const branchSelect = document.createElement('select');
    branchSelect.className = 'target-select';
    branchField.append(branchLabel, branchSelect);
    form.append(sourceField, branchField);

    const target = document.createElement('div');
    target.className = 'import-target-preview';
    const targetParts = [
      ['Target System', meta.system],
      ['Subtarget', meta.subtarget],
      ['Target Profile', meta.profileSymbol],
    ].filter(([, value]) => value);
    for (const [label, value] of targetParts) {
      const item = document.createElement('div');
      const key = document.createElement('span');
      const val = document.createElement('strong');
      key.textContent = label;
      val.textContent = value;
      item.append(key, val);
      target.appendChild(item);
    }

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'btn btn-primary';
    confirm.textContent = t('import.sourceContinue');
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn';
    cancel.textContent = t('import.sourceCancel');
    actions.append(confirm, cancel);
    body.append(intro, form);
    if (targetParts.length) body.appendChild(target);
    body.appendChild(actions);

    const fillBranches = () => {
      const source = sources.find((item) => item.id === sourceSelect.value) || sources[0];
      branchSelect.textContent = '';
      for (const branch of source.branches) {
        const option = document.createElement('option');
        option.value = branch.id;
        option.textContent = catalogBranchLabel(branch);
        option.disabled = branch.state === 'unavailable';
        branchSelect.appendChild(option);
      }
      const normalized = String(meta.branchHint || '').toLowerCase();
      const detected = source.branches.find((branch) =>
        branch.id.toLowerCase() === normalized || branch.branch.toLowerCase() === normalized);
      const current = source.id === state.source?.id
        ? source.branches.find((branch) => branch.id === state.version?.id) : null;
      const selected = [detected, current, ...source.branches]
        .find((branch) => branch && branch.state !== 'unavailable');
      if (selected) branchSelect.value = selected.id;
      confirm.disabled = !selected;
    };
    sourceSelect.addEventListener('change', fillBranches);
    fillBranches();

    const finish = (value) => {
      modalCancelHandler = null;
      closeModal();
      resolve(value);
    };
    modalCancelHandler = () => resolve(null);
    cancel.addEventListener('click', () => finish(null));
    confirm.addEventListener('click', () => {
      const source = sources.find((item) => item.id === sourceSelect.value);
      const branch = source?.branches.find((item) => item.id === branchSelect.value);
      if (!source || !branch || branch.state === 'unavailable') return;
      finish({ source, branch });
    });
    sourceSelect.focus();
  });
}
function renderImportedCustomPicker() {
  ensureTargetSelectorControls(DEFAULT_TARGET_SELECTORS);
  const rows = [
    ['targetSource', state.source.id, state.source.label],
    ['targetBranch', state.version.id, state.version.branch],
    ['targetSystem', state.device.target.system, state.device.target.systemLabel],
    ['targetSubtarget', state.device.target.subtarget, state.device.target.subtargetLabel],
    ['targetProfile', state.variant.id, state.device.target.profileLabel],
  ];
  for (const [id, value, label] of rows) {
    const select = $(id);
    select.textContent = '';
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label || value;
    select.appendChild(option);
    select.disabled = true;
  }
}
async function selectImportedTarget(text, fileName, payload) {
  const meta = importedConfigMeta(text, fileName, payload);
  importLogStep('target-detected', meta);
  const selected = await chooseImportedSourceBranch(meta);
  if (!selected) return '';
  const { source, branch } = selected;
  importLogStep('branch-selected', { source: source.id, branch: branch.branch });
  await loadCatalog(source, branch, false);
  const target = MENU_CATALOG?.targets?.find((item) =>
    item.board === meta.system && item.subtarget === meta.subtarget);
  const profile = target?.profiles?.find((item) => item.id === meta.profileSymbol);
  if (target && profile) {
    importedTargetVerified = true;
    for (const select of targetControlElements()) select.disabled = false;
    renderCatalogPicker(false, {
      sourceId: source.id,
      branchId: branch.id,
      system: meta.system,
      subtarget: meta.subtarget,
      profileSymbol: meta.profileSymbol,
    });
    await applyCatalogTarget();
    return ['catalog-target', source.id, branch.id, profile.id].join('/');
  }
  importedTargetVerified = false;
  const sourceObject = catalogSourceObject(source, branch);
  const variant = {
    id: meta.profileSymbol || 'custom', profile: meta.profileSymbol || 'custom',
    name: meta.profileSymbol || 'Custom Target', capacity: 4096, versions: [branch.id],
  };
  sourceObject.variants = [variant];
  const custom = customDeviceFromConfig(text);
  custom.sources = [sourceObject];
  custom.target.profileSymbol = meta.profileSymbol;
  state.source = sourceObject;
  state.version = sourceObject.versions[0];
  state.variant = variant;
  state.device = custom;
  await switchDevice(custom, false);
  activateTargetRecord({ device: custom, source: sourceObject, version: sourceObject.versions[0], variant });
  renderImportedCustomPicker();
  return ['custom-target', source.id, branch.id, variant.id].join('/');
}
function customDeviceFromConfig(text) {
  const lines = targetLines(text);
  const valueOf = (name) => {
    const line = lines.find((item) => item.startsWith(`CONFIG_TARGET_${name}=`));
    return line ? line.slice(line.indexOf('=') + 1).replace(/^"|"$/g, '') : '';
  };
  const deviceLine = lines.find((line) => /^CONFIG_TARGET_.*_DEVICE_.*=y$/.test(line)) || '';
  const deviceParts = deviceLine.match(/^CONFIG_TARGET_([^_]+)_([^_]+)_DEVICE_(.+)=y$/);
  const board = valueOf('BOARD') || deviceParts?.[1] || '';
  const subtarget = valueOf('SUBTARGET') || deviceParts?.[2] || '';
  const profile = valueOf('PROFILE').replace(/^DEVICE_/, '') ||
    deviceParts?.[3] || '';
  if (!deviceLine && (!board || !subtarget)) throw new Error(t('import.noMatch'));
  const label = [board || 'Target', subtarget, profile].filter(Boolean).join(' / ');
  return {
    id: 'custom-target',
    brand: 'Custom Target',
    name: label,
    chip: board || 'custom',
    plugins: 'seed',
    note: 'Uploaded authoritative .config',
    enabled: true,
    kind: 'target',
    dir: 'platform/custom-target',
    target: {
      system: board || 'custom',
      systemLabel: board || 'Custom',
      subtarget: subtarget || 'custom',
      subtargetLabel: subtarget || 'Custom',
      profile: profile || 'custom',
      profileLabel: profile || 'Custom Target',
    },
    sources: [],
  };
}

/*
 * Schema 6 stores a delta against the Native Profile baseline.  The delta is
 * intentionally not replayed when the Catalog snapshot has changed: package
 * rows also contain Kconfig-selected dependencies, and replaying those rows
 * would make an old dependency look like a user's explicit choice.  Keep the
 * migration helpers here so the normal Catalog loader and the normal Kconfig
 * intent path remain the single source of truth.
 */
const IMPORT_KCONFIG_SYMBOL_RE = /^[A-Za-z0-9_+@./-]+$/;
const IMPORT_KCONFIG_VALUE_RE = /^(?:[ymn]|-?\d+|0[xX][0-9a-fA-F]+|"(?:[^"\\]|\\.)*")$/;
const IMPORT_PLUGIN_TOKEN_RE = /^[+-]?[A-Za-z0-9_.@_+-]{1,96}$/;

function validateSchema6OverrideRows(overrides) {
  if (!Array.isArray(overrides)) throw new Error('Kconfig overrides must be an array');
  const seen = new Set();
  for (const pair of overrides) {
    if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' ||
        typeof pair[1] !== 'string') {
      throw new Error('invalid Kconfig override row');
    }
    const symbol = pair[0];
    const value = pair[1];
    if (!IMPORT_KCONFIG_SYMBOL_RE.test(symbol) || seen.has(symbol) || !value ||
        !IMPORT_KCONFIG_VALUE_RE.test(value) ||
        /[\r\n\0]/.test(value)) {
      throw new Error(`invalid Kconfig override: ${symbol || '(missing)'}`);
    }
    seen.add(symbol);
  }
  return overrides.map(([symbol, value]) => [symbol, value]);
}

function schema6PluginActionRows(payload) {
  const rawPlugins = payload?.plugins;
  if (rawPlugins == null) return { rows: [], invalid: [], conflicts: [] };
  if (!Array.isArray(rawPlugins)) throw new Error('Build request plugins must be an array');
  const rows = [];
  const byId = new Map();
  const invalid = [];
  const conflicts = [];
  for (const raw of rawPlugins) {
    if (typeof raw !== 'string' || !IMPORT_PLUGIN_TOKEN_RE.test(raw)) {
      invalid.push(String(raw));
      continue;
    }
    const id = raw.replace(/^[+-]/, '');
    const mode = raw.startsWith('-') ? 'exclude' : 'select';
    const previous = byId.get(id);
    if (previous) {
      if (previous.mode !== mode) conflicts.push({ id, tokens: [previous.raw, raw] });
      continue;
    }
    const row = { raw, id, mode };
    byId.set(id, row);
    rows.push(row);
  }
  if (invalid.length) throw new Error(`Build request contains invalid plugin entries: ${invalid.join(', ')}`);
  return { rows, invalid, conflicts };
}

function schema6PluginPackageCandidates(plugin, sourceId) {
  return [...new Set([
    plugin?.pkgs?.[sourceId], plugin?.pkg, ...(plugin?.catalogCandidates || []),
  ].filter((value) => typeof value === 'string' && /^[A-Za-z0-9_.+@-]+$/.test(value)))];
}

function schema6LegacyPluginPackages(payload) {
  return new Set((payload?.overrides || [])
    .filter((pair) => Array.isArray(pair) && typeof pair[0] === 'string' && pair[0].startsWith('PACKAGE_'))
    .map(([symbol]) => String(symbol).slice('PACKAGE_'.length))
    .filter((name) => /^luci-app-[A-Za-z0-9_.+@-]+$/.test(name)));
}

function resolveSchema6PluginMigration(payload) {
  const rows = schema6PluginActionRows(payload);
  const plugins = Array.isArray(PLUGINS?.plugins) ? PLUGINS.plugins : [];
  const legacyPackages = schema6LegacyPluginPackages(payload);
  const byId = new Map(plugins.map((plugin) => [plugin.id, plugin]));
  const byPackage = new Map();
  for (const plugin of plugins) {
    for (const packageName of schema6PluginPackageCandidates(plugin, state.source?.id)) {
      const matches = byPackage.get(packageName) || [];
      matches.push(plugin);
      byPackage.set(packageName, matches);
    }
  }
  const actions = [];
  const missing = [];
  const ambiguous = [];
  const actionByPlugin = new Map();
  for (const row of rows.rows) {
    const packageNames = new Set();
    /* Older exports commonly used the short curated id (for example
     * `adblock`) while their override carried PACKAGE_luci-app-adblock.
     * Accept that legacy alias only when the exact old package symbol is in
     * this request; never infer a plugin from an arbitrary dependency row. */
    const legacyPackage = row.id.startsWith('PACKAGE_') ? row.id.slice(8)
      : (row.id.startsWith('luci-app-') ? row.id : `luci-app-${row.id}`);
    if (legacyPackages.has(legacyPackage)) packageNames.add(legacyPackage);
    const packageMatches = [...packageNames].flatMap((name) => byPackage.get(name) || []);
    const uniquePackageMatches = [...new Map(packageMatches.map((plugin) => [plugin.id, plugin])).values()];
    const matches = byId.has(row.id) ? [byId.get(row.id)] : uniquePackageMatches;
    if (!matches.length) {
      missing.push({ token: row.raw, id: row.id });
      continue;
    }
    if (matches.length !== 1) {
      ambiguous.push({ token: row.raw, id: row.id,
        plugins: matches.map((plugin) => plugin.id) });
      continue;
    }
    const plugin = matches[0];
    const previous = actionByPlugin.get(plugin.id);
    if (previous && previous.mode !== row.mode) {
      ambiguous.push({ token: row.raw, id: row.id, plugins: [plugin.id] });
      continue;
    }
    if (previous) continue;
    const packageCandidates = schema6PluginPackageCandidates(plugin, state.source?.id);
    const action = {
      pluginId: plugin.id,
      mode: row.mode,
      sourceToken: row.raw,
      packageName: packageCandidates[0] || '',
    };
    actionByPlugin.set(plugin.id, action);
    actions.push(action);
  }
  return {
    rows: rows.rows,
    actions,
    missing,
    ambiguous: [...rows.conflicts.map((item) => ({
      token: item.tokens.join(' / '), id: item.id, plugins: [],
    })), ...ambiguous],
  };
}

function prepareSchema6SafeOverrides(overrides) {
  const safe = [];
  const skipped = [];
  for (const [symbol, rawValue] of validateSchema6OverrideRows(overrides)) {
    if (symbol.startsWith('PACKAGE_')) {
      skipped.push({ symbol, reason: 'package/dependency is recalculated from plugin intent' });
      continue;
    }
    const option = menuOptionBySymbol.get(symbol);
    if (!option) {
      skipped.push({ symbol, reason: 'symbol is not present in the current Catalog' });
      continue;
    }
    if (ACTIVE_PROFILE_BASELINE?.protectedSymbols?.has(symbol) || isCatalogTargetSymbol(symbol)) {
      skipped.push({ symbol, reason: 'Target/Profile identity is controlled by the selected target' });
      continue;
    }
    /* Kconfig bool/tristate rows can be either direct intent or an old select/
     * imply closure.  The schema-6 payload does not preserve that distinction,
     * so only scalar rows, which cannot be Kconfig-selected, are safe to carry.
     */
    if (!['string', 'int', 'hex'].includes(option.type) || option.hidden || option.userSettable === false) {
      skipped.push({ symbol, reason: 'bool/tristate or non-user-settable value may be an old dependency' });
      continue;
    }
    let value;
    try {
      value = normalizeKconfigValueByType(rawValue, option.type, symbol);
    } catch (error) {
      throw new Error(`Invalid value for ${symbol}: ${error.message}`);
    }
    safe.push([symbol, value]);
  }
  return { safe, skipped };
}

function applySchema6MigrationPlan(plan, { log = true } = {}) {
  const appliedPlugins = [];
  const failedPlugins = [];
  const migratedOverrides = [];
  const skippedOverrides = [...(plan.skippedOverrides || [])];
  const pluginById = new Map((PLUGINS?.plugins || []).map((plugin) => [plugin.id, plugin]));
  for (const action of plan.actions || []) {
    const plugin = pluginById.get(action.pluginId);
    const option = plugin ? curatedMenuOption(plugin) : null;
    const status = plugin && typeof pluginState === 'function' ? pluginState(plugin) : '';
    if (!option || ['unavailable', 'loading'].includes(status)) {
      failedPlugins.push({ ...action, reason: !option
        ? 'plugin package is not present in the current Catalog'
        : `plugin is ${status} under the current Target` });
      continue;
    }
    try {
      const value = action.mode === 'exclude' ? 'n' : 'y';
      applyMenuValue(option, value, false, 'user');
      appliedPlugins.push(action);
      if (log) importLogStep('plugin-migrated', { plugin: action.pluginId, mode: action.mode });
    } catch (error) {
      failedPlugins.push({ ...action, reason: String(error?.message || error) });
      if (log) importLogStep('plugin-migration-skipped', {
        plugin: action.pluginId, mode: action.mode, reason: String(error?.message || error),
      });
    }
  }
  for (const [symbol, value] of plan.safeOverrides || []) {
    const option = menuOptionBySymbol.get(symbol);
    if (!option) {
      skippedOverrides.push({ symbol, reason: 'symbol is not present in the current Catalog' });
      continue;
    }
    try {
      applyMenuValue(option, value, false, 'imported');
      migratedOverrides.push([symbol, value]);
    } catch (error) {
      skippedOverrides.push({ symbol, reason: String(error?.message || error) });
    }
  }
  reconcileImportedConditionalDefaults();
  return {
    ...plan,
    appliedPlugins,
    failedPlugins,
    migratedOverrides,
    skippedOverrides,
  };
}

function schema6MigrationSummary(migration) {
  const selected = migration.appliedPlugins?.filter((item) => item.mode === 'select').length || 0;
  const excluded = migration.appliedPlugins?.filter((item) => item.mode === 'exclude').length || 0;
  const missing = (migration.missing || []).map((item) => item.token);
  const failed = (migration.failedPlugins || []).map((item) => item.pluginId);
  const ambiguous = (migration.ambiguous || []).map((item) => item.token);
  const skipped = (migration.skippedOverrides || []).map((item) => item.symbol);
  const list = (values) => values.length ? formatList(values) : '—';
  return t('import.catalogMigrationSummary', {
    selected,
    excluded,
    missing: list(missing),
    failed: list(failed),
    conflicts: list(ambiguous),
    skippedCount: skipped.length,
    skippedList: list(skipped.slice(0, 12)) + (skipped.length > 12 ? '…' : ''),
  });
}

function registerSchema6PluginIntents(payload) {
  const migration = resolveSchema6PluginMigration(payload);
  for (const action of migration.actions) {
    const plugin = PLUGINS.plugins.find((item) => item.id === action.pluginId);
    const option = plugin ? curatedMenuOption(plugin) : null;
    if (!option) continue;
    const value = action.mode === 'exclude' ? 'n' : (menuValues.get(option.symbol) ?? 'y');
    catalogUserOverrides.set(option.symbol, value);
    if (action.mode === 'exclude') {
      state.sel.delete(plugin.id);
      state.removed.add(plugin.id);
      catalogImportedSymbols.delete(option.symbol);
    } else {
      state.sel.add(plugin.id);
      state.removed.delete(plugin.id);
    }
  }
  return migration;
}
function restoreSelections(config, payload) {
  const schema6Migration = payload?.__catalogMigration?.mode === 'cross-snapshot'
    ? payload.__catalogMigration : null;
  state.sel.clear();
  state.removed.clear();
  catalogUserOverrides.clear();
  catalogImportedSymbols.clear();
  catalogDependencySymbols.clear();
  catalogConditionalDefaultSymbols.clear();
  importedConfigValues.clear();
  importedUnknownOriginal.clear();
  importedUnknownEdits.clear();
  menuImportedOriginal.clear();
  menuImportedNonDefault.clear();
  menuTouched.clear();
  markCatalogStateChanged();
  if (schema6Migration) initializeCatalogBaseline();
  let importedConfigEntries = parseConfigEntries(config);
  for (const [symbol, entry] of importedConfigEntries) importedConfigValues.set(symbol, entry.value);
  const explicit = payload && payload.schema !== 6 && Array.isArray(payload.plugins) ? payload.plugins : null;
  let skipped = 0;
  for (const p of PLUGINS.plugins) {
    const pkg = p.pkgs?.[state.source.id] || p.pkg;
    if (!pkg) {
      skipped++;
      importLogStep('plugin-skipped', { plugin: p.id, reason: 'missing package mapping' });
      continue;
    }
    const raw = explicit && explicit.find((id) =>
      typeof id === 'string' && id.replace(/^[+-]/, '') === p.id);
    if (raw) {
      if (raw.startsWith('-')) state.removed.add(p.id);
      else state.sel.add(p.id);
    }
  }
  if (menuSearchOptions.length && !schema6Migration) {
    for (const option of menuSearchOptions) {
      if (importedConfigValues.has(option.symbol)) {
        const entry = importedConfigEntries.get(option.symbol);
        const fallbackValue = menuValues.get(option.symbol) ?? simpleKconfigDefault(option) ?? '';
        const value = normalizeImportedKconfigValue(entry, option.type, fallbackValue);
        if (value === undefined) continue;
        menuValues.set(option.symbol, value);
        catalogImportedSymbols.add(option.symbol);
        menuImportedOriginal.set(option.symbol, value);
        let defaultValue = catalogBaselineValues.get(option.symbol) ?? simpleKconfigDefault(option);
        if ((option.type === 'bool' || option.type === 'tristate') && !defaultValue) defaultValue = 'n';
        if (String(value) !== String(defaultValue)) menuImportedNonDefault.add(option.symbol);
      }
    }
    reconcileImportedConditionalDefaults();
  }
  if (explicit) {
    for (const p of PLUGINS.plugins) {
      const raw = explicit.find((id) => typeof id === 'string' && id.replace(/^[+-]/, '') === p.id);
      if (!raw) continue;
      const option = curatedMenuOption(p);
      if (!option) continue;
      const value = raw.startsWith('-') ? 'n' : (menuValues.get(option.symbol) ?? 'y');
      catalogUserOverrides.set(option.symbol, value);
      if (raw.startsWith('-')) catalogImportedSymbols.delete(option.symbol);
    }
  }
  let appliedMigration = schema6Migration;
  if (schema6Migration) {
    appliedMigration = applySchema6MigrationPlan(schema6Migration, { log: false });
    state.importedConfig = catalogTargetConfig();
    importedConfigEntries = parseConfigEntries(state.importedConfig);
    importedConfigValues.clear();
    importedUnknownOriginal.clear();
    for (const [symbol, entry] of importedConfigEntries) importedConfigValues.set(symbol, entry.value);
    for (const [symbol, value] of appliedMigration.migratedOverrides || []) {
      menuImportedOriginal.set(symbol, value);
      const defaultValue = catalogBaselineValues.get(symbol) ?? 'n';
      if (String(value) !== String(defaultValue)) menuImportedNonDefault.add(symbol);
    }
    appliedMigration.summary = schema6MigrationSummary(appliedMigration);
    payload.__catalogMigration = appliedMigration;
  } else if (payload?.schema === 6) {
    const migration = registerSchema6PluginIntents(payload);
    if (migration.missing.length || migration.ambiguous.length) {
      importLogStep('plugin-intents-unresolved', {
        missing: migration.missing, ambiguous: migration.ambiguous,
      });
    }
  }
  for (const [symbol, value] of importedConfigValues) {
    if (!menuOptionBySymbol.has(symbol) && !isCatalogTargetSymbol(symbol) && !symbol.startsWith('TARGET_')) {
      importedUnknownOriginal.set(symbol, value);
    }
  }
  markCatalogStateChanged();
  importLogStep('values-restored', {
    catalog: menuImportedOriginal.size,
    importedOnly: importedUnknownOriginal.size,
    selectedPlugins: state.sel.size,
    removedPlugins: state.removed.size,
    skippedPlugins: skipped,
    ...(appliedMigration ? {
      migratedPlugins: appliedMigration.appliedPlugins?.length || 0,
      migrationWarnings: (appliedMigration.missing?.length || 0) +
        (appliedMigration.ambiguous?.length || 0) +
        (appliedMigration.failedPlugins?.length || 0) +
        (appliedMigration.skippedOverrides?.length || 0),
    } : {}),
  });
  if (payload) {
    if (payload.tag) $('tagBox').value = BUILD_IDENTITY_MODULE.normalizeBuildTag(payload.tag);
    if (LANIP_RE.test(String(payload.lanip || ''))) $('lanipBox').value = state.lanip = payload.lanip;
    if (payload.rootpw === '@empty' || /^[A-Za-z0-9@#%^&*_+=.,:!?-]{4,32}$/.test(String(payload.rootpw || ''))) {
      $('rootpwBox').value = state.rootpw = payload.rootpw;
      state.rootpwAuto = false;
    }
    const fw = payload.firmware || {};
    const zone = TIMEZONES.zones.find((item) => item.zonename === fw.zonename) ||
      TIMEZONES.zones.find((item) => item.zonename === fw.timezone) ||
      TIMEZONES.zones.find((item) => item.timezone === fw.timezone);
    if (zone) state.timezone = zone.zonename;
    if (/^luci-theme-[A-Za-z0-9._+-]+$/.test(String(fw.theme || '')) &&
        menuOptionBySymbol.has(`PACKAGE_${fw.theme}`)) state.theme = fw.theme;
    if (NTP_PRESETS[fw.ntp]) state.ntp = fw.ntp;
    const importedMirror = fw.packageMirror || fw.opkg;
    if (packageMirrorAvailable(importedMirror, state.source?.id)) {
      state.packageMirror = PACKAGE_MIRRORS?.aliases?.[importedMirror] || importedMirror;
      packageMirrorSelectionExplicit = true;
    }
  }
  renderFirmwareSettings();
  renderGroups();
  applyMenuconfigExpandedState(true);
  resetMenuNavigation();
  menuSelectedExpanded = false;
  menuVisibleLimit = MENU_PAGE_SIZE;
  importedUnknownLimit = MENU_PAGE_SIZE;
  $('menuconfigSelectedOnly').checked = true;
  refreshMenuconfigFilterSummary();
  renderMenuconfig();
  renderImportedWorkspace();
  updateStats();
}
function decodeLegacyJsonString(raw) {
  let output = '';
  for (let index = 0; index < raw.length; index++) {
    const char = raw[index];
    if (char !== '\\') {
      output += char;
      continue;
    }
    const next = raw[++index];
    if (next === undefined) {
      output += '\\';
      break;
    }
    if (next === 'n') output += '\n';
    else if (next === 'r') output += '\r';
    else if (next === 't') output += '\t';
    else if (next === 'b') output += '\b';
    else if (next === 'f') output += '\f';
    else if (next === '"') output += '"';
    else if (next === '\\') output += '\\';
    else if (next === '/') output += '/';
    else if (next === 'u' && /^[0-9A-Fa-f]{4}$/.test(raw.slice(index + 1, index + 5))) {
      output += String.fromCharCode(parseInt(raw.slice(index + 1, index + 5), 16));
      index += 4;
    } else output += `\\${next}`;
  }
  return output;
}
function recoverLegacyWeiGJson(text) {
  const source = String(text || '');
  if (!/"schema"\s*:\s*[3456]/.test(source) || !/"pageVersion"\s*:/.test(source) ||
      !/# Generated by WeiG-OpenWrt-AutoBuild/.test(source) || !/"use_defconfig"\s*:/.test(source)) return null;
  const field = /"config"\s*:\s*"/.exec(source);
  if (!field) return null;
  const startQuote = field.index + field[0].length - 1;
  const useField = source.lastIndexOf('\n  "use_defconfig"');
  if (useField < startQuote) return null;
  const comma = source.lastIndexOf(',', useField);
  if (comma < startQuote) return null;
  let endQuote = comma - 1;
  while (endQuote > startQuote && /\s/.test(source[endQuote])) endQuote--;
  if (source[endQuote] !== '"') return null;
  const config = decodeLegacyJsonString(source.slice(startQuote + 1, endQuote));
  const repaired = `${source.slice(0, startQuote)}${JSON.stringify(config)}${source.slice(endQuote + 1)}`;
  const payload = JSON.parse(repaired);
  if (typeof payload.config !== 'string') return null;
  return payload;
}
function parseImportedJson(text) {
  try {
    return { payload: JSON.parse(text), recovered: false };
  } catch (error) {
    try {
      const payload = recoverLegacyWeiGJson(text);
      if (payload) return { payload, recovered: true };
    } catch (legacyError) {
      console.warn('[Legacy WeiG JSON recovery failed]', legacyError);
    }
    throw error;
  }
}

async function reconstructSchema6Import(payload) {
  if (!payload || payload.schema !== 6 || !Array.isArray(payload.overrides) || !payload.customTarget) return null;
  const revision = String(payload.catalog?.revision || '').trim().toLowerCase();
  const currentRevision = String(MENU_INDEX?.assetRef || '').trim().toLowerCase();
  const sameSnapshot = /^[a-f0-9]{40}$/.test(revision) && revision === currentRevision;
  const source = MENU_INDEX?.sources?.find((item) => item.id === payload.source);
  const branch = source?.branches?.find((item) =>
    item.id === payload.version && (!payload.branch || item.branch === payload.branch));
  if (!source || !branch || branch.state === 'unavailable') throw new Error('Build request Source/Branch is unavailable');
  if (payload.catalog?.sourceCommit && String(branch.commit || '').toLowerCase() !== String(payload.catalog.sourceCommit).toLowerCase()) {
    if (sameSnapshot) throw new Error('Build request upstream commit does not match the immutable Catalog snapshot');
    importLogStep('source-commit-changed', {
      request: String(payload.catalog.sourceCommit).toLowerCase(), current: String(branch.commit || '').toLowerCase(),
    });
  }
  const target = payload.customTarget;
  const request = {
    sourceId: source.id,
    branchId: branch.id,
    system: target.system,
    subtarget: target.subtarget,
    profileSymbol: target.profileSymbol || (target.profile ? `DEVICE_${target.profile}` : ''),
  };
  await loadCatalog(source, branch, false, request);
  renderCatalogPicker(false, request);
  await applyCatalogTarget();
  if (!ACTIVE_PROFILE_BASELINE) throw new Error('Native Profile baseline could not be resolved for this build request');
  await ensureCatalogMenuLoaded(true);
  try {
    await ensureCatalogApplications(!sameSnapshot);
  } catch (error) {
    const detail = String(error?.message || error);
    importLogStep('applications-unavailable', { reason: detail });
    throw new Error(t('import.catalogApplicationsUnavailable', { msg: detail }));
  }
  if (!sameSnapshot) {
    const pluginMigration = resolveSchema6PluginMigration(payload);
    const safeOverrides = prepareSchema6SafeOverrides(payload.overrides);
    const migration = {
      mode: 'cross-snapshot',
      sourceRevision: revision,
      currentRevision,
      actions: pluginMigration.actions,
      missing: pluginMigration.missing,
      ambiguous: pluginMigration.ambiguous,
      safeOverrides: safeOverrides.safe,
      skippedOverrides: safeOverrides.skipped,
    };
    return {
      config: PROFILE_BASELINE_MODULE.serializeConfigMap(ACTIVE_PROFILE_BASELINE.values),
      configId: ['catalog-target', source.id, branch.id, state.variant.id].join('/'),
      migration,
    };
  }
  const allowedSymbols = CATALOG_MODEL?.bySymbol instanceof Map
    ? new Set(CATALOG_MODEL.bySymbol.keys()) : new Set();
  const values = PROFILE_BASELINE_MODULE.applyProfileOverrides(
    ACTIVE_PROFILE_BASELINE, payload.overrides, { allowedSymbols },
  );
  return {
    config: PROFILE_BASELINE_MODULE.serializeConfigMap(values),
    configId: ['catalog-target', source.id, branch.id, state.variant.id].join('/'),
  };
}

async function importConfigFile(file) {
  const seq = ++configImportSeq;
  importingConfig = true;
  beginImportLog(file);
  try {
    if (!file || file.size < 32 || file.size > 2 * 1024 * 1024) throw new Error(t('import.size'));
    importLogStep('file-accepted');
    let text = await file.text();
    importLogStep('file-read');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    if (text.includes('\0')) throw new Error(t('import.binary'));
    let payload = null;
    let legacyJsonRecovered = false;
    if (/\.json$/i.test(file.name) || text.trimStart().startsWith('{')) {
      importLogStep('json-detected');
      try {
        const parsed = parseImportedJson(text);
        payload = parsed.payload;
        legacyJsonRecovered = parsed.recovered;
      } catch (e) {
        throw new Error(t('import.jsonInvalid', { msg: e.message }));
      }
      if (payload.schema === 6) {
        const restored = await reconstructSchema6Import(payload);
        if (!restored) throw new Error(t('import.jsonInvalid', { msg: 'invalid schema 6 request' }));
        text = restored.config;
        payload.__restoredConfigId = restored.configId;
        if (restored.migration) payload.__catalogMigration = restored.migration;
      } else {
        if (typeof payload.config !== 'string') throw new Error(t('import.jsonNoConfig'));
        text = payload.config;
      }
    }
    text = text.replace(/\r\n/g, '\n');
    state.useDefconfig = payload && typeof payload.use_defconfig === 'boolean'
      ? payload.use_defconfig : false;
    if ($('defconfigToggle')) $('defconfigToggle').checked = state.useDefconfig;
    const configId = payload?.__restoredConfigId || await selectImportedTarget(text, file.name, payload);
    if (seq !== configImportSeq) return;
    if (!configId) {
      finishImportLog('cancelled');
      return;
    }
    state.importedConfig = text.endsWith('\n') ? text : text + '\n';
    state.importedConfigId = configId;
    importLogStep('profile-selected', { verified: importedTargetVerified, state: importStateSnapshot() });
    await ensurePackageMirrors();
    if (seq !== configImportSeq) return;
    restoreSelections(state.importedConfig, payload);
    finishImportLog('success');
    showToast(legacyJsonRecovered
      ? t('runtime.8527b3686481')
      : t('import.ok', { id: configId }));
    if (payload?.__catalogMigration?.summary) {
      setTimeout(() => showToast(payload.__catalogMigration.summary, 'warning'), 0);
    }
    updateSubmitGate();
  } finally {
    if (seq === configImportSeq) importingConfig = false;
  }
}
$('importBtn').addEventListener('click', () => $('configImport').click());
$('importLogBtn').addEventListener('click', downloadImportLog);
let reopenSubmitAfterImport = false;
$('configImport').addEventListener('change', async () => {
  const file = $('configImport').files[0];
  $('configImport').value = '';
  try {
    await importConfigFile(file);
    if (reopenSubmitAfterImport) openSubmitModal();
  } catch (e) {
    showImportError(e);
  } finally {
    reopenSubmitAfterImport = false;
  }
});
