#!/usr/bin/env node
// Contract test for the semantic stylesheet source and generated runtime CSS.

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const modules = [
  '00-tokens.css',
  '10-foundation.css',
  '20-layout.css',
  '30-components.css',
  '40-overlays.css',
  '50-responsive.css',
];
const fail = (message) => {
  throw new Error(message);
};

const result = spawnSync(process.execPath, [join(ROOT, 'tools', 'gen-site-css.mjs'), '--check'], {
  cwd: ROOT,
  encoding: 'utf8',
  shell: false,
});
if (result.status !== 0) fail(String(result.stderr || result.stdout || 'stylesheet generator check failed').trim());

const output = readFileSync(join(ROOT, 'site', 'wrt', 'app.css'), 'utf8');
const header = output.split(/\r?\n/).slice(0, 5).join('\n');
if (!header.startsWith('/* GENERATED FILE — DO NOT EDIT DIRECTLY.')) fail('generated header is missing');
for (const name of modules) if (!header.includes(`site/wrt/styles/${name}`)) fail(`generated header omits ${name}`);

const tokens = readFileSync(join(ROOT, 'site', 'wrt', 'styles', modules[0]), 'utf8');
for (const token of ['--font-page-title: 32px', '--font-section-title: 24px', '--font-item-title: 20px',
  '--font-body: 18px', '--font-description: 17px', '--font-meta: 15px', '--font-badge: 14px',
  '--z-sticky:', '--z-dropdown:', '--z-dock:', '--z-floating:', '--z-toast:', '--z-modal:', '--z-tooltip:']) {
  if (!tokens.includes(token)) fail(`token contract missing ${token}`);
}

if (/^\.toast\s*\{/m.test(output)) fail('generic toast presentation remains in generated app.css');
if (/z-index:\s*\d+/.test(output)) fail('generated CSS contains a numeric z-index outside the layer token contract');
if (output.includes('.modal.package-probe') || /\.probe-[A-Za-z]/.test(output)) {
  fail('Probe presentation must remain in the lazy package-probe-v3.css authority');
}
if (!output.includes('env(safe-area-inset-bottom)')) fail('safe-area contract is missing');

console.log(`OK: generated app.css uses ${modules.length} semantic modules and shared overlay guards`);
