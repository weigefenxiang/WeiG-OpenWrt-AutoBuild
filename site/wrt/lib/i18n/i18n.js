/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Shared browser localization runtime.
 */
'use strict';

/* ============ 多语言 / i18n ============ */
function uiLocaleEntry(language) {
  const tag = String(language || '').replaceAll('_', '-').toLowerCase();
  const exact = I18N.languages.find(entry => entry.id.toLowerCase() === tag);
  if (exact) return exact;
  // Longest explicit alias first: script/region variants never depend on registry order.
  const aliases = I18N.languages.flatMap(entry => (entry.aliases || []).map(alias => ({ entry, tag: alias.toLowerCase() })))
    .sort((a, b) => b.tag.length - a.tag.length);
  const alias = aliases.find(item => tag === item.tag || tag.startsWith(item.tag + '-'));
  if (alias) return alias.entry;
  try {
    const parsed = new Intl.Locale(tag);
    const regional = parsed.region && I18N.languages.find(entry =>
      entry.id.toLowerCase() === (parsed.language + '-' + parsed.region).toLowerCase());
    if (regional) return regional;
  } catch { /* Invalid browser tags simply fall through to base language/fallback. */ }
  const base = tag.split('-')[0];
  return I18N.languages.find(entry => entry.id.toLowerCase() === base) ||
    I18N.languages.find(entry => entry.id.toLowerCase().split('-')[0] === base);
}
function pickLang() {
  const preferred = state.lang && uiLocaleEntry(state.lang);
  if (preferred) return preferred.id;
  for (const nav of navigator.languages?.length ? navigator.languages : [navigator.language || '']) {
    const entry = uiLocaleEntry(nav);
    if (entry) return entry.id;
  }
  return I18N.fallback;
}
function t(key, params) {
  const row = I18N && I18N.strings[key];
  let s = row ? (row[state.lang] || row[FALLBACK] || row[SOURCE_LANG]) : key;
  if (params) for (const k in params) s = s.split('{' + k + '}').join(params[k]);
  return s;
}
async function ensureI18nLanguage(language) {
  const entry = I18N.languages.find((item) => item.id === language);
  if (!entry || entry.file !== entry.id + '.json.gz') throw new Error('Invalid localization asset: ' + language);
  const id = entry.id;
  if (I18N.loaded.has(id)) return;
  if (!I18N.loading.has(id)) {
    const pending = (async () => {
      const document = await loadJson('i18n/' + entry.file);
      if (document.version !== 2 || document.language !== id || !document.strings ||
          Object.keys(document.strings).length !== I18N.stringCount ||
          !Object.values(document.strings).every(value => typeof value === 'string' && value.trim())) {
        throw new Error('Invalid localization document: ' + id);
      }
      for (const [key, value] of Object.entries(document.strings)) (I18N.strings[key] ||= {})[id] = value;
      I18N.loaded.add(id);
    })().finally(() => I18N.loading.delete(id));
    I18N.loading.set(id, pending);
  }
  await I18N.loading.get(id);
}
async function loadUiLanguage(requested) {
  try {
    await ensureI18nLanguage(requested);
    return requested;
  } catch (error) {
    if (requested === I18N.fallback) throw error;
    await ensureI18nLanguage(I18N.fallback);
    return I18N.fallback;
  }
}
async function initializeI18n() {
  const manifest = await loadJson('i18n/index.json');
  if (manifest.version !== 3 || !Array.isArray(manifest.languages) || !manifest.languages.length ||
      !Number.isInteger(manifest.stringCount) || manifest.stringCount < 1) {
    throw new Error('Invalid localization manifest');
  }
  I18N = { ...manifest, strings: {}, loaded: new Set(), loading: new Map() };
  const requested = pickLang();
  I18N.selectedLanguage = requested;
  state.lang = await loadUiLanguage(requested);
}
const formatList = (values) => values.join(t('format.listSeparator'));
const formatSemicolonList = (values) => values.join(t('format.semicolonSeparator'));
const isZh = () => String(state.lang).startsWith('zh');
const isZhCn = () => state.lang === 'zh-CN';

/* ============ Catalog 应用名称与说明 / Catalog application names and descriptions ============ */
function pName(p) {
  const value = p.nameI18n?.[state.lang] || p.nameI18n?.[FALLBACK] || p.name || p.id;
  return displayText(value);
}
function pDesc(p) {
  const value = p.descI18n?.[state.lang] || p.descI18n?.[FALLBACK] || p.desc || '';
  return displayText(value);
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
  document.documentElement.dir = I18N.languages.find(entry => entry.id === state.lang)?.dir || 'ltr';
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
  renderForkHint();
  refreshLanguageControl();
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

/* Fork navigation uses text tokens, never translated HTML or unvalidated URLs. */
function renderForkHint() {
  const hint = $('selfHint');
  if (!hint || !PROJECT) return;
  hint.textContent = '';
  const owner = String(state.owner || '').trim();
  const validOwner = BUILD_IDENTITY_MODULE.isValidGithubOwner(owner);
  const base = validOwner ? 'https://github.com/' + owner + '/' + REPO_NAME : '';
  const mkA = (href, text) => {
    const node = document.createElement(href ? 'a' : 'strong');
    if (href) { node.href = href; node.target = '_blank'; node.rel = 'noopener'; }
    node.textContent = text;
    return node;
  };
  const tokens = {
    fork: () => mkA('https://github.com/' + OFFICIAL_REPO + '/fork', t('mode.self.fork')),
    settings: () => mkA(base ? base + '/settings' : '', 'Settings'),
    actions: () => mkA(base ? base + '/actions' : '', 'Actions'),
    issues: () => mkA('', 'Issues'),
    features: () => mkA('', 'Features'),
    enable: () => {
      const node = mkA(base ? base + '/actions' : '', t('mode.self.enableLabel'));
      if (base) node.className = 'workflow-enable-label';
      return node;
    },
  };
  const template = t('mode.self.steps');
  let offset = 0;
  for (const match of template.matchAll(/\{(\w+)\}/g)) {
    hint.append(document.createTextNode(template.slice(offset, match.index)));
    hint.append(tokens[match[1]]?.() || document.createTextNode(match[0]));
    offset = match.index + match[0].length;
  }
  hint.append(document.createTextNode(template.slice(offset) + ' '));
  if (PROJECT?.links?.guide) hint.appendChild(mkA(PROJECT.links.guide, t('mode.self.tutorial')));
}

let languageFloatingController = null;
function refreshLanguageControl() {
  const button = $('langSel');
  if (!button || !I18N) return;
  const id = state.lang;
  const entry = I18N.languages.find((item) => item.id === id);
  button.textContent = LANG_SHORT[id] || id.split('-')[0].toUpperCase();
  button.setAttribute('aria-label', t('lang.label') + ': ' + (entry?.native || id));
}
async function selectUiLanguage(id) {
  const entry = I18N.languages.find((item) => item.id === id);
  if (!entry) return;
  const effective = await loadUiLanguage(id);
  I18N.selectedLanguage = id;
  state.lang = effective;
  safeSet('wrt_lang', id);
  if (MENU_CATALOG?.menu?.displayLoaded) {
    await ensureCatalogMenuLanguage(state.lang).catch((error) => console.warn('[Catalog language shard]', error));
  }
  applyI18n();
}
function renderLangSel() {
  const button = $('langSel');
  const panel = $('languagePanel');
  const search = $('languageSearch');
  const list = $('languageList');
  const more = $('languageMore');
  let showMore = false;
  let switching = false;
  const close = () => {
    languageFloatingController?.close();
    button.setAttribute('aria-expanded', 'false');
  };
  const render = () => {
    const needle = search.value.trim().toLocaleLowerCase();
    list.textContent = '';
    panel.scrollTop = 0;
    search.placeholder = t('lang.search');
    more.textContent = t(showMore ? 'lang.less' : 'lang.more', {
      count: I18N.languages.filter(entry => !entry.common).length,
    });
    more.hidden = Boolean(needle);
    const entries = I18N.languages.filter((entry) =>
      (needle || showMore || entry.common) &&
      (!needle || [entry.id, entry.native, entry.name].join(' ').toLocaleLowerCase().includes(needle)));
    for (const entry of entries) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'language-option';
      option.dataset.language = entry.id;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(entry.id === state.lang));
      option.textContent = entry.native || entry.name;
      option.dir = entry.dir;
      option.onclick = async () => {
        if (switching) return;
        switching = true;
        panel.setAttribute('aria-busy', 'true');
        try { await selectUiLanguage(entry.id); close(); button.focus(); }
        catch (error) { showToast(error.message); }
        finally { switching = false; panel.removeAttribute('aria-busy'); }
      };
      list.append(option);
    }
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.textContent = t('lang.noResults');
      list.append(empty);
    }
    languageFloatingController?.update();
  };
  languageFloatingController = globalThis.createFloatingLayerController(button, panel, {
    preset: 'bounded-card', minWidth: 0, placements: ['left', 'above', 'below', 'right'], align: 'end',
    onDismiss: () => button.setAttribute('aria-expanded', 'false'),
  });
  search.addEventListener('input', render);
  more.onclick = () => { showMore = !showMore; render(); };
  panel.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const options = [...list.querySelectorAll('[role=option]')];
    if (!options.length) return;
    const index = options.indexOf(document.activeElement);
    const next = event.key === 'ArrowDown' ? (index + 1) % options.length
      : (index <= 0 ? options.length : index) - 1;
    event.preventDefault(); options[next].focus();
  });
  button.onclick = (event) => {
    event.stopPropagation();
    if (languageFloatingController?.isOpen) { close(); return; }
    search.value = ''; showMore = false; render();
    languageFloatingController?.open();
    button.setAttribute('aria-expanded', 'true');
    search.focus();
  };
  refreshLanguageControl();
}

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
  let out = String(s ?? '');
  if (!isZh()) return out;                  // 非中文界面完全不处理 / Non-Chinese UIs are left untouched
  for (const [from, to] of ZH_SUB) out = out.split(from).join(to);
  return out.replace(EN_RE, starMask);
}
/* 所有用户可见的源码/包名/说明统一从这里进入显示层；不得用于 Kconfig、搜索或导出值。 /
 * Every user-visible source/package/description string enters this display layer;
 * never use it for Kconfig, search, or export values. */
function displayText(value) {
  return maskText(value);
}
/*
 * Format an internal Catalog identity for a user-facing diagnostic.  Catalog
 * relations deliberately use two different namespaces: `PACKAGE_<name>` is
 * a concrete package/Kconfig symbol while a bare package name can be a
 * virtual capability (for example `libudev`).  Adding CONFIG_ to every input
 * collapses those namespaces and produces invalid names such as
 * CONFIG_libudev.  Keep the conversion typed and conservative: callers must
 * identify a bare value as a Kconfig symbol, concrete package, or virtual
 * capability.  Unknown bare values stay unchanged instead of being guessed.
 */
function configIdentity(symbol, { kind = '' } = {}) {
  const raw = String(symbol ?? '').trim();
  if (!raw) return { raw: '', kind: kind || 'empty', configSymbol: '', packageName: '' };
  if (kind === 'virtual') {
    const name = raw.replace(/^CONFIG_(?:PACKAGE_)?/, '');
    return { raw, kind, configSymbol: '', packageName: name };
  }
  if (raw.startsWith('CONFIG_')) {
    const configSymbol = raw.slice('CONFIG_'.length);
    const packageName = configSymbol.startsWith('PACKAGE_') ? configSymbol.slice(8) : '';
    return { raw, kind: packageName ? 'package' : 'config', configSymbol, packageName };
  }
  if (raw.startsWith('PACKAGE_')) {
    return { raw, kind: 'package', configSymbol: raw, packageName: raw.slice(8) };
  }
  if (kind === 'virtual') return { raw, kind, configSymbol: '', packageName: raw };
  if (kind === 'package') return { raw, kind, configSymbol: `PACKAGE_${raw}`, packageName: raw };
  if (kind === 'config') return { raw, kind, configSymbol: raw, packageName: '' };
  return { raw, kind: kind || 'unknown', configSymbol: '', packageName: raw };
}
function displayPackageName(packageName) {
  const identity = configIdentity(packageName, { kind: 'package' });
  return displayText(identity.packageName || identity.raw);
}
function displayConfigSymbol(symbol, options = {}) {
  const identity = configIdentity(symbol, options);
  if (!identity.raw) return '';
  if (!['config', 'package'].includes(identity.kind)) return displayText(identity.raw);
  return displayText(`CONFIG_${identity.configSymbol}`);
}
const groupLabel = (g) => {
  const key = 'group.' + g;
  const translated = t(key);
  return displayText(translated === key ? g : translated);
};
