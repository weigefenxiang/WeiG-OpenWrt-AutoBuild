import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readFrontendRuntimeSource } from './lib/frontend-source.mjs';
import { createCatalogModel, applyUserIntent, deriveConfigurationRepairPlan,
  kconfigStateConstraints, validateConfig, REQUIRED_KCONFIG_RELATION_CAPABILITIES } from '../site/wrt/lib/catalog-engine.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFrontendRuntimeSource(ROOT);

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
    context.menuValues.set(option.symbol, value);
    if (sourceName === 'user') { context.catalogUserOverrides.set(option.symbol, value); context.menuTouched.add(option.symbol); }
    if (sourceName === 'restore') context.menuTouched.delete(option.symbol);
    revisions++;
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
assert.equal(engineCalls, 1, 'scalar edits must enter the shared typed intent engine');
assert.equal(context.menuValues.get(rootfs.symbol), '240');
assert.equal(context.catalogUserOverrides.get(rootfs.symbol), '240');
assert.equal(context.menuTouched.has(rootfs.symbol), true);
assert.equal(result.changes[0].to, '240');
assert.equal(revisions, 1);

context.applyMenuValue({ symbol: 'PACKAGE_fixture', type: 'tristate' }, 'm', false, 'user');
assert.equal(engineCalls, 2, 'bool/tristate values must continue through the Catalog intent engine');

context.catalogUserOverrides.delete(rootfs.symbol);
context.applyMenuValue(rootfs, '160', true, 'restore');
assert.equal(context.menuValues.get(rootfs.symbol), '160');
assert.equal(context.menuTouched.has(rootfs.symbol), false);
assert.equal(engineCalls, 3, 'restoring a scalar value must also use the typed engine');


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

const scalarCases = [['int', '0', '12'], ['hex', '0x0', '0x20'], ['string', '', 'n']];
for (const [type, defaultValue, requested] of scalarCases) {
  const model = createCatalogModel({ schema: 5, targets: [], relations: {
    schema: 2, relationsComplete: true, capabilities: [...REQUIRED_KCONFIG_RELATION_CAPABILITIES],
    records: [
      { kind: 'config', configSymbol: 'GATE', type: 'bool', states: ['n', 'y'], visible: true, userSettable: true },
      { kind: 'config', configSymbol: 'SETTING', type, states: [], visible: true, userSettable: true,
        defaults: [type === 'string' ? '""' : defaultValue],
        kconfig: { dependsExpressions: [['GATE']] } },
    ],
  } });
  const active = new Map([['GATE', 'y'], ['SETTING', defaultValue]]);
  const edited = applyUserIntent(model, active, { symbol: 'SETTING', value: requested });
  assert.equal(edited.values.get('SETTING'), requested, `${type} must preserve literal values`);
  const inactive = new Map([['GATE', 'n'], ['SETTING', requested]]);
  assert.equal(kconfigStateConstraints(model, model.bySymbol.get('SETTING'), inactive).canUnset, true);
  assert.throws(() => applyUserIntent(model, inactive, { symbol: 'SETTING', value: requested }), /SETTING/);
  const plan = deriveConfigurationRepairPlan(model, inactive);
  assert.equal(plan.actions.length, 1, `${type} must have an inactive-assignment recommendation`);
  assert.equal(plan.actions[0].value, null);
  assert.equal(plan.values.has('SETTING'), false);
  assert.equal(plan.values.get('GATE'), 'n', 'repair must not enable the owner');
  assert.equal(validateConfig(model, plan.values).filter(row=>!row.deferred).length, 0);
  const disabled = applyUserIntent(model, edited.values, { symbol: 'GATE', value: 'n' });
  assert.equal(disabled.values.has('SETTING'), false, 'dependency loss must omit scalar values');
  const restored = applyUserIntent(model, disabled.values, { symbol: 'GATE', value: 'y' });
  assert.equal(restored.values.get('SETTING'), defaultValue, 'dependency restoration must derive typed defaults');
  const unknown = new Map([['SETTING', requested]]);
  assert.equal(deriveConfigurationRepairPlan(model, unknown).actions.length, 0, 'unknown prerequisites must not be guessed');
}
const ranged = createCatalogModel({ schema:5, targets:[], relations:{ schema:2,
  relationsComplete:true, capabilities:[...REQUIRED_KCONFIG_RELATION_CAPABILITIES], records:[
    {kind:'config',configSymbol:'LIMIT',type:'int',states:[],visible:true,userSettable:true,
      defaults:['16'], ranges:['0 64']},
    {kind:'config',configSymbol:'MASK',type:'hex',states:[],visible:true,userSettable:true,
      defaults:['0x10'], ranges:['0x0 0x40']},
  ]} });
for(const [symbol, invalid, expected] of [['LIMIT','100','16'],['MASK','0xff','0x10']]) {
  assert.throws(()=>applyUserIntent(ranged,new Map(),{symbol,value:invalid}), /range/);
  const repair=deriveConfigurationRepairPlan(ranged,new Map([[symbol,invalid]]));
  assert.equal(repair.actions[0]?.value,expected,'range repair must use the active typed default');
}
assert.equal(applyUserIntent(ranged,new Map(),{symbol:'LIMIT',value:'0'}).values.get('LIMIT'),'0');
console.log('menuconfig scalar editor tests: PASS');
