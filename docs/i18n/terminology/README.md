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
| **ignore / ignored** — the lexicon has no row for it, and it is a state AND an action on the same object: an ignored entry is excluded from every AI dispatch, which is neither *skip* nor *discard* nor *disable*. Every locale meets it in **batch 2** (`strings`). | `strings:row.ignored` ("Ignored"), `strings:row.ignoreAction` / `row.unignoreAction`, `strings:bulk.ignoreEntry`, `strings:editor.ignoreOverflow` | `ja` | Stem 無視 throughout — state 無視中, action エントリを無視, negated action エントリの無視を解除. The state/action split is carried by the inflection, not by a second term. | `ja` batch 2, raised for the controller to add because three locales share this file in one worktree |
| **revert** — distinct from *undo*, which the lexicon does cover. *Revert* rolls a run's translations back; *undo* restores one earlier cell version. If a locale renders both with one word it loses a real distinction the UI makes. | `strings:runs.revert` ("Revert"), `strings:runs.revertedBadge`, `strings:runs.revertSuccess_*` — against `strings:compare.undo` ("Undo") | `ja` | 取り消し for *revert* (badge 取り消し済み), with 元に戻す deliberately held for *undo* at `compare.undo`. Verified both ship as written. | `ja` batch 2, raised for the controller to add because three locales share this file in one worktree |
