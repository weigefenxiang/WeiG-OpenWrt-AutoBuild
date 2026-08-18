/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Shared notice, tooltip, and build-information UI runtime.
 */
'use strict';

/* ============ 轻提示 / Toast ============ */
let toastTimer = 0;
function showToast(msg, kind = '') {
  const el = $('toast');
  el.textContent = msg;
  el.classList.toggle('toast-device', kind === 'device');
  el.hidden = false;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show', 'toast-device'); el.hidden = true; }, 2800);
}

/* ============ 统一悬浮说明 / Shared tooltip ============ */
const uiTooltip = $('uiTooltip');
const UI_TOOLTIP_SELECTOR = '[data-ui-tooltip-title],[data-ui-tooltip-emphasis],[data-ui-tooltip-body]';
let uiTooltipTarget = null;
let uiTooltipPinned = false;
let uiTooltipTouchTarget = null;
let uiTooltipTouchAt = 0;
let uiTooltipClickTarget = null;
let uiTooltipClickAt = 0;

function bindUiTooltipContent(target, { title = '', emphasis = '', body = '', key = '' } = {}) {
  if (!target) return target;
  const rows = [
    ['uiTooltipTitle', title],
    ['uiTooltipEmphasis', emphasis],
    ['uiTooltipBody', body],
  ];
  for (const [key, value] of rows) {
    const text = String(value || '').trim();
    if (text) target.dataset[key] = text;
    else delete target.dataset[key];
  }
  const described = rows.some(([key]) => target.dataset[key]);
  const identity = String(key || '').trim();
  if (identity) target.dataset.uiTooltipKey = identity;
  else delete target.dataset.uiTooltipKey;
  if (described) target.setAttribute('aria-describedby', 'uiTooltip');
  else target.removeAttribute('aria-describedby');
  return target;
}

function uiTooltipIdentity(target) {
  return target?.dataset?.uiTooltipKey || target || null;
}
function connectedUiTooltipTarget(target) {
  if (target?.isConnected) return target;
  const key = target?.dataset?.uiTooltipKey;
  if (!key) return null;
  return [...document.querySelectorAll(UI_TOOLTIP_SELECTOR)]
    .find((candidate) => candidate.dataset.uiTooltipKey === key) || null;
}
function uiTooltipAvoidanceTarget(target) {
  return target?.closest?.(
    '.menuconfig-option,.menuconfig-choice,.menuconfig-category,.probe-package-row,.plugin,.build-contract-row,.group-head',
  ) || target;
}

function uiTooltipBoundary(target) {
  const margin = 8;
  const viewport = { left: margin, top: margin, right: innerWidth - margin, bottom: innerHeight - margin };
  const wrap = target?.closest?.('.wrap') || $('app');
  if (!wrap) return viewport;
  const rect = wrap.getBoundingClientRect();
  return {
    left: Math.max(viewport.left, rect.left),
    top: viewport.top,
    right: Math.min(viewport.right, rect.right),
    bottom: viewport.bottom,
  };
}
function renderUiTooltip({ title = '', emphasis = '', body = '' } = {}) {
  const titleEl = $('uiTooltipTitle');
  const emphasisEl = $('uiTooltipEmphasis');
  const bodyEl = $('uiTooltipBody');
  titleEl.textContent = title;
  emphasisEl.textContent = emphasis;
  bodyEl.textContent = body;
  titleEl.hidden = !title;
  emphasisEl.hidden = !emphasis;
  bodyEl.hidden = !body;
}
function positionUiTooltip(target, event = null) {
  if (!uiTooltip || uiTooltip.hidden || !target) return;
  const boundary = uiTooltipBoundary(target);
  const gap = 9;
  const margin = 8;
  const anchor = uiTooltipAvoidanceTarget(target).getBoundingClientRect();

  const actionbar = $('actionbar');
  const actionbarRect = actionbar && !actionbar.hidden ? actionbar.getBoundingClientRect() : null;
  const actionbarVisible = Boolean(actionbarRect && actionbarRect.top < innerHeight && actionbarRect.bottom > 0);
  const safeBottom = actionbarVisible
    ? Math.max(boundary.top, Math.min(boundary.bottom, actionbarRect.top - margin))
    : boundary.bottom;
  const safeBoundary = { ...boundary, bottom: safeBottom };
  const availableWidth = Math.max(1, safeBoundary.right - safeBoundary.left);
  const availableHeight = Math.max(1, safeBoundary.bottom - safeBoundary.top);
  const aboveSpace = Math.max(0, anchor.top - safeBoundary.top - gap);
  const belowSpace = Math.max(0, safeBoundary.bottom - anchor.bottom - gap);
  const rightSpace = Math.max(0, safeBoundary.right - anchor.right - gap);
  const leftSpace = Math.max(0, anchor.left - safeBoundary.left - gap);
  const verticalSpace = Math.max(aboveSpace, belowSpace);
  uiTooltip.style.maxWidth = `${Math.min(400, availableWidth)}px`;
  uiTooltip.style.maxHeight = `${Math.max(72, Math.min(360,
    verticalSpace >= 72 ? verticalSpace : availableHeight))}px`;
  const rect = uiTooltip.getBoundingClientRect();

  const candidates = [
    { left: anchor.left, top: anchor.bottom + gap, room: belowSpace },
    { left: anchor.right - rect.width, top: anchor.bottom + gap, room: belowSpace },
    { left: anchor.left, top: anchor.top - rect.height - gap, room: aboveSpace },
    { left: anchor.right - rect.width, top: anchor.top - rect.height - gap, room: aboveSpace },
    { left: anchor.right + gap, top: anchor.top, room: rightSpace },
    { left: anchor.left - rect.width - gap, top: anchor.top, room: leftSpace },
  ];
  const clamp = (candidate) => ({
    left: Math.min(Math.max(safeBoundary.left, candidate.left),
      Math.max(safeBoundary.left, safeBoundary.right - rect.width)),
    top: Math.min(Math.max(safeBoundary.top, candidate.top),
      Math.max(safeBoundary.top, safeBoundary.bottom - rect.height)),
    room: candidate.room,
  });
  const overlapArea = (candidate) => {
    const left = Math.max(candidate.left, anchor.left);
    const right = Math.min(candidate.left + rect.width, anchor.right);
    const top = Math.max(candidate.top, anchor.top);
    const bottom = Math.min(candidate.top + rect.height, anchor.bottom);
    return Math.max(0, right - left) * Math.max(0, bottom - top);
  };
  const chosen = candidates.map(clamp).sort((left, right) =>
    overlapArea(left) - overlapArea(right) || right.room - left.room)[0];
  uiTooltip.style.left = `${chosen.left}px`;
  uiTooltip.style.top = `${chosen.top}px`;
}
function showUiTooltip(target, { title = '', emphasis = '', body = '', event = null, pinned = false } = {}) {
  if (!uiTooltip || !target || (!title && !emphasis && !body)) return;
  uiTooltipTarget = target;
  uiTooltipPinned = Boolean(pinned);
  uiTooltip.classList.toggle('is-pinned', uiTooltipPinned);
  renderUiTooltip({ title, emphasis, body });
  uiTooltip.hidden = false;
  positionUiTooltip(target, event);
}
function showDatasetTooltip(target, event = null, pinned = false) {
  if (!target) return;
  showUiTooltip(target, {
    title: target.dataset.uiTooltipTitle || '',
    emphasis: target.dataset.uiTooltipEmphasis || '',
    body: target.dataset.uiTooltipBody || '',
    event,
    pinned,
  });
}
function hideUiTooltip(force = false) {
  if (!uiTooltip || (!force && uiTooltipPinned)) return;
  uiTooltip.hidden = true;
  uiTooltipTarget = null;
  uiTooltipPinned = false;
  uiTooltip.classList.remove('is-pinned');
  renderUiTooltip();
  uiTooltip.style.removeProperty('left');
  uiTooltip.style.removeProperty('top');
  uiTooltip.style.removeProperty('max-width');
  uiTooltip.style.removeProperty('max-height');
}
document.addEventListener('pointerover', (event) => {
  const target = event.target.closest?.(UI_TOOLTIP_SELECTOR);
  if (!target || uiTooltipPinned || matchMedia('(hover: none)').matches) return;
  showDatasetTooltip(target, event);
});
document.addEventListener('pointermove', (event) => {
  if (!uiTooltipTarget || uiTooltipPinned || uiTooltip.hidden) return;
  const target = event.target.closest?.(UI_TOOLTIP_SELECTOR);
  if (target === uiTooltipTarget) positionUiTooltip(target, event);
});
document.addEventListener('pointerout', (event) => {
  const target = event.target.closest?.(UI_TOOLTIP_SELECTOR);
  if (!target || uiTooltipPinned) return;
  if (!event.relatedTarget?.closest?.(UI_TOOLTIP_SELECTOR) || event.relatedTarget.closest(UI_TOOLTIP_SELECTOR) !== target) {
    hideUiTooltip();
  }
});
document.addEventListener('focusin', (event) => {
  const target = event.target.closest?.(UI_TOOLTIP_SELECTOR);
  if (target && !uiTooltipPinned) showDatasetTooltip(target);
});
document.addEventListener('focusout', (event) => {
  const target = event.target.closest?.(UI_TOOLTIP_SELECTOR);
  if (target && !event.relatedTarget?.closest?.(UI_TOOLTIP_SELECTOR)) hideUiTooltip();
});
document.addEventListener('click', (event) => {
  if (uiTooltipPinned && uiTooltipTarget &&
      !uiTooltipTarget.contains(event.target) && !uiTooltip.contains(event.target)) {
    hideUiTooltip(true);
    return;
  }
  const target = event.target.closest?.(UI_TOOLTIP_SELECTOR);
  if (target) {
    const identity = uiTooltipIdentity(target);
    const now = performance.now();
    const repeated = uiTooltipClickTarget === identity && now - uiTooltipClickAt <= 500;
    uiTooltipClickTarget = identity;
    uiTooltipClickAt = now;
    if (repeated) {
      const connected = connectedUiTooltipTarget(target);
      if (connected) showDatasetTooltip(connected, event, true);
      uiTooltipClickTarget = null;
      uiTooltipClickAt = 0;
      return;
    }
  }
  if (target && !uiTooltipPinned && matchMedia('(hover: none)').matches) {
    showDatasetTooltip(target, event);
  }
});
document.addEventListener('dblclick', (event) => {
  const target = event.target.closest?.(UI_TOOLTIP_SELECTOR);
  if (!target) return;
  event.preventDefault();
  event.stopPropagation();
  showDatasetTooltip(target, event, true);
}, true);
document.addEventListener('pointerup', (event) => {
  if (event.pointerType !== 'touch') return;
  const target = event.target.closest?.(UI_TOOLTIP_SELECTOR);
  if (!target) return;
  const now = performance.now();
  const identity = uiTooltipIdentity(target);
  const repeated = uiTooltipTouchTarget === identity && now - uiTooltipTouchAt <= 500;
  uiTooltipTouchTarget = identity;
  uiTooltipTouchAt = now;
  if (repeated) {
    const connected = connectedUiTooltipTarget(target);
    if (connected) showDatasetTooltip(connected, event, true);
    uiTooltipTouchTarget = null;
    uiTooltipTouchAt = 0;
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { hideUiTooltip(true); closeModal(); }
});
window.addEventListener('scroll', () => {
  if (uiTooltipPinned && uiTooltipTarget?.isConnected) positionUiTooltip(uiTooltipTarget);
  else hideUiTooltip();
}, { passive: true, capture: true });

function makePill(label, infoTitle, infoBody, onSelect) {
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'pill';
  pill.setAttribute('aria-pressed', 'false');
  pill.appendChild(document.createTextNode(label));
  if (infoBody) {
    const info = document.createElement('span');
    info.className = 'info';
    info.textContent = 'ⓘ';
    info.setAttribute('role', 'button');
    info.setAttribute('tabindex', '0');
    info.setAttribute('aria-label', label);
    bindUiTooltipContent(info, { title: infoTitle, body: infoBody });
    const show = (e) => { e.preventDefault(); e.stopPropagation(); showDatasetTooltip(info, e); };
    info.addEventListener('click', show);
    info.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') show(e); });
    pill.appendChild(info);
  }
  pill.addEventListener('click', onSelect);
  return pill;
}
function setActive(row, pill) {
  row.querySelectorAll('.pill').forEach((p) => { p.classList.remove('pill-active'); p.setAttribute('aria-pressed', 'false'); });
  pill.classList.add('pill-active');
  pill.setAttribute('aria-pressed', 'true');
}

function shortSiteVersion(version) {
  return /^v\d{10}$/.test(version || '') ? version.slice(3) : '--------';
}
function formatBuildTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):\d{2}\+08:00$/.exec(value || '');
  return match ? `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]} CST` : '—';
}
async function loadDeploymentIdentity() {
  return BUILD_IDENTITY_MODULE.normalizeDeploymentIdentity(RELEASE_BOOTSTRAP.stamp, RELEASE_BOOTSTRAP.meta);
}

function renderBuildInfoSha(id, value) {
  const button = $(id);
  if (!button) return;
  const sha = String(value || '').trim().toLowerCase();
  if (/^[a-f0-9]{40}$/.test(sha)) {
    button.textContent = sha;
    bindUiTooltipContent(button, { body: sha });
    button.disabled = false;
    button.onclick = async () => {
      try { await navigator.clipboard.writeText(sha); }
      catch (e) { /* clipboard permission can be unavailable on plain HTTP */ }
    };
  } else {
    button.textContent = '—';
    bindUiTooltipContent(button);
    button.disabled = true;
    button.onclick = null;
  }
}
function renderCatalogBuildInfo() {
  renderBuildInfoSha('buildInfoCatalogCode', MENU_INDEX?.provenance?.codeSha);
  renderBuildInfoSha('buildInfoCatalogData', MENU_INDEX?.assetRef);
}

function positionBuildInfoPanel(trigger, card) {
  const gutter = 8;
  const gap = 9;
  const triggerRect = trigger.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const centeredLeft = triggerRect.left + (triggerRect.width / 2) - (cardRect.width / 2);
  const left = Math.max(gutter, Math.min(centeredLeft, window.innerWidth - cardRect.width - gutter));
  const top = Math.max(gutter, triggerRect.top - cardRect.height - gap);
  const anchor = Math.max(18, Math.min(cardRect.width - 18, triggerRect.left + (triggerRect.width / 2) - left));
  card.style.left = `${Math.round(left)}px`;
  card.style.top = `${Math.round(top)}px`;
  card.style.setProperty('--build-info-anchor-x', `${Math.round(anchor)}px`);
}

const BUILD_INFO_INTERACTIVE_SELECTOR = [
  'a[href]', 'button', 'input', 'select', 'textarea', 'label', 'summary',
  '[contenteditable="true"]', '[role="button"]', '[role="checkbox"]', '[role="radio"]',
  '[role="option"]', '[role="menuitem"]', '[role="menuitemcheckbox"]', '[role="menuitemradio"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function buildInfoInteractiveTarget(target) {
  const element = target instanceof Element ? target : target?.parentElement;
  return element?.closest(BUILD_INFO_INTERACTIVE_SELECTOR) || null;
}

function renderBuildInfo() {
  const trigger = $('siteVersion');
  const panel = $('buildInfo');
  const card = $('buildInfoCard');
  const closeButton = $('buildInfoClose');
  trigger.textContent = shortSiteVersion(state.siteVersion);
  document.querySelectorAll('.site-version-value').forEach((node) => { node.textContent = state.siteVersion; });
  const meta = state.buildMeta;
  renderBuildInfoSha('buildInfoCommit', meta?.commit);
  renderCatalogBuildInfo();
  $('buildInfoBuilt').textContent = formatBuildTime(meta?.builtAt);
  const setOpen = (open) => {
    panel.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', String(open));
    if (open) requestAnimationFrame(() => positionBuildInfoPanel(trigger, card));
  };
  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(!panel.classList.contains('is-open'));
  });
  closeButton.addEventListener('click', (event) => {
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
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
  window.addEventListener('resize', () => {
    if (panel.classList.contains('is-open')) positionBuildInfoPanel(trigger, card);
  });
}

let lastFocus = null;
let modalCancelHandler = null;
function openModal(title) {
  $('modalTitle').textContent = title;
  $('modalProbe').hidden = true;
  lastFocus = document.activeElement;
  $('modal').hidden = false;
  document.body.classList.add('modal-open');
  $('modalClose').focus();
}
function closeModal() {
  if ($('modal').hidden) return;
  selfTestViewToken += 1;
  const cancel = modalCancelHandler;
  modalCancelHandler = null;
  $('modal').hidden = true;
  $('modalProbe').hidden = true;
  $('modal').querySelector('.modal').classList.remove('modal-wide', 'modal-import-source', 'recommended-config', 'profile-package-config', 'generation-error', 'catalog-conflict', 'compatibility-warning', 'rootfs-guidance', 'package-probe');
  document.body.classList.remove('modal-open');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
  if (cancel) cancel();
}
$('modalClose').addEventListener('click', closeModal);
$('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });
$('modal').addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const els = [...$('modal').querySelectorAll('button, a[href], input, textarea, select')].filter((el) => !el.disabled && el.offsetParent !== null);
  if (!els.length) return;
  const first = els[0], last = els[els.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
