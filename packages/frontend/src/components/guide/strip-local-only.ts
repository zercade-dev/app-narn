/**
 * Removes `<!-- local-only --> … <!-- /local-only -->` fenced blocks from a
 * guide Markdown string, used to hide self-hosted-only sections when
 * rendering the Guide in cloud mode (`cloudManaged`).
 *
 * - Fence markers and everything between them (inclusive) are removed.
 * - Any 3+ run of newlines left behind by the removal is collapsed to a
 *   single blank line (`\n\n`) so no dangling gap remains.
 * - Markdown with no fences is returned unchanged (referentially, when no
 *   fence is present, the same string content is returned).
 * - Idempotent: running it again on its own output is a no-op.
 */
export function stripLocalOnly(md: string): string {
  const fenceRe = /<!--\s*local-only\s*-->[\s\S]*?<!--\s*\/local-only\s*-->/g;
  if (!fenceRe.test(md)) return md;
  const stripped = md.replace(fenceRe, '');
  return stripped.replace(/\n{3,}/g, '\n\n');
}
