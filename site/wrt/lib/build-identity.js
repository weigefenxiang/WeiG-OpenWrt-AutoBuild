// Shared build-environment naming rules for the browser and GitHub Actions request parser.

const KNOWN_ENVIRONMENTS = new Set(['dev', 'staging', 'main']);
const PREFIXED_ENVIRONMENTS = new Set(['dev', 'staging']);

export function normalizeBuildEnvironment(value) {
  let environment = String(value || '').trim();
  if (!environment) return '';
  environment = environment.replace(/^refs\/heads\//, '').replace(/^origin\//, '');
  return KNOWN_ENVIRONMENTS.has(environment) ? environment : '';
}

export function buildEnvironmentPrefix(value) {
  const environment = normalizeBuildEnvironment(value);
  return PREFIXED_ENVIRONMENTS.has(environment) ? environment : '';
}

export function buildIssueRequestPrefix(value) {
  const prefix = buildEnvironmentPrefix(value);
  return prefix ? `${prefix}/` : '';
}

export function artifactBuildRef(buildRef, value) {
  const ref = String(buildRef || '').trim();
  const prefix = buildEnvironmentPrefix(value);
  return prefix && ref ? `${prefix}-${ref}` : ref;
}

export function parseBuildIssueTitleIdentity(title) {
  const match = /^\[build\]\s+(.+)$/.exec(String(title || '').trim());
  if (!match) return { sourceEnv: '', requestId: '' };
  const parts = match[1].split('/');
  const sourceEnv = buildEnvironmentPrefix(parts[0]);
  return {
    sourceEnv,
    requestId: sourceEnv ? String(parts[1] || '') : String(parts[0] || ''),
  };
}
