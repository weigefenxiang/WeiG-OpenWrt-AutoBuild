#!/usr/bin/env node
// Integration diagnostic: real Catalog, downloads and GitHub editor navigation.
// Never creates an Issue, dispatches a workflow or compiles firmware.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { CdpConnection, evaluateFunction, findChrome, httpJson, launchChrome, startPreview, waitFor } from './test-ui-browser.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const directory = mkdtempSync(join(tmpdir(), 'weig-submit-browser-'));
const sources = process.argv.slice(2).length ? process.argv.slice(2) : ['iStoreOS', 'Lienol', 'OpenWrt', 'ImmortalWrt', 'lede', 'hanwckf'];
const explicitTheme = process.env.WEIG_SUBMIT_THEME === 'explicit';
const stagedCompatibility = process.env.WEIG_COMPATIBILITY_FILE
  ? JSON.parse(readFileSync(process.env.WEIG_COMPATIBILITY_FILE, 'utf8')) : null;
const preview = await startPreview();
let browser;
const requests = [];
try {
  assert(findChrome(), 'Chrome is required');
  browser = await launchChrome(findChrome(), preview.url, { width: 1366, height: 768 });
  await browser.connection.command('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: directory });
  const evaluate = (fn, args = []) => evaluateFunction(browser, fn, args);
  const ready = source => waitFor('complete Native workspace ' + source, () => evaluate(`(source) =>
    state.source?.id === source && catalogLoadMode === 'idle' && ACTIVE_PROFILE_BASELINE &&
    !document.getElementById('submitBtn').disabled && document.getElementById('targetPicker')?.getAttribute('aria-busy') === 'false'`, [source]), 120000);
  await waitFor('initial Source controls', () => evaluate(`() => document.getElementById('targetSource')?.options.length > 0`), 60000);
  for (const source of sources) {
    // Each Source's Native export is independent of another Source's imported
    // user intent. Cross-Source migration is a different configuration test.
    if (requests.length) {
      await evaluate(`() => { localStorage.clear(); return true; }`);
      await browser.connection.command('Page.navigate', { url: preview.url + '&sourceCase=' + source });
      await waitFor('fresh document ' + source, () => evaluate(`(source) =>
        new URL(location.href).searchParams.get('sourceCase') === source &&
        document.getElementById('targetSource')?.options.length > 0`, [source]), 60000);
    }
    await evaluate(`(source) => {
      closeModal();
      const select = document.getElementById('targetSource');
      if (![...select.options].some(option => option.value === source)) throw Error('Missing Source: ' + source);
      select.value = source; select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }`, [source]);
    await ready(source);
    if (stagedCompatibility) await evaluate(`document => {
      const fetch = CATALOG_LOADER.fetchCompatibility.bind(CATALOG_LOADER);
      CATALOG_LOADER.fetchCompatibility = async (...args) => ({ ...(await fetch(...args)), compatibility: document });
    }`, [stagedCompatibility]);
    // Prefer a real generic x86 profile where the source provides one. Sources
    // without x86 keep their Native default Profile; no fabricated target data.
    await evaluate(`async () => {
      const generic = target => target.board === 'x86' && target.profiles.some(profile => /generic/i.test(profile.id));
      const target = MENU_CATALOG.targets.find(target => generic(target) && /64/.test(target.subtarget)) ||
        MENU_CATALOG.targets.find(generic);
      const profile = target?.profiles.find(profile => /generic/i.test(profile.id));
      if (target && profile) {
        renderCatalogPicker(false, { sourceId: state.source.id, branchId: state.version.id,
          system: target.board, subtarget: target.subtarget, profileSymbol: profile.id });
        await applyCatalogTarget();
      }
      return true;
    }`);
    await ready(source);
    const settings = await evaluate(`(explicitTheme) => {
      state.timezone = 'Asia/Singapore'; renderFirmwareSettings();
      setFirmwareTheme('@base');
      if (explicitTheme) {
        const select = document.getElementById('fwThemeBox');
        const native = resolveCatalogTheme().package;
        const option = [...select.options].find(option => option.value !== '@base' && option.value !== native);
        if (!option) throw Error('Source has no alternative theme for this test');
        select.value = option.value; select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      for (const [id, value] of [['lanipBox', '10.20.30.1'], ['ntpBox', 'cloudflare']]) {
        const element = document.getElementById(id); element.value = value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const password = document.getElementById('rootpwBox'); password.value = '';
      password.dispatchEvent(new Event('input', { bubbles: true }));
      const mirrors = [...document.getElementById('packageMirrorBox').options].map(option => option.value);
      document.getElementById('submitBtn').click();
      return { mirrors, source: state.source.id, branch: state.version.branch,
        theme: state.theme, mode: state.mode, methodCount: document.querySelectorAll('#modalBody .method-card').length,
        login: document.getElementById('loginInfo').textContent };
    }`, [explicitTheme]);
    assert(settings.mirrors.includes('source-default'), JSON.stringify(settings));
    assert.equal(settings.methodCount, 3, JSON.stringify(settings));
    const shot = await browser.connection.command('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(directory, source + '-confirmation.png'), Buffer.from(shot.data, 'base64'));
    console.log(`[submit-browser] testing ${source}/${settings.branch}: ${settings.theme}`);
    if (['iStoreOS', 'Lienol'].includes(source)) {
      assert.deepEqual(settings.mirrors, ['source-default']);
      assert.match(settings.login, /none|无/);
    }
    const before = new Set(readdirSync(directory));
    // Real user gesture for the request action; no external submission occurs.
    const point = await evaluate(`() => {
      const element = document.querySelector('#modalBody .method-card button');
      element.scrollIntoView({ block: 'center' }); const rect = element.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }`);
    for (const type of ['mousePressed', 'mouseReleased']) await browser.connection.command('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 });
    const requestPath = await waitFor('real JSON download ' + source, () => {
      const name = readdirSync(directory).find(name => !before.has(name) && name.endsWith('.json'));
      return name && statSync(join(directory, name)).size > 100 ? join(directory, name) : null;
    }, 120000).catch(async error => {
      const diagnostic = await evaluate(`() => ({ modal: document.getElementById('modalBody').textContent,
        ready: submitReadiness(), target: state.device?.target,
        buttons: [...document.querySelectorAll('#modalBody button')].map(button => ({ text: button.textContent, disabled: button.disabled })) })`);
      throw Error(error.message + '\n' + JSON.stringify(diagnostic));
    });
    const payload = JSON.parse(readFileSync(requestPath, 'utf8'));
    assert.equal(payload.schema, 6); assert.equal(payload.source, source);
    assert.equal(payload.lanip, '10.20.30.1'); assert.equal(payload.firmware.ntp, 'cloudflare');
    assert.equal(payload.firmware.timezone, 'Asia/Singapore'); assert.equal(payload.firmware.packageMirror, 'source-default');
    assert.equal(payload.firmware.themeMode, settings.theme === '@base' ? 'inherit' : 'explicit');
    assert(!Object.hasOwn(payload, 'rootpw'), 'blank password must preserve Native/Fork policy');
    const editor = await waitFor('corresponding GitHub editor', async () => {
      const pages = await httpJson(browser.port, '/json/list');
      return pages.find(page => page.type === 'page' && page.url.startsWith('https://github.com/') &&
        (page.url.includes('/issues/new') || page.url.includes('/login?'))) || null;
    }, 40000);
    const destination = new URL(editor.url);
    const expectedEditor = destination.pathname === '/login' ? new URL(destination.searchParams.get('return_to'), destination.origin) : destination;
    assert.match(expectedEditor.pathname, /^\/[^/]+\/WeiG-OpenWrt-AutoBuild\/issues\/new$/);
    assert.equal(expectedEditor.searchParams.get('template'), 'custom-build.yml');
    assert(expectedEditor.searchParams.get('title').includes('/' + source + '/'));
    await browser.connection.command('Target.closeTarget', { targetId: editor.id });
    requests.push(requestPath);
    // Re-import the real downloaded JSON through the existing File import path.
    await evaluate(`async (payload, filename) => {
      closeModal();
      await importConfigFile(new File([JSON.stringify(payload)], filename, { type: 'application/json' }));
      return true;
    }`, [payload, requestPath.split(/[\\/]/).at(-1)]);
    await ready(source);
    assert.equal(await evaluate(`() => configFirmwareSettings(buildFinalConfigText()).themeMode`), payload.firmware.themeMode);
    if (source === 'iStoreOS') {
      const reviewDirectory = mkdtempSync(join(directory, 'review-'));
      await browser.connection.command('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: reviewDirectory });
      const reviewBefore = new Set(readdirSync(reviewDirectory));
      await evaluate(`() => {
        globalThis.__reviewBaseline = snapshotCatalogUiState();
        const option = menuOptionBySymbol.get('PACKAGE_luci-app-baidupcs-web');
        if (!option) throw Error('Missing real absent-provider regression option');
        applyCatalogIntent(option, 'y', false, 'user'); renderCatalogUiAfterIntent();
        openSubmitModal(); document.querySelectorAll('#modalBody .method-card button')[2].click();
      }`);
      await waitFor('unified build warning review', () => evaluate(`() =>
        !$('modal').hidden && $('modalTitle').textContent === t('compatibility.warningTitle')`), 60000);
      const review = await evaluate(`() => {
        const buttons = [...$('modalBody').querySelectorAll('.catalog-conflict-state button')];
        return { y: buttons.find(button => button.dataset.value === 'y')?.className,
          aria: buttons.find(button => button.dataset.value === 'y')?.getAttribute('aria-pressed'),
          preview: $('modalBody').querySelector('.configuration-review')?.textContent,
          busy: $('app').getAttribute('aria-busy'), cursor: getComputedStyle(document.body).cursor };
      }`);
      assert.match(review.y, /is-current/); assert.match(review.y, /is-editable/);
      assert.equal(review.aria, 'true'); assert.match(review.preview, /Y → N/);
      assert.equal(review.busy, 'false'); assert.notEqual(review.cursor, 'progress');
      await evaluate(`() => $('modalBody').querySelector('.compatibility-recommended').click()`);
      await waitFor('applied review remains open', () => evaluate(`() =>
        !$('modal').hidden && $('modalBody').querySelector('.configuration-continue') &&
        $('app').getAttribute('aria-busy') === 'false'`), 60000);
      assert.deepEqual(readdirSync(reviewDirectory).filter(name => !reviewBefore.has(name)), [],
        'applying a recommendation must not download before confirmation');
      assert.equal(await evaluate(`() => menuValues.get('PACKAGE_luci-app-baidupcs-web')`), 'n');
      assert.match(await evaluate(`() => $('modalBody').querySelector('.configuration-review').textContent`), /Y → N/);
      await evaluate(`() => $('modalBody').querySelector('.configuration-continue').click()`);
      const reviewedPath = await waitFor('confirmed reviewed config download', () => {
        const name = readdirSync(reviewDirectory).find(name => !reviewBefore.has(name) && name.endsWith('.config'));
        return name && statSync(join(reviewDirectory, name)).size > 100 ? join(reviewDirectory, name) : null;
      }, 60000);
      assert.doesNotMatch(readFileSync(reviewedPath, 'utf8'), /^CONFIG_PACKAGE_luci-app-baidupcs-web=y$/m);
      // Closing an applied review is cancellation, never an implicit submit.
      await evaluate(`async () => {
        restoreCatalogUiState(__reviewBaseline); renderCatalogUiAfterIntent(); closeModal();
        applyCatalogIntent(menuOptionBySymbol.get('PACKAGE_luci-app-baidupcs-web'), 'y', false, 'user');
        globalThis.__reviewLoaded = (await loadCompatibilityEvaluation()).loaded;
        globalThis.__reviewResult = null;
        withUiOperation('review regression', () => withUiOperationInteraction(() =>
          openBuildWarningModal(buildWarningEvaluation(__reviewLoaded))))
          .then(action => { globalThis.__reviewResult = action; });
      }`);
      await waitFor('custom review visible', () => evaluate(`() =>
        $('modalBody').querySelector('.catalog-conflict-state button[data-value="n"]') &&
        $('app').getAttribute('aria-busy') === 'false'`), 60000);
      await evaluate(`() => {
        $('modalBody').querySelector('.catalog-conflict-state button[data-value="n"]').click();
        $('modalBody').querySelector('.compatibility-custom').click();
      }`);
      await waitFor('custom result retained', () => evaluate(`() =>
        $('modalBody').querySelector('.configuration-continue') && $('app').getAttribute('aria-busy') === 'false'`), 60000);
      await evaluate(`() => closeModal()`);
      await waitFor('applied review cancellation', () => evaluate(`() => __reviewResult === 'cancel' && !activeUiOperation`), 60000);
      await evaluate(`() => { restoreCatalogUiState(__reviewBaseline); renderCatalogUiAfterIntent(); }`);
      await evaluate(`() => {
        applyCatalogIntent(menuOptionBySymbol.get('PACKAGE_luci-app-baidupcs-web'), 'y', false, 'user');
        globalThis.__forceBefore = buildFinalConfigText(); globalThis.__forceResult = null;
        withUiOperation('force regression', () => ensureBuildPreflight())
          .then(result => { globalThis.__forceResult = result; });
      }`);
      await waitFor('force warning review', () => evaluate(`() =>
        !$('modal').hidden && $('modalTitle').textContent === t('compatibility.warningTitle')`), 60000);
      await evaluate(`() => $('modalBody').querySelector('.compatibility-force').click()`);
      await evaluate(`() => $('modalBody').querySelector('.compatibility-force-confirm').click()`);
      await waitFor('force preserves native intent', () => evaluate(`() => __forceResult && !activeUiOperation`), 60000);
      assert(await evaluate(`() => __forceResult.compatibility?.forced.includes('BLD-0015') &&
        !__forceResult.configuration && __forceResult.config === __forceBefore &&
        menuValues.get('PACKAGE_luci-app-baidupcs-web') === 'y'`),
        'force must retain Y and the exact config, with compatibility audit instead of a duplicate provider audit');
      await evaluate(`() => { UI_SESSION.compatibility.clearAcknowledgement();
        restoreCatalogUiState(__reviewBaseline); renderCatalogUiAfterIntent(); }`);
      await browser.connection.command('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: directory });
      console.log('[submit-browser] Catalog-evidence Y/N states, preview, explicit confirmation, custom review and cancellation passed');
    }
    // Third method: actual .config download from the same configuration builder.
    const configBefore = new Set(readdirSync(directory));
    await evaluate(`() => { openSubmitModal(); document.querySelectorAll('#modalBody .method-card button')[2].click(); return true; }`);
    const configPath = await waitFor('real .config download', () => {
      const name = readdirSync(directory).find(name => !configBefore.has(name) && name.endsWith('.config'));
      return name && statSync(join(directory, name)).size > 100 ? join(directory, name) : null;
    }, 120000);
    assert.match(readFileSync(configPath, 'utf8'), /CONFIG_TARGET_/);
    // Second method uses the shared importer, not an independent serializer.
    assert(await evaluate(`() => {
      const input = document.getElementById('configImport'); const original = input.click;
      let called = false; input.click = () => { called = true; };
      try { document.querySelectorAll('#modalBody .method-card button')[1].click(); }
      finally { input.click = original; reopenSubmitAfterImport = false; }
      return called;
    }`));
    // Incomplete selectors must not expose the previous empty dialog shell.
    assert(await evaluate(`() => {
      const element = document.getElementById('ntpBox'); const previous = element.innerHTML;
      element.textContent = ''; closeModal(); openSubmitModal();
      const hidden = document.getElementById('modal').hidden;
      element.innerHTML = previous; renderFirmwareSettings(); return hidden;
    }`));
    console.log(`[submit-browser] ${source}/${settings.branch}: JSON, editor, import, .config, readiness passed`);
  }
  const parser = spawnSync(process.execPath, [join(root, 'tools/test-request-parser.mjs'), ...requests], {
    cwd: root, encoding: 'utf8', timeout: 600000, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
  });
  writeFileSync(join(directory, 'parser-results.txt'), parser.stdout + parser.stderr);
  assert.equal(parser.status, 0, parser.stderr || parser.error?.message);
  console.log(parser.stdout);
  console.log(`[submit-browser] evidence: ${directory}`);
} finally {
  await browser?.close(); preview.stop();
}
