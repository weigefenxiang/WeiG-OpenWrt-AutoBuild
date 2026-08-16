/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

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

export function createUiActionRow(className = '') {
  const row = document.createElement('div');
  addClassNames(row, 'ui-action-row', className);
  return row;
}

export function createUiButton({ text = '', className = 'btn', title = '', onClick = null } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  addClassNames(button, 'ui-button', className);
  button.textContent = String(text);
  if (title) button.title = String(title);
  if (typeof onClick === 'function') button.addEventListener('click', onClick);
  return button;
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
