/**
 * The cross-component contract for the vault-unlock retry flow.
 *
 * When an API call gets a 423 Locked response, the client dispatches a
 * `vault:locked` window event carrying a `retry` thunk; `AppShell` opens the
 * unlock dialog and replays every accumulated `retry` after the vault unlocks.
 * The `vault:retry-started` / `vault:retry-finished` events let an individual
 * component (e.g. an inline re-translate cell) reflect its own retry's progress,
 * correlated by `retryId` and the optional `vaultRetryKey`.
 *
 * The event-name string literals and detail shapes are centralised here so every
 * dispatcher and listener agrees on them; the names are part of the runtime
 * contract and must stay byte-identical.
 */

/** Window event dispatched on a 423; opens the unlock dialog and queues the retry. */
export const VAULT_LOCKED_EVENT = 'vault:locked';
/** Window event dispatched when a queued retry begins re-issuing its request. */
export const VAULT_RETRY_STARTED_EVENT = 'vault:retry-started';
/** Window event dispatched when a queued retry settles (see `succeeded`). */
export const VAULT_RETRY_FINISHED_EVENT = 'vault:retry-finished';

/** Detail payload for {@link VAULT_LOCKED_EVENT}. */
export interface VaultLockedDetail {
  /** Replays the original request after the vault unlocks. Absent for listener-only signals. */
  retry?: () => Promise<void>;
  /** Correlation id linking this lock to its retry-started/finished events. */
  retryId?: string;
  /** Optional caller key (e.g. `${entryId}:${lang}`) so a component can match its own retry. */
  vaultRetryKey?: string;
}

/** Detail payload for {@link VAULT_RETRY_STARTED_EVENT}. */
export interface VaultRetryStartedDetail {
  retryId?: string;
  vaultRetryKey?: string;
}

/** Detail payload for {@link VAULT_RETRY_FINISHED_EVENT}. */
export interface VaultRetryFinishedDetail {
  retryId?: string;
  vaultRetryKey?: string;
  /** Whether the replayed request resolved successfully. */
  succeeded?: boolean;
}

/** Builds the `vault:locked` event with a correctly typed detail. */
export function vaultLockedEvent(detail: VaultLockedDetail): CustomEvent<VaultLockedDetail> {
  return new CustomEvent(VAULT_LOCKED_EVENT, { detail });
}

/** Builds the `vault:retry-started` event with a correctly typed detail. */
export function vaultRetryStartedEvent(
  detail: VaultRetryStartedDetail,
): CustomEvent<VaultRetryStartedDetail> {
  return new CustomEvent(VAULT_RETRY_STARTED_EVENT, { detail });
}

/** Builds the `vault:retry-finished` event with a correctly typed detail. */
export function vaultRetryFinishedEvent(
  detail: VaultRetryFinishedDetail,
): CustomEvent<VaultRetryFinishedDetail> {
  return new CustomEvent(VAULT_RETRY_FINISHED_EVENT, { detail });
}
