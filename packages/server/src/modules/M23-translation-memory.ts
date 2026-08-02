/**
 * M23 — translation-memory helpers (fingerprinting, matching, hint formatting).
 *
 * Global (cross-project) translation memory with context-aware exact matching.
 * Persistence now lives in `PgTranslationMemory` (storage seam: the
 * `translation_memory` table, row-per-variant). This module keeps only the
 * pure, storage-agnostic logic that the adapter and M9 share — the store class
 * and its singleton moved out.
 *
 * Keying: `sha256(maskedSource):targetLanguage` — the hash is computed over
 * the MASKED text form produced by M17 (`{t:n}`/`{v:n}`/`{g:n}` placeholders),
 * NOT the raw source (`StringEntry.id` hashes the raw source), so strings
 * that differ only in inline markup / runtime variables / constant glossary
 * terms still hit the same segment.
 *
 * Each segment holds up to {@link MAX_VARIANTS_PER_SEGMENT} variants; when the
 * cap is exceeded, eviction keeps LQA-passed variants first, then the most
 * recent ones (see `rankVariants`). The engine only records LQA-passed
 * results; any variant with `lqaPassed: false` (hand-seeded / legacy) is
 * ignored by `lookup` — neither auto-applied nor surfaced as a hint.
 *
 * v1 is exact-match only — no fuzzy matching / n-gram index.
 */
import type {
  PromptOptions,
  StringEntry,
  TmFingerprint,
  TmMatchPolicy,
  TmVariant,
} from '@zercade-dev/narn-shared';
import { DEFAULT_OVERFLOW_RATIO } from '@zercade-dev/narn-shared';
import { sha256Hex } from '../utils/hash.js';

export const MAX_VARIANTS_PER_SEGMENT = 8;
/** Maximum number of "similar prior translation" hints surfaced per job. */
export const MAX_TM_HINTS = 3;

/** Trim + casefold; empty and absent are normalized alike to `''`. */
function normalizeField(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeCategories(categories: unknown): string[] {
  if (!Array.isArray(categories)) return [];
  const cleaned = categories.map(normalizeField).filter((c) => c.length > 0);
  return Array.from(new Set(cleaned)).sort();
}

/** Source origin labels share categories' normalization (dedupe, casefold, sort). */
const normalizeSources = normalizeCategories;

/** SHA-256 hex of the masked source text. */
export function hashMaskedSource(maskedSource: string): string {
  return sha256Hex(maskedSource);
}

export function tmSegmentKey(maskedSource: string, targetLanguage: string): string {
  return `${hashMaskedSource(maskedSource)}:${targetLanguage}`;
}

/**
 * Builds the normalized context fingerprint for an entry + the routing rule's
 * prompt options. All fields are trim/casefolded; empty and absent collapse
 * to the same value so cosmetic differences never break matching.
 */
export function buildTmFingerprint(
  entry: StringEntry,
  promptOptions?: PromptOptions,
): TmFingerprint {
  return {
    sources: normalizeSources(entry.sources),
    categories: normalizeCategories(entry.categories),
    context: normalizeField(entry.context),
    character: normalizeField(entry.metadata?.character),
    tone: normalizeField(entry.metadata?.tone),
    gender: normalizeField(entry.metadata?.gender),
    promptCharacter: normalizeField(promptOptions?.character),
    promptTone: normalizeField(promptOptions?.tone),
    promptGender: normalizeField(promptOptions?.gender),
    promptNotes: normalizeField(promptOptions?.notes),
    overflowRegime: entry.ignoreOverflow
      ? 'ignore'
      : (entry.overflowRatio ?? DEFAULT_OVERFLOW_RATIO).toFixed(2),
  };
}

function stringArraysEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  // Tolerate hand-seeded / legacy variants whose fingerprint lacks the array.
  const left = a ?? [];
  const right = b ?? [];
  return left.length === right.length && left.every((v, i) => v === right[i]);
}

/** True when `stored` matches `current` under the given policy. */
export function fingerprintMatches(
  stored: TmFingerprint,
  current: TmFingerprint,
  policy: TmMatchPolicy,
): boolean {
  // Defensive: callers gate `disabled` before reaching the store; treat any
  // that slip through as a non-match so a disabled project never auto-applies.
  if (policy === 'disabled') return false;
  if (policy === 'source-only') return true;
  const coreMatch =
    stringArraysEqual(stored.sources, current.sources) && stored.context === current.context;
  if (policy === 'relaxed') return coreMatch;
  return (
    coreMatch &&
    stringArraysEqual(stored.categories, current.categories) &&
    stored.character === current.character &&
    stored.tone === current.tone &&
    stored.gender === current.gender &&
    stored.promptCharacter === current.promptCharacter &&
    stored.promptTone === current.promptTone &&
    stored.promptGender === current.promptGender &&
    stored.promptNotes === current.promptNotes &&
    stored.overflowRegime === current.overflowRegime
  );
}

/**
 * Human-readable summary of how a stored variant's fingerprint differs from
 * the current entry's. Used to annotate "similar prior translation" hints.
 */
export function describeFingerprintDiff(stored: TmFingerprint, current: TmFingerprint): string {
  const parts: string[] = [];
  if (!stringArraysEqual(stored.sources, current.sources)) {
    parts.push(
      (stored.sources ?? []).length > 0 ? `sources [${stored.sources.join(', ')}]` : 'no sources',
    );
  }
  if (stored.context !== current.context) {
    parts.push(stored.context ? `context "${stored.context}"` : 'no context');
  }
  if (!stringArraysEqual(stored.categories, current.categories)) {
    parts.push(
      stored.categories.length > 0
        ? `categories [${stored.categories.join(', ')}]`
        : 'no categories',
    );
  }
  for (const [label, a, b] of [
    ['character', stored.character, current.character],
    ['tone', stored.tone, current.tone],
    ['gender', stored.gender, current.gender],
    ['prompt character', stored.promptCharacter, current.promptCharacter],
    ['prompt tone', stored.promptTone, current.promptTone],
    ['prompt gender', stored.promptGender, current.promptGender],
    ['prompt notes', stored.promptNotes, current.promptNotes],
    ['overflow budget', stored.overflowRegime, current.overflowRegime],
  ] as const) {
    if (a !== b) parts.push(a ? `${label} "${a}"` : `no ${label}`);
  }
  return parts.length > 0 ? parts.join(', ') : 'same context';
}

export interface TmLookupQuery {
  maskedSource: string;
  targetLanguage: string;
  fingerprint: TmFingerprint;
  policy: TmMatchPolicy;
  /**
   * The current entry's overflow ratio budget, or `null` when overflow is
   * ignored. Under `strict`/`relaxed` an otherwise-matching variant whose
   * masked translation exceeds `maskedSource.length * overflowLimit` is
   * downgraded to a hint instead of auto-applied.
   */
  overflowLimit: number | null;
}

export interface TmHint {
  variant: TmVariant;
  /** Why the variant was not auto-applied (context diff or overflow budget). */
  reason: string;
}

export interface TmLookupResult {
  /** Variant safe to auto-apply (LQA-passed, fingerprint matched per policy, fits budget). */
  autoApply: TmVariant | null;
  /** Same-hash variants that must NOT be auto-applied; surfaced as job hints. */
  hints: TmHint[];
}

/**
 * Best-first ordering: LQA-passed first, then most recent. Exported so the
 * `PgTranslationMemory` adapter reuses the exact ranking the engine relies on
 * (auto-apply winner selection + per-segment variant-cap eviction).
 */
export function rankVariants(variants: TmVariant[]): TmVariant[] {
  return [...variants].sort((a, b) => {
    if (a.lqaPassed !== b.lqaPassed) return a.lqaPassed ? -1 : 1;
    return b.timestamp - a.timestamp;
  });
}

/**
 * Renders TM hints as a context suffix for a `TranslationJob`. `restore`
 * converts the stored masked text back to display form using the current
 * entry's mask plan (valid because hints share the exact masked source).
 */
export function formatTmHints(
  hints: TmHint[],
  restore: (maskedText: string) => string,
): string | undefined {
  if (hints.length === 0) return undefined;
  const lines = hints.map(
    (h) =>
      `- same text previously translated as "${restore(h.variant.translatedText)}" (${h.reason})`,
  );
  return `Similar prior translations (for reference only, do not blindly reuse):\n${lines.join('\n')}`;
}

/** Appends TM hints to an existing job context, when present. */
export function appendTmHints(
  context: string | undefined,
  hints: string | undefined,
): string | undefined {
  if (!hints) return context;
  return context && context.trim().length > 0 ? `${context}\n\n${hints}` : hints;
}
