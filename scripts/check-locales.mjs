#!/usr/bin/env node
/**
 * Locale parity and integrity check.
 *
 *   node scripts/check-locales.mjs        (usually via `pnpm check:locales`)
 *
 * Runs every rule in scripts/locale-rules.mjs over packages/frontend/src/locales
 * and exits non-zero on any hard failure. CI gates on it, so an English key added
 * with no translations is caught where the change is raised rather than
 * somewhere downstream.
 *
 * It also scans the frontend source for statically analysable `t('…')` calls, so
 * a key deleted or renamed in every locale at once — which every locale-to-locale
 * rule here is blind to, parity being perfect — fails where the deletion is made
 * rather than on a later gitlink bump.
 *
 * Severity split, matching the rules module:
 *   FAIL   key parity, value integrity, a key referenced in source but absent
 *          from the reference locale, the self-checks that prove the run
 *          actually compared something, and a plural category the locale does
 *          not supply with no bare `key` sibling to catch it — that renders
 *          ENGLISH mid-sentence, measured, not a grammar nicety. See
 *          missingPluralCategories() in the rules module.
 *   REPORT a coverage gap a bare `key` sibling rescues, a gap in a locale
 *          grandfathered for that category (es/fr `many` — exact millions
 *          only), and the legacy i18next v3 `_plural` inventory.
 *          `LOCALE_PARITY_STRICT` promotes ALL of a locale's gaps, including
 *          the forgiven ones, so a backfill can hold ITS locale to the full
 *          category set without reddening the rest.
 *   DEFER a locale declared in WIP_LOCALES is mid-backfill, so the namespace
 *          files it has not created yet are counted and printed rather than
 *          failed. That ONE rule and nothing else: every other check applies to
 *          it in full, including values identical to English, because they are
 *          all scoped to the namespaces it does have. LOCALE_PARITY_STRICT is
 *          unaffected either way, and a declaration that has stopped deferring
 *          anything is itself a failure. See WIP_LOCALES in the rules module.
 *
 * A summary line is printed even on success, including how many values were
 * compared: a green run that compared nothing is the failure mode this whole
 * check exists to prevent, so the number has to be visible in the log.
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CLDR_CATEGORIES,
  MIN_SOURCE_FILES,
  MIN_TRACKED_BINDINGS,
  REFERENCE_LOCALE,
  collectCoverageGaps,
  collectLegacyPluralKeys,
  collectWipDeferrals,
  describeEnforcedGap,
  describeWipLocale,
  doNotTranslateOffenders,
  enforcedCoverageGapFamilies,
  enforcedForWipLocale,
  formatCoverageGap,
  identicalValueOffenders,
  invalidLeafValues,
  keyOrderOffenders,
  lengthOffenders,
  loadLocales,
  localePluralErrors,
  missingUsedKeys,
  namespaceDiff,
  namespaceKeyDiff,
  pairsFor,
  placeholderOffenders,
  staleAllowlistKeys,
  staleWipLocales,
  summarizeCoverageGap,
  thinAllowlistReasons,
  uncomparedNamespaces,
} from './locale-rules.mjs';

// Resolved from this script's own location, not cwd, so `node scripts/…` and
// `pnpm check:locales` from anywhere in the workspace read the same tree. Plain
// Node runs this file directly, so `import.meta.url` is a real `file:` URL here
// (which is exactly why the rules module refuses to depend on that).
const FRONTEND_SRC_DIR = fileURLToPath(new URL('../packages/frontend/src', import.meta.url));
const LOCALES_DIR = join(FRONTEND_SRC_DIR, 'locales');

const locales = loadLocales(LOCALES_DIR);
const allLocales = [...locales.keys()].sort();
const reference = locales.get(REFERENCE_LOCALE);
if (!reference) {
  console.error(`check-locales: reference locale "${REFERENCE_LOCALE}" not found`);
  process.exit(1);
}
/** Hard failures, as `[heading, lines]` blocks in discovery order. */
const failures = [];
const usedAllowlistKeys = new Set();
let valuesCompared = 0;

function fail(heading, lines) {
  if (lines.length > 0) failures.push([heading, lines]);
}

// --- The locale set itself -------------------------------------------------
// Not a hardcoded list anywhere, so the one thing worth asserting is that the
// discovery found something: a glob or a path that stopped matching would
// otherwise leave every rule below comparing nothing, silently.
if (!allLocales.includes(REFERENCE_LOCALE) || allLocales.length < 3) {
  fail('locale discovery', [
    `expected "${REFERENCE_LOCALE}" plus at least two translations, found: ${
      allLocales.join(', ') || '(nothing)'
    }`,
  ]);
}

// --- Per-locale rules ------------------------------------------------------
for (const locale of allLocales) {
  const invalid = invalidLeafValues(locales, locale);
  fail(`${locale}: invalid leaf values`, invalid);
  fail(`${locale}: invalid plural keys`, localePluralErrors(locales, locale));

  if (locale === REFERENCE_LOCALE) continue;

  // BOTH directions. The key-diff loop below walks the REFERENCE's namespaces,
  // so a namespace this locale has and the reference does not is never opened
  // by any rule — reporting the file here is the only thing that sees it.
  const { missing, extra } = namespaceDiff(locales, locale);
  fail(
    `${locale}: missing namespace files`,
    // Deferred for a work-in-progress locale — those are the batches it has not
    // reached yet. `extra` below is NOT deferred: a namespace with no English
    // counterpart is a stale or misnamed file at every point in a backfill.
    enforcedForWipLocale(
      locale,
      missing.map((namespace) => `${namespace}.json is present in ${REFERENCE_LOCALE} only`),
    ),
  );
  fail(
    `${locale}: unexpected namespace files`,
    extra.map(
      (namespace) =>
        `${namespace}.json has no ${REFERENCE_LOCALE} counterpart — nothing compares its ` +
        `contents, so it is either a stale file left behind by a rename or a namespace ` +
        `${REFERENCE_LOCALE} is missing`,
    ),
  );

  const keyDiffs = [];
  for (const namespace of [...reference.keys()].sort()) {
    const diff = namespaceKeyDiff(locales, locale, namespace);
    if (diff.missing.length > 0) {
      keyDiffs.push(`${namespace}: missing ${diff.missing.join(', ')}`);
    }
    if (diff.extra.length > 0) {
      keyDiffs.push(`${namespace}: extra (not in ${REFERENCE_LOCALE}) ${diff.extra.join(', ')}`);
    }
  }
  fail(`${locale}: key parity`, keyDiffs);

  const pairs = pairsFor(locales, locale);
  valuesCompared += pairs.length;

  fail(`${locale}: placeholder integrity`, placeholderOffenders(pairs, locale));
  fail(`${locale}: do-not-translate terms`, doNotTranslateOffenders(pairs, locale));
  // NOT deferred for a work-in-progress locale, deliberately. pairsFor() only
  // yields pairs for namespaces the locale HAS, so a mid-backfill language has
  // no false positives here to suppress — every hit is a value someone copied
  // through from English inside a namespace they did translate, and it is
  // cheapest to fix in the batch that wrote it.
  fail(`${locale}: values identical to ${REFERENCE_LOCALE}`, [
    ...identicalValueOffenders(pairs, locale, usedAllowlistKeys),
  ]);
  fail(`${locale}: length sanity`, lengthOffenders(pairs, locale));
  fail(`${locale}: key order`, keyOrderOffenders(locales, locale));
  fail(
    `${locale}: namespaces where nothing was compared`,
    uncomparedNamespaces(locales, locale),
  );
}

// --- Allowlist hygiene -----------------------------------------------------
// Runs after every locale, so `usedAllowlistKeys` is complete. A suppression
// whose value has since been translated is dead weight that would hide the next
// regression on that key.
fail(
  'stale IDENTICAL_ALLOWLIST entries (the value was translated, renamed or removed — delete them)',
  staleAllowlistKeys(usedAllowlistKeys),
);
fail('IDENTICAL_ALLOWLIST entries needing a real reason, not a word', thinAllowlistReasons());

// --- Work-in-progress locales ----------------------------------------------
// Printed on every run, green or red, because a deferral nobody can see is a
// weakened gate nobody can see. The stale check below is the other half: a
// declaration that has stopped deferring anything names a locale whose last
// namespace has landed, so the run that completes it is the run that demands
// the entry be deleted.
const wipDeferrals = collectWipDeferrals(locales);
const wipLocales = [...wipDeferrals.keys()];

if (wipLocales.length > 0) {
  console.log(
    `check-locales: NOTE — ${wipLocales.length} locale(s) declared work-in-progress. The ` +
      `namespace files they have not created yet are NOT checked; every other rule is, ` +
      `including values identical to ${REFERENCE_LOCALE}:`,
  );
  console.log(
    wipLocales.map((locale) => describeWipLocale(locale, wipDeferrals.get(locale))).join('\n'),
  );
}

fail(
  'WIP_LOCALES entries that defer nothing (every namespace has landed — delete them)',
  staleWipLocales(locales, wipDeferrals),
);

// --- Keys referenced in source ---------------------------------------------
// The one rule here that does NOT compare locales against each other, and so
// the only one that can see a key deleted or renamed in every locale at once
// while a component still calls t('key'). Parity is perfect in that case and
// i18next renders the raw key path on screen.
const usedKeys = missingUsedKeys(locales, FRONTEND_SRC_DIR);
fail(
  `keys referenced in source but missing from ${REFERENCE_LOCALE}` +
    ` (i18next would render the raw key)`,
  usedKeys.offenders,
);

// A sweep that read nothing reports no offenders, which looks exactly like a
// clean run. So does a sweep that read everything and recognised no t()
// bindings in it. Both counts are asserted here and printed in the summary
// below; see MIN_SOURCE_FILES / MIN_TRACKED_BINDINGS for what each defends.
if (usedKeys.filesScanned < MIN_SOURCE_FILES) {
  fail('source sweep', [
    `only ${usedKeys.filesScanned} source file(s) found under ${FRONTEND_SRC_DIR}, ` +
      `expected at least ${MIN_SOURCE_FILES} — the used-key rule compared almost nothing, ` +
      `so its green result means nothing`,
  ]);
}
if (usedKeys.bindingsTracked < MIN_TRACKED_BINDINGS) {
  fail('used-key binding coverage', [
    `only ${usedKeys.bindingsTracked} t() binding(s) tracked across ${usedKeys.filesScanned} ` +
      `file(s), expected at least ${MIN_TRACKED_BINDINGS} — the files were read but the ` +
      `binding matcher recognised almost nothing in them, so the empty offender list above ` +
      `means "nothing was checked", not "nothing is wrong"`,
  ]);
}

// --- Plural-category coverage ----------------------------------------------
const coverageGaps = collectCoverageGaps(locales);
const legacyPlurals = collectLegacyPluralKeys(locales);

// Headlines only: the family lists run to hundreds of lines on today's files
// and would bury the verdict. The enforced subset is printed in full below,
// because those are a failure someone has to act on.
if (coverageGaps.length > 0) {
  console.log(
    `check-locales: NOTE — plural-category coverage (a gap with no bare "key" sibling ` +
      `renders English for those counts):`,
  );
  console.log(coverageGaps.map(summarizeCoverageGap).join('\n'));
}

if (legacyPlurals.keys.length > 0) {
  console.log(
    `check-locales: NOTE — ${legacyPlurals.keys.length} legacy i18next v3 "_plural" key(s). ` +
      `The app uses the v4 JSON format, which looks up "key_<category>" then the bare "key" and ` +
      `never "key_plural", so the singular renders for every count:`,
  );
  console.log(`  ${legacyPlurals.keys.join('\n  ')}`);
}

// The reported-only findings are not asserted — they are what they are — but the
// report itself must be well-formed: every category it names is a real CLDR
// category. A bogus one means the rules, not the content, are wrong.
fail(
  'coverage report names something that is not a CLDR plural category',
  coverageGaps
    .filter((gap) => !CLDR_CATEGORIES.includes(gap.category))
    .map((gap) => `${gap.locale}: "_${gap.category}"`),
);

// A dead `_plural` key is tolerable only if a bare `key` sibling still renders.
// Without one the UI shows English, or a raw key with no fallback language.
fail(
  'legacy "_plural" families with no bare "key" sibling (nothing of their own renders)',
  legacyPlurals.withoutFallback,
);

// A missing plural category is a FAILURE by default. Only three things forgive
// one, all in enforcedCoverageGapFamilies(): a bare `key` sibling that catches
// it, a grandfathered locale+category, and LOCALE_PARITY_STRICT going the other
// way and forgiving nothing.
for (const gap of coverageGaps) {
  const enforced = enforcedCoverageGapFamilies(gap);
  if (enforced.length === 0) continue;
  fail(describeEnforcedGap(gap, enforced), formatCoverageGap(gap, enforced).split('\n'));
}

// --- Verdict ---------------------------------------------------------------
const namespaceCount = reference.size;

if (failures.length > 0) {
  console.error('');
  for (const [heading, lines] of failures) {
    console.error(`check-locales: FAIL — ${heading}`);
    for (const line of lines) console.error(`  ${line}`);
  }
  const total = failures.reduce((sum, [, lines]) => sum + lines.length, 0);
  console.error('');
  console.error(
    `check-locales: FAILED — ${total} finding(s) across ${failures.length} rule(s). ` +
      `Locales: ${allLocales.join(', ')}.`,
  );
  process.exit(1);
}

// The work-in-progress clause is appended only when there is one, so the line a
// repository with no backfill in flight prints is exactly the line it printed
// before this mechanism existed.
console.log(
  `check-locales: OK — ${allLocales.length} locales, ${namespaceCount} namespaces, ` +
    `${valuesCompared} values compared, ${usedKeys.filesScanned} source files scanned, ` +
    `${usedKeys.bindingsTracked} t() bindings tracked` +
    (wipLocales.length > 0
      ? `, ${wipLocales.length} work-in-progress (${wipLocales.join(', ')}) — incomplete on ` +
        `purpose, see the NOTE above`
      : ''),
);
