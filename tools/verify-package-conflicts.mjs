#!/usr/bin/env node
// Reject enabled package pairs declared mutually exclusive by the selected upstream.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function packageTokens(value) {
  return String(value || '').match(/[A-Za-z0-9][A-Za-z0-9_.+-]*/g) || [];
}

export function enabledPackageStates(configText) {
  const states = new Map();
  for (const line of String(configText || '').replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(/^CONFIG_PACKAGE_([A-Za-z0-9_.+-]+)=([ym])$/);
    if (match) states.set(match[1], match[2]);
  }
  return states;
}

export function packageConflictsFromInfo(packageInfoText) {
  const conflicts = new Map();
  let name = '';
  for (const line of String(packageInfoText || '').replace(/\r\n/g, '\n').split('\n')) {
    const packageMatch = line.match(/^Package:\s*(\S+)/);
    if (packageMatch) {
      name = packageMatch[1];
      continue;
    }
    const conflictMatch = line.match(/^Conflicts:\s*(.*)$/);
    if (name && conflictMatch) conflicts.set(name, packageTokens(conflictMatch[1]));
  }
  return conflicts;
}

function selectedConflictPairs(states, conflicts) {
  const pairs = new Map();
  for (const [name, blocked] of conflicts) {
    if (states.get(name) !== 'y') continue;
    for (const other of blocked) {
      if (states.get(other) !== 'y') continue;
      const pair = [name, other].sort();
      pairs.set(pair.join('\0'), pair);
    }
  }
  return [...pairs.values()];
}

export function findPackageInfoConflicts(configText, packageInfoText) {
  return selectedConflictPairs(enabledPackageStates(configText), packageConflictsFromInfo(packageInfoText));
}

export function findCatalogPackageConflicts(configText, catalog) {
  const conflicts = new Map();
  for (const option of catalog?.menu?.options || []) {
    if (!String(option.symbol || '').startsWith('PACKAGE_')) continue;
    const blocked = (option.conflicts || [])
      .map((item) => String(item).replace(/^PACKAGE_/, ''))
      .filter(Boolean);
    if (blocked.length) conflicts.set(option.symbol.slice('PACKAGE_'.length), blocked);
  }
  return selectedConflictPairs(enabledPackageStates(configText), conflicts);
}

export function formatPackageConflicts(pairs) {
  return pairs.map(([left, right]) => `${left} <-> ${right}`).join('; ');
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

function main() {
  const configPath = argValue('--config');
  const packageInfoPath = argValue('--package-info');
  if (!configPath || !packageInfoPath) {
    throw new Error('Usage: verify-package-conflicts.mjs --config <.config> --package-info <.packageinfo>');
  }
  const pairs = findPackageInfoConflicts(readFileSync(configPath, 'utf8'), readFileSync(packageInfoPath, 'utf8'));
  if (pairs.length) throw new Error(`Package conflicts / 软件包冲突: ${formatPackageConflicts(pairs)}`);
  console.log('Package conflict preflight passed / 软件包互斥预检通过');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
