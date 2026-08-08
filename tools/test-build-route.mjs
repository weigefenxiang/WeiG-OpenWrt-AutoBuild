#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT = fileURLToPath(new URL('./parse-build-route.mjs', import.meta.url));
const COMMIT = '0123456789abcdef0123456789abcdef01234567';

function run({ branch = 'dev', titleBranch = 'dev', commit = COMMIT, duplicate = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'weig-build-route-'));
  const out = join(root, 'output.txt');
  const marker = `<!-- WEIG_BUILD_ROUTE_V1\nbranch=${branch}\ncommit=${commit}\n-->`;
  const body = duplicate ? `${marker}\n${marker}` : marker;
  const titlePrefix = titleBranch === 'main' ? '' : `${titleBranch.replaceAll('/', '_')}/`;
  const result = spawnSync(process.execPath, [SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ISSUE_BODY: body,
      ISSUE_TITLE: `[build] ${titlePrefix}260808_2017/fixture/target/source/version/profile`,
      GITHUB_OUTPUT: out,
    },
  });
  const outputs = result.status === 0 ? readFileSync(out, 'utf8') : '';
  rmSync(root, { recursive: true, force: true });
  return { ...result, outputs };
}

let result = run();
assert.equal(result.status, 0, result.stderr);
assert.match(result.outputs, /^request_branch=dev$/m);
assert.match(result.outputs, new RegExp(`^request_commit=${COMMIT}$`, 'm'));

result = run({ branch: 'main', titleBranch: 'main' });
assert.equal(result.status, 0, result.stderr);
assert.match(result.outputs, /^request_branch=main$/m);

result = run({ branch: 'fix/e-branch-aware', titleBranch: 'fix/e-branch-aware' });
assert.equal(result.status, 0, result.stderr);
assert.match(result.outputs, /^request_branch=fix\/e-branch-aware$/m);

result = run({ branch: 'dev', titleBranch: 'staging' });
assert.notEqual(result.status, 0);
assert.match(result.stderr, /title route does not match marker/i);

result = run({ branch: '../main' });
assert.notEqual(result.status, 0);
assert.match(result.stderr, /invalid route branch/i);

result = run({ commit: '0123456' });
assert.notEqual(result.status, 0);
assert.match(result.stderr, /invalid route commit/i);

result = run({ duplicate: true });
assert.notEqual(result.status, 0);
assert.match(result.stderr, /duplicate route marker/i);

console.log('Build route tests passed / 构建路由测试通过');
