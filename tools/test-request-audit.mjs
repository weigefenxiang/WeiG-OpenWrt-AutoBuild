#!/usr/bin/env node
import assert from 'node:assert/strict';
import { normalizeRequestAudit } from './request-audit.mjs';

const valid = {
  defconfig: { enabled: true },
  compatibility: {
    sha256: 'a'.repeat(64), source: 'ImmortalWrt', branch: 'openwrt-25.12',
    forced: ['OWN-0001'],
  },
};
assert.deepEqual(normalizeRequestAudit(valid).compatibility, valid.compatibility);
assert.equal(Object.hasOwn(normalizeRequestAudit({}), 'compatibility'), false);

for (const mutate of [
  (value) => { value.compatibility.sha256 = 'a'.repeat(40); },
  (value) => { value.compatibility.branch = '../main'; },
  (value) => { value.compatibility.forced.push('OWN-0001'); },
  (value) => { value.compatibility.forced = ['own-0001']; },
  (value) => { value.compatibility.symbols = ['PACKAGE_duplicate']; },
  (value) => { value.recommended = { enabled: true }; },
]) {
  const invalid = structuredClone(valid);
  mutate(invalid);
  assert.throws(() => normalizeRequestAudit(invalid), /兼容性强制审计|未知字段/);
}

console.log('Request compatibility audit mutation tests passed / 请求兼容性审计变异测试通过');
