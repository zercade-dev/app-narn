/**
 * Pure parser that turns one changelog entry's raw markdown body into its
 * structural pieces: the release date (from the dated header), a one-line
 * highlight, and the remaining detail markdown (bullets) fed to
 * `renderMarkdown`. No DOM/React — safe to unit test directly.
 *
 * Mirrors ChangelogView's `ENTRY_HEADER_RE` for the dated
 * `## vX.Y.Z — DATE` header; a missing/undated header (legacy `# vX.Y.Z`)
 * still parses, with `date: null`.
 */

const DATED_HEADER_RE = /^##\s+\S+\s+—\s+(.+?)\s*\n+/;
const UNDATED_HEADER_RE = /^#{1,6}\s+[^\n]*\n+/;
const LIST_ITEM_RE = /^\s*[-*+]\s+/;

export type SplitEntry = { date: string | null; highlight: string; detailsMd: string };

/**
 * Splits a changelog entry's markdown into `{ date, highlight, detailsMd }`.
 *
 * After the header: if the body starts with a non-list paragraph block, that
 * block's text is the highlight and the rest is `detailsMd`. If it starts
 * directly with a list (legacy, un-backfilled), the highlight falls back to
 * the first list item's text and `detailsMd` is the remaining items (`''` if
 * there's only one).
 */
export function splitEntry(md: string): SplitEntry {
  let date: string | null = null;
  let body = md;

  const datedMatch = DATED_HEADER_RE.exec(md);
  if (datedMatch) {
    date = datedMatch[1];
    body = md.slice(datedMatch[0].length);
  } else {
    const undatedMatch = UNDATED_HEADER_RE.exec(md);
    if (undatedMatch) body = md.slice(undatedMatch[0].length);
  }

  const lines = body.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i >= lines.length) return { date, highlight: '', detailsMd: '' };

  if (LIST_ITEM_RE.test(lines[i])) {
    const highlight = lines[i].replace(LIST_ITEM_RE, '').trim();
    const detailsMd = lines
      .slice(i + 1)
      .join('\n')
      .trim();
    return { date, highlight, detailsMd };
  }

  const paragraphLines: string[] = [];
  while (i < lines.length && lines[i].trim() !== '' && !LIST_ITEM_RE.test(lines[i])) {
    paragraphLines.push(lines[i].trim());
    i++;
  }
  const highlight = paragraphLines.join(' ').trim();
  const detailsMd = lines.slice(i).join('\n').trim();
  return { date, highlight, detailsMd };
}
