export type LegalSlug =
  'terms' | 'privacy' | 'cookies' | 'acceptable-use' | 'subprocessors' | 'security';

/**
 * Locale codes that have translated public policy pages. Today this is `es`
 * alone — no other locale has hosted policy pages yet. This set must be kept
 * in EXACT sync with the locales that actually have hosted pages: shipping a
 * translated policy set means adding both the hosted pages and this locale's
 * code here, in the same change, or `buildLegalUrl` will link users to pages
 * that don't exist (if added here first) or silently withhold pages that do
 * exist (if added there first). Exported so a cross-repo test can hold this
 * set to the on-disk truth.
 */
export const LOCALIZED = new Set(['es']);

export const LEGAL_PAGES: ReadonlyArray<{ slug: LegalSlug; labelKey: string }> = [
  { slug: 'terms', labelKey: 'terms' },
  { slug: 'privacy', labelKey: 'privacy' },
  { slug: 'cookies', labelKey: 'cookies' },
  { slug: 'acceptable-use', labelKey: 'acceptableUse' },
  { slug: 'subprocessors', labelKey: 'subprocessors' },
  { slug: 'security', labelKey: 'security' },
];

/**
 * Locale-aware public policy URL. English is the unprefixed canonical, used
 * for any locale not in {@link LOCALIZED} (today that's everything but `es`).
 * A compound UI locale (`pt-br`, `zh-Hans-CN`, `es-419`) is matched
 * most-specific-first: the full lowercased tag, then each trailing subtag
 * dropped in turn, before falling back to English — mirroring
 * `resolveDisplayLocale`'s resolution order for source-origin labels, so a
 * region- or script-tagged locale still finds a base-language match instead
 * of silently missing it.
 */
export function buildLegalUrl(slug: LegalSlug, lang: string): string {
  const subtags = (lang || 'en').toLowerCase().split('-');
  for (let count = subtags.length; count > 0; count--) {
    const candidate = subtags.slice(0, count).join('-');
    if (LOCALIZED.has(candidate)) return `/legal/${candidate}/${slug}`;
  }
  return `/legal/${slug}`;
}
