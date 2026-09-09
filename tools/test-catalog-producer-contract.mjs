// Explicit integration test only: deployed browser/Worker never imports a
// producer checkout. Test actual parser -> wire -> browser semantics together.
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { expandCompactRelations, createCatalogModel, resolveKconfigDefault,
  parseConfigDocument, reconcileKconfigDerivedValues, validateConfig } from '../site/wrt/lib/catalog-engine.js';

const producerAt = process.argv.indexOf('--producer-root');
if (producerAt < 0 || !process.argv[producerAt + 1]) throw new Error('Pass --producer-root with the Catalog checkout to validate');
const root = resolve(process.argv[producerAt + 1]);
const producer = async (file) => import(pathToFileURL(join(root, 'scripts', file)));
const { parseKconfigTree, parseKconfigDefault } = await producer('lib.mjs');
const { buildKconfigRelations } = await producer('kconfig-relations.mjs');
const { compactRelations, compareRelationSemantics } = await producer('compact-relations.mjs');
const { encodeCompactRelationTables } = await producer('relation-table-codec.mjs');
for (const fixture of ['kconfig-compact-roundtrip', 'kconfig-undefined', 'kconfig-package-selector',
  'kconfig-capabilities', 'kconfig-dropbear', 'kconfig-semantics', 'kconfig-help-zero', 'duplicate', 'fixture']) {
  const menu = parseKconfigTree(join(root, 'tests', fixture));
  const readable = buildKconfigRelations(menu.allOptions, [], menu.choices, { parserValidation: menu.validation });
  const decoded = expandCompactRelations(compactRelations(readable));
  const wire = encodeCompactRelationTables(compactRelations(readable));
  const compactDecoded = expandCompactRelations(JSON.parse(JSON.stringify(wire)));
  assert(compareRelationSemantics(readable, compactDecoded).equal, `${fixture}: schema-5 table semantic mismatch`);
  const comparison = compareRelationSemantics(readable, decoded);
  assert(comparison.equal, `${fixture}: ${JSON.stringify(comparison.differences)}`);
  const model = createCatalogModel({ schema: 6, targets: [], relations: decoded });
  assert.equal(model.records.length, readable.records.length);
  console.log(`${fixture}: full producer/browser relation equality passed (${readable.records.length} records)`);
}
for (const [raw, expected] of [[String.raw`"a\n"`, 'an'], [String.raw`"a\\q"`, String.raw`a\q`],
  [String.raw`"\"quoted\""`, '"quoted"'], ['""', '']]) {
  const typed = parseKconfigDefault(raw, 'string');
  const result = resolveKconfigDefault({ type: 'string', defaultsTyped: [typed] });
  assert.equal(result.status, 'resolved');
  assert.equal(result.value, expected);
}
const large = parseKconfigDefault('9007199254740993', 'int');
assert.equal(resolveKconfigDefault({ type: 'int', defaultsTyped: [large] }).value, '9007199254740993');
console.log('Producer typed scalar defaults pass browser evaluation without reinterpretation');

const choiceFixture = join(root, 'tests', 'kconfig-choice-defaults');
const choiceMenu = parseKconfigTree(choiceFixture);
const choiceGraph = buildKconfigRelations(choiceMenu.allOptions, [], choiceMenu.choices,
  { parserValidation: choiceMenu.validation });
const choiceModel = createCatalogModel({ schema: 6, targets: [],
  relations: expandCompactRelations(encodeCompactRelationTables(compactRelations(choiceGraph))) });
const choiceOptions = { contextComplete: true,
  closedSymbols: new Set(choiceModel.records.filter((row) => ['bool', 'tristate'].includes(row.type))
    .map((row) => row.configSymbol)) };
const projectedGraph = buildKconfigRelations(choiceMenu.allOptions.filter(option =>
  option.symbol !== 'BACKEND_PREFERRED'), [], choiceMenu.choices, {
  parserValidation: choiceMenu.validation, choiceOptions: choiceMenu.allOptions,
  externalSymbolSources: { BACKEND_PREFERRED: ['parsed-target-filter'] },
});
const projectedModel = createCatalogModel({ schema: 6, targets: [],
  relations: expandCompactRelations(encodeCompactRelationTables(compactRelations(projectedGraph))) });
const projectedValues = new Map([['ENABLE_OWNER', 'y'], ['BACKEND_AVAILABLE', 'y'],
  ['BACKEND_PREFERRED', 'y']]);
const projectedResult = reconcileKconfigDerivedValues(projectedModel, projectedValues, choiceOptions);
assert(!projectedResult.violations.some(row => row.code === 'choice-selection-missing'),
  'an active external native choice member must not become a false missing-choice error');
assert.equal(projectedResult.values.get('BACKEND_ZETA') ?? 'n', 'n',
  'native Target/Profile selection cannot be replaced by the first retained projected member');
const identityGraph = buildKconfigRelations([
  { symbol: 'PACKAGE_real', type: 'tristate', prompt: 'Package', visible: true },
  { symbol: 'PACKAGE_real_FEATURE', type: 'bool', prompt: 'Option', visible: true },
  { symbol: 'PACKAGE_real_HIDDEN', type: 'bool', visible: false },
], [{ name: 'real', depends: [], provides: [], conflicts: [] }], []);
const identityModel = createCatalogModel({ schema: 6, targets: [],
  relations: expandCompactRelations(encodeCompactRelationTables(compactRelations(identityGraph))) });
assert.equal(identityModel.bySymbol.get('PACKAGE_real').package, 'real');
for (const symbol of ['PACKAGE_real_FEATURE', 'PACKAGE_real_HIDDEN']) {
  assert.equal(identityModel.bySymbol.get(symbol).kind, 'config');
  assert.equal(identityModel.bySymbol.get(symbol).package, '');
}
for (const test of JSON.parse(readFileSync(join(choiceFixture, 'cases.json')))) {
  const input = parseConfigDocument(test.input);
  const result = reconcileKconfigDerivedValues(choiceModel, input, { ...choiceOptions, explicitSymbols: input.keys() });
  for (const [symbol, expected] of Object.entries(test.expected)) {
    assert.equal(result.values.get(symbol) ?? 'n', expected, `${test.name}: ${symbol}`);
  }
  assert.equal(validateConfig(choiceModel, result.values, choiceOptions).length, 0, test.name);
  const again = reconcileKconfigDerivedValues(choiceModel, result.values, choiceOptions);
  assert.equal(again.changes.length, 0, `${test.name}: effective values must be a stable fixpoint`);
  console.log(`Producer/consumer choice convergence: ${test.name}`);
}
