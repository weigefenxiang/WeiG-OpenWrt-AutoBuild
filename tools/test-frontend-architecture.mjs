#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frontendRuntimeFiles } from './lib/frontend-source.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WRT = join(ROOT, 'site', 'wrt');
const appPath = join(WRT, 'app.js');
const controllerPath = join(WRT, 'lib', 'core', 'application-controller.js');
const htmlPath = join(WRT, 'index.html');
const app = readFileSync(appPath, 'utf8');
const controller = readFileSync(controllerPath, 'utf8');
const html = readFileSync(htmlPath, 'utf8');
const runtimeFiles = frontendRuntimeFiles(ROOT);
const moduleNames = runtimeFiles.slice(1).map((path) => relative(WRT, path).replaceAll('\\', '/'));
const filesUnder = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? filesUnder(path) : entry.isFile() && path.endsWith('.js') ? [path] : [];
});
const frontendJsFiles = [appPath, ...filesUnder(join(WRT, 'lib'))];
const frontendJs = frontendJsFiles.map((path) => readFileSync(path, 'utf8')).join('\n');

const expectedModules = [
  'lib/core/runtime.js',
  'lib/i18n/i18n.js',
  'lib/core/data-loader.js',
  'lib/ui/ui-runtime.js',
  'lib/core/application-controller.js',
  'lib/catalog/catalog-controller.js',
  'lib/menuconfig/menuconfig-state.js',
  'lib/menuconfig/compatibility-controller.js',
  'lib/menuconfig/menuconfig-renderer.js',
  'lib/plugins/workspace-controller.js',
  'lib/plugins/plugin-controller.js',
  'lib/config/config-state.js',
  'lib/config/config-generator.js',
  'lib/config/config-importer.js',
  'lib/build/build-controller.js',
  'lib/diagnostics/package-probe-controller.js',
  'lib/diagnostics/self-test.js',
  'lib/core/bootstrap.js',
];

assert.deepEqual(moduleNames, expectedModules, 'frontend module order is a public runtime contract');
assert.equal(new Set(moduleNames).size, moduleNames.length, 'frontend module declarations must be unique');
assert.ok(runtimeFiles.every(existsSync), 'every declared frontend module must exist');
assert.ok(app.split(/\r?\n/).length <= 120, 'app.js must remain a thin module orchestrator');
assert.ok(controller.split(/\r?\n/).length <= 300, 'application controller must remain coordination-only');

const businessNames = [
  'applyCatalogIntent', 'parseConfigEntries', 'openSubmitModal', 'renderPlugin',
  'renderMenuconfig', 'runSelfTest', 'generateConfig', 'importConfig',
];
for (const name of businessNames) {
  assert.doesNotMatch(app, new RegExp(`\\b${name}\\b`), `app.js must not own ${name}`);
  assert.doesNotMatch(html, new RegExp(`\\b${name}\\b`), `index.html must not own ${name}`);
  assert.doesNotMatch(controller, new RegExp(`function\\s+${name}\\b`),
    `application controller must not own ${name}`);
}

const owners = new Map([
  ['lib/catalog/catalog-controller.js', ['function showCatalogStatus', 'async function loadCatalog']],
  ['lib/menuconfig/menuconfig-state.js', ['function applyCatalogIntent']],
  ['lib/menuconfig/compatibility-controller.js', ['function openCompatibilityWarningModal']],
  ['lib/menuconfig/menuconfig-renderer.js', ['function renderMenuconfig']],
  ['lib/plugins/plugin-controller.js', ['function renderPlugin']],
  ['lib/config/config-state.js', ['function parseConfigEntries']],
  ['lib/config/config-generator.js', ['function generateConfig']],
  ['lib/config/config-importer.js', ['async function importConfig']],
  ['lib/build/build-controller.js', ['function openSubmitModal']],
  ['lib/diagnostics/self-test.js', ['async function runSelfTest']],
]);
for (const [moduleName, markers] of owners) {
  const source = readFileSync(join(WRT, ...moduleName.split('/')), 'utf8');
  for (const marker of markers) assert.ok(source.includes(marker), `${moduleName} must own ${marker}`);
}

assert.doesNotMatch(frontendJs, /\buiText\s*\(/, 'visible text must use the shared i18n runtime');
assert.doesNotMatch(frontendJs,
  /\b(?:MENU_UI_I18N|MENU_FILTER_I18N|TARGET_FIELD_I18N|PROBE_UI_TEXT|PROBE_V3_UI_TEXT)\b/,
  'feature-local translation tables must not return');
assert.match(readFileSync(join(WRT, 'lib', 'i18n', 'i18n.js'), 'utf8'),
  /i18n\/index\.json/,
  'i18n runtime must discover language files from the generated manifest');

for (const path of frontendJsFiles) {
  const source = readFileSync(path, 'utf8');
  for (const match of source.matchAll(/\b(?:textContent|placeholder)\s*=\s*(['"])(.*?)\1/g)) {
    const literal = match[2];
    assert.ok(!/\p{L}/u.test(literal) || literal === 'D',
      `${relative(ROOT, path)} contains untranslated visible literal: ${literal}`);
  }
  assert.doesNotMatch(source, /\b(?:showToast|openModal|alert|confirm)\s*\(\s*['"`]/,
    `${relative(ROOT, path)} must localize popup and toast text`);
}

console.log('frontend architecture and localization boundaries passed');
