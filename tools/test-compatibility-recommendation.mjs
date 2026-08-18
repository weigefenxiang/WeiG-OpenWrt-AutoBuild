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

const catalog = {
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
      { kind: 'package', package: 'dependent-one', configSymbol: 'PACKAGE_dependent-one',
        kconfigSymbol: 'PACKAGE_dependent-one', states: ['n', 'y'],
        kconfig: { dependsExpressions: [['PACKAGE_selected-core']] } },
      { kind: 'package', package: 'dependent-two', configSymbol: 'PACKAGE_dependent-two',
        kconfigSymbol: 'PACKAGE_dependent-two', states: ['n', 'y'],
        kconfig: { dependsExpressions: [['PACKAGE_selected-core']] } },
    ],
    indexes: {
      providers: {},
      reverseDependencies: {},
      reverseKconfig: {
        'PACKAGE_selected-core': ['PACKAGE_dependent-one', 'PACKAGE_dependent-two'],
      },
      choices: {},
    },
  },
};

const model = createCatalogModel(catalog);
const values = parseConfigDocument([
  'CONFIG_PACKAGE_selector-ui=y',
  'CONFIG_PACKAGE_selected-core=y',
  'CONFIG_PACKAGE_dependent-one=y',
  'CONFIG_PACKAGE_dependent-two=y',
].join('\n'));
const compatibility = {
  schema: 2,
  rules: [{
    id: 'BLD-SELECT', issue: 'build-failure', match: 'all-selected',
    scope: { Demo: ['stable'] }, packages: ['selected-core'], refs: ['run:1'],
  }],
};
const warning = evaluateCompatibilityRules(model, compatibility, values, {
  sourceId: 'Demo', branchName: 'stable',
}).warnings[0];
assert.ok(warning, 'build-failure fixture did not trigger');

const constraints = kconfigStateConstraints(model, model.byPackage.get('selected-core'), values);
assert.deepEqual(constraints.selectors.map((row) => row.sourceSymbol), ['PACKAGE_selector-ui'],
  'active selector authority did not identify the direct blocker');

const plans = deriveCompatibilityPlans(model, values, warning);
assert.deepEqual(plans.recommended?.steps.map((step) => step.package), ['selector-ui', 'selected-core'],
  'recommendation steps expanded beyond the active selector chain');
assert.equal(plans.recommended?.cost, 2,
  'build-failure recommendation cost must count explicit user steps only');
assert.equal(plans.recommended?.values.get('PACKAGE_dependent-one'), 'n');
assert.equal(plans.recommended?.values.get('PACKAGE_dependent-two'), 'n');
assert.ok(plans.recommended?.automaticChanges.some((change) =>
  change.symbol === 'PACKAGE_dependent-one' && change.to === 'n'),
'automatic reverse-dependent cleanup was lost');
assert.ok(!plans.recommended?.steps.some((step) => step.package.startsWith('dependent-')),
  'ordinary reverse dependents leaked into explicit recommendation steps');

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

console.log('compatibility recommendation selector-chain and overflow regression passed');
