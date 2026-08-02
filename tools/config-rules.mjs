import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RULES = JSON.parse(readFileSync(join(ROOT, 'config', '001.presets', 'config-rules.json'), 'utf8'));

export function configSymbolValues(text) {
  const values = new Map();
  for (const match of String(text).matchAll(/^CONFIG_([A-Za-z0-9_.+-]+)=([ym])$/gm)) values.set(match[1], match[2]);
  for (const match of String(text).matchAll(/^# CONFIG_([A-Za-z0-9_.+-]+) is not set$/gm)) values.set(match[1], 'n');
  return values;
}

function scopeMatches(scope = {}, context = {}) {
  const fields = [
    ['sources', 'sourceId'], ['branches', 'branch'], ['systems', 'system'],
    ['subtargets', 'subtarget'], ['profiles', 'profile'],
  ];
  return fields.every(([scopeKey, contextKey]) =>
    !scope[scopeKey]?.length || scope[scopeKey].includes(context[contextKey]));
}

export function matchingConfigRules(text, context = {}) {
  const values = configSymbolValues(text);
  return (RULES.rules || []).filter((rule) =>
    scopeMatches(rule.scope, context) &&
    Object.entries(rule.when?.all || {}).every(([symbol, value]) => values.get(symbol) === value));
}

export { RULES as configRules };
