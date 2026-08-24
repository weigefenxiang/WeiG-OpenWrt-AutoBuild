#!/usr/bin/env node
import {
  allowedKconfigStates,
  applyUserIntent,
  compatibilityAcknowledgementKey,
  createCatalogModel,
  createCatalogValidationContext,
  deriveCompatibilityPlans,
  deriveKconfigPrerequisitePlans,
  evaluateCompatibilityRules,
  evaluateExpressionState,
  kconfigStateConstraints,
  normalizeCompatibilityDocument,
  parseConfigDocument,
  normalizeKconfigStateValue,
  orderCatalogIndex,
  resolveKconfigDefault,
  preferredCatalogTarget,
  reconcileKconfigDerivedValues,
  resolveCatalogUserOverride,
  resolveEffectiveTheme,
  selectableKconfigStates,
  validateConfig,
} from '../site/wrt/lib/catalog-engine.js';
import { safeCatalogDataRef } from '../site/wrt/lib/catalog-loader.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function expectThrow(fn, pattern, message) {
  let thrown = null;
  try { fn(); } catch (error) { thrown = error; }
  assert(thrown && pattern.test(String(thrown.message || thrown)), message);
}

const overrideMutationCases = [
  { inherited: 'n', requested: 'y', expected: 'y', label: 'bool enable' },
  { inherited: 'n', requested: 'n', expected: null, label: 'bool cancel' },
  { inherited: 'y', requested: 'n', expected: 'n', label: 'bool exclude' },
  { inherited: 'y', requested: 'y', expected: null, label: 'bool restore' },
  { inherited: 'm', requested: 'y', expected: 'y', label: 'tristate change' },
  { inherited: 'm', requested: 'm', expected: null, label: 'tristate restore' },
  { inherited: '', requested: '', expected: null, label: 'empty string restore' },
  { inherited: '', requested: 'n', expected: 'n', label: 'literal string n' },
  { inherited: 'a"b', requested: 'a"b', expected: null, label: 'escaped string restore' },
  { inherited: 16, requested: '16', expected: null, label: 'integer restore' },
  { inherited: '0x10', requested: '0x20', expected: '0x20', label: 'hex change' },
];
for (const sample of overrideMutationCases) {
  assert(resolveCatalogUserOverride(sample.inherited, sample.requested) === sample.expected,
    `Catalog user override mutation failed: ${sample.label}`);
}

const targetFull = {
  board: 'demo',
  subtarget: 'full',
  name: 'Demo Full',
  arch: 'ARCH_DEMO',
  archPackages: 'demo_arch',
  features: ['bus'],
  packages: ['profile-driver'],
  contract: { boardSelector: 'TARGET_demo', targetSelector: 'TARGET_demo_full' },
  profiles: [{
    id: 'DEVICE_alpha',
    selector: 'TARGET_demo_full_DEVICE_alpha',
    targetSelector: 'TARGET_demo_full',
    boardSelector: 'TARGET_demo',
    packages: ['profile-driver'],
  }],
};
const targetLite = {
  board: 'demo',
  subtarget: 'lite',
  name: 'Demo Lite',
  arch: 'ARCH_DEMO',
  archPackages: 'demo_arch',
  features: [],
  packages: [],
  contract: { boardSelector: 'TARGET_demo', targetSelector: 'TARGET_demo_lite' },
  profiles: [{
    id: 'DEVICE_beta',
    selector: 'TARGET_demo_lite_DEVICE_beta',
    targetSelector: 'TARGET_demo_lite',
    boardSelector: 'TARGET_demo',
    packages: [],
  }],
};
const records = [
  { kind: 'config', configSymbol: 'USE_APK', kconfigSymbol: 'USE_APK', states: ['n', 'y'],
    defaults: ['y'], hidden: true, visible: false, userSettable: false },
  { kind: 'config', configSymbol: 'ARCH_DEMO', kconfigSymbol: 'ARCH_DEMO', states: ['n', 'y'], hidden: true, visible: false },
  { kind: 'config', configSymbol: 'BUS_SUPPORT', kconfigSymbol: 'BUS_SUPPORT', states: ['n', 'y'], hidden: true, visible: false },
  { kind: 'package', package: 'profile-driver', configSymbol: 'PACKAGE_profile-driver', kconfigSymbol: 'PACKAGE_profile-driver', states: ['n', 'm', 'y'],
    kconfig: { dependsExpressions: [['TARGET_demo_full && UNPUBLISHED_DEFAULT']] } },
  { kind: 'package', package: 'optional-driver', configSymbol: 'PACKAGE_optional-driver', kconfigSymbol: 'PACKAGE_optional-driver', states: ['n', 'm', 'y'],
    kconfig: { dependsExpressions: [['TARGET_demo_full && BUS_SUPPORT']] } },
  { kind: 'package', package: 'recommended-service', configSymbol: 'PACKAGE_recommended-service', kconfigSymbol: 'PACKAGE_recommended-service', states: ['n', 'y'],
    kconfig: { dependsExpressions: [['TARGET_demo_full && UNPUBLISHED_DEFAULT']] } },
  { kind: 'package', package: 'core-service', configSymbol: 'PACKAGE_core-service', kconfigSymbol: 'PACKAGE_core-service', states: ['n', 'm', 'y'] },
  { kind: 'package', package: 'ui-service', configSymbol: 'PACKAGE_ui-service', kconfigSymbol: 'PACKAGE_ui-service', states: ['n', 'm', 'y'],
    packageInfo: { depends: [{ raw: '+core-service', required: true, packages: ['core-service'] }] } },
  { kind: 'package', package: 'i18n-service', configSymbol: 'PACKAGE_i18n-service', kconfigSymbol: 'PACKAGE_i18n-service', states: ['n', 'm', 'y'], hidden: true, visible: false, userSettable: false,
    defaults: ['LANGUAGE_SWITCH||(EVERYTHING&&m)'],
    kconfig: { dependsExpressions: [['PACKAGE_ui-service']] },
    packageInfo: { depends: [{ raw: '+ui-service', required: true, packages: ['ui-service'] }] } },
  { kind: 'package', package: 'flow-core', configSymbol: 'PACKAGE_flow-core', kconfigSymbol: 'PACKAGE_flow-core', states: ['n', 'm', 'y'] },
  { kind: 'package', package: 'flow-offload', configSymbol: 'PACKAGE_flow-offload', kconfigSymbol: 'PACKAGE_flow-offload', states: ['n', 'm', 'y'],
    kconfig: { dependsExpressions: [['PACKAGE_flow-core && (TARGET_demo_full || TARGET_demo_lite)']] } },
  { kind: 'package', package: 'flow-monitor', configSymbol: 'PACKAGE_flow-monitor', kconfigSymbol: 'PACKAGE_flow-monitor', states: ['n', 'm', 'y'],
    kconfig: { dependsExpressions: [['PACKAGE_flow-core']] } },
  { kind: 'config', configSymbol: 'SOFT_HINT', kconfigSymbol: 'SOFT_HINT', states: ['n', 'y'] },
  { kind: 'config', configSymbol: 'LANGUAGE_SWITCH', kconfigSymbol: 'LANGUAGE_SWITCH', states: ['n', 'm', 'y'] },
  { kind: 'config', configSymbol: 'EVERYTHING', kconfigSymbol: 'EVERYTHING', states: ['n', 'y'] },
  { kind: 'config', configSymbol: 'DEFAULT_FALLBACK', kconfigSymbol: 'DEFAULT_FALLBACK', states: ['n', 'm', 'y'],
    defaults: ['y if ABSENT_DEFAULT_SWITCH', 'LANGUAGE_SWITCH||(EVERYTHING&&m)',
      'y if ABSENT_COMPARE = absent_literal', 'y if ABSENT_COUNT = 4', 'y if ABSENT_LABEL = "quoted value"'],
    hidden: true, visible: false },
  { kind: 'config', configSymbol: 'DEFERRED_FALLBACK', kconfigSymbol: 'DEFERRED_FALLBACK', states: ['n', 'y'],
    defaults: ['y if UNPUBLISHED_DEFAULT', 'n'], hidden: true, visible: false },
  { kind: 'config', configSymbol: 'SCALAR_FALLBACK', kconfigSymbol: 'SCALAR_FALLBACK', type: 'string', states: [],
    defaults: ['"literal if text" if SCALAR_MISSING'], hidden: true, visible: false },
  { kind: 'package', package: 'imply-source', configSymbol: 'PACKAGE_imply-source', kconfigSymbol: 'PACKAGE_imply-source', states: ['n', 'y'],
    kconfig: { impliesExpressions: [['SOFT_HINT']] } },
  { kind: 'package', package: 'unrelated-tool', configSymbol: 'PACKAGE_unrelated-tool', kconfigSymbol: 'PACKAGE_unrelated-tool', states: ['n', 'm', 'y'] },
  { kind: 'package', package: 'provider-a', configSymbol: 'PACKAGE_provider-a', kconfigSymbol: 'PACKAGE_provider-a', states: ['n', 'm', 'y'], provides: ['virtual-api'] },
  { kind: 'package', package: 'consumer', configSymbol: 'PACKAGE_consumer', kconfigSymbol: 'PACKAGE_consumer', states: ['n', 'm', 'y'],
    packageInfo: { depends: [{ raw: '+virtual-api', required: true, packages: ['virtual-api'] }] } },
  { kind: 'package', package: 'backend-a', configSymbol: 'PACKAGE_backend-a', kconfigSymbol: 'PACKAGE_backend-a', states: ['n', 'y'], conflicts: ['backend-b'] },
  { kind: 'package', package: 'backend-b', configSymbol: 'PACKAGE_backend-b', kconfigSymbol: 'PACKAGE_backend-b', states: ['n', 'y'] },
  { kind: 'config', configSymbol: 'FORMAT_A', kconfigSymbol: 'FORMAT_A', states: ['n', 'y'], choice: 'choice-format' },
  { kind: 'config', configSymbol: 'FORMAT_B', kconfigSymbol: 'FORMAT_B', states: ['n', 'y'], choice: 'choice-format' },
];
const catalog = {
  schema: 5,
  targets: [targetFull, targetLite],
  relations: {
    schema: 2,
    records,
    indexes: {
      providers: { 'virtual-api': ['provider-a'] },
      choices: { 'choice-format': ['FORMAT_A', 'FORMAT_B'] },
      reverseKconfig: {
        'PACKAGE_flow-core': ['PACKAGE_flow-offload', 'PACKAGE_flow-monitor'],
      },
      reverseDependencies: {
        'core-service': ['ui-service'],
        'ui-service': ['i18n-service'],
        'virtual-api': ['consumer'],
      },
    },
  },
};
const model = createCatalogModel(catalog);
const compactModel = createCatalogModel({
  schema: 6,
  targets: [],
  relations: {
    schema: 3,
    flags: { visible: 1, userSettable: 2, canDisable: 4, hasKconfig: 8, package: 16 },
    types: ['', 'bool', 'tristate', 'string', 'int', 'hex'],
    origins: ['', 'kconfig-only', 'kconfig+packageinfo', 'hidden-kconfig-only',
      'hidden-kconfig+packageinfo', 'packageinfo-only'],
    strings: ['PACKAGE_compact-addon'], expressions: [], stringLists: [[]],
    expressionLists: [[]], expressionVariants: [[]], defaults: [[]], packageDependencies: [[]],
    records: [[0, 31, 2, 2, 7, -1, 0, 0, 0, 0, 0, 0, 0]],
    indexes: { providers: [], reverseDependencies: [], reverseKconfig: [], choices: [] },
  },
});
assert(compactModel.byPackage.get('compact-addon')?.configSymbol === 'PACKAGE_compact-addon' &&
  compactModel.bySymbol.get('PACKAGE_compact-addon')?.states.join(',') === 'n,m,y',
  'compact relations schema 3 was not decoded into the canonical engine model');
const selectedTarget = {
  system: targetFull.board,
  board: targetFull.board,
  subtarget: targetFull.subtarget,
  arch: targetFull.arch,
  archPackages: targetFull.archPackages,
  features: targetFull.features,
  packages: targetFull.packages,
  boardSelector: targetFull.contract.boardSelector,
  targetSelector: targetFull.contract.targetSelector,
  profileSelector: targetFull.profiles[0].selector,
  profileSymbol: targetFull.profiles[0].id,
  profile: 'alpha',
  profilePackages: targetFull.profiles[0].packages,
  rawTarget: targetFull,
  rawProfile: targetFull.profiles[0],
};
const wrongTarget = {
  system: targetLite.board,
  board: targetLite.board,
  subtarget: targetLite.subtarget,
  arch: targetLite.arch,
  archPackages: targetLite.archPackages,
  features: targetLite.features,
  packages: targetLite.packages,
  boardSelector: targetLite.contract.boardSelector,
  targetSelector: targetLite.contract.targetSelector,
  profileSelector: targetLite.profiles[0].selector,
  profileSymbol: targetLite.profiles[0].id,
  profile: 'beta',
  profilePackages: targetLite.profiles[0].packages,
  rawTarget: targetLite,
  rawProfile: targetLite.profiles[0],
};

assert(evaluateExpressionState('TARGET_demo_full', new Map(), { contextComplete: false }).status === 'deferred',
  'missing target was not deferred before context completion');
assert(evaluateExpressionState('TARGET_demo_full', new Map(), { contextComplete: true }).status === 'unsatisfied',
  'missing target was not closed after context completion');
assert(evaluateExpressionState('UNPUBLISHED_DEFAULT', new Map(), { contextComplete: true }).status === 'deferred',
  'missing hidden default was not deferred');
assert(evaluateExpressionState('PACKAGE_missing', new Map(), { contextComplete: false }).status === 'unsatisfied',
  'missing package was not a closed-world disabled value');

const defaultValues = new Map([['ON', 'y'], ['MODULE', 'm'], ['OFF', 'n']]);
const expressionDefaults = [
  ['y', 'y', 'y'],
  ['n', 'n', 'n'],
  ['MODULE', 'y', 'm'],
  ['ON && MODULE', 'y', 'm'],
  ['OFF || MODULE', 'y', 'm'],
  ['(OFF || ON) && MODULE', 'y', 'm'],
];
for (const visible of [true, false]) {
  for (const [expression, boolExpected, tristateExpected] of expressionDefaults) {
    for (const [type, expected] of [['bool', boolExpected], ['tristate', tristateExpected]]) {
      const states = type === 'bool' ? ['n', 'y'] : ['n', 'm', 'y'];
      const result = resolveKconfigDefault({ type, states, defaults: [expression], visible }, defaultValues);
      assert(result.status === 'resolved' && result.value === expected,
        `${type} ${visible ? 'visible' : 'hidden'} default expression ${expression} did not resolve to ${expected}`);
    }
  }
}
const conditionalFallback = resolveKconfigDefault({
  type: 'tristate', states: ['n', 'm', 'y'], defaults: ['y if OFF', 'm if ON', 'n'],
}, defaultValues);
assert(conditionalFallback.status === 'resolved' && conditionalFallback.value === 'm',
  'an unsatisfied conditional default did not continue in Kconfig declaration order');
const topLevelConditional = resolveKconfigDefault({
  type: 'bool', states: ['n', 'y'], defaults: ['ON || OFF if MODULE'],
}, defaultValues);
assert(topLevelConditional.status === 'resolved' && topLevelConditional.value === 'y',
  'a top-level conditional bool expression was not split and evaluated');
for (const defaults of [['y if DEFERRED_DEFAULT', 'n'], ['DEFERRED_DEFAULT', 'y']]) {
  const deferred = resolveKconfigDefault({ type: 'bool', states: ['n', 'y'], defaults }, defaultValues);
  assert(deferred.status === 'deferred' && deferred.value === 'n',
    'a deferred earlier default was incorrectly bypassed by a later fallback');
}
assert(allowedKconfigStates({ type: 'bool', states: ['n', 'm', 'y', 'invalid'] }).join(',') === 'n,y' &&
  allowedKconfigStates({ type: 'tristate', states: ['invalid', 'y', 'n', 'm'] }).join(',') === 'n,m,y',
  'declared states were not intersected with the Kconfig type state boundary');
assert(normalizeKconfigStateValue({ type: 'bool', states: ['n', 'y'] }, 'ON && MODULE') === 'n' &&
  normalizeKconfigStateValue({ type: 'tristate', states: ['n', 'm', 'y'] }, 'm') === 'm',
  'illegal expression text crossed the rendered/serialized N/M/Y state boundary');
const stateBoundaryRecords = [
  { kind: 'config', configSymbol: 'MODULE_GATE', kconfigSymbol: 'MODULE_GATE',
    type: 'tristate', states: ['n', 'm', 'y'] },
  { kind: 'config', configSymbol: 'BOOL_CHILD', kconfigSymbol: 'BOOL_CHILD',
    type: 'bool', states: ['n', 'y'], kconfig: { dependsExpressions: [['MODULE_GATE']] } },
  { kind: 'config', configSymbol: 'TRISTATE_CHILD', kconfigSymbol: 'TRISTATE_CHILD',
    type: 'tristate', states: ['n', 'm', 'y'], kconfig: { dependsExpressions: [['MODULE_GATE']] } },
  { kind: 'config', configSymbol: 'LOCKED_BOOL', kconfigSymbol: 'LOCKED_BOOL',
    type: 'bool', states: ['n', 'y'], canDisable: false },
  { kind: 'config', configSymbol: 'HIDDEN_BOOL', kconfigSymbol: 'HIDDEN_BOOL',
    type: 'bool', states: ['n', 'y'], userSettable: false },
];
const stateBoundaryModel = createCatalogModel({
  schema: 5, targets: [], relations: { schema: 2, records: stateBoundaryRecords, indexes: {} },
});
for (const [gate, boolStates, tristateStates] of [
  ['n', 'n', 'n'], ['m', 'n,y', 'n,m'], ['y', 'n,y', 'n,m,y'],
]) {
  const values = new Map([['MODULE_GATE', gate]]);
  assert(selectableKconfigStates(stateBoundaryModel.bySymbol.get('BOOL_CHILD'), values).join(',') === boolStates,
    `bool selectable states did not follow native Kconfig dependency coercion for ${gate}`);
  assert(selectableKconfigStates(stateBoundaryModel.bySymbol.get('TRISTATE_CHILD'), values).join(',') === tristateStates,
    `tristate selectable states did not follow the dependency ceiling for ${gate}`);
}
assert(selectableKconfigStates(stateBoundaryModel.bySymbol.get('LOCKED_BOOL'), new Map()).join(',') === 'y',
  'a non-disableable Kconfig state exposed N as a selectable value');
assert(selectableKconfigStates(stateBoundaryModel.bySymbol.get('HIDDEN_BOOL'), new Map()).join(',') === '',
  'a hidden Kconfig state was exposed for direct mutation');
expectThrow(() => applyUserIntent(stateBoundaryModel, new Map([['HIDDEN_BOOL', 'y']]), {
  symbol: 'HIDDEN_BOOL', value: 'n',
}), /active Kconfig constraints/, 'a no-prompt Kconfig symbol accepted a direct disable intent');
const hiddenSystemUpdate = applyUserIntent(stateBoundaryModel, new Map([['HIDDEN_BOOL', 'y']]), {
  symbol: 'HIDDEN_BOOL', value: 'n', force: true,
});
assert(hiddenSystemUpdate.values.get('HIDDEN_BOOL') === 'n',
  'a derived/import restore could not update a no-prompt Kconfig symbol');
assert(!validateConfig(stateBoundaryModel, new Map([
  ['MODULE_GATE', 'm'], ['BOOL_CHILD', 'y'], ['TRISTATE_CHILD', 'm'], ['LOCKED_BOOL', 'y'], ['HIDDEN_BOOL', 'n'],
])).some((row) => row.symbol === 'BOOL_CHILD'),
'a bool depending on m was rejected instead of receiving Kconfig\'s m-to-y dependency coercion');

const selectRecords = [
  { kind: 'config', configSymbol: 'SELECT_M', kconfigSymbol: 'SELECT_M', type: 'tristate',
    states: ['n', 'm', 'y'], kconfig: { selectsExpressions: [['TARGET_TRI', 'TARGET_BOOL']] } },
  { kind: 'config', configSymbol: 'SELECT_Y', kconfigSymbol: 'SELECT_Y', type: 'bool',
    states: ['n', 'y'], kconfig: { selectsExpressions: [['TARGET_TRI']] } },
  { kind: 'config', configSymbol: 'SELECT_CONDITIONAL', kconfigSymbol: 'SELECT_CONDITIONAL', type: 'bool',
    states: ['n', 'y'], kconfig: { selectsExpressions: [['TARGET_CONDITIONAL if CONDITION']] } },
  { kind: 'config', configSymbol: 'CONDITION', kconfigSymbol: 'CONDITION', type: 'tristate',
    states: ['n', 'm', 'y'] },
  { kind: 'config', configSymbol: 'MODULE_CEILING', kconfigSymbol: 'MODULE_CEILING', type: 'tristate',
    states: ['n', 'm', 'y'] },
  { kind: 'config', configSymbol: 'TARGET_TRI', kconfigSymbol: 'TARGET_TRI', type: 'tristate',
    states: ['n', 'm', 'y'] },
  { kind: 'config', configSymbol: 'TARGET_BOOL', kconfigSymbol: 'TARGET_BOOL', type: 'bool',
    states: ['n', 'y'] },
  { kind: 'config', configSymbol: 'TARGET_CONDITIONAL', kconfigSymbol: 'TARGET_CONDITIONAL', type: 'tristate',
    states: ['n', 'm', 'y'] },
  { kind: 'config', configSymbol: 'TARGET_FIXED_M', kconfigSymbol: 'TARGET_FIXED_M', type: 'tristate',
    states: ['n', 'm', 'y'], kconfig: { dependsExpressions: [['MODULE_CEILING']] } },
  { kind: 'config', configSymbol: 'SELECT_FIXED_M', kconfigSymbol: 'SELECT_FIXED_M', type: 'tristate',
    states: ['n', 'm', 'y'], kconfig: { selectsExpressions: [['TARGET_FIXED_M']] } },
];
const selectModel = createCatalogModel({
  schema: 5, targets: [], relations: {
    schema: 2,
    records: selectRecords,
    indexes: { reverseKconfig: {
      // reverseKconfig is deliberately unrelated: it indexes ordinary
      // dependencies, not reverse-select ownership.
      TARGET_TRI: ['MODULE_CEILING'],
    } },
  },
});
assert(selectModel.reverseSelects.get('TARGET_TRI')?.join(',') === 'SELECT_M,SELECT_Y' &&
  !selectModel.reverseSelects.get('TARGET_TRI')?.includes('MODULE_CEILING'),
  'runtime select lookup was not derived from canonical selectsExpressions');
const selectMValues = new Map([['SELECT_M', 'm'], ['TARGET_TRI', 'm'], ['TARGET_BOOL', 'y']]);
const targetTriM = kconfigStateConstraints(selectModel, selectModel.bySymbol.get('TARGET_TRI'), selectMValues);
assert(targetTriM.minimum === 'm' && targetTriM.maximum === 'y' &&
  targetTriM.selectableStates.join(',') === 'm,y' && targetTriM.selectors[0]?.sourceSymbol === 'SELECT_M',
  'tristate select m did not expose the native {M}/Y boundary');
const targetBoolM = kconfigStateConstraints(selectModel, selectModel.bySymbol.get('TARGET_BOOL'), selectMValues);
assert(targetBoolM.minimum === 'y' && targetBoolM.selectableStates.length === 0 &&
  targetBoolM.states.find((row) => row.value === 'y')?.locked,
  'a tristate m selector did not coerce a bool target to locked Y');
expectThrow(() => applyUserIntent(selectModel, selectMValues, { symbol: 'TARGET_TRI', value: 'n' }),
  /active Kconfig constraints/, 'an active select m lower bound accepted N');
const raisedTarget = applyUserIntent(selectModel, selectMValues, { symbol: 'TARGET_TRI', value: 'y' });
assert(raisedTarget.values.get('TARGET_TRI') === 'y', 'a target with select m could not be raised to Y');

// A reverse select whose target has dir_dep=N is suppressed by the native
// Kconfig resolver: the selector/root succeeds, while the target remains N.
// A direct user request for that target still obeys its own dependency.
const selectDependencyRecords = [
  { kind: 'config', configSymbol: 'SELECTOR_ROOT', kconfigSymbol: 'SELECTOR_ROOT',
    type: 'bool', states: ['n', 'y'],
    kconfig: { selectsExpressions: [['PACKAGE_oscam']] } },
  { kind: 'package', package: 'oscam', configSymbol: 'PACKAGE_oscam',
    kconfigSymbol: 'PACKAGE_oscam', type: 'bool', states: ['n', 'y'],
    kconfig: { selectsExpressions: [['PACKAGE_selected-target']] } },
  { kind: 'config', configSymbol: 'BUILTIN_GATE', kconfigSymbol: 'BUILTIN_GATE',
    type: 'bool', states: ['n', 'y'] },
  { kind: 'package', package: 'selected-target', configSymbol: 'PACKAGE_selected-target',
    kconfigSymbol: 'PACKAGE_selected-target', type: 'bool', states: ['n', 'y'],
    kconfig: { dependsExpressions: [['!BUILTIN_GATE']] } },
  { kind: 'package', package: 'selected-downstream', configSymbol: 'PACKAGE_selected-downstream',
    kconfigSymbol: 'PACKAGE_selected-downstream', type: 'bool', states: ['n', 'y'],
    kconfig: { dependsExpressions: [['PACKAGE_selected-target']] } },
];
const selectDependencyModel = createCatalogModel({
  schema: 5, targets: [], relations: {
    schema: 2, records: selectDependencyRecords,
    indexes: { reverseKconfig: { 'PACKAGE_selected-target': ['PACKAGE_selected-downstream'] } },
  },
});
const selectDependencyValues = new Map([
  ['SELECTOR_ROOT', 'n'], ['BUILTIN_GATE', 'y'],
  ['PACKAGE_oscam', 'n'],
  ['PACKAGE_selected-target', 'n'],
  ['PACKAGE_selected-downstream', 'n'],
]);
const selectedByRoot = applyUserIntent(selectDependencyModel,
  selectDependencyValues, { symbol: 'SELECTOR_ROOT', value: 'y' });
assert(selectedByRoot.values.get('SELECTOR_ROOT') === 'y' &&
  selectedByRoot.values.get('PACKAGE_oscam') === 'y' &&
  selectedByRoot.values.get('PACKAGE_selected-target') === 'n' &&
  validateConfig(selectDependencyModel, selectedByRoot.values).length === 0,
  'a select with dir_dep=N did not preserve the selector while suppressing the target');
const suppressedDiagnostic = selectedByRoot.diagnostics.find((item) =>
  item.code === 'kconfig-select-suppressed' && item.target === 'PACKAGE_selected-target');
assert(suppressedDiagnostic?.symbol === 'PACKAGE_selected-target' &&
  suppressedDiagnostic.dependencyMaximum === 0 && suppressedDiagnostic.blocking === false &&
  suppressedDiagnostic.selectedBy?.some((selector) => selector.sourceSymbol === 'PACKAGE_oscam'),
  'a suppressed reverse select did not retain non-blocking provenance diagnostics');
const suppressedTargetConstraints = kconfigStateConstraints(
  selectDependencyModel,
  selectDependencyModel.bySymbol.get('PACKAGE_selected-target'),
  selectedByRoot.values,
);
assert(suppressedTargetConstraints.minimum === 'n' && suppressedTargetConstraints.maximum === 'n' &&
  suppressedTargetConstraints.selectors.length === 0 &&
  suppressedTargetConstraints.selectableStates.join(',') === 'n',
  'a suppressed reverse select exposed the target as an active selectable state');
expectThrow(() => applyUserIntent(selectDependencyModel,
  selectDependencyValues, { symbol: 'PACKAGE_selected-target', value: 'y' }),
  /requires !BUILTIN_GATE/,
  'direct selection of a target with an unsatisfied dependency bypassed its own Kconfig constraint');
expectThrow(() => applyUserIntent(selectDependencyModel,
  selectedByRoot.values, { symbol: 'PACKAGE_selected-target', value: 'y' }),
  /requires !BUILTIN_GATE/,
  'direct selection remained unblocked while an active reverse selector suppressed the target');
const directSelectedWithRoot = new Map(selectDependencyValues)
  .set('SELECTOR_ROOT', 'y').set('PACKAGE_oscam', 'y').set('PACKAGE_selected-target', 'y');
expectThrow(() => applyUserIntent(selectDependencyModel,
  directSelectedWithRoot, { symbol: 'PACKAGE_selected-target', value: 'y' }),
  /requires !BUILTIN_GATE/,
  'a selected target with an unsatisfied dependency was incorrectly accepted as a direct intent');
const dependencyRepaired = applyUserIntent(selectDependencyModel,
  selectedByRoot.values, { symbol: 'BUILTIN_GATE', value: 'n' });
assert(dependencyRepaired.values.get('PACKAGE_oscam') === 'y' &&
  dependencyRepaired.values.get('PACKAGE_selected-target') === 'y' &&
  !dependencyRepaired.diagnostics.some((item) => item.target === 'PACKAGE_selected-target') &&
  validateConfig(selectDependencyModel, dependencyRepaired.values).length === 0,
  'an active select did not resume when the target direct dependency became satisfiable');
const reconciledSuppressed = reconcileKconfigDerivedValues(selectDependencyModel,
  selectedByRoot.values);
assert(reconciledSuppressed.diagnostics.some((item) =>
  item.code === 'kconfig-select-suppressed' && item.target === 'PACKAGE_selected-target'),
  'derived-value reconciliation did not expose suppressed select provenance');
const selectedDownstream = applyUserIntent(selectDependencyModel,
  dependencyRepaired.values, { symbol: 'PACKAGE_selected-downstream', value: 'y' });
assert(selectedDownstream.values.get('PACKAGE_selected-downstream') === 'y' &&
  validateConfig(selectDependencyModel, selectedDownstream.values).length === 0,
  'a dependent of a re-enabled selected target could not be enabled');
const dependencyDisabled = applyUserIntent(selectDependencyModel,
  selectedDownstream.values, { symbol: 'BUILTIN_GATE', value: 'y' });
assert(dependencyDisabled.values.get('SELECTOR_ROOT') === 'y' &&
  dependencyDisabled.values.get('PACKAGE_oscam') === 'y' &&
  dependencyDisabled.values.get('PACKAGE_selected-target') === 'n' &&
  dependencyDisabled.values.get('PACKAGE_selected-downstream') === 'n' &&
  dependencyDisabled.diagnostics.some((item) =>
    item.code === 'kconfig-select-suppressed' && item.target === 'PACKAGE_selected-target') &&
  validateConfig(selectDependencyModel, dependencyDisabled.values).length === 0,
  'a select target was not lowered to N when its direct dependency became N');
const dependencyReenabled = applyUserIntent(selectDependencyModel,
  dependencyDisabled.values, { symbol: 'BUILTIN_GATE', value: 'n' });
assert(dependencyReenabled.values.get('SELECTOR_ROOT') === 'y' &&
  dependencyReenabled.values.get('PACKAGE_oscam') === 'y' &&
  dependencyReenabled.values.get('PACKAGE_selected-target') === 'y' &&
  dependencyReenabled.values.get('PACKAGE_selected-downstream') === 'n' &&
  !dependencyReenabled.diagnostics.some((item) => item.target === 'PACKAGE_selected-target') &&
  validateConfig(selectDependencyModel, dependencyReenabled.values).length === 0,
  'a suppressed select target did not re-enable after its direct dependency recovered');

// A non-zero tristate dependency ceiling does not suppress a Y select.  The
// target is kept at Y and the resulting dependency overflow is diagnostic,
// not a blocker for the selector intent.
const partialSelectModel = createCatalogModel({ schema: 5, targets: [], relations: {
  schema: 2, records: [
    { kind: 'config', configSymbol: 'SELECTOR_PARTIAL', kconfigSymbol: 'SELECTOR_PARTIAL',
      type: 'bool', states: ['n', 'y'],
      kconfig: { selectsExpressions: [['TARGET_PARTIAL']] } },
    { kind: 'config', configSymbol: 'PARTIAL_GATE', kconfigSymbol: 'PARTIAL_GATE',
      type: 'tristate', states: ['n', 'm', 'y'] },
    { kind: 'config', configSymbol: 'TARGET_PARTIAL', kconfigSymbol: 'TARGET_PARTIAL',
      type: 'tristate', states: ['n', 'm', 'y'],
      kconfig: { dependsExpressions: [['PARTIAL_GATE']] } },
  ], indexes: {},
} });
const partialSelectValues = new Map([
  ['SELECTOR_PARTIAL', 'n'], ['PARTIAL_GATE', 'm'], ['TARGET_PARTIAL', 'n'],
]);
const selectedWithPartialDependency = applyUserIntent(partialSelectModel,
  partialSelectValues, { symbol: 'SELECTOR_PARTIAL', value: 'y' });
const partialWarning = selectedWithPartialDependency.violations.find((item) =>
  item.code === 'kconfig-select-warning' && item.symbol === 'TARGET_PARTIAL');
assert(selectedWithPartialDependency.values.get('SELECTOR_PARTIAL') === 'y' &&
  selectedWithPartialDependency.values.get('TARGET_PARTIAL') === 'y' &&
  partialWarning?.maximum === 1 &&
  partialWarning.selectedBy?.some((selector) => selector.sourceSymbol === 'SELECTOR_PARTIAL') &&
  !validateConfig(partialSelectModel, selectedWithPartialDependency.values)
    .some((item) => item.code === 'kconfig-dependency-unsatisfied'),
  'a Y select above a non-zero tristate dependency ceiling was incorrectly blocked');
expectThrow(() => applyUserIntent(partialSelectModel, partialSelectValues,
  { symbol: 'TARGET_PARTIAL', value: 'y' }),
  /requires PARTIAL_GATE/,
  'direct target selection without a selector bypassed a tristate dependency ceiling');

const noDowngrade = applyUserIntent(selectModel,
  new Map([['SELECT_Y', 'y'], ['TARGET_TRI', 'y'], ['SELECT_M', 'n']]),
  { symbol: 'SELECT_M', value: 'm' });
assert(noDowngrade.values.get('TARGET_TRI') === 'y',
  'a later select m incorrectly downgraded an existing Y target');
const conditionalValues = new Map([
  ['SELECT_CONDITIONAL', 'y'], ['CONDITION', 'm'], ['TARGET_CONDITIONAL', 'm'],
]);
const conditional = kconfigStateConstraints(selectModel,
  selectModel.bySymbol.get('TARGET_CONDITIONAL'), conditionalValues);
assert(conditional.minimum === 'm' && conditional.selectableStates.join(',') === 'm,y' &&
  conditional.selectors[0]?.condition === 'CONDITION',
  'conditional select did not use min(selector, condition)');
const conditionalActivated = applyUserIntent(selectModel,
  new Map([['SELECT_CONDITIONAL', 'y'], ['CONDITION', 'n'], ['TARGET_CONDITIONAL', 'n']]),
  { symbol: 'CONDITION', value: 'm' });
assert(conditionalActivated.values.get('TARGET_CONDITIONAL') === 'm',
  'changing only a select condition did not activate its M lower bound');
const conditionalDisabled = applyUserIntent(selectModel, conditionalActivated.values,
  { symbol: 'CONDITION', value: 'n', dependencySymbols: new Set(['TARGET_CONDITIONAL']),
    preferredValues: new Map([['TARGET_CONDITIONAL', 'n']]) });
assert(conditionalDisabled.values.get('TARGET_CONDITIONAL') === 'n',
  'disabling a select condition did not restore the target base intent');
const conditionalReactivated = applyUserIntent(selectModel, conditionalDisabled.values,
  { symbol: 'CONDITION', value: 'y' });
assert(conditionalReactivated.values.get('TARGET_CONDITIONAL') === 'y',
  'a select condition could not reactivate after its automatic N state was pruned');
const fixedMValues = new Map([
  ['MODULE_CEILING', 'm'], ['SELECT_FIXED_M', 'm'], ['TARGET_FIXED_M', 'm'],
]);
const fixedM = kconfigStateConstraints(selectModel, selectModel.bySymbol.get('TARGET_FIXED_M'), fixedMValues);
assert(fixedM.minimum === 'm' && fixedM.maximum === 'm' && fixedM.selectableStates.length === 0 &&
  fixedM.states.find((row) => row.value === 'm')?.locked,
  'a fixed M Kconfig state was not rendered as read-only');
const menuFacadeValues = new Map([['SELECT_Y', 'y'], ['TARGET_TRI', 'y']]);
const menuFacade = kconfigStateConstraints(selectModel,
  { symbol: 'TARGET_TRI', type: 'tristate', userSettable: true }, menuFacadeValues);
assert(menuFacade.symbol === 'TARGET_TRI' && menuFacade.current === 'y' && menuFacade.minimum === 'y' &&
  menuFacade.states.find((row) => row.value === 'y')?.current,
  'a menu-shard facade without configSymbol did not resolve its canonical Catalog state');

const raisedBySelect = applyUserIntent(selectModel,
  new Map([['SELECT_Y', 'n'], ['TARGET_TRI', 'n']]),
  { symbol: 'SELECT_Y', value: 'y', dependencySymbols: new Set(['TARGET_TRI']),
    preferredValues: new Map([['TARGET_TRI', 'n']]) });
assert(raisedBySelect.values.get('SELECT_Y') === 'y' && raisedBySelect.values.get('TARGET_TRI') === 'y',
  'select Y did not raise its target to the mandatory Y lower bound');
expectThrow(() => applyUserIntent(selectModel, raisedBySelect.values,
  { symbol: 'TARGET_TRI', value: 'm' }), /active Kconfig constraints/,
  'a selected Y target accepted a reverse downgrade to M');
const selectorLowered = applyUserIntent(selectModel, raisedBySelect.values,
  { symbol: 'SELECT_Y', value: 'n', dependencySymbols: new Set(['TARGET_TRI']),
    preferredValues: new Map([['TARGET_TRI', 'm']]), protectedSymbols: new Set(['TARGET_TRI']) });
assert(selectorLowered.values.get('TARGET_TRI') === 'm' &&
  selectorLowered.changes.some((row) => row.symbol === 'TARGET_TRI' && row.reason === 'preferred-intent'),
  'removing the last selector did not restore the target user intent');
const selectorModule = applyUserIntent(selectModel,
  new Map([['SELECT_M', 'y'], ['TARGET_TRI', 'y']]),
  { symbol: 'SELECT_M', value: 'm', dependencySymbols: new Set(['TARGET_TRI']),
    preferredValues: new Map([['TARGET_TRI', 'n']]) });
assert(selectorModule.values.get('TARGET_TRI') === 'm',
  'lowering a selector from Y to M did not recompute an automatic target to M');
const remainingSelector = applyUserIntent(selectModel,
  new Map([['SELECT_Y', 'y'], ['SELECT_M', 'm'], ['TARGET_TRI', 'y']]),
  { symbol: 'SELECT_Y', value: 'n', dependencySymbols: new Set(['TARGET_TRI']),
    preferredValues: new Map([['TARGET_TRI', 'n']]) });
assert(remainingSelector.values.get('TARGET_TRI') === 'm',
  'removing one of multiple selectors ignored the remaining M lower bound');

// Generic negative-dependency repair: a package may be legal only after a
// negated Kconfig prerequisite is changed.  The planner must discover the
// smallest operation from the expression, replay normal select reconciliation,
// and refuse to cross an explicit user lock.
const prerequisiteRecords = [
  { kind: 'config', configSymbol: 'OPENSSL_ENGINE', kconfigSymbol: 'OPENSSL_ENGINE',
    type: 'bool', states: ['n', 'y'] },
  { kind: 'config', configSymbol: 'OPENSSL_ENGINE_BUILTIN', kconfigSymbol: 'OPENSSL_ENGINE_BUILTIN',
    type: 'bool', states: ['n', 'y'] },
  { kind: 'config', configSymbol: 'SELECT_TARGET', kconfigSymbol: 'SELECT_TARGET',
    type: 'bool', states: ['n', 'y'] },
  { kind: 'package', package: 'generic-devcrypto', configSymbol: 'PACKAGE_generic-devcrypto',
    kconfigSymbol: 'PACKAGE_generic-devcrypto', type: 'bool', states: ['n', 'y'],
    kconfig: {
      dependsExpressions: [['OPENSSL_ENGINE && !OPENSSL_ENGINE_BUILTIN']],
      selectsExpressions: [['SELECT_TARGET']],
    } },
];
const prerequisiteModel = createCatalogModel({
  schema: 5, targets: [], relations: { schema: 2, records: prerequisiteRecords, indexes: {} },
});
const prerequisiteValues = new Map([
  ['OPENSSL_ENGINE', 'y'], ['OPENSSL_ENGINE_BUILTIN', 'y'],
  ['SELECT_TARGET', 'n'], ['PACKAGE_generic-devcrypto', 'n'],
]);
const prerequisiteRecord = prerequisiteModel.bySymbol.get('PACKAGE_generic-devcrypto');
const prerequisitePlan = deriveKconfigPrerequisitePlans(
  prerequisiteModel, prerequisiteValues, prerequisiteRecord, 'y',
);
assert(prerequisitePlan.recommended?.cost === 1 &&
  prerequisitePlan.recommended.steps[0]?.symbol === 'OPENSSL_ENGINE_BUILTIN' &&
  prerequisitePlan.recommended.steps[0]?.value === 'n',
  'negative Kconfig dependency did not produce the unique one-step prerequisite plan');
assert(prerequisitePlan.recommended.values.get('OPENSSL_ENGINE_BUILTIN') === 'n' &&
  prerequisitePlan.recommended.values.get('PACKAGE_generic-devcrypto') === 'y' &&
  prerequisitePlan.recommended.automaticChanges.some((change) =>
    change.symbol === 'SELECT_TARGET' && change.reason === 'select'),
  'prerequisite replay did not preserve direct package intent or separate select changes');
const lockedPrerequisitePlan = deriveKconfigPrerequisitePlans(
  prerequisiteModel, prerequisiteValues, prerequisiteRecord, 'y',
  { explicitSymbols: new Set(['OPENSSL_ENGINE_BUILTIN']) },
);
assert(!lockedPrerequisitePlan.recommended,
  'an explicitly locked Kconfig prerequisite received an automatic repair plan');
expectThrow(() => applyUserIntent(prerequisiteModel, prerequisiteValues, {
  symbol: 'PACKAGE_generic-devcrypto', value: 'y',
  explicitSymbols: new Set(['OPENSSL_ENGINE_BUILTIN']),
}), /requires OPENSSL_ENGINE && !OPENSSL_ENGINE_BUILTIN/,
  'an explicitly locked negative prerequisite did not remain a blocking intent error');
expectThrow(() => applyUserIntent(prerequisiteModel, prerequisiteValues, {
  symbol: 'PACKAGE_generic-devcrypto', value: 'y',
  explicitSymbols: new Map([['OPENSSL_ENGINE_BUILTIN', 'n']]).keys(),
}), /requires OPENSSL_ENGINE && !OPENSSL_ENGINE_BUILTIN/,
  'an iterator-shaped explicit lock was not preserved through prerequisite planning');
const directPrerequisiteIntent = applyUserIntent(prerequisiteModel, new Map([
  ['OPENSSL_ENGINE', 'y'], ['OPENSSL_ENGINE_BUILTIN', 'n'],
  ['SELECT_TARGET', 'n'], ['PACKAGE_generic-devcrypto', 'n'],
]), { symbol: 'PACKAGE_generic-devcrypto', value: 'y' });
assert(directPrerequisiteIntent.values.get('PACKAGE_generic-devcrypto') === 'y' &&
  directPrerequisiteIntent.values.get('SELECT_TARGET') === 'y' &&
  directPrerequisiteIntent.changes.some((change) =>
    change.symbol === 'PACKAGE_generic-devcrypto' && change.reason === 'user'),
  'a legal prerequisite state did not preserve the package direct intent');
const activeSelectValues = new Map([
  ['OPENSSL_ENGINE', 'n'], ['OPENSSL_ENGINE_BUILTIN', 'n'],
  ['SELECT_TARGET', 'n'], ['PACKAGE_generic-devcrypto', 'n'],
]);
const activeSelectModel = createCatalogModel({
  schema: 5, targets: [], relations: {
    schema: 2,
    records: prerequisiteRecords.map((record) => record.configSymbol === 'OPENSSL_ENGINE'
      ? { ...record, kconfig: { selectsExpressions: [['PACKAGE_generic-devcrypto']] } }
      : record),
    indexes: {},
  },
});
const activeSelectPlan = deriveKconfigPrerequisitePlans(
  activeSelectModel, activeSelectValues,
  activeSelectModel.bySymbol.get('PACKAGE_generic-devcrypto'), 'y',
);
assert(activeSelectPlan.recommended?.cost === 1 &&
  activeSelectPlan.recommended.steps[0]?.symbol === 'OPENSSL_ENGINE' &&
  activeSelectPlan.recommended.values.get('PACKAGE_generic-devcrypto') === 'y',
  'a prerequisite select that activates the target was not replayed as an automatic change');

// Equal-cost Kconfig alternatives are deliberately ambiguous.  The planner
// may enumerate both legal one-step repairs, but must not silently choose one
// merely because its symbol sorts first.  This is the positive-dependency
// counterpart to the negative dependency fixture above.
const ambiguousPrerequisiteRecords = [
  { kind: 'config', configSymbol: 'PREREQUISITE_A', kconfigSymbol: 'PREREQUISITE_A',
    type: 'bool', states: ['n', 'y'] },
  { kind: 'config', configSymbol: 'PREREQUISITE_B', kconfigSymbol: 'PREREQUISITE_B',
    type: 'bool', states: ['n', 'y'] },
  { kind: 'package', package: 'ambiguous-target', configSymbol: 'PACKAGE_ambiguous-target',
    kconfigSymbol: 'PACKAGE_ambiguous-target', type: 'bool', states: ['n', 'y'],
    kconfig: { dependsExpressions: [['PREREQUISITE_A'], ['PREREQUISITE_B']] } },
];
const ambiguousPrerequisiteModel = createCatalogModel({
  schema: 5, targets: [], relations: { schema: 2, records: ambiguousPrerequisiteRecords, indexes: {} },
});
const ambiguousPrerequisitePlan = deriveKconfigPrerequisitePlans(
  ambiguousPrerequisiteModel,
  new Map([['PREREQUISITE_A', 'n'], ['PREREQUISITE_B', 'n'], ['PACKAGE_ambiguous-target', 'n']]),
  ambiguousPrerequisiteModel.bySymbol.get('PACKAGE_ambiguous-target'), 'y',
);
assert(ambiguousPrerequisitePlan.candidates.length === 2 &&
  ambiguousPrerequisitePlan.candidates.every((candidate) => candidate.cost === 1) &&
  ambiguousPrerequisitePlan.candidates.every((candidate) => candidate.values.get('PACKAGE_ambiguous-target') === 'y') &&
  ambiguousPrerequisitePlan.recommended === null,
  'equal-cost Kconfig prerequisite alternatives were not preserved as ambiguous');

// A prerequisite may satisfy the target through an active imply.  The imply
// result is automatic; only the prerequisite step is a user action and the
// target remains eligible for the caller to record as a direct Intent.
const implyPrerequisiteRecords = [
  { kind: 'config', configSymbol: 'IMPLY_PREREQUISITE', kconfigSymbol: 'IMPLY_PREREQUISITE',
    type: 'bool', states: ['n', 'y'], kconfig: { impliesExpressions: [['IMPLIED_SUPPORT']] } },
  { kind: 'config', configSymbol: 'IMPLIED_SUPPORT', kconfigSymbol: 'IMPLIED_SUPPORT',
    type: 'bool', states: ['n', 'y'] },
  { kind: 'package', package: 'imply-target', configSymbol: 'PACKAGE_imply-target',
    kconfigSymbol: 'PACKAGE_imply-target', type: 'bool', states: ['n', 'y'],
    kconfig: { dependsExpressions: [['IMPLY_PREREQUISITE']] } },
];
const implyPrerequisiteModel = createCatalogModel({
  schema: 5, targets: [], relations: { schema: 2, records: implyPrerequisiteRecords, indexes: {} },
});
const implyPrerequisitePlan = deriveKconfigPrerequisitePlans(
  implyPrerequisiteModel,
  new Map([['IMPLY_PREREQUISITE', 'n'], ['IMPLIED_SUPPORT', 'n'], ['PACKAGE_imply-target', 'n']]),
  implyPrerequisiteModel.bySymbol.get('PACKAGE_imply-target'), 'y',
);
assert(implyPrerequisitePlan.recommended?.cost === 1 &&
  implyPrerequisitePlan.recommended.steps[0]?.symbol === 'IMPLY_PREREQUISITE' &&
  implyPrerequisitePlan.recommended.automaticChanges.some((change) =>
    change.symbol === 'IMPLIED_SUPPORT' && change.reason === 'imply'),
  'an active imply prerequisite was not separated from the explicit plan step');

const tristateChoiceModel = createCatalogModel({ schema: 5, targets: [], relations: {
  schema: 2,
  records: ['CHOICE_A', 'CHOICE_B', 'CHOICE_C'].map((configSymbol) => ({
    kind: 'config', configSymbol, kconfigSymbol: configSymbol, type: 'tristate',
    states: ['n', 'm', 'y'], choice: 'TRISTATE_CHOICE',
  })),
  indexes: { choices: { TRISTATE_CHOICE: ['CHOICE_A', 'CHOICE_B', 'CHOICE_C'] } },
} });
const modularChoice = applyUserIntent(tristateChoiceModel,
  new Map([['CHOICE_A', 'm'], ['CHOICE_B', 'n'], ['CHOICE_C', 'n']]),
  { symbol: 'CHOICE_B', value: 'm' });
assert(modularChoice.values.get('CHOICE_A') === 'm' && modularChoice.values.get('CHOICE_B') === 'm' &&
  !validateConfig(tristateChoiceModel, modularChoice.values).some((row) => row.code === 'choice-conflict'),
  'a tristate choice incorrectly rejected multiple M members');
const selectedChoice = applyUserIntent(tristateChoiceModel, modularChoice.values,
  { symbol: 'CHOICE_C', value: 'y', preferredValues: new Map([['CHOICE_A', 'm']]) });
assert(selectedChoice.values.get('CHOICE_A') === 'n' && selectedChoice.values.get('CHOICE_B') === 'n' &&
  selectedChoice.values.get('CHOICE_C') === 'y',
  'a tristate choice Y did not exclude every sibling or suppressed latent M intent');
const restoredChoice = applyUserIntent(tristateChoiceModel, selectedChoice.values,
  { symbol: 'CHOICE_C', value: 'n', preferredValues: new Map([['CHOICE_A', 'm']]) });
assert(restoredChoice.values.get('CHOICE_A') === 'm' && restoredChoice.values.get('CHOICE_C') === 'n',
  'a suppressed tristate choice M intent was not restored after the Y member was disabled');
const escapedStringDefault = '"a\\\"b\\\\c"';
for (const [type, raw, expected] of [
  ['string', '""', ''], ['string', '"hello"', 'hello'], ['string', '"n"', 'n'],
  ['string', '"use if available"', 'use if available'],
  ['string', '"say \\"if ready\\" now"', 'say \\"if ready\\" now'],
  ['string', escapedStringDefault, escapedStringDefault.slice(1, -1)],
  ['int', '160', '160'], ['hex', '0x20', '0x20'],
]) {
  const scalar = resolveKconfigDefault({ type, defaults: [raw] }, defaultValues);
  assert(scalar.status === 'resolved' && scalar.value === expected,
    `${type} literal default ${raw} changed while hardening bool/tristate expressions`);
}

const defaultBoundaryContext = createCatalogValidationContext(model, selectedTarget, new Map([
  ['LANGUAGE_SWITCH', 'm'], ['EVERYTHING', 'n'],
]), { phase: 'interactive' });
const closedFallback = resolveKconfigDefault(model.bySymbol.get('DEFAULT_FALLBACK'),
  defaultBoundaryContext.values, defaultBoundaryContext.validationOptions);
assert(defaultBoundaryContext.validationOptions.closedSymbols.has('ABSENT_DEFAULT_SWITCH') &&
  closedFallback.status === 'resolved' && closedFallback.value === 'm',
  'a missing symbol closed by the Catalog default boundary did not fall through to the expression default');
assert(['ABSENT_COMPARE', 'ABSENT_COUNT', 'ABSENT_LABEL'].every((symbol) =>
  defaultBoundaryContext.validationOptions.closedSymbols.has(symbol)) &&
  !defaultBoundaryContext.validationOptions.closedSymbols.has('absent_literal') &&
  !defaultBoundaryContext.validationOptions.closedSymbols.has('SCALAR_MISSING') &&
  !defaultBoundaryContext.validationOptions.closedSymbols.has('m') &&
  !defaultBoundaryContext.validationOptions.closedSymbols.has('y'),
  'state/numeric/quoted/comparison-right literals leaked into the closed default-symbol boundary');
const trulyDeferred = resolveKconfigDefault(model.bySymbol.get('DEFERRED_FALLBACK'),
  defaultBoundaryContext.values, defaultBoundaryContext.validationOptions);
assert(!defaultBoundaryContext.validationOptions.closedSymbols.has('UNPUBLISHED_DEFAULT') &&
  trulyDeferred.status === 'deferred' && trulyDeferred.value === 'n',
  'a genuinely omitted dependency-context symbol incorrectly fell through to a later default');

const base = parseConfigDocument([
  'CONFIG_PACKAGE_profile-driver=y',
  '# CONFIG_PACKAGE_optional-driver is not set',
  '# CONFIG_PACKAGE_unrelated-tool is not set',
].join('\n'));
const pre = createCatalogValidationContext(model, selectedTarget, base, { phase: 'pre-defconfig' });
assert(pre.values.get('TARGET_demo_full') === 'y' && pre.values.get('BUS_SUPPORT') === 'y',
  'target selectors/features were not materialized generically');
assert(pre.trustedSymbols.has('PACKAGE_profile-driver'),
  'profile contract package was not marked trusted');
assert(validateConfig(model, pre.values, pre.validationOptions).length === 0,
  'trusted profile package was rejected before defconfig');

const appShapedTarget = {
  system: targetFull.board,
  subtarget: targetFull.subtarget,
  arch: targetFull.arch,
  archPackages: targetFull.archPackages,
  features: targetFull.features,
  boardSelector: targetFull.contract.boardSelector,
  targetSelector: targetFull.contract.targetSelector,
  profileSelector: targetFull.profiles[0].selector,
  profileSymbol: targetFull.profiles[0].id,
  profile: 'alpha',
  targetPackages: [...targetFull.packages],
  profilePackages: [...targetFull.profiles[0].packages],
};
const appContext = createCatalogValidationContext(model, appShapedTarget, base, { phase: 'pre-defconfig' });
assert(appContext.trustedSymbols.has('PACKAGE_profile-driver') &&
  validateConfig(model, appContext.values, appContext.validationOptions).length === 0,
  'app-shaped Target/Profile contract was not trusted generically');
const preset = applyUserIntent(model, appContext.values, {
  symbol: 'PACKAGE_recommended-service', value: 'y', validationOptions: appContext.validationOptions,
});
assert(preset.values.get('PACKAGE_recommended-service') === 'y' &&
  !preset.violations.some((row) => row.symbol === 'PACKAGE_recommended-service'),
  'target-sensitive preset was rejected while hidden upstream context was deferred');

const unrelated = applyUserIntent(model, pre.values, {
  symbol: 'PACKAGE_unrelated-tool', value: 'y', validationOptions: pre.validationOptions,
});
assert(unrelated.values.get('PACKAGE_unrelated-tool') === 'y',
  'unrelated user change was blocked by a baseline profile contract');

const wrong = createCatalogValidationContext(model, wrongTarget, new Map(), { phase: 'interactive' });
expectThrow(() => applyUserIntent(model, wrong.values, {
  symbol: 'PACKAGE_optional-driver', value: 'y', validationOptions: wrong.validationOptions,
}), /PACKAGE_optional-driver/, 'explicit package for the wrong complete target was not rejected');

const full = createCatalogValidationContext(model, selectedTarget, new Map(), { phase: 'interactive' });
const driver = applyUserIntent(model, full.values, {
  symbol: 'PACKAGE_optional-driver', value: 'y', validationOptions: full.validationOptions,
});
assert(driver.values.get('PACKAGE_optional-driver') === 'y',
  'package supported by selected target was rejected');
const offload = applyUserIntent(model, full.values, {
  symbol: 'PACKAGE_flow-offload', value: 'y', validationOptions: full.validationOptions,
});
assert(offload.values.get('PACKAGE_flow-core') === 'y' && offload.values.get('PACKAGE_flow-offload') === 'y',
  'generic forward dependency closure failed');

const directionalBase = parseConfigDocument([
  '# CONFIG_LANGUAGE_SWITCH is not set',
  '# CONFIG_EVERYTHING is not set',
  '# CONFIG_PACKAGE_core-service is not set',
  '# CONFIG_PACKAGE_ui-service is not set',
  '# CONFIG_PACKAGE_i18n-service is not set',
].join('\n'));
const upperPackage = applyUserIntent(model, directionalBase, { symbol: 'PACKAGE_ui-service', value: 'y' });
assert(upperPackage.values.get('PACKAGE_ui-service') === 'y' &&
  upperPackage.values.get('PACKAGE_core-service') === 'y' &&
  upperPackage.values.get('PACKAGE_i18n-service') === 'n',
  'enabling an upper package did not enable only its forward dependency closure');
const dependencyOnly = applyUserIntent(model, directionalBase, { symbol: 'PACKAGE_core-service', value: 'y' });
assert(dependencyOnly.values.get('PACKAGE_core-service') === 'y' &&
  dependencyOnly.values.get('PACKAGE_ui-service') === 'n' &&
  dependencyOnly.values.get('PACKAGE_i18n-service') === 'n',
  'enabling a dependency incorrectly reverse-selected packages that depend on it');

const localizedBase = new Map(directionalBase).set('LANGUAGE_SWITCH', 'y');
const localizedBuiltin = applyUserIntent(model, localizedBase, {
  symbol: 'PACKAGE_ui-service', value: 'y',
});
assert(localizedBuiltin.values.get('PACKAGE_i18n-service') === 'y' &&
  localizedBuiltin.changes.some((row) => row.symbol === 'PACKAGE_i18n-service' &&
    row.reason === 'conditional-default'),
  'a promptless language package did not follow its enabled parent and firmware language default');
const localizedModule = applyUserIntent(model, localizedBase, {
  symbol: 'PACKAGE_ui-service', value: 'm',
});
assert(localizedModule.values.get('PACKAGE_i18n-service') === 'm',
  'a promptless language package did not respect its modular parent dependency ceiling');
const localizedParentOff = applyUserIntent(model, localizedBuiltin.values, {
  symbol: 'PACKAGE_ui-service', value: 'n',
});
assert(localizedParentOff.values.get('PACKAGE_i18n-service') === 'n',
  'a promptless language package remained enabled after its parent was disabled');
const localizedLanguageOff = applyUserIntent(model, localizedBuiltin.values, {
  symbol: 'LANGUAGE_SWITCH', value: 'n',
});
assert(localizedLanguageOff.values.get('PACKAGE_ui-service') === 'y' &&
  localizedLanguageOff.values.get('PACKAGE_i18n-service') === 'n',
  'a promptless language package remained enabled after its firmware language was disabled');
const reconciledImport = reconcileKconfigDerivedValues(model, new Map([
  ...localizedBase,
  ['PACKAGE_ui-service', 'y'],
  ['PACKAGE_core-service', 'y'],
  ['PACKAGE_i18n-service', 'n'],
]));
assert(reconciledImport.values.get('PACKAGE_i18n-service') === 'y' &&
  reconciledImport.derivedSymbols.has('PACKAGE_i18n-service') &&
  reconciledImport.derivedReasons.get('PACKAGE_i18n-service') === 'conditional-default',
  'a stale imported hidden default was not reconciled from authoritative Kconfig conditions');

const chain = parseConfigDocument([
  'CONFIG_PACKAGE_core-service=y',
  'CONFIG_PACKAGE_ui-service=y',
  'CONFIG_PACKAGE_i18n-service=y',
].join('\n'));
const cascade = applyUserIntent(model, chain, { symbol: 'PACKAGE_core-service', value: 'n' });
assert(cascade.values.get('PACKAGE_ui-service') === 'n' && cascade.values.get('PACKAGE_i18n-service') === 'n',
  'generic reverse dependency cascade failed');

const enabledOffload = applyUserIntent(model, full.values, {
  symbol: 'PACKAGE_flow-offload', value: 'y', validationOptions: full.validationOptions,
});
assert(enabledOffload.values.get('PACKAGE_flow-core') === 'y',
  'mandatory dependency was not enabled');
const prunedOffload = applyUserIntent(model, enabledOffload.values, {
  symbol: 'PACKAGE_flow-offload', value: 'n',
  dependencySymbols: new Set(['PACKAGE_flow-core']),
  protectedSymbols: new Set(),
  validationOptions: full.validationOptions,
});
assert(prunedOffload.values.get('PACKAGE_flow-core') === 'n' &&
  prunedOffload.changes.some((row) => row.symbol === 'PACKAGE_flow-core' && row.reason === 'dependency-unused'),
  'unused automatically selected dependency was not pruned');

const shared = parseConfigDocument([
  'CONFIG_PACKAGE_flow-core=y',
  'CONFIG_PACKAGE_flow-offload=y',
  'CONFIG_PACKAGE_flow-monitor=y',
].join('\n'));
const sharedResult = applyUserIntent(model, shared, {
  symbol: 'PACKAGE_flow-offload', value: 'n',
  dependencySymbols: new Set(['PACKAGE_flow-core']),
  protectedSymbols: new Set(),
});
assert(sharedResult.values.get('PACKAGE_flow-core') === 'y',
  'shared dependency was incorrectly pruned');

const protectedResult = applyUserIntent(model, parseConfigDocument([
  'CONFIG_PACKAGE_flow-core=y',
  'CONFIG_PACKAGE_flow-offload=y',
].join('\n')), {
  symbol: 'PACKAGE_flow-offload', value: 'n',
  dependencySymbols: new Set(['PACKAGE_flow-core']),
  protectedSymbols: new Set(['PACKAGE_flow-core']),
});
assert(protectedResult.values.get('PACKAGE_flow-core') === 'y',
  'explicitly protected dependency was incorrectly pruned');

const imply = applyUserIntent(model, full.values, {
  symbol: 'PACKAGE_imply-source', value: 'y', validationOptions: full.validationOptions,
});
assert(imply.values.get('SOFT_HINT') === 'y' &&
  imply.changes.some((row) => row.symbol === 'SOFT_HINT' && row.reason === 'imply'),
  'weak imply relationship did not provide its native suggested value');
const implyOverride = applyUserIntent(model, imply.values, {
  symbol: 'SOFT_HINT', value: 'n', explicitSymbols: ['SOFT_HINT'],
});
assert(implyOverride.values.get('SOFT_HINT') === 'n' &&
  implyOverride.values.get('PACKAGE_imply-source') === 'y',
  'a user could not override a weak imply without reverse-editing its source');

const provider = applyUserIntent(model, parseConfigDocument([
  'CONFIG_PACKAGE_provider-a=y',
  '# CONFIG_PACKAGE_consumer is not set',
].join('\n')), { symbol: 'PACKAGE_consumer', value: 'y' });
assert(provider.values.get('PACKAGE_consumer') === 'y', 'virtual provider did not satisfy package dependency');

const choice = applyUserIntent(model, parseConfigDocument([
  'CONFIG_FORMAT_A=y',
  '# CONFIG_FORMAT_B is not set',
].join('\n')), { symbol: 'FORMAT_B', value: 'y' });
assert(choice.values.get('FORMAT_A') === 'n' && choice.values.get('FORMAT_B') === 'y',
  'generic choice enforcement failed');
const conflicts = validateConfig(model, parseConfigDocument([
  'CONFIG_PACKAGE_backend-a=y',
  'CONFIG_PACKAGE_backend-b=y',
].join('\n')));
assert(conflicts.some((row) => row.code === 'package-conflict'), 'generic package conflict was not detected');
let conflictIntentError = null;
try {
  applyUserIntent(model, parseConfigDocument([
    '# CONFIG_PACKAGE_backend-a is not set',
    'CONFIG_PACKAGE_backend-b=y',
  ].join('\n')), { symbol: 'PACKAGE_backend-a', value: 'y' });
} catch (error) {
  conflictIntentError = error;
}
assert(conflictIntentError?.name === 'CatalogIntentError' &&
  conflictIntentError.violations?.some((row) => row.code === 'package-conflict'),
  'interactive conflict did not preserve structured violation details for the browser dialog');

const compatibility = {
  schema: 2,
  rules: [{
    id: 'OWN-TEST', issue: 'file-ownership', match: 'all-installed', scope: { Demo: ['stable'] }, if: 'USE_APK',
    packages: ['core-service', 'ui-service'], paths: ['/etc/config/demo'], refs: ['run:1'],
  }],
};
const ownershipValues = parseConfigDocument([
  'CONFIG_PACKAGE_core-service=y',
  'CONFIG_PACKAGE_ui-service=y',
  'CONFIG_PACKAGE_i18n-service=y',
].join('\n'));
const ownership = evaluateCompatibilityRules(model, compatibility, ownershipValues, {
  sourceId: 'Demo', branchName: 'stable',
});
assert(ownership.warnings.length === 1 && ownership.warnings[0].records.every((record) => record.configSymbol),
  'active ownership rule did not resolve package IDs or the existing hidden-symbol default through the Catalog model');
for (const [left, right, expected] of [
  ['y', 'y', 1], ['m', 'm', 0], ['y', 'm', 0], ['m', 'y', 0], ['n', 'y', 0],
]) {
  const values = new Map(ownershipValues);
  values.set('USE_APK', 'y');
  values.set('PACKAGE_core-service', left);
  values.set('PACKAGE_ui-service', right);
  assert(evaluateCompatibilityRules(model, compatibility, values, {
    sourceId: 'Demo', branchName: 'stable',
  }).warnings.length === expected,
  `ownership rule treated ${left}/${right} as ${expected ? 'not installed' : 'simultaneously installed'}`);
}
const ownershipPlans = deriveCompatibilityPlans(model, ownershipValues, ownership.warnings[0]);
assert(ownershipPlans.recommended === null &&
  ownershipPlans.candidates.length === 2 &&
  ownershipPlans.candidates.every((row) => row.cost === 1 && row.steps.length === 1),
  'equal one-action compatibility plans should remain ambiguous instead of ranking automatic cascades');
for (const candidate of ownershipPlans.candidates) {
  assert(evaluateCompatibilityRules(model, compatibility, candidate.values, {
    sourceId: 'Demo', branchName: 'stable',
  }).warnings.length === 0,
  `ownership candidate ${candidate.package} did not resolve the rule`);
}
assert(evaluateCompatibilityRules(model, compatibility,
  new Map(ownershipValues).set('USE_APK', 'n'), { sourceId: 'Demo', branchName: 'stable' }).warnings.length === 0,
  'unsatisfied compatibility condition still triggered');
assert(evaluateCompatibilityRules(model, compatibility, ownershipValues, {
  sourceId: 'Demo', branchName: 'next',
}).warnings.length === 0, 'compatibility scope leaked to another branch');

const buildFailure = {
  schema: 2,
  rules: [{
    id: 'BLD-TEST', issue: 'build-failure', match: 'all-selected',
    scope: { Demo: ['stable'] }, packages: ['core-service'], refs: ['run:3'],
  }],
};
for (const [value, expected] of [['n', 0], ['m', 1], ['y', 1]]) {
  const values = new Map(ownershipValues).set('PACKAGE_core-service', value);
  assert(evaluateCompatibilityRules(model, buildFailure, values, {
    sourceId: 'Demo', branchName: 'stable',
  }).warnings.length === expected, `all-selected did not classify ${value}`);
}
const buildWarning = evaluateCompatibilityRules(model, buildFailure,
  new Map(ownershipValues).set('PACKAGE_core-service', 'y'), {
    sourceId: 'Demo', branchName: 'stable',
  }).warnings[0];
const buildPlans = deriveCompatibilityPlans(model, buildWarning.values, buildWarning);
assert(buildPlans.recommended?.package === 'core-service' &&
  evaluateCompatibilityRules(model, buildFailure, buildPlans.recommended.values, {
    sourceId: 'Demo', branchName: 'stable',
  }).warnings.length === 0,
'single-package compatibility rule did not derive and apply a generic disable intent');
assert(buildPlans.recommended.steps.map((step) => step.package).join('>') === 'core-service',
  'ordinary reverse dependents were incorrectly promoted to explicit menuconfig user actions');
assert(buildPlans.recommended.cost === 1,
  'automatic dependency reconciliation incorrectly inflated the explicit user-action cost');
assert(buildPlans.recommended.automaticChanges.some((change) =>
  change.symbol === 'PACKAGE_ui-service' && change.to === 'n') &&
  buildPlans.recommended.automaticChanges.some((change) =>
    change.symbol === 'PACKAGE_i18n-service' && change.to === 'n') &&
  buildPlans.recommended.values.get('PACKAGE_ui-service') === 'n' &&
  buildPlans.recommended.values.get('PACKAGE_i18n-service') === 'n',
  'compatibility planning did not preserve shared Kconfig automatic dependent cleanup');

const staleImportedValues = new Map(ownershipValues);
staleImportedValues.set('PACKAGE_core-service', 'n');
staleImportedValues.set('PACKAGE_ui-service', 'n');
staleImportedValues.set('PACKAGE_i18n-service', 'y');
const repairedImportedValues = reconcileKconfigDerivedValues(model, staleImportedValues);
assert(repairedImportedValues.values.get('PACKAGE_i18n-service') === 'n' &&
  repairedImportedValues.changes.some((change) =>
    change.symbol === 'PACKAGE_i18n-service' && change.to === 'n' && change.reason === 'dependency-unsatisfied'),
  'a hidden imported dependent remained enabled after its parent became unavailable');

const compatibilityReverseSelectCatalog = {
  schema: 5,
  targets: [],
  relations: {
    schema: 2,
    records: [
      { kind: 'package', package: 'selected-core', configSymbol: 'PACKAGE_selected-core',
        kconfigSymbol: 'PACKAGE_selected-core', states: ['n', 'y'] },
      { kind: 'package', package: 'selector-ui', configSymbol: 'PACKAGE_selector-ui',
        kconfigSymbol: 'PACKAGE_selector-ui', states: ['n', 'y'],
        kconfig: { selectsExpressions: [['PACKAGE_selected-core']] } },
    ],
    indexes: { providers: {}, reverseDependencies: {}, reverseKconfig: {}, choices: {} },
  },
};
const compatibilityReverseSelectModel = createCatalogModel(compatibilityReverseSelectCatalog);
const compatibilityReverseSelectRule = {
  schema: 2,
  rules: [{ id: 'BLD-SELECT', issue: 'build-failure', match: 'all-selected',
    scope: { Demo: ['stable'] }, packages: ['selected-core'], refs: ['run:4'] }],
};
const compatibilityReverseSelectValues = parseConfigDocument([
  'CONFIG_PACKAGE_selector-ui=y', 'CONFIG_PACKAGE_selected-core=y',
].join('\n'));
const compatibilityReverseSelectWarning = evaluateCompatibilityRules(
  compatibilityReverseSelectModel,
  compatibilityReverseSelectRule,
  compatibilityReverseSelectValues,
  { sourceId: 'Demo', branchName: 'stable' },
).warnings[0];
const compatibilityReverseSelectPlans = deriveCompatibilityPlans(
  compatibilityReverseSelectModel,
  compatibilityReverseSelectValues,
  compatibilityReverseSelectWarning,
);
assert(compatibilityReverseSelectPlans.recommended?.steps
  .map((step) => step.package).join('>') === 'selector-ui>selected-core',
  'compatibility planning did not reuse the shared reverse-select graph for ordered disables');

const wildcardCompatibility = structuredClone(buildFailure);
wildcardCompatibility.rules[0].scope = { '*': ['openwrt-*'] };
assert(evaluateCompatibilityRules(model, wildcardCompatibility,
  new Map(ownershipValues).set('PACKAGE_core-service', 'y'), {
    sourceId: 'FutureSource', branchName: 'openwrt-26.01',
  }).warnings.length === 1, 'source/branch wildcard did not cover a future Catalog branch');
assert(evaluateCompatibilityRules(model, wildcardCompatibility,
  new Map(ownershipValues).set('PACKAGE_core-service', 'y'), {
    sourceId: 'FutureSource', branchName: 'master',
  }).warnings.length === 0, 'branch wildcard leaked to a non-matching branch');
const mixedWildcardScope = structuredClone(wildcardCompatibility);
mixedWildcardScope.rules[0].scope.Demo = ['stable'];
expectThrow(() => normalizeCompatibilityDocument(mixedWildcardScope), /wildcard source/i,
  'wildcard source mixed with a named source was accepted');
const middleGlobScope = structuredClone(buildFailure);
middleGlobScope.rules[0].scope.Demo = ['open*wrt'];
assert(evaluateCompatibilityRules(model, middleGlobScope,
  new Map(ownershipValues).set('PACKAGE_core-service', 'y'), {
    sourceId: 'Demo', branchName: 'open-demo-wrt',
  }).warnings.length === 1, 'generic branch glob did not match the Catalog producer semantics');
const invalidGlobScope = structuredClone(buildFailure);
invalidGlobScope.rules[0].scope.Demo = ['bad branch'];
expectThrow(() => normalizeCompatibilityDocument(invalidGlobScope), /scope/i,
  'invalid branch glob was accepted');

const tiedCompatibility = {
  schema: 2,
  rules: [{
    id: 'OWN-TIE', issue: 'file-ownership', match: 'all-installed', scope: { Demo: ['stable'] }, if: 'USE_APK',
    packages: ['backend-a', 'backend-b'], paths: ['/etc/config/tie'], refs: ['run:2'],
  }],
};
const tiedValues = parseConfigDocument([
  'CONFIG_USE_APK=y', 'CONFIG_PACKAGE_backend-a=y', 'CONFIG_PACKAGE_backend-b=y',
].join('\n'));
const tiedWarning = evaluateCompatibilityRules(model, tiedCompatibility, tiedValues,
  { sourceId: 'Demo', branchName: 'stable' }).warnings[0];
assert(tiedWarning && deriveCompatibilityPlans(model, tiedValues, tiedWarning).recommended === null,
  'ambiguous equal-cost plans incorrectly received an automatic recommendation');

for (const mutate of [
  (value) => { value.schema = 1; },
  (value) => { value.schema = 0; },
  (value) => { value.schema = 3; },
  (value) => { value.rules[0].kind = 'ownership'; },
  (value) => { value.rules[0].symbols = ['PACKAGE_duplicate']; },
  (value) => { delete value.rules[0].paths; },
  (value) => { value.rules.push(structuredClone(value.rules[0])); },
  (value) => { value.rules[0].packages.push(value.rules[0].packages[0]); },
  (value) => { value.rules[0].paths = ['relative']; },
]) {
  const invalid = structuredClone(compatibility);
  mutate(invalid);
  expectThrow(() => normalizeCompatibilityDocument(invalid), /compatibility|OWN-TEST/i,
    'mutated compatibility document was accepted');
}
for (const mutate of [
  (value) => { value.rules[0].issue = 'unknown'; },
  (value) => { value.rules[0].match = 'any'; },
  (value) => { value.rules[0].paths = ['/not-applicable']; },
  (value) => { value.rules[0].packages = []; },
  (value) => { value.rules[0].extra = true; },
]) {
  const invalid = structuredClone(buildFailure);
  mutate(invalid);
  expectThrow(() => normalizeCompatibilityDocument(invalid), /compatibility|BLD-TEST/i,
    'mutated schema-2 compatibility document was accepted');
}
expectThrow(() => normalizeCompatibilityDocument({
  schema: 2, rules: [{ padding: 'x'.repeat(512 * 1024) }],
}), /too large/i, 'oversized compatibility document was accepted');
const missingPackage = structuredClone(compatibility);
missingPackage.rules[0].packages[1] = 'missing-package';
expectThrow(() => evaluateCompatibilityRules(model, missingPackage, ownershipValues,
  { sourceId: 'Demo', branchName: 'stable' }), /missing from the active Catalog/,
'active compatibility rule silently accepted a missing package ID');

const acknowledgement = {
  sha256: 'a'.repeat(64), dataRef: 'catalog-fix-F', sourceId: 'Demo', branchName: 'stable',
  revision: 7, ruleIds: ['OWN-TEST', 'OWN-TIE'],
};
for (const dataRef of ['catalog-fix-F', 'catalog-dev', 'catalog-staging', 'catalog-main']) {
  assert(safeCatalogDataRef(dataRef) === dataRef, `Catalog loader rejected canonical dataRef ${dataRef}`);
  compatibilityAcknowledgementKey({ ...acknowledgement, dataRef });
}
compatibilityAcknowledgementKey({ ...acknowledgement, dataRef: 'catalog-data' });
expectThrow(() => safeCatalogDataRef('catalog-candidate'), /invalid Catalog data branch/,
  'Catalog loader accepted the non-browser candidate channel');
expectThrow(() => compatibilityAcknowledgementKey({ ...acknowledgement, dataRef: 'catalog-candidate' }),
  /compatibility acknowledgement context is invalid/,
  'compatibility acknowledgement accepted the non-browser candidate channel');
const acknowledgementKey = compatibilityAcknowledgementKey(acknowledgement);
assert(acknowledgementKey === compatibilityAcknowledgementKey({
  ...acknowledgement, ruleIds: [...acknowledgement.ruleIds].reverse(),
}), 'acknowledgement key depended on rule ordering');
for (const changed of [
  { sha256: 'b'.repeat(64) }, { dataRef: 'catalog-dev' }, { sourceId: 'Other' },
  { branchName: 'next' }, { revision: 8 }, { ruleIds: ['OWN-TEST'] },
]) {
  assert(compatibilityAcknowledgementKey({ ...acknowledgement, ...changed }) !== acknowledgementKey,
    'compatibility acknowledgement survived a bound context change');
}

// Broad anonymous matrix: every Target/Profile contract package depends on its own
// selector plus an upstream hidden default omitted from the compact Catalog. This
// reproduces the whole error class without encoding any real package name.
const matrixTargets = [];
const matrixRecords = [];
for (let index = 0; index < 32; index++) {
  const board = `matrix${index}`;
  const targetSymbol = `TARGET_${board}_full`;
  const profileId = `DEVICE_node${index}`;
  const profileSymbol = `${targetSymbol}_${profileId}`;
  const archSymbol = `ARCH_MATRIX_${index % 4}`;
  const featureSymbol = `FEATURE_${index % 3}_SUPPORT`;
  const profilePackage = `profile-module-${index}`;
  const presetPackage = `preset-module-${index}`;
  matrixTargets.push({
    board, subtarget: 'full', name: `Matrix ${index}`, arch: archSymbol,
    archPackages: `matrix_arch_${index % 4}`, features: [`feature-${index % 3}`],
    packages: [profilePackage],
    contract: { boardSelector: `TARGET_${board}`, targetSelector: targetSymbol },
    profiles: [{ id: profileId, selector: profileSymbol, targetSelector: targetSymbol,
      boardSelector: `TARGET_${board}`, packages: [profilePackage] }],
  });
  matrixRecords.push(
    { kind: 'config', configSymbol: archSymbol, kconfigSymbol: archSymbol,
      states: ['n', 'y'], hidden: true, visible: false },
    { kind: 'config', configSymbol: featureSymbol, kconfigSymbol: featureSymbol,
      states: ['n', 'y'], hidden: true, visible: false },
    { kind: 'package', package: profilePackage, configSymbol: `PACKAGE_${profilePackage}`,
      kconfigSymbol: `PACKAGE_${profilePackage}`, states: ['n', 'm', 'y'],
      kconfig: { dependsExpressions: [[`${targetSymbol} && OMITTED_DEFAULT_${index}`]] } },
    { kind: 'package', package: presetPackage, configSymbol: `PACKAGE_${presetPackage}`,
      kconfigSymbol: `PACKAGE_${presetPackage}`, states: ['n', 'y'],
      kconfig: { dependsExpressions: [[`${targetSymbol} && OMITTED_DEFAULT_${index}`]] } },
  );
}
const matrixModel = createCatalogModel({
  schema: 5,
  targets: matrixTargets,
  relations: { schema: 2, records: matrixRecords, indexes: { providers: {},
    reverseDependencies: {}, reverseKconfig: {}, choices: {} } },
});
for (let index = 0; index < matrixTargets.length; index++) {
  const target = matrixTargets[index];
  const profile = target.profiles[0];
  const targetContext = {
    system: target.board, subtarget: target.subtarget, arch: target.arch,
    archPackages: target.archPackages, features: target.features,
    boardSelector: profile.boardSelector, targetSelector: profile.targetSelector,
    profileSelector: profile.selector, profileSymbol: profile.id,
    profile: profile.id.replace(/^DEVICE_/, ''), targetPackages: target.packages,
    profilePackages: profile.packages,
  };
  const profileSymbol = `PACKAGE_profile-module-${index}`;
  const presetSymbol = `PACKAGE_preset-module-${index}`;
  const initial = new Map([[profileSymbol, 'y']]);
  const matrixPre = createCatalogValidationContext(matrixModel, targetContext, initial,
    { phase: 'pre-defconfig' });
  assert(matrixPre.trustedSymbols.has(profileSymbol),
    `matrix ${index}: Target/Profile package was not trusted`);
  assert(validateConfig(matrixModel, matrixPre.values, matrixPre.validationOptions).length === 0,
    `matrix ${index}: pre-defconfig rejected a valid target contract`);
  const matrixPreset = applyUserIntent(matrixModel, matrixPre.values, {
    symbol: presetSymbol, value: 'y', validationOptions: matrixPre.validationOptions,
  });
  assert(matrixPreset.values.get(presetSymbol) === 'y',
    `matrix ${index}: deferred target-sensitive preset was rejected`);
}

const ordered = orderCatalogIndex({ sources: [
  { id: 'source-c', branches: [{ id: 'v-next', branch: 'openwrt-26.10' },
    { id: 'main', branch: 'main' }, { id: 'v-old', branch: 'openwrt-9.2' },
    { id: 'snapshot', branch: 'snapshot' }] },
  { id: 'source-a', branches: [{ id: 'v', branch: 'openwrt-25.1' }] },
  { id: 'source-b', branches: [{ id: 'master', branch: 'master' },
    { id: 'future', branch: 'openwrt-30.2' }, { id: 'vendor', branch: 'vendor-next' }] },
] }, {
  sourcePriority: ['source-a', 'source-b', 'source-c'],
  developmentBranches: ['main', 'master'],
});
assert(ordered.sources.map((row) => row.id).join(',') === 'source-a,source-b,source-c',
  'selection policy source order was not applied');
assert(ordered.sources[1].branches.map((row) => row.branch).join(',') ===
  'openwrt-30.2,master,vendor-next' &&
  ordered.sources[2].branches.map((row) => row.branch).join(',') ===
  'openwrt-26.10,openwrt-9.2,main,snapshot',
  'stable/development/special branch order was not applied');
const defaultBranchOrder = orderCatalogIndex({ sources: [{ id: 'future', branches: [
  { id: 'master', branch: 'master' }, { id: 'next', branch: 'openwrt-26.12' },
  { id: 'current', branch: 'openwrt-25.12' }, { id: 'rc', branch: 'openwrt-27.01-rc1' },
  { id: 'main', branch: 'main' },
] }] }, { developmentBranches: ['main', 'master'] }).sources[0].branches;
assert(defaultBranchOrder.map((row) => row.branch).join(',') ===
  'openwrt-26.12,openwrt-25.12,main,master,openwrt-27.01-rc1',
  'a future stable branch did not become the first default while prerelease stayed special');
const targetTree = {
  targetSelectors: [{ id: 'family' }, { id: 'board' }, { id: 'profile' }],
  targetTree: [{ value: 'first', children: [{ value: 'fallback', children: [{ value: 'base' }] }] },
    { value: 'preferred', children: [{ value: 'wanted', children: [{ value: 'generic' }] }] }],
};
assert(preferredCatalogTarget(targetTree, { selectors: {
  family: 'preferred', board: 'wanted', profile: 'generic',
} }).family === 'preferred', 'preferred target was not selected');
assert(preferredCatalogTarget(targetTree, { selectors: {
  family: 'missing', board: 'missing', profile: 'missing',
} }).family === 'first', 'missing preferred target did not fall back to the first valid path');

for (let index = 0; index < 12; index++) {
  const baselineName = `luci-theme-baseline-${index}`;
  const overrideName = `luci-theme-override-${index}`;
  const baselineSymbol = `PACKAGE_${baselineName}`;
  const overrideSymbol = `PACKAGE_${overrideName}`;
  const themeTarget = {
    board: `theme${index}`, subtarget: 'full', arch: `ARCH_THEME_${index}`,
    archPackages: `theme_arch_${index}`, packages: [baselineName],
    contract: { boardSelector: `TARGET_theme${index}`, targetSelector: `TARGET_theme${index}_full` },
    profiles: [{ id: `DEVICE_theme${index}`, selector: `TARGET_theme${index}_full_DEVICE_theme${index}`,
      packages: [baselineName] }],
  };
  const themeModel = createCatalogModel({ schema: 5, targets: [themeTarget], relations: {
    schema: 2, records: [
      { kind: 'package', package: baselineName, configSymbol: baselineSymbol,
        kconfigSymbol: baselineSymbol, states: ['n', 'y'] },
      { kind: 'package', package: overrideName, configSymbol: overrideSymbol,
        kconfigSymbol: overrideSymbol, states: ['n', 'y'] },
    ], indexes: { providers: {}, reverseDependencies: {}, reverseKconfig: {}, choices: {} },
  } });
  const target = { system: themeTarget.board, subtarget: themeTarget.subtarget,
    profileSymbol: themeTarget.profiles[0].id, profilePackages: [baselineName],
    targetPackages: [baselineName], targetSelector: themeTarget.contract.targetSelector,
    boardSelector: themeTarget.contract.boardSelector,
    profileSelector: themeTarget.profiles[0].selector, arch: themeTarget.arch,
    archPackages: themeTarget.archPackages };
  assert(resolveEffectiveTheme(themeModel, target).symbol === baselineSymbol,
    `theme ${index}: profile baseline was not resolved`);
  const themeOverride = resolveEffectiveTheme(themeModel, target, new Map([[overrideSymbol, 'y']]), {
    explicitSymbols: [overrideSymbol], preferredSymbol: overrideSymbol,
  });
  assert(themeOverride.symbol === overrideSymbol && themeOverride.values.get(baselineSymbol) === 'y' &&
    themeOverride.values.get(overrideSymbol) === 'y',
  `theme ${index}: explicit theme did not win while preserving the native Profile theme`);
  assert(resolveEffectiveTheme(themeModel, target, new Map([[overrideSymbol, 'n']]), {
    explicitSymbols: [overrideSymbol], preferredSymbol: overrideSymbol,
  }).symbol === baselineSymbol, `theme ${index}: disabled override hid the profile baseline`);
}
const emptyThemeModel = createCatalogModel({ schema: 5, targets: [], relations: {
  schema: 2, records: [], indexes: { providers: {}, reverseDependencies: {}, reverseKconfig: {}, choices: {} },
} });
assert(resolveEffectiveTheme(emptyThemeModel, null).symbol === '', 'theme zero case did not remain empty');
for (let index = 0; index < 10; index++) {
  const blockedName = `luci-theme-blocked-fallback-${index}`;
  const firstName = `luci-theme-viable-fallback-${index}`;
  const nextName = `luci-theme-next-fallback-${index}`;
  const blockedSymbol = `PACKAGE_${blockedName}`;
  const firstSymbol = `PACKAGE_${firstName}`;
  const nextSymbol = `PACKAGE_${nextName}`;
  const fallbackModel = createCatalogModel({ schema: 5, targets: [], relations: {
    schema: 2, records: [
      { kind: 'package', package: blockedName, configSymbol: blockedSymbol,
        kconfigSymbol: blockedSymbol, states: ['n', 'y'],
        kconfig: { dependsExpressions: [['n']] } },
      { kind: 'package', package: firstName, configSymbol: firstSymbol,
        kconfigSymbol: firstSymbol, states: ['n', 'y'] },
      { kind: 'package', package: nextName, configSymbol: nextSymbol,
        kconfigSymbol: nextSymbol, states: ['n', 'm', 'y'] },
    ], indexes: { providers: {}, reverseDependencies: {}, reverseKconfig: {}, choices: {} },
  } });
  const fallback = resolveEffectiveTheme(fallbackModel, null);
  assert(fallback.symbol === firstSymbol && fallback.values.get(firstSymbol) === 'y' &&
    fallback.changes.some((change) => change.symbol === firstSymbol),
  `theme fallback ${index}: unavailable first candidate did not advance to the viable candidate`);
  const skipped = resolveEffectiveTheme(fallbackModel, null, new Map([[firstSymbol, 'n']]), {
    explicitSymbols: [firstSymbol],
  });
  assert(skipped.symbol === nextSymbol,
    `theme fallback ${index}: explicit n candidate was not skipped`);
  const excluded = [blockedSymbol, firstSymbol, nextSymbol];
  const allOff = resolveEffectiveTheme(fallbackModel, null,
    new Map(excluded.map((symbol) => [symbol, 'n'])), { explicitSymbols: excluded });
  assert(allOff.symbol === '', `theme fallback ${index}: all-explicit-n did not fail`);
}
const selectedThemeName = 'luci-theme-selected-anonymous';
const selectedThemeSymbol = `PACKAGE_${selectedThemeName}`;
const selectorSymbol = 'ENABLE_ANONYMOUS_THEME';
const selectedThemeModel = createCatalogModel({ schema: 5, targets: [], relations: {
  schema: 2, records: [
    { kind: 'config', configSymbol: selectorSymbol, kconfigSymbol: selectorSymbol,
      states: ['n', 'y'], defaults: ['y'], hidden: true, visible: false },
    { kind: 'package', package: selectedThemeName, configSymbol: selectedThemeSymbol,
      kconfigSymbol: selectedThemeSymbol, states: ['n', 'y'] },
  ], indexes: { providers: {}, reverseDependencies: {},
    reverseKconfig: { [selectedThemeSymbol]: [selectorSymbol] }, choices: {} },
} });
selectedThemeModel.bySymbol.get(selectorSymbol).kconfig = {
  selectsExpressions: [[selectedThemeSymbol]], impliesExpressions: [], dependsExpressions: [],
};
assert(resolveEffectiveTheme(selectedThemeModel, null).symbol === selectedThemeSymbol,
  'Kconfig default/select did not resolve an effective theme');
const choiceThemeNames = ['luci-theme-choice-anonymous-a', 'luci-theme-choice-anonymous-b'];
const choiceThemeSymbols = choiceThemeNames.map((name) => `PACKAGE_${name}`);
const choiceThemeModel = createCatalogModel({ schema: 5, targets: [], relations: {
  schema: 2, records: choiceThemeNames.map((name, index) => ({
    kind: 'package', package: name, configSymbol: choiceThemeSymbols[index],
    kconfigSymbol: choiceThemeSymbols[index], states: ['n', 'y'], defaults: ['y'], choice: 'THEME_CHOICE',
  })), indexes: { providers: {}, reverseDependencies: {}, reverseKconfig: {},
    choices: { THEME_CHOICE: choiceThemeSymbols } },
} });
assert(resolveEffectiveTheme(choiceThemeModel, null).candidates.length === 1,
  'Kconfig choice did not converge to one effective theme');

console.log('Catalog interactive dependency matrix passed');
