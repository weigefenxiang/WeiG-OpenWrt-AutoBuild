/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Package Probe V3 UI adapter. Loaded after app.js as a classic script so it
 * reuses the existing global Kconfig/Catalog runtime instead of creating a
 * second dependency engine or package database.
 */
'use strict';

const PROBE_V3_UI_TEXT = Object.freeze({
  title: ['插件兼容探针', '套件相容性探針', 'Package Compatibility Probe'],
  intro: ['选择本次要验证的软件包，并在当前 Catalog 的真实 Source / Branch / Target 环境中进行兼容性探测。', '選擇本次要驗證的套件，並在目前 Catalog 的真實 Source / Branch / Target 環境中進行相容性探測。', 'Choose the packages to validate and probe them across real Source / Branch / Target environments from the current Catalog.'],
  howTo: ['Probe 与 Advanced menuconfig 共用同一份 Kconfig 状态；用户直接选择与 Kconfig 自动联动分开记录，但依赖关系仍只由 Catalog Kconfig 计算。进入上游源码后，实际依赖构建顺序交给上游 Make。', 'Probe 與 Advanced menuconfig 共用同一份 Kconfig 狀態；使用者直接選擇與 Kconfig 自動聯動分開記錄，但相依關係仍只由 Catalog Kconfig 計算。進入上游原始碼後，實際相依建置順序交給上游 Make。', 'Probe shares one Kconfig state with Advanced menuconfig. Direct user intent is recorded separately from automatic Kconfig changes, while dependency truth remains in Catalog Kconfig. Once inside upstream source, build ordering belongs to upstream Make.'],
  search: ['搜索软件包 / Kconfig ID', '搜尋套件 / Kconfig ID', 'Search package / Kconfig IDs'],
  baseline: ['基线', '基線', 'Baseline'],
  selected: ['用户选择', '使用者選擇', 'User selection'],
  linkage: ['自动联动', '自動聯動', 'Automatic linkage'],
  linkageDetail: ['查看自动依赖 / 联动', '查看自動相依 / 聯動', 'View automatic dependencies / linkage'],
  finalState: ['最终', '最終', 'Final'],
  depth: ['探测深度', '探測深度', 'Probe depth'],
  defconfig: ['Defconfig', 'Defconfig', 'Defconfig'],
  defconfigHelp: ['使用当前 Source 自己的 make defconfig 对提交状态进行上游 Kconfig 规范化；默认开启，可关闭。', '使用目前 Source 自己的 make defconfig 對提交狀態進行上游 Kconfig 規範化；預設開啟，可關閉。', 'Run the selected Source\'s own make defconfig to normalize the submitted state with upstream Kconfig. Enabled by default and optional.'],
  environment: ['测试环境范围', '測試環境範圍', 'Test environment scope'],
  source: ['Source', 'Source', 'Source'],
  branch: ['Branch', 'Branch', 'Branch'],
  targetSystem: ['Target System', 'Target System', 'Target System'],
  subtarget: ['Subtarget', 'Subtarget', 'Subtarget'],
  targetProfile: ['Target Profile', 'Target Profile', 'Target Profile'],
  all: ['全部', '全部', 'All'],
  searchDimension: ['搜索', '搜尋', 'Search'],
  currentEnvironment: ['当前环境', '目前環境', 'Current environment'],
  crossSourceTarget: ['当前 Target · 跨 Source / Branch', '目前 Target · 跨 Source / Branch', 'Current target · across Source / Branch'],
  clearFilters: ['清空筛选', '清空篩選', 'Clear filters'],
  coverageMode: ['执行方式', '執行方式', 'Coverage mode'],
  autoCoverage: ['Auto 尽可能覆盖', 'Auto 儘可能覆蓋', 'Auto maximize coverage'],
  exhaustiveCoverage: ['全部遍历', '全部遍歷', 'Exhaustive'],
  autoLimit: ['最多', '最多', 'At most'],
  environments: ['个环境', '個環境', 'environments'],
  currentMatches: ['当前匹配', '目前匹配', 'Current matches'],
  scopeDetail: ['当前范围与匹配详情', '目前範圍與匹配詳情', 'Scope and matches'],
  coveragePreview: ['Auto 覆盖预估', 'Auto 覆蓋預估', 'Auto coverage estimate'],
  executionPreview: ['执行预览', '執行預覽', 'Execution preview'],
  packageCompile: ['软件包编译', '套件編譯', 'Package compile'],
  packageCompileShort: ['软件包', '套件', 'Package'],
  packageCompileHelp: ['L1：以用户直接选择的软件包为 Root，解析上游 package metadata 后，以一次 Make 调用进入上游依赖图；不自行逐包调度依赖。', 'L1：以使用者直接選擇的套件為 Root，解析上游 package metadata 後，以一次 Make 呼叫進入上游相依圖；不自行逐套件調度相依。', 'L1: Treat directly selected packages as roots, resolve their upstream package metadata, and enter the upstream dependency graph with one Make invocation. Probe does not schedule dependencies package by package.'],
  rootfsIntegration: ['RootFS 集成', 'RootFS 整合', 'RootFS integration'],
  rootfsIntegrationShort: ['RootFS', 'RootFS', 'RootFS'],
  rootfsIntegrationHelp: ['L2：包含 L1，并执行上游 package/install，用完整 Final 状态检查 APK/OPKG 文件归属、路径冲突与共同安装问题。', 'L2：包含 L1，並執行上游 package/install，用完整 Final 狀態檢查 APK/OPKG 檔案歸屬、路徑衝突與共同安裝問題。', 'L2: Includes L1 and runs upstream package/install with the complete Final state to expose APK/OPKG ownership, path, and co-install conflicts.'],
  firmwareIntegration: ['固件集成', '韌體整合', 'Firmware integration'],
  firmwareIntegrationShort: ['固件', '韌體', 'Firmware'],
  firmwareIntegrationHelp: ['L3：在同一个真实环境中分别构建 Probe 打开时的 Baseline 与用户选择后的 Final 固件；Baseline 本身失败时不归因给插件。', 'L3：在同一個真實環境中分別建置 Probe 開啟時的 Baseline 與使用者選擇後的 Final 韌體；Baseline 本身失敗時不歸因給套件。', 'L3: Build the Baseline captured when Probe opened and the user-modified Final firmware in the same real environment. A failing Baseline is not attributed to the package.'],
  bootSmoke: ['启动自检', '啟動自檢', 'Boot smoke'],
  bootSmokeShort: ['启动', '啟動', 'Boot'],
  bootSmokeHelp: ['L4：在 L3 Final 固件成功后，对 Catalog 认可的可启动环境执行通用 QEMU 启动自检；不是插件服务或真实硬件功能测试。', 'L4：在 L3 Final 韌體成功後，對 Catalog 認可的可啟動環境執行通用 QEMU 啟動自檢；不是套件服務或真實硬體功能測試。', 'L4: After a successful L3 Final firmware build, run generic QEMU boot smoke on Catalog-approved bootable environments. This is not package-service or real-hardware functional testing.'],
  help: ['说明', '說明', 'Info'],
  preview: ['预览计划', '預覽計畫', 'Preview plan'],
  submit: ['提交插件兼容探针', '提交套件相容性探針', 'Submit package compatibility probe'],
  submittedState: ['Probe V3 状态已带入 GitHub Issue。', 'Probe V3 狀態已帶入 GitHub Issue。', 'The Probe V3 state was carried into the GitHub Issue.'],
  stateInstruction: ['Probe V3 只传递 Baseline、用户直接 Intent、最终 PACKAGE_* 状态、五维环境条件和覆盖参数；不会上传依赖表、构建顺序或第二套软件包数据库。', 'Probe V3 只傳遞 Baseline、使用者直接 Intent、最終 PACKAGE_* 狀態、五維環境條件與覆蓋參數；不會上傳相依表、建置順序或第二套套件資料庫。', 'Probe V3 transports Baseline, direct user Intent, Final PACKAGE_* state, five-dimensional environment constraints, and coverage controls. It does not transport a dependency table, build order, or second package database.'],
  cancelInstruction: ['提交后如需取消，请在同一个 Issue 中准确回复 /cancel。', '提交後如需取消，請在同一個 Issue 中準確回覆 /cancel。', 'To cancel after submission, reply with exactly /cancel in the same Issue.'],
  permission: ['执行权限与并发上限由 Catalog 服务端根据真实 Issue 作者和仓库权限决定；浏览器参数不能提升权限。', '執行權限與並行上限由 Catalog 服務端依真實 Issue 作者與儲存庫權限決定；瀏覽器參數不能提升權限。', 'Execution permission and concurrency caps are decided server-side from the real Issue author and repository permission; browser parameters cannot elevate permission.'],
  retention: ['规范化证据与完整日志继续遵循 Catalog 当前保留策略。', '正規化證據與完整日誌繼續遵循 Catalog 目前保留策略。', 'Normalized evidence and complete logs continue to follow the current Catalog retention policy.'],
  empty: ['没有找到匹配的 Advanced menuconfig 项。', '找不到相符的 Advanced menuconfig 項目。', 'No matching Advanced menuconfig option was found.'],
  invalid: ['至少需要一个本次直接启用的软件包，并且测试环境范围必须匹配至少一个真实环境。', '至少需要一個本次直接啟用的套件，且測試環境範圍必須符合至少一個真實環境。', 'At least one package must be directly enabled in this Probe session, and the environment scope must match at least one real environment.'],
  loadingEnvironments: ['正在读取各 Source / Branch 的 Target 结构…', '正在讀取各 Source / Branch 的 Target 結構…', 'Loading Target structures for Source / Branch entries…'],
  sampled: ['抽样', '抽樣', 'Sampled'],
  batches: ['批次', '批次', 'batches'],
  notApplicable: ['无匹配环境', '無匹配環境', 'No matching environment'],
});
function probeV3UiText(key) {
  const external = catalogApplicationsDocument?.probeUi?.strings?.[key];
  if (external && typeof external === 'object') {
    const exact = String(external[state.lang] || external.en || external['zh-CN'] || '').trim();
    if (exact) return exact;
  }
  const row = PROBE_V3_UI_TEXT[key];
  return row ? uiText(row[0], row[1], row[2]) : key;
}
function probeV3CodeChannel() {
  const branch = String(state.buildMeta?.branch || 'main');
  if (branch.startsWith('fix/')) return branch;
  return ['dev', 'staging', 'main'].includes(branch) ? branch : 'main';
}
function meaningfulProbeV3Text(value) {
  const text = String(value || '').trim();
  return /[\p{L}\p{N}]/u.test(text) ? text : '';
}
function firstMeaningfulProbeV3Text(...values) {
  for (const value of values) {
    const text = meaningfulProbeV3Text(value);
    if (text) return text;
  }
  return '';
}
function probeV3ChoiceFromMenuOption(option) {
  const symbol = String(option?.symbol || '');
  const packageName = symbol.startsWith('PACKAGE_') ? symbol.slice('PACKAGE_'.length) : '';
  const translation = menuOptionTranslation(option);
  return {
    symbol,
    package: packageName,
    displayId: packageName || symbol,
    isPackage: Boolean(packageName),
    userSettable: option?.userSettable !== false,
    title: firstMeaningfulProbeV3Text(translation.title, option.promptZh, option.promptEn),
    usage: firstMeaningfulProbeV3Text(translation.usage, option.usageZh, option.usageEn),
  };
}
function probeV3PackageChoices(query = '') {
  const normalized = normalizeMenuSearchQuery(query);
  const options = normalized.length >= 2
    ? searchMenuOptionsSync(normalized)
    : rankMenuSearchOptions(
      menuSearchOptions.filter((option) => String(option?.symbol || '').startsWith('PACKAGE_')),
      normalized,
    );
  return options
    .filter((option) => optionVisible(option) && catalogOriginMatches(option))
    .map(probeV3ChoiceFromMenuOption);
}
function probeV3CurrentTarget() {
  const source = selectedCatalogSource();
  const branch = selectedCatalogBranch(source);
  const target = (MENU_CATALOG?.targets || []).find((item) =>
    item.board === targetSelectorValues.system && item.subtarget === targetSelectorValues.subtarget);
  const profile = target?.profiles?.find((item) => item.id === targetSelectorValues.profile) ||
    (!(target?.profiles || []).length ? { id: '', name: 'Default profile' } : null);
  if (!source || !branch || !target || !profile) return null;
  return {
    source: String(source.id || ''),
    branch: String(branch.branch || branch.id || ''),
    targetSystem: String(target.board || ''),
    subtarget: String(target.subtarget || ''),
    target: String(target.id || ''),
    profile: String(profile.id || ''),
    profileLabel: String(profile.name || profile.id || 'Default profile'),
  };
}
function probeV3MenuOptionState(option) {
  if (!option) return 'n';
  const raw = menuValues.get(option.symbol) ?? simpleKconfigDefault(option);
  return option.type === 'bool' || option.type === 'tristate'
    ? CATALOG_ENGINE.normalizeKconfigStateValue(option, raw) : raw;
}
function probeV3PackageConfigFromText(text) {
  const rows = new Map();
  for (const line of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(/^CONFIG_PACKAGE_([A-Za-z0-9][A-Za-z0-9+_.@-]{0,95})=([my])$/);
    if (match) rows.set(match[1], `CONFIG_PACKAGE_${match[1]}=${match[2]}`);
  }
  return [...rows.values()].join('\n') + (rows.size ? '\n' : '');
}
function probeV3PackageStateMap(text) {
  const states = new Map();
  for (const line of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(/^CONFIG_PACKAGE_([A-Za-z0-9][A-Za-z0-9+_.@-]{0,95})=([my])$/);
    if (match) states.set(match[1], match[2]);
  }
  return states;
}
function probeV3EnabledIntent(request) {
  return (request?.packageIntent || []).filter((row) => row && ['m', 'y'].includes(row.after));
}
async function probeV3GzipBase64Url(text) {
  if (!('CompressionStream' in window)) {
    throw new Error(uiText('当前浏览器不支持探针状态压缩，请更新浏览器后重试。',
      '目前瀏覽器不支援探針狀態壓縮，請更新瀏覽器後重試。',
      'This browser cannot compress probe state. Update the browser and try again.'));
  }
  const compressed = new Uint8Array(await new Response(
    new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let binary = '';
  for (let i = 0; i < compressed.length; i += 0x4000) {
    binary += String.fromCharCode(...compressed.subarray(i, i + 0x4000));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
async function probeV3StateToken(request) {
  return `WEIG_PACKAGE_PROBE_STATE_V3:${await probeV3GzipBase64Url(JSON.stringify(request))}`;
}
function probeV3IssueTitle(request) {
  const roots = probeV3EnabledIntent(request).map((row) => String(row.package || '')).filter(Boolean);
  const fallbackPackages = request.packageConfig.trim().split('\n').filter(Boolean)
    .map((line) => line.slice('CONFIG_PACKAGE_'.length, line.lastIndexOf('=')));
  const packages = roots.length ? roots : fallbackPackages;
  const channel = String(request.channel || 'main');
  const prefix = channel === 'main' ? '' : `${channel}-`;
  const titlePackages = packages.length
    ? [`${prefix}${packages[0]}`, ...packages.slice(1, 3)].join(', ') +
      (packages.length > 3 ? ` +${packages.length - 3}` : '')
    : `${prefix}menuconfig`;
  return `[probe] ${titlePackages} · ${request.mode}`.slice(0, 200);
}
function probeV3IssueUrl(request, token) {
  const params = new URLSearchParams({
    template: 'package-probe.yml', title: probeV3IssueTitle(request), state: token,
  });
  return `https://github.com/${PROJECT.catalogRepository}/issues/new?${params}`;
}

let probeV3EnvironmentUniverseCache = { key: '', rows: [] };
let probeV3EnvironmentUniversePromise = null;
async function probeV3EnvironmentUniverse(forceRefresh = false, onProgress = null) {
  const assetRef = String(MENU_INDEX?.assetRef || '');
  const key = `${MENU_CATALOG_DATA_REF}:${assetRef}`;
  if (!forceRefresh && probeV3EnvironmentUniverseCache.key === key && probeV3EnvironmentUniverseCache.rows.length) {
    return probeV3EnvironmentUniverseCache.rows;
  }
  if (!forceRefresh && probeV3EnvironmentUniversePromise) return probeV3EnvironmentUniversePromise;
  const pairs = [];
  for (const source of MENU_INDEX?.sources || []) {
    for (const branch of source.branches || []) {
      if (branch.state === 'unavailable') continue;
      pairs.push({ source, branch });
    }
  }
  const run = (async () => {
    const rows = [];
    let cursor = 0;
    let completed = 0;
    const worker = async () => {
      while (cursor < pairs.length) {
        const pair = pairs[cursor++];
        const branchName = String(pair.branch.branch || pair.branch.id || '');
        const loaded = await CATALOG_LOADER.fetchCore({
          sourceId: String(pair.source.id || ''), branchName,
        });
        for (const target of loaded.data?.targets || []) {
          const targetSystem = String(target.board || '');
          const subtarget = String(target.subtarget || '');
          const targetId = String(target.id || [targetSystem, subtarget].filter(Boolean).join('/'));
          const profiles = (target.profiles || []).filter((profile) => profile.selectable !== false);
          const effectiveProfiles = profiles.length ? profiles : [{ id: '', name: 'Default profile' }];
          for (const profile of effectiveProfiles) {
            rows.push({
              source: String(pair.source.id || ''),
              sourceLabel: String(pair.source.label || pair.source.id || ''),
              branch: branchName,
              targetSystem,
              targetSystemLabel: String(target.systemName || targetSystem),
              subtarget,
              subtargetLabel: String(target.subtargetLabel || target.subtargetName || subtarget || 'Default'),
              target: targetId,
              profile: String(profile.id || ''),
              profileLabel: String(profile.name || profile.id || 'Default profile'),
              profileSelector: String(profile.selector || ''),
              sourceCommit: String(pair.branch.commit || loaded.data?.source?.commit || ''),
            });
          }
        }
        completed += 1;
        onProgress?.(completed, pairs.length);
      }
    };
    const workers = Array.from({ length: Math.min(4, Math.max(1, pairs.length)) }, () => worker());
    await Promise.all(workers);
    rows.sort((a, b) => a.source.localeCompare(b.source) ||
      a.branch.localeCompare(b.branch, undefined, { numeric: true }) ||
      a.targetSystem.localeCompare(b.targetSystem) || a.subtarget.localeCompare(b.subtarget) ||
      a.profile.localeCompare(b.profile));
    probeV3EnvironmentUniverseCache = { key, rows };
    return rows;
  })().finally(() => { probeV3EnvironmentUniversePromise = null; });
  probeV3EnvironmentUniversePromise = run;
  return run;
}
function probeV3FilterMatches(value, selected) {
  return selected.has('*') || selected.has(String(value ?? ''));
}
function probeV3FilterEnvironments(rows, filters) {
  return rows.filter((row) => probeV3FilterMatches(row.source, filters.sources) &&
    probeV3FilterMatches(row.branch, filters.branches) &&
    probeV3FilterMatches(row.targetSystem, filters.targetSystems) &&
    probeV3FilterMatches(row.subtarget, filters.subtargets) &&
    probeV3FilterMatches(row.profile, filters.profiles));
}
function probeV3DimensionValues(rows, key) {
  return new Set(rows.map((row) => String(row[key] ?? '')));
}
function probeV3CoverageSample(rows, limit) {
  if (rows.length <= limit) return [...rows];
  const remaining = [...rows];
  const selected = [];
  const seen = {
    source: new Set(), branch: new Set(), targetSystem: new Set(), subtarget: new Set(), profile: new Set(),
  };
  const dimensions = Object.keys(seen);
  while (selected.length < limit && remaining.length) {
    let bestIndex = 0;
    let bestScore = -1;
    for (let index = 0; index < remaining.length; index++) {
      const row = remaining[index];
      let score = 0;
      for (const dimension of dimensions) if (!seen[dimension].has(String(row[dimension] ?? ''))) score += 1;
      if (score > bestScore) { bestScore = score; bestIndex = index; }
    }
    const [row] = remaining.splice(bestIndex, 1);
    selected.push(row);
    for (const dimension of dimensions) seen[dimension].add(String(row[dimension] ?? ''));
  }
  return selected;
}
function probeV3FilterRequest(filters) {
  const values = (set) => set.has('*') ? ['*'] : [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return {
    sources: values(filters.sources),
    branches: values(filters.branches),
    targetSystems: values(filters.targetSystems),
    subtargets: values(filters.subtargets),
    profiles: values(filters.profiles),
  };
}
function probeV3IntentRows(intent) {
  return [...intent.values()].sort((a, b) => a.package.localeCompare(b.package));
}
