import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
const fixture = mkdtempSync(join(root, '.tmp-password-'));
const rel = file => relative(root, file).replaceAll('\\', '/');
try {
  let execution = 0;
  const run = (password, mode = 'prompt') => {
    const tree = join(fixture, String(++execution));
    const result = spawnSync('bash', ['Shell/set-root-password.sh', rel(tree)], { cwd: root, encoding: 'utf8',
      env: { ...process.env, REQUEST_ROOT_PASSWORD: password, PASSWORD_MODE: mode } });
    assert.equal(result.status, 0, result.stderr);
    const generated = join(tree, 'files/etc/uci-defaults/zzzz-weig-password');
    return existsSync(generated) ? readFileSync(generated, 'utf8') : null;
  };
  assert.equal(run(''), null, 'blank preserves upstream: no override is generated');
  for (const [password, mode] of [['', 'empty'], ['@empty', 'prompt']]) {
    const text = run(password, mode); assert.match(text, /root::/); assert.doesNotMatch(text, /passwd -d/);
  }
  const secret = run('Test1234'); assert.match(secret, /root:\$6\$/); assert(!secret.includes('Test1234'));
  // Execute the generated override against a fixture after representative upstream
  // numeric/zzz scripts. No router or host account is modified by this test.
  const scripts = ['10-system', '50-root-passwd', '99-custom', 'zzz-default-settings', 'zzzz-weig-password'].sort();
  assert.equal(scripts.at(-1), 'zzzz-weig-password');
  const shadow = join(fixture, 'shadow');
  writeFileSync(shadow, 'root:upstream-hash:0:0:99999:7:::\nnobody:*:0:0:99999:7:::\n');
  const script = run('@empty').replaceAll('/etc/shadow', rel(shadow));
  const result = spawnSync('bash', ['-c', script], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); assert.match(readFileSync(shadow, 'utf8'), /^root::/);
  assert.match(readFileSync(shadow, 'utf8'), /nobody:\*/);
  const workflow = readFileSync(join(root, '.github/workflows/custom-build.yml'), 'utf8');
  assert.match(workflow, /bash Shell\/set-root-password.sh openwrt/);
  assert(!workflow.includes('99-init-password'), 'old competing override must be retired');
  assert.equal(JSON.parse(readFileSync(join(root, 'config/build.json'))).password.mode, 'prompt');
  assert.equal(JSON.parse(readFileSync(join(root, 'site/wrt/config/site.json'))).firmware.clearInitialPassword, true);
} finally { rmSync(fixture, { recursive: true, force: true }); }
console.log('Late root password override tests passed.');
