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
  artifactBuildRef, buildEnvironmentIdentity, normalizeBuildCommit, normalizeBuildEnvironment,
  parseBuildIssueTitleIdentity,
} from '../site/wrt/lib/build-identity.js';
import { createCatalogModel } from '../site/wrt/lib/catalog-engine.js';
import {
  applyProfileOverrides, createProfileBaselineStore, serializeConfigMap,
} from '../site/wrt/lib/profile-baseline.js';
import { normalizeRequestAudit } from './request-audit.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'project.json'), 'utf8'));
const PACKAGE_MIRROR_RULES = JSON.parse(
  readFileSync(join(ROOT, 'config', 'policies', 'package-mirrors.json'), 'utf8'));
const SHA256_RE = /^[a-f0-9]{64}$/;
const GIT_COMMIT_RE = /^[a-f0-9]{40}$/;

function fail(msg) { console.error('校验失败: ' + msg); process.exit(1); }
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

async function fetchCatalogResource(revision, path, { binary = false } = {}) {
  const repo = PROJECT.catalogRepository;
  const ref = String(revision || '').trim().toLowerCase();
  if (!GIT_COMMIT_RE.test(ref)) throw new Error(`Catalog revision 非法:${ref}`);
  const safePath = String(path || '').replace(/^\/+/, '');
  if (!safePath || safePath.includes('..') || !/^[A-Za-z0-9._/-]+$/.test(safePath)) {
    throw new Error(`Catalog asset 路径非法:${path}`);
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
  throw new Error(`无法读取固定 Catalog 资源 ${safePath}: ${errors.join(' | ')}`);
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
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('schema 6 请求缺少 catalog 版本契约');
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
  const expectedRepo = String(PROJECT.catalogRepository || '');
  if (contract.repository !== expectedRepo) fail(`Catalog 仓库不在白名单:${contract.repository}`);
  if (!GIT_COMMIT_RE.test(contract.revision)) fail('Catalog revision 必须是完整 40 位 Git commit');
  if (contract.asset && !/^[A-Za-z0-9._-]+\.json\.gz$/.test(contract.asset)) fail(`Catalog asset 非法:${contract.asset}`);
  if (contract.compressedSha256 && !SHA256_RE.test(contract.compressedSha256)) fail('Catalog compressedSha256 非法');
  if (contract.compressedBytes && (!Number.isSafeInteger(contract.compressedBytes) || contract.compressedBytes <= 0)) {
    fail('Catalog compressedBytes 非法');
  }
  if (contract.catalogSchema && contract.catalogSchema < 5) fail('Catalog schema 版本过旧');
  if (contract.relationsSchema && contract.relationsSchema < 2) fail('Catalog relations schema 版本过旧');
  if (!GIT_COMMIT_RE.test(contract.sourceCommit)) fail('Catalog sourceCommit 必须是完整 40 位 Git commit');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(contract.sourceRepository)) fail('Catalog sourceRepository 非法');
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
    fail('固定 Catalog index 缺少有效 Native Profile baseline 契约');
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
    fail('固定 Catalog index 缺少有效 Kconfig graph 契约');
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
    fail(`Catalog Kconfig graph bytes 不一致:${compressed.byteLength} != ${contract.bytes}`);
  }
  if (sha256(compressed) !== contract.hash) fail('Catalog Kconfig graph compressed SHA-256 不一致');
  let document;
  try { document = JSON.parse(gunzipSync(compressed).toString('utf8')); }
  catch (error) { fail(`Catalog Kconfig graph 无法解压/解析:${error.message}`); }
  const actualCommit = String(document?.source?.commit || '').toLowerCase();
  if (actualCommit && actualCommit !== catalogContract.sourceCommit) {
    fail(`Catalog Kconfig graph source commit 不一致:${actualCommit} != ${catalogContract.sourceCommit}`);
  }
  let model;
  try { model = createCatalogModel({ schema: 6, relations: document?.relations }); }
  catch (error) { fail(`Catalog Kconfig graph 契约无效:${error.message}`); }
  const symbols = new Set(model.bySymbol.keys());
  if (!symbols.size) fail('Catalog Kconfig graph 不包含任何 Kconfig symbol');
  return { symbols, contract };
}

async function loadNativeProfileStore(catalogContract, catalogSource, catalogBranch) {
  const contract = profileBaselineContract(catalogBranch);
  const compressed = await fetchCatalogResource(catalogContract.revision, contract.asset, { binary: true });
  if (compressed.byteLength !== contract.bytes) {
    fail(`Native Profile baseline bytes 不一致:${compressed.byteLength} != ${contract.bytes}`);
  }
  const compressedHash = sha256(compressed);
  if (compressedHash !== contract.hash) fail('Native Profile baseline compressed SHA-256 不一致');
  let document;
  try { document = JSON.parse(gunzipSync(compressed).toString('utf8')); }
  catch (error) { fail(`Native Profile baseline 无法解压/解析:${error.message}`); }
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
    fail(`Native Profile baseline 契约无效:${error.message}`);
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
  catch (error) { fail('附件清单无法解析: ' + error.message); }
  const jsonFiles = manifest?.version === 1 && Array.isArray(manifest.files)
    ? manifest.files.filter((entry) => entry.type === 'json') : [];
  if (jsonFiles.length !== 1 || manifest.files.length !== 1) {
    fail('请只上传一个 schema 6 build-request.json；.config/config.buildinfo 应先在网页导入');
  }
  selectedFile = jsonFiles[0].path;
  requestAttachmentName = jsonFiles[0].name || '';
}
if (!selectedFile) fail('缺少 schema 6 build-request.json');
requestAttachmentName ||= basename(selectedFile);
let raw;
try { raw = readFileSync(selectedFile); } catch (error) { fail('无法读取 build-request.json: ' + error.message); }
if (raw.length < 32 || raw.length > 2 * 1024 * 1024) fail(`build-request.json 大小非法: ${raw.length} bytes`);
try { req = JSON.parse(raw.toString('utf8')); } catch (error) { fail('build-request.json 无法解析: ' + error.message); }
if (req.schema !== 6) fail(`只接受 build-request schema 6，收到: ${JSON.stringify(req.schema)}`);
if (Object.hasOwn(req, 'config')) fail('schema 6 不接受浏览器整份 config；只接受 Native baseline + overrides');

requestAudit = normalizeAudit(req.audit);
const catalogContract = normalizeCatalogContract(req.catalog);
const requestDefconfig = typeof req.use_defconfig === 'boolean' ? req.use_defconfig : null;
const auditDefconfig = req.audit?.defconfig && typeof req.audit.defconfig.enabled === 'boolean'
  ? req.audit.defconfig.enabled : null;
if (requestDefconfig !== null && auditDefconfig !== null && requestDefconfig !== auditDefconfig) {
  fail('defconfig 开关与 audit.defconfig.enabled 不一致');
}
const useDefconfig = requestDefconfig ?? auditDefconfig ?? false;
const isCustomTarget = ['custom-target', 'catalog-target'].includes(req.device);
if (!isCustomTarget) fail(`schema 6 only accepts a Catalog target: ${req.device}`);

let catalogIndex;
try { catalogIndex = await loadCatalogIndex(catalogContract.revision); }
catch (error) { fail(`无法读取固定 Catalog index: ${error.message}`); }
const catalogSource = catalogIndex.sources.find((item) => item.id === req.source);
const requestedBranch = String(req.branch || '');
const catalogBranch = catalogSource?.branches?.find((item) =>
  item.id === String(req.version) && (!requestedBranch || item.branch === requestedBranch));
if (!catalogSource || !catalogBranch || catalogBranch.state === 'unavailable') {
  fail(`Source/Branch 不在固定 Catalog 范围: ${req.source}/${req.version}/${requestedBranch}`);
}
const build = catalogSource.build || {};
if (!/^diy(?:2)?-[A-Za-z0-9._-]+\.sh$/.test(build.diy1 || '') ||
    !/^diy2-[A-Za-z0-9._-]+\.sh$/.test(build.diy2 || '')) {
  fail(`Catalog Source 缺少有效构建工具: ${catalogSource.id}`);
}
const version = { id: catalogBranch.id, branch: catalogBranch.branch, label: catalogBranch.branch };
const source = {
  id: catalogSource.id, label: catalogSource.label || catalogSource.id, repo: catalogSource.repo,
  versions: [version], diy1: build.diy1, diy2: build.diy2, append: true,
};
const variant = { id: String(req.variant || 'custom'), name: String(req.variant || 'Custom Target') };
if (!/^[A-Za-z0-9._+-]{1,96}$/.test(variant.id)) fail(`Target Profile 非法: ${variant.id}`);
const device = { id: req.device, brand: 'Catalog', name: 'Catalog Target', sources: [source] };
const configId = [device.id, source.id, version.id, variant.id].join('/');
if (req.configId !== configId) fail(`configId 不匹配:收到 ${JSON.stringify(req.configId)},应为 ${configId}`);

const indexedLegacy = legacyCatalogContract(catalogBranch);
if (catalogContract.asset || catalogContract.compressedSha256 || catalogContract.compressedBytes) {
  if (!indexedLegacy || indexedLegacy.asset !== catalogContract.asset ||
      indexedLegacy.hash !== catalogContract.compressedSha256 || indexedLegacy.bytes !== catalogContract.compressedBytes ||
      indexedLegacy.catalogSchema !== catalogContract.catalogSchema || indexedLegacy.relationsSchema !== catalogContract.relationsSchema) {
    fail('固定 Catalog index 与请求的 legacy 契约不一致');
  }
}
if (String(catalogSource.repo || '') !== String(source.repo || '') ||
    catalogContract.sourceRepository !== String(source.repo || '')) {
  fail(`Catalog 上游仓库不匹配:request=${source.repo},contract=${catalogContract.sourceRepository}`);
}
const indexedCommit = String(catalogBranch.commit || catalogBranch.sourceCommit || '').toLowerCase();
if (indexedCommit && indexedCommit !== catalogContract.sourceCommit) {
  fail(`Catalog sourceCommit 与固定 index 不一致:index=${indexedCommit},request=${catalogContract.sourceCommit}`);
}
const sourceCommit = catalogContract.sourceCommit;
const activeCatalogRevision = catalogContract.revision;

const targetContract = req.customTarget && typeof req.customTarget === 'object' && !Array.isArray(req.customTarget)
  ? req.customTarget : null;
if (!targetContract) fail('Catalog Target 请求缺少 customTarget 身份契约');
const expectedBoard = String(targetContract.system || '');
const expectedSubtarget = String(targetContract.subtarget || '');
const expectedProfile = String(targetContract.profileSymbol ||
  (targetContract.profile ? `DEVICE_${targetContract.profile}` : ''));
const expectedSelector = String(targetContract.profileSelector || '');
if (!expectedBoard || !expectedProfile || !expectedSelector) {
  fail('customTarget 缺少 system/profile/profileSelector');
}

const { store: profileStore, contract: baselineContract } = await loadNativeProfileStore(
  catalogContract, catalogSource, catalogBranch,
);
const baseline = profileStore.resolve({
  system: expectedBoard,
  subtarget: expectedSubtarget,
  profileSymbol: expectedProfile,
  profile: targetContract.profile,
  profileSelector: expectedSelector,
});
if (!baseline) fail(`Native Profile baseline 不包含请求 Target/Profile:${expectedBoard}/${expectedSubtarget}/${expectedProfile}`);
if (baseline.board !== expectedBoard || baseline.subtarget !== expectedSubtarget ||
    baseline.profile !== expectedProfile || baseline.selector !== expectedSelector) {
  fail(`Native Profile baseline 身份不一致:baseline=${baseline.board}/${baseline.subtarget}/${baseline.profile}/${baseline.selector}`);
}
const actualNativeHash = semanticHash(baseline.values);
if (actualNativeHash !== baseline.nativeHash) {
  fail(`Native Profile baseline semantic hash 不一致:${actualNativeHash} != ${baseline.nativeHash}`);
}
device.name = [baseline.board || 'Target', baseline.subtarget, baseline.profile].filter(Boolean).join(' / ');

const rawOverrides = req.overrides;
if (!Array.isArray(rawOverrides)) fail('schema 6 overrides 必须是数组');
if (rawOverrides.length > 50000) fail('Kconfig override 数量超过 50000，拒绝');
const { symbols: catalogKconfigSymbols } = await loadCatalogKconfigSymbols(catalogContract, catalogBranch);
let reconstructedValues;
try {
  reconstructedValues = applyProfileOverrides(
    baseline, rawOverrides, { allowedSymbols: catalogKconfigSymbols },
  );
}
catch (error) { fail(`Kconfig overrides 无法应用:${error.message}`); }
const baselineConfig = serializeConfigMap(baseline.values);
const reconstructedConfig = serializeConfigMap(reconstructedValues);
const reconstructedSha256 = sha256(reconstructedConfig);
writeFileSync(String(process.env.PROFILE_BASELINE_CONFIG_OUT || 'profile-baseline.config'), baselineConfig, 'utf8');
writeFileSync(String(process.env.RECONSTRUCTED_CONFIG_OUT || 'reconstructed.config'), reconstructedConfig, 'utf8');
writeFileSync(String(process.env.REQUEST_OVERRIDES_OUT || 'request-overrides.json'),
  JSON.stringify({ schema: 1, overrides: rawOverrides }, null, 2) + '\n', 'utf8');

const catalogArch = String(targetContract.arch || '');
const catalogArchPackages = String(targetContract.archPackages || '');
const catalogProfilePackages = Array.isArray(targetContract.profilePackagesAdd)
  ? [...new Set(targetContract.profilePackagesAdd.map(String))] : [];

const rawPlugins = Array.isArray(req.plugins) ? req.plugins : [];
if (rawPlugins.length > 200) fail('插件显示列表数量超过 200，拒绝');
const items = [];
for (const rawPlugin of rawPlugins) {
  if (typeof rawPlugin !== 'string' || !/^[+-]?[a-z0-9._-]{1,96}$/i.test(rawPlugin)) {
    fail(`非法插件显示项: ${JSON.stringify(rawPlugin)}`);
  }
  if (!items.includes(rawPlugin)) items.push(rawPlugin);
}

const tag = String(req.tag || '').replace(/[^\w一-龥-]/g, '').slice(0, 24) || 'anonymous';
const cleanIdentity = (value) => String(value || '').replace(/[^\w一-龥-]/g, '').slice(0, 24);
const titleIdentity = parseBuildIssueTitleIdentity(process.env.ISSUE_TITLE || '');
const attachmentRef = requestAttachmentName.match(/^([A-Za-z0-9]+_[A-Za-z0-9]+)[.-]/)?.[1] || '';
const requestedSourceEnv = String(req.sourceEnv || '').trim();
const normalizedSourceEnv = normalizeBuildEnvironment(requestedSourceEnv);
if (requestedSourceEnv && !normalizedSourceEnv) fail(`非法 sourceEnv: ${requestedSourceEnv}`);
const sourceEnvIdentity = buildEnvironmentIdentity(normalizedSourceEnv);
if (titleIdentity.sourceEnv && sourceEnvIdentity && titleIdentity.sourceEnv !== sourceEnvIdentity) {
  fail(`sourceEnv 与 Issue 标题不一致: request=${sourceEnvIdentity}, title=${titleIdentity.sourceEnv}`);
}
if (titleIdentity.sourceEnv && !normalizedSourceEnv) fail('非 main Issue 标题必须由 build-request.json 提供 sourceEnv');
const sourceEnv = normalizedSourceEnv;
const requestCommitInput = String(req.requestCommit || '').trim();
const requestCommit = normalizeBuildCommit(requestCommitInput);
if (!requestCommit) fail(`requestCommit 必须是完整 40 位 Git commit:${requestCommitInput}`);
const expectedSourceEnvInput = String(process.env.EXPECTED_REQUEST_BRANCH || '').trim();
const expectedSourceEnv = normalizeBuildEnvironment(expectedSourceEnvInput);
if (expectedSourceEnvInput && !expectedSourceEnv) fail(`非法 EXPECTED_REQUEST_BRANCH: ${expectedSourceEnvInput}`);
const expectedRequestCommitInput = String(process.env.EXPECTED_REQUEST_COMMIT || '').trim();
const expectedRequestCommit = normalizeBuildCommit(expectedRequestCommitInput);
if (expectedRequestCommitInput && !expectedRequestCommit) fail(`非法 EXPECTED_REQUEST_COMMIT: ${expectedRequestCommitInput}`);
if (expectedSourceEnv && sourceEnv !== expectedSourceEnv) {
  fail(`sourceEnv 与实际 Worker 分支不一致: request=${sourceEnv || '(missing)'}, worker=${expectedSourceEnv}`);
}
if (expectedRequestCommit && requestCommit !== expectedRequestCommit) {
  fail(`requestCommit 与实际 Worker 提交不一致: request=${requestCommit}, worker=${expectedRequestCommit}`);
}
const requestRef = cleanIdentity(req.requestId || attachmentRef || titleIdentity.requestId);
const buildRef = requestRef ? `${requestRef}-${tag}` : tag;
const artifactRef = artifactBuildRef(buildRef, sourceEnv, Number(process.env.ISSUE_NUMBER || 0));

const lanip = /^(192\.168|10\.\d{1,3}|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}$/.test(String(req.lanip || ''))
  ? String(req.lanip) : '192.168.1.1';
const rp = String(req.rootpw || '');
const rootpw = (rp === '@empty' || /^[A-Za-z0-9@#%^&*_+=.,:!?-]{4,32}$/.test(rp)) ? rp : '';

const fw = req.firmware && typeof req.firmware === 'object' && !Array.isArray(req.firmware) ? req.firmware : {};
const TIMEZONES = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'timezones.json'), 'utf8')).zones;
const NTP = {
  cn: ['ntp.aliyun.com', 'time1.cloud.tencent.com', 'cn.ntp.org.cn', 'cn.pool.ntp.org'],
  global: ['0.openwrt.pool.ntp.org', '1.openwrt.pool.ntp.org', '2.openwrt.pool.ntp.org', '3.openwrt.pool.ntp.org'],
  cloudflare: ['time.cloudflare.com', 'time.google.com', 'time.apple.com', 'pool.ntp.org'],
};
const selectedZone = TIMEZONES.find((zone) => zone.zonename === fw.zonename) ||
  TIMEZONES.find((zone) => zone.zonename === fw.timezone) ||
  TIMEZONES.find((zone) => zone.timezone === fw.timezone) ||
  TIMEZONES.find((zone) => zone.zonename === 'Asia/Shanghai');
const zonename = selectedZone.zonename;
const timezone = selectedZone.timezone;
const ntpId = Object.hasOwn(NTP, fw.ntp) ? fw.ntp : 'cn';
const requestedMirrorInput = String(fw.packageMirror || fw.opkg || 'source-default').toLowerCase();
const requestedMirrorId = String(PACKAGE_MIRROR_RULES.aliases?.[requestedMirrorInput] || requestedMirrorInput);
const mirrorPreset = (PACKAGE_MIRROR_RULES.presets || []).find((preset) => preset.id === requestedMirrorId);
if (!mirrorPreset) fail(`未知软件包镜像预设:${requestedMirrorInput}`);
const sourceFamily = String(PACKAGE_MIRROR_RULES.sourceFamilies?.[source.id] || '');
if (!sourceFamily) fail(`软件包镜像没有登记源码:${source.id}`);
if (mirrorPreset.kind === 'mirror' && !mirrorPreset.roots?.[sourceFamily]) {
  fail(`${source.id} 不接受所选软件包镜像预设:${requestedMirrorInput}`);
}
const packageMirrorId = mirrorPreset.id;
const theme = String(fw.theme || '');
if (!/^luci-theme-[A-Za-z0-9._+-]{1,48}$/.test(theme)) fail('固件主题格式非法');
const hasFirmwareSnapshot = Boolean(req.firmware);
let pageVersion = String(req.pageVersion || '');
if (!/^v\d{8}(?:\d{2})?$/.test(pageVersion)) pageVersion = 'unknown';

const rawPkgs = Array.isArray(req.packages) ? req.packages : [];
if (rawPkgs.length) fail('schema 6 不接受第二套 packages 字段；Advanced menuconfig 只能由 overrides 表达');

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
  `page_version=${pageVersion}`,
  `zonename=${zonename}`,
  `timezone=${timezone}`,
  `theme=${theme}`,
  `ntp_id=${ntpId}`,
  `ntp_1=${NTP[ntpId][0]}`,
  `ntp_2=${NTP[ntpId][1]}`,
  `ntp_3=${NTP[ntpId][2]}`,
  `ntp_4=${NTP[ntpId][3]}`,
  `package_mirror_id=${packageMirrorId}`,
  `firmware_snapshot=${hasFirmwareSnapshot ? 1 : 0}`,
  `use_defconfig=${useDefconfig ? 1 : 0}`,
  `catalog_arch=${catalogArch}`,
  `catalog_arch_packages=${catalogArchPackages}`,
  `catalog_profile_packages=${catalogProfilePackages.join(' ')}`,
  `request_mode=${requestMode}`,
  `config_id=${configId}`,
  `reconstructed_sha256=${reconstructedSha256}`,
  `summary=${tag} · ${device.name} · ${source.label} ${version.label} · ${variant.name} · ${rawOverrides.length} config overrides · ${pageVersion}`,
];
const auditOut = String(process.env.REQUEST_AUDIT_OUT || 'request-audit.json');
writeFileSync(auditOut, JSON.stringify(requestAudit) + '\n', 'utf8');
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, out.join('\n') + '\n');
console.log(out.filter((line) => !line.startsWith('rootpw=')).join('\n'));
