#!/usr/bin/env node
// Parses one immutable build request. Catalog owns Source/Branch/Profile facts; this worker
// reconstructs the authoritative .config from the exact Native Profile baseline plus the
// browser's semantic override delta. It never replays browser click intent.

import { readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import {
  artifactBuildRef, artifactBuildTag, buildEnvironmentIdentity, isValidBuildTag, normalizeBuildCommit,
  normalizeBuildEnvironment, normalizeBuildTag, parseBuildIssueTitleIdentity,
} from '../site/wrt/lib/build-identity.js';
import { createCatalogModel } from '../site/wrt/lib/catalog-engine.js';
import {
  applyProfileOverrides, createProfileBaselineStore, serializeConfigMap,
} from '../site/wrt/lib/profile-baseline.js';
import { normalizeRequestAudit } from './request-audit.mjs';
import { loadProjectConfiguration } from './project-config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_CONFIG_PATH = join(ROOT, 'site', 'wrt', 'config', 'site.json');
const BUILD_CONFIG_PATH = join(ROOT, 'config', 'build.json');
const loadedProjectConfiguration = loadProjectConfiguration({
  root: ROOT, sitePath: SITE_CONFIG_PATH, buildPath: BUILD_CONFIG_PATH,
});
const PROJECT_SITE = loadedProjectConfiguration.site;
const PROJECT_BUILD = loadedProjectConfiguration.build;
const PROJECT_CATALOG = PROJECT_SITE.catalog || {};
const PROJECT_CATALOG_REPOSITORY = String(PROJECT_SITE.catalogRepository || PROJECT_CATALOG.repository || '');
const PROJECT_FIRMWARE = PROJECT_SITE.firmware;
const PROJECT_DEFAULT_TAG = PROJECT_SITE.build.defaultTag;
const PROJECT_BUILD_JOBS = PROJECT_BUILD.jobs;
const PROJECT_BUILD_PASSWORD = PROJECT_BUILD.password;
const PACKAGE_MIRROR_RULES = JSON.parse(
  readFileSync(join(ROOT, 'config', 'policies', 'package-mirrors.json'), 'utf8'));
const SHA256_RE = /^[a-f0-9]{64}$/;
const GIT_COMMIT_RE = /^[a-f0-9]{40}$/;

function fail(msg) { console.error('Validation failed: ' + msg); process.exit(1); }
function normalizeAudit(raw) {
  try { return normalizeRequestAudit(raw); }
  catch (error) { fail(error.message); }
}
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function semanticHash(values) {
  const lines = [...values]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([symbol, value]) => `CONFIG_${symbol}=${value}`);
  return sha256(lines.length ? `${lines.join('\n')}\n` : '');
}

function own(value, key) {
  return value !== null && typeof value === 'object' && Object.hasOwn(value, key);
}

function projectJobCount(value) {
  if (value === 'auto') return value;
  if (Number.isInteger(value) && Number.isSafeInteger(value) && value >= 1 && value <= 32) return value;
  throw new Error('project build job policy must be auto or an integer from 1 to 32');
}

const PROJECT_COMPILE_JOBS = projectJobCount(PROJECT_BUILD_JOBS.compile);
const PROJECT_DOWNLOAD_JOBS = projectJobCount(PROJECT_BUILD_JOBS.download);

async function fetchCatalogResource(revision, path, { binary = false } = {}) {
  const repo = PROJECT_CATALOG_REPOSITORY;
  const ref = String(revision || '').trim().toLowerCase();
  if (!GIT_COMMIT_RE.test(ref)) throw new Error(`Catalog revision is invalid: ${ref}`);
  const safePath = String(path || '').replace(/^\/+/, '');
  if (!safePath || safePath.includes('..') || !/^[A-Za-z0-9._/-]+$/.test(safePath)) {
    throw new Error(`Catalog asset path is invalid: ${path}`);
  }
  const urls = [
    `https://raw.githubusercontent.com/${repo}/${ref}/${safePath}`,
    `https://cdn.jsdelivr.net/gh/${repo}@${ref}/${safePath}`,
  ];
  const errors = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return binary ? Buffer.from(await response.arrayBuffer()) : await response.json();
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }
  throw new Error(`Unable to read pinned Catalog asset ${safePath}: ${errors.join(' | ')}`);
}

async function loadCatalogIndex(revision) {
  const index = await fetchCatalogResource(revision, 'index.json');
  if (Number(index?.schema || 0) < 2 || !Array.isArray(index.sources)) {
    throw new Error('invalid Catalog index schema');
  }
  return index;
}

function legacyCatalogContract(branch) {
  const row = branch && typeof branch === 'object' ? branch : {};
  const explicit = row.legacy && typeof row.legacy === 'object' ? row.legacy : null;
  if (!explicit && (row.assets?.core || row.assets?.graph || Number(row.schema || 0) >= 6)) return null;
  const source = explicit || row;
  const asset = String(source.asset || '');
  if (!asset) return null;
  return {
    asset,
    hash: String(source.hash || source.compressedSha256 || '').toLowerCase(),
    bytes: Number(source.bytes || source.compressedBytes || 0),
    catalogSchema: Number(source.catalogSchema || (!explicit ? row.schema || 5 : 0)),
    relationsSchema: Number(source.relationsSchema || (!explicit ? 2 : 0)),
  };
}

function normalizeCatalogContract(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('The schema 6 request is missing its Catalog version contract');
  const contract = {
    repository: String(raw.repository || ''),
    revision: String(raw.revision || '').toLowerCase(),
    asset: String(raw.asset || ''),
    compressedSha256: String(raw.compressedSha256 || '').toLowerCase(),
    compressedBytes: Number(raw.compressedBytes || 0),
    catalogSchema: Number(raw.catalogSchema || 0),
    relationsSchema: Number(raw.relationsSchema || 0),
    sourceRepository: String(raw.sourceRepository || ''),
    sourceCommit: String(raw.sourceCommit || '').toLowerCase(),
  };
  const expectedRepo = PROJECT_CATALOG_REPOSITORY;
  if (contract.repository !== expectedRepo) fail(`Catalog repository is not allowlisted: ${contract.repository}`);
  if (!GIT_COMMIT_RE.test(contract.revision)) fail('Catalog revision must be a full 40-character Git commit');
  if (contract.asset && !/^[A-Za-z0-9._-]+\.json\.gz$/.test(contract.asset)) fail(`Catalog asset is invalid: ${contract.asset}`);
  if (contract.compressedSha256 && !SHA256_RE.test(contract.compressedSha256)) fail('Catalog compressedSha256 is invalid');
  if (contract.compressedBytes && (!Number.isSafeInteger(contract.compressedBytes) || contract.compressedBytes <= 0)) {
    fail('Catalog compressedBytes is invalid');
  }
  if (contract.catalogSchema && contract.catalogSchema < 5) fail('Catalog schema version is too old');
  if (contract.relationsSchema && contract.relationsSchema < 2) fail('Catalog relations schema version is too old');
  if (!GIT_COMMIT_RE.test(contract.sourceCommit)) fail('Catalog sourceCommit must be a full 40-character Git commit');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(contract.sourceRepository)) fail('Catalog sourceRepository is invalid');
  return contract;
}

function profileBaselineContract(branch) {
  const contract = branch?.assets?.profileBaselines;
  if (!contract || typeof contract !== 'object' ||
      !/^[A-Za-z0-9._-]+\.profiles\.json\.gz$/.test(String(contract.asset || '')) ||
      !SHA256_RE.test(String(contract.hash || '').toLowerCase()) ||
      !Number.isSafeInteger(Number(contract.bytes)) || Number(contract.bytes) <= 0 ||
      Number(contract.schema || 0) < 3 || !String(contract.encoding || '').trim() ||
      !Number.isSafeInteger(Number(contract.profiles)) || Number(contract.profiles) <= 0 ||
      !Number.isSafeInteger(Number(contract.configGroups)) || Number(contract.configGroups) <= 0) {
    fail('The pinned Catalog index is missing a valid Native Profile baseline contract');
  }
  return {
    ...contract,
    asset: String(contract.asset),
    hash: String(contract.hash).toLowerCase(),
    bytes: Number(contract.bytes),
    schema: Number(contract.schema),
    encoding: String(contract.encoding),
    profiles: Number(contract.profiles),
    configGroups: Number(contract.configGroups),
  };
}

function graphContract(branch) {
  const contract = branch?.assets?.graph;
  if (!contract || typeof contract !== 'object' ||
      !/^[A-Za-z0-9._-]+\.graph\.json\.gz$/.test(String(contract.asset || '')) ||
      !SHA256_RE.test(String(contract.hash || '').toLowerCase()) ||
      !Number.isSafeInteger(Number(contract.bytes)) || Number(contract.bytes) <= 0) {
    fail('The pinned Catalog index is missing a valid Kconfig graph contract');
  }
  return {
    asset: String(contract.asset),
    hash: String(contract.hash).toLowerCase(),
    bytes: Number(contract.bytes),
  };
}

async function loadCatalogKconfigSymbols(catalogContract, catalogBranch) {
  const contract = graphContract(catalogBranch);
  const compressed = await fetchCatalogResource(catalogContract.revision, contract.asset, { binary: true });
  if (compressed.byteLength !== contract.bytes) {
    fail(`Catalog Kconfig graph byte count mismatch: ${compressed.byteLength} != ${contract.bytes}`);
  }
  if (sha256(compressed) !== contract.hash) fail('Catalog Kconfig graph compressed SHA-256 mismatch');
  let document;
  try { document = JSON.parse(gunzipSync(compressed).toString('utf8')); }
  catch (error) { fail(`Unable to decompress or parse the Catalog Kconfig graph: ${error.message}`); }
  const actualCommit = String(document?.source?.commit || '').toLowerCase();
  if (actualCommit && actualCommit !== catalogContract.sourceCommit) {
    fail(`Catalog Kconfig graph source commit mismatch: ${actualCommit} != ${catalogContract.sourceCommit}`);
  }
  let model;
  try { model = createCatalogModel({ schema: 6, relations: document?.relations }); }
  catch (error) { fail(`Catalog Kconfig graph contract is invalid: ${error.message}`); }
  const symbols = new Set(model.bySymbol.keys());
  if (!symbols.size) fail('The Catalog Kconfig graph contains no Kconfig symbols');
  return { symbols, contract };
}

async function loadNativeProfileStore(catalogContract, catalogSource, catalogBranch) {
  const contract = profileBaselineContract(catalogBranch);
  const compressed = await fetchCatalogResource(catalogContract.revision, contract.asset, { binary: true });
  if (compressed.byteLength !== contract.bytes) {
    fail(`Native Profile baseline byte count mismatch: ${compressed.byteLength} != ${contract.bytes}`);
  }
  const compressedHash = sha256(compressed);
  if (compressedHash !== contract.hash) fail('Native Profile baseline compressed SHA-256 mismatch');
  let document;
  try { document = JSON.parse(gunzipSync(compressed).toString('utf8')); }
  catch (error) { fail(`Unable to decompress or parse the Native Profile baseline: ${error.message}`); }
  let store;
  try {
    store = createProfileBaselineStore(document, {
      sourceId: catalogSource.id,
      branch: catalogBranch.branch,
      commit: catalogContract.sourceCommit,
      schema: contract.schema,
      encoding: contract.encoding,
      profiles: contract.profiles,
      configGroups: contract.configGroups,
    });
  } catch (error) {
    fail(`Native Profile baseline contract is invalid: ${error.message}`);
  }
  return { store, contract };
}

let req;
let requestMode = 'issue-json';
let requestAttachmentName = '';
let requestAudit = { defconfig: { enabled: false } };
const requestManifest = String(process.env.REQUEST_MANIFEST || '').trim();
const requestFile = String(process.env.REQUEST_FILE || '').trim();
let selectedFile = requestFile;
if (requestManifest) {
  let manifest;
  try { manifest = JSON.parse(readFileSync(requestManifest, 'utf8')); }
  catch (error) { fail('Unable to parse the attachment manifest: ' + error.message); }
  const jsonFiles = manifest?.version === 1 && Array.isArray(manifest.files)
    ? manifest.files.filter((entry) => entry.type === 'json') : [];
  if (jsonFiles.length !== 1 || manifest.files.length !== 1) {
    fail('Upload exactly one schema 6 build-request.json; import .config/config.buildinfo in the web customizer first');
  }
  selectedFile = jsonFiles[0].path;
  requestAttachmentName = jsonFiles[0].name || '';
}
if (!selectedFile) fail('Missing schema 6 build-request.json');
requestAttachmentName ||= basename(selectedFile);
let raw;
try { raw = readFileSync(selectedFile); } catch (error) { fail('Unable to read build-request.json: ' + error.message); }
if (raw.length < 32 || raw.length > 2 * 1024 * 1024) fail(`build-request.json size is invalid: ${raw.length} bytes`);
try { req = JSON.parse(raw.toString('utf8')); } catch (error) { fail('Unable to parse build-request.json: ' + error.message); }
if (req.schema !== 6) fail(`Only build-request schema 6 is accepted; received: ${JSON.stringify(req.schema)}`);
if (Object.hasOwn(req, 'config')) fail('Schema 6 does not accept the browser full config; use the Native baseline plus overrides');

requestAudit = normalizeAudit(req.audit);
const catalogContract = normalizeCatalogContract(req.catalog);
const requestDefconfig = typeof req.use_defconfig === 'boolean' ? req.use_defconfig : null;
const auditDefconfig = req.audit?.defconfig && typeof req.audit.defconfig.enabled === 'boolean'
  ? req.audit.defconfig.enabled : null;
if (requestDefconfig !== null && auditDefconfig !== null && requestDefconfig !== auditDefconfig) {
  fail('The defconfig switch does not match audit.defconfig.enabled');
}
const useDefconfig = requestDefconfig ?? auditDefconfig ?? false;
const isCustomTarget = ['custom-target', 'catalog-target'].includes(req.device);
if (!isCustomTarget) fail(`schema 6 only accepts a Catalog target: ${req.device}`);

let catalogIndex;
try { catalogIndex = await loadCatalogIndex(catalogContract.revision); }
catch (error) { fail(`Unable to read the pinned Catalog index: ${error.message}`); }
const catalogSource = catalogIndex.sources.find((item) => item.id === req.source);
const requestedBranch = String(req.branch || '');
const catalogBranch = catalogSource?.branches?.find((item) =>
  item.id === String(req.version) && (!requestedBranch || item.branch === requestedBranch));
if (!catalogSource || !catalogBranch || catalogBranch.state === 'unavailable') {
  fail(`Source/Branch is outside the pinned Catalog scope: ${req.source}/${req.version}/${requestedBranch}`);
}
const build = catalogSource.build || {};
if (!/^diy(?:2)?-[A-Za-z0-9._-]+\.sh$/.test(build.diy1 || '') ||
    !/^diy2-[A-Za-z0-9._-]+\.sh$/.test(build.diy2 || '')) {
  fail(`Catalog Source is missing a valid build tool: ${catalogSource.id}`);
}
const version = { id: catalogBranch.id, branch: catalogBranch.branch, label: catalogBranch.branch };
const source = {
  id: catalogSource.id, label: catalogSource.label || catalogSource.id, repo: catalogSource.repo,
  versions: [version], diy1: build.diy1, diy2: build.diy2, append: true,
};
const variant = { id: String(req.variant || 'custom'), name: String(req.variant || 'Custom Target') };
if (!/^[A-Za-z0-9._+-]{1,96}$/.test(variant.id)) fail(`Target Profile is invalid: ${variant.id}`);
const device = { id: req.device, brand: 'Catalog', name: 'Catalog Target', sources: [source] };
const configId = [device.id, source.id, version.id, variant.id].join('/');
if (req.configId !== configId) fail(`configId mismatch: received ${JSON.stringify(req.configId)}, expected ${configId}`);

const indexedLegacy = legacyCatalogContract(catalogBranch);
if (catalogContract.asset || catalogContract.compressedSha256 || catalogContract.compressedBytes) {
  if (!indexedLegacy || indexedLegacy.asset !== catalogContract.asset ||
      indexedLegacy.hash !== catalogContract.compressedSha256 || indexedLegacy.bytes !== catalogContract.compressedBytes ||
      indexedLegacy.catalogSchema !== catalogContract.catalogSchema || indexedLegacy.relationsSchema !== catalogContract.relationsSchema) {
    fail('The pinned Catalog index does not match the request legacy contract');
  }
}
if (String(catalogSource.repo || '') !== String(source.repo || '') ||
    catalogContract.sourceRepository !== String(source.repo || '')) {
  fail(`Catalog upstream repository mismatch: request=${source.repo}, contract=${catalogContract.sourceRepository}`);
}
const indexedCommit = String(catalogBranch.commit || catalogBranch.sourceCommit || '').toLowerCase();
if (indexedCommit && indexedCommit !== catalogContract.sourceCommit) {
  fail(`Catalog sourceCommit does not match the pinned index: index=${indexedCommit}, request=${catalogContract.sourceCommit}`);
}
const sourceCommit = catalogContract.sourceCommit;
const activeCatalogRevision = catalogContract.revision;

const targetContract = req.customTarget && typeof req.customTarget === 'object' && !Array.isArray(req.customTarget)
  ? req.customTarget : null;
if (!targetContract) fail('The Catalog Target request is missing its customTarget identity contract');
const CUSTOM_TARGET_FIELDS = Object.freeze(['profileSelector', 'profileSymbol', 'subtarget', 'system']);
const receivedTargetFields = Object.keys(targetContract).sort();
if (receivedTargetFields.length !== CUSTOM_TARGET_FIELDS.length ||
    receivedTargetFields.some((field, index) => field !== CUSTOM_TARGET_FIELDS[index])) {
  fail(`customTarget accepts only the minimal Target/Profile identity fields: ${CUSTOM_TARGET_FIELDS.join(',')}`);
}
if (CUSTOM_TARGET_FIELDS.some((field) => typeof targetContract[field] !== 'string')) {
  fail('customTarget Target/Profile identity fields must be strings');
}
const expectedBoard = String(targetContract.system || '');
const expectedSubtarget = String(targetContract.subtarget || '');
const expectedProfile = String(targetContract.profileSymbol || '');
const expectedSelector = String(targetContract.profileSelector || '');
if (!expectedBoard || !expectedProfile || !expectedSelector) {
  fail('customTarget is missing system/profile/profileSelector');
}

const { store: profileStore, contract: baselineContract } = await loadNativeProfileStore(
  catalogContract, catalogSource, catalogBranch,
);
const baseline = profileStore.resolve({
  system: expectedBoard,
  subtarget: expectedSubtarget,
  profileSymbol: expectedProfile,
  profileSelector: expectedSelector,
});
if (!baseline) fail(`The Native Profile baseline does not contain the requested Target/Profile: ${expectedBoard}/${expectedSubtarget}/${expectedProfile}`);
if (baseline.board !== expectedBoard || baseline.subtarget !== expectedSubtarget ||
    baseline.profile !== expectedProfile || baseline.selector !== expectedSelector) {
  fail(`Native Profile baseline identity mismatch: baseline=${baseline.board}/${baseline.subtarget}/${baseline.profile}/${baseline.selector}`);
}
const actualNativeHash = semanticHash(baseline.values);
if (actualNativeHash !== baseline.nativeHash) {
  fail(`Native Profile baseline semantic hash mismatch: ${actualNativeHash} != ${baseline.nativeHash}`);
}
device.name = [baseline.board || 'Target', baseline.subtarget, baseline.profile].filter(Boolean).join(' / ');

const rawOverrides = req.overrides;
if (!Array.isArray(rawOverrides)) fail('Schema 6 overrides must be an array');
if (rawOverrides.length > 50000) fail('More than 50000 Kconfig overrides are not accepted');
const { symbols: catalogKconfigSymbols } = await loadCatalogKconfigSymbols(catalogContract, catalogBranch);
let reconstructedValues;
try {
  reconstructedValues = applyProfileOverrides(
    baseline, rawOverrides, { allowedSymbols: catalogKconfigSymbols },
  );
}
catch (error) { fail(`Unable to apply Kconfig overrides: ${error.message}`); }
const baselineConfig = serializeConfigMap(baseline.values);
const reconstructedConfig = serializeConfigMap(reconstructedValues);
const reconstructedSha256 = sha256(reconstructedConfig);
writeFileSync(String(process.env.PROFILE_BASELINE_CONFIG_OUT || 'profile-baseline.config'), baselineConfig, 'utf8');
writeFileSync(String(process.env.RECONSTRUCTED_CONFIG_OUT || 'reconstructed.config'), reconstructedConfig, 'utf8');
writeFileSync(String(process.env.REQUEST_OVERRIDES_OUT || 'request-overrides.json'),
  JSON.stringify({ schema: 1, overrides: rawOverrides }, null, 2) + '\n', 'utf8');

const fw = req.firmware && typeof req.firmware === 'object' && !Array.isArray(req.firmware) ? req.firmware : {};
const themeSymbolRe = /^PACKAGE_(luci-theme-[A-Za-z0-9._+-]{1,48})$/;
  const enabledBaselineThemes = [...baseline.values]
  .filter(([symbol, value]) => themeSymbolRe.test(String(symbol)) && value !== 'n' && value !== '')
  .map(([symbol]) => themeSymbolRe.exec(String(symbol))[1]);
const catalogThemePackages = [...catalogKconfigSymbols]
  .map((symbol) => themeSymbolRe.exec(String(symbol))?.[1])
  .filter(Boolean)
  .sort((left, right) => left.localeCompare(right));
const hasExplicitTheme = own(fw, 'theme');
const requestedTheme = hasExplicitTheme ? fw.theme : PROJECT_FIRMWARE.theme;
if (typeof requestedTheme !== 'string' ||
    (hasExplicitTheme
      ? !/^luci-theme-[A-Za-z0-9._+-]{1,48}$/.test(requestedTheme)
      : (requestedTheme && !/^luci-theme-[A-Za-z0-9._+-]{1,48}$/.test(requestedTheme)))) {
  fail('Firmware theme format is invalid');
}
  const preferredTheme = requestedTheme || '';
  const fallbackTheme = [...new Set([
    ...enabledBaselineThemes,
    ...catalogThemePackages,
])].find((packageName) => catalogKconfigSymbols.has(`PACKAGE_${packageName}`));
// The current Catalog/Kconfig symbol set is the only availability allowlist. A
// missing project preference falls back to Native baseline (or Catalog default),
// while an explicit unavailable request is rejected above.
if (hasExplicitTheme && preferredTheme && !catalogKconfigSymbols.has(`PACKAGE_${preferredTheme}`)) {
  fail(`Firmware theme is outside the current Catalog/Kconfig scope: ${preferredTheme}`);
}
const theme = preferredTheme && catalogKconfigSymbols.has(`PACKAGE_${preferredTheme}`)
  ? preferredTheme : fallbackTheme;
if (!theme) fail('No usable LuCI theme is available in Catalog/Kconfig');


const rawPlugins = Array.isArray(req.plugins) ? req.plugins : [];
if (rawPlugins.length > 200) fail('More than 200 package display entries are not accepted');
const items = [];
for (const rawPlugin of rawPlugins) {
  if (typeof rawPlugin !== 'string' || !/^[+-]?[a-z0-9._-]{1,96}$/i.test(rawPlugin)) {
    fail(`Invalid package display entry: ${JSON.stringify(rawPlugin)}`);
  }
  if (!items.includes(rawPlugin)) items.push(rawPlugin);
}

const hasExplicitTag = own(req, 'tag');
const requestedTag = String(hasExplicitTag ? (req.tag ?? '') : (PROJECT_DEFAULT_TAG || ''));
if (requestedTag && !isValidBuildTag(requestedTag)) fail('The build tag must contain 1-160 visible Unicode characters and no control characters');
const tag = normalizeBuildTag(requestedTag,
  hasExplicitTag ? 'anonymous' : String(PROJECT_DEFAULT_TAG || 'anonymous'));
const artifactTag = artifactBuildTag(tag, 'anonymous');
const cleanIdentity = (value) => String(value || '').replace(/[^\w一-龥-]/g, '').slice(0, 24);
const titleIdentity = parseBuildIssueTitleIdentity(process.env.ISSUE_TITLE || '');
const attachmentRef = requestAttachmentName.match(/^([A-Za-z0-9]+_[A-Za-z0-9]+)[.-]/)?.[1] || '';
const requestedSourceEnv = String(req.sourceEnv || '').trim();
const normalizedSourceEnv = normalizeBuildEnvironment(requestedSourceEnv);
if (requestedSourceEnv && !normalizedSourceEnv) fail(`Invalid sourceEnv: ${requestedSourceEnv}`);
const sourceEnvIdentity = buildEnvironmentIdentity(normalizedSourceEnv);
if (titleIdentity.sourceEnv && sourceEnvIdentity && titleIdentity.sourceEnv !== sourceEnvIdentity) {
  fail(`sourceEnv does not match the Issue title: request=${sourceEnvIdentity}, title=${titleIdentity.sourceEnv}`);
}
if (titleIdentity.sourceEnv && !normalizedSourceEnv) fail('A non-main Issue title must provide sourceEnv in build-request.json');
const sourceEnv = normalizedSourceEnv;
const requestCommitInput = String(req.requestCommit || '').trim();
const requestCommit = normalizeBuildCommit(requestCommitInput);
if (!requestCommit) fail(`requestCommit must be a full 40-character Git commit: ${requestCommitInput}`);
const expectedSourceEnvInput = String(process.env.EXPECTED_REQUEST_BRANCH || '').trim();
const expectedSourceEnv = normalizeBuildEnvironment(expectedSourceEnvInput);
if (expectedSourceEnvInput && !expectedSourceEnv) fail(`Invalid EXPECTED_REQUEST_BRANCH: ${expectedSourceEnvInput}`);
const expectedRequestCommitInput = String(process.env.EXPECTED_REQUEST_COMMIT || '').trim();
const expectedRequestCommit = normalizeBuildCommit(expectedRequestCommitInput);
if (expectedRequestCommitInput && !expectedRequestCommit) fail(`Invalid EXPECTED_REQUEST_COMMIT: ${expectedRequestCommitInput}`);
if (expectedSourceEnv && sourceEnv !== expectedSourceEnv) {
  fail(`sourceEnv does not match the actual Worker branch: request=${sourceEnv || '(missing)'}, worker=${expectedSourceEnv}`);
}
if (expectedRequestCommit && requestCommit !== expectedRequestCommit) {
  fail(`requestCommit does not match the actual Worker commit: request=${requestCommit}, worker=${expectedRequestCommit}`);
}
const requestRef = cleanIdentity(req.requestId || attachmentRef || titleIdentity.requestId);
const buildRef = requestRef ? `${requestRef}-${artifactTag}` : artifactTag;
const artifactRef = artifactBuildRef(buildRef, sourceEnv, Number(process.env.ISSUE_NUMBER || 0));

const privateIpv4 = /^(192\.168|10\.\d{1,3}|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}$/;
const projectLanip = String(PROJECT_FIRMWARE.lanIp || '192.168.1.1');
const requestedLanip = own(req, 'lanip') ? req.lanip : projectLanip;
if (!privateIpv4.test(String(requestedLanip))) fail('LAN IP address is invalid');
const lanip = String(requestedLanip);

const projectPasswordMode = String(PROJECT_BUILD_PASSWORD.mode || 'prompt');
const passwordModes = new Set(['prompt', 'empty', 'secret']);
if (!passwordModes.has(projectPasswordMode)) fail(`Project password policy is invalid: ${projectPasswordMode}`);
let rootpw = '';
let explicitRootpw = false;
if (own(req, 'rootpw')) {
  const rp = req.rootpw;
  if (rp === '@empty') {
    rootpw = rp;
    explicitRootpw = true;
  } else if (typeof rp === 'string' && /^[A-Za-z0-9@#%^&*_+=.,:!?-]{4,32}$/.test(rp)) {
    rootpw = rp;
    explicitRootpw = true;
  } else if (rp !== '' && rp !== null && rp !== undefined) {
    fail('Initial password format is invalid');
  }
}
// The project policy's empty mode is materialized as @empty, while secret mode
// remains unresolved until the dedicated workflow password step reads its Secret.
if (!explicitRootpw && projectPasswordMode === 'empty') rootpw = '@empty';

const TIMEZONES = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'timezones.json'), 'utf8')).zones;
const NTP = {
  cn: ['ntp.aliyun.com', 'time1.cloud.tencent.com', 'cn.ntp.org.cn', 'cn.pool.ntp.org'],
  global: ['0.openwrt.pool.ntp.org', '1.openwrt.pool.ntp.org', '2.openwrt.pool.ntp.org', '3.openwrt.pool.ntp.org'],
  cloudflare: ['time.cloudflare.com', 'time.google.com', 'time.apple.com', 'pool.ntp.org'],
};
const projectTimezone = PROJECT_FIRMWARE.timezone && typeof PROJECT_FIRMWARE.timezone === 'object'
  ? PROJECT_FIRMWARE.timezone : {};
const timezoneCandidates = [
  own(fw, 'zonename') ? fw.zonename : null,
  own(fw, 'timezone') ? fw.timezone : null,
  projectTimezone.zonename,
  projectTimezone.timezone,
].filter((value) => value !== null && value !== undefined && value !== '');
const selectedZone = timezoneCandidates.reduce((selected, candidate) => selected ||
  TIMEZONES.find((zone) => zone.zonename === candidate || zone.timezone === candidate), null) ||
  TIMEZONES.find((zone) => zone.zonename === 'Asia/Shanghai');
if (!selectedZone) fail('No usable timezone default is available');
const zonename = selectedZone.zonename;
const timezone = selectedZone.timezone;
const projectNtp = PROJECT_FIRMWARE.ntp && typeof PROJECT_FIRMWARE.ntp === 'object'
  ? PROJECT_FIRMWARE.ntp : {};
const projectNtpId = Object.hasOwn(NTP, projectNtp.preset) ? projectNtp.preset : 'cn';
const requestedNtp = own(fw, 'ntp') ? fw.ntp : projectNtpId;
if (!Object.hasOwn(NTP, requestedNtp)) fail(`Unknown NTP preset: ${requestedNtp}`);
const ntpId = requestedNtp;
const configuredNtpServers = Array.isArray(projectNtp.servers) && projectNtp.servers.length === 4 &&
  projectNtp.servers.every((server) => typeof server === 'string' && server.length > 0)
  ? projectNtp.servers.map(String) : null;
const ntpServers = configuredNtpServers && ntpId === projectNtpId ? configuredNtpServers : NTP[ntpId];
const projectMirror = String(PROJECT_FIRMWARE.packageMirror || 'source-default');
const requestedMirrorInput = String(own(fw, 'packageMirror') ? fw.packageMirror
  : own(fw, 'opkg') ? fw.opkg : projectMirror).toLowerCase();
const requestedMirrorId = String(PACKAGE_MIRROR_RULES.aliases?.[requestedMirrorInput] || requestedMirrorInput);
const mirrorPreset = (PACKAGE_MIRROR_RULES.presets || []).find((preset) => preset.id === requestedMirrorId);
if (!mirrorPreset) fail(`Unknown package mirror preset: ${requestedMirrorInput}`);
const sourceFamily = String(PACKAGE_MIRROR_RULES.sourceFamilies?.[source.id] || '');
if (!sourceFamily) fail(`No source is registered for the package mirror: ${source.id}`);
if (mirrorPreset.kind === 'mirror' && !mirrorPreset.roots?.[sourceFamily]) {
  fail(`${source.id} does not accept the selected package mirror preset: ${requestedMirrorInput}`);
}
const packageMirrorId = mirrorPreset.id;
const hasFirmwareSnapshot = Boolean(req.firmware);
let pageVersion = String(req.pageVersion || '');
if (!/^v\d{8}(?:\d{2})?$/.test(pageVersion)) pageVersion = 'unknown';

const rawPkgs = Array.isArray(req.packages) ? req.packages : [];
if (rawPkgs.length) fail('Schema 6 does not accept a second packages field; Advanced menuconfig must be represented by overrides');

const out = [
  `device=${device.id}`,
  `source=${source.id}`,
  `version=${version.id}`,
  `branch=${version.branch}`,
  `repo=${source.repo}`,
  `source_commit=${sourceCommit}`,
  `catalog_revision=${activeCatalogRevision}`,
  `catalog_asset=${catalogContract.asset || indexedLegacy?.asset || ''}`,
  `catalog_hash=${catalogContract.compressedSha256 || indexedLegacy?.hash || ''}`,
  `catalog_bytes=${catalogContract.compressedBytes || indexedLegacy?.bytes || ''}`,
  `profile_baseline_asset=${baselineContract.asset}`,
  `profile_baseline_hash=${baselineContract.hash}`,
  `profile_native_hash=${baseline.nativeHash}`,
  `override_count=${rawOverrides.length}`,
  `diy1=${source.diy1}`,
  `diy2=${source.diy2}`,
  `variant=${variant.id}`,
  `plugins=${items.join(' ')}`,
  `tag=${tag}`,
  `build_ref=${buildRef}`,
  `artifact_ref=${artifactRef}`,
  `source_env=${sourceEnv}`,
  `request_commit=${requestCommit}`,
  `lanip=${lanip}`,
  `rootpw=${rootpw}`,
  `password_mode=${projectPasswordMode}`,
  `page_version=${pageVersion}`,
  `zonename=${zonename}`,
  `timezone=${timezone}`,
  `theme=${theme}`,
  `ntp_id=${ntpId}`,
  `ntp_1=${ntpServers[0]}`,
  `ntp_2=${ntpServers[1]}`,
  `ntp_3=${ntpServers[2]}`,
  `ntp_4=${ntpServers[3]}`,
  `package_mirror_id=${packageMirrorId}`,
  `compile_jobs=${PROJECT_COMPILE_JOBS}`,
  `download_jobs=${PROJECT_DOWNLOAD_JOBS}`,
  `firmware_snapshot=${hasFirmwareSnapshot ? 1 : 0}`,
  `use_defconfig=${useDefconfig ? 1 : 0}`,
  `request_mode=${requestMode}`,
  `config_id=${configId}`,
  `reconstructed_sha256=${reconstructedSha256}`,
  `summary=${tag} · ${device.name} · ${source.label} ${version.label} · ${variant.name} · ${rawOverrides.length} config overrides · ${pageVersion}`,
];
const auditOut = String(process.env.REQUEST_AUDIT_OUT || 'request-audit.json');
writeFileSync(auditOut, JSON.stringify(requestAudit) + '\n', 'utf8');
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, out.join('\n') + '\n');
console.log(out.filter((line) => !line.startsWith('rootpw=')).join('\n'));
