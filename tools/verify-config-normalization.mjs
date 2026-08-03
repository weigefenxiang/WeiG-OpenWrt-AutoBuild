#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifyNormalizedConfigText } from './config-normalization.mjs';

const args = {};
for (let index = 2; index < process.argv.length; index += 2) {
  args[process.argv[index]?.replace(/^--/, '')] = process.argv[index + 1];
}
for (const key of ['input', 'normalized', 'report']) {
  if (!args[key]) throw new Error(`Missing --${key}`);
}

const result = verifyNormalizedConfigText(
  readFileSync(resolve(args.input), 'utf8'),
  readFileSync(resolve(args.normalized), 'utf8'),
);
writeFileSync(resolve(args.report), JSON.stringify(result, null, 2) + '\n');
if (args.diff) {
  const lines = [
    '# Upstream Kconfig normalization report',
    `# submitted symbols: ${result.inputSymbols}`,
    `# normalized symbols: ${result.normalizedSymbols}`,
    '',
    ...result.changed.map((item) => `! CONFIG_${item.symbol}: ${item.before} -> ${item.after ?? '(removed)'}`),
    ...result.added.map((item) => `+ CONFIG_${item.symbol}=${item.value}`),
    '',
  ];
  writeFileSync(resolve(args.diff), lines.join('\n'));
}
if (!result.valid) {
  const detail = result.changed.slice(0, 30)
    .map((item) => `${item.symbol}: ${item.before} -> ${item.after ?? '(removed)'}`).join('\n');
  throw new Error(`Upstream Kconfig rewrote explicit submitted options (${result.changedCount}):\n${detail}`);
}
console.log(`Kconfig normalization verified: ${result.inputSymbols} submitted symbols preserved; ` +
  `${result.addedCount} upstream defaults added.`);
