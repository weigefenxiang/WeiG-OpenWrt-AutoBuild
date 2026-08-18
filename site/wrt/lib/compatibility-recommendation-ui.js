/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Presentation-only adapter for compatibility recommendation overflow.
 * Kconfig and dependency semantics remain owned by catalog-engine.js.
 */
'use strict';

const RECOMMENDATION_SELECTOR =
  '.compatibility-recommendation-action, .compatibility-recommendation-detail';

function loadRecommendationStyles() {
  if (typeof document === 'undefined' ||
      document.querySelector('link[data-compatibility-recommendation-style]')) return;
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  const url = new URL('../compatibility-recommendation.css', import.meta.url);
  url.search = new URL(import.meta.url).search;
  stylesheet.href = url.href;
  stylesheet.dataset.compatibilityRecommendationStyle = '';
  document.head.appendChild(stylesheet);
}

function compactRecommendationDetail(node, fullText) {
  if (!node.classList.contains('compatibility-recommendation-detail')) return fullText;
  const separator = fullText.search(/[；;]/);
  const summary = separator > 0 ? fullText.slice(0, separator).trim() : fullText;
  return summary === fullText ? fullText : `${summary}…`;
}

function bindRecommendationOverflow(node) {
  if (typeof HTMLElement === 'undefined' || !(node instanceof HTMLElement)) return;
  const current = String(node.textContent || '').trim();
  const previous = String(node.dataset.compatibilityFullText || '');
  const fullText = previous || current;
  if (!fullText) return;

  if (!previous) node.dataset.compatibilityFullText = fullText;
  node.dataset.uiTooltipBody = fullText;
  node.setAttribute('aria-describedby', 'uiTooltip');
  if (!node.hasAttribute('tabindex')) node.tabIndex = 0;

  const compact = compactRecommendationDetail(node, fullText);
  if (node.textContent !== compact) node.textContent = compact;
}

function refreshRecommendationOverflow(root) {
  for (const node of root.querySelectorAll(RECOMMENDATION_SELECTOR)) bindRecommendationOverflow(node);
}

function installRecommendationOverflow() {
  const body = document.getElementById('modalBody');
  if (!body) return;
  loadRecommendationStyles();
  refreshRecommendationOverflow(body);
  const observer = new MutationObserver(() => refreshRecommendationOverflow(body));
  observer.observe(body, { childList: true, subtree: true });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installRecommendationOverflow, { once: true });
  } else {
    installRecommendationOverflow();
  }
}
