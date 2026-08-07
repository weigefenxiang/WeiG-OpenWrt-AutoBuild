#!/usr/bin/env node
// 一键体检:语法检查所有脚本 + 校验所有数据 JSON + 前端三件套基本一致性
// One-click health check: syntax-check every script, validate every data JSON, basic frontend consistency.
// 用法 / Usage: node tools/check-all.mjs   (或双击 Check_检查.bat / or double-click the bat)

import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { directoriesMatch, syncBlogMirror } from './sync-blog.mjs';
import { checkTextFiles } from './check-text-format.mjs';
import {
  FORBIDDEN_SITE_ARCHIVE_ENTRIES,
  REQUIRED_SITE_ARCHIVE_ENTRIES,
  verifySiteArchive,
} from './verify-site-archive.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let fail = 0;
const ok = (name) => console.log('  ✓ ' + name);
const bad = (name, msg) => { console.log('  ✗ ' + name + ' — ' + msg); fail++; };
const walkFiles = (dir, suffix, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, suffix, out);
    else if (entry.isFile() && entry.name.endsWith(suffix)) out.push(path);
  }
  return out;
};
const PROXY_PACKAGE_RE = /^CONFIG_PACKAGE_.*(?:passwall|ssr|vssr|tinyproxy|shadowsocks|v2ray|xray|trojan|brook|gost|haproxy|pdnsd-alt|kcptun|simple-obfs|chinadns|dns2socks|dns2tcp|ipt2socks|microsocks|naiveproxy|redsocks|openclash|homeproxy|sing-box|tuic|hysteria|polipo|squid|ssocks|speederv2|udp2raw|tor).*=[ym]$/i;
function formatSizeContract(mb) {
  const value = Math.max(0, Number(mb) || 0);
  const format = (number, unit) => {
    if (!number) return `0 ${unit}`;
    const exponent = Math.floor(Math.log10(Math.abs(number)));
    const decimals = exponent >= 0 ? Math.max(0, 2 - exponent) : Math.min(3, 2 - exponent);
    return `${number.toFixed(decimals)} ${unit}`;
  };
  if (value >= 1000) return format(value / 1024, 'GB');
  if (value >= 1) return format(value, 'MB');
  const kb = value * 1024;
  if (kb >= 1) return format(kb, 'KB');
  return format(kb * 1024, 'B');
}

console.log('[1/3] JS 语法检查 / syntax check (node --check)');
const scripts = [join(ROOT, 'site', 'wrt', 'app.js'),
  ...walkFiles(join(ROOT, 'site', 'wrt', 'lib'), '.js'),
  ...walkFiles(join(ROOT, 'site', 'wrt', 'lib'), '.mjs'),
  ...readdirSync(join(ROOT, 'tools')).filter((f) => f.endsWith('.mjs')).map((f) => join(ROOT, 'tools', f))];
for (const f of scripts) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  r.status === 0 ? ok(f.replace(ROOT, '.')) : bad(f.replace(ROOT, '.'), (r.stderr || '').split('\n')[0]);
}

const textFormatCheck = spawnSync(process.execPath, [
  join(ROOT, 'tools', 'check-text-format.mjs'), ROOT, '--changed',
], { encoding: 'utf8' });
textFormatCheck.status === 0
  ? ok('text format preflight: changed files follow LF/CRLF, UTF-8 no-BOM and single-EOF-newline policy')
  : bad('text format preflight',
    (textFormatCheck.stderr || textFormatCheck.stdout || '').trim().slice(0, 500));

const textFormatFixtureRoot = mkdtempSync(join(tmpdir(), 'weig-text-format-'));
try {
  const fixtureFiles = {
    'good.mjs': 'export const good = true;\n',
    'good.txt': 'plain text\n',
    'good.bat': '@echo off\r\nexit /b 0\r\n',
    'bad-crlf.mjs': 'export const bad = true;\r\n',
    'bad-lf.bat': '@echo off\n',
    'bad-no-eof.json': '{}',
    'bad-eof.conf': 'VALUE=1\n\n',
    'bad-eof.json': '{}\n\n',
    'bad-eof-spaces.json': '{}\n \n',
    'bad-eof-crlf.bat': '@echo off\r\n\r\n',
  };
  for (const [name, content] of Object.entries(fixtureFiles)) {
    writeFileSync(join(textFormatFixtureRoot, name), content);
  }
  writeFileSync(join(textFormatFixtureRoot, 'bad-bom.md'),
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('# title\n')]));
  const fixtureFailures = checkTextFiles(textFormatFixtureRoot, Object.keys({
    ...fixtureFiles,
    'bad-bom.md': '',
  }));
  const byPath = new Map(fixtureFailures.map((item) => [item.path, item.issues.join(' | ')]));
  const fixtureOk = !byPath.has('good.mjs') && !byPath.has('good.txt') && !byPath.has('good.bat') &&
    byPath.get('bad-crlf.mjs')?.includes('expected LF') &&
    byPath.get('bad-lf.bat')?.includes('expected CRLF') &&
    byPath.get('bad-no-eof.json')?.includes('exactly one newline') &&
    byPath.get('bad-eof.conf')?.includes('blank line at EOF') &&
    byPath.get('bad-eof.json')?.includes('blank line at EOF') &&
    byPath.get('bad-eof-spaces.json')?.includes('blank line at EOF') &&
    byPath.get('bad-eof-crlf.bat')?.includes('blank line at EOF') &&
    byPath.get('bad-bom.md')?.includes('BOM');
  fixtureOk
    ? ok('text format fixtures: LF, CRLF, BOM, missing EOF and blank-EOF failures are classified generically')
    : bad('text format fixtures', JSON.stringify(Object.fromEntries(byPath)).slice(0, 500));
} catch (error) {
  bad('text format fixtures', error.message.slice(0, 300));
} finally {
  rmSync(textFormatFixtureRoot, { recursive: true, force: true });
}

const siteArchiveTestRoot = mkdtempSync(join(tmpdir(), '威格 archive verifier with spaces-'));
try {
  const completeSite = join(siteArchiveTestRoot, '完整 网站 source');
  const missingSite = join(siteArchiveTestRoot, '缺少 index source');
  const legacySite = join(siteArchiveTestRoot, '旧模块 source');
  const validArchive = join(siteArchiveTestRoot, '完整 网站 部署包.tar.gz');
  const missingArchive = join(siteArchiveTestRoot, '缺少 文件 部署包.tar.gz');
  const legacyArchive = join(siteArchiveTestRoot, '旧 mjs 部署包.tar.gz');
  const writeEntry = (root, relativePath, content = `fixture:${relativePath}\n`) => {
    const target = join(root, ...relativePath.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  };
  for (const entry of REQUIRED_SITE_ARCHIVE_ENTRIES) writeEntry(completeSite, entry);
  for (const entry of REQUIRED_SITE_ARCHIVE_ENTRIES.filter((entry) => entry !== 'index.html')) {
    writeEntry(missingSite, entry);
  }
  for (const entry of REQUIRED_SITE_ARCHIVE_ENTRIES) writeEntry(legacySite, entry);
  writeEntry(legacySite, FORBIDDEN_SITE_ARCHIVE_ENTRIES[0], 'legacy\n');
  const makeArchive = (source, archive) => spawnSync('tar', ['-czf', archive, '-C', source, '.'], {
    encoding: 'utf8',
    shell: false,
  });
  const archiveBuilds = [
    makeArchive(completeSite, validArchive),
    makeArchive(missingSite, missingArchive),
    makeArchive(legacySite, legacyArchive),
  ];
  const validReport = verifySiteArchive(validArchive);
  const missingReport = verifySiteArchive(missingArchive);
  const legacyReport = verifySiteArchive(legacyArchive);
  const missingTarReport = verifySiteArchive(validArchive, {
    tarCommand: 'weig-tar-command-that-does-not-exist',
  });
  const archiveCli = spawnSync(process.execPath, [
    join(ROOT, 'tools', 'verify-site-archive.mjs'), validArchive,
  ], { encoding: 'utf8' });
  const archiveFixtureOk = archiveBuilds.every((result) => result.status === 0) &&
    validReport.ok && validReport.entries.has('index.html') &&
    !missingReport.ok && missingReport.category === 'missing' &&
    missingReport.missing.includes('index.html') &&
    !legacyReport.ok && legacyReport.category === 'forbidden' &&
    legacyReport.forbidden.includes(FORBIDDEN_SITE_ARCHIVE_ENTRIES[0]) &&
    !missingTarReport.ok && missingTarReport.category === 'tool' &&
    missingTarReport.error.includes('ENOENT') &&
    archiveCli.status === 0 && archiveCli.stdout.includes('Required files confirmed');
  archiveFixtureOk
    ? ok('site archive verifier: Unicode/space paths, required files, legacy rejection and missing tar are classified without shell pipes')
    : bad('site archive verifier fixtures', JSON.stringify({
      archiveBuilds: archiveBuilds.map((result) => result.status),
      valid: validReport.ok,
      missing: missingReport.missing,
      forbidden: legacyReport.forbidden,
      missingTar: missingTarReport.error,
      cliStatus: archiveCli.status,
    }).slice(0, 600));
} catch (error) {
  bad('site archive verifier fixtures', error.message.slice(0, 400));
} finally {
  rmSync(siteArchiveTestRoot, { recursive: true, force: true });
}

const catalogLoaderTest = spawnSync(process.execPath, [join(ROOT, 'tools', 'test-catalog-loader.mjs')], {
  encoding: 'utf8',
});
catalogLoaderTest.status === 0
  ? ok('Catalog loader: Raw index priority, immutable CDN/Raw/Release fallback, cache, SHA-256, schema diagnostics')
  : bad('Catalog loader tests', (catalogLoaderTest.stderr || catalogLoaderTest.stdout || '').trim().slice(0, 240));

const catalogEngineMatrixTest = spawnSync(process.execPath, [join(ROOT, 'tools', 'test-catalog-engine.mjs')], {
  encoding: 'utf8',
});
catalogEngineMatrixTest.status === 0
  ? ok('Catalog engine matrix: submitted-config validation, dependency closure, reverse disable and orphan pruning')
  : bad('Catalog engine matrix tests',
    (catalogEngineMatrixTest.stderr || catalogEngineMatrixTest.stdout || '').trim().slice(0, 320));

const packageMirrorProjectionTest = spawnSync(process.execPath, [
  join(ROOT, 'tools', 'gen-package-mirrors.mjs'), '--check',
], { encoding: 'utf8' });
packageMirrorProjectionTest.status === 0
  ? ok('Package mirror projection: canonical JSON and public browser data are synchronized')
  : bad('Package mirror projection',
    (packageMirrorProjectionTest.stderr || packageMirrorProjectionTest.stdout || '').trim().slice(0, 320));

const packageMirrorMatrixTest = spawnSync(process.execPath, [join(ROOT, 'tools', 'test-package-mirror.mjs')], {
  encoding: 'utf8',
});
packageMirrorMatrixTest.status === 0
  ? ok('Package mirror matrix: APK, OPKG, source families, future branches, hybrid adapters and fallback')
  : bad('Package mirror matrix',
    (packageMirrorMatrixTest.stderr || packageMirrorMatrixTest.stdout || '').trim().slice(0, 500));

const catalogPerformanceTest = spawnSync(process.execPath, [join(ROOT, 'tools', 'test-catalog-performance.mjs')], {
  encoding: 'utf8',
});
catalogPerformanceTest.status === 0
  ? ok(`Catalog performance: compact 12k-record graph and worker search ${catalogPerformanceTest.stdout.trim()}`)
  : bad('Catalog performance tests',
    (catalogPerformanceTest.stderr || catalogPerformanceTest.stdout || '').trim().slice(0, 400));

const blogMirrorTestRoot = mkdtempSync(join(tmpdir(), '威格 blog mirror with spaces-'));
try {
  const sourceDir = join(blogMirrorTestRoot, '主仓库 with spaces', 'site', 'wrt');
  const blogRepo = join(blogMirrorTestRoot, '博客仓库 with spaces');
  const blogDestination = join(blogRepo, 'source', 'wrt');
  const unicodeNested = join(sourceDir, 'nested', '中文 空格');
  mkdirSync(join(sourceDir, 'data'), { recursive: true });
  mkdirSync(join(unicodeNested, 'empty'), { recursive: true });
  writeFileSync(join(sourceDir, 'index.html'), '<!doctype html>');
  writeFileSync(join(sourceDir, 'app.js'), 'console.log("source");\n');
  writeFileSync(join(sourceDir, 'data', 'site-version.json'), '{"version":"test"}\n');
  writeFileSync(join(unicodeNested, 'base.config'), 'CONFIG_TEST=y\n');
  writeFileSync(join(unicodeNested, 'asset.txt'), 'asset\n');
  writeFileSync(join(unicodeNested, 'large-binary.bin'), Buffer.alloc(3 * 1024 * 1024 + 123, 0xa5));
  mkdirSync(join(blogRepo, '.git'), { recursive: true });
  mkdirSync(join(blogDestination, 'old'), { recursive: true });
  writeFileSync(join(blogRepo, '_config.yml'), 'skip_render:\n  - wrt/**\n');
  writeFileSync(join(blogDestination, 'old', 'zombie.txt'), 'stale\n');
  writeFileSync(join(blogDestination, 'app.js'), 'old\n');

  const progress = [];
  const before = syncBlogMirror({ sourceDir, blogRepo, checkOnly: true });
  const first = syncBlogMirror({
    sourceDir,
    blogRepo,
    hooks: { onProgress: (event) => progress.push(event) },
  });
  const after = syncBlogMirror({ sourceDir, blogRepo, checkOnly: true });
  const exactAfterFirst = !before.current && first.current && after.current &&
    directoriesMatch(sourceDir, blogDestination) &&
    readFileSync(join(blogDestination, 'nested', '中文 空格', 'base.config'), 'utf8') === 'CONFIG_TEST=y\n' &&
    existsSync(join(blogDestination, 'nested', '中文 空格', 'empty')) &&
    readFileSync(join(blogDestination, 'nested', '中文 空格', 'large-binary.bin')).length ===
      3 * 1024 * 1024 + 123 &&
    !existsSync(join(blogDestination, 'old', 'zombie.txt')) &&
    !existsSync(join(blogRepo, 'source', 'wrt.sync-tmp')) &&
    !existsSync(join(blogRepo, 'source', 'wrt.sync-prev')) &&
    progress[0]?.copied === 0 && progress.at(-1)?.copied === progress.at(-1)?.total;

  writeFileSync(join(blogDestination, 'app.js'), 'changed\n');
  const changedDetected = !syncBlogMirror({ sourceDir, blogRepo, checkOnly: true }).current;
  syncBlogMirror({ sourceDir, blogRepo });
  const destinationBeforeFailures = readFileSync(join(blogDestination, 'app.js'));

  let iterativeCopyFailureRejected = false;
  try {
    syncBlogMirror({
      sourceDir,
      blogRepo,
      hooks: {
        beforeCopyFile: ({ index }) => {
          if (index === 2) throw new Error('simulated iterative copy failure');
        },
      },
    });
  } catch {
    iterativeCopyFailureRejected = true;
  }
  const iterativeCopyFailurePreserved = iterativeCopyFailureRejected &&
    destinationBeforeFailures.equals(readFileSync(join(blogDestination, 'app.js'))) &&
    directoriesMatch(sourceDir, blogDestination) &&
    !existsSync(join(blogRepo, 'source', 'wrt.sync-tmp')) &&
    !existsSync(join(blogRepo, 'source', 'wrt.sync-prev'));

  let temporaryVerificationRejected = false;
  try {
    syncBlogMirror({
      sourceDir,
      blogRepo,
      hooks: {
        afterCopy: ({ temporary }) => writeFileSync(join(temporary, 'app.js'), 'corrupt temporary copy\n'),
      },
    });
  } catch {
    temporaryVerificationRejected = true;
  }
  const oldDestinationPreserved = temporaryVerificationRejected &&
    destinationBeforeFailures.equals(readFileSync(join(blogDestination, 'app.js'))) &&
    directoriesMatch(sourceDir, blogDestination) &&
    !existsSync(join(blogRepo, 'source', 'wrt.sync-tmp')) &&
    !existsSync(join(blogRepo, 'source', 'wrt.sync-prev'));

  let activationVerificationRejected = false;
  try {
    syncBlogMirror({
      sourceDir,
      blogRepo,
      hooks: {
        afterActivate: ({ destination }) => writeFileSync(join(destination, 'app.js'), 'corrupt activated copy\n'),
      },
    });
  } catch {
    activationVerificationRejected = true;
  }
  const activationRollbackRestoredOld = activationVerificationRejected &&
    destinationBeforeFailures.equals(readFileSync(join(blogDestination, 'app.js'))) &&
    directoriesMatch(sourceDir, blogDestination) &&
    !existsSync(join(blogRepo, 'source', 'wrt.sync-tmp')) &&
    !existsSync(join(blogRepo, 'source', 'wrt.sync-prev'));

  rmSync(join(sourceDir, 'app.js'));
  let incompleteSourceRejected = false;
  try {
    syncBlogMirror({ sourceDir, blogRepo });
  } catch {
    incompleteSourceRejected = true;
  }
  const incompleteSourcePreservedDestination = incompleteSourceRejected &&
    destinationBeforeFailures.equals(readFileSync(join(blogDestination, 'app.js')));

  exactAfterFirst && changedDetected && iterativeCopyFailurePreserved && oldDestinationPreserved &&
    activationRollbackRestoredOld && incompleteSourcePreservedDestination
    ? ok('blog mirror: Unicode/space paths, iterative copy, chunked hash, binary/.config/empty dirs, rollback')
    : bad('blog mirror runtime tests', 'Unicode-safe copy, exact mirror, progress, rollback or source safety failed');
} catch (error) {
  bad('blog mirror runtime tests', error.message.slice(0, 300));
} finally {
  rmSync(blogMirrorTestRoot, { recursive: true, force: true });
}

console.log('[2/3] 数据 JSON 校验 / data JSON validation');
for (const f of ['site/wrt/data/devices.json', 'site/wrt/data/i18n.json', 'site/wrt/data/360t7/plugins.json',
  'site/wrt/data/seed/plugins.json', 'site/wrt/data/config-manifest.json',
  'site/wrt/data/timezones.json', 'site/wrt/data/plugins-i18n.json',
  'site/wrt/data/menuconfig-index.json', 'site/wrt/data/menuconfig-demo.json',
  'site/wrt/data/project.json', 'site/wrt/data/minimum-boot.json',
  'site/wrt/data/package-mirrors.json', 'site/wrt/data/source-build-requirements.json',
  'config/001.presets/minimum-boot.json', 'config/001.presets/source-build-requirements.json',
  'config/001.presets/package-mirrors.json',
  'tools/plugins-meta.json', 'tools/plugin-sizes.json', 'tools/i18n-source.json',
  'tools/i18n-translations.json', 'tools/plugins-i18n.json', 'tools/device-catalog.json',
  'tools/package-baseline-360t7.json']) {
  try { JSON.parse(readFileSync(join(ROOT, f), 'utf8')); ok(f); }
  catch (e) { bad(f, e.message.slice(0, 80)); }
}

console.log('[3/3] 一致性抽查 / consistency spot checks');
try {
  const dev = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'devices.json'), 'utf8'));
  const t7 = dev.devices.find((d) => d.id === '360t7');
  const activeSources = new Set(['ImmortalWrt', 'OpenWrt', 'lede']);
  t7 && t7.sources.length === activeSources.size && t7.sources.every((source) => activeSources.has(source.id))
    ? ok(`devices: ${dev.devices.length} 台,360T7 ${t7.sources.length} 条官方/社区产线`)
    : bad('devices.json', '360t7 缺失或现行三条产线不完整');
  const profileMatrixOk = dev.devices.every((device) => device.sources.every((source) =>
    activeSources.has(source.id) && source.versions.every((version) =>
      source.variants.some((variant) =>
        (!variant.versions || variant.versions.includes(version.id)) &&
        Boolean(variant.configs?.[version.id] || variant.config || source.config)))));
  profileMatrixOk
    ? ok('设备矩阵:每个源码/分支至少有一个真实 Profile 与独立 config')
    : bad('device profile matrix', '存在无 Profile、无 config 或非现行源码的分支');
  const x86 = dev.devices.find((device) => device.id === 'x86-64-generic');
  const configManifest = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'config-manifest.json'), 'utf8'));
  const x86Manifest = configManifest.configs['x86-64-generic/OpenWrt/main/generic'];
  const x86TargetOk = x86?.kind === 'target' &&
    x86.target?.system === 'x86' && x86.target?.subtarget === '64' && x86.target?.profile === 'generic' &&
    x86.sources?.[0]?.id === 'OpenWrt' && x86.sources[0].versions?.[0]?.branch === 'main' &&
    x86Manifest?.target?.includes('CONFIG_TARGET_x86_64_DEVICE_generic=y');
  x86TargetOk
    ? ok('通用 Target 首批:x86 / x86_64 / Generic x86/64 数据与配置清单已接通')
    : bad('generic target contract', 'x86 Target 元数据、OpenWrt/main 或配置签名不完整');
  const openWrtBranches = new Set(t7?.sources.find((source) => source.id === 'OpenWrt')?.versions.map((v) => v.branch) || []);
  const branchPolicyOk = openWrtBranches.has('main') && !['lede-17.01', 'pcs-standalone-back', 'master']
    .some((branch) => openWrtBranches.has(branch));
  branchPolicyOk
    ? ok('OpenWrt 分支策略:保留 main,排除 lede-17.01 / pcs-standalone-back / master')
    : bad('OpenWrt branch policy', [...openWrtBranches].join(','));
  const i18n = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'i18n.json'), 'utf8'));
  const keys = Object.keys(i18n.strings);
  const langIds = i18n.languages.map((lang) => lang.id);
  const miss = keys.filter((key) => langIds.some((lang) => !i18n.strings[key][lang]));
  miss.length === 0 && langIds.length === 11
    ? ok(`i18n: ${keys.length} 词条 × 11 语完整`)
    : bad('i18n.json', '11 语缺词条: ' + miss.slice(0, 5).join(','));
  const pluginMeta = JSON.parse(readFileSync(join(ROOT, 'tools', 'plugins-meta.json'), 'utf8')).plugins;
  const pluginI18n = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'plugins-i18n.json'), 'utf8')).plugins;
  const pluginLangs = ['zh-TW', 'en', 'ru', 'es', 'pt', 'ja', 'ko', 'de', 'fr', 'vi'];
  const pluginMissing = Object.entries(pluginI18n).filter(([, row]) =>
    pluginLangs.some((lang) => !row.name?.[lang] || !row.desc?.[lang]));
  Object.keys(pluginI18n).length === pluginMeta.length && pluginMissing.length === 0
    ? ok(`精选插件:${pluginMeta.length} 项名称/用途 × 11 语完整(含独立繁中或英文回退)`)
    : bad('plugins-i18n.json', `条目 ${Object.keys(pluginI18n).length}/${pluginMeta.length},缺译 ${pluginMissing.length}`);
  const t7PluginRows = JSON.parse(
    readFileSync(join(ROOT, 'site', 'wrt', 'data', '360t7', 'plugins.json'), 'utf8')).plugins;
  const missingPluginFallbacks = t7PluginRows.filter((plugin) =>
    typeof plugin.pkg !== 'string' || plugin.pkg.length === 0);
  missingPluginFallbacks.length === 0
    ? ok('360T7 精选插件均有安全包名兜底')
    : bad('360t7 plugin package fallback', missingPluginFallbacks.map((p) => p.id).join(','));
  const catalogOnlyMeta = pluginMeta.filter((plugin) => plugin.catalogOnly);
  const catalogOnlyInvalid = catalogOnlyMeta.filter((metaRow) => {
    const generated = t7PluginRows.find((plugin) => plugin.id === metaRow.id);
    const expected = metaRow.catalogCandidates?.[0];
    return !generated || generated.catalogOnly !== true || !/^luci-app-[A-Za-z0-9_.+@-]+$/.test(expected || '') ||
      generated.pkg !== expected || JSON.stringify(generated.catalogCandidates || []) !== JSON.stringify(metaRow.catalogCandidates);
  });
  catalogOnlyMeta.length === 16 && catalogOnlyInvalid.length === 0
    ? ok('Catalog-only 精选项:16 项均绑定唯一 LuCI PACKAGE_ 符号，运行时由 Catalog 门禁')
    : bad('catalog-only package mapping', catalogOnlyInvalid.map((p) => p.id).join(',') || `count=${catalogOnlyMeta.length}`);
  const networkMagicIds = ['ipsec-vpnd', 'openvpn', 'openvpn-server', 'softether', 'softethervpn', 'wireguard'];
  const networkMagicOk = networkMagicIds.every((id) =>
    pluginMeta.find((plugin) => plugin.id === id)?.group === '魔法与加速' &&
    t7PluginRows.find((plugin) => plugin.id === id)?.group === '魔法与加速');
  networkMagicOk
    ? ok('指定 VPN/组网插件已从内网穿透与组网移至魔法与加速')
    : bad('plugin group placement', networkMagicIds.join(','));
  const rawPackageData = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', '360t7', 'packages.json'), 'utf8'));
  const rawPackages = rawPackageData.pkgs;
  const baselinePackageData = JSON.parse(readFileSync(join(ROOT, 'tools', 'package-baseline-360t7.json'), 'utf8'));
  const rawPackageNames = Object.keys(rawPackages);
  const rawPackageSourcesOk = Object.values(rawPackages).every((states) =>
    Object.keys(states).every((source) => activeSources.has(source)));
  rawPackageNames.length >= 4000 && rawPackageSourcesOk &&
    rawPackageData.count === rawPackageNames.length &&
    baselinePackageData.count === Object.keys(baselinePackageData.pkgs).length
    ? ok(`360T7 开发者软件包:${rawPackageNames.length} 项,仅含现行三源状态`)
    : bad('360t7 packages baseline', `条目 ${rawPackageNames.length} 或含非现行源码`);
const timezones = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'timezones.json'), 'utf8')).zones;
  const timezoneNames = new Set(timezones.map((zone) => zone.zonename));
  const timezoneOk = timezones.length >= 400 && timezoneNames.size === timezones.length &&
    timezones.some((zone) => zone.zonename === 'Asia/Shanghai' && zone.timezone === 'CST-8') &&
    timezones.every((zone) => /^[A-Za-z0-9_+./-]+$/.test(zone.zonename) && !/[\r\n']/.test(zone.timezone));
  timezoneOk
    ? ok(`时区:${timezones.length} 个 OpenWrt/LuCI IANA 映射,zonename/timezone 白名单完整`)
  : bad('timezones.json', '条目数量、唯一性、安全字符或 Asia/Shanghai 映射异常');
const minimumBootSource = JSON.parse(readFileSync(
  join(ROOT, 'config', '001.presets', 'minimum-boot.json'), 'utf8'));
const minimumBootPublic = JSON.parse(readFileSync(
  join(ROOT, 'site', 'wrt', 'data', 'minimum-boot.json'), 'utf8'));
const packageMirrorRules = JSON.parse(readFileSync(
  join(ROOT, 'config', '001.presets', 'package-mirrors.json'), 'utf8'));
const packageMirrors = JSON.parse(readFileSync(
  join(ROOT, 'site', 'wrt', 'data', 'package-mirrors.json'), 'utf8'));
const firewallCandidates = minimumBootSource.firewallBackend?.candidates || [];
const minimumItems = [...(minimumBootSource.items || []), ...firewallCandidates];
const minimumSymbols = minimumItems.map((item) => item.symbol);
const minimumIds = minimumItems.map((item) => item.id);
const recommendedOpkg = (minimumBootSource.items || []).find((item) => item.id === 'opkg');
const firewallChoiceOk = firewallCandidates.length >= 2 &&
  firewallCandidates.every((item) => /^PACKAGE_[A-Za-z0-9_.+@-]+$/.test(item.symbol || ''));
JSON.stringify(minimumBootSource) === JSON.stringify(minimumBootPublic) &&
  minimumItems.length >= 3 && new Set(minimumIds).size === minimumIds.length &&
  new Set(minimumSymbols).size === minimumSymbols.length &&
  minimumSymbols.includes('PACKAGE_opkg') && !minimumSymbols.includes('PACKAGE_luci-app-opkg') &&
  recommendedOpkg?.symbol === 'PACKAGE_opkg' && recommendedOpkg.catalogPath === 'Base system' &&
  firewallChoiceOk
  ? ok(`推荐项预设:${minimumBootSource.items.length} 个可维护项目 + opkg + ${firewallCandidates.length} 个防火墙候选`)
  : bad('minimum-boot.json', '源文件/网页副本不一致、项目 ID/符号重复、opkg 或防火墙候选缺失');
const mirrorIds = (packageMirrorRules.presets || []).map((preset) => preset.id);
const publicMirrorIds = (packageMirrors.presets || []).map((preset) => preset.id);
const menuCatalogIndex = JSON.parse(
  readFileSync(join(ROOT, 'site', 'wrt', 'data', 'menuconfig-index.json'), 'utf8'));
const currentSourceIds = [...new Set([
  ...dev.devices.flatMap((device) => (device.sources || []).map((source) => source.id)),
  ...(menuCatalogIndex.sources || []).map((source) => source.id),
])].sort();
const knownFamilies = new Set(Object.values(packageMirrorRules.sourceFamilies || {}));
const mirrorRulesOk = packageMirrorRules.schema === 2 && packageMirrors.schema === 2 &&
  ['auto', 'source-default', 'ustc', 'pku'].every((id) => mirrorIds.includes(id)) &&
  JSON.stringify(mirrorIds) === JSON.stringify(publicMirrorIds) &&
  new Set(mirrorIds).size === mirrorIds.length &&
  currentSourceIds.every((sourceId) => packageMirrorRules.sourceFamilies?.[sourceId]) &&
  [...knownFamilies].every((family) => Array.isArray(packageMirrorRules.origins?.[family]) &&
    packageMirrorRules.origins[family].length > 0) &&
  packageMirrorRules.adapters.some((adapter) => adapter.manager === 'apk') &&
  packageMirrorRules.adapters.some((adapter) => adapter.manager === 'opkg') &&
  packageMirrorRules.policies?.neverFailBuild === true &&
  packageMirrorRules.policies?.auto?.join(',') === 'ustc,pku,source-default' &&
  packageMirrorRules.policies?.manualFailure?.join(',') === 'source-default' &&
  packageMirrorRules.presets.every((preset) => Object.values(preset.roots || {}).every((root) =>
    /^https:\/\/[A-Za-z0-9.-]+(?:\/[A-Za-z0-9._/-]+)?$/.test(root)));
mirrorRulesOk
  ? ok(`软件包镜像:${currentSourceIds.join('/')} 使用 schema 2 规范、APK/OPKG 适配器与非阻断回退`)
  : bad('package-mirrors.json', '规范/网页投影、源码 family、APK/OPKG 适配器或回退策略不完整');
  const html = readFileSync(join(ROOT, 'site', 'wrt', 'index.html'), 'utf8');
  const js = readFileSync(join(ROOT, 'site', 'wrt', 'app.js'), 'utf8');
  const catalogLoaderJs = readFileSync(join(ROOT, 'site', 'wrt', 'lib', 'catalog-loader.js'), 'utf8');
  const catalogSchema6Js = readFileSync(join(ROOT, 'site', 'wrt', 'lib', 'catalog-schema6.js'), 'utf8');
  const catalogSearchWorkerJs = readFileSync(join(ROOT, 'site', 'wrt', 'lib', 'catalog-search-worker.js'), 'utf8');
  const genPlugins = readFileSync(join(ROOT, 'tools', 'gen-plugins.mjs'), 'utf8');
  const sensitiveMaskContract = js.includes("'wireguard'") && js.includes("'tor'") &&
    js.includes("/^wireguard$/i.test(w)") && js.includes("w.slice(0, 3) + '***' + w.slice(-3)");
  sensitiveMaskContract
    ? ok('中文界面 WireGuard→Wir***ard、Tor→T*r 敏感词打码已接通')
    : bad('sensitive mask', 'WireGuard 或 Tor 的中文界面打码规则缺失');
  const legacyImportStart = js.indexOf('function decodeLegacyJsonString(raw)');
  const legacyImportEnd = js.indexOf('\nasync function importConfigFile(file)', legacyImportStart);
  let legacyJsonImportRuntimeOk = false;
  if (legacyImportStart >= 0 && legacyImportEnd > legacyImportStart) {
    const malformedLegacyJson = [
      '{',
      '  "schema": 5,',
      '  "pageVersion": "v2608060947",',
      '  "config": "# Generated by WeiG-OpenWrt-AutoBuild web customizer\\nCONFIG_ARCH="x86_64"\\nCONFIG_TARGET_PROFILE="DEVICE_generic"\\n",',
      '  "use_defconfig": true',
      '}',
    ].join('\n');
    try {
      const sandbox = { input: malformedLegacyJson, output: null, console };
      runInNewContext(`${js.slice(legacyImportStart, legacyImportEnd)}\noutput = parseImportedJson(input);`, sandbox);
      legacyJsonImportRuntimeOk = sandbox.output?.recovered === true &&
        sandbox.output.payload?.config?.includes('CONFIG_ARCH="x86_64"') &&
        sandbox.output.payload?.use_defconfig === true;
    } catch (error) {
      console.error('[legacy JSON import fixture]', error);
    }
  }
  legacyJsonImportRuntimeOk
    ? ok('legacy WeiG JSON import: malformed embedded config quotes are recovered without eval')
    : bad('legacy WeiG JSON import', 'malformed embedded config quotes were not recovered safely');
  const css = readFileSync(join(ROOT, 'site', 'wrt', 'app.css'), 'utf8');
  const buildWorkflow = readFileSync(join(ROOT, '.github', 'workflows', 'custom-build.yml'), 'utf8');
  const syncWorkflow = readFileSync(join(ROOT, '.github', 'workflows', 'sync-upstream.yml'), 'utf8');
  const driftSentinel = readFileSync(join(ROOT, 'tools', 'check-drift.mjs'), 'utf8');
  const parser = readFileSync(join(ROOT, 'tools', 'parse-request.mjs'), 'utf8');
  const requirementsSource = JSON.parse(readFileSync(
    join(ROOT, 'config', '001.presets', 'source-build-requirements.json'), 'utf8'));
  const requirementsPublic = JSON.parse(readFileSync(
    join(ROOT, 'site', 'wrt', 'data', 'source-build-requirements.json'), 'utf8'));
  const requirementIds = requirementsSource.requirements?.map((row) => row.id) || [];
  const sourceRequirementsOk = requirementsSource.schema === 1 &&
    JSON.stringify(requirementsSource) === JSON.stringify(requirementsPublic) &&
    requirementIds.length > 0 && new Set(requirementIds).size === requirementIds.length &&
    requirementsSource.requirements.every((row) => Array.isArray(row.options) && row.options.length > 0 &&
      row.options.every((option) => /^[A-Z0-9_]+$/.test(option.symbol) && ['n', 'm', 'y'].includes(option.value))) &&
    requirementsSource.requirements.some((row) =>
      row.options.some((option) => option.symbol === 'HAVE_DOT_CONFIG' && option.value === 'y')) &&
    js.includes("loadJson('source-build-requirements.json')") &&
    js.includes('function applyBuildRequirements(text)') &&
    js.includes('enforceBuildRequirements && !state.useDefconfig') &&
    !js.includes('openBuildRequirementResolver') &&
    !parser.includes('missingBuildRequirements') &&
    !parser.includes('构建必需配置缺失');
  sourceRequirementsOk
    ? ok('source build requirements: frontend silently applies HAVE_DOT_CONFIG without backend rejection')
    : bad('source build requirements', 'frontend marker, JSON copy, or backend-removal contract is invalid');
  const project = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'project.json'), 'utf8'));
  const deployScript = readFileSync(join(ROOT, 'docs-private', 'Sync_Deploy.bat'), 'utf8');
  const remoteDeployBase64 = deployScript.match(/set \"REMOTE_B64=([A-Za-z0-9+/=]+)\"/)?.[1] || '';
  const remoteDeploySource = remoteDeployBase64 ? Buffer.from(remoteDeployBase64, 'base64').toString('utf8') : '';
  const syncBlogSource = readFileSync(join(ROOT, 'tools', 'sync-blog.mjs'), 'utf8');
  const textFormatSource = readFileSync(join(ROOT, 'tools', 'check-text-format.mjs'), 'utf8');
  const archiveVerifierSource = readFileSync(join(ROOT, 'tools', 'verify-site-archive.mjs'), 'utf8');
  const gitAttributes = readFileSync(join(ROOT, '.gitattributes'), 'utf8');
  const deployGuide = readFileSync(join(ROOT, 'docs-private', '部署与同步.md'), 'utf8');
  const blogGuide = readFileSync(join(ROOT, 'docs-private', '003.weige-share-blog同步与推送.md'), 'utf8');
  const developerGuideZh = readFileSync(join(ROOT, 'docs', 'DEVELOPER.md'), 'utf8');
  const developerGuideEn = readFileSync(join(ROOT, 'docs', 'DEVELOPER.en.md'), 'utf8');
  const catalogIndex = menuCatalogIndex;
  const assetHash = (name) => createHash('sha256')
    .update(readFileSync(join(ROOT, 'site', 'wrt', name), 'utf8').replace(/\r\n/g, '\n'))
    .digest('hex').slice(0, 10);
  const moduleHash = (name) => createHash('sha256')
    .update(readFileSync(join(ROOT, 'site', 'wrt', 'lib', name), 'utf8').replace(/\r\n/g, '\n'))
    .digest('hex').slice(0, 10);
  const assetVersionOk = html.includes(`app.css?v=${assetHash('app.css')}`) &&
    html.includes(`app.js?v=${assetHash('app.js')}`) &&
    js.includes(`./lib/catalog-engine.js?v=${moduleHash('catalog-engine.js')}`) &&
    js.includes(`./lib/catalog-loader.js?v=${moduleHash('catalog-loader.js')}`) &&
    js.includes(`./lib/catalog-schema6.js?v=${moduleHash('catalog-schema6.js')}`) &&
    js.includes(`./lib/catalog-search-worker.js?v=${moduleHash('catalog-search-worker.js')}`);
  assetVersionOk
    ? ok('前端 CSS/JS 与动态 Catalog 模块查询版本均和内容指纹一致')
    : bad('frontend asset cache bust', 'index.html 或 app.js 的静态/动态资源查询版本未按内容指纹更新');
  const browserGenerationContract =
    !js.includes('function assertCatalogConfiguration(') &&
    !js.includes('assertCatalogConfiguration(config)') &&
    !js.includes("alert(t('btn.download.fail'") &&
    js.includes('function showGenerationError(error)') &&
    js.includes("openModal(t('generation.error.title'))") &&
    js.includes("hint.textContent = t('generation.error.hint')") &&
    css.includes('.modal.generation-error') &&
    css.includes('.generation-error-list') &&
    css.includes('.generation-error-item');
  browserGenerationContract
    ? ok('browser generation trusts the loaded config and uses the themed error dialog')
    : bad('browser generation boundary', 'whole-config Catalog veto or native generation alert returned, or the themed dialog is incomplete');
  const catalogModulePackage = JSON.parse(readFileSync(
    join(ROOT, 'site', 'wrt', 'lib', 'package.json'), 'utf8'));
  const catalogBrowserModuleContract = catalogModulePackage.type === 'module' &&
    existsSync(join(ROOT, 'site', 'wrt', 'lib', 'catalog-engine.js')) &&
    existsSync(join(ROOT, 'site', 'wrt', 'lib', 'catalog-loader.js')) &&
    existsSync(join(ROOT, 'site', 'wrt', 'lib', 'catalog-schema6.js')) &&
    existsSync(join(ROOT, 'site', 'wrt', 'lib', 'catalog-search-worker.js')) &&
    !existsSync(join(ROOT, 'site', 'wrt', 'lib', 'catalog-engine.mjs')) &&
    !existsSync(join(ROOT, 'site', 'wrt', 'lib', 'catalog-loader.mjs')) &&
    js.includes("import('./lib/catalog-engine.js?v=") &&
    js.includes("import('./lib/catalog-loader.js?v=") &&
    js.includes("import('./lib/catalog-schema6.js?v=") &&
    js.includes("new Worker('./lib/catalog-search-worker.js?v=") &&
    !js.includes('catalog-engine.mjs') && !js.includes('catalog-loader.mjs');
  catalogBrowserModuleContract
    ? ok('Catalog browser modules use .js with a scoped Node ESM package and no legacy .mjs files')
    : bad('Catalog browser module layout', '.js modules, scoped package.json, imports, or legacy-file cleanup is incomplete');
  const siteArchiveVerifierContract =
    deployScript.includes(String.raw`node "%MAIN_REPO%\tools\verify-site-archive.mjs" "%LOCAL_ARCHIVE%"`) &&
    !deployScript.includes(':verify_site_archive') &&
    !deployScript.includes('tar -tzf "%~1" ^| findstr') &&
    archiveVerifierSource.includes("spawnSync(tarCommand, ['-tzf', archive]") &&
    archiveVerifierSource.includes('shell: false') &&
    archiveVerifierSource.includes('Required files confirmed') &&
    archiveVerifierSource.includes('Legacy .mjs Catalog module(s) found') &&
    REQUIRED_SITE_ARCHIVE_ENTRIES.every((entry) => archiveVerifierSource.includes(`'${entry}'`)) &&
    FORBIDDEN_SITE_ARCHIVE_ENTRIES.every((entry) => archiveVerifierSource.includes(`'${entry}'`));
  siteArchiveVerifierContract
    ? ok('VPS archive gate uses one shell-free Node verifier; CMD tar/findstr pipelines are forbidden')
    : bad('site archive verifier contract', 'Sync_Deploy, required/forbidden entries, shell:false, or old CMD pipeline cleanup is incomplete');
  const remoteCatalogDeploymentContract =
    !deployScript.includes('fetch-catalog-mirror.mjs') &&
    !deployScript.includes('CATALOG_MIRROR_ROOT') &&
    !deployScript.includes('catalog-data/index.json') &&
    (deployScript.includes('Browser uses commit-pinned jsDelivr/GitHub Raw with complete Release fallback') ||
      deployScript.includes('Browser uses commit-pinned jsDelivr with GitHub Raw fallback')) &&
    deployScript.includes(String.raw`tar -czf "%LOCAL_ARCHIVE%" -C "%MAIN_REPO%\site\wrt" .`) &&
    deployScript.includes(String.raw`node "%MAIN_REPO%\tools\verify-site-archive.mjs" "%LOCAL_ARCHIVE%"`) &&
    deployScript.includes('Legacy catalog-engine.mjs must be deleted before deployment.') &&
    deployScript.includes('Legacy catalog-loader.mjs must be deleted before deployment.') &&
    remoteDeploySource.includes('ROOT=${WRT_ROOT:-/var/www/wrt}') &&
    remoteDeploySource.includes('ARCHIVE=${WRT_ARCHIVE:-/tmp/wrt-update.tar.gz}') &&
    remoteDeploySource.includes('test -s "$NEW/lib/catalog-engine.js"') &&
    remoteDeploySource.includes('test -s "$NEW/lib/catalog-loader.js"') &&
    remoteDeploySource.includes('SMOKE_ORIGIN=${WRT_SMOKE_ORIGIN:-http://127.0.0.1:28081}') &&
    remoteDeploySource.includes('Content-Type:') &&
    remoteDeploySource.includes('catalog-engine.js') &&
    remoteDeploySource.includes('catalog-loader.js') &&
    remoteDeploySource.includes('catalog-schema6.js') &&
    remoteDeploySource.includes('catalog-search-worker.js') &&
    remoteDeploySource.includes('test ! -e "$NEW/lib/catalog-engine.mjs"') &&
    remoteDeploySource.includes('test ! -e "$NEW/lib/catalog-loader.mjs"');
  remoteCatalogDeploymentContract
    ? ok('VPS 只部署网页；Catalog 由固定提交 CDN/Raw 与完整 Release 提供')
    : bad('remote Catalog deployment', '部署脚本仍下载/打包 Catalog，或未声明提交固定的远程回退');
  const exactBlogMirrorContract =
    syncBlogSource.includes("const temporary = join(blogSource, 'wrt.sync-tmp')") &&
    syncBlogSource.includes("const previous = join(blogSource, 'wrt.sync-prev')") &&
    syncBlogSource.includes('Temporary mirror verification failed') &&
    syncBlogSource.includes('Activated mirror verification failed') &&
    syncBlogSource.includes("assertRegularFile(join(source, rel)") &&
    syncBlogSource.includes('copyFileSync(sourceEntry.path, destinationPath)') &&
    syncBlogSource.includes("createHash('sha256')") &&
    syncBlogSource.includes('readSync(descriptor, buffer') &&
    syncBlogSource.includes('[blog:copy] ${copied}/${total} files') &&
    !syncBlogSource.includes('cpSync') &&
    syncBlogSource.includes('return 3;') &&
    !syncBlogSource.includes("endsWith('.config')") &&
    deployScript.includes(String.raw`node tools\sync-blog.mjs "%BLOG_REPO%"`) &&
    deployScript.includes('call :verify_blog_mirror || exit /b 1') &&
    deployScript.includes('update blog, exact-mirror site/wrt to source/wrt') &&
    deployScript.includes('0xC0000409') &&
    !deployGuide.includes('剔除全部 `*.config`') &&
    !blogGuide.includes('排除 base `*.config`') &&
    !developerGuideZh.includes('自动剔除 *.config') &&
    !developerGuideEn.includes('strips *.config');
  exactBlogMirrorContract
    ? ok('blog sync: option 3 uses verified exact mirror with rollback; legacy .config filtering is removed')
    : bad('blog exact mirror contract', '同步工具、选项 3 编排、回滚验证或中英文文档仍保留旧过滤逻辑');
  const textFormatGateContract =
    textFormatSource.includes("const LF_EXTENSIONS = new Set") &&
    textFormatSource.includes("const CRLF_EXTENSIONS = new Set") &&
    textFormatSource.includes("'.conf'") && textFormatSource.includes("'.txt'") &&
    textFormatSource.includes("UTF-8 BOM is not allowed") &&
    textFormatSource.includes("has a blank line at EOF") &&
    textFormatSource.includes("No files were changed automatically") &&
    deployScript.includes('call :check_text_format "%REPO%" "%REPO_KIND%"') &&
    deployScript.indexOf('call :check_text_format "%REPO%" "%REPO_KIND%"') <
      deployScript.indexOf('call :check_main "%REPO%"') &&
    deployScript.includes('CRLF/LF conversion warnings are informational') &&
    gitAttributes.includes('*.mjs text eol=lf') &&
    gitAttributes.includes('*.bat text eol=crlf') &&
    gitAttributes.includes('.gitignore text eol=lf') &&
    gitAttributes.includes('.gitattributes text eol=lf') &&
    deployGuide.includes('check-text-format.mjs') &&
    blogGuide.includes('check-text-format.mjs') &&
    developerGuideZh.includes('check-text-format.mjs') &&
    developerGuideEn.includes('check-text-format.mjs');
  textFormatGateContract
    ? ok('text format gate: one generic checker runs before main check-all and documents warning/error separation')
    : bad('text format gate contract', 'checker policy, Sync_Deploy ordering, .gitattributes or bilingual docs are incomplete');
  const recommendedUiContract = html.includes('id="minimumBootToggle"') &&
    html.includes('id="defconfigToggle"') &&
    html.includes('id="minimumBootConfig"') && !html.includes('id="minimumBootConfig" type="button" hidden') && !html.includes('id="minimumBootPanel"') &&
    js.includes("uiText('推荐项', '推薦項', 'Recommended')") &&
    js.includes('function openMinimumBootModal()') &&
    js.includes('useDefconfig: true') && js.includes('use_defconfig: state.useDefconfig') &&
    js.includes('function renderMenuOption(option)') &&
    js.includes('function catalogSelectLock(option)') && js.includes('function catalogSelectLockValue(option, lockedBy)') &&
    js.includes(".filter((stateValue) => stateValue === 'n' || kconfigLevel(stateValue) <= maxLevel)") &&
    js.includes("'# recommended: '") &&
    js.includes('config.hidden = false') && js.includes('config.disabled = !state.minimumBoot');
  recommendedUiContract
    ? ok('推荐项:英文源文案、可关闭配置弹窗与 Catalog 状态复用已接通')
    : bad('recommended UI', '推荐项命名、弹窗或 Catalog N/M/Y/锁定状态复用缺失');
  const catalogLayoutContract = html.includes('class="catalog-overview-row"') &&
    html.indexOf('id="catalogLocator"') < html.indexOf('id="buildContract"') &&
    html.indexOf('id="menuconfigToggle"') < html.indexOf('id="minimumBootToggle"') &&
    !js.includes("type: 'Menu'") && !js.includes("type: 'Option'") && !js.includes("type: 'Application'") &&
    js.includes("`${packageName} ${option.prompt || ''} ${option.promptEn || ''} ${option.promptZh || ''} `") &&
    !js.includes("`${option.usageEn || ''} ${option.usageZh || ''} `") &&
    html.includes('id="menuconfigSearch"') && html.includes('placeholder="Search option name"') &&
    css.includes('.menuconfig-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:nowrap') &&
    js.includes("id.className = 'menuconfig-option-label menuconfig-option-id'") &&
    js.includes('id.textContent = packageName || option.symbol') &&
    js.includes("description.className = 'menuconfig-option-label menuconfig-option-description'") &&
    js.includes("description.textContent = [...new Set([localized, english].filter(Boolean))].join(' · ')") &&
    js.includes('function menuOptionPopupText(element)') &&
    js.includes('`CONFIG_${element.dataset.symbol}`') &&
    js.includes("element.dataset.path || ''") &&
    js.includes("if (optionLabel?.dataset.symbol) showMenuOptionTooltip(optionLabel)") &&
    js.includes("if (optionLabel?.dataset.symbol && !matchMedia('(hover: none)').matches)") &&
    js.includes('id.dataset.symbol = option.symbol') && js.includes('id.tabIndex = 0') &&
    !js.includes("id.textContent = `CONFIG_${option.symbol}`") &&
    !js.includes('menuconfig-package-desc') && !css.includes('.menuconfig-package-desc') &&
    css.includes('.menuconfig-option-summary{display:grid;grid-template-columns:minmax(120px,220px) auto minmax(0,1fr)') &&
    css.includes('.menuconfig-option-description{text-align:right') &&
    css.includes('.menuconfig-option-actions{position:relative;z-index:2;display:flex;flex:none') &&
    css.includes('.catalog-overview-row{display:grid;grid-template-columns:') &&
    css.includes('.build-contract{display:contents}') &&
    css.includes('.build-contract-body{grid-column:1 / -1') &&
    js.includes("contractText('源码', 'Source')") &&
    js.includes("contractText('分支', 'Branch')") &&
    js.includes("contractText('软件包', 'Packages')");
  catalogLayoutContract
    ? ok('Catalog UI:范围搜索、构建契约、Advanced/推荐项顺序、ID/描述单行与安全悬浮已接通')
    : bad('Catalog UI layout', '搜索范围、控件顺序、Advanced ID/描述、悬浮信息或 N/M/Y 隔离不符合约定');
  const catalogInteractionUiContract =
    !js.includes('showToast(CATALOG_ENGINE.formatViolations(result.violations))') &&
    js.includes('function openCatalogConflictModal(option, value, violations') &&
    js.includes("modal.classList.add('catalog-conflict')") &&
    js.includes("for (const stateValue of ['n', 'm', 'y'])") &&
    css.includes('.modal.catalog-conflict') && css.includes('.catalog-conflict-state button:disabled') &&
    js.includes('function recoverLegacyWeiGJson(text)') &&
    js.includes('function parseImportedJson(text)') &&
    js.includes('Legacy JSON loaded. Download it again') &&
    js.includes('JSON.stringify(config)');
  catalogInteractionUiContract
    ? ok('Catalog interaction UI: global violation toast removed, conflicts use N/M/Y modal, and legacy JSON is recovered safely')
    : bad('Catalog interaction UI', 'global violation toast, conflict modal, or legacy JSON recovery is incomplete');
  const browserPackageMirrorContract =
    js.includes('const MAINLAND_BROWSER_TIMEZONES = new Set') &&
    js.includes('Intl.DateTimeFormat().resolvedOptions().timeZone') &&
    js.includes("browserUsesMainlandPackageMirror() ? 'auto' : 'source-default'") &&
    js.includes('packageMirrorSelectionExplicit = true') &&
    html.includes('data-i18n="fw.packageMirror"') && html.includes('id="packageMirrorBox"') &&
    !html.includes('id="opkgBox"');
  browserPackageMirrorContract
    ? ok('浏览器中国内地时区默认自动 USTC→PKU，其他地区跟随源码；用户手选后不覆盖')
    : bad('browser package mirror default', '浏览器时区、自动回退、显式选择保护或新控件缺失');
  const submitLayoutContract = html.includes('class="submit-primary-fields"') &&
    html.indexOf('id="lanipBox"') < html.indexOf('id="rootpwBox"') &&
    html.indexOf('id="rootpwBox"') < html.indexOf('id="tagBox"') &&
    css.includes('.submit-primary-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }') &&
    css.includes('.submit-primary-fields { grid-template-columns: 1fr; }');
  submitLayoutContract
    ? ok('提交设置:后台登录地址、初始密码、构建标识依次排列，手机端自动纵向排列')
    : bad('submit settings layout', '后台登录地址/初始密码/构建标识的顺序或响应式布局不符合约定');
  const submitGateContract = html.includes('id="submitBtn" data-i18n="btn.submit" disabled') &&
    js.includes('function submitReadiness()') &&
    js.includes('function updateSubmitGate()') &&
    js.includes('Waiting for build stages:') &&
    js.includes('if (!readiness.ok) {') &&
    !js.includes('setInterval(updateSubmitGate');
  submitGateContract
    ? ok('提交门禁:Target/Catalog/menuconfig/theme/recommended/defconfig 阶段就绪后才可提交')
    : bad('submit readiness gate', '提交按钮未按构建阶段状态禁用或缺少事件驱动门禁');
  const failureDiagnosticsContract =
    !buildWorkflow.includes('apply-config-overrides.mjs') &&
    !buildWorkflow.includes('system-overrides.json') &&
    !buildWorkflow.includes('CONFIG_DEVEL') &&
    !buildWorkflow.includes('CONFIG_BUILD_LOG') &&
    !buildWorkflow.includes('validate-catalog-config.mjs') &&
    !existsSync(join(ROOT, 'tools', 'validate-catalog-config.mjs')) &&
    !existsSync(join(ROOT, 'tools', 'config-rules.mjs')) &&
    !existsSync(join(ROOT, 'config', '001.presets', 'config-rules.json')) &&
    !existsSync(join(ROOT, 'site', 'wrt', 'data', 'config-rules.json')) &&
    !parser.includes('validateConfig(') && !parser.includes('matchingConfigRules(') &&
    !parser.includes('CONFIG_TARGET_ARCH_PACKAGES 与 Catalog') &&
    !parser.includes('CONFIG_ARCH 与 Catalog') &&
    !parser.includes('提交配置没有启用所选固件主题') &&
    !buildWorkflow.includes('Selected firmware theme is missing') &&
    !buildWorkflow.includes("grep '^CONFIG_TARGET_PROFILE'") &&
    buildWorkflow.includes('config_policy=upstream-defconfig') &&
    buildWorkflow.includes('config_policy=authoritative-no-defconfig') &&
    buildWorkflow.includes('make defconfig 2>&1 | tee') &&
    buildWorkflow.includes('pre-defconfig.config') &&
    buildWorkflow.includes('defconfig.config') &&
    buildWorkflow.includes('defconfig.diff') &&
    buildWorkflow.includes('defconfig.log') &&
    buildWorkflow.includes('build.config') &&
    buildWorkflow.includes('make -j1 V=s BUILD_LOG=1') &&
    buildWorkflow.includes('Compile was not started because an earlier step failed') &&
    js.includes('function applyBuildRequirements(text)') &&
    !js.includes('matchingConfigRules(config)') &&
    !js.includes('openConfigRuleResolver') &&
    !js.includes("window.open('about:blank'") && js.includes('window.location.assign(issueUrl)') &&
    buildWorkflow.includes('实际列出的文件');
  failureDiagnosticsContract
    ? ok('配置边界:后端仅保留 Target/Profile 身份与官方 Defconfig，诊断链完整')
    : bad('configuration boundary', '仍有 Catalog/兼容/架构/主题阻断或诊断链缺失');
  const backendBoundaryFixtureRoot = mkdtempSync(join(tmpdir(), 'weig-backend-config-boundary-'));
  try {
    const fixtureId = '360t7/ImmortalWrt/master/qihoo_360t7';
    const fixtureManifest = configManifest.configs[fixtureId];
    let fixtureConfig = readFileSync(join(ROOT, fixtureManifest.sourcePath), 'utf8')
      .replace(/^CONFIG_HAVE_DOT_CONFIG=.*\n|^# CONFIG_HAVE_DOT_CONFIG is not set\n/gm, '')
      .replace(/\s*$/, '\n');
    fixtureConfig += 'CONFIG_PACKAGE_dnsmasq=y\nCONFIG_PACKAGE_dnsmasq-full=y\nCONFIG_DROPBEAR_ED25519=y\n';
    const fixtureRequest = {
      schema: 4, pageVersion: 'v2608062236', configId: fixtureId,
      device: '360t7', source: 'ImmortalWrt', version: 'master', branch: 'master',
      variant: 'qihoo_360t7', plugins: [], tag: 'boundary-fixture', config: fixtureConfig,
      use_defconfig: false,
      audit: { recommended: { enabled: false, requested: [] }, defconfig: { enabled: false } },
      firmware: { zonename: 'Asia/Shanghai', timezone: 'CST-8', theme: 'luci-theme-argon', ntp: 'cn', packageMirror: 'ustc' },
    };
    const requestPath = join(backendBoundaryFixtureRoot, 'request.json');
    const submittedPath = join(backendBoundaryFixtureRoot, 'submitted.config');
    const auditPath = join(backendBoundaryFixtureRoot, 'audit.json');
    writeFileSync(requestPath, JSON.stringify(fixtureRequest));
    const parserEnv = {
      ...process.env, REQUEST_FILE: requestPath, REQUEST_MANIFEST: '',
      SUBMITTED_CONFIG_OUT: submittedPath, RECOMMENDED_AUDIT_OUT: auditPath,
    };
    const accepted = spawnSync(process.execPath, [join(ROOT, 'tools', 'parse-request.mjs')], {
      encoding: 'utf8', env: parserEnv,
    });
    fixtureRequest.config = fixtureConfig.replace(
      'CONFIG_TARGET_mediatek_filogic_DEVICE_qihoo_360t7=y',
      'CONFIG_TARGET_mediatek_filogic_DEVICE_wrong_profile=y');
    writeFileSync(requestPath, JSON.stringify(fixtureRequest));
    const rejected = spawnSync(process.execPath, [join(ROOT, 'tools', 'parse-request.mjs')], {
      encoding: 'utf8', env: parserEnv,
    });
    accepted.status === 0 && rejected.status !== 0 &&
        String(rejected.stderr || rejected.stdout).includes('目标设备签名')
      ? ok('后端边界夹具:不审判插件依赖/HAVE_DOT_CONFIG,但拒绝错误 Target/Profile')
      : bad('backend config boundary fixture',
        `accepted=${accepted.status}, rejected=${rejected.status}, ${(accepted.stderr || rejected.stderr || '').slice(0, 220)}`);
  } catch (error) {
    bad('backend config boundary fixture', error.message.slice(0, 300));
  } finally {
    rmSync(backendBoundaryFixtureRoot, { recursive: true, force: true });
  }
  const issueOnlyBuildContract = !buildWorkflow.includes('workflow_dispatch:') &&
    !buildWorkflow.includes('repository_dispatch:') &&
    !buildWorkflow.includes('client_payload') &&
    !existsSync(join(ROOT, '.github', 'workflows', 'smoke-all.yml')) &&
    !existsSync(join(ROOT, 'tools', 'build-config.mjs')) &&
    parser.includes('仅支持网页生成的 build-request.json') &&
    !parser.includes('smoke-internal') &&
    !parser.includes('IN_DEVICE') &&
    !buildWorkflow.includes('authoritative_config');
  issueOnlyBuildContract
    ? ok('构建入口:仅接受网页生成的 Issue 权威附件，旧 smoke 生成链已删除')
    : bad('build entrypoint', '仍残留 repository_dispatch、smoke workflow 或旧配置生成器');
  const driftSentinelContract = driftSentinel.includes("const forbidden = ['lede-17.01', 'pcs-standalone-back', 'master'];") &&
    driftSentinel.includes("names.has('main')") && !driftSentinel.includes('360T7') &&
    !driftSentinel.includes('qihoo_360t7') && !syncWorkflow.includes('360T7');
  driftSentinelContract
    ? ok('上游漂移哨兵:仅保留通用 OpenWrt 分支策略，不再阻断 360T7 专用 Profile')
    : bad('upstream drift sentinel', '360T7 专用检查仍存在，或 OpenWrt 通用分支策略缺失');
  const previewBatBytes = readFileSync(join(ROOT, 'OpenWebPage_打开网页.bat'));
  const previewBat = previewBatBytes.toString('ascii');
  const previewServer = readFileSync(join(ROOT, 'tools', 'serve.mjs'), 'utf8');
  const previewBatOk = !previewBatBytes.some((byte) => byte > 0x7f) &&
    !/(?<!\r)\n/.test(previewBat) &&
    previewBat.includes('node tools\\serve.mjs site\\wrt 8642') &&
    previewBat.includes('title wrt-server - local preview 8642') &&
    previewBat.includes('http://localhost:8642/index.html') &&
    previewBat.includes('http://localhost:8642/lib/catalog-engine.js') &&
    previewBat.includes('http://localhost:8642/lib/catalog-loader.js') &&
    previewBat.includes('http://localhost:8642/lib/catalog-schema6.js') &&
    previewBat.includes('http://localhost:8642/lib/catalog-search-worker.js') &&
    previewBat.includes("$l.Headers['Content-Type'] -match 'javascript'") &&
    previewBat.includes('start "" /b powershell') &&
    !previewBat.includes('start "wrt-server" /min') &&
    !previewBat.includes('pause\r\nexit /b 0') &&
    previewBat.includes('menuconfigBox') &&
    previewServer.includes("'.js': 'text/javascript; charset=utf-8'") &&
    previewServer.includes("'.mjs': 'text/javascript; charset=utf-8'") &&
    previewServer.includes("'cache-control': 'no-store'");
  previewBatOk
    ? ok('本地预览单窗口启动，ES modules MIME/无缓存检查与 ASCII+CRLF 均已接通')
    : bad('local preview', '单窗口启动、模块健康检查、MIME、无缓存或 bat 编码不正确');
  const ids = [...js.matchAll(/\$\('([A-Za-z]\w+)'\)/g)].map((m) => m[1]);
  const dynamicIds = new Set(['targetSystem', 'targetSubtarget', 'targetProfile']);
  const missing = [...new Set(ids)].filter((id) => !html.includes(`id="${id}"`) && !dynamicIds.has(id));
  missing.length === 0 ? ok('app.js 引用的元素 id 在 index.html 全部存在') : bad('index.html', '缺元素: ' + missing.join(','));
  const targetPickerContract = ['targetSource', 'targetBranch', 'targetDynamicSelectors']
    .every((id) => html.includes(`id="${id}"`)) &&
    html.includes('id="targetSourceLabel">Source</span>') &&
    html.includes('id="targetBranchLabel">Branch</span>') &&
    !html.includes('Source — 源码') &&
    !html.includes('id="deviceModeBtn"') && !html.includes('id="brandPicker"') &&
    html.includes('id="sourceStep"') &&
    !js.includes('function targetRecords()') &&
    !js.includes('function renderTargetPicker(') &&
    !js.includes("loadJson('devices.json')") &&
    !js.includes("loadJson('config-manifest.json')") &&
    js.includes('function renderCatalogTargetSelectors') &&
    js.includes('target.systemName || target.board') &&
    js.includes('target.subtargetLabel || target.subtargetName') &&
    js.includes("(node.aliasesEn || []).join(' ')") &&
    js.includes('const TARGET_FIELD_I18N =') &&
    js.includes('(item) => item.labelEn || item.value') &&
    js.includes('DEFAULT_TARGET_SELECTORS') &&
    css.includes('.target-dynamic{display:contents}') &&
    css.includes('.target-picker .target-profile{flex:1.8 1 260px}');
  targetPickerContract
    ? ok('品牌型号入口已移除,源码/分支/Target 动态选择器已接通')
    : bad('target picker UI', 'Catalog 动态级联、旧入口清理或响应式布局缺失');
  const pluginPaletteContract = ['--plugin-panel:', '--plugin-head:', '--plugin-item:',
    '--plugin-hover:', '--plugin-selected:', '--plugin-muted:',
    '.plugin:has(input:checked) { background: var(--plugin-selected); }']
    .every((token) => css.includes(token)) &&
    !css.includes('box-shadow: inset 3px 0 0');
  pluginPaletteContract
    ? ok('插件分区与选项使用浅色/暗色整体蓝色层次,旧竖边框已移除')
    : bad('plugin palette', '插件区域蓝色背景变量、选中态或旧竖边框清理不完整');
  const catalogBranches = catalogIndex.sources.flatMap((source) =>
    source.branches.map((branch) => `${source.id}/${branch.branch}`));
  const catalogProjectContract = project.schema === 1 &&
    project.repository === 'weigefenxiang/WeiG-OpenWrt-AutoBuild' &&
    project.catalogRepository === catalogIndex.catalogRepo &&
    project.catalogReleaseTag === 'menuconfig-catalog-complete' &&
    catalogIndex.sources.length === 4 && catalogBranches.length === 14 &&
    catalogBranches.includes('hanwckf/openwrt-21.02') &&
    js.includes('PROJECT = await loadJson') &&
    (js.includes('branches: (source.branches || [])') ||
      catalogLoaderJs.includes('branches: [...(source.branches || [])]')) &&
    js.includes("errorStage: 'catalog-refresh-required'") &&
    !js.includes("filter((branch) => branch.state !== 'unavailable')") &&
    parser.includes("async function loadCatalogIndex(revision = 'catalog-data')") &&
    parser.includes('function legacyCatalogContract(branch)') &&
    parser.includes('const indexedLegacy = legacyCatalogContract(indexedBranch)') &&
    parser.includes('Catalog sourceCommit 与固定 index 不一致') &&
    parser.includes('catalogBranch.state ===') &&
    !parser.includes('async function loadCatalog(repo, branch') &&
    !parser.includes('validateConfig(') &&
    !parser.includes('createCatalogModel(') &&
    !parser.includes('active-catalog.json');
  catalogProjectContract
    ? ok('Fork 单文件参数 + Catalog 4 源 14 分支 + 构建白名单已接通')
    : bad('project/catalog contract', `源码 ${catalogIndex.sources.length},分支 ${catalogBranches.length},或动态白名单缺失`);
  const timezoneUiContract = html.includes('id="timezoneMenu" role="listbox"') &&
    html.includes('role="combobox"') &&
    !html.includes('id="timezoneList"') &&
    js.includes('function openTimezoneMenu') &&
    js.includes('function timezoneMenuKeydown') &&
    js.includes('function initializeTimezone') &&
    js.includes('function timezoneMenuZones') &&
    js.includes('const COMMON_TIMEZONES = [') &&
    js.includes("localStorage.setItem('wrt_timezone', zone.zonename)") &&
    js.includes("zone.zonename === 'Asia/Shanghai'") &&
    js.includes("return `(UTC${timezoneOffset(zone.zonename)}) ${zone.zonename}`;") &&
    !js.includes("const alias = zone.zonename") &&
    css.includes('grid-template-columns: minmax(250px, 2.25fr)') &&
    css.includes('height: 44px') &&
    css.includes('.timezone-menu');
  timezoneUiContract
    ? ok('Linux/IANA 可搜索时区组合框、北京时间搜索别名与统一固件控件高度已接通')
    : bad('timezone settings UI', '组合框、键盘交互、Asia/Shanghai 搜索别名或统一控件高度缺失');
  const dockHelpContract = html.includes('class="icon-btn dock-selftest"') &&
    html.includes('>检</button>') &&
    css.includes('.side-dock .lang-sel:focus') &&
    js.includes("const LANG_SHORT =") &&
    js.includes("'zh-CN': '简'") &&
    js.includes("en: 'EN'") &&
    js.includes('help.link.ubi') &&
    js.includes('help.link.layout');
  dockHelpContract
    ? ok('窄悬浮坞、聚焦展开语言框与 360T7 UBI/108M 精简说明已接通')
    : bad('dock/help UI', '悬浮坞尺寸、语言框展开或使用说明链接缺失');
  const importLogContract = html.includes('id="importLogBtn"') &&
    js.includes('function beginImportLog(file)') &&
    js.includes('function downloadImportLog()') &&
    js.includes('function showImportError(error)') &&
    js.includes("typeof id === 'string'") &&
    !js.includes("alert(t('import.fail'");
  importLogContract
    ? ok('配置导入异常对话框、隐私诊断日志下载与脏插件值防线已接通')
    : bad('config import diagnostics', '按钮、日志函数、错误对话框或空值防线缺失');
  const targetTypeContract = css.includes('font-size: 15px') &&
    css.includes('height: 44px') && css.includes('font-size:16px');
  targetTypeContract
    ? ok('Target 标签 15px、选中值 16px 与 44px 控件高度已接通')
    : bad('Target typography', 'Source/Branch/Target 标签、选中值或控件高度未放大');
  const menuconfigImportOk = js.includes('function importedConfigMeta') &&
    js.includes("values.get('TARGET_BOARD')") &&
    js.includes("values.get('TARGET_SUBTARGET')") &&
    js.includes("values.get('TARGET_PROFILE')") &&
    readFileSync(join(ROOT, 'tools', 'parse-request.mjs'), 'utf8').includes('const actualDevices = actualTarget.filter');
  menuconfigImportOk
    ? ok('原生 menuconfig 配置可按设备选择行识别和提交,不依赖派生目标签名或插件')
    : bad('menuconfig import contract', '网页或 Actions 的原生设备选择行兼容逻辑缺失');
  const customTargetContract = js.includes('function customDeviceFromConfig') &&
    js.includes("id: 'custom-target'") &&
    js.includes('async function selectImportedTarget') &&
    js.includes('importedTargetVerified = false') &&
    parser.includes("['custom-target', 'catalog-target'].includes(req.device)") &&
    buildWorkflow.includes('cp submitted.config openwrt/.config') &&
    buildWorkflow.includes('use_defconfig=') &&
    buildWorkflow.includes('make defconfig 2>&1 | tee') &&
    !buildWorkflow.includes('verify-defconfig.mjs');
  customTargetContract
    ? ok('未收录 .config → Custom Target → Issue/Actions 直接配置链路已接通')
    : bad('custom target contract', '网页兜底、解析器、Issue 校验或 Actions 直接配置参数缺失');
  const importedWorkspaceContract = html.includes('id="importWorkspace"') &&
    html.includes('id="importUnknownBox"') &&
    js.includes('function importedConfigMeta') &&
    js.includes('function chooseImportedSourceBranch') &&
    js.includes("'source-branch-candidates'") &&
    !js.includes('配置没有记录分支，请选择') &&
    js.includes('function renderImportedWorkspace') &&
    js.includes('function applyImportedUnknownEdits') &&
    js.includes('[A-Za-z0-9_.+@-]+') &&
    js.includes('menuCatalogPromise') &&
    css.includes('.import-unknown-row') &&
    css.includes('.import-source-grid');
  importedWorkspaceContract
    ? ok('上传配置全源码/分支确认、Catalog-first 解析与未收录项编辑链已接通')
    : bad('imported config workspace', '全源码选择、导入工作区、真实包名解析或编辑补丁缺失');
  const readmes = readdirSync(join(ROOT, 'translations')).filter((name) => /^README\..+\.md$/.test(name));
  const zhReadme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  const zhHeadings = (zhReadme.match(/^#{1,3} /gm) || []).length;
  const badReadmes = readmes.filter((name) => {
    const text = readFileSync(join(ROOT, 'translations', name), 'utf8');
    return (text.match(/^#{1,3} /gm) || []).length !== zhHeadings ||
      !text.includes(`<!--plugin-count-->${pluginMeta.length}<!--/plugin-count-->`) ||
      !text.includes('build-request.json') || !text.includes('(UTC±HH:MM) Region/City');
  });
  readmes.length === 10 && badReadmes.length === 0
    ? ok('README:简中源 + 10 份译文结构与 D12 提交/时区说明齐全')
    : bad('README translations', `译文 ${readmes.length} 份,结构或新说明异常:${badReadmes.join(',')}`);
  const configFiles = walkFiles(join(ROOT, 'config'), '.config');
  const proxyDefaults = [];
  for (const file of configFiles) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (PROXY_PACKAGE_RE.test(lines[i])) proxyDefaults.push(`${file.replace(ROOT, '.')}：${i + 1} ${lines[i]}`);
    }
  }
  proxyDefaults.length === 0
    ? ok(`base config: ${configFiles.length} 份,默认代理 CONFIG_PACKAGE =y/m 为 0`)
    : bad('base config 代理默认值', proxyDefaults.slice(0, 5).join(' | '));
  const ledeSeedFiles = configFiles.filter((file) => /[\\/]lede-master-[^\\/]+\.config$/.test(file));
  const ledeSeedTlsMismatch = ledeSeedFiles.filter((file) => {
    const config = readFileSync(file, 'utf8');
    return !config.includes('CONFIG_PACKAGE_luci-ssl-openssl=y') || config.includes('CONFIG_PACKAGE_luci-ssl=y');
  });
  ledeSeedFiles.length > 0 && ledeSeedTlsMismatch.length === 0
    ? ok(`LEDE seed configs: ${ledeSeedFiles.length} use luci-ssl-openssl to avoid the default OpenSSL conflict`)
    : bad('LEDE seed TLS choice', `files ${ledeSeedFiles.length}, mismatched ${ledeSeedTlsMismatch.length}`);
  const manifest = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'config-manifest.json'), 'utf8'));
  const expected = [];
  for (const device of dev.devices.filter((item) => item.enabled)) {
    for (const source of device.sources) {
      for (const version of source.versions) {
        for (const variant of source.variants.filter((item) => !item.versions || item.versions.includes(version.id))) {
          expected.push([device.id, source.id, version.id, variant.id].join('/'));
        }
      }
    }
  }
  const missingConfigs = expected.filter((id) => !manifest.configs[id]);
  const extraConfigs = Object.keys(manifest.configs).filter((id) => !expected.includes(id));
  missingConfigs.length === 0 && extraConfigs.length === 0
    ? ok(`config manifest: ${expected.length} 个精确 device/source/version/variant 组合`)
    : bad('config-manifest.json', `缺 ${missingConfigs.length},多 ${extraConfigs.length}`);
  const manifestRows = Object.values(manifest.configs);
  const manifestPathsOk = manifestRows.every((row) =>
    typeof row.sourcePath === 'string' && existsSync(join(ROOT, row.sourcePath)) &&
    !Object.prototype.hasOwnProperty.call(row, 'publicPath'));
  manifestPathsOk
    ? ok('config manifest:仅保留存在的权威 sourcePath，公共 publicPath 已退役')
    : bad('config manifest paths', '存在缺失 sourcePath、无效文件或残留 publicPath');
  const publicDataRoot = join(ROOT, 'site', 'wrt', 'data');
  const publicConfigFiles = walkFiles(publicDataRoot, '.config');
  const publicDataDirs = readdirSync(publicDataRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const expectedPublicDataDirs = [
    'seed',
    ...dev.devices
      .filter((device) => device.enabled === true && device.plugins !== 'seed')
      .map((device) => device.id),
  ].sort();
  const publicDataContract = publicConfigFiles.length === 0 &&
    JSON.stringify(publicDataDirs) === JSON.stringify(expectedPublicDataDirs) &&
    !genPlugins.includes('copyFileSync') && !genPlugins.includes('publicPath:');
  publicDataContract
    ? ok('网页 data:仅保留 seed/360t7 插件索引，公共 .config 副本为 0')
    : bad('public data retirement', `config=${publicConfigFiles.length}, dirs=${publicDataDirs.join(',')}`);
  const issueForm = readFileSync(join(ROOT, '.github', 'ISSUE_TEMPLATE', 'custom-build.yml'), 'utf8');
  const workflow = readFileSync(join(ROOT, '.github', 'workflows', 'custom-build.yml'), 'utf8')
    .replace(/\r\n/g, '\n');
  const issueRequestReader = readFileSync(join(ROOT, 'tools', 'fetch-build-request.mjs'), 'utf8');
  const cancelWorkflow = readFileSync(join(ROOT, '.github', 'workflows', 'cancel-build.yml'), 'utf8')
    .replace(/\r\n/g, '\n');
  const versionWorkflow = readFileSync(join(ROOT, '.github', 'workflows', 'site-version.yml'), 'utf8');
  const versionStamper = readFileSync(join(ROOT, 'tools', 'stamp-site-version.mjs'), 'utf8');
  const requestParser = readFileSync(join(ROOT, 'tools', 'parse-request.mjs'), 'utf8');
  const genericDiy = readFileSync(join(ROOT, 'Shell', 'diy2-generic.sh'), 'utf8');
  const mirrorDiy = readFileSync(join(ROOT, 'Shell', 'apply-package-mirror.sh'), 'utf8');
  const mirrorEngine = readFileSync(join(ROOT, 'tools', 'package-mirror-engine.mjs'), 'utf8');
  const mirrorGenerator = readFileSync(join(ROOT, 'tools', 'gen-package-mirrors.mjs'), 'utf8');
  const issueFieldIds = [...issueForm.matchAll(/^\s+id:\s*([A-Za-z0-9_-]+)\s*$/gm)].map((m) => m[1]);
  const issueFormIsSingleAttachment = issueFieldIds.length === 1 && issueFieldIds[0] === 'request';
  const contractOk = issueForm.includes('build-request.json') &&
    issueForm.includes('config.buildinfo') &&
    issueFormIsSingleAttachment &&
    workflow.includes('tools/fetch-build-request.mjs') &&
    workflow.includes('cp submitted.config openwrt/.config') &&
    !workflow.includes('authoritative_config') &&
    !workflow.includes('build-config.mjs');
  contractOk
    ? ok('Issue attachment → submitted.config → openwrt/.config 权威链路已接通')
    : bad('Issue attachment contract', `Issue 表单或 workflow 关键链路缺失；字段=${issueFieldIds.join(',') || '(无)'}`);
  const mobileIssueContract = js.includes('function mobileIssuePayload') &&
    js.includes('WEIG_BUILD_REQUEST_GZIP_BASE64') &&
    issueRequestReader.includes('WEIG_BUILD_REQUEST_GZIP_BASE64') &&
    issueRequestReader.includes('gunzipSync') && workflow.includes('mobile request');
  mobileIssueContract
    ? ok('手机 GitHub App 正文压缩请求 → 权威 config 校验链已接通')
    : bad('mobile Issue request contract', '网页压缩载荷、Actions 解压或工作流入口缺失');
  const issueEventBodyContract = issueRequestReader.includes('GITHUB_EVENT_PATH') &&
    issueRequestReader.includes("event.issue?.body") &&
    workflow.includes("if: always() && steps.req.outcome == 'success'");
  issueEventBodyContract
    ? ok('Issue 事件正文从 GITHUB_EVENT_PATH 读取，解析失败前不上传空 CONFIG artifact')
    : bad('Issue event payload contract', '事件正文回退或 CONFIG artifact 门禁缺失');
  const issueEventFixtureRoot = mkdtempSync(join(tmpdir(), 'weig-issue-event-body-'));
  try {
    const requestText = JSON.stringify({
      schema: 5,
      config: 'CONFIG_TARGET_x86=y\nCONFIG_TARGET_x86_64=y\n',
    }) + '\n';
    const attachmentUrl = 'https://github.com/user-attachments/files/123456/build-request.json';
    const eventPath = join(issueEventFixtureRoot, 'event.json');
    const manifestPath = join(issueEventFixtureRoot, 'request-attachments.json');
    const requestDir = join(issueEventFixtureRoot, 'request-attachments');
    const preloadPath = join(issueEventFixtureRoot, 'mock-fetch.mjs');
    writeFileSync(eventPath, JSON.stringify({
      action: 'opened',
      issue: { body: `### Build request\n\n[build-request.json](${attachmentUrl})\n` },
    }));
    writeFileSync(preloadPath, [
      `const payload = ${JSON.stringify(requestText)};`,
      "const bytes = Buffer.from(payload, 'utf8');",
      "globalThis.fetch = async () => ({ ok: true, status: 200, headers: { get: (name) => name === 'content-length' ? String(bytes.length) : null }, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });",
      '',
    ].join('\n'));
    const issueEventRun = spawnSync(process.execPath, [
      '--import',
      pathToFileURL(preloadPath).href,
      join(ROOT, 'tools', 'fetch-build-request.mjs'),
    ], {
      cwd: issueEventFixtureRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        ISSUE_BODY: '',
        GITHUB_EVENT_PATH: eventPath,
        REQUEST_MANIFEST_OUT: manifestPath,
        REQUEST_DIR: requestDir,
      },
    });
    const fixtureManifest = issueEventRun.status === 0 && existsSync(manifestPath)
      ? JSON.parse(readFileSync(manifestPath, 'utf8'))
      : null;
    issueEventRun.status === 0 && fixtureManifest?.files?.length === 1 &&
        fixtureManifest.files[0].type === 'json'
      ? ok('Issue event fixture: attachment body is discovered without ISSUE_BODY env injection')
      : bad('Issue event fixture', (issueEventRun.stderr || issueEventRun.stdout || 'manifest missing').trim().slice(0, 500));
  } catch (error) {
    bad('Issue event fixture', error.message.slice(0, 300));
  } finally {
    rmSync(issueEventFixtureRoot, { recursive: true, force: true });
  }
  const artifactContract = [
    'actions/upload-artifact@v7',
    'actions/download-artifact@v8',
    'archive: false',
    'firmware_matrix ||',
    '-RAW-BRIDGE',
    '-FIRMWARE-OTHER',
    '-CONFIG',
    '-BUILD-LOGS',
    '-OPTIONAL-PACKAGES',
    'tools/collect-optional-packages.mjs',
    'retention-days: 14',
    'retention-days: 30',
    'artifact_id:',
  ];
  const obsoleteArtifactContract = ['FIRMWARE-ALL', 'artifact_tail'];
  artifactContract.every((token) => workflow.includes(token)) &&
      obsoleteArtifactContract.every((token) => !workflow.includes(token)) &&
      obsoleteArtifactContract.every((token) => !requestParser.includes(token))
    ? ok('Actions 独立 .img.gz、分类资料、桥接清理与 14/30 天保留期已接通')
    : bad('Actions artifact contract', '独立固件发布、分类、清理或旧产物链仍有问题');
  const firmwareSettingsContract = workflow.includes('ISSUE_TITLE: ${{ github.event.issue.title }}') &&
    workflow.includes('Apply package mirror / 应用软件包镜像（APK/OPKG）') &&
    workflow.includes('Verify firmware settings / 核验固件设置') &&
    workflow.includes('package-mirror-report.json') &&
    workflow.includes('package_mirror_requested=') &&
    workflow.includes('package_mirror_effective=') &&
    workflow.includes('test -s "openwrt/files/etc/uci-defaults/10-weig-system" ||') &&
    workflow.includes('10-weig-timezone') &&
    requestParser.includes('const buildRef = requestRef ? `${requestRef}-${tag}` : tag;') &&
    requestParser.includes('固件设置快照不一致') &&
    requestParser.includes('fw.packageMirror || fw.opkg') &&
    requestParser.includes('package_mirror_id=') &&
    !requestParser.includes('opkg_mirror=') &&
    !requestParser.includes('CONFIG_PACKAGE_${theme}=y') &&
    !workflow.includes('所选主题未保留') &&
    genericDiy.includes("luci.main.mediaurlbase") &&
    !genericDiy.includes('apply-package-mirror.sh') &&
    mirrorDiy.includes('WRT_PACKAGE_MIRROR_ID') &&
    mirrorDiy.includes('package_mirror_requested=') &&
    mirrorDiy.includes('return 0') &&
    mirrorEngine.includes('CONFIG_USE_APK') &&
    mirrorEngine.includes('FeedSourcesAppendAPK') &&
    mirrorEngine.includes('FeedSourcesAppendOPKG') &&
    mirrorEngine.includes('commitChanges(stage.changed)') &&
    mirrorGenerator.includes('package mirror projection is current') &&
    !workflow.includes('WRT_OPKG_MIRROR') && !workflow.includes('steps.req.outputs.opkg_');
  firmwareSettingsContract
    ? ok('请求编号、APK/OPKG 镜像报告与时区/主题/NTP 固件内审计链已接通')
    : bad('firmware settings contract', '请求编号、镜像框架、固件快照或旧 opkg 传递链仍有问题');
  const upstreamConfigContract =
    !workflow.includes('config-overrides.json') &&
    !workflow.includes('config-overrides.diff') &&
    !workflow.includes('CONFIG_DEVEL=y') &&
    !workflow.includes('CONFIG_BUILD_LOG=y') &&
    workflow.includes('config_policy=upstream-defconfig') &&
    workflow.includes('config_policy=authoritative-no-defconfig');
  upstreamConfigContract
    ? ok('配置元数据只记录官方 Defconfig 或权威原配置，不再记录系统覆盖')
    : bad('upstream config metadata', '仍有系统覆盖字段或缺少官方配置策略标记');
  const liveLogContract = workflow.includes('JOBS=$(( $(nproc) + 1 ))') &&
    workflow.includes('stdbuf -oL -eL make download -j"$JOBS" 2>&1 |') &&
    workflow.includes('stdbuf -oL -eL make -j"$JOBS" 2>&1 |') &&
    workflow.includes('tee "$GITHUB_WORKSPACE/download.log"') &&
    workflow.includes('tee "$GITHUB_WORKSPACE/build.log"') &&
    (workflow.match(/make download/g) || []).length === 1 &&
    workflow.includes('- name: Upload complete logs / 上传完整日志\n        if: always()') &&
    !workflow.includes('ci-log-filter.awk') &&
    !workflow.includes('compile_retry') &&
    workflow.includes('make -j1 V=s BUILD_LOG=1') &&
    workflow.includes('build-diagnostic.log');
  liveLogContract
    ? ok('Actions 下载/编译 CPU+1 动态并发、原始实时日志与失败单线程诊断已接通')
    : bad('Actions live log contract', '动态并发、逐行 tee、单次下载、失败诊断或旧过滤清理不完整');
  const buildLimitContract = workflow.includes('MAX_BUILDS_PER_USER') &&
    workflow.includes('Build admission refused') &&
    workflow.includes('const requester = context.payload.issue.user.login;') &&
    workflow.includes('const isRepositoryOwner = requester.toLowerCase() === context.repo.owner.toLowerCase();') &&
    workflow.includes('`owner-${context.runId}`') &&
    workflow.includes('Repository owner build admitted without queue') &&
    workflow.includes('custom-build-user-${{ needs.admission.outputs.requester }}-${{ needs.admission.outputs.slot }}') &&
    workflow.includes('cancel-in-progress: false') &&
    !/^\s+queue:/m.test(workflow) &&
    workflow.includes('/cancel') &&
    cancelWorkflow.includes('issue_comment:') &&
    cancelWorkflow.includes("['/cancel', '/cancel-build']") &&
    cancelWorkflow.includes('commenter.toLowerCase() !== requester.toLowerCase()') &&
    cancelWorkflow.includes('cancelWorkflowRun') &&
    cancelWorkflow.includes('force-cancel');
  buildLimitContract
    ? ok('仓库主免排队、每用户构建上限、Issue 自助取消与强制取消兜底已接通')
    : bad('per-user build control', '仓库主绕过、准入上限、分槽并发或 Issue 作者取消链路缺失');
  const loadCatalogStart = js.indexOf('async function loadCatalog(');
  const loadCatalogEnd = js.indexOf('function initialCatalogTargetRequest()', loadCatalogStart);
  const loadCatalogBody = loadCatalogStart >= 0 && loadCatalogEnd > loadCatalogStart
    ? js.slice(loadCatalogStart, loadCatalogEnd) : '';
  const catalogTargetBeforePresets =
    loadCatalogBody.indexOf('renderCatalogPicker(false') >= 0 &&
    loadCatalogBody.indexOf('await applyCatalogTarget()') > loadCatalogBody.indexOf('renderCatalogPicker(false') &&
    loadCatalogBody.indexOf('await applyCatalogStartupPresets()') > loadCatalogBody.indexOf('await applyCatalogTarget()') &&
    !loadCatalogBody.includes('applyDefaultCatalogTheme();') &&
    !loadCatalogBody.includes('applyMinimumBootPreset(false)') &&
    js.includes('async function applyCatalogStartupPresets()') &&
    js.includes("console.error('[Catalog startup presets failed]', error)");
  catalogTargetBeforePresets
    ? ok('Catalog startup order: establish Target/Profile before target-sensitive defaults, with preset rollback')
    : bad('Catalog startup order', 'Target/Profile must be established before theme/minimum-boot defaults');
  const menuconfigContract = html.includes('id="menuconfigGrid"') &&
    js.includes('menuCatalogAbortController?.abort()') &&
    js.includes('menuIndexAbortController?.abort()') &&
    js.includes('promptZh') &&
    js.includes("branch.state === 'unavailable'") &&
    css.includes('.catalog-stale') &&
    js.includes("option.type === 'tristate' ? ['n', 'm', 'y']") &&
    js.includes('function showMenuHelp') &&
    js.includes('function setCatalogLoadState') &&
    js.includes('function retryCatalogLoad') &&
    js.includes("setCatalogLoadState('loading')") &&
    js.includes("setCatalogLoadState('error', error, diagnostics)") &&
    js.includes("setCatalogLoadState('idle')") &&
    !js.includes('translation.usage, packageMeta') &&
    js.includes('function renderMenuOption(option)') &&
    js.includes("id.className = 'menuconfig-option-label menuconfig-option-id'") &&
    js.includes('id.textContent = packageName || option.symbol') &&
    js.includes("description.className = 'menuconfig-option-label menuconfig-option-description'") &&
    js.includes('function showMenuOptionTooltip(element)') &&
    js.includes('menuOptionPopupText(element)') &&
    js.includes('`CONFIG_${element.dataset.symbol}`') &&
    js.includes("element.dataset.path || ''") &&
    !js.includes('clippedDescription') &&
    !js.includes('function renderMenuOption(option, showPath') &&
    js.includes("'N: Disabled; not built.") &&
    js.includes('function openMenuChildren') &&
    js.includes('function renderMenuLeaf') &&
    js.includes('menuChildrenByParent') &&
    js.includes('menuSelectedExpanded') &&
    js.includes('function kconfigExpr') &&
    css.includes('.menuconfig-selected-toggle') &&
    css.includes('.menuconfig-workspace') &&
    css.includes('.menuconfig-scroll') &&
    css.includes('.menuconfig-breadcrumb-link') &&
    css.includes('.catalog-locator-results') &&
    css.includes('.menu-tooltip') &&
    css.includes('.menu-fit-s3') &&
    css.includes('.menu-fit-two-line') &&
    css.includes('.menuconfig-grid{grid-template-columns:minmax(0,1fr)}') &&
    css.includes('.menuconfig-option-summary{display:grid;grid-template-columns:minmax(120px,220px) auto minmax(0,1fr)') &&
    css.includes('.menuconfig-option-id{font:650 13px ui-monospace') &&
    css.includes('.menuconfig-option-description{text-align:right') &&
    css.includes('.menuconfig-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:nowrap') &&
    !css.includes('.menuconfig-package-desc') &&
    !css.includes('.menuconfig-prompt') && !css.includes('.menuconfig-option-name') &&
    css.includes('.menuconfig-choice') &&
    css.includes('.menuconfig-state-help') &&
    css.includes('.catalog-load-spinner') &&
    css.includes('@keyframes catalog-spin') &&
    css.includes('.menuconfig-child') &&
    js.includes('function fmtSize(mb)') &&
    js.includes('Math.floor(Math.log10(Math.abs(number)))') &&
    formatSizeContract(0.00048828125) === '512 B' &&
    formatSizeContract(0.5) === '512 KB' &&
    formatSizeContract(1) === '1.00 MB' &&
    formatSizeContract(12.34) === '12.3 MB' &&
    formatSizeContract(123.4) === '123 MB' &&
    formatSizeContract(1023) === '0.999 GB' &&
    existsSync(join(ROOT, 'site', 'wrt', 'data', 'menuconfig-index.json'));
  menuconfigContract
    ? ok('多源码 Catalog → 名称搜索、单行 ID/描述、完整 CONFIG/译文/路径悬浮与面包屑已接通')
    : bad('menuconfig catalog contract', '动态 Target、名称搜索、ID/描述单行、悬浮详情、面包屑或 choice 缺失');
    const catalogSchema6PerformanceContract =
      catalogLoaderJs.includes('branch.assets?.core && branch.assets?.graph') &&
      catalogLoaderJs.includes('const [core, graph] = await Promise.all') &&
      catalogLoaderJs.includes('const loadShard = async (logical') &&
      catalogLoaderJs.includes('Catalog split assets do not satisfy schema 6 / relations 3') &&
      catalogSchema6Js.includes('export function createRuntimeMenu') &&
      catalogSchema6Js.includes('export function mergeMenuShards') &&
      catalogSchema6Js.includes('export function mergeHiddenShard') &&
      catalogSchema6Js.includes('export function applyHelpShard') &&
      js.includes('async function ensureCatalogMenuLoaded(includeHidden = false)') &&
      js.includes("loader?.('menu')") &&
      js.includes("loader?.('hidden')") &&
      js.includes("loader?.('help')") &&
      js.includes('catalogStateRevision++') &&
      js.includes('catalogContextCache') &&
      js.includes('menuVisibilityCache') &&
      js.includes('menuMaxLevelCache') &&
      js.includes('startCatalogSearchWorker()') &&
      js.includes("new Worker('./lib/catalog-search-worker.js?v=") &&
      js.includes('searchPending = matches === null') &&
      catalogSearchWorkerJs.includes('function intersectSorted') &&
      catalogSearchWorkerJs.includes("message.type === 'query'") &&
      catalogSearchWorkerJs.includes("self.postMessage({ type: 'ready'");
    catalogSchema6PerformanceContract
      ? ok('Catalog schema 6: core/graph initial load, lazy display shards, revision caches and worker search are connected')
      : bad('Catalog schema 6 performance contract', 'split loading, compact graph, lazy shards, caches or worker search is incomplete');
    const catalogBuildContractSeparation =
      catalogLoaderJs.includes('export function legacyCatalogContract(branch)') &&
      catalogLoaderJs.includes('Catalog index lacks an explicit legacy build/bundle contract') &&
      js.includes('const legacy = CATALOG_LOADER_MODULE.legacyCatalogContract(branch)') &&
      js.includes('catalogSchema: legacy.catalogSchema') &&
      js.includes('relationsSchema: legacy.relationsSchema') &&
      !js.includes('catalogSchema: Number(MENU_CATALOG?.schema') &&
      !js.includes('relationsSchema: Number(MENU_CATALOG?.relations?.schema') &&
      parser.includes('function legacyCatalogContract(branch)') &&
      parser.includes('const indexedLegacy = legacyCatalogContract(indexedBranch)') &&
      parser.includes('固定 Catalog index 与请求的 legacy 契约不一致') &&
      !parser.includes('active-catalog.json') &&
      !parser.includes('gunzipSync') &&
      !parser.includes('actualCatalogSchema');
    catalogBuildContractSeparation
      ? ok('Catalog build contract: schema-6 runtime and schema-5 legacy validation assets are separated')
      : bad('Catalog build contract separation', 'runtime schema leaked into build request or legacy index/parser guards are missing');
    const buildContractUi = html.includes('id="buildContract"') &&
      html.includes('id="buildContractToggle"') &&
      html.includes('aria-expanded="false" aria-controls="buildContractBody"') &&
      html.includes('id="buildContractBody" hidden') &&
      html.includes('id="buildContractGrid"') &&
      js.includes('function renderBuildContract()') &&
      js.includes('function setBuildContractExpanded(expanded)') &&
      js.includes('boardSelector') &&
      js.includes('CONFIG_${boardSelector}=y') &&
      js.includes("arch: String(target.arch || '').trim()") &&
      js.includes('archPackages: String(target.archPackages ||') &&
      js.includes('CONFIG_ARCH=') &&
      js.includes('CONFIG_TARGET_ARCH_PACKAGES') &&
      js.includes('function renderProfilePackageModal()') &&
      js.includes('function applyProfilePackageOverrides(text)') &&
      !js.includes('enforceCatalogProfilePackages') &&
      parser.includes("const actualBoard = configStringValue(submittedConfig, 'TARGET_BOARD')") &&
      parser.includes("const actualSubtarget = configStringValue(submittedConfig, 'TARGET_SUBTARGET')") &&
      parser.includes('actualDeviceSymbols.length !== 1') &&
      parser.includes('actualDeviceSymbols[0] !== expectedSelector') &&
      parser.includes('Target/Profile 身份不一致') &&
      !parser.includes('CONFIG_ARCH 与 Catalog 不一致') &&
      !parser.includes('CONFIG_TARGET_ARCH_PACKAGES 与 Catalog 不一致') &&
      buildWorkflow.includes('catalog_arch') &&
      buildWorkflow.includes('catalog_arch_packages');
    buildContractUi
      ? ok('Catalog Target 构建契约:架构/必需包/主屏信息与 Actions 校验已接通')
      : bad('Catalog build contract', '架构、Profile 必需包、主屏信息或 Issue/Actions 校验缺失');
    const catalogSelectionLayerContract =
      html.includes('id="menuconfigOriginFilter"') &&
      html.includes('<option value="excluded"') &&
      !html.includes('<option value="target"') &&
      html.includes('<option value="dependency"') &&
      js.includes('const catalogBaselineValues = new Map()') &&
      js.includes('const catalogRecommendedValues = new Map()') &&
      js.includes('const catalogUserOverrides = new Map()') &&
      js.includes('const catalogImportedSymbols = new Set()') &&
      js.includes('const catalogDependencySymbols = new Set()') &&
      js.includes('function initializeCatalogBaseline()') &&
      js.includes('function catalogOriginMeta(option)') &&
      js.includes('function catalogSelectionSummary()') &&
      js.includes('function restoreCatalogDefault(option)') &&
      js.includes("evaluated.status === 'satisfied'") &&
      js.includes('resetCatalogSelectionLayers();') &&
      js.indexOf('state.device = device;') < js.indexOf('initializeCatalogBaseline();', js.indexOf('async function applyCatalogTarget()')) &&
      js.includes("if (source !== 'user') return true") &&
      js.includes('!catalogUserOverrides.has(option.symbol)') &&
      js.includes('const value = catalogUserOverrides.get(option.symbol)') &&
      js.includes("if (source === 'user' && explicit) catalogUserOverrides.set(change.symbol, change.to)") &&
      js.includes("else if (source === 'recommended' && explicit) catalogRecommendedValues.set(change.symbol, change.to)") &&
      js.includes("else catalogDependencySymbols.add(change.symbol)") &&
      js.includes('const profilePackageOverrides = new Map()') &&
      js.includes('function renderProfilePackageModal()') &&
      js.includes('function profilePackageMode(packageName)') &&
      js.includes('profilePackageOverrides.has(packageName)') &&
      js.includes('catalogUserOverrides.has(option.symbol)') &&
      !js.includes("origin: 'target'") && !js.includes("origin: 'profile-add'") &&
      js.includes('catalogUserOverrides.delete(option.symbol)') &&
      js.includes('catalogInheritedValue(option.symbol)') &&
      js.includes("else if (menuOriginFilter !== 'all')") &&
      js.includes('options = eligibleOptions') &&
      js.includes('const matches = searchMenuOptions(query)') &&
      js.includes('options = (matches || []).filter(eligible)') &&
      js.includes("contractText('源码', 'Source')") &&
      js.includes("contractText('Profile', 'Profile')") &&
      css.includes('.catalog-origin') &&
      css.includes('.menuconfig-restore-default') &&
      css.includes('.flag-origin');
    catalogSelectionLayerContract
      ? ok('Catalog 选择状态已分为基础/推荐/用户覆盖/依赖/导入层；首次用户插件计数不再吸收上游默认')
      : bad('Catalog selection layers', '状态分层、deferred 默认、来源筛选、恢复默认或用户计数隔离不完整');
    const versionContract = versionWorkflow.includes('"site/wrt/**"') &&
    versionWorkflow.includes('"VERSION"') &&
    versionWorkflow.includes("github.actor != 'github-actions[bot]'") &&
    versionWorkflow.includes('permissions:') &&
    versionWorkflow.includes('contents: write') &&
    versionWorkflow.includes('tools/stamp-site-version.mjs') &&
    versionWorkflow.includes('site/wrt/data/site-version.json') &&
    versionWorkflow.includes('git add VERSION site/wrt/data/site-version.json') &&
    versionStamper.includes('vYYMMDDHHmm') &&
    versionStamper.includes("const ROOT_VERSION = join(ROOT, 'VERSION')") &&
    versionStamper.includes('writeFileSync(ROOT_VERSION, version') &&
    versionStamper.includes("minute: '2-digit'") &&
    versionStamper.includes("timeZone: 'Asia/Shanghai'") &&
    versionStamper.includes("timezone: 'Asia/Shanghai'") &&
    versionStamper.includes('^v\\d{10}$') &&
    requestParser.includes('v\\d{8}(?:\\d{2})?') &&
    js.includes('^v\\d{10}$') &&
    html.indexOf('id="siteVersion"') > html.indexOf('id="submitBtn"') &&
    !html.includes('id="siteVersionMobile"') &&
    !html.includes('id="siteVersionFooter"') &&
    css.includes('.site-version-action { order: 0; }') &&
    css.includes('.site-version-action { order: 3;');
  versionContract
    ? ok('根 VERSION/网页副本共用分钟版本、旧八位兼容与双端显示已接通')
    : bad('site version contract', '分钟时间戳、旧版兼容、Actions 防循环或双端显示位置缺失');
  const selfTestContract = js.includes("const path2 = 'seed/plugins.json'") &&
    js.includes("state.device?.id === 'catalog-target'") &&
    js.includes("state.device?.id === 'custom-target' && state.importedConfig") &&
    js.includes('const text = await generateResolvedConfigText()') &&
    js.includes('const targets = targetLines(text)') &&
    js.includes('function safeDownloadNamePart') &&
    js.includes('function selectedTargetProfileName') &&
    js.includes('function selectedTargetProfileLabel') &&
    js.includes('function requestTargetProfilePart') &&
    js.includes("const title = '[build] ' + requestStamp + '/' + titleTag + '/' + requestTargetProfilePart() + '/' + state.source.id + '/' + state.version.id + '/' + selectedTargetProfileName()") &&
    js.includes("const filename = [requestStamp, requestTargetProfilePart(true), safeDownloadNamePart(state.source.id, 'source')");
  selfTestContract
    ? ok('网页自检使用 Catalog/上传配置与真实 .config 生成演算')
    : bad('web self-test contract', '种子数据路径、Catalog/上传配置或真实生成演算缺失');
  const catalogEngineUiContract = !html.includes('id="devpkgToggle"') &&
    !js.includes('devPkgs') && !js.includes('PKGDATA') &&
    js.includes("import('./lib/catalog-engine.js?v=") &&
    js.includes('menuSearchOptions = [...options, ...hiddenOptions]') &&
    js.includes('CATALOG_ENGINE.applyUserIntent') &&
    !js.includes('CATALOG_ENGINE.proposeRepairs') &&
    !js.includes('repairCatalogConfiguration') &&
    js.includes('catalogProtectedSymbols') &&
    js.includes('dependencySymbols: catalogDependencySymbols') &&
    js.includes('protectedSymbols: catalogProtectedSymbols') &&
    js.includes('function renderProfilePackageModal()') &&
    js.includes('function applyProfilePackageOverrides(text)') &&
    js.includes("id.textContent = packageName || option.symbol") &&
    js.includes('menuconfig-option-description') &&
    js.includes('`CONFIG_${element.dataset.symbol}`') &&
    js.includes(".join(' › ')") &&
    js.includes('schema: 5') &&
    !buildWorkflow.includes('validate-catalog-config.mjs') &&
    !requestParser.includes('validateConfig(') &&
    !requestParser.includes('createCatalogValidationContext(') &&
    !requestParser.includes('matchingConfigRules(') &&
    buildWorkflow.includes('steps.req.outputs.source_commit');
  catalogEngineUiContract
    ? ok('Advanced 与普通插件共用 Catalog 依赖引擎；Profile 包和完整悬浮信息已接通')
    : bad('Catalog engine UI/CI contract', '依赖引擎、Profile 包、悬浮信息或 post-defconfig 清理不完整');
  const catalogEngineSource = readFileSync(join(ROOT, 'site', 'wrt', 'lib', 'catalog-engine.js'), 'utf8');
  const catalogMatrixSource = readFileSync(join(ROOT, 'tools', 'test-catalog-engine.mjs'), 'utf8');
  const enginePackageLiteral = /[\"'`]PACKAGE_[A-Za-z0-9_.+@-]+[\"'`]/.test(catalogEngineSource);
  const standardizedContextContract =
    catalogEngineSource.includes("status: 'deferred'") &&
    catalogEngineSource.includes('createCatalogValidationContext') &&
    catalogEngineSource.includes('trustedSymbols') &&
    !catalogEngineSource.includes("phase === 'post-defconfig'") &&
    catalogEngineSource.includes('beforeKeys') &&
    catalogEngineSource.includes('function pruneUnusedDependencies') &&
    catalogEngineSource.includes("'dependency-unused'") &&
    !catalogEngineSource.includes('applyAuthoritativeValues') &&
    !catalogEngineSource.includes('proposeRepairs') &&
    catalogMatrixSource.includes('unused automatically selected dependency was not pruned') &&
    catalogMatrixSource.includes('shared dependency was incorrectly pruned') &&
    catalogMatrixSource.includes('explicitly protected dependency was incorrectly pruned') &&
    catalogMatrixSource.includes('weak imply relationship was incorrectly treated') &&
    !catalogMatrixSource.includes('validate-catalog-config.mjs') &&
    !enginePackageLiteral;
  standardizedContextContract
    ? ok('Catalog 引擎只执行正式强依赖/select，支持反向关闭与安全清理孤立自动依赖')
    : bad('standardized Catalog context', '依赖清理、共享保护、imply 边界、post 模式删除或通用性测试缺失');
  const meta = JSON.parse(readFileSync(join(ROOT, 'tools', 'plugins-meta.json'), 'utf8'));
  const sizes = JSON.parse(readFileSync(join(ROOT, 'tools', 'plugin-sizes.json'), 'utf8'));
  const sizeEntries = Object.entries(sizes.plugins || {});
  const knownIds = new Set(meta.plugins.map((plugin) => plugin.id));
  const invalidSizes = sizeEntries.filter(([id, kb]) => !knownIds.has(id) || !Number.isFinite(kb) || kb <= 0);
  const t7Plugins = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', '360t7', 'plugins.json'), 'utf8')).plugins;
  const seedPlugins = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'seed', 'plugins.json'), 'utf8')).plugins;
  const expectedMB = (plugin) => sizes.plugins[plugin.id] === undefined
    ? plugin.size : Math.round(sizes.plugins[plugin.id] / 1.024) / 1000;
  const t7SizeMismatch = meta.plugins.filter((plugin) => {
    const generated = t7Plugins.find((item) => item.id === plugin.id);
    return !generated || generated.size !== expectedMB(plugin);
  });
  const seedSizeMismatch = meta.plugins.filter((plugin) => {
    const generated = seedPlugins.find((item) => item.id === plugin.id);
    return !generated || generated.size !== plugin.size;
  });
  sizes.version === 1 && sizes.device === '360t7' && sizes.arch === 'aarch64_cortex-a53' &&
    sizeEntries.length === 218 && invalidSizes.length === 0 &&
    t7SizeMismatch.length === 0 && seedSizeMismatch.length === 0
    ? ok('plugin sizes: 360T7 真实值 218 项 + 人工回退 8 项;种子机型保持人工估算')
    : bad('plugin-sizes.json', `条目 ${sizeEntries.length},非法 ${invalidSizes.length},360T7 不符 ${t7SizeMismatch.length},种子不符 ${seedSizeMismatch.length}`);
} catch (e) { bad('consistency', e.message.slice(0, 80)); }

console.log(fail ? `\n共 ${fail} 个问题,请修复 / ${fail} problem(s) found` : '\n全部通过 / all checks passed');
process.exit(fail ? 1 : 0);
