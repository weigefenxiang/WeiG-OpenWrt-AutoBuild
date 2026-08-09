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

function stateLevel(value) {
  return LEVEL[normalizeValue(value)] ?? (value ? 2 : 0);
}

function valuesMap(values) {
  if (values instanceof Map) return values;
  return new Map(Object.entries(values || {}));
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
    // Packages are a closed world in a complete .config. Target selectors are only
    // closed after a Target/Profile context exists. Other missing hidden symbols are
    // deferred because upstream Target Devices/defaults are intentionally omitted.
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
      // Kconfig bool has no module state: an m-valued default expression is promoted to y.
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
        for (const symbol of referencedExpressionSymbols(valueExpression)) defaultReferences.add(symbol);
        for (const symbol of referencedExpressionSymbols(condition)) defaultReferences.add(symbol);
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
  for (const [name, rows] of Object.entries(relations.indexes?.providers || {})) {
    providers.set(name, [...rows]);
  }
  const reverseDependencies = new Map();
  for (const [name, rows] of Object.entries(relations.indexes?.reverseDependencies || {})) {
    reverseDependencies.set(name, [...rows]);
  }
  const reverseKconfig = new Map();
  for (const [symbol, rows] of Object.entries(relations.indexes?.reverseKconfig || {})) {
    reverseKconfig.set(symbol, [...rows]);
  }
  const choices = new Map();
  for (const [id, rows] of Object.entries(relations.indexes?.choices || {})) {
    choices.set(id, [...rows]);
  }
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
  const normalizedProfile = profileValue
    ? (profileValue.startsWith('DEVICE_') ? profileValue : `DEVICE_${profileValue}`)
    : '';
  let selectedTarget = null;
  let selectedProfile = null;

  if (board) {
    selectedTarget = (catalog.targets || []).find((target) =>
      String(target.board || '') === board &&
      (!subtarget || String(target.subtarget || '') === subtarget)) || null;
    if (selectedTarget && normalizedProfile) {
      selectedProfile = (selectedTarget.profiles || []).find((profile) =>
        String(profile.id || '') === normalizedProfile) || null;
    }
  }
  if (!selectedProfile) {
    for (const target of catalog.targets || []) {
      const profile = (target.profiles || []).find((candidate) => {
        const selector = String(candidate.selector || candidate.profileSelector || '').trim();
        return selector && stateLevel(values.get(selector) ?? 'n') > 0;
      });
      if (profile) {
        selectedTarget = target;
        selectedProfile = profile;
        break;
      }
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
    selectedProfile = (selectedTarget.profiles || []).find((profile) =>
      String(profile.id || '') === normalizedProfile) || null;
  }
  const targetSelector = String(selectedProfile?.targetSelector ||
    selectedTarget.targetSelector || selectedTarget.contract?.targetSelector || '').trim();
  const boardSelector = String(selectedProfile?.boardSelector ||
    selectedTarget.contract?.boardSelector || (selectedTarget.board ? `TARGET_${selectedTarget.board}` : '')).trim();
  return {
    system: selectedTarget.board,
    board: selectedTarget.board,
    subtarget: selectedTarget.subtarget,
    arch: selectedTarget.arch,
    archPackages: selectedTarget.archPackages,
    features: [...(selectedTarget.features || [])],
    packages: [...(selectedTarget.packages || [])],
    boardSelector,
    targetSelector,
    profileSelector: String(selectedProfile?.selector || selectedProfile?.profileSelector || '').trim(),
    profileSymbol: String(selectedProfile?.id || normalizedProfile || '').trim(),
    profile: String(selectedProfile?.id || normalizedProfile || '').replace(/^DEVICE_/, ''),
    profilePackages: [...(selectedProfile?.packages || [])],
    rawTarget: selectedTarget,
    rawProfile: selectedProfile,
  };
}

export function createTargetContextValues(model, target, inputValues = new Map()) {
  const values = new Map(valuesMap(inputValues));
  const changes = [];
  const selected = target || {};
  const board = String(selected.boardSelector ||
    (selected.system ? `TARGET_${selected.system}` : '')).trim();
  const targetSelector = String(selected.targetSelector ||
    (selected.system ? `TARGET_${selected.system}${selected.subtarget ? `_${selected.subtarget}` : ''}` : '')).trim();
  const profileId = String(selected.profileSymbol || selected.profile || '').trim();
  const profile = String(selected.profileSelector ||
    (targetSelector && profileId ? `${targetSelector}_${profileId.startsWith('DEVICE_') ? profileId : `DEVICE_${profileId}`}` : '')).trim();

  // Architecture and Target-Features are closed worlds in .targetinfo. Reset only
  // symbols that can be derived from the Catalog's complete target inventory.
  for (const symbol of model.archSymbols || []) {
    if (!values.has(symbol)) values.set(symbol, 'n');
    else setValue(values, changes, symbol, 'n', 'target-context');
  }
  for (const symbol of model.targetFeatureSymbols || []) {
    if (!values.has(symbol)) values.set(symbol, 'n');
    else setValue(values, changes, symbol, 'n', 'target-context');
  }

  const contextSymbols = [];
  for (const symbol of [board, targetSelector, profile].filter(Boolean)) {
    setValue(values, changes, symbol, 'y', 'target-context');
    contextSymbols.push(symbol);
  }
  const arch = String(selected.arch || '').trim();
  if (arch) {
    setValue(values, changes, arch, 'y', 'target-context');
    contextSymbols.push(arch);
  }
  for (const feature of selected.features || []) {
    for (const symbol of model.featureSymbols?.get(String(feature).trim().toLowerCase()) || []) {
      setValue(values, changes, symbol, 'y', 'target-context', String(feature));
      contextSymbols.push(symbol);
    }
  }
  const strings = {
    TARGET_BOARD: selected.system || selected.board,
    TARGET_SUBTARGET: selected.subtarget,
    TARGET_PROFILE: profileId,
    TARGET_ARCH_PACKAGES: selected.archPackages,
    ARCH_PACKAGES: selected.archPackages,
    ARCH: arch,
  };
  for (const [symbol, value] of Object.entries(strings)) {
    if (String(value || '').trim()) setValue(values, changes, symbol, String(value).trim(), 'target-context');
  }
  for (const [symbol, value] of Object.entries(selected.extra || {})) {
    if (/^[A-Za-z0-9_+@./-]+$/.test(symbol) && String(value || '').trim()) {
      setValue(values, changes, symbol, String(value).trim(), 'target-context');
    }
  }

  // Resolve transitive select rules such as x86_64 -> ARCH_64BIT and
  // PCI_SUPPORT -> AUDIO_SUPPORT using the same generic Catalog engine.
  cascadeEnabled(model, values, changes, unique(contextSymbols.filter((symbol) => model.bySymbol.has(symbol))));
  return { values, changes };
}

function targetContextComplete(target) {
  return Boolean(String(target?.system || target?.board || '').trim() &&
    String(target?.subtarget || '').trim() &&
    String(target?.profileSymbol || target?.profile || '').trim());
}

export function createCatalogValidationContext(model, target, inputValues = new Map(), options = {}) {
  const phase = String(options.phase || 'interactive');
  const resolved = target || resolveCatalogTargetContext(model, inputValues);
  const context = resolved
    ? createTargetContextValues(model, resolved, inputValues)
    : { values: new Map(valuesMap(inputValues)), changes: [] };
  const trustedSymbols = new Set(options.trustedSymbols || []);
  if (resolved) {
    const operations = catalogPackageOperations(resolved, resolved.rawProfile || null);
    for (const packageName of operations.add) {
      const direct = model.byPackage.get(packageName);
      if (direct?.configSymbol) trustedSymbols.add(direct.configSymbol);
      for (const provider of model.providers.get(packageName) || []) {
        const record = model.byPackage.get(provider);
        if (record?.configSymbol && stateLevel(context.values.get(record.configSymbol) ?? 'n') > 0) {
          trustedSymbols.add(record.configSymbol);
        }
      }
    }
    for (const symbol of [
      resolved.boardSelector,
      resolved.targetSelector,
      resolved.profileSelector,
      resolved.arch,
    ].filter(Boolean)) trustedSymbols.add(symbol);
  }
  const contextComplete = options.contextComplete ?? targetContextComplete(resolved);
  const closedSymbols = new Set([
    ...(model?.closedDefaultSymbols || []),
    ...(options.closedSymbols || []),
  ]);
  return {
    target: resolved,
    values: context.values,
    changes: context.changes,
    trustedSymbols,
    validationOptions: {
      phase,
      contextComplete,
      trustedSymbols,
      closedSymbols,
      deferred: options.deferred || 'ignore',
    },
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
  const trustedSymbols = options.trustedSymbols instanceof Set
    ? options.trustedSymbols : new Set(options.trustedSymbols || []);
  const contextComplete = options.contextComplete ?? Boolean(
    String(values.get('TARGET_BOARD') || '').trim() &&
    String(values.get('TARGET_SUBTARGET') || '').trim() &&
    String(values.get('TARGET_PROFILE') || '').trim());
  return {
    phase: String(options.phase || 'interactive'),
    contextComplete,
    trustedSymbols,
    closedSymbols: options.closedSymbols instanceof Set
      ? options.closedSymbols : new Set(options.closedSymbols || []),
    deferred: options.deferred || 'ignore',
  };
}

function variantLevel(expressions, values, options) {
  let level = 2;
  let deferred = false;
  for (const expression of expressions) {
    const result = evaluateExpressionRaw(expression, values, options);
    if (result === 0) return { status: 'unsatisfied', level: 0 };
    if (result === UNKNOWN) deferred = true;
    else level = Math.min(level, result);
  }
  return deferred ? { status: 'deferred', level: null } : { status: 'satisfied', level };
}

function dependencyState(record, values, requestedLevel = null, options = {}) {
  const actual = requestedLevel ?? stateLevel(values.get(record.configSymbol) ?? 'n');
  const variants = dependencyVariants(record);
  let maximum = 0;
  let deferred = false;
  for (const expressions of variants) {
    const result = variantLevel(expressions, values, options);
    if (result.status === 'satisfied') {
      // Native Kconfig promotes an m-valued direct dependency to y for bool symbols.
      const level = record.type === 'bool' && result.level === 1 ? 2 : result.level;
      maximum = Math.max(maximum, level);
      if (level >= actual) return { status: 'satisfied', maximum: level };
    } else if (result.status === 'deferred') {
      deferred = true;
    }
  }
  if (deferred) return { status: 'deferred', maximum };
  return { status: actual <= maximum ? 'satisfied' : 'unsatisfied', maximum };
}

function dependencyLevel(record, values, options = {}) {
  const result = dependencyState(record, values, 2, options);
  if (result.status === 'deferred') return UNKNOWN;
  return result.maximum;
}

export function selectableKconfigStates(record = {}, inputValues = new Map(), options = {}) {
  const values = valuesMap(inputValues);
  const normalizedOptions = validationOptions(values, options);
  return allowedKconfigStates(record).filter((value) => {
    if (value === 'n') return record.canDisable !== false;
    if (record.userSettable === false) return false;
    return dependencyState(record, values, stateLevel(value), normalizedOptions).status !== 'unsatisfied';
  });
}

function recordEnabled(record, values) {
  return stateLevel(values.get(record.configSymbol) ?? 'n') > 0;
}

function recordInstalled(record, values) {
  return normalizeValue(values.get(record.configSymbol) ?? 'n') === 'y';
}

function enforceablePackage(model, name) {
  const direct = model.byPackage.get(name);
  if (direct?.kconfigSymbol || direct?.states?.length) return true;
  return (model.providers.get(name) || []).some((provider) => {
    const row = model.byPackage.get(provider);
    return Boolean(row?.kconfigSymbol || row?.states?.length);
  });
}

function packageSatisfied(model, name, values) {
  const direct = model.byPackage.get(name);
  if (direct && recordEnabled(direct, values)) return true;
  return (model.providers.get(name) || []).some((provider) => {
    const row = model.byPackage.get(provider);
    return row ? recordEnabled(row, values) : false;
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
        if (options.deferred !== 'ignore') {
          violations.push({
            code: 'package-dependency-deferred',
            symbol: record.configSymbol,
            package: record.package,
            dependency: dependency.raw || dependency.packages.join(' || '),
            packages: dependency.packages,
            deferred: true,
          });
        }
        continue;
      }
    }
    const enforceable = dependency.packages.filter((name) => enforceablePackage(model, name));
    if (!enforceable.length) continue;
    if (dependency.packages.some((name) => packageSatisfied(model, name, values))) continue;
    violations.push({
      code: 'package-dependency-unsatisfied',
      symbol: record.configSymbol,
      package: record.package,
      dependency: dependency.raw || dependency.packages.join(' || '),
      packages: dependency.packages,
    });
  }
  return violations;
}

function recordViolations(model, record, values, rawOptions = {}) {
  if (!recordEnabled(record, values)) return [];
  const options = validationOptions(values, rawOptions);
  if (options.trustedSymbols.has(record.configSymbol)) return [];
  const violations = [];
  const actual = stateLevel(values.get(record.configSymbol));
  const dependency = dependencyState(record, values, actual, options);
  if (dependency.status === 'unsatisfied') {
    violations.push({
      code: 'kconfig-dependency-unsatisfied',
      symbol: record.configSymbol,
      package: record.package,
      actual,
      maximum: dependency.maximum,
    });
  } else if (dependency.status === 'deferred' && options.deferred !== 'ignore') {
    violations.push({
      code: 'kconfig-dependency-deferred',
      symbol: record.configSymbol,
      package: record.package,
      actual,
      maximum: dependency.maximum,
      deferred: true,
    });
  }
  violations.push(...packageDependencyViolations(model, record, values, options));
  return violations;
}

export function violationKey(item) {
  if (!item) return '';
  if (item.code === 'package-conflict') return `${item.code}:${[item.package, item.otherPackage].sort().join(':')}`;
  if (item.code === 'choice-conflict') return `${item.code}:${item.choice}:${[...(item.symbols || [])].sort().join(',')}`;
  return `${item.code}:${item.symbol || item.package || ''}:${item.dependency || ''}`;
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
      conflictKeys.add(key);
      violations.push({ code: 'package-conflict', package: pair[0], otherPackage: pair[1] });
    }
  }
  for (const [choice, symbols] of model.choices) {
    const enabled = symbols.filter((symbol) => stateLevel(values.get(symbol) ?? 'n') > 0);
    if (enabled.length > 1) violations.push({ code: 'choice-conflict', choice, symbols: enabled });
  }
  return violations;
}

function setValue(values, changes, symbol, value, reason, source = '') {
  if (!symbol) return false;
  const next = normalizeValue(value);
  const previous = normalizeValue(values.get(symbol) ?? 'n');
  if (previous === next) return false;
  values.set(symbol, next);
  changes.push({ symbol, from: previous, to: next, reason, source });
  return true;
}

function enabledState(record, requested) {
  if (requested === 'm' && record?.states?.includes('m')) return 'm';
  return 'y';
}

function applyKconfigRules(model, record, requested, values, changes, options = {}) {
  for (const rows of record.kconfig?.selectsExpressions || []) {
    for (const raw of Array.isArray(rows) ? rows : [rows]) {
      const { symbol, condition } = ruleParts(raw);
      if (!symbol || (condition && evaluateExpressionRaw(condition, values, options) !== 2)) continue;
      const target = model.bySymbol.get(symbol);
      if (!target) continue;
      setValue(values, changes, symbol, enabledState(target, requested), 'select', record.configSymbol);
    }
  }
}

function splitTopLevelAnd(expression) {
  const text = String(expression || '').trim();
  const parts = [];
  let depth = 0;
  let quoted = false;
  let escaped = false;
  let start = 0;
  for (let i = 0; i < text.length - 1; i++) {
    const char = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === '(') depth++;
    else if (char === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && char === '&' && text[i + 1] === '&') {
      parts.push(text.slice(start, i).trim());
      start = i + 2;
      i++;
    }
  }
  parts.push(text.slice(start).trim());
  return parts.filter(Boolean);
}

function stripOuterParens(expression) {
  let text = String(expression || '').trim();
  while (text.startsWith('(') && text.endsWith(')')) {
    let depth = 0;
    let wraps = true;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') depth--;
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
  for (const target of plans[0]?.targets || []) {
    setValue(values, changes, target.configSymbol, enabledState(target, requested),
      'kconfig-dependency', record.configSymbol);
  }
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
    setValue(values, changes, target.configSymbol, enabledState(target, requested),
      'package-dependency', record.configSymbol);
  }
}

function reverseCandidates(model, record) {
  const symbols = new Set(model.reverseKconfig.get(record.configSymbol) || []);
  for (const packageRow of model.reverseDependencies.get(record.package) || []) {
    const dependent = model.byPackage.get(packageRow);
    if (dependent?.configSymbol) symbols.add(dependent.configSymbol);
  }
  for (const provided of record.provides || []) {
    for (const packageRow of model.reverseDependencies.get(provided) || []) {
      const dependent = model.byPackage.get(packageRow);
      if (dependent?.configSymbol) symbols.add(dependent.configSymbol);
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
      const violations = recordViolations(model, candidate, values, options)
        .filter((item) => !item.deferred);
      if (!violations.length) continue;
      if (setValue(values, changes, candidate.configSymbol, 'n',
        'dependency-unsatisfied', record.configSymbol)) queue.push(candidate.configSymbol);
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
    applyDirectPackageDependencies(model, record, requested, values, changes, options);
    for (const change of changes.slice(before)) if (change.to !== 'n') queue.push(change.symbol);
  }
}

function activeSelectsSymbol(record, targetSymbol, values, options = {}) {
  for (const rows of record.kconfig?.selectsExpressions || []) {
    for (const raw of Array.isArray(rows) ? rows : [rows]) {
      const rule = ruleParts(raw);
      if (rule.symbol !== targetSymbol) continue;
      if (!rule.condition || evaluateExpressionRaw(rule.condition, values, options) === 2) return true;
    }
  }
  return false;
}

function dependencyStillRequired(model, symbol, values, options = {}) {
  const record = model.bySymbol.get(symbol);
  if (!record) return false;
  const testValues = new Map(values);
  testValues.set(symbol, 'n');
  for (const candidateSymbol of reverseCandidates(model, record)) {
    const candidate = model.bySymbol.get(candidateSymbol);
    if (!candidate || !recordEnabled(candidate, values)) continue;
    if (activeSelectsSymbol(candidate, symbol, values, options)) return true;
    const before = new Set(recordViolations(model, candidate, values, options)
      .filter((item) => !item.deferred).map(violationKey));
    const after = recordViolations(model, candidate, testValues, options)
      .filter((item) => !item.deferred);
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

export function applyUserIntent(model, inputValues, intent) {
  const initialValues = new Map(valuesMap(inputValues));
  const values = new Map(initialValues);
  const changes = [];
  const symbol = String(intent?.symbol || '');
  const value = normalizeValue(intent?.value ?? 'n');
  const record = model.bySymbol.get(symbol);
  if (!record) throw new Error(`Catalog does not define ${symbol}`);
  if (value !== 'n' && (!record.states?.includes(value) || (!record.userSettable && intent?.force !== true))) {
    throw new Error(`${symbol} cannot be enabled directly`);
  }
  if (value === 'n' && !record.canDisable) throw new Error(`${symbol} cannot be disabled`);
  const options = validationOptions(initialValues, intent?.validationOptions || {});
  const beforeKeys = new Set(validateConfig(model, initialValues, options).map(violationKey));
  setValue(values, changes, symbol, value, 'user');
  if (record.choice && value !== 'n') {
    for (const sibling of model.choices.get(record.choice) || []) {
      if (sibling !== symbol) setValue(values, changes, sibling, 'n', 'choice', symbol);
    }
  }
  if (value === 'n') cascadeDisabled(model, values, changes, [symbol], options);
  else cascadeEnabled(model, values, changes, [symbol], options);
  if (changes.some((change) => change.to === 'n')) {
    pruneUnusedDependencies(model, values, changes, intent?.dependencySymbols,
      intent?.protectedSymbols, options);
  }
  const violations = validateConfig(model, values, options);
  if (value !== 'n') {
    const blocking = violations.filter((item) => !beforeKeys.has(violationKey(item)));
    if (blocking.length) {
      const error = new Error(formatViolations(blocking));
      error.name = 'CatalogIntentError';
      error.violations = blocking;
      error.intent = { symbol, value };
      throw error;
    }
  }
  return { values, changes, violations };
}

const COMPATIBILITY_DOCUMENT_KEYS = new Set(['schema', 'rules']);
const COMPATIBILITY_RULE_KEYS = new Set(['id', 'kind', 'scope', 'if', 'packages', 'paths', 'refs']);
const COMPATIBILITY_ID_RE = /^[A-Z][A-Z0-9-]{2,31}$/;
const COMPATIBILITY_PACKAGE_RE = /^[A-Za-z0-9][A-Za-z0-9+_.@-]{0,95}$/;
const COMPATIBILITY_SOURCE_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const COMPATIBILITY_BRANCH_RE = /^[A-Za-z0-9._/-]{1,160}$/;

function compatibilityError(message) {
  const error = new Error(message);
  error.name = 'CatalogCompatibilityError';
  return error;
}

function compatibilityObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function compatibilityKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw compatibilityError(`${label} contains unsupported field: ${key}`);
  }
}

function compatibilityStrings(value, label, pattern, min, max) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw compatibilityError(`${label} must contain ${min}-${max} entries`);
  }
  const rows = value.map((item) => String(item || '').trim());
  if (rows.some((item) => !pattern.test(item)) || new Set(rows).size !== rows.length) {
    throw compatibilityError(`${label} contains invalid or duplicate values`);
  }
  return rows;
}

export function normalizeCompatibilityDocument(raw) {
  if (!compatibilityObject(raw)) throw compatibilityError('compatibility document must be an object');
  compatibilityKeys(raw, COMPATIBILITY_DOCUMENT_KEYS, 'compatibility document');
  if (Number(raw.schema) !== 1 || !Array.isArray(raw.rules)) {
    throw compatibilityError('compatibility document requires schema 1 and a rules array');
  }
  if (new TextEncoder().encode(JSON.stringify(raw)).byteLength > 512 * 1024) {
    throw compatibilityError('compatibility document is too large');
  }
  const ids = new Set();
  const rules = raw.rules.map((rule, index) => {
    const label = `compatibility.rules[${index}]`;
    if (!compatibilityObject(rule)) throw compatibilityError(`${label} must be an object`);
    compatibilityKeys(rule, COMPATIBILITY_RULE_KEYS, label);
    const id = String(rule.id || '').trim();
    if (!COMPATIBILITY_ID_RE.test(id) || ids.has(id)) {
      throw compatibilityError(`${label}.id is invalid or duplicate`);
    }
    ids.add(id);
    if (rule.kind !== 'ownership') throw compatibilityError(`${id}.kind must be ownership`);
    if (!compatibilityObject(rule.scope) || !Object.keys(rule.scope).length) {
      throw compatibilityError(`${id}.scope must be a non-empty object`);
    }
    const scope = {};
    for (const [source, branches] of Object.entries(rule.scope)) {
      if (!COMPATIBILITY_SOURCE_RE.test(source)) throw compatibilityError(`${id}.scope source is invalid`);
      scope[source] = compatibilityStrings(branches, `${id}.scope.${source}`,
        COMPATIBILITY_BRANCH_RE, 1, 32);
    }
    const condition = String(rule.if || '').trim();
    if (!condition || condition.length > 512) throw compatibilityError(`${id}.if is invalid`);
    return {
      id,
      kind: 'ownership',
      scope,
      if: condition,
      packages: compatibilityStrings(rule.packages, `${id}.packages`, COMPATIBILITY_PACKAGE_RE, 2, 16),
      paths: compatibilityStrings(rule.paths, `${id}.paths`, /^\/(?!.*(?:^|\/)\.\.(?:\/|$))[^\0\r\n]{1,255}$/, 1, 16),
      refs: compatibilityStrings(rule.refs, `${id}.refs`, /^[A-Za-z0-9][A-Za-z0-9+_.:/@#-]{0,255}$/, 1, 8),
    };
  });
  return { schema: 1, rules };
}

function materializeCompatibilityDefaults(model, inputValues, options) {
  const values = new Map(valuesMap(inputValues));
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const record of model?.records || []) {
      if (!record.configSymbol || values.has(record.configSymbol)) continue;
      const resolved = resolveKconfigDefault(record, values, options);
      if (resolved.status !== 'resolved') continue;
      values.set(record.configSymbol, resolved.value);
      changed = true;
    }
    if (!changed) break;
  }
  return values;
}

function compatibilityRuleTriggered(rule, records, values, options) {
  const condition = evaluateExpressionState(rule.if, values, options);
  if (condition.status === 'deferred') {
    throw compatibilityError(`${rule.id}.if cannot be resolved from the active Catalog`);
  }
  return condition.status === 'satisfied' && records.every((record) => recordInstalled(record, values));
}

export function evaluateCompatibilityRules(model, document, inputValues, context = {}) {
  if (!model?.byPackage) throw compatibilityError('Catalog model is unavailable');
  const normalized = normalizeCompatibilityDocument(document);
  const sourceId = String(context.sourceId || '');
  const branchName = String(context.branchName || '');
  const options = context.validationOptions || {};
  const values = materializeCompatibilityDefaults(model, inputValues, options);
  const warnings = [];
  for (const rule of normalized.rules) {
    if (!(rule.scope[sourceId] || []).includes(branchName)) continue;
    const records = rule.packages.map((packageName) => {
      const record = model.byPackage.get(packageName);
      if (!record?.configSymbol) {
        throw compatibilityError(`${rule.id} references a package missing from the active Catalog: ${packageName}`);
      }
      return record;
    });
    if (compatibilityRuleTriggered(rule, records, values, options)) {
      warnings.push({ rule, records, values });
    }
  }
  return { document: normalized, values, warnings };
}

export function deriveCompatibilityPlans(model, inputValues, warning, intent = {}) {
  const rule = warning?.rule;
  const records = warning?.records || [];
  const startingValues = warning?.values || inputValues;
  if (!rule || records.length < 2) throw compatibilityError('compatibility warning is incomplete');
  const candidates = [];
  for (const record of records) {
    if (!record.canDisable) continue;
    try {
      const protectedSymbols = new Set(intent.protectedSymbols || []);
      protectedSymbols.delete(record.configSymbol);
      const result = applyUserIntent(model, startingValues, {
        ...intent,
        symbol: record.configSymbol,
        value: 'n',
        force: true,
        protectedSymbols,
      });
      const resolved = !compatibilityRuleTriggered(rule, records, result.values,
        intent.validationOptions || {});
      if (resolved) {
        candidates.push({
          package: record.package,
          symbol: record.configSymbol,
          changes: result.changes,
          values: result.values,
          cost: new Set(result.changes.map((change) => change.symbol)).size,
        });
      }
    } catch {
      // A participant that cannot produce a valid generic Catalog intent is not a candidate.
    }
  }
  candidates.sort((left, right) => left.cost - right.cost || left.package.localeCompare(right.package));
  const minimum = candidates[0]?.cost;
  const cheapest = candidates.filter((candidate) => candidate.cost === minimum);
  return { candidates, recommended: cheapest.length === 1 ? cheapest[0] : null };
}

export function compatibilityAcknowledgementKey({
  sha256, dataRef, sourceId, branchName, revision, ruleIds,
} = {}) {
  const ids = Array.isArray(ruleIds) ? [...ruleIds].map(String).sort() : [];
  if (!/^[a-f0-9]{64}$/.test(String(sha256 || '')) ||
      !/^catalog-(?:fix|dev|staging|data)$/.test(String(dataRef || '')) ||
      !COMPATIBILITY_SOURCE_RE.test(String(sourceId || '')) ||
      !COMPATIBILITY_BRANCH_RE.test(String(branchName || '')) ||
      !Number.isSafeInteger(revision) || revision < 0 || !ids.length ||
      ids.some((id) => !COMPATIBILITY_ID_RE.test(id)) || new Set(ids).size !== ids.length) {
    throw compatibilityError('compatibility acknowledgement context is invalid');
  }
  return JSON.stringify([sha256, dataRef, sourceId, branchName, revision, ids]);
}

export function formatViolations(violations) {
  return (violations || []).map((item) => {
    if (item.code === 'package-dependency-unsatisfied') {
      return `${item.symbol} requires ${item.packages.join(' || ')}`;
    }
    if (item.code === 'kconfig-dependency-unsatisfied') return `${item.symbol} has unsatisfied Kconfig dependencies`;
    if (item.code === 'kconfig-dependency-deferred') return `${item.symbol} has deferred Kconfig dependencies`;
    if (item.code === 'package-dependency-deferred') return `${item.symbol} has deferred package dependencies`;
    if (item.code === 'package-conflict') return `${item.package} conflicts with ${item.otherPackage}`;
    if (item.code === 'choice-conflict') return `${item.choice} enables multiple values: ${item.symbols.join(', ')}`;
    return item.code || 'catalog validation error';
  }).join('; ');
}

export { LEVEL, STATE };
export const DEPENDENCY_STATUS = Object.freeze({ SATISFIED: 'satisfied', UNSATISFIED: 'unsatisfied', DEFERRED: 'deferred' });
