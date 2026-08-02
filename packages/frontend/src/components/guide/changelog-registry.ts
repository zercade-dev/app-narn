/**
 * Lazy index of the per-version changelog entries under guides/en/changelog/.
 * The glob is deliberately NOT eager: each version file becomes its own
 * code-split chunk, fetched only when ChangelogView scrolls to it. Adding a
 * release is just dropping in a new v<X.Y.Z>.md file — no registration step.
 */
type Loader = () => Promise<string>;

const files = import.meta.glob('../../guides/en/changelog/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, Loader>;

export type ChangelogVersion = { version: string; load: Loader };

/** Parses [major, minor, patch] out of a glob key like '…/v1.4.9.md'. */
export function parseVersionKey(key: string): [number, number, number] | null {
  const m = /\/v(\d+)\.(\d+)\.(\d+)\.md$/.exec(key);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Builds the version list, newest first; non-version filenames are ignored. */
export function buildChangelogIndex(input: Record<string, Loader>): ChangelogVersion[] {
  return Object.entries(input)
    .flatMap(([key, load]) => {
      const parsed = parseVersionKey(key);
      return parsed ? [{ parsed, load }] : [];
    })
    .sort(
      (a, b) => b.parsed[0] - a.parsed[0] || b.parsed[1] - a.parsed[1] || b.parsed[2] - a.parsed[2],
    )
    .map(({ parsed, load }) => ({ version: `v${parsed.join('.')}`, load }));
}

export const CHANGELOG_VERSIONS = buildChangelogIndex(files);
