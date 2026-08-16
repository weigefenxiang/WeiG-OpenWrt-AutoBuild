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
  const FONT_DEF = 17, FONT_MIN = 14, FONT_MAX = 24;
  let fontPx = parseInt(localStorage.getItem('wrt_font'), 10);
  if (!fontPx && localStorage.getItem('wrt_density') === '1') { fontPx = 16; safeSet('wrt_font', '16'); }
  try { localStorage.removeItem('wrt_density'); } catch (error) { /* storage may be unavailable */ }
  if (!(fontPx >= FONT_MIN && fontPx <= FONT_MAX)) fontPx = FONT_DEF;

  const applyFont = (px, save) => {
    fontPx = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(Number(px)) || FONT_DEF));
    document.body.style.zoom = fontPx === FONT_DEF ? '' : String(fontPx / FONT_DEF);
    $('fontInput').value = fontPx;
    if (save) safeSet('wrt_font', String(fontPx));
    fitPluginNames();
  };
  const toggleFontPanel = (show) => {
    const open = show !== undefined ? show : $('fontPanel').hidden;
    if (!open && $('fontPanel').contains(document.activeElement)) $('densityBtn').focus();
    $('fontPanel').hidden = !open;
    $('densityBtn').setAttribute('aria-expanded', String(open));
    if (open) $('fontDec').focus();
  };
  $('densityBtn').addEventListener('click', (event) => { event.stopPropagation(); toggleFontPanel(); });
  $('fontDec').addEventListener('click', () => applyFont(fontPx - 1, true));
  $('fontInc').addEventListener('click', () => applyFont(fontPx + 1, true));
  $('fontReset').addEventListener('click', () => applyFont(FONT_DEF, true));
  $('fontInput').addEventListener('change', () => applyFont($('fontInput').value, true));
  document.addEventListener('click', (event) => {
    if (!$('fontPanel').hidden && !$('fontPanel').contains(event.target)) toggleFontPanel(false);
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') toggleFontPanel(false); });
  applyFont(fontPx, false);

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
    $('themeBtn').title = t('theme.' + themeMode);
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
