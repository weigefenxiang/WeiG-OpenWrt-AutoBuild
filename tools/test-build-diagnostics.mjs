#!/usr/bin/env node
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
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
function toBashPath(filePath) {
  const rel = relative(ROOT, filePath);
  expect(rel && !rel.startsWith('..'), `test path must stay under repository root: ${filePath}`);
  return rel.replaceAll('\\', '/');
}
function runBash(args, options = {}) {
  return run('bash', args, { cwd: ROOT, ...options });
}
function snapshot(stage, logFile, openwrtRoot, outRoot) {
  return runBash([
    toBashPath(helper),
    'snapshot',
    stage,
    toBashPath(logFile),
    toBashPath(openwrtRoot),
    toBashPath(outRoot),
  ]);
}
function tarList(archive) {
  return runBash(['-c', 'tar -tzf "$1"', 'bash', toBashPath(archive)]).stdout;
}
function expectPackageArchive(stageDir, stage, snapshotResult) {
  const archive = join(stageDir, 'package-logs.tar.gz');
  if (existsSync(archive)) return archive;
  const evidencePath = join(stageDir, 'evidence.txt');
  const evidence = existsSync(evidencePath) ? readFileSync(evidencePath, 'utf8').trim() : '(no evidence.txt)';
  const stderr = (snapshotResult.stderr || '').trim() || '(no helper stderr)';
  fail(`${stage} package logs were not frozen; helper stderr: ${stderr}; evidence: ${evidence}`);
}

runBash(['-n', toBashPath(helper)]);

// Keep Bash-facing fixture paths relative to the repository. This avoids passing
// Windows drive-letter paths (for example D:\\...) across the Node -> Git Bash
// boundary while still exercising Unicode and spaces in path arguments.
const fixture = mkdtempSync(join(ROOT, '.tmp-build-diagnostics-路径 空格-'));
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
  const parallelSnapshot = snapshot('parallel', parallelLog, openwrt, out);

  const pDir = join(out, 'parallel');
  expect(readFileSync(join(pDir, 'build.log'), 'utf8').includes('parallel compile marker'), 'parallel build.log missing original failure');
  expect(readFileSync(join(pDir, 'errors.txt'), 'utf8').includes('parallel compile marker'), 'parallel errors.txt missing generic error');
  expect(readFileSync(join(pDir, 'last-targets.txt'), 'utf8').includes('Error 2'), 'parallel last-targets.txt missing failing make target');
  expect(readFileSync(join(pDir, 'tail.txt'), 'utf8').includes('parallel compile marker'), 'parallel tail.txt missing original tail');
  const parallelArchive = expectPackageArchive(pDir, 'parallel', parallelSnapshot);
  const parallelTar = tarList(parallelArchive);
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
  const diagnosticSnapshot = snapshot('diagnostic', diagnosticLog, openwrt, out);

  const dDir = join(out, 'diagnostic');
  expect(readFileSync(join(pDir, 'build.log'), 'utf8') === frozenParallel, 'diagnostic snapshot overwrote parallel evidence');
  expect(readFileSync(join(dDir, 'build.log'), 'utf8').includes('diagnostic_symbol'), 'diagnostic build.log missing retry failure');
  expect(readFileSync(join(dDir, 'errors.txt'), 'utf8').includes('undefined reference'), 'diagnostic errors.txt missing generic linker error');
  const diagnosticArchive = expectPackageArchive(dDir, 'diagnostic', diagnosticSnapshot);
  const diagnosticTar = tarList(diagnosticArchive);
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
