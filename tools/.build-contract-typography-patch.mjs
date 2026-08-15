#!/usr/bin/env node
import fs from 'node:fs';

const cssPath = 'site/wrt/app.css';
const testPath = 'tools/test-catalog-ui-contract.mjs';
let css = fs.readFileSync(cssPath, 'utf8');
let test = fs.readFileSync(testPath, 'utf8');

function replaceOnce(text, from, to, label) {
  const first = text.indexOf(from);
  if (first < 0) throw new Error(`missing ${label}`);
  if (text.indexOf(from, first + from.length) >= 0) throw new Error(`duplicate ${label}`);
  return text.slice(0, first) + to + text.slice(first + from.length);
}

css = replaceOnce(css,
  '  --font-item-title: 19px;\n  --font-item-title-fit-1:',
  '  --font-item-title: 19px;\n  --font-emphasis: 18px;\n  --font-item-title-fit-1:',
  'desktop emphasis token');
css = replaceOnce(css,
  ':root{--font-page-title:21px;--font-section-title:19px;--font-item-title:17px;--font-body:16px;--font-description:14px;--font-meta:13px;--font-badge:12px}',
  ':root{--font-page-title:21px;--font-section-title:19px;--font-item-title:17px;--font-emphasis:16px;--font-body:16px;--font-description:14px;--font-meta:13px;--font-badge:12px}',
  'mobile emphasis token');
css = replaceOnce(css,
  ':root{--font-page-title:20px;--font-section-title:18px;--font-item-title:16px;--font-body:16px;--font-description:14px;--font-meta:13px;--font-badge:12px}',
  ':root{--font-page-title:20px;--font-section-title:18px;--font-item-title:16px;--font-emphasis:16px;--font-body:16px;--font-description:14px;--font-meta:13px;--font-badge:12px}',
  'narrow emphasis token');

css = replaceOnce(css,
  '.build-contract-toggle strong{font-size:var(--font-item-title);white-space:nowrap}',
  '.build-contract-toggle strong{font-size:var(--font-description);white-space:nowrap}',
  'build contract title');
css = replaceOnce(css,
  '.build-contract-key{color:var(--text2);font-size:var(--font-description);min-width:0}',
  '.build-contract-key{color:var(--text2);font-size:var(--font-emphasis);min-width:0}',
  'build contract field');
css = replaceOnce(css,
  '.build-contract-row code{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);font:600 var(--font-item-title) ui-monospace,Consolas,monospace}',
  '.build-contract-row code{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);font:600 var(--font-emphasis) ui-monospace,Consolas,monospace}',
  'build contract value');
css = replaceOnce(css,
  '.build-contract-list>strong{display:block;margin-bottom:6px;color:var(--text);font-size:var(--font-item-title)}',
  '.build-contract-list>strong{display:block;margin-bottom:6px;color:var(--text);font-size:var(--font-emphasis)}',
  'build contract list title');
css = replaceOnce(css,
  '.build-contract-list-head>strong{color:var(--text);font-size:var(--font-item-title)}',
  '.build-contract-list-head>strong{color:var(--text);font-size:var(--font-emphasis)}',
  'build contract list head');
css = replaceOnce(css,
  '.build-contract-chip{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px 7px;border:1px solid color-mix(in srgb,var(--accent) 30%,var(--border));border-radius:6px;background:color-mix(in srgb,var(--accent) 10%,var(--card2));color:var(--accent);font:var(--font-item-title) ui-monospace,Consolas,monospace}',
  '.build-contract-chip{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px 7px;border:1px solid color-mix(in srgb,var(--accent) 30%,var(--border));border-radius:6px;background:color-mix(in srgb,var(--accent) 10%,var(--card2));color:var(--accent);font:var(--font-emphasis) ui-monospace,Consolas,monospace}',
  'build contract chip');

css = replaceOnce(css,
  '.menuconfig-scroll{max-height:clamp(280px,55vh,620px);overflow-y:auto;overflow-x:hidden;padding:0 10px 12px;overscroll-behavior:contain;scrollbar-gutter:stable;-webkit-overflow-scrolling:touch}',
  '.menuconfig-scroll{max-height:clamp(280px,55vh,620px);overflow-y:auto;overflow-x:hidden;padding:0 10px 12px;overscroll-behavior-y:auto;scrollbar-gutter:stable;-webkit-overflow-scrolling:touch}',
  'menuconfig native scroll chaining');

const typographyNeedle = "  css.includes('--font-item-title: 19px;') &&\n  css.includes('--font-body: 17px;') &&";
test = replaceOnce(test, typographyNeedle,
  "  css.includes('--font-item-title: 19px;') &&\n  css.includes('--font-emphasis: 18px;') &&\n  css.includes('--font-body: 17px;') &&",
  'emphasis regression token');
test = replaceOnce(test,
  "  css.includes(':root{--font-page-title:21px;--font-section-title:19px;--font-item-title:17px;--font-body:16px;--font-description:14px;--font-meta:13px;--font-badge:12px}') &&\n  css.includes(':root{--font-page-title:20px;--font-section-title:18px;--font-item-title:16px;--font-body:16px;--font-description:14px;--font-meta:13px;--font-badge:12px}') &&",
  "  css.includes(':root{--font-page-title:21px;--font-section-title:19px;--font-item-title:17px;--font-emphasis:16px;--font-body:16px;--font-description:14px;--font-meta:13px;--font-badge:12px}') &&\n  css.includes(':root{--font-page-title:20px;--font-section-title:18px;--font-item-title:16px;--font-emphasis:16px;--font-body:16px;--font-description:14px;--font-meta:13px;--font-badge:12px}') &&",
  'responsive emphasis regression');

const insertion = "  !css.includes('body.dense') &&\n  app.includes('const FONT_DEF = 17, FONT_MIN = 14, FONT_MAX = 24;'),";
test = replaceOnce(test, insertion,
  "  !css.includes('body.dense') &&\n  css.includes('.build-contract-toggle strong{font-size:var(--font-description);white-space:nowrap}') &&\n  css.includes('.build-contract-key{color:var(--text2);font-size:var(--font-emphasis);min-width:0}') &&\n  css.includes('font:600 var(--font-emphasis) ui-monospace,Consolas,monospace') &&\n  css.includes('.build-contract-list>strong{display:block;margin-bottom:6px;color:var(--text);font-size:var(--font-emphasis)}') &&\n  css.includes('.build-contract-list-head>strong{color:var(--text);font-size:var(--font-emphasis)}') &&\n  css.includes('color:var(--accent);font:var(--font-emphasis) ui-monospace,Consolas,monospace') &&\n  css.includes('.menuconfig-scroll{max-height:clamp(280px,55vh,620px);overflow-y:auto;overflow-x:hidden;padding:0 10px 12px;overscroll-behavior-y:auto;') &&\n  !css.includes('.menuconfig-scroll{max-height:clamp(280px,55vh,620px);overflow-y:auto;overflow-x:hidden;padding:0 10px 12px;overscroll-behavior:contain;') &&\n  app.includes('const FONT_DEF = 17, FONT_MIN = 14, FONT_MAX = 24;'),",
  'build contract and scroll regression');

test = test.replace(
  "'shared typography scale, responsive tokens, or retired density cleanup regressed'",
  "'shared typography scale, build-contract hierarchy, native menuconfig scroll chaining, responsive tokens, or retired density cleanup regressed'");

fs.writeFileSync(cssPath, css);
fs.writeFileSync(testPath, test);
