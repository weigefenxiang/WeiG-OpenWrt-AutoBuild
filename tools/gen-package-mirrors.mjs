#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'config', 'policies', 'package-mirrors.json');
const OUTPUT = join(ROOT, 'site', 'wrt', 'data', 'package-mirrors.json');
const CHECK = process.argv.includes('--check');

function fail(message) {
  console.error(`package mirror data error: ${message}`);
  process.exit(1);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${path}: ${error.message}`);
  }
}

function validate(data) {
  if (data?.schema !== 2) fail('schema must be 2');
  const families = new Set(Object.values(data.sourceFamilies || {}));
  if (!families.size || [...families].some((id) => !/^[a-z0-9-]+$/.test(id))) {
    fail('sourceFamilies must map source IDs to safe family IDs');
  }
  for (const family of families) {
    const origins = data.origins?.[family];
    if (!Array.isArray(origins) || !origins.length) fail(`missing origins for ${family}`);
    for (const origin of origins) {
      if (!/^https:\/\/[A-Za-z0-9.-]+(?:\/[A-Za-z0-9._/-]+)?$/.test(origin)) {
        fail(`unsafe origin: ${origin}`);
      }
    }
  }
  const ids = new Set();
  for (const preset of data.presets || []) {
    if (!/^[a-z0-9-]+$/.test(preset.id || '') || ids.has(preset.id)) fail(`invalid preset ID: ${preset.id}`);
    ids.add(preset.id);
    if (!preset.label?.['zh-CN'] || !preset.label?.en) fail(`missing labels for ${preset.id}`);
    for (const [family, root] of Object.entries(preset.roots || {})) {
      if (!families.has(family)) fail(`unknown family ${family} in ${preset.id}`);
      if (!/^https:\/\/[A-Za-z0-9.-]+(?:\/[A-Za-z0-9._/-]+)?$/.test(root)) fail(`unsafe root: ${root}`);
    }
  }
  for (const required of ['auto', 'source-default', 'ustc', 'pku']) {
    if (!ids.has(required)) fail(`missing preset: ${required}`);
  }
  for (const id of [...(data.policies?.auto || []), ...(data.policies?.manualFailure || [])]) {
    if (!ids.has(id)) fail(`policy references unknown preset: ${id}`);
  }
  const detection = data.managerDetection || {};
  if (!/^(?:[A-Za-z0-9._+-]+\/)*[A-Za-z0-9._+-]+$/.test(detection.configPath || '')) {
    fail('managerDetection.configPath is unsafe');
  }
  if (!/^CONFIG_[A-Z0-9_]+$/.test(detection.apkSymbol || '')) fail('managerDetection.apkSymbol is invalid');
  if (!Array.isArray(detection.capabilityPaths) || !detection.capabilityPaths.length) {
    fail('managerDetection.capabilityPaths is required');
  }
  for (const path of detection.capabilityPaths) {
    if (!/^(?:[A-Za-z0-9._+-]+\/)*[A-Za-z0-9._+-]+$/.test(path)) fail(`unsafe capability path: ${path}`);
  }
  for (const manager of ['apk', 'opkg']) {
    const markers = detection.markers?.[manager];
    if (!Array.isArray(markers) || !markers.length || markers.some((marker) => typeof marker !== 'string' || !marker.trim())) {
      fail(`managerDetection.markers.${manager} is required`);
    }
  }
  const adapterIds = new Set();
  for (const adapter of data.adapters || []) {
    if (!/^[a-z0-9-]+$/.test(adapter.id || '') || adapterIds.has(adapter.id)) fail(`invalid adapter: ${adapter.id}`);
    adapterIds.add(adapter.id);
    if (!Array.isArray(adapter.paths) || !adapter.paths.length) fail(`adapter has no paths: ${adapter.id}`);
    for (const path of adapter.paths) {
      if (!/^(?:[A-Za-z0-9._+-]+\/)*[A-Za-z0-9._+-]+$/.test(path)) fail(`unsafe adapter path: ${path}`);
    }
  }
}

function publicProjection(data) {
  const familySources = new Map();
  for (const [source, family] of Object.entries(data.sourceFamilies)) {
    if (!familySources.has(family)) familySources.set(family, []);
    familySources.get(family).push(source);
  }
  return {
    schema: 2,
    presets: data.presets.map((preset) => ({
      id: preset.id,
      kind: preset.kind,
      label: preset.label,
      sources: preset.kind === 'mirror'
        ? Object.keys(preset.roots || {}).flatMap((family) => familySources.get(family) || []).sort()
        : Object.keys(data.sourceFamilies).sort(),
    })),
    aliases: data.aliases || {},
    policies: {
      auto: [...data.policies.auto],
      manualFailure: [...data.policies.manualFailure],
    },
  };
}

const source = readJson(SOURCE);
validate(source);
const text = JSON.stringify(publicProjection(source), null, 2) + '\n';
if (CHECK) {
  let actual = '';
  try { actual = readFileSync(OUTPUT, 'utf8'); } catch {}
  if (actual !== text) fail('site/wrt/data/package-mirrors.json is stale; run node tools/gen-package-mirrors.mjs');
  console.log('package mirror projection is current');
} else {
  writeFileSync(OUTPUT, text, 'utf8');
  console.log(`generated ${OUTPUT}`);
}
