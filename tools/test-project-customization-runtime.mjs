#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const controller = readFileSync(join(ROOT, 'site', 'wrt', 'lib', 'core', 'application-controller.js'), 'utf8');
const workspace = readFileSync(join(ROOT, 'site', 'wrt', 'lib', 'plugins', 'workspace-controller.js'), 'utf8');
const dataLoader = readFileSync(join(ROOT, 'site', 'wrt', 'lib', 'core', 'data-loader.js'), 'utf8');
const siteConfig = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'config', 'site.json'), 'utf8'));
const html = readFileSync(join(ROOT, 'site', 'wrt', 'index.html'), 'utf8');
const parser = readFileSync(join(ROOT, 'tools', 'parse-request.mjs'), 'utf8');
const admission = readFileSync(join(ROOT, 'tools', 'build-admission.mjs'), 'utf8');
const workflow = readFileSync(join(ROOT, '.github', 'workflows', 'custom-build.yml'), 'utf8');

const siteConfigLoader = dataLoader.match(/async function loadSiteConfig\(\) \{[\s\S]*?\n\}/)?.[0] || '';
assert.match(siteConfigLoader, /fetch\(releaseAssetUrl\('config\/site\.json'\)/,
  'the browser must load the release-scoped public site config');
assert.match(siteConfigLoader, /import\(releaseAssetUrl\('\.\/lib\/site-config\.js'\)\)/,
  'the browser must import the shared config contract through the release URL');
assert.match(siteConfigLoader, /normalizeSiteConfig/);
assert.match(siteConfigLoader, /siteRuntimeConfig/);
assert.doesNotMatch(siteConfigLoader, /config[\\/]build\.json|data[\\/]project\.json|location\.origin/,
  'site config loading must not cross into build-only or generated project data');
assert.match(html, /const url = new URL\(path, document\.baseURI\)/,
  'release asset URLs must resolve relative to the deployed site directory');
assert.doesNotMatch(html, /location\.origin/,
  'the browser must not rebuild release asset URLs from the origin root');
const footer = html.match(/<footer[\s\S]*?<\/footer>/)?.[0] || '';
assert.match(footer, /data-project-actions-link/);
assert.match(footer, /data-project-repository-link/);
assert.match(footer, /data-project-catalog-link/);
assert.doesNotMatch(footer, /href="https:\/\/github\.com\/weigefenxiang\/WeiG-OpenWrt-AutoBuild/,
  'project footer destinations must come from the validated projection');
assert.doesNotMatch(footer, /href="https:\/\/github\.com\/weigefenxiang\/WeiG-OpenWrt-Menuconfig-Catalog/,
  'Catalog footer destinations must come from the validated projection');
assert.doesNotMatch(footer, /href="https:\/\/www\.weigeshare/,
  'the footer must not retain a hardcoded blog destination');
assert.doesNotMatch(JSON.stringify(siteConfig), /"(?:password|jobs|admission)"/,
  'the public site config must not expose build-only policy');
assert.match(controller, /const links = PROJECT\?\.links/);
assert.match(controller, /removeAttribute\('href'\)/,
  'an empty project blog URL must not leave the built-in blog destination active');
assert.match(controller, /if \(links\.blog\)/,
  'project blog links must accept HTTPS only');
assert.match(controller, /PROJECT = await loadSiteConfig\(\)/,
  'the controller must consume the validated site projection');
const projectCustomizationBody = controller.match(
  /async function applyProjectCustomization\(\) \{([\s\S]*?)\n\}\n\nfunction applyProjectCatalogDefaults/,
)?.[1] || '';
assert.doesNotMatch(projectCustomizationBody, /defaultLanguage|firmware\.timezone|state\.lang\s*=|state\.timezone\s*=/,
  'project customization must not override browser-selected language or timezone');
assert.match(controller,
  /await initializeI18n\(\);[\s\S]*?TIMEZONES = await loadJson\('timezones\.json'\);\s+initializeTimezone\(\);\s+await applyProjectCustomization\(\);/,
  'browser language and timezone detection must run before project defaults');
assert.doesNotMatch(controller, /loadJson\(['"]project\.json['"]\)|data[\\/]project\.json/,
  'the browser must not consume the removed generated project projection');
assert.match(controller, /PROJECT = null;[\s\S]*state\.buildMeta = null;[\s\S]*updateSubmitGate\?\.\(\)/,
  'site or deployment identity failures must leave submission fail-closed');
assert.match(controller, /const previousExplicit = packageMirrorSelectionExplicit;\s+packageMirrorSelectionExplicit = true;/,
  'the project package mirror must be treated as a temporary explicit initial preference');
assert.match(controller, /finally \{\s+packageMirrorSelectionExplicit = previousExplicit;/,
  'the project package mirror must not become a permanent user choice');
assert.match(parser, /PROJECT_FIRMWARE/);
assert.match(parser, /loadProjectConfiguration/,
  'the Worker must use the foundation project configuration loader');
assert.match(parser, /'site', 'wrt', 'config', 'site\.json'/,
  'the Worker loader must be rooted at the checked-out public site config');
assert.match(parser, /'config', 'build\.json'/,
  'the Worker loader must include the root build config');
assert.doesNotMatch(parser, /site[\\/]wrt[\\/]data[\\/]project\.json/,
  'the Worker must not consume the generated browser projection');
assert.match(parser, /PROJECT_DEFAULT_TAG/,
  'the public site config owns the default build tag');
assert.match(parser, /PROJECT_BUILD_PASSWORD/,
  'the root build config owns password policy');
assert.match(parser, /PROJECT_BUILD_JOBS/,
  'the root build config owns job policy');
assert.match(parser, /PROJECT_BUILD_JOBS\.compile/,
  'the root build config compile key must feed the Worker');
assert.match(parser, /PROJECT_BUILD_JOBS\.download/,
  'the root build config download key must feed the Worker');
assert.doesNotMatch(parser, /PROJECT_BUILD_JOBS\.(compileJobs|downloadJobs)/,
  'legacy job keys must not be silently accepted');
assert.doesNotMatch(parser, /PROJECT_FIRMWARE\.password/,
  'the public site config must not control password policy');
assert.doesNotMatch(parser, /PROJECT_SITE_BUILD\.(compileJobs|downloadJobs)/,
  'the public site config must not control job policy');
assert.match(parser, /own\(req, 'lanip'\)/,
  'omitted LAN IP must use the project default while explicit input remains distinct');
assert.match(parser, /project build job policy must be auto or an integer/,
  'invalid generated job policy must fail closed');
assert.match(parser, /Number\.isInteger\(value\)/,
  'generated job policy must reject numeric strings');
assert.match(parser, /Firmware theme is outside the current Catalog\/Kconfig scope/,
  'explicit unavailable themes must fail closed');
assert.match(admission, /loadProjectConfiguration/,
  'admission must use the foundation project configuration loader');
assert.match(admission, /PROJECT_BUILD\.admission\.publicActiveBuilds/,
  'admission must read its limit from the root build config');
assert.doesNotMatch(admission, /site[\\/]wrt[\\/]data[\\/]project\.json/,
  'admission must not consume the generated browser projection');
assert.doesNotMatch(controller, /config[\\/]build\.json|compileJobs|downloadJobs|publicActiveBuilds/,
  'the browser must not consume root build policy');

const initializeTimezoneSource = workspace.match(/function initializeTimezone\(\) \{[\s\S]*?\n\}/)?.[0] || '';
assert.match(workspace, /function browserTimezone\(\)/,
  'timezone initialization must have a browser detection helper');
assert.match(initializeTimezoneSource, /const saved = localStorage\.getItem\('wrt_timezone'\) \|\| '';/);
assert.match(initializeTimezoneSource, /const detected = browserTimezone\(\);/);
assert.match(initializeTimezoneSource, /state\.timezone = \[saved, detected, equivalent, 'Etc\/GMT'\]/,
  'timezone fallback order must remain saved, exact browser, same offset, then Etc\/GMT');

const initializeTimezone = Function(
  'TIMEZONES', 'state', 'localStorage', 'browserTimezone', 'timezoneOffset',
  `return ${initializeTimezoneSource}`,
);
const resolveInitialTimezone = ({ saved = '', detected = '', zones, offsets = {} }) => {
  const state = { timezone: '' };
  const storage = { getItem: (key) => key === 'wrt_timezone' ? saved : null };
  const browser = () => detected;
  const offset = (name) => offsets[name] || '+00:00';
  initializeTimezone({ zones }, state, storage, browser, offset)();
  return state.timezone;
};
const timezoneRows = (names) => names.map((zonename) => ({ zonename }));
assert.equal(resolveInitialTimezone({
  saved: 'Saved/Zone', detected: 'Browser/Zone',
  zones: timezoneRows(['Saved/Zone', 'Browser/Zone', 'Etc/GMT']),
}), 'Saved/Zone', 'saved timezone must take precedence over browser detection');
assert.equal(resolveInitialTimezone({
  saved: 'Missing/Zone', detected: 'Browser/Zone',
  zones: timezoneRows(['Browser/Zone', 'Same/Offset', 'Etc/GMT']),
}), 'Browser/Zone', 'an exact browser timezone must beat same-offset fallback');
assert.equal(resolveInitialTimezone({
  saved: 'Missing/Zone', detected: 'Browser/Zone',
  zones: timezoneRows(['Same/Offset', 'Etc/GMT']),
  offsets: { 'Browser/Zone': '+08:00', 'Same/Offset': '+08:00' },
}), 'Same/Offset', 'same-offset timezone must be selected when exact browser zone is unavailable');
assert.equal(resolveInitialTimezone({
  saved: 'Missing/Zone', detected: 'Unknown/Zone',
  zones: timezoneRows(['Asia/Shanghai', 'Etc/GMT']),
  offsets: { 'Unknown/Zone': '+09:00', 'Asia/Shanghai': '+08:00', 'Etc/GMT': '+00:00' },
}), 'Etc/GMT', 'Etc/GMT must be the final named timezone fallback');
assert.match(workflow, /DEFAULT_ROOT_PASSWORD: \$\{\{ secrets\.DEFAULT_ROOT_PASSWORD \}\}/);
assert.match(workflow, /::add-mask::\$RPW/);
assert.match(workflow, /printf '%s' "\$RPW" \| openssl passwd -6 -stdin/,
  'passwords must be hashed from stdin on the runner');
assert.match(workflow, /ROOT_HASH/);
assert.match(workflow, /sed -i 's\|\^root:\[\^:\]\*:\|root:\$\{ROOT_HASH\}:\|'/,
  'the generated init script must only contain a hash');
assert.doesNotMatch(workflow, /printf[^\n]*\$RPW[^\n]*passwd root/,
  'the generated init script must not format the plaintext password');
assert.match(workflow, /steps\.req\.outputs\.compile_jobs/);
assert.match(workflow, /steps\.req\.outputs\.download_jobs/);

console.log('Project customization runtime contracts passed.');
