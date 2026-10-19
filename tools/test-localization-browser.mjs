#!/usr/bin/env node
// Real gzip/UI smoke test. Never downloads build requests or opens/submits Issues.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startPreview, launchChrome, findChrome, evaluateFunction, waitFor } from './test-ui-browser.mjs';
const locales = JSON.parse(readFileSync(new URL('../tools/i18n-locales.json', import.meta.url), 'utf8')).languages;
const preview = await startPreview();
const evidence = mkdtempSync(join(tmpdir(), 'weig-localization-browser-'));
let browser;
try {
  browser = await launchChrome(findChrome(), preview.url, { width: 1366, height: 900 });
  const evaluate = (fn, args = []) => evaluateFunction(browser, fn, args);
  await waitFor('real Catalog and independent startup language', () => evaluate(`() =>
    typeof catalogLoadMode !== 'undefined' && catalogLoadMode === 'idle' &&
    typeof I18N !== 'undefined' && I18N?.loaded.size === 1 &&
    ACTIVE_PROFILE_BASELINE && !document.getElementById('submitBtn').disabled`), 120000);
  assert.equal(await evaluate(`() => {
    $('rootpwBox').value=''; $('rootpwBox').dispatchEvent(new Event('input',{bubbles:true}));
    const mirror=$('packageMirrorBox'); const alternative=[...mirror.options].find(option=>option.value!==mirror.value);
    if(alternative){mirror.value=alternative.value;mirror.dispatchEvent(new Event('change',{bubbles:true}));}
    return state.rootpw; }`), '', 'explicitly deleting @empty must preserve upstream password intent');
  const baseline = await evaluate(`() => ({source:$('targetSource').value,branch:$('targetBranch').value,
    target:[...document.querySelectorAll('#targetDynamicSelectors select')].map(node=>[node.id,node.value]),
    password:$('rootpwBox').value,mirror:$('packageMirrorBox').value})`);
  for (const viewport of [{ width: 1366, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await browser.connection.command('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: false });
    for (const locale of locales) {
      await evaluate(`async id => { await selectUiLanguage(id);
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))); return true; }`, [locale.id]);
      const actual = await evaluate(`() => ({language:state.lang,dir:document.documentElement.dir,
        title:document.documentElement.lang,source:$('targetSource').value,branch:$('targetBranch').value,
        target:[...document.querySelectorAll('#targetDynamicSelectors select')].map(node=>[node.id,node.value]),
        password:$('rootpwBox').value,submit:$('submitBtn').querySelector('.action-label-full').textContent,
        mirror:$('packageMirrorBox').value,mirrorLabels:[...$('packageMirrorBox').options]
          .map(option=>({actual:option.textContent,expected:t('fw.packageMirror.'+option.value)})),
        expected:t('btn.submit'),width:document.documentElement.scrollWidth,viewport:innerWidth,
        loaded:[...I18N.loaded],busy:$('submitBtn').disabled})`);
      const effective = locale;
      assert.equal(actual.language, effective.id);
      assert.equal(actual.title, effective.id);
      assert.equal(actual.dir, effective.dir);
      assert.equal(actual.source, baseline.source);
      assert.equal(actual.branch, baseline.branch);
      assert.deepEqual(actual.target, baseline.target, locale.id + ': changing language must not change Target');
      assert.equal(actual.password, baseline.password, locale.id + ': language must not reset explicit password intent');
      assert.equal(actual.mirror, baseline.mirror, locale.id + ': translated mirror labels must not change selection');
      assert(actual.mirrorLabels.every(row => row.actual === row.expected), locale.id + ': mirror labels must use the active UI language');
      assert.equal(actual.submit, actual.expected);
      assert(actual.width <= actual.viewport + 1, locale.id + ': horizontal document overflow');
      assert(!actual.busy, locale.id + ': translation must not block a ready build');
      await evaluate(`() => { openSubmitModal(); return true; }`);
      const modal = await evaluate(`() => ({title:$('modalTitle').textContent,expected:t('btn.submit'),
        method:document.querySelector('.method-primary h4').textContent,expectedMethod:t('submit.m1.title'),
        width:document.documentElement.scrollWidth,viewport:innerWidth})`);
      assert.equal(modal.title, modal.expected);
      assert.equal(modal.method, modal.expectedMethod);
      assert(modal.width <= modal.viewport + 1, locale.id + ': translated confirmation must fit the viewport');
      if (['zh-CN', 'de', 'ar', 'he'].includes(locale.id)) {
        const screenshot = await browser.connection.command('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(evidence, locale.id + '-' + viewport.width + '.png'), Buffer.from(screenshot.data, 'base64'));
      }
      await evaluate(`() => closeModal()`);
    }
    console.log('[localization-browser] real gzip/UI/selection/direction passed for ' + locales.length + ' locales at ' + viewport.width);
  }
  const downloads = await evaluate(`() => performance.getEntriesByType('resource')
    .map(row=>new URL(row.name).pathname).filter(path=>path.includes('/data/i18n/')&&!path.endsWith('/index.json'))`);
  const unique = [...new Set(downloads)];
  assert.equal(unique.length, locales.length, 'every language entry has its own independent asset');
  assert(unique.every(path => path.endsWith('.json.gz')), 'no uncompressed or all-languages bundle');
  const codec = await evaluate(`() => performance.getEntriesByType('resource').map(row=>new URL(row.name))
    .filter(url=>url.pathname.endsWith('/lib/data-codec.js')).map(url=>url.search)`);
  assert.equal(codec.length, 1, 'site and Catalog must reuse the same release-scoped decoder module');
  assert(new URLSearchParams(codec[0]).has('r'), 'shared decoder must not drop release cache scoping');
  console.log('[localization-browser] evidence: ' + evidence);
} finally { await browser?.close(); preview.stop(); }
