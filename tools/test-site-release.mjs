#!/usr/bin/env node
// Regression matrix for deterministic full-site SHA-256 release identity.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeSiteSha256 } from './site-release.mjs';
import { canonicalizeSiteReleaseBytes, canonicalizeTextBytes } from './canonicalize-site-release.mjs';

const root = mkdtempSync(join(tmpdir(), 'weig-site-release-'));
const put = (rel, content) => {
  const path = join(root, ...rel.split('/'));
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
};

try {
  put('index.html', '<!doctype html>\n');
  put('app.js', 'console.log("one");\n');
  put('data/plugins.json', '{"plugins":[1]}\n');
  put('data/site-version.json', '{"ignored":1}\n');
  put('data/build-meta.json', '{"ignored":1}\n');

  const baseline = computeSiteSha256(root);
  const repeat = computeSiteSha256(root);
  assert.equal(repeat.siteSha256, baseline.siteSha256, 'unchanged tree must keep the same SHA-256');

  put('app.js', 'console.log("two");\n');
  const appChanged = computeSiteSha256(root);
  assert.notEqual(appChanged.siteSha256, baseline.siteSha256, 'app.js bytes must affect the release SHA');

  put('app.js', 'console.log("one");\n');
  put('data/plugins.json', '{"plugins":[2]}\n');
  const pluginChanged = computeSiteSha256(root);
  assert.notEqual(pluginChanged.siteSha256, baseline.siteSha256, 'plugin/runtime JSON bytes must affect the release SHA');

  put('data/plugins.json', '{"plugins":[1]}\n');
  put('data/new.json', '{"new":true}\n');
  const fileAdded = computeSiteSha256(root);
  assert.notEqual(fileAdded.siteSha256, baseline.siteSha256, 'adding a site file must affect the release SHA');
  rmSync(join(root, 'data', 'new.json'));

  rmSync(join(root, 'data', 'plugins.json'));
  const fileDeleted = computeSiteSha256(root);
  assert.notEqual(fileDeleted.siteSha256, baseline.siteSha256, 'deleting a site file must affect the release SHA');
  put('data/plugins.json', '{"plugins":[1]}\n');

  put('data/site-version.json', '{"ignored":2}\n');
  put('data/build-meta.json', '{"ignored":2}\n');
  const metadataChanged = computeSiteSha256(root);
  assert.equal(metadataChanged.siteSha256, baseline.siteSha256, 'release pointer/build metadata must be excluded');

  put('app.js', 'console.log("one");\r\n');
  const crlfChanged = computeSiteSha256(root);
  assert.notEqual(crlfChanged.siteSha256, baseline.siteSha256, 'published byte differences such as LF/CRLF must affect the release SHA');

  put('app.js', 'console.log("one");\n');
  const restored = computeSiteSha256(root);
  assert.equal(restored.siteSha256, baseline.siteSha256, 'restoring exact bytes must restore the release SHA');

  assert.throws(() => canonicalizeTextBytes(Buffer.from([0x00, 0x41]), 'lf', 'nul.txt'), /NUL bytes/);
  assert.throws(() => canonicalizeTextBytes(Buffer.from([0xef, 0xbb, 0xbf, 0x41]), 'lf', 'bom.txt'), /BOM/);
  assert.throws(() => canonicalizeTextBytes(Buffer.from([0xc3, 0x28]), 'lf', 'invalid.txt'), /UTF-8/);

  const binary = Buffer.from([0x00, 0x0d, 0x0a, 0xff, 0x10]);
  put('image.png', binary);
  put('app.js', 'console.log("one");\r\n');
  put('data/plugins.json', '{"plugins":[1]}\r\n');
  const staleWindows = computeSiteSha256(root);
  const dryRun = canonicalizeSiteReleaseBytes(root, { write: false });
  assert.deepEqual(dryRun.changedFiles.sort(), ['app.js', 'data/plugins.json'], 'dry-run must identify stale CRLF release text');
  assert.match(readFileSync(join(root, 'app.js'), 'utf8'), /\r\n/, 'dry-run must not mutate release bytes');
  const normalized = canonicalizeSiteReleaseBytes(root);
  assert.deepEqual(normalized.changedFiles.sort(), ['app.js', 'data/plugins.json'], 'canonicalizer must normalize stale CRLF release text');
  assert.equal(readFileSync(join(root, 'app.js'), 'utf8'), 'console.log("one");\n');
  assert.equal(readFileSync(join(root, 'data', 'plugins.json'), 'utf8'), '{"plugins":[1]}\n');
  assert.deepEqual(readFileSync(join(root, 'image.png')), binary, 'binary release assets must remain byte-for-byte unchanged');
  const canonical = computeSiteSha256(root);
  assert.notEqual(canonical.siteSha256, staleWindows.siteSha256, 'canonical LF bytes must differ from stale CRLF raw-byte SHA');
  const secondPass = canonicalizeSiteReleaseBytes(root);
  assert.equal(secondPass.changedFiles.length, 0, 'canonicalization must be idempotent');
  assert.equal(computeSiteSha256(root).siteSha256, canonical.siteSha256, 'idempotent canonicalization must preserve the release SHA');

  console.log('site release SHA-256 + canonical release bytes matrix passed');
} finally {
  rmSync(root, { recursive: true, force: true });
}
