# Backfill notes — what the Russian pilot measured

Russian was translated first, alone, so that the eleven locales after it are planned from
measurements rather than from a guess. This file is that measurement. It records what the
work cost, which of the pipeline's choices were wrong, what review actually caught, and
what the translator's brief has to carry on day one that this one did not.

Read it with `terminology.md` and `style/ru.md`: those two say *what to write*, this says
*how to run the job*.

**Sections 1–9 are the pilot. Sections 10–17 are wave 1** — German, Japanese and Turkish,
translated concurrently against the frozen artifacts this pilot produced. Where the two
disagree, wave 1 says so and says which figure it re-derived. Read sections 10–17 before
planning wave 2; several of the planning figures below are now known to be wrong by a
factor of two.

Scope of the pilot: 24 namespaces, 1,908 English keys, 2,002 Russian keys (the extra 94 are
`_few` / `_many` forms English has no counterpart for), 52,591 English characters in,
67,026 Russian characters out — the current, post-reachability-sweep corpus. The pilot was
originally measured at 1,931/2,025 keys and 53,147/67,736 characters (commit `e7fe56d`);
section 8 item 4's reachability sweep later removed 23 dead keys from every locale, none of
them touched by the numeral-agreement figures below, which is why those alone were
re-derived at the time and these were not.

---

## 1. Cost per batch

Four batches, translated in sequence by one translator each, each reviewed by an
independent reviewer, then fixed and re-reviewed. Wall clock is the translator's own
elapsed time and excludes review and fix rounds.

| Batch | Namespaces | en keys | ru keys | en chars | ru chars | Wall clock | Fix rounds | Review findings |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `config` | 1 | 374 | 386 | 13,015 | 16,148 | ~35 min | 1 | 3 critical, 8 important, ~10 minor |
| `strings` | 1 | 459 | 481 | 10,066 | 12,703 | ~35 min | 1 | 1 critical, 5 important, 8 minor |
| `glossary` `review` `collab` `logs` `category` | 5 | 496 | 536 | 15,522 | 20,540 | ~75 min | 1 | 0 critical, 6 important, 4 minor |
| the remaining 17 | 17 | 602 | 622 | 14,544 | 18,345 | ~130 min | 2 | 0 critical, 2 important (both process), ~7 minor |

Fix rounds were cheap: ~10 minutes each, and every one was a list of one-line edits — no
batch was ever re-translated.

The terminology file was a fifth, parallel workstream and cost more than any single batch:
**ten rounds**, growing from 55 terms to 76 with 346 verified key citations. Six of those
rounds were not new terms at all but corrections to rows the shipped strings proved wrong.

**Throughput, which is the number worth carrying:** 372, 288, 207 and 112 English
characters per minute, in batch order. It falls monotonically as the namespace count rises
and has no relationship to character count. Per-namespace fixed costs — re-reading the two
authorities for the terms that namespace touches, resolving call sites, re-reading the
previous batch's shipped file to match precedents — dominate everything else.

Plan on roughly **250 English characters per minute for a one- or two-namespace batch and
~110 for a wide one**, plus ~10 minutes per fix round, plus the review.

---

## 2. Which batch boundaries were wrong

The four batches were sized by **character count**. That was the wrong axis.

- Character counts came out 13.0k / 10.1k / 15.5k / 14.5k — a 1.5× spread, so the sizing
  did not even achieve what it aimed at.
- Wall clock came out 35 / 35 / 75 / 130 minutes — a 3.7× spread that tracks **namespace
  count** (1 / 1 / 5 / 17) almost exactly.
- The batch with the *fewest* characters (`strings`, 10.1k) carried the second-most keys
  and one of the two critical defects.

**Size the next language's batches by namespace count, and keep the wide one last.** A
batch of 17 small namespaces is not one unit of work; it is 17 units of "which control is
this, what does its English sibling say, which surface name does it repeat".

Two boundary choices that were right and should be repeated:

- **`config` first, alone.** It is the densest namespace, it exercises most of the
  vocabulary, and translating it produced seven terms the lexicon lacked. Everything after
  it was cheaper because of it.
- **`strings` second, alone.** It owns the tab labels, which are the surface names every
  later namespace has to repeat verbatim. Any batch that names a surface before the tab
  label ships is guessing.

One boundary choice that was wrong: **the five-namespace batch mixed `logs` (narration,
count-neutral, no chrome) with `collab` (forms, statuses, errors)**. They share no
vocabulary and the review had to switch mode repeatedly. Group by register, not by
alphabet.

---

## 3. What review caught, and how the rate moved

Findings per 100 English keys, in batch order: **5.6 → 3.0 → 2.0 → 1.5**. Criticals:
**3 → 1 → 0 → 0**. The last batch was the largest and had zero critical findings.

That rate counts **every finding of any severity**: it is each row of the cost-per-batch
table above, totalled and divided by that row's English key count — so the last batch is
9 findings over 602 keys.
Both of its Importants were process findings rather than string defects; on string defects
alone the last batch is 1.2.

That trend is the pilot's main result, and it is not a story about translators getting
better — each batch had a different one. It is the artifacts filling up. Every finding in
the first two batches that generalised was written into `terminology.md` or `style/ru.md`
before the third batch started, and the third and fourth batches then did not make those
mistakes.

The classes, in the order they mattered:

1. **Numeral agreement against a token that is not `count`** (2 criticals, both in the
   first two batches). A `{{total}}` or `{{tokens}}` holding a number gets no plural
   selection, so a counted noun after it is right for some values and wrong for others.
   One of the two lived in an `aria-label`, where a screen reader speaks the ungrammatical
   form verbatim. Zero occurrences after the rule was written down and the detector was
   handed to the translator.
2. **Case syncretism inverting agent and patient** (1 critical). Two inanimate plural
   nouns and a transitive verb: nominative equals accusative, so word order alone carried
   the roles and the sentence said the entries catch the matchers. Every guard passed it.
   The fix was structural — put the agent in the instrumental — not a reordering.
3. **A pronoun or trailing modifier binding to the nearest noun rather than the intended
   one** (1 critical, 2 important). Grammatical, idiomatic, and false. The class did not
   stay in one shape: it recurred in the **second** batch as modifier attachment rather
   than as pronouns, and that is the calibration finding that widened rubric item 2.
   It did not recur after that — the last batch came back approved, with both of its
   Importants process findings rather than string defects.
4. **A term row that contradicts its own cited key's English** (repeated). Twice the
   *document* was wrong and the shipped string was right. The reviewer found it by
   diffing the file against every row that names a key.
5. **A word invented while an available one already existed** (2 important). Both had the
   same shape: prove the reserved candidates unavailable, then coin — without checking
   whether the survivor actually means the thing, or whether a sibling key already renders
   the same English word.
6. **A shared string specialised until it was false at one of its call sites** (1
   important). English was deliberately generic; the Russian named the thing in the table
   it was written against, and the same key also renders over a different collection.

Classes that never fired, in four batches: quoting and punctuation, do-not-translate token
counts, placeholder multisets, key order, plural coverage. Four of the five are
mechanically guarded, which is why. **Quoting and punctuation is the exception and was
miscounted here for a round:** nothing in `scripts/locale-rules.mjs` checks quotes, dashes,
ellipses or spacing. That class stayed clean because `style/ru.md` settled it before the
first batch and the typography greps swept for what slipped — a translator instruction plus
a grep, not a gate. Do not tell a later language it is guarded.

---

## 4. The reviewer rubric, as it should be applied to language 2

The rubric started at 8 items and grew to 12. Four batches of use say this:

| # | Item | Status for language 2 | Evidence |
| --- | --- | --- | --- |
| 1 | For every `{{token}}` followed by a counted noun, open the call site: is the value numeric, is it pre-formatted, what is its range? | **Demote to a scripted pre-flight the translator runs** | Found both numeric-agreement criticals in the first two batches and nothing afterwards — because from the third batch on the translator ran the detector before committing. It is a check, not a judgement; it belongs before review. |
| 2 | Word order is a correctness check where case is syncretic: name the agent, and state the attachment of every trailing modifier | **Keep** | Earned its keep in every batch. Wording widened after the second: the class recurs as modifier attachment, not only as agent/patient inversion. |
| 3 | Check every pronoun's antecedent against the English | **Fold into 2** | Found nothing on its own after the first batch; every later instance was really item 2. One question — what does this bind to — asked once. |
| 4 | Diff the file against every lexicon row that names a specific key | **Keep** | The highest-yield item after 2. A row naming a key is a testable assertion, and it caught the *document* being wrong twice as well as the file. |
| 5 | Register alternation is a within-string check, not a within-namespace one | **Park** | Nothing, four times. |
| 6 | Score the paradigm, not the option list: review all values of one setting together | **Park** | Nothing, four times — but only because translators applied it while writing. Keep it in the *translator's* brief. |
| 7 | Require an elimination proof for each new term, plus what the established domain term actually is | **Keep** | Caught both invented-word defects. The proof must end with "and the survivor means this", which is the step both failures skipped. |
| 8 | Count-neutral constructions must keep the head noun | **Keep** | Recurred in three batches. A bare substantivized adjective with a number after it is not count-neutral, it is unfinished. |
| 9 | Verify every precedent against the previous batch's **shipped file**, not its report | **Keep despite nulls** | Found nothing after it was introduced — because it was introduced as a warning to the translator, who then self-corrected three stale citations. Cheap, and it is what makes the other verdicts defensible. |
| 10 | Grep for every word a Notes cell **bans**, not only the rendering it prescribes | **Park** | Nothing three times. Its value was in the last batch's report, where 38 banned-lexeme hits were all licensed — evidence, not defects. |
| 11 | Treat `aria-label`-only strings as first-class | **Park as a review item, keep as a translator instruction** | Nothing after the batch that motivated it, where one critical lived in an aria-label. |
| 12 | Script every key with more than one call site and check the rendering is true at all of them | **Keep** | Added last, after a shared string was specialised until it was false at one of two sites. The question is "how many call sites", not "what does this control do". |

Two additions for language 2 that the pilot proved but never made rubric items:

- **Measure length against the per-class budgets for the whole class at once, and report
  the distribution.** Doing this on the last batch is what exposed that the previous
  length rule was violated 27 times across all four batches and was simply wrong.
- **Check that a rendering matched to a sibling namespace was matched to the sibling's
  English, not to its other-locale rendering.** This has its own section in `style/ru.md`
  now. Swept across the whole finished language: exactly one occurrence, the one that
  motivated the rule.

---

## 5. What the artifacts were missing on day one

Everything in this list was discovered by *translating*, not by reviewing, and every item
cost a batch or a round to find. A language-2 brief should carry all of it before the
first string is written.

1. **Which control shape each string takes.** Titles and tabs are noun phrases, buttons
   are infinitives, column headers are bare nouns, in-control placeholders are
   imperatives, confirm-dialog titles are the exception. English writes the same words for
   all five. The first batch invented this convention for 374 keys; had it not been
   written down immediately, the other three would each have invented their own.
2. **Only `count` triggers plural selection.** Every other numeric token is a plural
   trigger the framework cannot see, with a silent failure mode. With the rule: the
   count-neutral devices, in preference order.
3. **The `bare + _other` family list.** Twelve English families are shaped that way, and
   the placeholder check resolves a locale's `_one` against English's `_other`, so a true
   singular can fail the guard for a token English's own singular does not have. This is a
   **property of the English source, not a per-language discovery** — ship the list of
   twelve with every locale brief. Exactly one of the twelve is token-asymmetric.
4. **Length budgets as absolute character counts per class**, not as a multiple of
   English. A ratio is meaningless when the English is five characters long, and only one
   of the five constrained classes has a fixed width.
5. **The full surface-name set with the keys that must agree.** `terminology.md` names
   **ten** surfaces across **twenty-one** keys in its table, plus **three more** — Compare,
   Translations and Backup — which have no second title key and are named only in prose
   from another namespace. The seven surfaces across **16 keys** recorded in `style/ru.md`
   are the subset this pilot settled and shipped, **not** the whole set: a brief that
   quotes the seven understates the work by about a third. (They are 16 keys, not 16
   *pairs* — Global Config alone accounts for four of them.) Several are written by
   different translators in different batches.
6. **"Match the sibling's English, not its other-locale rendering."** The error class
   hides behind a virtue: the file looks *more* consistent, not less.
7. **The settled convention not to add a plural family over a plain English key**, and the
   fact that the guard would permit it. Verified across all four locales: 41 families
   each, zero added.
8. **The English defects that must not be mirrored**, each with the reason: a bulk action
   labelled "Approve" that really applies (`strings:runs.judgeApproveAll` against
   `strings:runs.judgeApply` — one action, two verbs); three controls labelled "Provider"
   that select a module instance; a stale tab name in one notice; and two theme names that
   already diverge **between two namespaces inside one locale** — `es` renders
   `settings:themes.techno.name` as "Tecno" but `welcome:themeChooser.names.techno` as
   "Techno", and `settings:themes.minimal.name` as "Minimal" but
   `welcome:themeChooser.names.minimal` as "Minimalista", while `fr` and `ru` agree with
   themselves across both namespaces. A defect named without its
   keys cannot be acted on, so each one belongs in `english-review-notes.md` with the keys
   and the intended reading — that is the file language 2 will read, not this one.
9. **The reservation-scoping rule.** Every reservation must state which part of speech and
   which sense it binds. Four reservations written in this pilot had to be narrowed later,
   always the same way: a claim over a root or a bare word, backed by evidence that had
   only compared two terms.
10. **The measured expansion figure.** Russian is 1.19× English in characters over the
    shared keys, median 1.18 — *shorter* than both previously shipped locales (1.22 and
    1.26). The tail is what breaks chrome: the 90th percentile is 1.71 over all 2,002
    Russian keys, and 1.7273 over the 1,908 shared with English. Quote the population with
    the figure — see section 9.

---

## 6. Mechanical checks to run before review, not after

Everything here is cheap, scriptable, and — measured over four batches — either finds
defects the reviewer would otherwise spend attention on, or produces the evidence that
makes the reviewer's verdicts checkable. Run them as a pre-flight; hand the reviewer the
output.

1. **The numeral-agreement detector, both axes.**
   - *Token axis:* skip every placeholder that cannot hold a number. In this app
     that is `count` (its family handles it) plus `module`, `instance`, `language`,
     `lang`, `name`, `message`, `date`, `verdict`, `headers`, `model`,
     `keys`, `slug`, `type`, `focus`, `field`, `why`, `label`, `filename`, `id`, `time`,
     `passRate`. 22, not 23, as of 2026-08-11: `languages` was removed as a wave-1 defect
     — `config:templateMeta` interpolates it with a plain count, not a name list, which
     made that key's hazard invisible to every inflecting language. This figure moved;
     the 187/19/0 figures below did not (ru's own `{{languages}}` occurrences were never
     among them — see `scripts/i18n-preflight.mjs`'s NUMERAL_TOKEN_SKIPLIST comment for
     how that was verified).
   - *Word axis:* on what survives the token axis, clear invariant next words —
     prepositions and particles, invariant abbreviations, short and impersonal
     participles.
   - **What has to happen in a fixed order is not evaluation, it is derivation.**
     Checking the token or the word first, per occurrence, gives the same verdict — for
     one fixed pair of lists the two checks are a plain logical OR, and OR is
     commutative. What is load-bearing is where the word-exemption list is BUILT FROM:
     only from occurrences that already survived the token axis, never from the raw,
     unfiltered set. A list derived from the raw set is contaminated by legitimate
     `{{count}}`-driven agreement — a real counted noun such as «записи» recurs
     constantly and correctly after `{{count}}`, because that family already carries its
     own plural forms — and once a word is exempted, it is exempted everywhere,
     including after a non-`count` token it has no business covering. An injected
     `{{orphanCount}} записи` defect passes silently under a raw-derived word list and is
     caught under one derived from the post-token-axis survivors. This was verified by
     building the exemption list the wrong way and getting 32 words instead of 6, one of
     which absorbed exactly that class of injected defect.
   - **The narrow figure, stated precisely.** Counting every place where `}}` is
     followed by one or more whitespace characters and then a word in the target script:
     **187 raw occurrences, 19 after the token axis, 0 after the word axis** — verified
     against both the 2,025-key Russian corpus this file originally measured (commit
     `e7fe56d`) and the current 2,002-key corpus. The reachability sweep in section 8
     item 4 later removed 23 dead keys from every locale; none of them had a narrow-rule
     match, so this figure is unchanged by it.
   - **The looser figure, stated precisely — this one needed a correction.** A rule that
     also matches across intervening punctuation *and* symbol characters (Unicode
     categories P and S together; punctuation alone, category P only, gives 256 — one
     short) gives **257** raw occurrences over the same 2,025-key corpus.
     `review:overflowIssue`'s "×" (a math symbol, not punctuation under Unicode's own
     split) sitting immediately before a preposition is the one occurrence that
     punctuation-only matching misses. Over the current 2,002-key corpus the same rule
     gives 255 — a delta of **2** from the reachability sweep, not 3: an earlier telling
     of this number reported 254 and blamed the whole 3-occurrence gap on the sweep,
     conflating that pre-existing category-boundary question with the sweep's real,
     smaller effect. Quote the exact rule and the exact population together; neither
     figure means anything on its own.
2. **Strict-mode parity.** `LOCALE_PARITY_STRICT=ru pnpm check:locales` (substituting your
   locale) holds the locale to its language's complete plural-category set with no
   bare-key rescue. Run it from the first batch, not at the end — Russian was clean in
   every batch and that is why no plural work ever had to be redone.
3. **The `bare + _other` family list**, checked against the English source rather than
   rediscovered.
4. **Same-English/different-rendering and same-rendering/different-English**, over the
   whole language once it exists. Both directions are one script over the flattened
   locale files and both find things no per-batch review can see. On the finished
   language the second direction returned one genuine collapse of two distinct English
   verbs.
5. **Every quoted rendering in the two authority documents must exist in the shipped
   files.** This is the guard the pilot most wants and does not have: the existing
   citation check only proves a key *exists*, and the collision check only compares
   renderings, so a row that describes a key wrongly survives indefinitely. One such row
   survived six rounds. A substring check over the corpus, with inflection tolerated by
   hand, took minutes and found a stale rendering recorded in two places.
6. **Register and typography sweeps**: the deferential capitalized pronoun mid-sentence,
   the letter the guide tells you to omit, straight quotes, doubled spaces, three-dot
   ellipses, hyphens used as dashes. All six ran clean on the finished language; each is
   one grep.

---

## 7. Process failures, and what to do instead

Recorded plainly, because each one cost something measurable.

- **The coordinator dropped "dispatch fix, then dispatch re-review" twice**, on the two
  batches carrying every critical finding, and caught it only by grepping its own ledger.
  It is not an attention problem: both times the fix result arrived alongside other
  notifications. **Countermeasure: a per-batch state machine written in the ledger —
  translated, reviewed, fixed, re-reviewed, complete — walked by grep before any batch is
  called done.**
- **A batch was dispatched while the previous batch's fix round was still in flight.** It
  read the pre-fix file and cited two values that had already changed, producing two live
  divergences. The next batch got one warning sentence — the exact commits its reference
  files were valid at, and the list of values that had moved — and caught its own three
  stale citations before committing. **Countermeasure: never dispatch batch N+1 until
  batch N's fixes have landed; if you must, name the commit and the moved values.**
- **Three decisions were recorded only in a batch report and had to be re-litigated.** A
  batch report is not an artifact the next batch reads. **Countermeasure: anything that
  binds a later batch goes into the terminology or style file in the same round it is
  decided, and the batch is not complete until it is there.**
- **An assertion about a file travelled through three agents before anyone opened the
  file.** Three separate defects had this shape, each one command away from being
  falsified. **Countermeasure: a claim about what a key says is not relayed, it is
  checked — by whoever is about to act on it.**
- **A fix to a lexicon row broke a different instruction in the same row**, and only a
  re-review caught it. Two-line documentation diffs need the same fix-then-re-review
  discipline as strings.
- **Batches ran serially, deliberately, and that was right.** The parity check is global,
  so concurrent batches would see each other's half-written files and debug failures that
  are not theirs; and each batch has to match the previous one's surface names, which only
  works if the previous output is committed and readable. Serial cost about two hours
  across the pilot and would not survive eleven languages — but the constraint is
  *within* a language. **Eleven languages can run in parallel with each other**, because
  no locale reads another locale's files, provided each has its own working copy and the
  authority documents are frozen for the duration.

---

## 8. Open items that block or shape language 2

1. **Language names render in English in every locale.** `languageName()` in
   `lib/log-presentation/registry.ts` constructs `new Intl.DisplayNames(['en'], …)` with a
   hardcoded locale, so a log line reads "translated into French" in the middle of a
   Russian sentence. It is pre-existing, invisible from any locale file, and unfixable by
   a translator. Eleven more locales will inherit it. **Fix it before the backfill, not
   after.**
2. **`legal:cookies` may need a genuine per-key length exemption in the guard.** The three
   fuller standard Russian renderings all breach the ratio the length rule enforces, and
   the offender check has no per-key allowlist. The shipped label is a defensible shorter
   form, but if the published page's own title is one of the fuller ones, the label must
   follow the page and the guard has to grant it. The same will recur in any language
   whose legal formulae are long — this is a mechanism gap, not a Russian problem.
3. **The three legal link labels are not a translator's decision.** They point at
   published pages, and a link whose text differs from its target's title is a defect no
   locale review can catch, because the page is not in this repo. Reconcile them against
   the published pages once, for all twelve languages.
4. **Two keys have zero call sites.** They surfaced only because someone finally had to
   render every string in the app. A full-locale backfill is the cheapest dead-string
   detector this codebase has, and the parity guard is one-directional by design — it
   proves every key a component uses exists, never that every key that exists is used. A
   reachability sweep before eleven more languages pay to translate them is worth an hour.
5. **The keyboard key names are inconsistent in the two previously shipped locales**, and
   the rule ("write it as engraved on that locale's keyboard") lands differently per
   language — for Russian it means keeping the Latin words, which looks exactly like the
   unfixed leftovers the rule is about. Settle it as one sweep across all locales, or each
   new translator will make a local decision.
6. **The two authority documents were rewritten while batches were reading them.** For
   eleven parallel languages that is untenable. **Freeze both, cut the language-2 brief
   from the frozen text, and route new terms through an additive queue** — a translator
   filling their own locale column never conflicts with another, but a rule rewrite in
   mid-flight invalidates work already done.

---

## 9. Numbers to reuse

- 1,908 English keys, 24 namespaces, 52,591 English characters — the whole surface, per
  language, over the current post-reachability-sweep corpus (section 1).
- Russian needed 94 extra keys (`_few` / `_many`); a language with two categories needs
  none, one with six needs more. Budget by the target's plural-category count — **except**
  `it`/`pt-br`, whose third category (`many`) is grandfathered as unreachable
  (`COVERAGE_GAP_GRANDFATHER` in `scripts/locale-rules.mjs`) and should not be written at
  all; see backfill-runbook.md 2.7 for the reasoning and the one expected strict-mode
  failure that follows from it.
- ~4h15m of translator wall clock for the whole language, plus four reviews, plus five fix
  rounds, plus ten rounds on the shared terminology file.
- The terminology file is the expensive shared artifact and it is now 76 terms deep. For
  language 2 it should cost only the per-locale column, not the rows — **if** the rows are
  frozen first.
- Expansion in characters over the shared keys: 1.19 for Russian, 1.22 and 1.26 for the
  two locales shipped before it. Chrome budgets are absolute character counts, not
  multiples of English.
- **State the population with every percentile — the two in this file are not the same
  one.** Russian's 90th percentile is **1.71** over all **2,002** Russian keys (each extra
  plural form measured against the English form it resolves to) and **1.7273** over the
  **1,908** keys shared with English. Both reproduce exactly; the difference is the
  denominator, not rounding. A language with many extra plural forms will separate the two
  further than Russian does, so a percentile quoted without its population cannot be
  compared to anything.

---

# The first parallel wave — three languages at once (`de`, `ja`, `tr`)

This wave ran German, Japanese and Turkish **concurrently**, six batches each, one round at a
time, against the artifacts the pilot had frozen. It is the first test of the two things the
pilot could not test: whether artifacts built *while* translating one language transfer to a
language nobody has translated, and whether the per-language pipeline survives being run
three times in parallel.

All three finished and all three were judged fit to ship: **de 1,920 keys, ja 1,879,
tr 1,920** against English's 1,908, 24 namespaces each.

**Every number in sections 10–17 was re-derived from the shipped files at the tree these
sections were written against**, not copied from the ledger or from a batch report. Where a
figure differs from the one a batch published at the time, the difference is called out —
usually because a later fix round moved strings, which is the wave's own "re-derive after the
last edit" rule applied to the wave itself.

---

## 10. Cost per batch, per language

Batches are the runbook's six, unchanged. **Wall clock is the translator's own elapsed
time**, translate-only: it excludes the review, the fix rounds and the re-reviews.
**Findings** are the first review's total of every severity (C/I/M), on the pilot's
convention, divided by that batch's *English* key count. **Fix rounds** counts every
dispatched fix pass, including documentation-only ones.

Expansion is characters, over the **shared** key population — 1,908 keys for `de` and `tr`
(their twelve extra `_one` forms have no English counterpart and are excluded), 1,879 for
`ja`. Percentiles are linear-interpolated.

### German (`de`) — 1,920 keys, 66,875 characters

| Batch | ns | en keys | de keys | Wall clock | Fix rounds | Findings (C/I/M) | per 100 en keys | agg | median | p90 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 `config` | 1 | 374 | 374 | 19 min | 1 | 1/4/3 = 8 | 2.14 | 1.2333 | 1.2198 | 1.5000 |
| 2 `strings` | 1 | 452 | 452 | 21 min | 1 | 0/5/6 = 11 | 2.43 | 1.2771 | 1.2321 | 1.7989 |
| 3 verdicts | 4 | 377 | 377 | 16.5 min | 2 | 1/5/8 = 14 | 3.71 | 1.2567 | 1.2500 | 1.6857 |
| 4 identity | 5 | 300 | 304 | 24 min | 2 | 0/1/5 = 6 | 2.00 | 1.2741 | 1.2656 | 1.7076 |
| 5 narration | 6 | 123 | 131 | 20 min | 2 | 0/3/5 = 8 | 6.50 | 1.2656 | 1.2500 | 1.5707 |
| 6 long tail | 7 | 282 | 282 | 28 min | 1 | 1/1/4 = 6 | 2.13 | 1.2538 | 1.2047 | 1.6667 |
| whole-language sweep | 24 | — | — | — | 1 | 0/4/6 = 10 (+1 product) | — | — | — | — |
| **total** | **24** | **1,908** | **1,920** | **128.5 min** | **10** | **3/19/31 = 53** | **2.78** | **1.2577** | **1.2414** | **1.6667** |

Whole-language max ratio 3.75. Six rounds produced the same meaning-error class in six
distinct grammatical guises; the sweep hunted a seventh and did not find one.

### Japanese (`ja`) — 1,879 keys, 29,087 characters

| Batch | ns | en keys | ja keys | Wall clock | Fix rounds | Findings (C/I/M) | per 100 en keys | agg | median | p90 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 `config` | 1 | 374 | 368 | 19 min | 1 | 0/5/8 = 13 | 3.48 | 0.5587 | 0.5714 | 0.8333 |
| 2 `strings` | 1 | 452 | 441 | 25 min | 2 | 0/3/10 = 13 | 2.88 | 0.5698 | 0.5614 | 0.8333 |
| 3 verdicts | 4 | 377 | 366 | 21 min | 1 | 1/3/6 = 10 | 2.65 | 0.5425 | 0.5294 | 0.7977 |
| 4 identity | 5 | 300 | 299 | 27 min | 2 | 0/4/6 = 10 | 3.33 | 0.5687 | 0.5714 | 0.8134 |
| 5 narration | 6 | 123 | 123 | 25 min | 2 | 1/5/2 = 8 | 6.50 | 0.6153 | 0.6216 | 0.8085 |
| 6 long tail | 7 | 282 | 282 | 29 min | 1 | 1/6/4 = 11 | 3.90 | 0.5586 | 0.5556 | 0.8178 |
| whole-language sweep | 24 | — | — | — | 1 | 0/1/6 = 7 | — | — | — | — |
| **total** | **24** | **1,908** | **1,879** | **146 min** | **10** | **3/27/42 = 72** | **3.41** | **0.5641** | **0.5625** | **0.8182** |

Whole-language max 1.5000 — Japanese never exceeds English in characters. The 29-key gap is
exactly English's 29 `_one` keys and nothing else; the sweep verified all 29 collapsed
strings read correctly **at count one**, the check no machine can do.

**Batch 1's wall clock is 19 minutes, not the 22 that four later `ja` reports and the ledger
carry.** 19 is the only figure with timestamps attached (18:39:28Z → 18:58:46Z, in the batch's
own report); 22 first appears in batch 2's report with no derivation and was then copied
forward four times. It is a small instance of the wave's dominant failure mode, in the wave's
own measurements.

### Turkish (`tr`) — 1,920 keys, 58,918 characters

| Batch | ns | en keys | tr keys | Wall clock | Fix rounds | Findings (C/I/M) | per 100 en keys | agg | median | p90 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 `config` | 1 | 374 | 374 | 25 min | 2 | 0/4/6 = 10 | 2.67 | 1.0935 | 1.0714 | 1.4286 |
| 2 `strings` | 1 | 452 | 452 | 19 min | 1 | 2/2/4 = 8 | 1.77 | 1.1560 | 1.1289 | 1.7143 |
| 3 verdicts | 4 | 377 | 377 | 21 min | 2 | 0/2/4 = 6 | 1.59 | 1.0816 | 1.0615 | 1.5000 |
| 4 identity | 5 | 300 | 304 | ~31 min | 2 | 0/2/3 = 5 | 1.67 | 1.0911 | 1.0833 | 1.5000 |
| 5 narration | 6 | 123 | 131 | 22 min | 1 | 0/4/8 = 12 | 9.76 | 1.0955 | 1.0870 | 1.5190 |
| 6 long tail | 7 | 282 | 282 | 25 min | 1 | 0/3/4 = 7 | 2.48 | 1.1431 | 1.1184 | 1.5548 |
| whole-language sweep | 24 | — | — | — | 1 | 0/4/5 = 9 | — | — | — | — |
| **total** | **24** | **1,908** | **1,920** | **143 min** | **10** | **2/21/34 = 57** | **2.52** | **1.1088** | **1.0845** | **1.5556** |

Whole-language max 3.3333. Batch 4's ~31 minutes includes an API-error interruption of
several minutes; its working time is closer to 25. Both Criticals in batch 2 were the same
finding class — one was a **product** defect (section 14), not a translation defect.

### Cross-language, on the identical 1,908-key population

| Locale | aggregate | median | p90 | max |
| --- | --- | --- | --- | --- |
| `ja` (1,879 shared) | 0.5641 | 0.5625 | 0.8182 | 1.5000 |
| `tr` | 1.1088 | 1.0845 | 1.5556 | 3.3333 |
| `ru` | 1.1862 | 1.1818 | 1.7237 | 4.1667 |
| `es` | 1.2187 | 1.2143 | 1.6000 | 3.6667 |
| `fr` | 1.2576 | 1.2440 | 1.6667 | 5.7500 |
| `de` | 1.2577 | 1.2414 | 1.6667 | 3.7500 |

German is **indistinguishable from French** on this population, not longer than it — the
runbook's rounded row read as though German were the outlier and it is not. Turkish is the
shortest inflecting locale shipped. Japanese contracts, and **0.56 in characters is not 0.56
in width**: a full-width glyph carries about twice the advance of a Latin character, so a CJK
budget must be derived in pixels and never scaled from the character ratio.

### Figures that moved between the batch report and this tree

Several per-batch expansion figures published at commit time no longer reproduce, because
later fix rounds edited strings in the same namespaces: `de` batch 2's p90 was published as
1.75 and is 1.7989; `ja` batch 2's aggregate was published as 0.55 and is 0.5698. The
whole-language figures all reproduce exactly. This is the "re-derive after the last edit"
rule earning its place — **a batch-scoped distribution is stale by construction the moment
that batch's fix round lands**, so publish the whole-language figure and treat the per-batch
one as a working number.

---

## 11. Did the six-batch split beat the pilot's four?

**Partly, and much less than the headline suggests. Do not plan wave 2 on the assumption
that more batches are cheaper.**

The headline is real: per-language translator wall clock fell from the pilot's ~275 minutes
to 128.5 / 146 / 143. But almost all of that is the frozen artifacts, not the split, and the
data separates the two cleanly because **batches 1 and 2 are structurally identical in both
runs** — `config` alone, then `strings` alone.

| | pilot | wave 1 (de / ja / tr) | change |
| --- | --- | --- | --- |
| Batches 1+2 (same split in both) — 833 vs 826 keys | 70 min | 40 / 44 / 44 min | **−37% to −43%** |
| The other 22 namespaces — 1,098 vs 1,082 keys | 205 min (2 batches, 5 + 17 ns) | 88.5 / 102 / 99 min (4 batches) | −50% to −57% |

The first row holds the split constant, so its −40% is the artifacts. Apply that same factor
to the pilot's wide half and you would expect ~123 minutes; the actual figures are 88.5–102.
**The finer split of the wide half is therefore worth roughly 21–34 minutes per language**,
about 17–28% on that half and about 15–20% on the language. That is the honest size of the
gain.

Against it, two costs that the pilot's four-batch shape would not have paid:

- **Wall clock per round is flat.** Over 18 rounds it ranged 16.5–31 minutes (mean 23.2,
  sd ≈ 4) while batch size ranged 123–452 keys (3.7×) and 1–7 namespaces (7×). A round costs
  ~23 minutes of translator time almost regardless of what is in it, so two extra rounds cost
  ~46 minutes per language before any review.
- **Findings do not scale with batch size either.** Over the same 18 rounds the correlation
  between English key count and finding count is **r = 0.22, r² = 0.05** — batch size explains
  5% of the variance. Each round costs ~9 findings whatever its size, so two extra rounds
  cost ~18 more findings to triage per language, ~54 across the wave, plus 2 reviews, ~3 fix
  rounds and 2 re-reviews each.

Netted out, the six-batch split roughly broke even on translator time and lost on review
time. **It should nonetheless be kept**, because every available merge breaks something the
pilot already paid to learn:

- Merging batches 5 and 6 gives 405 keys across **13 namespaces** and puts machine narration
  back in with the long tail — the pilot's own recorded boundary error, recreated.
- Merging 4 and 5 gives 11 namespaces and mixes forms and statuses with log lines — the same
  error.
- Merging 3 and 4 gives 9 namespaces and mixes verdict vocabulary with identity chrome.

**What the data actually supports is a ceiling, not a target count.** Every batch at or below
7 namespaces ran at 183–685 English characters per minute; the pilot's 17-namespace batch ran
at 112. Nothing in this wave measures anything between 8 and 16 namespaces, so state it
honestly: **≤7 namespaces is proven fine, 17 is proven bad, 8–16 is unmeasured.** Size by
that ceiling and by register, and accept the round count that falls out — six, for this
corpus.

### Throughput, replacing the runbook's planning figures

English characters per minute of translator wall clock, `de` / `ja` / `tr`:

| Batch | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- |
| en chars | 13,015 | 9,900 | 10,744 | 7,851 | 4,567 | 6,514 |
| chars/min | 685 / 685 / 521 | 471 / 396 / 521 | 651 / 512 / 512 | 327 / 291 / 253 | 228 / 183 / 208 | 233 / 225 / 261 |

The runbook plans on **250 chars/min for a one- or two-namespace batch and ~110 for a wide
one**. Both under-predict by 2.0–2.7×. They are pilot figures and the artifacts have moved
underneath them. **Replace the throughput model with the flat one: ~23 minutes per round,
±4, independent of batch size within the measured range.** Character throughput is now an
output of that, not an input to it.

---

## 12. Did the finding rate start lower than the pilot's 5.6 per 100 keys?

**Yes, decisively — and that is the single most important result in this document, because it
is the only direct evidence that artifacts built while translating one language transfer to a
language nobody has translated.**

The comparison is exact: the same namespace (`config`), the same 374 English keys, the same
position (first batch of a new language), the same review protocol. The only differences are
the frozen artifacts and the translator.

| | pilot `ru` | `de` | `tr` | `ja` |
| --- | --- | --- | --- | --- |
| Batch 1 findings per 100 en keys | **5.61** | **2.14** | **2.67** | **3.48** |
| Batch 1 criticals | **3** | 1 | 0 | 0 |

38% to 62% lower, and the critical count went from three to one, zero and zero. The pilot
built `terminology.md`, the control-shape table, the twelve `bare + _other` families, the
surface-name set and the numeral-agreement detector *while* translating; wave 1 inherited all
of it and opened at less than half the defect rate in every language.

**What did not transfer is the decline.** The pilot's rate fell monotonically — 5.61 → 3.05
→ 2.02 → 1.50. This one does not fall in any language:

| Batch | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- |
| `de` | 2.14 | 2.43 | 3.71 | 2.00 | 6.50 | 2.13 |
| `ja` | 3.48 | 2.88 | 2.65 | 3.33 | 6.50 | 3.90 |
| `tr` | 2.67 | 1.77 | 1.59 | 1.67 | 9.76 | 2.48 |

There is no trend. The batch-5 spike in all three is an artefact of the denominator: batch 5
is 123 keys, 2.3× smaller than any other, against a per-round finding cost that is fixed.

The mechanism is the same fact stated twice. The pilot's decline *was* the string-defect class
being absorbed into the shared artifacts. This wave started with that class largely closed, so
what remains is a per-round fixed cost that no previous language's artifact can pre-empt —
**the claims each batch writes into its own new style guide and lexicon.** Those are written
fresh, per language, per round, and they are what the reviews now find.

Two consequences worth carrying:

- **Whole-language rate is unchanged from the pilot**: 2.80 per 100 keys for `ru`, against
  2.78 / 3.41 / 2.52 for de / ja / tr. Normalised per review pass, where the wave ran six
  reviews plus a sweep against the pilot's four, it is down by a quarter to a third: 13.5
  findings per review for the pilot, 8.8 / 10.8 / 8.0 for wave 1.
- **The findings migrated out of the strings.** Across the three whole-language sweeps —
  26 findings over 5,719 shipped values — **exactly one required a shipped string to change**,
  and that one (`sidebar:searchProjects`, a register outlier) was already known and had been
  deferred to the sweep in batch 5. **No sweep found a new string defect in any of the three
  languages.** German's sweep hunted the seventh instance of its signature meaning error and
  did not find it; Japanese's sweep reported no defect in any of its 1,879 strings.

### A runbook claim this falsifies

`backfill-runbook.md`, section 1 ("What a batch costs"), ends: *"If your rate is not falling,
the artifacts are not being updated."* That rate did not fall in any of three languages, and
the artifacts were being updated continuously and demonstrably. **That sentence would send a
wave-2 controller hunting a process failure that is not there.** The rate falls only while the
*shared* artifacts are still absorbing the string-defect class; once they have, the residual
is per-round document cost and it is flat. Replace the test with the two that still
discriminate: **watch the criticals, and watch the share of findings that require a string to
change.** Both fell hard in wave 1 and both are what "the artifacts are working" now means.

---

## 13. Did three concurrent languages cost more coordination than three sequential ones?

**Yes, and it was worth it — but the costs are specific, they all land on the controller, and
they scale with the number of concurrent languages while the largest benefit does not.**

### The costs that are strictly concurrency's

1. **A controller error reaches every in-flight language at once.** The wave's clearest
   example: the controller wrote into the runbook that `strings:tabs.*` is a main tab bar in a
   wide scrolling container. It is not — those labels are sidebar menu items in a fixed 16rem
   container that ellipsizes, so the class is hard, not soft. All three languages were reading
   that sentence simultaneously; Turkish had already shipped a budget derived from it, Japanese
   received the correction mid-flight, and German is the one that caught it by opening the call
   site. Run serially, one language pays and the next language's first batch catches it.
2. **The additive-authority race, which produced the wave's only shipped-string Criticals.**
   `english-review-notes.md` grows additively *during* a wave: any locale that finds an English
   defect gets a row filed, and that row binds every language immediately, including one
   mid-batch. Three rows landed during batch 6 alone. Japanese shipped a Critical from a row
   that was in its own commit's immediate parent; German was accused of the same thing and
   exonerated only by `git log -S`, which showed neither row existed in what it read and that it
   finished two minutes before they landed. **This failure mode does not exist in serial
   execution.** The countermeasure — diff the frozen authorities immediately before the final
   gate run, not at the start of the batch — was written at the very end of the wave and has
   been exercised once.
3. **The gates are corpus-wide, not per-language.** `check:locales` and
   `check-lexicon-citations` cover every locale, so a language's own run is red because a
   sibling is mid-flight. Every dispatch had to carry a sentence saying that findings naming
   another language belong to that language's concurrent batch; batch 3 opened with the citation
   guard failing on three `ja` findings while `ja` was still running. That is a recurring tax on
   every run and every dispatch.
4. **One shared queue file for three writers.** The additive queue in
   `terminology/README.md` is a single table three translators wanted to append to. The
   controller had to write rows on translators' behalf to avoid the race — and **seven terms
   requested in batch 5 were never filed at all**, which only surfaced when this document was
   written. A dropped request in a shared file leaves no trace.

### What concurrency bought, which is larger

1. **Elapsed time.** Three finished, swept, fit-to-ship languages in roughly 9.4 hours of
   elapsed wall clock, against a per-language translator cost of 128–146 minutes plus its
   review chain. Three sequential languages would have been ~7 hours of translator time alone,
   serialised behind three full review-fix-re-review chains.
2. **Tooling fixes amortised across the wave instead of paid per language.** Every guard defect
   one language surfaced was fixed once and the other two inherited it inside the same round:
   Japanese found the citation guard's whitespace-token attestation (meaningless in an unspaced
   script), its missing corner-bracket delimiters, and the `isSubstantial` asymmetry that had
   left an identical-value allowlist six-sevenths incomplete after four spaced locales; Turkish
   found that its lexicon's 974 curly quotes and zero straight quotes meant **every Turkish
   citation had extracted to nothing for four rounds while every run stayed green**, plus the
   detector's blindness to a suffix welded to a placeholder and a blockquote marker that
   silently voided citations; German found the guard's intolerance of strong-verb stem changes.
   Serially, each of those is found late by whichever language first meets it, and every
   language before it shipped unguarded.
3. **Independent corroboration became available as evidence, and nothing else provides it.**
   German and Japanese reached the same structural defect — a guide topic byte-identical in
   English to a sidebar group heading, so a batch-2 key silently decides a batch-4 heading
   through the verbatim-copy rule — from opposite directions in the same round. Both escalated
   `*:vault:keyPlaceholder` independently with the same scope. Four locales independently
   reached an omit/exclude verb for the third sense of *discard*. **A serial wave gets one
   opinion per question and has to call it a decision.**

### The shape of it, for sizing wave 2

The costs are coordination-shaped and sit on one agent; the benefits are amortisation- and
evidence-shaped and sit in the artifacts. They do not scale the same way. **Corroboration
saturates fast** — three independent agreements is already strong evidence and eight is barely
stronger — while **error propagation scales linearly** with the number of languages reading a
shared file at once. That asymmetry, not throughput, is the argument for capping the wave.

One coordination failure was *not* made worse by concurrency, and it is worth recording
because it is the one everybody expects to be: the controller dropped a required dispatch four
times in six rounds, every time immediately after writing a long narrative summary, and every
time it was caught by grepping the state machine in the ledger rather than by memory. The
pilot's coordinator dropped the same step twice in four rounds. Per *dispatch* the rate went
down, not up. **The countermeasure is the grep, and the tell is precise: if a summary contains
a sentence about what happens next, the tool call for it must already be in the same turn,
above the prose.**

---

## 14. What each typology needed that the runbook lacked

The runbook was written from Russian. Each of the three languages needed something it did not
carry, and in every case the gap was in *tooling* as much as in instruction.

### German — syncretic case, and a meaning-error class no guard can see

The pilot had already found case syncretism inverting agent and patient. What wave 1 found is
that **the class does not stay in one grammatical shape**: it shipped in six distinct guises
across six rounds, every one in a string asserting what had happened or would happen, and
every one passed parity, the pre-flight, the length gate and all seven typography sweeps.
Beyond the pilot's agent/patient inversion and modifier attachment, wave 1 added:

- **Deixis.** A destructive-action dialog used the proximal demonstrative where English's
  distal *that* sends the reader to each *other* project, and the same string had already spent
  that demonstrative twice on the current one — so it told the user the other projects recover
  when this one is re-pushed. The rule that came out of it is countable: **count demonstratives
  per string, not per clause.**
- **Aspect.** An "until" clause needs a state verb; a perfect reads as a completed event and
  reverses the sentence's timeframe.
- **Compound morphology.** Weak masculines take `-en` as the linking element, so the compound
  is *Assistenten-*, not the bare stem — a class of error that looks like a typo and is not.
- **Register enumeration is a method problem, not a counting problem.** The du-imperative count
  was wrong four rounds running (3 → 6 → 8 → 9) and every correction was a better search of the
  same word list. German imperatives are verb-first **in their clause**, not in their sentence,
  and the written method only ever matched after sentence punctuation. See section 16 for what
  replaced it.

The tooling gap: the citation guard's attestation is prefix-tolerant word matching, and German
strong verbs change their stem (*freigeben*/*freigibst* shares five characters where seven are
required). Verified still true by execution during the wave. The consequence is the one to
watch — twice in batch 1 a **guard shaped the translation** rather than checking it, which is
backwards, and generalising "a guard rejecting correct copy is a finding against the guard"
into the runbook was one of the wave's first fixes.

### Japanese — one plural category, an unspaced script, and counters

- **One plural category.** Every English `_one`/`_other` family collapses to `_other` alone;
  copying `_one` is a hard guard failure by design. Japanese lands 29 keys below English and
  that number is exact and predictable, batch by batch. **The collapse cannot be verified
  mechanically** — the check is reading all 29 collapsed strings at count one, which the sweep
  did across the whole language and no earlier round had.
- **Unspaced script broke three guards written for spaced locales.** The citation guard
  attested a term by prefix-matching whitespace-delimited tokens, so in an unspaced script a
  whole clause is one token and a term is attested only if it *begins* a clause — nine correct
  rows failed. `quoteDelims()` knew guillemets and straight quotes but not corner brackets, so
  every Notes citation in the Japanese lexicon was unchecked. And `isSubstantial()` counts words
  for spaced locales (min 3) but characters for unspaced ones (min 8), **and the two thresholds
  do not select the same keys**: six do-not-translate product names are 1–2 words, so no spaced
  locale could ever see them, while all six clear 8 characters. The general lesson is the one to
  carry: **an allowlist that looks complete after a spaced locale proves nothing for an unspaced
  one, and the gap arrives as a batch, not a trickle.**
- **The numeral word axis is not uncalibrated, it is inapplicable.** Japanese nouns have no
  number, so no numeral can disagree with one. Treating that grammar fact as a missing
  calibration would have produced the identical escalation every round with a different word.
  `ja` joined `tr` in `NUMERAL_WORD_AXIS_INAPPLICABLE_LOCALES` — with the real Japanese hazard
  named in the same place so the section does not read as "nothing to check".
- **Counters are the real hazard, and no regex can see them.** The lexical choice of counter
  per counted object (件 records, 行 rows, 語 terms, 文字 characters) is a per-object decision
  handled by a table in the style guide. It bit twice: four password-policy keys counted
  characters with the generic counter as `<li>` siblings of a key that used 文字, in one list.
- **Width is not character count.** A full-width glyph is about twice a Latin advance, so every
  budget had to be re-derived in pixels.
- **ASCII punctuation assumptions in product code.** A toast helper stripped a trailing colon
  with an ASCII-only `.replace()`; a value ending in the full-width stop terminated a sentence
  before the support address the component appends to it; hardcoded ASCII colons in JSX put
  half-width punctuation into Japanese text that no string can fix. **Korean and both Chinese
  locales inherit all of these.**

### Turkish — agglutination, vowel harmony over placeholders, dotted-i casing

- **A suffix welded to a placeholder is correct only for values whose last vowel it agrees
  with** — a failure class none of the shipped languages had. Turkish settled it in batch 1 by
  putting an appositive head noun after every placeholder, and finished with **0 welded suffixes
  across 1,920 values and all 311 interpolating strings read by hand.** The detector could not
  see the class at all until it was extended mid-wave: `{{model}}'i` passed while a correct
  `{{total}} girdi` failed.
- **Dotted-i casing, and it is the wave's best finding because it is a product defect no guard
  could ever see.** `index.html` shipped a static `lang="en"` and nothing ever updated it. CSS
  `text-transform: uppercase` is language-sensitive **only** through `lang`, and the app
  uppercases labels in run details, guide group headings and the AI-review columns — so Turkish
  dotted *i* uppercased to `I` instead of `İ` and "Çeviri" rendered as "ÇEVIRI", misspelt.
  Twelve shipped Turkish labels affected. The JSON is correct and only the rendering is wrong,
  so parity, the pre-flight and every typography sweep pass. It took a Turkish batch to surface
  it, and it was already user-facing: `es` and `fr` are selectable today and had been announcing
  themselves to screen readers as English. Fixed in product code with a test written to fail
  first, and **no string was hand-compensated for it** — that was an explicit non-goal and the
  re-review verified it by diffing the whole tree and sweeping for all-caps tokens.
- **Latin script is a guard exposure, not a guard relief.** The citation guard skips a quoted
  span containing no non-ASCII letter — but only for `NON_LATIN_SCRIPT_LOCALES`. So a Russian or
  Japanese English-gloss is dropped automatically and a Latin-script locale's cannot be, which
  is why Turkish and German are the two exposed locales and why an English gloss beside a key
  reads as an asserted rendering. It cost Turkish findings in three separate rounds.
- **The numeral word axis is moot here too** — Turkish nouns do not inflect after a numeral —
  which resolved a recorded debt better than the debt assumed.
- **Turkish supplies `_one` where English has none.** Four `vault` families are `bare + _other`
  in English, and strict parity refuses the bare-key rescue, so Turkish (and German) must add
  the singular even when it is byte-identical to the plural. Two of the four are byte-identical
  precisely *because* a counted noun stays bare-singular after a numeral — the gate wants the
  category, not a different wording.

---

## 15. Wave size for the remaining eight

The eight are `it`, `pt-br`, `id`, `vi`, `th`, `ko`, `zh-hans`, `zh-hant`.

**Recommendation: two waves of four. Not one wave of eight, and not eight sequential
languages.**

### The evidence, strongest first

1. **The two costs that produced wave 1's only shipped-string Criticals both scale linearly
   with concurrent languages, and neither has a mechanism proven at scale.** A controller false
   premise reaching every in-flight language, and an additive authority row binding a batch
   already running, are section 13's items 1 and 2. The countermeasure for the second — diff the
   frozen authorities immediately before the final gate run — was written in the last round of
   wave 1 and has been exercised exactly once. Four languages is a 33% increase on a process
   whose defences are one round old. Eight is a 167% increase.
2. **Controller load is the binding constraint, not translator load.** Per-language cost is
   almost independent of how many siblings run: ~27 agent dispatches each (6 translate, 6
   review, ~9 fix, ~4 re-review, 1 sweep, 1 sweep-fix), and ~23 minutes per translation round
   whatever else is happening. Four languages is ~108 dispatches and a 24-state machine to walk
   by grep; eight is ~216 and 48 states. The wave-1 controller dropped a required dispatch four
   times out of six rounds with three languages, was caught only by the grep every time, and its
   own diagnosis is that the misses cluster immediately after long narration — which grows with
   language count.
3. **Nothing in the per-language numbers argues for a bigger wave.** Wall clock per round is
   flat, findings per round are flat, and neither depends on the sibling count. There is no
   economy of scale in the translation itself. The only thing that genuinely amortises is a
   tooling fix, and three languages already surfaced the main guard defects in three different
   directions — the marginal guard defect found by language five is a much weaker bet than the
   marginal coordination failure caused by it.

### Composition matters more than the count — split by exposure, not alphabetically

**Script exposure.** `NON_LATIN_SCRIPT_LOCALES` is `{ru, ja, ko, zh-hans, zh-hant, th}`, so of
the eight:

- **Latin-script — `it`, `pt-br`, `id`, `vi` (four).** They inherit the exposure German and
  Turkish paid for: an English gloss in a Latin-script guide cannot be auto-dropped and is read
  as an asserted rendering, so backticked identifiers, parenthesised glosses and English quoted
  beside a key all produce findings. **`id` is the extreme case** — Indonesian orthography uses
  no diacritics at all, so *no* non-ASCII heuristic can ever separate an Indonesian rendering
  from an English gloss, and Indonesian borrows heavily from English computing vocabulary, so
  legitimate identical-value collisions will be common rather than exceptional.
- **Non-Latin — `th`, `ko`, `zh-hans`, `zh-hant` (four).** All four inherit Japanese's fixes
  (corner brackets, unspaced attestation, `isSubstantial` character thresholds, the full-width
  punctuation traps in product code).

**Unspaced, and one calibration to test early.** Genuinely unspaced: `th`, `zh-hans`,
`zh-hant`. **`ko` is in `UNSPACED_SCRIPT_LOCALES` and Korean is spaced.** Nobody has tested
that, and it has two live consequences: `isSubstantial()` uses a character threshold of 8 for
`ko` instead of a 3-word minimum, and the numeral-agreement matcher uses `\s*` instead of
`\s+`, which widens the raw match set for a language that does use spaces. **Check it on
Korean's first batch, not at its sweep.**

**Plural categories, verified against `Intl.PluralRules`, with the landing key count each
implies:**

| Locale | CLDR categories | Reachable | Lands at |
| --- | --- | --- | --- |
| `it`, `pt-br` | one, many, other | one/other (`many` is exact millions, grandfathered in `COVERAGE_GAP_GRANDFATHER`) | **1,920** — must supply the twelve `_one` forms |
| `id`, `vi`, `th`, `ko`, `zh-hans`, `zh-hant` | other | other | **1,879** — the 29 `_one` keys collapse |

That is a projection the next plan can check on day one, and it is the figure the runbook got
wrong before: its key-budget rule at 2.10 said a one/other language needs no extra keys. It
needs twelve, because strict parity refuses the bare-key rescue that keeps `es`/`fr` at
English's count.

### Proposed composition

Two groups of four, in this order:

- **The first of the two — `it`, `pt-br`, `ko`, `th`.** `it` and `pt-br` must run together: their
  grandfathered `many` and the one expected strict-mode failure are the same investigation, and
  splitting them pays it twice. `ko` is the calibration test above and is the cheap way to find
  out whether the unspaced set is over-broad *before* two Chinese locales depend on it. `th` is
  the first unspaced language outside CJK and the first with no word boundaries at all for the
  length budgets.
- **The second — `id`, `vi`, `zh-hans`, `zh-hant`.** `id` and `vi` carry the Latin-script gloss
  exposure with `id` at its extreme. `zh-hans` and `zh-hant` run together deliberately: they are
  the one pair in the programme where copying another locale's file is genuinely tempting, so
  the rule against it should be enforced where it is hardest, once, with both under review at
  the same time.

Batch structure inside a wave is unchanged: the runbook's six batches, one round at a time, no
round N+1 until all of round N is complete.

---

## 16. The false-premise pattern, and the verification methods worth keeping

This wave produced roughly twenty false premises across six rounds. **The count is not the
finding; the distribution and the shape are.**

### Who wrote them

**The largest single source was the controller — at least ten of the twenty — not any
translator.** That is not carelessness, it is structural: the controller is the only agent that
writes into files every language reads, so its unchecked sentence has the blast radius of the
whole wave while a translator's has the blast radius of one locale. The instances included the
tab-bar container claim, the collision mechanism, the reason attached to a granted allowlist
entry, a claim about what labels later batches would meet, an offered option that would have
failed its own gate, a runbook rule about the citation extractor, a code comment about a call
site, and an ordinal renumbered inside the very edit that claimed to stop relying on ordinals.
**A coordinator writing into a shared authority needs a higher evidence standard than anyone
else in the loop, not a lower one — and "two agents agree" is not evidence about a call site.**

### The shape that matters

**In most of them the conclusion was right and only the reason was wrong.** That is the failure
mode that hides best: nothing downstream breaks, so nothing signals, and the wrong reason
survives into the file the next batch opens *first*. It appeared in all three languages
independently. Three times a **correction was itself wrong** — a repaired sentence is a new
claim and inherits none of the old one's checking, and verifying the old claim *feels* like
verifying the paragraph. Corrections are therefore left visible in the files rather than
quietly rewritten, so nobody restores them.

### Where they live migrated over the wave

Rounds 1–2's false premises were about call sites and container geometry — checkable in one
command, and several were caught that way. By the end, **every finding in the three
whole-language sweeps but one was in a document rather than a string** (26 findings, one string
change, and that one a known carry). The class is specific: **a claim that was true or
unfalsifiable when it was written and became checkable later**, usually the moment its
namespace shipped. One such claim flipped from true to false thirty minutes after it was
written, when the guard it described was extended in the same session.

Note one thing the wave did *not* do, so it is not repeated as a slogan: the last two
*translation* rounds were not document-only. Batch 6's reviews produced a Critical in German
and a Critical in Japanese, each of which changed shipped strings. It is the **sweeps** that
were document-only, and that is the checkable version of the claim.

The asymmetry to fix in wave 2: the **citation** half of this class now has a mechanism — the
guard prints unchecked citations as a NOTE instead of silently dropping them, and 34 spans moved
from outside the guard to inside during the sweeps alone. **The prose half has nothing.** Write
a claim so a later reader can falsify it: name the file and the symbol, give the command, and
prefer a claim a script can re-run to a number counted once. **A count in a document is a fact
about the moment it was written; a method is a fact about the code.**

### The verification methods invented mid-wave — the wave's real yield

These are transferable to any language and any wave, and each replaced an argument with a run.

1. **Prove the sweep can fail — plant a defect and watch it fire.** Extract the command from
   the document, run it *verbatim* (which caught a leaked shell-quoting artefact that would not
   have parsed), then plant a file containing every defect shape the command claims to catch and
   confirm each one fires while a clean control stays silent. The reasoning is the point: **a
   replacement that is merely different from a broken command repeats the defect.** Turkish did
   this in batch 6 and still left a third broken command two rows away — a register sweep
   carrying markdown pipe-escaping into an ERE, so it searched for a literal alternation string
   and returned zero against a corpus *with a planted defect*. The final fix retired the class:
   all six sweeps became one runner over parsed values, every rule proven able to fire, so a
   seventh rule cannot be added without inheriting the control.
2. **Inject a fake citation to test a guard.** A style guide claimed twice that nothing guarded
   it. Rather than argue from the script's source, the batch injected a fake citation and watched
   the guard print FAIL. One command settled a standing tooling claim that had already survived
   three passes elsewhere by being merely re-read.
3. **Enumerate the token set list-free, rather than scanning for known forms.** The German
   imperative count was wrong four times running and every correction was a better search of the
   same list. The replacement does not search: split all 1,638 values at *every* clause boundary
   including dashes and coordinating conjunctions, enumerate the ~800 distinct clause-initial
   tokens and **read the whole set**; then close the fronted-adverbial hole by enumerating the
   ~500 distinct clause-second tokens. The same discipline closed the ß check by enumerating all
   77 `ss` and 22 `ß` words instead of grepping for known pairs. **A negative result from a list
   is not evidence of absence.** And it relapsed once, instructively: an enumeration printed
   through a hand-written display filter silently dropped a key the paragraph had named for two
   rounds — **a list you write to look at the answer is still a list.** Both token counts are
   marked stale by construction: re-enumerate, never reuse.
4. **Derive a budget from font metrics, not from an estimate.** Every length budget in the wave
   started as an estimate and every one was wrong when measured. Turkish's "199px ÷ 7.09px = 28
   characters" used one label's own density; measured with real Geist advances across the whole
   25-label class the mean is 6.741 px/char (29.5 chars) and the densest label 7.308 (27.2), so
   the proxy is a range with both figures stated. German's hard 26 became **25** after rendering
   all 27 rail labels from the shipped variable font — 26 characters at the corpus's wide end
   renders at 214px against a 199px slot and would clip. Japanese's in-panel sub-tab budget of 12
   had been set from batch 1's three members and turned out to be *exactly* the whole-class
   maximum — zero headroom, so a correct 13-glyph label would have read as over budget; measured
   whole-class it became 13.
5. **Date the claim instead of arguing the timing.** `git log -S` on the row and
   `git merge-base --is-ancestor` on the commit settled two accusations of ignoring a frozen
   authority: German exonerated (neither row existed in what it read), Japanese convicted (the
   row was in its immediate parent). One query replaces an argument — and it is what turned
   "read the authorities more carefully" into the correct rule, which is that **de's failure was
   not at read time at all**, so the check must be a diff of the frozen authorities immediately
   before the final gate run.
6. **Measure a fix's payoff against both trees.** `git archive <parent>` into a scratch
   directory, run the tool against both, report the delta (collision groups 31 → 30, the
   offending group gone entirely). Measuring an effect costs the same as asserting it.

---

## 17. Numbers to reuse (wave 1)

- **The English surface is unchanged**: 1,908 keys, 24 namespaces, 52,591 characters,
  re-derived at this tree.
- **Landing key counts.** Two reachable plural categories → **1,920** (English's 1,908 plus the
  twelve `_one` forms the `bare + _other` families need under strict parity). One category →
  **1,879** (1,908 − 29 `_one`). Verified for `de`/`tr` and `ja`; projected for the remaining
  eight in section 15.
- **Translator wall clock: ~23 minutes per round, ±4**, essentially independent of batch size
  between 123 and 452 keys and between 1 and 7 namespaces. Whole language 128–146 minutes.
  Character-per-minute throughput is an *output* of this, not an input.
- **Per-language agent cost: ~27 dispatches** — 6 translate, 6 review, ~9 fix, ~4 re-review, 1
  whole-language sweep, 1 sweep-fix. Fix rounds stayed cheap and were never re-translations;
  from batch 3 onward most were documentation-only.
- **Findings: ~9 per round per language regardless of batch size** (r² = 0.05 against English
  key count over 18 rounds). Whole-language 2.5–3.4 per 100 keys, unchanged from the pilot's
  2.80. Criticals 2–3 per language over six rounds plus the sweep. Batch 1 rate 2.14–3.48
  against the pilot's 5.61 — that drop is what the frozen artifacts bought.
- **Expansion over the shared-key population, re-derived after the last edit:** `de` 1.2577
  aggregate / 1.2414 median / 1.6667 p90 / 3.75 max over 1,908; `tr` 1.1088 / 1.0845 / 1.5556 /
  3.3333 over 1,908; `ja` 0.5641 / 0.5625 / 0.8182 / 1.5000 over 1,879. On the identical
  1,908-key population `ru` is 1.1862, `es` 1.2187, `fr` 1.2576 — **German is indistinguishable
  from French.**
- **Character totals:** `de` 66,875, `ja` 29,087, `tr` 58,918, against English's 52,591.
- **Gate state at the close of the wave**, for comparison at the close of wave 2:
  `check:locales` 7 locales / 24 namespaces / 11,537 values with nothing deferred; pre-flight 0
  numeral-agreement survivors and 0 welded suffixes for `de`/`ja`/`tr`/`ru`; the citation guard
  607 citations across 6 style guides plus 314 lexicon rows, with the unqualified-key NOTE empty
  for every locale; the hygiene gate 926 files, 0 hits.
- **The work-in-progress mechanism discharged exactly as designed.** At no point in six rounds
  was a partially translated language green: each locale was held to every rule except "is every
  English namespace present" from its first file to its last, and the gate demanded its own
  `WIP_LOCALES` declaration be deleted the moment that deferral went vacuous.

### Open items wave 1 leaves for the next plan

1. **The localized legal documents exist for `es` alone, and `legal-links.ts` has
   `LOCALIZED = new Set(['es'])`, so all six legal links in `de`, `fr`, `ja`, `ru` and `tr`
   open English policy documents.**
   Confirmed on disk. Its JSDoc also claims `fr` is prefixed, which is true neither in the set
   nor on disk. Not a translation defect and not in any translator's scope.
2. **Two keys have no call site** — `vault:remove` and `sidebar:colorText`, each confirmed by
   two independent agents. `sidebar:colorText` is the longest value in Turkish's hard length
   class, i.e. a key that constrains a budget while rendering nowhere. A reachability sweep
   before eight more languages pay to translate them costs an hour.
3. **A guard papercut, hit by three separate locales in three consecutive rounds:** a backticked
   identifier containing parentheses breaks the key-span exemption and is read as an asserted
   rendering.
4. **The attestation corpus is not namespace-scoped**, so the guard proves a rendering exists
   *somewhere in the locale*, never that it is attached to the key that claims it. Both Turkish's
   and Japanese's sweeps had to check attachment by hand across all 76 lexicon rows. Measuring
   the blast radius of namespace-scoping it was attempted once during the wave and the
   measurement returned zero for every locale, which is a broken measurement rather than a
   finding — re-measure properly before deciding.
5. **Seven terms were requested for the additive queue in batch 5 and never filed.** They are
   now filed and resolved in `terminology/README.md`; the lesson is that a shared file with one
   writer loses requests silently.
