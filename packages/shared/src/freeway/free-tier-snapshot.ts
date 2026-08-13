/**
 * NARN Freeway — bundled free-tier snapshot.
 *
 * Curated, release-prep-refreshed data describing each supported free plan:
 * request/token/char limits per window, reset semantics, and a curated
 * quality tier per model (4 = strongest free models, escalation targets;
 * 3 = strong general; 2 = small/fast; 1 = classical MT). Same lifecycle as
 * the AI-provider pricing snapshot: static JSON shipped with the package.
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
  limits: FreeTierLimit[];
  /** Recommended max strings per request for a reliable model of this tier. */
  maxBatch: number;
  contextLength?: number;
  /** Target languages this model is curated as weak at (selector demotes). */
  weakLanguages?: string[];
}

export interface FreeTierProvider {
  /** Module or module-instance id that dispatches this provider's jobs. */
  moduleId: string;
  /** IANA zone the provider's daily/monthly windows reset in. */
  resetTimeZone: string;
  /** Authoritative usage endpoint, when the provider has one. */
  probe?: 'deepl-usage' | 'openrouter-key';
  models: FreeTierModel[];
  /**
   * generic-ai preset providers only (groq, mistral, cerebras): the
   * OpenAI-compatible base URL a one-click Freeway preset instance is
   * pre-shaped with.
   */
  presetBaseUrl?: string;
  /** The model id a one-click Freeway preset instance defaults to (this provider's first snapshot model). */
  presetDefaultModel?: string;
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
