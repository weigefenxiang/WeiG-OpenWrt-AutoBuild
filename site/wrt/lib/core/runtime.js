/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * OpenWrt 固件在线定制器前端脚本,由 site/wrt/index.html 直接加载 / Front-end script of the online firmware customizer, loaded directly by site/wrt/index.html.
 * Catalog/插件/文案数据来自 data/ 下的 JSON,带多级 CDN 回退与 localStorage 缓存 / Catalog/plugin/i18n data comes from JSON under data/, with tiered CDN fallback and localStorage caching.
 * 无构建步骤、无第三方依赖,以原生 ES 语法直接在浏览器运行 / No build step, no third-party deps; runs as plain native ES in the browser.
 */
'use strict';

/* ============ 常量 / Constants ============ */
const RELEASE_BOOTSTRAP = globalThis.__WEIG_RELEASE__ || null;
const SITE_RELEASE_SHA = String(RELEASE_BOOTSTRAP?.siteSha256 || '');
if (!/^[a-f0-9]{64}$/.test(SITE_RELEASE_SHA) || typeof globalThis.__WEIG_RELEASE_URL__ !== 'function') {
  throw new Error('Missing validated site release bootstrap / 缺少已验证的站点发布身份');
}
const releaseAssetUrl = (path) => globalThis.__WEIG_RELEASE_URL__(path);
const UI_RUNTIME = globalThis.__WEIG_UI_RUNTIME__;
if (!UI_RUNTIME?.session?.createUiSessionState || !UI_RUNTIME?.components?.createUiCheckboxControl ||
    !UI_RUNTIME?.pageShell?.installPageShellUi) {
  throw new Error('Missing standardized UI runtime modules / 缺少标准 UI 运行模块');
}
const UI_SESSION = UI_RUNTIME.session.createUiSessionState();
const UI_COMPONENTS = UI_RUNTIME.components;
const PAGE_SHELL_UI = UI_RUNTIME.pageShell;
let PAGE_SHELL_CONTROLLER = null;
function releaseScopedUrl(url) {
  const resolved = new URL(url, document.baseURI);
  resolved.searchParams.set('r', SITE_RELEASE_SHA);
  return resolved.href;
}
function pruneOldReleaseDataCaches() {
  const keepPrefix = `wrt_cache:${SITE_RELEASE_SHA}:`;
  try {
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (key?.startsWith('wrt_cache:') && !key.startsWith(keepPrefix)) localStorage.removeItem(key);
    }
  } catch (e) { /* localStorage may be unavailable in privacy modes */ }
}
pruneOldReleaseDataCaches();

let OFFICIAL_REPO = 'weigefenxiang/WeiG-OpenWrt-AutoBuild';
let REPO_NAME = OFFICIAL_REPO.split('/')[1];
let PROJECT = null;
const FALLBACK = 'en';               // 译文缺失时的兜底语言 / Fallback language when a translation is missing
const SOURCE_LANG = 'en';            // 权威源语言,词条必须完整 / Canonical source language; its entries must be complete
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
  useDefconfig: false,
  ntp: 'cn',
  packageMirror: 'source-default',
  siteVersion: 'v----------',
  siteConfigReady: false,
  buildMeta: null,
  catalogBindings: Object.freeze({}),
  importedConfig: null,
  importedConfigId: '',
};
const LANIP_RE = /^(192\.168|10\.\d{1,3}|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}$/;   // 仅接受内网 IPv4 / private IPv4 only
let PLUGINS = { groups: [], plugins: [] }, I18N = null, TIMEZONES = null;
let PACKAGE_MIRRORS = { schema: 2, presets: [{ id: 'source-default', label: { 'zh-CN': '跟随源码默认', en: 'Follow source default' }, sources: [] }] };
let MENU_INDEX = null, MENU_CATALOG = null, CATALOG_ENGINE = null, CATALOG_MODEL = null;
let CATALOG_LOADER_MODULE = null, CATALOG_SCHEMA6_MODULE = null, BUILD_IDENTITY_MODULE = null, CATALOG_LOADER = null;
let PROFILE_BASELINE_MODULE = null, PROFILE_BASELINE_STORE = null, ACTIVE_PROFILE_BASELINE = null;
let profileBaselineKey = '', catalogProfileBaselineLoadingPromise = null;
let MENU_CATALOG_DATA_REF = 'catalog-data';
let MENU_CATALOG_BINDING = null;
let catalogShardLoader = null, catalogMenuLoadingPromise = null;
let catalogHiddenLoadingPromise = null, catalogHelpLoadingPromise = null, packageMirrorsPromise = null;
let menuCatalogKey = '', menuLoadingKey = '', menuCatalogSeq = 0, menuCatalogPromise = null;
let menuCatalogAbortController = null, menuIndexAbortController = null;
let menuIndexProvider = '', menuAssetProvider = '';
let catalogLoadMode = 'idle', catalogLoadError = '', catalogLoadDiagnostics = [];
let catalogAutoloadReady = false;
let menuPath = null, menuParent = '', menuExpanded = false, menuSelectedExpanded = false;
let menuExpansionRequest = 0;
let buildContractExpanded = false;
let menuVisibleLimit = 80, menuHistory = [], menuBreadcrumb = [];
const menuValues = new Map();
// menuTouched is the full explicit output layer (user, recommended, imported repairs,
// and dependency closure). User intent is tracked separately so upstream defaults never
// inflate the curated-plugin counter.
const menuTouched = new Set();
const catalogBaselineValues = new Map();
const catalogBaselineOrigins = new Map();
const catalogRecommendedValues = new Map();
const catalogDependencySymbols = new Set();
const catalogConditionalDefaultSymbols = new Set();
const catalogImportedSymbols = new Set();
const catalogUserOverrides = new Map();
const profilePackageOverrides = new Map();
let profilePackageModalOpen = false;
let menuOriginFilter = 'all';
let menuUserSettableOnly = false;
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
const ROOTFS_PARTSIZE_SYMBOL = 'TARGET_ROOTFS_PARTSIZE';
let catalogSearchWorker = null, catalogSearchGeneration = 0, catalogSearchRequestId = 0;
let catalogSearchWorkerReady = false, catalogSearchPending = new Set(), catalogSearchResults = new Map();
let catalogSearchRequests = new Map();
let catalogLocatorEntryCache = null;
let catalogStateRevision = 0, catalogContextCache = new Map(), catalogContextCacheBypass = false;
let compatibilityPrefetchTimer = null;
let catalogApplicationsPromise = null, catalogApplicationsDocument = null;
let catalogPackageSizesPromise = null, catalogPackageSizesPromiseKey = '';
let catalogPackageSizesKey = '', catalogPackageSizesDocument = null;
let catalogApplicationsLoadState = 'loading', catalogApplicationsError = '';
let selfTestViewToken = 0;
let catalogStartupPromise = null, catalogApplicationsDemanded = false, catalogApplicationsObserver = null;
let menuVisibilityRevision = -1, menuVisibilityCache = new Map(), menuSelectableStatesCache = new Map();
let menuStateConstraintsCache = new Map();
let MENU_CATALOG_REPO = 'weigefenxiang/WeiG-OpenWrt-Menuconfig-Catalog';
const MENU_PAGE_SIZE = 80;
const MENU_SEARCH_PAGE_SIZE = 60;
const LANG_SHORT = {
  'zh-CN': '简', 'zh-TW': '繁', en: 'EN', ru: 'RU', es: 'ES', pt: 'PT',
  ja: '日', ko: '한', de: 'DE', fr: 'FR', vi: 'VI',
};

const menuUi = (key) => t('menu.ui.' + key);

const menuFilterText = (key) => t('menu.filter.' + key);
const MENU_ORIGIN_FILTER_VALUES = ['all', 'user', 'excluded', 'default', 'recommended', 'dependency', 'imported'];

const DEFAULT_TARGET_SELECTORS = [
  { id: 'system', labelEn: 'Target System', labelZh: '目标系统' },
  { id: 'subtarget', labelEn: 'Subtarget', labelZh: '子目标' },
  { id: 'profile', labelEn: 'Target Profile', labelZh: '目标配置' },
];
let targetSelectorValues = {};
let catalogTargetMismatch = false;
const NTP_PRESETS = {
  cn: ['ntp.aliyun.com', 'time1.cloud.tencent.com', 'cn.ntp.org.cn', 'cn.pool.ntp.org'],
  global: ['0.openwrt.pool.ntp.org', '1.openwrt.pool.ntp.org', '2.openwrt.pool.ntp.org', '3.openwrt.pool.ntp.org'],
  cloudflare: ['time.cloudflare.com', 'time.google.com', 'time.apple.com', 'pool.ntp.org'],
};
let packageMirrorSelectionExplicit = false;
function mirrorPreset(id) {
  const normalized = PACKAGE_MIRRORS?.aliases?.[id] || id;
  return (PACKAGE_MIRRORS?.presets || []).find((preset) => preset.id === normalized) || null;
}
function packageMirrorAvailable(id, sourceId = state.source?.id) {
  const preset = mirrorPreset(id);
  return Boolean(preset && (!sourceId || (preset.sources || []).includes(sourceId)));
}
function packageMirrorEntries(sourceId = state.source?.id) {
  return (PACKAGE_MIRRORS?.presets || [])
    .filter((preset) => packageMirrorAvailable(preset.id, sourceId))
    .map((preset) => [preset.id, preset.label?.[state.lang === 'zh-CN' ? 'zh-CN' : 'en'] || preset.label?.en || preset.id]);
}
function defaultPackageMirrorId(sourceId = state.source?.id) {
  const availableIds = packageMirrorEntries(sourceId).map(([id]) => id);
  if (CATALOG_ENGINE?.resolvePackageMirrorSelection) {
    return CATALOG_ENGINE.resolvePackageMirrorSelection({
      timezone: state.timezone,
      availableIds,
      currentId: state.packageMirror,
    });
  }
  const preferred = state.timezone === 'Asia/Shanghai' ? 'auto' : 'source-default';
  return availableIds.includes(preferred) ? preferred
    : (availableIds.includes('source-default') ? 'source-default' : availableIds[0] || 'source-default');
}
let devAllowGrey = false;              // V10:灰色插件二级门禁,不落盘,每次都从未勾开始 / V10: second gate for grey plugins; never persisted, always starts unticked
const collapsed = new Set();

const $ = (id) => document.getElementById(id);
const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* 存储满或被禁用时静默忽略 / Silently ignore when storage is full or disabled */ } };
