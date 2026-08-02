/**
 * Pseudo-localization module.
 *
 * Produces a deterministic, offline "translation" of the source text that
 * makes localization bugs visible in a game UI:
 *  - every ASCII letter is accent-folded (`Translation` → `Ŧřàñşļàţîöñ`),
 *    so hard-coded (non-externalized) strings stand out immediately;
 *  - the text is padded with `~` up to a configurable expansion ratio
 *    (default 1.4×) to simulate longer languages like German;
 *  - the result is bracketed with `⟦…⟧` so truncation is obvious.
 *
 * Masking placeholders injected by the host's TranslationMasker (M17) —
 * `{t:n}`/`{/t:n}`, `{v:n}`, `{g:n}`, `{e:n}` — pass through completely untouched
 * (no folding, no padding inside them). This doubles as a self-test of the
 * masking layer: if a placeholder comes back mangled, the masker (not this
 * module) lost it.
 *
 * No credentials, no network calls. costTier is `free`.
 */

import type {
  ConfigSchemaField,
  TranslationJob,
  TranslationModule,
  TranslationResult,
} from '@zercade-dev/narn-shared';
import { MASK_TOKEN_SOURCE } from '@zercade-dev/narn-shared';

export const DEFAULT_EXPANSION_RATIO = 1.4;
const MIN_EXPANSION_RATIO = 1;
const MAX_EXPANSION_RATIO = 4;

const PAD_CHAR = '~';
const OPEN_BRACKET = '⟦';
const CLOSE_BRACKET = '⟧';

/**
 * Compile the M17 mask-token matcher ({t:1}, {/t:1}, {v:2}, {g:3}, {e:4}) from
 * the canonical shared grammar, so pseudo can never drift from deepl / M17 on
 * what a placeholder is.
 *
 * A FRESH `/g` `RegExp` is built per call (rather than sharing a module-level
 * instance) so that the `matchAll` iteration below — and any future `.exec()` /
 * `.test()` use — starts from a clean `lastIndex` every time, eliminating the
 * cross-call skip hazard a shared stateful `/g` instance would carry.
 */
function maskTokenRegExp(): RegExp {
  return new RegExp(MASK_TOKEN_SOURCE, 'g');
}

/** Deterministic accent-fold table for ASCII letters. */
const ACCENT_MAP: Record<string, string> = {
  a: 'à',
  b: 'ƀ',
  c: 'ç',
  d: 'đ',
  e: 'è',
  f: 'ƒ',
  g: 'ğ',
  h: 'ĥ',
  i: 'î',
  j: 'ĵ',
  k: 'ķ',
  l: 'ļ',
  m: 'ɱ',
  n: 'ñ',
  o: 'ö',
  p: 'þ',
  q: 'ɋ',
  r: 'ř',
  s: 'ş',
  t: 'ţ',
  u: 'û',
  v: 'ṽ',
  w: 'ŵ',
  x: 'ẋ',
  y: 'ý',
  z: 'ž',
  A: 'À',
  B: 'Ɓ',
  C: 'Ç',
  D: 'Đ',
  E: 'È',
  F: 'Ƒ',
  G: 'Ğ',
  H: 'Ĥ',
  I: 'Î',
  J: 'Ĵ',
  K: 'Ķ',
  L: 'Ļ',
  M: 'Ṁ',
  N: 'Ñ',
  O: 'Ö',
  P: 'Þ',
  Q: 'Ɋ',
  R: 'Ř',
  S: 'Ş',
  T: 'Ŧ',
  U: 'Û',
  V: 'Ṽ',
  W: 'Ŵ',
  X: 'Ẋ',
  Y: 'Ý',
  Z: 'Ž',
};

/** Accent-fold every ASCII letter in a placeholder-free segment. */
function foldSegment(segment: string): string {
  let out = '';
  for (const ch of segment) out += ACCENT_MAP[ch] ?? ch;
  return out;
}

/**
 * Pseudo-localize one source string: fold letters outside placeholders, pad
 * the visible (non-placeholder) length up to `ratio`, and bracket the result.
 */
export function pseudoLocalize(text: string, ratio: number): string {
  let folded = '';
  let visibleLength = 0;
  let lastIndex = 0;

  for (const match of text.matchAll(maskTokenRegExp())) {
    const segment = text.slice(lastIndex, match.index);
    folded += foldSegment(segment) + match[0];
    visibleLength += segment.length;
    lastIndex = match.index + match[0].length;
  }
  const tail = text.slice(lastIndex);
  folded += foldSegment(tail);
  visibleLength += tail.length;

  const targetLength = Math.ceil(visibleLength * ratio);
  // The `Math.max(0, …)` clamp guards direct `pseudoLocalize(text, ratio<1)`
  // callers; module callers always go through `resolveExpansionRatio`, which
  // clamps `ratio` to `>= 1`, so `targetLength >= visibleLength` and the clamp
  // never fires on that path. It is intentional, not dead code.
  const padding = PAD_CHAR.repeat(Math.max(0, targetLength - visibleLength));
  // Empty/blank source intentionally yields the bare `⟦⟧` shell rather than ''.
  // The brackets are pseudo's truncation-visibility marker, so always emitting
  // them (even for empty input) keeps that guarantee uniform across all jobs.
  return `${OPEN_BRACKET}${folded}${padding}${CLOSE_BRACKET}`;
}

export interface PseudoConfig {
  /**
   * Target length multiplier for padding. Accepts a number or numeric string
   * (the config UI stores strings). Clamped to [1, 4]; invalid values fall
   * back to the default 1.4.
   */
  expansionRatio?: string | number;
}

/**
 * Resolve the expansion ratio from config, with clamping and fallback.
 *
 * The `number` branch is intentional, not dead code: the config UI/manifest
 * only ever supply strings (`type: 'string'`, default `'1.4'`), so at runtime
 * `value` is always a string or undefined. The numeric path is kept for
 * defensive direct callers and is exercised by the unit tests
 * (`resolveExpansionRatio(0.5)` / `(99)`); do not narrow to `string` without
 * updating those specs.
 */
export function resolveExpansionRatio(value: string | number | undefined): number {
  const normalized = typeof value === 'string' ? value.trim() : value;
  if (normalized === undefined || normalized === '') return DEFAULT_EXPANSION_RATIO;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return DEFAULT_EXPANSION_RATIO;
  return Math.min(MAX_EXPANSION_RATIO, Math.max(MIN_EXPANSION_RATIO, parsed));
}

export function createPseudoModule(config: PseudoConfig = {}): TranslationModule {
  const ratio = resolveExpansionRatio(config.expansionRatio);

  return {
    id: 'pseudo',
    name: 'Pseudo-localization',
    version: '1.0.0',
    capabilities: ['translate', 'batch'],
    costTier: 'free',
    configSchema: {
      expansionRatio: {
        type: 'string',
        default: String(DEFAULT_EXPANSION_RATIO),
        description:
          'Target length multiplier for padding (e.g. 1.4 makes the output ~40% longer than the source). Values are clamped to the 1–4 range; invalid input falls back to 1.4.',
      } satisfies ConfigSchemaField,
    },

    // Pseudo is offline, credential-free, and has no external dependency, so it
    // is always available: report healthy immediately with zero latency.
    async healthCheck(): Promise<{ ok: boolean; latencyMs?: number }> {
      return { ok: true, latencyMs: 0 };
    },

    async translate(jobs: TranslationJob[], signal?: AbortSignal): Promise<TranslationResult[]> {
      // The abort signal is checked once, up front, because the work below is a
      // fully synchronous `jobs.map(...)` with no `await` inside it. A signal
      // that fires mid-map cannot interrupt a synchronous loop, and for this
      // CPU-only fake provider each batch is tiny and effectively instant, so a
      // single boundary check (matching the LLM modules' per-batch pattern) is
      // sufficient — there is no long-running step to cancel partway through.
      signal?.throwIfAborted();
      return jobs.map((job) => {
        const translatedText = pseudoLocalize(job.sourceText, ratio);
        // No LLM prompt and no tokens: input is just the source text, output is
        // the produced string. Reported per result (the host sums across results).
        return {
          entryId: job.entryId,
          targetLanguage: job.targetLanguage,
          translatedText,
          usage: {
            promptChars: job.sourceText.length,
            sourceChars: job.sourceText.length,
            responseChars: translatedText.length,
            outputChars: translatedText.length,
          },
        };
      });
    },
  };
}

// Re-export the manifest so the server's module-index can import it via the package
// specifier (`@zercade-dev/narn-module-pseudo`). The relative `../manifest.json` resolves
// from both src/index.ts and the flat dist/index.js to modules/pseudo/manifest.json.
export { default as manifest } from '../manifest.json' with { type: 'json' };

export default createPseudoModule;
