#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideBuildAdmission, PUBLIC_BUILD_LIMIT } from './build-admission.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const at = (second) => `2026-08-10T11:08:${String(second).padStart(2, '0')}Z`;
const run = (id, second) => ({ id, created_at: at(second) });

assert.equal(PUBLIC_BUILD_LIMIT, 3);

const collidingOwner = decideBuildAdmission({
  isRepositoryOwner: true,
  currentRunId: 31382153641,
  currentCreatedAt: at(15),
  activeRuns: [run(31382119111, 1)],
});
assert.equal(31382153641 % 6, 31382119111 % 6);
assert.equal(collidingOwner.allowed, true, 'repository owner must not be serialized by a modulo slot');
assert.equal(collidingOwner.limit, null);

const active = [run(100, 1), run(101, 2), run(102, 3), run(103, 4)];
const firstThree = [0, 1, 2].map((index) => decideBuildAdmission({
  currentRunId: 100 + index,
  currentCreatedAt: at(index + 1),
  activeRuns: active,
}));
assert.deepEqual(firstThree.map((item) => item.allowed), [true, true, true]);

const fourth = decideBuildAdmission({
  currentRunId: 103,
  currentCreatedAt: at(4),
  activeRuns: [...active, run(101, 2)],
});
assert.equal(fourth.allowed, false);
assert.equal(fourth.rank, 3);
assert.equal(fourth.active, 4, 'duplicate API rows must not consume another place');

const recovered = decideBuildAdmission({
  currentRunId: 103,
  currentCreatedAt: at(4),
  activeRuns: [run(101, 2), run(102, 3)],
});
assert.equal(recovered.allowed, true, 'a completed or cancelled build must release public capacity');

assert.throws(() => decideBuildAdmission({ currentRunId: 0, currentCreatedAt: at(1) }),
  /identity is invalid/);

const workflow = readFileSync(join(ROOT, '.github', 'workflows', 'custom-build.yml'), 'utf8');
assert.match(workflow, /decideBuildAdmission/);
assert.doesNotMatch(workflow,
  /OWNER_BUILD_CONCURRENCY|outputs\.slot|needs\.admission\.outputs\.slot|Number\(context\.runId\)\s*%/);
assert.doesNotMatch(workflow, /group:\s*custom-build-user-/);

console.log('Build admission tests passed.');
