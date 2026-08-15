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
function replaceRequired(text, re, to, label, min = 1) {
  let count = 0;
  const out = text.replace(re, (...args) => {
    count += 1;
    return typeof to === 'function' ? to(...args) : to;
  });
  if (count < min) throw new Error(`missing ${label}`);
  return out;
}

css = replaceOnce(css,
`:root {
  --menuconfig-title-size: 18px;
  --menuconfig-body-size: max(14px, calc(var(--menuconfig-title-size) - 1px));
`,
`:root {
  /* 全站字号模板 / shared typography scale: components consume semantic tokens, not ad-hoc px values */
  --font-page-title: 24px;
  --font-section-title: 20px;
  --font-item-title: 19px;
  --font-item-title-fit-1: calc(var(--font-item-title) - 1px);
  --font-item-title-fit-2: calc(var(--font-item-title) - 2px);
  --font-item-title-fit-3: calc(var(--font-item-title) - 3px);
  --font-body: 17px;
  --font-description: 16px;
  --font-meta: 14px;
  --font-badge: 13px;
`,
'desktop typography root');

css = css.replaceAll('var(--menuconfig-title-size)', 'var(--font-item-title)');
css = css.replaceAll('var(--menuconfig-body-size)', 'var(--font-description)');

css = replaceOnce(css,
'  :root{--menuconfig-title-size:15px}',
'  :root{--font-page-title:21px;--font-section-title:19px;--font-item-title:17px;--font-body:16px;--font-description:14px;--font-meta:13px;--font-badge:12px}',
'mobile typography root');

css = replaceOnce(css,
'  :root{--menuconfig-title-size:14px}',
'  :root{--font-page-title:20px;--font-section-title:18px;--font-item-title:16px;--font-body:16px;--font-description:14px;--font-meta:13px;--font-badge:12px}',
'narrow typography root');

const replacements = [
  ['font: 18px/1.75 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;',
   'font: var(--font-body)/1.75 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;',
   'body font'],
  ['font-size: 16px; /* <16px 会触发 iOS Safari 聚焦自动放大 */',
   'font-size: var(--font-body); /* mobile token never drops below 16px, avoiding iOS Safari focus zoom */',
   'input font'],
  ['.brand h1 { margin: 0; font-size: 22px; font-weight: 600; line-height: 1.3; }',
   '.brand h1 { margin: 0; font-size: var(--font-page-title); font-weight: 600; line-height: 1.3; }',
   'page title'],
  ['.brand .sub { margin: 0; font-size: 12.5px; color: var(--text2); }',
   '.brand .sub { margin: 0; font-size: var(--font-description); color: var(--text2); }',
   'brand description'],
  ['padding: 8px 13px; border-radius: 8px; font-size: 15px;',
   'padding: 8px 13px; border-radius: 8px; font-size: var(--font-description);',
   'text button font'],
  ['padding: 8px 9px; border-radius: 8px; font-size: 15px;',
   'padding: 8px 9px; border-radius: 8px; font-size: var(--font-description);',
   'language select font'],
  ['.risk-text { flex: 1; margin: 0; font-size: 15px; line-height: 1.6; color: var(--text); }',
   '.risk-text { flex: 1; margin: 0; font-size: var(--font-description); line-height: 1.6; color: var(--text); }',
   'risk description'],
  ['.risk-ok { flex: none; padding: 6px 14px; font-size: 13px; }',
   '.risk-ok { flex: none; padding: 6px 14px; font-size: var(--font-badge); }',
   'risk badge'],
  ['.step h2 { font-size: 18px; font-weight: 600;',
   '.step h2 { font-size: var(--font-section-title); font-weight: 600;',
   'section title'],
  ['.hint { font-size: 15px; font-weight: 400; color: var(--text3); }',
   '.hint { font-size: var(--font-description); font-weight: 400; color: var(--text3); }',
   'description'],
  ['padding: 4px 8px; cursor: pointer; font: inherit; font-size: 14px;',
   'padding: 4px 8px; cursor: pointer; font: inherit; font-size: var(--font-meta);',
   'fold meta'],
  ['color: var(--text2); font-size: 17px; user-select: none;',
   'color: var(--text2); font-size: var(--font-body); user-select: none;',
   'pill body'],
  ['padding: 13px 14px; font-size: 17px; font-weight: 600;',
   'padding: 13px 14px; font-size: var(--font-item-title); font-weight: 600;',
   'group title'],
  ['.group-count { font-weight: 400; font-size: 13.5px; color: var(--text3);',
   '.group-count { font-weight: 400; font-size: var(--font-meta); color: var(--text3);',
   'group meta'],
  ['padding: 10px 14px; font-size: 17px;',
   'padding: 10px 14px; font-size: var(--font-body);',
   'plugin body'],
  ['  font-size: 16px;\n  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
   '  font-size: var(--font-item-title);\n  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
   'plugin title'],
  ['.plugin-name.fit-s1 { font-size: 15px; }',
   '.plugin-name.fit-s1 { font-size: var(--font-item-title-fit-1); }',
   'plugin fit 1'],
  ['.plugin-name.fit-s2 { font-size: 14px; }',
   '.plugin-name.fit-s2 { font-size: var(--font-item-title-fit-2); }',
   'plugin fit 2'],
  ['.plugin .hot { color: var(--gold); background: var(--gold-bg); font-size: 12.5px;',
   '.plugin .hot { color: var(--gold); background: var(--gold-bg); font-size: var(--font-badge);',
   'plugin hot badge'],
  ['.plugin .flag { font-size: 12.5px;',
   '.plugin .flag { font-size: var(--font-badge);',
   'plugin flag badge'],
  ['.target-picker label { min-width: 0; color: var(--text2); font-size: 15px; font-weight: 650; }',
   '.target-picker label { min-width: 0; color: var(--text2); font-size: var(--font-description); font-weight: 650; }',
   'target label'],
  ['  font-size:16px;font-weight:600;',
   '  font-size:var(--font-body);font-weight:600;',
   'target select'],
  ['  color: var(--text); font-size: 15px; font-weight: 650; letter-spacing: .01em;',
   '  color: var(--text); font-size: var(--font-body); font-weight: 650; letter-spacing: .01em;',
   'build info title'],
  ['.build-info-card dt { color: var(--text3); font-size: 12.5px; white-space: nowrap; }',
   '.build-info-card dt { color: var(--text3); font-size: var(--font-meta); white-space: nowrap; }',
   'build info label'],
  ['  color: var(--text2); font: 12.5px/1.45 ui-monospace, Consolas, monospace;',
   '  color: var(--text2); font: var(--font-meta)/1.45 ui-monospace, Consolas, monospace;',
   'build info value'],
  ['  font-size: 16px;\n}\n.btn:hover',
   '  font-size: var(--font-body);\n}\n.btn:hover',
   'button font'],
  ['.site-footer { padding: 20px 16px 28px; font-size: 14px; color: var(--text3); }',
   '.site-footer { padding: 20px 16px 28px; font-size: var(--font-meta); color: var(--text3); }',
   'footer meta'],
  ['.modal-head h3 { margin: 0; font-size: 16px; }',
   '.modal-head h3 { margin: 0; font-size: var(--font-item-title); }',
   'modal title'],
  ['.modal-body { padding: 16px 18px; font-size: 15.5px; }',
   '.modal-body { padding: 16px 18px; font-size: var(--font-description); }',
   'modal body'],
  ['  color: var(--text2); font-size: 13px; font-weight: 650;',
   '  color: var(--text2); font-size: var(--font-meta); font-weight: 650;',
   'import source meta'],
  ['background-color: var(--card2); color: var(--text); font-family: inherit; font-size: 15px; font-weight: 600;',
   'background-color: var(--card2); color: var(--text); font-family: inherit; font-size: var(--font-description); font-weight: 600;',
   'import source select'],
  ['.import-target-preview span { color: var(--text3); font-size: 12px; }',
   '.import-target-preview span { color: var(--text3); font-size: var(--font-badge); }',
   'import preview badge'],
  ['  width: 100%; font: 12px/1.5 ui-monospace, Consolas, monospace;',
   '  width: 100%; font: var(--font-meta)/1.5 ui-monospace, Consolas, monospace;',
   'copy area meta'],
  ['  padding: 9px 2px; border-bottom: 1px solid var(--border); font-size: 15px;',
   '  padding: 9px 2px; border-bottom: 1px solid var(--border); font-size: var(--font-description);',
   'selected row'],
  ['.sel-size { margin-left: auto; font-size: 12px; color: var(--text3); white-space: nowrap; }',
   '.sel-size { margin-left: auto; font-size: var(--font-badge); color: var(--text3); white-space: nowrap; }',
   'selected meta'],
  ['.st-row b { display: block; font-size: 15.5px; }',
   '.st-row b { display: block; font-size: var(--font-description); }',
   'self-test title'],
  ['.st-msg { font-size: 14.5px; color: var(--text2);',
   '.st-msg { font-size: var(--font-meta); color: var(--text2);',
   'self-test meta'],
];

for (const [from, to, label] of replacements) css = replaceOnce(css, from, to, label);

css = replaceRequired(css, /\.brand h1 \{ font-size: (?:16|15)px; \}/g,
  '.brand h1 { font-size: var(--font-page-title); }', 'mobile page title', 2);
css = replaceRequired(css, /\.step h2 \{ font-size: 15px; \}/g,
  '.step h2 { font-size: var(--font-section-title); }', 'narrow section title');
css = replaceRequired(css, /\.menuconfig-toggle \.hint\{font-size:12px\}/g,
  '.menuconfig-toggle .hint{font-size:var(--font-meta)}', 'mobile menu hint');
css = replaceRequired(css, /\.menuconfig-category-text\{flex:1;font-size:16px\}/g,
  '.menuconfig-category-text{flex:1;font-size:var(--font-item-title)}', 'mobile menu title');
css = replaceRequired(css, /\.menuconfig-category-text\.menu-fit-s1\{font-size:15px\}/g,
  '.menuconfig-category-text.menu-fit-s1{font-size:var(--font-item-title-fit-1)}', 'menu fit 1');
css = replaceRequired(css, /\.menuconfig-category-text\.menu-fit-s2\{font-size:14px\}/g,
  '.menuconfig-category-text.menu-fit-s2{font-size:var(--font-item-title-fit-2)}', 'menu fit 2');
css = replaceRequired(css, /\.menuconfig-category-text\.menu-fit-s3\{font-size:13px\}/g,
  '.menuconfig-category-text.menu-fit-s3{font-size:var(--font-item-title-fit-3)}', 'menu fit 3');
css = replaceRequired(css, /font-size:12px;font-weight:700;line-height:1/g,
  'font-size:var(--font-badge);font-weight:700;line-height:1', 'translation badge');
css = replaceRequired(css, /\.pill \{ font-size: 13px; padding: 6px 12px; min-height: 38px; \}/g,
  '.pill { font-size: var(--font-body); padding: 6px 12px; min-height: 38px; }', 'narrow pill');
css = replaceRequired(css, /\.text-btn \{ padding: 6px 10px; font-size: 12\.5px; \}/g,
  '.text-btn { padding: 6px 10px; font-size: var(--font-description); }', 'narrow text button');
css = replaceRequired(css, /\.stats, \.stats \.link-btn, \.cap-text \{ font-size: 11px; \}/g,
  '.stats, .stats .link-btn, .cap-text { font-size: var(--font-badge); }', 'narrow stats');
css = replaceRequired(css, /\.site-version \{ font-size: 10\.5px; \}/g,
  '.site-version { font-size: var(--font-badge); }', 'narrow site version');
css = replaceRequired(css, /\.actions \.btn \{ min-height: 32px; padding: 4px 7px; font-size: 12px; \}/g,
  '.actions .btn { min-height: 32px; padding: 4px 7px; font-size: var(--font-badge); }', 'narrow action buttons');

css = replaceRequired(css,
/\/\* 密度:紧凑档 CSS 保留但已退役,V11 起 JS 不再触发\(改用 Aa 字号面板\) \/ compact density CSS kept but retired; since V11 JS never toggles it \(Aa font panel took over\) \*\/\nbody\.dense \{ font-size: 16\.5px; \}\nbody\.dense \.pill \{ font-size: 15px; min-height: 38px; \}\nbody\.dense \.plugin \{ font-size: 15px; padding: 7px 12px; \}\nbody\.dense \.group-head \{ font-size: 15px; padding: 10px 12px; \}\nbody\.dense \.plugin-grid \{ grid-template-columns: repeat\(auto-fill, minmax\(132px, 1fr\)\); \}\n\/\* 紧凑档下的 V11 三态字号\(同样保留备用\) \/ V11 fit sizes under compact density \(kept for the same reason\) \*\/\nbody\.dense \.plugin-name \{ font-size: 15px; \}\nbody\.dense \.plugin-name\.fit-s1 \{ font-size: 14px; \}\nbody\.dense \.plugin-name\.fit-s2 \{ font-size: 13px; \}\n/,
'', 'retired dense typography');

if (css.includes('--menuconfig-title-size') || css.includes('--menuconfig-body-size')) {
  throw new Error('legacy menuconfig typography variables remain');
}
if (css.includes('body.dense')) throw new Error('retired dense typography remains');

const marker = "const sharedTooltipContract = app.match(/\\/\\* ============ 统一悬浮说明";
const markerIndex = test.indexOf(marker);
if (markerIndex < 0) throw new Error('missing typography test insertion marker');

const typographyTest = `const typographyRoot = css.match(/:root \\\\{([\\\\s\\\\S]*?)\\\\n\\\\}/)?.[1] || '';
expect(
  typographyRoot.includes('--font-page-title: 24px;') &&
  typographyRoot.includes('--font-section-title: 20px;') &&
  typographyRoot.includes('--font-item-title: 19px;') &&
  typographyRoot.includes('--font-body: 17px;') &&
  typographyRoot.includes('--font-description: 16px;') &&
  typographyRoot.includes('--font-meta: 14px;') &&
  typographyRoot.includes('--font-badge: 13px;') &&
  css.includes('font: var(--font-body)/1.75') &&
  css.includes('.brand h1 { margin: 0; font-size: var(--font-page-title);') &&
  css.includes('.step h2 { font-size: var(--font-section-title);') &&
  css.includes('padding: 13px 14px; font-size: var(--font-item-title); font-weight: 600;') &&
  css.includes('font-size: var(--font-item-title);\\\\n  white-space: nowrap;') &&
  css.includes('.plugin-name.fit-s1 { font-size: var(--font-item-title-fit-1); }') &&
  css.includes('.plugin-name.fit-s2 { font-size: var(--font-item-title-fit-2); }') &&
  css.includes('.ui-tooltip-title{display:block;margin:0;color:var(--text);font-size:var(--font-item-title);') &&
  css.includes('.ui-tooltip{position:fixed;') && css.includes('font-size:var(--font-description);') &&
  css.includes(':root{--font-page-title:21px;--font-section-title:19px;--font-item-title:17px;--font-body:16px;--font-description:14px;--font-meta:13px;--font-badge:12px}') &&
  css.includes(':root{--font-page-title:20px;--font-section-title:18px;--font-item-title:16px;--font-body:16px;--font-description:14px;--font-meta:13px;--font-badge:12px}') &&
  !css.includes('--menuconfig-title-size') && !css.includes('--menuconfig-body-size') &&
  !css.includes('body.dense') &&
  app.includes('const FONT_DEF = 17, FONT_MIN = 14, FONT_MAX = 24;'),
  'shared typography scale, responsive tokens, or retired density cleanup regressed');

`;

test = test.slice(0, markerIndex) + typographyTest + test.slice(markerIndex);

fs.writeFileSync(cssPath, css);
fs.writeFileSync(testPath, test);
