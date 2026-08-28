/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Release-scoped static data loading runtime.
 */
'use strict';

/* ============ Data loading ============ */
function dataUrls(path) {
  if (path.includes('..') || !/^[\w./-]+$/.test(path)) throw new Error('Invalid data path: ' + path);
  const urls = [releaseAssetUrl('./data/' + path)];
  const releaseCommit = String(RELEASE_BOOTSTRAP.meta?.commit || '');
  if (/^[a-f0-9]{40}$/.test(releaseCommit)) {
    urls.push(
      releaseScopedUrl('https://cdn.jsdelivr.net/gh/' + OFFICIAL_REPO + '@' + releaseCommit + '/site/wrt/data/' + path),
      releaseScopedUrl('https://raw.githubusercontent.com/' + OFFICIAL_REPO + '/' + releaseCommit + '/site/wrt/data/' + path),
    );
  }
  return urls;
}
async function fetchData(path) {
  for (const u of dataUrls(path)) {
    try { const r = await fetch(u, { cache: 'force-cache' }); if (r.ok) return r; } catch (e) { /* Fall through to the next mirror tier. */ }
  }
  throw new Error('Unable to load data: ' + path);
}

async function loadSiteConfig() {
  const response = await fetch(releaseAssetUrl('config/site.json'), { cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load site configuration: HTTP ' + response.status);
  let source;
  try { source = await response.json(); }
  catch (error) { throw new Error('Site configuration JSON is invalid'); }
  const module = await import(releaseAssetUrl('./lib/site-config.js'));
  const normalized = module.normalizeSiteConfig(source);
  return module.siteRuntimeConfig(normalized);
}

async function loadJson(path) {
  const key = `wrt_cache:${SITE_RELEASE_SHA}:${path}`;
  const cached = localStorage.getItem(key);
  if (cached) {
    try { return JSON.parse(cached); }
    catch (e) { try { localStorage.removeItem(key); } catch (removeError) { /* ignore */ } }
  }
  const text = await (await fetchData(path)).text();
  const value = JSON.parse(text);
  safeSet(key, text);
  return value;
}
