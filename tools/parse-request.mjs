#!/usr/bin/env node
// 解析构建请求并做白名单校验,输出 GitHub Actions outputs / Parses a build request, validates against the whitelist, emits GitHub Actions outputs.
// 请求仅接受网页生成的 Issue 附件；环境变量传入路径，避免命令行注入。
// Requests only accept authoritative Issue attachments, with paths passed through environment variables.
// 插件项高级模式前缀:+id 强制开启该源没有的包,-id 取消该源内置项 / advanced plugin prefixes: +id force-enables a pkg the source lacks, -id drops a builtin.
// 校验失败以非零码退出,workflow 据此回评并终止 / Any validation failure exits non-zero so the workflow can comment back and abort.

import { readFileSync, appendFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artifactBuildRef, buildEnvironmentIdentity, normalizeBuildCommit, normalizeBuildEnvironment, parseBuildIssueTitleIdentity } from '../site/wrt/lib/build-identity.js';
import { normalizeRequestAudit } from './request-audit.mjs';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEVICES = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'devices.json'), 'utf8'));
const CONFIG_MANIFEST = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'config-manifest.json'), 'utf8'));
const PROJECT = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'project.json'), 'utf8'));
const LOCAL_CATALOG_INDEX = JSON.parse(
  readFileSync(join(ROOT, 'site', 'wrt', 'data', 'menuconfig-index.json'), 'utf8'));
const PACKAGE_MIRROR_RULES = JSON.parse(
  readFileSync(join(ROOT, 'config', '001.presets', 'package-mirrors.json'), 'utf8'));

function fail(msg) { console.error('校验失败: ' + msg); process.exit(1); }
function configStringValue(text, symbol) {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(text).match(new RegExp(`^CONFIG_${escaped}="([^"]*)"$`, 'm'))?.[1] || '';
}

function normalizeAudit(raw) {
  try { return normalizeRequestAudit(raw); }
  catch (error) { fail(error.message); }
}
async function loadCatalogIndex(revision = 'catalog-data') {
  const repo = PROJECT.catalogRepository || LOCAL_CATALOG_INDEX.catalogRepo;
  const ref = String(revision || 'catalog-data').trim().toLowerCase();
  if (ref !== 'catalog-data' && !/^[a-f0-9]{40}$/.test(ref)) throw new Error(`Catalog index revision 非法:${ref}`);
  const urls = [
    `https://raw.githubusercontent.com/${repo}/${ref}/index.json`,
    `https://cdn.jsdelivr.net/gh/${repo}@${ref}/index.json`,
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const index = await response.json();
      if (Number(index?.schema || 0) >= 2 && Array.isArray(index.sources)) return index;
      throw new Error('invalid Catalog index schema');
    } catch (error) {
      console.warn(`Catalog index fallback / 目录索引回退: ${url}: ${error.message}`);
    }
  }
  if (ref === 'catalog-data') return LOCAL_CATALOG_INDEX;
  throw new Error(`无法读取固定 Catalog index revision:${ref}`);
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
  if (!raw || typeof raw !== 'object') fail('schema 5 请求缺少 catalog 版本契约');
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
  const expectedRepo = String(PROJECT.catalogRepository || LOCAL_CATALOG_INDEX.catalogRepo || '');
  if (contract.repository !== expectedRepo) fail(`Catalog 仓库不在白名单:${contract.repository}`);
  if (!/^[a-f0-9]{40}$/.test(contract.revision)) fail('Catalog revision 必须是完整 40 位 Git commit');
  if (!/^[A-Za-z0-9._-]+\.json\.gz$/.test(contract.asset)) fail(`Catalog asset 非法:${contract.asset}`);
  if (!/^[a-f0-9]{64}$/.test(contract.compressedSha256)) fail('Catalog compressedSha256 非法');
  if (!Number.isSafeInteger(contract.compressedBytes) || contract.compressedBytes <= 0) fail('Catalog compressedBytes 非法');
  if (contract.catalogSchema < 5 || contract.relationsSchema < 2) fail('请求需要 Catalog schema 5 / relations schema 2');
  if (!/^[a-f0-9]{40}$/.test(contract.sourceCommit)) fail('Catalog sourceCommit 必须是完整 40 位 Git commit');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(contract.sourceRepository)) fail('Catalog sourceRepository 非法');
  return contract;
}


let req;
let requestMode = 'issue-attachment';
let submittedConfig = '';
let requestAttachmentName = '';
let recommendationAudit = { recommended: { enabled: false, preset: '', requested: [] }, defconfig: { enabled: false } };
const requestManifest = String(process.env.REQUEST_MANIFEST || '').trim();
const requestFile = String(process.env.REQUEST_FILE || '').trim();
if (requestManifest) {
  let manifest;
  try { manifest = JSON.parse(readFileSync(requestManifest, 'utf8')); } catch (e) { fail('附件清单无法解析: ' + e.message); }
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.files) || !manifest.files.length) fail('附件清单格式非法');
  const jsonFiles = manifest.files.filter((f) => f.type === 'json');
  if (jsonFiles.length) {
    if (manifest.files.length !== 1) fail('build-request.json 必须单独上传,不要与 .config/config.buildinfo 混用');
    requestAttachmentName = jsonFiles[0].name || '';
    try { req = JSON.parse(readFileSync(jsonFiles[0].path, 'utf8')); } catch (e) { fail('build-request.json 无法解析: ' + e.message); }
    if (![3, 4, 5].includes(req.schema)) fail(`不支持的 build-request schema:${JSON.stringify(req.schema)}(需要 3、4 或 5)`);
    submittedConfig = req.config;
    requestMode = 'issue-json';
  } else {
    const configs = manifest.files.filter((f) => f.type === 'config');
    const buildinfos = manifest.files.filter((f) => f.type === 'buildinfo');
    if (configs.length > 1 || (!configs.length && buildinfos.length > 1)) fail('请只上传一份 .config 或 config.buildinfo,避免配置冲突');
    const picked = configs[0] || buildinfos[0];
    requestAttachmentName = picked.name || '';
    submittedConfig = readFileSync(picked.path, 'utf8');
    const header = submittedConfig.match(/^# device=([^\s]+) source=([^\s]+) version=([^\s]+)(?: \(([^)]+)\))? variant=([^\s]+)$/m);
    if (!header) fail('原始配置缺少机型元数据。请先在定制网页点“加载配置”,识别机型后再点“提交云编译”');
    const fwHeader = submittedConfig.match(
      /^# firmware-settings: zonename=([^\s]+) timezone=([^\s]+) theme=([^\s]+) ntp=([^\s]+) (?:package-mirror|opkg)=([^\s]+)$/m);
    req = {
      device: header[1],
      source: header[2],
      version: header[3],
      branch: header[4] || '',
      variant: header[5],
      tag: 'config',
      plugins: [],
      config: submittedConfig,
      firmware: fwHeader ? {
        zonename: fwHeader[1], timezone: fwHeader[2], theme: fwHeader[3], ntp: fwHeader[4], packageMirror: fwHeader[5],
      } : undefined,
    };
    req.configId = [req.device, req.source, req.version, req.variant].join('/');
    requestMode = picked.type === 'buildinfo' ? 'issue-buildinfo' : 'issue-config';
  }
} else if (requestFile) {
  requestAttachmentName = basename(requestFile);
  let raw;
  try { raw = readFileSync(requestFile); } catch (e) { fail('无法读取 Issue 附件请求文件: ' + e.message); }
  if (raw.length < 32 || raw.length > 2 * 1024 * 1024) fail(`build-request.json 大小非法:${raw.length} bytes(允许 32B~2MB)`);
  try { req = JSON.parse(raw.toString('utf8')); } catch (e) { fail('build-request.json 无法解析: ' + e.message); }
  if (![3, 4, 5].includes(req.schema)) fail(`不支持的 build-request schema:${JSON.stringify(req.schema)}(需要 3、4 或 5)`);
  submittedConfig = req.config;
  requestMode = 'issue-attachment';
} else {
  fail('仅支持网页生成的 build-request.json、.config 或 config.buildinfo Issue 附件');
}

recommendationAudit = normalizeAudit(req.audit);
const catalogContract = req.schema === 5 ? normalizeCatalogContract(req.catalog) : null;

const requestDefconfig = typeof req.use_defconfig === 'boolean' ? req.use_defconfig : null;
const auditDefconfig = req.audit?.defconfig && typeof req.audit.defconfig.enabled === 'boolean'
  ? req.audit.defconfig.enabled : null;
if (requestDefconfig !== null && auditDefconfig !== null && requestDefconfig !== auditDefconfig) {
  fail('defconfig 开关与 audit.defconfig.enabled 不一致');
}
const useDefconfig = requestDefconfig ?? auditDefconfig ?? false;
const isCustomTarget = ['custom-target', 'catalog-target'].includes(req.device);
let device, source, version, variant;
let catalogBranch;
let catalogIndex;
if (isCustomTarget) {
  try {
    catalogIndex = await loadCatalogIndex(catalogContract?.revision || 'catalog-data');
  } catch (error) {
    fail(`无法读取自定义 Target 的固定 Catalog index:${error.message}`);
  }
  const catalogSource = catalogIndex.sources.find((item) => item.id === req.source);
  const requestedBranch = String(req.branch || '');
  catalogBranch = catalogSource?.branches?.find((item) =>
    item.id === String(req.version) &&
    (!requestedBranch || item.branch === requestedBranch));
  if (!catalogSource || !catalogBranch) {
    fail(`自定义 Target 的源码/分支不在 Catalog 允许范围:${req.source}/${req.version}/${requestedBranch || '(未提供)'}`);
  }
  if (catalogBranch.state === 'unavailable') {
    fail(`Catalog 已标记该源码/分支不可用:${catalogSource.id}/${catalogBranch.branch}`);
  }

  version = { id: catalogBranch.id, branch: catalogBranch.branch, label: catalogBranch.branch };
  source = {
    id: catalogSource.id, label: catalogSource.label || catalogSource.id, repo: catalogSource.repo, versions: [version],
    diy1: 'diy-generic.sh', diy2: 'diy2-generic.sh', append: true,
    loginPw: catalogSource.id === 'lede' ? 'password' : undefined,
  };
  variant = { id: String(req.variant || 'custom'), name: String(req.variant || 'Custom Target') };
  if (!/^[A-Za-z0-9._+-]{1,96}$/.test(variant.id)) fail(`自定义 Target Profile 非法:${variant.id}`);
  device = {
    id: req.device, brand: 'Custom Target', name: 'Custom Target',
    plugins: 'seed', sources: [source],
  };
} else {
  device = DEVICES.devices.find((d) => d.id === req.device);
  if (!device) fail(`未知设备: ${JSON.stringify(req.device)}(可选: ${DEVICES.devices.map((d) => d.id).join(' / ')})`);
  source = device.sources.find((s) => s.id === req.source);
  if (!source) fail(`未知源码: ${JSON.stringify(req.source)}(可选: ${device.sources.map((s) => s.id).join(' / ')})`);
  version = source.versions.find((v) => v.id === req.version);
  if (!version) fail(`未知版本: ${JSON.stringify(req.version)}(该源可选: ${source.versions.map((v) => v.id).join(' / ')})`);
  const variants = source.variants.filter((v) => !v.versions || v.versions.includes(version.id));
  variant = variants.find((v) => v.id === req.variant);
  if (!variant) fail(`未知变体: ${req.variant}(该版本可选: ${variants.map((v) => v.id).join(' / ')})`);
}
const configId = [device.id, source.id, version.id, variant.id].join('/');
if (req.configId !== configId) {
  fail(`configId 不匹配:收到 ${JSON.stringify(req.configId)},应为 ${configId}`);
}

let submittedSha256 = '';
{  if (typeof submittedConfig !== 'string') fail('附件缺少完整 config 内容');
  let config = submittedConfig.replace(/\r\n/g, '\n');
  if (config.charCodeAt(0) === 0xFEFF) fail('config 不得带 UTF-8 BOM');
  if (config.includes('\0')) fail('config 含 NUL 二进制字符');
  const configBytes = Buffer.byteLength(config, 'utf8');
  if (configBytes < 64 || configBytes > 1024 * 1024) fail(`config 大小非法:${configBytes} bytes(允许 64B~1MB)`);
  const lines = config.split('\n');
  const badLine = lines.findIndex((line) => line !== '' && !line.startsWith('#') && !/^CONFIG_[A-Za-z0-9_+.-]+=.*$/.test(line));
  if (badLine >= 0) fail(`config 第 ${badLine + 1} 行不是合法 Kconfig/注释格式`);
  const actualTarget = lines.filter((line) =>
    /^CONFIG_TARGET_(?:BOARD|SUBTARGET|PROFILE)=/.test(line) ||
    /^CONFIG_TARGET_.*_DEVICE_.*=y$/.test(line));
  const actualDevices = actualTarget.filter((line) => /^CONFIG_TARGET_.*_DEVICE_.*=y$/.test(line)).sort();
  if (isCustomTarget) {
    if (!actualDevices.length && !actualTarget.some((line) => /^CONFIG_TARGET_BOARD=/.test(line))) {
      fail('自定义配置缺少 CONFIG_TARGET_BOARD 或 CONFIG_TARGET_*_DEVICE_*=y');
    }
    const board = actualTarget.find((line) => /^CONFIG_TARGET_BOARD=/.test(line))?.split('=')[1]?.replaceAll('"', '') || '';
    const subtarget = actualTarget.find((line) => /^CONFIG_TARGET_SUBTARGET=/.test(line))?.split('=')[1]?.replaceAll('"', '') || '';
    const profile = actualTarget.find((line) => /^CONFIG_TARGET_PROFILE=/.test(line))?.split('=')[1]?.replaceAll('"', '') ||
      actualDevices[0]?.match(/_DEVICE_(.+)=y$/)?.[1] || '';
    device.name = [board || 'Target', subtarget, profile].filter(Boolean).join(' / ');
  } else {
    const manifest = CONFIG_MANIFEST.configs[configId];
    if (!manifest) fail(`配置清单不存在该组合:${configId}`);
    const expectedDevices = manifest.target.filter((line) => /^CONFIG_TARGET_.*_DEVICE_.*=y$/.test(line)).sort();
    const targetMatches = actualDevices.length && expectedDevices.length
      ? JSON.stringify(actualDevices) === JSON.stringify(expectedDevices)
      : JSON.stringify([...actualTarget].sort()) === JSON.stringify([...manifest.target].sort());
    if (!targetMatches) {
      fail(`上传配置的目标设备签名与 ${configId} 不一致,请勿上传其他机型的配置`);
    }
  }
  if (!config.endsWith('\n')) config += '\n';
  submittedSha256 = createHash('sha256').update(config).digest('hex');
  const submittedOut = String(process.env.SUBMITTED_CONFIG_OUT || 'submitted.config');
  writeFileSync(submittedOut, config, 'utf8');
}

let catalogArch = '';
let catalogArchPackages = '';
let catalogProfilePackages = [];
let activeCatalogRevision = '';
let sourceCommit = '';
if (catalogContract) {
  if (!catalogIndex) {
    try {
      catalogIndex = await loadCatalogIndex(catalogContract.revision);
    } catch (error) {
      fail(`无法读取固定 Catalog index:${error.message}`);
    }
  }
  const indexedSource = catalogIndex.sources.find((item) => item.id === source.id);
  const indexedBranch = indexedSource?.branches?.find((item) =>
    item.id === version.id && (!version.branch || item.branch === version.branch));
  if (!indexedSource || !indexedBranch || indexedBranch.state === 'unavailable') {
    fail(`固定 Catalog index 中没有可用源码/分支:${source.id}/${version.branch}`);
  }
  const indexedLegacy = legacyCatalogContract(indexedBranch);
  if (!indexedLegacy || indexedLegacy.asset !== catalogContract.asset ||
      indexedLegacy.hash !== catalogContract.compressedSha256 ||
      indexedLegacy.bytes !== catalogContract.compressedBytes ||
      indexedLegacy.catalogSchema !== catalogContract.catalogSchema ||
      indexedLegacy.relationsSchema !== catalogContract.relationsSchema) {
    fail('固定 Catalog index 与请求的 legacy 契约不一致');
  }
  if (String(indexedSource.repo || '') !== String(source.repo || '') ||
      catalogContract.sourceRepository !== String(source.repo || '')) {
    fail(`Catalog 上游仓库不匹配:request=${source.repo},contract=${catalogContract.sourceRepository}`);
  }
  const indexedCommit = String(indexedBranch.commit || indexedBranch.sourceCommit || '').toLowerCase();
  if (indexedCommit && indexedCommit !== catalogContract.sourceCommit) {
    fail(`Catalog sourceCommit 与固定 index 不一致:index=${indexedCommit},request=${catalogContract.sourceCommit}`);
  }
  sourceCommit = catalogContract.sourceCommit;
  activeCatalogRevision = catalogContract.revision;
}

if (isCustomTarget) {
  const contract = req.customTarget && typeof req.customTarget === 'object' ? req.customTarget : null;
  if (!contract) fail('自定义 Target 请求缺少 customTarget 身份契约');
  const actualBoard = configStringValue(submittedConfig, 'TARGET_BOARD');
  const actualSubtarget = configStringValue(submittedConfig, 'TARGET_SUBTARGET');
  const actualProfile = configStringValue(submittedConfig, 'TARGET_PROFILE');
  const actualDeviceSymbols = [...submittedConfig.matchAll(
    /^CONFIG_(TARGET_[A-Za-z0-9_.+-]+_DEVICE_[A-Za-z0-9_.+-]+)=y$/gm,
  )].map((match) => match[1]);
  const expectedBoard = String(contract.system || '');
  const expectedSubtarget = String(contract.subtarget || '');
  const expectedProfile = String(contract.profileSymbol || (contract.profile ? `DEVICE_${contract.profile}` : ''));
  const expectedSelector = String(contract.profileSelector || '');
  if (!expectedBoard || !expectedSubtarget || !expectedProfile || !expectedSelector) {
    fail('customTarget 缺少 system/subtarget/profile/profileSelector');
  }
  if (actualBoard !== expectedBoard || actualSubtarget !== expectedSubtarget ||
      (actualProfile && actualProfile !== expectedProfile) ||
      actualDeviceSymbols.length !== 1 || actualDeviceSymbols[0] !== expectedSelector) {
    fail(`Target/Profile 身份不一致:config=${actualBoard}/${actualSubtarget}/${actualProfile || actualDeviceSymbols[0] || '(missing)'},` +
      ` request=${expectedBoard}/${expectedSubtarget}/${expectedProfile}`);
  }
  catalogArch = String(contract.arch || '');
  catalogArchPackages = String(contract.archPackages || '');
  catalogProfilePackages = Array.isArray(contract.profilePackagesAdd)
    ? [...new Set(contract.profilePackagesAdd.map(String))] : [];
}

// 种子机型共用 seed 表 / seed devices share the seed plugin table
const PLUGINS = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', device.plugins === 'seed' ? 'seed' : device.id, 'plugins.json'), 'utf8'));
if (!Array.isArray(req.plugins)) fail('plugins 必须是数组');
if (req.plugins.length > 120) fail('插件数量超过 120,拒绝');

const items = [];
let advanced = 0;
for (const raw of req.plugins) {
  if (typeof raw !== 'string' || !/^[+-]?[a-z0-9._-]{1,64}$/i.test(raw)) fail(`非法插件项: ${JSON.stringify(raw)}`);
  const id = /^[+-]/.test(raw) ? raw.slice(1) : raw;
  if (!PLUGINS.plugins.some((p) => p.id === id)) fail(`插件不在白名单: ${id}`);
  if (/^[+-]/.test(raw)) advanced++;
  if (!items.includes(raw)) items.push(raw);
}

// tag 只保留中英文、数字、下划线和连字符,用于 artifact 命名与展示,防注入 / tag keeps only CJK, word chars and hyphens — used in artifact names and display, keeps it injection-safe
const tag = String(req.tag || '').replace(/[^\w一-龥-]/g, '').slice(0, 24) || 'anonymous';
const cleanIdentity = (value) =>
  String(value || '').replace(/[^\w一-龥-]/g, '').slice(0, 24);
const titleIdentity = parseBuildIssueTitleIdentity(process.env.ISSUE_TITLE || '');
const attachmentRef = requestAttachmentName.match(/^([A-Za-z0-9]+_[A-Za-z0-9]+)[.-]/)?.[1] || '';
const requestedSourceEnv = String(req.sourceEnv || '').trim();
const normalizedSourceEnv = normalizeBuildEnvironment(requestedSourceEnv);
if (requestedSourceEnv && !normalizedSourceEnv) fail(`非法 sourceEnv: ${requestedSourceEnv}`);
const sourceEnvIdentity = buildEnvironmentIdentity(normalizedSourceEnv);
if (titleIdentity.sourceEnv && sourceEnvIdentity && titleIdentity.sourceEnv !== sourceEnvIdentity) {
  fail(`sourceEnv 与 Issue 标题不一致: request=${sourceEnvIdentity}, title=${titleIdentity.sourceEnv}`);
}
if (titleIdentity.sourceEnv && !normalizedSourceEnv) {
  fail('非 main Issue 标题必须由 build-request.json 提供 sourceEnv');
}
const sourceEnv = normalizedSourceEnv;
const requestCommitInput = String(req.requestCommit || '').trim();
const requestCommit = /^[a-f0-9]{7,64}$/i.test(requestCommitInput) ? requestCommitInput.toLowerCase() : '';
if (requestCommitInput && !requestCommit) fail(`非法 requestCommit: ${requestCommitInput}`);
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
  fail(`requestCommit 与实际 Worker 提交不一致: request=${requestCommit || '(missing)'}, worker=${expectedRequestCommit}`);
}
const requestRef = cleanIdentity(req.requestId || attachmentRef || titleIdentity.requestId);
const buildRef = requestRef ? `${requestRef}-${tag}` : tag;
const artifactRef = artifactBuildRef(buildRef, sourceEnv);

// 后台登录地址:仅内网 IPv4,非法即回落默认,防注入 / admin LAN IP: private IPv4 only, falls back to default — injection-safe
const lanip = /^(192\.168|10\.\d{1,3}|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}$/.test(String(req.lanip || ''))
  ? String(req.lanip) : '192.168.1.1';

// 初始密码:严格白名单字符集防 shell 注入;@empty=清空;空=各源默认 / initial password: strict charset (shell-injection-safe); @empty blanks it; empty = source default
const rp = String(req.rootpw || '');
const rootpw = (rp === '@empty' || /^[A-Za-z0-9@#%^&*_+=.,:!?-]{4,32}$/.test(rp)) ? rp : '';

// 固件运行参数:只允许前端列出的预设,不得把任意字符串传给 Shell / firmware runtime settings use closed presets only
const fw = req.firmware && typeof req.firmware === 'object' ? req.firmware : {};
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
const theme = String(fw.theme || (['OpenWrt', 'lede'].includes(source.id) ? 'luci-theme-bootstrap' : 'luci-theme-argon'));
if (!/^luci-theme-[A-Za-z0-9._+-]{1,48}$/.test(theme)) fail('固件主题格式非法');
const packageTable = join(ROOT, 'site', 'wrt', 'data', device.id, 'packages.json');
if (existsSync(packageTable)) {
  const table = JSON.parse(readFileSync(packageTable, 'utf8'));
  if (!table.pkgs[theme] || !Object.hasOwn(table.pkgs[theme], source.id)) fail(`固件主题不在 ${device.id}/${source.id} 软件包白名单:${theme}`);
}

const firmwareHeader = submittedConfig.match(
  /^# firmware-settings: zonename=([^\s]+) timezone=([^\s]+) theme=([^\s]+) ntp=([^\s]+) (?:package-mirror|opkg)=([^\s]+)$/m);
const hasFirmwareSnapshot = Boolean(req.firmware || firmwareHeader);
if (firmwareHeader) {
  const actual = [firmwareHeader[1], firmwareHeader[2], firmwareHeader[3], firmwareHeader[4], firmwareHeader[5]];
  const expected = [zonename, timezone, theme, ntpId, packageMirrorId];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`固件设置快照不一致:config=${actual.join(' / ')},request=${expected.join(' / ')}`);
  }
}
let pageVersion = String(req.pageVersion || '');
if (!pageVersion && typeof submittedConfig === 'string') {
  const match = submittedConfig.match(/^# page-version=(v\d{8}(?:\d{2})?)$/m);
  if (match) pageVersion = match[1];
}
if (!/^v\d{8}(?:\d{2})?$/.test(pageVersion)) pageVersion = 'unknown';

// 开发者模式原始软件包:逐个对照该机型 packages.json 白名单;种子机型不支持 / raw packages: whitelisted against the device's packages.json; not available on seed devices
let packages = [];
const rawPkgs = Array.isArray(req.packages) ? req.packages : [];
if (rawPkgs.length) {
  if (device.plugins === 'seed') fail('种子机型不支持原始软件包定制');
  if (rawPkgs.length > 200) fail('原始软件包数量超过 200,拒绝');
  const PKGTBL = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', device.id, 'packages.json'), 'utf8'));
  for (const raw of rawPkgs) {
    if (typeof raw !== 'string' || !/^-?[A-Za-z0-9._+-]{1,64}$/.test(raw)) fail(`非法软件包项: ${JSON.stringify(raw)}`);
    const name = raw.startsWith('-') ? raw.slice(1) : raw;
    if (!PKGTBL.pkgs[name]) fail(`软件包不在白名单: ${name}`);
    if (!packages.includes(raw)) packages.push(raw);
  }
}

const out = [
  `device=${device.id}`,
  `source=${source.id}`,
  `version=${version.id}`,
  `branch=${version.branch}`,
  `repo=${source.repo}`,
  `source_commit=${sourceCommit}`,
  `catalog_revision=${activeCatalogRevision}`,
  `catalog_asset=${catalogContract?.asset || ''}`,
  `catalog_hash=${catalogContract?.compressedSha256 || ''}`,
  `catalog_bytes=${catalogContract?.compressedBytes || ''}`,
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
  `recommended_enabled=${recommendationAudit.recommended.enabled ? 1 : 0}`,
  `packages=${packages.join(' ')}`,
  `catalog_arch=${catalogArch}`,
  `catalog_arch_packages=${catalogArchPackages}`,
  `catalog_profile_packages=${catalogProfilePackages.join(' ')}`,
  `request_mode=${requestMode}`,
  `config_id=${configId}`,
  `submitted_sha256=${submittedSha256}`,
  `summary=${tag} · ${device.name} · ${source.label} ${version.label} · ${variant.name} · ${items.length} 个插件 · ${pageVersion}` +
    (advanced ? `(含 ${advanced} 项高级模式操作)` : ''),
];
const auditOut = String(process.env.RECOMMENDED_AUDIT_OUT || 'recommended-audit.json');
writeFileSync(auditOut, JSON.stringify(recommendationAudit) + '\n', 'utf8');
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, out.join('\n') + '\n');
// rootpw is intentionally retained only in GITHUB_OUTPUT for the workflow;
// never echo it into the public Actions log.
console.log(out.filter((line) => !line.startsWith('rootpw=')).join('\n'));
