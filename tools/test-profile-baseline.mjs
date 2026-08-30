#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  applyProfileOverrides,
  createProfileBaselineStore,
  diffProfileBaseline,
  mergeConfigWithProfileBaseline,
  parseConfigMap,
  serializeConfigMap,
  validateProfileBaselineDocument,
} from '../site/wrt/lib/profile-baseline.js';

const fields = [
  'target', 'board', 'subtarget', 'profile', 'name', 'boardSelector', 'selector', 'targetSelector',
  'nativeHash', 'symbolCount', 'groupId',
];
const document = {
  schema: 3,
  kind: 'profile-baselines',
  encoding: 'branch-common-plus-exact-config-groups-v1',
  source: { id: 'OpenWrt', branch: 'main', commit: 'a'.repeat(40) },
  profileFields: fields,
  stateGroups: ['n', 'm', 'y', 'otherIndexValue'],
  identity: {
    mode: 'catalog-target-tree-v1',
    fixed: ['TARGET_BOARD', 'TARGET_SUBTARGET', 'TARGET_PROFILE'],
    targetOverrides: [], aliases: [], overrides: [],
  },
  symbols: ['FEATURE', 'ROOTFS_SIZE'],
  common: [[], [], [0], [1, '160']],
  groups: [
    [[], [], [], []],
    [[], [], [], [1, '512']],
  ],
  profiles: [
    ['x86/64', 'x86', '64', 'DEVICE_a', 'A', 'TARGET_x86', 'TARGET_x86_64_DEVICE_a', 'TARGET_x86_64', 'b'.repeat(64), 9, 0],
    ['x86/64', 'x86', '64', 'DEVICE_b', 'B', 'TARGET_x86', 'TARGET_x86_64_DEVICE_b', 'TARGET_x86_64', 'c'.repeat(64), 9, 1],
  ],
  metrics: { reconstructionMismatches: 0 },
};

validateProfileBaselineDocument(document, {
  sourceId: 'OpenWrt', branch: 'main', commit: 'a'.repeat(40),
  schema: 3, encoding: document.encoding, profiles: 2, configGroups: 2,
});
const store = createProfileBaselineStore(document, {
  sourceId: 'OpenWrt', branch: 'main', commit: 'a'.repeat(40),
});
assert.equal(store.profiles, 2);
assert.equal(store.groups, 2);

const a = store.resolve({
  system: 'x86', subtarget: '64', profileSymbol: 'DEVICE_a',
  profileSelector: 'TARGET_x86_64_DEVICE_a',
});
assert(a);
assert.equal(a.values.get('FEATURE'), 'y');
assert.equal(a.values.get('ROOTFS_SIZE'), '160');
assert.equal(a.values.get('TARGET_BOARD'), '"x86"');
assert.equal(a.values.get('TARGET_SUBTARGET'), '"64"');
assert.equal(a.values.get('TARGET_PROFILE'), '"DEVICE_a"');
assert.equal(a.values.get('TARGET_x86'), 'y');
assert.equal(a.values.get('TARGET_x86_64'), 'y');
assert.equal(a.values.get('TARGET_x86_64_DEVICE_a'), 'y');
assert.equal(a.values.get('TARGET_x86_64_DEVICE_b'), 'n');
assert.equal(a.values.size, 9);

const b = store.resolve({ system: 'x86', subtarget: '64', profile: 'b' });
assert(b);
assert.equal(b.values.get('ROOTFS_SIZE'), '512');
assert.equal(b.values.get('TARGET_x86_64_DEVICE_a'), 'n');
assert.equal(b.values.get('TARGET_x86_64_DEVICE_b'), 'y');

const edited = new Map(a.values);
edited.set('FEATURE', 'n');
edited.set('ROOTFS_SIZE', '512');
const delta = diffProfileBaseline(a, edited);
assert.deepEqual(delta, [['FEATURE', 'n'], ['ROOTFS_SIZE', '512']]);
const reconstructed = applyProfileOverrides(a, delta);
assert.deepEqual([...reconstructed], [...edited]);

const allowedSymbols = new Set([...a.values.keys(), 'DYNAMIC_OPTION']);
const expanded = new Map(edited);
expanded.set('DYNAMIC_OPTION', 'y');
const expandedDelta = diffProfileBaseline(a, expanded, { allowedSymbols });
assert.deepEqual(expandedDelta, [['DYNAMIC_OPTION', 'y'], ['FEATURE', 'n'], ['ROOTFS_SIZE', '512']]);
const expandedReconstructed = applyProfileOverrides(a, expandedDelta, { allowedSymbols });
assert.deepEqual([...expandedReconstructed], [...expanded]);
assert.throws(() => diffProfileBaseline(a, expanded), /outside the active Catalog/);
assert.throws(() => applyProfileOverrides(a, [['UNKNOWN_OPTION', 'y']], { allowedSymbols }), /outside the active Catalog/);

const importedOverlay = mergeConfigWithProfileBaseline(a, [
  '# CONFIG_FEATURE is not set',
  'CONFIG_DYNAMIC_OPTION=y',
  'CONFIG_REMOVED_FROM_CURRENT=y',
].join('\n'), { allowedSymbols });
assert.equal(importedOverlay.values.get('FEATURE'), 'n');
assert.equal(importedOverlay.values.get('ROOTFS_SIZE'), '160',
  'a current baseline symbol missing from an imported config was treated as a deletion');
assert.equal(importedOverlay.values.get('DYNAMIC_OPTION'), 'y');
assert(!importedOverlay.values.has('REMOVED_FROM_CURRENT'));
assert.deepEqual(importedOverlay.ignoredSymbols, ['REMOVED_FROM_CURRENT']);
assert.deepEqual(diffProfileBaseline(a, importedOverlay.values, { allowedSymbols }), [
  ['DYNAMIC_OPTION', 'y'], ['FEATURE', 'n'],
]);

const text = serializeConfigMap(reconstructed);
assert.match(text, /^# CONFIG_FEATURE is not set$/m);
assert.match(text, /^CONFIG_ROOTFS_SIZE=512$/m);
assert.match(text, /^CONFIG_TARGET_BOARD="x86"$/m);
assert.deepEqual([...parseConfigMap(text)], [...new Map([...reconstructed].sort(([left], [right]) => left.localeCompare(right)))]);

assert.throws(() => diffProfileBaseline(a, new Map([...a.values, ['TARGET_BOARD', '"arm"']])), /identity/);
assert.throws(() => applyProfileOverrides(a, [['TARGET_PROFILE', '"DEVICE_b"']]), /identity/);
assert.throws(() => applyProfileOverrides(a, [['NEW_SYMBOL', 'y']]), /outside/);
assert.throws(() => createProfileBaselineStore({ ...document, schema: 2 }), /invalid Native Profile baseline/);
assert.throws(() => validateProfileBaselineDocument({
  ...document, metrics: { reconstructionMismatches: 1 },
}), /parity/);

console.log('Native Profile baseline checks passed: schema3 groups, target identity, exact delta, Catalog-authorized dynamic symbols, reconstruction, serialization, identity protection.');
