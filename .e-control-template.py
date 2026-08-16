from pathlib import Path

css_path = Path('site/wrt/app.css')
test_path = Path('tools/test-catalog-ui-contract.mjs')
css = css_path.read_text(encoding='utf-8')
test = test_path.read_text(encoding='utf-8')

marker = '/* 统一交互控件立体模板 / shared elevated interactive-control template */'
if marker in css:
    raise SystemExit('control template already present')

light_anchor = '  --select-card-lift: -1px;\n  --radius: 10px;'
light_tokens = '''  --select-card-lift: -1px;
  /* 统一交互控件立体模板 / shared elevated interactive-control template */
  --control-highlight: rgba(255, 255, 255, .96);
  --control-border: color-mix(in srgb, var(--border) 52%, #91a0b4 48%);
  --control-surface-top: color-mix(in srgb, var(--card) 82%, #fff 18%);
  --control-surface-bottom: color-mix(in srgb, var(--card) 90%, #d8e0ea 10%);
  --control-hover-top: color-mix(in srgb, var(--accent-bg) 34%, #fff 66%);
  --control-hover-bottom: color-mix(in srgb, var(--accent-bg) 48%, var(--card) 52%);
  --control-selected-top: color-mix(in srgb, var(--accent-bg) 76%, #fff 24%);
  --control-selected-bottom: color-mix(in srgb, var(--accent-bg) 88%, #c8d8f3 12%);
  --control-shadow: 0 1px 1px rgba(15, 23, 42, .08), 0 3px 7px rgba(55, 75, 104, .13), 0 8px 18px rgba(55, 75, 104, .06);
  --control-shadow-hover: 0 2px 2px rgba(15, 23, 42, .09), 0 6px 12px rgba(55, 75, 104, .16), 0 12px 22px rgba(55, 75, 104, .08);
  --control-shadow-active: 0 1px 2px rgba(15, 23, 42, .12), 0 2px 4px rgba(55, 75, 104, .12);
  --control-shadow-selected: 0 3px 8px rgba(37, 99, 235, .18), 0 8px 18px rgba(37, 99, 235, .09);
  --control-focus-ring: 0 0 0 3px color-mix(in srgb, var(--accent) 24%, transparent);
  --control-lift: -1px;
  --radius: 10px;'''
if css.count(light_anchor) != 1:
    raise SystemExit(f'light control-token anchor count={css.count(light_anchor)}')
css = css.replace(light_anchor, light_tokens, 1)

dark_anchor = '    --select-card-lift: -1px;\n    --shadow: none;'
dark_tokens = '''    --select-card-lift: -1px;
    --control-highlight: rgba(255, 255, 255, .065);
    --control-border: color-mix(in srgb, var(--border) 70%, var(--text3) 30%);
    --control-surface-top: color-mix(in srgb, var(--card) 92%, #fff 8%);
    --control-surface-bottom: color-mix(in srgb, var(--card) 96%, var(--bg) 4%);
    --control-hover-top: color-mix(in srgb, var(--accent-bg) 78%, #fff 7%);
    --control-hover-bottom: color-mix(in srgb, var(--accent-bg) 90%, var(--bg) 10%);
    --control-selected-top: color-mix(in srgb, var(--accent-bg) 88%, #fff 8%);
    --control-selected-bottom: color-mix(in srgb, var(--accent-bg) 96%, var(--bg) 4%);
    --control-shadow: 0 1px 2px rgba(0, 0, 0, .24), 0 5px 12px rgba(0, 0, 0, .18);
    --control-shadow-hover: 0 2px 3px rgba(0, 0, 0, .28), 0 8px 17px rgba(0, 0, 0, .23);
    --control-shadow-active: 0 1px 2px rgba(0, 0, 0, .30), 0 2px 5px rgba(0, 0, 0, .18);
    --control-shadow-selected: 0 5px 13px rgba(0, 0, 0, .24), 0 0 12px color-mix(in srgb, var(--accent) 16%, transparent);
    --control-focus-ring: 0 0 0 3px color-mix(in srgb, var(--accent) 28%, transparent);
    --control-lift: -1px;
    --shadow: none;'''
if css.count(dark_anchor) != 1:
    raise SystemExit(f'auto-dark control-token anchor count={css.count(dark_anchor)}')
css = css.replace(dark_anchor, dark_tokens, 1)

explicit_dark_anchor = '  --select-card-lift: -1px;\n  --shadow: none;'
explicit_dark_tokens = dark_tokens.replace('    ', '  ')
if css.count(explicit_dark_anchor) != 1:
    raise SystemExit(f'explicit-dark control-token anchor count={css.count(explicit_dark_anchor)}')
css = css.replace(explicit_dark_anchor, explicit_dark_tokens, 1)

control_css = r'''

/* 标准交互控件模板：以后新增输入/下拉/按钮/选择框优先复用 .control-field / .control-action / .control-choice */
:where(.control-field, input[type="search"], input[type="text"], input[type="password"], input[type="number"], select, textarea) {
  border: 1px solid var(--control-border);
  background: linear-gradient(180deg, var(--control-surface-top) 0%, var(--control-surface-bottom) 100%);
  color: var(--text);
  box-shadow: inset 0 1px 0 var(--control-highlight), var(--control-shadow);
  outline: none;
  transition: border-color .15s ease, background .15s ease, box-shadow .15s ease, color .15s ease, opacity .15s ease;
}
:where(.control-field, input[type="search"], input[type="text"], input[type="password"], input[type="number"], select, textarea):hover:not(:disabled):not([readonly]) {
  border-color: color-mix(in srgb, var(--accent) 58%, var(--control-border));
  box-shadow: inset 0 1px 0 var(--control-highlight), var(--control-shadow-hover);
}
:where(.control-field, input[type="search"], input[type="text"], input[type="password"], input[type="number"], select, textarea):focus-visible {
  border-color: var(--accent);
  box-shadow: inset 0 1px 0 var(--control-highlight), var(--control-shadow), var(--control-focus-ring);
}
:where(input[type="search"], input[type="text"], input[type="password"], input[type="number"], select, textarea):disabled,
:where(input[type="search"], input[type="text"], input[type="password"], input[type="number"], textarea)[readonly] {
  opacity: .58;
  background: var(--card2);
  box-shadow: none;
  cursor: not-allowed;
}

:where(.control-action, .control-choice, .btn, .icon-btn, .text-btn, .pill, .device-summary, .catalog-copy-diagnostics,
  .defconfig-switch, .menuconfig-toggle, .menuconfig-back, .menuconfig-selected-toggle, .build-contract-selected-filter) {
  border-color: var(--control-border);
  background: linear-gradient(180deg, var(--control-surface-top) 0%, var(--control-surface-bottom) 100%);
  box-shadow: inset 0 1px 0 var(--control-highlight), var(--control-shadow);
  transition: transform .14s ease, border-color .15s ease, background .15s ease, box-shadow .15s ease, color .15s ease, opacity .15s ease;
}
:where(.control-action, .control-choice, .btn, .icon-btn, .text-btn, .pill, .device-summary, .catalog-copy-diagnostics,
  .defconfig-switch, .menuconfig-toggle, .menuconfig-back, .menuconfig-selected-toggle, .build-contract-selected-filter):hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--accent) 62%, var(--control-border));
  background: linear-gradient(180deg, var(--control-hover-top) 0%, var(--control-hover-bottom) 100%);
  box-shadow: inset 0 1px 0 var(--control-highlight), var(--control-shadow-hover);
  transform: translateY(var(--control-lift));
}
:where(.control-action, .control-choice, .btn, .icon-btn, .text-btn, .pill, .device-summary, .catalog-copy-diagnostics,
  .defconfig-switch, .menuconfig-toggle, .menuconfig-back, .menuconfig-selected-toggle, .build-contract-selected-filter):active:not(:disabled) {
  transform: translateY(0);
  box-shadow: inset 0 1px 0 var(--control-highlight), var(--control-shadow-active);
}
:where(.control-action, .control-choice, .btn, .icon-btn, .text-btn, .pill, .device-summary, .catalog-copy-diagnostics,
  .defconfig-switch, .menuconfig-toggle, .menuconfig-back, .menuconfig-selected-toggle, .build-contract-selected-filter):focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: inset 0 1px 0 var(--control-highlight), var(--control-shadow), var(--control-focus-ring);
}
:where(.btn, .icon-btn, .text-btn, .menuconfig-back):disabled,
:where(.defconfig-switch, .build-contract-selected-filter):has(input:disabled) {
  opacity: .48;
  box-shadow: none;
  transform: none;
  cursor: not-allowed;
}

.pill-active,
.defconfig-switch:has(input:checked),
.build-contract-selected-filter:has(input:checked),
.menuconfig-selected-toggle[aria-expanded="true"] {
  border-color: var(--accent);
  background: linear-gradient(180deg, var(--control-selected-top) 0%, var(--control-selected-bottom) 100%);
  color: var(--accent-text);
  box-shadow: inset 0 1px 0 var(--control-highlight), 0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent), var(--control-shadow-selected);
}
.build-contract-head {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--control-border));
  background: linear-gradient(180deg, var(--control-selected-top) 0%, var(--control-selected-bottom) 100%);
  box-shadow: inset 0 1px 0 var(--control-highlight), var(--control-shadow);
}
.btn-primary,
.btn-primary:hover,
.btn-primary:focus-visible {
  border-color: var(--accent);
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 88%, #fff 12%) 0%, var(--accent) 62%, color-mix(in srgb, var(--accent) 90%, #000 10%) 100%);
  color: #fff;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.28), var(--control-shadow-selected);
}
.btn-primary:hover { transform: translateY(var(--control-lift)); filter: brightness(1.04); }
.btn-primary:active { transform: translateY(0); box-shadow: inset 0 1px 0 rgba(255,255,255,.20), var(--control-shadow-active); }

:where(.defconfig-switch, .build-contract-selected-filter, .adv-toggle) input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--accent);
  filter: drop-shadow(0 1px 1px color-mix(in srgb, var(--text) 16%, transparent));
}
:where(.defconfig-switch, .build-contract-selected-filter, .adv-toggle) input[type="checkbox"]:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  :where(.control-action, .control-choice, .btn, .icon-btn, .text-btn, .pill, .device-summary, .catalog-copy-diagnostics,
    .defconfig-switch, .menuconfig-toggle, .menuconfig-back, .menuconfig-selected-toggle, .build-contract-selected-filter) {
    transition: border-color .12s ease, background .12s ease, box-shadow .12s ease, color .12s ease;
  }
  :where(.control-action, .control-choice, .btn, .icon-btn, .text-btn, .pill, .device-summary, .catalog-copy-diagnostics,
    .defconfig-switch, .menuconfig-toggle, .menuconfig-back, .menuconfig-selected-toggle, .build-contract-selected-filter):hover:not(:disabled),
  :where(.control-action, .control-choice, .btn, .icon-btn, .text-btn, .pill, .device-summary, .catalog-copy-diagnostics,
    .defconfig-switch, .menuconfig-toggle, .menuconfig-back, .menuconfig-selected-toggle, .build-contract-selected-filter):active:not(:disabled) {
    transform: none;
  }
}
'''
css = css.rstrip() + control_css + '\n'

needle = "  'shared light/dark selectable-card template, elevation, press feedback, disabled flattening, or reduced-motion fallback regressed');\n"
if test.count(needle) != 1:
    raise SystemExit(f'UI contract insertion anchor count={test.count(needle)}')
control_test = r'''
expect(css.includes('/* 统一交互控件立体模板 / shared elevated interactive-control template */') &&
  css.includes('--control-border: color-mix(in srgb, var(--border) 52%, #91a0b4 48%);') &&
  css.includes('--control-shadow: 0 1px 1px rgba(15, 23, 42, .08), 0 3px 7px rgba(55, 75, 104, .13)') &&
  (css.match(/--control-shadow: 0 1px 2px rgba\(0, 0, 0, \.24\), 0 5px 12px rgba\(0, 0, 0, \.18\);/g) || []).length >= 2 &&
  css.includes('/* 标准交互控件模板：以后新增输入/下拉/按钮/选择框优先复用 .control-field / .control-action / .control-choice */') &&
  css.includes(':where(.control-field, input[type="search"], input[type="text"], input[type="password"], input[type="number"], select, textarea) {') &&
  css.includes('.control-action, .control-choice, .btn, .icon-btn, .text-btn, .pill, .device-summary, .catalog-copy-diagnostics,') &&
  css.includes('transform: translateY(var(--control-lift));') &&
  css.includes('.defconfig-switch:has(input:checked),') &&
  css.includes('.build-contract-selected-filter:has(input:checked),') &&
  css.includes('.pill-active,') &&
  css.includes('.build-contract-head {') &&
  css.includes('.btn-primary:active { transform: translateY(0);') &&
  css.includes(':where(.defconfig-switch, .build-contract-selected-filter, .adv-toggle) input[type="checkbox"] {') &&
  css.includes('box-shadow: none;\n  transform: none;\n  cursor: not-allowed;') &&
  css.includes('@media (prefers-reduced-motion: reduce) {'),
  'shared light/dark form-control template, elevation, selected states, checkbox treatment, disabled flattening, or reduced-motion fallback regressed');
'''
test = test.replace(needle, needle + control_test, 1)

css_path.write_text(css, encoding='utf-8')
test_path.write_text(test, encoding='utf-8')
print('E elevated control template applied')
