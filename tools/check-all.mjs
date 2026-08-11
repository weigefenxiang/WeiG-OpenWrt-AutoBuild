#!/usr/bin/env node
// One maintainable project gate: executable regressions plus generic data/architecture contracts.
// Historical device, seed, plugin-name, and per-error fixtures intentionally do not live here.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  'test-site-release.mjs',
  'test-theme-bootstrap.mjs',
  'test-build-identity.mjs',
  'test-build-admission.mjs',
  'test-preview-server.mjs',
  'test-build-request-identity.mjs',
  'test-request-audit.mjs',
  'test-build-diagnostics.mjs',
  'test-catalog-loader.mjs',
  'test-catalog-engine.mjs',
  'test-catalog-ui-contract.mjs',
  'test-catalog-performance.mjs',
  'test-menuconfig-scalar.mjs',
  'test-kconfig-serializer.mjs',
  'test-package-mirror.mjs',
];
for (const name of regressionTests) run(name, process.execPath, [join(ROOT, 'tools', name)]);

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
  'site/wrt/data/i18n.json',
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

const i18n = parsed.get('site/wrt/data/i18n.json');
if (i18n?.languages?.length === 11 && Object.values(i18n.strings || {}).every((row) =>
  i18n.languages.every((language) => String(row[language.id] || '').length))) {
  pass(`${Object.keys(i18n.strings).length} UI strings are complete in 11 languages`);
} else fail('i18n completeness');

const timezones = parsed.get('site/wrt/data/timezones.json')?.zones || [];
if (timezones.length >= 400 && new Set(timezones.map((row) => row.zonename)).size === timezones.length &&
    timezones.some((row) => row.zonename === 'Asia/Shanghai' && row.timezone === 'CST-8')) pass(`${timezones.length} timezone mappings are unique`);
else fail('timezone mapping contract');

console.log('[3/4] Catalog-only architecture / Catalog-only 架构');
const app = readFileSync(join(ROOT, 'site', 'wrt', 'app.js'), 'utf8');
const html = readFileSync(join(ROOT, 'site', 'wrt', 'index.html'), 'utf8');
const loader = readFileSync(join(ROOT, 'site', 'wrt', 'lib', 'catalog-loader.js'), 'utf8');
const engine = readFileSync(join(ROOT, 'site', 'wrt', 'lib', 'catalog-engine.js'), 'utf8');
const parser = readFileSync(join(ROOT, 'tools', 'parse-request.mjs'), 'utf8');
const requestAudit = readFileSync(join(ROOT, 'tools', 'request-audit.mjs'), 'utf8');
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
  parser.includes('Catalog Source 缺少有效构建工具') && parser.includes('schema 5 only accepts a Catalog target') &&
  !parser.includes('devices.json') && !parser.includes('config-manifest.json');
if (catalogOnly) pass('Source/Branch/build tools, Kconfig, applications and schema-2 compatibility are Catalog-driven');
else fail('Catalog-only execution contract');

if (html.includes('id="modalProbe"') && html.includes('<button type="button" class="modal-probe-link"') &&
    app.includes('function openPackageProbeModal()') && app.includes('WEIG_PACKAGE_PROBE_REQUEST_V1') &&
    app.includes('probeUiText') && app.includes("'boot-smoke'") && app.includes('const depthOptions = [') &&
    app.includes("packageName.startsWith('luci-app-') ? 1 : 2") && app.includes('scopeSelect.value') &&
    app.includes('targetSelect.value') && app.includes('preview.hidden = true') &&
    app.includes("packages: [...selected.keys()]") && !app.includes('probe.href =')) {
  pass('in-page package probe has generic ranked choices, compact controls and a validated request');
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
