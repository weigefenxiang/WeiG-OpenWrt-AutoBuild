export const PUBLIC_BUILD_LIMIT = 3;

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
