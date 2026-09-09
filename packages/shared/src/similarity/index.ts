/**
 * Local (no external service) word-similarity pre-sort.
 *
 * Groups textually-similar source terms so they land adjacent in the entry
 * order — and therefore tend to share a review/translation batch. Everything
 * here is pure and deterministic: no `Math.random`, no `Date.now`, no I/O.
 *
 * The similarity metric is a Jaccard index over token *sets*, weighted so that
 * rare tokens (shared by few entries) count for more than ubiquitous ones.
 * Ordering is a greedy nearest-neighbour chain seeded deterministically.
 *
 * Scaling: a naive all-pairs nearest-neighbour search is O(n²). To keep large
 * inputs reasonable we restrict each entry's candidate neighbours to the other
 * entries that share at least one of its tokens (an inverted index), and cap
 * how many candidates we score per step (`MAX_CANDIDATES_PER_STEP`) as well as
 * how many index entries we examine to find them (`MAX_SCANNED_PER_STEP`). This
 * is an approximation: when an entry's rarest tokens are shared by a very large
 * bucket, some genuine neighbours may be missed — acceptable for a pre-sort.
 */

/**
 * Placeholder / markup patterns stripped before tokenizing so they don't dominate similarity.
 *
 * Each bracketed body excludes its OWN opening delimiter as well as the closing
 * one (`[^{}]` rather than `[^}]`). That keeps the scan linear: on input with
 * many unterminated openers — `{{{{{…` — a body that allowed the opener would
 * rescan the whole tail from every one of them. Excluding it makes each attempt
 * stop at the next opener instead. Well-formed placeholders don't nest, so
 * nothing that matched before stops matching.
 */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\{[^{}]*\}/g, // {0}, {name}, {0:N2}
  /<[^<>]*>/g, // <color=...>, </color>, <b>
  /\[[^[\]]*\]/g, // [HP], [sprite index=3]
  /%[0-9]*\$?[sd]/g, // printf-style %s, %1$d
  /\\[nrt]/g, // escaped newlines/tabs in raw source
];

/** Cap on candidate neighbours scored per chaining step (bounds the O(n²) search). */
const MAX_CANDIDATES_PER_STEP = 256;

/**
 * Cap on bucket entries *examined* per chaining step, accepted or not.
 *
 * {@link MAX_CANDIDATES_PER_STEP} bounds how many unvisited neighbours are
 * collected, which is not the same as bounding the work: an already-visited
 * index is skipped without counting toward it. Late in the greedy chain almost
 * every bucket entry is already visited, so a step falls through its rare
 * tokens and scans a ubiquitous token's whole posting list — Σ df(t), with no
 * early exit — to find almost nothing. With a token whose document frequency
 * approaches n that degenerates to the O(n²) this index exists to avoid, in one
 * synchronous loop on the only process the deployment has.
 *
 * A step that reaches its candidate cap within this budget behaves exactly as
 * before, so ordinary inputs are unaffected. Only a step that scans this far
 * without filling its candidate set stops early — precisely the case where the
 * remaining postings are overwhelmingly visited and yield nothing anyway.
 */
const MAX_SCANNED_PER_STEP = MAX_CANDIDATES_PER_STEP * 8;

/**
 * Tokenize source text into a lowercase word list.
 *
 * Placeholders/markup are removed first, then the remainder is split on any
 * non-word character. Empty fragments are dropped. Order is preserved but
 * downstream similarity uses the token *set*, so duplicates are harmless.
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  let cleaned = text;
  for (const pattern of PLACEHOLDER_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ');
  }
  return cleaned
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0);
}

interface Prepared {
  id: string;
  /** Distinct token list for this entry. */
  tokens: string[];
  /** Same tokens as a Set for O(1) membership during scoring. */
  tokenSet: Set<string>;
}

/**
 * Weighted Jaccard similarity over two token sets in [0, 1].
 *
 * Standard Jaccard is |A∩B| / |A∪B|. We weight each token by an inverse-
 * frequency weight (rarer tokens contribute more), so two strings that share a
 * rare term are considered more similar than two that share only common words.
 * Returns 0 when either set is empty.
 */
function weightedJaccard(a: Prepared, b: Prepared, weight: Map<string, number>): number {
  if (a.tokenSet.size === 0 || b.tokenSet.size === 0) return 0;
  // Iterate the smaller set for the intersection.
  const [small, large] = a.tokenSet.size <= b.tokenSet.size ? [a, b] : [b, a];
  let interWeight = 0;
  for (const tok of small.tokenSet) {
    if (large.tokenSet.has(tok)) interWeight += weight.get(tok) ?? 0;
  }
  if (interWeight === 0) return 0;
  let unionWeight = 0;
  for (const tok of a.tokenSet) unionWeight += weight.get(tok) ?? 0;
  for (const tok of b.tokenSet) {
    if (!a.tokenSet.has(tok)) unionWeight += weight.get(tok) ?? 0;
  }
  return unionWeight === 0 ? 0 : interWeight / unionWeight;
}

/**
 * Compute an order over the given entries where textually-similar entries are
 * adjacent. Returns the entry ids; every input id appears exactly once.
 *
 * Algorithm:
 *  1. Tokenize each entry and build an inverted index (token → entry indices)
 *     and inverse-frequency token weights.
 *  2. Pick a deterministic seed: the entry with the most tokens, breaking ties
 *     by ascending id (total + stable).
 *  3. Greedily chain: from the current entry, pick the unvisited candidate with
 *     the highest weighted-Jaccard similarity. Candidates are limited to
 *     entries sharing a token (via the inverted index), preferring rarer
 *     tokens' buckets, and capped at MAX_CANDIDATES_PER_STEP.
 *  4. If no token-sharing candidate remains (disconnected component), jump to
 *     the next unvisited entry in (token-count desc, id asc) order.
 *
 * Determinism: all tie-breaks fall back to ascending id; no randomness or time.
 */
export function computeSimilarityOrder(
  entries: ReadonlyArray<{ id: string; sourceText: string }>,
): string[] {
  const n = entries.length;
  if (n === 0) return [];
  if (n === 1) return [entries[0].id];

  const prepared: Prepared[] = entries.map((e) => {
    const tokenSet = new Set(tokenize(e.sourceText));
    return { id: e.id, tokens: [...tokenSet], tokenSet };
  });

  // Inverted index: token -> list of entry indices that contain it.
  const invIndex = new Map<string, number[]>();
  const docFreq = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    for (const tok of prepared[i].tokens) {
      let bucket = invIndex.get(tok);
      if (!bucket) {
        bucket = [];
        invIndex.set(tok, bucket);
      }
      bucket.push(i);
      docFreq.set(tok, (docFreq.get(tok) ?? 0) + 1);
    }
  }

  // Inverse-frequency weight: ln(1 + n/df). Rarer tokens (low df) weigh more.
  const weight = new Map<string, number>();
  for (const [tok, df] of docFreq) {
    weight.set(tok, Math.log(1 + n / df));
  }

  // Deterministic ordering of entries for seeding and disconnected jumps:
  // more tokens first, then ascending id.
  const byPreference = [...prepared.keys()].sort((ia, ib) => {
    const ta = prepared[ia].tokens.length;
    const tb = prepared[ib].tokens.length;
    if (ta !== tb) return tb - ta;
    return prepared[ia].id < prepared[ib].id ? -1 : prepared[ia].id > prepared[ib].id ? 1 : 0;
  });

  const visited = new Array<boolean>(n).fill(false);
  const order: string[] = [];
  let prefCursor = 0;

  const nextSeed = (): number => {
    while (prefCursor < n && visited[byPreference[prefCursor]]) prefCursor++;
    return prefCursor < n ? byPreference[prefCursor] : -1;
  };

  // Gather candidate neighbour indices for `current` from shared-token buckets,
  // visiting rarer tokens' buckets first and capping the total scanned.
  const gatherCandidates = (current: number): number[] => {
    const tokens = prepared[current].tokens;
    // Rarer tokens (smaller bucket) first — they carry the strongest signal and
    // keep the candidate set small.
    const sortedTokens = [...tokens].sort((a, b) => (docFreq.get(a) ?? 0) - (docFreq.get(b) ?? 0));
    const seen = new Set<number>();
    // Counts every element looked at, including the ones skipped below — see
    // MAX_SCANNED_PER_STEP for why the candidate cap alone does not bound this.
    let scanned = 0;
    for (const tok of sortedTokens) {
      const bucket = invIndex.get(tok);
      if (!bucket) continue;
      for (const idx of bucket) {
        if (++scanned > MAX_SCANNED_PER_STEP) return [...seen];
        if (idx === current || visited[idx]) continue;
        seen.add(idx);
        if (seen.size >= MAX_CANDIDATES_PER_STEP) return [...seen];
      }
    }
    return [...seen];
  };

  let current = nextSeed();
  while (current !== -1) {
    visited[current] = true;
    order.push(prepared[current].id);

    const candidates = gatherCandidates(current);
    let best = -1;
    let bestScore = -1;
    for (const idx of candidates) {
      const score = weightedJaccard(prepared[current], prepared[idx], weight);
      if (
        score > bestScore ||
        // Tie-break deterministically by ascending id so output is stable.
        (score === bestScore && best !== -1 && prepared[idx].id < prepared[best].id)
      ) {
        best = idx;
        bestScore = score;
      }
    }

    if (best !== -1 && bestScore > 0) {
      current = best;
    } else {
      current = nextSeed();
    }
  }

  return order;
}
