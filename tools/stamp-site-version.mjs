#!/usr/bin/env node
// Updates vYYMMDDHHmm when tracked project inputs change; --check validates without writing.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site', 'wrt');
const OUT = join(SITE, 'data', 'site-version.json');
const ROOT_VERSION = join(ROOT, 'VERSION');
const CHECK_ONLY = process.argv.includes('--check');
const VERSION_INPUTS = [
  '.github/workflows',
  'Shell',
  'config',
  'site/wrt',
  'tools',
];
const SKIP_INPUTS = new Set([
  'site/wrt/data/build-meta.json',
  'site/wrt/data/site-version.json',
]);
const FINGERPRINT_TEXT_EXTENSIONS = new Set([
  '.config', '.conf', '.css', '.html', '.js', '.json', '.md', '.mjs', '.sh', '.txt', '.yaml', '.yml',
]);
const INDEX = join(SITE, 'index.html');
const APP = join(SITE, 'app.js');
const normalizeText = (text) => text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
const digestText = (text) => createHash('sha256').update(normalizeText(text)).digest('hex').slice(0, 10);
const contentDigest = (path) => digestText(readFileSync(path, 'utf8'));

const currentApp = readFileSync(APP, 'utf8');
let expectedApp = currentApp;
for (const moduleName of ['catalog-engine.js', 'catalog-loader.js', 'catalog-schema6.js', 'catalog-search-worker.js']) {
  const digest = contentDigest(join(SITE, 'lib', moduleName));
  expectedApp = expectedApp.replace(
    new RegExp(`\\./lib/${moduleName.replace('.', '\\.')}\\?v=[^"']+|\\./lib/${moduleName.replace('.', '\\.')}`, 'g'),
    `./lib/${moduleName}?v=${digest}`,
  );
}

const currentHtml = readFileSync(INDEX, 'utf8');
let expectedHtml = currentHtml;
const expectedAssetDigest = new Map([
  ['app.css', contentDigest(join(SITE, 'app.css'))],
  ['app.js', digestText(expectedApp)],
]);
for (const asset of ['app.css', 'app.js']) {
  expectedHtml = expectedHtml.replace(
    new RegExp(`${asset.replace('.', '\\.')}\\?v=[^"'<>]+`, 'g'),
    `${asset}?v=${expectedAssetDigest.get(asset)}`,
  );
}

const contentOverrides = new Map([
  ['site/wrt/app.js', Buffer.from(normalizeText(expectedApp))],
  ['site/wrt/index.html', Buffer.from(normalizeText(expectedHtml))],
]);
const fingerprintContent = (path, rel) => {
  if (contentOverrides.has(rel)) return contentOverrides.get(rel);
  return FINGERPRINT_TEXT_EXTENSIONS.has(extname(path).toLowerCase())
    ? Buffer.from(normalizeText(readFileSync(path, 'utf8')))
    : readFileSync(path);
};

const files = [];
function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else {
      const rel = relative(ROOT, path).replaceAll('\\', '/');
      if (!SKIP_INPUTS.has(rel)) files.push([rel, path]);
    }
  }
}
for (const input of VERSION_INPUTS) walk(join(ROOT, ...input.split('/')));
files.sort(([a], [b]) => a.localeCompare(b));

const hash = createHash('sha256');
for (const [rel, path] of files) {
  hash.update(rel).update('\0').update(fingerprintContent(path, rel)).update('\0');
}
const fingerprint = hash.digest('hex');
let old = {};
try { old = JSON.parse(readFileSync(OUT, 'utf8')); } catch (e) { /* first stamp */ }
let rootVersion = '';
try { rootVersion = readFileSync(ROOT_VERSION, 'utf8').trim(); } catch (e) { /* first stamp */ }

const versionStateOk = old.fingerprint === fingerprint && old.timezone === 'Asia/Shanghai' &&
  /^v\d{10}$/.test(old.version || '') && rootVersion === old.version;
const generatedAssetsOk = currentApp === expectedApp && currentHtml === expectedHtml;

if (CHECK_ONLY) {
  if (versionStateOk && generatedAssetsOk) {
    console.log(`Project version verified / 项目版本验证通过: ${old.version}`);
    process.exit(0);
  }
  if (!generatedAssetsOk) console.error('Generated web asset fingerprints are stale / 网页资源指纹未更新');
  if (!versionStateOk) console.error('VERSION or site-version fingerprint is stale / VERSION 或 site-version 指纹未更新');
  console.error('Run locally before commit / 提交前请在本地运行: node tools/stamp-site-version.mjs');
  process.exit(1);
}

if (currentApp !== expectedApp) writeFileSync(APP, expectedApp);
if (currentHtml !== expectedHtml) writeFileSync(INDEX, expectedHtml);
if (versionStateOk && generatedAssetsOk) {
  console.log(`Version inputs unchanged / 版本输入未变化: ${old.version}`);
  process.exit(0);
}

const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: '2-digit', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).formatToParts(new Date()).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
const version = `v${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}`;
writeFileSync(OUT, JSON.stringify({ version, timezone: 'Asia/Shanghai', fingerprint }, null, 2) + '\n');
writeFileSync(ROOT_VERSION, version + '\n');
console.log(`Stamped project version / 已更新项目版本: ${old.version || '(none)'} -> ${version}`);
