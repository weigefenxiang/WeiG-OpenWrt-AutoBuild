#!/usr/bin/env node
// 生成"软件包用途说明页"(11 语,词条内嵌,零请求可离线打开)/ builds the multilingual package-reference page (strings embedded, opens offline).
// 用法 / Usage: node tools/gen-pkg-page.mjs [输出路径 outPath]   默认 site/wrt/packages.html
// 依赖 gen-plugins 与 gen-i18n 的产物 / consumes gen-plugins & gen-i18n outputs.

import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(ROOT, 'site', 'wrt', 'packages.html');
const PLUGINS = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', '360t7', 'plugins.json'), 'utf8'));
const PKGS = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', '360t7', 'packages.json'), 'utf8'));
const DEVICES = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'devices.json'), 'utf8'));
const I18N = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'i18n.json'), 'utf8'));
const PI18N = JSON.parse(readFileSync(join(ROOT, 'site', 'wrt', 'data', 'plugins-i18n.json'), 'utf8'));   // gen-plugins 产物 / gen-plugins output
const SRC = DEVICES.devices.find((d) => d.id === '360t7').sources.map((s) => ({ id: s.id, label: s.label }));

// 只内嵌本页要用的词条(pkgpage.* + 分组名),控制体积 / embed only the strings this page needs
const STR = {};
for (const k of Object.keys(I18N.strings)) {
  if (k.startsWith('pkgpage.') || k.startsWith('group.')) STR[k] = I18N.strings[k];
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// 体积友好显示:输入为 MB 数值;单位一律拉丁写法 " KB"/" MB"/" GB",整 MB 显示如 "1 MB"
// Human-friendly size: input is a number in MB; units are always Latin " KB"/" MB"/" GB"; whole MB renders as "1 MB"
const fmtSize = (mb) => {
  if (mb >= 1000) return (Math.round(mb / 100) / 10) + ' GB';   // 与 app.js fmtSize 对齐:十进制 GB,一位小数,整数自然去 .0 / aligned with app.js fmtSize: decimal GB, one decimal, trailing .0 drops naturally
  if (mb >= 0.95) { const r = Math.round(mb * 10) / 10; return (Number.isInteger(r) ? r : r.toFixed(1)) + ' MB'; }
  const kb = mb * 1024;
  return kb >= 1 ? Math.round(kb) + ' KB' : Math.max(0, Math.round(kb * 1024)) + ' B';   // 负值钳 0,与 app.js 一致 / clamp negatives to 0, same as app.js
};

let curated = '';
for (const g of PLUGINS.groups) {
  const items = PLUGINS.plugins.filter((p) => p.group === g);
  if (!items.length) continue;
  curated += `<h3><span data-i18n="group.${esc(g)}">${esc(g)}</span> <small>${items.length}</small></h3>` +
    `<table><thead><tr><th data-i18n="pkgpage.th.plugin">插件</th><th data-i18n="pkgpage.th.id">id</th><th data-i18n="pkgpage.th.purpose">用途</th><th data-i18n="pkgpage.th.size">体积≈</th></tr></thead><tbody>`;
  // 插件名/用途 带 data-pid,运行时随页面语言切换(见下方 applyLang)/ name & desc carry data-pid so applyLang can re-render them per language
  for (const p of items) {
    curated += `<tr><td><span class="pname" data-pid="${esc(p.id)}">${esc(p.name)}</span>${p.hot ? ' <b class="hot">HOT</b>' : ''}${p.locked ? ' <b class="req">✓</b>' : ''}</td><td><code>${esc(p.id)}</code></td><td class="pdesc" data-pid="${esc(p.id)}">${esc(p.desc)}</td><td>${fmtSize(p.size || 1)}</td></tr>`;
  }
  curated += '</tbody></table>';
}

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wei.G · 软件包用途说明 / Package Reference</title>
<link rel="icon" href="Wei.G.ico">
<style>
:root{--bg:#f5f6f8;--card:#fff;--card2:#f2f4f7;--text:#1c2430;--text2:#5b6572;--border:#dde2e9;--accent:#2563eb;--accent-text:#1d4ed8;--gold:#b45309;--gold-bg:#fef3c7}
@media (prefers-color-scheme:dark){:root{--bg:#11151c;--card:#1a202b;--card2:#222a37;--text:#e6eaf0;--text2:#9aa4b2;--border:#2c3543;--accent:#4f83f1;--accent-text:#9db9f7;--gold:#fbbf24;--gold-bg:#3a2f14}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.75 -apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:20px 16px 60px}
.top{display:flex;align-items:center;gap:12px}.top select{margin-left:auto;padding:7px 9px;font-size:15px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--text2)}
h1{font-size:22px;margin:10px 0}h2{font-size:19px;margin:34px 0 8px;border-bottom:1px solid var(--border);padding-bottom:8px}h3{font-size:16.5px;margin:22px 0 6px}h3 small{color:var(--text2);font-weight:400}
p.note{color:var(--text2);font-size:15px}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden;font-size:15px}
th,td{padding:8px 10px;border-bottom:1px solid var(--border);text-align:left;vertical-align:top}th{background:var(--card2);font-size:14px}
tr:last-child td{border-bottom:none}
code{font:13.5px ui-monospace,Consolas,monospace;background:var(--card2);padding:1px 6px;border-radius:5px}
.hot{color:var(--gold);background:var(--gold-bg);font-size:12px;border-radius:4px;padding:0 5px;font-weight:600}
.req{color:var(--accent-text);font-weight:700}
input[type=search]{width:100%;padding:11px 14px;font-size:16px;border:1px solid var(--border);border-radius:10px;background:var(--card);color:var(--text);outline:none;margin:8px 0 12px}
input:focus{border-color:var(--accent)}
.row{display:flex;gap:10px;align-items:center;padding:7px 10px;border-bottom:1px solid var(--border);font-size:14.5px;background:var(--card);flex-wrap:wrap}
.chips{display:flex;gap:5px;flex-wrap:wrap}.chip{font-size:12px;border-radius:999px;padding:1px 8px;border:1px solid var(--border);color:var(--text2)}
.chip.on{color:var(--accent-text);border-color:var(--accent)}
.links{margin-left:auto;flex:none;font-size:13.5px}
a{color:var(--accent-text)}
.back{display:inline-block}
#result{border:1px solid var(--border);border-radius:10px;overflow:hidden}
#result .hintline{padding:12px;color:var(--text2);background:var(--card)}
</style>
</head>
<body>
<div class="wrap">
<div class="top">
  <a class="back" href="index.html" data-i18n="pkgpage.back">← 返回定制器</a>
  <select id="lang" aria-label="Language"></select>
</div>
<h1><span data-i18n="pkgpage.title">软件包用途说明</span></h1>
<p class="note" id="intro"></p>

<h2 data-i18n="pkgpage.raw">一、全部原始软件包</h2>
<p class="note" data-i18n="pkgpage.rawNote"></p>
<input type="search" id="q" placeholder="iptables-mod / kmod-usb / luci-i18n …">
<div id="result"><div class="hintline" id="startHint"></div></div>

<h2 data-i18n="pkgpage.curated">二、精选插件</h2>
${curated}
</div>
<script>
var STR=${JSON.stringify(STR)};
var LANGS=${JSON.stringify(I18N.languages)};
var SRC=${JSON.stringify(SRC)};
var PKGS=${JSON.stringify(PKGS.pkgs)};
var PI=${JSON.stringify(PI18N.plugins)};
var PZH={}; // 精选表中文原文:启动时从 DOM 存底,切走语言后仍能回退 / zh originals captured from the DOM at startup so we can fall back after switching away
(function(){var i,e,ns=document.querySelectorAll('.pname'),ds=document.querySelectorAll('.pdesc');
for(i=0;i<ns.length;i++)PZH[ns[i].getAttribute('data-pid')]=[ns[i].textContent,''];
for(i=0;i<ds.length;i++){e=PZH[ds[i].getAttribute('data-pid')];if(e)e[1]=ds[i].textContent}})();
var CURATED=${PLUGINS.plugins.length}, RAW=${PKGS.count};
var NAMES=Object.keys(PKGS);
var lang=(function(){ // 与主页面共享语言偏好;无匹配默认英文 / shares the main page's language preference; unmatched defaults to English
  try{var v=localStorage.getItem('wrt_lang');if(v&&STR['pkgpage.title'][v])return v}catch(e){}
  var navs=navigator.languages||[navigator.language||''];
  // 中文细分与 app.js pickLang 对齐:zh-TW/HK/Hant* → 繁中,其余 zh 一律简中 / Chinese split mirrors app.js pickLang: zh-TW/HK/Hant* → Traditional, any other zh → Simplified
  for(var i=0;i<navs.length;i++){var n=navs[i];
    if(/^zh(-|$)/i.test(n))return /^zh-(TW|HK|Hant)/i.test(n)?'zh-TW':'zh-CN';
    if(STR['pkgpage.title'][n])return n;
    var b=n.split('-')[0];for(var j=0;j<LANGS.length;j++){if(LANGS[j].id===b||LANGS[j].id.split('-')[0]===b)return LANGS[j].id}}
  return 'en'})();
function T(k,p){var row=STR[k]||{};var s=row[lang]||row.en||row['zh-CN']||k;
  if(p)for(var key in p)s=s.split('{'+key+'}').join(p[key]);return s}
function applyLang(){
  document.documentElement.lang=lang;
  var els=document.querySelectorAll('[data-i18n]');
  for(var i=0;i<els.length;i++)els[i].textContent=T(els[i].getAttribute('data-i18n'));
  // 精选表:仅简中使用原文,繁中与其他语言使用各自译文 / only zh-CN uses originals; zh-TW and other languages use their translations
  var zh=(lang==='zh-CN'),id,e;
  var ns=document.querySelectorAll('.pname');
  for(i=0;i<ns.length;i++){id=ns[i].getAttribute('data-pid');e=PI[id]||{};
    ns[i].textContent=(!zh&&e.name&&(e.name[lang]||e.name.en))||PZH[id][0]}
  var ds=document.querySelectorAll('.pdesc');
  for(i=0;i<ds.length;i++){id=ds[i].getAttribute('data-pid');e=PI[id]||{};
    ds[i].textContent=(!zh&&e.desc&&(e.desc[lang]||e.desc.en))||PZH[id][1]}
  document.getElementById('intro').textContent=T('pkgpage.intro',{curated:CURATED,raw:RAW});
  var sh=document.getElementById('startHint');           // 搜索后该元素已被结果替换,需判空 / gone after the first search, must null-check
  if(sh)sh.textContent=T('pkgpage.hint.start',{n:RAW});
  render();
}
var sel=document.getElementById('lang');
var LANG_SHORT={'zh-CN':'简','zh-TW':'繁'}; // 下拉里中文用单字简称,与 app.js 对齐 / one-character Chinese labels in the dropdown, same as app.js
LANGS.forEach(function(l){var o=document.createElement('option');o.value=l.id;o.textContent=LANG_SHORT[l.id]||l.native||l.id;if(l.id===lang)o.selected=true;sel.appendChild(o)});
sel.addEventListener('change',function(){lang=sel.value;try{localStorage.setItem('wrt_lang',lang)}catch(e){}applyLang()});
var q=document.getElementById('q'),box=document.getElementById('result'),timer=0;
q.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(render,150)});
function render(){
  var kw=q.value.trim().toLowerCase();box.innerHTML='';
  if(kw.length<2){box.innerHTML='<div class="hintline"></div>';box.firstChild.textContent=T('pkgpage.hint.start',{n:RAW});return}
  var hits=NAMES.filter(function(n){return n.toLowerCase().indexOf(kw)>=0});
  hits.slice(0,500).forEach(function(n){
    var row=document.createElement('div');row.className='row';
    var chips=SRC.map(function(s){var st=PKGS[n][s.id];
      var title=s.label+' '+(st===undefined?T('pkgpage.chip.none'):st==='y'?T('pkgpage.chip.builtin'):T('pkgpage.chip.opt'));
      return '<span class="chip'+(st!==undefined?' on':'')+'" title="'+title.replace(/"/g,'&quot;')+'">'+s.label+(st==='y'?' ✓':'')+'</span>'}).join('');
    row.innerHTML='<code></code><span class="chips">'+chips+'</span>'+
      '<span class="links"><a href="https://openwrt.org/packages/pkgdata/'+encodeURIComponent(n)+'" target="_blank" rel="noopener">'+T('pkgpage.docs')+'</a> · '+
      '<a href="https://www.google.com/search?q='+encodeURIComponent('openwrt '+n+' package')+'" target="_blank" rel="noopener">'+T('pkgpage.searchLink')+'</a></span>';
    row.querySelector('code').textContent=n;
    box.appendChild(row);
  });
  var tail=document.createElement('div');tail.className='hintline';
  tail.textContent=hits.length?(T('pkgpage.hit',{n:hits.length})+(hits.length>500?T('pkgpage.hitMore'):'')):T('pkgpage.none');
  box.appendChild(tail);
}
applyLang();
</script>
</body>
</html>
`;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
// 输出到非站点目录时带上 favicon 方便预览 / bring the favicon along for out-of-site previews
if (dirname(OUT) !== join(ROOT, 'site', 'wrt') && existsSync(join(ROOT, 'site', 'wrt', 'Wei.G.ico'))) {
  copyFileSync(join(ROOT, 'site', 'wrt', 'Wei.G.ico'), join(dirname(OUT), 'Wei.G.ico'));
}
console.log(`packages.html -> ${OUT}(精选 ${PLUGINS.plugins.length} + 原始 ${PKGS.count},${Math.round(html.length / 1024)}KB,${I18N.languages.length} 语)`);
