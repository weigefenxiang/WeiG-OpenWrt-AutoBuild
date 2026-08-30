#!/usr/bin/env node
// Deterministically assemble the public page stylesheet from its semantic source modules.
// This tool never stages, commits, or pushes Git changes.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STYLE_DIR = join(ROOT, 'site', 'wrt', 'styles');
const OUTPUT = join(ROOT, 'site', 'wrt', 'app.css');
const MODULES = [
  '00-tokens.css',
  '10-foundation.css',
  '20-layout.css',
  '30-components.css',
  '40-overlays.css',
  '50-responsive.css',
];
const HEADER = `/* GENERATED FILE — DO NOT EDIT DIRECTLY.\n * Source modules: site/wrt/styles/${MODULES.join(', site/wrt/styles/')}\n * Generate with: node tools/gen-site-css.mjs\n */`;
const args = new Set(process.argv.slice(2));
const check = args.has('--check');
const help = args.has('--help') || args.has('-h');

if (help) {
  console.log('Usage: node tools/gen-site-css.mjs [--check]');
  process.exit(0);
}

function sourceText(name) {
  const path = join(STYLE_DIR, name);
  if (!existsSync(path)) throw new Error(`Missing stylesheet module: ${path}`);
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '').replace(/\s+$/, '');
  if (!text) throw new Error(`Stylesheet module is empty: ${path}`);
  if (/^\/\* GENERATED FILE/m.test(text)) throw new Error(`Generated output cannot be a source module: ${name}`);
  return text;
}

function generatedText() {
  return `${HEADER}\n\n${MODULES.map(sourceText).join('\n\n')}\n`;
}

const expected = generatedText();
if (check) {
  if (!existsSync(OUTPUT)) throw new Error(`Generated stylesheet is missing: ${OUTPUT}`);
  const actual = readFileSync(OUTPUT, 'utf8');
  if (actual !== expected) {
    console.error(`Generated stylesheet is stale: ${OUTPUT}`);
    process.exit(1);
  }
  console.log(`OK: ${OUTPUT} matches ${MODULES.length} source modules`);
} else {
  mkdirSync(STYLE_DIR, { recursive: true });
  writeFileSync(OUTPUT, expected, 'utf8');
  console.log(`Generated ${OUTPUT} from ${MODULES.length} source modules`);
}
