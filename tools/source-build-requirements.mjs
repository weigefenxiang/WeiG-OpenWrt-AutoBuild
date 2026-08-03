import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REQUIREMENTS = JSON.parse(readFileSync(
  join(ROOT, 'config', '001.presets', 'source-build-requirements.json'), 'utf8'));

function scopeValueMatches(values, actual) {
  return !values?.length || values.includes('*') || values.includes(actual);
}

function scopeMatches(scope = {}, context = {}) {
  return scopeValueMatches(scope.sources, context.sourceId) &&
    scopeValueMatches(scope.branches, context.branch) &&
    scopeValueMatches(scope.systems, context.system) &&
    scopeValueMatches(scope.subtargets, context.subtarget) &&
    scopeValueMatches(scope.profiles, context.profile);
}

function configSymbolValue(text, symbol) {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const enabled = String(text).match(new RegExp(`^CONFIG_${escaped}=([ym])$`, 'm'));
  if (enabled) return enabled[1];
  return new RegExp(`^# CONFIG_${escaped} is not set$`, 'm').test(String(text)) ? 'n' : undefined;
}

function setConfigSymbol(text, symbol, value) {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const line = value === 'n' ? `# CONFIG_${symbol} is not set` : `CONFIG_${symbol}=${value}`;
  const pattern = new RegExp(`^(?:CONFIG_${escaped}=.*|# CONFIG_${escaped} is not set)$`, 'm');
  if (pattern.test(text)) return text.replace(pattern, line);
  return text.replace(/\s*$/, '\n') + line + '\n';
}

export function matchingBuildRequirements(context = {}) {
  return (REQUIREMENTS.requirements || []).filter((requirement) =>
    scopeMatches(requirement.scope, context));
}

export function missingBuildRequirements(text, context = {}) {
  return matchingBuildRequirements(context).map((requirement) => ({
    ...requirement,
    missingOptions: (requirement.options || []).filter((option) =>
      configSymbolValue(text, option.symbol) !== option.value),
  })).filter((requirement) => requirement.missingOptions.length);
}

export function applyBuildRequirements(text, requirements = []) {
  for (const requirement of requirements) {
    for (const option of requirement.options || []) {
      text = setConfigSymbol(text, option.symbol, option.value);
    }
  }
  return text;
}

export function formatMissingBuildRequirements(requirements = [], language = 'zh-CN') {
  return requirements.flatMap((requirement) => requirement.missingOptions.map((option) => {
    const label = option.label?.[language] || option.label?.en || option.symbol;
    return `CONFIG_${option.symbol}=${option.value}（${label}）`;
  })).join('、');
}

export { REQUIREMENTS as sourceBuildRequirements };
