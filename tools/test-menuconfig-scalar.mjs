import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(ROOT, 'site', 'wrt', 'app.js'), 'utf8');

function sourceRange(startName, endName) {
  const start = source.indexOf(`function ${startName}(`);
  const end = source.indexOf(`function ${endName}(`, start + 1);
  assert.ok(start >= 0 && end > start, `cannot extract ${startName}..${endName}`);
  return source.slice(start, end);
}

let engineCalls = 0;
let revisions = 0;
const context = {
  String,
  Error,
  menuValues: new Map(),
  menuTouched: new Set(),
  catalogRecommendedValues: new Map(),
  catalogImportedSymbols: new Set(),
  catalogUserOverrides: new Map(),
  catalogDependencySymbols: new Set(),
  simpleKconfigDefault: (option) => option.defaultValue ?? (option.type === 'string' ? '' : 'n'),
  markCatalogStateChanged: () => { revisions++; },
  applyCatalogIntent: (option, value, force, sourceName) => {
    engineCalls++;
    return { changes: [{ symbol: option.symbol, from: 'n', to: value, reason: `${force}:${sourceName}` }], violations: [] };
  },
};
vm.createContext(context);
vm.runInContext(sourceRange('normalizeKconfigValueByType', 'catalogConflictRecordForPackage'), context,
  { filename: 'menuconfig-scalar-fixture.js' });

assert.equal(context.scalarKconfigOption({ type: 'string' }), true);
assert.equal(context.scalarKconfigOption({ type: 'int' }), true);
assert.equal(context.scalarKconfigOption({ type: 'hex' }), true);
assert.equal(context.scalarKconfigOption({ type: 'bool' }), false);
assert.equal(context.scalarKconfigOption({ type: 'tristate' }), false);

assert.equal(context.normalizeScalarKconfigValue({ symbol: 'S', type: 'string' }, ''), '');
assert.equal(context.normalizeScalarKconfigValue({ symbol: 'S', type: 'string' }, 'n'), 'n');
assert.equal(context.normalizeScalarKconfigValue({ symbol: 'I', type: 'int' }, ' 240 '), '240');
assert.equal(context.normalizeScalarKconfigValue({ symbol: 'I', type: 'int' }, '-12'), '-12');
assert.throws(() => context.normalizeScalarKconfigValue({ symbol: 'I', type: 'int' }, ''), /integer/);
assert.throws(() => context.normalizeScalarKconfigValue({ symbol: 'I', type: 'int' }, '12.5'), /integer/);
assert.throws(() => context.normalizeScalarKconfigValue({ symbol: 'I', type: 'int' }, 'abc'), /integer/);
assert.equal(context.normalizeScalarKconfigValue({ symbol: 'H', type: 'hex' }, '0x20'), '0x20');
assert.equal(context.normalizeScalarKconfigValue({ symbol: 'H', type: 'hex' }, '0XFF'), '0XFF');
assert.throws(() => context.normalizeScalarKconfigValue({ symbol: 'H', type: 'hex' }, ''), /hexadecimal/);
assert.throws(() => context.normalizeScalarKconfigValue({ symbol: 'H', type: 'hex' }, 'xyz'), /hexadecimal/);

const rootfs = { symbol: 'TARGET_ROOTFS_PARTSIZE', type: 'int', defaultValue: '160' };
context.menuValues.set(rootfs.symbol, '160');
const result = context.applyMenuValue(rootfs, '240', false, 'user');
assert.equal(engineCalls, 0, 'scalar value must not enter the N/M/Y Catalog intent engine');
assert.equal(context.menuValues.get(rootfs.symbol), '240');
assert.equal(context.catalogUserOverrides.get(rootfs.symbol), '240');
assert.equal(context.menuTouched.has(rootfs.symbol), true);
assert.equal(result.changes[0].to, '240');
assert.equal(revisions, 1);

context.applyMenuValue({ symbol: 'PACKAGE_fixture', type: 'tristate' }, 'm', false, 'user');
assert.equal(engineCalls, 1, 'bool/tristate values must continue through the Catalog intent engine');

context.catalogUserOverrides.delete(rootfs.symbol);
context.applyMenuValue(rootfs, '160', true, 'restore');
assert.equal(context.menuValues.get(rootfs.symbol), '160');
assert.equal(context.menuTouched.has(rootfs.symbol), false);
assert.equal(engineCalls, 1, 'restoring a scalar value must also bypass the N/M/Y engine');


const setConfigSource = [
  sourceRange('normalizeKconfigValueByType', 'scalarKconfigOption'),
  sourceRange('serializeKconfigValue', 'applyMenuConfig'),
].join('\n');
const configContext = {};
vm.createContext(configContext);
vm.runInContext(setConfigSource, configContext, { filename: 'menuconfig-scalar-config-fixture.js' });
const rootfsConfig = 'CONFIG_TARGET_ROOTFS_PARTSIZE=160\n';
assert.equal(
  configContext.setConfigSymbol(rootfsConfig, 'TARGET_ROOTFS_PARTSIZE', '240', 'int'),
  'CONFIG_TARGET_ROOTFS_PARTSIZE=240\n',
  'a persisted scalar override must be exported as the new integer value',
);

console.log('menuconfig scalar editor tests: PASS');
