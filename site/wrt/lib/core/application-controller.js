/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Application initialization and feature coordination.
 */
'use strict';

let firmwareThemeExplicit = false;

function storedPreference(key) {
  try { return localStorage.getItem(key); }
  catch (error) { return null; }
}

function projectCustomization() {
  return PROJECT?.customization && typeof PROJECT.customization === 'object'
    ? PROJECT.customization : {};
}

function applyProjectLinks() {
  const links = PROJECT?.links;
  if (!links || typeof links !== 'object') throw new Error('Site configuration is missing public links');
  const assign = (id, key) => { const link = $(id); if (link) link.href = links[key]; };
  assign('repoLink', 'repository');
  assign('footRepo', 'repository');
  assign('actionsLink', 'actions');
  document.querySelectorAll('[data-project-catalog-link]').forEach((link) => { link.href = links.catalog; });
  document.querySelectorAll('.blog-link').forEach((link) => {
    if (links.blog) { link.href = links.blog; link.hidden = false; }
    else { link.hidden = true; link.removeAttribute('href'); }
  });
}

async function applyProjectCustomization() {
  const customization = projectCustomization();
  const ui = customization.ui && typeof customization.ui === 'object' ? customization.ui : {};
  const firmware = customization.firmware && typeof customization.firmware === 'object'
    ? customization.firmware : {};
  const build = customization.build && typeof customization.build === 'object' ? customization.build : {};

  const savedColorMode = storedPreference('wrt_theme');
  if (!['auto', 'light', 'dark'].includes(savedColorMode) &&
      ['auto', 'light', 'dark'].includes(ui.colorMode)) {
    globalThis.__WEIG_APPLY_THEME__?.(ui.colorMode);
    PAGE_SHELL_CONTROLLER?.refreshThemeControl?.();
  }

  if (!storedPreference('wrt_lanip') && LANIP_RE.test(String(firmware.lanIp || ''))) {
    state.lanip = String(firmware.lanIp);
  }
  if (Object.hasOwn(NTP_PRESETS, firmware.ntp?.preset)) state.ntp = firmware.ntp.preset;
  if (typeof firmware.theme === 'string' && /^luci-theme-[A-Za-z0-9._+-]{1,48}$/.test(firmware.theme)) {
    state.theme = firmware.theme;
  }
  if (!packageMirrorSelectionExplicit && typeof firmware.packageMirror === 'string') {
    state.packageMirror = firmware.packageMirror;
  }

  const tag = $('tagBox');
  if (tag && !tag.value.trim() && typeof build.defaultTag === 'string') {
    tag.value = BUILD_IDENTITY_MODULE.normalizeBuildTag(build.defaultTag, build.defaultTag);
  }
}

function applyProjectCatalogDefaults() {
  const firmware = projectCustomization().firmware;
  if (!firmware || !MENU_CATALOG || !CATALOG_MODEL) return;

  const configuredTheme = String(firmware.theme || '');
  const configuredSymbol = `PACKAGE_${configuredTheme}`;
  if (!state.importedConfig && !firmwareThemeExplicit) {
    if (configuredTheme && menuOptionBySymbol.has(configuredSymbol)) {
      try {
        setFirmwareTheme(configuredTheme);
        const resolved = resolveCatalogTheme();
        if (resolved.package && resolved.package !== configuredTheme) setFirmwareTheme(resolved.package);
      } catch (error) {
        const fallback = resolveCatalogTheme().package;
        try { setFirmwareTheme(fallback || '@base'); }
        catch (fallbackError) { state.theme = '@base'; renderFirmwareSettings(); }
      }
    } else {
      const fallback = resolveCatalogTheme().package;
      try { setFirmwareTheme(fallback || '@base'); }
      catch (error) { state.theme = '@base'; renderFirmwareSettings(); }
    }
  }
  if (!packageMirrorSelectionExplicit && typeof firmware.packageMirror === 'string') {
    const previousExplicit = packageMirrorSelectionExplicit;
    packageMirrorSelectionExplicit = true;
    try {
      state.packageMirror = firmware.packageMirror;
      renderFirmwareSettings();
    } finally {
      packageMirrorSelectionExplicit = previousExplicit;
    }
  }
}

/* ============ Initialization ============ */
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
      applyProjectCatalogDefaults();
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
    PROJECT = await loadSiteConfig();
    OFFICIAL_REPO = PROJECT.repository;
    REPO_NAME = OFFICIAL_REPO.split('/')[1];
    MENU_CATALOG_REPO = PROJECT.catalogRepository;
    applyProjectLinks();
    state.siteConfigReady = true;
    const deploymentIdentity = await loadDeploymentIdentity();
    state.siteVersion = deploymentIdentity.siteVersion;
    state.buildMeta = deploymentIdentity.buildMeta;
    state.catalogBindings = deploymentIdentity.catalogBindings;
    MENU_CATALOG_DATA_REF = BUILD_IDENTITY_MODULE.catalogDataBranch(state.buildMeta?.branch);
    MENU_CATALOG_BINDING = state.catalogBindings?.[MENU_CATALOG_DATA_REF] || null;
    CATALOG_LOADER = CATALOG_LOADER_MODULE.createCatalogLoader({
      repository: MENU_CATALOG_REPO,
      releaseTag: PROJECT?.catalogReleaseTag || 'menuconfig-catalog-complete',
      dataRef: MENU_CATALOG_DATA_REF,
      expectedBinding: MENU_CATALOG_BINDING,
      allowReleaseFallback: MENU_CATALOG_DATA_REF === 'catalog-main',
      engine: CATALOG_ENGINE,
    });
    TIMEZONES = await loadJson('timezones.json');
    initializeTimezone();
    await applyProjectCustomization();
    renderLangSel();
    renderBuildInfo();
    resetPluginWorkspace(PLUGINS);
    renderDevices();
    renderModes();
    $('fwThemeBox')?.addEventListener('change', () => { firmwareThemeExplicit = true; });
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
    resetAdvGrey();   // V10: gate row follows the remembered developer mode, but always starts unticked
    $('loading').hidden = true;
    $('form').hidden = false;
    $('actionbar').hidden = false;
    if (localStorage.getItem('wrt_risk') !== 'ok') $('riskBar').hidden = false;
    startCatalogAfterFirstPaint();
  } catch (err) {
    PROJECT = null;
    state.siteConfigReady = false;
    state.buildMeta = null;
    updateSubmitGate?.();
    $('loading').textContent = (I18N ? t('loading.fail', { msg: err.message }) : 'Loading failed: ' + err.message);
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
