function runtimeOption(record) {
  const symbol = record.configSymbol;
  const packageName = symbol.startsWith('PACKAGE_') ? symbol.slice(8) : '';
  return {
    symbol,
    kind: record.kind || (packageName ? 'config' : 'config'),
    type: record.type || (record.states?.includes('m') ? 'tristate' : 'bool'),
    prompt: packageName || symbol,
    promptEn: packageName || symbol,
    promptZh: '',
    promptI18n: {},
    usageEn: '',
    usageZh: '',
    usageI18n: {},
    help: '',
    path: [],
    parent: '',
    choice: record.choice || '',
    defaults: record.defaults || [],
    depends: record.kconfig?.dependsExpressions?.[0] || [],
    dependsVariants: record.kconfig?.dependsExpressions || [[]],
    selects: record.kconfig?.selectsExpressions?.flat?.() || [],
    selectsVariants: record.kconfig?.selectsExpressions || [],
    implies: record.kconfig?.impliesExpressions?.flat?.() || [],
    impliesVariants: record.kconfig?.impliesExpressions || [],
    conflicts: (record.conflicts || []).map((name) => `PACKAGE_${name}`),
    hidden: record.hidden === true,
    visible: record.visible !== false,
    userSettable: record.userSettable !== false,
    canDisable: record.canDisable !== false,
    origin: record.origin || '',
  };
}

export function createRuntimeMenu(model) {
  const options = (model?.records || []).filter((record) => record.configSymbol).map(runtimeOption);
  const choices = [...(model?.choices || new Map())].map(([id, symbols]) => ({
    id,
    prompt: id,
    promptEn: id,
    defaults: [],
    symbols: [...symbols],
  }));
  return { categories: [], labels: {}, options, choices, displayLoaded: false, hiddenLoaded: false, helpLoaded: false, loadedLanguages: [] };
}

export function mergeMenuShards(catalog, model, menuShard, hiddenShard = null) {
  const runtime = new Map((catalog?.menu?.options || createRuntimeMenu(model).options)
    .map((option) => [option.symbol, option]));
  for (const display of menuShard?.options || []) {
    const option = runtime.get(display.symbol);
    if (option) Object.assign(option, display, { hidden: false, visible: true, userSettable: true });
  }
  for (const display of hiddenShard?.options || []) {
    const option = runtime.get(display.symbol);
    if (option) Object.assign(option, display, { hidden: true, visible: false, userSettable: false });
  }
  const choiceById = new Map((catalog?.menu?.choices || []).map((choice) => [choice.id, choice]));
  for (const display of menuShard?.choices || []) {
    const choice = choiceById.get(display.id) || { id: display.id };
    Object.assign(choice, display);
    choiceById.set(display.id, choice);
  }
  catalog.menu = {
    categories: [...(menuShard?.categories || [])],
    labels: { ...(menuShard?.labels || {}) },
    displayOptions: [...runtime.values()],
    options: [...runtime.values()],
    choices: [...choiceById.values()],
    displayLoaded: true,
    hiddenLoaded: Boolean(hiddenShard) || catalog?.menu?.hiddenLoaded === true,
    helpLoaded: catalog?.menu?.helpLoaded === true,
    loadedLanguages: [...new Set(catalog?.menu?.loadedLanguages || [])],
  };
  return catalog.menu;
}

export function mergeHiddenShard(catalog, model, hiddenShard) {
  if (!catalog?.menu || !hiddenShard?.options) return false;
  const runtime = new Map((catalog.menu.displayOptions || catalog.menu.options || createRuntimeMenu(model).options)
    .map((option) => [option.symbol, option]));
  for (const display of hiddenShard.options) {
    const option = runtime.get(display.symbol);
    if (option) Object.assign(option, display, { hidden: true, visible: false, userSettable: false });
  }
  catalog.menu.displayOptions = [...runtime.values()];
  catalog.menu.hiddenLoaded = true;
  return true;
}

export function applyMenuLanguageShard(catalog, shard) {
  if (!catalog?.menu || !shard?.language) return false;
  const language = shard.language;
  const optionBySymbol = new Map((catalog.menu.displayOptions || catalog.menu.options || []).map((option) => [option.symbol, option]));
  for (const [symbol, title, usage] of shard.options || []) {
    const option = optionBySymbol.get(symbol);
    if (!option) continue;
    option.promptI18n ||= {};
    option.usageI18n ||= {};
    if (title) option.promptI18n[language] = title;
    if (usage) option.usageI18n[language] = usage;
    if (language === 'zh-CN') {
      option.promptZh = title || option.promptZh || '';
      option.usageZh = usage || option.usageZh || '';
    }
  }
  for (const [name, title, usage] of shard.labels || []) {
    const row = catalog.menu.labels[name] ||= { en: name };
    row.i18n ||= {};
    row.usageI18n ||= {};
    if (title) row.i18n[language] = title;
    if (usage) row.usageI18n[language] = usage;
    if (language === 'zh-CN') {
      row.zhCN = title || row.zhCN || '';
      row.usageZh = usage || row.usageZh || '';
    }
  }
  const choiceById = new Map((catalog.menu.choices || []).map((choice) => [choice.id, choice]));
  for (const [id, title, usage] of shard.choices || []) {
    const choice = choiceById.get(id);
    if (!choice) continue;
    choice.promptI18n ||= {};
    choice.usageI18n ||= {};
    if (title) choice.promptI18n[language] = title;
    if (usage) choice.usageI18n[language] = usage;
    if (language === 'zh-CN') {
      choice.promptZh = title || choice.promptZh || '';
      choice.usageZh = usage || choice.usageZh || '';
    }
  }
  catalog.menu.loadedLanguages = [...new Set([...(catalog.menu.loadedLanguages || []), language])];
  return true;
}

export function applyHelpShard(catalog, shard) {
  if (!catalog?.menu || !shard?.options) return false;
  const optionBySymbol = new Map((catalog.menu.displayOptions || catalog.menu.options || []).map((option) => [option.symbol, option]));
  for (const row of shard.options) {
    const option = optionBySymbol.get(row.symbol);
    if (!option) continue;
    option.help = row.en || option.help || '';
    option.usageEn = row.en || option.usageEn || '';
    option.usageZh = row.zhCN || option.usageZh || '';
    option.usageI18n = { ...(option.usageI18n || {}), ...(row.i18n || {}) };
  }
  catalog.menu.helpLoaded = true;
  return true;
}
