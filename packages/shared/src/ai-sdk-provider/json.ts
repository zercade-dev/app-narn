/**
 * Small JSON helpers shared across the provider-layer parsers (translate,
 * judge, source-review, glossary-suggest, category-classifier). These keep the
 * "strip fences / slice between the first and last bracket" envelope-handling
 * and the `isRecord` guard in one place instead of copied per feature.
 */

/** Narrows to a plain object (excludes arrays and null). */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Strips a surrounding ```json code fence (or prose) and returns the JSON
 * payload delimited by `open`/`close`. Searches inside the fence body when a
 * fence is present, otherwise the whole text, slicing from the first `open` to
 * the last `close`; falls back to the trimmed search space when no bracket pair
 * is found. `open`/`close` select the bracket pair: `[`/`]` for array payloads,
 * `{`/`}` for object payloads.
 */
export function extractJsonBetween(text: string, open: string, close: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] ?? text;

  const first = candidate.indexOf(open);
  const last = candidate.lastIndexOf(close);
  // A well-formed payload has the open bracket before a later close bracket;
  // slice that span. When no usable pair exists (e.g. a fenced block whose inner
  // content has no brackets at all) fall back to the trimmed candidate — which
  // is not valid JSON for the requested shape, so the caller's JSON.parse fails
  // and returns null rather than silently parsing a partial fragment.
  if (first >= 0 && last > first) {
    return candidate.slice(first, last + 1).trim();
  }

  return candidate.trim();
}

/**
 * Shared "JSON array of indexed objects → dense, in-order results" envelope used
 * by the judge and source-review parsers (and any future per-item batch parser).
 * Owns the parse + array-length check, per-row `i` validation, duplicate-index
 * guard, sparse-slot fill, and the final "every slot present" check; the caller
 * supplies only `extractPayload` (how to pull the JSON text out of the model
 * response) and `mapRow` (how to turn one validated `{ i, ... }` row + its source
 * item into a result). Returns null whenever the payload is not a usable array of
 * exactly `items.length` indexed objects (so the caller can split and retry),
 * and also null when `mapRow` returns null for any row.
 */
export function parseIndexedArray<TItem, TResult>(
  text: string,
  items: TItem[],
  mapRow: (row: Record<string, unknown>, item: TItem, index: number) => TResult | null,
  extractPayload: (text: string) => string,
): TResult[] | null {
  let parsed: unknown;

  if (items.length === 1) {
    // A 1-item batch sometimes comes back as a bare indexed object instead of
    // a singleton array (e.g. `{"i":0,"verdict":"pass",...}`). `extractPayload`
    // slices between the first `[` and last `]` in the text, which for a bare
    // object finds an *inner* array (e.g. `"issues":[...]`) rather than the
    // whole payload — and that inner array can itself be length 1 (a single
    // issue), which would satisfy a naive "is it already a 1-length array?"
    // check and mask the bug. So for the 1-item case, always prefer
    // extracting the outer `{...}` object and wrapping it as a singleton
    // array: this yields the correct row for a bare object AND for a
    // legitimately-wrapped `[{...}]` array, since slicing first-`{` to
    // last-`}` captures the same full row object either way. Multi-item
    // batches keep the strict array-only path below untouched.
    try {
      const objectParsed: unknown = JSON.parse(extractJsonBetween(text, '{', '}'));
      parsed = isRecord(objectParsed) ? [objectParsed] : undefined;
    } catch {
      parsed = undefined;
    }
  }

  if (parsed === undefined) {
    try {
      parsed = JSON.parse(extractPayload(text));
    } catch {
      parsed = undefined;
    }
  }

  if (!Array.isArray(parsed) || parsed.length !== items.length) return null;

  const results = new Array<TResult | undefined>(items.length);
  for (const raw of parsed) {
    if (!isRecord(raw)) return null;
    const idx = raw.i;
    if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= items.length) {
      return null;
    }
    if (results[idx] !== undefined) return null; // duplicate index
    const result = mapRow(raw, items[idx], idx);
    if (result === null) return null;
    results[idx] = result;
  }
  return results.every((r): r is TResult => r !== undefined) ? results : null;
}
