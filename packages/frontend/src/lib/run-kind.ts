/**
 * Shared run predicates. Centralizes the "is this run a translation run" and
 * "is this run still active" checks that were otherwise reimplemented (with
 * subtly different blacklists/whitelists) across the run, review, filter, and
 * category surfaces.
 */
import {
  RunStatusCode,
  isTranslationRunKind,
  hasRunDetailsKind,
  type RunStatus,
} from '@zercade-dev/narn-shared';

/**
 * Whether a run produced translations. Allowlist by design: a run is a
 * translation run only when its kind is `'translate'` (or absent, for legacy
 * runs persisted before `kind` existed). Every other kind (judge,
 * source-review, glossary-gen, category-gen) is excluded — a blacklist would
 * silently leak any future kind (this is exactly how `glossary-gen` once leaked
 * into the string-filter and judge-target lists). Delegates to the shared
 * `isTranslationRunKind` so the server's run-revert guard can never drift from
 * this predicate.
 */
export function isTranslationRun(run: RunStatus): boolean {
  return isTranslationRunKind(run.kind);
}

/**
 * Whether a run persists a run-details sidecar (and is revertible): a
 * translation run or a relink-retranslate run. Delegates to the shared
 * `hasRunDetailsKind` so the server's revert guard can never drift from the
 * UI's gating.
 */
export function hasRunDetails(run: RunStatus): boolean {
  return hasRunDetailsKind(run.kind);
}

/** Whether a run is still in flight (pending / queued / running). */
export function isRunActive(run: RunStatus): boolean {
  return (
    run.status === RunStatusCode.Pending ||
    run.status === RunStatusCode.Queued ||
    run.status === RunStatusCode.Running
  );
}
