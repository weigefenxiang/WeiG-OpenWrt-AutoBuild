#!/usr/bin/env node
// Canonicalize deployable site/wrt text bytes before release hashing.
// The text/binary classification comes from the existing text-format contract; raw release hashing stays byte-exact.

import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';
import { collectSiteReleaseFiles } from './site-release.mjs';
import { expectedLineEnding } from './check-text-format.mjs';

const MODULE_PATH = fileURLToPath(import.meta.url);
const PROJECT_ROOT = resolve(dirname(MODULE_PATH), '..');
const DEFAULT_SITE = resolve(PROJECT_ROOT, 'site', 'wrt');

function decodeCanonicalText(buffer, rel) {
  if (buffer.includes(0)) throw new Error(`${rel}: contains NUL bytes and cannot be canonicalized as text`);
  if (buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
    throw new Error(`${rel}: UTF-8 BOM is not allowed`);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new Error(`${rel}: is not valid UTF-8`);
  }
}

export function canonicalizeTextBytes(buffer, expected, rel = '(text)') {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
  if (expected !== 'lf' && expected !== 'crlf') return buffer;
  const text = decodeCanonicalText(buffer, rel);
  const lf = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return Buffer.from(expected === 'crlf' ? lf.replace(/\n/g, '\r\n') : lf, 'utf8');
}

export function canonicalizeSiteReleaseBytes(siteRoot = DEFAULT_SITE, { write = true } = {}) {
  const root = resolve(siteRoot);
  if (!existsSync(root) || !lstatSync(root).isDirectory()) {
    throw new Error(`Site root does not exist / 站点目录不存在: ${root}`);
  }
  const changedFiles = [];
  let textFiles = 0;
  for (const file of collectSiteReleaseFiles(root, { excludedPaths: [] })) {
    const expected = expectedLineEnding(`site/wrt/${file.rel}`);
    if (!expected) continue;
    textFiles += 1;
    const before = readFileSync(file.path);
    const after = canonicalizeTextBytes(before, expected, file.rel);
    if (before.equals(after)) continue;
    changedFiles.push(file.rel);
    if (write) writeFileSync(file.path, after);
  }
  return { root, textFiles, changedFiles };
}

function parseCli(argv) {
  let siteRoot = DEFAULT_SITE;
  let checkOnly = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') checkOnly = true;
    else if (arg === '--site') siteRoot = resolve(argv[++i] || '');
    else throw new Error(`Unknown option / 未知选项: ${arg}`);
  }
  if (!siteRoot) throw new Error('--site requires a path.');
  return { siteRoot, checkOnly };
}

function runCli() {
  try {
    const { siteRoot, checkOnly } = parseCli(process.argv.slice(2));
    const result = canonicalizeSiteReleaseBytes(siteRoot, { write: !checkOnly });
    if (checkOnly && result.changedFiles.length) {
      console.error(`[release-bytes] FAILED: ${result.changedFiles.length} site text file(s) are not canonical.`);
      for (const rel of result.changedFiles.slice(0, 20)) console.error(`  - ${rel}`);
      return 1;
    }
    if (result.changedFiles.length) {
      console.log(`[release-bytes] Canonicalized ${result.changedFiles.length}/${result.textFiles} site text file(s).`);
      for (const rel of result.changedFiles) console.log(`  - ${rel}`);
    } else {
      console.log(`[release-bytes] OK: ${result.textFiles} site text file(s) already use canonical release bytes.`);
    }
    return 0;
  } catch (error) {
    console.error(`[release-bytes] ERROR: ${error?.message || error}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(MODULE_PATH)) {
  process.exitCode = runCli();
}
