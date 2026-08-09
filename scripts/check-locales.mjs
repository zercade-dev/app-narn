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
 * Severity split, matching the rules module:
 *   FAIL   key parity, value integrity, and the self-checks that prove the run
 *          actually compared something.
 *   REPORT plural-category coverage gaps and legacy i18next v3 `_plural` keys —
 *          i18next falls back to `_other` or the bare key for both, and today's
 *          shipped files carry them. `LOCALE_PARITY_STRICT` promotes the
 *          coverage gaps to failures for a chosen locale, so a backfill can hold
 *          ITS locale to the full category set without reddening the rest.
 *
 * A summary line is printed even on success, including how many values were
 * compared: a green run that compared nothing is the failure mode this whole
 * check exists to prevent, so the number has to be visible in the log.
 */
import { fileURLToPath } from 'node:url';
import {
  REFERENCE_LOCALE,
  STRICT_ENV,
  collectCoverageGaps,
  collectLegacyPluralKeys,
  doNotTranslateOffenders,
  formatCoverageGap,
  identicalValueOffenders,
  invalidLeafValues,
  isStrictFor,
  keyOrderOffenders,
  lengthOffenders,
  loadLocales,
  localePluralErrors,
  namespaceDiff,
  namespaceKeyDiff,
  pairsFor,
  placeholderOffenders,
  staleAllowlistKeys,
  summarizeCoverageGap,
  thinAllowlistReasons,
  uncomparedNamespaces,
} from './locale-rules.mjs';

// Resolved from this script's own location, not cwd, so `node scripts/…` and
// `pnpm check:locales` from anywhere in the workspace read the same tree. Plain
// Node runs this file directly, so `import.meta.url` is a real `file:` URL here
// (which is exactly why the rules module refuses to depend on that).
const LOCALES_DIR = fileURLToPath(new URL('../packages/frontend/src/locales', import.meta.url));

const locales = loadLocales(LOCALES_DIR);
const allLocales = [...locales.keys()].sort();
const reference = locales.get(REFERENCE_LOCALE);
if (!reference) {
  console.error(`check-locales: reference locale "${REFERENCE_LOCALE}" not found`);
  process.exit(1);
}
const targetLocales = allLocales.filter((locale) => locale !== REFERENCE_LOCALE);

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

  const { missing } = namespaceDiff(locales, locale);
  fail(
    `${locale}: missing namespace files`,
    missing.map((namespace) => `${namespace}.json is present in ${REFERENCE_LOCALE} only`),
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

// --- Reported-only findings ------------------------------------------------
const coverageGaps = collectCoverageGaps(locales);
const legacyPlurals = collectLegacyPluralKeys(locales);

// Headlines only: the family lists run to hundreds of lines on today's files
// and would bury the verdict. `LOCALE_PARITY_STRICT` prints them in full,
// because there they are a failure someone has to act on.
if (coverageGaps.length > 0) {
  console.log(
    `check-locales: NOTE — plural-category coverage gaps (non-fatal, i18next falls back to "_other"):`,
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

// A dead `_plural` key is tolerable only because something else still renders:
// the bare key, or `_other`. With neither, the UI shows a raw i18next key.
fail(
  'legacy "_plural" families with no bare "key" and no "_other" fallback (they render a raw key)',
  legacyPlurals.withoutFallback,
);

// Opt-in only, so the check stays green on today's shipped files while a
// backfill can hold ITS locale to the language's full category set.
const enforcedGaps = coverageGaps.filter((gap) => isStrictFor(gap.locale));
fail(
  `plural-category gaps, promoted to failures by LOCALE_PARITY_STRICT="${STRICT_ENV}"`,
  enforcedGaps.map(formatCoverageGap),
);

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

console.log(
  `check-locales: OK — ${allLocales.length} locales, ${namespaceCount} namespaces, ` +
    `${valuesCompared} values compared`,
);
