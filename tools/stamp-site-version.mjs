#!/usr/bin/env node
// Maintains the code-behavior VERSION and release identity; --check validates and --keep-version refreshes identity without a version bump.

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeSiteSha256 } from './site-release.mjs';
import { canonicalizeSiteReleaseBytes } from './canonicalize-site-release.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site', 'wrt');
const OUT = join(SITE, 'data', 'site-version.json');
const ROOT_VERSION = join(ROOT, 'VERSION');
const CHECK_ONLY = process.argv.includes('--check');
const KEEP_VERSION = process.argv.includes('--keep-version');
const SELF_TEST = process.argv.includes('--self-test');
const VERSION_RE = /^v\d{10}$/;

function nextVersion() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: '2-digit', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `v${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}`;
}

function resolveVersion({ rootVersion, oldVersion, headVersion, keepVersion, candidateVersion }) {
  const validRoot = VERSION_RE.test(rootVersion || '');
  if (keepVersion) {
    if (!validRoot || rootVersion !== oldVersion) {
      throw new Error('--keep-version requires VERSION and site-version.json to agree before refreshing identity');
    }
    return { version: rootVersion, reason: 'explicit-keep' };
  }
  const alreadyBumped = validRoot && VERSION_RE.test(headVersion || '') &&
    rootVersion !== headVersion && rootVersion === oldVersion;
  if (alreadyBumped) return { version: rootVersion, reason: 'already-bumped' };
  return { version: candidateVersion, reason: 'new-code-version' };
}

function selfTest() {
  const expect = (actual, expected, label) => {
    if (actual.version !== expected.version || actual.reason !== expected.reason) {
      throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  };
  expect(resolveVersion({
    rootVersion: 'v2608161000', oldVersion: 'v2608161000', headVersion: 'v2608161000',
    keepVersion: false, candidateVersion: 'v2608161010',
  }), { version: 'v2608161010', reason: 'new-code-version' }, 'first behavior change');
  expect(resolveVersion({
    rootVersion: 'v2608161010', oldVersion: 'v2608161010', headVersion: 'v2608161000',
    keepVersion: false, candidateVersion: 'v2608161020',
  }), { version: 'v2608161010', reason: 'already-bumped' }, 'same uncommitted development round');
  expect(resolveVersion({
    rootVersion: 'v2608161000', oldVersion: 'v2608161000', headVersion: 'v2608161000',
    keepVersion: true, candidateVersion: 'v2608161010',
  }), { version: 'v2608161000', reason: 'explicit-keep' }, 'explicit keep-version');
  console.log('Version behavior policy self-test passed / VERSION 行为规则自测通过');
}

if (SELF_TEST) {
  selfTest();
  process.exit(0);
}

const releaseBytes = canonicalizeSiteReleaseBytes(SITE, { write: !CHECK_ONLY });
if (CHECK_ONLY && releaseBytes.changedFiles.length) {
  console.error('Site release bytes are not canonical / 站点发布字节未标准化');
  console.error('Run locally before commit / 提交前请先运行: node tools/canonicalize-site-release.mjs');
  process.exit(1);
}
if (!CHECK_ONLY && releaseBytes.changedFiles.length) {
  console.log(`[release-bytes] Canonicalized before stamping: ${releaseBytes.changedFiles.length} file(s)`);
}
const VERSION_INPUTS = [
  '.github/workflows',
  'Shell',
  'config',
  'site/wrt',
  'tools',
];
const VERSION_FILES = [
  '.github/automation-policy.json',
];
const SKIP_INPUTS = new Set([
  'site/wrt/data/build-meta.json',
  'site/wrt/data/site-version.json',
]);
const FINGERPRINT_TEXT_EXTENSIONS = new Set([
  '.config', '.conf', '.css', '.html', '.js', '.json', '.md', '.mjs', '.sh', '.txt', '.yaml', '.yml',
]);
const normalizeText = (text) => text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
const fingerprintContent = (path) => FINGERPRINT_TEXT_EXTENSIONS.has(extname(path).toLowerCase())
  ? Buffer.from(normalizeText(readFileSync(path, 'utf8')))
  : readFileSync(path);

const files = [];
function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else {
      const rel = relative(ROOT, path).replaceAll('\\', '/');
      if (!SKIP_INPUTS.has(rel)) files.push([rel, path]);
    }
  }
}
for (const input of VERSION_INPUTS) walk(join(ROOT, ...input.split('/')));
for (const input of VERSION_FILES) files.push([input, join(ROOT, ...input.split('/'))]);
files.sort(([a], [b]) => a.localeCompare(b));

const hash = createHash('sha256');
for (const [rel, path] of files) {
  hash.update(rel).update('\0').update(fingerprintContent(path)).update('\0');
}
const fingerprint = hash.digest('hex');
const siteRelease = computeSiteSha256(SITE);

let old = {};
try { old = JSON.parse(readFileSync(OUT, 'utf8')); } catch (e) { /* first stamp */ }
let rootVersion = '';
try { rootVersion = readFileSync(ROOT_VERSION, 'utf8').trim(); } catch (e) { /* first stamp */ }
let headVersion = '';
try {
  const result = spawnSync('git', ['-C', ROOT, 'show', 'HEAD:VERSION'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], shell: false });
  if (result.status === 0) headVersion = result.stdout.trim();
} catch (e) { /* Git metadata is optional for stamping; without it, stale inputs create a new version as before. */ }

const versionStateOk = old.fingerprint === fingerprint && old.siteSha256 === siteRelease.siteSha256 &&
  old.hashAlgorithm === 'sha256' && old.timezone === 'Asia/Shanghai' &&
  VERSION_RE.test(old.version || '') && rootVersion === old.version;

if (CHECK_ONLY) {
  if (versionStateOk) {
    console.log(`Project version verified / 项目版本验证通过: ${old.version}`);
    console.log(`Site SHA-256 verified / 全站 SHA-256 验证通过: ${old.siteSha256}`);
    process.exit(0);
  }
  const proposal = resolveVersion({
    rootVersion, oldVersion: old.version || '', headVersion,
    keepVersion: false, candidateVersion: nextVersion(),
  });
  console.error('VERSION, project fingerprint or siteSha256 is stale / VERSION、项目指纹或全站 siteSha256 未更新');
  console.error(`Computed fingerprint / 当前项目指纹: ${fingerprint}`);
  console.error(`Computed siteSha256 / 当前全站 SHA-256: ${siteRelease.siteSha256}`);
  console.error(`Suggested VERSION / 建议 VERSION: ${proposal.version} (${proposal.reason})`);
  console.error('Run locally before commit / 提交前请在本地运行: node tools/stamp-site-version.mjs');
  process.exit(1);
}

if (versionStateOk) {
  console.log(`Version inputs unchanged / 版本输入未变化: ${old.version}`);
  console.log(`Site SHA-256 unchanged / 全站 SHA-256 未变化: ${old.siteSha256}`);
  process.exit(0);
}

const selected = resolveVersion({
  rootVersion, oldVersion: old.version || '', headVersion,
  keepVersion: KEEP_VERSION, candidateVersion: nextVersion(),
});
const version = selected.version;
writeFileSync(OUT, JSON.stringify({
  version,
  timezone: 'Asia/Shanghai',
  fingerprint,
  siteSha256: siteRelease.siteSha256,
  hashAlgorithm: 'sha256',
}, null, 2) + '\n');
writeFileSync(ROOT_VERSION, version + '\n');
if (selected.reason === 'new-code-version') {
  console.log(`Stamped project version / 已更新项目版本: ${old.version || '(none)'} -> ${version}`);
} else if (selected.reason === 'already-bumped') {
  console.log(`Version already refreshed for current HEAD / 当前开发轮次 VERSION 已刷新: ${version}`);
} else {
  console.log(`Kept project version while refreshing identity / 已保留 VERSION 并刷新身份: ${version}`);
}
console.log(`Project fingerprint / 项目指纹: ${fingerprint}`);
console.log(`Site SHA-256 / 全站 SHA-256: ${siteRelease.siteSha256} (${siteRelease.files} files, ${siteRelease.bytes} bytes)`);
