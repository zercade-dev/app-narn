/**
 * Locale parity and integrity rules — pure, framework-free, no assertions.
 *
 * Two callers share this one implementation:
 *
 *   - `scripts/check-locales.mjs`, which `pnpm check:locales` runs and CI gates
 *     on. This is where locale changes are actually raised, so this is where the
 *     check has to be able to fail.
 *   - the i18n guards in the workspace that consumes this one, which keep their
 *     own `describe`/`it` structure but import the rules from here.
 *
 * One implementation, two callers, so neither can bless what the other rejects
 * and a rule fixed once is fixed for both. That is also why nothing here throws
 * an assertion or imports a runner: this workspace ships no test runner, and a
 * rule that could only run under one would be back to two implementations.
 *
 * Everything below is a rule that was argued over. The comments carry the
 * reasoning — in particular why `zero` is legal in every language, why
 * `keySetDiff` lets a locale add a plural family over an English plain key but
 * not the reverse, why there is deliberately no tolerance hook, and why the
 * do-not-translate word boundary tolerates a trailing `s`. Read them before
 * changing a threshold.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** English is the reference locale (statically loaded in src/i18n/index.ts). */
export const REFERENCE_LOCALE = 'en';

/**
 * NOTHING HERE RESOLVES ITS OWN LOCATION. `localesDir` is a required argument;
 * each caller resolves the directory in whatever way is correct for it and
 * passes it in.
 *
 * One trap is worth writing down before someone adds a self-locating default.
 * `import.meta.url` itself is FINE — it is a real `file:` URL under every
 * caller, including the one that loads this module through a bundler's module
 * runner, and `fileURLToPath(import.meta.url)` works. What is not fine is
 * `new URL(relative, import.meta.url)`: one caller runs in a jsdom environment,
 * whose `URL` global is jsdom's class rather than node:url's, and
 * `fileURLToPath()` rejects a jsdom URL instance with ERR_INVALID_URL_SCHEME
 * ("The URL must be of scheme file") even though the string it was built from
 * is a perfectly good file: URL. Probed directly, not inferred. Taking the
 * directory as an argument sidesteps the question entirely.
 */

/**
 * Every locale on disk: locale -> namespace -> parsed JSON.
 *
 * Derived from what is actually on disk, NOT a hardcoded list. A hardcoded list
 * would have to be edited in lockstep by everyone who adds a locale directory,
 * and the failure mode of forgetting is a locale that is silently never checked.
 *
 * Entries are inserted in sorted order so two runs report findings in the same
 * sequence; readdirSync's own order is filesystem-dependent.
 */
export function loadLocales(localesDir) {
  const locales = new Map();
  const localeDirs = readdirSync(localesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const locale of localeDirs) {
    const namespaces = new Map();
    const files = readdirSync(join(localesDir, locale))
      .filter((name) => name.endsWith('.json'))
      .sort();
    for (const file of files) {
      const namespace = file.slice(0, -'.json'.length);
      // Key ORDER matters — the key-order rule below compares it against
      // English — and JSON.parse preserves the source order of string keys.
      namespaces.set(namespace, JSON.parse(readFileSync(join(localesDir, locale, file), 'utf8')));
    }
    locales.set(locale, namespaces);
  }
  return locales;
}

/** Recursively collects leaf entries as [keyPath, value] pairs. */
export function flattenEntries(obj, prefix = '') {
  const entries = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      entries.push(...flattenEntries(value, path));
    } else {
      entries.push([path, value]);
    }
  }
  return entries;
}

/** Recursively flattens nested objects into dot-separated leaf key paths. */
export function flattenKeys(obj) {
  return flattenEntries(obj).map(([key]) => key);
}

/**
 * The CLDR plural categories — the universe of legal i18next v4 JSON plural
 * suffixes. WHICH subset a given language actually uses comes from
 * Intl.PluralRules, never from this list.
 */
export const CLDR_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];

/**
 * The legacy i18next v3 plural suffix. The app runs the v4 JSON format (no
 * `compatibilityJSON` is set in src/i18n/index.ts), under which `key_plural`
 * is never looked up at all: for a `count`, i18next tries `key_<category>`
 * and then the bare `key`. Three keys still use it — config:glossariesSkipped,
 * config:malformedRows, config:exportRoundtripWarning — so their bare
 * (singular) form renders for every count. That is a pre-existing content
 * defect and out of scope for these rules; the suffix is recognised here so
 * the plural rules neither crash on it nor silently bless it, and the
 * legacy `_plural` report names it.
 */
export const LEGACY_PLURAL_SUFFIX = 'plural';

export const PLURAL_SUFFIXES = new Set([...CLDR_CATEGORIES, LEGACY_PLURAL_SUFFIX]);

/**
 * Splits a flattened key into its plural base and suffix when the final
 * `_<segment>` is a plural suffix, else null. Any dot-separated path prefix
 * stays on the base: `bulk.removeCategoryApply_one` -> base
 * `bulk.removeCategoryApply`, suffix `one`.
 */
export function splitPluralKey(key) {
  const at = key.lastIndexOf('_');
  if (at <= 0) return null;
  const suffix = key.slice(at + 1);
  if (!PLURAL_SUFFIXES.has(suffix)) return null;
  const base = key.slice(0, at);
  // Guard against a leading-underscore segment (`a.b._one`), which would leave
  // an empty final segment as the "base".
  if (base.endsWith('.')) return null;
  return { base, suffix };
}

// ---------------------------------------------------------------------------
// Key parity
// ---------------------------------------------------------------------------

/**
 * `LOCALE_PARITY_STRICT` promotes EVERY plural-coverage gap in a locale to a
 * hard failure, including the ones the default severity forgives — families a
 * bare `key` sibling rescues, and the grandfathered es/fr `many`. It is the
 * tool for a backfill holding its own locale to the language's complete
 * category set; it is not what makes a genuinely missing category fail, which
 * is now the default (see enforcedCoverageGapFamilies). Set it to `1`, `true`
 * or `all` for every locale, or to a comma-separated locale list
 * (`LOCALE_PARITY_STRICT=ru,pt-br`) to hold just the locale being backfilled
 * to its language's full category set.
 */
export const STRICT_ENV = process.env.LOCALE_PARITY_STRICT?.trim() ?? '';

export function isStrictFor(locale, strictEnv = STRICT_ENV) {
  const value = strictEnv.trim();
  if (!value) return false;
  if (/^(1|true|all)$/i.test(value)) return true;
  return value.split(',').some((entry) => entry.trim() === locale);
}

/**
 * `zero` is legal in EVERY locale regardless of its CLDR categories. i18next
 * appends an explicit `key_zero` lookup whenever count === 0, independent of
 * the language's plural rules (Translator.resolve pushes the zero suffix last
 * and pops finalKeys from the end, so it wins). Verified against the installed
 * i18next 26: en's categories are ["one","other"], yet
 * strings:bulk.removeCategoryApply_zero does resolve at count 0.
 */
export const ALWAYS_LEGAL_SUFFIX = 'zero';

/**
 * Locale directory name -> BCP-47 tag for Intl.PluralRules. Directory names
 * are lowercase; BCP-47 script and region subtags are not. Node's Intl happens
 * to accept the lowercase spellings, but that is not something to lean on, so
 * the non-trivial tags are mapped explicitly. (CLDR plural rules are
 * language-level, so `pt-BR` resolves to `pt` and `zh-Hans` to `zh` — the map
 * is about the tag being valid, not about changing the answer.)
 */
export const BCP47_TAGS = {
  'pt-br': 'pt-BR',
  'zh-hans': 'zh-Hans',
  'zh-hant': 'zh-Hant',
};

/**
 * Partitions flattened keys into plain keys and plural families:
 * `{ plain: Set<key>, plurals: Map<base, Set<suffix>> }`. Plain keys are
 * compared exactly across locales; plural families are compared by base.
 */
export function classifyKeys(keys) {
  const plain = new Set();
  const plurals = new Map();
  for (const key of keys) {
    const split = splitPluralKey(key);
    if (!split) {
      plain.add(key);
      continue;
    }
    let suffixes = plurals.get(split.base);
    if (!suffixes) {
      suffixes = new Set();
      plurals.set(split.base, suffixes);
    }
    suffixes.add(split.suffix);
  }
  return { plain, plurals };
}

/**
 * Diffs one locale namespace against the reference, plural-aware.
 *
 * Plain keys must match exactly. Plural families are compared by BASE key
 * only, because the correct SUFFIXES differ per language — that is the whole
 * point of this rule's shape. Plural categories are per-language CLDR data,
 * not a constant: `en` has ["one","other"], `ru` has ["one","few","many",
 * "other"], `ja` has ["other"] alone. Demanding an exact key-set match against
 * English would make correct Russian impossible (it needs the `_few`/`_many`
 * forms English never has) and would force meaningless `_one` keys into
 * Japanese.
 *
 * One asymmetry is deliberate: a locale may ADD a plural family for a base the
 * reference carries as a plain key. English writes "{{count}} rows processed"
 * as a single string, but Russian needs four forms for it, and ~70 English
 * keys interpolate `{{count}}` with no plural family at all. The locale must
 * KEEP the plain key when it does so, since call sites that pass no `count`
 * resolve the bare key only. The reverse is not allowed: a base the reference
 * pluralises must stay a plural family everywhere.
 *
 * That reverse case is worth spelling out, because 29 of the 41 English plural
 * families have no bare sibling and a translator will hit it: adding a bare
 * `b` where the reference has only `b_one`/`b_other` is reported as `extra`.
 * i18next would resolve such a key (the bare form is its last fallback), so
 * the rejection is a style rule, not a correctness one — the fix for a
 * category you cannot express is `_other`, which every language has, not a
 * bare key that silently bypasses plural selection everywhere.
 *
 * THERE IS NO TOLERANCE HOOK, deliberately. This function used to take an
 * `isTolerated` predicate fed by a KNOWN_GAPS allowlist; both are gone now that
 * es and fr are complete. The allowlist sat stale for months with 14 of its 25
 * entries naming keys that had long since been translated, so it hid nothing
 * useful and quietly widened. Every locale is now diffed in full, and a gap is
 * a failure — if a translation is genuinely pending, the fix is to translate the
 * key (see the translating-ui-strings skill), not to re-add a suppression seam.
 */
export function keySetDiff(reference, actual) {
  const missing = [
    ...[...reference.plain].filter((k) => !actual.plain.has(k)),
    ...[...reference.plurals.keys()].filter((b) => !actual.plurals.has(b)).map((b) => `${b}_*`),
  ].sort();

  const extra = [
    ...[...actual.plain].filter((k) => !reference.plain.has(k)),
    ...[...actual.plurals.keys()]
      .filter((b) => {
        if (reference.plurals.has(b)) return false;
        if (reference.plain.has(b) && actual.plain.has(b)) return false; // added family, see above
        return true;
      })
      .map((b) => `${b}_*`),
  ].sort();

  return { missing, extra };
}

const categoryCache = new Map();

/**
 * The CLDR plural categories of a locale directory.
 *
 * Intl.PluralRules does NOT throw on an unknown language subtag — it silently
 * falls back to the runtime default, so `new Intl.PluralRules('zz-probe')`
 * happily reports English's ["one","other"]. Comparing the resolved language
 * subtag against the requested one turns that silent wrong answer into a loud
 * failure, which is what catches a typo'd or unmapped locale directory.
 */
export function pluralCategoriesFor(locale) {
  const cached = categoryCache.get(locale);
  if (cached) return cached;

  const tag = BCP47_TAGS[locale] ?? locale;
  let resolved;
  try {
    resolved = new Intl.PluralRules(tag).resolvedOptions();
  } catch (error) {
    throw new Error(
      `Locale "${locale}" is not a usable BCP-47 tag for Intl.PluralRules (tried "${tag}"): ` +
        `${String(error)}. Add an entry to BCP47_TAGS.`,
    );
  }

  const wanted = tag.split('-')[0].toLowerCase();
  const got = resolved.locale.split('-')[0].toLowerCase();
  if (wanted !== got) {
    throw new Error(
      `Locale "${locale}" (tag "${tag}") is unknown to Intl.PluralRules — it silently resolved to ` +
        `"${resolved.locale}", whose plural categories would be wrong for it. Add a correct entry ` +
        `to BCP47_TAGS.`,
    );
  }

  const categories = new Set(resolved.pluralCategories);
  categoryCache.set(locale, categories);
  return categories;
}

/**
 * The ENFORCED plural rules for one family, as failure messages:
 *
 *  - Every suffix supplied must be a plural category the language actually
 *    has. This is what catches a translator copying English's `_one` into
 *    Japanese (categories ["other"]), where the key is dead weight that can
 *    never resolve. `zero` is exempt (see ALWAYS_LEGAL_SUFFIX) and the legacy
 *    `plural` is reported rather than failed (see LEGACY_PLURAL_SUFFIX).
 *  - Every family must supply `other`. It is the one category every language
 *    has, so a family without it is guaranteed to have counts it cannot render
 *    in this language.
 *
 * The legacy `_plural`-only carve-out that used to sit on the second rule is
 * GONE. It exempted exactly three pre-existing v3 keys from the mandatory
 * `_other`; all three have since been converted, so the carve-out had no
 * subjects left and its only remaining effect would have been to let a NEW
 * `_plural`-only family through with a report instead of a failure. `_plural`
 * is never looked up under the v4 JSON format, so such a family renders
 * nothing of its own for any count — exactly what this rule exists to stop.
 */
export function pluralFamilyErrors(base, suffixes, categories) {
  const errors = [];
  const supplied = [...suffixes].sort();

  for (const suffix of supplied) {
    if (suffix === LEGACY_PLURAL_SUFFIX || suffix === ALWAYS_LEGAL_SUFFIX) continue;
    if (!categories.has(suffix)) {
      errors.push(
        `${base}_${suffix}: "${suffix}" is not a plural category of this language ` +
          `(it has: ${[...categories].join(', ')}) — the key can never resolve`,
      );
    }
  }

  if (!suffixes.has('other')) {
    errors.push(
      `${base}: no "_other" form — every language has the "other" category, so some ` +
        `counts have nothing to resolve to in this language`,
    );
  }

  return errors;
}

/**
 * Categories the language has that this family does not supply.
 *
 * THIS USED TO BE DOCUMENTED AS HARMLESS, ON A FALSE PREMISE. The old comment
 * — here and on every caller — said "not a failure, i18next falls back to
 * `other`". It does not. There is no intra-language fallback between plural
 * categories: for a count, i18next resolves the category, then looks for
 * `key_<category>` and the bare `key` IN THIS LANGUAGE, and if it finds
 * neither it moves to the next language in the fallback chain — English.
 *
 * Measured against the installed i18next 26, `ru` supplying only `_one`/`_other`
 * with `fallbackLng: 'en'`:
 *
 *     count=1  -> "1 строка"   (ru, category one)
 *     count=2  -> "2 rows"     <- ENGLISH (category few, not supplied)
 *     count=5  -> "5 rows"     <- ENGLISH (category many, not supplied)
 *     count=21 -> "21 строка"  (ru, category one)
 *
 * Russian `few` covers 2-4 and `many` covers 5-20, so that is most of the
 * counts a UI ever shows, rendered in English mid-sentence. With no fallback
 * language configured it is worse still — the raw key.
 *
 * The ONE thing that does rescue it is a bare `key` sibling in the same locale,
 * because the bare key IS tried before the language moves on. Verified the same
 * way: with a ru bare sibling present, count=2 renders the ru bare string, not
 * English. That is why gaps are split by `coveredByBareKey` below, and why the
 * split decides severity rather than decorating the message.
 */
export function missingPluralCategories(suffixes, categories) {
  return [...categories].filter((category) => !suffixes.has(category)).sort();
}

/**
 * Locales excused from the missing-category rule, per category, with the reason
 * it is tolerable for THEM and would not be in general.
 *
 * This list is deliberately tiny and deliberately category-scoped. The reason
 * below is a fact about `many` in these two languages and nothing else — it
 * would be false for the same locales' `one`, and false for `many` in half the
 * languages queued behind them — so a locale-wide excuse would be justified by
 * an argument that does not cover it.
 *
 * Any locale NOT listed here fails on an uncovered gap. That is the point: the
 * languages arriving next include ru/pl/cs/ar, where the missing categories are
 * everyday counts, and they must fail loudly rather than ship English
 * mid-sentence the way es/fr's `many` never will.
 */
export const COVERAGE_GAP_GRANDFATHER = {
  es: {
    many:
      'In es, "many" selects ONLY exact millions (1000000, 2000000, 3000000 — verified ' +
      'via Intl.PluralRules; 1500000 is "other"). A count no UI here reaches, so the ' +
      'gap on all 41 families is real but unreachable. This is NOT the situation in ' +
      'ru/pl/cs/ar, where "many" covers ordinary counts.',
  },
  fr: {
    many: 'Same as es: "many" in fr is exact millions only, so the gap is unreachable.',
  },
};

/**
 * The families in a coverage gap that are a FAILURE, as opposed to a note.
 *
 * Three rules, in order:
 *  1. `LOCALE_PARITY_STRICT` for this locale — every family in the gap counts,
 *     including bare-covered ones. The override is for a backfill holding its
 *     own locale to the full category set, so it deliberately ignores both
 *     mitigations below.
 *  2. Grandfathered locale+category — nothing counts. See the list above.
 *  3. Otherwise: the families with NO bare `key` sibling. Those are the ones
 *     that render English (or a raw key); a family with a bare sibling renders
 *     this locale's own text, which is a grammar imperfection rather than an
 *     untranslated string, and is not worth failing a build over.
 */
export function enforcedCoverageGapFamilies(gap, strictEnv = STRICT_ENV) {
  if (isStrictFor(gap.locale, strictEnv)) return gap.families;
  if (COVERAGE_GAP_GRANDFATHER[gap.locale]?.[gap.category]) return [];
  return gap.uncovered;
}

/**
 * Namespace files the reference has, the ones this locale has, and the
 * difference in BOTH directions.
 *
 * `extra` matters as much as `missing`, and is the easier one to overlook: a
 * namespace the locale has and the reference does not is never key-diffed and
 * never value-checked — every rule below iterates the reference's namespaces —
 * so its contents are invisible unless the file itself is reported. The
 * realistic path is a rename or deletion in the reference that a locale did not
 * follow: the stale file keeps shipping, its keys resolve for nobody, and
 * nothing else here would say so.
 */
export function namespaceDiff(locales, locale, referenceLocale = REFERENCE_LOCALE) {
  const expected = [...(locales.get(referenceLocale)?.keys() ?? [])].sort();
  const actual = [...(locales.get(locale)?.keys() ?? [])].sort();
  return {
    expected,
    actual,
    missing: expected.filter((ns) => !actual.includes(ns)),
    extra: actual.filter((ns) => !expected.includes(ns)),
  };
}

/**
 * The plural-aware key diff for one locale namespace. Returns empty lists when
 * the locale has no such namespace at all — that is namespaceDiff's finding,
 * and reporting it twice makes one defect look like two.
 */
export function namespaceKeyDiff(locales, locale, namespace, referenceLocale = REFERENCE_LOCALE) {
  const referenceData = locales.get(referenceLocale)?.get(namespace);
  const data = locales.get(locale)?.get(namespace);
  if (!referenceData || !data) return { missing: [], extra: [] };
  return keySetDiff(classifyKeys(flattenKeys(referenceData)), classifyKeys(flattenKeys(data)));
}

/** Leaf values that are not a non-empty string, as `namespace:key (why)` ids. */
export function invalidLeafValues(locales, locale) {
  const offenders = [];
  for (const [namespace, data] of locales.get(locale) ?? []) {
    for (const [key, value] of flattenEntries(data)) {
      if (typeof value !== 'string') {
        offenders.push(`${namespace}:${key} (non-string: ${JSON.stringify(value)})`);
      } else if (value.trim() === '') {
        offenders.push(`${namespace}:${key} (empty string)`);
      }
    }
  }
  return offenders;
}

/** Every enforced plural error across one locale's namespaces. */
export function localePluralErrors(locales, locale) {
  const categories = pluralCategoriesFor(locale);
  const errors = [];
  for (const [namespace, data] of locales.get(locale) ?? []) {
    for (const [base, suffixes] of classifyKeys(flattenKeys(data)).plurals) {
      errors.push(...pluralFamilyErrors(base, suffixes, categories).map((e) => `${namespace}:${e}`));
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Plural-category coverage
// ---------------------------------------------------------------------------

/**
 * Plural categories each locale's language has that its families do not supply.
 *
 * Each entry is `{ locale, category, families, uncovered, coveredByBareKey }`:
 * `families` are `namespace:base` ids, `uncovered` is the subset with NO bare
 * `key` sibling — the ones that actually render English — and
 * `coveredByBareKey` is how many of the rest do have one.
 *
 * The split is the whole point. See missingPluralCategories() for the measured
 * behaviour: a missing category falls through to the next LANGUAGE, not to this
 * language's `_other`, unless a bare sibling catches it first.
 * enforcedCoverageGapFamilies() turns the split into a severity.
 */
export function collectCoverageGaps(locales) {
  const gaps = [];
  for (const locale of [...locales.keys()].sort()) {
    const categories = pluralCategoriesFor(locale);
    /** missing category -> { families, uncovered } */
    const byCategory = new Map();
    for (const [namespace, data] of locales.get(locale) ?? []) {
      const { plain, plurals } = classifyKeys(flattenKeys(data));
      for (const [base, suffixes] of plurals) {
        // Legacy `_plural`-only families supply no CLDR category at all, so
        // they would show up under every category here. They have their own
        // report below; leaving them out keeps this one about real gaps.
        if ([...suffixes].every((s) => s === LEGACY_PLURAL_SUFFIX)) continue;
        for (const category of missingPluralCategories(suffixes, categories)) {
          let bucket = byCategory.get(category);
          if (!bucket) {
            bucket = { families: [], uncovered: [] };
            byCategory.set(category, bucket);
          }
          const id = `${namespace}:${base}`;
          bucket.families.push(id);
          // i18next tries the bare `key` in THIS language before moving to the
          // next one, so a family with a bare sibling still renders this
          // locale's text. Without one, the missing category renders English.
          if (!plain.has(base)) bucket.uncovered.push(id);
        }
      }
    }
    for (const [category, bucket] of [...byCategory].sort()) {
      gaps.push({
        locale,
        category,
        families: bucket.families.sort(),
        uncovered: bucket.uncovered.sort(),
        coveredByBareKey: bucket.families.length - bucket.uncovered.length,
      });
    }
  }
  return gaps;
}

/** Every legacy i18next v3 `_plural` key, and any that would render raw. */
export function collectLegacyPluralKeys(locales) {
  const keys = [];
  const withoutFallback = [];
  for (const locale of [...locales.keys()].sort()) {
    for (const [namespace, data] of locales.get(locale) ?? []) {
      const { plain, plurals } = classifyKeys(flattenKeys(data));
      for (const [base, suffixes] of plurals) {
        if (!suffixes.has(LEGACY_PLURAL_SUFFIX)) continue;
        keys.push(`${locale}/${namespace}:${base}_plural`);
        // Only the BARE key rescues a dead `_plural` entry. This used to also
        // credit `_other`, on the same false premise corrected above: `_other`
        // is consulted for the counts whose category IS `other` and for no
        // others, so a `key_plural` + `key_other` family still renders nothing
        // of its own at count 1 in a language with a `one` category. The bare
        // key is the only sibling i18next tries for every category.
        if (!plain.has(base)) {
          withoutFallback.push(`${locale}/${namespace}:${base}`);
        }
      }
    }
  }
  return { keys, withoutFallback };
}

/** One gap as a single headline line, without the family list. */
export function summarizeCoverageGap(gap) {
  const { locale, category, families, uncovered, coveredByBareKey } = gap;
  const verb = families.length === 1 ? 'family does' : 'families do';
  const rescued = coveredByBareKey > 0 ? `, ${coveredByBareKey} rescued by a bare "key"` : '';
  return (
    `  ${locale}: ${families.length} plural ${verb} not supply "_${category}" ` +
    `(CLDR categories for ${locale}: ${[...pluralCategoriesFor(locale)].join(', ')}) — ` +
    `${uncovered.length} would render English${rescued}`
  );
}

/**
 * The headline plus a family list. Defaults to every family in the gap; the
 * failure path passes the ENFORCED subset, so the message lists what has to be
 * fixed rather than everything that was noticed.
 */
export function formatCoverageGap(gap, families) {
  // NOT a defaulted parameter. `gaps.map(formatCoverageGap)` would pass the
  // array index in as `families`, and the default would never apply — caught by
  // the guard suite with "families.join is not a function", which is the polite
  // version of this bug. Anything that is not an array means "all of them".
  const list = Array.isArray(families) ? families : gap.families;
  return `${summarizeCoverageGap(gap)}\n    ${list.join('\n    ')}`;
}

/**
 * The full coverage/legacy findings, as text — everything noticed, whether or
 * not it is enforced.
 *
 * WHERE THE WARNINGS GO. Some findings are reported rather than failed (a
 * coverage gap that a bare `key` sibling rescues, a grandfathered locale's
 * `many`, and the legacy `_plural` inventory). A console warning alone
 * was not enough of a channel on the guard side: its reporter prints nothing
 * for a green run and the agent entry points run silent, so the warnings
 * reached nobody. They are therefore also written to a file on every run. A
 * snapshot was deliberately NOT used: it would put a second repository's file
 * in the path of every locale change here, which is the coupling this shape
 * exists to remove.
 */
export function buildReport(locales, { coverageGaps, legacyPlurals }) {
  const out = [
    `# locale-parity report — ${new Date().toISOString()}`,
    `# Locales: ${[...locales.keys()].sort().join(', ')}`,
    '',
    '## Plural-category coverage gaps',
    '## (a gap with no bare "key" sibling renders ENGLISH for those counts — see',
    '##  missingPluralCategories(); es/fr "many" is grandfathered as exact-millions-only)',
    '',
  ];
  out.push(
    coverageGaps.length === 0 ? '  none' : coverageGaps.map(formatCoverageGap).join('\n'),
    '',
    '## Legacy i18next v3 "_plural" keys (dead under the v4 JSON format)',
    '',
    legacyPlurals.keys.length === 0 ? '  none' : `  ${legacyPlurals.keys.join('\n  ')}`,
    '',
  );
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Value integrity
// ---------------------------------------------------------------------------
//
// Parity checks that the KEYS match; these check that the VALUES are
// structurally sound. Objective checks only — meaning and register are judged
// by review, not here. Deliberately absent: inflected consistency of domain
// terms, because Russian and Turkish morphology make substring matching produce
// false failures, and a check that cries wolf gets disabled.
//
// Five checks, every one a hard failure:
//   1. placeholder integrity — the same interpolation tokens English uses
//   2. do-not-translate terms — product and provider names survive verbatim
//   3. untranslated-value detection — a substantial value byte-identical to en
//   4. length sanity — gross length outliers against en
//   5. key order — files stay diff-reviewable against en
//
// NOTHING HERE IS ADVISORY. A finding is either a failure or it is not a
// finding. The one thing that could rot silently — an IDENTICAL_ALLOWLIST entry
// whose value has since been translated — is asserted as stale by the callers
// rather than ignored, and pairCounts() below exists so a check that silently
// stops comparing anything goes red instead of green.

/**
 * Leaf entries whose value is a string, as [key, value] pairs. Non-string and
 * empty leaves are invalidLeafValues()' finding; dropping them here keeps a
 * single defect from being reported twice.
 */
export function stringEntries(data) {
  return flattenEntries(data).filter((e) => typeof e[1] === 'string');
}

/** Number of Unicode code points, so a CJK char counts 1 and an emoji counts 1. */
export function charCount(value) {
  return [...value].length;
}

/**
 * The English entry a locale entry is compared against, or undefined when there
 * is none.
 *
 * THIS MAPPING EXISTS BECAUSE OF PLURALS, and every check below goes through
 * it rather than assuming key equality. Plural categories are per-language CLDR
 * data: `en` has ["one","other"], `ru` has ["one","few","many","other"], `ja`
 * has ["other"] alone, and `fr`/`pt-BR` have a `many` English does not. So for
 * a great many locale plural keys there is simply NO same-named English key —
 * a naive `refMap.get(key)` would silently skip every Russian `_few`/`_many`
 * form, i.e. skip the values most likely to be wrong.
 *
 * Resolution order:
 *
 *  1. The same key, when English has it. Preferred over `_other` because
 *     English's plural forms are deliberately DIFFERENT SENTENCES, not
 *     inflections of one: `strings:bulk.removeCategoryApply_zero` is "Remove
 *     categories" while `_other` is "Remove {{count}} categories". Comparing
 *     `_zero` against `_other` reports a dropped `{{count}}` that is correct in
 *     both languages — a false failure, observed on all three of es/fr's
 *     `_zero`/`_one` forms before this rule was added.
 *  2. English's `_other`, for a plural form English does not have. `other` is
 *     the one category every language has — not a runtime fallback for the
 *     others, but the only reference guaranteed to exist for `ru:foo_few`.
 *  3. English's bare `base`, for a plural family the locale ADDED where English
 *     writes one plain string. keySetDiff explicitly allows this ("{{count}}
 *     rows processed" is one English string and four Russian ones), so without
 *     this step those added forms would go unchecked.
 *  4. Otherwise nothing: a locale key with no English counterpart at all is a
 *     key-set divergence, which is keySetDiff's `extra` case. Reporting it
 *     here too would double-report one defect.
 */
export function resolveReference(refMap, key) {
  const exact = refMap.get(key);
  if (exact !== undefined) return { key, value: exact };

  const split = splitPluralKey(key);
  if (!split) return undefined;

  for (const candidate of [`${split.base}_other`, split.base]) {
    const value = refMap.get(candidate);
    if (value !== undefined) return { key: candidate, value };
  }
  return undefined;
}

/**
 * Every (locale entry, English counterpart) pair for one locale, each
 * `{ namespace, key, value, referenceKey, referenceValue }`. Namespaces the
 * locale is missing are skipped — that is namespaceDiff's case.
 */
export function pairsFor(locales, locale, referenceLocale = REFERENCE_LOCALE) {
  const reference = locales.get(referenceLocale);
  if (!reference) throw new Error(`Reference locale "${referenceLocale}" not found`);
  const pairs = [];
  for (const [namespace, data] of locales.get(locale) ?? []) {
    const refData = reference.get(namespace);
    if (!refData) continue;
    const refMap = new Map(stringEntries(refData));
    for (const [key, value] of stringEntries(data)) {
      const ref = resolveReference(refMap, key);
      if (!ref) continue;
      pairs.push({
        namespace,
        key,
        value,
        referenceKey: ref.key,
        referenceValue: ref.value,
      });
    }
  }
  return pairs;
}

/**
 * Namespaces of `locale` for which not a single value was compared, even though
 * the reference has that namespace too.
 *
 * A check that quietly compares nothing passes forever. If reference resolution
 * or namespace discovery ever breaks, every check below goes green with an
 * empty offender list — this is what goes red instead.
 */
export function uncomparedNamespaces(locales, locale, referenceLocale = REFERENCE_LOCALE) {
  const counts = new Map();
  for (const pair of pairsFor(locales, locale, referenceLocale)) {
    counts.set(pair.namespace, (counts.get(pair.namespace) ?? 0) + 1);
  }
  const empty = [];
  for (const namespace of locales.get(locale)?.keys() ?? []) {
    if (!locales.get(referenceLocale)?.has(namespace)) continue;
    if (!counts.get(namespace)) empty.push(`${locale}/${namespace}`);
  }
  return empty;
}

/** Names the English key in a message only when it is not the locale's own. */
function against(pair) {
  return pair.key === pair.referenceKey ? '' : ` (vs en:${pair.referenceKey})`;
}

/**
 * Interpolation tokens, sorted so word order may change freely between
 * languages while the MULTISET of tokens must match exactly — a token dropped,
 * renamed, or repeated a different number of times all fail. (Repetition is
 * load-bearing: `category:genBatchCount_other` interpolates `{{count}}` twice,
 * and both es and fr correctly do the same.) Written to also catch numbered
 * Trans tags and $t() nesting — neither appears in any locale today, but both
 * would silently break if introduced.
 */
export function tokensOf(value) {
  return [
    ...(value.match(/\{\{[^}]*\}\}/g) ?? []),
    ...(value.match(/<\/?\d+>/g) ?? []),
    ...(value.match(/\$t\([^)]*\)/g) ?? []),
  ].sort();
}

/** 1. Placeholder integrity. */
export function placeholderOffenders(pairs, locale) {
  const offenders = [];
  for (const pair of pairs) {
    const want = tokensOf(pair.referenceValue);
    const got = tokensOf(pair.value);
    if (want.join('|') !== got.join('|')) {
      offenders.push(
        `${pair.namespace}:${pair.key}${against(pair)} — en has [${want.join(', ')}], ` +
          `${locale} has [${got.join(', ')}]`,
      );
    }
  }
  return offenders;
}

/**
 * Terms that must survive translation verbatim. Product and provider names
 * carry no meaning to translate, and a localized "NARN" would be a bug. Matched
 * case-sensitively, so a locale lowercasing "API" to "api" is caught too.
 */
export const DO_NOT_TRANSLATE = [
  'NARN',
  'DeepL',
  'Copilot',
  'OpenRouter',
  'OpenAI',
  'DeepSeek',
  'Anthropic',
  'Gemini',
  'CSV',
  'API',
];

function escapeRegExp(term) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Matches a do-not-translate term as a standalone token, not as a bare
 * substring.
 *
 * Substring matching was lenient in exactly the direction that hurts. The
 * check fires only when a term is LOST, comparing counts — so an incidental
 * substring in the TARGET value inflates its count back up to English's and
 * the loss is never reported at all. A false negative in a check is worse than
 * a false positive because nothing announces it, and the collisions are real:
 * Turkish "KAPI" (door) and Indonesian "TERAPI" both contain "API", and both
 * are plausible in an uppercased label during the locale backfill.
 *
 * `\b` cannot simply be wrapped around every term. It is defined against `\w`,
 * so a side of the term that is NOT a word character — a future entry like
 * "C++" or ".env" — would carry a boundary that can never match, silently
 * dropping that term from the check. Each side therefore gets a lookaround
 * only when that side of the TERM is a word character.
 *
 * `\w` being ASCII-only in JavaScript is what we want here: "APIを設定" and
 * «API» still match, while "KAPI" no longer does. An English plural "s" is
 * tolerated ("imported CSVs match…"), so a term still counts where English
 * pluralises it and the translation does not.
 */
export function termPattern(term) {
  const left = /^\w/.test(term) ? '(?<!\\w)' : '';
  const right = /\w$/.test(term) ? 's?(?!\\w)' : '';
  return `${left}${escapeRegExp(term)}${right}`;
}

export function countOccurrences(value, term) {
  return (value.match(new RegExp(termPattern(term), 'g')) ?? []).length;
}

/** 2. Do-not-translate terms. */
export function doNotTranslateOffenders(pairs, locale) {
  const offenders = [];
  for (const pair of pairs) {
    for (const term of DO_NOT_TRANSLATE) {
      const wanted = countOccurrences(pair.referenceValue, term);
      // Only a LOSS is a failure. A translation may legitimately repeat a
      // product name English mentions once (word order, or a preposition
      // English elides), so `got > wanted` is not an error.
      const got = countOccurrences(pair.value, term);
      if (wanted > 0 && got < wanted) {
        offenders.push(
          `${pair.namespace}:${pair.key}${against(pair)} — "${term}" appears ` +
            `${wanted}x in en, ${got}x in ${locale}`,
        );
      }
    }
  }
  return offenders;
}

/**
 * A value byte-identical to English is almost always untranslated. Short values
 * legitimately match across languages, so the check only fires once the English
 * source is substantial enough that coincidence is implausible — see
 * isSubstantial(). Genuine long matches go in IDENTICAL_ALLOWLIST with a
 * reason; never raise a threshold to make a failure disappear.
 */
export const MIN_WORDS = 3;

/**
 * Locale directories whose script does not put spaces between words, so a
 * whitespace word count is meaningless for them.
 */
export const UNSPACED_SCRIPT_LOCALES = new Set(['ja', 'ko', 'zh-hans', 'zh-hant', 'th']);

/**
 * Character threshold used instead of MIN_WORDS for the locales above.
 *
 * 8 is calibrated against the actual English corpus rather than picked round.
 * Nearly every en value shorter than 8 characters is a single short word —
 * "Save", "Cancel", "Delete", "Warning", "Dismiss", "LQA", "JSON" — the class
 * where a cross-language collision is plausible and an acronym is often
 * correct. Six are two words rather than one ("Key 1", "Key 2", "By tone",
 * "No type", "+ Tone", "Run ID"), and they sit in the same class: formulaic
 * labels built around a number, an acronym or a bare noun, where identity with
 * English is not by itself evidence of an untranslated value. At 8 the phrases
 * start: "Security", "Download", "Sign out", "Categories",
 * "Notifications", all of which must be translated in every language. This
 * brings 622 short en values into scope for those locales; the words rule alone
 * would have exempted all of them and left the check unable to fire on most of
 * a Japanese or Thai file.
 */
export const MIN_UNSPACED_CHARS = 8;

/**
 * Is this value substantial enough that byte-identity with English is a defect
 * rather than a coincidence?
 *
 * Judged on the ENGLISH side of the pair (identity means the two are the same
 * string anyway), but with a per-locale rule: the whitespace word count works
 * only when the target language separates words with spaces.
 * `"これは文です".split(/\s+/).length` is 1 for a whole sentence, so a
 * words-only threshold would exempt essentially every value in ja/ko/zh/th and
 * quietly disable this check for the locales where a copied-through English
 * string is most obvious to a reader and most embarrassing to ship.
 */
export function isSubstantial(value, locale) {
  const trimmed = value.trim();
  if (UNSPACED_SCRIPT_LOCALES.has(locale)) return charCount(trimmed) >= MIN_UNSPACED_CHARS;
  return trimmed.split(/\s+/).length >= MIN_WORDS;
}

/**
 * `locale:namespace:key` -> why an identical value is correct. `*` in the
 * locale position covers every locale, for the cases where the justification is
 * language-independent — otherwise the same three product names would need one
 * entry per locale (42 across the fourteen planned languages) saying the same
 * thing. A per-locale entry is still the right form for a
 * language-specific reason ("LQA is kept as an industry acronym in French").
 *
 * Entries are asserted to be live: an entry that no longer matches an identical
 * value is a stale-allowlist failure on the caller side, so this list cannot
 * silently accumulate dead suppressions.
 */
export const IDENTICAL_ALLOWLIST = {
  '*:glossary:sourceLink':
    'Proper name of an external spreadsheet ("GI: MW Glossary / Common Translation Sheet") — ' +
    'it is a link target users must be able to find, not prose',
  '*:review:provenance':
    'Format string "{{module}} · {{date}}" — nothing but two placeholders and a separator, ' +
    'so there is no word to translate',
  '*:strings:guide.topicGoogle':
    'Product name "Google AI (Gemini)" — both parts are on the do-not-translate list',
};

export function allowlistKeysFor(locale, namespace, key) {
  return [`${locale}:${namespace}:${key}`, `*:${namespace}:${key}`];
}

/**
 * 3. Untranslated-value detection. `usedAllowlistKeys` collects the allowlist
 * ids that actually suppressed something, so the caller can fail a stale entry.
 */
export function identicalValueOffenders(pairs, locale, usedAllowlistKeys = new Set()) {
  const offenders = [];
  for (const pair of pairs) {
    if (pair.value !== pair.referenceValue) continue;
    if (!isSubstantial(pair.referenceValue, locale)) continue;
    const allowed = allowlistKeysFor(locale, pair.namespace, pair.key).find(
      (id) => id in IDENTICAL_ALLOWLIST,
    );
    if (allowed) {
      usedAllowlistKeys.add(allowed);
      continue;
    }
    offenders.push(`${pair.namespace}:${pair.key} — "${pair.value}"`);
  }
  return offenders;
}

/**
 * Catches an agent writing an explanation where a label belongs. Deliberately
 * permissive: German and Russian legitimately run 30-40% longer than English,
 * and CJK runs much shorter, so only gross outliers fail. This is not a
 * UI-overflow check — it is a "wrong kind of text" check.
 */
export const MAX_LENGTH_RATIO = 2.5;
export const MIN_REFERENCE_CHARS = 12;

/** 4. Length sanity. */
export function lengthOffenders(pairs, locale) {
  const offenders = [];
  for (const pair of pairs) {
    const refLength = charCount(pair.referenceValue);
    if (refLength < MIN_REFERENCE_CHARS) continue;
    const ratio = charCount(pair.value) / refLength;
    if (ratio > MAX_LENGTH_RATIO) {
      offenders.push(
        `${pair.namespace}:${pair.key}${against(pair)} — ${ratio.toFixed(1)}x ` +
          `(en ${refLength} chars, ${locale} ${charCount(pair.value)})`,
      );
    }
  }
  return offenders;
}

/**
 * The key sequence with each plural family collapsed to its base, first
 * occurrence winning.
 *
 * Comparing raw key sequences would make the check blind to plurals rather than
 * strict about them: `ru:foo_few` is not an English key and `en:foo_one` is not
 * a Russian one, so both would be filtered out of the comparison and a whole
 * family could drift anywhere in the file unnoticed. Collapsing to the base
 * compares the position of the FAMILY, which is the reviewable unit, and lets
 * each language supply whatever suffixes its CLDR rules need.
 */
export function orderedBases(keys) {
  const seen = new Set();
  const bases = [];
  for (const key of keys) {
    const base = splitPluralKey(key)?.base ?? key;
    if (seen.has(base)) continue;
    seen.add(base);
    bases.push(base);
  }
  return bases;
}

/**
 * Describes the first position where two base sequences diverge, or '' when
 * they agree. Only the SHARED bases are compared, in both directions, so a key
 * the locale is missing (keySetDiff's job) does not also fail here with a
 * confusing message.
 */
export function orderDivergence(referenceKeys, localeKeys, locale) {
  const referenceBases = orderedBases(referenceKeys);
  const localeBases = orderedBases(localeKeys);
  const inLocale = new Set(localeBases);
  const inReference = new Set(referenceBases);
  const expected = referenceBases.filter((base) => inLocale.has(base));
  const actual = localeBases.filter((base) => inReference.has(base));
  if (expected.join('|') === actual.join('|')) return '';

  const at = expected.findIndex((base, index) => base !== actual[index]);
  const index = at === -1 ? Math.min(expected.length, actual.length) : at;
  return (
    `first divergence at position ${index}: en has "${expected[index] ?? '(end of file)'}", ` +
    `${locale} has "${actual[index] ?? '(end of file)'}"`
  );
}

/** 5. Key order. */
export function keyOrderOffenders(locales, locale, referenceLocale = REFERENCE_LOCALE) {
  const reference = locales.get(referenceLocale);
  if (!reference) throw new Error(`Reference locale "${referenceLocale}" not found`);
  const offenders = [];
  for (const [namespace, refData] of reference) {
    const data = locales.get(locale)?.get(namespace);
    if (!data) continue; // the namespace-presence rule owns missing namespaces
    const divergence = orderDivergence(
      stringEntries(refData).map(([key]) => key),
      stringEntries(data).map(([key]) => key),
      locale,
    );
    if (divergence) offenders.push(`${namespace} — ${divergence}`);
  }
  return offenders;
}

/** Allowlist ids that suppressed nothing on this run, so they are dead. */
export function staleAllowlistKeys(usedAllowlistKeys) {
  return Object.keys(IDENTICAL_ALLOWLIST)
    .filter((id) => !usedAllowlistKeys.has(id))
    .sort();
}

/** Allowlist entries whose "reason" is too thin to be a reason. */
export function thinAllowlistReasons() {
  return Object.entries(IDENTICAL_ALLOWLIST)
    .filter(([, reason]) => reason.trim().split(/\s+/).length < 5)
    .map(([id]) => id);
}
