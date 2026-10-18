#!/usr/bin/env node
// Isolated loader fixtures do not represent authored translations; real 50-locale
// assets/source/README coverage is checked separately by test-localization.mjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const registry = JSON.parse(read('tools/i18n-locales.json'));
const code = read('site/wrt/lib/i18n/i18n.js');
function fixture({ browser = ['en'], stored = '', failure = '', badDocument = '', badFile = '' } = {}) {
  const requests = [];
  const manifest = {
    version: 3, source: 'en', fallback: 'en', stringCount: 1,
    languages: registry.languages.map(locale => locale.fallbackTo ? { ...locale } : ({ ...locale,
      file: locale.id === badFile ? '../all.json.gz' : locale.id + '.json.gz' })),
  };
  const context = {
    state: { lang: stored }, navigator: { languages: browser, language: browser[0] },
    FALLBACK: 'en', SOURCE_LANG: 'en', I18N: null, console,
    MENU_CATALOG: null, safeSet() {},
    loadJson: async path => {
      requests.push(path);
      if (path === 'i18n/index.json') return manifest;
      const id = path.slice('i18n/'.length, -'.json.gz'.length);
      if (id === failure) throw new Error('fixture: unavailable');
      return { version: 2, language: id === badDocument ? 'wrong' : id, strings: { label: id } };
    },
  };
  vm.createContext(context); vm.runInContext(code, context);
  // Rendering is tested with real DOM separately; this fixture isolates loading/state.
  context.applyI18n = () => {};
  return { context, requests };
}
for (const locale of registry.languages) {
  const { context, requests } = fixture({ browser: [locale.id] });
  await context.initializeI18n();
  const effective = locale.fallbackTo || locale.id;
  assert.equal(context.state.lang, effective);
  assert.equal(context.I18N.selectedLanguage, locale.id);
  assert.deepEqual(requests, ['i18n/index.json', 'i18n/' + effective + '.json.gz']);
  assert.equal(context.I18N.loaded.size, 1, 'startup must not preload English or the other 49 locales');
  await Promise.all([context.ensureI18nLanguage(effective), context.ensureI18nLanguage(effective)]);
  assert.equal(requests.length, 2, 'loaded language must not be downloaded again');
}
{
  const { context, requests } = fixture({ browser: ['de'] });
  await context.initializeI18n();
  await context.selectUiLanguage('yua');
  assert.equal(context.state.lang, 'en');
  assert.equal(context.I18N.selectedLanguage, 'yua');
  assert(!requests.some(path => path.includes('yua.json')), 'explicit fallback never downloads a pretend translation');
}
for (const [browser, expected] of [
  ['zh-HK', 'zh-TW'], ['ZH_hK', 'zh-TW'], ['zh-Hant-CN', 'zh-TW'],
  ['zh-Hans-TW', 'zh-CN'], ['zh-MO', 'zh-TW'], ['en-US', 'en'],
  ['pt-PT', 'pt'], ['pt-Latn-BR', 'pt-BR'], ['no-NO', 'nb-NO'],
  ['iw-IL', 'he'], ['in-ID', 'id'], ['bn-bd', 'bn-BD'], ['xx-ZZ', 'en'],
]) {
  const { context } = fixture({ browser: [browser] });
  await context.initializeI18n(); assert.equal(context.state.lang, expected, browser);
}
{
  const { context, requests } = fixture({ browser: ['ar'], stored: 'de' });
  await context.initializeI18n();
  assert.equal(context.state.lang, 'de', 'explicit prior choice takes precedence');
  assert.equal(requests.at(-1), 'i18n/de.json.gz');
  await Promise.all([context.ensureI18nLanguage('ar'), context.ensureI18nLanguage('ar')]);
  assert.equal(requests.filter(path => path === 'i18n/ar.json.gz').length, 1, 'in-flight language loads are shared');
}
for (const variant of ['failure', 'badDocument', 'badFile']) {
  const { context, requests } = fixture({ browser: ['ar'], [variant]: 'ar' });
  await context.initializeI18n();
  assert.equal(context.state.lang, 'en');
  assert.equal(context.I18N.selectedLanguage, 'ar', 'requested locale remains available for diagnostics');
  assert.equal(requests.at(-1), 'i18n/en.json.gz');
  assert.equal(context.I18N.loaded.size, 1, 'failed locale must not be marked loaded');
  const manual = fixture({ browser: ['de'], [variant]: 'ar' });
  await manual.context.initializeI18n();
  await manual.context.selectUiLanguage('ar');
  assert.equal(manual.context.state.lang, 'en', 'manual selection uses the same safe fallback');
  assert.equal(manual.context.I18N.selectedLanguage, 'ar');
  assert.equal(manual.requests.at(-1), 'i18n/en.json.gz');
}
assert(!code.includes('!entry.pending'), 'menu visibility must not be coupled to translation completion');
assert(code.includes('entry.common'));
assert(code.includes('document.documentElement.dir'));
console.log('50-locale single-bundle startup, aliases, cache/deduplication, failure fallback and common grouping passed.');
