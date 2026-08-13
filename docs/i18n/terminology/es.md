# NARN terminology — Spanish (`es`)

Your locale's rendering of every term in the shared lexicon. **This file is yours alone** —
no other locale's file is touched by your work, and nobody else writes rows here.

Read it alongside two other files:

- [`../terminology.md`](../terminology.md) — what each term *means*, its part of speech,
  an example key, and what it must not be confused with. It is **frozen** for the duration
  of the backfill: you read it, you never edit it. See the freeze notice at its top.
- [`../style/es.md`](../style/es.md) — how Spanish is written here: register, punctuation,
  capitalization, plural and agreement rules. That one is yours to write too, for this
  locale only.

Fill a row when you meet the term, in the same change that introduces the wording — so
this file records decisions actually taken, never predictions. Use **Notes** for anything
the next translator would otherwise have to rediscover: a declension that forced a
different word, a term you deliberately left in English, an acronym you expanded, a
candidate you rejected and why.

Terms are in the order they appear in `../terminology.md`. Do not add, remove or reorder
rows: a term the lexicon lacks goes in the additive queue in [`README.md`](README.md).

## Keyboard key names

`../terminology.md`'s "Keyboard key names" section is not one of the 84 frozen term rows —
it is a per-locale rule (write the key name as engraved on that locale's keyboard). Spanish
renderings, settled 2026-08-10: `Enter` → **Intro**, `Shift` → **Mayús**. `Esc` stays `Esc`
— unlike `Enter`/`Shift`, the escape key is already labelled `Esc` on a Spanish keyboard, so
copying it is the correct application of the rule, not an English leftover. `Tab`, `Ctrl`
and `Alt` do not currently occur as key names in any shipped `es` string.

Shipped examples: `common:webSearch.hint` — "Pulsa **Intro** para buscar en una nueva
pestaña"; `strings:compare.contextPlaceholder` / `tonePlaceholder` — "(**Intro** para
guardar, **Mayús**+**Intro** para nueva línea, **Esc** para cancelar)…";
`strings:compare.cellEditTooltip` — "Editar · **Intro** · **Esc** para cancelar";
`strings:compare.cellEditReviewedTooltip` — "Revisado — pulsa **Intro** para editar".

| Term | Rendering | Notes |
| --- | --- | --- |
| project |  |  |
| workspace |  |  |
| entry |  |  |
| source text |  |  |
| translation | traducción | Feminine — every standalone status word agreeing with it is feminine too. Already used throughout the shipped `strings` and `review` namespaces; the tab label is the plural "Traducciones". The verb is "traducir", and "re-translate" is "retraducir" (`review:retranslate`). |
| source label |  |  |
| achievement |  |  |
| inline tag |  |  |
| placeholder |  |  |
| translator context |  |  |
| source language |  |  |
| target language |  |  |
| reference language |  |  |
| writable language |  |  |
| Pseudo Test |  |  |
| run |  |  |
| revert |  |  |
| Activity |  |  |
| log |  |  |
| batch |  |  |
| batch grouping |  |  |
| AI review |  |  |
| judge |  |  |
| source review |  |  |
| finding |  |  |
| suggestion |  |  |
| discard |  |  |
| needs review | necesita revisión | Verb phrase, so no gender to agree. Sentence-cased in the filter ("Necesita revisión" — `filters.needsReview`, `compare.needsReviewFilter`), lowercase in the row badge ("necesita revisión" — `compare.cellNeedsReviewBadge`), same wording in both. "Marcar todo como necesita revisión" is the bulk form. For the related *reviewed* adjective see the gender rule above: token form "revisado", agreeing form "revisada". |
| flag | marcar | Verb on `review:flag`, participle on `review:filterFlagged`/`review:flaggedToast` — the review disposition, and only that. `review:sourceAi.runSummary`'s loose "flagged" (entries the source review marked as carrying findings, not the disposition) is not this term and takes *identificadas*, never *marcada(s)*. `glossary:flaggedTitle` still renders its own loose "flagged" as *marcados*, sharing the disposition root — a pre-existing collision this pass left untouched. |
| ignore / ignored |  |  |
| Review (the sidebar group) |  |  |
| review queue |  |  |
| back-translation |  |  |
| module |  |  |
| module instance |  |  |
| provider |  |  |
| model |  |  |
| prompt |  |  |
| reasoning effort |  |  |
| routing rule |  |  |
| rule group |  |  |
| credential vault |  |  |
| credential |  |  |
| LQA |  |  |
| quality gate |  |  |
| check |  |  |
| issue |  |  |
| severity |  |  |
| notification severity |  |  |
| assertion |  |  |
| pattern |  |  |
| overflow |  |  |
| length limit |  |  |
| pass rate |  |  |
| glossary | glosario | Masculine. Already used throughout the shipped `glossary` namespace; "diccionario" is wrong here. |
| glossary term | término | Masculine. Shortened to "término" alone inside the Glossary tab, exactly as English shortens "glossary term" to "term". Never "entrada", which is reserved for _entry_. |
| constant |  |  |
| match | coincidencia | Feminine. Plural "coincidencias" throughout the Matches panel ("{{count}} coincidencias", "No se encontraron coincidencias.", "Aplicar coincidencias"). The verb is "coincidir" (`config:models.noMatches` — "Ningún modelo coincide con tu búsqueda"). |
| translation memory |  |  |
| approve |  |  |
| category |  |  |
| tone |  |  |
| orphan |  |  |
| relink |  |  |
| backup |  |  |
| snapshot |  |  |
| template |  |  |
| omit (from an export) |  |  |
| collaborator |  |  |
| member |  |  |
| nickname |  |  |
| claim |  |  |
| invite |  |  |
| revoke |  |  |
| recording |  |  |
| stage |  |  |
| Text Styler |  |  |
| element |  |  |
| assistant |  |  |
| theme |  |  |
| guide |  |  |
| release |  |  |
| changelog |  |  |
| dismiss |  |  |
