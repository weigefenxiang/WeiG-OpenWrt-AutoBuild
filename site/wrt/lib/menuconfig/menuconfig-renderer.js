/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Menuconfig controls, option rendering, navigation, search results, and N/M/Y interaction.
 */
'use strict';

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
      ? t('runtime.273005ab00cf', { value1: selector.condition, value2: selector.conditionLevel === 2 ? 'Y' : 'M' })
      : '';
    return `${selector.sourceSymbol}=${selector.sourceValue.toUpperCase()}${condition}`;
  });
  const range = t('runtime.98d3760852e2', { value1: constraints.current.toUpperCase(), value2: constraints.maximum.toUpperCase(), value3: constraints.minimum.toUpperCase() });
  let emphasis = '';
  if (stateRow.selectable) {
    emphasis = t('runtime.adcf5f9d2e9d', { value1: stateValue.toUpperCase() });
  } else if (constraints.readOnly && (option.defaults || []).length) {
    emphasis = t('runtime.2338fb34620f');
  } else if (constraints.readOnly) {
    emphasis = t('runtime.27c3d86dcde6');
  } else if (stateRow.code === 'selected-lower-bound' || stateRow.code === 'selected-fixed') {
    emphasis = t('runtime.c20064818b85', { value1: constraints.minimum.toUpperCase() });
  } else if (stateRow.code === 'dependency-upper-bound') {
    emphasis = t('runtime.03149303f94c', { value1: constraints.maximum.toUpperCase() });
  } else if (stateRow.code === 'cannot-disable') {
    emphasis = t('runtime.7a54336d3023');
  } else {
    emphasis = t('runtime.c6f6222ba9fe');
  }
  const body = [range,
    selectorLines.length ? t('runtime.8e296151802b', { value1: selectorLines.join('\n') }) : '',
    option.depends?.length ? t('runtime.67e6fec23983', { value1: option.depends.join(' && ') }) : '',
    option.defaults?.length ? t('menu.defaults', {
      list: formatSemicolonList(option.defaults),
    }) : '',
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
      input.dataset.uiTooltipEmphasis = t('runtime.cc8d0739ba58');
      input.dataset.uiTooltipBody = t('runtime.f7342b9246cb');
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
      placeholder.textContent = t('menu.selectPlaceholder');
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
      ? t('runtime.6ce447e77671')
      : query.length === 1
        ? t('runtime.9f5987feadba')
        : t('runtime.6d011963e408') });
    list.appendChild(empty);
  }
  panel.hidden = !options.length && !!nodes.length;
  $('menuconfigMore').hidden = true;
  $('menuconfigScroll').dataset.hasMore = String(ordinaryCount > menuVisibleLimit);
  renderImportedWorkspace();
}
