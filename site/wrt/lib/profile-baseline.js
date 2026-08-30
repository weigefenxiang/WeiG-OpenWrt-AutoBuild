const PROFILE_SCHEMA = 3;
const PROFILE_KIND = 'profile-baselines';
const PROFILE_ENCODING = 'branch-common-plus-exact-config-groups-v1';
const PROFILE_FIELDS = Object.freeze([
  'target', 'board', 'subtarget', 'profile', 'name', 'boardSelector', 'selector', 'targetSelector',
  'nativeHash', 'symbolCount', 'groupId',
]);
const STATE_GROUPS = Object.freeze(['n', 'm', 'y', 'otherIndexValue']);
const SYMBOL_RE = /^[A-Za-z0-9_+@./-]+$/;

function sameList(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length &&
    actual.every((value, index) => value === expected[index]);
}

function quote(value) {
  return `"${String(value ?? '').replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function validateIndex(index, symbolCount, scope) {
  if (!Number.isInteger(index) || index < 0 || index >= symbolCount) {
    throw new Error(`invalid Native Profile baseline ${scope} symbol index`);
  }
  return index;
}

function validateGrouped(groups, symbolCount, scope) {
  if (!Array.isArray(groups) || groups.length !== STATE_GROUPS.length ||
      groups.some((row) => !Array.isArray(row)) || groups[3].length % 2 !== 0) {
    throw new Error(`invalid Native Profile baseline ${scope} grouped state`);
  }
  for (let group = 0; group < 3; group += 1) {
    for (const index of groups[group]) validateIndex(index, symbolCount, scope);
  }
  for (let offset = 0; offset < groups[3].length; offset += 2) {
    validateIndex(groups[3][offset], symbolCount, scope);
    const value = String(groups[3][offset + 1] ?? '');
    if (!value || /[\r\n\0]/.test(value)) throw new Error(`invalid Native Profile baseline ${scope} scalar`);
  }
  return groups;
}

function applyGrouped(values, symbols, groups, scope) {
  validateGrouped(groups, symbols.length, scope);
  for (const index of groups[0]) values.set(symbols[index], 'n');
  for (const index of groups[1]) values.set(symbols[index], 'm');
  for (const index of groups[2]) values.set(symbols[index], 'y');
  for (let offset = 0; offset < groups[3].length; offset += 2) {
    values.set(symbols[groups[3][offset]], String(groups[3][offset + 1]));
  }
}

function identityKey(board, subtarget, profile) {
  return [board, subtarget, profile].map((value) => String(value || '').trim()).join('\0');
}

function rowObject(row) {
  return Object.fromEntries(PROFILE_FIELDS.map((field, index) => [field, row[index]]));
}

function pairsMap(rows, scope) {
  const result = new Map();
  for (const pair of rows || []) {
    if (!Array.isArray(pair) || pair.length !== 2) throw new Error(`invalid Native Profile baseline ${scope} row`);
    const key = String(pair[0] ?? '');
    if (!key || result.has(key) || !Array.isArray(pair[1])) throw new Error(`invalid Native Profile baseline ${scope} key`);
    const values = pair[1].map((entry) => {
      if (!Array.isArray(entry) || entry.length !== 2 || !SYMBOL_RE.test(String(entry[0] || '')) ||
          /[\r\n\0]/.test(String(entry[1] ?? ''))) {
        throw new Error(`invalid Native Profile baseline ${scope} override`);
      }
      return [String(entry[0]), String(entry[1])];
    });
    result.set(key, values);
  }
  return result;
}

function indexPairsMap(rows, scope, profileCount) {
  const result = new Map();
  for (const pair of rows || []) {
    if (!Array.isArray(pair) || pair.length !== 2 || !Number.isInteger(pair[0]) ||
        pair[0] < 0 || pair[0] >= profileCount || result.has(pair[0]) || !Array.isArray(pair[1])) {
      throw new Error(`invalid Native Profile baseline ${scope} row`);
    }
    const values = pair[1].map((entry) => {
      if (!Array.isArray(entry) || entry.length !== 2 || !SYMBOL_RE.test(String(entry[0] || '')) ||
          /[\r\n\0]/.test(String(entry[1] ?? ''))) {
        throw new Error(`invalid Native Profile baseline ${scope} override`);
      }
      return [String(entry[0]), String(entry[1])];
    });
    result.set(pair[0], values);
  }
  return result;
}

function aliasMap(rows, profileCount) {
  const result = new Map();
  for (const pair of rows || []) {
    if (!Array.isArray(pair) || pair.length !== 2 || !Number.isInteger(pair[0]) || !Number.isInteger(pair[1]) ||
        pair[0] < 0 || pair[0] >= profileCount || pair[1] < 0 || pair[1] >= profileCount || result.has(pair[0])) {
      throw new Error('invalid Native Profile baseline identity alias');
    }
    result.set(pair[0], pair[1]);
  }
  return result;
}

function buildIdentityTopology(profiles, fixedSymbols) {
  const boardSelectors = new Set(profiles.map((row) => String(row.boardSelector || '')).filter(Boolean));
  const targetSelectorsByBoard = new Map();
  const profileSelectorsByTarget = new Map();
  const identitySymbols = new Set(fixedSymbols);
  profiles.forEach((row) => {
    if (!targetSelectorsByBoard.has(row.board)) targetSelectorsByBoard.set(row.board, new Set());
    if (row.targetSelector) {
      targetSelectorsByBoard.get(row.board).add(row.targetSelector);
      identitySymbols.add(row.targetSelector);
    }
    if (!profileSelectorsByTarget.has(row.target)) profileSelectorsByTarget.set(row.target, new Set());
    if (row.selector) {
      profileSelectorsByTarget.get(row.target).add(row.selector);
      identitySymbols.add(row.selector);
    }
    if (row.boardSelector) identitySymbols.add(row.boardSelector);
  });
  return { profiles, boardSelectors, targetSelectorsByBoard, profileSelectorsByTarget, identitySymbols };
}

function deriveIdentityValues(topology, profileIndex, targetOverrides) {
  const row = topology.profiles[profileIndex];
  if (!row) throw new Error(`invalid Native Profile identity index: ${profileIndex}`);
  const values = new Map([
    ['TARGET_BOARD', quote(row.board)],
    ['TARGET_SUBTARGET', quote(row.subtarget)],
    ['TARGET_PROFILE', quote(row.profile)],
  ]);
  const selectors = new Set(topology.boardSelectors);
  for (const symbol of topology.targetSelectorsByBoard.get(row.board) || []) selectors.add(symbol);
  for (const symbol of topology.profileSelectorsByTarget.get(row.target) || []) selectors.add(symbol);
  for (const symbol of selectors) values.set(symbol, 'n');
  for (const symbol of [row.boardSelector, row.targetSelector, row.selector]) {
    if (symbol) values.set(symbol, 'y');
  }
  for (const [symbol, value] of targetOverrides.get(row.target) || []) values.set(symbol, value);
  return values;
}

function targetProfileCandidates(profile) {
  const value = String(profile || '').trim();
  if (!value) return [];
  if (value.startsWith('DEVICE_')) return [value, value.slice('DEVICE_'.length)];
  return [value, `DEVICE_${value}`];
}

export function validateProfileBaselineDocument(document, expected = {}) {
  if (!document || typeof document !== 'object' || Array.isArray(document) ||
      Number(document.schema) !== PROFILE_SCHEMA || document.kind !== PROFILE_KIND ||
      document.encoding !== PROFILE_ENCODING || !sameList(document.profileFields, PROFILE_FIELDS) ||
      !sameList(document.stateGroups, STATE_GROUPS) || !Array.isArray(document.symbols) ||
      !Array.isArray(document.common) || !Array.isArray(document.groups) || !Array.isArray(document.profiles) ||
      document.identity?.mode !== 'catalog-target-tree-v1' || !Array.isArray(document.identity?.fixed) ||
      !Array.isArray(document.identity?.targetOverrides) || !Array.isArray(document.identity?.aliases) ||
      !Array.isArray(document.identity?.overrides)) {
    throw new Error('invalid Native Profile baseline document');
  }
  const source = document.source || {};
  if (expected.sourceId && String(source.id || '') !== String(expected.sourceId)) {
    throw new Error('Native Profile baseline source identity mismatch');
  }
  if (expected.branch && String(source.branch || '') !== String(expected.branch)) {
    throw new Error('Native Profile baseline branch identity mismatch');
  }
  if (expected.commit && String(source.commit || '').toLowerCase() !== String(expected.commit).toLowerCase()) {
    throw new Error('Native Profile baseline source commit mismatch');
  }
  if (expected.schema && Number(expected.schema) !== PROFILE_SCHEMA) {
    throw new Error('Native Profile baseline index schema mismatch');
  }
  if (expected.encoding && String(expected.encoding) !== PROFILE_ENCODING) {
    throw new Error('Native Profile baseline index encoding mismatch');
  }
  if (expected.profiles && Number(expected.profiles) !== document.profiles.length) {
    throw new Error('Native Profile baseline Profile count mismatch');
  }
  if (expected.configGroups && Number(expected.configGroups) !== document.groups.length) {
    throw new Error('Native Profile baseline Config Group count mismatch');
  }
  if (Number(document.metrics?.reconstructionMismatches ?? -1) !== 0) {
    throw new Error('Native Profile baseline reconstruction parity is not clean');
  }
  return document;
}

export function createProfileBaselineStore(document, expected = {}) {
  validateProfileBaselineDocument(document, expected);
  const symbols = document.symbols.map((value) => String(value || '').trim());
  if (!symbols.length || symbols.some((symbol) => !SYMBOL_RE.test(symbol)) || new Set(symbols).size !== symbols.length) {
    throw new Error('invalid Native Profile baseline symbol dictionary');
  }
  const common = new Map();
  applyGrouped(common, symbols, document.common, 'common');
  const groups = document.groups.map((group, index) => {
    const values = new Map(common);
    applyGrouped(values, symbols, group, `group ${index}`);
    return values;
  });
  const profiles = document.profiles.map((row, index) => {
    if (!Array.isArray(row) || row.length !== PROFILE_FIELDS.length) {
      throw new Error(`invalid Native Profile baseline Profile row ${index}`);
    }
    const profile = rowObject(row);
    profile.index = index;
    profile.target = String(profile.target || '');
    profile.board = String(profile.board || '');
    profile.subtarget = String(profile.subtarget || '');
    profile.profile = String(profile.profile || '');
    profile.boardSelector = String(profile.boardSelector || '');
    profile.selector = String(profile.selector || '');
    profile.targetSelector = String(profile.targetSelector || '');
    profile.nativeHash = String(profile.nativeHash || '').toLowerCase();
    profile.symbolCount = Number(profile.symbolCount || 0);
    profile.groupId = Number(profile.groupId);
    if (!profile.target || !profile.board || !profile.profile || !/^[a-f0-9]{64}$/.test(profile.nativeHash) ||
        !Number.isSafeInteger(profile.symbolCount) || profile.symbolCount <= 0 ||
        !Number.isInteger(profile.groupId) || profile.groupId < 0 || profile.groupId >= groups.length) {
      throw new Error(`invalid Native Profile baseline Profile contract ${index}`);
    }
    return profile;
  });
  const fixed = document.identity.fixed.map(String);
  if (!fixed.includes('TARGET_BOARD') || !fixed.includes('TARGET_SUBTARGET') || !fixed.includes('TARGET_PROFILE')) {
    throw new Error('Native Profile baseline fixed identity contract is incomplete');
  }
  const topology = buildIdentityTopology(profiles, fixed);
  const targetOverrides = pairsMap(document.identity.targetOverrides, 'target identity');
  const aliases = aliasMap(document.identity.aliases, profiles.length);
  const overrides = indexPairsMap(document.identity.overrides, 'Profile identity', profiles.length);
  const bySelector = new Map();
  const byIdentity = new Map();
  for (const profile of profiles) {
    if (profile.selector) {
      if (bySelector.has(profile.selector)) throw new Error(`duplicate Native Profile selector: ${profile.selector}`);
      bySelector.set(profile.selector, profile.index);
    }
    const key = identityKey(profile.board, profile.subtarget, profile.profile);
    const indexes = byIdentity.get(key) || [];
    indexes.push(profile.index);
    byIdentity.set(key, indexes);
  }
  const cache = new Map();

  const resolveIndex = (target = {}) => {
    const selector = String(target.profileSelector || target.selector || '').trim();
    if (selector && bySelector.has(selector)) return bySelector.get(selector);
    const board = String(target.system || target.board || '').trim();
    const subtarget = String(target.subtarget || '').trim();
    for (const profile of targetProfileCandidates(target.profileSymbol || target.profile)) {
      const indexes = byIdentity.get(identityKey(board, subtarget, profile)) || [];
      if (indexes.length === 1) return indexes[0];
    }
    return -1;
  };

  const resolve = (target = {}) => {
    const index = resolveIndex(target);
    if (index < 0) return null;
    if (cache.has(index)) return cache.get(index);
    const profile = profiles[index];
    const values = new Map(groups[profile.groupId]);
    const identityValues = overrides.has(index)
      ? new Map(overrides.get(index))
      : deriveIdentityValues(topology, aliases.get(index) ?? index, targetOverrides);
    for (const [symbol, value] of identityValues) values.set(symbol, value);
    if (values.size !== profile.symbolCount) {
      throw new Error(`Native Profile baseline symbol count mismatch for ${profile.target}/${profile.profile}`);
    }
    const result = Object.freeze({
      ...profile,
      values,
      protectedSymbols: new Set(topology.identitySymbols),
    });
    cache.set(index, result);
    return result;
  };

  return Object.freeze({
    schema: document.schema,
    encoding: document.encoding,
    source: document.source || null,
    profiles: profiles.length,
    groups: groups.length,
    symbols: symbols.length,
    resolve,
  });
}

export function parseConfigMap(text) {
  const values = new Map();
  for (const line of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    let match = line.match(/^CONFIG_([A-Za-z0-9_+@./-]+)=(.*)$/);
    if (match) {
      if (!match[2] || /[\r\n\0]/.test(match[2])) throw new Error(`invalid Kconfig scalar for ${match[1]}`);
      values.set(match[1], match[2]);
      continue;
    }
    match = line.match(/^# CONFIG_([A-Za-z0-9_+@./-]+) is not set$/);
    if (match) values.set(match[1], 'n');
  }
  return values;
}

export function serializeConfigMap(input) {
  const values = input instanceof Map ? input : new Map(Object.entries(input || {}));
  const lines = [...values]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([symbol, raw]) => {
      if (!SYMBOL_RE.test(String(symbol || ''))) throw new Error(`invalid Kconfig symbol: ${symbol}`);
      const value = String(raw ?? '');
      if (!value || /[\r\n\0]/.test(value)) throw new Error(`invalid Kconfig value for ${symbol}`);
      return value === 'n' ? `# CONFIG_${symbol} is not set` : `CONFIG_${symbol}=${value}`;
    });
  return `${lines.join('\n')}\n`;
}

export function mergeConfigWithProfileBaseline(baseline, configText, { allowedSymbols = null } = {}) {
  if (!baseline?.values || !(baseline.values instanceof Map)) {
    throw new Error('Native Profile baseline is required');
  }
  const allowed = allowedSymbols instanceof Set ? allowedSymbols : new Set(allowedSymbols || []);
  const imported = parseConfigMap(configText);
  const values = new Map(baseline.values);
  const ignoredSymbols = [];
  for (const [symbol, value] of imported) {
    if (allowed.size && !allowed.has(symbol)) {
      ignoredSymbols.push(symbol);
      continue;
    }
    values.set(symbol, value);
  }
  return { values, ignoredSymbols };
}

export function diffProfileBaseline(baseline, finalValues, { allowedSymbols = null } = {}) {
  const base = baseline?.values instanceof Map ? baseline.values : new Map();
  const finalMap = finalValues instanceof Map ? finalValues : new Map(Object.entries(finalValues || {}));
  const protectedSymbols = baseline?.protectedSymbols instanceof Set ? baseline.protectedSymbols : new Set();
  const allowed = allowedSymbols instanceof Set ? allowedSymbols : new Set(allowedSymbols || []);
  const overrides = [];
  for (const symbol of [...new Set([...base.keys(), ...finalMap.keys()])].sort()) {
    const before = base.has(symbol) ? base.get(symbol) : null;
    const after = finalMap.has(symbol) ? finalMap.get(symbol) : null;
    if (before === after) continue;
    if (protectedSymbols.has(symbol)) throw new Error(`Target/Profile identity cannot be overridden: ${symbol}`);
    if (!base.has(symbol) && !allowed.has(symbol)) {
      throw new Error(`Kconfig symbol is outside the active Catalog: ${symbol}`);
    }
    if (after == null || !String(after) || /[\r\n\0]/.test(String(after))) {
      throw new Error(`invalid Kconfig override for ${symbol}`);
    }
    overrides.push([symbol, String(after)]);
  }
  return overrides;
}

export function applyProfileOverrides(baseline, overrides, { allowedSymbols = null } = {}) {
  if (!baseline?.values || !(baseline.values instanceof Map)) throw new Error('Native Profile baseline is required');
  if (!Array.isArray(overrides)) throw new Error('Kconfig overrides must be an array');
  const values = new Map(baseline.values);
  const allowed = allowedSymbols instanceof Set ? allowedSymbols : new Set(allowedSymbols || []);
  const seen = new Set();
  for (const pair of overrides) {
    if (!Array.isArray(pair) || pair.length !== 2) throw new Error('invalid Kconfig override row');
    const symbol = String(pair[0] || '');
    const value = String(pair[1] ?? '');
    if (!SYMBOL_RE.test(symbol) || seen.has(symbol) || !value || /[\r\n\0]/.test(value)) {
      throw new Error(`invalid Kconfig override: ${symbol || '(missing)'}`);
    }
    if (baseline.protectedSymbols?.has(symbol)) throw new Error(`Target/Profile identity cannot be overridden: ${symbol}`);
    if (!values.has(symbol) && !allowed.has(symbol)) {
      throw new Error(`Kconfig override is outside the active Catalog: ${symbol}`);
    }
    seen.add(symbol);
    values.set(symbol, value);
  }
  return values;
}
