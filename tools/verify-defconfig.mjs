#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const args = {};
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i]?.replace(/^--/, '');
  if (!key || process.argv[i].startsWith('--') === false) continue;
  const next = process.argv[i + 1];
  if (next && !next.startsWith('--')) {
    args[key] = next;
    i += 1;
  } else {
    args[key] = '';
  }
}

function configLines(text) {
  return String(text).replace(/\r\n/g, '\n').split('\n')
    .filter((line) => line.startsWith('CONFIG_') || line.startsWith('# CONFIG_'));
}

function valueOf(lines, symbol) {
  const line = lines.find((item) => item === `CONFIG_${symbol}=y` || item === `CONFIG_${symbol}=m` ||
    item.startsWith(`CONFIG_${symbol}=`));
  if (line) return line.slice(`CONFIG_${symbol}=`.length);
  if (lines.includes(`# CONFIG_${symbol} is not set`)) return 'n';
  return '';
}

function identity(lines) {
  const target = lines.filter((line) =>
    /^CONFIG_TARGET_(?:BOARD|SUBTARGET|PROFILE)=/.test(line) ||
    /^CONFIG_TARGET_[A-Za-z0-9_.+-]+_DEVICE_[A-Za-z0-9_.+-]+=y$/.test(line)).sort();
  const arch = valueOf(lines, 'ARCH');
  const archSymbol = arch ? `CONFIG_${arch}` : '';
  return {
    target,
    arch,
    archSymbol: archSymbol ? valueOf(lines, arch) : '',
    archPackages: valueOf(lines, 'TARGET_ARCH_PACKAGES'),
  };
}

const beforePath = args.before;
const afterPath = args.after;
if (!beforePath || !afterPath) {
  console.error('Usage: verify-defconfig.mjs --before pre-defconfig.config --after defconfig.config [--profile-packages "pkg ..."] [--report report.json]');
  process.exit(2);
}
const before = configLines(readFileSync(beforePath, 'utf8'));
const after = configLines(readFileSync(afterPath, 'utf8'));
const beforeIdentity = identity(before);
const afterIdentity = identity(after);
const required = String(args['profile-packages'] || '').split(/\s+/).filter(Boolean);
const missingProfilePackages = required.filter((pkg) => !['y', 'm'].includes(valueOf(after, `PACKAGE_${pkg}`)));
const identityChanged = JSON.stringify(beforeIdentity) !== JSON.stringify(afterIdentity);
const report = {
  schema: 1,
  mode: 'target-locked-defconfig',
  changedCount: before.filter((line) => !after.includes(line)).length + after.filter((line) => !before.includes(line)).length,
  before: beforeIdentity,
  after: afterIdentity,
  requiredProfilePackages: required,
  missingProfilePackages,
  valid: !identityChanged && missingProfilePackages.length === 0,
};
if (args.report) writeFileSync(args.report, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
if (identityChanged) {
  console.error('Defconfig changed Target/System/Profile or package architecture; refusing to continue.');
  process.exit(1);
}
if (missingProfilePackages.length) {
  console.error(`Defconfig removed Catalog Profile packages: ${missingProfilePackages.join(', ')}`);
  process.exit(1);
}
