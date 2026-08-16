#!/usr/bin/env node
// Downloads 1..3 GitHub-hosted Issue attachments and records their detected formats.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 3;
const output = String(process.env.REQUEST_MANIFEST_OUT || 'request-attachments.json');
const outputDir = String(process.env.REQUEST_DIR || 'request-attachments');
const body = readIssueBody();
const linkRe = /\[([^\]\r\n]{1,160})\]\((https:\/\/github\.com\/user-attachments\/(?:files|assets)\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+)\)/g;
const bareRe = /https:\/\/github\.com\/user-attachments\/(?:files|assets)\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+/g;
const inlineMatch = body.match(/<!--\s*WEIG_BUILD_REQUEST_GZIP_BASE64\s*([\s\S]*?)-->/i);
const inlinePayload = inlineMatch ? inlineMatch[1].replace(/\s+/g, '') : '';
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
function readIssueBody() {
  if (typeof process.env.ISSUE_BODY === 'string' && process.env.ISSUE_BODY !== '') {
    return process.env.ISSUE_BODY;
  }
  // Manual dispatchers may point at an immutable Issue snapshot through a custom variable.
  // GitHub-provided GITHUB_* defaults cannot be overridden, so keep GITHUB_EVENT_PATH as fallback only.
  const requestEventPath = String(process.env.REQUEST_EVENT_PATH || '').trim();
  const githubEventPath = String(process.env.GITHUB_EVENT_PATH || '').trim();
  const eventPath = requestEventPath || githubEventPath;
  if (!eventPath) return '';
  try {
    const event = JSON.parse(readFileSync(eventPath, 'utf8'));
    return String(event.issue?.body || '');
  } catch (error) {
    fail(`cannot read GitHub event payload: ${error.message}`);
  }
}
function safeName(name, index) {
  const clean = String(name).replace(/[^A-Za-z0-9._+-]/g, '_').slice(0, 100);
  return `${String(index + 1).padStart(2, '0')}-${clean || 'attachment.txt'}`;
}
function buildRequestEnvelope(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return false;
  if (json.schema === 5) return typeof json.config === 'string';
  if (json.schema !== 6) return false;
  return typeof json.sourceEnv === 'string' && typeof json.requestCommit === 'string' &&
    typeof json.requestId === 'string' && Array.isArray(json.overrides) && !Object.hasOwn(json, 'config');
}
function detect(name, text) {
  if (text.trimStart().startsWith('{')) {
    try {
      const json = JSON.parse(text);
      if (buildRequestEnvelope(json)) return 'json';
    } catch (e) { fail(`${name}: invalid JSON: ${e.message}`); }
  }
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const valid = lines.every((line) => line === '' || line.startsWith('#') || /^CONFIG_[A-Za-z0-9_+.-]+=.*$/.test(line));
  if (!valid || !lines.some((line) => /^CONFIG_/.test(line))) fail(`${name}: not JSON, .config, or config.buildinfo`);
  return /config\.buildinfo$/i.test(name) ? 'buildinfo' : 'config';
}

if (inlinePayload && named.length) fail('mobile inline request and file attachment cannot be mixed');
if (!inlinePayload && (named.length < 1 || named.length > MAX_FILES)) {
  fail(`expected 1..${MAX_FILES} GitHub user attachments, found ${named.length}`);
}
mkdirSync(outputDir, { recursive: true });
const files = [];
if (inlinePayload) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(inlinePayload)) fail('mobile inline request is not valid base64');
  let buffer;
  try { buffer = gunzipSync(Buffer.from(inlinePayload, 'base64')); }
  catch (e) { fail('mobile inline request cannot be decompressed: ' + e.message); }
  if (buffer.length < 32 || buffer.length > MAX_BYTES) fail(`mobile inline request size must be 32B..2MB, got ${buffer.length}`);
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch (e) { fail('mobile inline request is not valid UTF-8 text'); }
  if (text.charCodeAt(0) === 0xFEFF || text.includes('\0')) fail('mobile inline request has BOM/NUL');
  if (detect('mobile-inline-build-request.json', text) !== 'json') fail('mobile inline request must be build-request.json');
  const path = join(outputDir, '01-mobile-inline-build-request.json');
  writeFileSync(path, buffer);
  files.push({ name: 'mobile-inline-build-request.json', path, type: 'json', bytes: buffer.length });
}
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
console.log(`${inlinePayload ? 'Decoded mobile request' : 'Downloaded'} ${files.length} authoritative request(s) / 已取得 ${files.length} 个权威请求 -> ${output}`);
