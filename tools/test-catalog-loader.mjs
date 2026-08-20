#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createCatalogModel } from '../site/wrt/lib/catalog-engine.js';
import {
  createCatalogLoader, formatCatalogDiagnostics, legacyCatalogContract, sha256Hex, validateCatalogProvenance,
} from '../site/wrt/lib/catalog-loader.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertThrows(run, pattern, message = 'expected operation to throw') {
  try {
    run();
  } catch (error) {
    if (pattern.test(String(error?.message || error))) return;
    throw new Error(`${message}: unexpected error: ${error?.message || error}`);
  }
  throw new Error(message);
}

async function assertRejects(run, pattern, message) {
  try {
    await run();
  } catch (error) {
    if (pattern.test(String(error?.message || error))) return;
    throw new Error(`${message}: unexpected error: ${error?.message || error}`);
  }
  throw new Error(message);
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

const explicitLegacy = legacyCatalogContract({
  schema: 6,
  asset: 'ambiguous-root.json.gz', hash: 'a'.repeat(64), bytes: 1,
  assets: { core: { asset: 'core.json.gz' }, graph: { asset: 'graph.json.gz' } },
  legacy: {
    asset: 'legacy.json.gz', hash: 'b'.repeat(64), bytes: 123,
    catalogSchema: 5, relationsSchema: 2,
  },
});
assert(explicitLegacy?.asset === 'legacy.json.gz' && explicitLegacy.catalogSchema === 5 &&
  explicitLegacy.relationsSchema === 2, 'explicit legacy build contract was not selected');
assert(legacyCatalogContract({
  schema: 6, asset: 'ambiguous-root.json.gz', hash: 'a'.repeat(64), bytes: 1,
  assets: { core: { asset: 'core.json.gz' }, graph: { asset: 'graph.json.gz' } },
}) === null, 'schema-6 root metadata was incorrectly treated as a legacy build contract');
assert(legacyCatalogContract({
  schema: 5, asset: 'old.json.gz', hash: 'c'.repeat(64), bytes: 42,
})?.relationsSchema === 2, 'legacy-only schema-5 index compatibility was lost');

const provenanceSha = 'f'.repeat(40);
const provenanceBase = {
  provenance: { repository: 'owner/catalog', codeRef: 'dev', codeSha: provenanceSha, complete: true },
};
assert(validateCatalogProvenance(provenanceBase, 'catalog-dev', 'owner/catalog')?.codeRef === 'dev',
  'catalog-dev provenance did not validate');
assert(validateCatalogProvenance({}, 'catalog-dev', 'owner/catalog') === null,
  'legacy index without provenance lost backward compatibility');
assertThrows(() => validateCatalogProvenance({ provenance: { ...provenanceBase.provenance, codeRef: 'fix/demo' } },
  'catalog-fix', 'owner/catalog'), /invalid Catalog data branch/, 'bare catalog-fix unexpectedly remained valid');
assert(validateCatalogProvenance({ provenance: { ...provenanceBase.provenance, codeRef: 'fix-F' } },
  'catalog-fix-F', 'owner/catalog')?.codeRef === 'fix-F', 'canonical catalog-fix-F provenance did not validate');
assertThrows(() => validateCatalogProvenance({ provenance: { ...provenanceBase.provenance, codeRef: 'fix-G' } },
  'catalog-fix-F', 'owner/catalog'), /does not match catalog-fix-F/);
assertThrows(() => validateCatalogProvenance({ provenance: { ...provenanceBase.provenance, codeRef: 'main' } },
  'catalog-dev', 'owner/catalog'), /does not match catalog-dev/);
assertThrows(() => validateCatalogProvenance({ provenance: { ...provenanceBase.provenance, repository: 'other/catalog' } },
  'catalog-dev', 'owner/catalog'), /repository mismatch/);
assertThrows(() => validateCatalogProvenance({ provenance: { ...provenanceBase.provenance, codeRef: 'main', complete: false } },
  'catalog-main', 'owner/catalog'), /must be complete/);
assertThrows(() => validateCatalogProvenance({ provenance: { ...provenanceBase.provenance, codeSha: 'short' } },
  'catalog-dev', 'owner/catalog'), /full codeSha/);

const abc = new TextEncoder().encode('abc').buffer;
assert(await sha256Hex(abc, null) ===
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
'pure JavaScript SHA-256 fallback failed');

const commit = '2'.repeat(40);
const asset = 'immortalwrt--openwrt-25.12.json.gz';
const valid = compressedDocument(catalog(commit));
const index = indexFor(asset, valid, commit);
index.provenance = { repository: 'owner/catalog', codeRef: 'main', codeSha: provenanceSha, complete: true };
const wrong = Buffer.from('not-the-catalog');
let catalogDecodeCount = 0;
function CountingDecompressionStream(format) {
  catalogDecodeCount++;
  return new DecompressionStream(format);
}
const calls = [];
const fetchImpl = async (url) => {
  calls.push(url);
  if (url.includes('cdn.jsdelivr.net') && url.includes('index.json')) {
    return new Response(JSON.stringify(index), { status: 200, headers: { 'content-type': 'application/json' } });
  }
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
  Decompression: CountingDecompressionStream,
  now: () => 123,
});
const first = await loader.fetchBundle({ sourceId: 'ImmortalWrt', branchName: 'openwrt-25.12' });
assert(first.provider === 'github-raw', 'invalid jsDelivr asset did not fall back to GitHub Raw');
assert(first.indexProvider === 'jsdelivr', 'latest index was not loaded from jsDelivr first');
assert(first.model.catalog.schema === 5, 'validated Catalog model was not returned');
assert(catalogDecodeCount === 1, `network Catalog decoded ${catalogDecodeCount} times; expected once`);
assert(first.diagnostics.some((row) => !row.ok && row.provider === 'jsdelivr' && /byte length|SHA-256/.test(row.detail)),
'jsDelivr hash failure was not diagnosed');
assert(!calls.some((url) => url.includes('raw.githubusercontent.com') && url.includes('index.json')),
'GitHub Raw index was requested even though jsDelivr succeeded');

const beforeCache = calls.length;
const cached = await loader.fetchBundle({ sourceId: 'ImmortalWrt', branchName: 'openwrt-25.12' });
assert(cached.provider === 'cache', 'validated Catalog cache was not reused');
assert(calls.length === beforeCache, 'cache reuse performed an unexpected network request');
assert(catalogDecodeCount === 2,
  `cached Catalog decoded ${catalogDecodeCount - 1} times; expected exactly once on cache hit`);

await loader.clearCache();
const fallbackCalls = [];
const fallbackFetch = async (url) => {
  fallbackCalls.push(url);
  if (url.includes('cdn.jsdelivr.net') && url.includes('index.json')) {
    return new Response('offline', { status: 503 });
  }
  if (url.includes('raw.githubusercontent.com') && url.includes('index.json')) {
    return new Response(JSON.stringify(index), { status: 200 });
  }
  if (url.includes('raw.githubusercontent.com') && url.includes(asset)) {
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
assert(fallback.indexProvider === 'github-raw', 'index provider fallback did not reach GitHub Raw');
assert(fallback.provider === 'github-raw', 'valid GitHub Raw immutable asset was not accepted');
assert(fallbackCalls[0].includes('raw.githubusercontent.com') && fallbackCalls[0].includes('wrt_refresh=456'),
'forced refresh did not ask GitHub Raw for the mutable index first');
assert(fallbackCalls[1].includes('cdn.jsdelivr.net') && fallbackCalls[1].includes(asset),
'forced index refresh unexpectedly stopped immutable assets from using CDN-first delivery');

const apiCalls = [];
const apiFetch = async (url, options = {}) => {
  apiCalls.push({ url, options });
  if ((url.includes('cdn.jsdelivr.net') || url.includes('raw.githubusercontent.com')) && url.includes('index.json')) {
    return new Response('unavailable', { status: url.includes('cdn.jsdelivr.net') ? 404 : 429 });
  }
  if (url.includes('api.github.com') && url.includes('/contents/index.json?ref=catalog-main')) {
    return new Response(JSON.stringify(index), { status: 200 });
  }
  if ((url.includes('cdn.jsdelivr.net') || url.includes('raw.githubusercontent.com')) && url.includes(asset)) {
    return new Response('unavailable', { status: 503 });
  }
  if (url.includes('api.github.com') && url.includes(`/contents/${asset}?ref=${index.assetRef}`)) {
    return new Response(valid.bytes, { status: 200 });
  }
  return new Response('missing', { status: 404 });
};
const apiLoader = createCatalogLoader({
  repository: 'owner/catalog',
  dataRef: 'catalog-main',
  allowReleaseFallback: false,
  engine: { createCatalogModel },
  fetchImpl: apiFetch,
  cacheStorage: fakeCaches(),
  subtle: null,
  now: () => 654,
});
const apiFallback = await apiLoader.fetchBundle({
  sourceId: 'ImmortalWrt', branchName: 'openwrt-25.12', forceRefresh: true,
});
assert(apiFallback.indexProvider === 'github-api' && apiFallback.provider === 'github-api',
  'GitHub Contents API did not recover the Catalog index and immutable asset');
assert(apiCalls.slice(0, 2).map((call) => new URL(call.url).hostname).join(',') ===
  'raw.githubusercontent.com,api.github.com',
  'forced Catalog index refresh no longer runs GitHub Raw -> GitHub API first');
assert(apiCalls.filter((call) => call.url.includes('api.github.com')).every((call) =>
  call.options.headers?.accept === 'application/vnd.github.raw+json'),
  'GitHub Contents API requests lost the raw response media type');
assert(apiCalls.some((call) => call.url.includes(`/contents/${asset}?ref=${index.assetRef}`)),
  'GitHub Contents API asset request did not use the immutable assetRef');
assert(apiFallback.diagnostics.filter((row) => row.stage === 'index' && !row.ok)
  .map((row) => row.provider).join(',') === 'github-raw',
  'GitHub API recovery diagnostics did not preserve the prior Raw failure');

const freshCdnCalls = [];
const freshCdnFetch = async (url, options = {}) => {
  freshCdnCalls.push({ url, options });
  if (url.includes('raw.githubusercontent.com') && url.includes('index.json')) {
    return new Response('raw unavailable', { status: 503 });
  }
  if (url.includes('api.github.com') && url.includes('/contents/index.json?ref=catalog-main')) {
    return new Response('api unavailable', { status: 503 });
  }
  if (url.includes('cdn.jsdelivr.net') && url.includes('index.json')) {
    return new Response(JSON.stringify(index), { status: 200 });
  }
  if (url.includes('cdn.jsdelivr.net') && url.includes(asset)) {
    return new Response(valid.bytes, { status: 200 });
  }
  return new Response('missing', { status: 404 });
};
const freshCdnLoader = createCatalogLoader({
  repository: 'owner/catalog',
  dataRef: 'catalog-main',
  allowReleaseFallback: false,
  engine: { createCatalogModel },
  fetchImpl: freshCdnFetch,
  cacheStorage: fakeCaches(),
  subtle: null,
  now: () => 777,
});
const freshCdn = await freshCdnLoader.fetchBundle({
  sourceId: 'ImmortalWrt', branchName: 'openwrt-25.12', forceRefresh: true,
});
assert(freshCdn.indexProvider === 'jsdelivr' && freshCdn.provider === 'jsdelivr',
  'jsDelivr did not remain the final mutable-index fallback and first immutable-asset provider');
assert(freshCdnCalls.slice(0, 3).map((call) => new URL(call.url).hostname).join(',') ===
  'raw.githubusercontent.com,api.github.com,cdn.jsdelivr.net',
  'forced Catalog index fallback no longer runs Raw -> GitHub API -> jsDelivr');

const releaseCalls = [];
const releaseFetch = async (url) => {
  releaseCalls.push(url);
  if (url.includes('raw.githubusercontent.com') && url.includes('index.json')) {
    return new Response('offline', { status: 503 });
  }
  if (url.includes('cdn.jsdelivr.net') && url.includes('index.json')) {
    return new Response('offline', { status: 503 });
  }
  if (url.includes('api.github.com') && url.includes('index.json')) {
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
assert(releaseFallback.diagnostics.filter((row) => row.stage === 'index' && !row.ok).length === 3,
'GitHub Release index fallback diagnostics did not preserve all prior failures');
assert(releaseCalls.slice(0, 4).map((url) => new URL(url).hostname).join(',') ===
  'raw.githubusercontent.com,api.github.com,cdn.jsdelivr.net,github.com',
  'forced production index fallback no longer keeps GitHub Release last');

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
const ordinaryIndex = { ...index, assetRef: '8'.repeat(40) };
const refreshedIndex = { ...index, assetRef: '9'.repeat(40) };
const ordinaryIndexResponse = deferred();
const refreshedIndexResponse = deferred();
const raceCalls = [];
const raceLoader = createCatalogLoader({
  repository: 'owner/catalog',
  dataRef: 'catalog-main',
  allowReleaseFallback: false,
  engine: { createCatalogModel },
  cacheStorage: fakeCaches(),
  subtle: null,
  fetchImpl: async (url) => {
    raceCalls.push(url);
    if (url.includes('cdn.jsdelivr.net') && url.includes('index.json')) return ordinaryIndexResponse.promise;
    if (url.includes('raw.githubusercontent.com') && url.includes('index.json')) return refreshedIndexResponse.promise;
    return new Response('missing', { status: 404 });
  },
});
const ordinaryIndexRun = raceLoader.fetchIndex();
await Promise.resolve();
const refreshedIndexRun = raceLoader.fetchIndex({ forceRefresh: true });
await Promise.resolve();
ordinaryIndexResponse.resolve(new Response(JSON.stringify(ordinaryIndex), { status: 200 }));
await ordinaryIndexRun;
const followerIndexRun = raceLoader.fetchIndex();
refreshedIndexResponse.resolve(new Response(JSON.stringify(refreshedIndex), { status: 200 }));
const [refreshedIndexResult, followerIndexResult] = await Promise.all([refreshedIndexRun, followerIndexRun]);
assert(refreshedIndexResult.index.assetRef === refreshedIndex.assetRef &&
  followerIndexResult.index.assetRef === refreshedIndex.assetRef,
  'an older index request cleared or outranked the newer forced-refresh promise');
assert(raceCalls.filter((url) => url.includes('index.json')).length === 2,
  'index refresh race unexpectedly started a third mutable-index request');

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
assert(staleError && /Catalog schema 4; required 5/.test(staleError.message),
'stale Catalog schema was not rejected');
assert(formatCatalogDiagnostics(staleError.diagnostics).includes('Catalog schema 4; required 5'),
'stale schema reason is missing from diagnostics');

const splitCommit = '4'.repeat(40);
const compactEmpty = {
  schema: 3,
  fields: [],
  flags: { visible: 1, userSettable: 2, canDisable: 4, hasKconfig: 8, package: 16 },
  types: ['', 'bool', 'tristate', 'string', 'int', 'hex'],
  origins: ['', 'kconfig-only', 'kconfig+packageinfo', 'hidden-kconfig-only',
    'hidden-kconfig+packageinfo', 'packageinfo-only'],
  strings: [], expressions: [], stringLists: [], expressionLists: [], expressionVariants: [],
  defaults: [], packageDependencies: [], records: [],
  indexes: { providers: [], reverseDependencies: [], reverseKconfig: [], choices: [] },
  summary: {}, validation: { structurallyValid: true },
};
const splitDocuments = {
  core: compressedDocument({
    schema: 6, source: { repo: 'example/upstream', commit: splitCommit },
    targets: [], targetTree: [], targetSelectors: [], counts: {},
  }),
  graph: compressedDocument({
    schema: 6, kind: 'graph', source: { repo: 'example/upstream', commit: splitCommit },
    relations: compactEmpty,
  }),
  menu: compressedDocument({ schema: 1, kind: 'menu', options: [], choices: [], labels: {}, categories: [] }),
};
const splitAssets = Object.fromEntries(Object.entries(splitDocuments).map(([logical, payload]) => [logical, {
  asset: `immortalwrt--openwrt-25.12.${logical}.json.gz`,
  bytes: payload.bytes.length,
  hash: payload.hash,
}]));
const splitIndex = indexFor(asset, valid, splitCommit, '5'.repeat(40));
splitIndex.sources[0].branches[0] = {
  ...splitIndex.sources[0].branches[0], commit: splitCommit, schema: 6, assets: splitAssets,
  legacy: {
    asset, hash: valid.hash, bytes: valid.bytes.length, catalogSchema: 5, relationsSchema: 2,
  },
};
const splitCalls = [];
const splitLoader = createCatalogLoader({
  repository: 'owner/catalog',
  engine: { createCatalogModel },
  cacheStorage: fakeCaches(),
  subtle: null,
  fetchImpl: async (url) => {
    splitCalls.push(url);
    if (url.includes('index.json')) return new Response(JSON.stringify(splitIndex), { status: 200 });
    for (const [logical, contract] of Object.entries(splitAssets)) {
      if (url.includes(contract.asset)) return new Response(splitDocuments[logical].bytes, { status: 200 });
    }
    return new Response('unexpected', { status: 404 });
  },
});
const splitBundle = await splitLoader.fetchBundle({ sourceId: 'ImmortalWrt', branchName: 'openwrt-25.12' });
assert(splitBundle.data.schema === 6 && splitBundle.data.splitAssets === true &&
  splitBundle.model.catalog.relations.schema === 3, 'schema 6 core/graph bundle was not assembled');
assert(!splitCalls.some((url) => url.includes(splitAssets.menu.asset)),
  'menu shard was downloaded before Advanced requested it');
const splitMenu = await splitBundle.loadShard('menu');
assert(splitMenu.kind === 'menu' && splitCalls.some((url) => url.includes(splitAssets.menu.asset)),
  'lazy menu shard was not downloaded on demand');
const splitCallCount = splitCalls.length;
await splitBundle.loadShard('menu');
assert(splitCalls.length === splitCallCount, 'loaded menu shard was not reused');

const compatibilityDocument = {
  schema: 2,
  rules: [{
    id: 'OWN-TEST', issue: 'file-ownership', match: 'all-installed', scope: { ImmortalWrt: ['openwrt-25.12'] },
    if: 'USE_APK', packages: ['package-a', 'package-b'], paths: ['/etc/config/demo'], refs: ['run:1'],
  }],
};
const compatibilityPayload = compressedDocument(compatibilityDocument);
const compatibilityIndex = indexFor(asset, valid, commit, '6'.repeat(40));
compatibilityIndex.assets = {
  compatibility: {
    asset: 'compatibility.json.gz', hash: compatibilityPayload.hash,
    bytes: compatibilityPayload.bytes.length,
    jsonBytes: new TextEncoder().encode(JSON.stringify(compatibilityDocument)).byteLength,
    schema: 2, rules: 1,
  },
};
const compatibilityCalls = [];
const compatibilityLoader = createCatalogLoader({
  repository: 'owner/catalog',
  engine: { createCatalogModel },
  fetchImpl: async (url) => {
    compatibilityCalls.push(url);
    if (url.includes('index.json')) return new Response(JSON.stringify(compatibilityIndex), { status: 200 });
    if (url.includes('compatibility.json.gz')) return new Response(compatibilityPayload.bytes, { status: 200 });
    return new Response('unexpected', { status: 404 });
  },
  cacheStorage: fakeCaches(), subtle: null,
});
const compatibilityFirst = await compatibilityLoader.fetchCompatibility();
const compatibilityAssetCalls = () => compatibilityCalls.filter((url) => url.includes('compatibility.json.gz')).length;
assert(compatibilityFirst.compatibility.rules[0].id === 'OWN-TEST' && compatibilityAssetCalls() === 1,
  'compatibility asset was not verified and decoded');
await compatibilityLoader.fetchCompatibility();
assert(compatibilityAssetCalls() === 1, 'compatibility in-memory cache did not suppress a second fetch');
await compatibilityLoader.fetchCompatibility({ forceRefresh: true });
assert(compatibilityAssetCalls() === 1,
  'unchanged compatibility SHA was downloaded after an index refresh');

const applicationsDocument = {
  schema: 1,
  groups: ['Network'],
  probeUi: {
    schema: 1,
    languages: ['en', 'zh-CN'],
    strings: Object.fromEntries([
      'title', 'intro', 'howTo', 'search', 'selected', 'depth', 'scope', 'targets',
      'allSources', 'currentSource', 'customScope', 'autoTarget', 'currentTarget', 'allTargets',
      'packageCompile', 'packageCompileHelp', 'rootfsIntegration', 'rootfsIntegrationHelp',
      'firmwareIntegration', 'firmwareIntegrationHelp', 'bootSmoke', 'bootSmokeHelp',
      'preview', 'submit', 'submittedState', 'stateInstruction', 'cancelInstruction',
      'permission', 'retention', 'issueTitle', 'loading', 'empty', 'invalid',
    ].map((key, index) => [key, { en: `English ${index}`, 'zh-CN': `中文 ${index}` }])),
  },
  items: [{ id: 'demo', package: 'luci-app-demo', group: 'Network', titleEn: 'Demo', titleZh: '示例' }],
};
const applicationsPayload = compressedDocument(applicationsDocument);
const applicationsIndex = indexFor(asset, valid, commit, '7'.repeat(40));
applicationsIndex.assets = {
  applications: {
    asset: 'applications.json.gz', hash: applicationsPayload.hash,
    bytes: applicationsPayload.bytes.length,
    jsonBytes: new TextEncoder().encode(JSON.stringify(applicationsDocument)).byteLength,
    schema: 1, items: 1,
  },
};
const applicationsCalls = [];
const applicationsLoader = createCatalogLoader({
  repository: 'owner/catalog', engine: { createCatalogModel }, cacheStorage: fakeCaches(), subtle: null,
  fetchImpl: async (url) => {
    applicationsCalls.push(url);
    if (url.includes('index.json')) return new Response(JSON.stringify(applicationsIndex), { status: 200 });
    if (url.includes('applications.json.gz')) return new Response(applicationsPayload.bytes, { status: 200 });
    return new Response('unexpected', { status: 404 });
  },
});
const applicationsFirst = await applicationsLoader.fetchApplications();
assert(applicationsFirst.applications.items[0].id === 'demo',
  'applications asset was not verified and decoded');
await applicationsLoader.fetchApplications();
await applicationsLoader.fetchApplications({ forceRefresh: true });
assert(applicationsCalls.filter((url) => url.includes('applications.json.gz')).length === 1,
  'applications cache downloaded an unchanged SHA twice');
const invalidApplicationsDocument = structuredClone(applicationsDocument);
delete invalidApplicationsDocument.probeUi.strings.title.en;
const invalidApplicationsPayload = compressedDocument(invalidApplicationsDocument);
const invalidApplicationsIndex = structuredClone(applicationsIndex);
invalidApplicationsIndex.assets.applications.hash = invalidApplicationsPayload.hash;
invalidApplicationsIndex.assets.applications.bytes = invalidApplicationsPayload.bytes.length;
invalidApplicationsIndex.assets.applications.jsonBytes = new TextEncoder().encode(JSON.stringify(invalidApplicationsDocument)).byteLength;
const invalidApplicationsLoader = createCatalogLoader({
  repository: 'owner/catalog', engine: { createCatalogModel }, cacheStorage: fakeCaches(), subtle: null,
  fetchImpl: async (url) => url.includes('index.json')
    ? new Response(JSON.stringify(invalidApplicationsIndex), { status: 200 })
    : new Response(invalidApplicationsPayload.bytes, { status: 200 }),
});
await assertRejects(() => invalidApplicationsLoader.fetchApplications(), /applications document/,
  'applications probe UI without bilingual strings was accepted');
for (const mutate of [
  (value) => { value.assets.applications.schema = 2; },
  (value) => { value.assets.applications.items = -1; },
  (value) => { delete value.assets.applications.jsonBytes; },
]) {
  const invalidIndex = structuredClone(applicationsIndex);
  mutate(invalidIndex);
  const invalidLoader = createCatalogLoader({
    repository: 'owner/catalog', engine: { createCatalogModel }, cacheStorage: fakeCaches(), subtle: null,
    fetchImpl: async (url) => url.includes('index.json')
      ? new Response(JSON.stringify(invalidIndex), { status: 200 })
      : new Response(applicationsPayload.bytes, { status: 200 }),
  });
  await assertRejects(() => invalidLoader.fetchApplications(), /applications asset contract/,
    'invalid applications contract was accepted');
}

const previewCalls = [];
const previewIndex = structuredClone(index);
previewIndex.provenance = { repository: 'owner/catalog', codeRef: 'fix-test', codeSha: provenanceSha, complete: false };
const previewLoader = createCatalogLoader({
  repository: 'owner/catalog', dataRef: 'catalog-fix-test',
  engine: { createCatalogModel }, cacheStorage: fakeCaches(), subtle: null,
  fetchImpl: async (url) => {
    previewCalls.push(url);
    if (url.includes('raw.githubusercontent.com')) return new Response('offline', { status: 503 });
    if (url.includes('cdn.jsdelivr.net') && url.includes('index.json')) {
      return new Response(JSON.stringify(previewIndex), { status: 200 });
    }
    return new Response('unexpected', { status: 404 });
  },
});
const preview = await previewLoader.fetchIndex({ forceRefresh: true });
assert(preview.provider === 'jsdelivr' && previewCalls.some((url) => url.includes('@catalog-fix-test/index.json')),
  'canonical fix channel did not read catalog-fix-test');
assert(!previewCalls.some((url) => url.includes('/releases/')),
  'preview channel attempted to read the production Release');

for (const mutate of [
  (value) => { value.assets.compatibility.schema = 1; },
  (value) => { value.assets.compatibility.schema = 0; },
  (value) => { value.assets.compatibility.schema = 3; },
  (value) => { delete value.assets.compatibility.jsonBytes; },
  (value) => { value.assets.compatibility.jsonBytes = 512 * 1024 + 1; },
  (value) => { value.assets.compatibility.bytes = 512 * 1024 + 1025; },
]) {
  const invalidIndex = structuredClone(compatibilityIndex);
  mutate(invalidIndex);
  const invalidLoader = createCatalogLoader({
    repository: 'owner/catalog', engine: { createCatalogModel }, cacheStorage: fakeCaches(), subtle: null,
    fetchImpl: async (url) => url.includes('index.json')
      ? new Response(JSON.stringify(invalidIndex), { status: 200 }) : new Response('unexpected', { status: 404 }),
  });
  await assertRejects(() => invalidLoader.fetchCompatibility(), /compatibility asset contract/,
    'invalid compatibility contract was accepted');
}

for (const mutate of [
  (value) => { value.schema = 1; },
  (value) => { value.schema = 0; },
  (value) => { value.schema = 3; },
  (value) => { value.rules.push(structuredClone(value.rules[0])); },
]) {
  const invalidDocument = structuredClone(compatibilityDocument);
  mutate(invalidDocument);
  const invalidPayload = compressedDocument(invalidDocument);
  const invalidIndex = structuredClone(compatibilityIndex);
  invalidIndex.assets.compatibility.hash = invalidPayload.hash;
  invalidIndex.assets.compatibility.bytes = invalidPayload.bytes.length;
  const invalidLoader = createCatalogLoader({
    repository: 'owner/catalog', engine: { createCatalogModel }, cacheStorage: fakeCaches(), subtle: null,
    fetchImpl: async (url) => url.includes('index.json')
      ? new Response(JSON.stringify(invalidIndex), { status: 200 }) : new Response(invalidPayload.bytes, { status: 200 }),
  });
  await assertRejects(() => invalidLoader.fetchCompatibility(), /compatibility document|compatibility asset unavailable/,
    'schema or rule-count mismatched compatibility document was accepted');
}

for (const mutate of [
  (value) => { value.assets.compatibility.rules += 1; },
  (value) => { value.assets.compatibility.jsonBytes += 1; },
]) {
  const invalidIndex = structuredClone(compatibilityIndex);
  mutate(invalidIndex);
  const invalidLoader = createCatalogLoader({
    repository: 'owner/catalog', engine: { createCatalogModel }, cacheStorage: fakeCaches(), subtle: null,
    fetchImpl: async (url) => url.includes('index.json')
      ? new Response(JSON.stringify(invalidIndex), { status: 200 }) : new Response(compatibilityPayload.bytes, { status: 200 }),
  });
  await assertRejects(() => invalidLoader.fetchCompatibility(), /compatibility document|compatibility asset unavailable/,
    'rules or JSON-byte contract mismatch was accepted');
}

console.log('Catalog loader tests passed / Catalog 加载器测试通过');
