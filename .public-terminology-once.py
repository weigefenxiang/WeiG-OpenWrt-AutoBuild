from pathlib import Path

root = Path(__file__).resolve().parent
scanner = r'''#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASE_SENSITIVE_HASHES = new Set([
  '11fb682be0a0233d5fb899721ecfc1827d20f0d2ff2e093310efa61efca8af1c',
]);
const CASE_INSENSITIVE_HASHES = new Set([
  '7d3194f79e645c42e4396dda38be04766810ec6a00d00aced3ffc2a0a1f1a9ef',
  '60965168ce762e949600281ba6d01fee136e5b6e8257b1f216f9025ed324474c',
  'c857d09db23e6822e3600bc06ad8d58f92ed62bc8efd81c753f77048662cb97d',
  '3ea125d0bff386e6754b3782b300016fc79a9cf8f8669c0a5c3db64467ddb681',
  'c70eca6b0f88f44d81a41311647e50fda1ac454ec04ffd442b0eb4743a993131',
  '6f7ac1823da81d2e52d1a1549ee69c85bbf8bb56d06682849e7c09da2785ce3b',
  'add92b9cde2bdbf3daaf65a0db79e9b1a7fa428b71b4d6ce38c742eb6dca0c1c',
  '053ea4804ef1bb33d4a3d6fb024a614b6d257cebc2bc7cd915da9c9522f37ffc',
]);
const CANDIDATE_LENGTHS = new Set([2, 3, 4, 6, 7, 8, 9]);
const cache = new Map();

function digest(value) {
  if (!cache.has(value)) cache.set(value, createHash('sha256').update(value).digest('hex'));
  return cache.get(value);
}

function blockedToken(token) {
  if (!CANDIDATE_LENGTHS.has(token.length)) return '';
  const exact = digest(token);
  if (CASE_SENSITIVE_HASHES.has(exact)) return exact;
  const folded = digest(token.toLowerCase());
  return CASE_INSENSITIVE_HASHES.has(folded) ? folded : '';
}

function tokens(text) {
  return text.match(/[A-Za-z][A-Za-z0-9]*/g) || [];
}

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT })
  .toString('utf8').split('\0').filter(Boolean);
const issues = [];

for (const path of tracked) {
  for (const token of tokens(path)) {
    const hash = blockedToken(token);
    if (hash) issues.push(`${path}:path:${hash.slice(0, 12)}`);
  }

  const bytes = readFileSync(resolve(ROOT, path));
  if (bytes.includes(0)) continue;
  const lines = bytes.toString('utf8').split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    for (const token of tokens(lines[index])) {
      const hash = blockedToken(token);
      if (hash) issues.push(`${path}:${index + 1}:${hash.slice(0, 12)}`);
    }
  }
}

if (issues.length) {
  console.error('Public terminology policy violations:');
  for (const issue of issues) console.error(`  ${issue}`);
  process.exitCode = 1;
} else {
  console.log(`Public terminology policy passed (${tracked.length} tracked files checked).`);
}
'''
(root / 'tools' / 'check-public-terminology.mjs').write_text(scanner, encoding='utf-8')

check_path = root / 'tools' / 'check-all.mjs'
check = check_path.read_text(encoding='utf-8')
needle = "const regressionTests = [\n"
entry = "  'check-public-terminology.mjs',\n"
if entry not in check:
    if needle not in check:
        raise SystemExit('regression test anchor missing')
    check = check.replace(needle, needle + entry, 1)
    check_path.write_text(check, encoding='utf-8')
