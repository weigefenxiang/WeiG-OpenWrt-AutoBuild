/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Release-scoped static data loading runtime.
 */
'use strict';

/* ============ 数据加载 / Data loading ============ */
function dataUrls(path) {
  if (path.includes('..') || !/^[\w./-]+$/.test(path)) throw new Error('非法数据路径: ' + path);
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
    try { const r = await fetch(u, { cache: 'force-cache' }); if (r.ok) return r; } catch (e) { /* 失败则回退到下一级镜像 / Fall through to the next mirror tier */ }
  }
  throw new Error('数据加载失败: ' + path);
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
