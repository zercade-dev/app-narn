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
| `es` | [`es.md`](es.md) | shipped; 5 of 76 rows recorded |
| `fr` | [`fr.md`](fr.md) | shipped; 5 of 76 rows recorded |
| `ru` | [`ru.md`](ru.md) | shipped; all 76 rows recorded by the pilot |

The eleven languages of the backfill:

[`de.md`](de.md) · [`it.md`](it.md) · [`pt-br.md`](pt-br.md) · [`tr.md`](tr.md) ·
[`id.md`](id.md) · [`vi.md`](vi.md) · [`th.md`](th.md) · [`ja.md`](ja.md) ·
[`ko.md`](ko.md) · [`zh-hans.md`](zh-hans.md) · [`zh-hant.md`](zh-hant.md)

All eleven start empty — 76 rows, no renderings.

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

| Proposed term | Key that motivated it | Locale | Rendering used | Raised by |
| --- | --- | --- | --- | --- |
| **discard (third sense): omit from an export** — `discard` in the lexicon covers two senses, unsaved edits and rejecting a proposal. This is neither: the checkbox drops rows from a CSV export and destroys nothing the user made and refuses nothing offered. Most languages need a third verb for it, and every locale meets it in **batch 1**. | `config:discardUntranslatable` — "Discard entries that don't need translation" | `de`, `ja`, `tr` (and shipped `fr`) | **Four independent locales reached an omit/exclude verb, none having seen the others' files** — `de` "weglassen" (*verwerfen* held for sense 1), `ja` 除外する, `tr` "dışarıda bırak", and shipped `fr` already renders it "Exclure". Only shipped `es` ("Descartar") and `ru` («Отбросить») use the discard root, both predating this row. Decide from the four, not from `de` alone. | `de`/`ja`/`tr` batch 1 |
| **ignore / ignored** — the lexicon has no row for it, and it is a state AND an action on the same object: an ignored entry is excluded from every AI dispatch, which is neither *skip* nor *discard* nor *disable*. Every locale meets it in **batch 2** (`strings`). | `strings:row.ignored` ("Ignored"), `strings:row.ignoreAction` / `row.unignoreAction`, `strings:bulk.ignoreEntry`, `strings:editor.ignoreOverflow` | `ja`, `de` | `ja` stem 無視 throughout — state 無視中, action エントリを無視, negated action エントリの無視を解除; the state/action split is carried by the inflection, not by a second term. `de` verb *ignorieren*, state *Ignoriert*, negation *nicht mehr ignorieren* — German has no idiomatic verb for "unignore", so the negation is built rather than coined (*entignorieren* is not a word). | `ja` and `de` batch 2, independently, from the identical keys |
| **revert** — distinct from *undo*, which the lexicon does cover. *Revert* rolls a run's translations back; *undo* restores one earlier cell version. If a locale renders both with one word it loses a real distinction the UI makes. | `strings:runs.revert` ("Revert"), `strings:runs.revertedBadge`, `strings:runs.revertSuccess_*` — against `strings:compare.undo` ("Undo") | `ja`, `de` | `ja` 取り消し for *revert* (badge 取り消し済み), with 元に戻す deliberately held for *undo* at `compare.undo`. `de` *Zurücksetzen* / *Zurückgesetzt*, with *Rückgängig* held for *undo*. Both locales reserved a separate word for *undo* without seeing each other's file. The reservation matters because both controls can be on screen at once: *undo* reverses one edit, *revert* reverses everything one run wrote. | `ja` and `de` batch 2, independently, from the identical keys |
| **assistant** — the frozen lexicon has no row for it, and it names a *persona* rather than an act of assistance. Every locale meets it in **batch 2** (`strings` run-type labels) and again in **batch 6** (`colorText`, `stage-details`), so a locale that decides it late will have shipped a different word first. | `strings:runs.typeChatGeneric` / `typeChatTextStyler` / `typeChatStageDetails`; then `colorText:assistant.title` ("AI assistant"), `stage-details:chatAssistant` | `de` | **Assistent** — masculine, weak (n-Deklination): *der Assistent*, *des/dem/den Assistenten*, plural *die Assistenten*, so the **compound linking form is `Assistenten-`**, not the bare stem. Ships as "Assistenten-Chat (Text-Styler)" / "(Level-Details)" / bare, and prescribes **"KI-Assistent"** for `colorText:assistant.title` in batch 6. Must not drift to *Assistenz* (abstract assistance — the batch shipped that first and the review caught it), *Helfer* or *Bot*. | `de` batch 2 |
| **back-translation** — the frozen lexicon has no row for it, and it is a term of art rather than a compound of *back* and *translation*: the machine re-translation of a target string into the source language, shown as a reading aid and never edited. A locale that renders it literally will name an action the product does not offer. Met in **batch 3** (`review`). | `review:backTranslationTitle` — "Back-translation (reference only)" | `ja` | 逆翻訳 — the established Japanese term of art, shipped as 「逆翻訳（参考のみ）」. | `ja` batch 3, raised for the controller to add because three locales share this file in one worktree |
| **erase** — distinct from *delete*, which the lexicon covers, and from *remove*. Used only where the product destroys rows at a remote destination it does not own (the DeepL glossary), so a locale that collapses it into its *delete* word loses the warning that the destruction is not local. Met in **batch 3** (`glossary`). | `glossary:confirmPushReplaceTitle` — "Erase stale DeepL entries?" | `ja` | 消去 — shipped as 「DeepLの古いエントリを消去しますか？」, kept apart from 削除 (*delete*). | `ja` batch 3, raised for the controller to add because three locales share this file in one worktree |
| **audit** — `audit` is not in the lexicon, and every language will reach for its *check* word, which is spent on the LQA checks. **A ruling is wanted rather than a rendering:** is this the recording feature the product already names elsewhere, under a second English name, or a term of its own? Met in **batch 4** (`collab`). | `collab:sharing.auditToggleLabel` — "Manual-edit audit" | `tr` | Raised for a ruling; the batch shipped its own rendering and recorded it in `style/tr.md` pending the resolution. | `tr` batch 4 |
| **revoke** — collides with *cancel*, *undo* and *remove* in more than one language, and the four invite statuses must resolve as **one set** rather than four independent choices. German found the sharper constraint: the status cell and the revoke button are **adjacent columns of one table**, and a mixed table paints a revoked status beside a live revoke button, so a locale whose infinitive and participle coincide collapses the pair exactly where a reader compares them. Met in **batch 4** (`collab`). | `collab:invites.revoke` ("Revoke") against `collab:invites.status.revoked` ("Revoked") | `tr`, `de` | `de` chose *zurückziehen* over *widerrufen* for the co-render reason above. `tr` raised the set-consistency requirement. | `tr` and `de` batch 4, independently |
| **dismiss** — **it deletes.** `notification-store.ts` issues a DELETE; a locale that reads *dismiss* as *close* or *hide* ships a false statement about a destructive action. This is the class of defect that has produced a finding in every language of this wave. Met in **batch 4** (`account`). | `account:notificationsDismiss` — "Dismiss" | `tr` | Raised so the destructive sense is settled once rather than guessed eleven times. | `tr` batch 4 |
| **badge variant names** — `Default` / `Secondary` / `Outline` / `Destructive` are **design-system variant names** shown in a settings preview, not descriptions of anything the user's data does. With no lexicon row every language will guess differently, and they must stay a coherent set. Met in **batch 4** (`settings`). | `settings:previewSamples.badgeDefault` / `badgeSecondary` / `badgeOutline` / `badgeDestructive` | `tr` | Varsayılan / İkincil / Çerçeveli / Yıkıcı. | `tr` batch 4 |
| **forget (a device)** — security-sensitive, and its object is **the saved key, not the device**: forgetting removes this browser's stored vault key, it does not touch the device or sign it out elsewhere. A locale that renders it as *delete the device* or *sign out* misstates what the button does. Met in **batch 4** (`account`). | `account:deviceForgetButton` ("Forget"), `account:deviceForgetConfirm` | `tr` | Raised for a ruling on the object, since the English names the wrong one. | `tr` batch 4 |
