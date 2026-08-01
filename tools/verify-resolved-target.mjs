#!/usr/bin/env node
// make defconfig 后确认目标设备没有被所选分支改写。

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'config-manifest.json'), 'utf8'));
const id = process.env.CONFIG_ID || '';
const configPath = process.env.CONFIG_PATH || join(ROOT, 'openwrt', '.config');
const custom = process.env.CUSTOM_TARGET === '1';
const expectedConfigPath = process.env.EXPECTED_CONFIG_PATH || '';
const targetLines = (text) => text.split(/\r?\n/).filter((line) =>
  /^CONFIG_TARGET_(?:BOARD|SUBTARGET|PROFILE)=/.test(line) ||
  /^CONFIG_TARGET_.*_DEVICE_.*=y$/.test(line)).sort();
const activeTarget = targetLines(readFileSync(configPath, 'utf8'));
let wantedTarget;
if (custom) {
  if (!expectedConfigPath) throw new Error('自定义 Target 缺少原始配置路径');
  wantedTarget = targetLines(readFileSync(expectedConfigPath, 'utf8'));
} else {
  const expected = manifest.configs[id];
  if (!expected) throw new Error(`配置清单不存在: ${id}`);
  wantedTarget = [...expected.target].sort();
}
const activeDevices = activeTarget.filter((line) => /^CONFIG_TARGET_.*_DEVICE_.*=y$/.test(line));
const wantedDevices = wantedTarget.filter((line) => /^CONFIG_TARGET_.*_DEVICE_.*=y$/.test(line));
const active = activeDevices.length && wantedDevices.length ? activeDevices : activeTarget;
const wanted = activeDevices.length && wantedDevices.length ? wantedDevices : wantedTarget;
if (!active.length || JSON.stringify(active) !== JSON.stringify(wanted)) {
  console.error(`分支/Profile 校验失败: ${id}`);
  console.error(`期望 / expected: ${wanted.join(' | ') || '(none)'}`);
  console.error(`实际 / actual: ${active.join(' | ') || '(none)'}`);
  process.exit(1);
}
console.log(`${custom ? '自定义 Target' : '分支/Profile'} 校验通过: ${id} -> ${active.join(' | ')}`);
