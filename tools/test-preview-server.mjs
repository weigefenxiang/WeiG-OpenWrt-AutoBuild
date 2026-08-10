#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createBuildMeta } from './gen-build-meta.mjs';
import { computeSiteSha256 } from './site-release.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_ROOT = mkdtempSync(join(tmpdir(), 'weig-preview-'));
const SITE_ROOT = join(FIXTURE_ROOT, 'site', 'wrt');
function copyTree(source, destination) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(destination, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isFile()) copyFileSync(from, to);
  }
}
copyTree(join(ROOT, 'site', 'wrt'), SITE_ROOT);
writeFileSync(join(FIXTURE_ROOT, 'VERSION'), readFileSync(join(ROOT, 'VERSION')));
const DISK_META = join(SITE_ROOT, 'data', 'build-meta.json');
rmSync(DISK_META, { force: true });
const POINTER_PATH = join(SITE_ROOT, 'data', 'site-version.json');
const fixturePointer = JSON.parse(readFileSync(POINTER_PATH, 'utf8'));
fixturePointer.siteSha256 = computeSiteSha256(SITE_ROOT).siteSha256;
writeFileSync(POINTER_PATH, `${JSON.stringify(fixturePointer, null, 2)}\n`);
const TEST_BRANCH = 'dev';
const TEST_COMMIT = 'a'.repeat(40);
const expectedMeta = createBuildMeta({
  root: FIXTURE_ROOT, branch: TEST_BRANCH, commit: TEST_COMMIT,
  builtAt: '2026-08-10T06:30:00+08:00',
});

const child = spawn(process.execPath, [
  join(ROOT, 'tools', 'serve.mjs'), SITE_ROOT, '0', '--interactive', '--build-meta-root', FIXTURE_ROOT,
], {
  cwd: ROOT,
  env: {
    ...process.env,
    WEIG_BUILD_TIME: '2026-08-10T06:30:00+08:00',
    WEIG_BUILD_BRANCH: TEST_BRANCH,
    WEIG_BUILD_COMMIT: TEST_COMMIT,
  },
  stdio: ['pipe', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';
child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');
child.stdout.on('data', (chunk) => { stdout += chunk; });
child.stderr.on('data', (chunk) => { stderr += chunk; });

async function waitForPort() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const match = /http:\/\/localhost:(\d+)/.exec(stdout);
    if (match) return Number(match[1]);
    if (child.exitCode !== null) throw new Error(`preview server exited early: ${stderr || stdout}`);
    await delay(25);
  }
  throw new Error(`preview server did not become ready: ${stderr || stdout}`);
}

try {
  const port = await waitForPort();
  const response = await fetch(`http://localhost:${port}/data/build-meta.json`, { cache: 'no-store' });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /^application\/json\b/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const meta = await response.json();
  const pointer = JSON.parse(readFileSync(join(SITE_ROOT, 'data', 'site-version.json'), 'utf8'));
  assert.equal(meta.version, pointer.version);
  assert.equal(meta.siteSha256, pointer.siteSha256);
  assert.equal(meta.branch, expectedMeta.branch);
  assert.equal(meta.commit, expectedMeta.commit);
  assert.equal(meta.builtAt, '2026-08-10T06:30:00+08:00');
  assert.equal(existsSync(DISK_META), false, 'local preview created a build-meta file');

  const nextVersion = expectedMeta.version === 'v2608100631' ? 'v2608100632' : 'v2608100631';
  const nextPointer = JSON.parse(readFileSync(POINTER_PATH, 'utf8'));
  nextPointer.version = nextVersion;
  writeFileSync(join(FIXTURE_ROOT, 'VERSION'), `${nextVersion}\n`);
  writeFileSync(POINTER_PATH, `${JSON.stringify(nextPointer, null, 2)}\n`);
  const refreshedResponse = await fetch(`http://localhost:${port}/data/build-meta.json`, { cache: 'no-store' });
  assert.equal(refreshedResponse.status, 200);
  const refreshedMeta = await refreshedResponse.json();
  assert.equal(refreshedMeta.version, nextVersion,
    'long-running preview server kept the VERSION from startup');
  assert.equal(refreshedMeta.siteSha256, nextPointer.siteSha256,
    'long-running preview server kept the release pointer from startup');
  assert.equal(refreshedMeta.branch, TEST_BRANCH);
  assert.equal(refreshedMeta.commit, TEST_COMMIT);
  assert.equal(existsSync(DISK_META), false, 'identity refresh created a build-meta file');

  const mismatchedVersion = nextVersion === 'v2608100633' ? 'v2608100634' : 'v2608100633';
  writeFileSync(join(FIXTURE_ROOT, 'VERSION'), `${mismatchedVersion}\n`);
  const mismatchResponse = await fetch(`http://localhost:${port}/data/build-meta.json`, { cache: 'no-store' });
  assert.equal(mismatchResponse.status, 500,
    'invalid preview identity was exposed as an optional missing build-meta file');
  writeFileSync(join(FIXTURE_ROOT, 'VERSION'), `${nextVersion}\n`);
  child.stdin.end('0\n');
  const exitCode = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('preview server did not stop')), 5000);
    child.once('exit', (code) => { clearTimeout(timer); resolve(code); });
  });
  assert.equal(exitCode, 0);
  console.log('Local preview identity tests passed / 本地预览身份测试通过');
} finally {
  if (child.exitCode === null) child.kill();
  rmSync(FIXTURE_ROOT, { recursive: true, force: true });
}
