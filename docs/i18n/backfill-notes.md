# Backfill notes — what the Russian pilot measured

Russian was translated first, alone, so that the eleven locales after it are planned from
measurements rather than from a guess. This file is that measurement. It records what the
work cost, which of the pipeline's choices were wrong, what review actually caught, and
what the translator's brief has to carry on day one that this one did not.

Read it with `terminology.md` and `style/ru.md`: those two say *what to write*, this says
*how to run the job*.

Scope of the pilot: 24 namespaces, 1931 English keys, 2025 Russian keys (the extra 94 are
`_few` / `_many` forms English has no counterpart for), 53,147 English characters in,
67,736 Russian characters out.

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

Findings per 100 English keys, in batch order: **5.6 → 3.0 → 2.0 → 1.3**. Criticals:
**3 → 1 → 0 → 0**. The last batch was the largest and had zero critical findings.

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
   one** (1 critical, 2 important). Grammatical, idiomatic, and false. This class did not
   stop occurring; it recurred in the last batch as modifier attachment rather than as
   pronouns.
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
counts, placeholder multisets, key order, plural coverage. All five are mechanically
guarded, which is why.

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
5. **The full surface-name set with the key pairs that must agree.** Seven surfaces, 16
   key pairs, several of them written by different translators in different batches.
6. **"Match the sibling's English, not its other-locale rendering."** The error class
   hides behind a virtue: the file looks *more* consistent, not less.
7. **The settled convention not to add a plural family over a plain English key**, and the
   fact that the guard would permit it. Verified across all four locales: 41 families
   each, zero added.
8. **The English defects that must not be mirrored**, each with the reason: a bulk action
   labelled "Approve" that really applies; three controls labelled "Provider" that select a
   module instance; a stale tab name in one notice; two theme names that already diverge
   between two locales in one shipped language.
9. **The reservation-scoping rule.** Every reservation must state which part of speech and
   which sense it binds. Four reservations written in this pilot had to be narrowed later,
   always the same way: a claim over a root or a bare word, backed by evidence that had
   only compared two terms.
10. **The measured expansion figure.** Russian is 1.19× English in characters over the
    shared keys, median 1.18 — *shorter* than both previously shipped locales (1.22 and
    1.26). The tail is what breaks chrome: the 90th percentile is 1.71.

---

## 6. Mechanical checks to run before review, not after

Everything here is cheap, scriptable, and — measured over four batches — either finds
defects the reviewer would otherwise spend attention on, or produces the evidence that
makes the reviewer's verdicts checkable. Run them as a pre-flight; hand the reviewer the
output.

1. **The numeral-agreement detector, both axes, in this order.**
   - *Token axis first:* skip every placeholder that cannot hold a number. In this app
     that is `count` (its family handles it) plus `module`, `instance`, `language`,
     `languages`, `lang`, `name`, `message`, `date`, `verdict`, `headers`, `model`,
     `keys`, `slug`, `type`, `focus`, `field`, `why`, `label`, `filename`, `id`, `time`,
     `passRate`. The last eight are missing from the list in `style/ru.md` and each one
     costs a false positive.
   - *Word axis second:* on what survives, clear invariant next words — prepositions and
     particles, invariant abbreviations, short and impersonal participles.
   - Run it token-axis-first: the word list exempts a word after *every* token and blunts
     the check as it grows. Over the finished 24 namespaces: 187 occurrences, 0 survivors.
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
6. **The pass-rate column header changed in this pass**, so the terminology row describing
   it as abbreviated is now stale; and one section of the Russian style guide still quotes
   an earlier rendering of a legal link label alongside the corrected one. Both are noted
   in the review report; neither blocks translation.
7. **The two authority documents were rewritten while batches were reading them.** For
   eleven parallel languages that is untenable. **Freeze both, cut the language-2 brief
   from the frozen text, and route new terms through an additive queue** — a translator
   filling their own locale column never conflicts with another, but a rule rewrite in
   mid-flight invalidates work already done.

---

## 9. Numbers to reuse

- 1931 English keys, 24 namespaces, 53,147 English characters — the whole surface, per
  language.
- Russian needed 94 extra keys (`_few` / `_many`); a language with two categories needs
  none, one with six needs more. Budget by the target's plural-category count.
- ~4h15m of translator wall clock for the whole language, plus four reviews, plus five fix
  rounds, plus ten rounds on the shared terminology file.
- The terminology file is the expensive shared artifact and it is now 76 terms deep. For
  language 2 it should cost only the per-locale column, not the rows — **if** the rows are
  frozen first.
- Expansion in characters over the shared keys: 1.19 for Russian, 1.22 and 1.26 for the
  two locales shipped before it. Chrome budgets are absolute character counts, not
  multiples of English.
