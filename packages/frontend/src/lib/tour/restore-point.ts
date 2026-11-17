/**
 * The restore point of the guide's retranslate test: the server takes a
 * `pre-retranslate` backup before any run that translates again, so the
 * guide points at that one rather than taking its own.
 */
import { apiRequest } from '../../hooks/use-api.js';

/**
 * How far before `since` the snapshot may be: it is taken just before the run
 * is enqueued, and `since` may be browser time when the run is not listed.
 */
const CLOCK_SKEW_MS = 60_000;

interface ListedBackup {
  id: string;
  createdAt: string;
  trigger?: string;
}

/**
 * The newest of `backups` taken before a retranslation since `since`, the
 * test run's start (server time), or null.
 */
export function pickRestorePoint(backups: readonly ListedBackup[], since: number): string | null {
  const from = since - CLOCK_SKEW_MS;
  let best: { id: string; at: number } | null = null;
  for (const b of backups) {
    if (b.trigger !== 'pre-retranslate') continue;
    const at = Date.parse(b.createdAt);
    if (!Number.isFinite(at) || at < from) continue;
    if (best === null || at > best.at) best = { id: b.id, at };
  }
  return best?.id ?? null;
}

/** {@link pickRestorePoint} over the project's stored backups. */
export async function findRestorePoint(projectId: string, since: number): Promise<string | null> {
  const { files } = await apiRequest<{ files: ListedBackup[] }>(`/projects/${projectId}/backups`);
  return pickRestorePoint(files, since);
}
