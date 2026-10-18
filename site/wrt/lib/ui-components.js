/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import './compatibility-recommendation-ui.js';

function addClassNames(element, ...names) {
  for (const name of names.flatMap((value) => String(value || '').split(/\s+/)).filter(Boolean)) {
    element.classList.add(name);
  }
  return element;
}

function loadComponentStyles() {
  if (typeof document === 'undefined' || document.querySelector('link[data-ui-components-style]')) return;
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  const url = new URL('../ui-components.css', import.meta.url);
  url.search = new URL(import.meta.url).search;
  stylesheet.href = url.href;
  stylesheet.dataset.uiComponentsStyle = '';
  document.head.appendChild(stylesheet);
}
loadComponentStyles();

// Equal columns are the default. Borrow only spare width for a selected value
// that would be clipped, then wrap if all preferred widths cannot fit together.
export function fitUiContentColumns(preferred, available, maxColumns = preferred.length, gap = 10) {
  let count = Math.max(1, Math.min(preferred.length, Math.floor(maxColumns) || 1));
  let needs, budget;
  do {
    needs = Array.from({ length: count }, (_, column) => Math.max(0,
      ...preferred.filter((_, index) => index % count === column)));
    budget = Math.max(0, available - gap * (count - 1));
    if (count === 1 || needs.reduce((sum, value) => sum + value, 0) <= budget) break;
    count = Math.ceil(count / 2);
  } while (count > 0);
  const equal = budget / count;
  const demand = needs.reduce((sum, value) => sum + Math.max(0, value - equal), 0);
  const spare = needs.reduce((sum, value) => sum + Math.max(0, equal - value), 0);
  return needs.map(value => value > equal ? Math.min(value, budget)
    : equal - (spare ? demand * (equal - value) / spare : 0));
}

export function createUiContentFitGrid(grid) {
  const context = document.createElement('canvas').getContext('2d');
  let frame = 0;
  const measure = (text, element) => {
    const style = getComputedStyle(element);
    context.font = style.font;
    return context.measureText(text).width + Math.max(0, text.length - 1) * (parseFloat(style.letterSpacing) || 0);
  };
  const render = () => {
    frame = 0;
    if (!grid?.getClientRects().length || !grid.clientWidth) return;
    const style = getComputedStyle(grid);
    const preferred = [...grid.children].map(field => {
      const control = field.querySelector('input,select');
      const controlStyle = getComputedStyle(control);
      const text = control.tagName === 'SELECT' ? control.selectedOptions[0]?.textContent || '' : control.value;
      const padding = ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth']
        .reduce((sum, key) => sum + (parseFloat(controlStyle[key]) || 0), 0);
      return Math.ceil(Math.max(measure(field.firstElementChild.textContent, field.firstElementChild),
        measure(text, control) + padding + 28));
    });
    const widths = fitUiContentColumns(preferred, grid.clientWidth,
      parseInt(style.getPropertyValue('--content-fit-count'), 10), parseFloat(style.columnGap) || 0);
    const columns = widths.map(width => `${width.toFixed(2)}px`).join(' ');
    if (grid.style.getPropertyValue('--content-fit-columns') !== columns) grid.style.setProperty('--content-fit-columns', columns);
  };
  const update = () => { if (!frame) frame = requestAnimationFrame(render); };
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
  const mutations = new MutationObserver(update);
  resize?.observe(grid);
  mutations.observe(grid, { childList: true, subtree: true, characterData: true });
  grid.addEventListener('change', update);
  document.addEventListener('wrt:typography-change', update);
  window.addEventListener('resize', update, { passive: true });
  document.fonts?.ready.then(update);
  update();
  return { update, destroy() {
    resize?.disconnect(); mutations.disconnect(); cancelAnimationFrame(frame);
    grid.removeEventListener('change', update);
    document.removeEventListener('wrt:typography-change', update);
    window.removeEventListener('resize', update);
  } };
}

export function createUiActionRow(className = '') {
  const row = document.createElement('div');
  addClassNames(row, 'ui-action-row', className);
  return row;
}

// Reusable modal shell: a bounded scroll region and a non-scrolling footer.
// Call after rendering content. Re-renderers already clear modalBody.
export function mountUiModalActions(body, actions) {
  const content = document.createElement('div');
  content.className = 'modal-scroll-content';
  while (body.firstChild) content.appendChild(body.firstChild);
  body.replaceChildren(content, actions);
}

export function createUiButton({ text = '', className = 'btn', title = '', onClick = null } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  addClassNames(button, 'ui-button', className);
  button.textContent = String(text);
  if (title) button.dataset.uiTooltipBody = String(title);
  if (typeof onClick === 'function') button.addEventListener('click', onClick);
  return button;
}

// Presentation only: every caller supplies constraints from the same Catalog engine.
export function updateUiKconfigStateControl(root, { value, constraints, bindTooltip } = {}) {
  for (const button of root.querySelectorAll('button[data-value]')) {
    const state = constraints.states.find((item) => item.value === button.dataset.value);
    const active = value === button.dataset.value;
    button.classList.toggle('is-current', active);
    button.classList.toggle('is-editable', Boolean(state?.selectable));
    button.classList.toggle('is-disabled', !state?.selectable);
    button.classList.toggle('is-locked', Boolean(active && state?.locked));
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-disabled', String(!state?.selectable));
    button.textContent = button.dataset.value.toUpperCase();
    if (active && state?.locked) {
      const lock = document.createElement('span');
      lock.className = 'kconfig-state-lock'; lock.textContent = '🔒';
      lock.setAttribute('aria-hidden', 'true'); button.appendChild(lock);
    }
    bindTooltip?.(button, button.dataset.value, constraints);
  }
}

export function createUiKconfigStateControl({ type, value, constraints, className = 'catalog-conflict-state',
  bindTooltip, onChange, onUnavailable } = {}) {
  const root = document.createElement('span'); root.className = className;
  for (const stateValue of ['n', 'm', 'y']) {
    if (type === 'bool' && stateValue === 'm') {
      const spacer = document.createElement('span'); spacer.className = 'kconfig-state-spacer';
      spacer.setAttribute('aria-hidden', 'true'); root.appendChild(spacer); continue;
    }
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'kconfig-state'; button.dataset.value = stateValue;
    button.onclick = (event) => {
      if (button.getAttribute('aria-disabled') === 'true') {
        event.preventDefault(); onUnavailable?.(button, event); return;
      }
      if (button.getAttribute('aria-pressed') !== 'true') onChange?.(stateValue);
    };
    root.appendChild(button);
  }
  updateUiKconfigStateControl(root, { value, constraints, bindTooltip });
  return root;
}

export function createUiConfigurationReview({ title, changes = [], automaticTitle, formatSymbol, formatValue, formatKind } = {}) {
  const section = document.createElement('section'); section.className = 'configuration-review';
  const heading = document.createElement('strong'); heading.textContent = title; section.appendChild(heading);
  const appendRow = (host, change) => {
    const row = document.createElement('div'); row.className = 'configuration-review-row';
    const name = document.createElement('code'); name.textContent = formatSymbol(change.symbol);
    const values = document.createElement('span');
    values.textContent = `${formatValue(change.from)} → ${formatValue(change.to)}`;
    const kind = document.createElement('small'); kind.textContent = formatKind(change);
    row.append(name, values, kind); host.appendChild(row);
  };
  for (const change of changes.filter(row => !automaticTitle || !row.automatic)) appendRow(section, change);
  const automatic = automaticTitle ? changes.filter(row => row.automatic) : [];
  if (automatic.length) {
    const details = document.createElement('details'); details.className = 'configuration-review-automatic';
    const summary = document.createElement('summary'); summary.textContent = `${automaticTitle} · ${automatic.length}`;
    details.appendChild(summary);
    for (const change of automatic) appendRow(details, change);
    section.appendChild(details);
  }
  return section;
}

export function createUiCheckboxControl({
  label = '', className = '', checked = false, tooltipTitle = '', tooltipBody = '', onChange = null,
} = {}) {
  const root = document.createElement('label');
  addClassNames(root, 'ui-checkbox-control', className);
  if (tooltipTitle) root.dataset.uiTooltipTitle = String(tooltipTitle);
  if (tooltipBody) root.dataset.uiTooltipBody = String(tooltipBody);
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked === true;
  if (typeof onChange === 'function') input.addEventListener('change', () => onChange(input.checked, input));
  const text = document.createElement('span');
  text.className = 'ui-checkbox-label';
  text.textContent = String(label);
  root.append(input, text);
  return { root, input, text };
}
