import { createHash } from 'node:crypto';

// OpenWrt package symbols keep package punctuation, for example PACKAGE_luci-app.
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

/**
 * The submitted file is immutable input. Upstream Kconfig may add defaults, but
 * it must never rewrite an explicitly supplied user symbol without stopping.
 */
export function verifyNormalizedConfigText(inputText, normalizedText) {
  const input = parseConfigSymbols(inputText);
  const normalized = parseConfigSymbols(normalizedText);
  const changed = [];
  for (const [symbol, before] of input) {
    const after = normalized.get(symbol);
    if (after !== before) changed.push({ symbol, before, after: after ?? null });
  }
  const added = [...normalized]
    .filter(([symbol]) => !input.has(symbol))
    .map(([symbol, value]) => ({ symbol, value }));
  return {
    schema: 1,
    valid: changed.length === 0,
    inputSymbols: input.size,
    normalizedSymbols: normalized.size,
    addedCount: added.length,
    changedCount: changed.length,
    inputSha256: digest(inputText),
    normalizedSha256: digest(normalizedText),
    changed,
    added,
  };
}
