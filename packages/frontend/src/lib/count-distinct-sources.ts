/**
 * Distinct, non-empty, trimmed source texts across `entries`, capped at `cap`.
 * Mirrors the server's own dedup + `MAX_SOURCE_ENTRIES` cap for AI glossary
 * generation (see `glossary-generator.ts`), so a client-side "this run will
 * make N batches" hint matches what the server will actually analyse.
 *
 * Shared by GlossaryTab's whole-project generate-dialog count and the String
 * Table's selection-scoped one, so the cap can't silently drift between them.
 */
export function countDistinctSourceTexts(
  entries: Iterable<{ sourceText: string }>,
  cap = 2000,
): number {
  const seen = new Set<string>();
  for (const entry of entries) {
    const s = entry.sourceText.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    if (seen.size >= cap) break;
  }
  return seen.size;
}
