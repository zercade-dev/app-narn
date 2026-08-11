/**
 * Converts a project name to a filesystem-safe slug.
 * Lowercase, alphanumeric and hyphens only.
 */
export function slugify(name: string): string {
  const collapsed = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-');

  // Trim the leading/trailing hyphens by index rather than with `/^-+|-+$/`.
  // The trailing half of that pattern costs O(n²) on a name that is mostly
  // hyphens: the engine retries `-+$` from every position, each attempt walking
  // to the end. `name` is unvalidated caller input, so the input length is not
  // ours to assume. Scanning in from both ends is linear and yields the same
  // slug.
  let start = 0;
  let end = collapsed.length;
  while (start < end && collapsed[start] === '-') start += 1;
  while (end > start && collapsed[end - 1] === '-') end -= 1;

  return collapsed.slice(start, end).slice(0, 64);
}
