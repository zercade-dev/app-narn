import type { LogEntry } from './types.js';

/**
 * Prefixes of the background run engines. Their shared base logs the same
 * bookkeeping events under each one.
 */
const ENGINE_PREFIXES = [
  'judge',
  'source-review',
  'glossary-gen',
  'category-gen',
  'relink-retranslate',
  'stage-details',
];

/** Bookkeeping events every engine's base (`run-engine.ts`, `run-status-helpers.ts`) logs. */
const ENGINE_SUFFIXES = [
  'progress',
  'store-update-failed',
  'finalize-store-update-failed',
  'save-logs-failed',
  'save-detail-failed',
  'freeway-ledger-write-failed',
  'rate-limited - retrying batch',
];

/**
 * Server event keys with no friendly sentence on purpose: progress ticks,
 * internal bookkeeping, best-effort writes whose failure changes nothing the
 * person can see or do, and boot-time housekeeping. They show only in the Raw
 * log. Every server event key is either here or in `LOG_PRESENTERS`, never
 * both; `coverage.test.ts` scans the server source to keep it that way.
 */
export const RAW_ONLY_KEYS: ReadonlySet<string> = new Set<string>([
  ...ENGINE_PREFIXES.flatMap((prefix) => ENGINE_SUFFIXES.map((suffix) => `${prefix}:${suffix}`)),
  'judge:freeway-reroute-select-failed',
  'judge:source-run-stamp-failed',
  'judge:suggest-save-logs-failed',
  'source-review:freeway-reroute-select-failed',
  'category-gen:freeway-reroute-select-failed',
  'glossary-gen:freeway-reroute-select-failed',
  'glossary-gen:cancelled-usage-update-failed',
  'glossary-gen:save-empty-suggestions-failed',
  'relink-retranslate:details-save-failed',

  'translation:progress',
  'translation:store-update-failed',
  'translation:finalize-store-update-failed',
  'translation:details-save-failed',
  'translation:examples-resolved',
  'translation:memory-preview-truncated',
  'translation:orphaned-runs-swept',
  'translation:orphan-sweep-failed',
  'translation:provider-failure-record-failed',
  'translation:start-abort-persist-failed',
  'translation:split-dispatch-failed',
  'translation:split-phase-unloaded',
  'translation:tm-approve-skip-token-mismatch',
  'translation:tm-approve-write-failed',
  'translation:freeway-escalation-minute-starved',
  'translation:freeway-escalation-skipped-incapable',
  'translation:freeway-ledger-write-failed',
  'translation:freeway-resolved',
  'translation:freeway-stats-write-failed',
  'translation:quota-park-adopt-failed',
  'translation:quota-park-restore-failed',
  'translation:quota-redispatch-failed',
  'translation:quota-resume-nudge-failed',
  'translation:quota-skip-persist-failed',
  'translation:quota-sweep-failed',
  'translation:quota-sweep-skipped',

  'chat:orphaned-runs-swept',
  'chat:orphan-sweep-failed',
  'csp:invalid-connect-src-dropped',
  'csrf:cloud-mode-unset-trusted-origin',
  'endpoint-type-migration:complete',
  'freeway:minute-sweep-failed',
  'global-config:module-enabled-fan-out',
  'glossary-assign:load-failed',
  'glossary-assign:project-load-failed',
  'instance-migration:complete',
  'module:static-load-complete',
  'notifications:deleted',
  'notifications:read',
  'notifications:read-all',
  'notifications:read-informational',
  'notifications:run-write-failed',
  'spa:not-mounted',
  'vault:freeway-mark-clear-failed',
  'vault:quota-resume-nudge-failed',
]);

/**
 * Whether an entry belongs only in the Raw log: a raw-only event key, any
 * debug line, or a provider-module line (`[openai] single:request`). Toasts
 * also start with `[` (`[success] …`) but are logged at level `notification`,
 * and those stay friendly.
 */
export function isRawOnly(entry: LogEntry): boolean {
  if (RAW_ONLY_KEYS.has(entry.message)) return true;
  if (entry.level === 'debug') return true;
  return entry.message.startsWith('[') && entry.level !== 'notification';
}
