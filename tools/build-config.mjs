#!/usr/bin/env node
// CI 端按用户选择生成 .config,规则必须与网页端 app.js 保持一致 / CI-side .config generator; the rules must stay in sync with the web-side app.js.
// 用法 / Usage: node tools/build-config.mjs --device 360t7 --source OpenWrt --version main \
//         --variant qihoo_360t7 --plugins "openclash ttyd +homeproxy -mtk" --out openwrt/.config
// 插件 id 必须在 plugins.json 白名单内;高级模式前缀 +强制勾选、-取消内置 / plugin ids must be whitelisted in plugins.json; advanced prefixes: + force-enable, - drop a builtin.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];

const DEVICES = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'devices.json'), 'utf8'));
const device = DEVICES.devices.find((d) => d.id === (args.device || '360t7'));
if (!device) { console.error(`未知设备: ${args.device}`); process.exit(1); }

const source = device.sources.find((s) => s.id === args.source);
if (!source) { console.error(`未知源码: ${args.source}`); process.exit(1); }
const version = source.versions.find((v) => v.id === args.version);
if (!version) { console.error(`未知版本: ${args.version}(该源可选: ${source.versions.map((v) => v.id).join(' / ')})`); process.exit(1); }
const variants = source.variants.filter((v) => !v.versions || v.versions.includes(version.id));
const variant = variants.find((v) => v.id === args.variant);
if (!variant) { console.error(`未知变体: ${args.variant}(该版本可选: ${variants.map((v) => v.id).join(' / ')})`); process.exit(1); }

// 种子机型共用 seed 表 / seed devices share the seed plugin table
const PLUGINS = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', device.plugins === 'seed' ? 'seed' : device.id, 'plugins.json'), 'utf8'));
// dir 字段优先,回退 品牌/机型 / explicit dir wins, fallback brand/id
const cfgDir = device.dir ? device.dir.split('/') : [device.brand, device.id];
const configName = variant.configs?.[version.id] || variant.config || source.config;
let text = readFileSync(join(ROOT, 'config', ...cfgDir, configName), 'utf8');

// 变体替换;默认变体没有 patch 字段,替换未命中说明 base config 变了必须报错 / variant patching; the default variant has no patch field, and a miss means the base config drifted — must fail loudly
for (const pair of variant.patch || []) {
  if (!text.includes(pair.from)) { console.error(`变体替换未命中: ${pair.from}`); process.exit(1); }
  text = text.split(pair.from).join(pair.to);
}

function setY(pkg) {
  const notset = `# CONFIG_PACKAGE_${pkg} is not set`;
  const asM = `CONFIG_PACKAGE_${pkg}=m`;
  const asY = `CONFIG_PACKAGE_${pkg}=y`;
  if (text.includes(notset)) text = text.replace(notset, asY);
  else if (text.includes(asM + '\n') || text.endsWith(asM)) text = text.replace(asM, asY);
  else if (!text.includes(asY)) text += '\n' + asY;
}
function setOff(pkg) {
  const asY = `CONFIG_PACKAGE_${pkg}=y`;
  const notset = `# CONFIG_PACKAGE_${pkg} is not set`;
  if (text.includes(asY)) text = text.replace(asY, notset);
}

const applied = [], forced = [], removed = [], skipped = [];
for (const raw of (args.plugins || '').split(/\s+/).filter(Boolean)) {
  const mode = raw[0] === '+' ? 'force' : raw[0] === '-' ? 'remove' : 'normal';
  const id = mode === 'normal' ? raw : raw.slice(1);
  if (!/^[a-z0-9._-]+$/i.test(id)) { console.error(`非法插件 id: ${JSON.stringify(raw)}`); process.exit(1); }
  const p = PLUGINS.plugins.find((x) => x.id === id);
  if (!p) { console.error(`插件不在白名单: ${id}`); process.exit(1); }
  const pkg = p.pkgs[source.id] || p.pkg;

  if (mode === 'remove') {                       // 高级模式:取消该源内置项 / advanced mode: drop a builtin of this source
    setOff(pkg);
    removed.push(`${id} (${pkg})`);
  } else if (mode === 'force') {                 // 高级模式:强制开启该源没有的包 / advanced mode: force-enable a pkg this source does not provide
    setY(pkg);
    forced.push(`${id} (${pkg})`);
  } else if (p.builtin && p.builtin[source.id]) {
    skipped.push(`${id}(该源已内置)`);
  } else if (!p.pkgs[source.id] && !source.append) {   // append 产线所有插件按追加开启 / append-mode sources enable any plugin by appending
    skipped.push(`${id}(该源不提供)`);
  } else {
    setY(pkg);
    applied.push(`${id} (${pkg})`);
  }
}

// 开发者模式原始软件包(parse-request 已白名单校验)/ raw packages, already whitelisted upstream
const rawApplied = [], rawRemoved = [];
for (const raw of (args.packages || '').split(/\s+/).filter(Boolean)) {
  const name = raw.startsWith('-') ? raw.slice(1) : raw;
  if (!/^[A-Za-z0-9._+-]+$/.test(name)) { console.error(`非法软件包: ${raw}`); process.exit(1); }
  if (raw.startsWith('-')) { setOff(name); rawRemoved.push(name); }
  else { setY(name); rawApplied.push(name); }
}

// 与网页端一致:固件主题是单选 Kconfig / keep firmware theme selection aligned with app.js
const theme = args.theme || (['OpenWrt', 'lede'].includes(source.id) ? 'luci-theme-bootstrap' : 'luci-theme-argon');
if (!/^luci-theme-[A-Za-z0-9._+-]{1,48}$/.test(theme)) {
  console.error(`非法固件主题: ${theme}`); process.exit(1);
}
text = text.replace(/^CONFIG_PACKAGE_(luci-theme-[A-Za-z0-9._+-]+)=[ym]$/gm, '# CONFIG_PACKAGE_$1 is not set');
setY(theme);
const timezones = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'timezones.json'), 'utf8')).zones;
const zone = timezones.find((item) => item.zonename === args.zonename) ||
  timezones.find((item) => item.zonename === args.timezone) ||
  timezones.find((item) => item.timezone === args.timezone) ||
  timezones.find((item) => item.zonename === 'Asia/Shanghai');

text = `# Generated by WeiG-OpenWrt-AutoBuild custom build\n` +
  `# page-version=${/^v\d{8}(?:\d{2})?$/.test(args['page-version'] || '') ? args['page-version'] : 'unknown'}\n` +
  `# device=${device.id} source=${source.id} version=${version.id} (${version.branch}) variant=${variant.id}\n` +
  `# firmware-settings: zonename=${zone.zonename} timezone=${zone.timezone} theme=${theme} ntp=cn opkg=auto\n` +
  `# plugins: ${applied.length ? applied.join(' ') : '(none)'}\n` +
  (forced.length ? `# forced (advanced): ${forced.join(' ')}\n` : '') +
  (removed.length ? `# removed builtin (advanced): ${removed.join(' ')}\n` : '') +
  (rawApplied.length ? `# raw packages (developer): ${rawApplied.join(' ')}\n` : '') +
  (rawRemoved.length ? `# raw packages removed (developer): ${rawRemoved.join(' ')}\n` : '') + text;

for (const s of skipped) console.log(`跳过: ${s}`);
if (args.out) {
  writeFileSync(args.out, text);
  console.log(`已生成 ${args.out}:开启 ${applied.length} 个` +
    (forced.length ? `,强制 ${forced.length} 个` : '') + (removed.length ? `,取消内置 ${removed.length} 个` : ''));
} else process.stdout.write(text);
