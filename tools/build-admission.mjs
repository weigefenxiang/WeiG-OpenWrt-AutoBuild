import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProjectConfiguration } from './project-config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_CONFIG_PATH = join(ROOT, 'site', 'wrt', 'config', 'site.json');
const BUILD_CONFIG_PATH = join(ROOT, 'config', 'build.json');
const loadedProjectConfiguration = loadProjectConfiguration({
  root: ROOT, sitePath: SITE_CONFIG_PATH, buildPath: BUILD_CONFIG_PATH,
});
const PROJECT_BUILD = loadedProjectConfiguration.build;
const configuredLimit = PROJECT_BUILD.admission.publicActiveBuilds;
if (!Number.isInteger(configuredLimit) || !Number.isSafeInteger(configuredLimit) ||
    configuredLimit < 1 || configuredLimit > 20) {
  throw new Error('project admission.publicActiveBuilds is invalid');
}
export const PUBLIC_BUILD_LIMIT = configuredLimit;

function normalizedRun(run) {
  const id = Number(run?.id);
  const createdAt = String(run?.created_at || '');
  if (!Number.isSafeInteger(id) || id <= 0 || !createdAt) {
    throw new Error('active build identity is invalid');
  }
  return { id, created_at: createdAt };
}

export function decideBuildAdmission({
  isRepositoryOwner = false,
  currentRunId,
  currentCreatedAt,
  activeRuns = [],
} = {}) {
  const current = normalizedRun({ id: currentRunId, created_at: currentCreatedAt });
  if (isRepositoryOwner) {
    return { allowed: true, owner: true, rank: 0, limit: null, active: 1 };
  }

  const ordered = [...new Map([...activeRuns.map(normalizedRun), current]
    .map((run) => [String(run.id), run])).values()]
    .sort((left, right) => left.created_at.localeCompare(right.created_at) || left.id - right.id);
  const rank = ordered.findIndex((run) => run.id === current.id);
  return {
    allowed: rank >= 0 && rank < PUBLIC_BUILD_LIMIT,
    owner: false,
    rank,
    limit: PUBLIC_BUILD_LIMIT,
    active: ordered.length,
  };
}
