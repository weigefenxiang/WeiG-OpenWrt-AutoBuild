/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Shared UI feedback presentation. The main app keeps business orchestration;
 * this layer standardizes lightweight notices and legacy confirmation routing.
 */
'use strict';

(() => {
  const moduleUrl = new URL(import.meta.url);
  const styleUrl = new URL('../ui-feedback.css', moduleUrl);
  styleUrl.search = moduleUrl.search;
  if (!document.querySelector('link[data-ui-feedback-style]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = styleUrl.href;
    stylesheet.dataset.uiFeedbackStyle = '';
    document.head.appendChild(stylesheet);
  }

  const toast = document.getElementById('toast');
  if (!toast || typeof showToast !== 'function' || typeof openModal !== 'function' || typeof closeModal !== 'function') return;

  const ICONS = Object.freeze({ success: '✓', info: 'i', warning: '!', error: '×' });
  const legacyShowToast = showToast;
  const nativeConfirm = globalThis.confirm.bind(globalThis);
  let replayingLegacyConfirm = false;
  let activeInteraction = null;

  function text(zhCN, zhTW, en) {
    return typeof uiText === 'function' ? uiText(zhCN, zhTW, en) : en;
  }

  function noticeTitle(kind) {
    if (kind === 'success') return text('完成', '完成', 'Done');
    if (kind === 'warning') return text('请注意', '請注意', 'Attention');
    if (kind === 'error') return text('操作失败', '操作失敗', 'Action failed');
    return text('提示', '提示', 'Notice');
  }

  function importedConfigPresentation(message) {
    if (typeof t !== 'function') return null;
    const marker = '__WEIG_CONFIG_ID__';
    const template = String(t('import.ok', { id: marker }) || '');
    const split = template.split(marker);
    if (split.length !== 2 || !message.startsWith(split[0]) || !message.endsWith(split[1])) return null;
    const source = state?.source?.label || state?.source?.id || '';
    const branch = state?.version?.branch || state?.version?.id || '';
    const target = state?.device?.target;
    const system = [target?.system, target?.subtarget].filter(Boolean).join('/');
    const profile = target?.profileLabel || target?.profile || '';
    const title = template.replace(marker, '').replace(/[：:]\s*$/, '').trim() || noticeTitle('success');
    return { title, detail: [source, branch, system, profile].filter(Boolean).join(' · ') || message };
  }

  function renderNotice(message, options = {}) {
    const settings = typeof options === 'string' ? { kind: options } : (options || {});
    const legacyKind = settings.kind === 'device' ? 'success' : settings.kind;
    const kind = Object.hasOwn(ICONS, legacyKind) ? legacyKind : 'info';
    const raw = String(message ?? '').trim();
    const imported = importedConfigPresentation(raw);
    const detail = String(settings.detail ?? imported?.detail ?? raw).trim();
    const title = String(settings.title || imported?.title || noticeTitle(kind)).trim();

    legacyShowToast(detail, '');
    toast.classList.remove('toast-device');
    toast.dataset.kind = kind;
    toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');

    const icon = document.createElement('span');
    icon.className = 'notice-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = ICONS[kind];
    const content = document.createElement('span');
    content.className = 'notice-content';
    const heading = document.createElement('strong');
    heading.className = 'notice-title';
    heading.textContent = title;
    const body = document.createElement('span');
    body.className = 'notice-detail';
    body.textContent = detail;
    content.append(heading, body);
    toast.replaceChildren(icon, content);

    clearTimeout(toastTimer);
    const duration = Number(settings.duration) > 0 ? Number(settings.duration) : (kind === 'error' ? 4600 : 3200);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show', 'toast-device');
      toast.hidden = true;
    }, duration);
  }

  showToast = (message, kind = '') => renderNotice(message, { kind: kind || 'info' });
  globalThis.showNotice = renderNotice;
  globalThis.alert = (message) => renderNotice(message, { kind: 'warning' });

  globalThis.confirmModal = (message, options = {}) => new Promise((resolve) => {
    const title = options.title || text('确认操作', '確認操作', 'Confirm action');
    const confirmText = options.confirmText || text('继续', '繼續', 'Continue');
    const cancelText = options.cancelText || text('取消', '取消', 'Cancel');
    let settled = false;
    const modal = document.getElementById('modal')?.querySelector('.modal');
    const body = document.getElementById('modalBody');
    if (!modal || !body) { resolve(nativeConfirm(String(message || ''))); return; }

    const cleanup = () => modal.classList.remove('confirm-dialog');
    const finish = (value) => {
      if (settled) return;
      settled = true;
      modalCancelHandler = null;
      cleanup();
      closeModal();
      resolve(value);
    };
    modalCancelHandler = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(false);
    };

    openModal(title);
    modal.classList.add('confirm-dialog');
    body.textContent = '';
    const paragraph = document.createElement('p');
    paragraph.className = 'confirm-dialog-message';
    paragraph.textContent = String(message || '');
    const actions = document.createElement('div');
    actions.className = 'modal-actions confirm-dialog-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn';
    cancel.textContent = cancelText;
    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.className = options.danger ? 'btn btn-danger' : 'btn btn-primary';
    confirmButton.textContent = confirmText;
    cancel.addEventListener('click', () => finish(false));
    confirmButton.addEventListener('click', () => finish(true));
    actions.append(cancel, confirmButton);
    body.append(paragraph, actions);
    confirmButton.focus();
  });

  const interactionTypes = ['click', 'change', 'submit'];
  for (const type of interactionTypes) {
    document.addEventListener(type, (event) => {
      if (replayingLegacyConfirm) return;
      const target = event.target instanceof Element ? event.target : null;
      activeInteraction = {
        event,
        type,
        target,
        id: target?.id || '',
        value: target && 'value' in target ? target.value : undefined,
        checked: target && 'checked' in target ? target.checked : undefined,
      };
      queueMicrotask(() => {
        if (activeInteraction?.event === event) activeInteraction = null;
      });
    }, true);
  }

  globalThis.confirm = (message) => {
    if (replayingLegacyConfirm) return true;
    const interaction = activeInteraction;
    if (!interaction) return nativeConfirm(message);
    void globalThis.confirmModal(message).then((accepted) => {
      if (!accepted) return;
      const target = (interaction.id && document.getElementById(interaction.id)) ||
        (interaction.target?.isConnected ? interaction.target : null);
      if (!target) return;
      if (interaction.value !== undefined && 'value' in target) target.value = interaction.value;
      if (interaction.checked !== undefined && 'checked' in target) target.checked = interaction.checked;
      replayingLegacyConfirm = true;
      try {
        target.dispatchEvent(new Event(interaction.type, { bubbles: true, cancelable: true }));
      } finally {
        replayingLegacyConfirm = false;
      }
    });
    return false;
  };
})();
