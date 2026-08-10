#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  artifactBuildRef,
  catalogDataBranch,
  buildActionRunTitle,
  buildEnvironmentIdentity,
  buildEnvironmentPrefix,
  buildIssueRequestPrefix,
  normalizeBuildEnvironment,
  normalizeBuildCommit,
  normalizeDeploymentIdentity,
  parseBuildIssueTitleIdentity,
} from '../site/wrt/lib/build-identity.js';

assert.equal(normalizeBuildEnvironment('refs/heads/dev'), 'dev');
assert.equal(normalizeBuildEnvironment('origin/staging'), 'staging');
assert.equal(normalizeBuildEnvironment('main'), 'main');
assert.equal(normalizeBuildEnvironment('fix/kconfig-serializer-hardening'), 'fix/kconfig-serializer-hardening');
assert.equal(normalizeBuildEnvironment('feat/rootfs-capacity-guidance'), 'feat/rootfs-capacity-guidance');
assert.equal(normalizeBuildEnvironment('bad branch'), '');
assert.equal(normalizeBuildEnvironment('../main'), '');

const catalogChannels = {
  fix: 'catalog-fix', dev: 'catalog-dev', staging: 'catalog-staging', main: 'catalog-data',
};
assert.equal(catalogDataBranch('fix/catalog-compatibility', catalogChannels), 'catalog-fix');
assert.equal(catalogDataBranch('dev', catalogChannels), 'catalog-dev');
assert.equal(catalogDataBranch('staging', catalogChannels), 'catalog-staging');
assert.equal(catalogDataBranch('main', catalogChannels), 'catalog-data');
assert.equal(catalogDataBranch('', catalogChannels), 'catalog-data');
assert.equal(catalogDataBranch('feature/unpublished', catalogChannels), 'catalog-data');
assert.throws(() => catalogDataBranch('dev', { ...catalogChannels, dev: 'catalog-data' }),
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
