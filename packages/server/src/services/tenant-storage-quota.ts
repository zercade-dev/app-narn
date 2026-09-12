import { getMaxStringEntriesPerTenant } from '../config/env.js';
import type { StringStore } from '../storage/types.js';
import { StorageQuotaExceededError } from '../types/errors.js';

/**
 * Per-tenant stored-entry ceiling — the volume counterpart to the per-tenant
 * run-concurrency cap in `modules/M9/run-capacity.ts`. Call before a write that
 * ADDS entries, passing how many it would add; nothing is counted at all unless
 * `MAX_STRING_ENTRIES_PER_TENANT` is a positive integer, so unset / non-finite
 * / ≤0 ⇒ unbounded and single-user local is unchanged.
 *
 * `adding <= 0` always passes: a re-import that only updates existing rows
 * grows nothing and must not become impossible once a tenant sits at the cap,
 * nor when an operator lowers the cap below what is already stored.
 *
 * The count is RLS-scoped exactly as `countActiveRuns` is, so it measures every
 * entry the caller can see — a collaborator's import is charged against all the
 * projects they are a member of, not only the ones they own.
 *
 * Read-then-check with no lock, so two simultaneous imports can both pass and
 * overshoot by one import's worth. Acceptable for a capacity quota (the same
 * trade-off the run cap records); it is a fairness bound, not a security one.
 */
export async function assertStringEntryCapacity(
  stringStore: Pick<StringStore, 'countAllEntries'>,
  adding: number,
): Promise<void> {
  const raw = getMaxStringEntriesPerTenant();
  if (!raw) return;
  const cap = Number(raw);
  if (!Number.isFinite(cap) || cap <= 0) return;
  if (adding <= 0) return;
  const stored = await stringStore.countAllEntries();
  if (stored + adding <= cap) return;
  throw new StorageQuotaExceededError(
    `storage quota exceeded: ${stored} string entries stored, limit ${cap}; this request ` +
      `would add ${adding} more. Delete strings or whole projects to free space.`,
  );
}
