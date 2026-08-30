/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function installPageShellUi({ get, t, safeSet, openModal, fitPluginNames }) {
  if (typeof get !== 'function' || typeof t !== 'function' || typeof safeSet !== 'function' ||
      typeof openModal !== 'function' || typeof fitPluginNames !== 'function') {
    throw new Error('page shell UI dependencies are incomplete');
  }
  const $ = get;
  const FONT_DEF = 18, FONT_MIN = 14, FONT_MAX = 24;
  const FONT_VARIABLES = Object.freeze([
    '--font-page-title', '--font-section-title', '--font-item-title', '--font-emphasis',
    '--font-body', '--font-description', '--font-meta', '--font-badge',
  ]);
  const root = document.documentElement;
  let fontPx = parseInt(localStorage.getItem('wrt_font'), 10);
  if (!fontPx && localStorage.getItem('wrt_density') === '1') { fontPx = 16; safeSet('wrt_font', '16'); }
  try { localStorage.removeItem('wrt_density'); } catch (error) { /* storage may be unavailable */ }
  if (!(fontPx >= FONT_MIN && fontPx <= FONT_MAX)) fontPx = FONT_DEF;

  const isDesktopTypography = () => !matchMedia('(max-width: 560px)').matches;
  const setFontVariables = () => {
    root.dataset.wrtFont = String(fontPx);
    // Mobile keeps the media-query typography contract for the default value.
    // A user-selected value still scales semantic tokens, without changing the
    // layout coordinate system (the legacy page-zoom path is intentionally gone).
    if (fontPx === FONT_DEF) {
      for (const name of FONT_VARIABLES) root.style.removeProperty(name);
      return;
    }
    const desktop = isDesktopTypography();
    const baseline = desktop
      ? { page: 32, section: 24, item: 20, emphasis: 18, body: 18, description: 17, meta: 15, badge: 14 }
      : { page: 21, section: 19, item: 17, emphasis: 16, body: 16, description: 14, meta: 13, badge: 12 };
    const base = desktop ? fontPx : Math.max(16, Math.round(16 * fontPx / FONT_DEF));
    const scale = base / baseline.body;
    const values = {
      '--font-page-title': Math.round(baseline.page * scale),
      '--font-section-title': Math.round(baseline.section * scale),
      '--font-item-title': Math.round(baseline.item * scale),
      '--font-emphasis': Math.round(baseline.emphasis * scale),
      '--font-body': Math.round(baseline.body * scale),
      '--font-description': Math.max(14, Math.round(baseline.description * scale)),
      '--font-meta': Math.max(13, Math.round(baseline.meta * scale)),
      '--font-badge': Math.max(12, Math.round(baseline.badge * scale)),
    };
    for (const name of FONT_VARIABLES) root.style.setProperty(name, `${values[name]}px`);
  };
  const applyFont = (px, save) => {
    fontPx = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(Number(px)) || FONT_DEF));
    setFontVariables();
    $('fontInput').value = fontPx;
    if (save) safeSet('wrt_font', String(fontPx));
    fitPluginNames();
  };
  let toggleFontPanel = (show) => {
    const open = show !== undefined ? show : $('fontPanel').hidden;
    if (!open && $('fontPanel').contains(document.activeElement)) $('densityBtn').focus();
    $('fontPanel').hidden = !open;
    $('densityBtn').setAttribute('aria-expanded', String(open));
    if (open) $('fontDec').focus();
  };
  $('fontDec').addEventListener('click', () => applyFont(fontPx - 1, true));
  $('fontInc').addEventListener('click', () => applyFont(fontPx + 1, true));
  $('fontReset').addEventListener('click', () => applyFont(FONT_DEF, true));
  $('fontInput').addEventListener('change', () => applyFont($('fontInput').value, true));
  document.addEventListener('click', (event) => {
    if (!$('fontPanel').hidden && !$('fontPanel').contains(event.target)) toggleFontPanel(false);
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') toggleFontPanel(false); });
  applyFont(fontPx, false);

  const viewportGeometry = globalThis.__WEIG_VIEWPORT_GEOMETRY__;
  const header = document.querySelector('.site-header');
  const actionbar = $('actionbar');
  const updateViewportClearance = () => {
    const viewport = viewportGeometry?.readViewportRect?.() || {
      left: 0, top: 0, right: innerWidth, bottom: innerHeight,
      width: innerWidth, height: innerHeight,
    };
    const rectFor = (element) => element && !element.hidden ? element.getBoundingClientRect() : null;
    const headerRect = rectFor(header);
    const actionbarRect = rectFor(actionbar);
    const headerClearance = headerRect
      ? Math.max(0, Math.min(viewport.bottom, headerRect.bottom) - viewport.top) : 0;
    const actionbarClearance = actionbarRect
      ? Math.max(0, viewport.bottom - Math.max(viewport.top, actionbarRect.top)) : 0;
    root.style.setProperty('--wrt-header-clearance', `${Math.round(headerClearance)}px`);
    root.style.setProperty('--wrt-actionbar-clearance', `${Math.round(actionbarClearance)}px`);
    // The design-token stylesheet consumes this shared overlay clearance for
    // the dock, toasts, and compact panels. Keep the namespaced measurements
    // above for diagnostics while publishing one runtime positioning token.
    root.style.setProperty('--overlay-clearance', `${Math.round(actionbarClearance + 12)}px`);
    root.style.setProperty('--wrt-viewport-width', `${Math.round(viewport.width)}px`);
    root.style.setProperty('--wrt-viewport-height', `${Math.round(viewport.height)}px`);
    fontFloatingController?.update?.();
  };
  const scheduleViewportClearance = () => {
    if (scheduleViewportClearance.pending) return;
    scheduleViewportClearance.pending = true;
    requestAnimationFrame(() => {
      scheduleViewportClearance.pending = false;
      updateViewportClearance();
    });
  };
  let fontFloatingController = null;
  if (typeof globalThis.createFloatingLayerController === 'function') {
    fontFloatingController = globalThis.createFloatingLayerController($('densityBtn'), $('fontPanel'), {
      preset: 'floating',
      portal: false,
      minWidth: 230,
      maxWidth: 340,
      preferredHeight: 140,
      placements: ['left', 'right', 'above', 'below'],
      align: 'end',
      avoidElements: () => [header, actionbar],
      onDismiss: () => $('densityBtn').setAttribute('aria-expanded', 'false'),
    });
  }
  toggleFontPanel = (show) => {
    const open = show !== undefined ? show : $('fontPanel').hidden;
    if (!open && $('fontPanel').contains(document.activeElement)) $('densityBtn').focus();
    if (open) {
      fontFloatingController?.open?.();
      if (!fontFloatingController) $('fontPanel').hidden = false;
      scheduleViewportClearance();
    } else {
      fontFloatingController?.close?.();
      if (!fontFloatingController) $('fontPanel').hidden = true;
    }
    $('densityBtn').setAttribute('aria-expanded', String(open));
    if (open) $('fontDec').focus();
  };
  // The initial listeners above close the panel and remain the fallback when a
  // host page has no floating controller. Rebind the button to the shared path.
  $('densityBtn').addEventListener('click', (event) => { event.stopPropagation(); toggleFontPanel(); });
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleViewportClearance) : null;
  if (header) resizeObserver?.observe(header);
  if (actionbar) resizeObserver?.observe(actionbar);
  const visibilityObserver = new MutationObserver(scheduleViewportClearance);
  if (actionbar) visibilityObserver.observe(actionbar, { attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
  window.addEventListener('resize', scheduleViewportClearance, { passive: true });
  window.addEventListener('scroll', scheduleViewportClearance, { passive: true, capture: true });
  globalThis.visualViewport?.addEventListener('resize', scheduleViewportClearance, { passive: true });
  globalThis.visualViewport?.addEventListener('scroll', scheduleViewportClearance, { passive: true });
  const typographyMedia = matchMedia('(max-width: 560px)');
  typographyMedia.addEventListener?.('change', () => { setFontVariables(); scheduleViewportClearance(); });
  updateViewportClearance();

  $('helpBtn').addEventListener('click', () => {
    openModal(t('help.title'));
    $('modal').querySelector('.modal').classList.add('modal-wide', 'recommended-config');
    const bodyRoot = $('modalBody');
    bodyRoot.textContent = '';
    for (const line of t('help.body').split('\n')) {
      const match = line.match(/^([①②③④⑤⑥⑦⑧⑨⑩]|\d+\.)\s*(.*)$/);
      const row = document.createElement('div');
      row.className = 'help-item';
      const number = document.createElement('span');
      number.className = 'help-num';
      number.textContent = match ? match[1].replace('.', '') : '·';
      row.appendChild(number);
      const body = document.createElement('span');
      body.className = 'help-text';
      const text = match ? match[2] : line;
      let last = 0;
      for (const quote of text.matchAll(/"([^"]+)"|'([^']+)'|“([^”]+)”/g)) {
        body.appendChild(document.createTextNode(text.slice(last, quote.index)));
        const emphasis = document.createElement('em');
        emphasis.textContent = quote[1] || quote[2] || quote[3];
        body.appendChild(emphasis);
        last = quote.index + quote[0].length;
      }
      body.appendChild(document.createTextNode(text.slice(last)));
      row.appendChild(body);
      bodyRoot.appendChild(row);
    }
    const links = document.createElement('div');
    links.className = 'help-links';
    const link = document.createElement('a');
    link.href = 'https://openwrt.org/docs/guide-user/installation/generic.sysupgrade';
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = t('help.link.ubi');
    links.appendChild(link);
    bodyRoot.appendChild(links);
  });

  const savedDock = localStorage.getItem('wrt_dock');
  if (savedDock === '1' || (savedDock === null && matchMedia('(max-width: 560px)').matches)) {
    $('sideDock').classList.add('collapsed');
  }
  $('dockToggle').setAttribute('aria-expanded', String(!$('sideDock').classList.contains('collapsed')));
  $('dockToggle').addEventListener('click', () => {
    const collapsed = $('sideDock').classList.toggle('collapsed');
    $('dockToggle').setAttribute('aria-expanded', String(!collapsed));
    safeSet('wrt_dock', collapsed ? '1' : '0');
  });

  $('riskOk').addEventListener('click', () => { $('riskBar').hidden = true; safeSet('wrt_risk', 'ok'); });

  let themeMode = localStorage.getItem('wrt_theme') || 'auto';
  const icons = Object.freeze({ auto: '◐', light: '☀', dark: '☾' });
  const applyThemeIcon = () => {
    $('themeBtn').textContent = icons[themeMode];
    $('themeBtn').dataset.uiTooltipBody = t('theme.' + themeMode);
    $('themeBtn').setAttribute('aria-label', t('theme.' + themeMode));
  };
  const applyTheme = (mode) => {
    themeMode = mode === 'light' || mode === 'dark' ? mode : 'auto';
    if (typeof globalThis.__WEIG_APPLY_THEME__ === 'function') themeMode = globalThis.__WEIG_APPLY_THEME__(themeMode);
    else if (themeMode === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = themeMode;
    applyThemeIcon();
    if (themeMode === 'auto') {
      try { localStorage.removeItem('wrt_theme'); } catch (error) { /* storage may be unavailable */ }
    } else safeSet('wrt_theme', themeMode);
  };
  $('themeBtn').addEventListener('click', () => {
    applyTheme(themeMode === 'auto' ? 'light' : themeMode === 'light' ? 'dark' : 'auto');
  });
  applyTheme(themeMode);
  return Object.freeze({ refreshThemeControl: applyThemeIcon });
}
