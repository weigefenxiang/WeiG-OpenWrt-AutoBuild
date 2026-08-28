/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Build request, immutable identity, and GitHub submission controller.
 */
'use strict';

/* ============ Submit a cloud build ============ */
function targetRepo() {
  if (state.mode === 'self') {
    const owner = state.owner.replace(/[^A-Za-z0-9-]/g, '');
    return owner ? owner + '/' + REPO_NAME : null;
  }
  return OFFICIAL_REPO;
}

const MOBILE_ISSUE_URL_LIMIT = 6000;
const mobileIssueClient = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
function issueSubmitUrl(repo, title, body = '') {
  const params = new URLSearchParams({ template: 'custom-build.yml', title });
  if (body) params.set('body', body);
  return 'https://github.com/' + repo + '/issues/new?' + params;
}
function submitReadiness() {
  const isCatalog = state.device?.id === 'catalog-target';
  const checks = [
    ['target', Boolean(state.device && state.source && state.version && state.variant)],
    ['catalog', !isCatalog || Boolean(MENU_CATALOG && catalogLoadMode === 'idle')],
    ['menuconfig', !isCatalog || Boolean(MENU_CATALOG && menuOptionBySymbol.size)],
    ['profile-baseline', !isCatalog || Boolean(ACTIVE_PROFILE_BASELINE && PROFILE_BASELINE_STORE)],
    ['theme', Boolean($('fwThemeBox')?.options?.length && $('fwThemeBox')?.value)],
    ['defconfig', typeof state.useDefconfig === 'boolean'],
    ['identity', Boolean(state.buildMeta && state.buildMeta.version === state.siteVersion &&
      state.buildMeta.siteSha256 === SITE_RELEASE_SHA &&
      BUILD_IDENTITY_MODULE.normalizeBuildEnvironment(state.buildMeta.branch) &&
      BUILD_IDENTITY_MODULE.normalizeBuildCommit(state.buildMeta.commit))],
  ];
  return { ok: checks.every(([, ok]) => ok), missing: checks.filter(([, ok]) => !ok).map(([name]) => name) };
}
function updateSubmitGate() {
  const button = $('submitBtn');
  if (!button) return;
  const readiness = submitReadiness();
  button.disabled = !readiness.ok;
  button.setAttribute('aria-disabled', String(!readiness.ok));
  bindUiTooltipContent(button, { body: readiness.ok ? '' : t('build.waitingStages', {
    list: formatList(readiness.missing),
  }) });
}
async function mobileIssuePayload(payload) {
  if (!mobileIssueClient()) return '';
  if (!('CompressionStream' in window)) throw new Error('This mobile browser does not support compressed requests; use a browser to upload the JSON file');
  const raw = JSON.stringify(payload);
  const zipped = new Uint8Array(await new Response(
    new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let binary = '';
  for (let i = 0; i < zipped.length; i += 0x4000) binary += String.fromCharCode(...zipped.subarray(i, i + 0x4000));
  const body = '<!-- WEIG_BUILD_REQUEST_GZIP_BASE64\n' + btoa(binary) + '\n-->';
  if (encodeURIComponent(body).length > MOBILE_ISSUE_URL_LIMIT) {
    throw new Error('The mobile request is too large; use a browser to upload the JSON file you just downloaded');
  }
  return body;
}

async function generateResolvedConfigText(options = {}) {
  return generateConfigText(options);
}
function buildRequestOverrides(configText) {
  if (!ACTIVE_PROFILE_BASELINE || !PROFILE_BASELINE_MODULE) {
    throw new Error('Native Profile baseline has not finished loading');
  }
  const finalValues = PROFILE_BASELINE_MODULE.parseConfigMap(configText);
  const allowedSymbols = CATALOG_MODEL?.bySymbol instanceof Map
    ? new Set(CATALOG_MODEL.bySymbol.keys()) : new Set();
  return PROFILE_BASELINE_MODULE.diffProfileBaseline(
    ACTIVE_PROFILE_BASELINE, finalValues, { allowedSymbols },
  );
}

function buildAudit(compatibility = null) {
  return {
    defconfig: { enabled: state.useDefconfig === true },
    ...(compatibility?.forced?.length ? { compatibility } : {}),
  };
}

function schema6TargetIdentity(target = state.device?.target) {
  const profileSymbol = String(target?.profileSymbol ||
    (target?.profile ? `DEVICE_${target.profile}` : ''));
  const identity = {
    system: String(target?.system || ''),
    subtarget: String(target?.subtarget || ''),
    profileSymbol,
    profileSelector: String(target?.profileSelector || ''),
  };
  if (!identity.system || !identity.profileSymbol || !identity.profileSelector) {
    throw new Error('Catalog Target identity is incomplete');
  }
  return identity;
}

function openSubmitModal() {
  const readiness = submitReadiness();
  if (!readiness.ok) {
    updateSubmitGate();
    showToast(t('build.notReady', { list: formatList(readiness.missing) }));
    return;
  }
  const repo = targetRepo();
  if (!repo) { alert(t('owner.required')); $('ownerBox').focus(); return; }
  const sel = effectiveSelection();
  const tag = BUILD_IDENTITY_MODULE.normalizeBuildTag($('tagBox').value, t('tag.anonymous'));
  $('tagBox').value = tag;
  const plugins = sel.normal.map((p) => p.id)
    .concat(sel.forced.map((p) => '+' + p.id))
    .concat(sel.removed.map((p) => '-' + p.id));
  const firmware = {
    timezone: state.timezone,
    theme: $('fwThemeBox').value,
    ntp: $('ntpBox').value,
    packageMirror: $('packageMirrorBox').value,
  };
  Object.assign(state, firmware);
  const requestStamp = localStamp();
  const sourceEnv = BUILD_IDENTITY_MODULE.normalizeBuildEnvironment(state.buildMeta?.branch);
  const titlePrefix = '[build] ' + BUILD_IDENTITY_MODULE.buildIssueRequestPrefix(sourceEnv) + requestStamp + '/';
  const titleSuffix = '/' + requestTargetProfilePart() + '/' + state.source.id + '/' + state.version.id + '/' + selectedTargetProfileName();
  const titleTag = BUILD_IDENTITY_MODULE.fitBuildIssueTag(tag, titlePrefix, titleSuffix, 'anonymous');
  if (!titleTag) {
    showToast(t('runtime.611eaffc726e'));
    return;
  }
  const title = titlePrefix + titleTag + titleSuffix;

  openModal(t('btn.submit'));
  const mb = $('modalBody');
  mb.textContent = '';
  const sum = document.createElement('div');
  sum.className = 'summary-box';
  sum.textContent = t('submit.confirm', {
    brand: state.device.brand, device: state.device.name, source: state.source.label,
    version: state.version.label, variant: state.variant.name, n: plugins.length, tag,
    timezone: $('timezoneBox').value,
    theme: $('fwThemeBox').selectedOptions[0].textContent,
    ntp: $('ntpBox').selectedOptions[0].textContent,
    packageMirror: $('packageMirrorBox').selectedOptions[0].textContent,
    pageVersion: state.siteVersion,
  });
  mb.appendChild(sum);
  if (state.importedConfig && !importedTargetVerified) {
    const warning = document.createElement('p');
    warning.className = 'import-error';
    warning.textContent = t('build.customTargetWarning');
    mb.appendChild(warning);
  }

  const card = (titleKey, descText, btnKey, onClick) => {
    const c = document.createElement('div');
    c.className = 'method-card';
    const h = document.createElement('h4');
    h.textContent = t(titleKey);
    c.appendChild(h);
    const p = document.createElement('p');
    p.textContent = descText;
    c.appendChild(p);
    const button = document.createElement('button');
    button.className = 'btn btn-primary';
    button.type = 'button';
    button.textContent = t(btnKey);
    button.addEventListener('click', onClick);
    c.appendChild(button);
    mb.appendChild(c);
  };
  card('submit.m1.title', state.mode === 'self' ? t('submit.m1.descSelf') : t('submit.m1.desc'),
    'submit.m1.btn', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await ensurePackageMirrors();
        const forcedCompatibility = await ensureCompatibilityRules();
        const config = await generateResolvedConfigText();
        const overrides = buildRequestOverrides(config);
        const payload = {
          schema: 6,
          generatedAt: new Date().toISOString(),
          requestId: requestStamp,
          sourceEnv,
          requestCommit: String(state.buildMeta?.commit || ''),
          pageVersion: state.siteVersion,
          configId: [state.device.id, state.source.id, state.version.id, state.variant.id].join('/'),
          device: state.device.id, source: state.source.id, version: state.version.id,
          branch: state.version.branch,
          variant: state.variant.id, plugins, tag, lanip: state.lanip, overrides,
          use_defconfig: state.useDefconfig === true,
          audit: buildAudit(forcedCompatibility),
          firmware: configFirmwareSettings(config),
          catalog: currentCatalogContract(),
        };
        if (['custom-target', 'catalog-target'].includes(state.device.id)) {
          payload.customTarget = schema6TargetIdentity();
        }
        if (state.rootpw) payload.rootpw = state.rootpw;
        const filename = [requestStamp, requestTargetProfilePart(true), safeDownloadNamePart(state.source.id, 'source'),
          safeDownloadNamePart(state.version.id, 'branch'), safeDownloadNamePart(selectedTargetProfileName())].join('-') + '.json';
        downloadBlob(JSON.stringify(payload, null, 2) + '\n', 'application/json;charset=utf-8', filename);
        const issueUrl = issueSubmitUrl(repo, title, await mobileIssuePayload(payload));
        const issueWindow = window.open(issueUrl, '_blank');
        if (issueWindow) issueWindow.opener = null;
        else window.location.assign(issueUrl);
      } catch (err) {
        showGenerationError(err);
      } finally {
        button.disabled = false;
      }
    });

  card('submit.existing.title', t('submit.existing.desc'), 'btn.import', () => {
    reopenSubmitAfterImport = true;
    closeModal();
    $('configImport').click();
  });

  card('submit.download.title', t('submit.download.desc'), 'btn.download', (event) => {
    downloadConfig(event.currentTarget);
  });

  const p3 = document.createElement('p');
  p3.textContent = t('submit.footer', { tag });
  mb.appendChild(p3);
}
$('submitBtn').addEventListener('click', openSubmitModal);
