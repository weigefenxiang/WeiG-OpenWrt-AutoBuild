#!/usr/bin/env node
// 解析构建请求并做白名单校验,输出 GitHub Actions outputs / Parses a build request, validates against the whitelist, emits GitHub Actions outputs.
// 三种来源均通过环境变量传入,避免命令行注入 / Request inputs arrive via env vars to avoid command-line injection:
//   - Issue 附件:REQUEST_FILE 指向网页生成的 build-request.json(权威完整 config)
//   - 旧 Issue:ISSUE_BODY 里含 ```json 载荷(仅兼容历史请求)
//   - dispatch:IN_DEVICE / IN_SOURCE / IN_VERSION / IN_VARIANT / IN_PLUGINS / IN_TAG(内部 smoke/admin 兼容)
// 插件项高级模式前缀:+id 强制开启该源没有的包,-id 取消该源内置项 / advanced plugin prefixes: +id force-enables a pkg the source lacks, -id drops a builtin.
// 校验失败以非零码退出,workflow 据此回评并终止 / Any validation failure exits non-zero so the workflow can comment back and abort.

import { readFileSync, appendFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEVICES = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'devices.json'), 'utf8'));
const CONFIG_MANIFEST = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'config-manifest.json'), 'utf8'));
const PROJECT = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'project.json'), 'utf8'));
const LOCAL_CATALOG_INDEX = JSON.parse(
  readFileSync(join(ROOT, 'site', 'wrt', 'data', 'menuconfig-index.json'), 'utf8'));

function fail(msg) { console.error('校验失败: ' + msg); process.exit(1); }
async function loadCatalogIndex() {
  const repo = PROJECT.catalogRepository || LOCAL_CATALOG_INDEX.catalogRepo;
  const urls = [
    `https://raw.githubusercontent.com/${repo}/catalog-data/index.json`,
    `https://cdn.jsdelivr.net/gh/${repo}@catalog-data/index.json`,
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const index = await response.json();
      if (Number(index?.schema || 0) >= 2 && Array.isArray(index.sources)) return index;
    } catch (error) {
      console.warn(`Catalog index fallback / 目录索引回退: ${url}: ${error.message}`);
    }
  }
  return LOCAL_CATALOG_INDEX;
}

let req;
let requestMode = 'dispatch-legacy';
let submittedConfig = '';
let requestAttachmentName = '';
const requestManifest = String(process.env.REQUEST_MANIFEST || '').trim();
const requestFile = String(process.env.REQUEST_FILE || '').trim();
const issueBody = String(process.env.ISSUE_BODY || '');
if (requestManifest) {
  let manifest;
  try { manifest = JSON.parse(readFileSync(requestManifest, 'utf8')); } catch (e) { fail('附件清单无法解析: ' + e.message); }
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.files) || !manifest.files.length) fail('附件清单格式非法');
  const jsonFiles = manifest.files.filter((f) => f.type === 'json');
  if (jsonFiles.length) {
    if (manifest.files.length !== 1) fail('build-request.json 必须单独上传,不要与 .config/config.buildinfo 混用');
    requestAttachmentName = jsonFiles[0].name || '';
    try { req = JSON.parse(readFileSync(jsonFiles[0].path, 'utf8')); } catch (e) { fail('build-request.json 无法解析: ' + e.message); }
    if (![3, 4].includes(req.schema)) fail(`不支持的 build-request schema:${JSON.stringify(req.schema)}(需要 3 或 4)`);
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
      /^# firmware-settings: zonename=([^\s]+) timezone=([^\s]+) theme=([^\s]+) ntp=([^\s]+) opkg=([^\s]+)$/m);
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
        zonename: fwHeader[1], timezone: fwHeader[2], theme: fwHeader[3], ntp: fwHeader[4], opkg: fwHeader[5],
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
  if (![3, 4].includes(req.schema)) fail(`不支持的 build-request schema:${JSON.stringify(req.schema)}(需要 3 或 4)`);
  submittedConfig = req.config;
  requestMode = 'issue-attachment';
} else if (process.env.ISSUE_BODY) {
  const m = process.env.ISSUE_BODY.match(/```json\s*([\s\S]*?)```/);
  if (!m) fail('issue 正文里找不到 ```json 载荷(请从定制页面提交,不要手改)');
  try { req = JSON.parse(m[1]); } catch (e) { fail('JSON 载荷无法解析: ' + e.message); }
  requestMode = 'issue-inline-legacy';
} else {
  req = {
    device: process.env.IN_DEVICE,
    source: process.env.IN_SOURCE,
    version: process.env.IN_VERSION,
    variant: process.env.IN_VARIANT,
    plugins: (process.env.IN_PLUGINS || '').split(/\s+/).filter(Boolean),
    tag: process.env.IN_TAG,
  };
}

const hasSubmittedConfig = requestMode.startsWith('issue-') && !requestMode.includes('inline');
const isCustomTarget = ['custom-target', 'catalog-target'].includes(req.device);
let device, source, version, variant;
if (isCustomTarget) {
  if (!hasSubmittedConfig) fail('自定义 Target 必须通过 Issue 附件提交完整 .config');
  const catalogIndex = await loadCatalogIndex();
  const catalogSource = catalogIndex.sources.find((item) => item.id === req.source);
  const requestedBranch = String(req.branch || '');
  const catalogBranch = catalogSource?.branches?.find((item) =>
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
if (hasSubmittedConfig && req.configId !== configId) {
  fail(`configId 不匹配:收到 ${JSON.stringify(req.configId)},应为 ${configId}`);
}

let submittedSha256 = '';
if (hasSubmittedConfig) {
  if (typeof submittedConfig !== 'string') fail('附件缺少完整 config 内容');
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
const issueTitleRef = String(process.env.ISSUE_TITLE || '')
  .match(/^\[build\]\s+([^\s·]+)(?:\s+·|\s*$)/)?.[1] || '';
const attachmentRef = requestAttachmentName.match(/^([A-Za-z0-9]+_[A-Za-z0-9]+)[.-]/)?.[1] || '';
const buildRef = cleanIdentity(req.requestId || attachmentRef || issueTitleRef || tag) || tag;
const artifactTail = buildRef === tag ? device.id : `${tag}-${device.id}`;

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
const OPKG = {
  auto: '@default', pku: 'mirrors.pku.edu.cn/immortalwrt',
  tuna: 'mirrors.tuna.tsinghua.edu.cn/openwrt', official: 'downloads.openwrt.org',
};
const selectedZone = TIMEZONES.find((zone) => zone.zonename === fw.zonename) ||
  TIMEZONES.find((zone) => zone.zonename === fw.timezone) ||
  TIMEZONES.find((zone) => zone.timezone === fw.timezone) ||
  TIMEZONES.find((zone) => zone.zonename === 'Asia/Shanghai');
const zonename = selectedZone.zonename;
const timezone = selectedZone.timezone;
const ntpId = Object.hasOwn(NTP, fw.ntp) ? fw.ntp : 'cn';
const opkgId = Object.hasOwn(OPKG, fw.opkg) ? fw.opkg : 'auto';
const opkgAllowed = source.id === 'OpenWrt' ? ['auto', 'official', 'tuna']
  : source.id === 'lede' ? ['auto'] : ['auto', 'pku'];
if (!opkgAllowed.includes(opkgId)) fail(`${source.id} 不接受所选 opkg 镜像预设:${opkgId}`);
const theme = String(fw.theme || (['OpenWrt', 'lede'].includes(source.id) ? 'luci-theme-bootstrap' : 'luci-theme-argon'));
if (!/^luci-theme-[A-Za-z0-9._+-]{1,48}$/.test(theme)) fail('固件主题格式非法');
const packageTable = join(ROOT, 'site', 'wrt', 'data', device.id, 'packages.json');
if (existsSync(packageTable)) {
  const table = JSON.parse(readFileSync(packageTable, 'utf8'));
  if (!table.pkgs[theme] || !Object.hasOwn(table.pkgs[theme], source.id)) fail(`固件主题不在 ${device.id}/${source.id} 软件包白名单:${theme}`);
} else if (!['luci-theme-bootstrap', 'luci-theme-openwrt-2020', 'luci-theme-argon'].includes(theme)) {
  fail(`种子机型仅允许基础主题:${theme}`);
}
const firmwareHeader = submittedConfig.match(
  /^# firmware-settings: zonename=([^\s]+) timezone=([^\s]+) theme=([^\s]+) ntp=([^\s]+) opkg=([^\s]+)$/m);
const hasFirmwareSnapshot = Boolean(req.firmware || firmwareHeader);
if (firmwareHeader) {
  const actual = [firmwareHeader[1], firmwareHeader[2], firmwareHeader[3], firmwareHeader[4], firmwareHeader[5]];
  const expected = [zonename, timezone, theme, ntpId, opkgId];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`固件设置快照不一致:config=${actual.join(' / ')},request=${expected.join(' / ')}`);
  }
}
if (hasFirmwareSnapshot && !submittedConfig.split(/\r?\n/).includes(`CONFIG_PACKAGE_${theme}=y`)) {
  fail(`提交配置没有启用所选固件主题:${theme}`);
}
let pageVersion = String(req.pageVersion || '');
if (!pageVersion && typeof submittedConfig === 'string') {
  const match = submittedConfig.match(/^# page-version=(v\d{8}(?:\d{2})?)$/m);
  if (match) pageVersion = match[1];
}
if (!/^v\d{8}(?:\d{2})?$/.test(pageVersion)) pageVersion = 'unknown';

// 开发者模式原始软件包:逐个对照该机型 packages.json 白名单;种子机型不支持 / raw packages: whitelisted against the device's packages.json; not available on seed devices
let packages = [];
const rawPkgs = Array.isArray(req.packages) ? req.packages
  : (process.env.IN_PACKAGES || '').split(/\s+/).filter(Boolean);
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
  `brand=${device.brand}`,
  `source=${source.id}`,
  `version=${version.id}`,
  `branch=${version.branch}`,
  `repo=${source.repo}`,
  `diy1=${source.diy1}`,
  `diy2=${source.diy2}`,
  `variant=${variant.id}`,
  `plugins=${items.join(' ')}`,
  `tag=${tag}`,
  `build_ref=${buildRef}`,
  `artifact_tail=${artifactTail}`,
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
  `opkg_id=${opkgId}`,
  `opkg_mirror=${OPKG[opkgId]}`,
  `firmware_snapshot=${hasFirmwareSnapshot ? 1 : 0}`,
  `packages=${packages.join(' ')}`,
  `advanced=${advanced}`,
  `custom_target=${isCustomTarget ? 1 : 0}`,
  `request_mode=${requestMode}`,
  `authoritative_config=${hasSubmittedConfig ? 1 : 0}`,
  `config_id=${configId}`,
  `submitted_sha256=${submittedSha256}`,
  `summary=${tag} · ${device.name} · ${source.label} ${version.label} · ${variant.name} · ${items.length} 个插件 · ${pageVersion}` +
    (advanced ? `(含 ${advanced} 项高级模式操作)` : ''),
];
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, out.join('\n') + '\n');
console.log(out.join('\n'));
