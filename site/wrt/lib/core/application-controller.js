/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
+ *
+ * Application initialization and feature coordination.
+ */
+'use strict';

/* ============ 初始化 / Init ============ */
function startCatalogAfterFirstPaint() {
  const start = () => {
    catalogAutoloadReady = true;
    renderDevices();
    const tasks = {
      menu: refreshMenuIndex,
      'menu:language': async () => {
        await menuCatalogPromise;
        if (MENU_CATALOG?.menu?.displayLoaded) await ensureCatalogMenuLanguage(state.lang);
      },
      'package-mirrors': ensurePackageMirrors,
    };
    const startup = runCatalogTaskQueue(
      PROJECT?.catalogLoadPolicy?.startup || ['menu', 'menu:language', 'package-mirrors'], tasks,
      PROJECT?.catalogLoadPolicy?.startupConcurrency || 3, '', 'startup',
    );
    catalogStartupPromise = startup;
    startup.then(() => {
      if (catalogStartupPromise === startup) catalogStartupPromise = null;
      flushCatalogApplicationsDemand();
    });
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(start, 0)));
  } else setTimeout(start, 0);
}
async function init() {
  try {
    [CATALOG_ENGINE, CATALOG_LOADER_MODULE, CATALOG_SCHEMA6_MODULE, BUILD_IDENTITY_MODULE] = await Promise.all([
      import(releaseAssetUrl('./lib/catalog-engine.js')),
      import(releaseAssetUrl('./lib/catalog-loader.js')),
      import(releaseAssetUrl('./lib/catalog-schema6.js')),
      import(releaseAssetUrl('./lib/build-identity.js')),
    ]);
    $('tagBox')?.addEventListener('input', () => {
      const input = $('tagBox');
      const points = Array.from(input.value);
      if (points.length > BUILD_IDENTITY_MODULE.BUILD_TAG_MAX_CODE_POINTS) {
        input.value = points.slice(0, BUILD_IDENTITY_MODULE.BUILD_TAG_MAX_CODE_POINTS).join('');
      }
    });
    await initializeI18n();
    renderLangSel();
    try {
      PROJECT = await loadJson('project.json');
      if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(PROJECT.repository || '')) {
        OFFICIAL_REPO = PROJECT.repository;
        REPO_NAME = OFFICIAL_REPO.split('/')[1];
      }
      if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(PROJECT.catalogRepository || '')) {
        MENU_CATALOG_REPO = PROJECT.catalogRepository;
      }
      const repoUrl = `https://github.com/${OFFICIAL_REPO}`;
      $('repoLink').href = repoUrl;
      $('footRepo').href = repoUrl;
      $('actionsLink').href = `${repoUrl}/actions`;
      document.querySelectorAll('.blog-link').forEach((link) => {
        if (/^https?:\/\//.test(PROJECT.blogUrl || '')) link.href = PROJECT.blogUrl;
      });
    } catch (e) { /* old deployments keep the built-in project defaults */ }
    const deploymentIdentity = await loadDeploymentIdentity();
    state.siteVersion = deploymentIdentity.siteVersion;
    state.buildMeta = deploymentIdentity.buildMeta;
    MENU_CATALOG_DATA_REF = BUILD_IDENTITY_MODULE.catalogDataBranch(
      state.buildMeta?.branch, PROJECT?.catalogDataBranches,
    );
    CATALOG_LOADER = CATALOG_LOADER_MODULE.createCatalogLoader({
      repository: MENU_CATALOG_REPO,
      releaseTag: PROJECT?.catalogReleaseTag || 'menuconfig-catalog-complete',
      dataRef: MENU_CATALOG_DATA_REF,
      allowReleaseFallback: MENU_CATALOG_DATA_REF === 'catalog-data',
      engine: CATALOG_ENGINE,
    });
    TIMEZONES = await loadJson('timezones.json');
    initializeTimezone();
    renderBuildInfo();
    resetPluginWorkspace(PLUGINS);
    renderDevices();
    renderModes();
    renderFirmwareSettings();
    initDeviceFold();
    initMenuconfigControls();
    initBuildContractControls();
    initCatalogLocator();
    initCatalogApplicationsDemand();
    $('defconfigToggle').checked = state.useDefconfig;
    initDefconfig();
    applyI18n();
    $('advMode').checked = state.advanced;
    resetAdvGrey();   // V10:门禁行随记忆的开发者模式显隐,但永远从未勾开始 / V10: gate row follows the remembered developer mode, but always starts unticked
    $('loading').hidden = true;
    $('form').hidden = false;
    $('actionbar').hidden = false;
    if (localStorage.getItem('wrt_risk') !== 'ok') $('riskBar').hidden = false;
    startCatalogAfterFirstPaint();
  } catch (err) {
    $('loading').textContent = (I18N ? t('loading.fail', { msg: err.message }) : '加载失败: ' + err.message);
  }
}

function renderLangSel() {
  const sel = $('langSel');
  sel.textContent = '';
  for (const l of I18N.languages) {
    const o = document.createElement('option');
    o.value = l.id;
    o.dataset.fullName = l.native || l.name;
    o.textContent = LANG_SHORT[l.id] || l.id.slice(0, 2).toUpperCase();
    if (l.id === state.lang) o.selected = true;
    sel.appendChild(o);
  }
  const setNames = (full) => {
    for (const option of sel.options) {
      option.textContent = full ? option.dataset.fullName :
        (LANG_SHORT[option.value] || option.value.slice(0, 2).toUpperCase());
    }
  };
  sel.onpointerdown = () => setNames(true);
  sel.onfocus = () => setNames(true);
  sel.onblur = () => setNames(false);
  sel.onchange = async () => {
    await ensureI18nLanguage(sel.value);
    state.lang = sel.value;
    safeSet('wrt_lang', state.lang);
    if (MENU_CATALOG?.menu?.displayLoaded) {
      await ensureCatalogMenuLanguage(state.lang).catch((error) => console.warn('[Catalog language shard]', error));
    }
    applyI18n();
    setTimeout(() => setNames(false), 0);
  };
}

function resetPluginWorkspace(data) {
  PLUGINS = data;
  state.sel.clear();
  state.removed.clear();
  collapsed.clear();
  for (const group of PLUGINS?.groups || []) collapsed.add(group);
}

let switchSeq = 0;
async function switchDevice(dev, first, notify = false) {
  const seq = ++switchSeq;
  state.device = dev;
  if (seq !== switchSeq) return;
  resetPluginWorkspace(PLUGINS);
  renderDevices();
  renderSources();
  renderGroups();
  updateStats();
  updateLoginInfo();
  updateSubmitGate();
  if (!first && notify) showToast(t('toast.deviceSwitched', { name: dev.name }), 'device');
}

function fillTargetSelect(id, rows, valueOf, labelOf, preferred) {
  const select = $(id);
  if (!select) return '';
  const previous = select.value;
  const values = [];
  for (const row of rows) {
    const value = valueOf(row);
    if (!values.some((item) => item.value === value)) values.push({ value, label: labelOf(row) });
  }
  select.textContent = '';
  for (const item of values) {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    select.appendChild(option);
  }
  if (values.some((item) => item.value === preferred)) select.value = preferred;
  else if (values.some((item) => item.value === previous)) select.value = previous;
  const label = select.closest('label');
  if (label) {
    label.hidden = values.length === 0;
    label.classList.toggle('target-single', values.length === 1);
  }
  select.disabled = values.length === 1;
  return select.value;
}

function targetControlId(id) {
  const known = { system: 'targetSystem', subtarget: 'targetSubtarget', profile: 'targetProfile' };
  return known[id] || `targetExtra_${String(id).replace(/[^A-Za-z0-9_-]/g, '_')}`;
}
function targetFieldTranslation(id, selector = null) {
  const localized = selector?.i18n?.[state.lang] || TARGET_FIELD_I18N[id]?.[state.lang];
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
function catalogApplicationsPluginData(document) {
  return {
    groups: [...(document.groups || [])],
    plugins: (document.items || []).map((item) => ({
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
    throw new Error(uiText(
      '当前分支缺少构建验证所需的旧版 Catalog 精确契约，请等待 Catalog 发布完成后重试。',
      '目前分支缺少建置驗證所需的舊版 Catalog 精確契約，請等待 Catalog 發佈完成後重試。',
      'This branch lacks the exact legacy Catalog contract required for build validation. Wait for Catalog publishing to finish and try again.'));
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
    status.textContent = `Unavailable · failed at ${branch.errorStage || 'unknown'}`;
  } else if (stateName === 'stale') {
    status.textContent = `Stale · last success ${branch.lastSuccessAt || 'unknown'}` +
      ` · failed at ${branch.errorStage || 'unknown'}`;
  } else {
    const count = catalog?.counts?.menuOptions || catalog?.menu?.options?.length || 0;
    status.textContent = `${stateName === 'fallback' ? 'Local fallback · ' : 'Fresh · '}${count} options` +
    (catalog?.source?.commit ? ` · ${catalog.source.commit.slice(0, 8)}` : '');
  }
}
const menuPathKey = (path) => path.join('\u0001');
function menuLabelMeta(name) {
  return MENU_CATALOG?.menu?.labels?.[name] || { en: name, zhCN: '' };
}
function menuPathLabel(name) {
  const row = menuLabelMeta(name);
  return String(row.en || name || '').trim();
}
function menuOptionLabel(option) {
  const prompt = String(option.promptEn || option.prompt || '').trim();
  if (prompt) return prompt;
  return String(option.symbol || '').replace(/^PACKAGE_/, '').replaceAll('_', ' ').trim();
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
  const lines = [String(chinese || '').trim(), String(usageChinese || '').trim()].filter(Boolean);
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
    `CONFIG_${element.dataset.symbol}`,
    description.length ? description.join('\n') : '',
    element.dataset.path || '',
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
      title: uiText('浏览器当前离线', '瀏覽器目前離線', 'Your browser is offline'),
      body: uiText('请检查本机网络连接，联网后点击上方按钮重试。', '請檢查本機網路連線，連線後點擊上方按鈕重試。',
        'Check your network connection, then use the button above to retry.'),
    },
    validation: {
      title: uiText('Catalog 数据校验失败', 'Catalog 資料驗證失敗', 'Catalog data validation failed'),
      body: uiText('下载已响应，但数据完整性、格式或浏览器解压校验未通过；请复制诊断信息后反馈。',
        '下載已有回應，但資料完整性、格式或瀏覽器解壓驗證未通過；請複製診斷資訊後回報。',
        'The download responded, but integrity, format, or browser decompression validation failed. Copy the diagnostics when reporting it.'),
    },
    'rate-limit': {
      title: uiText('远端请求受到限流', '遠端請求受到限流', 'Remote requests are rate-limited'),
      body: uiText('GitHub 或 CDN 暂时拒绝了过多请求；请稍后重试，也可查看 GitHub 服务状态。',
        'GitHub 或 CDN 暫時拒絕了過多請求；請稍後重試，也可查看 GitHub 服務狀態。',
        'GitHub or the CDN temporarily rejected too many requests. Retry later or check GitHub service status.'),
    },
    'remote-service': {
      title: uiText('远端服务暂时异常', '遠端服務暫時異常', 'A remote service is temporarily unavailable'),
      body: uiText('Catalog 数据源返回服务器错误，可能是 GitHub 或 CDN 故障；请稍后重试并查看服务状态。',
        'Catalog 資料來源回傳伺服器錯誤，可能是 GitHub 或 CDN 故障；請稍後重試並查看服務狀態。',
        'A Catalog source returned a server error. GitHub or the CDN may be disrupted; retry later and check service status.'),
    },
    unreachable: {
      title: uiText('远端数据源暂时不可达', '遠端資料來源暫時無法連線', 'Remote Catalog sources are unreachable'),
      body: uiText('浏览器在线，但 jsDelivr 与 GitHub 数据源均无法连接；可能是网络限制或 GitHub 全球服务故障。',
        '瀏覽器在線，但 jsDelivr 與 GitHub 資料來源均無法連線；可能是網路限制或 GitHub 全球服務故障。',
        'The browser is online, but jsDelivr and GitHub sources are unreachable. Network filtering or a GitHub service incident may be involved.'),
    },
    'snapshot-missing': {
      title: uiText('Catalog 分支或快照不存在', 'Catalog 分支或快照不存在', 'The Catalog branch or snapshot is unavailable'),
      body: uiText('远端服务可以访问，但当前数据分支或固定快照尚未发布；请复制诊断信息后反馈。',
        '遠端服務可以存取，但目前資料分支或固定快照尚未發布；請複製診斷資訊後回報。',
        'The remote service is reachable, but this data branch or pinned snapshot is not published. Copy the diagnostics when reporting it.'),
    },
    unknown: {
      title: uiText('Catalog 加载失败', 'Catalog 載入失敗', 'Catalog failed to load'),
      body: uiText('所有可用数据源均未成功；请重试、查看 GitHub 服务状态，或复制诊断信息后反馈。',
        '所有可用資料來源均未成功；請重試、查看 GitHub 服務狀態，或複製診斷資訊後回報。',
        'No Catalog source succeeded. Retry, check GitHub service status, or copy the diagnostics when reporting it.'),
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
      ? `${summary.title}${uiText('，点击重试', '，點擊重試', '. Click to retry')}`
      : uiText('正在加载 Target 与 menuconfig…', '正在載入 Target 與 menuconfig…',
        'Loading Target and menuconfig…');
  }
  const details = $('catalogLoadDetails');
  if (details) details.hidden = !failed;
  if ($('catalogLoadReasonTitle')) $('catalogLoadReasonTitle').textContent = failed ? summary.title : '';
  if ($('catalogLoadReasonText')) $('catalogLoadReasonText').textContent = failed ? summary.body : '';
  if ($('catalogStatusLink')) {
    $('catalogStatusLink').hidden = !failed || !failure.showGithubStatus;
    $('catalogStatusLink').textContent = uiText('查看 GitHub 服务状态', '查看 GitHub 服務狀態',
      'View GitHub service status');
  }
  if ($('catalogLoadDiagnostics')) $('catalogLoadDiagnostics').textContent = failed ? catalogDiagnosticsText() : '';
  if ($('catalogCopyDiagnostics')) {
    $('catalogCopyDiagnostics').textContent = uiText('复制诊断', '複製診斷', 'Copy diagnostics');
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
      button.textContent = uiText('已复制', '已複製', 'Copied');
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
  $('menuconfigStatus').textContent = 'Loading catalog…';
  menuCatalogPromise = (async () => {
    const remote = await fetchCatalogBundle(
      source, branch, abortController.signal, options.forceRefresh === true,
    );
    const catalog = remote.data;
    catalog.loadedFrom = remote.url;
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
    if (catalog.splitAssets) buildMenuStartupIndexes(catalog);
    else buildMenuIndexes(catalog);
    resetCatalogSelectionLayers();
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
      chip.textContent = item;
      bindUiTooltipContent(chip, { body: item });
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
      chip.textContent = `${upstream}${row.name}${explicit}`;
      bindUiTooltipContent(chip, { body: `${row.name}
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
    name.textContent = row.name;
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

function resetCatalogSelectionLayers() {
  menuValues.clear();
  menuTouched.clear();
  catalogBaselineValues.clear();
  catalogBaselineOrigins.clear();
  catalogRecommendedValues.clear();
  catalogDependencySymbols.clear();
  catalogConditionalDefaultSymbols.clear();
  catalogImportedSymbols.clear();
  catalogUserOverrides.clear();
  profilePackageOverrides.clear();
  profilePackageModalOpen = false;
  state.sel.clear();
  state.removed.clear();
  menuOriginFilter = 'all';
  menuUserSettableOnly = false;
  if ($('menuconfigUserSettable')) $('menuconfigUserSettable').checked = false;
  refreshMenuconfigFilterText();
  markCatalogStateChanged();
}
function initializeCatalogBaseline() {
  menuValues.clear();
  menuTouched.clear();
  catalogBaselineValues.clear();
  catalogBaselineOrigins.clear();
  catalogRecommendedValues.clear();
  catalogDependencySymbols.clear();
  catalogConditionalDefaultSymbols.clear();
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
      throw new Error(`Native Profile baseline value cannot be normalized: CONFIG_${option.symbol}`);
    }
    menuValues.set(option.symbol, value);
  }
  markCatalogStateChanged();
  snapshotCatalogBaseline();
}

function snapshotCatalogBaseline() {
  catalogBaselineValues.clear();
  for (const option of menuSearchOptions) {
    const value = menuValues.get(option.symbol) ?? (option.type === 'string' ? '' : 'n');
    catalogBaselineValues.set(option.symbol, value);
    if (value !== 'n' && value !== '' && !catalogDependencySymbols.has(option.symbol)) {
      catalogBaselineOrigins.set(option.symbol, {
        kind: 'kconfig-default', detail: 'Kconfig default',
      });
    }
  }
}
function normalizeCatalogBaselineValue(option, rawValue) {
  const fallback = option?.type === 'string' ? '' : 'n';
  const raw = rawValue ?? fallback;
  return option?.type === 'bool' || option?.type === 'tristate'
    ? CATALOG_ENGINE.normalizeKconfigStateValue(option, raw)
    : String(raw);
}
function backfillCatalogBaselineForLoadedOptions() {
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

function catalogInheritedValue(symbol) {
  if (state.importedConfig && menuImportedOriginal.has(symbol)) return menuImportedOriginal.get(symbol);
  if (catalogRecommendedValues.has(symbol)) return catalogRecommendedValues.get(symbol);
  return catalogBaselineValues.get(symbol) ?? (menuOptionBySymbol.get(symbol)?.type === 'string' ? '' : 'n');
}
function catalogOriginMeta(option) {
  const symbol = option?.symbol || '';
  const value = menuValues.get(symbol) ?? simpleKconfigDefault(option || {});
  if (catalogUserOverrides.has(symbol)) {
    const desired = catalogUserOverrides.get(symbol);
    const forced = ['bool', 'tristate'].includes(option?.type) && desired !== value;
    const constraints = forced ? optionStateConstraints(option) : null;
    const selectors = constraints?.selectors?.map((item) =>
      `${item.sourceSymbol}=${String(item.sourceValue || 'n').toUpperCase()}`).join('\n') || '';
    const forcedDetail = forced ? uiText(
      `你的原始选择是 ${String(desired).toUpperCase()}；活动 select 暂时把实际值提升为 ${String(value).toUpperCase()}。关闭以下 selector 后会自动恢复原始选择：\n${selectors}`,
      `你的原始選擇是 ${String(desired).toUpperCase()}；作用中的 select 暫時把實際值提高為 ${String(value).toUpperCase()}。關閉以下 selector 後會自動恢復原始選擇：\n${selectors}`,
      `Your saved choice is ${String(desired).toUpperCase()}; active select rules temporarily raise the effective value to ${String(value).toUpperCase()}. It will restore automatically after these selectors are disabled:\n${selectors}`) : '';
    return desired === 'n'
      ? {
        kind: 'user-exclude', label: uiText('排除', '排除', 'Excluded'), restorable: true,
        detail: forcedDetail || uiText('由你主动设为 N。单击可删除此覆盖并恢复继承值。',
          '由你主動設為 N。按一下可刪除此覆寫並還原繼承值。',
          'You explicitly selected N. Click to remove this override and restore the inherited value.'),
      }
      : {
        kind: 'user', label: uiText('自选', '自選', 'Selected'), restorable: true,
        detail: forcedDetail || uiText('由你主动选择。单击可删除此覆盖并恢复继承值。',
          '由你主動選擇。按一下可刪除此覆寫並還原繼承值。',
          'You selected this value. Click to remove the override and restore the inherited value.'),
      };
  }
  if (catalogImportedSymbols.has(symbol)) {
    return {
      kind: 'imported', label: uiText('导入', '匯入', 'Imported'),
      detail: uiText('当前值来自已导入的配置。', '目前值來自已匯入的設定。',
        'The current value comes from the imported configuration.'),
    };
  }
  if (catalogRecommendedValues.has(symbol)) {
    return {
      kind: 'recommended', label: uiText('推荐', '推薦', 'Recommended'),
      detail: uiText('当前值来自网页推荐项。', '目前值來自網頁推薦項目。',
        'The current value comes from the web recommendations.'),
    };
  }
  if (catalogConditionalDefaultSymbols.has(symbol)) {
    return {
      kind: 'kconfig-default', displayKind: 'default', label: uiText('默认', '預設', 'Default'),
      detail: uiText(
        '当前值由 Catalog Kconfig 的条件默认值自动计算；修改父选项、固件语言或其他条件后会自动更新。',
        '目前值由 Catalog Kconfig 的條件預設值自動計算；修改父選項、韌體語言或其他條件後會自動更新。',
        'Catalog Kconfig computed this conditional default. It updates automatically when its parent option, firmware language, or another condition changes.'),
    };
  }
  if (catalogDependencySymbols.has(symbol)) {
    return {
      kind: 'dependency', label: uiText('自动依赖', '自動相依', 'Dependency'),
      detail: uiText('当前值由已选择项目的 Kconfig 依赖关系自动带入。',
        '目前值由已選項目的 Kconfig 相依關係自動帶入。',
        'Kconfig dependency resolution selected the current value automatically.'),
    };
  }
  if (value !== 'n' && value !== '') {
    const baseline = catalogBaselineOrigins.get(symbol);
    if (baseline) {
      return {
        kind: baseline.kind, displayKind: 'default', label: uiText('默认', '預設', 'Default'),
        detail: uiText('当前值来自所选 Target / Profile 的上游基准配置。',
          '目前值來自所選 Target / Profile 的上游基準設定。',
          'The current value comes from the selected Target / Profile upstream baseline.'),
      };
    }
  }
  return { kind: 'inactive', label: uiText('未启用', '未啟用', 'Disabled') };
}
function catalogOriginMatches(option) {
  if (menuOriginFilter === 'all') return true;
  const origin = catalogOriginMeta(option).kind;
  if (menuOriginFilter === 'default') return origin === 'kconfig-default';
  if (menuOriginFilter === 'excluded') return origin === 'user-exclude';
  return origin === menuOriginFilter;
}
function selectedOriginFilterLabel() {
  return menuFilterText(MENU_ORIGIN_FILTER_VALUES.includes(menuOriginFilter) ? menuOriginFilter : 'all');
}
function refreshMenuconfigFilterText() {
  const group = $('menuconfigOriginFilter');
  if (!group) return;
  if ($('menuconfigOriginTitle')) $('menuconfigOriginTitle').textContent = menuFilterText('origin');
  if ($('menuconfigDisplayTitle')) $('menuconfigDisplayTitle').textContent = menuFilterText('display');
  for (const input of group.querySelectorAll('input[name="menuconfigOrigin"]')) {
    const text = input.closest('label')?.querySelector('span');
    if (text) text.textContent = menuFilterText(input.value);
    input.checked = input.value === menuOriginFilter;
  }
  const selectedLabel = $('menuconfigSelectedOnly')?.closest('label')?.querySelector('span');
  if (selectedLabel) selectedLabel.textContent = menuFilterText('selectedOnly');
  const settableLabel = $('menuconfigUserSettable')?.closest('label')?.querySelector('span');
  if (settableLabel) settableLabel.textContent = menuFilterText('userSettable');
  refreshMenuconfigFilterSummary();
}
function refreshMenuconfigFilterSummary() {
  const summary = $('menuconfigFilterSummary');
  if (!summary) return;
  const selectedOnly = Boolean($('menuconfigSelectedOnly')?.checked);
  const userSettableOnly = Boolean($('menuconfigUserSettable')?.checked);
  summary.textContent = selectedOnly
    ? menuFilterText('selectedOnly')
    : userSettableOnly ? menuFilterText('userSettable') : menuFilterText('filter');
  const accessibility = [selectedOriginFilterLabel()];
  if (selectedOnly) accessibility.push(menuFilterText('selectedOnly'));
  if (userSettableOnly) accessibility.push(menuFilterText('userSettable'));
  $('menuconfigFilterTrigger')?.setAttribute('aria-label', accessibility.join(', '));
}
function restoreCatalogDefault(option) {
  if (!option) return;
  hideUiTooltip(true);
  catalogUserOverrides.delete(option.symbol);
  const plugin = option.symbol.startsWith('PACKAGE_') ? PLUGINS?.plugins?.find((item) =>
    curatedPackageCandidates(item).includes(option.symbol.slice(8))) : null;
  if (plugin) {
    state.sel.delete(plugin.id);
    state.removed.delete(plugin.id);
  }
  const value = catalogInheritedValue(option.symbol);
  applyMenuValue(option, value, true, 'restore');
  renderMenuconfig();
  renderFirmwareSettings();
  renderGroups();
  updateStats();
}
function simpleKconfigDefault(option, context = null) {
  if (!CATALOG_ENGINE?.resolveKconfigDefault) return option.type === 'string' ? '' : 'n';
  const activeContext = context || catalogValidationContext(menuValues, 'interactive');
  return CATALOG_ENGINE.resolveKconfigDefault(
    option, activeContext.values, activeContext.validationOptions,
  ).value;
}
function catalogValidationContext(inputValues = menuValues, phase = 'interactive') {
  const target = state.device?.target || null;
  const cacheable = inputValues === menuValues && !catalogContextCacheBypass;
  const targetKey = [target?.system, target?.subtarget, target?.profileSymbol || target?.profile,
    target?.targetSelector, target?.profileSelector].map((value) => String(value || '')).join('|');
  const cacheKey = `${phase}|${catalogStateRevision}|${targetKey}`;
  if (cacheable && catalogContextCache.has(cacheKey)) return catalogContextCache.get(cacheKey);
  const context = CATALOG_ENGINE?.createCatalogValidationContext && CATALOG_MODEL
    ? CATALOG_ENGINE.createCatalogValidationContext(CATALOG_MODEL, target, inputValues, { phase })
    : {
      values: new Map(inputValues),
      trustedSymbols: new Set(),
      validationOptions: {
        phase,
        contextComplete: Boolean(target?.system && target?.subtarget && (target?.profileSymbol || target?.profile)),
        trustedSymbols: new Set(),
        deferred: 'ignore',
      },
    };
  if (cacheable) catalogContextCache.set(cacheKey, context);
  return context;
}
function catalogEngineValues() {
  return catalogValidationContext(menuValues, 'interactive').values;
}
function kconfigLevel(value) {
  return value === 'y' ? 2 : value === 'm' ? 1 : 0;
}
function kconfigExpr(expression) {
  return CATALOG_ENGINE ? CATALOG_ENGINE.evaluateExpression(expression, catalogEngineValues()) : 0;
}
function optionDependencyVariants(option) {
  const variants = Array.isArray(option?.dependsVariants) && option.dependsVariants.length
    ? option.dependsVariants : [option?.depends || []];
  return variants.map((group) => (Array.isArray(group) ? group : [group]).filter((expression) =>
    !(/\s/.test(String(expression)) && !/[&|=!<>]/.test(String(expression)))));
}
function refreshMenuEvaluationCaches() {
  if (menuVisibilityRevision === catalogStateRevision) return;
  menuVisibilityRevision = catalogStateRevision;
  menuVisibilityCache.clear();
  menuSelectableStatesCache.clear();
  menuStateConstraintsCache.clear();
}
function hiddenDerivedOptionActive(option) {
  if (!option?.hidden || option.userSettable !== false || option.origin === 'packageinfo-only') return true;
  const value = menuValues.get(option.symbol) ?? (option.type === 'string' ? '' : 'n');
  return option.type === 'bool' || option.type === 'tristate'
    ? kconfigLevel(value) > 0
    : String(value ?? '').trim() !== '';
}
function optionVisible(option) {
  if (option?.hidden) return hiddenDerivedOptionActive(option);
  refreshMenuEvaluationCaches();
  if (menuVisibilityCache.has(option.symbol)) return menuVisibilityCache.get(option.symbol);
  const visible = optionDependencyVariants(option).some((group) =>
    group.every((expression) => kconfigExpr(expression) > 0));
  menuVisibilityCache.set(option.symbol, visible);
  return visible;
}
function optionSelectableStates(option) {
  refreshMenuEvaluationCaches();
  if (menuSelectableStatesCache.has(option.symbol)) return menuSelectableStatesCache.get(option.symbol);
  const states = optionStateConstraints(option).selectableStates;
  menuSelectableStatesCache.set(option.symbol, states);
  return states;
}
function optionStateConstraints(option) {
  refreshMenuEvaluationCaches();
  if (menuStateConstraintsCache.has(option.symbol)) return menuStateConstraintsCache.get(option.symbol);
  const context = catalogValidationContext(menuValues, 'interactive');
  const constraints = CATALOG_ENGINE?.kconfigStateConstraints
    ? CATALOG_ENGINE.kconfigStateConstraints(CATALOG_MODEL, option, context.values, context.validationOptions)
    : {
      current: menuValues.get(option.symbol) ?? 'n',
      minimum: 'n', maximum: 'y', minimumLevel: 0, maximumLevel: 2,
      readOnly: option.userSettable === false, selectors: [],
      selectableStates: CATALOG_ENGINE.selectableKconfigStates(
        option, context.values, { ...context.validationOptions, model: CATALOG_MODEL }),
      states: CATALOG_ENGINE.allowedKconfigStates(option).map((value) => ({ value, selectable: true })),
    };
  menuStateConstraintsCache.set(option.symbol, constraints);
  return constraints;
}
function optionMaxLevel(option) {
  return Math.max(0, ...optionSelectableStates(option).map(kconfigLevel));
}
function syncMenuToCurated(option, value, source = 'user') {
  if (!option.symbol.startsWith('PACKAGE_') || !PLUGINS?.plugins || !state.source) return false;
  const packageName = option.symbol.slice('PACKAGE_'.length);
  const plugin = PLUGINS.plugins.find((item) =>
    curatedPackageCandidates(item).includes(packageName));
  if (!plugin) return false;
  if (source === 'restore') {
    state.sel.delete(plugin.id);
    state.removed.delete(plugin.id);
    return true;
  }
  if (source !== 'user') return true;
  if (value === 'n') {
    state.sel.delete(plugin.id);
    state.removed.add(plugin.id);
  } else {
    state.sel.add(plugin.id);
    state.removed.delete(plugin.id);
  }
  return true;
}
function syncCuratedToMenu(plugin, value) {
  if (!MENU_CATALOG?.menu?.options || !state.source) return;
  const option = curatedPackageCandidates(plugin)
    .map((packageName) => menuOptionBySymbol.get(`PACKAGE_${packageName}`))
    .find(Boolean);
  if (option) setMenuValue(option, value);
}
function curatedMenuOption(plugin) {
  if (!MENU_CATALOG?.menu?.options || !state.source) return null;
  return curatedPackageCandidates(plugin)
    .map((packageName) => menuOptionBySymbol.get(`PACKAGE_${packageName}`))
    .find(Boolean) || null;
}
function curatedPluginIntent(plugin, catalogOption = null) {
  if (state.device?.id === 'catalog-target') {
    const option = catalogOption || curatedMenuOption(plugin);
    if (!option || !catalogUserOverrides.has(option.symbol)) return 'none';
    return catalogUserOverrides.get(option.symbol) === 'n' ? 'excluded' : 'selected';
  }
  if (state.removed.has(plugin.id)) return 'excluded';
  return state.sel.has(plugin.id) ? 'selected' : 'none';
}
function curatedPluginChecked(plugin, pluginStatus, catalogOption = null) {
  if (catalogOption) {
    return (menuValues.get(catalogOption.symbol) ?? simpleKconfigDefault(catalogOption)) !== 'n';
  }
  const intent = curatedPluginIntent(plugin);
  return pluginStatus === 'builtin' ? intent !== 'excluded' : intent === 'selected';
}
function curatedPackageCandidates(plugin) {
  if (!plugin) return [];
  const sourcePackage = plugin.pkgs?.[state.source?.id];
  return [...new Set([
    ...(plugin.catalogCandidates || []),
    sourcePackage,
    plugin.pkg,
  ].filter((name) => typeof name === 'string' && /^[A-Za-z0-9_.+@-]+$/.test(name)))];
}
function syncCatalogApplications() {
  if (state.device?.id !== 'catalog-target' || !PLUGINS?.plugins) return;
  for (const plugin of PLUGINS.plugins) {
    const option = curatedMenuOption(plugin);
    if (!option || !catalogUserOverrides.has(option.symbol)) {
      state.sel.delete(plugin.id);
      state.removed.delete(plugin.id);
      continue;
    }
    const value = catalogUserOverrides.get(option.symbol);
    if (value === 'n') {
      state.sel.delete(plugin.id);
      state.removed.add(plugin.id);
    } else {
      state.sel.add(plugin.id);
      state.removed.delete(plugin.id);
    }
  }
}
function reconcileCatalogReadyState() {
  if (state.device?.id === 'catalog-target' && MENU_CATALOG?.menu?.displayLoaded &&
      !catalogUserOverrides.size && !catalogRecommendedValues.size && !catalogImportedSymbols.size) {
    initializeCatalogBaseline();
  }
  syncCatalogApplications();
  renderMenuconfig();
  renderFirmwareSettings();
  renderGroups();
  updateStats();
  renderBuildContract();
  updateSubmitGate();
}
function resetMenuNavigation() {
  menuPath = null;
  menuParent = '';
  menuHistory = [];
  menuBreadcrumb = [];
}
function resetMenuScroll() {
  requestAnimationFrame(() => {
    const scroller = $('menuconfigScroll');
    if (scroller) scroller.scrollTop = 0;
  });
}
function openMenuLevel(path, parent, label) {
  menuHistory.push({ path: menuPath, parent: menuParent, breadcrumb: [...menuBreadcrumb] });
  menuPath = path;
  menuParent = parent;
  if (label && menuBreadcrumb.at(-1) !== label) menuBreadcrumb.push(label);
  menuVisibleLimit = MENU_PAGE_SIZE;
  resetMenuScroll();
}
function openMenuChildren(option) {
  if (!menuChildrenByParent.has(option.symbol)) return;
  openMenuLevel([...(option.path || [])], option.symbol, option.prompt || option.symbol);
}
function menuOptionSelected(option) {
  const value = menuValues.get(option.symbol) ?? simpleKconfigDefault(option);
  return menuTouched.has(option.symbol) || menuImportedNonDefault.has(option.symbol) || value !== 'n';
}
function catalogProtectedSymbols(activeSymbol = '') {
  const protectedSymbols = new Set();
  for (const [symbol, value] of catalogBaselineValues) if (value !== 'n' && value !== '') protectedSymbols.add(symbol);
  for (const [symbol, value] of catalogRecommendedValues) if (value !== 'n' && value !== '') protectedSymbols.add(symbol);
  for (const symbol of catalogImportedSymbols) {
    const value = menuValues.get(symbol) ?? 'n';
    if (value !== 'n' && value !== '') protectedSymbols.add(symbol);
  }
  for (const [symbol, value] of catalogUserOverrides) if (value !== 'n' && value !== '') protectedSymbols.add(symbol);
  if (activeSymbol) protectedSymbols.delete(activeSymbol);
  return protectedSymbols;
}
function catalogPreferredValues() {
  const values = new Map();
  for (const symbol of catalogDependencySymbols) values.set(symbol, catalogInheritedValue(symbol));
  for (const [symbol, value] of catalogUserOverrides) values.set(symbol, value);
  return values;
}
function applyCatalogIntent(option, value, force = false, source = 'user') {
  if (!option) return { changes: [], violations: [] };
  const snapshot = snapshotCatalogUiState();
  const previous = menuValues.get(option.symbol) ?? 'n';
  try {
    const context = catalogValidationContext(menuValues, 'interactive');
    const result = (!CATALOG_MODEL || !CATALOG_ENGINE)
      ? { changes: [{ symbol: option.symbol, from: previous, to: value, reason: 'fallback' }], violations: [] }
      : CATALOG_ENGINE.applyUserIntent(CATALOG_MODEL, context.values, {
        symbol: option.symbol,
        value,
        force,
        dependencySymbols: catalogDependencySymbols,
        protectedSymbols: catalogProtectedSymbols(value === 'n' ? option.symbol : ''),
        preferredValues: catalogPreferredValues(),
        explicitSymbols: catalogUserOverrides.keys(),
        validationOptions: context.validationOptions,
      });
    for (const change of result.changes) {
      menuValues.set(change.symbol, change.to);
      const explicit = change.symbol === option.symbol;
      const conditionalDefault = change.reason === 'conditional-default';
      const changedOption = menuOptionBySymbol.get(change.symbol);
      if (conditionalDefault) {
        menuTouched.delete(change.symbol);
        catalogImportedSymbols.delete(change.symbol);
        catalogDependencySymbols.delete(change.symbol);
        if (change.to === 'n') catalogConditionalDefaultSymbols.delete(change.symbol);
        else catalogConditionalDefaultSymbols.add(change.symbol);
      } else if (source === 'restore' && explicit) {
        if (!catalogRecommendedValues.has(change.symbol) && !catalogImportedSymbols.has(change.symbol)) {
          menuTouched.delete(change.symbol);
        }
      } else {
        menuTouched.add(change.symbol);
      }
      let curatedSource = explicit ? source : 'dependency';
      if (source === 'user' && explicit) {
        const override = CATALOG_ENGINE?.resolveCatalogUserOverride
          ? CATALOG_ENGINE.resolveCatalogUserOverride(catalogInheritedValue(change.symbol), change.to)
          : (catalogInheritedValue(change.symbol) === change.to ? null : change.to);
        if (override === null) {
          catalogUserOverrides.delete(change.symbol);
          if (!catalogRecommendedValues.has(change.symbol) && !catalogImportedSymbols.has(change.symbol)) {
            menuTouched.delete(change.symbol);
          }
          curatedSource = 'restore';
        } else {
          catalogUserOverrides.set(change.symbol, override);
        }
      } else if (source === 'recommended' && explicit) catalogRecommendedValues.set(change.symbol, change.to);
      else if (source === 'imported' && changedOption?.userSettable !== false) {
        catalogImportedSymbols.add(change.symbol);
      }
      if (!conditionalDefault) {
        catalogConditionalDefaultSymbols.delete(change.symbol);
        if (explicit) catalogDependencySymbols.delete(change.symbol);
        else if (change.to === 'n') catalogDependencySymbols.delete(change.symbol);
        else catalogDependencySymbols.add(change.symbol);
      }
      if (!changedOption) continue;
      syncMenuToCurated(changedOption, change.to, curatedSource);
      if (source === 'user' && explicit) syncFirmwareThemeFromMenu(changedOption, change.to);
    }
    if (result.changes.length) markCatalogStateChanged();
    return result;
  } catch (error) {
    restoreCatalogUiState(snapshot);
    throw error;
  }
}
function reconcileImportedConditionalDefaults() {
  if (!CATALOG_MODEL || !CATALOG_ENGINE?.reconcileKconfigDerivedValues) return;
  const context = catalogValidationContext(menuValues, 'interactive');
  const result = CATALOG_ENGINE.reconcileKconfigDerivedValues(
    CATALOG_MODEL, context.values, context.validationOptions);
  const derivedSymbols = result.derivedSymbols || new Set();
  const derivedReasons = result.derivedReasons || new Map();
  for (const change of result.changes) {
    if (!menuOptionBySymbol.has(change.symbol)) continue;
    menuValues.set(change.symbol, change.to);
    if (derivedSymbols.has(change.symbol)) continue;
    if (change.to === 'n') catalogDependencySymbols.delete(change.symbol);
    else catalogDependencySymbols.add(change.symbol);
  }
  for (const symbol of derivedSymbols) {
    if (!menuOptionBySymbol.has(symbol)) continue;
    const value = result.values.get(symbol) ?? 'n';
    menuValues.set(symbol, value);
    catalogImportedSymbols.delete(symbol);
    menuImportedOriginal.delete(symbol);
    menuImportedNonDefault.delete(symbol);
    catalogDependencySymbols.delete(symbol);
    const baseline = catalogBaselineValues.get(symbol) ?? 'n';
    if (value !== 'n' && value !== baseline && derivedReasons.get(symbol) === 'conditional-default') {
      catalogConditionalDefaultSymbols.add(symbol);
    } else {
      catalogConditionalDefaultSymbols.delete(symbol);
      if (value !== 'n' && value !== baseline && ['select', 'imply'].includes(derivedReasons.get(symbol))) {
        catalogDependencySymbols.add(symbol);
      }
    }
  }
}
function normalizeKconfigValueByType(rawValue, type = 'bool', symbol = 'Kconfig option') {
  const raw = String(rawValue ?? '');
  const normalizedType = String(type || 'bool').toLowerCase();
  if (normalizedType === 'bool') {
    if (!['y', 'n'].includes(raw)) throw new Error(`${symbol} requires a bool value: y or n.`);
    return raw;
  }
  if (normalizedType === 'tristate') {
    if (!['y', 'm', 'n'].includes(raw)) {
      throw new Error(`${symbol} requires a tristate value: y, m, or n.`);
    }
    return raw;
  }
  if (normalizedType === 'string') return raw;
  const value = raw.trim();
  if (normalizedType === 'int') {
    if (!/^-?\d+$/.test(value)) throw new Error(`${symbol} requires an integer value.`);
    return value;
  }
  if (normalizedType === 'hex') {
    if (!/^0[xX][0-9a-fA-F]+$/.test(value)) {
      throw new Error(`${symbol} requires a hexadecimal value such as 0x20.`);
    }
    return value;
  }
  throw new Error(`${symbol} has an unsupported Kconfig type: ${normalizedType || '(empty)'}.`);
}
function scalarKconfigOption(option) {
  return ['string', 'int', 'hex'].includes(option?.type);
}
function normalizeScalarKconfigValue(option, rawValue) {
  if (!scalarKconfigOption(option)) {
    throw new Error(`${option?.symbol || 'Kconfig option'} is not a scalar option.`);
  }
  return normalizeKconfigValueByType(rawValue, option.type, option.symbol);
}
function applyScalarMenuValue(option, rawValue, source = 'user') {
  const value = normalizeScalarKconfigValue(option, rawValue);
  const previous = menuValues.get(option.symbol) ?? simpleKconfigDefault(option);
  menuValues.set(option.symbol, value);
  if (source === 'restore') {
    if (!catalogRecommendedValues.has(option.symbol) && !catalogImportedSymbols.has(option.symbol)) {
      menuTouched.delete(option.symbol);
    }
  } else {
    menuTouched.add(option.symbol);
  }
  if (source === 'user') catalogUserOverrides.set(option.symbol, value);
  else if (source === 'recommended') catalogRecommendedValues.set(option.symbol, value);
  else if (source === 'imported') catalogImportedSymbols.add(option.symbol);
  catalogDependencySymbols.delete(option.symbol);
  if (previous !== value) markCatalogStateChanged();
  return {
    changes: previous === value ? [] : [{ symbol: option.symbol, from: previous, to: value, reason: 'scalar' }],
    violations: [],
  };
}
function applyMenuValue(option, value, force = false, source = 'user') {
  if (scalarKconfigOption(option) && option.userSettable === false && force !== true) {
    const error = new Error(`${option.symbol} is read-only because userSettable=false`);
    error.name = 'CatalogIntentError';
    throw error;
  }
  return scalarKconfigOption(option)
    ? applyScalarMenuValue(option, value, source)
    : applyCatalogIntent(option, value, force, source);
}
function catalogConflictRecordForPackage(name) {
  return CATALOG_MODEL?.byPackage?.get(String(name || '')) || null;
}
function catalogConflictRows(option, requestedValue, violations) {
  const symbols = new Set([option.symbol]);
  for (const violation of violations || []) {
    if (violation.code === 'package-conflict') {
      const left = catalogConflictRecordForPackage(violation.package);
      const right = catalogConflictRecordForPackage(violation.otherPackage);
      if (left?.configSymbol) symbols.add(left.configSymbol);
      if (right?.configSymbol) symbols.add(right.configSymbol);
    } else if (violation.code === 'choice-conflict') {
      for (const symbol of violation.symbols || []) symbols.add(symbol);
    }
  }
  return [...symbols].slice(0, 18).map((symbol) => {
    const record = CATALOG_MODEL?.bySymbol?.get(symbol);
    const menuOption = menuOptionBySymbol.get(symbol);
    if (!record || !menuOption) return null;
    return {
      symbol,
      record,
      option: menuOption,
      label: record.package || symbol.replace(/^PACKAGE_/, ''),
      requested: symbol === option.symbol ? requestedValue : null,
    };
  }).filter(Boolean);
}
function catalogConflictPlanInvalid(plan, violations) {
  for (const violation of violations || []) {
    if (violation.code === 'package-conflict') {
      const left = catalogConflictRecordForPackage(violation.package)?.configSymbol;
      const right = catalogConflictRecordForPackage(violation.otherPackage)?.configSymbol;
      if (left && right && (plan.get(left) || 'n') !== 'n' && (plan.get(right) || 'n') !== 'n') return true;
    }
    if (violation.code === 'choice-conflict') {
      const enabled = (violation.symbols || []).filter((symbol) => (plan.get(symbol) || 'n') !== 'n');
      if (enabled.length > 1) return true;
    }
  }
  return false;
}
function snapshotCatalogUiState() {
  return {
    values: new Map(menuValues), touched: new Set(menuTouched), selected: new Set(state.sel),
    removed: new Set(state.removed), dependencies: new Set(catalogDependencySymbols),
    conditionalDefaults: new Set(catalogConditionalDefaultSymbols),
    userOverrides: new Map(catalogUserOverrides), recommended: new Map(catalogRecommendedValues),
    imported: new Set(catalogImportedSymbols), theme: state.theme,
    revision: catalogStateRevision,
    compatibilityAcknowledgement: UI_SESSION.compatibility.getAcknowledgement(),
  };
}
function restoreMap(target, source) {
  target.clear();
  for (const [key, value] of source) target.set(key, value);
}
function restoreSet(target, source) {
  target.clear();
  for (const value of source) target.add(value);
}
function restoreCatalogUiState(snapshot) {
  restoreMap(menuValues, snapshot.values);
  restoreSet(menuTouched, snapshot.touched);
  restoreSet(state.sel, snapshot.selected);
  restoreSet(state.removed, snapshot.removed);
  restoreSet(catalogDependencySymbols, snapshot.dependencies);
  restoreSet(catalogConditionalDefaultSymbols, snapshot.conditionalDefaults);
  restoreMap(catalogUserOverrides, snapshot.userOverrides);
  restoreMap(catalogRecommendedValues, snapshot.recommended);
  restoreSet(catalogImportedSymbols, snapshot.imported);
  state.theme = snapshot.theme;
  catalogStateRevision = snapshot.revision;
  UI_SESSION.compatibility.setAcknowledgement(snapshot.compatibilityAcknowledgement);
  clearCatalogDerivedCaches();
}
function renderCatalogUiAfterIntent(openChildren = false, option = null, value = 'n') {
  if (openChildren && value !== 'n' && option) openMenuChildren(option);
  renderMenuconfig();
  renderFirmwareSettings();
  renderGroups();
  updateStats();
  renderBuildContract();
  updateSubmitGate();
}
function openCatalogConflictModal(option, value, violations, openChildren = false) {
  const rows = catalogConflictRows(option, value, violations);
  if (rows.length < 2) return false;
  const plan = new Map(rows.map((row) => [row.symbol, menuValues.get(row.symbol) ?? 'n']));
  for (const row of rows) {
    if (row.symbol !== option.symbol && row.record.canDisable) plan.set(row.symbol, 'n');
  }
  plan.set(option.symbol, value);

  modalCancelHandler = null;
  openModal(uiText('软件包冲突', '套件衝突', 'Package conflict'));
  const modal = $('modal').querySelector('.modal');
  modal.classList.remove('modal-wide', 'modal-import-source', 'recommended-config',
    'profile-package-config', 'generation-error', 'catalog-conflict', 'rootfs-guidance');
  modal.classList.add('catalog-conflict');
  const body = $('modalBody');
  body.textContent = '';
  const copy = document.createElement('p');
  copy.className = 'catalog-conflict-copy';
  copy.textContent = uiText(
    `${rows[0].label} 与当前选项冲突。请选择最终 N/M/Y；冲突项不能同时启用。`,
    `${rows[0].label} 與目前選項衝突。請選擇最終 N/M/Y；衝突項不能同時啟用。`,
    `${rows[0].label} conflicts with the current selection. Choose the final N/M/Y states; conflicting items cannot remain enabled together.`);
  body.appendChild(copy);
  const list = document.createElement('div');
  list.className = 'catalog-conflict-list';
  const warning = document.createElement('p');
  warning.className = 'catalog-conflict-warning';
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn';
  cancel.textContent = t('btn.close');
  cancel.onclick = closeModal;
  const apply = document.createElement('button');
  apply.type = 'button';
  apply.className = 'btn btn-primary';
  apply.textContent = uiText('应用切换', '套用切換', 'Apply switch');
  const refresh = () => {
    const context = catalogValidationContext(menuValues, 'interactive');
    const values = new Map(context.values);
    for (const [symbol, stateValue] of plan) values.set(symbol, stateValue);
    const constraintsBySymbol = new Map(rows.map((row) => [row.symbol,
      CATALOG_ENGINE.kconfigStateConstraints(CATALOG_MODEL, row.record, values, context.validationOptions)]));
    const stateInvalid = rows.some((row) => {
      const constraints = constraintsBySymbol.get(row.symbol);
      const stateRow = constraints.states.find((item) => item.value === plan.get(row.symbol));
      return !stateRow?.selectable && !(stateRow?.current && stateRow?.locked);
    });
    const conflictInvalid = catalogConflictPlanInvalid(plan, violations);
    const invalid = stateInvalid || conflictInvalid;
    warning.textContent = stateInvalid ? uiText(
      '所选状态不符合当前 Kconfig 依赖。', '所選狀態不符合目前 Kconfig 相依性。',
      'The selected states do not satisfy the current Kconfig dependencies.') : conflictInvalid ? uiText(
        '冲突的软件包不能同时为 M 或 Y。', '衝突的套件不能同時為 M 或 Y。',
        'Conflicting packages cannot both remain M or Y.') : '';
    apply.disabled = invalid;
    list.querySelectorAll('.catalog-conflict-row').forEach((line) => {
      const activeValue = plan.get(line.dataset.symbol) || 'n';
      line.classList.toggle('is-invalid', invalid && activeValue !== 'n');
      line.querySelectorAll('button[data-value]').forEach((button) => {
        const active = activeValue === button.dataset.value;
        const row = rows.find((item) => item.symbol === line.dataset.symbol);
        const constraints = constraintsBySymbol.get(line.dataset.symbol);
        const stateRow = constraints.states.find((item) => item.value === button.dataset.value);
        button.classList.toggle('is-current', active);
        button.classList.toggle('is-editable', Boolean(stateRow?.selectable));
        button.classList.toggle('is-disabled', !stateRow?.selectable);
        button.classList.toggle('is-locked', Boolean(active && stateRow?.locked));
        button.setAttribute('aria-disabled', String(!stateRow?.selectable));
        bindKconfigConstraintTooltip(button, row.option, button.dataset.value, constraints);
      });
    });
  };

  for (const row of rows) {
    const line = document.createElement('div');
    line.className = 'catalog-conflict-row';
    line.dataset.symbol = row.symbol;
    const name = document.createElement('code');
    name.textContent = row.label;
    bindUiTooltipContent(name, {
      body: row.symbol.startsWith('PACKAGE_') ? `CONFIG_${row.symbol}` : row.symbol,
    });
    const stateBox = document.createElement('span');
    stateBox.className = 'catalog-conflict-state';
    for (const stateValue of ['n', 'm', 'y']) {
      if (row.record.type === 'bool' && stateValue === 'm') {
        const spacer = document.createElement('span');
        spacer.className = 'kconfig-state-spacer';
        spacer.setAttribute('aria-hidden', 'true');
        stateBox.appendChild(spacer);
        continue;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.value = stateValue;
      button.textContent = stateValue.toUpperCase();
      button.className = 'kconfig-state';
      button.onclick = (event) => {
        if (button.getAttribute('aria-disabled') === 'true') {
          showDatasetTooltip(button, event);
          return;
        }
        plan.set(row.symbol, stateValue);
        refresh();
      };
      stateBox.appendChild(button);
    }
    line.append(name, stateBox);
    list.appendChild(line);
  }
  body.append(list, warning);
  actions.append(cancel, apply);
  body.appendChild(actions);
  apply.onclick = () => {
    if (catalogConflictPlanInvalid(plan, violations)) return;
    const snapshot = snapshotCatalogUiState();
    try {
      for (const row of rows) {
        if ((plan.get(row.symbol) || 'n') === 'n') applyCatalogIntent(row.option, 'n', false, 'user');
      }
      for (const row of rows) {
        const next = plan.get(row.symbol) || 'n';
        if (next !== 'n') applyCatalogIntent(row.option, next, false, 'user');
      }
      modalCancelHandler = null;
      closeModal();
      renderCatalogUiAfterIntent(openChildren, option, plan.get(option.symbol) || 'n');
    } catch (error) {
      restoreCatalogUiState(snapshot);
      warning.textContent = String(error?.message || error).split(';')[0];
      apply.disabled = false;
    }
  };
  refresh();
  return true;
}

function compatibilityContext() {
  const catalog = catalogValidationContext(menuValues, 'interactive');
  return {
    sourceId: state.source?.id || selectedCatalogSource()?.id || '',
    branchName: state.version?.branch || selectedCatalogBranch()?.branch || '',
    values: catalog.values,
    validationOptions: catalog.validationOptions,
  };
}

function evaluateLoadedCompatibility(loaded) {
  const context = compatibilityContext();
  const evaluation = CATALOG_ENGINE.evaluateCompatibilityRules(
    CATALOG_MODEL, loaded.compatibility, context.values, context,
  );
  return { loaded, context, ...evaluation };
}

async function loadCompatibilityEvaluation(forceRefresh = false) {
  if (!CATALOG_LOADER || !CATALOG_MODEL || !MENU_CATALOG) {
    throw new Error(uiText(
      'Catalog 尚未加载完成，不能执行兼容性检查。',
      'Catalog 尚未載入完成，不能執行相容性檢查。',
      'Catalog has not finished loading; compatibility cannot be checked.'));
  }
  const loaded = await CATALOG_LOADER.fetchCompatibility({ forceRefresh });
  return evaluateLoadedCompatibility(loaded);
}

async function runCatalogTaskQueue(names, tasks, concurrency, catalogKey = '', phase = 'idle') {
  const queue = names.map((name) => ({ name, task: tasks[name] })).filter((item) => item.task);
  const workerCount = Math.max(1, Math.min(queue.length || 1, Number(concurrency) || 1));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (queue.length) {
      if (catalogKey && menuCatalogKey !== catalogKey) return;
      const item = queue.shift();
      try { await item.task(); }
      catch (error) { console.warn(`[Catalog ${phase} task: ${item.name}]`, error); }
    }
  }));
}

function scheduleCatalogIdlePrefetch() {
  clearTimeout(compatibilityPrefetchTimer);
  const catalogKey = menuCatalogKey;
  const tasks = {
    applications: ensureCatalogApplications,
    hidden: ensureCatalogHiddenLoaded,
    help: ensureCatalogHelpLoaded,
    compatibility: () => CATALOG_LOADER?.fetchCompatibility(),
  };
  const names = PROJECT?.catalogLoadPolicy?.idle ||
    ['applications', 'hidden', 'help', 'compatibility'];
  const delay = Math.max(0, Math.min(60000, Number(PROJECT?.catalogLoadPolicy?.idleDelayMs) || 15000));
  compatibilityPrefetchTimer = setTimeout(() => {
    const run = () => runCatalogTaskQueue(names, tasks,
      PROJECT?.catalogLoadPolicy?.idleConcurrency || 1, catalogKey, 'idle');
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => { run(); }, { timeout: 5000 });
    else setTimeout(() => { run(); }, 0);
  }, delay);
}

function compatibilitySignature(evaluation) {
  return CATALOG_ENGINE.compatibilityAcknowledgementKey({
    sha256: evaluation.loaded.hash,
    dataRef: evaluation.loaded.dataRef || MENU_CATALOG_DATA_REF,
    sourceId: evaluation.context.sourceId,
    branchName: evaluation.context.branchName,
    revision: catalogStateRevision,
    ruleIds: evaluation.warnings.map((warning) => warning.rule.id),
  });
}

function forcedCompatibilityAudit(evaluation, forced) {
  const ruleIds = [...forced].sort();
  if (!ruleIds.length) return null;
  return {
    sha256: evaluation.loaded.hash,
    source: evaluation.context.sourceId,
    branch: evaluation.context.branchName,
    forced: ruleIds,
  };
}

function compatibilityRuleStillActive(loaded, ruleId) {
  return evaluateLoadedCompatibility(loaded).warnings.some((warning) => warning.rule.id === ruleId);
}

async function ensureCompatibilityRules() {
  let evaluation = await loadCompatibilityEvaluation();
  if (!evaluation.warnings.length) return null;
  const signature = compatibilitySignature(evaluation);
  const acknowledged = UI_SESSION.compatibility.getAcknowledgement();
  if (acknowledged?.signature === signature) return acknowledged.audit;
  const forced = new Set();
  const remembered = new Set();
  while (true) {
    evaluation = evaluateLoadedCompatibility(evaluation.loaded);
    const pending = evaluation.warnings.filter((warning) => !forced.has(warning.rule.id));
    if (!pending.length) {
      const audit = forcedCompatibilityAudit(evaluation, forced);
      if (audit && forced.size && remembered.size === forced.size) {
        UI_SESSION.compatibility.setAcknowledgement({
          signature: compatibilitySignature(evaluation), audit,
        });
      } else {
        UI_SESSION.compatibility.clearAcknowledgement();
      }
      return audit;
    }
    const warning = pending[0];
    const plans = CATALOG_ENGINE.deriveCompatibilityPlans(
      CATALOG_MODEL, warning.values, warning, {
        dependencySymbols: catalogDependencySymbols,
        protectedSymbols: catalogProtectedSymbols(),
        validationOptions: evaluation.context.validationOptions,
      },
    );
    const action = await openCompatibilityWarningModal(evaluation, warning, plans);
    if (action === 'cancel') {
      const error = new Error('Compatibility check cancelled');
      error.name = 'CompatibilityCancelledError';
      throw error;
    }
    if (action === 'forced' || action === 'forced-remember') {
      forced.add(warning.rule.id);
      if (action === 'forced-remember') remembered.add(warning.rule.id);
      else remembered.delete(warning.rule.id);
    } else {
      forced.clear();
      remembered.clear();
    }
  }
}

function openCompatibilityWarningModal(evaluation, warning, plans) {
  return new Promise((resolve) => {
    const rows = warning.records.map((record) => ({
      record,
      option: menuOptionBySymbol.get(record.configSymbol) || { symbol: record.configSymbol },
      value: warning.values.get(record.configSymbol) ?? 'n',
    }));
    const custom = new Map(rows.map((row) => [row.record.configSymbol, row.value]));
    let customBaseValues = new Map(warning.values);
    let settled = false;
    let recommendationApplied = false;
    const finish = (action) => {
      if (settled) return;
      settled = true;
      modalCancelHandler = null;
      closeModal();
      resolve(action);
    };
    const cancel = () => {
      if (settled) return;
      settled = true;
      resolve(recommendationApplied ? 'applied' : 'cancel');
    };
    const applyAndVerify = (applyPlan, { keepOpen = false } = {}) => {
      const snapshot = snapshotCatalogUiState();
      try {
        applyPlan();
        if (compatibilityRuleStillActive(evaluation.loaded, warning.rule.id)) {
          throw new Error(uiText(
            '所选方案没有解除当前规则。', '所選方案沒有解除目前規則。',
            'The selected plan did not resolve the active rule.'));
        }
        renderCatalogUiAfterIntent();
        if (!keepOpen) {
          finish('applied');
          return;
        }
        recommendationApplied = true;
        const current = evaluateLoadedCompatibility(evaluation.loaded);
        customBaseValues = new Map(current.values);
        for (const row of rows) {
          custom.set(row.record.configSymbol, current.values.get(row.record.configSymbol) ?? 'n');
        }
        renderChoice();
      } catch (error) {
        restoreCatalogUiState(snapshot);
        const warningText = $('modalBody').querySelector('.catalog-conflict-warning');
        if (warningText) warningText.textContent = String(error?.message || error).split(';')[0];
      }
    };

    const renderModalShell = (title) => {
      if ($('modal').hidden) openModal(title);
      else {
        $('modalTitle').textContent = title;
        $('modalClose').focus();
      }
      const modal = $('modal').querySelector('.modal');
      modal.classList.remove('modal-wide', 'modal-import-source', 'recommended-config',
        'profile-package-config', 'generation-error', 'catalog-conflict', 'compatibility-warning',
        'rootfs-guidance');
      modal.classList.add('catalog-conflict', 'compatibility-warning');
      const body = $('modalBody');
      body.textContent = '';
      return body;
    };

    const appendCompatibilitySummary = (body, { confirmation = false } = {}) => {
      const ownership = warning.rule.issue === 'file-ownership';
      const card = document.createElement('section');
      card.className = `compatibility-summary${confirmation ? ' is-confirmation' : ''}`;
      const heading = document.createElement('h4');
      heading.className = 'compatibility-summary-title';
      heading.textContent = confirmation ? uiText(
        '当前冲突不会被修复', '目前衝突不會被修復', 'The current conflict will not be resolved') : uiText(
        '检测到软件包文件冲突', '偵測到套件檔案衝突', 'Package file conflict detected');
      if (!ownership) {
        heading.textContent = confirmation ? uiText(
          '当前兼容性问题不会被解决', '目前相容性問題不會被解決',
          'The current compatibility issue will not be resolved') : uiText(
          '检测到已知构建失败', '偵測到已知建置失敗', 'Known build failure detected');
      }
      const copy = document.createElement('p');
      copy.className = 'compatibility-summary-copy';
      copy.textContent = confirmation ? uiText(
        '继续构建可能失败。只有确认接受这个风险后才能继续。',
        '繼續建置可能失敗。只有確認接受這個風險後才能繼續。',
        'The build may fail. Continue only after accepting this risk.') : uiText(
        '以下软件包会写入同一个文件，继续构建可能失败。请选择一种处理方式。',
        '以下套件會寫入同一個檔案，繼續建置可能失敗。請選擇一種處理方式。',
        'The packages below write the same file, so the build may fail. Choose how to proceed.');
      if (!ownership) {
        copy.textContent = confirmation ? uiText(
          '你选择保留已知失败的配置，构建仍可能失败。确认接受风险后才能继续。',
          '你選擇保留已知失敗的設定，建置仍可能失敗。確認接受風險後才能繼續。',
          'You are keeping a selection known to fail; the build may still fail. Continue only after accepting the risk.') : uiText(
          '真实构建证据已确认以下选择会失败。请选择一种处理方式。',
          '真實建置證據已確認以下選擇會失敗。請選擇一種處理方式。',
          'Real build evidence confirms that the selection below fails. Choose how to proceed.');
      }
      const pathLabel = document.createElement('span');
      pathLabel.className = 'compatibility-path-label';
      pathLabel.textContent = uiText('冲突文件', '衝突檔案', 'Conflicting file');
      if (!ownership) pathLabel.textContent = uiText('问题类型', '問題類型', 'Issue type');
      const summaryLine = document.createElement('div');
      summaryLine.className = 'compatibility-info-line';
      const paths = document.createElement('div');
      paths.className = 'compatibility-paths';
      for (const path of warning.rule.paths || []) {
        const code = document.createElement('code');
        code.textContent = path;
        paths.appendChild(code);
      }
      if (!ownership) {
        const code = document.createElement('code');
        code.textContent = uiText('已知构建失败', '已知建置失敗', 'Known build failure');
        paths.appendChild(code);
      }
      const metadata = document.createElement('p');
      metadata.className = 'compatibility-evidence';
      metadata.textContent = [
        `${uiText('规则', '規則', 'Rule')} ${warning.rule.id}`,
        `${uiText('构建证据', '建置證據', 'Build evidence')} ${warning.rule.refs.join(' · ')}`,
      ].join(' · ');
      summaryLine.append(pathLabel, metadata);
      card.append(heading, copy, summaryLine, paths);
      body.appendChild(card);
    };

    let renderChoice;
    const renderForceConfirmation = () => {
      modalCancelHandler = renderChoice;
      const body = renderModalShell(uiText('确认强制继续', '確認強制繼續', 'Confirm force continuation'));
      appendCompatibilitySummary(body, { confirmation: true });
      const actions = UI_COMPONENTS.createUiActionRow(
        'modal-actions compatibility-actions compatibility-confirm-actions');
      const { root: rememberChoice, input: rememberInput } = UI_COMPONENTS.createUiCheckboxControl({
        className: 'compatibility-remember',
        label: uiText('记住选择', '記住選擇', 'Remember choice'),
        checked: false,
        tooltipTitle: uiText('记住选择', '記住選擇', 'Remember choice'),
        tooltipBody: uiText(
          '仅当前页面有效；刷新或重新打开网页、清除站点数据后失效。',
          '僅目前頁面有效；重新整理或重新開啟網頁、清除網站資料後失效。',
          'Valid only on this page. Refreshing or reopening the page, or clearing site data, resets it.'),
      });
      const backButton = UI_COMPONENTS.createUiButton({
        text: uiText('返回修改', '返回修改', 'Back to edit'),
        className: 'btn compatibility-close',
        onClick: renderChoice,
      });
      const confirmForceButton = UI_COMPONENTS.createUiButton({
        text: uiText('确认强制继续', '確認強制繼續', 'Confirm and force'),
        className: 'btn compatibility-force-confirm',
        onClick: () => finish(rememberInput.checked ? 'forced-remember' : 'forced'),
      });
      actions.append(rememberChoice, backButton, confirmForceButton);
      body.appendChild(actions);
    };

    renderChoice = () => {
      modalCancelHandler = cancel;
      const body = renderModalShell(uiText(
        '构建兼容性提示', '建置相容性提示', 'Build compatibility warning'));
      appendCompatibilitySummary(body);
      const list = document.createElement('div');
      list.className = 'catalog-conflict-list';
      const warningText = document.createElement('p');
      warningText.className = 'catalog-conflict-warning';
      let customInvalid = true;
      let customButton = null;
      const rowBySymbol = new Map(rows.map((row) => [row.record.configSymbol, row]));
      const refresh = () => {
        const values = new Map(customBaseValues);
        for (const [symbol, value] of custom) values.set(symbol, value);
        const constraintsBySymbol = new Map(rows.map((row) => [row.record.configSymbol,
          CATALOG_ENGINE.kconfigStateConstraints(CATALOG_MODEL, row.record, values,
            evaluation.context.validationOptions)]));
        try {
          const compatibilityInvalid = CATALOG_ENGINE.evaluateCompatibilityRules(CATALOG_MODEL, {
            schema: 2, rules: [warning.rule],
          }, values, evaluation.context).warnings.length > 0;
          const stateInvalid = rows.some((row) => {
            const constraints = constraintsBySymbol.get(row.record.configSymbol);
            const stateRow = constraints.states.find((item) =>
              item.value === custom.get(row.record.configSymbol));
            return !stateRow?.selectable && !(stateRow?.current && stateRow?.locked);
          });
          customInvalid = compatibilityInvalid || stateInvalid;
          warningText.textContent = stateInvalid ? uiText(
            '自定义状态不符合当前 Kconfig 约束；请先按悬浮提示解除 select 或依赖限制。',
            '自訂狀態不符合目前 Kconfig 約束；請先依懸浮提示解除 select 或相依限制。',
            'The custom states violate active Kconfig constraints. Follow the state hint to release select/dependency limits.') : compatibilityInvalid ? uiText(
            '自定义状态仍会触发本规则，请至少关闭一个相关软件包。',
            '自訂狀態仍會觸發本規則，請至少關閉一個相關套件。',
            'The custom states still trigger this rule; disable at least one related package.') : '';
        } catch (error) {
          customInvalid = true;
          warningText.textContent = error.message;
        }
        list.querySelectorAll('.catalog-conflict-row').forEach((line) => {
          const row = rowBySymbol.get(line.dataset.symbol);
          const constraints = constraintsBySymbol.get(row.record.configSymbol);
          line.querySelectorAll('button[data-value]').forEach((button) => {
            const active = custom.get(line.dataset.symbol) === button.dataset.value;
            const stateRow = constraints.states.find((item) => item.value === button.dataset.value);
            button.classList.toggle('is-current', active);
            button.classList.toggle('is-editable', Boolean(stateRow?.selectable));
            button.classList.toggle('is-disabled', !stateRow?.selectable);
            button.classList.toggle('is-locked', Boolean(active && stateRow?.locked));
            button.setAttribute('aria-disabled', String(!stateRow?.selectable));
            bindKconfigConstraintTooltip(button, row.option, button.dataset.value, constraints);
          });
        });
        if (customButton) customButton.disabled = customInvalid;
      };
      for (const row of rows) {
        const line = document.createElement('div');
        line.className = 'catalog-conflict-row';
        line.dataset.symbol = row.record.configSymbol;
        const name = document.createElement('code');
        name.textContent = row.record.package || row.record.configSymbol;
        bindUiTooltipContent(name, { body: `CONFIG_${row.record.configSymbol}` });
        const stateBox = document.createElement('span');
        stateBox.className = 'catalog-conflict-state';
        for (const stateValue of ['n', 'm', 'y']) {
          if (row.record.type === 'bool' && stateValue === 'm') {
            const spacer = document.createElement('span');
            spacer.className = 'kconfig-state-spacer';
            spacer.setAttribute('aria-hidden', 'true');
            stateBox.appendChild(spacer);
            continue;
          }
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'kconfig-state';
          button.dataset.value = stateValue;
          button.textContent = stateValue.toUpperCase();
          button.onclick = (event) => {
            if (button.getAttribute('aria-disabled') === 'true') {
              showDatasetTooltip(button, event);
              return;
            }
            if (custom.get(row.record.configSymbol) === stateValue) return;
            custom.set(row.record.configSymbol, stateValue);
            if (recommendationApplied) {
              recommendationApplied = false;
              renderChoice();
              return;
            }
            refresh();
          };
          stateBox.appendChild(button);
        }
        line.append(name, stateBox);
        list.appendChild(line);
      }
      body.append(list, warningText);
      const recommendation = document.createElement('section');
      recommendation.className = `compatibility-recommendation${plans.recommended ? '' : ' is-unavailable'}${recommendationApplied ? ' is-applied' : ''}`;
      const recommendationHeader = document.createElement('div');
      recommendationHeader.className = 'compatibility-recommendation-header';
      const recommendationTitle = document.createElement('strong');
      recommendationTitle.className = 'compatibility-recommendation-title';
      recommendationTitle.textContent = recommendationApplied
        ? uiText('推荐方案已应用', '推薦方案已套用', 'Recommended plan applied')
        : uiText('推荐方案', '推薦方案', 'Recommended plan');
      const recommendationSteps = plans.recommended?.steps?.length
        ? plans.recommended.steps
        : plans.recommended ? [{ symbol: plans.recommended.symbol, package: plans.recommended.package, value: 'n' }] : [];
      const recommendationStepNames = recommendationSteps.map((step) =>
        step.package || String(step.symbol || '').replace(/^PACKAGE_/, '')).filter(Boolean);
      const automaticChangeNames = (plans.recommended?.automaticChanges || [])
        .filter((change) => change.to === 'n')
        .map((change) => String(change.symbol || '').replace(/^PACKAGE_/, '')).filter(Boolean);
      const recommendationAction = document.createElement('span');
      recommendationAction.className = 'compatibility-recommendation-action';
      recommendationAction.textContent = plans.recommended ? (recommendationStepNames.length > 1 ? uiText(
        `按顺序取消：${recommendationStepNames.join(' → ')}`,
        `依序取消：${recommendationStepNames.join(' → ')}`,
        `Disable in order: ${recommendationStepNames.join(' → ')}`) : uiText(
        `关闭 ${recommendationStepNames[0] || plans.recommended.package}`,
        `關閉 ${recommendationStepNames[0] || plans.recommended.package}`,
        `Disable ${recommendationStepNames[0] || plans.recommended.package}`)) : uiText(
        '当前没有唯一推荐方案', '目前沒有唯一推薦方案', 'No unique recommended plan is available');
      const recommendationDetail = document.createElement('small');
      recommendationDetail.className = 'compatibility-recommendation-detail';
      const automaticDetail = automaticChangeNames.length ? uiText(
        `；自动联动：${automaticChangeNames.join('、')}`,
        `；自動連動：${automaticChangeNames.join('、')}`,
        `; automatic linkage: ${automaticChangeNames.join(', ')}`) : '';
      recommendationDetail.textContent = recommendationApplied ? uiText(
        '配置已更新，请检查上方状态；关闭窗口后继续。',
        '設定已更新，請檢查上方狀態；關閉視窗後繼續。',
        'The configuration is updated. Review the states above, then close this dialog to continue.') : plans.recommended ? `${uiText(
        `预计调整 ${plans.recommended.cost} 个相关配置项`,
        `預計調整 ${plans.recommended.cost} 個相關設定項`,
        `Estimated changes: ${plans.recommended.cost} related settings`)}${automaticDetail}` : uiText(
        '请在上方自定义 N/M/Y，或确认风险后强制继续。',
        '請在上方自訂 N/M/Y，或確認風險後強制繼續。',
        'Choose custom N/M/Y states above, or confirm the risk before forcing continuation.');
      recommendationHeader.append(recommendationTitle, recommendationDetail);
      recommendation.append(recommendationHeader, recommendationAction);
      body.appendChild(recommendation);

      const actions = document.createElement('div');
      actions.className = 'modal-actions compatibility-actions';
      const recommendedButton = document.createElement('button');
      recommendedButton.type = 'button';
      recommendedButton.className = 'btn btn-primary compatibility-recommended';
      recommendedButton.textContent = recommendationApplied
        ? uiText('已应用', '已套用', 'Applied')
        : uiText('推荐方案', '推薦方案', 'Recommended plan');
      recommendedButton.disabled = !plans.recommended || recommendationApplied;
      recommendedButton.onclick = () => applyAndVerify(() => {
        for (const step of recommendationSteps) {
          const value = step.value || 'n';
          if ((menuValues.get(step.symbol) ?? 'n') === value) continue;
          applyCatalogIntent(menuOptionBySymbol.get(step.symbol) || { symbol: step.symbol },
            value, false, 'user');
        }
      }, { keepOpen: true });
      customButton = document.createElement('button');
      customButton.type = 'button';
      customButton.className = 'btn compatibility-custom';
      customButton.textContent = uiText('应用自定义 N/M/Y', '套用自訂 N/M/Y', 'Apply custom N/M/Y');
      customButton.onclick = () => applyAndVerify(() => {
        for (const row of rows) {
          if ((custom.get(row.record.configSymbol) || 'n') === 'n') {
            applyCatalogIntent(row.option, 'n', false, 'user');
          }
        }
        for (const row of rows) {
          const value = custom.get(row.record.configSymbol) || 'n';
          if (value !== 'n') applyCatalogIntent(row.option, value, false, 'user');
        }
      });
      const forceButton = document.createElement('button');
      forceButton.type = 'button';
      forceButton.className = 'btn compatibility-force';
      forceButton.textContent = uiText('保留并强制继续', '保留並強制繼續', 'Keep and force');
      forceButton.disabled = recommendationApplied;
      forceButton.onclick = renderForceConfirmation;
      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'btn compatibility-close';
      cancelButton.textContent = t('btn.close');
      cancelButton.onclick = closeModal;
      const actionsSpacer = document.createElement('span');
      actionsSpacer.className = 'compatibility-actions-spacer';
      actionsSpacer.setAttribute('aria-hidden', 'true');
      actions.append(forceButton, customButton, actionsSpacer, cancelButton, recommendedButton);
      body.appendChild(actions);
      refresh();
    };
    renderChoice();
  });
}

function setMenuValue(option, value, openChildren = false) {
  try {
    applyMenuValue(option, value, false);
  } catch (error) {
    const violations = Array.isArray(error?.violations) ? error.violations : [];
    if (violations.some((item) => item.code === 'package-conflict' || item.code === 'choice-conflict') &&
        openCatalogConflictModal(option, value, violations, false)) return false;
    const first = String(error?.message || error).split(';')[0];
    showToast(first.length > 240 ? `${first.slice(0, 237)}…` : first);
    return false;
  }
  const renderedValue = menuValues.get(option.symbol) ?? simpleKconfigDefault(option);
  renderCatalogUiAfterIntent(openChildren && renderedValue !== 'n', option, renderedValue);
  return true;
}
function initDefconfig() {
  const toggle = $('defconfigToggle');
  if (!toggle) return;
  toggle.onchange = () => { state.useDefconfig = toggle.checked; updateSubmitGate(); };
  toggle.checked = state.useDefconfig;
}
function applyMenuconfigExpandedState(expanded) {
  menuExpanded = Boolean(expanded);
  $('menuconfigToggle').setAttribute('aria-expanded', String(menuExpanded));
  $('menuconfigBody').hidden = !menuExpanded;
}
async function setMenuconfigExpanded(expanded) {
  const request = ++menuExpansionRequest;
  applyMenuconfigExpandedState(expanded);
  if (!menuExpanded) return true;
  try {
    await ensureCatalogMenuLoaded(false);
    if (request !== menuExpansionRequest || !menuExpanded) return false;
    renderMenuconfig();
    return true;
  } catch (error) {
    if (request !== menuExpansionRequest) return false;
    applyMenuconfigExpandedState(false);
    showToast(error.message);
    return false;
  }
}
function initMenuconfigControls() {
  $('menuconfigToggle').onclick = () => setMenuconfigExpanded(!menuExpanded);
  $('menuconfigBack').onclick = () => {
    if ($('menuconfigBack').disabled) return;
    const previous = menuHistory.pop();
    if (previous) {
      menuPath = previous.path;
      menuParent = previous.parent;
      menuBreadcrumb = previous.breadcrumb;
    } else {
      resetMenuNavigation();
    }
    menuVisibleLimit = MENU_PAGE_SIZE;
    resetMenuScroll();
    renderMenuconfig();
  };
  $('menuconfigSelectedToggle').onclick = () => {
    menuSelectedExpanded = !menuSelectedExpanded;
    renderMenuconfig();
  };
  let searchTimer = 0;
  $('menuconfigSearch').oninput = () => {
    const immediateQuery = normalizeMenuSearchQuery($('menuconfigSearch').value);
    if (immediateQuery && !menuExpanded) void setMenuconfigExpanded(true);
    setMenuconfigSearchBusy(immediateQuery.length >= 2);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      const query = $('menuconfigSearch').value.trim();
      const normalized = normalizeMenuSearchQuery(query);
      if (query) {
        $('menuconfigSelectedOnly').checked = false;
        refreshMenuconfigFilterSummary();
        resetMenuNavigation();
      }
      menuVisibleLimit = normalized.length >= 2 ? MENU_SEARCH_PAGE_SIZE : MENU_PAGE_SIZE;
      resetMenuScroll();
      if (normalized.length >= 2) {
        renderMenuconfig();
        await ensureCatalogHiddenLoaded().catch((error) => console.warn('[Catalog hidden shard]', error));
        if (normalizeMenuSearchQuery($('menuconfigSearch').value) !== normalized) return;
      }
      renderMenuconfig();
    }, 180);
  };
  $('menuconfigSelectedOnly').onchange = () => {
    $('menuconfigSearch').value = '';
    resetMenuNavigation();
    menuSelectedExpanded = $('menuconfigSelectedOnly').checked;
    refreshMenuconfigFilterSummary();
    menuVisibleLimit = MENU_PAGE_SIZE;
    resetMenuScroll();
    renderMenuconfig();
  };
  $('menuconfigUserSettable').onchange = () => {
    menuUserSettableOnly = $('menuconfigUserSettable').checked;
    refreshMenuconfigFilterSummary();
    resetMenuNavigation();
    menuVisibleLimit = MENU_PAGE_SIZE;
    resetMenuScroll();
    renderMenuconfig();
  };
  $('menuconfigOriginFilter').onchange = (event) => {
    const input = event.target.closest('input[name="menuconfigOrigin"]');
    if (!input) return;
    menuOriginFilter = input.value || 'all';
    refreshMenuconfigFilterSummary();
    resetMenuNavigation();
    menuVisibleLimit = MENU_PAGE_SIZE;
    resetMenuScroll();
    renderMenuconfig();
  };
  $('menuconfigFilterTrigger').onclick = (event) => {
    event.stopPropagation();
    const menu = $('menuconfigFilterMenu');
    menu.hidden = !menu.hidden;
  };
  $('menuconfigStateHelp').onclick = (event) => {
    event.stopPropagation();
    showDatasetTooltip($('menuconfigStateHelp'), event);
  };
  $('capText').onclick = () => {
    if (rootfsPartitionInfo()) openRootfsCapacityGuidance();
  };
  $('catalogLoadState').onclick = retryCatalogLoad;
  $('catalogCopyDiagnostics').onclick = copyCatalogDiagnostics;
  $('menuconfigScroll').onscroll = () => {
    hideMenuTooltip();
    const scroller = $('menuconfigScroll');
    if (scroller.dataset.hasMore !== 'true' ||
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight > 120) return;
    const top = scroller.scrollTop;
    menuVisibleLimit += currentMenuPageSize();
    renderMenuconfig();
    requestAnimationFrame(() => { scroller.scrollTop = top; });
  };
  let unknownSearchTimer = 0;
  $('importUnknownSearch').oninput = () => {
    clearTimeout(unknownSearchTimer);
    unknownSearchTimer = setTimeout(() => {
      importedUnknownLimit = MENU_PAGE_SIZE;
      renderImportedWorkspace();
    }, 100);
  };
  $('importUnknownDisabled').onchange = () => {
    importedUnknownLimit = MENU_PAGE_SIZE;
    renderImportedWorkspace();
  };
  $('importUnknownMore').onclick = () => {
    importedUnknownLimit += MENU_PAGE_SIZE;
    renderImportedWorkspace();
  };
  $('importReset').onclick = resetImportedChanges;
}
function kconfigConstraintTooltip(option, stateValue, constraints) {
  const stateRow = constraints.states.find((row) => row.value === stateValue) || {};
  const selectorLines = constraints.selectors.map((selector) => {
    const condition = selector.condition
      ? uiText(`，条件 ${selector.condition}=${selector.conditionLevel === 2 ? 'Y' : 'M'}`,
        `，條件 ${selector.condition}=${selector.conditionLevel === 2 ? 'Y' : 'M'}`,
        `; condition ${selector.condition}=${selector.conditionLevel === 2 ? 'Y' : 'M'}`)
      : '';
    return `${selector.sourceSymbol}=${selector.sourceValue.toUpperCase()}${condition}`;
  });
  const range = uiText(
    `当前值 ${constraints.current.toUpperCase()}；依赖上限 ${constraints.maximum.toUpperCase()}；select 下限 ${constraints.minimum.toUpperCase()}。`,
    `目前值 ${constraints.current.toUpperCase()}；相依上限 ${constraints.maximum.toUpperCase()}；select 下限 ${constraints.minimum.toUpperCase()}。`,
    `Current ${constraints.current.toUpperCase()}; dependency maximum ${constraints.maximum.toUpperCase()}; select minimum ${constraints.minimum.toUpperCase()}.`);
  let emphasis = '';
  if (stateRow.selectable) {
    emphasis = uiText(`可直接切换为 ${stateValue.toUpperCase()}。`, `可直接切換為 ${stateValue.toUpperCase()}。`,
      `You can set this option directly to ${stateValue.toUpperCase()}.`);
  } else if (constraints.readOnly && (option.defaults || []).length) {
    emphasis = uiText(
      '该符号没有可操作提示；当前状态由 Kconfig 条件默认值自动计算。请修改其父选项、固件语言或默认条件。',
      '此符號沒有可操作提示；目前狀態由 Kconfig 條件預設值自動計算。請修改其父選項、韌體語言或預設條件。',
      'This symbol has no user prompt. Kconfig computes it from conditional defaults; change its parent option, firmware language, or default condition instead.');
  } else if (constraints.readOnly) {
    emphasis = uiText(
      '该符号没有可操作提示（userSettable=false），只能由 Profile、默认值、select 或导入配置决定。',
      '此符號沒有可操作提示（userSettable=false），只能由 Profile、預設值、select 或匯入設定決定。',
      'This symbol has no user prompt (userSettable=false). Profile/default/select/import resolution controls it.');
  } else if (stateRow.code === 'selected-lower-bound' || stateRow.code === 'selected-fixed') {
    emphasis = uiText(
      `活动 select 将最低值锁定为 ${constraints.minimum.toUpperCase()}。要选择更低状态，必须关闭所有活动 selector，或让其条件变为 N。`,
      `作用中的 select 將最低值鎖定為 ${constraints.minimum.toUpperCase()}。若要選擇更低狀態，必須關閉所有作用中的 selector，或讓其條件變為 N。`,
      `Active select rules lock the minimum at ${constraints.minimum.toUpperCase()}. Disable every active selector or make its condition N before choosing a lower state.`);
  } else if (stateRow.code === 'dependency-upper-bound') {
    emphasis = uiText(
      `依赖表达式把最高值限制为 ${constraints.maximum.toUpperCase()}；先满足或提升依赖条件。`,
      `相依表示式把最高值限制為 ${constraints.maximum.toUpperCase()}；請先滿足或提高相依條件。`,
      `Dependencies cap this option at ${constraints.maximum.toUpperCase()}. Satisfy or raise the dependency expression first.`);
  } else if (stateRow.code === 'cannot-disable') {
    emphasis = uiText('Catalog 声明该项不可直接关闭。', 'Catalog 宣告此項不可直接關閉。',
      'Catalog declares that this option cannot be disabled directly.');
  } else {
    emphasis = uiText('当前 Kconfig 约束不允许直接选择此状态。', '目前 Kconfig 約束不允許直接選擇此狀態。',
      'The active Kconfig constraints do not allow this direct state.');
  }
  const body = [range,
    selectorLines.length ? uiText(`活动 selector：\n${selectorLines.join('\n')}`,
      `作用中的 selector：\n${selectorLines.join('\n')}`,
      `Active selectors:\n${selectorLines.join('\n')}`) : '',
    option.depends?.length ? uiText(`依赖：${option.depends.join(' && ')}`, `相依：${option.depends.join(' && ')}`,
      `Depends on: ${option.depends.join(' && ')}`) : '',
    option.defaults?.length ? uiText(`默认：${option.defaults.join('；')}`, `預設：${option.defaults.join('；')}`,
      `Defaults: ${option.defaults.join('; ')}`) : '',
  ].filter(Boolean).join('\n\n');
  return { title: `CONFIG_${option.symbol} · ${stateValue.toUpperCase()}`, emphasis, body };
}
function bindKconfigConstraintTooltip(button, option, stateValue, constraints) {
  const tooltip = kconfigConstraintTooltip(option, stateValue, constraints);
  bindUiTooltipContent(button, {
    ...tooltip,
    key: `CONFIG_${option.symbol}:${stateValue}`,
  });
}
function renderCatalogOriginSlot(option, origin) {
  const slot = document.createElement('span');
  slot.className = 'menuconfig-origin-slot';
  if (!origin || origin.kind === 'inactive') {
    slot.setAttribute('aria-hidden', 'true');
    return slot;
  }
  const restorable = Boolean(origin.restorable && catalogUserOverrides.has(option.symbol));
  const badge = document.createElement(restorable ? 'button' : 'small');
  const displayKind = origin.displayKind || origin.kind;
  badge.className = `catalog-origin catalog-origin-${displayKind}${restorable ? ' catalog-origin-restore' : ''}`;
  badge.textContent = `${origin.label}${restorable ? ' ↶' : ''}`;
  badge.dataset.uiTooltipTitle = `CONFIG_${option.symbol} · ${origin.label}`;
  badge.dataset.uiTooltipBody = origin.detail || origin.label;
  if (restorable) {
    badge.type = 'button';
    badge.setAttribute('aria-label', `${origin.label}: ${origin.detail || ''}`);
    badge.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      restoreCatalogDefault(option);
    };
  } else {
    badge.tabIndex = 0;
  }
  slot.appendChild(badge);
  return slot;
}
function renderMenuOption(option) {
  const rawValue = menuValues.get(option.symbol) ?? simpleKconfigDefault(option);
  const constraints = optionStateConstraints(option);
  const value = option.type === 'bool' || option.type === 'tristate'
    ? constraints.current : rawValue;
  const childCount = menuNestedCounts.get(option.symbol) || 0;
  const row = document.createElement('div');
  const packageName = option.symbol.startsWith('PACKAGE_') ? option.symbol.slice(8) : '';
  const origin = catalogOriginMeta(option);
  row.dataset.symbol = option.symbol;
  row.className = `menuconfig-option${packageName ? ' package-option' : ''}${childCount ? ' has-children' : ''}${option.hidden ? ' hidden-package-option' : ''}`;
  const summary = document.createElement('span');
  summary.className = 'menuconfig-option-summary';
  const path = (option.path || []).map(menuPathLabel).filter(Boolean).join(' › ');
  const english = menuOptionLabel(option);
  const translation = menuOptionTranslation(option);
  const localized = [translation.usage, translation.title]
    .map((item) => String(item || '').trim()).find(Boolean) || '';
  const id = document.createElement('span');
  id.className = 'menuconfig-option-label menuconfig-option-id';
  id.textContent = packageName || option.symbol;
  id.dataset.symbol = option.symbol;
  id.dataset.translation = localized;
  id.dataset.english = english;
  id.dataset.path = path;
  id.tabIndex = 0;
  bindMenuOptionTooltip(id);
  const description = document.createElement('span');
  description.className = 'menuconfig-option-label menuconfig-option-description';
  description.textContent = [...new Set([localized, english].filter(Boolean))].join(' · ') || id.textContent;
  description.dataset.symbol = option.symbol;
  description.dataset.translation = localized;
  description.dataset.english = english;
  description.dataset.path = path;
  description.tabIndex = 0;
  bindMenuOptionTooltip(description);
  summary.append(id);
  summary.appendChild(description);
  row.appendChild(summary);
  const actions = document.createElement('span');
  actions.className = 'menuconfig-option-actions';
  actions.appendChild(renderCatalogOriginSlot(option, origin));
  if (option.type === 'bool' || option.type === 'tristate') {
    const tri = document.createElement('span');
    tri.className = 'kconfig-tri';
    for (const stateValue of ['n', 'm', 'y']) {
      if (option.type === 'bool' && stateValue === 'm') {
        const spacer = document.createElement('span');
        spacer.className = 'kconfig-state-spacer';
        spacer.setAttribute('aria-hidden', 'true');
        tri.appendChild(spacer);
        continue;
      }
      const stateConstraint = constraints.states.find((item) => item.value === stateValue) || {
        value: stateValue, selectable: false, current: value === stateValue, locked: false,
      };
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = stateValue.toUpperCase();
      button.className = 'kconfig-state';
      button.classList.toggle('is-current', value === stateValue);
      button.classList.toggle('is-editable', stateConstraint.selectable);
      button.classList.toggle('is-disabled', !stateConstraint.selectable);
      button.classList.toggle('is-locked', Boolean(stateConstraint.locked));
      button.dataset.value = stateValue;
      button.setAttribute('aria-pressed', String(value === stateValue));
      button.setAttribute('aria-disabled', String(!stateConstraint.selectable));
      bindKconfigConstraintTooltip(button, option, stateValue, constraints);
      if (stateConstraint.locked) {
        const lock = document.createElement('span');
        lock.className = 'kconfig-state-lock';
        lock.textContent = '🔒';
        lock.setAttribute('aria-hidden', 'true');
        button.appendChild(lock);
      }
      button.onclick = (event) => {
        if (!stateConstraint.selectable) {
          event.preventDefault();
          showDatasetTooltip(button, event);
          return;
        }
        if (value === stateValue) return;
        setMenuValue(option, stateValue, childCount > 0 && stateValue !== 'n');
      };
      tri.appendChild(button);
    }
    actions.appendChild(tri);
  } else {
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = option.type === 'int' ? 'numeric' : 'text';
    input.value = option.type === 'string' ? String(value ?? '') : (value === 'n' ? '' : value);
    input.readOnly = option.userSettable === false;
    if (input.readOnly) {
      input.dataset.uiTooltipTitle = `CONFIG_${option.symbol}`;
      input.dataset.uiTooltipEmphasis = uiText(
        '该符号没有可操作提示（userSettable=false），当前值仅供查看。',
        '此符號沒有可操作提示（userSettable=false），目前值僅供查看。',
        'This symbol has no user prompt (userSettable=false); its value is read-only.');
      input.dataset.uiTooltipBody = uiText(
        '值由 Profile、默认值、select 或导入配置决定。',
        '此值由 Profile、預設值、select 或匯入設定決定。',
        'Profile/default/select/import resolution controls this value.');
      input.onclick = (event) => showDatasetTooltip(input, event);
    }
    input.onchange = () => {
      if (input.readOnly) return;
      const previous = menuValues.get(option.symbol) ?? simpleKconfigDefault(option);
      if (!setMenuValue(option, input.value)) {
        input.value = option.type === 'string' ? String(previous ?? '') : (previous === 'n' ? '' : previous);
      }
    };
    actions.appendChild(input);
  }
  if (childCount) {
    const childButton = document.createElement('button');
    childButton.type = 'button';
    childButton.className = 'menuconfig-child';
    childButton.textContent = '›';
    const childHint = value === 'n' ? 'Select M or Y to open sub-options' : 'Open sub-options';
    bindUiTooltipContent(childButton, { body: childHint });
    childButton.setAttribute('aria-label', childHint);
    childButton.disabled = value === 'n';
    childButton.onclick = () => {
      openMenuChildren(option);
      renderMenuconfig();
    };
    actions.appendChild(childButton);
  }
  row.appendChild(actions);
  return row;
}
function renderMenuLeaf(options, list) {
  const choiceGroups = new Map();
  const ordinary = [];
  for (const option of options) {
    if (option.choice) addMenuIndex(choiceGroups, option.choice, option);
    else ordinary.push(option);
  }
  const choiceEntries = [...choiceGroups];
  const visibleChoices = choiceEntries.slice(0, menuVisibleLimit);
  for (const [choiceId, members] of visibleChoices) {
    const choice = (MENU_CATALOG.menu.choices || []).find((item) => item.id === choiceId);
    const row = document.createElement('label');
    row.className = 'menuconfig-choice';
    const text = document.createElement('span');
    text.className = 'menuconfig-choice-text';
    const choiceLabel = String(choice?.promptEn || choice?.prompt || 'Choice').trim();
    text.append(document.createTextNode(choiceLabel));
    const select = document.createElement('select');
    select.setAttribute('aria-label', choiceLabel);
    const selected = members.find((option) =>
      (menuValues.get(option.symbol) ?? simpleKconfigDefault(option)) !== 'n');
    if (!selected) {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Select…';
      select.appendChild(placeholder);
    }
    for (const option of members) {
      const entry = document.createElement('option');
      entry.value = option.symbol;
      entry.textContent = menuOptionLabel(option);
      const optionTranslation = menuOptionTranslation(option);
      const choiceDescription = [...new Set([
        optionTranslation.usage,
        optionTranslation.title,
        menuOptionLabel(option),
      ].filter(Boolean))];
      entry.dataset.uiTooltipBody = [
        `CONFIG_${option.symbol}`,
        choiceDescription.join('\n'),
        (option.path || []).map(menuPathLabel).filter(Boolean).join(' › '),
      ].filter(Boolean).join('\n\n');
      entry.selected = option.symbol === selected?.symbol;
      select.appendChild(entry);
    }
    const syncChoiceTitle = () => {
      bindUiTooltipContent(select, { body: select.selectedOptions[0]?.dataset.uiTooltipBody || '' });
    };
    syncChoiceTitle();
    select.onchange = () => {
      const option = menuOptionBySymbol.get(select.value);
      if (option) setMenuValue(option, optionMaxLevel(option) > 1 ? 'y' : 'm');
      syncChoiceTitle();
    };
    applyMenuTranslation(text,
      choice?.promptI18n?.[state.lang] || (state.lang === 'zh-CN' ? choice?.promptZh : ''),
      choice?.usageI18n?.[state.lang] || (state.lang === 'zh-CN' ? choice?.usageZh : ''),
      true);
    row.append(text, select);
    list.appendChild(row);
  }
  const ordinaryBudget = Math.max(0, menuVisibleLimit - visibleChoices.length);
  for (const option of ordinary.slice(0, ordinaryBudget)) {
    list.appendChild(renderMenuOption(option));
  }
  return choiceEntries.length + ordinary.length;
}
function breadcrumbTranslation(label) {
  const meta = menuLabelMeta(label);
  const localized = meta.i18n?.[state.lang] || (state.lang === 'zh-CN' ? meta.zhCN : '');
  if (localized) return {
    title: localized,
    usage: meta.usageI18n?.[state.lang] ||
      (state.lang === 'zh-CN' ? (meta.usageZh || '') : ''),
  };
  const option = MENU_CATALOG?.menu?.options?.find((item) =>
    item.prompt === label || item.promptEn === label);
  return {
    title: option?.promptI18n?.[state.lang] || (state.lang === 'zh-CN' ? option?.promptZh || '' : ''),
    usage: option?.usageI18n?.[state.lang] || (state.lang === 'zh-CN' ? option?.usageZh || '' : ''),
  };
}
function jumpMenuBreadcrumb(index) {
  if (index === 0) {
    resetMenuNavigation();
    menuVisibleLimit = MENU_PAGE_SIZE;
    resetMenuScroll();
    renderMenuconfig();
    return;
  }
  const crumbIndex = index - 1;
  if (crumbIndex < 0 || crumbIndex >= menuBreadcrumb.length - 1) return;
  const stateAtLevel = menuHistory[crumbIndex + 1];
  if (!stateAtLevel) return;
  menuPath = stateAtLevel.path;
  menuParent = stateAtLevel.parent;
  menuBreadcrumb = [...stateAtLevel.breadcrumb];
  menuHistory = menuHistory.slice(0, crumbIndex + 1);
  menuVisibleLimit = MENU_PAGE_SIZE;
  resetMenuScroll();
  renderMenuconfig();
}
function renderMenuPanelTitle(mode = 'path') {
  const nav = $('menuconfigPanelTitle');
  nav.textContent = '';
  if (mode !== 'path') {
    const current = document.createElement('span');
    current.className = 'menuconfig-breadcrumb-current';
    current.textContent = mode;
    nav.appendChild(current);
    bindUiTooltipContent(nav, { body: mode });
    return;
  }
  const labels = ['Top level', ...menuBreadcrumb];
  bindUiTooltipContent(nav, {
    body: labels.map((label) => label === 'Top level' ? menuUi('top') : menuPathLabel(label)).join(' / '),
  });
  labels.forEach((label, index) => {
    if (index) {
      const separator = document.createElement('span');
      separator.className = 'menuconfig-breadcrumb-separator';
      separator.textContent = '›';
      nav.appendChild(separator);
    }
    const current = index === labels.length - 1;
    const part = document.createElement(current ? 'span' : 'button');
    part.className = current ? 'menuconfig-breadcrumb-current' : 'menuconfig-breadcrumb-link';
    part.textContent = label === 'Top level' ? 'Top level' : menuPathLabel(label);
    const translation = label === 'Top level'
      ? { title: menuUi('top'), usage: '' }
      : breadcrumbTranslation(label);
    applyMenuTranslation(part, translation.title, translation.usage);
    if (!current) {
      part.type = 'button';
      part.onclick = () => jumpMenuBreadcrumb(index);
    } else {
      part.setAttribute('aria-current', 'page');
    }
    nav.appendChild(part);
  });
}
function updateMenuconfigOverviewVisibility() {
  const row = $('menuconfigOverviewRow');
  if (!row) return;
  row.hidden = $('menuconfigSelectedToggle').hidden && $('importSummary').hidden;
}
function renderMenuconfig() {
  hideMenuTooltip();
  const box = $('menuconfigBox');
  if (!box || !MENU_CATALOG?.menu?.options) return;
  box.hidden = false;
  $('menuconfigToggle').setAttribute('aria-expanded', String(menuExpanded));
  $('menuconfigBody').hidden = !menuExpanded;
  if (!menuExpanded) return;
  const grid = $('menuconfigGrid');
  const panel = $('menuconfigPanel');
  const list = $('menuconfigOptions');
  grid.textContent = '';
  list.textContent = '';
  const query = normalizeMenuSearchQuery($('menuconfigSearch').value);
  const selectedOnly = $('menuconfigSelectedOnly').checked;
  menuUserSettableOnly = $('menuconfigUserSettable').checked;
  refreshMenuconfigFilterSummary();

  // Resolve visibility once per Catalog state revision. Search, source filters,
  // selected counts, and child-directory counts reuse this result instead of
  // rebuilding Target context and re-evaluating every dependency repeatedly.
  const contextualReferenceView = Boolean(query || selectedOnly || menuOriginFilter !== 'all');
  const visibleOptions = menuSearchOptions.filter(optionVisible).filter((option) =>
    (!menuUserSettableOnly || option.userSettable !== false) &&
    (option.userSettable !== false || option.path?.length || contextualReferenceView));
  const selected = visibleOptions.filter(menuOptionSelected);
  const selectedToggle = $('menuconfigSelectedToggle');
  selectedToggle.hidden = !selectedOnly;
  updateMenuconfigOverviewVisibility();
  selectedToggle.setAttribute('aria-expanded', String(menuSelectedExpanded));
  $('menuconfigSelectedCount').textContent = String(selected.length);
  const selectedCollapsed = selectedOnly && !menuSelectedExpanded;
  $('menuconfigWorkspace').hidden = selectedCollapsed;
  $('menuconfigContent').hidden = selectedCollapsed;
  if (selectedCollapsed) {
    $('menuconfigBack').hidden = false;
    $('menuconfigBack').disabled = menuHistory.length === 0;
    $('menuconfigBack').setAttribute('aria-disabled', String($('menuconfigBack').disabled));
    renderImportedWorkspace();
    return;
  }

  const eligibleOptions = visibleOptions.filter((option) =>
    catalogOriginMatches(option) && (!selectedOnly || menuOptionSelected(option)));
  const eligibleSymbols = new Set(eligibleOptions.map((option) => option.symbol));
  const eligible = (option) => eligibleSymbols.has(option.symbol);
  let nodes = [];
  let options = [];
  let searchPending = false;
  if (query) {
    renderMenuPanelTitle(query.length < 2 ? 'Type at least 2 characters' : 'Search results');
    if (query.length >= 2) {
      const matches = searchMenuOptions(query);
      searchPending = matches === null;
      options = (matches || []).filter(eligible);
    }
  } else if (menuOriginFilter !== 'all') {
    renderMenuPanelTitle(selectedOriginFilterLabel());
    options = eligibleOptions;
  } else {
    const key = menuPathKey(menuPath || []);
    renderMenuPanelTitle();
    const exact = menuExactPaths.get(key) || [];
    if (menuPath === null) {
      const rootOptions = exact.filter((option) => eligible(option) && (option.parent || '') === menuParent);
      if (rootOptions.length) nodes.push({
        label: 'Root Kconfig options', uiKey: 'rootOptions', usageUiKey: 'rootOptionsHelp',
        path: [], count: rootOptions.length,
      });
    } else {
      options = exact.filter((option) => eligible(option) && (option.parent || '') === menuParent);
    }
    const countCache = new Map();
    const countPath = (path) => {
      const pathKey = menuPathKey(path);
      if (!countCache.has(pathKey)) {
        countCache.set(pathKey, (menuDescendants.get(pathKey) || []).reduce((count, option) =>
          count + Number(eligible(option) && (option.parent || '') === menuParent), 0));
      }
      return countCache.get(pathKey);
    };
    for (const name of menuChildPaths.get(key) || []) {
      const path = [...(menuPath || []), name];
      const count = countPath(path);
      if (count) nodes.push({ label: name, path, count });
    }
  }
  $('menuconfigBack').hidden = !!query;
  $('menuconfigBack').disabled = menuHistory.length === 0;
  $('menuconfigBack').setAttribute('aria-disabled', String($('menuconfigBack').disabled));
  setMenuconfigSearchBusy(searchPending);
  const nodeFragment = document.createDocumentFragment();
  for (const node of nodes) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'menuconfig-category';
    const meta = menuLabelMeta(node.label);
    const text = document.createElement('span');
    text.className = 'menuconfig-category-text';
    text.append(document.createTextNode(meta.en || node.label));
    const count = document.createElement('small');
    count.className = 'menuconfig-category-count';
    count.textContent = `${node.count} ›`;
    button.append(text, count);
    const localized = (node.uiKey ? menuUi(node.uiKey) : '') || meta.i18n?.[state.lang] ||
      (state.lang === 'zh-CN' ? (node.translation || meta.zhCN) : '');
    applyMenuTranslation(button,
      localized,
      (node.usageUiKey ? menuUi(node.usageUiKey) : '') || meta.usageI18n?.[state.lang] ||
        (state.lang === 'zh-CN' ? (node.usageZh || meta.usageZh) : ''),
      true);
    button.onclick = () => {
      openMenuLevel(node.path, menuParent, node.label);
      renderMenuconfig();
    };
    nodeFragment.appendChild(button);
  }
  grid.appendChild(nodeFragment);
  grid.hidden = !nodes.length;
  fitMenuCategoryNames(grid);
  const ordinaryCount = renderMenuLeaf(options, list);
  if (!nodes.length && !options.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = searchPending ? 'Searching…' : query.length === 1
      ? 'Type one more character.'
      : 'No available options.';
    bindUiTooltipContent(empty, { body: state.lang === 'en' ? '' : searchPending
      ? uiText('正在搜索…', '正在搜尋…', 'Searching…')
      : query.length === 1
        ? uiText('请再输入一个字符。', '請再輸入一個字元。', 'Type one more character.')
        : uiText('没有可用选项。', '沒有可用選項。', 'No available options.') });
    list.appendChild(empty);
  }
  panel.hidden = !options.length && !!nodes.length;
  $('menuconfigMore').hidden = true;
  $('menuconfigScroll').dataset.hasMore = String(ordinaryCount > menuVisibleLimit);
  renderImportedWorkspace();
}
async function selectCatalogLocatorTarget(values) {
  const preferredTarget = { ...values, strictCatalogTarget: true };
  targetSelectorValues = {};
  const selected = renderCatalogTargetSelectors(preferredTarget);
  if (!selected.target || !selected.profile) return;
  await applyCatalogTarget();
  const label = state.device?.target?.profileLabel || selected.profile.name || selected.profile.id;
  showToast(uiText(`已选择 ${label}`, `已選擇 ${label}`, `Selected ${label}`), 'device');
}
function buildCatalogLocatorEntries() {
  const entries = [];
  for (const source of MENU_INDEX?.sources || []) {
    entries.push({
      type: 'Source', label: source.label || source.id, detail: source.repo || source.id,
      hay: `${source.id} ${source.label || ''} ${source.repo || ''}`,
      run: () => {
        $('targetSource').value = source.id;
        $('targetSource').dispatchEvent(new Event('change', { bubbles: true }));
      },
    });
    for (const branch of source.branches || []) {
      entries.push({
        type: 'Branch', label: branch.branch, detail: source.label || source.id,
        hay: `${source.id} ${source.label || ''} ${branch.branch}`,
        run: () => {
          $('targetSource').value = source.id;
          renderCatalogPicker(false, { sourceId: source.id, branchId: branch.id });
        },
      });
    }
  }
  const schema = MENU_CATALOG?.targetSelectors || DEFAULT_TARGET_SELECTORS;
  const walk = (nodes, depth = 0, values = {}) => {
    const selector = schema[depth];
    if (!selector) return;
    for (const node of nodes || []) {
      const next = { ...values, [selector.id]: node.value };
      entries.push({
        type: node.profileId ? 'Target Profile' : (selector.labelEn || selector.id),
        label: node.labelEn || node.value,
        detail: Object.values(next).join(' › '),
        hay: `${selector.id} ${selector.labelEn || ''} ${node.value} ${node.labelEn || ''} ${node.labelZh || ''} ${(node.aliasesEn || []).join(' ')}`,
        run: async () => {
          if (node.profileId) {
            await selectCatalogLocatorTarget(next);
            return;
          }
          targetSelectorValues = next;
          renderCatalogTargetSelectors(next);
          await applyCatalogTarget();
        },
      });
      walk(node.children, depth + 1, next);
    }
  };
  walk(MENU_CATALOG?.targetTree || []);
  return entries.map((entry) => ({ ...entry, hay: String(entry.hay || '').toLowerCase() }));
}
function catalogLocatorEntries(query) {
  if (!catalogLocatorEntryCache) catalogLocatorEntryCache = buildCatalogLocatorEntries();
  return catalogLocatorEntryCache.filter((entry) => entry.hay.includes(query)).slice(0, 80);
}
function renderCatalogLocatorResults() {
  const input = $('catalogLocator');
  const results = $('catalogLocatorResults');
  if (!input || !results) return;
  const query = input.value.trim().toLowerCase();
  results.textContent = '';
  if (query.length < 2) {
    results.hidden = true;
    return;
  }
  if (catalogLoadMode === 'loading') {
    const loading = document.createElement('p');
    loading.className = 'hint catalog-locator-loading';
    loading.textContent = uiText('正在加载 Target 数据…', '正在載入 Target 資料…', 'Loading Target data…');
    results.appendChild(loading);
    results.hidden = false;
    return;
  }
  if (!MENU_CATALOG) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = catalogLoadMode === 'error'
      ? uiText('Catalog 加载失败，请重试。', 'Catalog 載入失敗，請重試。', 'Catalog failed to load. Retry.')
      : t('search.empty');
    results.appendChild(empty);
    results.hidden = false;
    return;
  }
  for (const entry of catalogLocatorEntries(query)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'catalog-locator-item';
    const label = document.createElement('span');
    label.textContent = entry.label;
    bindUiTooltipContent(label, { body: entry.label });
    const detail = document.createElement('small');
    detail.textContent = `${entry.type} · ${entry.detail}`;
    bindUiTooltipContent(detail, { body: detail.textContent });
    button.append(label, detail);
    button.onclick = async () => {
      results.hidden = true;
      results.textContent = '';
      input.value = '';
      await entry.run();
    };
    results.appendChild(button);
  }
  if (!results.children.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = t('search.empty');
    results.appendChild(empty);
  }
  results.hidden = false;
}
function initCatalogLocator() {
  const input = $('catalogLocator');
  const results = $('catalogLocatorResults');
  if (!input || !results) return;
  const close = () => { results.hidden = true; results.textContent = ''; };
  let locatorTimer = 0;
  input.oninput = () => {
    clearTimeout(locatorTimer);
    locatorTimer = setTimeout(renderCatalogLocatorResults, 160);
  };
  input.onfocus = () => {
    if (input.value.trim().length >= 2) renderCatalogLocatorResults();
  };
  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.catalog-locator')) close();
  });
}
function activateTargetRecord(record) {
  state.source = record.source;
  state.version = record.version;
  state.variant = record.variant;
  applySourceDefaults();
  renderGroups();
  updateStats();
  updateLoginInfo();
  updateDeviceSummary();
}
function renderDevices() {
  $('targetPicker').hidden = false;
  for (const id of ['sourceStep', 'versionStep', 'variantStep']) $(id).hidden = true;
  if (!importedTargetVerified && state.device?.id === 'custom-target') {
    setCatalogLoadState('idle');
    renderImportedCustomPicker();
    updateDeviceSummary();
    return;
  }
  if (!MENU_INDEX?.sources?.length) {
    if (catalogLoadMode !== 'error') setCatalogLoadState('loading');
    $('menuconfigGrid').textContent = '';
    $('menuconfigPanel').hidden = true;
    updateDeviceSummary();
    updateSubmitGate();
    return;
  }
  renderCatalogPicker();
  $('targetPicker').onchange = async (event) => {
    const select = event.target.closest('select');
    if (!select || !select.closest('#targetPicker')) return;
    const id = select.id;
    if (state.importedConfig) {
      if (!confirm('切换 Target 会退出上传配置工作区，并改为网页新建配置。继续吗？')) {
        renderDevices();
        return;
      }
      clearImportedWorkspace();
    }
    if (id === 'targetSource' || id === 'targetBranch') {
      MENU_CATALOG = null;
      menuCatalogKey = '';
      menuLoadingKey = '';
      renderCatalogPicker(false);
    } else {
      renderCatalogPicker(false);
      await applyCatalogTarget();
    }
  };
  updateDeviceSummary();
}

function updateDeviceSummary() {
  if (!state.device || !$('deviceSummary')) return;
  $('deviceSummary').textContent = state.device.kind === 'target'
    ? t('device.targetSelected', {
      source: state.source?.label || state.device.sources?.[0]?.label || 'Catalog',
      branch: state.version?.branch || state.device.sources?.[0]?.versions?.[0]?.branch || '',
      system: state.device.target?.systemLabel || state.device.target?.system || 'Target',
      subtarget: state.device.target?.subtargetLabel || state.device.target?.subtarget || '',
      profile: state.device.target?.profileLabel || state.device.target?.profile || '',
    })
    : t('device.selected', { brand: state.device.brand, model: state.device.name });
}
function setDeviceFold(folded) {
  $('devicePicker').hidden = folded;
  $('deviceSummary').hidden = !folded;
  $('deviceFold').setAttribute('aria-expanded', String(!folded));
  $('deviceFold').textContent = t(folded ? 'fold.show' : 'fold.hide');
  safeSet('wrt_device_fold', folded ? '1' : '0');
}
function initDeviceFold() {
  setDeviceFold(localStorage.getItem('wrt_device_fold') === '1');
  $('deviceFold').addEventListener('click', () => setDeviceFold(!$('devicePicker').hidden));
  $('deviceSummary').addEventListener('click', () => setDeviceFold(false));
}

function applySourceDefaults() {
  const box = $('rootpwBox');
  if (state.source.id === 'lede') {
    if (!box.value || state.rootpwAuto) {
      box.value = state.rootpw = '@empty';
      state.rootpwAuto = true;
    }
  } else if (state.rootpwAuto) {
    box.value = state.rootpw = '';
    state.rootpwAuto = false;
  }
  renderFirmwareSettings();
}

function renderSources() {
  const row = $('sourceRow');
  row.textContent = '';
  const previousSource = state.source;
  const preferred = state.device.sources.find((s) => previousSource && s.id === previousSource.id) || state.device.sources[0];
  state.device.sources.forEach((s) => {
    const pill = makePill(s.label, s.label + ' · ' + s.repo, s.desc, () => {
      state.source = s;
      setActive(row, pill);
      renderVersions();
      renderVariants();
      renderGroups();
      updateStats();
      updateLoginInfo();
      applySourceDefaults();
    });
    row.appendChild(pill);
    if (s.id === preferred.id) setActive(row, pill);
  });
  state.source = preferred;
  applySourceDefaults();
  renderVersions();
  renderVariants();
}

function renderVersions() {
  const row = $('versionRow');
  row.textContent = '';
  state.version = state.source.versions[0];
  state.source.versions.forEach((v) => {
    const pill = makePill(v.label, v.label + ' · ' + v.branch, v.note || '', () => {
      state.version = v;
      setActive(row, pill);
      renderVariants();
      updateStats();
    });
    row.appendChild(pill);
    if (v.id === state.version.id) setActive(row, pill);
  });
}

function renderVariants() {
  const row = $('variantRow');
  row.textContent = '';
  const variants = state.source.variants.filter((v) => !v.versions || v.versions.includes(state.version.id));
  state.variant = variants[0];
  variants.forEach((v) => {
    const pill = makePill(v.name, v.name, v.note || '', () => {
      state.variant = v;
      setActive(row, pill);
      updateStats();
    });
    row.appendChild(pill);
    if (v.id === state.variant.id) setActive(row, pill);
  });
}

function renderModes() {
  const row = $('modeRow');
  row.querySelectorAll('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      state.mode = pill.dataset.mode;
      setActive(row, pill);
      $('selfBox').hidden = state.mode !== 'self';
      safeSet('wrt_mode', state.mode);
    });
    if (pill.dataset.mode === state.mode) setActive(row, pill);
  });
  $('selfBox').hidden = state.mode !== 'self';
  $('ownerBox').value = state.owner;
  $('ownerBox').addEventListener('input', () => {
    state.owner = $('ownerBox').value.trim();
    safeSet('wrt_owner', state.owner);
  });
  $('lanipBox').value = state.lanip;
  $('lanipBox').addEventListener('change', () => {
    const v = $('lanipBox').value.trim();
    if (LANIP_RE.test(v)) { state.lanip = v; safeSet('wrt_lanip', v); }
    else { $('lanipBox').value = state.lanip = '192.168.1.1'; safeSet('wrt_lanip', state.lanip); showToast(t('lanip.invalid')); }
  });
  // 初始密码:可选;@empty 表示清空该源自带的初始密码;不持久化(是密码) / optional initial password; @empty blanks a shipped password; never persisted
  $('rootpwBox').addEventListener('input', () => {
    state.rootpwAuto = false;
    const v = $('rootpwBox').value.trim();
    if (v === '' || v === '@empty' || /^[A-Za-z0-9@#%^&*_+=.,:!?-]{4,32}$/.test(v)) state.rootpw = v;
  });
  $('rootpwBox').addEventListener('change', () => {
    const v = $('rootpwBox').value.trim();
    if (!(v === '' || v === '@empty' || /^[A-Za-z0-9@#%^&*_+=.,:!?-]{4,32}$/.test(v))) {
      $('rootpwBox').value = ''; state.rootpw = ''; showToast(t('rootpw.invalid'));
    }
  });
  const timezoneBox = $('timezoneBox');
  timezoneBox.addEventListener('focus', () => openTimezoneMenu(''));
  timezoneBox.addEventListener('click', () => {
    if (timezoneBox.value === timezoneLabel(currentTimezone())) timezoneBox.select();
    openTimezoneMenu('');
  });
  timezoneBox.addEventListener('input', () => openTimezoneMenu(timezoneBox.value));
  timezoneBox.addEventListener('keydown', timezoneMenuKeydown);
  timezoneBox.addEventListener('blur', () => {
    setTimeout(() => {
      if (!$('timezoneCombo').contains(document.activeElement)) {
        timezoneBox.value = timezoneLabel(currentTimezone());
        closeTimezoneMenu();
      }
    }, 0);
  });
  $('timezoneMenu').addEventListener('pointerdown', (event) => {
    const option = event.target.closest('.timezone-option');
    if (!option) return;
    event.preventDefault();
    const zone = TIMEZONES.zones.find((item) => item.zonename === option.dataset.zonename);
    if (zone) selectTimezone(zone);
  });
  document.addEventListener('pointerdown', (event) => {
    if (!$('timezoneCombo').contains(event.target)) closeTimezoneMenu();
  });
  $('fwThemeBox').addEventListener('change', () => setFirmwareTheme($('fwThemeBox').value));
  $('ntpBox').addEventListener('change', () => { state.ntp = $('ntpBox').value; });
  $('packageMirrorBox').addEventListener('change', () => {
    state.packageMirror = $('packageMirrorBox').value;
    packageMirrorSelectionExplicit = true;
  });
}

function fillSelect(id, entries, current) {
  const box = $(id);
  box.textContent = '';
  for (const [value, label] of entries) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = value === current;
    box.appendChild(option);
  }
  if (![...box.options].some((o) => o.selected)) box.selectedIndex = 0;
  return box.value;
}
function timezoneOffset(zonename) {
  try {
    const part = new Intl.DateTimeFormat('en', {
      timeZone: zonename, timeZoneName: 'longOffset', hour: '2-digit',
    }).formatToParts(new Date()).find((item) => item.type === 'timeZoneName');
    if (!part || part.value === 'GMT') return '+00:00';
    const match = part.value.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
    return match ? match[1] + match[2].padStart(2, '0') + ':' + (match[3] || '00') : '+00:00';
  } catch (e) { return '+00:00'; }
}
function timezoneLabel(zone) {
  return `(UTC${timezoneOffset(zone.zonename)}) ${zone.zonename}`;
}
function browserTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; }
  catch (e) { return ''; }
}
function initializeTimezone() {
  const available = new Set(TIMEZONES.zones.map((zone) => zone.zonename));
  const saved = localStorage.getItem('wrt_timezone') || '';
  const detected = browserTimezone();
  state.timezone = [saved, detected, 'Asia/Shanghai'].find((name) => available.has(name)) || TIMEZONES.zones[0].zonename;
}
function currentTimezone() {
  return TIMEZONES.zones.find((zone) => zone.zonename === state.timezone) ||
    TIMEZONES.zones.find((zone) => zone.zonename === 'Asia/Shanghai');
}
let timezoneActive = -1;
function timezoneSearchText(zone) {
  const beijing = zone.zonename === 'Asia/Shanghai' ? ' Beijing 北京 北京时间 ' + t('fw.timezone.beijing') : '';
  return `${zone.zonename} UTC${timezoneOffset(zone.zonename)} ${beijing}`.toLocaleLowerCase();
}
function timezoneOptions() {
  return [...$('timezoneMenu').querySelectorAll('.timezone-option')];
}
function timezoneOffsetMinutes(zone) {
  const match = timezoneOffset(zone.zonename).match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
}
function timezoneMenuZones(needle) {
  const commonRank = new Map(COMMON_TIMEZONES.map((name, index) => [name, index]));
  const sourceRank = new Map(TIMEZONES.zones.map((zone, index) => [zone.zonename, index]));
  const selected = currentTimezone().zonename;
  const zones = TIMEZONES.zones.filter((zone) => needle
    ? timezoneSearchText(zone).includes(needle)
    : commonRank.has(zone.zonename) || zone.zonename === selected);
  return zones.sort((a, b) =>
    timezoneOffsetMinutes(a) - timezoneOffsetMinutes(b) ||
    (commonRank.get(a.zonename) ?? Number.MAX_SAFE_INTEGER) - (commonRank.get(b.zonename) ?? Number.MAX_SAFE_INTEGER) ||
    sourceRank.get(a.zonename) - sourceRank.get(b.zonename));
}
function setTimezoneActive(index) {
  const options = timezoneOptions();
  if (!options.length) { timezoneActive = -1; return; }
  timezoneActive = Math.max(0, Math.min(index, options.length - 1));
  options.forEach((option, i) => option.classList.toggle('active', i === timezoneActive));
  options[timezoneActive].scrollIntoView({ block: 'nearest' });
  $('timezoneBox').setAttribute('aria-activedescendant', options[timezoneActive].id);
}
function openTimezoneMenu(query = '') {
  const menu = $('timezoneMenu');
  const needle = query.trim().toLocaleLowerCase();
  const zones = timezoneMenuZones(needle);
  menu.textContent = '';
  zones.forEach((zone, index) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'timezone-option';
    option.id = `timezoneOption${index}`;
    option.role = 'option';
    option.dataset.zonename = zone.zonename;
    option.textContent = timezoneLabel(zone);
    menu.appendChild(option);
  });
  timezoneActive = -1;
  menu.hidden = zones.length === 0;
  $('timezoneBox').setAttribute('aria-expanded', String(zones.length > 0));
  $('timezoneBox').removeAttribute('aria-activedescendant');
}
function closeTimezoneMenu() {
  $('timezoneMenu').hidden = true;
  $('timezoneBox').setAttribute('aria-expanded', 'false');
  $('timezoneBox').removeAttribute('aria-activedescendant');
  timezoneActive = -1;
}
function selectTimezone(zone) {
  state.timezone = zone.zonename;
  localStorage.setItem('wrt_timezone', zone.zonename);
  $('timezoneBox').value = timezoneLabel(zone);
  closeTimezoneMenu();
  if (!packageMirrorSelectionExplicit) {
    state.packageMirror = defaultPackageMirrorId(state.source?.id);
    renderFirmwareSettings();
  }
}
function timezoneMenuKeydown(event) {
  const options = timezoneOptions();
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if ($('timezoneMenu').hidden) openTimezoneMenu('');
    const count = timezoneOptions().length;
    if (!count) return;
    setTimezoneActive(event.key === 'ArrowDown'
      ? Math.min(timezoneActive + 1, count - 1)
      : (timezoneActive < 0 ? count - 1 : Math.max(timezoneActive - 1, 0)));
  } else if (event.key === 'Enter' && timezoneActive >= 0 && options[timezoneActive]) {
    event.preventDefault();
    const zone = TIMEZONES.zones.find((item) => item.zonename === options[timezoneActive].dataset.zonename);
    if (zone) selectTimezone(zone);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    $('timezoneBox').value = timezoneLabel(currentTimezone());
    closeTimezoneMenu();
  }
}
function renderTimezones() {
  const zone = currentTimezone();
  state.timezone = zone.zonename;
  $('timezoneBox').value = timezoneLabel(zone);
  closeTimezoneMenu();
}
function renderFirmwareSettings() {
  if (!state.source) return;
  renderTimezones();
  const catalogThemes = [...menuOptionBySymbol.keys()]
    .filter((symbol) => symbol.startsWith('PACKAGE_luci-theme-'))
    .map((symbol) => symbol.slice('PACKAGE_'.length));
  const available = MENU_CATALOG ? catalogThemes : [];
  const themes = [['@base', uiText('跟随基础配置', '跟隨基礎設定', 'Follow base config')]]
    .concat([...new Set(available)].map((id) => {
      const option = menuOptionBySymbol.get(`PACKAGE_${id}`);
      return [id, menuOptionTranslation(option || {}).title || menuOptionLabel(option || { symbol: id })];
    }));
  if (!themes.some(([id]) => id === state.theme)) state.theme = '@base';
  state.theme = fillSelect('fwThemeBox', themes, state.theme);
  state.ntp = fillSelect('ntpBox', [
    ['cn', t('fw.ntp.cn')], ['global', t('fw.ntp.global')], ['cloudflare', t('fw.ntp.cloud')],
  ], state.ntp);
  const packageMirrorEntriesForSource = packageMirrorEntries(state.source.id);
  const availableMirrorIds = packageMirrorEntriesForSource.map(([id]) => id);
  state.packageMirror = CATALOG_ENGINE?.resolvePackageMirrorSelection
    ? CATALOG_ENGINE.resolvePackageMirrorSelection({
      timezone: state.timezone,
      availableIds: availableMirrorIds,
      currentId: state.packageMirror,
      explicit: packageMirrorSelectionExplicit,
    })
    : defaultPackageMirrorId(state.source.id);
  state.packageMirror = fillSelect('packageMirrorBox', packageMirrorEntriesForSource, state.packageMirror);
  updateSubmitGate();
}
function firmwareThemePackage(option) {
  return String(option?.symbol || '').match(/^PACKAGE_(luci-theme-[A-Za-z0-9._+-]+)$/)?.[1] || '';
}
function syncFirmwareThemeFromMenu(option, value) {
  const packageName = firmwareThemePackage(option);
  if (!packageName) return;
  if (value === 'n') {
    if (state.theme === packageName) state.theme = '@base';
  } else {
    state.theme = packageName;
  }
}
function setFirmwareTheme(theme) {
  const snapshot = snapshotCatalogUiState();
  try {
    if (MENU_CATALOG) {
      const options = menuSearchOptions.filter((item) => firmwareThemePackage(item));
      for (const option of options) {
        if (firmwareThemePackage(option) === theme || !catalogUserOverrides.has(option.symbol)) continue;
        catalogUserOverrides.delete(option.symbol);
        applyMenuValue(option, catalogInheritedValue(option.symbol), true, 'restore');
      }
      if (theme !== '@base') {
        const selected = options.find((option) => firmwareThemePackage(option) === theme);
        if (selected) applyMenuValue(selected, 'y', false, 'user');
      }
    }
    state.theme = theme;
    renderCatalogUiAfterIntent();
  } catch (error) {
    restoreCatalogUiState(snapshot);
    renderCatalogUiAfterIntent();
    showToast(error.message);
  }
}

/* 当前源的登录信息提示,root 与密码状态着色强调 / per-source login hint with colored emphasis on "root" and the password value */
function updateLoginInfo() {
  if (!state.source) return;
  const box = $('loginInfo');
  box.textContent = '';
  const pwText = t(state.source.loginPw ? 'login.pw.' + state.source.loginPw : 'login.pw.none');
  //  作密码占位,模板任意语言通用 /  marks the password slot, language-agnostic
  const parts = t('login.info', { pw: '' }).split('');
  const addWithRoot = (str) => {
    for (const seg of str.split(/(root)/i)) {
      if (/^root$/i.test(seg)) {
        const em = document.createElement('em');
        em.className = 'login-user';
        em.textContent = seg;
        box.appendChild(em);
      } else if (seg) box.appendChild(document.createTextNode(seg));
    }
  };
  addWithRoot(parts[0] || '');
  // 密码"值"金色强调,括号里的附注保持普通样式并留空格 / gold-highlight only the password value; the parenthetical note stays plain, space-separated
  const noteAt = pwText.search(/[((]/);
  const pw = document.createElement('em');
  pw.className = 'login-pw';
  pw.textContent = noteAt > 0 ? pwText.slice(0, noteAt).trim() : pwText;
  box.appendChild(pw);
  if (noteAt > 0) box.appendChild(document.createTextNode('  ' + pwText.slice(noteAt)));
  addWithRoot(parts[1] || '');
}

/* ============ 插件列表 / Plugin list ============ */
function pluginState(p) {
  // Catalog-only 启动期间，Target 尚未应用前 source 会短暂为空。
  // 此时插件先按不可用处理，Catalog Target 应用后会重新渲染。
  if (!state.source) return 'unavailable';
  if (p.builtin && p.builtin[state.source.id]) return 'builtin';
  if (state.device?.id === 'catalog-target' && MENU_CATALOG?.splitAssets &&
      !MENU_CATALOG.menu?.displayLoaded) return 'loading';
  if (p.catalogOnly) {
    if (state.device?.id !== 'catalog-target' || !MENU_CATALOG) return 'unavailable';
    const option = curatedMenuOption(p);
    return option && optionVisible(option) ? 'ok' : 'unavailable';
  }
  if (state.device?.id === 'catalog-target' && MENU_CATALOG) {
    const option = curatedMenuOption(p);
    return option && optionVisible(option) ? 'ok' : 'unavailable';
  }
  if (state.source.append) return 'ok';   // append 模式产线:所有插件按追加方式可勾 / append-mode source: every plugin is selectable by appending
  if (!p.pkgs?.[state.source.id] && !p.pkg) return 'unavailable';
  return 'ok';
}
const byId = (id) => PLUGINS.plugins.find((x) => x.id === id);

/* 搜索匹配串:原文名/说明/id/包名 + en 名 + 当前语言名,任何语言下输英文名或本语言名都能命中 / Search haystack: original name/desc/id/package name + English name + current-language name, so English or localized names match in any UI language */
function searchHay(p) {
  return [p.id, p.name, p.desc || '', (state.source && p.pkgs?.[state.source.id]) || p.pkg || '',
    ...Object.values(p.nameI18n || {}), ...Object.values(p.descI18n || {})].join(' ').toLowerCase();
}

function renderCatalogApplicationsState(box) {
  if (PLUGINS.plugins.length) return false;
  const failed = catalogApplicationsLoadState === 'error';
  const empty = catalogApplicationsLoadState === 'ready';
  const row = document.createElement(failed ? 'button' : 'div');
  row.className = 'catalog-applications-state';
  row.dataset.state = failed ? 'error' : (empty ? 'empty' : 'loading');
  if (failed) {
    row.type = 'button';
    bindUiTooltipContent(row, { body: catalogApplicationsError });
    row.addEventListener('click', () => requestCatalogApplications(true));
  } else {
    row.setAttribute('role', 'status');
    row.setAttribute('aria-live', 'polite');
  }
  if (!failed && !empty) {
    const spinner = document.createElement('span');
    spinner.className = 'catalog-applications-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    row.appendChild(spinner);
  }
  const message = document.createElement('span');
  const detail = catalogApplicationsError.length > 160
    ? `${catalogApplicationsError.slice(0, 157)}…` : catalogApplicationsError;
  message.textContent = failed
    ? uiText(`精选插件加载失败：${detail}。点击重试`, `精選套件載入失敗：${detail}。點擊重試`,
      `Curated plugins failed to load: ${detail}. Click to retry`)
    : empty
      ? uiText('当前 Catalog 没有精选插件', '目前 Catalog 沒有精選套件', 'This Catalog has no curated plugins')
      : uiText('精选插件后台加载中…', '精選套件背景載入中…', 'Loading curated plugins…');
  row.appendChild(message);
  box.appendChild(row);
  return true;
}

function renderGroups() {
  const box = $('groups');
  box.textContent = '';
  if (renderCatalogApplicationsState(box)) return;
  const kw = $('searchBox').value.trim().toLowerCase();
  const hotOnly = $('hotOnly').checked;
  const searching = !!kw || hotOnly;

  for (const g of PLUGINS.groups) {
    const items = PLUGINS.plugins.filter((p) => p.group === g)
      .filter((p) => state.advanced || pluginState(p) !== 'unavailable')
      .filter((p) => !hotOnly || p.hot)
      .filter((p) => !kw || searchHay(p).includes(kw));
    if (!items.length) continue;

    const group = document.createElement('div');
    group.className = 'group' + (!searching && collapsed.has(g) ? ' collapsed' : '') + (searching ? ' searching' : '');
    group.dataset.group = g;

    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'group-head';
    head.setAttribute('aria-expanded', String(searching || !collapsed.has(g)));
    const ico = document.createElement('span');
    ico.className = 'group-ico';
    ico.setAttribute('aria-hidden', 'true');
    ico.textContent = GROUP_ICONS[g] || '📦';
    head.appendChild(ico);
    head.appendChild(document.createTextNode(groupLabel(g)));
    const badge = document.createElement('span');
    badge.className = 'group-badge';
    badge.dataset.badge = g;
    head.appendChild(badge);
    const cnt = document.createElement('span');
    cnt.className = 'group-count';
    cnt.textContent = t('plugin.group.count', { n: items.length });
    head.appendChild(cnt);
    const chev = document.createElement('span');
    chev.className = 'chev';
    chev.setAttribute('aria-hidden', 'true');
    chev.textContent = '▾';
    head.appendChild(chev);
    head.addEventListener('click', () => {
      if (searching) return;
      if (collapsed.has(g)) collapsed.delete(g); else collapsed.add(g);
      group.classList.toggle('collapsed');
      head.setAttribute('aria-expanded', String(!collapsed.has(g)));
      if (!collapsed.has(g)) fitPluginNames(group);   // 折叠时量不到高度,展开后补测 / heights are unmeasurable while collapsed, so re-check on expand
    });
    group.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'plugin-grid';
    for (const p of items) grid.appendChild(renderPlugin(p));
    group.appendChild(grid);
    box.appendChild(group);
  }
  if (!box.children.length) {
    const empty = document.createElement('p');
    empty.className = 'hint empty-hint';
    empty.textContent = t('search.empty');
    box.appendChild(empty);
  }
  updateLegend();
  updateGroupBadges();
  fitPluginNames();
}

/* V11:插件名适配:默认单行,溢出先缩 1px,再分两行,再缩 1px(共 −2px),极端长名靠两行内省略号兜底 / V11: plugin-name fitting: single line by default; on overflow shrink 1px, then wrap to two lines, then shrink 1px more (−2px total); extreme names fall back to the two-line ellipsis */
function fitOneName(el) {
  el.classList.remove('fit-s1', 'two-line', 'fit-s2');
  if (!el.clientWidth) return;   // 折叠分组量不到尺寸,展开时再补测 / collapsed groups are unmeasurable; re-checked on expand
  const over = () => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
  if (!over()) return;
  el.classList.add('fit-s1');    // ① 字号 −1px / step 1: font −1px
  if (!over()) return;
  el.classList.add('two-line');  // ② 允许两行 / step 2: allow two lines
  if (!over()) return;
  el.classList.remove('fit-s1');
  el.classList.add('fit-s2');    // ③ 再 −1px(共 −2px),到此为止 / step 3: another −1px (−2px total); stop here
}
function fitPluginNames(scope) {
  (scope || document).querySelectorAll('.plugin-name').forEach(fitOneName);
}
function fitMenuCategoryNames(scope) {
  (scope || document).querySelectorAll('.menuconfig-category-text').forEach((element) => {
    element.classList.remove('menu-fit-s1', 'menu-fit-s2', 'menu-fit-s3', 'menu-fit-two-line');
    if (!matchMedia('(max-width: 640px)').matches || !element.clientWidth) return;
    const over = () => element.scrollWidth > element.clientWidth + 1;
    if (!over()) return;
    for (const className of ['menu-fit-s1', 'menu-fit-s2', 'menu-fit-s3']) {
      element.classList.add(className);
      if (!over()) return;
    }
    element.classList.remove('menu-fit-s1', 'menu-fit-s2', 'menu-fit-s3');
    element.classList.add('menu-fit-two-line');
  });
}
/* 窗口尺寸变化后防抖重测 / debounced re-fit on window resize */
let fitTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(fitTimer);
  fitTimer = setTimeout(() => {
    fitPluginNames();
    fitMenuCategoryNames();
  }, 150);
});

/* 插件项只显示名字以保持列表紧凑；说明复用统一浮窗，悬停临时显示、双击固定 / Plugin rows stay compact; details reuse the shared hover/double-click tooltip. */
function renderPlugin(p) {
  const st = pluginState(p);
  const adv = state.advanced;
  const canForce = adv && devAllowGrey;   // V10:灰色项需开发者模式 + 二级门禁双开 / V10: grey items need developer mode AND the second gate
  // 必选项(locked):内置且任何模式都不可取消 / locked items stay checked & disabled even in advanced mode
  const lockedItem = p.locked && st === 'builtin';
  const item = document.createElement('div');
  item.className = 'plugin' +
    (st === 'loading' ? ' plugin-loading' : '') +
    (st === 'unavailable' ? (canForce ? ' plugin-forceable' : ' plugin-disabled') : '') +
    (st === 'builtin' ? (adv && !lockedItem ? ' plugin-removable' : ' plugin-builtin') : '');

  const cbId = 'pcb-' + p.id;
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.id = cbId;
  cb.dataset.pid = p.id;
  const catalogOption = state.device?.id === 'catalog-target' ? curatedMenuOption(p) : null;
  const catalogOrigin = catalogOption ? catalogOriginMeta(catalogOption) : null;
  const catalogLocked = catalogOption && ['target', 'profile-add'].includes(catalogOrigin.kind) &&
    catalogBaselineValues.get(catalogOption.symbol) !== 'n';
  cb.checked = curatedPluginChecked(p, st, catalogOption);
  // V10:灰色项只看双开关,其余沿用旧规则 / V10: grey items obey the double gate; everything else keeps the old rule
  cb.disabled = st === 'loading' || lockedItem || catalogLocked ||
    (st === 'unavailable' ? !canForce : (!adv && st !== 'ok'));
  if (catalogLocked) bindUiTooltipContent(item, { body: uiText(
    '由当前 Target / Profile 基础配置锁定', '由目前 Target / Profile 基礎設定鎖定',
    'Locked by the current Target / Profile baseline') });
  cb.setAttribute('aria-label', pName(p));
  const applyChecked = (checked) => {
    cb.checked = checked;
    if (catalogOption) {
      const applied = setMenuValue(catalogOption, checked ? 'y' : 'n');
      if (!applied) cb.checked = curatedPluginChecked(p, st, catalogOption);
      return applied;
    }
    const selectedBefore = new Set(state.sel);
    if (st === 'builtin') {
      if (checked) {
        state.removed.delete(p.id);
      } else {
        state.removed.add(p.id);
        if (p.warn) showToast(t(p.warn));   // 取消高风险内置项时同样提示 / warn when removing a risky builtin too
      }
    } else if (checked) {
      state.sel.add(p.id);
      if (p.warn) showToast(t(p.warn));   // 资源警告(如 Docker)勾选即弹 / resource warning pops right on ticking
    } else {
      state.sel.delete(p.id);
    }
    syncCuratedToMenu(p, checked ? 'y' : 'n');
    for (const id of state.sel) {
      if (!selectedBefore.has(id)) {
        const required = byId(id);
        if (required && required.id !== p.id) syncCuratedToMenu(required, 'y');
      }
    }
    updateStats();
    return true;
  };
  cb.addEventListener('change', () => { applyChecked(cb.checked); });
  item.appendChild(cb);

  const nameBtn = document.createElement('button');
  nameBtn.type = 'button';
  nameBtn.className = 'plugin-name';
  nameBtn.appendChild(document.createTextNode(pName(p)));
  if (p.hot) {
    const hot = document.createElement('span');
    hot.className = 'hot';
    hot.textContent = t('plugin.hot');
    nameBtn.appendChild(hot);
  }
  if (canForce && st === 'unavailable') {
    const f = document.createElement('span');
    f.className = 'flag flag-force';
    f.textContent = t('adv.forced');
    nameBtn.appendChild(f);
  }
  if (lockedItem) {
    const f = document.createElement('span');
    f.className = 'flag flag-required';
    f.textContent = t('plugin.required');
    nameBtn.appendChild(f);
  }
  if (catalogOption) {
    const origin = catalogOrigin;
    if (catalogLocked) {
      const required = document.createElement('span');
      required.className = 'flag flag-required';
      required.textContent = t('plugin.required');
      nameBtn.appendChild(required);
    }
    if (origin.kind !== 'inactive' && origin.kind !== 'user') {
      const f = document.createElement('span');
      f.className = `flag flag-origin flag-origin-${origin.kind}`;
      f.textContent = origin.label;
      bindUiTooltipContent(f, { body: origin.detail || origin.label });
      nameBtn.appendChild(f);
    }
  }
  const detail = (st === 'loading' ? uiText('Catalog 菜单加载中', 'Catalog 選單載入中', 'Catalog menu is loading')
    : st === 'builtin' ? t('plugin.builtin')
    : st === 'unavailable' ? t('plugin.unavailable')
    : pDesc(p)) + (catalogOrigin && catalogOrigin.kind !== 'inactive'
      ? `\n${uiText('来源', '來源', 'Origin')}: ${catalogOrigin.label}` : '') +
    (p.warn ? '\n' + t(p.warn) : '');
  const pkg = p.pkgs?.[state.source.id] || p.pkg || p.catalogCandidates?.[0] || p.id;
  const size = p.sizeBytes === null ? uiText('大小未知', '大小未知', 'Size unknown')
    : t('drawer.size', { n: fmtSize(p.sizeBytes) });
  const tooltipBody = detail + '\n' + pkg + ' · ' + size;
  bindUiTooltipContent(item, { title: pName(p), body: tooltipBody });
  bindUiTooltipContent(nameBtn, { title: pName(p), body: tooltipBody });
  nameBtn.removeAttribute('title');
  nameBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showDatasetTooltip(nameBtn, e);
  });
  item.appendChild(nameBtn);
  return item;
}

/* V10:清掉已强制勾选的灰色项并轻提示,门禁取消与关闭开发者模式共用 / V10: drop force-selected grey items with a light toast; shared by gate-off and developer-mode-off */
function clearForcedGrey() {
  const dropped = [];
  for (const id of [...state.sel]) {
    const p = byId(id);
    if (p && pluginState(p) !== 'ok') { state.sel.delete(id); dropped.push(pName(p)); }
  }
  if (dropped.length) showToast(t('drawer.inactive', { list: dropped.join('、') }));
}
/* V10:门禁复位:不记忆,开发者模式每次开/关都回到未勾 / V10: reset the gate; no memory — it returns to unticked on every developer-mode flip */
function resetAdvGrey() {
  devAllowGrey = false;
  $('advGrey').checked = false;
  $('advGreyRow').hidden = !state.advanced;
}
/* V10:灰色门禁子开关:勾选必须过确认弹窗,取消立即清理强制项 / V10: the grey-gate sub-toggle; ticking requires a confirm dialog, unticking cleans forced items at once */
$('advGrey').addEventListener('change', () => {
  if ($('advGrey').checked) {
    if (!confirm(t('adv.grey.confirm'))) { $('advGrey').checked = false; return; }   // 取消则回弹不勾 / cancel bounces it back unticked
    devAllowGrey = true;
  } else {
    devAllowGrey = false;
    clearForcedGrey();
  }
  renderGroups();
  updateStats();
});

/* 开发者模式开关(原"高级模式") / developer-mode toggle (formerly advanced mode) */
$('advMode').addEventListener('change', () => {
  if ($('advMode').checked) {
    if (!confirm(t('adv.confirm'))) { $('advMode').checked = false; return; }
    state.advanced = true;
    showToast(t('adv.on'));
  } else {
    state.advanced = false;
    // 关闭时清掉仅开发者模式才成立的选择,避免普通模式携带非法状态 / On turning off, drop selections only valid in developer mode so normal mode never carries illegal state
    clearForcedGrey();
    state.removed.clear();
  }
  resetAdvGrey();   // V10:门禁随开发者模式开/关一律复位 / V10: the gate resets on every developer-mode flip
  safeSet('wrt_adv', state.advanced ? '1' : '0');
  renderGroups();
  updateStats();
});

let searchTimer = 0;
$('searchBox').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(renderGroups, 150); });
$('hotOnly').addEventListener('change', renderGroups);

/* 当前源下真正生效的选择,勾选项在换源后可能不再可用 / Selections actually effective under the current source; checked items may become unavailable after switching sources */
function effectiveSelection() {
  const normal = [], forced = [], removed = [];
  for (const p of PLUGINS.plugins) {
    const st = pluginState(p);
    const intent = curatedPluginIntent(p);
    if (intent === 'excluded') { removed.push(p); continue; }
    if (st === 'builtin' || intent !== 'selected') continue;
    if (st === 'ok') normal.push(p);
    else if (state.advanced) forced.push(p);
  }
  return { normal, forced, removed, all: normal.concat(forced) };
}

function updateLegend() {
  let ok = 0, builtin = 0, off = 0;
  for (const p of PLUGINS.plugins) {
    const st = pluginState(p);
    if (st === 'ok') ok++; else if (st === 'builtin') builtin++; else off++;
  }
  $('availStats').textContent = t('legend.stats', { ok, builtin, off });
}
function updateGroupBadges() {
  document.querySelectorAll('.group-badge').forEach((b) => {
    const g = b.dataset.badge;
    const n = PLUGINS.plugins.filter((p) => p.group === g && curatedPluginIntent(p) === 'selected').length;
    b.textContent = n ? t('plugin.group.selected', { n }) : '';
  });
}

function rootfsPartitionInfo() {
  if (state.device?.id !== 'catalog-target' || !MENU_CATALOG) return null;
  const option = menuOptionBySymbol.get(ROOTFS_PARTSIZE_SYMBOL);
  if (!option) return null;
  const raw = String(menuValues.get(ROOTFS_PARTSIZE_SYMBOL) ?? simpleKconfigDefault(option) ?? '').trim();
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) return null;
  const path = (option.path || []).map(menuPathLabel).filter(Boolean);
  return { option, value, project: option.promptEn || option.prompt || 'Root filesystem partition size (in MiB)', path };
}
function focusMenuconfigSymbol(symbol) {
  return (async () => {
    if (!await setMenuconfigExpanded(true)) throw new Error('Catalog menu could not be expanded');
    const option = menuOptionBySymbol.get(symbol);
    if (!option) throw new Error(`Catalog option ${symbol} is unavailable`);
    rebuildMenuSearchIndex();
    if (menuExpanded) startCatalogSearchWorker();
    $('menuconfigSelectedOnly').checked = false;
    menuOriginFilter = 'all';
    refreshMenuconfigFilterText();
    resetMenuNavigation();
    $('menuconfigSearch').value = symbol;
    const query = normalizeMenuSearchQuery(symbol);
    catalogSearchResults.set(query, [symbol]);
    menuVisibleLimit = MENU_SEARCH_PAGE_SIZE;
    resetMenuScroll();
    renderMenuconfig();
    requestAnimationFrame(() => {
      const row = [...document.querySelectorAll('.menuconfig-option')].find((element) => element.dataset.symbol === symbol);
      if (!row) return;
      row.classList.add('menuconfig-focus');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = row.querySelector('input[type=text],input[type=number],select,button');
      input?.focus({ preventScroll: true });
      setTimeout(() => row.classList.remove('menuconfig-focus'), 1800);
    });
  })();
}
function openRootfsCapacityGuidance() {
  const info = rootfsPartitionInfo();
  if (!info) return;
  modalCancelHandler = null;
  openModal(uiText('RootFS 容量', 'RootFS 容量', 'RootFS capacity'));
  $('modal').querySelector('.modal').classList.add('rootfs-guidance');
  const body = $('modalBody');
  body.textContent = '';

  const row = document.createElement('div');
  row.className = 'rootfs-guidance-row';
  const project = document.createElement('span');
  project.textContent = `${uiText('项目', '項目', 'Item')}：${info.project}`;
  const current = document.createElement('strong');
  current.textContent = `${uiText('当前值', '目前值', 'Current')}：${info.value} MiB`;
  row.append(project, current);

  const path = document.createElement('div');
  path.className = 'rootfs-guidance-path';
  path.textContent = `${uiText('路径', '路徑', 'Path')}：${[...(info.path.length ? info.path : ['Target Images']), ROOTFS_PARTSIZE_SYMBOL].join(' → ')}`;

  const note = document.createElement('p');
  note.className = 'rootfs-guidance-note';
  note.textContent = uiText(
    '这个值决定 RootFS 分区上限。基础系统、依赖与所选软件包都会占用空间；如果构建日志出现 ext4 out of space，请增大此值后重建。',
    '這個值決定 RootFS 分區上限。基礎系統、相依套件與所選軟體包都會佔用空間；如果建置日誌出現 ext4 out of space，請增大此值後重建。',
    'This value limits the RootFS partition. The base system, dependencies, and selected packages all consume space. Increase it and rebuild if the build log reports ext4 out of space.');

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn';
  close.textContent = uiText('关闭', '關閉', 'Close');
  close.onclick = closeModal;
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'btn btn-primary';
  edit.textContent = uiText('去修改', '去修改', 'Modify');
  edit.onclick = async () => {
    closeModal();
    try {
      await focusMenuconfigSymbol(ROOTFS_PARTSIZE_SYMBOL);
    } catch (error) {
      showToast(error.message);
    }
  };
  actions.append(close, edit);
  body.append(row, path, note, actions);
}

function updateStats() {
  const sel = effectiveSelection();
  const n = sel.all.length;
  $('selCount').textContent = t('bar.selected', { n });
  const rootfs = rootfsPartitionInfo();
  const capText = $('capText');
  if (rootfs) {
    $('capBox').hidden = true;
    capText.disabled = false;
    capText.classList.add('rootfs-capacity');
    capText.textContent = `${rootfs.value} MiB`;
    bindUiTooltipContent(capText, { body: uiText(
      '查看 RootFS 容量与修改位置', '查看 RootFS 容量與修改位置',
      'View RootFS capacity and where to modify it') });
  } else {
    $('capBox').hidden = false;
    capText.disabled = true;
    capText.classList.remove('rootfs-capacity');
    const knownBytes = sel.all.reduce((sum, plugin) => sum + (plugin.sizeBytes || 0), 0);
    const unknownCount = sel.all.filter((plugin) => !plugin.sizeBytes).length;
    $('capFill').style.width = '0';
    $('capFill').className = 'cap-fill';
    capText.textContent = knownBytes
      ? `${uiText('已知软件包体积', '已知軟體包體積', 'Known package size')} ${fmtSize(knownBytes)}`
      : uiText('软件包体积未知', '軟體包體積未知', 'Package size unknown');
    bindUiTooltipContent(capText, { body: unknownCount
      ? uiText(`另有 ${unknownCount} 项暂无官方体积数据`, `另有 ${unknownCount} 項暫無官方體積資料`,
        `${unknownCount} selected item(s) have no official size observation`)
      : uiText('来自 Catalog 的跨源官方软件包观测', '來自 Catalog 的跨源官方軟體包觀測',
        'Cross-source official package observations from Catalog') });
  }
  updateGroupBadges();
  renderBuildContract();
}

/* ============ 已选清单 / Selected list ============ */
function openSelectedDrawer() {
  const sel = effectiveSelection();
  const rows = sel.normal.concat(sel.forced).map((p) => ({ p, kind: sel.forced.includes(p) ? 'force' : '' }))
    .concat(sel.removed.map((p) => ({ p, kind: 'remove' })));
  openModal(t('drawer.title'));
  const mb = $('modalBody');
  mb.textContent = '';
  if (!rows.length) {
    const p = document.createElement('p');
    p.textContent = t('drawer.empty');
    mb.appendChild(p);
    return;
  }
  const list = document.createElement('div');
  list.className = 'sel-list';
  for (const { p, kind } of rows) {
    const row = document.createElement('div');
    row.className = 'sel-row';
    const name = document.createElement('span');
    name.textContent = pName(p);
    if (kind) {
      const f = document.createElement('span');
      f.className = 'flag ' + (kind === 'force' ? 'flag-force' : 'flag-remove');
      f.textContent = kind === 'force' ? t('adv.forced') : t('adv.removed');
      name.appendChild(f);
    }
    const sz = document.createElement('span');
    sz.className = 'sel-size';
    sz.textContent = p.sizeBytes === null ? uiText('大小未知', '大小未知', 'Size unknown')
      : t('drawer.size', { n: fmtSize(p.sizeBytes) });
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'sel-rm';
    rm.textContent = '✕';
    rm.setAttribute('aria-label', t('drawer.remove', { name: pName(p) }));
    rm.addEventListener('click', () => {
      const catalogOption = state.device?.id === 'catalog-target' ? curatedMenuOption(p) : null;
      if (catalogOption) restoreCatalogDefault(catalogOption);
      else if (kind === 'remove') state.removed.delete(p.id);
      else state.sel.delete(p.id);
      const cb = document.querySelector('input[data-pid="' + p.id + '"]');
      if (cb && !catalogOption) cb.checked = kind === 'remove';
      updateStats();
      row.remove();
      if (!list.children.length) closeModal();
    });
    row.appendChild(name); row.appendChild(sz); row.appendChild(rm);
    list.appendChild(row);
  }
  mb.appendChild(list);
  const inactive = PLUGINS.plugins.filter((p) => state.sel.has(p.id) && pluginState(p) === 'unavailable' && !state.advanced);
  if (inactive.length) {
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = t('drawer.inactive', { list: inactive.map((p) => pName(p)).join('、') });
    mb.appendChild(note);
  }
}
$('selCount').addEventListener('click', openSelectedDrawer);

/* ============ 生成 .config / Generate the .config ============ */
/* ============ 一键自检 / One-click self test ============ */
async function timedFetch(url, timeout) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout || 8000);
  const start = performance.now();
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    const ms = Math.round(performance.now() - start);
    if (!r.ok) return { ok: false, ms, msg: 'HTTP ' + r.status };
    const text = await r.text();
    return { ok: true, ms: Math.round(performance.now() - start), size: text.length, text };
  } catch (e) {
    return { ok: false, ms: Math.round(performance.now() - start), msg: e.name === 'AbortError' ? t('st.timeout') : t('st.connFail') };
  } finally { clearTimeout(timer); }
}

const PROBE_UI_TEXT = Object.freeze({
  title: ['插件兼容探针', '套件相容性探針', 'Package Compatibility Probe'],
  intro: ['复用当前 Source/Branch 的 Advanced menuconfig 搜索结果，选择软件包并检查其在 Catalog 各源码分支中的编译、RootFS 安装、固件集成和可选启动行为。', '複用目前 Source/Branch 的 Advanced menuconfig 搜尋結果，選擇套件並檢查其在 Catalog 各原始碼分支中的編譯、RootFS 安裝、韌體整合及可選啟動行為。', 'Reuse the current Source/Branch Advanced menuconfig search results, select packages, and check compilation, RootFS installation, firmware integration, and optional boot behavior across Catalog Source/Branch environments.'],
  howTo: ['Probe 与 Advanced menuconfig 直接共用同一份 Kconfig 状态。修改 `PACKAGE_*` 会立即走相同的 setMenuValue/Kconfig 依赖计算；所有被启用的依赖软件包都会成为同一份真实状态，普通 Kconfig 选项仅供参考。', 'Probe 與 Advanced menuconfig 直接共用同一份 Kconfig 狀態。修改 `PACKAGE_*` 會立即走相同的 setMenuValue/Kconfig 相依計算；所有被啟用的相依套件都會成為同一份真實狀態，一般 Kconfig 選項僅供參考。', 'Probe and Advanced menuconfig share one Kconfig state. Changing a `PACKAGE_*` row immediately uses the same setMenuValue/Kconfig dependency calculation; every enabled dependency package is part of that same state, while ordinary Kconfig options remain reference-only.'],
  search: ['搜索软件包 / Kconfig ID', '搜尋套件 / Kconfig ID', 'Search package / Kconfig IDs'],
  selected: ['已选择', '已選擇', 'Selected'],
  depth: ['探测深度', '探測深度', 'Probe depth'],
  scope: ['源码分支范围', '原始碼分支範圍', 'Source/Branch scope'],
  targets: ['Target 覆盖', 'Target 覆蓋', 'Target coverage'],
  allSources: ['全部可用 Source/Branch', '全部可用 Source/Branch', 'All available Source/Branch entries'],
  currentSource: ['当前 Source/Branch', '目前 Source/Branch', 'Current Source/Branch'],
  customScope: ['自定义选择', '自訂選擇', 'Custom selection'],
  autoTarget: ['自动目标', '自動目標', 'Auto target'],
  currentTarget: ['当前目标', '目前目標', 'Current target'],
  allTargets: ['全部代表目标', '全部代表目標', 'All representative targets'],
  packageCompile: ['软件包编译', '套件編譯', 'Package compile'],
  packageCompileShort: ['编译', '編譯', 'Compile'],
  packageCompileHelp: ['使用目标工具链编译所选软件包及其依赖闭包。', '使用目標工具鏈編譯所選套件及其相依閉包。', 'Build the selected package and dependency closure with the target toolchain.'],
  rootfsIntegration: ['根文件系统集成', '根檔案系統整合', 'RootFS integration'],
  rootfsIntegrationShort: ['RootFS', 'RootFS', 'RootFS'],
  rootfsIntegrationHelp: ['把所选软件包安装进 RootFS，用于发现 APK/OPKG 文件归属和共同安装冲突。', '把所選套件安裝進 RootFS，用於發現 APK/OPKG 檔案歸屬及共同安裝衝突。', 'Install selected packages into RootFS to expose APK/OPKG ownership and co-install conflicts.'],
  firmwareIntegration: ['固件集成', '韌體整合', 'Firmware integration'],
  firmwareIntegrationShort: ['固件', '韌體', 'Firmware'],
  firmwareIntegrationHelp: ['在相同 Source/Branch/Target 环境中分别构建基础固件和加入所选软件包的固件。', '在相同 Source/Branch/Target 環境中分別建置基礎韌體及加入所選套件的韌體。', 'Build a baseline image and an image with the selected packages in the same Source/Branch/Target environment.'],
  bootSmoke: ['启动自检', '啟動自檢', 'Boot smoke'],
  bootSmokeShort: ['启动', '啟動', 'Boot'],
  bootSmokeHelp: ['对 Catalog 认可的可启动目标执行实验性通用启动验证，不包含插件专属运行检查。', '對 Catalog 認可的可啟動目標執行實驗性通用啟動驗證，不包含套件專屬執行檢查。', 'Experimental generic boot validation for Catalog-approved bootable targets; no package-specific runtime checks.'],
  help: ['说明', '說明', 'Info'],
  preview: ['预览计划', '預覽計畫', 'Preview plan'],
  submit: ['提交探针', '提交探針', 'Submit probe'],
  submittedState: ['当前 Advanced menuconfig 软件包状态已带入 GitHub Issue。', '目前 Advanced menuconfig 套件狀態已帶入 GitHub Issue。', 'The current Advanced menuconfig package state was carried into the GitHub Issue.'],
  stateInstruction: ['Probe 只传递当前 Advanced menuconfig 已解析的 PACKAGE_* 状态和探测参数，不维护第二套软件包选择，也不上传配置文件。', 'Probe 只傳遞目前 Advanced menuconfig 已解析的 PACKAGE_* 狀態與探測參數，不維護第二套套件選擇，也不上傳設定檔。', 'Probe transports only the PACKAGE_* state already resolved by Advanced menuconfig plus probe controls; it maintains no second package selection and uploads no config file.'],
  cancelInstruction: ['提交后如需取消，请在同一个 Issue 中准确回复 /cancel。', '提交後如需取消，請在同一個 Issue 中準確回覆 /cancel。', 'To cancel after submission, reply with exactly /cancel in the same Issue.'],
  permission: ['仓库所有者可以运行完整计划；有写权限的协作者最多并发 3；普通访客不能启动探针 Matrix。', '儲存庫擁有者可以執行完整計畫；具寫入權限的協作者最多同時執行 3 個工作；一般訪客不能啟動探針 Matrix。', 'Repository owners may run the full plan; write collaborators are capped at three concurrent jobs; visitors cannot start the probe Matrix.'],
  retention: ['规范化证据保留 60 天，完整探针日志保留 30 天。', '正規化證據保留 60 天，完整探針日誌保留 30 天。', 'Normalized evidence is retained for 60 days; complete probe logs are retained for 30 days.'],
  empty: ['没有找到匹配的 Advanced menuconfig 项。', '找不到相符的 Advanced menuconfig 項目。', 'No matching Advanced menuconfig option was found.'],
  invalid: ['当前 Advanced menuconfig 至少需要一个启用的软件包和一个 Source/Branch。', '目前 Advanced menuconfig 至少需要一個啟用的套件與一個 Source/Branch。', 'The current Advanced menuconfig state needs at least one enabled package and one Source/Branch entry.'],
});
function probeUiText(key) {
  const row = PROBE_UI_TEXT[key];
  return row ? uiText(row[0], row[1], row[2]) : key;
}
function probeCodeChannel() {
  const branch = String(state.buildMeta?.branch || 'main');
  if (branch.startsWith('fix/')) return branch;
  return ['dev', 'staging', 'main'].includes(branch) ? branch : 'main';
}
function meaningfulProbeText(value) {
  const text = String(value || '').trim();
  return /[\p{L}\p{N}]/u.test(text) ? text : '';
}
function firstMeaningfulProbeText(...values) {
  for (const value of values) {
    const text = meaningfulProbeText(value);
    if (text) return text;
  }
  return '';
}
function probeChoiceFromMenuOption(option) {
  const symbol = String(option?.symbol || '');
  const packageName = symbol.startsWith('PACKAGE_') ? symbol.slice('PACKAGE_'.length) : '';
  const translation = menuOptionTranslation(option);
  return {
    symbol,
    package: packageName,
    displayId: packageName || symbol,
    isPackage: Boolean(packageName),
    userSettable: option?.userSettable !== false,
    title: firstMeaningfulProbeText(translation.title, option.promptZh, option.promptEn),
    usage: firstMeaningfulProbeText(translation.usage, option.usageZh, option.usageEn),
  };
}
function probePackageChoices(query = '') {
  const normalized = normalizeMenuSearchQuery(query);
  const options = normalized.length >= 2
    ? searchMenuOptionsSync(normalized)
    : rankMenuSearchOptions(
      menuSearchOptions.filter((option) => String(option?.symbol || '').startsWith('PACKAGE_')),
      normalized,
    );
  return options
    .filter((option) => optionVisible(option) && catalogOriginMatches(option))
    .map(probeChoiceFromMenuOption);
}
function probeCurrentTarget() {
  const target = (MENU_CATALOG?.targets || []).find((item) =>
    item.board === targetSelectorValues.system && item.subtarget === targetSelectorValues.subtarget);
  const profile = target?.profiles?.find((item) => item.id === targetSelectorValues.profile);
  return target ? { target: String(target.id || ''), profile: String(profile?.id || '') } : null;
}
function probeMenuOptionState(option) {
  if (!option) return 'n';
  const raw = menuValues.get(option.symbol) ?? simpleKconfigDefault(option);
  return option.type === 'bool' || option.type === 'tristate'
    ? CATALOG_ENGINE.normalizeKconfigStateValue(option, raw) : raw;
}
function probePackageBaselineState(option) {
  if (!option) return 'n';
  let raw;
  if (catalogBaselineValues.has(option.symbol)) raw = catalogBaselineValues.get(option.symbol);
  else {
    const changedAfterBaseline = menuTouched.has(option.symbol) || catalogUserOverrides.has(option.symbol) ||
      catalogDependencySymbols.has(option.symbol) || catalogImportedSymbols.has(option.symbol);
    raw = changedAfterBaseline ? 'n' : probeMenuOptionState(option);
  }
  return option.type === 'bool' || option.type === 'tristate'
    ? CATALOG_ENGINE.normalizeKconfigStateValue(option, raw) : raw;
}
function changedProbePackageOptions() {
  return menuSearchOptions
    .filter((option) => String(option?.symbol || '').startsWith('PACKAGE_') &&
      probeMenuOptionState(option) !== probePackageBaselineState(option))
    .sort((left, right) => Number(catalogUserOverrides.has(right.symbol)) -
      Number(catalogUserOverrides.has(left.symbol)));
}
function probePackageConfigFromText(text) {
  const rows = new Map();
  for (const line of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(/^CONFIG_PACKAGE_([A-Za-z0-9][A-Za-z0-9+_.@-]{0,95})=([my])$/);
    if (match) rows.set(match[1], `CONFIG_PACKAGE_${match[1]}=${match[2]}`);
  }
  return [...rows.values()].join('\n') + (rows.size ? '\n' : '');
}
async function gzipBase64Url(text) {
  if (!('CompressionStream' in window)) {
    throw new Error(uiText('当前浏览器不支持探针状态压缩，请更新浏览器后重试。',
      '目前瀏覽器不支援探針狀態壓縮，請更新瀏覽器後重試。',
      'This browser cannot compress probe state. Update the browser and try again.'));
  }
  const compressed = new Uint8Array(await new Response(
    new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let binary = '';
  for (let i = 0; i < compressed.length; i += 0x4000) {
    binary += String.fromCharCode(...compressed.subarray(i, i + 0x4000));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
async function probeStateToken(request) {
  return `WEIG_PACKAGE_PROBE_STATE_V2:${await gzipBase64Url(JSON.stringify(request))}`;
}
function probeIssueTitle(request) {
  const packages = request.packageConfig.trim().split('\n').filter(Boolean)
    .map((line) => line.slice('CONFIG_PACKAGE_'.length, line.lastIndexOf('=')));
  const channel = String(request.channel || 'main');
  const prefix = channel === 'main' ? '' : `${channel}-`;
  const titlePackages = packages.length
    ? [`${prefix}${packages[0]}`, ...packages.slice(1, 3)].join(', ') +
      (packages.length > 3 ? ` +${packages.length - 3}` : '')
    : `${prefix}menuconfig`;
  return `[probe] ${titlePackages} · ${request.mode}`.slice(0, 200);
}
function probeIssueUrl(request, token) {
  const params = new URLSearchParams({
    template: 'package-probe.yml', title: probeIssueTitle(request), state: token,
  });
  return `https://github.com/${PROJECT.catalogRepository}/issues/new?${params}`;
}
async function openPackageProbeModal() {
  selfTestViewToken += 1;
  openModal(uiText('插件兼容探针', '套件相容性探針', 'Package Compatibility Probe'));
  const modal = $('modal').querySelector('.modal');
  modal.classList.add('package-probe');
  const body = $('modalBody');
  body.textContent = '';
  const loading = document.createElement('p');
  loading.className = 'probe-loading'; loading.textContent = uiText('正在加载 Catalog 探针数据…', '正在載入 Catalog 探針資料…', 'Loading Catalog probe data…');
  body.appendChild(loading);
  try {
    await ensureCatalogMenuLoaded(true);
    if ($('modal').hidden || !modal.classList.contains('package-probe')) return;
    modalCancelHandler = null;
    body.textContent = '';

    const intro = document.createElement('section');
    intro.className = 'probe-intro';
    const introTitle = document.createElement('h4'); introTitle.textContent = probeUiText('title');
    const introText = document.createElement('p'); introText.textContent = probeUiText('intro');
    bindUiTooltipContent(introText, { body: introText.textContent });
    const guide = document.createElement('details'); guide.className = 'probe-guide';
    const guideButton = document.createElement('summary'); guideButton.textContent = 'ⓘ';
    guideButton.setAttribute('aria-label', probeUiText('howTo'));
    const guideCopy = document.createElement('span'); guideCopy.className = 'probe-guide-copy';
    const guideIntro = document.createElement('span'); guideIntro.textContent = probeUiText('intro');
    const howTo = document.createElement('span'); howTo.textContent = probeUiText('howTo');
    guideCopy.append(guideIntro, howTo); guide.append(guideButton, guideCopy);
    intro.append(introTitle, introText, guide); body.appendChild(intro);

    const layout = document.createElement('div'); layout.className = 'probe-layout'; body.appendChild(layout);
    const settings = document.createElement('section'); settings.className = 'probe-panel probe-settings';
    const picker = document.createElement('section'); picker.className = 'probe-panel probe-picker';
    layout.append(settings, picker);

    const search = document.createElement('input'); search.className = 'probe-search'; search.type = 'search';
    search.placeholder = probeUiText('search'); search.setAttribute('aria-label', probeUiText('search'));
    const selectedBox = document.createElement('div'); selectedBox.className = 'probe-selected';
    const results = document.createElement('div'); results.className = 'probe-results';
    picker.append(search, selectedBox, results);

    const overlay = document.createElement('div'); overlay.className = 'probe-overlay'; overlay.hidden = true;
    const overlayCard = document.createElement('section'); overlayCard.className = 'probe-overlay-card';
    const overlayHead = document.createElement('div'); overlayHead.className = 'probe-overlay-head';
    const overlayTitle = document.createElement('strong');
    const overlayClose = document.createElement('button'); overlayClose.type = 'button'; overlayClose.className = 'probe-overlay-close'; overlayClose.textContent = '×';
    const overlayBody = document.createElement('div'); overlayBody.className = 'probe-overlay-body';
    overlayHead.append(overlayTitle, overlayClose); overlayCard.append(overlayHead, overlayBody); overlay.appendChild(overlayCard);
    layout.appendChild(overlay);
    const closeProbeOverlay = () => { overlay.hidden = true; overlayBody.textContent = ''; };
    const showProbeOverlay = (title, lines) => {
      overlayTitle.textContent = title;
      overlayBody.textContent = '';
      for (const line of lines) {
        const paragraph = document.createElement('p'); paragraph.textContent = line; overlayBody.appendChild(paragraph);
      }
      overlay.hidden = false; overlayClose.focus();
    };
    overlayClose.addEventListener('click', closeProbeOverlay);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closeProbeOverlay(); });

    const bindProbeTextTooltip = (element, text) => {
      if (!text) return;
      bindUiTooltipContent(element, { body: text });
    };

    const renderSelected = () => {
      selectedBox.textContent = '';
      const changed = changedProbePackageOptions();
      selectedBox.hidden = changed.length === 0;
      if (!changed.length) return;
      const label = document.createElement('strong');
      label.textContent = `${probeUiText('selected')} ${changed.length}`;
      const chips = document.createElement('div'); chips.className = 'probe-selected-chips';
      const visibleLimit = 3;
      for (const option of changed.slice(0, visibleLimit)) {
        const chip = document.createElement('button');
        chip.type = 'button'; chip.className = 'probe-chip';
        const packageName = option.symbol.slice('PACKAGE_'.length);
        const value = probeMenuOptionState(option);
        chip.textContent = `${packageName}=${String(value).toUpperCase()} ×`;
        bindUiTooltipContent(chip, { body: `CONFIG_${option.symbol}` });
        chip.addEventListener('click', () => {
          const baselineValue = probePackageBaselineState(option);
          if (setMenuValue(option, baselineValue)) {
            renderSelected(); renderResults(); void renderPreview();
          }
        });
        chips.appendChild(chip);
      }
      selectedBox.append(label, chips);
      if (changed.length > visibleLimit) {
        const more = document.createElement('button');
        more.type = 'button'; more.className = 'probe-selected-more';
        more.textContent = `+${changed.length - visibleLimit}`;
        more.addEventListener('click', () => showProbeOverlay(
          `${probeUiText('selected')} ${changed.length}`,
          changed.map((option) => {
            const packageName = option.symbol.slice('PACKAGE_'.length);
            return `${packageName}: ${String(probePackageBaselineState(option)).toUpperCase()} → ${String(probeMenuOptionState(option)).toUpperCase()}`;
          }),
        ));
        selectedBox.appendChild(more);
      }
    };
    const renderResults = () => {
      const matches = probePackageChoices(search.value).slice(0, 80);
      results.textContent = '';
      if (!matches.length) {
        const empty = document.createElement('p'); empty.className = 'probe-empty'; empty.textContent = probeUiText('empty'); results.appendChild(empty); return;
      }
      for (const choice of matches) {
        const option = menuOptionBySymbol.get(choice.symbol);
        const selectable = choice.isPackage && choice.userSettable;
        const currentValue = choice.isPackage ? probeMenuOptionState(option) : 'n';
        const activeSelected = choice.isPackage && currentValue !== 'n';
        const row = document.createElement('button'); row.type = 'button'; row.className = 'probe-package';
        row.classList.toggle('is-selected', activeSelected);
        row.classList.toggle('is-reference', !selectable);
        if (!selectable) row.setAttribute('aria-disabled', 'true');
        const mark = document.createElement('span'); mark.className = 'probe-package-mark';
        mark.textContent = choice.isPackage ? (activeSelected ? String(currentValue).toUpperCase() : '+') : '·';
        const code = document.createElement('code'); code.className = 'probe-package-id'; code.textContent = choice.displayId;
        const title = document.createElement('span'); title.className = 'probe-package-title'; title.textContent = choice.title || '—';
        const usage = document.createElement('span'); usage.className = 'probe-package-usage'; usage.textContent = choice.usage || '—';
        bindProbeTextTooltip(title, choice.title);
        bindProbeTextTooltip(usage, choice.usage);
        const rowDetails = [choice.displayId, `CONFIG_${choice.symbol}`, choice.title, choice.usage].filter(Boolean).join('\n');
        bindUiTooltipContent(row, { body: rowDetails });
        const info = document.createElement('span'); info.className = 'probe-package-info'; info.textContent = '!';
        info.setAttribute('aria-label', rowDetails);
        bindUiTooltipContent(info, { body: rowDetails });
        info.addEventListener('click', (event) => {
          event.preventDefault(); event.stopPropagation(); showDatasetTooltip(info, event);
        });
        row.append(mark, code, title, usage, info);
        row.setAttribute('aria-label', rowDetails);
        if (selectable) row.addEventListener('click', () => {
          const states = optionSelectableStates(option);
          const enableValue = states.includes('y') ? 'y' : states.find((value) => value !== 'n') || 'y';
          const nextValue = activeSelected ? 'n' : enableValue;
          if (setMenuValue(option, nextValue)) {
            renderSelected(); renderResults(); void renderPreview();
          }
        });
        results.appendChild(row);
      }
    };

    const fieldset = (legendText, className = '') => {
      const field = document.createElement('fieldset'); field.className = `probe-field ${className}`.trim();
      const legend = document.createElement('legend'); legend.textContent = legendText; field.appendChild(legend); settings.appendChild(field); return field;
    };
    const depth = fieldset(probeUiText('depth'), 'probe-depth');
    const depthOptions = [
      ['package-compile', 'packageCompile', 'packageCompileShort', 'packageCompileHelp'],
      ['rootfs-integration', 'rootfsIntegration', 'rootfsIntegrationShort', 'rootfsIntegrationHelp'],
      ['firmware-integration', 'firmwareIntegration', 'firmwareIntegrationShort', 'firmwareIntegrationHelp'],
      ['boot-smoke', 'bootSmoke', 'bootSmokeShort', 'bootSmokeHelp'],
    ];
    for (const [index, [value, labelKey, shortKey, helpKey]] of depthOptions.entries()) {
      const option = document.createElement('div'); option.className = 'probe-depth-option';
      const label = document.createElement('label'); label.className = 'probe-depth-choice';
      const input = document.createElement('input'); input.type = 'radio'; input.name = 'probeDepth'; input.value = value; input.checked = index === 0;
      const level = document.createElement('span'); level.className = 'probe-level'; level.textContent = `L${index + 1}`;
      const title = document.createElement('strong'); title.className = 'probe-depth-title';
      title.textContent = probeUiText(labelKey); title.dataset.short = probeUiText(shortKey);
      label.append(input, level, title);
      const info = document.createElement('span'); info.className = 'probe-info';
      const infoButton = document.createElement('button'); infoButton.type = 'button'; infoButton.className = 'probe-info-button';
      infoButton.textContent = 'ⓘ';
      infoButton.setAttribute('aria-label', `${probeUiText(labelKey)}: ${probeUiText(helpKey)}`);
      bindUiTooltipContent(infoButton, {
        title: `L${index + 1} · ${probeUiText(labelKey)}`,
        body: probeUiText(helpKey),
      });
      infoButton.addEventListener('click', (event) => {
        event.preventDefault(); event.stopPropagation(); showDatasetTooltip(infoButton, event);
      });
      info.appendChild(infoButton); option.append(label, info); depth.appendChild(option);
      input.addEventListener('change', renderPreview);
    }

    const filterRow = document.createElement('div'); filterRow.className = 'probe-filter-row'; settings.appendChild(filterRow);
    const selectField = (labelText, className) => {
      const label = document.createElement('label'); label.className = `probe-select-field ${className}`;
      const title = document.createElement('strong'); title.textContent = labelText;
      const select = document.createElement('select'); select.className = 'probe-select';
      label.append(title, select); filterRow.appendChild(label); return select;
    };
    const addSelectOption = (select, value, text, disabled = false) => {
      const option = document.createElement('option'); option.value = value; option.textContent = text; option.disabled = disabled; select.appendChild(option);
    };
    const scopeSelect = selectField(probeUiText('scope'), 'probe-scope-field');
    addSelectOption(scopeSelect, 'all', probeUiText('allSources'));
    addSelectOption(scopeSelect, 'current', probeUiText('currentSource'));
    addSelectOption(scopeSelect, 'custom', probeUiText('customScope'));
    const currentTarget = probeCurrentTarget();
    const targetSelect = selectField(probeUiText('targets'), 'probe-target-field');
    addSelectOption(targetSelect, 'auto', probeUiText('autoTarget'));
    addSelectOption(targetSelect, 'current', currentTarget
      ? `${probeUiText('currentTarget')} · ${currentTarget.target} / ${currentTarget.profile || '-'}`
      : probeUiText('currentTarget'), !currentTarget);
    addSelectOption(targetSelect, 'all', probeUiText('allTargets'));

    const customScope = document.createElement('details'); customScope.className = 'probe-custom-scope'; customScope.hidden = true; customScope.open = true; settings.appendChild(customScope);
    const customScopeSummary = document.createElement('summary'); customScopeSummary.className = 'probe-custom-scope-summary';
    const customScopeTitle = document.createElement('strong');
    const customScopeToggle = document.createElement('span'); customScopeToggle.className = 'probe-custom-scope-toggle';
    customScopeSummary.append(customScopeTitle, customScopeToggle); customScope.appendChild(customScopeSummary);
    const customScopeBody = document.createElement('div'); customScopeBody.className = 'probe-custom-scope-body'; customScope.appendChild(customScopeBody);
    const branchSearch = document.createElement('input'); branchSearch.type = 'search'; branchSearch.className = 'probe-branch-search';
    branchSearch.placeholder = `${probeUiText('customScope')} · Source/Branch`;
    branchSearch.setAttribute('aria-label', branchSearch.placeholder);
    const branchList = document.createElement('div'); branchList.className = 'probe-branches'; customScopeBody.append(branchSearch, branchList);
    const updateCustomScopeSummary = () => {
      const count = branchList.querySelectorAll('input:checked').length;
      customScopeTitle.textContent = `${probeUiText('customScope')} · ${uiText('已选', '已選', 'Selected')} ${count}`;
      customScopeToggle.textContent = customScope.open ? uiText('收起', '收起', 'Collapse') : uiText('展开', '展開', 'Expand');
    };
    for (const source of MENU_INDEX?.sources || []) for (const branch of source.branches || []) {
      if (branch.state === 'unavailable') continue;
      const label = document.createElement('label');
      const input = document.createElement('input'); input.type = 'checkbox'; input.value = `${source.id}\0${branch.branch}`;
      const text = `${source.label || source.id} / ${branch.branch}`;
      label.dataset.search = text.toLocaleLowerCase();
      input.addEventListener('change', () => { updateCustomScopeSummary(); renderPreview(); }); label.append(input, document.createTextNode(text)); branchList.appendChild(label);
    }
    updateCustomScopeSummary();
    customScope.addEventListener('toggle', updateCustomScopeSummary);
    scopeSelect.addEventListener('change', () => {
      customScope.hidden = scopeSelect.value !== 'custom';
      if (!customScope.hidden) customScope.open = true;
      updateCustomScopeSummary();
      renderPreview();
    });
    targetSelect.addEventListener('change', renderPreview);
    branchSearch.addEventListener('input', () => {
      const query = branchSearch.value.trim().toLocaleLowerCase();
      for (const label of branchList.querySelectorAll('label')) label.hidden = !!query && !label.dataset.search.includes(query);
    });
    layout.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeProbeOverlay(); });

    const preview = document.createElement('pre'); preview.className = 'probe-preview'; preview.hidden = true; layout.appendChild(preview);
    const actions = document.createElement('div'); actions.className = 'modal-actions probe-actions';
    const helpButton = document.createElement('button'); helpButton.type = 'button'; helpButton.className = 'btn probe-help-button'; helpButton.textContent = probeUiText('help');
    helpButton.addEventListener('click', () => showProbeOverlay(probeUiText('help'), [
      probeUiText('stateInstruction'), probeUiText('howTo'), probeUiText('cancelInstruction'),
      probeUiText('permission'), probeUiText('retention'),
    ]));
    const actionsSpacer = document.createElement('span'); actionsSpacer.className = 'probe-actions-spacer'; actionsSpacer.setAttribute('aria-hidden', 'true');
    const previewButton = document.createElement('button'); previewButton.type = 'button'; previewButton.className = 'btn'; previewButton.textContent = probeUiText('preview');
    previewButton.setAttribute('aria-expanded', 'false');
    const submitButton = document.createElement('button'); submitButton.type = 'button'; submitButton.className = 'btn btn-primary'; submitButton.textContent = probeUiText('submit');
    actions.append(helpButton, actionsSpacer, previewButton, submitButton); layout.appendChild(actions);

    const requestValue = async () => {
      const scopeMode = scopeSelect.value || 'all';
      let requestScope = { mode: 'all' };
      if (scopeMode === 'current') {
        const source = selectedCatalogSource(), branch = selectedCatalogBranch(source);
        requestScope = { mode: 'pairs', pairs: [[String(source?.id || ''), String(branch?.branch || '')]] };
      } else if (scopeMode === 'custom') {
        requestScope = { mode: 'pairs', pairs: [...branchList.querySelectorAll('input:checked')].map((input) => input.value.split('\0')) };
      }
      const targetMode = targetSelect.value || 'auto';
      const targetPolicy = targetMode === 'current'
        ? { mode: 'selected', selections: [currentTarget] }
        : { mode: targetMode };
      const resolvedConfig = await generateResolvedConfigText();
      return {
        schema: 2, channel: probeCodeChannel(),
        mode: depth.querySelector('input[name=probeDepth]:checked')?.value || 'package-compile',
        packageConfig: probePackageConfigFromText(resolvedConfig),
        scope: requestScope, targetPolicy, maxParallel: 0, execute: true,
      };
    };
    let previewRequest = 0;
    async function renderPreview() {
      const sequence = ++previewRequest;
      submitButton.disabled = true;
      try {
        const request = await requestValue();
        if (sequence !== previewRequest) return null;
        const valid = Boolean(request.packageConfig.trim()) &&
          (request.scope.mode !== 'pairs' || request.scope.pairs.every((row) => row[0] && row[1]) && request.scope.pairs.length > 0);
        preview.textContent = valid ? JSON.stringify(request, null, 2) : probeUiText('invalid');
        submitButton.disabled = !valid;
        return valid ? request : null;
      } catch (error) {
        if (sequence === previewRequest) {
          preview.textContent = String(error?.message || error);
          submitButton.disabled = true;
        }
        return null;
      }
    }
    previewButton.addEventListener('click', () => {
      const opening = preview.hidden;
      preview.hidden = !opening; previewButton.setAttribute('aria-expanded', String(opening));
      if (opening) void renderPreview();
    });
    submitButton.addEventListener('click', async () => {
      submitButton.disabled = true;
      try {
        const request = await requestValue();
        const valid = Boolean(request.packageConfig.trim()) &&
          (request.scope.mode !== 'pairs' || request.scope.pairs.every((row) => row[0] && row[1]) && request.scope.pairs.length > 0);
        if (!valid) { await renderPreview(); return; }
        const token = await probeStateToken(request);
        const issueUrl = probeIssueUrl(request, token);
        showToast(probeUiText('submittedState'));
        const issueWindow = window.open(issueUrl, '_blank');
        if (issueWindow) issueWindow.opener = null; else window.location.assign(issueUrl);
      } catch (error) {
        showToast(String(error?.message || error).split(';')[0]);
      } finally {
        await renderPreview();
      }
    });
    search.addEventListener('input', renderResults);
    renderSelected(); renderResults(); void renderPreview(); search.focus();
  } catch (error) {
    body.textContent = '';
    const failure = document.createElement('p'); failure.className = 'import-error'; failure.textContent = String(error?.message || error); body.appendChild(failure);
  }
}
$('modalProbe').addEventListener('click', openPackageProbeModal);
