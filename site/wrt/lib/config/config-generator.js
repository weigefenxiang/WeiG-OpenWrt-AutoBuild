/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Configuration serialization, generation, and download.
 */
'use strict';

function serializeKconfigValue(value, type = 'unknown', symbol = 'Kconfig option') {
  const raw = String(value ?? '');
  const normalizedType = String(type || 'unknown').toLowerCase();
  if (normalizedType === 'unknown') return raw === 'n' ? null : raw;
  let normalized = raw;
  if (normalizedType === 'string' && /^"(?:[^"\\]|\\.)*"$/.test(raw)) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string') normalized = parsed;
    } catch (error) { /* quote the literal input below */ }
  }
  normalized = normalizeKconfigValueByType(normalized, normalizedType, symbol);
  if (normalizedType === 'bool' || normalizedType === 'tristate') {
    return normalized === 'n' ? null : normalized;
  }
  if (normalizedType === 'string') return JSON.stringify(normalized);
  return normalized;
}
function setConfigSymbol(text, symbol, value, type = 'unknown') {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const serialized = serializeKconfigValue(value, type, symbol);
  const line = serialized === null
    ? `# CONFIG_${symbol} is not set`
    : `CONFIG_${symbol}=${serialized}`;
  const pattern = new RegExp(`^(?:CONFIG_${escaped}=.*|# CONFIG_${escaped} is not set)$`, 'm');
  if (pattern.test(text)) return text.replace(pattern, line);
  return text.replace(/\s*$/, '\n') + line + '\n';
}
function applyMenuConfig(text) {
  if (!MENU_CATALOG) return text;
  const serialized = new Set([
    ...menuTouched, ...catalogRecommendedValues.keys(),
    ...catalogUserOverrides.keys(), ...catalogImportedSymbols,
    ...catalogDependencySymbols,
  ]);
  for (const option of menuSearchOptions) {
    if (option.visible !== false && option.userSettable !== false && !option.hidden) continue;
    const value = catalogBaselineValues.get(option.symbol);
    if (value !== undefined && value !== 'n' && value !== '') serialized.add(option.symbol);
  }
  for (const symbol of serialized) {
    const option = menuOptionBySymbol.get(symbol);
    if (option) text = setConfigSymbol(text, symbol, String(menuValues.get(symbol) ?? 'n'), option.type);
  }
  return text;
}
function applyImportedUnknownEdits(text) {
  for (const [symbol, edit] of importedUnknownEdits) {
    if (edit.action === 'delete') {
      const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp(`^(?:CONFIG_${escaped}=.*|# CONFIG_${escaped} is not set)\\r?\\n?`, 'm'), '');
    } else {
      text = setConfigSymbol(text, symbol, String(edit.value ?? 'n'));
    }
  }
  return text;
}
function catalogTargetConfig() {
  if (!ACTIVE_PROFILE_BASELINE || !PROFILE_BASELINE_MODULE) {
    throw new Error('Native Profile baseline has not finished loading');
  }
  return applyMenuConfig(PROFILE_BASELINE_MODULE.serializeConfigMap(ACTIVE_PROFILE_BASELINE.values));
}

function importedConfigOnCurrentBaseline(text) {
  if (state.device.id !== 'catalog-target') return text;
  if (!ACTIVE_PROFILE_BASELINE || !PROFILE_BASELINE_MODULE || !CATALOG_MODEL?.bySymbol) return text;
  const merged = PROFILE_BASELINE_MODULE.mergeConfigWithProfileBaseline(
    ACTIVE_PROFILE_BASELINE,
    text,
    { allowedSymbols: new Set(CATALOG_MODEL.bySymbol.keys()) },
  );
  return PROFILE_BASELINE_MODULE.serializeConfigMap(merged.values);
}

function applyProfilePackageOverrides(text) {
  for (const [packageName, mode] of profilePackageOverrides) {
    if (!/^[A-Za-z0-9._+@-]+$/.test(packageName)) {
      throw new Error(`Catalog profile package is invalid: ${packageName}`);
    }
    text = setConfigSymbol(text, `PACKAGE_${packageName}`, mode === 'include' ? 'y' : 'n', 'bool');
  }
  return text;
}
function applyToConfig(text, sel) {
  const src = state.source.id;
  for (const pair of state.variant.patch || []) text = text.split(pair.from).join(pair.to);
  const setY = (pkg) => {
    const notset = '# CONFIG_PACKAGE_' + pkg + ' is not set';
    const asM = 'CONFIG_PACKAGE_' + pkg + '=m';
    const asY = 'CONFIG_PACKAGE_' + pkg + '=y';
    if (text.includes(notset)) text = text.replace(notset, asY);
    else if (text.includes(asM + '\n') || text.endsWith(asM)) text = text.replace(asM, asY);
    else if (!text.includes(asY)) text += '\n' + asY;
  };
  for (const p of sel.all) setY(p.pkgs?.[src] || p.pkg);
  for (const p of sel.removed) {
    const pkg = p.pkgs?.[src] || p.pkg;
    text = text.replace('CONFIG_PACKAGE_' + pkg + '=y', '# CONFIG_PACKAGE_' + pkg + ' is not set');
  }
  const zone = currentTimezone();
  text = applyImportedUnknownEdits(text);
  text = applyMenuConfig(text);
  text = applyProfilePackageOverrides(text);
  const themeResolution = resolveCatalogTheme();
  const resolvedTheme = themeResolution.package;
  if (!resolvedTheme) throw new Error('Catalog/Kconfig did not resolve an enabled LuCI theme');
  for (const change of themeResolution.changes || []) {
    const option = menuOptionBySymbol.get(change.symbol);
    const value = themeResolution.values.get(change.symbol);
    if (!option || value === undefined || value === 'n' || value === '') continue;
    text = setConfigSymbol(text, change.symbol, value, option.type);
  }
  return '# Generated by WeiG-OpenWrt-AutoBuild web customizer\n' +
    '# page-version=' + state.siteVersion + '\n' +
    '# device=' + state.device.id + ' source=' + src + ' version=' + state.version.id +
    ' (' + state.version.branch + ') variant=' + state.variant.id + '\n' +
    '# firmware-settings: zonename=' + zone.zonename + ' timezone=' + zone.timezone + ' theme=' + resolvedTheme +
    ' ntp=' + state.ntp + ' package-mirror=' + state.packageMirror + '\n' +
    '# plugins: ' + (sel.normal.map((p) => p.id).join(' ') || '(none)') + '\n' +
    (sel.forced.length ? '# forced (advanced): ' + sel.forced.map((p) => p.id).join(' ') + '\n' : '') +
    (sel.removed.length ? '# removed builtin (advanced): ' + sel.removed.map((p) => p.id).join(' ') + '\n' : '') + text;
}
function resolveCatalogTheme() {
  return CATALOG_ENGINE?.resolveEffectiveTheme
    ? CATALOG_ENGINE.resolveEffectiveTheme(CATALOG_MODEL, state.device?.target, menuValues, {
      explicitSymbols: catalogUserOverrides.keys(),
      preferredSymbol: state.theme === '@base' ? '' : `PACKAGE_${state.theme}`,
    })
    : { package: '', symbol: '', symbols: [] };
}
function resolveConfigTheme(text) {
  const metadata = String(text).match(/^# firmware-settings: .* theme=([^\s]+) ntp=/m)?.[1];
  return metadata || resolveCatalogTheme().package;
}
function configFirmwareSettings(text) {
  const match = String(text).match(/^# firmware-settings: .* theme=([^\s]+) ntp=/m);
  return { timezone: state.timezone, theme: match?.[1] || resolveConfigTheme(text),
    ntp: state.ntp, packageMirror: state.packageMirror };
}

async function generateConfigText() {
  if (state.device.id === 'catalog-target') {
    const source = selectedCatalogSource();
    const branch = selectedCatalogBranch(source);
    if (!MENU_CATALOG || menuCatalogKey !== `${source.id}/${branch.branch}` ||
        state.source.id !== source.id || state.version.branch !== branch.branch) {
      throw new Error('The selected menuconfig catalog has not finished loading');
    }
  }
  const configId = [state.device.id, state.source.id, state.version.id, state.variant.id].join('/');
  let raw;
  if (state.importedConfig &&
      (state.importedConfigId === configId || ['custom-target', 'catalog-target'].includes(state.device.id))) {
    raw = importedConfigOnCurrentBaseline(state.importedConfig);
  } else if (state.device.id === 'catalog-target') {
    raw = catalogTargetConfig();
  } else {
    throw new Error('This workspace requires an uploaded authoritative .config');
  }
  let config = applyToConfig(raw, effectiveSelection());
  return config;
}

function localStamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return String(now.getFullYear()).slice(-2) + pad(now.getMonth() + 1) + pad(now.getDate()) +
    '_' + pad(now.getHours()) + pad(now.getMinutes());
}
function safeDownloadNamePart(value, fallback = 'profile') {
  const cleaned = String(value || '').trim().replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function selectedTargetProfileName() {
  const profile = state.device?.target?.profileSymbol || state.variant?.profile || state.variant?.id;
  return String(profile || '').replace(/^DEVICE_/, '') || 'profile';
}

function selectedTargetProfileLabel() {
  return String(state.device?.target?.profileLabel || selectedTargetProfileName()).trim() || 'profile';
}

function requestTargetProfilePart(forFilename = false) {
  const forbidden = forFilename ? /[\\/:*?"<>|]+/g : /[\\:*?"<>|]+/g;
  return selectedTargetProfileLabel().replace(/\s+/g, '_').replace(forbidden, '-').replace(/^-+|-+$/g, '') || 'profile';
}

function downloadBlob(text, type, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function generationErrorItems(error) {
  const message = String(error?.message || error || '').trim() || t('runtime.b4dbf4eeb0e4');
  const parts = message.split(/;\s*/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [message];
}
function showGenerationError(error) {
  modalCancelHandler = null;
  openModal(t('generation.error.title'));
  const modal = $('modal').querySelector('.modal');
  modal.classList.remove('modal-wide', 'modal-import-source', 'recommended-config',
    'profile-package-config');
  modal.classList.add('generation-error');
  const body = $('modalBody');
  body.textContent = '';

  const list = document.createElement('div');
  list.className = 'generation-error-list';
  for (const message of generationErrorItems(error)) {
    const item = document.createElement('div');
    item.className = 'generation-error-item';
    item.textContent = message;
    list.appendChild(item);
  }
  body.appendChild(list);

  const hint = document.createElement('p');
  hint.className = 'generation-error-hint';
  hint.textContent = t('generation.error.hint');
  body.appendChild(hint);

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const selfTest = document.createElement('button');
  selfTest.type = 'button';
  selfTest.className = 'btn btn-primary';
  selfTest.textContent = t('btn.selfTest');
  selfTest.addEventListener('click', () => {
    modalCancelHandler = null;
    closeModal();
    setTimeout(() => $('selfTestBtn').click(), 0);
  });
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn';
  close.textContent = t('btn.close');
  close.addEventListener('click', closeModal);
  actions.append(selfTest, close);
  body.appendChild(actions);
}

async function downloadConfig(btn) {
  btn.disabled = true;
  btn.textContent = t('btn.download.busy');
  try {
    const text = await generateResolvedConfigText();
    downloadBlob(text, 'text/plain;charset=utf-8',
      [state.device.id, localStamp(), state.source.id, state.version.id, state.variant.id].join('-') + '.config');
  } catch (err) {
    showGenerationError(err);
  } finally {
    btn.disabled = false;
    btn.textContent = t('btn.download');
  }
}

/* ============ 加载 .config / build-request.json / config.buildinfo ============ */
let lastImportLog = null;
let configImportSeq = 0;
