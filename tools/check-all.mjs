#!/usr/bin/env node
// One maintainable project gate: executable regressions plus generic data/architecture contracts.
// Historical device, seed, plugin-name, and per-error fixtures intentionally do not live here.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFrontendRuntimeSource } from './lib/frontend-source.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const pass = (message) => console.log(`  ✓ ${message}`);
const fail = (message, detail = '') => {
  failures++;
  console.error(`  ✗ ${message}${detail ? ` — ${detail}` : ''}`);
};

function filesUnder(directory, predicate = () => true, output = []) {
  if (!existsSync(directory)) return output;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) filesUnder(path, predicate, output);
    else if (entry.isFile() && predicate(path)) output.push(path);
  }
  return output;
}

function run(label, command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', shell: false });
  if (result.status === 0) {
    pass(label);
    return true;
  }
  fail(label, String(result.stderr || result.stdout || result.error?.message || `exit ${result.status}`)
    .trim().replace(/\s+/g, ' ').slice(0, 500));
  return false;
}

function parseJson(path) {
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'));
    pass(`JSON ${relative(ROOT, path)}`);
    return value;
  } catch (error) {
    fail(`JSON ${relative(ROOT, path)}`, error.message);
    return null;
  }
}

function workflowRunNameIssues(source) {
  const issues = [];
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const match = line.match(/^run-name:\s*(.*)$/);
    if (!match) continue;
    const value = match[1].trim();
    if (!value || value.startsWith('"') || value.startsWith("'")) continue;
    if (/(^|\s)#/.test(value)) issues.push(`line ${index + 1}: unquoted #`);
    if ((value.match(/\$\{\{/g) || []).length !== (value.match(/\}\}/g) || []).length) {
      issues.push(`line ${index + 1}: unbalanced expression`);
    }
  }
  return issues;
}

console.log('[1/4] Syntax and executable regressions / 语法与运行回归');
const scripts = [
  ...filesUnder(join(ROOT, 'site', 'wrt'), (path) => path.endsWith('.js')),
  ...filesUnder(join(ROOT, 'tools'), (path) => path.endsWith('.mjs') && !path.endsWith('check-all.mjs')),
];
for (const path of scripts) run(`syntax ${relative(ROOT, path)}`, process.execPath, ['--check', path]);

const regressionTests = [
  'check-public-terminology.mjs',
  'test-frontend-architecture.mjs',
  'test-site-release.mjs',
  'test-theme-bootstrap.mjs',
  'test-ui-modules.mjs',
  'test-build-identity.mjs',
  'test-build-admission.mjs',
  'test-preview-server.mjs',
  'test-build-request-identity.mjs',
  'test-request-audit.mjs',
  'test-build-diagnostics.mjs',
  'test-catalog-loader.mjs',
  'test-catalog-engine.mjs',
  'test-compatibility-recommendation.mjs',
  'test-catalog-ui-contract.mjs',
  'test-package-probe-v3.mjs',
  'test-catalog-core-loader.mjs',
  'test-catalog-performance.mjs',
  'test-menuconfig-scalar.mjs',
  'test-kconfig-serializer.mjs',
  'test-profile-baseline.mjs',
  'test-package-mirror.mjs',
  'test-artifact-publish.mjs',
];
for (const name of regressionTests) run(name, process.execPath, [join(ROOT, 'tools', name)]);
run('version behavior policy', process.execPath, [join(ROOT, 'tools', 'stamp-site-version.mjs'), '--self-test']);

const license = readFileSync(join(ROOT, 'LICENSE'), 'utf8');
const notice = readFileSync(join(ROOT, 'NOTICE'), 'utf8');
const reuse = readFileSync(join(ROOT, 'REUSE.toml'), 'utf8');
const licenseZh = readFileSync(join(ROOT, 'LICENSE.zh-CN.md'), 'utf8');
if (license.includes('GNU GENERAL PUBLIC LICENSE') && license.includes('Version 3, 29 June 2007') &&
    license.includes('END OF TERMS AND CONDITIONS') && notice.includes('GPL-3.0-or-later') &&
    notice.includes('weigefenxiang@gmail.com') &&
    reuse.includes('SPDX-License-Identifier = "GPL-3.0-or-later"') &&
    licenseZh.includes('非官方中文说明') && licenseZh.includes('LICENSE')) {
  pass('GPL-3.0-or-later, public contact, REUSE metadata, and Chinese reference are consistent');
} else fail('project license contract');

console.log('[2/4] Canonical local data / 本地权威数据');
const dataFiles = [
  'site/wrt/data/i18n/index.json',
  'site/wrt/data/i18n/zh-CN.json',
  'site/wrt/data/i18n/zh-TW.json',
  'site/wrt/data/i18n/en.json',
  'site/wrt/data/i18n/ru.json',
  'site/wrt/data/i18n/es.json',
  'site/wrt/data/i18n/pt.json',
  'site/wrt/data/i18n/ja.json',
  'site/wrt/data/i18n/ko.json',
  'site/wrt/data/i18n/de.json',
  'site/wrt/data/i18n/fr.json',
  'site/wrt/data/i18n/vi.json',
  'site/wrt/data/package-mirrors.json',
  'site/wrt/data/project.json',
  'site/wrt/data/site-version.json',
  'site/wrt/data/timezones.json',
  'config/policies/package-mirrors.json',
  '.github/automation-policy.json',
  'tools/i18n-source.json',
  'tools/i18n-translations.json',
];
const parsed = new Map(dataFiles.map((name) => [name, parseJson(join(ROOT, name))]));
const expectedDataFiles = new Set(dataFiles.filter((name) => name.startsWith('site/wrt/data/'))
  .map((name) => name.slice('site/wrt/data/'.length)));
const actualDataFiles = filesUnder(join(ROOT, 'site', 'wrt', 'data'))
  .map((path) => relative(join(ROOT, 'site', 'wrt', 'data'), path).replaceAll('\\', '/'));
const generatedDataFiles = new Set(['build-meta.json']);
const unexpectedData = actualDataFiles.filter((name) =>
  !expectedDataFiles.has(name) && !generatedDataFiles.has(name));
const missingData = [...expectedDataFiles].filter((name) => !actualDataFiles.includes(name));
if (!unexpectedData.length && !missingData.length) {
  pass('public data contains canonical runtime data plus optional generated deployment identity');
} else {
  fail('public data allowlist',
    `unexpected=${unexpectedData.join(',') || '(none)'} missing=${missingData.join(',') || '(none)'}`);
}

const configEntries = filesUnder(join(ROOT, 'config')).map((path) => relative(ROOT, path).replaceAll('\\', '/'));
if (configEntries.length === 1 && configEntries[0] === 'config/policies/package-mirrors.json') {
  pass('AutoBuild has one small runtime policy and no device/seed config database');
} else fail('config allowlist', configEntries.join(','));

run('package mirror public projection matches its canonical policy', process.execPath,
  [join(ROOT, 'tools', 'gen-package-mirrors.mjs'), '--check']);

const i18n = parsed.get('site/wrt/data/i18n/index.json');
const i18nDocuments = (i18n?.languages || []).map((language) =>
  parsed.get(`site/wrt/data/i18n/${language.id}.json`));
const i18nKeys = Object.keys(i18nDocuments[0]?.strings || {});
if (i18n?.version === 2 && i18n.languages?.length === 11 && i18nDocuments.every((document) =>
  document?.version === 2 && i18n.languages.some((language) => language.id === document.language) &&
  Object.keys(document.strings || {}).length === i18nKeys.length &&
  i18nKeys.every((key) => String(document.strings[key] || '').length))) {
  pass(`${i18nKeys.length} UI strings are complete in 11 language files`);
} else fail('i18n completeness');

const timezones = parsed.get('site/wrt/data/timezones.json')?.zones || [];
if (timezones.length >= 400 && new Set(timezones.map((row) => row.zonename)).size === timezones.length &&
    timezones.some((row) => row.zonename === 'Asia/Shanghai' && row.timezone === 'CST-8')) pass(`${timezones.length} timezone mappings are unique`);
else fail('timezone mapping contract');

console.log('[3/4] Catalog-only architecture / Catalog-only 架构');
const app = readFrontendRuntimeSource(ROOT);
const html = readFileSync(join(ROOT, 'site', 'wrt', 'index.html'), 'utf8');
const loader = readFileSync(join(ROOT, 'site', 'wrt', 'lib', 'catalog-loader.js'), 'utf8');
const engine = readFileSync(join(ROOT, 'site', 'wrt', 'lib', 'catalog-engine.js'), 'utf8');
const profileBaseline = readFileSync(join(ROOT, 'site', 'wrt', 'lib', 'profile-baseline.js'), 'utf8');
const parser = readFileSync(join(ROOT, 'tools', 'parse-request.mjs'), 'utf8');
const requestAudit = readFileSync(join(ROOT, 'tools', 'request-audit.mjs'), 'utf8');
const customBuildWorkflow = readFileSync(join(ROOT, '.github', 'workflows', 'custom-build.yml'), 'utf8');
const project = parsed.get('site/wrt/data/project.json');
const automationPolicy = parsed.get('.github/automation-policy.json');
const architecture = readFileSync(join(ROOT, 'ARCHITECTURE.md'), 'utf8');
const developerZh = readFileSync(join(ROOT, 'docs', 'DEVELOPER.md'), 'utf8');
const developerEn = readFileSync(join(ROOT, 'docs', 'DEVELOPER.en.md'), 'utf8');

const removedNames = [
  'devices.json', 'config-manifest.json', 'minimum-boot.json', 'source-build-requirements.json',
  'menuconfig-index.json', 'plugins-meta.json', 'plugin-sizes.json', 'gen-seed-configs.mjs',
  'gen-plugins.mjs', 'sync-upstream.yml', 'packages.html', 'recommended-audit.json',
];
const trackedText = [app, html, parser, requestAudit, architecture, developerZh, developerEn].join('\n');
const staleNames = removedNames.filter((name) => trackedText.includes(name));
if (!staleNames.length) pass('removed device/seed/recommended assets have no live code or primary-doc references');
else fail('zombie references', staleNames.join(','));

const forbiddenConcretePackages = ['openvpn', 'oscam', 'dnsmasq'];
const concreteInApp = forbiddenConcretePackages.filter((name) => app.toLowerCase().includes(name));
if (!concreteInApp.length && !/["'`]PACKAGE_[A-Za-z0-9_.+@-]+["'`]/.test(engine)) {
  pass('browser and Catalog engine contain no rule-specific package names or literal package symbols');
} else fail('rule-specific frontend code', concreteInApp.join(','));

const catalogOnly =
  loader.includes('fetchApplications') && loader.includes('applications.json.gz') &&
  loader.includes('data.probeUi?.schema') && loader.includes("typeof row['zh-CN'] !== 'string'") &&
  loader.includes('Number(contract.schema) !== 2') && loader.includes('Number(data.schema) !== 2') &&
  engine.includes('compatibility document requires schema 2') && engine.includes('compatibilityPatternMatches') &&
  app.includes('ensureCatalogApplications') && app.includes('CATALOG_ENGINE.evaluateCompatibilityRules') &&
  app.includes('CATALOG_ENGINE.deriveCompatibilityPlans') && app.includes('CATALOG_ENGINE.applyUserIntent') &&
  parser.includes('Catalog Source 缺少有效构建工具') && parser.includes('schema 6 only accepts a Catalog target') &&
  parser.includes('createProfileBaselineStore') && parser.includes('applyProfileOverrides') &&
  parser.includes('loadCatalogKconfigSymbols') && parser.includes('createCatalogModel') &&
  parser.includes('allowedSymbols: catalogKconfigSymbols') &&
  profileBaseline.includes('branch-common-plus-exact-config-groups-v1') &&
  profileBaseline.includes('allowedSymbols instanceof Set') &&
  !parser.includes(['submitted', 'config'].join('.')) &&
  !parser.includes('devices.json') && !parser.includes('config-manifest.json');
if (catalogOnly) pass('Source/Branch/build tools, Kconfig, applications and schema-2 compatibility are Catalog-driven');
else fail('Catalog-only execution contract');

const minimalSchema6Target =
  app.includes('function schema6TargetIdentity(target = state.device?.target) {') &&
  app.includes('payload.customTarget = schema6TargetIdentity();') &&
  !app.includes('payload.customTarget = state.device.target') &&
  parser.includes("const CUSTOM_TARGET_FIELDS = Object.freeze(['profileSelector', 'profileSymbol', 'subtarget', 'system']);") &&
  parser.includes('customTarget 只接受最小 Target/Profile 身份字段') &&
  !parser.includes('targetContract.arch') && !parser.includes('targetContract.archPackages') &&
  !parser.includes('targetContract.profilePackagesAdd') &&
  !parser.includes('catalog_arch=') && !parser.includes('catalog_arch_packages=') &&
  !parser.includes('catalog_profile_packages=') &&
  !customBuildWorkflow.includes('steps.req.outputs.catalog_arch') &&
  !customBuildWorkflow.includes('steps.req.outputs.catalog_arch_packages') &&
  !customBuildWorkflow.includes('steps.req.outputs.catalog_profile_packages');
if (minimalSchema6Target) pass('schema6 carries only immutable Target/Profile identity; derived Catalog metadata stays out of the request and Worker outputs');
else fail('schema6 minimal Target/Profile identity contract');

if (html.includes('id="modalProbe"') && html.includes('<button type="button" class="modal-probe-link"') &&
    app.includes('function openPackageProbeModal()') && app.includes("template: 'package-probe.yml'") &&
    !app.includes('probe-request.json') && app.includes('WEIG_PACKAGE_PROBE_STATE_V2:') &&
    app.includes('probeUiText') && app.includes("'boot-smoke'") && app.includes('const depthOptions = [') &&
    app.includes('function rankMenuSearchOptions(options, query)') &&
    app.includes('function searchMenuOptionsSync(query)') &&
    !app.includes('function resolvePackageSelectionOption(option)') &&
    !app.includes('resolvePackageSelectionOption(option)') &&
    app.includes('applyMenuValue(option, value, false)') &&
    app.includes('function probePackageBaselineState(option)') &&
    app.includes('function changedProbePackageOptions()') &&
    app.includes("helpButton.textContent = probeUiText('help')") &&
    !app.includes("policy.className = 'probe-policy'") &&
    !app.includes('const selected = new Map()') && !app.includes('probeBaseState') &&
    !app.includes('probeActiveSymbols') && app.includes('setMenuValue(option, nextValue)') &&
    app.includes('const selectable = choice.isPackage') &&
    app.includes("row.classList.toggle('is-reference', !selectable)") &&
    !app.includes('function normalizeProbeSearch(') && !app.includes('function probeChoiceMatches(') &&
    app.includes('scopeSelect.value') && app.includes('targetSelect.value') && app.includes('preview.hidden = true') &&
    app.includes('packageConfig: probePackageConfigFromText(resolvedConfig)') &&
    app.includes("customScope = document.createElement('details')") && !app.includes('probe.href =') &&
    !app.includes('probeCopyText') && !app.includes('copyButton')) {
  pass('in-page package probe shares Advanced menuconfig state and opens the dedicated Catalog Issue form');
} else fail('in-page package probe contract');

if (app.includes("label: 'Root Kconfig options', uiKey: 'rootOptions', usageUiKey: 'rootOptionsHelp'") &&
    !app.includes("label: 'General settings', usage: 'Root configuration options'")) {
  pass('parentless Catalog options remain reachable under an explicit root Kconfig label');
} else fail('root Kconfig menu contract');

const loadPolicy = project?.catalogLoadPolicy;
if (loadPolicy?.startup?.join(',') === 'menu,menu:language,package-mirrors' &&
    loadPolicy?.idle?.join(',') === 'applications,hidden,help,compatibility' &&
    loadPolicy.startupConcurrency === 3 && loadPolicy.idleConcurrency === 1 &&
    (app.match(/'package-mirrors': ensurePackageMirrors/g) || []).length === 1 &&
    app.includes('applications: ensureCatalogApplications')) {
  pass('startup/idle Catalog download order is controlled by project.json');
} else fail('Catalog load policy');

if (!existsSync(join(ROOT, 'site', 'wrt', 'packages.html')) && !html.includes('packages.html') &&
    !existsSync(join(ROOT, '.github', 'workflows', 'sync-upstream.yml'))) {
  pass('legacy package page and weekly AutoBuild data sync are removed');
} else fail('legacy public entrypoints still exist');

if (requestAudit.includes("!['defconfig', 'compatibility'].includes(key)") &&
    !requestAudit.includes('recommended:') && !parser.includes('recommended_enabled=')) {
  pass('request audit records only Defconfig and forced compatibility evidence');
} else fail('request audit still exposes a retired recommended preset contract');

console.log('[4/4] GitHub Actions contracts / GitHub Actions 契约');
const workflowDir = join(ROOT, '.github', 'workflows');
const workflows = filesUnder(workflowDir, (path) => /\.ya?ml$/i.test(path));
const runNameIssues = workflows.flatMap((path) => workflowRunNameIssues(readFileSync(path, 'utf8'))
  .map((message) => `${relative(ROOT, path)} ${message}`));
if (!runNameIssues.length) pass('all Workflow run-name expressions preserve literal # semantics');
else fail('Workflow run-name YAML', runNameIssues.join('; '));

const buildWorkflow = readFileSync(join(workflowDir, 'custom-build.yml'), 'utf8');
const cancelWorkflow = readFileSync(join(workflowDir, 'cancel-build.yml'), 'utf8');
if (buildWorkflow.includes('python3 python3-setuptools') && !buildWorkflow.includes('python3-distutils')) {
  pass('Ubuntu 24.04 Python build dependencies are current');
} else fail('Build dependency contract', 'use python3 + python3-setuptools; python3-distutils is unavailable');
const retention = [...buildWorkflow.matchAll(/^\s*retention-days:\s*(\d+)\s*$/gm)].map((match) => Number(match[1]));
if (retention.length >= 5 && retention.filter((days) => days === 1).length === 1 &&
    retention.filter((days) => days === 60).length === retention.length - 1 &&
    !/保留\s*(?:14|30)\s*天|(?:14|30) days/i.test(buildWorkflow) &&
    automationPolicy?.buildArtifacts?.firmwareDays === 60 &&
    automationPolicy?.buildArtifacts?.configurationDays === 60 &&
    automationPolicy?.buildArtifacts?.summaryDays === 60 &&
    automationPolicy?.buildArtifacts?.buildLogsDays === 60 &&
    automationPolicy?.buildArtifacts?.internalRawBridgeDays === 1 &&
    automationPolicy?.catalogProbe?.normalizedEvidenceDays === 60 &&
    automationPolicy?.catalogProbe?.fullLogDays === 30 &&
    automationPolicy?.catalogProbe?.collaboratorMaxParallel === 3 &&
    automationPolicy?.catalogProbe?.maxMatrixJobs === 256) {
  pass('all user build artifacts retain 60 days; the internal raw bridge alone retains 1 day');
} else fail('Artifact retention contract', retention.join(','));

const namingAndConcurrency =
  buildWorkflow.includes('decideBuildAdmission') &&
  buildWorkflow.includes('repository owner; no project limit') &&
  !buildWorkflow.includes('OWNER_BUILD_CONCURRENCY') &&
  !buildWorkflow.includes('needs.admission.outputs.slot') &&
  !buildWorkflow.includes('group: custom-build-user-') &&
  buildWorkflow.includes("value.match(/#[0-9]+\\//)") &&
  cancelWorkflow.includes('const issueMarker = `#${issue.number}/`') &&
  cancelWorkflow.includes("command !== '/cancel'") &&
  !cancelWorkflow.includes('/cancel-build') &&
  cancelWorkflow.includes("['write', 'maintain', 'admin']") &&
  cancelWorkflow.includes('cancelWorkflowRun') && cancelWorkflow.includes('force-cancel') &&
  cancelWorkflow.includes('runs-on: ubuntu-24.04') &&
  parser.includes('artifactBuildRef(buildRef, sourceEnv, Number(process.env.ISSUE_NUMBER || 0))');
if (namingAndConcurrency) pass('Run/Artifact #Issue identity, unlimited owner, public limit 3 and /cancel share one issue identity');
else fail('Actions naming/concurrency/cancel contract');

const specialWorkflowPackages = ['passwall', 'openclash', 'v2ray-geoip', 'luci-app-openvpn', 'oscam'];
const workflowSpecials = specialWorkflowPackages.filter((name) => buildWorkflow.toLowerCase().includes(name));
if (!workflowSpecials.length) pass('firmware workflow has no per-plugin preflight special cases');
else fail('per-plugin workflow special cases', workflowSpecials.join(','));

const legacyPaths = ['config/001.presets', 'site/wrt/data/360t7', 'site/wrt/data/seed'];
const existingLegacy = legacyPaths.filter((name) => existsSync(join(ROOT, name)));
if (!existingLegacy.length) pass('device and seed directories are absent');
else fail('legacy directories', existingLegacy.join(','));

if (failures) {
  console.error(`\n${failures} problem(s) found / 共 ${failures} 个问题`);
  process.exit(1);
}
console.log('\nAll checks passed / 全部通过');
