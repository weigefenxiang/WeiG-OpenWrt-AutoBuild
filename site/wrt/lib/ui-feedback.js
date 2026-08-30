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

  function projectNoticePrefix() {
    const project = typeof PROJECT !== 'undefined' && PROJECT && typeof PROJECT === 'object' ? PROJECT : null;
    return typeof project?.shortName === 'string' && project.shortName.trim() ? project.shortName.trim() : '';
  }

  function noticeTitle(kind) {
    const title = kind === 'success' ? t('runtime.0cab91c99de4')
      : kind === 'warning' ? t('runtime.f484416c890c')
        : kind === 'error' ? t('runtime.9f4e3cc54b49') : t('runtime.bb6a7a1f4169');
    const prefix = projectNoticePrefix();
    return prefix ? `${prefix} · ${title}` : title;
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
    const title = options.title || t('runtime.4434398a8687');
    const confirmText = options.confirmText || t('runtime.9906f10a8da3');
    const cancelText = options.cancelText || t('runtime.fa67f2c4dd9b');
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

  /*
   * Floating-layer sizing is a component contract, not a page-specific
   * override.  The wide filter and dock presets are intentionally small and
   * reusable; callers can still override any value for a different component.
   */
  const FLOATING_PRESETS = Object.freeze({
    dropdown: Object.freeze({ fitContent: true }),
    'wide-filter': Object.freeze({
      fitContent: false, minWidth: 520, maxWidth: 760,
      preferredHeight: (viewport) => Math.round(viewport.height * .78),
    }),
    'dock-panel': Object.freeze({
      fitContent: false, minWidth: 220, maxWidth: 320,
      preferredHeight: (viewport) => Math.min(420, Math.round(viewport.height * .72)),
      placements: ['left', 'above', 'right', 'below'], align: 'end',
    }),
    floating: Object.freeze({}),
  });

  const cssTimeMs = (value) => {
    const text = String(value || '').trim();
    if (!text) return 0;
    const number = Number.parseFloat(text);
    if (!Number.isFinite(number)) return 0;
    return text.endsWith('ms') ? number : number * 1000;
  };
  const maxCssMotionMs = (element) => {
    if (!(element instanceof Element) || typeof getComputedStyle !== 'function') return 0;
    const style = getComputedStyle(element);
    const maxPair = (duration, delay) => {
      const durations = String(duration || '').split(',').map(cssTimeMs);
      const delays = String(delay || '').split(',').map(cssTimeMs);
      return durations.reduce((max, item, index) => Math.max(max, item + (delays[index] || delays[delays.length - 1] || 0)), 0);
    };
    return Math.min(1000, Math.max(
      maxPair(style.animationDuration, style.animationDelay),
      maxPair(style.transitionDuration, style.transitionDelay),
    ));
  };

  globalThis.createFloatingLayerController = (anchor, layer, options = {}) => {
    if (!(anchor instanceof Element) || !(layer instanceof HTMLElement)) return null;
    const geometry = globalThis.__WEIG_VIEWPORT_GEOMETRY__;
    if (!geometry?.readViewportRect || !geometry?.calculateFloatingGeometry) return null;
    const originParent = layer.parentNode;
    const originNext = layer.nextSibling;
    const inferredDropdown = anchor.matches('summary') || anchor.getAttribute('role') === 'combobox' ||
      anchor.getAttribute('aria-haspopup') === 'listbox';
    const preset = String(options.preset || (inferredDropdown ? 'dropdown' : 'floating'));
    const presetConfig = FLOATING_PRESETS[preset] || FLOATING_PRESETS.floating;
    const margin = Math.max(4, Number(options.margin) || 8);
    const gap = Math.max(0, Number(options.gap) || 5);
    const minWidth = Math.max(0, Number(options.minWidth) || Number(presetConfig.minWidth) || 0);
    const maxWidth = Math.max(0, Number(options.maxWidth) || Number(presetConfig.maxWidth) || 0);
    const fitContent = options.fitContent ?? presetConfig.fitContent ?? preset === 'dropdown';
    const portal = options.portal !== false;
    const preferredHeightOption = options.preferredHeight;
    const defaultPreferredHeight = presetConfig.preferredHeight ?? 320;
    const resolvePreferredHeight = (viewport) => {
      const value = typeof preferredHeightOption === 'function'
        ? preferredHeightOption(viewport, anchor, layer) : Number(preferredHeightOption);
      if (Number.isFinite(value) && value > 0) return Math.max(120, value);
      const fallback = typeof defaultPreferredHeight === 'function'
        ? defaultPreferredHeight(viewport, anchor, layer) : Number(defaultPreferredHeight);
      return Math.max(120, Number.isFinite(fallback) && fallback > 0 ? fallback : 320);
    };
    const placements = options.placements || presetConfig.placements || ['below', 'above'];
    const align = options.align || presetConfig.align || 'start';
    const initiallyVisible = options.initiallyVisible === true;
    const hiddenOnClose = options.hiddenOnClose !== false;
    const ownerModal = anchor.closest('.modal-mask');
    let open = false;
    let closing = false;
    let closeTimer = 0;
    let closeMotionEnd = null;
    let raf = 0;
    let ownerObserver = null;
    let resizeObserver = null;
    let notifyOnClose = false;

    const presetClass = `ui-floating-preset-${preset.replace(/[^a-z0-9_-]/gi, '-')}`;
    const stateClasses = ['opening', 'open', 'closing'].map((state) => `ui-floating-state-${state}`);
    const setFloatingState = (state) => {
      for (const className of stateClasses) layer.classList.remove(className);
      if (state) layer.classList.add(`ui-floating-state-${state}`);
      if (state) layer.dataset.floatingState = state;
      else delete layer.dataset.floatingState;
    };
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
        'width', 'min-width', 'max-width', 'max-height', 'height', 'min-height',
        'overflow-y',
      ]) layer.style.removeProperty(property);
      layer.classList.remove('ui-floating-layer', 'ui-floating-dropdown', presetClass);
      delete layer.dataset.placement;
      delete layer.dataset.floatingPreset;
      setFloatingState('');
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
      const rect = anchor.getBoundingClientRect();
      const boundary = resolveBoundary();
      const header = document.querySelector('.site-header');
      const actionbar = document.getElementById('actionbar');
      let avoidElements = options.avoidElements;
      if (typeof avoidElements === 'function') avoidElements = avoidElements(anchor, layer);
      if (!Array.isArray(avoidElements)) avoidElements = [header, actionbar];
      const avoidRects = avoidElements.filter((element) => element instanceof Element && !element.hidden)
        .map((element) => element.getBoundingClientRect());
      layer.style.position = 'fixed';
      layer.style.boxSizing = 'border-box';
      layer.style.zIndex = String(Number(options.zIndex) || 70);
      const naturalWidth = naturalLayerWidth();
      const viewport = geometry.readViewportRect();
      const layerRect = layer.getBoundingClientRect();
      const result = geometry.calculateFloatingGeometry({
        anchorRect: rect,
        layerRect: { width: Math.max(naturalWidth, layerRect.width), height: layerRect.height },
        viewportRect: viewport,
        boundaryRect: boundary?.getBoundingClientRect?.() || null,
        avoidRects,
        margin,
        gap,
        minWidth: Math.max(minWidth, naturalWidth),
        maxWidth,
        preferredHeight: resolvePreferredHeight(viewport),
        minHeight: 1,
        placements,
        align,
      });
      layer.style.left = `${Math.round(result.left)}px`;
      layer.style.right = 'auto';
      layer.style.width = `${Math.max(1, Math.round(result.width))}px`;
      layer.style.minWidth = '0';
      layer.style.maxWidth = `${Math.max(1, Math.round(result.maxWidth))}px`;
      layer.style.maxHeight = `${Math.max(1, Math.round(result.maxHeight))}px`;
      layer.style.overflowY = 'auto';
      layer.style.top = `${Math.round(result.top)}px`;
      layer.style.bottom = 'auto';
      layer.dataset.placement = result.placement;
    };
    const schedulePosition = () => {
      if (!open || raf) return;
      raf = requestAnimationFrame(position);
    };
    const removeOpenListeners = () => {
      document.removeEventListener('pointerdown', outsidePointerDown, true);
      document.removeEventListener('scroll', schedulePosition, true);
      document.removeEventListener('keydown', escapeToClose, true);
      window.removeEventListener('resize', schedulePosition);
      globalThis.visualViewport?.removeEventListener('resize', schedulePosition);
      globalThis.visualViewport?.removeEventListener('scroll', schedulePosition);
      ownerObserver?.disconnect();
      ownerObserver = null;
      resizeObserver?.disconnect();
      resizeObserver = null;
    };
    const finishClose = () => {
      if (!closing) return;
      closing = false;
      clearTimeout(closeTimer);
      closeTimer = 0;
      if (closeMotionEnd) {
        layer.removeEventListener('transitionend', closeMotionEnd);
        layer.removeEventListener('animationend', closeMotionEnd);
        closeMotionEnd = null;
      }
      layer.hidden = hiddenOnClose;
      restore();
      const notify = notifyOnClose;
      notifyOnClose = false;
      if (notify) options.onDismiss?.();
    };
    const cancelClosing = () => {
      if (!closing) return;
      clearTimeout(closeTimer);
      closeTimer = 0;
      if (closeMotionEnd) {
        layer.removeEventListener('transitionend', closeMotionEnd);
        layer.removeEventListener('animationend', closeMotionEnd);
        closeMotionEnd = null;
      }
      closing = false;
      notifyOnClose = false;
    };
    const beginClose = (notify = false) => {
      if (!open && !closing) {
        if (notify) options.onDismiss?.();
        return;
      }
      notifyOnClose ||= notify;
      if (closing) return;
      open = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      removeOpenListeners();
      /* An external hidden mutation already owns visibility; restore at once. */
      const wasHidden = layer.hidden;
      closing = true;
      layer.hidden = false;
      setFloatingState('closing');
      if (wasHidden) { finishClose(); return; }
      const duration = maxCssMotionMs(layer);
      if (duration <= 0) { finishClose(); return; }
      closeMotionEnd = (event) => {
        if (event.target === layer) finishClose();
      };
      layer.addEventListener('transitionend', closeMotionEnd);
      layer.addEventListener('animationend', closeMotionEnd);
      closeTimer = window.setTimeout(finishClose, duration + 60);
    };
    const dismiss = () => beginClose(true);
    const escapeToClose = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismiss();
      }
    };
    const outsidePointerDown = (event) => {
      if (anchor.contains(event.target) || layer.contains(event.target)) return;
      dismiss();
    };
    const controller = {
      open() {
        if (open) { schedulePosition(); return; }
        cancelClosing();
        open = true;
        if (portal && layer.parentNode !== document.body) document.body.appendChild(layer);
        layer.classList.add('ui-floating-layer', presetClass);
        if (preset === 'dropdown') layer.classList.add('ui-floating-dropdown');
        layer.dataset.floatingPreset = preset;
        setFloatingState('opening');
        layer.hidden = false;
        document.addEventListener('pointerdown', outsidePointerDown, true);
        document.addEventListener('scroll', schedulePosition, true);
        document.addEventListener('keydown', escapeToClose, true);
        window.addEventListener('resize', schedulePosition);
        globalThis.visualViewport?.addEventListener('resize', schedulePosition, { passive: true });
        globalThis.visualViewport?.addEventListener('scroll', schedulePosition, { passive: true });
        if (ownerModal) {
          ownerObserver = new MutationObserver(() => { if (ownerModal.hidden) dismiss(); });
          ownerObserver.observe(ownerModal, { attributes: true, attributeFilter: ['hidden'] });
        }
        if (typeof ResizeObserver === 'function') {
          resizeObserver = new ResizeObserver(schedulePosition);
          resizeObserver.observe(anchor);
          resizeObserver.observe(layer);
          const boundary = resolveBoundary();
          if (boundary) resizeObserver.observe(boundary);
        }
        position();
        requestAnimationFrame(() => {
          if (open) setFloatingState('open');
        });
      },
      close() { beginClose(false); },
      update: schedulePosition,
      get isOpen() { return open || closing; },
    };
    layer.hidden = !initiallyVisible;
    return controller;
  };

  const bindDeclaredFloatingDropdown = (anchor) => {
    if (!(anchor instanceof HTMLElement) || anchor.dataset.floatingDropdownBound === '1') return null;
    const controls = String(anchor.getAttribute('aria-controls') || '').trim();
    const layer = controls ? document.getElementById(controls) : null;
    if (!(layer instanceof HTMLElement)) return null;
    const preset = anchor.dataset.floatingPreset || 'dropdown';
    const declaredOptions = {
      preset,
      portal: false,
      minWidth: Number(anchor.dataset.floatingMinWidth) || 0,
      maxWidth: Number(anchor.dataset.floatingMaxWidth) || 0,
      onDismiss: () => {
        layer.hidden = true;
        anchor.setAttribute('aria-expanded', 'false');
      },
    };
    const preferredHeight = Number(anchor.dataset.floatingHeight) || 0;
    if (preferredHeight > 0) declaredOptions.preferredHeight = preferredHeight;
    const controller = globalThis.createFloatingLayerController(anchor, layer, declaredOptions);
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
