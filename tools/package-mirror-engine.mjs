#!/usr/bin/env node
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function safeRelativePath(path) {
  return typeof path === 'string' && path.length > 0 &&
    !path.startsWith('/') && !path.includes('\\') &&
    path.split('/').every((part) => part && part !== '.' && part !== '..');
}

function normalizeRoot(value) {
  return String(value || '').replace(/\/+$/, '');
}

function normalizedOriginVariants(origin) {
  const normalized = normalizeRoot(origin);
  return [...new Set([
    normalized,
    normalized.replace(/^https:/, 'http:'),
  ])];
}

export function loadPackageMirrorRules(path) {
  const data = JSON.parse(readFileSync(path, 'utf8'));
  if (data?.schema !== 2) throw new Error('package mirror schema must be 2');
  if (!data.sourceFamilies || !data.origins || !Array.isArray(data.adapters) || !Array.isArray(data.presets)) {
    throw new Error('package mirror rules are incomplete');
  }
  return data;
}

export function normalizePackageMirrorId(rules, value) {
  const raw = String(value || 'source-default').trim().toLowerCase();
  return String(rules.aliases?.[raw] || raw);
}

function presetMap(rules) {
  return new Map(rules.presets.map((preset) => [preset.id, preset]));
}

function collectAdapterFiles(root, rules) {
  const rows = [];
  for (const adapter of rules.adapters) {
    for (const path of adapter.paths || []) {
      if (!safeRelativePath(path)) throw new Error(`unsafe adapter path: ${path}`);
      const absolute = join(root, ...path.split('/'));
      if (!existsSync(absolute)) continue;
      rows.push({ adapter: adapter.id, manager: adapter.manager || '', path, absolute });
    }
  }
  return rows;
}

function familyOrigins(rules, family) {
  return (rules.origins?.[family] || []).map(normalizeRoot).filter(Boolean);
}

function familyMirrorRoots(rules, family) {
  return rules.presets.flatMap((preset) => preset.roots?.[family] ? [normalizeRoot(preset.roots[family])] : []);
}

function knownFamilyRoots(rules, family) {
  return [...new Set([...familyOrigins(rules, family), ...familyMirrorRoots(rules, family)])];
}

function configuredVersionRepository(root) {
  const path = join(root, '.config');
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf8').match(/^CONFIG_VERSION_REPO="([^"]+)"$/m)?.[1] || '';
}

function detectFamilyFromText(rules, text) {
  const matches = new Set();
  for (const [family, origins] of Object.entries(rules.origins || {})) {
    if (origins.some((origin) => normalizedOriginVariants(origin).some((variant) => text.includes(variant)))) {
      matches.add(family);
    }
  }
  return matches;
}

export function detectSourceFamily(root, rules, sourceId) {
  const declared = String(rules.sourceFamilies?.[sourceId] || '');
  const detected = new Set();
  for (const file of collectAdapterFiles(root, rules)) {
    const text = readFileSync(file.absolute, 'utf8');
    for (const family of detectFamilyFromText(rules, text)) detected.add(family);
  }
  if (detected.size === 1) return { family: [...detected][0], declared, detected: [...detected] };
  if (declared && detected.has(declared)) return { family: declared, declared, detected: [...detected] };
  if (declared) return { family: declared, declared, detected: [...detected] };
  if (detected.size) return { family: [...detected][0], declared, detected: [...detected] };
  throw new Error(`no package mirror family for source: ${sourceId}`);
}

export function detectPackageManagers(root, rules) {
  const configPath = join(root, ...String(rules.managerDetection?.configPath || '.config').split('/'));
  const capabilityPaths = rules.managerDetection?.capabilityPaths || [
    rules.managerDetection?.capabilityPath || 'package/base-files/Makefile',
  ];
  const capabilityFiles = capabilityPaths.map((path) =>
    join(root, ...String(path).split('/'))).filter(existsSync);
  const capabilityMarkers = rules.managerDetection?.markers || {
    apk: ['FeedSourcesAppendAPK'],
    opkg: ['FeedSourcesAppendOPKG'],
  };
  const symbol = String(rules.managerDetection?.apkSymbol || 'CONFIG_USE_APK');
  let effective = 'unknown';
  let configEvidence = 'missing';
  if (existsSync(configPath)) {
    const config = readFileSync(configPath, 'utf8');
    const escaped = escapeRegExp(symbol);
    if (new RegExp(`^${escaped}=y$`, 'm').test(config)) {
      effective = 'apk';
      configEvidence = 'enabled';
    } else if (new RegExp(`^# ${escaped} is not set$`, 'm').test(config) ||
        new RegExp(`^${escaped}=n$`, 'm').test(config)) {
      effective = 'opkg';
      configEvidence = 'disabled';
    } else {
      configEvidence = 'unspecified';
    }
  }
  const capabilityText = capabilityFiles.map((path) => readFileSync(path, 'utf8')).join('\n');
  const capabilities = Object.entries(capabilityMarkers)
    .filter(([, markers]) => Array.isArray(markers) && markers.some((marker) => capabilityText.includes(marker)))
    .map(([manager]) => manager)
    .sort();
  const adapterManagers = [...new Set(collectAdapterFiles(root, rules)
    .map((file) => file.manager).filter(Boolean))].sort();
  let packageManagers;
  if (effective !== 'unknown') packageManagers = [effective];
  else if (adapterManagers.length) packageManagers = adapterManagers;
  else if (capabilities.length === 1) packageManagers = [...capabilities];
  else packageManagers = ['unknown'];
  return {
    packageManagers,
    capabilities,
    adapterManagers,
    configEvidence,
  };
}

export function candidateMirrorIds(rules, requestedId, family) {
  const presets = presetMap(rules);
  const requested = normalizePackageMirrorId(rules, requestedId);
  if (!presets.has(requested)) throw new Error(`unknown package mirror preset: ${requestedId}`);
  let ids;
  if (requested === 'auto') ids = [...(rules.policies?.auto || [])];
  else if (requested === 'source-default') ids = ['source-default'];
  else ids = [requested, ...(rules.policies?.manualFailure || ['source-default'])];
  const unique = [];
  for (const id of ids) {
    if (unique.includes(id)) continue;
    const preset = presets.get(id);
    if (!preset) continue;
    if (id !== 'source-default' && id !== 'auto' && !preset.roots?.[family]) continue;
    unique.push(id);
  }
  if (!unique.includes('source-default')) unique.push('source-default');
  return unique;
}

function replaceFamilyOrigins(text, origins, targetRoot) {
  let output = text;
  let replacements = 0;
  for (const origin of origins) {
    const normalized = normalizeRoot(origin);
    const parsed = new URL(normalized);
    const hostAndPath = `${parsed.host}${parsed.pathname.replace(/\/$/, '')}`;
    const pattern = new RegExp(`https?:\\/\\/${escapeRegExp(hostAndPath)}(?=\\/|\\s|["')]|$)`, 'g');
    output = output.replace(pattern, () => {
      replacements++;
      return targetRoot;
    });
  }
  return { text: output, replacements };
}

function extractUrl(text, preferredRoot) {
  const urls = String(text).match(/https?:\/\/[A-Za-z0-9.-]+(?:\/[A-Za-z0-9._~%+@:=,-]+)*/g) || [];
  const normalized = normalizeRoot(preferredRoot);
  return urls.find((url) => normalizeRoot(url).startsWith(normalized)) || '';
}

function candidateStage(root, rules, family, preset) {
  const sourceDefault = preset.id === 'source-default';
  const targetRoot = sourceDefault
    ? familyOrigins(rules, family)[0]
    : normalizeRoot(preset.roots?.[family]);
  const replaceRoots = sourceDefault ? familyMirrorRoots(rules, family) : knownFamilyRoots(rules, family);
  const changed = [];
  const adapters = new Set();
  let alreadyApplied = false;
  let primaryUrl = '';
  for (const file of collectAdapterFiles(root, rules)) {
    const original = readFileSync(file.absolute, 'utf8');
    if (targetRoot && original.includes(targetRoot)) alreadyApplied = true;
    const replacement = replaceFamilyOrigins(original, replaceRoots, targetRoot);
    if (replacement.replacements > 0 && replacement.text !== original) {
      changed.push({ ...file, original, next: replacement.text, mode: statSync(file.absolute).mode });
      adapters.add(file.adapter);
    }
    if (!primaryUrl && (file.path === '.config' || file.path === 'include/version.mk')) {
      primaryUrl = extractUrl(replacement.text, targetRoot);
    }
  }
  return {
    applicable: sourceDefault || changed.length > 0 || alreadyApplied,
    alreadyApplied: !sourceDefault && alreadyApplied && changed.length === 0,
    changed,
    adapters: [...adapters],
    probeUrls: [primaryUrl || targetRoot].filter(Boolean),
  };
}

async function defaultProbe(_id, urls, timeoutMs) {
  const attempts = [];
  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url.endsWith('/') ? url : `${url}/`, {
        method: 'GET',
        redirect: 'follow',
        headers: { Range: 'bytes=0-0', 'User-Agent': 'WeiG-OpenWrt-AutoBuild/package-mirror-probe' },
        signal: controller.signal,
      });
      attempts.push({ url, status: response.status, ok: response.ok });
      if (response.ok) return { ok: true, probes: attempts };
    } catch (error) {
      attempts.push({ url, status: 0, ok: false, error: error.name === 'AbortError' ? 'timeout' : error.message });
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, probes: attempts };
}

function commitChanges(changed) {
  const committed = [];
  try {
    for (const file of changed) {
      const temp = join(dirname(file.absolute), `.${basename(file.absolute)}.weig-mirror-${process.pid}`);
      writeFileSync(temp, file.next, 'utf8');
      chmodSync(temp, file.mode);
      renameSync(temp, file.absolute);
      committed.push(file);
    }
  } catch (error) {
    for (const file of committed.reverse()) writeFileSync(file.absolute, file.original, { encoding: 'utf8', mode: file.mode });
    throw error;
  } finally {
    for (const file of changed) {
      const temp = join(dirname(file.absolute), `.${basename(file.absolute)}.weig-mirror-${process.pid}`);
      try { unlinkSync(temp); } catch {}
    }
  }
}

export async function applyPackageMirror(options) {
  const root = resolve(options.root);
  const rules = options.rules;
  const source = String(options.source || '');
  const branch = String(options.branch || '');
  const requestedInput = String(options.requested || 'source-default');
  const requested = normalizePackageMirrorId(rules, requestedInput);
  const familyInfo = detectSourceFamily(root, rules, source);
  const managerInfo = detectPackageManagers(root, rules);
  const configuredRepo = configuredVersionRepository(root);
  const knownRoots = knownFamilyRoots(rules, familyInfo.family);
  const customRepository = configuredRepo && !knownRoots.some((item) =>
    configuredRepo === item || configuredRepo.startsWith(`${item}/`)) ? configuredRepo : '';
  if (customRepository) {
    return {
      schema: 1, requested, requestedInput, effective: 'custom', source, branch,
      family: familyInfo.family, familyDetection: { declared: familyInfo.declared, detected: familyInfo.detected },
      packageManagers: managerInfo.packageManagers,
      packageManagerCapabilities: managerInfo.capabilities,
      packageManagerAdapters: managerInfo.adapterManagers,
      packageManagerConfigEvidence: managerInfo.configEvidence,
      changedFiles: [], adapters: [],
      attempts: [{ id: requested, result: 'custom-source-preserved', probes: [] }],
      fallback: false, status: 'custom-source-preserved', customRepository,
    };
  }
  const candidates = candidateMirrorIds(rules, requested, familyInfo.family);
  const presets = presetMap(rules);
  const attempts = [];
  let effective = 'source-default';
  let changedFiles = [];
  let adapters = [];
  let status = 'source-default';
  let selectedIndex = candidates.length - 1;
  const probeCandidate = options.probeCandidate || ((id, urls) =>
    defaultProbe(id, urls, Number(rules.policies?.probeTimeoutMs || 15000)));

  for (let index = 0; index < candidates.length; index++) {
    const id = candidates[index];
    const preset = presets.get(id);
    const stage = candidateStage(root, rules, familyInfo.family, preset);
    if (id === 'source-default') {
      commitChanges(stage.changed);
      attempts.push({ id, result: stage.changed.length ? 'restored-source-default' : 'source-default', probes: [] });
      effective = id;
      selectedIndex = index;
      status = index === 0 ? 'source-default' : 'fallback-source-default';
      changedFiles = stage.changed.map((file) => file.path);
      adapters = stage.adapters;
      break;
    }
    if (!stage.applicable) {
      attempts.push({ id, result: 'not-applicable', probes: [] });
      continue;
    }
    const probe = await probeCandidate(id, stage.probeUrls);
    if (!probe?.ok) {
      attempts.push({ id, result: 'unavailable', probes: probe?.probes || [] });
      continue;
    }
    commitChanges(stage.changed);
    attempts.push({ id, result: stage.alreadyApplied ? 'already-applied' : 'applied', probes: probe.probes || [] });
    effective = id;
    selectedIndex = index;
    status = stage.alreadyApplied ? 'already-applied' : 'applied';
    changedFiles = stage.changed.map((file) => file.path);
    adapters = stage.adapters;
    break;
  }

  return {
    schema: 1,
    requested,
    requestedInput,
    effective,
    source,
    branch,
    family: familyInfo.family,
    familyDetection: {
      declared: familyInfo.declared,
      detected: familyInfo.detected,
    },
    packageManagers: managerInfo.packageManagers,
    packageManagerCapabilities: managerInfo.capabilities,
    packageManagerAdapters: managerInfo.adapterManagers,
    packageManagerConfigEvidence: managerInfo.configEvidence,
    changedFiles,
    adapters,
    attempts,
    fallback: selectedIndex > 0,
    status,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index++) {
    const item = argv[index];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) args[key] = true;
    else { args[key] = value; index++; }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const required = ['root', 'rules', 'source', 'branch', 'requested', 'report'];
  for (const key of required) if (!args[key]) throw new Error(`missing --${key}`);
  const rules = loadPackageMirrorRules(args.rules);
  let probeCandidate;
  if (args['probe-results']) {
    const results = JSON.parse(readFileSync(args['probe-results'], 'utf8'));
    probeCandidate = async (id, urls) => ({
      ok: results[id] === true,
      probes: urls.map((url) => ({ url, status: results[id] === true ? 200 : 503, ok: results[id] === true, fixture: true })),
    });
  }
  const report = await applyPackageMirror({
    root: args.root,
    rules,
    source: args.source,
    branch: args.branch,
    requested: args.requested,
    probeCandidate,
  });
  mkdirSync(dirname(resolve(args.report)), { recursive: true });
  writeFileSync(args.report, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`Requested mirror : ${report.requested}`);
  console.log(`Detected manager : ${report.packageManagers.join(', ')}`);
  console.log(`Selected mirror  : ${report.effective}`);
  console.log(`Fallback used    : ${report.fallback ? 'yes' : 'no'}`);
  console.log(`Changed files    : ${report.changedFiles.length ? report.changedFiles.join(', ') : '(none)'}`);
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(`package mirror engine failed: ${error.message}`);
    process.exit(1);
  });
}
