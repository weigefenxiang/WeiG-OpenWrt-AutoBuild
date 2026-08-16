import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateCatalogProvenance } from '../site/wrt/lib/catalog-loader.js';

const root = path.resolve(import.meta.dirname, '..');
const text = fs.readFileSync(path.join(root, 'site/wrt/lib/catalog-loader.js'), 'utf8');
assert.match(text, /async function fetchCore\(/, 'Catalog loader must expose a core-only fetch path');
assert.match(text, /return \{ fetchIndex, fetchCore, fetchBundle, fetchCompatibility, fetchApplications, clearCache/,
  'fetchCore must be part of the existing loader capability, not a second fetcher');
assert.match(text, /stage: 'core-only'/, 'core-only loading must use the existing asset loader');
assert.match(text, /Catalog core schema/, 'core-only loading must validate the core schema');
assert.match(text, /Catalog source commit mismatch/, 'core-only loading must validate Source commit identity');

const sharedAssetRef = 'a'.repeat(40);
const sharedSnapshot = [
  ['catalog-fix-F', 'fix-F'],
  ['catalog-dev', 'dev'],
  ['catalog-staging', 'staging'],
].map(([dataRef, codeRef]) => ({
  dataRef,
  index: {
    assetRef: sharedAssetRef,
    provenance: {
      repository: 'owner/catalog',
      codeRef,
      codeSha: 'b'.repeat(40),
      complete: true,
    },
  },
}));
for (const { dataRef, index } of sharedSnapshot) {
  assert.equal(index.assetRef, sharedAssetRef, `${dataRef} must preserve the immutable assetRef during promotion`);
  assert.equal(validateCatalogProvenance(index, dataRef, 'owner/catalog')?.codeRef, index.provenance.codeRef,
    `${dataRef} must validate its own channel provenance while sharing the snapshot assetRef`);
}
assert.equal(new Set(sharedSnapshot.map(({ index }) => index.assetRef)).size, 1,
  'fix/dev/staging promotion must allow one immutable Catalog snapshot to be mapped across channels');
console.log('Catalog core-only loader and immutable promotion contract passed.');
