#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  artifactBuildRef,
  artifactBuildTag,
  BUILD_TAG_MAX_CODE_POINTS,
  catalogDataBranch,
  buildActionRunTitle,
  buildEnvironmentIdentity,
  buildEnvironmentPrefix,
  buildIssueRequestPrefix,
  fitBuildIssueTag,
  ISSUE_TITLE_MAX_CODE_POINTS,
  isValidBuildTag,
  normalizeBuildEnvironment,
  normalizeBuildCommit,
  normalizeBuildTag,
  normalizeDeploymentIdentity,
  parseBuildIssueTitleIdentity,
} from '../site/wrt/lib/build-identity.js';
import { validateCatalogProvenance } from '../site/wrt/lib/catalog-loader.js';

assert.equal(normalizeBuildEnvironment('refs/heads/dev'), 'dev');
assert.equal(normalizeBuildEnvironment('origin/staging'), 'staging');
assert.equal(normalizeBuildEnvironment('main'), 'main');
assert.equal(normalizeBuildEnvironment('fix/kconfig-serializer-hardening'), 'fix/kconfig-serializer-hardening');
assert.equal(normalizeBuildEnvironment('feat/rootfs-capacity-guidance'), 'feat/rootfs-capacity-guidance');
assert.equal(normalizeBuildEnvironment('bad branch'), '');
assert.equal(normalizeBuildEnvironment('../main'), '');

const catalogChannels = {
  fixDefault: 'catalog-dev', fixOverrides: {},
  dev: 'catalog-dev', staging: 'catalog-staging', main: 'catalog-main',
};
assert.equal(catalogDataBranch('fix-F', catalogChannels), 'catalog-dev');
assert.equal(catalogDataBranch('fix-next.test', catalogChannels), 'catalog-dev');
assert.equal(catalogDataBranch('fix-a', catalogChannels), 'catalog-dev');
const catalogOverrideChannels = {
  ...catalogChannels,
  fixOverrides: {
    'fix-runtime-change': 'catalog-fix-runtime-data',
    'fix-B': 'catalog-fix-A',
  },
};
assert.equal(catalogDataBranch('fix-runtime-change', catalogOverrideChannels), 'catalog-fix-runtime-data');
assert.equal(catalogDataBranch('fix-B', catalogOverrideChannels), 'catalog-fix-A');
assert.throws(() => catalogDataBranch('fix-F', {
  ...catalogChannels, fixOverrides: { 'fix-F': 'catalog-other' },
}), /invalid Catalog data branch override/);
assert.throws(() => catalogDataBranch('fix-F', { ...catalogChannels, fixDefault: 'catalog-main' }),
  /invalid Catalog data branch/);
// Slash-style historical branches no longer receive a dedicated Catalog data lane.
assert.equal(catalogDataBranch('fix/catalog-compatibility', catalogChannels), 'catalog-main');
assert.equal(catalogDataBranch('dev', catalogChannels), 'catalog-dev');
assert.equal(catalogDataBranch('staging', catalogChannels), 'catalog-staging');
assert.equal(catalogDataBranch('main', catalogChannels), 'catalog-main');
assert.equal(catalogDataBranch('', catalogChannels), 'catalog-main');
assert.equal(catalogDataBranch('feature/unpublished', catalogChannels), 'catalog-main');
assert.throws(() => catalogDataBranch('dev', { ...catalogChannels, dev: 'catalog-main' }),
  /invalid Catalog data branch/);

const catalogProvenanceSha = 'f'.repeat(40);
const catalogProvenance = (codeRef) => ({
  provenance: {
    repository: 'owner/catalog', codeRef, codeSha: catalogProvenanceSha, complete: true,
  },
});
// Catalog snapshot provenance remains self-consistent independently of AutoBuild's routing choice.
assert.equal(validateCatalogProvenance(catalogProvenance('fix-F'), 'catalog-fix-F', 'owner/catalog')?.codeRef,
  'fix-F');
assert.equal(validateCatalogProvenance(catalogProvenance('fix-next.test'), 'catalog-fix-next.test', 'owner/catalog')?.codeRef,
  'fix-next.test');
assert.throws(() => validateCatalogProvenance(catalogProvenance('fix-F'), 'catalog-fix-G', 'owner/catalog'),
  /does not match catalog-fix-G/);
assert.throws(() => validateCatalogProvenance(catalogProvenance('fix/demo-A'), 'catalog-fix', 'owner/catalog'),
  /invalid Catalog data branch/);

assert.equal(normalizeBuildCommit('005e435f91b2c2891cf46468e2cb46e36519df8b'), '005e435f91b2c2891cf46468e2cb46e36519df8b');
assert.equal(normalizeBuildCommit('005E435F91B2C2891CF46468E2CB46E36519DF8B'), '005e435f91b2c2891cf46468e2cb46e36519df8b');
assert.equal(normalizeBuildCommit('005e435'), '');
assert.equal(normalizeBuildCommit('g05e435f91b2c2891cf46468e2cb46e36519df8b'), '');

const deploymentSiteSha = 'a'.repeat(64);
const deploymentStamp = { version: 'v2608090613', timezone: 'Asia/Shanghai', siteSha256: deploymentSiteSha, hashAlgorithm: 'sha256' };
const deploymentMeta = {
  version: 'v2608090613',
  timezone: 'Asia/Shanghai',
  branch: 'refs/heads/dev',
  commit: '63aafb274720345df1d5d659dbdebb2307865dd7',
  builtAt: '2026-08-09T06:13:00+08:00',
  siteSha256: deploymentSiteSha,
};
assert.deepEqual(normalizeDeploymentIdentity(deploymentStamp, deploymentMeta), {
  siteVersion: 'v2608090613',
  siteSha256: deploymentSiteSha,
  buildMeta: { ...deploymentMeta, branch: 'dev', commit: '63aafb274720345df1d5d659dbdebb2307865dd7' },
});
assert.deepEqual(normalizeDeploymentIdentity(deploymentStamp, null), { siteVersion: 'v2608090613', siteSha256: deploymentSiteSha, buildMeta: null });
assert.deepEqual(
  normalizeDeploymentIdentity(deploymentStamp, { ...deploymentMeta, version: 'v2608090612' }),
  { siteVersion: 'v2608090613', siteSha256: deploymentSiteSha, buildMeta: null },
);
assert.deepEqual(
  normalizeDeploymentIdentity(deploymentStamp, { ...deploymentMeta, commit: '63aafb2' }),
  { siteVersion: 'v2608090613', siteSha256: deploymentSiteSha, buildMeta: null },
);
assert.deepEqual(
  normalizeDeploymentIdentity(deploymentStamp, { ...deploymentMeta, branch: '../dev' }),
  { siteVersion: 'v2608090613', siteSha256: deploymentSiteSha, buildMeta: null },
);
assert.deepEqual(
  normalizeDeploymentIdentity(deploymentStamp, { ...deploymentMeta, timezone: 'UTC' }),
  { siteVersion: 'v2608090613', siteSha256: deploymentSiteSha, buildMeta: null },
);
assert.deepEqual(
  normalizeDeploymentIdentity(deploymentStamp, { ...deploymentMeta, builtAt: '2026-08-08T22:13:00Z' }),
  { siteVersion: 'v2608090613', siteSha256: deploymentSiteSha, buildMeta: null },
);
assert.deepEqual(
  normalizeDeploymentIdentity(deploymentStamp, { ...deploymentMeta, siteSha256: 'b'.repeat(64) }),
  { siteVersion: 'v2608090613', siteSha256: deploymentSiteSha, buildMeta: null },
);
assert.deepEqual(
  normalizeDeploymentIdentity({ ...deploymentStamp, siteSha256: 'bad' }, deploymentMeta),
  { siteVersion: 'v2608090613', siteSha256: '', buildMeta: null },
);
assert.deepEqual(
  normalizeDeploymentIdentity({ ...deploymentStamp, hashAlgorithm: 'sha1' }, deploymentMeta),
  { siteVersion: 'v2608090613', siteSha256: '', buildMeta: null },
);
assert.deepEqual(
  normalizeDeploymentIdentity({ ...deploymentStamp, timezone: 'UTC' }, deploymentMeta),
  { siteVersion: 'v----------', siteSha256: '', buildMeta: null },
);
assert.deepEqual(normalizeDeploymentIdentity(null, deploymentMeta), { siteVersion: 'v----------', siteSha256: '', buildMeta: null });


assert.equal(buildEnvironmentIdentity('dev'), 'dev');
assert.equal(buildEnvironmentIdentity('staging'), 'staging');
assert.equal(buildEnvironmentIdentity('main'), '');
assert.equal(buildEnvironmentIdentity('fix/kconfig-serializer-hardening'), 'fix_kconfig-serializer-hardening');
assert.equal(buildEnvironmentIdentity('feat/rootfs-capacity-guidance'), 'feat_rootfs-capacity-guidance');
assert.equal(buildEnvironmentPrefix('fix/kconfig-serializer-hardening'), 'fix_kconfig-serializer-hardening');

assert.equal(buildIssueRequestPrefix('dev'), 'dev/');
assert.equal(buildIssueRequestPrefix('staging'), 'staging/');
assert.equal(buildIssueRequestPrefix('main'), '');
assert.equal(buildIssueRequestPrefix('fix/kconfig-serializer-hardening'), 'fix_kconfig-serializer-hardening/');

assert.equal(artifactBuildRef('260807_2114-安卓', 'dev'), 'dev-260807_2114-安卓');
assert.equal(artifactBuildRef('260807_2114-安卓', 'staging'), 'staging-260807_2114-安卓');
assert.equal(artifactBuildRef('260807_2114-安卓', 'main'), '260807_2114-安卓');
assert.equal(artifactBuildRef('260807_2114-安卓', ''), '260807_2114-安卓');
assert.equal(artifactBuildRef('260807_2114-匿名', 'staging', 161), 'staging-260807_2114-匿名#161');
assert.equal(
  artifactBuildRef('260807_2114-安卓', 'fix/kconfig-serializer-hardening'),
  'fix_kconfig-serializer-hardening-260807_2114-安卓',
);

assert.equal(
  buildActionRunTitle('weigefenxiang', 141, '[build] 260809_0741/匿名/Generic_x86/64/ImmortalWrt/25.12/generic', 'main'),
  '260809_0741/匿名#141/Generic_x86/64/ImmortalWrt/25.12/generic',
);
assert.equal(
  buildActionRunTitle('weigefenxiang', 141, '[build] dev/260809_0741/匿名/Generic_x86/64/ImmortalWrt/25.12/generic', 'dev'),
  'dev-260809_0741/匿名#141/Generic_x86/64/ImmortalWrt/25.12/generic',
);
assert.equal(
  buildActionRunTitle('weigefenxiang', 141, '[build] fix_e-v2-probe/260809_0741/匿名/Generic_x86/64/ImmortalWrt/25.12/generic', 'fix/e-v2-probe'),
  'fix_e-v2-probe-260809_0741/匿名#141/Generic_x86/64/ImmortalWrt/25.12/generic',
);

// Build tags intentionally accept broad visible Unicode.
// "/" remains the Issue-title field delimiter, while control characters,
// empty tags and excessive tag length remain invalid.
const broadBuildTags = [
  '✔Defconfig',
  '×Defconfig',
  '✅ Defconfig',
  '测试（Defconfig）',
  'Android📱',
  'A+B (test)',
  'v2.0@dev#1',
  '中文＋English＋Emoji✅',
  '全角斜杠／允许',
  '符号 !@#$%^&*()[]{}=+,.?:;',
];

for (const tag of broadBuildTags) {
  const issueTitle =
    '[build] dev/260812_1845/' + tag +
    '/Generic_x86/64/ImmortalWrt/master/generic';
  const expected =
    'dev-260812_1845/' + tag +
    '#171/Generic_x86/64/ImmortalWrt/master/generic';

  assert.equal(
    buildActionRunTitle('weigefenxiang', 171, issueTitle, 'dev'),
    expected,
  );
}

assert.equal(
  buildActionRunTitle(
    'weigefenxiang',
    172,
    '[build] staging/260812_1846/✅ Defconfig/Generic_x86/64/ImmortalWrt/24.10/generic',
    'staging',
  ),
  'staging-260812_1846/✅ Defconfig#172/Generic_x86/64/ImmortalWrt/24.10/generic',
);

assert.equal(
  buildActionRunTitle(
    'weigefenxiang',
    173,
    '[build] fix_e-v2-probe/260812_1847/🧪实验版/Generic_x86/64/ImmortalWrt/24.10/generic',
    'fix/e-v2-probe',
  ),
  'fix_e-v2-probe-260812_1847/🧪实验版#173/Generic_x86/64/ImmortalWrt/24.10/generic',
);

for (const tag of ['   ', 'bad\tTag', 'bad\nTag']) {
  const issueTitle =
    '[build] dev/260812_1848/' + tag +
    '/Generic_x86/64/ImmortalWrt/master/generic';

  assert.equal(
    buildActionRunTitle('weigefenxiang', 174, issueTitle, 'dev'),
    '',
  );
}

const maxBuildTag = '界'.repeat(160);
assert.notEqual(
  buildActionRunTitle(
    'weigefenxiang',
    175,
    '[build] dev/260812_1849/' + maxBuildTag +
      '/Generic_x86/64/ImmortalWrt/master/generic',
    'dev',
  ),
  '',
);

const oversizedBuildTag = '界'.repeat(161);
assert.equal(
  buildActionRunTitle(
    'weigefenxiang',
    176,
    '[build] dev/260812_1850/' + oversizedBuildTag +
      '/Generic_x86/64/ImmortalWrt/master/generic',
    'dev',
  ),
  '',
);

assert.equal(BUILD_TAG_MAX_CODE_POINTS, 160);
assert.equal(ISSUE_TITLE_MAX_CODE_POINTS, 256);
assert.equal(normalizeBuildTag('  测试🧪  '), '测试🧪');
assert.equal(Array.from(normalizeBuildTag('🧪'.repeat(161))).length, 160);
assert.equal(normalizeBuildTag('bad\nTag'), 'badTag');
assert.equal(isValidBuildTag('🧪'.repeat(160)), true);
assert.equal(isValidBuildTag('🧪'.repeat(161)), false);
assert.equal(isValidBuildTag('bad\tTag'), false);
assert.equal(artifactBuildTag('测试🧪 Build Tag'), '测试BuildTag');
assert.equal(Array.from(artifactBuildTag('构'.repeat(40))).length, 24);

const issuePrefix = '[build] dev/260812_1849/';
const issueSuffix = '/Generic_x86/64/ImmortalWrt/master/generic';
assert.equal(fitBuildIssueTag('A/B', issuePrefix, issueSuffix), 'A／B');
const budgetedTag = fitBuildIssueTag('界'.repeat(160), 'X'.repeat(150), 'Y'.repeat(50));
assert.equal(Array.from(budgetedTag).length, 56);
assert.equal(Array.from('X'.repeat(150) + budgetedTag + 'Y'.repeat(50)).length, 256);
assert.equal(fitBuildIssueTag('test', 'X'.repeat(256), ''), '');

assert.equal(
  buildActionRunTitle('weigefenxiang', 141, '[build] wrong/260809_0741/test', 'dev'),
  '',
);

assert.deepEqual(
  parseBuildIssueTitleIdentity('[build] dev/260807_2114/安卓/Generic_x86/64/OpenWrt/25.12/generic'),
  { sourceEnv: 'dev', requestId: '260807_2114' },
);
assert.deepEqual(
  parseBuildIssueTitleIdentity('[build] staging/260807_2114/安卓/Generic_x86/64/OpenWrt/25.12/generic'),
  { sourceEnv: 'staging', requestId: '260807_2114' },
);
assert.deepEqual(
  parseBuildIssueTitleIdentity('[build] fix_kconfig-serializer-hardening/260807_2114/安卓/Generic_x86/64/OpenWrt/25.12/generic'),
  { sourceEnv: 'fix_kconfig-serializer-hardening', requestId: '260807_2114' },
);
assert.deepEqual(
  parseBuildIssueTitleIdentity('[build] 260807_2114/安卓/Generic_x86/64/OpenWrt/25.12/generic'),
  { sourceEnv: '', requestId: '260807_2114' },
);
assert.deepEqual(
  parseBuildIssueTitleIdentity('[build] broken/not-a-request-id/test'),
  { sourceEnv: '', requestId: '' },
);

console.log('Build identity tests passed / 构建环境身份测试通过');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildIdentitySource = readFileSync(join(ROOT, 'site', 'wrt', 'lib', 'build-identity.js'), 'utf8');
const feedbackSource = readFileSync(join(ROOT, 'site', 'wrt', 'lib', 'ui-feedback.js'), 'utf8');
const feedbackCss = readFileSync(join(ROOT, 'site', 'wrt', 'ui-feedback.css'), 'utf8');
const appSource = readFileSync(join(ROOT, 'site', 'wrt', 'app.js'), 'utf8');
const indexSource = readFileSync(join(ROOT, 'site', 'wrt', 'index.html'), 'utf8');
const parserSource = readFileSync(join(ROOT, 'tools', 'parse-request.mjs'), 'utf8');
assert(buildIdentitySource.includes("new URL('./ui-feedback.js', import.meta.url)") &&
  buildIdentitySource.includes('await import(feedbackUrl.href)'),
  'mandatory browser startup module does not await the shared UI feedback adapter');
assert(feedbackSource.includes("new URL('../ui-feedback.css', moduleUrl)") &&
  feedbackSource.includes('stylesheet.dataset.uiFeedbackStyle') &&
  feedbackSource.includes('function renderNotice(message, options = {})') &&
  feedbackSource.includes('globalThis.confirmModal ='),
  'UI feedback adapter does not own one release-scoped Notice/Modal presentation layer');
assert(feedbackSource.includes("t('import.ok', { id: marker })") &&
  feedbackSource.includes("[source, branch, system, profile]") &&
  feedbackCss.includes('.toast[data-kind=error]') && feedbackCss.includes('.modal.confirm-dialog') &&
  feedbackCss.includes('128px + env(safe-area-inset-bottom)'),
  'UI feedback does not preserve human-readable import details or mobile action-bar avoidance');
assert((appSource.match(/\bconfirm\(/g) || []).length === 4 && (appSource.match(/\balert\(/g) || []).length === 1,
  'native popup callsite count changed; route new feedback through the shared adapter instead');
assert(indexSource.includes('id="tagBox" data-max-code-points="160"') && !indexSource.includes('id="tagBox" maxlength="24"'),
  'Build Tag input must use the shared 160-code-point contract instead of the old HTML maxlength');
assert(appSource.includes('BUILD_IDENTITY_MODULE.normalizeBuildTag(payload.tag)') &&
  appSource.includes('BUILD_IDENTITY_MODULE.fitBuildIssueTag(tag, titlePrefix, titleSuffix') &&
  !appSource.includes("String(payload.tag).slice(0, 24)") &&
  !appSource.includes("t('tag.anonymous')).slice(0, 24)"),
  'browser Build Tag import/submission still contains the retired 24-character truncation');
assert(parserSource.includes('isValidBuildTag(requestedTag)') && parserSource.includes('artifactBuildTag(tag') &&
  !parserSource.includes("String(req.tag || '').replace(/[^\\w一-龥-]/g, '').slice(0, 24)"),
  'worker must preserve the validated display tag while keeping a separate artifact-safe tag');
