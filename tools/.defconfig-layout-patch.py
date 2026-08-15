from pathlib import Path


def replace_once(path, old, new, label):
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match for {label}, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8', newline='\n')


html = Path('site/wrt/index.html')
replace_once(
    html,
    '''          <div class="build-contract-controls" id="buildContractControls" hidden>\n            <label class="defconfig-switch" id="defconfigSwitch" title="">\n              <input type="checkbox" id="defconfigToggle" checked>\n              <span id="defconfigLabel">Defconfig</span>\n            </label>\n            <label class="build-contract-selected-filter" title="Selected only">\n''',
    '''          <div class="build-contract-controls" id="buildContractControls" hidden>\n            <label class="build-contract-selected-filter" title="Selected only">\n''',
    'remove Defconfig from build contract controls',
)
replace_once(
    html,
    '''          <div class="menuconfig-header">\n            <button class="menuconfig-toggle" id="menuconfigToggle" type="button" aria-expanded="false" aria-controls="menuconfigBody">\n              <strong>Advanced menuconfig</strong>\n              <span class="hint" id="menuconfigStatus"></span>\n              <span class="menuconfig-chevron" aria-hidden="true">⌄</span>\n            </button>\n            <div class="menuconfig-search-group">\n''',
    '''          <div class="menuconfig-header">\n            <div class="menuconfig-title-group">\n              <button class="menuconfig-toggle" id="menuconfigToggle" type="button" aria-expanded="false" aria-controls="menuconfigBody">\n                <strong>Advanced menuconfig</strong>\n                <span class="hint" id="menuconfigStatus"></span>\n                <span class="menuconfig-chevron" aria-hidden="true">⌄</span>\n              </button>\n              <label class="defconfig-switch menuconfig-defconfig" id="defconfigSwitch" title="Defconfig">\n                <input type="checkbox" id="defconfigToggle" aria-label="Defconfig">\n                <span id="defconfigLabel">D</span>\n              </label>\n            </div>\n            <div class="menuconfig-search-group">\n''',
    'move Defconfig beside Advanced menuconfig',
)

app = Path('site/wrt/app.js')
replace_once(app, '  useDefconfig: true,\n', '  useDefconfig: false,\n', 'default Defconfig state')
replace_once(
    app,
    "  if ($('defconfigLabel')) $('defconfigLabel').textContent = 'Defconfig';\n",
    "  if ($('defconfigLabel')) $('defconfigLabel').textContent = 'D';\n",
    'compact Defconfig label',
)
replace_once(
    app,
    "  state.useDefconfig = true;\n  if ($('defconfigToggle')) $('defconfigToggle').checked = true;\n",
    "  state.useDefconfig = false;\n  if ($('defconfigToggle')) $('defconfigToggle').checked = false;\n",
    'clear imported Defconfig state',
)

css = Path('site/wrt/app.css')
replace_once(
    css,
    '.build-contract-toggle{display:flex;flex:1 1 190px;align-items:center;gap:8px;min-width:0;min-height:32px;padding:0;border:0;background:transparent;color:var(--text);text-align:left;cursor:pointer}\n',
    '.build-contract-toggle{display:flex;flex:0 0 auto;align-items:center;gap:8px;min-width:0;min-height:32px;padding:0;border:0;background:transparent;color:var(--text);text-align:left;cursor:pointer}\n',
    'compact build contract title',
)
replace_once(
    css,
    '.catalog-overview-row{display:grid;grid-template-columns:minmax(320px,1fr) clamp(210px,18vw,250px) max-content;grid-template-rows:auto auto;align-items:start;gap:10px;margin-top:10px;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--card)}\n',
    '.catalog-overview-row{display:grid;grid-template-columns:minmax(0,1fr) max-content max-content;grid-template-rows:auto auto;align-items:start;gap:10px;margin-top:10px;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--card)}\n',
    'expand Catalog locator column',
)
replace_once(
    css,
    '.menuconfig-header{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,360px);align-items:center;gap:10px;min-width:0}\n.menuconfig-toggle{display:flex;flex:1 1 340px;align-items:center;gap:10px;min-width:0;min-height:42px;padding:0 10px;border:1px solid var(--border);border-radius:9px;background:var(--card2);color:var(--text);text-align:left;cursor:pointer}\n',
    '.menuconfig-header{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,360px);align-items:center;gap:10px;min-width:0}\n.menuconfig-title-group{display:flex;align-items:center;gap:8px;min-width:0}\n.menuconfig-title-group .menuconfig-toggle{flex:1 1 auto}\n.menuconfig-defconfig{flex:none;min-width:52px;min-height:42px;padding:0 9px;justify-content:center;gap:5px}\n.menuconfig-defconfig input{margin:0}\n.menuconfig-toggle{display:flex;flex:1 1 340px;align-items:center;gap:10px;min-width:0;min-height:42px;padding:0 10px;border:1px solid var(--border);border-radius:9px;background:var(--card2);color:var(--text);text-align:left;cursor:pointer}\n',
    'add compact Defconfig control to menuconfig header',
)
replace_once(
    css,
    '  .catalog-overview-row{grid-template-columns:clamp(210px,28vw,250px) minmax(0,1fr);grid-template-rows:auto auto auto}\n',
    '  .catalog-overview-row{grid-template-columns:max-content minmax(0,1fr);grid-template-rows:auto auto auto}\n',
    'compact tablet build contract column',
)

test = Path('tools/test-catalog-ui-contract.mjs')
marker = "expect(!app.includes('syncThemeFromMenu') && app.includes('syncFirmwareThemeFromMenu'),\n"
insert = '''const defconfigTogglePosition = html.indexOf('id="defconfigToggle"');\nconst menuconfigHeaderPosition = html.indexOf('<div class="menuconfig-header">');\nconst menuconfigBodyPosition = html.indexOf('<div id="menuconfigBody"');\nexpect(app.includes('useDefconfig: false,') &&\n  app.includes("if ($('defconfigLabel')) $('defconfigLabel').textContent = 'D';") &&\n  app.includes("state.useDefconfig = false;\\n  if ($('defconfigToggle')) $('defconfigToggle').checked = false;") &&\n  html.includes('class="defconfig-switch menuconfig-defconfig"') &&\n  html.includes('<input type="checkbox" id="defconfigToggle" aria-label="Defconfig">') &&\n  !html.includes('id="defconfigToggle" checked') &&\n  defconfigTogglePosition > menuconfigHeaderPosition && defconfigTogglePosition < menuconfigBodyPosition &&\n  css.includes('.catalog-overview-row{display:grid;grid-template-columns:minmax(0,1fr) max-content max-content;') &&\n  css.includes('.build-contract-toggle{display:flex;flex:0 0 auto;') &&\n  css.includes('.menuconfig-title-group{display:flex;align-items:center;gap:8px;min-width:0}') &&\n  css.includes('.menuconfig-defconfig{flex:none;min-width:52px;min-height:42px;'),\n  'Defconfig default, Advanced menuconfig placement, or compact Catalog overview layout regressed');\n\n'''
text = test.read_text(encoding='utf-8')
if text.count(marker) != 1:
    raise SystemExit('test-catalog-ui-contract.mjs: insertion marker mismatch')
test.write_text(text.replace(marker, insert + marker, 1), encoding='utf-8', newline='\n')
