# Per-locale terminology files

One file per target locale, holding that locale's rendering of every term in the shared
lexicon. The lexicon itself — what each term means, its part of speech, an example key, and
what it must not be confused with — lives one directory up in
[`../terminology.md`](../terminology.md) and is **frozen for the duration of the backfill**.

Split out of `terminology.md` so that translators working at the same time never edit the
same lines. Before the split, all fourteen locales shared one 14-row table per term inside a
single 2,233-line file; eleven languages running at once would have been eleven writers on
one file. Now a language is never a merge conflict.

## Who writes what

| File | Written by | Frozen? |
| --- | --- | --- |
| `../terminology.md` | nobody during a wave | yes — definitions, term list and order |
| `../style/<locale>.md` | that locale's translator | no |
| `<locale>.md` (here) | that locale's translator, and only them | no |
| the additive queue below | anyone who meets a missing term | no — resolved between waves |

**You write one file here: your own.** Do not open another locale's file, even to copy a
pattern from it — read `../terminology.md` for the definition and `../style/<locale>.md` for
how your language is written.

## The files

Locales already shipped in `packages/frontend/src/locales`:

| Locale | File | State |
| --- | --- | --- |
| `es` | [`es.md`](es.md) | shipped; 5 of 87 terms recorded |
| `fr` | [`fr.md`](fr.md) | shipped; 5 of 87 terms recorded |
| `ru` | [`ru.md`](ru.md) | shipped; 76 of 87 terms recorded — the pilot filled every row the lexicon then had |

The eleven languages of the backfill:

[`de.md`](de.md) · [`it.md`](it.md) · [`pt-br.md`](pt-br.md) · [`tr.md`](tr.md) ·
[`id.md`](id.md) · [`vi.md`](vi.md) · [`th.md`](th.md) · [`ja.md`](ja.md) ·
[`ko.md`](ko.md) · [`zh-hans.md`](zh-hans.md) · [`zh-hant.md`](zh-hant.md)

Each of the eleven has 84 rows, and all eleven started with no renderings. `de`, `ja` and
`tr` are no longer empty — wave 1 filled the 76 rows the lexicon had then. **The eight rows
added by the earlier of the two resolutions below are empty in every one of the fourteen
files, `ru`, `de`, `ja` and `tr` included**: a locale records a rendering in the change that
decides it, and none of them has decided these yet.

**The lexicon now has 87 terms and every locale file still has 84 rows.** The three terms
promoted by the guide-wave resolution — `undo`, `cancel`, `disable / disabled` — were
deliberately not written into anyone's file: these files belong to their translators, and
the guide wave adds the rows in the change that decides each rendering. Add them **in
lexicon order**, not at the end: `undo` and `cancel` go immediately after `revert`, and
`disable / disabled` immediately after `credential`.

`es` and `fr` shipped before the lexicon reached its present size, which is why most of
their rows are still empty. Those two are records to be completed from the shipped strings,
not blank slates — the shipped file is the authority for what they already say.

## Filling your file

- Fill a row **when you meet the term**, in the same change that introduces the wording. A
  rendering decided but not written down is a rendering the next namespace will re-decide
  differently.
- Keep the rows in the order they appear in `../terminology.md`. Do not add, remove or
  reorder them — a term missing from the lexicon goes in the queue below, not into your
  table as a new row.
- Put in **Notes** whatever the next translator would otherwise have to rediscover: a
  declension or agreement that forced a different word, a term you deliberately left in
  English, an acronym you expanded, a candidate you rejected and the reason. `ru.md` is the
  worked example of how much detail is useful.
- Quote real keys. The runbook's citation check verifies that every rendering quoted here
  exists in the shipped locale file, so a quoted string that does not exist there is a
  defect in one of the two — see the mechanical checks in
  [`../backfill-runbook.md`](../backfill-runbook.md).

## Additive queue

For a term the frozen lexicon does not cover. **Add a row, keep translating with the
rendering you chose, and do not edit `../terminology.md`.** The queue is resolved between
waves — never mid-wave, because promoting a term while ten other translators are reading the
lexicon changes the file underneath them, which is the exact failure the freeze exists to
prevent.

Give the key that motivated it, so whoever resolves the queue can read the string rather
than guess at the concept.

A queued term never blocks you: the rendering you used stands for the rest of your wave, and
a resolution that settles on a different word reaches your locale as an ordinary fix round.
Who runs the resolution, and the fix-round procedure, belong to
[`../backfill-runbook.md`](../backfill-runbook.md).

### Open queue

Rows raised since the last resolution. **Check both resolutions below before adding one** — a
term settled there is settled, and re-raising it costs the next resolution a re-reading of
an argument already made.

**The queue is empty.** Every row it held was ruled on in the guide-wave resolution
immediately below, together with thirteen terms that later waves raised and never filed here
and two from the cloud sign-in strings. Add the next one here.

| Proposed term | Key that motivated it | Locale | Rendering used | Raised by |
| --- | --- | --- | --- | --- |
| _(none open)_ | | | | |

### Resolution — wave 2 to the guide wave (2026-08-13)

**Applied 2026-08-13. Every term below is decided — do not re-raise any of them.** Twenty-two
terms: the seven the Open queue held (all raised by `ko`), thirteen raised during waves 2 and
3 and recorded only in session notes, and two from the cloud sign-in strings. **Three
promoted and nineteen stayed out**, taking the lexicon from 84 terms to 87 in the single edit
the freeze was lifted for, before the guide wave dispatched.

**This resolution promotes far less often than the last one — three of twenty-two against
eight of twelve — and the reason is that it could measure.** When the last one ran, three of
the eleven backfill languages had shipped; all eleven have now. So each queue term could be
checked against what **fourteen** shipped locales actually did — six were available last
time — instead of argued from the English alone, and for most of them the answer was that
every locale had already resolved it correctly and unaided. A row costs every locale a
decision; a row that records a decision
fourteen locales have already made correctly costs fourteen decisions and buys nothing. Every
holding row below names the measurement that decided it, so a later reader can disagree with
the evidence rather than with the verdict.

Where each one landed:

- **Promoted into [`../terminology.md`](../terminology.md)** — `undo` and `cancel` under Runs
  and engines, immediately after `revert`; `disable / disabled` under Modules, providers,
  credentials, immediately after `credential`. **No locale file was touched this time** — the
  three rows are in nobody's file yet, and go in in lexicon order, in the change that decides
  each rendering. See the note above the queue.
- **Three frozen rows amended, at no cost to any locale**, because in each case the lexicon
  already had the row and the row was wrong or incomplete: **`flag`** (English uses that word
  for five different things; the row defined one, and five locales had already collapsed two
  of them), **`translator context`** (it said "three different things are called context in
  English" — there are five, now named by key), and **`ignore`** (its parenthetical gloss of
  *skip* described a per-run routing outcome that no shipped string means).
- **Two rulings filed in [`../english-review-notes.md`](../english-review-notes.md)** —
  `structured output`, because the control those strings describe has no translatable label
  at all, and `variant`, because one log line calls a translation-memory variant an "entry".
  An existing row there gained a measurement: the `judgeApproveAll` ruling is followed by
  twelve locales and broken by `es` and `fr`, which ship their *approve* word for the apply
  action in two keys each.
- **`console` — decided last time, but its destination was never reached.** The previous
  resolution held it out of the term list on the grounds that it "belongs in the surface table
  rather than the term list", and then recorded that "no file needed a change for them". Both
  cannot be true, and the surface table never gained it. It is there now, with its two prose
  names and the uppercase-title rule. The HOLD itself is not re-opened.
- **`deployment` and `widget`** come from the cloud sign-in strings, which are not part of
  this repo's locale tree. Both stay out of the lexicon, and the `widget` finding — an English
  defect — is recorded in its row below rather than in `english-review-notes.md`, which is
  scoped to this repo's own namespaces. **That is a gap, not a decision:** those strings have
  fourteen translations and no file of record anywhere.

Four things are worth knowing about how these came out.

- **A reservation is cheaper than a row, and it works.** Five of these were argued from the
  pattern that produced the `log` row last time — a frozen row reserving a word in its
  **Not:** list without defining it. Measured against the shipped files, four of the five had
  already been settled correctly by every locale with no row at all: *apply* (fourteen
  locales, one word, across all four surfaces that use it), *read-only* (fourteen, identical
  in every key), *request* (fourteen, and not one collapsed it into *prompt*), *bulk
  operation* (fourteen, and not one collapsed it into *batch*). **The reservation pattern is
  not by itself a reason to promote.** `log` was promoted because a whole namespace met an
  undefined word, not because a **Not:** list named it.
- **Every promotion here is a collapse somebody already shipped.** `fr` renders *undo* and
  *cancel* with one word; `ru` renders *undo* and *cancel a run* with one word; `es`
  alternates two roots for *disable* and `ko` ships three forms of *disabled*. Nothing was
  promoted on the strength of an argument alone, and nothing that measured clean was
  promoted for the sake of the argument being good.
- **Thirteen of these twenty-two were raised and never filed.** The last resolution closed by
  saying that "a request that never becomes a row leaves no trace", from one such row. It
  happened thirteen more times in the two waves since, and the terms surfaced only because
  someone went back through session notes. The queue is one table in one file.
- **The last resolution's own closing warning repeated itself inside the same resolution.** It
  told the next one to check that a destination exists before routing a ruling into it — after
  `erase` was directed into a `delete` row this lexicon has never had. That same resolution
  routed `console` into the surface table and never put it there. So the check was owed twice
  and paid neither time; both are closed now. **A ruling is not applied until the destination
  file says so** — and the two cheapest places for that to fail are a row you name from memory
  and a table you mean to get to.

| Proposed term | Key that motivated it | Locale | Rendering used | Raised by | Resolution (wave 2 → guide wave) |
| --- | --- | --- | --- | --- | --- |
| **undo** — the frozen `revert` row reserves a word *against* it ("undo is the distinction to protect") but never defines it. Two wave-1 locales coined it independently to hold the reservation; a term reserved against but undefined is the shape that produced the `log` row last resolution. | `strings:compare.undo` | `ko` | 되돌리기 | `ko` batch 2 | **PROMOTE.** The reservation is real and wider than the row claimed — **three** frozen rows name *undo* in their **Not:** lists (`revert`, `discard`, `revoke`) and none defines it. What settles it is not the reservation but the measurement: **three shipped locales have already collapsed it into *cancel***. `fr` renders `common:cancel` and `strings:compare.undo` both "Annuler"; `ru` renders `strings:runs.cancel` and `strings:compare.undo` both «Отменить»; `it` escaped only by adding a noun. Eleven keys across three namespaces, plus nine passive "cannot be undone" confirms. *Means here:* reverse the last thing this person did — one edit, one cell, one action. *Not:* revert, cancel, discard, revoke, clear. **One thing the row had to stop, checked rather than assumed:** `strings:compare.undoRestore` says "Restore" and **all fourteen locales render it with their `backup:restoreButton` word** — that is correct and must not be "fixed" into the undo word. |
| **cancel** — named in the **Not:** list of `revert`, `discard` *and* `revoke`. Three frozen rows reserve against a word with no row of its own. | `batch:cancelRun`, `config:cancelImport` | `ko` | 취소 / 실행 취소 | `ko` | **PROMOTE, with two senses in one row.** Thirty-four keys in seventeen namespaces, which alone would not decide it — the deciding facts are that it is half of the collapse measured on *undo* above, and that English spells two different consequences with it: backing out of a dialog before anything happens, and stopping work already in flight (`batch:cancelRun`, `strings:runs.cancel`, `config:cancelImport`, `glossary:generateCancelled`), which keeps whatever finished first. *Cancelled* is also one of the **seven run statuses**, which resolve as one set in one part of speech, the same constraint *invite* carries. The queue's own rendering column is the third fact: `ko` records 취소 / 실행 취소, and 실행 취소 — the composition of *cancel* and *run* — is also the conventional Korean for *undo*, so the run control reads as the undo control. If that composition happens in your language, phrase the run control differently. |
| **apply** — the `suggestion` row states "the action on it is *apply*" and `approve` reserves against it, but it has no row; it also labels three controls that are not suggestions, so the one-word/one-action reading is already false. | `strings:runs.judgeApply`, `glossary:importApply` | `ko` | 적용 | `ko` | **HOLD — the reservation has already done the work.** The queue row's factual claim is correct: *apply* labels controls that are not suggestions (`colorText:applySize`, `strings:bulk.apply`, `glossary:importApply` and `confirmEnableApplyConfirm`), so *suggestion*'s "the action on it is apply" is not the whole story. But **all fourteen locales already render every one of those with a single word**, and not one collapsed it into their *approve* word — `approve`'s **Not:** list did its job without a row. What is genuinely unsettled is not vocabulary: `es` and `fr` ship their *approve* word at `judgeApproveAll` against a ruling already written in `english-review-notes.md`, in that key **and** in the label quoted inside `strings:runs.judgeAllFindingsDescription`. That row now records the measurement; fixing two values in two locales is a standalone change, not a term fourteen locales must fill. |
| **history** — a fourth concept colliding with three frozen terms (`log`, `recording`, `changelog`) and settled by none of them. | `strings:runs.emptyState` | `ko` | 내역 | `ko` | **HOLD.** Three keys, and none of them is a concept. In two — `strings:runs.emptyState` and `strings:tabPlaceholder.runs` — the English is "activity history", the **Activity** surface name plus an ordinary noun; in the third, `strings:compare.undoVersionsHint`, it is loose prose for what the product elsewhere calls "Previous versions". Fourteen locales rendered it exactly that way, as their Activity word plus an ordinary word, and not one coined a term or let the ordinary word become a second name for Activity. Do the same: no rendering to reserve, and the four frozen rows that ban *history* (`Activity`, `log`, `recording`, `changelog`) are banning it as a **surface name**, which is a different question from writing the ordinary noun in a sentence. |
| **skip** — named in `ignore`'s **Not:** list as "a per-run routing outcome", which defines it by exclusion only. | `config:skipped`, `generation:skipCategoriesLabel` | `ko` | 건너뛰기 | `ko` | **HOLD — and the exclusion it was defined by is wrong, so that has been corrected instead.** Checked against the shipped strings, *skip* never names a per-run routing outcome anywhere in the UI: it is an import outcome count (`config:skipped`, `glossary:importSkipped`), a generation setting a **person** configures (`generation:skipCategoriesLabel`, whose hint says the entries are "left out of the request entirely"), and prose in one check description. Three unrelated ordinary uses, no state, no control shared between them. The `ignore` row's parenthetical has been amended to say what is actually there. Render each from its own sentence; do not reach for your *ignore* word (that is a reversible state a person sets on an entry) and do not reach for your *omit* word (that is the export checkbox specifically). |
| **disable / disabled** — named in `ignore`'s **Not:** list. Four call sites, two parts of speech, and one is a bare "Off" badge, so a locale needs all three forms settled together. | `config:disableModule`, `glossary:disabled` | `ko` | 비활성화 / 사용 안 함 / 꺼짐 | `ko` | **PROMOTE.** The queue row understates it: the enable/disable pair names the state or the action in twenty-six keys across eight namespaces, in three grammatical forms, and English writes the state three ways — "Disabled" (`config:modulesDisabledSection`, `config:tm.policyDisabled`), "Off" (`glossary:disabled`) and "turned off" (`logs:translation.failedModuleDisabled`). Two locales have already drifted: **`es` alternates two roots** (*Deshabilitar* against *Desactivar*, *Desactivada* against *Deshabilitados*) and **`ko` ships three forms of the state**, which is exactly the three-way split its own rendering column records. The row settles the verb, the participle and the badge together, keeps the enable/disable pair one lexeme, and allows a locale's platform on/off pair for the badge provided `config:tm.policyDisabled` does not become a fourth word. |
| **verdict** — the `judge` row defines the engine but not its output, which is simultaneously a log token and two UI labels. | `strings:runs.judgeVerdictPass`, `logs:judge.done` | `ko` | 판정 | `ko` | **HOLD — half of the premise is already settled and the other half is an enum.** `logs:judge.done`'s `{{verdict}}` is **not translatable at all**: it is a raw English `pass`/`fail` passed straight from run metadata, never through i18next, and `english-review-notes.md` has ruled on it — write the sentence so the token reads as data. That leaves `strings:runs.judgeVerdictPass` / `judgeVerdictFail`, two labels of one value set, which the paradigm rule already covers (settle all values of one setting together — the same reasoning that held `log level` out last time), and one prose occurrence in `strings:runs.judgeAllFindingsDescription`. Fourteen locales rendered all three as ordinary prose with no collisions. Nothing here needs a word reserved. |
| **request** — the frozen `prompt` row reserves against it ("keep it distinct from an HTTP request — the same settings panel carries requests-per-second and request-timeout labels") and never defines it, while the frozen `batch` row *defines itself* in terms of it ("the group of entries packed into a single request"). Sixteen keys. | `config:requestsPerSecondLabel`, `config:requestTimeoutLabel`, `config:maxOutputTokensLabel` | not recorded — raised in a session note | — | wave 2 or 3, locale not recorded | **HOLD.** This is the strongest-looking reservation in the queue and it measures clean: **all fourteen locales keep *request* and *prompt* apart** — Anfrage/Prompt, リクエスト/プロンプト, istek/istem, 요청/프롬프트, запрос/промпт, requête/invite, 請求/提示詞 — and each is internally consistent across the rate limit, the timeout and the per-request token cap. The `prompt` row's reservation is doing exactly what a reservation is for. Keep your *request* word off your *prompt* word and off the **search query** in "No models match your search"; note that `strings:runs.judgeReRequest` and `account:deleteRequestButton` are the ordinary English verb (asking for something), not this one. |
| **read-only** — the frozen `constant` row calls it "the near-miss to avoid", two columns away in the same table, and never defines it; the `writable language` row defines itself against it. | `glossary:readOnly`, `collab:locks.readOnlyLanguage`, `strings:editor.sourceReadOnly` | not recorded — raised in a session note | — | wave 2 or 3, locale not recorded | **HOLD.** Five keys and zero drift: **all fourteen locales use one rendering** across the glossary column, the source-text label and the context-menu marker, and four of them (`de`, `tr`, `vi`, `th`) correctly turn it into a noun phrase where the string is a sentence about permission rather than a label. None reused it for *constant*. Nothing to settle. The rules that already exist are enough: it is the negative pole of your **writable language** adjective, so do not alternate adjectives between them, and it is not your **constant** word, which sits two columns away in the same glossary table. |
| **guidance** — a free-text instruction the user writes and the app sends to the model, which is the same shape as the frozen `translator context` term and whose obvious rendering in several languages is the **guide** word. | `strings:runs.judgeGuidanceToggle`, `strings:runs.judgeGuidancePlaceholder` | not recorded — raised in a session note | — | wave 2 or 3, locale not recorded | **HOLD.** Two keys, one control, one namespace — a row would ask fourteen locales to reserve a word for a checkbox and its placeholder. The instruction is what was wanted, and it is a set of three don'ts. **Do not build it from your `guide` word:** that names the documentation surface, and a reader meeting it here will go looking for a help page. **Do not reuse your `translator context` rendering:** that is a per-entry authoring note attached to content, while this is a per-run instruction to the reviewer that is stored nowhere. **Do not reuse your `prompt` word:** the app composes the prompt, the user writes this. An ordinary word for "instructions" is right. |
| **confidence** — a scored column with a four-value tier set and five reason strings, colliding with the judge's *score* and with the **pass rate** tiers on the Quality dashboard. | `config:models.colConfidence`, `config:models.confidenceTier.*` | not recorded — raised in a session note | — | wave 2 or 3, locale not recorded | **HOLD.** Eleven keys, all `config:models.*`, all one column of one table on one surface: a column header, a score, four tier values and five reason sentences. The four tiers are the values of one setting, which the paradigm rule already covers — settle High / Medium / Low / Very low together and in one part of speech, exactly as `log level` was held last time for the same reason. Two adjacencies are worth a Notes line rather than a row: this **score** (`config:models.confidenceScore`, "Score: {{score}}/100") is not the judge's score (`strings:runs.judgeSummary`, "avg score"), and these **tiers** are not the banded tiers in the **pass rate** legend. Different numbers, different tables, and none of them meet on screen. |
| **structured output** — a module setting whose behaviour two long warning strings explain, with no lexicon row and no obvious rendering. | `config:structuredOutputExperimentalWarning`, `config:structuredOutputLunaWarning` | not recorded — raised in a session note | — | wave 2 or 3, locale not recorded | **HOLD as a term; the real finding is in the English and is filed in [`../english-review-notes.md`](../english-review-notes.md).** Reading the component to rule on it turned up more than the request knew: **the control these two strings describe has no translatable label**. Every field in a module's settings card takes its label from `fieldKeyToLabel(key)`, which splits the manifest schema key into English words — so `useStructuredOutput` renders as "Use structured output", and so do `verbose`, `free`, `allowInsecureHttp`, `rateLimitEnabled` and the rest. Nothing in that path passes through i18next. There is no rendering to reserve, only a way to write two sentences about a control the reader will see in English; that is what the notes row now says. |
| **verbose logging** — six keys across three namespaces, and English writes it two ways ("Verbose logs", "Verbose logging"). | `strings:runs.aiReviewVerbose`, `colorText:assistant.verboseLabel`, `stage-details:chatVerboseLabel` | not recorded — raised in a session note | — | wave 2 or 3, locale not recorded | **HOLD — the frozen `log` row already covers it.** That row says in as many words that "log entry" and "log stream" fold into the term unless a language needs a separate word for a single line; *verbose logs* is the same shape, an ordinary adjective on the frozen term. Check the lexicon for the concept rather than the word, which is the lesson the `audit` ruling left last time. Two constraints belong in your Notes instead of a row: the four labels are one thing under two English wordings, so render them as one; and `colorText:assistant.verboseHint` and `stage-details:chatVerboseHint` are **byte-identical English in two namespaces** and must stay byte-identical in your locale, the same duplication discipline the four `theme` names carry. |
| **bulk operation** — the frozen `batch` row reserves against it in as many words ("keep it distinct from bulk operation, which is a user action over selected rows") and never defines it, and the two collapse into one word in many languages. | `strings:bulk.bulkOperation` | not recorded — raised in a session note | — | wave 2 or 3, locale not recorded | **HOLD.** The reservation is real, the collision is real in the abstract, and **not one of the fourteen locales made it**: every file renders the bulk-bar trigger and `config:module.batchMode` from different roots (*Sammelaktion*/*Batch-*, 一括操作/バッチ, *Toplu*/*Yığın*, 일괄/배치, *massiva*/*lote*, 批量/批次). Two keys carry the visible English word, and fourteen locales resolved them without help. Keep doing what you already did — and note that both words appear inside the **same popover**, since `strings:bulk.startFailed` says "Failed to start batch translation", so if your two renderings ever converge, move the *bulk* one: `batch` is frozen and already recorded. |
| **variant** — the Translation Memory page's word for one stored translation of a source text, with no lexicon row. | `config:tm.deleteVariant`, `config:tm.browserDescription` | not recorded — raised in a session note | — | wave 2 or 3, locale not recorded | **HOLD as a term; one English defect filed in [`../english-review-notes.md`](../english-review-notes.md).** Four keys on one surface, and the design-system sense of the same English word was already settled last time (the badge variant names, held out and filed in the notes) — this is a different sense, so it was worth raising, and the answer is still no row. What reading the strings turned up is worth keeping: **`logs:tm.variantDeleted` says "Removed a translation-memory entry"** for the thing every other key calls a *variant*, and *entry* is the canonical word for a unit of translatable content, which this app counts constantly. That log line reads as though the user's source content was deleted. Same class, and same fix, as the `review:sourceAi.ignoredToast` row already in that file. |
| **stale** — a badge, a scope filter, a cache state and a warning about remote data, with nothing tying them together. | `stage-details:stale`, `stage-details:scopeStaleOnly`, `config:module.cacheStale` | not recorded — raised in a session note | — | wave 2 or 3, locale not recorded | **HOLD.** Five keys and three unrelated senses: a translation whose source has changed since it was written (`stage-details:stale` and `scopeStaleOnly`, which are the same state and *do* have to agree with each other — one is the filter for the other), a model-list cache that is out of date (`config:module.cacheStale`), and the DeepL entries the push replaces, which is already ruled in `english-review-notes.md` and must stay at least as alarming as the English. **All fourteen locales already agree with themselves** across the badge and its filter. Settle that pair together, record it in your style file rather than here, and translate the other two from their own sentences. |
| **flagged** — the frozen `flag` row defines a review disposition, and the same English word is used for several other things across the app. | `glossary:flaggedTitle`, `review:sourceAi.runSummary` | not recorded — raised in a session note | — | wave 2 or 3, locale not recorded | **HOLD as a row; the frozen `flag` row has been amended instead.** There is already a term for it — a second row would give one English word two lexicon entries, which is the failure `discard` and `dismiss` are shaped to avoid. But the row defined **one of five** senses, and the other four are all live: what an LQA check does to a translation (eleven `config:lqa.checks.*.description` strings begin with the word), a glossary term missing a language, a count of entries an AI review scored badly, and a stored boolean marker ("Clear new flags"). A sixth is not this word at all — `config:lqa.regexFlags` is the regular-expression flag letters. **Measured: nine locales keep the disposition apart from the AI-review count and five do not** (`es`, `fr`, `it`, `pt-br`, `vi`), so those five tell the reader the source review "set aside" entries it merely scored. `de` had worked the same split out unaided and written it into its own locale file — where it bound nobody else, which is the argument for putting it in the shared row. |
| **console** — raised again as a term for the live server-log panel. | `console:title` | not recorded — raised in a session note | — | wave 2 or 3, locale not recorded | **SETTLED ALREADY — not re-litigated.** The previous resolution held it out of the term list, and that stands: it is a surface name, not a term. **Its destination was never reached, though**, which is why it appears here. That resolution said `console` "belongs in the surface table rather than the term list" and in the same breath recorded that "no file needed a change" — and the surface table never gained it, so the ruling sat unapplied for a whole wave. It is in the Surface names section of [`../terminology.md`](../terminology.md) now, with the two facts a locale needs: the panel is named twice (`console:title` is "CONSOLE"; `colorText:assistant.verboseHint` and `stage-details:chatVerboseHint` call it "the live log panel"), and the title is uppercase for layout, like `strings:columns.config`. Thirteen locales used a console loanword and `vi` named it with its own log word — either is fine, one per locale, in all three keys. |
| **link** — a magic sign-in link, a hyperlink, and the verb for associating two records, all raised as one term. | `strings:achievement.linkButton`, `strings:viewNotFoundContact` | not recorded — raised in a session note | — | wave 2 or 3, locale not recorded | **HOLD — it is not one term, and saying so is the ruling.** Four unrelated things: (1) **relink**, which is already a frozen term and covers about twenty keys; (2) **linking an achievement's two entries** — `strings:achievement.linkButton`, `linked`, `dialogTitle`, `dialogEmpty`, `alreadyLinked`, `linkFailed`, six keys and one dialog, which is the only real gap and which fourteen locales have already rendered consistently within themselves; (3) an ordinary **hyperlink**, which is web vocabulary and not a product concept; (4) the emailed **sign-in link**, which lives in the cloud sign-in strings and not in this repo's namespaces at all. Use one verb across the six achievement keys. Note that twelve locales built their *relink* rendering out of their *link* word and it reads correctly, but relinking is **not** "linking again" here — it moves an orphan's translations onto a different entry — so if the transparent compound would say the wrong thing in your language, follow the `relink` row instead. |
| **context** — the frozen `translator context` row names three senses of the word and forbids sharing a rendering with one of them, but defines only its own. | `config:models.colContext`, `generation:contextLabel`, `strings:compare.translateUseReferenceNone` | not recorded — raised in a session note | — | wave 2 or 3, locale not recorded | **HOLD as a term; the frozen `translator context` row has been amended.** A `context` row would reserve a word for a **word** rather than for a concept, which is not what this lexicon does. What the request found is real, though, and bigger than it claimed: the row says three things are called "context" in English and there are **five** — this term, the entry metadata bundle, the model's token budget, an already-translated language sent along with the job ("as context"), and a memory policy's match conditions. The row now names all five by key. **The absolute ban on sharing a root with "context window" has been relaxed, on measurement rather than preference:** eleven of the fourteen locales share one root and let the qualified phrase carry the difference, three (`ko`, `vi`, `th`) do not, the two senses never appear on one screen, and English itself uses one word. The one key that is not safe by default is `config:models.colContext`, a bare "Context" heading over a column of token counts. |
| **deployment** — a loanword with no lexicon precedent, coined for the cloud sign-in strings. | `login.authNotConfigured` — "Auth is not configured on this deployment." | `de` | new loanword | `de`, cloud sign-in strings | **HOLD.** One key, in a string tree that is not part of this repo's locale files, describing something no reader of it can act on: it is an operator's misconfiguration reported to whoever happens to be signing in. A lexicon row would ask fourteen translators to reserve a word for a single error message. Render it with your ordinary word for the running installation or server — **do not import "deployment" as a loanword** — and keep the sentence short, because the only useful thing it can tell a user is that signing in is not going to work here. |
| **widget** — a loanword with no lexicon precedent; the bot-check control it names has no established rendering in several locales. | `login.verificationWidgetLoadFailed` — "Could not load the verification widget. Please reload." | `de` | new loanword | `de`, cloud sign-in strings | **HOLD as a term, and the defect is in the English.** One key uses "widget"; **two adjacent keys call the same control "the checkbox"** (`login.verificationStuckSignIn`, `login.verificationStuckEmailLink`), so one control on one page has two English names — the same shape as the audit/record/track finding ruled last time. Worse on the same page, "verification" names two unrelated things: this bot check, and the emailed code (`login.verifyingCodeStatus`, `login.mfaVerifyButton`). **Pick one name for the control and use it in all three strings** — describing what the reader sees ("the check", "the checkbox") travels better than the loanword — and make sure your wording for the bot check cannot be read as the code check. **This ruling is recorded here rather than in `english-review-notes.md` because that file is scoped to this repo's own namespaces and these strings are not in it.** They have fourteen translations and no file of record; that is a gap somebody has to close, and it is not closed by this resolution. |

### Resolution — wave 1 to wave 2 (2026-08-12)

**Applied 2026-08-12. Every term below is decided — do not re-raise any of them.** The rows
were raised during wave 1 (`de`, `ja`, `tr`) and resolved between waves, which is what
"between waves" means: **eight promoted and four stayed out**, taking the lexicon from 76
terms to 84 in the single edit the freeze was lifted for, before wave 2 dispatched. Eleven of
the twelve are also fully *applied*; the twelfth, `erase`, is decided (it stays out) but the
file its fact was to be written into does not exist, so where that fact lands is still
open — read its bullet below before acting on its resolution cell. The table is kept
whole because it is the record of *why* — a wave-2 translator who disagrees with a resolution
reads the row before arguing with it. Where each one landed:

- **Promoted into [`../terminology.md`](../terminology.md)** — `omit (from an export)` under
  Maintenance; `ignore / ignored`, `revert`, `back-translation` and `log` under Runs and
  engines; `revoke` under Collaboration; `assistant` and `dismiss` under Product surfaces.
  Every locale file gained the eight rows, empty.
- **`audit`** — no new term: the ruling is that the frozen `recording` row already covers the
  feature, and that row now says so, names the three `collab:sharing.audit*` keys and repeats
  the ban on the LQA *check* word.
- **`badge variant names`** and **`forget (a device)`** — rulings filed in
  [`../english-review-notes.md`](../english-review-notes.md), where a per-key English defect
  belongs; neither is a term any locale must fill.
- **`erase`** — **resolved, but not as written.** Its resolution folds the distinction into
  "the frozen `delete` row", and there is no `delete` row in this lexicon — there never has
  been. Nothing was improvised to make the instruction fit: no `delete` term was invented,
  because that is the exact imposition the row's own reasoning refuses. The fact it records
  is real, and it went to [`../english-review-notes.md`](../english-review-notes.md) —
  the same file the other three held-out rows used, and the one whose "intended reading"
  column exists for precisely this. Reading the strings to file it turned up more than the
  queue row knew: the destruction is not only remote but **cross-project** — the description
  says it "first deletes every DeepL glossary this app manages — across every project on this
  server, not just this one". Three keys, no lexicon row.
  **Lesson for the next resolution:** this row named its target from memory and the target
  did not exist. A resolution that directs a fact into another row must name a row that is
  actually in the file — check before writing the cell, not when applying it.
- **`console`, `log level`, `service restart`, `environment` / `slot`** — held out by the
  `log` row's own resolution; no file needed a change for them.

Three things are worth knowing about how the resolutions came out, because they shape how the
next wave should use this queue:

- **A row that stays out is not a row that was wrong to raise.** Two of the four are real
  facts about destructive actions that belong in `english-review-notes.md` rather than in a
  term every locale must fill; one belongs in an existing row's **Not:** list; and one —
  `audit` — asked for a ruling and the ruling is that the frozen lexicon already covered it,
  one row away, under the product's other English name for the same feature. **Check the
  lexicon for the concept, not for the word, before queueing.**
- **Independent convergence is the strongest evidence a row can carry.** The `discard`
  third-sense row has four locales reaching the same kind of verb without seeing each other's
  files, which is worth more than any single argument in this table.
- **A request that never becomes a row leaves no trace.** The last row was asked for in batch
  5 and never filed, and surfaced only when the wave's measurements were written. If you raise
  a term and someone else files it for you, check that it landed.

| Proposed term | Key that motivated it | Locale | Rendering used | Raised by | Resolution (wave 1 → wave 2) |
| --- | --- | --- | --- | --- | --- |
| **discard (third sense): omit from an export** — `discard` in the lexicon covers two senses, unsaved edits and rejecting a proposal. This is neither: the checkbox drops rows from a CSV export and destroys nothing the user made and refuses nothing offered. Most languages need a third verb for it, and every locale meets it in **batch 1**. | `config:discardUntranslatable` — "Discard entries that don't need translation" | `de`, `ja`, `tr` (and shipped `fr`) | **Four independent locales reached an omit/exclude verb, none having seen the others' files** — `de` "weglassen" (*verwerfen* held for sense 1), `ja` 除外する, `tr` "dışarıda bırak", and shipped `fr` already renders it "Exclure". Only shipped `es` ("Descartar") and `ru` («Отбросить») use the discard root, both predating this row. Decide from the four, not from `de` alone. | `de`/`ja`/`tr` batch 1 | **PROMOTE** as a row of its own: **omit (from an export)**. *Means here:* exclude rows from a generated artifact. It destroys nothing the user made and refuses nothing offered, so it is neither sense of *discard*. *Part of speech:* verb, on a checkbox label. *Not:* discard, delete, remove, skip, ignore. Four locales converging without seeing each other is the strongest evidence any row in this queue carries. |
| **ignore / ignored** — the lexicon has no row for it, and it is a state AND an action on the same object: an ignored entry is excluded from every AI dispatch, which is neither *skip* nor *discard* nor *disable*. Every locale meets it in **batch 2** (`strings`). | `strings:row.ignored` ("Ignored"), `strings:row.ignoreAction` / `row.unignoreAction`, `strings:bulk.ignoreEntry`, `strings:editor.ignoreOverflow` | `ja`, `de` | `ja` stem 無視 throughout — state 無視中, action エントリを無視, negated action エントリの無視を解除; the state/action split is carried by the inflection, not by a second term. `de` verb *ignorieren*, state *Ignoriert*, negation *nicht mehr ignorieren* — German has no idiomatic verb for "unignore", so the negation is built rather than coined (*entignorieren* is not a word). | `ja` and `de` batch 2, independently, from the identical keys | **PROMOTE.** *Means here:* mark an entry so that every AI dispatch skips it, while it stays in the project and stays visible in the table. Reversible. *Part of speech:* verb for the action, participle for the state. *Not:* skip (a per-run routing outcome), discard, disable (a module or a feature), hide. Record in the row that no wave-1 language had an idiomatic verb for *unignore*, so the negation is built rather than coined. |
| **revert** — distinct from *undo*, which the lexicon does cover. *Revert* rolls a run's translations back; *undo* restores one earlier cell version. If a locale renders both with one word it loses a real distinction the UI makes. | `strings:runs.revert` ("Revert"), `strings:runs.revertedBadge`, `strings:runs.revertSuccess_*` — against `strings:compare.undo` ("Undo") | `ja`, `de` | `ja` 取り消し for *revert* (badge 取り消し済み), with 元に戻す deliberately held for *undo* at `compare.undo`. `de` *Zurücksetzen* / *Zurückgesetzt*, with *Rückgängig* held for *undo*. Both locales reserved a separate word for *undo* without seeing each other's file. The reservation matters because both controls can be on screen at once: *undo* reverses one edit, *revert* reverses everything one run wrote. | `ja` and `de` batch 2, independently, from the identical keys | **PROMOTE.** *Means here:* roll back every translation one run wrote, restoring the previous values. Distinct from *undo*, which restores one earlier version of one cell. *Not:* undo, cancel, restore (which is the backup verb). The reservation is load-bearing because both controls can be on screen at once; two locales reserved a separate word for *undo* independently. |
| **assistant** — the frozen lexicon has no row for it, and it names a *persona* rather than an act of assistance. Every locale meets it in **batch 2** (`strings` run-type labels) and again in **batch 6** (`colorText`, `stage-details`), so a locale that decides it late will have shipped a different word first. | `strings:runs.typeChatGeneric` / `typeChatTextStyler` / `typeChatStageDetails`; then `colorText:assistant.title` ("AI assistant"), `stage-details:chatAssistant` | `de` | **Assistent** — masculine, weak (n-Deklination): *der Assistent*, *des/dem/den Assistenten*, plural *die Assistenten*, so the **compound linking form is `Assistenten-`**, not the bare stem. Ships as "Assistenten-Chat (Text-Styler)" / "(Level-Details)" / bare, and prescribes **"KI-Assistent"** for `colorText:assistant.title` in batch 6. Must not drift to *Assistenz* (abstract assistance — the batch shipped that first and the review caught it), *Helfer* or *Bot*. | `de` batch 2 | **PROMOTE.** *Means here:* the product AI chat persona, in the Text Styler, Stage Details and generic chats. A role name, not an act of assistance. *Part of speech:* noun, and a compound element. *Not:* assistance (abstract), helper, bot, agent. The row needs the batch note: it is met in batch 2 and again in batch 6, so a locale that decides it late ships two words for one persona. |
| **back-translation** — the frozen lexicon has no row for it, and it is a term of art rather than a compound of *back* and *translation*: the machine re-translation of a target string into the source language, shown as a reading aid and never edited. A locale that renders it literally will name an action the product does not offer. Met in **batch 3** (`review`). | `review:backTranslationTitle` — "Back-translation (reference only)" | `ja` | 逆翻訳 — the established Japanese term of art, shipped as 「逆翻訳（参考のみ）」. | `ja` batch 3, raised for the controller to add because three locales share this file in one worktree | **PROMOTE.** *Means here:* the machine re-translation of a target string back into the source language, displayed read-only as a reading aid. Never edited and never sent anywhere. *Not:* reverse translation as an action, round-trip, source text. Raised by one locale, but the argument is language-independent and every language meets it in batch 3, so it does not wait for a second nomination. |
| **erase** — distinct from *delete*, which the lexicon covers, and from *remove*. Used only where the product destroys rows at a remote destination it does not own (the DeepL glossary), so a locale that collapses it into its *delete* word loses the warning that the destruction is not local. Met in **batch 3** (`glossary`). | `glossary:confirmPushReplaceTitle` — "Erase stale DeepL entries?" | `ja` | 消去 — shipped as 「DeepLの古いエントリを消去しますか？」, kept apart from 削除 (*delete*). | `ja` batch 3, raised for the controller to add because three locales share this file in one worktree | **HOLD as a row; promote the distinction into the frozen `delete` row instead.** One key does not justify a 77th row that eleven locales must each fill. The fact is real and belongs in `delete`’s **Not:** list: this key destroys rows at a remote destination the product does not own (the DeepL glossary), so a locale that renders it with its ordinary delete word loses the warning that the destruction is not local. **APPLIED DIFFERENTLY (2026-08-12): this lexicon has no `delete` row and never has had one, so the destination this resolution names does not exist. The hold stands and no `delete` term was invented; the fact went to `english-review-notes.md` instead, where reading the strings showed the destruction is also cross-project. See the bullet list above.** |
| **audit** — `audit` is not in the lexicon, and every language will reach for its *check* word, which is spent on the LQA checks. **A ruling is wanted rather than a rendering:** is this the recording feature the product already names elsewhere, under a second English name, or a term of its own? Met in **batch 4** (`collab`). | `collab:sharing.auditToggleLabel` — "Manual-edit audit" | `tr` | Raised for a ruling; the batch shipped its own rendering and recorded it in `style/tr.md` pending the resolution. | `tr` batch 4 | **HOLD — and the ruling it asked for is that the lexicon already covers it.** The frozen `recording` row is defined as “the manual-edit audit capturing who changed which translation by hand, kept for seven days”. That is this feature, under a second English name. Render `collab:sharing.audit*` with your **recording** term; do not coin an audit term and do not reach for the word spent on the LQA checks. One english-review-notes row is owed separately: the same card calls it *audit* (title), *record* (checkbox) and *track* (help) — three English words for one feature in three adjacent strings. |
| **revoke** — collides with *cancel*, *undo* and *remove* in more than one language, and the four invite statuses must resolve as **one set** rather than four independent choices. German found the sharper constraint: the status cell and the revoke button are **adjacent columns of one table**, and a mixed table paints a revoked status beside a live revoke button, so a locale whose infinitive and participle coincide collapses the pair exactly where a reader compares them. Met in **batch 4** (`collab`). | `collab:invites.revoke` ("Revoke") against `collab:invites.status.revoked` ("Revoked") | `tr`, `de` | `de` chose *zurückziehen* over *widerrufen* for the co-render reason above. `tr` raised the set-consistency requirement. | `tr` and `de` batch 4, independently | **PROMOTE.** *Means here:* cancel an invitation that has been sent and not accepted; the row remains and its status becomes *Revoked*. *Not:* delete, remove, cancel, undo. Two constraints go in the row: the four invite statuses resolve as **one set in one part of speech**, and the status cell and the revoke button are **adjacent columns of one table**, so a locale whose infinitive and participle coincide collapses the pair exactly where a reader compares them. |
| **dismiss** — **it deletes.** `notification-store.ts` issues a DELETE; a locale that reads *dismiss* as *close* or *hide* ships a false statement about a destructive action. This is the class of defect that has produced a finding in every language of this wave. Met in **batch 4** (`account`). | `account:notificationsDismiss` — "Dismiss" | `tr` | Raised so the destructive sense is settled once rather than guessed eleven times. | `tr` batch 4 | **PROMOTE, with both senses in one row, because English writes one word for two consequences.** `account:notificationsDismiss` **deletes** (the notification store issues a DELETE and the item does not return); `system:restarted.dismiss` closes a banner against a stored flag and destroys nothing. *Not:* close, hide — for the first sense. A locale may use one word for both only after checking which consequence each key has; the pair was found co-rendering-adjacent in the Japanese sweep and neither collapse clause catches it. |
| **badge variant names** — `Default` / `Secondary` / `Outline` / `Destructive` are **design-system variant names** shown in a settings preview, not descriptions of anything the user's data does. With no lexicon row every language will guess differently, and they must stay a coherent set. Met in **batch 4** (`settings`). | `settings:previewSamples.badgeDefault` / `badgeSecondary` / `badgeOutline` / `badgeDestructive` | `tr` | Varsayılan / İkincil / Çerçeveli / Yıkıcı. | `tr` batch 4 | **HOLD from the lexicon; file the ruling in `english-review-notes.md`.** These are design-system variant names shown in a rendering sample, not product concepts, so they do not belong among terms every locale must fill. The ruling is one sentence: translate them as ordinary adjectives describing appearance, keep the four a coherent set, and **do not give `badgeDestructive` the adjective derived from your delete verb** — nothing is destroyed, it is a colour. |
| **forget (a device)** — security-sensitive, and its object is **the saved key, not the device**: forgetting removes this browser's stored vault key, it does not touch the device or sign it out elsewhere. A locale that renders it as *delete the device* or *sign out* misstates what the button does. Met in **batch 4** (`account`). | `account:deviceForgetButton` ("Forget"), `account:deviceForgetConfirm` | `tr` | Raised for a ruling on the object, since the English names the wrong one. | `tr` batch 4 | **HOLD from the lexicon; file the ruling in `english-review-notes.md`.** Two keys, and the defect is in the English rather than in the vocabulary: *forget* names the device, and the object is this browser’s stored vault key. The fix is per-key — say what is actually removed, and do not write *sign out* or *delete the device* — which is exactly what that file is for. A lexicon row would ask eleven locales to reserve a word for a concept that appears twice. |
| **log / log entry / log stream** — and, more weakly, **console**, **log level**, **service restart**, **environment / slot**. The frozen lexicon's `Activity` row already reserves the word *log* **against** the live server-log panel while never naming that panel as a term of its own, so every language arrives at batch 5 with a word reserved against a concept the lexicon has not defined. Met in **batch 5** (`logs`, `console`). | `logs:*` and `console:*` throughout batch 5; the reservation is in `terminology.md`'s `Activity` row ("*Log* is taken by the live server-log panel, which is a different surface") | `ja` | As settled in `style/ja.md` during batch 5. | `ja` batch 5 — **requested and never filed; recovered while writing the wave-1 measurements** | **PROMOTE one row, `log`.** *Means here:* the live server-log panel and the lines it streams — the running narration of what the server did, not a record the user keeps. *Not:* history, activity (reserved), journal, audit, changelog. *Also record:* `log entry` and `log stream` fold into it unless a language needs a separate word for a single line. **HOLD the other four:** `console` is a surface name and belongs in the surface table rather than the term list; `log level` values are an enum set the paradigm rule already covers (review all values of one setting together); `service restart` and `environment` / `slot` are ops vocabulary appearing in a handful of keys and do not recur across namespaces. |
