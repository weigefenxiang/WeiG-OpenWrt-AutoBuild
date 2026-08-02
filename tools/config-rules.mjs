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

function setConfigSymbol(text, symbol, value) {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const line = value === 'n' ? `# CONFIG_${symbol} is not set` : `CONFIG_${symbol}=${value}`;
  const pattern = new RegExp(`^(?:CONFIG_${escaped}=.*|# CONFIG_${escaped} is not set)$`, 'm');
  if (pattern.test(text)) return text.replace(pattern, line);
  return text.replace(/\s*$/, '\n') + line + '\n';
}

export function applyConfigResolution(text, resolution = {}) {
  for (const [symbol, value] of Object.entries(resolution.set || {})) {
    text = setConfigSymbol(text, symbol, value);
  }
  const values = configSymbolValues(text);
  for (const [prefix, value] of Object.entries(resolution.setPrefixes || {})) {
    for (const symbol of values.keys()) {
      if (symbol.startsWith(prefix)) text = setConfigSymbol(text, symbol, value);
    }
  }
  return text;
}

function scopeMatches(scope = {}, context = {}) {
  const fields = [
    ['sources', 'sourceId'], ['branches', 'branch'], ['systems', 'system'],
    ['subtargets', 'subtarget'], ['profiles', 'profile'],
  ];
  return fields.every(([scopeKey, contextKey]) =>
    !scope[scopeKey]?.length || scope[scopeKey].includes(context[contextKey]));
}

function expectedValueMatches(actual, expected) {
  return (Array.isArray(expected) ? expected : [expected]).includes(actual);
}

function conditionsMatch(when = {}, values) {
  const all = Object.entries(when.all || {});
  const any = Object.entries(when.any || {});
  return all.every(([symbol, expected]) => expectedValueMatches(values.get(symbol), expected)) &&
    (!any.length || any.some(([symbol, expected]) => expectedValueMatches(values.get(symbol), expected)));
}

export function matchingConfigRules(text, context = {}) {
  const values = configSymbolValues(text);
  return (RULES.rules || []).filter((rule) =>
    scopeMatches(rule.scope, context) &&
    conditionsMatch(rule.when, values));
}

export { RULES as configRules };
