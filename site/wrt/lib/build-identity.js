// Shared build-environment naming rules for the browser and GitHub Actions request parser.

const REQUEST_ID_RE = /^\d{6}_\d{4}$/;
const BRANCH_RE = /^[A-Za-z0-9._/-]{1,160}$/;
const DISPLAY_RE = /^[A-Za-z0-9._-]{1,160}$/;

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

export function normalizeDeploymentIdentity(siteStamp, buildMeta) {
  const siteVersion = /^v\d{10}$/.test(String(siteStamp?.version || '')) &&
    siteStamp?.timezone === 'Asia/Shanghai' ? siteStamp.version : '';
  const empty = { siteVersion: siteVersion || 'v----------', buildMeta: null };
  if (!siteVersion || !buildMeta || buildMeta.version !== siteVersion ||
      buildMeta.timezone !== siteStamp.timezone ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/.test(String(buildMeta.builtAt || ''))) return empty;
  const branch = normalizeBuildEnvironment(buildMeta.branch);
  const commit = normalizeBuildCommit(buildMeta.commit);
  if (!branch || !commit) return empty;
  return { siteVersion, buildMeta: { ...buildMeta, branch, commit } };
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

export function artifactBuildRef(buildRef, value) {
  const ref = String(buildRef || '').trim();
  const prefix = buildEnvironmentIdentity(value);
  return prefix && ref ? `${prefix}-${ref}` : ref;
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
