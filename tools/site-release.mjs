#!/usr/bin/env node
// Deterministic SHA-256 identity for the deployable site/wrt tree.
// data/site-version.json is the release pointer itself and data/build-meta.json is deployment-local metadata,
// so both are excluded from the content identity to avoid self-reference and host-specific drift.

import { createHash } from 'node:crypto';
import { closeSync, existsSync, lstatSync, openSync, readFileSync, readSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SITE_RELEASE_EXCLUDES = Object.freeze([
  'data/build-meta.json',
  'data/site-version.json',
]);

const HASH_BUFFER_BYTES = 1024 * 1024;
const SHA256_RE = /^[a-f0-9]{64}$/;
const stableCompare = (left, right) => left < right ? -1 : left > right ? 1 : 0;

function normalizedRelative(root, path) {
  return relative(root, path).split(sep).join('/');
}

function assertSiteDirectory(siteRoot) {
  const root = resolve(siteRoot);
  if (!existsSync(root)) throw new Error(`Site root does not exist / 站点目录不存在: ${root}`);
  const stat = lstatSync(root);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`Site root must be a real directory / 站点目录必须是真实目录: ${root}`);
  }
  return root;
}

export function sha256File(path) {
  const hash = createHash('sha256');
  const buffer = Buffer.allocUnsafe(HASH_BUFFER_BYTES);
  const descriptor = openSync(path, 'r');
  try {
    while (true) {
      const bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    closeSync(descriptor);
  }
  return hash.digest('hex');
}

export function collectSiteReleaseFiles(siteRoot, { excludedPaths = SITE_RELEASE_EXCLUDES } = {}) {
  const root = assertSiteDirectory(siteRoot);
  const excluded = new Set(excludedPaths);
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) {
        throw new Error(`Symbolic links are not allowed in the site release / 站点发布内容不允许符号链接: ${path}`);
      }
      if (stat.isDirectory()) walk(path);
      else if (stat.isFile()) {
        const rel = normalizedRelative(root, path);
        if (!excluded.has(rel)) files.push({ rel, path, bytes: stat.size });
      } else {
        throw new Error(`Unsupported site entry / 不支持的站点文件类型: ${path}`);
      }
    }
  };
  walk(root);
  files.sort((left, right) => stableCompare(left.rel, right.rel));
  return files;
}

export function computeSiteSha256(siteRoot, options = {}) {
  const files = collectSiteReleaseFiles(siteRoot, options);
  const hash = createHash('sha256');
  for (const file of files) {
    const digest = sha256File(file.path);
    hash.update(file.rel, 'utf8');
    hash.update('\0');
    hash.update(digest, 'ascii');
    hash.update('\0');
  }
  return {
    siteSha256: hash.digest('hex'),
    files: files.length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
  };
}

export function readSiteReleasePointer(siteRoot) {
  const root = assertSiteDirectory(siteRoot);
  const path = join(root, 'data', 'site-version.json');
  let pointer;
  try { pointer = JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { throw new Error(`Invalid site release pointer / site-version.json 无效: ${error.message}`); }
  return { path, pointer };
}

export function assertSiteRelease(siteRoot) {
  const { path, pointer } = readSiteReleasePointer(siteRoot);
  if (!/^v\d{10}$/.test(String(pointer.version || '')) || pointer.timezone !== 'Asia/Shanghai') {
    throw new Error(`Invalid site release version metadata / 站点版本元数据无效: ${path}`);
  }
  if (pointer.hashAlgorithm !== 'sha256' || !SHA256_RE.test(String(pointer.siteSha256 || ''))) {
    throw new Error(`Invalid siteSha256 release identity / siteSha256 发布身份无效: ${path}`);
  }
  const actual = computeSiteSha256(siteRoot);
  if (actual.siteSha256 !== pointer.siteSha256) {
    throw new Error(`siteSha256 mismatch / 全站 SHA-256 不一致: expected ${pointer.siteSha256}, actual ${actual.siteSha256}`);
  }
  return { ...actual, pointer };
}


function parseCli(argv) {
  let siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'site', 'wrt');
  let mode = 'print';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--print') mode = 'print';
    else if (arg === '--check') mode = 'check';
    else if (arg === '--site') siteRoot = resolve(argv[++i] || '');
    else throw new Error(`Unknown option / 未知选项: ${arg}`);
  }
  return { siteRoot, mode };
}

function printSiteRelease(siteRoot, mode) {
  const actual = computeSiteSha256(siteRoot);
  let pointer = null;
  try { pointer = readSiteReleasePointer(siteRoot).pointer; } catch { /* pointer may not exist for standalone hash inspection */ }
  console.log(`Site SHA-256 / 全站 SHA-256: ${actual.siteSha256}`);
  console.log(`Files / 文件数: ${actual.files}`);
  console.log(`Bytes / 字节数: ${actual.bytes}`);
  if (pointer?.siteSha256) {
    console.log(`Release pointer / 发布指针: ${pointer.siteSha256}`);
    console.log(`Status / 状态: ${pointer.siteSha256 === actual.siteSha256 ? 'MATCH' : 'MISMATCH'}`);
  }
  if (mode === 'check') {
    const checked = assertSiteRelease(siteRoot);
    console.log(`Release check / 发布校验: PASS (${checked.pointer.version})`);
  }
}

const MODULE_PATH = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(MODULE_PATH)) {
  try {
    const { siteRoot, mode } = parseCli(process.argv.slice(2));
    printSiteRelease(siteRoot, mode);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
