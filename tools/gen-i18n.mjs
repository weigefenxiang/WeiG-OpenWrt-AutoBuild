#!/usr/bin/env node
// 合并 tools/i18n-source.json(zh-CN 源语言)+ tools/i18n-translations.json(其余语言) / Merges tools/i18n-source.json (zh-CN source) with tools/i18n-translations.json (other languages).
// 产出 site/wrt/data/i18n/<language>.json(页面用) / Outputs one site/wrt/data/i18n/<language>.json file per language.
// zh-CN 与 en 缺任何词条直接报错;其他语言缺条只警告,页面运行时回退英文 / Missing zh-CN/en entries are fatal; other languages only warn — the page falls back to English at runtime.
// 用法 / Usage: node tools/gen-i18n.mjs

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = JSON.parse(readFileSync(join(ROOT, 'tools', 'i18n-source.json'), 'utf8'));
const TR = JSON.parse(readFileSync(join(ROOT, 'tools', 'i18n-translations.json'), 'utf8'));

const LANGS = [
  { id: 'zh-CN', name: 'Chinese (Simplified)', native: '简体中文' },
  { id: 'zh-TW', name: 'Chinese (Traditional)', native: '繁體中文' },
  { id: 'en', name: 'English', native: 'English' },
  { id: 'ru', name: 'Russian', native: 'Русский' },
  { id: 'es', name: 'Spanish', native: 'Español' },
  { id: 'pt', name: 'Portuguese', native: 'Português' },
  { id: 'ja', name: 'Japanese', native: '日本語' },
  { id: 'ko', name: 'Korean', native: '한국어' },
  { id: 'de', name: 'German', native: 'Deutsch' },
  { id: 'fr', name: 'French', native: 'Français' },
  { id: 'vi', name: 'Vietnamese', native: 'Tiếng Việt' },
];

const keys = Object.keys(SRC.strings);
const strings = {};
const warnings = [];
const errors = [];
const PH = /\{(\w+)\}/g;

for (const k of keys) {
  const zh = SRC.strings[k];
  strings[k] = { 'zh-CN': zh };
  const want = (zh.match(PH) || []).sort().join(',');
  for (const l of LANGS) {
    if (l.id === 'zh-CN') continue;
    const v = TR[l.id] && TR[l.id][k];
    if (v === undefined || v === '') {
      (l.id === 'en' ? errors : warnings).push(`${l.id} 缺词条: ${k}`);
      continue;
    }
    const got = (v.match(PH) || []).sort().join(',');
    if (got !== want) {
      (l.id === 'en' ? errors : warnings).push(`${l.id} 占位符不符 ${k}: 期望 [${want}] 实得 [${got}]`);
      if (l.id === 'en') continue;   // 英文是运行时兜底,占位符错了不能收 / en is the runtime fallback, so a placeholder mismatch must not be accepted
    }
    strings[k][l.id] = v;
  }
}

if (errors.length) {
  console.error('❌ 源语言/兜底语言校验失败(必须 100% 完整):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

const outputDirectory = join(ROOT, 'site', 'wrt', 'data', 'i18n');
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(join(outputDirectory, 'index.json'),
  JSON.stringify({ version: 2, fallback: 'en', source: 'zh-CN', languages: LANGS }, null, 1) + '\n');
for (const language of LANGS) {
  const languageStrings = Object.fromEntries(keys.map((key) => [key,
    strings[key][language.id] || strings[key].en || strings[key]['zh-CN'],
  ]));
  writeFileSync(join(outputDirectory, `${language.id}.json`),
    JSON.stringify({ version: 2, language: language.id, strings: languageStrings }, null, 1) + '\n');
}
rmSync(join(ROOT, 'site', 'wrt', 'data', 'i18n.json'), { force: true });


console.log(`data/i18n: ${keys.length} 词条 × ${LANGS.length} 语言`);
for (const l of LANGS) {
  const n = keys.filter((k) => strings[k][l.id]).length;
  console.log(`  ${l.id.padEnd(6)} ${n}/${keys.length}` + (n < keys.length ? ' (缺的运行时回退英文)' : ''));
}
if (warnings.length) {
  console.log(`\n警告 ${warnings.length} 条:`);
  for (const w of warnings.slice(0, 15)) console.log('  - ' + w);
  if (warnings.length > 15) console.log(`  … 其余 ${warnings.length - 15} 条未显示`);
}
