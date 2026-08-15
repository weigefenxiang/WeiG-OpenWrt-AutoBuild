from pathlib import Path


def replace_once(path, old, new):
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old[:160]!r}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8', newline='\n')


index = Path('site/wrt/index.html')
replace_once(
    index,
    '        <div class="build-info-title">Build Information</div>',
    '''        <div class="build-info-head">
          <div class="build-info-title">Build Information</div>
          <button type="button" class="icon-btn build-info-close" id="buildInfoClose" data-i18n-aria="btn.close">✕</button>
        </div>''',
)

app = Path('site/wrt/app.js')
replace_once(
    app,
    "  const card = $('buildInfoCard');\n  trigger.textContent = shortSiteVersion(state.siteVersion);",
    "  const card = $('buildInfoCard');\n  const closeButton = $('buildInfoClose');\n  trigger.textContent = shortSiteVersion(state.siteVersion);",
)
replace_once(
    app,
    '''  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(!panel.classList.contains('is-open'));
  });
  document.addEventListener('dblclick', (event) => {''',
    '''  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(!panel.classList.contains('is-open'));
  });
  closeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(false);
  });
  document.addEventListener('dblclick', (event) => {''',
)

css = Path('site/wrt/app.css')
replace_once(
    css,
    '''.build-info-title {
  margin: 0; padding: 13px 17px; border-bottom: 1px solid var(--border);
  color: var(--text); font-size: 15px; font-weight: 650; letter-spacing: .01em;
}''',
    '''.build-info-head {
  display: flex; align-items: center; gap: 8px; padding: 9px 9px 9px 17px; border-bottom: 1px solid var(--border);
}
.build-info-title {
  margin: 0; min-width: 0; flex: 1 1 auto;
  color: var(--text); font-size: 15px; font-weight: 650; letter-spacing: .01em;
}
.build-info-close {
  width: 32px; height: 32px; flex: none; border: 0; background: transparent; font-size: 17px;
}''',
)

test = Path('tools/test-catalog-ui-contract.mjs')
replace_once(
    test,
    '''  buildInfoUiContract.includes("document.addEventListener('dblclick'") &&
  !buildInfoUiContract.includes("document.addEventListener('click'") &&
  css.includes('.build-info.is-open .build-info-card') && !css.includes('.build-info:hover .build-info-card') &&''',
    '''  buildInfoUiContract.includes("document.addEventListener('dblclick'") &&
  !buildInfoUiContract.includes("document.addEventListener('click'") &&
  html.includes('id="buildInfoClose"') && html.includes('data-i18n-aria="btn.close"') &&
  buildInfoUiContract.includes("const closeButton = $('buildInfoClose')") &&
  buildInfoUiContract.includes("closeButton.addEventListener('click', (event) => {") &&
  buildInfoUiContract.includes("event.stopPropagation();\\n    setOpen(false);") &&
  css.includes('.build-info-head') && css.includes('.build-info-close') &&
  css.includes('.build-info.is-open .build-info-card') && !css.includes('.build-info:hover .build-info-card') &&''',
)
