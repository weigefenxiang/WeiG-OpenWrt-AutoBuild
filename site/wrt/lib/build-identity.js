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
