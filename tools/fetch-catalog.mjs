#!/usr/bin/env node
// 按上游真实分支与 TARGET_DEVICES 生成版本化设备目录。
// Builds a version-aware catalog from upstream branches and real TARGET_DEVICES entries.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'device-catalog.json');
const TOKEN = process.env.GITHUB_TOKEN || '';
const headers = { 'User-Agent': 'WeiG-OpenWrt-AutoBuild' };
if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

const SOURCES = {
  ImmortalWrt: {
    repo: 'immortalwrt/immortalwrt',
    exclude: new Set(),
    files: [['filogic', 'target/linux/mediatek/image/filogic.mk']],
  },
  OpenWrt: {
    repo: 'openwrt/openwrt',
    exclude: new Set(['lede-17.01', 'pcs-standalone-back', 'master']),
    files: [['filogic', 'target/linux/mediatek/image/filogic.mk']],
    platforms: [{
      branch: 'main', target: 'x86', subtarget: '64', archPackages: 'x86_64',
      path: 'target/linux/x86/image/64.mk', profiles: ['generic'],
    }],
  },
  lede: {
    repo: 'coolsnowwolf/lede',
    branches: ['master'],
    exclude: new Set(),
    files: [['filogic', 'target/linux/mediatek/image/filogic.mk']],
  },
};

const chipOf = (s) => {
  const m = String(s).match(/mt7(?:981|986|988|622)/i);
  return m ? m[0].toUpperCase() : '';
};
const versionId = (branch) => branch.startsWith('openwrt-') ? branch.slice(8) : branch;

function normModel(model) {
  return String(model).trim()
    .replace(/^Mi Router\s+/i, '').replace(/^Redmi Router\s+/i, '').replace(/^Mi\s+/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '');
}
const mergeKey = (brand, model) =>
  (brand + '|' + model).toLowerCase().replace(/[^a-z0-9|]+/g, '');

async function fetchJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

async function branchesFor(spec) {
  if (spec.branches) return spec.branches;
  const out = [];
  for (let page = 1; ; page++) {
    const rows = await fetchJson(`https://api.github.com/repos/${spec.repo}/branches?per_page=100&page=${page}`);
    out.push(...rows.map((row) => row.name));
    if (rows.length < 100) break;
  }
  return out.filter((branch) => !spec.exclude.has(branch)).sort();
}

async function fetchRaw(repo, branch, path) {
  const url = `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(branch)}/${path}`;
  const response = await fetch(url, { headers });
  if (response.status === 404) return null; // 该旧分支没有 filogic，即不支持当前设备族。
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}

function assignments(body) {
  const values = {};
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*(\+?[:]?=)\s*(.*?)\s*$/);
    if (!match) continue;
    const [, key, op, value] = match;
    values[key] = op.startsWith('+') && values[key] ? `${values[key]} ${value}` : value;
  }
  return values;
}

function parseMk(text, target, subtarget, archPackages) {
  const blocks = new Map();
  for (const match of text.matchAll(/define Device\/([\w.-]+)\r?\n([\s\S]*?)\r?\nendef/g)) {
    blocks.set(match[1], match[2]);
  }
  const flattened = text.replace(/\\\r?\n/g, ' ');
  const targets = new Set();
  for (const match of flattened.matchAll(/^\s*TARGET_DEVICES\s*\+=\s*(.*?)\s*$/gm)) {
    for (const profile of match[1].split(/\s+/).filter(Boolean)) targets.add(profile);
  }

  const cache = new Map();
  function resolve(profile, stack = new Set()) {
    if (cache.has(profile)) return cache.get(profile);
    if (stack.has(profile)) throw new Error(`Device 模板循环继承: ${[...stack, profile].join(' -> ')}`);
    const body = blocks.get(profile);
    if (!body) return {};
    const next = new Set(stack).add(profile);
    const merged = {};
    for (const call of body.matchAll(/\$\(call Device\/([\w.-]+)\)/g)) {
      Object.assign(merged, resolve(call[1], next));
    }
    Object.assign(merged, assignments(body));
    cache.set(profile, merged);
    return merged;
  }

  const out = [];
  for (const profile of targets) {
    const fields = resolve(profile);
    let vendor = fields.DEVICE_VENDOR || '';
    let model = fields.DEVICE_MODEL || '';
    if ((!vendor || !model) && fields.DEVICE_TITLE) {
      const title = fields.DEVICE_TITLE.trim();
      const split = title.indexOf(' ');
      vendor ||= split > 0 ? title.slice(0, split) : 'OpenWrt';
      model ||= split > 0 ? title.slice(split + 1) : title;
    }
    if (!vendor || !model) continue;
    const dts = fields.DEVICE_DTS || fields.DTS || '';
    out.push({
      profile, target, subtarget, archPackages, vendor, model,
      variant: fields.DEVICE_VARIANT || '',
      chip: chipOf(dts || profile) || chipOf(subtarget),
    });
  }
  return out;
}

const merged = {};
const platforms = [];
const branchCatalog = {};
let total = 0;

for (const [source, spec] of Object.entries(SOURCES)) {
  const branches = await branchesFor(spec);
  branchCatalog[source] = [];
  for (const branch of branches) {
    let count = 0;
    for (const [subtarget, path] of spec.files) {
      const text = await fetchRaw(spec.repo, branch, path);
      if (text === null) continue;
      const devices = parseMk(text, 'mediatek', subtarget, 'aarch64_cortex-a53');
      if (!devices.length) throw new Error(`[${source}/${branch}] ${path} 解析出 0 台真实设备`);
      for (const device of devices) {
        const model = normModel(device.model);
        const key = mergeKey(device.vendor, model);
        if (!merged[key]) merged[key] = {
          brand: device.vendor, model, chip: device.chip, sources: {},
        };
        if (!merged[key].chip && device.chip) merged[key].chip = device.chip;
        if (!merged[key].sources[source]) merged[key].sources[source] = [];
        merged[key].sources[source].push({
          branch,
          version: versionId(branch),
          profile: device.profile,
          subtarget: device.subtarget,
          variantNote: device.variant,
        });
        count++;
      }
    }
    for (const platform of spec.platforms || []) {
      if (platform.branch !== branch) continue;
      const text = await fetchRaw(spec.repo, branch, platform.path);
      if (text === null) throw new Error(`[${source}/${branch}] 缺平台定义 ${platform.path}`);
      const profiles = parseMk(
        text, platform.target, platform.subtarget, platform.archPackages,
      ).filter((item) => platform.profiles.includes(item.profile));
      if (profiles.length !== platform.profiles.length) {
        throw new Error(`[${source}/${branch}] ${platform.path} 平台 Profile 不完整`);
      }
      for (const profile of profiles) {
        platforms.push({
          id: `${profile.target}-${profile.subtarget}-${profile.profile}`,
          brand: profile.vendor,
          model: profile.model,
          chip: profile.archPackages,
          kind: 'target',
          target: {
            system: profile.target,
            systemLabel: profile.target,
            subtarget: profile.subtarget,
            subtargetLabel: profile.archPackages,
            profile: profile.profile,
            profileLabel: `${profile.vendor} ${profile.model}`.trim(),
          },
          sources: {
            [source]: [{
              branch,
              version: versionId(branch),
              profile: profile.profile,
              target: profile.target,
              subtarget: profile.subtarget,
              archPackages: profile.archPackages,
              variantNote: profile.variant,
            }],
          },
        });
        count++;
      }
    }
    branchCatalog[source].push({ branch, version: versionId(branch), profiles: count });
    total += count;
    console.log(`[${source}/${branch}] ${count} 个 profile`);
  }
}

if (total < 100) throw new Error(`总 profile 数 ${total} 异常偏低，终止`);
const rawMerged = Object.values(merged)
  .sort((a, b) => (a.brand + a.model).localeCompare(b.brand + b.model));
writeFileSync(OUT, JSON.stringify({
  fetchedBy: 'tools/fetch-catalog.mjs',
  branchPolicy: {
    ImmortalWrt: { include: 'all remote heads', exclude: [] },
    OpenWrt: { include: 'all remote heads', exclude: [...SOURCES.OpenWrt.exclude] },
    lede: { include: ['master'], exclude: [] },
  },
  branches: branchCatalog,
  platforms,
  rawMerged,
}, null, 1) + '\n');
console.log(`device-catalog.json: ${rawMerged.length} 台机型 / ${total} 个版本化 profile`);
