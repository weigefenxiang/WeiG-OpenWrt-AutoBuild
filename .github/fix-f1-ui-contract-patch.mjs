import { readFileSync, writeFileSync } from 'node:fs';

const path = 'tools/test-catalog-ui-contract.mjs';
let text = readFileSync(path, 'utf8');

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`missing marker: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`duplicate marker: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const anchor = "const css = readFileSync(join(root, 'site', 'wrt', 'app.css'), 'utf8');\n";
text = replaceOnce(text, anchor, anchor +
  "const uiSession = readFileSync(join(root, 'site', 'wrt', 'lib', 'ui-session-state.js'), 'utf8');\n" +
  "const uiComponents = readFileSync(join(root, 'site', 'wrt', 'lib', 'ui-components.js'), 'utf8');\n" +
  "const pageShell = readFileSync(join(root, 'site', 'wrt', 'lib', 'page-shell-ui.js'), 'utf8');\n" +
  "const uiComponentsCss = readFileSync(join(root, 'site', 'wrt', 'ui-components.css'), 'utf8');\n",
  'module readers');

const oldCompatibility = `expect(app.includes('let compatibilityRememberDefault = false;') &&
  app.includes("rememberChoice.className = 'compatibility-remember'") &&
  app.includes("rememberInput.checked = compatibilityRememberDefault") &&
  app.includes("finish(rememberInput.checked ? 'forced-remember' : 'forced')") &&
  app.includes('remembered.size === forced.size') &&
  app.includes("rememberDefault.className = 'st-option compatibility-remember'") &&
  app.includes('compatibilityRememberDefault = rememberDefaultInput.checked') &&
  app.includes('仅当前页面有效；刷新或重新打开网页、清除站点数据后失效。') &&
  !app.includes('wrt_compatibility_remember') &&
  css.includes('.compatibility-remember{display:inline-flex;') &&
  css.includes('.st-option.compatibility-remember{width:100%;'),
  'force-confirm remember-choice control, page-session default, tooltip, or non-persistence regressed');`;

const newCompatibility = `expect(uiSession.includes('let compatibilityRememberDefault = false;') &&
  uiSession.includes('let compatibilityAcknowledgement = null;') &&
  uiSession.includes('setRememberDefault(value) { compatibilityRememberDefault = value === true; }') &&
  uiSession.includes('clearAcknowledgement() { compatibilityAcknowledgement = null; }') &&
  app.includes('UI_COMPONENTS.createUiCheckboxControl({') &&
  app.includes('checked: UI_SESSION.compatibility.getRememberDefault(),') &&
  app.includes("finish(rememberInput.checked ? 'forced-remember' : 'forced')") &&
  app.includes('remembered.size === forced.size') &&
  app.includes('onChange: (checked) => UI_SESSION.compatibility.setRememberDefault(checked)') &&
  app.includes('仅当前页面有效；刷新或重新打开网页、清除站点数据后失效。') &&
  !app.includes('wrt_compatibility_remember') && !uiSession.includes('localStorage') &&
  uiComponents.includes('export function createUiCheckboxControl') &&
  uiComponentsCss.includes('.ui-checkbox-control{display:inline-flex;') &&
  css.includes('.compatibility-remember{display:inline-flex;') &&
  css.includes('.st-option.compatibility-remember{width:100%;'),
  'force-confirm remember-choice control, page-session default, tooltip, or non-persistence regressed');`;
text = replaceOnce(text, oldCompatibility, newCompatibility, 'compatibility module contract');

const oldFont = "  app.includes('const FONT_DEF = 17, FONT_MIN = 14, FONT_MAX = 24;'),";
const newFont = "  pageShell.includes('const FONT_DEF = 17, FONT_MIN = 14, FONT_MAX = 24;') &&\n  !app.includes('const FONT_DEF = 17, FONT_MIN = 14, FONT_MAX = 24;'),";
text = replaceOnce(text, oldFont, newFont, 'page-shell font contract');

const oldRollback = `expect(restoreContract.includes('catalogStateRevision = snapshot.revision') &&
  restoreContract.includes('compatibilityAcknowledgement = snapshot.compatibilityAcknowledgement') &&
  restoreContract.includes('clearCatalogDerivedCaches()') &&
  !restoreContract.includes('markCatalogStateChanged'),
  'failure rollback is incorrectly counted as a configuration change');`;
const newRollback = `expect(restoreContract.includes('catalogStateRevision = snapshot.revision') &&
  restoreContract.includes('UI_SESSION.compatibility.setAcknowledgement(snapshot.compatibilityAcknowledgement)') &&
  restoreContract.includes('clearCatalogDerivedCaches()') &&
  !restoreContract.includes('markCatalogStateChanged'),
  'failure rollback is incorrectly counted as a configuration change');`;
text = replaceOnce(text, oldRollback, newRollback, 'rollback session contract');

writeFileSync(path, text, 'utf8');
