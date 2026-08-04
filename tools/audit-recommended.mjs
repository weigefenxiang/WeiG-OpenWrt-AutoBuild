// Recompute the recommended-item audit from the sanitized request and final .config.
// The browser only declares requested values; applied/skipped are derived here.
import { readFileSync, writeFileSync } from 'node:fs';

function arg(name, fallback = '') {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] || fallback : fallback;
}

const requestedPath = arg('--requested');
const configPath = arg('--config');
const reportPath = arg('--report', 'recommended-report.json');
if (!requestedPath || !configPath) throw new Error('Usage: node audit-recommended.mjs --requested audit.json --config .config --report report.json');

const request = JSON.parse(readFileSync(requestedPath, 'utf8')) || {};
const recommended = request.recommended && typeof request.recommended === 'object'
  ? request.recommended : { enabled: false, preset: '', requested: [] };
const enabled = recommended.enabled === true;
const requested = enabled && Array.isArray(recommended.requested) ? recommended.requested : [];
const text = readFileSync(configPath, 'utf8').replace(/\r\n/g, '\n');
const values = new Map();
const present = new Set();
for (const line of text.split('\n')) {
  const on = line.match(/^CONFIG_(PACKAGE_[A-Za-z0-9_.+@-]+)=([ym])$/);
  const off = line.match(/^# CONFIG_(PACKAGE_[A-Za-z0-9_.+@-]+) is not set$/);
  if (on) { values.set(on[1], on[2]); present.add(on[1]); }
  else if (off) { values.set(off[1], 'n'); present.add(off[1]); }
}

const applied = [];
const skipped = [];
for (const row of requested) {
  const symbol = String(row?.symbol || '');
  const wanted = String(row?.value || '');
  if (!present.has(symbol)) {
    skipped.push({
      symbol,
      requested: wanted,
      actual: null,
      reason: 'not-present-in-final-config',
    });
    continue;
  }
  const actual = values.get(symbol);
  if (actual === wanted) {
    applied.push({ symbol, value: wanted });
    continue;
  }
  skipped.push({
    symbol,
    requested: wanted,
    actual,
    reason: present.has(symbol) ? 'value-mismatch' : 'not-present-in-final-config',
  });
}

const report = {
  schema: 1,
  enabled,
  preset: String(recommended.preset || ''),
  requested,
  applied,
  skipped,
  counts: { requested: requested.length, applied: applied.length, skipped: skipped.length },
};
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(`Recommended audit / 推荐项审计: requested=${requested.length} applied=${applied.length} skipped=${skipped.length}`);
