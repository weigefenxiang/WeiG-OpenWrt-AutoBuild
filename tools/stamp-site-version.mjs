#!/usr/bin/env node
// Updates vYYMMDDHHmm only when the public site content fingerprint changes.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site', 'wrt');
const OUT = join(SITE, 'data', 'site-version.json');
const ROOT_VERSION = join(ROOT, 'VERSION');
const skip = new Set(['data/site-version.json']);
const INDEX = join(SITE, 'index.html');
const APP = join(SITE, 'app.js');
const contentDigest = (path) => createHash('sha256')
  .update(readFileSync(path, 'utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 10);
let app = readFileSync(APP, 'utf8');
for (const moduleName of ['catalog-engine.js', 'catalog-loader.js', 'catalog-schema6.js', 'catalog-search-worker.js']) {
  const digest = contentDigest(join(SITE, 'lib', moduleName));
  app = app.replace(new RegExp(`\\./lib/${moduleName.replace('.', '\\.')}\\?v=[^\"']+|\\./lib/${moduleName.replace('.', '\\.')}`, 'g'),
    `./lib/${moduleName}?v=${digest}`);
}
if (app !== readFileSync(APP, 'utf8')) writeFileSync(APP, app);
let html = readFileSync(INDEX, 'utf8');
for (const asset of ['app.css', 'app.js']) {
  const digest = contentDigest(join(SITE, asset));
  html = html.replace(new RegExp(`${asset.replace('.', '\\.')}\\?v=[^"'<>]+`, 'g'), `${asset}?v=${digest}`);
}
if (html !== readFileSync(INDEX, 'utf8')) writeFileSync(INDEX, html);
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else {
      const rel = relative(SITE, path).replaceAll('\\', '/');
      if (!skip.has(rel)) files.push([rel, path]);
    }
  }
}
walk(SITE);
const hash = createHash('sha256');
for (const [rel, path] of files) {
  hash.update(rel).update('\0').update(readFileSync(path)).update('\0');
}
const fingerprint = hash.digest('hex');
let old = {};
try { old = JSON.parse(readFileSync(OUT, 'utf8')); } catch (e) { /* first stamp */ }
let rootVersion = '';
try { rootVersion = readFileSync(ROOT_VERSION, 'utf8').trim(); } catch (e) { /* first stamp */ }
if (old.fingerprint === fingerprint && old.timezone === 'Asia/Shanghai' &&
    /^v\d{10}$/.test(old.version || '') &&
    rootVersion === old.version) {
  console.log(`Site unchanged / 网页未变化: ${old.version}`);
  process.exit(0);
}
const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: '2-digit', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).formatToParts(new Date()).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
const version = `v${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}`;
writeFileSync(OUT, JSON.stringify({ version, timezone: 'Asia/Shanghai', fingerprint }, null, 2) + '\n');
writeFileSync(ROOT_VERSION, version + '\n');
console.log(`Stamped site / 已更新网页版本: ${old.version || '(none)'} -> ${version}`);
