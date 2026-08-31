/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Package compatibility probe adapter over the shared Catalog and Menuconfig state.
 */
'use strict';

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

function probeUiText(key) { return t('probe.legacy.' + key); }
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
    displayId: displayText(packageName || symbol),
    isPackage: Boolean(packageName),
    userSettable: option?.userSettable !== false,
    title: displayText(firstMeaningfulProbeText(translation.title, option.promptZh, option.promptEn)),
    usage: displayText(firstMeaningfulProbeText(translation.usage, option.usageZh, option.usageEn)),
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
    throw new Error(t('runtime.2e9a9a0ebab5'));
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
    ? [displayText(`${prefix}${packages[0]}`), ...packages.slice(1, 3).map(displayText)].join(', ') +
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
  openModal(t('runtime.b9923e1a6d82'));
  const modal = $('modal').querySelector('.modal');
  modal.classList.add('package-probe');
  const body = $('modalBody');
  body.textContent = '';
  const loading = document.createElement('p');
  loading.className = 'probe-loading'; loading.textContent = t('runtime.adea101d8e62');
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
      overlayTitle.textContent = displayText(title);
      overlayBody.textContent = '';
      for (const line of lines) {
        const paragraph = document.createElement('p'); paragraph.textContent = displayText(line); overlayBody.appendChild(paragraph);
      }
      overlay.hidden = false; overlayClose.focus();
    };
    overlayClose.addEventListener('click', closeProbeOverlay);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closeProbeOverlay(); });

    const bindProbeTextTooltip = (element, text) => {
      if (!text) return;
      bindUiTooltipContent(element, { body: displayText(text) });
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
        chip.textContent = `${displayText(packageName)}=${String(value).toUpperCase()} ×`;
        bindUiTooltipContent(chip, { body: displayConfigSymbol(option.symbol) });
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
            return `${displayText(packageName)}: ${String(probePackageBaselineState(option)).toUpperCase()} → ${String(probeMenuOptionState(option)).toUpperCase()}`;
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
        const rowDetails = [choice.displayId, displayConfigSymbol(choice.symbol), choice.title, choice.usage].filter(Boolean).join('\n');
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
    branchSearch.placeholder = `${probeUiText('customScope')} · ${t('target.field.source')}/${t('target.field.branch')}`;
    branchSearch.setAttribute('aria-label', branchSearch.placeholder);
    const branchList = document.createElement('div'); branchList.className = 'probe-branches'; customScopeBody.append(branchSearch, branchList);
    const updateCustomScopeSummary = () => {
      const count = branchList.querySelectorAll('input:checked').length;
      customScopeTitle.textContent = `${probeUiText('customScope')} · ${t('runtime.27b95c138304')} ${count}`;
      customScopeToggle.textContent = customScope.open ? t('runtime.19d9afc7cd7a') : t('runtime.becc5c5ce02d');
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
          preview.textContent = displayText(error?.message || error);
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
    const failure = document.createElement('p'); failure.className = 'import-error'; failure.textContent = displayText(error?.message || error); body.appendChild(failure);
  }
}
$('modalProbe').addEventListener('click', openPackageProbeModal);
