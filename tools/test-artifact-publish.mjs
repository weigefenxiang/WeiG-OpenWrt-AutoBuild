#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  isStandaloneArtifact,
  normalizeStandaloneSuffixes,
  readArtifactPublishPolicy,
  stageArtifacts,
} from './artifact-publish.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const realPolicy = readArtifactPublishPolicy(join(ROOT, '.github', 'automation-policy.json'));
assert(realPolicy.standaloneSuffixes.includes('.img.gz'));
assert(realPolicy.standaloneSuffixes.includes('.itb'));

const policy = { standaloneSuffixes: ['.img.gz', '.itb'] };
assert.equal(isStandaloneArtifact('router.img.gz', policy.standaloneSuffixes), true);
assert.equal(isStandaloneArtifact('recovery.itb', policy.standaloneSuffixes), true);
assert.equal(isStandaloneArtifact('router.buildinfo', policy.standaloneSuffixes), false);
assert.throws(() => normalizeStandaloneSuffixes(['.itb', '.itb']), /duplicate/);
assert.throws(() => normalizeStandaloneSuffixes(['itb']), /invalid/);

const temp = mkdtempSync(join(tmpdir(), 'weig-artifact-publish-'));
try {
  const source = join(temp, 'targets');
  const targetA = join(source, 'mediatek', 'filogic');
  const targetB = join(source, 'x86', '64');
  mkdirSync(targetA, { recursive: true });
  mkdirSync(targetB, { recursive: true });
  writeFileSync(join(targetA, 'router-squashfs-sysupgrade.itb'), 'itb');
  writeFileSync(join(targetA, 'router-initramfs-recovery.itb'), 'recovery');
  writeFileSync(join(targetB, 'router-combined.img.gz'), 'image');
  writeFileSync(join(targetB, 'router.buildinfo'), 'buildinfo');
  writeFileSync(join(targetB, 'sha256sums'), 'checksums');
  mkdirSync(join(targetB, 'packages'), { recursive: true });
  writeFileSync(join(targetB, 'packages', 'ignored.ipk'), 'package');

  const staging = join(temp, 'staging-default');
  const plan = stageArtifacts({ sourceDir: source, stagingDir: staging, artifactRef: 'dev-build#1', policy });
  assert.deepEqual(plan.standalone.map((row) => row.name), [
    'dev-build#1-router-combined.img.gz',
    'dev-build#1-router-initramfs-recovery.itb',
    'dev-build#1-router-squashfs-sysupgrade.itb',
  ]);
  assert.deepEqual(plan.other.map((row) => row.name), [
    'dev-build#1-router.buildinfo',
    'dev-build#1-sha256sums',
  ]);
  assert(!plan.other.some((row) => row.name.endsWith('.ipk')),
    'nested target package directories must remain outside firmware artifact publication');
  assert.equal(plan.hasStandalone, true);
  assert.equal(plan.matrix.length, 3);
  assert(existsSync(join(staging, 'STANDALONE', 'dev-build#1-router-squashfs-sysupgrade.itb')));
  assert(existsSync(join(staging, 'FIRMWARE-OTHER', 'dev-build#1-router.buildinfo')));

  const expanded = stageArtifacts({
    sourceDir: source,
    stagingDir: join(temp, 'staging-expanded'),
    artifactRef: 'dev-build#2',
    policy: { standaloneSuffixes: [...policy.standaloneSuffixes, '.buildinfo'] },
  });
  assert(expanded.standalone.some((row) => row.name.endsWith('.buildinfo')),
    'adding one suffix to policy must require no classifier code change');

  const duplicateSource = join(temp, 'duplicates');
  mkdirSync(join(duplicateSource, 'target-a', 'subtarget-a'), { recursive: true });
  mkdirSync(join(duplicateSource, 'target-b', 'subtarget-b'), { recursive: true });
  writeFileSync(join(duplicateSource, 'target-a', 'subtarget-a', 'same.itb'), 'a');
  writeFileSync(join(duplicateSource, 'target-b', 'subtarget-b', 'same.itb'), 'b');
  assert.throws(() => stageArtifacts({
    sourceDir: duplicateSource,
    stagingDir: join(temp, 'staging-duplicate'),
    artifactRef: 'dev-build#3',
    policy,
  }), /duplicate artifact output name/);

  const noneSource = join(temp, 'none');
  const noneTarget = join(noneSource, 'target', 'subtarget');
  mkdirSync(noneTarget, { recursive: true });
  writeFileSync(join(noneTarget, 'manifest'), 'manifest');
  const none = stageArtifacts({
    sourceDir: noneSource,
    stagingDir: join(temp, 'staging-none'),
    artifactRef: 'build',
    policy,
  });
  assert.equal(none.hasStandalone, false);
  assert.deepEqual(none.matrix, [{ name: '__none__', enabled: false }]);
  assert.deepEqual(none.other.map((row) => row.name), ['build-manifest']);

  const rawPolicy = JSON.parse(readFileSync(join(ROOT, '.github', 'automation-policy.json'), 'utf8'));
  assert.equal(rawPolicy.buildArtifacts.internalRawBridgeDays, 1);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log('Artifact publishing policy tests passed / Artifact 发布策略测试通过');
