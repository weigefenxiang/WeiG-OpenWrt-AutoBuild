#!/usr/bin/env node
import {
  allowedKconfigStates,
  applyUserIntent,
  compatibilityAcknowledgementKey,
  createCatalogModel,
  expandCompactRelations,
  createCatalogValidationContext,
  deriveConfigurationRepairPlan,
  deriveCompatibilityPlans,
  deriveKconfigPrerequisitePlans,
  evaluateCompatibilityRules,
  evaluateNormalizedCompatibilityRules,
  evaluateExpression,
  evaluateExpressionState,
  kconfigStateConstraints,
  normalizeCompatibilityDocument,
  parseConfigDocument,
  normalizeKconfigStateValue,
  orderCatalogIndex,
  resolveKconfigDefault,
  REQUIRED_KCONFIG_RELATION_CAPABILITIES,
  preferredCatalogTarget,
  reconcileKconfigDerivedValues,
  resolveCatalogUserOverride,
  resolveEffectiveTheme,
  selectableKconfigStates,
  validateConfig,
} from '../site/wrt/lib/catalog-engine.js';
import { safeCatalogDataRef } from '../site/wrt/lib/catalog-loader.js';
import { createRuntimeMenu } from '../site/wrt/lib/catalog-schema6.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function expectThrow(fn, pattern, message) {
  let thrown = null;
  try { fn(); } catch (error) { thrown = error; }
  assert(thrown && pattern.test(String(thrown.message || thrown)), message);
}

// Expression parsing is fail-closed at both layers: the lexer retains every
// source character, and the parser cannot accept a valid prefix followed by
// an illegal character, operand, or unmatched parenthesis.
for (const expression of ['CONFIG_A trailing', 'CONFIG_A?', 'CONFIG_A &&', '(CONFIG_A', 'CONFIG_A)']) {
  assert(evaluateExpressionState(expression, new Map([['CONFIG_A', 'y']])).status === 'deferred' &&
    evaluateExpression(expression, new Map([['CONFIG_A', 'y']])) === -1,
  `malformed typed expression was promoted from UNKNOWN: ${expression}`);
}
assert(evaluateExpressionState('CONFIG_A && !CONFIG_B', new Map([
  ['CONFIG_A', 'y'], ['CONFIG_B', 'n'],
])).status === 'satisfied', 'valid typed expression did not consume all operands');
assert(evaluateExpressionState('@PACKAGE_missing', new Map()).status === 'unsatisfied',
  'source-domain @ was not ignored consistently with the Catalog AST lexer');

// Typed expression operands must follow native scripts/config semantics.  In
// particular, scalar symbols are tristate N when used bare, while comparisons
// use the declared type and exact integer values instead of Number rounding.
const typedOperandOptions = {
  symbolTypes: new Map([
    ['SCALAR_STRING', 'string'], ['SCALAR_INT', 'int'], ['SCALAR_HEX', 'hex'],
    ['BOOL_VALUE', 'bool'], ['TRI_VALUE', 'tristate'],
  ]),
  undefinedSymbols: new Map([['PROVEN_MISSING', {
    symbol: 'OWNER', missing: 'PROVEN_MISSING', reason: 'undefined-kconfig-symbol',
    nativeType: 'unknown', booleanValue: 'n', stringValue: 'PROVEN_MISSING',
  }]]),
};
const typedOperandValues = new Map([
  ['SCALAR_STRING', 'alpha'], ['SCALAR_INT', '9007199254740993'], ['SCALAR_HEX', '0x10'],
  ['BOOL_VALUE', 'y'], ['TRI_VALUE', 'm'],
]);
assert(evaluateExpressionState('SCALAR_STRING', typedOperandValues, typedOperandOptions).level === 0 &&
  evaluateExpressionState('SCALAR_INT', typedOperandValues, typedOperandOptions).level === 0 &&
  evaluateExpressionState('BOOL_VALUE', typedOperandValues, typedOperandOptions).level === 2 &&
  evaluateExpressionState('TRI_VALUE', typedOperandValues, typedOperandOptions).level === 1,
  'typed bare symbol semantics diverged from native tristate evaluation');
assert(evaluateExpression('SCALAR_INT = 9007199254740993', typedOperandValues, typedOperandOptions) === 2 &&
  evaluateExpression('SCALAR_INT > 9007199254740992', typedOperandValues, typedOperandOptions) === 2 &&
  evaluateExpression('SCALAR_INT = 9007199254740992', typedOperandValues, typedOperandOptions) === 0 &&
  evaluateExpression('SCALAR_STRING = "alpha # not a comment"', new Map([['SCALAR_STRING', 'alpha # not a comment']]), typedOperandOptions) === 2 &&
  evaluateExpression('SCALAR_STRING = "alpha" # source comment', typedOperandValues, typedOperandOptions) === 2,
  'typed comparison lost scalar type or integer precision');
assert(evaluateExpressionState('PROVEN_MISSING', new Map(), typedOperandOptions).level === 0 &&
  evaluateExpression('PROVEN_MISSING = "PROVEN_MISSING"', new Map(), typedOperandOptions) === 2 &&
  evaluateExpressionState('UNPROVEN_MISSING', new Map(), typedOperandOptions).status === 'deferred',
  'proven undefined Kconfig symbols were not separated from unknown data');

const typedCapabilities = [...REQUIRED_KCONFIG_RELATION_CAPABILITIES];
const typedComparisonExpression = 'SCALAR_INT > 9007199254740992 # source comment';
const typedComparisonAst = { raw: typedComparisonExpression, complete: true, ast: {
  kind: 'compare', operator: '>', left: { kind: 'symbol', name: 'SCALAR_INT' },
  right: { kind: 'literal', value: '9007199254740992', raw: '9007199254740992' },
} };
const typedValidationCatalog = {
  schema: 6, targets: [],
  relations: {
    schema: 2, relationsComplete: true, capabilities: typedCapabilities,
    validation: {
      kconfigSymbolProof: { complete: true },
      kconfigUndefinedSymbols: [{
        symbol: 'PACKAGE_typed-target', missing: 'PROVEN_MISSING',
        reason: 'undefined-kconfig-symbol', nativeType: 'unknown', booleanValue: 'n', stringValue: 'PROVEN_MISSING',
      }],
    },
    records: [
      { kind: 'config', configSymbol: 'SCALAR_INT', type: 'int', states: [], visible: false },
      { kind: 'package', package: 'typed-target', configSymbol: 'PACKAGE_typed-target', type: 'bool', states: ['n', 'y'],
        kconfig: { dependsExpressions: [[typedComparisonExpression]], dependsAstVariants: [[typedComparisonAst]] } },
      { kind: 'package', package: 'undefined-target', configSymbol: 'PACKAGE_undefined-target', type: 'bool', states: ['n', 'y'],
        kconfig: { dependsExpressions: [['PROVEN_MISSING']], dependsAstVariants: [[{
          raw: 'PROVEN_MISSING', complete: true, ast: { kind: 'symbol', name: 'PROVEN_MISSING' },
        }]] } },
    ],
  },
};
const typedValidationModel = createCatalogModel(typedValidationCatalog);
const typedValidation = validateConfig(typedValidationModel, new Map([
  ['SCALAR_INT', '9007199254740993'], ['PACKAGE_typed-target', 'y'], ['PACKAGE_undefined-target', 'y'],
]), { deferred: 'report' });
assert(!typedValidation.some((item) => item.package === 'typed-target' && item.code === 'kconfig-dependency-unsatisfied') &&
  typedValidation.some((item) => item.package === 'undefined-target' && item.code === 'kconfig-dependency-unsatisfied') &&
  !typedValidation.some((item) => item.package === 'undefined-target' && item.deferred),
  'AST/raw typed proof did not share operand semantics or consume proven undefined metadata');
assert(!typedValidationModel.bySymbol.has('PROVEN_MISSING') &&
  typedValidationModel.undefinedKconfigSymbols.has('PROVEN_MISSING'),
  'proven undefined symbol was incorrectly materialized as a configuration record');

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

// Schema 4 keeps the typed/default/visibility/provider tables addressable by
// field name. This fixture intentionally uses the full producer field order so
// a shifted column cannot silently turn a virtual capability into a Kconfig
// symbol or discard a package dependency.
const compactRelationsFields = [
  'symbolId', 'flags', 'typeCode', 'originCode', 'statesMask', 'choiceId', 'defaultsId',
  'dependsVariantsId', 'selectsVariantsId', 'impliesVariantsId', 'packageDependenciesId',
  'providesId', 'conflictsId', 'packageConflictsId', 'kconfigConflictsId', 'typedDefaultsId', 'rangesId',
  'promptIfId', 'promptConditionsId',
  'visibleIfId', 'menuVisibleIfId', 'directDependsId', 'inheritedDependsId', 'directVisibleIfId',
  'inheritedVisibleIfId', 'inheritedMenuVisibleIfId', 'optionFlagsId', 'optionsId', 'definitionsId',
  'capabilityRelationsId',
];
const compactRelationsV4 = {
  schema: 4,
  fields: compactRelationsFields,
  flags: { visible: 1, userSettable: 2, canDisable: 4, hasKconfig: 8, package: 16 },
  types: ['', 'bool', 'tristate', 'string', 'int', 'hex'],
  origins: ['', 'kconfig-only', 'kconfig+packageinfo', 'hidden-kconfig-only',
    'hidden-kconfig+packageinfo', 'packageinfo-only'],
  valueKinds: ['', 'literal', 'expression', 'unknown'],
  relationCapabilities: [
    'kconfig-expression-ast-v1', 'typed-kconfig-v1', 'conditional-defaults-v1', 'conditional-ranges-v1',
    'visibility-conditions-v1', 'choice-relations-v1', 'choice-reset-conditions-v1', 'module-semantics-v1',
    'typed-package-capabilities-v1', 'alternatives-v1', 'forward-reverse-edges-v1',
    'complete-kconfig-relations-v1',
  ],
  relationsComplete: true,
  packageClosureComplete: true,
  packageClosureCapabilities: ['packageinfo-dependencies-v1', 'packageinfo-alternatives-v1',
    'packageinfo-conditions-v1', 'packageinfo-virtual-providers-v1',
    'package-forward-reverse-edges-v1', 'complete-package-build-closure-v1'],
  strings: ['PACKAGE_provider', 'PACKAGE_consumer', 'virtual-api', 'CONFIG_GATE', 'hello', '1', '4', 'hello if CONFIG_GATE'],
  expressions: ['CONFIG_GATE'],
  stringLists: [[], [2], [0], [3]],
  expressionLists: [[], [0]],
  expressionVariants: [[], [1]],
  defaults: [[], [[4, 0, 7]]],
  typedDefaults: [[], [{ typeCode: 3, value: 'hello', rawId: 4, conditionId: -1,
    valueKindCode: 1, valid: true, precise: true }]],
  ranges: [[], [{ typeCode: 4, min: '1', max: '4', minRawId: 5, maxRawId: 6,
    rawId: 5, conditionId: -1, minKindCode: 1, maxKindCode: 1, valid: true }]],
  packageDependencies: [[], [{ raw: '+provider', required: true, kind: 'package',
    condition: '', packages: ['provider'], targets: [] }]],
  capabilities: [
    { provides: [], conflicts: [] },
    { provides: [{ raw: 'virtual-api', name: 'virtual-api', kind: 'virtual',
      providers: ['provider'], effectiveProviders: ['provider'], ownerSelf: false }], conflicts: [] },
  ],
  kconfigConflicts: [[]],
  definitions: [[]],
  choices: [{ id: 'COMPACT_CHOICE', type: 'bool', members: ['COMPACT_A'],
    resetIf: ['CONFIG_GATE'],
    resetIfAst: [{ raw: 'CONFIG_GATE', ast: { kind: 'symbol', name: 'CONFIG_GATE' }, complete: true }] }],
  numberLists: [[]],
  edges: [],
  indexes: { providers: [[2, 2]], reverseDependencies: [], reverseKconfig: [],
    reverseSelects: [], reverseImplies: [], choices: [], forwardEdges: [], reverseEdges: [] },
  records: [
    [0, 31, 2, 2, 7, -1, 0, 0, 0, 0, 1, 0, 0, -1, -1, -1, -1, -1, -1, -1,
      -1, -1, -1, -1, -1, -1, -1, -1, -1, 1],
    [1, 31, 2, 2, 7, -1, 0, 0, 0, 0, 0, 0, 0, -1, -1, -1, -1, -1, -1, -1,
      -1, -1, -1, -1, -1, -1, -1, -1, -1, 0],
    [3, 8, 3, 1, 0, -1, 1, 0, 0, 0, 0, 0, 0, -1, -1, 1, 1, -1, -1, -1,
      -1, -1, -1, -1, -1, -1, -1, -1, -1, 0],
  ],
};
const expandedRelationsV4 = expandCompactRelations(compactRelationsV4);
assert(expandedRelationsV4.relationsComplete === true &&
  expandedRelationsV4.records.find((record) => record.package === 'provider')
    ?.packageInfo.providesRelations[0]?.name === 'virtual-api' &&
  expandedRelationsV4.records.find((record) => record.package === 'provider')
    ?.packageInfo.dependencyRelations[0]?.packages[0] === 'provider' &&
  expandedRelationsV4.records.find((record) => record.configSymbol === 'CONFIG_GATE')
    ?.defaults?.[0] === 'hello if CONFIG_GATE' &&
  expandedRelationsV4.records.find((record) => record.configSymbol === 'CONFIG_GATE')
    ?.defaultsTyped[0]?.value === 'hello' &&
  expandedRelationsV4.choices[0]?.resetIf?.[0] === 'CONFIG_GATE' &&
  expandedRelationsV4.choices[0]?.resetIfAst?.[0]?.ast?.name === 'CONFIG_GATE',
  'compact relations schema 4 did not preserve typed fields and capability relations');

const multiDefinitionRecord = [...compactRelationsV4.records[2]];
multiDefinitionRecord[28] = 1;
const multiDefinitionAst = (name) => ({ raw: name, complete: true,
  ast: { kind: 'symbol', name } });
const multiDefinitionRelations = expandCompactRelations({
  ...compactRelationsV4,
  strings: [...compactRelationsV4.strings, 'OTHER_GATE'],
  definitions: [[], [
    { dependsAst: [multiDefinitionAst('CONFIG_GATE')], directDependsAst: [multiDefinitionAst('CONFIG_GATE')],
      inheritedDependsAst: [multiDefinitionAst('CONFIG_GATE')], promptIfAst: [multiDefinitionAst('CONFIG_GATE')],
      visibleIfAst: [multiDefinitionAst('CONFIG_GATE')], menuVisibleIfAst: [multiDefinitionAst('CONFIG_GATE')],
      directVisibleIfAst: [multiDefinitionAst('CONFIG_GATE')], inheritedVisibleIfAst: [multiDefinitionAst('CONFIG_GATE')],
      inheritedMenuVisibleIfAst: [multiDefinitionAst('CONFIG_GATE')] },
    { dependsAst: [multiDefinitionAst('OTHER_GATE')], directDependsAst: [multiDefinitionAst('OTHER_GATE')],
      inheritedDependsAst: [multiDefinitionAst('OTHER_GATE')], promptIfAst: [multiDefinitionAst('OTHER_GATE')],
      visibleIfAst: [multiDefinitionAst('OTHER_GATE')], menuVisibleIfAst: [multiDefinitionAst('OTHER_GATE')],
      directVisibleIfAst: [multiDefinitionAst('OTHER_GATE')], inheritedVisibleIfAst: [multiDefinitionAst('OTHER_GATE')],
      inheritedMenuVisibleIfAst: [multiDefinitionAst('OTHER_GATE')] },
  ]],
  records: [multiDefinitionRecord],
});
const multiDefinitionDecoded = multiDefinitionRelations.records[0];
assert(multiDefinitionDecoded.dependsAst?.[0]?.raw === 'CONFIG_GATE' &&
  multiDefinitionDecoded.dependsAstVariants?.length === 2 &&
  multiDefinitionDecoded.dependsAstVariants[1]?.[0]?.raw === 'OTHER_GATE' &&
  multiDefinitionDecoded.promptIfAst?.[0]?.raw === 'CONFIG_GATE' &&
  multiDefinitionDecoded.promptIfAst?.length === 1,
  'schema 4 multi-definition aggregate duplicated variants instead of using firstDefinition');
const compactV4Model = createCatalogModel({ schema: 6, targets: [], relations: compactRelationsV4 });
assert(compactV4Model.relationsComplete === true && compactV4Model.relationCapabilities.includes('complete-kconfig-relations-v1'),
  'schema 4 complete relation capability was not propagated to the canonical model');
assert(compactV4Model.packageClosureComplete === true &&
  compactV4Model.packageClosureCapabilities.includes('complete-package-build-closure-v1'),
  'schema 4 narrow package closure capability was not propagated to the canonical model');

// Schema-4 AST envelopes are canonicalized for every condition surface and
// evaluated through the same tri-state proof path as raw expressions. A
// producer-declared typed graph must not fall back to a raw condition when its
// AST is absent, incomplete, or inconsistent with that raw spelling.
const astCondition = (raw, ast, complete = true) => ({ raw, ast, complete });
const schema4ConditionModel = createCatalogModel({ schema: 6, targets: [], relations: {
  schema: 2, relationsComplete: true, relationCapabilities: [...REQUIRED_KCONFIG_RELATION_CAPABILITIES],
  records: [
    { kind: 'config', configSymbol: 'AST_GATE', kconfigSymbol: 'AST_GATE', type: 'bool', states: ['n', 'y'] },
    { kind: 'config', configSymbol: 'AST_VISIBLE', kconfigSymbol: 'AST_VISIBLE', type: 'bool', states: ['n', 'y'],
      visibleIf: ['AST_GATE'], visibleIfAst: [astCondition('AST_GATE', { kind: 'symbol', name: 'AST_GATE' })] },
    { kind: 'config', configSymbol: 'AST_PROMPT', kconfigSymbol: 'AST_PROMPT', type: 'bool', states: ['n', 'y'],
      promptIf: ['AST_GATE'], promptIfAst: [astCondition('AST_GATE', { kind: 'symbol', name: 'AST_GATE' })] },
    { kind: 'config', configSymbol: 'AST_MENU', kconfigSymbol: 'AST_MENU', type: 'bool', states: ['n', 'y'],
      menuVisibleIf: ['AST_GATE'], menuVisibleIfAst: [astCondition('AST_GATE', { kind: 'symbol', name: 'AST_GATE' })] },
    { kind: 'config', configSymbol: 'AST_CHOICE_A', kconfigSymbol: 'AST_CHOICE_A', type: 'bool', states: ['n', 'y'], choice: 'AST_CHOICE' },
  ],
  choices: [{ id: 'AST_CHOICE', type: 'bool', members: ['AST_CHOICE_A'], depends: ['AST_GATE'],
    dependsAst: [astCondition('AST_GATE', { kind: 'symbol', name: 'AST_GATE' })],
    promptIf: ['AST_GATE'], promptIfAst: [astCondition('AST_GATE', { kind: 'symbol', name: 'AST_GATE' })],
    visibleIf: ['AST_GATE'], visibleIfAst: [astCondition('AST_GATE', { kind: 'symbol', name: 'AST_GATE' })],
    menuVisibleIf: ['AST_GATE'], menuVisibleIfAst: [astCondition('AST_GATE', { kind: 'symbol', name: 'AST_GATE' })] }],
  indexes: { choices: { AST_CHOICE: ['AST_CHOICE_A'] } },
} });
const astEnabledValues = new Map([
  ['AST_GATE', 'y'], ['AST_VISIBLE', 'y'], ['AST_PROMPT', 'y'], ['AST_MENU', 'y'], ['AST_CHOICE_A', 'y'],
]);
assert(validateConfig(schema4ConditionModel, astEnabledValues, { deferred: 'error' }).length === 0,
  'schema-4 prompt/visible/menu/choice ASTs did not agree with their raw expressions');
const astDisabledValues = new Map(astEnabledValues).set('AST_GATE', 'n');
assert(validateConfig(schema4ConditionModel, astDisabledValues).filter((item) =>
  item.code === 'kconfig-visibility-unsatisfied').length === 0 &&
  validateConfig(schema4ConditionModel, astDisabledValues).some((item) => item.code === 'choice-dependency-unsatisfied'),
  'visibility must not invalidate native values, while choice dependencies remain enforced');
for (const symbol of ['AST_VISIBLE', 'AST_PROMPT', 'AST_MENU']) {
  const constraints = kconfigStateConstraints(schema4ConditionModel,
    schema4ConditionModel.bySymbol.get(symbol), astDisabledValues);
  assert(constraints.readOnly && constraints.selectableStates.length === 0 &&
    constraints.visibilityViolations.some((item) => item.code === 'kconfig-visibility-unsatisfied'),
    'hidden prompts must prevent direct menu edits without invalidating native values');
  expectThrow(() => applyUserIntent(schema4ConditionModel, astDisabledValues, { symbol, value: 'n' }),
    /cannot be set/, 'a hidden prompt allowed a manual edit');
}
const incompleteAstModel = createCatalogModel({ schema: 6, targets: [], relations: {
  schema: 2, relationsComplete: true, relationCapabilities: [...REQUIRED_KCONFIG_RELATION_CAPABILITIES],
  records: [{ kind: 'config', configSymbol: 'AST_GATE', kconfigSymbol: 'AST_GATE', type: 'bool', states: ['n', 'y'] },
    { kind: 'config', configSymbol: 'AST_VISIBLE', kconfigSymbol: 'AST_VISIBLE', type: 'bool', states: ['n', 'y'],
      visibleIf: ['AST_GATE'], visibleIfAst: [astCondition('AST_GATE', null, false)] }], indexes: {},
} });
assert(kconfigStateConstraints(incompleteAstModel, incompleteAstModel.bySymbol.get('AST_VISIBLE'),
  new Map([['AST_GATE', 'y'], ['AST_VISIBLE', 'y']])).visibilityViolations
  .some((item) => item.code === 'kconfig-visibility-deferred' && item.deferred === true),
  'typed visibility with an incomplete AST silently fell back to raw evaluation');
const inconsistentAstModel = createCatalogModel({ schema: 6, targets: [], relations: {
  schema: 2, relationsComplete: true, relationCapabilities: [...REQUIRED_KCONFIG_RELATION_CAPABILITIES],
  records: [{ kind: 'config', configSymbol: 'AST_GATE', kconfigSymbol: 'AST_GATE', type: 'bool', states: ['n', 'y'] },
    { kind: 'config', configSymbol: 'AST_VISIBLE', kconfigSymbol: 'AST_VISIBLE', type: 'bool', states: ['n', 'y'],
      visibleIf: ['AST_GATE'], visibleIfAst: [astCondition('AST_GATE', { kind: 'symbol', name: 'OTHER_GATE' })] }], indexes: {},
} });
assert(kconfigStateConstraints(inconsistentAstModel, inconsistentAstModel.bySymbol.get('AST_VISIBLE'),
  new Map([['AST_GATE', 'y'], ['AST_VISIBLE', 'y']])).visibilityViolations
  .some((item) => item.code === 'kconfig-visibility-deferred'),
  'raw/AST visibility mismatch was treated as a valid condition');

const absentScalarModel = createCatalogModel({ schema: 6, relations: { schema: 2, records:
  ['string', 'int', 'hex'].map((type) => ({ kind: 'config', configSymbol: `ABSENT_${type}`,
    kconfigSymbol: `ABSENT_${type}`, type, kconfig: { dependsExpressions: [['UNRESOLVED_GATE']] } })) } });
assert(validateConfig(absentScalarModel, new Map(), { deferred: 'error' }).length === 0,
  'an absent native scalar was validated as an enabled user value');

const normalizedRelationModel = createCatalogModel({ schema: 6, targets: [], relations: {
  schema: 2, relationsComplete: true, relationCapabilities: [...REQUIRED_KCONFIG_RELATION_CAPABILITIES],
  records: [
    { kind: 'config', configSymbol: 'REL_SOURCE', kconfigSymbol: 'REL_SOURCE', type: 'bool', states: ['n', 'y'],
      kconfig: { selectRelations: [{ target: 'REL_TARGET' }, { symbol: 'REL_TARGET' }, { name: 'REL_TARGET' }] } },
    { kind: 'config', configSymbol: 'REL_TARGET', kconfigSymbol: 'REL_TARGET', type: 'bool', states: ['n', 'y'] },
    { kind: 'config', configSymbol: 'REL_MISSING', kconfigSymbol: 'REL_MISSING', type: 'bool', states: ['n', 'y'],
      kconfig: { implyRelations: [{ condition: 'REL_TARGET' }] } },
  ], indexes: {},
} });
assert(normalizedRelationModel.bySymbol.get('REL_SOURCE').selectRelations.every((row) =>
  row.target === 'REL_TARGET' && row.symbol === 'REL_TARGET' && row.name === 'REL_TARGET'),
  'select relation target/symbol/name fields were not normalized to one identity');
assert(validateConfig(normalizedRelationModel, new Map([['REL_MISSING', 'y']]), { deferred: 'error' })
  .some((item) => item.code === 'kconfig-relation-deferred' && item.reason === 'missing-target'),
  'a typed select/imply relation with no target was silently skipped');

// A virtual capability is only a provider namespace.  It must never become a
// synthetic CONFIG_/PACKAGE_ symbol or a selectable/probe package of its own.
const virtualIdentityModel = createCatalogModel({ schema: 5, targets: [], relations: {
  schema: 2,
  records: [
    { kind: 'virtual', name: 'libudev', configSymbol: 'libudev', package: 'libudev' },
    { kind: 'package', package: 'libudev-zero', configSymbol: 'PACKAGE_libudev-zero',
      kconfigSymbol: 'PACKAGE_libudev-zero', states: ['n', 'y'],
      packageInfo: { provides: ['libudev'] } },
  ], indexes: { providers: { libudev: ['libudev-zero'] }, reverseDependencies: {}, reverseKconfig: {}, choices: {} },
} });
assert(!virtualIdentityModel.bySymbol.has('libudev') && !virtualIdentityModel.byPackage.has('libudev') &&
  virtualIdentityModel.byPackage.get('libudev-zero')?.packageInfo.provides.includes('libudev'),
  'virtual capability was promoted to a synthetic Kconfig/package identity');

// Choice metadata and MODULES are part of the same shared evaluator contract:
// a tristate member may be M only while MODULES is enabled, and a choice's
// own dependency/default must be evaluated before package compatibility rules.
const choiceModulesModel = createCatalogModel({ schema: 6, targets: [], relations: {
  schema: 2,
  records: [
    { kind: 'config', configSymbol: 'MODULES', kconfigSymbol: 'MODULES', type: 'bool', states: ['n', 'y'] },
    { kind: 'config', configSymbol: 'CHOICE_GATE', kconfigSymbol: 'CHOICE_GATE', type: 'bool', states: ['n', 'y'] },
    { kind: 'package', package: 'choice-a', configSymbol: 'PACKAGE_choice-a',
      kconfigSymbol: 'PACKAGE_choice-a', type: 'tristate', states: ['n', 'm', 'y'], choice: 'C_MODE' },
    { kind: 'package', package: 'choice-b', configSymbol: 'PACKAGE_choice-b',
      kconfigSymbol: 'PACKAGE_choice-b', type: 'tristate', states: ['n', 'm', 'y'], choice: 'C_MODE' },
  ],
  choices: [{ id: 'C_MODE', type: 'tristate', optional: false, modules: true,
    depends: ['CHOICE_GATE'], defaults: ['PACKAGE_choice-a'] }],
  indexes: { providers: {}, reverseDependencies: {}, reverseKconfig: {}, choices: {
    C_MODE: ['PACKAGE_choice-a', 'PACKAGE_choice-b'],
  } },
  validation: { relationsComplete: true },
} });
const moduleOff = parseConfigDocument([
  'CONFIG_MODULES=n', 'CONFIG_PACKAGE_choice-a=m', 'CONFIG_CHOICE_GATE=y',
].join('\n'));
assert(kconfigStateConstraints(choiceModulesModel, choiceModulesModel.bySymbol.get('PACKAGE_choice-a'), moduleOff)
  .legalStates.join(',') === 'n,y' && validateConfig(choiceModulesModel, moduleOff)
    .some((item) => item.code === 'kconfig-modules-unsatisfied'),
  'MODULES=n did not remove M from tristate states and report an imported M value');
const moduleOn = parseConfigDocument([
  'CONFIG_MODULES=y', 'CONFIG_PACKAGE_choice-a=m', 'CONFIG_CHOICE_GATE=y',
].join('\n'));
assert(kconfigStateConstraints(choiceModulesModel, choiceModulesModel.bySymbol.get('PACKAGE_choice-a'), moduleOn)
  .legalStates.join(',') === 'n,m,y' && !validateConfig(choiceModulesModel, moduleOn)
    .some((item) => item.code === 'kconfig-modules-unsatisfied'),
  'MODULES=y incorrectly rejected a tristate M value');
const blockedChoice = parseConfigDocument([
  'CONFIG_MODULES=y', 'CONFIG_PACKAGE_choice-a=y', 'CONFIG_CHOICE_GATE=n',
].join('\n'));
assert(validateConfig(choiceModulesModel, blockedChoice).some((item) =>
  item.code === 'choice-dependency-unsatisfied' && item.choice === 'C_MODE'),
  'choice dependency condition was not validated by the shared evaluator');
const choiceRule = { schema: 4, rules: [{ id: 'CHOICE-DEFAULT', issue: 'build-failure', match: 'all-selected',
  scope: { Demo: ['stable'] }, sourceCommits: ['a'.repeat(40)], packages: ['choice-a'], refs: ['run:choice'],
  failure: { phase: 'package-compile', cause: 'package-caused', code: 'fixture-choice' } }] };
const choiceDefaultResult = evaluateCompatibilityRules(choiceModulesModel, choiceRule,
  parseConfigDocument('CONFIG_MODULES=y\nCONFIG_CHOICE_GATE=y\n'), {
    sourceId: 'Demo', branchName: 'stable', sourceCommit: 'a'.repeat(40),
  });
assert(choiceDefaultResult.values.get('PACKAGE_choice-a') === 'y' && choiceDefaultResult.warnings.length === 1,
  'choice default was not materialized before compatibility evaluation');

// A package-only buildDependency rule is triggered by a graph path even when
// the failed target is currently N. The graph uses a required package/Kconfig
// edge, preserves the failed target in the plan, and does not need a manual
// triggerPackages list.
const graphDependencyModel = createCatalogModel({ schema: 6, targets: [], relations: {
  schema: 2,
  records: [
    { kind: 'package', package: 'docker', configSymbol: 'PACKAGE_docker',
      kconfigSymbol: 'PACKAGE_docker', states: ['n', 'y'],
      packageInfo: { depends: [{ raw: '+dockerd', required: true, packages: ['dockerd'] }] } },
    { kind: 'package', package: 'dockerd', configSymbol: 'PACKAGE_dockerd',
      kconfigSymbol: 'PACKAGE_dockerd', states: ['n', 'y'] },
  ],
    indexes: { providers: {}, reverseDependencies: {}, reverseKconfig: {}, choices: {} },
    packageClosureComplete: true,
    packageClosureCapabilities: ['complete-package-build-closure-v1'],
    validation: { relationsComplete: false },
} });
const graphDependencyRule = {
  schema: 4,
  rules: [{ id: 'BLD-GRAPH', issue: 'build-failure', match: 'all-selected',
    scope: { Demo: ['stable'] }, sourceCommits: ['a'.repeat(40)], packages: ['dockerd'],
    refs: ['run:graph'],
    failure: { phase: 'package-compile', cause: 'package-caused', code: 'fixture-graph' },
    buildDependency: { package: 'dockerd' } }],
};
const graphDependencyValues = parseConfigDocument([
  'CONFIG_PACKAGE_docker=y', '# CONFIG_PACKAGE_dockerd is not set',
].join('\n'));
const graphDependencyContext = { sourceId: 'Demo', branchName: 'stable', sourceCommit: 'a'.repeat(40) };
const normalizedGraphDocument = normalizeCompatibilityDocument(graphDependencyRule);
assert(evaluateNormalizedCompatibilityRules(graphDependencyModel, normalizedGraphDocument,
  graphDependencyValues, graphDependencyContext).warnings.length === 1,
  'trusted normalized rules must be reusable when refreshing a recommendation');
expectThrow(() => evaluateCompatibilityRules(graphDependencyModel, normalizedGraphDocument,
  graphDependencyValues, graphDependencyContext), /unsupported field.*legacy/i,
  'internal legacy flags must remain forbidden in external wire documents');
expectThrow(() => evaluateNormalizedCompatibilityRules(graphDependencyModel,
  JSON.parse(JSON.stringify(normalizedGraphDocument)), graphDependencyValues, graphDependencyContext),
  /normalized compatibility document/i, 'a serialized copy is not a trusted normalized document');
const graphDependencyWarning = evaluateCompatibilityRules(
  graphDependencyModel, graphDependencyRule, graphDependencyValues, graphDependencyContext,
).warnings[0];
assert(graphDependencyModel.relationsComplete === false && graphDependencyModel.packageClosureComplete === true &&
  graphDependencyWarning?.rule.buildDependency.legacy === false &&
  graphDependencyWarning.records.map((record) => record.package).join(',') === 'dockerd',
  'package-only buildDependency did not trigger from an active consumer reaching an N target');
const graphDependencyPlans = deriveCompatibilityPlans(
  graphDependencyModel, graphDependencyValues, graphDependencyWarning,
);
assert(graphDependencyPlans.recommended?.steps.some((step) => step.package === 'docker') &&
  graphDependencyPlans.recommended.requiredTargets.some((target) => target.package === 'dockerd') &&
  evaluateCompatibilityRules(graphDependencyModel, graphDependencyRule,
    graphDependencyPlans.recommended.values, graphDependencyContext).warnings.length === 0,
  'graph-derived package-only plan did not disable the active root and failed target atomically');

// Without the explicit narrow closure assertion a package-only rule is
// inconclusive, even if a readable legacy relation object happens to contain
// the same package names.
const incompleteGraphModel = createCatalogModel(structuredClone({
  schema: 6, targets: [], relations: {
    schema: 2,
    records: graphDependencyModel.records,
    indexes: { providers: {}, reverseDependencies: {}, reverseKconfig: {}, choices: {} },
    validation: { relationsComplete: false },
  },
}));
const incompleteGraphResult = evaluateCompatibilityRules(
  incompleteGraphModel, graphDependencyRule, graphDependencyValues, graphDependencyContext,
);
assert(incompleteGraphResult.warnings.length === 0,
  'package-only compatibility warning bypassed the missing package-closure contract');

// OR expressions are alternatives, not a list of mandatory edges. Only the
// branch that is actually selected may reach the failed package; all-N or
// unresolved alternatives remain inconclusive and must not warn.
const graphOrModel = createCatalogModel({ schema: 6, targets: [], relations: {
  schema: 2,
  records: [
    { kind: 'package', package: 'or-consumer', configSymbol: 'PACKAGE_or-consumer',
      kconfigSymbol: 'PACKAGE_or-consumer', states: ['n', 'y'],
      kconfig: { dependsExpressions: [['PACKAGE_or-a || PACKAGE_or-b']] } },
    { kind: 'package', package: 'or-a', configSymbol: 'PACKAGE_or-a',
      kconfigSymbol: 'PACKAGE_or-a', states: ['n', 'y'] },
    { kind: 'package', package: 'or-b', configSymbol: 'PACKAGE_or-b',
      kconfigSymbol: 'PACKAGE_or-b', states: ['n', 'y'] },
  ],
  indexes: { providers: {}, reverseDependencies: {}, reverseKconfig: {}, choices: {} },
  packageClosureComplete: true,
  packageClosureCapabilities: ['complete-package-build-closure-v1'],
  validation: { relationsComplete: true },
} });
const graphOrRule = {
  schema: 4,
  rules: [{ id: 'BLD-OR', issue: 'build-failure', match: 'all-selected',
    scope: { Demo: ['stable'] }, sourceCommits: ['a'.repeat(40)], packages: ['or-a'],
    refs: ['run:or'], failure: { phase: 'package-compile', cause: 'package-caused', code: 'fixture-or' },
    buildDependency: { package: 'or-a' } }],
};
const orResult = (a, b) => evaluateCompatibilityRules(graphOrModel, graphOrRule,
  parseConfigDocument([ 'CONFIG_PACKAGE_or-consumer=y', `CONFIG_PACKAGE_or-a=${a}`,
    `CONFIG_PACKAGE_or-b=${b}` ].join('\n')), graphDependencyContext);
assert(orResult('n', 'n').warnings.length === 0 && orResult('n', 'y').warnings.length === 0 &&
  orResult('y', 'n').warnings.length === 1,
  'graph planner treated an OR dependency as two unconditional package edges');

// The same alternative is exercised through the schema-4 lossless AST, not
// only through the legacy expression spelling. This prevents a compact
// decoder regression from reintroducing static references as mandatory edges.
const astGraphStrings = ['PACKAGE_ast-consumer', 'PACKAGE_ast-a', 'PACKAGE_ast-b'];
const astGraphRecord = (symbolId, definitionsId = -1) => [
  symbolId, 31, 2, 2, 7, -1, 0, 0, 0, 0, 0, 0, 0, -1, -1, -1, -1, -1, -1, -1,
  -1, -1, -1, -1, -1, -1, -1, -1, definitionsId, 0,
];
const astGraphCompact = {
  ...compactRelationsV4,
  strings: astGraphStrings,
  stringLists: [[]], expressionLists: [[]], expressionVariants: [[]], defaults: [[]],
  typedDefaults: [[]], ranges: [[]], packageDependencies: [[]], capabilities: [{ provides: [], conflicts: [] }],
  kconfigConflicts: [[]],
  definitions: [[{ dependsAst: [{ raw: 'PACKAGE_ast-a || PACKAGE_ast-b', complete: true, ast: {
    kind: 'or', values: [
      { kind: 'symbol', name: 'PACKAGE_ast-a' }, { kind: 'symbol', name: 'PACKAGE_ast-b' },
    ],
  } }] }]],
  edges: [], numberLists: [],
  indexes: { providers: [], reverseDependencies: [], reverseKconfig: [], reverseSelects: [],
    reverseImplies: [], choices: [], forwardEdges: [], reverseEdges: [] },
  records: [astGraphRecord(0, 0), astGraphRecord(1), astGraphRecord(2)],
};
const astOrModel = createCatalogModel({ schema: 6, targets: [], relations: astGraphCompact });
const astOrRule = { ...graphOrRule, rules: [{ ...graphOrRule.rules[0], packages: ['ast-a'],
  buildDependency: { package: 'ast-a' } }] };
const astOrResult = (a, b) => evaluateCompatibilityRules(astOrModel, astOrRule,
  parseConfigDocument([ 'CONFIG_PACKAGE_ast-consumer=y', `CONFIG_PACKAGE_ast-a=${a}`,
    `CONFIG_PACKAGE_ast-b=${b}` ].join('\n')), graphDependencyContext);
assert(astOrResult('n', 'n').warnings.length === 0 && astOrResult('n', 'y').warnings.length === 0 &&
  astOrResult('y', 'n').warnings.length === 1,
  'schema-4 AST alternatives were not evaluated as conditional graph edges');

// Package-info conditions are graph predicates, not unconditional reverse
// references.  An inactive condition must not make an N failed package look
// reachable; an active condition must produce the same warning/recommendation
// path as an unconditional dependency.
const conditionalGraphModel = createCatalogModel({ schema: 6, targets: [], relations: {
  schema: 2,
  records: [
    { kind: 'config', configSymbol: 'GRAPH_CONDITION', kconfigSymbol: 'GRAPH_CONDITION',
      type: 'bool', states: ['n', 'y'] },
    { kind: 'package', package: 'conditional-root', configSymbol: 'PACKAGE_conditional-root',
      kconfigSymbol: 'PACKAGE_conditional-root', states: ['n', 'y'],
      packageInfo: { depends: [{ raw: '+conditional-failed if GRAPH_CONDITION', required: true,
        condition: 'GRAPH_CONDITION', packages: ['conditional-failed'] }] } },
    { kind: 'package', package: 'conditional-failed', configSymbol: 'PACKAGE_conditional-failed',
      kconfigSymbol: 'PACKAGE_conditional-failed', states: ['n', 'y'] },
  ],
  indexes: { providers: {}, reverseDependencies: {}, reverseKconfig: {}, choices: {} },
  packageClosureComplete: true,
  packageClosureCapabilities: ['complete-package-build-closure-v1'],
  validation: { relationsComplete: false },
} });
const conditionalGraphRule = {
  schema: 4,
  rules: [{ id: 'BLD-CONDITION', issue: 'build-failure', match: 'all-selected',
    scope: { Demo: ['stable'] }, sourceCommits: ['a'.repeat(40)], packages: ['conditional-failed'],
    refs: ['run:condition'],
    failure: { phase: 'package-compile', cause: 'package-caused', code: 'fixture-condition' },
    buildDependency: { package: 'conditional-failed' } }],
};
const conditionalContext = { sourceId: 'Demo', branchName: 'stable', sourceCommit: 'a'.repeat(40) };
const conditionalResult = (condition) => evaluateCompatibilityRules(conditionalGraphModel,
  conditionalGraphRule, parseConfigDocument([
    `CONFIG_GRAPH_CONDITION=${condition}`,
    'CONFIG_PACKAGE_conditional-root=y', '# CONFIG_PACKAGE_conditional-failed is not set',
  ].join('\n')), conditionalContext);
assert(conditionalResult('n').warnings.length === 0 && conditionalResult('y').warnings.length === 1,
  'package-info condition was not applied to graph reachability');

// Two direct roots may share one dependency.  The graph planner must disable
// both roots and the failed target, while leaving the shared package untouched
// so a surviving/independent consumer can continue using it.
const sharedGraphModel = createCatalogModel({ schema: 6, targets: [], relations: {
  schema: 2,
  records: [
    { kind: 'package', package: 'shared-root-a', configSymbol: 'PACKAGE_shared-root-a',
      kconfigSymbol: 'PACKAGE_shared-root-a', states: ['n', 'y'],
      packageInfo: { depends: [
        { raw: '+shared-graph', required: true, packages: ['shared-graph'] },
        { raw: '+shared-failed', required: true, packages: ['shared-failed'] },
      ] } },
    { kind: 'package', package: 'shared-root-b', configSymbol: 'PACKAGE_shared-root-b',
      kconfigSymbol: 'PACKAGE_shared-root-b', states: ['n', 'y'],
      packageInfo: { depends: [{ raw: '+shared-graph', required: true, packages: ['shared-graph'] }] } },
    { kind: 'package', package: 'shared-graph', configSymbol: 'PACKAGE_shared-graph',
      kconfigSymbol: 'PACKAGE_shared-graph', states: ['n', 'y'] },
    { kind: 'package', package: 'shared-failed', configSymbol: 'PACKAGE_shared-failed',
      kconfigSymbol: 'PACKAGE_shared-failed', states: ['n', 'y'] },
  ],
  indexes: { providers: {}, reverseDependencies: {}, reverseKconfig: {}, choices: {} },
  packageClosureComplete: true,
  packageClosureCapabilities: ['complete-package-build-closure-v1'],
  validation: { relationsComplete: false },
} });
const sharedGraphRule = {
  schema: 4,
  rules: [{ id: 'BLD-SHARED', issue: 'build-failure', match: 'all-selected',
    scope: { Demo: ['stable'] }, sourceCommits: ['a'.repeat(40)], packages: ['shared-failed'],
    refs: ['run:shared'],
    failure: { phase: 'package-compile', cause: 'package-caused', code: 'fixture-shared' },
    buildDependency: { package: 'shared-failed' } }],
};
const sharedGraphValues = parseConfigDocument([
  'CONFIG_PACKAGE_shared-root-a=y', 'CONFIG_PACKAGE_shared-root-b=y',
  'CONFIG_PACKAGE_shared-graph=y', '# CONFIG_PACKAGE_shared-failed is not set',
].join('\n'));
const sharedGraphWarning = evaluateCompatibilityRules(sharedGraphModel, sharedGraphRule,
  sharedGraphValues, conditionalContext).warnings[0];
const sharedGraphPlan = deriveCompatibilityPlans(sharedGraphModel, sharedGraphValues, sharedGraphWarning);
assert(sharedGraphWarning && sharedGraphPlan.recommended?.steps.map((step) => step.package).join(',') ===
  'shared-root-a,shared-failed' &&
  sharedGraphPlan.recommended.requiredTargets.map((target) => target.package).join(',') ===
    'shared-root-a,shared-failed' &&
  sharedGraphPlan.recommended.values.get('PACKAGE_shared-graph') === 'y' &&
  sharedGraphPlan.recommended.values.get('PACKAGE_shared-root-b') === 'y' &&
  evaluateCompatibilityRules(sharedGraphModel, sharedGraphRule, sharedGraphPlan.recommended.values,
    conditionalContext).warnings.length === 0,
  'shared package graph recommendation did not preserve the shared dependency while disabling all roots');

// Fault avoidance discovers downstream orphan candidates as well as reverse
// roots. The same algorithm applies to an arbitrary daemon/runtime chain.
const cleanupRows = [
  ['client-ui', ['client']], ['client', ['daemon']], ['daemon', ['runtime', 'init']],
  ['runtime', ['executor']], ['init', []], ['executor', []], ['unrelated', []],
].map(([name, dependencies]) => ({ kind: 'package', package: name, configSymbol: `PACKAGE_${name}`,
  kconfigSymbol: `PACKAGE_${name}`, type: 'bool', states: ['n', 'y'],
  packageInfo: { depends: dependencies.map((target) => ({ raw: `+${target}`, required: true, packages: [target] })) } }));
const cleanupModel = createCatalogModel({ schema: 6, relations: { schema: 2, records: cleanupRows,
  packageClosureComplete: true, packageClosureCapabilities: ['complete-package-build-closure-v1'],
  indexes: {} } });
const cleanupRule = { schema: 4, rules: [{ ...graphDependencyRule.rules[0],
  id: 'BLD-CLEANUP', packages: ['daemon'], buildDependency: { package: 'daemon' } }] };
const cleanupValues = new Map(cleanupRows.map((record) => [record.configSymbol, 'y']));
const cleanupWarning = evaluateCompatibilityRules(cleanupModel, cleanupRule, cleanupValues, conditionalContext).warnings[0];
const cleanupPlan = deriveCompatibilityPlans(cleanupModel, cleanupValues, cleanupWarning).recommended;
assert(cleanupPlan && ['client-ui', 'client', 'daemon', 'runtime', 'init', 'executor'].every((name) =>
  cleanupPlan.values.get(`PACKAGE_${name}`) === 'n') && cleanupPlan.values.get('PACKAGE_unrelated') === 'y',
  'graph-derived avoidance must clear related orphans without disabling an unrelated package');
assert(['runtime', 'init', 'executor'].every((name) => cleanupPlan.automaticChanges.some((change) =>
  change.symbol === `PACKAGE_${name}` && change.to === 'n')), 'orphan cleanup must be reported as automatic changes');
const protectedCleanup = deriveCompatibilityPlans(cleanupModel, cleanupValues, cleanupWarning, {
  protectedSymbols: new Set(['PACKAGE_init']),
}).recommended;
assert(protectedCleanup.values.get('PACKAGE_init') === 'y' &&
  protectedCleanup.retainedDependencies.includes('PACKAGE_init'),
  'an independently protected dependency must be retained and reported');
const inactiveFailedValues = new Map(cleanupValues); inactiveFailedValues.set('PACKAGE_daemon', 'n');
const inactiveFailedWarning = evaluateCompatibilityRules(cleanupModel, cleanupRule, inactiveFailedValues, conditionalContext).warnings[0];
const inactiveFailedPlan = deriveCompatibilityPlans(cleanupModel, inactiveFailedValues, inactiveFailedWarning).recommended;
assert(inactiveFailedPlan && ['client-ui', 'client', 'daemon', 'runtime', 'init', 'executor'].every((name) =>
  inactiveFailedPlan.values.get(`PACKAGE_${name}`) === 'n'),
  'an already-disabled failed package must not hide its orphan dependency candidates');
for (const condition of ['', 'MISSING_SHARED_CONDITION']) {
  const sharedRows = [...cleanupRows, { kind: 'package', package: 'other-service',
    configSymbol: 'PACKAGE_other-service', kconfigSymbol: 'PACKAGE_other-service', type: 'bool', states: ['n', 'y'],
    packageInfo: { depends: [{ required: true, packages: ['runtime'], condition }] } }];
  const sharedModel = createCatalogModel({ schema: 6, relations: { schema: 2, records: sharedRows,
    packageClosureComplete: true, packageClosureCapabilities: ['complete-package-build-closure-v1'], indexes: {} } });
  const sharedValues = new Map([...cleanupValues, ['PACKAGE_other-service', 'y']]);
  const sharedWarning = evaluateCompatibilityRules(sharedModel, cleanupRule, sharedValues, conditionalContext).warnings[0];
  const sharedPlan = deriveCompatibilityPlans(sharedModel, sharedValues, sharedWarning).recommended;
  assert(sharedPlan && ['runtime', 'executor', 'other-service'].every((name) =>
    sharedPlan.values.get(`PACKAGE_${name}`) === 'y') && sharedPlan.values.get('PACKAGE_daemon') === 'n',
    'shared or unresolved consumers must retain dependencies without preserving the failed target');
}

// A package with no path to the failed target must not warn.  If an active
// path is accompanied by an unresolved conditional relation, the result is
// likewise fail-closed rather than a guessed compatibility conclusion.
const noPathGraphModel = createCatalogModel({ schema: 6, targets: [], relations: {
  schema: 2,
  records: [
    { kind: 'package', package: 'unrelated-root', configSymbol: 'PACKAGE_unrelated-root',
      kconfigSymbol: 'PACKAGE_unrelated-root', states: ['n', 'y'] },
    { kind: 'package', package: 'unreachable-failed', configSymbol: 'PACKAGE_unreachable-failed',
      kconfigSymbol: 'PACKAGE_unreachable-failed', states: ['n', 'y'] },
  ],
  indexes: { providers: {}, reverseDependencies: {}, reverseKconfig: {}, choices: {} },
  packageClosureComplete: true,
  packageClosureCapabilities: ['complete-package-build-closure-v1'],
  validation: { relationsComplete: false },
} });
const noPathRule = {
  schema: 4,
  rules: [{ id: 'BLD-NOPATH', issue: 'build-failure', match: 'all-selected',
    scope: { Demo: ['stable'] }, sourceCommits: ['a'.repeat(40)], packages: ['unreachable-failed'],
    refs: ['run:no-path'],
    failure: { phase: 'package-compile', cause: 'package-caused', code: 'fixture-no-path' },
    buildDependency: { package: 'unreachable-failed' } }],
};
assert(evaluateCompatibilityRules(noPathGraphModel, noPathRule,
  parseConfigDocument('CONFIG_PACKAGE_unrelated-root=y\n'), conditionalContext).warnings.length === 0,
  'a package graph without a path to the failed target produced a warning');

const unknownGraphModel = createCatalogModel({ schema: 6, targets: [], relations: {
  schema: 2,
  records: [
    { kind: 'package', package: 'unknown-root', configSymbol: 'PACKAGE_unknown-root',
      kconfigSymbol: 'PACKAGE_unknown-root', states: ['n', 'y'],
      packageInfo: { depends: [
        { raw: '+unknown-failed', required: true, packages: ['unknown-failed'] },
        { raw: '+unknown-extra if GRAPH_NOT_CATALOGED', required: true, condition: 'GRAPH_NOT_CATALOGED',
          packages: ['unknown-extra'] },
      ] } },
    { kind: 'package', package: 'unknown-failed', configSymbol: 'PACKAGE_unknown-failed',
      kconfigSymbol: 'PACKAGE_unknown-failed', states: ['n', 'y'] },
    { kind: 'package', package: 'unknown-extra', configSymbol: 'PACKAGE_unknown-extra',
      kconfigSymbol: 'PACKAGE_unknown-extra', states: ['n', 'y'] },
  ],
  indexes: { providers: {}, reverseDependencies: {}, reverseKconfig: {}, choices: {} },
  packageClosureComplete: true,
  packageClosureCapabilities: ['complete-package-build-closure-v1'],
  validation: { relationsComplete: false },
} });
const unknownGraphRule = {
  schema: 4,
  rules: [{ id: 'BLD-UNKNOWN', issue: 'build-failure', match: 'all-selected',
    scope: { Demo: ['stable'] }, sourceCommits: ['a'.repeat(40)], packages: ['unknown-failed'],
    refs: ['run:unknown'],
    failure: { phase: 'package-compile', cause: 'package-caused', code: 'fixture-unknown' },
    buildDependency: { package: 'unknown-failed' } }],
};
assert(evaluateCompatibilityRules(unknownGraphModel, unknownGraphRule,
  parseConfigDocument('CONFIG_PACKAGE_unknown-root=y\n'), conditionalContext).warnings.length === 0,
  'an unresolved package graph condition was treated as a definite compatibility warning');

const selfProviderModel = createCatalogModel({ schema: 5, targets: [], relations: {
  schema: 2,
  records: [{ kind: 'package', package: 'self-provider', configSymbol: 'PACKAGE_self-provider',
    kconfigSymbol: 'PACKAGE_self-provider', states: ['n', 'y'],
    packageInfo: { provides: ['virtual-self'], conflicts: ['virtual-self'] } }],
  indexes: { providers: { 'virtual-self': ['self-provider'] }, reverseDependencies: {}, reverseKconfig: {}, choices: {} },
  validation: { relationsComplete: true },
} });
assert(!validateConfig(selfProviderModel, parseConfigDocument('CONFIG_PACKAGE_self-provider=y\n'))
  .some((item) => item.code === 'package-conflict'),
  'a package was reported as conflicting with its own virtual capability provider');
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

// A complete Target/Profile closes omitted known bool/tristate symbols at N.
// This is required when a sparse Native baseline has not materialized every
// Catalog record in the current value map; scalar symbols and symbols absent
// from Catalog remain deferred.
const sparseClosureRecords = [
  { kind: 'config', configSymbol: 'SPARSE_GATE', kconfigSymbol: 'SPARSE_GATE',
    type: 'bool', states: ['n', 'y'], hidden: true, visible: false },
  { kind: 'config', configSymbol: 'SPARSE_NEGATIVE_TARGET', kconfigSymbol: 'SPARSE_NEGATIVE_TARGET',
    type: 'bool', states: ['n', 'y'] },
  { kind: 'config', configSymbol: 'SPARSE_POSITIVE_TARGET', kconfigSymbol: 'SPARSE_POSITIVE_TARGET',
    type: 'bool', states: ['n', 'y'] },
  { kind: 'config', configSymbol: 'SPARSE_NEGATIVE_ROOT', kconfigSymbol: 'SPARSE_NEGATIVE_ROOT',
    type: 'bool', states: ['n', 'y'],
    kconfig: { selectsExpressions: [['SPARSE_NEGATIVE_TARGET if !SPARSE_GATE']] } },
  { kind: 'config', configSymbol: 'SPARSE_POSITIVE_ROOT', kconfigSymbol: 'SPARSE_POSITIVE_ROOT',
    type: 'bool', states: ['n', 'y'],
    kconfig: { selectsExpressions: [['SPARSE_POSITIVE_TARGET if SPARSE_GATE']] } },
  { kind: 'config', configSymbol: 'SPARSE_CHAIN_ROOT', kconfigSymbol: 'SPARSE_CHAIN_ROOT',
    type: 'bool', states: ['n', 'y'],
    kconfig: { selectsExpressions: [['SPARSE_CHAIN_MIDDLE if !SPARSE_GATE']] } },
  { kind: 'config', configSymbol: 'SPARSE_CHAIN_MIDDLE', kconfigSymbol: 'SPARSE_CHAIN_MIDDLE',
    type: 'bool', states: ['n', 'y'],
    kconfig: { selectsExpressions: [['SPARSE_CHAIN_LEAF']] } },
  { kind: 'config', configSymbol: 'SPARSE_CHAIN_LEAF', kconfigSymbol: 'SPARSE_CHAIN_LEAF',
    type: 'bool', states: ['n', 'y'] },
];
const sparseClosureModel = createCatalogModel({
  schema: 5,
  targets: [],
  relations: { schema: 2, records: sparseClosureRecords, indexes: {} },
});
const sparseClosureTarget = {
  system: 'sparse', board: 'sparse', subtarget: '64', arch: 'ARCH_SPARSE',
  boardSelector: 'TARGET_sparse', targetSelector: 'TARGET_sparse_64',
  profileSelector: 'TARGET_sparse_64_DEVICE_generic', profileSymbol: 'DEVICE_generic',
  profile: 'generic', features: [], packages: [], profilePackages: [],
};
const sparseClosureContext = createCatalogValidationContext(
  sparseClosureModel, sparseClosureTarget, new Map(), { phase: 'interactive' },
);
assert(sparseClosureContext.validationOptions.closedSymbols.has('SPARSE_GATE') &&
  evaluateExpressionState('!SPARSE_GATE', sparseClosureContext.values,
    sparseClosureContext.validationOptions).status === 'satisfied',
  'a known omitted bool symbol was not closed to N for a complete Target/Profile');
assert(evaluateExpressionState('SPARSE_GATE', sparseClosureContext.values,
  sparseClosureContext.validationOptions).status === 'unsatisfied' &&
  evaluateExpressionState('SPARSE_NOT_IN_CATALOG', sparseClosureContext.values,
    sparseClosureContext.validationOptions).status === 'deferred',
  'known N and genuinely absent symbols did not retain distinct expression semantics');
const sparseNegative = applyUserIntent(sparseClosureModel, sparseClosureContext.values, {
  symbol: 'SPARSE_NEGATIVE_ROOT', value: 'y',
  validationOptions: sparseClosureContext.validationOptions,
});
assert(sparseNegative.values.get('SPARSE_NEGATIVE_TARGET') === 'y' &&
  (sparseNegative.values.get('SPARSE_POSITIVE_TARGET') ?? 'n') === 'n',
  'a known omitted N symbol did not activate a negative select while its positive select stayed closed');
const sparseChain = reconcileKconfigDerivedValues(sparseClosureModel,
  new Map([['SPARSE_CHAIN_ROOT', 'y']]), sparseClosureContext.validationOptions);
assert(sparseChain.values.get('SPARSE_CHAIN_MIDDLE') === 'y' &&
  sparseChain.values.get('SPARSE_CHAIN_LEAF') === 'y',
  'multi-level reverse-select convergence did not use the closed known-symbol context');
const sparseExplicitGateContext = createCatalogValidationContext(sparseClosureModel,
  sparseClosureTarget, new Map([['SPARSE_GATE', 'y']]), { phase: 'interactive' });
const sparseExplicitNegative = applyUserIntent(sparseClosureModel,
  sparseExplicitGateContext.values, {
    symbol: 'SPARSE_NEGATIVE_ROOT', value: 'y',
    validationOptions: sparseExplicitGateContext.validationOptions,
  });
assert((sparseExplicitNegative.values.get('SPARSE_NEGATIVE_TARGET') ?? 'n') === 'n',
  'an explicit Y gate did not disable the negative condition');
assert(applyUserIntent(sparseClosureModel, sparseExplicitGateContext.values, {
  symbol: 'SPARSE_POSITIVE_ROOT', value: 'y',
  validationOptions: sparseExplicitGateContext.validationOptions,
}).values.get('SPARSE_POSITIVE_TARGET') === 'y',
  'an explicit Y gate did not enable the positive condition');
const sparseIncompleteContext = createCatalogValidationContext(sparseClosureModel, {
  ...sparseClosureTarget, profileSelector: '', profileSymbol: '', profile: '',
}, new Map(), { phase: 'interactive' });
assert(!sparseIncompleteContext.validationOptions.closedSymbols.has('SPARSE_GATE') &&
  evaluateExpressionState('!SPARSE_GATE', sparseIncompleteContext.values,
    sparseIncompleteContext.validationOptions).status === 'deferred',
  'an incomplete Target/Profile incorrectly closed a known omitted symbol');

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
  ['string', '"say \\"if ready\\" now"', 'say "if ready" now'],
  ['string', escapedStringDefault, 'a"b\\c'],
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

// Choice reset-if is an interactive-only native frontend operation.  The
// shared model keeps the raw/typed condition pair, but refuses to silently
// clear the global user layer because that reset is not implemented in the
// browser/Worker evaluator.
const resetChoiceCatalog = (capabilities = REQUIRED_KCONFIG_RELATION_CAPABILITIES) => ({
  schema: 6,
  targets: [],
  relations: {
    schema: 2,
    relationsComplete: true,
    relationCapabilities: [...capabilities],
    records: [
      { kind: 'config', configSymbol: 'RESET_GATE', kconfigSymbol: 'RESET_GATE',
        type: 'tristate', states: ['n', 'm', 'y'] },
      { kind: 'config', configSymbol: 'RESET_A', kconfigSymbol: 'RESET_A',
        type: 'bool', states: ['n', 'y'], choice: 'RESET_CHOICE' },
      { kind: 'config', configSymbol: 'RESET_B', kconfigSymbol: 'RESET_B',
        type: 'bool', states: ['n', 'y'], choice: 'RESET_CHOICE' },
    ],
    choices: [{ id: 'RESET_CHOICE', type: 'bool', members: ['RESET_A', 'RESET_B'],
      resetIf: ['RESET_GATE'],
      resetIfAst: [{ raw: 'RESET_GATE', ast: { kind: 'symbol', name: 'RESET_GATE' }, complete: true }] }],
    indexes: { providers: {}, reverseDependencies: {}, reverseKconfig: {},
      choices: { RESET_CHOICE: ['RESET_A', 'RESET_B'] } },
  },
});
const resetChoiceModel = createCatalogModel(resetChoiceCatalog());
const resetRuntimeChoice = createRuntimeMenu(resetChoiceModel).choices.find((row) => row.id === 'RESET_CHOICE');
assert(resetChoiceModel.choiceDetails.get('RESET_CHOICE')?.resetIf?.[0] === 'RESET_GATE' &&
  resetChoiceModel.choiceDetails.get('RESET_CHOICE')?.resetIfAst?.[0]?.ast?.name === 'RESET_GATE' &&
  resetRuntimeChoice?.resetIf?.[0] === 'RESET_GATE' &&
  resetRuntimeChoice?.resetIfAst?.[0]?.ast?.name === 'RESET_GATE',
  'choice reset-if raw/AST fields were not retained through the canonical/runtime menu model');
const resetFalse = applyUserIntent(resetChoiceModel, parseConfigDocument([
  'CONFIG_RESET_GATE=n', 'CONFIG_RESET_A=y', '# CONFIG_RESET_B is not set',
].join('\n')), { symbol: 'RESET_B', value: 'y' });
assert(resetFalse.values.get('RESET_A') === 'n' && resetFalse.values.get('RESET_B') === 'y',
  'false choice reset-if condition did not allow an ordinary choice switch');
const resetTrueValues = parseConfigDocument([
  'CONFIG_RESET_GATE=y', 'CONFIG_RESET_A=y', '# CONFIG_RESET_B is not set',
].join('\n'));
let resetTrueError = null;
try { applyUserIntent(resetChoiceModel, resetTrueValues, { symbol: 'RESET_B', value: 'y' }); }
catch (error) { resetTrueError = error; }
assert(resetTrueError?.name === 'CatalogIntentError' && resetTrueError.unsupported === true &&
  resetTrueError.choiceReset?.mode === 'unsupported' &&
  resetTrueError.violations?.[0]?.code === 'choice-reset-unsupported' &&
  resetTrueError.violations?.[0]?.status === 'satisfied',
  'true choice reset-if condition did not fail closed with a structured unsupported intent error');
let resetModuleError = null;
try {
  applyUserIntent(resetChoiceModel, parseConfigDocument([
    'CONFIG_RESET_GATE=m', 'CONFIG_RESET_A=y', '# CONFIG_RESET_B is not set',
  ].join('\n')), { symbol: 'RESET_B', value: 'y' });
} catch (error) { resetModuleError = error; }
assert(resetModuleError?.choiceReset?.mode === 'unsupported' &&
  resetModuleError.violations?.[0]?.status === 'satisfied',
  'M-valued choice reset-if condition was not treated as an active native reset');
let resetUnknownError = null;
const unknownResetModel = createCatalogModel({ ...resetChoiceCatalog(), relations: {
  ...resetChoiceCatalog().relations,
  choices: [{ id: 'RESET_CHOICE', type: 'bool', members: ['RESET_A', 'RESET_B'],
    resetIf: ['RESET_UNKNOWN'],
    resetIfAst: [{ raw: 'RESET_UNKNOWN', ast: { kind: 'symbol', name: 'RESET_UNKNOWN' }, complete: true }] }],
} });
try {
  applyUserIntent(unknownResetModel, parseConfigDocument([
    'CONFIG_RESET_GATE=n', 'CONFIG_RESET_A=y', '# CONFIG_RESET_B is not set',
  ].join('\n')), { symbol: 'RESET_B', value: 'y' });
} catch (error) { resetUnknownError = error; }
assert(resetUnknownError?.name === 'CatalogIntentError' && resetUnknownError.deferred === true &&
  resetUnknownError.choiceReset?.mode === 'deferred' &&
  resetUnknownError.violations?.[0]?.code === 'choice-reset-deferred',
  'unknown choice reset-if condition did not remain deferred');
const missingResetCapabilityModel = createCatalogModel(resetChoiceCatalog(
  REQUIRED_KCONFIG_RELATION_CAPABILITIES.filter((capability) => capability !== 'choice-reset-conditions-v1')));
let missingResetCapabilityError = null;
try {
  applyUserIntent(missingResetCapabilityModel, resetTrueValues, { symbol: 'RESET_B', value: 'y' });
} catch (error) { missingResetCapabilityError = error; }
assert(missingResetCapabilityModel.typedRelationsComplete === false &&
  missingResetCapabilityError?.deferred === true &&
  missingResetCapabilityError.violations?.[0]?.reason === 'missing-choice-reset-capability',
  'missing choice-reset capability was not handled as a deferred interactive intent');
const sameMember = applyUserIntent(resetChoiceModel, resetTrueValues, { symbol: 'RESET_A', value: 'y' });
assert(sameMember.values.get('RESET_A') === 'y' && !sameMember.changes.length,
  'clicking the already-Y choice member incorrectly invoked reset handling');
const disableMember = applyUserIntent(resetChoiceModel, resetTrueValues, { symbol: 'RESET_A', value: 'n' });
assert(disableMember.values.get('RESET_A') === 'n',
  'disabling a choice member incorrectly invoked reset handling');
assert(validateConfig(resetChoiceModel, resetTrueValues).every((item) =>
  !String(item.code || '').startsWith('choice-reset-')),
  'non-interactive validation incorrectly rejected a true reset-if condition');
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

// Configuration preflight repairs only deterministic dependency violations.
// A package with one provider is replayed through the normal intent cascade,
// so a direct package dependency is repaired without a second resolver.
const packageRepair = deriveConfigurationRepairPlan(model, parseConfigDocument([
  'CONFIG_PACKAGE_ui-service=y',
  '# CONFIG_PACKAGE_core-service is not set',
].join('\n')));
assert(packageRepair.initialViolations.length === 1 &&
  packageRepair.initialViolations[0].code === 'package-dependency-unsatisfied' &&
  packageRepair.actions.length === 1 &&
  packageRepair.actions[0].symbol === 'PACKAGE_ui-service' &&
  packageRepair.actions[0].steps.length === 0 &&
  packageRepair.values.get('PACKAGE_core-service') === 'y' &&
  packageRepair.unresolved.length === 0,
  'unique package dependency was not repaired through the normal intent cascade');
assert(packageRepair.changes.some((change) => change.symbol === 'PACKAGE_core-service' &&
  change.reason === 'package-dependency') &&
  packageRepair.actions[0].changes.some((change) => change.symbol === 'PACKAGE_core-service'),
  'package dependency repair did not expose its automatic cascade changes');

// Recommendations and direct edits must drain changes from every mutation
// phase, including inherited preferences and orphan cleanup, not just clicks.
const convergenceRecords = [
  { kind: 'config', configSymbol: 'OWNER', type: 'bool', states: ['n', 'y'] },
  { kind: 'config', configSymbol: 'ROOT', type: 'bool', states: ['n', 'y'],
    kconfig: { selectsExpressions: [['OWNER']] } },
  { kind: 'config', configSymbol: 'CHILD', type: 'bool', states: ['n', 'y'],
    kconfig: { dependsExpressions: [['OWNER']] } },
  { kind: 'config', configSymbol: 'LEAF', type: 'bool', states: ['n', 'y'],
    kconfig: { dependsExpressions: [['CHILD']] } },
  { kind: 'config', configSymbol: 'OTHER', type: 'bool', states: ['n', 'y'] },
  { kind: 'config', configSymbol: 'SHARED', type: 'bool', states: ['n', 'y'],
    kconfig: { dependsExpressions: [['OWNER || OTHER']] } },
];
const convergenceModel = createCatalogModel({ schema: 5, targets: [], relations: {
  schema: 2, records: convergenceRecords, indexes: {},
} });
const convergenceValues = new Map(convergenceRecords.map((row) => [row.configSymbol, 'y']));
const moduleConvergenceModel = createCatalogModel({ schema: 5, targets: [], relations: {
  schema: 2, indexes: {}, records: convergenceRecords.map((row) =>
    ({ ...row, type: 'tristate', states: ['n', 'm', 'y'] })),
} });
const moduleLowered = applyUserIntent(moduleConvergenceModel,
  new Map([...convergenceValues, ['ROOT', 'n']]), { symbol: 'OWNER', value: 'm' });
assert(moduleLowered.values.get('CHILD') === 'm' && moduleLowered.values.get('LEAF') === 'm',
  'a lowered M dependency ceiling disabled tristate children instead of clamping them to M');
for (const intentOptions of [
  { preferredValues: new Map([['OWNER', 'n']]) },
]) {
  const settled = applyUserIntent(convergenceModel, convergenceValues, {
    symbol: 'ROOT', value: 'n', ...intentOptions,
  });
  assert(['ROOT', 'OWNER', 'CHILD', 'LEAF'].every((symbol) => settled.values.get(symbol) === 'n') &&
    settled.values.get('SHARED') === 'y' && !settled.violations.length,
    'derived owner shutdown did not converge through dependent children or damaged an alternative dependency');
  const repeated = applyUserIntent(convergenceModel, settled.values, {
    symbol: 'ROOT', value: 'n', ...intentOptions,
  });
  assert(!repeated.changes.length && !repeated.violations.length,
    'a second check changed an already settled recommendation');
}
const retainedOwner = applyUserIntent(convergenceModel, convergenceValues, {
  symbol: 'ROOT', value: 'n', dependencySymbols: new Set(['OWNER']),
});
assert(retainedOwner.values.get('OWNER') === 'y' && retainedOwner.values.get('CHILD') === 'y',
  'orphan pruning removed an owner still required by a surviving child');
const choiceConvergenceModel = createCatalogModel({ schema: 5, targets: [], relations: {
  schema: 2, indexes: { choices: { OWNER_CHOICE: ['CHOICE_A', 'CHOICE_B'] } }, records: [
    { kind: 'config', configSymbol: 'CHOICE_A', type: 'bool', states: ['n', 'y'], choice: 'OWNER_CHOICE' },
    { kind: 'config', configSymbol: 'CHOICE_B', type: 'bool', states: ['n', 'y'], choice: 'OWNER_CHOICE' },
    { kind: 'config', configSymbol: 'CHOICE_CHILD', type: 'bool', states: ['n', 'y'],
      kconfig: { dependsExpressions: [['CHOICE_A']] } },
  ],
} });
const choiceConverged = applyUserIntent(choiceConvergenceModel,
  new Map([['CHOICE_A', 'y'], ['CHOICE_B', 'n'], ['CHOICE_CHILD', 'y']]), { symbol: 'CHOICE_B', value: 'y' });
assert(choiceConverged.values.get('CHOICE_CHILD') === 'n' && !choiceConverged.violations.length,
  'choice replacement left stale children of the deselected member');
const staleDescendants = new Map(convergenceValues);
for (const symbol of ['ROOT', 'OWNER', 'CHILD']) staleDescendants.set(symbol, 'n');
const recoveredDescendants = deriveConfigurationRepairPlan(convergenceModel, staleDescendants, {
  disabledSymbols: ['OWNER', 'CHILD'],
});
assert(recoveredDescendants.actions.length === 1 && recoveredDescendants.actions[0].kind === 'reconcile' &&
  recoveredDescendants.values.get('LEAF') === 'n' && recoveredDescendants.values.get('OWNER') === 'n' &&
  recoveredDescendants.values.get('SHARED') === 'y' && !recoveredDescendants.unresolved.length,
  'stale descendants of a tracked disabled owner did not receive a safe reconciliation recommendation');
const recoveryReplay = reconcileKconfigDerivedValues(convergenceModel, staleDescendants, {
  dependencySeeds: recoveredDescendants.actions[0].dependencySeeds,
});
assert(JSON.stringify([...recoveryReplay.values]) === JSON.stringify([...recoveredDescendants.values]),
  'configuration recommendation simulation and execution diverged');

// Conditional package dependencies must follow the active Kconfig condition,
// not a package-name special case.  This mirrors the soft-float codec choice:
// SOFT_FLOAT=N selects lame-lib, while SOFT_FLOAT=Y selects shine.
const conditionalCodecRecords = [
  { kind: 'config', configSymbol: 'SOFT_FLOAT', kconfigSymbol: 'SOFT_FLOAT',
    type: 'bool', states: ['n', 'y'] },
  { kind: 'package', package: 'lame-lib', configSymbol: 'PACKAGE_lame-lib',
    kconfigSymbol: 'PACKAGE_lame-lib', type: 'bool', states: ['n', 'y'] },
  { kind: 'package', package: 'shine', configSymbol: 'PACKAGE_shine',
    kconfigSymbol: 'PACKAGE_shine', type: 'bool', states: ['n', 'y'] },
  { kind: 'package', package: 'conditional-codec', configSymbol: 'PACKAGE_conditional-codec',
    kconfigSymbol: 'PACKAGE_conditional-codec', type: 'bool', states: ['n', 'y'],
    packageInfo: { depends: [
      { raw: '+lame-lib if !SOFT_FLOAT', required: true, condition: '!SOFT_FLOAT', packages: ['lame-lib'] },
      { raw: '+shine if SOFT_FLOAT', required: true, condition: 'SOFT_FLOAT', packages: ['shine'] },
    ] } },
];
const conditionalCodecModel = createCatalogModel({ schema: 5, targets: [], relations: {
  schema: 2, records: conditionalCodecRecords, indexes: {},
} });
const softFloatOffRepair = deriveConfigurationRepairPlan(conditionalCodecModel, parseConfigDocument([
  '# CONFIG_SOFT_FLOAT is not set',
  'CONFIG_PACKAGE_conditional-codec=y',
  '# CONFIG_PACKAGE_lame-lib is not set',
  '# CONFIG_PACKAGE_shine is not set',
].join('\n')));
assert(softFloatOffRepair.actions.length === 1 && softFloatOffRepair.unresolved.length === 0 &&
  softFloatOffRepair.values.get('PACKAGE_lame-lib') === 'y' &&
  softFloatOffRepair.values.get('PACKAGE_shine') === 'n',
  'SOFT_FLOAT=N did not select lame-lib while leaving shine disabled');
const softFloatOnRepair = deriveConfigurationRepairPlan(conditionalCodecModel, parseConfigDocument([
  'CONFIG_SOFT_FLOAT=y',
  'CONFIG_PACKAGE_conditional-codec=y',
  '# CONFIG_PACKAGE_lame-lib is not set',
  '# CONFIG_PACKAGE_shine is not set',
].join('\n')));
assert(softFloatOnRepair.actions.length === 1 && softFloatOnRepair.unresolved.length === 0 &&
  softFloatOnRepair.values.get('PACKAGE_shine') === 'y' &&
  softFloatOnRepair.values.get('PACKAGE_lame-lib') === 'n',
  'SOFT_FLOAT=Y did not select shine while leaving lame-lib disabled');

// A multi-level package closure must converge in one deterministic action;
// the engine should not require the caller to manually replay every provider.
const repairChainRecords = [
  { kind: 'package', package: 'repair-base', configSymbol: 'PACKAGE_repair-base',
    kconfigSymbol: 'PACKAGE_repair-base', states: ['n', 'y'] },
  { kind: 'package', package: 'repair-middle', configSymbol: 'PACKAGE_repair-middle',
    kconfigSymbol: 'PACKAGE_repair-middle', states: ['n', 'y'],
    packageInfo: { depends: [{ raw: '+repair-base', required: true, packages: ['repair-base'] }] } },
  { kind: 'package', package: 'repair-leaf', configSymbol: 'PACKAGE_repair-leaf',
    kconfigSymbol: 'PACKAGE_repair-leaf', states: ['n', 'y'],
    packageInfo: { depends: [{ raw: '+repair-middle', required: true, packages: ['repair-middle'] }] } },
];
const repairChainModel = createCatalogModel({ schema: 5, targets: [], relations: {
  schema: 2, records: repairChainRecords, indexes: {},
} });
const repairChain = deriveConfigurationRepairPlan(repairChainModel, parseConfigDocument([
  'CONFIG_PACKAGE_repair-leaf=y',
  '# CONFIG_PACKAGE_repair-middle is not set',
  '# CONFIG_PACKAGE_repair-base is not set',
].join('\n')));
assert(repairChain.actions.length === 1 && repairChain.unresolved.length === 0 &&
  repairChain.values.get('PACKAGE_repair-middle') === 'y' &&
  repairChain.values.get('PACKAGE_repair-base') === 'y',
  'configuration repair did not stably converge through a multi-level package closure');

// The same preflight path accepts one unique negative Kconfig prerequisite and
// replays the target intent so selects/implies remain automatic changes.
const negativeRepair = deriveConfigurationRepairPlan(prerequisiteModel,
  new Map([['OPENSSL_ENGINE', 'y'], ['OPENSSL_ENGINE_BUILTIN', 'y'],
    ['SELECT_TARGET', 'n'], ['PACKAGE_generic-devcrypto', 'y']]));
assert(negativeRepair.initialViolations.length === 1 &&
  negativeRepair.initialViolations[0].code === 'kconfig-dependency-unsatisfied' &&
  negativeRepair.actions.length === 1 &&
  negativeRepair.actions[0].symbol === 'PACKAGE_generic-devcrypto' &&
  negativeRepair.actions[0].steps.length === 1 &&
  negativeRepair.actions[0].steps[0].symbol === 'OPENSSL_ENGINE_BUILTIN' &&
  negativeRepair.actions[0].steps[0].value === 'n' &&
  negativeRepair.values.get('OPENSSL_ENGINE_BUILTIN') === 'n' &&
  negativeRepair.values.get('PACKAGE_generic-devcrypto') === 'y' &&
  negativeRepair.values.get('SELECT_TARGET') === 'y' &&
  negativeRepair.unresolved.length === 0,
  'unique negative Kconfig prerequisite was not repaired and replayed deterministically');
const lockedNegativeRepair = deriveConfigurationRepairPlan(prerequisiteModel,
  new Map([['OPENSSL_ENGINE', 'y'], ['OPENSSL_ENGINE_BUILTIN', 'y'],
    ['SELECT_TARGET', 'n'], ['PACKAGE_generic-devcrypto', 'y']]), {
    explicitSymbols: new Set(['OPENSSL_ENGINE_BUILTIN']),
  });
assert(lockedNegativeRepair.actions.length === 0 &&
  lockedNegativeRepair.unresolved.some((item) => item.code === 'kconfig-dependency-unsatisfied'),
  'an explicitly locked Kconfig prerequisite was silently changed by preflight');
const lockedNegativeIteratorRepair = deriveConfigurationRepairPlan(prerequisiteModel,
  new Map([['OPENSSL_ENGINE', 'y'], ['OPENSSL_ENGINE_BUILTIN', 'y'],
    ['SELECT_TARGET', 'n'], ['PACKAGE_generic-devcrypto', 'y']]), {
    explicitSymbols: new Map([['OPENSSL_ENGINE_BUILTIN', 'n']]).keys(),
  });
assert(lockedNegativeIteratorRepair.actions.length === 0 &&
  lockedNegativeIteratorRepair.unresolved.some((item) => item.code === 'kconfig-dependency-unsatisfied'),
  'a one-shot explicit-symbol iterator was consumed before prerequisite planning');

// Equal-cost Kconfig alternatives are not a recommendation: preserving the
// unresolved violation is safer than choosing a symbol by sort order.
const ambiguousRepair = deriveConfigurationRepairPlan(ambiguousPrerequisiteModel,
  new Map([['PREREQUISITE_A', 'n'], ['PREREQUISITE_B', 'n'],
    ['PACKAGE_ambiguous-target', 'y']]));
assert(ambiguousRepair.initialViolations.length === 1 && ambiguousRepair.actions.length === 0 &&
  ambiguousRepair.unresolved.length === 1 &&
  ambiguousRepair.unresolved[0].code === 'kconfig-dependency-unsatisfied',
  'ambiguous Kconfig prerequisites were not preserved as unresolved');

// A unique provider that would introduce a package conflict is not safe to
// auto-apply.  Both the original dependency and the conflict remain visible.
const conflictRepairRecords = [
  { kind: 'package', package: 'repair-provider', configSymbol: 'PACKAGE_repair-provider',
    kconfigSymbol: 'PACKAGE_repair-provider', states: ['n', 'y'], provides: ['repair-api'],
    conflicts: ['repair-conflicting'] },
  { kind: 'package', package: 'repair-conflicting', configSymbol: 'PACKAGE_repair-conflicting',
    kconfigSymbol: 'PACKAGE_repair-conflicting', states: ['n', 'y'] },
  { kind: 'package', package: 'repair-consumer', configSymbol: 'PACKAGE_repair-consumer',
    kconfigSymbol: 'PACKAGE_repair-consumer', states: ['n', 'y'],
    packageInfo: { depends: [{ raw: '+repair-api', required: true, packages: ['repair-api'] }] } },
];
const conflictRepairModel = createCatalogModel({ schema: 5, targets: [], relations: {
  schema: 2, records: conflictRepairRecords,
  indexes: { providers: { 'repair-api': ['repair-provider'] } },
} });
const conflictRepair = deriveConfigurationRepairPlan(conflictRepairModel, parseConfigDocument([
  'CONFIG_PACKAGE_repair-consumer=y',
  'CONFIG_PACKAGE_repair-conflicting=y',
  '# CONFIG_PACKAGE_repair-provider is not set',
].join('\n')));
assert(conflictRepair.actions.length === 0 &&
  conflictRepair.unresolved.some((item) => item.code === 'package-dependency-unsatisfied') &&
  conflictRepair.values.get('PACKAGE_repair-provider') === 'n',
  'a package repair that introduced a conflict was applied instead of remaining unresolved');

// Multiple providers are likewise intentionally not guessed at.
const providerAmbiguityRecords = [
  { kind: 'package', package: 'repair-provider-a', configSymbol: 'PACKAGE_repair-provider-a',
    kconfigSymbol: 'PACKAGE_repair-provider-a', states: ['n', 'y'], provides: ['repair-virtual'] },
  { kind: 'package', package: 'repair-provider-b', configSymbol: 'PACKAGE_repair-provider-b',
    kconfigSymbol: 'PACKAGE_repair-provider-b', states: ['n', 'y'], provides: ['repair-virtual'] },
  { kind: 'package', package: 'repair-virtual-consumer', configSymbol: 'PACKAGE_repair-virtual-consumer',
    kconfigSymbol: 'PACKAGE_repair-virtual-consumer', states: ['n', 'y'],
    packageInfo: { depends: [{ raw: '+repair-virtual', required: true, packages: ['repair-virtual'] }] } },
];
const providerAmbiguityModel = createCatalogModel({ schema: 5, targets: [], relations: {
  schema: 2, records: providerAmbiguityRecords,
  indexes: { providers: { 'repair-virtual': ['repair-provider-a', 'repair-provider-b'] } },
} });
const providerAmbiguityRepair = deriveConfigurationRepairPlan(providerAmbiguityModel,
  parseConfigDocument(['CONFIG_PACKAGE_repair-virtual-consumer=y'].join('\n')));
assert(providerAmbiguityRepair.actions.length === 0 &&
  providerAmbiguityRepair.unresolved.some((item) => item.code === 'package-dependency-unsatisfied'),
  'multiple package providers were guessed instead of remaining unresolved');

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
const scopedBuildFailure = {
  schema: 3,
  rules: [{
    id: 'BLD-SCOPED', issue: 'build-failure', match: 'all-selected',
    scope: { Demo: ['stable'] }, sourceCommits: ['a'.repeat(40)],
    targetScope: { system: ['x86'], subtarget: ['64'], profile: ['DEVICE_generic'] },
    packages: ['core-service'], refs: ['run:scoped'],
    failure: { phase: 'package-compile', cause: 'package-caused', code: 'fixture-package-failure',
      observed: { package: 'core-service', version: '1.0' } },
  }],
};
const scopedValues = new Map(ownershipValues).set('PACKAGE_core-service', 'y');
const scopedContext = { sourceId: 'Demo', branchName: 'stable', sourceCommit: 'a'.repeat(40),
  targetSystem: 'x86', targetSubtarget: '64', targetProfile: 'DEVICE_generic' };
const scopedExact = evaluateCompatibilityRules(model, scopedBuildFailure, scopedValues, scopedContext);
const scopedWarning = scopedExact.warnings[0];
assert(scopedExact.warnings.length === 1 && scopedExact.diagnostics.length === 0,
  'exact compatibility scope did not produce one warning without a near-match diagnostic');
assert(scopedWarning?.rule.failure.code === 'fixture-package-failure',
  'schema-3 compatibility evidence did not survive normalization');
for (const [changed, expectedMismatch] of [
  [{ sourceCommit: 'b'.repeat(40) }, 'sourceCommit'],
  [{ sourceCommit: '' }, 'sourceCommit'],
  [{ targetSystem: 'armvirt' }, 'targetScope'],
  [{ targetSubtarget: 'generic' }, 'targetScope'],
  [{ targetProfile: 'DEVICE_other' }, 'targetScope'],
]) {
  const nearMatch = evaluateCompatibilityRules(model, scopedBuildFailure, scopedValues,
    { ...scopedContext, ...changed });
  assert(nearMatch.warnings.length === 0 && nearMatch.diagnostics.length === 1 &&
    nearMatch.diagnostics[0].type === 'compatibility-near-match' &&
    nearMatch.diagnostics[0].ruleId === 'BLD-SCOPED' &&
    nearMatch.diagnostics[0].mismatches.length === 1 &&
    nearMatch.diagnostics[0].mismatches[0] === expectedMismatch &&
    nearMatch.diagnostics[0].matchedPackages.includes('core-service'),
  `schema-3 ${expectedMismatch} mismatch did not produce one near-match diagnostic without a warning`);
}
const noScopedPackage = evaluateCompatibilityRules(model, scopedBuildFailure,
  new Map(ownershipValues).set('PACKAGE_core-service', 'n'),
  { ...scopedContext, sourceCommit: 'b'.repeat(40) });
assert(noScopedPackage.warnings.length === 0 && noScopedPackage.diagnostics.length === 0,
  'a source-commit near match was reported when no compatibility package was selected');
assert(evaluateCompatibilityRules(model, scopedBuildFailure, scopedValues,
  { ...scopedContext, sourceId: 'Other' }).warnings.length === 0 &&
  evaluateCompatibilityRules(model, scopedBuildFailure, scopedValues,
    { ...scopedContext, sourceId: 'Other' }).diagnostics.length === 0 &&
  evaluateCompatibilityRules(model, scopedBuildFailure, scopedValues,
    { ...scopedContext, branchName: 'next' }).warnings.length === 0 &&
  evaluateCompatibilityRules(model, scopedBuildFailure, scopedValues,
    { ...scopedContext, branchName: 'next' }).diagnostics.length === 0,
  'compatibility near-match diagnostics leaked to another source or branch');
const branchWideBuildFailure = structuredClone(scopedBuildFailure);
delete branchWideBuildFailure.rules[0].targetScope;
assert(evaluateCompatibilityRules(model, branchWideBuildFailure, scopedValues,
  { ...scopedContext, targetSystem: 'armsr', targetSubtarget: 'armv8', targetProfile: 'DEVICE_generic' }).warnings.length === 1,
'a target-independent schema-3 rule was incorrectly restricted to the sampled Target');
const scopedMissingPackage = structuredClone(scopedBuildFailure);
scopedMissingPackage.rules[0].packages = ['missing-package'];
const scopedMissingNearMatch = evaluateCompatibilityRules(model, scopedMissingPackage, scopedValues,
  { ...scopedContext, sourceCommit: 'b'.repeat(40) });
assert(scopedMissingNearMatch.warnings.length === 0 && scopedMissingNearMatch.diagnostics.length === 0,
  'a scope-mismatched rule with a missing package was not safely ignored');
expectThrow(() => evaluateCompatibilityRules(model, scopedMissingPackage, scopedValues, scopedContext),
  /missing from the active Catalog/,
  'an exact-scope rule with a missing package did not preserve the validation error');
expectThrow(() => normalizeCompatibilityDocument({ ...scopedBuildFailure, schema: 2 }), /unsupported field|compatibility/i,
  'schema-2 compatibility accepted schema-3 fields');
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

const buildDependencyCatalog = {
  schema: 5,
  targets: [],
  relations: {
    schema: 2,
    records: [
      { kind: 'package', package: 'build-target', configSymbol: 'PACKAGE_build-target',
        kconfigSymbol: 'PACKAGE_build-target', states: ['n', 'y'] },
      { kind: 'package', package: 'trigger-a', configSymbol: 'PACKAGE_trigger-a',
        kconfigSymbol: 'PACKAGE_trigger-a', states: ['n', 'y'] },
      { kind: 'package', package: 'trigger-b', configSymbol: 'PACKAGE_trigger-b',
        kconfigSymbol: 'PACKAGE_trigger-b', states: ['n', 'y'] },
      { kind: 'package', package: 'trigger-selector', configSymbol: 'PACKAGE_trigger-selector',
        kconfigSymbol: 'PACKAGE_trigger-selector', states: ['n', 'y'],
        kconfig: { selectsExpressions: [['PACKAGE_trigger-a']] } },
      { kind: 'package', package: 'trigger-dependent', configSymbol: 'PACKAGE_trigger-dependent',
        kconfigSymbol: 'PACKAGE_trigger-dependent', states: ['n', 'y'], hidden: true, visible: false,
        userSettable: false, kconfig: { dependsExpressions: [['PACKAGE_trigger-b']] } },
      { kind: 'package', package: 'ordinary-dependent', configSymbol: 'PACKAGE_ordinary-dependent',
        kconfigSymbol: 'PACKAGE_ordinary-dependent', states: ['n', 'y'], hidden: true, visible: false,
        userSettable: false, kconfig: { dependsExpressions: [['PACKAGE_trigger-b']] } },
    ],
    indexes: { providers: {}, reverseDependencies: {
      'trigger-b': ['trigger-dependent', 'ordinary-dependent'],
    }, reverseKconfig: {}, choices: {} },
  },
};
const buildDependencyModel = createCatalogModel(buildDependencyCatalog);
const buildDependencyRule = {
  schema: 4,
  rules: [{
    id: 'BLD-DEPENDENCY', issue: 'build-failure', match: 'all-selected',
    scope: { Demo: ['stable'] }, sourceCommits: ['a'.repeat(40)],
    packages: ['build-target'], refs: ['run:build-dependency'],
    failure: { phase: 'package-compile', cause: 'package-caused', code: 'fixture-build-dependency' },
    buildDependency: {
      package: 'build-target', triggerPackages: ['trigger-a', 'trigger-b', 'trigger-dependent'],
    },
  }],
};
const singleBuildDependencyValues = parseConfigDocument([
  '# CONFIG_PACKAGE_build-target is not set',
  'CONFIG_PACKAGE_trigger-a=y',
  '# CONFIG_PACKAGE_trigger-b is not set',
].join('\n'));
const singleBuildDependencyContext = {
  sourceId: 'Demo', branchName: 'stable', sourceCommit: 'a'.repeat(40),
};
const singleBuildDependencyWarning = evaluateCompatibilityRules(
  buildDependencyModel, buildDependencyRule, singleBuildDependencyValues, singleBuildDependencyContext,
).warnings[0];
assert(singleBuildDependencyWarning?.records.map((record) => record.package).join(',') ===
  'build-target,trigger-a,trigger-b,trigger-dependent',
  'schema-4 build dependency did not expose direct and trigger package records');
const buildDependencyNearMatch = evaluateCompatibilityRules(
  buildDependencyModel, buildDependencyRule, singleBuildDependencyValues,
  { ...singleBuildDependencyContext, sourceCommit: 'b'.repeat(40) },
);
assert(buildDependencyNearMatch.warnings.length === 0 && buildDependencyNearMatch.diagnostics.length === 1 &&
  buildDependencyNearMatch.diagnostics[0].mismatches.length === 1 &&
  buildDependencyNearMatch.diagnostics[0].mismatches[0] === 'sourceCommit' &&
  buildDependencyNearMatch.diagnostics[0].matchedPackages.includes('trigger-a'),
  'schema-4 trigger package near match did not produce one source-commit diagnostic');
const noBuildDependencyTriggerValues = parseConfigDocument([
  '# CONFIG_PACKAGE_build-target is not set',
  '# CONFIG_PACKAGE_trigger-a is not set',
  '# CONFIG_PACKAGE_trigger-b is not set',
  '# CONFIG_PACKAGE_trigger-dependent is not set',
].join('\n'));
const noBuildDependencyTrigger = evaluateCompatibilityRules(
  buildDependencyModel, buildDependencyRule, noBuildDependencyTriggerValues,
  { ...singleBuildDependencyContext, sourceCommit: 'b'.repeat(40) },
);
assert(noBuildDependencyTrigger.warnings.length === 0 && noBuildDependencyTrigger.diagnostics.length === 0,
  'schema-4 source-commit mismatch was reported without a selected direct or trigger package');
const singleBuildDependencyPlans = deriveCompatibilityPlans(
  buildDependencyModel, singleBuildDependencyValues, singleBuildDependencyWarning,
);
assert(singleBuildDependencyPlans.recommended?.cost === 1 &&
  singleBuildDependencyPlans.recommended.steps.map((step) => step.package).join('>') === 'trigger-a' &&
  singleBuildDependencyPlans.recommended.requiredTargets.map((target) => target.package).join('>') === 'trigger-a' &&
  evaluateCompatibilityRules(buildDependencyModel, buildDependencyRule,
    singleBuildDependencyPlans.recommended.values, singleBuildDependencyContext).warnings.length === 0,
  'schema-4 single trigger did not derive one legal disable step');

const multiBuildDependencyValues = parseConfigDocument([
  '# CONFIG_PACKAGE_build-target is not set',
  'CONFIG_PACKAGE_trigger-a=y',
  'CONFIG_PACKAGE_trigger-b=y',
  'CONFIG_PACKAGE_trigger-dependent=y',
  'CONFIG_PACKAGE_ordinary-dependent=y',
].join('\n'));
const multiBuildDependencyWarning = evaluateCompatibilityRules(
  buildDependencyModel, buildDependencyRule, multiBuildDependencyValues, singleBuildDependencyContext,
).warnings[0];
const multiBuildDependencyPlans = deriveCompatibilityPlans(
  buildDependencyModel, multiBuildDependencyValues, multiBuildDependencyWarning,
);
assert(multiBuildDependencyPlans.recommended?.cost === 3 &&
  new Set(multiBuildDependencyPlans.recommended.steps.map((step) => step.package)).size === 2 &&
  multiBuildDependencyPlans.recommended.steps.every((step) => ['trigger-a', 'trigger-b'].includes(step.package)) &&
  new Set(multiBuildDependencyPlans.recommended.requiredTargets.map((target) => target.package)).size === 3 &&
  multiBuildDependencyPlans.recommended.requiredTargets.some((target) =>
    target.package === 'trigger-dependent') &&
  !multiBuildDependencyPlans.recommended.automaticChanges.some((change) =>
    change.symbol === 'PACKAGE_trigger-dependent') &&
  multiBuildDependencyPlans.recommended.automaticChanges.some((change) =>
    change.symbol === 'PACKAGE_ordinary-dependent' && change.to === 'n') &&
  evaluateCompatibilityRules(buildDependencyModel, buildDependencyRule,
    multiBuildDependencyPlans.recommended.values, singleBuildDependencyContext).warnings.length === 0,
  'schema-4 participants were not retained as explicit targets while outside cleanup stayed automatic');

const fourTriggerNames = ['trigger-one', 'trigger-two', 'trigger-three', 'trigger-four'];
const fourTriggerModel = createCatalogModel({
  schema: 5,
  targets: [],
  relations: {
    schema: 2,
    records: ['failed-target', ...fourTriggerNames].map((packageName) => ({
      kind: 'package', package: packageName, configSymbol: `PACKAGE_${packageName}`,
      kconfigSymbol: `PACKAGE_${packageName}`, states: ['n', 'y'],
    })),
    indexes: { providers: {}, reverseDependencies: {}, reverseKconfig: {}, choices: {} },
  },
});
const fourTriggerRule = {
  schema: 4,
  rules: [{
    id: 'BLD-FOUR-TRIGGERS', issue: 'build-failure', match: 'all-selected',
    scope: { Demo: ['stable'] }, sourceCommits: ['a'.repeat(40)],
    packages: ['failed-target'], refs: ['run:four-triggers'],
    failure: { phase: 'package-compile', cause: 'package-caused', code: 'fixture-four-triggers' },
    buildDependency: { package: 'failed-target', triggerPackages: fourTriggerNames },
  }],
};
const fourTriggerValues = parseConfigDocument([
  '# CONFIG_PACKAGE_failed-target is not set',
  ...fourTriggerNames.map((packageName) => `CONFIG_PACKAGE_${packageName}=y`),
].join('\n'));
const fourTriggerWarning = evaluateCompatibilityRules(
  fourTriggerModel, fourTriggerRule, fourTriggerValues, singleBuildDependencyContext,
).warnings[0];
const fourTriggerPlans = deriveCompatibilityPlans(
  fourTriggerModel, fourTriggerValues, fourTriggerWarning,
  { protectedSymbols: new Set(fourTriggerNames.map((packageName) => `PACKAGE_${packageName}`)) },
);
assert(fourTriggerPlans.recommended?.cost === 4 &&
  new Set(fourTriggerPlans.recommended.requiredTargets.map((target) => target.package)).size === 4 &&
  new Set(fourTriggerPlans.recommended.steps.map((step) => step.package)).size === 4 &&
  fourTriggerPlans.recommended.automaticChanges.every((change) =>
    !fourTriggerNames.includes(String(change.symbol || '').replace(/^PACKAGE_/, ''))) &&
  evaluateCompatibilityRules(fourTriggerModel, fourTriggerRule,
    fourTriggerPlans.recommended.values, singleBuildDependencyContext).warnings.length === 0,
'schema-4 imported trigger participants were not all retained as explicit cancellation targets');

const selectorBuildDependencyValues = parseConfigDocument([
  '# CONFIG_PACKAGE_build-target is not set',
  'CONFIG_PACKAGE_trigger-selector=y',
  'CONFIG_PACKAGE_trigger-a=y',
].join('\n'));
const selectorBuildDependencyWarning = evaluateCompatibilityRules(
  buildDependencyModel, buildDependencyRule, selectorBuildDependencyValues, singleBuildDependencyContext,
).warnings[0];
const selectorBuildDependencyPlans = deriveCompatibilityPlans(
  buildDependencyModel, selectorBuildDependencyValues, selectorBuildDependencyWarning,
);
assert(selectorBuildDependencyPlans.recommended?.cost === 2 &&
  new Set(selectorBuildDependencyPlans.recommended.steps.map((step) => step.package)).size === 2 &&
  selectorBuildDependencyPlans.recommended.steps.some((step) => step.package === 'trigger-selector') &&
  selectorBuildDependencyPlans.recommended.steps.some((step) => step.package === 'trigger-a') &&
  evaluateCompatibilityRules(buildDependencyModel, buildDependencyRule,
    selectorBuildDependencyPlans.recommended.values, singleBuildDependencyContext).warnings.length === 0,
  'schema-4 selector linkage was not represented as one user step plus automatic cleanup');

const selectorAndTargetValues = parseConfigDocument([
  'CONFIG_PACKAGE_build-target=y',
  'CONFIG_PACKAGE_trigger-selector=y',
  'CONFIG_PACKAGE_trigger-a=y',
].join('\n'));
const selectorAndTargetWarning = evaluateCompatibilityRules(
  buildDependencyModel, buildDependencyRule, selectorAndTargetValues, singleBuildDependencyContext,
).warnings[0];
const selectorAndTargetPlans = deriveCompatibilityPlans(
  buildDependencyModel, selectorAndTargetValues, selectorAndTargetWarning,
  { explicitSymbols: new Set(['PACKAGE_build-target', 'PACKAGE_trigger-selector', 'PACKAGE_trigger-a']) },
);
assert(selectorAndTargetPlans.recommended?.cost === 3 &&
  new Set(selectorAndTargetPlans.recommended.steps.map((step) => step.package)).size === 3 &&
  selectorAndTargetPlans.recommended.steps.some((step) => step.package === 'build-target') &&
  selectorAndTargetPlans.recommended.steps.some((step) => step.package === 'trigger-selector') &&
  selectorAndTargetPlans.recommended.steps.some((step) => step.package === 'trigger-a') &&
  evaluateCompatibilityRules(buildDependencyModel, buildDependencyRule,
    selectorAndTargetPlans.recommended.values, singleBuildDependencyContext).warnings.length === 0,
  'schema-4 explicit selector and direct target did not converge through shared Kconfig intent');
const schema4CommitMismatch = evaluateCompatibilityRules(
  buildDependencyModel, buildDependencyRule, singleBuildDependencyValues,
  { ...singleBuildDependencyContext, sourceCommit: 'b'.repeat(40) },
);
assert(schema4CommitMismatch.warnings.length === 0,
  'schema-4 build dependency rule ignored source commit mismatch');
const schema4UnknownField = structuredClone(buildDependencyRule);
schema4UnknownField.rules[0].unsupported = true;
expectThrow(() => normalizeCompatibilityDocument(schema4UnknownField), /unsupported field|BLD-DEPENDENCY/i,
  'schema-4 compatibility accepted an unknown rule field');
const schema4UnknownBuildDependencyField = structuredClone(buildDependencyRule);
schema4UnknownBuildDependencyField.rules[0].buildDependency.extra = true;
expectThrow(() => normalizeCompatibilityDocument(schema4UnknownBuildDependencyField), /unsupported field|buildDependency/i,
  'schema-4 buildDependency accepted an unknown field');
const schema4MissingBuildDependencyCommit = structuredClone(buildDependencyRule);
delete schema4MissingBuildDependencyCommit.rules[0].sourceCommits;
expectThrow(() => normalizeCompatibilityDocument(schema4MissingBuildDependencyCommit), /sourceCommits|buildDependency/i,
  'schema-4 buildDependency accepted a rule without exact source commits');
const schema4BuildPackageNotListed = structuredClone(buildDependencyRule);
schema4BuildPackageNotListed.rules[0].packages = ['trigger-a'];
expectThrow(() => normalizeCompatibilityDocument(schema4BuildPackageNotListed), /must be listed|buildDependency/i,
  'schema-4 buildDependency accepted a build package absent from packages');
const schema4DuplicateTrigger = structuredClone(buildDependencyRule);
schema4DuplicateTrigger.rules[0].buildDependency.triggerPackages = ['trigger-a', 'trigger-a'];
expectThrow(() => normalizeCompatibilityDocument(schema4DuplicateTrigger), /duplicate|triggerPackages/i,
  'schema-4 buildDependency accepted duplicate trigger packages');
const schema4PackageTrigger = structuredClone(buildDependencyRule);
schema4PackageTrigger.rules[0].buildDependency.triggerPackages = ['build-target'];
expectThrow(() => normalizeCompatibilityDocument(schema4PackageTrigger), /must not contain|triggerPackages/i,
  'schema-4 buildDependency accepted its build package as a trigger');
expectThrow(() => normalizeCompatibilityDocument({ ...buildDependencyRule, schema: 3 }), /requires compatibility schema 4|unsupported field/i,
  'schema-3 compatibility accepted buildDependency');
expectThrow(() => normalizeCompatibilityDocument({ ...buildDependencyRule, schema: 2 }), /requires compatibility schema 4|unsupported field/i,
  'schema-2 compatibility accepted buildDependency');
expectThrow(() => normalizeCompatibilityDocument({ ...buildDependencyRule, schema: 6 }), /schema 2, 3, 4, or 5/i,
  'unknown compatibility schema was accepted');

const preventiveBuildDependencyRule = {
  schema: 5,
  rules: [{
    id: 'BLD-PREVENTIVE', issue: 'build-failure', match: 'all-selected', policy: 'preventive',
    environments: [{ source: '*', branch: '*', packageAvailability: 'if-present', targetScope: {} }],
    evidence: [{ source: 'Demo', branch: 'stable', sourceCommit: 'a'.repeat(40), refs: ['run:preventive'] }],
    packages: ['build-target'],
    failure: { phase: 'package-compile', cause: 'package-caused', code: 'fixture-preventive-build-risk' },
    buildDependency: {
      package: 'build-target', triggerPackages: ['trigger-a', 'trigger-b', 'trigger-dependent'],
    },
  }],
};
const preventiveWarningResult = evaluateCompatibilityRules(
  buildDependencyModel, preventiveBuildDependencyRule, singleBuildDependencyValues,
  { sourceId: 'FutureSource', branchName: 'future-branch', sourceCommit: '' },
);
assert(preventiveWarningResult.warnings.length === 1 && preventiveWarningResult.diagnostics.length === 0 &&
  preventiveWarningResult.warnings[0].rule.policy === 'preventive',
  'schema-5 preventive wildcard policy did not cover a future Source/Branch independently of evidence identity');

const buildDependencyMissingCatalog = structuredClone(buildDependencyCatalog);
buildDependencyMissingCatalog.relations.records = buildDependencyMissingCatalog.relations.records
  .filter((record) => record.package !== 'build-target');
const buildDependencyMissingModel = createCatalogModel(buildDependencyMissingCatalog);
const missingPreventivePackage = evaluateCompatibilityRules(
  buildDependencyMissingModel, preventiveBuildDependencyRule, singleBuildDependencyValues,
  { sourceId: 'SourceWithoutPackage', branchName: 'main' },
);
assert(missingPreventivePackage.warnings.length === 0 && missingPreventivePackage.diagnostics.length === 0,
  'schema-5 if-present policy did not skip a Source without the build package');

const partialTriggerCatalog = structuredClone(buildDependencyCatalog);
partialTriggerCatalog.relations.records = partialTriggerCatalog.relations.records.filter((record) =>
  !['trigger-b', 'trigger-dependent', 'ordinary-dependent'].includes(record.package));
partialTriggerCatalog.relations.indexes.reverseDependencies = {};
const partialTriggerModel = createCatalogModel(partialTriggerCatalog);
const partialTriggerResult = evaluateCompatibilityRules(
  partialTriggerModel, preventiveBuildDependencyRule, singleBuildDependencyValues,
  { sourceId: 'PartialSource', branchName: 'main' },
);
assert(partialTriggerResult.warnings.length === 1 &&
  partialTriggerResult.warnings[0].records.map((record) => record.package).join(',') === 'build-target,trigger-a',
  'schema-5 if-present policy did not use only participants available in the active Catalog');
const partialTriggerPlan = deriveCompatibilityPlans(
  partialTriggerModel, singleBuildDependencyValues, partialTriggerResult.warnings[0],
);
assert(partialTriggerPlan.recommended?.requiredTargets.map((row) => row.package).join(',') === 'trigger-a',
  'schema-5 preventive recommendation included a participant absent from the active Catalog');

const multiRulePreventive = structuredClone(preventiveBuildDependencyRule);
multiRulePreventive.rules.unshift({
  id: 'OWN-MULTI', issue: 'file-ownership', match: 'all-installed',
  scope: { Demo: ['stable'] }, packages: ['trigger-a', 'trigger-b'],
  paths: ['/etc/config/multi'], refs: ['run:multi'],
});
const multiRuleValues = parseConfigDocument([
  '# CONFIG_PACKAGE_build-target is not set',
  'CONFIG_PACKAGE_trigger-a=y',
  'CONFIG_PACKAGE_trigger-b=y',
  '# CONFIG_PACKAGE_trigger-dependent is not set',
].join('\n'));
const multiRuleResult = evaluateCompatibilityRules(
  buildDependencyModel, multiRulePreventive, multiRuleValues,
  { sourceId: 'Demo', branchName: 'stable', sourceCommit: 'a'.repeat(40) },
);
assert(multiRuleResult.warnings.map((warning) => warning.rule.id).join(',') ===
  'OWN-MULTI,BLD-PREVENTIVE',
  'schema-5 evaluation did not return every simultaneously active compatibility rule');

const invalidPreventive = structuredClone(preventiveBuildDependencyRule);
delete invalidPreventive.rules[0].evidence;
expectThrow(() => normalizeCompatibilityDocument(invalidPreventive), /evidence/i,
  'schema-5 preventive policy accepted missing exact evidence');

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
  sourceCommit: 'a'.repeat(40), targetKey: 'x86/64/DEVICE_generic', revision: 7,
  ruleIds: ['OWN-TEST', 'OWN-TIE'],
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
  { branchName: 'next' }, { sourceCommit: 'b'.repeat(40) }, { targetKey: 'armsr/armv8/DEVICE_generic' },
  { revision: 8 }, { ruleIds: ['OWN-TEST'] },
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
// Defaults for an inactive owner must not poison an unrelated selection.
// Cover every type and both known-disabled and unresolved owner conditions.
for (const [type, defaultValue] of [['bool', 'y'], ['tristate', 'm'], ['string', '"example"'], ['int', '"128"'], ['hex', '"0x20"']]) {
  const guardedModel = createCatalogModel({ schema: 6, relations: { schema: 2, records: [
    { kind: 'package', package: 'luci-theme-guarded-anonymous', configSymbol: 'PACKAGE_luci-theme-guarded-anonymous',
      kconfigSymbol: 'PACKAGE_luci-theme-guarded-anonymous', type: 'tristate', states: ['n', 'm', 'y'] },
    { configSymbol: 'GUARDED_DEFAULT', kconfigSymbol: 'GUARDED_DEFAULT', type, defaults: [defaultValue],
      hidden: true, userSettable: false, kconfig: { dependsExpressions: [['UNRELATED_DRIVER']] } },
  ], indexes: {} } });
  for (const values of [new Map([['UNRELATED_DRIVER', 'n']]), new Map()]) {
    const theme = resolveEffectiveTheme(guardedModel, null, values);
    assert(theme.package === 'luci-theme-guarded-anonymous', `${type}: inactive defaults blocked theme fallback`);
    assert(!theme.values.has('GUARDED_DEFAULT') || theme.values.get('GUARDED_DEFAULT') === 'n',
      `${type}: inactive or unresolved owner acquired a positive/scalar default`);
    const evaluation = evaluateCompatibilityRules(guardedModel, { schema: 2, rules: [] }, values);
    assert(!evaluation.values.has('GUARDED_DEFAULT'), `${type}: compatibility materialized an inactive default`);
  }
  const enabled = evaluateCompatibilityRules(guardedModel, { schema: 2, rules: [] }, new Map([['UNRELATED_DRIVER', 'y']]));
  assert(enabled.values.has('GUARDED_DEFAULT'), `${type}: active owner lost its default`);
}
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
