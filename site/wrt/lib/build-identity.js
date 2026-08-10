// Shared build-environment naming rules for the browser and GitHub Actions request parser.

const REQUEST_ID_RE = /^\d{6}_\d{4}$/;
const BRANCH_RE = /^[A-Za-z0-9._/-]{1,160}$/;
const DISPLAY_RE = /^[A-Za-z0-9._-]{1,160}$/;
const BUILD_TAG_RE = /^[\p{L}\p{N}_-]{1,24}$/u;
const SITE_SHA256_RE = /^[a-f0-9]{64}$/;
const CATALOG_DATA_BRANCHES = Object.freeze({
  fix: 'catalog-fix',
  dev: 'catalog-dev',
  staging: 'catalog-staging',
  main: 'catalog-data',
});

export function normalizeBuildEnvironment(value) {
  let environment = String(value || '').trim();
  if (!environment) return '';
  environment = environment.replace(/^refs\/heads\//, '').replace(/^origin\//, '');
  if (!BRANCH_RE.test(environment) || environment.startsWith('/') || environment.endsWith('/') ||
      environment.includes('//') || environment.includes('..') || environment.includes('@{')) return '';
  return environment;
}


export function normalizeBuildCommit(value) {
  const commit = String(value || '').trim().toLowerCase();
  return /^[a-f0-9]{40}$/.test(commit) ? commit : '';
}

export function catalogDataBranch(value, configured = CATALOG_DATA_BRANCHES) {
  const environment = normalizeBuildEnvironment(value) || 'main';
  const channel = environment.startsWith('fix/') ? 'fix'
    : ['dev', 'staging', 'main'].includes(environment) ? environment : 'main';
  const mapping = configured && typeof configured === 'object' ? configured : {};
  const branch = String(mapping[channel] || CATALOG_DATA_BRANCHES[channel] || '').trim();
  if (branch !== CATALOG_DATA_BRANCHES[channel]) {
    throw new Error(`invalid Catalog data branch for ${channel}`);
  }
  return branch;
}

export function normalizeDeploymentIdentity(siteStamp, buildMeta) {
  const siteVersion = /^v\d{10}$/.test(String(siteStamp?.version || '')) &&
    siteStamp?.timezone === 'Asia/Shanghai' ? siteStamp.version : '';
  const siteSha256 = siteVersion && SITE_SHA256_RE.test(String(siteStamp?.siteSha256 || '')) &&
    siteStamp?.hashAlgorithm === 'sha256' ? siteStamp.siteSha256 : '';
  const empty = { siteVersion: siteVersion || 'v----------', siteSha256: siteSha256 || '', buildMeta: null };
  if (!siteVersion || !siteSha256 || !buildMeta || buildMeta.version !== siteVersion ||
      buildMeta.siteSha256 !== siteSha256 || buildMeta.timezone !== siteStamp.timezone ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/.test(String(buildMeta.builtAt || ''))) return empty;
  const branch = normalizeBuildEnvironment(buildMeta.branch);
  const commit = normalizeBuildCommit(buildMeta.commit);
  if (!branch || !commit) return empty;
  return { siteVersion, siteSha256, buildMeta: { ...buildMeta, branch, commit } };
}

export function buildEnvironmentIdentity(value) {
  const environment = normalizeBuildEnvironment(value);
  if (!environment || environment === 'main') return '';
  return environment.replaceAll('/', '_');
}

export function buildEnvironmentPrefix(value) {
  return buildEnvironmentIdentity(value);
}

export function buildIssueRequestPrefix(value) {
  const prefix = buildEnvironmentIdentity(value);
  return prefix ? `${prefix}/` : '';
}

export function artifactBuildRef(buildRef, value, issueNumber = 0) {
  const ref = String(buildRef || '').trim();
  const prefix = buildEnvironmentIdentity(value);
  const environmentRef = prefix && ref ? `${prefix}-${ref}` : ref;
  const number = Number(issueNumber);
  return environmentRef && Number.isSafeInteger(number) && number > 0
    ? `${environmentRef}#${number}` : environmentRef;
}

export function buildActionRunTitle(requester, issueNumber, issueTitle, value) {
  const number = Number(issueNumber);
  const environment = normalizeBuildEnvironment(value);
  const match = /^\[build\]\s+(.+)$/.exec(String(issueTitle || '').trim());
  if (!Number.isSafeInteger(number) || number <= 0 || !environment || !match) return '';
  const identity = buildEnvironmentIdentity(environment);
  const parts = match[1].split('/');
  if (identity) {
    if (parts.shift() !== identity) return '';
  }
  if (!REQUEST_ID_RE.test(parts[0] || '') || !BUILD_TAG_RE.test(parts[1] || '')) return '';
  if (identity) parts[0] = `${identity}-${parts[0]}`;
  parts[1] = `${parts[1]}#${number}`;
  return parts.join('/');
}

export function parseBuildIssueTitleIdentity(title) {
  const match = /^\[build\]\s+(.+)$/.exec(String(title || '').trim());
  if (!match) return { sourceEnv: '', requestId: '' };
  const parts = match[1].split('/');
  if (REQUEST_ID_RE.test(parts[0] || '')) {
    return { sourceEnv: '', requestId: parts[0] };
  }
  if (DISPLAY_RE.test(parts[0] || '') && REQUEST_ID_RE.test(parts[1] || '')) {
    return { sourceEnv: parts[0], requestId: parts[1] };
  }
  return { sourceEnv: '', requestId: '' };
}
