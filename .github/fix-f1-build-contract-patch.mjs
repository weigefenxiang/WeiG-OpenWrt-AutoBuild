import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`missing marker: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`duplicate marker: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}
function replaceRange(source, startMarker, endMarker, after, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`missing start marker: ${label}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`missing end marker: ${label}`);
  return source.slice(0, start) + after + source.slice(end);
}

let html = readFileSync('site/wrt/index.html', 'utf8');
html = replaceOnce(html,
`  const [session, components, pageShell] = await Promise.all([
    import(window.__WEIG_RELEASE_URL__('lib/ui-session-state.js')),
    import(window.__WEIG_RELEASE_URL__('lib/ui-components.js')),
    import(window.__WEIG_RELEASE_URL__('lib/page-shell-ui.js')),
  ]);
  window.__WEIG_UI_RUNTIME__ = Object.freeze({ session, components, pageShell });`,
`  const [session, components, pageShell, buildContract] = await Promise.all([
    import(window.__WEIG_RELEASE_URL__('lib/ui-session-state.js')),
    import(window.__WEIG_RELEASE_URL__('lib/ui-components.js')),
    import(window.__WEIG_RELEASE_URL__('lib/page-shell-ui.js')),
    import(window.__WEIG_RELEASE_URL__('lib/build-contract-ui.js')),
  ]);
  window.__WEIG_UI_RUNTIME__ = Object.freeze({ session, components, pageShell, buildContract });`,
'UI runtime build-contract import');
writeFileSync('site/wrt/index.html', html, 'utf8');

let app = readFileSync('site/wrt/app.js', 'utf8');
app = replaceOnce(app,
`if (!UI_RUNTIME?.session?.createUiSessionState || !UI_RUNTIME?.components?.createUiCheckboxControl ||
    !UI_RUNTIME?.pageShell?.installPageShellUi) {`,
`if (!UI_RUNTIME?.session?.createUiSessionState || !UI_RUNTIME?.components?.createUiCheckboxControl ||
    !UI_RUNTIME?.pageShell?.installPageShellUi || !UI_RUNTIME?.buildContract?.createBuildContractUi) {`,
'build-contract runtime gate');
app = replaceOnce(app,
`const PAGE_SHELL_UI = UI_RUNTIME.pageShell;
`,
`const PAGE_SHELL_UI = UI_RUNTIME.pageShell;
const BUILD_CONTRACT_MODULE = UI_RUNTIME.buildContract;
let BUILD_CONTRACT_UI = null;
`,
'build-contract module binding');
app = replaceOnce(app, `let buildContractExpanded = false;
`, '', 'legacy build-contract expanded state');
app = replaceRange(app, 'function renderContractList(', 'function profilePackageRows(', 'function profilePackageRows(', 'legacy build-contract list renderer');
app = replaceRange(app, 'function renderProfilePackageContract(', 'function profilePackageOption(', 'function profilePackageOption(', 'legacy profile-package contract renderer');
app = replaceRange(app, 'function setBuildContractExpanded(', 'function renderBuildContract()',
`function initBuildContractControls() {
  if (!BUILD_CONTRACT_UI) BUILD_CONTRACT_UI = BUILD_CONTRACT_MODULE.createBuildContractUi({ get: $ });
  BUILD_CONTRACT_UI.init();
}
function renderBuildContract()`, 'legacy build-contract expansion controller');

const renderStart = app.indexOf('function renderBuildContract() {');
const renderEnd = app.indexOf('\n\nfunction resetCatalogSelectionLayers()', renderStart);
if (renderStart < 0 || renderEnd < 0) throw new Error('renderBuildContract range missing');
const renderReplacement = [
  'function renderBuildContract() {',
  '  if (!BUILD_CONTRACT_UI) initBuildContractControls();',
  '  if (!BUILD_CONTRACT_UI) return;',
  "  const target = state.device?.id === 'catalog-target' ? state.device.target : null;",
  '  if (!target || !MENU_CATALOG) {',
  '    BUILD_CONTRACT_UI.render({ visible: false });',
  '    return;',
  '  }',
  '  const source = selectedCatalogSource();',
  '  const branch = selectedCatalogBranch(source);',
  '  const selected = effectiveSelection();',
  '  const selectedNames = selected.all.map((item) => item.id);',
  "  const commit = String(MENU_CATALOG.source?.commit || '').trim() || 'unknown';",
  "  const contractTitle = contractText('当前构建契约', 'Current build contract');",
  "  const commitHint = `${contractText('Catalog 提交', 'Catalog commit')} ${commit}`;",
  '  const profileAdd = target.profilePackagesAdd?.length || 0;',
  '  const profileRemove = target.profilePackagesRemove?.length || 0;',
  '  const rows = [',
  "    [contractText('源码', 'Source'), source?.label || state.source?.id || '-'],",
  "    [contractText('分支', 'Branch'), branch?.branch || state.version?.branch || '-'],",
  "    [contractText('Target', 'Target'), target.systemLabel || target.system || '-'],",
  "    [contractText('Subtarget', 'Subtarget'), target.subtargetLabel || target.subtarget || '-'],",
  "    [contractText('Profile', 'Profile'), target.profileLabel || target.profileSymbol || '-'],",
  "    [contractText('软件包', 'Packages'), `${profileAdd} add / ${profileRemove} remove`],",
  "    [contractText('Catalog', 'Catalog'), commit],",
  "    [contractText('架构', 'Architecture'), target.arch || target.archPackages || contractText('Catalog 未提供', 'Missing from Catalog')],",
  '  ];',
  '  const shownSelected = selectedNames.slice(0, 24);',
  '  if (selectedNames.length > shownSelected.length) shownSelected.push(`+${selectedNames.length - shownSelected.length}`);',
  '  BUILD_CONTRACT_UI.render({',
  '    visible: true,',
  '    title: contractTitle,',
  '    commitHint,',
  '    rows,',
  '    profilePackages: {',
  "      title: contractText('Profile 软件包', 'Profile packages'),",
  "      manageLabel: contractText('管理', 'Manage'),",
  "      empty: contractText('上游未声明额外 Profile 软件包', 'No additional Profile packages declared upstream'),",
  "      help: contractText('默认跟随上游；可在管理中显式加入或排除', 'Follows upstream by default; Manage can explicitly include or exclude it'),",
  '      rows: profilePackageRows(target).map((row) => ({ ...row, mode: profilePackageMode(row.name) })),',
  '      onManage: openProfilePackageModal,',
  '    },',
  '    selection: {',
  "      title: contractText('已选插件', 'Selected plugins'),",
  '      items: shownSelected,',
  "      empty: contractText('尚未选择插件', 'No plugins selected'),",
  '    },',
  '  });',
  '}',
].join('\n');
app = app.slice(0, renderStart) + renderReplacement + app.slice(renderEnd);
if (app.includes('buildContractExpanded')) throw new Error('legacy build-contract expanded state remains');
if (app.includes("row.className = 'build-contract-row'")) throw new Error('build-contract row renderer remains in app.js');
writeFileSync('site/wrt/app.js', app, 'utf8');

let moduleTest = readFileSync('tools/test-ui-modules.mjs', 'utf8');
moduleTest = replaceOnce(moduleTest,
`const shell = readFileSync(new URL('../site/wrt/lib/page-shell-ui.js', import.meta.url), 'utf8');
`,
`const shell = readFileSync(new URL('../site/wrt/lib/page-shell-ui.js', import.meta.url), 'utf8');
const buildContract = readFileSync(new URL('../site/wrt/lib/build-contract-ui.js', import.meta.url), 'utf8');
`,
'build-contract test reader');
moduleTest = replaceOnce(moduleTest,
`assert.match(html, /lib\/page-shell-ui\.js/);
`,
`assert.match(html, /lib\/page-shell-ui\.js/);
assert.match(html, /lib\/build-contract-ui\.js/);
`,
'build-contract import contract');
moduleTest = replaceOnce(moduleTest,
`assert.match(app, /PAGE_SHELL_UI\.installPageShellUi/);
`,
`assert.match(app, /PAGE_SHELL_UI\.installPageShellUi/);
assert.match(app, /BUILD_CONTRACT_MODULE\.createBuildContractUi/);
assert.match(app, /BUILD_CONTRACT_UI\.render/);
assert.doesNotMatch(app, /let buildContractExpanded/);
assert.doesNotMatch(app, /row\.className = 'build-contract-row'/);
assert.match(buildContract, /export function createBuildContractUi/);
assert.match(buildContract, /row\.className = 'build-contract-row'/);
assert.match(buildContract, /profile-package-chip mode-/);
`,
'build-contract module assertions');
writeFileSync('tools/test-ui-modules.mjs', moduleTest, 'utf8');
