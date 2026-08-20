import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { readFrontendRuntimeSource } from './lib/frontend-source.mjs';

const root = path.resolve(import.meta.dirname, '..');
const buildIdentityText = fs.readFileSync(path.join(root, 'site/wrt/lib/build-identity.js'), 'utf8');
const probeCoreText = fs.readFileSync(path.join(root, 'site/wrt/lib/package-probe-v3-core.js'), 'utf8');
const probeText = probeCoreText + '\n' +
  fs.readFileSync(path.join(root, 'site/wrt/lib/package-probe-v3-ui.js'), 'utf8');
const probeCss = fs.readFileSync(path.join(root, 'site/wrt/package-probe-v3.css'), 'utf8');
const appCss = fs.readFileSync(path.join(root, 'site/wrt/app.css'), 'utf8');
const feedbackText = fs.readFileSync(path.join(root, 'site/wrt/lib/ui-feedback.js'), 'utf8');
const appText = readFrontendRuntimeSource(root);
const indexText = fs.readFileSync(path.join(root, 'site/wrt/index.html'), 'utf8');
const feedbackCss = fs.readFileSync(path.join(root, 'site/wrt/ui-feedback.css'), 'utf8');

assert.match(buildIdentityText, /package-probe-v3-core\.js/, 'startup gate must load Probe V3 core');
assert.match(buildIdentityText, /package-probe-v3-ui\.js/, 'startup gate must load Probe V3 UI');
assert.match(probeText, /WEIG_PACKAGE_PROBE_STATE_V3:/, 'Probe must emit V3 state tokens');
assert.match(probeText, /baselinePackageConfig/, 'Probe must preserve current Profile baseline state for UI evidence');
assert.match(probeText, /packageIntent/, 'Probe must preserve direct user intent');
assert.match(probeText, /environmentScope/, 'Probe must send five-dimensional environment constraints');
const expectedDepthModes = [
  'config-resolve', 'package-compile', 'rootfs-integration', 'firmware-integration',
  'boot-smoke', 'runtime-health', 'reboot-validation',
];
const probeContext = { catalogApplicationsDocument: null, state: { lang: 'zh-CN' }, t: (key) => key };
vm.runInNewContext(`${probeCoreText}\nglobalThis.__depthOptions = PROBE_V3_DEPTH_OPTIONS; globalThis.__requestConfigs = probeV3RequestPackageConfigs; globalThis.__uiText = probeV3UiText;`, probeContext);
assert.deepEqual(JSON.parse(JSON.stringify(probeContext.__depthOptions.map((option) => option.mode))), expectedDepthModes,
  'Probe depth order must match the Catalog L1-L7 controller contract');
assert.deepEqual(JSON.parse(JSON.stringify(probeContext.__depthOptions.map((option) => probeContext.__uiText(option.shortKey)))),
  ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'],
  'missing Catalog depth copy must degrade to protocol labels without a second description database');
const intent = [{ package: 'example', before: 'n', after: 'y' }];
assert.deepEqual(JSON.parse(JSON.stringify(probeContext.__requestConfigs('config-resolve', 'CONFIG_PACKAGE_base=y\n', 'CONFIG_PACKAGE_final=y\n', intent))), {
  baselinePackageConfig: '', packageConfig: 'CONFIG_PACKAGE_example=y\n',
}, 'L1 must send only direct package roots for each target Kconfig resolver');
assert.deepEqual(JSON.parse(JSON.stringify(probeContext.__requestConfigs('rootfs-integration', 'CONFIG_PACKAGE_base=y\n', 'CONFIG_PACKAGE_final=y\n', intent))), {
  baselinePackageConfig: 'CONFIG_PACKAGE_base=y\n', packageConfig: 'CONFIG_PACKAGE_final=y\n',
}, 'L2-L7 must send the complete Baseline and Final PACKAGE state');
assert.match(probeText, /mode:\s*selectedProbeDepth\.mode/, 'selected L1-L7 mode must be submitted');
assert.match(probeText, /useDefconfig:\s*true/, 'Probe must preserve the approved Defconfig request default');
assert.match(probeText, /coverage:\s*coverageMode === 'all'/, 'every depth must send backend coverage controls');
assert.match(probeText, /autoLimit\.value = '40'/, 'the existing explicit environment budget must remain stable across depth changes');
assert.match(probeText, /sources:/, 'Probe scope must include Source');
assert.match(probeText, /branches:/, 'Probe scope must include Branch');
assert.match(probeText, /targetSystems:/, 'Probe scope must include Target System');
assert.match(probeText, /subtargets:/, 'Probe scope must include Subtarget');
assert.match(probeText, /profiles:/, 'Probe scope must include Target Profile');
assert.match(probeText, /function probeV3ScopeOptionMaps\(\)/,
  'Probe must build lightweight scope choices from already loaded Catalog state');
assert.match(probeText, /MENU_INDEX\?\.sources/, 'Source and Branch choices must reuse the loaded index');
assert.match(probeText, /MENU_CATALOG\?\.targets/, 'Target choices must reuse the current loaded Catalog core');
assert.doesNotMatch(probeText, /function probeV3EnvironmentUniverse|probeV3EnvironmentUniverse\(/,
  'L1 must not preload a second cross-Source Target/Profile universe');
assert.doesNotMatch(probeText, /CATALOG_LOADER\.fetchCore\(/,
  'L1 scope UI must not fetch every Source/Branch core into browser memory');
assert.match(probeText, /sourceId\.toLowerCase\(\) === 'hanwckf'/,
  'hanwckf must be excluded from Probe scope');
assert.match(probeText, /removeEventListener\('click', openPackageProbeModal\)/,
  'Probe V3 must replace, rather than duplicate, the legacy Probe launcher');
assert.match(probeText, /menuSearchOptions[\s\S]*?menuOptionTranslation/,
  'Probe package choices and descriptions must reuse current Advanced menuconfig state');
assert.match(probeText, /menuOptionBySymbol\.get\(`PACKAGE_\$\{row\.package\}`\)[\s\S]*?menuOptionTranslation\(option\)/,
  'linked dependency descriptions must reuse the current menu option objects');
assert.match(probeText, /bindUiTooltipContent\(row, \{ body: rowDetails \}\)/,
  'Probe package descriptions must reuse the shared tooltip template');
assert.match(probeText, /for \(const option of PROBE_V3_DEPTH_OPTIONS\)/,
  'Probe depth buttons must be rendered from one seven-level interface contract');
assert.match(probeText, /bindUiTooltipContent\(button, \{ title: shortText, body: `\$\{titleText\}\\n\$\{helpText\}` \}\)/,
  'Probe depth buttons must reuse the shared tooltip with short, full, and help text');
assert.match(appCss, /\.ui-tooltip-body\s*\{[^}]*white-space:\s*pre-line/,
  'the shared tooltip must preserve the full-title/help line break');
assert.match(probeText, /button\.setAttribute\('aria-pressed', String\(selected\)\)/,
  'Probe depth selection must expose pressed state to assistive technology');
assert.match(probeText, /selectedProbeDepth = option;[\s\S]*?renderSelectedProbeDepth\(\);[\s\S]*?refreshRequestPreview\(\);/,
  'changing depth must refresh only the request snapshot');
assert.doesNotMatch(probeText, /probe-depth-tooltip|showMenuPopup|probeTextIsTruncated/,
  'Probe V3 retained an independent tooltip implementation');
assert.doesNotMatch(probeCss, /\.probe-depth-tooltip/,
  'Probe V3 retained independent tooltip presentation CSS');
assert.doesNotMatch(probeText, /openvpn-openssl|luci-app-openvpn-server/,
  'Probe V3 must not hardcode package special cases');
assert.match(probeCss, /\.probe-accordion-triggers\s*\{[^}]*repeat\(2/,
  'Probe keeps only the two lightweight optional detail entry points');
assert.match(probeCss, /\.probe-depth\s*\{[^}]*display:\s*flex[^}]*overflow-x:\s*auto/,
  'seven short depth buttons must stay on one horizontally scrollable row');
assert.match(probeCss, /\.probe-depth-option\s*\{[^}]*white-space:\s*nowrap/,
  'depth button labels must never wrap');
assert.match(probeCss, /\.probe-depth-option\.is-selected\s*\{/,
  'the selected depth needs a distinct presentation state');
assert.doesNotMatch(probeCss, /\.probe-depth-row\s*\{[^}]*flex-wrap/,
  'responsive layouts must not move depth buttons onto another row');
assert.doesNotMatch(probeCss, /\.probe-depth-title\s*\{[^}]*font-size:\s*0|\.probe-depth-title::after/,
  'responsive layouts must keep the real Catalog short label visible');
assert.match(probeCss, /\.probe-environment-row\s*\{[^}]*grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\)/,
  'environment heading and five dimensions should share one desktop row');
assert.match(probeCss, /\.probe-filter-grid\s*\{[^}]*\.9fr[^}]*1\.35fr/,
  'desktop environment dimensions should share the row with adaptive widths');
assert.match(probeCss, /@media \(max-width:\s*1000px\)[\s\S]*?\.probe-filter-grid\s*\{[^}]*repeat\(6[\s\S]*?nth-child\(4\)[^}]*span 3/,
  'medium layouts should use a balanced 3+2 environment grid');
assert.match(probeCss, /@media \(max-width:\s*760px\)[\s\S]*?\.probe-filter-grid\s*\{[^}]*grid-template-columns:\s*1fr/,
  'mobile environment dimensions should collapse to one column');
assert.doesNotMatch(probeText, /fullWidth|is-wide/,
  'Target Profile must not retain a full-width special case');
assert.doesNotMatch(probeCss, /\.probe-multiselect-field\.is-wide/,
  'obsolete full-width Profile CSS must be removed');
assert.doesNotMatch(probeText, /matchCount|currentMatches|coverageSnapshotCache|environmentSnapshotRevision/,
  'L1 UI must not expose or cache a browser-expanded environment count');
const accordionBlock = probeText.match(/const setAccordion = \(mode\) => \{[\s\S]*?\n    \};/)?.[0] || '';
assert.match(accordionBlock, /renderAccordionSnapshot\(\)/,
  'accordion toggles must render from the latest snapshot');
assert.doesNotMatch(accordionBlock, /renderPreview\(/,
  'accordion toggles must not regenerate the Probe request or Kconfig state');
assert.match(probeText, /packageSnapshotRevision === packageRevision/,
  'package config generation must be revision-gated');
assert.match(probeText, /autoLimitTimer = setTimeout\(\(\) => refreshRequestPreview\(\), 150\)/,
  'environment limit input must debounce request refreshes');
assert.match(probeText, /recordIntent\(option\); renderResults\(\); refreshPackagePreview\(\)/,
  'package changes must explicitly invalidate the package snapshot');
assert.match(probeText, /selected\.clear\(\); selected\.add\('\*'\); refresh\(\); refreshEnvironmentPreview\(\)/,
  'environment changes must update only the lightweight request snapshot');
assert.match(probeText, /createFloatingLayerController\(summary, panel/,
  'Probe dropdowns must reuse the shared floating-layer controller');
assert.match(feedbackText, /globalThis\.createFloatingLayerController/,
  'shared UI layer must expose one reusable floating-layer controller');
assert.match(feedbackText, /const inferredDropdown = anchor\.matches\('summary'\)[\s\S]*?const preset = options\.preset \|\| \(inferredDropdown \? 'dropdown' : 'floating'\)/,
  'shared floating layers must infer dropdown semantics while preserving an explicit generic override');
assert.match(feedbackText, /options\.boundary[\s\S]*?anchor\.closest\('\[data-floating-boundary\]'\)[\s\S]*?anchor\.closest\('\.modal'\)/,
  'shared dropdowns must resolve an explicit or nearest-container boundary');
assert.match(feedbackText, /naturalLayerWidth[\s\S]*?max-content[\s\S]*?scrollWidth/,
  'shared dropdowns must measure their content before choosing a width');
assert.match(feedbackText, /boundaryRight - width/,
  'shared dropdowns must shift left when their content would cross the right boundary');
assert.match(feedbackText, /ui-floating-dropdown/,
  'shared dropdowns must expose one presentation hook for dropdown-specific CSS');
assert.match(indexText, /id="catalogLocator"[\s\S]*?aria-controls="catalogLocatorResults"[\s\S]*?data-floating-dropdown/,
  'Catalog locator results must declare the shared dropdown placement policy');
assert.match(indexText, /id="timezoneBox"[\s\S]*?aria-controls="timezoneMenu"[\s\S]*?data-floating-dropdown/,
  'Timezone search results must declare the shared dropdown placement policy');
assert.match(indexText, /id="deviceStep"[^>]*data-floating-boundary/,
  'Target selection must declare the boundary shared by its custom dropdowns');
assert.match(feedbackText, /\[data-floating-dropdown\]\[aria-controls\]/,
  'shared UI layer must auto-bind declarative dropdowns');
assert.match(feedbackText, /portal:\s*false/,
  'legacy in-page dropdowns must keep their DOM ancestry while using fixed placement');
assert.match(feedbackCss, /\.ui-floating-dropdown[\s\S]*?overflow-wrap:\s*anywhere/,
  'shared dropdown presentation must allow long content to wrap at its boundary');
assert.match(probeCss, /\.probe-multiselect-option span\s*\{[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/,
  'Probe dropdown labels must wrap instead of truncating at the boundary');
assert.doesNotMatch(probeCss, /\.probe-multiselect-option span\s*\{[^}]*text-overflow:\s*ellipsis/,
  'Probe dropdown labels must not retain ellipsis truncation');
assert.match(feedbackText, /MutationObserver/,
  'floating layers must close when their owner modal is dismissed');
assert.match(feedbackText, /modalMask\.addEventListener\('dblclick'/,
  'shared UI adapter must require a backdrop double-click for pointer dismissal');
assert.match(feedbackText, /stopImmediatePropagation\(\)/,
  'shared UI adapter must suppress the legacy single-click backdrop fallback');
assert.match(appText, /addEventListener\('click', openPackageProbeModal\)/,
  'base app.js must retain the legacy launcher that the V3 adapter replaces');

console.log('Package Probe V3 UI contract passed.');
