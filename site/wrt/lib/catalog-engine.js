import { decodeCompactRelationTables } from './catalog-relation-tables.js';

const LEVEL = Object.freeze({ n: 0, m: 1, y: 2 });
const STATE = Object.freeze(['n', 'm', 'y']);
const UNKNOWN = -1;
// Package-build closure is intentionally narrower than the full typed
// Kconfig relation contract.  A Catalog may have a complete package-info
// graph while still being inconclusive for typed defaults/visibility/choice
// evaluation.  Keep the two producer assertions separate at the model
// boundary so graph-derived compatibility decisions do not weaken typed
// validation.
const PACKAGE_CLOSURE_CAPABILITY = 'complete-package-build-closure-v1';
const KCONFIG_RELATION_CAPABILITY = 'complete-kconfig-relations-v1';
// This is the single typed-relation capability contract shared by the browser
// evaluator and the schema-6 Worker.  A producer may expose a readable graph
// without exposing every relation surface; consumers must not silently treat
// such a graph as authoritative for derived Kconfig decisions.
export const REQUIRED_KCONFIG_RELATION_CAPABILITIES = Object.freeze([
  'kconfig-expression-ast-v1',
  'typed-kconfig-v1',
  'conditional-defaults-v1',
  'conditional-ranges-v1',
  'visibility-conditions-v1',
  'choice-relations-v1',
  'choice-reset-conditions-v1',
  'module-semantics-v1',
  'typed-package-capabilities-v1',
  'alternatives-v1',
  'forward-reverse-edges-v1',
  KCONFIG_RELATION_CAPABILITY,
]);

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeValue(value) {
  const text = String(value ?? 'n');
  return Object.hasOwn(LEVEL, text) ? text : text;
}

export function decodeKconfigString(value) {
  const text = String(value ?? '');
  if (!(text.startsWith('"') && text.endsWith('"'))) return text;
  const body = text.slice(1, -1);
  return body.replace(/\\([\s\S])/g, '$1');
}

export function encodeKconfigString(value) {
  const text = String(value ?? '');
  if (/[\0\r\n]/.test(text)) throw new Error('Kconfig strings cannot contain NUL or line breaks');
  return `"${text.replace(/[\\"]/g, '\\$&')}"`;
}

// Source and .config readers both remove escape backslashes without JSON
// control escapes. Keep the source boundary explicit for its quote syntax.
function decodeKconfigExpressionString(value) {
  const text = String(value ?? '');
  if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1).replace(/\\([\s\S])/g, '$1');
  return decodeKconfigString(text);
}

function mapValue(map, key) {
  if (map instanceof Map) return map.get(key);
  if (map && typeof map === 'object') return map[key];
  return undefined;
}

function expressionSymbolType(symbol, options = {}) {
  const type = String(mapValue(options.symbolTypes, symbol) || '').trim().toLowerCase();
  return ['bool', 'tristate', 'string', 'int', 'hex', 'unknown'].includes(type) ? type : '';
}

function parseExpressionInteger(value, type = '') {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const normalizedType = String(type || '').toLowerCase();
  const parseSignedDecimal = (source) => {
    if (!/^[+-]?\d+$/.test(source)) return null;
    try { return { kind: 'signed', value: BigInt(source) }; } catch { return null; }
  };
  const parseHex = (source, allowPrefix = true) => {
    const match = source.match(/^([+-]?)(?:0[xX])?([0-9a-fA-F]+)$/);
    if (!match || (!allowPrefix && /[a-f]/i.test(match[2]))) return null;
    try {
      const value = BigInt(`0x${match[2]}`);
      return { kind: 'unsigned', value: match[1] === '-' ? -value : value };
    } catch { return null; }
  };
  if (normalizedType === 'bool' || normalizedType === 'tristate') {
    const level = LEVEL[text];
    return level === undefined ? null : { kind: 'signed', value: BigInt(level) };
  }
  if (normalizedType === 'int') return parseSignedDecimal(text);
  if (normalizedType === 'hex') return parseHex(text);
  // Unknown Kconfig symbols are parsed by native expr_parse_string() with
  // base 0.  Cover the decimal/hex forms used by Catalog expressions without
  // routing through Number (which loses precision above 2^53).
  if (/^[+-]?0[xX][0-9a-f]+$/i.test(text)) return parseHex(text);
  const octal = text.match(/^([+-]?)0([0-7]+)$/);
  if (octal) {
    try {
      const value = BigInt(`0o${octal[2]}`);
      return { kind: 'signed', value: octal[1] === '-' ? -value : value };
    } catch { return null; }
  }
  return parseSignedDecimal(text);
}

function expressionLiteralOperand(value, raw = value, quoted = false) {
  const source = String(raw ?? value ?? '');
  const text = String(value ?? source);
  if (quoted || (source.startsWith('"') && source.endsWith('"'))) {
    const stringValue = quoted && !(source.startsWith('"') && source.endsWith('"'))
      ? text : decodeKconfigExpressionString(source);
    return { type: 'string', level: 0, stringValue, numeric: null,
      unknownData: false, nativeUndefined: false };
  }
  if (Object.hasOwn(LEVEL, text)) {
    return { type: 'tristate', level: LEVEL[text], stringValue: text,
      numeric: { kind: 'signed', value: BigInt(LEVEL[text]) }, unknownData: false, nativeUndefined: false };
  }
  if (/^[+-]?(?:0x[0-9a-f]+|\d+)$/i.test(text)) {
    const type = /^[-+]?0x/i.test(text) ? 'hex' : 'int';
    return { type, level: 0, stringValue: text, numeric: parseExpressionInteger(text, type),
      unknownData: false, nativeUndefined: false };
  }
  return { type: 'unknown', level: 0, stringValue: text,
    numeric: parseExpressionInteger(text, 'unknown'), unknownData: false, nativeUndefined: true };
}

function expressionOperand(token, inputValues, options = {}, { literal = false } = {}) {
  const values = valuesMap(inputValues);
  const source = String(token ?? '');
  if (literal || /^".*"$/.test(source) || Object.hasOwn(LEVEL, source) ||
      /^[+-]?(?:0x[0-9a-f]+|\d+)$/i.test(source)) {
    return expressionLiteralOperand(source, source);
  }
  if (values.has(source)) {
    const explicitType = expressionSymbolType(source, options);
    const type = explicitType ||
      (Object.hasOwn(LEVEL, String(values.get(source))) ? 'tristate' : 'unknown');
    const stringValue = String(values.get(source));
    const inferredScalar = !explicitType && type === 'unknown';
    const level = type === 'bool' || type === 'tristate'
      ? (Object.hasOwn(LEVEL, stringValue) ? LEVEL[stringValue] : UNKNOWN)
      : inferredScalar ? UNKNOWN : 0;
    return { type, level, stringValue, numeric: parseExpressionInteger(stringValue, type),
      unknownData: inferredScalar, nativeUndefined: false };
  }
  const undefinedSymbol = mapValue(options.undefinedSymbols, source);
  if (undefinedSymbol && undefinedSymbol.reason === 'undefined-kconfig-symbol' &&
      undefinedSymbol.nativeType === 'unknown' && undefinedSymbol.booleanValue === 'n' &&
      String(undefinedSymbol.stringValue ?? source) === source) {
    return { type: 'unknown', level: 0, stringValue: source,
      numeric: parseExpressionInteger(source, 'unknown'), unknownData: false, nativeUndefined: true };
  }
  if (/^PACKAGE_/.test(source) || options.closedSymbols?.has?.(source) ||
      (/^TARGET_/.test(source) && options.contextComplete)) {
    const type = expressionSymbolType(source, options) || 'tristate';
    return { type, level: 0, stringValue: 'n', numeric: { kind: 'signed', value: 0n },
      unknownData: false, nativeUndefined: false };
  }
  // An absent symbol with no producer proof is not native N.  Keep it
  // deferred so incomplete Catalog data cannot be promoted to a decision.
  return { type: 'unknown', level: UNKNOWN, stringValue: source, numeric: null,
    unknownData: true, nativeUndefined: false };
}

function compareExpressionOperands(left, operator, right) {
  if (!left || !right || left.level === UNKNOWN || right.level === UNKNOWN ||
      left.unknownData || right.unknownData) return UNKNOWN;
  const leftString = left.type === 'string';
  const rightString = right.type === 'string';
  let result;
  if (leftString && rightString) {
    const a = String(left.stringValue); const b = String(right.stringValue);
    result = a === b ? 0 : a < b ? -1 : 1;
  } else {
    // This follows scripts/config/expr.c: when at least one side is not
    // S_STRING, parse each operand using its own type.  If either parse fails,
    // native code falls back to strcmp on the original string values.
    const leftNumeric = left.numeric || parseExpressionInteger(left.stringValue, left.type);
    const rightNumeric = right.numeric || parseExpressionInteger(right.stringValue, right.type);
    if (leftNumeric && rightNumeric) {
      const unsigned = leftNumeric.kind === 'unsigned' || rightNumeric.kind === 'unsigned';
      const a = leftNumeric.value; const b = rightNumeric.value;
      result = unsigned ? (a > b ? 1 : a < b ? -1 : 0) : (a > b ? 1 : a < b ? -1 : 0);
    } else {
      const a = String(left.stringValue); const b = String(right.stringValue);
      result = a === b ? 0 : a < b ? -1 : 1;
    }
  }
  if (operator === '=') return result === 0 ? 2 : 0;
  if (operator === '!=') return result !== 0 ? 2 : 0;
  if (operator === '<') return result < 0 ? 2 : 0;
  if (operator === '>') return result > 0 ? 2 : 0;
  if (operator === '<=') return result <= 0 ? 2 : 0;
  if (operator === '>=') return result >= 0 ? 2 : 0;
  return UNKNOWN;
}

export function resolveCatalogUserOverride(inheritedValue, requestedValue) {
  const inherited = normalizeValue(inheritedValue);
  const requested = normalizeValue(requestedValue);
  return requested === inherited ? null : requested;
}

function stateLevel(value) {
  const normalized = normalizeValue(value);
  if (Object.hasOwn(LEVEL, normalized)) return LEVEL[normalized];
  const text = decodeKconfigString(normalized);
  if (/^[+-]?(?:0x[0-9a-f]+|\d+)$/i.test(text)) return Number(text) === 0 ? 0 : 2;
  return text ? 2 : 0;
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

function relationCapabilities(relations = {}) {
  const values = Array.isArray(relations.capabilities) ? relations.capabilities
    : Array.isArray(relations.relationCapabilities) ? relations.relationCapabilities : [];
  return [...values]
    .map(String).filter(Boolean);
}

function packageClosureContract(relations = {}) {
  // Schema-4 compact assets stamp the narrow contract on these exact
  // top-level fields.  Do not infer it from an older nested/legacy shape:
  // those assets remain readable but graph-derived recommendations are
  // inconclusive.
  const values = Array.isArray(relations.packageClosureCapabilities)
    ? relations.packageClosureCapabilities : [];
  const capabilities = [...values].map(String).filter(Boolean);
  return {
    capabilities,
    complete: relations.packageClosureComplete === true &&
      capabilities.includes(PACKAGE_CLOSURE_CAPABILITY),
    validation: relations.packageClosureValidation && typeof relations.packageClosureValidation === 'object'
      ? relations.packageClosureValidation : {},
  };
}

function ruleParts(raw) {
  const match = String(raw || '').trim().match(/^([^\s]+)(?:\s+if\s+(.+))?$/);
  return match ? { symbol: match[1], condition: match[2] || '' } : { symbol: '', condition: '' };
}

const EXPRESSION_TOKEN_CACHE = new Map();
function expressionTokens(expression) {
  const original = String(expression || '');
  if (!EXPRESSION_TOKEN_CACHE.has(original)) {
    let quoted = false;
    let escaped = false;
    let source = '';
    for (let index = 0; index < original.length; index += 1) {
      const character = original[index];
      if (escaped) { source += character; escaped = false; continue; }
      if (quoted && character === '\\') { source += character; escaped = true; continue; }
      if (character === '"') { quoted = !quoted; source += character; continue; }
      if (!quoted && character === '#') break;
      source += character;
    }
    const tokens = [];
    let at = 0;
    let invalid = '';
    const isWord = (character) => /[A-Za-z0-9_./-]/.test(character);
    const markInvalid = (character) => { if (!invalid) invalid = character; };
    while (at < source.length) {
      const character = source[at];
      if (/\s/.test(character)) { at += 1; continue; }
      const two = source.slice(at, at + 2);
      if (['||', '&&', '!=', '<=', '>='].includes(two)) {
        tokens.push(two); at += 2; continue;
      }
      if (['=', '<', '>', '!', '(', ')'].includes(character)) {
        tokens.push(character); at += 1; continue;
      }
      // Native Kconfig's lexer ignores an unsupported @ outside a quoted
      // literal.  Keep the raw spelling for provenance while tokenizing the
      // expression in the same source domain as the producer AST.
      if (character === '@') { at += 1; continue; }
      if (character === '"') {
        const start = at;
        let escaped = false;
        let closed = false;
        at += 1;
        while (at < source.length) {
          const next = source[at++];
          if (escaped) { escaped = false; continue; }
          if (next === '\\') { escaped = true; continue; }
          if (next === '"') { closed = true; break; }
          if (next === '\r' || next === '\n') markInvalid(next);
        }
        const token = source.slice(start, at);
        tokens.push(token);
        if (!closed || escaped) markInvalid(token);
        continue;
      }
      if (isWord(character)) {
        const start = at;
        while (at < source.length && isWord(source[at])) at += 1;
        tokens.push(source.slice(start, at));
        continue;
      }
      markInvalid(character);
      // Retain the offending character as a token so parser diagnostics and
      // the complete-consumption check cannot silently skip a suffix.
      tokens.push(character);
      at += 1;
    }
    Object.defineProperties(tokens, {
      complete: { value: !invalid, enumerable: false },
      invalid: { value: invalid, enumerable: false },
      syntaxValid: { value: null, writable: true, enumerable: false },
    });
    EXPRESSION_TOKEN_CACHE.set(original, tokens);
  }
  return EXPRESSION_TOKEN_CACHE.get(original);
}

function evaluateExpressionRaw(expression, inputValues, options = {}) {
  if (!String(expression || '').trim()) return 2;
  const tokens = expressionTokens(expression);
  if (tokens.complete === false || !tokens.length) return UNKNOWN;
  let at = 0;
  let parseError = false;
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
      else parseError = true;
      return value;
    }
    if (at >= tokens.length || ['&&', '||', ')', '=', '!=', '<', '>', '<=', '>='].includes(tokens[at])) {
      parseError = true;
      return UNKNOWN;
    }
    const left = expressionOperand(tokens[at++], inputValues, options);
    if (['=', '!=', '<', '>', '<=', '>='].includes(tokens[at])) {
      const op = tokens[at++];
      if (at >= tokens.length || ['&&', '||', ')', '=', '!=', '<', '>', '<=', '>='].includes(tokens[at])) {
        parseError = true;
        return UNKNOWN;
      }
      const right = expressionOperand(tokens[at++], inputValues, options);
      return compareExpressionOperands(left, op, right);
    }
    return left.level;
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
  const result = or();
  tokens.syntaxValid = !parseError && at === tokens.length;
  return tokens.syntaxValid ? result : UNKNOWN;
}

export function evaluateExpressionState(expression, inputValues, options = {}) {
  const level = evaluateExpressionRaw(expression, inputValues, options);
  if (level === UNKNOWN) return { status: 'deferred', level: null };
  return { status: level > 0 ? 'satisfied' : 'unsatisfied', level };
}

export function evaluateExpression(expression, inputValues, options = {}) {
  const result = evaluateExpressionRaw(expression, inputValues, options);
  // Malformed input is never promoted by the public convenience fallback.
  // Unknown symbols may still use the caller's explicit policy, but an
  // invalid suffix/character must remain UNKNOWN for fail-closed consumers.
  const tokens = expressionTokens(expression);
  if (tokens.complete === false || tokens.syntaxValid === false) return UNKNOWN;
  if (result !== UNKNOWN) return result;
  if (options?.unknown === 'deny') return 0;
  if (options?.unknown === 'module') return 1;
  if (options?.unknown === 'defer') return UNKNOWN;
  return 2;
}

function defaultParts(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    // Typed `value` is already decoded. Prefer original source spelling when
    // available so literal quotes/backslashes are not decoded a second time.
    const sourceValue = raw.raw === undefined ? undefined : defaultParts(String(raw.raw)).valueExpression;
    const valueExpression = String(raw.valueExpression ?? sourceValue ?? raw.value ?? raw.default ?? '').trim();
    const condition = String(raw.condition ?? raw.if ?? '').trim();
    return { valueExpression, condition };
  }
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

function expressionAstSymbols(value, seen = new Set()) {
  const symbols = new Set();
  const visit = (node) => {
    if (node === null || node === undefined) return;
    if (typeof node === 'string') {
      for (const symbol of referencedExpressionSymbols(node)) symbols.add(symbol);
      return;
    }
    if (typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (node.kind === 'symbol' && String(node.name || '').trim()) {
      symbols.add(String(node.name).trim());
    }
    for (const child of Object.values(node)) visit(child);
  };
  visit(value);
  return symbols;
}

function normalizeExpressionAstNode(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const kind = String(value.kind || value.type || '').trim().toLowerCase();
  if (kind === 'symbol') {
    const name = String(value.name ?? value.symbol ?? '').trim();
    return name ? { kind: 'symbol', name, ...(value.raw !== undefined ? { raw: String(value.raw) } : {}) } : null;
  }
  if (kind === 'literal') {
    if (value.value === undefined && value.raw === undefined) return null;
    return { kind: 'literal', value: value.value ?? value.raw,
      ...(value.raw !== undefined ? { raw: String(value.raw) } : {}),
      ...(value.quoted === true ? { quoted: true } : {}) };
  }
  if (kind === 'unknown') return { kind: 'unknown', raw: String(value.raw || '') };
  if (kind === 'not') {
    const child = normalizeExpressionAstNode(value.value ?? value.child ?? value.operand);
    return child ? { kind: 'not', value: child } : null;
  }
  if (kind === 'compare') {
    const left = normalizeExpressionAstNode(value.left);
    const right = normalizeExpressionAstNode(value.right);
    const operator = String(value.operator || value.op || '').trim();
    return left && right && ['=', '!=', '<', '>', '<=', '>='].includes(operator)
      ? { kind: 'compare', operator, left, right } : null;
  }
  if (kind === 'and' || kind === 'or') {
    const source = Array.isArray(value.values) ? value.values
      : Array.isArray(value.children) ? value.children
        : Array.isArray(value.args) ? value.args : [];
    const values = source.map(normalizeExpressionAstNode);
    return values.length && values.every(Boolean) ? { kind, values } : null;
  }
  return null;
}

function normalizeExpressionAst(value) {
  if (value && typeof value === 'object' && !Array.isArray(value) &&
      (Object.hasOwn(value, 'ast') || Object.hasOwn(value, 'complete'))) {
    const ast = normalizeExpressionAstNode(value.ast);
    return {
      raw: String(value.raw || '').trim(),
      ast,
      complete: value.complete !== false && Boolean(ast),
    };
  }
  const ast = normalizeExpressionAstNode(value);
  return { raw: '', ast, complete: Boolean(ast) };
}

function relationTarget(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return String(value.target || value.symbol || value.name ||
      (value.raw ? ruleParts(value.raw).symbol : '')).trim();
  }
  return ruleParts(value).symbol;
}

function normalizeKconfigRelation(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const target = relationTarget(value);
    const condition = String(value.condition || value.if || '').trim();
    const targetAstValue = value.targetAst ?? value.expressionAst ?? null;
    const conditionAstValue = value.conditionAst ?? null;
    const targetAst = targetAstValue === null ? null : normalizeExpressionAst(targetAstValue);
    const conditionAst = conditionAstValue === null ? null : normalizeExpressionAst(conditionAstValue);
    return {
      ...value,
      target,
      symbol: target,
      name: target,
      condition,
      targetAst,
      expressionAst: targetAst,
      conditionAst,
      raw: String(value.raw || value.target || value.symbol || value.name || '').trim(),
    };
  }
  const parsed = ruleParts(value);
  const target = String(parsed.symbol || '').trim();
  return { raw: String(value || '').trim(), target, symbol: target, name: target,
    condition: parsed.condition, targetAst: null, expressionAst: null, conditionAst: null };
}

function kconfigRelationParts(value) {
  const normalized = normalizeKconfigRelation(value);
  return {
    ...normalized,
    symbol: normalized.target,
    conditionAst: normalized.conditionAst,
    raw: normalized.raw,
  };
}

function kconfigRelationRows(record, kind) {
  const typedField = kind === 'select' ? 'selectRelations' : 'implyRelations';
  const rawField = kind === 'select' ? 'selectsExpressions' : 'impliesExpressions';
  const typed = record?.kconfig?.[typedField] || record?.[typedField];
  if (typed && ((Array.isArray(typed) && typed.length) || !Array.isArray(typed))) {
    return (Array.isArray(typed) ? typed : [typed])
      .flatMap((row) => Array.isArray(row) ? row : [row]).map(normalizeKconfigRelation);
  }
  const typedVariants = record?.kconfig?.[`${typedField}Variants`] || record?.[`${typedField}Variants`];
  if (Array.isArray(typedVariants) && typedVariants.length) {
    return typedVariants.flatMap((row) => Array.isArray(row) ? row : [row]).map(normalizeKconfigRelation);
  }
  const rawRows = record?.kconfig?.[rawField] || record?.[rawField] || [];
  const flatRows = Array.isArray(rawRows) ? rawRows.flatMap((row) => Array.isArray(row) ? row : [row]) : [rawRows];
  return flatRows.filter(Boolean).map(normalizeKconfigRelation);
}

function unwrapExpressionAst(value) {
  // Catalog expression tables carry the parser envelope (`{ raw, ast,
  // complete, ... }`) so the raw spelling and completeness provenance survive
  // serialization.  The evaluator consumes the AST node itself; accepting
  // both forms keeps readable schema-2 records and compact schema-4 records
  // on one path.
  const normalized = normalizeExpressionAst(value);
  return normalized.complete ? normalized.ast : null;
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

function moduleSupportLevel(model, values, options = {}) {
  const moduleRecord = model?.bySymbol?.get('MODULES') || model?.bySymbol?.get('CONFIG_MODULES');
  if (!moduleRecord?.configSymbol) return 2;
  if (values.has(moduleRecord.configSymbol)) return stateLevel(values.get(moduleRecord.configSymbol));
  if (options.closedSymbols?.has?.(moduleRecord.configSymbol)) return 0;
  return UNKNOWN;
}

function modelKconfigStates(model, record, values, options = {}) {
  const states = allowedKconfigStates(record);
  if (String(record?.type || '').toLowerCase() !== 'tristate') return states;
  const modules = moduleSupportLevel(model, values, options);
  return modules === 0 ? states.filter((value) => value !== 'm') : states;
}

function stateForKconfigLevel(model, record, level, values, options = {}) {
  if (level === 1 && String(record?.type || '').toLowerCase() === 'tristate' &&
      moduleSupportLevel(model, values, options) === 0) return 'n';
  return STATE[level] || 'n';
}

function scalarDefaultValue(valueExpression, type = 'string', inputValues = new Map(), raw = null, options = {}) {
  const expression = String(valueExpression || '').trim();
  const valueKind = String(raw?.valueKind || '').trim();
  const literal = valueKind === 'literal' || (!valueKind &&
    (/^"(?:[^"\\]|\\.)*"$/.test(expression) ||
      (type === 'int' && /^[+-]?\d+$/.test(expression)) ||
      (type === 'hex' && /^[+-]?0[xX][0-9a-fA-F]+$/.test(expression))));
  if (valueKind === 'unknown' || (!literal &&
      valueKind !== 'expression' && valueKind !== '')) return UNKNOWN;
  if (!literal) {
    if (inputValues instanceof Map && inputValues.has(expression)) {
      return String(inputValues.get(expression));
    }
    const operand = expressionOperand(expression, inputValues, options);
    return operand.unknownData ? UNKNOWN : operand.stringValue;
  }
  const value = decodeKconfigExpressionString(expression);
  if (type === 'int') {
    if (!/^[+-]?\d+$/.test(value)) return value;
    // Native scalar defaults retain the exact token. Never round via Number.
    return value;
  }
  if (type === 'hex') {
    if (!/^[+-]?(?:0[xX])?[0-9a-fA-F]+$/.test(value)) return value;
    return value;
  }
  return value;
}

function scalarValueValid(type, value) {
  const normalized = String(value ?? '');
  if (type === 'string') return !/[\0\r\n]/.test(normalized);
  if (type === 'int') return /^[+-]?\d+$/.test(normalized);
  if (type === 'hex') return /^[+-]?0[xX][0-9a-fA-F]+$/.test(normalized);
  return true;
}

export function resolveKconfigDefault(option = {}, inputValues = new Map(), options = {}) {
  const type = String(option.type || '').toLowerCase();
  const fallback = type === 'string' ? '' : 'n';
  // Compact relations schema 4 carries the typed/default-order table beside
  // the legacy display table.  Consume it when present so a conditional
  // string/int/hex default is evaluated in the same order as Kconfig instead
  // of reconstructing a lossy `value if condition` spelling.
  const defaults = Array.isArray(option.defaultsTyped) && option.defaultsTyped.length
    ? option.defaultsTyped : (option.defaults || []);
  for (const raw of defaults) {
    if (raw && typeof raw === 'object' && raw.valid === false) {
      return { status: 'deferred', value: fallback, reason: 'invalid-typed-default' };
    }
    const { valueExpression, condition } = defaultParts(raw);
    if (!valueExpression) continue;
    const conditionState = evaluateExpressionRaw(condition, inputValues, options);
    if (conditionState === UNKNOWN) {
      return { status: 'deferred', value: fallback, reason: 'unknown-default-condition', condition };
    }
    if (conditionState === 0) continue;
    if (type === 'bool' || type === 'tristate') {
      const level = evaluateExpressionRaw(valueExpression, inputValues, options);
      if (level === UNKNOWN) {
        return { status: 'deferred', value: fallback, reason: 'unknown-default-value', valueExpression };
      }
      const resolved = type === 'bool' && level === 1 ? 'y' : STATE[level] || fallback;
      return { status: 'resolved', value: normalizeKconfigStateValue(option, resolved, fallback) };
    }
    const value = scalarDefaultValue(valueExpression, type, inputValues, raw, options);
    if (value === UNKNOWN) {
      return { status: 'deferred', value: fallback, reason: 'unknown-default-value', valueExpression };
    }
    if (!scalarValueValid(type, value)) {
      return { status: 'deferred', value: fallback, reason: 'invalid-default-value', valueExpression };
    }
    return { status: 'resolved', value };
  }
  return { status: 'fallback', value: fallback };
}

function compactStates(mask) {
  return ['n', 'm', 'y'].filter((_, index) => Number(mask || 0) & (1 << index));
}

export function expandCompactRelations(compact) {
  if (Number(compact?.schema) === 5) return expandCompactRelations(decodeCompactRelationTables(compact));
  const relationSchema = Number(compact?.schema || 0);
  if (![3, 4].includes(relationSchema)) throw new Error('Catalog relations schema 3 or 4 is required');
  const schema4 = relationSchema === 4;
  const strings = compact.strings || [];
  const expressions = compact.expressions || [];
  const stringLists = compact.stringLists || [];
  const expressionLists = compact.expressionLists || [];
  const variants = compact.expressionVariants || [];
  const expressionAsts = compact.expressionAsts || [];
  const flags = compact.flags || { visible: 1, userSettable: 2, canDisable: 4, hasKconfig: 8, package: 16 };
  const list = (id) => id < 0 ? [] : (stringLists[id] || []).map((item) => strings[item] || '');
  const expressionRows = (id) => id < 0 ? [] : (variants[id] || []).map((listId) =>
    (expressionLists[listId] || []).map((item) => expressions[item] || ''));
  const indexes = (rows) => Object.fromEntries((rows || []).map(([keyId, listId]) => [
    strings[keyId] || '', list(listId),
  ]));
  const recordIndexes = (rows) => Object.fromEntries((rows || []).map(([keyId, value]) => [
    strings[keyId] || '', Number(value),
  ]));
  const fields = Array.isArray(compact.fields) ? compact.fields : [];
  const fieldIndex = (name, fallback) => {
    const index = fields.indexOf(name);
    return index >= 0 ? index : fallback;
  };
  const fieldValue = (row, name, fallback) => Array.isArray(row)
    ? row[fieldIndex(name, fallback)]
    : row?.[name];
  const expression = (id) => id === undefined || id === null || id < 0 ? '' : expressions[id] || '';
  const decodeTypedDefaultRows = (id) => (schema4 ? (compact.typedDefaults?.[id] || []).map((row) => ({
    type: compact.types?.[row.typeCode] || '',
    value: row.value,
    raw: strings[row.rawId] || '',
    condition: expression(row.conditionId),
    valueKind: compact.valueKinds?.[row.valueKindCode] || '',
    valid: row.valid !== false,
    precise: row.precise !== false,
  })) : []);
  const decodeTypedRangeRows = (id) => (schema4 ? (compact.ranges?.[id] || []).map((row) => ({
    type: compact.types?.[row.typeCode] || '',
    min: row.min,
    max: row.max,
    minRaw: strings[row.minRawId] || '',
    maxRaw: strings[row.maxRawId] || '',
    raw: strings[row.rawId] || '',
    condition: expression(row.conditionId),
    minKind: compact.valueKinds?.[row.minKindCode] || '',
    maxKind: compact.valueKinds?.[row.maxKindCode] || '',
    valid: row.valid !== false,
  })) : []);
  const decodeCapabilityRows = (id) => (schema4
    ? (compact.capabilities?.[id] || { provides: [], conflicts: [] })
    : { provides: [], conflicts: [] });
  const decodeDependencyRows = (id) => (compact.packageDependencies?.[id] || []).map((row) => {
    // Schema 3 encoded each dependency as [required, conditionId, rawId,
    // packagesId].  Schema 4 keeps the typed dependency/capability objects so
    // no relation information is lost while crossing the compact boundary.
    if (Array.isArray(row)) return {
      raw: strings[row[2]] || '',
      required: Boolean(row[0]),
      condition: row[1] < 0 ? '' : expressions[row[1]] || '',
      packages: list(row[3]),
      targets: [],
    };
    return {
      raw: String(row?.raw || ''),
      required: row?.required !== false,
      kind: String(row?.kind || 'package'),
      condition: String(row?.condition || ''),
      packages: Array.isArray(row?.packages) ? row.packages.map(String).filter(Boolean) : [],
      targets: Array.isArray(row?.targets) ? row.targets : [],
    };
  });
  const decodeEdgeRows = () => (schema4 ? (compact.edges || []).map((edge) => ({
    from: strings[edge.fromId] || '',
    to: strings[edge.toId] || '',
    relation: strings[edge.relationId] || '',
    condition: expression(edge.conditionId),
    expression: expression(edge.expressionId),
    // `null` means candidate/reference only. Keep it explicit across the
    // compact boundary so consumers cannot promote an OR/reference edge to a
    // mandatory dependency by treating an omitted field as `true`.
    required: edge.required === null ? null : edge.required === true,
    kind: strings[edge.kindId] || '',
    alternatives: (compact.alternativeLists?.[edge.alternativesId] || []).map((listId) => list(listId)),
    providers: list(edge.providersId),
    ...(edge.expressionAstId === undefined || edge.expressionAstId < 0 ? {} : {
      expressionAst: expressionAsts[edge.expressionAstId] || null,
    }),
    ...(edge.conditionAstId === undefined || edge.conditionAstId < 0 ? {} : {
      conditionAst: expressionAsts[edge.conditionAstId] || null,
    }),
    ownerSelf: edge.ownerSelf === true,
  })) : []);
  const decodeNumericIndex = (rows) => Object.fromEntries((rows || []).map(([key, listId]) => [
    String(key), (compact.numberLists?.[listId] || []).map(Number),
  ]));
  const records = (compact.records || []).map((row) => {
    const symbolId = fieldValue(row, 'symbolId', 0);
    const recordFlags = fieldValue(row, 'flags', 1);
    const typeCode = fieldValue(row, 'typeCode', 2);
    const originCode = fieldValue(row, 'originCode', 3);
    const statesMask = fieldValue(row, 'statesMask', 4);
    const choiceId = fieldValue(row, 'choiceId', 5);
    const defaultsId = fieldValue(row, 'defaultsId', 6);
    const dependsId = fieldValue(row, 'dependsVariantsId', 7);
    const selectsId = fieldValue(row, 'selectsVariantsId', 8);
    const impliesId = fieldValue(row, 'impliesVariantsId', 9);
    const packageDependenciesId = fieldValue(row, 'packageDependenciesId', 10);
    const providesId = fieldValue(row, 'providesId', 11);
    const conflictsId = fieldValue(row, 'conflictsId', 12);
    const packageConflictsId = fieldValue(row, 'packageConflictsId', 13);
    const kconfigConflictsId = fieldValue(row, 'kconfigConflictsId', 14);
    const symbol = strings[symbolId] || '';
    const isPackage = Boolean(recordFlags & flags.package);
    const hasKconfig = Boolean(recordFlags & flags.hasKconfig);
    const dependsExpressions = expressionRows(dependsId);
    const selectsExpressions = expressionRows(selectsId);
    const impliesExpressions = expressionRows(impliesId);
    const packageDepends = decodeDependencyRows(packageDependenciesId);
    const defaults = (compact.defaults?.[defaultsId] || []).map(([valueId, conditionId, rawId]) => {
      const value = strings[valueId] || '';
      const condition = conditionId < 0 ? '' : expressions[conditionId] || '';
      const fallback = condition ? `${value} if ${condition}` : value;
      // Schema 4 keeps the exact source spelling in the optional third tuple
      // cell. Older schema-3 rows have no rawId and retain the reconstructed
      // fallback for backwards compatibility.
      return rawId === undefined ? fallback : (strings[rawId] ?? fallback);
    });
    const provides = list(providesId);
    const conflicts = list(conflictsId);
    const packageConflicts = list(packageConflictsId);
    const typedDefaults = decodeTypedDefaultRows(fieldValue(row, 'typedDefaultsId', -1));
    const rangesTyped = decodeTypedRangeRows(fieldValue(row, 'rangesId', -1));
    const promptIf = list(fieldValue(row, 'promptIfId', -1));
    const promptConditions = list(fieldValue(row, 'promptConditionsId', -1));
    const visibleIf = list(fieldValue(row, 'visibleIfId', -1));
    const menuVisibleIf = list(fieldValue(row, 'menuVisibleIfId', -1));
    const directDepends = list(fieldValue(row, 'directDependsId', -1));
    const inheritedDepends = list(fieldValue(row, 'inheritedDependsId', -1));
    const directVisibleIf = list(fieldValue(row, 'directVisibleIfId', -1));
    const inheritedVisibleIf = list(fieldValue(row, 'inheritedVisibleIfId', -1));
    const inheritedMenuVisibleIf = list(fieldValue(row, 'inheritedMenuVisibleIfId', -1));
    const optionFlags = list(fieldValue(row, 'optionFlagsId', -1));
    const options = list(fieldValue(row, 'optionsId', -1));
    const definitionsId = fieldValue(row, 'definitionsId', -1);
    const nodes = schema4 ? (compact.definitions?.[definitionsId] || []) : [];
    const capabilityRows = decodeCapabilityRows(fieldValue(row, 'capabilityRelationsId', -1));
    const definitionRows = Array.isArray(nodes) ? nodes : [];
    // Keep empty definition slots: their position is the variant identity and
    // must stay aligned with the legacy expression-variant tables. Filtering
    // them here changes which definition an AST belongs to and can turn a
    // conditional alternative into an unrelated dependency.
    const definitionFieldVariants = (field) => definitionRows.map((node) =>
      Array.isArray(node?.[field]) ? node[field].map((value) => value ?? null) : []);
    const dependsAstVariants = definitionFieldVariants('dependsAst');
    const directDependsAstVariants = definitionFieldVariants('directDependsAst');
    const inheritedDependsAstVariants = definitionFieldVariants('inheritedDependsAst');
    const selectRelationsVariants = definitionFieldVariants('selectRelations');
    const implyRelationsVariants = definitionFieldVariants('implyRelations');
    const promptIfAstVariants = definitionFieldVariants('promptIfAst');
    const visibleIfAstVariants = definitionFieldVariants('visibleIfAst');
    const menuVisibleIfAstVariants = definitionFieldVariants('menuVisibleIfAst');
    const directVisibleIfAstVariants = definitionFieldVariants('directVisibleIfAst');
    const inheritedVisibleIfAstVariants = definitionFieldVariants('inheritedVisibleIfAst');
    const inheritedMenuVisibleIfAstVariants = definitionFieldVariants('inheritedMenuVisibleIfAst');
    const firstDefinition = definitionRows[0] || {};
    const kconfigConflicts = [
      ...(schema4 ? (compact.kconfigConflicts?.[kconfigConflictsId] || []) : []),
      ...definitionRows.flatMap((node) => Array.isArray(node?.kconfigConflicts) ? node.kconfigConflicts : []),
    ];
    const symbolsInExpression = (raw) => {
      const tokens = expressionTokens(raw);
      const end = tokens.indexOf('if');
      return unique((end < 0 ? tokens : tokens.slice(0, end)).filter((token) =>
        /^[A-Za-z0-9_./-]+$/.test(token) && !Object.hasOwn(LEVEL, token) &&
        !/^(?:0[xX][0-9a-fA-F]+|[+-]?\d+)$/.test(token))).sort();
    };
    const packageVariants = (rows) => rows.map((row) => unique(row.flatMap(symbolsInExpression)
      .filter((symbol) => symbol.startsWith('PACKAGE_'))));
    const allSymbols = (rows) => unique(rows.flatMap((row) => row.flatMap(symbolsInExpression)));
    const dependsVariants = packageVariants(dependsExpressions);
    const selectsVariants = packageVariants(selectsExpressions);
    const impliesVariants = packageVariants(impliesExpressions);
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
      defaultsTyped: typedDefaults,
      ranges: rangesTyped.map((range) => range.raw || `${range.minRaw} ${range.maxRaw}`),
      rangesTyped,
      promptIf,
      promptConditions: promptConditions.length ? promptConditions : promptIf,
      visibleIf,
      menuVisibleIf,
      directDepends,
      inheritedDepends,
      directVisibleIf,
      inheritedVisibleIf,
      inheritedMenuVisibleIf,
      visibility: {
        promptIf,
        menuVisibleIf,
        effective: visibleIf,
        direct: directVisibleIf,
        inherited: inheritedVisibleIf,
        inheritedMenu: inheritedMenuVisibleIf,
      },
      optionFlags,
      options,
      modules: optionFlags.includes('modules') || Boolean(recordFlags & flags.modules),
      optional: Boolean(recordFlags & flags.optional),
      nodes,
      path: firstDefinition.path || [],
      parent: firstDefinition.parent || '',
      locations: definitionRows.map((definition) => definition.location).filter(Boolean),
      sources: unique(definitionRows.map((definition) => definition.source)),
      // Keep the first definition as the aggregate semantic surface.  The
      // variants retain every definition; flattening a multi-definition symbol
      // here duplicates conditions and changes dependency proof semantics.
      dependsAst: firstDefinition.dependsAst || [],
      dependsAstVariants,
      directDependsAst: firstDefinition.directDependsAst || [],
      directDependsAstVariants,
      inheritedDependsAst: firstDefinition.inheritedDependsAst || [],
      inheritedDependsAstVariants,
      selectRelations: selectRelationsVariants.flat(),
      selectRelationsVariants,
      implyRelations: implyRelationsVariants.flat(),
      implyRelationsVariants,
      promptIfAst: firstDefinition.promptIfAst || [],
      visibleIfAst: firstDefinition.visibleIfAst || [],
      menuVisibleIfAst: firstDefinition.menuVisibleIfAst || [],
      directVisibleIfAst: firstDefinition.directVisibleIfAst || [],
      inheritedVisibleIfAst: firstDefinition.inheritedVisibleIfAst || [],
      inheritedMenuVisibleIfAst: firstDefinition.inheritedMenuVisibleIfAst || [],
      kconfig: {
        dependsExpressions, selectsExpressions, impliesExpressions,
        dependsVariants, selectsVariants, impliesVariants,
        depends: unique(dependsVariants.flat()),
        dependsAllSymbols: allSymbols(dependsExpressions),
        selectsAllSymbols: allSymbols(selectsExpressions),
        impliesAllSymbols: allSymbols(impliesExpressions),
        directDepends, inheritedDepends,
        selects: unique(selectsVariants.flat()), implies: unique(impliesVariants.flat()),
        defaultsTyped: typedDefaults, rangesTyped,
        dependsAst: firstDefinition.dependsAst || [], dependsAstVariants,
        directDependsAst: firstDefinition.directDependsAst || [], directDependsAstVariants,
        inheritedDependsAst: firstDefinition.inheritedDependsAst || [], inheritedDependsAstVariants,
        selectRelations: selectRelationsVariants.flat(), selectRelationsVariants,
        implyRelations: implyRelationsVariants.flat(), implyRelationsVariants,
        promptIfAst: firstDefinition.promptIfAst || [], visibleIfAst: firstDefinition.visibleIfAst || [],
        menuVisibleIfAst: firstDefinition.menuVisibleIfAst || [], directVisibleIfAst: firstDefinition.directVisibleIfAst || [],
        inheritedVisibleIfAst: firstDefinition.inheritedVisibleIfAst || [],
        inheritedMenuVisibleIfAst: firstDefinition.inheritedMenuVisibleIfAst || [],
      },
      packageInfo: {
        depends: packageDepends,
        rawDepends: packageDepends.map((item) => item.raw),
        dependencyRelations: packageDepends,
        provides, conflicts,
        packageConflicts, kconfigConflicts,
        providesRelations: capabilityRows.provides || [],
        conflictsRelations: capabilityRows.conflicts || [],
      },
      packageDepends: packageDepends.map((item) => item.raw),
      dependencyPackages: unique(packageDepends.flatMap((item) => item.packages || [])),
      provides,
      conflicts,
      packageConflicts,
      kconfigConflicts,
      providesRelations: capabilityRows.provides || [],
      conflictsRelations: capabilityRows.conflicts || [],
      dependencyRelations: packageDepends,
    };
  });
  // Completeness is a producer assertion, never inferred from the presence of
  // a capability name.  A stale/partial payload that happens to retain the
  // capability list must remain inconclusive to Worker planning.
  const complete = compact.relationsComplete === true;
  const packageClosure = packageClosureContract(compact);
  const validation = {
    ...(compact.validation || {}),
    ...(complete ? { relationsComplete: true } : { relationsComplete: false }),
  };
  return {
    schema: 2,
    records,
    indexes: {
      ...(schema4 ? { byPackage: recordIndexes(compact.indexes?.byPackage),
        bySymbol: recordIndexes(compact.indexes?.bySymbol) } : {}),
      providers: indexes(compact.indexes?.providers),
      reverseDependencies: indexes(compact.indexes?.reverseDependencies),
      reverseKconfig: indexes(compact.indexes?.reverseKconfig),
      ...(schema4 ? { reverseSelects: indexes(compact.indexes?.reverseSelects),
        reverseImplies: indexes(compact.indexes?.reverseImplies) } : {}),
      choices: indexes(compact.indexes?.choices),
      ...(schema4 ? { forwardEdges: decodeNumericIndex(compact.indexes?.forwardEdges),
        reverseEdges: decodeNumericIndex(compact.indexes?.reverseEdges) } : {}),
    },
    ...(schema4 ? { choices: compact.choices || [], edges: decodeEdgeRows() } : {}),
    summary: compact.summary || {},
    relationsComplete: complete,
    capabilities: compact.relationCapabilities || [],
    packageClosureComplete: packageClosure.complete,
    packageClosureCapabilities: packageClosure.capabilities,
    packageClosureValidation: packageClosure.validation,
    validation,
  };
}

function normalizeRecord(record) {
  const explicitKind = String(record?.kind || '').trim().toLowerCase();
  const isVirtual = explicitKind === 'virtual' || record?.virtual === true || record?.isVirtual === true;
  const rawConfigSymbol = record.configSymbol || record.symbol ||
    (record.package ? `PACKAGE_${record.package}` : '');
  // Virtual capabilities are relation names, never Kconfig symbols or
  // concrete packages.  Keep their name only as provenance; otherwise a
  // generic PACKAGE_/CONFIG_ fallback would manufacture a fake Probe root
  // such as CONFIG_libudev.
  const configSymbol = isVirtual ? '' : rawConfigSymbol;
  const packageName = isVirtual ? '' : (record.package || packageNameFromSymbol(configSymbol));
  const rawStates = Array.isArray(record.states) ? record.states : [];
  const type = String(record.type || (rawStates.includes('m') ? 'tristate' : rawStates.length ? 'bool' : ''))
    .toLowerCase();
  const dependsExpressions = record.kconfig?.dependsExpressions ||
    (record.kconfig?.dependsVariants || []).map((row) => row) || [];
  const selectsExpressions = record.kconfig?.selectsExpressions ||
    (record.kconfig?.selectsVariants || []).map((row) => row) || [];
  const impliesExpressions = record.kconfig?.impliesExpressions ||
    (record.kconfig?.impliesVariants || []).map((row) => row) || [];
  const normalizeAstRows = (value) => {
    if (value === undefined || value === null) return [];
    const rows = Array.isArray(value) ? value.flatMap((row) => Array.isArray(row) ? row : [row]) : [value];
    return rows.filter((row) => row !== undefined).map(normalizeExpressionAst);
  };
  const normalizeAstVariants = (value) => Array.isArray(value)
    ? value.map((row) => row === null ? [normalizeExpressionAst(null)] : normalizeAstRows(row)) : [];
  const astSource = (field) => record[field] ?? record.kconfig?.[field] ?? record.visibility?.[field];
  const astVariantsSource = (field) => record[`${field}Variants`] ?? record.kconfig?.[`${field}Variants`];
  const dependsAstVariants = normalizeAstVariants(astVariantsSource('dependsAst'));
  const directDependsAstVariants = normalizeAstVariants(astVariantsSource('directDependsAst'));
  const inheritedDependsAstVariants = normalizeAstVariants(astVariantsSource('inheritedDependsAst'));
  const promptIfAst = normalizeAstRows(astSource('promptIfAst'));
  const visibleIfAst = normalizeAstRows(astSource('visibleIfAst'));
  const menuVisibleIfAst = normalizeAstRows(astSource('menuVisibleIfAst'));
  const directVisibleIfAst = normalizeAstRows(astSource('directVisibleIfAst'));
  const inheritedVisibleIfAst = normalizeAstRows(astSource('inheritedVisibleIfAst'));
  const inheritedMenuVisibleIfAst = normalizeAstRows(astSource('inheritedMenuVisibleIfAst'));
  const dependsAst = normalizeAstRows(astSource('dependsAst') ?? dependsAstVariants);
  const directDependsAst = normalizeAstRows(astSource('directDependsAst') ?? directDependsAstVariants);
  const inheritedDependsAst = normalizeAstRows(astSource('inheritedDependsAst') ?? inheritedDependsAstVariants);
  const selectRelations = kconfigRelationRows(record, 'select');
  const implyRelations = kconfigRelationRows(record, 'imply');
  const packageDepends = record.packageInfo?.depends || (record.packageDepends || []).map((raw) => ({
    raw,
    required: String(raw).startsWith('+') || !String(raw).startsWith('@'),
    condition: '',
    packages: [String(raw).replace(/^\+/, '').split(':').at(-1).replace(/^PACKAGE_/, '')],
  }));
  return {
    ...record,
    ...(isVirtual ? { virtualName: String(record.virtualName || record.name || rawConfigSymbol || '')
      .replace(/^PACKAGE_/, '') } : {}),
    kind: isVirtual ? 'virtual' : (record.kind || (configSymbol.startsWith('PACKAGE_') ? 'package' : 'config')),
    package: packageName,
    configSymbol,
    kconfigSymbol: isVirtual ? '' : (record.kconfigSymbol || record.symbol || ''),
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
      dependsAst,
      dependsAstVariants,
      directDependsAst,
      directDependsAstVariants,
      inheritedDependsAst,
      inheritedDependsAstVariants,
      selectRelations,
      implyRelations,
      promptIfAst,
      visibleIfAst,
      menuVisibleIfAst,
      directVisibleIfAst,
      inheritedVisibleIfAst,
      inheritedMenuVisibleIfAst,
    },
    dependsAst,
    dependsAstVariants,
    directDependsAst,
    directDependsAstVariants,
    inheritedDependsAst,
    inheritedDependsAstVariants,
    selectRelations,
    implyRelations,
    promptIfAst,
    visibleIfAst,
    menuVisibleIfAst,
    directVisibleIfAst,
    inheritedVisibleIfAst,
    inheritedMenuVisibleIfAst,
    packageInfo: {
      ...(record.packageInfo || {}),
      depends: packageDepends,
    },
  };
}

function catalogSymbolTypes(relations, records) {
  const types = new Map();
  for (const record of records || []) {
    const symbol = String(record?.configSymbol || '').trim();
    const type = String(record?.type || '').trim().toLowerCase();
    if (symbol && ['bool', 'tristate', 'string', 'int', 'hex', 'unknown'].includes(type)) {
      types.set(symbol, type);
    }
  }
  // Target projection symbols are not always materialized as records.  The
  // Catalog producer supplies their native type only after a complete source
  // parse; consume that evidence instead of guessing from a TARGET_ prefix.
  if (relations?.validation?.kconfigSymbolProof?.complete !== true) return types;
  for (const row of relations?.validation?.externalSymbolDefinitions || []) {
    const symbol = String(row?.symbol || '').trim();
    const type = String(row?.type || '').trim().toLowerCase();
    if (symbol && !types.has(symbol) && ['bool', 'tristate', 'string', 'int', 'hex', 'unknown'].includes(type)) {
      types.set(symbol, type);
    }
  }
  return types;
}

function catalogUndefinedSymbols(relations, records) {
  const validation = relations?.validation || {};
  if (validation.kconfigSymbolProof?.complete !== true || !Array.isArray(validation.kconfigUndefinedSymbols)) {
    return new Map();
  }
  const defined = new Set((records || []).map((record) => String(record?.configSymbol || '').trim()).filter(Boolean));
  const result = new Map();
  for (const row of validation.kconfigUndefinedSymbols) {
    const owner = String(row?.symbol || '').trim();
    const missing = String(row?.missing || '').trim();
    if (!owner || !missing || defined.has(missing) || row?.reason !== 'undefined-kconfig-symbol' ||
        row?.nativeType !== 'unknown' || row?.booleanValue !== 'n' ||
        String(row?.stringValue ?? missing) !== missing) continue;
    result.set(missing, { ...row, symbol: owner, missing });
  }
  return result;
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

function normalizeChoiceDetail(choice, members = []) {
  if (!choice || typeof choice !== 'object') return null;
  const id = String(choice.id || '').trim();
  if (!id) return null;
  const astRows = (field) => {
    const value = choice[field] ?? choice[`${field}Variants`] ?? choice.visibility?.[field];
    if (value === undefined || value === null) return [];
    const rows = Array.isArray(value) ? value.flatMap((row) => Array.isArray(row) ? row : [row]) : [value];
    return rows.filter((row) => row !== undefined).map(normalizeExpressionAst);
  };
  const dependsAst = astRows('dependsAst');
  const resetIfAst = astRows('resetIfAst');
  const promptIfAst = astRows('promptIfAst');
  const visibleIfAst = astRows('visibleIfAst');
  const menuVisibleIfAst = astRows('menuVisibleIfAst');
  const directVisibleIfAst = astRows('directVisibleIfAst');
  const inheritedVisibleIfAst = astRows('inheritedVisibleIfAst');
  const inheritedMenuVisibleIfAst = astRows('inheritedMenuVisibleIfAst');
  return {
    ...choice,
    id,
    type: String(choice.type || '').toLowerCase(),
    optional: choice.optional === true,
    modules: choice.modules === true || (choice.optionFlags || []).includes('modules'),
    depends: Array.isArray(choice.depends) ? choice.depends.map(String).filter(Boolean) : [],
    dependsAst,
    // Keep the producer's reset condition spelling and its typed AST together.
    // The browser may inspect this pair only for an interactive choice switch;
    // import/validation paths must not consume it as an automatic reset.
    resetIf: choice.resetIf ?? choice.resetIfVariants ?? [],
    resetIfAst,
    promptIfAst,
    visibleIfAst,
    menuVisibleIfAst,
    directVisibleIfAst,
    inheritedVisibleIfAst,
    inheritedMenuVisibleIfAst,
    defaults: Array.isArray(choice.defaults) ? [...choice.defaults] : [],
    defaultsTyped: Array.isArray(choice.defaultsTyped) ? [...choice.defaultsTyped] : [],
    ranges: Array.isArray(choice.ranges) ? [...choice.ranges] : [],
    rangesTyped: Array.isArray(choice.rangesTyped) ? [...choice.rangesTyped] : [],
    members: unique([...(choice.members || []), ...members]),
  };
}

function flattenExpressionRows(value) {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.flatMap(flattenExpressionRows);
  return [value];
}

function expressionAstRaw(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? String(value.raw || '').trim() : '';
}

function evaluateExpressionConditionRows(rawValue, astValue, inputValues, options = {}) {
  const rawRows = flattenExpressionRows(rawValue).filter((row) => String(row || '').trim());
  const astRows = flattenExpressionRows(astValue).filter((row) => row !== undefined && row !== null);
  const typed = options.typedRelationsComplete === true;
  if (!astRows.length) {
    return typed && rawRows.length
      ? rawRows.map(() => UNKNOWN)
      : rawRows.map((row) => evaluateExpressionRaw(row, inputValues, options));
  }
  const levels = [];
  const count = Math.max(rawRows.length, astRows.length);
  for (let index = 0; index < count; index++) {
    const raw = rawRows[index];
    const ast = astRows[index];
    if (ast === undefined || ast === null) { levels.push(UNKNOWN); continue; }
    const astRaw = expressionAstRaw(ast);
    if (raw !== undefined && astRaw && String(raw).trim() !== astRaw) {
      levels.push(UNKNOWN);
      continue;
    }
    const astLevel = expressionAstDependencyProof(ast, inputValues, options).level;
    if (raw === undefined) { levels.push(astLevel); continue; }
    const rawLevel = evaluateExpressionRaw(raw, inputValues, options);
    levels.push(astLevel === UNKNOWN || rawLevel === UNKNOWN || astLevel !== rawLevel ? UNKNOWN : astLevel);
  }
  return levels;
}

function conditionStateFromLevels(levels, requirements = []) {
  if (levels.some((level) => level === 0)) return { status: 'unsatisfied', maximum: 0, requirements };
  if (levels.some((level) => level === UNKNOWN)) return { status: 'deferred', maximum: 0, requirements };
  return { status: 'satisfied', maximum: levels.reduce((minimum, level) => Math.min(minimum, level), 2), requirements };
}

function evaluateKconfigRelationCondition(relation, inputValues, options = {}) {
  const normalized = kconfigRelationParts(relation);
  return evaluateExpressionConditionRows(normalized.condition, normalized.conditionAst,
    inputValues, options)[0] ?? 2;
}

export function createCatalogModel(catalog) {
  const schema = Number(catalog?.schema || 0);
  const relationsSchema = Number(catalog?.relations?.schema || 0);
  if (!catalog || schema < 5 || ![2, 3, 4, 5].includes(relationsSchema)) {
    throw new Error('Catalog schema 5+ / relations schema 2, 3, 4, or 5 is required');
  }
  const relations = [3, 4, 5].includes(relationsSchema) ? expandCompactRelations(catalog.relations) : catalog.relations;
  const packageClosure = packageClosureContract(relations);
  const records = (relations.records || []).map(normalizeRecord);
  const symbolTypes = catalogSymbolTypes(relations, records);
  const undefinedKconfigSymbols = catalogUndefinedSymbols(relations, records);
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
  const addProvider = (name, provider) => {
    // Provides uses a leading @ as metadata, unlike a Depends @ condition.
    const capability = packageCapabilityName(name).replace(/^@/, '');
    const owner = packageCapabilityName(provider);
    if (!capability || !byPackage.has(owner)) return;
    const rows = providers.get(capability) || new Set();
    rows.add(owner);
    providers.set(capability, rows);
  };
  for (const [name, rows] of Object.entries(relations.indexes?.providers || {})) {
    for (const owner of rows) addProvider(name, owner);
  }
  // Legacy/readable records may carry providers without an authored index.
  // Reconstruct that index once, not once per dependency per validation pass.
  for (const record of records) {
    for (const value of [...(record.provides || []), ...(record.packageInfo?.provides || []),
      ...(record.providesRelations || []), ...(record.packageInfo?.providesRelations || [])]) {
      addProvider(typeof value === 'object' ? (value.name || value.raw || '') : value, record.package);
    }
  }
  for (const [name, rows] of providers) providers.set(name, [...rows]);
  const packageProviders = new Map([...byPackage].map(([name, record]) => [name, [record]]));
  for (const [name, rows] of providers) {
    packageProviders.set(name, [...new Set([
      ...(packageProviders.get(name) || []), ...rows.map((owner) => byPackage.get(owner)),
    ])]);
  }
  const reverseDependencies = new Map();
  // Derive a trusted reverse index from forward facts once per model. Old
  // authored reverse indexes can be stale; do not rescan all records for
  // every disabled/orphan candidate during configuration import.
  const forwardDependents = new Map();
  const addDependent = (target, source) => {
    if (!target || target === source) return;
    const rows = forwardDependents.get(target) || new Set();
    rows.add(source); forwardDependents.set(target, rows);
  };
  for (const record of records) {
    for (const reference of recordForwardReferences(record)) {
      for (const alias of symbolAliases(reference)) {
        if (bySymbol.has(alias)) addDependent(alias, record.configSymbol);
      }
    }
    for (const dependency of record.packageInfo?.depends || []) {
      const names = [...(dependency.packages || []), ...(dependency.targets || []).map((row) =>
        typeof row === 'object' ? row.name || row.raw || '' : row)];
      for (const name of names) for (const target of packageProviders.get(packageCapabilityName(name)) || []) {
        addDependent(target.configSymbol, record.configSymbol);
      }
    }
  }
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
  const indexRelations = (index, source, rows) => {
    for (const relation of rows || []) {
      const target = relationTarget(relation);
      if (!target) continue;
      const sources = index.get(target) || [];
      if (!sources.includes(source)) sources.push(source);
      index.set(target, sources);
    }
  };
  for (const record of records) {
    indexRules(reverseSelects, record.configSymbol, record.kconfig?.selectsExpressions);
    indexRules(reverseImplies, record.configSymbol, record.kconfig?.impliesExpressions);
    indexRelations(reverseSelects, record.configSymbol, record.kconfig?.selectRelations);
    indexRelations(reverseImplies, record.configSymbol, record.kconfig?.implyRelations);
  }
  const choices = new Map();
  for (const [id, rows] of Object.entries(relations.indexes?.choices || {})) choices.set(id, [...rows]);
  const choiceDetails = new Map();
  const rawChoices = Array.isArray(relations.choices) ? relations.choices :
    (relations.choices && typeof relations.choices === 'object' ? Object.values(relations.choices) : []);
  for (const rawChoice of rawChoices) {
    const id = String(rawChoice?.id || '').trim();
    if (!id) continue;
    const detail = normalizeChoiceDetail(rawChoice, choices.get(id) || []);
    if (!detail) continue;
    choiceDetails.set(id, detail);
    if (!choices.has(id)) choices.set(id, [...detail.members]);
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
  const declaredRelationsComplete = relations.relationsComplete === true ||
    relations.validation?.relationsComplete === true;
  const capabilities = relationCapabilities(relations);
  const typedRelationsComplete = declaredRelationsComplete &&
    REQUIRED_KCONFIG_RELATION_CAPABILITIES.every((capability) => capabilities.includes(capability));
  return {
    schema: 1,
    catalog,
    records,
    bySymbol,
    byPackage,
    providers,
    packageProviders,
    forwardDependents,
    reverseDependencies,
    reverseKconfig,
    reverseSelects,
    reverseImplies,
    promptlessDefaultRecords: records.filter((record) =>
      record.hidden === true && record.userSettable === false && ['bool', 'tristate'].includes(record.type) &&
      Array.isArray(record.defaults) && record.defaults.length > 0),
    choices,
    choiceDetails,
    featureSymbols,
    targetFeatureSymbols,
    archSymbols,
    closedDefaultSymbols,
    symbolTypes,
    undefinedKconfigSymbols,
    // Preserve the producer-declared capability/edge surfaces for consumers
    // that need to distinguish a complete graph from a legacy readable one.
    relationCapabilities: capabilities,
    edges: [...(relations.edges || [])],
    relationsSchema,
    // New graph-derived planning is only deterministic when the producer
    // explicitly declares the relation capability.  Legacy schemas remain
    // readable, but a missing declaration is not silently promoted to a
    // complete graph.
    // Keep the producer assertion and the complete typed-Kconfig contract
    // separate.  The latter is required for deterministic typed preflight;
    // schema-2 readable assets retain their historical assertion for legacy
    // expression consumers only.
    relationsComplete: typedRelationsComplete,
    declaredRelationsComplete,
    typedRelationsComplete,
    relationValidation: relations.validation || {},
    packageClosureComplete: packageClosure.complete,
    packageClosureCapabilities: packageClosure.capabilities,
    packageClosureValidation: packageClosure.validation,
  };
}

function choiceDependencyRows(choice) {
  const ast = Array.isArray(choice?.dependsAst) ? choice.dependsAst.filter(Boolean) : [];
  const raw = Array.isArray(choice?.depends) ? choice.depends.flatMap(nestedExpressionStrings).filter(Boolean) : [];
  return { ast, raw };
}

function choiceDependencyState(model, choice, values, options = {}) {
  const rows = choiceDependencyRows(choice);
  const levels = [
    ...evaluateExpressionConditionRows(rows.raw, rows.ast, values, options),
    ...evaluateExpressionConditionRows(choice?.promptIf, choice?.promptIfAst, values, options),
    ...evaluateExpressionConditionRows(choice?.visibleIf, choice?.visibleIfAst, values, options),
    ...evaluateExpressionConditionRows(choice?.menuVisibleIf, choice?.menuVisibleIfAst, values, options),
  ];
  const requirements = [
    ...flattenExpressionRows(rows.raw), ...flattenExpressionRows(choice?.promptIf),
    ...flattenExpressionRows(choice?.visibleIf), ...flattenExpressionRows(choice?.menuVisibleIf),
  ].filter(Boolean);
  return conditionStateFromLevels(levels, requirements);
}

// Kconfig's choice reset-if properties are evaluated only by the interactive
// frontends while changing a non-Y member to Y.  Native mconf/nconf then clear
// the global user definition layer, not merely the choice members.  The
// browser has no equivalent global user-layer reset, so retain the condition
// in the model and fail closed at that one interaction boundary.  Static
// validation/import/reconstruction never calls this helper.
function choiceResetConditionState(model, choice, values, options = {}) {
  const rawRows = flattenExpressionRows(choice?.resetIf)
    .filter((row) => String(row || '').trim());
  const astRows = flattenExpressionRows(choice?.resetIfAst)
    .filter((row) => row !== undefined && row !== null);
  if (!rawRows.length && !astRows.length) return {
    status: 'unsatisfied', maximum: 0, levels: [], reason: 'no-reset-condition',
  };
  if (model?.typedRelationsComplete !== true) return {
    status: 'deferred', maximum: 0, levels: [UNKNOWN],
    reason: 'missing-choice-reset-capability',
  };
  const levels = evaluateExpressionConditionRows(rawRows, astRows, values, {
    ...options, typedRelationsComplete: true,
  });
  // P_RESET is an OR over the individual reset-if properties: a condition is
  // effective when its expression is M or Y.  An unresolved row therefore
  // remains deferred only when no other row has already proven a reset.
  if (levels.some((level) => level > 0)) return {
    status: 'satisfied', maximum: Math.max(...levels), levels,
    reason: 'native-reset-required',
  };
  if (levels.some((level) => level === UNKNOWN)) return {
    status: 'deferred', maximum: 0, levels,
    reason: 'unknown-reset-condition',
  };
  return { status: 'unsatisfied', maximum: 0, levels, reason: 'reset-condition-false' };
}

function throwChoiceResetIntentError(choice, symbol, value, current, state, constraints = null) {
  const deferred = state.status === 'deferred';
  const mode = deferred ? 'deferred' : 'unsupported';
  const violation = {
    code: deferred ? 'choice-reset-deferred' : 'choice-reset-unsupported',
    choice: String(choice?.id || ''),
    symbol,
    current,
    requested: value,
    status: state.status,
    reason: state.reason,
    levels: [...(state.levels || [])],
    resetIf: choice?.resetIf ?? [],
    resetIfAst: choice?.resetIfAst ?? [],
    deferred,
    unsupported: !deferred,
  };
  const message = deferred
    ? `${choice?.id || 'choice'} reset condition is deferred; the typed reset contract is unavailable or unresolved`
    : `${choice?.id || 'choice'} selection requires a native user-layer reset, which is not supported by the browser evaluator`;
  const error = new Error(message);
  error.name = 'CatalogIntentError';
  error.intent = { symbol, value };
  if (constraints) error.constraints = constraints;
  error.choiceReset = {
    mode, choice: violation.choice, symbol, current, requested: value,
    reason: state.reason, levels: violation.levels,
  };
  error.violations = [violation];
  error.deferred = deferred;
  error.unsupported = !deferred;
  throw error;
}

function choiceDefaultMember(model, choice, values, options = {}) {
  const dependency = choiceDependencyState(model, choice, values, options);
  if (dependency.status !== 'satisfied') return null;
  const defaults = Array.isArray(choice?.defaultsTyped) && choice.defaultsTyped.length
    ? choice.defaultsTyped : (choice?.defaults || []);
  const members = new Set(choice?.members || []);
  for (const raw of defaults) {
    const { valueExpression, condition } = defaultParts(raw);
    if (!valueExpression) continue;
    const conditionLevel = evaluateExpressionRaw(condition, values, options);
    if (conditionLevel === 0) continue;
    if (conditionLevel === UNKNOWN) return null;
    const candidate = String(valueExpression).replace(/^CONFIG_/, '').trim();
    if (members.has(candidate)) return candidate;
  }
  return null;
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
  const contextComplete = options.contextComplete ?? targetContextComplete(resolved);
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
  const closedSymbols = new Set([...(model?.closedDefaultSymbols || []), ...(options.closedSymbols || [])]);
  // A complete Catalog Target/Profile identifies a closed Kconfig universe.
  // Native Profile and lazily loaded menu values can be sparse, so a known
  // bool/tristate symbol absent from the current value map still has the
  // native Kconfig value N.  Keep scalar symbols deferred: their omitted
  // values are not safely inferable from this runtime boundary.
  if (resolved && contextComplete) {
    for (const record of model?.records || []) {
      if (!record?.configSymbol || !['bool', 'tristate'].includes(record.type)) continue;
      if (!context.values.has(record.configSymbol)) closedSymbols.add(record.configSymbol);
    }
  }
  return {
    target: resolved, values: context.values, changes: context.changes, trustedSymbols,
    validationOptions: { phase, contextComplete, trustedSymbols, closedSymbols,
      deferred: options.deferred || 'ignore', typedRelationsComplete: model?.typedRelationsComplete === true,
      symbolTypes: model?.symbolTypes, undefinedSymbols: model?.undefinedKconfigSymbols },
  };
}

export function parseConfigDocument(text) {
  const values = new Map();
  for (const line of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    let match = line.match(/^CONFIG_([A-Za-z0-9_+@.\/-]+)=(.*)$/);
    if (match) {
      const raw = match[2];
      values.set(match[1], raw === 'y' || raw === 'm' || raw === 'n'
        ? raw : decodeKconfigString(raw));
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
  const model = options.model;
  const trustedSymbols = options.trustedSymbols instanceof Set ? options.trustedSymbols : new Set(options.trustedSymbols || []);
  const contextComplete = options.contextComplete ?? Boolean(String(values.get('TARGET_BOARD') || '').trim() &&
    String(values.get('TARGET_SUBTARGET') || '').trim() && String(values.get('TARGET_PROFILE') || '').trim());
  return {
    phase: String(options.phase || 'interactive'), contextComplete, trustedSymbols,
    explicitSymbols: options.explicitSymbols instanceof Set ? options.explicitSymbols : new Set(options.explicitSymbols || []),
    closedSymbols: options.closedSymbols instanceof Set ? options.closedSymbols : new Set(options.closedSymbols || []),
    deferred: options.deferred || 'ignore',
    typedRelationsComplete: options.typedRelationsComplete === true,
    symbolTypes: options.symbolTypes || model?.symbolTypes || new Map(),
    undefinedSymbols: options.undefinedSymbols || model?.undefinedKconfigSymbols || new Map(),
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
    for (const raw of kconfigRelationRows(source, 'select')) {
      const rule = kconfigRelationParts(raw);
      if (rule.symbol !== record.configSymbol) continue;
      const conditionLevel = evaluateKconfigRelationCondition(rule, values, options);
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
    for (const raw of kconfigRelationRows(source, 'imply')) {
      const rule = kconfigRelationParts(raw);
      if (rule.symbol !== record.configSymbol) continue;
      const conditionLevel = evaluateKconfigRelationCondition(rule, values, options);
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
  const normalizedOptions = validationOptions(values, {
    ...options, model, typedRelationsComplete: model?.typedRelationsComplete === true,
  });
  const requestedSymbol = String(record.configSymbol || record.symbol || '').trim();
  const canonical = model?.bySymbol?.get(requestedSymbol) || record;
  const configSymbol = String(canonical.configSymbol || requestedSymbol).trim();
  const moduleLevel = moduleSupportLevel(model, values, normalizedOptions);
  const legalStates = modelKconfigStates(model, canonical, values, normalizedOptions);
  const dependency = dependencyState(canonical, values, 2, normalizedOptions);
  const maximumLevel = dependency.status === 'deferred' ? 2 : dependency.maximum;
  const selectors = effectiveSelectRequirements(model, canonical, values, normalizedOptions);
  const minimumLevel = selectors.reduce((maximum, item) => Math.max(maximum, item.level), 0);
  const visibilityViolations = visibilityKconfigViolations(canonical, values,
    { ...normalizedOptions, deferred: 'error' });
  const readOnly = canonical.userSettable === false || visibilityViolations.length > 0;
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
    minimumLevel, minimum: STATE[minimumLevel], maximumLevel, maximum: STATE[maximumLevel], moduleLevel,
    dependencyStatus: dependency.status, dependencyExpressions: dependency.requirements,
    selectors, states, visibilityViolations };
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

function packageProviderRecords(model, name, { excludePackage = '' } = {}) {
  const capability = packageCapabilityName(name);
  const excluded = packageCapabilityName(excludePackage);
  const candidates = model?.packageProviders?.get(capability) || [];
  return excluded ? candidates.filter((record) => record.package !== excluded) : candidates;
}

function packageSatisfied(model, name, values, options = {}) {
  return packageProviderRecords(model, name, options).some((record) => recordEnabled(record, values));
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

function normalizeRangeRows(record) {
  const rows = Array.isArray(record?.rangesTyped) && record.rangesTyped.length
    ? record.rangesTyped : (record?.ranges || record?.kconfig?.ranges || record?.range || []);
  return (Array.isArray(rows) ? rows : [rows]).map((raw) => {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return {
        minimum: String(raw.minimum ?? raw.min ?? raw.minRaw ?? '').trim(),
        maximum: String(raw.maximum ?? raw.max ?? raw.maxRaw ?? '').trim(),
        condition: String(raw.condition ?? raw.if ?? '').trim(),
      };
    }
    const { valueExpression, condition } = defaultParts(raw);
    const parts = String(valueExpression || '').trim().split(/\s+/).filter(Boolean);
    return { minimum: parts[0] || '', maximum: parts[1] || '', condition };
  }).filter((row) => row.minimum && row.maximum);
}

function scalarRangeNumber(type, value) {
  return parseExpressionInteger(String(value), type)?.value ?? null;
}

function scalarKconfigViolations(record, values, options) {
  const type = String(record?.type || '').toLowerCase();
  if (!['string', 'int', 'hex'].includes(type) || !values.has(record.configSymbol)) return [];
  const value = String(values.get(record.configSymbol));
  if (!scalarValueValid(type, value)) return [{ code: 'kconfig-scalar-invalid', symbol: record.configSymbol,
    package: record.package, type, value }];
  if (type === 'string') return [];
  const actual = scalarRangeNumber(type, value);
  if (actual === null) return [{ code: 'kconfig-scalar-invalid', symbol: record.configSymbol,
    package: record.package, type, value }];
  for (const range of normalizeRangeRows(record)) {
    if (range.condition) {
      const condition = evaluateExpressionRaw(range.condition, values, options);
      if (condition === 0) continue;
      if (condition === UNKNOWN) return [{ code: 'kconfig-range-deferred', symbol: record.configSymbol,
        package: record.package, range, deferred: true }];
    }
    const lower = expressionOperand(range.minimum, values, options);
    const upper = expressionOperand(range.maximum, values, options);
    const minimum = lower.unknownData ? null : scalarRangeNumber(type, lower.stringValue);
    const maximum = upper.unknownData ? null : scalarRangeNumber(type, upper.stringValue);
    if (minimum === null || maximum === null) return [{ code: 'kconfig-range-deferred',
      symbol: record.configSymbol, package: record.package, range, deferred: true }];
    if (actual < minimum || actual > maximum) {
      return [{ code: 'kconfig-range-unsatisfied', symbol: record.configSymbol, package: record.package,
        value, range }];
    }
  }
  return [];
}

function moduleKconfigViolations(model, record, values, options) {
  if (String(record?.type || '').toLowerCase() !== 'tristate' ||
      normalizeValue(values.get(record.configSymbol) ?? 'n') !== 'm') return [];
  const modules = moduleSupportLevel(model, values, options);
  if (modules === 0) return [{ code: 'kconfig-modules-unsatisfied', symbol: record.configSymbol,
    package: record.package, dependency: 'MODULES' }];
  if (modules === UNKNOWN && options.deferred !== 'ignore') return [{
    code: 'kconfig-modules-deferred', symbol: record.configSymbol, package: record.package,
    dependency: 'MODULES', deferred: true,
  }];
  return [];
}

function visibilityKconfigViolations(record, values, options) {
  const conditions = [
    [record?.promptIf || record?.visibility?.promptIf || [], record?.promptIfAst || record?.kconfig?.promptIfAst || []],
    [record?.visibleIf || record?.visibility?.effective || record?.visibility?.visibleIf || [],
      record?.visibleIfAst || record?.kconfig?.visibleIfAst || []],
    [record?.menuVisibleIf || record?.visibility?.menuVisibleIf || [],
      record?.menuVisibleIfAst || record?.kconfig?.menuVisibleIfAst || []],
  ];
  const violations = [];
  for (const [rawRows, astRows] of conditions) {
    const levels = evaluateExpressionConditionRows(rawRows, astRows, values, options);
    const requirements = flattenExpressionRows(rawRows);
    for (let index = 0; index < levels.length; index++) {
      const state = levels[index];
      const condition = requirements[index] || expressionAstRaw(flattenExpressionRows(astRows)[index]) || '';
      if (state === 0) violations.push({ code: 'kconfig-visibility-unsatisfied', symbol: record.configSymbol,
        package: record.package, dependency: condition });
      else if (state === UNKNOWN && options.deferred !== 'ignore') violations.push({
        code: 'kconfig-visibility-deferred', symbol: record.configSymbol, package: record.package,
        dependency: condition, deferred: true,
      });
    }
  }
  return violations;
}

function isKconfigSelectWarning(item) {
  return item?.code === 'kconfig-select-warning' ||
    (item?.warning === true && item?.code === 'kconfig-dependency-unsatisfied' &&
      Array.isArray(item?.selectedBy) && item.selectedBy.length > 0);
}

function kconfigRelationViolations(record, values, options) {
  if (options.typedRelationsComplete !== true) return [];
  const violations = [];
  for (const [kind, rows] of [['select', kconfigRelationRows(record, 'select')],
    ['imply', kconfigRelationRows(record, 'imply')]]) {
    for (const relation of rows) {
      const normalized = kconfigRelationParts(relation);
      if (!normalized.symbol) {
        if (options.deferred !== 'ignore') violations.push({
          code: 'kconfig-relation-deferred', symbol: record.configSymbol, package: record.package,
          relation: kind, dependency: normalized.raw || kind, deferred: true, reason: 'missing-target',
        });
        continue;
      }
      const condition = evaluateExpressionConditionRows(normalized.condition, normalized.conditionAst,
        values, options)[0] ?? 2;
      if (condition === UNKNOWN && options.deferred !== 'ignore') violations.push({
        code: 'kconfig-relation-deferred', symbol: record.configSymbol, package: record.package,
        relation: kind, dependency: normalized.condition || normalized.raw || normalized.symbol,
        deferred: true, reason: 'unknown-condition',
      });
    }
  }
  return violations;
}

function isBlockingViolation(item) {
  return !item?.deferred && !isKconfigSelectWarning(item);
}

function recordViolations(model, record, values, rawOptions = {}) {
  const scalar = ['string', 'int', 'hex'].includes(String(record?.type || '').toLowerCase());
  if (scalar ? !values.has(record.configSymbol) : !recordEnabled(record, values)) return [];
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
  violations.push(...moduleKconfigViolations(model, record, values, options));
  violations.push(...scalarKconfigViolations(record, values, options));
  violations.push(...kconfigRelationViolations(record, values, options));
  // Prompt/menu visibility limits interactive edits, not native default or
  // reverse-selected values. Hidden values are valid serialized Kconfig.
  return violations;
}

export function violationKey(item) {
  if (!item) return '';
  if (item.code === 'package-conflict') return `${item.code}:${[item.package, item.otherPackage,
    ...(item.otherPackages || [])].filter(Boolean).sort().join(':')}:${item.capability || ''}`;
  if (String(item.code || '').startsWith('choice-')) return `${item.code}:${item.choice}:${[...(item.symbols || [])].sort().join(',')}`;
  return `${item.code}:${item.symbol || item.package || ''}:${item.dependency || item.value || ''}`;
}

function formatKconfigRequirements(requirements = []) {
  return requirements.map((group) => (group || []).filter(Boolean).join(' && ')).filter(Boolean).join(' || ');
}

export function validateConfig(model, inputValues, rawOptions = {}) {
  const values = valuesMap(inputValues);
  const options = validationOptions(values, {
    ...rawOptions, model,
    typedRelationsComplete: model?.typedRelationsComplete === true,
  });
  const violations = [];
  for (const record of model.records) violations.push(...recordViolations(model, record, values, options));
  const conflictKeys = new Set();
  for (const record of model.records) {
    if (!recordEnabled(record, values)) continue;
    for (const otherName of record.conflicts || record.packageInfo?.conflicts || []) {
      const capability = String(otherName || '').replace(/^PACKAGE_/, '');
      // A package commonly provides the capability it conflicts with.  Native
      // Kconfig treats that as the owner, not as a conflict with itself.  Only
      // another enabled concrete provider can form a real package conflict.
      const allProviders = packageProviderRecords(model, capability);
      const providers = allProviders
        .filter((provider) => provider.package !== record.package && recordEnabled(provider, values));
      if (!providers.length) {
        if (!allProviders.length && model.relationsComplete === true) {
          violations.push({ code: 'package-conflict-deferred', package: record.package,
            capability, deferred: true, reason: 'provider-missing' });
        }
        continue;
      }
      const names = providers.map((provider) => provider.package).sort();
      const pair = [record.package, ...(names.length === 1 ? names : [capability])].sort();
      const key = `${pair.join('\0')}\0${capability}`;
      if (conflictKeys.has(key)) continue;
      conflictKeys.add(key);
      violations.push({ code: 'package-conflict', package: record.package,
        capability, ...(names.length === 1 ? { otherPackage: names[0] } : {
          otherPackages: names, ambiguous: true,
        }) });
    }
  }
  for (const [choice, symbols] of model.choices) {
    const detail = model.choiceDetails?.get(choice);
    const selected = symbols.filter((symbol) => normalizeValue(values.get(symbol) ?? 'n') === 'y');
    const enabled = symbols.filter((symbol) => stateLevel(values.get(symbol) ?? 'n') > 0);
    if (detail && enabled.length) {
      const dependency = choiceDependencyState(model, detail, values, options);
      if (dependency.status === 'unsatisfied') violations.push({ code: 'choice-dependency-unsatisfied',
        choice, symbols: enabled, requirements: dependency.requirements });
      else if (dependency.status === 'deferred' && options.deferred !== 'ignore') violations.push({
        code: 'choice-dependency-deferred', choice, symbols: enabled,
        requirements: dependency.requirements, deferred: true,
      });
      if (String(detail.type || '').toLowerCase() === 'bool' &&
          enabled.some((symbol) => normalizeValue(values.get(symbol) ?? 'n') === 'm')) {
        violations.push({ code: 'choice-state-invalid', choice, symbols: enabled, state: 'm' });
      }
      if (String(detail.type || '').toLowerCase() === 'tristate' && detail.modules !== true &&
          enabled.some((symbol) => normalizeValue(values.get(symbol) ?? 'n') === 'm')) {
        violations.push({ code: 'choice-modules-unsatisfied', choice, symbols: enabled,
          dependency: 'choice modules' });
      }
    }
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

function enabledState(model, record, requested, values = new Map(), options = {}) {
  if (requested === 'm' && record?.states?.includes('m')) {
    return moduleSupportLevel(model, values, options) === 0 ? 'n' : 'm';
  }
  return 'y';
}

function applyKconfigRules(model, record, requested, values, changes, options = {}) {
  for (const raw of kconfigRelationRows(record, 'select')) {
    const { symbol, condition, conditionAst } = kconfigRelationParts(raw);
    if (!symbol) continue;
    const conditionLevel = evaluateKconfigRelationCondition({ condition, conditionAst }, values, options);
    if (conditionLevel === UNKNOWN || conditionLevel === 0) continue;
    const target = model.bySymbol.get(symbol);
    if (!target) continue;
    const requiredLevel = selectRequirement(target, requested, conditionLevel);
    // A reverse select cannot make a target with dir_dep=N active.  This is
    // deliberately a generic Kconfig rule; do not special-case package or
    // source names here.
    if (dependencyLevel(target, values, options) === 0) continue;
    if (stateLevel(values.get(symbol) ?? 'n') >= requiredLevel) continue;
    setValue(values, changes, symbol, stateForKconfigLevel(model, target, requiredLevel, values, options),
      'select', record.configSymbol);
  }
}

function applyImplyRules(model, record, requested, values, changes, options = {}) {
  for (const raw of kconfigRelationRows(record, 'imply')) {
    const { symbol, condition, conditionAst } = kconfigRelationParts(raw);
    const target = model.bySymbol.get(symbol);
    if (!target || options.explicitSymbols?.has(symbol)) continue;
    const conditionLevel = evaluateKconfigRelationCondition({ condition, conditionAst }, values, options);
    if (conditionLevel === UNKNOWN || conditionLevel === 0) continue;
    let requiredLevel = selectRequirement(target, requested, conditionLevel);
    const maximum = dependencyLevel(target, values, options);
    if (maximum !== UNKNOWN) requiredLevel = Math.min(requiredLevel, maximum);
    if (stateLevel(values.get(symbol) ?? 'n') >= requiredLevel) continue;
    setValue(values, changes, symbol, stateForKconfigLevel(model, target, requiredLevel, values, options),
      'imply', record.configSymbol);
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
    enabledState(model, target, requested, values, options), 'kconfig-dependency', record.configSymbol);
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
    setValue(values, changes, target.configSymbol, enabledState(model, target, requested, values, options),
      'package-dependency', record.configSymbol);
  }
}

function symbolAliases(symbol) {
  const value = String(symbol || '').trim();
  if (!value) return new Set();
  const unprefixed = value.replace(/^CONFIG_/, '');
  return new Set([value, unprefixed, `CONFIG_${unprefixed}`]);
}

function recordForwardReferences(record) {
  const symbols = new Set();
  const addExpressions = (rows) => {
    const visit = (expression) => {
      if (Array.isArray(expression)) {
        for (const child of expression) visit(child);
      } else if (typeof expression === 'string') {
        for (const symbol of referencedExpressionSymbols(expression)) symbols.add(symbol);
      } else if (expression && typeof expression === 'object') {
        for (const symbol of expressionAstSymbols(expression)) symbols.add(symbol);
      }
    };
    visit(rows);
  };
  const addAsts = (rows) => {
    for (const row of rows || []) for (const symbol of expressionAstSymbols(row)) symbols.add(symbol);
  };
  addExpressions(record?.kconfig?.dependsExpressions);
  addExpressions(record?.kconfig?.dependsVariants);
  addExpressions(record?.directDepends);
  addExpressions(record?.inheritedDepends);
  addAsts(record?.kconfig?.dependsAst);
  addAsts(record?.kconfig?.dependsAstVariants);
  // A typed select/imply relation points forward to its target. Its condition
  // is also a real Kconfig reference, so retain both pieces for candidate
  // discovery; the current-state evaluator below decides whether it is active.
  for (const kind of ['select', 'imply']) {
    for (const relation of kconfigRelationRows(record, kind)) {
      const target = relationTarget(relation);
      if (target) symbols.add(target);
      for (const symbol of expressionAstSymbols(relation?.conditionAst)) symbols.add(symbol);
      for (const symbol of referencedExpressionSymbols(relation?.condition || '')) symbols.add(symbol);
    }
  }
  return symbols;
}

function reverseCandidates(model, record) {
  // Reverse indexes are an acceleration hint only.  Stale indexes have been
  // observed in older Catalog assets, and using one without checking the
  // dependent's forward relation can disable an unrelated enabled option or
  // keep an orphan package alive.  Prove every candidate from its own
  // dependency/select/imply/package-provider data before returning it.
  return [...(model?.forwardDependents?.get(record.configSymbol) || [])];
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
  for (const raw of kconfigRelationRows(record, 'select')) {
    const rule = kconfigRelationParts(raw);
    if (rule.symbol !== targetSymbol) continue;
    const conditionLevel = evaluateKconfigRelationCondition(rule, values, options);
    if (conditionLevel !== UNKNOWN && selectRequirement({ type: 'tristate' }, values.get(record.configSymbol) ?? 'n', conditionLevel) > 0) return true;
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
    const beforeRows = recordViolations(model, candidate, values, { ...options, deferred: 'error' });
    const afterRows = recordViolations(model, candidate, testValues, { ...options, deferred: 'error' });
    // An unresolved surviving consumer cannot prove that this dependency is
    // unused. Preserve it until the native condition can be evaluated.
    if (beforeRows.some((item) => item.deferred) || afterRows.some((item) => item.deferred)) return true;
    const before = new Set(beforeRows.filter(isBlockingViolation).map(violationKey));
    const after = afterRows.filter(isBlockingViolation);
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
        if (setValue(values, changes, targetSymbol, stateForKconfigLevel(model, target, minimum, values, options), 'select',
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
        progress = setValue(values, changes, targetSymbol, stateForKconfigLevel(model, target, minimum, values, options), 'imply',
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
  if (dependencyMaximum === UNKNOWN) return null;
  let defaultLevel = stateLevel(resolved.value);
  if (dependencyMaximum !== UNKNOWN) defaultLevel = Math.min(defaultLevel, dependencyMaximum);
  const selectors = effectiveSelectRequirements(model, record, values, options);
  const selectorLevel = selectors.reduce((maximum, item) => Math.max(maximum, item.level), 0);
  const implies = activeImplyRequirements(model, record, values, options);
  let implyLevel = implies.reduce((maximum, item) => Math.max(maximum, item.level), 0);
  if (dependencyMaximum !== UNKNOWN) implyLevel = Math.min(implyLevel, dependencyMaximum);
  let level = Math.max(defaultLevel, implyLevel, selectorLevel);
  if (record.type === 'bool' && level === 1) level = 2;
  const value = normalizeKconfigStateValue(record, stateForKconfigLevel(model, record, level, values, options));
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
  const options = validationOptions(values, {
    ...rawOptions, model, typedRelationsComplete: model?.typedRelationsComplete === true,
  });
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
  const options = validationOptions(initialValues, {
    ...(intent.validationOptions || {}), model, typedRelationsComplete: model?.typedRelationsComplete === true,
  });
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
  const options = validationOptions(initialValues, {
    ...(intent?.validationOptions || {}), model, typedRelationsComplete: model?.typedRelationsComplete === true,
  });
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
    constraints.dependencyStatus === 'satisfied' && !constraints.readOnly;
  const systemSelectable = legal && stateLevel(value) >= constraints.minimumLevel &&
    (value === 'n' ? record.canDisable !== false :
      (stateLevel(value) <= constraints.maximumLevel || stateLevel(value) <= constraints.minimumLevel));
  const repairablePositiveIntent = value !== 'n' && constraints.minimumLevel === 0 &&
    constraints.legalStates.includes(value) && !constraints.readOnly;
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
  // Native mconf/nconf may reset the entire user definition layer when a
  // choice reset-if condition is active.  Only a real interactive transition
  // from a non-Y member to Y can reach this boundary.  Do not run this check
  // from import, validateConfig, or Worker reconstruction: those paths model
  // non-interactive conf/defconfig semantics and must remain readable.
  if (record.choice && value === 'y' &&
      normalizeValue(initialValues.get(symbol) ?? 'n') !== 'y') {
    const choice = model.choiceDetails?.get(record.choice);
    if (choice) {
      const resetState = choiceResetConditionState(model, choice, initialValues, options);
      if (resetState.status !== 'unsatisfied') {
        throwChoiceResetIntentError(choice, symbol, value,
          normalizeValue(initialValues.get(symbol) ?? 'n'), resetState, constraints);
      }
    }
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
      const effective = normalizeKconfigStateValue(preferredRecord,
        stateForKconfigLevel(model, preferredRecord, effectiveLevel, values, options));
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

function configurationRepairValidationOptions(values, rawOptions = {}) {
  const nested = rawOptions.validationOptions && typeof rawOptions.validationOptions === 'object'
    ? rawOptions.validationOptions : {};
  const merged = { ...nested };
  for (const key of ['phase', 'contextComplete', 'trustedSymbols', 'explicitSymbols',
    'closedSymbols', 'deferred', 'typedRelationsComplete', 'symbolTypes', 'undefinedSymbols', 'model']) {
    if (Object.hasOwn(rawOptions, key)) merged[key] = rawOptions[key];
  }
  return validationOptions(values, merged);
}

function configurationRepairValue(record, values) {
  const current = values.get(record.configSymbol) ?? 'n';
  if (record.type === 'bool' || record.type === 'tristate') {
    return normalizeKconfigStateValue(record, current, 'n');
  }
  return stateLevel(current) > 0 ? 'y' : 'n';
}

function configurationRepairRecord(model, violation) {
  if (violation?.symbol) return model?.bySymbol?.get(violation.symbol) || null;
  if (violation?.package) return model?.byPackage?.get(violation.package) || null;
  return null;
}

function configurationRepairIntent(rawOptions, validation, value) {
  return {
    dependencySymbols: rawOptions.dependencySymbols,
    protectedSymbols: rawOptions.protectedSymbols,
    preferredValues: rawOptions.preferredValues,
    // validationOptions has already materialized one-shot iterators (the UI
    // passes catalogUserOverrides.keys()).  Reusing rawOptions.explicitSymbols
    // here would hand deriveKconfigPrerequisitePlans an exhausted iterator and
    // accidentally unlock an explicitly protected prerequisite.
    explicitSymbols: validation.explicitSymbols,
    validationOptions: validation,
    value,
  };
}

function configurationRepairCandidate(model, values, violation, rawOptions, validation) {
  if (!['kconfig-dependency-unsatisfied', 'package-dependency-unsatisfied'].includes(violation?.code)) {
    return null;
  }
  const record = configurationRepairRecord(model, violation);
  if (!record?.configSymbol || stateLevel(values.get(record.configSymbol) ?? 'n') <= 0) return null;
  const value = configurationRepairValue(record, values);
  if (value === 'n') return null;
  const intent = configurationRepairIntent(rawOptions, validation, value);
  let result = null;
  let steps = [];
  if (violation.code === 'kconfig-dependency-unsatisfied') {
    const plans = deriveKconfigPrerequisitePlans(model, values, record, value, intent);
    if (!plans.recommended) return null;
    result = plans.recommended;
    steps = plans.recommended.steps || [];
  } else {
    try {
      result = applyUserIntent(model, values, {
        ...intent,
        symbol: record.configSymbol,
        value,
      });
    } catch (error) {
      // A package dependency may also be guarded by a Kconfig expression.  In
      // that case applyUserIntent exposes the same unique prerequisite plan;
      // use it only when it is unambiguous and replayable.  No force path is
      // used here: a failed or ambiguous repair stays unresolved.
      const plans = error?.prerequisitePlans || deriveKconfigPrerequisitePlans(
        model, values, record, value, intent);
      if (!plans?.recommended) return null;
      result = plans.recommended;
      steps = plans.recommended.steps || [];
    }
  }
  if (!result?.values) return null;
  const beforeKeys = new Set(validateConfig(model, values, validation)
    .filter(isBlockingViolation).map(violationKey));
  const finalViolations = validateConfig(model, result.values, validation)
    .filter(isBlockingViolation);
  const finalKeys = new Set(finalViolations.map(violationKey));
  const currentKey = violationKey(violation);
  if (finalKeys.has(currentKey) || [...finalKeys].some((key) => !beforeKeys.has(key))) return null;
  const candidateChanges = (result.changes || []).filter((change) => change?.from !== change?.to);
  if (!candidateChanges.length) return null;
  return {
    symbol: record.configSymbol,
    package: record.package || packageNameFromSymbol(record.configSymbol),
    value,
    steps: steps.map((step) => ({
      symbol: String(step.symbol || ''),
      package: step.package || packageNameFromSymbol(step.symbol),
      value: normalizeValue(step.value ?? 'n'),
    })).filter((step) => step.symbol),
    changes: candidateChanges,
    values: result.values,
    unresolved: finalViolations,
  };
}

/**
 * Derive a bounded repair plan for an imported or edited configuration.
 *
 * Only two deterministic repair classes are eligible: a package dependency
 * with one selectable provider (resolved by applyUserIntent's normal cascade),
 * and a Kconfig dependency with one unique minimum prerequisite plan (resolved
 * by deriveKconfigPrerequisitePlans).  Conflicts, choices, multiple providers,
 * deferred expressions, and equal-cost alternatives are never guessed at.
 * Every simulated action must remove its selected violation without adding a
 * new blocking violation; otherwise it is left in the final unresolved list.
 */
export function deriveConfigurationRepairPlan(model, inputValues, rawOptions = {}) {
  rawOptions = rawOptions && typeof rawOptions === 'object' ? rawOptions : {};
  const initialValues = new Map(valuesMap(inputValues));
  const validation = configurationRepairValidationOptions(initialValues, {
    ...rawOptions, typedRelationsComplete: model?.typedRelationsComplete === true,
  });
  const initialViolations = validateConfig(model, initialValues, validation)
    .filter(isBlockingViolation);
  if (!initialViolations.length) {
    return { initialViolations, actions: [], changes: [], values: initialValues,
      finalValues: initialValues, unresolved: [] };
  }
  let values = new Map(initialValues);
  const actions = [];
  const changes = [];
  const maxActionsRaw = Number(rawOptions.maxActions);
  const maxActions = Number.isSafeInteger(maxActionsRaw)
    ? Math.max(1, Math.min(64, maxActionsRaw)) : 64;
  const maxPassesRaw = Number(rawOptions.maxPasses);
  const maxPasses = Number.isSafeInteger(maxPassesRaw)
    ? Math.max(1, Math.min(128, maxPassesRaw)) : 128;

  for (let pass = 0; pass < maxPasses && actions.length < maxActions; pass++) {
    const blocking = (pass === 0 ? [...initialViolations] : validateConfig(model, values, validation).filter(isBlockingViolation))
      .sort((left, right) => violationKey(left).localeCompare(violationKey(right)));
    if (!blocking.length) break;
    let progressed = false;
    for (const violation of blocking) {
      if (!['kconfig-dependency-unsatisfied', 'package-dependency-unsatisfied'].includes(violation.code)) continue;
      const candidate = configurationRepairCandidate(model, values, violation, rawOptions, validation);
      if (!candidate) continue;
      values = new Map(candidate.values);
      actions.push({
        symbol: candidate.symbol,
        package: candidate.package,
        value: candidate.value,
        steps: candidate.steps,
        changes: candidate.changes,
      });
      changes.push(...candidate.changes);
      progressed = true;
      break;
    }
    if (!progressed) break;
  }
  const unresolved = validateConfig(model, values, validation).filter(isBlockingViolation);
  return {
    initialViolations,
    actions,
    changes,
    values,
    finalValues: values,
    unresolved,
  };
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
      // A default is not active merely because its own `if` is true. The
      // owning symbol's dependencies must also permit a value; in particular,
      // do not invent scalar defaults for disabled drivers or unknown gates.
      if (dependencyLevel(record, values, context.validationOptions) <= 0) continue;
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
const COMPATIBILITY_RULE_KEYS_V4 = new Set([...COMPATIBILITY_RULE_KEYS_V3, 'buildDependency']);
const COMPATIBILITY_RULE_KEYS_V5 = new Set([...COMPATIBILITY_RULE_KEYS_V4, 'policy', 'environments', 'evidence']);
// `triggerPackages` is retained only for reading already-published legacy
// rules.  New rules describe the failed package and derive active triggers
// from the exact Catalog graph, so a manually maintained trigger list can no
// longer become a second source of truth.
const COMPATIBILITY_BUILD_DEPENDENCY_KEYS = new Set(['package', 'triggerPackages']);
const COMPATIBILITY_ENVIRONMENT_KEYS = new Set(['source', 'branch', 'packageAvailability', 'targetScope']);
const COMPATIBILITY_EVIDENCE_KEYS = new Set(['source', 'branch', 'sourceCommit', 'targetScope', 'refs']);
const COMPATIBILITY_SCHEMAS = new Set([2, 3, 4, 5]);
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

function normalizeCompatibilityEnvironmentTargetScope(value, label) {
  if (!compatibilityObject(value)) throw compatibilityError(`${label} must be an object`);
  if (!Object.keys(value).length) return {};
  return normalizeCompatibilityTargetScope(value, label);
}

function normalizeCompatibilityEnvironments(value, label) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) {
    throw compatibilityError(`${label} must contain 1-64 entries`);
  }
  const rows = value.map((row, index) => {
    const rowLabel = `${label}[${index}]`;
    if (!compatibilityObject(row)) throw compatibilityError(`${rowLabel} must be an object`);
    compatibilityKeys(row, COMPATIBILITY_ENVIRONMENT_KEYS, rowLabel);
    const source = String(row.source || '').trim();
    const branch = String(row.branch || '').trim();
    const packageAvailability = String(row.packageAvailability || 'required').trim();
    if (!COMPATIBILITY_SOURCE_RE.test(source)) throw compatibilityError(`${rowLabel}.source is invalid`);
    if (!COMPATIBILITY_BRANCH_RE.test(branch)) throw compatibilityError(`${rowLabel}.branch is invalid`);
    if (!['required', 'if-present'].includes(packageAvailability)) {
      throw compatibilityError(`${rowLabel}.packageAvailability is invalid`);
    }
    return {
      source,
      branch,
      packageAvailability,
      ...(row.targetScope === undefined ? {} : {
        targetScope: normalizeCompatibilityEnvironmentTargetScope(row.targetScope, `${rowLabel}.targetScope`),
      }),
    };
  });
  if (new Set(rows.map((row) => JSON.stringify(row))).size !== rows.length) {
    throw compatibilityError(`${label} contains duplicate entries`);
  }
  return rows;
}

function normalizeCompatibilityEvidence(value, label) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) {
    throw compatibilityError(`${label} must contain 1-64 entries`);
  }
  const rows = value.map((row, index) => {
    const rowLabel = `${label}[${index}]`;
    if (!compatibilityObject(row)) throw compatibilityError(`${rowLabel} must be an object`);
    compatibilityKeys(row, COMPATIBILITY_EVIDENCE_KEYS, rowLabel);
    const source = String(row.source || '').trim();
    const branch = String(row.branch || '').trim();
    const sourceCommit = String(row.sourceCommit || '').trim().toLowerCase();
    if (source === '*' || !COMPATIBILITY_SOURCE_RE.test(source)) {
      throw compatibilityError(`${rowLabel}.source must be exact`);
    }
    if (branch.includes('*') || !COMPATIBILITY_BRANCH_RE.test(branch)) {
      throw compatibilityError(`${rowLabel}.branch must be exact`);
    }
    if (!COMPATIBILITY_COMMIT_RE.test(sourceCommit)) {
      throw compatibilityError(`${rowLabel}.sourceCommit is invalid`);
    }
    return {
      source,
      branch,
      sourceCommit,
      ...(row.targetScope === undefined ? {} : {
        targetScope: normalizeCompatibilityEnvironmentTargetScope(row.targetScope, `${rowLabel}.targetScope`),
      }),
      refs: compatibilityStrings(row.refs, `${rowLabel}.refs`,
        /^[A-Za-z0-9][A-Za-z0-9+_.:/@#-]{0,255}$/, 1, 8),
    };
  });
  const identities = rows.map((row) =>
    `${row.source}\0${row.branch}\0${row.sourceCommit}\0${JSON.stringify(row.targetScope || {})}`);
  if (new Set(identities).size !== identities.length) {
    throw compatibilityError(`${label} contains duplicate exact identities`);
  }
  return rows;
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

function normalizeCompatibilityBuildDependency(value, label) {
  if (!compatibilityObject(value)) throw compatibilityError(`${label} must be an object`);
  compatibilityKeys(value, COMPATIBILITY_BUILD_DEPENDENCY_KEYS, label);
  const packageName = String(value.package || '').trim();
  if (!COMPATIBILITY_PACKAGE_RE.test(packageName)) throw compatibilityError(`${label}.package is invalid`);
  const hasLegacyTriggers = value.triggerPackages !== undefined;
  const triggerPackages = hasLegacyTriggers
    ? compatibilityStrings(value.triggerPackages, `${label}.triggerPackages`, COMPATIBILITY_PACKAGE_RE, 1, 16)
    : [];
  if (triggerPackages.includes(packageName)) {
    throw compatibilityError(`${label}.triggerPackages must not contain the build package`);
  }
  return { package: packageName, triggerPackages, legacy: hasLegacyTriggers };
}

const NORMALIZED_COMPATIBILITY_DOCUMENTS = new WeakSet();

export function normalizeCompatibilityDocument(raw) {
  if (!compatibilityObject(raw)) throw compatibilityError('compatibility document must be an object');
  compatibilityKeys(raw, COMPATIBILITY_DOCUMENT_KEYS, 'compatibility document');
  const schema = Number(raw.schema);
  if (!COMPATIBILITY_SCHEMAS.has(schema) || !Array.isArray(raw.rules)) throw compatibilityError('compatibility document requires schema 2, 3, 4, or 5 and a rules array');
  if (new TextEncoder().encode(JSON.stringify(raw)).byteLength > 512 * 1024) throw compatibilityError('compatibility document is too large');
  const ids = new Set();
  const rules = raw.rules.map((rule, index) => {
    const label = `compatibility.rules[${index}]`;
    if (!compatibilityObject(rule)) throw compatibilityError(`${label} must be an object`);
    const allowedRuleKeys = schema === 2 ? COMPATIBILITY_RULE_KEYS_V2 :
      schema === 3 ? COMPATIBILITY_RULE_KEYS_V3 :
        schema === 4 ? COMPATIBILITY_RULE_KEYS_V4 : COMPATIBILITY_RULE_KEYS_V5;
    compatibilityKeys(rule, allowedRuleKeys, label);
    const id = String(rule.id || '').trim();
    if (!COMPATIBILITY_ID_RE.test(id) || ids.has(id)) throw compatibilityError(`${label}.id is invalid or duplicate`);
    ids.add(id);
    const issue = rule.issue, match = rule.match;
    if (!['file-ownership', 'build-failure'].includes(issue)) throw compatibilityError(`${id}.issue is invalid`);
    if (!['all-installed', 'all-selected'].includes(match)) throw compatibilityError(`${id}.match is invalid`);
    const preventive = schema === 5 && rule.policy === 'preventive';
    if (schema === 5 && rule.policy !== undefined && !preventive) throw compatibilityError(`${id}.policy is invalid`);
    if (schema === 5 && !preventive && (rule.environments !== undefined || rule.evidence !== undefined)) {
      throw compatibilityError(`${id}.environments and evidence require policy preventive`);
    }
    if (preventive && (rule.scope !== undefined || rule.sourceCommits !== undefined ||
        rule.targetScope !== undefined || rule.refs !== undefined)) {
      throw compatibilityError(`${id}.preventive policy uses environments and evidence instead of legacy scope identity`);
    }
    let scope = null, environments = null, evidence = null;
    if (preventive) {
      environments = normalizeCompatibilityEnvironments(rule.environments, `${id}.environments`);
      evidence = normalizeCompatibilityEvidence(rule.evidence, `${id}.evidence`);
    } else {
      if (!compatibilityObject(rule.scope) || !Object.keys(rule.scope).length) throw compatibilityError(`${id}.scope must be a non-empty object`);
      scope = {};
      for (const [source, branches] of Object.entries(rule.scope)) {
        if (!COMPATIBILITY_SOURCE_RE.test(source)) throw compatibilityError(`${id}.scope source is invalid`);
        scope[source] = compatibilityStrings(branches, `${id}.scope.${source}`, COMPATIBILITY_BRANCH_RE, 1, 32);
      }
      if (Object.hasOwn(scope, '*') && Object.keys(scope).length !== 1) throw compatibilityError(`${id}.scope wildcard source cannot be mixed with named sources`);
    }
    const condition = String(rule.if || '').trim();
    if (condition.length > 512) throw compatibilityError(`${id}.if is invalid`);
    const normalized = { id, issue, match,
      ...(preventive ? { policy: 'preventive', environments, evidence } : { scope }),
      ...(condition ? { if: condition } : {}),
      packages: compatibilityStrings(rule.packages, `${id}.packages`, COMPATIBILITY_PACKAGE_RE, 1, 16),
      ...(!preventive ? { refs: compatibilityStrings(rule.refs, `${id}.refs`,
        /^[A-Za-z0-9][A-Za-z0-9+_.:/@#-]{0,255}$/, 1, 8) } : {}) };
    if (schema >= 3 && rule.sourceCommits !== undefined) {
      normalized.sourceCommits = compatibilityStrings(rule.sourceCommits, `${id}.sourceCommits`, COMPATIBILITY_COMMIT_RE, 1, 32);
    }
    if (schema >= 3 && rule.targetScope !== undefined) {
      normalized.targetScope = normalizeCompatibilityTargetScope(rule.targetScope, `${id}.targetScope`);
    }
    if (issue === 'file-ownership') normalized.paths = compatibilityStrings(rule.paths, `${id}.paths`,
      /^\/(?!.*(?:^|\/)\.\.(?:\/|$))[^\0\r\n]{1,255}$/, 1, 16);
    else if (rule.paths !== undefined) throw compatibilityError(`${id}.paths is only valid for file-ownership`);
    if (issue === 'file-ownership' && rule.failure !== undefined) {
      throw compatibilityError(`${id}.failure is only valid for build-failure`);
    }
    if (schema < 4 && rule.buildDependency !== undefined) {
      throw compatibilityError(`${id}.buildDependency requires compatibility schema 4`);
    }
    if (issue === 'file-ownership' && rule.buildDependency !== undefined) {
      throw compatibilityError(`${id}.buildDependency is only valid for build-failure`);
    }
    if (issue === 'build-failure' && schema >= 3) {
      normalized.failure = normalizeCompatibilityFailure(rule.failure, `${id}.failure`);
    }
    if (schema >= 4 && rule.buildDependency !== undefined) {
      if (!normalized.sourceCommits?.length && !normalized.evidence?.length) {
        throw compatibilityError(`${id}.buildDependency requires a non-empty sourceCommits list`);
      }
      const buildDependency = normalizeCompatibilityBuildDependency(rule.buildDependency, `${id}.buildDependency`);
      if (!normalized.packages.includes(buildDependency.package)) {
        throw compatibilityError(`${id}.buildDependency.package must be listed in packages`);
      }
      normalized.buildDependency = buildDependency;
    }
    return normalized;
  });
  const document = { schema, rules };
  NORMALIZED_COMPATIBILITY_DOCUMENTS.add(document);
  return document;
}

function materializeCompatibilityDefaults(model, inputValues, options) {
  const values = new Map(valuesMap(inputValues));
  const records = (model?.records || []).filter((record) => record?.configSymbol);
  const dependents = new Map();
  const addDependent = (symbol, record) => {
    const key = String(symbol || '').trim();
    if (!key) return;
    const rows = dependents.get(key) || [];
    if (!rows.includes(record)) rows.push(record);
    dependents.set(key, rows);
  };
  // A bounded pass count silently misses long default chains.  A dependency
  // worklist revisits only records whose typed default expression mentions a
  // value that just became known, and naturally stops at cycles/UNKNOWN.
  for (const record of records) {
    for (const symbol of recordForwardReferences(record)) addDependent(symbol, record);
    const defaults = Array.isArray(record.defaultsTyped) && record.defaultsTyped.length
      ? record.defaultsTyped : (record.defaults || []);
    for (const raw of defaults) {
      const { valueExpression, condition } = defaultParts(raw);
      for (const symbol of [...referencedExpressionSymbols(valueExpression),
        ...referencedExpressionSymbols(condition)]) addDependent(symbol, record);
    }
  }
  const queue = [...records];
  const queued = new Set(records);
  while (queue.length) {
    const record = queue.shift();
    queued.delete(record);
    if (values.has(record.configSymbol)) continue;
    if (dependencyLevel(record, values, options) <= 0) continue;
    const resolved = resolveKconfigDefault(record, values, options);
    if (resolved.status !== 'resolved') continue;
    values.set(record.configSymbol, resolved.value);
    for (const dependent of dependents.get(record.configSymbol) || []) {
      if (!values.has(dependent.configSymbol) && !queued.has(dependent)) {
        queued.add(dependent); queue.push(dependent);
      }
    }
  }
  // Choice defaults are defaults for a member symbol, not ordinary scalar
  // records.  Apply only when the choice has no active member and its own
  // conditions are satisfied; an unresolved condition remains UNKNOWN and is
  // deliberately not guessed into a selected member.
  for (const choice of model?.choiceDetails?.values?.() || []) {
    const members = (choice.members || []).map((symbol) => model.bySymbol.get(symbol)).filter(Boolean);
    if (members.some((record) => stateLevel(values.get(record.configSymbol) ?? 'n') > 0)) continue;
    const memberSymbol = choiceDefaultMember(model, choice, values, options);
    if (!memberSymbol) continue;
    const member = model.bySymbol.get(memberSymbol);
    if (!member || !allowedKconfigStates(member).includes('y')) continue;
    values.set(memberSymbol, 'y');
  }
  return values;
}

function compatibilityRecordMatches(rule, record, values) {
  return rule.match === 'all-installed'
    ? recordInstalled(record, values)
    : recordEnabled(record, values);
}

function compatibilityRuleTriggered(rule, records, values, options, triggerRecords = [], graphMatch = false) {
  if (rule.if) {
    const condition = evaluateExpressionState(rule.if, values, options);
    if (condition.status === 'deferred') throw compatibilityError(`${rule.id}.if cannot be resolved from the active Catalog`);
    if (condition.status !== 'satisfied') return false;
  }
  const direct = records.every((record) => compatibilityRecordMatches(rule, record, values));
  if (direct) return true;
  if (!rule.buildDependency) return false;
  if (triggerRecords.some((record) => compatibilityRecordMatches(rule, record, values))) return true;
  if (!graphMatch) return false;
  // A graph-derived match proves the failed package is reached by an active
  // root.  Any additional direct package listed by a rule is still a normal
  // conjunct and must be selected; otherwise an unrelated N package could be
  // bypassed merely because some other consumer reaches the same target.
  const failedPackage = packageCapabilityName(rule.buildDependency.package);
  return records.filter((record) => record.package !== failedPackage)
    .every((record) => compatibilityRecordMatches(rule, record, values));
}

function compatibilityRuleScopeMismatch(rule, sourceCommit, target) {
  const mismatches = [];
  if (rule.sourceCommits && (!COMPATIBILITY_COMMIT_RE.test(sourceCommit) ||
      !rule.sourceCommits.includes(sourceCommit))) mismatches.push('sourceCommit');
  if (rule.targetScope && Object.entries(rule.targetScope).some(([key, values]) =>
    !values.includes(target[key]))) mismatches.push('targetScope');
  return mismatches;
}

function compatibilityEnvironmentMatches(environment, sourceId, branchName, target) {
  if (environment.source !== '*' && environment.source !== sourceId) return false;
  if (!compatibilityPatternMatches(branchName, environment.branch)) return false;
  return !environment.targetScope || Object.entries(environment.targetScope).every(([key, values]) =>
    values.includes(target[key]));
}

function compatibilityNearMatch(rule, sourceId, branchName, sourceCommit, target, records, values, mismatches) {
  const matchedPackages = records
    .filter((record) => compatibilityRecordMatches(rule, record, values))
    .map((record) => record.package || packageNameFromSymbol(record.configSymbol))
    .filter(Boolean);
  return {
    type: 'compatibility-near-match',
    ruleId: rule.id,
    issue: rule.issue,
    sourceId,
    branchName,
    mismatches: [...mismatches],
    matchedPackages: [...new Set(matchedPackages)],
    verified: {
      sourceCommits: rule.sourceCommits ? [...rule.sourceCommits] : [],
      targetScope: rule.targetScope
        ? Object.fromEntries(Object.entries(rule.targetScope).map(([key, values]) => [key, [...values]]))
        : null,
    },
    current: {
      sourceCommit,
      targetScope: { ...target },
    },
  };
}

export function evaluateCompatibilityRules(model, document, inputValues, context = {}) {
  return evaluateNormalizedCompatibilityRules(model, normalizeCompatibilityDocument(document), inputValues, context);
}

// Internal results keep derived fields that are deliberately not legal wire input.
// Only documents produced by the strict boundary above may enter this path.
export function evaluateNormalizedCompatibilityRules(model, normalized, inputValues, context = {}) {
  if (!model?.byPackage) throw compatibilityError('Catalog model is unavailable');
  if (!NORMALIZED_COMPATIBILITY_DOCUMENTS.has(normalized)) {
    throw compatibilityError('Expected a normalized compatibility document');
  }
  const sourceId = String(context.sourceId || ''), branchName = String(context.branchName || '');
  const sourceCommit = String(context.sourceCommit || '').toLowerCase();
  const target = {
    system: String(context.targetSystem || ''),
    subtarget: String(context.targetSubtarget || ''),
    profile: String(context.targetProfile || ''),
  };
  const options = {
    ...(context.validationOptions || {}), typedRelationsComplete: model.typedRelationsComplete === true,
  };
  const values = materializeCompatibilityDefaults(model, inputValues, options);
  const warnings = [];
  const diagnostics = [];
  for (const rule of normalized.rules) {
    const environment = rule.policy === 'preventive'
      ? rule.environments.find((row) => compatibilityEnvironmentMatches(row, sourceId, branchName, target))
      : null;
    if (rule.policy === 'preventive' && !environment) continue;
    if (rule.policy !== 'preventive') {
      const branchPatterns = rule.scope[sourceId] || rule.scope['*'] || [];
      if (!branchPatterns.some((pattern) => compatibilityPatternMatches(branchName, pattern))) continue;
    }
    const mismatches = rule.policy === 'preventive' ? [] :
      compatibilityRuleScopeMismatch(rule, sourceCommit, target);
    const ifPresent = environment?.packageAvailability === 'if-present';
    const missingPackages = [];
    const records = rule.packages.map((packageName) => {
      const record = model.byPackage.get(packageName);
      if (!record?.configSymbol) missingPackages.push(packageName);
      return record;
    }).filter((record) => record?.configSymbol);
    if (missingPackages.length) {
      if (ifPresent && records.length === 0) continue;
      if (!ifPresent) {
        if (mismatches.length) continue;
        throw compatibilityError(`${rule.id} references a package missing from the active Catalog: ${missingPackages[0]}`);
      }
    }
    let triggerRecords = [];
    let buildDependencyRecord = null;
    if (rule.buildDependency) {
      buildDependencyRecord = model.byPackage.get(rule.buildDependency.package);
      if (!buildDependencyRecord?.configSymbol) {
        if (ifPresent) continue;
        if (mismatches.length) continue;
        throw compatibilityError(`${rule.id} references a build dependency package missing from the active Catalog: ${rule.buildDependency.package}`);
      }
      const missingTriggerPackages = [];
      triggerRecords = rule.buildDependency.triggerPackages.map((packageName) => {
        const record = model.byPackage.get(packageName);
        if (!record?.configSymbol) missingTriggerPackages.push(packageName);
        return record;
      }).filter((record) => record?.configSymbol);
      if (missingTriggerPackages.length && !ifPresent) {
        if (mismatches.length) continue;
        throw compatibilityError(`${rule.id} references a build trigger package missing from the active Catalog: ${missingTriggerPackages[0]}`);
      }
    }
    if (!records.length && !triggerRecords.length) continue;
    const allRecords = [...new Map([...records, ...triggerRecords]
      .map((record) => [record.configSymbol, record])).values()];
    let packageMatch;
    try {
      // New schema-4 buildDependency rules are package-only by design.  Their
      // trigger is derived from the exact active Catalog graph, so an enabled
      // consumer with a currently disabled failed dependency still triggers a
      // warning.  Legacy triggerPackages remain readable but do not participate
      // in this graph path.
      const graphMatch = rule.buildDependency && !rule.buildDependency.legacy
        ? buildDependencyGraphReachable(model, buildDependencyRecord, values, options)
        : false;
      packageMatch = compatibilityRuleTriggered(rule, records, values, options, triggerRecords, graphMatch);
    } catch (error) {
      if (mismatches.length) continue;
      throw error;
    }
    if (packageMatch && mismatches.length) {
      diagnostics.push(compatibilityNearMatch(rule, sourceId, branchName, sourceCommit,
        target, allRecords, values, mismatches));
    } else if (packageMatch) {
      warnings.push({ rule, records: allRecords, directRecords: records, triggerRecords,
        buildDependencyRecord, values });
    }
  }
  return { document: normalized, values, warnings, diagnostics };
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
  const options = validationOptions(values, {
    ...(intent.validationOptions || {}), model, typedRelationsComplete: model?.typedRelationsComplete === true,
  });
  const steps = [];
  const allChanges = [];
  const visiting = new Set();
  const protectedSymbols = new Set(intent.protectedSymbols || []);
  const preferredValues = intent.preferredValues instanceof Map
    ? new Map(intent.preferredValues) : new Map(Object.entries(intent.preferredValues || {}));
  const explicitSymbols = new Set(intent.explicitSymbols || options.explicitSymbols || []);
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

function compatibilityWarningTriggered(model, warning, values, options = {}) {
  const graphMatch = warning?.rule?.buildDependency && !warning.rule.buildDependency.legacy
    ? buildDependencyGraphReachable(model, warning.buildDependencyRecord ||
      packageGraphRecord(model, warning.rule.buildDependency.package), values, options)
    : false;
  return compatibilityRuleTriggered(warning.rule, warning.directRecords || warning.records, values, options,
    warning.triggerRecords || [], graphMatch);
}

function compatibilityValuesKey(values) {
  return [...valuesMap(values)].sort(([left], [right]) => left.localeCompare(right))
    .map(([symbol, value]) => `${symbol}=${normalizeValue(value)}`).join('\\0');
}

function compatibilityPlanCandidate(startingValues, steps, values, changes, fallbackPackage = '', requiredTargets = []) {
  const uniqueSteps = [];
  const seenSymbols = new Set();
  for (const step of steps || []) {
    const symbol = String(step?.symbol || '');
    if (!symbol || seenSymbols.has(symbol)) continue;
    seenSymbols.add(symbol);
    uniqueSteps.push({ ...step, symbol });
  }
  const uniqueTargets = [];
  const seenTargetSymbols = new Set();
  for (const target of requiredTargets || []) {
    const symbol = String(target?.symbol || target?.configSymbol || '');
    if (!symbol || seenTargetSymbols.has(symbol)) continue;
    seenTargetSymbols.add(symbol);
    uniqueTargets.push({
      symbol,
      package: target?.package || packageNameFromSymbol(symbol),
      value: target?.value || 'n',
    });
  }
  const normalizedChanges = compatibilityPlanChanges(startingValues, values, changes);
  const stepSymbols = new Set(uniqueSteps.map((step) => step.symbol));
  const targetSymbols = new Set(uniqueTargets.map((target) => target.symbol));
  const actionSymbols = new Set([...stepSymbols, ...targetSymbols]);
  const lastStep = uniqueSteps.at(-1);
  const packageName = fallbackPackage || lastStep?.package || packageNameFromSymbol(lastStep?.symbol);
  return {
    package: packageName,
    symbol: lastStep?.symbol || (packageName ? `PACKAGE_${packageName}` : ''),
    steps: uniqueSteps,
    requiredTargets: uniqueTargets,
    changes: normalizedChanges,
    automaticChanges: normalizedChanges.filter((change) =>
      !stepSymbols.has(change.symbol) && !targetSymbols.has(change.symbol)),
    values,
    cost: actionSymbols.size,
  };
}

function deriveLegacyBuildDependencyPlans(model, inputValues, warning, intent = {}) {
  const rule = warning.rule;
  const startingValues = new Map(valuesMap(warning.values || inputValues));
  const directRecords = warning.directRecords || (rule.packages || []).map((packageName) =>
    model.byPackage.get(packageName)).filter(Boolean);
  const triggerRecords = warning.triggerRecords || (rule.buildDependency?.triggerPackages || []).map((packageName) =>
    model.byPackage.get(packageName)).filter(Boolean);
  const participants = [...new Map([...directRecords, ...triggerRecords]
    .map((record) => [record.configSymbol, record])).values()];
  const requiredTargetRecords = participants.filter((record) =>
    compatibilityRecordMatches(rule, record, startingValues));
  const requiredTargets = requiredTargetRecords.map((record) => ({
    symbol: record.configSymbol,
    package: record.package || packageNameFromSymbol(record.configSymbol),
    value: 'n',
  }));
  const fallbackPackage = rule.buildDependency?.package || '';
  const queue = [{ values: startingValues, steps: [], changes: [], key: compatibilityValuesKey(startingValues) }];
  const visited = new Set([`${queue[0].key}\\0`]);
  const candidates = [];
  let examined = 0;
  const maxNodes = 4096;
  while (queue.length && examined < maxNodes) {
    queue.sort((left, right) => left.steps.length - right.steps.length || left.key.localeCompare(right.key));
    const state = queue.shift();
    examined++;
    const unresolvedTargets = requiredTargetRecords.filter((record) =>
      compatibilityRecordMatches(rule, record, state.values));
    if (!unresolvedTargets.length) {
      if (state.steps.length) candidates.push(compatibilityPlanCandidate(startingValues, state.steps,
        state.values, state.changes, fallbackPackage, requiredTargets));
      continue;
    }
    const stateStepSymbols = new Set(state.steps.map((step) => step.symbol));
    for (const record of unresolvedTargets) {
      let plan;
      try {
        plan = compatibilityDisablePlan(model, record, state.values, intent);
      } catch {
        plan = null;
      }
      if (!plan?.steps?.length || plan.steps.some((step) => stateStepSymbols.has(step.symbol))) continue;
      const values = new Map(plan.values);
      const steps = [...state.steps, ...plan.steps];
      const changes = compatibilityPlanChanges(startingValues, values, [...state.changes, ...plan.changes]);
      const valuesKey = compatibilityValuesKey(values);
      const operationKey = steps.map((step) => `${step.symbol}=${step.value || 'n'}`).sort().join('\\0');
      const key = `${valuesKey}\\0${operationKey}`;
      if (valuesKey === state.key || visited.has(key)) continue;
      visited.add(key);
      queue.push({ values, steps, changes, key: valuesKey });
    }
  }
  const uniqueCandidates = new Map();
  for (const candidate of candidates) {
    const operationKey = candidate.steps.map((step) => `${step.symbol}=${step.value || 'n'}`)
      .sort().join('\\0');
    const existing = uniqueCandidates.get(operationKey);
    const candidateKey = candidate.steps.map((step) => `${step.symbol}=${step.value || 'n'}`).join('\\0');
    if (!existing || candidateKey.localeCompare(existing.key) < 0) {
      uniqueCandidates.set(operationKey, { ...candidate, key: candidateKey });
    }
  }
  const normalizedCandidates = [...uniqueCandidates.values()]
    .sort((left, right) => left.cost - right.cost || left.key.localeCompare(right.key));
  const minimum = normalizedCandidates[0]?.cost;
  const cheapest = normalizedCandidates.filter((candidate) => candidate.cost === minimum);
  return { candidates: normalizedCandidates, recommended: cheapest.length === 1 ? cheapest[0] : null };
}

function packageCapabilityName(value) {
  return String(value || '').trim().replace(/^PACKAGE_/, '');
}

function packageGraphRecord(model, value) {
  const name = packageCapabilityName(value);
  return model?.byPackage?.get(name) || null;
}

function packageGraphTargets(model, name) { return packageProviderRecords(model, name); }

function activePackageTargets(model, name, values) {
  return packageGraphTargets(model, name).filter((record) => recordEnabled(record, values));
}

function packageDependencyTargets(model, names, values, source) {
  const requested = [...new Set((names || []).map(packageCapabilityName).filter(Boolean))];
  const targets = requested.flatMap((name) => packageGraphTargets(model, name));
  const self = targets.some((record) => record.package === source);
  // An owner-provided virtual capability satisfies an alternative package
  // dependency by itself.  Do not replace that exact self-provider fact with
  // an unrelated external provider (or an ambiguous edge).
  if (self) return { records: [], self: true, inactive: false };
  const active = [...new Map(requested.flatMap((name) => activePackageTargets(model, name, values))
    .map((record) => [record.package, record])).values()]
    .filter((record) => record.package !== source);
  if (active.length) return { records: active, inactive: false };
  // A required package may currently be `n` in an imported override while an
  // enabled consumer still declares it.  Keep that exact concrete target as
  // a potential build edge; this is what lets a package-only compatibility
  // rule explain `docker=y, dockerd=n` without inventing a trigger list.
  const available = [...new Map(targets
    .map((record) => [record.package, record])).values()]
    .filter((record) => record.package !== source);
  return { records: available, self, inactive: true };
}

/*
 * Evaluate the lossless schema-4 Kconfig AST for graph planning.  The raw
 * expression evaluator remains the compatibility fallback for old readable
 * records, but a complete schema-4 graph must use its producer AST so an OR
 * expression is treated as an alternative branch rather than a bag of
 * referenced symbols.
 */
function expressionAstDependencyProof(ast, inputValues, options = {}) {
  ast = unwrapExpressionAst(ast);
  const values = valuesMap(inputValues);
  const unknown = () => ({ level: UNKNOWN, value: UNKNOWN, symbols: new Set(),
    requiredSymbols: new Set(), ambiguous: true });
  const atom = (node) => {
    if (!node || typeof node !== 'object') return unknown();
    if (node.kind === 'literal') {
      const operand = expressionLiteralOperand(node.value ?? node.raw ?? '', node.raw ?? node.value ?? '', node.quoted === true);
      return { level: operand.level, value: operand.stringValue, operand, symbols: new Set(),
        requiredSymbols: new Set(), ambiguous: false };
    }
    if (node.kind === 'symbol') {
      const symbol = String(node.name || '').trim();
      if (!symbol) return unknown();
      const operand = expressionOperand(symbol, values, options);
      const proven = mapValue(options.undefinedSymbols, symbol) && operand.nativeUndefined;
      const symbols = proven ? new Set() : new Set([symbol]);
      const requiredSymbols = proven ? new Set() : new Set([symbol]);
      return { level: operand.level, value: operand.level === UNKNOWN ? UNKNOWN : operand.stringValue,
        operand, symbols, requiredSymbols, ambiguous: false };
    }
    if (node.kind === 'unknown') return unknown();
    if (node.kind === 'not') {
      const child = expressionAstDependencyProof(node.value, inputValues, options);
      return { level: child.level === UNKNOWN ? UNKNOWN : 2 - child.level,
        value: child.level === UNKNOWN ? UNKNOWN : child.level > 0 ? 'n' : 'y',
        // A negative condition being true because its symbol is N does not
        // make that symbol a package prerequisite.
        symbols: new Set(), requiredSymbols: new Set(), ambiguous: child.ambiguous };
    }
    if (node.kind === 'compare') {
      const left = expressionAstDependencyProof(node.left, inputValues, options);
      const right = expressionAstDependencyProof(node.right, inputValues, options);
      const level = compareExpressionOperands(left.operand, String(node.operator || ''), right.operand);
      return { level, value: level === UNKNOWN ? UNKNOWN : level > 0 ? 'y' : 'n',
        symbols: new Set([...(left.symbols || []), ...(right.symbols || [])]),
        requiredSymbols: new Set([...(left.requiredSymbols || []), ...(right.requiredSymbols || [])]),
        ambiguous: left.ambiguous || right.ambiguous };
    }
    if (node.kind === 'and' || node.kind === 'or') {
      const rows = Array.isArray(node.values) ? node.values : [];
      if (!rows.length) return unknown();
      const combineAnd = (left, right) => {
        const requiredSymbols = new Set([...(left.requiredSymbols || []), ...(right.requiredSymbols || [])]);
        if (left.level === 0 || right.level === 0) return { level: 0, value: 'n', symbols: new Set(),
          requiredSymbols, ambiguous: left.ambiguous || right.ambiguous ||
            left.level === UNKNOWN || right.level === UNKNOWN };
        if (left.level === UNKNOWN || right.level === UNKNOWN) return { level: UNKNOWN, value: UNKNOWN,
          symbols: new Set(), requiredSymbols, ambiguous: true };
        return { level: Math.min(left.level, right.level), value: left.level <= right.level ? left.value : right.value,
          symbols: new Set([...(left.symbols || []), ...(right.symbols || [])]), requiredSymbols,
          ambiguous: left.ambiguous || right.ambiguous };
      };
      const combineOr = (left, right) => {
        const requiredSymbols = new Set([...(left.requiredSymbols || []), ...(right.requiredSymbols || [])]);
        if (left.level === UNKNOWN || right.level === UNKNOWN) {
          if (left.level === 2) return left;
          if (right.level === 2) return right;
          return { level: UNKNOWN, value: UNKNOWN, symbols: new Set(), requiredSymbols, ambiguous: true };
        }
        const level = Math.max(left.level, right.level);
        if (level === 0) return { level: 0, value: 'n', symbols: new Set(), requiredSymbols, ambiguous: true };
        if (left.level !== right.level) return left.level === level ? left : right;
        const leftUnconditional = left.level === 2 && left.symbols.size === 0 && !left.ambiguous;
        const rightUnconditional = right.level === 2 && right.symbols.size === 0 && !right.ambiguous;
        if (leftUnconditional) return left;
        if (rightUnconditional) return right;
        const same = left.symbols.size === right.symbols.size &&
          [...left.symbols].every((item) => right.symbols.has(item));
        return { level, value: left.value, symbols: new Set([...left.symbols, ...right.symbols]),
          requiredSymbols, ambiguous: left.ambiguous || right.ambiguous || !same };
      };
      let result = expressionAstDependencyProof(rows[0], inputValues, options);
      for (const child of rows.slice(1)) {
        const next = expressionAstDependencyProof(child, inputValues, options);
        result = node.kind === 'and' ? combineAnd(result, next) : combineOr(result, next);
      }
      return result;
    }
    return unknown();
  };
  return atom(ast);
}

function expressionDependencyProof(expression, inputValues, options = {}) {
  const tokens = expressionTokens(expression);
  if (tokens.complete === false || !tokens.length) {
    return { level: UNKNOWN, symbols: new Set(), requiredSymbols: new Set(), ambiguous: true };
  }
  let at = 0;
  let parseError = false;
  const atom = (token) => {
    const operand = expressionOperand(token, inputValues, options);
    const isLiteral = token === 'y' || token === 'm' || token === 'n' ||
      /^".*"$/.test(token || '') || /^[+-]?(?:0x[0-9a-f]+|\d+)$/i.test(token || '');
    const proven = !isLiteral && mapValue(options.undefinedSymbols, token) && operand.nativeUndefined;
    const symbols = proven || isLiteral ? new Set() : new Set([token]);
    const requiredSymbols = proven || isLiteral ? new Set() : new Set([token]);
    return { level: operand.level, value: operand.level === UNKNOWN ? UNKNOWN : operand.stringValue,
      operand, symbols, requiredSymbols, ambiguous: false };
  };
  const combineAnd = (left, right) => {
    const requiredSymbols = new Set([...(left.requiredSymbols || []), ...(right.requiredSymbols || [])]);
    if (left.level === 0 || right.level === 0) return { level: 0, symbols: new Set(), requiredSymbols,
      ambiguous: left.ambiguous || right.ambiguous || left.level === UNKNOWN || right.level === UNKNOWN };
    if (left.level === UNKNOWN || right.level === UNKNOWN) return { level: UNKNOWN, symbols: new Set(), requiredSymbols, ambiguous: true };
    return { level: Math.min(left.level, right.level), symbols: new Set([...left.symbols, ...right.symbols]),
      requiredSymbols, ambiguous: left.ambiguous || right.ambiguous };
  };
  const combineOr = (left, right) => {
    if (left.level === UNKNOWN || right.level === UNKNOWN) {
      if (left.level === 2 || right.level === 2) return left.level === 2 ? left : right;
      return { level: UNKNOWN, symbols: new Set(), requiredSymbols: new Set([
        ...(left.requiredSymbols || []), ...(right.requiredSymbols || []),
      ]), ambiguous: true };
    }
    const level = Math.max(left.level, right.level);
    if (level === 0) return { level: 0, symbols: new Set(), requiredSymbols: new Set([
      ...(left.requiredSymbols || []), ...(right.requiredSymbols || []),
    ]), ambiguous: true };
    if (left.level !== right.level) return left.level === level ? left : right;
    // A literal `y` (or another already-reduced constant) proves the OR
    // without requiring either symbol.  Do not turn `y || A` into an
    // ambiguous dependency edge.
    const leftUnconditional = left.level === 2 && left.symbols.size === 0 && !left.ambiguous;
    const rightUnconditional = right.level === 2 && right.symbols.size === 0 && !right.ambiguous;
    if (leftUnconditional) return left;
    if (rightUnconditional) return right;
    const same = left.symbols.size === right.symbols.size && [...left.symbols].every((item) => right.symbols.has(item));
    return { level, symbols: new Set([...left.symbols, ...right.symbols]),
      requiredSymbols: new Set([...(left.requiredSymbols || []), ...(right.requiredSymbols || [])]),
      ambiguous: left.ambiguous || right.ambiguous || !same };
  };
  const primary = () => {
    if (tokens[at] === '(') {
      at++;
      const value = or();
      if (tokens[at] === ')') at++;
      else parseError = true;
      return value;
    }
    if (at >= tokens.length || ['&&', '||', ')', '=', '!=', '<', '>', '<=', '>='].includes(tokens[at])) {
      parseError = true;
      return { level: UNKNOWN, value: UNKNOWN, symbols: new Set(), requiredSymbols: new Set(), ambiguous: true };
    }
    const token = tokens[at++];
    const left = atom(token);
    if (['=', '!=', '<', '>', '<=', '>='].includes(tokens[at])) {
      const operator = tokens[at++];
      if (at >= tokens.length || ['&&', '||', ')', '=', '!=', '<', '>', '<=', '>='].includes(tokens[at])) {
        parseError = true;
        return { level: UNKNOWN, value: UNKNOWN, symbols: new Set(), requiredSymbols: new Set(), ambiguous: true };
      }
      const right = atom(tokens[at++]);
      const level = compareExpressionOperands(left.operand, operator, right.operand);
      return { level, value: level === UNKNOWN ? UNKNOWN : level > 0 ? 'y' : 'n',
        symbols: new Set([...left.symbols, ...right.symbols]),
        requiredSymbols: new Set([...(left.requiredSymbols || []), ...(right.requiredSymbols || [])]),
        ambiguous: left.ambiguous || right.ambiguous };
    }
    return left;
  };
  const unary = () => {
    if (tokens[at] === '!') { at++; const value = unary(); return { level: value.level === UNKNOWN ? UNKNOWN : 2 - value.level,
      symbols: new Set(), requiredSymbols: new Set(), ambiguous: value.ambiguous }; }
    return primary();
  };
  const and = () => { let value = unary(); while (tokens[at] === '&&') { at++; value = combineAnd(value, unary()); } return value; };
  const or = () => { let value = and(); while (tokens[at] === '||') { at++; value = combineOr(value, and()); } return value; };
  const result = or();
  // A malformed/partially parsed expression is not a proof.  Preserve it as
  // UNKNOWN instead of silently using whichever prefix happened to parse.
  return parseError || at !== tokens.length
    ? (tokens.syntaxValid = false, { level: UNKNOWN, symbols: new Set(), requiredSymbols: new Set(), ambiguous: true })
    : (tokens.syntaxValid = true, result);
}

/*
 * Build a conditional package/Kconfig graph from the exact Catalog model.
 * `reverseDependencies` is useful for indexing, but deriving edges from the
 * records as well means a consumer can still reason about a freshly loaded
 * graph whose optional indexes are absent.  Unknown conditions or unresolved
 * providers are retained as provenance and never silently treated as an edge.
 */
function activePackageGraph(model, values, options = {}, includeInactive = false) {
  const graph = new Map();
  const unknown = [];
  const addUnknown = (source, reason) => unknown.push({ source, reason });
  const addEdge = (source, target) => {
    const name = packageCapabilityName(target);
    if (!name || name === source) return;
    const targets = packageGraphTargets(model, name);
    if (!targets.length) {
      addUnknown(source, `missing-provider:${name}`);
      return;
    }
    for (const record of targets) {
      const bucket = graph.get(source) || new Set();
      bucket.add(record.package); graph.set(source, bucket);
    }
  };
  const addActiveDependencyEdge = (source, dependency) => {
    const packages = [...new Set((dependency?.packages || []).map(packageCapabilityName).filter(Boolean))];
    if (!packages.length) return;
    if (dependency.required === false) return;
    const condition = String(dependency.condition || '').trim();
    if (condition) {
      const state = evaluateExpressionRaw(condition, values, options);
      if (state === 0) return;
      if (state === UNKNOWN) {
        addUnknown(source, `unknown-package-condition:${condition}`);
        return;
      }
    }
    const resolution = packageDependencyTargets(model, packages, values, source);
    const candidates = resolution.records;
    const external = candidates.filter((record) => record.package !== source);
    // A package may list a virtual capability that it provides itself.  That
    // is satisfied by the owner and must not create a self edge.
    if (!external.length && resolution.self) return;
    if (external.length === 1) {
      addEdge(source, external[0].package);
      return;
    }
    if (external.length > 1) {
      addUnknown(source, `ambiguous-provider:${packages.join(' || ')}`);
      return;
    }
    if (dependency.required !== false) addUnknown(source, `inactive-provider:${packages.join(' || ')}`);
  };
  const addKconfigEdge = (source, symbol) => {
    const target = model?.bySymbol?.get(symbol);
    if (!target) { addUnknown(source, `missing-symbol:${symbol}`); return; }
    if (target.package) addEdge(source, target.package);
  };
  for (const record of model?.records || []) {
    if (!record?.package || !record.configSymbol || (!includeInactive && !recordEnabled(record, values))) continue;
    const source = record.package;
    graph.set(source, graph.get(source) || new Set());
    for (const dependency of record.packageInfo?.depends || []) {
      addActiveDependencyEdge(source, dependency);
    }
    // The narrow package-closure contract is sufficient for exact
    // package-info dependency/provider paths, but it does not certify typed
    // Kconfig expressions.  Never turn an incomplete Kconfig relation into a
    // graph edge merely because the package closure itself is complete.
    // Compact schema-4 assets must carry the complete typed-Kconfig
    // capability.  Schema-2 readable assets have no capability table and are
    // retained only for the legacy expression graph path; they never certify
    // typed preflight through `model.relationsComplete`.
    const kconfigGraphComplete = model.relationsSchema === 2
      ? model.declaredRelationsComplete === true
      : model.relationsComplete === true;
    if (!kconfigGraphComplete) continue;
    const dependsVariants = record.kconfig?.dependsExpressions || [];
    const dependsAstVariants = Array.isArray(record.kconfig?.dependsAstVariants) &&
      record.kconfig.dependsAstVariants.length ? record.kconfig.dependsAstVariants : null;
    const graphVariants = (Array.isArray(dependsVariants) && dependsVariants.length
      ? dependsVariants : [[]]);
    const proofs = graphVariants.map((variant, variantIndex) => {
        const expressions = Array.isArray(variant) ? variant : [variant];
        const astExpressions = dependsAstVariants
          ? (Array.isArray(dependsAstVariants[variantIndex])
            ? dependsAstVariants[variantIndex] : [dependsAstVariants[variantIndex]])
          : [];
        const typedAstMissing = model.typedRelationsComplete === true && expressions.some((expression) =>
          String(expression || '').trim()) &&
          (!dependsAstVariants || astExpressions.length !== expressions.length || astExpressions.some((ast) => !ast));
        if (typedAstMissing) return { level: UNKNOWN, symbols: new Set(), requiredSymbols: new Set(), ambiguous: true };
        const proofInputs = dependsAstVariants && astExpressions.length ? astExpressions : expressions;
        let symbols = new Set(); let requiredSymbols = new Set(); let level = 2; let ambiguous = false;
        for (let expressionIndex = 0; expressionIndex < proofInputs.length; expressionIndex++) {
          const expression = proofInputs[expressionIndex];
          const usesAst = dependsAstVariants && astExpressions.length;
          const proof = usesAst
            ? expressionAstDependencyProof(expression, values, options)
            : expressionDependencyProof(expression, values, options);
          if (usesAst) {
            const rawExpression = expressions[expressionIndex];
            const astRaw = expressionAstRaw(expression);
            const rawProof = rawExpression === undefined ? null : expressionDependencyProof(rawExpression, values, options);
            if ((rawExpression !== undefined && astRaw && String(rawExpression || '').trim() !== astRaw) ||
                (rawProof && rawProof.level !== proof.level)) {
              return { level: UNKNOWN, symbols: new Set(), requiredSymbols: new Set(), ambiguous: true };
            }
          }
          requiredSymbols = new Set([...requiredSymbols, ...(proof.requiredSymbols || [])]);
          if (proof.level === 0) return { level: 0, symbols: new Set(), requiredSymbols,
            ambiguous: proof.ambiguous };
          if (proof.level === UNKNOWN) return { level: UNKNOWN, symbols: new Set(), requiredSymbols, ambiguous: true };
          level = Math.min(level, proof.level);
          symbols = new Set([...symbols, ...proof.symbols]); ambiguous ||= proof.ambiguous;
        }
        return { level, symbols, requiredSymbols, ambiguous };
      });
    const satisfied = proofs.filter((proof) => proof.level > 0);
    const sameProof = satisfied.length > 1 && satisfied.every((proof) => {
      const first = satisfied[0];
      return proof.symbols.size === first.symbols.size && [...proof.symbols].every((item) => first.symbols.has(item));
    });
    if (satisfied.some((proof) => proof.ambiguous) || (satisfied.length > 1 && !sameProof)) {
      addUnknown(source, 'ambiguous-kconfig-dependency');
    } else if (satisfied.length === 1) {
      for (const symbol of satisfied[0].symbols) addKconfigEdge(source, symbol);
    } else if (sameProof) {
      for (const symbol of satisfied[0].symbols) addKconfigEdge(source, symbol);
    } else if (proofs.length === 1 && proofs[0].level === 0 && !proofs[0].ambiguous) {
      // A single unsatisfied direct dependency is still an exact potential
      // edge.  It is intentionally restricted to the parser's proof result;
      // arbitrary symbols mentioned in an `A || B` expression are never
      // promoted to mandatory edges.
      for (const symbol of proofs[0].requiredSymbols || []) addKconfigEdge(source, symbol);
    } else if (proofs.some((proof) => proof.level === UNKNOWN || proof.ambiguous)) {
      addUnknown(source, 'unknown-kconfig-dependency');
    }
    for (const [field, rows, relationField] of [
      ['selectsExpressions', record.kconfig?.selectsExpressions, record.kconfig?.selectRelations],
      ['impliesExpressions', record.kconfig?.impliesExpressions, record.kconfig?.implyRelations],
    ]) {
      const typedRelations = Array.isArray(relationField) && relationField.length
        ? relationField : null;
      if (typedRelations) {
        for (const relation of typedRelations) {
          const symbol = String(relation?.target || relation?.symbol || relation?.name || '').trim();
          if (!symbol) { addUnknown(source, `invalid-${field}-relation`); continue; }
          const level = evaluateKconfigRelationCondition(relation, values, options);
          if (level === 0) continue;
          if (level === UNKNOWN) { addUnknown(source, `unknown-${field}:${relation.raw || symbol}`); continue; }
          addKconfigEdge(source, symbol);
        }
      } else {
        for (const expression of nestedExpressionStrings(rows || [])) {
          const { symbol, condition } = ruleParts(expression);
          if (!symbol) continue;
          const level = model.typedRelationsComplete === true
            ? UNKNOWN : evaluateExpressionRaw(condition, values, options);
          if (level === 0) continue;
          if (level === UNKNOWN) { addUnknown(source, `unknown-${field}:${expression}`); continue; }
          addKconfigEdge(source, symbol);
        }
      }
    }
  }
  return { graph, unknown };
}

function buildDependencyGraphClosure(model, failedRecord, values, options = {}) {
  if (!failedRecord?.package) return { status: 'inconclusive', roots: [], closure: new Set(), unknown: ['missing-failed-package'] };
  if (model?.packageClosureComplete !== true) {
    return { status: 'inconclusive', roots: [], closure: new Set([failedRecord.package]),
      unknown: ['catalog-package-closure-incomplete'] };
  }
  const { graph, unknown } = activePackageGraph(model, values, options);
  const reverse = new Map();
  for (const [source, targets] of graph) {
    for (const target of targets) {
      const parents = reverse.get(target) || new Set();
      parents.add(source); reverse.set(target, parents);
    }
  }
  const closure = new Set([failedRecord.package]);
  const queue = [failedRecord.package];
  while (queue.length) {
    const target = queue.shift();
    for (const parent of reverse.get(target) || []) {
      if (!closure.has(parent)) { closure.add(parent); queue.push(parent); }
    }
  }
  const activeParents = (name) => [...(reverse.get(name) || [])].filter((parent) => closure.has(parent));
  const explicitSymbols = new Set(options.explicitSymbols || []);
  const candidates = [...closure].map((name) => packageGraphRecord(model, name)).filter((record) =>
    record && record.package !== failedRecord.package && recordEnabled(record, values) &&
    (record.userSettable !== false || explicitSymbols.has(record.configSymbol)));
  const roots = candidates.filter((record) => !activeParents(record.package).some((parent) => {
    const parentRecord = packageGraphRecord(model, parent);
    return parentRecord && (parentRecord.userSettable !== false || explicitSymbols.has(parentRecord.configSymbol));
  }));
  // An incomplete graph can only produce a deterministic result when every
  // active upstream path was resolved.  Do not guess a root from a partial
  // graph: callers surface an inconclusive recommendation instead.
  const relevantUnknown = unknown.filter((item) => item.source !== failedRecord.package && closure.has(item.source));
  if (relevantUnknown.length) {
    return { status: 'inconclusive', roots: [], closure, unknown: relevantUnknown, graph, reverse };
  }
  return { status: 'resolved', roots, closure, unknown: [], graph, reverse };
}

function buildDependencyGraphReachable(model, failedRecord, values, options = {}) {
  const closure = buildDependencyGraphClosure(model, failedRecord, values, options);
  // The failed package itself is always the seed. A second member proves
  // that an active package/Kconfig path reaches it. An incomplete or
  // ambiguous graph deliberately stays inconclusive rather than warning.
  return closure.status === 'resolved' && closure.closure.size > 1;
}

function deriveGraphBuildDependencyPlans(model, inputValues, warning, intent = {}) {
  const startingValues = new Map(valuesMap(warning.values || inputValues));
  const options = validationOptions(startingValues, {
    ...(intent.validationOptions || {}), model, typedRelationsComplete: model?.typedRelationsComplete === true,
  });
  const failedRecord = warning.buildDependencyRecord ||
    packageGraphRecord(model, warning.rule?.buildDependency?.package);
  const closure = buildDependencyGraphClosure(model, failedRecord, startingValues, options);
  if (closure.status !== 'resolved') {
    return { candidates: [], recommended: null, status: 'inconclusive', reason: closure.unknown };
  }
  const targetRecords = [...closure.roots, ...(failedRecord ? [failedRecord] : [])]
    .filter((record, index, rows) => rows.findIndex((item) => item.configSymbol === record.configSymbol) === index);
  if (!targetRecords.length) return { candidates: [], recommended: null, status: 'inconclusive', reason: ['no-active-root'] };
  const requiredTargets = targetRecords.map((record) => ({
    symbol: record.configSymbol,
    package: record.package || packageNameFromSymbol(record.configSymbol),
    value: 'n',
  }));
  // Discover cleanup candidates from the same resolved forward graph, never
  // from a maintained trigger list. The normal intent engine proves whether
  // each candidate is orphaned and preserves surviving/shared consumers.
  // Potential forward edges also cover an already-disabled failed package.
  // They discover cleanup candidates only, never active build triggers; all
  // conditions/providers are still resolved against the current values.
  const cleanupGraph = activePackageGraph(model, startingValues, options, true);
  const descendants = new Set(targetRecords.map((record) => record.package));
  const pending = [...descendants];
  for (let index = 0; index < pending.length; index++) {
    for (const target of cleanupGraph.graph.get(pending[index]) || []) {
      if (!descendants.has(target)) { descendants.add(target); pending.push(target); }
    }
  }
  const dependencySymbols = new Set(intent.dependencySymbols || []);
  const directTargets = new Set(targetRecords.map((record) => record.configSymbol));
  for (const name of descendants) {
    const record = packageGraphRecord(model, name);
    if (record && !directTargets.has(record.configSymbol)) dependencySymbols.add(record.configSymbol);
  }
  const cleanupIntent = { ...intent, dependencySymbols };
  let values = new Map(startingValues);
  let changes = [];
  const allSteps = [];
  for (const record of targetRecords) {
    if (normalizeValue(values.get(record.configSymbol) ?? 'n') === 'n') continue;
    let plan = null;
    try { plan = compatibilityDisablePlan(model, record, values, cleanupIntent); } catch { plan = null; }
    if (!plan) {
      return { candidates: [], recommended: null, status: 'inconclusive', reason: [`cannot-disable:${record.package}`] };
    }
    values = plan.values;
    changes = compatibilityPlanChanges(startingValues, values, [...changes, ...plan.changes]);
    allSteps.push(...plan.steps);
  }
  const stepBySymbol = new Map();
  for (const record of targetRecords) stepBySymbol.set(record.configSymbol, {
    symbol: record.configSymbol, package: record.package, value: 'n',
  });
  // Keep user-facing actions to direct roots plus the failed package.  Any
  // selector/derived cleanup generated by the shared intent engine remains an
  // automatic change and is not promoted to a new manually curated trigger.
  const steps = [...stepBySymbol.values()];
  const candidate = compatibilityPlanCandidate(startingValues, steps, values, changes,
    failedRecord?.package || '', requiredTargets);
  candidate.dependencySymbols = [...dependencySymbols];
  candidate.retainedDependencies = [...dependencySymbols].filter((symbol) =>
    stateLevel(values.get(symbol) ?? 'n') > 0);
  if (compatibilityWarningTriggered(model, { ...warning, values }, values, options)) {
    return { candidates: [], recommended: null, status: 'inconclusive', reason: ['warning-remains-active'] };
  }
  return { candidates: [candidate], recommended: candidate, status: 'resolved', closure: closure.closure };
}

function deriveBuildDependencyPlans(model, inputValues, warning, intent = {}) {
  if (warning?.rule?.buildDependency?.legacy) return deriveLegacyBuildDependencyPlans(model, inputValues, warning, intent);
  return deriveGraphBuildDependencyPlans(model, inputValues, warning, intent);
}

export function deriveCompatibilityPlans(model, inputValues, warning, intent = {}) {
  const rule = warning?.rule;
  const records = warning?.records || [];
  const startingValues = warning?.values || inputValues;
  if (!rule || records.length < 1) throw compatibilityError('compatibility warning is incomplete');
  if (rule.buildDependency) return deriveBuildDependencyPlans(model, inputValues, warning, intent);
  const candidates = [];
  for (const record of records) {
    if (!record.canDisable) continue;
    try {
      const plan = compatibilityDisablePlan(model, record, startingValues, intent);
      if (!plan?.steps.length) continue;
      const resolved = !compatibilityWarningTriggered(model, { ...warning, values: plan.values }, plan.values,
        intent.validationOptions || {});
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
    if (item.code === 'kconfig-modules-unsatisfied') return `${item.symbol} requires MODULES=y for M`;
    if (item.code === 'kconfig-modules-deferred') return `${item.symbol} has deferred MODULES semantics`;
    if (item.code === 'kconfig-scalar-invalid') return `${item.symbol} has an invalid ${item.type} value`;
    if (item.code === 'kconfig-range-unsatisfied') return `${item.symbol} is outside its Kconfig range`;
    if (item.code === 'kconfig-range-deferred') return `${item.symbol} has a deferred Kconfig range`;
    if (item.code === 'kconfig-visibility-unsatisfied') return `${item.symbol} is not visible under ${item.dependency}`;
    if (item.code === 'kconfig-visibility-deferred') return `${item.symbol} has a deferred visibility condition`;
    if (item.code === 'choice-dependency-unsatisfied') return `${item.choice} has unsatisfied Kconfig dependencies`;
    if (item.code === 'choice-dependency-deferred') return `${item.choice} has deferred Kconfig dependencies`;
    if (item.code === 'choice-reset-unsupported') return `${item.choice} selection requires an unsupported native user-layer reset`;
    if (item.code === 'choice-reset-deferred') return `${item.choice} reset condition is deferred until the typed reset contract is available`;
    if (item.code === 'choice-modules-unsatisfied') return `${item.choice} does not allow module members`;
    if (item.code === 'choice-state-invalid') return `${item.choice} has an invalid member state`;
    if (item.code === 'package-conflict') {
      const other = item.otherPackage || (item.otherPackages || []).join(' || ') || item.capability || 'unknown provider';
      return `${item.package} conflicts with ${other}`;
    }
    if (item.code === 'package-conflict-deferred') return `${item.package} has an unresolved conflict provider ${item.capability}`;
    if (item.code === 'choice-conflict') return `${item.choice} enables multiple values: ${item.symbols.join(', ')}`;
    return item.code || 'catalog validation error';
  }).join('; ');
}

export { LEVEL, STATE };
export const DEPENDENCY_STATUS = Object.freeze({ SATISFIED: 'satisfied', UNSATISFIED: 'unsatisfied', DEFERRED: 'deferred' });
