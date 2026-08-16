#!/usr/bin/env node
import {
  allowedKconfigStates,
  applyUserIntent,
  compatibilityAcknowledgementKey,
  createCatalogModel,
  createCatalogValidationContext,
  deriveCompatibilityPlans,
  evaluateCompatibilityRules,
  evaluateExpressionState,
  normalizeCompatibilityDocument,
  parseConfigDocument,
  normalizeKconfigStateValue,
  orderCatalogIndex,
  resolveKconfigDefault,
  preferredCatalogTarget,
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
assert(selectableKconfigStates(stateBoundaryModel.bySymbol.get('HIDDEN_BOOL'), new Map()).join(',') === 'n',
  'a hidden Kconfig state was exposed for direct enablement');
assert(!validateConfig(stateBoundaryModel, new Map([
  ['MODULE_GATE', 'm'], ['BOOL_CHILD', 'y'], ['TRISTATE_CHILD', 'm'], ['LOCKED_BOOL', 'y'], ['HIDDEN_BOOL', 'n'],
])).some((row) => row.symbol === 'BOOL_CHILD'),
'a bool depending on m was rejected instead of receiving Kconfig\'s m-to-y dependency coercion');
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
assert(imply.values.get('SOFT_HINT') !== 'y',
  'weak imply relationship was incorrectly treated as a mandatory dependency');

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
assert(ownershipPlans.recommended?.package === 'ui-service' &&
  ownershipPlans.recommended.cost === 2 && ownershipPlans.candidates.find((row) => row.package === 'core-service')?.cost === 3,
  'unique lowest-cost compatibility plan was not derived from generic dependency cascades');
assert(evaluateCompatibilityRules(model, compatibility, ownershipPlans.recommended.values, {
  sourceId: 'Demo', branchName: 'stable',
}).warnings.length === 0, 'recommended compatibility plan did not resolve the rule');
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
for (const dataRef of ['catalog-fix', 'catalog-fix-F', 'catalog-dev', 'catalog-staging', 'catalog-main']) {
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
    { id: 'main', branch: 'main' }, { id: 'v-old', branch: 'openwrt-9.2' }] },
  { id: 'source-a', branches: [{ id: 'v', branch: 'openwrt-25.1' }] },
  { id: 'source-b', branches: [{ id: 'master', branch: 'master' },
    { id: 'future', branch: 'openwrt-30.2' }] },
] }, {
  sourcePriority: ['source-a', 'source-b', 'source-c'],
  developmentBranches: ['master', 'main'],
});
assert(ordered.sources.map((row) => row.id).join(',') === 'source-a,source-b,source-c',
  'selection policy source order was not applied');
assert(ordered.sources[1].branches.map((row) => row.branch).join(',') === 'master,openwrt-30.2' &&
  ordered.sources[2].branches.map((row) => row.branch).join(',') === 'main,openwrt-26.10,openwrt-9.2',
  'development/future version branch order was not applied');
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
  assert(resolveEffectiveTheme(themeModel, target, new Map([[overrideSymbol, 'y']]), {
    explicitSymbols: [overrideSymbol], preferredSymbol: overrideSymbol,
  }).symbol === overrideSymbol, `theme ${index}: explicit override did not win`);
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
