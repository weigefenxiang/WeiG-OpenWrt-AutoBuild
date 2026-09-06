#!/usr/bin/env node
// Verify package-caused compatibility rules against the exact upstream package
// graph that the Custom Build worker is about to compile.  Catalog supplies the
// reviewed failure package; upstream metadata supplies the package graph.  This
// tool deliberately has no package-name knowledge and never edits .config.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHA256_RE = /^[a-f0-9]{64}$/;
const COMMIT_RE = /^[a-f0-9]{40}$/;
const PACKAGE_RE = /^[A-Za-z0-9][A-Za-z0-9+_.@-]{0,95}$/;
const REPOSITORY_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SOURCE_SCOPE_RE = /^(?:\*|[A-Za-z0-9_.-]{1,64})$/;
const BRANCH_SCOPE_RE = /^(?:[A-Za-z0-9._/-]{1,160}|[A-Za-z0-9._/-]*\*[A-Za-z0-9._/-]*)$/;
const TARGET_SCOPE_RE = /^[A-Za-z0-9_+@./-]{1,160}$/;
const TARGET_SCOPE_KEYS = new Set(['system', 'subtarget', 'profile']);
const RULE_ID_RE = /^[A-Z][A-Z0-9-]{2,31}$/;
const MAX_COMPATIBILITY_BYTES = 512 * 1024;

function fail(message, code = 2) {
  const error = new Error(message);
  error.exitCode = code;
  throw error;
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value) {
  return String(value ?? '').trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function readJson(path, label = path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`Unable to read ${label}: ${error.message}`);
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith('--')) fail(`Unknown argument: ${arg}`);
    const key = arg.slice(2);
    if (!key || index + 1 >= argv.length || argv[index + 1].startsWith('--')) {
      fail(`Argument requires a value: ${arg}`);
    }
    result[key] = argv[++index];
  }
  return result;
}

function requestFromArgs(args) {
  const requestPath = text(args.request);
  if (requestPath) return readJson(resolve(requestPath), 'schema-6 build request');
  const manifestPath = text(args['request-manifest']);
  if (manifestPath) {
    const manifest = readJson(resolve(manifestPath), 'request attachment manifest');
    const files = Array.isArray(manifest?.files)
      ? manifest.files.filter((entry) => entry?.type === 'json') : [];
    if (manifest?.version !== 1 || files.length !== 1 || manifest.files.length !== 1) {
      fail('Request manifest must contain exactly one JSON build request');
    }
    return readJson(resolve(text(files[0].path)), 'schema-6 build request');
  }
  return null;
}

function validateIdentity(request, args) {
  if (request) {
    if (Number(request.schema) !== 6) fail(`Only schema 6 requests are accepted; received ${request.schema}`);
    const catalog = request.catalog;
    if (!object(catalog)) fail('Schema 6 request is missing its Catalog identity');
    const repository = text(catalog.repository);
    const revision = text(catalog.revision).toLowerCase();
    const sourceCommit = text(catalog.sourceCommit).toLowerCase();
    if (!REPOSITORY_RE.test(repository)) fail('Request Catalog repository is invalid');
    if (!COMMIT_RE.test(revision)) fail('Request Catalog revision must be a full Git commit');
    if (!COMMIT_RE.test(sourceCommit)) fail('Request Catalog sourceCommit must be a full Git commit');
    const source = text(request.source);
    const version = text(request.version);
    const branch = text(request.branch);
    if (!source || !version || !branch) fail('Request Source/Branch identity is incomplete');
    const target = object(request.customTarget) ? request.customTarget : null;
    const targetFields = ['profileSelector', 'profileSymbol', 'subtarget', 'system'];
    if (!target || Object.keys(target).sort().join(',') !== targetFields.join(',')) {
      fail(`Request customTarget identity is incomplete; expected ${targetFields.join(',')}`);
    }
    if (targetFields.some((field) => typeof target[field] !== 'string')) {
      fail('Request customTarget identity fields must be strings');
    }
    if (!text(target.system) || !text(target.subtarget) ||
        !text(target.profileSymbol) || !text(target.profileSelector)) {
      fail('Request customTarget identity is missing system/subtarget/profile/profileSelector');
    }
    const suppliedRevision = text(args['catalog-revision']).toLowerCase();
    const suppliedSourceCommit = text(args['source-commit']).toLowerCase();
    if (!suppliedRevision || suppliedRevision !== revision) {
      fail(`CLI Catalog revision does not match the request: ${suppliedRevision} != ${revision}`);
    }
    if (!suppliedSourceCommit || suppliedSourceCommit !== sourceCommit) {
      fail(`CLI Source commit does not match the request: ${suppliedSourceCommit} != ${sourceCommit}`);
    }
    const suppliedSource = text(args.source);
    const suppliedBranch = text(args.branch);
    if (suppliedSource && suppliedSource !== source) fail(`CLI Source does not match the request: ${suppliedSource} != ${source}`);
    if (suppliedBranch && suppliedBranch !== branch) fail(`CLI Branch does not match the request: ${suppliedBranch} != ${branch}`);
    return {
      repository,
      revision,
      sourceCommit,
      source,
      branch,
      version,
      target: {
        system: text(target.system),
        subtarget: text(target.subtarget),
        profile: text(target.profileSymbol || target.profileSelector || target.profile),
        profileSymbol: text(target.profileSymbol),
        profileSelector: text(target.profileSelector),
      },
    };
  }
  const repository = text(args['catalog-repository']);
  const revision = text(args['catalog-revision']).toLowerCase();
  const sourceCommit = text(args['source-commit'] || args['upstream-commit']).toLowerCase();
  const source = text(args.source);
  const branch = text(args.branch);
  if (!REPOSITORY_RE.test(repository)) fail('Catalog repository is required and invalid');
  if (!COMMIT_RE.test(revision)) fail('Catalog revision is required and must be a full Git commit');
  if (!COMMIT_RE.test(sourceCommit)) fail('Source commit is required and must be a full Git commit');
  if (!source || !branch) fail('Source and Branch are required');
  const target = {
    system: text(args['target-system']),
    subtarget: text(args['target-subtarget']),
    profile: text(args['target-profile']),
    profileSymbol: text(args['target-profile-symbol']),
    profileSelector: text(args['target-profile-selector']),
  };
  if (!target.system || !target.subtarget || (!target.profile && !target.profileSymbol && !target.profileSelector)) {
    fail('Target identity is required (system, subtarget, and profile)');
  }
  return {
    repository, revision, sourceCommit, source, branch,
    version: text(args.version || branch),
    target,
  };
}

function configuredCatalogRepository(args) {
  const explicit = text(args['catalog-repository']);
  if (explicit) return explicit;
  const configPath = join(ROOT, 'site', 'wrt', 'config', 'site.json');
  const config = readJson(configPath, 'site configuration');
  const repository = text(config?.catalog?.repository || config?.catalogRepository);
  if (!REPOSITORY_RE.test(repository)) fail('Canonical Catalog repository is invalid');
  return repository;
}

async function fetchBytes(url, label) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  } catch (error) {
    throw new Error(`${label}: ${error.message}`);
  }
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function fetchPinnedAsset(repository, revision, asset, { binary = false } = {}) {
  const safeAsset = text(asset).replace(/^\/+/, '');
  if (!safeAsset || safeAsset.includes('..') || !/^[A-Za-z0-9._/-]+$/.test(safeAsset)) {
    fail(`Catalog asset path is invalid: ${asset}`);
  }
  const urls = [
    `https://cdn.jsdelivr.net/gh/${repository}@${revision}/${safeAsset}`,
    `https://raw.githubusercontent.com/${repository}/${revision}/${safeAsset}`,
  ];
  const errors = [];
  for (const url of urls) {
    try {
      const bytes = await fetchBytes(url, url);
      if (binary) return bytes;
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch (error) {
      errors.push(error.message);
    }
  }
  fail(`Unable to fetch pinned Catalog asset ${safeAsset}: ${errors.join(' | ')}`);
}

function validateCompatibilityContract(index) {
  const contract = index?.assets?.compatibility;
  if (!object(contract) || text(contract.asset) !== 'compatibility.json.gz' ||
      !SHA256_RE.test(text(contract.hash).toLowerCase()) ||
      !Number.isSafeInteger(Number(contract.bytes)) || Number(contract.bytes) <= 0 ||
      Number(contract.bytes) > MAX_COMPATIBILITY_BYTES + 1024 ||
      !Number.isSafeInteger(Number(contract.jsonBytes)) || Number(contract.jsonBytes) <= 0 ||
      Number(contract.jsonBytes) > MAX_COMPATIBILITY_BYTES ||
      ![2, 3, 4, 5].includes(Number(contract.schema)) ||
      !Number.isSafeInteger(Number(contract.rules)) || Number(contract.rules) < 0) {
    fail('Pinned Catalog index lacks a valid compatibility asset contract');
  }
  return {
    asset: 'compatibility.json.gz', hash: text(contract.hash).toLowerCase(),
    bytes: Number(contract.bytes), jsonBytes: Number(contract.jsonBytes),
    schema: Number(contract.schema), rules: Number(contract.rules),
  };
}

function validateCompatibilityDocument(document, label = 'Catalog compatibility document') {
  if (!object(document) || ![2, 3, 4, 5].includes(Number(document.schema)) || !Array.isArray(document.rules)) {
    fail(`${label} is not a supported compatibility document`);
  }
  for (const [index, rule] of document.rules.entries()) {
    if (!object(rule)) fail(`${label} contains a non-object rule at index ${index}`);
  }
  return document;
}

function validateCatalogEnvironment(index, identity) {
  const source = Array.isArray(index?.sources)
    ? index.sources.find((row) => text(row?.id) === identity.source) : null;
  const branch = source && Array.isArray(source.branches)
    ? source.branches.find((row) => text(row?.branch) === identity.branch &&
      (!identity.version || text(row?.id) === identity.version || text(row?.version) === identity.version))
    : null;
  if (!source || !branch || text(branch.state) === 'unavailable') {
    fail(`Pinned Catalog index lacks the exact Source/Branch environment: ${identity.source}/${identity.branch}`);
  }
  const indexedCommit = text(branch.commit || branch.sourceCommit).toLowerCase();
  if (!COMMIT_RE.test(indexedCommit) || indexedCommit !== identity.sourceCommit) {
    fail(`Pinned Catalog Source/Branch commit does not match the request: ${indexedCommit || '(missing)'} != ${identity.sourceCommit}`);
  }
  return { source, branch };
}

async function loadCompatibility(identity, args) {
  const supplied = text(args.compatibility);
  if (supplied) {
    const path = resolve(supplied);
    const bytes = readFileSync(path);
    let document;
    try {
      document = path.endsWith('.gz') ? JSON.parse(gunzipSync(bytes).toString('utf8')) : JSON.parse(bytes.toString('utf8'));
    } catch (error) {
      fail(`Unable to parse compatibility document: ${error.message}`);
    }
    return { document: validateCompatibilityDocument(document, 'Local compatibility document'), contract: null, provider: 'local-fixture' };
  }
  const repository = configuredCatalogRepository(args);
  if (repository !== identity.repository) {
    fail(`Request Catalog repository is not the configured repository: ${identity.repository} != ${repository}`);
  }
  const index = await fetchPinnedAsset(repository, identity.revision, 'index.json');
  if (!object(index) || Number(index.schema || 0) < 2 || !Array.isArray(index.sources)) {
    fail('Pinned Catalog index is missing its source/branch environment data');
  }
  const indexAssetRef = text(index.assetRef).toLowerCase();
  // Legacy immutable Catalog snapshots predate the self-describing assetRef
  // field. The request revision is already the immutable Git ref used to read
  // this index; if a newer index carries assetRef, it must agree.
  if (indexAssetRef && indexAssetRef !== identity.revision) {
    fail('Catalog index assetRef does not match the request revision: ' + indexAssetRef + ' != ' + identity.revision);
  }
  validateCatalogEnvironment(index, identity);
  const contract = validateCompatibilityContract(index);
  const compressed = await fetchPinnedAsset(repository, identity.revision, contract.asset, { binary: true });
  if (compressed.byteLength !== contract.bytes) {
    fail(`Catalog compatibility byte count mismatch: ${compressed.byteLength} != ${contract.bytes}`);
  }
  if (sha256(compressed) !== contract.hash) fail('Catalog compatibility compressed SHA-256 mismatch');
  let document;
  try { document = JSON.parse(gunzipSync(compressed).toString('utf8')); }
  catch (error) { fail(`Unable to decompress or parse Catalog compatibility: ${error.message}`); }
  validateCompatibilityDocument(document);
  if (Number(document?.schema) !== contract.schema ||
      document.rules.length !== contract.rules ||
      Buffer.byteLength(JSON.stringify(document)) !== contract.jsonBytes) {
    fail('Catalog compatibility document does not match its index contract');
  }
  return { document, contract, provider: 'jsdelivr/raw-pinned' };
}

function matchPattern(value, pattern) {
  const source = text(value);
  const candidate = text(pattern);
  if (candidate === '*') return true;
  if (!candidate.includes('*')) return source === candidate;
  const expression = '^' + candidate.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$';
  return new RegExp(expression).test(source);
}

function targetScopeMatches(scope, identity) {
  if (!object(scope) || !Object.keys(scope).length) return true;
  const target = identity.target || {};
  return Object.entries(scope).every(([key, values]) => {
    const actuals = unique([target[key], key === 'profile' ? target.profileSymbol : '', key === 'profile' ? target.profileSelector : '']);
    return Array.isArray(values) && actuals.some((actual) => values.some((pattern) => matchPattern(actual, pattern)));
  });
}

function environmentMatches(environment, identity) {
  if (!object(environment)) return false;
  return (environment.source === '*' || text(environment.source) === identity.source) &&
    (environment.branch === '*' || matchPattern(identity.branch, environment.branch)) &&
    targetScopeMatches(environment.targetScope, identity);
}

function legacyScopeMatches(scope, identity) {
  if (!object(scope)) return false;
  const values = scope[identity.source] || scope['*'];
  return Array.isArray(values) && values.some((pattern) => matchPattern(identity.branch, pattern));
}

function validTargetScope(scope, { allowEmpty = true } = {}) {
  if (!object(scope) || (!allowEmpty && !Object.keys(scope).length)) return false;
  return Object.entries(scope).every(([key, values]) => TARGET_SCOPE_KEYS.has(key) &&
    Array.isArray(values) && values.length > 0 && values.every((value) => TARGET_SCOPE_RE.test(text(value))));
}

function validLegacyScope(scope) {
  if (!object(scope) || !Object.keys(scope).length) return false;
  if (Object.hasOwn(scope, '*') && Object.keys(scope).length !== 1) return false;
  return Object.entries(scope).every(([source, branches]) => SOURCE_SCOPE_RE.test(source) &&
    Array.isArray(branches) && branches.length > 0 && branches.every((branch) => BRANCH_SCOPE_RE.test(text(branch))));
}

function validPreventiveEnvironment(environment) {
  if (!object(environment) || !SOURCE_SCOPE_RE.test(text(environment.source)) ||
      !BRANCH_SCOPE_RE.test(text(environment.branch))) return false;
  if (environment.packageAvailability !== undefined &&
      !['required', 'if-present'].includes(text(environment.packageAvailability))) return false;
  return environment.targetScope === undefined || validTargetScope(environment.targetScope);
}

function configValues(path) {
  const values = new Map();
  const lines = readFileSync(path, 'utf8').replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    let match = line.match(/^CONFIG_([A-Za-z0-9_+@.-]+)=(.*)$/);
    if (match) values.set(match[1], match[2].trim());
    match = line.match(/^# CONFIG_([A-Za-z0-9_+@.-]+) is not set$/);
    if (match) values.set(match[1], 'n');
  }
  return values;
}

function configBool(values, symbol) {
  const key = text(symbol).replace(/^CONFIG_/, '');
  const value = values?.get?.(key);
  if (value === undefined) return null;
  return value === 'y' || value === 'm' || value === '1' || value === 'yes';
}

function evaluateCondition(expression, values) {
  const source = text(expression);
  if (!source) return true;

  // Conditions occur in both Catalog rules and OpenWrt package metadata.  Do
  // not turn them into JavaScript: besides being unnecessary, doing so makes
  // malformed Kconfig expressions surprisingly truthy/falsey.  This parser
  // intentionally accepts the small boolean grammar used by package DEPENDS
  // selectors (`!`, `&&`, `||`, and parentheses) and evaluates with Kleene
  // three-valued logic so an unknown symbol remains inconclusive unless the
  // other side of a short-circuit proves the result.
  const tokens = [];
  let offset = 0;
  while (offset < source.length) {
    const rest = source.slice(offset);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) { offset += whitespace[0].length; continue; }
    const operator = rest.match(/^(?:&&|\|\||!|\(|\))/);
    if (operator) { tokens.push(operator[0]); offset += operator[0].length; continue; }
    // OpenWrt package Kconfig symbols preserve package punctuation (most
    // notably `-`, and occasionally `.`/`+`) after the PACKAGE_ prefix.
    const symbol = rest.match(/^[A-Za-z_][A-Za-z0-9_+@.-]*/);
    if (symbol) { tokens.push(symbol[0]); offset += symbol[0].length; continue; }
    // Single '&'/'|', comparisons, quoted strings, and any other spelling
    // are not valid selector conditions.  Treat them as unresolved rather
    // than trying to guess what the author intended.
    return null;
  }
  tokens.push('<eof>');
  let index = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];
  const literal = (token) => {
    if (token === 'true' || token === 'y' || token === 'm') return true;
    if (token === 'false' || token === 'n') return false;
    return configBool(values, token);
  };
  const and = (left, right) => left === false || right === false ? false
    : left === true && right === true ? true : null;
  const or = (left, right) => left === true || right === true ? true
    : left === false && right === false ? false : null;
  function parsePrimary() {
    if (peek() === '(') {
      take();
      const value = parseOr();
      if (take() !== ')') return null;
      return value;
    }
    const token = take();
    if (token === '<eof>' || token === ')' || token === '!' || token === '&&' || token === '||') {
      return null;
    }
    return literal(token);
  }
  function parseNot() {
    if (peek() === '!') { take(); const value = parseNot(); return value === null ? null : !value; }
    return parsePrimary();
  }
  function parseAnd() {
    let value = parseNot();
    while (peek() === '&&') { take(); value = and(value, parseNot()); }
    return value;
  }
  function parseOr() {
    let value = parseAnd();
    while (peek() === '||') { take(); value = or(value, parseAnd()); }
    return value;
  }
  const result = parseOr();
  return peek() === '<eof>' ? result : null;
}

function applicableRules(document, identity, availablePackages, values) {
  const packages = new Set();
  const rules = [];
  const skipped = [];
  const unresolved = [];
  values ||= new Map();
  for (const rule of document?.rules || []) {
    if (!object(rule) || rule.issue !== 'build-failure') continue;
    if (!RULE_ID_RE.test(text(rule.id))) {
      unresolved.push({ rule: text(rule.id), reason: 'invalid-compatibility-rule-id' });
      continue;
    }
    if (!object(rule.buildDependency)) {
      // Build-failure records without a concrete package describe a profile or
      // infrastructure failure, which this package-closure gate cannot prove
      // or disprove.  A package-caused record without its failed package is a
      // malformed Catalog entry and must fail closed.
      if (['package-caused', 'dependency-caused'].includes(text(rule.failure?.cause))) {
        unresolved.push({ rule: text(rule.id), reason: 'missing-build-dependency-package' });
      }
      continue;
    }
    const dependency = text(rule.buildDependency.package);
    if (!PACKAGE_RE.test(dependency)) {
      unresolved.push({ rule: text(rule.id), reason: 'invalid-build-dependency-package' });
      continue;
    }
    if (!Array.isArray(rule.packages) || !rule.packages.length ||
        rule.packages.some((name) => !PACKAGE_RE.test(text(name))) ||
        !rule.packages.map((name) => text(name)).includes(dependency)) {
      unresolved.push({ rule: text(rule.id), package: dependency, reason: 'build-dependency-not-listed-as-failed-package' });
      continue;
    }
    if (!['all-selected', 'all-installed'].includes(text(rule.match))) {
      unresolved.push({ rule: text(rule.id), package: dependency, reason: 'invalid-compatibility-match' });
      continue;
    }
    if (rule.if !== undefined && (typeof rule.if !== 'string' || text(rule.if).length > 512)) {
      unresolved.push({ rule: text(rule.id), package: dependency, reason: 'invalid-rule-condition' });
      continue;
    }
    if (rule.buildDependency.triggerPackages !== undefined &&
        (!Array.isArray(rule.buildDependency.triggerPackages) ||
         rule.buildDependency.triggerPackages.some((name) => !PACKAGE_RE.test(text(name))))) {
      unresolved.push({ rule: text(rule.id), package: dependency, reason: 'invalid-legacy-trigger-packages' });
      continue;
    }
    if (Object.keys(rule.buildDependency).some((key) => !['package', 'triggerPackages'].includes(key)) ||
        (Array.isArray(rule.buildDependency.triggerPackages) &&
         rule.buildDependency.triggerPackages.map((name) => text(name)).includes(dependency))) {
      unresolved.push({ rule: text(rule.id), package: dependency, reason: 'unsupported-build-dependency-fields' });
      continue;
    }
    if (rule.policy !== undefined && rule.policy !== 'preventive') {
      unresolved.push({ rule: text(rule.id), package: dependency, reason: 'invalid-compatibility-policy' });
      continue;
    }
    if (rule.policy === 'preventive' &&
        (!Array.isArray(rule.environments) || !rule.environments.length ||
         rule.environments.some((row) => !validPreventiveEnvironment(row)))) {
      unresolved.push({ rule: text(rule.id), package: dependency, reason: 'invalid-preventive-environments' });
      continue;
    }
    if (rule.policy !== 'preventive' && !validLegacyScope(rule.scope)) {
      unresolved.push({ rule: text(rule.id), package: dependency, reason: 'legacy-scope-unresolved' });
      continue;
    }
    if (rule.targetScope !== undefined && !validTargetScope(rule.targetScope, { allowEmpty: false })) {
      unresolved.push({ rule: text(rule.id), package: dependency, reason: 'invalid-target-scope' });
      continue;
    }
    if (rule.sourceCommits !== undefined && (!Array.isArray(rule.sourceCommits) ||
        !rule.sourceCommits.length ||
        rule.sourceCommits.some((value) => !COMMIT_RE.test(text(value).toLowerCase())))) {
      unresolved.push({ rule: text(rule.id), package: dependency, reason: 'invalid-source-commit-scope' });
      continue;
    }
    const scopeMatch = rule.policy === 'preventive'
      ? rule.environments.some((row) => environmentMatches(row, identity))
      : legacyScopeMatches(rule.scope, identity) && targetScopeMatches(rule.targetScope, identity);
    if (!scopeMatch) continue;
    if (Array.isArray(rule.sourceCommits) && rule.sourceCommits.length &&
        !rule.sourceCommits.map((value) => text(value).toLowerCase()).includes(identity.sourceCommit)) {
      skipped.push({ rule: text(rule.id), package: dependency, reason: 'source-commit-out-of-scope' });
      continue;
    }
    const condition = evaluateCondition(rule.if, values);
    if (condition === false) continue;
    if (condition === null) {
      unresolved.push({ rule: text(rule.id), package: dependency, reason: 'rule-condition-unresolved', condition: rule.if });
      continue;
    }
    const environment = rule.policy === 'preventive'
      ? rule.environments.find((row) => environmentMatches(row, identity)) : null;
    const availability = text(environment?.packageAvailability || 'required') || 'required';
    if (!['required', 'if-present'].includes(availability)) {
      unresolved.push({ rule: text(rule.id), package: dependency, reason: 'invalid-package-availability' });
      continue;
    }
    if (!availablePackages.has(dependency)) {
      if (availability === 'if-present') {
        skipped.push({ rule: text(rule.id), package: dependency, reason: 'failed-package-absent' });
      } else {
        unresolved.push({ rule: text(rule.id), package: dependency, reason: 'failed-package-metadata-unresolved' });
      }
      continue;
    }
    packages.add(dependency);
    rules.push({ id: text(rule.id), package: dependency });
  }
  return { packages: [...packages].sort(), rules, skipped, unresolved };
}

function activePackages(configPath) {
  const values = configValues(configPath);
  const active = new Map();
  for (const [symbol, value] of values) {
    if (!symbol.startsWith('PACKAGE_') || !['y', 'm'].includes(value)) continue;
    const packageName = symbol.slice('PACKAGE_'.length);
    if (PACKAGE_RE.test(packageName)) active.set(packageName, value);
  }
  return { values, active };
}

function splitDependencyTokens(value) {
  // Keep boolean parentheses intact while splitting the whitespace-separated
  // package DEPENDS syntax.  A parenthesized version constraint is discarded
  // later, after the atom has been identified; stripping every parenthesis up
  // front would also destroy selector expressions such as `(A||B):pkg`.
  const source = text(value).replace(/\r\n/g, '\n');
  const tokens = [];
  let current = '';
  let depth = 0;
  const push = () => { if (current) tokens.push(current); current = ''; };
  for (const character of source) {
    if (character === '(') depth++;
    if (character === ')' && depth > 0) depth--;
    if ((/\s/.test(character) || ',;'.includes(character)) && depth === 0) push();
    else current += character;
  }
  push();
  return tokens;
}

function stripVersionConstraint(token) {
  return text(token).replace(/\s*\((?:\s*[<>=!~].*?)\)\s*$/, '').trim();
}

function cleanDependencyToken(token, { allowVirtual = false } = {}) {
  let value = stripVersionConstraint(token).replace(/^\++/, '');
  if (allowVirtual) value = value.replace(/^@+/, '');
  value = value.replace(/^(?:[<>=!~]+).*/, '');
  value = value.replace(/[<>=!~].*$/, '');
  if (value.startsWith('@') || value.startsWith('CONFIG_') || !PACKAGE_RE.test(value)) return '';
  return value;
}

function dependencyGroup(alternatives, condition = '', raw = '') {
  const group = unique(alternatives);
  if (condition) Object.defineProperty(group, 'condition', {
    value: text(condition), enumerable: false, configurable: true,
  });
  if (raw) Object.defineProperty(group, 'raw', {
    value: text(raw), enumerable: false, configurable: true, writable: true,
  });
  return group;
}

function parseDependencyAtom(token, { build = false } = {}) {
  const raw = text(token);
  if (!raw || raw === '|' || raw === '||') return raw ? { separator: true } : null;
  if (/^\([^)]*\)$/.test(raw)) return null; // standalone version constraint

  const colon = raw.indexOf(':');
  const hasCondition = colon >= 0;
  const prefix = hasCondition ? raw.slice(0, colon) : '';
  const body = hasCondition ? raw.slice(colon + 1) : raw;
  const flags = (hasCondition ? prefix : body).match(/^[+@]*/)?.[0] || '';
  if (!hasCondition && flags.includes('@')) {
    // `@TARGET_x86` (and `@A||@B`) is a package selector, not a package
    // vertex.  It constrains the package's Kconfig entry; making it an edge
    // would invent a dependency on a non-package symbol.
    return { selector: true };
  }
  const condition = hasCondition ? prefix.replace(/^[+@]+/, '').trim() : '';
  if (hasCondition && !condition) return { invalid: true, raw, reason: 'empty-selector-condition' };
  const rawAlternatives = body.split(/\|+/);
  const isHostOnly = (part) => build && /\/host(?:\s*\([^)]*\))?$/.test(text(part));
  const ignored = rawAlternatives.filter(isHostOnly).length;
  const alternatives = rawAlternatives.map((part) => {
    if (build) {
      if (isHostOnly(part)) return '';
      const sourceName = text(part).replace(/\/[^/\s()]+(?:\s*\([^)]*\))?$/, '');
      return cleanDependencyToken(sourceName);
    }
    return cleanDependencyToken(part);
  }).filter(Boolean);
  if (build && ignored === rawAlternatives.length) return { ignored: true };
  if (!alternatives.length) return { invalid: true, raw, reason: 'invalid-package-token' };
  if (rawAlternatives.some((part) => !(build
    ? isHostOnly(part) || cleanDependencyToken(text(part).replace(/\/[^/\s()]+(?:\s*\([^)]*\))?$/, ''))
    : cleanDependencyToken(part)))) {
    return { invalid: true, raw, reason: 'invalid-package-alternative' };
  }
  return { alternatives: unique(alternatives), condition, raw, flags };
}

function dependencyGroups(value, options = {}) {
  const groups = [];
  const errors = [];
  let current = null;
  let joinAlternative = false;
  const flush = () => { if (current) groups.push(current); current = null; joinAlternative = false; };
  for (const token of splitDependencyTokens(value)) {
    if (token === ';' || token === ',') continue;
    const atom = parseDependencyAtom(token, options);
    if (atom?.separator) {
      if (!current) errors.push({ token, reason: 'alternative-without-package' });
      else joinAlternative = true;
      continue;
    }
    if (atom?.selector) {
      // Standalone selectors are deliberately ignored as graph edges.
      continue;
    }
    if (atom?.ignored) continue;
    if (!atom) {
      if (/^\([^)]*\)$/.test(token)) continue;
      errors.push({ token, reason: 'invalid-dependency-token' });
      if (joinAlternative) flush();
      continue;
    }
    if (atom.invalid) {
      errors.push({ token: atom.raw || token, reason: atom.reason || 'invalid-dependency-token' });
      flush();
      continue;
    }
    if (current && joinAlternative && text(current.condition) === text(atom.condition)) {
      current.push(...atom.alternatives.filter((name) => !current.includes(name)));
      Object.defineProperty(current, 'raw', {
        value: `${text(current.raw)} ${atom.raw}`.trim(), enumerable: false, configurable: true,
      });
    } else {
      flush();
      current = dependencyGroup(atom.alternatives, atom.condition, atom.raw);
    }
    joinAlternative = false;
  }
  if (joinAlternative) errors.push({ token: '||', reason: 'alternative-without-package' });
  flush();
  Object.defineProperty(groups, 'errors', { value: errors, enumerable: false });
  return groups;
}

function addPackage(packages, name, row = {}) {
  const packageName = cleanDependencyToken(name);
  if (!packageName) return null;
  let record = packages.get(packageName);
  if (!record) {
    record = {
      name: packageName, depends: [], dependencyErrors: [], provides: new Set(),
      sourceNames: new Set(), sourceMakefiles: new Set(), records: 0,
    };
    packages.set(packageName, record);
  }
  record.records++;
  for (const group of row.depends || []) record.depends.push(group);
  for (const error of row.depends?.errors || []) record.dependencyErrors.push(error);
  for (const group of row.buildDepends || []) record.depends.push(group);
  for (const error of row.buildDepends?.errors || []) record.dependencyErrors.push({ ...error, field: 'Build-Depends' });
  for (const value of row.provides || []) {
    const provided = cleanDependencyToken(value, { allowVirtual: true });
    if (provided && provided !== packageName) record.provides.add(provided);
  }
  if (row.sourceMakefile) {
    const sourceMakefile = text(row.sourceMakefile);
    record.sourceMakefiles.add(sourceMakefile);
    const sourceName = sourceMakefile.replaceAll('\\', '/').split('/').at(-2) || '';
    if (PACKAGE_RE.test(sourceName)) record.sourceNames.add(sourceName);
  }
  return record;
}

function fieldsFromBlock(block) {
  const fields = {};
  let current = '';
  for (const line of block.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9-]*):\s*(.*)$/);
    if (match) {
      current = match[1];
      fields[current] = match[2];
    } else if (current && line.trim()) {
      fields[current] += ` ${line.trim()}`;
    }
  }
  return fields;
}

function parsePackageInfo(path) {
  const content = readFileSync(path, 'utf8');
  const packages = new Map();
  const hasRecordMarkers = /^\s*@@\s*$/m.test(content);
  const blocks = hasRecordMarkers
    ? content.split(/^\s*@@\s*$/gm)
    : content.split(/\n\s*\n/);
  let sourceMakefile = '';
  let packageBlocks = 0;
  for (const block of blocks) {
    const fields = fieldsFromBlock(block);
    sourceMakefile = text(fields['Source-Makefile']) || sourceMakefile;
    const name = cleanDependencyToken(fields.Package);
    if (!name) continue;
    packageBlocks++;
    addPackage(packages, name, {
      depends: dependencyGroups(fields.Depends),
      buildDepends: dependencyGroups(fields['Build-Depends'], { build: true }),
      provides: splitDependencyTokens(fields.Provides || ''),
      sourceMakefile,
    });
  }
  return { packages, blocks: packageBlocks };
}

function walkMakefiles(directory, output = [], seen = new Set()) {
  if (!existsSync(directory)) return output;
  let realDirectory;
  try { realDirectory = realpathSync(directory); } catch { return output; }
  if (seen.has(realDirectory)) return output;
  seen.add(realDirectory);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const directoryEntry = entry.isDirectory() || (entry.isSymbolicLink() && (() => {
      try { return statSync(path).isDirectory(); } catch { return false; }
    })());
    if (directoryEntry) {
      if (!['.git', 'tmp', 'staging_dir', 'build_dir', 'bin', 'logs'].includes(entry.name)) {
        walkMakefiles(path, output, seen);
      }
    } else if (entry.isFile() && entry.name === 'Makefile') output.push(path);
  }
  return output;
}

function makeAssignmentValue(body, key) {
  const lines = String(body || '').replace(/\r\n/g, '\n').split('\n');
  const assignment = new RegExp(`^\\s*${key}\\s*(?::=|\\?=|\\+=|=)\\s*(.*)$`);
  const values = [];
  let collecting = false;
  for (const line of lines) {
    if (!collecting) {
      const match = line.match(assignment);
      if (!match) continue;
      values.push(match[1]);
      collecting = /\\\s*$/.test(match[1]);
      continue;
    }
    values.push(line.trim());
    collecting = /\\\s*$/.test(line);
  }
  return values.join(' ').replace(/\\\s*/g, ' ').trim();
}

function parseMakefiles(upstreamDir, packages) {
  const paths = walkMakefiles(join(upstreamDir, 'package'))
    .concat(walkMakefiles(join(upstreamDir, 'feeds')));
  let records = 0;
  for (const path of paths) {
    const content = readFileSync(path, 'utf8');
    // A Makefile commonly defines multiple package variants.  Scope DEPENDS
    // and PROVIDES to each Package/<name> block; assigning every Makefile
    // dependency to every package would manufacture false closure paths.
    const definitions = [...content.matchAll(/^define\s+Package\/([^\s/]+)\s*$([\s\S]*?)^endef\s*$/gm)];
    for (const definition of definitions) {
      const name = definition[1];
      const body = definition[2] || '';
      const depends = makeAssignmentValue(body, 'DEPENDS');
      const provides = makeAssignmentValue(body, 'PROVIDES');
      if (packages.has(cleanDependencyToken(name))) continue;
      addPackage(packages, name, {
        depends: dependencyGroups(depends),
        buildDepends: dependencyGroups(makeAssignmentValue(body, 'PKG_BUILD_DEPENDS'), { build: true }),
        provides: splitDependencyTokens(provides),
        sourceMakefile: relative(upstreamDir, path).replaceAll('\\', '/'),
      });
      records++;
    }
  }
  return { files: paths.length, records };
}

function loadPackageGraph(upstreamDir, args) {
  const packages = new Map();
  const metadataPath = text(args['package-info']) || join(upstreamDir, 'tmp', '.packageinfo');
  const metadataExists = existsSync(metadataPath) && statSync(metadataPath).isFile();
  let metadata = { path: metadataPath, exists: metadataExists, blocks: 0 };
  if (metadataExists) {
    const parsed = parsePackageInfo(metadataPath);
    metadata = { ...metadata, blocks: parsed.blocks };
    for (const [name, record] of parsed.packages) packages.set(name, record);
  }
  const makefiles = parseMakefiles(upstreamDir, packages);
  if (!metadataExists && !makefiles.records) {
    fail(`Upstream package metadata is missing or empty: ${metadataPath}`);
  }
  if (metadataExists && !packages.size && !makefiles.records) {
    fail(`Upstream package metadata contains no package records: ${metadataPath}`);
  }
  const providers = new Map();
  for (const record of packages.values()) {
    for (const provided of [...record.provides, ...record.sourceNames]) {
      const rows = providers.get(provided) || [];
      rows.push(record.name);
      providers.set(provided, rows);
    }
  }
  for (const [name, rows] of providers) providers.set(name, unique(rows).sort());
  const parseErrors = [...packages.values()].flatMap((record) =>
    record.dependencyErrors.map((error) => ({ package: record.name, ...error })));
  return { packages, providers, parseErrors, metadata: { ...metadata, makefiles, parseErrors } };
}

function dependencyCandidates(group, graph) {
  const candidates = [];
  for (const name of group) {
    if (graph.packages.has(name)) candidates.push(name);
    for (const provider of graph.providers.get(name) || []) candidates.push(provider);
  }
  return unique(candidates);
}

function dependencyUnknowns(group, graph) {
  return group.filter((name) => !graph.packages.has(name) && !(graph.providers.get(name) || []).length);
}

function resolveDependencyGroup(group, graph, active, values = new Map()) {
  const condition = evaluateCondition(group?.condition, values);
  if (condition === false) return { status: 'skipped', group, reason: 'dependency-selector-false' };
  if (condition === null) {
    return { status: 'inconclusive', group, reason: 'dependency-selector-unresolved', condition: group?.condition };
  }
  const candidates = dependencyCandidates(group, graph);
  const unknown = dependencyUnknowns(group, graph);
  if (!candidates.length) {
    return { status: 'inconclusive', group, reason: 'dependency-package-metadata-missing', unknown };
  }
  const activeCandidates = candidates.filter((candidate) => active.has(candidate));
  // An absent alternative is still meaningful: silently dropping it can turn
  // `failed||safe` into a single-provider edge when the metadata is partial.
  // An explicitly active missing package is always inconclusive.  When a
  // known provider is selected, missing alternatives still remain unresolved
  // metadata: dropping them would make the result depend on a partial graph.
  const activeUnknown = unknown.filter((name) => active.has(name));
  if (activeUnknown.length) {
    return { status: 'inconclusive', candidates, unknown, activeUnknown, group,
      reason: 'active-alternative-package-metadata-missing' };
  }
  if (activeCandidates.length) {
    if (unknown.length) return { status: 'inconclusive', candidates, unknown, group,
      reason: 'alternative-package-metadata-missing' };
    return { status: 'resolved', candidates: activeCandidates, group, selected: 'active-config' };
  }
  if (unknown.length) {
    return { status: 'inconclusive', candidates, unknown, group,
      reason: 'alternative-package-metadata-missing' };
  }
  if (candidates.length === 1) return { status: 'resolved', candidates, group, selected: 'single-provider' };
  return { status: 'inconclusive', candidates, group, reason: 'or-provider-selection-unresolved' };
}

function buildReverseCandidates(target, graph) {
  const reverse = new Map();
  for (const record of graph.packages.values()) {
    for (const group of record.depends) {
      const candidates = dependencyCandidates(group, graph);
      if (target && !candidates.includes(target)) continue;
      for (const candidate of target ? [target] : candidates) {
        const rows = reverse.get(candidate) || [];
        rows.push({ package: record.name, group, candidates });
        reverse.set(candidate, rows);
      }
    }
  }
  return reverse;
}

function findPathsToTarget(target, graph, active, values = new Map()) {
  const reverse = buildReverseCandidates('', graph);
  const candidates = new Set();
  const queue = [target];
  const seen = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    for (const row of reverse.get(current) || []) {
      if (!seen.has(row.package)) queue.push(row.package);
      if (active.has(row.package)) candidates.add(row.package);
    }
  }
  for (const root of active.keys()) if (root === target) candidates.add(root);

  const paths = [];
  const unresolved = [];
  const visiting = new Set();
  function visit(name, path) {
    if (name === target) {
      paths.push([...path, name]);
      return 'reachable';
    }
    const record = graph.packages.get(name);
    if (!record) {
      unresolved.push({ path: [...path, name], reason: 'active-package-metadata-missing' });
      return 'inconclusive';
    }
    if (visiting.has(name)) return 'not-reachable';
    visiting.add(name);
    let status = 'not-reachable';
    for (const group of record.depends) {
      const resolved = resolveDependencyGroup(group, graph, active, values);
      if (resolved.status === 'skipped') continue;
      if (resolved.status === 'inconclusive') {
        unresolved.push({ path: [...path, name], group, reason: resolved.reason, candidates: resolved.candidates });
        status = 'inconclusive';
        continue;
      }
      for (const candidate of resolved.candidates) {
        const child = visit(candidate, [...path, name]);
        if (child === 'reachable') status = 'reachable';
        else if (child === 'inconclusive' && status !== 'reachable') status = 'inconclusive';
      }
    }
    visiting.delete(name);
    return status;
  }
  let overall = 'not-reachable';
  for (const root of candidates) {
    const result = visit(root, []);
    if (result === 'reachable') overall = 'reachable';
    else if (result === 'inconclusive' && overall !== 'reachable') overall = 'inconclusive';
  }
  return { status: overall, candidates: [...candidates].sort(), paths, unresolved, reverseEdges: reverse.get(target) || [] };
}

function unresolvedActiveDependencyGraph(graph, active, values = new Map()) {
  const unresolved = [];
  const visited = new Set();
  function visit(name, path) {
    if (visited.has(name)) return;
    visited.add(name);
    const record = graph.packages.get(name);
    if (!record) {
      unresolved.push({ path: [...path, name], reason: 'active-package-metadata-missing' });
      return;
    }
    for (const group of record.depends) {
      const resolved = resolveDependencyGroup(group, graph, active, values);
      if (resolved.status === 'skipped' || resolved.status === 'resolved') {
        for (const candidate of resolved.candidates || []) visit(candidate, [...path, name]);
      } else {
        unresolved.push({ path: [...path, name], group, reason: resolved.reason,
          candidates: resolved.candidates, unknown: resolved.unknown, condition: resolved.condition });
      }
    }
  }
  for (const root of active.keys()) visit(root, []);
  return unresolved;
}

function upstreamCommit(upstreamDir, args, identity) {
  const expected = text(args['source-commit'] || identity.sourceCommit).toLowerCase();
  let actual = text(args['upstream-commit']).toLowerCase();
  if (!actual && existsSync(join(upstreamDir, '.git'))) {
    try { actual = text(execFileSync('git', ['-C', upstreamDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' })).toLowerCase(); }
    catch (error) { fail(`Unable to read upstream Git commit: ${error.message}`); }
  }
  if (!COMMIT_RE.test(actual) || actual !== expected) {
    fail(`Upstream source commit is not the exact requested commit: actual=${actual || '(missing)'} expected=${expected}`);
  }
  return actual;
}

export function verifyBuildClosure({ document, identity, graph, active, configValues: values }) {
  const applicable = applicableRules(document, identity, new Set(graph.packages.keys()), values);
  const output = {
    schema: 1,
    result: 'pass',
    identity,
    applicable,
    metadata: graph.metadata,
    availablePackageCount: graph.packages.size,
    activeRoots: [...active.keys()].sort(),
    checks: [],
  };
  if (graph.parseErrors?.length) {
    output.result = 'inconclusive';
    output.reason = 'upstream-package-dependency-syntax-unresolved';
    output.unresolved = graph.parseErrors;
    return output;
  }
  const missingActiveRoots = [...active.keys()].filter((name) => !graph.packages.has(name));
  if (missingActiveRoots.length) {
    output.result = 'inconclusive';
    output.reason = 'active-package-metadata-missing';
    output.unresolved = missingActiveRoots.map((packageName) => ({
      package: packageName, reason: 'active-package-metadata-missing',
    }));
    return output;
  }
  if (applicable.unresolved.length) {
    output.result = 'inconclusive';
    output.reason = 'catalog-rule-applicability-unresolved';
    return output;
  }
  const activeGraphUnresolved = unresolvedActiveDependencyGraph(graph, active, values || new Map());
  if (activeGraphUnresolved.length) output.activeGraphUnresolved = activeGraphUnresolved;
  for (const target of applicable.packages) {
    const check = findPathsToTarget(target, graph, active, values || new Map());
    output.checks.push({ target, ...check });
    if (check.status === 'reachable') output.result = 'fail';
    else if (check.status === 'inconclusive' && output.result !== 'fail') output.result = 'inconclusive';
  }
  if (output.result === 'fail') output.reason = 'failed-package-reachable-from-active-root';
  else if (activeGraphUnresolved.length) {
    output.result = 'inconclusive';
    output.reason = 'active-package-closure-inconclusive';
  }
  else if (output.result === 'inconclusive') output.reason = 'package-closure-inconclusive';
  else if (!applicable.packages.length) output.reason = applicable.skipped.length ? 'no-applicable-failed-package' : 'no-applicable-build-dependency-rule';
  else output.reason = 'no-active-root-reaches-failed-package';
  return output;
}

function formatSummary(output) {
  const id = output.identity;
  const prefix = `${id.source}/${id.branch}@${id.sourceCommit.slice(0, 12)} target=${id.target.system || '-'}:${id.target.subtarget || '-'}:${id.target.profile || '-'}`;
  if (output.result === 'fail') {
    const paths = output.checks.flatMap((check) => check.paths.map((path) => `${check.target}: ${path.join(' -> ')}`));
    return `FAIL: upstream build closure reaches a Catalog failure package (${prefix})\n${paths.join('\n')}`;
  }
  if (output.result === 'inconclusive') {
    const detail = output.unresolved?.length ? output.unresolved :
      output.applicable.unresolved?.length ? output.applicable.unresolved :
      output.activeGraphUnresolved?.length ? output.activeGraphUnresolved :
      output.checks.flatMap((check) => check.unresolved || []);
    return `INCONCLUSIVE: upstream package closure cannot be proven safe (${prefix})\n${JSON.stringify(detail)}`;
  }
  return `PASS: no applicable Catalog failure package is reachable from active package roots (${prefix})`;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const upstreamDir = resolve(text(args['upstream-dir']) || 'openwrt');
  const configPath = resolve(text(args.config) || join(upstreamDir, '.config'));
  if (!existsSync(upstreamDir)) fail(`Upstream directory does not exist: ${upstreamDir}`);
  if (!existsSync(configPath)) fail(`Final upstream .config does not exist: ${configPath}`);
  const request = requestFromArgs(args);
  const identity = validateIdentity(request, args);
  if (!request) identity.repository = configuredCatalogRepository(args);
  const actualCommit = upstreamCommit(upstreamDir, args, identity);
  identity.sourceCommit = actualCommit;
  const { document, contract, provider } = await loadCompatibility(identity, args);
  const { values, active } = activePackages(configPath);
  const catalog = { provider, ...(contract || {}), repository: identity.repository, revision: identity.revision };
  let graph;
  try {
    graph = loadPackageGraph(upstreamDir, args);
  } catch (error) {
    const metadataPath = text(args['package-info']) || join(upstreamDir, 'tmp', '.packageinfo');
    const output = {
      schema: 1,
      result: 'inconclusive',
      reason: 'upstream-package-metadata-unavailable',
      identity,
      catalog,
      applicable: {
        packages: [], rules: [], skipped: [],
        unresolved: [{ reason: 'upstream-package-metadata-unavailable', message: error.message }],
      },
      metadata: { path: metadataPath, exists: existsSync(metadataPath), blocks: 0 },
      availablePackageCount: 0,
      activeRoots: [...active.keys()].sort(),
      checks: [],
    };
    const outPath = text(args.out || process.env.BUILD_CLOSURE_OUT);
    if (outPath) writeFileSync(resolve(outPath), JSON.stringify(output, null, 2) + '\n', 'utf8');
    console.log(formatSummary(output));
    process.exitCode = 2;
    return output;
  }
  const output = verifyBuildClosure({ document, identity, graph, active, configValues: values });
  output.catalog = catalog;
  const outPath = text(args.out || process.env.BUILD_CLOSURE_OUT);
  if (outPath) writeFileSync(resolve(outPath), JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(formatSummary(output));
  if (output.result === 'fail') process.exitCode = 1;
  else if (output.result === 'inconclusive') process.exitCode = 2;
  return output;
}

export {
  activePackages,
  cleanDependencyToken,
  dependencyGroups,
  loadPackageGraph,
  parsePackageInfo,
  parseMakefiles,
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1]).replaceAll('\\', '/')).href) {
  main().catch((error) => {
    console.error(`Build closure verification stopped: ${error.message}`);
    process.exitCode = Number.isInteger(error.exitCode) ? error.exitCode : 2;
  });
}
