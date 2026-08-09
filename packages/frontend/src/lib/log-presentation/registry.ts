import type { LogMeta, LogPresenter } from './types.js';
import { openTab, openGlobalConfig, unlockVault } from './actions.js';

/**
 * Expand a language code to a display name ("fr" -> "French"). Falls back to
 * the raw code, which is what the synthetic `pseudo-test` language and any
 * non-standard tag resolve to.
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
    const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
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

/** `count` defaults to 1 — a non-aggregated trace represents a single item. */
const failureVars = (meta: LogMeta) => ({
  count: num(meta.count, 1),
  language: languageName(meta.targetLanguage),
  module: str(meta.moduleId),
});

const FAILURE_KEY_BY_REASON: Record<string, string> = {
  'no-route': 'translation.failedNoRoute',
  'module-disabled': 'translation.failedModuleDisabled',
  'module-not-found': 'translation.failedModuleNotFound',
};

/**
 * Hand-written presentation for the event keys users actually meet. Everything
 * else degrades through `fallbackText`. Deliberately not exhaustive: forcing a
 * presenter for every new log call would make the registry a merge blocker.
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
    key: (m) => FAILURE_KEY_BY_REASON[str(m.error, '')] ?? 'translation.failedGeneric',
    vars: failureVars,
    // Aggregate by reason + language: "no routing rule" failures to French fold
    // together, while a provider error to German stays its own row.
    groupKey: (m) => `${str(m.error, '')} ${str(m.targetLanguage, '')}`,
    action: (m) => {
      const reason = str(m.error, '');
      if (reason === 'no-route') return openTab('routing', 'action.openRouting');
      if (reason === 'module-disabled' || reason === 'module-not-found') {
        return openGlobalConfig('action.openModuleSettings');
      }
      return undefined;
    },
  },
  'translation:batch-failed': {
    key: 'translation.batchFailed',
    vars: (m) => ({
      count: num(m.batchSize, 0),
      languages: Array.isArray(m.targetLanguages)
        ? m.targetLanguages.map(languageName).join(', ')
        : '?',
    }),
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

  'module:loaded': { key: 'module.loaded', vars: (m) => ({ module: str(m.moduleId) }) },
  'module:instance-registered': {
    key: 'module.instanceRegistered',
    vars: (m) => ({ instance: str(m.instanceId) }),
  },
  'module:instance-register-failed': {
    key: 'module.instanceRegisterFailed',
    vars: (m) => ({ instance: str(m.instanceId) }),
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
};
