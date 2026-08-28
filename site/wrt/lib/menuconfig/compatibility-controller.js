/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Conflict handling and compatibility recommendation presentation over the shared Kconfig runtime.
 */
'use strict';

function kconfigRequirementText(requirements = []) {
  return requirements.map((group) => (group || []).filter(Boolean).join(' && ')).filter(Boolean).join(' || ');
}

function openKconfigPrerequisiteModal(option, value, error) {
  const plan = error?.prerequisitePlans?.recommended;
  if (!plan?.steps?.length) return false;
  modalCancelHandler = null;
  openModal(t('runtime.kconfigPrerequisiteTitle'));
  const modal = $('modal').querySelector('.modal');
  modal.classList.remove('modal-wide', 'modal-import-source', 'recommended-config',
    'profile-package-config', 'generation-error', 'catalog-conflict', 'compatibility-warning', 'rootfs-guidance');
  modal.classList.add('catalog-conflict', 'compatibility-warning');
  const body = $('modalBody');
  body.textContent = '';
  const packageName = option.symbol?.startsWith('PACKAGE_')
    ? option.symbol.slice('PACKAGE_'.length) : option.symbol;
  const copy = document.createElement('p');
  copy.className = 'catalog-conflict-copy';
  copy.textContent = t('runtime.kconfigPrerequisiteSummary', { value1: packageName });
  body.appendChild(copy);
  const requirement = kconfigRequirementText(
    error.constraints?.dependencyExpressions || error.violations?.[0]?.requirements || [],
  );
  if (requirement) {
    const requirementLine = document.createElement('p');
    requirementLine.className = 'catalog-conflict-warning';
    requirementLine.textContent = t('runtime.kconfigPrerequisiteRequirement', { value1: requirement });
    body.appendChild(requirementLine);
  }
  const heading = document.createElement('strong');
  heading.className = 'compatibility-recommendation-title';
  heading.textContent = t('runtime.kconfigPrerequisitePlan');
  body.appendChild(heading);
  const list = document.createElement('ol');
  list.className = 'catalog-conflict-list';
  for (const step of plan.steps) {
    const item = document.createElement('li');
    const symbol = document.createElement('code');
    symbol.textContent = `CONFIG_${step.symbol}=${String(step.value || 'n').toUpperCase()}`;
    item.appendChild(symbol);
    list.appendChild(item);
  }
  const target = document.createElement('li');
  target.className = 'compatibility-recommendation-action';
  target.textContent = `${t('runtime.kconfigPrerequisiteTarget')}: CONFIG_${option.symbol}=${String(value).toUpperCase()}`;
  list.appendChild(target);
  body.appendChild(list);
  const automatic = (plan.automaticChanges || []).filter((change) => change.symbol !== option.symbol);
  if (automatic.length) {
    const automaticLine = document.createElement('p');
    automaticLine.className = 'compatibility-recommendation-detail';
    automaticLine.textContent = t('runtime.kconfigPrerequisiteAutomatic', {
      value1: automatic.map((change) => `CONFIG_${change.symbol}=${String(change.to).toUpperCase()}`).join(', '),
    });
    body.appendChild(automaticLine);
  }
  const warning = document.createElement('p');
  warning.className = 'catalog-conflict-warning';
  body.appendChild(warning);
  const actions = document.createElement('div');
  actions.className = 'modal-actions compatibility-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button'; cancel.className = 'btn'; cancel.textContent = t('btn.close');
  cancel.onclick = closeModal;
  const apply = document.createElement('button');
  apply.type = 'button'; apply.className = 'btn btn-primary';
  apply.textContent = t('runtime.kconfigPrerequisiteApply');
  apply.onclick = () => {
    const snapshot = snapshotCatalogUiState();
    try {
      for (const step of plan.steps) {
        const stepOption = menuOptionBySymbol.get(step.symbol) || { symbol: step.symbol };
        applyCatalogIntent(stepOption, step.value, false, 'user');
      }
      applyCatalogIntent(option, value, false, 'user');
      renderCatalogUiAfterIntent(false, option, menuValues.get(option.symbol) ?? value);
      modalCancelHandler = null;
      closeModal();
    } catch (applyError) {
      const rollback = snapshot;
      restoreCatalogUiState(rollback);
      warning.textContent = String(applyError?.message || applyError).split(';')[0];
    }
  };
  actions.append(cancel, apply);
  body.appendChild(actions);
  modalCancelHandler = closeModal;
  return true;
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
  openModal(t('runtime.c2d6e325fc5b'));
  const modal = $('modal').querySelector('.modal');
  modal.classList.remove('modal-wide', 'modal-import-source', 'recommended-config',
    'profile-package-config', 'generation-error', 'catalog-conflict', 'rootfs-guidance');
  modal.classList.add('catalog-conflict');
  const body = $('modalBody');
  body.textContent = '';
  const copy = document.createElement('p');
  copy.className = 'catalog-conflict-copy';
  copy.textContent = t('runtime.e1e86e3baf44', { value1: rows[0].label });
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
  apply.textContent = t('runtime.b62f9960932e');
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
    warning.textContent = stateInvalid ? t('runtime.0f352e4ef93f') : conflictInvalid ? t('runtime.25739b377862') : '';
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
  const branch = state.version || selectedCatalogBranch() || {};
  const target = state.device?.target || {};
  const targetSystem = String(target.system || '');
  const targetSubtarget = String(target.subtarget || '');
  const targetProfile = String(target.profileSymbol || target.profile || '');
  return {
    sourceId: state.source?.id || selectedCatalogSource()?.id || '',
    branchName: branch.branch || '',
    sourceCommit: String(branch.commit || '').toLowerCase(),
    targetSystem,
    targetSubtarget,
    targetProfile,
    targetKey: [targetSystem, targetSubtarget, targetProfile].join('/'),
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
    throw new Error(t('runtime.da4e36d4cbd1'));
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
    sourceCommit: evaluation.context.sourceCommit,
    targetKey: evaluation.context.targetKey,
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
    sourceCommit: evaluation.context.sourceCommit,
    target: evaluation.context.targetKey,
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
          throw new Error(t('runtime.3e85d2e445d7'));
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
      heading.textContent = confirmation ? t('runtime.54d0ccf1130b') : t('runtime.9694ac638257');
      if (!ownership) {
        heading.textContent = confirmation ? t('runtime.45fb79e3ce0e') : t('runtime.d5505e8fb419');
      }
      const copy = document.createElement('p');
      copy.className = 'compatibility-summary-copy';
      copy.textContent = confirmation ? t('runtime.1b3f772b7648') : t('runtime.4152b783f1ae');
      if (!ownership) {
        copy.textContent = confirmation ? t('runtime.ac90cc70b800') : t('runtime.9da7c55fb368');
      }
      const pathLabel = document.createElement('span');
      pathLabel.className = 'compatibility-path-label';
      pathLabel.textContent = t('runtime.ec3f3cc0b661');
      if (!ownership) pathLabel.textContent = t('runtime.1ee274a8de1c');
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
        code.textContent = t('runtime.6b4cd2636bff');
        paths.appendChild(code);
      }
      const metadata = document.createElement('p');
      metadata.className = 'compatibility-evidence';
      metadata.textContent = [
        `${t('runtime.7d39a1536cbf')} ${warning.rule.id}`,
        ...(warning.rule.failure ? [`${warning.rule.failure.cause} · ${warning.rule.failure.code}`] : []),
        `${t('runtime.b95bb82a0431')} ${warning.rule.refs.join(' · ')}`,
      ].join(' · ');
      summaryLine.append(pathLabel, metadata);
      card.append(heading, copy, summaryLine, paths);
      body.appendChild(card);
    };

    let renderChoice;
    const renderForceConfirmation = () => {
      modalCancelHandler = renderChoice;
      const body = renderModalShell(t('runtime.f0bc009d0993'));
      appendCompatibilitySummary(body, { confirmation: true });
      const actions = UI_COMPONENTS.createUiActionRow(
        'modal-actions compatibility-actions compatibility-confirm-actions');
      const { root: rememberChoice, input: rememberInput } = UI_COMPONENTS.createUiCheckboxControl({
        className: 'compatibility-remember',
        label: t('runtime.d31806bd1f95'),
        checked: false,
        tooltipTitle: t('runtime.d31806bd1f95'),
        tooltipBody: t('runtime.e8bd8b88ed27'),
      });
      const backButton = UI_COMPONENTS.createUiButton({
        text: t('runtime.9e930674eccd'),
        className: 'btn compatibility-close',
        onClick: renderChoice,
      });
      const confirmForceButton = UI_COMPONENTS.createUiButton({
        text: t('runtime.383ef2ad4c67'),
        className: 'btn compatibility-force-confirm',
        onClick: () => finish(rememberInput.checked ? 'forced-remember' : 'forced'),
      });
      actions.append(rememberChoice, backButton, confirmForceButton);
      body.appendChild(actions);
    };

    renderChoice = () => {
      modalCancelHandler = cancel;
      const body = renderModalShell(t('runtime.26f71737a0e9'));
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
          warningText.textContent = stateInvalid ? t('runtime.e6192e96c512') : compatibilityInvalid ? t('runtime.865b9b507aeb') : '';
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
        ? t('runtime.6b0a0ee100a5')
        : t('runtime.5c2c197f7d61');
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
      recommendationAction.textContent = plans.recommended ? (recommendationStepNames.length > 1 ? t('runtime.3a95242a9e37', { value1: recommendationStepNames.join(' → ') }) : t('runtime.0dd63352cbe4', { value1: recommendationStepNames[0] || plans.recommended.package })) : t('runtime.f5967ef961bf');
      const recommendationDetail = document.createElement('small');
      recommendationDetail.className = 'compatibility-recommendation-detail';
      const automaticDetail = automaticChangeNames.length ? t('menu.automaticLinkage', {
        list: formatList(automaticChangeNames),
      }) : '';
      recommendationDetail.textContent = recommendationApplied ? t('runtime.beae674c2c45') : plans.recommended ? `${t('runtime.e7029a40a144', { value1: plans.recommended.cost })}${automaticDetail}` : t('runtime.a1add5a3f534');
      recommendationHeader.append(recommendationTitle, recommendationDetail);
      recommendation.append(recommendationHeader, recommendationAction);
      body.appendChild(recommendation);

      const actions = document.createElement('div');
      actions.className = 'modal-actions compatibility-actions';
      const recommendedButton = document.createElement('button');
      recommendedButton.type = 'button';
      recommendedButton.className = 'btn btn-primary compatibility-recommended';
      recommendedButton.textContent = recommendationApplied
        ? t('runtime.57518ffee317')
        : t('runtime.5c2c197f7d61');
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
      customButton.textContent = t('runtime.68bccc92256e');
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
      forceButton.textContent = t('runtime.3ea8d64eb087');
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
