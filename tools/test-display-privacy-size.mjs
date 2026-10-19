#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { gunzipSync } from 'node:zlib';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const read = (relative) => readFileSync(join(root, relative), 'utf8');

/* The display boundary is deliberately tested independently from the DOM. It
 * must mask only user-facing text in Chinese while leaving technical values
 * available to search, Kconfig evaluation, and export code. */
const i18nSource = read('site/wrt/lib/i18n/i18n.js');
const context = { state: { lang: 'zh-CN' }, console };
vm.runInNewContext(`${i18nSource}\nglobalThis.__display = { displayText, displayConfigSymbol };`, context);
const { displayText, displayConfigSymbol } = context.__display;
const sensitive = 'luci-app-passwall_INCLUDE_V2ray_Geodata 代理';
assert.match(displayText(sensitive), /luci-app-pa\*+l_INCLUDE_V2\*+y_Geodata 魔法/,
  'Chinese display text must reuse the existing masking policy');
assert.doesNotMatch(displayText(sensitive), /passwall|代理/i,
  'Chinese display text must not expose sensitive terms');
assert.equal(displayConfigSymbol('PACKAGE_passwall'), 'CONFIG_PACKAGE_pa****l',
  'configuration-symbol display must apply the same masking boundary');
context.state.lang = 'en';
assert.equal(displayText(sensitive), sensitive,
  'non-Chinese display text must remain unchanged');
assert.equal(displayConfigSymbol('PACKAGE_passwall'), 'CONFIG_PACKAGE_passwall',
  'technical symbols must be readable in non-Chinese locales');

const moduleSources = {
  'site/wrt/lib/plugins/plugin-controller.js': read('site/wrt/lib/plugins/plugin-controller.js'),
  'site/wrt/lib/catalog/catalog-controller.js': read('site/wrt/lib/catalog/catalog-controller.js'),
  'site/wrt/lib/menuconfig/menuconfig-renderer.js': read('site/wrt/lib/menuconfig/menuconfig-renderer.js'),
  'site/wrt/lib/menuconfig/compatibility-controller.js': read('site/wrt/lib/menuconfig/compatibility-controller.js'),
  'site/wrt/lib/diagnostics/package-probe-controller.js': read('site/wrt/lib/diagnostics/package-probe-controller.js'),
  'site/wrt/lib/package-probe-v3-ui.js': read('site/wrt/lib/package-probe-v3-ui.js'),
};
for (const [path, source] of Object.entries(moduleSources)) {
  assert.match(source, /displayText\(/, `${path} must use the shared display boundary`);
}
assert.match(moduleSources['site/wrt/lib/menuconfig/menuconfig-renderer.js'], /displayConfigSymbol\(/,
  'menuconfig technical labels must use the shared symbol display boundary');
assert.match(moduleSources['site/wrt/lib/diagnostics/package-probe-controller.js'], /displayConfigSymbol\(/,
  'legacy probe technical labels must use the shared symbol display boundary');
assert.match(moduleSources['site/wrt/lib/package-probe-v3-ui.js'], /displayConfigSymbol\(/,
  'Probe V3 technical labels must use the shared symbol display boundary');

/* Raw symbols stay available in machine-facing paths. These assertions guard
 * against accidentally masking the search index or request payload. */
assert.match(moduleSources['site/wrt/lib/catalog/catalog-controller.js'], /menuSearchText\.set\(option\.symbol,/,
  'catalog search must retain raw symbols');
assert.match(moduleSources['site/wrt/lib/diagnostics/package-probe-controller.js'], /rows\.set\(match\[1\], `CONFIG_PACKAGE_\$\{match\[1\]\}=\$\{match\[2\]\}`\)/,
  'probe config parsing must retain raw CONFIG values');
assert.match(moduleSources['site/wrt/lib/package-probe-v3-ui.js'], /JSON\.stringify\(request, null, 2\)/,
  'Probe request preview must retain the machine-facing request contract');

const pluginController = moduleSources['site/wrt/lib/plugins/plugin-controller.js'];
const extract = (source, name) => source.match(new RegExp(`(function ${name}\\([^]*?\\n\\})`))?.[1];
const stateSource = read('site/wrt/lib/menuconfig/menuconfig-state.js');
const catalogSource = moduleSources['site/wrt/lib/catalog/catalog-controller.js'];
const advisoryContext = {
  state: { device: { id: 'catalog-target' } },
  ACTIVE_PROFILE_BASELINE: { values: new Map([['PACKAGE_builtin', 'y']]) },
  PROJECT: { customization: { ui: { applicationCountAdvisory: { warningAbove: 6, dangerAbove: 10 } } } },
  PLUGINS: { plugins: [] }, catalogUserOverrides: new Map(), menuImportedOriginal: new Map(),
  catalogEngineValues: () => advisoryValues,
  curatedMenuOption: (plugin) => ({ symbol: `PACKAGE_${plugin.id}` }),
  catalogPackageRecordForSymbol: (symbol) => ({ package: symbol.slice('PACKAGE_'.length) }),
};
const advisoryValues = new Map();
vm.createContext(advisoryContext);
vm.runInContext(extract(pluginController, 'applicationCountAdvisory'), advisoryContext);
for (const [count, level] of [[0, ''], [6, ''], [7, 'warning'], [10, 'warning'], [11, 'danger']]) {
  advisoryContext.PLUGINS.plugins = Array.from({ length: count }, (_, n) => ({ id: `app${n}` }));
  for (const plugin of advisoryContext.PLUGINS.plugins) {
    advisoryValues.set(`PACKAGE_${plugin.id}`, 'y');
    advisoryContext.menuImportedOriginal.set(`PACKAGE_${plugin.id}`, 'y');
  }
  const before = JSON.stringify([...advisoryValues]);
  const report = advisoryContext.applicationCountAdvisory();
  assert.equal(report.count, count); assert.equal(report.level, level);
  assert.equal(JSON.stringify([...advisoryValues]), before, 'advisories must never mutate config');
}
for (const [name, value] of [['builtin', 'y'], ['automatic', 'y'], ['module', 'm'], ['disabled', 'n']]) {
  advisoryContext.PLUGINS.plugins.push({ id: name }); advisoryValues.set(`PACKAGE_${name}`, value);
}
advisoryContext.menuImportedOriginal.set('PACKAGE_builtin', 'y');
advisoryContext.menuImportedOriginal.set('PACKAGE_module', 'm');
advisoryContext.menuImportedOriginal.set('PACKAGE_disabled', 'y');
advisoryContext.catalogUserOverrides.set('PACKAGE_disabled', 'n');
advisoryContext.catalogUserOverrides.set('PACKAGE_app0', null);
advisoryContext.PLUGINS.plugins.push({ id: 'app0' });
assert.equal(advisoryContext.applicationCountAdvisory().count, 11,
  'deduplicate concrete imports, inherit null override, exclude baseline/M/N/automatic dependencies');
advisoryContext.ACTIVE_PROFILE_BASELINE = null;
assert.equal(advisoryContext.applicationCountAdvisory(), null, 'no guess without Native baseline');
// Imported and inherited Y/M applications remain visible without inventing
// direct user overrides. N is excluded; module packages still do not add size.
const enabledContext = { state: { device: { id: 'catalog-target' } }, MENU_CATALOG: {},
  PLUGINS: { plugins: [{ id: 'imported' }, { id: 'baseline' }, { id: 'module' }, { id: 'disabled' }] },
  catalogEngineValues: () => new Map([['imported', 'y'], ['baseline', 'y'], ['module', 'm'], ['disabled', 'n']]),
  curatedMenuOption: p => ({ symbol: p.id }), effectiveSelection: () => ({ all: [] }),
};
vm.createContext(enabledContext);
vm.runInContext(extract(pluginController, 'effectiveEnabledPlugins'), enabledContext);
assert.deepEqual([...enabledContext.effectiveEnabledPlugins()].map(p => p.id), ['imported', 'baseline', 'module']);
assert.match(pluginController, /updateStats\(\);\s*\/\/ Restoring intent[\s\S]*?openSelectedDrawer\(\);/,
  'restoring a default-Y selection must redraw, not remove a still-enabled plugin');

const sourceJson = JSON.parse(read('tools/i18n-source.json'));
const chineseTranslation = JSON.parse(read('tools/i18n-translations/zh-CN.json'));
for (const key of ['bar.selectionSummary', 'drawer.effective', 'drawer.edit', 'lang.search', 'mode.self.steps']) {
  assert.equal(typeof sourceJson.strings?.[key], 'string', `${key} must exist in the English source catalog`);
  assert.equal(typeof chineseTranslation[key], 'string', `${key} must exist in the Chinese translation catalog`);
}
const manifest = JSON.parse(read('site/wrt/data/i18n/index.json'));
assert.equal(manifest.languages.length, 49);
assert.equal(manifest.version, 3);
assert.equal(manifest.languages.filter((language) => language.pending).length, 0);
assert.equal(manifest.languages.filter((language) => language.common).length, 11);
const readBundle = id => JSON.parse(gunzipSync(readFileSync(join(root, `site/wrt/data/i18n/${id}.json.gz`))).toString('utf8'));
for (const language of manifest.languages) {
  const document = readBundle(language.id);
  assert.equal(Object.keys(document.strings).length, Object.keys(sourceJson.strings).length);
  assert(!Object.keys(document.strings).some((key) => key.startsWith('size.summary.')));
}
for (const source of [pluginController, catalogSource, read('site/wrt/lib/config/config-importer.js')]) {
  assert.doesNotMatch(source, /ensureCatalogPackageSizes|packageSizeEstimate|catalogObservedPackageSizes/,
    'retired package sizing must have no active caller');
}
for (const [browserLanguage, expected] of [
  ...manifest.languages.map(locale => [locale.id, locale.id]),
  ['en-US', 'en'], ['xx-ZZ', 'en'], ['zh-HK', 'zh-TW'], ['zh-Hant-MO', 'zh-TW'],
  ['zh-Hans-SG', 'zh-CN'], ['no-NO', 'nb-NO'], ['iw-IL', 'he'], ['pt-br', 'pt-BR'],
]) {
  const requests = [];
  const localization = {
    state: { lang: '' }, navigator: { languages: [browserLanguage] }, FALLBACK: 'en', SOURCE_LANG: 'en',
    I18N: null, console,
    loadJson: async (path) => {
      requests.push(path);
      if (path === 'i18n/index.json') return manifest;
      const id = path.match(/i18n\/(.+)\.json\.gz$/)[1];
      return readBundle(id);
    },
  };
  vm.createContext(localization);
  vm.runInContext(i18nSource, localization);
  await localization.initializeI18n();
  assert.deepEqual(requests, ['i18n/index.json', `i18n/${expected}.json.gz`],
    'startup must load exactly one effective language bundle');
  assert.equal(localization.state.lang, expected);
}
console.log('display privacy, size retirement, count advice and locale loading: ok');
