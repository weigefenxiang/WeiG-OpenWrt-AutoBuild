#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256File } from './site-release.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_POLICY = join(ROOT, '.github', 'automation-policy.json');

function cleanString(value) {
  return String(value ?? '').trim();
}

export function normalizeStandaloneSuffixes(value) {
  if (!Array.isArray(value)) throw new Error('buildArtifacts.standaloneSuffixes must be an array');
  const suffixes = value.map(cleanString);
  for (const suffix of suffixes) {
    if (!/^\.[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/.test(suffix)) {
      throw new Error(`invalid standalone artifact suffix: ${suffix || '(empty)'}`);
    }
  }
  if (new Set(suffixes).size !== suffixes.length) {
    throw new Error('buildArtifacts.standaloneSuffixes contains duplicate values');
  }
  return suffixes;
}

export function readArtifactPublishPolicy(path = DEFAULT_POLICY) {
  const policy = JSON.parse(readFileSync(path, 'utf8'));
  if (Number(policy?.schema) !== 1) throw new Error('automation policy schema 1 is required');
  return {
    schema: 1,
    standaloneSuffixes: normalizeStandaloneSuffixes(policy?.buildArtifacts?.standaloneSuffixes),
  };
}

export function isStandaloneArtifact(name, suffixes) {
  const value = String(name ?? '');
  return normalizeStandaloneSuffixes(suffixes).some((suffix) => value.endsWith(suffix));
}

export function artifactRole(name, metadata = {}) {
  const value = String(name).toLowerCase();
  const type = String(metadata.type || '').toLowerCase();
  if (/(?:^|[-_.])(?:kernel|vmlinuz|u-boot|bootloader|dtb)(?:[-_.]|$)/.test(value)) return 'component';
  if (value.includes('rootfs')) return /\.tar(?:\.(?:gz|xz|zst))?$/.test(value) ? 'rootfs-archive' : 'rootfs-image';
  if (/\.(?:qcow2|vdi|vmdk|vhdx)$/.test(value)) return 'virtual-disk';
  if (type === 'sysupgrade' || value.includes('sysupgrade')) return 'sysupgrade';
  if (type === 'factory' || value.includes('factory')) return 'factory';
  if (/combined|sdcard|\.iso$/.test(value)) return 'disk-image';
  if (/initramfs|recovery/.test(value)) return 'recovery';
  return 'unknown-image';
}

const roles = {
  'disk-image': '整盘/启动镜像 / Disk or boot image',
  'virtual-disk': '虚拟机磁盘 / Virtual machine disk',
  factory: '首次刷机候选；核对机型说明 / Factory image; check device instructions',
  sysupgrade: '兼容布局下升级 / Upgrade only with a compatible flash layout',
  recovery: '临时启动/恢复；按上游说明 / Temporary boot or recovery; follow upstream instructions',
  'rootfs-image': '仅根分区；非完整固件 / Root filesystem only, not a complete disk image',
  'rootfs-archive': '根文件系统压缩包；用于解包/容器等，不直接整盘刷写 / Root filesystem archive; extract/import, not a whole-disk flash image',
  component: '内核/启动组件；非完整固件 / Kernel or boot component, not complete firmware',
  'unknown-image': '用途待确认；先查机型说明 / Unconfirmed role; check upstream device instructions',
};
const md = value => String(value).replace(/[|\r\n`<>]/g, ' ');
export function renderArtifactGuide(plan) {
  const rows = ['## 📦 Firmware download guide / 固件下载与安装选择', '',
    '| 文件 / File | 用途 / Use | 大小 / Size | SHA-256 |', '| --- | --- | --- | --- |'];
  for (const file of plan.standalone) rows.push(
    '| `' + md(file.name) + '` | ' + roles[file.role] + ' | ' + (file.bytes / 1048576).toFixed(2) + ' MiB | `' + file.sha256 + '` |');
  rows.push('', 'Each listed file is published as one Artifact. / 上列每个文件单独发布；相同校验值表示内容相同，不代表文件可互换刷写。', '',
    '> RootFS, kernel and bootloader files are not complete firmware. Verify the exact model, boot mode and flash layout. / RootFS、内核、引导组件不是完整固件；请核对机型、启动模式与闪存布局。',
    '', 'Supporting files / 配套文件：CONFIG · BUILD-LOGS · OPTIONAL-PACKAGES · FIRMWARE-OTHER（校验清单、构建信息等）。',
    '', 'Retention / 保留期：60 days / 60 天。', '');
  return rows.join('\n');
}

function listTargetFiles(root) {
  if (!existsSync(root)) return [];
  const output = [];
  for (const target of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!target.isDirectory()) continue;
    const targetDir = join(root, target.name);
    for (const subtarget of readdirSync(targetDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!subtarget.isDirectory()) continue;
      const subtargetDir = join(targetDir, subtarget.name);
      for (const entry of readdirSync(subtargetDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (!entry.isFile()) continue;
        const path = join(subtargetDir, entry.name);
        output.push({ path, relative: relative(root, path).replaceAll('\\', '/') });
      }
    }
  }
  return output;
}

function validateArtifactRef(value) {
  const ref = cleanString(value);
  if (!ref || /[\\/\u0000-\u001f\u007f]/.test(ref)) throw new Error('artifact ref is empty or contains a path/control character');
  return ref;
}

export function stageArtifacts({ sourceDir, stagingDir, artifactRef, policy }) {
  const source = resolve(sourceDir);
  const staging = resolve(stagingDir);
  const ref = validateArtifactRef(artifactRef);
  const suffixes = normalizeStandaloneSuffixes(policy?.standaloneSuffixes);
  const standaloneDir = join(staging, 'STANDALONE');
  const otherDir = join(staging, 'FIRMWARE-OTHER');

  rmSync(standaloneDir, { recursive: true, force: true });
  rmSync(otherDir, { recursive: true, force: true });
  mkdirSync(standaloneDir, { recursive: true });
  mkdirSync(otherDir, { recursive: true });

  const metadata = new Map();
  for (const file of listTargetFiles(source).filter(row => basename(row.path) === 'profiles.json')) {
    const document = JSON.parse(readFileSync(file.path, 'utf8'));
    for (const profile of Object.values(document.profiles || {})) {
      for (const image of profile.images || []) {
        if (image.name && !/[\\\\/]/.test(image.name)) metadata.set(`${dirname(file.relative)}/${image.name}`, image);
      }
    }
  }
  const outputs = new Map();
  const standalone = [];
  const other = [];
  for (const file of listTargetFiles(source)) {
    const base = basename(file.path);
    const name = `${ref}-${base}`;
    if (outputs.has(name)) {
      throw new Error(`duplicate artifact output name: ${name} (${outputs.get(name)}; ${file.relative})`);
    }
    outputs.set(name, file.relative);
    const upstream = metadata.get(file.relative);
    const selected = Boolean(upstream) || isStandaloneArtifact(base, suffixes);
    const targetDir = selected ? standaloneDir : otherDir;
    copyFileSync(file.path, join(targetDir, name));
    const bytes = statSync(file.path).size;
    const sha256 = sha256File(file.path);
    if (upstream?.sha256 && upstream.sha256.toLowerCase() !== sha256) throw new Error(`upstream image checksum mismatch: ${file.relative}`);
    (selected ? standalone : other).push({ name, source: file.relative, bytes, sha256,
      role: selected ? artifactRole(base, upstream) : 'support' });
  }

  standalone.sort((a, b) => a.name.localeCompare(b.name));
  other.sort((a, b) => a.name.localeCompare(b.name));
  return {
    schema: 1,
    standaloneSuffixes: suffixes,
    hasStandalone: standalone.length > 0,
    standalone,
    other,
    matrix: standalone.length
      ? standalone.map(({ name }) => ({ name, enabled: true }))
      : [{ name: '__none__', enabled: false }],
  };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) throw new Error(`unexpected argument: ${key}`);
    const value = argv[++i];
    if (value == null || value.startsWith('--')) throw new Error(`missing value for ${key}`);
    args[key.slice(2)] = value;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const key of ['source', 'staging', 'artifact-ref', 'plan']) {
    if (!args[key]) throw new Error(`--${key} is required`);
  }
  const policy = readArtifactPublishPolicy(args.policy || DEFAULT_POLICY);
  const plan = stageArtifacts({
    sourceDir: args.source,
    stagingDir: args.staging,
    artifactRef: args['artifact-ref'],
    policy,
  });
  writeFileSync(args.plan, JSON.stringify(plan, null, 2) + '\n');
  const guide = renderArtifactGuide(plan);
  writeFileSync(join(resolve(args.staging), 'FIRMWARE-OTHER', '00-DOWNLOAD-GUIDE.md'), guide);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, guide, { flag: 'a' });
  console.log(`Artifact publication planned: standalone=${plan.standalone.length}, other=${plan.other.length}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error?.message || error);
    process.exit(1);
  }
}
