import { normalizeBuildEnvironment } from '../site/wrt/lib/build-identity.js';

function invalid(message) {
  throw new Error(message);
}

export function normalizeRequestAudit(raw) {
  const audit = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const unknown = Object.keys(audit).filter((key) =>
    !['defconfig', 'configuration', 'compatibility'].includes(key));
  if (unknown.length) invalid(`请求审计包含未知字段: ${unknown.join(', ')}`);
  const defconfig = audit.defconfig && typeof audit.defconfig === 'object'
    ? audit.defconfig : {};
  let configuration = null;
  if (audit.configuration !== undefined) {
    const row = audit.configuration;
    const keys = row && typeof row === 'object' && !Array.isArray(row) ? Object.keys(row) : [];
    const branch = String(row?.branch || '');
    const target = String(row?.target || '');
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
        keys.some((key) => !['schema', 'source', 'branch', 'sourceCommit', 'target', 'forced'].includes(key)) ||
        row.schema !== 1 ||
        !/^[A-Za-z0-9_.-]{1,64}$/.test(String(row.source || '')) ||
        normalizeBuildEnvironment(branch) !== branch ||
        !/^[a-f0-9]{40}$/.test(String(row.sourceCommit || '')) ||
        !/^[A-Za-z0-9_+@./-]{3,512}$/.test(target) || target.split('/').length !== 3 ||
        !Array.isArray(row.forced) || !row.forced.length || row.forced.length > 64) {
      invalid('配置预检强制审计格式非法');
    }
    const forced = row.forced.map((item) => {
      const itemKeys = item && typeof item === 'object' && !Array.isArray(item)
        ? Object.keys(item) : [];
      const dependency = item?.dependency === undefined ? '' : String(item.dependency);
      const condition = item?.condition === undefined ? '' : String(item.condition);
      const packageName = item?.package === undefined ? '' : String(item.package);
      const otherPackage = item?.otherPackage === undefined ? '' : String(item.otherPackage);
      const capability = item?.capability === undefined ? '' : String(item.capability);
      const otherPackages = item?.otherPackages === undefined ? null
        : (Array.isArray(item.otherPackages) ? item.otherPackages.map((value) => String(value || '').trim()) : null);
      const packageId = (value) => !value || !/^[A-Za-z0-9_+@.-]{1,128}$/.test(value);
      const textDetail = (value) => !value || value.length > 512 || /[\x00-\x1f\x7f]/.test(value);
      if (!item || typeof item !== 'object' || Array.isArray(item) ||
          itemKeys.some((key) => !['code', 'symbol', 'dependency', 'condition', 'package',
            'otherPackage', 'otherPackages', 'capability'].includes(key)) ||
          !/^[a-z][a-z0-9-]{2,63}$/.test(String(item.code || '')) ||
          (item.symbol !== undefined && !/^[A-Za-z0-9_+@.-]{1,128}$/.test(String(item.symbol))) ||
          (item.dependency !== undefined && textDetail(dependency)) ||
          (item.condition !== undefined && textDetail(condition)) ||
          (item.package !== undefined && packageId(packageName)) ||
          (item.otherPackage !== undefined && packageId(otherPackage)) ||
          (item.capability !== undefined && packageId(capability)) ||
          (item.otherPackages !== undefined && (!otherPackages || !otherPackages.length ||
            otherPackages.length > 64 || otherPackages.some(packageId)))) {
        invalid('配置预检强制审计违规项非法');
      }
      return {
        code: String(item.code),
        ...(item.symbol === undefined ? {} : { symbol: String(item.symbol) }),
        ...(item.dependency === undefined ? {} : { dependency }),
        ...(item.condition === undefined ? {} : { condition }),
        ...(item.package === undefined ? {} : { package: packageName }),
        ...(item.otherPackage === undefined ? {} : { otherPackage }),
        ...(item.otherPackages === undefined ? {} : { otherPackages: [...new Set(otherPackages)].sort() }),
        ...(item.capability === undefined ? {} : { capability }),
      };
    });
    const unique = new Set(forced.map((item) =>
      JSON.stringify([item.code, item.symbol || '', item.dependency || '', item.condition || '',
        item.package || '', item.otherPackage || '', item.otherPackages || [], item.capability || ''])));
    if (unique.size !== forced.length) invalid('配置预检强制审计违规项重复');
    configuration = {
      schema: 1, source: String(row.source), branch,
      sourceCommit: String(row.sourceCommit), target, forced,
    };
  }
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
    ...(configuration ? { configuration } : {}),
    ...(compatibility ? { compatibility } : {}),
  };
}
