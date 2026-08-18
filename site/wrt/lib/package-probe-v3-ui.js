async function openPackageProbeV3Modal() {
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
    const baselineResolvedConfig = await generateResolvedConfigText();
    const baselinePackageConfig = probeV3PackageConfigFromText(baselineResolvedConfig);
    const baselineStates = probeV3PackageStateMap(baselinePackageConfig);
    const currentSource = selectedCatalogSource();
    if (String(currentSource?.id || '').toLowerCase() === 'hanwckf') {
      throw new Error(probeV3UiText('sourceExcluded'));
    }
    if ($('modal').hidden || !modal.classList.contains('package-probe')) return;
    modalCancelHandler = null;
    body.textContent = '';

    const intro = document.createElement('section');
    intro.className = 'probe-intro';
    const introTitle = document.createElement('h4'); introTitle.textContent = probeV3UiText('title');
    const introText = document.createElement('p'); introText.textContent = probeV3UiText('l1Intro');
    bindUiTooltipContent(introText, { body: introText.textContent });
    const guide = document.createElement('details'); guide.className = 'probe-guide';
    const guideButton = document.createElement('summary'); guideButton.textContent = 'ⓘ';
    guideButton.setAttribute('aria-label', probeV3UiText('l1HowTo'));
    const guideCopy = document.createElement('span'); guideCopy.className = 'probe-guide-copy';
    const howTo = document.createElement('span'); howTo.textContent = probeV3UiText('l1HowTo');
    guideCopy.append(howTo); guide.append(guideButton, guideCopy);
    intro.append(introTitle, introText, guide); body.appendChild(intro);

    const layout = document.createElement('div'); layout.className = 'probe-layout'; body.appendChild(layout);
    const settings = document.createElement('section'); settings.className = 'probe-panel probe-settings';
    const picker = document.createElement('section'); picker.className = 'probe-panel probe-picker';
    layout.append(settings, picker);

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

    const intent = new Map();
    let latestFinalStates = new Map(baselineStates);
    let packageRevision = 0;
    let packageSnapshotRevision = 0;
    let packageConfigSnapshot = baselinePackageConfig;
    let packageRefresh = null;
    let latestPreview = null;
    let autoLimitTimer = 0;
    const filters = {
      sources: new Set(['*']), branches: new Set(['*']), targetSystems: new Set(['*']),
      subtargets: new Set(['*']), profiles: new Set(['*']),
    };

    const summaryBar = document.createElement('div'); summaryBar.className = 'probe-state-summary'; settings.appendChild(summaryBar);
    const baselineMetric = document.createElement('span');
    const intentMetric = document.createElement('span');
    const linkageButton = document.createElement('button'); linkageButton.type = 'button'; linkageButton.className = 'probe-linkage-button'; linkageButton.textContent = probeV3UiText('linkageDetail');
    const linkageMetric = document.createElement('span');
    const finalMetric = document.createElement('span');
    intentMetric.className = 'probe-intent-metric';
    const intentGroup = document.createElement('span'); intentGroup.className = 'probe-intent-group'; intentGroup.append(intentMetric, linkageButton);
    summaryBar.append(baselineMetric, intentGroup, linkageMetric, finalMetric);

    const directAndAutomaticChanges = () => {
      const direct = probeV3IntentRows(intent);
      const directNames = new Set(direct.map((row) => row.package));
      const automatic = [];
      const allNames = new Set([...baselineStates.keys(), ...latestFinalStates.keys()]);
      for (const packageName of allNames) {
        if (directNames.has(packageName)) continue;
        const before = baselineStates.get(packageName) || 'n';
        const after = latestFinalStates.get(packageName) || 'n';
        if (before !== after) automatic.push({ package: packageName, before, after });
      }
      automatic.sort((a, b) => a.package.localeCompare(b.package));
      return { direct, automatic };
    };
    const renderStateSummary = () => {
      const { direct, automatic } = directAndAutomaticChanges();
      const autoUp = automatic.filter((row) => row.before === 'n' && row.after !== 'n').length;
      const autoDown = automatic.filter((row) => row.before !== 'n' && row.after === 'n').length;
      const autoState = automatic.length - autoUp - autoDown;
      baselineMetric.textContent = `${probeV3UiText('baseline')} ${baselineStates.size}`;
      intentMetric.textContent = `${probeV3UiText('selected')} ${direct.length}`;
      const autoBits = [`+${autoUp}`];
      if (autoDown) autoBits.push(`-${autoDown}`);
      if (autoState) autoBits.push(`~${autoState}`);
      linkageMetric.textContent = `${probeV3UiText('linkage')} ${autoBits.join(' / ')}`;
      finalMetric.textContent = `${probeV3UiText('finalState')} ${latestFinalStates.size}`;
      linkageButton.disabled = direct.length === 0 && automatic.length === 0;
    };
    linkageButton.addEventListener('click', () => {
      const { direct, automatic } = directAndAutomaticChanges();
      const lines = [];
      const describeChange = (row) => {
        const option = menuOptionBySymbol.get(`PACKAGE_${row.package}`);
        const translation = option ? menuOptionTranslation(option) : {};
        const detail = firstMeaningfulProbeV3Text(translation.title, option?.promptZh, option?.promptEn, translation.usage, option?.usageZh, option?.usageEn);
        return `${row.package}: ${row.before.toUpperCase()} → ${row.after.toUpperCase()}${detail ? ` · ${detail}` : ''}`;
      };
      if (direct.length) {
        lines.push(`${probeV3UiText('selected')} (${direct.length})`);
        lines.push(...direct.map(describeChange));
      }
      if (automatic.length) {
        if (lines.length) lines.push('');
        lines.push(`${probeV3UiText('linkage')} (${automatic.length})`);
        lines.push(...automatic.map(describeChange));
      }
      showProbeOverlay(probeV3UiText('linkageDetail'), lines.length ? lines : [probeV3UiText('notApplicable')]);
    });

    const depthRow = document.createElement('div'); depthRow.className = 'probe-depth-row'; settings.appendChild(depthRow);
    const depthLabel = document.createElement('strong'); depthLabel.className = 'probe-inline-label'; depthLabel.textContent = probeV3UiText('depth'); depthRow.appendChild(depthLabel);
    const depth = document.createElement('div'); depth.className = 'probe-depth'; depthRow.appendChild(depth);
    const depthOption = document.createElement('span'); depthOption.className = 'probe-depth-option is-selected';
    const level = document.createElement('span'); level.className = 'probe-level'; level.textContent = probeV3UiText('level1');
    const depthTitle = document.createElement('strong'); depthTitle.className = 'probe-depth-title'; depthTitle.textContent = probeV3UiText('configResolve');
    bindUiTooltipContent(depthOption, { title: `${probeV3UiText('level1')} · ${probeV3UiText('configResolve')}`, body: probeV3UiText('configResolveHelp') });
    depthOption.append(level, depthTitle); depth.appendChild(depthOption);
    const autoLimit = document.createElement('input'); autoLimit.type = 'number'; autoLimit.min = '1'; autoLimit.max = '256'; autoLimit.step = '1'; autoLimit.value = '40'; autoLimit.className = 'probe-auto-limit';

    const environmentRow = document.createElement('div'); environmentRow.className = 'probe-environment-row'; settings.appendChild(environmentRow);
    const environmentHead = document.createElement('div'); environmentHead.className = 'probe-environment-head';
    const environmentTitle = document.createElement('strong'); environmentTitle.textContent = probeV3UiText('environment'); environmentHead.appendChild(environmentTitle); environmentRow.appendChild(environmentHead);
    const filterGrid = document.createElement('div'); filterGrid.className = 'probe-filter-grid'; environmentRow.appendChild(filterGrid);
    const allDetails = [];
    const optionMaps = probeV3ScopeOptionMaps();

    const closeOtherProbeSelects = (except = null) => {
      for (const details of allDetails) if (details !== except) details.open = false;
    };
    const createMultiSelect = (filterKey, labelKey) => {
      const field = document.createElement('div'); field.className = 'probe-multiselect-field';
      const fieldTitle = document.createElement('strong'); fieldTitle.textContent = probeV3UiText(labelKey);
      const details = document.createElement('details'); details.className = 'probe-multiselect'; allDetails.push(details);
      const summary = document.createElement('summary');
      const summaryText = document.createElement('span');
      const chevron = document.createElement('span'); chevron.textContent = '▾'; chevron.setAttribute('aria-hidden', 'true');
      summary.append(summaryText, chevron); details.appendChild(summary);
      const panel = document.createElement('div'); panel.className = 'probe-multiselect-panel';
      const floating = typeof createFloatingLayerController === 'function'
        ? createFloatingLayerController(summary, panel, {
          minWidth: 360, preferredHeight: 380,
          onDismiss: () => { details.open = false; },
        })
        : null;
      const searchBox = document.createElement('input'); searchBox.type = 'search'; searchBox.className = 'probe-multiselect-search';
      searchBox.placeholder = `${probeV3UiText('searchDimension')} ${probeV3UiText(labelKey)}`; panel.appendChild(searchBox);
      const list = document.createElement('div'); list.className = 'probe-multiselect-list'; panel.appendChild(list); details.appendChild(panel);
      field.append(fieldTitle, details); filterGrid.appendChild(field);
      const selected = filters[filterKey];
      const refresh = () => {
        list.textContent = '';
        const allLabel = document.createElement('label'); allLabel.className = 'probe-multiselect-option is-all';
        const allInput = document.createElement('input'); allInput.type = 'checkbox'; allInput.checked = selected.has('*');
        allLabel.append(allInput, document.createTextNode(probeV3UiText('all'))); list.appendChild(allLabel);
        allInput.addEventListener('change', () => {
          selected.clear(); selected.add('*'); refresh(); refreshEnvironmentPreview();
        });
        for (const [value, labelText] of [...optionMaps[filterKey].entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }))) {
          const label = document.createElement('label'); label.className = 'probe-multiselect-option';
          label.dataset.search = `${value} ${labelText}`.toLocaleLowerCase();
          const input = document.createElement('input'); input.type = 'checkbox'; input.checked = !selected.has('*') && selected.has(value);
          const code = document.createElement('span'); code.textContent = labelText;
          if (labelText !== value && value) code.dataset.uiTooltipBody = value;
          label.append(input, code); list.appendChild(label);
          input.addEventListener('change', () => {
            if (selected.has('*')) selected.delete('*');
            if (input.checked) selected.add(value); else selected.delete(value);
            if (!selected.size) selected.add('*');
            refresh(); refreshEnvironmentPreview();
          });
        }
        if (selected.has('*')) summaryText.textContent = probeV3UiText('all');
        else {
          const labels = [...selected].map((value) => optionMaps[filterKey].get(value) || value || 'Default');
          summaryText.textContent = labels.length <= 2 ? labels.join(', ') : `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
        }
        const query = searchBox.value.trim().toLocaleLowerCase();
        for (const label of list.querySelectorAll('.probe-multiselect-option:not(.is-all)')) {
          label.hidden = !!query && !label.dataset.search.includes(query);
        }
      };
      searchBox.addEventListener('input', refresh);
      details.addEventListener('toggle', () => {
        summary.setAttribute('aria-expanded', String(details.open));
        if (details.open) {
          closeOtherProbeSelects(details);
          floating?.open();
          setTimeout(() => searchBox.focus(), 0);
        } else {
          floating?.close();
        }
      });
      summary.setAttribute('aria-expanded', 'false');
      refresh();
      return { field, details, refresh };
    };
    const multiSelects = {
      sources: createMultiSelect('sources', 'source'),
      branches: createMultiSelect('branches', 'branch'),
      targetSystems: createMultiSelect('targetSystems', 'targetSystem'),
      subtargets: createMultiSelect('subtargets', 'subtarget'),
      profiles: createMultiSelect('profiles', 'targetProfile'),
    };
    const refreshMultiSelects = () => Object.values(multiSelects).forEach((control) => control.refresh());

    const setProbeFilter = (selected, values) => {
      selected.clear();
      for (const value of values) selected.add(String(value ?? ''));
      if (!selected.size) selected.add('*');
    };
    const shortcuts = document.createElement('div'); shortcuts.className = 'probe-shortcuts'; settings.appendChild(shortcuts);
    const shortcutButton = (text, handler) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'btn probe-shortcut'; button.textContent = text;
      button.addEventListener('click', () => { handler(); refreshMultiSelects(); refreshEnvironmentPreview(); }); shortcuts.appendChild(button); return button;
    };
    const currentTarget = probeV3CurrentTarget();
    shortcutButton(probeV3UiText('currentEnvironment'), () => {
      if (!currentTarget) return;
      setProbeFilter(filters.sources, [currentTarget.source]);
      setProbeFilter(filters.branches, [currentTarget.branch]);
      setProbeFilter(filters.targetSystems, [currentTarget.targetSystem]);
      setProbeFilter(filters.subtargets, [currentTarget.subtarget]);
      setProbeFilter(filters.profiles, [currentTarget.profile]);
    }).disabled = !currentTarget;
    shortcutButton(currentTarget
      ? `${currentTarget.targetSystem} / ${currentTarget.subtarget} / ${currentTarget.profileLabel} · ${t('runtime.ebd8c457c647')}`
      : probeV3UiText('crossSourceTarget'), () => {
      if (!currentTarget) return;
      setProbeFilter(filters.sources, ['*']);
      setProbeFilter(filters.branches, ['*']);
      setProbeFilter(filters.targetSystems, [currentTarget.targetSystem]);
      setProbeFilter(filters.subtargets, [currentTarget.subtarget]);
      setProbeFilter(filters.profiles, [currentTarget.profile]);
    }).disabled = !currentTarget;
    shortcutButton(probeV3UiText('clearFilters'), () => {
      setProbeFilter(filters.sources, ['*']);
      setProbeFilter(filters.branches, ['*']);
      setProbeFilter(filters.targetSystems, ['*']);
      setProbeFilter(filters.subtargets, ['*']);
      setProbeFilter(filters.profiles, ['*']);
    });

    const coverageRow = document.createElement('div'); coverageRow.className = 'probe-coverage-row'; settings.appendChild(coverageRow);
    const coverageLabel = document.createElement('strong'); coverageLabel.className = 'probe-inline-label'; coverageLabel.textContent = probeV3UiText('environmentLimit');
    const limitGroup = document.createElement('span'); limitGroup.className = 'probe-limit-group';
    const limitText = document.createElement('span'); limitText.textContent = probeV3UiText('autoLimit');
    const environmentText = document.createElement('span'); environmentText.textContent = probeV3UiText('environments');
    limitGroup.append(limitText, autoLimit, environmentText);
    const exhaustiveLabel = document.createElement('label'); exhaustiveLabel.className = 'probe-coverage-choice';
    const exhaustiveInput = document.createElement('input'); exhaustiveInput.type = 'checkbox';
    exhaustiveLabel.append(exhaustiveInput, document.createTextNode(probeV3UiText('exhaustiveCoverage')));
    coverageRow.append(coverageLabel, limitGroup, exhaustiveLabel);
    autoLimit.addEventListener('input', () => {
      clearTimeout(autoLimitTimer);
      autoLimitTimer = setTimeout(() => refreshRequestPreview(), 150);
    });
    exhaustiveInput.addEventListener('change', refreshRequestPreview);

    const accordion = document.createElement('div'); accordion.className = 'probe-accordion'; settings.appendChild(accordion);
    const accordionTriggers = document.createElement('div'); accordionTriggers.className = 'probe-accordion-triggers'; accordion.appendChild(accordionTriggers);
    const accordionBody = document.createElement('div'); accordionBody.className = 'probe-accordion-body'; accordionBody.hidden = true; accordion.appendChild(accordionBody);
    let accordionMode = '';
    const accordionButtons = new Map();
    const setAccordion = (mode) => {
      accordionMode = accordionMode === mode ? '' : mode;
      accordionBody.hidden = !accordionMode;
      for (const [key, button] of accordionButtons) button.setAttribute('aria-expanded', String(key === accordionMode));
      renderAccordionSnapshot();
    };
    for (const [mode, labelKey] of [['scope', 'scopeDetail'], ['execution', 'executionPreview']]) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'probe-accordion-trigger'; button.textContent = `▸ ${probeV3UiText(labelKey)}`;
      button.setAttribute('aria-expanded', 'false'); button.addEventListener('click', () => setAccordion(mode));
      accordionButtons.set(mode, button); accordionTriggers.appendChild(button);
    }

    const search = document.createElement('input'); search.className = 'probe-search'; search.type = 'search';
    search.placeholder = probeV3UiText('search'); search.setAttribute('aria-label', probeV3UiText('search'));
    const results = document.createElement('div'); results.className = 'probe-results'; picker.append(search, results);

    const recordIntent = (option) => {
      const packageName = String(option?.symbol || '').replace(/^PACKAGE_/, '');
      if (!packageName) return;
      const before = baselineStates.get(packageName) || 'n';
      const after = probeV3MenuOptionState(option);
      if (before === after) intent.delete(packageName);
      else intent.set(packageName, { package: packageName, before, after });
    };
    const renderResults = () => {
      const matches = probeV3PackageChoices(search.value).slice(0, 80);
      results.textContent = '';
      if (!matches.length) {
        const empty = document.createElement('p'); empty.className = 'probe-empty'; empty.textContent = probeV3UiText('empty'); results.appendChild(empty); return;
      }
      for (const choice of matches) {
        const option = menuOptionBySymbol.get(choice.symbol);
        const selectable = choice.isPackage && choice.userSettable;
        const currentValue = choice.isPackage ? probeV3MenuOptionState(option) : 'n';
        const activeSelected = choice.isPackage && currentValue !== 'n';
        const row = document.createElement('button'); row.type = 'button'; row.className = 'probe-package';
        row.classList.toggle('is-selected', activeSelected);
        row.classList.toggle('is-direct', intent.has(choice.package));
        row.classList.toggle('is-reference', !selectable);
        if (!selectable) row.setAttribute('aria-disabled', 'true');
        const mark = document.createElement('span'); mark.className = 'probe-package-mark';
        mark.textContent = choice.isPackage ? (activeSelected ? String(currentValue).toUpperCase() : '+') : '·';
        const code = document.createElement('code'); code.className = 'probe-package-id'; code.textContent = choice.displayId;
        const title = document.createElement('span'); title.className = 'probe-package-title'; title.textContent = choice.title || '—';
        const usage = document.createElement('span'); usage.className = 'probe-package-usage'; usage.textContent = choice.usage || '—';
        bindProbeTextTooltip(title, choice.title); bindProbeTextTooltip(usage, choice.usage);
        const rowDetails = [choice.displayId, `CONFIG_${choice.symbol}`, choice.title, choice.usage].filter(Boolean).join('\n');
        bindUiTooltipContent(row, { body: rowDetails });
        const info = document.createElement('span'); info.className = 'probe-package-info'; info.textContent = '!';
        info.setAttribute('aria-label', rowDetails); bindUiTooltipContent(info, { body: rowDetails });
        info.addEventListener('click', (event) => {
          event.preventDefault(); event.stopPropagation(); showDatasetTooltip(info, event);
        });
        row.append(mark, code, title, usage, info); row.setAttribute('aria-label', rowDetails);
        if (selectable) row.addEventListener('click', () => {
          const states = optionSelectableStates(option);
          const enableValue = states.includes('y') ? 'y' : states.find((value) => value !== 'n') || 'y';
          const nextValue = activeSelected ? 'n' : enableValue;
          if (setMenuValue(option, nextValue)) {
            recordIntent(option); renderResults(); refreshPackagePreview();
          }
        });
        results.appendChild(row);
      }
    };

    const scopeSummary = (selected, optionMap) => selected.has('*') ? probeV3UiText('all') :
      [...selected].map((value) => optionMap.get(value) || value || 'Default').join(', ');
    const currentCoverageMode = () => exhaustiveInput.checked ? 'all' : 'auto';
    const normalizedAutoLimit = () => Math.max(1, Math.min(256, Number.parseInt(autoLimit.value || '40', 10) || 40));
    const renderAccordion = (request) => {
      accordionBody.textContent = '';
      if (!accordionMode) return;
      if (accordionMode === 'scope') {
        const rows = [
          [probeV3UiText('source'), scopeSummary(filters.sources, optionMaps.sources)],
          [probeV3UiText('branch'), scopeSummary(filters.branches, optionMaps.branches)],
          [probeV3UiText('targetSystem'), scopeSummary(filters.targetSystems, optionMaps.targetSystems)],
          [probeV3UiText('subtarget'), scopeSummary(filters.subtargets, optionMaps.subtargets)],
          [probeV3UiText('targetProfile'), scopeSummary(filters.profiles, optionMaps.profiles)],
        ];
        const grid = document.createElement('div'); grid.className = 'probe-detail-grid';
        for (const [label, value] of rows) {
          const key = document.createElement('strong'); key.textContent = label;
          const val = document.createElement('span'); val.textContent = value; grid.append(key, val);
        }
        accordionBody.appendChild(grid);
      } else {
        const preview = document.createElement('pre'); preview.className = 'probe-preview'; preview.textContent = request ? JSON.stringify(request, null, 2) : probeV3UiText('invalid'); accordionBody.appendChild(preview);
      }
    };

    const markPackageStateChanged = () => {
      packageRevision += 1;
      submitButton.disabled = true;
    };
    const ensurePackageSnapshot = async () => {
      if (packageSnapshotRevision === packageRevision) return packageConfigSnapshot;
      if (packageRefresh?.revision === packageRevision) return packageRefresh.promise;
      const revision = packageRevision;
      const promise = (async () => {
        const resolvedConfig = await generateResolvedConfigText();
        if (revision !== packageRevision) return ensurePackageSnapshot();
        packageConfigSnapshot = probeV3PackageConfigFromText(resolvedConfig);
        packageSnapshotRevision = revision;
        latestFinalStates = probeV3PackageStateMap(packageConfigSnapshot);
        renderStateSummary();
        return packageConfigSnapshot;
      })();
      packageRefresh = { revision, promise };
      try { return await promise; }
      finally { if (packageRefresh?.promise === promise) packageRefresh = null; }
    };
    const buildRequestSnapshot = () => {
      const coverageMode = currentCoverageMode();
      const packageIntent = probeV3IntentRows(intent);
      const intentConfig = (stateKey) => packageIntent
        .filter((row) => ['m', 'y'].includes(row[stateKey]))
        .map((row) => `CONFIG_PACKAGE_${row.package}=${row[stateKey]}`)
        .join('\n') + (packageIntent.some((row) => ['m', 'y'].includes(row[stateKey])) ? '\n' : '');
      return {
        schema: 3, channel: probeV3CodeChannel(), mode: 'config-resolve', useDefconfig: true,
        baselinePackageConfig: intentConfig('before'), packageConfig: intentConfig('after'), packageIntent,
        environmentScope: probeV3FilterRequest(filters),
        coverage: coverageMode === 'all' ? { mode: 'all' } : { mode: 'auto', limit: normalizedAutoLimit() },
        maxParallel: 0, execute: true,
      };
    };
    const renderAccordionSnapshot = () => renderAccordion(latestPreview?.request || null);
    const syncPreview = () => {
      autoLimit.value = String(normalizedAutoLimit());
      const request = buildRequestSnapshot();
      const valid = packageSnapshotRevision === packageRevision && probeV3EnabledIntent(request).length > 0;
      latestPreview = { request: valid ? request : null };
      limitGroup.hidden = currentCoverageMode() !== 'auto';
      renderAccordionSnapshot();
      submitButton.disabled = !valid;
      return valid ? request : null;
    };

    async function refreshPackagePreview() {
      markPackageStateChanged();
      try {
        await ensurePackageSnapshot();
        return syncPreview();
      } catch (error) {
        accordionBody.textContent = String(error?.message || error);
        submitButton.disabled = true;
        return null;
      }
    }
    function refreshEnvironmentPreview() { return syncPreview(); }
    function refreshRequestPreview() { return syncPreview(); }
    async function renderPreview() {
      try {
        await ensurePackageSnapshot();
        return syncPreview();
      } catch (error) {
        accordionBody.textContent = String(error?.message || error);
        submitButton.disabled = true;
        return null;
      }
    }

    const actions = document.createElement('div'); actions.className = 'modal-actions probe-actions';
    const helpButton = document.createElement('button'); helpButton.type = 'button'; helpButton.className = 'btn probe-help-button'; helpButton.textContent = probeV3UiText('help');
    helpButton.addEventListener('click', () => showProbeOverlay(probeV3UiText('help'), [
      probeV3UiText('l1StateInstruction'), probeV3UiText('l1HowTo'), probeV3UiText('cancelInstruction'),
      probeV3UiText('permission'), probeV3UiText('retention'),
    ]));
    const actionsSpacer = document.createElement('span'); actionsSpacer.className = 'probe-actions-spacer'; actionsSpacer.setAttribute('aria-hidden', 'true');
    const previewButton = document.createElement('button'); previewButton.type = 'button'; previewButton.className = 'btn'; previewButton.textContent = probeV3UiText('preview');
    previewButton.addEventListener('click', () => { if (accordionMode !== 'execution') setAccordion('execution'); });
    const submitButton = document.createElement('button'); submitButton.type = 'button'; submitButton.className = 'btn btn-primary'; submitButton.textContent = probeV3UiText('submit');
    actions.append(helpButton, actionsSpacer, previewButton, submitButton); layout.appendChild(actions);
    submitButton.addEventListener('click', async () => {
      submitButton.disabled = true;
      try {
        const request = await renderPreview();
        if (!request) return;
        const token = await probeV3StateToken(request);
        const issueUrl = probeV3IssueUrl(request, token);
        showToast(probeV3UiText('l1Submitted'));
        const issueWindow = window.open(issueUrl, '_blank');
        if (issueWindow) issueWindow.opener = null; else window.location.assign(issueUrl);
      } catch (error) {
        showToast(String(error?.message || error).split(';')[0]);
      } finally {
        syncPreview();
      }
    });

    search.addEventListener('input', renderResults);
    layout.addEventListener('click', (event) => {
      if (!event.target.closest('.probe-multiselect')) closeOtherProbeSelects();
    });
    layout.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { closeOtherProbeSelects(); closeProbeOverlay(); }
    });
    renderStateSummary(); renderResults(); syncPreview(); search.focus();
  } catch (error) {
    body.textContent = '';
    const failure = document.createElement('p'); failure.className = 'import-error'; failure.textContent = String(error?.message || error); body.appendChild(failure);
  }
}

// Replace only the Probe launcher after app.js has finished registering the
// legacy listener. If the V3 adapter fails to load, no partially initialized
// V3 handler is installed.
function activatePackageProbeV3() {
  const button = document.getElementById('modalProbe');
  if (!button || typeof openPackageProbeModal !== 'function') {
    setTimeout(activatePackageProbeV3, 0);
    return;
  }
  button.removeEventListener('click', openPackageProbeModal);
  button.addEventListener('click', openPackageProbeV3Modal);
  if (!document.querySelector('link[data-weig-probe-v3]')) {
    const probeStyle = document.createElement('link');
    probeStyle.rel = 'stylesheet';
    probeStyle.dataset.weigProbeV3 = '1';
    probeStyle.href = releaseAssetUrl('package-probe-v3.css');
    document.head.appendChild(probeStyle);
  }
}
setTimeout(activatePackageProbeV3, 0);
