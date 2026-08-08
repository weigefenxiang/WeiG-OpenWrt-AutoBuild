// Shared build-environment naming rules for the browser and GitHub Actions request parser.

const REQUEST_ID_RE = /^\d{6}_\d{4}$/;
const BRANCH_RE = /^[A-Za-z0-9._/-]{1,160}$/;
const DISPLAY_RE = /^[A-Za-z0-9._-]{1,160}$/;
const COMMIT_RE = /^[a-f0-9]{40}$/i;
const ROUTE_MARKER = 'WEIG_BUILD_ROUTE_V1';

export function normalizeBuildEnvironment(value) {
  let environment = String(value || '').trim();
  if (!environment) return '';
  environment = environment.replace(/^refs\/heads\//, '').replace(/^origin\//, '');
  if (!BRANCH_RE.test(environment) || environment.startsWith('/') || environment.endsWith('/') ||
      environment.includes('//') || environment.includes('..') || environment.includes('@{')) return '';
  return environment;
}


export function normalizeBuildCommit(value) {
  const commit = String(value || '').trim();
  return COMMIT_RE.test(commit) ? commit.toLowerCase() : '';
}

export function buildRequestRouteMarker(branch, commit) {
  const sourceEnv = normalizeBuildEnvironment(branch);
  const requestCommit = normalizeBuildCommit(commit);
  if (!sourceEnv || !requestCommit) return '';
  return `<!-- ${ROUTE_MARKER}
branch=${sourceEnv}
commit=${requestCommit}
-->`;
}

export function parseBuildRequestRouteMarker(body) {
  const text = String(body || '');
  const matches = [...text.matchAll(/<!--\s*WEIG_BUILD_ROUTE_V1\s*([\s\S]*?)-->/gi)];
  if (matches.length !== 1) return { sourceEnv: '', requestCommit: '', error: matches.length ? 'duplicate route marker' : 'missing route marker' };
  const fields = new Map();
  for (const rawLine of matches[0][1].replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = /^([a-z]+)=(.+)$/i.exec(line);
    if (!match || fields.has(match[1].toLowerCase())) return { sourceEnv: '', requestCommit: '', error: 'invalid route marker' };
    fields.set(match[1].toLowerCase(), match[2].trim());
  }
  if (fields.size !== 2 || !fields.has('branch') || !fields.has('commit')) {
    return { sourceEnv: '', requestCommit: '', error: 'incomplete route marker' };
  }
  const sourceEnv = normalizeBuildEnvironment(fields.get('branch'));
  const requestCommit = normalizeBuildCommit(fields.get('commit'));
  if (!sourceEnv) return { sourceEnv: '', requestCommit: '', error: 'invalid route branch' };
  if (!requestCommit) return { sourceEnv: '', requestCommit: '', error: 'invalid route commit' };
  return { sourceEnv, requestCommit, error: '' };
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
