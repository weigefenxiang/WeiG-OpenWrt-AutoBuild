#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFrontendRuntimeSource } from './lib/frontend-source.mjs';
import {
  catalogFileNameTokenMatch,
  catalogTargetPreference,
  preferredCatalogSource,
  resolvePackageMirrorSelection,
} from '../site/wrt/lib/catalog-engine.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFrontendRuntimeSource(root);
const html = readFileSync(join(root, 'site', 'wrt', 'index.html'), 'utf8');
const css = readFileSync(join(root, 'site', 'wrt', 'app.css'), 'utf8');
const feedbackCss = readFileSync(join(root, 'site', 'wrt', 'ui-feedback.css'), 'utf8');
const probeCss = readFileSync(join(root, 'site', 'wrt', 'package-probe-v3.css'), 'utf8');
const uiSession = readFileSync(join(root, 'site', 'wrt', 'lib', 'ui-session-state.js'), 'utf8');
const uiComponents = readFileSync(join(root, 'site', 'wrt', 'lib', 'ui-components.js'), 'utf8');
const pageShell = readFileSync(join(root, 'site', 'wrt', 'lib', 'page-shell-ui.js'), 'utf8');
const packageProbeV3 = readFileSync(join(root, 'site', 'wrt', 'lib', 'package-probe-v3-ui.js'), 'utf8');
const uiComponentsCss = readFileSync(join(root, 'site', 'wrt', 'ui-components.css'), 'utf8');
const siteConfig = JSON.parse(readFileSync(join(root, 'site', 'wrt', 'config', 'site.json'), 'utf8'));
const catalogLoading = siteConfig.catalog?.loading || {};
const i18nSource = readFileSync(join(root, 'tools', 'i18n-source.json'), 'utf8');
const i18nManifest = JSON.parse(readFileSync(join(root, 'site', 'wrt', 'data', 'i18n', 'index.json'), 'utf8'));
const i18nEnglish = JSON.parse(readFileSync(join(root, 'site', 'wrt', 'data', 'i18n', 'en.json'), 'utf8'));
const i18nZhCn = JSON.parse(readFileSync(join(root, 'site', 'wrt', 'data', 'i18n', 'zh-CN.json'), 'utf8'));
const i18nZhTw = JSON.parse(readFileSync(join(root, 'site', 'wrt', 'data', 'i18n', 'zh-TW.json'), 'utf8'));
const expect = (condition, message) => { if (!condition) throw new Error(message); };

expect(html.includes("if (meta && !releaseMeta) throw new Error('Site release metadata does not match its release pointer')"),
  'an invalid deployment identity can silently fall back to the main Catalog channel');
expect(html.includes('if (optional && response.status === 404) return null') &&
  !html.includes('if (optional) return null;'),
  'deployment metadata network/parse failures can silently fall back to the main Catalog channel');

const buildInfoContract = app.match(/function renderCatalogBuildInfo\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
expect(html.includes('<dt>Web Version</dt>') &&
  html.includes('<dt>Web Commit</dt>') &&
  html.includes('id="buildInfoCatalogCode"') &&
  html.includes('id="buildInfoCatalogData"') &&
  buildInfoContract.includes("renderBuildInfoSha('buildInfoCatalogCode', MENU_INDEX?.provenance?.codeSha)") &&
  buildInfoContract.includes("renderBuildInfoSha('buildInfoCatalogData', MENU_INDEX?.assetRef)") &&
  (app.match(/MENU_INDEX = (?:index|remote\.index);\n\s+renderCatalogBuildInfo\(\);/g) || []).length >= 2,
  'Build Information does not expose the loaded Catalog code and data identities');

const buildInfoUiContract = app.match(/function renderBuildInfo\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
expect(app.includes('button.textContent = sha;') && !app.includes('sha.slice(0, 12)') &&
  app.includes('function positionBuildInfoPanel(trigger, card)') &&
  buildInfoUiContract.includes("document.addEventListener('click'") &&
  buildInfoUiContract.includes("if (!panel.classList.contains('is-open') || panel.contains(event.target) || card.contains(event.target)) return;") &&
  buildInfoUiContract.includes('if (buildInfoInteractiveTarget(event.target)) setOpen(false);') &&
  buildInfoUiContract.includes("document.addEventListener('dblclick'") &&
  app.includes('const BUILD_INFO_INTERACTIVE_SELECTOR = [') &&
  app.includes("'a[href]', 'button', 'input', 'select', 'textarea', 'label', 'summary'") &&
  app.includes("'[role=\"button\"]', '[role=\"checkbox\"]', '[role=\"radio\"]'") &&
  app.includes("'[tabindex]:not([tabindex=\"-1\"])'") &&
  html.includes('id="buildInfoClose"') && html.includes('data-i18n-aria="btn.close"') &&
  buildInfoUiContract.includes("const closeButton = $('buildInfoClose')") &&
  buildInfoUiContract.includes("closeButton.addEventListener('click', (event) => {") &&
  buildInfoUiContract.includes("event.stopPropagation();\n    setOpen(false);") &&
  buildInfoUiContract.includes('portalBuildInfoCard();') &&
  buildInfoUiContract.includes('restoreBuildInfoCard();') &&
  feedbackCss.includes('.build-info-card-portal') &&
  css.includes('.build-info-head') && css.includes('.build-info-close') &&
  css.includes('.build-info.is-open .build-info-card') && !css.includes('.build-info:hover .build-info-card') &&
  css.includes('width: min(480px, calc(100vw - 32px))') && css.includes('text-overflow: ellipsis') &&
  html.indexOf('id="siteVersion"') < html.indexOf('id="importBtn"') && html.indexOf('id="importBtn"') < html.indexOf('id="submitBtn"'),
  'Build Information anchoring, interactive auto-close, full-width SHA display, or footer order regressed');
const refreshMenuIndexContract = app.match(/async function refreshMenuIndex\(\) \{[\s\S]*?\n\}\nfunction selectedCatalogSource/)?.[0] || '';
const renderDevicesContract = app.match(/function renderDevices\(\) \{[\s\S]*?\n\}\n\nfunction updateDeviceSummary/)?.[0] || '';
expect(refreshMenuIndexContract.includes("error?.name !== 'AbortError'") &&
  refreshMenuIndexContract.includes("setCatalogLoadState('error', error, error?.diagnostics)") &&
  renderDevicesContract.includes("if (catalogLoadMode !== 'error') setCatalogLoadState('loading')") &&
  !app.includes('No usable Catalog sources are available'),
  'Catalog startup still reports a generic failure before loading or discards provider diagnostics');
const failureClassifierSource = app.match(/(function classifyCatalogLoadFailure\([\s\S]*?\n\})\nfunction catalogLoadFailureCopy/)?.[1] || '';
const classifyCatalogLoadFailure = failureClassifierSource
  ? Function(`"use strict"; return (${failureClassifierSource});`)()
  : null;
expect(classifyCatalogLoadFailure &&
  classifyCatalogLoadFailure('', [], false).kind === 'offline' &&
  classifyCatalogLoadFailure('Catalog index unavailable', [
    { provider: 'jsdelivr', ok: false, detail: 'Failed to fetch' },
    { provider: 'github-raw', ok: false, detail: 'Failed to fetch' },
    { provider: 'github-api', ok: false, detail: 'Failed to fetch' },
  ], true).kind === 'unreachable' &&
  classifyCatalogLoadFailure('', [{ provider: 'github-api', ok: false, detail: 'HTTP 429' }], true).kind === 'rate-limit' &&
  classifyCatalogLoadFailure('', [{ provider: 'github-raw', ok: false, detail: 'HTTP 503' }], true).kind === 'remote-service' &&
  classifyCatalogLoadFailure('', [{ provider: 'github-raw', ok: false, detail: 'HTTP 404' }], true).kind === 'snapshot-missing' &&
  classifyCatalogLoadFailure('', [{ provider: 'jsdelivr', ok: false, detail: 'Catalog compressed SHA-256 mismatch' }], true).kind === 'validation',
  'Catalog failure reason classification regressed');
expect(html.includes('id="catalogLoadReasonTitle"') && html.includes('id="catalogLoadReasonText"') &&
  html.includes('id="catalogStatusLink"') && html.includes('href="https://www.githubstatus.com/"') &&
  html.includes('target="_blank" rel="noopener noreferrer"') &&
  app.includes("`Reason: ${failure.kind} - ${summary.title}`") &&
  app.includes("$('catalogStatusLink').hidden = !failed || !failure.showGithubStatus") &&
  css.includes('grid-template-areas:"summary summary" "diagnostics actions"') &&
  css.includes('grid-template-areas:"summary" "diagnostics" "actions"'),
  'Catalog failure summary, safe GitHub status link, copied reason, or mobile layout regressed');
expect(html.includes('data-i18n="btn.import.short"') && html.includes('data-i18n="btn.submit.short"') &&
  css.includes('.actionbar-row { flex-wrap: nowrap; gap: 5px; padding: 6px 8px; }') &&
  css.includes('.action-label-full { display: none; }') && css.includes('.action-label-short { display: inline; }') &&
  app.includes('const rootfs = rootfsPartitionInfo();') &&
  app.includes('const packageSizes = packageSizeEstimate();') &&
  app.includes('rootfs.value} MiB') && app.includes('packageSizeEstimateText(packageSizes)') &&
  app.includes('packageSizeEstimateTooltip(packageSizes)') &&
  app.includes('function packageSizeEstimate()') &&
  app.includes('return { direct: summarize(direct), total: summarize(total) };') &&
  app.includes('direct: fmtSize(summary.direct.knownBytes)') &&
  app.includes('total: fmtSize(summary.total.knownBytes)') &&
  app.includes('function validateCatalogBranchApplications(catalog)') &&
  app.includes('function catalogPackageSizeMap(document = catalogPackageSizesDocument)') &&
  app.includes('function validateCatalogPackageSizes(document, catalog = MENU_CATALOG)') &&
  app.includes('async function ensureCatalogPackageSizes()') &&
  app.includes("loader('packageSizes')") &&
  app.includes("kind !== 'branch-applications'") &&
  css.includes('.cap-info.rootfs-capacity::before{content:"RootFS "}') &&
  css.includes('.cap-info.rootfs-capacity::before { content: ""; }'),
  'mobile one-line action bar labels, RootFS capacity, or Catalog direct/total package-size contracts regressed');

expect(html.includes('id="selfTestBtn"') &&
  html.includes('data-i18n="btn.selfTest.short"') &&
  html.includes('data-i18n-title="btn.selfTest.title"') &&
  html.includes('>Test</button>') &&
  siteConfig.ui?.defaultLanguage === 'auto' &&
  i18nSource.includes('"btn.selfTest.short": "Test"') &&
  i18nManifest.source === 'en' && i18nManifest.fallback === 'en' &&
  i18nEnglish.strings['btn.selfTest.short'] === 'Test' &&
  i18nZhCn.strings['btn.selfTest.short'] === '检' &&
  i18nZhTw.strings['btn.selfTest.short'] === '检',
  'self-test dock control must use the English short label and i18n source');

expect(app.includes('function schema6TargetIdentity(target = state.device?.target) {') &&
  app.includes('payload.customTarget = schema6TargetIdentity();') &&
  !app.includes('payload.customTarget = state.device.target') &&
  app.includes('ACTIVE_PROFILE_BASELINE, payload.overrides, { allowedSymbols }') &&
  app.includes('const allowedSymbols = CATALOG_MODEL?.bySymbol instanceof Map'),
  'schema6 request Target identity is not minimal or schema6 import lost the active Catalog symbol allowlist');

expect(app.includes("function importedConfigOnCurrentBaseline(text) {\n  if (state.device.id !== 'catalog-target') return text;") &&
  app.includes('PROFILE_BASELINE_MODULE.mergeConfigWithProfileBaseline('),
  'Profile baseline overlay must apply only to Catalog targets and must not contaminate custom-target uploads');

const schema6BuildStart = app.indexOf("card('submit.m1.title'");
const schema6BuildEnd = app.indexOf("card('submit.existing.title'", schema6BuildStart);
const schema6BuildContract = schema6BuildStart >= 0 && schema6BuildEnd > schema6BuildStart
  ? app.slice(schema6BuildStart, schema6BuildEnd) : '';
const ensureCompatibilityAt = schema6BuildContract.indexOf('await ensureCompatibilityRules()');
const finalSelectionAt = schema6BuildContract.indexOf('const finalSelection = effectiveSelection();');
const finalConfigAt = schema6BuildContract.indexOf('const config = await generateResolvedConfigText();');
const finalOverridesAt = schema6BuildContract.indexOf('const overrides = buildRequestOverrides(config);');
const finalPayloadAt = schema6BuildContract.indexOf('const payload = {');
const importConfigContract = app.match(/async function importConfigFile\(file\) \{([\s\S]*?)\n\}\n\$\('importBtn'/)?.[1] || '';
expect(app.includes('const previewPlugins = previewSelection.normal.map') &&
  ensureCompatibilityAt >= 0 && finalSelectionAt > ensureCompatibilityAt &&
  finalConfigAt > finalSelectionAt && finalOverridesAt > finalConfigAt && finalPayloadAt > finalOverridesAt &&
  schema6BuildContract.includes('plugins, tag, lanip: state.lanip, overrides') &&
  !importConfigContract.includes('ensureCompatibilityRules') &&
  app.includes('const compatibilitySchema = Number(evaluation.loaded.compatibility?.schema ??') &&
  app.includes('schema: compatibilitySchema, rules: [warning.rule]'),
  'compatibility checks must be on-demand and final schema6 JSON must use selections after the check');

const compatibilityIdentitySource = app.match(/function compatibilityIdentityError\([\s\S]*?(?=\n\nfunction compatibilityContext)/)?.[0] || '';
const compatibilityIdentityResolver = compatibilityIdentitySource
  ? Function(`"use strict"; ${compatibilityIdentitySource}\nreturn resolveCompatibilityIdentity;`)()
  : null;
const identityCommit = 'a'.repeat(40);
const resolvedIdentity = compatibilityIdentityResolver?.(
  { id: 'source-a' },
  { branch: 'branch-a', commit: identityCommit },
  { id: 'source-a', branch: 'branch-a', commit: identityCommit },
);
expect(compatibilityIdentityResolver &&
  resolvedIdentity?.sourceId === 'source-a' &&
  resolvedIdentity?.branchName === 'branch-a' &&
  resolvedIdentity?.sourceCommit === identityCommit &&
  !compatibilityIdentitySource.includes('state.version') &&
  compatibilityIdentitySource.includes('active Catalog index') &&
  compatibilityIdentitySource.includes('sourceCommit !== loadedCommit') &&
  (() => {
    try {
      compatibilityIdentityResolver(
        { id: 'source-a' },
        { branch: 'branch-a' },
        { id: 'source-a', branch: 'branch-a', commit: identityCommit },
      );
      return false;
    } catch (error) {
      return error?.name === 'CompatibilityIdentityError';
    }
  })() &&
  (() => {
    try {
      compatibilityIdentityResolver(
        { id: 'source-a' },
        { branch: 'branch-a', commit: identityCommit },
        { id: 'source-a', branch: 'branch-a', commit: 'b'.repeat(40) },
      );
      return false;
    } catch (error) {
      return error?.name === 'CompatibilityIdentityError';
    }
  })(),
  'compatibility evaluation must use the active Catalog branch commit and fail closed on missing or mismatched identity');

const schema6ImportContract = app.match(/async function reconstructSchema6Import\(payload\) \{([\s\S]*?)\n\}\n\s*async function importConfigFile/)?.[1] || '';
const schema6ApplicationsLoad = schema6ImportContract.indexOf('await ensureCatalogApplications(!sameSnapshot);');
const schema6CrossBranch = schema6ImportContract.indexOf('if (!sameSnapshot) {');
expect(app.includes('const sameSnapshot = /^[a-f0-9]{40}$/.test(revision) && revision === currentRevision;') &&
  !app.includes('load the matching page release before importing it') &&
  app.includes('await ensureCatalogMenuLoaded(true);') &&
  schema6ApplicationsLoad >= 0 && schema6ApplicationsLoad < schema6CrossBranch &&
  app.includes("throw new Error(t('import.catalogApplicationsUnavailable', { msg: detail }));") &&
  app.includes('config: PROFILE_BASELINE_MODULE.serializeConfigMap(ACTIVE_PROFILE_BASELINE.values),') &&
  !app.includes('const applied = applySchema6MigrationPlan(migration);') &&
  app.includes('function resolveSchema6PluginMigration(payload)') &&
  app.includes('function schema6LegacyPluginPackages(payload)') &&
  app.includes("row.id.startsWith('luci-app-') ? row.id : `luci-app-${row.id}`") &&
  app.includes("legacyPackages.has(legacyPackage)") &&
  app.includes('const IMPORT_PLUGIN_TOKEN_RE = /^[+-]?[A-Za-z0-9_.@_+-]{1,96}$/;') &&
  app.includes("applyMenuValue(option, value, false, 'user');") &&
  app.includes("if (symbol.startsWith('PACKAGE_'))") &&
  app.includes("!['string', 'int', 'hex'].includes(option.type)") &&
  app.includes('function schema6MigrationSummary(migration)') &&
  !app.includes("const zh = String(state.lang || '')") &&
  i18nSource.includes('"import.catalogApplicationsUnavailable"') &&
  i18nSource.includes('"import.catalogMigrationSummary"') &&
  i18nEnglish.strings['import.catalogApplicationsUnavailable'] &&
  i18nEnglish.strings['import.catalogMigrationSummary'] &&
  i18nZhCn.strings['import.catalogApplicationsUnavailable'] &&
  i18nZhCn.strings['import.catalogMigrationSummary'] &&
  app.includes("showToast(payload.__catalogMigration.summary, 'warning')") &&
  app.includes('payload.__catalogMigration = restored.migration'),
  'schema6 import must migrate explicit plugins on the current Catalog, recalculate dependencies, and expose skipped/conflicting values');

expect(app.includes('const recommendationSteps = plans.recommended?.steps?.length') &&
  app.includes('const recommendationTargets = plans.recommended?.requiredTargets?.length') &&
  app.includes('const recommendationActions = [...recommendationSteps]') &&
  app.includes('plans.recommended?.automaticChanges || []') &&
  app.includes("t('runtime.3a95242a9e37', { value1: recommendationTargetNames.join(' → ') })") &&
  app.includes("t('menu.automaticLinkage', {") &&
  app.includes('for (const step of recommendationActions) {') &&
  app.includes('requiredTargets: recommendationTargets') &&
  app.includes('compatibilityTargetsResolved(requiredTargets)') &&
  app.includes('applyCatalogIntent(menuOptionBySymbol.get(step.symbol) || { symbol: step.symbol },') &&
  !app.includes('warning.records.find((item) => item.configSymbol === plans.recommended.symbol)'),
  'compatibility recommendation UI stopped consuming the shared ordered Kconfig plan');

const defconfigTogglePosition = html.indexOf('id="defconfigToggle"');
const menuconfigHeaderPosition = html.indexOf('<div class="menuconfig-header">');
const menuconfigBodyPosition = html.indexOf('<div id="menuconfigBody"');
expect(!uiSession.includes('compatibilityRememberDefault') &&
  uiSession.includes('let compatibilityAcknowledgement = null;') &&
  !uiSession.includes('getRememberDefault') && !uiSession.includes('setRememberDefault') &&
  uiSession.includes('clearAcknowledgement() { compatibilityAcknowledgement = null; }') &&
  app.includes('UI_COMPONENTS.createUiCheckboxControl({') &&
  app.includes('checked: false,') &&
  !app.includes('本页默认记住强制兼容选择') &&
  !app.includes('getRememberDefault') && !app.includes('setRememberDefault') &&
  app.includes("finish(rememberInput.checked ? 'forced-remember' : 'forced')") &&
  app.includes('remembered.size === forced.size') &&
  app.includes("tooltipBody: t('runtime.e8bd8b88ed27')") &&
  i18nSource.includes('Valid only on this page. Refreshing or reopening the page, or clearing site data, resets it.') &&
  !app.includes('wrt_compatibility_remember') && !uiSession.includes('localStorage') &&
  uiComponents.includes('export function createUiCheckboxControl') &&
  uiComponentsCss.includes('.ui-checkbox-control{display:inline-flex;') &&
  css.includes('.compatibility-remember{display:inline-flex;') &&
  !css.includes('.st-option.compatibility-remember'),
  'force-confirm remember-choice control, page-session default, tooltip, or non-persistence regressed');

expect(app.includes('function applySourceDefaults() {') &&
  app.includes("if (state.source.id === 'lede') {") &&
  app.includes('} else if (state.rootpwAuto) {') &&
  !app.includes("previousSource.id === 'lede'") &&
  !app.includes('applySourceDefaults(previousSource)'),
  'source-derived LEDE initial-password default can leak across Source changes');

expect(app.includes('useDefconfig: false,') &&
  app.includes("if ($('defconfigLabel')) $('defconfigLabel').textContent = 'D';") &&
  app.includes("state.useDefconfig = false;\n  if ($('defconfigToggle')) $('defconfigToggle').checked = false;") &&
  html.includes('class="defconfig-switch menuconfig-defconfig"') &&
  html.includes('<input type="checkbox" id="defconfigToggle" aria-label="Defconfig">') &&
  !html.includes('id="defconfigToggle" checked') &&
  defconfigTogglePosition > menuconfigHeaderPosition && defconfigTogglePosition < menuconfigBodyPosition &&
  css.includes('.catalog-overview-row{display:grid;grid-template-columns:minmax(0,1fr) max-content max-content;') &&
  css.includes('.build-contract-toggle{display:flex;flex:0 0 auto;') &&
  css.includes('.menuconfig-title-group{display:flex;align-items:center;gap:8px;min-width:0}') &&
  css.includes('.menuconfig-defconfig{flex:none;min-width:52px;min-height:42px;'),
  'Defconfig default, Advanced menuconfig placement, or compact Catalog overview layout regressed');

expect(html.includes('id="menuconfigFilterTrigger"') &&
  html.includes('aria-controls="menuconfigFilterMenu"') &&
  html.includes('id="menuconfigOriginFilter"') &&
  html.includes('name="menuconfigOrigin" value="all" checked') &&
  html.includes('id="menuconfigSelectedOnly"') &&
  html.includes('id="menuconfigUserSettable"') &&
  !html.includes('id="menuconfigUserSettable" checked') &&
  html.includes('<span id="menuconfigFilterSummary">Filter</span>') &&
  app.includes('let menuUserSettableOnly = false;') &&
  app.includes('function refreshMenuconfigFilterSummary()') &&
  app.includes("? menuFilterText('selectedOnly')") &&
  app.includes(": userSettableOnly ? menuFilterText('userSettable') : menuFilterText('filter')") &&
  app.includes("const menuFilterText = (key) => t('menu.filter.' + key);") &&
  !app.includes('userSettable（可直接设置）') &&
  app.includes("!menuUserSettableOnly || option.userSettable !== false") &&
  app.includes("event.target.closest('input[name=\"menuconfigOrigin\"]')") &&
  !app.includes("$('menuconfigOriginFilter').options") &&
  css.includes('.menuconfig-filter-menu{') &&
  css.includes('.menuconfig-filter-group label:has(input:checked)') &&
  css.includes('.menuconfig-filter-trigger{') &&
  css.includes('white-space:nowrap') && css.includes('white-space:normal'),
  'origin/Selected/userSettable filters are not combined in the reusable readable popover');

expect(
  css.includes('--font-page-title: 27px;') &&
  css.includes('--font-section-title: 20px;') &&
  css.includes('--font-item-title: 17px;') &&
  css.includes('--font-emphasis: 15px;') &&
  css.includes('--font-body: 15px;') &&
  css.includes('--font-description: 14px;') &&
  css.includes('--font-meta: 13px;') &&
  css.includes('--font-badge: 12px;') &&
  css.includes('font: var(--font-body)/var(--font-line-body) var(--font-family-sans)') &&
  css.includes('.brand h1 { margin: 0; font-size: var(--font-page-title);') &&
  css.includes('.step h2 { font-size: var(--font-section-title);') &&
  css.includes('padding: 13px 14px 13px 18px; font-size: var(--font-item-title); font-weight: 600;') &&
  css.includes('.plugin-name.fit-s1 { font-size: var(--font-item-title-fit-1); }') &&
  css.includes('.plugin-name.fit-s2 { font-size: var(--font-item-title-fit-2); }') &&
  css.includes('.ui-tooltip-title{display:block;margin:0;color:var(--text);font-size:var(--font-item-title);') &&
  css.includes('.ui-tooltip{position:fixed;') && css.includes('font-size:var(--font-description);') &&
  css.includes(':root{--font-page-title:21px;--font-section-title:19px;--font-item-title:17px;--font-emphasis:16px;--font-body:16px;--font-description:14px;--font-meta:13px;--font-badge:12px}') &&
  css.includes(':root{--font-page-title:20px;--font-section-title:18px;--font-item-title:16px;--font-emphasis:16px;--font-body:16px;--font-description:14px;--font-meta:13px;--font-badge:12px}') &&
  !css.includes('--menuconfig-title-size') && !css.includes('--menuconfig-body-size') &&
  !css.includes('body.dense') &&
  css.includes('.build-contract-toggle strong{font-size:var(--font-description);white-space:nowrap}') &&
  css.includes('.build-contract-key{color:var(--text2);font-size:var(--font-emphasis);min-width:0}') &&
  css.includes('font:600 var(--font-emphasis) ui-monospace,Consolas,monospace') &&
  css.includes('.build-contract-list>strong{display:block;margin-bottom:6px;color:var(--text);font-size:var(--font-emphasis)}') &&
  css.includes('.build-contract-list-head>strong{color:var(--text);font-size:var(--font-emphasis)}') &&
  css.includes('color:var(--accent);font:var(--font-emphasis) ui-monospace,Consolas,monospace') &&
  css.includes('.menuconfig-scroll{max-height:clamp(280px,55vh,620px);max-height:clamp(280px,55dvh,620px);overflow-y:auto;overflow-x:hidden;padding:0 10px 12px;overscroll-behavior-y:auto;') &&
  !css.includes('.menuconfig-scroll{max-height:clamp(280px,55vh,620px);max-height:clamp(280px,55dvh,620px);overflow-y:auto;overflow-x:hidden;padding:0 10px 12px;overscroll-behavior:contain;') &&
  pageShell.includes('const FONT_DEF = 15, FONT_MIN = 14, FONT_MAX = 24;') &&
  !app.includes('const FONT_DEF = 15, FONT_MIN = 14, FONT_MAX = 24;'),
  'shared typography scale, build-contract hierarchy, native menuconfig scroll chaining, responsive tokens, or retired density cleanup regressed');

const sharedTooltipContract = app.match(/\/\* ============ 统一悬浮说明[\s\S]*?function makePill/)?.[0] || '';
const pluginRenderContract = app.match(/function renderPlugin\(p\) \{([\s\S]*?)\n\}\n\n\/\* V10:清掉/)?.[1] || '';
expect(html.includes('class="ui-tooltip" id="uiTooltip"') &&
  html.includes('id="uiTooltipTitle"') && html.includes('id="uiTooltipEmphasis"') &&
  html.includes('id="uiTooltipBody"') &&
  !html.includes('id="menuTooltip"') && !html.includes('id="popover"') &&
  css.includes('.ui-tooltip{position:fixed;z-index:var(--z-tooltip);width:max-content;max-width:min(400px,calc(100vw - 24px))') &&
  css.includes('.ui-tooltip-emphasis{') && css.includes('color:var(--danger)') &&
  !css.includes('.menu-tooltip{') && !css.includes('.popover {') &&
  sharedTooltipContract.includes("const UI_TOOLTIP_SELECTOR = '[data-ui-tooltip-title],[data-ui-tooltip-emphasis],[data-ui-tooltip-body]'") &&
   sharedTooltipContract.includes("target?.closest?.('[data-floating-boundary]') || target?.closest?.('.modal')") &&
   sharedTooltipContract.includes('if (!owner) return viewport;') &&
   sharedTooltipContract.includes("const gap = 9;") &&
   sharedTooltipContract.includes("const actionbar = $('actionbar');") &&
   sharedTooltipContract.includes('const avoidRects = [header, actionbar]') &&
   sharedTooltipContract.includes('calculateFloatingGeometry({') &&
   sharedTooltipContract.includes("placements: ['below', 'above', 'right', 'left']") &&
   sharedTooltipContract.includes('function uiTooltipAvoidanceTarget(target)') &&
   sharedTooltipContract.includes('uiTooltip.style.width =') &&
   sharedTooltipContract.includes('const measureLayer = () =>') &&
   sharedTooltipContract.includes('if (rendered.width > geometry.width + 1 || rendered.height > geometry.height + 1 || overlapsAvoid(rendered))') &&
   sharedTooltipContract.includes('uiTooltip.dataset.placement = geometry.placement') &&
  sharedTooltipContract.includes("uiTooltip.style.removeProperty('max-height');") &&
  sharedTooltipContract.includes("uiTooltip.classList.toggle('is-pinned', uiTooltipPinned)") &&
  sharedTooltipContract.includes("uiTooltip.classList.remove('is-pinned')") &&
  sharedTooltipContract.includes('function bindUiTooltipContent(target') &&
  sharedTooltipContract.includes("document.addEventListener('pointermove'") &&
  sharedTooltipContract.includes("document.addEventListener('dblclick'") &&
  sharedTooltipContract.includes('showDatasetTooltip(target, event, true)') &&
  sharedTooltipContract.includes('function connectedUiTooltipTarget(target)') &&
  sharedTooltipContract.includes('now - uiTooltipClickAt <= 500') &&
  sharedTooltipContract.includes('target.dataset.uiTooltipKey = identity') &&
  sharedTooltipContract.includes("event.pointerType !== 'touch'") &&
  sharedTooltipContract.includes('now - uiTooltipTouchAt <= 500') &&
  sharedTooltipContract.includes('positionUiTooltip(target, event)') &&
  sharedTooltipContract.includes('!uiTooltipTarget.contains(event.target) && !uiTooltip.contains(event.target)') &&
  sharedTooltipContract.includes('if (uiTooltipPinned && uiTooltipTarget?.isConnected) positionUiTooltip(uiTooltipTarget)') &&
  css.includes('.ui-tooltip.is-pinned{pointer-events:auto;user-select:text;cursor:text}') &&
  css.includes(':is([data-ui-tooltip-title],[data-ui-tooltip-emphasis],[data-ui-tooltip-body]){touch-action:manipulation}') &&
  app.includes("bindUiTooltipContent($('menuconfigStateHelp'), { body: help })") &&
  app.includes('key: `CONFIG_${option.symbol}:${stateValue}`') &&
  app.includes('if (value === stateValue) return;') &&
  (app.match(/\.title\s*=/g) || []).length === 1 &&
  !html.includes(' title="') &&
  !pageShell.includes('.title =') &&
  !uiComponents.includes('.title =') &&
  !packageProbeV3.includes('.title =') &&
  !app.includes('function showMenuPopup(') && !app.includes('function showPopover('),
  'shared pointer-following tooltip template or content-bound positioning regressed');
expect(app.includes("dataset.uiTooltipTitle = 'D · Defconfig'") &&
  app.includes("const defconfigEmphasis = t('runtime.f891591b9e6d')") &&
  app.includes("const defconfigHelp = t('runtime.095a4944190f')") &&
  i18nSource.includes('⚠ The current version baseline is already resolved when loaded. Normally you can adjust the existing result directly without enabling D.') &&
  i18nSource.includes('potentially restoring defaults you removed manually.') &&
  app.includes("dataset.uiTooltipEmphasis = defconfigEmphasis") &&
  app.includes("dataset.uiTooltipBody = defconfigHelp") &&
  app.includes("removeAttribute('title')"),
  'Defconfig compact warning or shared tooltip binding regressed');
expect(pluginRenderContract.includes('const applyChecked = (checked) => {') &&
  pluginRenderContract.includes('bindUiTooltipContent(item, { title: pName(p), body: tooltipBody })') &&
  pluginRenderContract.includes('bindUiTooltipContent(nameBtn, { title: pName(p), body: tooltipBody })') &&
  !pluginRenderContract.includes("item.addEventListener('dblclick'") &&
  !pluginRenderContract.includes('if (curatedPluginChecked(p, st, catalogOption) && cb.checked) return;') &&
  !pluginRenderContract.includes('applyChecked(true);') &&
  !pluginRenderContract.includes('nameBtn.title = detail'),
  'plugin card selection or shared double-click tooltip binding regressed');
const originSlotContract = app.match(/function renderCatalogOriginSlot\(option, origin\) \{[\s\S]*?\n\}/)?.[0] || '';
expect(app.includes("kind: 'user', label: t('runtime.3a8e2a20d9e6')") &&
  app.includes("kind: 'user-exclude', label: t('runtime.97312fbcf425')") &&
  app.includes("kind: 'dependency', label: t('runtime.dcaa0b4fbf15')") &&
  app.includes('catalogConditionalDefaultSymbols.has(symbol)') &&
  app.includes("detail: t('runtime.b8449dfad59f')") &&
  app.includes('preferredValues: catalogPreferredValues()') &&
  app.includes("const forcedDetail = forced ? t('runtime.3cac4bbb48cb'") &&
  app.includes("displayKind: 'default', label: t('runtime.1e1ebdf2f697')") &&
  originSlotContract.includes("slot.className = 'menuconfig-origin-slot'") &&
  originSlotContract.includes("const displayKind = origin.displayKind || origin.kind") &&
  originSlotContract.includes("restorable ? ' ↶' : ''") &&
  originSlotContract.includes('restoreCatalogDefault(option)') &&
  css.includes('.catalog-origin-user{') && css.includes('.catalog-origin-user-exclude{') &&
  css.includes('.catalog-origin-default{') && css.includes('.catalog-origin-dependency{'),
  'Advanced menuconfig origin badges lost the shared, restorable source template');

expect(css.includes('/* 可勾选卡片立体模板 / shared selectable-card elevation template */') &&
  css.includes('--select-card-border: color-mix(in srgb, var(--border) 46%, #8ea0b7 54%);') &&
  css.includes('--select-card-shadow: 0 1px 1px rgba(15, 23, 42, .10), 0 4px 9px rgba(55, 75, 104, .15)') &&
  css.includes('--select-card-shadow-hover: 0 2px 2px rgba(15, 23, 42, .11), 0 7px 14px rgba(55, 75, 104, .18)') &&
  css.includes('--select-card-shadow-selected: 0 5px 12px rgba(37, 99, 235, .20)') &&
  (css.match(/--select-card-shadow: 0 1px 2px rgba\(0, 0, 0, \.28\), 0 6px 14px rgba\(0, 0, 0, \.22\);/g) || []).length >= 2 &&
  css.includes('border: 1px solid var(--select-card-border);') &&
  css.includes('var(--select-card-surface-top) 0%') &&
  css.includes('var(--select-card-hover-top) 0%') &&
  css.includes('var(--select-card-selected-top) 0%') &&
  css.includes('.plugin:not(.plugin-disabled):not(.plugin-loading):hover {') &&
  css.includes('transform: translateY(var(--select-card-lift));') &&
  css.includes('.plugin:not(.plugin-disabled):not(.plugin-loading):active {') &&
  css.includes('box-shadow: inset 0 1px 0 var(--select-card-highlight), var(--select-card-shadow);') &&
  css.includes('.plugin-disabled, .plugin-disabled:hover {') &&
  css.includes('box-shadow: none;') &&
  css.includes('@media (prefers-reduced-motion: reduce) {'),
  'shared light/dark selectable-card template, elevation, press feedback, disabled flattening, or reduced-motion fallback regressed');

expect(css.includes('/* 统一交互控件立体模板 / shared elevated interactive-control template */') &&
  css.includes('--control-border: color-mix(in srgb, var(--border) 52%, #91a0b4 48%);') &&
  css.includes('--control-shadow: 0 1px 1px rgba(15, 23, 42, .08), 0 3px 7px rgba(55, 75, 104, .13)') &&
  (css.match(/--control-shadow: 0 1px 2px rgba\(0, 0, 0, \.24\), 0 5px 12px rgba\(0, 0, 0, \.18\);/g) || []).length >= 2 &&
  css.includes('/* 标准交互控件模板：以后新增输入/下拉/按钮/选择框优先复用 .control-field / .control-action / .control-choice */') &&
  css.includes(':where(.control-field, input[type="search"], input[type="text"], input[type="password"], input[type="number"], select, textarea) {') &&
  css.includes('.control-action, .control-choice, .btn, .icon-btn, .text-btn, .pill, .device-summary, .catalog-copy-diagnostics,') &&
  css.includes('transform: translateY(var(--control-lift));') &&
  css.includes('.defconfig-switch:has(input:checked),') &&
  css.includes('.build-contract-selected-filter:has(input:checked),') &&
  css.includes('.pill-active,') &&
  css.includes('.build-contract-head {') &&
  css.includes('.btn-primary:active { transform: translateY(0);') &&
  css.includes(':where(.defconfig-switch, .build-contract-selected-filter, .adv-toggle) input[type="checkbox"] {') &&
  css.includes('box-shadow: none;\n  transform: none;\n  cursor: not-allowed;') &&
  css.includes('@media (prefers-reduced-motion: reduce) {'),
  'shared light/dark form-control template, elevation, selected states, checkbox treatment, disabled flattening, or reduced-motion fallback regressed');

expect(!app.includes('syncThemeFromMenu') && app.includes('syncFirmwareThemeFromMenu'),
  'Catalog intent still calls a missing theme coordinator');
const modalHeader = html.match(/<div class="modal-head">([\s\S]*?)<\/div>\s*<div class="modal-body"/)?.[1] || '';
expect(modalHeader.includes('id="modalProbe"') && modalHeader.includes('id="modalClose"') &&
  modalHeader.indexOf('id="modalProbe"') < modalHeader.indexOf('id="modalClose"') &&
  modalHeader.includes('<button type="button" class="modal-probe-link"') && modalHeader.includes('hidden'),
  'self-test modal probe button is not safely positioned before close');
const selfTestContract = app.match(/async function runSelfTest\(\) \{([\s\S]*?)\n\}\n\$\('selfTestBtn'/)?.[1] || '';
const selfTestRows = ["const d1 = addRow(t('st.browser'))", "const d2 = addRow(t('st.data'))",
  "const d3 = addRow(t('st.config')", "const d4 = addRow(t('st.gen'))", "const d5 = addRow(t('st.github'))"];
const selfTestPaint = selfTestContract.indexOf('await new Promise((resolve) => {');
const compatibilityDownload = selfTestContract.indexOf('const compatibilityDownload = Promise.resolve()');
const compatibilityFetch = selfTestContract.indexOf('CATALOG_LOADER.fetchCompatibility()');
const ordinaryDataDownload = selfTestContract.indexOf('const [applications] = await Promise.all([');
const githubCheck = selfTestContract.indexOf("timedFetch('https://api.github.com/'");
const compatibilityRow = selfTestContract.indexOf("const d6 = addRow(t('st.compatibility'))");
expect(selfTestContract.indexOf("openModal(t('st.title'))") >= 0 &&
  selfTestRows.every((row) => selfTestContract.indexOf(row) >= 0 && selfTestContract.indexOf(row) < selfTestPaint) &&
  selfTestPaint >= 0 && selfTestPaint < compatibilityDownload &&
  selfTestContract.indexOf('nextFrame(() => nextFrame(finishPaint))') > selfTestPaint &&
  selfTestContract.indexOf('window.setTimeout(finishPaint, 150)') > selfTestPaint &&
  compatibilityDownload < compatibilityFetch && compatibilityFetch < ordinaryDataDownload &&
  !selfTestContract.slice(ordinaryDataDownload, selfTestContract.indexOf(']);', ordinaryDataDownload)).includes('fetchCompatibility') &&
  selfTestContract.includes('probe.hidden = false') &&
  githubCheck < compatibilityRow && compatibilityRow < selfTestContract.indexOf('await compatibilityDownload') &&
  selfTestContract.indexOf('await compatibilityDownload') < selfTestContract.indexOf('evaluateLoadedCompatibility(loadedCompatibility)') &&
  githubCheck < selfTestContract.indexOf('await ensureCompatibilityRules()') &&
  selfTestContract.includes('evaluateLoadedCompatibility(loadedCompatibility)') &&
  selfTestContract.includes('viewToken !== selfTestViewToken') &&
  selfTestContract.includes('savedResults.appendChild') &&
  selfTestContract.includes("error?.name === 'CompatibilityCancelledError'"),
  'self-test does not paint five ordinary checks before background compatibility loading and gated evaluation');
const compatibilityNearMatchTextContract = selfTestContract.match(/function compatibilityNearMatchText\(diagnostics = \[\]\) \{([\s\S]*?)\n  \}/)?.[1] || '';
const compatibilityDiagnosticRow = "d6(evaluation.diagnostics?.length ? 'warn' : 'ok'";
expect(compatibilityNearMatchTextContract.includes("t('st.compatibility.inconclusive'") &&
  compatibilityNearMatchTextContract.includes("t('st.compatibility.inconclusive.commit'") &&
  compatibilityNearMatchTextContract.includes("t('st.compatibility.inconclusive.target'") &&
  i18nSource.includes('"st.compatibility.inconclusive"') &&
  i18nEnglish.strings['st.compatibility.inconclusive'] &&
  i18nZhCn.strings['st.compatibility.inconclusive'] &&
  selfTestContract.includes(compatibilityDiagnosticRow) &&
  selfTestContract.includes("current.diagnostics?.length ? 'warn' : 'ok'") &&
  selfTestContract.indexOf(compatibilityDiagnosticRow) < selfTestContract.indexOf('await ensureCompatibilityRules()') &&
  !selfTestContract.slice(selfTestContract.indexOf(compatibilityDiagnosticRow), selfTestContract.indexOf('await ensureCompatibilityRules()')).includes('deriveCompatibilityPlans') &&
  !selfTestContract.slice(selfTestContract.indexOf(compatibilityDiagnosticRow), selfTestContract.indexOf('await ensureCompatibilityRules()')).includes('recommendation'),
  'self-test does not show a yellow inconclusive near-match result without opening a compatibility recommendation');
const probeContract = app.match(/async function openPackageProbeModal\(\) \{([\s\S]*?)\n\}\n\$\('modalProbe'/)?.[1] || '';
expect(probeContract.includes('selfTestViewToken += 1') &&
  !probeContract.includes('ensureCatalogApplications()') && probeContract.includes('await ensureCatalogMenuLoaded(true)') &&
  probeContract.includes('probePackageChoices(search.value)') && probeContract.includes("'probeDepth'") && probeContract.includes('scopeSelect.value') &&
  probeContract.includes('targetSelect.value') && probeContract.includes('probeIssueUrl(request, token)') &&
  probeContract.includes('packageConfig: probePackageConfigFromText(resolvedConfig)'),
  'in-page probe can race the self-test modal, remains gated by applications, or no longer reuses the Catalog/Kconfig model');
expect(probeContract.includes('const depthOptions = [') && probeContract.includes('`L${index + 1}`') &&
  probeContract.includes("'packageCompileShort'") && probeContract.includes('title.dataset.short = probeUiText(shortKey)') &&
  probeContract.includes('bindUiTooltipContent(infoButton, {') &&
  probeContract.includes("layout.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeProbeOverlay(); });") &&
  probeContract.includes('branchSearch.addEventListener') && probeContract.includes('customScope.hidden') &&
  probeContract.includes("customScope = document.createElement('details')") && probeContract.includes('updateCustomScopeSummary') &&
  probeContract.includes('preview.hidden = true') && probeContract.includes("previewButton.setAttribute('aria-expanded'") &&
  probeContract.includes("helpButton.textContent = probeUiText('help')") &&
  probeContract.includes('actions.append(helpButton, actionsSpacer, previewButton, submitButton)') &&
  !probeContract.includes("policy.className = 'probe-policy'") &&
  probeContract.indexOf('layout.append(settings, picker)') < probeContract.indexOf('layout.appendChild(actions)'),
  'probe depth help, searchable custom scope, collapsed preview, or bottom action order regressed');
const probeChoices = app.match(/function probePackageChoices\(query = ''\) \{([\s\S]*?)\n\}\nfunction probeCurrentTarget/)?.[0] || '';
expect(probeChoices.includes('searchMenuOptionsSync(normalized)') &&
  probeChoices.includes("startsWith('PACKAGE_')") &&
  probeChoices.includes('optionVisible(option) && catalogOriginMatches(option)') &&
  probeChoices.includes('.map(probeChoiceFromMenuOption)') &&
  !probeChoices.includes('applications?.items') && !probeChoices.includes('item.id') &&
  app.includes("function probeUiText(key) { return t('probe.legacy.' + key); }") &&
  !app.includes('const PROBE_UI_TEXT = Object.freeze({') &&
  !app.match(/function probeUiText\(key\) \{[\s\S]*?catalogApplicationsDocument/),
  'probe no longer projects directly from the shared Advanced menuconfig search model');
const normalizeMenuSearchQueryContract = app.match(/function normalizeMenuSearchQuery\(value\) \{[\s\S]*?\n\}/)?.[0] || '';
expect(normalizeMenuSearchQueryContract.includes("replace(/^config_/, '')"),
  'shared Advanced/Probe search does not normalize CONFIG_ before candidate lookup');
const normalizeMenuSearchIdentityContract = app.match(/function normalizeMenuSearchIdentity\(value\) \{[\s\S]*?\n\}/)?.[0] || '';
const menuSearchPathRankContract = app.match(/function menuSearchPathRank\(option\) \{[\s\S]*?\n\}/)?.[0] || '';
const menuSearchRankContract = app.match(/function menuSearchRank\(option, query\) \{[\s\S]*?\n\}/)?.[0] || '';
const rankMenuSearchOptionsContract = app.match(/function rankMenuSearchOptions\(options, query\) \{[\s\S]*?\n\}/)?.[0] || '';
const sharedSearch = Function(`${normalizeMenuSearchQueryContract}\n${normalizeMenuSearchIdentityContract}\n${menuSearchPathRankContract}\n${menuSearchRankContract}\n${rankMenuSearchOptionsContract}\nreturn { normalizeMenuSearchQuery, normalizeMenuSearchIdentity, menuSearchRank, rankMenuSearchOptions };`)();
const oscamSearchRows = [
  { symbol: 'OSCAM_WITH_DEBUG' },
  { symbol: 'PACKAGE_oscam' },
  { symbol: 'PACKAGE_luci-i18n-oscam-zh-cn' },
  { symbol: 'PACKAGE_luci-app-oscam' },
  { symbol: 'OSCAM_WITH_SSL' },
];
const expectedOscamOrder = [
  'PACKAGE_luci-app-oscam',
  'PACKAGE_oscam',
  'PACKAGE_luci-i18n-oscam-zh-cn',
  'OSCAM_WITH_DEBUG',
  'OSCAM_WITH_SSL',
];
for (const query of ['oscam', 'luci-app-oscam', 'PACKAGE_luci-app-oscam', 'CONFIG_PACKAGE_luci-app-oscam']) {
  const sorted = sharedSearch.rankMenuSearchOptions(oscamSearchRows, query).map((row) => row.symbol);
  expect(sorted[0] === 'PACKAGE_luci-app-oscam', `shared menu/probe search alias ranking failed: ${query}`);
}
expect(JSON.stringify(sharedSearch.rankMenuSearchOptions(oscamSearchRows, 'oscam').map((row) => row.symbol)) ===
  JSON.stringify(expectedOscamOrder),
  'shared Advanced/Probe search ranking is not luci-app -> exact package -> other package -> Kconfig');
const luciSearchRows = [
  { symbol: 'PACKAGE_misc-luci-reference', path: ['Network'] },
  { symbol: 'PACKAGE_luci-app-firewall', path: ['LuCI', '3. Applications'] },
  { symbol: 'PACKAGE_luci-mod-admin-full', path: ['LuCI', '2. Modules'] },
  { symbol: 'PACKAGE_luci-collection-base', path: ['LuCI', '1. Collections'] },
  { symbol: 'PACKAGE_luci-base', path: ['LuCI'] },
  { symbol: 'PACKAGE_luci', path: ['LuCI'] },
  { symbol: 'LUCI_REFERENCE', path: ['LuCI', 'Libraries'] },
];
expect(JSON.stringify(sharedSearch.rankMenuSearchOptions(luciSearchRows, 'CONFIG_PACKAGE_luci')
  .map((row) => row.symbol)) === JSON.stringify([
  'PACKAGE_luci', 'PACKAGE_luci-base', 'PACKAGE_luci-collection-base', 'PACKAGE_luci-mod-admin-full',
  'PACKAGE_luci-app-firewall', 'LUCI_REFERENCE', 'PACKAGE_misc-luci-reference',
]), 'LuCI search is not exact/core -> numbered Catalog path -> unnumbered LuCI -> non-LuCI');
expect(!app.includes('function resolvePackageSelectionOption(') &&
  !app.includes('resolvePackageSelectionOption(option)'),
  'package selection must not reverse-map a dependency to a luci-app package');
const setMenuValueContract = app.match(/function setMenuValue\(option, value, openChildren = false\) \{[\s\S]*?\n\}/)?.[0] || '';
expect(setMenuValueContract.includes('applyMenuValue(option, value, false)') &&
  setMenuValueContract.includes('openCatalogConflictModal(option, value, violations, false)') &&
  !setMenuValueContract.includes('resolvePackageSelectionOption') &&
  setMenuValueContract.includes('const renderedValue = menuValues.get(option.symbol)') &&
  setMenuValueContract.includes("renderCatalogUiAfterIntent(openChildren && renderedValue !== 'n', option, renderedValue)"),
  'Advanced menuconfig must apply the clicked Kconfig symbol directly and keep dependency direction native');
const renderMenuOptionContract = app.match(/function renderMenuOption\(option\) \{[\s\S]*?\n\}\nfunction renderMenuLeaf/)?.[0] || '';
const hiddenDerivedContract = app.match(/function hiddenDerivedOptionActive\(option\) \{[\s\S]*?\n\}/)?.[0] || '';
const importedDefaultContract = app.match(/function reconcileImportedConditionalDefaults\(\) \{[\s\S]*?\n\}/)?.[0] || '';
expect(app.includes('function optionStateConstraints(option)') &&
  (app.match(/CATALOG_ENGINE\.kconfigStateConstraints/g) || []).length >= 3 &&
  renderMenuOptionContract.includes("for (const stateValue of ['n', 'm', 'y'])") &&
  renderMenuOptionContract.includes('actions.appendChild(renderCatalogOriginSlot(option, origin))') &&
  renderMenuOptionContract.indexOf('actions.appendChild(renderCatalogOriginSlot(option, origin))') <
    renderMenuOptionContract.indexOf("for (const stateValue of ['n', 'm', 'y'])") &&
  renderMenuOptionContract.includes("spacer.className = 'kconfig-state-spacer'") &&
  app.includes("button.setAttribute('aria-disabled', String(!stateConstraint.selectable))") &&
  app.includes('showDatasetTooltip(button, event)') &&
  app.includes('function kconfigConstraintTooltip(option, stateValue, constraints)') &&
  css.includes('.menuconfig-origin-slot{display:flex;flex:none;width:72px') &&
  !css.includes('.menuconfig-restore-slot{') && !css.includes('.menuconfig-restore-default{') &&
  css.includes('.kconfig-tri{display:grid;grid-template-columns:repeat(3,34px)') &&
  css.includes('.kconfig-tri .kconfig-state.is-current.is-editable') &&
  css.includes('.kconfig-tri .kconfig-state.is-current.is-locked') &&
  css.includes('.kconfig-tri .kconfig-state.is-disabled'),
  'N/M/Y controls lost fixed alignment, shared Catalog constraints, locked styling, or mobile-readable hints');
expect(hiddenDerivedContract.includes("option.origin === 'packageinfo-only'") &&
  hiddenDerivedContract.includes('option.userSettable !== false') &&
  hiddenDerivedContract.includes('kconfigLevel(value) > 0') &&
  app.includes('if (option?.hidden) return hiddenDerivedOptionActive(option)') &&
  importedDefaultContract.includes('CATALOG_ENGINE.reconcileKconfigDerivedValues') &&
  importedDefaultContract.includes("derivedReasons.get(symbol) === 'conditional-default'") &&
  app.includes('reconcileImportedConditionalDefaults();') &&
  app.includes("emphasis = t('runtime.2338fb34620f')") &&
  app.includes("option.defaults?.length ? t('menu.defaults'") &&
  i18nSource.includes('This symbol has no user prompt. Kconfig computes it from conditional defaults') &&
  !app.includes("PACKAGE_luci-i18n-openvpn-server-zh-cn"),
  'promptless conditional defaults no longer hide at N, reconcile imports, explain their read-only cause, or remain package-agnostic');
expect(!app.includes('button.hidden = button.disabled && !active') &&
  !app.includes("applyCatalogIntent(row.option, 'n', true, 'user')") &&
  !app.includes("applyCatalogIntent(row.option, value, true, 'user')"),
  'conflict/compatibility editors still hide constrained states or bypass the common Kconfig boundary');
const themeGenerationContract = app.match(/function applyToConfig\(text, sel\) \{([\s\S]*?)\n\}/)?.[1] || '';
expect(themeGenerationContract.includes('for (const change of themeResolution.changes || [])') &&
  !themeGenerationContract.includes('for (const symbol of themeResolution.symbols)') &&
  !themeGenerationContract.includes("symbol === themeResolution.symbol ? 'y' : 'n'"),
  'firmware generation still disables unrelated upstream themes to emulate artificial exclusivity');
const probeChoiceContract = app.match(/function probeChoiceFromMenuOption\(option\) \{[\s\S]*?\n\}/)?.[0] || '';
expect(probeChoiceContract.includes("const symbol = String(option?.symbol || '')") &&
  probeChoiceContract.includes("symbol.startsWith('PACKAGE_') ? symbol.slice('PACKAGE_'.length) : ''") &&
  probeChoiceContract.includes('displayId: packageName || symbol') &&
  probeChoiceContract.includes('userSettable: option?.userSettable !== false') &&
  !probeChoiceContract.includes('resolvePackageSelectionOption(option)'),
  'Probe rows must preserve the real Kconfig symbol and let shared setMenuValue resolve user intent');
const searchMenuOptionsContract = app.match(/function searchMenuOptions\(query\) \{([\s\S]*?)\n\}/)?.[1] || '';
expect(searchMenuOptionsContract.includes('rankMenuSearchOptions') &&
  app.includes('function searchMenuOptionsSync(query)') &&
  probeChoices.includes('searchMenuOptionsSync(normalized)') &&
  !app.includes('function normalizeProbeSearch(') && !app.includes('function probeChoiceMatches('),
  'Advanced and Probe still maintain separate search ranking/matching implementations');
const workerStartContract = app.match(/function startCatalogSearchWorker\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
const workerRequestContract = app.match(/function requestCatalogSearch\(query\) \{([\s\S]*?)\n\}/)?.[1] || '';
expect(workerStartContract.includes("normalizeMenuSearchQuery($('menuconfigSearch')?.value)") &&
  workerStartContract.includes('catalogSearchRequests.get(query) !== message.requestId') &&
  workerStartContract.includes("normalizeMenuSearchQuery($('menuconfigSearch')?.value) === query") &&
  workerRequestContract.includes('const normalized = normalizeMenuSearchQuery(query)') &&
  workerRequestContract.includes('catalogSearchRequests.set(normalized, requestId)') &&
  app.includes('const MENU_SEARCH_PAGE_SIZE = 60;') &&
  app.includes('menuVisibleLimit += currentMenuPageSize()') &&
  html.includes('id="menuconfigSearch" placeholder="Search option name / CONFIG symbol" aria-busy="false"') &&
  app.includes("input?.setAttribute('aria-busy', String(active))") &&
  css.includes('.menuconfig-search-group.is-searching::after{'),
  'normalized worker keys, stale-result protection, incremental search rendering, or busy feedback regressed');
expect(probeContract.includes('const selectable = choice.isPackage && choice.userSettable') &&
  probeContract.includes("row.classList.toggle('is-reference', !selectable)") &&
  probeContract.includes("if (!selectable) row.setAttribute('aria-disabled', 'true')") &&
  probeContract.includes("const currentValue = choice.isPackage ? probeMenuOptionState(option) : 'n'") &&
  probeContract.includes("const activeSelected = choice.isPackage && currentValue !== 'n'") &&
  probeContract.includes('mark.textContent = choice.isPackage ?') &&
  probeContract.includes("if (selectable) row.addEventListener('click'") &&
  probeContract.includes('setMenuValue(option, nextValue)'),
  'Probe rows do not read/write the shared Advanced Kconfig state');
expect(!probeContract.includes('const selected = new Map()') &&
  !probeContract.includes('probeBaseState') && !probeContract.includes('probeActiveSymbols') &&
  probeContract.includes('setMenuValue(option, nextValue)') &&
  probeContract.includes('changedProbePackageOptions()') &&
  probeContract.includes('generateResolvedConfigText()'),
  'Probe maintains private package state instead of sharing Advanced menuconfig state');
const hiddenLoadContract = app.match(/async function ensureCatalogHiddenLoaded\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
const lateBaselineContract = app.match(/function backfillCatalogBaselineForLoadedOptions\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
expect(hiddenLoadContract.includes('buildMenuIndexes(catalog)') &&
  hiddenLoadContract.includes('backfillCatalogBaselineForLoadedOptions()') &&
  hiddenLoadContract.indexOf('buildMenuIndexes(catalog)') < hiddenLoadContract.indexOf('backfillCatalogBaselineForLoadedOptions()') &&
  lateBaselineContract.includes('nativeProfileBaselineEntries()') &&
  lateBaselineContract.includes('normalizeImportedKconfigValue') &&
  lateBaselineContract.includes('catalogBaselineValues.set(option.symbol, value)') &&
  lateBaselineContract.includes('!menuTouched.has(option.symbol)') &&
  lateBaselineContract.includes('!catalogUserOverrides.has(option.symbol)') &&
  !lateBaselineContract.includes('catalogValidationContext') &&
  !lateBaselineContract.includes('new Map(menuValues)'),
  'late hidden PACKAGE values must come only from the immutable Native Profile baseline');
const probeIssueTitleContract = app.match(/function probeIssueTitle\(request\) \{[\s\S]*?\n\}/)?.[0] || '';
const probeIssueTitleForTest = Function(`${probeIssueTitleContract}\nreturn probeIssueTitle;`)();
const titleRequest = {
  packageConfig: 'CONFIG_PACKAGE_libc=y\nCONFIG_PACKAGE_libgcc=y\nCONFIG_PACKAGE_libopenssl=y\nCONFIG_PACKAGE_zlib=m\n',
  mode: 'package-compile',
};
expect(probeIssueTitleForTest({ ...titleRequest, channel: 'main' }) ===
  '[probe] libc, libgcc, libopenssl +1 · package-compile',
  'main Probe title unexpectedly contains a code-channel prefix');
expect(probeIssueTitleForTest({ ...titleRequest, channel: 'dev' }) ===
  '[probe] dev-libc, libgcc, libopenssl +1 · package-compile',
  'dev Probe title is missing its code-channel prefix');
expect(probeIssueTitleForTest({ ...titleRequest, channel: 'staging' }) ===
  '[probe] staging-libc, libgcc, libopenssl +1 · package-compile',
  'staging Probe title is missing its code-channel prefix');
expect(probeIssueTitleForTest({ ...titleRequest, channel: 'fix/example' }) ===
  '[probe] fix/example-libc, libgcc, libopenssl +1 · package-compile',
  'fix Probe title is missing its exact code-channel prefix');
expect(app.includes('function probePackageBaselineState(option)') &&
  app.includes('function changedProbePackageOptions()') &&
  probeContract.includes('const changed = changedProbePackageOptions()') &&
  probeContract.includes('selectedBox.hidden = changed.length === 0') &&
  probeContract.includes('const baselineValue = probePackageBaselineState(option)') &&
  probeContract.includes("chip.textContent = `${packageName}=${String(value).toUpperCase()} ×`") &&
  !probeContract.includes('activeProbePackageOptions()') && !probeContract.includes('selected.set('),
  'Probe selected summary must hide baseline defaults and show only shared Kconfig changes');
expect(probeContract.includes("guide.className = 'probe-guide'") &&
  probeContract.includes("code.className = 'probe-package-id'") &&
  probeContract.includes("title.className = 'probe-package-title'") &&
  probeContract.includes("usage.className = 'probe-package-usage'") &&
  probeContract.includes("info.className = 'probe-package-info'") && probeContract.includes("info.textContent = '!'") &&
  probeContract.includes('bindProbeTextTooltip(title, choice.title)') &&
  probeContract.includes('bindUiTooltipContent(row, { body: rowDetails })') &&
  probeContract.includes('showDatasetTooltip(info, event)') &&
  !probeContract.includes('showMenuPopup(row, rowDetails)') &&
  !probeContract.includes('probe-info-popup'),
  'compact probe guide or shared full-text tooltip contract regressed');
expect(probeCss.includes('height: min(90vh, 920px)') &&
  probeCss.includes('max-height: calc(100vh - 20px)') &&
  /\.modal\.package-probe \.modal-body\s*\{\s*display:\s*flex;\s*min-height:\s*0;/.test(probeCss) &&
  probeCss.includes('.probe-layout {') && probeCss.includes('grid-template-rows: auto minmax(150px, 1fr) auto') &&
  probeCss.includes('.probe-picker { display: grid; grid-template-rows: auto minmax(0, 1fr)') &&
  probeCss.includes('.probe-picker:has(.probe-selected) { grid-template-rows: auto auto minmax(0, 1fr); }') &&
  probeCss.includes('.probe-package {') && probeCss.includes('grid-template-columns: 30px minmax(190px, .9fr)') &&
  probeCss.includes('.probe-package-id { min-width: 0;') && probeCss.includes('overflow-wrap: anywhere; white-space: normal') &&
  probeCss.includes('.probe-package-title, .probe-package-usage { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap') &&
  probeCss.includes('.probe-package-info { display: none;') && probeCss.includes('.probe-package-info { display: grid;') &&
  probeCss.includes('.probe-depth {') && probeCss.includes('overflow-x: auto; overflow-y: hidden') &&
  probeCss.includes('.probe-field.probe-depth { grid-template-columns: repeat(2, minmax(0, 1fr)); }') &&
  !probeCss.includes('.probe-depth-title::after') &&
  probeCss.includes('.probe-selected {') && probeCss.includes('max-height: 34px;') &&
  probeCss.includes('.probe-selected-chips { display: flex; min-width: 0; flex: 1;') &&
  probeCss.includes('.probe-overlay { position: absolute; inset: 0;') &&
  probeCss.includes('.probe-actions-spacer { flex: 1; }') &&
  probeCss.includes('.probe-package-title, .probe-package-usage { display: none; }') &&
  probeCss.includes('.probe-preview[hidden] { display: none; }') &&
  probeCss.includes('.probe-custom-scope-summary { display: flex;') && probeCss.includes('.probe-custom-scope-body { display: grid;') &&
  probeCss.includes('.probe-package.is-reference { cursor: default;') &&
  probeCss.includes('@supports (height: 100dvh)') &&
  probeCss.includes('height: min(90dvh, 920px) !important') &&
  !css.includes('.modal.package-probe') && !/\.probe-[A-Za-z]/.test(css),
  'Probe authority must keep the current V3 layout, legacy fallback controls, bounded overlays, and no duplicate app.css presentation');
expect(app.includes("label: 'Root Kconfig options', uiKey: 'rootOptions', usageUiKey: 'rootOptionsHelp'") &&
  !app.includes("label: 'General settings', usage: 'Root configuration options'"),
  'root Catalog options are mislabeled as an upstream General settings menu');
expect(app.includes("$('modalProbe').hidden = true") &&
  css.includes('.modal-head-actions') && css.includes('.modal-probe-link'),
  'ordinary modals can retain the probe entry or its responsive header styling is missing');
expect(app.includes('function curatedPluginIntent(plugin, catalogOption = null)') &&
  app.includes('function curatedPluginChecked(plugin, pluginStatus, catalogOption = null)'),
  'curated checkbox rendering and selection summaries do not share one state contract');
const intentContract = app.match(/function curatedPluginIntent\(plugin, catalogOption = null\) \{([\s\S]*?)\n\}/)?.[1] || '';
expect(intentContract.includes('catalogUserOverrides.has(option.symbol)') &&
  intentContract.includes("? 'excluded' : 'selected'") &&
  intentContract.includes("return state.sel.has(plugin.id) ? 'selected' : 'none'"),
  'Catalog and legacy curated intent authorities are not explicit');
const intentApplyContract = app.match(/function applyCatalogIntent\(option, value, force = false, source = 'user'\) \{([\s\S]*?)\n\}/)?.[1] || '';
const explicitIntentContract = app.match(/function recordCatalogExplicitIntent\(option, value\) \{([\s\S]*?)\n\}/)?.[1] || '';
expect(explicitIntentContract.includes('resolveCatalogUserOverride(catalogInheritedValue(option.symbol), value)') &&
  explicitIntentContract.includes('catalogUserOverrides.delete(option.symbol)') &&
  explicitIntentContract.includes("return 'restore'") &&
  intentApplyContract.includes('recordCatalogExplicitIntent(changedOption || option, change.to)') &&
  intentApplyContract.includes('!result.changes.some((change) => change.symbol === option.symbol)'),
  'returning to an inherited Catalog value leaves a zombie explicit override');
const groupBadgeContract = app.match(/function updateGroupBadges\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
const statsContract = app.match(/function updateStats\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
expect(groupBadgeContract.includes("curatedPluginIntent(p) === 'selected'") &&
  !groupBadgeContract.includes('state.removed') &&
  statsContract.includes('const n = sel.all.length;') &&
  !statsContract.includes('sel.all.length + sel.removed.length'),
  'an excluded plugin is still mislabeled or counted as selected');
expect(css.includes('.plugin input[type="checkbox"]:not(:disabled):hover') &&
  css.includes('.plugin input[type="checkbox"]:disabled') &&
  css.includes('.plugin input[type="checkbox"]:disabled:checked') &&
  css.includes('.plugin input[type="checkbox"]:focus-visible') &&
  /\.plugin input\[type="checkbox"\] \{[\s\S]*?appearance: none;[\s\S]*?background: #fff;/.test(css),
  'enabled, checked, disabled, locked, or keyboard-focus checkbox visuals are not distinct');
expect(/function applyCatalogIntent[\s\S]+snapshotCatalogUiState\(\)[\s\S]+catch \(error\)[\s\S]+restoreCatalogUiState/.test(app),
  'Catalog intent is not failure-atomic');
const snapshotContract = app.match(/function snapshotCatalogUiState\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
const restoreContract = app.match(/function restoreCatalogUiState\(snapshot\) \{([\s\S]*?)\n\}/)?.[1] || '';
expect(snapshotContract.includes('revision: catalogStateRevision') &&
  snapshotContract.includes('compatibilityAcknowledgement'),
  'Catalog rollback snapshot does not preserve revision/acknowledgement');
expect(restoreContract.includes('catalogStateRevision = snapshot.revision') &&
  restoreContract.includes('UI_SESSION.compatibility.setAcknowledgement(snapshot.compatibilityAcknowledgement)') &&
  restoreContract.includes('clearCatalogDerivedCaches()') &&
  !restoreContract.includes('markCatalogStateChanged'),
  'failure rollback is incorrectly counted as a configuration change');
expect(app.includes('function restoreMap(target, source)') &&
  app.includes('function restoreSet(target, source)'),
  'atomic rollback collection restorers are missing');
expect((app.match(/restoreCatalogUiState\(snapshot\);/g) || []).length === 4,
  'not every atomic rollback path shares the clean restore contract');
expect((app.match(/reconcileCatalogReadyState\(\)/g) || []).length >= 3,
  'menu/applications arrival paths do not share ready reconciliation');
const applicationsLoader = app.match(/async function ensureCatalogApplications\(forceRefresh = false\) \{([\s\S]*?)\n\}/)?.[1] || '';
expect(html.includes('id="pluginStep"') && app.includes('function initCatalogApplicationsDemand()') &&
  app.includes("new IntersectionObserver") && app.includes("{ rootMargin: '320px 0px' }") &&
  applicationsLoader.includes('if (catalogApplicationsPromise) return catalogApplicationsPromise') &&
  applicationsLoader.includes('if (catalogApplicationsDocument && !forceRefresh) return catalogApplicationsDocument'),
  'curated applications do not share one demand/idle promise and document cache');
expect(app.includes("catalogApplicationsLoadState = 'error'") &&
  app.includes("row.addEventListener('click', () => requestCatalogApplications(true))") &&
  css.includes('.catalog-applications-state[data-state=error]') &&
  css.includes('.catalog-applications-spinner'),
  'curated applications loading/error/retry state is missing');
expect(app.includes("return 'loading'") && app.includes("st === 'loading'"),
  'curated options do not expose a transient loading state');
expect(app.includes('resolveEffectiveTheme') && !/matchAll\(\/\^CONFIG_PACKAGE_/.test(app),
  'config generation does not use the shared effective resolver');

const header = html.match(/<div class="menuconfig-header">([\s\S]*?)<\/div>\s*<\/div>/)?.[1] || '';
expect(header.includes('id="menuconfigToggle"') && header.includes('id="menuconfigSearch"') &&
  header.indexOf('id="menuconfigSearch"') > header.indexOf('</button>'),
  'Advanced search is not a sibling of the accessible toggle button');
const searchInput = app.indexOf("$('menuconfigSearch').oninput = () => {");
const searchExpansion = app.indexOf('void setMenuconfigExpanded(true)', searchInput);
const searchDebounce = app.indexOf('clearTimeout(searchTimer)', searchInput);
const expansionContract = app.match(/async function setMenuconfigExpanded\(expanded\) \{([\s\S]*?)\n\}/)?.[1] || '';
expect(searchInput >= 0 && searchExpansion > searchInput && searchExpansion < searchDebounce &&
  expansionContract.includes('applyMenuconfigExpandedState(expanded)') &&
  expansionContract.includes('await ensureCatalogMenuLoaded(false)') &&
  expansionContract.includes('request !== menuExpansionRequest') &&
  expansionContract.includes('applyMenuconfigExpandedState(false)'),
  'non-empty Advanced search does not expand immediately through the shared race-safe loader');
const overview = html.match(/<div class="menuconfig-overview-row" id="menuconfigOverviewRow"[\s\S]*?<\/div>\s*<div class="import-workspace"/)?.[0] || '';
expect(overview.includes('id="menuconfigSelectedToggle"') && overview.includes('id="importSummary"') &&
  overview.indexOf('id="menuconfigSelectedToggle"') < overview.indexOf('id="importSummary"') &&
  overview.includes('aria-controls="menuconfigWorkspace"') &&
  html.indexOf('id="menuconfigWorkspace"') > html.indexOf('id="menuconfigOverviewRow"') &&
  app.includes("$('menuconfigWorkspace').hidden = selectedCollapsed"),
  'Selected options is not left of the import summary with the full-width workspace below');
expect(html.includes('class="menuconfig-selected-label"') &&
  css.includes('.menuconfig-overview-row{display:grid;grid-template-columns:max-content minmax(0,1fr)') &&
  css.includes('.menuconfig-selected-toggle{display:flex;align-items:center;justify-content:space-between;width:auto;min-width:220px;max-width:100%;min-height:42px;margin:0;padding:0 10px;') &&
  css.includes('.menuconfig-selected-label{display:flex;align-items:center;min-width:0;white-space:nowrap}') &&
  css.includes('.import-summary{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0;min-height:42px;overflow:hidden;padding:0 10px;') &&
  css.includes('.import-summary strong{flex:1 1 auto;min-width:0;overflow:hidden;') &&
  css.includes('.import-summary .text-btn{flex:none;padding:4px 10px}') &&
  css.includes('text-overflow:ellipsis;white-space:nowrap}') &&
  css.includes('.import-summary strong{overflow-x:auto;') &&
  css.includes('.import-summary{align-items:center;flex-direction:row}') &&
  !css.includes('.import-summary{align-items:flex-start;flex-direction:column}') &&
  app.includes('bindUiTooltipContent(summaryTextElement, { body: summaryText })') &&
  css.includes('.menuconfig-workspace{width:100%') &&
  /@media\(max-width:640px\)\{[\s\S]*?\.menuconfig-overview-row\{grid-template-columns:minmax\(0,1fr\)\}/.test(css),
  'Selected options/import summary can wrap, hide full details, or lose full-width/mobile access');
const pathRow = html.match(/<div class="menuconfig-path-row">([\s\S]*?)<\/div>/)?.[1] || '';
expect(pathRow.includes('menuconfigBack') && pathRow.includes('menuconfigPanelTitle') &&
  !pathRow.includes('menuconfigSearch'), 'Advanced path row contains controls beyond back/breadcrumb');
expect(css.includes('.menuconfig-header{display:grid') &&
  css.includes('.menuconfig-breadcrumb-current{min-width:0;overflow:hidden;text-overflow:ellipsis') &&
  css.includes('font-size:var(--font-description)'),
  'desktop/mobile menuconfig typography or overflow contract is missing');
expect(!/\.build-contract-(?:key|chip)[^{]*\{[^}]*font(?:-size)?:\s*(?:12|13)px/.test(css),
  'build contract retains internal 12/13px typography');
expect(/\.build-contract-body \.profile-package-manage\{[^}]*font-size:var\(--font-description\)/.test(css),
  'expanded build-contract controls can render below the body token');
const startup = catalogLoading.startup || [];
const idle = catalogLoading.idle || [];
expect(startup.join(',') === 'menu,menu:language,package-mirrors' &&
  idle.join(',') === 'applications,hidden,help,compatibility' &&
  catalogLoading.startupConcurrency === 3,
  'first-paint/idle task policy or concurrency drifted');
expect((app.match(/'package-mirrors': ensurePackageMirrors/g) || []).length === 1,
  'package mirrors have duplicate startup/idle task registrations');
const mirrorLoader = app.match(/async function ensurePackageMirrors\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
expect(mirrorLoader.includes('if (!packageMirrorsPromise)') &&
  (app.match(/loadJson\('package-mirrors\.json'\)/g) || []).length === 1,
  'package mirror loading does not share one promise/cache loader');

const mirrorIds = ['anonymous-upstream', 'anonymous-automatic', 'anonymous-manual'];
const mirrorSelection = (overrides = {}) => resolvePackageMirrorSelection({
  timezone: 'Region/Local',
  availableIds: mirrorIds,
  currentId: 'anonymous-upstream',
  localTimezone: 'Region/Local',
  automaticId: 'anonymous-automatic',
  sourceDefaultId: 'anonymous-upstream',
  ...overrides,
});
expect(mirrorSelection() === 'anonymous-automatic',
  'local firmware timezone did not choose the automatic mirror');
expect(mirrorSelection({ timezone: 'Region/Remote' }) === 'anonymous-upstream',
  'non-local firmware timezone did not choose the source default');
const beforeMirrorData = mirrorSelection({ availableIds: ['anonymous-upstream'] });
expect(beforeMirrorData === 'anonymous-upstream' && mirrorSelection({ currentId: beforeMirrorData }) === 'anonymous-automatic',
  'mirror default does not converge when data arrives after firmware timezone');
expect(mirrorSelection({ timezone: 'Region/Remote', currentId: 'anonymous-upstream' }) === 'anonymous-upstream' &&
  mirrorSelection({ timezone: 'Region/Local', currentId: 'anonymous-upstream' }) === 'anonymous-automatic',
  'non-explicit mirror did not follow a firmware timezone change');
expect(mirrorSelection({ currentId: 'anonymous-manual', explicit: true }) === 'anonymous-manual',
  'manual explicit mirror was overwritten by timezone defaulting');
expect(mirrorSelection({ timezone: 'Region/Remote', currentId: 'anonymous-automatic', explicit: true }) ===
  'anonymous-automatic', 'imported explicit mirror was overwritten by timezone defaulting');
expect(app.includes('await ensurePackageMirrors();') &&
  app.indexOf('await ensurePackageMirrors();', app.indexOf('async function importConfigFile')) <
    app.indexOf('restoreSelections(state.importedConfig, payload);', app.indexOf('async function importConfigFile')),
  'import can validate an explicit mirror before the shared mirror data arrives');

const contractHead = html.match(/<div class="build-contract-head">([\s\S]*?)<\/div>/)?.[1] || '';
expect(contractHead.includes('buildContractTitle') && contractHead.includes('build-contract-chevron') &&
  !contractHead.includes('buildContractCatalog') && !contractHead.includes('class="hint"'),
  'collapsed build contract repeats the Catalog commit');
expect(css.includes('grid-template-columns:minmax(0,1fr) max-content max-content') &&
  /@media\(min-width:641px\) and \(max-width:960px\)\{[\s\S]*?\.catalog-locator\{grid-column:1 \/ -1;grid-row:1[\s\S]*?\.build-contract-head\{grid-column:1;grid-row:2\}[\s\S]*?\.build-contract-controls\{grid-column:2;grid-row:2[\s\S]*?\.build-contract-body\{grid-column:1 \/ -1;grid-row:3\}/.test(css) &&
  /@media\(max-width:640px\)\{[\s\S]*?\.catalog-locator\{grid-column:1;grid-row:1\}[\s\S]*?\.build-contract-head\{grid-column:1;grid-row:2[\s\S]*?\.build-contract-controls\{grid-column:1;grid-row:3[\s\S]*?\.build-contract-body\{grid-column:1;grid-row:4\}/.test(css),
  'desktop/tablet/mobile build-contract layout contract drifted');
expect(css.includes('.menuconfig-header{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,360px)') &&
  css.includes('.menuconfig-search-group{position:relative;display:flex;flex:0 1 360px'),
  'top contract compaction changed the Advanced menuconfig search');

const sources = [{ id: 'anonymous-default' }, { id: 'anonymous-user' }, { id: 'anonymous-state' }];
expect(preferredCatalogSource(sources, ['', '', '', 'anonymous-default']) === 'anonymous-default',
  'first render did not use the configured default source');
expect(preferredCatalogSource(sources,
  ['', 'anonymous-user', 'anonymous-state', 'anonymous-default']) === 'anonymous-user',
  'current user source was overwritten by the default source');
expect(preferredCatalogSource(sources,
  ['anonymous-user', 'anonymous-state', 'anonymous-default']) === 'anonymous-user',
  'explicit source request did not win');
const policyTarget = { family: 'preferred', board: 'generic', profile: 'default' };
const userTarget = { family: 'other', board: 'custom', profile: 'device' };
expect(catalogTargetPreference({ policyTarget }) === policyTarget,
  'first render did not use the preferred target');
expect(Object.keys(catalogTargetPreference({ policyTarget, currentTarget: userTarget })).length === 0,
  'ordinary selector change was pulled back to the policy target');
expect(catalogTargetPreference({ policyTarget, stateTarget: userTarget }) === userTarget,
  'valid target state was overwritten by the policy target');
expect(catalogTargetPreference({ policyTarget, currentTarget: userTarget,
  newCatalogRequested: true }) === policyTarget,
  'new Source/Branch did not restore the preferred target');
expect(catalogTargetPreference({ policyTarget, currentTarget: userTarget,
  requestedTarget: userTarget, newCatalogRequested: true }) === userTarget,
  'explicit target request was overwritten by the preferred target');
expect(app.indexOf("$('targetSource')?.value") <
  app.indexOf('PROJECT?.catalogSelectionPolicy?.defaultSource'),
  'renderCatalogPicker does not prioritize the current source control');
for (const name of ['maintainer.config', 'domain.config', 'domain-mainframe.config']) {
  expect(!catalogFileNameTokenMatch('main', name), `short branch matched substring: ${name}`);
}
expect(catalogFileNameTokenMatch('main', 'build-main.config'),
  'short branch token was not detected');
expect(catalogFileNameTokenMatch('master', 'firmware_master_backup.config'),
  'development branch token was not detected');
expect(catalogFileNameTokenMatch('release-27.4', 'firmware-27.4-device.config', ['27.4']),
  'numeric branch alias was not detected');

expect(
  css.includes('.plugin-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));\n  gap: 8px;\n  padding: 10px;\n}') &&
  css.includes('border: 1px solid var(--select-card-border);') &&
  css.includes('border-radius: var(--radius);') &&
  css.includes('.plugin:hover {\n  background: var(--plugin-hover);\n  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));\n}') &&
  css.includes('.plugin:has(input:checked) {\n  background: var(--plugin-selected);\n  border-color: var(--accent);') &&
  !css.includes('.plugin { border-right: none; padding: 12px 14px; }'),
  'plugin option cards lost their independent rounded boundary template');

console.log('Catalog UI state and responsive DOM contracts passed');

expect(!app.includes('probe-request.json'), 'removed Probe request file protocol returned');
expect(app.includes('WEIG_PACKAGE_PROBE_STATE_V2:') &&
  app.includes("template: 'package-probe.yml', title: probeIssueTitle(request), state: token") &&
  app.includes('packageConfig: probePackageConfigFromText(resolvedConfig)') &&
  app.includes('function probeIssueTitle(request)'),
  'Probe does not submit the shared Advanced package state directly');
