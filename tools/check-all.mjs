#!/usr/bin/env node
// 一键体检:语法检查所有脚本 + 校验所有数据 JSON + 前端三件套基本一致性
// One-click health check: syntax-check every script, validate every data JSON, basic frontend consistency.
// 用法 / Usage: node tools/check-all.mjs   (或双击 Check_检查.bat / or double-click the bat)

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findCatalogPackageConflicts,
  findPackageInfoConflicts,
  formatPackageConflicts,
} from './verify-package-conflicts.mjs';
import { applyConfigResolution, configSymbolValues, matchingConfigRules } from './config-rules.mjs';
import {
  applyBuildRequirements,
  missingBuildRequirements,
  sourceBuildRequirements,
} from './source-build-requirements.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let fail = 0;
const ok = (name) => console.log('  ✓ ' + name);
const bad = (name, msg) => { console.log('  ✗ ' + name + ' — ' + msg); fail++; };
const walkFiles = (dir, suffix, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, suffix, out);
    else if (entry.isFile() && entry.name.endsWith(suffix)) out.push(path);
  }
  return out;
};
const PROXY_PACKAGE_RE = /^CONFIG_PACKAGE_.*(?:passwall|ssr|vssr|tinyproxy|shadowsocks|v2ray|xray|trojan|brook|gost|haproxy|pdnsd-alt|kcptun|simple-obfs|chinadns|dns2socks|dns2tcp|ipt2socks|microsocks|naiveproxy|redsocks|openclash|homeproxy|sing-box|tuic|hysteria|polipo|squid|ssocks|speederv2|udp2raw|tor).*=[ym]$/i;

console.log('[1/3] JS 语法检查 / syntax check (node --check)');
const scripts = [join(ROOT, 'site', 'wrt', 'app.js'),
  ...readdirSync(join(ROOT, 'tools')).filter((f) => f.endsWith('.mjs')).map((f) => join(ROOT, 'tools', f))];
for (const f of scripts) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  r.status === 0 ? ok(f.replace(ROOT, '.')) : bad(f.replace(ROOT, '.'), (r.stderr || '').split('\n')[0]);
}

console.log('[2/3] 数据 JSON 校验 / data JSON validation');
for (const f of ['site/wrt/data/devices.json', 'site/wrt/data/i18n.json', 'site/wrt/data/360t7/plugins.json',
  'site/wrt/data/seed/plugins.json', 'site/wrt/data/config-manifest.json',
  'site/wrt/data/timezones.json', 'site/wrt/data/plugins-i18n.json',
  'site/wrt/data/menuconfig-index.json', 'site/wrt/data/menuconfig-demo.json',
  'site/wrt/data/project.json', 'site/wrt/data/minimum-boot.json',
  'site/wrt/data/package-mirrors.json', 'site/wrt/data/config-rules.json',
  'site/wrt/data/source-build-requirements.json',
  'config/001.presets/minimum-boot.json', 'config/001.presets/config-rules.json',
  'config/001.presets/source-build-requirements.json',
  'tools/plugins-meta.json', 'tools/plugin-sizes.json', 'tools/i18n-source.json',
  'tools/i18n-translations.json', 'tools/plugins-i18n.json', 'tools/device-catalog.json',
  'tools/package-baseline-360t7.json']) {
  try { JSON.parse(readFileSync(join(ROOT, f), 'utf8')); ok(f); }
  catch (e) { bad(f, e.message.slice(0, 80)); }
}

console.log('[3/3] 一致性抽查 / consistency spot checks');
try {
  const conflictConfig = 'CONFIG_PACKAGE_tls-alpha=y\nCONFIG_PACKAGE_tls-beta=y\nCONFIG_PACKAGE_tls-module=m\n';
  const packageInfoFixture = [
    'Package: tls-alpha',
    'Conflicts: tls-beta tls-module',
    '',
    'Package: tls-beta',
  ].join('\n');
  const catalogFixture = {
    menu: {
      options: [{ symbol: 'PACKAGE_tls-alpha', conflicts: ['PACKAGE_tls-beta', 'PACKAGE_tls-module'] }],
    },
  };
  const directConflicts = findPackageInfoConflicts(conflictConfig, packageInfoFixture);
  const catalogConflicts = findCatalogPackageConflicts(conflictConfig, catalogFixture);
  formatPackageConflicts(directConflicts) === 'tls-alpha <-> tls-beta' &&
    formatPackageConflicts(catalogConflicts) === 'tls-alpha <-> tls-beta'
    ? ok('package conflict parser: upstream and Catalog reject y/y pairs but allow module selections')
    : bad('package conflict parser', 'unexpected conflict result');
  const configRuleFixture = 'CONFIG_DEFAULT_libustream-openssl=y\nCONFIG_PACKAGE_luci-ssl=y\nCONFIG_PACKAGE_libustream-openssl=y\n';
  const configRulesSource = JSON.parse(readFileSync(
    join(ROOT, 'config', '001.presets', 'config-rules.json'), 'utf8'));
  const configRulesPublic = JSON.parse(readFileSync(
    join(ROOT, 'site', 'wrt', 'data', 'config-rules.json'), 'utf8'));
  const tlsRule = configRulesSource.rules?.find((rule) => rule.id === 'lede-tls-backend');
  const tlsChoices = tlsRule?.resolutions || [];
  const ksmbdRule = configRulesSource.rules?.find((rule) => rule.id === 'lede-linux-6.12-ksmbd');
  const ksmbdFixture = [
    'CONFIG_LINUX_6_12=y',
    'CONFIG_PACKAGE_kmod-fs-ksmbd=m',
    'CONFIG_PACKAGE_luci-i18n-ksmbd-zh-cn=y',
    'CONFIG_KSMBD_SMB_INSECURE_SERVER=y',
  ].join('\n');
  const ksmbdResolution = ksmbdRule?.resolutions?.find((item) => item.id === 'disable-ksmbd');
  const repairedKsmbd = applyConfigResolution(ksmbdFixture, ksmbdResolution);
  const repairedKsmbdValues = configSymbolValues(repairedKsmbd);
  JSON.stringify(configRulesSource) === JSON.stringify(configRulesPublic) &&
    matchingConfigRules(configRuleFixture, { sourceId: 'lede', branch: 'master' }).length === 1 &&
    matchingConfigRules(configRuleFixture, { sourceId: 'OpenWrt', branch: 'main' }).length === 0 &&
    tlsChoices.some((item) => item.id === 'openssl' && item.recommended &&
      item.set?.['PACKAGE_luci-ssl'] === 'n' && item.set?.['PACKAGE_luci-ssl-openssl'] === 'y') &&
    tlsChoices.some((item) => item.id === 'mbedtls' &&
      item.set?.['PACKAGE_libustream-openssl'] === 'n' && item.set?.['PACKAGE_libustream-mbedtls'] === 'y') &&
    matchingConfigRules(ksmbdFixture, { sourceId: 'lede', branch: 'master' })[0]?.id === ksmbdRule?.id &&
    matchingConfigRules(ksmbdFixture, { sourceId: 'lede', branch: 'openwrt-24.10' }).length === 0 &&
    ksmbdRule?.prompt === 'always' &&
    ksmbdRule?.maintenance?.observedPackage === 'ksmbd 3.5.4' &&
    /^https:\/\/github\.com\/.+\/actions\/runs\/\d+$/.test(ksmbdRule?.maintenance?.evidence || '') &&
    ksmbdResolution?.set?.['PACKAGE_kmod-fs-ksmbd'] === 'n' &&
    ksmbdResolution?.setPrefixes?.['PACKAGE_luci-i18n-ksmbd-'] === 'n' &&
    repairedKsmbdValues.get('PACKAGE_kmod-fs-ksmbd') === 'n' &&
    repairedKsmbdValues.get('PACKAGE_luci-i18n-ksmbd-zh-cn') === 'n' &&
    repairedKsmbdValues.get('KSMBD_SMB_INSECURE_SERVER') === 'n' &&
    !matchingConfigRules(repairedKsmbd, { sourceId: 'lede', branch: 'master' }).length
    ? ok('config rules: TLS choices plus LEDE/Linux 6.12 ksmbd y/m guard are synchronized')
    : bad('config rules', 'public copy, scope/any-state match, prompt, or repair data is invalid');
  const dev = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'devices.json'), 'utf8'));
  const t7 = dev.devices.find((d) => d.id === '360t7');
  const activeSources = new Set(['ImmortalWrt', 'OpenWrt', 'lede']);
  t7 && t7.sources.length === activeSources.size && t7.sources.every((source) => activeSources.has(source.id))
    ? ok(`devices: ${dev.devices.length} 台,360T7 ${t7.sources.length} 条官方/社区产线`)
    : bad('devices.json', '360t7 缺失或现行三条产线不完整');
  const profileMatrixOk = dev.devices.every((device) => device.sources.every((source) =>
    activeSources.has(source.id) && source.versions.every((version) =>
      source.variants.some((variant) =>
        (!variant.versions || variant.versions.includes(version.id)) &&
        Boolean(variant.configs?.[version.id] || variant.config || source.config)))));
  profileMatrixOk
    ? ok('设备矩阵:每个源码/分支至少有一个真实 Profile 与独立 config')
    : bad('device profile matrix', '存在无 Profile、无 config 或非现行源码的分支');
  const x86 = dev.devices.find((device) => device.id === 'x86-64-generic');
  const configManifest = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'config-manifest.json'), 'utf8'));
  const x86Manifest = configManifest.configs['x86-64-generic/OpenWrt/main/generic'];
  const x86TargetOk = x86?.kind === 'target' &&
    x86.target?.system === 'x86' && x86.target?.subtarget === '64' && x86.target?.profile === 'generic' &&
    x86.sources?.[0]?.id === 'OpenWrt' && x86.sources[0].versions?.[0]?.branch === 'main' &&
    x86Manifest?.target?.includes('CONFIG_TARGET_x86_64_DEVICE_generic=y');
  x86TargetOk
    ? ok('通用 Target 首批:x86 / x86_64 / Generic x86/64 数据与配置清单已接通')
    : bad('generic target contract', 'x86 Target 元数据、OpenWrt/main 或配置签名不完整');
  const openWrtBranches = new Set(t7?.sources.find((source) => source.id === 'OpenWrt')?.versions.map((v) => v.branch) || []);
  const branchPolicyOk = openWrtBranches.has('main') && !['lede-17.01', 'pcs-standalone-back', 'master']
    .some((branch) => openWrtBranches.has(branch));
  branchPolicyOk
    ? ok('OpenWrt 分支策略:保留 main,排除 lede-17.01 / pcs-standalone-back / master')
    : bad('OpenWrt branch policy', [...openWrtBranches].join(','));
  const i18n = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'i18n.json'), 'utf8'));
  const keys = Object.keys(i18n.strings);
  const langIds = i18n.languages.map((lang) => lang.id);
  const miss = keys.filter((key) => langIds.some((lang) => !i18n.strings[key][lang]));
  miss.length === 0 && langIds.length === 11
    ? ok(`i18n: ${keys.length} 词条 × 11 语完整`)
    : bad('i18n.json', '11 语缺词条: ' + miss.slice(0, 5).join(','));
  const pluginI18n = JSON.parse(readFileSync(join(ROOT, 'tools', 'plugins-i18n.json'), 'utf8')).plugins;
  const pluginLangs = ['zh-TW', 'en', 'ru', 'es', 'pt', 'ja', 'ko', 'de', 'fr', 'vi'];
  const pluginMissing = Object.entries(pluginI18n).filter(([, row]) =>
    pluginLangs.some((lang) => !row.name?.[lang] || !row.desc?.[lang]));
  Object.keys(pluginI18n).length === 226 && pluginMissing.length === 0
    ? ok('精选插件:226 项名称/用途 × 11 语完整(含独立繁中)')
    : bad('plugins-i18n.json', `条目 ${Object.keys(pluginI18n).length},缺译 ${pluginMissing.length}`);
  const t7PluginRows = JSON.parse(
    readFileSync(join(ROOT, 'site', 'wrt', 'data', '360t7', 'plugins.json'), 'utf8')).plugins;
  const missingPluginFallbacks = t7PluginRows.filter((plugin) =>
    typeof plugin.pkg !== 'string' || plugin.pkg.length === 0);
  missingPluginFallbacks.length === 0
    ? ok('360T7 精选插件均有安全包名兜底')
    : bad('360t7 plugin package fallback', missingPluginFallbacks.map((p) => p.id).join(','));
  const pluginMeta = JSON.parse(readFileSync(join(ROOT, 'tools', 'plugins-meta.json'), 'utf8')).plugins;
  const networkMagicIds = ['ipsec-vpnd', 'openvpn', 'openvpn-server', 'softether', 'softethervpn', 'wireguard'];
  const networkMagicOk = networkMagicIds.every((id) =>
    pluginMeta.find((plugin) => plugin.id === id)?.group === '魔法与加速' &&
    t7PluginRows.find((plugin) => plugin.id === id)?.group === '魔法与加速');
  networkMagicOk
    ? ok('指定 VPN/组网插件已从内网穿透与组网移至魔法与加速')
    : bad('plugin group placement', networkMagicIds.join(','));
  const rawPackageData = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', '360t7', 'packages.json'), 'utf8'));
  const rawPackages = rawPackageData.pkgs;
  const baselinePackageData = JSON.parse(readFileSync(join(ROOT, 'tools', 'package-baseline-360t7.json'), 'utf8'));
  const rawPackageNames = Object.keys(rawPackages);
  const rawPackageSourcesOk = Object.values(rawPackages).every((states) =>
    Object.keys(states).every((source) => activeSources.has(source)));
  rawPackageNames.length >= 4000 && rawPackageSourcesOk &&
    rawPackageData.count === rawPackageNames.length &&
    baselinePackageData.count === Object.keys(baselinePackageData.pkgs).length
    ? ok(`360T7 开发者软件包:${rawPackageNames.length} 项,仅含现行三源状态`)
    : bad('360t7 packages baseline', `条目 ${rawPackageNames.length} 或含非现行源码`);
const timezones = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'timezones.json'), 'utf8')).zones;
  const timezoneNames = new Set(timezones.map((zone) => zone.zonename));
  const timezoneOk = timezones.length >= 400 && timezoneNames.size === timezones.length &&
    timezones.some((zone) => zone.zonename === 'Asia/Shanghai' && zone.timezone === 'CST-8') &&
    timezones.every((zone) => /^[A-Za-z0-9_+./-]+$/.test(zone.zonename) && !/[\r\n']/.test(zone.timezone));
  timezoneOk
    ? ok(`时区:${timezones.length} 个 OpenWrt/LuCI IANA 映射,zonename/timezone 白名单完整`)
  : bad('timezones.json', '条目数量、唯一性、安全字符或 Asia/Shanghai 映射异常');
const minimumBootSource = JSON.parse(readFileSync(
  join(ROOT, 'config', '001.presets', 'minimum-boot.json'), 'utf8'));
const minimumBootPublic = JSON.parse(readFileSync(
  join(ROOT, 'site', 'wrt', 'data', 'minimum-boot.json'), 'utf8'));
const packageMirrors = JSON.parse(readFileSync(
  join(ROOT, 'site', 'wrt', 'data', 'package-mirrors.json'), 'utf8'));
const minimumItems = [...(minimumBootSource.items || []),
  ...(minimumBootSource.firewallBackend?.candidates || [])];
const minimumSymbols = minimumItems.map((item) => item.symbol);
const minimumIds = minimumItems.map((item) => item.id);
const recommendedOpkg = (minimumBootSource.items || []).find((item) => item.id === 'opkg');
JSON.stringify(minimumBootSource) === JSON.stringify(minimumBootPublic) &&
  minimumItems.length >= 3 && new Set(minimumIds).size === minimumIds.length &&
  new Set(minimumSymbols).size === minimumSymbols.length &&
  minimumSymbols.includes('PACKAGE_opkg') && !minimumSymbols.includes('PACKAGE_luci-app-opkg') &&
  recommendedOpkg?.symbol === 'PACKAGE_opkg' && recommendedOpkg.catalogPath === 'Base system' &&
  minimumSymbols.includes('PACKAGE_firewall4') && minimumSymbols.includes('PACKAGE_firewall')
  ? ok(`推荐项预设:${minimumBootSource.items.length} 个可维护项目 + opkg + firewall4/firewall 强制二选一`)
  : bad('minimum-boot.json', '源文件/网页副本不一致、项目 ID/符号重复、opkg 或防火墙后端缺失');
const mirrorIds = (packageMirrors.presets || []).map((preset) => preset.id);
const mirrorRootsOk = packageMirrors.schema === 1 &&
  ['auto', 'ustc', 'tuna', 'bfsu', 'pku', 'official'].every((id) => mirrorIds.includes(id)) &&
  new Set(mirrorIds).size === mirrorIds.length &&
  packageMirrors.presets.every((preset) => preset.id === 'auto' ||
    Object.values(preset.roots || {}).every((root) => /^[A-Za-z0-9.-]+(?:\/[A-Za-z0-9._/-]+)?$/.test(root)));
mirrorRootsOk
  ? ok('软件源镜像:网页与 Actions 共用白名单，按源码过滤并在构建时校验分支路径')
  : bad('package-mirrors.json', '镜像 ID、根路径或来源映射不符合安全格式');
  const html = readFileSync(join(ROOT, 'site', 'wrt', 'index.html'), 'utf8');
  const js = readFileSync(join(ROOT, 'site', 'wrt', 'app.js'), 'utf8');
  const sensitiveMaskContract = js.includes("'wireguard'") && js.includes("'tor'") &&
    js.includes("/^wireguard$/i.test(w)") && js.includes("w.slice(0, 3) + '***' + w.slice(-3)");
  sensitiveMaskContract
    ? ok('中文界面 WireGuard→Wir***ard、Tor→T*r 敏感词打码已接通')
    : bad('sensitive mask', 'WireGuard 或 Tor 的中文界面打码规则缺失');
  const css = readFileSync(join(ROOT, 'site', 'wrt', 'app.css'), 'utf8');
  const buildWorkflow = readFileSync(join(ROOT, '.github', 'workflows', 'custom-build.yml'), 'utf8');
  const smokeWorkflow = readFileSync(join(ROOT, '.github', 'workflows', 'smoke-all.yml'), 'utf8');
  const syncWorkflow = readFileSync(join(ROOT, '.github', 'workflows', 'sync-upstream.yml'), 'utf8');
  const driftSentinel = readFileSync(join(ROOT, 'tools', 'check-drift.mjs'), 'utf8');
  const parser = readFileSync(join(ROOT, 'tools', 'parse-request.mjs'), 'utf8');
  const requirementsPublic = JSON.parse(readFileSync(
    join(ROOT, 'site', 'wrt', 'data', 'source-build-requirements.json'), 'utf8'));
  const requirementContext = {
    sourceId: 'lede',
    branch: 'master',
    system: 'x86',
    subtarget: 'legacy',
    profile: 'DEVICE_generic',
  };
  const requirementFixture = 'CONFIG_TARGET_x86=y\nCONFIG_TARGET_BOARD="x86"\n';
  const missingRequirements = missingBuildRequirements(requirementFixture, requirementContext);
  const requirementResolved = applyBuildRequirements(requirementFixture, missingRequirements);
  const requirementIds = sourceBuildRequirements.requirements?.map((row) => row.id) || [];
  const sourceRequirementsOk = sourceBuildRequirements.schema === 1 &&
    JSON.stringify(sourceBuildRequirements) === JSON.stringify(requirementsPublic) &&
    requirementIds.length > 0 && new Set(requirementIds).size === requirementIds.length &&
    sourceBuildRequirements.requirements.every((row) => Array.isArray(row.options) && row.options.length > 0 &&
      row.options.every((option) => /^[A-Z0-9_]+$/.test(option.symbol) && ['n', 'm', 'y'].includes(option.value))) &&
    missingRequirements.some((row) => row.missingOptions.some((option) => option.symbol === 'HAVE_DOT_CONFIG')) &&
    missingBuildRequirements(requirementResolved, requirementContext).length === 0 &&
    js.includes("loadJson('source-build-requirements.json')") &&
    js.includes('enforceBuildRequirements: true') &&
    js.includes('openBuildRequirementResolver') &&
    parser.includes('missingBuildRequirements(config, configRuleContext)') &&
    !buildWorkflow.includes('make defconfig');
  sourceRequirementsOk
    ? ok('source build requirements: one JSON, explicit web acceptance, and Issue rejection are connected')
    : bad('source build requirements', 'JSON schema/copy, web resolver, parser guard, or no-defconfig contract is invalid');
  const project = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'project.json'), 'utf8'));
  const catalogIndex = JSON.parse(
    readFileSync(join(ROOT, 'site', 'wrt', 'data', 'menuconfig-index.json'), 'utf8'));
  const assetHash = (name) => createHash('sha256')
    .update(readFileSync(join(ROOT, 'site', 'wrt', name), 'utf8').replace(/\r\n/g, '\n'))
    .digest('hex').slice(0, 10);
  const assetVersionOk = html.includes(`app.css?v=${assetHash('app.css')}`) &&
    html.includes(`app.js?v=${assetHash('app.js')}`);
  assetVersionOk
    ? ok('前端 CSS/JS 查询版本与文件内容指纹一致')
    : bad('frontend asset cache bust', 'index.html 的 app.css/app.js 查询版本未按内容指纹更新');
  const recommendedUiContract = html.includes('id="minimumBootToggle"') &&
    html.includes('id="minimumBootConfig"') && !html.includes('id="minimumBootPanel"') &&
    js.includes("uiText('推荐项', '推薦項', 'Recommended')") &&
    js.includes('function openMinimumBootModal()') && js.includes('function renderMenuOption(option, showPath = false)') &&
    js.includes('function catalogSelectLock(option)') && js.includes('function catalogSelectLockValue(option, lockedBy)') &&
    js.includes(".filter((stateValue) => stateValue === 'n' || kconfigLevel(stateValue) <= maxLevel)") &&
    js.includes("'# recommended: '");
  recommendedUiContract
    ? ok('推荐项:英文源文案、可关闭配置弹窗与 Catalog 状态复用已接通')
    : bad('recommended UI', '推荐项命名、弹窗或 Catalog N/M/Y/锁定状态复用缺失');
  const submitLayoutContract = html.includes('class="submit-primary-fields"') &&
    html.indexOf('id="lanipBox"') < html.indexOf('id="tagBox"') &&
    css.includes('.submit-primary-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }') &&
    css.includes('.submit-primary-fields { grid-template-columns: 1fr; }');
  submitLayoutContract
    ? ok('提交设置:后台登录地址左侧、构建标识右侧，手机端自动纵向排列')
    : bad('submit settings layout', '后台登录地址/构建标识的桌面或手机布局不符合约定');
  const failureDiagnosticsContract = buildWorkflow.includes('set_config_flag DEVEL') &&
    buildWorkflow.includes('set_config_flag BUILD_LOG') &&
    buildWorkflow.includes("grep -Fx 'CONFIG_BUILD_LOG=y' .config") &&
    buildWorkflow.includes('config_policy=authoritative-no-defconfig') &&
    buildWorkflow.includes('build.config') &&
    !buildWorkflow.includes('make defconfig') &&
    !buildWorkflow.includes('resolved.config') &&
    !buildWorkflow.includes('config-defconfig.diff') &&
    !buildWorkflow.includes('verify-resolved-target.mjs') &&
    buildWorkflow.includes('id: compile') &&
    buildWorkflow.includes('id: diagnose') &&
    buildWorkflow.includes('continue-on-error: true') &&
    buildWorkflow.includes('timeout-minutes: 60') &&
    buildWorkflow.includes("make -j1 V=s") &&
    buildWorkflow.includes('build-diagnostic.log') &&
    buildWorkflow.includes('Finalize compile result') &&
    parser.includes('const configRuleContext = {') && parser.includes('matchingConfigRules(config, configRuleContext)') &&
    js.includes('matchingConfigRules(config)') &&
    js.includes('applyConfigRules(config, rules)') &&
    js.includes('openConfigRuleResolver') && js.includes('generateResolvedConfigText') &&
    !js.includes("window.open('about:blank'") && js.includes('window.location.assign(issueUrl)') &&
    buildWorkflow.includes('实际列出的文件');
  failureDiagnosticsContract
    ? ok('失败诊断:配置规则先处理、Issue 不预开空白页、单线程 V=s 日志与 Artifact 已接通')
    : bad('failure diagnostics', '配置规则、Issue 打开时序、构建日志、单线程诊断或 Artifact 说明缺失');
  const hiddenSmokeContract = !buildWorkflow.includes('workflow_dispatch:') &&
    buildWorkflow.includes('repository_dispatch:') &&
    buildWorkflow.includes('types: [smoke-build]') &&
    buildWorkflow.includes('github.event.client_payload.device') &&
    parser.includes("let requestMode = 'smoke-internal';") &&
    smokeWorkflow.includes('github.rest.repos.createDispatchEvent') &&
    smokeWorkflow.includes("event_type: 'smoke-build'") &&
    smokeWorkflow.includes('contents: write') &&
    !smokeWorkflow.includes('createWorkflowDispatch');
  hiddenSmokeContract
    ? ok('构建入口:旧手动表单已移除，Smoke All 通过隐藏 repository_dispatch 独立触发')
    : bad('build entrypoint', 'Custom Build 仍暴露手动 dispatch，或 Smoke All 隐藏触发链不完整');
  const driftSentinelContract = driftSentinel.includes("const forbidden = ['lede-17.01', 'pcs-standalone-back', 'master'];") &&
    driftSentinel.includes("names.has('main')") && !driftSentinel.includes('360T7') &&
    !driftSentinel.includes('qihoo_360t7') && !syncWorkflow.includes('360T7');
  driftSentinelContract
    ? ok('上游漂移哨兵:仅保留通用 OpenWrt 分支策略，不再阻断 360T7 专用 Profile')
    : bad('upstream drift sentinel', '360T7 专用检查仍存在，或 OpenWrt 通用分支策略缺失');
  const previewBatBytes = readFileSync(join(ROOT, 'OpenWebPage_打开网页.bat'));
  const previewBat = previewBatBytes.toString('ascii');
  const previewBatOk = !previewBatBytes.some((byte) => byte > 0x7f) &&
    !/(?<!\r)\n/.test(previewBat) &&
    previewBat.includes('tools\\serve.mjs site\\wrt 8642') &&
    previewBat.includes('http://localhost:8642/index.html') &&
    previewBat.includes('devpkgBox');
  previewBatOk
    ? ok('本地预览 bat 为 ASCII+CRLF,含正确目录与 8642 健康检查')
    : bad('OpenWebPage_打开网页.bat', '编码/换行、serve 参数或健康检查不正确');
  const ids = [...js.matchAll(/\$\('([A-Za-z]\w+)'\)/g)].map((m) => m[1]);
  const dynamicIds = new Set(['targetSystem', 'targetSubtarget', 'targetProfile']);
  const missing = [...new Set(ids)].filter((id) => !html.includes(`id="${id}"`) && !dynamicIds.has(id));
  missing.length === 0 ? ok('app.js 引用的元素 id 在 index.html 全部存在') : bad('index.html', '缺元素: ' + missing.join(','));
  const targetPickerContract = ['targetSource', 'targetBranch', 'targetDynamicSelectors']
    .every((id) => html.includes(`id="${id}"`)) &&
    html.includes('id="targetSourceLabel">Source</span>') &&
    html.includes('id="targetBranchLabel">Branch</span>') &&
    !html.includes('Source — 源码') &&
    !html.includes('id="deviceModeBtn"') && !html.includes('id="brandPicker"') &&
    html.includes('id="sourceStep"') && js.includes('function targetRecords()') &&
    js.includes("d.kind === 'target'") &&
    js.includes('function renderCatalogTargetSelectors') &&
    js.includes('const TARGET_FIELD_I18N =') &&
    js.includes('(item) => item.labelEn || item.value') &&
    js.includes('DEFAULT_TARGET_SELECTORS') &&
    css.includes('.target-dynamic{display:contents}') &&
    css.includes('.target-picker .target-profile{flex:1.8 1 260px}');
  targetPickerContract
    ? ok('品牌型号入口已移除,源码/分支/Target 动态选择器已接通')
    : bad('target picker UI', 'Catalog 动态级联、旧入口清理或响应式布局缺失');
  const pluginPaletteContract = ['--plugin-panel:', '--plugin-head:', '--plugin-item:',
    '--plugin-hover:', '--plugin-selected:', '--plugin-muted:',
    '.plugin:has(input:checked) { background: var(--plugin-selected); }']
    .every((token) => css.includes(token)) &&
    !css.includes('box-shadow: inset 3px 0 0');
  pluginPaletteContract
    ? ok('插件分区与选项使用浅色/暗色整体蓝色层次,旧竖边框已移除')
    : bad('plugin palette', '插件区域蓝色背景变量、选中态或旧竖边框清理不完整');
  const catalogBranches = catalogIndex.sources.flatMap((source) =>
    source.branches.map((branch) => `${source.id}/${branch.branch}`));
  const catalogProjectContract = project.schema === 1 &&
    project.repository === 'weigefenxiang/WeiG-OpenWrt-AutoBuild' &&
    project.catalogRepository === catalogIndex.catalogRepo &&
    catalogIndex.sources.length === 4 && catalogBranches.length === 14 &&
    catalogBranches.includes('hanwckf/openwrt-21.02') &&
    js.includes('PROJECT = await loadJson') &&
    js.includes('branches: (source.branches || [])') &&
    js.includes("errorStage: 'catalog-refresh-required'") &&
    !js.includes("filter((branch) => branch.state !== 'unavailable')") &&
    parser.includes('async function loadCatalogIndex()') &&
    parser.includes('async function loadCatalog(repo, branch)') &&
    parser.includes('findCatalogPackageConflicts(submittedConfig, activeCatalog)') &&
    parser.includes('Catalog 不提供该源码/分支的固件主题') &&
    parser.includes('catalogBranch.state ===');
  catalogProjectContract
    ? ok('Fork 单文件参数 + Catalog 4 源 14 分支 + 构建白名单已接通')
    : bad('project/catalog contract', `源码 ${catalogIndex.sources.length},分支 ${catalogBranches.length},或动态白名单缺失`);
  const timezoneUiContract = html.includes('id="timezoneMenu" role="listbox"') &&
    html.includes('role="combobox"') &&
    !html.includes('id="timezoneList"') &&
    js.includes('function openTimezoneMenu') &&
    js.includes('function timezoneMenuKeydown') &&
    js.includes('function initializeTimezone') &&
    js.includes('function timezoneMenuZones') &&
    js.includes('const COMMON_TIMEZONES = [') &&
    js.includes("localStorage.setItem('wrt_timezone', zone.zonename)") &&
    js.includes("zone.zonename === 'Asia/Shanghai'") &&
    js.includes("return `(UTC${timezoneOffset(zone.zonename)}) ${zone.zonename}`;") &&
    !js.includes("const alias = zone.zonename") &&
    css.includes('grid-template-columns: minmax(250px, 2.25fr)') &&
    css.includes('height: 44px') &&
    css.includes('.timezone-menu');
  timezoneUiContract
    ? ok('Linux/IANA 可搜索时区组合框、北京时间搜索别名与统一固件控件高度已接通')
    : bad('timezone settings UI', '组合框、键盘交互、Asia/Shanghai 搜索别名或统一控件高度缺失');
  const dockHelpContract = html.includes('class="icon-btn dock-selftest"') &&
    html.includes('>检</button>') &&
    css.includes('.side-dock .lang-sel:focus') &&
    js.includes("const LANG_SHORT =") &&
    js.includes("'zh-CN': '简'") &&
    js.includes("en: 'EN'") &&
    js.includes('help.link.ubi') &&
    js.includes('help.link.layout');
  dockHelpContract
    ? ok('窄悬浮坞、聚焦展开语言框与 360T7 UBI/108M 精简说明已接通')
    : bad('dock/help UI', '悬浮坞尺寸、语言框展开或使用说明链接缺失');
  const importLogContract = html.includes('id="importLogBtn"') &&
    js.includes('function beginImportLog(file)') &&
    js.includes('function downloadImportLog()') &&
    js.includes('function showImportError(error)') &&
    js.includes("typeof id === 'string'") &&
    !js.includes("alert(t('import.fail'");
  importLogContract
    ? ok('配置导入异常对话框、隐私诊断日志下载与脏插件值防线已接通')
    : bad('config import diagnostics', '按钮、日志函数、错误对话框或空值防线缺失');
  const targetTypeContract = css.includes('font-size: 15px') &&
    css.includes('height: 44px') && css.includes('font-size:16px');
  targetTypeContract
    ? ok('Target 标签 15px、选中值 16px 与 44px 控件高度已接通')
    : bad('Target typography', 'Source/Branch/Target 标签、选中值或控件高度未放大');
  const menuconfigImportOk = js.includes('function importedConfigMeta') &&
    js.includes("values.get('TARGET_BOARD')") &&
    js.includes("values.get('TARGET_SUBTARGET')") &&
    js.includes("values.get('TARGET_PROFILE')") &&
    readFileSync(join(ROOT, 'tools', 'parse-request.mjs'), 'utf8').includes('const actualDevices = actualTarget.filter');
  menuconfigImportOk
    ? ok('原生 menuconfig 配置可按设备选择行识别和提交,不依赖派生目标签名或插件')
    : bad('menuconfig import contract', '网页或 Actions 的原生设备选择行兼容逻辑缺失');
  const customTargetContract = js.includes('function customDeviceFromConfig') &&
    js.includes("id: 'custom-target'") &&
    js.includes('async function selectImportedTarget') &&
    js.includes('importedTargetVerified = false') &&
    parser.includes("['custom-target', 'catalog-target'].includes(req.device)") &&
    parser.includes('custom_target=${isCustomTarget ? 1 : 0}') &&
    buildWorkflow.includes('cp submitted.config openwrt/.config') &&
    buildWorkflow.includes('config_policy=authoritative-no-defconfig');
  customTargetContract
    ? ok('未收录 .config → Custom Target → Issue/Actions 直接配置链路已接通')
    : bad('custom target contract', '网页兜底、解析器、Issue 校验或 Actions 直接配置参数缺失');
  const importedWorkspaceContract = html.includes('id="importWorkspace"') &&
    html.includes('id="importUnknownBox"') &&
    js.includes('function importedConfigMeta') &&
    js.includes('function chooseImportedSourceBranch') &&
    js.includes("'source-branch-candidates'") &&
    !js.includes('配置没有记录分支，请选择') &&
    js.includes('function renderImportedWorkspace') &&
    js.includes('function applyImportedUnknownEdits') &&
    js.includes('[A-Za-z0-9_.+@-]+') &&
    js.includes('menuCatalogPromise') &&
    css.includes('.import-unknown-row') &&
    css.includes('.import-source-grid');
  importedWorkspaceContract
    ? ok('上传配置全源码/分支确认、Catalog-first 解析与未收录项编辑链已接通')
    : bad('imported config workspace', '全源码选择、导入工作区、真实包名解析或编辑补丁缺失');
  const readmes = readdirSync(join(ROOT, 'translations')).filter((name) => /^README\..+\.md$/.test(name));
  const zhReadme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  const zhHeadings = (zhReadme.match(/^#{1,3} /gm) || []).length;
  const badReadmes = readmes.filter((name) => {
    const text = readFileSync(join(ROOT, 'translations', name), 'utf8');
    return (text.match(/^#{1,3} /gm) || []).length !== zhHeadings ||
      !text.includes('<!--plugin-count-->226<!--/plugin-count-->') ||
      !text.includes('build-request.json') || !text.includes('(UTC±HH:MM) Region/City');
  });
  readmes.length === 10 && badReadmes.length === 0
    ? ok('README:简中源 + 10 份译文结构与 D12 提交/时区说明齐全')
    : bad('README translations', `译文 ${readmes.length} 份,结构或新说明异常:${badReadmes.join(',')}`);
  const configFiles = walkFiles(join(ROOT, 'config'), '.config');
  const proxyDefaults = [];
  for (const file of configFiles) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (PROXY_PACKAGE_RE.test(lines[i])) proxyDefaults.push(`${file.replace(ROOT, '.')}：${i + 1} ${lines[i]}`);
    }
  }
  proxyDefaults.length === 0
    ? ok(`base config: ${configFiles.length} 份,默认代理 CONFIG_PACKAGE =y/m 为 0`)
    : bad('base config 代理默认值', proxyDefaults.slice(0, 5).join(' | '));
  const ledeSeedFiles = configFiles.filter((file) => /[\\/]lede-master-[^\\/]+\.config$/.test(file));
  const ledeSeedTlsMismatch = ledeSeedFiles.filter((file) => {
    const config = readFileSync(file, 'utf8');
    return !config.includes('CONFIG_PACKAGE_luci-ssl-openssl=y') || config.includes('CONFIG_PACKAGE_luci-ssl=y');
  });
  ledeSeedFiles.length > 0 && ledeSeedTlsMismatch.length === 0
    ? ok(`LEDE seed configs: ${ledeSeedFiles.length} use luci-ssl-openssl to avoid the default OpenSSL conflict`)
    : bad('LEDE seed TLS choice', `files ${ledeSeedFiles.length}, mismatched ${ledeSeedTlsMismatch.length}`);
  const manifest = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'config-manifest.json'), 'utf8'));
  const expected = [];
  for (const device of dev.devices.filter((item) => item.enabled)) {
    for (const source of device.sources) {
      for (const version of source.versions) {
        for (const variant of source.variants.filter((item) => !item.versions || item.versions.includes(version.id))) {
          expected.push([device.id, source.id, version.id, variant.id].join('/'));
        }
      }
    }
  }
  const missingConfigs = expected.filter((id) => !manifest.configs[id]);
  const extraConfigs = Object.keys(manifest.configs).filter((id) => !expected.includes(id));
  missingConfigs.length === 0 && extraConfigs.length === 0
    ? ok(`config manifest: ${expected.length} 个精确 device/source/version/variant 组合`)
    : bad('config-manifest.json', `缺 ${missingConfigs.length},多 ${extraConfigs.length}`);
  const issueForm = readFileSync(join(ROOT, '.github', 'ISSUE_TEMPLATE', 'custom-build.yml'), 'utf8');
  const workflow = readFileSync(join(ROOT, '.github', 'workflows', 'custom-build.yml'), 'utf8')
    .replace(/\r\n/g, '\n');
  const issueRequestReader = readFileSync(join(ROOT, 'tools', 'fetch-build-request.mjs'), 'utf8');
  const cancelWorkflow = readFileSync(join(ROOT, '.github', 'workflows', 'cancel-build.yml'), 'utf8')
    .replace(/\r\n/g, '\n');
  const versionWorkflow = readFileSync(join(ROOT, '.github', 'workflows', 'site-version.yml'), 'utf8');
  const versionStamper = readFileSync(join(ROOT, 'tools', 'stamp-site-version.mjs'), 'utf8');
  const requestParser = readFileSync(join(ROOT, 'tools', 'parse-request.mjs'), 'utf8');
  const configBuilder = readFileSync(join(ROOT, 'tools', 'build-config.mjs'), 'utf8');
  const genericDiy = readFileSync(join(ROOT, 'Shell', 'diy2-generic.sh'), 'utf8');
  const mirrorDiy = readFileSync(join(ROOT, 'Shell', 'apply-package-mirror.sh'), 'utf8');
  const issueFieldIds = [...issueForm.matchAll(/^\s+id:\s*([A-Za-z0-9_-]+)\s*$/gm)].map((m) => m[1]);
  const issueFormIsSingleAttachment = issueFieldIds.length === 1 && issueFieldIds[0] === 'request';
  const contractOk = issueForm.includes('build-request.json') &&
    issueForm.includes('config.buildinfo') &&
    issueFormIsSingleAttachment &&
    workflow.includes('tools/fetch-build-request.mjs') &&
    workflow.includes('cp submitted.config openwrt/.config') &&
    workflow.includes('authoritative_config');
  contractOk
    ? ok('Issue attachment → submitted.config → openwrt/.config 权威链路已接通')
    : bad('Issue attachment contract', `Issue 表单或 workflow 关键链路缺失；字段=${issueFieldIds.join(',') || '(无)'}`);
  const mobileIssueContract = js.includes('function mobileIssuePayload') &&
    js.includes('WEIG_BUILD_REQUEST_GZIP_BASE64') &&
    issueRequestReader.includes('WEIG_BUILD_REQUEST_GZIP_BASE64') &&
    issueRequestReader.includes('gunzipSync') && workflow.includes('mobile request');
  mobileIssueContract
    ? ok('手机 GitHub App 正文压缩请求 → 权威 config 校验链已接通')
    : bad('mobile Issue request contract', '网页压缩载荷、Actions 解压或工作流入口缺失');
  const artifactContract = [
    'FIRMWARE-ALL', 'CONFIG-', 'BUILD-LOGS', 'OPTIONAL-PACKAGES-',
    'tools/collect-optional-packages.mjs',
    'compression-level: 0',
    'retention-days: 14', 'retention-days: 30',
    '${{ steps.req.outputs.build_ref }}-FIRMWARE-ALL-${{ steps.req.outputs.artifact_tail }}',
  ];
  artifactContract.every((token) => workflow.includes(token))
    ? ok('Actions 四类 Artifact、M 软件包、零压缩与 14/30 天保留期已接通')
    : bad('Actions artifact contract', '产物分类或保留期缺失');
  const firmwareSettingsContract = workflow.includes('ISSUE_TITLE: ${{ github.event.issue.title }}') &&
    workflow.includes('Verify firmware settings / 核验固件设置') &&
    workflow.includes('firmware-settings.txt') &&
    requestParser.includes('const buildRef =') &&
    requestParser.includes('固件设置快照不一致') &&
    requestParser.includes('CONFIG_PACKAGE_${theme}=y') &&
    genericDiy.includes('files/etc/weig-build-info') &&
    genericDiy.includes("luci.main.mediaurlbase") &&
    genericDiy.includes("printf '%s\\n'") &&
    !genericDiy.includes("\\\\''") &&
    requestParser.includes("package-mirrors.json") &&
    genericDiy.includes('apply-package-mirror.sh') &&
    mirrorDiy.includes('downloads\\.openwrt\\.org') &&
    mirrorDiy.includes('downloads\\.immortalwrt\\.org') &&
    mirrorDiy.includes('Selected package mirror applied') &&
    mirrorDiy.includes('Selected package mirror has no feed for this source/branch');
  firmwareSettingsContract
    ? ok('请求编号 Artifact 前缀与时区/主题/NTP/opkg 固件内审计链已接通')
    : bad('firmware settings contract', '请求编号、提交快照、DIY、主题或 opkg 核验缺失');
  const liveLogContract = workflow.includes('JOBS=$(( $(nproc) + 1 ))') &&
    workflow.includes('stdbuf -oL -eL make download -j"$JOBS" 2>&1 |') &&
    workflow.includes('stdbuf -oL -eL make -j"$JOBS" 2>&1 |') &&
    workflow.includes('tee "$GITHUB_WORKSPACE/download.log"') &&
    workflow.includes('tee "$GITHUB_WORKSPACE/build.log"') &&
    (workflow.match(/make download/g) || []).length === 1 &&
    workflow.includes('- name: Upload complete logs / 上传完整日志\n        if: always()') &&
    !workflow.includes('ci-log-filter.awk') &&
    !workflow.includes('compile_retry') &&
    workflow.includes('make -j1 V=s') &&
    workflow.includes('build-diagnostic.log');
  liveLogContract
    ? ok('Actions 下载/编译 CPU+1 动态并发、原始实时日志与失败单线程诊断已接通')
    : bad('Actions live log contract', '动态并发、逐行 tee、单次下载、失败诊断或旧过滤清理不完整');
  const buildLimitContract = workflow.includes('MAX_BUILDS_PER_USER') &&
    workflow.includes('Build admission refused') &&
    workflow.includes('const isRepositoryOwner = isIssue && requester.toLowerCase() === context.repo.owner.toLowerCase();') &&
    workflow.includes('`owner-${context.runId}`') &&
    workflow.includes('Repository owner build admitted without queue') &&
    workflow.includes('custom-build-user-${{ needs.admission.outputs.requester }}-${{ needs.admission.outputs.slot }}') &&
    workflow.includes('queue: max') &&
    workflow.includes('/cancel') &&
    cancelWorkflow.includes('issue_comment:') &&
    cancelWorkflow.includes("['/cancel', '/cancel-build']") &&
    cancelWorkflow.includes('commenter.toLowerCase() !== requester.toLowerCase()') &&
    cancelWorkflow.includes('cancelWorkflowRun') &&
    cancelWorkflow.includes('force-cancel');
  buildLimitContract
    ? ok('仓库主免排队、每用户构建上限、Issue 自助取消与强制取消兜底已接通')
    : bad('per-user build control', '仓库主绕过、准入上限、分槽并发或 Issue 作者取消链路缺失');
  const catalogUrlBlock = js.slice(js.indexOf('function catalogUrls'), js.indexOf('function stableCatalogIndex'));
  const menuconfigContract = html.includes('id="menuconfigGrid"') &&
    html.includes('id="menuconfigPanel"') &&
    html.includes('id="menuconfigToggle"') &&
    html.includes('id="menuconfigSelectedToggle"') &&
    html.includes('id="menuconfigStateHelp"') &&
    html.includes('id="catalogLoadState"') &&
    html.includes('id="menuconfigContent"') &&
    html.includes('id="menuconfigMore"') &&
    js.includes('function renderCatalogPicker') &&
    js.includes('function catalogBranchLabel') &&
    js.includes('function buildMenuIndexes') &&
    js.includes("option.path?.[0] !== 'Target Devices'") &&
    js.includes('const MENU_PAGE_SIZE = 80') &&
    js.includes('function applyMenuTranslation') &&
    js.includes("state.lang === 'en' || !lines.length") &&
    js.includes('function fitMenuCategoryNames') &&
    js.includes("chip.className = 'menu-translation-chip'") &&
    js.includes('function jumpMenuBreadcrumb') &&
    js.includes('function initCatalogLocator') &&
    js.includes('function selectCatalogLocatorTarget') &&
    js.includes('const preferredTarget = { ...values };') &&
    js.includes('renderCatalogTargetSelectors(preferredTarget)') &&
    js.includes('const INITIAL_CATALOG_TARGET =') &&
    js.includes("sourceId: 'ImmortalWrt', branch: 'openwrt-25.12'") &&
    js.includes("system: 'x86', subtarget: '64', profileSymbol: 'DEVICE_generic'") &&
    js.includes('function initialCatalogTargetRequest()') &&
    js.includes("selector.id === 'profile'") &&
    js.includes('preferred[`${selector.id}Symbol`] || preferred[selector.id]') &&
    js.includes("if (node.profileId) {") &&
    js.includes('function syncCatalogApplications') &&
    js.includes("['Top level', ...menuBreadcrumb]") &&
    catalogUrlBlock.indexOf('raw.githubusercontent.com') >= 0 &&
    catalogUrlBlock.indexOf('raw.githubusercontent.com') < catalogUrlBlock.indexOf('cdn.jsdelivr.net') &&
    js.includes('promptZh') &&
    js.includes("branch.state === 'unavailable'") &&
    css.includes('.catalog-stale') &&
    js.includes("option.type === 'tristate' ? ['n', 'm', 'y']") &&
    js.includes('function showMenuHelp') &&
    js.includes('function setCatalogLoadState') &&
    js.includes('function retryCatalogLoad') &&
    js.includes("setCatalogLoadState('loading')") &&
    js.includes("setCatalogLoadState('error', error)") &&
    js.includes("setCatalogLoadState('idle')") &&
    !js.includes('translation.usage, packageMeta') &&
    js.includes("applyMenuTranslation(description, '', translation.usage, true)") &&
    js.includes('else if (!packageName && (translation.title || translation.usage))') &&
    js.includes('clippedDescription.dataset.translation') &&
    js.includes("clippedDescription.scrollWidth > clippedDescription.clientWidth + 1") &&
    js.includes("'N: Disabled; not built.") &&
    js.includes('function openMenuChildren') &&
    js.includes('function renderMenuLeaf') &&
    js.includes('menuChildrenByParent') &&
    js.includes('menuSelectedExpanded') &&
    js.includes('function kconfigExpr') &&
    css.includes('.menuconfig-selected-toggle') &&
    css.includes('.menuconfig-workspace') &&
    css.includes('.menuconfig-scroll') &&
    css.includes('.menuconfig-breadcrumb-link') &&
    css.includes('.catalog-locator-results') &&
    css.includes('.menu-tooltip') &&
    css.includes('.menu-fit-s3') &&
    css.includes('.menu-fit-two-line') &&
    css.includes('html:not([lang=en]) .menu-translation-chip') &&
    css.includes('.menuconfig-grid{grid-template-columns:minmax(0,1fr)}') &&
    css.includes('-webkit-line-clamp:2') &&
    css.includes('.menuconfig-prompt small{display:none}') &&
    css.includes('.menuconfig-choice') &&
    css.includes('.menuconfig-state-help') &&
    css.includes('.catalog-load-spinner') &&
    css.includes('@keyframes catalog-spin') &&
    css.includes('grid-template-columns:minmax(260px,1.5fr) minmax(140px,1fr)') &&
    css.includes('.menuconfig-package-name{min-width:0;overflow:hidden') &&
    css.includes('.menuconfig-child') &&
    existsSync(join(ROOT, 'site', 'wrt', 'data', 'menuconfig-index.json'));
    menuconfigContract
      ? ok('多源码 Catalog → 英文禁译文、手机单列/译文标签、滚动直显与可跳面包屑已接通')
      : bad('menuconfig catalog contract', '动态 Target、英语译文门禁、手机单列/译文标签、面包屑或 choice 缺失');
    const buildContractUi = html.includes('id="buildContract"') &&
      html.includes('id="buildContractGrid"') &&
      js.includes('function renderBuildContract()') &&
      js.includes('archPackages: String(target.archPackages ||') &&
      js.includes('CONFIG_TARGET_ARCH_PACKAGES') &&
      js.includes('enforceCatalogProfilePackages') &&
      parser.includes('catalogArchPackages') &&
      parser.includes('CONFIG_TARGET_ARCH_PACKAGES 与 Catalog 不一致') &&
      buildWorkflow.includes('catalog_arch_packages');
    buildContractUi
      ? ok('Catalog Target 构建契约:架构/必需包/主屏信息与 Actions 校验已接通')
      : bad('Catalog build contract', '架构、Profile 必需包、主屏信息或 Issue/Actions 校验缺失');
    const versionContract = versionWorkflow.includes('"site/wrt/**"') &&
    versionWorkflow.includes('"VERSION"') &&
    versionWorkflow.includes("github.actor != 'github-actions[bot]'") &&
    versionWorkflow.includes('permissions:') &&
    versionWorkflow.includes('contents: write') &&
    versionWorkflow.includes('tools/stamp-site-version.mjs') &&
    versionWorkflow.includes('site/wrt/data/site-version.json') &&
    versionWorkflow.includes('git add VERSION site/wrt/data/site-version.json') &&
    versionStamper.includes('vYYMMDDHHmm') &&
    versionStamper.includes("const ROOT_VERSION = join(ROOT, 'VERSION')") &&
    versionStamper.includes('writeFileSync(ROOT_VERSION, version') &&
    versionStamper.includes("minute: '2-digit'") &&
    versionStamper.includes("timeZone: 'Asia/Shanghai'") &&
    versionStamper.includes("timezone: 'Asia/Shanghai'") &&
    versionStamper.includes('^v\\d{10}$') &&
    requestParser.includes('v\\d{8}(?:\\d{2})?') &&
    configBuilder.includes('v\\d{8}(?:\\d{2})?') &&
    js.includes('^v\\d{10}$') &&
    html.indexOf('id="siteVersion"') < html.indexOf('id="importBtn"') &&
    html.includes('id="siteVersionFooter"') &&
    css.includes('.site-version-action { display: none; }');
  versionContract
    ? ok('根 VERSION/网页副本共用分钟版本、旧八位兼容与双端显示已接通')
    : bad('site version contract', '分钟时间戳、旧版兼容、Actions 防循环或双端显示位置缺失');
  const selfTestContract = js.includes("state.device.plugins === 'seed' ? 'seed/plugins.json'") &&
    js.includes("state.device?.id === 'catalog-target'") &&
    js.includes('const text = await generateResolvedConfigText()') &&
    js.includes('const targets = targetLines(text)') &&
    js.includes('function safeDownloadNamePart') &&
    js.includes('function selectedTargetProfileName') &&
    js.includes('function selectedTargetProfileLabel') &&
    js.includes('function requestTargetProfilePart') &&
    js.includes("const title = '[build] ' + requestStamp + '/' + requestTargetProfilePart() + '/' + state.source.id + '/' + state.version.id + '/' + selectedTargetProfileName()") &&
    js.includes("const filename = [requestStamp, requestTargetProfilePart(true), safeDownloadNamePart(state.source.id, 'source')");
  selfTestContract
    ? ok('网页自检使用真实 Catalog/base 路径与 .config 生成演算')
    : bad('web self-test contract', '种子数据路径、Catalog 配置或真实生成演算缺失');
  const devpkgContract = html.includes('id="devpkgToggle"') &&
    html.includes('id="devpkgBody" hidden') &&
    html.includes('id="devpkgStatus"') &&
    js.includes('kw.length < 2') &&
    js.includes("setDevpkgExpanded(false)");
  devpkgContract
    ? ok('开发者软件包默认折叠、两字符门禁与同行状态区已接通')
    : bad('developer package contract', '折叠、搜索门禁或状态区缺失');
  const meta = JSON.parse(readFileSync(join(ROOT, 'tools', 'plugins-meta.json'), 'utf8'));
  const sizes = JSON.parse(readFileSync(join(ROOT, 'tools', 'plugin-sizes.json'), 'utf8'));
  const sizeEntries = Object.entries(sizes.plugins || {});
  const knownIds = new Set(meta.plugins.map((plugin) => plugin.id));
  const invalidSizes = sizeEntries.filter(([id, kb]) => !knownIds.has(id) || !Number.isFinite(kb) || kb <= 0);
  const t7Plugins = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', '360t7', 'plugins.json'), 'utf8')).plugins;
  const seedPlugins = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'seed', 'plugins.json'), 'utf8')).plugins;
  const expectedMB = (plugin) => sizes.plugins[plugin.id] === undefined
    ? plugin.size : Math.round(sizes.plugins[plugin.id] / 1.024) / 1000;
  const t7SizeMismatch = meta.plugins.filter((plugin) => {
    const generated = t7Plugins.find((item) => item.id === plugin.id);
    return !generated || generated.size !== expectedMB(plugin);
  });
  const seedSizeMismatch = meta.plugins.filter((plugin) => {
    const generated = seedPlugins.find((item) => item.id === plugin.id);
    return !generated || generated.size !== plugin.size;
  });
  sizes.version === 1 && sizes.device === '360t7' && sizes.arch === 'aarch64_cortex-a53' &&
    sizeEntries.length === 218 && invalidSizes.length === 0 &&
    t7SizeMismatch.length === 0 && seedSizeMismatch.length === 0
    ? ok('plugin sizes: 360T7 真实值 218 项 + 人工回退 8 项;种子机型保持人工估算')
    : bad('plugin-sizes.json', `条目 ${sizeEntries.length},非法 ${invalidSizes.length},360T7 不符 ${t7SizeMismatch.length},种子不符 ${seedSizeMismatch.length}`);
} catch (e) { bad('consistency', e.message.slice(0, 80)); }

console.log(fail ? `\n共 ${fail} 个问题,请修复 / ${fail} problem(s) found` : '\n全部通过 / all checks passed');
process.exit(fail ? 1 : 0);
