#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  artifactBuildRef,
  buildEnvironmentPrefix,
  buildIssueRequestPrefix,
  normalizeBuildEnvironment,
  parseBuildIssueTitleIdentity,
} from '../site/wrt/lib/build-identity.js';

assert.equal(normalizeBuildEnvironment('refs/heads/dev'), 'dev');
assert.equal(normalizeBuildEnvironment('origin/staging'), 'staging');
assert.equal(normalizeBuildEnvironment('main'), 'main');
assert.equal(normalizeBuildEnvironment('feature/test'), '');

assert.equal(buildEnvironmentPrefix('dev'), 'dev');
assert.equal(buildEnvironmentPrefix('staging'), 'staging');
assert.equal(buildEnvironmentPrefix('main'), '');
assert.equal(buildIssueRequestPrefix('dev'), 'dev/');
assert.equal(buildIssueRequestPrefix('staging'), 'staging/');
assert.equal(buildIssueRequestPrefix('main'), '');

assert.equal(artifactBuildRef('260807_2114-安卓', 'dev'), 'dev-260807_2114-安卓');
assert.equal(artifactBuildRef('260807_2114-安卓', 'staging'), 'staging-260807_2114-安卓');
assert.equal(artifactBuildRef('260807_2114-安卓', 'main'), '260807_2114-安卓');
assert.equal(artifactBuildRef('260807_2114-安卓', ''), '260807_2114-安卓');

assert.deepEqual(
  parseBuildIssueTitleIdentity('[build] dev/260807_2114/安卓/Generic_x86/64/OpenWrt/25.12/generic'),
  { sourceEnv: 'dev', requestId: '260807_2114' },
);
assert.deepEqual(
  parseBuildIssueTitleIdentity('[build] staging/260807_2114/安卓/Generic_x86/64/OpenWrt/25.12/generic'),
  { sourceEnv: 'staging', requestId: '260807_2114' },
);
assert.deepEqual(
  parseBuildIssueTitleIdentity('[build] 260807_2114/安卓/Generic_x86/64/OpenWrt/25.12/generic'),
  { sourceEnv: '', requestId: '260807_2114' },
);

console.log('Build identity tests passed / 构建环境身份测试通过');
