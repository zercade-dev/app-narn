/**
 * Cross-tenant scan for the runs persisted as parked on free quota.
 *
 * A parked run outlives the process by design (a park can last until
 * tomorrow's quota reset), but the engine's auto-resume sweep walks its
 * IN-MEMORY runs — so after a deploy or a dev reload the park exists only in
 * the store and the run sits paused until somebody resumes it by hand. This is
 * the sweep's boot-time recovery read.
 *
 * It goes through the SECURITY DEFINER `narn_list_quota_parked_runs()`
 * (migration 0029) on the raw pool, exactly like `freeway-minute-sweep.ts` /
 * `manual-edit-sweep.ts`: the sweep fires off ANY request, so there is no
 * ambient tenant, and the fail-closed `TenantDb` would throw without one. The
 * DEFINER already bypasses `runs`' per-tenant RLS and reports every tenant's
 * parks in one call (a system operation, not a per-tenant one) — `app_user`
 * holds EXECUTE on the function directly, and no GUC would even scope it.
 * Each row carries its own `tenantId`, which the caller re-establishes around
 * the resume so no run is ever driven under another tenant's context.
 */
import type { RunStatus } from '@zercade-dev/narn-shared';
import { getPool } from './pg/pool.js';

/** One persisted park: the run's owning tenant plus its full stored status. */
export interface QuotaParkedRun {
  tenantId: string;
  projectId: string;
  runId: string;
  status: RunStatus;
}

/**
 * Every non-terminal run persisted as `paused` with a `waitingForQuota` park,
 * across all tenants. `status` is the run's `data` jsonb — the same read model
 * `RunStore.getRun` returns.
 */
export async function listQuotaParkedRuns(): Promise<QuotaParkedRun[]> {
  const { rows } = await getPool().query<{
    tenant_id: string;
    project_id: string;
    run_id: string;
    data: RunStatus;
  }>('select tenant_id, project_id, run_id, data from narn_list_quota_parked_runs()');
  return rows.map((row) => ({
    tenantId: row.tenant_id,
    projectId: row.project_id,
    runId: row.run_id,
    status: row.data,
  }));
}
