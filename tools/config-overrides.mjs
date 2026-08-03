import { createHash } from 'node:crypto';

const enabled = /^CONFIG_([A-Za-z0-9_.+-]+)=(.*)$/;
const disabled = /^# CONFIG_([A-Za-z0-9_.+-]+) is not set$/;

export function parseConfigSymbols(text) {
  const values = new Map();
  for (const rawLine of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trimEnd();
    const active = line.match(enabled);
    if (active) {
      values.set(active[1], active[2]);
      continue;
    }
    const inactive = line.match(disabled);
    if (inactive) values.set(inactive[1], 'n');
  }
  return values;
}

function digest(text) {
  return createHash('sha256').update(String(text || '').replace(/\r\n/g, '\n')).digest('hex');
}

function configValue(text, symbol) {
  return parseConfigSymbols(text).get(symbol);
}

export function setConfigSymbol(text, symbol, value) {
  if (!/^[A-Z0-9_]+$/.test(symbol)) throw new Error(`Invalid override symbol: ${symbol}`);
  if (!['n', 'm', 'y'].includes(value)) throw new Error(`Invalid override value for ${symbol}: ${value}`);
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const line = value === 'n' ? `# CONFIG_${symbol} is not set` : `CONFIG_${symbol}=${value}`;
  const pattern = new RegExp(`^(?:CONFIG_${escaped}=.*|# CONFIG_${escaped} is not set)$`, 'm');
  if (pattern.test(text)) return text.replace(pattern, line);
  return `${String(text).replace(/\s*$/, '')}\n${line}\n`;
}

export function validateOverrideRules(rules) {
  if (!rules || rules.schema !== 1 || !Array.isArray(rules.overrides)) {
    throw new Error('Invalid system override rules: expected schema 1 and overrides[]');
  }
  const seen = new Set();
  for (const item of rules.overrides) {
    if (!item || !/^[A-Z0-9_]+$/.test(item.symbol) || !['n', 'm', 'y'].includes(item.value)) {
      throw new Error(`Invalid system override: ${JSON.stringify(item)}`);
    }
    if (seen.has(item.symbol)) throw new Error(`Duplicate system override: ${item.symbol}`);
    seen.add(item.symbol);
  }
  return rules.overrides;
}

export function applyConfigOverrides(inputText, rules) {
  const overrides = validateOverrideRules(rules);
  let outputText = String(inputText || '').replace(/\r\n/g, '\n');
  const applied = [];
  for (const item of overrides) {
    const before = configValue(outputText, item.symbol);
    if (before !== item.value) {
      outputText = setConfigSymbol(outputText, item.symbol, item.value);
      applied.push({ symbol: item.symbol, before: before ?? null, after: item.value, reason: item.reason || '' });
    }
  }
  return { outputText, applied };
}

export function verifyConfigLayers(inputText, outputText, rules) {
  const overrides = validateOverrideRules(rules);
  const allowed = new Map(overrides.map((item) => [item.symbol, item.value]));
  const input = parseConfigSymbols(inputText);
  const output = parseConfigSymbols(outputText);
  const unexpected = [];
  for (const [symbol, before] of input) {
    const after = output.get(symbol);
    if (after !== before && (!allowed.has(symbol) || allowed.get(symbol) !== after)) {
      unexpected.push({ symbol, before, after: after ?? null });
    }
  }
  for (const [symbol, after] of output) {
    if (!input.has(symbol) && (!allowed.has(symbol) || allowed.get(symbol) !== after)) {
      unexpected.push({ symbol, before: null, after });
    }
  }
  return {
    schema: 1,
    policy: 'authoritative-with-declared-system-overrides',
    valid: unexpected.length === 0,
    inputSymbols: input.size,
    outputSymbols: output.size,
    inputSha256: digest(inputText),
    outputSha256: digest(outputText),
    declaredOverrides: overrides,
    unexpected,
    unexpectedCount: unexpected.length,
  };
}
