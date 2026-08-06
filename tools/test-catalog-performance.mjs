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
}));
