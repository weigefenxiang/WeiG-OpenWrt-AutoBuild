import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(ROOT, 'site', 'wrt', 'app.js'), 'utf8');

assert.ok(source.includes(
  "setConfigSymbol(text, symbol, String(menuValues.get(symbol) ?? 'n'), option.type)"),
'Catalog option.type is not propagated into .config serialization');
assert.ok(!source.includes("symbol === 'EXTERNAL_KERNEL_TREE'") &&
  !source.includes('symbol === "EXTERNAL_KERNEL_TREE"'),
'Kconfig serialization must not special-case EXTERNAL_KERNEL_TREE');

function sourceRange(startName, endName) {
  const start = source.indexOf(`function ${startName}(`);
  const end = source.indexOf(`\nfunction ${endName}(`, start + 1);
  assert.ok(start >= 0 && end > start, `cannot extract ${startName}..${endName}`);
  return source.slice(start, end);
}

const context = { JSON, String, Error };
vm.createContext(context);
vm.runInContext([
  sourceRange('normalizeKconfigValueByType', 'scalarKconfigOption'),
  sourceRange('parseConfigEntries', 'parseConfigValues'),
  sourceRange('normalizeImportedKconfigValue', 'importedValue'),
  sourceRange('serializeKconfigValue', 'setConfigSymbol'),
  sourceRange('setConfigSymbol', 'requirementScopeMatches'),
].join('\n'), context, { filename: 'kconfig-serializer-fixture.js' });

const {
  normalizeKconfigValueByType,
  parseConfigEntries,
  normalizeImportedKconfigValue,
  serializeKconfigValue,
  setConfigSymbol,
} = context;

// bool / tristate: only real Kconfig states are valid.
assert.equal(normalizeKconfigValueByType('y', 'bool'), 'y');
assert.equal(normalizeKconfigValueByType('n', 'bool'), 'n');
for (const invalid of ['', 'm', 'abc']) {
  assert.throws(() => normalizeKconfigValueByType(invalid, 'bool'), /bool/i);
}
assert.equal(normalizeKconfigValueByType('y', 'tristate'), 'y');
assert.equal(normalizeKconfigValueByType('m', 'tristate'), 'm');
assert.equal(normalizeKconfigValueByType('n', 'tristate'), 'n');
for (const invalid of ['', 'abc']) {
  assert.throws(() => normalizeKconfigValueByType(invalid, 'tristate'), /tristate/i);
}

// string: empty and literal "n" are strings, never the disabled state.
assert.equal(serializeKconfigValue('', 'string'), '""');
assert.equal(serializeKconfigValue('n', 'string'), '"n"');
assert.equal(serializeKconfigValue('hello', 'string'), '"hello"');
assert.equal(serializeKconfigValue('"hello"', 'string'), '"hello"');
assert.equal(serializeKconfigValue('a"b\\c', 'string'), '"a\\"b\\\\c"');

// int / hex: valid values serialize; invalid/empty values are rejected.
for (const value of ['0', '160', '-1']) {
  assert.equal(serializeKconfigValue(value, 'int'), value);
}
for (const invalid of ['', 'abc', '1.2']) {
  assert.throws(() => serializeKconfigValue(invalid, 'int'), /integer/i);
}
for (const value of ['0x0', '0x20', '0xABC', '0Xff']) {
  assert.equal(serializeKconfigValue(value, 'hex'), value);
}
for (const invalid of ['', 'xyz', '20']) {
  assert.throws(() => serializeKconfigValue(invalid, 'hex'), /hexadecimal/i);
}

assert.equal(serializeKconfigValue('n', 'bool'), null);
assert.equal(serializeKconfigValue('y', 'bool'), 'y');
assert.equal(serializeKconfigValue('n', 'tristate'), null);
assert.equal(serializeKconfigValue('m', 'tristate'), 'm');
assert.equal(serializeKconfigValue('y', 'tristate'), 'y');
assert.throws(() => serializeKconfigValue('m', 'bool'), /bool/i);
assert.throws(() => serializeKconfigValue('abc', 'tristate'), /tristate/i);

// Unknown Catalog type is preserved as raw .config representation, not guessed as bool/string.
assert.equal(serializeKconfigValue('"literal"', 'unknown'), '"literal"');
assert.equal(serializeKconfigValue('123', 'unknown'), '123');
assert.equal(serializeKconfigValue('n', 'unknown'), null);

// Historical "not set" must retain its raw state until Catalog type is known.
const disabledStringEntry = parseConfigEntries('# CONFIG_EXTERNAL_KERNEL_TREE is not set\n')
  .get('EXTERNAL_KERNEL_TREE');
assert.equal(disabledStringEntry.disabled, true);
assert.equal(normalizeImportedKconfigValue(disabledStringEntry, 'string', ''), '');
assert.equal(normalizeImportedKconfigValue(disabledStringEntry, 'int', '160'), '160');
assert.equal(normalizeImportedKconfigValue(disabledStringEntry, 'hex', '0x20'), '0x20');
assert.equal(normalizeImportedKconfigValue(disabledStringEntry, 'int', 'n'), undefined,
  'non-bool not-set without a valid Catalog baseline must be preserved instead of guessed');
const literalNStringEntry = parseConfigEntries('CONFIG_STRING_N="n"\n').get('STRING_N');
assert.equal(normalizeImportedKconfigValue(literalNStringEntry, 'string', ''), 'n');
const disabledBoolEntry = parseConfigEntries('# CONFIG_BOOL_DISABLED is not set\n').get('BOOL_DISABLED');
assert.equal(normalizeImportedKconfigValue(disabledBoolEntry, 'bool', 'y'), 'n');

const regressionInput = [
  'CONFIG_TARGET_KERNEL_PARTSIZE=32',
  'CONFIG_TARGET_ROOTFS_PARTSIZE=160',
  '# CONFIG_EXTERNAL_KERNEL_TREE is not set',
  'CONFIG_UNKNOWN_STRING="leave-me-exactly"',
  '# CONFIG_UNKNOWN_DISABLED is not set',
  '',
].join('\n');
const regressionEntry = parseConfigEntries(regressionInput).get('EXTERNAL_KERNEL_TREE');
const regressionValue = normalizeImportedKconfigValue(regressionEntry, 'string', '');
const regressionOutput = setConfigSymbol(
  regressionInput, 'EXTERNAL_KERNEL_TREE', regressionValue, 'string');
assert.match(regressionOutput, /^CONFIG_EXTERNAL_KERNEL_TREE=""$/m);
assert.doesNotMatch(regressionOutput, /^# CONFIG_EXTERNAL_KERNEL_TREE is not set$/m);
assert.match(regressionOutput, /^CONFIG_TARGET_KERNEL_PARTSIZE=32$/m);
assert.match(regressionOutput, /^CONFIG_TARGET_ROOTFS_PARTSIZE=160$/m);
assert.match(regressionOutput, /^CONFIG_UNKNOWN_STRING="leave-me-exactly"$/m);
assert.match(regressionOutput, /^# CONFIG_UNKNOWN_DISABLED is not set$/m);

console.log('Kconfig serializer hardening matrix: PASS');
