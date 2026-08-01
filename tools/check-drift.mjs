#!/usr/bin/env node
// fetch-catalog 之后检查分支策略与关键 Profile；不再维护易过期的字符串补丁。

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

const t7 = catalog.rawMerged.find((item) =>
  /qihoo/i.test(item.brand) && /360t7/i.test(item.model));
if (!t7) throw new Error('目录中找不到 Qihoo 360T7');
const required = [
  ['ImmortalWrt', 'master', 'qihoo_360t7-ubi'],
  ['OpenWrt', 'main', 'qihoo_360t7-ubi'],
];
for (const [source, branch, profile] of required) {
  const found = (t7.sources[source] || []).some((item) =>
    item.branch === branch && item.profile === profile);
  if (!found) throw new Error(`${source}/${branch} 缺少 ${profile}`);
}
console.log('分支策略与 360T7 UBI Profile 无漂移 / branch policy and UBI profiles OK');
