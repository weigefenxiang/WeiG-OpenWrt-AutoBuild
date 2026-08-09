#!/usr/bin/env node
// Regression matrix for deterministic full-site SHA-256 release identity.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeSiteSha256 } from './site-release.mjs';

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

  console.log('site release SHA-256 matrix passed');
} finally {
  rmSync(root, { recursive: true, force: true });
}
