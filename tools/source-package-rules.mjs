import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RULES = JSON.parse(readFileSync(join(ROOT, 'config', '001.presets', 'source-package-rules.json'), 'utf8'));

function configValues(text) {
  const values = new Map();
  for (const match of String(text).matchAll(/^CONFIG_([A-Za-z0-9_.+-]+)=([ym])$/gm)) values.set(match[1], match[2]);
  return values;
}

export function sourcePackageRuleViolations(text, sourceId) {
  const values = configValues(text);
  return (RULES.rules || []).filter((rule) => rule.source === sourceId &&
    Object.entries(rule.requires || {}).every(([symbol, value]) => values.get(symbol) === value));
}

export { RULES as sourcePackageRules };
