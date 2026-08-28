#!/usr/bin/env node

import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseConfigMap } from '../site/wrt/lib/profile-baseline.js';

const SYMBOL_RE = /^[A-Za-z0-9_+@./-]+$/;
const RESULT_CODE = 'configuration-override-mismatch';

function fail(message) {
  throw new Error(message);
}

export function parseOverrideDocument(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('override document must be an object');
  const unknown = Object.keys(input).filter((key) => !['schema', 'overrides'].includes(key));
  if (unknown.length) fail(`unknown override document field: ${unknown[0]}`);
  if (input.schema !== 1) fail('override document schema must be 1');
  if (!Array.isArray(input.overrides)) fail('overrides must be an array');
  if (input.overrides.length > 50000) fail('override count exceeds 50000');

  const seen = new Set();
  return input.overrides.map((entry, index) => {
    if (!Array.isArray(entry) || entry.length !== 2) fail(`override ${index} must be a [symbol, value] pair`);
    const [symbol, raw] = entry;
    if (typeof symbol !== 'string' || !SYMBOL_RE.test(symbol)) fail(`override ${index} has an invalid symbol`);
    if (seen.has(symbol)) fail(`duplicate override symbol: ${symbol}`);
    seen.add(symbol);
    if (typeof raw !== 'string' || !raw || /[\r\n\0]/.test(raw)) fail(`override ${symbol} has an invalid value`);
    return [symbol, raw];
  });
}

export function verifyEffectiveConfig({ overrides, configText, stage = 'post-defconfig' }) {
  const requested = parseOverrideDocument(overrides);
  const actualValues = parseConfigMap(configText);
  const mismatches = [];
  for (const [symbol, requestedValue] of requested) {
    const actualValue = actualValues.get(symbol) ?? 'n';
    if (actualValue !== requestedValue) {
      mismatches.push({
        symbol,
        requested: requestedValue,
        actual: actualValue,
        reason: 'effective-value-differs',
      });
    }
  }
  return {
    schema: 1,
    result: mismatches.length ? 'failure' : 'pass',
    code: mismatches.length ? RESULT_CODE : null,
    stage,
    checked: requested.length,
    mismatchCount: mismatches.length,
    mismatches,
  };
}

function parseArgs(argv) {
  const options = { stage: 'post-defconfig' };
  for (let index = 0; index < argv.length; index++) {
    const name = argv[index];
    if (!['--overrides', '--config', '--out', '--stage'].includes(name)) fail(`unknown argument: ${name}`);
    const value = argv[++index];
    if (!value || value.startsWith('--')) fail(`missing value for ${name}`);
    options[name.slice(2)] = value;
  }
  for (const required of ['overrides', 'config', 'out']) {
    if (!options[required]) fail(`missing --${required}`);
  }
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(options.stage)) fail('invalid stage');
  return options;
}

function writeReport(path, report) {
  const absolute = resolve(path);
  const temporary = `${absolute}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  renameSync(temporary, absolute);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const overrides = JSON.parse(readFileSync(resolve(options.overrides), 'utf8'));
  const configText = readFileSync(resolve(options.config), 'utf8');
  const report = verifyEffectiveConfig({ overrides, configText, stage: options.stage });
  writeReport(options.out, report);
  if (report.result === 'failure') {
    console.error(`::error::${RESULT_CODE}: ${report.mismatchCount} explicit override(s) changed before compilation`);
    process.exitCode = 1;
    return;
  }
  console.log(`Verified ${report.checked} explicit configuration override(s).`);
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`::error::Invalid configuration verification input: ${error.message}`);
    process.exitCode = 2;
  }
}
