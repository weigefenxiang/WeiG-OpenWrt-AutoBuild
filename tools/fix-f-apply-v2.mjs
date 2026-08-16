#!/usr/bin/env node
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const original = resolve(root, 'tools/fix-f-apply.mjs');
const generated = resolve(root, 'tools/fix-f-runtime.mjs');

function replaceOnce(text, before, after, label) {
  const first = text.indexOf(before);
  const second = first < 0 ? -1 : text.indexOf(before, first + before.length);
  if (first < 0 || second >= 0) throw new Error(`${label}: expected exactly one literal match`);
  return text.slice(0, first) + after + text.slice(first + before.length);
}

let ui = readFileSync(resolve(root, 'tools/test-catalog-ui-contract.mjs'), 'utf8');
ui = replaceOnce(ui,
`expect(hiddenLoadContract.includes('buildMenuIndexes(catalog)') &&
  hiddenLoadContract.includes('backfillCatalogBaselineForLoadedOptions()') &&
  hiddenLoadContract.indexOf('buildMenuIndexes(catalog)') < hiddenLoadContract.indexOf('backfillCatalogBaselineForLoadedOptions()') &&
  lateBaselineContract.includes('const baselineValues = new Map(catalogBaselineValues)') &&
  lateBaselineContract.includes("catalogValidationContext(baselineValues, 'interactive')") &&
  lateBaselineContract.includes('catalogBaselineValues.set(option.symbol, value)') &&
  !lateBaselineContract.includes('new Map(menuValues)'),
  'late hidden PACKAGE defaults can be misclassified as Probe user selections');`,
`expect(hiddenLoadContract.includes('buildMenuIndexes(catalog)') &&
  hiddenLoadContract.includes('backfillCatalogBaselineForLoadedOptions()') &&
  hiddenLoadContract.indexOf('buildMenuIndexes(catalog)') < hiddenLoadContract.indexOf('backfillCatalogBaselineForLoadedOptions()') &&
  lateBaselineContract.includes('nativeProfileBaselineEntries()') &&
  lateBaselineContract.includes('normalizeImportedKconfigValue') &&
  lateBaselineContract.includes('catalogBaselineValues.set(option.symbol, value)') &&
  lateBaselineContract.includes('!menuTouched.has(option.symbol)') &&
  lateBaselineContract.includes('!catalogUserOverrides.has(option.symbol)') &&
  !lateBaselineContract.includes('catalogValidationContext') &&
  !lateBaselineContract.includes('new Map(menuValues)'),
  'late hidden PACKAGE values must come only from the immutable Native Profile baseline');`,
  'Native late baseline UI contract');
writeFileSync(resolve(root, 'tools/test-catalog-ui-contract.mjs'), ui, 'utf8');

let performanceTest = readFileSync(resolve(root, 'tools/test-catalog-performance.mjs'), 'utf8');
performanceTest = replaceOnce(performanceTest,
  "import { createCatalogModel, resolveKconfigDefault } from '../site/wrt/lib/catalog-engine.js';",
  "import { createCatalogModel } from '../site/wrt/lib/catalog-engine.js';",
  'remove retired default evaluator import');
const baselineStart = performanceTest.indexOf('const baselineSource = [');
const baselineEnd = performanceTest.indexOf('\nconst workerSource = ', baselineStart);
if (baselineStart < 0 || baselineEnd < 0) throw new Error('Native baseline performance fixture boundaries not found');
const nativeBaselineFixture = `const baselineSource = appFunctionSource(appSource, 'initializeCatalogBaseline', 'snapshotCatalogBaseline');
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
assert.ok(baselineElapsed < 1000, \`Native Profile baseline seeding took \${baselineElapsed.toFixed(1)}ms\`);
`;
performanceTest = performanceTest.slice(0, baselineStart) + nativeBaselineFixture + performanceTest.slice(baselineEnd);
performanceTest = replaceOnce(performanceTest,
`  baselineContextBuilds,
  baselineConditionEvals,
}));`,
`  baselineContextBuilds,
  baselineValueReads,
  baselineMs: Number(baselineElapsed.toFixed(1)),
}));`,
  'Native baseline performance report');
writeFileSync(resolve(root, 'tools/test-catalog-performance.mjs'), performanceTest, 'utf8');

let source = readFileSync(original, 'utf8');
const startMarker = "app = replaceOnce(app,\n  '    MENU_CATALOG = null;\\n    CATALOG_MODEL = null;\\n    catalogShardLoader = null;";
const nextMarker = "app = replaceOnce(app,\n  '  state.device = device;\\n  const needsBaseline";
const start = source.indexOf(startMarker);
const next = source.indexOf(nextMarker, start + 1);
if (start < 0 || next < 0) throw new Error('cannot locate non-unique Catalog cleanup patch block');
source = source.slice(0, start) + source.slice(next);
source = source.replace(
  "rmSync(resolve(ROOT, 'tools/fix-f-apply.mjs'));\nrmSync(resolve(ROOT, '.github/workflows/fix-f-apply.yml'));",
  "rmSync(resolve(ROOT, 'tools/fix-f-apply.mjs'));\nrmSync(resolve(ROOT, 'tools/fix-f-apply-v2.mjs'));\nrmSync(resolve(ROOT, 'tools/fix-f-runtime.mjs'));\nrmSync(resolve(ROOT, '.github/workflows/fix-f-apply.yml'));",
);
writeFileSync(generated, source, 'utf8');
const result = spawnSync(process.execPath, [generated], { cwd: root, encoding: 'utf8', stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
