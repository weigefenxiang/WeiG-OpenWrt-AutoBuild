#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_PROJECT_CONFIG_PATH,
  DEFAULT_PACKAGE_MIRROR_POLICY_PATH,
  DEFAULT_TIMEZONE_DATA_PATH,
  isValidProjectConfig,
  loadProjectAuthorities,
  loadProjectConfig,
  projectConfigErrors,
  projectToBuildDefaults,
  projectToSiteData,
  validateProjectConfig,
} from './project-config.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GENERATOR = join(ROOT, 'tools', 'gen-project-config.mjs');
const sourceConfig = loadProjectConfig(DEFAULT_PROJECT_CONFIG_PATH);
const clone = (value) => JSON.parse(JSON.stringify(value));
const mutate = (path, value) => {
  const result = clone(sourceConfig);
  let target = result;
  for (const key of path.slice(0, -1)) target = target[key];
  target[path.at(-1)] = value;
  return result;
};

assert.equal(isValidProjectConfig(sourceConfig), true, 'canonical project config must be valid');
const authorities = loadProjectAuthorities();
assert.equal(authorities.errors.length, 0, 'runtime authority documents must be structurally valid');
assert.equal(authorities.timezoneRows.length, 445);
assert.deepEqual([...authorities.packagePresetIds], ['auto', 'source-default', 'ustc', 'pku', 'bfsu']);
assert.equal(sourceConfig.project.shortName, 'Wei.G');
assert.equal(sourceConfig.build.defaultTag, 'anonymous');
assert.deepEqual(Object.keys(sourceConfig).sort(),
  ['admission', 'build', 'catalog', 'firmware', 'project', 'ui']);
assert.deepEqual(validateProjectConfig(sourceConfig), sourceConfig,
  'validation must return a detached normalized copy');

const invalidCases = [
  ['unknown top-level key', { path: ['unexpected'], value: true }, 'unknown key'],
  ['unknown nested key', { path: ['firmware', 'password', 'value'], value: 'do-not-leak' }, 'unknown key'],
  ['repository syntax', { path: ['project', 'repository'], value: 'not a repository' }, 'invalid format'],
  ['blog URL protocol', { path: ['project', 'blogUrl'], value: 'http://example.test/' }, 'must use https'],
  ['short name control character', { path: ['project', 'shortName'], value: 'Wei.\nG' }, 'control characters'],
  ['unknown NTP preset', { path: ['firmware', 'ntp', 'preset'], value: 'custom' }, 'must be one of cn, global, cloudflare'],
  ['unknown timezone zonename', { path: ['firmware', 'timezone', 'zonename'], value: 'Mars/Nowhere' }, 'exact zonename/timezone pair'],
  ['unknown timezone value', { path: ['firmware', 'timezone', 'timezone'], value: 'NotAZone' }, 'exact zonename/timezone pair'],
  ['mismatched timezone pair', { path: ['firmware', 'timezone'], value: { zonename: 'Asia/Shanghai', timezone: 'GMT0' } }, 'exact zonename/timezone pair'],
  ['unknown package mirror', { path: ['firmware', 'packageMirror'], value: 'does-not-exist' }, 'canonical package mirror preset id'],
  ['package mirror alias', { path: ['firmware', 'packageMirror'], value: 'official' }, 'canonical package mirror preset id'],
  ['LAN address range', { path: ['firmware', 'lanIp'], value: '192.168.999.1' }, 'four octets'],
  ['LAN address privacy', { path: ['firmware', 'lanIp'], value: '8.8.8.8' }, 'RFC1918'],
  ['NTP server count', { path: ['firmware', 'ntp', 'servers'], value: sourceConfig.firmware.ntp.servers.slice(0, 3) }, 'at least 4'],
  ['compile job range', { path: ['build', 'compileJobs'], value: 33 }, 'between 1 and 32'],
  ['admission range', { path: ['admission', 'publicActiveBuilds'], value: 0 }, 'between 1 and 20'],
];
for (const [name, change, expected] of invalidCases) {
  const candidate = mutate(change.path, change.value);
  assert.equal(isValidProjectConfig(candidate), false, `${name} should be rejected`);
  assert.match(projectConfigErrors(candidate).join('\n'), new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `${name} should report ${expected}`);
  assert.throws(() => validateProjectConfig(candidate), /Project configuration is invalid/,
    `${name} should throw from strict validation`);
}

const trimmedUnicodeConfig = mutate(['project', 'shortName'], '  中文 Wei.G  ');
assert.equal(isValidProjectConfig(trimmedUnicodeConfig), true,
  'shortName should accept bounded Unicode text after trimming');
assert.equal(validateProjectConfig(trimmedUnicodeConfig).project.shortName, '中文 Wei.G');
assert.equal(isValidProjectConfig(mutate(['project', 'blogUrl'], '')), true,
  'an empty blog URL is an allowed opt-out');

const tempRoot = mkdtempSync(join(tmpdir(), 'weig-project-config-'));
try {
  const source = join(tempRoot, 'project.json');
  const siteOutput = join(tempRoot, 'site', 'project.json');
  const shellOutput = join(tempRoot, 'Shell', 'build-defaults.conf');
  writeFileSync(source, JSON.stringify(sourceConfig, null, 2) + '\n', 'utf8');
  const runGenerator = (...args) => spawnSync(process.execPath, [GENERATOR, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
  });
  const common = ['--source', source, '--site-output', siteOutput, '--shell-output', shellOutput];

  const malformedTimezoneAuthority = join(tempRoot, 'malformed-timezones.json');
  writeFileSync(malformedTimezoneAuthority, '{}\n', 'utf8');
  assert.equal(isValidProjectConfig(sourceConfig, {
    timezonePath: malformedTimezoneAuthority,
    packageMirrorPath: DEFAULT_PACKAGE_MIRROR_POLICY_PATH,
  }), false, 'malformed timezone authority must invalidate project config');
  assert.match(projectConfigErrors(sourceConfig, { timezonePath: malformedTimezoneAuthority }).join('\n'), /timezone authority/);
  assert.throws(() => validateProjectConfig(sourceConfig, { timezonePath: malformedTimezoneAuthority }),
    /Project configuration is invalid/, 'strict validation must surface malformed timezone authority');
  assert.equal(isValidProjectConfig(sourceConfig, {
    timezonePath: DEFAULT_TIMEZONE_DATA_PATH,
    packageMirrorPath: join(tempRoot, 'missing-package-mirrors.json'),
  }), false, 'missing package mirror authority must invalidate project config');

  const malformedPackageAuthority = join(tempRoot, 'malformed-package-mirrors.json');
  writeFileSync(malformedPackageAuthority, JSON.stringify({ schema: 2, presets: [] }) + '\n', 'utf8');
  assert.equal(isValidProjectConfig(sourceConfig, {
    timezonePath: DEFAULT_TIMEZONE_DATA_PATH,
    packageMirrorPath: malformedPackageAuthority,
  }), false, 'malformed package mirror authority must invalidate project config');

  const futureTimezoneAuthority = JSON.parse(readFileSync(DEFAULT_TIMEZONE_DATA_PATH, 'utf8'));
  futureTimezoneAuthority.source = 'future-authority-metadata';
  futureTimezoneAuthority.futureMetadata = { format: 2 };
  const futureTimezonePath = join(tempRoot, 'future-timezones.json');
  writeFileSync(futureTimezonePath, JSON.stringify(futureTimezoneAuthority) + '\n', 'utf8');
  const futurePackageAuthority = JSON.parse(readFileSync(DEFAULT_PACKAGE_MIRROR_POLICY_PATH, 'utf8'));
  futurePackageAuthority.origins = null;
  futurePackageAuthority.aliases = null;
  futurePackageAuthority.futureMetadata = { format: 3 };
  const futurePackagePath = join(tempRoot, 'future-package-mirrors.json');
  writeFileSync(futurePackagePath, JSON.stringify(futurePackageAuthority) + '\n', 'utf8');
  assert.equal(isValidProjectConfig(sourceConfig, {
    timezonePath: futureTimezonePath,
    packageMirrorPath: futurePackagePath,
  }), true, 'unrelated authority fields must not block project validation');

  const generated = runGenerator(...common);
  assert.equal(generated.status, 0, generated.stderr || generated.stdout);
  assert.equal(runGenerator(...common, '--check').status, 0, 'fresh projections must pass --check');

  const siteProjection = JSON.parse(readFileSync(siteOutput, 'utf8'));
  assert.equal(siteProjection.repository, sourceConfig.project.repository);
  assert.equal(siteProjection.catalogRepository, sourceConfig.catalog.repository);
  assert.equal(siteProjection.catalogDataBranches.main, 'catalog-main');
  assert.deepEqual(siteProjection.customization, {
    ui: sourceConfig.ui,
    firmware: sourceConfig.firmware,
    build: sourceConfig.build,
    admission: sourceConfig.admission,
  });

  writeFileSync(siteOutput, readFileSync(siteOutput, 'utf8').replace('"schema": 1', '"schema": 1\n'), 'utf8');
  assert.equal(runGenerator(...common, '--check').status, 1, 'site drift must fail --check');
  const repaired = runGenerator(...common);
  assert.equal(repaired.status, 0, repaired.stderr || repaired.stdout);

  const shellSpecialTag = 'tag with spaces "double" \'single\' $d `backticks` \\slash }';
  const specialConfig = clone(sourceConfig);
  specialConfig.build.defaultTag = shellSpecialTag;
  const specialSource = join(tempRoot, 'special-project.json');
  const specialShell = join(tempRoot, 'special-build-defaults.conf');
  writeFileSync(specialSource, JSON.stringify(specialConfig, null, 2) + '\n', 'utf8');
  const specialResult = runGenerator('--source', specialSource, '--site-output', siteOutput, '--shell-output', specialShell);
  assert.equal(specialResult.status, 0, specialResult.stderr || specialResult.stdout);
  const bashEnvironment = { ...process.env };
  delete bashEnvironment.WRT_DEFAULT_TAG;
  const sourced = spawnSync('bash', ['-c', '. "$1"\nprintf "%s" "$WRT_DEFAULT_TAG"',
    'project-config-test', specialShell], { cwd: ROOT, encoding: 'utf8', shell: false, env: bashEnvironment });
  if (sourced.error?.code === 'ENOENT') throw new Error('Bash is required for the shell projection test');
  assert.equal(sourced.status, 0, sourced.stderr || sourced.stdout);
  assert.equal(sourced.stdout, shellSpecialTag,
    'Bash must recover defaultTag values containing shell punctuation exactly');

  writeFileSync(shellOutput, readFileSync(shellOutput, 'utf8').replace('WRT_THEME:=luci-theme-argon', 'WRT_THEME:=drifted'), 'utf8');
  assert.equal(runGenerator(...common, '--check').status, 1, 'shell drift must fail --check');
  assert.equal(runGenerator(...common).status, 0);

  const secretConfig = clone(sourceConfig);
  secretConfig.firmware.password.mode = 'secret';
  const secretSource = join(tempRoot, 'secret-project.json');
  const secretSite = join(tempRoot, 'secret-site.json');
  const secretShell = join(tempRoot, 'secret-build-defaults.conf');
  writeFileSync(secretSource, JSON.stringify(secretConfig, null, 2) + '\n', 'utf8');
  const secretResult = runGenerator('--source', secretSource, '--site-output', secretSite, '--shell-output', secretShell);
  assert.equal(secretResult.status, 0, secretResult.stderr || secretResult.stdout);
  assert.match(readFileSync(secretSite, 'utf8'), /"mode": "secret"/);
  assert.doesNotMatch(readFileSync(secretSite, 'utf8'), /do-not-leak|passwordValue|secretValue/);
  assert.doesNotMatch(readFileSync(secretShell, 'utf8'), /do-not-leak|passwordValue|secretValue/);

  const invalidSource = join(tempRoot, 'invalid-project.json');
  writeFileSync(invalidSource, JSON.stringify(mutate(['build', 'compileJobs'], 0), null, 2) + '\n', 'utf8');
  const invalidResult = runGenerator('--source', invalidSource, '--site-output', siteOutput, '--shell-output', shellOutput);
  assert.equal(invalidResult.status, 1, 'invalid canonical config must fail generation');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

// Keep the projection helper itself covered so callers cannot bypass validation.
assert.match(projectToBuildDefaults(sourceConfig), /WRT_NTP_4:=cn\.pool\.ntp\.org/);
assert.equal(projectToSiteData(sourceConfig).customization.admission.publicActiveBuilds, 3);
console.log('Project configuration tests passed (invalid/valid/drift/no-secret).');
