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

  const modalMask = document.getElementById('modal');
  let backdropPointerDown = false;
  if (modalMask) {
    modalMask.addEventListener('pointerdown', (event) => {
      backdropPointerDown = event.target === modalMask;
    }, true);
    modalMask.addEventListener('pointercancel', () => { backdropPointerDown = false; }, true);
    modalMask.addEventListener('click', (event) => {
      if (event.target !== modalMask) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    modalMask.addEventListener('dblclick', (event) => {
      if (!backdropPointerDown || event.target !== modalMask) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      backdropPointerDown = false;
      closeModal();
    }, true);
  }

  globalThis.createFloatingLayerController = (anchor, layer, options = {}) => {
    if (!(anchor instanceof Element) || !(layer instanceof HTMLElement)) return null;
    const originParent = layer.parentNode;
    const originNext = layer.nextSibling;
    const inferredDropdown = anchor.matches('summary') || anchor.getAttribute('role') === 'combobox' ||
      anchor.getAttribute('aria-haspopup') === 'listbox';
    const preset = options.preset || (inferredDropdown ? 'dropdown' : 'floating');
    const margin = Math.max(4, Number(options.margin) || 8);
    const gap = Math.max(0, Number(options.gap) || 5);
    const minWidth = Math.max(0, Number(options.minWidth) || 0);
    const maxWidth = Math.max(0, Number(options.maxWidth) || 0);
    const fitContent = options.fitContent ?? preset === 'dropdown';
    const portal = options.portal !== false;
    const preferredHeight = Math.max(120, Number(options.preferredHeight) || 320);
    const ownerModal = anchor.closest('.modal-mask');
    let open = false;
    let raf = 0;
    let ownerObserver = null;

    const resolveBoundary = () => {
      let boundary = options.boundary;
      if (typeof boundary === 'function') boundary = boundary(anchor, layer);
      if (typeof boundary === 'string') boundary = anchor.closest(boundary) || document.querySelector(boundary);
      if (boundary instanceof Element) return boundary;
      return anchor.closest('[data-floating-boundary]') || anchor.closest('.modal') || null;
    };
    const restore = () => {
      if (!originParent) return;
      const before = originNext?.parentNode === originParent ? originNext : null;
      originParent.insertBefore(layer, before);
      for (const property of [
        'position', 'z-index', 'box-sizing', 'left', 'right', 'top', 'bottom',
        'width', 'min-width', 'max-width', 'max-height',
      ]) layer.style.removeProperty(property);
      layer.classList.remove('ui-floating-layer', 'ui-floating-dropdown');
    };
    const naturalLayerWidth = () => {
      if (!fitContent) return 0;
      layer.style.width = 'max-content';
      layer.style.minWidth = '0';
      layer.style.maxWidth = 'none';
      return Math.ceil(Math.max(layer.scrollWidth, layer.getBoundingClientRect().width));
    };
    const position = () => {
      raf = 0;
      if (!open || !anchor.isConnected || !layer.isConnected) return;
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const rect = anchor.getBoundingClientRect();
      const viewportLeft = margin;
      const viewportRight = Math.max(viewportLeft, viewportWidth - margin);
      let boundaryLeft = viewportLeft;
      let boundaryRight = viewportRight;
      const boundary = resolveBoundary();
      if (boundary) {
        const boundaryRect = boundary.getBoundingClientRect();
        const candidateLeft = Math.max(viewportLeft, boundaryRect.left + margin);
        const candidateRight = Math.min(viewportRight, boundaryRect.right - margin);
        if (candidateRight > candidateLeft) {
          boundaryLeft = candidateLeft;
          boundaryRight = candidateRight;
        }
      }
      const availableWidth = Math.max(0, boundaryRight - boundaryLeft);
      layer.style.position = 'fixed';
      layer.style.boxSizing = 'border-box';
      layer.style.zIndex = String(Number(options.zIndex) || 70);
      const naturalWidth = naturalLayerWidth();
      const allowedWidth = maxWidth > 0 ? Math.min(availableWidth, maxWidth) : availableWidth;
      const width = Math.min(Math.max(rect.width, minWidth, naturalWidth), allowedWidth);
      const below = Math.max(0, viewportHeight - rect.bottom - gap - margin);
      const above = Math.max(0, rect.top - gap - margin);
      const useBelow = below >= Math.min(preferredHeight, above) || below >= above;
      const available = Math.max(0, useBelow ? below : above);
      const left = Math.min(
        Math.max(boundaryLeft, rect.left),
        Math.max(boundaryLeft, boundaryRight - width),
      );
      layer.style.left = `${left}px`;
      layer.style.right = 'auto';
      layer.style.width = `${width}px`;
      layer.style.minWidth = '0';
      layer.style.maxWidth = `${allowedWidth}px`;
      layer.style.maxHeight = `${available}px`;
      layer.style.top = useBelow ? `${rect.bottom + gap}px` : 'auto';
      layer.style.bottom = useBelow ? 'auto' : `${viewportHeight - rect.top + gap}px`;
    };
    const schedulePosition = () => {
      if (!open || raf) return;
      raf = requestAnimationFrame(position);
    };
    const dismiss = () => {
      options.onDismiss?.();
      controller.close();
    };
    const outsidePointerDown = (event) => {
      if (anchor.contains(event.target) || layer.contains(event.target)) return;
      dismiss();
    };
    const controller = {
      open() {
        if (open) { schedulePosition(); return; }
        open = true;
        if (portal) document.body.appendChild(layer);
        layer.classList.add('ui-floating-layer');
        if (preset === 'dropdown') layer.classList.add('ui-floating-dropdown');
        layer.hidden = false;
        document.addEventListener('pointerdown', outsidePointerDown, true);
        document.addEventListener('scroll', schedulePosition, true);
        window.addEventListener('resize', schedulePosition);
        if (ownerModal) {
          ownerObserver = new MutationObserver(() => { if (ownerModal.hidden) dismiss(); });
          ownerObserver.observe(ownerModal, { attributes: true, attributeFilter: ['hidden'] });
        }
        position();
      },
      close() {
        if (!open) return;
        open = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        document.removeEventListener('pointerdown', outsidePointerDown, true);
        document.removeEventListener('scroll', schedulePosition, true);
        window.removeEventListener('resize', schedulePosition);
        ownerObserver?.disconnect();
        ownerObserver = null;
        layer.hidden = true;
        restore();
      },
      update: schedulePosition,
      get isOpen() { return open; },
    };
    layer.hidden = true;
    return controller;
  };

  const bindDeclaredFloatingDropdown = (anchor) => {
    if (!(anchor instanceof HTMLElement) || anchor.dataset.floatingDropdownBound === '1') return null;
    const controls = String(anchor.getAttribute('aria-controls') || '').trim();
    const layer = controls ? document.getElementById(controls) : null;
    if (!(layer instanceof HTMLElement)) return null;
    const controller = globalThis.createFloatingLayerController(anchor, layer, {
      preset: 'dropdown',
      portal: false,
      minWidth: Number(anchor.dataset.floatingMinWidth) || 0,
      maxWidth: Number(anchor.dataset.floatingMaxWidth) || 0,
      preferredHeight: Number(anchor.dataset.floatingHeight) || 320,
      onDismiss: () => {
        layer.hidden = true;
        anchor.setAttribute('aria-expanded', 'false');
      },
    });
    if (!controller) return null;
    anchor.dataset.floatingDropdownBound = '1';
    const sync = () => {
      if (layer.hidden) {
        controller.close();
        anchor.setAttribute('aria-expanded', 'false');
      } else {
        controller.open();
        anchor.setAttribute('aria-expanded', 'true');
      }
    };
    const observer = new MutationObserver((records) => {
      if (records.some((record) => record.type === 'attributes' && record.attributeName === 'hidden')) sync();
      else if (controller.isOpen) controller.update();
    });
    observer.observe(layer, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true, characterData: true });
    sync();
    return controller;
  };

  const bindDeclaredFloatingDropdowns = (root = document) => {
    for (const anchor of root.querySelectorAll('[data-floating-dropdown][aria-controls]')) bindDeclaredFloatingDropdown(anchor);
  };
  bindDeclaredFloatingDropdowns();
  globalThis.bindDeclaredFloatingDropdowns = bindDeclaredFloatingDropdowns;

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
