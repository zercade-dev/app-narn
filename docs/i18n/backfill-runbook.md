# Backfill runbook — how to translate one language

This is the procedure for adding one complete locale to this app. It exists so that the
per-language work is a short instruction plus this file, rather than a procedure
transcribed eleven times and drifting eleven ways.

Everything here was measured on the Russian pilot and is recorded, with its evidence, in
`backfill-notes.md`. Read that file if you want to know *why*; read this one to know
*what to do*. Where the two disagree, `backfill-notes.md` is the measurement and this file
is the instruction derived from it — say so rather than silently following one.

## Who reads what

| File | What it settles | Who writes it |
| --- | --- | --- |
| `terminology.md` | which word a domain term takes, and what it must not be confused with | frozen for the duration of the backfill |
| `terminology/<lang>.md` | your locale's rendering of each term, with its notes | you, for your language only (created by the pre-flight — see below) |
| `style/<lang>.md` | register, casing, punctuation, numbers, length budgets, placeholders | you, for your language only |
| `english-review-notes.md` | English defects, ambiguities and their intended reading | frozen; read it before batch 1 |
| `backfill-notes.md` | what the pilot cost and what it found | frozen; the evidence behind this file |
| this file | the procedure, the batches, the rubric, the rules | frozen |

Nobody writes another language's files. That is the property that lets several languages
run at the same time: a locale never reads another locale's rendering, so there is no
shared state and no merge conflict between them.

**Two precedence rules, both learned the expensive way.**

- **A term row fixes the lexeme. It does not fix the shape.** A row's `Example:` line
  shows the term in use; it is not a ruling that the cited key keeps that grammatical
  form. Take the *word* from the term row and the *form* from the control (see the
  control-shape section below). Getting this backwards is on screen in Russian right now:
  `sidebar:createProjectTitle` and `backup:createSection` are section titles that took the
  infinitive because their term rows quoted them, so `backup:createSection` sits directly
  above a sibling title written in the other shape.
- **Terms outrank the length budget.** The budget exists to stop *avoidable* length. If a
  term rule forces a long label, that is the term rule doing its job.

## The file you edit, and where you run things

**Your locale's strings live in `packages/frontend/src/locales/<lang>/<namespace>.json`** —
one file per namespace, the same 24 namespace filenames English has. If your language's
directory does not exist yet, **create each file by copying English's and translating in
place**:

```bash
mkdir -p packages/frontend/src/locales/<lang>
cp packages/frontend/src/locales/en/config.json packages/frontend/src/locales/<lang>/config.json
```

Copy-then-translate rather than writing a file from scratch: it makes key order match by
construction, which is a checked property, and it guarantees you never silently omit a key.
The one thing you do **not** carry over unchanged is the set of plural suffixes — see 2.7.
**Copy one batch's namespaces at a time, not all 24 up front.** Pre-copying is not merely
untidy: the work-in-progress declaration defers *missing namespace files*, so a locale that
already has all 24 defers nothing, and the gate will both report the declaration as stale
and red on every untranslated value at once. Create what you are about to translate.

**Working directory: every command in this file runs from the workspace root** — the
directory that contains `packages/frontend`, `Makefile`, `package.json` and `scripts/`.
More than one directory named `scripts/` exists in this checkout, so running a bare
`node scripts/…` from the wrong place fails with a "cannot find module" error that looks
exactly like a script that was never written. If a command cannot find its script, check
your working directory before concluding the tool is missing.

## Tooling this procedure assumes

All four ship on this branch, and all fourteen backfill languages already have their
`terminology/<lang>.md` lexicon file (empty until their first batch fills it in, but
present). Nothing here is a pre-flight deliverable still to be built.

- `pnpm check:locales` — the parity, placeholder, plural-coverage, key-order and length
  gate. Part of the release gate, so it must be green at every commit — **including yours,
  from batch 1, which is what the work-in-progress declaration below is for.** It defers one
  rule for a mid-backfill language and nothing else; read that section before you read a
  failure as expected, because almost none of them are.
- `LOCALE_PARITY_STRICT=<lang> pnpm check:locales` — the same gate, holding your locale to
  its language's complete plural-category set with no bare-key rescue. The variable takes a
  comma-separated list, so you can hold just the language you are backfilling.
- `pnpm i18n:preflight <lang>` (`node scripts/i18n-preflight.mjs <lang>`) — the
  numeral-agreement detector, both collision directions, and the `bare + _other` family
  list.
- `pnpm check:lexicon` (`node scripts/check-lexicon-citations.mjs`) — every rendering quoted
  in a lexicon file exists in the shipped locale files. `make verify` runs the `pnpm` form of
  both; CI runs the same two scripts through bare `node`, deliberately, so they still fire on
  a documentation-only change that skips the rest of the gate. Either form runs the same
  file, so use whichever you like — what matters is that you are running the checks
  themselves rather than an equivalent of your own.

## The work-in-progress declaration — the controller adds it at batch 1

**You do not add this yourself.** The wave controller adds one entry to `WIP_LOCALES` in
`scripts/locale-rules.mjs`, with a real reason, **in the commit that lands your batch 1**,
and deletes it at the whole-language sweep (section 7):

```js
export const WIP_LOCALES = {
  de: 'Backfill in flight — batches 1-6, tracked in <wherever the ledger lives>.',
};
```

**Two reasons it is the controller's and not yours.** It cannot be added in advance: a
declaration naming a locale with no directory is itself a hard failure, by design, so the
entry and your first namespace file have to arrive together. And it is the one file in this
procedure that several languages touch at once — everything else you write is yours alone —
so a wave running three languages in parallel would otherwise be three agents editing one
file. In this wave only the controller commits, which makes that a non-issue rather than a
merge to resolve. If you find yourself wanting to edit `WIP_LOCALES`, say so and let the
controller do it.

**Why it exists.** Each batch creates its own namespaces, so between batch 1 and batch 6
your locale *directory* is incomplete by construction. Measured on a synthetic German
locale against the real rules: after batch 1, holding a translated `config.json` and
nothing else, `pnpm check:locales` reports **23 hard failures**, one per namespace nobody
has reached. Not a defect, and not fixable before the last batch. The declaration is what
makes "green at every commit" a true statement rather than one everybody learns to ignore.

**What it turns off — one rule, and only this one:**

- namespace files English has that you have not created yet.

**What stays on, from batch 1, with no softening whatsoever:** key parity *within* every
namespace you have created, placeholder integrity, do-not-translate terms, key order,
length sanity, legal plural suffixes, plural-category coverage, **and values byte-identical
to English**. Those are the checks that catch a defect you can fix today, and one of them
going red means the batch is **wrong**, not unfinished. A namespace file with no English
counterpart also still fails — that is a stale or misnamed file, a defect at any point in a
backfill.

**The identical-value rule is deliberately not deferred, and it was, briefly.** The
argument for deferring it was that pre-copying all 24 English files is the other way to
hold a partial locale, and in that shape the rule fires on hundreds of values. But the
checks only ever compare namespaces your locale *has*, so under the procedure below — copy
this batch's namespaces, no others — the rule has nothing to false-positive on. Deferring
it bought a correct batch nothing and cost two things: it blessed the pre-copy shape, and
it hid a value you pasted from English and never came back to, inside a namespace you did
translate, until the declaration was lifted five batches later. It now reds in the batch
that wrote it, which is where it is cheapest to fix.

**Two identical-value figures circulate; they count different things.** **735** is the
whole-language number — every substantial value across all 24 pre-copied namespaces of a
synthetic German locale. **191** is `config` alone, one namespace. Neither contradicts the
other, and both were measured on the same corpus; quote the population with the number.

**`LOCALE_PARITY_STRICT` is unaffected in both directions.** It is a plural-coverage
setting and has no opinion about which namespace files exist, so the two never collide.
`LOCALE_PARITY_STRICT=<lang> pnpm check:locales` on a declared locale is the strictest
reading available of a partial language: every plural family you have already written is
held to your language's complete category set, with no bare-key rescue and no
grandfathering, while the batches you have not reached are not called missing. **That is
the command to run from batch 1** — mechanical check 2 below — and it is green on a correct
partial batch.

**Every run prints the declaration**, with its reason and its count, so the state is visible
in the log of every check anyone runs while you are mid-flight:

```
check-locales: NOTE — 1 locale(s) declared work-in-progress. The namespace files they have
not created yet are NOT checked; every other rule is, including values identical to en:
  de: 23 namespace file(s) not created yet — deferred and NOT checked. Every other rule
  applies. Reason: Backfill in flight — batches 1-6, …
```

**Nobody can forget to lift it.** The moment the last namespace file lands, the entry defers
nothing and `pnpm check:locales` goes **red** asking for its deletion:

```
check-locales: FAIL — WIP_LOCALES entries that defer nothing (every namespace has landed —
delete them)
  de: every en namespace is present, so this language is no longer incomplete by
  construction — delete the WIP_LOCALES entry and let the full gate apply to it
```

The controller deletes it in the whole-language-sweep commit (section 7). Removing it
applies the full gate with nothing weakened; if it goes red after removal, that is a real
finding, and it is the only moment in the backfill where the deferred rule can speak.

**A declared locale must not reach `develop`.** While the entry exists, one rule is off for
that language, and a merged declaration means it is off for everyone on the branch — for
however long the language takes. The whole backfill of a language lands as **one PR**, with
the declaration added in its first commit and deleted in its last, so `develop` never
carries one. This wave happens to be structurally safe (one worktree, one PR per language),
but the next eight languages are not automatically so: if a wave ever needs to land a
partial language on `develop`, that is a decision to take deliberately and write down, not
a side effect of a long-running branch.

---

## 1. The batch table

Six batches. **Sized by namespace count, not by character count** — the pilot sized by
characters and that was the wrong axis. Its four batches came out at 13.0k / 10.1k / 15.5k
/ 14.5k characters, a 1.5x spread, so the sizing did not even achieve what it aimed at;
wall clock came out 35 / 35 / 75 / 130 minutes, a 3.7x spread that tracks namespace count
(1 / 1 / 5 / 17) almost exactly. A batch of seventeen small namespaces is not one unit of
work; it is seventeen units of "which control is this, what does its English sibling say,
which surface name does it repeat".

| Batch | Namespaces | en keys | en chars |
| --- | --- | --- | --- |
| 1 | `config` | 374 | 13,015 |
| 2 | `strings` | 452 | 9,900 |
| 3 | `glossary` `review` `category` `quality` | 377 | 10,744 |
| 4 | `collab` `account` `vault` `settings` `sidebar` | 300 | 7,851 |
| 5 | `logs` `console` `system` `errors` `generation` `batch` | 123 | 4,567 |
| 6 | `stage-details` `colorText` `orphans` `backup` `welcome` `common` `legal` | 282 | 6,514 |

**Totals: 1,908 keys and 52,591 characters across 24 namespaces** — the whole surface, per
language, measured over the current (post-reachability-sweep) corpus. The reachability
sweep in `backfill-notes.md` section 8 removed 23 dead keys from every locale after this
table was first measured; re-measure with the same `loadLocales`/`flattenEntries` pass
over `packages/frontend/src/locales` if the corpus moves again.

**The order and the grouping, and why each is what it is.**

- **`config` first, alone.** It is the densest namespace, it exercises most of the
  vocabulary, and translating it produced seven terms the lexicon lacked. Everything after
  it was cheaper because of it.
- **`strings` second, alone.** It owns the tab labels, which are the surface names every
  later namespace has to repeat verbatim. Any batch that names a surface before the tab
  label ships is guessing.
- **Batch 3 is verdicts and quality vocabulary** — glossary terms, review findings,
  categories, LQA check names. One register, one vocabulary, one reviewer mode.
- **Batch 4 is identity and access chrome** — collaborators, accounts, the vault, settings,
  the sidebar. Forms, statuses and permission errors.
- **Batch 5 is machine narration** — log lines, the console, system notices, error text,
  generation and batching messages. Count-neutral, almost no chrome, a plain narrative
  register.
- **Batch 6 is the long tail** — seven small namespaces with nothing in common but their
  size. Deliberately last, when every precedent it needs already exists in a shipped file.

**The boundary the pilot got wrong, so you do not repeat it:** it put `logs` (narration,
count-neutral, no chrome) in the same batch as `collab` (forms, statuses, errors). They
share no vocabulary, and the reviewer had to switch mode repeatedly inside one review.
**Group by register, not by alphabet, and keep the wide batch last.**

**The counts are a sizing aid, not a gate.** They are measured from the English source, so
a key added or removed moves a row. Re-measure rather than trusting this table if you have
reason to think it has moved:

```bash
node -e 'const fs=require("fs");let k=0,c=0;const w=(o)=>{for(const v of Object.values(o))v&&typeof v==="object"?w(v):(k++,c+=String(v).length)};for(const f of process.argv.slice(1))w(JSON.parse(fs.readFileSync(f,"utf8")));console.log(k,c)' packages/frontend/src/locales/en/glossary.json packages/frontend/src/locales/en/review.json packages/frontend/src/locales/en/category.json packages/frontend/src/locales/en/quality.json
```

### What a batch costs

Throughput, in English characters per minute of translator wall clock, measured in batch
order over the pilot: **372, 288, 207, 112**. It falls monotonically as the namespace count
rises and has **no** relationship to character count — the per-namespace fixed costs
dominate everything else. Re-reading the two authorities for the terms that namespace
touches, resolving call sites, re-reading the previous batch's shipped file to match
precedents: that is where the time goes.

Plan on roughly **250 English characters per minute for a one- or two-namespace batch and
~110 for a wide one**, plus about ten minutes per fix round, plus the review. The whole
language was about 4h15m of translator wall clock, plus the reviews and the fix rounds.

Fix rounds are cheap and should stay that way: every one in the pilot was a list of
one-line edits, and no batch was ever re-translated.

**Expect the finding rate to fall, and know why.** Findings per 100 English keys came out
**5.6, 3.0, 2.0, 1.5** in batch order; criticals **3, 1, 0, 0**. That rate counts every
finding of any severity — on string defects alone the last batch is 1.2, because both of its
Importants were process findings rather than defects in a string. That is not translators
getting better — each batch had a different one. It is the artifacts filling up. Every
finding in the first two batches that generalised was written into the lexicon or the style
file before the third batch started, and the third and fourth batches then did not make
those mistakes. If your rate is *not* falling, the artifacts are not being updated.

---

## 2. What you must know before you write the first string

Every item below was discovered by *translating* in the pilot, not by reviewing, and every
one cost a batch or a round to find. None of it is visible from a locale file.

### 2.1 Resolve the control before you translate the string

English writes the same words for a title, a button, a column header and a placeholder.
Most languages do not. `config:models.select` and `config:models.pickTitle` are
byte-identical in English ("Select a model") and are two different controls.

The shapes Russian settled on, as the worked example:

- **Titles, tab labels and section headings are noun phrases** — and a dialog title takes
  the deverbal noun for the same reason.
- **A confirm-dialog title is the exception and takes the infinitive.** It names the action
  you are about to authorize, not a section you are looking at. Keep English's question
  mark where it has one and leave it off where it does not; the source is inconsistent
  about it, and matching per key is what stops a reviewer "fixing" one of them.
- **Buttons are infinitives**, where the English is a bare verb.
- **Table column headers are bare nouns, and they keep English's abbreviation** where it
  has one. A header is chrome, and the length budget bites hardest here.
- **Placeholders inside a control are imperatives**, not titles.

A verbal noun is a **status**, not a command: use it for progress text, never for a button.

**Which shapes your language uses is your decision. That you decide them once, before the
first string, and write them into `style/<lang>.md`, is not.** The pilot's first batch
invented this convention for 374 keys; had it not been written down immediately, the other
three batches would each have invented their own.

**A word English reuses across controls does not have one rendering, and forcing one is the
error.** Russian's standing example is "Custom": as an adjective before a noun it agrees
normally, but as a bare select option it cannot stand alone idiomatically at all, so the
option names what it configures instead. Resolve the control, then choose; do not chase
consistency across two controls that are not the same control.

### 2.2 Only `count` triggers plural selection

Every other numeric token is a plural trigger the framework cannot see, and the failure
mode is silent: the string is grammatical for some values of the token and wrong for
others, so it passes every guard and every spot-check that happens to use a number ending
in 1. `{{total}}`, `{{maxLength}}`, `{{tokens}}`, `{{entryCount}}` and their kind get **no**
category — there is no plural key to write, because the framework never looks for one.

This was the pilot's highest-cost defect class: two of its four criticals, both in the
first two batches. One lived in an `aria-label`, where a screen reader speaks the
ungrammatical form verbatim.

So a numeric token that is not `count` must sit in a frame that is **grammatical for every
value it can take**. The devices, in order of preference:

1. **The number after an invariant noun phrase, behind a colon or in brackets.** The
   count-neutral device that works in the most languages.
2. **An abbreviation that does not inflect**, where the full word would be right only for
   some values.
3. **A bare ratio or fraction with no noun at all** — `{{done}}/{{total}}`.

If you cannot find a frame, say so rather than shipping a string that is right one time in
three.

**Do not reach for the obvious alternative — the guard blocks it.** Interpolating `{{count}}`
instead, so the displayed number and the selected number are one variable, fails placeholder
integrity: the guard compares the **multiset** of tokens against English, and English writes
`{{total}}`. Dropping the English token and adding a new one is two violations, not a clever
fix. The count-neutral wording is forced, not preferred.

**One recorded case where the count-neutral frame costs something.**
`logs:translation.queued` and `logs:sourceReview.done` each display a non-`count` token
while their plural family selects on `count`, and the log-presentation registry happens to
set both members of each pair from the same value — so inflecting after the token *would*
have been correct in those two strings. They are count-neutral anyway, deliberately: the
guarantee lives in a different file from the string, so a later change there would break the
grammar silently and nothing would fail. Those two log lines lose a singular/plural
distinction English has. Do not "restore" it without re-reading the registry and deciding
to depend on it.

### 2.3 The `bare + _other` families — all twelve, and the mechanism

Twelve English families are shaped `key` plus `key_other`, with **no** `key_one`. This is a
mechanical property of the English source, not a per-language discovery, so it is the same
list for every locale:

`console:unreadErrors` · `console:membersNotShown` · `logs:translation.queued` ·
`logs:translation.failedNoRoute` · `logs:translation.failedModuleDisabled` ·
`logs:translation.failedModuleNotFound` · `logs:sourceReview.done` · `logs:orphan.detected` ·
`vault:keysCount` · `vault:remainingAttemptsHint` · `vault:retrySuccess` · `vault:retryFailed`

**The mechanism, which nothing in the locale files shows you.** Your `foo_one` has no
English counterpart, so reference resolution falls back to `en:foo_other`, and only then to
the bare `en:foo`. The placeholder check compares your string's tokens against whichever it
landed on — and it never reaches the bare key once `_other` exists. English's *singular*
here is the bare key. So a true singular can fail the guard for a token English's own
singular does not have.

The worked example, `vault:retrySuccess`: the bare key is "Unlocked — your action went
through." with **no** token, and `_other` is "Unlocked — all {{count}} actions went
through." A correct singular without `{{count}}` therefore fails.

**What the constraint forces is the token, not sameness.** Put `{{count}}` in every category
and then inflect them normally. Four identical count-neutral strings would also pass the
guard and that is the wrong lesson — it throws away the plural machinery for no guard reason
and reads worst at `count: 1`, the commonest case. Make the categories differ.

**Eleven of the twelve carry identical token sets in the bare key and in `_other`**, so the
constraint binds without ever being visible. `vault:retrySuccess` is the **only**
token-asymmetric one. `vault:retryFailed` is the opposite case — *neither* form carries a
token, so no form of yours may add a number at all.

**Write the bare key count-neutral too.** Once all your categories exist it is unreachable,
so its only remaining job is to be grammatical if something ever does reach it.

**Check English's `_other`, not English's bare key, before writing your singular.**

### 2.4 Length budgets are absolute character counts, per class

**Never a multiple of English.** The pilot's style guide said "never exceed ~1.5x the
English character count" with two recorded exceptions, and that rule was false the day it
was written: an audit of every constrained-surface key across all 24 namespaces found
**27** over 1.5x, in every batch, including tab labels at 2.50x and a sidebar item at 3.80x.
Nothing was wrong with those strings.

It was wrong in two ways, and both matter to you:

- **A ratio is the wrong unit when the English is short.** Every one of the 27 was flagged
  for having a short *source*, not a long rendering. `sidebar:legal` is "Legal" — five
  characters, so 1.5x is seven and a half, and no correct rendering of it can exist in most
  languages. The ratio measures the wrong thing: a long English source buys slack a tight
  control does not actually have, and a short one denies slack a loose control could afford.
- **The five constrained classes are not equally constrained.** Only one has a hard, fixed
  width: the sidebar is `16rem` (`SIDEBAR_WIDTH` in `components/ui/sidebar.tsx`) and every
  item label is wrapped in `truncate`, so overflow ellipsizes. Tab bars, table columns and
  filter rows scroll, auto-size or wrap — going long there costs elegance, not correctness.

The five classes, with the key each is anchored on:

| Class | Anchor key | Kind |
| --- | --- | --- |
| Sidebar item | `sidebar:globalConfig`, `sidebar:legal` | **hard** — fixed `16rem`, truncates |
| Tab label | `strings:tabs.backup` | soft |
| Table column header | `strings:columns.config` | soft |
| Filter label | `strings:filters.needsReview` | soft |
| Bulk-bar control | `strings:bulk.approveSelected` | soft |

**The numbers are per language, and yours are not Russian's.** Derive them the way the
pilot did: for the sidebar, from the container; for the other four, from the longest value
that language ships, plus headroom. Write the resulting five numbers into
`style/<lang>.md`. **Hard** means fix it — a sidebar item over budget is cut off in a
container that cannot grow. **Soft** means prefer the shorter of two correct options, but
do not distort a term to hit a number and do not treat the figure as a failure threshold.
Nobody has measured rendered pixel widths; if you need to go past a hard budget, look at
the running app before you decide — a measurement beats the table.

**There is deliberately no exception ledger.** The pilot's recorded two of twenty-seven and
nobody noticed for four rounds, because a hand-maintained list of per-key exemptions goes
stale silently and invisibly.

**The guard's own length check is a separate, cruder thing:** a ratio cap on
`lengthOffenders` in `scripts/locale-rules.mjs`. A correct rendering can breach it. Russian's
`legal:cookies` fits only because a shorter defensible rendering existed — all three fuller
standard Russian forms breach the cap against a 13-character English source — and any
language whose legal formulae are long will meet the same wall. **Escalate for a per-key
exemption rather than distorting the rendering.**

### 2.5 Surface names: one rendering, repeated verbatim

A surface — a tab, a page, a tool — does not have one key. Its name is written out two or
three times, in different namespaces: the tab label, the page or section title the tab
opens, sometimes a sidebar item or a guide topic, and often inside a sentence in a third
namespace ("…from the Translations tab").

> **The rule:** every key that names the same surface gets the **same rendering**, and
> prose that mentions the surface repeats that rendering verbatim.

This is the single highest-frequency drift risk in this app, because the two keys are never
on screen at the same moment — and because the namespace naming a surface and the namespace
owning it are usually translated by different people, in different batches.

`terminology.md` is the authority for the full set. As it stands it names **ten surfaces
across twenty-one keys** in its table, plus **three more that have no second title key** and
are named only in prose from another namespace — Compare (`strings:tabs.compare`, named by
`config:routing.tonesHint`), Translations (`strings:tabs.strings`, named by
`config:routing.categoriesConfiguredHint`) and Backup (`strings:tabs.backup`, named by
`config:importSnapshotNote`). Read that section; do not work from this summary.

Two relationships that look like drift and are not, so you do not "fix" them:

- **The Activity page title is deliberately longer than its tab label.**
  `strings:runs.title` is "Translation Activity" where `strings:tabs.runs` is just
  "Activity". Expand the page title; do not shorten it to match, and do not invent a third
  wording.
- **Legal works the same way** — `sidebar:legal` is "Legal", `legal:title` is "Legal &
  policies". `sidebar:globalConfig` is the *opposite* case: the sidebar item and the page
  title are word-for-word identical in English and must stay so.

For scale: the pilot ended with **seven surfaces settled across sixteen keys** recorded in
`style/ru.md` as "repeat these verbatim". That is the shape of the list you will be
maintaining, not a ceiling.

### 2.6 Match the sibling's **English**, not its other-locale rendering

When the surface-name rule sends you to a sibling key, read the sibling's **English**.
Copying another locale's rendering imports whatever *that* key's English says — including
words your own key's English does not have.

The worked example, caught in review: `config:lqa.checks.tag-equality.name` is "**Inline**
tag equality" while `quality:checkLabels.tag-equality` is the bare "Tag equality". Matching
the sibling by rendering put "inline" into a string whose own source has no such word. The
correct pair keeps the same term and stays faithful to each key's own English.

**This error class hides behind a virtue: the file looks *more* consistent, not less.** When
two sibling keys disagree in English, that disagreement is either deliberate or an English
defect — carry it across, and if you think it is a defect, raise it as one rather than
silently harmonizing in one language only.

### 2.7 Your plural categories are your language's, not English's

**This is the rule that decides which keys your files contain, so settle it before you copy
the first namespace.** English ships `_one` and `_other`. That is *English's* category set,
not a template. Every plural family in your file gets **exactly your language's categories —
no more and no fewer** — because a suffix that is not one of them can never resolve. The
parity guard compares plural families by their **base key**, not by their exact suffixes,
precisely so that each language can supply its own set.

There are 41 plural families in English, and English spells them with **29** `_one` keys and
**41** `_other` keys (the other twelve families are the `bare + _other` shape from 2.3, which
have no `_one` at all) plus one `_zero`.

**If your language has more categories than English**, the extra forms are **required, not
merely tolerated**. Russian selects between _one_, _few_, _many_ and _other_, so it carries
`_few` and `_many` variants with no English counterpart — 94 keys more than English, which is
exactly the twelve missing `_one` forms plus 41 `_few` plus 41 `_many`.

**Italian and Brazilian Portuguese are the one documented exception to the rule above, and
it is a code decision, not a translator's — read it before you copy Russian's shape onto
them.** `Intl.PluralRules` gives `it` and `pt-BR` three categories too — `one`, `many`,
`other` — the same count as Russian's four minus one, so the paragraph above reads as if
they owe the same treatment: write `_many` for all 41 families. They don't. `it`/`pt-br`'s
`many` selects ONLY exact millions (1000000, 2000000, 3000000, …; verified via
`Intl.PluralRules` — no integer 0..200 selects it), and no count this app ever renders
reaches a million, so the category is real per the language's grammar but **unreachable by
anything the UI can show**. `COVERAGE_GAP_GRANDFATHER` in `scripts/locale-rules.mjs` records
exactly this finding, and the precedent already shipped agrees with it: `es` and `fr` have
the identical `one`/`many`/`other` shape and carry **zero** `_many` keys between them —
1,908 keys each, the same count as English, because nothing else in their category set
differs from English's `_one`/`_other` split. **Do not write `_many` for `it` or `pt-br`.**
Ship `_one`/`_other` only, matching `es`/`fr`, and expect to land at English's own key count
for this dimension — neither the 29-fewer of a single-category language nor Russian's 94
more. The default gate (`pnpm check:locales`, what CI runs) does not ask for the missing
category either, for the same reason: it is forgiving a gap the tool has already proven is
unreachable, not skipping a check.

**`LOCALE_PARITY_STRICT=<lang>` will still flag it — that is the one expected strict-mode
failure for these two languages, and the fix is not to add the category.** Strict mode
exists to hold your locale to its language's *complete* category set with no rescue, so by
design it ignores both the bare-key mitigation and this grandfathering (`isStrictFor` short-
circuits `enforcedCoverageGapFamilies` before either mitigation is consulted) — running
`LOCALE_PARITY_STRICT=it pnpm check:locales` reports every `it` family missing `_many` as a
hard failure regardless of reachability. Read that specific failure as the documented
exception settled above, not as a signal to add `_many` after all; every other strict-mode
failure on `it`/`pt-br` is real and must be fixed like any other language's.

**If your language has one category, you supply `_other` and nothing else.** Copying
English's `_one` across is a **hard guard failure by design**: the suffix is not in your
language's set, so it can never be selected, and the guard fails it rather than letting a
dead key sit in the file forever. A single-category language therefore ends with **29 keys
fewer than English**, not more. Do not "complete" a family to match English's shape.

**Do not add a plural family over a plain English key.** The guard permits it — a locale may
turn one English `{{count}}` string into a full family, provided the plain key survives — and
the temptation is real for a language with more categories than English. **No shipped locale
does it:** across all 41 families, in each of the four locales shipped so far, **zero** were
added this way; every count English writes as one string is handled with the count-neutral
device from 2.2. Follow that. If the project ever wants added families, it is a decision to
take **once, for every locale**, not per namespace — half a language done each way is worse
than either.

The mirror of this rule is not a matter of taste. **A category you leave out does not fall
back to `_other`.** The framework picks the suffix for the count first and then walks the
*language* chain, so a file missing a category renders the **English** string at the counts
that category would have taken. The one thing that rescues a gap is a bare `key` sibling in
the same locale — and where English carries only `key_one`/`key_other`, adding a bare `key`
to your family is reported as an extra key and fails the diff. **The fix for a category you
find hard to word is the category, never a bare key that bypasses plural selection
everywhere.** This is about categories your language *has* and you omitted; it is not an
argument for adding one your language does not have.

Two suffixes are legal that you might otherwise delete. `_zero` resolves in *every* locale
whatever its categories, because an explicit `key_zero` lookup is made whenever the count is
0 — English already ships one, `strings:bulk.removeCategoryApply_zero`, so you will meet it.
The legacy `_plural` suffix is the other: it is reported rather than failed, but it never
resolves under the current JSON format, so treat it as dead weight and never add one.

### 2.8 The English defects that must not be mirrored

Each of these is a known defect in the English source. Mirroring it invents a distinction
the app does not have. `english-review-notes.md` carries the full list with each intended
reading — read that file, not this summary — but these four are the ones that cost the
pilot time:

- **One action, two English verbs.** `strings:runs.judgeApply` is "Apply suggestion" and
  `strings:runs.judgeApproveAll` is "**Approve** all suggestions", for the very same
  action on all of them. Render **both** with your *apply* word. Do not reach for your
  *approve* word: approving a translation into translation memory is a genuinely different
  operation that appears in the same UI, and in Russian the two collided.
- **Three controls say "provider" where every other picker says "module".**
  `colorText:assistant.instanceLabel` and `stage-details:chatInstanceLabel` are both
  "Provider", and `config:routing.simplePlaceholder` is "Choose a provider"; the other
  pickers (`category:module`, `glossary:generateModule`, `review:sourceAi.module`,
  `strings:runs.aiReviewModule`, `orphans:relink.aiModuleLabel`) all say "Module". They
  select the same kind of thing. Take the reading from `terminology.md`, not from the label.
- **A stale tab name in one notice.** `config:fullReplaceOrphanNotice` calls the Orphans tab
  the "Relink tab". There is no such tab. Use your rendering of **Orphans**.
- **Two theme names already diverge inside one shipped locale.** Spanish renders
  `settings:themes.techno.name` as "Tecno" but `welcome:themeChooser.names.techno` as
  "Techno", and `settings:themes.minimal.name` as "Minimal" but
  `welcome:themeChooser.names.minimal` as "Minimalista". French and Russian agree across
  both namespaces. Theme names are named twice; pick one rendering per theme and use it in
  both places.

**A defect named without its keys cannot be acted on.** If you find another, record it with
its keys and the intended reading, in `english-review-notes.md` — that is the file the next
language will read.

### 2.9 Scope every reservation you write

A lexicon reservation — "this word is taken, use another" — must state **which part of
speech and which sense it binds**. Four reservations written in the pilot had to be narrowed
later, always the same way: a claim staked over a *root* or a *bare word*, backed by
evidence that had only ever compared two terms.

The narrowed forms, as the pattern to copy: the Russian word for *entry* is claimed on the
noun naming a content unit **and only that**, so the same word is fine for a log entry where
another noun disambiguates, and the corresponding verb stays free for writing to a log. The
ban on one candidate for *run* is a ban on **rendering that term** with it — it does not
reach the root, so the derived noun for a service restart is still the right word. A shared
root between two terms is not a collision when the heads differ.

**Over-reading a reservation costs more than under-reading it.** A reservation that binds
more than it proved is a rule the next translator will fight, silently, in a namespace you
never see.

### 2.10 The measured expansion — and where the tail bites

Character expansion over the 1,908 shared keys, measured against the English source:

| Locale | Aggregate | Median | 90th percentile |
| --- | --- | --- | --- |
| ru | 1.19 | 1.18 | 1.73 |
| es | 1.22 | 1.21 | 1.60 |
| fr | 1.26 | 1.24 | 1.67 |

**Read the population before you compare these to anything.** Every row above is over the
**1,908 keys the locale shares with English**, one ratio per shared key — the
post-reachability-sweep count; see section 1's totals. `backfill-notes.md` records
Russian's 90th percentile as **1.71**, and that is over a different population: all
**2,002** Russian keys, with each extra plural form measured against the English form it
resolves to. Both figures are correct and both reproduce exactly — 1.7273 over the shared
set, 1.7143 over the full Russian set. The gap is the denominator, not rounding and not an
interpolation choice. **When you report your own language's expansion, state which of the
two populations you measured**, because a language with many extra plural forms will move
these apart much further than Russian did.

Russian is *shorter* overall than both locales shipped before it, which is not what anyone
predicts. **The aggregate is not the number that matters — the tail is.** At the 90th
percentile every one of the three runs 1.6x to 1.7x, and that is what breaks chrome. A
language whose aggregate looks comfortable can still overflow every tab label it has.

Budget your key count by your language's **plural-category count**, not by its expansion, per
the rule in 2.7: Russian needed 94 keys English has no counterpart for, because it fills four
categories where English fills two. A language with `one`/`other` needs none. A
single-category language ends with 29 keys **fewer** than English, not more.

---

## 3. The per-batch procedure

1. **Read the three authorities and the previous batches' shipped files.** Not their
   reports. Precedent verification against a report is how three stale citations reached a
   commit in the pilot.
2. **Create this batch's files by copying English's**, one namespace at a time, into
   `packages/frontend/src/locales/<lang>/`. Then **translate in place**, resolving each
   string's control shape before writing it, and adjusting each plural family to your
   language's categories per 2.7. **Create only this batch's namespaces** — do not pre-copy
   the later ones; the declaration defers missing files, not untranslated ones, so a
   pre-copied locale goes red on every value it has not reached and its declaration is
   reported stale on top. You do not add or remove that declaration yourself: the controller
   adds it in the commit that lands this batch when it is batch 1, and deletes it at the
   whole-language sweep.
3. **Fill in `terminology/<lang>.md`** for every term the batch met, **in the same change as
   the wording** — not afterwards, and not in the batch report.
4. **Run the mechanical checks below** and clear every survivor.
5. **Report**: wall clock, terms added, conventions settled, and every judgement call.
6. **Review, fix, re-review** — see the rubric and the state machine.

### The mechanical checks, run before review and not after

Everything here is cheap and scriptable, and over four batches each one either found
defects the reviewer would otherwise have spent attention on, or produced the evidence that
made the reviewer's verdicts checkable. Hand the reviewer the output.

1. **The numeral-agreement detector, both axes.**
   - **Token axis.** Skip every placeholder that cannot hold a number. In this app
     that is `count` (its own family handles it) plus `module`, `instance`, `language`,
     `languages`, `lang`, `name`, `message`, `date`, `verdict`, `headers`, `model`, `keys`,
     `slug`, `type`, `focus`, `field`, `why`, `label`, `filename`, `id`, `time` and
     `passRate`.
   - **Word axis.** On what survives the token axis, clear the next words that cannot
     inflect — prepositions and particles, invariant abbreviations, short and impersonal
     participles.
   - **The fixed order that matters is not which check runs first — it is where the word
     list comes from.** Checking the token or the word first, per occurrence, gives the
     same verdict: for one fixed pair of lists the two checks are a plain logical OR, and
     OR is commutative. The load-bearing rule is that the word-exemption list must be
     **derived only from occurrences that already survived the token axis**, never from
     the raw, unfiltered set. Build it from the raw set instead and it gets contaminated
     by legitimate `{{count}}`-driven agreement — a real counted noun such as «записи»
     recurs constantly and correctly after `{{count}}`, whose own family already carries
     plural forms for it — and once that word is exempted, it is exempted after every
     token, including a non-`count` one it has no business covering. An injected
     `{{orphanCount}} записи` defect passes silently under a raw-derived word list;
     deriving the list from the 19 post-token-axis survivors instead (not the 187 raw
     occurrences) is what catches it, and is the actual reason to keep the word list
     "second" — not check ordering.
   - **The narrow figure, stated precisely.** Counting every place where `}}` is followed
     by one or more whitespace characters and then a word in the target script gives
     **187 raw occurrences, 19 after the token axis, 0 after the word axis**, over the
     2,025 shipped Russian values this document was originally measured against (commit
     `e7fe56d`). Reproduces identically over the current 2,002-key corpus — the
     reachability sweep that later removed 23 dead keys from every locale (see the
     open-items list) removed none that this rule matched.
   - **The looser figure, stated precisely.** A rule that also matches across intervening
     punctuation *and* symbol characters (Unicode categories P and S together — matching
     punctuation alone, category P only, gives 256, one short) gives **257** occurrences
     over the same 2,025-key corpus. The one occurrence punctuation-only matching misses
     is `review:overflowIssue`'s "×" (a math symbol, not punctuation under Unicode's own
     category split) immediately before a preposition. Over the current 2,002-key corpus
     the same rule gives 255 — a delta of **2** from the reachability sweep, not 3: state
     the exact rule and the exact population together whenever you quote either figure,
     because a number without both is not reproducible and a plausible-looking
     explanation for how it moved can still be wrong even when its total is right.
   - **What survives both passes is a candidate, not a verdict.** The token axis only skips
     the 23 placeholders someone has confirmed cannot hold a number, and this app has **73**
     distinct placeholders — so 50 of them survive the first pass whether or not they are
     numeric, including plainly textual ones like `{{category}}`, `{{text}}` and `{{rules}}`.
     A survivor means "nobody has cleared this yet". Look at each one, decide whether the
     value can be a number at all, and only then check the agreement by hand at several
     counts, including one ending in 1.
2. **Strict-mode parity, from the first batch and not at the end.**
   `LOCALE_PARITY_STRICT=<lang> pnpm check:locales`. Russian was clean in every batch, and
   that is exactly why no plural work ever had to be redone.
   **Green here means green** — with your locale declared work-in-progress (see "The
   work-in-progress declaration" above) this command passes on a correct partial batch, so
   there is no expected failure to read past, and any finding it reports is yours to fix
   now. The one rule a partial language cannot satisfy — which of English's namespace files
   exist yet — is deferred and printed as a NOTE rather than failed; strict mode does not
   re-enable it, and it forgives nothing it ever forgave.
3. **The `bare + _other` family list**, checked against the English source rather than
   rediscovered — the twelve in 2.3.
4. **Both collision directions**, over the whole language once it exists:
   same-English/different-rendering, and same-rendering/different-English. Both have
   legitimate hits; your job is to state why each one is licensed. The second direction
   found a genuine collapse of two distinct English verbs in the pilot.
5. **Every quoted rendering in your two authority files must exist in your shipped files.**
   This was the guard the pilot most wanted and did not have: the citation check only proves
   a key *exists*, and the collision check only compares renderings, so a row that describes
   a key wrongly survives indefinitely. One such row survived six rounds.
6. **Register and typography sweeps — six greps.** Instantiate each from `style/<lang>.md`
   before batch 1; all six ran clean on the finished Russian.

   | Sweep | Russian instance |
   | --- | --- |
   | the deferential pronoun form the guide bans mid-sentence | the capitalized «Вы» |
   | the letter the guide tells you to omit | «ё» |
   | straight quotes where the guide sets typographic ones | `"` and `'` |
   | doubled spaces | — |
   | three-dot ellipses instead of the single character | `...` for `…` |
   | hyphens used as dashes | `-` for `—` |

   **Punctuation in the source is yours to change; the token inside `{{…}}` is not.**
   Quotation marks, dashes, ellipses and spacing all follow **your** language's convention,
   not English's, and that includes the marks wrapped around a placeholder. English writes
   `category:deleteConfirmBody_one` with curly quotes — `“{{category}}”` — and Russian ships
   the same key with guillemets, `«{{category}}»`. The placeholder is untouched; the two
   characters around it are set by `style/<lang>.md`. Decide your quote characters there
   before batch 1, because they appear in every namespace.

**Four defect classes never fired in four batches because they are mechanically guarded:
do-not-translate token counts, placeholder multisets, key order, and plural coverage.** Do
not spend review attention on those four.

**Quoting and punctuation also never fired — but nothing guards it.** There is no quote,
dash or ellipsis check anywhere in the locale rules; the class stayed clean because the
style guide settled it before batch 1 and sweep 6 above caught what slipped. Treat it as a
translator instruction plus a grep, never as something a gate will catch for you.

---

## 4. The reviewer rubric

Eight items. This is the calibrated set: the pilot's rubric started at eight, grew to
twelve, and four batches of use cut it back to six kept items plus two the pilot proved but
never wrote down. The reviewer applies these; the translator should read them too.

### The eight items

1. **Word order is a correctness check where case is syncretic: name the agent, and state
   the attachment of every trailing modifier.** Earned its keep in every batch. It covers
   both shapes of the class: agent/patient inversion, and modifier or pronoun attachment
   binding to the nearest noun rather than the intended one. The pilot's worst finding was
   here — two inanimate plural nouns and a transitive verb, where nominative equals
   accusative, so word order alone carried the roles and the sentence said the entries catch
   the matchers. Every guard passed it. The fix was structural, not a reordering.
2. **Diff the file against every lexicon row that names a specific key.** The highest-yield
   item after the first. A row naming a key is a testable assertion, and it caught the
   *document* being wrong twice as well as the file.
3. **Require an elimination proof for each new term, plus what the established domain term
   actually is.** Caught both invented-word defects. **The proof must end with "and the
   survivor means this"** — that is the step both failures skipped. Both had the same shape:
   prove the reserved candidates unavailable, then coin, without checking whether the
   survivor actually means the thing or whether a sibling key already renders the same
   English word.
4. **Count-neutral constructions must keep the head noun.** Recurred in three batches. A
   bare substantivized adjective with a number after it is not count-neutral, it is
   unfinished.
5. **Verify every precedent against the previous batch's shipped file, not its report.**
   Kept despite finding nothing after it was introduced — because it was introduced as a
   warning to the translator, who then self-corrected three stale citations. Cheap, and it
   is what makes the other verdicts defensible.
6. **Script every key with more than one call site and check the rendering is true at all of
   them.** Added last, after a shared string was specialised until it was false at one of
   two sites: English was deliberately generic, the translation named the thing in the table
   it was written against, and the same key also renders over a different collection. **The
   question is "how many call sites", not "what does this control do".**
7. **Measure length against the per-class budgets for the whole class at once, and report
   the distribution.** *(New: proved by the pilot, never made an item.)* Doing this on the
   last batch is what exposed that the previous length rule was violated 27 times across all
   four batches and was simply wrong. One key at a time would never have shown it.
8. **Check that a rendering matched to a sibling namespace was matched to the sibling's
   English, not to its other-locale rendering.** *(New: same.)* Swept across the whole
   finished language it found exactly one occurrence — the one that motivated the rule —
   but the class hides behind a virtue and no other item looks for it.

### The six items that are not in that eight, and what would bring each back

A rubric that drops items without saying why grows them back. One was demoted into the
scripted pre-flight, one was folded into another item, and four are parked. Each was
dropped on evidence; each has a stated condition for returning.

| Parked item | Evidence for parking | What would un-park it |
| --- | --- | --- |
| For every `{{token}}` followed by a counted noun, open the call site: is the value numeric, is it pre-formatted, what is its range? | **Not dropped — demoted.** It found both numeric criticals in the first two batches and nothing afterwards, because from the third batch on the translator ran the detector before committing. It is a check, not a judgement, and it belongs before review. | Nothing. It lives in the scripted pre-flight now. If that script is unavailable for a language, it returns to the rubric as an item. |
| Check every pronoun's antecedent against the English | Found nothing on its own after the first batch; every later instance was really item 1. | Nothing — it is folded into item 1, which asks the same question once. |
| Register alternation is a within-string check, not a within-namespace one | Nothing, four times. | A language whose register is marked morphologically on every verb, where the pilot's null is not evidence. |
| Score the paradigm, not the option list: review all values of one setting together | Nothing, four times — **but only because translators applied it while writing.** | It stays in the *translator's* brief, not the reviewer's. If a batch report shows option lists were translated key-by-key, it returns. |
| Grep for every word a Notes cell **bans**, not only the rendering it prescribes | Nothing three times. Its value showed up in the last batch's report, where 38 banned-lexeme hits were all licensed — evidence, not defects. | A language whose lexicon carries many bans, where the hit list would be too long to eyeball in the report. |
| Treat `aria-label`-only strings as first-class | Nothing after the batch that motivated it, where one critical lived in an `aria-label`. | Parked as a *review* item only. It stays a **translator instruction**: a screen reader speaks the ungrammatical form verbatim, and no visual check will ever catch it. |

---

## 5. The per-batch state machine

Five states, in order:

`translated` → `reviewed` → `fixed` → `re-reviewed` → `complete`

**Write each transition into the ledger, and walk the ledger by grep before calling any
batch done.** The pilot's coordinator dropped "dispatch fix, then dispatch re-review"
twice — on the two batches carrying every critical finding — and caught it only by grepping
its own ledger. It is not an attention problem: both times the fix result arrived alongside
other notifications.

One line per batch, rewritten in place as it advances:

```
<lang> batch <n>: <state>
```

Before moving on, list every batch that is not yet complete:

```bash
grep -E '^[a-z-]+ batch [0-9]: ' <ledger> | grep -v ': complete$'
```

An empty result is the only thing that licenses the next round. A batch with no line at all
is the failure this check exists to catch, so also confirm the line count equals the number
of batches dispatched.

**A two-line documentation diff needs the same discipline as a string.** In the pilot a fix
to a lexicon row broke a different instruction in the same row, and only the re-review
caught it.

---

## 6. The three rules that are not negotiable

**1. Never dispatch batch N+1 before batch N's fixes have landed.** A batch dispatched while
the previous fix round was still in flight read the pre-fix file and cited two values that
had already changed, producing two live divergences. If you truly must overlap, the next
batch gets one warning sentence naming **the exact commits its reference files are valid at
and the list of values that have moved** — the pilot did that once and the batch caught its
own three stale citations before committing.

**2. Anything that binds a later batch goes into the lexicon or the style file in the same
round it is decided.** Never only into a batch report. A batch report is not an artifact the
next batch reads: three decisions recorded only in one had to be re-litigated. **The batch is
not complete until the decision is in the file.**

**3. A claim about what a key says is not relayed — it is checked, by whoever is about to
act on it.** An assertion about a file travelled through three agents in the pilot before
anyone opened the file. Three separate defects had exactly that shape, and each one was a
single command away from being falsified.

---

## 7. After the last batch: the whole-language sweep

Four checks that no per-batch review can see, run by someone who did not translate the
language — preceded by one step that has to come first.

0. **The controller deletes this language's `WIP_LOCALES` entry**, then runs
   `pnpm check:locales`. That turns the one deferred rule back on — is every English
   namespace actually present — and it is the first and only time it speaks about this
   language. Do it *before* the four below, because a namespace nobody noticed was never
   created changes what those sweeps are looking at. The gate demands the deletion on its
   own once the last namespace lands, so this step cannot be skipped silently.
1. **Both collision directions** over the finished locale — same-English/different-rendering
   and same-rendering/different-English. Every hit is explained or fixed.
2. **The length distribution per class**, against the absolute budgets in `style/<lang>.md`.
   If those budgets were still provisional at batch 1, **this is where they are replaced
   with measured ones** — that is a deliverable, not a note.
3. **The six register and typography greps**, and the sibling-English check across the whole
   language.
4. **The citation check** — every rendering quoted in `terminology/<lang>.md` (the per-language
   lexicon file the pre-flight created, already present and empty for every backfill
   language) exists in the shipped files.

Fixes from the sweep go in as a normal fix round with a scoped re-review. The language is
not done until that re-review passes.

---

## 8. Two structural constraints on how the work is scheduled

**Batches within one language must run serially.** The parity check is global, so concurrent
batches see each other's half-written files and produce failures that belong to nobody; and
each batch has to match the previous one's surface names, which only works if the previous
output is committed and readable. This cost the pilot about two hours and was the right
trade.

**Languages can run in parallel with each other**, because no locale reads another locale's
files — provided each has its own working copy and **the authority documents are frozen for
the duration**. The pilot rewrote both of its authorities while batches were reading them;
with one language that was survivable, and with several it is not. A translator filling
their own locale's file never conflicts with another, but a rule rewrite mid-flight
invalidates work already done. A term the lexicon lacks goes into an additive queue and is
resolved between waves, not during one.

**Who resolves the queue, and what happens to work already shipped under a different
reading.** The person coordinating the wave resolves it, once, after the wave's last batch
lands and before the next wave starts — the same moment the measurements are written up.
Until then the rendering you chose stands: keep using it consistently for the rest of your
own language rather than pausing on it. If the resolution differs from what you shipped, it
arrives as an ordinary fix round against your locale, with a scoped re-review like any
other. Nothing you translate is ever stranded by a queue decision, which is the whole reason
the queue is additive rather than a place to wait.
