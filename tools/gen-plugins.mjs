#!/usr/bin/env node
// 由 config/<品牌>/<机型>/*.config + tools/plugins-meta.json 生成网站插件索引 / Builds web plugin indexes from authoritative configs + plugins-meta.json.
// 权威 base config 只保留在 config/，不再复制到 site/wrt/data/ / Authoritative base configs stay in config/ and are no longer copied into site/wrt/data/.
// 用法 / Usage: node tools/gen-plugins.mjs   # 处理 devices.json 里所有已启用机型 / processes all enabled devices in devices.json
// 新增插件只改 plugins-meta.json 后重跑本脚本,页面零改动 / To add a plugin, edit plugins-meta.json and rerun — no page changes needed.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const META = JSON.parse(readFileSync(join(ROOT, 'tools', 'plugins-meta.json'), 'utf8'));
const SIZE_DATA = JSON.parse(readFileSync(join(ROOT, 'tools', 'plugin-sizes.json'), 'utf8'));
const DEVICES = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'devices.json'), 'utf8'));
const PACKAGE_BASELINE_360T7 = JSON.parse(
  readFileSync(join(ROOT, 'tools', 'package-baseline-360t7.json'), 'utf8')).pkgs;
const DATA_ROOT = join(ROOT, 'site', 'wrt', 'data');
const MINIMUM_BOOT = JSON.parse(
  readFileSync(join(ROOT, 'config', '001.presets', 'minimum-boot.json'), 'utf8'));
writeFileSync(join(DATA_ROOT, 'minimum-boot.json'), JSON.stringify(MINIMUM_BOOT, null, 1) + '\n');
const pluginSizeMB = (plugin, deviceId) => {
  const kb = deviceId === SIZE_DATA.device ? SIZE_DATA.plugins[plugin.id] : undefined;
  return Number.isFinite(kb) && kb > 0 ? Math.round(kb / 1.024) / 1000 : plugin.size;
};

// config 目录:优先显式 dir 字段,回退 品牌/机型 / explicit dir field wins, fallback brand/id
export const configDir = (device) => join(ROOT, 'config', ...(device.dir ? device.dir.split('/') : [device.brand, device.id]));
const variantsFor = (source, version) => (source.variants || [])
  .filter((variant) => !variant.versions || variant.versions.includes(version.id));
const configFor = (source, version, variant) =>
  (variant && variant.configs && variant.configs[version.id]) || variant?.config || source.config;
const liveDataDirs = new Set([
  'seed',
  ...DEVICES.devices
    .filter((device) => device.enabled === true && device.plugins !== 'seed')
    .map((device) => device.id),
]);
for (const name of readdirSync(DATA_ROOT)) {
  const path = join(DATA_ROOT, name);
  if (statSync(path).isDirectory() && !liveDataDirs.has(name)) {
    rmSync(path, { recursive: true, force: true });
  }
}
for (const name of liveDataDirs) {
  const dir = join(DATA_ROOT, name);
  if (!existsSync(dir)) continue;
  for (const entry of readdirSync(dir)) {
    if (entry.endsWith('.config')) rmSync(join(dir, entry));
  }
}

// Catalog/custom-target 共用一张 append 模式插件表；base config 仅保留在 config/。
// Catalog/custom-target share one append-mode plugin table; base configs remain only in config/.
const seedPlugins = META.plugins.map((p) => {
  const e = { id: p.id, name: p.name, group: p.group, desc: p.desc, size: pluginSizeMB(p, null), pkgs: {},
    pkg: p.catalogCandidates?.[0] || (p.pkgs ? Object.values(p.pkgs)[0] : 'luci-app-' + p.id) };
  if (p.hot) e.hot = true;
  if (p.requires) e.requires = p.requires;
  if (p.catalogOnly) e.catalogOnly = true;
  if (p.catalogCandidates) e.catalogCandidates = p.catalogCandidates;
  return e;
});
mkdirSync(join(ROOT, 'site', 'wrt', 'data', 'seed'), { recursive: true });
writeFileSync(join(ROOT, 'site', 'wrt', 'data', 'seed', 'plugins.json'),
  JSON.stringify({ version: 2, groups: META.groups, plugins: seedPlugins }, null, 1) + '\n');
console.log(`seed/plugins.json: ${seedPlugins.length} 个插件(append 模式);公共 config 副本 0 份`);


for (const device of DEVICES.devices) {
  if (device.enabled !== true || device.plugins === 'seed') continue;   // 种子机型走上面的共享表 / seed devices use the shared table above
  const CONFIG_DIR = configDir(device);
  const DATA_DIR = join(ROOT, 'site', 'wrt', 'data', device.id);
  const sources = device.sources.map((s) => s.id);
  const warnings = [];

  // 解析每个源的 config 得到 pkg 状态(off|y|m) / parse each source's config into pkg name -> state (off|y|m)
  const states = {};
  for (const src of device.sources) {
    const map = new Map();
    // 版本化最小种子只保存目标身份。360T7 的完整软件包清单负责说明“包是否存在”，
    // 随后再用当前种子中的显式状态覆盖，避免把未写入最小 config 的包误判为不提供。
    // Versioned minimal seeds contain target identity only. The 360T7 package baseline
    // supplies package availability; explicit state in the current seed wins afterward.
    if (device.id === '360t7') {
      for (const [pkg, sourceStates] of Object.entries(PACKAGE_BASELINE_360T7)) {
        if (sourceStates[src.id] !== undefined) map.set(pkg, sourceStates[src.id]);
      }
    }
    const text = readFileSync(join(CONFIG_DIR, src.config), 'utf8');
    for (const line of text.split('\n')) {
      let m;
      if ((m = line.match(/^# CONFIG_PACKAGE_([^\s]+) is not set/))) map.set(m[1], 'off');
      else if ((m = line.match(/^CONFIG_PACKAGE_([^\s=]+)=([ym])/))) map.set(m[1], m[2]);
    }
    states[src.id] = map;
  }

  const covered = new Set();
  const plugins = [];

  for (const p of META.plugins) {
    const pkgs = {};
    const builtin = {};
    for (const s of sources) {
      const pkg = p.pkgs ? p.pkgs[s] : 'luci-app-' + p.id;
      if (!pkg) continue;
      const st = states[s].get(pkg);
      if (st === undefined) continue;   // 该源没有这个包,前端显示"该源不提供" / this source lacks the pkg; UI shows "not provided by this source"
      covered.add(pkg);
      pkgs[s] = pkg;
      if (st === 'y') builtin[s] = true;
    }
    // 没有任何源提供也保留条目(高级模式可强制勾选),pkg 用默认包名兜底 / entry is kept even if no source provides it (advanced mode can force it); pkg falls back to the default name
    const entry = { id: p.id, name: p.name, group: p.group, desc: p.desc, size: pluginSizeMB(p, device.id), pkgs };
    entry.pkg = p.catalogCandidates?.[0] ||
      ((p.pkgs && (p.pkgs[sources[0]] || Object.values(p.pkgs)[0])) || 'luci-app-' + p.id);
    if (p.hot) entry.hot = true;
    if (p.warn) entry.warn = p.warn;     // 资源警告词条 key(如 Docker)/ resource-warning i18n key (e.g. Docker)
    if (p.locked) entry.locked = true;   // 必选项:任何模式下都不可取消 / required items can never be unchecked, even in advanced mode
    if (p.catalogOnly) entry.catalogOnly = true;
    if (p.catalogCandidates) entry.catalogCandidates = p.catalogCandidates;
    if (Object.keys(builtin).length) entry.builtin = builtin;
    if (p.requires) entry.requires = p.requires;
    plugins.push(entry);
  }

  // 覆盖率检查:config 出现过、但既没收录也没显式排除的顶层 luci-app 包 / coverage check: top-level luci-app pkgs seen in configs but neither listed nor explicitly excluded
  const excluded = new Set(META.exclude || []);
  const seen = new Set();
  for (const s of sources) {
    for (const pkg of states[s].keys()) {
      if (!pkg.startsWith('luci-app-') || seen.has(pkg)) continue;
      seen.add(pkg);
      if (/_INCLUDE_|_Iptables_|_Nftables_/.test(pkg)) continue;
      if (!covered.has(pkg) && !excluded.has(pkg)) warnings.push(`未收录: ${pkg}(如无需展示请加进 exclude)`);
    }
  }

  // requires 只保留最终插件表里幸存的目标,避免前端解析到悬空依赖 / keep only requires targets that survived into the final list, so the UI never sees a dangling dependency
  for (const e of plugins) {
    if (!e.requires) continue;
    const alive = e.requires.filter((rid) => plugins.some((x) => x.id === rid));
    for (const rid of e.requires) {
      if (!alive.includes(rid)) warnings.push(`${e.id}: requires 的 ${rid} 不在插件表中,已移除该依赖`);
    }
    if (alive.length) e.requires = alive; else delete e.requires;
  }

  const groupOrder = new Map(META.groups.map((g, i) => [g, i]));
  plugins.sort((a, b) =>
    (groupOrder.get(a.group) - groupOrder.get(b.group)) ||
    ((b.hot ? 1 : 0) - (a.hot ? 1 : 0)) ||
    a.id.localeCompare(b.id));

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, 'plugins.json'),
    JSON.stringify({ version: 2, groups: META.groups, plugins }, null, 1) + '\n');
  // 开发者模式的全量软件包表:每个 CONFIG_PACKAGE 符号在各源的状态 / raw package table for developer mode: per-source state of every CONFIG_PACKAGE symbol
  const allPkgs = device.id === '360t7'
    ? JSON.parse(JSON.stringify(PACKAGE_BASELINE_360T7))
    : {};
  for (const s of sources) {
    for (const [pkg, st] of states[s]) {
      if (/_INCLUDE_|_Iptables_|_Nftables_/.test(pkg)) continue;
      if (!allPkgs[pkg]) allPkgs[pkg] = {};
      allPkgs[pkg][s] = st;
    }
  }
  writeFileSync(join(DATA_DIR, 'packages.json'),
    JSON.stringify({ version: 1, count: Object.keys(allPkgs).length, pkgs: allPkgs }) + '\n');
  console.log(`  packages.json: ${Object.keys(allPkgs).length} 个原始软件包`);

  console.log(`[${device.brand}/${device.id}] plugins.json: ${plugins.length} 个插件,${META.groups.length} 个分组`);
  for (const s of sources) {
    const ok = plugins.filter((p) => p.pkgs[s] && !(p.builtin && p.builtin[s])).length;
    const bi = plugins.filter((p) => p.builtin && p.builtin[s]).length;
    console.log(`  ${s}: 可选 ${ok} / 内置 ${bi} / 不提供 ${plugins.length - ok - bi}`);
  }
  if (warnings.length) {
    console.log('  警告:');
    for (const w of warnings) console.log('    - ' + w);
  }
}

// 每个“设备/源码/版本/变体”映射到唯一权威 config 与目标签名。
// Actions 只用本清单核对用户上传配置的目标身份,绝不据此重新生成配置。
// Maps each device/source/version/variant to one authoritative config and target signature.
{
  const manifest = { version: 1, configs: {} };
  const targetLines = (text) => text.split(/\r?\n/).filter((line) =>
    /^CONFIG_TARGET_(?:BOARD|SUBTARGET|PROFILE)=/.test(line) ||
    /^CONFIG_TARGET_.*_DEVICE_.*=y$/.test(line));
  for (const device of DEVICES.devices.filter((d) => d.enabled === true)) {
    const cdir = configDir(device);
    for (const source of device.sources || []) {
      for (const version of source.versions || []) {
        for (const variant of variantsFor(source, version)) {
          const name = configFor(source, version, variant);
          const sourcePath = join(cdir, name);
          const base = readFileSync(sourcePath, 'utf8');
          let resolved = base;
          for (const pair of variant.patch || []) {
            if (!resolved.includes(pair.from)) {
              throw new Error(`config manifest patch 未命中: ${device.id}/${source.id}/${version.id}/${variant.id}: ${pair.from}`);
            }
            resolved = resolved.split(pair.from).join(pair.to);
          }
          const id = [device.id, source.id, version.id, variant.id].join('/');
          const identity = targetLines(resolved);
          if (!identity.length) throw new Error(`config manifest 目标签名为空: ${id}`);
          if (manifest.configs[id]) throw new Error(`config manifest 重复 id: ${id}`);
          manifest.configs[id] = {
            device: device.id,
            source: source.id,
            version: version.id,
            variant: variant.id,
            sourcePath: sourcePath.replace(ROOT, '').replace(/^[\\/]/, '').replaceAll('\\', '/'),
            target: identity,
          };
        }
      }
    }
  }
  writeFileSync(join(ROOT, 'site', 'wrt', 'data', 'config-manifest.json'),
    JSON.stringify(manifest, null, 1) + '\n');
  console.log(`config-manifest.json: ${Object.keys(manifest.configs).length} 个精确构建组合`);
}

// 精选插件多语言表:tools/plugins-i18n.json -> site/wrt/data/plugins-i18n.json(minify 单行,供 packages.html 等按语言渲染)
// Curated-plugin i18n table: tools/plugins-i18n.json -> site/wrt/data/plugins-i18n.json (minified one-liner, consumed by packages.html etc.)
// 十个译文语言的名称和用途都必须完整;英文仍作为运行时兜底 / all ten translated languages require complete names and descriptions; English remains the runtime fallback.
{
  const PI_LANGS = ['zh-TW', 'en', 'ru', 'es', 'pt', 'ja', 'ko', 'de', 'fr', 'vi'];   // zh-CN 原文在 plugins-meta / zh-CN originals live in plugins-meta
  const PI = JSON.parse(readFileSync(join(ROOT, 'tools', 'plugins-i18n.json'), 'utf8'));
  const piErrors = [];
  const piWarnings = [];
  for (const p of META.plugins) {
    // 新增插件先沿用元数据的中英文原文作为明确回退，不阻断 Catalog/插件索引生成；
    // 翻译轮转可在后续批次只更新 tools/plugins-i18n.json。
    // New plugins fall back to metadata text until a translation rotation fills them.
    const raw = PI.plugins[p.id] || {};
    const fallbackName = Object.fromEntries(PI_LANGS.map((l) => [l, p.nameEn || p.id]));
    const fallbackDesc = Object.fromEntries(PI_LANGS.map((l) => [l, p.descEn || p.id]));
    const e = {
      name: { ...fallbackName, ...(raw.name || {}) },
      desc: { ...fallbackDesc, ...(raw.desc || {}) },
    };
    if (!PI.plugins[p.id]) piWarnings.push(`${p.id}: 未有独立译文，已使用 plugins-meta 回退`);
    else if (!raw.desc?.en || !raw.name?.en) piWarnings.push(`${p.id}: 英文译文不完整，已使用 plugins-meta 回退`);
    PI.plugins[p.id] = e;
    for (const l of PI_LANGS) {
      if (!e.desc[l]) piErrors.push(`${p.id}: 缺 desc.${l}`);
      if (!e.name || !e.name[l]) piErrors.push(`${p.id}: 缺 name.${l}`);
    }
  }
  for (const id of Object.keys(PI.plugins)) {
    if (!META.plugins.some((p) => p.id === id)) piWarnings.push(`${id}: 不在 plugins-meta 中(照常输出,前端按 id 取不到就忽略)`);
  }
  if (piErrors.length) {
    console.error('❌ plugins-i18n 完整性校验失败(10 个译文语言的名称和用途必须完整):');
    for (const e of piErrors) console.error('  - ' + e);
    process.exit(1);
  }
  const piOut = JSON.stringify({ version: 1, plugins: PI.plugins });
  writeFileSync(join(ROOT, 'site', 'wrt', 'data', 'plugins-i18n.json'), piOut + '\n');
  console.log(`plugins-i18n.json: ${Object.keys(PI.plugins).length} 个插件 × ${PI_LANGS.length} 语,${Math.round(piOut.length / 1024)}KB`);
  if (piWarnings.length) {
    console.log(`  警告 ${piWarnings.length} 条:`);
    for (const w of piWarnings) console.log('    - ' + w);
  }
}

// 自动刷新 README 等文档里的插件计数标记 <!--plugin-count-->N<!--/plugin-count-->
// Auto-refresh the plugin-count markers in README (and any translation that carries them)
{
  const COUNT_RE = /(<!--plugin-count-->)\d+(<!--\/plugin-count-->)/g;
  const targets = [join(ROOT, 'README.md')];
  const trDir = join(ROOT, 'translations');
  if (existsSync(trDir)) for (const f of readdirSync(trDir)) if (f.endsWith('.md')) targets.push(join(trDir, f));
  for (const f of targets) {
    const text = readFileSync(f, 'utf8');
    if (!COUNT_RE.test(text)) continue;
    const next = text.replace(COUNT_RE, `$1${META.plugins.length}$2`);
    if (next !== text) { writeFileSync(f, next); console.log(`计数已刷新 -> ${f.replace(ROOT, '.')} (${META.plugins.length})`); }
  }
}
