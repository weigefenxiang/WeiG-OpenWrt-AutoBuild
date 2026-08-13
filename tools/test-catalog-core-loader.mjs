import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const text = fs.readFileSync(path.join(root, 'site/wrt/lib/catalog-loader.js'), 'utf8');
assert.match(text, /async function fetchCore\(/, 'Catalog loader must expose a core-only fetch path');
assert.match(text, /return \{ fetchIndex, fetchCore, fetchBundle, fetchCompatibility, fetchApplications, clearCache/,
  'fetchCore must be part of the existing loader capability, not a second fetcher');
assert.match(text, /stage: 'core-only'/, 'core-only loading must use the existing asset loader');
assert.match(text, /Catalog core schema/, 'core-only loading must validate the core schema');
assert.match(text, /Catalog source commit mismatch/, 'core-only loading must validate Source commit identity');
console.log('Catalog core-only loader contract passed.');
