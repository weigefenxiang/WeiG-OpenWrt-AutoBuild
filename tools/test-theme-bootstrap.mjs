#!/usr/bin/env node
// Theme bootstrap regression: first-paint theme must match saved light/dark or system preference before release assets load.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(ROOT, 'site', 'wrt', 'index.html');
const PACKAGES = join(ROOT, 'site', 'wrt', 'packages.html');
const START = '<!-- WEIG_THEME_BOOTSTRAP_START -->';
const END = '<!-- WEIG_THEME_BOOTSTRAP_END -->';

function extractBlock(source, path) {
  const start = source.indexOf(START);
  const end = source.indexOf(END, start + START.length);
  if (start < 0 || end < 0) throw new Error(`Theme bootstrap markers missing: ${path}`);
  return source.slice(start, end + END.length);
}

function extractScript(block) {
  const match = block.match(/<script data-theme-bootstrap>\n([\s\S]*?)\n<\/script>/);
  if (!match) throw new Error('Theme bootstrap script missing');
  return match[1];
}

const indexSource = readFileSync(INDEX, 'utf8');
const packageSource = readFileSync(PACKAGES, 'utf8');
const indexBlock = extractBlock(indexSource, INDEX);
const packageBlock = extractBlock(packageSource, PACKAGES);
if (indexBlock !== packageBlock) throw new Error('index.html and packages.html theme bootstrap blocks differ');
if (indexSource.indexOf(START) > indexSource.indexOf("new URL('data/site-version.json', document.baseURI)")) {
  throw new Error('index.html theme bootstrap runs after the release pointer bootstrap');
}
if (packageSource.indexOf(START) > packageSource.indexOf("new URL('data/site-version.json',document.baseURI)")) {
  throw new Error('packages.html theme bootstrap runs after the release pointer bootstrap');
}

const bootstrapScript = extractScript(indexBlock);
const LIGHT = '#f5f6f8';
const DARK = '#11151c';

function runFixture({ saved = null, systemDark = false }) {
  const dataset = {};
  const style = {};
  const root = {
    dataset,
    style,
    removeAttribute(name) { if (name === 'data-theme') delete dataset.theme; },
  };
  const themeColor = {
    content: LIGHT,
    setAttribute(name, value) { if (name === 'content') this.content = value; },
  };
  let changeListener = null;
  const media = {
    matches: systemDark,
    addEventListener(type, listener) { if (type === 'change') changeListener = listener; },
  };
  const context = {
    document: {
      documentElement: root,
      getElementById(id) { return id === 'themeColor' ? themeColor : null; },
    },
    localStorage: { getItem(key) { return key === 'wrt_theme' ? saved : null; } },
    matchMedia(query) {
      if (query !== '(prefers-color-scheme: dark)') throw new Error(`Unexpected media query: ${query}`);
      return media;
    },
    console,
  };
  runInNewContext(bootstrapScript, context, { filename: 'theme-bootstrap.inline.js' });
  return {
    dataset,
    style,
    themeColor,
    media,
    triggerSystem(dark) {
      media.matches = dark;
      changeListener?.({ matches: dark });
    },
    apply(mode) { return context.__WEIG_APPLY_THEME__(mode); },
  };
}

const cases = [
  { name: 'auto + system light', saved: null, systemDark: false, theme: undefined, bg: LIGHT, scheme: 'light' },
  { name: 'auto + system dark', saved: null, systemDark: true, theme: undefined, bg: DARK, scheme: 'dark' },
  { name: 'saved light overrides system dark', saved: 'light', systemDark: true, theme: 'light', bg: LIGHT, scheme: 'light' },
  { name: 'saved dark overrides system light', saved: 'dark', systemDark: false, theme: 'dark', bg: DARK, scheme: 'dark' },
  { name: 'invalid saved value falls back to auto', saved: 'invalid', systemDark: true, theme: undefined, bg: DARK, scheme: 'dark' },
];

for (const item of cases) {
  const fixture = runFixture(item);
  if (fixture.dataset.theme !== item.theme || fixture.style.backgroundColor !== item.bg ||
      fixture.style.colorScheme !== item.scheme || fixture.themeColor.content !== item.bg) {
    throw new Error(`${item.name}: theme bootstrap resolved incorrectly`);
  }
  console.log(`PASS ${item.name}`);
}

const auto = runFixture({ systemDark: false });
auto.triggerSystem(true);
if (auto.dataset.theme !== undefined || auto.style.backgroundColor !== DARK ||
    auto.style.colorScheme !== 'dark' || auto.themeColor.content !== DARK) {
  throw new Error('auto mode did not follow a live system dark-mode change');
}
auto.triggerSystem(false);
if (auto.style.backgroundColor !== LIGHT || auto.style.colorScheme !== 'light' || auto.themeColor.content !== LIGHT) {
  throw new Error('auto mode did not follow a live system light-mode change');
}
console.log('PASS auto follows live system changes');

const manual = runFixture({ saved: 'dark', systemDark: false });
manual.triggerSystem(true);
manual.triggerSystem(false);
if (manual.dataset.theme !== 'dark' || manual.style.backgroundColor !== DARK || manual.style.colorScheme !== 'dark') {
  throw new Error('manual dark mode was overwritten by system changes');
}
manual.apply('light');
if (manual.dataset.theme !== 'light' || manual.style.backgroundColor !== LIGHT || manual.style.colorScheme !== 'light') {
  throw new Error('shared apply helper failed to switch to light mode');
}
console.log('PASS manual mode stays authoritative and shared apply helper switches modes');

if (!packageSource.includes('html[data-theme="dark"]{') ||
    !packageSource.includes('@media (prefers-color-scheme:dark){html:not([data-theme]){')) {
  throw new Error('packages.html full theme CSS does not preserve manual light/dark overrides');
}
console.log('PASS package page full CSS uses the same tri-state theme semantics');
