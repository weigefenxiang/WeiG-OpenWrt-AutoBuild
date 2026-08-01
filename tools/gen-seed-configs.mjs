#!/usr/bin/env node
// 由版本化 device-catalog.json 生成设备、分支、Profile 与最小种子配置。
// Generates devices, branch/profile availability and minimal seed configs.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = JSON.parse(readFileSync(join(ROOT, 'tools', 'device-catalog.json'), 'utf8'));
const DEV_PATH = join(ROOT, 'site', 'wrt', 'data', 'devices.json');
const CURRENT = JSON.parse(readFileSync(DEV_PATH, 'utf8'));
const GENERATED_HEADER = '# Minimal bootable seed config / 最精简可开机种子配置';
const generatedConfigs = new Set();

const BRAND_CN = {
  Xiaomi: '小米', Redmi: 'Redmi', Qihoo: '360', CMCC: '移动CMCC', 'China Mobile': '移动CMCC',
  H3C: '华三H3C', JDCloud: '京东云', 'JD-Cloud': '京东云', Ruijie: '锐捷Ruijie', ASUS: '华硕ASUS',
  ZTE: '中兴ZTE', 'TP-Link': 'TP-Link', Konka: '康佳Konka', Livinet: 'Livinet', JCG: 'JCG',
  'GL.iNet': 'GL.iNet', GLiNet: 'GL.iNet', Netcore: '磊科Netcore', Tenbay: 'Tenbay',
  Nokia: '诺基亚Nokia', Netgear: '网件Netgear', Mercusys: '水星Mercusys', Cudy: 'Cudy',
  MediaTek: '联发科参考板', Bananapi: '香蕉派BPi', OpenWrt: 'OpenWrt', Acer: '宏碁Acer',
};
const SOURCE_META = {
  ImmortalWrt: {
    label: 'ImmortalWrt', repo: 'immortalwrt/immortalwrt', diy2: 'diy2-360T7.sh',
  },
  OpenWrt: {
    label: 'OpenWrt', repo: 'openwrt/openwrt', diy2: 'diy2-openwrt.sh',
  },
  lede: {
    label: 'Lean LEDE', repo: 'coolsnowwolf/lede', diy2: 'diy2-lede.sh', loginPw: 'password',
  },
};

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fileSafe = (s) => String(s).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-|-$/g, '');
const profileId = (profile) => profile;
const versionLabel = (version) => version;

function identity(raw) {
  if (raw.kind === 'target') {
    return {
      id: raw.id,
      brand: raw.brand,
      dir: `platform/${raw.id}`,
      name: raw.target.profileLabel,
      plugins: 'seed',
      kind: 'target',
      target: raw.target,
    };
  }
  const first = Object.values(raw.sources || {}).flat()[0];
  if (/qihoo_360t7(?:-|$)/.test(first?.profile || '')) {
    return { id: '360t7', brand: '360', dir: '360/360t7', name: '360T7', plugins: null };
  }
  const id = slug(raw.brand + '-' + raw.model);
  const brandSlug = slug((first?.profile || '').split(/[_-]/)[0] || raw.brand);
  return {
    id, brand: BRAND_CN[raw.brand] || raw.brand, dir: `${brandSlug}/${id}`,
    name: `${BRAND_CN[raw.brand] || raw.brand} ${raw.model}`, plugins: 'seed',
  };
}

function targetLines(item) {
  const target = item.target || 'mediatek';
  const archPackages = item.archPackages || 'aarch64_cortex-a53';
  return [
    `CONFIG_TARGET_${target}=y`,
    `CONFIG_TARGET_${target}_${item.subtarget}=y`,
    `CONFIG_TARGET_${target}_${item.subtarget}_DEVICE_${item.profile}=y`,
    `CONFIG_TARGET_BOARD="${target}"`,
    `CONFIG_TARGET_SUBTARGET="${item.subtarget}"`,
    `CONFIG_TARGET_PROFILE="DEVICE_${item.profile}"`,
    `CONFIG_TARGET_ARCH_PACKAGES="${archPackages}"`,
    'CONFIG_PACKAGE_luci=y',
    'CONFIG_PACKAGE_luci-base=y',
    'CONFIG_PACKAGE_luci-ssl=y',
    'CONFIG_PACKAGE_luci-mod-admin-full=y',
    'CONFIG_PACKAGE_luci-theme-bootstrap=y',
  ];
}

function friendlyVariant(profile, note) {
  const suffix = profile.match(/-(ubi|ubootmod|stock|emmc|nand|nor|v\d+)$/i)?.[1];
  const label = suffix ? suffix.toUpperCase() : profile;
  return {
    name: label,
    note: note || `Profile: ${profile}`,
    capacity: /stock/i.test(profile) ? 24 : 60,
  };
}

const old360 = CURRENT.devices.find((device) => device.id === '360t7');
const devices = [];
let cfgCount = 0;

for (const raw of [...CATALOG.rawMerged, ...(CATALOG.platforms || [])]) {
  const info = identity(raw);
  const dir = join(ROOT, 'config', ...info.dir.split('/'));
  mkdirSync(dir, { recursive: true });
  const sources = [];

  for (const [sourceId, profiles] of Object.entries(raw.sources || {})) {
    const meta = SOURCE_META[sourceId];
    if (!meta || !profiles.length) continue;
    const versions = [...new Map(profiles.map((p) => [p.version, {
      id: p.version,
      label: versionLabel(p.version),
      branch: p.branch,
      note: p.branch,
    }])).values()];
    const grouped = new Map();

    for (const profile of profiles) {
      const id = profileId(profile.profile);
      if (!grouped.has(id)) {
        grouped.set(id, {
          id, profile: profile.profile,
          ...(info.kind === 'target' ? {
            name: info.target.profileLabel,
            note: `Target: ${info.target.system} / ${info.target.subtargetLabel} / ${info.target.profileLabel}`,
            capacity: 1024,
          } : friendlyVariant(profile.profile, profile.variantNote)),
          versions: [],
          configs: {},
        });
      }
      const variant = grouped.get(id);
      if (!variant.versions.includes(profile.version)) variant.versions.push(profile.version);
      const filename = fileSafe(`${sourceId}-${profile.version}-${profile.profile}`) + '.config';
      const header = [
        GENERATED_HEADER,
        `# seed-device=${info.id} source=${sourceId} version=${profile.version} (${profile.branch}) profile=${id}`,
        `# upstream-profile=${profile.profile}`,
        '# 其余符号由 make defconfig 自动展开 / everything else is expanded by make defconfig',
      ];
      const configPath = join(dir, filename);
      writeFileSync(configPath, header.concat(targetLines(profile)).join('\n') + '\n');
      generatedConfigs.add(configPath);
      variant.configs[profile.version] = filename;
      cfgCount++;
    }

    const variants = [...grouped.values()];
    const firstConfig = variants[0].configs[versions[0].id] || Object.values(variants[0].configs)[0];
    sources.push({
      id: sourceId, label: meta.label, repo: meta.repo, config: firstConfig,
      diy1: 'diy-immortalwrt.sh', diy2: meta.diy2, append: true, desc: meta.repo,
      ...(meta.loginPw ? { loginPw: meta.loginPw } : {}),
      versions, variants,
    });
  }
  if (!sources.length) continue;

  const preserved = info.id === '360t7' && old360 ? {
    note: old360.note,
    ...(old360.plugins ? { plugins: old360.plugins } : {}),
  } : info.kind === 'target' ? {
    plugins: 'seed',
    note: `通用目标平台：${info.target.system} / ${info.target.subtargetLabel} / ${info.target.profileLabel}`,
  } : {
    plugins: 'seed',
    note: `种子配置机型：仅经过“能开机”级别配置，未经实机验证。配置位于 config/${info.dir}/`,
  };
  devices.push({
    id: info.id, brand: info.brand, name: info.name, chip: raw.chip,
    ...preserved, sources, enabled: true, dir: info.dir,
    ...(info.kind === 'target' ? { kind: info.kind, target: info.target } : {}),
    profiles: raw.sources,
  });
}

devices.sort((a, b) => (a.id === '360t7' ? -1 : b.id === '360t7' ? 1
  : a.brand.localeCompare(b.brand, 'zh') || a.name.localeCompare(b.name, 'zh')));
writeFileSync(DEV_PATH, JSON.stringify({ ...CURRENT, devices }, null, 1) + '\n');

let stale = 0;
function removeStaleGenerated(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) removeStaleGenerated(path);
    else if (name.endsWith('.config') && !generatedConfigs.has(path) &&
      readFileSync(path, 'utf8').startsWith(GENERATED_HEADER)) {
      rmSync(path);
      stale++;
    }
  }
}
removeStaleGenerated(join(ROOT, 'config'));
console.log(`设备 ${devices.length} 台，版本化 Profile 种子 config ${cfgCount} 份，清理旧生成配置 ${stale} 份`);
