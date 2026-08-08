#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  artifactBuildRef,
  buildEnvironmentIdentity,
  buildEnvironmentPrefix,
  buildIssueRequestPrefix,
  buildRequestRouteMarker,
  normalizeBuildCommit,
  normalizeBuildEnvironment,
  parseBuildIssueTitleIdentity,
  parseBuildRequestRouteMarker,
} from '../site/wrt/lib/build-identity.js';

assert.equal(normalizeBuildEnvironment('refs/heads/dev'), 'dev');
assert.equal(normalizeBuildEnvironment('origin/staging'), 'staging');
assert.equal(normalizeBuildEnvironment('main'), 'main');
assert.equal(normalizeBuildEnvironment('fix/kconfig-serializer-hardening'), 'fix/kconfig-serializer-hardening');
assert.equal(normalizeBuildEnvironment('feat/rootfs-capacity-guidance'), 'feat/rootfs-capacity-guidance');
assert.equal(normalizeBuildEnvironment('bad branch'), '');
assert.equal(normalizeBuildEnvironment('../main'), '');


assert.equal(normalizeBuildCommit('0123456789abcdef0123456789abcdef01234567'), '0123456789abcdef0123456789abcdef01234567');
assert.equal(normalizeBuildCommit('0123456'), '');

const routeMarker = buildRequestRouteMarker('fix/kconfig-serializer-hardening', '0123456789abcdef0123456789abcdef01234567');
assert.equal(routeMarker, '<!-- WEIG_BUILD_ROUTE_V1\nbranch=fix/kconfig-serializer-hardening\ncommit=0123456789abcdef0123456789abcdef01234567\n-->');
assert.deepEqual(parseBuildRequestRouteMarker(routeMarker), {
  sourceEnv: 'fix/kconfig-serializer-hardening',
  requestCommit: '0123456789abcdef0123456789abcdef01234567',
  error: '',
});
assert.equal(parseBuildRequestRouteMarker('').error, 'missing route marker');
assert.equal(parseBuildRequestRouteMarker(routeMarker + '\n' + routeMarker).error, 'duplicate route marker');
assert.equal(parseBuildRequestRouteMarker('<!-- WEIG_BUILD_ROUTE_V1\nbranch=../main\ncommit=0123456789abcdef0123456789abcdef01234567\n-->').error, 'invalid route branch');
assert.equal(parseBuildRequestRouteMarker('<!-- WEIG_BUILD_ROUTE_V1\nbranch=dev\ncommit=0123456\n-->').error, 'invalid route commit');

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
assert.equal(
  artifactBuildRef('260807_2114-安卓', 'fix/kconfig-serializer-hardening'),
  'fix_kconfig-serializer-hardening-260807_2114-安卓',
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
