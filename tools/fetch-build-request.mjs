#!/usr/bin/env node
// Downloads 1..3 GitHub-hosted Issue attachments and records their detected formats.

import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 3;
const body = String(process.env.ISSUE_BODY || '');
const output = String(process.env.REQUEST_MANIFEST_OUT || 'request-attachments.json');
const outputDir = String(process.env.REQUEST_DIR || 'request-attachments');
const linkRe = /\[([^\]\r\n]{1,160})\]\((https:\/\/github\.com\/user-attachments\/(?:files|assets)\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+)\)/g;
const bareRe = /https:\/\/github\.com\/user-attachments\/(?:files|assets)\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+/g;
const named = [...body.matchAll(linkRe)].map((m) => ({ name: m[1], url: m[2] }));
const seen = new Set(named.map((x) => x.url));
for (const match of body.matchAll(bareRe)) {
  const url = match[0].replace(/[)>.,]+$/, '');
  if (!seen.has(url)) named.push({ name: basename(new URL(url).pathname), url });
  seen.add(url);
}

function fail(message) {
  console.error('Attachment validation failed / 附件校验失败: ' + message);
  process.exit(1);
}
function safeName(name, index) {
  const clean = String(name).replace(/[^A-Za-z0-9._+-]/g, '_').slice(0, 100);
  return `${String(index + 1).padStart(2, '0')}-${clean || 'attachment.txt'}`;
}
function detect(name, text) {
  if (text.trimStart().startsWith('{')) {
    try {
      const json = JSON.parse(text);
      if (typeof json.config === 'string') return 'json';
    } catch (e) { fail(`${name}: invalid JSON: ${e.message}`); }
  }
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const valid = lines.every((line) => line === '' || line.startsWith('#') || /^CONFIG_[A-Za-z0-9_+.-]+=.*$/.test(line));
  if (!valid || !lines.some((line) => /^CONFIG_/.test(line))) fail(`${name}: not JSON, .config, or config.buildinfo`);
  return /config\.buildinfo$/i.test(name) ? 'buildinfo' : 'config';
}

if (named.length < 1 || named.length > MAX_FILES) {
  fail(`expected 1..${MAX_FILES} GitHub user attachments, found ${named.length}`);
}
mkdirSync(outputDir, { recursive: true });
const files = [];
for (let i = 0; i < named.length; i++) {
  const item = named[i];
  const response = await fetch(item.url, { redirect: 'follow' });
  if (!response.ok) fail(`${item.name}: download returned HTTP ${response.status}`);
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_BYTES) fail(`${item.name}: too large: ${declared} bytes`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 32 || buffer.length > MAX_BYTES) fail(`${item.name}: size must be 32B..2MB`);
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch (e) { fail(`${item.name}: not valid UTF-8 text`); }
  if (text.charCodeAt(0) === 0xFEFF || text.includes('\0')) fail(`${item.name}: BOM/NUL is not allowed`);
  const type = detect(item.name, text);
  const path = join(outputDir, safeName(item.name, i));
  writeFileSync(path, buffer);
  files.push({ name: item.name, path, type, bytes: buffer.length });
}
if (files.filter((x) => x.type === 'json').length > 1) fail('only one build-request.json is allowed');
writeFileSync(output, JSON.stringify({ version: 1, files }, null, 2) + '\n');
console.log(`Downloaded ${files.length} authoritative attachment(s) / 已下载 ${files.length} 个权威附件 -> ${output}`);
