#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseOverrideDocument, verifyEffectiveConfig } from './verify-effective-config.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workflow = readFileSync(join(root, '.github', 'workflows', 'custom-build.yml'), 'utf8');

const requested = {
  schema: 1,
  overrides: [
    ['PACKAGE_example', 'y'],
    ['PACKAGE_module', 'm'],
    ['FEATURE_DISABLED', 'n'],
    ['TARGET_ROOTFS_PARTSIZE', '512'],
    ['BUILD_SUFFIX', '"custom"'],
  ],
};

const pass = verifyEffectiveConfig({
  overrides: requested,
  configText: [
    'CONFIG_PACKAGE_example=y',
    'CONFIG_PACKAGE_module=m',
    '# CONFIG_FEATURE_DISABLED is not set',
    'CONFIG_TARGET_ROOTFS_PARTSIZE=512',
    'CONFIG_BUILD_SUFFIX="custom"',
    'CONFIG_UNTOUCHED_CHANGED=y',
    '',
  ].join('\n'),
});
assert.equal(pass.result, 'pass');
assert.equal(pass.checked, 5);
assert.equal(pass.mismatchCount, 0);

const mismatch = verifyEffectiveConfig({
  overrides: requested,
  configText: [
    '# CONFIG_PACKAGE_example is not set',
    'CONFIG_PACKAGE_module=y',
    'CONFIG_TARGET_ROOTFS_PARTSIZE=256',
    'CONFIG_BUILD_SUFFIX="other"',
    '',
  ].join('\n'),
});
assert.equal(mismatch.result, 'failure');
assert.equal(mismatch.code, 'configuration-override-mismatch');
assert.deepEqual(mismatch.mismatches.map(({ symbol }) => symbol), [
  'PACKAGE_example', 'PACKAGE_module', 'TARGET_ROOTFS_PARTSIZE', 'BUILD_SUFFIX',
]);
assert(!mismatch.mismatches.some(({ symbol }) => symbol === 'FEATURE_DISABLED'),
  'a missing symbol has Kconfig n semantics');

assert.throws(() => parseOverrideDocument({ schema: 1, overrides: [], plugins: ['x'] }), /unknown/);
assert.throws(() => parseOverrideDocument({ schema: 1, overrides: [['A', 'y'], ['A', 'n']] }), /duplicate/);
assert.throws(() => parseOverrideDocument({ schema: 2, overrides: [] }), /schema/);

const verificationAt = workflow.indexOf('Verify explicit configuration overrides / 核验显式配置覆盖');
const mirrorAt = workflow.indexOf('Apply package mirror / 应用软件包镜像');
const downloadAt = workflow.indexOf('Download packages / 下载依赖包');
assert(verificationAt >= 0 && mirrorAt > verificationAt && downloadAt > verificationAt,
  'explicit overrides must be verified before package setup, download, and compilation');
assert.match(workflow, /--overrides request-overrides\.json[\s\S]*--config openwrt\/\.config[\s\S]*--out config-verification\.json/);
assert.match(workflow, /request-overrides\.json\s+config-verification\.json/,
  'CONFIG artifact must retain the verification report');
assert.match(workflow, /request-overrides\.json config-verification\.json request-audit\.json/,
  'failure logs must retain the verification report');
assert.doesNotMatch(workflow.slice(verificationAt, mirrorAt), /plugins|diff -u/,
  'the fidelity gate must not inspect plugins or compare the whole config');

const temp = mkdtempSync(join(tmpdir(), 'weig-effective-config-'));
try {
  const overridesPath = join(temp, 'request-overrides.json');
  const configPath = join(temp, '.config');
  const reportPath = join(temp, 'config-verification.json');
  writeFileSync(overridesPath, `${JSON.stringify(requested)}\n`, 'utf8');
  writeFileSync(configPath, '# CONFIG_PACKAGE_example is not set\n', 'utf8');
  const result = spawnSync(process.execPath, [
    join(root, 'tools', 'verify-effective-config.mjs'),
    '--overrides', overridesPath,
    '--config', configPath,
    '--out', reportPath,
    '--stage', 'post-defconfig',
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 1);
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  assert.equal(report.code, 'configuration-override-mismatch');
  assert.equal(report.stage, 'post-defconfig');
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log('effective configuration verification tests passed');
