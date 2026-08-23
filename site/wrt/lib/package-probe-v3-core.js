/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Package Probe V3 UI adapter. Loaded after app.js as a classic script so it
 * reuses the existing global Kconfig/Catalog runtime instead of creating a
 * second dependency engine or package database.
 */
'use strict';

const PROBE_V3_DEPTH_OPTIONS = Object.freeze([
  Object.freeze({ level: 1, mode: 'config-resolve', shortKey: 'depth1Short', titleKey: 'configResolve', helpKey: 'configResolveHelp' }),
  Object.freeze({ level: 2, mode: 'package-compile', shortKey: 'depth2Short', titleKey: 'packageCompile', helpKey: 'packageCompileHelp' }),
  Object.freeze({ level: 3, mode: 'rootfs-integration', shortKey: 'depth3Short', titleKey: 'rootfsIntegration', helpKey: 'rootfsIntegrationHelp' }),
  Object.freeze({ level: 4, mode: 'firmware-integration', shortKey: 'depth4Short', titleKey: 'firmwareIntegration', helpKey: 'firmwareIntegrationHelp' }),
  Object.freeze({ level: 5, mode: 'boot-smoke', shortKey: 'depth5Short', titleKey: 'bootSmoke', helpKey: 'bootSmokeHelp' }),
  Object.freeze({ level: 6, mode: 'runtime-health', shortKey: 'depth6Short', titleKey: 'runtimeHealth', helpKey: 'runtimeHealthHelp' }),
  Object.freeze({ level: 7, mode: 'reboot-validation', shortKey: 'depth7Short', titleKey: 'rebootValidation', helpKey: 'rebootValidationHelp' }),
]);

const PROBE_V3_COMPARISON = Object.freeze({
  mode: 'paired-exclusion',
  executionOrder: Object.freeze(['baseline', 'final']),
});

const PROBE_V3_RESULT_STATUSES = Object.freeze([
  'compatible', 'incompatible', 'blocked', 'skipped', 'unresolved',
]);

function probeV3ComparisonRequest(enabled = true) {
  // The comparison field was introduced after the original Probe state
  // contract. Treat an omitted/legacy value as enabled, while preserving an
  // explicit user opt-out. Keeping this distinction here makes every caller
  // follow the same migration rule instead of relying on truthiness.
  if (enabled === false) return null;
  return {
    mode: PROBE_V3_COMPARISON.mode,
    executionOrder: [...PROBE_V3_COMPARISON.executionOrder],
  };
}

function probeV3ResultStatus(result) {
  const raw = String(result?.status || result?.outcome || result?.result || '').trim().toLowerCase();
  return PROBE_V3_RESULT_STATUSES.includes(raw) ? raw : 'unresolved';
}

function probeV3ResultReason(result) {
  const values = [
    result?.reason, result?.cause, result?.failureCause, result?.attribution,
    result?.diagnosis?.reason, result?.classification?.reason,
  ];
  return values.map((value) => String(value || '').trim()).find(Boolean) || '';
}

// Result cards are rendered by the Catalog/Actions side, but keep one small
// browser-side presentation model for any future result viewer. In particular,
// a Base Profile blocker must never look like a plugin incompatibility.
function probeV3ResultPresentation(result) {
  const status = probeV3ResultStatus(result);
  const reason = probeV3ResultReason(result);
  const attribution = String(result?.attribution || '').trim().toLowerCase().replaceAll('_', '-');
  const normalizedReason = reason.toLowerCase().replaceAll('_', '-');
  const baseProfile = status === 'blocked' || attribution === 'base-profile' ||
    /(?:^|[- ])base[- ]?profile(?:[- ]|$)/.test(normalizedReason);
  const pluginEvaluated = status === 'compatible' || status === 'incompatible'
    ? true : status === 'unresolved' ? null : false;
  return {
    status,
    reason,
    baseProfile,
    pluginEvaluated,
    pluginEvaluation: pluginEvaluated === true ? 'evaluated' :
      pluginEvaluated === false ? 'not-evaluated' : 'unknown',
    statusKey: `result${status[0].toUpperCase()}${status.slice(1)}`,
    evaluationKey: pluginEvaluated === true ? 'pluginEvaluated' :
      pluginEvaluated === false ? 'pluginNotEvaluated' : 'pluginEvaluationUnknown',
  };
}

function probeV3UiText(key) {
  const external = catalogApplicationsDocument?.probeUi?.strings?.[key];
  if (external && typeof external === 'object') {
    const exact = String(external[state.lang] || external.en || external['zh-CN'] || '').trim();
    if (exact) return exact;
  }
  const depthOption = PROBE_V3_DEPTH_OPTIONS.find((option) =>
    option.shortKey === key || option.titleKey === key || option.helpKey === key);
  if (depthOption) return key === depthOption.shortKey ? `L${depthOption.level}` : depthOption.mode;
  const fallback = {
    environmentLimit: 'coverageMode', sourceExcluded: 'notApplicable',
  }[key] || key;
  return t('probe.v3.' + fallback);
}
function probeV3CoveragePolicy() {
  const coverage = catalogApplicationsDocument?.probeUi?.coverage;
  const defaultLimit = Number(coverage?.defaultLimit);
  const maxLimit = Number(coverage?.maxLimit);
  if (!Number.isInteger(defaultLimit) || !Number.isInteger(maxLimit) || defaultLimit < 1 || defaultLimit > maxLimit) {
    throw new Error('Catalog Probe coverage contract is unavailable');
  }
  return { defaultLimit, maxLimit };
}
function probeV3CodeChannel() {
  const branch = String(state.buildMeta?.branch || 'main');
  if (branch.startsWith('fix/')) return branch;
  return ['dev', 'staging', 'main'].includes(branch) ? branch : 'main';
}
function meaningfulProbeV3Text(value) {
  const text = String(value || '').trim();
  return /[\p{L}\p{N}]/u.test(text) ? text : '';
}
function firstMeaningfulProbeV3Text(...values) {
  for (const value of values) {
    const text = meaningfulProbeV3Text(value);
    if (text) return text;
  }
  return '';
}
function probeV3ChoiceFromMenuOption(option) {
  const symbol = String(option?.symbol || '');
  const packageName = symbol.startsWith('PACKAGE_') ? symbol.slice('PACKAGE_'.length) : '';
  const translation = menuOptionTranslation(option);
  return {
    symbol,
    package: packageName,
    displayId: packageName || symbol,
    isPackage: Boolean(packageName),
    userSettable: option?.userSettable !== false,
    title: firstMeaningfulProbeV3Text(translation.title, option.promptZh, option.promptEn),
    usage: firstMeaningfulProbeV3Text(translation.usage, option.usageZh, option.usageEn),
  };
}
function probeV3PackageChoices(query = '') {
  const normalized = normalizeMenuSearchQuery(query);
  const options = normalized.length >= 2
    ? searchMenuOptionsSync(normalized)
    : rankMenuSearchOptions(
      menuSearchOptions.filter((option) => String(option?.symbol || '').startsWith('PACKAGE_')),
      normalized,
    );
  return options
    .filter((option) => optionVisible(option) && catalogOriginMatches(option))
    .map(probeV3ChoiceFromMenuOption);
}
function probeV3CurrentTarget() {
  const source = selectedCatalogSource();
  const branch = selectedCatalogBranch(source);
  const target = (MENU_CATALOG?.targets || []).find((item) =>
    item.board === targetSelectorValues.system && item.subtarget === targetSelectorValues.subtarget);
  const profile = target?.profiles?.find((item) => item.id === targetSelectorValues.profile) ||
    (!(target?.profiles || []).length ? { id: '', name: 'Default profile' } : null);
  if (!source || !branch || !target || !profile) return null;
  return {
    source: String(source.id || ''),
    branch: String(branch.branch || branch.id || ''),
    targetSystem: String(target.board || ''),
    subtarget: String(target.subtarget || ''),
    target: String(target.id || ''),
    profile: String(profile.id || ''),
    profileLabel: String(profile.name || profile.id || 'Default profile'),
  };
}

function probeV3ScopeOptionMaps() {
  const maps = {
    sources: new Map(), branches: new Map(), targetSystems: new Map(), subtargets: new Map(), profiles: new Map(),
  };
  for (const source of MENU_INDEX?.sources || []) {
    const sourceId = String(source?.id || '');
    if (!sourceId || sourceId.toLowerCase() === 'hanwckf') continue;
    maps.sources.set(sourceId, String(source?.label || sourceId));
    for (const branch of source?.branches || []) {
      if (branch?.state === 'unavailable') continue;
      const branchName = String(branch?.branch || branch?.id || '');
      if (branchName) maps.branches.set(branchName, branchName);
    }
  }
  for (const target of MENU_CATALOG?.targets || []) {
    const targetSystem = String(target?.board || '');
    const subtarget = String(target?.subtarget || '');
    if (targetSystem) maps.targetSystems.set(targetSystem, String(target?.systemName || targetSystem));
    if (subtarget || targetSystem) maps.subtargets.set(subtarget, String(target?.subtargetLabel || target?.subtargetName || subtarget || 'Default'));
    const profiles = (target?.profiles || []).filter((profile) => profile?.selectable !== false);
    if (!profiles.length) maps.profiles.set('', 'Default profile');
    for (const profile of profiles) {
      const profileId = String(profile?.id || '');
      maps.profiles.set(profileId, String(profile?.name || profileId || 'Default profile'));
    }
  }
  return maps;
}

function probeV3MenuOptionState(option) {
  if (!option) return 'n';
  const raw = menuValues.get(option.symbol) ?? simpleKconfigDefault(option);
  return option.type === 'bool' || option.type === 'tristate'
    ? CATALOG_ENGINE.normalizeKconfigStateValue(option, raw) : raw;
}
function probeV3PackageConfigFromText(text) {
  const rows = new Map();
  for (const line of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(/^CONFIG_PACKAGE_([A-Za-z0-9][A-Za-z0-9+_.@-]{0,95})=([my])$/);
    if (match) rows.set(match[1], `CONFIG_PACKAGE_${match[1]}=${match[2]}`);
  }
  return [...rows.values()].join('\n') + (rows.size ? '\n' : '');
}
function probeV3PackageStateMap(text) {
  const states = new Map();
  for (const line of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(/^CONFIG_PACKAGE_([A-Za-z0-9][A-Za-z0-9+_.@-]{0,95})=([my])$/);
    if (match) states.set(match[1], match[2]);
  }
  return states;
}
function probeV3RequestPackageConfigs(packageIntent) {
  const intentConfig = (stateKey) => packageIntent
    .filter((row) => ['m', 'y'].includes(row[stateKey]))
    .map((row) => `CONFIG_PACKAGE_${row.package}=${row[stateKey]}`)
    .join('\n') + (packageIntent.some((row) => ['m', 'y'].includes(row[stateKey])) ? '\n' : '');
  return {
    baselinePackageConfig: intentConfig('before'),
    packageConfig: intentConfig('after'),
  };
}
function probeV3EnabledIntent(request) {
  return (request?.packageIntent || []).filter((row) => row && ['m', 'y'].includes(row.after));
}
async function probeV3GzipBase64Url(text) {
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
async function probeV3StateToken(request) {
  return `WEIG_PACKAGE_PROBE_STATE_V3:${await probeV3GzipBase64Url(JSON.stringify(request))}`;
}
function probeV3IssueTitle(request) {
  const roots = probeV3EnabledIntent(request).map((row) => String(row.package || '')).filter(Boolean);
  const fallbackPackages = request.packageConfig.trim().split('\n').filter(Boolean)
    .map((line) => line.slice('CONFIG_PACKAGE_'.length, line.lastIndexOf('=')));
  const packages = roots.length ? roots : fallbackPackages;
  const channel = String(request.channel || 'main');
  const prefix = channel === 'main' ? '' : `${channel}-`;
  const titlePackages = packages.length
    ? [`${prefix}${packages[0]}`, ...packages.slice(1, 3)].join(', ') +
      (packages.length > 3 ? ` +${packages.length - 3}` : '')
    : `${prefix}menuconfig`;
  return `[probe] ${titlePackages} · ${request.mode}`.slice(0, 200);
}
function probeV3IssueUrl(request, token) {
  const params = new URLSearchParams({
    template: 'package-probe.yml', title: probeV3IssueTitle(request), state: token,
  });
  return `https://github.com/${PROJECT.catalogRepository}/issues/new?${params}`;
}

function probeV3FilterRequest(filters) {
  const values = (set) => set.has('*') ? ['*'] : [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return {
    sources: values(filters.sources),
    branches: values(filters.branches),
    targetSystems: values(filters.targetSystems),
    subtargets: values(filters.subtargets),
    profiles: values(filters.profiles),
  };
}
function probeV3IntentRows(intent) {
  return [...intent.values()].sort((a, b) => a.package.localeCompare(b.package));
}
