#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyConfigOverrides, verifyConfigLayers } from './config-overrides.mjs';

const args = {};
for (let index = 2; index < process.argv.length; index += 2) {
  args[process.argv[index]?.replace(/^--/, '')] = process.argv[index + 1];
}
for (const key of ['input', 'rules', 'output', 'report']) {
  if (!args[key]) throw new Error(`Missing --${key}`);
}

const inputText = readFileSync(resolve(args.input), 'utf8');
const rules = JSON.parse(readFileSync(resolve(args.rules), 'utf8'));
const { outputText, applied } = applyConfigOverrides(inputText, rules);
const result = verifyConfigLayers(inputText, outputText, rules);
result.applied = applied;
writeFileSync(resolve(args.output), outputText.replace(/\r\n/g, '\n'));
writeFileSync(resolve(args.report), `${JSON.stringify(result, null, 2)}\n`);
if (args.diff) {
  const lines = [
    '# Declared system configuration overrides',
    `# input symbols: ${result.inputSymbols}`,
    `# output symbols: ${result.outputSymbols}`,
    '',
    ...applied.map((item) => `${item.before === null ? '+' : '!'} CONFIG_${item.symbol}: ${item.before ?? '(missing)'} -> ${item.after} (${item.reason})`),
    ...result.unexpected.map((item) => `ERROR CONFIG_${item.symbol}: ${item.before ?? '(missing)'} -> ${item.after ?? '(removed)'}`),
    '',
  ];
  writeFileSync(resolve(args.diff), lines.join('\n'));
}
if (!result.valid) {
  const detail = result.unexpected.map((item) => `${item.symbol}: ${item.before ?? '(missing)'} -> ${item.after ?? '(removed)'}`).join('\n');
  throw new Error(`Undeclared configuration changes detected:\n${detail}`);
}
console.log(`Configuration layers verified: ${applied.length} declared system override(s); user symbols preserved.`);
