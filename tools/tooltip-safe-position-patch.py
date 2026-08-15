#!/usr/bin/env python3
from pathlib import Path

app_path = Path('site/wrt/app.js')
test_path = Path('tools/test-catalog-ui-contract.mjs')
app = app_path.read_text(encoding='utf-8')
test = test_path.read_text(encoding='utf-8')

old = '''function positionUiTooltip(target, event = null) {
  if (!uiTooltip || uiTooltip.hidden || !target) return;
  const boundary = uiTooltipBoundary(target);
  const gap = 14;
  const anchor = target.getBoundingClientRect();
  const pointerX = Number.isFinite(event?.clientX) ? event.clientX : anchor.left;
  const pointerY = Number.isFinite(event?.clientY) ? event.clientY : anchor.bottom;
  const availableWidth = Math.max(180, boundary.right - boundary.left);
  uiTooltip.style.maxWidth = `${Math.min(400, availableWidth)}px`;
  const rect = uiTooltip.getBoundingClientRect();

  let left = pointerX + gap;
  if (left + rect.width > boundary.right) left = pointerX - rect.width - gap;
  left = Math.min(Math.max(boundary.left, left), Math.max(boundary.left, boundary.right - rect.width));

  let top = pointerY + gap;
  if (top + rect.height > boundary.bottom) top = pointerY - rect.height - gap;
  top = Math.min(Math.max(boundary.top, top), Math.max(boundary.top, boundary.bottom - rect.height));

  uiTooltip.style.left = `${left}px`;
  uiTooltip.style.top = `${top}px`;
}
'''
new = '''function positionUiTooltip(target, event = null) {
  if (!uiTooltip || uiTooltip.hidden || !target) return;
  const boundary = uiTooltipBoundary(target);
  const gap = 9;
  const margin = 8;
  const anchor = target.getBoundingClientRect();
  const pointerX = Number.isFinite(event?.clientX) ? event.clientX : anchor.right;
  const pointerY = Number.isFinite(event?.clientY) ? event.clientY : anchor.bottom;

  const actionbar = $('actionbar');
  const actionbarRect = actionbar && !actionbar.hidden ? actionbar.getBoundingClientRect() : null;
  const actionbarVisible = Boolean(actionbarRect && actionbarRect.top < innerHeight && actionbarRect.bottom > 0);
  const safeBottom = actionbarVisible
    ? Math.max(boundary.top, Math.min(boundary.bottom, actionbarRect.top - margin))
    : boundary.bottom;
  const safeBoundary = { ...boundary, bottom: safeBottom };
  const availableWidth = Math.max(1, safeBoundary.right - safeBoundary.left);
  const availableHeight = Math.max(1, safeBoundary.bottom - safeBoundary.top);
  uiTooltip.style.maxWidth = `${Math.min(400, availableWidth)}px`;
  uiTooltip.style.maxHeight = `${Math.min(360, availableHeight)}px`;
  const rect = uiTooltip.getBoundingClientRect();

  const candidates = [
    { left: pointerX + gap, top: pointerY + gap },
    { left: pointerX - rect.width - gap, top: pointerY + gap },
    { left: pointerX + gap, top: pointerY - rect.height - gap },
    { left: pointerX - rect.width - gap, top: pointerY - rect.height - gap },
  ];
  const fits = (candidate) => candidate.left >= safeBoundary.left &&
    candidate.top >= safeBoundary.top &&
    candidate.left + rect.width <= safeBoundary.right &&
    candidate.top + rect.height <= safeBoundary.bottom;
  const visibleArea = (candidate) => {
    const left = Math.max(candidate.left, safeBoundary.left);
    const right = Math.min(candidate.left + rect.width, safeBoundary.right);
    const top = Math.max(candidate.top, safeBoundary.top);
    const bottom = Math.min(candidate.top + rect.height, safeBoundary.bottom);
    return Math.max(0, right - left) * Math.max(0, bottom - top);
  };

  let chosen = candidates.find(fits);
  if (!chosen) {
    chosen = candidates.reduce((best, candidate) => {
      const area = visibleArea(candidate);
      const distance = Math.hypot(candidate.left - (pointerX + gap), candidate.top - (pointerY + gap));
      if (!best || area > best.area || (area === best.area && distance < best.distance)) {
        return { candidate, area, distance };
      }
      return best;
    }, null).candidate;
  }

  const maxLeft = Math.max(safeBoundary.left, safeBoundary.right - rect.width);
  const maxTop = Math.max(safeBoundary.top, safeBoundary.bottom - rect.height);
  const left = Math.min(Math.max(safeBoundary.left, chosen.left), maxLeft);
  const top = Math.min(Math.max(safeBoundary.top, chosen.top), maxTop);
  uiTooltip.style.left = `${left}px`;
  uiTooltip.style.top = `${top}px`;
}
'''
if old not in app:
    raise SystemExit('positionUiTooltip baseline not found')
app = app.replace(old, new, 1)
old_hide = "  uiTooltip.style.removeProperty('max-width');\n"
new_hide = "  uiTooltip.style.removeProperty('max-width');\n  uiTooltip.style.removeProperty('max-height');\n"
if old_hide not in app:
    raise SystemExit('tooltip cleanup baseline not found')
app = app.replace(old_hide, new_hide, 1)

needle = '''  sharedTooltipContract.includes("const wrap = target?.closest?.('.wrap') || $('app')") &&
  sharedTooltipContract.includes("document.addEventListener('pointermove'") &&
'''
replacement = '''  sharedTooltipContract.includes("const wrap = target?.closest?.('.wrap') || $('app')") &&
  sharedTooltipContract.includes("const gap = 9;") &&
  sharedTooltipContract.includes("const actionbar = $('actionbar');") &&
  sharedTooltipContract.includes('actionbarRect.top - margin') &&
  sharedTooltipContract.includes('const safeBoundary = { ...boundary, bottom: safeBottom };') &&
  sharedTooltipContract.includes('uiTooltip.style.maxHeight = `${Math.min(360, availableHeight)}px`;') &&
  sharedTooltipContract.includes('const candidates = [') &&
  sharedTooltipContract.includes('const visibleArea = (candidate) => {') &&
  sharedTooltipContract.includes('area > best.area || (area === best.area && distance < best.distance)') &&
  sharedTooltipContract.includes("uiTooltip.style.removeProperty('max-height');") &&
  sharedTooltipContract.includes("document.addEventListener('pointermove'") &&
'''
if needle not in test:
    raise SystemExit('shared tooltip test anchor not found')
test = test.replace(needle, replacement, 1)

app_path.write_text(app, encoding='utf-8', newline='\n')
test_path.write_text(test, encoding='utf-8', newline='\n')
