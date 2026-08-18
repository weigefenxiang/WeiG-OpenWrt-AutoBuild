/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Imported configuration state and editor presentation.
 */
'use strict';

function parseConfigEntries(text) {
  const entries = new Map();
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const enabled = line.match(/^CONFIG_([A-Za-z0-9_.+@-]+)=(.*)$/);
    const disabled = line.match(/^# CONFIG_([A-Za-z0-9_.+@-]+) is not set$/);
    if (enabled) entries.set(enabled[1], { value: enabled[2], disabled: false, raw: line });
    else if (disabled) entries.set(disabled[1], { value: 'n', disabled: true, raw: line });
  }
  return entries;
}
function parseConfigValues(text) {
  return new Map([...parseConfigEntries(text)].map(([symbol, entry]) => [symbol, entry.value]));
}
function normalizeImportedKconfigValue(entry, type = 'bool', fallbackValue = '') {
  const normalizedType = String(type || 'bool').toLowerCase();
  if (entry?.disabled) {
    if (normalizedType === 'bool' || normalizedType === 'tristate') return 'n';
    try {
      return normalizeKconfigValueByType(fallbackValue, normalizedType);
    } catch (error) {
      return undefined;
    }
  }
  let value = String(entry?.value ?? '');
  if (normalizedType === 'string' && /^"(?:[^"\\]|\\.)*"$/.test(value)) {
    try { value = JSON.parse(value); } catch (error) { /* keep the raw literal */ }
  }
  return normalizeKconfigValueByType(value, normalizedType);
}
function importedValue(symbol) {
  const edit = importedUnknownEdits.get(symbol);
  return edit?.action === 'delete' ? null : edit?.value ?? importedUnknownOriginal.get(symbol);
}
function setImportedEdit(symbol, value) {
  const original = importedUnknownOriginal.get(symbol);
  if (value === original) importedUnknownEdits.delete(symbol);
  else importedUnknownEdits.set(symbol, { action: 'set', value });
  renderImportedWorkspace();
}
function renderImportedUnknownRow(symbol) {
  const original = importedUnknownOriginal.get(symbol);
  const edit = importedUnknownEdits.get(symbol);
  const value = importedValue(symbol);
  const row = document.createElement('div');
  row.className = 'import-unknown-row' + (edit ? ' modified' : '');
  const name = document.createElement('code');
  name.className = 'menuconfig-option-label';
  name.textContent = symbol.startsWith('PACKAGE_')
    ? symbol.slice('PACKAGE_'.length)
    : symbol.toLowerCase().replaceAll('_', ' ');
  name.dataset.fullText = name.textContent;
  name.dataset.symbol = symbol;
  name.tabIndex = 0;
  row.appendChild(name);
  let input;
  if ([original, value].some((item) => ['y', 'm', 'n'].includes(item))) {
    input = document.createElement('select');
    for (const item of [['y', 'Y'], ['m', 'M'], ['n', uiText('关闭', '關閉', 'Disabled')]]) {
      const option = document.createElement('option');
      option.value = item[0];
      option.textContent = item[1];
      input.appendChild(option);
    }
    input.value = value ?? original;
  } else {
    input = document.createElement('input');
    input.type = 'text';
    input.value = value ?? original;
  }
  input.disabled = edit?.action === 'delete';
  input.onchange = () => setImportedEdit(symbol, input.value);
  row.appendChild(input);
  const actions = document.createElement('span');
  actions.className = 'import-unknown-actions';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = uiText('关闭', '關閉', 'Disable');
  close.onclick = () => setImportedEdit(symbol, 'n');
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = edit?.action === 'delete'
    ? uiText('已删除', '已刪除', 'Deleted')
    : uiText('删除行', '刪除列', 'Delete line');
  remove.disabled = edit?.action === 'delete';
  remove.onclick = () => {
    importedUnknownEdits.set(symbol, { action: 'delete' });
    renderImportedWorkspace();
  };
  const restore = document.createElement('button');
  restore.type = 'button';
  restore.textContent = uiText('恢复', '還原', 'Restore');
  restore.disabled = !edit;
  restore.onclick = () => {
    importedUnknownEdits.delete(symbol);
    renderImportedWorkspace();
  };
  actions.append(close, remove, restore);
  row.appendChild(actions);
  return row;
}
function renderImportedWorkspace() {
  const workspace = $('importWorkspace');
  const summary = $('importSummary');
  if (!workspace || !summary || !state.importedConfig) {
    if (workspace) workspace.hidden = true;
    if (summary) summary.hidden = true;
    updateMenuconfigOverviewVisibility();
    return;
  }
  summary.hidden = false;
  updateMenuconfigOverviewVisibility();
  const activeUnknown = [...importedUnknownOriginal].filter(([symbol]) => {
    const value = importedValue(symbol);
    return value !== 'n' && value !== '0' && value !== '""';
  }).length;
  const modified = menuTouched.size + importedUnknownEdits.size;
  const summaryText = uiText(
    `已识别 ${menuImportedOriginal.size} 项 · 仅导入 ${importedUnknownOriginal.size} 项` +
      `（启用 ${activeUnknown}）· 插件操作 ${state.sel.size + state.removed.size} 项 · 已修改 ${modified} 项`,
    `已識別 ${menuImportedOriginal.size} 項 · 僅匯入 ${importedUnknownOriginal.size} 項` +
      `（啟用 ${activeUnknown}）· 外掛操作 ${state.sel.size + state.removed.size} 項 · 已修改 ${modified} 項`,
    `Recognized ${menuImportedOriginal.size} · import-only ${importedUnknownOriginal.size}` +
      ` (enabled ${activeUnknown}) · plugin actions ${state.sel.size + state.removed.size} · modified ${modified}`);
  const summaryTextElement = $('importSummaryText');
  summaryTextElement.textContent = summaryText;
  bindUiTooltipContent(summaryTextElement, { body: summaryText });
  const targetCard = $('importTargetCard');
  targetCard.hidden = importedTargetVerified;
  workspace.hidden = importedTargetVerified;
  targetCard.textContent = '';
  if (!importedTargetVerified) {
    targetCard.append(document.createTextNode(uiText(
      `⚠ Custom Target：${state.device.target.system} / ${state.device.target.subtarget} / ` +
        `${state.device.target.profileLabel} 未经当前 Catalog 验证，将按上传配置直接构建；是否可用由所选源码决定。 `,
      `⚠ Custom Target：${state.device.target.system} / ${state.device.target.subtarget} / ` +
        `${state.device.target.profileLabel} 未經目前 Catalog 驗證，將按上傳設定直接建置；是否可用由所選原始碼決定。 `,
      `⚠ Custom Target: ${state.device.target.system} / ${state.device.target.subtarget} / ` +
        `${state.device.target.profileLabel} is not verified by the current Catalog; it will be built as uploaded and availability depends on the selected upstream. `)));
    const useCatalog = document.createElement('button');
    useCatalog.type = 'button';
    useCatalog.className = 'text-btn';
    useCatalog.textContent = uiText('改用网页 Target', '改用網頁 Target', 'Use page Target');
    useCatalog.onclick = async () => {
      if (!confirm(uiText(
        '改用网页 Target 会退出上传配置工作区，并放弃上传文件中的自定义配置。继续吗？',
        '改用網頁 Target 會離開上傳設定工作區，並放棄上傳檔案中的自訂設定。繼續嗎？',
        'Using the page Target exits the imported-config workspace and discards custom settings from the uploaded file. Continue?'))) return;
      const sourceId = state.source.id;
      const branchId = state.version.id;
      clearImportedWorkspace();
      importedTargetVerified = true;
      for (const select of targetControlElements()) select.disabled = false;
      renderCatalogPicker(false, { sourceId, branchId });
      await applyCatalogTarget();
    };
    targetCard.appendChild(useCatalog);
  }
  const box = $('importUnknownBox');
  box.hidden = importedUnknownOriginal.size === 0;
  $('importUnknownSummary').textContent = uiText(
    `仅导入配置项（${importedUnknownOriginal.size}，已修改 ${importedUnknownEdits.size}）`,
    `僅匯入設定項（${importedUnknownOriginal.size}，已修改 ${importedUnknownEdits.size}）`,
    `Import-only settings (${importedUnknownOriginal.size}, modified ${importedUnknownEdits.size})`);
  const list = $('importUnknownOptions');
  list.textContent = '';
  const query = $('importUnknownSearch').value.trim().toLowerCase();
  const showDisabled = $('importUnknownDisabled').checked;
  let symbols = [...importedUnknownOriginal.keys()].filter((symbol) => {
    if (query.length === 1 || (query.length >= 2 && !symbol.toLowerCase().includes(query))) return false;
    const value = importedValue(symbol);
    return showDisabled || importedUnknownEdits.has(symbol) ||
      (value !== 'n' && value !== '0' && value !== '""');
  });
  symbols.sort((a, b) =>
    Number(importedUnknownEdits.has(b)) - Number(importedUnknownEdits.has(a)) || a.localeCompare(b));
  for (const symbol of symbols.slice(0, importedUnknownLimit)) {
    list.appendChild(renderImportedUnknownRow(symbol));
  }
  if (!symbols.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = query.length === 1
      ? uiText('请再输入一个字符。', '請再輸入一個字元。', 'Type one more character.')
      : uiText('没有符合条件的配置项。', '沒有符合條件的設定項。', 'No matching settings.');
    list.appendChild(empty);
  }
  $('importUnknownMore').hidden = symbols.length <= importedUnknownLimit;
}
function clearImportedWorkspace() {
  state.importedConfig = null;
  state.importedConfigId = '';
  state.useDefconfig = false;
  if ($('defconfigToggle')) $('defconfigToggle').checked = false;
  importedConfigValues.clear();
  importedUnknownOriginal.clear();
  importedUnknownEdits.clear();
  menuImportedOriginal.clear();
  menuImportedNonDefault.clear();
  resetCatalogSelectionLayers();
  $('importWorkspace').hidden = true;
  $('importSummary').hidden = true;
  $('importUnknownBox').hidden = true;
  updateMenuconfigOverviewVisibility();
}
function resetImportedChanges() {
  if (!state.importedConfig) return;
  restoreSelections(state.importedConfig, null);
  showToast(uiText('已恢复上传配置的原始值', '已還原上傳設定的原始值',
    'Restored the original uploaded settings'));
}
