from pathlib import Path

css_path = Path('site/wrt/app.css')
css = css_path.read_text().replace('\r\n', '\n').replace('\r', '\n')

root_old = '''  --plugin-muted: #f3f5f8;
  --radius: 10px;
'''
root_new = '''  --plugin-muted: #f3f5f8;
  /* 可勾选卡片立体模板 / shared selectable-card elevation template */
  --select-card-highlight: rgba(255, 255, 255, .98);
  --select-card-border: color-mix(in srgb, var(--border) 46%, #8ea0b7 54%);
  --select-card-surface-top: color-mix(in srgb, var(--plugin-item) 76%, #fff 24%);
  --select-card-surface-bottom: color-mix(in srgb, var(--plugin-item) 90%, #cfd9e6 10%);
  --select-card-hover-top: color-mix(in srgb, var(--plugin-hover) 72%, #fff 28%);
  --select-card-hover-bottom: color-mix(in srgb, var(--plugin-hover) 88%, #c8d5e6 12%);
  --select-card-selected-top: color-mix(in srgb, var(--plugin-selected) 78%, #fff 22%);
  --select-card-selected-bottom: color-mix(in srgb, var(--plugin-selected) 90%, #b8cdf0 10%);
  --select-card-shadow: 0 1px 1px rgba(15, 23, 42, .10), 0 4px 9px rgba(55, 75, 104, .15), 0 10px 22px rgba(55, 75, 104, .08);
  --select-card-shadow-hover: 0 2px 2px rgba(15, 23, 42, .11), 0 7px 14px rgba(55, 75, 104, .18), 0 14px 26px rgba(55, 75, 104, .10);
  --select-card-shadow-selected: 0 5px 12px rgba(37, 99, 235, .20), 0 12px 24px rgba(37, 99, 235, .12);
  --select-card-lift: -1px;
  --radius: 10px;
'''
if css.count(root_old) != 1:
    raise SystemExit(f'light selectable-card token anchor count={css.count(root_old)}')
css = css.replace(root_old, root_new, 1)

dark_old = '''  --plugin-muted: #1d2430;
  --shadow: none;
'''
dark_new = '''  --plugin-muted: #1d2430;
  --select-card-highlight: rgba(255, 255, 255, .075);
  --select-card-border: color-mix(in srgb, var(--border) 72%, var(--text3));
  --select-card-surface-top: color-mix(in srgb, var(--plugin-item) 92%, #fff 8%);
  --select-card-surface-bottom: color-mix(in srgb, var(--plugin-item) 96%, var(--bg) 4%);
  --select-card-hover-top: color-mix(in srgb, var(--plugin-hover) 90%, #fff 10%);
  --select-card-hover-bottom: color-mix(in srgb, var(--plugin-hover) 96%, var(--bg) 4%);
  --select-card-selected-top: color-mix(in srgb, var(--plugin-selected) 90%, #fff 10%);
  --select-card-selected-bottom: color-mix(in srgb, var(--plugin-selected) 96%, var(--bg) 4%);
  --select-card-shadow: 0 1px 2px rgba(0, 0, 0, .28), 0 6px 14px rgba(0, 0, 0, .22);
  --select-card-shadow-hover: 0 2px 3px rgba(0, 0, 0, .32), 0 10px 20px rgba(0, 0, 0, .28);
  --select-card-shadow-selected: 0 8px 18px rgba(0, 0, 0, .28), 0 0 14px color-mix(in srgb, var(--accent) 18%, transparent);
  --select-card-lift: -1px;
  --shadow: none;
'''
if css.count(dark_old) != 1:
    raise SystemExit(f'explicit dark selectable-card token anchor count={css.count(dark_old)}')
css = css.replace(dark_old, dark_new, 1)
auto_dark_old = dark_old.replace('  --', '    --')
auto_dark_new = dark_new.replace('  --', '    --')
if css.count(auto_dark_old) != 1:
    raise SystemExit(f'auto dark selectable-card token anchor count={css.count(auto_dark_old)}')
css = css.replace(auto_dark_old, auto_dark_new, 1)

local_tokens = '''.plugin-grid {
  --plugin-card-highlight: rgba(255, 255, 255, .68);
  --plugin-card-shadow: 0 1px 2px rgba(16, 24, 40, .08), 0 5px 12px rgba(16, 24, 40, .10);
  --plugin-card-shadow-hover: 0 2px 3px rgba(16, 24, 40, .10), 0 9px 18px rgba(16, 24, 40, .13);
  --plugin-card-shadow-selected: 0 7px 16px rgba(37, 99, 235, .16);
}
html[data-theme="dark"] .plugin-grid {
  --plugin-card-highlight: rgba(255, 255, 255, .075);
  --plugin-card-shadow: 0 1px 2px rgba(0, 0, 0, .28), 0 6px 14px rgba(0, 0, 0, .22);
  --plugin-card-shadow-hover: 0 2px 3px rgba(0, 0, 0, .32), 0 10px 20px rgba(0, 0, 0, .28);
  --plugin-card-shadow-selected: 0 8px 18px rgba(0, 0, 0, .28), 0 0 14px color-mix(in srgb, var(--accent) 18%, transparent);
}
@media (prefers-color-scheme: dark) {
  html:not([data-theme]) .plugin-grid {
    --plugin-card-highlight: rgba(255, 255, 255, .075);
    --plugin-card-shadow: 0 1px 2px rgba(0, 0, 0, .28), 0 6px 14px rgba(0, 0, 0, .22);
    --plugin-card-shadow-hover: 0 2px 3px rgba(0, 0, 0, .32), 0 10px 20px rgba(0, 0, 0, .28);
    --plugin-card-shadow-selected: 0 8px 18px rgba(0, 0, 0, .28), 0 0 14px color-mix(in srgb, var(--accent) 18%, transparent);
  }
}
'''
if css.count(local_tokens) != 1:
    raise SystemExit(f'legacy plugin elevation block count={css.count(local_tokens)}')
css = css.replace(local_tokens, '')

replacements = {
    'border: 1px solid color-mix(in srgb, var(--border) 72%, var(--text3));': 'border: 1px solid var(--select-card-border);',
    '''background: linear-gradient(180deg,
    color-mix(in srgb, var(--plugin-item) 92%, #fff 8%) 0%,
    var(--plugin-item) 38%,
    color-mix(in srgb, var(--plugin-item) 96%, var(--bg) 4%) 100%);''': '''background: linear-gradient(180deg,
    var(--select-card-surface-top) 0%,
    var(--plugin-item) 38%,
    var(--select-card-surface-bottom) 100%);''',
    'box-shadow: inset 0 1px 0 var(--plugin-card-highlight), var(--plugin-card-shadow);': 'box-shadow: inset 0 1px 0 var(--select-card-highlight), var(--select-card-shadow);',
    '''background: linear-gradient(180deg,
    color-mix(in srgb, var(--plugin-hover) 90%, #fff 10%) 0%,
    var(--plugin-hover) 42%,
    color-mix(in srgb, var(--plugin-hover) 96%, var(--bg) 4%) 100%);''': '''background: linear-gradient(180deg,
    var(--select-card-hover-top) 0%,
    var(--plugin-hover) 42%,
    var(--select-card-hover-bottom) 100%);''',
    'box-shadow: inset 0 1px 0 var(--plugin-card-highlight), var(--plugin-card-shadow-hover);': 'box-shadow: inset 0 1px 0 var(--select-card-highlight), var(--select-card-shadow-hover);',
    'transform: translateY(-1px);': 'transform: translateY(var(--select-card-lift));',
    '''background: linear-gradient(180deg,
    color-mix(in srgb, var(--plugin-selected) 90%, #fff 10%) 0%,
    var(--plugin-selected) 44%,
    color-mix(in srgb, var(--plugin-selected) 96%, var(--bg) 4%) 100%);''': '''background: linear-gradient(180deg,
    var(--select-card-selected-top) 0%,
    var(--plugin-selected) 44%,
    var(--select-card-selected-bottom) 100%);''',
    'box-shadow: inset 0 1px 0 var(--plugin-card-highlight),\n    0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent),\n    var(--plugin-card-shadow-selected);': 'box-shadow: inset 0 1px 0 var(--select-card-highlight),\n    0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent),\n    var(--select-card-shadow-selected);',
}
for old, new in replacements.items():
    count = css.count(old)
    if count < 1:
        raise SystemExit(f'missing selectable-card CSS fragment: {old[:70]!r}')
    css = css.replace(old, new)
css_path.write_text(css)

test_path = Path('tools/test-catalog-ui-contract.mjs')
test = test_path.read_text()
old_test = '''expect(css.includes('--plugin-card-shadow: 0 1px 2px') &&
  css.includes('--plugin-card-shadow-hover: 0 2px 3px') &&
  css.includes('--plugin-card-shadow-selected: 0 7px 16px') &&
  css.includes('.plugin:not(.plugin-disabled):not(.plugin-loading):hover {') &&
  css.includes('transform: translateY(-1px);') &&
  css.includes('.plugin:not(.plugin-disabled):not(.plugin-loading):active {') &&
  css.includes('box-shadow: inset 0 1px 0 var(--plugin-card-highlight), var(--plugin-card-shadow);') &&
  css.includes('.plugin-disabled, .plugin-disabled:hover {') &&
  css.includes('box-shadow: none;') &&
  css.includes('@media (prefers-reduced-motion: reduce) {'),
  'plugin card elevation, press feedback, disabled flattening, or reduced-motion fallback regressed');'''
new_test = r'''expect(css.includes('/* 可勾选卡片立体模板 / shared selectable-card elevation template */') &&
  css.includes('--select-card-border: color-mix(in srgb, var(--border) 46%, #8ea0b7 54%);') &&
  css.includes('--select-card-shadow: 0 1px 1px rgba(15, 23, 42, .10), 0 4px 9px rgba(55, 75, 104, .15)') &&
  css.includes('--select-card-shadow-hover: 0 2px 2px rgba(15, 23, 42, .11), 0 7px 14px rgba(55, 75, 104, .18)') &&
  css.includes('--select-card-shadow-selected: 0 5px 12px rgba(37, 99, 235, .20)') &&
  (css.match(/--select-card-shadow: 0 1px 2px rgba\(0, 0, 0, \.28\), 0 6px 14px rgba\(0, 0, 0, \.22\);/g) || []).length >= 2 &&
  css.includes('border: 1px solid var(--select-card-border);') &&
  css.includes('var(--select-card-surface-top) 0%') &&
  css.includes('var(--select-card-hover-top) 0%') &&
  css.includes('var(--select-card-selected-top) 0%') &&
  css.includes('.plugin:not(.plugin-disabled):not(.plugin-loading):hover {') &&
  css.includes('transform: translateY(var(--select-card-lift));') &&
  css.includes('.plugin:not(.plugin-disabled):not(.plugin-loading):active {') &&
  css.includes('box-shadow: inset 0 1px 0 var(--select-card-highlight), var(--select-card-shadow);') &&
  css.includes('.plugin-disabled, .plugin-disabled:hover {') &&
  css.includes('box-shadow: none;') &&
  css.includes('@media (prefers-reduced-motion: reduce) {'),
  'shared light/dark selectable-card template, elevation, press feedback, disabled flattening, or reduced-motion fallback regressed');'''
if test.count(old_test) != 1:
    raise SystemExit(f'plugin elevation test anchor count={test.count(old_test)}')
test = test.replace(old_test, new_test, 1)
old_boundary = "css.includes('border: 1px solid color-mix(in srgb, var(--border) 72%, var(--text3));')"
new_boundary = "css.includes('border: 1px solid var(--select-card-border);')"
if test.count(old_boundary) != 1:
    raise SystemExit(f'independent plugin card border contract count={test.count(old_boundary)}')
test_path.write_text(test.replace(old_boundary, new_boundary, 1))
