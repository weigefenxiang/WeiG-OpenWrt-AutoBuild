#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createCatalogModel } from '../site/wrt/lib/catalog-engine.js';
import { createRuntimeMenu, mergeHiddenShard, mergeMenuShards } from '../site/wrt/lib/catalog-schema6.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');


function appFunctionSource(source, name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `app.js function ${name} is missing`);
  const end = nextName ? source.indexOf(`\nfunction ${nextName}(`, start) : -1;
  assert.ok(end > start, `app.js function ${name} boundary is missing`);
  return source.slice(start, end);
}

function compactFixture(count = 12000) {
  const strings = [];
  const records = [];
  for (let index = 0; index < count; index++) {
    strings.push(`PACKAGE_fixture-${String(index).padStart(5, '0')}`);
    records.push([index, 31, 2, 2, 7, -1, 0, 0, 0, 0, 0, 0, 0]);
  }
  return {
    schema: 3,
    fields: [
      'symbolId', 'flags', 'typeCode', 'originCode', 'statesMask', 'choiceId',
      'defaultsId', 'dependsVariantsId', 'selectsVariantsId', 'impliesVariantsId',
      'packageDependenciesId', 'providesId', 'conflictsId',
    ],
    flags: { visible: 1, userSettable: 2, canDisable: 4, hasKconfig: 8, package: 16 },
    types: ['', 'bool', 'tristate'],
    origins: ['', 'kconfig-only', 'kconfig+packageinfo'],
    strings,
    expressions: [],
    stringLists: [[]],
    expressionLists: [[]],
    expressionVariants: [[0]],
    defaults: [[]],
    packageDependencies: [[]],
    records,
    indexes: { providers: [], reverseDependencies: [], reverseKconfig: [], choices: [] },
    summary: {},
    validation: {},
  };
}

const modelStart = performance.now();
const model = createCatalogModel({ schema: 6, relations: compactFixture() });
const modelElapsed = performance.now() - modelStart;
assert.equal(model.records.length, 12000);
assert.ok(model.bySymbol.has('PACKAGE_fixture-11999'));
assert.ok(modelElapsed < 5000, `compact relation expansion took ${modelElapsed.toFixed(1)}ms`);

const runtime = createRuntimeMenu(model);
const menu = mergeMenuShards({ menu: runtime }, model, {
  options: [
    { symbol: 'PACKAGE_fixture-00000', promptEn: 'Fixture zero', usageEn: 'Visible fixture', path: ['Applications'] },
  ],
  categories: ['Applications'],
  labels: { Applications: { en: 'Applications' } },
  choices: [],
});
assert.equal(menu.displayLoaded, true);
assert.equal(menu.hiddenLoaded, false);
const catalog = { menu };
assert.equal(mergeHiddenShard(catalog, model, {
  options: [{ symbol: 'PACKAGE_fixture-00001', promptEn: 'Hidden fixture', usageEn: 'Loaded only for hidden search' }],
}), true);
assert.equal(catalog.menu.hiddenLoaded, true);
assert.equal(catalog.menu.displayOptions.find((row) => row.symbol === 'PACKAGE_fixture-00001').promptEn, 'Hidden fixture');

const appSource = readFileSync(join(ROOT, 'site', 'wrt', 'app.js'), 'utf8');
const searchTextSource = appFunctionSource(appSource, 'catalogSearchText', 'rebuildMenuSearchIndex');
const searchTextContext = { Set, String, Object };
vm.runInNewContext(searchTextSource, searchTextContext, { filename: 'app-search-text-fixture.js' });
const rootfsSearchOption = {
  symbol: 'TARGET_ROOTFS_PARTSIZE',
  prompt: 'Root filesystem partition size (in MiB)',
  promptEn: 'Root filesystem partition size (in MiB)',
  promptZh: '',
  promptI18n: {},
  usageEn: 'Sets the root filesystem partition size.',
  help: 'Increase this when the ext4 image is too small.',
};
const nameSearchText = searchTextContext.catalogSearchText(rootfsSearchOption);
assert.ok(nameSearchText.includes('target_rootfs_partsize'));
assert.ok(nameSearchText.includes('config_target_rootfs_partsize'));
assert.ok(nameSearchText.includes('target rootfs partsize'));
assert.ok(nameSearchText.includes('root filesystem partition size'));
assert.ok(!nameSearchText.includes('sets the root filesystem partition size'));
assert.ok(!nameSearchText.includes('ext4 image is too small'));
const startupSource = appFunctionSource(appSource, 'buildMenuStartupIndexes', 'buildMenuIndexes');
assert.ok(!startupSource.includes('indexSearchText(') && !startupSource.includes('addMenuIndex(menuExactPaths') &&
  !startupSource.includes('startCatalogSearchWorker('),
'Schema 6 startup index eagerly rebuilt Advanced search/path indexes');
assert.ok(appSource.includes('if (catalogAutoloadReady) loadCatalog(') &&
  appSource.includes('startCatalogAfterFirstPaint();'),
'Catalog autoload is not gated behind the first-paint scheduler');

const baselineSource = appFunctionSource(appSource, 'initializeCatalogBaseline', 'snapshotCatalogBaseline');
let baselineContextBuilds = 0;
let baselineValueReads = 0;
const baselineOptions = [
  { symbol: 'C', type: 'bool', hidden: false },
  { symbol: 'B', type: 'bool', hidden: false },
  { symbol: 'A', type: 'bool', hidden: false },
  { symbol: 'TARGETED', type: 'bool', hidden: false },
  { symbol: 'MODULE', type: 'tristate', hidden: false },
  { symbol: 'HIDDEN', type: 'bool', hidden: true },
  { symbol: 'CHOICE_A', type: 'bool', hidden: false, choice: 'FIXTURE_CHOICE' },
  { symbol: 'CHOICE_B', type: 'bool', hidden: false, choice: 'FIXTURE_CHOICE' },
];
const baselineEntries = new Map([
  ['A', { value: 'y' }], ['B', { value: 'y' }], ['C', { value: 'y' }],
  ['TARGETED', { value: 'y' }], ['MODULE', { value: 'm' }], ['HIDDEN', { value: 'y' }],
  ['CHOICE_A', { value: 'n' }], ['CHOICE_B', { value: 'y' }],
]);
const baselineContext = {
  nativeProfileBaselineEntries() { return baselineEntries; },
  normalizeImportedKconfigValue(entry, type, fallback) {
    baselineValueReads++;
    return entry?.value ?? fallback;
  },
  catalogValidationContext() {
    baselineContextBuilds++;
    throw new Error('Native Profile initialization must not rebuild a Kconfig validation context');
  },
  menuValues: new Map(), menuTouched: new Set(), catalogBaselineValues: new Map(),
  catalogBaselineOrigins: new Map(), catalogRecommendedValues: new Map(),
  catalogDependencySymbols: new Set(), catalogImportedSymbols: new Set(),
  catalogUserOverrides: new Map(), state: { sel: new Set(), removed: new Set() },
  menuSearchOptions: baselineOptions,
  markCatalogStateChanged() {}, snapshotCatalogBaseline() {},
  Map, Set, String, Error,
};
vm.runInNewContext(baselineSource, baselineContext, { filename: 'app-baseline-fixture.js' });
const baselineStartTime = performance.now();
baselineContext.initializeCatalogBaseline();
const baselineElapsed = performance.now() - baselineStartTime;
assert.equal(baselineContext.menuValues.get('A'), 'y');
assert.equal(baselineContext.menuValues.get('B'), 'y');
assert.equal(baselineContext.menuValues.get('C'), 'y');
assert.equal(baselineContext.menuValues.get('TARGETED'), 'y');
assert.equal(baselineContext.menuValues.get('MODULE'), 'm');
assert.equal(baselineContext.menuValues.get('CHOICE_B'), 'y');
assert.equal(baselineContext.menuValues.get('HIDDEN'), 'y');
assert.equal(baselineContext.menuValues.get('CHOICE_A'), 'n');
assert.equal(baselineContextBuilds, 0,
  'Native Profile initialization unexpectedly rebuilt a Kconfig validation context');
assert.equal(baselineValueReads, baselineOptions.length,
  'Native Profile initialization did not read each loaded option exactly once');
assert.ok(baselineElapsed < 1000, `Native Profile baseline seeding took ${baselineElapsed.toFixed(1)}ms`);

const workerSource = readFileSync(join(ROOT, 'site', 'wrt', 'lib', 'catalog-search-worker.js'), 'utf8');
const messages = [];
const context = {
  self: {
    postMessage(message) { messages.push(message); },
    onmessage: null,
  },
  Map,
  Set,
  String,
};
vm.runInNewContext(workerSource, context, { filename: 'catalog-search-worker.js' });
const rows = model.records.map((record, index) => [
  record.configSymbol,
  `${record.configSymbol} fixture package ${index} ${index === 11999 ? 'needle-target' : ''}`,
]);
const indexStart = performance.now();
context.self.onmessage({ data: { type: 'init', generation: 7, rows } });
const indexElapsed = performance.now() - indexStart;
assert.equal(messages.at(-1)?.type, 'ready');
assert.equal(messages.at(-1)?.rows, rows.length);
const queryStart = performance.now();
context.self.onmessage({ data: { type: 'query', generation: 7, requestId: 1, query: 'needle-target' } });
const queryElapsed = performance.now() - queryStart;
const result = messages.at(-1);
assert.equal(result.type, 'result');
assert.deepEqual([...result.symbols], ['PACKAGE_fixture-11999']);
assert.ok(indexElapsed < 5000, `search indexing took ${indexElapsed.toFixed(1)}ms`);
assert.ok(queryElapsed < 1000, `search query took ${queryElapsed.toFixed(1)}ms`);

console.log(JSON.stringify({
  records: model.records.length,
  modelMs: Number(modelElapsed.toFixed(1)),
  searchIndexMs: Number(indexElapsed.toFixed(1)),
  searchQueryMs: Number(queryElapsed.toFixed(1)),
  baselineContextBuilds,
  baselineValueReads,
  baselineMs: Number(baselineElapsed.toFixed(1)),
}));
