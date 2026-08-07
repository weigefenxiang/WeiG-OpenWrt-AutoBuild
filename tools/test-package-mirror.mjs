#!/usr/bin/env node
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  applyPackageMirror,
  candidateMirrorIds,
  loadPackageMirrorRules,
} from './package-mirror-engine.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RULES_PATH = join(ROOT, 'config', '001.presets', 'package-mirrors.json');
const ENGINE_PATH = join(ROOT, 'tools', 'package-mirror-engine.mjs');
const rules = loadPackageMirrorRules(RULES_PATH);
const testRoot = mkdtempSync(join(tmpdir(), 'weig-package-mirror-'));
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function write(root, relativePath, content) {
  const path = join(root, ...relativePath.split('/'));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
  return path;
}

function read(root, relativePath) {
  return readFileSync(join(root, ...relativePath.split('/')), 'utf8');
}

function fixture(name, {
  origin = 'https://downloads.openwrt.org',
  path = 'releases/24.10.5',
  config = '# CONFIG_USE_APK is not set\n',
  capability = 'FeedSourcesAppendAPK\nFeedSourcesAppendOPKG\n',
  adapters = {},
} = {}) {
  const root = join(testRoot, name);
  write(root, 'include/version.mk', `VERSION_REPO:=${origin}/${path}\n`);
  write(root, '.config', config);
  write(root, 'package/base-files/Makefile', capability);
  for (const [relativePath, content] of Object.entries(adapters)) write(root, relativePath, content);
  return root;
}

function probeFixture(results, seen = []) {
  return async (id, urls) => {
    seen.push(id);
    const ok = results[id] === true;
    return {
      ok,
      probes: urls.map((url) => ({ url, status: ok ? 200 : 503, ok, fixture: true })),
    };
  };
}

async function run(name, callback) {
  await callback();
  passed++;
  console.log(`  ✓ ${name}`);
}

try {
  await run('OpenWrt 24.10 detects OPKG and rewrites the version repository', async () => {
    const root = fixture('openwrt-opkg');
    const report = await applyPackageMirror({ root, rules, source: 'OpenWrt', branch: 'openwrt-24.10', requested: 'ustc', probeCandidate: probeFixture({ ustc: true }) });
    assert(report.effective === 'ustc', 'USTC was not selected');
    assert(report.packageManagers.join(',') === 'opkg', `manager=${report.packageManagers}`);
    assert(read(root, 'include/version.mk').includes('https://mirrors.ustc.edu.cn/openwrt/releases/24.10.5'), 'OPKG repository was not rewritten');
  });

  await run('OpenWrt 25.12 detects APK from CONFIG_USE_APK', async () => {
    const root = fixture('openwrt-apk', {
      path: 'releases/25.12-SNAPSHOT',
      config: 'CONFIG_USE_APK=y\nCONFIG_VERSION_REPO="https://downloads.openwrt.org/releases/25.12-SNAPSHOT"\n',
    });
    const report = await applyPackageMirror({ root, rules, source: 'OpenWrt', branch: 'openwrt-25.12', requested: 'ustc', probeCandidate: probeFixture({ ustc: true }) });
    assert(report.packageManagers.join(',') === 'apk', `manager=${report.packageManagers}`);
    assert(read(root, '.config').includes('https://mirrors.ustc.edu.cn/openwrt/releases/25.12-SNAPSHOT'), 'APK CONFIG_VERSION_REPO was not rewritten');
  });

  await run('ImmortalWrt OPKG and APK branches use the ImmortalWrt mirror family', async () => {
    for (const [name, branch, apk] of [['immortal-opkg', 'openwrt-24.10', false], ['immortal-apk', 'openwrt-25.12', true]]) {
      const root = fixture(name, {
        origin: 'https://downloads.immortalwrt.org',
        path: apk ? 'releases/25.12-SNAPSHOT' : 'releases/24.10-SNAPSHOT',
        config: apk ? 'CONFIG_USE_APK=y\n' : '# CONFIG_USE_APK is not set\n',
      });
      const report = await applyPackageMirror({ root, rules, source: 'ImmortalWrt', branch, requested: 'pku', probeCandidate: probeFixture({ pku: true }) });
      assert(report.family === 'immortalwrt', `family=${report.family}`);
      assert(read(root, 'include/version.mk').includes('https://mirrors.pku.edu.cn/immortalwrt/'), `${name} used wrong mirror family`);
    }
  });

  await run('LEDE master follows actual OpenWrt repository data instead of branch-name guessing', async () => {
    const root = fixture('lede-master', { path: 'releases/24.10.5' });
    const report = await applyPackageMirror({ root, rules, source: 'lede', branch: 'master', requested: 'ustc', probeCandidate: probeFixture({ ustc: true }) });
    assert(report.family === 'openwrt', `family=${report.family}`);
    assert(report.packageManagers.join(',') === 'opkg', `manager=${report.packageManagers}`);
  });

  await run('Future branch names are handled from source files and configuration', async () => {
    const root = fixture('future-apk', { path: 'snapshots/targets/future', config: 'CONFIG_USE_APK=y\n' });
    const report = await applyPackageMirror({ root, rules, source: 'OpenWrt', branch: 'future-26.x-next', requested: 'ustc', probeCandidate: probeFixture({ ustc: true }) });
    assert(report.packageManagers.join(',') === 'apk', `manager=${report.packageManagers}`);
    assert(report.branch === 'future-26.x-next', 'branch metadata was lost');
  });

  await run('Explicit APK and OPKG feed templates are reported as a hybrid adapter set', async () => {
    const root = fixture('hybrid', {
      config: '# CONFIG_VERSION_REPO is not set\n',
      adapters: {
        'package/base-files/files/etc/opkg/distfeeds.conf': 'src/gz base https://downloads.openwrt.org/releases/24.10/packages/x86_64/base\n',
        'package/base-files/files/etc/apk/repositories.d/distfeeds.list': 'https://downloads.openwrt.org/releases/25.12/packages/x86_64/base/packages.adb\n',
      },
    });
    const report = await applyPackageMirror({ root, rules, source: 'OpenWrt', branch: 'hybrid', requested: 'ustc', probeCandidate: probeFixture({ ustc: true }) });
    assert(report.packageManagers.join(',') === 'apk,opkg', `manager=${report.packageManagers}`);
    assert(report.adapters.includes('apk-distfeeds') && report.adapters.includes('opkg-distfeeds'), `adapters=${report.adapters}`);
  });

  await run('Automatic selection falls back USTC → PKU → source default without blocking', async () => {
    const root = fixture('auto-pku');
    const seen = [];
    const report = await applyPackageMirror({ root, rules, source: 'OpenWrt', branch: 'openwrt-24.10', requested: 'auto', probeCandidate: probeFixture({ ustc: false, pku: true }, seen) });
    assert(report.effective === 'pku' && report.fallback, JSON.stringify(report));
    assert(seen.join(',') === 'ustc,pku', `attempts=${seen}`);
    assert(read(root, 'include/version.mk').includes('mirrors.pku.edu.cn/openwrt'), 'PKU fallback was not committed');

    const root2 = fixture('auto-default');
    const original = read(root2, 'include/version.mk');
    const report2 = await applyPackageMirror({ root: root2, rules, source: 'OpenWrt', branch: 'openwrt-24.10', requested: 'auto', probeCandidate: probeFixture({ ustc: false, pku: false }) });
    assert(report2.effective === 'source-default' && report2.status === 'fallback-source-default', JSON.stringify(report2));
    assert(read(root2, 'include/version.mk') === original, 'failed probes changed the upstream repository');
  });

  await run('Manual mirror failure returns directly to source default', async () => {
    const root = fixture('manual-default');
    const seen = [];
    const report = await applyPackageMirror({ root, rules, source: 'OpenWrt', branch: 'openwrt-24.10', requested: 'ustc', probeCandidate: probeFixture({ ustc: false, pku: true }, seen) });
    assert(report.effective === 'source-default' && report.fallback, JSON.stringify(report));
    assert(seen.join(',') === 'ustc', `manual request unexpectedly tried ${seen}`);
  });

  await run('Source-default restores known mirrors, while custom repositories are preserved', async () => {
    const root = fixture('restore-default', { origin: 'https://mirrors.ustc.edu.cn/openwrt' });
    const report = await applyPackageMirror({ root, rules, source: 'OpenWrt', branch: 'openwrt-24.10', requested: 'source-default' });
    assert(report.effective === 'source-default', JSON.stringify(report));
    assert(read(root, 'include/version.mk').includes('https://downloads.openwrt.org/'), 'source default was not restored');

    const custom = fixture('custom-repo', {
      config: '# CONFIG_USE_APK is not set\nCONFIG_VERSION_REPO="https://packages.example.test/openwrt/custom"\n',
    });
    const before = read(custom, 'include/version.mk');
    const customReport = await applyPackageMirror({ root: custom, rules, source: 'OpenWrt', branch: 'custom', requested: 'ustc', probeCandidate: probeFixture({ ustc: true }) });
    assert(customReport.effective === 'custom' && customReport.status === 'custom-source-preserved', JSON.stringify(customReport));
    assert(read(custom, '.config').includes('packages.example.test'), 'custom CONFIG_VERSION_REPO was changed');
    assert(read(custom, 'include/version.mk') === before, 'custom repository mode changed another adapter');
  });

  await run('Missing adapter files keep the source default and still return a report', async () => {
    const root = join(testRoot, 'no-adapters');
    mkdirSync(root, { recursive: true });
    const report = await applyPackageMirror({ root, rules, source: 'OpenWrt', branch: 'unknown', requested: 'auto', probeCandidate: probeFixture({ ustc: false, pku: false }) });
    assert(report.effective === 'source-default' && report.changedFiles.length === 0, JSON.stringify(report));
  });

  await run('Candidate policy is canonical and CLI report generation is stable', async () => {
    assert(candidateMirrorIds(rules, 'auto', 'openwrt').join(',') === 'ustc,pku,source-default', 'auto policy changed');
    assert(candidateMirrorIds(rules, 'ustc', 'openwrt').join(',') === 'ustc,source-default', 'manual policy changed');
    const root = fixture('cli-fixture', { path: 'releases/25.12-SNAPSHOT', config: 'CONFIG_USE_APK=y\n' });
    const probePath = write(root, 'probe-results.json', JSON.stringify({ ustc: true }));
    const reportPath = join(root, 'package-mirror-report.json');
    const result = spawnSync(process.execPath, [ENGINE_PATH,
      '--root', root, '--rules', RULES_PATH, '--source', 'OpenWrt', '--branch', 'openwrt-25.12',
      '--requested', 'ustc', '--report', reportPath, '--probe-results', probePath,
    ], { encoding: 'utf8' });
    assert(result.status === 0, result.stderr || result.stdout);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    assert(report.effective === 'ustc' && report.packageManagers.join(',') === 'apk', JSON.stringify(report));
  });

  console.log(`package mirror matrix: ${passed} scenarios passed`);
} catch (error) {
  console.error(`package mirror matrix failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(testRoot, { recursive: true, force: true });
}
