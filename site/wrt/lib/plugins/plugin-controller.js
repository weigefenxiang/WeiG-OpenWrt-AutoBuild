/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Curated plugin list, search, selection, status, and selected-items controller.
 */
'use strict';

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
    ? t('runtime.63941ac41ca8', { value1: detail })
    : empty
      ? t('runtime.e9cdb3a9cf41')
      : t('runtime.df1f88866ee9');
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
  if (catalogLocked) bindUiTooltipContent(item, { body: t('runtime.df77507c4802') });
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
  const detail = (st === 'loading' ? t('runtime.eb7b1b411bf8')
    : st === 'builtin' ? t('plugin.builtin')
    : st === 'unavailable' ? t('plugin.unavailable')
    : pDesc(p)) + (catalogOrigin && catalogOrigin.kind !== 'inactive'
      ? `\n${t('runtime.463daf3dbfcf')}: ${catalogOrigin.label}` : '') +
    (p.warn ? '\n' + t(p.warn) : '');
  const pkg = p.pkgs?.[state.source.id] || p.pkg || p.catalogCandidates?.[0] || p.id;
  const size = p.sizeBytes === null ? t('runtime.7b4f86f4a586')
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
  openModal(t('runtime.b5c369e34dc1'));
  $('modal').querySelector('.modal').classList.add('rootfs-guidance');
  const body = $('modalBody');
  body.textContent = '';

  const row = document.createElement('div');
  row.className = 'rootfs-guidance-row';
  const project = document.createElement('span');
  project.textContent = `${t('runtime.2be977a1c305')}：${info.project}`;
  const current = document.createElement('strong');
  current.textContent = `${t('runtime.0204d291b0db')}：${info.value} MiB`;
  row.append(project, current);

  const path = document.createElement('div');
  path.className = 'rootfs-guidance-path';
      path.textContent = `${t('runtime.c2e92eeeb4e6')}：${[...(info.path.length ? info.path : [t('menu.targetImages')]), ROOTFS_PARTSIZE_SYMBOL].join(' → ')}`;

  const note = document.createElement('p');
  note.className = 'rootfs-guidance-note';
  note.textContent = t('runtime.0e8a6d518ade');

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn';
  close.textContent = t('runtime.36463e27a8e1');
  close.onclick = closeModal;
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'btn btn-primary';
  edit.textContent = t('runtime.2195ea1653d1');
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
    bindUiTooltipContent(capText, { body: t('runtime.2b2a5917809a') });
  } else {
    $('capBox').hidden = false;
    capText.disabled = true;
    capText.classList.remove('rootfs-capacity');
    const knownBytes = sel.all.reduce((sum, plugin) => sum + (plugin.sizeBytes || 0), 0);
    const unknownCount = sel.all.filter((plugin) => !plugin.sizeBytes).length;
    $('capFill').style.width = '0';
    $('capFill').className = 'cap-fill';
    capText.textContent = knownBytes
      ? `${t('runtime.5d97d13c4b9d')} ${fmtSize(knownBytes)}`
      : t('runtime.df187d1a812b');
    bindUiTooltipContent(capText, { body: unknownCount
      ? t('runtime.9fa9e63322ab', { value1: unknownCount })
      : t('runtime.a6286fdab37d') });
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
    sz.textContent = p.sizeBytes === null ? t('runtime.7b4f86f4a586')
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
