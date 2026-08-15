from pathlib import Path


def replace_once(path, old, new):
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old[:140]!r}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8', newline='\n')


app = Path('site/wrt/app.js')
text = app.read_text(encoding='utf-8')
marker = "function renderBuildInfo() {\n"
helper = """const BUILD_INFO_INTERACTIVE_SELECTOR = [
  'a[href]', 'button', 'input', 'select', 'textarea', 'label', 'summary',
  '[contenteditable=\"true\"]', '[role=\"button\"]', '[role=\"checkbox\"]', '[role=\"radio\"]',
  '[role=\"option\"]', '[role=\"menuitem\"]', '[role=\"menuitemcheckbox\"]', '[role=\"menuitemradio\"]',
  '[tabindex]:not([tabindex=\"-1\"])',
].join(',');

function buildInfoInteractiveTarget(target) {
  const element = target instanceof Element ? target : target?.parentElement;
  return element?.closest(BUILD_INFO_INTERACTIVE_SELECTOR) || null;
}

function renderBuildInfo() {
"""
if text.count(marker) != 1:
    raise SystemExit('app.js: renderBuildInfo marker mismatch')
text = text.replace(marker, helper, 1)
old = """  closeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(false);
  });
  document.addEventListener('dblclick', (event) => {
    if (panel.classList.contains('is-open') && !panel.contains(event.target)) setOpen(false);
  });
"""
new = """  closeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(false);
  });
  document.addEventListener('click', (event) => {
    if (!panel.classList.contains('is-open') || panel.contains(event.target)) return;
    if (buildInfoInteractiveTarget(event.target)) setOpen(false);
  });
  document.addEventListener('dblclick', (event) => {
    if (panel.classList.contains('is-open') && !panel.contains(event.target)) setOpen(false);
  });
"""
if text.count(old) != 1:
    raise SystemExit('app.js: Build Information close listeners marker mismatch')
text = text.replace(old, new, 1)
app.write_text(text, encoding='utf-8', newline='\n')


test = Path('tools/test-catalog-ui-contract.mjs')
text = test.read_text(encoding='utf-8')
old = """  buildInfoUiContract.includes(\"document.addEventListener('dblclick'\") &&
  !buildInfoUiContract.includes(\"document.addEventListener('click'\") &&
  html.includes('id=\"buildInfoClose\"') && html.includes('data-i18n-aria=\"btn.close\"') &&
"""
new = """  buildInfoUiContract.includes(\"document.addEventListener('click'\") &&
  buildInfoUiContract.includes(\"if (!panel.classList.contains('is-open') || panel.contains(event.target)) return;\") &&
  buildInfoUiContract.includes('if (buildInfoInteractiveTarget(event.target)) setOpen(false);') &&
  buildInfoUiContract.includes(\"document.addEventListener('dblclick'\") &&
  app.includes('const BUILD_INFO_INTERACTIVE_SELECTOR = [') &&
  app.includes("'a[href]', 'button', 'input', 'select', 'textarea', 'label', 'summary'") &&
  app.includes("'[role=\\\"button\\\"]', '[role=\\\"checkbox\\\"]', '[role=\\\"radio\\\"]'") &&
  app.includes("'[tabindex]:not([tabindex=\\\"-1\\\"])'") &&
  html.includes('id=\"buildInfoClose\"') && html.includes('data-i18n-aria=\"btn.close\"') &&
"""
if text.count(old) != 1:
    raise SystemExit('test-catalog-ui-contract.mjs: Build Information listener contract marker mismatch')
text = text.replace(old, new, 1)
old_msg = "  'Build Information anchoring, full-width SHA display, or footer order regressed');"
new_msg = "  'Build Information anchoring, interactive auto-close, full-width SHA display, or footer order regressed');"
if text.count(old_msg) != 1:
    raise SystemExit('test-catalog-ui-contract.mjs: Build Information contract message mismatch')
text = text.replace(old_msg, new_msg, 1)
test.write_text(text, encoding='utf-8', newline='\n')
