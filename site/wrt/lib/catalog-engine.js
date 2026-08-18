/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Public Catalog/Kconfig facade. Core Kconfig semantics stay in catalog-engine-core.js.
 * When a known build-failure target is locked by an active selector, recommendations
 * release only that selector chain explicitly; ordinary reverse dependents remain
 * automatic applyUserIntent effects from the shared runtime.
 */
import * as CORE from './catalog-engine-core.js';
export * from './catalog-engine-core.js';

// Static architecture contract markers are implemented by the re-exported core:
// compatibility document requires schema 2; compatibilityPatternMatches.

function valuesMap(values) {
  return values instanceof Map ? values : new Map(Object.entries(values || {}));
}

function normalized(value) {
  return String(value ?? 'n').toLowerCase();
}

function packageName(record) {
  if (record?.package) return record.package;
  return String(record?.configSymbol || '').replace(/^PACKAGE_/, '');
}

function activeSelectors(model, record, values, intent = {}) {
  return CORE.kconfigStateConstraints(
    model, record, values, intent.validationOptions || {},
  ).selectors || [];
}

function selectorDisableSteps(model, record, inputValues, intent = {}) {
  const values = new Map(valuesMap(inputValues));
  const ordered = [];
  const planned = new Set();
  const visiting = new Set();

  const visit = (candidate) => {
    const symbol = String(candidate?.configSymbol || '');
    if (!symbol || normalized(values.get(symbol)) === 'n') return true;
    if (candidate.canDisable === false || candidate.userSettable === false || visiting.has(symbol)) return false;
    visiting.add(symbol);
    for (const selector of activeSelectors(model, candidate, values, intent)) {
      const source = model.bySymbol.get(selector.sourceSymbol);
      if (!source || !visit(source)) return false;
    }
    visiting.delete(symbol);
    if (!planned.has(symbol)) {
      planned.add(symbol);
      ordered.push({ symbol, package: packageName(candidate), value: 'n' });
      values.set(symbol, 'n');
    }
    return true;
  };

  return visit(record) ? ordered : null;
}

function planChanges(startingValues, resultValues, rawChanges) {
  const starting = valuesMap(startingValues);
  const final = valuesMap(resultValues);
  const last = new Map();
  for (const change of rawChanges || []) last.set(change.symbol, change);
  return [...last].map(([symbol, change]) => ({
    symbol,
    from: normalized(starting.get(symbol)),
    to: normalized(final.get(symbol)),
    reason: change.reason,
    source: change.source,
  })).filter((change) => change.from !== change.to);
}

function deriveSelectorReleasePlans(model, inputValues, warning, intent = {}) {
  const records = warning?.records || [];
  const startingValues = warning?.values || inputValues;
  const candidates = [];

  for (const record of records) {
    if (!record.canDisable) continue;
    try {
      const steps = selectorDisableSteps(model, record, startingValues, intent);
      if (!steps?.length) continue;
      let values = new Map(valuesMap(startingValues));
      const allChanges = [];
      const protectedSymbols = new Set(intent.protectedSymbols || []);
      const preferredValues = intent.preferredValues instanceof Map
        ? new Map(intent.preferredValues) : new Map(Object.entries(intent.preferredValues || {}));
      const explicitSymbols = new Set(intent.explicitSymbols || []);

      for (const step of steps) {
        protectedSymbols.delete(step.symbol);
        preferredValues.set(step.symbol, 'n');
        explicitSymbols.add(step.symbol);
        if (normalized(values.get(step.symbol)) === 'n') continue;
        const result = CORE.applyUserIntent(model, values, {
          ...intent,
          symbol: step.symbol,
          value: 'n',
          force: false,
          protectedSymbols,
          preferredValues,
          explicitSymbols,
        });
        values = result.values;
        allChanges.push(...result.changes);
      }

      if (normalized(values.get(record.configSymbol)) !== 'n') continue;
      const changes = planChanges(startingValues, values, allChanges);
      const stepSymbols = new Set(steps.map((step) => step.symbol));
      candidates.push({
        package: record.package,
        symbol: record.configSymbol,
        steps,
        changes,
        automaticChanges: changes.filter((change) => !stepSymbols.has(change.symbol)),
        values,
        cost: steps.length,
      });
    } catch {
      // Invalid selector-release sequences are not recommendation candidates.
    }
  }

  candidates.sort((left, right) => left.cost - right.cost || left.package.localeCompare(right.package));
  const minimum = candidates[0]?.cost;
  const cheapest = candidates.filter((candidate) => candidate.cost === minimum);
  return { candidates, recommended: cheapest.length === 1 ? cheapest[0] : null };
}

export function deriveCompatibilityPlans(model, inputValues, warning, intent = {}) {
  const startingValues = warning?.values || inputValues;
  const selectorLockedBuildFailure = warning?.rule?.issue === 'build-failure' &&
    (warning?.records || []).some((record) => activeSelectors(model, record, startingValues, intent).length > 0);
  if (!selectorLockedBuildFailure) {
    return CORE.deriveCompatibilityPlans(model, inputValues, warning, intent);
  }
  return deriveSelectorReleasePlans(model, inputValues, warning, intent);
}
