#!/usr/bin/env node
import assert from 'node:assert/strict';
import { normalizeRequestAudit } from './request-audit.mjs';

const valid = {
  defconfig: { enabled: true },
  configuration: {
    schema: 1, source: 'ImmortalWrt', branch: 'openwrt-25.12',
    sourceCommit: 'b'.repeat(40), target: 'x86/64/DEVICE_generic',
    forced: [{
      code: 'package-dependency-unsatisfied', symbol: 'PACKAGE_libffmpeg-full',
      dependency: 'lame-lib',
    }],
  },
  compatibility: {
    sha256: 'a'.repeat(64), source: 'ImmortalWrt', branch: 'openwrt-25.12',
    sourceCommit: 'b'.repeat(40), target: 'x86/64/DEVICE_generic',
    forced: ['OWN-0001'],
  },
};
assert.deepEqual(normalizeRequestAudit(valid).configuration, valid.configuration);
assert.deepEqual(normalizeRequestAudit(valid).compatibility, valid.compatibility);
assert.equal(Object.hasOwn(normalizeRequestAudit({}), 'compatibility'), false);

for (const mutate of [
  (value) => { value.configuration.schema = 2; },
  (value) => { value.configuration.target = 'x86/64'; },
  (value) => { value.configuration.forced[0].code = 'INVALID'; },
  (value) => { value.configuration.forced[0].symbol = '../PACKAGE_X'; },
  (value) => { value.configuration.forced.push(structuredClone(value.configuration.forced[0])); },
  (value) => { value.configuration.forced[0].extra = true; },
  (value) => { value.compatibility.sha256 = 'a'.repeat(40); },
  (value) => { value.compatibility.branch = '../main'; },
  (value) => { value.compatibility.sourceCommit = 'b'.repeat(39); },
  (value) => { value.compatibility.target = 'x86/64'; },
  (value) => { value.compatibility.forced.push('OWN-0001'); },
  (value) => { value.compatibility.forced = ['own-0001']; },
  (value) => { value.compatibility.symbols = ['PACKAGE_duplicate']; },
  (value) => { value.recommended = { enabled: true }; },
]) {
  const invalid = structuredClone(valid);
  mutate(invalid);
  assert.throws(() => normalizeRequestAudit(invalid), /配置预检强制审计|兼容性强制审计|未知字段/);
}

console.log('Request preflight and compatibility audit mutation tests passed / 请求预检与兼容性审计变异测试通过');
