#!/usr/bin/env node
// Generates optional static deployment metadata for the web UI. The file is not a source of truth.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'site', 'wrt', 'data', 'build-meta.json');
const version = readFileSync(join(ROOT, 'VERSION'), 'utf8').trim();
if (!/^v\d{10}$/.test(version)) throw new Error(`Invalid VERSION: ${version}`);

function resolveCommit() {
  for (const value of [process.env.WEIG_BUILD_COMMIT, process.env.CF_PAGES_COMMIT_SHA, process.env.GITHUB_SHA]) {
    if (/^[a-f0-9]{7,64}$/i.test(value || '')) return value.toLowerCase();
  }
  try {
    const value = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (/^[a-f0-9]{7,64}$/i.test(value)) return value.toLowerCase();
  } catch (e) { /* static copies can work without Git */ }
  return '';
}

function shanghaiIsoNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+08:00`;
}

const builtAt = process.env.WEIG_BUILD_TIME || shanghaiIsoNow();
if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/.test(builtAt)) {
  throw new Error(`Invalid WEIG_BUILD_TIME: ${builtAt}`);
}
const payload = {
  version,
  commit: resolveCommit(),
  builtAt,
  timezone: 'Asia/Shanghai',
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
console.log(`Generated web build metadata / 已生成网页部署元数据: ${version} ${payload.commit || '(no git commit)'}`);
