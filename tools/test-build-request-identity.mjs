#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TOOL = fileURLToPath(new URL('./parse-build-request-identity.mjs', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'weig-build-request-identity-'));

function run(request, {
  title = '[build] dev/260808_2242/test/Generic_x86/64/ImmortalWrt/25.12/generic',
  requester = 'weigefenxiang',
  issueNumber = '141',
  extraFiles = [],
} = {}) {
  const requestPath = join(root, `request-${Math.random().toString(16).slice(2)}.json`);
  writeFileSync(requestPath, `${JSON.stringify(request)}\n`);
  const manifestPath = join(root, `manifest-${Math.random().toString(16).slice(2)}.json`);
  writeFileSync(manifestPath, `${JSON.stringify({
    version: 1,
    files: [{ name: 'build-request.json', path: requestPath, type: 'json', bytes: 200 }, ...extraFiles],
  })}\n`);
  return spawnSync(process.execPath, [TOOL], {
    encoding: 'utf8',
    env: {
      ...process.env,
      REQUEST_MANIFEST: manifestPath,
      ISSUE_TITLE: title,
      REQUESTER: requester,
      ISSUE_NUMBER: issueNumber,
    },
  });
}

const commit = '005e435f91b2c2891cf46468e2cb46e36519df8b';
const base = { schema: 5, requestId: '260808_2242', sourceEnv: 'dev', requestCommit: commit, config: 'CONFIG_TARGET_x86=y\n' };

try {
  let result = run(base);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /^request_branch=dev$/m);
  assert.match(result.stdout, new RegExp(`^request_commit=${commit}$`, 'm'));
  assert.match(result.stdout, /^request_id=260808_2242$/m);
  assert.match(result.stdout, /^run_title=weigefenxiang#141 dev-260808_2242\/test\/Generic_x86\/64\/ImmortalWrt\/25\.12\/generic$/m);

  result = run({ ...base, sourceEnv: 'main' }, { title: '[build] 260808_2242/test/Generic_x86/64/ImmortalWrt/25.12/generic' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /^request_branch=main$/m);
  assert.match(result.stdout, /^run_title=weigefenxiang#141 260808_2242\/test\/Generic_x86\/64\/ImmortalWrt\/25\.12\/generic$/m);

  result = run({ ...base, sourceEnv: 'fix/e-v2' }, { title: '[build] fix_e-v2/260808_2242/test/Generic_x86/64/ImmortalWrt/25.12/generic' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /^request_branch=fix\/e-v2$/m);
  assert.match(result.stdout, /^run_title=weigefenxiang#141 fix_e-v2-260808_2242\/test\/Generic_x86\/64\/ImmortalWrt\/25\.12\/generic$/m);

  result = run(base, { title: '[route-test] manual E v2' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /^run_title=$/m);

  for (const bad of [
    { ...base, schema: 4 },
    { ...base, sourceEnv: '../main' },
    { ...base, requestCommit: '005e435' },
    { ...base, requestCommit: 'g05e435f91b2c2891cf46468e2cb46e36519df8b' },
    { ...base, requestId: 'bad-id' },
  ]) {
    result = run(bad);
    assert.notEqual(result.status, 0, `unexpected pass: ${JSON.stringify(bad)}`);
  }

  result = run(base, { title: '[build] staging/260808_2242/test/Generic_x86/64/ImmortalWrt/25.12/generic' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /branch identity mismatch/);

  result = run(base, { title: '[build] dev/260808_9999/test/Generic_x86/64/ImmortalWrt/25.12/generic' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /requestId mismatch/);

  result = run(base, { extraFiles: [{ name: 'extra.config', path: 'unused', type: 'config', bytes: 100 }] });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /exactly one build-request\.json/);

  console.log('Build request identity tests passed / 构建请求身份测试通过');
} finally {
  rmSync(root, { recursive: true, force: true });
}
