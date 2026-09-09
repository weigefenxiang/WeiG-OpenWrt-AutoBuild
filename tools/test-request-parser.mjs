#!/usr/bin/env node
// Exercise the real Worker CLI, including the index -> asset -> baseline path.
// Optional request URLs or local JSON paths are diagnostics, never part of offline CI.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { REQUIRED_KCONFIG_RELATION_CAPABILITIES } from '../site/wrt/lib/catalog-engine.js';
import { parseConfigMap } from '../site/wrt/lib/profile-baseline.js';
import { classifyActivePackages } from './verify-build-closure.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const temp = mkdtempSync(join(tmpdir(), 'weig-request-parser-'));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const commit = 'a'.repeat(40), revision = 'b'.repeat(40);
const site = JSON.parse(readFileSync(join(root, 'site/wrt/config/site.json'), 'utf8'));
const repository = site.catalogRepository || site.catalog.repository;
const fields = ['symbolId', 'flags', 'typeCode', 'originCode', 'statesMask', 'choiceId', 'defaultsId',
  'dependsVariantsId', 'selectsVariantsId', 'impliesVariantsId', 'packageDependenciesId',
  'providesId', 'conflictsId', 'packageConflictsId', 'kconfigConflictsId', 'typedDefaultsId', 'rangesId',
  'promptIfId', 'promptConditionsId', 'visibleIfId', 'menuVisibleIfId', 'directDependsId',
  'inheritedDependsId', 'directVisibleIfId', 'inheritedVisibleIfId', 'inheritedMenuVisibleIfId',
  'optionFlagsId', 'optionsId', 'definitionsId', 'capabilityRelationsId'];
const names = ['FEATURE', 'PACKAGE_luci-theme-fixture'];
const source = { id: 'ImmortalWrt', repo: 'example/upstream', branch: 'fixture-branch', commit };
const baselineValues = new Map([
  ['FEATURE', 'y'], ['PACKAGE_luci-theme-fixture', 'y'],
  ['TARGET_BOARD', '"board"'], ['TARGET_SUBTARGET', '"sub"'], ['TARGET_PROFILE', '"DEVICE_fixture"'],
  ['TARGET_board', 'y'], ['TARGET_board_sub', 'y'], ['TARGET_board_sub_DEVICE_fixture', 'y'],
]);
const nativeHash = hash([...baselineValues].sort(([a], [b]) => a.localeCompare(b))
  .map(([symbol, value]) => `CONFIG_${symbol}=${value}`).join('\n') + '\n');
const baseline = {
  schema: 3, kind: 'profile-baselines', encoding: 'branch-common-plus-exact-config-groups-v1', source,
  profileFields: ['target', 'board', 'subtarget', 'profile', 'name', 'boardSelector', 'selector',
    'targetSelector', 'nativeHash', 'symbolCount', 'groupId'],
  stateGroups: ['n', 'm', 'y', 'otherIndexValue'],
  identity: { mode: 'catalog-target-tree-v1', fixed: ['TARGET_BOARD', 'TARGET_SUBTARGET', 'TARGET_PROFILE'],
    targetOverrides: [], aliases: [], overrides: [] },
  symbols: names, common: [[], [], [0, 1], []], groups: [[[], [], [], []]],
  profiles: [['board/sub', 'board', 'sub', 'DEVICE_fixture', 'Fixture', 'TARGET_board',
    'TARGET_board_sub_DEVICE_fixture', 'TARGET_board_sub', nativeHash, 8, 0]],
  metrics: { reconstructionMismatches: 0 },
};
const relations = {
  schema: 4, fields, strings: [...names, 'PACKAGE_luci-theme-fixture_FEATURE'],
  types: ['', 'bool'], origins: ['', 'kconfig-only', 'kconfig+packageinfo'],
  records: [...names, 'PACKAGE_luci-theme-fixture_FEATURE'].map((name, symbolId) => fields.map(field => ({
    symbolId, flags: symbolId === 1 ? 24 : 8, typeCode: 1,
    originCode: symbolId === 1 ? 2 : 1, statesMask: 5 })[field] ?? -1)),
  definitions: [], edges: [], indexes: {}, relationsComplete: true,
  relationCapabilities: [...REQUIRED_KCONFIG_RELATION_CAPABILITIES],
};
const graph = { schema: 6, kind: 'graph', source, relations,
  relationsComplete: true, relationCapabilities: relations.relationCapabilities };
const request = {
  schema: 6, sourceEnv: 'dev', requestCommit: 'c'.repeat(40), requestId: '260101_0001',
  device: 'catalog-target', source: source.id, version: 'fixture', branch: source.branch, variant: 'DEVICE_fixture',
  configId: 'catalog-target/ImmortalWrt/fixture/DEVICE_fixture',
  customTarget: { system: 'board', subtarget: 'sub', profileSymbol: 'DEVICE_fixture',
    profileSelector: 'TARGET_board_sub_DEVICE_fixture' },
  catalog: { repository, revision, sourceRepository: source.repo, sourceCommit: commit },
  overrides: [['FEATURE', 'n']], plugins: [], firmware: { theme: 'luci-theme-fixture' },
};
let serial = 0;
function runRequest(req, { fixtures, expectedError } = {}) {
  const cwd = join(temp, String(++serial)); mkdirSync(cwd);
  const input = join(cwd, 'request.json'); writeFileSync(input, JSON.stringify(req));
  const args = [];
  if (fixtures) {
    const dataFile = join(cwd, 'fixtures.json'); writeFileSync(dataFile, JSON.stringify(fixtures));
    const preload = join(cwd, 'fetch.mjs');
    writeFileSync(preload, `import{readFileSync}from'node:fs';
const files=JSON.parse(readFileSync(${JSON.stringify(dataFile)},'utf8'));
globalThis.fetch=async(url)=>{const path=new URL(url).pathname.split('/').at(-1);
if(!Object.hasOwn(files,path))throw Error('Unexpected asset: '+path);
return new Response(Buffer.from(files[path],'base64'));};`);
    args.push('--import', pathToFileURL(preload).href);
  }
  args.push(join(root, 'tools/parse-request.mjs'));
  const output = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 180000,
    windowsHide: true, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, REQUEST_MANIFEST: '', REQUEST_FILE: input, ISSUE_TITLE: '', ISSUE_NUMBER: '1',
      EXPECTED_REQUEST_BRANCH: req.sourceEnv, EXPECTED_REQUEST_COMMIT: req.requestCommit,
      PROFILE_BASELINE_CONFIG_OUT: join(cwd, 'baseline.config'), RECONSTRUCTED_CONFIG_OUT: join(cwd, 'result.config'),
      REQUEST_OVERRIDES_OUT: join(cwd, 'overrides.json'), REQUEST_AUDIT_OUT: join(cwd, 'audit.json'),
      CATALOG_SYMBOL_KINDS_OUT: join(cwd, 'symbol-kinds.json'),
      GITHUB_OUTPUT: join(cwd, 'outputs.txt') } });
  if (expectedError) {
    assert.notEqual(output.status, 0); assert.match(output.stderr, expectedError); return;
  }
  assert.equal(output.status, 0, output.stderr || output.error?.message);
  const kinds = JSON.parse(readFileSync(join(cwd, 'symbol-kinds.json'), 'utf8'));
  assert.equal(kinds.revision, req.catalog.revision);
  assert.equal(kinds.sourceCommit, req.catalog.sourceCommit);
  assert.match(kinds.graphHash, /^[a-f0-9]{64}$/);
  if (fixtures) {
    assert.deepEqual(kinds.nonPackageSymbols, ['PACKAGE_luci-theme-fixture_FEATURE']);
    assert.deepEqual([...classifyActivePackages(new Map([['luci-theme-fixture', 'y'],
      ['luci-theme-fixture_FEATURE', 'y'], ['unknown', 'y']]), kinds, req.catalog)],
    [['luci-theme-fixture', 'y'], ['unknown', 'y']],
    'the real Worker receipt must retain concrete packages and exclude only proven configuration options');
  }
  const expected = parseConfigMap(readFileSync(join(cwd, 'baseline.config'), 'utf8'));
  for (const [symbol, value] of req.overrides) expected.set(symbol, value);
  const actual = parseConfigMap(readFileSync(join(cwd, 'result.config'), 'utf8'));
  assert.deepEqual([...actual].sort(), [...expected].sort(), 'reconstruction must equal exact baseline plus overrides');
  const effective = spawnSync(process.execPath, [join(root, 'tools/verify-effective-config.mjs'),
    '--overrides', join(cwd, 'overrides.json'), '--config', join(cwd, 'result.config'), '--out', join(cwd, 'verification.json')],
  { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(effective.status, 0, effective.stderr);
  console.log(JSON.stringify({ request: serial, source: req.source, branch: req.branch,
    overrides: req.overrides.length, reconstructedSymbols: actual.size, result: 'pass' }));
}
function fixturesFor({ compact = false, declareSchema = false, mutate = () => {} } = {}) {
  const fixtures = {};
  const asset = (name, data) => {
    const json = JSON.stringify(data), bytes = gzipSync(json);
    fixtures[name] = bytes.toString('base64');
    return { asset: name, hash: hash(bytes), bytes: bytes.length, sha256: hash(json), jsonBytes: Buffer.byteLength(json) };
  };
  const graphData = structuredClone(graph);
  if (compact) graphData.relations = { ...graphData.relations, schema: 5,
    encoding: 'interned-definitions-edge-rows-v1', edgeFields: [], edges: [],
    definitions: { schema: 5, encoding: 'interned-relations-v1', shapes: [['schema', 'definitions']],
      nodes: [[-1, 4], [-2], [0, 0, 1]], root: 2 } };
  const logical = compact ? 'graphCompact' : 'graph';
  const contract = asset(compact ? 'fixture.graph.compact.json.gz' : 'fixture.graph.json.gz', graphData);
  if (declareSchema) contract.relationsSchema = compact ? 5 : 4;
  const assets = { [logical]: contract, profileBaselines: { ...asset('fixture.profiles.json.gz', baseline),
    schema: 3, encoding: baseline.encoding, profiles: 1, configGroups: 1 } };
  if (compact) assets.graph = asset('fixture.graph.json.gz', graph);
  const index = { schema: 2, sources: [{ ...source, build: { diy1: 'diy-fixture.sh', diy2: 'diy2-fixture.sh' },
    branches: [{ id: 'fixture', branch: source.branch, commit, assets }] }] };
  mutate({ index, assets, graphData, asset, contract, logical });
  fixtures['index.json'] = Buffer.from(JSON.stringify(index)).toString('base64');
  return fixtures;
}
try {
  const urls = process.argv.slice(2);
  if (urls.length) {
    for (const input of urls) {
      if (!/^https:\/\//.test(input)) {
        runRequest(JSON.parse(readFileSync(input, 'utf8')));
        continue;
      }
      const response = await fetch(input, { signal: AbortSignal.timeout(30000) });
      assert(response.ok, `request HTTP ${response.status}`);
      runRequest(await response.json());
    }
  } else {
    for (const compact of [false, true]) for (const declareSchema of [false, true]) {
      runRequest(request, { fixtures: fixturesFor({ compact, declareSchema }) });
    }
    runRequest(request, { fixtures: fixturesFor({ compact: true, mutate: ({ contract }) => {
      contract.hash = contract.hash.toUpperCase(); contract.sha256 = contract.sha256.toUpperCase();
    } }) });
    for (const [label, mutate, expectedError] of [
      ['schema', ({ contract }) => { contract.relationsSchema = 4; }, /schema/],
      ['digest', ({ contract }) => { contract.hash = '0'.repeat(64); }, /SHA-256/],
      ['bytes', ({ contract }) => { contract.bytes++; }, /byte count/],
      ['JSON digest', ({ contract }) => { contract.sha256 = '0'.repeat(64); }, /JSON SHA-256/],
      ['JSON bytes', ({ contract }) => { contract.jsonBytes++; }, /JSON byte count/],
      ['incomplete', ({ graphData, asset, assets, logical, contract }) => {
        graphData.relations.relationsComplete = false; assets[logical] = asset(contract.asset, graphData);
      }, /complete typed/],
      ['wrapper capabilities', ({ graphData, asset, assets, logical, contract }) => {
        graphData.relationCapabilities = []; assets[logical] = asset(contract.asset, graphData);
      }, /complete typed/],
      ['fields', ({ graphData, asset, assets, logical, contract }) => {
        graphData.relations.fields.reverse(); assets[logical] = asset(contract.asset, graphData);
      }, /fields contract/],
      ['source', ({ graphData, asset, assets, logical, contract }) => {
        graphData.source.commit = 'd'.repeat(40); assets[logical] = asset(contract.asset, graphData);
      }, /commit mismatch/],
      ['corrupt table', ({ graphData, asset, assets, logical, contract }) => {
        graphData.relations.definitions.root = -1; assets[logical] = asset(contract.asset, graphData);
      }, /Invalid relation root/],
      ['null advertised', ({ assets }) => { assets.graphCompact = null; }, /asset contract/],
    ]) {
      runRequest(request, { fixtures: fixturesFor({ compact: true, mutate }), expectedError });
      console.log(`Rejected ${label}; no fallback to legacy graph`);
    }
  }
} finally {
  assert(resolve(temp).startsWith(resolve(tmpdir()) + sep));
  rmSync(temp, { recursive: true, force: true });
}
