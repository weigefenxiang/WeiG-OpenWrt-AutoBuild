/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function createBuildContractUi({ get } = {}) {
  if (typeof get !== 'function') throw new Error('build contract UI requires an element getter');
  let expanded = false;
  let initialized = false;

  const renderList = (element, model = {}) => {
    if (!element) return;
    element.textContent = '';
    const heading = document.createElement('strong');
    heading.textContent = String(model.title || '');
    element.appendChild(heading);
    const content = document.createElement('div');
    content.className = 'build-contract-chips';
    const items = Array.isArray(model.items) ? model.items : [];
    if (!items.length) {
      const none = document.createElement('span');
      none.className = 'hint';
      none.textContent = String(model.empty || '');
      content.appendChild(none);
    } else {
      for (const item of items) {
        const chip = document.createElement('code');
        chip.className = 'build-contract-chip';
        chip.textContent = String(item);
        chip.title = String(item);
        content.appendChild(chip);
      }
    }
    element.appendChild(content);
  };

  const renderProfilePackages = (element, model = {}) => {
    if (!element) return;
    element.textContent = '';
    const head = document.createElement('div');
    head.className = 'build-contract-list-head';
    const title = document.createElement('strong');
    title.textContent = String(model.title || '');
    const manage = document.createElement('button');
    manage.type = 'button';
    manage.className = 'text-btn profile-package-manage';
    manage.textContent = String(model.manageLabel || '');
    if (typeof model.onManage === 'function') manage.addEventListener('click', model.onManage);
    head.append(title, manage);
    element.appendChild(head);
    const content = document.createElement('div');
    content.className = 'build-contract-chips';
    const rows = Array.isArray(model.rows) ? model.rows : [];
    if (!rows.length) {
      const none = document.createElement('span');
      none.className = 'hint';
      none.textContent = String(model.empty || '');
      content.appendChild(none);
    } else {
      for (const row of rows) {
        const chip = document.createElement('code');
        const mode = ['follow', 'include', 'exclude'].includes(row.mode) ? row.mode : 'follow';
        chip.className = 'build-contract-chip profile-package-chip mode-' + mode;
        const upstream = row.upstream === 'exclude' ? '−' : '+';
        const explicit = mode === 'follow' ? '' : mode === 'include' ? ' → +' : ' → −';
        chip.textContent = upstream + String(row.name || '') + explicit;
        chip.title = String(row.name || '') + '\n' + String(model.help || '');
        content.appendChild(chip);
      }
    }
    element.appendChild(content);
  };

  const setExpanded = (value) => {
    expanded = value === true;
    const toggle = get('buildContractToggle');
    const body = get('buildContractBody');
    if (!toggle || !body) return;
    toggle.setAttribute('aria-expanded', String(expanded));
    body.hidden = !expanded;
  };

  const init = () => {
    if (initialized) return;
    initialized = true;
    const toggle = get('buildContractToggle');
    if (!toggle) return;
    setExpanded(false);
    toggle.addEventListener('click', () => setExpanded(!expanded));
  };

  const render = (model = {}) => {
    init();
    const box = get('buildContract');
    const controls = get('buildContractControls');
    if (!box || !controls) return;
    if (model.visible !== true) {
      box.hidden = true;
      controls.hidden = true;
      return;
    }
    const title = String(model.title || '');
    const titleNode = get('buildContractTitle');
    const toggle = get('buildContractToggle');
    const grid = get('buildContractGrid');
    if (!titleNode || !toggle || !grid) return;
    titleNode.textContent = title;
    toggle.title = String(model.commitHint || '');
    toggle.setAttribute('aria-label', title + '; ' + String(model.commitHint || ''));
    grid.textContent = '';
    for (const [label, value] of Array.isArray(model.rows) ? model.rows : []) {
      const row = document.createElement('div');
      row.className = 'build-contract-row';
      const key = document.createElement('span');
      key.className = 'build-contract-key';
      key.textContent = String(label);
      const result = document.createElement('code');
      result.textContent = String(value);
      result.title = String(value);
      row.append(key, result);
      grid.appendChild(row);
    }
    renderProfilePackages(get('buildContractProfilePackages'), model.profilePackages);
    renderList(get('buildContractSelection'), model.selection);
    setExpanded(expanded);
    box.hidden = false;
    controls.hidden = false;
  };

  return Object.freeze({ init, render, setExpanded });
}
