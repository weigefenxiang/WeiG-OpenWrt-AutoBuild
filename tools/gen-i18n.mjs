#!/usr/bin/env node
// 合并 tools/i18n-source.json(zh-CN 源语言)+ tools/i18n-translations.json(其余语言) / Merges tools/i18n-source.json (zh-CN source) with tools/i18n-translations.json (other languages).
// 产出 site/wrt/data/i18n.json(页面用)+ docs-private/翻译对照表.md(人工校对用,不上传) / Outputs site/wrt/data/i18n.json (used by the page) + docs-private/翻译对照表.md (human proofreading only, not deployed).
// zh-CN 与 en 缺任何词条直接报错;其他语言缺条只警告,页面运行时回退英文 / Missing zh-CN/en entries are fatal; other languages only warn — the page falls back to English at runtime.
// 用法 / Usage: node tools/gen-i18n.mjs

import { readFileSync, writeFileSync } from 'node:fs';
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

writeFileSync(join(ROOT, 'site', 'wrt', 'data', 'i18n.json'),
  JSON.stringify({ version: 1, fallback: 'en', languages: LANGS, strings }, null, 1) + '\n');

// 对照表 md:每语言一节,避免所有语言挤成一张超宽表格 / review table md: one section per language to avoid one over-wide table
const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
let md = '# UI 翻译对照表\n\n' +
  '由 `node tools/gen-i18n.mjs` 自动生成,请勿手改本文件 —— 改 `tools/i18n-source.json`(中文源)或 `tools/i18n-translations.json`(其他语言)后重跑。\n\n' +
  `词条数:${keys.length} · 语言数:${LANGS.length}\n\n` +
  '语言:' + LANGS.map((l) => `${l.native}(${l.id})`).join(' · ') + '\n\n';

for (const l of LANGS) {
  if (l.id === 'zh-CN') continue;
  const miss = keys.filter((k) => !strings[k][l.id]).length;
  md += `## ${l.native} (${l.id})${miss ? ` — 缺 ${miss} 条,运行时回退英文` : ''}\n\n`;
  md += '| 词条 key | 简体中文 | ' + l.native + ' |\n|---|---|---|\n';
  for (const k of keys) md += `| \`${k}\` | ${esc(strings[k]['zh-CN'])} | ${esc(strings[k][l.id] || '(缺,回退英文)')} |\n`;
  md += '\n';
}
writeFileSync(join(ROOT, 'docs-private', '翻译对照表.md'), md);

console.log(`i18n.json: ${keys.length} 词条 × ${LANGS.length} 语言`);
for (const l of LANGS) {
  const n = keys.filter((k) => strings[k][l.id]).length;
  console.log(`  ${l.id.padEnd(6)} ${n}/${keys.length}` + (n < keys.length ? ' (缺的运行时回退英文)' : ''));
}
if (warnings.length) {
  console.log(`\n警告 ${warnings.length} 条:`);
  for (const w of warnings.slice(0, 15)) console.log('  - ' + w);
  if (warnings.length > 15) console.log(`  … 其余 ${warnings.length - 15} 条见对照表 md`);
}
console.log('\n对照表: docs-private/翻译对照表.md');
