#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createCatalogModel } from '../site/wrt/lib/catalog-engine.mjs';
import { createCatalogLoader, formatCatalogDiagnostics, sha256Hex } from '../site/wrt/lib/catalog-loader.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function catalog(commit, schema = 5, relationsSchema = 2) {
  return {
    schema,
    source: { repo: 'example/upstream', commit },
    targets: [],
    menu: { options: [], choices: [], categories: [] },
    relations: { schema: relationsSchema, records: [], indexes: {} },
  };
}

function compressedDocument(document) {
  const bytes = gzipSync(Buffer.from(JSON.stringify(document)));
  return {
    bytes,
    hash: createHash('sha256').update(bytes).digest('hex'),
  };
}

function indexFor(asset, payload, commit, ref = '1'.repeat(40)) {
  return {
    schema: 2,
    assetRef: ref,
    sources: [{
      id: 'ImmortalWrt', repo: 'example/upstream', branches: [{
        id: '25.12', branch: 'openwrt-25.12', asset,
        bytes: payload.bytes.length, hash: payload.hash, commit, state: 'fresh',
      }],
    }],
  };
}

function fakeCaches() {
  const stores = new Map();
  return {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async match(key) { return store.get(String(key))?.clone() || null; },
        async put(key, response) { store.set(String(key), response.clone()); },
        async delete(key) { return store.delete(String(key)); },
      };
    },
    async delete(name) { return stores.delete(name); },
  };
}

const abc = new TextEncoder().encode('abc').buffer;
assert(await sha256Hex(abc, null) ===
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
'pure JavaScript SHA-256 fallback failed');

const commit = '2'.repeat(40);
const asset = 'immortalwrt--openwrt-25.12.json.gz';
const valid = compressedDocument(catalog(commit));
const index = indexFor(asset, valid, commit);
const wrong = Buffer.from('not-the-catalog');
const calls = [];
const fetchImpl = async (url) => {
  calls.push(url);
  if (url.includes('raw.githubusercontent.com') && url.includes('index.json')) {
    return new Response(JSON.stringify(index), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.includes('cdn.jsdelivr.net') && url.includes(asset)) {
    return new Response(wrong, { status: 200 });
  }
  if (url.includes('raw.githubusercontent.com') && url.includes(asset)) {
    return new Response(valid.bytes, { status: 200 });
  }
  return new Response('missing', { status: 404 });
};
const loader = createCatalogLoader({
  repository: 'owner/catalog',
  engine: { createCatalogModel },
  fetchImpl,
  cacheStorage: fakeCaches(),
  subtle: null,
  now: () => 123,
});
const first = await loader.fetchBundle({ sourceId: 'ImmortalWrt', branchName: 'openwrt-25.12' });
assert(first.provider === 'github-raw', 'invalid jsDelivr asset did not fall back to GitHub Raw');
assert(first.indexProvider === 'github-raw', 'latest index was not loaded from GitHub Raw first');
assert(first.model.catalog.schema === 5, 'validated Catalog model was not returned');
assert(first.diagnostics.some((row) => !row.ok && row.provider === 'jsdelivr' && /byte length|SHA-256/.test(row.detail)),
'jsDelivr hash failure was not diagnosed');
assert(!calls.some((url) => url.includes('cdn.jsdelivr.net') && url.includes('index.json')),
'jsDelivr index was requested even though GitHub Raw index succeeded');

const beforeCache = calls.length;
const cached = await loader.fetchBundle({ sourceId: 'ImmortalWrt', branchName: 'openwrt-25.12' });
assert(cached.provider === 'cache', 'validated Catalog cache was not reused');
assert(calls.length === beforeCache, 'cache reuse performed an unexpected network request');

await loader.clearCache();
const fallbackCalls = [];
const fallbackFetch = async (url) => {
  fallbackCalls.push(url);
  if (url.includes('raw.githubusercontent.com') && url.includes('index.json')) {
    return new Response('offline', { status: 503 });
  }
  if (url.includes('cdn.jsdelivr.net') && url.includes('index.json')) {
    return new Response(JSON.stringify(index), { status: 200 });
  }
  if (url.includes('cdn.jsdelivr.net') && url.includes(asset)) {
    return new Response(valid.bytes, { status: 200 });
  }
  return new Response('missing', { status: 404 });
};
const fallbackLoader = createCatalogLoader({
  repository: 'owner/catalog',
  engine: { createCatalogModel },
  fetchImpl: fallbackFetch,
  cacheStorage: fakeCaches(),
  subtle: null,
  now: () => 456,
});
const fallback = await fallbackLoader.fetchBundle({
  sourceId: 'ImmortalWrt', branchName: 'openwrt-25.12', forceRefresh: true,
});
assert(fallback.indexProvider === 'jsdelivr', 'index provider fallback did not reach jsDelivr');
assert(fallback.provider === 'jsdelivr', 'valid jsDelivr immutable asset was not accepted');
assert(fallbackCalls[0].includes('raw.githubusercontent.com') && fallbackCalls[0].includes('wrt_refresh=456'),
'GitHub Raw refresh-busted index was not attempted first');

const releaseCalls = [];
const releaseFetch = async (url) => {
  releaseCalls.push(url);
  if (url.includes('raw.githubusercontent.com') && url.includes('index.json')) {
    return new Response('offline', { status: 503 });
  }
  if (url.includes('cdn.jsdelivr.net') && url.includes('index.json')) {
    return new Response('offline', { status: 503 });
  }
  if (url.includes('/releases/download/menuconfig-catalog-complete/index.json')) {
    return new Response(JSON.stringify(index), { status: 200 });
  }
  if ((url.includes('cdn.jsdelivr.net') || url.includes('raw.githubusercontent.com')) && url.includes(asset)) {
    return new Response('offline', { status: 503 });
  }
  if (url.includes('/releases/download/menuconfig-catalog-complete/') && url.includes(asset)) {
    return new Response(valid.bytes, { status: 200 });
  }
  return new Response('missing', { status: 404 });
};
const releaseLoader = createCatalogLoader({
  repository: 'owner/catalog',
  releaseTag: 'menuconfig-catalog-complete',
  engine: { createCatalogModel },
  fetchImpl: releaseFetch,
  cacheStorage: fakeCaches(),
  subtle: null,
  now: () => 789,
});
const releaseFallback = await releaseLoader.fetchBundle({
  sourceId: 'ImmortalWrt', branchName: 'openwrt-25.12', forceRefresh: true,
});
assert(releaseFallback.indexProvider === 'github-release',
'index provider fallback did not reach the complete GitHub Release');
assert(releaseFallback.provider === 'github-release',
'asset provider fallback did not reach the complete GitHub Release');
assert(releaseCalls.some((url) => url.includes('/releases/download/menuconfig-catalog-complete/index.json?wrt_refresh=789')),
'GitHub Release index URL was not refresh-busted');
assert(releaseFallback.diagnostics.filter((row) => row.stage === 'index' && !row.ok).length === 2,
'GitHub Release index fallback diagnostics did not preserve both prior failures');

const stale = compressedDocument(catalog(commit, 4, 1));
let staleError = null;
const staleIndex = indexFor(asset, stale, commit, '3'.repeat(40));
const staleLoader = createCatalogLoader({
  repository: 'owner/catalog',
  engine: { createCatalogModel },
  cacheStorage: fakeCaches(),
  subtle: null,
  fetchImpl: async (url) => {
    if (url.includes('index.json')) return new Response(JSON.stringify(staleIndex), { status: 200 });
    return new Response(stale.bytes, { status: 200 });
  },
});
try {
  await staleLoader.fetchBundle({ sourceId: 'ImmortalWrt', branchName: 'openwrt-25.12' });
} catch (error) {
  staleError = error;
}
assert(staleError && /Catalog bundle unavailable/.test(staleError.message),
'stale Catalog schema was not rejected');
assert(formatCatalogDiagnostics(staleError.diagnostics).includes('Catalog schema 4; required 5'),
'stale schema reason is missing from diagnostics');

console.log('Catalog loader tests passed / Catalog 加载器测试通过');
