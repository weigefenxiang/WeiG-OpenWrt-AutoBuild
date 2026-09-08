// Explicit integration test only: deployed browser/Worker never imports a
// producer checkout. Test actual parser -> wire -> browser semantics together.
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expandCompactRelations, createCatalogModel, resolveKconfigDefault } from '../site/wrt/lib/catalog-engine.js';

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
