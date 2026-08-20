const MIN_INDEX_SCHEMA = 2;
const MIN_CATALOG_SCHEMA = 5;
const MIN_RELATIONS_SCHEMA = 2;
export const CATALOG_CACHE_NAME = 'wrt-catalog-cache-v3';
const MAX_COMPATIBILITY_JSON_BYTES = 512 * 1024;
const MAX_APPLICATIONS_JSON_BYTES = 4 * 1024 * 1024;

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

export function safeCatalogDataRef(value) {
  const ref = String(value || '').trim();
  if (!/^catalog-(?:fix-[A-Za-z0-9][A-Za-z0-9._-]{0,95}|dev|staging|main)$/.test(ref)) {
    throw new Error(`invalid Catalog data branch: ${value}`);
  }
  return ref;
}

function catalogFixCodeRefMatches(codeRef, branch) {
  const suffix = /^catalog-fix-([A-Za-z0-9][A-Za-z0-9._-]{0,95})$/.exec(branch)?.[1] || '';
  return Boolean(suffix) && String(codeRef || '').trim() === `fix-${suffix}`;
}

export function validateCatalogProvenance(index, dataRef, repository) {
  const provenance = index?.provenance;
  if (provenance == null) return null;
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
    throw new Error('Catalog index provenance must be an object');
  }
  const expectedRepository = safeRepository(repository);
  const actualRepository = safeRepository(provenance.repository);
  if (actualRepository !== expectedRepository) {
    throw new Error(`Catalog provenance repository mismatch: ${actualRepository} != ${expectedRepository}`);
  }
  const codeRef = String(provenance.codeRef || '').trim();
  const codeSha = String(provenance.codeSha || '').trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(codeSha)) throw new Error('Catalog provenance lacks a full codeSha');
  if (typeof provenance.complete !== 'boolean') throw new Error('Catalog provenance complete must be boolean');

  const branch = safeCatalogDataRef(dataRef);
  const validCodeRef = branch.startsWith('catalog-fix-') ? catalogFixCodeRefMatches(codeRef, branch)
    : branch === 'catalog-dev' ? codeRef === 'dev'
      : branch === 'catalog-staging' ? codeRef === 'staging'
        : codeRef === 'main';
  if (!validCodeRef) {
    throw new Error(`Catalog provenance codeRef ${codeRef || '(missing)'} does not match ${branch}`);
  }
  if (branch === 'catalog-main' && provenance.complete !== true) {
    throw new Error('Production Catalog provenance must be complete');
  }
  return { repository: actualRepository, codeRef, codeSha, complete: provenance.complete };
}

export function safeCatalogAsset(asset) {
  const value = String(asset || '').replace(/^\/+/, '');
  if (!value || value.includes('..') || !/^[\w./-]+$/.test(value)) {
    throw new Error(`invalid Catalog asset path: ${asset}`);
  }
  return value;
}

export function legacyCatalogContract(branch) {
  const row = branch && typeof branch === 'object' ? branch : {};
  const explicit = row.legacy && typeof row.legacy === 'object' ? row.legacy : null;
  if (!explicit && (row.assets?.core || row.assets?.graph || Number(row.schema || 0) >= 6)) return null;
  const source = explicit || row;
  const asset = String(source.asset || '');
  if (!asset) return null;
  return {
    asset: safeCatalogAsset(asset),
    hash: String(source.hash || source.compressedSha256 || '').trim().toLowerCase(),
    bytes: Number(source.bytes || source.compressedBytes || 0),
    catalogSchema: Number(source.catalogSchema || (!explicit ? row.schema || 5 : 0)),
    relationsSchema: Number(source.relationsSchema || (!explicit ? 2 : 0)),
  };
}

function exactAssetRef(index) {
  const ref = String(index?.assetRef || '').trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(ref)) throw new Error('Catalog index lacks an exact immutable assetRef');
  return ref;
}

function providers(repository, releaseTag, dataRef) {
  const repo = safeRepository(repository);
  const defaultReleaseTag = safeReleaseTag(releaseTag);
  const branch = safeCatalogDataRef(dataRef);
  return {
    'github-raw': {
      id: 'github-raw',
      indexUrl: (nonce) => `https://raw.githubusercontent.com/${repo}/${branch}/index.json?wrt_refresh=${nonce}`,
      assetUrl: (asset, ref) => `https://raw.githubusercontent.com/${repo}/${ref}/${asset}`,
    },
    jsdelivr: {
      id: 'jsdelivr',
      indexUrl: (nonce) => `https://cdn.jsdelivr.net/gh/${repo}@${branch}/index.json?wrt_refresh=${nonce}`,
      assetUrl: (asset, ref) => `https://cdn.jsdelivr.net/gh/${repo}@${ref}/${asset}`,
    },
    'github-api': {
      id: 'github-api',
      headers: { accept: 'application/vnd.github.raw+json' },
      indexUrl: () => `https://api.github.com/repos/${repo}/contents/index.json?ref=${branch}`,
      assetUrl: (asset, ref) => `https://api.github.com/repos/${repo}/contents/${asset}?ref=${ref}`,
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

function validateIndex(index, dataRef, repository) {
  const normalized = stableIndex(index);
  if (Number(normalized.schema || 0) < MIN_INDEX_SCHEMA || !normalized.sources.length) {
    throw new Error(`Catalog index schema ${normalized.schema || 0}; required ${MIN_INDEX_SCHEMA}`);
  }
  exactAssetRef(normalized);
  validateCatalogProvenance(normalized, dataRef, repository);
  return normalized;
}

function compatibilityContract(index) {
  const contract = index?.assets?.compatibility;
  if (!contract || safeCatalogAsset(contract.asset) !== 'compatibility.json.gz' ||
      !/^[a-f0-9]{64}$/.test(String(contract.hash || '')) ||
      !Number.isSafeInteger(Number(contract.bytes)) || Number(contract.bytes) <= 0 ||
      Number(contract.bytes) > MAX_COMPATIBILITY_JSON_BYTES + 1024 ||
      !Number.isSafeInteger(Number(contract.jsonBytes)) || Number(contract.jsonBytes) <= 0 ||
      Number(contract.jsonBytes) > MAX_COMPATIBILITY_JSON_BYTES ||
      Number(contract.schema) !== 2 || !Number.isSafeInteger(Number(contract.rules)) || Number(contract.rules) < 0) {
    throw new Error('Catalog index lacks a valid compatibility asset contract');
  }
  return {
    asset: 'compatibility.json.gz',
    hash: String(contract.hash).toLowerCase(),
    bytes: Number(contract.bytes),
    jsonBytes: Number(contract.jsonBytes),
    schema: 2,
    rules: Number(contract.rules),
  };
}

function applicationsContract(index) {
  const contract = index?.assets?.applications;
  if (!contract || safeCatalogAsset(contract.asset) !== 'applications.json.gz' ||
      !/^[a-f0-9]{64}$/.test(String(contract.hash || '')) ||
      !Number.isSafeInteger(Number(contract.bytes)) || Number(contract.bytes) <= 0 ||
      Number(contract.bytes) > MAX_APPLICATIONS_JSON_BYTES + 1024 ||
      !Number.isSafeInteger(Number(contract.jsonBytes)) || Number(contract.jsonBytes) <= 0 ||
      Number(contract.jsonBytes) > MAX_APPLICATIONS_JSON_BYTES ||
      Number(contract.schema) !== 1 || !Number.isSafeInteger(Number(contract.items)) || Number(contract.items) < 0) {
    throw new Error('Catalog index lacks a valid applications asset contract');
  }
  return {
    asset: 'applications.json.gz', hash: String(contract.hash).toLowerCase(), bytes: Number(contract.bytes),
    jsonBytes: Number(contract.jsonBytes), schema: 1, items: Number(contract.items),
  };
}

function validateCompatibilityDocument(data, expected) {
  const actualJsonBytes = new TextEncoder().encode(JSON.stringify(data)).byteLength;
  if (!data || Number(data.schema) !== 2 || Number(data.schema) !== Number(expected.schema) || !Array.isArray(data.rules) ||
      data.rules.length !== Number(expected.rules) || actualJsonBytes !== Number(expected.jsonBytes)) {
    throw new Error('Catalog compatibility document does not match its index contract');
  }
  return data;
}

const PROBE_UI_KEYS = [
  'title', 'intro', 'howTo', 'search', 'selected', 'depth', 'scope', 'targets',
  'allSources', 'currentSource', 'customScope', 'autoTarget', 'currentTarget', 'allTargets',
  'packageCompile', 'packageCompileHelp', 'rootfsIntegration', 'rootfsIntegrationHelp',
  'firmwareIntegration', 'firmwareIntegrationHelp', 'bootSmoke', 'bootSmokeHelp',
  'preview', 'submit', 'submittedState', 'stateInstruction', 'cancelInstruction',
  'permission', 'retention', 'issueTitle', 'loading', 'empty', 'invalid',
];

function validateApplicationsDocument(data, expected) {
  const actualJsonBytes = new TextEncoder().encode(JSON.stringify(data)).byteLength;
  const probeStrings = data?.probeUi?.strings;
  if (!data || Number(data.schema) !== 1 || !Array.isArray(data.groups) || !Array.isArray(data.items) ||
      Number(data.probeUi?.schema) !== 1 || !Array.isArray(data.probeUi?.languages) ||
      !probeStrings || typeof probeStrings !== 'object' || Array.isArray(probeStrings) ||
      Object.keys(probeStrings).length < 10 || Object.keys(probeStrings).length > 128 ||
      PROBE_UI_KEYS.some((key) => !Object.hasOwn(probeStrings, key)) ||
      Object.values(probeStrings).some((row) => !row || typeof row !== 'object' ||
        typeof row.en !== 'string' || typeof row['zh-CN'] !== 'string') ||
      data.items.length !== expected.items || actualJsonBytes !== expected.jsonBytes ||
      data.items.some((item) => !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,95}$/.test(String(item.id || '')) ||
        !/^luci-app-[A-Za-z0-9_.+@-]+$/.test(String(item.package || '')))) {
    throw new Error('Catalog applications document does not match its index contract');
  }
  return data;
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
  dataRef = 'catalog-main',
  allowReleaseFallback = dataRef === 'catalog-main',
  engine,
  fetchImpl = globalThis.fetch,
  cacheStorage = globalThis.caches,
  subtle = globalThis.crypto?.subtle,
  Decompression = globalThis.DecompressionStream,
  now = () => Date.now(),
} = {}) {
  const exactDataRef = safeCatalogDataRef(dataRef);
  const providerMap = providers(repository, releaseTag, exactDataRef);
  const indexProviderOrder = (forceRefresh = false) => {
    if (forceRefresh) {
      return allowReleaseFallback
        ? ['github-raw', 'github-api', 'jsdelivr', 'github-release']
        : ['github-raw', 'github-api', 'jsdelivr'];
    }
    return allowReleaseFallback
      ? ['jsdelivr', 'github-raw', 'github-api', 'github-release']
      : ['jsdelivr', 'github-raw', 'github-api'];
  };
  let lastIndexResult = null;
  let indexPromise = null;
  const compatibilityMemory = new Map();
  const compatibilityPromises = new Map();
  const applicationsMemory = new Map();
  const applicationsPromises = new Map();
  const coreMemory = new Map();
  const corePromises = new Map();

  async function fetchIndex({ signal, forceRefresh = false, diagnostics = [] } = {}) {
    if (!forceRefresh && indexPromise) return indexPromise;
    if (!forceRefresh && lastIndexResult) return { ...lastIndexResult, diagnostics };
    const run = async () => {
      const errors = [];
      for (const id of indexProviderOrder(forceRefresh)) {
        const provider = providerMap[id];
        const url = provider.indexUrl(now());
        try {
          const response = await fetchImpl(url, {
            cache: 'no-store', signal, ...(provider.headers ? { headers: provider.headers } : {}),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const index = validateIndex(await response.json(), exactDataRef, repository);
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
    const promise = run().finally(() => {
      if (indexPromise === promise) indexPromise = null;
    });
    indexPromise = promise;
    return promise;
  }

  async function readCachedBuffer(asset, contract, diagnostics, stage = 'cache') {
    if (!cacheStorage?.open) return null;
    const cache = await cacheStorage.open(CATALOG_CACHE_NAME);
    const key = cacheKey(repository, asset, contract);
    const response = await cache.match(key);
    if (!response) return null;
    try {
      const buffer = await response.arrayBuffer();
      const data = await readDocumentBuffer(buffer, contract, subtle, Decompression);
      diagnostic(diagnostics, stage, 'cache-api', true, `bytes ${buffer.byteLength}`, key);
      return { buffer, data, key };
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

  function assetProviderOrder(preferredAssetProvider = '', includeRelease = allowReleaseFallback) {
    const order = includeRelease
      ? ['jsdelivr', 'github-raw', 'github-api', 'github-release']
      : ['jsdelivr', 'github-raw', 'github-api'];
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
    includeRelease = allowReleaseFallback,
  }) {
    const safeAsset = safeCatalogAsset(asset);
    if (!forceRefresh) {
      const cached = await readCachedBuffer(safeAsset, contract, diagnostics, `${stage}-cache`);
      if (cached) {
        return {
          data: cached.data,
          buffer: cached.buffer,
          provider: 'cache',
          url: `cache:${cached.key}`,
        };
      }
    }
    const ref = exactAssetRef(index);
    const errors = [];
    for (const id of assetProviderOrder(preferredAssetProvider, includeRelease)) {
      const provider = providerMap[id];
      const url = provider.assetUrl(safeAsset, ref, index);
      try {
        const response = await fetchImpl(url, {
          cache: 'no-store', signal, ...(provider.headers ? { headers: provider.headers } : {}),
        });
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

  async function fetchCore({
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

    const coreContract = branch.assets?.core;
    if (!coreContract?.asset) {
      const bundle = await fetchBundle({ sourceId, branchName, signal, forceRefresh, preferredAssetProvider });
      return {
        data: bundle.data,
        index: bundle.index,
        indexProvider: bundle.indexProvider,
        provider: bundle.provider,
        branch: bundle.branch,
        source: bundle.source,
        url: bundle.url,
        diagnostics: bundle.diagnostics,
        legacyBundle: true,
      };
    }

    const key = `${sourceId}\0${branchName}\0${String(coreContract.hash || coreContract.asset)}`;
    if (!forceRefresh && coreMemory.has(key)) {
      const loaded = coreMemory.get(key);
      diagnostic(diagnostics, 'core-memory', 'memory', true, `schema ${loaded.data?.schema || '-'}`, key);
      return { ...loaded, diagnostics };
    }
    if (!forceRefresh && corePromises.has(key)) return corePromises.get(key);

    const run = (async () => {
      const result = await fetchAssetDocument({
        asset: coreContract.asset,
        contract: coreContract,
        index,
        signal,
        diagnostics,
        preferredAssetProvider: preferredAssetProvider || indexResult.provider,
        forceRefresh,
        stage: 'core-only',
      });
      if (Number(result.data?.schema || 0) < 6) {
        throw loaderError(`Catalog core schema ${result.data?.schema || 0}; required 6`, diagnostics);
      }
      const expectedCommit = String(branch.commit || '');
      const actualCommit = String(result.data?.source?.commit || '');
      if (expectedCommit && actualCommit !== expectedCommit) {
        throw loaderError(`Catalog source commit mismatch: ${actualCommit || '(missing)'} != ${expectedCommit}`, diagnostics);
      }
      const loaded = {
        data: result.data,
        index,
        indexProvider: indexResult.provider,
        provider: result.provider,
        branch,
        source,
        url: result.url,
        legacyBundle: false,
      };
      coreMemory.set(key, loaded);
      return { ...loaded, diagnostics };
    })().finally(() => corePromises.delete(key));
    corePromises.set(key, run);
    return run;
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

    const legacy = legacyCatalogContract(branch);
    if (!legacy?.asset || !legacy.hash || !legacy.bytes) {
      throw loaderError('Catalog index lacks an explicit legacy build/bundle contract', diagnostics);
    }
    const result = await fetchAssetDocument({
      asset: legacy.asset,
      contract: legacy,
      index,
      signal,
      diagnostics,
      preferredAssetProvider,
      forceRefresh,
      stage: 'asset',
    });
    let model;
    try {
      model = validateCatalogDocument(result.data, legacy, engine);
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

  async function fetchCompatibility({ signal, forceRefresh = false } = {}) {
    const diagnostics = [];
    const indexResult = await fetchIndex({ signal, forceRefresh, diagnostics });
    const contract = compatibilityContract(indexResult.index);
    const key = `${contract.asset}:${contract.hash}`;
    if (compatibilityMemory.has(key)) {
      diagnostic(diagnostics, 'compatibility-memory', 'memory', true, `sha256 ${contract.hash}`, key);
      return { ...compatibilityMemory.get(key), diagnostics };
    }
    if (compatibilityPromises.has(key)) return compatibilityPromises.get(key);
    const run = (async () => {
      const result = await fetchAssetDocument({
        asset: contract.asset,
        contract,
        index: indexResult.index,
        signal,
        diagnostics,
        preferredAssetProvider: indexResult.provider,
        // A force refresh refreshes the index. An unchanged compressed SHA still reuses
        // the verified Cache API entry and never downloads the same evidence twice.
        forceRefresh: false,
        stage: 'compatibility',
        includeRelease: false,
      });
      const compatibility = validateCompatibilityDocument(result.data, contract);
      const loaded = {
        compatibility,
        contract,
        hash: contract.hash,
        dataRef: exactDataRef,
        index: indexResult.index,
        indexProvider: indexResult.provider,
        provider: result.provider,
        url: result.url,
      };
      compatibilityMemory.set(key, loaded);
      return { ...loaded, diagnostics };
    })().finally(() => compatibilityPromises.delete(key));
    compatibilityPromises.set(key, run);
    return run;
  }

  async function fetchApplications({ signal, forceRefresh = false } = {}) {
    const diagnostics = [];
    const indexResult = await fetchIndex({ signal, forceRefresh, diagnostics });
    const contract = applicationsContract(indexResult.index);
    const key = `${contract.asset}:${contract.hash}`;
    if (applicationsMemory.has(key)) {
      diagnostic(diagnostics, 'applications-memory', 'memory', true, `sha256 ${contract.hash}`, key);
      return { ...applicationsMemory.get(key), diagnostics };
    }
    if (applicationsPromises.has(key)) return applicationsPromises.get(key);
    const run = (async () => {
      const result = await fetchAssetDocument({
        asset: contract.asset, contract, index: indexResult.index, signal, diagnostics,
        preferredAssetProvider: indexResult.provider, forceRefresh: false,
        stage: 'applications', includeRelease: false,
      });
      const applications = validateApplicationsDocument(result.data, contract);
      const loaded = {
        applications, contract, hash: contract.hash, dataRef: exactDataRef,
        index: indexResult.index, indexProvider: indexResult.provider,
        provider: result.provider, url: result.url,
      };
      applicationsMemory.set(key, loaded);
      return { ...loaded, diagnostics };
    })().finally(() => applicationsPromises.delete(key));
    applicationsPromises.set(key, run);
    return run;
  }

  async function clearCache() {
    lastIndexResult = null;
    indexPromise = null;
    compatibilityMemory.clear();
    compatibilityPromises.clear();
    applicationsMemory.clear();
    applicationsPromises.clear();
    coreMemory.clear();
    corePromises.clear();
    if (cacheStorage?.delete) await cacheStorage.delete(CATALOG_CACHE_NAME).catch(() => false);
  }

  return { fetchIndex, fetchCore, fetchBundle, fetchCompatibility, fetchApplications, clearCache, dataRef: exactDataRef };
}
