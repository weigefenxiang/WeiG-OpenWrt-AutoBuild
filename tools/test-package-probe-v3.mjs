import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const buildIdentityText = fs.readFileSync(path.join(root, 'site/wrt/lib/build-identity.js'), 'utf8');
const probeText = fs.readFileSync(path.join(root, 'site/wrt/lib/package-probe-v3-core.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(root, 'site/wrt/lib/package-probe-v3-ui.js'), 'utf8');
const probeCss = fs.readFileSync(path.join(root, 'site/wrt/package-probe-v3.css'), 'utf8');
const feedbackText = fs.readFileSync(path.join(root, 'site/wrt/lib/ui-feedback.js'), 'utf8');
const appText = fs.readFileSync(path.join(root, 'site/wrt/app.js'), 'utf8');

assert.match(buildIdentityText, /package-probe-v3-core\.js/, 'startup gate must load Probe V3 core');
assert.match(buildIdentityText, /package-probe-v3-ui\.js/, 'startup gate must load Probe V3 UI');
assert.match(probeText, /WEIG_PACKAGE_PROBE_STATE_V3:/, 'Probe must emit V3 state tokens');
assert.match(probeText, /baselinePackageConfig/, 'Probe must send the Baseline package state');
assert.match(probeText, /packageIntent/, 'Probe must preserve direct user intent');
assert.match(probeText, /environmentScope/, 'Probe must send five-dimensional environment constraints');
assert.match(probeText, /useDefconfig/, 'Probe must expose Defconfig as an independent control');
assert.match(probeText, /\n\s*coverage,/, 'Probe must send coverage controls');
assert.match(probeText, /sources:/, 'Probe scope must include Source');
assert.match(probeText, /branches:/, 'Probe scope must include Branch');
assert.match(probeText, /targetSystems:/, 'Probe scope must include Target System');
assert.match(probeText, /subtargets:/, 'Probe scope must include Subtarget');
assert.match(probeText, /profiles:/, 'Probe scope must include Target Profile');
assert.match(probeText, /fetchCore\(/, 'cross-Source/Branch scope must reuse the Catalog core loader');
assert.match(probeText, /removeEventListener\('click', openPackageProbeModal\)/,
  'Probe V3 must replace, rather than duplicate, the legacy Probe launcher');
assert.doesNotMatch(probeText, /openvpn-openssl|luci-app-openvpn-server|ImmortalWrt|OpenWrt|LEDE|hanwckf/,
  'Probe V3 must not hardcode package or Source special cases');
assert.match(probeCss, /\.probe-accordion-triggers\s*\{[^}]*repeat\(3/,
  'the three optional detail entry points must remain on one row');
assert.match(probeCss, /\.probe-depth\s*\{[^}]*repeat\(4/,
  'L1-L4 must remain on one row on desktop');
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
const accordionBlock = probeText.match(/const setAccordion = \(mode\) => \{[\s\S]*?\n    \};/)?.[0] || '';
assert.match(accordionBlock, /renderAccordionSnapshot\(\)/,
  'accordion toggles must render from the latest snapshot');
assert.doesNotMatch(accordionBlock, /renderPreview\(/,
  'accordion toggles must not regenerate the Probe request or Kconfig state');
assert.match(probeText, /let packageRevision = 0;[\s\S]*?let environmentRevision = 0;[\s\S]*?const coverageSnapshotCache = new Map\(\)/,
  'Probe must separate package, environment and coverage-derived state');
assert.match(probeText, /packageSnapshotRevision === packageRevision/,
  'package config generation must be revision-gated');
assert.match(probeText, /environmentSnapshotRevision !== environmentRevision/,
  'environment filtering must be revision-gated');
assert.match(probeText, /coverageSnapshotCache\.has\(key\)[\s\S]*?coverageSnapshotCache\.set\(key, snapshot\)/,
  'Auto coverage estimates must reuse a keyed derived snapshot');
assert.match(probeText, /autoLimitTimer = setTimeout\(\(\) => refreshRequestPreview\(\), 150\)/,
  'Auto coverage limit input must debounce request refreshes');
assert.match(probeText, /defconfigInput\.addEventListener\('change', refreshRequestPreview\)/,
  'Defconfig changes must not regenerate package Kconfig state');
assert.match(probeText, /recordIntent\(option\); renderResults\(\); refreshPackagePreview\(\)/,
  'package changes must explicitly invalidate the package snapshot');
assert.match(probeText, /selected\.clear\(\); selected\.add\('\*'\); refresh\(\); refreshEnvironmentPreview\(\)/,
  'environment changes must invalidate only the environment snapshot');
assert.match(probeText, /createFloatingLayerController\(summary, panel/,
  'Probe dropdowns must reuse the shared floating-layer controller');
assert.match(feedbackText, /globalThis\.createFloatingLayerController/,
  'shared UI layer must expose one reusable floating-layer controller');
assert.match(feedbackText, /MutationObserver/,
  'floating layers must close when their owner modal is dismissed');
assert.match(feedbackText, /modalMask\.addEventListener\('dblclick'/,
  'shared UI adapter must require a backdrop double-click for pointer dismissal');
assert.match(feedbackText, /stopImmediatePropagation\(\)/,
  'shared UI adapter must suppress the legacy single-click backdrop fallback');
assert.match(appText, /addEventListener\('click', openPackageProbeModal\)/,
  'base app.js must retain the legacy launcher that the V3 adapter replaces');

console.log('Package Probe V3 UI contract passed.');
