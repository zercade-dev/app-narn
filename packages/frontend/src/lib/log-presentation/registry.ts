import { isFailureCode, type FailureCode } from '@zercade-dev/narn-shared';
import i18n from '../../i18n/index.js';
import type { LogAction, LogMeta, LogPresenter } from './types.js';
import { openTab, openGlobalConfig, switchToRaw, unlockVault } from './actions.js';
import { RUN_TYPE_KEY } from '../run-kind.js';

/**
 * Expand a language code to a display name ("fr" -> "French" in an English UI,
 * "francés" in a Spanish one). Falls back to the raw code, which is what the
 * synthetic `pseudo-test` language and any non-standard tag resolve to.
 *
 * `Intl.DisplayNames` parses any syntactically valid BCP-47 tag, even one
 * whose primary subtag it doesn't recognise — `"pseudo-test"` gets read as
 * language `pseudo` + 4-letter script subtag `Test`, producing the
 * misleading `"pseudo (Test)"` instead of throwing or echoing the code. So
 * the primary subtag is checked in isolation first: an unrecognised primary
 * (resolves to itself) means the whole tag is untrustworthy, regardless of
 * what the full multi-subtag lookup returns.
 */
export function languageName(code: unknown): string {
  if (typeof code !== 'string' || code === '') return '?';
  try {
    // `Intl.DisplayNames` resolves this locale LIST to a single best-fit locale
    // up front (standard locale negotiation) — it does not retry per lookup.
    // The trailing 'en' is only reached if `resolvedLanguage` itself isn't a
    // locale ICU supports; once a locale is picked, every `.of()` call below
    // (including the fallback `.of(code)` a few lines down) is answered from
    // that same one locale — there is no per-code English fallback.
    const displayNames = new Intl.DisplayNames([i18n.resolvedLanguage ?? 'en', 'en'], {
      type: 'language',
    });
    const primarySubtag = code.split('-')[0];
    if (displayNames.of(primarySubtag) === primarySubtag) return code;
    const display = displayNames.of(code);
    return display && display !== code ? display : code;
  } catch {
    return code;
  }
}

const str = (v: unknown, fallback = '?'): string =>
  typeof v === 'string' && v !== '' ? v : fallback;

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/** `google::gemini-2.0-flash` -> `gemini-2.0-flash`: a Freeway bucket key names a free model. */
const bucketModel = (v: unknown): string => {
  const key = str(v);
  const sep = key.indexOf('::');
  return sep === -1 ? key : key.slice(sep + 2);
};

/** An epoch-ms instant as a short local clock time ("14:05"), in the UI language. */
const clockTime = (v: unknown): string => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '?';
  try {
    return new Intl.DateTimeFormat([i18n.resolvedLanguage ?? 'en', 'en'], {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(v));
  } catch {
    return '?';
  }
};

/** A duration in ms as seconds with at most one decimal ("2.4"), in the UI language. */
const secondsText = (v: unknown): string => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '?';
  try {
    return new Intl.NumberFormat([i18n.resolvedLanguage ?? 'en', 'en'], {
      maximumFractionDigits: 1,
    }).format(v / 1000);
  } catch {
    return String(Math.round(v / 1000));
  }
};

/** `count` defaults to 1 — a non-aggregated trace represents a single item. */
const failureVars = (meta: LogMeta) => ({
  count: num(meta.count, 1),
  language: languageName(meta.targetLanguage),
  module: str(meta.moduleId),
});

/** One sentence per failure code, so a failed row says why instead of just that it failed. */
export const FAILURE_KEY_BY_CODE: Record<FailureCode, string> = {
  auth: 'translation.failedAuth',
  'rate-limit': 'translation.failedRateLimit',
  timeout: 'translation.failedTimeout',
  'model-unavailable': 'translation.failedModelUnavailable',
  'parse-failure': 'translation.failedParse',
  'empty-reply': 'translation.failedEmptyReply',
  'provider-error': 'translation.failedProvider',
  'no-route': 'translation.failedNoRoute',
  'module-disabled': 'translation.failedModuleDisabled',
  'module-not-found': 'translation.failedModuleNotFound',
  unknown: 'translation.failedUnknown',
};

/** Short clause naming the cause of a failed batch; codes without one keep the plain sentence. */
const BATCH_CAUSE_KEY_BY_CODE: Partial<Record<FailureCode, string>> = {
  auth: 'translation.cause.auth',
  'rate-limit': 'translation.cause.rateLimit',
  timeout: 'translation.cause.timeout',
  'model-unavailable': 'translation.cause.modelUnavailable',
  'parse-failure': 'translation.cause.parse',
  'empty-reply': 'translation.cause.emptyReply',
  'provider-error': 'translation.cause.provider',
};

/**
 * The failure code for a log entry. Entries written before codes existed carry
 * the controlled reason (`no-route`, ...) in `error` instead, so it stands in.
 */
function failureCode(meta: LogMeta): FailureCode | undefined {
  if (isFailureCode(meta.code)) return meta.code;
  return isFailureCode(meta.error) ? meta.error : undefined;
}

/**
 * How a failed batch reads: with a cause clause when its code has one, as
 * "unknown cause" when the code is unknown or missing (the Raw log has the
 * provider's own message), else the plain sentence.
 */
type BatchCause =
  | { kind: 'cause'; code: FailureCode; causeKey: string }
  | { kind: 'unknown' }
  | { kind: 'plain'; code: FailureCode };

function batchCause(meta: LogMeta): BatchCause {
  const code = failureCode(meta);
  if (!code || code === 'unknown') return { kind: 'unknown' };
  const causeKey = BATCH_CAUSE_KEY_BY_CODE[code];
  return causeKey ? { kind: 'cause', code, causeKey } : { kind: 'plain', code };
}

/** The cause clause, rendered here, not by the caller's `t`, because it varies by code. */
function causeText(cause: BatchCause, meta: LogMeta): string {
  return cause.kind === 'cause'
    ? i18n.t(cause.causeKey, { ns: 'logs', module: str(meta.moduleId) })
    : '';
}

/** Pick the batch sentence for a cause from a `{ plain, cause, unknown }` key set. */
function batchKey(
  cause: BatchCause,
  keys: { plain: string; cause: string; unknown: string },
): string {
  return cause.kind === 'cause' ? keys.cause : cause.kind === 'unknown' ? keys.unknown : keys.plain;
}

function batchAction(meta: LogMeta): LogAction | undefined {
  const cause = batchCause(meta);
  return failureAction(cause.kind === 'unknown' ? 'unknown' : cause.code);
}

/** What the user can do about a failure, if anything. */
export function failureAction(code: FailureCode): LogAction | undefined {
  switch (code) {
    case 'auth':
    case 'rate-limit':
    case 'model-unavailable':
    case 'module-disabled':
    case 'module-not-found':
      return openGlobalConfig('action.openModuleSettings');
    case 'no-route':
      return openTab('routing', 'action.openRouting');
    case 'unknown':
      return switchToRaw('action.switchToRaw');
    default:
      return undefined;
  }
}

/**
 * The background run engines share one base (`BackgroundRunEngine`), which
 * logs the same events under each engine's prefix. Their sentences are shared
 * too and lead with the run's type label ("Glossary generation: …"), so no
 * language has to inflect the task name.
 */
const ENGINE_RUNS: { prefix: string; typeKey: string; queued: boolean }[] = [
  { prefix: 'judge', typeKey: RUN_TYPE_KEY['translation-ai-review'], queued: true },
  { prefix: 'source-review', typeKey: RUN_TYPE_KEY['source-ai-review'], queued: true },
  { prefix: 'glossary-gen', typeKey: RUN_TYPE_KEY['glossary-generation'], queued: true },
  // These two keep their own, older queued sentence.
  { prefix: 'category-gen', typeKey: RUN_TYPE_KEY['category-generation'], queued: false },
  { prefix: 'relink-retranslate', typeKey: RUN_TYPE_KEY['relink-retranslate'], queued: true },
  { prefix: 'stage-details', typeKey: RUN_TYPE_KEY['stage-details-translation'], queued: false },
];

function engineRunPresenters(run: (typeof ENGINE_RUNS)[number]): Record<string, LogPresenter> {
  const task = () => i18n.t(run.typeKey, { ns: 'strings' });
  const presenters: Record<string, LogPresenter> = {
    [`${run.prefix}:batch-failed`]: {
      key: (m) =>
        batchKey(batchCause(m), {
          plain: 'run.batchFailed',
          cause: 'run.batchFailedCause',
          unknown: 'run.batchFailedUnknown',
        }),
      vars: (m) => ({ task: task(), cause: causeText(batchCause(m), m) }),
      groupKey: (m) => failureCode(m) ?? 'unknown',
      action: batchAction,
    },
    [`${run.prefix}:batch-timed-out`]: {
      key: 'run.batchTimedOut',
      vars: () => ({ task: task() }),
    },
    [`${run.prefix}:freeway-rerouted`]: {
      key: 'run.freewayRerouted',
      vars: (m) => ({ task: task(), from: bucketModel(m.from), to: bucketModel(m.to) }),
    },
    [`${run.prefix}:freeway-minute-wait`]: {
      key: 'run.freewayMinuteWait',
      vars: (m) => ({
        task: task(),
        model: bucketModel(m.bucketKey),
        seconds: Math.max(1, Math.round(num(m.delayMs, 0) / 1000)),
      }),
    },
  };
  if (run.queued) {
    presenters[`${run.prefix}:queued`] = { key: 'run.queued', vars: () => ({ task: task() }) };
  }
  return presenters;
}

/**
 * Hand-written presentation for the event keys a person benefits from seeing.
 * Every other server event key is listed in `RAW_ONLY_KEYS` (raw-only.ts) and
 * shows only in the Raw log; a coverage guard in the test suite fails on a key in neither.
 * Anything unmapped that still reaches the friendly log (prose, an old entry)
 * degrades through `fallbackText`.
 */
export const LOG_PRESENTERS: Record<string, LogPresenter> = {
  'translation:start': {
    key: 'translation.start',
    vars: (m) => ({ language: languageName(m.targetLanguage) }),
  },
  'translation:done': {
    key: (m) => (m.tmHit ? 'translation.doneFromMemory' : 'translation.done'),
    vars: (m) => ({ language: languageName(m.targetLanguage) }),
  },
  'translation:queued': {
    key: 'translation.queued',
    vars: (m) => ({ count: num(m.total, 0), total: num(m.total, 0) }),
  },
  'translation:run-queued': {
    key: 'translation.runQueued',
    vars: (m) => ({ position: num(m.queuePosition, 0) }),
  },
  'translation:retry-queued': {
    key: 'translation.retryQueued',
    vars: (m) => ({ position: num(m.queuePosition, 0) }),
  },
  'translation:retry': { key: 'translation.retry' },
  'translation:failed': {
    key: (m) => {
      const code = failureCode(m);
      return code ? FAILURE_KEY_BY_CODE[code] : 'translation.failedGeneric';
    },
    vars: failureVars,
    // Aggregate by cause + language: auth failures to French fold together,
    // while a timeout to German stays its own row.
    groupKey: (m) => `${failureCode(m) ?? str(m.error, '')} ${str(m.targetLanguage, '')}`,
    action: (m) => {
      const code = failureCode(m);
      return code ? failureAction(code) : undefined;
    },
  },
  'translation:batch-failed': {
    key: (m) =>
      batchKey(batchCause(m), {
        plain: 'translation.batchFailed',
        cause: 'translation.batchFailedCause',
        unknown: 'translation.batchFailedUnknown',
      }),
    vars: (m) => ({
      count: num(m.batchSize, 0),
      languages: Array.isArray(m.targetLanguages)
        ? m.targetLanguages.map(languageName).join(', ')
        : '?',
      cause: causeText(batchCause(m), m),
    }),
    action: batchAction,
  },
  'translation:batch-uncaught': {
    key: 'translation.batchUncaught',
    action: () => switchToRaw('action.switchToRaw'),
  },
  'translation:queue-start-failed': { key: 'translation.queueStartFailed' },
  'translation:mask-mismatch': {
    key: 'translation.maskMismatch',
    vars: (m) => ({ language: languageName(m.targetLanguage) }),
    groupKey: (m) => str(m.targetLanguage, ''),
  },
  'translation:tm-rejected': {
    key: 'translation.tmRejected',
    vars: (m) => ({ language: languageName(m.targetLanguage) }),
  },
  'translation:lqa-retry': { key: 'translation.lqaRetry' },
  'translation:auth-cancel': { key: 'translation.authCancel' },
  'translation:start-aborted': { key: 'translation.startAborted' },
  'translation:waiting-for-quota': {
    // `resumeAt` is null when no bucket has reported when its quota returns.
    key: (m) =>
      typeof m.resumeAt === 'number'
        ? 'translation.waitingForQuotaUntil'
        : 'translation.waitingForQuota',
    vars: (m) => ({ time: clockTime(m.resumeAt) }),
  },
  'translation:quota-redispatched': { key: 'translation.quotaRedispatched' },
  'translation:quota-park-adopted': { key: 'translation.quotaParkAdopted' },
  'translation:freeway-rerouted': {
    key: 'translation.freewayRerouted',
    vars: (m) => ({ from: bucketModel(m.from), to: bucketModel(m.to) }),
  },
  'translation:freeway-instance-swapped': {
    key: 'translation.freewayInstanceSwapped',
    vars: (m) => ({ fromModule: str(m.fromModuleId), toModule: str(m.toModuleId) }),
  },
  'translation:freeway-deferred': {
    key: 'translation.freewayDeferred',
    vars: (m) => ({ model: bucketModel(m.bucketKey), time: clockTime(m.resumeAt) }),
  },
  'translation:freeway-degraded': { key: 'translation.freewayDegraded' },
  'translation:freeway-escalated': {
    key: 'translation.freewayEscalated',
    vars: (m) => ({ language: languageName(m.targetLanguage), to: bucketModel(m.to) }),
  },
  'translation:freeway-credential-disabled': {
    key: 'translation.freewayCredentialDisabled',
    vars: (m) => ({ module: str(m.moduleId) }),
    action: () => openGlobalConfig('action.openModuleSettings'),
  },
  'translation:lqa-correction-failed': { key: 'translation.lqaCorrectionFailed' },
  'translation:lqa-correction-skipped': {
    key: (m) =>
      m.reason === 'entry-removed'
        ? 'translation.lqaCorrectionSkippedRemoved'
        : 'translation.lqaCorrectionSkipped',
    vars: (m) => ({ language: languageName(m.targetLanguage) }),
  },
  'translation:lqa-correction-unavailable': {
    key: 'translation.lqaCorrectionUnavailable',
    vars: (m) => ({ language: languageName(m.targetLanguage), module: str(m.moduleId) }),
  },
  'translation:lqa-retry-failed': {
    // One call site logs a whole batch and may not know its language.
    key: (m) =>
      typeof m.targetLanguage === 'string' && m.targetLanguage !== ''
        ? 'translation.lqaRetryFailedLanguage'
        : 'translation.lqaRetryFailed',
    vars: (m) => ({ language: languageName(m.targetLanguage) }),
  },
  'translation:split-phase-start': {
    key: 'translation.splitPhaseStart',
    vars: (m) => ({ model: str(m.model) }),
  },
  'translation:tm-lookup-failed': {
    key: 'translation.tmLookupFailed',
    vars: (m) => ({ language: languageName(m.targetLanguage) }),
  },

  'lqa:passed': { key: 'lqa.passed' },
  'lqa:failed': { key: 'lqa.failed' },
  'lqa:overflow': { key: 'lqa.overflow', action: () => openTab('quality', 'action.openQuality') },
  'lqa:check-error': { key: 'lqa.checkError' },

  'judge:done': {
    key: 'judge.done',
    vars: (m) => ({ score: num(m.score, 0), verdict: str(m.verdict) }),
  },
  'judge:suggest-done': { key: 'judge.suggestDone' },
  'judge:suggest-no-change': { key: 'judge.suggestNoChange' },
  'judge:suggestion-discarded': { key: 'judge.suggestionDiscarded' },
  'source-review:done': {
    key: 'sourceReview.done',
    vars: (m) => ({ count: num(m.findings, 0), findings: num(m.findings, 0) }),
  },

  'glossary-gen:done': {
    key: 'glossaryGen.done',
    vars: (m) => ({ suggested: num(m.suggested, 0), analyzed: num(m.analyzed, 0) }),
  },
  'glossary-gen:failed': {
    key: 'glossaryGen.failed',
    action: () => openTab('glossary', 'action.openGlossary'),
  },
  'glossary-gen:save-suggestions-failed': {
    key: 'glossaryGen.saveSuggestionsFailed',
    action: () => openTab('glossary', 'action.openGlossary'),
  },

  'category-gen:queued': { key: 'categoryGen.queued' },
  'category-gen:done': {
    key: 'categoryGen.done',
    vars: (m) => ({ suggestions: num(m.suggestions, 0) }),
  },
  'category-gen:failed': { key: 'categoryGen.failed' },

  'stage-details:queued': { key: 'stageDetails.queued' },
  'stage-details:done': {
    key: 'stageDetails.done',
    vars: (m) => ({ completed: num(m.completed, 0), failed: num(m.failed, 0) }),
  },
  'stage-details:failed': { key: 'stageDetails.failed' },

  'relink-retranslate:done': {
    key: 'relinkRetranslate.done',
    vars: (m) => ({ language: languageName(m.targetLanguage) }),
  },
  'relink-retranslate:mask-mismatch': {
    key: 'relinkRetranslate.maskMismatch',
    vars: (m) => ({ language: languageName(m.targetLanguage) }),
    groupKey: (m) => str(m.targetLanguage, ''),
  },

  ...ENGINE_RUNS.reduce<Record<string, LogPresenter>>(
    (acc, run) => Object.assign(acc, engineRunPresenters(run)),
    {},
  ),

  // Verbose chat diagnostics (opt-in per turn). The prompt itself is raw-only.
  'chat:dispatch': {
    key: 'chat.dispatch',
    vars: (m) => ({ model: str(m.model) }),
  },
  'chat:done': {
    key: (m) =>
      m.outcome === 'failed'
        ? 'chat.doneFailed'
        : m.outcome === 'cancelled'
          ? 'chat.doneCancelled'
          : 'chat.done',
    vars: (m) => ({ model: str(m.model), seconds: secondsText(m.totalMs) }),
    // The provider's error message is only in the raw entry.
    action: (m) => (m.outcome === 'failed' ? switchToRaw('action.switchToRaw') : undefined),
  },

  'module:loaded': { key: 'module.loaded', vars: (m) => ({ module: str(m.moduleId) }) },
  'module:instance-registered': {
    key: 'module.instanceRegistered',
    vars: (m) => ({ instance: str(m.instanceId) }),
  },
  'module:instance-register-failed': {
    key: 'module.instanceRegisterFailed',
    vars: (m) => ({ instance: str(m.instanceId) }),
  },
  'module:instance-unregistered': {
    key: 'module.instanceUnregistered',
    vars: (m) => ({ instance: str(m.instanceId) }),
  },
  'module:config-updated': {
    key: 'module.configUpdated',
    vars: (m) => ({ module: str(m.moduleId) }),
  },

  'global-config:instance-created': {
    key: 'globalConfig.instanceCreated',
    vars: (m) => ({ instance: str(m.instanceId) }),
  },
  'global-config:instance-deleted': {
    key: 'globalConfig.instanceDeleted',
    vars: (m) => ({ instance: str(m.instanceId) }),
  },
  'global-config:instance-renamed': {
    key: 'globalConfig.instanceRenamed',
    vars: (m) => ({ instance: str(m.instanceId) }),
  },
  'global-config:settings-updated': { key: 'globalConfig.settingsUpdated' },
  'global-config:updated': {
    key: 'globalConfig.updated',
    vars: (m) => ({ module: str(m.moduleId) }),
  },

  'vault:unlocked': { key: 'vault.unlocked' },
  'vault:password-changed': { key: 'vault.passwordChanged' },
  'credentials:evicted': {
    key: 'vault.credentialsEvicted',
    action: () => unlockVault('action.unlockVault'),
  },

  'orphan:detected': {
    key: 'orphan.detected',
    vars: (m) => ({ count: num(m.count, 0) }),
  },
  'orphan:linked': { key: 'orphan.linked' },
  'orphan:deleted': { key: 'orphan.deleted' },

  'tm:cleared': { key: 'tm.cleared' },
  'tm:variant-deleted': { key: 'tm.variantDeleted' },

  'backup:restored': { key: 'backup.restored' },
  'backup:prune-failed': { key: 'backup.pruneFailed' },
  'backup:restored-from-pg': { key: 'backup.restoredFromPg' },
  'backup:restored-from-server': { key: 'backup.restoredFromServer' },

  'csv-export:roundtrip-unsafe': {
    key: 'csvExport.roundtripUnsafe',
    vars: (m) => ({
      columns: Array.isArray(m.columns) && m.columns.length > 0 ? m.columns.join(', ') : '?',
    }),
  },
  'runs:revert-entry-failed': {
    key: 'runs.revertEntryFailed',
    vars: (m) => ({ language: languageName(m.targetLanguage) }),
  },
};
