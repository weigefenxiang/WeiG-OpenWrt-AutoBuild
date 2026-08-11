#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  catalogFileNameTokenMatch,
  catalogTargetPreference,
  preferredCatalogSource,
  resolvePackageMirrorSelection,
} from '../site/wrt/lib/catalog-engine.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(join(root, 'site', 'wrt', 'app.js'), 'utf8');
const html = readFileSync(join(root, 'site', 'wrt', 'index.html'), 'utf8');
const css = readFileSync(join(root, 'site', 'wrt', 'app.css'), 'utf8');
const project = JSON.parse(readFileSync(join(root, 'site', 'wrt', 'data', 'project.json'), 'utf8'));
const expect = (condition, message) => { if (!condition) throw new Error(message); };

expect(html.includes("if (meta && !releaseMeta) throw new Error('Site release metadata does not match its release pointer')"),
  'an invalid deployment identity can silently fall back to the main Catalog channel');
expect(html.includes('if (optional && response.status === 404) return null') &&
  !html.includes('if (optional) return null;'),
  'deployment metadata network/parse failures can silently fall back to the main Catalog channel');

expect(!app.includes('syncThemeFromMenu') && app.includes('syncFirmwareThemeFromMenu'),
  'Catalog intent still calls a missing theme coordinator');
const modalHeader = html.match(/<div class="modal-head">([\s\S]*?)<\/div>\s*<div class="modal-body"/)?.[1] || '';
expect(modalHeader.includes('id="modalProbe"') && modalHeader.includes('id="modalClose"') &&
  modalHeader.indexOf('id="modalProbe"') < modalHeader.indexOf('id="modalClose"') &&
  modalHeader.includes('<button type="button" class="modal-probe-link"') && modalHeader.includes('hidden'),
  'self-test modal probe button is not safely positioned before close');
const selfTestContract = app.match(/async function runSelfTest\(\) \{([\s\S]*?)\n\}\n\$\('selfTestBtn'/)?.[1] || '';
expect(selfTestContract.indexOf("openModal(t('st.title'))") >= 0 &&
  selfTestContract.indexOf("openModal(t('st.title'))") < selfTestContract.indexOf('await Promise.all') &&
  selfTestContract.includes('probe.hidden = false') &&
  selfTestContract.includes('CATALOG_LOADER.fetchCompatibility()') &&
  !selfTestContract.includes('ensureCompatibilityRules()'),
  'self-test does not open immediately or its generic Catalog probe entry is gated by compatibility UI');
const probeContract = app.match(/async function openPackageProbeModal\(\) \{([\s\S]*?)\n\}\n\$\('modalProbe'/)?.[1] || '';
expect(!probeContract.includes('ensureCatalogApplications()') && probeContract.includes('await ensureCatalogMenuLoaded(true)') &&
  probeContract.includes('probePackageChoices(search.value)') && probeContract.includes("'probeDepth'") && probeContract.includes('scopeSelect.value') &&
  probeContract.includes('targetSelect.value') && probeContract.includes('probeIssueUrl(request)') &&
  probeContract.includes('packages: [...selected.values()].map((choice) => choice.package)'),
  'in-page probe is still gated by applications.json.gz or no longer reuses the current Catalog/Kconfig package model');
expect(probeContract.includes('const depthOptions = [') && probeContract.includes('`L${index + 1}`') &&
  probeContract.includes("popup.setAttribute('role', 'tooltip')") &&
  probeContract.includes("if (event.key === 'Escape') closeDepthHelp()") &&
  probeContract.includes('branchSearch.addEventListener') && probeContract.includes('customScope.hidden') &&
  probeContract.includes("customScope = document.createElement('details')") && probeContract.includes('updateCustomScopeSummary') &&
  probeContract.includes('preview.hidden = true') && probeContract.includes("previewButton.setAttribute('aria-expanded'") &&
  probeContract.indexOf('layout.append(settings, picker)') < probeContract.indexOf('layout.appendChild(actions)'),
  'probe depth help, searchable custom scope, collapsed preview, or bottom action order regressed');
const probeChoices = app.match(/function probePackageChoices\(query = ''\) \{([\s\S]*?)\n\}\nfunction probeCurrentTarget/)?.[0] || '';
expect(probeChoices.includes('searchMenuOptionsSync(normalized)') &&
  probeChoices.includes("startsWith('PACKAGE_')") &&
  probeChoices.includes('optionVisible(option) && catalogOriginMatches(option)') &&
  probeChoices.includes('.map(probeChoiceFromMenuOption)') &&
  !probeChoices.includes('applications?.items') && !probeChoices.includes('item.id') &&
  app.includes('const PROBE_UI_TEXT = Object.freeze({') &&
  !app.match(/function probeUiText\(key\) \{[\s\S]*?catalogApplicationsDocument/),
  'probe no longer projects directly from the shared Advanced menuconfig search model');
const normalizeMenuSearchQueryContract = app.match(/function normalizeMenuSearchQuery\(value\) \{[\s\S]*?\n\}/)?.[0] || '';
expect(normalizeMenuSearchQueryContract.includes("replace(/^config_/, '')"),
  'shared Advanced/Probe search does not normalize CONFIG_ before candidate lookup');
const normalizeMenuSearchIdentityContract = app.match(/function normalizeMenuSearchIdentity\(value\) \{[\s\S]*?\n\}/)?.[0] || '';
const menuSearchRankContract = app.match(/function menuSearchRank\(option, query\) \{[\s\S]*?\n\}/)?.[0] || '';
const rankMenuSearchOptionsContract = app.match(/function rankMenuSearchOptions\(options, query\) \{[\s\S]*?\n\}/)?.[0] || '';
const sharedSearch = Function(`${normalizeMenuSearchQueryContract}\n${normalizeMenuSearchIdentityContract}\n${menuSearchRankContract}\n${rankMenuSearchOptionsContract}\nreturn { normalizeMenuSearchQuery, normalizeMenuSearchIdentity, menuSearchRank, rankMenuSearchOptions };`)();
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
const searchMenuOptionsContract = app.match(/function searchMenuOptions\(query\) \{([\s\S]*?)\n\}/)?.[1] || '';
expect(searchMenuOptionsContract.includes('rankMenuSearchOptions') &&
  app.includes('function searchMenuOptionsSync(query)') &&
  probeChoices.includes('searchMenuOptionsSync(normalized)') &&
  !app.includes('function normalizeProbeSearch(') && !app.includes('function probeChoiceMatches('),
  'Advanced and Probe still maintain separate search ranking/matching implementations');
expect(probeContract.includes('const selectable = choice.isPackage') &&
  probeContract.includes("row.classList.toggle('is-reference', !selectable)") &&
  probeContract.includes("if (!selectable) row.setAttribute('aria-disabled', 'true')") &&
  probeContract.includes('mark.textContent = selectable ?') &&
  probeContract.includes("if (selectable) row.addEventListener('click'"),
  'Probe does not keep PACKAGE_* selectable while ordinary Kconfig results stay reference-only');
expect(probeContract.includes("selected.has(choice.symbol)") && probeContract.includes("selected.set(choice.symbol, choice)") &&
  probeContract.includes('chip.textContent = `${choice.package} ×`') &&
  probeContract.includes('chip.title = `CONFIG_${choice.symbol}`'),
  'probe selection identity or short package chip display regressed');
expect(probeContract.includes("guide.className = 'probe-guide'") &&
  probeContract.includes("code.className = 'probe-package-id'") &&
  probeContract.includes("title.className = 'probe-package-title'") &&
  probeContract.includes("usage.className = 'probe-package-usage'") &&
  probeContract.includes('bindProbeTextTooltip(title, choice.title)') &&
  probeContract.includes('showMenuPopup(row, rowDetails)'),
  'compact probe guide or shared full-text tooltip contract regressed');
expect(css.includes('.probe-depth { grid-template-columns: repeat(4, minmax(0, 1fr))') &&
  css.includes('.probe-filter-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr))') &&
  css.includes('height: min(86vh, 820px)') &&
  css.includes('.modal.package-probe .modal-body { display: flex; min-height: 0;') &&
  css.includes('.probe-picker { display: grid; grid-template-rows: auto auto minmax(0, 1fr)') &&
  css.includes('.probe-package { display: grid; grid-template-columns: 30px minmax(190px, .9fr)') &&
  css.includes('.probe-package-id { min-width: 0;') && css.includes('overflow-wrap: anywhere; white-space: normal') &&
  css.includes('.probe-package-title, .probe-package-usage { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap') &&
  css.includes('.probe-preview[hidden] { display: none; }') &&
  css.includes('.probe-custom-scope-summary { display: flex;') && css.includes('.probe-custom-scope-body { display: grid;') &&
  css.includes('.probe-package.is-reference { cursor: default;'),
  'probe single-scroll height, horizontal rows, full IDs, truncated translations, or collapsed preview styling regressed');
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
expect(intentApplyContract.includes('resolveCatalogUserOverride(catalogInheritedValue(change.symbol), change.to)') &&
  intentApplyContract.includes('catalogUserOverrides.delete(change.symbol)') &&
  intentApplyContract.includes("curatedSource = 'restore'"),
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
  restoreContract.includes('compatibilityAcknowledgement = snapshot.compatibilityAcknowledgement') &&
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
expect(css.includes('.menuconfig-overview-row{display:grid;grid-template-columns:minmax(220px,.38fr) minmax(0,1fr)') &&
  css.includes('.menuconfig-workspace{width:100%') &&
  /@media\(max-width:640px\)\{[\s\S]*?\.menuconfig-overview-row\{grid-template-columns:minmax\(0,1fr\)\}/.test(css),
  'Selected options/import summary desktop or mobile layout no longer preserves full-width results');
const pathRow = html.match(/<div class="menuconfig-path-row">([\s\S]*?)<\/div>/)?.[1] || '';
expect(pathRow.includes('menuconfigBack') && pathRow.includes('menuconfigPanelTitle') &&
  !pathRow.includes('menuconfigSearch'), 'Advanced path row contains controls beyond back/breadcrumb');
expect(css.includes('.menuconfig-header{display:grid') &&
  css.includes('.menuconfig-breadcrumb-current{min-width:0;overflow:hidden;text-overflow:ellipsis') &&
  css.includes('font-size:var(--menuconfig-body-size)'),
  'desktop/mobile menuconfig typography or overflow contract is missing');
expect(!/\.build-contract-(?:key|chip)[^{]*\{[^}]*font(?:-size)?:\s*(?:12|13)px/.test(css),
  'build contract retains internal 12/13px typography');
expect(/\.build-contract-body \.profile-package-manage\{[^}]*font-size:var\(--menuconfig-body-size\)/.test(css),
  'expanded build-contract controls can render below the body token');
const startup = project.catalogLoadPolicy?.startup || [];
const idle = project.catalogLoadPolicy?.idle || [];
expect(startup.join(',') === 'menu,menu:language,package-mirrors' &&
  idle.join(',') === 'applications,hidden,help,compatibility' &&
  project.catalogLoadPolicy?.startupConcurrency === 3,
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
expect(css.includes('grid-template-columns:minmax(320px,1fr) clamp(210px,18vw,250px) max-content') &&
  /@media\(min-width:641px\) and \(max-width:960px\)\{[\s\S]*?\.catalog-locator\{grid-column:1 \/ -1;grid-row:1[\s\S]*?\.build-contract-head\{grid-column:1;grid-row:2\}[\s\S]*?\.build-contract-controls\{grid-column:2;grid-row:2[\s\S]*?\.build-contract-body\{grid-column:1 \/ -1;grid-row:3\}/.test(css) &&
  /@media\(max-width:640px\)\{[\s\S]*?\.catalog-locator\{grid-column:1;grid-row:1\}[\s\S]*?\.build-contract-head\{grid-column:1;grid-row:2[\s\S]*?\.build-contract-controls\{grid-column:1;grid-row:3[\s\S]*?\.build-contract-body\{grid-column:1;grid-row:4\}/.test(css),
  'desktop/tablet/mobile build-contract layout contract drifted');
expect(css.includes('.menuconfig-header{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,360px)') &&
  css.includes('.menuconfig-search-group{display:flex;flex:0 1 360px'),
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

console.log('Catalog UI state and responsive DOM contracts passed');
