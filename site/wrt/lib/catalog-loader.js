const MIN_INDEX_SCHEMA = 2;
const MIN_CATALOG_SCHEMA = 5;
const MIN_RELATIONS_SCHEMA = 2;
export const CATALOG_CACHE_NAME = 'wrt-catalog-cache-v3';

function safeRepository(value) {
  const repository = String(value || '').trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error(`invalid Catalog repository: ${value}`);
  }
  return repository;
}

function safeReleaseTag(value) {
  const tag = String(value || '').trim();
  if (!/^[A-Za-z0-9._-]+$/.test(tag)) throw new Error(`invalid Catalog release tag: ${value}`);
  return tag;
}

export function safeCatalogAsset(asset) {
  const value = String(asset || '').replace(/^\/+/, '');
  if (!value || value.includes('..') || !/^[\w./-]+$/.test(value)) {
    throw new Error(`invalid Catalog asset path: ${asset}`);
  }
  return value;
}

function exactAssetRef(index) {
  const ref = String(index?.assetRef || '').trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(ref)) throw new Error('Catalog index lacks an exact immutable assetRef');
  return ref;
}

function providers(repository, releaseTag) {
  const repo = safeRepository(repository);
  const defaultReleaseTag = safeReleaseTag(releaseTag);
  return {
    'github-raw': {
      id: 'github-raw',
      indexUrl: (nonce) => `https://raw.githubusercontent.com/${repo}/catalog-data/index.json?wrt_refresh=${nonce}`,
      assetUrl: (asset, ref) => `https://raw.githubusercontent.com/${repo}/${ref}/${asset}`,
    },
    jsdelivr: {
      id: 'jsdelivr',
      indexUrl: (nonce) => `https://cdn.jsdelivr.net/gh/${repo}@catalog-data/index.json?wrt_refresh=${nonce}`,
      assetUrl: (asset, ref) => `https://cdn.jsdelivr.net/gh/${repo}@${ref}/${asset}`,
    },
    'github-release': {
      id: 'github-release',
      indexUrl: (nonce) => `https://github.com/${repo}/releases/download/${defaultReleaseTag}/index.json?wrt_refresh=${nonce}`,
      assetUrl: (asset, _ref, index) => {
        const tag = safeReleaseTag(index?.completeReleaseTag || defaultReleaseTag);
        return `https://github.com/${repo}/releases/download/${tag}/${asset}`;
      },
    },
  };
}

function branchFromIndex(index, sourceId, branchName) {
  const source = index?.sources?.find((item) => item.id === sourceId);
  const branch = source?.branches?.find((item) => item.branch === branchName || item.id === branchName);
  return { source, branch };
}

function diagnostic(diagnostics, stage, provider, ok, detail, url = '') {
  diagnostics.push({ stage, provider, ok, detail: String(detail || ''), url: String(url || '') });
}

function loaderError(message, diagnostics, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.diagnostics = [...diagnostics];
  return error;
}

function rotr(value, shift) {
  return (value >>> shift) | (value << (32 - shift));
}

function sha256Fallback(buffer) {
  const input = new Uint8Array(buffer);
  const bitLength = input.length * 8;
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[input.length] = 0x80;
  const view = new DataView(bytes.buffer);
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  view.setUint32(paddedLength - 8, high);
  view.setUint32(paddedLength - 4, low);
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) words[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(words[i - 15], 7) ^ rotr(words[i - 15], 18) ^ (words[i - 15] >>> 3);
      const s1 = rotr(words[i - 2], 17) ^ rotr(words[i - 2], 19) ^ (words[i - 2] >>> 10);
      words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i++) {
      const sum1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const choice = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (h + sum1 + choice + constants[i] + words[i]) >>> 0;
      const sum0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const majority = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (sum0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0; hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0; hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0; hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0; hash[7] = (hash[7] + h) >>> 0;
  }
  return hash.map((value) => value.toString(16).padStart(8, '0')).join('');
}

export async function sha256Hex(buffer, subtle = globalThis.crypto?.subtle) {
  if (subtle?.digest) {
    const digest = await subtle.digest('SHA-256', buffer);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return sha256Fallback(buffer);
}

export async function decodeCatalogBytes(buffer, Decompression = globalThis.DecompressionStream) {
  const bytes = new Uint8Array(buffer);
  let text;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof Decompression !== 'function') throw new Error('Browser does not support gzip Catalog data');
    const stream = new Blob([bytes]).stream().pipeThrough(new Decompression('gzip'));
    text = await new Response(stream).text();
  } else {
    text = new TextDecoder().decode(bytes);
  }
  return JSON.parse(text);
}

export function validateCatalogDocument(data, expected, engine) {
  const schema = Number(data?.schema || 0);
  const relationsSchema = Number(data?.relations?.schema || 0);
  if (schema < MIN_CATALOG_SCHEMA) throw new Error(`Catalog schema ${schema}; required ${MIN_CATALOG_SCHEMA}`);
  if (![2, 3].includes(relationsSchema)) {
    throw new Error(`Catalog relations schema ${relationsSchema}; required 2 or 3`);
  }
  const expectedCommit = String(expected?.commit || '');
  const actualCommit = String(data?.source?.commit || '');
  if (expectedCommit && actualCommit !== expectedCommit) {
    throw new Error(`Catalog source commit mismatch: ${actualCommit || '(missing)'} != ${expectedCommit}`);
  }
  return engine.createCatalogModel(data);
}

async function readDocumentBuffer(buffer, expected, subtle, Decompression) {
  if (expected?.bytes && Number(expected.bytes) !== buffer.byteLength) {
    throw new Error(`Catalog byte length mismatch: ${buffer.byteLength} != ${expected.bytes}`);
  }
  if (expected?.hash) {
    const actual = await sha256Hex(buffer, subtle);
    if (actual !== String(expected.hash).toLowerCase()) throw new Error('Catalog compressed SHA-256 mismatch');
  }
  return decodeCatalogBytes(buffer, Decompression);
}

async function readCatalogBuffer(buffer, expected, engine, subtle, Decompression) {
  const data = await readDocumentBuffer(buffer, expected, subtle, Decompression);
  const model = validateCatalogDocument(data, expected, engine);
  return { data, model };
}

function stableIndex(index) {
  const sources = (index?.sources || []).map((source) => ({
    ...source,
    branches: [...(source.branches || [])]
      .sort((a, b) => b.branch.localeCompare(a.branch, undefined, { numeric: true })),
  })).filter((source) => source.branches.length);
  return { ...index, sources };
}

function validateIndex(index) {
  const normalized = stableIndex(index);
  if (Number(normalized.schema || 0) < MIN_INDEX_SCHEMA || !normalized.sources.length) {
    throw new Error(`Catalog index schema ${normalized.schema || 0}; required ${MIN_INDEX_SCHEMA}`);
  }
  exactAssetRef(normalized);
  return normalized;
}

function cacheKey(repository, asset, expected) {
  const revision = String(expected?.hash || expected?.commit || 'latest').replace(/[^A-Za-z0-9._-]/g, '_');
  return `./catalog-cache-v3/${repository}/${asset}?revision=${revision}`;
}

export function formatCatalogDiagnostics(diagnostics = []) {
  return diagnostics.map((item) => {
    const mark = item.ok ? 'OK' : 'FAIL';
    const provider = item.provider ? ` ${item.provider}` : '';
    const url = item.url ? `\n  ${item.url}` : '';
    return `[${item.stage.toUpperCase()}]${provider} ${mark}: ${item.detail}${url}`;
  }).join('\n');
}

export function createCatalogLoader({
  repository,
  releaseTag = 'menuconfig-catalog-complete',
  engine,
  fetchImpl = globalThis.fetch,
  cacheStorage = globalThis.caches,
  subtle = globalThis.crypto?.subtle,
  Decompression = globalThis.DecompressionStream,
  now = () => Date.now(),
} = {}) {
  const providerMap = providers(repository, releaseTag);
  let lastIndexResult = null;
  let indexPromise = null;

  async function fetchIndex({ signal, forceRefresh = false, diagnostics = [] } = {}) {
    if (!forceRefresh && lastIndexResult) return { ...lastIndexResult, diagnostics };
    if (!forceRefresh && indexPromise) return indexPromise;
    const run = async () => {
      const errors = [];
      for (const id of ['github-raw', 'jsdelivr', 'github-release']) {
        const provider = providerMap[id];
        const url = provider.indexUrl(now());
        try {
          const response = await fetchImpl(url, { cache: 'no-store', signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const index = validateIndex(await response.json());
          const result = { index, provider: id, url };
          lastIndexResult = result;
          diagnostic(diagnostics, 'index', id, true,
            `schema ${index.schema}; assetRef ${index.assetRef.slice(0, 8)}`, url);
          return { ...result, diagnostics };
        } catch (error) {
          if (error?.name === 'AbortError') throw error;
          diagnostic(diagnostics, 'index', id, false, error.message, url);
          errors.push(`${id}: ${error.message}`);
        }
      }
      throw loaderError(`Catalog index unavailable\n${errors.join('\n')}`, diagnostics);
    };
    indexPromise = run().finally(() => { indexPromise = null; });
    return indexPromise;
  }

  async function readCachedBuffer(asset, contract, diagnostics, stage = 'cache') {
    if (!cacheStorage?.open) return null;
    const cache = await cacheStorage.open(CATALOG_CACHE_NAME);
    const key = cacheKey(repository, asset, contract);
    const response = await cache.match(key);
    if (!response) return null;
    try {
      const buffer = await response.arrayBuffer();
      await readDocumentBuffer(buffer, contract, subtle, Decompression);
      diagnostic(diagnostics, stage, 'cache-api', true, `bytes ${buffer.byteLength}`, key);
      return { buffer, key };
    } catch (error) {
      await cache.delete(key).catch(() => {});
      diagnostic(diagnostics, stage, 'cache-api', false, error.message, key);
      return null;
    }
  }

  async function writeCache(asset, contract, buffer) {
    if (!cacheStorage?.open) return;
    const cache = await cacheStorage.open(CATALOG_CACHE_NAME).catch(() => null);
    if (!cache) return;
    const key = cacheKey(repository, asset, contract);
    await cache.put(key, new Response(buffer, {
      headers: { 'content-type': 'application/gzip', 'cache-control': 'no-store' },
    })).catch(() => {});
  }

  function assetProviderOrder(preferredAssetProvider = '') {
    const order = ['jsdelivr', 'github-raw', 'github-release'];
    if (order.includes(preferredAssetProvider)) {
      order.splice(order.indexOf(preferredAssetProvider), 1);
      order.unshift(preferredAssetProvider);
    }
    return order;
  }

  async function fetchAssetDocument({
    asset,
    contract,
    index,
    signal,
    diagnostics,
    preferredAssetProvider = '',
    forceRefresh = false,
    stage = 'asset',
  }) {
    const safeAsset = safeCatalogAsset(asset);
    if (!forceRefresh) {
      const cached = await readCachedBuffer(safeAsset, contract, diagnostics, `${stage}-cache`);
      if (cached) {
        return {
          data: await decodeCatalogBytes(cached.buffer, Decompression),
          buffer: cached.buffer,
          provider: 'cache',
          url: `cache:${cached.key}`,
        };
      }
    }
    const ref = exactAssetRef(index);
    const errors = [];
    for (const id of assetProviderOrder(preferredAssetProvider)) {
      const provider = providerMap[id];
      const url = provider.assetUrl(safeAsset, ref, index);
      try {
        const response = await fetchImpl(url, { cache: 'no-store', signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        const data = await readDocumentBuffer(buffer, contract, subtle, Decompression);
        await writeCache(safeAsset, contract, buffer);
        diagnostic(diagnostics, stage, id, true, `bytes ${buffer.byteLength}; schema ${data?.schema || '-'}`, url);
        return { data, buffer, provider: id, url };
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        diagnostic(diagnostics, stage, id, false, error.message, url);
        errors.push(`${id}: ${error.message}`);
      }
    }
    throw loaderError(`Catalog asset unavailable: ${safeAsset}\n${errors.join('\n')}`, diagnostics);
  }

  async function fetchBundle({
    sourceId,
    branchName,
    signal,
    forceRefresh = false,
    preferredAssetProvider = '',
  } = {}) {
    const diagnostics = [];
    const indexResult = await fetchIndex({ signal, forceRefresh, diagnostics });
    const index = indexResult.index;
    const { source, branch } = branchFromIndex(index, sourceId, branchName);
    if (!source || !branch || branch.state === 'unavailable') {
      throw loaderError(`Catalog branch unavailable: ${sourceId}/${branchName}`, diagnostics);
    }

    const split = branch.assets?.core && branch.assets?.graph;
    if (split) {
      const coreContract = branch.assets.core;
      const graphContract = branch.assets.graph;
      const [core, graph] = await Promise.all([
        fetchAssetDocument({
          asset: coreContract.asset, contract: coreContract, index, signal, diagnostics,
          preferredAssetProvider, forceRefresh, stage: 'core',
        }),
        fetchAssetDocument({
          asset: graphContract.asset, contract: graphContract, index, signal, diagnostics,
          preferredAssetProvider, forceRefresh, stage: 'graph',
        }),
      ]);
      if (Number(core.data?.schema || 0) < 6 || Number(graph.data?.relations?.schema || 0) !== 3) {
        throw loaderError('Catalog split assets do not satisfy schema 6 / relations 3', diagnostics);
      }
      const expectedCommit = String(branch.commit || '');
      for (const data of [core.data, graph.data]) {
        const actualCommit = String(data?.source?.commit || '');
        if (expectedCommit && actualCommit !== expectedCommit) {
          throw loaderError(`Catalog source commit mismatch: ${actualCommit || '(missing)'} != ${expectedCommit}`, diagnostics);
        }
      }
      const data = {
        ...core.data,
        relations: graph.data.relations,
        menu: { categories: [], labels: {}, options: [], choices: [] },
        splitAssets: true,
      };
      const model = engine.createCatalogModel(data);
      const loadedShards = new Map();
      const loadShard = async (logical, options = {}) => {
        if (loadedShards.has(logical) && !options.forceRefresh) return loadedShards.get(logical);
        const contract = branch.assets?.[logical];
        if (!contract?.asset) throw new Error(`Catalog shard is unavailable: ${logical}`);
        const result = await fetchAssetDocument({
          asset: contract.asset,
          contract,
          index,
          signal: options.signal || signal,
          diagnostics,
          preferredAssetProvider: options.preferredAssetProvider || preferredAssetProvider,
          forceRefresh: options.forceRefresh === true,
          stage: `shard:${logical}`,
        });
        loadedShards.set(logical, result.data);
        return result.data;
      };
      return {
        data, model, index, indexProvider: indexResult.provider,
        provider: `${core.provider}+${graph.provider}`,
        branch, source, url: `${core.url} + ${graph.url}`, diagnostics,
        loadShard,
      };
    }

    if (!branch.asset || !branch.hash || !branch.bytes) {
      throw loaderError('Catalog index lacks an exact compressed bytes/hash contract', diagnostics);
    }
    const asset = safeCatalogAsset(branch.asset);
    const result = await fetchAssetDocument({
      asset,
      contract: branch,
      index,
      signal,
      diagnostics,
      preferredAssetProvider,
      forceRefresh,
      stage: 'asset',
    });
    let model;
    try {
      model = validateCatalogDocument(result.data, branch, engine);
    } catch (error) {
      diagnostic(diagnostics, 'asset-schema', result.provider, false, error.message, result.url);
      throw loaderError(`Catalog bundle unavailable: ${error.message}`, diagnostics, error);
    }
    return {
      data: result.data,
      model,
      index,
      indexProvider: indexResult.provider,
      provider: result.provider,
      branch,
      source,
      url: result.url,
      diagnostics,
      loadShard: null,
    };
  }

  async function clearCache() {
    lastIndexResult = null;
    indexPromise = null;
    if (cacheStorage?.delete) await cacheStorage.delete(CATALOG_CACHE_NAME).catch(() => false);
  }

  return { fetchIndex, fetchBundle, clearCache };
}
