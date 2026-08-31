/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Catalog fact loading, immutable snapshot identity, indexes, target selection, and build contract.
 */
'use strict';

function targetControlId(id) {
  const known = { system: 'targetSystem', subtarget: 'targetSubtarget', profile: 'targetProfile' };
  return known[id] || `targetExtra_${String(id).replace(/[^A-Za-z0-9_-]/g, '_')}`;
}
function targetFieldTranslation(id, selector = null) {
  const localized = selector?.i18n?.[state.lang] || t('target.field.' + id);
  if (state.lang === 'en' || !localized) return '';
  return localized;
}
function applyTargetFieldTranslation(element, id, selector = null) {
  if (!element) return;
  element.classList.remove('menu-translation');
  element.removeAttribute('data-translation');
  element.removeAttribute('tabindex');
  applyMenuTranslation(element, targetFieldTranslation(id, selector));
}
function refreshTargetLabels() {
  applyTargetFieldTranslation($('targetSourceLabel'), 'source');
  applyTargetFieldTranslation($('targetBranchLabel'), 'branch');
  document.querySelectorAll('[data-target-field]').forEach((element) => {
    applyTargetFieldTranslation(element, element.dataset.targetField, element.targetSelector);
  });
}
function ensureTargetSelectorControls(schema = DEFAULT_TARGET_SELECTORS) {
  const container = $('targetDynamicSelectors');
  if (!container) return;
  for (const select of container.querySelectorAll('select[data-target-selector]')) {
    targetSelectorValues[select.dataset.targetSelector] = select.value;
  }
  container.textContent = '';
  for (const selector of schema) {
    const label = document.createElement('label');
    const safeId = String(selector.id).replace(/[^A-Za-z0-9_-]/g, '_');
    label.className = `target-field target-${safeId}`;
    if (!['system', 'subtarget', 'profile'].includes(selector.id)) label.classList.add('target-extra');
    const title = document.createElement('span');
    title.textContent = selector.labelEn || selector.id;
    title.dataset.targetField = selector.id;
    title.targetSelector = selector;
    applyTargetFieldTranslation(title, selector.id, selector);
    const select = document.createElement('select');
    select.id = targetControlId(selector.id);
    select.dataset.targetSelector = selector.id;
    label.append(title, select);
    container.appendChild(label);
  }
}
function targetControlElements() {
  return [$('targetSource'), $('targetBranch'),
    ...document.querySelectorAll('#targetDynamicSelectors select')].filter(Boolean);
}
function fallbackTargetTree(catalog) {
  const systems = [];
  for (const target of catalog?.targets || []) {
    let system = systems.find((item) => item.value === target.board);
    if (!system) {
      system = { value: target.board, labelEn: target.systemName || target.board, children: [] };
      systems.push(system);
    }
    system.children.push({
      value: target.subtarget || 'default',
      labelEn: target.subtargetLabel || target.subtargetName || target.subtarget || 'Default',
      targetId: target.id,
      children: (target.profiles || []).filter((profile) => profile.selectable !== false).map((profile) => ({
        value: profile.id, labelEn: profile.name || profile.id, profileId: profile.id,
        selector: profile.selector, aliasesEn: profile.aliases || [],
      })),
    });
  }
  return systems;
}
function renderCatalogTargetSelectors(preferred = {}) {
  const schema = MENU_CATALOG?.targetSelectors?.length
    ? MENU_CATALOG.targetSelectors : DEFAULT_TARGET_SELECTORS;
  ensureTargetSelectorControls(schema);
  let nodes = MENU_CATALOG?.targetTree?.length
    ? MENU_CATALOG.targetTree : fallbackTargetTree(MENU_CATALOG);
  const selectedNodes = new Map();
  const strict = preferred.strictCatalogTarget === true || preferred.initialCatalogTarget === true;
  catalogTargetMismatch = false;
  for (const selector of schema) {
    const selectId = targetControlId(selector.id);
    const preferredValue = selector.id === 'profile'
      ? preferred[`${selector.id}Symbol`] || preferred[selector.id] || targetSelectorValues[selector.id]
      : preferred[selector.id] || preferred[`${selector.id}Symbol`] || targetSelectorValues[selector.id];
    const value = fillTargetSelect(selectId, nodes, (item) => item.value,
      (item) => item.labelEn || item.value,
      preferredValue);
    if (strict && preferredValue && value !== preferredValue) {
      catalogTargetMismatch = true;
      const select = $(selectId);
      if (select) select.value = '';
      targetSelectorValues[selector.id] = '';
      nodes = [];
      continue;
    }
    targetSelectorValues[selector.id] = value;
    const selected = nodes.find((item) => item.value === value);
    if (selected) selectedNodes.set(selector.id, selected);
    nodes = selected?.children || [];
  }
  const system = targetSelectorValues.system || '';
  const subtarget = targetSelectorValues.subtarget || '';
  const targetNode = selectedNodes.get('subtarget');
  const target = (MENU_CATALOG?.targets || []).find((item) =>
    item.id === targetNode?.targetId || (item.board === system && item.subtarget === subtarget));
  const profileId = selectedNodes.get('profile')?.profileId || targetSelectorValues.profile || '';
  const profile = target?.profiles?.find((item) => item.id === profileId) ||
    (!(target?.profiles || []).length ? { id: '', name: 'Default profile', packages: [] } : null);
  return { target, profile, values: { ...targetSelectorValues }, valid: !catalogTargetMismatch };
}

function stableCatalogIndex(index) {
  return CATALOG_ENGINE.orderCatalogIndex(index, PROJECT?.catalogSelectionPolicy || {});
}
function safeCatalogAsset(asset) {
  return CATALOG_LOADER_MODULE.safeCatalogAsset(asset);
}
function catalogBranchFromIndex(index, sourceId, branchName) {
  const source = index?.sources?.find((item) => item.id === sourceId);
  const branch = source?.branches?.find((item) =>
    item.branch === branchName || item.id === branchName);
  return { source, branch };
}
async function fetchCatalogIndex(signal, forceRefresh = false) {
  const remote = await CATALOG_LOADER.fetchIndex({ signal, forceRefresh });
  menuIndexProvider = remote.provider;
  const index = stableCatalogIndex(remote.index);
  index.catalogRepo = MENU_CATALOG_REPO;
  index.loadedFrom = remote.url;
  index.catalogProvider = remote.provider;
  return { data: index, url: remote.url, provider: remote.provider, diagnostics: remote.diagnostics };
}
function catalogPackageSizeMap(document = catalogPackageSizesDocument) {
  const map = new Map();
  for (const row of document?.rows || []) {
    if (!Array.isArray(row) || !/^[A-Za-z0-9][A-Za-z0-9_.+@-]{0,127}$/.test(String(row[0] || ''))) continue;
    const archiveBytes = row[1];
    const installedBytes = row[2] == null ? null : row[2];
    if (!Number.isSafeInteger(archiveBytes) || archiveBytes < 0 ||
        (installedBytes != null && (!Number.isSafeInteger(installedBytes) || installedBytes < 0))) continue;
    map.set(row[0], { archiveBytes, installedBytes });
  }
  return map;
}
function validateCatalogPackageSizes(document, catalog = MENU_CATALOG) {
  const expectedSource = catalog?.source || {};
  if (!document || Number(document.schema) !== 1 || document.kind !== 'package-sizes' ||
      document.encoding !== 'positional-rows-v1' ||
      JSON.stringify(document.fields) !== JSON.stringify(['package', 'archiveBytes', 'installedBytes']) ||
      !Array.isArray(document.rows) || document.source?.id !== expectedSource.id ||
      document.source?.branch !== expectedSource.branch || document.source?.commit !== expectedSource.commit ||
      catalogPackageSizeMap(document).size !== document.rows.length) {
    throw new Error('Catalog package-size shard does not match the active Source / Branch');
  }
  return document;
}
function validateCatalogBranchApplications(catalog) {
  const required = Array.isArray(catalog?.capabilities) &&
    catalog.capabilities.includes('branch-applications-v1');
  const projection = catalog?.applications;
  if (!projection) {
    if (required) throw new Error('Catalog branch application projection is missing');
    return null;
  }
  if (Number(projection.schema) !== 1 || projection.kind !== 'branch-applications' ||
      projection.encoding !== 'positional-rows-v1' ||
      JSON.stringify(projection.fields) !== JSON.stringify(['symbol', 'package', 'group', 'hot']) ||
      !Array.isArray(projection.rows)) {
    throw new Error('Catalog branch application projection has an invalid contract');
  }
  const symbols = new Set();
  const packages = new Set();
  for (const row of projection.rows) {
    const [symbol, packageName, group, hot] = Array.isArray(row) ? row : [];
    if (row?.length !== 4 || symbol !== `PACKAGE_${packageName}` ||
        !/^luci-app-[A-Za-z0-9_.+@-]+$/.test(String(packageName || '')) ||
        !String(group || '').trim() || ![0, 1].includes(hot) ||
        symbols.has(symbol) || packages.has(packageName)) {
      throw new Error('Catalog branch application projection contains an invalid row');
    }
    symbols.add(symbol);
    packages.add(packageName);
  }
  return projection;
}
function catalogApplicationsPluginData(document, catalog = MENU_CATALOG) {
  const metadata = new Map((document?.items || []).map((item) => [item.package, item]));
  const sizes = catalogPackageSizeMap();
  const branchRows = catalog?.applications?.kind === 'branch-applications' &&
    catalog.applications?.encoding === 'positional-rows-v1' &&
    JSON.stringify(catalog.applications?.fields) === JSON.stringify(['symbol', 'package', 'group', 'hot'])
    ? catalog.applications.rows || [] : null;
  if (branchRows) {
    const plugins = branchRows.map(([symbol, packageName, group, hot]) => {
      const item = metadata.get(packageName) || {};
      const observed = sizes.get(packageName);
      return {
        id: packageName.slice('luci-app-'.length),
        pkg: packageName,
        catalogOnly: true,
        catalogCandidates: [packageName],
        group: String(group || 'Applications'),
        hot: hot === 1 || item.hot === true,
        archiveBytes: observed?.archiveBytes ?? null,
        installedBytes: observed?.installedBytes ?? null,
        sizeBytes: observed?.installedBytes ?? observed?.archiveBytes ?? null,
        name: item.titleZh || item.titleEn || packageName,
        desc: item.usageZh || item.usageEn || '',
        nameI18n: { en: item.titleEn || packageName, 'zh-CN': item.titleZh || '', ...(item.titleI18n || {}) },
        descI18n: { en: item.usageEn || '', 'zh-CN': item.usageZh || '', ...(item.usageI18n || {}) },
        symbol,
      };
    });
    const used = new Set(plugins.map((item) => item.group));
    const groups = [...(document?.groups || []).filter((group) => used.has(group))];
    for (const group of [...used].sort((a, b) => a.localeCompare(b))) if (!groups.includes(group)) groups.push(group);
    return { groups, plugins };
  }
  return {
    groups: [...(document?.groups || [])],
    plugins: (document?.items || []).map((item) => ({
      id: item.id,
      pkg: item.package,
      group: item.group,
      hot: item.hot === true,
      sizeBytes: Number.isSafeInteger(item.sizeBytes) ? item.sizeBytes : null,
      name: item.titleZh || item.titleEn || item.id,
      desc: item.usageZh || item.usageEn || '',
      nameI18n: { en: item.titleEn || item.id, 'zh-CN': item.titleZh || '', ...(item.titleI18n || {}) },
      descI18n: { en: item.usageEn || '', 'zh-CN': item.usageZh || '', ...(item.usageI18n || {}) },
    })),
  };
}
function refreshCatalogBranchApplications() {
  if (!MENU_CATALOG?.applications?.rows) return false;
  resetPluginWorkspace(catalogApplicationsPluginData(catalogApplicationsDocument || { groups: [], items: [] }));
  renderGroups();
  updateStats();
  return true;
}
async function ensureCatalogPackageSizes() {
  const key = menuCatalogKey;
  if (!MENU_CATALOG?.splitAssets || !catalogShardLoader || !key) return null;
  if (catalogPackageSizesKey === key && catalogPackageSizesDocument) return catalogPackageSizesDocument;
  if (catalogPackageSizesPromise && catalogPackageSizesPromiseKey === key) return catalogPackageSizesPromise;
  const catalog = MENU_CATALOG;
  const loader = catalogShardLoader;
  const run = (async () => {
    try {
      const document = validateCatalogPackageSizes(await loader('packageSizes'), catalog);
      if (MENU_CATALOG !== catalog || menuCatalogKey !== key) return null;
      catalogPackageSizesDocument = document;
      catalogPackageSizesKey = key;
      refreshCatalogBranchApplications();
      return document;
    } catch (error) {
      console.warn('[Catalog package sizes]', error);
      if (MENU_CATALOG === catalog && menuCatalogKey === key) {
        catalogPackageSizesDocument = null;
        catalogPackageSizesKey = key;
        refreshCatalogBranchApplications();
      }
      return null;
    }
  })();
  const settled = run.finally(() => {
    if (catalogPackageSizesPromise === settled) {
      catalogPackageSizesPromise = null;
      catalogPackageSizesPromiseKey = '';
    }
  });
  catalogPackageSizesPromise = settled;
  catalogPackageSizesPromiseKey = key;
  return settled;
}
async function ensureCatalogApplications(forceRefresh = false) {
  if (catalogApplicationsPromise) return catalogApplicationsPromise;
  if (catalogApplicationsDocument && !forceRefresh) return catalogApplicationsDocument;
  catalogApplicationsLoadState = 'loading';
  catalogApplicationsError = '';
  if (!catalogApplicationsDocument) renderGroups();
  const run = (async () => {
    try {
      const result = await CATALOG_LOADER.fetchApplications({ forceRefresh });
      catalogApplicationsDocument = result.applications;
      catalogApplicationsLoadState = 'ready';
      await ensureCatalogPackageSizes();
      resetPluginWorkspace(catalogApplicationsPluginData(result.applications));
      reconcileCatalogReadyState();
      return result.applications;
    } catch (error) {
      catalogApplicationsLoadState = 'error';
      catalogApplicationsError = String(error?.message || error || 'Catalog applications unavailable').split('\n')[0];
      renderGroups();
      throw error;
    }
  })();
  catalogApplicationsPromise = run.finally(() => { catalogApplicationsPromise = null; });
  return catalogApplicationsPromise;
}
function flushCatalogApplicationsDemand(forceRefresh = false) {
  if (!catalogAutoloadReady || !catalogApplicationsDemanded) return;
  const wait = catalogStartupPromise || Promise.resolve();
  wait.then(() => ensureCatalogApplications(forceRefresh)).catch((error) => {
    console.warn('[Catalog applications demand]', error);
  });
}
function requestCatalogApplications(forceRefresh = false) {
  catalogApplicationsDemanded = true;
  catalogApplicationsObserver?.disconnect();
  catalogApplicationsObserver = null;
  flushCatalogApplicationsDemand(forceRefresh);
}
function initCatalogApplicationsDemand() {
  const step = $('pluginStep');
  if (!step) return;
  const demand = () => requestCatalogApplications(false);
  step.addEventListener('focusin', demand);
  step.addEventListener('pointerdown', demand);
  if (typeof IntersectionObserver === 'function') {
    catalogApplicationsObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) demand();
    }, { rootMargin: '320px 0px' });
    catalogApplicationsObserver.observe(step);
  }
}
async function fetchCatalogBundle(source, branch, signal, forceRefresh = false) {
  const remote = await CATALOG_LOADER.fetchBundle({
    sourceId: source?.id || '',
    branchName: branch?.branch || branch?.id || '',
    signal,
    forceRefresh,
    preferredAssetProvider: menuAssetProvider,
  });
  menuIndexProvider = remote.indexProvider;
  menuAssetProvider = remote.provider === 'cache' ? menuAssetProvider : remote.provider;
  remote.index = stableCatalogIndex(remote.index);
  remote.index.catalogRepo = MENU_CATALOG_REPO;
  remote.index.loadedFrom = remote.url;
  remote.index.catalogProvider = remote.indexProvider;
  return remote;
}
async function refreshMenuIndex() {
  menuIndexAbortController?.abort();
  const abortController = new AbortController();
  menuIndexAbortController = abortController;
  try {
    const previousSourceId = $('targetSource')?.value || '';
    const previousBranchId = $('targetBranch')?.value || '';
    const previousSource = MENU_INDEX?.sources?.find((item) => item.id === previousSourceId);
    const previousBranch = previousSource?.branches?.find((item) => item.id === previousBranchId);
    const previousCatalogContract = previousBranch ? {
      hash: String(previousBranch.hash || previousBranch.sha256 || previousBranch.compressedSha256 || ''),
      bytes: String(previousBranch.bytes || previousBranch.size || previousBranch.compressedBytes || ''),
      commit: String(previousBranch.commit || ''),
    } : null;
    const previousCatalogKey = menuCatalogKey;
    const previousCatalogAsset = previousBranch?.asset || '';
    const localSources = MENU_INDEX?.sources || [];
    const remote = await fetchCatalogIndex(abortController.signal);
    const index = stableCatalogIndex(remote.data);
    if (index.schema >= 2 && Array.isArray(index.sources) && index.sources.length) {
      for (const source of localSources) {
        if (index.sources.some((item) => item.id === source.id)) continue;
        index.sources.push({
          ...source,
          branches: source.branches.map((branch) => ({
            ...branch, state: 'unavailable', errorStage: 'catalog-refresh-required',
          })),
        });
      }
      index.catalogRepo = MENU_CATALOG_REPO;
      index.loadedFrom = remote.url;
      MENU_INDEX = index;
      renderCatalogBuildInfo();
      if (!importingConfig) {
        const activeSource = index.sources.find((item) => item.id === previousSourceId);
        const activeBranch = activeSource?.branches?.find((item) => item.id === previousBranchId);
        const activeCatalogContract = activeBranch ? {
          hash: String(activeBranch.hash || activeBranch.sha256 || activeBranch.compressedSha256 || ''),
          bytes: String(activeBranch.bytes || activeBranch.size || activeBranch.compressedBytes || ''),
          commit: String(activeBranch.commit || ''),
        } : null;
        const sameCatalogContract = previousCatalogContract && activeCatalogContract &&
          ['hash', 'bytes', 'commit'].every((field) =>
            previousCatalogContract[field] === activeCatalogContract[field]);
        const sameCatalog = Boolean(
          MENU_CATALOG && previousCatalogKey && activeBranch &&
          previousCatalogKey === `${activeSource.id}/${activeBranch.branch}` &&
          previousCatalogAsset === (activeBranch.asset || '') && sameCatalogContract,
        );
        if (!sameCatalog) {
          MENU_CATALOG = null;
          menuCatalogKey = '';
        }
        renderDevices();
        renderCatalogLocatorResults();
      }
    }
  } catch (error) {
    if (error?.name !== 'AbortError' && !MENU_INDEX?.sources?.length) {
      setCatalogLoadState('error', error, error?.diagnostics);
    }
  }
  finally {
    if (menuIndexAbortController === abortController) menuIndexAbortController = null;
  }
}
function selectedCatalogSource() {
  return MENU_INDEX?.sources.find((item) => item.id === $('targetSource').value) || MENU_INDEX?.sources[0];
}
function selectedCatalogBranch(source = selectedCatalogSource()) {
  return source?.branches.find((item) => item.id === $('targetBranch').value) || source?.branches[0];
}
function currentCatalogContract() {
  const source = selectedCatalogSource();
  const branch = selectedCatalogBranch(source);
  const revision = String(MENU_INDEX?.assetRef || '').trim().toLowerCase();
  const legacy = CATALOG_LOADER_MODULE.legacyCatalogContract(branch);
  const sourceRepository = String(source?.repo || '').trim();
  const sourceCommit = String(branch?.commit || '').trim().toLowerCase();
  if (!source || !branch || !legacy || !/^[0-9a-f]{40}$/.test(revision) ||
      !/^[0-9a-f]{64}$/.test(legacy.hash) || !Number.isSafeInteger(legacy.bytes) || legacy.bytes <= 0 ||
      legacy.catalogSchema < 5 || legacy.relationsSchema < 2 ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(sourceRepository) ||
      !/^[0-9a-f]{40}$/.test(sourceCommit)) {
    throw new Error(t('runtime.0a29b33bdc96'));
  }
  return {
    repository: String(MENU_INDEX.catalogRepo || MENU_CATALOG_REPO),
    revision,
    asset: legacy.asset,
    compressedSha256: legacy.hash,
    compressedBytes: legacy.bytes,
    catalogSchema: legacy.catalogSchema,
    relationsSchema: legacy.relationsSchema,
    sourceRepository,
    sourceCommit,
  };
}
function catalogBranchLabel(branch) {
  if (branch.state === 'stale') return `⚠ ${branch.branch} · stale`;
  if (branch.state === 'unavailable') return `✕ ${branch.branch} · unavailable`;
  return branch.branch;
}
function showCatalogStatus(branch, catalog = MENU_CATALOG) {
  const status = $('menuconfigStatus');
  const stateName = branch?.state || (catalog?.source?.commit === 'local-demo' ? 'fallback' : 'fresh');
  status.className = `hint catalog-${stateName}`;
  bindUiTooltipContent(status, { body: branch?.runUrl || '' });
  if (stateName === 'unavailable') {
    status.textContent = t('catalog.branchUnavailable', {
      stage: branch.errorStage || t('catalog.unknown'),
    });
  } else if (stateName === 'stale') {
    status.textContent = t('catalog.branchStale', {
      success: branch.lastSuccessAt || t('catalog.unknown'),
      stage: branch.errorStage || t('catalog.unknown'),
    });
  } else {
    const count = catalog?.counts?.menuOptions || catalog?.menu?.options?.length || 0;
    status.textContent = t(
      stateName === 'fallback' ? 'catalog.branchFallback' : 'catalog.branchFresh',
      {
        count,
        commit: catalog?.source?.commit ? ` · ${catalog.source.commit.slice(0, 8)}` : '',
      },
    );
  }
}
const menuPathKey = (path) => path.join('\u0001');
function menuLabelMeta(name) {
  return MENU_CATALOG?.menu?.labels?.[name] || { en: name, zhCN: '' };
}
function menuPathLabel(name) {
  const row = menuLabelMeta(name);
  return displayText(String(row.en || name || '').trim());
}
function menuOptionLabel(option) {
  const prompt = String(option.promptEn || option.prompt || '').trim();
  if (prompt) return displayText(prompt);
  return displayText(String(option.symbol || '').replace(/^PACKAGE_/, '').replaceAll('_', ' ').trim());
}
function menuOptionTranslation(option) {
  if (option.symbol?.startsWith('PACKAGE_') && PLUGINS?.plugins && state.source) {
    const packageName = option.symbol.slice(8);
    const plugin = PLUGINS.plugins.find((item) =>
      (item.pkgs?.[state.source.id] || item.pkg) === packageName);
    if (plugin) {
      const desc = state.lang === 'en' ? '' : plugin.descI18n?.[state.lang] || '';
      const title = state.lang === 'en' ? '' : plugin.nameI18n?.[state.lang] || '';
      return { title, usage: desc };
    }
  }
  return {
    title: option.promptI18n?.[state.lang] || (state.lang === 'zh-CN' ? option.promptZh : ''),
    usage: option.usageI18n?.[state.lang] || (state.lang === 'zh-CN' ? option.usageZh : ''),
  };
}
function applyMenuTranslation(element, chinese, usageChinese = '', mobileChip = false) {
  const lines = [displayText(String(chinese || '').trim()), displayText(String(usageChinese || '').trim())].filter(Boolean);
  if (element?.dataset.uiTooltipSource === 'translation') {
    bindUiTooltipContent(element);
    delete element.dataset.uiTooltipSource;
  }
  if (state.lang === 'en' || !lines.length) return element;
  element.classList.add('menu-translation');
  element.dataset.translation = lines.join('\n');
  bindUiTooltipContent(element, { body: element.dataset.translation });
  element.dataset.uiTooltipSource = 'translation';
  if (!element.hasAttribute('tabindex')) element.tabIndex = 0;
  if (mobileChip) {
    const chip = document.createElement('span');
    chip.className = 'menu-translation-chip';
    chip.textContent = isZh() ? '译' : 'Tr';
    chip.setAttribute('aria-label', isZh() ? '显示译文' : 'Show translation');
    element.appendChild(chip);
  }
  return element;
}
function menuOptionPopupText(element) {
  if (!element?.dataset.symbol) return '';
  const description = [...new Set([
    element.dataset.translation || '',
    element.dataset.english || '',
  ].filter(Boolean))];
  return [
    displayConfigSymbol(element.dataset.symbol),
    description.length ? displayText(description.join('\n')) : '',
    displayText(element.dataset.path || ''),
  ].filter(Boolean).join('\n\n');
}
function bindMenuOptionTooltip(element) {
  const text = menuOptionPopupText(element);
  if (!text) return element;
  bindUiTooltipContent(element, { body: text });
  element.dataset.uiTooltipSource = 'menu-option';
  return element;
}
function hideMenuTooltip(force = false) {
  hideUiTooltip(force);
}
function classifyCatalogLoadFailure(errorText = '', diagnostics = [], online = true) {
  const failedRows = (Array.isArray(diagnostics) ? diagnostics : []).filter((row) => row?.ok === false);
  const combined = [
    String(errorText || ''),
    ...failedRows.map((row) => `${row.stage || ''} ${row.provider || ''} ${row.detail || ''}`),
  ].join('\n');
  if (!online) return { kind: 'offline', showGithubStatus: false };
  if (/SHA-256|byte length mismatch|schema|does not match|commit mismatch|provenance|decompress|gzip|JSON/i.test(combined)) {
    return { kind: 'validation', showGithubStatus: false };
  }
  if (/\bHTTP 429\b/i.test(combined)) return { kind: 'rate-limit', showGithubStatus: true };
  if (/\bHTTP 5\d\d\b/i.test(combined)) return { kind: 'remote-service', showGithubStatus: true };
  const remoteProviders = new Set(['jsdelivr', 'github-raw', 'github-api', 'github-release']);
  const remoteFailures = failedRows.filter((row) => remoteProviders.has(String(row.provider || '')));
  if ((remoteFailures.length && remoteFailures.every((row) => /Failed to fetch|NetworkError|Load failed/i.test(String(row.detail || '')))) ||
      (!remoteFailures.length && /Failed to fetch|NetworkError|Load failed/i.test(combined))) {
    return { kind: 'unreachable', showGithubStatus: true };
  }
  if (/\bHTTP 404\b/i.test(combined)) return { kind: 'snapshot-missing', showGithubStatus: false };
  return { kind: 'unknown', showGithubStatus: true };
}
function catalogLoadFailureCopy(kind) {
  const messages = {
    offline: {
      title: t('runtime.a897f335ecc8'),
      body: t('runtime.df4815f3871c'),
    },
    validation: {
      title: t('runtime.479cba9124b9'),
      body: t('runtime.d188555b8dd0'),
    },
    'rate-limit': {
      title: t('runtime.bbd1b0122958'),
      body: t('runtime.6cbaff8fadde'),
    },
    'remote-service': {
      title: t('runtime.a652fe976b30'),
      body: t('runtime.e528800ad20d'),
    },
    unreachable: {
      title: t('runtime.c6ba041f230c'),
      body: t('runtime.e39eee47e0f4'),
    },
    'snapshot-missing': {
      title: t('runtime.88f1795909bf'),
      body: t('runtime.f937d77f2827'),
    },
    unknown: {
      title: t('runtime.33ae414fcb5a'),
      body: t('runtime.22fa3306cce9'),
    },
  };
  return messages[kind] || messages.unknown;
}
function catalogDiagnosticsText() {
  const source = selectedCatalogSource();
  const branch = selectedCatalogBranch(source);
  const detail = CATALOG_LOADER_MODULE?.formatCatalogDiagnostics(catalogLoadDiagnostics) || '';
  const failure = classifyCatalogLoadFailure(catalogLoadError, catalogLoadDiagnostics, navigator.onLine);
  const summary = catalogLoadFailureCopy(failure.kind);
  return [
    `Catalog repository: ${MENU_CATALOG_REPO}`,
    `Selection: ${source?.id || '(unknown)'}/${branch?.branch || branch?.id || '(unknown)'}`,
    `Page: ${location.href}`,
    `Online: ${navigator.onLine}`,
    `Browser gzip: ${typeof DecompressionStream === 'function'}`,
    `Cache API: ${Boolean(globalThis.caches?.open)}`,
    `Reason: ${failure.kind} - ${summary.title}`,
    `Error: ${catalogLoadError || '(unknown)'}`,
    detail,
  ].filter(Boolean).join('\n');
}
function renderCatalogLoadState() {
  const box = $('catalogLoadState');
  if (!box) return;
  const failed = catalogLoadMode === 'error';
  const failure = classifyCatalogLoadFailure(catalogLoadError, catalogLoadDiagnostics, navigator.onLine);
  const summary = catalogLoadFailureCopy(failure.kind);
  box.hidden = catalogLoadMode === 'idle';
  box.disabled = !failed;
  box.dataset.state = catalogLoadMode;
  bindUiTooltipContent(box, { body: failed ? catalogLoadError : '' });
  $('targetPicker')?.setAttribute('aria-busy', String(catalogLoadMode === 'loading'));
  if ($('catalogLoadText')) {
    $('catalogLoadText').textContent = failed
      ? `${summary.title}${t('runtime.9160be1613e8')}`
      : t('runtime.41f2d99053de');
  }
  const details = $('catalogLoadDetails');
  if (details) details.hidden = !failed;
  if ($('catalogLoadReasonTitle')) $('catalogLoadReasonTitle').textContent = failed ? summary.title : '';
  if ($('catalogLoadReasonText')) $('catalogLoadReasonText').textContent = failed ? summary.body : '';
  if ($('catalogStatusLink')) {
    $('catalogStatusLink').hidden = !failed || !failure.showGithubStatus;
    $('catalogStatusLink').textContent = t('runtime.f75d3e10f634');
  }
  if ($('catalogLoadDiagnostics')) $('catalogLoadDiagnostics').textContent = failed ? catalogDiagnosticsText() : '';
  if ($('catalogCopyDiagnostics')) {
    $('catalogCopyDiagnostics').textContent = t('runtime.5d74f46a65de');
  }
}
function setCatalogLoadState(mode, error = '', diagnostics = []) {
  catalogLoadMode = mode;
  catalogLoadError = String(error?.message || error || '');
  catalogLoadDiagnostics = Array.isArray(diagnostics) ? [...diagnostics] : [];
  if (mode !== 'idle') {
    $('targetDynamicSelectors').textContent = '';
    $('menuconfigBox').hidden = true;
  }
  renderCatalogLoadState();
  renderCatalogLocatorResults();
  updateSubmitGate();
}
async function copyCatalogDiagnostics() {
  const text = catalogDiagnosticsText();
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    const button = $('catalogCopyDiagnostics');
    if (button) {
      button.textContent = t('runtime.e6979d9a3242');
      setTimeout(() => renderCatalogLoadState(), 1200);
    }
  } catch (error) {
    console.error('[Catalog diagnostics copy failed]', error);
  }
}
async function retryCatalogLoad() {
  if (catalogLoadMode !== 'error') return;
  const source = selectedCatalogSource();
  const branch = selectedCatalogBranch(source);
  if (!source || !branch) return;
  menuIndexAbortController?.abort();
  menuCatalogAbortController?.abort();
  await CATALOG_LOADER.clearCache();
  menuIndexProvider = '';
  menuAssetProvider = '';
  MENU_CATALOG = null;
  CATALOG_MODEL = null;
  menuCatalogKey = '';
  menuLoadingKey = '';
  loadCatalog(source, branch, true, null, { forceRefresh: true }).catch(() => {});
}
function addMenuIndex(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}
function markCatalogStateChanged() {
  catalogStateRevision++;
  UI_SESSION.compatibility.clearAcknowledgement();
  clearCatalogDerivedCaches();
}
function clearCatalogDerivedCaches() {
  catalogContextCache.clear();
  menuVisibilityRevision = -1;
  menuVisibilityCache.clear();
  menuSelectableStatesCache.clear();
  menuStateConstraintsCache.clear();
}
function indexSearchText(option, text) {
  menuSearchText.set(option.symbol, String(text || '').toLowerCase());
}
function catalogSearchText(option) {
  const symbol = String(option?.symbol || '');
  const packageName = symbol.startsWith('PACKAGE_') ? symbol.slice(8) : '';
  const splitName = (value) => String(value || '').replace(/[_-]+/g, ' ');
  const names = [
    symbol, splitName(symbol),
    symbol ? `CONFIG_${symbol}` : '', symbol ? splitName(`CONFIG_${symbol}`) : '',
    packageName, splitName(packageName),
    option?.prompt || '', option?.promptEn || '', option?.promptZh || '',
    ...Object.values(option?.promptI18n || {}),
    ...(option?.path || []),
  ];
  return [...new Set(names.map((value) => String(value || '').trim()).filter(Boolean))].join(' ').toLowerCase();
}
function rebuildMenuSearchIndex() {
  menuSearchText = new Map();
  for (const option of menuSearchOptions) indexSearchText(option, catalogSearchText(option));
}
function stopCatalogSearchWorker() {
  catalogSearchWorker?.terminate?.();
  catalogSearchWorker = null;
  catalogSearchWorkerReady = false;
  catalogSearchPending.clear();
  catalogSearchResults.clear();
  catalogSearchRequests.clear();
}
function startCatalogSearchWorker() {
  stopCatalogSearchWorker();
  if (!globalThis.Worker || !menuSearchText.size) return;
  const generation = ++catalogSearchGeneration;
  try {
    catalogSearchWorker = new Worker(releaseAssetUrl('./lib/catalog-search-worker.js'));
  } catch (error) {
    console.warn('[Catalog search worker unavailable]', error);
    catalogSearchWorker = null;
    return;
  }
  catalogSearchWorker.onmessage = (event) => {
    const message = event.data || {};
    if (message.generation !== generation || generation !== catalogSearchGeneration) return;
    if (message.type === 'ready') {
      catalogSearchWorkerReady = true;
      const query = normalizeMenuSearchQuery($('menuconfigSearch')?.value);
      if (query.length >= 2) requestCatalogSearch(query);
      return;
    }
    if (message.type !== 'result') return;
    const query = normalizeMenuSearchQuery(message.query);
    if (catalogSearchRequests.get(query) !== message.requestId) return;
    catalogSearchPending.delete(query);
    catalogSearchRequests.delete(query);
    catalogSearchResults.set(query, message.symbols || []);
    while (catalogSearchResults.size > 24) catalogSearchResults.delete(catalogSearchResults.keys().next().value);
    if (normalizeMenuSearchQuery($('menuconfigSearch')?.value) === query) renderMenuconfig();
  };
  catalogSearchWorker.onerror = (error) => {
    console.warn('[Catalog search worker failed]', error.message || error);
    stopCatalogSearchWorker();
    if (menuExpanded) renderMenuconfig();
  };
  catalogSearchWorker.postMessage({
    type: 'init', generation,
    rows: [...menuSearchText.entries()],
  });
}
function requestCatalogSearch(query) {
  const normalized = normalizeMenuSearchQuery(query);
  if (!catalogSearchWorkerReady || normalized.length < 2 || catalogSearchPending.has(normalized) ||
      catalogSearchResults.has(normalized)) return;
  const requestId = ++catalogSearchRequestId;
  catalogSearchPending.add(normalized);
  catalogSearchRequests.set(normalized, requestId);
  catalogSearchWorker.postMessage({
    type: 'query', generation: catalogSearchGeneration,
    requestId, query: normalized,
  });
}
function normalizeMenuSearchQuery(value) {
  return String(value || '').trim().toLowerCase().replace(/^config_/, '');
}
function normalizeMenuSearchIdentity(value) {
  return normalizeMenuSearchQuery(value)
    .replace(/^config_/, '')
    .replace(/^package_/, '');
}
function menuSearchPathRank(option) {
  const path = Array.isArray(option?.path) ? option.path.map((item) => String(item || '').trim()) : [];
  const luciIndex = path.findIndex((item) => /^luci$/i.test(item));
  if (luciIndex < 0) return { luci: false, numbered: false, number: Number.POSITIVE_INFINITY };
  for (const item of path.slice(luciIndex + 1)) {
    const match = item.match(/^\s*(\d+)\s*[.)-]?\s*/);
    if (match) return { luci: true, numbered: true, number: Number(match[1]) };
  }
  return { luci: true, numbered: false, number: Number.POSITIVE_INFINITY };
}
function menuSearchRank(option, query) {
  const normalized = normalizeMenuSearchIdentity(query);
  const symbol = String(option?.symbol || '').toLowerCase();
  const packageName = symbol.startsWith('package_') ? symbol.slice('package_'.length) : '';
  const shortPackage = packageName.startsWith('luci-app-')
    ? packageName.slice('luci-app-'.length)
    : packageName;
  const fullIdentities = [symbol, packageName].filter(Boolean);
  const aliases = [shortPackage].filter((value) => value && !fullIdentities.includes(value));
  const exact = Boolean(normalized) && fullIdentities.some((value) => value === normalized);
  const prefix = Boolean(normalized) && fullIdentities.some((value) => value.startsWith(normalized));
  const aliasExact = Boolean(normalized) && aliases.some((value) => value === normalized);
  const match = exact ? 0 : prefix ? 1 : aliasExact ? 2 : 3;
  const pathRank = menuSearchPathRank(option);
  let group;
  if (normalized === 'luci') {
    if (packageName === 'luci') group = 0;
    else if (packageName.startsWith('luci-') && !packageName.startsWith('luci-app-') && !pathRank.numbered) group = 1;
    else if (pathRank.numbered) group = 10 + Math.min(pathRank.number, 80);
    else if (pathRank.luci) group = 100;
    else group = 200;
  } else {
    group = packageName.startsWith('luci-app-') ? 0 : packageName && exact ? 1 : packageName ? 2 : 3;
  }
  return group * 10 + match;
}
function rankMenuSearchOptions(options, query) {
  return [...options].sort((left, right) => {
    const rank = menuSearchRank(left, query) - menuSearchRank(right, query);
    if (rank) return rank;
    return String(left?.symbol || '').localeCompare(String(right?.symbol || ''), 'en', {
      numeric: true, sensitivity: 'base',
    });
  });
}
function searchMenuOptionsSync(query) {
  const normalized = normalizeMenuSearchQuery(query);
  if (normalized.length < 2) return [];
  return rankMenuSearchOptions(
    menuSearchOptions.filter((option) => menuSearchText.get(option.symbol)?.includes(normalized)),
    normalized,
  );
}
function searchMenuOptions(query) {
  const normalized = normalizeMenuSearchQuery(query);
  if (normalized.length < 2) return [];
  if (catalogSearchWorker) {
    requestCatalogSearch(normalized);
    const symbols = catalogSearchResults.get(normalized);
    return symbols
      ? rankMenuSearchOptions(symbols.map((symbol) => menuOptionBySymbol.get(symbol)).filter(Boolean), normalized)
      : null;
  }
  return searchMenuOptionsSync(normalized);
}
function setMenuconfigSearchBusy(busy) {
  const input = $('menuconfigSearch');
  const group = input?.closest('.menuconfig-search-group');
  const active = Boolean(busy);
  input?.setAttribute('aria-busy', String(active));
  group?.classList.toggle('is-searching', active);
}
function currentMenuPageSize() {
  return normalizeMenuSearchQuery($('menuconfigSearch')?.value).length >= 2
    ? MENU_SEARCH_PAGE_SIZE : MENU_PAGE_SIZE;
}
async function ensureCatalogMenuLoaded(includeHidden = false) {
  if (!MENU_CATALOG?.splitAssets) return true;
  if (!MENU_CATALOG.menu?.displayLoaded) {
    if (!catalogMenuLoadingPromise) {
      const catalog = MENU_CATALOG;
      const model = CATALOG_MODEL;
      const loader = catalogShardLoader;
      const catalogKey = menuCatalogKey;
      const task = (async () => {
        const language = state.lang;
        const [menuShard, languageShard] = await Promise.all([
          loader?.('menu'),
          language !== 'en' ? loader?.(`menu:${language}`) : Promise.resolve(null),
        ]);
        if (!menuShard) throw new Error('Catalog menu shard is unavailable');
        if (MENU_CATALOG !== catalog || CATALOG_MODEL !== model || menuCatalogKey !== catalogKey) return false;
        CATALOG_SCHEMA6_MODULE.mergeMenuShards(catalog, model, menuShard, null);
        if (languageShard) CATALOG_SCHEMA6_MODULE.applyMenuLanguageShard(catalog, languageShard);
        buildMenuIndexes(catalog);
        catalogLocatorEntryCache = null;
        renderCatalogLocatorResults();
        reconcileCatalogReadyState();
        return true;
      })();
      catalogMenuLoadingPromise = task;
      task.finally(() => {
        if (catalogMenuLoadingPromise === task) catalogMenuLoadingPromise = null;
      }).catch(() => {});
    }
    await catalogMenuLoadingPromise;
  } else if (state.lang !== 'en') {
    await ensureCatalogMenuLanguage(state.lang);
  }
  if (includeHidden) await ensureCatalogHiddenLoaded();
  return true;
}
async function ensureCatalogHiddenLoaded() {
  if (!MENU_CATALOG?.splitAssets || MENU_CATALOG.menu?.hiddenLoaded) return true;
  if (!catalogHiddenLoadingPromise) {
    const catalog = MENU_CATALOG;
    const model = CATALOG_MODEL;
    const loader = catalogShardLoader;
    const catalogKey = menuCatalogKey;
    const task = (async () => {
      const shard = await loader?.('hidden');
      if (!shard || MENU_CATALOG !== catalog || CATALOG_MODEL !== model || menuCatalogKey !== catalogKey) return false;
      CATALOG_SCHEMA6_MODULE.mergeHiddenShard(catalog, model, shard);
      buildMenuIndexes(catalog);
      // Hidden PACKAGE_* records can arrive after the visible-menu baseline snapshot.
      // Backfill their upstream baseline from the baseline context, never from current user state.
      backfillCatalogBaselineForLoadedOptions();
      catalogLocatorEntryCache = null;
      return true;
    })();
    catalogHiddenLoadingPromise = task;
    task.finally(() => {
      if (catalogHiddenLoadingPromise === task) catalogHiddenLoadingPromise = null;
    }).catch(() => {});
  }
  return catalogHiddenLoadingPromise;
}
async function ensureCatalogHelpLoaded() {
  if (!MENU_CATALOG?.splitAssets || MENU_CATALOG.menu?.helpLoaded) return true;
  if (!catalogHelpLoadingPromise) {
    const catalog = MENU_CATALOG;
    const loader = catalogShardLoader;
    const catalogKey = menuCatalogKey;
    const task = (async () => {
      const shard = await loader?.('help');
      if (!shard || MENU_CATALOG !== catalog || menuCatalogKey !== catalogKey) return false;
      CATALOG_SCHEMA6_MODULE.applyHelpShard(catalog, shard);
      return true;
    })();
    catalogHelpLoadingPromise = task;
    task.finally(() => {
      if (catalogHelpLoadingPromise === task) catalogHelpLoadingPromise = null;
    }).catch(() => {});
  }
  return catalogHelpLoadingPromise;
}

async function ensurePackageMirrors() {
  if ((PACKAGE_MIRRORS?.presets || []).length > 1) return PACKAGE_MIRRORS;
  if (!packageMirrorsPromise) {
    packageMirrorsPromise = loadJson('package-mirrors.json').then((document) => {
      PACKAGE_MIRRORS = document;
      renderFirmwareSettings();
      return document;
    }).finally(() => { packageMirrorsPromise = null; });
  }
  return packageMirrorsPromise;
}
async function ensureCatalogMenuLanguage(language) {
  if (!MENU_CATALOG?.splitAssets || language === 'en' || MENU_CATALOG.menu?.loadedLanguages?.includes(language)) return true;
  const catalog = MENU_CATALOG;
  const loader = catalogShardLoader;
  const catalogKey = menuCatalogKey;
  const shard = await loader?.(`menu:${language}`);
  if (!shard || MENU_CATALOG !== catalog || menuCatalogKey !== catalogKey) return false;
  CATALOG_SCHEMA6_MODULE.applyMenuLanguageShard(catalog, shard);
  if (catalog.menu?.displayLoaded) buildMenuIndexes(catalog);
  catalogLocatorEntryCache = null;
  return true;
}
function relationMenuOption(record) {
  const expressions = record.kconfig || {};
  return {
    symbol: record.configSymbol,
    kind: 'config',
    type: record.type || (record.states?.includes('m') ? 'tristate' : 'bool'),
    prompt: record.title || record.prompt || record.package,
    promptEn: record.title || record.prompt || record.package,
    promptZh: '',
    promptI18n: {},
    usageEn: record.description || '',
    usageZh: '',
    usageI18n: {},
    help: record.description || '',
    path: record.path || [],
    parent: record.parent || '',
    choice: record.choice || '',
    defaults: record.defaults || [],
    depends: expressions.dependsExpressions?.[0] || [],
    dependsVariants: expressions.dependsExpressions || [[]],
    selects: expressions.selectsExpressions?.flat?.() || [],
    selectsVariants: expressions.selectsExpressions || [],
    implies: expressions.impliesExpressions?.flat?.() || [],
    impliesVariants: expressions.impliesExpressions || [],
    conflicts: (record.conflicts || []).map((name) => `PACKAGE_${name}`),
    hidden: true,
    visible: false,
    userSettable: false,
    canDisable: record.canDisable !== false,
    origin: record.origin || 'relations',
  };
}
function catalogTargetSymbolSet(catalog) {
  const symbols = new Set(['TARGET_BOARD', 'TARGET_SUBTARGET', 'TARGET_PROFILE']);
  for (const target of catalog.targets || []) {
    const targetSelector = target.targetSelector || target.contract?.targetSelector ||
      `TARGET_${target.board}${target.subtarget ? `_${target.subtarget}` : ''}`;
    symbols.add(targetSelector);
    for (const profile of target.profiles || []) {
      symbols.add(profile.selector || profile.profileSelector || `${targetSelector}_${profile.id}`);
      if (profile.targetSelector) symbols.add(profile.targetSelector);
    }
  }
  return symbols;
}
function buildMenuStartupIndexes(catalog) {
  menuTargetSymbols = catalogTargetSymbolSet(catalog);
  menuSearchOptions = (catalog.menu?.options || []).filter((option) =>
    option?.symbol && !menuTargetSymbols.has(option.symbol));
  menuOptionBySymbol = new Map(menuSearchOptions.map((option) => [option.symbol, option]));
  menuChoiceOptions = new Map();
  for (const option of menuSearchOptions) {
    if (option.choice) addMenuIndex(menuChoiceOptions, option.choice, option);
  }
  menuExactPaths = new Map();
  menuChildPaths = new Map();
  menuDescendants = new Map();
  menuChildrenByParent = new Map();
  menuNestedCounts = new Map();
  menuSearchText = new Map();
  catalogLocatorEntryCache = null;
  stopCatalogSearchWorker();
}
function buildMenuIndexes(catalog) {
  menuTargetSymbols = catalogTargetSymbolSet(catalog);
  const menuDisplayOptions = catalog.menu.displayOptions || catalog.menu.options || [];
  const options = menuDisplayOptions.filter((option) =>
    option.hidden !== true && option.path?.[0] !== 'Target Devices' && !menuTargetSymbols.has(option.symbol));
  for (const option of options) {
    option.depends = (option.depends || []).filter((expression) =>
      !(/\s/.test(expression) && !/[&|=!<>]/.test(expression)));
    option.visible = true;
    option.hidden = false;
    option.userSettable = true;
  }
  const visibleSymbols = new Set(options.map((option) => option.symbol));
  const displayBySymbol = new Map(menuDisplayOptions.map((option) => [option.symbol, option]));
  const hiddenOptions = (CATALOG_MODEL?.records || [])
    .filter((record) => record.hidden && record.configSymbol &&
      !menuTargetSymbols.has(record.configSymbol) && !visibleSymbols.has(record.configSymbol))
    .map((record) => ({ ...relationMenuOption(record), ...(displayBySymbol.get(record.configSymbol) || {}) }));
  const choiceIds = new Set(options.map((option) => option.choice).filter(Boolean));
  catalog.menu = {
    ...catalog.menu,
    categories: (catalog.menu.categories || []).filter((name) => name !== 'Target Devices'),
    options,
    choices: (catalog.menu.choices || []).filter((choice) => choiceIds.has(choice.id)),
  };
  if (catalog.counts) catalog.counts.menuOptions = options.length;
  menuSearchOptions = [...options, ...hiddenOptions];
  menuOptionBySymbol = new Map();
  menuExactPaths = new Map();
  menuChildPaths = new Map();
  menuDescendants = new Map();
  menuChoiceOptions = new Map();
  menuChildrenByParent = new Map();
  menuNestedCounts = new Map();
  menuSearchText = new Map();
  catalogLocatorEntryCache = null;
  for (const option of menuSearchOptions) {
    menuOptionBySymbol.set(option.symbol, option);
    if (option.hidden) continue;
    const path = option.path || [];
    addMenuIndex(menuExactPaths, menuPathKey(path), option);
    for (let depth = 0; depth <= path.length; depth++) {
      const parent = path.slice(0, depth);
      addMenuIndex(menuDescendants, menuPathKey(parent), option);
      if (depth < path.length) {
        const key = menuPathKey(parent);
        if (!menuChildPaths.has(key)) menuChildPaths.set(key, new Set());
        menuChildPaths.get(key).add(path[depth]);
      }
    }
    if (option.choice) addMenuIndex(menuChoiceOptions, option.choice, option);
  }
  for (const option of options) {
    if (option.parent && (!menuOptionBySymbol.has(option.parent) ||
        menuOptionBySymbol.get(option.parent).kind !== 'menuconfig')) {
      option.parent = '';
    }
    if (option.parent) addMenuIndex(menuChildrenByParent, option.parent, option);
  }
  for (const option of options) {
    let parent = option.parent;
    const seenParents = new Set();
    while (parent && !seenParents.has(parent)) {
      seenParents.add(parent);
      menuNestedCounts.set(parent, (menuNestedCounts.get(parent) || 0) + 1);
      parent = menuOptionBySymbol.get(parent)?.parent || '';
    }
  }
  rebuildMenuSearchIndex();
  if (catalog.menu?.displayLoaded || menuExpanded) startCatalogSearchWorker();
  else stopCatalogSearchWorker();
}
async function ensureProfileBaselineModule() {
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

async function loadCatalog(source, branch, applyDefault = true, requested = null, options = {}) {
  if (!source || !branch) return null;
  const key = `${source.id}/${branch.branch}`;
  if (!options.forceRefresh && menuCatalogKey === key && MENU_CATALOG) return MENU_CATALOG;
  if (!options.forceRefresh && menuLoadingKey === key && menuCatalogPromise) return menuCatalogPromise;
  menuCatalogAbortController?.abort();
  const abortController = new AbortController();
  menuCatalogAbortController = abortController;
  menuLoadingKey = key;
  const seq = ++menuCatalogSeq;
  setCatalogLoadState('loading');
  $('menuconfigStatus').className = 'hint';
  $('menuconfigStatus').textContent = t('catalog.loading');
  menuCatalogPromise = (async () => {
    const remote = await fetchCatalogBundle(
      source, branch, abortController.signal, options.forceRefresh === true,
    );
    const catalog = remote.data;
    catalog.loadedFrom = remote.url;
    validateCatalogBranchApplications(catalog);
    if (seq !== menuCatalogSeq || abortController.signal.aborted) return null;
    MENU_INDEX = remote.index;
    renderCatalogBuildInfo();
    const active = catalogBranchFromIndex(remote.index, source.id, branch.branch);
    const activeSource = active.source || source;
    const activeBranch = active.branch || branch;
    CATALOG_MODEL = remote.model;
    catalogShardLoader = remote.loadShard || null;
    PROFILE_BASELINE_STORE = null;
    ACTIVE_PROFILE_BASELINE = null;
    profileBaselineKey = "";
    await ensureCatalogProfileBaselines(activeSource, activeBranch);
    if (catalog.splitAssets) catalog.menu = CATALOG_SCHEMA6_MODULE.createRuntimeMenu(CATALOG_MODEL);
    MENU_CATALOG = catalog;
    menuCatalogKey = key;
    catalogPackageSizesDocument = null;
    catalogPackageSizesKey = '';
    if (catalog.splitAssets) buildMenuStartupIndexes(catalog);
    else buildMenuIndexes(catalog);
    resetCatalogSelectionLayers();
    refreshCatalogBranchApplications();
    menuImportedOriginal.clear();
    menuImportedNonDefault.clear();
    resetMenuNavigation();
    menuVisibleLimit = MENU_PAGE_SIZE;
    renderCatalogPicker(false, requested || { sourceId: activeSource.id, branchId: activeBranch.id });
    if (applyDefault) {
      // Target/Profile must exist before target-sensitive defaults are evaluated.
      // Target/Profile 必须先建立，之后才能计算依赖 TARGET_* 的主题与最低启动预设。
      await applyCatalogTarget();
    }
    ensureCatalogMenuLoaded(false).catch((error) => console.warn('[Catalog menu prefetch]', error));
    if (catalogApplicationsDocument) ensureCatalogPackageSizes();
    scheduleCatalogIdlePrefetch();
    return catalog;
  })().catch((error) => {
    if (seq !== menuCatalogSeq) return null;
    MENU_CATALOG = null;
    CATALOG_MODEL = null;
    catalogShardLoader = null;
    menuCatalogKey = '';
    const diagnostics = Array.isArray(error?.diagnostics) ? error.diagnostics : [];
    setCatalogLoadState('error', error, diagnostics);
    console.error('[Catalog load failed]', {
      message: error?.message || String(error),
      diagnostics,
    });
    throw error;
  }).finally(() => {
    if (seq === menuCatalogSeq) {
      menuLoadingKey = '';
      menuCatalogPromise = null;
      menuCatalogAbortController = null;
    }
  });
  return menuCatalogPromise;
}
function isCatalogTargetSymbol(symbol, catalog = MENU_CATALOG) {
  if (menuTargetSymbols.has(symbol)) return true;
  if (/^TARGET_(?:BOARD|SUBTARGET|PROFILE|ARCH_PACKAGES)$/.test(symbol)) return true;
  return !menuTargetSymbols.size && (catalog?.targets || []).some((target) =>
    symbol === `TARGET_${target.board}` || symbol === `TARGET_${target.board}_${target.subtarget}`);
}
function renderCatalogPicker(preferState = true, requested = null) {
  if (!MENU_INDEX?.sources?.length) return null;
  const targetRequest = requested;
  const currentSource = CATALOG_ENGINE.preferredCatalogSource(MENU_INDEX.sources, [
    targetRequest?.sourceId,
    $('targetSource')?.value,
    state.device?.id === 'catalog-target' ? state.source?.id : '',
    PROJECT?.catalogSelectionPolicy?.defaultSource,
  ]);
  const sourceId = fillTargetSelect('targetSource', MENU_INDEX.sources,
    (item) => item.id, (item) => item.label || item.id, currentSource);
  const source = MENU_INDEX.sources.find((item) => item.id === sourceId);
  const currentBranch = targetRequest?.branchId ||
    (preferState && state.device?.id === 'catalog-target' ? state.version?.id : '');
  let branchId = fillTargetSelect('targetBranch', source.branches,
    (item) => item.id, catalogBranchLabel, currentBranch);
  const branchSelect = $('targetBranch');
  for (const option of branchSelect.options) {
    const item = source.branches.find((candidate) => candidate.id === option.value);
    option.disabled = item?.state === 'unavailable';
  }
  if (branchSelect.selectedOptions[0]?.disabled) {
    const available = source.branches.find((item) => item.state !== 'unavailable');
    if (available) branchSelect.value = available.id;
    branchId = branchSelect.value;
  }
  const branch = source.branches.find((item) => item.id === branchId);
  if (!branch || branch.state === 'unavailable') {
    MENU_CATALOG = null;
    menuCatalogKey = '';
    setCatalogLoadState('error', branch?.error || 'Catalog branch unavailable');
    $('menuconfigGrid').textContent = '';
    $('menuconfigPanel').hidden = true;
    showCatalogStatus(branch || { state: 'unavailable', errorStage: 'catalog-index' });
    return null;
  }
  const key = `${source.id}/${branch.branch}`;
  if (!MENU_CATALOG || menuCatalogKey !== key) {
    if (catalogAutoloadReady) loadCatalog(source, branch, true, targetRequest).catch(() => {});
    return null;
  }
  const policyTarget = CATALOG_ENGINE.preferredCatalogTarget(
    MENU_CATALOG, PROJECT?.catalogSelectionPolicy?.preferredTarget || {});
  const selectorIds = (MENU_CATALOG?.targetSelectors || DEFAULT_TARGET_SELECTORS)
    .map((selector) => selector.id);
  const requestedTarget = selectorIds.some((id) =>
    targetRequest?.[id] || targetRequest?.[`${id}Symbol`]);
  const currentTarget = selectorIds.some((id) => targetSelectorValues[id]);
  const newCatalogRequested = Boolean(targetRequest?.sourceId || targetRequest?.branchId);
  const preferred = CATALOG_ENGINE.catalogTargetPreference({
    requestedTarget: requestedTarget ? targetRequest : null,
    currentTarget: currentTarget ? targetSelectorValues : null,
    stateTarget: state.device?.id === 'catalog-target' ? state.device.target : null,
    policyTarget,
    newCatalogRequested,
    preferState,
  });
  const selectedTarget = renderCatalogTargetSelectors(preferred);
  if (!selectedTarget.valid) {
    $('menuconfigBox').hidden = true;
    $('menuconfigGrid').textContent = '';
    setCatalogLoadState('error', 'Catalog target is unavailable or failed validation');
    showCatalogStatus(branch, MENU_CATALOG);
    return { source, branch, target: null, profile: null, invalidTarget: true };
  }
  setCatalogLoadState('idle');
  $('menuconfigBox').hidden = false;
  showCatalogStatus(branch, MENU_CATALOG);
  renderMenuconfig();
  renderCatalogLocatorResults();
  return { source, branch, target: selectedTarget.target, profile: selectedTarget.profile };
}
function catalogSourceObject(source, branch) {
  const legacy = source.legacy || MENU_CATALOG?.source?.legacy;
  return {
    id: source.id, label: source.label || source.id, repo: source.repo,
    append: true, loginPw: source.id === 'lede' ? 'password' : undefined,
    diy1: 'diy-generic.sh', diy2: 'diy2-generic.sh',
    versions: [{
      id: branch.id, label: branch.branch + (legacy ? ' (Legacy)' : ''),
      branch: branch.branch, note: legacy ? 'Legacy source' : '',
    }],
    variants: [],
  };
}
function catalogPackageOps(tokens = []) {
  const raw = tokens.map((pkg) => String(pkg).trim()).filter(Boolean);
  const values = new Map();
  for (const token of raw) {
    const remove = token.startsWith('-');
    const name = token.replace(/^[+-]/, '').trim();
    if (!name) continue;
    values.set(name, remove ? 'remove' : 'add');
  }
  const add = [...values].filter(([, value]) => value === 'add').map(([name]) => name);
  const remove = [...values].filter(([, value]) => value === 'remove').map(([name]) => name);
  return { raw: [...new Set(raw)], add, remove };
}
function catalogTargetPackageOps(target, profile) {
  return catalogPackageOps([...(target?.packages || []), ...(profile?.packages || [])]);
}
async function applyCatalogTarget() {
  if (!MENU_CATALOG || catalogTargetMismatch) return;
  const sourceRow = selectedCatalogSource();
  const branchRow = selectedCatalogBranch(sourceRow);
  const selectedTarget = renderCatalogTargetSelectors(targetSelectorValues);
  const { target, profile } = selectedTarget;
  if (!target || !profile) return;
  const source = catalogSourceObject(sourceRow, branchRow);
  const targetPackageOps = catalogPackageOps(target?.packages || []);
  const profilePackageOps = catalogPackageOps(profile?.packages || []);
  const packageOps = catalogTargetPackageOps(target, profile);
  const previousTarget = state.device?.id === 'catalog-target' ? state.device.target : null;
  const previousKey = previousTarget
    ? [state.source?.id, state.version?.id, previousTarget.targetSelector,
      previousTarget.profileSelector, previousTarget.arch, previousTarget.archPackages].join('|')
    : '';
  const variant = {
    id: profile.id || 'default', profile: profile.id, name: profile.name || profile.id || 'Default profile',
    note: target.name, capacity: 4096, versions: [branchRow.id],
  };
  source.variants = [variant];
  const device = {
    id: 'catalog-target', brand: 'Target', name: `${target.name} / ${profile.name || profile.id || 'Default profile'}`,
    chip: target.board, plugins: 'seed', enabled: true, kind: 'target',
    dir: 'platform/catalog-target', note: 'Menuconfig catalog target',
    target: {
      system: target.board, systemLabel: target.name || target.board,
      subtarget: target.subtarget, subtargetLabel: target.subtargetName || target.subtarget || 'Default',
      targetSelector: profile.targetSelector || target.contract?.targetSelector || '',
      boardSelector: profile.boardSelector || target.contract?.boardSelector ||
        `TARGET_${target.board}`,
      profileSelector: profile.selector || '',
      profile: profile.id.replace(/^DEVICE_/, ''), profileSymbol: profile.id,
      profileLabel: profile.name || profile.id || 'Default profile',
      arch: String(target.arch || '').trim(),
      archPackages: String(target.archPackages || '').trim(),
      features: [...(target.features || [])],
      targetPackages: targetPackageOps.raw,
      targetPackagesAdd: targetPackageOps.add,
      targetPackagesRemove: targetPackageOps.remove,
      profileDeclaredPackages: profilePackageOps.raw,
      profileDeclaredPackagesAdd: profilePackageOps.add,
      profileDeclaredPackagesRemove: profilePackageOps.remove,
      profilePackages: packageOps.raw,
      profilePackagesAdd: packageOps.add,
      profilePackagesRemove: packageOps.remove,
      extra: Object.fromEntries(Object.entries(selectedTarget.values)
        .filter(([key]) => !['system', 'subtarget', 'profile'].includes(key))),
    },
    sources: [source],
  };
  const record = { device, source, version: source.versions[0], variant };
  const nextKey = [sourceRow.id, branchRow.id, device.target.targetSelector,
    device.target.profileSelector, device.target.arch, device.target.archPackages].join('|');
  const targetChanged = Boolean(previousKey && previousKey !== nextKey);
  if (targetChanged) {
    profilePackageOverrides.clear();
    profilePackageModalOpen = false;
    markCatalogStateChanged();
  }
  if (state.device?.id !== device.id || state.source?.id !== source.id ||
      state.version?.id !== branchRow.id || state.variant?.id !== variant.id || targetChanged) {
    state.source = record.source;
    state.version = record.version;
    state.variant = record.variant;
    await switchDevice(device, false);
  }
  state.device = device;
  await ensureCatalogProfileBaselines(sourceRow, branchRow);
  ACTIVE_PROFILE_BASELINE = resolveActiveProfileBaseline(device.target);
  if (!ACTIVE_PROFILE_BASELINE) {
    throw new Error(`Native Profile baseline does not contain ${device.target.system}/${device.target.subtarget}/${device.target.profileSymbol}`);
  }
  const needsBaseline = targetChanged || !catalogBaselineValues.size;
  if (needsBaseline) initializeCatalogBaseline();
  syncCatalogApplications();
  activateTargetRecord(record);
  renderMenuconfig();
  renderBuildContract();
  updateSubmitGate();
}

function contractText(zh, en) {
  return state.lang === 'zh-CN' ? zh : en;
}
function renderContractList(element, title, items, empty) {
  if (!element) return;
  element.textContent = '';
  const heading = document.createElement('strong');
  heading.textContent = title;
  element.appendChild(heading);
  const content = document.createElement('div');
  content.className = 'build-contract-chips';
  if (!items.length) {
    const none = document.createElement('span');
    none.className = 'hint';
    none.textContent = empty;
    content.appendChild(none);
  } else {
    for (const item of items) {
      const chip = document.createElement('code');
      chip.className = 'build-contract-chip';
      chip.textContent = displayText(item);
      bindUiTooltipContent(chip, { body: displayText(item) });
      content.appendChild(chip);
    }
  }
  element.appendChild(content);
}

function profilePackageRows(target = state.device?.target) {
  if (!target) return [];
  const rows = new Map();
  for (const pkg of target.profilePackagesAdd || target.profilePackages || []) {
    const name = String(pkg).replace(/^[+-]/, '').trim();
    if (name) rows.set(name, { name, upstream: 'include' });
  }
  for (const pkg of target.profilePackagesRemove || []) {
    const name = String(pkg).replace(/^[+-]/, '').trim();
    if (name) rows.set(name, { name, upstream: 'exclude' });
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}
function profilePackageMode(packageName) {
  if (profilePackageOverrides.has(packageName)) return profilePackageOverrides.get(packageName);
  const option = profilePackageOption(packageName);
  if (!option || !catalogUserOverrides.has(option.symbol)) return 'follow';
  return catalogUserOverrides.get(option.symbol) === 'n' ? 'exclude' : 'include';
}
function renderProfilePackageContract(element, target) {
  if (!element) return;
  element.textContent = '';
  const head = document.createElement('div');
  head.className = 'build-contract-list-head';
  const title = document.createElement('strong');
  title.textContent = contractText('Profile 软件包', 'Profile packages');
  const manage = document.createElement('button');
  manage.type = 'button';
  manage.className = 'text-btn profile-package-manage';
  manage.textContent = contractText('管理', 'Manage');
  manage.onclick = openProfilePackageModal;
  head.append(title, manage);
  element.appendChild(head);
  const rows = profilePackageRows(target);
  const content = document.createElement('div');
  content.className = 'build-contract-chips';
  if (!rows.length) {
    const none = document.createElement('span');
    none.className = 'hint';
    none.textContent = contractText('上游未声明额外 Profile 软件包', 'No additional Profile packages declared upstream');
    content.appendChild(none);
  } else {
    for (const row of rows) {
      const mode = profilePackageMode(row.name);
      const chip = document.createElement('code');
      chip.className = `build-contract-chip profile-package-chip mode-${mode}`;
      const upstream = row.upstream === 'exclude' ? '−' : '+';
      const explicit = mode === 'follow' ? '' : mode === 'include' ? ' → +' : ' → −';
      chip.textContent = `${upstream}${displayText(row.name)}${explicit}`;
      bindUiTooltipContent(chip, { body: `${displayText(row.name)}
${contractText('默认跟随上游；可在管理中显式加入或排除', 'Follows upstream by default; Manage can explicitly include or exclude it')}` });
      content.appendChild(chip);
    }
  }
  element.appendChild(content);
}
function profilePackageOption(packageName) {
  return menuOptionBySymbol.get(`PACKAGE_${packageName}`) || null;
}
function profilePackageEnabledValue(option) {
  if (!option) return 'y';
  return option.states?.includes('y') ? 'y' : option.states?.includes('m') ? 'm' : 'y';
}
function setProfilePackageMode(packageName, mode) {
  if (!['follow', 'include', 'exclude'].includes(mode)) return;
  const previous = profilePackageMode(packageName);
  const option = profilePackageOption(packageName);
  try {
    if (mode === 'follow') {
      profilePackageOverrides.delete(packageName);
      if (option) {
        catalogUserOverrides.delete(option.symbol);
        const inherited = catalogInheritedValue(option.symbol);
        applyCatalogIntent(option, inherited, true, 'restore');
      }
    } else if (option) {
      profilePackageOverrides.delete(packageName);
      applyCatalogIntent(option,
        mode === 'include' ? profilePackageEnabledValue(option) : 'n', false, 'user');
    } else {
      profilePackageOverrides.set(packageName, mode);
    }
  } catch (error) {
    if (previous === 'follow') profilePackageOverrides.delete(packageName);
    else profilePackageOverrides.set(packageName, previous);
    showToast(error.message);
  }
  renderProfilePackageModal();
  renderBuildContract();
  renderMenuconfig();
  renderGroups();
  updateStats();
}
function renderProfilePackageModal() {
  if (!profilePackageModalOpen || $('modal').hidden) return;
  const body = $('modalBody');
  body.textContent = '';
  const intro = document.createElement('p');
  intro.className = 'hint';
  intro.textContent = contractText(
    '默认“跟随上游”不写入显式值；只有“加入”或“排除”才记录用户选择。',
    'Follow upstream writes no explicit value; only Include or Exclude records a user choice.');
  body.appendChild(intro);
  const list = document.createElement('div');
  list.className = 'profile-package-list';
  for (const row of profilePackageRows()) {
    const item = document.createElement('div');
    item.className = 'profile-package-row';
    const name = document.createElement('code');
    name.textContent = displayText(row.name);
    const upstream = document.createElement('small');
    upstream.textContent = row.upstream === 'exclude'
      ? contractText('上游排除', 'Upstream excludes')
      : contractText('上游加入', 'Upstream includes');
    const choices = document.createElement('span');
    choices.className = 'profile-package-actions';
    for (const [value, zh, en] of [
      ['follow', '跟随上游', 'Follow upstream'], ['include', '加入', 'Include'], ['exclude', '排除', 'Exclude'],
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = contractText(zh, en);
      button.className = profilePackageMode(row.name) === value ? 'active' : '';
      button.onclick = () => setProfilePackageMode(row.name, value);
      choices.appendChild(button);
    }
    item.append(name, upstream, choices);
    list.appendChild(item);
  }
  if (!list.children.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = contractText('当前 Profile 没有额外软件包声明。', 'This Profile declares no additional packages.');
    body.appendChild(empty);
  } else body.appendChild(list);
}
function openProfilePackageModal() {
  profilePackageModalOpen = true;
  openModal(contractText('Profile 软件包', 'Profile packages'));
  $('modal').querySelector('.modal').classList.add('modal-wide', 'profile-package-config');
  modalCancelHandler = () => { profilePackageModalOpen = false; };
  renderProfilePackageModal();
}
function setBuildContractExpanded(expanded) {
  buildContractExpanded = Boolean(expanded);
  const toggle = $('buildContractToggle');
  const body = $('buildContractBody');
  if (!toggle || !body) return;
  toggle.setAttribute('aria-expanded', String(buildContractExpanded));
  body.hidden = !buildContractExpanded;
}
function initBuildContractControls() {
  const toggle = $('buildContractToggle');
  if (!toggle) return;
  setBuildContractExpanded(false);
  toggle.addEventListener('click', () => setBuildContractExpanded(!buildContractExpanded));
}
function renderBuildContract() {
  const box = $('buildContract');
  const controls = $('buildContractControls');
  if (!box || !controls) return;
  const target = state.device?.id === 'catalog-target' ? state.device.target : null;
  if (!target || !MENU_CATALOG) {
    box.hidden = true;
    controls.hidden = true;
    return;
  }
  const source = selectedCatalogSource();
  const branch = selectedCatalogBranch(source);
  const selected = effectiveSelection();
  const selectedNames = selected.all.map((item) => item.id);
  const commit = String(MENU_CATALOG.source?.commit || '').trim() || 'unknown';
  const contractTitle = contractText('当前构建契约', 'Current build contract');
  $('buildContractTitle').textContent = contractTitle;
  const toggle = $('buildContractToggle');
  const commitHint = `${contractText('Catalog 提交', 'Catalog commit')} ${commit}`;
  bindUiTooltipContent(toggle, { body: commitHint });
  toggle.setAttribute('aria-label', `${contractTitle}; ${commitHint}`);
  const grid = $('buildContractGrid');
  grid.textContent = '';
  const profileAdd = target.profilePackagesAdd?.length || 0;
  const profileRemove = target.profilePackagesRemove?.length || 0;
  const rows = [
    [contractText('源码', 'Source'), source?.label || state.source?.id || '-'],
    [contractText('分支', 'Branch'), branch?.branch || state.version?.branch || '-'],
    [contractText('Target', 'Target'), target.systemLabel || target.system || '-'],
    [contractText('Subtarget', 'Subtarget'), target.subtargetLabel || target.subtarget || '-'],
    [contractText('Profile', 'Profile'), target.profileLabel || target.profileSymbol || '-'],
    [contractText('软件包', 'Packages'), `${profileAdd} add / ${profileRemove} remove`],
    [contractText('Catalog', 'Catalog'), commit],
    [contractText('架构', 'Architecture'), target.arch || target.archPackages || contractText('Catalog 未提供', 'Missing from Catalog')],
  ];
  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'build-contract-row';
    const key = document.createElement('span');
    key.className = 'build-contract-key';
    key.textContent = label;
    const val = document.createElement('code');
    val.textContent = value;
    bindUiTooltipContent(val, { body: value });
    row.append(key, val);
    grid.appendChild(row);
  }
  renderProfilePackageContract($('buildContractProfilePackages'), target);
  const shownSelected = selectedNames.slice(0, 24);
  if (selectedNames.length > shownSelected.length) shownSelected.push(`+${selectedNames.length - shownSelected.length}`);
  renderContractList($('buildContractSelection'),
    contractText('已选插件', 'Selected plugins'), shownSelected,
    contractText('尚未选择插件', 'No plugins selected'));
  setBuildContractExpanded(buildContractExpanded);
  box.hidden = false;
  controls.hidden = false;
}
