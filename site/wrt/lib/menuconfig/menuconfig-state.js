/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Menuconfig state layers, Kconfig intent application, scalar values, and state restoration.
 */
'use strict';

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
    const forcedDetail = forced ? t('runtime.3cac4bbb48cb', { value1: String(desired).toUpperCase(), value2: String(value).toUpperCase(), value3: selectors }) : '';
    return desired === 'n'
      ? {
        kind: 'user-exclude', label: t('runtime.97312fbcf425'), restorable: true,
        detail: forcedDetail || t('runtime.0f088e364c91'),
      }
      : {
        kind: 'user', label: t('runtime.3a8e2a20d9e6'), restorable: true,
        detail: forcedDetail || t('runtime.aba4dcbf4554'),
      };
  }
  if (catalogImportedSymbols.has(symbol)) {
    return {
      kind: 'imported', label: t('runtime.fc6a8726af47'),
      detail: t('runtime.2de3a959727e'),
    };
  }
  if (catalogRecommendedValues.has(symbol)) {
    return {
      kind: 'recommended', label: t('runtime.00e0a7cbc9fa'),
      detail: t('runtime.a3cdbd2b5fcd'),
    };
  }
  if (catalogConditionalDefaultSymbols.has(symbol)) {
    return {
      kind: 'kconfig-default', displayKind: 'default', label: t('runtime.1e1ebdf2f697'),
      detail: t('runtime.b8449dfad59f'),
    };
  }
  if (catalogDependencySymbols.has(symbol)) {
    return {
      kind: 'dependency', label: t('runtime.dcaa0b4fbf15'),
      detail: t('runtime.c0d9450279ea'),
    };
  }
  if (value !== 'n' && value !== '') {
    const baseline = catalogBaselineOrigins.get(symbol);
    if (baseline) {
      return {
        kind: baseline.kind, displayKind: 'default', label: t('runtime.1e1ebdf2f697'),
        detail: t('runtime.1b3bf771bc81'),
      };
    }
  }
  return { kind: 'inactive', label: t('runtime.4dcb53e47fd4') };
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
function recordCatalogExplicitIntent(option, value) {
  if (!option?.symbol) return 'user';
  const override = CATALOG_ENGINE?.resolveCatalogUserOverride
    ? CATALOG_ENGINE.resolveCatalogUserOverride(catalogInheritedValue(option.symbol), value)
    : (catalogInheritedValue(option.symbol) === value ? null : value);
  if (override === null) {
    catalogUserOverrides.delete(option.symbol);
    if (!catalogRecommendedValues.has(option.symbol) && !catalogImportedSymbols.has(option.symbol)) {
      menuTouched.delete(option.symbol);
    }
    return 'restore';
  }
  catalogUserOverrides.set(option.symbol, override);
  menuTouched.add(option.symbol);
  return 'user';
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
    let directIntentChanged = false;
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
        curatedSource = recordCatalogExplicitIntent(changedOption || option, change.to);
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
    // A prerequisite step can activate an explicit target through Kconfig
    // select before the target Intent is replayed. In that case the target
    // applyUserIntent call is still meaningful even though it returns no
    // value changes; record only this user call as direct Intent. The select
    // change above remains dependency-owned and is never promoted here.
    if (source === 'user' && !result.changes.some((change) => change.symbol === option.symbol)) {
      const beforeOverride = catalogUserOverrides.has(option.symbol)
        ? catalogUserOverrides.get(option.symbol) : undefined;
      const beforeTouched = menuTouched.has(option.symbol);
      const beforeDependency = catalogDependencySymbols.has(option.symbol);
      const curatedSource = recordCatalogExplicitIntent(option, value);
      catalogConditionalDefaultSymbols.delete(option.symbol);
      catalogDependencySymbols.delete(option.symbol);
      syncMenuToCurated(option, menuValues.get(option.symbol) ?? value, curatedSource);
      syncFirmwareThemeFromMenu(option, menuValues.get(option.symbol) ?? value);
      directIntentChanged = beforeOverride !== (catalogUserOverrides.has(option.symbol)
        ? catalogUserOverrides.get(option.symbol) : undefined) ||
        beforeTouched !== menuTouched.has(option.symbol) ||
        beforeDependency !== catalogDependencySymbols.has(option.symbol);
    }
    if (result.changes.length || directIntentChanged) markCatalogStateChanged();
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
