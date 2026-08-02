export type LegalSlug =
  'terms' | 'privacy' | 'cookies' | 'acceptable-use' | 'subprocessors' | 'security';

const LOCALIZED = new Set(['es']); // languages with translated /legal pages (English is the unprefixed fallback for all others)

export const LEGAL_PAGES: ReadonlyArray<{ slug: LegalSlug; labelKey: string }> = [
  { slug: 'terms', labelKey: 'terms' },
  { slug: 'privacy', labelKey: 'privacy' },
  { slug: 'cookies', labelKey: 'cookies' },
  { slug: 'acceptable-use', labelKey: 'acceptableUse' },
  { slug: 'subprocessors', labelKey: 'subprocessors' },
  { slug: 'security', labelKey: 'security' },
];

/** Locale-aware public policy URL. English is the unprefixed canonical; es/fr are
 *  prefixed; any other language (incl. a future one without translated pages)
 *  falls back to English. */
export function buildLegalUrl(slug: LegalSlug, lang: string): string {
  const base = (lang || 'en').toLowerCase().split('-')[0];
  return LOCALIZED.has(base) ? `/legal/${base}/${slug}` : `/legal/${slug}`;
}
