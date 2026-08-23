/**
 * NARN Freeway — bundled free-tier snapshot.
 *
 * Curated, release-prep-refreshed data describing each supported free plan:
 * request/token/char limits per window, reset semantics, and a benchmark-led
 * quality tier per model:
 *   4 = strongest free models, the escalation targets;
 *   3 = strong general models, including classical MT that benchmarks there;
 *   2 = small/fast models;
 *   1 = weak, last-resort models (no bundled model sits here today).
 * Same lifecycle as the AI-provider pricing snapshot: static JSON shipped with
 * the package.
 */
import freeTierJson from './free-tier-data.json' with { type: 'json' };

export type FreewayWindowKind = 'rpm' | 'rpd' | 'tpm' | 'monthly_chars';

export interface FreeTierLimit {
  window: FreewayWindowKind;
  limit: number;
}

export interface FreeTierModel {
  id: string;
  qualityTier: 1 | 2 | 3 | 4;
  /**
   * Freeway-managed structured-output setting, applied at dispatch time to
   * the module instance serving this bucket. Overrides any global/project
   * module config for Freeway-routed jobs — support is a per-model upstream
   * fact, not a user preference. Undefined: the module's own default governs.
   */
  useStructuredOutput?: boolean;
  limits: FreeTierLimit[];
  /** Recommended max strings per request for a reliable model of this tier. */
  maxBatch: number;
  /**
   * Source characters this model reliably translates in ONE request. Curation
   * must respect the provider's output cap (translated output is roughly
   * input-sized) and any tpm limit. Absent: legacy flat-maxBatch sizing.
   */
  charBudget?: number;
  /**
   * Hard cap on strings per request no matter how short they are — the
   * counting/parse reliability limit. Absent: `maxBatch` is the cap.
   */
  batchCeiling?: number;
  contextLength?: number;
  /** Target languages this model is curated as weak at (selector demotes). */
  weakLanguages?: string[];
  /** Benchmark-derived judged quality per registry language code (0-100). */
  langScores?: Record<string, number>;
  /** Benchmark-derived first-attempt compliance rate per language (0-1). */
  langPassPriors?: Record<string, number>;
  /** Languages this model must never serve (unusable/unsupported per benchmark). */
  blockedLanguages?: string[];
}

export interface FreeTierProvider {
  /**
   * The provider's base module id, always — never a module-instance id. This
   * is what keys the quota ledger (`bucketKey`), not necessarily what
   * dispatches the job: a workspace configured via a named instance
   * dispatches through that instance instead (see `BucketView.dispatchModuleId`).
   */
  moduleId: string;
  /** IANA zone the provider's daily/monthly windows reset in. */
  resetTimeZone: string;
  /** Authoritative usage endpoint, when the provider has one. */
  probe?: 'deepl-usage' | 'openrouter-key';
  /**
   * True when this provider's modules run the shared AI-SDK core and accept a
   * mixed-target batch (one request, entries in different languages). The M9
   * dispatcher only packs multi-language chunks for providers marked here.
   */
  supportsMixedBatch?: boolean;
  models: FreeTierModel[];
  /**
   * Account-wide limits shared across ALL of this provider's models (e.g. the
   * OpenRouter `:free` pool). Per-model `limits` still apply individually; the
   * effective headroom of any bucket is the tighter of the two.
   */
  sharedLimits?: FreeTierLimit[];
}

export interface FreeTierSnapshot {
  generatedAt: string;
  providers: Record<string, FreeTierProvider>;
}

const snapshot = freeTierJson as unknown as FreeTierSnapshot;

export function getFreeTierSnapshot(): FreeTierSnapshot {
  return snapshot;
}

/** Look up a provider by its snapshot key OR its moduleId (both are stable). */
export function freeTierProvider(idOrKey: string): FreeTierProvider | undefined {
  const direct = snapshot.providers[idOrKey];
  if (direct) return direct;
  return Object.values(snapshot.providers).find((p) => p.moduleId === idOrKey);
}

export function freeTierModel(idOrKey: string, modelId: string): FreeTierModel | undefined {
  return freeTierProvider(idOrKey)?.models.find((m) => m.id === modelId);
}

/**
 * Whether this provider's models draw on ONE account-wide DAY-scale budget —
 * the single predicate for every pooled behaviour (pool headroom derivation,
 * pool-wide cooldown, pooled probe attribution), so they cannot disagree about
 * what a pool is. Only a shared `rpd` entry counts: a shared per-MINUTE cap is
 * a pacing constraint, not a shared daily allowance, and must not sideline a
 * whole provider or collapse its models into one budget.
 */
export function hasSharedPool(provider: FreeTierProvider): boolean {
  return provider.sharedLimits?.some((limit) => limit.window === 'rpd') === true;
}
