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

`../terminology.md`'s "Keyboard key names" section is not one of the 84 frozen term rows —
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
| run | exécution | Feminine. Already shipped: `batch:cancelRun` "Annuler l'exécution", `batch:runCancelled` "Exécution annulée :", `logs:translation.runQueued` "Exécution de traduction en file d'attente — position {{position}}." Noun only — never the anglicism "un run" (see `style/fr.md`); the verbs stay "traduire", "lancer", "générer". The Activity tab that lists runs is "Activité", a separate term. |
| revert |  |  |
| Activity |  |  |
| log |  |  |
| batch | lot | Masculine. Already shipped: `config:module.batchMode` "Mode de lot", `config:batchGroupingLabel` "Regroupement des lots", `config:batchGroupingDescription` "…dans le même lot…". Keep it distinct from *run* ("exécution"), which contains several lots, and do not reuse "lot" for bulk operations over selected rows. |
| batch grouping |  |  |
| AI review |  |  |
| judge |  |  |
| source review |  |  |
| finding |  |  |
| suggestion |  |  |
| discard |  |  |
| needs review | à réviser | No gender to agree. Sentence-cased in the filter ("À réviser"), lowercase in the row badge ("à réviser"), same wording in both. Note the capital À keeps its accent in the filter form. For the related *révisé* adjective see the gender rule above: token form "révisé", agreeing form "révisée". |
| flag | signaler | Verb on `review:flag`, participle on `review:filterFlagged`/`review:flaggedToast` — the review disposition, and only that. `review:sourceAi.runSummary`'s loose "flagged" (entries the source review marked as carrying findings, not the disposition) is not this term and takes *marquées*, matching how French already renders other loose flag uses (`strings:flagAllNeedsReviewDone` "marquée(s)"). `glossary:flaggedTitle` still renders its own loose "flagged" as *signalé(s)*, sharing the disposition root — a pre-existing collision this pass left untouched. |
| ignore / ignored |  |  |
| Review (the sidebar group) |  |  |
| review queue |  |  |
| back-translation |  |  |
| module |  |  |
| module instance |  |  |
| provider | fournisseur | The outside company/service behind a module. `config:enableModuleHelp` "Ajoutez un fournisseur d'IA ou de traduction à utiliser dans vos projets." The three English strings that mislabel a module-instance picker *Provider* (`colorText:assistant.instanceLabel`, `stage-details:chatInstanceLabel`, `config:routing.simplePlaceholder` "Choisissez un fournisseur") are translated as written and must not drag *module* toward this word anywhere else. |
| model | modèle | Masculine. Already shipped: `config:routing.labelModelOverride` "Modèle personnalisé", `config:freeway.colModel` "Modèle", and throughout the Freeway guide. The collision `style/fr.md` warns about is still live — `sidebar:templateNone` ships as "Aucun modèle" — and the word stays with *model*: it is *template* that has to move to another rendering. Model ids themselves are never translated. |
| prompt |  |  |
| reasoning effort |  |  |
| routing rule | règle de routage | Feminine. Already shipped: `config:routing.title` "Règles de routage". "routage" is content routing, not network routing, and it is also the bare noun for the Routing tab and its settings ("Pointez le routage vers Freeway", `guides/fr/usage-freeway.md`); the verb used in prose is "acheminer". Never "filtre", "condition" or "redirection". |
| rule group |  |  |
| credential vault | coffre de credentials | Masculine. **"credentials" is kept as an English loanword inside this specific compound**, lowercase, not translated to "identifiants" — that is what's already shipped three times (`vault:statusLabel` "Coffre de credentials", `vault:unlockTitle` "Déverrouiller le coffre de credentials", `vault:createTitle` "Créer le coffre de credentials") and is a deliberate exception to the ordinary "credential" → "identifiants" rendering used elsewhere in the same file (`config:credentialsMissingChip` "Identifiants manquants"). Shortened to "le coffre" where the context is unambiguous — `config:credentialsVaultLockedChip` "Coffre verrouillé", `config:credentialsUnlockButton` "Déverrouiller le coffre", `console:vaultLocked` "Coffre verrouillé". |
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
