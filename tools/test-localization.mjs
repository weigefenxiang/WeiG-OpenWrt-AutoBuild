#!/usr/bin/env node
// Real source coverage, independent deterministic assets, and safe decoding.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import { decodeJsonBytes } from '../site/wrt/lib/data-codec.js';

const sample = { text: '中文 · العربية · עברית', states: ['N', 'M', 'Y'] };
const plain = Buffer.from(JSON.stringify(sample));
const compressed = gzipSync(plain);
assert.deepEqual(await decodeJsonBytes(plain), sample);
assert.deepEqual(await decodeJsonBytes(compressed), sample);
assert.deepEqual(await decodeJsonBytes(plain, null), sample, 'HTTP-decoded JSON does not need gzip support');
await assert.rejects(() => decodeJsonBytes(compressed, null), /gzip/);
await assert.rejects(() => decodeJsonBytes(Buffer.from('not json')), SyntaxError);
await assert.rejects(() => decodeJsonBytes(compressed.subarray(0, 12)));
await assert.rejects(() => decodeJsonBytes(Buffer.from([0xff, 0xfe])));
if (process.argv.includes('--codec-only')) {
  console.log('Shared plain/gzip JSON decoder tests passed.');
  process.exit(0);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const registry = JSON.parse(read('tools/i18n-locales.json'));
assert(!existsSync(join(root, 'tools/i18n-translations.json')), 'retired monolithic source must not become a second authority');
const manifest = JSON.parse(read('site/wrt/data/i18n/index.json'));
const english = JSON.parse(read('tools/i18n-source.json')).strings;
const keys = Object.keys(english).sort();
const placeholders = value => (value.match(/\{(\w+)\}/g) || []).sort();
assert.equal(manifest.version, 3);
assert.equal(manifest.languages.length, 49);
assert.equal(manifest.stringCount, keys.length);
assert.equal(manifest.languages.filter(locale => locale.common).length, 11);
assert.equal(manifest.languages.filter(locale => !locale.common).length, 38);
assert.deepEqual(manifest.languages.map(locale => locale.id), registry.languages.map(locale => locale.id));
const expectedFiles = ['index.json'];
const rtl = [];
const badgePattern = /\[<img src="([^\"]+)" alt="([^\"]+)" align="absmiddle">\]\((https:\/\/.*?)\)/g;
const sourceLinks = (markdown, path) => [...markdown.matchAll(badgePattern)].map(([, image, name, link]) =>
  ({ name, image: posix.normalize(posix.join(posix.dirname(path), image)), link }));
const canonicalBadges = sourceLinks(read('translations/README.zh-CN.md'), 'translations/README.zh-CN.md');
assert.equal(canonicalBadges.length, 6, 'Chinese README owns the shared colored-source presentation');
const colors = new Set();
for (const { name, image, link } of canonicalBadges) {
  assert.match(image, /^docs\/images\/sources\/[a-z]+\.svg$/);
  assert.match(link, /^https:\/\/github\.com\/[^/]+\/[^/]+$/);
  const svg = read(image);
  assert(svg.includes('<title>' + name + '</title>'));
  assert(svg.includes('>' + name + '</text>'));
  assert.doesNotMatch(svg, /<(?:rect|path|polygon|circle|image|script|foreignObject)\b|background|stroke=/i,
    'source labels are transparent colored text, never filled badges or frames');
  const color = svg.match(/<text[^>]+fill="(#[a-f0-9]{6})"/i)?.[1];
  assert(color, 'only the source-name text is colored');
  colors.add(color);
}
assert.equal(colors.size, 6, 'each source has a distinct text color');
const mirrorKeys = JSON.parse(read('site/wrt/data/package-mirrors.json')).presets.map(preset => 'fw.packageMirror.' + preset.id);
assert(mirrorKeys.every(key => keys.includes(key)), 'mirror option copy belongs to the shared UI translation authority');
for (const locale of manifest.languages) {
  assert(['pending', 'bundle', 'fallbackTo'].every(key => !Object.hasOwn(locale, key)));
  const markdownPath = locale.id === 'en' ? 'README.md' : 'translations/README.' + locale.id + '.md';
  const markdown = read(markdownPath);
  for (const [, target] of markdown.matchAll(/href="([^\"]*README[^\"]*\.md)"/g)) {
    if (/^https?:\/\//.test(target)) continue;
    assert(existsSync(join(root, posix.dirname(markdownPath), target)),
      locale.id + ': README language link must resolve: ' + target);
  }
  assert.deepEqual(sourceLinks(markdown, markdownPath), canonicalBadges,
    locale.id + ': all README source labels share names, assets and upstream links');
  const sourceRow = markdown.split(/\r?\n/).find(line => line.includes('docs/images/sources/'));
  assert.equal((sourceRow?.match(/ · /g) || []).length, 5,
    locale.id + ': use the same middle-dot separator as the language row');
  assert.equal(locale.file, locale.id + '.json.gz');
  expectedFiles.push(locale.file);
  const gzip = readFileSync(join(root, 'site/wrt/data/i18n', locale.file));
  assert.equal(gzip.length, locale.bytes, locale.id + ': compressed byte count');
  assert(gzip.length < 128 * 1024, locale.id + ': independent bundle size budget');
  assert.equal(createHash('sha256').update(gzip).digest('hex'), locale.sha256);
  const decoded = gunzipSync(gzip);
  assert.equal(decoded.length, locale.decodedBytes);
  const document = await decodeJsonBytes(gzip);
  assert.equal(document.language, locale.id);
  assert.deepEqual(Object.keys(document.strings).sort(), keys);
  const source = locale.id === registry.source ? english :
    JSON.parse(read('tools/i18n-translations/' + locale.id + '.json'));
  assert.deepEqual(Object.keys(source).sort(), keys, locale.id + ': authored source is complete, not English-filled output');
  for (const key of keys) {
    assert.equal(typeof source[key], 'string', locale.id + ': ' + key);
    assert(source[key].trim(), locale.id + ': empty ' + key);
    assert.equal(document.strings[key], source[key], locale.id + ': generated text drift ' + key);
    assert.deepEqual(placeholders(source[key]), placeholders(english[key]), locale.id + ': placeholders ' + key);
    if (locale.id !== 'en' && key !== 'mode.self.enableLabel' && english[key].split(/\s+/).length >= 6) {
      assert.notEqual(source[key], english[key], locale.id + ': copied English prose ' + key);
    }
    if (!['zh-CN', 'zh-TW', 'ja'].includes(locale.id)) {
      assert.doesNotMatch(source[key], /\p{Script=Han}/u, locale.id + ': unintended Chinese text ' + key);
    }
  }
  assert.equal(source['mode.self.enableLabel'], english['mode.self.enableLabel'], 'actual GitHub button label stays literal');
  if (locale.dir === 'rtl') rtl.push(locale.id);
  assert(!markdown.includes('build-request.json'), locale.id + ': obsolete fixed import filename');
  for (const literal of ['*.json', '.config', 'config.buildinfo', 'Submit new issue']) {
    assert(markdown.includes(literal), locale.id + ': documented workflow literal ' + literal);
  }
  for (const key of ['btn.import', 'btn.submit', 'submit.m1.btn']) {
    assert(markdown.includes('【' + source[key] + '】'), locale.id + ': README/button mismatch ' + key);
  }
  assert.equal((markdown.match(/<details>/g) || []).length, (markdown.match(/<\/details>/g) || []).length);
}
assert.deepEqual(rtl.sort(), ['ar', 'fa', 'he', 'ur']);
const readmeFiles = ['README.md', ...readdirSync(join(root, 'translations'))
  .filter(name => /^README\.[\w-]+\.md$/.test(name)).map(name => 'translations/' + name)];
assert.deepEqual(readmeFiles.sort(), manifest.languages.map(locale => locale.id === 'en' ?
  'README.md' : 'translations/README.' + locale.id + '.md').sort(),
  'README language entries must exactly match supported languages, without retired placeholders');
assert.deepEqual(readdirSync(join(root, 'site/wrt/data/i18n')).sort(), expectedFiles.sort(), 'retired JSON/monolithic packages must not remain');
assert.equal(expectedFiles.length, 50, '49 real language assets and one manifest');
console.log('49 authored locales, gzip assets, supported README links, source labels and README/UI terminology passed.');
