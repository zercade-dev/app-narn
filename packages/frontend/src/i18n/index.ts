import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// English is the reference locale, loaded statically. Eagerly globbing the
// namespace files (instead of a hand-maintained import list) keeps the static
// English chunk while guaranteeing every `en/<ns>.json` on disk is registered —
// adding a namespace file no longer requires touching this file. The eager glob
// inlines the JSON at build time, so no dynamic-import chunk is emitted.
const enModules = import.meta.glob('../locales/en/*.json', { eager: true }) as Record<
  string,
  { default: Record<string, unknown> }
>;

const enResources: Record<string, Record<string, unknown>> = {};
for (const [path, mod] of Object.entries(enModules)) {
  const ns = path.slice(path.lastIndexOf('/') + 1).replace('.json', '');
  enResources[ns] = mod.default;
}

void i18n.use(initReactI18next).init({
  resources: {
    en: enResources,
  },
  lng: 'en',
  fallbackLng: 'en',
  // `escapeValue: false` disables i18next's own HTML-escaping of interpolated
  // values. This is SAFE here only because React already escapes every JSX text
  // child (translated strings render as `{t('key')}`), and no translated string
  // is ever passed to a raw-HTML sink such as `dangerouslySetInnerHTML`. If a
  // translated string is ever rendered as raw HTML, re-enable escaping
  // (`escapeValue: true`) — or escape at that sink — to avoid XSS.
  interpolation: { escapeValue: false },
});

// Keep the document's language in step with the UI language.
//
// `index.html` ships a static `lang="en"`, and until this hook existed nothing
// ever updated it — so every non-English UI claimed to be English. That is not
// cosmetic: CSS `text-transform: uppercase` is language-sensitive *only* via
// `lang`, and the app uppercases labels in several places (run detail headings,
// guide group headings, AI-review column headings). With `lang="en"` the
// browser applies default Unicode casing, so Turkish dotted "i" uppercases to
// "I" instead of "İ" — "Çeviri" renders as "ÇEVIRI", which is misspelt in
// Turkish. Twelve shipped Turkish labels were affected, and no guard can see it
// because the JSON is correct; only the rendering is wrong.
//
// Screen-reader pronunciation, hyphenation, spell-check and font fallback all
// key off the same attribute, so this is a correctness fix for every locale,
// not only for the ones with locale-specific casing rules.
//
// `languageChanged` fires on `changeLanguage()`, including the initial call, and
// `resolvedLanguage` is used rather than the requested code so a fallback is
// reflected honestly.
function syncDocumentLanguage() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = i18n.resolvedLanguage ?? 'en';
}

i18n.on('languageChanged', syncDocumentLanguage);

// `init()` above emits `languageChanged` synchronously, before this listener
// exists, so the initial value is set here rather than relied on from the event.
// The markup already says `en` and the initial language is `en`, so this is
// currently a no-op — it is written so the invariant holds by construction
// instead of by that coincidence.
syncDocumentLanguage();

const loadedLocales = new Set<string>(['en']);

// In-flight loads, keyed by locale, so concurrent callers share one fetch
// instead of each re-importing every chunk. Cleared on failure so a later call
// can retry; on success the locale moves into `loadedLocales`.
const pendingLocales = new Map<string, Promise<void>>();

// Glob map for every non-English locale file; Vite splits each into its own
// chunk so only the requested language's files are fetched over the network.
// English files are statically imported above; the negation pattern excludes
// them from the dynamic glob to avoid "ineffective dynamic import" warnings.
const localeModules = import.meta.glob(['../locales/**/*.json', '!../locales/en/**']);

/** Dynamically loads all resource bundles for a locale when first needed. */
export function loadLocale(lang: string): Promise<void> {
  if (loadedLocales.has(lang)) return Promise.resolve();
  // Coalesce concurrent callers onto one in-flight load.
  const inFlight = pendingLocales.get(lang);
  if (inFlight) return inFlight;

  const prefix = `../locales/${lang}/`;
  const entries = Object.entries(localeModules).filter(([path]) => path.startsWith(prefix));

  const load = Promise.all(
    entries.map(async ([path, loadChunk]) => {
      const ns = path.slice(prefix.length).replace('.json', '');
      const mod = (await loadChunk()) as { default: Record<string, unknown> };
      i18n.addResourceBundle(lang, ns, mod.default, true, true);
    }),
  )
    .then(() => {
      // Mark loaded only after every chunk import resolves.
      loadedLocales.add(lang);
    })
    .finally(() => {
      // Drop the in-flight entry either way: on success `loadedLocales` now
      // short-circuits; on failure (offline, chunk-load error) the locale stays
      // absent so the next call retries instead of being stuck on English.
      pendingLocales.delete(lang);
    });

  pendingLocales.set(lang, load);
  return load;
}

export default i18n;
