const LEVEL = Object.freeze({ n: 0, m: 1, y: 2 });
const STATE = Object.freeze(['n', 'm', 'y']);
const UNKNOWN = -1;

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeValue(value) {
  const text = String(value ?? 'n');
  return Object.hasOwn(LEVEL, text) ? text : text;
}

export function resolveCatalogUserOverride(inheritedValue, requestedValue) {
  const inherited = normalizeValue(inheritedValue);
  const requested = normalizeValue(requestedValue);
  return requested === inherited ? null : requested;
}

function stateLevel(value) {
  return LEVEL[normalizeValue(value)] ?? (value ? 2 : 0);
}

function valuesMap(values) {
  if (values instanceof Map) return values;
  return new Map(Object.entries(values || {}));
}

function policyRank(value, rows = []) {
  const index = rows.indexOf(String(value || ''));
  return index < 0 ? rows.length : index;
}

export function orderCatalogIndex(index, policy = {}) {
  const sourcePriority = (policy.sourcePriority || []).map(String);
  const developmentBranches = (policy.developmentBranches?.length
    ? policy.developmentBranches : ['main', 'master']).map(String);
  const stableVersion = (name) => {
    const value = String(name || '').match(/^(?:openwrt-|v)?(\d+(?:\.\d+)*)$/i)?.[1];
    return value ? value.split('.').map(Number) : null;
  };
  const branchCompare = (left, right) => {
    const leftName = String(left?.branch || left?.id || '');
    const rightName = String(right?.branch || right?.id || '');
    const leftVersion = stableVersion(leftName);
    const rightVersion = stableVersion(rightName);
    if (leftVersion && rightVersion) {
      for (let index = 0; index < Math.max(leftVersion.length, rightVersion.length); index++) {
        const difference = (rightVersion[index] || 0) - (leftVersion[index] || 0);
        if (difference) return difference;
      }
    }
    if (Boolean(leftVersion) !== Boolean(rightVersion)) return leftVersion ? -1 : 1;
    const leftDevelopment = developmentBranches.indexOf(leftName);
    const rightDevelopment = developmentBranches.indexOf(rightName);
    if (leftDevelopment >= 0 || rightDevelopment >= 0) {
      if (leftDevelopment < 0) return 1;
      if (rightDevelopment < 0) return -1;
      if (leftDevelopment !== rightDevelopment) return leftDevelopment - rightDevelopment;
    }
    return leftName.localeCompare(rightName, undefined, { numeric: true });
  };
  const sources = (index?.sources || []).map((source) => ({
    ...source,
    branches: [...(source.branches || [])].sort(branchCompare),
  })).filter((source) => source.branches.length).sort((left, right) =>
    policyRank(left.id, sourcePriority) - policyRank(right.id, sourcePriority) ||
    String(left.id || '').localeCompare(String(right.id || '')));
  return { ...index, sources };
}

export function preferredCatalogTarget(catalog, preference = {}) {
  const selectors = catalog?.targetSelectors || [];
  const desired = preference.selectors || {};
  const find = (nodes, depth, values) => {
    const selector = selectors[depth];
    if (!selector) return values;
    const preferred = String(desired[selector.id] || '');
    const ordered = preferred
      ? [...(nodes || [])].sort((left, right) =>
        Number(String(right.value || '') === preferred) - Number(String(left.value || '') === preferred))
      : [...(nodes || [])];
    for (const node of ordered) {
      const result = find(node.children || [], depth + 1, { ...values, [selector.id]: node.value });
      if (result) return result;
    }
    return null;
  };
  return find(catalog?.targetTree || [], 0, {}) || {};
}

export function preferredCatalogSource(sources = [], candidates = []) {
  const available = new Set((sources || []).map((source) => String(source?.id || '')));
  return (candidates || []).map((value) => String(value || ''))
    .find((value) => available.has(value)) || '';
}

export function catalogTargetPreference({
  requestedTarget = null,
  currentTarget = null,
  stateTarget = null,
  policyTarget = {},
  newCatalogRequested = false,
  preferState = false,
} = {}) {
  if (preferState && stateTarget) return stateTarget;
  if (requestedTarget) return requestedTarget;
  if (newCatalogRequested) return policyTarget;
  if (currentTarget) return {};
  return stateTarget || policyTarget;
}

export function catalogFileNameTokenMatch(value, fileName, aliases = []) {
  const name = String(fileName || '').toLowerCase();
  return [value, ...(aliases || [])].filter(Boolean).some((candidate) => {
    const escaped = String(candidate).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i').test(name);
  });
}

export function resolvePackageMirrorSelection({
  timezone = '',
  availableIds = [],
  currentId = '',
  explicit = false,
  localTimezone = 'Asia/Shanghai',
  automaticId = 'auto',
  sourceDefaultId = 'source-default',
} = {}) {
  const available = unique((availableIds || []).map((value) => String(value || '')));
  const current = String(currentId || '');
  if (explicit && available.includes(current)) return current;
  const preferred = timezone === localTimezone ? automaticId : sourceDefaultId;
  return [preferred, sourceDefaultId, current, ...available]
    .find((value) => value && available.includes(value)) || current || sourceDefaultId;
}

function packageNameFromSymbol(symbol) {
  return String(symbol || '').startsWith('PACKAGE_') ? String(symbol).slice(8) : '';
}

function ruleParts(raw) {
  const match = String(raw || '').trim().match(/^([^\s]+)(?:\s+if\s+(.+))?$/);
  return match ? { symbol: match[1], condition: match[2] || '' } : { symbol: '', condition: '' };
}

const EXPRESSION_TOKEN_CACHE = new Map();
function expressionTokens(expression) {
  const source = String(expression || '');
  if (!EXPRESSION_TOKEN_CACHE.has(source)) {
    EXPRESSION_TOKEN_CACHE.set(source, source.match(/\|\||&&|!=|<=|>=|=|<|>|!|\(|\)|"(?:[^"\\]|\\.)*"|[A-Za-z0-9_+@./-]+/g) || []);
  }
  return EXPRESSION_TOKEN_CACHE.get(source);
}

function evaluateExpressionRaw(expression, inputValues, options = {}) {
  if (!expression) return 2;
  const values = valuesMap(inputValues);
  const tokens = expressionTokens(expression);
  let at = 0;
  const raw = (token) => {
    if (token === 'y' || token === 'm' || token === 'n') return token;
    if (/^".*"$/.test(token || '')) return token.slice(1, -1).replace(/\\"/g, '"');
    if (/^-?(?:0x[0-9a-f]+|\d+)$/i.test(token || '')) return token;
    if (values.has(token)) return normalizeValue(values.get(token));
    if (/^PACKAGE_/.test(token || '')) return 'n';
    if (/^TARGET_/.test(token || '')) return options.contextComplete ? 'n' : UNKNOWN;
    if (options.closedSymbols?.has?.(token)) return 'n';
    return UNKNOWN;
  };
  const asLevel = (value) => value === UNKNOWN ? UNKNOWN : stateLevel(value);
  const compare = (left, op, right) => {
    if (left === UNKNOWN || right === UNKNOWN) return UNKNOWN;
    if (op === '=') return left === right ? 2 : 0;
    if (op === '!=') return left !== right ? 2 : 0;
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    const numeric = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
    const a = numeric ? leftNumber : String(left);
    const b = numeric ? rightNumber : String(right);
    if (op === '<') return a < b ? 2 : 0;
    if (op === '>') return a > b ? 2 : 0;
    if (op === '<=') return a <= b ? 2 : 0;
    if (op === '>=') return a >= b ? 2 : 0;
    return 0;
  };
  const negate = (value) => value === UNKNOWN ? UNKNOWN : 2 - value;
  const intersect = (left, right) => {
    if (left === 0 || right === 0) return 0;
    if (left === UNKNOWN || right === UNKNOWN) return UNKNOWN;
    return Math.min(left, right);
  };
  const union = (left, right) => {
    if (left === 2 || right === 2) return 2;
    if (left === UNKNOWN || right === UNKNOWN) return UNKNOWN;
    return Math.max(left, right);
  };
  const primary = () => {
    if (tokens[at] === '(') {
      at++;
      const value = or();
      if (tokens[at] === ')') at++;
      return value;
    }
    const left = raw(tokens[at++] || 'n');
    if (['=', '!=', '<', '>', '<=', '>='].includes(tokens[at])) {
      const op = tokens[at++];
      const right = raw(tokens[at++] || 'n');
      return compare(left, op, right);
    }
    return asLevel(left);
  };
  const unary = () => tokens[at] === '!' ? (at++, negate(unary())) : primary();
  const and = () => {
    let value = unary();
    while (tokens[at] === '&&') { at++; value = intersect(value, unary()); }
    return value;
  };
  const or = () => {
    let value = and();
    while (tokens[at] === '||') { at++; value = union(value, and()); }
    return value;
  };
  return or();
}

export function evaluateExpressionState(expression, inputValues, options = {}) {
  const level = evaluateExpressionRaw(expression, inputValues, options);
  if (level === UNKNOWN) return { status: 'deferred', level: null };
  return { status: level > 0 ? 'satisfied' : 'unsatisfied', level };
}

export function evaluateExpression(expression, inputValues, options = {}) {
  const result = evaluateExpressionRaw(expression, inputValues, options);
  if (result !== UNKNOWN) return result;
  if (options?.unknown === 'deny') return 0;
  if (options?.unknown === 'module') return 1;
  if (options?.unknown === 'defer') return UNKNOWN;
  return 2;
}

function defaultParts(raw) {
  const source = String(raw || '').trim();
  let quoted = false;
  let escaped = false;
  let depth = 0;
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') { quoted = true; continue; }
    if (character === '(') { depth++; continue; }
    if (character === ')') { depth = Math.max(0, depth - 1); continue; }
    if (depth > 0 || !/\s/.test(character)) continue;
    const marker = source.slice(index).match(/^\s+if\s+/);
    if (!marker) continue;
    return {
      valueExpression: source.slice(0, index).trim(),
      condition: source.slice(index + marker[0].length).trim(),
    };
  }
  return { valueExpression: source, condition: '' };
}

function referencedExpressionSymbols(expression) {
  const comparisonOperators = new Set(['=', '!=', '<', '>', '<=', '>=']);
  const tokens = expressionTokens(expression);
  return tokens.filter((token, index) =>
    /^[A-Za-z_][A-Za-z0-9_+@./-]*$/.test(token) &&
    !Object.hasOwn(LEVEL, token) &&
    !comparisonOperators.has(tokens[index - 1]));
}

function nestedExpressionStrings(value) {
  if (typeof value === 'string') return [value];
  if (!Array.isArray(value)) return [];
  return value.flatMap(nestedExpressionStrings);
}

export function allowedKconfigStates(option = {}) {
  const type = String(option.type || '').toLowerCase();
  const typeStates = type === 'bool' ? ['n', 'y'] : type === 'tristate' ? STATE : [];
  if (!typeStates.length) return [];
  const declared = Array.isArray(option.states) && option.states.length
    ? new Set(option.states.map((value) => String(value).toLowerCase())) : new Set(typeStates);
  return typeStates.filter((value) => declared.has(value));
}

export function normalizeKconfigStateValue(option, value, fallback = 'n') {
  const allowed = allowedKconfigStates(option);
  const normalized = String(value ?? '').toLowerCase();
  if (allowed.includes(normalized)) return normalized;
  return allowed.includes(fallback) ? fallback : allowed[0] || 'n';
}

function scalarDefaultValue(valueExpression) {
  return String(valueExpression || '').trim().replace(/^"|"$/g, '');
}

export function resolveKconfigDefault(option = {}, inputValues = new Map(), options = {}) {
  const type = String(option.type || '').toLowerCase();
  const fallback = type === 'string' ? '' : 'n';
  for (const raw of option.defaults || []) {
    const { valueExpression, condition } = defaultParts(raw);
    if (!valueExpression) continue;
    const conditionState = evaluateExpressionRaw(condition, inputValues, options);
    if (conditionState === UNKNOWN) return { status: 'deferred', value: fallback };
    if (conditionState === 0) continue;
    if (type === 'bool' || type === 'tristate') {
      const level = evaluateExpressionRaw(valueExpression, inputValues, options);
      if (level === UNKNOWN) return { status: 'deferred', value: fallback };
      const resolved = type === 'bool' && level === 1 ? 'y' : STATE[level] || fallback;
      return { status: 'resolved', value: normalizeKconfigStateValue(option, resolved, fallback) };
    }
    return { status: 'resolved', value: scalarDefaultValue(valueExpression) };
  }
  return { status: 'fallback', value: fallback };
}

function compactStates(mask) {
  return ['n', 'm', 'y'].filter((_, index) => Number(mask || 0) & (1 << index));
}

export function expandCompactRelations(compact) {
  if (Number(compact?.schema || 0) !== 3) throw new Error('Catalog relations schema 3 is required');
  const strings = compact.strings || [];
  const expressions = compact.expressions || [];
  const stringLists = compact.stringLists || [];
  const expressionLists = compact.expressionLists || [];
  const variants = compact.expressionVariants || [];
  const flags = compact.flags || { visible: 1, userSettable: 2, canDisable: 4, hasKconfig: 8, package: 16 };
  const list = (id) => id < 0 ? [] : (stringLists[id] || []).map((item) => strings[item] || '');
  const expressionRows = (id) => id < 0 ? [] : (variants[id] || []).map((listId) =>
    (expressionLists[listId] || []).map((item) => expressions[item] || ''));
  const indexes = (rows) => Object.fromEntries((rows || []).map(([keyId, listId]) => [
    strings[keyId] || '', list(listId),
  ]));
  const records = (compact.records || []).map((row) => {
    const [symbolId, recordFlags, typeCode, originCode, statesMask, choiceId, defaultsId,
      dependsId, selectsId, impliesId, packageDependenciesId, providesId, conflictsId] = row;
    const symbol = strings[symbolId] || '';
    const isPackage = Boolean(recordFlags & flags.package);
    const hasKconfig = Boolean(recordFlags & flags.hasKconfig);
    const dependsExpressions = expressionRows(dependsId);
    const selectsExpressions = expressionRows(selectsId);
    const impliesExpressions = expressionRows(impliesId);
    const packageDepends = (compact.packageDependencies?.[packageDependenciesId] || []).map(
      ([required, conditionId, rawId, packagesId]) => ({
        raw: strings[rawId] || '',
        required: Boolean(required),
        condition: conditionId < 0 ? '' : expressions[conditionId] || '',
        packages: list(packagesId),
      }),
    );
    const defaults = (compact.defaults?.[defaultsId] || []).map(([valueId, conditionId]) => {
      const value = strings[valueId] || '';
      const condition = conditionId < 0 ? '' : expressions[conditionId] || '';
      return condition ? `${value} if ${condition}` : value;
    });
    const provides = list(providesId);
    const conflicts = list(conflictsId);
    return {
      kind: isPackage ? 'package' : 'config',
      package: isPackage && symbol.startsWith('PACKAGE_') ? symbol.slice(8) : '',
      configSymbol: symbol,
      kconfigSymbol: hasKconfig ? symbol : '',
      symbol: hasKconfig ? symbol : '',
      origin: compact.origins?.[originCode] || '',
      states: compactStates(statesMask),
      visible: Boolean(recordFlags & flags.visible),
      hidden: !(recordFlags & flags.visible),
      userSettable: Boolean(recordFlags & flags.userSettable),
      canDisable: Boolean(recordFlags & flags.canDisable),
      choice: choiceId < 0 ? '' : strings[choiceId] || '',
      type: compact.types?.[typeCode] || '',
      defaults,
      kconfig: { dependsExpressions, selectsExpressions, impliesExpressions },
      packageInfo: { depends: packageDepends, provides, conflicts },
      provides,
      conflicts,
    };
  });
  return {
    schema: 2,
    records,
    indexes: {
      providers: indexes(compact.indexes?.providers),
      reverseDependencies: indexes(compact.indexes?.reverseDependencies),
      reverseKconfig: indexes(compact.indexes?.reverseKconfig),
      choices: indexes(compact.indexes?.choices),
    },
    summary: compact.summary || {},
    validation: compact.validation || {},
  };
}

function normalizeRecord(record) {
  const configSymbol = record.configSymbol || record.symbol ||
    (record.package ? `PACKAGE_${record.package}` : '');
  const rawStates = Array.isArray(record.states) ? record.states : [];
  const type = String(record.type || (rawStates.includes('m') ? 'tristate' : rawStates.length ? 'bool' : ''))
    .toLowerCase();
  const dependsExpressions = record.kconfig?.dependsExpressions ||
    (record.kconfig?.dependsVariants || []).map((row) => row) || [];
  const selectsExpressions = record.kconfig?.selectsExpressions ||
    (record.kconfig?.selectsVariants || []).map((row) => row) || [];
  const impliesExpressions = record.kconfig?.impliesExpressions ||
    (record.kconfig?.impliesVariants || []).map((row) => row) || [];
  const packageDepends = record.packageInfo?.depends || (record.packageDepends || []).map((raw) => ({
    raw,
    required: String(raw).startsWith('+') || !String(raw).startsWith('@'),
    condition: '',
    packages: [String(raw).replace(/^\+/, '').split(':').at(-1).replace(/^PACKAGE_/, '')],
  }));
  return {
    ...record,
    kind: record.kind || (configSymbol.startsWith('PACKAGE_') ? 'package' : 'config'),
    package: record.package || packageNameFromSymbol(configSymbol),
    configSymbol,
    kconfigSymbol: record.kconfigSymbol || record.symbol || '',
    type,
    states: allowedKconfigStates({ type, states: rawStates }),
    visible: record.visible !== false,
    hidden: record.hidden === true || record.visible === false,
    userSettable: record.userSettable !== false && record.visible !== false,
    canDisable: record.canDisable !== false,
    kconfig: {
      ...(record.kconfig || {}),
      dependsExpressions,
      selectsExpressions,
      impliesExpressions,
    },
    packageInfo: {
      ...(record.packageInfo || {}),
      depends: packageDepends,
    },
  };
}

function normalizedFeatureKey(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function featureSymbolCandidates(feature, bySymbol) {
  const key = normalizedFeatureKey(feature);
  if (!key) return [];
  const candidates = [`${key}_SUPPORT`, `USES_${key}`, `HAS_${key}`, key];
  return unique(candidates.filter((symbol) => {
    const record = bySymbol.get(symbol);
    return record && record.kind !== 'package' && record.hidden;
  }));
}

export function createCatalogModel(catalog) {
  const schema = Number(catalog?.schema || 0);
  const relationsSchema = Number(catalog?.relations?.schema || 0);
  if (!catalog || schema < 5 || ![2, 3].includes(relationsSchema)) {
    throw new Error('Catalog schema 5+ / relations schema 2 or 3 is required');
  }
  const relations = relationsSchema === 3 ? expandCompactRelations(catalog.relations) : catalog.relations;
  const records = (relations.records || []).map(normalizeRecord);
  const bySymbol = new Map();
  const byPackage = new Map();
  for (const record of records) {
    if (record.configSymbol) bySymbol.set(record.configSymbol, record);
    if (record.package) byPackage.set(record.package, record);
  }
  const defaultReferences = new Set();
  const deferredReferences = new Set();
  for (const record of records) {
    for (const raw of record.defaults || []) {
      const { valueExpression, condition } = defaultParts(raw);
      if (record.type === 'bool' || record.type === 'tristate') {
        for (const symbol of [
          ...referencedExpressionSymbols(valueExpression),
          ...referencedExpressionSymbols(condition),
        ]) {
          defaultReferences.add(symbol);
        }
      }
    }
    for (const expression of nestedExpressionStrings(record.kconfig?.dependsExpressions || [])) {
      for (const symbol of referencedExpressionSymbols(expression)) deferredReferences.add(symbol);
    }
    for (const rows of [record.kconfig?.selectsExpressions, record.kconfig?.impliesExpressions]) {
      for (const raw of nestedExpressionStrings(rows || [])) {
        const { condition } = ruleParts(raw);
        for (const symbol of referencedExpressionSymbols(condition)) deferredReferences.add(symbol);
      }
    }
  }
  const closedDefaultSymbols = new Set([...defaultReferences].filter((symbol) =>
    !bySymbol.has(symbol) && !deferredReferences.has(symbol) && !/^TARGET_/.test(symbol)));
  const providers = new Map();
  for (const [name, rows] of Object.entries(relations.indexes?.providers || {})) providers.set(name, [...rows]);
  const reverseDependencies = new Map();
  for (const [name, rows] of Object.entries(relations.indexes?.reverseDependencies || {})) reverseDependencies.set(name, [...rows]);
  const reverseKconfig = new Map();
  for (const [symbol, rows] of Object.entries(relations.indexes?.reverseKconfig || {})) reverseKconfig.set(symbol, [...rows]);
  const reverseSelects = new Map();
  const reverseImplies = new Map();
  const indexRules = (index, source, rows) => {
    for (const raw of nestedExpressionStrings(rows || [])) {
      const target = ruleParts(raw).symbol;
      if (!target) continue;
      const sources = index.get(target) || [];
      if (!sources.includes(source)) sources.push(source);
      index.set(target, sources);
    }
  };
  for (const record of records) {
    indexRules(reverseSelects, record.configSymbol, record.kconfig?.selectsExpressions);
    indexRules(reverseImplies, record.configSymbol, record.kconfig?.impliesExpressions);
  }
  const choices = new Map();
  for (const [id, rows] of Object.entries(relations.indexes?.choices || {})) choices.set(id, [...rows]);
  const featureSymbols = new Map();
  const targetFeatureSymbols = new Set();
  const archSymbols = new Set();
  for (const target of catalog.targets || []) {
    const arch = String(target?.arch || '').trim();
    if (arch && bySymbol.has(arch)) archSymbols.add(arch);
    for (const feature of target?.features || []) {
      const key = String(feature || '').trim().toLowerCase();
      if (!key) continue;
      const symbols = featureSymbolCandidates(feature, bySymbol);
      if (!symbols.length) continue;
      featureSymbols.set(key, unique([...(featureSymbols.get(key) || []), ...symbols]));
      for (const symbol of symbols) targetFeatureSymbols.add(symbol);
    }
  }
  return {
    schema: 1,
    catalog,
    records,
    bySymbol,
    byPackage,
    providers,
    reverseDependencies,
    reverseKconfig,
    reverseSelects,
    reverseImplies,
    promptlessDefaultRecords: records.filter((record) =>
      record.hidden === true && record.userSettable === false && ['bool', 'tristate'].includes(record.type) &&
      Array.isArray(record.defaults) && record.defaults.length > 0),
    choices,
    featureSymbols,
    targetFeatureSymbols,
    archSymbols,
    closedDefaultSymbols,
  };
}

export function catalogPackageOperations(target, profile) {
  const raw = [
    ...(target?.packages || target?.targetPackages || []),
    ...(profile?.packages || profile?.profilePackages || target?.profilePackages || []),
  ].map((pkg) => String(pkg).trim()).filter(Boolean);
  const states = new Map();
  for (const token of raw) {
    const remove = token.startsWith('-');
    const name = token.replace(/^[+-]/, '').trim();
    if (name) states.set(name, remove ? 'remove' : 'add');
  }
  return {
    raw: [...new Set(raw)],
    add: [...states].filter(([, state]) => state === 'add').map(([name]) => name),
    remove: [...states].filter(([, state]) => state === 'remove').map(([name]) => name),
  };
}

export function resolveCatalogTargetContext(model, inputValues) {
  const values = valuesMap(inputValues);
  const catalog = model?.catalog || {};
  const board = String(values.get('TARGET_BOARD') || '').trim();
  const subtarget = String(values.get('TARGET_SUBTARGET') || '').trim();
  const profileValue = String(values.get('TARGET_PROFILE') || '').trim();
  const normalizedProfile = profileValue ? (profileValue.startsWith('DEVICE_') ? profileValue : `DEVICE_${profileValue}`) : '';
  let selectedTarget = null;
  let selectedProfile = null;
  if (board) {
    selectedTarget = (catalog.targets || []).find((target) => String(target.board || '') === board &&
      (!subtarget || String(target.subtarget || '') === subtarget)) || null;
    if (selectedTarget && normalizedProfile) {
      selectedProfile = (selectedTarget.profiles || []).find((profile) => String(profile.id || '') === normalizedProfile) || null;
    }
  }
  if (!selectedProfile) {
    for (const target of catalog.targets || []) {
      const profile = (target.profiles || []).find((candidate) => {
        const selector = String(candidate.selector || candidate.profileSelector || '').trim();
        return selector && stateLevel(values.get(selector) ?? 'n') > 0;
      });
      if (profile) { selectedTarget = target; selectedProfile = profile; break; }
    }
  }
  if (!selectedTarget) {
    selectedTarget = (catalog.targets || []).find((target) => {
      const selector = String(target.targetSelector || target.contract?.targetSelector || '').trim();
      return selector && stateLevel(values.get(selector) ?? 'n') > 0;
    }) || null;
  }
  if (!selectedTarget) return null;
  if (!selectedProfile && normalizedProfile) {
    selectedProfile = (selectedTarget.profiles || []).find((profile) => String(profile.id || '') === normalizedProfile) || null;
  }
  const targetSelector = String(selectedProfile?.targetSelector || selectedTarget.targetSelector || selectedTarget.contract?.targetSelector || '').trim();
  const boardSelector = String(selectedProfile?.boardSelector || selectedTarget.contract?.boardSelector ||
    (selectedTarget.board ? `TARGET_${selectedTarget.board}` : '')).trim();
  return {
    system: selectedTarget.board, board: selectedTarget.board, subtarget: selectedTarget.subtarget,
    arch: selectedTarget.arch, archPackages: selectedTarget.archPackages, features: [...(selectedTarget.features || [])],
    packages: [...(selectedTarget.packages || [])], boardSelector, targetSelector,
    profileSelector: String(selectedProfile?.selector || selectedProfile?.profileSelector || '').trim(),
    profileSymbol: String(selectedProfile?.id || normalizedProfile || '').trim(),
    profile: String(selectedProfile?.id || normalizedProfile || '').replace(/^DEVICE_/, ''),
    profilePackages: [...(selectedProfile?.packages || [])], rawTarget: selectedTarget, rawProfile: selectedProfile,
  };
}

export function createTargetContextValues(model, target, inputValues = new Map()) {
  const values = new Map(valuesMap(inputValues));
  const changes = [];
  const selected = target || {};
  const board = String(selected.boardSelector || (selected.system ? `TARGET_${selected.system}` : '')).trim();
  const targetSelector = String(selected.targetSelector ||
    (selected.system ? `TARGET_${selected.system}${selected.subtarget ? `_${selected.subtarget}` : ''}` : '')).trim();
  const profileId = String(selected.profileSymbol || selected.profile || '').trim();
  const profile = String(selected.profileSelector ||
    (targetSelector && profileId ? `${targetSelector}_${profileId.startsWith('DEVICE_') ? profileId : `DEVICE_${profileId}`}` : '')).trim();
  for (const symbol of model.archSymbols || []) {
    if (!values.has(symbol)) values.set(symbol, 'n'); else setValue(values, changes, symbol, 'n', 'target-context');
  }
  for (const symbol of model.targetFeatureSymbols || []) {
    if (!values.has(symbol)) values.set(symbol, 'n'); else setValue(values, changes, symbol, 'n', 'target-context');
  }
  const contextSymbols = [];
  for (const symbol of [board, targetSelector, profile].filter(Boolean)) {
    setValue(values, changes, symbol, 'y', 'target-context'); contextSymbols.push(symbol);
  }
  const arch = String(selected.arch || '').trim();
  if (arch) { setValue(values, changes, arch, 'y', 'target-context'); contextSymbols.push(arch); }
  for (const feature of selected.features || []) {
    for (const symbol of model.featureSymbols?.get(String(feature).trim().toLowerCase()) || []) {
      setValue(values, changes, symbol, 'y', 'target-context', String(feature)); contextSymbols.push(symbol);
    }
  }
  const strings = {
    TARGET_BOARD: selected.system || selected.board, TARGET_SUBTARGET: selected.subtarget,
    TARGET_PROFILE: profileId, TARGET_ARCH_PACKAGES: selected.archPackages,
    ARCH_PACKAGES: selected.archPackages, ARCH: arch,
  };
  for (const [symbol, value] of Object.entries(strings)) {
    if (String(value || '').trim()) setValue(values, changes, symbol, String(value).trim(), 'target-context');
  }
  for (const [symbol, value] of Object.entries(selected.extra || {})) {
    if (/^[A-Za-z0-9_+@./-]+$/.test(symbol) && String(value || '').trim()) {
      setValue(values, changes, symbol, String(value).trim(), 'target-context');
    }
  }
  cascadeEnabled(model, values, changes, unique(contextSymbols.filter((symbol) => model.bySymbol.has(symbol))));
  return { values, changes };
}

function targetContextComplete(target) {
  return Boolean(String(target?.system || target?.board || '').trim() && String(target?.subtarget || '').trim() &&
    String(target?.profileSymbol || target?.profile || '').trim());
}

export function createCatalogValidationContext(model, target, inputValues = new Map(), options = {}) {
  const phase = String(options.phase || 'interactive');
  const resolved = target || resolveCatalogTargetContext(model, inputValues);
  const context = resolved ? createTargetContextValues(model, resolved, inputValues) :
    { values: new Map(valuesMap(inputValues)), changes: [] };
  const trustedSymbols = new Set(options.trustedSymbols || []);
  if (resolved) {
    const operations = catalogPackageOperations(resolved, resolved.rawProfile || null);
    for (const packageName of operations.add) {
      const direct = model.byPackage.get(packageName);
      if (direct?.configSymbol) trustedSymbols.add(direct.configSymbol);
      for (const provider of model.providers.get(packageName) || []) {
        const record = model.byPackage.get(provider);
        if (record?.configSymbol && stateLevel(context.values.get(record.configSymbol) ?? 'n') > 0) trustedSymbols.add(record.configSymbol);
      }
    }
    for (const symbol of [resolved.boardSelector, resolved.targetSelector, resolved.profileSelector, resolved.arch].filter(Boolean)) {
      trustedSymbols.add(symbol);
    }
  }
  const contextComplete = options.contextComplete ?? targetContextComplete(resolved);
  const closedSymbols = new Set([...(model?.closedDefaultSymbols || []), ...(options.closedSymbols || [])]);
  return {
    target: resolved, values: context.values, changes: context.changes, trustedSymbols,
    validationOptions: { phase, contextComplete, trustedSymbols, closedSymbols,
      deferred: options.deferred || 'ignore' },
  };
}

export function parseConfigDocument(text) {
  const values = new Map();
  for (const line of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    let match = line.match(/^CONFIG_([A-Za-z0-9_+@.\/-]+)=(.*)$/);
    if (match) {
      const raw = match[2];
      values.set(match[1], raw === 'y' || raw === 'm' ? raw : raw.replace(/^"|"$/g, ''));
      continue;
    }
    match = line.match(/^# CONFIG_([A-Za-z0-9_+@.\/-]+) is not set$/);
    if (match) values.set(match[1], 'n');
  }
  return values;
}

function dependencyVariants(record) {
  const rows = record.kconfig?.dependsExpressions;
  if (!Array.isArray(rows) || !rows.length) return [[]];
  return rows.map((row) => Array.isArray(row) ? row : [row]);
}

function validationOptions(inputValues, options = {}) {
  const values = valuesMap(inputValues);
  const trustedSymbols = options.trustedSymbols instanceof Set ? options.trustedSymbols : new Set(options.trustedSymbols || []);
  const contextComplete = options.contextComplete ?? Boolean(String(values.get('TARGET_BOARD') || '').trim() &&
    String(values.get('TARGET_SUBTARGET') || '').trim() && String(values.get('TARGET_PROFILE') || '').trim());
  return {
    phase: String(options.phase || 'interactive'), contextComplete, trustedSymbols,
    explicitSymbols: options.explicitSymbols instanceof Set ? options.explicitSymbols : new Set(options.explicitSymbols || []),
    closedSymbols: options.closedSymbols instanceof Set ? options.closedSymbols : new Set(options.closedSymbols || []),
    deferred: options.deferred || 'ignore',
  };
}

function variantLevel(expressions, values, options) {
  let level = 2;
  let deferred = false;
  for (const expression of expressions) {
    const result = evaluateExpressionRaw(expression, values, options);
    if (result === 0) return { status: 'unsatisfied', level: 0 };
    if (result === UNKNOWN) deferred = true; else level = Math.min(level, result);
  }
  return deferred ? { status: 'deferred', level: null } : { status: 'satisfied', level };
}

function dependencyState(record, values, requestedLevel = null, options = {}) {
  const actual = requestedLevel ?? stateLevel(values.get(record.configSymbol) ?? 'n');
  const variants = dependencyVariants(record);
  const requirements = variants.map((expressions) => expressions.filter(Boolean));
  let maximum = 0;
  let deferred = false;
  for (const expressions of variants) {
    const result = variantLevel(expressions, values, options);
    if (result.status === 'satisfied') {
      const level = record.type === 'bool' && result.level === 1 ? 2 : result.level;
      maximum = Math.max(maximum, level);
      if (level >= actual) return { status: 'satisfied', maximum: level, requirements };
    } else if (result.status === 'deferred') deferred = true;
  }
  if (deferred) return { status: 'deferred', maximum, requirements };
  return { status: actual <= maximum ? 'satisfied' : 'unsatisfied', maximum, requirements };
}

function dependencyLevel(record, values, options = {}) {
  const result = dependencyState(record, values, 2, options);
  if (result.status === 'deferred') return UNKNOWN;
  return result.maximum;
}

function selectRequirement(target, selectorValue, conditionValue) {
  let level = Math.min(stateLevel(selectorValue), conditionValue);
  if (target?.type === 'bool' && level === 1) level = 2;
  return level;
}

function selectorCandidates(model, targetSymbol) {
  if (!model || !targetSymbol) return [];
  return [...(model.reverseSelects?.get(targetSymbol) || [])];
}

function activeSelectRequirements(model, record, values, options = {}) {
  const active = [];
  for (const sourceSymbol of selectorCandidates(model, record.configSymbol)) {
    const source = model.bySymbol.get(sourceSymbol);
    if (!source) continue;
    const sourceValue = normalizeValue(values.get(sourceSymbol) ?? 'n');
    if (stateLevel(sourceValue) === 0) continue;
    for (const raw of nestedExpressionStrings(source.kconfig?.selectsExpressions || [])) {
      const rule = ruleParts(raw);
      if (rule.symbol !== record.configSymbol) continue;
      const conditionLevel = evaluateExpressionRaw(rule.condition, values, options);
      if (conditionLevel === UNKNOWN || conditionLevel === 0) continue;
      const level = selectRequirement(record, sourceValue, conditionLevel);
      if (!level) continue;
      active.push({ sourceSymbol, sourceValue, condition: rule.condition,
        conditionLevel, level, value: STATE[level] });
    }
  }
  return active.sort((left, right) => right.level - left.level || left.sourceSymbol.localeCompare(right.sourceSymbol));
}

function activeImplyRequirements(model, record, values, options = {}) {
  const active = [];
  for (const sourceSymbol of model?.reverseImplies?.get(record.configSymbol) || []) {
    const source = model.bySymbol.get(sourceSymbol);
    const sourceValue = normalizeValue(values.get(sourceSymbol) ?? 'n');
    if (!source || stateLevel(sourceValue) === 0) continue;
    for (const raw of nestedExpressionStrings(source.kconfig?.impliesExpressions || [])) {
      const rule = ruleParts(raw);
      if (rule.symbol !== record.configSymbol) continue;
      const conditionLevel = evaluateExpressionRaw(rule.condition, values, options);
      if (conditionLevel === UNKNOWN || conditionLevel === 0) continue;
      const level = selectRequirement(record, sourceValue, conditionLevel);
      if (level) active.push({ sourceSymbol, sourceValue, condition: rule.condition,
        conditionLevel, level, value: STATE[level] });
    }
  }
  return active;
}

// OpenWrt's resolver suppresses an active reverse select only when the
// target's direct dependency (`dir_dep`) is N.  A non-zero dependency ceiling
// keeps the native reverse-select lower bound, even when that select drives a
// tristate target above the ceiling; that case is reported as a non-blocking
// Kconfig select diagnostic.  Keep this decision in one helper so interactive
// constraints, forward rule application, and reverse reconciliation agree.
function effectiveSelectRequirements(model, record, values, options = {}) {
  const selectors = activeSelectRequirements(model, record, values, options);
  if (!selectors.length) return selectors;
  const maximum = dependencyLevel(record, values, options);
  return maximum === 0 ? [] : selectors;
}

// Keep suppressed reverse-select provenance separate from validation.  A
// target with dir_dep=N is intentionally left at N, so it must not become a
// violation or a user-facing error; callers can still explain why the target
// did not follow its selector through this diagnostic channel.
function selectSuppressionDiagnostics(model, values, options = {}) {
  const diagnostics = [];
  for (const targetSymbol of model?.reverseSelects?.keys() || []) {
    const target = model.bySymbol.get(targetSymbol);
    if (!target) continue;
    if (dependencyLevel(target, values, options) !== 0) continue;
    const selectedBy = activeSelectRequirements(model, target, values, options);
    if (!selectedBy.length) continue;
    diagnostics.push({ code: 'kconfig-select-suppressed', target: targetSymbol,
      symbol: targetSymbol, package: target.package, dependencyMaximum: 0,
      blocking: false, selectedBy });
  }
  return diagnostics;
}

export function kconfigStateConstraints(model, record = {}, inputValues = new Map(), options = {}) {
  const values = valuesMap(inputValues);
  const normalizedOptions = validationOptions(values, options);
  const requestedSymbol = String(record.configSymbol || record.symbol || '').trim();
  const canonical = model?.bySymbol?.get(requestedSymbol) || record;
  const configSymbol = String(canonical.configSymbol || requestedSymbol).trim();
  const legalStates = allowedKconfigStates(canonical);
  const dependency = dependencyState(canonical, values, 2, normalizedOptions);
  const maximumLevel = dependency.status === 'deferred' ? 2 : dependency.maximum;
  const selectors = effectiveSelectRequirements(model, canonical, values, normalizedOptions);
  const minimumLevel = selectors.reduce((maximum, item) => Math.max(maximum, item.level), 0);
  const readOnly = canonical.userSettable === false;
  const directlySelectable = readOnly ? [] : legalStates.filter((value) => {
    const level = stateLevel(value);
    if (level < minimumLevel) return false;
    if (value === 'n') return canonical.canDisable !== false;
    if (minimumLevel === 2) return false;
    if (minimumLevel === 1 && maximumLevel <= 1) return false;
    return level <= maximumLevel;
  });
  const current = normalizeKconfigStateValue(canonical, values.get(configSymbol) ?? 'n');
  const states = legalStates.map((value) => {
    const level = stateLevel(value);
    let code = '';
    if (readOnly) code = 'not-user-settable';
    else if (level < minimumLevel) code = 'selected-lower-bound';
    else if (minimumLevel === 2 || (minimumLevel === 1 && maximumLevel <= 1)) code = 'selected-fixed';
    else if (value === 'n' && canonical.canDisable === false) code = 'cannot-disable';
    else if (level > maximumLevel) code = 'dependency-upper-bound';
    return { value, current: value === current, selectable: directlySelectable.includes(value),
      locked: value === current && !directlySelectable.includes(value) &&
        (readOnly || minimumLevel > 0 || record.canDisable === false), code };
  });
  return { symbol: configSymbol, current, legalStates, selectableStates: directlySelectable, readOnly,
    minimumLevel, minimum: STATE[minimumLevel], maximumLevel, maximum: STATE[maximumLevel],
    dependencyStatus: dependency.status, dependencyExpressions: dependency.requirements,
    selectors, states };
}

export function selectableKconfigStates(record = {}, inputValues = new Map(), options = {}) {
  return kconfigStateConstraints(options.model || null, record, inputValues, options).selectableStates;
}

function recordEnabled(record, values) { return stateLevel(values.get(record.configSymbol) ?? 'n') > 0; }
function recordInstalled(record, values) { return normalizeValue(values.get(record.configSymbol) ?? 'n') === 'y'; }

function enforceablePackage(model, name) {
  const direct = model.byPackage.get(name);
  if (direct?.kconfigSymbol || direct?.states?.length) return true;
  return (model.providers.get(name) || []).some((provider) => {
    const row = model.byPackage.get(provider); return Boolean(row?.kconfigSymbol || row?.states?.length);
  });
}

function packageSatisfied(model, name, values) {
  const direct = model.byPackage.get(name);
  if (direct && recordEnabled(direct, values)) return true;
  return (model.providers.get(name) || []).some((provider) => {
    const row = model.byPackage.get(provider); return row ? recordEnabled(row, values) : false;
  });
}

function packageDependencyViolations(model, record, values, options) {
  const violations = [];
  for (const dependency of record.packageInfo?.depends || []) {
    if (!dependency?.required || !dependency.packages?.length) continue;
    if (dependency.condition) {
      const condition = evaluateExpressionRaw(dependency.condition, values, options);
      if (condition === 0) continue;
      if (condition === UNKNOWN) {
        if (options.deferred !== 'ignore') violations.push({ code: 'package-dependency-deferred',
          symbol: record.configSymbol, package: record.package,
          dependency: dependency.raw || dependency.packages.join(' || '), packages: dependency.packages, deferred: true });
        continue;
      }
    }
    const enforceable = dependency.packages.filter((name) => enforceablePackage(model, name));
    if (!enforceable.length || dependency.packages.some((name) => packageSatisfied(model, name, values))) continue;
    violations.push({ code: 'package-dependency-unsatisfied', symbol: record.configSymbol, package: record.package,
      dependency: dependency.raw || dependency.packages.join(' || '), packages: dependency.packages });
  }
  return violations;
}

function isKconfigSelectWarning(item) {
  return item?.code === 'kconfig-select-warning' ||
    (item?.warning === true && item?.code === 'kconfig-dependency-unsatisfied' &&
      Array.isArray(item?.selectedBy) && item.selectedBy.length > 0);
}

function isBlockingViolation(item) {
  return !item?.deferred && !isKconfigSelectWarning(item);
}

function recordViolations(model, record, values, rawOptions = {}) {
  if (!recordEnabled(record, values)) return [];
  const options = validationOptions(values, rawOptions);
  if (options.trustedSymbols.has(record.configSymbol)) return [];
  const violations = [];
  const actual = stateLevel(values.get(record.configSymbol));
  const dependency = dependencyState(record, values, actual, options);
  if (dependency.status === 'unsatisfied') {
    // A non-zero direct dependency ceiling does not suppress a reverse
    // select.  If the active selector is what raised the target above that
    // ceiling, expose the native Kconfig warning without making it blocking.
    // A zero ceiling remains a hard direct-dependency violation; select is
    // fully suppressed in that case and must not turn the target into Y.
    const selectedBy = dependency.maximum > 0
      ? activeSelectRequirements(model, record, values, options)
        .filter((selector) => selector.level >= actual)
      : [];
    if (selectedBy.length) violations.push({ code: 'kconfig-select-warning', warning: true,
      symbol: record.configSymbol, package: record.package, actual, maximum: dependency.maximum,
      requirements: dependency.requirements, selectedBy });
    else violations.push({ code: 'kconfig-dependency-unsatisfied',
      symbol: record.configSymbol, package: record.package, actual, maximum: dependency.maximum,
      requirements: dependency.requirements });
  }
  else if (dependency.status === 'deferred' && options.deferred !== 'ignore') violations.push({
    code: 'kconfig-dependency-deferred', symbol: record.configSymbol, package: record.package,
    actual, maximum: dependency.maximum, requirements: dependency.requirements, deferred: true });
  violations.push(...packageDependencyViolations(model, record, values, options));
  return violations;
}

export function violationKey(item) {
  if (!item) return '';
  if (item.code === 'package-conflict') return `${item.code}:${[item.package, item.otherPackage].sort().join(':')}`;
  if (item.code === 'choice-conflict') return `${item.code}:${item.choice}:${[...(item.symbols || [])].sort().join(',')}`;
  return `${item.code}:${item.symbol || item.package || ''}:${item.dependency || ''}`;
}

function formatKconfigRequirements(requirements = []) {
  return requirements.map((group) => (group || []).filter(Boolean).join(' && ')).filter(Boolean).join(' || ');
}

export function validateConfig(model, inputValues, rawOptions = {}) {
  const values = valuesMap(inputValues);
  const options = validationOptions(values, rawOptions);
  const violations = [];
  for (const record of model.records) violations.push(...recordViolations(model, record, values, options));
  const conflictKeys = new Set();
  for (const record of model.records) {
    if (!recordEnabled(record, values)) continue;
    for (const otherName of record.conflicts || record.packageInfo?.conflicts || []) {
      if (!packageSatisfied(model, otherName, values)) continue;
      const pair = [record.package, otherName].sort();
      const key = pair.join('\0');
      if (conflictKeys.has(key)) continue;
      conflictKeys.add(key); violations.push({ code: 'package-conflict', package: pair[0], otherPackage: pair[1] });
    }
  }
  for (const [choice, symbols] of model.choices) {
    const selected = symbols.filter((symbol) => normalizeValue(values.get(symbol) ?? 'n') === 'y');
    const enabled = symbols.filter((symbol) => stateLevel(values.get(symbol) ?? 'n') > 0);
    if (selected.length > 1 || (selected.length === 1 && enabled.length > 1)) {
      violations.push({ code: 'choice-conflict', choice, symbols: enabled });
    }
  }
  return violations;
}

function setValue(values, changes, symbol, value, reason, source = '') {
  if (!symbol) return false;
  const next = normalizeValue(value);
  const previous = normalizeValue(values.get(symbol) ?? 'n');
  if (previous === next) return false;
  values.set(symbol, next); changes.push({ symbol, from: previous, to: next, reason, source }); return true;
}

function enabledState(record, requested) { return requested === 'm' && record?.states?.includes('m') ? 'm' : 'y'; }

function applyKconfigRules(model, record, requested, values, changes, options = {}) {
  for (const rows of record.kconfig?.selectsExpressions || []) {
    for (const raw of Array.isArray(rows) ? rows : [rows]) {
      const { symbol, condition } = ruleParts(raw);
      if (!symbol) continue;
      const conditionLevel = evaluateExpressionRaw(condition, values, options);
      if (conditionLevel === UNKNOWN || conditionLevel === 0) continue;
      const target = model.bySymbol.get(symbol);
      if (!target) continue;
      const requiredLevel = selectRequirement(target, requested, conditionLevel);
      // A reverse select cannot make a target with dir_dep=N active.  This is
      // deliberately a generic Kconfig rule; do not special-case package or
      // source names here.
      if (dependencyLevel(target, values, options) === 0) continue;
      if (stateLevel(values.get(symbol) ?? 'n') >= requiredLevel) continue;
      setValue(values, changes, symbol, STATE[requiredLevel], 'select', record.configSymbol);
    }
  }
}

function applyImplyRules(model, record, requested, values, changes, options = {}) {
  for (const raw of nestedExpressionStrings(record.kconfig?.impliesExpressions || [])) {
    const { symbol, condition } = ruleParts(raw);
    const target = model.bySymbol.get(symbol);
    if (!target || options.explicitSymbols?.has(symbol)) continue;
    const conditionLevel = evaluateExpressionRaw(condition, values, options);
    if (conditionLevel === UNKNOWN || conditionLevel === 0) continue;
    let requiredLevel = selectRequirement(target, requested, conditionLevel);
    const maximum = dependencyLevel(target, values, options);
    if (maximum !== UNKNOWN) requiredLevel = Math.min(requiredLevel, maximum);
    if (stateLevel(values.get(symbol) ?? 'n') >= requiredLevel) continue;
    setValue(values, changes, symbol, STATE[requiredLevel], 'imply', record.configSymbol);
  }
}

function splitTopLevelAnd(expression) {
  const text = String(expression || '').trim();
  const parts = [];
  let depth = 0, quoted = false, escaped = false, start = 0;
  for (let i = 0; i < text.length - 1; i++) {
    const char = text[i];
    if (quoted) {
      if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === '(') depth++; else if (char === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && char === '&' && text[i + 1] === '&') {
      parts.push(text.slice(start, i).trim()); start = i + 2; i++;
    }
  }
  parts.push(text.slice(start).trim()); return parts.filter(Boolean);
}

function stripOuterParens(expression) {
  let text = String(expression || '').trim();
  while (text.startsWith('(') && text.endsWith(')')) {
    let depth = 0, wraps = true;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '(') depth++; else if (text[i] === ')') depth--;
      if (depth === 0 && i < text.length - 1) { wraps = false; break; }
    }
    if (!wraps) break;
    text = text.slice(1, -1).trim();
  }
  return text;
}

function simplePositivePackageSymbols(expression, values, options = {}) {
  const raw = String(expression || '').trim();
  if (!raw || evaluateExpressionRaw(raw, values, options) > 0) return [];
  const parts = splitTopLevelAnd(raw);
  if (!parts.length) return null;
  const packages = [];
  for (const rawPart of parts) {
    const item = stripOuterParens(rawPart);
    if (/^PACKAGE_[A-Za-z0-9_+@.-]+$/.test(item)) packages.push(item);
    else if (evaluateExpressionRaw(item, values, options) !== 2) return null;
  }
  return packages.length ? unique(packages) : null;
}

function applyDirectKconfigDependencies(model, record, requested, values, changes, options = {}) {
  const current = dependencyState(record, values, stateLevel(requested), options);
  if (current.status === 'satisfied' || current.status === 'deferred') return;
  const plans = [];
  for (const variant of dependencyVariants(record)) {
    const symbols = [];
    let possible = true;
    for (const expression of variant) {
      const result = evaluateExpressionRaw(expression, values, options);
      if (result >= stateLevel(requested)) continue;
      if (result === UNKNOWN) { possible = false; break; }
      const direct = simplePositivePackageSymbols(expression, values, options);
      if (!direct) { possible = false; break; }
      symbols.push(...direct);
    }
    if (!possible) continue;
    const targets = unique(symbols).map((symbol) => model.bySymbol.get(symbol));
    if (targets.some((target) => !target?.states?.length)) continue;
    const cost = targets.filter((target) => stateLevel(values.get(target.configSymbol) ?? 'n') < stateLevel(requested)).length;
    plans.push({ targets, cost, key: targets.map((target) => target.configSymbol).sort().join('\0') });
  }
  plans.sort((a, b) => a.cost - b.cost || a.key.localeCompare(b.key));
  for (const target of plans[0]?.targets || []) setValue(values, changes, target.configSymbol,
    enabledState(target, requested), 'kconfig-dependency', record.configSymbol);
}

function applyDirectPackageDependencies(model, record, requested, values, changes, options = {}) {
  for (const dependency of record.packageInfo?.depends || []) {
    if (!dependency?.required || dependency.packages?.length !== 1) continue;
    if (dependency.condition && evaluateExpressionRaw(dependency.condition, values, options) !== 2) continue;
    const name = dependency.packages[0];
    if (packageSatisfied(model, name, values)) continue;
    const candidates = [model.byPackage.get(name), ...(model.providers.get(name) || []).map((provider) => model.byPackage.get(provider))]
      .filter((target) => target?.kconfigSymbol && target.states?.length);
    if (candidates.length !== 1) continue;
    const target = candidates[0];
    setValue(values, changes, target.configSymbol, enabledState(target, requested), 'package-dependency', record.configSymbol);
  }
}

function reverseCandidates(model, record) {
  const symbols = new Set([...(model.reverseKconfig.get(record.configSymbol) || []),
    ...(model.reverseSelects?.get(record.configSymbol) || [])]);
  for (const packageRow of model.reverseDependencies.get(record.package) || []) {
    const dependent = model.byPackage.get(packageRow); if (dependent?.configSymbol) symbols.add(dependent.configSymbol);
  }
  for (const provided of record.provides || []) {
    for (const packageRow of model.reverseDependencies.get(provided) || []) {
      const dependent = model.byPackage.get(packageRow); if (dependent?.configSymbol) symbols.add(dependent.configSymbol);
    }
  }
  return [...symbols];
}

function cascadeDisabled(model, values, changes, initialSymbols, options = {}) {
  const queue = [...initialSymbols];
  const visited = new Set();
  while (queue.length) {
    const symbol = queue.shift();
    if (visited.has(symbol)) continue;
    visited.add(symbol);
    const record = model.bySymbol.get(symbol);
    if (!record) continue;
    for (const candidateSymbol of reverseCandidates(model, record)) {
      const candidate = model.bySymbol.get(candidateSymbol);
      if (!candidate || !recordEnabled(candidate, values)) continue;
      const violations = recordViolations(model, candidate, values, options).filter(isBlockingViolation);
      if (!violations.length) continue;
      if (setValue(values, changes, candidate.configSymbol, 'n', 'dependency-unsatisfied', record.configSymbol)) queue.push(candidate.configSymbol);
    }
  }
}

function cascadeEnabled(model, values, changes, initialSymbols, options = {}) {
  const queue = [...initialSymbols];
  const visited = new Set();
  while (queue.length) {
    const symbol = queue.shift();
    if (visited.has(symbol)) continue;
    visited.add(symbol);
    const record = model.bySymbol.get(symbol);
    if (!record || !recordEnabled(record, values)) continue;
    const before = changes.length;
    const requested = normalizeValue(values.get(symbol));
    applyDirectKconfigDependencies(model, record, requested, values, changes, options);
    applyKconfigRules(model, record, requested, values, changes, options);
    applyImplyRules(model, record, requested, values, changes, options);
    applyDirectPackageDependencies(model, record, requested, values, changes, options);
    for (const change of changes.slice(before)) if (change.to !== 'n') queue.push(change.symbol);
  }
}

function activeSelectsSymbol(record, targetSymbol, values, options = {}) {
  for (const rows of record.kconfig?.selectsExpressions || []) {
    for (const raw of Array.isArray(rows) ? rows : [rows]) {
      const rule = ruleParts(raw);
      if (rule.symbol !== targetSymbol) continue;
      const conditionLevel = evaluateExpressionRaw(rule.condition, values, options);
      if (conditionLevel !== UNKNOWN && selectRequirement({ type: 'tristate' }, values.get(record.configSymbol) ?? 'n', conditionLevel) > 0) return true;
    }
  }
  return false;
}

function dependencyStillRequired(model, symbol, values, options = {}) {
  const record = model.bySymbol.get(symbol);
  if (!record) return false;
  const testValues = new Map(values); testValues.set(symbol, 'n');
  for (const candidateSymbol of reverseCandidates(model, record)) {
    const candidate = model.bySymbol.get(candidateSymbol);
    if (!candidate || !recordEnabled(candidate, values)) continue;
    if (activeSelectsSymbol(candidate, symbol, values, options)) return true;
    const before = new Set(recordViolations(model, candidate, values, options).filter(isBlockingViolation).map(violationKey));
    const after = recordViolations(model, candidate, testValues, options).filter(isBlockingViolation);
    if (after.some((item) => !before.has(violationKey(item)))) return true;
  }
  return false;
}

function pruneUnusedDependencies(model, values, changes, dependencySymbols, protectedSymbols, options = {}) {
  const candidates = new Set(dependencySymbols || []);
  const protectedSet = new Set(protectedSymbols || []);
  let progress = true;
  while (progress) {
    progress = false;
    for (const symbol of candidates) {
      if (protectedSet.has(symbol) || normalizeValue(values.get(symbol) ?? 'n') === 'n') continue;
      if (dependencyStillRequired(model, symbol, values, options)) continue;
      if (setValue(values, changes, symbol, 'n', 'dependency-unused')) progress = true;
    }
  }
}

function enforceActiveReverseRelations(model, values, changes, options = {}) {
  for (let pass = 0; pass < 64; pass++) {
    let progress = false;
    for (const targetSymbol of model.reverseSelects?.keys() || []) {
      const target = model.bySymbol.get(targetSymbol);
      if (!target) continue;
      const rawActive = activeSelectRequirements(model, target, values, options);
      const dependencyMaximum = dependencyLevel(target, values, options);
      if (dependencyMaximum === 0 && rawActive.length && targetSymbol !== options.intentSymbol &&
          stateLevel(values.get(targetSymbol) ?? 'n') > 0) {
        // A previously propagated select must be withdrawn when dir_dep falls
        // to N.  This is the reverse transition of the suppression rule above;
        // cascade its dependents so no stale selected chain survives.
        const source = rawActive[0]?.sourceSymbol || '';
        if (setValue(values, changes, targetSymbol, 'n', 'select-suppressed', source)) {
          cascadeDisabled(model, values, changes, [targetSymbol], options);
          progress = true;
        }
        continue;
      }
      const active = dependencyMaximum === 0 ? [] : rawActive;
      const minimum = active.reduce((level, item) => Math.max(level, item.level), 0);
      if (minimum > stateLevel(values.get(targetSymbol) ?? 'n')) {
        if (setValue(values, changes, targetSymbol, STATE[minimum], 'select',
          active.find((item) => item.level === minimum)?.sourceSymbol || '')) {
          cascadeEnabled(model, values, changes, [targetSymbol], options);
          progress = true;
        }
      }
    }
    for (const targetSymbol of model.reverseImplies?.keys() || []) {
      if (options.explicitSymbols?.has(targetSymbol)) continue;
      const target = model.bySymbol.get(targetSymbol);
      if (!target) continue;
      const active = activeImplyRequirements(model, target, values, options);
      let minimum = active.reduce((level, item) => Math.max(level, item.level), 0);
      const maximum = dependencyLevel(target, values, options);
      if (maximum !== UNKNOWN) minimum = Math.min(minimum, maximum);
      if (minimum > stateLevel(values.get(targetSymbol) ?? 'n')) {
        progress = setValue(values, changes, targetSymbol, STATE[minimum], 'imply',
          active.find((item) => item.level === minimum)?.sourceSymbol || '') || progress;
      }
    }
    if (!progress) return;
  }
  throw new Error('Kconfig reverse relation resolution did not converge');
}

function derivedDefaultState(model, record, values, options = {}) {
  const resolved = resolveKconfigDefault(record, values, options);
  if (resolved.status === 'deferred') return null;
  const dependencyMaximum = dependencyLevel(record, values, options);
  let defaultLevel = stateLevel(resolved.value);
  if (dependencyMaximum !== UNKNOWN) defaultLevel = Math.min(defaultLevel, dependencyMaximum);
  const selectors = effectiveSelectRequirements(model, record, values, options);
  const selectorLevel = selectors.reduce((maximum, item) => Math.max(maximum, item.level), 0);
  const implies = activeImplyRequirements(model, record, values, options);
  let implyLevel = implies.reduce((maximum, item) => Math.max(maximum, item.level), 0);
  if (dependencyMaximum !== UNKNOWN) implyLevel = Math.min(implyLevel, dependencyMaximum);
  let level = Math.max(defaultLevel, implyLevel, selectorLevel);
  if (record.type === 'bool' && level === 1) level = 2;
  const value = normalizeKconfigStateValue(record, STATE[level] || 'n');
  if (selectorLevel >= implyLevel && selectorLevel > defaultLevel) return { value, reason: 'select',
    source: selectors.find((item) => item.level === selectorLevel)?.sourceSymbol || '' };
  if (implyLevel > defaultLevel) return { value, reason: 'imply',
    source: implies.find((item) => item.level === implyLevel)?.sourceSymbol || '' };
  return { value, reason: 'conditional-default', source: '' };
}

function reconcileDerivedDefaults(model, values, changes, options = {}) {
  const records = model?.promptlessDefaultRecords || [];
  const derivedSymbols = new Set();
  const derivedReasons = new Map();
  for (let pass = 0; pass < 64; pass++) {
    const before = changes.length;
    const enabled = [], disabled = [];
    for (const record of records) {
      if (!record?.configSymbol || options.trustedSymbols?.has(record.configSymbol)) continue;
      const resolved = derivedDefaultState(model, record, values, options);
      if (!resolved) continue;
      derivedSymbols.add(record.configSymbol); derivedReasons.set(record.configSymbol, resolved.reason);
      if (!setValue(values, changes, record.configSymbol, resolved.value, resolved.reason, resolved.source)) continue;
      if (resolved.value === 'n') disabled.push(record.configSymbol); else enabled.push(record.configSymbol);
    }
    if (disabled.length) cascadeDisabled(model, values, changes, disabled, options);
    if (enabled.length) cascadeEnabled(model, values, changes, enabled, options);
    enforceActiveReverseRelations(model, values, changes, options);
    if (changes.length === before) return { derivedSymbols, derivedReasons };
  }
  throw new Error('Kconfig conditional default resolution did not converge');
}

function reconcileNonUserSettableDependents(model, values, changes, options = {}) {
  const start = changes.length;
  for (let pass = 0; pass < 64; pass++) {
    const disabled = [];
    for (const record of model?.records || []) {
      if (!record?.configSymbol || record.userSettable !== false || !recordEnabled(record, values) ||
          options.trustedSymbols?.has(record.configSymbol)) continue;
      const violations = recordViolations(model, record, values, options).filter((item) =>
        isBlockingViolation(item) && (item.code === 'kconfig-dependency-unsatisfied' ||
          item.code === 'package-dependency-unsatisfied'));
      if (!violations.length) continue;
      if (setValue(values, changes, record.configSymbol, 'n', 'dependency-unsatisfied',
        violations[0].dependency || '')) disabled.push(record.configSymbol);
    }
    if (!disabled.length) {
      return new Set(changes.slice(start)
        .filter((change) => change.to === 'n' && change.reason === 'dependency-unsatisfied')
        .map((change) => change.symbol));
    }
    cascadeDisabled(model, values, changes, disabled, options);
  }
  throw new Error('Kconfig derived dependency reconciliation did not converge');
}

export function reconcileKconfigDerivedValues(model, inputValues, rawOptions = {}) {
  const values = new Map(valuesMap(inputValues));
  const changes = [];
  const options = validationOptions(values, rawOptions);
  const reconciledSymbols = reconcileNonUserSettableDependents(model, values, changes, options);
  const derived = reconcileDerivedDefaults(model, values, changes, options);
  for (const symbol of reconciledSymbols) {
    derived.derivedSymbols.add(symbol);
    if (!derived.derivedReasons.has(symbol)) derived.derivedReasons.set(symbol, 'dependency-unsatisfied');
  }
  return { values, changes, ...derived, violations: validateConfig(model, values, options),
    diagnostics: selectSuppressionDiagnostics(model, values, options) };
}

function prerequisiteSymbols(model, record) {
  return unique(dependencyVariants(record).flatMap((group) => group.flatMap((expression) =>
    referencedExpressionSymbols(expression))))
    .filter((symbol) => symbol !== record.configSymbol && model?.bySymbol?.has(symbol));
}

function prerequisiteStateCandidates(model, symbol, inputValues, options = {}) {
  const record = model?.bySymbol?.get(symbol);
  if (!record || record.userSettable === false || options.explicitSymbols?.has(symbol)) return [];
  const constraints = kconfigStateConstraints(model, record, inputValues, options);
  const current = normalizeKconfigStateValue(record, inputValues.get(symbol) ?? 'n');
  return constraints.selectableStates.filter((value) => value !== current);
}

function prerequisitePlanReplay(model, inputValues, steps, target, intent, options) {
  let values = new Map(inputValues);
  const changes = [];
  for (const step of steps) {
    let result;
    try {
      result = applyUserIntent(model, values, {
        ...intent, symbol: step.symbol, value: step.value,
        skipPrerequisitePlanning: true,
      });
    } catch {
      return null;
    }
    values = result.values;
    changes.push(...result.changes);
  }
  let targetResult;
  try {
    targetResult = applyUserIntent(model, values, {
      ...intent, symbol: target.configSymbol, value: intent.value,
      skipPrerequisitePlanning: true,
    });
  } catch {
    return null;
  }
  values = targetResult.values;
  changes.push(...targetResult.changes);
  const baselineKeys = new Set(validateConfig(model, inputValues, options).map(violationKey));
  const newViolations = validateConfig(model, values, options)
    .filter((item) => isBlockingViolation(item) && !baselineKeys.has(violationKey(item)));
  if (newViolations.length) return null;
  const stepSymbols = new Set(steps.map((step) => step.symbol));
  return {
    steps,
    values,
    changes,
    automaticChanges: changes.filter((change) =>
      !stepSymbols.has(change.symbol) && change.symbol !== target.configSymbol),
  };
}

/**
 * Find the smallest legal Kconfig prerequisite sequence for a positive intent.
 * This is deliberately expression/model driven: no package, source, or branch
 * names are special-cased.  The search is bounded so a malformed or very large
 * expression remains an ordinary unsatisfied dependency instead of stalling UI.
 */
export function deriveKconfigPrerequisitePlans(model, inputValues, record, requestedValue, intent = {}) {
  const target = model?.bySymbol?.get(record?.configSymbol || record?.symbol) || record;
  const value = normalizeValue(requestedValue ?? intent.value ?? 'n');
  if (!target?.configSymbol || value === 'n' || !model?.bySymbol) return { candidates: [], recommended: null };
  const initialValues = new Map(valuesMap(inputValues));
  const options = validationOptions(initialValues, intent.validationOptions || {});
  const normalizedIntent = {
    ...intent,
    explicitSymbols: new Set(intent.explicitSymbols || options.explicitSymbols || []),
  };
  options.explicitSymbols = normalizedIntent.explicitSymbols;
  const requestedLevel = stateLevel(value);
  const initialDependency = dependencyState(target, initialValues, requestedLevel, options);
  if (initialDependency.status === 'satisfied') return { candidates: [], recommended: null };
  const symbols = prerequisiteSymbols(model, target);
  if (!symbols.length) return { candidates: [], recommended: null };

  const queue = [{ values: initialValues, steps: [], used: new Set() }];
  const visited = new Set();
  const candidates = [];
  const maxSteps = Math.min(6, Math.max(1, symbols.length));
  let visitedNodes = 0;
  while (queue.length && visitedNodes < 4096) {
    const node = queue.shift();
    visitedNodes += 1;
    const key = symbols.map((symbol) => normalizeValue(node.values.get(symbol) ?? 'n')).join('|');
    if (visited.has(key)) continue;
    visited.add(key);
    const dependency = dependencyState(target, node.values, requestedLevel, options);
    if (dependency.status === 'satisfied' && node.steps.length) {
      const replay = prerequisitePlanReplay(model, initialValues, node.steps, target, {
        ...normalizedIntent, value,
      }, options);
      if (replay) {
        candidates.push({
          ...replay,
          symbol: target.configSymbol,
          package: target.package || packageNameFromSymbol(target.configSymbol),
          value,
          cost: node.steps.length,
          key: node.steps.map((step) => `${step.symbol}=${step.value}`).join('\\0'),
        });
      }
      continue;
    }
    if (node.steps.length >= maxSteps || dependency.status === 'deferred') continue;
    for (const symbol of symbols) {
      if (node.used.has(symbol)) continue;
      for (const nextValue of prerequisiteStateCandidates(model, symbol, node.values, options)) {
        const values = new Map(node.values);
        values.set(symbol, nextValue);
        queue.push({
          values,
          steps: [...node.steps, {
            symbol,
            value: nextValue,
            package: model.bySymbol.get(symbol)?.package || packageNameFromSymbol(symbol),
          }],
          used: new Set([...node.used, symbol]),
        });
      }
    }
  }
  // The BFS can reach the same set of operations in more than one order. The
  // order is not a second user choice, so collapse those permutations before
  // deciding whether the minimum plan is unique. Keep the lexicographically
  // stable replay for deterministic UI output.
  const uniqueCandidates = new Map();
  for (const candidate of candidates) {
    const operationKey = candidate.steps.map((step) => `${step.symbol}=${step.value}`)
      .sort().join('\\0');
    const existing = uniqueCandidates.get(operationKey);
    if (!existing || candidate.key.localeCompare(existing.key) < 0) {
      uniqueCandidates.set(operationKey, candidate);
    }
  }
  const normalizedCandidates = [...uniqueCandidates.values()]
    .sort((left, right) => left.cost - right.cost || left.key.localeCompare(right.key));
  const minimum = normalizedCandidates[0]?.cost;
  const cheapest = normalizedCandidates.filter((candidate) => candidate.cost === minimum);
  return { candidates: normalizedCandidates, recommended: cheapest.length === 1 ? cheapest[0] : null };
}

export function applyUserIntent(model, inputValues, intent) {
  const initialValues = new Map(valuesMap(inputValues));
  const values = new Map(initialValues);
  const changes = [];
  const symbol = String(intent?.symbol || '');
  const value = normalizeValue(intent?.value ?? 'n');
  const record = model.bySymbol.get(symbol);
  if (!record) throw new Error(`Catalog does not define ${symbol}`);
  const options = validationOptions(initialValues, intent?.validationOptions || {});
  const normalizedIntent = {
    ...(intent || {}),
    explicitSymbols: new Set(intent?.explicitSymbols || options.explicitSymbols || []),
  };
  // Keep a direct positive intent from being silently normalized away by the
  // reverse-select suppression pass; it must reach validation and be rejected
  // for its own unsatisfied dependency.  State transitions on another symbol
  // (for example the dependency gate) remain free to lower the stale target.
  options.intentSymbol = symbol;
  options.explicitSymbols = normalizedIntent.explicitSymbols;
  const constraints = kconfigStateConstraints(model, record, initialValues, options);
  const legal = constraints.legalStates.includes(value);
  const alreadyRequested = value !== 'n' && legal && constraints.current === value &&
    constraints.dependencyStatus === 'satisfied' && record.userSettable !== false;
  const systemSelectable = legal && stateLevel(value) >= constraints.minimumLevel &&
    (value === 'n' ? record.canDisable !== false :
      (stateLevel(value) <= constraints.maximumLevel || stateLevel(value) <= constraints.minimumLevel));
  const repairablePositiveIntent = value !== 'n' && constraints.minimumLevel === 0 &&
    constraints.legalStates.includes(value) && record.userSettable !== false;
  const allowed = intent?.force === true ? systemSelectable :
    (constraints.selectableStates.includes(value) || repairablePositiveIntent || alreadyRequested);
  if (!allowed) {
    const prerequisitePlans = value !== 'n' && !intent?.skipPrerequisitePlanning
      ? deriveKconfigPrerequisitePlans(model, initialValues, record, value, normalizedIntent) : null;
    const requirement = formatKconfigRequirements(constraints.dependencyExpressions || []);
    const message = requirement ? `${symbol} requires ${requirement}` :
      `${symbol} cannot be set to ${value.toUpperCase()} under the active Kconfig constraints`;
    const error = new Error(message);
    error.name = 'CatalogIntentError'; error.intent = { symbol, value }; error.constraints = constraints;
    if (prerequisitePlans?.recommended) error.prerequisitePlans = prerequisitePlans;
    throw error;
  }
  const beforeKeys = new Set(validateConfig(model, initialValues, options).map(violationKey));
  setValue(values, changes, symbol, value, 'user');
  if (record.choice && value === 'y') {
    for (const sibling of model.choices.get(record.choice) || []) if (sibling !== symbol) setValue(values, changes, sibling, 'n', 'choice', symbol);
  } else if (record.choice && value === 'm') {
    for (const sibling of model.choices.get(record.choice) || []) {
      const siblingRecord = model.bySymbol.get(sibling);
      if (sibling !== symbol && normalizeValue(values.get(sibling) ?? 'n') === 'y' && siblingRecord?.states?.includes('m')) {
        setValue(values, changes, sibling, 'm', 'choice', symbol);
      }
    }
  }
  if (value === 'n') cascadeDisabled(model, values, changes, [symbol], options); else cascadeEnabled(model, values, changes, [symbol], options);
  if (changes.some((change) => change.to === 'n')) pruneUnusedDependencies(model, values, changes,
    intent?.dependencySymbols, intent?.protectedSymbols, options);
  enforceActiveReverseRelations(model, values, changes, options);
  const preferredValues = intent?.preferredValues instanceof Map ? intent.preferredValues :
    new Map(Object.entries(intent?.preferredValues || {}));
  let restored = true;
  for (let pass = 0; restored && pass < preferredValues.size + 1; pass++) {
    restored = false;
    for (const [preferredSymbol, rawPreferred] of preferredValues) {
      if (preferredSymbol === symbol || !model.bySymbol.has(preferredSymbol)) continue;
      const preferredRecord = model.bySymbol.get(preferredSymbol);
      if (!['bool', 'tristate'].includes(preferredRecord.type)) continue;
      const preferred = normalizeKconfigStateValue(preferredRecord, rawPreferred);
      const preferredConstraints = kconfigStateConstraints(model, preferredRecord, values, options);
      let effectiveLevel = Math.min(stateLevel(preferred), preferredConstraints.maximumLevel);
      if (!options.explicitSymbols.has(preferredSymbol)) {
        const impliedLevel = activeImplyRequirements(model, preferredRecord, values, options)
          .reduce((maximum, item) => Math.max(maximum, item.level), 0);
        effectiveLevel = Math.max(effectiveLevel, Math.min(impliedLevel, preferredConstraints.maximumLevel));
      }
      effectiveLevel = Math.max(effectiveLevel, preferredConstraints.minimumLevel);
      if (preferredRecord.choice && (model.choices.get(preferredRecord.choice) || []).some((sibling) =>
        sibling !== preferredSymbol && normalizeValue(values.get(sibling) ?? 'n') === 'y')) effectiveLevel = 0;
      if (preferredRecord.type === 'bool' && effectiveLevel === 1) effectiveLevel = 2;
      const effective = normalizeKconfigStateValue(preferredRecord, STATE[effectiveLevel]);
      if (normalizeValue(values.get(preferredSymbol) ?? 'n') === effective) continue;
      if (setValue(values, changes, preferredSymbol, effective, 'preferred-intent')) restored = true;
    }
  }
  const derivedStart = changes.length;
  let derived = reconcileDerivedDefaults(model, values, changes, options);
  if (changes.slice(derivedStart).some((change) => change.to === 'n')) {
    pruneUnusedDependencies(model, values, changes, intent?.dependencySymbols, intent?.protectedSymbols, options);
    derived = reconcileDerivedDefaults(model, values, changes, options);
  }
  const violations = validateConfig(model, values, options);
  const diagnostics = selectSuppressionDiagnostics(model, values, options);
  if (value !== 'n') {
    // A positive user intent must still be rejected when the requested symbol
    // was already present in an invalid imported state.  Comparing only with
    // beforeKeys would otherwise turn a direct re-selection of an unsatisfied
    // target into a silent no-op.  Reverse-select suppression never reaches
    // this branch for the selector/root: its selected target remains N.
    const blocking = violations.filter((item) => isBlockingViolation(item) &&
      (item.symbol === symbol || !beforeKeys.has(violationKey(item))));
    if (blocking.length) {
      const error = new Error(formatViolations(blocking)); error.name = 'CatalogIntentError';
      error.violations = blocking; error.intent = { symbol, value };
      error.diagnostics = diagnostics;
      error.warnings = violations.filter((item) => isKconfigSelectWarning(item) &&
        !beforeKeys.has(violationKey(item)));
      if (!intent?.skipPrerequisitePlanning && blocking.some((item) => item.code === 'kconfig-dependency-unsatisfied')) {
        const prerequisitePlans = deriveKconfigPrerequisitePlans(model, initialValues, record, value, normalizedIntent);
        if (prerequisitePlans?.recommended) error.prerequisitePlans = prerequisitePlans;
      }
      throw error;
    }
  }
  return { values, changes, ...derived, violations, diagnostics };
}

export function resolveEffectiveTheme(model, target, inputValues = new Map(), options = {}) {
  if (!model) return { package: '', symbol: '', value: 'n', values: new Map() };
  const context = createCatalogValidationContext(model, target, inputValues, { phase: options.phase || 'generation', deferred: 'ignore' });
  const values = new Map(context.values);
  const changes = [];
  const explicitSymbols = new Set(options.explicitSymbols || []);
  const operations = catalogPackageOperations(context.target || target, context.target?.rawProfile || null);
  for (const name of operations.remove) {
    const record = model.byPackage.get(name);
    if (record?.configSymbol && !explicitSymbols.has(record.configSymbol)) values.set(record.configSymbol, 'n');
  }
  for (const name of operations.add) {
    const record = model.byPackage.get(name);
    if (!record?.configSymbol || explicitSymbols.has(record.configSymbol)) continue;
    values.set(record.configSymbol, record.states?.includes('y') ? 'y' : (record.states?.includes('m') ? 'm' : 'n'));
  }
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const record of model.records || []) {
      if (!record.configSymbol || values.has(record.configSymbol)) continue;
      const resolved = resolveKconfigDefault(record, values, context.validationOptions);
      if (resolved.status !== 'resolved') continue;
      values.set(record.configSymbol, resolved.value); changed = true;
    }
    if (!changed) break;
  }
  cascadeEnabled(model, values, changes, (model.records || []).filter((record) => record.configSymbol && recordEnabled(record, values))
    .map((record) => record.configSymbol), context.validationOptions);
  for (const symbols of model.choices.values()) {
    const enabled = symbols.filter((symbol) => stateLevel(values.get(symbol) ?? 'n') > 0);
    if (enabled.length < 2) continue;
    const keep = enabled.find((symbol) => explicitSymbols.has(symbol)) || enabled[0];
    for (const symbol of enabled) if (symbol !== keep) values.set(symbol, 'n');
  }
  const themeRecords = (model.records || []).filter((record) => record.package?.startsWith('luci-theme-') && record.configSymbol);
  let candidates = themeRecords.filter((record) => stateLevel(values.get(record.configSymbol) ?? 'n') > 0);
  const preferredSymbol = String(options.preferredSymbol || '');
  let selected = candidates.find((record) => record.configSymbol === preferredSymbol) ||
    candidates.find((record) => explicitSymbols.has(record.configSymbol)) || candidates[0];
  let fallbackChanges = [];
  if (!selected) {
    for (const record of themeRecords) {
      if (explicitSymbols.has(record.configSymbol) && normalizeValue(values.get(record.configSymbol) ?? 'n') === 'n') continue;
      const selectable = record.userSettable === false ? [] : allowedKconfigStates(record).filter((value) => value !== 'n');
      const requested = selectable.includes('y') ? 'y' : selectable[0];
      if (!requested) continue;
      try {
        const result = applyUserIntent(model, values, { symbol: record.configSymbol, value: requested,
          dependencySymbols: new Set(), protectedSymbols: new Set([...explicitSymbols].filter((symbol) => stateLevel(values.get(symbol) ?? 'n') > 0)),
          validationOptions: context.validationOptions });
        if (stateLevel(result.values.get(record.configSymbol) ?? 'n') === 0) continue;
        values.clear(); for (const [symbol, value] of result.values) values.set(symbol, value);
        fallbackChanges = result.changes;
        candidates = themeRecords.filter((candidate) => stateLevel(values.get(candidate.configSymbol) ?? 'n') > 0);
        selected = candidates.find((candidate) => candidate.configSymbol === record.configSymbol) || candidates[0];
        if (selected) break;
      } catch (error) { /* try the next stable Catalog candidate */ }
    }
  }
  return { package: selected?.package || '', symbol: selected?.configSymbol || '',
    value: selected ? values.get(selected.configSymbol) : 'n', values, changes: fallbackChanges,
    candidates: candidates.map((record) => record.configSymbol), symbols: themeRecords.map((record) => record.configSymbol) };
}

const COMPATIBILITY_DOCUMENT_KEYS = new Set(['schema', 'rules']);
const COMPATIBILITY_RULE_KEYS_V2 = new Set(['id', 'issue', 'match', 'scope', 'if', 'packages', 'paths', 'refs']);
const COMPATIBILITY_RULE_KEYS_V3 = new Set([...COMPATIBILITY_RULE_KEYS_V2, 'sourceCommits', 'targetScope', 'failure']);
const COMPATIBILITY_TARGET_SCOPE_KEYS = new Set(['system', 'subtarget', 'profile']);
const COMPATIBILITY_FAILURE_KEYS = new Set(['phase', 'cause', 'code', 'observed']);
const COMPATIBILITY_ID_RE = /^[A-Z][A-Z0-9-]{2,31}$/;
const COMPATIBILITY_PACKAGE_RE = /^[A-Za-z0-9][A-Za-z0-9+_.@-]{0,95}$/;
const COMPATIBILITY_SOURCE_RE = /^(?:\*|[A-Za-z0-9_.-]{1,64})$/;
const COMPATIBILITY_BRANCH_RE = /^(?:[A-Za-z0-9._/-]{1,160}|[A-Za-z0-9._/-]*\*[A-Za-z0-9._/-]*)$/;
const COMPATIBILITY_COMMIT_RE = /^[a-f0-9]{40}$/;
const COMPATIBILITY_TARGET_RE = /^[A-Za-z0-9_+@./-]{1,160}$/;
const COMPATIBILITY_FAILURE_CODE_RE = /^[a-z][a-z0-9-]{2,95}$/;
const COMPATIBILITY_OBSERVED_KEY_RE = /^[A-Za-z][A-Za-z0-9]{0,63}$/;
const COMPATIBILITY_FAILURE_PHASES = new Set(['config-resolve', 'package-compile', 'rootfs-install', 'file-install', 'link', 'image-build']);
const COMPATIBILITY_FAILURE_CAUSES = new Set(['package-caused', 'dependency-caused', 'base-profile', 'infrastructure']);

function compatibilityError(message) {
  const error = new Error(message); error.name = 'CatalogCompatibilityError'; return error;
}
function compatibilityPatternMatches(value, pattern) {
  if (!pattern.includes('*')) return value === pattern;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(value);
}
function compatibilityObject(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function compatibilityKeys(value, allowed, label) {
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw compatibilityError(`${label} contains unsupported field: ${key}`);
}
function compatibilityStrings(value, label, pattern, min, max) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw compatibilityError(`${label} must contain ${min}-${max} entries`);
  const rows = value.map((item) => String(item || '').trim());
  if (rows.some((item) => !pattern.test(item)) || new Set(rows).size !== rows.length) throw compatibilityError(`${label} contains invalid or duplicate values`);
  return rows;
}

function normalizeCompatibilityTargetScope(value, label) {
  if (!compatibilityObject(value) || !Object.keys(value).length) throw compatibilityError(`${label} must be a non-empty object`);
  compatibilityKeys(value, COMPATIBILITY_TARGET_SCOPE_KEYS, label);
  const result = {};
  for (const key of COMPATIBILITY_TARGET_SCOPE_KEYS) {
    if (value[key] === undefined) continue;
    result[key] = compatibilityStrings(value[key], `${label}.${key}`, COMPATIBILITY_TARGET_RE, 1, 32);
  }
  if (!Object.keys(result).length) throw compatibilityError(`${label} must contain at least one target selector`);
  return result;
}

function normalizeCompatibilityObserved(value, label) {
  if (!compatibilityObject(value) || !Object.keys(value).length || Object.keys(value).length > 16) {
    throw compatibilityError(`${label} must contain 1-16 evidence fields`);
  }
  const result = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!COMPATIBILITY_OBSERVED_KEY_RE.test(key)) throw compatibilityError(`${label} contains an invalid evidence field`);
    if (typeof raw === 'string' && raw.trim() && raw.length <= 512) result[key] = raw.trim();
    else if (Array.isArray(raw)) {
      result[key] = compatibilityStrings(raw, `${label}.${key}`, /^[^\0\r\n]{1,256}$/, 1, 32);
    } else throw compatibilityError(`${label}.${key} must be a non-empty string or string array`);
  }
  return result;
}

function normalizeCompatibilityFailure(value, label) {
  if (!compatibilityObject(value)) throw compatibilityError(`${label} must be an object`);
  compatibilityKeys(value, COMPATIBILITY_FAILURE_KEYS, label);
  const phase = String(value.phase || ''), cause = String(value.cause || ''), code = String(value.code || '');
  if (!COMPATIBILITY_FAILURE_PHASES.has(phase)) throw compatibilityError(`${label}.phase is invalid`);
  if (!COMPATIBILITY_FAILURE_CAUSES.has(cause)) throw compatibilityError(`${label}.cause is invalid`);
  if (!COMPATIBILITY_FAILURE_CODE_RE.test(code)) throw compatibilityError(`${label}.code is invalid`);
  return { phase, cause, code,
    ...(value.observed === undefined ? {} : { observed: normalizeCompatibilityObserved(value.observed, `${label}.observed`) }) };
}

export function normalizeCompatibilityDocument(raw) {
  if (!compatibilityObject(raw)) throw compatibilityError('compatibility document must be an object');
  compatibilityKeys(raw, COMPATIBILITY_DOCUMENT_KEYS, 'compatibility document');
  const schema = Number(raw.schema);
  if (![2, 3].includes(schema) || !Array.isArray(raw.rules)) throw compatibilityError('compatibility document requires schema 2 or 3 and a rules array');
  if (new TextEncoder().encode(JSON.stringify(raw)).byteLength > 512 * 1024) throw compatibilityError('compatibility document is too large');
  const ids = new Set();
  const rules = raw.rules.map((rule, index) => {
    const label = `compatibility.rules[${index}]`;
    if (!compatibilityObject(rule)) throw compatibilityError(`${label} must be an object`);
    compatibilityKeys(rule, schema === 2 ? COMPATIBILITY_RULE_KEYS_V2 : COMPATIBILITY_RULE_KEYS_V3, label);
    const id = String(rule.id || '').trim();
    if (!COMPATIBILITY_ID_RE.test(id) || ids.has(id)) throw compatibilityError(`${label}.id is invalid or duplicate`);
    ids.add(id);
    const issue = rule.issue, match = rule.match;
    if (!['file-ownership', 'build-failure'].includes(issue)) throw compatibilityError(`${id}.issue is invalid`);
    if (!['all-installed', 'all-selected'].includes(match)) throw compatibilityError(`${id}.match is invalid`);
    if (!compatibilityObject(rule.scope) || !Object.keys(rule.scope).length) throw compatibilityError(`${id}.scope must be a non-empty object`);
    const scope = {};
    for (const [source, branches] of Object.entries(rule.scope)) {
      if (!COMPATIBILITY_SOURCE_RE.test(source)) throw compatibilityError(`${id}.scope source is invalid`);
      scope[source] = compatibilityStrings(branches, `${id}.scope.${source}`, COMPATIBILITY_BRANCH_RE, 1, 32);
    }
    if (Object.hasOwn(scope, '*') && Object.keys(scope).length !== 1) throw compatibilityError(`${id}.scope wildcard source cannot be mixed with named sources`);
    const condition = String(rule.if || '').trim();
    if (condition.length > 512) throw compatibilityError(`${id}.if is invalid`);
    const normalized = { id, issue, match, scope, ...(condition ? { if: condition } : {}),
      packages: compatibilityStrings(rule.packages, `${id}.packages`, COMPATIBILITY_PACKAGE_RE, 1, 16),
      refs: compatibilityStrings(rule.refs, `${id}.refs`, /^[A-Za-z0-9][A-Za-z0-9+_.:/@#-]{0,255}$/, 1, 8) };
    if (schema === 3 && rule.sourceCommits !== undefined) {
      normalized.sourceCommits = compatibilityStrings(rule.sourceCommits, `${id}.sourceCommits`, COMPATIBILITY_COMMIT_RE, 1, 32);
    }
    if (schema === 3 && rule.targetScope !== undefined) {
      normalized.targetScope = normalizeCompatibilityTargetScope(rule.targetScope, `${id}.targetScope`);
    }
    if (issue === 'file-ownership') normalized.paths = compatibilityStrings(rule.paths, `${id}.paths`,
      /^\/(?!.*(?:^|\/)\.\.(?:\/|$))[^\0\r\n]{1,255}$/, 1, 16);
    else if (rule.paths !== undefined) throw compatibilityError(`${id}.paths is only valid for file-ownership`);
    if (issue === 'file-ownership' && schema === 3 && rule.failure !== undefined) {
      throw compatibilityError(`${id}.failure is only valid for build-failure`);
    }
    if (issue === 'build-failure' && schema === 3) {
      normalized.failure = normalizeCompatibilityFailure(rule.failure, `${id}.failure`);
    }
    return normalized;
  });
  return { schema, rules };
}

function materializeCompatibilityDefaults(model, inputValues, options) {
  const values = new Map(valuesMap(inputValues));
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const record of model?.records || []) {
      if (!record.configSymbol || values.has(record.configSymbol)) continue;
      const resolved = resolveKconfigDefault(record, values, options);
      if (resolved.status !== 'resolved') continue;
      values.set(record.configSymbol, resolved.value); changed = true;
    }
    if (!changed) break;
  }
  return values;
}

function compatibilityRuleTriggered(rule, records, values, options) {
  if (rule.if) {
    const condition = evaluateExpressionState(rule.if, values, options);
    if (condition.status === 'deferred') throw compatibilityError(`${rule.id}.if cannot be resolved from the active Catalog`);
    if (condition.status !== 'satisfied') return false;
  }
  if (rule.match === 'all-installed') return records.every((record) => recordInstalled(record, values));
  return records.every((record) => ['m', 'y'].includes(normalizeValue(values.get(record.configSymbol) ?? 'n')));
}

export function evaluateCompatibilityRules(model, document, inputValues, context = {}) {
  if (!model?.byPackage) throw compatibilityError('Catalog model is unavailable');
  const normalized = normalizeCompatibilityDocument(document);
  const sourceId = String(context.sourceId || ''), branchName = String(context.branchName || '');
  const sourceCommit = String(context.sourceCommit || '').toLowerCase();
  const target = {
    system: String(context.targetSystem || ''),
    subtarget: String(context.targetSubtarget || ''),
    profile: String(context.targetProfile || ''),
  };
  const options = context.validationOptions || {};
  const values = materializeCompatibilityDefaults(model, inputValues, options);
  const warnings = [];
  for (const rule of normalized.rules) {
    const branchPatterns = rule.scope[sourceId] || rule.scope['*'] || [];
    if (!branchPatterns.some((pattern) => compatibilityPatternMatches(branchName, pattern))) continue;
    if (rule.sourceCommits && (!COMPATIBILITY_COMMIT_RE.test(sourceCommit) || !rule.sourceCommits.includes(sourceCommit))) continue;
    if (rule.targetScope && Object.entries(rule.targetScope).some(([key, values]) => !values.includes(target[key]))) continue;
    const records = rule.packages.map((packageName) => {
      const record = model.byPackage.get(packageName);
      if (!record?.configSymbol) throw compatibilityError(`${rule.id} references a package missing from the active Catalog: ${packageName}`);
      return record;
    });
    if (compatibilityRuleTriggered(rule, records, values, options)) warnings.push({ rule, records, values });
  }
  return { document: normalized, values, warnings };
}

function compatibilityPlanChanges(startingValues, resultValues, rawChanges) {
  const starting = valuesMap(startingValues);
  const final = valuesMap(resultValues);
  const last = new Map();
  for (const change of rawChanges || []) last.set(change.symbol, change);
  return [...last].map(([symbol, change]) => ({
    symbol,
    from: normalizeValue(starting.get(symbol) ?? 'n'),
    to: normalizeValue(final.get(symbol) ?? 'n'),
    reason: change.reason,
    source: change.source,
  })).filter((change) => change.from !== change.to);
}

function compatibilityDisablePlan(model, record, inputValues, intent = {}) {
  const startingValues = new Map(valuesMap(inputValues));
  let values = new Map(startingValues);
  const options = validationOptions(values, intent.validationOptions || {});
  const steps = [];
  const allChanges = [];
  const visiting = new Set();
  const protectedSymbols = new Set(intent.protectedSymbols || []);
  const preferredValues = intent.preferredValues instanceof Map
    ? new Map(intent.preferredValues) : new Map(Object.entries(intent.preferredValues || {}));
  const explicitSymbols = new Set(intent.explicitSymbols || []);
  options.explicitSymbols = explicitSymbols;

  const visit = (candidate) => {
    const symbol = String(candidate?.configSymbol || '');
    if (!symbol || normalizeValue(values.get(symbol) ?? 'n') === 'n') return true;
    if (candidate.canDisable === false || candidate.userSettable === false || visiting.has(symbol)) return false;
    visiting.add(symbol);

    for (let pass = 0; pass < 64 && normalizeValue(values.get(symbol) ?? 'n') !== 'n'; pass++) {
      const constraints = kconfigStateConstraints(model, candidate, values, options);
      if (constraints.selectableStates.includes('n')) break;
      const sourceSymbols = unique((constraints.selectors || []).map((selector) => selector.sourceSymbol));
      if (!sourceSymbols.length) {
        visiting.delete(symbol);
        return false;
      }
      let progressed = false;
      for (const sourceSymbol of sourceSymbols) {
        const source = model.bySymbol.get(sourceSymbol);
        const beforeSource = normalizeValue(values.get(sourceSymbol) ?? 'n');
        const beforeCandidate = normalizeValue(values.get(symbol) ?? 'n');
        if (!source || !visit(source)) {
          visiting.delete(symbol);
          return false;
        }
        if (normalizeValue(values.get(sourceSymbol) ?? 'n') !== beforeSource ||
            normalizeValue(values.get(symbol) ?? 'n') !== beforeCandidate) progressed = true;
        if (normalizeValue(values.get(symbol) ?? 'n') === 'n') break;
      }
      if (!progressed) {
        visiting.delete(symbol);
        return false;
      }
    }

    if (normalizeValue(values.get(symbol) ?? 'n') === 'n') {
      visiting.delete(symbol);
      return true;
    }
    const constraints = kconfigStateConstraints(model, candidate, values, options);
    if (!constraints.selectableStates.includes('n')) {
      visiting.delete(symbol);
      return false;
    }

    protectedSymbols.delete(symbol);
    preferredValues.set(symbol, 'n');
    explicitSymbols.add(symbol);
    const result = applyUserIntent(model, values, {
      ...intent,
      symbol,
      value: 'n',
      force: false,
      protectedSymbols,
      preferredValues,
      explicitSymbols,
    });
    values = result.values;
    allChanges.push(...result.changes);
    if (normalizeValue(values.get(symbol) ?? 'n') !== 'n') {
      visiting.delete(symbol);
      return false;
    }
    steps.push({ symbol, package: candidate.package || packageNameFromSymbol(symbol), value: 'n' });
    visiting.delete(symbol);
    return true;
  };

  if (!visit(record) || !steps.length) return null;
  return {
    steps,
    values,
    changes: compatibilityPlanChanges(startingValues, values, allChanges),
  };
}

export function deriveCompatibilityPlans(model, inputValues, warning, intent = {}) {
  const rule = warning?.rule;
  const records = warning?.records || [];
  const startingValues = warning?.values || inputValues;
  if (!rule || records.length < 1) throw compatibilityError('compatibility warning is incomplete');
  const candidates = [];
  for (const record of records) {
    if (!record.canDisable) continue;
    try {
      const plan = compatibilityDisablePlan(model, record, startingValues, intent);
      if (!plan?.steps.length) continue;
      const resolved = !compatibilityRuleTriggered(rule, records, plan.values, intent.validationOptions || {});
      if (!resolved) continue;
      const stepSymbols = new Set(plan.steps.map((step) => step.symbol));
      candidates.push({
        package: record.package,
        symbol: record.configSymbol,
        steps: plan.steps,
        changes: plan.changes,
        automaticChanges: plan.changes.filter((change) => !stepSymbols.has(change.symbol)),
        values: plan.values,
        cost: plan.steps.length,
      });
    } catch {
      // A participant that cannot produce a valid sequence through the shared Kconfig intent engine is not a candidate.
    }
  }
  candidates.sort((left, right) => left.cost - right.cost || left.package.localeCompare(right.package));
  const minimum = candidates[0]?.cost;
  const cheapest = candidates.filter((candidate) => candidate.cost === minimum);
  return { candidates, recommended: cheapest.length === 1 ? cheapest[0] : null };
}

export function compatibilityAcknowledgementKey({ sha256, dataRef, sourceId, branchName, sourceCommit = '', targetKey = '', revision, ruleIds } = {}) {
  const ids = Array.isArray(ruleIds) ? [...ruleIds].map(String).sort() : [];
  if (!/^[a-f0-9]{64}$/.test(String(sha256 || '')) ||
      !/^catalog-(?:fix(?:-[A-Za-z0-9][A-Za-z0-9._-]{0,95})?|dev|staging|main|data)$/.test(String(dataRef || '')) ||
      !COMPATIBILITY_SOURCE_RE.test(String(sourceId || '')) || !COMPATIBILITY_BRANCH_RE.test(String(branchName || '')) ||
      (sourceCommit && !COMPATIBILITY_COMMIT_RE.test(String(sourceCommit))) ||
      (targetKey && (String(targetKey).length > 512 || /[\0\r\n]/.test(String(targetKey)))) ||
      !Number.isSafeInteger(revision) || revision < 0 || !ids.length ||
      ids.some((id) => !COMPATIBILITY_ID_RE.test(id)) || new Set(ids).size !== ids.length) {
    throw compatibilityError('compatibility acknowledgement context is invalid');
  }
  return JSON.stringify([sha256, dataRef, sourceId, branchName, sourceCommit, targetKey, revision, ids]);
}

export function formatViolations(violations) {
  return (violations || []).map((item) => {
    if (item.code === 'kconfig-select-warning') {
      const selectors = (item.selectedBy || []).map((selector) => selector.sourceSymbol).filter(Boolean);
      const owner = selectors.length ? ` selected by ${selectors.join(', ')}` : '';
      const requirement = formatKconfigRequirements(item.requirements || []);
      return requirement ? `${item.symbol}${owner} requires ${requirement}` :
        `${item.symbol}${owner} has unsatisfied Kconfig dependencies`;
    }
    if (item.code === 'package-dependency-unsatisfied') return `${item.symbol} requires ${item.packages.join(' || ')}`;
    if (item.code === 'kconfig-dependency-unsatisfied') {
      const requirement = formatKconfigRequirements(item.requirements || []);
      return requirement ? `${item.symbol} requires ${requirement}` : `${item.symbol} has unsatisfied Kconfig dependencies`;
    }
    if (item.code === 'kconfig-dependency-deferred') {
      const requirement = formatKconfigRequirements(item.requirements || []);
      return requirement ? `${item.symbol} has deferred Kconfig dependency ${requirement}` : `${item.symbol} has deferred Kconfig dependencies`;
    }
    if (item.code === 'package-dependency-deferred') return `${item.symbol} has deferred package dependencies`;
    if (item.code === 'package-conflict') return `${item.package} conflicts with ${item.otherPackage}`;
    if (item.code === 'choice-conflict') return `${item.choice} enables multiple values: ${item.symbols.join(', ')}`;
    return item.code || 'catalog validation error';
  }).join('; ');
}

export { LEVEL, STATE };
export const DEPENDENCY_STATUS = Object.freeze({ SATISFIED: 'satisfied', UNSATISFIED: 'unsatisfied', DEFERRED: 'deferred' });
