import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { activePackages, bindConditionContext, classifyActivePackages, loadPackageGraph,
  parsePackageInfo, verifyBuildClosure } from './verify-build-closure.mjs';
import { evaluateNativeMakeGraph } from './lib/native-make-graph.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const identity = { repository: 'example/catalog', revision: '1'.repeat(40), sourceCommit: '2'.repeat(40),
  source: 'Example', branch: 'main', target: { system: 'x86', subtarget: '64', profile: 'DEVICE_generic' } };
const document = { schema: 5, rules: [{ id: 'BLD-TEST', issue: 'build-failure', match: 'all-selected',
  policy: 'preventive', environments: [{ source: '*', branch: '*', packageAvailability: 'if-present', targetScope: {} }],
  packages: ['failed'], buildDependency: { package: 'failed' },
  evidence: [{ source: 'Example', branch: 'main', sourceCommit: identity.sourceCommit, refs: ['test:1'] }],
  failure: { phase: 'package-compile', cause: 'package-caused', code: 'test-failure' } }] };
const directory = mkdtempSync(join(tmpdir(), 'weig-native-make-test-'));
const configPath = join(directory, '.config'), depsPath = join(directory, 'tmp', '.packagedeps');
mkdirSync(join(directory, 'tmp'));
const metadataPath = join(directory, 'tmp', '.packageinfo');
const base = [
  'Source-Makefile: package/root/Makefile', 'Package: root', 'Depends: +api',
  'Description: not a package', 'Package: fake', '@@',
  'Config:', 'Package: fake-config', '@@',
  'Source-Makefile: package/helper-source/Makefile', 'Build-Types: host',
  'Package: safe', 'Provides: @api', 'Build-Variant: safe', 'Default-Variant: 1',
  'Package: failed', 'Provides: @api', 'Build-Variant: risky',
  'Source-Makefile: package/other/Makefile', 'Package: other', 'Provides: @other-api',
].join('\n');
const assignments = [
  'package-$(CONFIG_PACKAGE_root) += root',
  'package-$(CONFIG_PACKAGE_safe) += helper-source',
  'package-$(CONFIG_PACKAGE_failed) += helper-source',
  'package-$(CONFIG_PACKAGE_other) += other',
  '$(curdir)/helper-source/variants += $(if $(CONFIG_PACKAGE_safe),safe)',
  '$(curdir)/helper-source/variants += $(if $(CONFIG_PACKAGE_failed),risky)',
  '$(curdir)/helper-source/default-variant := safe',
  'buildtypes-helper-source = host',
].join('\n');
function run(config = 'CONFIG_PACKAGE_root=y\n', edges = '', data = base) {
  writeFileSync(metadataPath, data);
  writeFileSync(configPath, config);
  writeFileSync(depsPath, assignments + '\n' + edges);
  const graph = loadPackageGraph(directory, {}), parsed = activePackages(configPath);
  const before = readFileSync(configPath);
  graph.native = evaluateNativeMakeGraph({ graph, configValues: parsed.values, configPath, packageDepsPath: depsPath });
  const result = verifyBuildClosure({ document, identity, graph, active: parsed.active, configValues: parsed.values });
  assert.deepEqual(readFileSync(configPath), before, 'graph evaluation never edits the authoritative config');
  return { result, graph, parsed };
}
try {
  assert.equal(run().result.result, 'pass');
  assert.equal(run('CONFIG_PACKAGE_failed=y\n').result.result, 'fail', 'direct failure is protected');
  const unconditional = '$(curdir)/root/compile += $(curdir)/helper-source/compile\n';
  assert.equal(run(undefined, unconditional).result.result, 'pass', 'native safe default variant is honored');
  const riskyDefault = assignments.replace('default-variant := safe', 'default-variant := risky');
  writeFileSync(depsPath, riskyDefault + '\n' + unconditional);
  let graph = loadPackageGraph(directory, {}), parsed = activePackages(configPath);
  graph.native = evaluateNativeMakeGraph({ graph, configValues: parsed.values, configPath, packageDepsPath: depsPath });
  assert.equal(verifyBuildClosure({ document, identity, graph, active: parsed.active, configValues: parsed.values }).result,
    'fail', 'uninstalled source default variant can still build a failed package');
  const noVariant = base.replace(/Build-Variant:.*\n/g, '').replace('Build-Variant: risky', '');
  assert.equal(run(undefined, unconditional, noVariant).result.result, 'fail', 'single native source edge does not require an installed binary');
  const conditional = '$(curdir)/root/compile += $(if $(CONFIG_PACKAGE_safe),$(curdir)/helper-source/compile) $(if $(CONFIG_PACKAGE_failed),$(curdir)/helper-source/compile)\n';
  assert.equal(run(undefined, conditional).result.result, 'pass', 'zero enabled providers emits no edge');
  for (const state of ['y', 'm']) {
    assert.equal(run(`CONFIG_PACKAGE_root=y\nCONFIG_PACKAGE_safe=${state}\n`, conditional).result.result, 'pass');
    assert.equal(run(`CONFIG_PACKAGE_root=y\nCONFIG_PACKAGE_failed=${state}\n`, conditional).result.result, 'fail');
  }
  assert.equal(run('CONFIG_PACKAGE_root=y\nCONFIG_PACKAGE_safe=y\nCONFIG_PACKAGE_failed=m\n', conditional).result.result,
    'fail', 'all enabled providers/variants remain in the native graph');
  assert.equal(run(undefined, '$(curdir)/root/compile += $(if $(CONFIG_GATE),$(curdir)/helper-source/compile)\n', noVariant).result.result,
    'pass', 'sparse config Make variables are empty, not an invented UNKNOWN edge');
  assert.equal(run('CONFIG_PACKAGE_root=y\nCONFIG_GATE=m\n', '$(curdir)/root/compile += $(if $(CONFIG_GATE),$(curdir)/helper-source/compile)\n', noVariant).result.result, 'fail');
  assert.equal(run(undefined, '$(curdir)/root/compile += $(if $(CONFIG_GATE),,$(curdir)/helper-source/compile)\n', noVariant).result.result, 'fail');
  assert.equal(run(undefined, '$(curdir)/root/compile += $(curdir)/helper-source/host/compile\n', noVariant).result.result, 'pass', 'host-only edges are not target binaries');
  assert.equal(run(undefined, '$(curdir)/root/compile += $(curdir)/helper-source/host/compile\n$(curdir)/helper-source/host/compile += $(curdir)/other/compile\n').result.result, 'pass');
  assert.equal(run(undefined, '$(curdir)/root/compile += $(curdir)/root/compile\n').result.result, 'pass', 'cycles terminate');
  assert.equal(run(undefined, '$(curdir)/root/compile += $(curdir)/missing/compile\n').result.result, 'inconclusive', 'unknown native source identities are not dropped');
  assert.equal(run('CONFIG_PACKAGE_unknown=y\n').result.result, 'inconclusive');
  const fixture = run();
  const checkDocument = (rules) => verifyBuildClosure({ document: rules, identity, graph: fixture.graph,
    active: fixture.parsed.active, configValues: fixture.parsed.values });
  const outOfScope = structuredClone(document);
  outOfScope.rules[0].sourceCommits = ['3'.repeat(40)];
  assert.equal(checkDocument(outOfScope).result, 'pass');
  const malformed = structuredClone(document);
  malformed.rules[0].environments = null;
  assert.equal(checkDocument(malformed).result, 'inconclusive');
  const ordinary = structuredClone(document);
  delete ordinary.rules[0].buildDependency;
  ordinary.rules[0].packages = ['root'];
  assert.equal(checkDocument(ordinary).result, 'fail', 'ordinary build-failure compatibility remains independent of compilation edges');
  assert(!fixture.graph.packages.has('fake') && !fixture.graph.packages.has('fake-config'));
  assert.equal(fixture.graph.native.nodes.size, 4);
  assert.match(fixture.graph.native.proof.packageDepsSha256, /^[a-f0-9]{64}$/);
  const missingGraph = { ...fixture.graph, native: null };
  assert.equal(verifyBuildClosure({ document, identity, graph: missingGraph, active: fixture.parsed.active,
    configValues: fixture.parsed.values }).result, 'inconclusive', 'no fallback hand-built compile graph');
  for (const unsafe of ['include other.mk', '$(shell echo bad)', '$(curdir)/root/compile += $(shell echo bad)',
    '$(curdir)/root/compile += $(eval bad)', 'all: ; echo bad']) {
    writeFileSync(depsPath, unsafe);
    assert.throws(() => evaluateNativeMakeGraph({ graph: fixture.graph, configValues: fixture.parsed.values,
      configPath, packageDepsPath: depsPath }), /Unsupported/);
  }
  run('CONFIG_PACKAGE_root=y\nCONFIG_LABEL="$(error injected)"\n');
  const kinds = { schema: 1, revision: identity.revision, sourceCommit: identity.sourceCommit,
    graphHash: 'a'.repeat(64), nonPackageSymbols: ['PACKAGE_root_FEATURE'],
    conditionContext: { schema: 1, symbolTypes: [['FEATURE', 'bool']], undefinedSymbols: [] } };
  const prefixed = new Map([['root', 'y'], ['root_FEATURE', 'y'], ['unknown', 'm']]);
  assert.deepEqual([...classifyActivePackages(prefixed, kinds, identity)], [['root', 'y'], ['unknown', 'm']]);
  assert.equal(classifyActivePackages(prefixed, kinds, identity, new Map([['root_FEATURE', {}]])).size, 3);
  assert.equal(bindConditionContext(new Map(), kinds, identity).size, 0);
  assert.throws(() => bindConditionContext(new Map(), { ...kinds, revision: '3'.repeat(40) }, identity));
  writeFileSync(metadataPath, base + '\nSource-Makefile: package/new/Makefile\nPackage: safe\nProvides: @new-api\n');
  const replaced = parsePackageInfo(metadataPath).packages.get('safe');
  assert.deepEqual([...replaced.sourceNames], ['new']);
  assert.deepEqual([...replaced.provides], ['new-api', 'api']);
  run();
  const request = { schema: 6, source: identity.source, version: 'main', branch: 'main',
    catalog: { repository: identity.repository, revision: identity.revision, sourceCommit: identity.sourceCommit },
    customTarget: { system: 'x86', subtarget: '64', profileSymbol: 'DEVICE_generic', profileSelector: 'generic' } };
  writeFileSync(join(directory, 'request.json'), JSON.stringify(request));
  writeFileSync(join(directory, 'compatibility.json'), JSON.stringify(document));
  const cliArgs = [join(ROOT, 'tools/verify-build-closure.mjs'), '--request', join(directory, 'request.json'),
    '--upstream-dir', directory, '--config', configPath, '--source-commit', identity.sourceCommit,
    '--upstream-commit', identity.sourceCommit, '--catalog-revision', identity.revision,
    '--compatibility', join(directory, 'compatibility.json'), '--out', join(directory, 'report.json')];
  let cli = spawnSync(process.execPath, cliArgs, { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stdout + cli.stderr);
  assert.equal(JSON.parse(readFileSync(join(directory, 'report.json'))).nativeMake.authority, 'upstream-.packagedeps/gnu-make');
  rmSync(depsPath);
  cli = spawnSync(process.execPath, cliArgs, { encoding: 'utf8' });
  assert.equal(cli.status, 2, 'missing native graph is inconclusive with an evidence report');
  assert.equal(JSON.parse(readFileSync(join(directory, 'report.json'))).result, 'inconclusive');
  request.customTarget = {};
  writeFileSync(join(directory, 'request.json'), JSON.stringify(request));
  cli = spawnSync(process.execPath, cliArgs, { encoding: 'utf8' });
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /customTarget identity is incomplete/);
  const workflow = readFileSync(join(ROOT, '.github/workflows/custom-build.yml'), 'utf8');
  for (const file of ['package-info.txt.gz', 'package-deps.mk.gz']) assert(workflow.includes(file));
  console.log('Native GNU Make closure, typed domains, variants, missing evidence, safety and CLI tests passed');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
