#!/usr/bin/env node
/**
 * The scripted pre-flight a translator runs before handing a batch to
 * review — not before shipping the whole language, before every batch.
 *
 *   node scripts/i18n-preflight.mjs <locale>   (e.g. `node scripts/i18n-preflight.mjs ru`)
 *
 * This exists because of one measured fact, recorded in
 * `docs/i18n/backfill-notes.md` section 3 and `docs/i18n/backfill-runbook.md`
 * section 4: reviewer-rubric item 1 — "for every `{{token}}` followed by a
 * counted noun, open the call site" — found BOTH numeral-agreement criticals
 * in the Russian pilot's first two batches and NOTHING afterwards, because
 * from batch three on the translator ran a detector before committing. It is
 * a check, not a judgement, so it belongs here, before review — not as a
 * reviewer's line item. See the reviewer-rubric table in
 * backfill-runbook.md's "The reviewer rubric" section for the demotion and
 * its evidence.
 *
 * Four checks, run in this file in this order:
 *
 *   1. Numeral agreement — token axis, then a word axis derived ONLY from
 *      what survives the token axis (see below — the per-occurrence checks
 *      are commutative, the derivation is not).
 *   1b. Welded suffix — a grammatical suffix written directly against a
 *      token, with no whitespace, in a locale whose orthography chooses
 *      that suffix by the (unknown-until-runtime) interpolated value's
 *      final sound. Scoped to WELDED_SUFFIX_LOCALES (`tr` only, so far) —
 *      see that constant's comment for why this is a separate check from
 *      1 rather than a widened gap on it, and why it does not run
 *      everywhere. Added 2026-08-11: check 1's whitespace-only gap could
 *      not see this construction at all (`{{model}}'i` produced 0 raw
 *      matches), which is the defect that motivated it.
 *   2. Both collision directions over the whole flattened locale. Report
 *      only: both directions have legitimate hits (a deliberately reused
 *      rendering; a genuine English defect), and it is the translator's job
 *      to say which, not this script's.
 *   3. The `bare + _other` family list, computed from the ENGLISH source —
 *      it is a property of English, not a per-language discovery, so every
 *      locale brief carries the same twelve.
 *
 * Checks 1 and 1b gate the exit code. Checks 2 and 3 are report-only by
 * design (backfill-notes.md's "Mechanical checks to run before review"
 * section, items 3-4, and backfill-runbook.md's "the mechanical checks"
 * list, items 3-4): a collision needs a human explanation, not a fixed
 * threshold, and the family list is the same twelve regardless of which
 * locale is named on the command line — failing a build over it would be
 * failing on a fact about English, which no locale batch can fix.
 *
 * ---------------------------------------------------------------------------
 * CALIBRATION — read before touching NUMERAL_TOKEN_SKIPLIST or
 * NUMERAL_WORD_AXIS_EXEMPTIONS.
 *
 * `node scripts/i18n-preflight.mjs ru` is the acceptance test for check 1.
 * Over the 24 shipped namespaces, counting every place where a `{{token}}`
 * is followed by whitespace and then a word in the locale's own script (the
 * "narrow" rule — see numeralAgreementRegex): **187 raw occurrences, 19
 * survive the token-axis skip below, 0 survive the word axis too.** Verified
 * against BOTH the 2,025-key Russian corpus docs/i18n/backfill-notes.md and
 * docs/i18n/backfill-runbook.md were originally measured against (commit
 * `e7fe56d`) and the current 2,002-key corpus — a later reachability sweep
 * (commits `2202e64` / `b4bf722`) removed 23 dead keys from every locale
 * after those documents were written, and none of the removed keys had a
 * narrow-rule match, so this figure is identical in both states. All three
 * source documents (docs/i18n/style/ru.md "Checking your own work for
 * numeral agreement", and the two above) state the same 187/0 figure and the
 * same 22-token skip list verbatim (23 before `languages` was removed — see
 * NUMERAL_TOKEN_SKIPLIST's own comment. That removal does not move this
 * figure: none of ru's `{{languages}}` occurrences ever sat directly against
 * a script-class word in the shipped strings, so they were never part of
 * the 187 to begin with).
 *
 * WHY THE TOKEN AXIS RUNS BEFORE THE WORD AXIS — and why that is NOT about
 * evaluation order. Per occurrence, checking the token or the word first
 * gives the same verdict: for one fixed pair of lists, "skip if token in
 * skiplist, else skip if word in exemptlist" is a plain logical OR, and OR
 * is commutative — a reviewer proved this directly. What actually depends
 * on the order is how NUMERAL_WORD_AXIS_EXEMPTIONS gets BUILT: it must be
 * derived only from occurrences that already survived the token axis (the
 * 19 for ru), never from the raw 187. A list built from the raw set is
 * contaminated by legitimate `{{count}}`-driven agreement — a real counted
 * noun like «записи» recurs constantly and correctly after `{{count}}`,
 * whose own family already carries plural forms for it — and once such a
 * word is exempted, it is exempted after every token, including a
 * non-`count` one it has no business covering. Building ru's list from the
 * raw 187 instead of the 19 produces 32 exempted words instead of 6, and
 * that list absorbs `записи` outright, so an injected `{{orphanCount}}
 * записи` defect (exactly the class this detector exists to catch) passes
 * silently. `numeralAgreementCheck()` checks `tokenSkip` before
 * `wordExempt` in its loop below for this reason: not because the check
 * order changes any single verdict, but because NUMERAL_WORD_AXIS_EXEMPTIONS
 * must only ever be calibrated against post-token-axis survivors.
 *
 * THE LOOSE RULE, PRECISELY — this figure needed a correction, not just a
 * caveat. `looseNumeralAgreementRegex()` matches across intervening
 * whitespace, punctuation AND symbol characters (Unicode categories P and S
 * together — punctuation alone, category P only, gives 256 on the
 * historical corpus, one short). With P+S it reproduces exactly the
 * documented **257** over the 2,025-key corpus at commit `e7fe56d`. The one
 * occurrence punctuation-only matching misses is `review:overflowIssue`'s
 * "×" (a math symbol, not punctuation under Unicode's own category split)
 * sitting immediately before a preposition. Over the current 2,002-key
 * corpus the same P+S rule gives 255 — a delta of **2** from the
 * reachability sweep, not 3. (An earlier version of this comment used
 * punctuation-only matching, got 254, and blamed the entire 3-occurrence
 * gap on the sweep — conflating a pre-existing category-boundary question
 * with the sweep's smaller, real effect. Right total, wrong reason; caught
 * by checking out the historical commit and re-deriving the rule against it
 * directly instead of trusting the arithmetic.) The loose rule stays
 * informational only (printed, never gates the exit code): it is the more
 * fragile of the two figures to keep exactly reproducible.
 *
 * WORD-AXIS EXEMPTIONS ARE PER LOCALE AND START EMPTY. Only `ru`'s are
 * populated below, derived from the 19 token-axis survivors (never from the
 * raw 187 — see above): three invariant prepositions (из, с, на), two
 * invariant abbreviations (симв, байт) and one impersonal participle used
 * as a status (вычитано) — precisely the three device classes
 * docs/i18n/backfill-runbook.md's "Only count triggers plural selection"
 * section and docs/i18n/style/ru.md describe. A locale with no entry here
 * simply gets every token-axis survivor printed as a candidate — see "What
 * survives is a candidate, not a verdict" in backfill-runbook.md's "the
 * mechanical checks" list, item 1. That is correct, not a bug: nobody has
 * cleared that language's word axis yet.
 *
 * SCRIPT COVERAGE IS NOW EXPLICIT FOR EVERY LOCALE, NOT DEFAULTED. Earlier
 * versions of this file defaulted an unlisted locale's script to Latin, on
 * the reasoning that "es, fr and any future Latin-script locale need no
 * entry". That reasoning did not hold once the eleven remaining backfill
 * languages included five non-Latin scripts (ja, ko, th, zh-hans, zh-hant):
 * a locale nobody had added to NUMERAL_LOCALE_SCRIPTS silently matched
 * against Latin, found nothing (correctly — there is no Latin text to find),
 * and printed "No survivors" — identical output to a locale genuinely
 * checked and found clean. `NUMERAL_LOCALE_SCRIPTS` now lists every locale
 * this script may be invoked on (an array of scripts each, since Japanese
 * running text mixes Han/Hiragana/Katakana in one sentence), and a locale
 * missing from that map makes `runCli()` REFUSE — a distinct non-zero exit,
 * printed instead of a survivor count — rather than silently pass. The ru
 * figures above are unaffected: `ru` keeps its original single-script entry
 * and its whitespace-required gap, so 187/19/0 (and loose 255 on the current
 * corpus) are unchanged by this. What changed for scripts that do NOT put
 * spaces between words (`UNSPACED_SCRIPT_LOCALES` in locale-rules.mjs — ja,
 * ko, th, zh-hans, zh-hant) is `gapFor()`: the narrow rule's gap is
 * zero-or-more whitespace instead of one-or-more there, because real
 * Japanese/Chinese/Thai text puts the counted noun directly against the
 * placeholder's rendered value with no separator — a whitespace-required
 * gap would have kept the check a no-op for exactly those five languages
 * even after adding their scripts.
 * ---------------------------------------------------------------------------
 */
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  REFERENCE_LOCALE,
  UNSPACED_SCRIPT_LOCALES,
  classifyKeys,
  flattenEntries,
  flattenKeys,
  loadLocales,
  pairsFor,
  tokensOf,
} from './locale-rules.mjs';

// Resolved from this script's own location, not cwd — see check-locales.mjs's
// own comment for why (`node scripts/…` and `pnpm i18n:preflight` from
// anywhere in the workspace must read the same tree).
const APP_ROOT = fileURLToPath(new URL('..', import.meta.url));
const LOCALES_DIR = join(APP_ROOT, 'packages/frontend/src/locales');

// ---------------------------------------------------------------------------
// Check 1: numeral agreement
// ---------------------------------------------------------------------------

/**
 * Placeholders that cannot hold a number, so nothing that follows one can be
 * a numeral-agreement defect. Verbatim from docs/i18n/backfill-runbook.md's
 * "the mechanical checks" list item 1 and docs/i18n/backfill-notes.md's
 * "Mechanical checks" section item 1 — both name the same 22 tokens in the
 * same order; do not retype this list from memory, copy it from one of
 * those two files if it ever needs to change, and update whichever of the
 * two did not already move.
 *
 * `count` is included: it is the one token that DOES get CLDR plural
 * selection, so its own family already handles agreement and it would only
 * ever generate a false positive here.
 *
 * WHAT THIS LIST IS, AND WHAT IT IS NOT. Every entry is here because nobody
 * has found a call site anywhere in the app that binds it to a number —
 * that is an app-wide, per-token fact about this codebase's `t()` call
 * sites, checked by opening them, not a linguistic rule about what a
 * translator may write. It says nothing about which Turkish (or any other
 * language's) construction is grammatically correct next to a given token;
 * `docs/i18n/style/<lang>.md` owns that question for its own locale. Treat
 * a locale's style guide leaning on this list as "which count-neutral
 * rendering keeps the pre-flight green" as a documentation bug in *that*
 * file, not evidence this list should grow a grammar opinion.
 *
 * `languages` WAS ON THIS LIST AND IS NOT ANY MORE — 2026-08-11, a wave-1
 * defect report. It was calibrated against Russian's `count`/`countLabel`-
 * shaped corpus, where every `{{languages}}` interpolation is a
 * comma-joined list of language names. That is not true app-wide:
 * `config:templateMeta` ("{{languages}} languages · {{rules}} routing
 * rules") interpolates `template.config.activeLanguages.length` — a plain
 * count — from `GlobalConfigView.tsx`. Skipping `languages` here made that
 * key's numeral-agreement hazard invisible to every inflecting language,
 * which is most of them; Japanese survived it by accident (nothing
 * inflects there), and it was live for ru/de/tr along with the ten
 * languages still to come. Removing it does not change ru's calibration
 * (its own `{{languages}}` occurrences never sit directly against a
 * script-class word in the shipped strings — see the CALIBRATION section
 * below), and de/ja/tr were re-verified the same way when this was fixed.
 * The other 22 were checked the same way — by opening every `t()` call
 * site that passes each token, not by re-reading the names — and none of
 * them was wrong the same way: each is consistently a name, id, label,
 * timestamp or free-text field at every call site found.
 */
export const NUMERAL_TOKEN_SKIPLIST = [
  'count',
  'module',
  'instance',
  'language',
  'lang',
  'name',
  'message',
  'date',
  'verdict',
  'headers',
  'model',
  'keys',
  'slug',
  'type',
  'focus',
  'field',
  'why',
  'label',
  'filename',
  'id',
  'time',
  'passRate',
];

/**
 * The Unicode script(s) a locale's own words are written in, for the
 * word-half of the numeral-agreement match — matching a word in the WRONG
 * script would catch an embedded do-not-translate term (NARN, DeepL, API…)
 * rather than a genuine agreement hazard. An array because one locale can
 * mix scripts in ordinary running text — Japanese interleaves Han (kanji),
 * Hiragana and Katakana within a single sentence, so a check that only
 * looked at one of the three would silently miss the other two.
 *
 * EVERY locale this script can be invoked on MUST have an entry here.
 * There is deliberately no "defaults to Latin" fallback any more: that
 * default is what made this check a silent no-op for ja/ko/th/zh-hans/
 * zh-hant (raw: 0, survivors: 0 — indistinguishable from a locale that was
 * genuinely checked and found clean) while it happily gated the exit code
 * for languages it never looked at. `scriptsFor()` below throws for any
 * locale not listed here, and `runCli()` turns that into a refusal — a
 * non-zero exit that says the detector does not cover this locale — rather
 * than printing "No survivors." An untested language must never look like a
 * clean one. Adding a locale here is a claim that its script coverage is
 * correct, not a formality.
 */
export const NUMERAL_LOCALE_SCRIPTS = {
  en: ['Latin'],
  es: ['Latin'],
  fr: ['Latin'],
  ru: ['Cyrillic'],
  de: ['Latin'],
  id: ['Latin'],
  it: ['Latin'],
  'pt-br': ['Latin'],
  tr: ['Latin'],
  vi: ['Latin'],
  ja: ['Han', 'Hiragana', 'Katakana'],
  ko: ['Hangul'],
  th: ['Thai'],
  'zh-hans': ['Han'],
  'zh-hant': ['Han'],
};

/**
 * Word-axis exemptions, per locale, applied SECOND — see the calibration
 * comment above the module header for how ru's six were derived. Every
 * locale not listed here gets an empty word axis, which is correct: it means
 * every token-axis survivor is reported as an uncleared candidate rather
 * than silently passed.
 */
export const NUMERAL_WORD_AXIS_EXEMPTIONS = {
  ru: ['из', 'с', 'на', 'вычитано', 'симв', 'байт'],
  // de, derived from batch 2 (`strings`)'s post-token-axis survivors — 8 before
  // the usageTokens fix below, 6 after, carrying these 4 distinct words. Never
  // from the raw match set, per the calibration rule above.
  // `von` is a preposition; `entfernen` and `kopieren` are infinitives on control
  // labels; `markiert` is an invariant predicative participle. None of the four
  // can inflect for number, so a numeral in front of them is always grammatical.
  // The two survivors NOT on this list were a real defect and were fixed in the
  // string instead: `strings:runs.usageTokens` read "{{input}} Eingabe /
  // {{output}} Ausgabe", where both nouns would have had to pluralise.
  // `s` is the SI symbol for second, not a word: invariant for number by
  // definition, and German typography puts a space between the numeral and the
  // unit symbol (Duden, and SI itself). The batch that met it could have
  // cleared this detector for free by writing `{{seconds}}s` closed up, the way
  // English does, and escalated instead — which is the right call twice over,
  // since the welded form is wrong in German and "the guard went quiet" is not
  // a reason to write anything.
  de: ['von', 'entfernen', 'kopieren', 'markiert', 's'],
  // pt-br, derived from the whole-language sweep's post-token-axis survivors —
  // 109 raw narrow matches, 12 after the token axis, and all twelve are the same
  // word. Never from the raw match set, per the calibration rule above.
  // `de` is the preposition "of": invariant for number, gender and case in
  // Portuguese, and it is what every "X de Y" ratio frame puts after its first
  // token ("Página {{page}} de {{total}}", "{{current}} de {{total}}",
  // "Pontuação: {{score}} de 100"). A numeral in front of it is always
  // grammatical, so the twelve are cleared rather than rewritten. Nothing else
  // survived the token axis: the count-neutral device this locale uses
  // everywhere else (an invariant noun phrase, then a colon, then the number)
  // puts no word after a token at all, so `de` is the only entry pt-br needs and
  // the list is deliberately not padded with words nothing matched.
  'pt-br': ['de'],
  // it, derived from the whole-language post-token-axis survivor set — 25 before
  // the two fixes below, 23 after, carrying these 9 distinct words. Never from
  // the raw 130 matches, per the calibration rule above.
  // `di`, `in` and `su` are prepositions and `che` is a relative pronoun: none
  // inflects for number. `token`, `batch` and `byte` are English loanwords, and
  // Italian borrows them INVARIABLE — an unadapted foreign noun takes no plural
  // ending, so "1 token" and "5 token" are both correct (the plural is carried
  // by the article, which these strings do not use). `car` is the standard
  // Italian abbreviation of "caratteri", written "car." and invariant. `s` is
  // the SI symbol for second, invariant by definition, and Italian typography
  // puts a space between the numeral and the unit symbol.
  // The two survivors NOT on this list were real defects and were fixed in the
  // strings instead, both the same shape — a plural participle or noun sitting
  // after a bare ratio, which is wrong at a denominator of 1:
  // `config:reviewProgressCount` read "{{reviewed}} / {{total}} revisionate" and
  // `strings:runs.stringsProgress` read "{{completed}} / {{total}} voci"; both
  // now put the word in front of the ratio, where it labels rather than agrees.
  it: ['di', 'in', 'su', 'che', 'token', 'batch', 'byte', 'car', 's'],
};

/**
 * Locales where the word axis cannot ever find a numeral-agreement defect,
 * because the language's counted nouns do not inflect for number at all —
 * a grammar fact, not an unfinished calibration.
 *
 * `tr`: after any numeral Turkish nouns stay in the bare singular ("üç
 * kitap", never "üç kitaplar" — docs/i18n/style/tr.md "Counted nouns stay
 * singular"), so there is no wrong plural form for the word axis to catch
 * here: every token-axis survivor is cleared unconditionally rather than
 * printed as an uncleared candidate. This is NOT the same situation as a
 * locale simply missing from NUMERAL_WORD_AXIS_EXEMPTIONS (that means
 * "nobody has looked yet"; this means "there is nothing to look for"), and
 * it is NOT a claim that Turkish has no numeral-adjacent hazard at all — it
 * has a different one, a case suffix welded onto the unpredictable token
 * value, which WELDED_SUFFIX_LOCALES / weldedSuffixCheck() below exists to
 * catch instead. Without this entry, a correct Turkish string like
 * `{{total}} girdi` ("{{total}} entries", singular "girdi" at every count)
 * reports as an uncleared survivor and fails the gate on a rendering that
 * is not a defect.
 *
 * `ja`: the same fact, held even more strongly — Japanese nouns have no
 * number at all, so there is no plural form for a numeral to agree with, in
 * any construction. The batch-3 translator asked instead for a single-word
 * exemption (倍, the multiplier in `review:overflowIssue`), by analogy with
 * ru's симв/байт. Granting that would have been wrong twice over: it would
 * treat a grammar fact as an unfinished calibration, and it would guarantee
 * the same escalation every round with a different word — 件, 個, 回 and
 * every other counter sit in exactly the same position and are equally
 * invariant. Rounds 1 and 2 produced zero word-axis survivors for `ja`, so
 * the axis has never caught a real Japanese defect, and cannot.
 *
 * As with `tr`, this is NOT a claim that Japanese has no numeral-adjacent
 * hazard. It has one, and it is the choice of COUNTER (助数詞): 件 for
 * records, 行 for rows, 語 for glossary terms. That is a lexical decision per
 * counted object rather than an agreement rule, so no regex can check it; it
 * is handled by the counter-by-object table in docs/i18n/style/ja.md, which
 * the batch-1 review required and every later batch extends.
 *
 * An earlier version of this comment justified the flag with "the written form
 * after any numeral is the same characters". That is FALSE, and the reviewer
 * asked to falsify it duly did. Japanese has at least two numeral-conditioned
 * orthographic changes: a counter spelled in KANA changes characters and not
 * merely reading (1ぴき / 2ひき / 3びき, 1ぷん / 4ふん), and the native ～つ
 * series has no form above nine, so `{{count}}つ` is ungrammatical from ten up.
 * The correction is left visible rather than rewritten because a repaired proof
 * should not be indistinguishable from one that was always sound.
 *
 * The flag survives on narrower and checkable grounds. Neither hazard is
 * reachable in this product: style/ja.md's counter table admits only kanji
 * counters and katakana units, and katakana takes neither rendaku nor
 * gemination; a grep of all 24 shipped `ja` namespaces for a placeholder
 * followed by hiragana returns seven hits, every one a particle — no kana
 * counter, no `{{count}}つ`. And the word axis could not catch either case in
 * any event, because `{{count}}` is skipped on the token axis before the word
 * axis runs. So the flag costs no coverage, and the single-word 倍 grant it
 * replaced would have cost the same while implying the axis still had work to
 * do here. If a kana counter is ever introduced, it is the counter table that
 * must catch it, not this axis.
 *
 * `id`: the same grammar fact as `tr`, resting on two properties rather than
 * one. Indonesian nouns are not marked for number at all, and the ONE plural
 * device the language has — full reduplication ("kata-kata") — is
 * ungrammatical after a numeral, so "tiga buku" is the only well-formed shape
 * and "tiga buku-buku" is an error rather than an alternative
 * (docs/i18n/style/id.md, "No plural marking after a numeral"). Indonesian
 * verbs, participles and adjectives carry no number agreement either, which
 * matters here because the second-commonest survivor shape after a bare noun
 * is a predicative participle ("{{completed}} berhasil", "{{failed}} gagal").
 * So there is no wrong form for the word axis to find in either position.
 * Measured over the finished locale: 172 raw narrow matches, 61 after the
 * token axis, carrying 25 distinct words — bare counted nouns (entri, token,
 * karakter, bita, bahasa, aturan, glosarium, istilah, saran, temuan, masalah,
 * batch, contoh, tindakan, baris), invariant participles (berhasil, gagal,
 * ditambah, diperbarui, ditimpa, ditandai, beres, masuk, keluar), the
 * preposition `dari`, the relative pronoun `yang` and the invariant
 * abbreviation `dtk`. A NUMERAL_WORD_AXIS_EXEMPTIONS list was the other
 * option and would have been wrong for the reason the `ja` note gives: it
 * treats a grammar fact as an unfinished calibration, and with 25 words
 * already it would need extending on every future string that puts any new
 * noun after any token.
 *
 * As with `tr` and `ja`, this is NOT a claim that Indonesian has no
 * numeral-adjacent hazard. It has one, and it is the CLASSIFIER (kata
 * penggolong): buah for objects, orang for people, lembar for sheets. That is
 * the same shape as ja's counter problem — a lexical choice per counted
 * object, not an agreement rule, so no regex can check it — and it is handled
 * by the classifier rule in docs/i18n/style/id.md, which settles the question
 * by omitting classifiers throughout. Indonesian has no case system, so the
 * welded-suffix hazard WELDED_SUFFIX_LOCALES exists for cannot arise here
 * either.
 */
export const NUMERAL_WORD_AXIS_INAPPLICABLE_LOCALES = new Set(['tr', 'ja', 'id']);

/**
 * The script list for a locale, or `undefined` if this detector has no
 * entry for it — callers must treat `undefined` as "cannot check", never as
 * "assume Latin". See NUMERAL_LOCALE_SCRIPTS for why there is no fallback.
 */
function scriptsFor(locale) {
  return NUMERAL_LOCALE_SCRIPTS[locale];
}

/** True only for a locale this detector can genuinely examine. */
export function isNumeralCheckSupported(locale) {
  return Object.prototype.hasOwnProperty.call(NUMERAL_LOCALE_SCRIPTS, locale);
}

function requireScripts(locale) {
  const scripts = scriptsFor(locale);
  if (!scripts) {
    throw new Error(
      `i18n-preflight: no NUMERAL_LOCALE_SCRIPTS entry for "${locale}" — the numeral-agreement ` +
        `detector cannot examine this locale's script and must not report a result for it. Add an ` +
        `entry (see the comment above NUMERAL_LOCALE_SCRIPTS) before running this check for "${locale}".`,
    );
  }
  return scripts;
}

/** One `[\p{Script=X}\p{Script=Y}…]`-shaped class covering every script in the list. */
function scriptClass(scripts) {
  return scripts.map((script) => `\\p{Script=${script}}`).join('');
}

/**
 * The gap between `{{token}}` and the following word. Most scripts in
 * NUMERAL_LOCALE_SCRIPTS separate words with whitespace, so the narrow rule
 * requires at least one whitespace character there (unchanged from the
 * original ru-only calibration — this is why ru's 187/19/0 figures do not
 * move). `UNSPACED_SCRIPT_LOCALES` (locale-rules.mjs — the same set the
 * identical-value check already uses, for the same underlying reason) names
 * the scripts that do NOT put spaces between words: Japanese, Chinese and
 * Thai write a counted noun directly against the placeholder's rendered
 * value with no separator at all, and this codebase already treats Korean
 * the same way for the analogous reason. Requiring whitespace for those
 * locales would make the "matching rule not depend on whitespace" gap the
 * same silent no-op I2 found, just moved one line down — so for those
 * locales the gap is zero-or-more, not one-or-more.
 */
function gapFor(locale) {
  return UNSPACED_SCRIPT_LOCALES.has(locale) ? '\\s*' : '\\s+';
}

/**
 * `{{token}}` + a script-appropriate gap + a word in the locale's script(s)
 * — the "narrow" rule the skip list and the 187/0 calibration figure are
 * measured against. The capture groups are token name (1) and the word (3);
 * group 2 (the gap) exists only so the two are separated, it is not used.
 */
function numeralAgreementRegex(locale) {
  const cls = scriptClass(requireScripts(locale));
  return new RegExp(`\\{\\{(\\w+)\\}\\}(${gapFor(locale)})([${cls}][${cls}\\p{M}]*)`, 'gu');
}

/**
 * The "loose" variant that also matches across intervening punctuation and
 * symbol characters — quotes, dashes, colons, parentheses, guillemets, and
 * Unicode Symbol-category characters such as "×" — not only whitespace.
 * BOTH Unicode categories P (punctuation) and S (symbol) are required to
 * reproduce the documented 257-occurrence figure exactly: punctuation alone
 * lands one short (256) on the historical corpus, because
 * `review:overflowIssue`'s "×" is a math symbol, not punctuation, under
 * Unicode's own category split — see the module header's "THE LOOSE RULE,
 * PRECISELY" section for how this was verified against the exact historical
 * commit. See the module header for why this figure is printed rather than
 * gated: it is the more fragile of the two to keep exactly in sync with a
 * shrinking corpus. (This variant already matched across zero-width gaps via
 * `[\s\p{P}\p{S}]*`, so unspaced scripts needed no separate change here —
 * only the narrow rule's `gapFor()` was ru-shaped.)
 */
function looseNumeralAgreementRegex(locale) {
  const cls = scriptClass(requireScripts(locale));
  return new RegExp(`\\{\\{\\w+\\}\\}[\\s\\p{P}\\p{S}]*([${cls}][${cls}\\p{M}]*)`, 'gu');
}

/** Every string value of one locale, as `[namespace, key, value]` triples. */
function localeStringEntries(namespaces) {
  const entries = [];
  for (const [namespace, data] of namespaces) {
    for (const [key, value] of flattenEntries(data)) {
      if (typeof value === 'string') entries.push([namespace, key, value]);
    }
  }
  return entries;
}

/** Raw count of loose-rule matches, for the informational figure only. */
export function looseNumeralAgreementCount(namespaces, locale) {
  const re = looseNumeralAgreementRegex(locale);
  let count = 0;
  for (const [, , value] of localeStringEntries(namespaces)) {
    count += [...value.matchAll(re)].length;
  }
  return count;
}

/**
 * The full two-pass numeral-agreement detector for one locale.
 *
 * Returns `{ raw, afterTokenAxis, survivors }`:
 *  - `raw`: every `{{token}}`+word match, before either pass.
 *  - `afterTokenAxis`: what is left after skipping NUMERAL_TOKEN_SKIPLIST —
 *    this is the "occurrences" figure the docs quote (187 for ru).
 *  - `survivors`: what is left after ALSO skipping this locale's word-axis
 *    exemptions — offender strings, ready to print. Empty means clean.
 *
 * This function checks tokenSkip before wordExempt on every match, but that
 * per-match check order is NOT what makes the two-pass design correct — for
 * one fixed pair of lists, "skip if token in skiplist, else skip if word in
 * exemptlist" is a commutative logical OR, so evaluating either check first
 * yields the same verdict. What is load-bearing is that
 * NUMERAL_WORD_AXIS_EXEMPTIONS is calibrated from `afterTokenAxis` survivors
 * only, never from `raw` — see the module header's "WHY THE TOKEN AXIS RUNS
 * BEFORE THE WORD AXIS" section for why a raw-derived word list gets
 * contaminated by legitimate `{{count}}` agreement and silently exempts real
 * defects.
 *
 * For a locale in NUMERAL_WORD_AXIS_INAPPLICABLE_LOCALES, the word axis is
 * skipped unconditionally — every token-axis survivor is cleared, never
 * printed as a candidate — because that locale's grammar has no numeral-word
 * agreement for the word axis to check in the first place. See that
 * constant's own comment.
 */
export function numeralAgreementCheck(namespaces, locale) {
  const re = numeralAgreementRegex(locale);
  const tokenSkip = new Set(NUMERAL_TOKEN_SKIPLIST);
  const wordAxisInapplicable = NUMERAL_WORD_AXIS_INAPPLICABLE_LOCALES.has(locale);
  const wordExempt = new Set((NUMERAL_WORD_AXIS_EXEMPTIONS[locale] ?? []).map((w) => w.toLowerCase()));

  let raw = 0;
  let afterTokenAxis = 0;
  const survivors = [];

  for (const [namespace, key, value] of localeStringEntries(namespaces)) {
    for (const match of value.matchAll(re)) {
      raw += 1;
      const token = match[1];
      const word = match[3];
      if (tokenSkip.has(token)) continue; // token axis first
      afterTokenAxis += 1;
      if (wordAxisInapplicable) continue; // this locale's nouns never inflect — nothing to check
      if (wordExempt.has(word.toLowerCase())) continue; // word axis second
      survivors.push(`${namespace}:${key} — {{${token}}} … "${word}"`);
    }
  }

  return { raw, afterTokenAxis, survivors };
}

// ---------------------------------------------------------------------------
// Check 1b: welded suffix (a placeholder-adjacency defect, not a numeral one)
// ---------------------------------------------------------------------------

/**
 * Locales whose orthography attaches a grammatical suffix directly onto the
 * preceding word, chosen by that word's final sound — Turkish case suffixes
 * on proper nouns ("NARN'ı", "API'sini") are the shipped example; see
 * docs/i18n/style/tr.md's "Vowel harmony over an interpolated value" section.
 * A `{{token}}` renders a value unknown until runtime, so a suffix written
 * directly against it (`{{model}}'i`, or with no apostrophe at all,
 * `{{base}}ı`) is right only for the values that happen to end in the
 * assumed sound and wrong for the rest — a defect the numeral-agreement
 * check above cannot see, welded or not: that check's gap is whitespace
 * (`gapFor()`), and a welded suffix has none.
 *
 * SCOPED TO `tr` ONLY, DELIBERATELY — this was evaluated, not copied
 * verbatim from the smallest-fix proposal that motivated it. Two things
 * ruled out "widen the numeral-agreement gap instead" and "apply to every
 * locale":
 *
 *  - **Not a widened gap.** `gapFor()` controls how much whitespace sits
 *    between `}}` and a WORD in numeralAgreementRegex's word-axis check —
 *    widening it to zero-or-more would still require the character right
 *    after `}}` to be a script letter, so it could catch `{{base}}ı` but
 *    never `{{model}}'i` (the apostrophe is neither whitespace nor a
 *    script letter). It would also feed welded matches into the numeral
 *    word axis, conflating two defects docs/i18n/style/tr.md is explicit
 *    are "aimed at different things in this language": whether a count
 *    forces plural agreement (it never does, in Turkish) versus whether a
 *    case suffix was chosen for a value the guard cannot see. A separate
 *    check keeps that distinction instead of erasing it.
 *  - **Not every locale.** Applying this pattern locale-wide would treat
 *    any letter immediately after `}}` as suspect, and the shipped corpus
 *    already has a legitimate, unrelated shape that collides with it: `en`,
 *    `es` and `fr` all ship `common:thinking` as "…{{seconds}}s" — a plain
 *    unit suffix, not a value-dependent grammatical choice. Every
 *    UNSPACED_SCRIPT_LOCALES entry (ja, ko, th, zh-hans, zh-hant) would
 *    fare far worse: those languages never put whitespace before ANY word,
 *    so this pattern would fire on ordinary, correct running text, not on
 *    a defect — the same silent-no-op-shaped mistake NUMERAL_LOCALE_SCRIPTS'
 *    own history already warns about, just inverted into a false-positive
 *    flood instead of a false-negative no-op. Widen this set only for a
 *    locale whose own style guide documents the same value-dependent
 *    welded-suffix hazard Turkish has — not by assuming every agglutinative
 *    or non-Latin language works the same way.
 */
export const WELDED_SUFFIX_LOCALES = new Set(['tr']);

/** True only for a locale the welded-suffix check is calibrated to examine. */
export function isWeldedSuffixCheckSupported(locale) {
  return WELDED_SUFFIX_LOCALES.has(locale);
}

/**
 * `{{token}}` + an optional apostrophe (ASCII `'` or the typographic `’`
 * this locale's style guide prescribes) + a word in the locale's own
 * script, with NO gap — the whitespace-free adjacency the numeral-agreement
 * regex above cannot express. Reuses `requireScripts()`/`scriptClass()` so
 * a do-not-translate Latin term glued to the token in some other way is
 * still bounded to the locale's own script, same rationale as
 * numeralAgreementRegex.
 */
function weldedSuffixRegex(locale) {
  const cls = scriptClass(requireScripts(locale));
  return new RegExp(`\\{\\{(\\w+)\\}\\}(['’]?)([${cls}][${cls}\\p{M}]*)`, 'gu');
}

/**
 * Every welded-suffix offender for one locale, as ready-to-print strings.
 * Unlike the numeral-agreement check, this has no token skiplist and no
 * word-axis exemption list: welding is a hazard for ANY token, not only the
 * ones that can hold a number (`{{model}}'i` is a defect even though
 * `model` is on NUMERAL_TOKEN_SKIPLIST), so every match is an offender.
 */
export function weldedSuffixCheck(namespaces, locale) {
  const re = weldedSuffixRegex(locale);
  const offenders = [];
  for (const [namespace, key, value] of localeStringEntries(namespaces)) {
    for (const match of value.matchAll(re)) {
      const [, token, apostrophe, suffix] = match;
      offenders.push(`${namespace}:${key} — {{${token}}}${apostrophe}${suffix}…`);
    }
  }
  return offenders;
}

// ---------------------------------------------------------------------------
// Check 2: both collision directions
// ---------------------------------------------------------------------------

/**
 * Both collision directions over the whole flattened locale, via the same
 * (locale entry, English counterpart) pairing `check-locales.mjs` uses
 * (`pairsFor` — plural-aware, so a Russian `_few`/`_many` form is compared
 * against English's `_other`, never left out).
 *
 *  - `sameEnglishDifferentRendering`: one English value, more than one
 *    locale rendering of it.
 *  - `sameRenderingDifferentEnglish`: one locale rendering, more than one
 *    English source it renders — the direction that caught a genuine
 *    collapse of two distinct English verbs in the pilot (docs/i18n/
 *    backfill-notes.md's "What review caught" section, class 6, and
 *    backfill-runbook.md's "The English defects that must not be mirrored"
 *    section's "Apply"/"Approve" example).
 *
 * Report only, by design — see the module header.
 */
export function collisionOffenders(locales, locale) {
  const pairs = pairsFor(locales, locale);

  /** referenceValue -> Map<value, ids[]> */
  const byReference = new Map();
  /** value -> Map<referenceValue, ids[]> */
  const byValue = new Map();

  for (const pair of pairs) {
    const id = `${pair.namespace}:${pair.key}`;

    if (!byReference.has(pair.referenceValue)) byReference.set(pair.referenceValue, new Map());
    const renderings = byReference.get(pair.referenceValue);
    if (!renderings.has(pair.value)) renderings.set(pair.value, []);
    renderings.get(pair.value).push(id);

    if (!byValue.has(pair.value)) byValue.set(pair.value, new Map());
    const sources = byValue.get(pair.value);
    if (!sources.has(pair.referenceValue)) sources.set(pair.referenceValue, []);
    sources.get(pair.referenceValue).push(id);
  }

  const sameEnglishDifferentRendering = [...byReference]
    .filter(([, renderings]) => renderings.size > 1)
    .map(([referenceValue, renderings]) => ({
      referenceValue,
      renderings: [...renderings].map(([value, ids]) => ({ value, ids })),
    }));

  const sameRenderingDifferentEnglish = [...byValue]
    .filter(([, sources]) => sources.size > 1)
    .map(([value, sources]) => ({
      value,
      sources: [...sources].map(([referenceValue, ids]) => ({ referenceValue, ids })),
    }));

  return { sameEnglishDifferentRendering, sameRenderingDifferentEnglish };
}

// ---------------------------------------------------------------------------
// Check 3: the bare + _other family list
// ---------------------------------------------------------------------------

/**
 * The `bare + _other` families — computed from the ENGLISH source, not the
 * locale under test, because it is a property of English (see the module
 * header, docs/i18n/backfill-notes.md's "What the artifacts were missing on
 * day one" section item 3, and backfill-runbook.md's "The bare + _other
 * families" section): a family shaped `key` + `key_other` with no `key_one`
 * anywhere in English. The placeholder check resolves a locale's `_one`
 * against English's `_other` (see resolveReference() in locale-rules.mjs),
 * so a true singular can fail the guard for a token English's own singular
 * does not carry.
 *
 * `tokenAsymmetric` flags the one family (of twelve, verified below) whose
 * bare form and `_other` form do not carry the same placeholder multiset —
 * `vault:retrySuccess`, whose bare form has no token at all while `_other`
 * carries `{{count}}`.
 */
export function bareOtherFamilies(locales, referenceLocale = REFERENCE_LOCALE) {
  const reference = locales.get(referenceLocale);
  if (!reference) throw new Error(`Reference locale "${referenceLocale}" not found`);

  const families = [];
  for (const [namespace, data] of reference) {
    const { plain, plurals } = classifyKeys(flattenKeys(data));
    const flat = new Map(flattenEntries(data));
    for (const [base, suffixes] of plurals) {
      if (!plain.has(base) || suffixes.has('one')) continue;
      const bareTokens = tokensOf(flat.get(base) ?? '');
      const otherTokens = tokensOf(flat.get(`${base}_other`) ?? '');
      families.push({
        id: `${namespace}:${base}`,
        tokenAsymmetric: bareTokens.join('|') !== otherTokens.join('|'),
      });
    }
  }
  return families;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/** `sameEnglishDifferentRendering` groups, formatted for the console. */
function formatSameEnglishGroups(groups, locale) {
  const lines = [];
  for (const { referenceValue, renderings } of groups) {
    lines.push(`     en: "${referenceValue}"`);
    for (const { value, ids } of renderings) {
      lines.push(`       ${locale}: "${value}" — ${ids.join(', ')}`);
    }
  }
  return lines;
}

/** `sameRenderingDifferentEnglish` groups, formatted for the console. */
function formatSameRenderingGroups(groups, locale) {
  const lines = [];
  for (const { value, sources } of groups) {
    lines.push(`     ${locale}: "${value}"`);
    for (const { referenceValue, ids } of sources) {
      lines.push(`       en: "${referenceValue}" — ${ids.join(', ')}`);
    }
  }
  return lines;
}

function runCli() {
  const locale = process.argv[2];
  if (!locale) {
    console.error('usage: node scripts/i18n-preflight.mjs <locale>');
    process.exit(2);
  }

  const locales = loadLocales(LOCALES_DIR);
  const namespaces = locales.get(locale);
  if (!namespaces) {
    console.error(
      `i18n-preflight: locale "${locale}" not found under ${LOCALES_DIR} ` +
        `(have: ${[...locales.keys()].sort().join(', ')})`,
    );
    process.exit(2);
  }
  if (!locales.has(REFERENCE_LOCALE)) {
    console.error(`i18n-preflight: reference locale "${REFERENCE_LOCALE}" not found`);
    process.exit(2);
  }

  console.log(`i18n-preflight: ${locale}`);
  console.log('');

  // --- Check 1 ---------------------------------------------------------
  console.log('## 1. Numeral agreement (token axis, then a word axis derived from its survivors)');
  const numeralCheckSupported = isNumeralCheckSupported(locale);
  let survivors = [];
  let hasWordAxis = false;
  if (!numeralCheckSupported) {
    // Refuse rather than guess. Printing "0 raw, 0 survivors" here would be
    // indistinguishable from a locale this detector actually examined and
    // found clean — that silent no-op is exactly what I2 found for
    // ja/ko/th/zh-hans/zh-hant before NUMERAL_LOCALE_SCRIPTS covered them.
    // See the comment above NUMERAL_LOCALE_SCRIPTS.
    console.log(
      `   REFUSED — "${locale}" has no NUMERAL_LOCALE_SCRIPTS entry, so this detector does not know ` +
        `what script "${locale}" is written in and cannot tell a real word from an untranslated ` +
        `do-not-translate term. This is NOT the same as "0 survivors" — it means nobody has told the ` +
        `detector how to read "${locale}" yet. Add an entry to NUMERAL_LOCALE_SCRIPTS in ` +
        `scripts/i18n-preflight.mjs before trusting this check for "${locale}".`,
    );
  } else {
    const result = numeralAgreementCheck(namespaces, locale);
    survivors = result.survivors;
    const { raw, afterTokenAxis } = result;
    const looseCount = looseNumeralAgreementCount(namespaces, locale);
    const wordAxisInapplicable = NUMERAL_WORD_AXIS_INAPPLICABLE_LOCALES.has(locale);
    hasWordAxis = (NUMERAL_WORD_AXIS_EXEMPTIONS[locale] ?? []).length > 0;
    console.log(
      `   narrow rule ("}}" + gap + word): ${raw} raw, ${afterTokenAxis} after the token-axis ` +
        `skip (${NUMERAL_TOKEN_SKIPLIST.length} tokens), ${survivors.length} after the word axis too.`,
    );
    console.log(
      `   loose rule ("}}" + whitespace/punctuation/symbol + word, informational only): ${looseCount} raw.`,
    );
    if (wordAxisInapplicable) {
      // Not "no survivors because nobody found any" — "no survivors because
      // this language's grammar has nothing here to survive". See
      // NUMERAL_WORD_AXIS_INAPPLICABLE_LOCALES for why that distinction
      // matters and isn't the same silent-clean ambiguity NUMERAL_LOCALE_SCRIPTS
      // exists to prevent: it is stated explicitly here rather than inferred
      // from an empty survivor list.
      console.log(
        `   "${locale}" counted nouns do not inflect for number, so the word axis is not applicable — ` +
          `every token-axis survivor above is cleared unconditionally, not calibrated blank. This ` +
          `locale still has a numeral-adjacent hazard; which one it is differs per language and is ` +
          `named in its entry in NUMERAL_WORD_AXIS_INAPPLICABLE_LOCALES and in docs/i18n/style/${locale}.md.`,
      );
    } else if (survivors.length > 0 && !hasWordAxis) {
      console.log(
        `   "${locale}" has no calibrated word-axis exemption list yet — every one of these is an ` +
          `UNCLEARED CANDIDATE, not a known defect. This does not mean the batch is broken; it means ` +
          `nobody has looked at these words for "${locale}" yet (see NUMERAL_WORD_AXIS_EXEMPTIONS in ` +
          `this script). Go through them by hand: fix real defects, and add invariant words (prepositions, ` +
          `invariant abbreviations, impersonal participles) to this locale's exemption list with a reason.`,
      );
      for (const survivor of survivors) console.log(`     ${survivor}`);
    } else if (survivors.length > 0) {
      console.log('   Survivors — candidates, not verdicts. Clear each by hand before committing:');
      for (const survivor of survivors) console.log(`     ${survivor}`);
    } else {
      console.log('   No survivors.');
    }
  }
  console.log('');

  // --- Check 1b ------------------------------------------------------------
  console.log('## 1b. Welded suffix (a case/particle suffix written directly against a token)');
  const weldedSupported = isWeldedSuffixCheckSupported(locale);
  let weldedOffenders = [];
  if (!weldedSupported) {
    console.log(
      `   Not applicable — "${locale}" is not in WELDED_SUFFIX_LOCALES. See that constant's comment ` +
        `for why this check is scoped narrowly rather than run everywhere.`,
    );
  } else {
    weldedOffenders = weldedSuffixCheck(namespaces, locale);
    if (weldedOffenders.length > 0) {
      console.log(
        `   FAILED — ${weldedOffenders.length} placeholder(s) with a suffix written directly against ` +
          `them, no whitespace. The correct suffix depends on the interpolated value's final sound, ` +
          `which is unknown until runtime — restructure so the token stays bare (see ` +
          `docs/i18n/style/${locale}.md's placeholder section):`,
      );
      for (const offender of weldedOffenders) console.log(`     ${offender}`);
    } else {
      console.log('   No survivors.');
    }
  }
  console.log('');

  // --- Check 2 -----------------------------------------------------------
  console.log('## 2. Collisions (report only — both directions can be legitimate)');
  const { sameEnglishDifferentRendering, sameRenderingDifferentEnglish } = collisionOffenders(
    locales,
    locale,
  );
  console.log(
    `   same English, different ${locale} rendering: ${sameEnglishDifferentRendering.length} group(s)`,
  );
  for (const line of formatSameEnglishGroups(sameEnglishDifferentRendering, locale)) console.log(line);
  console.log(
    `   same ${locale} rendering, different English source: ${sameRenderingDifferentEnglish.length} group(s)`,
  );
  for (const line of formatSameRenderingGroups(sameRenderingDifferentEnglish, locale)) console.log(line);
  console.log('');

  // --- Check 3 -------------------------------------------------------------
  console.log('## 3. "bare + _other" families (a property of the English source)');
  const families = bareOtherFamilies(locales);
  console.log(`   ${families.length} famil${families.length === 1 ? 'y' : 'ies'}:`);
  for (const family of families) {
    console.log(`     ${family.id}${family.tokenAsymmetric ? '  (token-asymmetric)' : ''}`);
  }
  console.log('');

  // --- Verdict -------------------------------------------------------------
  // Checks 1 and 1b gate the exit code — see the module header for why 2 and
  // 3 are report-only. A locale check 1 cannot examine gates the exit code
  // too, just not with a survivor count: see NUMERAL_LOCALE_SCRIPTS.
  if (!numeralCheckSupported) {
    console.error(
      `i18n-preflight: REFUSED — "${locale}" has no NUMERAL_LOCALE_SCRIPTS entry, so check 1 did not ` +
        `run. Add an entry before treating this locale's pre-flight as meaningful.`,
    );
    process.exit(2);
  }

  if (weldedOffenders.length > 0) {
    console.error(
      `i18n-preflight: FAILED — ${weldedOffenders.length} welded-suffix offender(s) for "${locale}". ` +
        `Restructure each so the token stays bare — see the list above and check 1b's own comment.`,
    );
    process.exit(1);
  }

  if (survivors.length > 0) {
    const reason = hasWordAxis
      ? `Clear each one (fix the string, or add a word-axis exemption with a reason) before review.`
      : `This means nobody has cleared "${locale}"'s word axis yet, NOT that this batch is broken — ` +
        `see the survivor list above and NUMERAL_WORD_AXIS_EXEMPTIONS in this script.`;
    console.error(
      `i18n-preflight: FAILED — ${survivors.length} numeral-agreement survivor(s) for "${locale}". ${reason}`,
    );
    process.exit(1);
  }

  console.log(`i18n-preflight: OK — 0 numeral-agreement survivors for "${locale}".`);
}

// Only run as a CLI (the checks above are pure and importable for a test).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
