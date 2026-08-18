#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  createCatalogModel,
  deriveCompatibilityPlans,
  evaluateCompatibilityRules,
  kconfigStateConstraints,
  parseConfigDocument,
} from '../site/wrt/lib/catalog-engine.js';

function catalogWith(records, reverseKconfig = {}) {
  return {
    schema: 5,
    targets: [],
    relations: {
      schema: 2,
      records,
      indexes: {
        providers: {},
        reverseDependencies: {},
        reverseKconfig,
        choices: {},
      },
    },
  };
}

function buildFailureWarning(model, values, packageName, id = 'BLD-TEST') {
  const document = {
    schema: 2,
    rules: [{
      id,
      issue: 'build-failure',
      match: 'all-selected',
      scope: { Demo: ['stable'] },
      packages: [packageName],
      refs: ['run:1'],
    }],
  };
  const warning = evaluateCompatibilityRules(model, document, values, {
    sourceId: 'Demo',
    branchName: 'stable',
  }).warnings[0];
  assert.ok(warning, `${id} fixture did not trigger`);
  return warning;
}

const selectorCatalog = catalogWith([
  { kind: 'package', package: 'selected-core', configSymbol: 'PACKAGE_selected-core',
    kconfigSymbol: 'PACKAGE_selected-core', states: ['n', 'y'] },
  { kind: 'package', package: 'selector-ui', configSymbol: 'PACKAGE_selector-ui',
    kconfigSymbol: 'PACKAGE_selector-ui', states: ['n', 'y'],
    kconfig: { selectsExpressions: [['PACKAGE_selected-core']] } },
  { kind: 'package', package: 'dependent-one', configSymbol: 'PACKAGE_dependent-one',
    kconfigSymbol: 'PACKAGE_dependent-one', states: ['n', 'y'],
    kconfig: { dependsExpressions: [['PACKAGE_selected-core']] } },
  { kind: 'package', package: 'dependent-two', configSymbol: 'PACKAGE_dependent-two',
    kconfigSymbol: 'PACKAGE_dependent-two', states: ['n', 'y'],
    kconfig: { dependsExpressions: [['PACKAGE_selected-core']] } },
], {
  'PACKAGE_selected-core': ['PACKAGE_dependent-one', 'PACKAGE_dependent-two'],
});
const selectorModel = createCatalogModel(selectorCatalog);
const selectorValues = parseConfigDocument([
  'CONFIG_PACKAGE_selector-ui=y',
  'CONFIG_PACKAGE_selected-core=y',
  'CONFIG_PACKAGE_dependent-one=y',
  'CONFIG_PACKAGE_dependent-two=y',
].join('\n'));
const selectorWarning = buildFailureWarning(selectorModel, selectorValues, 'selected-core', 'BLD-SELECT');

const constraints = kconfigStateConstraints(
  selectorModel,
  selectorModel.byPackage.get('selected-core'),
  selectorValues,
);
assert.deepEqual(constraints.selectors.map((row) => row.sourceSymbol), ['PACKAGE_selector-ui'],
  'active selector authority did not identify the direct blocker');

const selectorPlans = deriveCompatibilityPlans(selectorModel, selectorValues, selectorWarning);
assert.deepEqual(selectorPlans.recommended?.steps.map((step) => step.package), ['selector-ui', 'selected-core'],
  'selector-locked recommendation did not follow the executable menuconfig sequence');
assert.equal(selectorPlans.recommended?.cost, 2,
  'recommendation cost must count explicit menuconfig-style user actions only');
assert.equal(selectorPlans.recommended?.values.get('PACKAGE_dependent-one'), 'n');
assert.equal(selectorPlans.recommended?.values.get('PACKAGE_dependent-two'), 'n');
assert.ok(selectorPlans.recommended?.automaticChanges.some((change) =>
  change.symbol === 'PACKAGE_dependent-one' && change.to === 'n'),
'automatic reverse-dependent cleanup was lost');
assert.ok(!selectorPlans.recommended?.steps.some((step) => step.package.startsWith('dependent-')),
  'ordinary reverse dependents leaked into explicit recommendation steps');

const directCatalog = catalogWith([
  { kind: 'package', package: 'target-app', configSymbol: 'PACKAGE_target-app',
    kconfigSymbol: 'PACKAGE_target-app', states: ['n', 'y'] },
  { kind: 'package', package: 'translation-addon', configSymbol: 'PACKAGE_translation-addon',
    kconfigSymbol: 'PACKAGE_translation-addon', states: ['n', 'y'],
    kconfig: { dependsExpressions: [['PACKAGE_target-app']] } },
  { kind: 'package', package: 'reverse-dependent', configSymbol: 'PACKAGE_reverse-dependent',
    kconfigSymbol: 'PACKAGE_reverse-dependent', states: ['n', 'y'],
    kconfig: { dependsExpressions: [['PACKAGE_target-app']] } },
  { kind: 'package', package: 'unrelated-app', configSymbol: 'PACKAGE_unrelated-app',
    kconfigSymbol: 'PACKAGE_unrelated-app', states: ['n', 'y'] },
], {
  'PACKAGE_target-app': ['PACKAGE_translation-addon', 'PACKAGE_reverse-dependent'],
});
const directModel = createCatalogModel(directCatalog);
const directValues = parseConfigDocument([
  'CONFIG_PACKAGE_target-app=y',
  'CONFIG_PACKAGE_translation-addon=y',
  'CONFIG_PACKAGE_reverse-dependent=y',
  'CONFIG_PACKAGE_unrelated-app=y',
].join('\n'));
const directWarning = buildFailureWarning(directModel, directValues, 'target-app', 'BLD-DIRECT');
const directPlans = deriveCompatibilityPlans(directModel, directValues, directWarning);
assert.deepEqual(directPlans.recommended?.steps.map((step) => step.package), ['target-app'],
  'a directly disableable target must stay a one-action recommendation');
assert.equal(directPlans.recommended?.cost, 1,
  'automatic Kconfig consequences must not inflate recommendation cost');
assert.equal(directPlans.recommended?.values.get('PACKAGE_translation-addon'), 'n');
assert.equal(directPlans.recommended?.values.get('PACKAGE_reverse-dependent'), 'n');
assert.equal(directPlans.recommended?.values.get('PACKAGE_unrelated-app'), 'y',
  'an unrelated selected option was incorrectly cancelled');
assert.ok(directPlans.recommended?.automaticChanges.some((change) =>
  change.symbol === 'PACKAGE_translation-addon' && change.to === 'n'),
'direct target plan lost automatic dependent reconciliation');
assert.ok(!directPlans.recommended?.steps.some((step) =>
  ['translation-addon', 'reverse-dependent'].includes(step.package)),
  'automatic dependents were incorrectly promoted to menuconfig user actions');

const autoCatalog = catalogWith([
  { kind: 'package', package: 'auto-core', configSymbol: 'PACKAGE_auto-core',
    kconfigSymbol: 'PACKAGE_auto-core', states: ['n', 'y'] },
  { kind: 'package', package: 'auto-selector', configSymbol: 'PACKAGE_auto-selector',
    kconfigSymbol: 'PACKAGE_auto-selector', states: ['n', 'y'],
    kconfig: { selectsExpressions: [['PACKAGE_auto-core']] } },
]);
const autoModel = createCatalogModel(autoCatalog);
const autoValues = parseConfigDocument([
  'CONFIG_PACKAGE_auto-selector=y',
  'CONFIG_PACKAGE_auto-core=y',
].join('\n'));
const autoWarning = buildFailureWarning(autoModel, autoValues, 'auto-core', 'BLD-AUTO');
const autoPlans = deriveCompatibilityPlans(autoModel, autoValues, autoWarning, {
  dependencySymbols: new Set(['PACKAGE_auto-core']),
});
assert.deepEqual(autoPlans.recommended?.steps.map((step) => step.package), ['auto-selector'],
  'planner did not stop after an earlier user action automatically resolved the target');
assert.equal(autoPlans.recommended?.cost, 1,
  'automatically resolved target still counted as a second user action');
assert.equal(autoPlans.recommended?.values.get('PACKAGE_auto-core'), 'n');

const root = dirname(fileURLToPath(import.meta.url));
const appCss = readFileSync(join(root, '..', 'site', 'wrt', 'app.css'), 'utf8');
const overflowCss = readFileSync(join(root, '..', 'site', 'wrt', 'compatibility-recommendation.css'), 'utf8');
const overflowUi = readFileSync(join(root, '..', 'site', 'wrt', 'lib', 'compatibility-recommendation-ui.js'), 'utf8');
const components = readFileSync(join(root, '..', 'site', 'wrt', 'lib', 'ui-components.js'), 'utf8');
assert.match(appCss, /\.ui-tooltip\{[^}]*max-width:[^;}]*100vw[^}]*max-height:[^}]*overflow:auto/s,
  'shared tooltip is no longer viewport bounded with internal overflow');
assert.match(overflowCss, /-webkit-line-clamp:\s*2/,
  'compatibility recommendation text is not visually clamped');
assert.match(overflowUi, /dataset\.uiTooltipBody\s*=\s*fullText/,
  'full recommendation text is not handed to the shared tooltip framework');
assert.match(overflowUi, /dataset\.compatibilityFullText/,
  'full recommendation text is not preserved before truncation');
assert.doesNotMatch(overflowUi, /className\s*=\s*['"]ui-tooltip/,
  'compatibility adapter created a second tooltip implementation');
assert.match(components, /import '\.\/compatibility-recommendation-ui\.js';/,
  'shared UI bootstrap does not install recommendation overflow behavior');

console.log('compatibility recommendation menuconfig-sequence and overflow regression passed');
