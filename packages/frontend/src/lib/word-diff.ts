/**
 * Word-level diff between two strings for the review workflow.
 *
 * Tokenization uses Intl.Segmenter with word granularity (which also yields
 * whitespace/punctuation segments, so the full string is preserved), falling
 * back to grapheme segmentation and finally to code points — plain whitespace
 * splitting would break CJK/Thai text that has no word separators.
 */

export interface DiffSegment {
  type: 'equal' | 'added' | 'removed';
  text: string;
}

/** Guard against quadratic blow-up on pathologically long strings. */
const MAX_LCS_CELLS = 1_000_000;

function trySegment(text: string, granularity: 'word' | 'grapheme'): string[] | null {
  try {
    if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return null;
    const segmenter = new Intl.Segmenter(undefined, { granularity });
    return Array.from(segmenter.segment(text), (s) => s.segment);
  } catch {
    return null;
  }
}

/** Splits text into diffable tokens whose concatenation equals the input. */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return trySegment(text, 'word') ?? trySegment(text, 'grapheme') ?? Array.from(text);
}

function pushSegment(out: DiffSegment[], type: DiffSegment['type'], text: string): void {
  if (!text) return;
  const last = out.at(-1);
  if (last && last.type === type) {
    last.text += text;
  } else {
    out.push({ type, text });
  }
}

/**
 * Computes a word-level diff from `oldText` to `newText`.
 * Returns merged segments in display order; adjacent segments of the same
 * type are coalesced.
 */
export function diffWords(oldText: string, newText: string): DiffSegment[] {
  if (oldText === newText) {
    return oldText ? [{ type: 'equal', text: oldText }] : [];
  }

  const a = tokenize(oldText);
  const b = tokenize(newText);
  const out: DiffSegment[] = [];

  // Trim the common prefix/suffix first — cheap and shrinks the LCS table.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  pushSegment(out, 'equal', a.slice(0, start).join(''));

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);

  if (midA.length * midB.length > MAX_LCS_CELLS) {
    // Too large for an exact diff: degrade to a wholesale replacement.
    pushSegment(out, 'removed', midA.join(''));
    pushSegment(out, 'added', midB.join(''));
  } else {
    appendLcsDiff(out, midA, midB);
  }

  pushSegment(out, 'equal', a.slice(endA).join(''));
  return out;
}

/** Standard LCS dynamic program + backtrack, appending merged segments. */
function appendLcsDiff(out: DiffSegment[], a: string[], b: string[]): void {
  const n = a.length;
  const m = b.length;
  if (n === 0 && m === 0) return;
  if (n === 0) {
    pushSegment(out, 'added', b.join(''));
    return;
  }
  if (m === 0) {
    pushSegment(out, 'removed', a.join(''));
    return;
  }

  // lcs[i][j] = LCS length of a[i..] and b[j..]
  const width = m + 1;
  const lcs = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * width + j] =
        a[i] === b[j]
          ? lcs[(i + 1) * width + j + 1] + 1
          : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
    }
  }

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pushSegment(out, 'equal', a[i]);
      i++;
      j++;
    } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
      pushSegment(out, 'removed', a[i]);
      i++;
    } else {
      pushSegment(out, 'added', b[j]);
      j++;
    }
  }
  if (i < n) pushSegment(out, 'removed', a.slice(i).join(''));
  if (j < m) pushSegment(out, 'added', b.slice(j).join(''));
}
