#!/usr/bin/env node
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const helper = join(ROOT, 'Shell', 'collect-build-evidence.sh');
const workflowPath = join(ROOT, '.github', 'workflows', 'custom-build.yml');
const workflow = readFileSync(workflowPath, 'utf8');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}
function expect(value, message) {
  if (!value) fail(message);
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    fail(`${command} ${args.join(' ')} exited ${result.status}: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return result;
}

run('bash', ['-n', helper]);

const fixture = mkdtempSync(join(tmpdir(), 'weig-build-diagnostics-'));
try {
  const openwrt = join(fixture, 'openwrt');
  const out = join(fixture, 'failure-logs');
  mkdirSync(join(openwrt, 'logs'), { recursive: true });
  writeFileSync(join(openwrt, 'logs', 'parallel-package.log'), 'PARALLEL_PACKAGE_MARKER\n');
  const parallelLog = join(fixture, 'parallel.log');
  writeFileSync(parallelLog, [
    'make[2]: Entering directory /work',
    'foo.c:20: error: parallel compile marker',
    "make[3]: *** [Makefile:20: package/foo/compile] Error 2",
    'ERROR: package/example failed to build.',
    '',
  ].join('\n'));
  run('bash', [helper, 'snapshot', 'parallel', parallelLog, openwrt, out]);

  const pDir = join(out, 'parallel');
  expect(readFileSync(join(pDir, 'build.log'), 'utf8').includes('parallel compile marker'), 'parallel build.log missing original failure');
  expect(readFileSync(join(pDir, 'errors.txt'), 'utf8').includes('parallel compile marker'), 'parallel errors.txt missing generic error');
  expect(readFileSync(join(pDir, 'last-targets.txt'), 'utf8').includes('Error 2'), 'parallel last-targets.txt missing failing make target');
  expect(readFileSync(join(pDir, 'tail.txt'), 'utf8').includes('parallel compile marker'), 'parallel tail.txt missing original tail');
  expect(existsSync(join(pDir, 'package-logs.tar.gz')), 'parallel package logs were not frozen');
  const parallelTar = run('tar', ['-tzf', join(pDir, 'package-logs.tar.gz')]).stdout;
  expect(parallelTar.includes('parallel-package.log'), 'parallel package-log archive missing marker file');
  const frozenParallel = readFileSync(join(pDir, 'build.log'), 'utf8');

  rmSync(join(openwrt, 'logs'), { recursive: true, force: true });
  mkdirSync(join(openwrt, 'logs'), { recursive: true });
  writeFileSync(join(openwrt, 'logs', 'diagnostic-package.log'), 'DIAGNOSTIC_PACKAGE_MARKER\n');
  const diagnosticLog = join(fixture, 'diagnostic.log');
  writeFileSync(diagnosticLog, [
    'single-thread retry',
    'ld: undefined reference to diagnostic_symbol',
    "make[4]: *** [Makefile:30: package/bar/compile] Error 1",
    '',
  ].join('\n'));
  run('bash', [helper, 'snapshot', 'diagnostic', diagnosticLog, openwrt, out]);

  const dDir = join(out, 'diagnostic');
  expect(readFileSync(join(pDir, 'build.log'), 'utf8') === frozenParallel, 'diagnostic snapshot overwrote parallel evidence');
  expect(readFileSync(join(dDir, 'build.log'), 'utf8').includes('diagnostic_symbol'), 'diagnostic build.log missing retry failure');
  expect(readFileSync(join(dDir, 'errors.txt'), 'utf8').includes('undefined reference'), 'diagnostic errors.txt missing generic linker error');
  expect(existsSync(join(dDir, 'package-logs.tar.gz')), 'diagnostic package logs were not frozen');
  const diagnosticTar = run('tar', ['-tzf', join(dDir, 'package-logs.tar.gz')]).stdout;
  expect(diagnosticTar.includes('diagnostic-package.log'), 'diagnostic archive missing diagnostic marker');
  expect(!diagnosticTar.includes('parallel-package.log'), 'diagnostic archive leaked the frozen parallel package logs');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

const parallelSnapshotAt = workflow.indexOf('Snapshot parallel failure / 冻结并行失败现场');
const diagnoseAt = workflow.indexOf('Diagnose failed compile / 单线程定位失败原因');
expect(workflow.includes('make -j"$JOBS" BUILD_LOG=1'), 'parallel compile must enable BUILD_LOG=1');
expect(parallelSnapshotAt >= 0 && diagnoseAt > parallelSnapshotAt, 'parallel snapshot must happen before diagnostic retry');
expect(workflow.slice(parallelSnapshotAt, diagnoseAt).includes('rm -rf "$GITHUB_WORKSPACE/openwrt/logs"'), 'OpenWrt log directory must reset only after parallel evidence is frozen');
expect(workflow.includes('timeout-minutes: 185'), 'diagnostic workflow step must allow 185 minutes');
expect(workflow.includes('timeout 180m stdbuf -oL -eL make -j1 V=s BUILD_LOG=1'), 'diagnostic shell timeout must be 180 minutes');
expect(workflow.includes("if: failure() || steps.compile.outcome == 'failure'"), 'BUILD-LOGS must be collected even when single-thread retry recovers');
expect(workflow.includes('FINAL_RESULT="RECOVERED"'), 'summary must distinguish recovered builds');
expect(workflow.includes('DIAGNOSTIC_RESULT="TIMEOUT"'), 'summary must distinguish diagnostic timeout');
expect(workflow.includes('request branch') && workflow.includes('workflow branch'), 'summary/metadata must expose request and workflow identities');
expect(workflow.includes('parallel/') && workflow.includes('diagnostic/'), 'summary must point to separated stage directories');
expect(!workflow.includes('tar czf "$LOGS/package-logs.tar.gz" -C openwrt logs'), 'artifact classifier must not overwrite stage-specific package-log archives');
expect(!/oscam|elfutils|package\/gcc|x86_64/i.test(readFileSync(helper, 'utf8')), 'diagnostic helper must not contain package/source/device special cases');

console.log('Build diagnostics tests passed.');
