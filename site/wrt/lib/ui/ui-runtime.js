/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Shared notice, tooltip, and build-information UI runtime.
 */
'use strict';

/*
 * Viewport-safe geometry is deliberately kept in this first, classic-loaded UI
 * module.  `app.js` loads this file before the presentation adapter that owns
 * the floating-layer controller, so every overlay gets the same contract.
 * These helpers are pure apart from `readViewportRect`, which only reads the
 * browser viewport and has a deterministic documentElement fallback.
 */
const viewportNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

function normalizeViewportRect(rect, fallback = {}) {
  const left = viewportNumber(rect?.left, viewportNumber(fallback.left));
  const top = viewportNumber(rect?.top, viewportNumber(fallback.top));
  const width = Math.max(0, viewportNumber(rect?.width, viewportNumber(fallback.width)));
  const height = Math.max(0, viewportNumber(rect?.height, viewportNumber(fallback.height)));
  const right = viewportNumber(rect?.right, left + width);
  const bottom = viewportNumber(rect?.bottom, top + height);
  return {
    left,
    top,
    right: Math.max(left, right),
    bottom: Math.max(top, bottom),
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function readViewportRect(source = globalThis) {
  const documentElement = source?.document?.documentElement;
  const visualViewport = source?.visualViewport;
  const fallbackWidth = viewportNumber(documentElement?.clientWidth,
    viewportNumber(source?.innerWidth, 0));
  const fallbackHeight = viewportNumber(documentElement?.clientHeight,
    viewportNumber(source?.innerHeight, 0));
  const width = viewportNumber(visualViewport?.width, fallbackWidth);
  const height = viewportNumber(visualViewport?.height, fallbackHeight);
  const left = viewportNumber(visualViewport?.offsetLeft, 0);
  const top = viewportNumber(visualViewport?.offsetTop, 0);
  return normalizeViewportRect({ left, top, width, height });
}

function rectIntersectsHorizontally(left, right, rect) {
  return viewportNumber(rect?.right, viewportNumber(rect?.left) + viewportNumber(rect?.width)) > left &&
    viewportNumber(rect?.left) < right;
}

function calculateFloatingGeometry({
  anchorRect = {},
  layerRect = {},
  viewportRect = {},
  boundaryRect = null,
  avoidRects = [],
  margin = 8,
  gap = 5,
  minWidth = 0,
  maxWidth = 0,
  preferredHeight = 320,
  minHeight = 1,
  placements = ['below', 'above'],
  align = 'start',
} = {}) {
  const viewport = normalizeViewportRect(viewportRect);
  const anchor = normalizeViewportRect(anchorRect);
  const safeMargin = Math.max(0, viewportNumber(margin, 8));
  const safeGap = Math.max(0, viewportNumber(gap, 5));
  const minimumHeight = Math.max(1, viewportNumber(minHeight, 1));
  const owner = boundaryRect ? normalizeViewportRect(boundaryRect) : viewport;
  let left = Math.max(viewport.left + safeMargin, owner.left + safeMargin);
  let top = Math.max(viewport.top + safeMargin, owner.top + safeMargin);
  let right = Math.min(viewport.right - safeMargin, owner.right - safeMargin);
  let bottom = Math.min(viewport.bottom - safeMargin, owner.bottom - safeMargin);
  if (right < left) {
    const middle = (left + right) / 2;
    left = middle;
    right = middle;
  }
  if (bottom < top) {
    const middle = (top + bottom) / 2;
    top = middle;
    bottom = middle;
  }

  // Full-width sticky regions (header/actionbar) split the usable vertical
  // space.  An owner boundary still wins over an unrelated obstruction.
  for (const obstruction of Array.isArray(avoidRects) ? avoidRects : []) {
    const rect = normalizeViewportRect(obstruction);
    if (!rectIntersectsHorizontally(left, right, rect)) continue;
    const intersectsAnchor = rect.top < anchor.bottom && rect.bottom > anchor.top;
    if (intersectsAnchor) {
      /*
       * A fixed/sticky actionbar can contain the trigger itself (the bottom
       * dock is the common example).  It is still a no-go region for the
       * floating layer: reduce the side of the region that the layer would
       * otherwise enter, even though the obstruction is not wholly above or
       * below the anchor.
       */
      if (rect.top > anchor.top && rect.top < bottom) {
        bottom = Math.max(top, Math.min(bottom, rect.top - safeMargin));
      } else if (rect.bottom < anchor.bottom && rect.bottom > top) {
        top = Math.min(bottom, Math.max(top, rect.bottom + safeMargin));
      } else if (rect.top <= anchor.top && rect.bottom >= anchor.bottom) {
        /*
         * The anchor is inside the obstruction.  Do not assume that every
         * containing obstruction is a bottom dock: a sticky header contains
         * its controls just as often as an actionbar does.  Keep the larger
         * outside region and let the placement chooser select the direction.
         * Ties use the anchor's position as a stable top/bottom hint, so a
         * control in the upper half opens below and one in the lower half
         * opens above.  This is intentionally geometry-only; no header,
         * actionbar, or element id is part of the contract.
         */
        const roomAbove = Math.max(0, rect.top - top);
        const roomBelow = Math.max(0, bottom - rect.bottom);
        const midpoint = top + ((bottom - top) / 2);
        const preferBelow = roomBelow > roomAbove ||
          (roomBelow === roomAbove && (anchor.top + anchor.bottom) / 2 <= midpoint);
        if (preferBelow) {
          top = Math.min(bottom, Math.max(top, rect.bottom + safeMargin));
        } else {
          bottom = Math.max(top, Math.min(bottom, rect.top - safeMargin));
        }
      }
    } else if (rect.bottom <= anchor.top + safeGap && rect.bottom > top) {
      top = Math.min(bottom, Math.max(top, rect.bottom + safeMargin));
    } else if (rect.top >= anchor.bottom - safeGap && rect.top < bottom) {
      bottom = Math.max(top, Math.min(bottom, rect.top - safeMargin));
    }
  }

  const availableWidth = Math.max(1, right - left);
  const availableHeight = Math.max(minimumHeight, bottom - top);
  const measuredWidth = Math.max(0, viewportNumber(layerRect?.width, 0));
  const measuredHeight = Math.max(0, viewportNumber(layerRect?.height, 0));
  const requestedWidth = Math.max(minimumHeight, measuredWidth, viewportNumber(minWidth, 0));
  const widthLimit = Math.max(1, Math.min(availableWidth,
    viewportNumber(maxWidth, 0) > 0 ? viewportNumber(maxWidth, 0) : availableWidth));
  const naturalWidth = Math.min(widthLimit, Math.max(1, requestedWidth));
  const requestedHeight = Math.max(minimumHeight, measuredHeight,
    viewportNumber(preferredHeight, 320));
  const normalizedPlacements = (Array.isArray(placements) ? placements : [placements])
    .map((placement) => String(placement || '').toLowerCase())
    .filter((placement, index, all) => ['below', 'above', 'right', 'left'].includes(placement) &&
      all.indexOf(placement) === index);
  const candidatePlacements = normalizedPlacements.length ? normalizedPlacements : ['below', 'above'];
  const alignLeft = (width) => {
    if (align === 'center') return anchor.left + (anchor.width / 2) - (width / 2);
    if (align === 'end' || align === 'right') return anchor.right - width;
    return anchor.left;
  };
  const candidates = candidatePlacements.map((placement, order) => {
    let roomWidth = availableWidth;
    let roomHeight = availableHeight;
    let candidateWidth = naturalWidth;
    let candidateHeight = Math.min(requestedHeight, roomHeight);
    let candidateLeft = alignLeft(candidateWidth);
    let candidateTop = anchor.bottom + safeGap;
    if (placement === 'above') {
      roomHeight = Math.max(0, anchor.top - top - safeGap);
      candidateHeight = Math.min(requestedHeight, Math.max(minimumHeight, roomHeight));
      candidateTop = anchor.top - candidateHeight - safeGap;
    } else if (placement === 'right') {
      roomWidth = Math.max(0, right - anchor.right - safeGap);
      candidateWidth = Math.min(naturalWidth, Math.max(minimumHeight, roomWidth));
      candidateHeight = Math.min(requestedHeight, availableHeight);
      candidateLeft = anchor.right + safeGap;
      candidateTop = anchor.top;
    } else if (placement === 'left') {
      roomWidth = Math.max(0, anchor.left - left - safeGap);
      candidateWidth = Math.min(naturalWidth, Math.max(minimumHeight, roomWidth));
      candidateHeight = Math.min(requestedHeight, availableHeight);
      candidateLeft = anchor.left - candidateWidth - safeGap;
      candidateTop = anchor.top;
    } else {
      roomHeight = Math.max(0, bottom - anchor.bottom - safeGap);
      candidateHeight = Math.min(requestedHeight, Math.max(minimumHeight, roomHeight));
    }
    candidateWidth = Math.max(minimumHeight, Math.min(widthLimit, candidateWidth));
    candidateHeight = Math.max(minimumHeight, Math.min(availableHeight, candidateHeight));
    const roomFits = (placement === 'right' || placement === 'left')
      ? roomWidth >= naturalWidth && roomHeight >= requestedHeight
      : roomHeight >= requestedHeight && availableWidth >= naturalWidth;
    const room = placement === 'right' || placement === 'left' ? roomWidth : roomHeight;
    const clampedLeft = Math.min(Math.max(left, candidateLeft), Math.max(left, right - candidateWidth));
    const clampedTop = Math.min(Math.max(top, candidateTop), Math.max(top, bottom - candidateHeight));
    const candidateRight = clampedLeft + candidateWidth;
    const candidateBottom = clampedTop + candidateHeight;
    const blocked = (Array.isArray(avoidRects) ? avoidRects : []).some((obstruction) => {
      const rect = normalizeViewportRect(obstruction);
      return Math.min(candidateRight, rect.right) > Math.max(clampedLeft, rect.left) &&
        Math.min(candidateBottom, rect.bottom) > Math.max(clampedTop, rect.top);
    });
    return {
      placement,
      order,
      fits: roomFits && !blocked,
      room,
      left: clampedLeft,
      top: clampedTop,
      width: candidateWidth,
      height: candidateHeight,
      maxWidth: Math.max(1, Math.min(widthLimit, placement === 'right' || placement === 'left'
        ? Math.max(minimumHeight, roomWidth) : availableWidth)),
      maxHeight: Math.max(minimumHeight, placement === 'above' || placement === 'below'
        ? Math.max(minimumHeight, roomHeight) : availableHeight),
    };
  });
  candidates.sort((a, b) => Number(b.fits) - Number(a.fits) || b.room - a.room || a.order - b.order);
  const chosen = candidates[0] || {
    placement: 'below', left, top, width: naturalWidth, height: minimumHeight,
    maxWidth: widthLimit, maxHeight: availableHeight,
  };
  return Object.freeze({
    ...chosen,
    viewport,
    boundary: Object.freeze({ left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }),
  });
}

const UI_VIEWPORT_GEOMETRY = Object.freeze({ readViewportRect, calculateFloatingGeometry });
globalThis.__WEIG_VIEWPORT_GEOMETRY__ = globalThis.__WEIG_VIEWPORT_GEOMETRY__ || UI_VIEWPORT_GEOMETRY;

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
  const viewport = readViewportRect();
  // A page content rectangle is not an owner boundary for a fixed tooltip:
  // the side dock lives outside #app and the scrolled main content can be
  // much smaller than the visual viewport.  Only an explicit owner boundary
  // (or modal) constrains the layer; otherwise the viewport is authoritative.
  const owner = target?.closest?.('[data-floating-boundary]') || target?.closest?.('.modal');
  if (!owner) return viewport;
  const rect = owner.getBoundingClientRect();
  return normalizeViewportRect({
    left: Math.max(viewport.left, rect.left),
    top: Math.max(viewport.top, rect.top),
    right: Math.min(viewport.right, rect.right),
    bottom: Math.min(viewport.bottom, rect.bottom),
  }, viewport);
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
function tooltipCanStartSingleLine({ title = '', emphasis = '', body = '' } = {}) {
  const visible = [title, emphasis, body]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return visible.length === 1 && !/[\r\n]/.test(visible[0]);
}
function positionUiTooltip(target, event = null) {
  if (!uiTooltip || uiTooltip.hidden || !target) return;
  const viewport = readViewportRect();
  const boundary = uiTooltipBoundary(target);
  const gap = 9;
  const margin = 8;
  const anchor = uiTooltipAvoidanceTarget(target).getBoundingClientRect();

  const actionbar = $('actionbar');
  const actionbarRect = actionbar && !actionbar.hidden ? actionbar.getBoundingClientRect() : null;
  const header = document.querySelector('.site-header');
  const avoidRects = [header, actionbar]
    .filter((element) => element && !element.hidden)
    .map((element) => element.getBoundingClientRect());
  const calculate = (layerSize) => calculateFloatingGeometry({
    anchorRect: anchor,
    layerRect: layerSize,
    viewportRect: viewport,
    boundaryRect: boundary,
    avoidRects,
    margin,
    gap,
    maxWidth: 400,
    preferredHeight: layerSize.height,
    minHeight: 1,
    placements: ['below', 'above', 'right', 'left'],
    align: 'start',
  });
  const measureLayer = () => {
    const rect = uiTooltip.getBoundingClientRect();
    return {
      width: Math.min(400, Math.max(rect.width || 0, uiTooltip.scrollWidth || 0, 1)),
      height: Math.min(360, Math.max(rect.height || 0, uiTooltip.scrollHeight || 0, 1)),
    };
  };
  const compactCandidate = uiTooltip.dataset.tooltipSingleLine === 'true';
  // A tooltip may be retargeted while already visible. Clear the previous
  // geometry before measuring so a new message receives its natural width.
  uiTooltip.style.removeProperty('width');
  uiTooltip.style.removeProperty('max-width');
  uiTooltip.style.removeProperty('max-height');
  uiTooltip.classList.toggle('is-single-line', compactCandidate);
  const apply = (geometry) => {
    uiTooltip.style.width = `${Math.max(1, Math.round(geometry.width))}px`;
    uiTooltip.style.maxWidth = `${Math.max(1, Math.round(geometry.maxWidth))}px`;
    uiTooltip.style.maxHeight = `${Math.max(1, Math.round(geometry.maxHeight))}px`;
    uiTooltip.style.left = `${Math.round(geometry.left)}px`;
    uiTooltip.style.top = `${Math.round(geometry.top)}px`;
    uiTooltip.dataset.placement = geometry.placement;
  };
  const overlapsAvoid = (rect) => avoidRects.some((obstruction) =>
    Math.min(rect.right, obstruction.right) > Math.max(rect.left, obstruction.left) &&
    Math.min(rect.bottom, obstruction.bottom) > Math.max(rect.top, obstruction.top));
  let layerSize = measureLayer();
  let geometry = calculate(layerSize);
  // Compact display is only a first pass for short, single-block messages. If
  // the selected placement cannot provide the measured natural width, switch
  // back to the normal wrapping rules and measure again. This stays generic:
  // no tooltip trigger or button receives a special case.
  if (compactCandidate && (geometry.width + 1 < layerSize.width || geometry.maxWidth + 1 < layerSize.width)) {
    uiTooltip.classList.remove('is-single-line');
    layerSize = measureLayer();
    geometry = calculate(layerSize);
  }
  apply(geometry);
  // Width/max-height can change an auto-sized tooltip after the first pass.
  // Re-read the rendered box once and recompute if it grew into an avoided
  // region; this keeps the contract valid without a viewport-specific guess.
  const rendered = uiTooltip.getBoundingClientRect();
  if (rendered.width > geometry.width + 1 || rendered.height > geometry.height + 1 || overlapsAvoid(rendered)) {
    const retry = calculate({
      width: Math.min(400, Math.max(rendered.width, uiTooltip.scrollWidth || 0, 1)),
      height: Math.min(360, Math.max(rendered.height, uiTooltip.scrollHeight || 0, 1)),
    });
    geometry = retry;
    apply(geometry);
  }
}
function showUiTooltip(target, { title = '', emphasis = '', body = '', event = null, pinned = false } = {}) {
  if (!uiTooltip || !target || (!title && !emphasis && !body)) return;
  uiTooltipTarget = target;
  uiTooltipPinned = Boolean(pinned);
  uiTooltip.classList.toggle('is-pinned', uiTooltipPinned);
  uiTooltip.dataset.tooltipSingleLine = String(tooltipCanStartSingleLine({ title, emphasis, body }));
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
  uiTooltip.classList.remove('is-single-line');
  delete uiTooltip.dataset.tooltipSingleLine;
  renderUiTooltip();
  uiTooltip.style.removeProperty('left');
  uiTooltip.style.removeProperty('top');
  uiTooltip.style.removeProperty('width');
  uiTooltip.style.removeProperty('max-width');
  uiTooltip.style.removeProperty('max-height');
  delete uiTooltip.dataset.placement;
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
window.addEventListener('resize', () => {
  if (uiTooltipTarget?.isConnected && !uiTooltip.hidden) positionUiTooltip(uiTooltipTarget);
}, { passive: true });
globalThis.visualViewport?.addEventListener('resize', () => {
  if (uiTooltipTarget?.isConnected && !uiTooltip.hidden) positionUiTooltip(uiTooltipTarget);
}, { passive: true });
globalThis.visualViewport?.addEventListener('scroll', () => {
  if (uiTooltipPinned && uiTooltipTarget?.isConnected) positionUiTooltip(uiTooltipTarget);
  else hideUiTooltip();
}, { passive: true });

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
  if (!trigger || !card) return;
  const viewport = readViewportRect();
  const triggerRect = trigger.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const header = document.querySelector('.site-header');
  const actionbar = $('actionbar');
  const avoidRects = [header, actionbar]
    .filter((element) => element && !element.hidden)
    .map((element) => element.getBoundingClientRect());
  const geometry = calculateFloatingGeometry({
    anchorRect: triggerRect,
    layerRect: { width: cardRect.width || 480, height: cardRect.height || 420 },
    viewportRect: viewport,
    avoidRects,
    margin: 8,
    gap: 9,
    maxWidth: 480,
    preferredHeight: cardRect.height || 420,
    minHeight: 1,
    placements: ['above', 'below'],
    align: 'center',
  });
  const anchor = Math.max(18, Math.min(geometry.width - 18,
    triggerRect.left + (triggerRect.width / 2) - geometry.left));
  card.style.left = `${Math.round(geometry.left)}px`;
  card.style.top = `${Math.round(geometry.top)}px`;
  card.style.width = `${Math.max(1, Math.round(geometry.width))}px`;
  card.style.maxWidth = `${Math.max(1, Math.round(geometry.maxWidth))}px`;
  card.style.maxHeight = `${Math.max(1, Math.round(geometry.maxHeight))}px`;
  card.style.overflowY = 'auto';
  card.dataset.placement = geometry.placement;
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
  // The actionbar uses backdrop-filter for its glass treatment.  Chromium
  // treats that ancestor as a containing block for fixed descendants, which
  // would make the card coordinates relative to the sticky bar instead of
  // the visual viewport.  Keep the semantic ownership in #buildInfo while
  // the card is open, but portal the actual layer to body.
  const cardOriginParent = card.parentNode;
  const cardOriginNextSibling = card.nextSibling;
  const portalBuildInfoCard = () => {
    if (card.parentNode !== document.body) document.body.appendChild(card);
    card.classList.add('build-info-card-portal');
  };
  const restoreBuildInfoCard = () => {
    if (cardOriginParent?.isConnected && card.parentNode !== cardOriginParent) {
      cardOriginParent.insertBefore(card,
        cardOriginNextSibling?.parentNode === cardOriginParent ? cardOriginNextSibling : null);
    }
    card.classList.remove('build-info-card-portal');
  };
  trigger.textContent = shortSiteVersion(state.siteVersion);
  document.querySelectorAll('.site-version-value').forEach((node) => { node.textContent = state.siteVersion; });
  const meta = state.buildMeta;
  renderBuildInfoSha('buildInfoCommit', meta?.commit);
  renderCatalogBuildInfo();
  $('buildInfoBuilt').textContent = formatBuildTime(meta?.builtAt);
  const setOpen = (open) => {
    if (open) portalBuildInfoCard();
    panel.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', String(open));
    if (open) requestAnimationFrame(() => positionBuildInfoPanel(trigger, card));
    else restoreBuildInfoCard();
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
    if (!panel.classList.contains('is-open') || panel.contains(event.target) || card.contains(event.target)) return;
    if (buildInfoInteractiveTarget(event.target)) setOpen(false);
  });
  document.addEventListener('dblclick', (event) => {
    if (panel.classList.contains('is-open') && !panel.contains(event.target) && !card.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
  window.addEventListener('resize', () => {
    if (panel.classList.contains('is-open')) positionBuildInfoPanel(trigger, card);
  });
  globalThis.visualViewport?.addEventListener('resize', () => {
    if (panel.classList.contains('is-open')) positionBuildInfoPanel(trigger, card);
  }, { passive: true });
  globalThis.visualViewport?.addEventListener('scroll', () => {
    if (panel.classList.contains('is-open')) positionBuildInfoPanel(trigger, card);
  }, { passive: true });
  window.addEventListener('scroll', () => {
    if (panel.classList.contains('is-open')) positionBuildInfoPanel(trigger, card);
  }, { passive: true, capture: true });
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
