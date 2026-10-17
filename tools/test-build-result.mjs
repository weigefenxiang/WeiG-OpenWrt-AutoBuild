import assert from 'node:assert/strict';
import { classifyBuildEvidence, resolveBuildResult, renderBuildResult, publishBuildResult } from './build-result.mjs';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const classify = log => classifyBuildEvidence({ stages: [{ stage: 'parallel', log }], config: 'CONFIG_TARGET_ROOTFS_PARTSIZE=160\n' });
for (const line of ['ext4_allocate_best_fit_partial: failed to allocate 123 blocks, out of space',
  'make_ext4fs: not enough space', 'rootfs image is too large']) {
  const report = classify(line); assert.equal(report.findings[0].code, 'rootfs-capacity'); assert.equal(report.rootfsMiB, '160');
}
assert.equal(classify('cp: cannot write: No space left on device').findings[0].code, 'runner-disk');
assert.equal(classify('Image file is too big (123 > 120)').findings[0].code, 'image-capacity');
assert.equal(classify('g++: fatal error: Killed signal terminated program cc1plus').findings[0].code, 'runner-memory');
assert.equal(classify('echo "rootfs image is too large"; exit 1').findings.length, 0);
assert.equal(classify('checking for available disk space... yes').findings.length, 0);
const annotation = { message: 'The job has exceeded the maximum execution time of 5h50m0s' };
const result = resolveBuildResult({ annotations: [annotation], buildResult: 'cancelled' });
assert.equal(result.code, 'execution-timeout'); assert.equal(result.limit, '5h50m0s');
assert.match(renderBuildResult(result), /5h50m0s/);
assert.equal(resolveBuildResult({ buildResult: 'cancelled' }).code, 'interrupted', 'manual cancellation is not inferred to be a timeout');
assert.equal(resolveBuildResult({ report: { timeout: true } }).code, 'execution-timeout');
assert.equal(resolveBuildResult({ buildResult: 'success', publishResult: 'failure' }).code, 'publication-failed');
assert.equal(resolveBuildResult({ buildResult: 'success', publishResult: 'success' }).code, 'success');
const report = classifyBuildEvidence({ compile: { outcome: 'failure', exitCode: '2' }, diagnostic: { outcome: 'failure', exitCode: '124' } });
assert.match(renderBuildResult(resolveBuildResult({ report })), /parallel\//);
const fixture = mkdtempSync(join(tmpdir(), 'weig-run-result-'));
try {
  const messages = [];
  const github = { paginate: async (fn) => fn(), rest: {
    actions: { listJobsForWorkflowRun: async () => [{ id: 1, name: 'Build / 构建', conclusion: 'cancelled' }] },
    checks: { listAnnotations: async () => [annotation] },
    issues: { createComment: async data => messages.push(data), update: async () => {} },
  } };
  await publishBuildResult({ github, context: { repo: { owner: 'owner', repo: 'repo' }, runId: 1, serverUrl: 'https://github.com' },
    env: { GITHUB_STEP_SUMMARY: join(fixture, 'summary.md'), ISSUE_NUMBER: '1', REQUESTER: 'user', BUILD_RESULT: 'cancelled', PUBLISH_RESULT: 'skipped', ARTIFACT_REF: 'ref' } });
  assert.match(readFileSync(join(fixture, 'summary.md'), 'utf8'), /5h50m0s/);
  assert.match(messages[0].body, /5h50m0s/, 'Run and Issue must use the same normalized result even without an artifact');
} finally { rmSync(fixture, { recursive: true, force: true }); }
console.log('Build result normalization tests passed.');
