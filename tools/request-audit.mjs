import { normalizeBuildEnvironment } from '../site/wrt/lib/build-identity.js';

function invalid(message) {
  throw new Error(message);
}

export function normalizeRequestAudit(raw) {
  const audit = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const unknown = Object.keys(audit).filter((key) => !['defconfig', 'compatibility'].includes(key));
  if (unknown.length) invalid(`请求审计包含未知字段: ${unknown.join(', ')}`);
  const defconfig = audit.defconfig && typeof audit.defconfig === 'object'
    ? audit.defconfig : {};
  let compatibility = null;
  if (audit.compatibility !== undefined) {
    const row = audit.compatibility;
    const keys = row && typeof row === 'object' && !Array.isArray(row) ? Object.keys(row) : [];
    const branch = String(row?.branch || '');
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
        keys.some((key) => !['sha256', 'source', 'branch', 'sourceCommit', 'target', 'forced'].includes(key)) ||
        !/^[a-f0-9]{64}$/.test(String(row.sha256 || '')) ||
        !/^[A-Za-z0-9_.-]{1,64}$/.test(String(row.source || '')) ||
        normalizeBuildEnvironment(branch) !== branch ||
        (row.sourceCommit !== undefined && !/^[a-f0-9]{40}$/.test(String(row.sourceCommit || ''))) ||
        (row.target !== undefined && (!/^[A-Za-z0-9_+@./-]{3,512}$/.test(String(row.target || '')) ||
          String(row.target).split('/').length !== 3)) ||
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
      ...(row.sourceCommit === undefined ? {} : { sourceCommit: String(row.sourceCommit) }),
      ...(row.target === undefined ? {} : { target: String(row.target) }),
      forced,
    };
  }
  return {
    defconfig: { enabled: defconfig.enabled === true },
    ...(compatibility ? { compatibility } : {}),
  };
}
