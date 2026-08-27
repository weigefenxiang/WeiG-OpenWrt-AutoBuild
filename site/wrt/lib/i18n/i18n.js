/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Shared browser localization runtime.
 */
'use strict';

/* ============ 多语言 / i18n ============ */
function pickLang() {
  const avail = I18N.languages.map((l) => l.id);
  if (state.lang && avail.includes(state.lang)) return state.lang;
  for (const nav of navigator.languages || [navigator.language || '']) {
    // 中文细分:zh-TW/zh-HK/zh-Hant* → 繁中,其余 zh 一律简中 / Chinese split: zh-TW/zh-HK/zh-Hant* → Traditional, any other zh → Simplified
    if (/^zh(-|$)/i.test(nav)) return /^zh-(TW|HK|Hant)/i.test(nav) ? 'zh-TW' : 'zh-CN';
    if (avail.includes(nav)) return nav;
    const base = nav.split('-')[0];
    const hit = avail.find((a) => a === base || a.split('-')[0] === base);
    if (hit) return hit;
  }
  return FALLBACK;   // 侦测不到匹配语言时默认英文(用户定) / unmatched browsers default to English (per user decision)
}
function t(key, params) {
  const row = I18N && I18N.strings[key];
  let s = row ? (row[state.lang] || row[FALLBACK] || row[SOURCE_LANG]) : key;
  if (params) for (const k in params) s = s.split('{' + k + '}').join(params[k]);
  return s;
}
async function ensureI18nLanguage(language) {
  const id = I18N.languages.some((entry) => entry.id === language) ? language : I18N.fallback;
  if (I18N.loaded.has(id)) return;
  const document = await loadJson(`i18n/${id}.json`);
  if (document.version !== 2 || document.language !== id || !document.strings) {
    throw new Error(`Invalid localization document: ${id}`);
  }
  for (const [key, value] of Object.entries(document.strings)) {
    (I18N.strings[key] ||= {})[id] = value;
  }
  I18N.loaded.add(id);
}
async function initializeI18n() {
  const manifest = await loadJson('i18n/index.json');
  if (manifest.version !== 2 || !Array.isArray(manifest.languages) || !manifest.languages.length) {
    throw new Error('Invalid localization manifest');
  }
  I18N = { ...manifest, strings: {}, loaded: new Set() };
  state.lang = pickLang();
  await Promise.all([...new Set([I18N.source, I18N.fallback, state.lang])].map(ensureI18nLanguage));
}
const formatList = (values) => values.join(t('format.listSeparator'));
const formatSemicolonList = (values) => values.join(t('format.semicolonSeparator'));
const isZh = () => String(state.lang).startsWith('zh');
const isZhCn = () => state.lang === 'zh-CN';

/* ============ Catalog 应用名称与说明 / Catalog application names and descriptions ============ */
function pName(p) {
  const value = p.nameI18n?.[state.lang] || p.nameI18n?.[FALLBACK] || p.name || p.id;
  return isZh() ? maskText(value) : value;
}
function pDesc(p) {
  const value = p.descI18n?.[state.lang] || p.descI18n?.[FALLBACK] || p.desc || '';
  return isZh() ? maskText(value) : value;
}

/* V8c:体积人性化显示,输入单位为 MB / V8c: human-readable size, input value in MB */
function fmtSize(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  const format = (number, unit) => {
    if (!number) return `0 ${unit}`;
    const exponent = Math.floor(Math.log10(Math.abs(number)));
    const decimals = exponent >= 0 ? Math.max(0, 2 - exponent) : Math.min(3, 2 - exponent);
    return `${number.toFixed(decimals)} ${unit}`;
  };
  if (value >= 1024 ** 3) return format(value / 1024 ** 3, 'GiB');
  if (value >= 1024 ** 2) return format(value / 1024 ** 2, 'MiB');
  if (value >= 1024) return format(value / 1024, 'KiB');
  return format(value, 'B');
}

function configuredProjectText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function applyProjectBranding() {
  const project = typeof PROJECT !== 'undefined' && PROJECT && typeof PROJECT === 'object' ? PROJECT : {};
  const shortName = configuredProjectText(project.shortName, 'Wei.G');
  const displayName = configuredProjectText(project.name, shortName);
  const title = `${displayName} · ${t('app.title')}`;
  const titleElement = document.querySelector('title[data-project-display-name], title');
  if (titleElement) titleElement.textContent = title;
  else document.title = title;
  document.querySelectorAll('[data-project-short-name]').forEach((element) => {
    element.textContent = shortName;
  });
  document.querySelectorAll('[data-project-short-name-attribute="alt"]').forEach((element) => {
    element.setAttribute('alt', shortName);
  });
  const translatedBlogWord = t('brand.blog');
  const blogWord = translatedBlogWord === 'brand.blog' ? 'Blog' : translatedBlogWord;
  const blogLabel = `${shortName} ${blogWord}`;
  document.querySelectorAll('[data-project-blog-aria]').forEach((element) => {
    element.setAttribute('aria-label', blogLabel);
    element.setAttribute('data-ui-tooltip-body', blogLabel);
  });
  document.querySelectorAll('[data-project-blog-label]').forEach((element) => {
    element.textContent = blogLabel;
  });
}

function applyI18n() {
  document.documentElement.lang = state.lang;
  applyProjectBranding();
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const value = t(el.dataset.i18n);
    // 缺词条时保留 HTML 中的人类可读兜底,绝不把 adv.grey.toggle 之类内部键名显示给用户 / Keep the human-readable HTML fallback when a key is missing; never expose internal keys such as adv.grey.toggle
    if (value !== el.dataset.i18n) el.textContent = value;
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.removeAttribute('title');
    bindUiTooltipContent(el, { body: t(el.dataset.i18nTitle) });
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = t('app.desc');
  if ($('catalogLocator')) {
    $('catalogLocator').placeholder = menuUi('locator');
    $('catalogLocator').setAttribute('aria-label', menuUi('locator'));
  }
  refreshTargetLabels();
  if ($('importReset')) $('importReset').textContent =
    t('runtime.71ed139e097f');
  if ($('importUnknownHint')) $('importUnknownHint').textContent = t('runtime.279cccfa9205');
  if ($('importUnknownSearch')) $('importUnknownSearch').placeholder =
    t('runtime.7125a3d6b707');
  if ($('importUnknownDisabledLabel')) $('importUnknownDisabledLabel').textContent =
    t('runtime.abfe46e1f08f');
  if ($('importUnknownMore')) $('importUnknownMore').textContent =
    t('runtime.a26bd51a0821');
  refreshMenuconfigFilterText();
  if ($('menuconfigStateHelp')) {
    const help = t('runtime.e1885f83e039');
    bindUiTooltipContent($('menuconfigStateHelp'), { body: help });
    $('menuconfigStateHelp').setAttribute('aria-label',
      t('runtime.31a0e02fd530'));
  }
  const defconfigEmphasis = t('runtime.f891591b9e6d');
  const defconfigHelp = t('runtime.095a4944190f');
  if ($('defconfigLabel')) $('defconfigLabel').textContent = 'D';
  if ($('defconfigSwitch')) {
    $('defconfigSwitch').removeAttribute('title');
    $('defconfigSwitch').dataset.uiTooltipTitle = 'D · Defconfig';
    $('defconfigSwitch').dataset.uiTooltipEmphasis = defconfigEmphasis;
    $('defconfigSwitch').dataset.uiTooltipBody = defconfigHelp;
    $('defconfigSwitch').setAttribute('aria-describedby', 'uiTooltip');
    $('defconfigSwitch').setAttribute('aria-label', `${defconfigEmphasis} ${defconfigHelp}`);
  }
  renderCatalogLoadState();
  bindUiTooltipContent($('advLabel'), { body: t('adv.title') });
  // Fork 提示内嵌两个链接,不能整段 textContent,需拆分文案后用 DOM 节点拼装 / The fork hint embeds two links, so the text is split and assembled from DOM nodes instead of one textContent
  const hint = $('selfHint');
  hint.textContent = '';
  const parts = t('mode.self.hint').split(t('mode.self.fork'));
  const mkA = (href, text) => { const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = text; return a; };
  const repo = targetRepoBase();
  if (parts.length === 2) {
    hint.appendChild(document.createTextNode(parts[0]));
    hint.appendChild(mkA('https://github.com/' + OFFICIAL_REPO + '/fork', t('mode.self.fork')));
    hint.appendChild(document.createTextNode(parts[1] + ' '));
  } else {
    hint.appendChild(document.createTextNode(t('mode.self.hint') + ' '));
  }
  hint.appendChild(mkA('https://github.com/' + OFFICIAL_REPO + '#fork-自建', t('mode.self.tutorial')));
  PAGE_SHELL_CONTROLLER?.refreshThemeControl();
  if (PLUGINS) {
    renderDevices();
    if (state.device && state.source) {
      renderSources();
      renderGroups();
      updateStats();
      updateLoginInfo();
    }
  }
  if ($('deviceFold')) $('deviceFold').textContent = t($('devicePicker').hidden ? 'fold.show' : 'fold.hide');
  updateDeviceSummary();
  renderFirmwareSettings();
}
function targetRepoBase() { return OFFICIAL_REPO; }

/* ============ 中文敏感词处理,仅中文界面生效,其他语言不改 / Sensitive-word masking, applied to the Chinese UI only ============ */
/* 中文敏感词直接替换为隐晦说法 / Chinese sensitive terms are replaced with euphemisms */
const ZH_SUB = [['科学上网', '魔法上网'], ['科学', '魔法'], ['代理', '魔法'], ['翻墙', '魔法'], ['梯子', '魔法']];
/* 英文品牌/协议名保留首尾、中间打星;按长度降序排序防止短词抢先匹配 / English brand/protocol names keep head and tail with stars between; sorted longest-first so short words cannot match early */
const EN_MASK = ['shadowsocks', 'wireguard', 'passwall', 'trojan', 'proxy', 'v2ray', 'socks', 'brook', 'clash', 'xray', 'vpn', 'ssr', 'tor']
  .sort((a, b) => b.length - a.length);
const EN_RE = new RegExp(EN_MASK.join('|'), 'gi');
function starMask(w) {
  if (/^wireguard$/i.test(w)) return w.slice(0, 3) + '***' + w.slice(-3);
  if (w.length <= 2) return w[0] + '*';
  if (w.length === 3) return w[0] + '*' + w[2];
  const stars = Math.min(Math.max(w.length - 3, 2), 4);
  return w.slice(0, 2) + '*'.repeat(stars) + w.slice(-1);
}
function maskText(s) {
  if (!isZh()) return String(s);            // 非中文界面完全不处理 / Non-Chinese UIs are left untouched
  let out = String(s);
  for (const [from, to] of ZH_SUB) out = out.split(from).join(to);
  return out.replace(EN_RE, starMask);
}
const groupLabel = (g) => maskText(t('group.' + g));
