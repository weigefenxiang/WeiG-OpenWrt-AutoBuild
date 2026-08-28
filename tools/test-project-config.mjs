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
  DEFAULT_BUILD_CONFIG_PATH,
  DEFAULT_PACKAGE_MIRROR_POLICY_PATH,
  DEFAULT_SITE_CONFIG_PATH,
  DEFAULT_TIMEZONE_DATA_PATH,
  buildConfigErrors,
  isValidBuildConfig,
  isValidProjectConfiguration,
  isValidSiteConfig,
  loadBuildConfig,
  loadProjectAuthorities,
  loadProjectConfiguration,
  loadSiteConfig,
  projectConfigurationErrors,
  projectToBuildDefaults,
  siteConfigErrors,
  validateBuildConfig,
  validateProjectConfiguration,
  validateSiteConfig,
} from './project-config.mjs';
import {
  normalizeSiteConfig as normalizePublicSiteConfig,
  siteConfigErrors as publicSiteConfigErrors,
  siteRuntimeConfig,
} from '../site/wrt/lib/site-config.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GENERATOR = join(ROOT, 'tools', 'gen-project-config.mjs');
const sourceSite = loadSiteConfig(DEFAULT_SITE_CONFIG_PATH);
const sourceBuild = loadBuildConfig(DEFAULT_BUILD_CONFIG_PATH);
const sourceConfiguration = loadProjectConfiguration();
const clone = (value) => JSON.parse(JSON.stringify(value));
const mutate = (value, path, replacement) => {
  const result = clone(value);
  let target = result;
  for (const key of path.slice(0, -1)) target = target[key];
  target[path.at(-1)] = replacement;
  return result;
};
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

assert.equal(isValidSiteConfig(sourceSite), true, 'canonical site config must be valid');
assert.equal(isValidBuildConfig(sourceBuild), true, 'canonical build config must be valid');
assert.equal(isValidProjectConfiguration(sourceConfiguration), true,
  'canonical site/build configuration must be valid');
assert.deepEqual(sourceConfiguration, { site: sourceSite, build: sourceBuild });
assert.deepEqual(Object.keys(sourceSite).sort(), ['build', 'catalog', 'firmware', 'project', 'ui']);
assert.deepEqual(Object.keys(sourceBuild).sort(), ['admission', 'jobs', 'password']);
assert.equal(Object.hasOwn(sourceSite.firmware, 'password'), false,
  'site config must not carry build secrets/password policy');
assert.deepEqual(validateSiteConfig(sourceSite), sourceSite, 'site validation returns a detached copy');
assert.deepEqual(validateBuildConfig(sourceBuild), sourceBuild, 'build validation returns a detached copy');
assert.deepEqual(validateProjectConfiguration(sourceConfiguration), sourceConfiguration,
  'combined validation returns a detached copy');
assert.deepEqual(publicSiteConfigErrors(sourceSite), [],
  'shared browser validator accepts the canonical nested site config');
assert.deepEqual(normalizePublicSiteConfig(sourceSite), sourceSite,
  'shared browser normalizer returns the canonical nested site shape');
const runtimeSite = siteRuntimeConfig(sourceSite);
assert.deepEqual(runtimeSite.customization, {
  ui: sourceSite.ui,
  firmware: sourceSite.firmware,
  build: sourceSite.build,
}, 'runtime projection must expose only derived compatibility customization');
assert.equal(runtimeSite.links.repository, 'https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild');
assert.equal(runtimeSite.links.actions, 'https://github.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/actions');
assert.equal(runtimeSite.links.catalog, 'https://github.com/weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog');
assert.equal(runtimeSite.links.blog, sourceSite.project.blogUrl);
const sharedSource = readFileSync(join(ROOT, 'site', 'wrt', 'lib', 'site-config.js'), 'utf8');
assert.doesNotMatch(sharedSource, /from ['"]node:|require\(['"]node:|\blocalStorage\b|document\.(?:baseURI|querySelector)/,
  'shared site validator must remain pure and browser-loadable');

const invalidSiteCases = [
  ['unknown top-level key', ['unexpected'], true, 'unknown key'],
  ['project name alias', ['project', 'name'], 'WeiG', 'unknown key'],
  ['project repository URL alias', ['project', 'repositoryUrl'], 'https://github.com/example/repo', 'unknown key'],
  ['project links alias', ['project', 'links'], {}, 'unknown key'],
  ['catalog URL alias', ['catalog', 'url'], 'https://github.com/example/repo', 'unknown key'],
  ['root links alias', ['links'], {}, 'unknown key'],
  ['unknown nested key', ['firmware', 'password'], { mode: 'prompt' }, 'unknown key'],
  ['repository syntax', ['project', 'repository'], 'not a repository', 'invalid format'],
  ['blog URL protocol', ['project', 'blogUrl'], 'http://example.test/', 'must use https'],
  ['short name control character', ['project', 'shortName'], 'Wei.\nG', 'control characters'],
  ['unknown NTP preset', ['firmware', 'ntp', 'preset'], 'custom', 'must be one of cn, global, cloudflare'],
  ['unknown timezone zonename', ['firmware', 'timezone', 'zonename'], 'Mars/Nowhere', 'exact zonename/timezone pair'],
  ['unknown timezone value', ['firmware', 'timezone', 'timezone'], 'NotAZone', 'exact zonename/timezone pair'],
  ['mismatched timezone pair', ['firmware', 'timezone'], { zonename: 'Asia/Shanghai', timezone: 'GMT0' }, 'exact zonename/timezone pair'],
  ['unknown package mirror', ['firmware', 'packageMirror'], 'does-not-exist', 'canonical package mirror preset id'],
  ['package mirror alias', ['firmware', 'packageMirror'], 'official', 'canonical package mirror preset id'],
  ['LAN address range', ['firmware', 'lanIp'], '192.168.999.1', 'four octets'],
  ['LAN address privacy', ['firmware', 'lanIp'], '8.8.8.8', 'RFC1918'],
  ['NTP server count', ['firmware', 'ntp', 'servers'], sourceSite.firmware.ntp.servers.slice(0, 3), 'at least 4'],
];
for (const [name, path, replacement, expected] of invalidSiteCases) {
  const candidate = mutate(sourceSite, path, replacement);
  assert.equal(isValidSiteConfig(candidate), false, `${name} should be rejected`);
  assert.match(siteConfigErrors(candidate).join('\n'), new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `${name} should report ${expected}`);
  assert.throws(() => validateSiteConfig(candidate), /Site configuration is invalid/,
    `${name} should throw from strict site validation`);
}
const syntacticallyValidUnknownTimezone = mutate(sourceSite, ['firmware', 'timezone'], {
  zonename: 'Asia/Shanghai', timezone: 'GMT0',
});
assert.deepEqual(publicSiteConfigErrors(syntacticallyValidUnknownTimezone), [],
  'shared browser validator leaves dynamic authority checks to Node');
assert.match(siteConfigErrors(syntacticallyValidUnknownTimezone).join('\n'), /exact zonename\/timezone pair/);

const trimmedUnicodeSite = mutate(sourceSite, ['project', 'shortName'], '  中文 Wei.G  ');
assert.equal(isValidSiteConfig(trimmedUnicodeSite), true,
  'shortName should accept bounded Unicode text after trimming');
assert.equal(validateSiteConfig(trimmedUnicodeSite).project.shortName, '中文 Wei.G');
assert.equal(isValidSiteConfig(mutate(sourceSite, ['project', 'blogUrl'], '')), true,
  'an empty blog URL is an allowed opt-out');

const invalidBuildCases = [
  ['unknown top-level key', ['unexpected'], true, 'unknown key'],
  ['unknown password key', ['password', 'value'], 'do-not-leak', 'unknown key'],
  ['compile job range', ['jobs', 'compile'], 33, 'between 1 and 32'],
  ['download job range', ['jobs', 'download'], 0, 'between 1 and 32'],
  ['admission range', ['admission', 'publicActiveBuilds'], 0, 'between 1 and 20'],
];
for (const [name, path, replacement, expected] of invalidBuildCases) {
  const candidate = mutate(sourceBuild, path, replacement);
  assert.equal(isValidBuildConfig(candidate), false, `${name} should be rejected`);
  assert.match(buildConfigErrors(candidate).join('\n'), new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `${name} should report ${expected}`);
  assert.throws(() => validateBuildConfig(candidate), /Build configuration is invalid/,
    `${name} should throw from strict build validation`);
}

const crossUnknown = { site: sourceSite, build: sourceBuild, password: { mode: 'empty' } };
assert.equal(isValidProjectConfiguration(crossUnknown), false, 'combined config must reject unknown keys');
assert.match(projectConfigurationErrors(crossUnknown).join('\n'), /unknown key/);
assert.throws(() => validateProjectConfiguration(crossUnknown), /Project configuration is invalid/);
assert.equal(isValidProjectConfiguration({
  site: mutate(sourceSite, ['firmware', 'password'], { mode: 'prompt' }),
  build: sourceBuild,
}), false, 'site config cannot gain build-only password policy');
assert.equal(isValidProjectConfiguration({
  site: sourceSite,
  build: mutate(sourceBuild, ['firmware'], {}),
}), false, 'build config cannot gain site-only firmware fields');

const authorities = loadProjectAuthorities();
assert.equal(authorities.errors.length, 0, 'runtime authority documents must be valid');
assert.equal(authorities.timezoneRows.length, 445);
assert.deepEqual([...authorities.packagePresetIds], ['auto', 'source-default', 'ustc', 'pku', 'bfsu']);

const tempRoot = mkdtempSync(join(tmpdir(), 'weig-project-config-'));
try {
  const siteSource = join(tempRoot, 'site.json');
  const buildSource = join(tempRoot, 'build.json');
  const shellOutput = join(tempRoot, 'Shell', 'build-defaults.conf');
  writeJson(siteSource, sourceSite);
  writeJson(buildSource, sourceBuild);
  const runGenerator = (...args) => spawnSync(process.execPath, [GENERATOR, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
  });
  const common = ['--site', siteSource, '--build', buildSource, '--shell-output', shellOutput];

  const malformedTimezoneAuthority = join(tempRoot, 'malformed-timezones.json');
  writeJson(malformedTimezoneAuthority, {});
  assert.equal(isValidSiteConfig(sourceSite, {
    timezonePath: malformedTimezoneAuthority,
    packageMirrorPath: DEFAULT_PACKAGE_MIRROR_POLICY_PATH,
  }), false, 'malformed timezone authority must invalidate site config');
  assert.match(siteConfigErrors(sourceSite, { timezonePath: malformedTimezoneAuthority }).join('\n'), /timezone authority/);
  assert.throws(() => validateSiteConfig(sourceSite, { timezonePath: malformedTimezoneAuthority }),
    /Site configuration is invalid/, 'strict validation must surface malformed timezone authority');
  assert.equal(isValidSiteConfig(sourceSite, {
    timezonePath: DEFAULT_TIMEZONE_DATA_PATH,
    packageMirrorPath: join(tempRoot, 'missing-package-mirrors.json'),
  }), false, 'missing package mirror authority must invalidate site config');

  const malformedPackageAuthority = join(tempRoot, 'malformed-package-mirrors.json');
  writeJson(malformedPackageAuthority, { schema: 2, presets: [] });
  assert.equal(isValidSiteConfig(sourceSite, {
    timezonePath: DEFAULT_TIMEZONE_DATA_PATH,
    packageMirrorPath: malformedPackageAuthority,
  }), false, 'malformed package mirror authority must invalidate site config');

  const futureTimezoneAuthority = JSON.parse(readFileSync(DEFAULT_TIMEZONE_DATA_PATH, 'utf8'));
  futureTimezoneAuthority.source = 'future-authority-metadata';
  futureTimezoneAuthority.futureMetadata = { format: 2 };
  const futureTimezonePath = join(tempRoot, 'future-timezones.json');
  writeJson(futureTimezonePath, futureTimezoneAuthority);
  const futurePackageAuthority = JSON.parse(readFileSync(DEFAULT_PACKAGE_MIRROR_POLICY_PATH, 'utf8'));
  futurePackageAuthority.origins = null;
  futurePackageAuthority.aliases = null;
  futurePackageAuthority.futureMetadata = { format: 3 };
  const futurePackagePath = join(tempRoot, 'future-package-mirrors.json');
  writeJson(futurePackagePath, futurePackageAuthority);
  assert.equal(isValidSiteConfig(sourceSite, {
    timezonePath: futureTimezonePath,
    packageMirrorPath: futurePackagePath,
  }), true, 'unrelated authority fields must not block site validation');

  const generated = runGenerator(...common);
  assert.equal(generated.status, 0, generated.stderr || generated.stdout);
  assert.equal(runGenerator(...common, '--check').status, 0, 'fresh Shell defaults must pass --check');
  assert.equal(readFileSync(join(tempRoot, 'Shell', 'build-defaults.conf'), 'utf8'),
    projectToBuildDefaults({ site: sourceSite, build: sourceBuild }));

  const shellSpecialTag = 'tag with spaces "double" \'single\' $d `backticks` \\slash }';
  const specialSite = clone(sourceSite);
  specialSite.build.defaultTag = shellSpecialTag;
  const specialSiteSource = join(tempRoot, 'special-site.json');
  const specialShell = join(tempRoot, 'special-build-defaults.conf');
  writeJson(specialSiteSource, specialSite);
  const specialResult = runGenerator('--site', specialSiteSource, '--build', buildSource, '--shell-output', specialShell);
  assert.equal(specialResult.status, 0, specialResult.stderr || specialResult.stdout);
  const bashEnvironment = { ...process.env };
  delete bashEnvironment.WRT_DEFAULT_TAG;
  const sourced = spawnSync('bash', ['-c', '. "$1"\nprintf "%s" "$WRT_DEFAULT_TAG"',
    'project-config-test', specialShell], { cwd: ROOT, encoding: 'utf8', shell: false, env: bashEnvironment });
  if (sourced.error?.code === 'ENOENT') throw new Error('Bash is required for the Shell projection test');
  assert.equal(sourced.status, 0, sourced.stderr || sourced.stdout);
  assert.equal(sourced.stdout, shellSpecialTag,
    'Bash must recover defaultTag values containing shell punctuation exactly');

  writeFileSync(shellOutput, readFileSync(shellOutput, 'utf8').replace('WRT_THEME:=luci-theme-argon', 'WRT_THEME:=drifted'), 'utf8');
  assert.equal(runGenerator(...common, '--check').status, 1, 'Shell drift must fail --check');
  assert.equal(runGenerator(...common).status, 0);

  const secretBuild = clone(sourceBuild);
  secretBuild.password.mode = 'secret';
  const secretBuildSource = join(tempRoot, 'secret-build.json');
  const secretShell = join(tempRoot, 'secret-build-defaults.conf');
  writeJson(secretBuildSource, secretBuild);
  const secretResult = runGenerator('--site', siteSource, '--build', secretBuildSource, '--shell-output', secretShell);
  assert.equal(secretResult.status, 0, secretResult.stderr || secretResult.stdout);
  assert.match(readFileSync(secretShell, 'utf8'), /WRT_PASSWORD_MODE:=secret/);
  assert.doesNotMatch(readFileSync(secretShell, 'utf8'), /passwordValue|secretValue|do-not-leak/);
  assert.doesNotMatch(readFileSync(siteSource, 'utf8'), /password|secretValue|do-not-leak/);

  const invalidBuildSource = join(tempRoot, 'invalid-build.json');
  writeJson(invalidBuildSource, mutate(sourceBuild, ['jobs', 'compile'], 0));
  const invalidResult = runGenerator('--site', siteSource, '--build', invalidBuildSource, '--shell-output', shellOutput);
  assert.equal(invalidResult.status, 1, 'invalid canonical build config must fail generation');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

assert.match(projectToBuildDefaults(sourceConfiguration), /WRT_NTP_4:=cn\.pool\.ntp\.org/);
console.log('Project site/build configuration tests passed (boundaries/authority/Shell/drift/no-secret).');
