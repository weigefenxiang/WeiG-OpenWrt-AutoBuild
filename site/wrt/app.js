/*
 * OpenWrt 固件在线定制器前端脚本,由 site/wrt/index.html 直接加载 / Front-end script of the online firmware customizer, loaded directly by site/wrt/index.html.
 * Catalog/插件/文案数据来自 data/ 下的 JSON,带多级 CDN 回退与 localStorage 缓存 / Catalog/plugin/i18n data comes from JSON under data/, with tiered CDN fallback and localStorage caching.
 * 无构建步骤、无第三方依赖,以原生 ES 语法直接在浏览器运行 / No build step, no third-party deps; runs as plain native ES in the browser.
 */
'use strict';

/* ============ 常量 / Constants ============ */
let OFFICIAL_REPO = 'weigefenxiang/WeiG-OpenWrt-AutoBuild';
let REPO_NAME = OFFICIAL_REPO.split('/')[1];
let PROJECT = null;
const BRANCH = 'main';
const FALLBACK = 'en';               // 译文缺失时的兜底语言 / Fallback language when a translation is missing
const SOURCE_LANG = 'zh-CN';         // 源语言,词条必须完整 / Source language; its entries must be complete
const GROUP_ICONS = {
  '系统基础': '🧱', '魔法与加速': '🚀', '广告过滤与DNS': '🛡️', '内网穿透与组网': '🌐',
  '存储与下载': '💾', '多媒体与外设': '🎵', '网络管理': '⚙️',
  '监控统计': '📊', '管控与安全': '🔒', '定时与唤醒': '⏰',
  '校园网认证': '🎓', '系统工具': '🧰', '其他与高级': '🧩',
};
const COMMON_TIMEZONES = [
  'Etc/GMT+12', 'Pacific/Pago_Pago', 'Pacific/Honolulu', 'America/Anchorage',
  'America/Los_Angeles', 'America/Vancouver', 'America/Denver', 'America/Phoenix',
  'America/Chicago', 'America/Mexico_City', 'America/New_York', 'America/Toronto',
  'America/Halifax', 'America/Caracas', 'America/Santiago', 'America/St_Johns',
  'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'Atlantic/South_Georgia',
  'Atlantic/Azores', 'Atlantic/Cape_Verde', 'Etc/GMT', 'Europe/London', 'Africa/Casablanca',
  'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid', 'Africa/Lagos',
  'Europe/Athens', 'Europe/Helsinki', 'Europe/Bucharest', 'Africa/Cairo', 'Africa/Johannesburg',
  'Europe/Moscow', 'Europe/Istanbul', 'Asia/Riyadh', 'Africa/Nairobi', 'Asia/Tehran',
  'Asia/Dubai', 'Asia/Baku', 'Asia/Kabul', 'Asia/Karachi', 'Asia/Tashkent',
  'Asia/Kolkata', 'Asia/Colombo', 'Asia/Kathmandu', 'Asia/Dhaka', 'Asia/Yangon',
  'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Taipei',
  'Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Manila', 'Australia/Perth',
  'Asia/Tokyo', 'Asia/Seoul', 'Australia/Darwin', 'Australia/Adelaide',
  'Australia/Brisbane', 'Australia/Sydney', 'Pacific/Guam', 'Pacific/Noumea',
  'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Tongatapu', 'Pacific/Kiritimati',
];

const state = {
  device: null,
  source: null,        // 当前选中的源对象 / Currently selected source object
  version: null,       // 当前选中的版本对象 / Currently selected version object
  variant: null,       // 当前选中的变体对象 / Currently selected variant object
  sel: new Set(),      // 用户勾选的插件 id,含高级模式强制项 / Plugin ids checked by the user, incl. advanced-mode forced items
  removed: new Set(),  // 高级模式下被取消勾选的内置项 id / Builtin plugin ids deselected in advanced mode
  advanced: localStorage.getItem('wrt_adv') === '1',
  lang: localStorage.getItem('wrt_lang') || '',
  mode: localStorage.getItem('wrt_mode') || 'official',
  owner: localStorage.getItem('wrt_owner') || '',
  lanip: localStorage.getItem('wrt_lanip') || '192.168.1.1',   // 后台登录地址,默认 192.168.1.1 / admin LAN IP, defaults to 192.168.1.1
  rootpw: '',
  rootpwAuto: false,
  timezone: '',
  theme: '@base',
  minimumBoot: true,
  useDefconfig: true,
  ntp: 'cn',
  opkg: 'auto',
  siteVersion: 'v----------',
  importedConfig: null,
  importedConfigId: '',
};
const LANIP_RE = /^(192\.168|10\.\d{1,3}|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}$/;   // 仅接受内网 IPv4 / private IPv4 only
let PLUGINS = null, I18N = null, TIMEZONES = null, MINIMUM_BOOT = null,
  CONFIG_RULES = null, BUILD_REQUIREMENTS = null;
const configRuleChoices = new Map();
const acceptedBuildRequirements = new Set();
let PACKAGE_MIRRORS = { presets: [{ id: 'auto', label: { 'zh-CN': '跟随源码默认', en: 'Follow source default' }, roots: {} }] };
let MENU_INDEX = null, MENU_CATALOG = null, CATALOG_ENGINE = null, CATALOG_MODEL = null;
let CATALOG_LOADER_MODULE = null, CATALOG_SCHEMA6_MODULE = null, CATALOG_LOADER = null;
let catalogShardLoader = null, catalogMenuLoadingPromise = null;
let catalogHiddenLoadingPromise = null, catalogHelpLoadingPromise = null;
let menuCatalogKey = '', menuLoadingKey = '', menuCatalogSeq = 0, menuCatalogPromise = null;
let menuCatalogAbortController = null, menuIndexAbortController = null;
let menuIndexProvider = '', menuAssetProvider = '';
let catalogLoadMode = 'idle', catalogLoadError = '', catalogLoadDiagnostics = [];
let menuPath = null, menuParent = '', menuExpanded = false, menuSelectedExpanded = false;
let buildContractExpanded = false;
let menuVisibleLimit = 80, menuHistory = [], menuBreadcrumb = [];
const menuValues = new Map();
// menuTouched is the full explicit output layer (user, recommended, imported repairs,
// and dependency closure). User intent is tracked separately so upstream defaults never
// inflate the curated-plugin counter.
const menuTouched = new Set();
const catalogBaselineValues = new Map();
const catalogBaselineOrigins = new Map();
const catalogContractOrigins = new Map();
const catalogRecommendedValues = new Map();
const catalogDependencySymbols = new Set();
const catalogImportedSymbols = new Set();
const catalogUserOverrides = new Map();
// Profile packages are applied automatically by the Catalog. Keep their package names
// separate so changing Target/Profile cannot leak the previous target's contract.
const catalogProfilePackageSymbols = new Set();
const catalogContractSymbols = new Set();
let menuOriginFilter = 'all';
const menuImportedOriginal = new Map();
const menuImportedNonDefault = new Set();
const importedConfigValues = new Map();
const importedUnknownOriginal = new Map();
const importedUnknownEdits = new Map();
let importedUnknownLimit = 50, importedTargetVerified = true, importingConfig = false;
let menuOptionBySymbol = new Map(), menuTargetSymbols = new Set();
let menuExactPaths = new Map(), menuChildPaths = new Map(), menuDescendants = new Map();
let menuChoiceOptions = new Map(), menuChildrenByParent = new Map(), menuNestedCounts = new Map();
let menuSearchText = new Map(), menuSearchOptions = [];
let catalogSearchWorker = null, catalogSearchGeneration = 0, catalogSearchRequestId = 0;
let catalogSearchWorkerReady = false, catalogSearchPending = new Set(), catalogSearchResults = new Map();
let catalogLocatorEntryCache = null;
let catalogStateRevision = 0, catalogContextCache = new Map(), catalogContextCacheBypass = false;
let menuVisibilityRevision = -1, menuVisibilityCache = new Map(), menuMaxLevelCache = new Map();
const minimumBootOriginal = new Map();
const minimumBootTouchedOriginal = new Set();
let minimumBootApplying = false;
let minimumBootModalOpen = false;
let MENU_CATALOG_REPO = 'weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog';
const MENU_PAGE_SIZE = 80;
const LANG_SHORT = {
  'zh-CN': '简', 'zh-TW': '繁', en: 'EN', ru: 'RU', es: 'ES', pt: 'PT',
  ja: '日', ko: '한', de: 'DE', fr: 'FR', vi: 'VI',
};
const MENU_UI_I18N = {
  top: {
    'zh-CN': '主菜单', 'zh-TW': '主選單', en: 'Top level', ru: 'Главное меню',
    es: 'Menú principal', pt: 'Menu principal', ja: 'メインメニュー', ko: '주 메뉴',
    de: 'Hauptmenü', fr: 'Menu principal', vi: 'Menu chính',
  },
  locator: {
    'zh-CN': '搜索 Source、Branch、Target System、Subtarget 或 Target Profile',
    'zh-TW': '搜尋 Source、Branch、Target System、Subtarget 或 Target Profile',
    en: 'Search Source, Branch, Target System, Subtarget or Target Profile',
    ru: 'Поиск Source, Branch, Target System, Subtarget или Target Profile',
    es: 'Buscar Source, Branch, Target System, Subtarget o Target Profile',
    pt: 'Pesquisar Source, Branch, Target System, Subtarget ou Target Profile',
    ja: 'Source、Branch、Target System、Subtarget、Target Profile を検索',
    ko: 'Source, Branch, Target System, Subtarget 또는 Target Profile 검색',
    de: 'Source, Branch, Target System, Subtarget oder Target Profile suchen',
    fr: 'Rechercher Source, Branch, Target System, Subtarget ou Target Profile',
    vi: 'Tìm Source, Branch, Target System, Subtarget hoặc Target Profile',
  },
  min2: {
    'zh-CN': '请输入至少 2 个字符', 'zh-TW': '請輸入至少 2 個字元', en: 'Type at least 2 characters',
    ru: 'Введите не менее 2 символов', es: 'Escribe al menos 2 caracteres', pt: 'Digite pelo menos 2 caracteres',
    ja: '2文字以上入力してください', ko: '2자 이상 입력하세요', de: 'Mindestens 2 Zeichen eingeben',
    fr: 'Saisissez au moins 2 caractères', vi: 'Nhập ít nhất 2 ký tự',
  },
};
const menuUi = (key) => MENU_UI_I18N[key]?.[state.lang] || MENU_UI_I18N[key]?.en || key;
const TARGET_FIELD_I18N = {
  source: {
    'zh-CN': '源码', 'zh-TW': '原始碼', ru: 'Источник', es: 'Fuente', pt: 'Fonte',
    ja: 'ソース', ko: '소스', de: 'Quelle', fr: 'Source', vi: 'Nguồn',
  },
  branch: {
    'zh-CN': '分支', 'zh-TW': '分支', ru: 'Ветка', es: 'Rama', pt: 'Ramificação',
    ja: 'ブランチ', ko: '브랜치', de: 'Branch', fr: 'Branche', vi: 'Nhánh',
  },
  system: {
    'zh-CN': '目标系统', 'zh-TW': '目標系統', ru: 'Целевая система', es: 'Sistema de destino',
    pt: 'Sistema de destino', ja: 'ターゲットシステム', ko: '대상 시스템',
    de: 'Zielsystem', fr: 'Système cible', vi: 'Hệ thống đích',
  },
  subtarget: {
    'zh-CN': '子目标', 'zh-TW': '子目標', ru: 'Подцель', es: 'Subdestino', pt: 'Subalvo',
    ja: 'サブターゲット', ko: '하위 대상', de: 'Unterziel', fr: 'Sous-cible', vi: 'Đích con',
  },
  profile: {
    'zh-CN': '目标配置', 'zh-TW': '目標設定', ru: 'Целевой профиль', es: 'Perfil de destino',
    pt: 'Perfil de destino', ja: 'ターゲットプロファイル', ko: '대상 프로필',
    de: 'Zielprofil', fr: 'Profil cible', vi: 'Hồ sơ đích',
  },
};
const DEFAULT_TARGET_SELECTORS = [
  { id: 'system', labelEn: 'Target System', labelZh: '目标系统' },
  { id: 'subtarget', labelEn: 'Subtarget', labelZh: '子目标' },
  { id: 'profile', labelEn: 'Target Profile', labelZh: '目标配置' },
];
let targetSelectorValues = {};
let catalogTargetMismatch = false;
const INITIAL_CATALOG_TARGET = {
  sourceId: 'ImmortalWrt', branch: 'openwrt-25.12',
  system: 'x86', subtarget: '64', profileSymbol: 'DEVICE_generic',
};
let catalogInitialTargetPending = true;
const DATA_CACHE_VERSION = 'v21-d102-ui-layout';
const NTP_PRESETS = {
  cn: ['ntp.aliyun.com', 'time1.cloud.tencent.com', 'cn.ntp.org.cn', 'cn.pool.ntp.org'],
  global: ['0.openwrt.pool.ntp.org', '1.openwrt.pool.ntp.org', '2.openwrt.pool.ntp.org', '3.openwrt.pool.ntp.org'],
  cloudflare: ['time.cloudflare.com', 'time.google.com', 'time.apple.com', 'pool.ntp.org'],
};
const MAINLAND_PACKAGE_MIRRORS = ['ustc', 'pku', 'tuna', 'bfsu'];
let opkgSelectionExplicit = false;
function mirrorPreset(id) {
  return (PACKAGE_MIRRORS?.presets || []).find((preset) => preset.id === id) || null;
}
function packageMirrorRoot(id, sourceId = state.source?.id) {
  const preset = mirrorPreset(id);
  if (!preset) return null;
  if (id === 'auto') return '@default';
  const root = preset.roots?.[sourceId];
  return /^[A-Za-z0-9.-]+(?:\/[A-Za-z0-9._/-]+)?$/.test(root || '') ? root : null;
}
function packageMirrorEntries(sourceId = state.source?.id) {
  return (PACKAGE_MIRRORS?.presets || [])
    .filter((preset) => packageMirrorRoot(preset.id, sourceId))
    .map((preset) => [preset.id, preset.label?.[state.lang === 'zh-CN' ? 'zh-CN' : 'en'] || preset.label?.en || preset.id]);
}
function defaultPackageMirrorId(sourceId = state.source?.id) {
  if (state.timezone !== 'Asia/Shanghai') return 'auto';
  return MAINLAND_PACKAGE_MIRRORS.find((id) => packageMirrorRoot(id, sourceId)) || 'auto';
}
let PLUG_I18N = null;                  // 插件名/说明多语言表,非中文界面按需加载 / plugin name/desc i18n table, lazy-loaded for non-Chinese UIs
let pluginDataPath = '';                  // 当前插件索引来源，避免跨设备误复用 / current plugin-index source; prevents cross-device cache reuse
let plugI18nLoading = false;           // 防止重复请求 / guards against duplicate fetches
let devAllowGrey = false;              // V10:灰色插件二级门禁,不落盘,每次都从未勾开始 / V10: second gate for grey plugins; never persisted, always starts unticked
const collapsed = new Set();

const $ = (id) => document.getElementById(id);
const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* 存储满或被禁用时静默忽略 / Silently ignore when storage is full or disabled */ } };

/* ============ 多语言 / i18n ============ */
function pickLang() {
  if (state.lang && I18N.strings['app.title'] && I18N.strings['app.title'][state.lang]) return state.lang;
  const avail = I18N.languages.map((l) => l.id);
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
const uiText = (zhCN, zhTW, en) => state.lang === 'zh-CN' ? zhCN : state.lang === 'zh-TW' ? zhTW : en;
const isZh = () => String(state.lang).startsWith('zh');
const isZhCn = () => state.lang === 'zh-CN';

/* ============ 插件名/说明多语言 / Plugin name & description i18n ============ */
/* 非中文界面惰性加载 plugins-i18n.json,一次性缓存;失败静默回退原文 / Lazily load plugins-i18n.json for non-Chinese UIs, cache once; fall back to original text silently on failure */
function ensurePlugI18n() {
  if (isZhCn() || PLUG_I18N || plugI18nLoading) return;
  plugI18nLoading = true;
  loadJson('plugins-i18n.json')
    .then((d) => { PLUG_I18N = d; if (PLUGINS) renderGroups(); })
    .catch(() => { /* 加载失败静默回退原文,下次语言切换可重试 / Silent fallback to original text; next language switch may retry */ })
    .finally(() => { plugI18nLoading = false; });
}
/* 简中使用元数据原文;繁中与其他语言使用独立译文。中文界面继续执行敏感词显示处理 / zh-CN uses metadata originals; zh-TW and other languages use their own translations. Chinese UIs keep display masking. */
function pName(p) {
  if (isZhCn()) return maskText(p.name);
  const row = PLUG_I18N && PLUG_I18N.plugins && PLUG_I18N.plugins[p.id];
  const m = row && row.name;
  const value = (m && (m[state.lang] || m[FALLBACK])) || p.id;
  return isZh() ? maskText(value) : value;
}
function pDesc(p) {
  if (isZhCn()) return maskText(p.desc || '');
  const row = PLUG_I18N && PLUG_I18N.plugins && PLUG_I18N.plugins[p.id];
  const m = row && row.desc;
  const value = (m && (m[state.lang] || m[FALLBACK])) || '';
  return isZh() ? maskText(value) : value;
}

/* V8c:体积人性化显示,输入单位为 MB / V8c: human-readable size, input value in MB */
function fmtSize(mb) {
  const value = Math.max(0, Number(mb) || 0);
  const format = (number, unit) => {
    if (!number) return `0 ${unit}`;
    const exponent = Math.floor(Math.log10(Math.abs(number)));
    const decimals = exponent >= 0 ? Math.max(0, 2 - exponent) : Math.min(3, 2 - exponent);
    return `${number.toFixed(decimals)} ${unit}`;
  };
  if (value >= 1000) return format(value / 1024, 'GB');
  if (value >= 1) return format(value, 'MB');
  const kb = value * 1024;
  if (kb >= 1) return format(kb, 'KB');
  return format(kb * 1024, 'B');
}

function applyI18n() {
  ensurePlugI18n();   // 非中文界面需要插件译名,未加载则触发并在完成后重渲染 / non-Chinese UIs need translated plugin names; trigger the load, re-render on completion
  document.documentElement.lang = state.lang;
  document.title = 'Wei.G · ' + t('app.title');   // 品牌名不随语言变 / brand name stays across languages
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const value = t(el.dataset.i18n);
    // 缺词条时保留 HTML 中的人类可读兜底,绝不把 adv.grey.toggle 之类内部键名显示给用户 / Keep the human-readable HTML fallback when a key is missing; never expose internal keys such as adv.grey.toggle
    if (value !== el.dataset.i18n) el.textContent = value;
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
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
  if ($('menuconfigOriginFilter')) {
    const labels = [
      ['all', uiText('全部来源', '全部來源', 'All origins')],
      ['user', uiText('用户选择', '使用者選擇', 'User selected')],
      ['excluded', uiText('明确排除', '明確排除', 'Explicitly excluded')],
      ['target', uiText('Target / Profile', 'Target / Profile', 'Target / Profile')],
      ['default', uiText('上游默认', '上游預設', 'Upstream defaults')],
      ['recommended', uiText('网页推荐', '網頁推薦', 'Recommended')],
      ['dependency', uiText('自动依赖', '自動相依', 'Dependencies')],
      ['imported', uiText('导入配置', '匯入設定', 'Imported')],
    ];
    for (const [value, label] of labels) {
      const option = [...$('menuconfigOriginFilter').options].find((item) => item.value === value);
      if (option) option.textContent = label;
    }
    const label = $('menuconfigOriginFilter').closest('label')?.querySelector('span');
    if (label) label.textContent = uiText('来源', '來源', 'Origin');
  }
  if ($('menuconfigStateHelp')) {
    const help = uiText(
      'N：禁用，不编译。\nM：模块化或编译为可安装软件包，默认不写入固件。\nY：启用并编译进固件。',
      'N：停用，不編譯。\nM：模組化或編譯為可安裝軟體套件，預設不寫入韌體。\nY：啟用並編譯進韌體。',
      'N: Disabled; not built.\nM: Modular or built as an installable package; not included in the firmware by default.\nY: Enabled and built into the firmware.');
    $('menuconfigStateHelp').dataset.help = help;
    $('menuconfigStateHelp').setAttribute('aria-label',
      uiText('N、M、Y 状态说明', 'N、M、Y 狀態說明', 'N, M, and Y state help'));
  }
  if ($('minimumBootLabel')) $('minimumBootLabel').textContent =
    uiText('推荐项', '推薦項', 'Recommended');
  if ($('minimumBootConfig')) $('minimumBootConfig').textContent =
    uiText('配置', '設定', 'Configure');
  const defconfigHelp = uiText(
    '根据当前 Target / Subtarget / Profile 解析 Kconfig 默认值和依赖，补齐设备基准配置（驱动、分区、UBI 等），降低缺失配置导致构建失败或固件不可用的风险。仍须确认机型，不能保证绝对防砖。',
    '依目前 Target / Subtarget / Profile 解析 Kconfig 默认值与依赖，补齐设备基准设定（驱动、分区、UBI 等），降低设定缺失导致建置失败或固件不可用的风险。仍须确认机型，不能保证绝对防砖。',
    'Resolve Kconfig defaults and dependencies for the selected Target / Subtarget / Profile to fill the device baseline (drivers, partitions, UBI, and more). This lowers the risk of missing settings, but you must still verify the device; it cannot guarantee safe flashing.');
  if ($('defconfigLabel')) $('defconfigLabel').textContent = 'Defconfig';
  if ($('defconfigSwitch')) {
    $('defconfigSwitch').title = defconfigHelp;
    $('defconfigSwitch').dataset.help = defconfigHelp;
    $('defconfigSwitch').setAttribute('aria-label', defconfigHelp);
  }
  renderCatalogLoadState();
  $('advLabel').title = t('adv.title');
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
  applyThemeIcon();
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

/* ============ 数据加载 / Data loading ============ */
function dataUrls(path) {
  if (path.includes('..') || !/^[\w./-]+$/.test(path)) throw new Error('非法数据路径: ' + path);
  return [
    './data/' + path,
    'https://cdn.jsdelivr.net/gh/' + OFFICIAL_REPO + '@' + BRANCH + '/site/wrt/data/' + path,
    'https://raw.githubusercontent.com/' + OFFICIAL_REPO + '/' + BRANCH + '/site/wrt/data/' + path,
  ];
}
async function fetchData(path) {
  for (const u of dataUrls(path)) {
    try { const r = await fetch(u, { cache: 'no-cache' }); if (r.ok) return r; } catch (e) { /* 失败则回退到下一级镜像 / Fall through to the next mirror tier */ }
  }
  throw new Error('数据加载失败: ' + path);
}
async function loadJson(path) {
  const key = 'wrt_cache:' + DATA_CACHE_VERSION + ':' + path;
  const cached = localStorage.getItem(key);
  const refresh = async () => {
    const text = await (await fetchData(path)).text();
    if (text !== cached) {
      safeSet(key, text);
      // i18n 在 init 最前加载,此时还不能用旧 I18N 弹更新提示 / i18n loads before I18N is initialized, so do not toast through the stale table
      if (cached && path !== 'i18n.json') showToast(t('toast.dataUpdated'));
    }
    return text;
  };
  // 文案必须网络优先,否则新增键会在本次页面继续使用旧 localStorage;断网时才回退缓存 / Strings are network-first so new keys take effect in the current page; use cache only when offline
  if (path === 'i18n.json') {
    try { return JSON.parse(await refresh()); }
    catch (e) { if (cached) return JSON.parse(cached); throw e; }
  }
  if (cached) { refresh().catch(() => {}); return JSON.parse(cached); }
  return JSON.parse(await refresh());
}

/* ============ 轻提示 / Toast ============ */
let toastTimer = 0;
function showToast(msg, kind = '') {
  const el = $('toast');
  el.textContent = msg;
  el.classList.toggle('toast-device', kind === 'device');
  el.hidden = false;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show', 'toast-device'); el.hidden = true; }, 2800);
}

/* ============ 气泡说明 / Info popover ============ */
const popover = $('popover');
function showPopover(anchor, title, body) {
  $('popTitle').textContent = title;
  $('popBody').textContent = body;
  popover.hidden = false;
  const r = anchor.getBoundingClientRect();
  const pw = Math.min(320, window.innerWidth - 24);
  let left = r.left + window.scrollX;
  if (left + pw > window.scrollX + window.innerWidth - 12) left = window.scrollX + window.innerWidth - pw - 12;
  popover.style.left = left + 'px';
  popover.style.top = (r.bottom + window.scrollY + 8) + 'px';
}
function hidePopover() { popover.hidden = true; }
document.addEventListener('click', (e) => {
  if (!popover.hidden && !popover.contains(e.target) && !e.target.closest('.info')) hidePopover();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hidePopover(); closeModal(); } });
window.addEventListener('scroll', hidePopover, { passive: true });

function makePill(label, infoTitle, infoBody, onSelect) {
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'pill';
  pill.setAttribute('aria-pressed', 'false');
  pill.appendChild(document.createTextNode(label));
  if (infoBody) {
    const info = document.createElement('span');
    info.className = 'info';
    info.textContent = 'ⓘ';
    info.setAttribute('role', 'button');
    info.setAttribute('tabindex', '0');
    info.setAttribute('aria-label', label);
    const show = (e) => { e.preventDefault(); e.stopPropagation(); showPopover(pill, infoTitle, infoBody); };
    info.addEventListener('click', show);
    info.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') show(e); });
    pill.appendChild(info);
    pill.addEventListener('dblclick', () => showPopover(pill, infoTitle, infoBody));
  }
  pill.addEventListener('click', onSelect);
  return pill;
}
function setActive(row, pill) {
  row.querySelectorAll('.pill').forEach((p) => { p.classList.remove('pill-active'); p.setAttribute('aria-pressed', 'false'); });
  pill.classList.add('pill-active');
  pill.setAttribute('aria-pressed', 'true');
}

/* ============ 初始化 / Init ============ */
async function init() {
  try {
    [CATALOG_ENGINE, CATALOG_LOADER_MODULE, CATALOG_SCHEMA6_MODULE] = await Promise.all([
      import('./lib/catalog-engine.js?v=5b3e3c15d9'),
      import('./lib/catalog-loader.js?v=319e7a7c96'),
      import('./lib/catalog-schema6.js?v=0a165903c2'),
    ]);
    I18N = await loadJson('i18n.json');
    state.lang = pickLang();
    renderLangSel();
    try {
      PROJECT = await loadJson('project.json');
      if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(PROJECT.repository || '')) {
        OFFICIAL_REPO = PROJECT.repository;
        REPO_NAME = OFFICIAL_REPO.split('/')[1];
      }
      if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(PROJECT.catalogRepository || '')) {
        MENU_CATALOG_REPO = PROJECT.catalogRepository;
      }
      const repoUrl = `https://github.com/${OFFICIAL_REPO}`;
      $('repoLink').href = repoUrl;
      $('footRepo').href = repoUrl;
      $('actionsLink').href = `${repoUrl}/actions`;
      document.querySelectorAll('.blog-link').forEach((link) => {
        if (/^https?:\/\//.test(PROJECT.blogUrl || '')) link.href = PROJECT.blogUrl;
      });
    } catch (e) { /* old deployments keep the built-in project defaults */ }
    CATALOG_LOADER = CATALOG_LOADER_MODULE.createCatalogLoader({
      repository: MENU_CATALOG_REPO,
      releaseTag: PROJECT.catalogReleaseTag || 'menuconfig-catalog-complete',
      engine: CATALOG_ENGINE,
    });
    [PLUGINS, TIMEZONES, MENU_INDEX, MINIMUM_BOOT, PACKAGE_MIRRORS, CONFIG_RULES,
      BUILD_REQUIREMENTS] = await Promise.all([
      loadJson('seed/plugins.json'), loadJson('timezones.json'),
      loadJson('menuconfig-index.json'), loadJson('minimum-boot.json'),
      loadJson('package-mirrors.json').catch(() => PACKAGE_MIRRORS),
      loadJson('config-rules.json'),
      loadJson('source-build-requirements.json'),
    ]);
    initializeTimezone();
    MENU_INDEX = stableCatalogIndex(MENU_INDEX);
    try {
      const stamp = await loadJson('site-version.json');
      if (/^v\d{10}$/.test(stamp.version)) state.siteVersion = stamp.version;
    } catch (e) { /* 旧部署没有版本文件时保持占位符 / old deployments keep the placeholder */ }
    document.querySelectorAll('.site-version-value').forEach((node) => {
      node.textContent = state.siteVersion;
    });
    resetPluginWorkspace(PLUGINS, 'seed/plugins.json');
    renderDevices();
    renderModes();
    renderFirmwareSettings();
    initDeviceFold();
    initMenuconfigControls();
    initBuildContractControls();
    initCatalogLocator();
    $('minimumBootToggle').checked = state.minimumBoot;
    initMinimumBoot();
    $('defconfigToggle').checked = state.useDefconfig;
    initDefconfig();
    applyI18n();
    $('advMode').checked = state.advanced;
    resetAdvGrey();   // V10:门禁行随记忆的开发者模式显隐,但永远从未勾开始 / V10: gate row follows the remembered developer mode, but always starts unticked
    $('loading').hidden = true;
    $('form').hidden = false;
    $('actionbar').hidden = false;
    if (localStorage.getItem('wrt_risk') !== 'ok') $('riskBar').hidden = false;
    refreshMenuIndex();
  } catch (err) {
    $('loading').textContent = (I18N ? t('loading.fail', { msg: err.message }) : '加载失败: ' + err.message);
  }
}

function renderLangSel() {
  const sel = $('langSel');
  sel.textContent = '';
  for (const l of I18N.languages) {
    const o = document.createElement('option');
    o.value = l.id;
    o.dataset.fullName = l.native || l.name;
    o.textContent = LANG_SHORT[l.id] || l.id.slice(0, 2).toUpperCase();
    if (l.id === state.lang) o.selected = true;
    sel.appendChild(o);
  }
  const setNames = (full) => {
    for (const option of sel.options) {
      option.textContent = full ? option.dataset.fullName :
        (LANG_SHORT[option.value] || option.value.slice(0, 2).toUpperCase());
    }
  };
  sel.onpointerdown = () => setNames(true);
  sel.onfocus = () => setNames(true);
  sel.onblur = () => setNames(false);
  sel.onchange = async () => {
    state.lang = sel.value;
    safeSet('wrt_lang', state.lang);
    if (MENU_CATALOG?.menu?.displayLoaded) {
      await ensureCatalogMenuLanguage(state.lang).catch((error) => console.warn('[Catalog language shard]', error));
    }
    applyI18n();
    setTimeout(() => setNames(false), 0);
  };
}

function resetPluginWorkspace(data, path) {
  PLUGINS = data;
  pluginDataPath = path;
  state.sel.clear();
  state.removed.clear();
  collapsed.clear();
  for (const group of PLUGINS?.groups || []) collapsed.add(group);
}

let switchSeq = 0;
async function switchDevice(dev, first, notify = false) {
  const seq = ++switchSeq;
  state.device = dev;
  const path = dev.plugins === 'seed' ? 'seed/plugins.json' : dev.id + '/plugins.json';
  const data = PLUGINS && pluginDataPath === path ? PLUGINS : await loadJson(path);
  if (seq !== switchSeq) return;
  resetPluginWorkspace(data, path);
  renderDevices();
  renderSources();
  renderGroups();
  updateStats();
  updateLoginInfo();
  updateSubmitGate();
  if (!first && notify) showToast(t('toast.deviceSwitched', { name: dev.name }), 'device');
}

function fillTargetSelect(id, rows, valueOf, labelOf, preferred) {
  const select = $(id);
  if (!select) return '';
  const previous = select.value;
  const values = [];
  for (const row of rows) {
    const value = valueOf(row);
    if (!values.some((item) => item.value === value)) values.push({ value, label: labelOf(row) });
  }
  select.textContent = '';
  for (const item of values) {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    select.appendChild(option);
  }
  if (values.some((item) => item.value === preferred)) select.value = preferred;
  else if (values.some((item) => item.value === previous)) select.value = previous;
  const label = select.closest('label');
  if (label) {
    label.hidden = values.length === 0;
    label.classList.toggle('target-single', values.length === 1);
  }
  select.disabled = values.length === 1;
  return select.value;
}

function targetControlId(id) {
  const known = { system: 'targetSystem', subtarget: 'targetSubtarget', profile: 'targetProfile' };
  return known[id] || `targetExtra_${String(id).replace(/[^A-Za-z0-9_-]/g, '_')}`;
}
function targetFieldTranslation(id, selector = null) {
  const localized = selector?.i18n?.[state.lang] || TARGET_FIELD_I18N[id]?.[state.lang];
  if (state.lang === 'en' || !localized) return '';
  return localized;
}
function applyTargetFieldTranslation(element, id, selector = null) {
  if (!element) return;
  element.classList.remove('menu-translation');
  element.removeAttribute('data-translation');
  element.removeAttribute('tabindex');
  applyMenuTranslation(element, targetFieldTranslation(id, selector));
}
function refreshTargetLabels() {
  applyTargetFieldTranslation($('targetSourceLabel'), 'source');
  applyTargetFieldTranslation($('targetBranchLabel'), 'branch');
  document.querySelectorAll('[data-target-field]').forEach((element) => {
    applyTargetFieldTranslation(element, element.dataset.targetField, element.targetSelector);
  });
}
function ensureTargetSelectorControls(schema = DEFAULT_TARGET_SELECTORS) {
  const container = $('targetDynamicSelectors');
  if (!container) return;
  for (const select of container.querySelectorAll('select[data-target-selector]')) {
    targetSelectorValues[select.dataset.targetSelector] = select.value;
  }
  container.textContent = '';
  for (const selector of schema) {
    const label = document.createElement('label');
    const safeId = String(selector.id).replace(/[^A-Za-z0-9_-]/g, '_');
    label.className = `target-field target-${safeId}`;
    if (!['system', 'subtarget', 'profile'].includes(selector.id)) label.classList.add('target-extra');
    const title = document.createElement('span');
    title.textContent = selector.labelEn || selector.id;
    title.dataset.targetField = selector.id;
    title.targetSelector = selector;
    applyTargetFieldTranslation(title, selector.id, selector);
    const select = document.createElement('select');
    select.id = targetControlId(selector.id);
    select.dataset.targetSelector = selector.id;
    label.append(title, select);
    container.appendChild(label);
  }
}
function targetControlElements() {
  return [$('targetSource'), $('targetBranch'),
    ...document.querySelectorAll('#targetDynamicSelectors select')].filter(Boolean);
}
function fallbackTargetTree(catalog) {
  const systems = [];
  for (const target of catalog?.targets || []) {
    let system = systems.find((item) => item.value === target.board);
    if (!system) {
      system = { value: target.board, labelEn: target.systemName || target.board, children: [] };
      systems.push(system);
    }
    system.children.push({
      value: target.subtarget || 'default',
      labelEn: target.subtargetLabel || target.subtargetName || target.subtarget || 'Default',
      targetId: target.id,
      children: (target.profiles || []).filter((profile) => profile.selectable !== false).map((profile) => ({
        value: profile.id, labelEn: profile.name || profile.id, profileId: profile.id,
        selector: profile.selector, aliasesEn: profile.aliases || [],
      })),
    });
  }
  return systems;
}
function renderCatalogTargetSelectors(preferred = {}) {
  const schema = MENU_CATALOG?.targetSelectors?.length
    ? MENU_CATALOG.targetSelectors : DEFAULT_TARGET_SELECTORS;
  ensureTargetSelectorControls(schema);
  let nodes = MENU_CATALOG?.targetTree?.length
    ? MENU_CATALOG.targetTree : fallbackTargetTree(MENU_CATALOG);
  const selectedNodes = new Map();
  const strict = preferred.strictCatalogTarget === true || preferred.initialCatalogTarget === true;
  catalogTargetMismatch = false;
  for (const selector of schema) {
    const selectId = targetControlId(selector.id);
    const preferredValue = selector.id === 'profile'
      ? preferred[`${selector.id}Symbol`] || preferred[selector.id] || targetSelectorValues[selector.id]
      : preferred[selector.id] || preferred[`${selector.id}Symbol`] || targetSelectorValues[selector.id];
    const value = fillTargetSelect(selectId, nodes, (item) => item.value,
      (item) => item.labelEn || item.value,
      preferredValue);
    if (strict && preferredValue && value !== preferredValue) {
      catalogTargetMismatch = true;
      const select = $(selectId);
      if (select) select.value = '';
      targetSelectorValues[selector.id] = '';
      nodes = [];
      continue;
    }
    targetSelectorValues[selector.id] = value;
    const selected = nodes.find((item) => item.value === value);
    if (selected) selectedNodes.set(selector.id, selected);
    nodes = selected?.children || [];
  }
  const system = targetSelectorValues.system || '';
  const subtarget = targetSelectorValues.subtarget || '';
  const targetNode = selectedNodes.get('subtarget');
  const target = (MENU_CATALOG?.targets || []).find((item) =>
    item.id === targetNode?.targetId || (item.board === system && item.subtarget === subtarget));
  const profileId = selectedNodes.get('profile')?.profileId || targetSelectorValues.profile || '';
  const profile = target?.profiles?.find((item) => item.id === profileId) ||
    (!(target?.profiles || []).length ? { id: '', name: 'Default profile', packages: [] } : null);
  return { target, profile, values: { ...targetSelectorValues }, valid: !catalogTargetMismatch };
}

function stableCatalogIndex(index) {
  const sources = (index?.sources || []).map((source) => ({
    ...source,
    branches: [...(source.branches || [])]
      .sort((a, b) => b.branch.localeCompare(a.branch, undefined, { numeric: true })),
  })).filter((source) => source.branches.length);
  return { ...index, sources };
}
function safeCatalogAsset(asset) {
  return CATALOG_LOADER_MODULE.safeCatalogAsset(asset);
}
function catalogBranchFromIndex(index, sourceId, branchName) {
  const source = index?.sources?.find((item) => item.id === sourceId);
  const branch = source?.branches?.find((item) =>
    item.branch === branchName || item.id === branchName);
  return { source, branch };
}
async function fetchCatalogIndex(signal, forceRefresh = false) {
  const remote = await CATALOG_LOADER.fetchIndex({ signal, forceRefresh });
  menuIndexProvider = remote.provider;
  const index = stableCatalogIndex(remote.index);
  index.catalogRepo = MENU_CATALOG_REPO;
  index.loadedFrom = remote.url;
  index.catalogProvider = remote.provider;
  return { data: index, url: remote.url, provider: remote.provider, diagnostics: remote.diagnostics };
}
async function fetchCatalogBundle(source, branch, signal, forceRefresh = false) {
  const remote = await CATALOG_LOADER.fetchBundle({
    sourceId: source?.id || '',
    branchName: branch?.branch || branch?.id || '',
    signal,
    forceRefresh,
    preferredAssetProvider: menuAssetProvider,
  });
  menuIndexProvider = remote.indexProvider;
  menuAssetProvider = remote.provider === 'cache' ? menuAssetProvider : remote.provider;
  remote.index = stableCatalogIndex(remote.index);
  remote.index.catalogRepo = MENU_CATALOG_REPO;
  remote.index.loadedFrom = remote.url;
  remote.index.catalogProvider = remote.indexProvider;
  return remote;
}
async function refreshMenuIndex() {
  menuIndexAbortController?.abort();
  const abortController = new AbortController();
  menuIndexAbortController = abortController;
  try {
    const previousSourceId = $('targetSource')?.value || '';
    const previousBranchId = $('targetBranch')?.value || '';
    const previousSource = MENU_INDEX?.sources?.find((item) => item.id === previousSourceId);
    const previousBranch = previousSource?.branches?.find((item) => item.id === previousBranchId);
    const previousCatalogContract = previousBranch ? {
      hash: String(previousBranch.hash || previousBranch.sha256 || previousBranch.compressedSha256 || ''),
      bytes: String(previousBranch.bytes || previousBranch.size || previousBranch.compressedBytes || ''),
      commit: String(previousBranch.commit || ''),
    } : null;
    const previousCatalogKey = menuCatalogKey;
    const previousCatalogAsset = previousBranch?.asset || '';
    const localSources = MENU_INDEX?.sources || [];
    const remote = await fetchCatalogIndex(abortController.signal);
    const index = stableCatalogIndex(remote.data);
    if (index.schema >= 2 && Array.isArray(index.sources) && index.sources.length) {
      for (const source of localSources) {
        if (index.sources.some((item) => item.id === source.id)) continue;
        index.sources.push({
          ...source,
          branches: source.branches.map((branch) => ({
            ...branch, state: 'unavailable', errorStage: 'catalog-refresh-required',
          })),
        });
      }
      index.catalogRepo = MENU_CATALOG_REPO;
      index.loadedFrom = remote.url;
      MENU_INDEX = index;
      if (!importingConfig) {
        const activeSource = index.sources.find((item) => item.id === previousSourceId);
        const activeBranch = activeSource?.branches?.find((item) => item.id === previousBranchId);
        const activeCatalogContract = activeBranch ? {
          hash: String(activeBranch.hash || activeBranch.sha256 || activeBranch.compressedSha256 || ''),
          bytes: String(activeBranch.bytes || activeBranch.size || activeBranch.compressedBytes || ''),
          commit: String(activeBranch.commit || ''),
        } : null;
        const sameCatalogContract = previousCatalogContract && activeCatalogContract &&
          ['hash', 'bytes', 'commit'].every((field) =>
            previousCatalogContract[field] === activeCatalogContract[field]);
        const sameCatalog = Boolean(
          MENU_CATALOG && previousCatalogKey && activeBranch &&
          previousCatalogKey === `${activeSource.id}/${activeBranch.branch}` &&
          previousCatalogAsset === (activeBranch.asset || '') && sameCatalogContract,
        );
        if (!sameCatalog) {
          MENU_CATALOG = null;
          menuCatalogKey = '';
        }
        renderDevices();
        renderCatalogLocatorResults();
      }
    }
  } catch (e) { /* 远程 Catalog 暂不可用时继续使用仓库内回退清单 / keep the bundled locator while remote providers are unavailable */ }
  finally {
    if (menuIndexAbortController === abortController) menuIndexAbortController = null;
  }
}
function selectedCatalogSource() {
  return MENU_INDEX?.sources.find((item) => item.id === $('targetSource').value) || MENU_INDEX?.sources[0];
}
function selectedCatalogBranch(source = selectedCatalogSource()) {
  return source?.branches.find((item) => item.id === $('targetBranch').value) || source?.branches[0];
}
function currentCatalogContract() {
  const source = selectedCatalogSource();
  const branch = selectedCatalogBranch(source);
  const revision = String(MENU_INDEX?.assetRef || '').trim().toLowerCase();
  const legacy = CATALOG_LOADER_MODULE.legacyCatalogContract(branch);
  const sourceRepository = String(source?.repo || '').trim();
  const sourceCommit = String(branch?.commit || '').trim().toLowerCase();
  if (!source || !branch || !legacy || !/^[0-9a-f]{40}$/.test(revision) ||
      !/^[0-9a-f]{64}$/.test(legacy.hash) || !Number.isSafeInteger(legacy.bytes) || legacy.bytes <= 0 ||
      legacy.catalogSchema < 5 || legacy.relationsSchema < 2 ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(sourceRepository) ||
      !/^[0-9a-f]{40}$/.test(sourceCommit)) {
    throw new Error(uiText(
      '当前分支缺少构建验证所需的旧版 Catalog 精确契约，请等待 Catalog 发布完成后重试。',
      '目前分支缺少建置驗證所需的舊版 Catalog 精確契約，請等待 Catalog 發佈完成後重試。',
      'This branch lacks the exact legacy Catalog contract required for build validation. Wait for Catalog publishing to finish and try again.'));
  }
  return {
    repository: String(MENU_INDEX.catalogRepo || MENU_CATALOG_REPO),
    revision,
    asset: legacy.asset,
    compressedSha256: legacy.hash,
    compressedBytes: legacy.bytes,
    catalogSchema: legacy.catalogSchema,
    relationsSchema: legacy.relationsSchema,
    sourceRepository,
    sourceCommit,
  };
}
function catalogBranchLabel(branch) {
  if (branch.state === 'stale') return `⚠ ${branch.branch} · stale`;
  if (branch.state === 'unavailable') return `✕ ${branch.branch} · unavailable`;
  return branch.branch;
}
function showCatalogStatus(branch, catalog = MENU_CATALOG) {
  const status = $('menuconfigStatus');
  const stateName = branch?.state || (catalog?.source?.commit === 'local-demo' ? 'fallback' : 'fresh');
  status.className = `hint catalog-${stateName}`;
  status.title = branch?.runUrl || '';
  if (stateName === 'unavailable') {
    status.textContent = `Unavailable · failed at ${branch.errorStage || 'unknown'}`;
  } else if (stateName === 'stale') {
    status.textContent = `Stale · last success ${branch.lastSuccessAt || 'unknown'}` +
      ` · failed at ${branch.errorStage || 'unknown'}`;
  } else {
    const count = catalog?.counts?.menuOptions || catalog?.menu?.options?.length || 0;
    status.textContent = `${stateName === 'fallback' ? 'Local fallback · ' : 'Fresh · '}${count} options` +
    (catalog?.source?.commit ? ` · ${catalog.source.commit.slice(0, 8)}` : '');
  }
}
const menuPathKey = (path) => path.join('\u0001');
function menuLabelMeta(name) {
  return MENU_CATALOG?.menu?.labels?.[name] || { en: name, zhCN: '' };
}
function menuPathLabel(name) {
  const row = menuLabelMeta(name);
  return String(row.en || name || '').trim();
}
function menuOptionLabel(option) {
  const prompt = String(option.promptEn || option.prompt || '').trim();
  if (prompt) return prompt;
  return String(option.symbol || '').replace(/^PACKAGE_/, '').replaceAll('_', ' ').trim();
}
function menuOptionTranslation(option) {
  if (option.symbol?.startsWith('PACKAGE_') && PLUGINS?.plugins && state.source) {
    const packageName = option.symbol.slice(8);
    const plugin = PLUGINS.plugins.find((item) =>
      (item.pkgs?.[state.source.id] || item.pkg) === packageName);
    if (plugin) {
      const row = PLUG_I18N?.plugins?.[plugin.id];
      const desc = state.lang === 'zh-CN' ? plugin.desc
        : state.lang === 'en' ? '' : row?.desc?.[state.lang] || '';
      const title = state.lang === 'zh-CN' ? plugin.name
        : state.lang === 'en' ? '' : row?.name?.[state.lang] || '';
      return { title, usage: desc };
    }
  }
  return {
    title: option.promptI18n?.[state.lang] || (state.lang === 'zh-CN' ? option.promptZh : ''),
    usage: option.usageI18n?.[state.lang] || (state.lang === 'zh-CN' ? option.usageZh : ''),
  };
}
function applyMenuTranslation(element, chinese, usageChinese = '', mobileChip = false) {
  const lines = [String(chinese || '').trim(), String(usageChinese || '').trim()].filter(Boolean);
  if (state.lang === 'en' || !lines.length) return element;
  element.classList.add('menu-translation');
  element.dataset.translation = lines.join('\n');
  if (!element.hasAttribute('tabindex')) element.tabIndex = 0;
  if (mobileChip) {
    const chip = document.createElement('span');
    chip.className = 'menu-translation-chip';
    chip.textContent = isZh() ? '译' : 'Tr';
    chip.setAttribute('aria-label', isZh() ? '显示译文' : 'Show translation');
    element.appendChild(chip);
  }
  return element;
}
function showMenuTooltip(element) {
  if (state.lang === 'en' || !element?.dataset.translation) return;
  showMenuPopup(element, element.dataset.translation);
}
function menuOptionPopupText(element) {
  if (!element?.dataset.symbol) return '';
  return [
    element.dataset.fullText || element.textContent.trim(),
    state.lang === 'en' ? '' : element.dataset.translation || '',
    `${uiText('索引', '索引', 'Index')}: CONFIG_${element.dataset.symbol}`,
  ].filter(Boolean).join('\n');
}
function showMenuOptionTooltip(element) {
  const text = menuOptionPopupText(element);
  if (text) showMenuPopup(element, text);
}
function showMenuHelp(element) {
  if (!element?.dataset.help) return;
  showMenuPopup(element, element.dataset.help);
}
function showMenuPopup(element, text) {
  const tooltip = $('menuTooltip');
  if (!tooltip || !text) return;
  tooltip.textContent = text;
  tooltip.hidden = false;
  const rect = element.getBoundingClientRect();
  const tipRect = tooltip.getBoundingClientRect();
  const margin = 8;
  const left = Math.min(Math.max(margin, rect.left), innerWidth - tipRect.width - margin);
  const below = rect.bottom + margin;
  const top = below + tipRect.height <= innerHeight - margin
    ? below : Math.max(margin, rect.top - tipRect.height - margin);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}
function hideMenuTooltip() {
  const tooltip = $('menuTooltip');
  if (!tooltip) return;
  tooltip.hidden = true;
  tooltip.textContent = '';
  tooltip.style.removeProperty('left');
  tooltip.style.removeProperty('top');
}
function catalogDiagnosticsText() {
  const source = selectedCatalogSource();
  const branch = selectedCatalogBranch(source);
  const detail = CATALOG_LOADER_MODULE?.formatCatalogDiagnostics(catalogLoadDiagnostics) || '';
  return [
    `Catalog repository: ${MENU_CATALOG_REPO}`,
    `Selection: ${source?.id || '(unknown)'}/${branch?.branch || branch?.id || '(unknown)'}`,
    `Page: ${location.href}`,
    `Online: ${navigator.onLine}`,
    `Browser gzip: ${typeof DecompressionStream === 'function'}`,
    `Cache API: ${Boolean(globalThis.caches?.open)}`,
    `Error: ${catalogLoadError || '(unknown)'}`,
    detail,
  ].filter(Boolean).join('\n');
}
function renderCatalogLoadState() {
  const box = $('catalogLoadState');
  if (!box) return;
  const failed = catalogLoadMode === 'error';
  box.hidden = catalogLoadMode === 'idle';
  box.disabled = !failed;
  box.dataset.state = catalogLoadMode;
  box.title = failed ? catalogLoadError : '';
  $('targetPicker')?.setAttribute('aria-busy', String(catalogLoadMode === 'loading'));
  if ($('catalogLoadText')) {
    $('catalogLoadText').textContent = failed
      ? uiText('Catalog 加载失败，点击重试', 'Catalog 載入失敗，點擊重試',
        'Catalog failed to load. Click to retry')
      : uiText('正在加载 Target 与 menuconfig…', '正在載入 Target 與 menuconfig…',
        'Loading Target and menuconfig…');
  }
  const details = $('catalogLoadDetails');
  if (details) details.hidden = !failed;
  if ($('catalogLoadDiagnostics')) $('catalogLoadDiagnostics').textContent = failed ? catalogDiagnosticsText() : '';
  if ($('catalogCopyDiagnostics')) {
    $('catalogCopyDiagnostics').textContent = uiText('复制诊断', '複製診斷', 'Copy diagnostics');
  }
}
function setCatalogLoadState(mode, error = '', diagnostics = []) {
  catalogLoadMode = mode;
  catalogLoadError = String(error?.message || error || '');
  catalogLoadDiagnostics = Array.isArray(diagnostics) ? [...diagnostics] : [];
  if (mode !== 'idle') {
    $('targetDynamicSelectors').textContent = '';
    $('menuconfigBox').hidden = true;
  }
  renderCatalogLoadState();
  renderCatalogLocatorResults();
  updateSubmitGate();
}
async function copyCatalogDiagnostics() {
  const text = catalogDiagnosticsText();
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    const button = $('catalogCopyDiagnostics');
    if (button) {
      button.textContent = uiText('已复制', '已複製', 'Copied');
      setTimeout(() => renderCatalogLoadState(), 1200);
    }
  } catch (error) {
    console.error('[Catalog diagnostics copy failed]', error);
  }
}
async function retryCatalogLoad() {
  if (catalogLoadMode !== 'error') return;
  const source = selectedCatalogSource();
  const branch = selectedCatalogBranch(source);
  if (!source || !branch) return;
  menuIndexAbortController?.abort();
  menuCatalogAbortController?.abort();
  await CATALOG_LOADER.clearCache();
  menuIndexProvider = '';
  menuAssetProvider = '';
  MENU_CATALOG = null;
  CATALOG_MODEL = null;
  menuCatalogKey = '';
  menuLoadingKey = '';
  loadCatalog(source, branch, true, null, { forceRefresh: true }).catch(() => {});
}
function addMenuIndex(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}
function markCatalogStateChanged() {
  catalogStateRevision++;
  catalogContextCache.clear();
  menuVisibilityRevision = -1;
  menuVisibilityCache.clear();
  menuMaxLevelCache.clear();
}
function indexSearchText(option, text) {
  menuSearchText.set(option.symbol, String(text || '').toLowerCase());
}
function stopCatalogSearchWorker() {
  catalogSearchWorker?.terminate?.();
  catalogSearchWorker = null;
  catalogSearchWorkerReady = false;
  catalogSearchPending.clear();
  catalogSearchResults.clear();
}
function startCatalogSearchWorker() {
  stopCatalogSearchWorker();
  if (!globalThis.Worker || !menuSearchText.size) return;
  const generation = ++catalogSearchGeneration;
  try {
    catalogSearchWorker = new Worker('./lib/catalog-search-worker.js?v=b1e611c48d');
  } catch (error) {
    console.warn('[Catalog search worker unavailable]', error);
    catalogSearchWorker = null;
    return;
  }
  catalogSearchWorker.onmessage = (event) => {
    const message = event.data || {};
    if (message.generation !== generation || generation !== catalogSearchGeneration) return;
    if (message.type === 'ready') {
      catalogSearchWorkerReady = true;
      const query = $('menuconfigSearch')?.value?.trim().toLowerCase() || '';
      if (query.length >= 2) requestCatalogSearch(query);
      return;
    }
    if (message.type !== 'result') return;
    catalogSearchPending.delete(message.query);
    catalogSearchResults.set(message.query, message.symbols || []);
    while (catalogSearchResults.size > 24) catalogSearchResults.delete(catalogSearchResults.keys().next().value);
    if (($('menuconfigSearch')?.value?.trim().toLowerCase() || '') === message.query) renderMenuconfig();
  };
  catalogSearchWorker.onerror = (error) => {
    console.warn('[Catalog search worker failed]', error.message || error);
    stopCatalogSearchWorker();
    if (menuExpanded) renderMenuconfig();
  };
  catalogSearchWorker.postMessage({
    type: 'init', generation,
    rows: [...menuSearchText.entries()],
  });
}
function requestCatalogSearch(query) {
  const normalized = String(query || '').trim().toLowerCase();
  if (!catalogSearchWorkerReady || normalized.length < 2 || catalogSearchPending.has(normalized) ||
      catalogSearchResults.has(normalized)) return;
  catalogSearchPending.add(normalized);
  catalogSearchWorker.postMessage({
    type: 'query', generation: catalogSearchGeneration,
    requestId: ++catalogSearchRequestId, query: normalized,
  });
}
function searchMenuOptions(query) {
  const normalized = String(query || '').trim().toLowerCase();
  if (normalized.length < 2) return [];
  if (catalogSearchWorker) {
    requestCatalogSearch(normalized);
    const symbols = catalogSearchResults.get(normalized);
    return symbols ? symbols.map((symbol) => menuOptionBySymbol.get(symbol)).filter(Boolean) : null;
  }
  return menuSearchOptions.filter((option) => menuSearchText.get(option.symbol)?.includes(normalized));
}
async function ensureCatalogMenuLoaded(includeHidden = false) {
  if (!MENU_CATALOG?.splitAssets) return true;
  if (!MENU_CATALOG.menu?.displayLoaded) {
    if (!catalogMenuLoadingPromise) {
      const catalog = MENU_CATALOG;
      const model = CATALOG_MODEL;
      const loader = catalogShardLoader;
      const catalogKey = menuCatalogKey;
      const task = (async () => {
        const language = state.lang;
        const [menuShard, languageShard] = await Promise.all([
          loader?.('menu'),
          language !== 'en' ? loader?.(`menu:${language}`) : Promise.resolve(null),
        ]);
        if (!menuShard) throw new Error('Catalog menu shard is unavailable');
        if (MENU_CATALOG !== catalog || CATALOG_MODEL !== model || menuCatalogKey !== catalogKey) return false;
        CATALOG_SCHEMA6_MODULE.mergeMenuShards(catalog, model, menuShard, null);
        if (languageShard) CATALOG_SCHEMA6_MODULE.applyMenuLanguageShard(catalog, languageShard);
        buildMenuIndexes(catalog);
        catalogLocatorEntryCache = null;
        renderCatalogLocatorResults();
        return true;
      })();
      catalogMenuLoadingPromise = task;
      task.finally(() => {
        if (catalogMenuLoadingPromise === task) catalogMenuLoadingPromise = null;
      }).catch(() => {});
    }
    await catalogMenuLoadingPromise;
  } else if (state.lang !== 'en') {
    await ensureCatalogMenuLanguage(state.lang);
  }
  if (includeHidden) await ensureCatalogHiddenLoaded();
  return true;
}
async function ensureCatalogHiddenLoaded() {
  if (!MENU_CATALOG?.splitAssets || MENU_CATALOG.menu?.hiddenLoaded) return true;
  if (!catalogHiddenLoadingPromise) {
    const catalog = MENU_CATALOG;
    const model = CATALOG_MODEL;
    const loader = catalogShardLoader;
    const catalogKey = menuCatalogKey;
    const task = (async () => {
      const shard = await loader?.('hidden');
      if (!shard || MENU_CATALOG !== catalog || CATALOG_MODEL !== model || menuCatalogKey !== catalogKey) return false;
      CATALOG_SCHEMA6_MODULE.mergeHiddenShard(catalog, model, shard);
      buildMenuIndexes(catalog);
      catalogLocatorEntryCache = null;
      return true;
    })();
    catalogHiddenLoadingPromise = task;
    task.finally(() => {
      if (catalogHiddenLoadingPromise === task) catalogHiddenLoadingPromise = null;
    }).catch(() => {});
  }
  return catalogHiddenLoadingPromise;
}
async function ensureCatalogHelpLoaded() {
  if (!MENU_CATALOG?.splitAssets || MENU_CATALOG.menu?.helpLoaded) return true;
  if (!catalogHelpLoadingPromise) {
    const catalog = MENU_CATALOG;
    const loader = catalogShardLoader;
    const catalogKey = menuCatalogKey;
    const task = (async () => {
      const shard = await loader?.('help');
      if (!shard || MENU_CATALOG !== catalog || menuCatalogKey !== catalogKey) return false;
      CATALOG_SCHEMA6_MODULE.applyHelpShard(catalog, shard);
      return true;
    })();
    catalogHelpLoadingPromise = task;
    task.finally(() => {
      if (catalogHelpLoadingPromise === task) catalogHelpLoadingPromise = null;
    }).catch(() => {});
  }
  return catalogHelpLoadingPromise;
}
async function ensureCatalogMenuLanguage(language) {
  if (!MENU_CATALOG?.splitAssets || language === 'en' || MENU_CATALOG.menu?.loadedLanguages?.includes(language)) return true;
  const catalog = MENU_CATALOG;
  const loader = catalogShardLoader;
  const catalogKey = menuCatalogKey;
  const shard = await loader?.(`menu:${language}`);
  if (!shard || MENU_CATALOG !== catalog || menuCatalogKey !== catalogKey) return false;
  CATALOG_SCHEMA6_MODULE.applyMenuLanguageShard(catalog, shard);
  if (catalog.menu?.displayLoaded) buildMenuIndexes(catalog);
  catalogLocatorEntryCache = null;
  return true;
}
function relationMenuOption(record) {
  const expressions = record.kconfig || {};
  return {
    symbol: record.configSymbol,
    kind: 'config',
    type: record.type || (record.states?.includes('m') ? 'tristate' : 'bool'),
    prompt: record.title || record.prompt || record.package,
    promptEn: record.title || record.prompt || record.package,
    promptZh: '',
    promptI18n: {},
    usageEn: record.description || '',
    usageZh: '',
    usageI18n: {},
    help: record.description || '',
    path: record.path || [],
    parent: record.parent || '',
    choice: record.choice || '',
    defaults: record.defaults || [],
    depends: expressions.dependsExpressions?.[0] || [],
    dependsVariants: expressions.dependsExpressions || [[]],
    selects: expressions.selectsExpressions?.flat?.() || [],
    selectsVariants: expressions.selectsExpressions || [],
    implies: expressions.impliesExpressions?.flat?.() || [],
    impliesVariants: expressions.impliesExpressions || [],
    conflicts: (record.conflicts || []).map((name) => `PACKAGE_${name}`),
    hidden: true,
    visible: false,
    userSettable: false,
    canDisable: record.canDisable !== false,
    origin: record.origin || 'relations',
  };
}
function buildMenuIndexes(catalog) {
  menuTargetSymbols = new Set(['TARGET_BOARD', 'TARGET_SUBTARGET', 'TARGET_PROFILE']);
  for (const target of catalog.targets || []) {
    const targetSelector = target.targetSelector || target.contract?.targetSelector ||
      `TARGET_${target.board}${target.subtarget ? `_${target.subtarget}` : ''}`;
    menuTargetSymbols.add(targetSelector);
    for (const profile of target.profiles || []) {
      menuTargetSymbols.add(profile.selector || profile.profileSelector ||
        `${targetSelector}_${profile.id}`);
      if (profile.targetSelector) menuTargetSymbols.add(profile.targetSelector);
    }
  }
  const menuDisplayOptions = catalog.menu.displayOptions || catalog.menu.options || [];
  const options = menuDisplayOptions.filter((option) =>
    option.hidden !== true && option.path?.[0] !== 'Target Devices' && !menuTargetSymbols.has(option.symbol));
  for (const option of options) {
    option.depends = (option.depends || []).filter((expression) =>
      !(/\s/.test(expression) && !/[&|=!<>]/.test(expression)));
    option.visible = true;
    option.hidden = false;
    option.userSettable = true;
  }
  const visibleSymbols = new Set(options.map((option) => option.symbol));
  const displayBySymbol = new Map(menuDisplayOptions.map((option) => [option.symbol, option]));
  const hiddenOptions = (CATALOG_MODEL?.records || [])
    .filter((record) => record.hidden && record.configSymbol &&
      !menuTargetSymbols.has(record.configSymbol) && !visibleSymbols.has(record.configSymbol))
    .map((record) => ({ ...relationMenuOption(record), ...(displayBySymbol.get(record.configSymbol) || {}) }));
  const choiceIds = new Set(options.map((option) => option.choice).filter(Boolean));
  catalog.menu = {
    ...catalog.menu,
    categories: (catalog.menu.categories || []).filter((name) => name !== 'Target Devices'),
    options,
    choices: (catalog.menu.choices || []).filter((choice) => choiceIds.has(choice.id)),
  };
  if (catalog.counts) catalog.counts.menuOptions = options.length;
  menuSearchOptions = [...options, ...hiddenOptions];
  menuOptionBySymbol = new Map();
  menuExactPaths = new Map();
  menuChildPaths = new Map();
  menuDescendants = new Map();
  menuChoiceOptions = new Map();
  menuChildrenByParent = new Map();
  menuNestedCounts = new Map();
  menuSearchText = new Map();
  catalogLocatorEntryCache = null;
  for (const option of menuSearchOptions) {
    menuOptionBySymbol.set(option.symbol, option);
    const packageName = option.symbol.startsWith('PACKAGE_') ? option.symbol.slice(8) : '';
    indexSearchText(option,
      `${packageName} ${option.prompt || ''} ${option.promptEn || ''} ${option.promptZh || ''} ` +
      `${Object.values(option.promptI18n || {}).join(' ')}`);
    if (option.hidden) continue;
    const path = option.path || [];
    addMenuIndex(menuExactPaths, menuPathKey(path), option);
    for (let depth = 0; depth <= path.length; depth++) {
      const parent = path.slice(0, depth);
      addMenuIndex(menuDescendants, menuPathKey(parent), option);
      if (depth < path.length) {
        const key = menuPathKey(parent);
        if (!menuChildPaths.has(key)) menuChildPaths.set(key, new Set());
        menuChildPaths.get(key).add(path[depth]);
      }
    }
    if (option.choice) addMenuIndex(menuChoiceOptions, option.choice, option);
  }
  for (const option of options) {
    if (option.parent && (!menuOptionBySymbol.has(option.parent) ||
        menuOptionBySymbol.get(option.parent).kind !== 'menuconfig')) {
      option.parent = '';
    }
    if (option.parent) addMenuIndex(menuChildrenByParent, option.parent, option);
  }
  for (const option of options) {
    let parent = option.parent;
    const seenParents = new Set();
    while (parent && !seenParents.has(parent)) {
      seenParents.add(parent);
      menuNestedCounts.set(parent, (menuNestedCounts.get(parent) || 0) + 1);
      parent = menuOptionBySymbol.get(parent)?.parent || '';
    }
  }
  if (catalog.menu?.displayLoaded || menuExpanded) startCatalogSearchWorker();
  else stopCatalogSearchWorker();
}
async function loadCatalog(source, branch, applyDefault = true, requested = null, options = {}) {
  if (!source || !branch) return null;
  const key = `${source.id}/${branch.branch}`;
  if (!options.forceRefresh && menuCatalogKey === key && MENU_CATALOG) return MENU_CATALOG;
  if (!options.forceRefresh && menuLoadingKey === key && menuCatalogPromise) return menuCatalogPromise;
  menuCatalogAbortController?.abort();
  const abortController = new AbortController();
  menuCatalogAbortController = abortController;
  menuLoadingKey = key;
  const seq = ++menuCatalogSeq;
  setCatalogLoadState('loading');
  $('menuconfigStatus').className = 'hint';
  $('menuconfigStatus').textContent = 'Loading catalog…';
  menuCatalogPromise = (async () => {
    const remote = await fetchCatalogBundle(
      source, branch, abortController.signal, options.forceRefresh === true,
    );
    const catalog = remote.data;
    catalog.loadedFrom = remote.url;
    if (seq !== menuCatalogSeq || abortController.signal.aborted) return null;
    MENU_INDEX = remote.index;
    const active = catalogBranchFromIndex(remote.index, source.id, branch.branch);
    const activeSource = active.source || source;
    const activeBranch = active.branch || branch;
    CATALOG_MODEL = remote.model;
    catalogShardLoader = remote.loadShard || null;
    if (catalog.splitAssets) catalog.menu = CATALOG_SCHEMA6_MODULE.createRuntimeMenu(CATALOG_MODEL);
    MENU_CATALOG = catalog;
    menuCatalogKey = key;
    buildMenuIndexes(catalog);
    resetCatalogSelectionLayers();
    minimumBootOriginal.clear();
    minimumBootTouchedOriginal.clear();
    menuImportedOriginal.clear();
    menuImportedNonDefault.clear();
    resetMenuNavigation();
    menuVisibleLimit = MENU_PAGE_SIZE;
    renderCatalogPicker(false, requested || { sourceId: activeSource.id, branchId: activeBranch.id });
    if (applyDefault) {
      if (requested?.initialCatalogTarget) catalogInitialTargetPending = false;
      // Target/Profile must exist before target-sensitive defaults are evaluated.
      // Target/Profile 必须先建立，之后才能计算依赖 TARGET_* 的主题与最低启动预设。
      await applyCatalogTarget();
      await applyCatalogStartupPresets();
    } else {
      renderMinimumBoot();
    }
    return catalog;
  })().catch((error) => {
    if (seq !== menuCatalogSeq) return null;
    MENU_CATALOG = null;
    CATALOG_MODEL = null;
    catalogShardLoader = null;
    menuCatalogKey = '';
    const diagnostics = Array.isArray(error?.diagnostics) ? error.diagnostics : [];
    setCatalogLoadState('error', error, diagnostics);
    console.error('[Catalog load failed]', {
      message: error?.message || String(error),
      diagnostics,
    });
    throw error;
  }).finally(() => {
    if (seq === menuCatalogSeq) {
      menuLoadingKey = '';
      menuCatalogPromise = null;
      menuCatalogAbortController = null;
    }
  });
  return menuCatalogPromise;
}
function initialCatalogTargetRequest() {
  if (!catalogInitialTargetPending || state.importedConfig) return null;
  const source = MENU_INDEX?.sources?.find((item) => item.id === INITIAL_CATALOG_TARGET.sourceId);
  const branch = source?.branches?.find((item) => item.branch === INITIAL_CATALOG_TARGET.branch);
  if (!source || !branch || branch.state === 'unavailable') return null;
  return { ...INITIAL_CATALOG_TARGET, sourceId: source.id, branchId: branch.id, initialCatalogTarget: true };
}
function isCatalogTargetSymbol(symbol, catalog = MENU_CATALOG) {
  if (menuTargetSymbols.has(symbol)) return true;
  if (/^TARGET_(?:BOARD|SUBTARGET|PROFILE|ARCH_PACKAGES)$/.test(symbol)) return true;
  return !menuTargetSymbols.size && (catalog?.targets || []).some((target) =>
    symbol === `TARGET_${target.board}` || symbol === `TARGET_${target.board}_${target.subtarget}`);
}
function renderCatalogPicker(preferState = true, requested = null) {
  if (!MENU_INDEX?.sources?.length) return null;
  const targetRequest = requested || initialCatalogTargetRequest();
  const currentSource = targetRequest?.sourceId ||
    (preferState && state.device?.id === 'catalog-target' ? state.source?.id : '');
  const sourceId = fillTargetSelect('targetSource', MENU_INDEX.sources,
    (item) => item.id, (item) => item.label || item.id, currentSource);
  const source = MENU_INDEX.sources.find((item) => item.id === sourceId);
  const currentBranch = targetRequest?.branchId ||
    (preferState && state.device?.id === 'catalog-target' ? state.version?.id : '');
  let branchId = fillTargetSelect('targetBranch', source.branches,
    (item) => item.id, catalogBranchLabel, currentBranch);
  const branchSelect = $('targetBranch');
  for (const option of branchSelect.options) {
    const item = source.branches.find((candidate) => candidate.id === option.value);
    option.disabled = item?.state === 'unavailable';
  }
  if (branchSelect.selectedOptions[0]?.disabled) {
    const available = source.branches.find((item) => item.state !== 'unavailable');
    if (available) branchSelect.value = available.id;
    branchId = branchSelect.value;
  }
  const branch = source.branches.find((item) => item.id === branchId);
  if (!branch || branch.state === 'unavailable') {
    MENU_CATALOG = null;
    menuCatalogKey = '';
    setCatalogLoadState('error', branch?.error || 'Catalog branch unavailable');
    $('menuconfigGrid').textContent = '';
    $('menuconfigPanel').hidden = true;
    showCatalogStatus(branch || { state: 'unavailable', errorStage: 'catalog-index' });
    return null;
  }
  const key = `${source.id}/${branch.branch}`;
  if (!MENU_CATALOG || menuCatalogKey !== key) {
    loadCatalog(source, branch, true, targetRequest).catch(() => {});
    return null;
  }
  const preferred = targetRequest ||
    (preferState && state.device?.id === 'catalog-target' ? state.device.target : {});
  const selectedTarget = renderCatalogTargetSelectors(preferred);
  if (!selectedTarget.valid) {
    $('menuconfigBox').hidden = true;
    $('menuconfigGrid').textContent = '';
    setCatalogLoadState('error', 'Catalog target is unavailable or failed validation');
    showCatalogStatus(branch, MENU_CATALOG);
    return { source, branch, target: null, profile: null, invalidTarget: true };
  }
  setCatalogLoadState('idle');
  $('menuconfigBox').hidden = false;
  showCatalogStatus(branch, MENU_CATALOG);
  renderMenuconfig();
  renderCatalogLocatorResults();
  return { source, branch, target: selectedTarget.target, profile: selectedTarget.profile };
}
function catalogSourceObject(source, branch) {
  const legacy = source.legacy || MENU_CATALOG?.source?.legacy;
  return {
    id: source.id, label: source.label || source.id, repo: source.repo,
    append: true, loginPw: source.id === 'lede' ? 'password' : undefined,
    diy1: 'diy-generic.sh', diy2: 'diy2-generic.sh',
    versions: [{
      id: branch.id, label: branch.branch + (legacy ? ' (Legacy)' : ''),
      branch: branch.branch, note: legacy ? 'Legacy source' : '',
    }],
    variants: [],
  };
}
function catalogPackageOps(tokens = []) {
  const raw = tokens.map((pkg) => String(pkg).trim()).filter(Boolean);
  const values = new Map();
  for (const token of raw) {
    const remove = token.startsWith('-');
    const name = token.replace(/^[+-]/, '').trim();
    if (!name) continue;
    values.set(name, remove ? 'remove' : 'add');
  }
  const add = [...values].filter(([, value]) => value === 'add').map(([name]) => name);
  const remove = [...values].filter(([, value]) => value === 'remove').map(([name]) => name);
  return { raw: [...new Set(raw)], add, remove };
}
function catalogTargetPackageOps(target, profile) {
  return catalogPackageOps([...(target?.packages || []), ...(profile?.packages || [])]);
}
async function applyCatalogTarget() {
  if (!MENU_CATALOG || catalogTargetMismatch) return;
  const sourceRow = selectedCatalogSource();
  const branchRow = selectedCatalogBranch(sourceRow);
  const selectedTarget = renderCatalogTargetSelectors(targetSelectorValues);
  const { target, profile } = selectedTarget;
  if (!target || !profile) return;
  const source = catalogSourceObject(sourceRow, branchRow);
  const targetPackageOps = catalogPackageOps(target?.packages || []);
  const profilePackageOps = catalogPackageOps(profile?.packages || []);
  const packageOps = catalogTargetPackageOps(target, profile);
  const previousTarget = state.device?.id === 'catalog-target' ? state.device.target : null;
  const previousKey = previousTarget
    ? [state.source?.id, state.version?.id, previousTarget.targetSelector,
      previousTarget.profileSelector, previousTarget.arch, previousTarget.archPackages].join('|')
    : '';
  const variant = {
    id: profile.id || 'default', profile: profile.id, name: profile.name || profile.id || 'Default profile',
    note: target.name, capacity: 4096, versions: [branchRow.id],
  };
  source.variants = [variant];
  const device = {
    id: 'catalog-target', brand: 'Target', name: `${target.name} / ${profile.name || profile.id || 'Default profile'}`,
    chip: target.board, plugins: 'seed', enabled: true, kind: 'target',
    dir: 'platform/catalog-target', note: 'Menuconfig catalog target',
    target: {
      system: target.board, systemLabel: target.name || target.board,
      subtarget: target.subtarget, subtargetLabel: target.subtargetName || target.subtarget || 'Default',
      targetSelector: profile.targetSelector || target.contract?.targetSelector || '',
      boardSelector: profile.boardSelector || target.contract?.boardSelector ||
        `TARGET_${target.board}`,
      profileSelector: profile.selector || '',
      profile: profile.id.replace(/^DEVICE_/, ''), profileSymbol: profile.id,
      profileLabel: profile.name || profile.id || 'Default profile',
      arch: String(target.arch || '').trim(),
      archPackages: String(target.archPackages || '').trim(),
      features: [...(target.features || [])],
      targetPackages: targetPackageOps.raw,
      targetPackagesAdd: targetPackageOps.add,
      targetPackagesRemove: targetPackageOps.remove,
      profileDeclaredPackages: profilePackageOps.raw,
      profileDeclaredPackagesAdd: profilePackageOps.add,
      profileDeclaredPackagesRemove: profilePackageOps.remove,
      profilePackages: packageOps.raw,
      profilePackagesAdd: packageOps.add,
      profilePackagesRemove: packageOps.remove,
      extra: Object.fromEntries(Object.entries(selectedTarget.values)
        .filter(([key]) => !['system', 'subtarget', 'profile'].includes(key))),
    },
    sources: [source],
  };
  const record = { device, source, version: source.versions[0], variant };
  const nextKey = [sourceRow.id, branchRow.id, device.target.targetSelector,
    device.target.profileSelector, device.target.arch, device.target.archPackages].join('|');
  const targetChanged = Boolean(previousKey && previousKey !== nextKey);
  if (targetChanged) {
    for (const symbol of catalogContractSymbols) {
      menuTouched.delete(symbol);
      menuValues.delete(symbol);
    }
    catalogContractSymbols.clear();
    catalogProfilePackageSymbols.clear();
    markCatalogStateChanged();
  }
  if (state.device?.id !== device.id || state.source?.id !== source.id ||
      state.version?.id !== branchRow.id || state.variant?.id !== variant.id || targetChanged) {
    state.source = record.source;
    state.version = record.version;
    state.variant = record.variant;
    await switchDevice(device, false);
  }
  state.device = device;
  const needsBaseline = targetChanged || !catalogBaselineValues.size;
  if (needsBaseline) {
    initializeCatalogBaseline();
    const profileAssignments = [];
    for (const pkg of device.target.targetPackagesAdd || []) {
      catalogProfilePackageSymbols.add(pkg);
      if (menuOptionBySymbol.has(`PACKAGE_${pkg}`)) {
        profileAssignments.push({
          symbol: `PACKAGE_${pkg}`, value: 'y', source: target.name || target.subtarget,
          origin: 'target',
        });
      }
    }
    for (const pkg of device.target.targetPackagesRemove || []) {
      catalogProfilePackageSymbols.add(pkg);
      if (menuOptionBySymbol.has(`PACKAGE_${pkg}`)) {
        profileAssignments.push({
          symbol: `PACKAGE_${pkg}`, value: 'n', source: target.name || target.subtarget,
          origin: 'target-remove',
        });
      }
    }
    for (const pkg of device.target.profileDeclaredPackagesAdd || []) {
      catalogProfilePackageSymbols.add(pkg);
      if (menuOptionBySymbol.has(`PACKAGE_${pkg}`)) {
        profileAssignments.push({
          symbol: `PACKAGE_${pkg}`, value: 'y', source: profile.id,
          origin: 'profile-add',
        });
      }
    }
    for (const pkg of device.target.profileDeclaredPackagesRemove || []) {
      catalogProfilePackageSymbols.add(pkg);
      if (menuOptionBySymbol.has(`PACKAGE_${pkg}`)) {
        profileAssignments.push({
          symbol: `PACKAGE_${pkg}`, value: 'n', source: profile.id,
          origin: 'profile-remove',
        });
      }
    }
    applyCatalogContractAssignments(profileAssignments, 'target-profile');
    snapshotCatalogBaseline();
  }
  syncCatalogApplications();
  activateTargetRecord(record);
  renderMenuconfig();
  renderBuildContract();
  updateSubmitGate();
}

function contractText(zh, en) {
  return state.lang === 'zh-CN' ? zh : en;
}
function renderContractList(element, title, items, empty) {
  if (!element) return;
  element.textContent = '';
  const heading = document.createElement('strong');
  heading.textContent = title;
  element.appendChild(heading);
  const content = document.createElement('div');
  content.className = 'build-contract-chips';
  if (!items.length) {
    const none = document.createElement('span');
    none.className = 'hint';
    none.textContent = empty;
    content.appendChild(none);
  } else {
    for (const item of items) {
      const chip = document.createElement('code');
      chip.className = 'build-contract-chip';
      chip.textContent = item;
      chip.title = item;
      content.appendChild(chip);
    }
  }
  element.appendChild(content);
}
function setBuildContractExpanded(expanded) {
  buildContractExpanded = Boolean(expanded);
  const toggle = $('buildContractToggle');
  const body = $('buildContractBody');
  if (!toggle || !body) return;
  toggle.setAttribute('aria-expanded', String(buildContractExpanded));
  body.hidden = !buildContractExpanded;
}
function initBuildContractControls() {
  const toggle = $('buildContractToggle');
  if (!toggle) return;
  setBuildContractExpanded(false);
  toggle.addEventListener('click', () => setBuildContractExpanded(!buildContractExpanded));
}
function renderBuildContract() {
  const box = $('buildContract');
  if (!box) return;
  const target = state.device?.id === 'catalog-target' ? state.device.target : null;
  if (!target || !MENU_CATALOG) {
    box.hidden = true;
    return;
  }
  const source = selectedCatalogSource();
  const branch = selectedCatalogBranch(source);
  const profilePackages = [...new Set(target.profilePackagesAdd || target.profilePackages || [])]
    .filter((pkg) => !String(pkg).startsWith('-'));
  const selected = effectiveSelection();
  const selectedNames = selected.all.map((item) => item.id);
  const selectionSummary = catalogSelectionSummary();
  const commit = String(MENU_CATALOG.source?.commit || '').slice(0, 8) || 'unknown';
  $('buildContractTitle').textContent = contractText('当前构建契约', 'Current build contract');
  $('buildContractCatalog').textContent = `${contractText('Catalog 提交', 'Catalog commit')} ${commit}`;
  const grid = $('buildContractGrid');
  grid.textContent = '';
  const rows = [
    [contractText('源码 / 分支', 'Source / Branch'), `${source?.label || state.source?.id || '-'} / ${branch?.branch || state.version?.branch || '-'}`],
    [contractText('Target System / Subtarget', 'Target System / Subtarget'), `${target.systemLabel || target.system} / ${target.subtargetLabel || target.subtarget}`],
    [contractText('Target Profile', 'Target Profile'), target.profileLabel || target.profileSymbol || '-'],
    [contractText('构建架构 / 软件包架构', 'Build / package architecture'),
      `${target.arch || contractText('Catalog 未提供', 'Missing from Catalog')} / ${target.archPackages || contractText('Catalog 未提供', 'Missing from Catalog')}`],
    [contractText('基础 / 上游默认', 'Target baseline / upstream defaults'),
      `${selectionSummary.target} / ${selectionSummary.defaults}`],
    [contractText('推荐 / 自动依赖', 'Recommended / dependencies'),
      `${selectionSummary.recommended} / ${selectionSummary.dependency}`],
    [contractText('用户启用 / 排除', 'User enabled / excluded'),
      `${selectionSummary.userEnabled} / ${selectionSummary.userExcluded}`],
    [contractText('最终启用软件包', 'Final enabled packages'), String(selectionSummary.finalEnabled)],
  ];
  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'build-contract-row';
    const key = document.createElement('span');
    key.className = 'build-contract-key';
    key.textContent = label;
    const val = document.createElement('code');
    val.textContent = value;
    val.title = value;
    row.append(key, val);
    grid.appendChild(row);
  }
  renderContractList($('buildContractProfilePackages'),
    contractText('Profile 必需软件包（自动加入）', 'Profile required packages (added automatically)'),
    profilePackages, contractText('无额外必需包', 'No additional profile packages'));
  const shownSelected = selectedNames.slice(0, 24);
  if (selectedNames.length > shownSelected.length) shownSelected.push(`+${selectedNames.length - shownSelected.length}`);
  renderContractList($('buildContractSelection'),
    contractText('已选插件', 'Selected plugins'), shownSelected,
    contractText('尚未选择插件', 'No plugins selected'));
  setBuildContractExpanded(buildContractExpanded);
  box.hidden = false;
}

function resetCatalogSelectionLayers() {
  menuValues.clear();
  menuTouched.clear();
  catalogBaselineValues.clear();
  catalogBaselineOrigins.clear();
  catalogContractOrigins.clear();
  catalogRecommendedValues.clear();
  catalogDependencySymbols.clear();
  catalogImportedSymbols.clear();
  catalogUserOverrides.clear();
  catalogProfilePackageSymbols.clear();
  catalogContractSymbols.clear();
  state.sel.clear();
  state.removed.clear();
  menuOriginFilter = 'all';
  if ($('menuconfigOriginFilter')) $('menuconfigOriginFilter').value = 'all';
  markCatalogStateChanged();
}
function defaultConditionState(condition) {
  if (!condition) return { status: 'satisfied', level: 2 };
  if (CATALOG_ENGINE?.evaluateExpressionState) {
    const context = catalogValidationContext(menuValues, 'interactive');
    return CATALOG_ENGINE.evaluateExpressionState(
      condition, context.values, context.validationOptions,
    );
  }
  return { status: kconfigExpr(condition) > 0 ? 'satisfied' : 'unsatisfied', level: null };
}
function initializeCatalogBaseline() {
  menuValues.clear();
  menuTouched.clear();
  catalogBaselineValues.clear();
  catalogBaselineOrigins.clear();
  catalogContractOrigins.clear();
  catalogRecommendedValues.clear();
  catalogDependencySymbols.clear();
  catalogImportedSymbols.clear();
  catalogUserOverrides.clear();
  catalogProfilePackageSymbols.clear();
  catalogContractSymbols.clear();
  state.sel.clear();
  state.removed.clear();
  // Defaults can reference other defaults. Iterate to a stable point after the Target/Profile
  // context exists; deferred conditions are never treated as enabled. Bypass the revision
  // cache while this batch mutates menuValues, then publish one new revision at the end.
  catalogContextCacheBypass = true;
  try {
    for (let pass = 0; pass < 8; pass++) {
      let changed = false;
      for (const option of menuSearchOptions) {
        if (option.hidden) continue;
        const value = simpleKconfigDefault(option);
        if (value === '' || menuValues.get(option.symbol) === value) continue;
        menuValues.set(option.symbol, value);
        changed = true;
      }
      if (!changed) break;
    }
    for (const choice of MENU_CATALOG?.menu?.choices || []) {
      const selected = (menuChoiceOptions.get(choice.id) || []).some((item) =>
        item.choice === choice.id && menuValues.get(item.symbol) === 'y');
      const preferred = String(choice.defaults?.[0] || '').split(/\s+/)[0];
      if (!selected && preferred && menuOptionBySymbol.has(preferred)) {
        menuValues.set(preferred, 'y');
      }
    }
  } finally {
    catalogContextCacheBypass = false;
  }
  markCatalogStateChanged();
  snapshotCatalogBaseline();
}
function snapshotCatalogBaseline() {
  catalogBaselineValues.clear();
  for (const option of menuSearchOptions) {
    const value = menuValues.get(option.symbol) ?? (option.type === 'string' ? '' : 'n');
    catalogBaselineValues.set(option.symbol, value);
    if (value !== 'n' && value !== '' && !catalogContractOrigins.has(option.symbol) &&
        !catalogDependencySymbols.has(option.symbol)) {
      catalogBaselineOrigins.set(option.symbol, {
        kind: 'kconfig-default', detail: 'Kconfig default',
      });
    }
  }
}
function catalogInheritedValue(symbol) {
  if (state.importedConfig && menuImportedOriginal.has(symbol)) return menuImportedOriginal.get(symbol);
  if (state.minimumBoot && catalogRecommendedValues.has(symbol)) return catalogRecommendedValues.get(symbol);
  return catalogBaselineValues.get(symbol) ?? (menuOptionBySymbol.get(symbol)?.type === 'string' ? '' : 'n');
}
function catalogOriginMeta(option) {
  const symbol = option?.symbol || '';
  const value = menuValues.get(symbol) ?? simpleKconfigDefault(option || {});
  if (catalogUserOverrides.has(symbol)) {
    return catalogUserOverrides.get(symbol) === 'n'
      ? { kind: 'user-exclude', label: uiText('用户排除', '使用者排除', 'User excluded') }
      : { kind: 'user', label: uiText('用户选择', '使用者選擇', 'User selected') };
  }
  if (catalogImportedSymbols.has(symbol)) {
    return { kind: 'imported', label: uiText('导入配置', '匯入設定', 'Imported') };
  }
  if (catalogRecommendedValues.has(symbol)) {
    return { kind: 'recommended', label: uiText('网页推荐', '網頁推薦', 'Recommended') };
  }
  const contract = catalogContractOrigins.get(symbol);
  if (contract) {
    const labels = {
      target: uiText('Target 基础', 'Target 基礎', 'Target baseline'),
      'target-remove': uiText('Target 排除', 'Target 排除', 'Target exclusion'),
      'profile-add': uiText('Profile 基础', 'Profile 基礎', 'Profile baseline'),
      'profile-remove': uiText('Profile 排除', 'Profile 排除', 'Profile exclusion'),
    };
    return { kind: contract.kind, label: labels[contract.kind] || contract.kind, detail: contract.detail || '' };
  }
  if (catalogDependencySymbols.has(symbol)) {
    return { kind: 'dependency', label: uiText('自动依赖', '自動相依', 'Dependency') };
  }
  if (value !== 'n' && value !== '') {
    const baseline = catalogBaselineOrigins.get(symbol);
    if (baseline) return { kind: baseline.kind, label: uiText('上游默认', '上游預設', 'Upstream default') };
  }
  return { kind: 'inactive', label: uiText('未启用', '未啟用', 'Disabled') };
}
function catalogOriginMatches(option) {
  if (menuOriginFilter === 'all') return true;
  const origin = catalogOriginMeta(option).kind;
  if (menuOriginFilter === 'target') return ['target', 'profile-add'].includes(origin);
  if (menuOriginFilter === 'default') return origin === 'kconfig-default';
  if (menuOriginFilter === 'excluded') return ['user-exclude', 'target-remove', 'profile-remove'].includes(origin);
  return origin === menuOriginFilter;
}
function catalogSelectionSummary() {
  const summary = {
    target: 0, defaults: 0, recommended: 0, dependency: 0, imported: 0,
    userEnabled: 0, userExcluded: 0, finalEnabled: 0,
  };
  for (const option of menuSearchOptions) {
    if (!option.symbol.startsWith('PACKAGE_')) continue;
    const value = menuValues.get(option.symbol) ?? simpleKconfigDefault(option);
    if (value !== 'n' && value !== '') summary.finalEnabled++;
    const origin = catalogOriginMeta(option).kind;
    if (['target', 'profile-add'].includes(origin) && value !== 'n') summary.target++;
    else if (origin === 'kconfig-default' && value !== 'n') summary.defaults++;
    else if (origin === 'recommended' && value !== 'n') summary.recommended++;
    else if (origin === 'dependency' && value !== 'n') summary.dependency++;
    else if (origin === 'imported' && value !== 'n') summary.imported++;
    else if (origin === 'user' && value !== 'n') summary.userEnabled++;
    else if (origin === 'user-exclude') summary.userExcluded++;
  }
  return summary;
}
function restoreCatalogDefault(option) {
  if (!option) return;
  catalogUserOverrides.delete(option.symbol);
  const plugin = option.symbol.startsWith('PACKAGE_') ? PLUGINS?.plugins?.find((item) =>
    curatedPackageCandidates(item).includes(option.symbol.slice(8))) : null;
  if (plugin) {
    state.sel.delete(plugin.id);
    state.removed.delete(plugin.id);
  }
  const value = catalogInheritedValue(option.symbol);
  const result = applyCatalogIntent(option, value, true, 'restore');
  if (result.violations.length) showToast(CATALOG_ENGINE.formatViolations(result.violations));
  renderMenuconfig();
  renderMinimumBoot();
  renderFirmwareSettings();
  renderGroups();
  updateStats();
}
function simpleKconfigDefault(option) {
  for (const raw of option.defaults || []) {
    const [value, condition] = raw.split(/\s+if\s+/, 2);
    const evaluated = defaultConditionState(condition);
    if (evaluated.status === 'satisfied') return value.replace(/^"|"$/g, '');
  }
  return option.type === 'string' ? '' : 'n';
}
function catalogValidationContext(inputValues = menuValues, phase = 'interactive') {
  const target = state.device?.target || null;
  const cacheable = inputValues === menuValues && !catalogContextCacheBypass;
  const targetKey = [target?.system, target?.subtarget, target?.profileSymbol || target?.profile,
    target?.targetSelector, target?.profileSelector].map((value) => String(value || '')).join('|');
  const cacheKey = `${phase}|${catalogStateRevision}|${targetKey}`;
  if (cacheable && catalogContextCache.has(cacheKey)) return catalogContextCache.get(cacheKey);
  const context = CATALOG_ENGINE?.createCatalogValidationContext && CATALOG_MODEL
    ? CATALOG_ENGINE.createCatalogValidationContext(CATALOG_MODEL, target, inputValues, { phase })
    : {
      values: new Map(inputValues),
      trustedSymbols: new Set(catalogContractSymbols),
      validationOptions: {
        phase,
        contextComplete: Boolean(target?.system && target?.subtarget && (target?.profileSymbol || target?.profile)),
        trustedSymbols: new Set(catalogContractSymbols),
        deferred: phase === 'post-defconfig' ? 'error' : 'ignore',
      },
    };
  if (cacheable) catalogContextCache.set(cacheKey, context);
  return context;
}
function catalogEngineValues() {
  return catalogValidationContext(menuValues, 'interactive').values;
}
function kconfigLevel(value) {
  return value === 'y' ? 2 : value === 'm' ? 1 : 0;
}
function kconfigExpr(expression) {
  return CATALOG_ENGINE ? CATALOG_ENGINE.evaluateExpression(expression, catalogEngineValues()) : 0;
}
function optionDependencyVariants(option) {
  const variants = Array.isArray(option?.dependsVariants) && option.dependsVariants.length
    ? option.dependsVariants : [option?.depends || []];
  return variants.map((group) => (Array.isArray(group) ? group : [group]).filter((expression) =>
    !(/\s/.test(String(expression)) && !/[&|=!<>]/.test(String(expression)))));
}
function refreshMenuEvaluationCaches() {
  if (menuVisibilityRevision === catalogStateRevision) return;
  menuVisibilityRevision = catalogStateRevision;
  menuVisibilityCache.clear();
  menuMaxLevelCache.clear();
}
function optionVisible(option) {
  if (option?.hidden) return true;
  refreshMenuEvaluationCaches();
  if (menuVisibilityCache.has(option.symbol)) return menuVisibilityCache.get(option.symbol);
  const visible = optionDependencyVariants(option).some((group) =>
    group.every((expression) => kconfigExpr(expression) > 0));
  menuVisibilityCache.set(option.symbol, visible);
  return visible;
}
function optionMaxLevel(option) {
  if (option?.hidden) return kconfigLevel(menuValues.get(option.symbol) ?? 'n');
  refreshMenuEvaluationCaches();
  if (menuMaxLevelCache.has(option.symbol)) return menuMaxLevelCache.get(option.symbol);
  const level = Math.max(0, ...optionDependencyVariants(option).map((group) =>
    group.reduce((current, expression) => Math.min(current, kconfigExpr(expression)), 2)));
  menuMaxLevelCache.set(option.symbol, level);
  return level;
}
function syncMenuToCurated(option, value, source = 'user') {
  if (!option.symbol.startsWith('PACKAGE_') || !PLUGINS?.plugins || !state.source) return false;
  const packageName = option.symbol.slice('PACKAGE_'.length);
  const plugin = PLUGINS.plugins.find((item) =>
    curatedPackageCandidates(item).includes(packageName));
  if (!plugin) return false;
  if (source === 'restore') {
    state.sel.delete(plugin.id);
    state.removed.delete(plugin.id);
    return true;
  }
  if (source !== 'user') return true;
  if (value === 'n') {
    state.sel.delete(plugin.id);
    state.removed.add(plugin.id);
  } else {
    state.sel.add(plugin.id);
    state.removed.delete(plugin.id);
  }
  return true;
}
function syncCuratedToMenu(plugin, value) {
  if (!MENU_CATALOG?.menu?.options || !state.source) return;
  const option = curatedPackageCandidates(plugin)
    .map((packageName) => menuOptionBySymbol.get(`PACKAGE_${packageName}`))
    .find(Boolean);
  if (option) setMenuValue(option, value);
}
function curatedMenuOption(plugin) {
  if (!MENU_CATALOG?.menu?.options || !state.source) return null;
  return curatedPackageCandidates(plugin)
    .map((packageName) => menuOptionBySymbol.get(`PACKAGE_${packageName}`))
    .find(Boolean) || null;
}
function curatedPackageCandidates(plugin) {
  if (!plugin) return [];
  const sourcePackage = plugin.pkgs?.[state.source?.id];
  return [...new Set([
    ...(plugin.catalogCandidates || []),
    sourcePackage,
    plugin.pkg,
  ].filter((name) => typeof name === 'string' && /^[A-Za-z0-9_.+@-]+$/.test(name)))];
}
function syncCatalogApplications() {
  if (state.device?.id !== 'catalog-target' || !PLUGINS?.plugins) return;
  for (const plugin of PLUGINS.plugins) {
    const option = curatedMenuOption(plugin);
    if (!option || !catalogUserOverrides.has(option.symbol)) {
      state.sel.delete(plugin.id);
      state.removed.delete(plugin.id);
      continue;
    }
    const value = catalogUserOverrides.get(option.symbol);
    if (value === 'n') {
      state.sel.delete(plugin.id);
      state.removed.add(plugin.id);
    } else {
      state.sel.add(plugin.id);
      state.removed.delete(plugin.id);
    }
  }
}
function resetMenuNavigation() {
  menuPath = null;
  menuParent = '';
  menuHistory = [];
  menuBreadcrumb = [];
}
function resetMenuScroll() {
  requestAnimationFrame(() => {
    const scroller = $('menuconfigScroll');
    if (scroller) scroller.scrollTop = 0;
  });
}
function openMenuLevel(path, parent, label) {
  menuHistory.push({ path: menuPath, parent: menuParent, breadcrumb: [...menuBreadcrumb] });
  menuPath = path;
  menuParent = parent;
  if (label && menuBreadcrumb.at(-1) !== label) menuBreadcrumb.push(label);
  menuVisibleLimit = MENU_PAGE_SIZE;
  resetMenuScroll();
}
function openMenuChildren(option) {
  if (!menuChildrenByParent.has(option.symbol)) return;
  openMenuLevel([...(option.path || [])], option.symbol, option.prompt || option.symbol);
}
function menuOptionSelected(option) {
  const value = menuValues.get(option.symbol) ?? simpleKconfigDefault(option);
  return menuTouched.has(option.symbol) || menuImportedNonDefault.has(option.symbol) || value !== 'n';
}
function applyCatalogIntent(option, value, force = false, source = 'user') {
  if (!option) return { changes: [], violations: [] };
  const previous = menuValues.get(option.symbol) ?? 'n';
  const context = catalogValidationContext(menuValues, 'interactive');
  const result = (!CATALOG_MODEL || !CATALOG_ENGINE)
    ? { changes: [{ symbol: option.symbol, from: previous, to: value, reason: 'fallback' }], violations: [] }
    : CATALOG_ENGINE.applyUserIntent(CATALOG_MODEL, context.values, {
      symbol: option.symbol,
      value,
      force,
      validationOptions: context.validationOptions,
    });
  for (const change of result.changes) {
    menuValues.set(change.symbol, change.to);
    const explicit = change.symbol === option.symbol;
    if (source === 'restore' && explicit) {
      if (!catalogRecommendedValues.has(change.symbol) && !catalogImportedSymbols.has(change.symbol)) {
        menuTouched.delete(change.symbol);
      }
    } else {
      menuTouched.add(change.symbol);
    }
    if (source === 'user' && explicit) catalogUserOverrides.set(change.symbol, change.to);
    else if (source === 'recommended' && explicit) catalogRecommendedValues.set(change.symbol, change.to);
    else if (source === 'imported') catalogImportedSymbols.add(change.symbol);
    else if (!explicit || source === 'dependency') catalogDependencySymbols.add(change.symbol);
    const changedOption = menuOptionBySymbol.get(change.symbol);
    if (!changedOption) continue;
    syncMenuToCurated(changedOption, change.to, explicit ? source : 'dependency');
    if (source === 'user' && explicit && !minimumBootApplying) {
      reconcileMinimumBootChange(changedOption, change.to);
      syncThemeFromMenu(changedOption, change.to);
    }
  }
  if (result.changes.length) markCatalogStateChanged();
  return result;
}
function applyCatalogContractAssignments(assignments, reason = 'catalog-contract') {
  if (!assignments?.length) return { changes: [], violations: [] };
  const directSymbols = new Set(assignments.map((assignment) => assignment.symbol));
  for (const assignment of assignments) {
    catalogContractSymbols.add(assignment.symbol);
    catalogContractOrigins.set(assignment.symbol, {
      kind: assignment.origin || 'profile-add', detail: assignment.source || reason,
    });
  }
  if (!CATALOG_MODEL || !CATALOG_ENGINE?.applyAuthoritativeValues) {
    const changes = [];
    for (const assignment of assignments) {
      const option = menuOptionBySymbol.get(assignment.symbol);
      if (!option) continue;
      const previous = menuValues.get(assignment.symbol) ?? 'n';
      if (previous === assignment.value) continue;
      menuValues.set(assignment.symbol, assignment.value);
      changes.push({ symbol: assignment.symbol, from: previous, to: assignment.value, reason });
      syncMenuToCurated(option, assignment.value, 'contract');
    }
    if (changes.length) markCatalogStateChanged();
    return { changes, violations: [] };
  }
  const context = catalogValidationContext(menuValues, 'pre-defconfig');
  const result = CATALOG_ENGINE.applyAuthoritativeValues(
    CATALOG_MODEL, context.values, assignments, {
      reason,
      validationOptions: context.validationOptions,
    },
  );
  for (const change of result.changes) {
    menuValues.set(change.symbol, change.to);
    catalogContractSymbols.add(change.symbol);
    if (!directSymbols.has(change.symbol)) catalogDependencySymbols.add(change.symbol);
    const option = menuOptionBySymbol.get(change.symbol);
    if (option) syncMenuToCurated(option, change.to, directSymbols.has(change.symbol) ? 'contract' : 'dependency');
  }
  if (result.changes.length) markCatalogStateChanged();
  return result;
}

function setMenuValue(option, value, openChildren = false) {
  let result;
  try {
    result = applyCatalogIntent(option, value, false);
  } catch (error) {
    showToast(error.message);
    return;
  }
  const curatedChanged = result.changes.some((change) =>
    menuOptionBySymbol.get(change.symbol)?.symbol?.startsWith('PACKAGE_'));
  if (result.violations.length) {
    showToast(CATALOG_ENGINE.formatViolations(result.violations));
  }
  if (openChildren && value !== 'n') openMenuChildren(option);
  renderMenuconfig();
  renderMinimumBoot();
  renderFirmwareSettings();
  if (curatedChanged) {
    renderGroups();
    updateStats();
  }
}
function minimumBootRows() {
  if (!MINIMUM_BOOT) return [];
  return [...(MINIMUM_BOOT.items || []), ...(MINIMUM_BOOT.firewallBackend?.candidates || [])];
}
function minimumBootAudit() {
  const enabled = state.minimumBoot === true;
  const requested = [];
  if (enabled) {
    for (const item of minimumBootRows()) {
      const option = minimumBootOption(item);
      if (!option) continue;
      const value = menuValues.get(item.symbol) ?? simpleKconfigDefault(option);
      if (!['n', 'm', 'y'].includes(value)) continue;
      requested.push({ symbol: item.symbol, value });
    }
  }
  return {
    recommended: {
      enabled,
      preset: `minimum-boot-v${MINIMUM_BOOT?.version || 1}`,
      requested,
    },
    defconfig: { enabled: state.useDefconfig === true },
  };
}
function minimumBootHelp(item) {
  const lang = state.lang === 'zh-CN' ? 'zh-CN' : 'en';
  const usage = item.description?.[lang] || item.description?.en || '';
  const without = item.without?.[lang] || item.without?.en || '';
  return state.lang === 'zh-CN'
    ? `用途：${usage}\n不选择：${without}`
    : `Purpose: ${usage}\nWithout it: ${without}`;
}
function minimumBootOption(item) {
  const option = menuOptionBySymbol.get(item.symbol);
  if (!option || (item.catalogPath && !(option.path || []).includes(item.catalogPath))) return null;
  return option;
}
function minimumFirewallItems() {
  return MINIMUM_BOOT?.firewallBackend?.candidates || [];
}
function setMenuValueQuiet(option, value, source = 'recommended') {
  if (!option) return { changes: [], violations: [] };
  return applyCatalogIntent(option, value, true, source);
}
function trySetMenuValueQuiet(option, value, context = 'preset', source = 'recommended') {
  try {
    return { result: setMenuValueQuiet(option, value, source), error: null };
  } catch (error) {
    console.warn(`[Catalog ${context} skipped] ${option?.symbol || 'unknown'}=${value}`, error);
    return { result: null, error };
  }
}
function enforceFirewallBackend(preferred = '') {
  const available = minimumFirewallItems().filter(minimumBootOption);
  if (!available.length) return [];
  const ordered = [];
  const add = (item) => { if (item && !ordered.includes(item)) ordered.push(item); };
  add(available.find((item) => item.symbol === preferred));
  add(available.find((item) => menuValues.get(item.symbol) === 'y'));
  add(available.find((item) => simpleKconfigDefault(minimumBootOption(item)) === 'y'));
  for (const item of available) add(item);
  const failures = [];
  for (const chosen of ordered) {
    const snapshot = {
      values: new Map(menuValues), touched: new Set(menuTouched),
      selected: new Set(state.sel), removed: new Set(state.removed), theme: state.theme,
      recommended: new Map(catalogRecommendedValues),
      dependencies: new Set(catalogDependencySymbols),
      userOverrides: new Map(catalogUserOverrides),
    };
    minimumBootApplying = true;
    const attempt = trySetMenuValueQuiet(minimumBootOption(chosen), 'y', 'firewall preset');
    if (!attempt.error) {
      for (const item of available) {
        if (item !== chosen) trySetMenuValueQuiet(minimumBootOption(item), 'n', 'firewall preset');
      }
      minimumBootApplying = false;
      return failures;
    }
    minimumBootApplying = false;
    restoreMap(menuValues, snapshot.values);
    restoreSet(menuTouched, snapshot.touched);
    restoreSet(state.sel, snapshot.selected);
    restoreSet(state.removed, snapshot.removed);
    restoreMap(catalogRecommendedValues, snapshot.recommended);
    restoreSet(catalogDependencySymbols, snapshot.dependencies);
    restoreMap(catalogUserOverrides, snapshot.userOverrides);
    state.theme = snapshot.theme;
    failures.push({ symbol: chosen.symbol, error: attempt.error });
  }
  return failures;
}
function configSymbolValue(text, symbol) {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(text || '').match(new RegExp(`^CONFIG_${escaped}=([ym])$`, 'm'));
  return match?.[1] || 'n';
}
async function currentBaseConfigText() {
  return state.importedConfig || '';
}
async function applyMinimumBootPreset(readBase = true) {
  if (!state.minimumBoot || !MENU_CATALOG) return;
  const rows = minimumBootRows();
  if (!minimumBootOriginal.size) {
    const symbols = new Set(rows.map((item) => item.symbol));
    for (const symbol of menuOptionBySymbol.keys()) {
      if (symbol.startsWith('PACKAGE_luci-theme-')) symbols.add(symbol);
    }
    for (const symbol of symbols) {
      minimumBootOriginal.set(symbol, menuValues.get(symbol) ?? 'n');
      if (menuTouched.has(symbol)) minimumBootTouchedOriginal.add(symbol);
    }
  }
  const presetFailures = [];
  minimumBootApplying = true;
  try {
    for (const item of MINIMUM_BOOT.items || []) {
      const option = minimumBootOption(item);
      if (!option) continue;
      const attempt = trySetMenuValueQuiet(
        option, option.type === 'bool' ? 'y' : (item.default || 'y'), 'minimum-boot preset',
      );
      if (attempt.error) presetFailures.push({ symbol: option.symbol, error: attempt.error });
    }
  } finally {
    minimumBootApplying = false;
  }
  let preferred = '';
  if (readBase) {
    const base = await currentBaseConfigText();
    preferred = minimumFirewallItems().find((item) =>
      configSymbolValue(base, item.symbol) === 'y')?.symbol || '';
  }
  presetFailures.push(...enforceFirewallBackend(preferred));
  if (presetFailures.length) {
    const symbols = [...new Set(presetFailures.map((item) => item.symbol))];
    showToast(uiText(
      `部分推荐项不适用于当前 Target，已跳过：${symbols.join(', ')}`,
      `部分推薦項不適用於目前 Target，已略過：${symbols.join(', ')}`,
      `Some recommended items are unavailable for this Target and were skipped: ${symbols.join(', ')}`,
    ));
  }
  const argon = menuOptionBySymbol.get('PACKAGE_luci-theme-argon');
  if (argon && menuValues.get(argon.symbol) === 'y') state.theme = 'luci-theme-argon';
  renderMinimumBoot();
  renderFirmwareSettings();
  renderMenuconfig();
  renderGroups();
  updateStats();
}
function restoreMinimumBootPreset() {
  minimumBootApplying = true;
  for (const [symbol, value] of minimumBootOriginal) {
    const option = menuOptionBySymbol.get(symbol);
    if (!option) continue;
    menuValues.set(symbol, value);
    if (minimumBootTouchedOriginal.has(symbol)) menuTouched.add(symbol);
    else menuTouched.delete(symbol);
    catalogRecommendedValues.delete(symbol);
    syncMenuToCurated(option, value, 'restore');
  }
  minimumBootApplying = false;
  minimumBootOriginal.clear();
  minimumBootTouchedOriginal.clear();
  state.theme = '@base';
  markCatalogStateChanged();
}
function reconcileMinimumBootChange(option, value) {
  if (!state.minimumBoot || !minimumFirewallItems().some((item) => item.symbol === option.symbol)) return;
  const other = minimumFirewallItems().find((item) =>
    item.symbol !== option.symbol && minimumBootOption(item));
  if (value === 'y') enforceFirewallBackend(option.symbol);
  else enforceFirewallBackend(other?.symbol || option.symbol);
}
function syncThemeFromMenu(option, value) {
  if (!option.symbol.startsWith('PACKAGE_luci-theme-')) return;
  if (value === 'y') state.theme = option.symbol.slice('PACKAGE_'.length);
  else if (`PACKAGE_${state.theme}` === option.symbol) state.theme = '@base';
}
function applyDefaultCatalogTheme() {
  if (state.theme !== '@base') return;
  const argon = menuOptionBySymbol.get('PACKAGE_luci-theme-argon');
  if (!argon || !optionVisible(argon)) return;
  const attempt = trySetMenuValueQuiet(argon, 'y', 'default theme');
  if (!attempt.error) state.theme = 'luci-theme-argon';
}
function restoreMap(target, source) {
  target.clear();
  for (const [key, value] of source) target.set(key, value);
}
function restoreSet(target, source) {
  target.clear();
  for (const value of source) target.add(value);
}
async function applyCatalogStartupPresets() {
  const snapshot = {
    values: new Map(menuValues),
    touched: new Set(menuTouched),
    selected: new Set(state.sel),
    removed: new Set(state.removed),
    minimumOriginal: new Map(minimumBootOriginal),
    minimumTouchedOriginal: new Set(minimumBootTouchedOriginal),
    recommended: new Map(catalogRecommendedValues),
    dependencies: new Set(catalogDependencySymbols),
    userOverrides: new Map(catalogUserOverrides),
    theme: state.theme,
  };
  try {
    applyDefaultCatalogTheme();
    if (state.minimumBoot) await applyMinimumBootPreset(false);
    else renderMinimumBoot();
  } catch (error) {
    restoreMap(menuValues, snapshot.values);
    restoreSet(menuTouched, snapshot.touched);
    restoreSet(state.sel, snapshot.selected);
    restoreSet(state.removed, snapshot.removed);
    restoreMap(minimumBootOriginal, snapshot.minimumOriginal);
    restoreSet(minimumBootTouchedOriginal, snapshot.minimumTouchedOriginal);
    restoreMap(catalogRecommendedValues, snapshot.recommended);
    restoreSet(catalogDependencySymbols, snapshot.dependencies);
    restoreMap(catalogUserOverrides, snapshot.userOverrides);
    minimumBootApplying = false;
    state.theme = snapshot.theme;
    renderMinimumBoot();
    renderFirmwareSettings();
    renderMenuconfig();
    renderGroups();
    updateStats();
    const message = uiText(
      'Catalog 已加载，但推荐预设应用失败，已回退到该 Target 的上游默认值。',
      'Catalog 已載入，但推薦預設套用失敗，已回退到該 Target 的上游預設值。',
      'Catalog loaded, but recommended presets failed; upstream Target defaults were restored.',
    );
    console.error('[Catalog startup presets failed]', error);
    showToast(`${message} ${error?.message || error}`);
  }
}
function catalogSelectLock(option) {
  return menuSearchOptions.find((candidate) => {
    const value = menuValues.get(candidate.symbol) ?? simpleKconfigDefault(candidate);
    return value !== 'n' && (candidate.selects || []).some((rule) =>
      rule.split(/\s+if\s+/, 2)[0] === option.symbol);
  }) || null;
}
function catalogSelectLockValue(option, lockedBy) {
  const sourceValue = menuValues.get(lockedBy.symbol) ?? simpleKconfigDefault(lockedBy);
  return sourceValue === 'm' && option.type === 'tristate' ? 'm' : 'y';
}
function renderRecommendedBackend(item, option) {
  const row = document.createElement('div');
  row.className = 'menuconfig-option package-option menuconfig-state-help';
  row.dataset.help = minimumBootHelp(item);
  const name = document.createElement('span');
  name.className = 'menuconfig-option-label';
  name.textContent = item.id;
  const actions = document.createElement('span');
  actions.className = 'menuconfig-option-actions';
  const tri = document.createElement('span');
  tri.className = 'kconfig-tri';
  const alone = minimumFirewallItems().filter(minimumBootOption).length === 1;
  const current = menuValues.get(item.symbol) ?? 'n';
  for (const value of ['n', 'y']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = value.toUpperCase();
    button.className = current === value ? 'active' : '';
    button.disabled = alone || (current === 'y' && value === 'n' && !minimumFirewallItems()
      .some((other) => other.symbol !== item.symbol && minimumBootOption(other)));
    button.onclick = () => setMenuValue(option, value);
    tri.appendChild(button);
  }
  actions.appendChild(tri);
  row.append(name, actions);
  return row;
}
function renderMinimumBootModal() {
  if (!minimumBootModalOpen || $('modal').hidden) return;
  const body = $('modalBody');
  body.textContent = '';
  const intro = document.createElement('p');
  intro.className = 'hint';
  intro.textContent = uiText(
    '项目与 N/M/Y 选项以当前 Catalog 为准；防火墙后端必须二选一。',
    '項目與 N/M/Y 選項以目前 Catalog 為準；防火牆後端必須二選一。',
    'Items and N/M/Y states come from the current Catalog; choose exactly one firewall backend.');
  body.appendChild(intro);
  for (const item of minimumBootRows()) {
    const option = minimumBootOption(item);
    const backend = minimumFirewallItems().some((candidate) => candidate.symbol === item.symbol);
    if (!option) {
      const row = document.createElement('div');
      row.className = 'minimum-boot-item is-unavailable menuconfig-state-help';
      row.dataset.help = minimumBootHelp(item);
      row.innerHTML = `<span class="minimum-boot-name">${item.id}</span><span>N</span>`;
      body.appendChild(row);
      continue;
    }
    if (backend) {
      body.appendChild(renderRecommendedBackend(item, option));
      continue;
    }
    const lockedBy = catalogSelectLock(option);
    const lockedValue = lockedBy ? catalogSelectLockValue(option, lockedBy) : '';
    if (lockedValue) setMenuValueQuiet(option, lockedValue);
    const row = renderMenuOption(option);
    row.classList.add('recommended-option');
    row.dataset.help = minimumBootHelp(item);
    if (lockedBy) {
      row.querySelectorAll('.kconfig-tri button').forEach((button) => {
        button.hidden = button.textContent.toLowerCase() !== lockedValue;
        button.disabled = true;
        button.title = `Selected by ${lockedBy.symbol}`;
      });
    }
    body.appendChild(row);
  }
}
function openMinimumBootModal() {
  if (!state.minimumBoot) return;
  minimumBootModalOpen = true;
  openModal(uiText('推荐项配置', '推薦項設定', 'Recommended configuration'));
  $('modal').querySelector('.modal').classList.add('modal-wide', 'recommended-config');
  modalCancelHandler = () => { minimumBootModalOpen = false; };
  renderMinimumBootModal();
}
function renderMinimumBoot() {
  const config = $('minimumBootConfig');
  if (config) config.hidden = !state.minimumBoot;
  renderMinimumBootModal();
  updateSubmitGate();
}
function initDefconfig() {
  const toggle = $('defconfigToggle');
  if (!toggle) return;
  toggle.onchange = () => { state.useDefconfig = toggle.checked; updateSubmitGate(); };
  toggle.checked = state.useDefconfig;
}
function initMinimumBoot() {
  $('minimumBootToggle').onchange = async () => {
    state.minimumBoot = $('minimumBootToggle').checked;
    if (state.minimumBoot) {
      await applyMinimumBootPreset(true);
      openMinimumBootModal();
    }
    else {
      restoreMinimumBootPreset();
      if (minimumBootModalOpen) closeModal();
      renderMinimumBoot();
      renderFirmwareSettings();
      renderMenuconfig();
      renderGroups();
      updateStats();
      updateSubmitGate();
    }
  };
  $('minimumBootConfig').onclick = openMinimumBootModal;
}

function initMenuconfigControls() {
  $('menuconfigToggle').onclick = async () => {
    menuExpanded = !menuExpanded;
    $('menuconfigToggle').setAttribute('aria-expanded', String(menuExpanded));
    $('menuconfigBody').hidden = !menuExpanded;
    if (!menuExpanded) return;
    try {
      await ensureCatalogMenuLoaded(false);
      renderMenuconfig();
    } catch (error) {
      menuExpanded = false;
      $('menuconfigToggle').setAttribute('aria-expanded', 'false');
      $('menuconfigBody').hidden = true;
      showToast(error.message);
    }
  };
  $('menuconfigBack').onclick = () => {
    if ($('menuconfigBack').disabled) return;
    const previous = menuHistory.pop();
    if (previous) {
      menuPath = previous.path;
      menuParent = previous.parent;
      menuBreadcrumb = previous.breadcrumb;
    } else {
      resetMenuNavigation();
    }
    menuVisibleLimit = MENU_PAGE_SIZE;
    resetMenuScroll();
    renderMenuconfig();
  };
  $('menuconfigSelectedToggle').onclick = () => {
    menuSelectedExpanded = !menuSelectedExpanded;
    renderMenuconfig();
  };
  let searchTimer = 0;
  $('menuconfigSearch').oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      const query = $('menuconfigSearch').value.trim();
      if (query) {
        $('menuconfigSelectedOnly').checked = false;
        resetMenuNavigation();
      }
      menuVisibleLimit = MENU_PAGE_SIZE;
      resetMenuScroll();
      if (query.length >= 2) await ensureCatalogHiddenLoaded().catch((error) =>
        console.warn('[Catalog hidden shard]', error));
      renderMenuconfig();
    }, 180);
  };
  $('menuconfigSelectedOnly').onchange = () => {
    $('menuconfigSearch').value = '';
    resetMenuNavigation();
    menuSelectedExpanded = $('menuconfigSelectedOnly').checked;
    menuVisibleLimit = MENU_PAGE_SIZE;
    resetMenuScroll();
    renderMenuconfig();
  };
  $('menuconfigOriginFilter').onchange = () => {
    menuOriginFilter = $('menuconfigOriginFilter').value || 'all';
    resetMenuNavigation();
    menuVisibleLimit = MENU_PAGE_SIZE;
    resetMenuScroll();
    renderMenuconfig();
  };
  $('menuconfigStateHelp').onclick = (event) => {
    event.stopPropagation();
    showMenuHelp($('menuconfigStateHelp'));
  };
  $('catalogLoadState').onclick = retryCatalogLoad;
  $('catalogCopyDiagnostics').onclick = copyCatalogDiagnostics;
  $('menuconfigScroll').onscroll = () => {
    hideMenuTooltip();
    const scroller = $('menuconfigScroll');
    if (scroller.dataset.hasMore !== 'true' ||
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight > 120) return;
    const top = scroller.scrollTop;
    menuVisibleLimit += MENU_PAGE_SIZE;
    renderMenuconfig();
    requestAnimationFrame(() => { scroller.scrollTop = top; });
  };
  let unknownSearchTimer = 0;
  $('importUnknownSearch').oninput = () => {
    clearTimeout(unknownSearchTimer);
    unknownSearchTimer = setTimeout(() => {
      importedUnknownLimit = MENU_PAGE_SIZE;
      renderImportedWorkspace();
    }, 100);
  };
  $('importUnknownDisabled').onchange = () => {
    importedUnknownLimit = MENU_PAGE_SIZE;
    renderImportedWorkspace();
  };
  $('importUnknownMore').onclick = () => {
    importedUnknownLimit += MENU_PAGE_SIZE;
    renderImportedWorkspace();
  };
  $('importReset').onclick = resetImportedChanges;
  document.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.menu-translation-chip')) return;
    hideMenuTooltip();
  });
  document.addEventListener('click', async (event) => {
    const chip = event.target.closest('.menu-translation-chip');
    if (chip) {
      event.preventDefault();
      event.stopPropagation();
      const translated = chip.closest('.menu-translation');
      if (translated?.dataset.symbol) showMenuOptionTooltip(translated);
      else showMenuTooltip(translated);
      return;
    }
    const optionLabel = event.target.closest('.menuconfig-option-label');
    if (optionLabel?.dataset.symbol) showMenuOptionTooltip(optionLabel);
  }, true);
  document.addEventListener('pointerover', (event) => {
    const optionLabel = event.target.closest('.menuconfig-option-label');
    if (optionLabel?.dataset.symbol && !matchMedia('(hover: none)').matches) {
      showMenuOptionTooltip(optionLabel);
      return;
    }
    const help = event.target.closest('.menuconfig-state-help');
    if (help && !matchMedia('(hover: none)').matches) {
      showMenuHelp(help);
      return;
    }
    const translated = event.target.closest('.menu-translation');
    if (state.lang !== 'en' && translated && !matchMedia('(hover: none)').matches) {
      showMenuTooltip(translated);
    }
  });
  document.addEventListener('pointerout', (event) => {
    if (event.target.closest('.menuconfig-option-label')) {
      if (!event.relatedTarget?.closest?.('.menuconfig-option-label')) hideMenuTooltip();
      return;
    }
    if (event.target.closest('.menuconfig-state-help')) {
      if (!event.relatedTarget?.closest?.('.menuconfig-state-help')) hideMenuTooltip();
      return;
    }
    if (!event.target.closest('.menu-translation') ||
        event.relatedTarget?.closest?.('.menu-translation')) return;
    hideMenuTooltip();
  });
  document.addEventListener('focusin', (event) => {
    const optionLabel = event.target.closest('.menuconfig-option-label');
    if (optionLabel?.dataset.symbol) {
      showMenuOptionTooltip(optionLabel);
      return;
    }
    const help = event.target.closest('.menuconfig-state-help');
    if (help) {
      showMenuHelp(help);
      return;
    }
    const translated = event.target.closest('.menu-translation');
    if (translated) showMenuTooltip(translated);
  });
  document.addEventListener('focusout', (event) => {
    if (event.target.closest('.menuconfig-option-label,.menu-translation,.menuconfig-state-help') &&
        !event.relatedTarget?.closest?.('.menuconfig-option-label,.menu-translation,.menuconfig-state-help')) hideMenuTooltip();
  });
}
function renderMenuOption(option) {
  const value = menuValues.get(option.symbol) ?? simpleKconfigDefault(option);
  const childCount = menuNestedCounts.get(option.symbol) || 0;
  const row = document.createElement('div');
  const packageName = option.symbol.startsWith('PACKAGE_') ? option.symbol.slice(8) : '';
  const origin = catalogOriginMeta(option);
  const profileRequired = packageName && state.device?.id === 'catalog-target' &&
    ['target', 'profile-add'].includes(origin.kind) &&
    catalogBaselineValues.get(option.symbol) !== 'n';
  row.dataset.symbol = option.symbol;
  row.className = `menuconfig-option${packageName ? ' package-option' : ''}${childCount ? ' has-children' : ''}${option.hidden ? ' hidden-package-option' : ''}`;
  if (profileRequired) row.classList.add('catalog-profile-required');
  const prompt = document.createElement('span');
  prompt.className = 'menuconfig-option-summary';
  const name = document.createElement('span');
  name.className = 'menuconfig-option-label';
  const path = (option.path || []).map(menuPathLabel).filter(Boolean).join(' › ');
  const label = menuOptionLabel(option);
  name.textContent = path ? `${label} (${path})` : label;
  name.dataset.fullText = name.textContent;
  name.dataset.symbol = option.symbol;
  name.tabIndex = 0;
  prompt.appendChild(name);
  if (origin.kind !== 'inactive') {
    const badge = document.createElement('small');
    badge.className = `catalog-origin catalog-origin-${origin.kind}`;
    badge.textContent = origin.label;
    badge.title = origin.detail || origin.label;
    prompt.appendChild(badge);
  }
  const translation = menuOptionTranslation(option);
  if (translation.title || translation.usage) {
    applyMenuTranslation(name, translation.title, translation.usage, true);
  }
  row.appendChild(prompt);
  const actions = document.createElement('span');
  actions.className = 'menuconfig-option-actions';
  if (option.type === 'bool' || option.type === 'tristate') {
    const tri = document.createElement('span');
    tri.className = 'kconfig-tri';
    const maxLevel = optionMaxLevel(option);
    const selectableStates = (option.type === 'tristate' ? ['n', 'm', 'y'] : ['n', 'y'])
      .filter((stateValue) => stateValue === 'n' || kconfigLevel(stateValue) <= maxLevel);
    const states = option.userSettable === false
      ? [...new Set(['n', ...(value !== 'n' ? [value] : [])])]
      : selectableStates;
    for (const stateValue of states) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = stateValue.toUpperCase();
      button.className = value === stateValue ? 'active' : '';
      if (profileRequired) {
        button.disabled = stateValue !== 'y';
        button.title = 'Required by the selected Target / Profile baseline';
      } else if (option.userSettable === false && stateValue !== 'n') {
        button.disabled = true;
        button.title = 'Hidden package: it can be disabled here but is enabled only through Catalog dependencies';
      }
      button.onclick = () => setMenuValue(option, stateValue, childCount > 0 && stateValue !== 'n');
      tri.appendChild(button);
    }
    actions.appendChild(tri);
  } else {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value === 'n' ? '' : value;
    input.onchange = () => setMenuValue(option, input.value);
    actions.appendChild(input);
  }
  if (catalogUserOverrides.has(option.symbol)) {
    const restore = document.createElement('button');
    restore.type = 'button';
    restore.className = 'menuconfig-restore-default';
    restore.textContent = uiText('默认', '預設', 'Default');
    restore.title = uiText('删除用户覆盖并恢复继承值', '刪除使用者覆寫並還原繼承值',
      'Remove the user override and restore the inherited value');
    restore.onclick = () => restoreCatalogDefault(option);
    actions.appendChild(restore);
  }
  if (childCount) {
    const childButton = document.createElement('button');
    childButton.type = 'button';
    childButton.className = 'menuconfig-child';
    childButton.textContent = '›';
    childButton.title = value === 'n'
      ? 'Select M or Y to open sub-options'
      : 'Open sub-options';
    childButton.setAttribute('aria-label', childButton.title);
    childButton.disabled = value === 'n';
    childButton.onclick = () => {
      openMenuChildren(option);
      renderMenuconfig();
    };
    actions.appendChild(childButton);
  }
  row.appendChild(actions);
  return row;
}
function renderMenuLeaf(options, list) {
  const choiceGroups = new Map();
  const ordinary = [];
  for (const option of options) {
    if (option.choice) addMenuIndex(choiceGroups, option.choice, option);
    else ordinary.push(option);
  }
  const choiceEntries = [...choiceGroups];
  const visibleChoices = choiceEntries.slice(0, menuVisibleLimit);
  for (const [choiceId, members] of visibleChoices) {
    const choice = (MENU_CATALOG.menu.choices || []).find((item) => item.id === choiceId);
    const row = document.createElement('label');
    row.className = 'menuconfig-choice';
    const text = document.createElement('span');
    text.className = 'menuconfig-choice-text';
    const choiceLabel = String(choice?.promptEn || choice?.prompt || 'Choice').trim();
    text.append(document.createTextNode(choiceLabel));
    const select = document.createElement('select');
    select.setAttribute('aria-label', choiceLabel);
    const selected = members.find((option) =>
      (menuValues.get(option.symbol) ?? simpleKconfigDefault(option)) !== 'n');
    if (!selected) {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Select…';
      select.appendChild(placeholder);
    }
    for (const option of members) {
      const entry = document.createElement('option');
      entry.value = option.symbol;
      entry.textContent = menuOptionLabel(option);
      const optionTranslation = menuOptionTranslation(option);
      entry.title = [
        entry.textContent,
        optionTranslation.title,
        optionTranslation.usage,
        `CONFIG_${option.symbol}`,
      ].filter(Boolean).join('\n');
      entry.selected = option.symbol === selected?.symbol;
      select.appendChild(entry);
    }
    const syncChoiceTitle = () => {
      select.title = select.selectedOptions[0]?.title || '';
    };
    syncChoiceTitle();
    select.onchange = () => {
      const option = menuOptionBySymbol.get(select.value);
      if (option) setMenuValue(option, optionMaxLevel(option) > 1 ? 'y' : 'm');
      syncChoiceTitle();
    };
    applyMenuTranslation(text,
      choice?.promptI18n?.[state.lang] || (state.lang === 'zh-CN' ? choice?.promptZh : ''),
      choice?.usageI18n?.[state.lang] || (state.lang === 'zh-CN' ? choice?.usageZh : ''),
      true);
    row.append(text, select);
    list.appendChild(row);
  }
  const ordinaryBudget = Math.max(0, menuVisibleLimit - visibleChoices.length);
  for (const option of ordinary.slice(0, ordinaryBudget)) {
    list.appendChild(renderMenuOption(option));
  }
  return choiceEntries.length + ordinary.length;
}
function breadcrumbTranslation(label) {
  const meta = menuLabelMeta(label);
  const localized = meta.i18n?.[state.lang] || (state.lang === 'zh-CN' ? meta.zhCN : '');
  if (localized) return {
    title: localized,
    usage: meta.usageI18n?.[state.lang] ||
      (state.lang === 'zh-CN' ? (meta.usageZh || '') : ''),
  };
  const option = MENU_CATALOG?.menu?.options?.find((item) =>
    item.prompt === label || item.promptEn === label);
  return {
    title: option?.promptI18n?.[state.lang] || (state.lang === 'zh-CN' ? option?.promptZh || '' : ''),
    usage: option?.usageI18n?.[state.lang] || (state.lang === 'zh-CN' ? option?.usageZh || '' : ''),
  };
}
function jumpMenuBreadcrumb(index) {
  if (index === 0) {
    resetMenuNavigation();
    menuVisibleLimit = MENU_PAGE_SIZE;
    resetMenuScroll();
    renderMenuconfig();
    return;
  }
  const crumbIndex = index - 1;
  if (crumbIndex < 0 || crumbIndex >= menuBreadcrumb.length - 1) return;
  const stateAtLevel = menuHistory[crumbIndex + 1];
  if (!stateAtLevel) return;
  menuPath = stateAtLevel.path;
  menuParent = stateAtLevel.parent;
  menuBreadcrumb = [...stateAtLevel.breadcrumb];
  menuHistory = menuHistory.slice(0, crumbIndex + 1);
  menuVisibleLimit = MENU_PAGE_SIZE;
  resetMenuScroll();
  renderMenuconfig();
}
function renderMenuPanelTitle(mode = 'path') {
  const nav = $('menuconfigPanelTitle');
  nav.textContent = '';
  if (mode !== 'path') {
    const current = document.createElement('span');
    current.className = 'menuconfig-breadcrumb-current';
    current.textContent = mode;
    nav.appendChild(current);
    return;
  }
  const labels = ['Top level', ...menuBreadcrumb];
  labels.forEach((label, index) => {
    if (index) {
      const separator = document.createElement('span');
      separator.className = 'menuconfig-breadcrumb-separator';
      separator.textContent = '›';
      nav.appendChild(separator);
    }
    const current = index === labels.length - 1;
    const part = document.createElement(current ? 'span' : 'button');
    part.className = current ? 'menuconfig-breadcrumb-current' : 'menuconfig-breadcrumb-link';
    part.textContent = label === 'Top level' ? 'Top level' : menuPathLabel(label);
    const translation = label === 'Top level'
      ? { title: menuUi('top'), usage: '' }
      : breadcrumbTranslation(label);
    applyMenuTranslation(part, translation.title, translation.usage);
    if (!current) {
      part.type = 'button';
      part.onclick = () => jumpMenuBreadcrumb(index);
    } else {
      part.setAttribute('aria-current', 'page');
    }
    nav.appendChild(part);
  });
}
function renderMenuconfig() {
  hideMenuTooltip();
  const box = $('menuconfigBox');
  if (!box || !MENU_CATALOG?.menu?.options) return;
  box.hidden = false;
  $('menuconfigToggle').setAttribute('aria-expanded', String(menuExpanded));
  $('menuconfigBody').hidden = !menuExpanded;
  if (!menuExpanded) return;
  const grid = $('menuconfigGrid');
  const panel = $('menuconfigPanel');
  const list = $('menuconfigOptions');
  grid.textContent = '';
  list.textContent = '';
  const query = $('menuconfigSearch').value.trim().toLowerCase();
  const selectedOnly = $('menuconfigSelectedOnly').checked;

  // Resolve visibility once per Catalog state revision. Search, source filters,
  // selected counts, and child-directory counts reuse this result instead of
  // rebuilding Target context and re-evaluating every dependency repeatedly.
  const visibleOptions = menuSearchOptions.filter(optionVisible);
  const selected = visibleOptions.filter(menuOptionSelected);
  const selectedToggle = $('menuconfigSelectedToggle');
  selectedToggle.hidden = !selectedOnly;
  selectedToggle.setAttribute('aria-expanded', String(menuSelectedExpanded));
  $('menuconfigSelectedCount').textContent = String(selected.length);
  $('menuconfigContent').hidden = selectedOnly && !menuSelectedExpanded;
  if (selectedOnly && !menuSelectedExpanded) {
    $('menuconfigBack').hidden = false;
    $('menuconfigBack').disabled = menuHistory.length === 0;
    $('menuconfigBack').setAttribute('aria-disabled', String($('menuconfigBack').disabled));
    renderImportedWorkspace();
    return;
  }

  const eligibleOptions = visibleOptions.filter((option) =>
    catalogOriginMatches(option) && (!selectedOnly || menuOptionSelected(option)));
  const eligibleSymbols = new Set(eligibleOptions.map((option) => option.symbol));
  const eligible = (option) => eligibleSymbols.has(option.symbol);
  let nodes = [];
  let options = [];
  let searchPending = false;
  if (query) {
    renderMenuPanelTitle(query.length < 2 ? 'Type at least 2 characters' : 'Search results');
    if (query.length >= 2) {
      const matches = searchMenuOptions(query);
      searchPending = matches === null;
      options = (matches || []).filter(eligible);
    }
  } else if (menuOriginFilter !== 'all') {
    const originLabel = $('menuconfigOriginFilter')?.selectedOptions?.[0]?.textContent || 'Origin';
    renderMenuPanelTitle(originLabel);
    options = eligibleOptions;
  } else {
    const key = menuPathKey(menuPath || []);
    renderMenuPanelTitle();
    const exact = menuExactPaths.get(key) || [];
    if (menuPath === null) {
      const rootOptions = exact.filter((option) => eligible(option) && (option.parent || '') === menuParent);
      if (rootOptions.length) nodes.push({
        label: 'General settings', usage: 'Root configuration options',
        translation: '常规设置', usageZh: '根级配置选项', path: [], count: rootOptions.length,
      });
    } else {
      options = exact.filter((option) => eligible(option) && (option.parent || '') === menuParent);
    }
    const countCache = new Map();
    const countPath = (path) => {
      const pathKey = menuPathKey(path);
      if (!countCache.has(pathKey)) {
        countCache.set(pathKey, (menuDescendants.get(pathKey) || []).reduce((count, option) =>
          count + Number(eligible(option) && (option.parent || '') === menuParent), 0));
      }
      return countCache.get(pathKey);
    };
    for (const name of menuChildPaths.get(key) || []) {
      const path = [...(menuPath || []), name];
      const count = countPath(path);
      if (count) nodes.push({ label: name, path, count });
    }
  }
  $('menuconfigBack').hidden = !!query;
  $('menuconfigBack').disabled = menuHistory.length === 0;
  $('menuconfigBack').setAttribute('aria-disabled', String($('menuconfigBack').disabled));
  const nodeFragment = document.createDocumentFragment();
  for (const node of nodes) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'menuconfig-category';
    const meta = menuLabelMeta(node.label);
    const text = document.createElement('span');
    text.className = 'menuconfig-category-text';
    text.append(document.createTextNode(meta.en || node.label));
    const count = document.createElement('small');
    count.className = 'menuconfig-category-count';
    count.textContent = `${node.count} ›`;
    button.append(text, count);
    const localized = meta.i18n?.[state.lang] ||
      (state.lang === 'zh-CN' ? (node.translation || meta.zhCN) : '');
    applyMenuTranslation(button,
      localized,
      meta.usageI18n?.[state.lang] ||
        (state.lang === 'zh-CN' ? (node.usageZh || meta.usageZh) : ''),
      true);
    button.onclick = () => {
      openMenuLevel(node.path, menuParent, node.label);
      renderMenuconfig();
    };
    nodeFragment.appendChild(button);
  }
  grid.appendChild(nodeFragment);
  grid.hidden = !nodes.length;
  fitMenuCategoryNames(grid);
  const ordinaryCount = renderMenuLeaf(options, list);
  if (!nodes.length && !options.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = searchPending ? 'Searching…' : query.length === 1
      ? 'Type one more character.'
      : 'No available options.';
    empty.title = state.lang === 'en' ? '' : searchPending
      ? uiText('正在搜索…', '正在搜尋…', 'Searching…')
      : query.length === 1
        ? uiText('请再输入一个字符。', '請再輸入一個字元。', 'Type one more character.')
        : uiText('没有可用选项。', '沒有可用選項。', 'No available options.');
    list.appendChild(empty);
  }
  panel.hidden = !options.length && !!nodes.length;
  $('menuconfigMore').hidden = true;
  $('menuconfigScroll').dataset.hasMore = String(ordinaryCount > menuVisibleLimit);
  renderImportedWorkspace();
}
function parseConfigValues(text) {
  const values = new Map();
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const enabled = line.match(/^CONFIG_([A-Za-z0-9_.+@-]+)=(.*)$/);
    const disabled = line.match(/^# CONFIG_([A-Za-z0-9_.+@-]+) is not set$/);
    if (enabled) values.set(enabled[1], enabled[2]);
    else if (disabled) values.set(disabled[1], 'n');
  }
  return values;
}
function importedValue(symbol) {
  const edit = importedUnknownEdits.get(symbol);
  return edit?.action === 'delete' ? null : edit?.value ?? importedUnknownOriginal.get(symbol);
}
function setImportedEdit(symbol, value) {
  const original = importedUnknownOriginal.get(symbol);
  if (value === original) importedUnknownEdits.delete(symbol);
  else importedUnknownEdits.set(symbol, { action: 'set', value });
  renderImportedWorkspace();
}
function renderImportedUnknownRow(symbol) {
  const original = importedUnknownOriginal.get(symbol);
  const edit = importedUnknownEdits.get(symbol);
  const value = importedValue(symbol);
  const row = document.createElement('div');
  row.className = 'import-unknown-row' + (edit ? ' modified' : '');
  const name = document.createElement('code');
  name.className = 'menuconfig-option-label';
  name.textContent = symbol.startsWith('PACKAGE_')
    ? symbol.slice('PACKAGE_'.length)
    : symbol.toLowerCase().replaceAll('_', ' ');
  name.dataset.fullText = name.textContent;
  name.dataset.symbol = symbol;
  name.tabIndex = 0;
  row.appendChild(name);
  let input;
  if ([original, value].some((item) => ['y', 'm', 'n'].includes(item))) {
    input = document.createElement('select');
    for (const item of [['y', 'Y'], ['m', 'M'], ['n', uiText('关闭', '關閉', 'Disabled')]]) {
      const option = document.createElement('option');
      option.value = item[0];
      option.textContent = item[1];
      input.appendChild(option);
    }
    input.value = value ?? original;
  } else {
    input = document.createElement('input');
    input.type = 'text';
    input.value = value ?? original;
  }
  input.disabled = edit?.action === 'delete';
  input.onchange = () => setImportedEdit(symbol, input.value);
  row.appendChild(input);
  const actions = document.createElement('span');
  actions.className = 'import-unknown-actions';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = uiText('关闭', '關閉', 'Disable');
  close.onclick = () => setImportedEdit(symbol, 'n');
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = edit?.action === 'delete'
    ? uiText('已删除', '已刪除', 'Deleted')
    : uiText('删除行', '刪除列', 'Delete line');
  remove.disabled = edit?.action === 'delete';
  remove.onclick = () => {
    importedUnknownEdits.set(symbol, { action: 'delete' });
    renderImportedWorkspace();
  };
  const restore = document.createElement('button');
  restore.type = 'button';
  restore.textContent = uiText('恢复', '還原', 'Restore');
  restore.disabled = !edit;
  restore.onclick = () => {
    importedUnknownEdits.delete(symbol);
    renderImportedWorkspace();
  };
  actions.append(close, remove, restore);
  row.appendChild(actions);
  return row;
}
function renderImportedWorkspace() {
  const workspace = $('importWorkspace');
  if (!workspace || !state.importedConfig) {
    if (workspace) workspace.hidden = true;
    return;
  }
  workspace.hidden = false;
  const activeUnknown = [...importedUnknownOriginal].filter(([symbol]) => {
    const value = importedValue(symbol);
    return value !== 'n' && value !== '0' && value !== '""';
  }).length;
  const modified = menuTouched.size + importedUnknownEdits.size;
  $('importSummaryText').textContent = uiText(
    `已识别 ${menuImportedOriginal.size} 项 · 仅导入 ${importedUnknownOriginal.size} 项` +
      `（启用 ${activeUnknown}）· 用户插件操作 ${state.sel.size + state.removed.size} 项 · 已修改 ${modified} 项`,
    `已識別 ${menuImportedOriginal.size} 項 · 僅匯入 ${importedUnknownOriginal.size} 項` +
      `（啟用 ${activeUnknown}）· 使用者外掛操作 ${state.sel.size + state.removed.size} 項 · 已修改 ${modified} 項`,
    `Recognized ${menuImportedOriginal.size} · import-only ${importedUnknownOriginal.size}` +
      ` (enabled ${activeUnknown}) · user plugin actions ${state.sel.size + state.removed.size} · modified ${modified}`);
  const targetCard = $('importTargetCard');
  targetCard.hidden = importedTargetVerified;
  targetCard.textContent = '';
  if (!importedTargetVerified) {
    targetCard.append(document.createTextNode(uiText(
      `⚠ Custom Target：${state.device.target.system} / ${state.device.target.subtarget} / ` +
        `${state.device.target.profileLabel} 未经当前 Catalog 验证，将按上传配置直接构建；是否可用由所选源码决定。 `,
      `⚠ Custom Target：${state.device.target.system} / ${state.device.target.subtarget} / ` +
        `${state.device.target.profileLabel} 未經目前 Catalog 驗證，將按上傳設定直接建置；是否可用由所選原始碼決定。 `,
      `⚠ Custom Target: ${state.device.target.system} / ${state.device.target.subtarget} / ` +
        `${state.device.target.profileLabel} is not verified by the current Catalog; it will be built as uploaded and availability depends on the selected upstream. `)));
    const useCatalog = document.createElement('button');
    useCatalog.type = 'button';
    useCatalog.className = 'text-btn';
    useCatalog.textContent = uiText('改用网页 Target', '改用網頁 Target', 'Use page Target');
    useCatalog.onclick = async () => {
      if (!confirm(uiText(
        '改用网页 Target 会退出上传配置工作区，并放弃上传文件中的自定义配置。继续吗？',
        '改用網頁 Target 會離開上傳設定工作區，並放棄上傳檔案中的自訂設定。繼續嗎？',
        'Using the page Target exits the imported-config workspace and discards custom settings from the uploaded file. Continue?'))) return;
      const sourceId = state.source.id;
      const branchId = state.version.id;
      clearImportedWorkspace();
      importedTargetVerified = true;
      for (const select of targetControlElements()) select.disabled = false;
      renderCatalogPicker(false, { sourceId, branchId });
      await applyCatalogTarget();
    };
    targetCard.appendChild(useCatalog);
  }
  const box = $('importUnknownBox');
  box.hidden = importedUnknownOriginal.size === 0;
  $('importUnknownSummary').textContent = uiText(
    `仅导入配置项（${importedUnknownOriginal.size}，已修改 ${importedUnknownEdits.size}）`,
    `僅匯入設定項（${importedUnknownOriginal.size}，已修改 ${importedUnknownEdits.size}）`,
    `Import-only settings (${importedUnknownOriginal.size}, modified ${importedUnknownEdits.size})`);
  const list = $('importUnknownOptions');
  list.textContent = '';
  const query = $('importUnknownSearch').value.trim().toLowerCase();
  const showDisabled = $('importUnknownDisabled').checked;
  let symbols = [...importedUnknownOriginal.keys()].filter((symbol) => {
    if (query.length === 1 || (query.length >= 2 && !symbol.toLowerCase().includes(query))) return false;
    const value = importedValue(symbol);
    return showDisabled || importedUnknownEdits.has(symbol) ||
      (value !== 'n' && value !== '0' && value !== '""');
  });
  symbols.sort((a, b) =>
    Number(importedUnknownEdits.has(b)) - Number(importedUnknownEdits.has(a)) || a.localeCompare(b));
  for (const symbol of symbols.slice(0, importedUnknownLimit)) {
    list.appendChild(renderImportedUnknownRow(symbol));
  }
  if (!symbols.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = query.length === 1
      ? uiText('请再输入一个字符。', '請再輸入一個字元。', 'Type one more character.')
      : uiText('没有符合条件的配置项。', '沒有符合條件的設定項。', 'No matching settings.');
    list.appendChild(empty);
  }
  $('importUnknownMore').hidden = symbols.length <= importedUnknownLimit;
}
function clearImportedWorkspace() {
  state.importedConfig = null;
  state.importedConfigId = '';
  state.useDefconfig = true;
  if ($('defconfigToggle')) $('defconfigToggle').checked = true;
  configRuleChoices.clear();
  importedConfigValues.clear();
  importedUnknownOriginal.clear();
  importedUnknownEdits.clear();
  menuImportedOriginal.clear();
  menuImportedNonDefault.clear();
  resetCatalogSelectionLayers();
  $('importWorkspace').hidden = true;
  $('importUnknownBox').hidden = true;
}
function resetImportedChanges() {
  if (!state.importedConfig) return;
  restoreSelections(state.importedConfig, null);
  showToast(uiText('已恢复上传配置的原始值', '已還原上傳設定的原始值',
    'Restored the original uploaded settings'));
}
async function selectCatalogLocatorTarget(values) {
  catalogInitialTargetPending = false;
  const preferredTarget = { ...values, strictCatalogTarget: true };
  targetSelectorValues = {};
  const selected = renderCatalogTargetSelectors(preferredTarget);
  if (!selected.target || !selected.profile) return;
  await applyCatalogTarget();
  const label = state.device?.target?.profileLabel || selected.profile.name || selected.profile.id;
  showToast(uiText(`已选择 ${label}`, `已選擇 ${label}`, `Selected ${label}`), 'device');
}
function buildCatalogLocatorEntries() {
  const entries = [];
  for (const source of MENU_INDEX?.sources || []) {
    entries.push({
      type: 'Source', label: source.label || source.id, detail: source.repo || source.id,
      hay: `${source.id} ${source.label || ''} ${source.repo || ''}`,
      run: () => {
        $('targetSource').value = source.id;
        $('targetSource').dispatchEvent(new Event('change', { bubbles: true }));
      },
    });
    for (const branch of source.branches || []) {
      entries.push({
        type: 'Branch', label: branch.branch, detail: source.label || source.id,
        hay: `${source.id} ${source.label || ''} ${branch.branch}`,
        run: () => {
          $('targetSource').value = source.id;
          renderCatalogPicker(false, { sourceId: source.id, branchId: branch.id });
        },
      });
    }
  }
  const schema = MENU_CATALOG?.targetSelectors || DEFAULT_TARGET_SELECTORS;
  const walk = (nodes, depth = 0, values = {}) => {
    const selector = schema[depth];
    if (!selector) return;
    for (const node of nodes || []) {
      const next = { ...values, [selector.id]: node.value };
      entries.push({
        type: node.profileId ? 'Target Profile' : (selector.labelEn || selector.id),
        label: node.labelEn || node.value,
        detail: Object.values(next).join(' › '),
        hay: `${selector.id} ${selector.labelEn || ''} ${node.value} ${node.labelEn || ''} ${node.labelZh || ''} ${(node.aliasesEn || []).join(' ')}`,
        run: async () => {
          if (node.profileId) {
            await selectCatalogLocatorTarget(next);
            return;
          }
          targetSelectorValues = next;
          renderCatalogTargetSelectors(next);
          await applyCatalogTarget();
        },
      });
      walk(node.children, depth + 1, next);
    }
  };
  walk(MENU_CATALOG?.targetTree || []);
  return entries.map((entry) => ({ ...entry, hay: String(entry.hay || '').toLowerCase() }));
}
function catalogLocatorEntries(query) {
  if (!catalogLocatorEntryCache) catalogLocatorEntryCache = buildCatalogLocatorEntries();
  return catalogLocatorEntryCache.filter((entry) => entry.hay.includes(query)).slice(0, 80);
}
function renderCatalogLocatorResults() {
  const input = $('catalogLocator');
  const results = $('catalogLocatorResults');
  if (!input || !results) return;
  const query = input.value.trim().toLowerCase();
  results.textContent = '';
  if (query.length < 2) {
    results.hidden = true;
    return;
  }
  if (catalogLoadMode === 'loading') {
    const loading = document.createElement('p');
    loading.className = 'hint catalog-locator-loading';
    loading.textContent = uiText('正在加载 Target 数据…', '正在載入 Target 資料…', 'Loading Target data…');
    results.appendChild(loading);
    results.hidden = false;
    return;
  }
  if (!MENU_CATALOG) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = catalogLoadMode === 'error'
      ? uiText('Catalog 加载失败，请重试。', 'Catalog 載入失敗，請重試。', 'Catalog failed to load. Retry.')
      : t('search.empty');
    results.appendChild(empty);
    results.hidden = false;
    return;
  }
  for (const entry of catalogLocatorEntries(query)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'catalog-locator-item';
    const label = document.createElement('span');
    label.textContent = entry.label;
    const detail = document.createElement('small');
    detail.textContent = `${entry.type} · ${entry.detail}`;
    button.append(label, detail);
    button.onclick = async () => {
      results.hidden = true;
      results.textContent = '';
      input.value = '';
      await entry.run();
    };
    results.appendChild(button);
  }
  if (!results.children.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = t('search.empty');
    results.appendChild(empty);
  }
  results.hidden = false;
}
function initCatalogLocator() {
  const input = $('catalogLocator');
  const results = $('catalogLocatorResults');
  if (!input || !results) return;
  const close = () => { results.hidden = true; results.textContent = ''; };
  let locatorTimer = 0;
  input.oninput = () => {
    clearTimeout(locatorTimer);
    locatorTimer = setTimeout(renderCatalogLocatorResults, 160);
  };
  input.onfocus = () => {
    if (input.value.trim().length >= 2) renderCatalogLocatorResults();
  };
  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.catalog-locator')) close();
  });
}
function activateTargetRecord(record) {
  const previousSource = state.source;
  state.source = record.source;
  state.version = record.version;
  state.variant = record.variant;
  applySourceDefaults(previousSource);
  renderGroups();
  updateStats();
  updateLoginInfo();
  updateDeviceSummary();
}
function renderDevices() {
  $('targetPicker').hidden = false;
  for (const id of ['sourceStep', 'versionStep', 'variantStep']) $(id).hidden = true;
  if (!importedTargetVerified && state.device?.id === 'custom-target') {
    setCatalogLoadState('idle');
    renderImportedCustomPicker();
    updateDeviceSummary();
    return;
  }
  if (!MENU_INDEX?.sources?.length) {
    setCatalogLoadState('error', 'No usable Catalog sources are available');
    $('menuconfigGrid').textContent = '';
    $('menuconfigPanel').hidden = true;
    updateDeviceSummary();
    updateSubmitGate();
    return;
  }
  renderCatalogPicker();
  $('targetPicker').onchange = async (event) => {
    const select = event.target.closest('select');
    if (!select || !select.closest('#targetPicker')) return;
    const id = select.id;
    catalogInitialTargetPending = false;
    if (state.importedConfig) {
      if (!confirm('切换 Target 会退出上传配置工作区，并改为网页新建配置。继续吗？')) {
        renderDevices();
        return;
      }
      clearImportedWorkspace();
    }
    if (id === 'targetSource' || id === 'targetBranch') {
      MENU_CATALOG = null;
      menuCatalogKey = '';
      menuLoadingKey = '';
      renderCatalogPicker(false);
    } else {
      renderCatalogPicker(false);
      await applyCatalogTarget();
    }
  };
  updateDeviceSummary();
}

function updateDeviceSummary() {
  if (!state.device || !$('deviceSummary')) return;
  $('deviceSummary').textContent = state.device.kind === 'target'
    ? t('device.targetSelected', {
      source: state.source?.label || state.device.sources?.[0]?.label || 'Catalog',
      branch: state.version?.branch || state.device.sources?.[0]?.versions?.[0]?.branch || '',
      system: state.device.target?.systemLabel || state.device.target?.system || 'Target',
      subtarget: state.device.target?.subtargetLabel || state.device.target?.subtarget || '',
      profile: state.device.target?.profileLabel || state.device.target?.profile || '',
    })
    : t('device.selected', { brand: state.device.brand, model: state.device.name });
}
function setDeviceFold(folded) {
  $('devicePicker').hidden = folded;
  $('deviceSummary').hidden = !folded;
  $('deviceFold').setAttribute('aria-expanded', String(!folded));
  $('deviceFold').textContent = t(folded ? 'fold.show' : 'fold.hide');
  safeSet('wrt_device_fold', folded ? '1' : '0');
}
function initDeviceFold() {
  setDeviceFold(localStorage.getItem('wrt_device_fold') === '1');
  $('deviceFold').addEventListener('click', () => setDeviceFold(!$('devicePicker').hidden));
  $('deviceSummary').addEventListener('click', () => setDeviceFold(false));
}

function applySourceDefaults(previousSource) {
  const box = $('rootpwBox');
  if (state.source.id === 'lede') {
    if (!box.value || state.rootpwAuto) {
      box.value = state.rootpw = '@empty';
      state.rootpwAuto = true;
    }
  } else if (state.rootpwAuto && (!previousSource || previousSource.id === 'lede')) {
    box.value = state.rootpw = '';
    state.rootpwAuto = false;
  }
  renderFirmwareSettings();
}

function renderSources() {
  const row = $('sourceRow');
  row.textContent = '';
  const previousSource = state.source;
  const preferred = state.device.sources.find((s) => previousSource && s.id === previousSource.id) || state.device.sources[0];
  state.device.sources.forEach((s) => {
    const pill = makePill(s.label, s.label + ' · ' + s.repo, s.desc, () => {
      const previousSource = state.source;
      state.source = s;
      setActive(row, pill);
      renderVersions();
      renderVariants();
      renderGroups();
      updateStats();
      updateLoginInfo();
      applySourceDefaults(previousSource);
    });
    row.appendChild(pill);
    if (s.id === preferred.id) setActive(row, pill);
  });
  state.source = preferred;
  applySourceDefaults(previousSource);
  renderVersions();
  renderVariants();
}

function renderVersions() {
  const row = $('versionRow');
  row.textContent = '';
  state.version = state.source.versions[0];
  state.source.versions.forEach((v) => {
    const pill = makePill(v.label, v.label + ' · ' + v.branch, v.note || '', () => {
      state.version = v;
      setActive(row, pill);
      renderVariants();
      updateStats();
    });
    row.appendChild(pill);
    if (v.id === state.version.id) setActive(row, pill);
  });
}

function renderVariants() {
  const row = $('variantRow');
  row.textContent = '';
  const variants = state.source.variants.filter((v) => !v.versions || v.versions.includes(state.version.id));
  state.variant = variants[0];
  variants.forEach((v) => {
    const pill = makePill(v.name, v.name, v.note || '', () => {
      state.variant = v;
      setActive(row, pill);
      updateStats();
    });
    row.appendChild(pill);
    if (v.id === state.variant.id) setActive(row, pill);
  });
}

function renderModes() {
  const row = $('modeRow');
  row.querySelectorAll('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      state.mode = pill.dataset.mode;
      setActive(row, pill);
      $('selfBox').hidden = state.mode !== 'self';
      safeSet('wrt_mode', state.mode);
    });
    if (pill.dataset.mode === state.mode) setActive(row, pill);
  });
  $('selfBox').hidden = state.mode !== 'self';
  $('ownerBox').value = state.owner;
  $('ownerBox').addEventListener('input', () => {
    state.owner = $('ownerBox').value.trim();
    safeSet('wrt_owner', state.owner);
  });
  $('lanipBox').value = state.lanip;
  $('lanipBox').addEventListener('change', () => {
    const v = $('lanipBox').value.trim();
    if (LANIP_RE.test(v)) { state.lanip = v; safeSet('wrt_lanip', v); }
    else { $('lanipBox').value = state.lanip = '192.168.1.1'; safeSet('wrt_lanip', state.lanip); showToast(t('lanip.invalid')); }
  });
  // 初始密码:可选;@empty 表示清空该源自带的初始密码;不持久化(是密码) / optional initial password; @empty blanks a shipped password; never persisted
  $('rootpwBox').addEventListener('input', () => {
    state.rootpwAuto = false;
    const v = $('rootpwBox').value.trim();
    if (v === '' || v === '@empty' || /^[A-Za-z0-9@#%^&*_+=.,:!?-]{4,32}$/.test(v)) state.rootpw = v;
  });
  $('rootpwBox').addEventListener('change', () => {
    const v = $('rootpwBox').value.trim();
    if (!(v === '' || v === '@empty' || /^[A-Za-z0-9@#%^&*_+=.,:!?-]{4,32}$/.test(v))) {
      $('rootpwBox').value = ''; state.rootpw = ''; showToast(t('rootpw.invalid'));
    }
  });
  const timezoneBox = $('timezoneBox');
  timezoneBox.addEventListener('focus', () => openTimezoneMenu(''));
  timezoneBox.addEventListener('click', () => {
    if (timezoneBox.value === timezoneLabel(currentTimezone())) timezoneBox.select();
    openTimezoneMenu('');
  });
  timezoneBox.addEventListener('input', () => openTimezoneMenu(timezoneBox.value));
  timezoneBox.addEventListener('keydown', timezoneMenuKeydown);
  timezoneBox.addEventListener('blur', () => {
    setTimeout(() => {
      if (!$('timezoneCombo').contains(document.activeElement)) {
        timezoneBox.value = timezoneLabel(currentTimezone());
        closeTimezoneMenu();
      }
    }, 0);
  });
  $('timezoneMenu').addEventListener('pointerdown', (event) => {
    const option = event.target.closest('.timezone-option');
    if (!option) return;
    event.preventDefault();
    const zone = TIMEZONES.zones.find((item) => item.zonename === option.dataset.zonename);
    if (zone) selectTimezone(zone);
  });
  document.addEventListener('pointerdown', (event) => {
    if (!$('timezoneCombo').contains(event.target)) closeTimezoneMenu();
  });
  $('fwThemeBox').addEventListener('change', () => setFirmwareTheme($('fwThemeBox').value));
  $('ntpBox').addEventListener('change', () => { state.ntp = $('ntpBox').value; });
  $('opkgBox').addEventListener('change', () => {
    state.opkg = $('opkgBox').value;
    opkgSelectionExplicit = true;
  });
}

function fillSelect(id, entries, current) {
  const box = $(id);
  box.textContent = '';
  for (const [value, label] of entries) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = value === current;
    box.appendChild(option);
  }
  if (![...box.options].some((o) => o.selected)) box.selectedIndex = 0;
  return box.value;
}
function timezoneOffset(zonename) {
  try {
    const part = new Intl.DateTimeFormat('en', {
      timeZone: zonename, timeZoneName: 'longOffset', hour: '2-digit',
    }).formatToParts(new Date()).find((item) => item.type === 'timeZoneName');
    if (!part || part.value === 'GMT') return '+00:00';
    const match = part.value.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
    return match ? match[1] + match[2].padStart(2, '0') + ':' + (match[3] || '00') : '+00:00';
  } catch (e) { return '+00:00'; }
}
function timezoneLabel(zone) {
  return `(UTC${timezoneOffset(zone.zonename)}) ${zone.zonename}`;
}
function browserTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; }
  catch (e) { return ''; }
}
function initializeTimezone() {
  const available = new Set(TIMEZONES.zones.map((zone) => zone.zonename));
  const saved = localStorage.getItem('wrt_timezone') || '';
  const detected = browserTimezone();
  state.timezone = [saved, detected, 'Asia/Shanghai'].find((name) => available.has(name)) || TIMEZONES.zones[0].zonename;
}
function currentTimezone() {
  return TIMEZONES.zones.find((zone) => zone.zonename === state.timezone) ||
    TIMEZONES.zones.find((zone) => zone.zonename === 'Asia/Shanghai');
}
let timezoneActive = -1;
function timezoneSearchText(zone) {
  const beijing = zone.zonename === 'Asia/Shanghai' ? ' Beijing 北京 北京时间 ' + t('fw.timezone.beijing') : '';
  return `${zone.zonename} UTC${timezoneOffset(zone.zonename)} ${beijing}`.toLocaleLowerCase();
}
function timezoneOptions() {
  return [...$('timezoneMenu').querySelectorAll('.timezone-option')];
}
function timezoneOffsetMinutes(zone) {
  const match = timezoneOffset(zone.zonename).match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
}
function timezoneMenuZones(needle) {
  const commonRank = new Map(COMMON_TIMEZONES.map((name, index) => [name, index]));
  const sourceRank = new Map(TIMEZONES.zones.map((zone, index) => [zone.zonename, index]));
  const selected = currentTimezone().zonename;
  const zones = TIMEZONES.zones.filter((zone) => needle
    ? timezoneSearchText(zone).includes(needle)
    : commonRank.has(zone.zonename) || zone.zonename === selected);
  return zones.sort((a, b) =>
    timezoneOffsetMinutes(a) - timezoneOffsetMinutes(b) ||
    (commonRank.get(a.zonename) ?? Number.MAX_SAFE_INTEGER) - (commonRank.get(b.zonename) ?? Number.MAX_SAFE_INTEGER) ||
    sourceRank.get(a.zonename) - sourceRank.get(b.zonename));
}
function setTimezoneActive(index) {
  const options = timezoneOptions();
  if (!options.length) { timezoneActive = -1; return; }
  timezoneActive = Math.max(0, Math.min(index, options.length - 1));
  options.forEach((option, i) => option.classList.toggle('active', i === timezoneActive));
  options[timezoneActive].scrollIntoView({ block: 'nearest' });
  $('timezoneBox').setAttribute('aria-activedescendant', options[timezoneActive].id);
}
function openTimezoneMenu(query = '') {
  const menu = $('timezoneMenu');
  const needle = query.trim().toLocaleLowerCase();
  const zones = timezoneMenuZones(needle);
  menu.textContent = '';
  zones.forEach((zone, index) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'timezone-option';
    option.id = `timezoneOption${index}`;
    option.role = 'option';
    option.dataset.zonename = zone.zonename;
    option.textContent = timezoneLabel(zone);
    menu.appendChild(option);
  });
  timezoneActive = -1;
  menu.hidden = zones.length === 0;
  $('timezoneBox').setAttribute('aria-expanded', String(zones.length > 0));
  $('timezoneBox').removeAttribute('aria-activedescendant');
}
function closeTimezoneMenu() {
  $('timezoneMenu').hidden = true;
  $('timezoneBox').setAttribute('aria-expanded', 'false');
  $('timezoneBox').removeAttribute('aria-activedescendant');
  timezoneActive = -1;
}
function selectTimezone(zone) {
  state.timezone = zone.zonename;
  localStorage.setItem('wrt_timezone', zone.zonename);
  $('timezoneBox').value = timezoneLabel(zone);
  closeTimezoneMenu();
  if (!opkgSelectionExplicit && state.source) {
    state.opkg = defaultPackageMirrorId(state.source.id);
    renderFirmwareSettings();
  }
}
function timezoneMenuKeydown(event) {
  const options = timezoneOptions();
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if ($('timezoneMenu').hidden) openTimezoneMenu('');
    const count = timezoneOptions().length;
    if (!count) return;
    setTimezoneActive(event.key === 'ArrowDown'
      ? Math.min(timezoneActive + 1, count - 1)
      : (timezoneActive < 0 ? count - 1 : Math.max(timezoneActive - 1, 0)));
  } else if (event.key === 'Enter' && timezoneActive >= 0 && options[timezoneActive]) {
    event.preventDefault();
    const zone = TIMEZONES.zones.find((item) => item.zonename === options[timezoneActive].dataset.zonename);
    if (zone) selectTimezone(zone);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    $('timezoneBox').value = timezoneLabel(currentTimezone());
    closeTimezoneMenu();
  }
}
function renderTimezones() {
  const zone = currentTimezone();
  state.timezone = zone.zonename;
  $('timezoneBox').value = timezoneLabel(zone);
  closeTimezoneMenu();
}
function renderFirmwareSettings() {
  if (!state.source) return;
  renderTimezones();
  const knownLabels = {
    'luci-theme-argon': 'Argon', 'luci-theme-bootstrap': 'Bootstrap',
    'luci-theme-material': 'Material', 'luci-theme-openwrt-2020': 'OpenWrt 2020',
  };
  const catalogThemes = [...menuOptionBySymbol.keys()]
    .filter((symbol) => symbol.startsWith('PACKAGE_luci-theme-'))
    .map((symbol) => symbol.slice('PACKAGE_'.length));
  const available = MENU_CATALOG ? catalogThemes : [];
  const themes = [['@base', uiText('跟随基础配置', '跟隨基礎設定', 'Follow base config')]]
    .concat([...new Set(available)].map((id) => [id, knownLabels[id] || id.replace(/^luci-theme-/, '')]));
  if (!themes.some(([id]) => id === state.theme)) state.theme = '@base';
  state.theme = fillSelect('fwThemeBox', themes, state.theme);
  state.ntp = fillSelect('ntpBox', [
    ['cn', t('fw.ntp.cn')], ['global', t('fw.ntp.global')], ['cloudflare', t('fw.ntp.cloud')],
  ], state.ntp);
  const opkgEntries = packageMirrorEntries(state.source.id);
  if (!opkgSelectionExplicit || !opkgEntries.some(([id]) => id === state.opkg)) {
    state.opkg = defaultPackageMirrorId(state.source.id);
  }
  state.opkg = fillSelect('opkgBox', opkgEntries, state.opkg);
  updateSubmitGate();
}
function setFirmwareTheme(theme) {
  state.theme = theme;
  if (theme !== '@base' && MENU_CATALOG) {
    const option = menuOptionBySymbol.get(`PACKAGE_${theme}`);
    if (option) {
      minimumBootApplying = true;
      setMenuValueQuiet(option, 'y');
      minimumBootApplying = false;
    }
    renderMenuconfig();
    renderMinimumBoot();
    renderGroups();
    updateStats();
  }
  renderFirmwareSettings();
  renderMinimumBoot();
}

/* 当前源的登录信息提示,root 与密码状态着色强调 / per-source login hint with colored emphasis on "root" and the password value */
function updateLoginInfo() {
  if (!state.source) return;
  const box = $('loginInfo');
  box.textContent = '';
  const pwText = t(state.source.loginPw ? 'login.pw.' + state.source.loginPw : 'login.pw.none');
  //  作密码占位,模板任意语言通用 /  marks the password slot, language-agnostic
  const parts = t('login.info', { pw: '' }).split('');
  const addWithRoot = (str) => {
    for (const seg of str.split(/(root)/i)) {
      if (/^root$/i.test(seg)) {
        const em = document.createElement('em');
        em.className = 'login-user';
        em.textContent = seg;
        box.appendChild(em);
      } else if (seg) box.appendChild(document.createTextNode(seg));
    }
  };
  addWithRoot(parts[0] || '');
  // 密码"值"金色强调,括号里的附注保持普通样式并留空格 / gold-highlight only the password value; the parenthetical note stays plain, space-separated
  const noteAt = pwText.search(/[((]/);
  const pw = document.createElement('em');
  pw.className = 'login-pw';
  pw.textContent = noteAt > 0 ? pwText.slice(0, noteAt).trim() : pwText;
  box.appendChild(pw);
  if (noteAt > 0) box.appendChild(document.createTextNode('  ' + pwText.slice(noteAt)));
  addWithRoot(parts[1] || '');
}

/* ============ 插件列表 / Plugin list ============ */
function pluginState(p) {
  // Catalog-only 启动期间，Target 尚未应用前 source 会短暂为空。
  // 此时插件先按不可用处理，Catalog Target 应用后会重新渲染。
  if (!state.source) return 'unavailable';
  if (p.builtin && p.builtin[state.source.id]) return 'builtin';
  if (p.catalogOnly) {
    if (state.device?.id !== 'catalog-target' || !MENU_CATALOG) return 'unavailable';
    const option = curatedMenuOption(p);
    return option && optionVisible(option) ? 'ok' : 'unavailable';
  }
  if (state.device?.id === 'catalog-target' && MENU_CATALOG) {
    const option = curatedMenuOption(p);
    return option && optionVisible(option) ? 'ok' : 'unavailable';
  }
  if (state.source.append) return 'ok';   // append 模式产线:所有插件按追加方式可勾 / append-mode source: every plugin is selectable by appending
  if (!p.pkgs?.[state.source.id] && !p.pkg) return 'unavailable';
  return 'ok';
}
const byId = (id) => PLUGINS.plugins.find((x) => x.id === id);

/* 搜索匹配串:原文名/说明/id/包名 + en 名 + 当前语言名,任何语言下输英文名或本语言名都能命中 / Search haystack: original name/desc/id/package name + English name + current-language name, so English or localized names match in any UI language */
function searchHay(p) {
  const row = PLUG_I18N && PLUG_I18N.plugins && PLUG_I18N.plugins[p.id];
  const nm = row && row.name;
  return [p.id, p.name, p.desc || '', (state.source && p.pkgs?.[state.source.id]) || p.pkg || '',
    (nm && nm[FALLBACK]) || '', (nm && nm[state.lang]) || ''].join(' ').toLowerCase();
}

function renderGroups() {
  const box = $('groups');
  box.textContent = '';
  const kw = $('searchBox').value.trim().toLowerCase();
  const hotOnly = $('hotOnly').checked;
  const searching = !!kw || hotOnly;

  for (const g of PLUGINS.groups) {
    const items = PLUGINS.plugins.filter((p) => p.group === g)
      .filter((p) => state.advanced || pluginState(p) !== 'unavailable')
      .filter((p) => !hotOnly || p.hot)
      .filter((p) => !kw || searchHay(p).includes(kw));
    if (!items.length) continue;

    const group = document.createElement('div');
    group.className = 'group' + (!searching && collapsed.has(g) ? ' collapsed' : '') + (searching ? ' searching' : '');
    group.dataset.group = g;

    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'group-head';
    head.setAttribute('aria-expanded', String(searching || !collapsed.has(g)));
    const ico = document.createElement('span');
    ico.className = 'group-ico';
    ico.setAttribute('aria-hidden', 'true');
    ico.textContent = GROUP_ICONS[g] || '📦';
    head.appendChild(ico);
    head.appendChild(document.createTextNode(groupLabel(g)));
    const badge = document.createElement('span');
    badge.className = 'group-badge';
    badge.dataset.badge = g;
    head.appendChild(badge);
    const cnt = document.createElement('span');
    cnt.className = 'group-count';
    cnt.textContent = t('plugin.group.count', { n: items.length });
    head.appendChild(cnt);
    const chev = document.createElement('span');
    chev.className = 'chev';
    chev.setAttribute('aria-hidden', 'true');
    chev.textContent = '▾';
    head.appendChild(chev);
    head.addEventListener('click', () => {
      if (searching) return;
      if (collapsed.has(g)) collapsed.delete(g); else collapsed.add(g);
      group.classList.toggle('collapsed');
      head.setAttribute('aria-expanded', String(!collapsed.has(g)));
      if (!collapsed.has(g)) fitPluginNames(group);   // 折叠时量不到高度,展开后补测 / heights are unmeasurable while collapsed, so re-check on expand
    });
    group.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'plugin-grid';
    for (const p of items) grid.appendChild(renderPlugin(p));
    group.appendChild(grid);
    box.appendChild(group);
  }
  if (!box.children.length) {
    const empty = document.createElement('p');
    empty.className = 'hint empty-hint';
    empty.textContent = t('search.empty');
    box.appendChild(empty);
  }
  updateLegend();
  updateGroupBadges();
  fitPluginNames();
}

/* V11:插件名适配:默认单行,溢出先缩 1px,再分两行,再缩 1px(共 −2px),极端长名靠两行内省略号兜底 / V11: plugin-name fitting: single line by default; on overflow shrink 1px, then wrap to two lines, then shrink 1px more (−2px total); extreme names fall back to the two-line ellipsis */
function fitOneName(el) {
  el.classList.remove('fit-s1', 'two-line', 'fit-s2');
  if (!el.clientWidth) return;   // 折叠分组量不到尺寸,展开时再补测 / collapsed groups are unmeasurable; re-checked on expand
  const over = () => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
  if (!over()) return;
  el.classList.add('fit-s1');    // ① 字号 −1px / step 1: font −1px
  if (!over()) return;
  el.classList.add('two-line');  // ② 允许两行 / step 2: allow two lines
  if (!over()) return;
  el.classList.remove('fit-s1');
  el.classList.add('fit-s2');    // ③ 再 −1px(共 −2px),到此为止 / step 3: another −1px (−2px total); stop here
}
function fitPluginNames(scope) {
  (scope || document).querySelectorAll('.plugin-name').forEach(fitOneName);
}
function fitMenuCategoryNames(scope) {
  (scope || document).querySelectorAll('.menuconfig-category-text').forEach((element) => {
    element.classList.remove('menu-fit-s1', 'menu-fit-s2', 'menu-fit-s3', 'menu-fit-two-line');
    if (!matchMedia('(max-width: 640px)').matches || !element.clientWidth) return;
    const over = () => element.scrollWidth > element.clientWidth + 1;
    if (!over()) return;
    for (const className of ['menu-fit-s1', 'menu-fit-s2', 'menu-fit-s3']) {
      element.classList.add(className);
      if (!over()) return;
    }
    element.classList.remove('menu-fit-s1', 'menu-fit-s2', 'menu-fit-s3');
    element.classList.add('menu-fit-two-line');
  });
}
/* 窗口尺寸变化后防抖重测 / debounced re-fit on window resize */
let fitTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(fitTimer);
  fitTimer = setTimeout(() => {
    fitPluginNames();
    fitMenuCategoryNames();
  }, 150);
});

/* 插件项只显示名字以保持列表紧凑,说明收进气泡,点名字才弹出 / Plugin rows show only the name to keep the list compact; details live in a popover opened by clicking the name */
function renderPlugin(p) {
  const st = pluginState(p);
  const adv = state.advanced;
  const canForce = adv && devAllowGrey;   // V10:灰色项需开发者模式 + 二级门禁双开 / V10: grey items need developer mode AND the second gate
  // 必选项(locked):内置且任何模式都不可取消 / locked items stay checked & disabled even in advanced mode
  const lockedItem = p.locked && st === 'builtin';
  const item = document.createElement('div');
  item.className = 'plugin' +
    (st === 'unavailable' ? (canForce ? ' plugin-forceable' : ' plugin-disabled') : '') +
    (st === 'builtin' ? (adv && !lockedItem ? ' plugin-removable' : ' plugin-builtin') : '');

  const cbId = 'pcb-' + p.id;
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.id = cbId;
  cb.dataset.pid = p.id;
  const catalogOption = state.device?.id === 'catalog-target' ? curatedMenuOption(p) : null;
  const catalogOrigin = catalogOption ? catalogOriginMeta(catalogOption) : null;
  const catalogLocked = catalogOption && ['target', 'profile-add'].includes(catalogOrigin.kind) &&
    catalogBaselineValues.get(catalogOption.symbol) !== 'n';
  cb.checked = catalogOption
    ? (menuValues.get(catalogOption.symbol) ?? simpleKconfigDefault(catalogOption)) !== 'n'
    : st === 'builtin' ? !state.removed.has(p.id) : state.sel.has(p.id);
  // V10:灰色项只看双开关,其余沿用旧规则 / V10: grey items obey the double gate; everything else keeps the old rule
  cb.disabled = lockedItem || catalogLocked ||
    (st === 'unavailable' ? !canForce : (!adv && st !== 'ok'));
  if (catalogLocked) cb.title = uiText(
    '由当前 Target / Profile 基础配置锁定', '由目前 Target / Profile 基礎設定鎖定',
    'Locked by the current Target / Profile baseline');
  cb.setAttribute('aria-label', pName(p));
  cb.addEventListener('change', () => {
    if (catalogOption) {
      setMenuValue(catalogOption, cb.checked ? 'y' : 'n');
      return;
    }
    const selectedBefore = new Set(state.sel);
    if (st === 'builtin') {
      if (cb.checked) {
        state.removed.delete(p.id);
      } else {
        state.removed.add(p.id);
        if (p.warn) showToast(t(p.warn));   // 取消高风险内置项时同样提示 / warn when removing a risky builtin too
      }
    } else if (cb.checked) {
      state.sel.add(p.id);
      if (p.warn) showToast(t(p.warn));   // 资源警告(如 Docker)勾选即弹 / resource warning pops right on ticking
    } else {
      state.sel.delete(p.id);
    }
    syncCuratedToMenu(p, cb.checked ? 'y' : 'n');
    for (const id of state.sel) {
      if (!selectedBefore.has(id)) {
        const required = byId(id);
        if (required && required.id !== p.id) syncCuratedToMenu(required, 'y');
      }
    }
    updateStats();
  });
  item.appendChild(cb);

  const nameBtn = document.createElement('button');
  nameBtn.type = 'button';
  nameBtn.className = 'plugin-name';
  nameBtn.appendChild(document.createTextNode(pName(p)));
  if (p.hot) {
    const hot = document.createElement('span');
    hot.className = 'hot';
    hot.textContent = t('plugin.hot');
    nameBtn.appendChild(hot);
  }
  if (canForce && st === 'unavailable') {
    const f = document.createElement('span');
    f.className = 'flag flag-force';
    f.textContent = t('adv.forced');
    nameBtn.appendChild(f);
  }
  if (lockedItem) {
    const f = document.createElement('span');
    f.className = 'flag flag-required';
    f.textContent = t('plugin.required');
    nameBtn.appendChild(f);
  }
  if (catalogOption) {
    const origin = catalogOrigin;
    if (catalogLocked) {
      const required = document.createElement('span');
      required.className = 'flag flag-required';
      required.textContent = t('plugin.required');
      nameBtn.appendChild(required);
    }
    if (origin.kind !== 'inactive') {
      const f = document.createElement('span');
      f.className = `flag flag-origin flag-origin-${origin.kind}`;
      f.textContent = origin.label;
      f.title = origin.detail || origin.label;
      nameBtn.appendChild(f);
    }
  }
  const detail = (st === 'builtin' ? t('plugin.builtin')
    : st === 'unavailable' ? t('plugin.unavailable')
    : pDesc(p)) + (catalogOrigin && catalogOrigin.kind !== 'inactive'
      ? `\n${uiText('来源', '來源', 'Origin')}: ${catalogOrigin.label}` : '') +
    (p.warn ? '\n' + t(p.warn) : '');
  const pkg = p.pkgs?.[state.source.id] || p.pkg || p.catalogCandidates?.[0] || p.id;
  nameBtn.title = detail;
  nameBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showPopover(nameBtn, pName(p), detail + '\n' + pkg + ' · ' + t('drawer.size', { n: fmtSize(p.size || 1) }));
  });
  item.appendChild(nameBtn);
  return item;
}

/* V10:清掉已强制勾选的灰色项并轻提示,门禁取消与关闭开发者模式共用 / V10: drop force-selected grey items with a light toast; shared by gate-off and developer-mode-off */
function clearForcedGrey() {
  const dropped = [];
  for (const id of [...state.sel]) {
    const p = byId(id);
    if (p && pluginState(p) !== 'ok') { state.sel.delete(id); dropped.push(pName(p)); }
  }
  if (dropped.length) showToast(t('drawer.inactive', { list: dropped.join('、') }));
}
/* V10:门禁复位:不记忆,开发者模式每次开/关都回到未勾 / V10: reset the gate; no memory — it returns to unticked on every developer-mode flip */
function resetAdvGrey() {
  devAllowGrey = false;
  $('advGrey').checked = false;
  $('advGreyRow').hidden = !state.advanced;
}
/* V10:灰色门禁子开关:勾选必须过确认弹窗,取消立即清理强制项 / V10: the grey-gate sub-toggle; ticking requires a confirm dialog, unticking cleans forced items at once */
$('advGrey').addEventListener('change', () => {
  if ($('advGrey').checked) {
    if (!confirm(t('adv.grey.confirm'))) { $('advGrey').checked = false; return; }   // 取消则回弹不勾 / cancel bounces it back unticked
    devAllowGrey = true;
  } else {
    devAllowGrey = false;
    clearForcedGrey();
  }
  renderGroups();
  updateStats();
});

/* 开发者模式开关(原"高级模式") / developer-mode toggle (formerly advanced mode) */
$('advMode').addEventListener('change', () => {
  if ($('advMode').checked) {
    if (!confirm(t('adv.confirm'))) { $('advMode').checked = false; return; }
    state.advanced = true;
    showToast(t('adv.on'));
  } else {
    state.advanced = false;
    // 关闭时清掉仅开发者模式才成立的选择,避免普通模式携带非法状态 / On turning off, drop selections only valid in developer mode so normal mode never carries illegal state
    clearForcedGrey();
    state.removed.clear();
  }
  resetAdvGrey();   // V10:门禁随开发者模式开/关一律复位 / V10: the gate resets on every developer-mode flip
  safeSet('wrt_adv', state.advanced ? '1' : '0');
  renderGroups();
  updateStats();
});

let searchTimer = 0;
$('searchBox').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(renderGroups, 150); });
$('hotOnly').addEventListener('change', renderGroups);

/* 当前源下真正生效的选择,勾选项在换源后可能不再可用 / Selections actually effective under the current source; checked items may become unavailable after switching sources */
function effectiveSelection() {
  const normal = [], forced = [], removed = [];
  const catalogTarget = state.device?.id === 'catalog-target';
  for (const p of PLUGINS.plugins) {
    const st = pluginState(p);
    if (catalogTarget && state.removed.has(p.id)) { removed.push(p); continue; }
    if (st === 'builtin') { if (state.removed.has(p.id)) removed.push(p); continue; }
    if (!state.sel.has(p.id)) continue;
    if (st === 'ok') normal.push(p);
    else if (state.advanced) forced.push(p);
  }
  return { normal, forced, removed, all: normal.concat(forced) };
}

function updateLegend() {
  let ok = 0, builtin = 0, off = 0;
  for (const p of PLUGINS.plugins) {
    const st = pluginState(p);
    if (st === 'ok') ok++; else if (st === 'builtin') builtin++; else off++;
  }
  $('availStats').textContent = t('legend.stats', { ok, builtin, off });
}
function updateGroupBadges() {
  document.querySelectorAll('.group-badge').forEach((b) => {
    const g = b.dataset.badge;
    const n = PLUGINS.plugins.filter((p) => p.group === g && (state.sel.has(p.id) || state.removed.has(p.id))).length;
    b.textContent = n ? t('plugin.group.selected', { n }) : '';
  });
}

function updateStats() {
  const sel = effectiveSelection();
  const n = sel.all.length + sel.removed.length;
  $('selCount').textContent = t('bar.selected', { n });
  const sizeSum = sel.all.reduce((s, p) => s + (p.size || 1), 0);
  const budget = (state.variant && state.variant.capacity) || 60;
  const pct = Math.min(100, Math.round((sizeSum / budget) * 100));
  const fill = $('capFill');
  fill.style.width = pct + '%';
  fill.className = 'cap-fill' + (pct >= 100 ? ' over' : pct >= 75 ? ' warn' : '');
  $('capText').textContent = t('bar.capacity', { pct }) + (pct >= 100 ? ' ' + t('bar.capacity.over') : '');
  updateGroupBadges();
  renderBuildContract();
}

/* ============ 已选清单 / Selected list ============ */
function openSelectedDrawer() {
  const sel = effectiveSelection();
  const rows = sel.normal.concat(sel.forced).map((p) => ({ p, kind: sel.forced.includes(p) ? 'force' : '' }))
    .concat(sel.removed.map((p) => ({ p, kind: 'remove' })));
  openModal(t('drawer.title'));
  const mb = $('modalBody');
  mb.textContent = '';
  if (!rows.length) {
    const p = document.createElement('p');
    p.textContent = t('drawer.empty');
    mb.appendChild(p);
    return;
  }
  const list = document.createElement('div');
  list.className = 'sel-list';
  for (const { p, kind } of rows) {
    const row = document.createElement('div');
    row.className = 'sel-row';
    const name = document.createElement('span');
    name.textContent = pName(p);
    if (kind) {
      const f = document.createElement('span');
      f.className = 'flag ' + (kind === 'force' ? 'flag-force' : 'flag-remove');
      f.textContent = kind === 'force' ? t('adv.forced') : t('adv.removed');
      name.appendChild(f);
    }
    const sz = document.createElement('span');
    sz.className = 'sel-size';
    sz.textContent = t('drawer.size', { n: fmtSize(p.size || 1) });
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'sel-rm';
    rm.textContent = '✕';
    rm.setAttribute('aria-label', t('drawer.remove', { name: pName(p) }));
    rm.addEventListener('click', () => {
      const catalogOption = state.device?.id === 'catalog-target' ? curatedMenuOption(p) : null;
      if (catalogOption) restoreCatalogDefault(catalogOption);
      else if (kind === 'remove') state.removed.delete(p.id);
      else state.sel.delete(p.id);
      const cb = document.querySelector('input[data-pid="' + p.id + '"]');
      if (cb && !catalogOption) cb.checked = kind === 'remove';
      updateStats();
      row.remove();
      if (!list.children.length) closeModal();
    });
    row.appendChild(name); row.appendChild(sz); row.appendChild(rm);
    list.appendChild(row);
  }
  mb.appendChild(list);
  const inactive = PLUGINS.plugins.filter((p) => state.sel.has(p.id) && pluginState(p) === 'unavailable' && !state.advanced);
  if (inactive.length) {
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = t('drawer.inactive', { list: inactive.map((p) => pName(p)).join('、') });
    mb.appendChild(note);
  }
}
$('selCount').addEventListener('click', openSelectedDrawer);

/* ============ 生成 .config / Generate the .config ============ */
function setConfigSymbol(text, symbol, value, type = 'bool') {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const line = value === 'n' || value === ''
    ? `# CONFIG_${symbol} is not set`
    : `CONFIG_${symbol}=${type === 'string' && !/^".*"$/.test(value) ? JSON.stringify(value) : value}`;
  const pattern = new RegExp(`^(?:CONFIG_${escaped}=.*|# CONFIG_${escaped} is not set)$`, 'm');
  if (pattern.test(text)) return text.replace(pattern, line);
  return text.replace(/\s*$/, '\n') + line + '\n';
}
function configSymbolValues(text) {
  const values = new Map();
  for (const match of String(text).matchAll(/^CONFIG_([A-Za-z0-9_.+-]+)=([ym])$/gm)) values.set(match[1], match[2]);
  for (const match of String(text).matchAll(/^# CONFIG_([A-Za-z0-9_.+-]+) is not set$/gm)) values.set(match[1], 'n');
  return values;
}
function configRuleExpectedValueMatches(actual, expected) {
  return (Array.isArray(expected) ? expected : [expected]).includes(actual);
}
function matchingConfigRules(text) {
  const values = configSymbolValues(text);
  const target = state.device?.target || {};
  const targetValue = (symbol) => String(text).match(new RegExp(`^CONFIG_${symbol}="([^"]+)"$`, 'm'))?.[1] || '';
  const scope = {
    sourceId: state.source?.id, branch: state.version?.branch,
    system: targetValue('TARGET_BOARD') || target.system,
    subtarget: targetValue('TARGET_SUBTARGET') || target.subtarget,
    profile: targetValue('TARGET_PROFILE') || target.profile || state.variant?.id,
  };
  const fields = [['sources', 'sourceId'], ['branches', 'branch'], ['systems', 'system'],
    ['subtargets', 'subtarget'], ['profiles', 'profile']];
  return (CONFIG_RULES?.rules || []).filter((rule) =>
    fields.every(([scopeKey, contextKey]) => !rule.scope?.[scopeKey]?.length || rule.scope[scopeKey].includes(scope[contextKey])) &&
    Object.entries(rule.when?.all || {}).every(([symbol, expected]) =>
      configRuleExpectedValueMatches(values.get(symbol), expected)) &&
    (!Object.keys(rule.when?.any || {}).length ||
      Object.entries(rule.when.any).some(([symbol, expected]) =>
        configRuleExpectedValueMatches(values.get(symbol), expected))));
}
function configRuleMessage(rules) {
  const messages = rules.map((rule) => rule.message?.['zh-CN'] || rule.message?.en || rule.id).join(' ');
  return uiText(messages, messages, rules.map((rule) => rule.message?.en || rule.id).join(' '));
}
function configRuleResolution(rule) {
  const resolutions = rule.resolutions || [];
  const selected = configRuleChoices.get(rule.id);
  return resolutions.find((item) => item.id === selected) ||
    resolutions.find((item) => item.recommended) || resolutions[0] || null;
}
function applyConfigRules(text, rules) {
  for (const rule of rules) {
    const resolution = configRuleResolution(rule);
    for (const [symbol, value] of Object.entries(resolution?.set || rule.set || {})) {
      text = setConfigSymbol(text, symbol, value);
    }
    const values = configSymbolValues(text);
    for (const [prefix, value] of Object.entries(resolution?.setPrefixes || rule.setPrefixes || {})) {
      for (const symbol of values.keys()) {
        if (symbol.startsWith(prefix)) text = setConfigSymbol(text, symbol, value);
      }
    }
  }
  return text;
}
class ConfigRuleResolutionRequired extends Error {
  constructor(rules) {
    super(configRuleMessage(rules));
    this.rules = rules;
  }
}
class BuildRequirementResolutionRequired extends Error {
  constructor(requirements) {
    super(uiText('构建配置缺少当前源码的必需项。', '建置設定缺少目前原始碼的必要項目。',
      'The build configuration is missing required options for this source.'));
    this.requirements = requirements;
  }
}
function requirementScopeMatches(scope = {}, context = {}) {
  const fields = [
    ['sources', 'sourceId'], ['branches', 'branch'], ['systems', 'system'],
    ['subtargets', 'subtarget'], ['profiles', 'profile'],
  ];
  return fields.every(([scopeKey, contextKey]) =>
    !scope[scopeKey]?.length || scope[scopeKey].includes('*') || scope[scopeKey].includes(context[contextKey]));
}
function configStringValue(text, symbol) {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(text).match(new RegExp(`^CONFIG_${escaped}="([^"]*)"$`, 'm'))?.[1] || '';
}
function currentBuildRequirementContext(text) {
  return {
    sourceId: state.source?.id || '',
    branch: state.version?.branch || state.version?.id || '',
    system: configStringValue(text, 'TARGET_BOARD') || state.device?.target?.system || '',
    subtarget: configStringValue(text, 'TARGET_SUBTARGET') || state.device?.target?.subtarget || '',
    profile: configStringValue(text, 'TARGET_PROFILE') || state.device?.target?.profileSymbol || '',
  };
}
function matchingBuildRequirements(text) {
  const context = currentBuildRequirementContext(text);
  return (BUILD_REQUIREMENTS?.requirements || []).filter((requirement) =>
    requirementScopeMatches(requirement.scope, context));
}
function missingBuildRequirements(text) {
  return matchingBuildRequirements(text).map((requirement) => ({
    ...requirement,
    missingOptions: (requirement.options || []).filter((option) =>
      configSymbolValue(text, option.symbol) !== option.value),
  })).filter((requirement) => requirement.missingOptions.length);
}
function applyAcceptedBuildRequirements(text) {
  let menuChanged = false;
  for (const requirement of matchingBuildRequirements(text)) {
    if (!acceptedBuildRequirements.has(requirement.id)) continue;
    for (const option of requirement.options || []) {
      text = setConfigSymbol(text, option.symbol, option.value);
      if (menuOptionBySymbol.has(option.symbol)) {
        menuValues.set(option.symbol, option.value);
        menuTouched.add(option.symbol);
        menuChanged = true;
      }
    }
  }
  if (menuChanged) markCatalogStateChanged();
  return text;
}
function applyMenuConfig(text) {
  if (!MENU_CATALOG) return text;
  for (const symbol of new Set([
    ...catalogContractSymbols, ...menuTouched, ...catalogRecommendedValues.keys(),
    ...catalogUserOverrides.keys(), ...catalogImportedSymbols,
  ])) {
    const option = menuOptionBySymbol.get(symbol);
    if (option) text = setConfigSymbol(text, symbol, String(menuValues.get(symbol) ?? 'n'), option.type);
  }
  return text;
}
function applyImportedUnknownEdits(text) {
  for (const [symbol, edit] of importedUnknownEdits) {
    if (edit.action === 'delete') {
      const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp(`^(?:CONFIG_${escaped}=.*|# CONFIG_${escaped} is not set)\\r?\\n?`, 'm'), '');
    } else {
      text = setConfigSymbol(text, symbol, String(edit.value ?? 'n'));
    }
  }
  return text;
}
function catalogTargetConfig() {
  const target = state.device.target;
  const targetSelector = target.targetSelector ||
    `TARGET_${target.system}${target.subtarget ? `_${target.subtarget}` : ''}`;
  const profileSymbol = target.profileSymbol || (target.profile ? `DEVICE_${target.profile}` : '');
  const profileSelector = target.profileSelector || `${targetSelector}_${profileSymbol}`;
  const boardSelector = target.boardSelector || `TARGET_${target.system}`;
  const arch = String(target.arch || '').trim();
  const archPackages = String(target.archPackages || '').trim();
  if (!arch || !/^[A-Za-z0-9_+-]+$/.test(arch)) {
    throw new Error('Catalog target is missing a valid build architecture');
  }
  if (!archPackages || !/^[A-Za-z0-9._+-]+$/.test(archPackages)) {
    throw new Error('Catalog target is missing a valid package architecture');
  }
  const lines = [
    ...(boardSelector && boardSelector !== targetSelector ? [`CONFIG_${boardSelector}=y`] : []),
    `CONFIG_${targetSelector}=y`,
    `CONFIG_${profileSelector}=y`,
    `CONFIG_${arch}=y`,
    `CONFIG_ARCH="${arch}"`,
    `CONFIG_TARGET_BOARD="${target.system}"`,
    `CONFIG_TARGET_ARCH_PACKAGES="${archPackages}"`,
  ];
  if (target.subtarget) lines.push(`CONFIG_TARGET_SUBTARGET="${target.subtarget}"`);
  if (profileSymbol) lines.push(`CONFIG_TARGET_PROFILE="${profileSymbol}"`);
  lines.push('');
  let text = lines.join('\n');
  return applyMenuConfig(text);
}
function enforceCatalogProfilePackages(text) {
  const target = state.device?.target;
  if (state.device?.id !== 'catalog-target' || !target) return text;
  for (const pkg of target.profilePackagesAdd || target.profilePackages || []) {
    if (String(pkg).startsWith('-')) continue;
    if (!/^[A-Za-z0-9._+@-]+$/.test(pkg)) throw new Error(`Catalog profile package is invalid: ${pkg}`);
    text = setConfigSymbol(text, `PACKAGE_${pkg}`, 'y', 'bool');
  }
  for (const pkg of target.profilePackagesRemove || []) {
    if (!/^[A-Za-z0-9._+@-]+$/.test(pkg)) throw new Error(`Catalog profile removal is invalid: ${pkg}`);
    text = setConfigSymbol(text, `PACKAGE_${pkg}`, 'n', 'bool');
  }
  return text;
}
function applyToConfig(text, sel) {
  const src = state.source.id;
  for (const pair of state.variant.patch || []) text = text.split(pair.from).join(pair.to);
  const setY = (pkg) => {
    const notset = '# CONFIG_PACKAGE_' + pkg + ' is not set';
    const asM = 'CONFIG_PACKAGE_' + pkg + '=m';
    const asY = 'CONFIG_PACKAGE_' + pkg + '=y';
    if (text.includes(notset)) text = text.replace(notset, asY);
    else if (text.includes(asM + '\n') || text.endsWith(asM)) text = text.replace(asM, asY);
    else if (!text.includes(asY)) text += '\n' + asY;
  };
  for (const p of sel.all) setY(p.pkgs[src] || p.pkg);
  for (const p of sel.removed) {
    const pkg = p.pkgs[src] || p.pkg;
    text = text.replace('CONFIG_PACKAGE_' + pkg + '=y', '# CONFIG_PACKAGE_' + pkg + ' is not set');
  }
  const zone = currentTimezone();
  text = applyImportedUnknownEdits(text);
  text = applyMenuConfig(text);
  // “跟随基础配置”不改主题；选择具体主题只负责启用该主题，依赖包由 Catalog 保留。
  if (state.theme !== '@base') setY(state.theme);
  let resolvedTheme = resolveConfigTheme(text, false);
  if (!resolvedTheme) {
    resolvedTheme = 'luci-theme-bootstrap';
    setY(resolvedTheme);
  }
  const minimum = state.minimumBoot
    ? minimumBootRows().filter((item) => configSymbolValue(text, item.symbol) !== 'n')
      .map((item) => `${item.id}=${configSymbolValue(text, item.symbol)}`).join(' ')
    : '';
  return '# Generated by WeiG-OpenWrt-AutoBuild web customizer\n' +
    '# page-version=' + state.siteVersion + '\n' +
    '# device=' + state.device.id + ' source=' + src + ' version=' + state.version.id +
    ' (' + state.version.branch + ') variant=' + state.variant.id + '\n' +
    '# firmware-settings: zonename=' + zone.zonename + ' timezone=' + zone.timezone + ' theme=' + resolvedTheme +
    ' ntp=' + state.ntp + ' opkg=' + state.opkg + '\n' +
    (minimum ? '# recommended: ' + minimum + '\n' : '') +
    '# plugins: ' + (sel.normal.map((p) => p.id).join(' ') || '(none)') + '\n' +
    (sel.forced.length ? '# forced (advanced): ' + sel.forced.map((p) => p.id).join(' ') + '\n' : '') +
    (sel.removed.length ? '# removed builtin (advanced): ' + sel.removed.map((p) => p.id).join(' ') + '\n' : '') + text;
}
function repairCatalogConfiguration(text) {
  if (!CATALOG_ENGINE || !CATALOG_MODEL) return text;
  const values = CATALOG_ENGINE.parseConfigDocument(text);
  const context = catalogValidationContext(values, 'pre-defconfig');
  const repairs = CATALOG_ENGINE.proposeRepairs(
    CATALOG_MODEL, context.values, context.validationOptions,
  );
  return repairs.changes.length
    ? CATALOG_ENGINE.applyChangesToConfig(text, repairs.changes, CATALOG_MODEL)
    : text;
}
function assertCatalogConfiguration(text) {
  if (!CATALOG_ENGINE || !CATALOG_MODEL) throw new Error('Catalog engine is not ready');
  const values = CATALOG_ENGINE.parseConfigDocument(text);
  const context = catalogValidationContext(values, 'pre-defconfig');
  const violations = CATALOG_ENGINE.validateConfig(
    CATALOG_MODEL, context.values, context.validationOptions,
  );
  if (!violations.length) return;
  throw new Error(uiText(
    `Catalog 配置验证失败：${CATALOG_ENGINE.formatViolations(violations)}`,
    `Catalog 設定驗證失敗：${CATALOG_ENGINE.formatViolations(violations)}`,
    `Catalog configuration validation failed: ${CATALOG_ENGINE.formatViolations(violations)}`));
}
function resolveConfigTheme(text, fallback = true) {
  const enabled = [...String(text).matchAll(/^CONFIG_PACKAGE_(luci-theme-[A-Za-z0-9._+-]+)=y$/gm)]
    .map((match) => match[1]);
  if (state.theme !== '@base' && enabled.includes(state.theme)) return state.theme;
  return enabled[0] || (fallback ? 'luci-theme-bootstrap' : '');
}
function configFirmwareSettings(text) {
  const match = String(text).match(/^# firmware-settings: .* theme=([^\s]+) ntp=/m);
  return { timezone: state.timezone, theme: match?.[1] || resolveConfigTheme(text),
    ntp: state.ntp, opkg: state.opkg };
}

async function generateConfigText({ enforceBuildRequirements = false } = {}) {
  if (state.device.id === 'catalog-target') {
    const source = selectedCatalogSource();
    const branch = selectedCatalogBranch(source);
    if (!MENU_CATALOG || menuCatalogKey !== `${source.id}/${branch.branch}` ||
        state.source.id !== source.id || state.version.branch !== branch.branch) {
      throw new Error('The selected menuconfig catalog has not finished loading');
    }
  }
  const configId = [state.device.id, state.source.id, state.version.id, state.variant.id].join('/');
  let raw;
  if (state.importedConfig &&
      (state.importedConfigId === configId || ['custom-target', 'catalog-target'].includes(state.device.id))) {
    raw = state.importedConfig;
  } else if (state.device.id === 'catalog-target') {
    raw = catalogTargetConfig();
  } else {
    throw new Error('This workspace requires an uploaded authoritative .config');
  }
  let config = applyToConfig(raw, effectiveSelection());
  if (!state.importedConfig) config = enforceCatalogProfilePackages(config);
  for (let pass = 0; pass < 16; pass++) {
    const rules = matchingConfigRules(config);
    if (!rules.length) break;
    const unresolved = rules.filter((rule) => !configRuleChoices.has(rule.id));
    const needsChoice = unresolved.filter((rule) => state.importedConfig || rule.prompt === 'always');
    if (needsChoice.length) throw new ConfigRuleResolutionRequired(needsChoice);
    const updated = applyConfigRules(config, rules);
    if (updated === config) throw new Error(uiText('配置规则未产生修正，请检查规则文件。', '設定規則未產生修正，請檢查規則檔。', 'The configuration rule made no change; check the rule file.'));
    config = updated;
  }
  if (matchingConfigRules(config).length) throw new Error(uiText('配置规则循环超过 16 次，请检查规则文件。', '設定規則循環超過 16 次，請檢查規則檔。', 'Configuration rules exceeded 16 passes; check the rule file.'));
  config = repairCatalogConfiguration(config);
  assertCatalogConfiguration(config);
  if (enforceBuildRequirements && !state.useDefconfig) {
    config = applyAcceptedBuildRequirements(config);
    const missing = missingBuildRequirements(config);
    if (missing.length) throw new BuildRequirementResolutionRequired(missing);
  }
  return config;
}

function localStamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return String(now.getFullYear()).slice(-2) + pad(now.getMonth() + 1) + pad(now.getDate()) +
    '_' + pad(now.getHours()) + pad(now.getMinutes());
}
function safeDownloadNamePart(value, fallback = 'profile') {
  const cleaned = String(value || '').trim().replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function selectedTargetProfileName() {
  const profile = state.device?.target?.profileSymbol || state.variant?.profile || state.variant?.id;
  return String(profile || '').replace(/^DEVICE_/, '') || 'profile';
}

function selectedTargetProfileLabel() {
  return String(state.device?.target?.profileLabel || selectedTargetProfileName()).trim() || 'profile';
}

function requestTargetProfilePart(forFilename = false) {
  const forbidden = forFilename ? /[\\/:*?"<>|]+/g : /[\\:*?"<>|]+/g;
  return selectedTargetProfileLabel().replace(/\s+/g, '_').replace(forbidden, '-').replace(/^-+|-+$/g, '') || 'profile';
}

function downloadBlob(text, type, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function downloadConfig(btn) {
  btn.disabled = true;
  btn.textContent = t('btn.download.busy');
  try {
    const text = await generateResolvedConfigText();
    downloadBlob(text, 'text/plain;charset=utf-8',
      [state.device.id, localStamp(), state.source.id, state.version.id, state.variant.id].join('-') + '.config');
  } catch (err) {
    alert(t('btn.download.fail', { msg: err.message }));
  } finally {
    btn.disabled = false;
    btn.textContent = t('btn.download');
  }
}

/* ============ 加载 .config / build-request.json / config.buildinfo ============ */
let lastImportLog = null;
let configImportSeq = 0;
function importStateSnapshot() {
  return {
    device: state.device?.id || '',
    source: state.source?.id || '',
    version: state.version?.id || '',
    variant: state.variant?.id || '',
    importedConfigId: state.importedConfigId || '',
  };
}
function importLogStep(stage, detail = {}) {
  if (!lastImportLog) return;
  lastImportLog.events.push({ time: new Date().toISOString(), stage, ...detail });
}
function beginImportLog(file) {
  lastImportLog = {
    schema: 1,
    startedAt: new Date().toISOString(),
    pageVersion: state.siteVersion,
    browser: navigator.userAgent,
    file: { name: file?.name || '', size: file?.size || 0, type: file?.type || '' },
    events: [],
  };
  importLogStep('start');
  $('importLogBtn').hidden = true;
}
function finishImportLog(status, error) {
  if (!lastImportLog) return;
  const detail = { status, state: importStateSnapshot() };
  if (error) {
    detail.error = {
      name: error.name || 'Error',
      message: error.message || String(error),
      stack: error.stack || '',
    };
  }
  importLogStep(status, detail);
  lastImportLog.finishedAt = new Date().toISOString();
  lastImportLog.status = status;
  $('importLogBtn').hidden = false;
}
function downloadImportLog() {
  if (!lastImportLog) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const text = 'WeiG OpenWrt config import diagnostic log\n' +
    'Privacy: full config content and passwords are not recorded.\n\n' +
    JSON.stringify(lastImportLog, null, 2) + '\n';
  downloadBlob(text, 'text/plain;charset=utf-8', `wrt-import-${lastImportLog.status || 'running'}-${stamp}.log`);
}
function showImportError(error) {
  finishImportLog('error', error);
  openModal(t('import.errorTitle'));
  const body = $('modalBody');
  body.textContent = '';
  const summary = document.createElement('p');
  summary.className = 'import-error';
  summary.textContent = t('import.fail', { msg: error.message || String(error) });
  const note = document.createElement('p');
  note.className = 'import-log-note';
  note.textContent = t('import.logPrivacy');
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const download = document.createElement('button');
  download.type = 'button';
  download.className = 'btn btn-primary';
  download.textContent = t('import.downloadLog');
  download.addEventListener('click', downloadImportLog);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn';
  close.textContent = t('btn.close');
  close.addEventListener('click', closeModal);
  actions.append(download, close);
  body.append(summary, note, actions);
}
function targetLines(text) {
  return text.replace(/\r\n/g, '\n').split('\n').filter((line) =>
    /^CONFIG_TARGET_(?:BOARD|SUBTARGET|PROFILE|ARCH_PACKAGES)=/.test(line) ||
    /^CONFIG_TARGET_.*_DEVICE_.*=y$/.test(line)).sort();
}
function importedConfigMeta(text, fileName, payload) {
  const values = parseConfigValues(text);
  const generated = text.match(
    /^# device=([^\s]+) source=([^\s]+) version=([^\s]+)(?: \(([^)]+)\))?.* variant=([^\s]+)$/m);
  const payloadParts = typeof payload?.configId === 'string' ? payload.configId.split('/') : [];
  const name = String(fileName || '').toLowerCase();
  const deviceLine = [...values].find(([symbol, value]) =>
    /^TARGET_.*_DEVICE_/.test(symbol) && value === 'y')?.[0] || '';
  const deviceParts = deviceLine.match(/^TARGET_(.+)_(.+)_DEVICE_(.+)$/);
  const clean = (value) => String(value || '').replace(/^"|"$/g, '');
  const sourceHint = payload?.source || generated?.[2] || payloadParts[1] ||
    (/#\s*ImmortalWrt Configuration/i.test(text) || name.includes('immortalwrt') ? 'ImmortalWrt'
      : /#\s*LEDE Configuration/i.test(text) || name.includes('lede') ? 'lede'
        : /#\s*OpenWrt Configuration/i.test(text) || name.includes('openwrt') ? 'OpenWrt' : '');
  let branchHint = payload?.version || generated?.[4] || generated?.[3] || payloadParts[2] || '';
  const knownBranches = [...new Set((MENU_INDEX?.sources || [])
    .flatMap((source) => (source.branches || []).map((branch) => branch.branch)))];
  const namedBranch = knownBranches.find((branch) =>
    name.includes(branch.toLowerCase()) || name.includes(branch.replace(/^openwrt-/, '')));
  if (!branchHint && namedBranch) branchHint = namedBranch;
  if (!branchHint && /(?:^|[-_.])(master|main)(?:[-_.]|$)/.test(name)) {
    branchHint = name.match(/(?:^|[-_.])(master|main)(?:[-_.]|$)/)?.[1] || '';
  }
  const profileSymbol = clean(values.get('TARGET_PROFILE')) ||
    (deviceParts?.[3] ? `DEVICE_${deviceParts[3]}` : '');
  return {
    sourceHint,
    branchHint,
    system: clean(values.get('TARGET_BOARD')) || deviceParts?.[1] || '',
    subtarget: clean(values.get('TARGET_SUBTARGET')) || deviceParts?.[2] || '',
    profileSymbol: profileSymbol
      ? (profileSymbol.startsWith('DEVICE_') ? profileSymbol : `DEVICE_${profileSymbol}`) : '',
  };
}
function chooseImportedSourceBranch(meta) {
  const sources = MENU_INDEX?.sources || [];
  if (!sources.length) return Promise.reject(new Error('Catalog source index is empty'));
  importLogStep('source-branch-candidates', {
    detectedSource: meta.sourceHint || '',
    detectedBranch: meta.branchHint || '',
    sources: sources.map((source) => ({
      id: source.id,
      branches: source.branches.map((branch) => ({
        id: branch.id, branch: branch.branch, state: branch.state || 'fresh',
      })),
    })),
  });
  return new Promise((resolve) => {
    openModal(t('import.sourceTitle'));
    $('modal').querySelector('.modal').classList.add('modal-import-source');
    const body = $('modalBody');
    body.textContent = '';
    const intro = document.createElement('p');
    intro.textContent = t('import.sourceIntro');
    const form = document.createElement('div');
    form.className = 'import-source-grid';
    const sourceField = document.createElement('label');
    sourceField.className = 'import-source-field';
    const sourceLabel = document.createElement('span');
    sourceLabel.textContent = 'Source';
    const sourceSelect = document.createElement('select');
    sourceSelect.className = 'target-select';
    const detectedSource = sources.find((source) => source.id === meta.sourceHint);
    const currentSource = sources.find((source) => source.id === state.source?.id);
    for (const source of sources) {
      const option = document.createElement('option');
      option.value = source.id;
      option.textContent = source.label || source.id;
      sourceSelect.appendChild(option);
    }
    sourceSelect.value = (detectedSource || currentSource || sources[0]).id;
    sourceField.append(sourceLabel, sourceSelect);

    const branchField = document.createElement('label');
    branchField.className = 'import-source-field';
    const branchLabel = document.createElement('span');
    branchLabel.textContent = 'Branch';
    const branchSelect = document.createElement('select');
    branchSelect.className = 'target-select';
    branchField.append(branchLabel, branchSelect);
    form.append(sourceField, branchField);

    const target = document.createElement('div');
    target.className = 'import-target-preview';
    const targetParts = [
      ['Target System', meta.system],
      ['Subtarget', meta.subtarget],
      ['Target Profile', meta.profileSymbol],
    ].filter(([, value]) => value);
    for (const [label, value] of targetParts) {
      const item = document.createElement('div');
      const key = document.createElement('span');
      const val = document.createElement('strong');
      key.textContent = label;
      val.textContent = value;
      item.append(key, val);
      target.appendChild(item);
    }

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'btn btn-primary';
    confirm.textContent = t('import.sourceContinue');
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn';
    cancel.textContent = t('import.sourceCancel');
    actions.append(confirm, cancel);
    body.append(intro, form);
    if (targetParts.length) body.appendChild(target);
    body.appendChild(actions);

    const fillBranches = () => {
      const source = sources.find((item) => item.id === sourceSelect.value) || sources[0];
      branchSelect.textContent = '';
      for (const branch of source.branches) {
        const option = document.createElement('option');
        option.value = branch.id;
        option.textContent = catalogBranchLabel(branch);
        option.disabled = branch.state === 'unavailable';
        branchSelect.appendChild(option);
      }
      const normalized = String(meta.branchHint || '').toLowerCase();
      const detected = source.branches.find((branch) =>
        branch.id.toLowerCase() === normalized || branch.branch.toLowerCase() === normalized);
      const current = source.id === state.source?.id
        ? source.branches.find((branch) => branch.id === state.version?.id) : null;
      const selected = [detected, current, ...source.branches]
        .find((branch) => branch && branch.state !== 'unavailable');
      if (selected) branchSelect.value = selected.id;
      confirm.disabled = !selected;
    };
    sourceSelect.addEventListener('change', fillBranches);
    fillBranches();

    const finish = (value) => {
      modalCancelHandler = null;
      closeModal();
      resolve(value);
    };
    modalCancelHandler = () => resolve(null);
    cancel.addEventListener('click', () => finish(null));
    confirm.addEventListener('click', () => {
      const source = sources.find((item) => item.id === sourceSelect.value);
      const branch = source?.branches.find((item) => item.id === branchSelect.value);
      if (!source || !branch || branch.state === 'unavailable') return;
      finish({ source, branch });
    });
    sourceSelect.focus();
  });
}
function renderImportedCustomPicker() {
  ensureTargetSelectorControls(DEFAULT_TARGET_SELECTORS);
  const rows = [
    ['targetSource', state.source.id, state.source.label],
    ['targetBranch', state.version.id, state.version.branch],
    ['targetSystem', state.device.target.system, state.device.target.systemLabel],
    ['targetSubtarget', state.device.target.subtarget, state.device.target.subtargetLabel],
    ['targetProfile', state.variant.id, state.device.target.profileLabel],
  ];
  for (const [id, value, label] of rows) {
    const select = $(id);
    select.textContent = '';
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label || value;
    select.appendChild(option);
    select.disabled = true;
  }
}
async function selectImportedTarget(text, fileName, payload) {
  const meta = importedConfigMeta(text, fileName, payload);
  importLogStep('target-detected', meta);
  const selected = await chooseImportedSourceBranch(meta);
  if (!selected) return '';
  const { source, branch } = selected;
  importLogStep('branch-selected', { source: source.id, branch: branch.branch });
  await loadCatalog(source, branch, false);
  const target = MENU_CATALOG?.targets?.find((item) =>
    item.board === meta.system && item.subtarget === meta.subtarget);
  const profile = target?.profiles?.find((item) => item.id === meta.profileSymbol);
  if (target && profile) {
    importedTargetVerified = true;
    for (const select of targetControlElements()) select.disabled = false;
    renderCatalogPicker(false, {
      sourceId: source.id,
      branchId: branch.id,
      system: meta.system,
      subtarget: meta.subtarget,
      profileSymbol: meta.profileSymbol,
    });
    await applyCatalogTarget();
    return ['catalog-target', source.id, branch.id, profile.id].join('/');
  }
  importedTargetVerified = false;
  const sourceObject = catalogSourceObject(source, branch);
  const variant = {
    id: meta.profileSymbol || 'custom', profile: meta.profileSymbol || 'custom',
    name: meta.profileSymbol || 'Custom Target', capacity: 4096, versions: [branch.id],
  };
  sourceObject.variants = [variant];
  const custom = customDeviceFromConfig(text);
  custom.sources = [sourceObject];
  custom.target.profileSymbol = meta.profileSymbol;
  state.source = sourceObject;
  state.version = sourceObject.versions[0];
  state.variant = variant;
  state.device = custom;
  await switchDevice(custom, false);
  activateTargetRecord({ device: custom, source: sourceObject, version: sourceObject.versions[0], variant });
  renderImportedCustomPicker();
  return ['custom-target', source.id, branch.id, variant.id].join('/');
}
function customDeviceFromConfig(text) {
  const lines = targetLines(text);
  const valueOf = (name) => {
    const line = lines.find((item) => item.startsWith(`CONFIG_TARGET_${name}=`));
    return line ? line.slice(line.indexOf('=') + 1).replace(/^"|"$/g, '') : '';
  };
  const deviceLine = lines.find((line) => /^CONFIG_TARGET_.*_DEVICE_.*=y$/.test(line)) || '';
  const deviceParts = deviceLine.match(/^CONFIG_TARGET_([^_]+)_([^_]+)_DEVICE_(.+)=y$/);
  const board = valueOf('BOARD') || deviceParts?.[1] || '';
  const subtarget = valueOf('SUBTARGET') || deviceParts?.[2] || '';
  const profile = valueOf('PROFILE').replace(/^DEVICE_/, '') ||
    deviceParts?.[3] || '';
  if (!deviceLine && (!board || !subtarget)) throw new Error(t('import.noMatch'));
  const label = [board || 'Target', subtarget, profile].filter(Boolean).join(' / ');
  return {
    id: 'custom-target',
    brand: 'Custom Target',
    name: label,
    chip: board || 'custom',
    plugins: 'seed',
    note: 'Uploaded authoritative .config',
    enabled: true,
    kind: 'target',
    dir: 'platform/custom-target',
    target: {
      system: board || 'custom',
      systemLabel: board || 'Custom',
      subtarget: subtarget || 'custom',
      subtargetLabel: subtarget || 'Custom',
      profile: profile || 'custom',
      profileLabel: profile || 'Custom Target',
    },
    sources: [],
  };
}
function restoreSelections(config, payload) {
  state.sel.clear();
  state.removed.clear();
  catalogUserOverrides.clear();
  catalogImportedSymbols.clear();
  catalogDependencySymbols.clear();
  importedConfigValues.clear();
  importedUnknownOriginal.clear();
  importedUnknownEdits.clear();
  menuImportedOriginal.clear();
  menuImportedNonDefault.clear();
  menuTouched.clear();
  markCatalogStateChanged();
  for (const [symbol, value] of parseConfigValues(config)) importedConfigValues.set(symbol, value);
  const explicit = payload && Array.isArray(payload.plugins) ? payload.plugins : null;
  let skipped = 0;
  for (const p of PLUGINS.plugins) {
    const pkg = p.pkgs?.[state.source.id] || p.pkg;
    if (!pkg) {
      skipped++;
      importLogStep('plugin-skipped', { plugin: p.id, reason: 'missing package mapping' });
      continue;
    }
    const raw = explicit && explicit.find((id) =>
      typeof id === 'string' && id.replace(/^[+-]/, '') === p.id);
    if (raw) {
      if (raw.startsWith('-')) state.removed.add(p.id);
      else state.sel.add(p.id);
    }
  }
  if (menuSearchOptions.length) {
    for (const option of menuSearchOptions) {
      if (importedConfigValues.has(option.symbol)) {
        let value = importedConfigValues.get(option.symbol);
        if (option.type === 'string') {
          try { value = JSON.parse(value); } catch (e) { value = value.replace(/^"|"$/g, ''); }
        }
        menuValues.set(option.symbol, value);
        catalogImportedSymbols.add(option.symbol);
        menuImportedOriginal.set(option.symbol, value);
        let defaultValue = simpleKconfigDefault(option);
        if ((option.type === 'bool' || option.type === 'tristate') && !defaultValue) defaultValue = 'n';
        if (String(value) !== String(defaultValue)) menuImportedNonDefault.add(option.symbol);
      }
    }
  }
  if (explicit) {
    for (const p of PLUGINS.plugins) {
      const raw = explicit.find((id) => typeof id === 'string' && id.replace(/^[+-]/, '') === p.id);
      if (!raw) continue;
      const option = curatedMenuOption(p);
      if (!option) continue;
      const value = raw.startsWith('-') ? 'n' : (menuValues.get(option.symbol) ?? 'y');
      catalogUserOverrides.set(option.symbol, value);
      if (raw.startsWith('-')) catalogImportedSymbols.delete(option.symbol);
    }
  }
  for (const [symbol, value] of importedConfigValues) {
    if (!menuOptionBySymbol.has(symbol) && !isCatalogTargetSymbol(symbol) && !symbol.startsWith('TARGET_')) {
      importedUnknownOriginal.set(symbol, value);
    }
  }
  if (CATALOG_ENGINE && CATALOG_MODEL) {
    markCatalogStateChanged();
    const context = catalogValidationContext(menuValues, 'pre-defconfig');
    const repairs = CATALOG_ENGINE.proposeRepairs(
      CATALOG_MODEL, context.values, context.validationOptions,
    );
    for (const change of repairs.changes) {
      if (!menuOptionBySymbol.has(change.symbol)) continue;
      menuValues.set(change.symbol, change.to);
      menuTouched.add(change.symbol);
      catalogDependencySymbols.add(change.symbol);
      syncMenuToCurated(menuOptionBySymbol.get(change.symbol), change.to, 'dependency');
    }
    if (repairs.changes.length) {
      markCatalogStateChanged();
      importLogStep('catalog-dependencies-repaired', {
        changes: repairs.changes.map((change) => `${change.symbol}:${change.from}->${change.to}`),
      });
      showToast(uiText(
        `Catalog 已清理 ${repairs.changes.length} 个失效依赖项`,
        `Catalog 已清理 ${repairs.changes.length} 個失效相依項目`,
        `Catalog removed ${repairs.changes.length} invalid dependent setting(s)`));
    }
  }
  importLogStep('values-restored', {
    catalog: menuImportedOriginal.size,
    importedOnly: importedUnknownOriginal.size,
    selectedPlugins: state.sel.size,
    removedPlugins: state.removed.size,
    skippedPlugins: skipped,
  });
  if (payload) {
    if (payload.tag) $('tagBox').value = String(payload.tag).slice(0, 24);
    if (LANIP_RE.test(String(payload.lanip || ''))) $('lanipBox').value = state.lanip = payload.lanip;
    if (payload.rootpw === '@empty' || /^[A-Za-z0-9@#%^&*_+=.,:!?-]{4,32}$/.test(String(payload.rootpw || ''))) {
      $('rootpwBox').value = state.rootpw = payload.rootpw;
      state.rootpwAuto = false;
    }
    const fw = payload.firmware || {};
    const zone = TIMEZONES.zones.find((item) => item.zonename === fw.zonename) ||
      TIMEZONES.zones.find((item) => item.zonename === fw.timezone) ||
      TIMEZONES.zones.find((item) => item.timezone === fw.timezone);
    if (zone) state.timezone = zone.zonename;
    if (/^luci-theme-[A-Za-z0-9._+-]+$/.test(String(fw.theme || ''))) state.theme = fw.theme;
    if (NTP_PRESETS[fw.ntp]) state.ntp = fw.ntp;
    if (packageMirrorRoot(fw.opkg, state.source?.id)) {
      state.opkg = fw.opkg;
      opkgSelectionExplicit = true;
    }
  }
  renderFirmwareSettings();
  renderGroups();
  menuExpanded = true;
  resetMenuNavigation();
  menuSelectedExpanded = false;
  menuVisibleLimit = MENU_PAGE_SIZE;
  importedUnknownLimit = MENU_PAGE_SIZE;
  $('menuconfigSelectedOnly').checked = true;
  renderMenuconfig();
  renderImportedWorkspace();
  updateStats();
}
async function importConfigFile(file) {
  const seq = ++configImportSeq;
  importingConfig = true;
  configRuleChoices.clear();
  beginImportLog(file);
  try {
    if (!file || file.size < 32 || file.size > 2 * 1024 * 1024) throw new Error(t('import.size'));
    importLogStep('file-accepted');
    let text = await file.text();
    importLogStep('file-read');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    if (text.includes('\0')) throw new Error(t('import.binary'));
    let payload = null;
    if (/\.json$/i.test(file.name) || text.trimStart().startsWith('{')) {
      importLogStep('json-detected');
      try { payload = JSON.parse(text); } catch (e) { throw new Error(t('import.jsonInvalid', { msg: e.message })); }
      if (typeof payload.config !== 'string') throw new Error(t('import.jsonNoConfig'));
      text = payload.config;
    }
    text = text.replace(/\r\n/g, '\n');
    state.minimumBoot = false;
    state.useDefconfig = payload && typeof payload.use_defconfig === 'boolean'
      ? payload.use_defconfig : false;
    minimumBootOriginal.clear();
    minimumBootTouchedOriginal.clear();
    $('minimumBootToggle').checked = false;
    if ($('defconfigToggle')) $('defconfigToggle').checked = state.useDefconfig;
    const configId = await selectImportedTarget(text, file.name, payload);
    if (seq !== configImportSeq) return;
    if (!configId) {
      finishImportLog('cancelled');
      return;
    }
    state.importedConfig = text.endsWith('\n') ? text : text + '\n';
    state.importedConfigId = configId;
    importLogStep('profile-selected', { verified: importedTargetVerified, state: importStateSnapshot() });
    restoreSelections(state.importedConfig, payload);
    finishImportLog('success');
    showToast(t('import.ok', { id: configId }));
    updateSubmitGate();
  } finally {
    if (seq === configImportSeq) importingConfig = false;
  }
}
$('importBtn').addEventListener('click', () => $('configImport').click());
$('importLogBtn').addEventListener('click', downloadImportLog);
let reopenSubmitAfterImport = false;
$('configImport').addEventListener('change', async () => {
  const file = $('configImport').files[0];
  $('configImport').value = '';
  try {
    await importConfigFile(file);
    if (reopenSubmitAfterImport) openSubmitModal();
  } catch (e) {
    showImportError(e);
  } finally {
    reopenSubmitAfterImport = false;
  }
});

/* ============ 提交云编译 / Submit a cloud build ============ */
function targetRepo() {
  if (state.mode === 'self') {
    const owner = state.owner.replace(/[^A-Za-z0-9-]/g, '');
    return owner ? owner + '/' + REPO_NAME : null;
  }
  return OFFICIAL_REPO;
}

let lastFocus = null;
let modalCancelHandler = null;
const MOBILE_ISSUE_URL_LIMIT = 6000;
const mobileIssueClient = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
function issueSubmitUrl(repo, title, body = '') {
  const params = new URLSearchParams({ template: 'custom-build.yml', title });
  if (body) params.set('body', body);
  return 'https://github.com/' + repo + '/issues/new?' + params;
}
function submitReadiness() {
  const isCatalog = state.device?.id === 'catalog-target';
  const checks = [
    ['target', Boolean(state.device && state.source && state.version && state.variant)],
    ['catalog', !isCatalog || Boolean(MENU_CATALOG && catalogLoadMode === 'idle')],
    ['menuconfig', !isCatalog || Boolean(MENU_CATALOG && menuOptionBySymbol.size)],
    ['theme', Boolean($('fwThemeBox')?.options?.length && $('fwThemeBox')?.value)],
    ['recommended', !state.minimumBoot || Boolean(MINIMUM_BOOT && minimumBootRows().length)],
    ['defconfig', typeof state.useDefconfig === 'boolean'],
  ];
  return { ok: checks.every(([, ok]) => ok), missing: checks.filter(([, ok]) => !ok).map(([name]) => name) };
}
function updateSubmitGate() {
  const button = $('submitBtn');
  if (!button) return;
  const readiness = submitReadiness();
  button.disabled = !readiness.ok;
  button.setAttribute('aria-disabled', String(!readiness.ok));
  button.title = readiness.ok ? '' : uiText(
    `请等待构建参数就绪：${readiness.missing.join('、')}`,
    `請等待建置參數就緒：${readiness.missing.join('、')}`,
    `Waiting for build stages: ${readiness.missing.join(', ')}`);
}
async function mobileIssuePayload(payload) {
  if (!mobileIssueClient()) return '';
  if (!('CompressionStream' in window)) throw new Error('手机浏览器不支持压缩请求，请改用浏览器上传 JSON');
  const raw = JSON.stringify(payload);
  const zipped = new Uint8Array(await new Response(
    new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let binary = '';
  for (let i = 0; i < zipped.length; i += 0x4000) binary += String.fromCharCode(...zipped.subarray(i, i + 0x4000));
  const body = '<!-- WEIG_BUILD_REQUEST_GZIP_BASE64\n' + btoa(binary) + '\n-->';
  if (encodeURIComponent(body).length > MOBILE_ISSUE_URL_LIMIT) {
    throw new Error('手机请求过大，请用浏览器上传刚下载的 JSON 文件');
  }
  return body;
}
function openModal(title) {
  $('modalTitle').textContent = title;
  lastFocus = document.activeElement;
  $('modal').hidden = false;
  document.body.classList.add('modal-open');
  $('modalClose').focus();
}
function closeModal() {
  if ($('modal').hidden) return;
  const cancel = modalCancelHandler;
  modalCancelHandler = null;
  $('modal').hidden = true;
  $('modal').querySelector('.modal').classList.remove('modal-wide', 'modal-import-source', 'recommended-config', 'config-rule-resolver');
  document.body.classList.remove('modal-open');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
  if (cancel) cancel();
}
$('modalClose').addEventListener('click', closeModal);
$('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });
$('modal').addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const els = [...$('modal').querySelectorAll('button, a[href], input, textarea, select')].filter((el) => !el.disabled && el.offsetParent !== null);
  if (!els.length) return;
  const first = els[0], last = els[els.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

function localizedRuleText(row, key) {
  const text = row?.[key] || {};
  return uiText(text['zh-CN'] || text.en || '', text['zh-TW'] || text.en || '', text.en || '');
}
function openConfigRuleResolver(rules) {
  return new Promise((resolve, reject) => {
    openModal(uiText('处理配置规则', '處理設定規則', 'Resolve configuration rule'));
    const modal = $('modal').querySelector('.modal');
    modal.classList.remove('modal-wide', 'modal-import-source', 'recommended-config');
    modal.classList.add('config-rule-resolver');
    const body = $('modalBody');
    body.textContent = '';
    const intro = document.createElement('p');
    intro.className = 'import-error';
    intro.textContent = uiText('检测到需要确认的配置规则。请选择处理方式；不会修改原上传文件，只有继续下载或提交时才写入修正后的配置。',
      '偵測到需要確認的設定規則。請選擇處理方式；不會修改原上傳檔案，只有繼續下載或提交時才寫入修正後的設定。',
      'A configuration rule needs your choice. The uploaded file stays unchanged until the corrected configuration is downloaded or submitted.');
    body.appendChild(intro);
    const choices = new Map();
    const continueButton = document.createElement('button');
    continueButton.type = 'button';
    continueButton.className = 'btn btn-primary';
    continueButton.textContent = uiText('应用并继续', '套用並繼續', 'Apply and continue');
    continueButton.disabled = true;
    for (const rule of rules) {
      const card = document.createElement('section');
      card.className = 'config-rule';
      const title = document.createElement('h4');
      title.textContent = rule.id;
      card.appendChild(title);
      const message = document.createElement('p');
      message.textContent = localizedRuleText(rule, 'message');
      card.appendChild(message);
      const options = document.createElement('div');
      options.className = 'config-rule-options';
      for (const resolution of rule.resolutions || []) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'config-rule-option';
        const label = document.createElement('strong');
        label.textContent = localizedRuleText(resolution, 'label');
        const description = document.createElement('span');
        description.textContent = localizedRuleText(resolution, 'description');
        button.append(label, description);
        button.addEventListener('click', () => {
          choices.set(rule.id, resolution.id);
          for (const sibling of options.children) sibling.classList.remove('selected');
          button.classList.add('selected');
          continueButton.disabled = choices.size !== rules.length;
        });
        options.appendChild(button);
      }
      card.appendChild(options);
      body.appendChild(card);
    }
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    continueButton.addEventListener('click', () => {
      for (const [ruleId, resolutionId] of choices) configRuleChoices.set(ruleId, resolutionId);
      modalCancelHandler = null;
      closeModal();
      resolve();
    });
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn';
    cancel.textContent = uiText('暂不处理', '暫不處理', 'Cancel');
    cancel.addEventListener('click', closeModal);
    actions.append(continueButton, cancel);
    body.appendChild(actions);
    modalCancelHandler = () => reject(new Error(uiText('已取消处理配置规则', '已取消處理設定規則', 'Configuration rule resolution cancelled')));
  });
}
function openBuildRequirementResolver(requirements) {
  return new Promise((resolve, reject) => {
    openModal(uiText('应用构建必需项', '套用建置必要項目', 'Apply required build options'));
    const modal = $('modal').querySelector('.modal');
    modal.classList.remove('modal-wide', 'modal-import-source', 'recommended-config');
    modal.classList.add('config-rule-resolver');
    const body = $('modalBody');
    body.textContent = '';
    const intro = document.createElement('p');
    intro.className = 'import-error';
    intro.textContent = uiText(
      '当前源码要求以下配置项。只有明确应用后才能下载构建请求 JSON；Actions 不会替你静默修改，只有勾选 Defconfig 时才会运行一次 make defconfig。',
      '目前原始碼要求以下設定項目。只有明確套用後才能下載建置請求 JSON；Actions 不會替你靜默修改，只有勾選 Defconfig 時才會執行一次 make defconfig。',
      'The selected source requires these options. Apply them explicitly before downloading the build-request JSON. Actions never changes them silently and runs make defconfig once only when Defconfig is selected.');
    body.appendChild(intro);
    for (const requirement of requirements) {
      const card = document.createElement('section');
      card.className = 'config-rule';
      const title = document.createElement('h4');
      title.textContent = localizedRuleText(requirement, 'title') || requirement.id;
      const description = document.createElement('p');
      description.textContent = localizedRuleText(requirement, 'description');
      const options = document.createElement('div');
      options.className = 'config-rule-options';
      for (const option of requirement.missingOptions || []) {
        const row = document.createElement('div');
        row.className = 'config-rule-option selected';
        const label = document.createElement('strong');
        label.textContent = `CONFIG_${option.symbol}=${option.value}`;
        const detail = document.createElement('span');
        detail.textContent = localizedRuleText(option, 'label');
        row.append(label, detail);
        options.appendChild(row);
      }
      card.append(title, description, options);
      body.appendChild(card);
    }
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'btn btn-primary';
    apply.textContent = uiText('应用必需项并继续', '套用必要項目並繼續', 'Apply required options and continue');
    apply.addEventListener('click', () => {
      for (const requirement of requirements) acceptedBuildRequirements.add(requirement.id);
      modalCancelHandler = null;
      closeModal();
      resolve();
    });
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn';
    cancel.textContent = uiText('取消，不下载 JSON', '取消，不下載 JSON', 'Cancel without downloading JSON');
    cancel.addEventListener('click', closeModal);
    actions.append(apply, cancel);
    body.appendChild(actions);
    modalCancelHandler = () => reject(new Error(uiText(
      '未应用构建必需项，已取消下载 JSON。', '未套用建置必要項目，已取消下載 JSON。',
      'Required build options were not applied; JSON download was cancelled.')));
  });
}
async function generateResolvedConfigText(options = {}) {
  while (true) {
    try {
      return await generateConfigText(options);
    } catch (error) {
      if (error instanceof ConfigRuleResolutionRequired) await openConfigRuleResolver(error.rules);
      else if (error instanceof BuildRequirementResolutionRequired) {
        await openBuildRequirementResolver(error.requirements);
      } else throw error;
    }
  }
}

function openSubmitModal() {
  const readiness = submitReadiness();
  if (!readiness.ok) {
    updateSubmitGate();
    showToast(uiText(
      `尚未就绪：${readiness.missing.join('、')}`,
      `尚未就緒：${readiness.missing.join('、')}`,
      `Not ready: ${readiness.missing.join(', ')}`));
    return;
  }
  const repo = targetRepo();
  if (!repo) { alert(t('owner.required')); $('ownerBox').focus(); return; }
  const sel = effectiveSelection();
  const tag = ($('tagBox').value.trim() || t('tag.anonymous')).slice(0, 24);
  const plugins = sel.normal.map((p) => p.id)
    .concat(sel.forced.map((p) => '+' + p.id))
    .concat(sel.removed.map((p) => '-' + p.id));
  const firmware = {
    timezone: state.timezone,
    theme: $('fwThemeBox').value,
    ntp: $('ntpBox').value,
    opkg: $('opkgBox').value,
  };
  Object.assign(state, firmware);
  const requestStamp = localStamp();
  const titleTag = safeDownloadNamePart(tag, 'anonymous');
  const title = '[build] ' + requestStamp + '/' + titleTag + '/' + requestTargetProfilePart() + '/' + state.source.id + '/' + state.version.id + '/' + selectedTargetProfileName();

  openModal(t('btn.submit'));
  const mb = $('modalBody');
  mb.textContent = '';
  const sum = document.createElement('div');
  sum.className = 'summary-box';
  sum.textContent = t('submit.confirm', {
    brand: state.device.brand, device: state.device.name, source: state.source.label,
    version: state.version.label, variant: state.variant.name, n: plugins.length, tag,
    timezone: $('timezoneBox').value,
    theme: $('fwThemeBox').selectedOptions[0].textContent,
    ntp: $('ntpBox').selectedOptions[0].textContent,
    opkg: $('opkgBox').selectedOptions[0].textContent,
    pageVersion: state.siteVersion,
  });
  mb.appendChild(sum);
  if (state.importedConfig && !importedTargetVerified) {
    const warning = document.createElement('p');
    warning.className = 'import-error';
    warning.textContent = '⚠ Custom Target 未经当前 Catalog 验证；Actions 将按上传配置直接构建，是否可用由所选源码决定。';
    mb.appendChild(warning);
  }

  const card = (titleKey, descText, btnKey, onClick) => {
    const c = document.createElement('div');
    c.className = 'method-card';
    const h = document.createElement('h4');
    h.textContent = t(titleKey);
    c.appendChild(h);
    const p = document.createElement('p');
    p.textContent = descText;
    c.appendChild(p);
    const button = document.createElement('button');
    button.className = 'btn btn-primary';
    button.type = 'button';
    button.textContent = t(btnKey);
    button.addEventListener('click', onClick);
    c.appendChild(button);
    mb.appendChild(c);
  };
  card('submit.m1.title', state.mode === 'self' ? t('submit.m1.descSelf') : t('submit.m1.desc'),
    'submit.m1.btn', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const config = await generateResolvedConfigText({ enforceBuildRequirements: true });
        const payload = {
          schema: 5,
          generatedAt: new Date().toISOString(),
          pageVersion: state.siteVersion,
          configId: [state.device.id, state.source.id, state.version.id, state.variant.id].join('/'),
          device: state.device.id, source: state.source.id, version: state.version.id,
          branch: state.version.branch,
          variant: state.variant.id, plugins, tag, lanip: state.lanip, config,
          use_defconfig: state.useDefconfig === true,
          audit: minimumBootAudit(),
          firmware: configFirmwareSettings(config),
          catalog: currentCatalogContract(),
        };
        if (['custom-target', 'catalog-target'].includes(state.device.id)) payload.customTarget = state.device.target;
        if (state.rootpw) payload.rootpw = state.rootpw;
        const filename = [requestStamp, requestTargetProfilePart(true), safeDownloadNamePart(state.source.id, 'source'),
          safeDownloadNamePart(state.version.id, 'branch'), safeDownloadNamePart(selectedTargetProfileName())].join('-') + '.json';
        downloadBlob(JSON.stringify(payload, null, 2) + '\n', 'application/json;charset=utf-8', filename);
        const issueUrl = issueSubmitUrl(repo, title, await mobileIssuePayload(payload));
        const issueWindow = window.open(issueUrl, '_blank');
        if (issueWindow) issueWindow.opener = null;
        else window.location.assign(issueUrl);
      } catch (err) {
        alert(t('btn.download.fail', { msg: err.message }));
      } finally {
        button.disabled = false;
      }
    });

  card('submit.existing.title', t('submit.existing.desc'), 'btn.import', () => {
    reopenSubmitAfterImport = true;
    closeModal();
    $('configImport').click();
  });

  card('submit.download.title', t('submit.download.desc'), 'btn.download', (event) => {
    downloadConfig(event.currentTarget);
  });

  const p3 = document.createElement('p');
  p3.textContent = t('submit.footer', { tag });
  mb.appendChild(p3);
}
$('submitBtn').addEventListener('click', openSubmitModal);

/* ============ 一键自检 / One-click self test ============ */
async function timedFetch(url, timeout) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout || 8000);
  const start = performance.now();
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    const ms = Math.round(performance.now() - start);
    if (!r.ok) return { ok: false, ms, msg: 'HTTP ' + r.status };
    const text = await r.text();
    return { ok: true, ms: Math.round(performance.now() - start), size: text.length, text };
  } catch (e) {
    return { ok: false, ms: Math.round(performance.now() - start), msg: e.name === 'AbortError' ? t('st.timeout') : t('st.connFail') };
  } finally { clearTimeout(timer); }
}
const TIER_NAMES = ['local', 'jsDelivr', 'raw.github'];

async function runSelfTest() {
  openModal(t('st.title'));
  const mb = $('modalBody');
  mb.textContent = '';
  const intro = document.createElement('p');
  intro.className = 'hint';
  intro.textContent = t('st.intro');
  mb.appendChild(intro);

  function addRow(name) {
    const row = document.createElement('div');
    row.className = 'st-row';
    const ic = document.createElement('span');
    ic.className = 'st-ic';
    ic.textContent = '⏳';
    const box = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = name;
    const msg = document.createElement('span');
    msg.className = 'st-msg';
    msg.textContent = t('st.checking');
    box.appendChild(b); box.appendChild(msg);
    row.appendChild(ic); row.appendChild(box);
    mb.appendChild(row);
    return (status, text) => {
      ic.textContent = status === 'ok' ? '✓' : status === 'warn' ? '⚠' : '✗';
      row.className = 'st-row st-' + status;
      msg.textContent = text;
    };
  }

  const d1 = addRow(t('st.browser'));
  const missing = ['fetch', 'URL', 'Blob', 'AbortController', 'localStorage'].filter((k) => !(k in window));
  d1(missing.length ? 'fail' : 'ok', missing.length ? t('st.browser.fail', { list: missing.join('、') }) : t('st.browser.ok'));

  const d2 = addRow(t('st.data'));
  const path2 = 'seed/plugins.json';
  const tiers = [];
  for (const [i, u] of dataUrls(path2).entries()) {
    const r = await timedFetch(u, 6000);
    tiers.push(TIER_NAMES[i] + (r.ok ? ' ✓ ' + r.ms + 'ms' : ' ✗ ' + r.msg));
    if (i === 0 && r.ok) { tiers.push(t('st.data.localHit')); break; }
  }
  const anyOk = tiers.some((x) => x.includes('✓'));
  const localOk = tiers[0].includes('✓');
  d2(anyOk ? (localOk ? 'ok' : 'warn') : 'fail',
    tiers.join(' · ') + (anyOk ? (localOk ? '' : t('st.data.cdnFallback')) : t('st.data.allFail')));

  const src = state.source;
  const d3 = addRow(t('st.config') + (src ? ' (' + src.label + ')' : ''));
  let cfgText = null, tierHit = '';
  if (!src) d3('fail', t('st.config.noData'));
  else if (state.device?.id === 'catalog-target') {
    try {
      if (!MENU_CATALOG) throw new Error('Catalog has not finished loading');
      cfgText = catalogTargetConfig();
      tierHit = `${state.source.id}/${state.version.branch} · ${MENU_CATALOG.source?.commit?.slice(0, 8) || 'Catalog'}`;
      d3('ok', t('st.config.ok', { tier: tierHit }));
    } catch (error) {
      d3('fail', `${t('st.config.fail')} · ${error.message}`);
    }
  }
  else if (state.device?.id === 'custom-target' && state.importedConfig) {
    cfgText = state.importedConfig;
    tierHit = uiText('已上传权威配置', '已上傳權威設定', 'Uploaded authoritative config');
    d3('ok', t('st.config.ok', { tier: tierHit }));
  } else {
    d3('fail', t('st.config.noData'));
  }

  const d4 = addRow(t('st.gen'));
  if (!src || !cfgText || !PLUGINS) d4('fail', t('st.gen.skip'));
  else {
    try {
      const text = await generateResolvedConfigText();
      const headerOk = text.includes(`# page-version=${state.siteVersion}`) &&
        text.includes(`# device=${state.device.id} source=${state.source.id} version=${state.version.id}`);
      const targets = targetLines(text);
      const configLines = text.split('\n').filter((line) =>
        /^CONFIG_[A-Za-z0-9_.+@-]+=/.test(line) || /^# CONFIG_[A-Za-z0-9_.+@-]+ is not set$/.test(line));
      const okAll = headerOk && targets.length > 0 && configLines.length > 0;
      d4(okAll ? 'ok' : 'fail', okAll
        ? uiText(`真实生成成功 · ${configLines.length} 配置项 · ${targets.length} 目标签名`,
          `真實產生成功 · ${configLines.length} 設定項 · ${targets.length} 目標簽章`,
          `Real generation passed · ${configLines.length} settings · ${targets.length} target signatures`)
        : `${t('st.gen.fail')} · header=${headerOk} target=${targets.length} config=${configLines.length}`);
    } catch (error) {
      d4('fail', `${t('st.gen.fail')} · ${error.message}`);
    }
  }

  const d5 = addRow(t('st.github'));
  const gh = await timedFetch('https://api.github.com/', 6000);
  d5(gh.ok ? 'ok' : 'warn', gh.ok ? t('st.github.ok', { ms: gh.ms }) : t('st.github.fail', { msg: gh.msg }));
}
$('selfTestBtn').addEventListener('click', () => { runSelfTest().catch((e) => showToast(t('toast.selfTestError', { msg: e.message }))); });

/* ============ V11:Aa 字号面板(整页缩放),替代旧密度切换 / V11: Aa font-size panel (whole-page zoom), replaces the old density toggle ============ */
const FONT_DEF = 17, FONT_MIN = 14, FONT_MAX = 24;
let fontPx = parseInt(localStorage.getItem('wrt_font'), 10);
if (!fontPx && localStorage.getItem('wrt_density') === '1') { fontPx = 16; safeSet('wrt_font', '16'); }   // 旧紧凑档用户迁移为 16px / legacy compact-density users migrate to 16px
try { localStorage.removeItem('wrt_density'); } catch (e) { /* 隐私模式可能抛错,忽略 / may throw in private mode; ignore */ }
if (!(fontPx >= FONT_MIN && fontPx <= FONT_MAX)) fontPx = FONT_DEF;
function applyFont(px, save) {
  fontPx = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(Number(px)) || FONT_DEF));
  document.body.style.zoom = fontPx === FONT_DEF ? '' : String(fontPx / FONT_DEF);   // 17px = 原始大小 / 17px = original size
  $('fontInput').value = fontPx;
  if (save) safeSet('wrt_font', String(fontPx));
  fitPluginNames();   // 缩放改变有效布局宽度,重测名称适配 / zoom changes the effective layout width; re-fit names
}
function toggleFontPanel(show) {
  const open = show !== undefined ? show : $('fontPanel').hidden;
  if (!open && $('fontPanel').contains(document.activeElement)) $('densityBtn').focus();   // 关闭时焦点还给 Aa / hand focus back to Aa on close
  $('fontPanel').hidden = !open;
  $('densityBtn').setAttribute('aria-expanded', String(open));
  if (open) $('fontDec').focus();
}
$('densityBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleFontPanel(); });
$('fontDec').addEventListener('click', () => applyFont(fontPx - 1, true));
$('fontInc').addEventListener('click', () => applyFont(fontPx + 1, true));
$('fontReset').addEventListener('click', () => applyFont(FONT_DEF, true));
$('fontInput').addEventListener('change', () => applyFont($('fontInput').value, true));
document.addEventListener('click', (e) => {
  if (!$('fontPanel').hidden && !$('fontPanel').contains(e.target)) toggleFontPanel(false);   // 点外部关闭 / close on outside click
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleFontPanel(false); });
applyFont(fontPx, false);

/* ============ 使用说明弹窗:序号徽章 + 引号关键词高亮 / Help modal: numbered badges + quoted-keyword highlights ============ */
$('helpBtn').addEventListener('click', () => {
  openModal(t('help.title'));
  $('modal').querySelector('.modal').classList.add('modal-wide', 'recommended-config');
  const mb = $('modalBody');
  mb.textContent = '';
  for (const line of t('help.body').split('\n')) {
    const m = line.match(/^([①②③④⑤⑥⑦⑧⑨⑩]|\d+\.)\s*(.*)$/);
    const row = document.createElement('div');
    row.className = 'help-item';
    const num = document.createElement('span');
    num.className = 'help-num';
    num.textContent = m ? m[1].replace('.', '') : '·';
    row.appendChild(num);
    const body = document.createElement('span');
    body.className = 'help-text';
    // 中英引号里的词高亮为主题蓝 / words inside quotes get accent-colored
    const text = m ? m[2] : line;
    let last = 0;
    for (const q of text.matchAll(/"([^"]+)"|'([^']+)'|“([^”]+)”/g)) {
      body.appendChild(document.createTextNode(text.slice(last, q.index)));
      const em = document.createElement('em');
      em.textContent = q[1] || q[2] || q[3];
      body.appendChild(em);
      last = q.index + q[0].length;
    }
    body.appendChild(document.createTextNode(text.slice(last)));
    row.appendChild(body);
    mb.appendChild(row);
  }
  const links = document.createElement('div');
  links.className = 'help-links';
  const addHelpLink = (href, label) => {
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = label;
    links.appendChild(link);
  };
  addHelpLink('https://openwrt.org/toh/qihoo/360t7_1.0', t('help.link.ubi'));
  addHelpLink('https://github.com/ATang007ZH/bl-mt798x/wiki/%E5%A4%9A%E5%88%86%E5%8C%BAuboot%E5%88%B6%E4%BD%9C%E6%96%B9%E6%B3%95', t('help.link.layout'));
  mb.appendChild(links);
});

/* ============ 悬浮坞收起/展开(记忆状态;手机首次默认只留 ⚙) / dock collapse toggle (persisted; first mobile visit starts as gear only) ============ */
const savedDock = localStorage.getItem('wrt_dock');
if (savedDock === '1' || (savedDock === null && matchMedia('(max-width: 560px)').matches)) {
  $('sideDock').classList.add('collapsed');
}
$('dockToggle').setAttribute('aria-expanded', String(!$('sideDock').classList.contains('collapsed')));
$('dockToggle').addEventListener('click', () => {
  const collapsed = $('sideDock').classList.toggle('collapsed');
  $('dockToggle').setAttribute('aria-expanded', String(!collapsed));
  safeSet('wrt_dock', collapsed ? '1' : '0');
});

/* ============ 风险横幅 / Risk banner ============ */
$('riskOk').addEventListener('click', () => { $('riskBar').hidden = true; safeSet('wrt_risk', 'ok'); });

/* ============ 主题三态 / Tri-state theme ============ */
let themeMode = localStorage.getItem('wrt_theme') || 'auto';
const THEME_ICON = { auto: '◐', light: '☀', dark: '☾' };
function applyThemeIcon() {
  $('themeBtn').textContent = THEME_ICON[themeMode];
  $('themeBtn').title = t('theme.' + themeMode);
  $('themeBtn').setAttribute('aria-label', t('theme.' + themeMode));
}
function applyTheme(mode) {
  themeMode = (mode === 'light' || mode === 'dark') ? mode : 'auto';
  if (themeMode === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = themeMode;
  applyThemeIcon();
  if (themeMode === 'auto') { try { localStorage.removeItem('wrt_theme'); } catch (e) { /* 隐私模式下 localStorage 可能抛错,忽略 / localStorage may throw in private mode; ignore */ } }
  else safeSet('wrt_theme', themeMode);
}
$('themeBtn').addEventListener('click', () => {
  applyTheme(themeMode === 'auto' ? 'light' : themeMode === 'light' ? 'dark' : 'auto');
});
applyTheme(themeMode);

init();
updateSubmitGate();
