/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
+ *
+ * Shared browser localization runtime.
+ */
+'use strict';

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
const uiText = (zhCN, zhTW, en) => state.lang === 'zh-CN' ? zhCN : state.lang === 'zh-TW' ? zhTW : en;
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

function applyI18n() {
  document.documentElement.lang = state.lang;
  document.title = 'Wei.G · ' + t('app.title');   // 品牌名不随语言变 / brand name stays across languages
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
    uiText('恢复上传原值', '還原上傳原值', 'Restore uploaded values');
  if ($('importUnknownHint')) $('importUnknownHint').textContent = uiText(
    'Catalog 未收录这些配置项，不自动推断依赖。关闭会写入 “is not set”；删除配置行则交给所选源码的构建系统决定默认值。',
    'Catalog 未收錄這些設定項，不自動推斷相依性。關閉會寫入 “is not set”；刪除設定列則交由所選原始碼的建置系統決定預設值。',
    'These items are not in the Catalog, so dependencies are not inferred. Disable writes “is not set”; deleting a line leaves the default to the selected upstream build system.');
  if ($('importUnknownSearch')) $('importUnknownSearch').placeholder =
    uiText('搜索 CONFIG 名称', '搜尋 CONFIG 名稱', 'Search CONFIG symbol');
  if ($('importUnknownDisabledLabel')) $('importUnknownDisabledLabel').textContent =
    uiText('显示已关闭项', '顯示已關閉項目', 'Show disabled');
  if ($('importUnknownMore')) $('importUnknownMore').textContent =
    uiText('再显示 50 项', '再顯示 50 項', 'Show 50 more');
  refreshMenuconfigFilterText();
  if ($('menuconfigStateHelp')) {
    const help = uiText(
      'N：禁用，不编译。\nM：模块化或编译为可安装软件包，默认不写入固件。\nY：启用并编译进固件。',
      'N：停用，不編譯。\nM：模組化或編譯為可安裝軟體套件，預設不寫入韌體。\nY：啟用並編譯進韌體。',
      'N: Disabled; not built.\nM: Modular or built as an installable package; not included in the firmware by default.\nY: Enabled and built into the firmware.');
    bindUiTooltipContent($('menuconfigStateHelp'), { body: help });
    $('menuconfigStateHelp').setAttribute('aria-label',
      uiText('N、M、Y 状态说明', 'N、M、Y 狀態說明', 'N, M, and Y state help'));
  }
  const defconfigEmphasis = uiText(
    '⚠ 当前版本加载时已完成基准配置解析。通常直接在现有结果上增减即可，无需开启 D。',
    '⚠ 目前版本載入時已完成基準設定解析。通常直接在現有結果上增減即可，無需開啟 D。',
    '⚠ The current version baseline is already resolved when loaded. Normally you can adjust the existing result directly without enabling D.');
  const defconfigHelp = uiText(
    '开启 D 会在构建前重新执行 Defconfig，按当前选择补齐 Kconfig 默认值和依赖，可能把你手工删减的默认项重新补回。',
    '開啟 D 會在建置前重新執行 Defconfig，依目前選擇補齊 Kconfig 預設值與相依性，可能把你手動刪減的預設項目重新補回。',
    'Enabling D reruns Defconfig before the build, refilling Kconfig defaults and dependencies from the current selection and potentially restoring defaults you removed manually.');
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
