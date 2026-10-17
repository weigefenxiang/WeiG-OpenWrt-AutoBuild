#!/usr/bin/env node
// 合并 tools/i18n-source.json(英文源语言)+ tools/i18n-translations.json(其余语言) / Merges tools/i18n-source.json (English source) with tools/i18n-translations.json (other languages).
// 产出 site/wrt/data/i18n/<language>.json(页面用) / Outputs one site/wrt/data/i18n/<language>.json file per language.
// en 缺任何词条直接报错;其他语言缺条只警告,页面运行时回退英文 / Missing English entries are fatal; other languages only warn — the page falls back to English at runtime.
// 用法 / Usage: node tools/gen-i18n.mjs

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feedbackIssueForm } from '../site/wrt/lib/feedback.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = JSON.parse(readFileSync(join(ROOT, 'tools', 'i18n-source.json'), 'utf8'));
const TR = JSON.parse(readFileSync(join(ROOT, 'tools', 'i18n-translations.json'), 'utf8'));

const SOURCE_LANGUAGE = 'en';
const REQUIRED_TRANSLATIONS = new Set(['zh-CN']);

const LANGS = [
  { id: 'en', name: 'English', native: 'English' },
  { id: 'zh-CN', name: 'Chinese (Simplified)', native: '简体中文' },
  { id: 'zh-TW', name: 'Chinese (Traditional)', native: '繁體中文' },
  { id: 'ru', name: 'Russian', native: 'Русский' },
  { id: 'es', name: 'Spanish', native: 'Español' },
  { id: 'pt', name: 'Portuguese', native: 'Português' },
  { id: 'ja', name: 'Japanese', native: '日本語' },
  { id: 'ko', name: 'Korean', native: '한국어' },
  { id: 'de', name: 'German', native: 'Deutsch' },
  { id: 'fr', name: 'French', native: 'Français' },
  { id: 'vi', name: 'Vietnamese', native: 'Tiếng Việt' },
];

// Pending entries expose the language directory without claiming translated UI.
LANGS.push(...[
  {
    "id": "ar",
    "name": "Arabic",
    "native": "العربية",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "ast",
    "name": "Asturian",
    "native": "Asturianu",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "az",
    "name": "Azerbaijani",
    "native": "Azərbaycan dili",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "be",
    "name": "Belarusian",
    "native": "Беларуская",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "bg",
    "name": "Bulgarian",
    "native": "Български",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "bn",
    "name": "Bangla",
    "native": "বাংলা",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "bn-BD",
    "name": "Bangla (Bangladesh)",
    "native": "বাংলা (বাংলাদেশ)",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "ca",
    "name": "Catalan",
    "native": "Català",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "cs",
    "name": "Czech",
    "native": "Čeština",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "da",
    "name": "Danish",
    "native": "Dansk",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "el",
    "name": "Greek",
    "native": "Ελληνικά",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "fa",
    "name": "Persian",
    "native": "فارسی",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "fi",
    "name": "Finnish",
    "native": "Suomi",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "fil",
    "name": "Filipino",
    "native": "Filipino",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "ga",
    "name": "Irish",
    "native": "Gaeilge",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "he",
    "name": "Hebrew",
    "native": "עברית",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "hi",
    "name": "Hindi",
    "native": "हिन्दी",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "hu",
    "name": "Hungarian",
    "native": "Magyar",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "id",
    "name": "Indonesian",
    "native": "Bahasa Indonesia",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "it",
    "name": "Italian",
    "native": "Italiano",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "ka",
    "name": "Georgian",
    "native": "ქართული",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "lo",
    "name": "Lao",
    "native": "ລາວ",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "lt",
    "name": "Lithuanian",
    "native": "Lietuvių",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "lv",
    "name": "Latvian",
    "native": "Latviešu",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "ml",
    "name": "Malayalam",
    "native": "മലയാളം",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "mr",
    "name": "Marathi",
    "native": "मराठी",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "ms",
    "name": "Malay",
    "native": "Bahasa Melayu",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "nb-NO",
    "name": "Norwegian Bokmål (Norway)",
    "native": "Norsk bokmål",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "nl",
    "name": "Dutch",
    "native": "Nederlands",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "pl",
    "name": "Polish",
    "native": "Polski",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "pt-BR",
    "name": "Brazilian Portuguese",
    "native": "Português (Brasil)",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "ro",
    "name": "Romanian",
    "native": "Română",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "sk",
    "name": "Slovak",
    "native": "Slovenčina",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "sv",
    "name": "Swedish",
    "native": "Svenska",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "ta",
    "name": "Tamil",
    "native": "தமிழ்",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "tr",
    "name": "Turkish",
    "native": "Türkçe",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "uk",
    "name": "Ukrainian",
    "native": "Українська",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "ur",
    "name": "Urdu",
    "native": "اردو",
    "pending": true,
    "bundle": "en"
  },
  {
    "id": "yua",
    "name": "yua",
    "native": "Maaya t'aan",
    "pending": true,
    "bundle": "en"
  }
]);
const ACTIVE_LANGS = LANGS.filter((language) => !language.pending);

const keys = Object.keys(SRC.strings);
const strings = {};
const warnings = [];
const errors = [];
const PH = /\{(\w+)\}/g;

for (const k of keys) {
  const english = SRC.strings[k];
  strings[k] = { [SOURCE_LANGUAGE]: english };
  const want = (english.match(PH) || []).sort().join(',');
  for (const l of ACTIVE_LANGS) {
    if (l.id === SOURCE_LANGUAGE) continue;
    const v = TR[l.id] && TR[l.id][k];
    if (v === undefined || v === '') {
      (REQUIRED_TRANSLATIONS.has(l.id) ? errors : warnings).push(`${l.id} 缺词条: ${k}`);
      continue;
    }
    const got = (v.match(PH) || []).sort().join(',');
    if (got !== want) {
      (REQUIRED_TRANSLATIONS.has(l.id) ? errors : warnings).push(`${l.id} 占位符不符 ${k}: 期望 [${want}] 实得 [${got}]`);
      if (REQUIRED_TRANSLATIONS.has(l.id)) continue;
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
  JSON.stringify({ version: 2, fallback: SOURCE_LANGUAGE, source: SOURCE_LANGUAGE, languages: LANGS }, null, 1) + '\n');
for (const language of ACTIVE_LANGS) {
  const languageStrings = Object.fromEntries(keys.map((key) => [key,
    strings[key][language.id] || strings[key][SOURCE_LANGUAGE],
  ]));
  writeFileSync(join(outputDirectory, `${language.id}.json`),
    JSON.stringify({ version: 2, language: language.id, strings: languageStrings }, null, 1) + '\n');
}
rmSync(join(ROOT, 'site', 'wrt', 'data', 'i18n.json'), { force: true });
for (const language of ['en', 'zh-CN']) {
  writeFileSync(join(ROOT, '.github', 'ISSUE_TEMPLATE', `feedback.${language}.yml`),
    feedbackIssueForm(key => strings[key]?.[language] || strings[key]?.[SOURCE_LANGUAGE] || key));
}


console.log(`data/i18n: ${keys.length} 词条 × ${LANGS.length} 语言`);
for (const l of ACTIVE_LANGS) {
  const n = keys.filter((k) => strings[k][l.id]).length;
  console.log(`  ${l.id.padEnd(6)} ${n}/${keys.length}` + (n < keys.length ? ' (缺的运行时回退英文)' : ''));
}
if (warnings.length) {
  console.log(`\n警告 ${warnings.length} 条:`);
  for (const w of warnings.slice(0, 15)) console.log('  - ' + w);
  if (warnings.length > 15) console.log(`  … 其余 ${warnings.length - 15} 条未显示`);
}
