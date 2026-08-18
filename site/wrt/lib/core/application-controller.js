/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Application initialization and feature coordination.
 */
'use strict';

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
