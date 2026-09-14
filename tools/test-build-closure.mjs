import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCompatibilityDocument, createCatalogModel, evaluateCompatibilityRules } from '../site/wrt/lib/catalog-engine.js';
import {
  activePackages,
  bindConditionContext,
  classifyActivePackages,
  loadPackageGraph,
  parsePackageInfo,
  verifyBuildClosure,
} from './verify-build-closure.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function identity() {
  return {
    repository: 'example/catalog',
    revision: '1'.repeat(40),
    sourceCommit: '2'.repeat(40),
    source: 'Example',
    branch: 'main',
    target: { system: 'x86', subtarget: '64', profile: 'DEVICE_generic' },
  };
}

function ruleDocument({ packageName = 'failed', triggerPackages } = {}) {
  return {
    schema: 5,
    rules: [{
      id: 'BLD-TEST', issue: 'build-failure', match: 'all-selected',
      policy: 'preventive', environments: [{ source: '*', branch: '*', packageAvailability: 'if-present', targetScope: {} }],
      packages: [packageName],
      buildDependency: { package: packageName, ...(triggerPackages ? { triggerPackages } : {}) },
      evidence: [{ source: 'Example', branch: 'main', sourceCommit: '2'.repeat(40), refs: ['test:1'] }],
      failure: { phase: 'package-compile', cause: 'package-caused', code: 'test-failure' },
    }],
  };
}

const kinds = { schema: 1, revision: identity().revision, sourceCommit: identity().sourceCommit,
  graphHash: 'a'.repeat(64), nonPackageSymbols: ['PACKAGE_root_FEATURE'] };
const prefixed = new Map([['root', 'y'], ['root_FEATURE', 'y'], ['unknown', 'm']]);
const conditionKinds = { ...kinds, conditionContext: { schema: 1,
  symbolTypes: [['FEATURE', 'bool'], ['BACKEND', 'tristate'], ['LIMIT', 'int'], ['LABEL', 'string']],
  undefinedSymbols: [] } };
const conditionValues = bindConditionContext(new Map(), conditionKinds, identity());
assert.equal(conditionValues.size, 0, 'closed-world condition evidence must not modify config assignments');
for (const bad of [undefined, { schema: 2 }, { schema: 1, symbolTypes: [['FEATURE', 'bad']], undefinedSymbols: [] }]) {
  assert.throws(() => bindConditionContext(new Map(), { ...kinds, conditionContext: bad }, identity()),
    /condition evidence/);
}
assert.deepEqual([...classifyActivePackages(prefixed, kinds, identity())], [['root', 'y'], ['unknown', 'm']],
  'only metadata-proven configuration options are excluded; unknown package roots remain auditable');
assert.equal(prefixed.size, 3, 'classification must not mutate the authoritative config projection');
assert.equal(classifyActivePackages(prefixed, kinds, identity(), new Map([['root_FEATURE', {}]])).size, 3,
  'refreshed native metadata must retain any actual package even if the Catalog calls it config-only');
for (const change of [{ revision: '3'.repeat(40) }, { sourceCommit: '4'.repeat(40) },
  { graphHash: '' }, { nonPackageSymbols: ['CONFIG_PACKAGE_root'] }, { schema: 2 }]) {
  assert.throws(() => classifyActivePackages(prefixed, { ...kinds, ...change }, identity()),
    /does not match the exact verified snapshot/);
}

function writeFixture(packageBlocks, configPackages) {
  const directory = mkdtempSync(join(ROOT, '.tmp-build-closure-'));
  mkdirSync(join(directory, 'tmp'), { recursive: true });
  const metadata = packageBlocks.map((block) => [
    `Source-Makefile: package/${block.name}/Makefile`,
    `Package: ${block.name}`,
    `Depends: ${block.depends || ''}`,
    `Provides: ${block.provides || ''}`,
    '',
  ].join('\n')).join('\n');
  writeFileSync(join(directory, 'tmp', '.packageinfo'), metadata);
  writeFileSync(join(directory, '.config'), configPackages.map((name) => {
    if (String(name).startsWith('!CONFIG_')) return `# ${String(name).slice(1)} is not set`;
    if (String(name).startsWith('CONFIG_')) return `${name}=y`;
    const disabled = String(name).startsWith('!');
    const packageName = disabled ? String(name).slice(1) : name;
    return disabled ? `# CONFIG_PACKAGE_${packageName} is not set` : `CONFIG_PACKAGE_${packageName}=y`;
  }).join('\n') + '\n');
  return directory;
}

function runFixture(packageBlocks, configPackages, document = ruleDocument()) {
  const directory = writeFixture(packageBlocks, configPackages);
  try {
    const config = activePackages(join(directory, '.config'));
    const graph = loadPackageGraph(directory, {});
    return verifyBuildClosure({ document, identity: identity(), graph, active: config.active, configValues: config.values });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

let result = runFixture([
  { name: 'root', depends: '+middle' },
  { name: 'middle', depends: '+failed' },
  { name: 'failed' },
], ['root']);
assert.equal(result.result, 'fail', 'real dependency chain must fail closed');
assert.deepEqual(result.checks[0].paths, [['root', 'middle', 'failed']], 'full upstream path must be reported');

result = runFixture([{ name: 'root' }, { name: 'failed' }], ['root']);
assert.equal(result.result, 'pass', 'unrelated active package must not trigger a rule');

result = runFixture([
  { name: 'root', depends: '+virtual-api' },
  { name: 'provider', provides: '@virtual-api' },
  { name: 'failed', provides: '@virtual-api' },
], ['root', 'failed']);
assert.equal(result.result, 'fail', 'active virtual provider must resolve to the failed concrete package');
assert.deepEqual(result.checks[0].paths, [['root', 'failed'], ['failed']], 'virtual provider path must use concrete package identity');

result = runFixture([
  { name: 'root', depends: '+virtual-api' },
  { name: 'provider', provides: '@virtual-api' },
  { name: 'failed', provides: '@virtual-api' },
], ['root', 'provider']);
assert.equal(result.result, 'pass', 'another active virtual provider must avoid a false failure');

result = runFixture([
  { name: 'root', depends: '+failed|+safe' },
  { name: 'failed' },
  { name: 'safe' },
], ['root', 'safe']);
assert.equal(result.result, 'pass', 'an active OR alternative must be honored');

result = runFixture([
  { name: 'root', depends: '+failed|+safe' },
  { name: 'failed' },
  { name: 'safe' },
], ['root']);
assert.equal(result.result, 'inconclusive', 'unselected OR alternatives cannot prove a build path');

result = runFixture([
  { name: 'one', depends: '+shared' },
  { name: 'two', depends: '+shared' },
  { name: 'shared', depends: '+failed' },
  { name: 'failed' },
], ['one', 'two']);
assert.equal(result.result, 'fail', 'shared dependency closure must be checked for every active root');
assert.equal(result.checks[0].paths.length, 2, 'both shared-dependency roots must be reported');

result = runFixture([
  { name: 'legacy-trigger' },
  { name: 'failed' },
], ['legacy-trigger'], ruleDocument({ triggerPackages: ['legacy-trigger'] }));
assert.equal(result.result, 'pass', 'legacy triggerPackages must not drive the closure');

const outOfScope = ruleDocument();
outOfScope.rules[0].sourceCommits = ['3'.repeat(40)];
result = runFixture([{ name: 'root' }, { name: 'failed' }], ['root'], outOfScope);
assert.equal(result.result, 'pass', 'a valid rule scoped to another exact source commit is not applicable');
assert.equal(result.applicable.skipped[0]?.reason, 'source-commit-out-of-scope',
  'out-of-scope source commit must be reported as skipped, not unresolved');

result = runFixture([
  { name: 'root', depends: '+PACKAGE_gate-package:failed' },
  { name: 'failed' },
  { name: 'gate-package' },
], ['root', 'gate-package']);
assert.equal(result.result, 'fail', 'a true package selector condition must enable its dependency edge');

result = runFixture([
  { name: 'root', depends: '@TARGET_x86:failed' },
  { name: 'failed' },
], ['root', '!CONFIG_TARGET_x86']);
assert.equal(result.result, 'pass', 'a false target selector must not become a required package edge');

result = runFixture([
  { name: 'root', depends: '+UNKNOWN_SELECTOR:failed' },
  { name: 'failed' },
], ['root']);
assert.equal(result.result, 'inconclusive', 'an unknown package selector condition must fail closed');

result = runFixture([
  { name: 'root', depends: '+failed||+safe' },
  { name: 'failed' },
  { name: 'safe' },
], ['root', 'safe']);
assert.equal(result.result, 'pass', 'OpenWrt || alternatives must remain one selectable dependency group');

result = runFixture([
  { name: 'root', depends: '+failed||+missing' },
  { name: 'failed' },
], ['root']);
assert.equal(result.result, 'inconclusive', 'an unknown alternative must not be silently discarded');

const malformedRule = ruleDocument();
malformedRule.rules[0].environments = null;
result = runFixture([{ name: 'root' }, { name: 'failed' }], ['root'], malformedRule);
assert.equal(result.result, 'inconclusive', 'malformed rule scope must fail closed');

const missingDirectory = mkdtempSync(join(ROOT, '.tmp-build-closure-missing-'));
try {
  mkdirSync(join(missingDirectory, 'tmp'), { recursive: true });
  writeFileSync(join(missingDirectory, '.config'), 'CONFIG_PACKAGE_root=y\n');
  assert.throws(() => loadPackageGraph(missingDirectory, {}), /metadata is missing or empty/,
    'missing upstream metadata must be inconclusive/fail closed');
} finally {
  rmSync(missingDirectory, { recursive: true, force: true });
}

const makefileDirectory = mkdtempSync(join(ROOT, '.tmp-build-closure-makefile-'));
try {
  mkdirSync(join(makefileDirectory, 'package', 'root'), { recursive: true });
  mkdirSync(join(makefileDirectory, 'package', 'middle'), { recursive: true });
  mkdirSync(join(makefileDirectory, 'package', 'failed'), { recursive: true });
  mkdirSync(join(makefileDirectory, 'package', 'optional'), { recursive: true });
  writeFileSync(join(makefileDirectory, 'package', 'root', 'Makefile'), [
    'define Package/root',
    '  DEPENDS:=+middle ' + '\\',
    '    +optional (>= 1.0)',
    'endef',
    '',
  ].join('\n'));
  writeFileSync(join(makefileDirectory, 'package', 'middle', 'Makefile'), [
    'define Package/middle',
    '  DEPENDS:=+failed',
    'endef',
    '',
  ].join('\n'));
  writeFileSync(join(makefileDirectory, 'package', 'failed', 'Makefile'), 'define Package/failed\nendef\n');
  writeFileSync(join(makefileDirectory, 'package', 'optional', 'Makefile'), 'define Package/optional\nendef\n');
  writeFileSync(join(makefileDirectory, '.config'), 'CONFIG_PACKAGE_root=y\n');
  assert.throws(() => loadPackageGraph(makefileDirectory, {}), /metadata is missing/,
    'raw Makefile templates cannot substitute for native expanded package metadata');
  mkdirSync(join(makefileDirectory, 'tmp'));
  writeFileSync(join(makefileDirectory, 'tmp', '.packageinfo'), 'Package: root\nDepends:\n');
  const makefileGraph = loadPackageGraph(makefileDirectory, {});
  assert.deepEqual([...makefileGraph.packages.keys()], ['root'],
    'unexpanded Makefile packages must not contaminate authoritative metadata');
} finally {
  rmSync(makefileDirectory, { recursive: true, force: true });
}

const packageInfoDirectory = mkdtempSync(join(ROOT, '.tmp-build-closure-packageinfo-'));
try {
  mkdirSync(join(packageInfoDirectory, 'tmp'), { recursive: true });
  writeFileSync(join(packageInfoDirectory, 'tmp', '.packageinfo'), [
    'Source-Makefile: package/root/Makefile',
    'Build-Depends: shared/host',
    'Build-Depends/host: unresolved-host-tool',
    'Build-Types: host',
    'Package: root',
    'Depends: +failed',
    'Provides: ',
    'Description: root',
    'Package: description-is-not-a-package',
    '@@',
    'Config:',
    'Package: config-is-not-a-package',
    'Depends: $(unexpanded-config-text)',
    '@@',
    'Package: root-dev',
    'Depends: ',
    'Provides: @root-development',
    'Description: root development files',
    '@@',
    'Source-Makefile: package/shared/Makefile',
    'Package: shared',
    'Depends: ',
    'Description: shared',
    '@@',
    '',
  ].join('\n'));
  const parsedPackageInfo = parsePackageInfo(join(packageInfoDirectory, 'tmp', '.packageinfo'));
  assert.equal(parsedPackageInfo.blocks, 3, 'OpenWrt @@ package metadata markers must delimit every package record');
  assert(parsedPackageInfo.packages.has('root-dev'), 'every package record in one Makefile must be retained');
  assert(parsedPackageInfo.packages.get('root')?.sourceNames.has('root'),
    'Source-Makefile identity must be retained for package records');
  assert.deepEqual(parsedPackageInfo.packages.get('root')?.depends, [['failed']],
    'host-only Build-Depends must not become a target package edge');
  assert.deepEqual(parsedPackageInfo.packages.get('root-dev')?.depends, [],
    'source host metadata must not leak into any binary variant');
  assert.equal(parsedPackageInfo.packages.get('root-dev').buildFields['Build-Depends/host'], 'unresolved-host-tool');
  assert.equal(parsedPackageInfo.packages.get('root').dependencyErrors.length, 0);
} finally {
  rmSync(packageInfoDirectory, { recursive: true, force: true });
}

const buildDependsDirectory = mkdtempSync(join(ROOT, '.tmp-build-closure-build-depends-'));
try {
  mkdirSync(join(buildDependsDirectory, 'tmp'), { recursive: true });
  writeFileSync(join(buildDependsDirectory, 'tmp', '.packageinfo'), [
    'Source-Makefile: package/root/Makefile',
    'Build-Depends: failed-source',
    'Package: root',
    'Depends: ',
    '@@',
    'Source-Makefile: package/failed-source/Makefile',
    'Package: failed',
    'Depends: ',
    '@@',
    '',
  ].join('\n'));
  writeFileSync(join(buildDependsDirectory, '.config'), 'CONFIG_PACKAGE_root=y\n');
  const buildDependsConfig = activePackages(join(buildDependsDirectory, '.config'));
  const buildDependsGraph = loadPackageGraph(buildDependsDirectory, {});
  result = verifyBuildClosure({
    document: ruleDocument(), identity: identity(), graph: buildDependsGraph,
    active: buildDependsConfig.active, configValues: buildDependsConfig.values,
  });
  assert.equal(result.result, 'fail', 'real target Build-Depends source edges must be part of the closure');
} finally {
  rmSync(buildDependsDirectory, { recursive: true, force: true });
}

const streamDirectory = mkdtempSync(join(ROOT, '.tmp-build-closure-stream-'));
try {
  mkdirSync(join(streamDirectory, 'tmp'));
  const metadataPath = join(streamDirectory, 'tmp', '.packageinfo');
  writeFileSync(metadataPath, [
    'Source-Makefile: package/consumer/Makefile',
    'Build-Depends: helper', 'Build-Depends/host: host-tool',
    'Package: first', 'Depends:', 'Description: first', '@@',
    'Package: second', 'Depends:', 'Description: second', '@@',
    'Source-Makefile: package/old-provider/Makefile',
    'Package: provider', 'Depends: +failed', 'Provides: @old-api',
    'Source-Makefile: package/new-provider/Makefile',
    'Package: provider', 'Depends: +helper', 'Provides: @new-api',
    'Source-Makefile: package/helper/Makefile', 'Package: helper', 'Depends:',
    'Source-Makefile: package/unused/Makefile', 'Package: unused', 'Depends: $(unresolved)',
    'Source-Makefile: package/failed/Makefile', 'Package: failed', 'Depends:',
    'Source-Makefile: package/firmware/Makefile', 'Package: firmware/device', 'Build-Only: 1',
    'Source-Makefile: package/api/Makefile', 'Package: api', 'Provides: @versioned-api=1.2',
  ].join('\n'));
  const graph = loadPackageGraph(streamDirectory, {});
  assert.deepEqual(graph.packages.get('first').depends, [['helper']]);
  assert.deepEqual(graph.packages.get('second').depends, [['helper']],
    'source build dependencies apply to all binary variants, not just the first block');
  assert.deepEqual(graph.packages.get('provider').depends, [['helper']],
    'last native package definition replaces obsolete dependency edges');
  assert.deepEqual([...graph.packages.get('provider').sourceNames], ['new-provider']);
  assert.deepEqual([...graph.packages.get('provider').provides], ['new-api', 'old-api'],
    'native provider registration remains cumulative across definition replacement');
  assert.match(graph.metadata.sha256, /^[a-f0-9]{64}$/);
  assert(graph.packages.has('firmware/device'), 'native build-only identities are not Kconfig package symbols');
  assert(graph.packages.get('api').provides.has('versioned-api=1.2'),
    'native capability registrations must not be rewritten as dependency version constraints');
  const check = (names) => verifyBuildClosure({ document: ruleDocument(), identity: identity(),
    graph, active: new Map(names.map((name) => [name, 'y'])), configValues: new Map() });
  assert.equal(check(['second', 'provider']).result, 'pass',
    'an unselected malformed dependency must not poison unrelated selected roots');
  const unknown = check(['unused']);
  assert.equal(unknown.result, 'inconclusive');
  assert.deepEqual(unknown.activeGraphUnresolved[0].path, ['unused']);
  graph.packages.get('helper').depends = [['unused']];
  assert.equal(check(['second']).result, 'inconclusive',
    'malformed metadata reached indirectly must still fail closed');
  assert.equal(check(['failed']).result, 'fail', 'real failure targets must remain protected');
} finally {
  rmSync(streamDirectory, { recursive: true, force: true });
}

const missingIdentityDirectory = mkdtempSync(join(ROOT, '.tmp-build-closure-identity-'));
try {
  mkdirSync(join(missingIdentityDirectory, 'tmp'), { recursive: true });
  writeFileSync(join(missingIdentityDirectory, '.config'), 'CONFIG_PACKAGE_root=y\n');
  const requestPath = join(missingIdentityDirectory, 'request.json');
  writeFileSync(requestPath, JSON.stringify({
    schema: 6,
    source: 'Example', version: 'main', branch: 'main',
    catalog: {
      repository: 'example/catalog', revision: '1'.repeat(40), sourceCommit: '2'.repeat(40),
    },
    customTarget: {},
  }));
  const identityCheck = spawnSync(process.execPath, [
    join(ROOT, 'tools', 'verify-build-closure.mjs'), '--request', requestPath,
    '--upstream-dir', missingIdentityDirectory, '--config', join(missingIdentityDirectory, '.config'),
    '--upstream-commit', '2'.repeat(40), '--compatibility', requestPath,
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.notEqual(identityCheck.status, 0, 'missing Target identity must fail closed');
  assert.match(`${identityCheck.stdout}\n${identityCheck.stderr}`, /customTarget identity is incomplete/,
    'missing Target identity failure must be explicit');
} finally {
  rmSync(missingIdentityDirectory, { recursive: true, force: true });
}

const missingMetadataDirectory = mkdtempSync(join(ROOT, '.tmp-build-closure-no-metadata-'));
try {
  mkdirSync(join(missingMetadataDirectory, 'tmp'), { recursive: true });
  writeFileSync(join(missingMetadataDirectory, '.config'), 'CONFIG_PACKAGE_root=y\n');
  const requestPath = join(missingMetadataDirectory, 'request.json');
  const compatibilityPath = join(missingMetadataDirectory, 'compatibility.json');
  const outputPath = join(missingMetadataDirectory, 'closure.json');
  writeFileSync(requestPath, JSON.stringify({
    schema: 6,
    source: 'Example', version: 'main', branch: 'main',
    catalog: {
      repository: 'example/catalog', revision: '1'.repeat(40), sourceCommit: '2'.repeat(40),
    },
    customTarget: {
      profileSelector: 'generic', profileSymbol: 'DEVICE_generic', subtarget: '64', system: 'x86',
    },
  }));
  writeFileSync(compatibilityPath, JSON.stringify(ruleDocument()));
  const metadataCheck = spawnSync(process.execPath, [
    join(ROOT, 'tools', 'verify-build-closure.mjs'), '--request', requestPath,
    '--upstream-dir', missingMetadataDirectory, '--config', join(missingMetadataDirectory, '.config'),
    '--source-commit', '2'.repeat(40), '--upstream-commit', '2'.repeat(40),
    '--catalog-revision', '1'.repeat(40),
    '--compatibility', compatibilityPath, '--out', outputPath,
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(metadataCheck.status, 2, 'missing package metadata must stop the build inconclusively');
  const metadataOutput = JSON.parse(readFileSync(outputPath, 'utf8'));
  assert.equal(metadataOutput.result, 'inconclusive', 'missing package metadata must produce an inconclusive report');
  assert.equal(metadataOutput.reason, 'upstream-package-metadata-unavailable',
    'missing package metadata reason must be explicit');
} finally {
  rmSync(missingMetadataDirectory, { recursive: true, force: true });
}

const workflow = readFileSync(join(ROOT, '.github', 'workflows', 'custom-build.yml'), 'utf8');
const metadataStage = workflow.indexOf('Generate upstream package metadata');
const closureStage = workflow.indexOf('Verify upstream build dependency closure');
const downloadStage = workflow.indexOf('Download packages');
const compileStage = workflow.indexOf('Compile /');
const metadataBlock = workflow.slice(metadataStage, closureStage);
assert(metadataStage >= 0 && closureStage > metadataStage && downloadStage > closureStage && compileStage > downloadStage,
  'workflow must generate metadata and verify closure before download and compile');
assert(workflow.includes('make prepare-tmpinfo V=s'),
  'workflow must use the stable upstream metadata target');
assert(!metadataBlock.split(/\r?\n/).some((line) => line.trim().startsWith('make defconfig')) &&
  !metadataBlock.includes('make package/metadata'),
  'metadata stage must not invoke defconfig or a non-portable package/metadata target');
assert(workflow.includes('CONFIG_HASH_BEFORE') && workflow.includes('CONFIG_HASH_AFTER') &&
  workflow.includes('prepare-tmpinfo changed the authoritative .config'),
  'metadata generation must preserve the authoritative .config');
assert(workflow.includes("if: steps.req.outputs.use_defconfig != '1'") &&
  workflow.includes("if: steps.req.outputs.use_defconfig == '1'"),
  'defconfig-on and defconfig-off workflow paths must remain explicit');
assert(workflow.includes('build-closure-verification.json'), 'closure evidence must be uploaded');

// Frozen public Catalog fixture at 7938b3bf, not a runtime rule database.
const published = JSON.parse(readFileSync(join(ROOT, 'tools/fixtures/compatibility-7938b3bf.json'), 'utf8'));
normalizeCompatibilityDocument(published);
const ordinary = { ...published, rules: published.rules.filter(row=>!row.buildDependency) };
const packageNames = [...new Set(published.rules.flatMap(row=>row.packages))];
const ordinaryModel = createCatalogModel({ schema: 5, targets: [], relations: { schema: 2,
  records: packageNames.map(name=>({ kind:'package', package:name, configSymbol:`PACKAGE_${name}`,
    type:'tristate', states:['n','m','y'] })) } });
for (const sample of [
  { source:'ImmortalWrt', branch:'openwrt-25.12', selected:[], fail:false },
  { source:'ImmortalWrt', branch:'master', selected:[], fail:false },
  { source:'OpenWrt', branch:'main', selected:['oscam'], fail:false },
  { source:'ImmortalWrt', branch:'openwrt-25.12', selected:['luci-app-passwall'], fail:false },
  { source:'ImmortalWrt', branch:'openwrt-25.12', selected:['oscam'], fail:true },
  { source:'ImmortalWrt', branch:'master', selected:['luci-app-openvpn-server'], fail:true },
  { source:'lede', branch:'master', sourceCommit:'bb287c19dfb283c5106d568db68077c210b9abb7', selected:['luci-app-passwall'], fail:true },
]) {
  const directory = writeFixture(packageNames.map(name=>({name})), sample.selected);
  try {
    const config = activePackages(join(directory, '.config'));
    config.values.set('USE_APK', 'n');
    const currentIdentity = { ...identity(), ...sample };
    const worker = verifyBuildClosure({ document: published, identity:currentIdentity,
      graph:loadPackageGraph(directory, {}), active:config.active, configValues:config.values });
    const browser = evaluateCompatibilityRules(ordinaryModel, ordinary, config.values, {
      sourceId:sample.source, branchName:sample.branch, sourceCommit:currentIdentity.sourceCommit,
      validationOptions:{contextComplete:true} });
    assert.equal(worker.result, sample.fail ? 'fail' : 'pass', JSON.stringify(sample));
    assert.equal(browser.warnings.length > 0, sample.fail, 'ordinary Browser/Worker matching must agree');
  } finally { rmSync(directory, {recursive:true,force:true}); }
}
const damagedOrdinary = { schema:5, rules:[{...ordinary.rules.find(row=>row.issue==='build-failure'), match:'unsupported'}] };
assert.equal(runFixture([{name:'root'}], ['root'], damagedOrdinary).result, 'inconclusive',
  'invalid rules must still fail closed');
console.log('build closure verifier checks passed, including published ordinary/closure rule parity');

// Use the real metadata parser and shared evaluator, not a mock alternate graph.
const domainDirectory = mkdtempSync(join(ROOT, '.tmp-build-closure-domains-'));
try {
  mkdirSync(join(domainDirectory, 'tmp'));
  const metadata = [
    'Source-Makefile: package/root/Makefile', 'Build-Depends: helper-source',
    'Package: root', 'Depends: +FEATURE:failed +BACKEND:failed',
    'Source-Makefile: package/helper-source/Makefile',
    'Package: helper-library', 'Depends: ', 'Package: helper-tool', 'Depends: ',
    'Source-Makefile: package/failed/Makefile', 'Package: failed', 'Depends: ', '',
  ].join('\n');
  const path = join(domainDirectory, 'tmp', '.packageinfo');
  writeFileSync(path, metadata);
  if (process.env.NATIVE_PACKAGE_METADATA) {
    const native = spawnSync(process.env.PERL || 'perl', [process.env.NATIVE_PACKAGE_METADATA, 'mk', path],
      { encoding: 'utf8' });
    assert.equal(native.status, 0, native.stderr);
    const line = native.stdout.split(/\r?\n/).find(line => line.includes('/root/compile +='));
    assert(line?.includes('/helper-source/compile'), 'native generator confirms the source compile edge');
    assert(!line.includes('CONFIG_PACKAGE_helper-'), 'native build dependency is not an install-provider choice');
    console.log('native package-metadata.pl confirms unconditional multi-output source build');
  }
  const checkDomain = (graph, values = conditionValues) => verifyBuildClosure({
    document: ruleDocument(), identity: identity(), graph, active: new Map([['root', 'y']]), configValues: values });
  const graph = loadPackageGraph(domainDirectory, {});
  assert(!graph.providers.has('helper-source'), 'source owners must not be advertised as virtual providers');
  assert.equal(graph.sourceTargets.get('helper-source').size, 1);
  assert.equal(checkDomain(graph).result, 'pass', 'build a multi-output source without selecting any output for installation');
  const requestPath = join(domainDirectory, 'request.json');
  const configPath = join(domainDirectory, '.config');
  const compatibilityPath = join(domainDirectory, 'compatibility.json');
  const kindsPath = join(domainDirectory, 'kinds.json');
  const outputPath = join(domainDirectory, 'report.json');
  writeFileSync(requestPath, JSON.stringify({ schema: 6, source: 'Example', branch: 'main', version: 'main',
    catalog: { repository: identity().repository, revision: identity().revision, sourceCommit: identity().sourceCommit },
    customTarget: { system: 'x86', subtarget: '64', profileSymbol: 'DEVICE_generic', profileSelector: 'generic' } }));
  writeFileSync(configPath, 'CONFIG_PACKAGE_root=y\n');
  writeFileSync(compatibilityPath, JSON.stringify(ruleDocument()));
  writeFileSync(kindsPath, JSON.stringify(conditionKinds));
  const cli = spawnSync(process.execPath, [join(ROOT, 'tools/verify-build-closure.mjs'),
    '--request', requestPath, '--config', configPath, '--upstream-dir', domainDirectory,
    '--catalog-revision', identity().revision, '--source-commit', identity().sourceCommit,
    '--upstream-commit', identity().sourceCommit, '--compatibility', compatibilityPath,
    '--symbol-kinds', kindsPath, '--out', outputPath], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stdout + cli.stderr);
  assert.equal(JSON.parse(readFileSync(outputPath, 'utf8')).result, 'pass', 'complete real closure CLI consumes sparse type evidence');
  assert.equal(readFileSync(configPath, 'utf8'), 'CONFIG_PACKAGE_root=y\n', 'closure CLI never edits configuration');
  assert.equal(checkDomain(graph, new Map()).result, 'inconclusive', 'missing evidence must not silently close the symbol universe');
  assert.equal(checkDomain(graph, bindConditionContext(new Map([['FEATURE','y']]), conditionKinds, identity())).result,
    'fail', 'an enabled native condition retains failure reachability');
  assert.equal(checkDomain(graph, bindConditionContext(new Map([['BACKEND','m']]), conditionKinds, identity())).result,
    'fail', 'module-valued build selectors are enabled');
  const group = graph.packages.get('root').depends.find(row => row.condition === 'FEATURE');
  for (const [expression, expected] of [['!FEATURE','fail'], ['LIMIT > 2','inconclusive'],
    ['LABEL = "enabled"','inconclusive'], ['MISSING_FEATURE','inconclusive'], ['FEATURE & BAD','inconclusive']]) {
    Object.defineProperty(group, 'condition', { value: expression, configurable: true });
    assert.equal(checkDomain(graph).result, expected, expression);
  }
  Object.defineProperty(group, 'condition', { value: 'LIMIT > 2', configurable: true });
  assert.equal(checkDomain(graph, bindConditionContext(new Map([['LIMIT','3']]),conditionKinds,identity())).result, 'fail');
  writeFileSync(path, metadata.replace('Package: helper-tool\nDepends: ', 'Package: helper-tool\nDepends: +failed'));
  assert.equal(checkDomain(loadPackageGraph(domainDirectory, {})).result, 'fail',
    'native source compile accumulates output dependency lines; uninstalled siblings cannot hide a failed build target');
  writeFileSync(path, metadata.replace('Build-Depends: helper-source', 'Build-Depends: missing-source'));
  assert.equal(checkDomain(loadPackageGraph(domainDirectory, {})).result, 'inconclusive', 'unknown source is not dropped');
  writeFileSync(path, metadata.replace('Build-Depends: helper-source', 'Build-Depends: helper-source/host'));
  assert.equal(checkDomain(loadPackageGraph(domainDirectory, {})).result, 'pass', 'host build does not imply target installation');
  writeFileSync(path, metadata.replace('Build-Depends: helper-source', 'Build-Depends: helper-source/unknown-type'));
  assert.equal(checkDomain(loadPackageGraph(domainDirectory, {})).result, 'inconclusive', 'unsupported build types are not silently stripped');
  const variants = metadata.replace('Package: helper-library\nDepends:', 'Package: helper-library\nBuild-Variant: safe\nDefault-Variant: 1\nDepends:')
    .replace('Package: helper-tool\nDepends:', 'Package: failed\nBuild-Variant: risky\nDepends:')
    .replace('Source-Makefile: package/failed/Makefile\nPackage: failed\nDepends: ', '');
  writeFileSync(path, variants);
  assert.equal(checkDomain(loadPackageGraph(domainDirectory, {})).result, 'pass', 'unselected nondefault variant is not compiled merely by sharing a source');
  writeFileSync(path, variants.replace('Build-Variant: risky', 'Build-Variant: risky\nDefault-Variant: 1'));
  assert.equal(checkDomain(loadPackageGraph(domainDirectory, {})).result, 'fail', 'the actual default variant remains protected');
} finally {
  rmSync(domainDirectory, { recursive: true, force: true });
}
assert(workflow.includes('gzip -n -9 -c tmp/.packageinfo') && workflow.includes('package-info.txt.gz'),
  'exact native metadata must be preserved for offline replay');
console.log('native source domains and sparse typed conditions passed');
