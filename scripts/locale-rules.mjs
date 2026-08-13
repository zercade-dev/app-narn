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
import { join, relative } from 'node:path';

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
 * and then the bare `key`, in that order, in this language before moving to
 * the next.
 *
 * NO KEY USES IT ANY MORE — verified, zero `_plural` keys across every shipped
 * locale. (This comment used to name three, config:glossariesSkipped /
 * malformedRows / exportRoundtripWarning, which have since been converted.)
 * The suffix stays recognised here so that a reintroduced one is classified as
 * a plural form rather than mistaken for a plain key called `foo_plural`, and
 * so the rules neither crash on it nor silently bless it: it is now a hard
 * failure via pluralFamilyErrors()'s mandatory `_other`, whose carve-out for
 * this suffix was removed once it had no subjects.
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

// ---------------------------------------------------------------------------
// Work-in-progress locales
// ---------------------------------------------------------------------------

/**
 * Locale directory -> why this language is mid-backfill. Exactly ONE rule stops
 * applying to a declared locale: namespace files the reference has that it has
 * not created yet.
 *
 * WHY THIS EXISTS. A language is translated over six batches (see
 * docs/i18n/backfill-runbook.md), each batch creating its own namespaces, so
 * between batch 1 and batch 6 the locale directory is INCOMPLETE BY
 * CONSTRUCTION. Measured against these rules with a synthetic German locale
 * holding only batch 1's `config.json`: 23 hard failures, one per namespace
 * nobody has reached. Every translator meets that on day one, for five of six
 * batches, and the documented instruction is to run the gate at every commit. A
 * gate that is red for reasons everyone is told to ignore is a gate that gets
 * ignored, and then deleted.
 *
 * WHAT IT DOES NOT BUY — anything at all. Every other rule applies in full from
 * batch 1: key parity within a namespace, placeholder integrity,
 * do-not-translate terms, key order, length sanity, plural-suffix legality,
 * plural-category coverage, and values byte-identical to English. Those catch
 * defects a translator can fix today, and a batch that trips one of them is
 * wrong, not unfinished. namespaceDiff's `extra` is not deferred either: a
 * namespace with no reference counterpart is a stale or misnamed file, which is
 * a defect at every point in a backfill rather than a batch that has not
 * happened.
 *
 * THE IDENTICAL-VALUE RULE WAS ONCE ON THIS LIST, AND TAKING IT OFF IS WORTH
 * RECORDING. The reasoning was that pre-copying all 24 English files is the
 * other way to hold a partial locale, and in that shape the rule fires on ~735
 * untranslated values. But pairsFor() only yields pairs for namespaces the
 * locale ACTUALLY HAS, so under the shape the runbook mandates — create this
 * batch's namespaces and no others — that rule has no false positives to
 * suppress in the first place. Deferring it bought a correct batch nothing and
 * cost two things: it blessed the pre-copy shape the runbook forbids, and it
 * hid a value copied through from English INSIDE an already-translated
 * namespace until the declaration was lifted, which is months later and five
 * batches after the commit that introduced it. One rule, not two.
 *
 * The declaration is explicit and carries a reason, like LENGTH_EXEMPTIONS and
 * for the same reason: a locale that became work-in-progress by inference — "it
 * has fewer files than en, so someone must be working on it" — is exactly how a
 * half-translated language ships. An entry with no reason throws at module
 * load.
 *
 * It cannot be forgotten in either direction. Every CLI run prints a line per
 * declared locale naming what is deferred, so the state is in the log of every
 * check run while the language is in flight; and the moment the last namespace
 * lands, the entry defers nothing and staleWipLocales() turns it into a hard
 * failure saying to delete it. The gate lifts the exemption, not a memory.
 */
export const WIP_LOCALES = {
};

for (const [locale, reason] of Object.entries(WIP_LOCALES)) {
  if (!reason || !reason.trim()) {
    throw new Error(
      `WIP_LOCALES.${locale} has no reason — an unexplained work-in-progress locale is ` +
        `indistinguishable from a half-translated one nobody remembers.`,
    );
  }
  if (locale === REFERENCE_LOCALE) {
    throw new Error(
      `WIP_LOCALES."${REFERENCE_LOCALE}" is the reference locale — every rule here is defined ` +
        `against it, so it is what "complete" means and cannot itself be work-in-progress.`,
    );
  }
}

/**
 * Is this locale declared work-in-progress?
 *
 * DELIBERATELY UNRELATED TO LOCALE_PARITY_STRICT, which is the interaction that
 * matters most here: the runbook tells a translator to run
 * `LOCALE_PARITY_STRICT=<lang> pnpm check:locales` from the FIRST batch, so a
 * strict mode that also cancelled the work-in-progress exemption would leave
 * the one command the procedure mandates red for five of six batches, which is
 * the whole defect this mechanism exists to remove.
 *
 * They are orthogonal because they govern different rules, not because one
 * outranks the other. STRICT_ENV is consulted in exactly two places —
 * enforcedCoverageGapFamilies() and describeEnforcedGap() — and both are about
 * plural-category coverage: it is a severity knob for plurals, not a general
 * "forgive nothing" switch, and it has never had an opinion about which
 * namespace files exist. So the combination a translator actually runs, strict
 * AND work-in-progress, is the strictest available reading of a partial locale:
 * every plural family already written is held to the language's complete
 * category set with no bare-key rescue and no grandfathering, while the
 * namespaces batch 4 has not reached are not reported as missing.
 */
export function isWorkInProgress(locale, wipLocales = WIP_LOCALES) {
  return Object.hasOwn(wipLocales, locale);
}

/**
 * The findings of a WIP-deferrable rule that this locale is still held to.
 *
 * Shaped like enforcedCoverageGapFamilies(): the rule itself keeps reporting
 * everything it sees, and severity is decided in one shared place that both
 * callers go through. Passing a rule's findings through this is what makes a
 * rule deferrable, so the set of deferrable rules is the set of call sites —
 * ONE of them, the missing-namespace rule named in WIP_LOCALES above. Do not
 * add a second without an argument as concrete as the one there, and read the
 * identical-value paragraph first: the test is not "does this rule fire on a
 * partial locale", it is "can a correct batch do anything about it". A rule a
 * batch could have satisfied is not unsatisfiable, it is unsatisfied.
 */
export function enforcedForWipLocale(locale, findings, wipLocales = WIP_LOCALES) {
  return isWorkInProgress(locale, wipLocales) ? [] : findings;
}

/**
 * What each declared work-in-progress locale is actually deferring, as
 * `locale -> { missingNamespaces }`.
 *
 * ONE implementation for both callers, because the two consumers ask different
 * questions of the same answer — the CLI prints it, the vitest guard asserts a
 * declaration still earns its place — and a locale that looked finished to one
 * and unfinished to the other would put the two repos back into exactly the
 * drift this module exists to prevent.
 *
 * It stays an object rather than a bare list because the thing it answers is
 * "what is this declaration buying", and that question survives the rule set
 * changing shape; it has already narrowed from two rules to one.
 *
 * namespaceDiff() is declared further down the file. That is a hoisted function
 * declaration, not a temporal-dead-zone `const`, and nothing here runs at module
 * load — the whole work-in-progress mechanism sits in one place deliberately, so
 * that the rule it defers, the switch that defers it and the check that expires
 * it are read together.
 *
 * Locales with no directory on disk are skipped here and reported by
 * staleWipLocales(), which is the function that can say why.
 */
export function collectWipDeferrals(
  locales,
  referenceLocale = REFERENCE_LOCALE,
  wipLocales = WIP_LOCALES,
) {
  const deferrals = new Map();
  for (const locale of Object.keys(wipLocales).sort()) {
    if (!locales.has(locale)) continue;
    deferrals.set(locale, {
      missingNamespaces: namespaceDiff(locales, locale, referenceLocale).missing,
    });
  }
  return deferrals;
}

/** One declared locale as a single line, naming what it is deferring and why. */
export function describeWipLocale(locale, deferred, wipLocales = WIP_LOCALES) {
  const namespaces = deferred?.missingNamespaces ?? [];
  return (
    `  ${locale}: ${namespaces.length} namespace file(s) not created yet — deferred and NOT ` +
    `checked. Every other rule applies. Reason: ${wipLocales[locale]}`
  );
}

/**
 * Work-in-progress declarations that no longer defer anything, as failure
 * messages. The mirror of staleAllowlistKeys(), and the reason nobody can
 * forget to lift the exemption: the run in which the last namespace file lands
 * is the run that goes red and says to delete the entry. There is no window in
 * which a complete language sits under a weakened gate.
 *
 * A declaration naming a locale with no directory at all is the same finding
 * wearing a different hat — it defers nothing, and it also means nothing is
 * checking the language it names, so it is worth its own sentence. It is also
 * why a language cannot be declared BEFORE its first batch lands: the entry and
 * the first namespace file have to arrive in the same commit.
 */
export function staleWipLocales(locales, deferrals, wipLocales = WIP_LOCALES) {
  const stale = [];
  for (const locale of Object.keys(wipLocales).sort()) {
    if (!locales.has(locale)) {
      stale.push(
        `${locale}: declared work-in-progress, but there is no ${locale}/ locale directory — ` +
          `nothing is deferred and nothing is being checked under that name`,
      );
      continue;
    }
    if ((deferrals.get(locale)?.missingNamespaces.length ?? 0) === 0) {
      stale.push(
        `${locale}: every ${REFERENCE_LOCALE} namespace is present, so this language is no ` +
          `longer incomplete by construction — delete the WIP_LOCALES entry and let the full ` +
          `gate apply to it`,
      );
    }
  }
  return stale;
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
      'In es, "many" selects ONLY exact millions (1000000, 2000000, 3000000 — verified via ' +
      'Intl.PluralRules; 1500000 is "other", and NO integer in 0..200 selects it). A count ' +
      'no UI here reaches, so the gap on all 41 families is real but unreachable. This is ' +
      'emphatically NOT the situation in ru/pl/uk/ar, where "many" is an everyday integer ' +
      'category — measured over 0..200: ru 129, pl 146, uk 129, ar 178 of 201 counts. ' +
      '(cs/sk/lt look like a third case again: they have a "many" category that selects no ' +
      'integer at all, only fractions such as 1.5. It is not grandfathered, so it fails ' +
      'closed, which is the right default for a category nobody has measured.)',
  },
  fr: {
    many: 'Same as es: "many" in fr is exact millions only, so the gap is unreachable.',
  },
  it: {
    many:
      'Same shape as es/fr: "many" in it selects only exact millions (1000000, 2000000 — ' +
      'verified via Intl.PluralRules; 1500000 is "other", and NO integer in 0..200 selects ' +
      'it), so the gap on all 41 families is real but unreachable by any count this UI shows.',
  },
  'pt-br': {
    many: 'Same as it: exact millions only, so the gap is unreachable.',
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
 * Why these families are a failure, worded for the path that produced them.
 *
 * THE TWO PATHS SAY DIFFERENT THINGS AND MUST NOT SHARE A SENTENCE. The
 * default path enforces exactly the families with no bare `key` sibling, so
 * "those counts render English" is true of every one of them. The strict path
 * enforces `gap.families`, which INCLUDES the bare-covered ones — for those the
 * locale's own text still renders, and claiming otherwise would put this
 * round's own defect back into user-facing output. It happened: a single
 * hardcoded clause told `LOCALE_PARITY_STRICT=es` that 12 bare-covered
 * families "render English" when none of them do.
 *
 * Both callers use this, so neither can drift from the other or from the truth.
 */
export function describeEnforcedGap(gap, families, strictEnv = STRICT_ENV) {
  const count = `${families.length} plural ${families.length === 1 ? 'family' : 'families'}`;
  const missing = `do not supply "_${gap.category}"`;

  if (isStrictFor(gap.locale, strictEnv)) {
    const rescued =
      gap.coveredByBareKey > 0
        ? `, including ${gap.coveredByBareKey} a bare "key" sibling would otherwise rescue`
        : '';
    return (
      `${gap.locale}: ${count} ${missing} — LOCALE_PARITY_STRICT="${strictEnv}" holds this ` +
      `locale to its language's complete category set${rescued}`
    );
  }

  return (
    `${gap.locale}: ${count} ${missing}, and have no bare "key" sibling — ` +
    `those counts render English`
  );
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
// rather than ignored, and uncomparedNamespaces() below exists so a check that
// silently stops comparing anything goes red instead of green.

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
 *
 * CONSEQUENCE FOR IDENTICAL_ALLOWLIST, learned the hard way: the two thresholds
 * do not select the same set of keys, so the allowlist's completeness is
 * script-dependent. A 1-2 word English value under 8 characters is invisible to
 * every spaced locale and visible to every unspaced one. Six do-not-translate
 * product names sat unallowlisted for the whole programme for exactly this
 * reason — only their three-word sibling had ever fired — and the first
 * Japanese batch surfaced all six at once. So an allowlist that looks complete
 * after de/es/fr/tr is not evidence of anything for ja/ko/zh/th, and the gap
 * appears as a batch of failures on one locale rather than as a trickle. Grant
 * the entries; do not raise a threshold to make them disappear.
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
  'de:config:routing.tabImportExport':
    'German spells both nouns exactly as English does — Import and Export are the ordinary ' +
    'German nouns for the two operations — and the key is a tab label, which style/de.md ' +
    'binds to a noun phrase. The alternative that differs from en is the infinitive pair ' +
    '"Importieren / Exportieren", which is the wrong control shape. Requested by the ' +
    'translator and granted rather than absorbed into the string: a guard rejecting copy ' +
    'the translator believes is correct is a finding against the guard.',
  '*:glossary:sourceLink':
    'Proper name of an external spreadsheet ("GI: MW Glossary / Common Translation Sheet") — ' +
    'it is a link target users must be able to find, not prose',
  '*:review:provenance':
    'Format string "{{module}} · {{date}}" — two placeholders and a separator, so there is ' +
    'no WORD to translate. Corrected 2026-08-11: the original reason said there was nothing ' +
    'to translate at all, which the shipped tree falsifies — the SEPARATOR is locale-' +
    'variable, and `ja` now ships the ideographic 中黒 ("{{module}}・{{date}}") to match the ' +
    'rest of its punctuation. That locale is therefore no longer byte-identical and no ' +
    'longer reaches this entry; the entry covers the locales that legitimately keep the ' +
    'ASCII middle dot. A CJK locale reading the old reason would have kept "·" against its ' +
    'own typography rules, which is the opposite of what this entry is for.',
  '*:strings:guide.topicGoogle':
    'Product name "Google AI (Gemini)" — both parts are on the do-not-translate list',

  // The six siblings of topicGoogle. They belong to the same class and have the
  // same justification, but only topicGoogle was here until an unspaced locale
  // arrived: it is three words, so it trips MIN_WORDS, while these six are one
  // or two words and no spaced locale can ever see them. All six clear
  // MIN_UNSPACED_CHARS, so `ja` is the first locale in the programme able to
  // surface them — see the note on isSubstantial(). `*:` because "this is a
  // product name" is language-independent, exactly as for topicGoogle.
  '*:strings:guide.topicCopilot':
    'Product name "GitHub Copilot" — both parts are on the do-not-translate list',
  '*:strings:guide.topicDeepseek':
    'Product name "DeepSeek" — on the do-not-translate list',
  '*:strings:guide.topicClaude':
    'Product names "Anthropic (Claude)" — vendor and model, both on the do-not-translate list',
  '*:strings:guide.topicGpt':
    'Product names "OpenAI (GPT)" — vendor and model, both on the do-not-translate list',
  '*:strings:guide.topicOpenrouter':
    'Product name "OpenRouter" — on the do-not-translate list',
  '*:strings:guide.topicGenericAi':
    'Module name "Generic AI" — the product\'s own name for the bring-your-own-endpoint ' +
    'module, shown in the module picker, so it must match the picker verbatim',

  '*:vault:keyPlaceholder':
    'A sample VAULT KEY NAME — "KEY_NAME", ASCII uppercase with an underscore — shown as the ' +
    'empty-state hint of the key control. Vault key names are on the shared never-translate ' +
    'list and are drawn from a fixed set of identifiers, so every correct locale renders ' +
    'this identically; the scope is `*:` for that reason rather than per-locale. Requested ' +
    'independently by the Japanese and German batch-4 translators, and `ja` is merely the ' +
    'first locale able to SEE it: at 8 characters and one word it clears ' +
    'MIN_UNSPACED_CHARS and fails MIN_WORDS, which is exactly the asymmetry isSubstantial() ' +
    'documents. Neither translator localized or padded the value to clear the check. ' +
    'CORRECTED 2026-08-12: this entry first said it was "the placeholder of the input a user ' +
    'TYPES a vault key name into". That is false at both call sites and I wrote it from two ' +
    'agents agreeing rather than from the file. VaultEditorDialog.tsx:281 is a ComboboxInput ' +
    'that is `disabled` with `value={row.key}` always set, so its placeholder can never ' +
    'render at all; :301 is a <SelectValue> inside a <Select>, where the user PICKS from a ' +
    'list. Nothing is typed anywhere. The conclusion was right and only the reason was ' +
    'wrong, which is this programme\'s commonest defect and leaves no trace downstream.',

  '*:strings:runs.estimatedCost':
    'Format string "≈ ${{amount}}" — an approximation sign, a currency symbol and a ' +
    'placeholder, so there is no word to translate. A locale that writes its currency ' +
    'differently should be a per-locale entry, not a change to this one.',
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

/**
 * locale -> namespace -> key -> why this pair is excused from the length-ratio
 * check, e.g. a legal formula with no shorter defensible rendering in that
 * language. Empty until a locale needs one — `legal:cookies` in Russian has
 * passed on its own so far, but German and Italian legal text is not
 * guaranteed the same luck.
 *
 * The reason is not decoration: an entry whose reason is empty or blank
 * throws at module load, because an unexplained exemption is indistinguishable
 * from a mistake, which is the entire reason this mechanism is allowed to
 * exist. See the validation loop below.
 */
export const LENGTH_EXEMPTIONS = {};

for (const [locale, namespaces] of Object.entries(LENGTH_EXEMPTIONS)) {
  for (const [namespace, keys] of Object.entries(namespaces)) {
    for (const [key, reason] of Object.entries(keys)) {
      if (!reason || !reason.trim()) {
        throw new Error(
          `LENGTH_EXEMPTIONS.${locale}.${namespace}.${key} has no reason — an unexplained ` +
            `length exemption is indistinguishable from a mistake.`,
        );
      }
    }
  }
}

/** 4. Length sanity. An exempt pair (see LENGTH_EXEMPTIONS) is skipped. */
export function lengthOffenders(pairs, locale, exemptions = LENGTH_EXEMPTIONS[locale] ?? {}) {
  const offenders = [];
  for (const pair of pairs) {
    if (exemptions[pair.namespace]?.[pair.key]) continue;
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

// ---------------------------------------------------------------------------
// Used keys in source
// ---------------------------------------------------------------------------
//
// Everything above compares locale files against EACH OTHER, so none of it can
// see a key that is deleted from every locale at once while components still
// reference it — parity stays perfect and i18next renders the raw key name at
// runtime (e.g. the bulk bar showing "toTranslateCount" instead of "12 to
// translate"). The rules below scan the frontend source for statically
// analysable `t('…')` calls and check each referenced key against the reference
// namespace, which is the only direction that catches a delete or a rename.
//
// Scope (deliberately conservative, to stay false-positive free):
// - Only `const` destructurings of a `useTranslation('ns')` call with a single
//   single-quoted namespace literal are tracked, and only when `t` is among the
//   destructured properties — as `t` or renamed, `t: tName`. Array namespaces,
//   `keyPrefix` options, dynamically chosen namespaces, `let`/`var` bindings and
//   double-quoted namespaces are all skipped.
// - A SIBLING DESTRUCTURED PROPERTY DOES NOT DEFEAT THE MATCH. It used to:
//   the rule was written as a single regex requiring `{ t }` or `{ t: name }`
//   and nothing else between the braces, so `const { t, i18n } =
//   useTranslation('ns')` — a form seven components use, between them holding
//   160 call sites, including StringTableRow and ComparisonGrid — was invisible
//   to the guard entirely. A key deleted from every locale while those files
//   still referenced it shipped. Properties are now split on commas and matched
//   individually, so order does not matter (`{ i18n, t }` is the same binding)
//   and the count of siblings does not either.
//   Siblings must still each be a plain identifier, optionally renamed. That
//   keeps out the forms whose meaning is not obvious from a regex — a rest
//   element, a default value, a nested pattern — where `t` might not be the
//   translate function at all; those skip the whole binding rather than guess.
// - Within one file, a binding name mapped to two different namespaces is
//   ambiguous and skipped entirely.
// - Only single-quoted literal keys are checked; template literals and
//   variables are skipped. Keys with an explicit `ns:` prefix are skipped.
// - A key counts as present if the exact key exists or any plural/ordinal
//   suffix variant of it exists (i18next resolves `key` → `key_one` etc.).
//
// Every one of those restrictions is load-bearing. This rule fails CI in the
// repository where frontend PRs are raised, so a false positive reddens correct
// code and gets the rule deleted rather than debugged. Widen it only with a
// reason as concrete as the ones above — the sibling-property widening was
// justified by seven measured files and re-verified at zero offenders over the
// whole tree before it landed.

/** File extensions the source sweep reads. */
export const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

/**
 * Directories the walk never descends into.
 *
 * This sweep used to be a Vite `import.meta.glob` rooted at the frontend's
 * `src/`, a base directory that already excluded the first two by containing
 * neither. A filesystem walk has no such base, and pointing it one
 * directory higher by accident would make it read a package's `node_modules` —
 * so the exclusions are written down rather than assumed. `__tests__` is
 * excluded on purpose too: a fixture calling `t('deliberately.missing')` is not
 * a shipping defect.
 */
export const SOURCE_SKIP_DIRS = new Set(['node_modules', 'dist', '__tests__']);

/**
 * Every source file under `srcDir`, as `path -> text`.
 *
 * Entries are inserted in sorted order so two runs report findings in the same
 * sequence; readdirSync's own order is filesystem-dependent.
 */
export function readSourceFiles(srcDir) {
  const files = new Map();
  const walk = (dir) => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    );
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SOURCE_SKIP_DIRS.has(entry.name)) walk(full);
      } else if (entry.isFile() && SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
        files.set(full, readFileSync(full, 'utf8'));
      }
    }
  };
  walk(srcDir);
  return files;
}

/**
 * Suffixes that satisfy a lookup of the BARE key, because i18next appends them
 * itself when a `count` is passed.
 *
 * Deliberately NOT expressed through splitPluralKey(): that function answers
 * the opposite question (given a key on disk, what family is it in?) and knows
 * nothing of the `_ordinal_` infix, so `key_ordinal_one` would reduce to the
 * base `key_ordinal` and a source reference to `key` would go unmatched. The
 * legacy `_plural` suffix is left out for the same reason it is a failure
 * elsewhere: under the v4 JSON format it is never looked up, so it cannot make
 * a bare key resolve.
 */
export const BARE_KEY_SUFFIXES = CLDR_CATEGORIES.flatMap((category) => [
  `_${category}`,
  `_ordinal_${category}`,
]);

export function namespaceHasKey(nsKeySet, key) {
  if (nsKeySet.has(key)) return true;
  return BARE_KEY_SUFFIXES.some((suffix) => nsKeySet.has(`${key}${suffix}`));
}

/**
 * A `const { … } = useTranslation('ns')` statement, capturing the destructured
 * property list and the namespace.
 *
 * The property list is `[^{}]*`, which cannot cross a brace in either
 * direction — so the match can never span from one statement's `const {` to a
 * later statement's `}`, and a nested destructuring pattern fails to match at
 * all rather than matching half of itself. What it CAN cross is a newline,
 * which is deliberate: a multi-line destructuring is the same binding.
 */
const BINDING_RE = /const\s*\{\s*([^{}]*?)\s*\}\s*=\s*useTranslation\(\s*'([\w-]+)'\s*\)/g;

/** The destructured translate function: `t`, or renamed as `t: tName`. */
const T_PROPERTY_RE = /^t(?:\s*:\s*(\w+))?$/;

/**
 * A destructured property this rule understands: a plain identifier, optionally
 * renamed to another identifier. One property that does not fit — a rest
 * element, a default value, a computed key — skips the whole binding, because
 * those are the forms where `t` may not be what it looks like.
 */
const SIMPLE_PROPERTY_RE = /^\w+(?:\s*:\s*\w+)?$/;

/** Extracts binding-name -> namespace for one file; drops ambiguous names. */
export function extractBindings(source) {
  const bindings = new Map();
  const ambiguous = new Set();
  for (const match of source.matchAll(BINDING_RE)) {
    const properties = match[1]
      .split(',')
      .map((property) => property.trim())
      .filter((property) => property !== ''); // a trailing comma is legal
    if (!properties.every((property) => SIMPLE_PROPERTY_RE.test(property))) continue;

    // `{ i18n: t }` binds the i18n INSTANCE to the name `t`, so the property has
    // to be matched on its key, not on the name it introduces.
    const tProperty = properties.find((property) => T_PROPERTY_RE.test(property));
    if (!tProperty) continue;

    const name = T_PROPERTY_RE.exec(tProperty)[1] ?? 't';
    const namespace = match[2];
    if (bindings.has(name) && bindings.get(name) !== namespace) ambiguous.add(name);
    bindings.set(name, namespace);
  }
  for (const name of ambiguous) bindings.delete(name);
  return bindings;
}

/**
 * The statically analysable `t()` call sites in one file's text, as
 * `{ namespace, key }` — pure, so the scoping rules above can be pinned by a
 * test without a filesystem.
 *
 * Duplicates are kept: two call sites for the same missing key are two things
 * to fix, and collapsing them here would hide the second one from the report.
 */
export function usedKeysInSource(source) {
  const used = [];
  for (const [name, namespace] of extractBindings(source)) {
    // `name('key'` not preceded by an identifier char or `.` (avoids matching
    // e.g. `format('x')` when the binding is named `t`).
    const callRe = new RegExp(`(?<![\\w.$])${name}\\(\\s*'([^']+)'`, 'g');
    for (const call of source.matchAll(callRe)) {
      const key = call[1];
      if (key.includes(':')) continue; // explicit ns override — out of scope
      used.push({ namespace, key });
    }
  }
  return used;
}

/**
 * The smallest source-file count that means the sweep actually ran.
 *
 * Exported so the CLI and the vitest guard share ONE number: two hardcoded
 * floors are two things to keep in step, and the one that drifts low is the one
 * that stops protecting anything. The frontend has ~250 files, so this is a
 * "did the walk find the tree at all" floor, not a growth assertion — it should
 * not be raised as the app grows.
 */
export const MIN_SOURCE_FILES = 100;

/**
 * The smallest number of tracked `t` bindings that means the MATCHER still
 * works, as opposed to the walk.
 *
 * MIN_SOURCE_FILES catches a sweep that read nothing. It cannot catch the
 * other silent failure, where the files are all read and the binding matcher
 * stops recognising them: offenders go empty, `filesScanned` is unchanged, and
 * both callers report success while covering nothing. Every way that can happen
 * is realistic — an idiom shift in how components call `useTranslation`, an edit
 * to the property rules that narrows them too far, and the one this rule's own
 * shape creates: a file pairing `{ t }` for one namespace with `{ t, i18n }` for
 * a DIFFERENT one makes the name `t` ambiguous, and the binding is dropped
 * rather than reported.
 *
 * 100 against 124 tracked today. What this floor is and is not:
 *
 *  - It catches a COLLAPSE — a matcher that stops matching, or a repo-wide
 *    change of idiom. That is the failure that would otherwise never be noticed.
 *  - It does NOT catch a drip: one new ambiguous file costs one binding, and no
 *    floor can see that without tripping on ordinary refactoring. The semantics
 *    of that case are pinned by a unit test instead, and this constant is not a
 *    substitute for it.
 *
 * Do not raise it to today's exact count to catch smaller drops — a floor that
 * reddens a normal refactor gets deleted, and then nothing is watching at all.
 * If a deliberate change genuinely lowers the real count, lower this WITH the
 * reason, rather than removing the assertion as redundant.
 */
export const MIN_TRACKED_BINDINGS = 100;

/**
 * Keys referenced in source but absent from the reference locale, as
 * `path: "ns:key"` ids, plus how many files were read.
 *
 * Paths are reported RELATIVE to `srcDir`. The absolute path is noise everywhere
 * and actively unhelpful in CI, where it names the runner's checkout directory
 * (`/home/runner/work/app-narn/app-narn/…`) rather than anything the reader can
 * paste.
 *
 * `filesScanned` and `bindingsTracked` are returned rather than logged because
 * an empty offender list means either "nothing is wrong" or "nothing was
 * looked at", and the two are indistinguishable from the outside. Both callers
 * assert both counts against MIN_SOURCE_FILES and MIN_TRACKED_BINDINGS, so a
 * walk that finds no files and a matcher that recognises no bindings each go
 * red instead of green.
 */
export function missingUsedKeys(locales, srcDir, referenceLocale = REFERENCE_LOCALE) {
  const reference = locales.get(referenceLocale);
  if (!reference) throw new Error(`Reference locale "${referenceLocale}" not found`);

  /** namespace -> set of flattened reference keys */
  const referenceKeys = new Map();
  for (const [namespace, data] of reference) {
    referenceKeys.set(namespace, new Set(flattenKeys(data)));
  }

  const sources = readSourceFiles(srcDir);
  const offenders = [];
  let bindingsTracked = 0;
  for (const [absolutePath, source] of sources) {
    const path = relative(srcDir, absolutePath);
    const bindings = extractBindings(source);
    bindingsTracked += bindings.size;
    // Reported per BINDING, not per call site, so a file that names a namespace
    // with no locale file is caught even when every key it passes is dynamic.
    for (const [, namespace] of bindings) {
      if (referenceKeys.has(namespace)) continue;
      offenders.push(`${path}: namespace "${namespace}" has no ${referenceLocale} locale file`);
    }
    for (const { namespace, key } of usedKeysInSource(source)) {
      const nsKeySet = referenceKeys.get(namespace);
      if (!nsKeySet) continue; // already reported above; one defect, one finding
      if (!namespaceHasKey(nsKeySet, key)) offenders.push(`${path}: "${namespace}:${key}"`);
    }
  }
  return { offenders, filesScanned: sources.size, bindingsTracked };
}
