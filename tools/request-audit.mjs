import { normalizeBuildEnvironment } from '../site/wrt/lib/build-identity.js';

function invalid(message) {
  throw new Error(message);
}

export function normalizeRequestAudit(raw) {
  const audit = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const recommended = audit.recommended && typeof audit.recommended === 'object'
    ? audit.recommended : {};
  const enabled = recommended.enabled === true;
  const preset = String(recommended.preset || '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 64);
  const requested = Array.isArray(recommended.requested) ? recommended.requested : [];
  if (requested.length > 64) invalid('推荐项审计 requested 超过 64 项');
  const seen = new Set();
  const rows = [];
  for (const row of requested) {
    if (!row || typeof row !== 'object' ||
        !/^PACKAGE_[A-Za-z0-9_.+@-]{1,96}$/.test(String(row.symbol || '')) ||
        !['n', 'm', 'y'].includes(String(row.value || ''))) {
      invalid(`推荐项审计格式非法: ${JSON.stringify(row)}`);
    }
    const symbol = String(row.symbol);
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    rows.push({ symbol, value: String(row.value) });
  }
  const defconfig = audit.defconfig && typeof audit.defconfig === 'object'
    ? audit.defconfig : {};
  let compatibility = null;
  if (audit.compatibility !== undefined) {
    const row = audit.compatibility;
    const keys = row && typeof row === 'object' && !Array.isArray(row) ? Object.keys(row) : [];
    const branch = String(row?.branch || '');
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
        keys.some((key) => !['sha256', 'source', 'branch', 'forced'].includes(key)) ||
        !/^[a-f0-9]{64}$/.test(String(row.sha256 || '')) ||
        !/^[A-Za-z0-9_.-]{1,64}$/.test(String(row.source || '')) ||
        normalizeBuildEnvironment(branch) !== branch ||
        !Array.isArray(row.forced) || !row.forced.length || row.forced.length > 64) {
      invalid('兼容性强制审计格式非法');
    }
    const forced = [...new Set(row.forced.map((id) => String(id || '').trim()))];
    if (forced.length !== row.forced.length ||
        forced.some((id) => !/^[A-Z][A-Z0-9-]{2,31}$/.test(id))) {
      invalid('兼容性强制审计 rule ID 非法或重复');
    }
    compatibility = {
      sha256: String(row.sha256),
      source: String(row.source),
      branch,
      forced,
    };
  }
  return {
    recommended: { enabled, preset, requested: enabled ? rows : [] },
    defconfig: { enabled: defconfig.enabled === true },
    ...(compatibility ? { compatibility } : {}),
  };
}
