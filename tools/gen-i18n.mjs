#!/usr/bin/env node
// Generates one deterministic gzip bundle per locale from the shared translation authorities.
// --check verifies without writing. Explicit fallback entries never claim translated assets.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { feedbackIssueForm } from '../site/wrt/lib/feedback.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = JSON.parse(readFileSync(join(ROOT, 'tools/i18n-source.json'), 'utf8'));
const LOCALES = JSON.parse(readFileSync(join(ROOT, 'tools/i18n-locales.json'), 'utf8'));
const CHECK_ONLY = process.argv.includes('--check');
const keys = Object.keys(SRC.strings);
const placeholder = value => (value.match(/\{(\w+)\}/g) || []).sort().join(',');
const errors = [];
const documents = new Map();
const ids = new Set();
for (const locale of LOCALES.languages) {
  if (!/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(locale.id) || ids.has(locale.id)) {
    errors.push('Invalid/duplicate locale: ' + locale.id);
  }
  ids.add(locale.id);
  if (!locale.name || !locale.native || !['ltr', 'rtl'].includes(locale.dir) || typeof locale.common !== 'boolean') {
    errors.push('Incomplete locale metadata: ' + locale.id);
  }
  if (locale.fallbackTo) {
    const target = LOCALES.languages.find(entry => entry.id === locale.fallbackTo);
    if (!target || target.fallbackTo || target.id === locale.id) errors.push('Invalid locale fallback: ' + locale.id);
    continue;
  }
  const translationPath = join(ROOT, 'tools/i18n-translations', locale.id + '.json');
  const translated = locale.id === LOCALES.source ? SRC.strings :
    existsSync(translationPath) ? JSON.parse(readFileSync(translationPath, 'utf8')) : {};
  const strings = {};
  if (Object.keys(translated).length !== keys.length || Object.keys(translated).some(key => !keys.includes(key))) {
    errors.push(locale.id + ': source key set differs');
  }
  for (const key of keys) {
    const value = translated?.[key];
    if (typeof value !== 'string' || !value.trim()) {
      errors.push(locale.id + ': missing ' + key);
    } else if (placeholder(value) !== placeholder(SRC.strings[key])) {
      errors.push(locale.id + ': placeholder mismatch ' + key);
    } else {
      strings[key] = value;
    }
  }
  documents.set(locale.id, { version: 2, language: locale.id, strings });
}
if (!ids.has(LOCALES.source) || !ids.has(LOCALES.fallback) || !ids.has(LOCALES.reference)) {
  errors.push('Source, fallback and semantic reference must exist in the locale registry');
}
if (errors.length) {
  console.error('Localization validation failed (' + errors.length + ' errors):\n' + errors.slice(0, 40).join('\n'));
  process.exit(1);
}

const artifacts = new Map();
const manifest = {
  version: 3, source: LOCALES.source, reference: LOCALES.reference,
  fallback: LOCALES.fallback, stringCount: keys.length, languages: [],
};
for (const locale of LOCALES.languages) {
  if (locale.fallbackTo) {
    manifest.languages.push({ ...locale });
    continue;
  }
  const bytes = Buffer.from(JSON.stringify(documents.get(locale.id)) + '\n');
  const gzip = gzipSync(bytes, { level: 9 });
  // Fix the OS marker too, so the checked-in gzip is byte-identical on Windows/Linux.
  gzip[9] = 255;
  const file = locale.id + '.json.gz';
  artifacts.set('site/wrt/data/i18n/' + file, gzip);
  manifest.languages.push({
    ...locale, file, bytes: gzip.length, decodedBytes: bytes.length,
    sha256: createHash('sha256').update(gzip).digest('hex'),
  });
}
artifacts.set('site/wrt/data/i18n/index.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
for (const language of ['en', 'zh-CN']) {
  const strings = documents.get(language).strings;
  artifacts.set('.github/ISSUE_TEMPLATE/feedback.' + language + '.yml',
    Buffer.from(feedbackIssueForm(key => strings[key] || SRC.strings[key] || key)));
}
const mismatches = [];
for (const [relative, bytes] of artifacts) {
  const path = join(ROOT, relative);
  if (CHECK_ONLY) {
    if (!existsSync(path) || !readFileSync(path).equals(bytes)) mismatches.push(relative);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
  }
}
// Retire only the generator's known former outputs, never arbitrary directory contents.
for (const locale of LOCALES.languages) {
  for (const suffix of ['.json', ...(locale.fallbackTo ? ['.json.gz'] : [])]) {
    const relative = 'site/wrt/data/i18n/' + locale.id + suffix;
    const path = join(ROOT, relative);
    if (!existsSync(path)) continue;
    if (CHECK_ONLY) mismatches.push(relative + ' (retired localization bundle)');
    else rmSync(path);
  }
}
const legacy = join(ROOT, 'site/wrt/data/i18n.json');
if (existsSync(legacy)) {
  if (CHECK_ONLY) mismatches.push('site/wrt/data/i18n.json (retired monolith)');
  else rmSync(legacy);
}
if (mismatches.length) {
  console.error('Generated localization differs:\n' + mismatches.join('\n'));
  process.exit(1);
}
console.log((CHECK_ONLY ? 'Verified' : 'Generated') + ' ' + keys.length + ' complete strings × ' +
  documents.size + ' independent gzip language bundles; ' +
  LOCALES.languages.filter(locale => locale.fallbackTo).length + ' explicit fallback entries; ' +
  LOCALES.languages.filter(locale => locale.common).length + ' common locales.');
