/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Browser self-test diagnostics controller.
 */
'use strict';

async function runSelfTest() {
  const viewToken = ++selfTestViewToken;
  openModal(t('st.title'));
  const probe = $('modalProbe');
  probe.textContent = t('runtime.db01903c8942');
  bindUiTooltipContent(probe, { body: t('runtime.e0dfb5e2cd46') });
  probe.hidden = false;
  const mb = $('modalBody');
  mb.textContent = '';
  const intro = document.createElement('p');
  intro.className = 'hint';
  intro.textContent = t('st.intro');
  mb.appendChild(intro);

  function addRow(name) {
    const row = document.createElement('div');
    row.className = 'st-row';
    const ic = document.createElement('span');
    ic.className = 'st-ic';
    ic.textContent = '⏳';
    const box = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = name;
    const msg = document.createElement('span');
    msg.className = 'st-msg';
    msg.textContent = t('st.checking');
    box.appendChild(b); box.appendChild(msg);
    row.appendChild(ic); row.appendChild(box);
    mb.appendChild(row);
    return (status, text) => {
      ic.textContent = status === 'ok' ? '✓' : status === 'warn' ? '⚠' : '✗';
      row.className = 'st-row st-' + status;
      msg.textContent = text;
    };
  }

  const src = state.source;
  const d1 = addRow(t('st.browser'));
  const d2 = addRow(t('st.data'));
  const d3 = addRow(t('st.config') + (src ? ' (' + src.label + ')' : ''));
  const d4 = addRow(t('st.gen'));
  const d5 = addRow(t('st.github'));

  // Paint every ordinary check before network or config work starts. / 在网络与配置检查前先画出全部普通检查项。
  const nextFrame = window.requestAnimationFrame
    ? (callback) => window.requestAnimationFrame(callback)
    : (callback) => window.setTimeout(callback, 0);
  await new Promise((resolve) => {
    let settled = false, fallbackTimer = null;
    const finishPaint = () => {
      if (settled) return;
      settled = true;
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      resolve();
    };
    fallbackTimer = window.setTimeout(finishPaint, 150);
    nextFrame(() => nextFrame(finishPaint));
  });
  if (viewToken !== selfTestViewToken) return;

  let loadedCompatibility = null;
  let compatibilityError = null;
  let catalogDataStatus = null;
  const refreshCatalogDataStatus = () => {
    if (!catalogDataStatus || viewToken !== selfTestViewToken) return;
    const rules = loadedCompatibility?.compatibility?.rules;
    const suffix = Array.isArray(rules) ? ` · ${rules.length} compatibility rules` : '';
    d2(catalogDataStatus.status, `${catalogDataStatus.message}${suffix}`);
  };
  const compatibilityDownload = Promise.resolve()
    .then(() => CATALOG_LOADER.fetchCompatibility())
    .then((compatibility) => {
      loadedCompatibility = compatibility;
      refreshCatalogDataStatus();
      return compatibility;
    })
    .catch((error) => {
      compatibilityError = error;
      return null;
    });

  const missing = ['fetch', 'URL', 'Blob', 'AbortController', 'localStorage'].filter((k) => !(k in window));
  d1(missing.length ? 'fail' : 'ok', missing.length ? t('st.browser.fail', { list: missing.join('、') }) : t('st.browser.ok'));

  try {
    const [applications] = await Promise.all([
      ensureCatalogApplications(),
      ensurePackageMirrors(),
    ]);
    if (viewToken !== selfTestViewToken) return;
    catalogDataStatus = {
      status: applications.items.length ? 'ok' : 'fail',
      message: `${MENU_CATALOG_DATA_REF} · ${applications.items.length} curated applications`,
    };
    refreshCatalogDataStatus();
  } catch (error) {
    if (viewToken !== selfTestViewToken) return;
    catalogDataStatus = { status: 'fail', message: error.message };
    refreshCatalogDataStatus();
  }

  let cfgText = null, tierHit = '';
  if (!src) d3('fail', t('st.config.noData'));
  else if (state.device?.id === 'catalog-target') {
    try {
      if (!MENU_CATALOG) throw new Error('Catalog has not finished loading');
      cfgText = catalogTargetConfig();
      tierHit = `${state.source.id}/${state.version.branch} · ${MENU_CATALOG.source?.commit?.slice(0, 8) || 'Catalog'}`;
      d3('ok', t('st.config.ok', { tier: tierHit }));
    } catch (error) {
      d3('fail', `${t('st.config.fail')} · ${error.message}`);
    }
  }
  else if (state.device?.id === 'custom-target' && state.importedConfig) {
    cfgText = state.importedConfig;
    tierHit = t('runtime.f40ba241387b');
    d3('ok', t('st.config.ok', { tier: tierHit }));
  } else {
    d3('fail', t('st.config.noData'));
  }

  if (!src || !cfgText || !PLUGINS) d4('fail', t('st.gen.skip'));
  else {
    try {
      const text = await generateResolvedConfigText();
      if (viewToken !== selfTestViewToken) return;
      const headerOk = text.includes(`# page-version=${state.siteVersion}`) &&
        text.includes(`# device=${state.device.id} source=${state.source.id} version=${state.version.id}`);
      const targets = targetLines(text);
      const configLines = text.split('\n').filter((line) =>
        /^CONFIG_[A-Za-z0-9_.+@-]+=/.test(line) || /^# CONFIG_[A-Za-z0-9_.+@-]+ is not set$/.test(line));
      const okAll = headerOk && targets.length > 0 && configLines.length > 0;
      d4(okAll ? 'ok' : 'fail', okAll
        ? t('runtime.f56ecdc153cc', { value1: configLines.length, value2: targets.length })
        : `${t('st.gen.fail')} · header=${headerOk} target=${targets.length} config=${configLines.length}`);
    } catch (error) {
      if (viewToken !== selfTestViewToken) return;
      d4('fail', `${t('st.gen.fail')} · ${error.message}`);
    }
  }

  const gh = await timedFetch('https://api.github.com/', 6000);
  if (viewToken !== selfTestViewToken) return;
  d5(gh.ok ? 'ok' : 'warn', gh.ok ? t('st.github.ok', { ms: gh.ms }) : t('st.github.fail', { msg: gh.msg }));

  const d6 = addRow(t('st.compatibility'));
  loadedCompatibility = await compatibilityDownload;
  if (viewToken !== selfTestViewToken) return;
  if (!loadedCompatibility) {
    d6('fail', t('st.compatibility.fail', { msg: compatibilityError?.message || t('st.data.allFail') }));
    return;
  }
  let evaluation;
  try {
    evaluation = evaluateLoadedCompatibility(loadedCompatibility);
  } catch (error) {
    d6('fail', t('st.compatibility.fail', { msg: error.message }));
    return;
  }
  if (!evaluation.warnings.length) {
    d6('ok', t('st.compatibility.ok'));
    return;
  }

  const activeRuleIds = evaluation.warnings.map((warning) => warning.rule.id).join(' · ');
  d6('warn', t('st.compatibility.warn', { rules: activeRuleIds }));
  const savedResults = document.createDocumentFragment();
  while (mb.firstChild) savedResults.appendChild(mb.firstChild);
  try {
    const forced = await ensureCompatibilityRules();
    const current = evaluateLoadedCompatibility(loadedCompatibility);
    if (!current.warnings.length) d6('ok', t('st.compatibility.ok'));
    else if (forced) d6('warn', t('st.compatibility.forced', {
      rules: current.warnings.map((warning) => warning.rule.id).join(' · '),
    }));
    else d6('warn', t('st.compatibility.warn', {
      rules: current.warnings.map((warning) => warning.rule.id).join(' · '),
    }));
  } catch (error) {
    if (error?.name === 'CompatibilityCancelledError') {
      d6('warn', t('st.compatibility.cancelled', { rules: activeRuleIds }));
    } else {
      d6('fail', t('st.compatibility.fail', { msg: error.message }));
    }
  }
  selfTestViewToken += 1;
  modalCancelHandler = null;
  openModal(t('st.title'));
  probe.textContent = t('runtime.db01903c8942');
  probe.hidden = false;
  mb.textContent = '';
  mb.appendChild(savedResults);
}
$('selfTestBtn').addEventListener('click', () => { runSelfTest().catch((e) => showToast(t('toast.selfTestError', { msg: e.message }))); });
