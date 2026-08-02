#!/usr/bin/env node
// fetch-catalog 之后仅检查通用分支策略；不再维护设备专用字符串补丁。

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(readFileSync(join(ROOT, 'tools', 'device-catalog.json'), 'utf8'));
const openwrt = catalog.branches?.OpenWrt || [];
const names = new Set(openwrt.map((item) => item.branch));
const forbidden = ['lede-17.01', 'pcs-standalone-back', 'master'];
if (!names.has('main') || forbidden.some((name) => names.has(name))) {
  throw new Error(`OpenWrt 分支策略漂移: ${[...names].join(', ')}`);
}

console.log('OpenWrt 分支策略无漂移 / OpenWrt branch policy OK');
