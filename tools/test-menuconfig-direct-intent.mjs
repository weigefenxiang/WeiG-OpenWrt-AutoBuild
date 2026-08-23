#!/usr/bin/env node
// Regression for the menuconfig prerequisite modal's two-phase apply path.
// A prerequisite may select the target PACKAGE before the explicit target
// Intent is replayed. The real classic-script state layer must still record
// only the second call as direct user Intent.

import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as CATALOG_ENGINE from '../site/wrt/lib/catalog-engine.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const records = [
  { kind: 'config', configSymbol: 'TRIGGER', kconfigSymbol: 'TRIGGER',
    type: 'bool', states: ['n', 'y'],
    kconfig: { selectsExpressions: [['PACKAGE_target-plugin']] } },
  { kind: 'config', configSymbol: 'CONFLICT', kconfigSymbol: 'CONFLICT',
    type: 'bool', states: ['n', 'y'] },
  { kind: 'package', package: 'target-plugin', configSymbol: 'PACKAGE_target-plugin',
    kconfigSymbol: 'PACKAGE_target-plugin', type: 'bool', states: ['n', 'y'],
    kconfig: { dependsExpressions: [['TRIGGER && !CONFLICT']] } },
];
const model = CATALOG_ENGINE.createCatalogModel({
  schema: 5, targets: [], relations: { schema: 2, records, indexes: {} },
});
const options = records.map((record) => ({
  symbol: record.configSymbol, type: record.type, states: record.states, userSettable: true,
}));

// Load the actual classic-script state layer with a minimal browser/runtime
// fixture. No production bookkeeping is duplicated in the assertions below.
const runtime = {
  CATALOG_ENGINE,
  CATALOG_MODEL: model,
  menuValues: new Map([
    ['TRIGGER', 'n'], ['CONFLICT', 'n'], ['PACKAGE_target-plugin', 'n'],
  ]),
  menuTouched: new Set(),
  catalogBaselineValues: new Map([
    ['TRIGGER', 'n'], ['CONFLICT', 'n'], ['PACKAGE_target-plugin', 'n'],
  ]),
  catalogBaselineOrigins: new Map(),
  catalogRecommendedValues: new Map(),
  catalogDependencySymbols: new Set(),
  catalogConditionalDefaultSymbols: new Set(),
  catalogImportedSymbols: new Set(),
  catalogUserOverrides: new Map(),
  menuOptionBySymbol: new Map(options.map((option) => [option.symbol, option])),
  state: { sel: new Set(), removed: new Set(), theme: '@base', source: null, device: { target: null } },
  PLUGINS: { plugins: [] },
  catalogContextCache: new Map(), catalogContextCacheBypass: false,
  catalogStateRevision: 0,
  menuVisibilityRevision: -1, menuVisibilityCache: new Map(),
  menuSelectableStatesCache: new Map(), menuStateConstraintsCache: new Map(),
  UI_SESSION: {
    compatibility: {
      getAcknowledgement: () => null,
      setAcknowledgement: () => {},
      clearAcknowledgement: () => {},
    },
  },
  $: () => null,
  syncFirmwareThemeFromMenu: () => {},
  syncMenuToCurated: () => {},
};
runtime.clearCatalogDerivedCaches = () => runtime.catalogContextCache.clear();
runtime.markCatalogStateChanged = () => {
  runtime.catalogStateRevision += 1;
  runtime.clearCatalogDerivedCaches();
};

vm.createContext(runtime);
vm.runInContext(readFileSync(new URL('../site/wrt/lib/menuconfig/menuconfig-state.js', import.meta.url), 'utf8'), runtime, {
  filename: 'menuconfig-state.js',
});

const triggerOption = runtime.menuOptionBySymbol.get('TRIGGER');
const targetOption = runtime.menuOptionBySymbol.get('PACKAGE_target-plugin');
runtime.applyCatalogIntent(triggerOption, 'y', false, 'user');
assert(runtime.menuValues.get('PACKAGE_target-plugin') === 'y',
  'the prerequisite did not activate the target through Kconfig select');
assert(!runtime.catalogUserOverrides.has('PACKAGE_target-plugin') &&
  runtime.catalogDependencySymbols.has('PACKAGE_target-plugin'),
  'an automatic select was incorrectly recorded as direct package Intent');

const targetResult = runtime.applyCatalogIntent(targetOption, 'y', false, 'user');
assert(targetResult.changes.length === 0,
  'the target replay fixture did not exercise the no-op direct Intent boundary');
assert(runtime.catalogUserOverrides.get('PACKAGE_target-plugin') === 'y' &&
  !runtime.catalogDependencySymbols.has('PACKAGE_target-plugin') &&
  runtime.menuTouched.has('PACKAGE_target-plugin'),
  'a no-op target replay lost the direct PACKAGE Intent or dependency ownership');
assert(runtime.catalogStateRevision === 2,
  'recording a changed direct Intent without value changes did not invalidate Catalog state');

console.log('menuconfig prerequisite direct-Intent replay passed');
