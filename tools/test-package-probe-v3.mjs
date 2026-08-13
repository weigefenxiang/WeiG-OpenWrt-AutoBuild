import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const buildIdentityText = fs.readFileSync(path.join(root, 'site/wrt/lib/build-identity.js'), 'utf8');
const probeText = fs.readFileSync(path.join(root, 'site/wrt/lib/package-probe-v3-core.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(root, 'site/wrt/lib/package-probe-v3-ui.js'), 'utf8');
const probeCss = fs.readFileSync(path.join(root, 'site/wrt/package-probe-v3.css'), 'utf8');
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
assert.match(probeCss, /\.probe-filter-grid\s*\{[^}]*repeat\(2/,
  'environment selectors should use a spacious two-column desktop layout');
assert.match(appText, /addEventListener\('click', openPackageProbeModal\)/,
  'base app.js must retain the legacy launcher that the V3 adapter replaces');

console.log('Package Probe V3 UI contract passed.');
