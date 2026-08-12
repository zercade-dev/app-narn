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
| `es` | [`es.md`](es.md) | shipped; 5 of 84 rows recorded |
| `fr` | [`fr.md`](fr.md) | shipped; 5 of 84 rows recorded |
| `ru` | [`ru.md`](ru.md) | shipped; 76 of 84 rows recorded — the pilot filled every row the lexicon then had |

The eleven languages of the backfill:

[`de.md`](de.md) · [`it.md`](it.md) · [`pt-br.md`](pt-br.md) · [`tr.md`](tr.md) ·
[`id.md`](id.md) · [`vi.md`](vi.md) · [`th.md`](th.md) · [`ja.md`](ja.md) ·
[`ko.md`](ko.md) · [`zh-hans.md`](zh-hans.md) · [`zh-hant.md`](zh-hant.md)

Each of the eleven has 84 rows, and all eleven started with no renderings. `de`, `ja` and
`tr` are no longer empty — wave 1 filled the 76 rows the lexicon had then. **The eight rows
added by the resolution below are empty in every one of the fourteen files, `ru`, `de`, `ja`
and `tr` included**: a locale records a rendering in the change that decides it, and none of
them has decided these yet.

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

Rows raised since the last resolution. **Check the resolution below before adding one** — a
term settled there is settled, and re-raising it costs the next resolution a re-reading of
an argument already made.

| Proposed term | Key that motivated it | Locale | Rendering used | Raised by |
| --- | --- | --- | --- | --- |
| _(empty)_ | | | | |

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
