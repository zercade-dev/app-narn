# NARN terminology — French (`fr`)

Your locale's rendering of every term in the shared lexicon. **This file is yours alone** —
no other locale's file is touched by your work, and nobody else writes rows here.

Read it alongside two other files:

- [`../terminology.md`](../terminology.md) — what each term *means*, its part of speech,
  an example key, and what it must not be confused with. It is **frozen** for the duration
  of the backfill: you read it, you never edit it. See the freeze notice at its top.
- [`../style/fr.md`](../style/fr.md) — how French is written here: register, punctuation,
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

`../terminology.md`'s "Keyboard key names" section is not one of the 76 frozen term rows —
it is a per-locale rule (write the key name as engraved on that locale's keyboard). French
(AZERTY) renderings, settled 2026-08-10: `Enter` → **Entrée**, `Esc` → **Échap**,
`Shift` → **Maj**. `Tab`, `Ctrl` and `Alt` do not currently occur as key names in any
shipped `fr` string.

Shipped examples: `common:webSearch.hint` — "Appuyez sur **Entrée** pour rechercher dans un
nouvel onglet"; `strings:compare.contextPlaceholder` / `tonePlaceholder` — "(**Entrée** pour
enregistrer, **Maj**+**Entrée** pour un saut de ligne, **Échap** pour annuler)…";
`strings:compare.cellEditTooltip` — "Modifier · **Entrée** · **Échap** pour annuler";
`strings:compare.cellEditReviewedTooltip` — "Révisé — appuyez sur **Entrée** pour modifier".

| Term | Rendering | Notes |
| --- | --- | --- |
| project |  |  |
| workspace |  |  |
| entry |  |  |
| source text |  |  |
| translation | traduction | Feminine. Already used throughout the shipped `strings` and `review` namespaces; the tab label is the plural "Traductions". The verb is "traduire", and "re-translate" is "retraduire" (`review:retranslate`). |
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
| Activity |  |  |
| batch |  |  |
| batch grouping |  |  |
| AI review |  |  |
| judge |  |  |
| source review |  |  |
| finding |  |  |
| suggestion |  |  |
| discard |  |  |
| needs review | à réviser | No gender to agree. Sentence-cased in the filter ("À réviser"), lowercase in the row badge ("à réviser"), same wording in both. Note the capital À keeps its accent in the filter form. For the related *révisé* adjective see the gender rule above: token form "révisé", agreeing form "révisée". |
| flag |  |  |
| Review (the sidebar group) |  |  |
| review queue |  |  |
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
| glossary | glossaire | Masculine. Already used throughout the shipped `glossary` namespace. |
| glossary term | terme | Masculine. Shortened to "terme" alone inside the Glossary tab. Never "entrée", which is reserved for _entry_. |
| constant |  |  |
| match | correspondance | Feminine. Plural "correspondances" throughout the Matches panel ("{{count}} correspondances", "Aucune correspondance trouvée.", "Appliquer les correspondances"). The verb is "correspondre" (`config:models.noMatches` — "Aucun modèle ne correspond à votre recherche"). |
| translation memory |  |  |
| approve |  |  |
| category |  |  |
| tone |  |  |
| orphan |  |  |
| relink |  |  |
| backup |  |  |
| snapshot |  |  |
| template |  |  |
| collaborator |  |  |
| member |  |  |
| nickname |  |  |
| claim |  |  |
| invite |  |  |
| recording |  |  |
| stage |  |  |
| Text Styler |  |  |
| element |  |  |
| theme |  |  |
| guide |  |  |
| release |  |  |
| changelog |  |  |
