#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createBuildMeta } from './gen-build-meta.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_ROOT = join(ROOT, 'site', 'wrt');
const DISK_META = join(SITE_ROOT, 'data', 'build-meta.json');
const diskMetaBefore = readFileSync(DISK_META);
const expectedMeta = createBuildMeta({ root: ROOT, builtAt: '2026-08-10T06:30:00+08:00' });

const child = spawn(process.execPath, [
  join(ROOT, 'tools', 'serve.mjs'), SITE_ROOT, '0', '--interactive', '--build-meta-root', ROOT,
], {
  cwd: ROOT,
  env: {
    ...process.env,
    WEIG_BUILD_TIME: '2026-08-10T06:30:00+08:00',
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
  assert.deepEqual(readFileSync(DISK_META), diskMetaBefore);
  child.stdin.end('0\n');
  const exitCode = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('preview server did not stop')), 5000);
    child.once('exit', (code) => { clearTimeout(timer); resolve(code); });
  });
  assert.equal(exitCode, 0);
  console.log('Local preview identity tests passed / 本地预览身份测试通过');
} finally {
  if (child.exitCode === null) child.kill();
}
